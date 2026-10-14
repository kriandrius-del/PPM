// One life for every job (Phase 2, round 31):
//   request → triage → prioritised → quote required → quote received → approval → scheduled → assigned →
//   in progress → completed → quality check → invoice → closed.
// Every job shows the same strip of stages. A stage the job doesn't need is skipped automatically, with the reason:
// no quote for an in-house fix, no approval under the limit, no invoice for in-house work. Each stage is worked out
// from what's recorded on the job, so older jobs fit in too (their quality check shows "before checks began").
// The owner's decisions (14 Oct 2026): skip what a job doesn't need; the office checks every finished job;
// engineers see their own jobs first; failed checks suggest a job for the office to confirm.
import { WORK_PRIORITIES, WORK_STATUSES } from "../../lib/constants.js";
import { fmtDate } from "../../lib/utils.js";

// Who does what (the database checks the same: ppm_list_guard)
export const OFFICE_ROLES = ["owner", "admin", "manager", "coordinator"];   // accept (triage) jobs, book, assign, quality check
export const INVOICE_ROLES = ["owner", "admin", "manager", "finance"];      // "no invoice needed"
export const TRIAGE_FIELDS = ["triagedAt", "triagedBy"];
export const CHECK_FIELDS = ["checkedAt", "checkedBy", "checkNote"];
export const INVOICE_FIELDS = ["invoiceNeeded"];
export const isOffice = (role) => OFFICE_ROLES.includes(role);
export const LIFECYCLE = 2;   // jobs raised or finished from round 31 carry lc: 2 — they get a quality check

