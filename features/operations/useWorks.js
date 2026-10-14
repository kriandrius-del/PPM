// Reactive jobs: the rules every change to a job goes through (moved out of MainApp in Phase 2, round 31).
// - approval: quote approval is its own permission; a quote raised above what was approved goes back for approval
// - the job lifecycle: the dates and follow-ons of each stage, and a line on the job's timeline for each change
// - refusals: a change the rules don't allow is refused with the reason (the database checks it again)
// MainApp keeps the state and saving; this hook gets them in `ctx` and hands back the actions.
import { useMemo } from "react";
import { GO_AHEAD, lifecycleRefusal, worksRefusal } from "../../app/permissions.js";
import { gbp } from "../../lib/utils.js";
import { LIFECYCLE, isOffice, lifecycleEvents } from "./lifecycle.js";

const pence = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function makeWorksActions(ctx) {
  const { works = [], persistWorks, userName, role, canApprove = false, limit = 0, hideMoney = false, showToast = () => {}, tellUser = () => {}, supplierName = () => "" } = ctx;
  const by = userName || "Unknown";

  function withApprovalRules(w, next) {
    // amounts are stored as plain numbers (older records may hold text)
    for (const f of ["quoteAmount", "approvedAmount"]) if (next[f] !== undefined && next[f] !== null && next[f] !== "" && next[f] !== pence(next[f])) next = { ...next, [f]: pence(next[f]) };
    const at = new Date().toISOString();
    const note = (text) => [...(next.comments || []), { text, by, at }];
    // moving an approved job to another supplier or asset sends it back for approval (unless an approver does it)
    if (w && w.approvedBy && next.approvedBy && !canApprove && next.status !== "completed" && (next.supplierId !== w.supplierId || next.deviceId !== w.deviceId)) {
      next = { ...next, approvedBy: null, approvedAt: null, approvedAmount: null, status: GO_AHEAD.includes(next.status) ? "quoted" : next.status, comments: note("Supplier or asset changed after approval — needs approving again") };
    }
    const q = Number(next.quoteAmount) || 0; const oldQ = Number(w?.quoteAmount) || 0;
    if (!w || limit <= 0 || q < limit || q <= oldQ) return next;
    if (next.approvedBy && q > (Number(w.approvedAmount ?? w.quoteAmount) || 0)) {
      // an approver changing the quote approves the new amount; anyone else sends it back for approval
      if (canApprove) return { ...next, approvedBy: by, approvedAt: at, approvedAmount: q, comments: note(`Approved the new quote of ${gbp(q)}`) };
      if (next.status === "completed") return next;   // refused below: a finished job's approved quote can't be raised
      return { ...next, approvedBy: null, approvedAt: null, approvedAmount: null, status: "quoted", comments: note(`Quote changed to ${gbp(q)} after it was approved — needs approving again`) };
    }
    if (!next.approvedBy && GO_AHEAD.includes(next.status)) {
      // a job under way whose quote now goes over the limit waits for approval
      return { ...next, status: "quoted", comments: note(`Quote changed to ${gbp(q)}, over the ${gbp(limit)} approval limit — needs approving`) };
    }
    return next;
  }
  const refusal = (before, after) => lifecycleRefusal(role, before ? [before] : [], [after]) || worksRefusal(before ? [before] : [], [after], { approver: canApprove, limit });

  // Going on / coming off hold: the paused days are added to the work's target date.
  function holdChange(w, newStatus, today) {
    if (!newStatus || newStatus === w.status) return {};
    if (newStatus === "on_hold") return { heldSince: today };
    if (w.status === "on_hold" && w.heldSince) return { heldSince: null, heldDays: (Number(w.heldDays) || 0) + Math.max(0, Math.round((new Date(today) - new Date(w.heldSince)) / 86400000)) };
    return {};
  }

  // One change to one job, with everything that follows from it.
  function applyChange(w, patch) {
    const at = new Date().toISOString(); const today = at.slice(0, 10);
    const extra = {};
    const status = patch.status;
    if (status === "completed" && w.status !== "completed") { extra.completedAt = today; extra.lc = LIFECYCLE; }   // finished from now on: the office checks it
    else if (status && status !== "completed") extra.completedAt = null;
    if (status === "in_progress" && !w.startedAt && !w.attendedAt) extra.startedAt = at;
    // reopened after it was finished: the old quality check no longer counts (only the office can clear it)
    if (status && status !== "completed" && w.status === "completed" && w.checkedAt && isOffice(role)) { extra.checkedAt = null; extra.checkedBy = null; extra.checkNote = null; }
    // the quote coming in: remember when (without the amount), and a new request becomes "quoted"
    if (patch.quoteAmount !== undefined && Number(patch.quoteAmount) > 0 && !(Number(w.quoteAmount) > 0)) {
      if (!w.quotedAt) extra.quotedAt = today;
      if ((status || w.status) === "requested") extra.status = "quoted";
    }
    let next = withApprovalRules(w, { ...w, ...patch, ...extra, ...holdChange(w, status || extra.status, today) });
    const events = lifecycleEvents(w, next, { by, at, supplierName });
    if (events.length) next = { ...next, events: [...(w.events || []), ...events] };
    return next;
  }

  function updateWork(id, patch) {
    const w = works.find((x) => x.id === id); if (!w) return false;
    const next = applyChange(w, patch);
    const problem = refusal(w, next);
    if (problem) { tellUser("Not changed", problem); return false; }
    if (patch.status === undefined && next.status === "quoted" && w.status !== "quoted" && w.status !== "requested") showToast("Quote needs approving", hideMoney ? "It's over the approval limit, so it waits for approval." : `${gbp(next.quoteAmount)} is over what was approved or the ${gbp(limit)} limit`, true);
    persistWorks(works.map((x) => (x.id === id ? next : x)));
    return true;
  }

  function bulkUpdateWorks(ids, patch) {
    const set = new Set(ids); let held = 0;
    persistWorks(works.map((w) => {
      if (!set.has(w.id)) return w;
      const next = applyChange(w, patch);
      if (refusal(w, next)) { held++; return w; }   // over-limit quotes wait for approval
      return next;
    }));
    const done = ids.length - held;
    showToast(`${done} work${done === 1 ? "" : "s"} updated`, held ? `${held} left as they were — not allowed yet (for example a quote over the approval limit needs approving first)` : patch.status ? `status: ${patch.status.replace("_", " ")}` : patch.assignee !== undefined ? `assigned to ${patch.assignee || "nobody"}` : "");
  }

  // A new job: approval rules, and where it starts in its life. A job the office raises is already accepted
  // (triaged); one raised by an engineer, a QR code or a failed check waits for the office.
  function prepareNewWork(work) {
    if (work.quoteAmount !== undefined && work.quoteAmount !== null && work.quoteAmount !== "") work = { ...work, quoteAmount: pence(work.quoteAmount) };
    if (limit > 0 && Number(work.quoteAmount) >= limit && (GO_AHEAD.includes(work.status) || work.status === "completed") && !work.approvedBy) {
      const at = new Date().toISOString();
      if (canApprove) work = { ...work, approvedBy: by, approvedAt: at, approvedAmount: Number(work.quoteAmount), comments: [...(work.comments || []), { text: `Approved ${gbp(work.quoteAmount)} when raised`, by, at }] };
      else { work = { ...work, status: "quoted" }; setTimeout(() => showToast("Sent for approval", `The quote is over the ${gbp(limit)} approval limit`), 2400); }
    }
    if (!canApprove) { const { approvedBy, approvedAt, approvedAmount, ...rest } = work; work = rest; }
    const at = new Date().toISOString();
    work = { ...work, lc: LIFECYCLE };
    if (Number(work.quoteAmount) > 0 && !work.quotedAt) work.quotedAt = at.slice(0, 10);
    if (isOffice(role) && !work.triagedAt) work = { ...work, triagedAt: at, triagedBy: by };
    else if (!isOffice(role)) { const { triagedAt, triagedBy, checkedAt, checkedBy, checkNote, ...rest } = work; work = rest; }
    if (work.status === "in_progress" && !work.startedAt) work.startedAt = at;
    if (work.status === "completed" && !work.completedAt) work.completedAt = at.slice(0, 10);
    return work;
  }

  return { withApprovalRules, approvalProblem: refusal, holdChange, applyChange, updateWork, bulkUpdateWorks, prepareNewWork };
}

export function useWorks(ctx) {
  const { works, persistWorks, userName, role, canApprove, limit, hideMoney, showToast, tellUser, supplierName } = ctx;
  return useMemo(() => makeWorksActions(ctx), [works, persistWorks, userName, role, canApprove, limit, hideMoney, showToast, tellUser, supplierName]); // eslint-disable-line react-hooks/exhaustive-deps
}