export const STAGES = [
  { key: "requested", label: "Requested" },
  { key: "triage", label: "Triage" },
  { key: "priority", label: "Prioritised" },
  { key: "quoteReq", label: "Quote required" },
  { key: "quoteIn", label: "Quote received" },
  { key: "approval", label: "Approval" },
  { key: "scheduled", label: "Scheduled" },
  { key: "assigned", label: "Assigned" },
  { key: "inProgress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "check", label: "Quality check" },
  { key: "invoice", label: "Invoice" },
  { key: "closed", label: "Closed" },
];
// What the job is waiting for, for list cards and filters
export const WAITING = {
  triage: "To triage", priority: "To triage", quoteReq: "Quote to request", quoteIn: "Waiting for the quote", approval: "Needs approval",
  scheduled: "To book", assigned: "To assign", inProgress: "Ready to start", completed: "In progress", check: "To check", invoice: "To invoice",
};

const filled = (v) => v !== undefined && v !== null && v !== "";
const priorityLabel = (p) => (WORK_PRIORITIES.find((x) => x.key === (p || "medium")) || WORK_PRIORITIES[1]).label;
export const statusLabel = (s) => (WORK_STATUSES.find((x) => x.key === s) || {}).label || s || "—";
const day = (iso) => (iso ? fmtDate(String(iso).slice(0, 10)) : "");

// Has the quote come in? (quotedAt is kept without the amount, so it can be shown to people who see no prices)
export const isQuoted = (w) => Number(w.quoteAmount) > 0 || filled(w.quotedAt);
// Does the job need a quote? Decided at triage; until then a job with a supplier does, an in-house one doesn't.
export function quoteNeeded(w) {
  if (w.quoteNeeded === true || w.quoteNeeded === false) return w.quoteNeeded;
  if (isQuoted(w) || filled(w.quoteRequestedAt) || (w.quotes || []).length) return true;
  if (w.supplierId) return true;
  if (w.assignee) return false;
  return null;
}
export function isOverLimit(w, limit) {
  if (w.overLimit === true) return true;   // set by the database for people who see no prices (Phase 2 tables)
  return Number(limit) > 0 && Number(w.quoteAmount) >= Number(limit);
}
// An invoice is expected for supplier work that costs something; in-house work, warranty work and jobs the office
// marks "no invoice needed" skip it.
export function invoiceReason(w) {
  if (w.invoiceNeeded === false) return "marked not needed";
  if (w.warranty) return "warranty work";
  if (!w.supplierId) return "in-house work";
  if (quoteNeeded(w) === false && !(Number(w.finalCost) > 0)) return "no cost";
  return "";
}

// The stages of one job. ctx: { limit, invoiced (bool), hideMoney, supplierName(id) }
export function jobStages(w, ctx = {}) {
  const { limit = 0, invoiced = false, hideMoney = false, supplierName = () => "" } = ctx;
  const st = w.status || "requested";
  const rejected = st === "rejected"; const completed = st === "completed"; const onHold = st === "on_hold";
  const started = completed || st === "in_progress" || filled(w.startedAt) || filled(w.attendedAt);
  const legacy = !w.lc;
  const quoted = isQuoted(w); const qn = quoteNeeded(w); const over = isOverLimit(w, limit);
  const triaged = filled(w.triagedAt) || started || (legacy && !["requested"].includes(st));
  const s = {};
  const done = (note = "") => ({ state: "done", note });
  const todo = (note = "") => ({ state: "todo", note });
  const skip = (note = "") => ({ state: "skipped", note });
  const raiser = w.requestedBy || w.loggedBy;
  s.requested = done(`${fmtDate(w.dateRaised)}${raiser ? ` · ${raiser}` : ""}`);
  s.triage = triaged ? done(w.triagedBy ? `accepted by ${w.triagedBy}` : "accepted") : todo("the office accepts it");
  s.priority = triaged ? done(priorityLabel(w.priority)) : todo(`${priorityLabel(w.priority)} for now`);
  if (qn === false) { s.quoteReq = skip("no quote needed"); s.quoteIn = skip("no quote needed"); }
  else {
    s.quoteReq = filled(w.quoteRequestedAt) || quoted ? done(filled(w.quoteRequestedAt) ? `asked ${fmtDate(w.quoteRequestedAt)}` : "") : todo("ask the supplier");
    s.quoteIn = quoted ? done(hideMoney ? "added" : "") : todo(filled(w.quoteRequestedAt) ? "waiting for it" : "");
  }
  if (!quoted) s.approval = qn === false ? skip("no quote") : todo("after the quote");
  else if (!over) s.approval = skip(hideMoney ? "not needed" : Number(limit) > 0 ? "under the limit" : "no approval rule");
  else s.approval = filled(w.approvedBy) ? done(`by ${w.approvedBy}`) : todo("needed");
  s.scheduled = filled(w.scheduledFor) ? done(fmtDate(w.scheduledFor)) : filled(w.eta) ? done(`supplier: by ${fmtDate(w.eta)}`) : todo("book a date");
  const who = [w.assignee, w.supplierId ? supplierName(w.supplierId) || "supplier" : ""].filter(Boolean).join(" · ");
  s.assigned = who ? done(who) : todo("nobody yet");
  s.inProgress = started ? done(day(w.startedAt || w.attendedAt)) : todo("");
  s.completed = completed ? done(fmtDate(w.completedAt)) : todo("");
  if (!completed) s.check = todo("after the work");
  else if (filled(w.checkedAt)) s.check = done(`by ${w.checkedBy || "the office"}`);
  else if (legacy) s.check = skip("before checks began");
  else s.check = todo("the office checks it");
  const why = invoiceReason(w);
  if (why) s.invoice = skip(why);
  else s.invoice = invoiced ? done("recorded") : todo(completed ? "not recorded yet" : "after the work");
  if (hideMoney) s.invoice = { ...s.invoice, hidden: true };
  // people who see no prices don't deal with invoices: for them a job is closed once it's checked
  const closed = rejected || (completed && s.check.state !== "todo" && (hideMoney || s.invoice.state !== "todo"));
  s.closed = rejected ? done("rejected") : closed ? done(day(w.checkedAt) || fmtDate(w.completedAt)) : todo("");
  // A stage passed by (the work started or finished without it) counts as skipped — except approval, which stays
  // visible if it was missed.
  const milestone = completed ? "completed" : started ? "inProgress" : null;
  if (milestone) {
    const upto = STAGES.findIndex((x) => x.key === milestone);
    STAGES.slice(0, upto).forEach(({ key }) => { if (s[key].state === "todo" && key !== "approval") s[key] = skip(key === "assigned" ? "not recorded" : "not needed"); });
  }
  // A rejected job stops where it was
  if (rejected) STAGES.forEach(({ key }) => { if (s[key].state === "todo") s[key] = { state: "none", note: "" }; });
  const stages = STAGES.map((x) => ({ ...x, ...s[x.key] }));
  const current = rejected || closed ? null : (stages.find((x) => x.state === "todo" && !x.hidden) || {}).key || null;
  let label;
  if (rejected) label = "Rejected";
  else if (closed) label = "Closed";
  else if (onHold) label = "On hold";
  else label = WAITING[current] || statusLabel(st);
  return { stages, current, closed, rejected, onHold, label };
}

// Short queue tests, used by filters, Home and notifications
export const needsTriage = (w) => !filled(w.triagedAt) && w.status === "requested";
export const needsCheck = (w) => w.status === "completed" && !!w.lc && !filled(w.checkedAt);
export const needsInvoice = (w, invoiced) => w.status === "completed" && !!w.lc && !invoiced && !invoiceReason(w);

// What changed on a job, as plain lines for its timeline (no amounts — the timeline is shown to everyone).
export function lifecycleEvents(before, after, { by = "Unknown", at = new Date().toISOString(), supplierName = () => "" } = {}) {
  const b = before || {}; const a = after || {}; const out = [];
  const add = (text, kind = "stage") => out.push({ at, by, kind, text });
  if (a.status !== b.status && filled(a.status)) {
    if (a.status === "in_progress" && b.status === "completed") add("Reopened — needs more work", "status");
    else add(`${statusLabel(b.status)} → ${statusLabel(a.status)}`, "status");
  }
  if (filled(a.triagedAt) && !filled(b.triagedAt)) add(`Accepted · ${priorityLabel(a.priority)} priority${a.quoteNeeded === false ? " · no quote needed" : a.quoteNeeded === true ? " · quote needed" : ""}`);
  else if ((a.priority || "medium") !== (b.priority || "medium")) add(`Priority: ${priorityLabel(b.priority)} → ${priorityLabel(a.priority)}`);
  if (a.quoteNeeded !== b.quoteNeeded && !(filled(a.triagedAt) && !filled(b.triagedAt))) { if (a.quoteNeeded === false) add("No quote needed"); else if (a.quoteNeeded === true) add("Quote needed"); }
  if (filled(a.quoteRequestedAt) && a.quoteRequestedAt !== b.quoteRequestedAt) add("Quote requested from the supplier");
  if (isQuoted(a) && !isQuoted(b)) add("Quote added");
  else if (Number(a.quoteAmount) > 0 && Number(b.quoteAmount) > 0 && Number(a.quoteAmount) !== Number(b.quoteAmount)) add("Quote changed");
  if ((a.scheduledFor || "") !== (b.scheduledFor || "")) add(a.scheduledFor ? `Booked for ${fmtDate(a.scheduledFor)}` : "Booking removed");
  if ((a.assignee || "") !== (b.assignee || "")) add(a.assignee ? `Assigned to ${a.assignee}` : `${b.assignee} unassigned`, "assign");
  if ((a.supplierId || "") !== (b.supplierId || "")) add(a.supplierId ? `Supplier: ${supplierName(a.supplierId) || "set"}` : "Supplier removed", "assign");
  if (filled(a.checkedAt) && !filled(b.checkedAt)) add(`Quality check passed${a.checkNote ? ` — ${a.checkNote}` : ""}`, "check");
  if (a.invoiceNeeded === false && b.invoiceNeeded !== false) add("No invoice needed");
  if (b.invoiceNeeded === false && a.invoiceNeeded !== false) add("Invoice needed again");
  if ((a.waitingOn || "") !== (b.waitingOn || "") && a.waitingOn) add(`Waiting on ${String(a.waitingOn).toLowerCase()}`);
  return out;
}

// Everything that happened to a job, oldest first: its events, comments and what suppliers and engineers recorded.
export function jobTimeline(w) {
  const items = [];
  const evs = w.events || [];
  const has = (pred) => evs.some(pred);
  items.push({ at: w.loggedAt || (w.dateRaised ? `${w.dateRaised}T09:00:00` : ""), by: w.requestedBy || w.loggedBy || "", kind: "raised", text: w.source === "request" ? "Reported through a QR code or request link" : w.fromCheck ? "Raised from a failed check" : w.source === "checklist" ? "Raised from a failed check at a visit" : "Raised" });
  evs.forEach((e) => items.push({ ...e }));
  (w.comments || []).forEach((c) => items.push({ at: c.at, by: c.by, kind: "comment", text: c.text }));
  if (w.supplierAck?.at) items.push({ at: w.supplierAck.at, by: w.supplierAck.name || "Supplier", kind: "supplier", text: w.supplierAck.declined ? `Supplier declined${w.supplierAck.reason ? `: ${w.supplierAck.reason}` : ""}` : `Supplier accepted${w.supplierAck.date ? ` · attending ${fmtDate(w.supplierAck.date)}` : ""}` });
  if (w.supplierDone?.at) items.push({ at: w.supplierDone.at, by: w.supplierDone.name || "Supplier", kind: "supplier", text: `Supplier marked it done${w.supplierDone.notes ? ` — ${w.supplierDone.notes}` : ""}` });
  if (filled(w.attendedAt) && !has((e) => /attended|started/i.test(e.text))) items.push({ at: String(w.attendedAt).length <= 16 ? `${w.attendedAt}:00` : w.attendedAt, by: "", kind: "stage", text: "Engineer attended" });
  if (!evs.length) {   // older jobs: what we know from their fields
    if (w.status === "completed" && w.completedAt) items.push({ at: `${w.completedAt}T17:00:00`, by: "", kind: "status", text: "Completed" });
    if (w.status === "rejected") items.push({ at: w.loggedAt || "", by: "", kind: "status", text: "Rejected" });
  }
  return items.filter((x) => x.at).sort((x, y) => String(x.at).localeCompare(String(y.at)));
}
