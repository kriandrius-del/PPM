// A job's life on screen (Phase 2): the strip of stages, the next step with its buttons, and the timeline.
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, CircleDot, Hand, MessageSquare, Play, RotateCcw, Send } from "lucide-react";
import { Select, TextInput } from "../../components/ui.jsx";
import { WORK_PRIORITIES } from "../../lib/constants.js";
import { ACTIVE_CAN_APPROVE, ACTIVE_CAN_EDIT, ACTIVE_HIDE_MONEY, ACTIVE_ROLE, ACTIVE_USERS, siteInfoText } from "../../lib/globals.js";
import { maskMoney } from "../../lib/utils.js";
import { INVOICE_ROLES, WAITING, isOffice, jobTimeline } from "./lifecycle.js";

const COLOR = { done: "var(--ok)", current: "var(--accent)", skipped: "transparent", todo: "var(--card-hi)", none: "var(--card-hi)" };
const ICON = { done: "✓", skipped: "↷", todo: "○", none: "–" };
const btn = (primary, tone) => ({ background: primary ? (tone === "ok" ? "var(--ok)" : "var(--accent)") : "var(--card)", color: primary ? "var(--on-accent)" : tone === "danger" ? "var(--danger)" : "var(--accent)", border: primary ? "none" : "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36 });

export function LifecycleStrip({ info }) {
  const [open, setOpen] = useState(false);
  const shown = info.stages.filter((s) => !s.hidden);
  const cur = shown.find((s) => s.key === info.current);
  const passed = shown.filter((s) => s.state === "done" || s.state === "skipped").length;
  const head = info.rejected ? "Rejected — nothing more to do." : info.closed ? "Closed — every stage is done or not needed." : cur ? `${info.onHold ? `On hold — next: ${cur.label.toLowerCase()}` : `Now: ${WAITING[cur.key] || cur.label}`}${cur.note ? ` — ${cur.note}` : ""}` : "";
  return (
    <div data-testid="job-stages" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 3 }} aria-hidden="true">
        {shown.map((s) => {
          const st = s.key === info.current ? "current" : s.state;
          return <span key={s.key} title={`${s.label}: ${st === "current" ? "now" : st}${s.note ? ` — ${s.note}` : ""}`} style={{ flex: 1, height: 7, borderRadius: 4, background: COLOR[st], border: st === "skipped" ? "1px dashed var(--faint)" : st === "todo" || st === "none" ? "1px solid var(--border)" : "none", opacity: st === "none" ? 0.4 : 1 }} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: info.closed ? "var(--ok)" : info.onHold ? "var(--warn)" : "var(--text)" }}>{head}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 3 }}>
          {passed} of {shown.length} stages {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      {open && (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "3px 12px" }}>
          {shown.map((s, i) => {
            const st = s.key === info.current ? "current" : s.state;
            return (
              <li key={s.key} data-stage={s.key} data-state={st} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "baseline", color: st === "done" ? "var(--text)" : st === "current" ? "var(--accent)" : "var(--muted)", fontWeight: st === "current" ? 700 : 500 }}>
                <span style={{ width: 14, flexShrink: 0, color: st === "done" ? "var(--ok)" : "inherit", fontWeight: 700 }}>{st === "current" ? "●" : ICON[st]}</span>
                <span>{i + 1}. {s.label}{s.note ? <span style={{ color: "var(--faint)", fontWeight: 400 }}> · {s.note}</span> : st === "skipped" ? <span style={{ color: "var(--faint)", fontWeight: 400 }}> · not needed</span> : null}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// What happens next, and the button for it — or who does it, when this person can't.
export function JobNext({ work, info, jobName = "", device = null, suppliers = [], me = "", locationName = "", invoiced = false, needsApproval = false, onUpdate, onRaisePO, onInvoice }) {
  const role = ACTIVE_ROLE; const office = isOffice(role); const canEdit = ACTIVE_CAN_EDIT; const HM = ACTIVE_HIDE_MONEY;
  const [priority, setPriority] = useState(work.priority || "medium");
  const [needQuote, setNeedQuote] = useState(work.quoteNeeded === false ? "no" : work.quoteNeeded === true || work.supplierId ? "yes" : work.assignee ? "no" : "yes");
  const [date, setDate] = useState(work.scheduledFor || "");
  const [checkNote, setCheckNote] = useState("");
  const [redo, setRedo] = useState(false);
  const [person, setPerson] = useState(work.assignee || "");
  const today = new Date().toISOString().slice(0, 10);
  const sup = suppliers.find((s) => s.id === work.supplierId);
  if (info.rejected || info.closed) return null;
  const cur = info.current;
  let text = ""; const actions = [];
  const note = (t) => [...(work.comments || []), { text: t, by: me || "Unknown", at: new Date().toISOString() }];
  const A = (key, el) => actions.push(<span key={key}>{el}</span>);
  if (info.onHold) text = `On hold${work.holdReason ? `: ${work.holdReason}` : ""}. Set the status back when it can carry on.`;
  else if (cur === "triage" || cur === "priority") {
    if (office && canEdit) {
      text = "Accept the job: confirm its priority and whether it needs a supplier's quote. Or reject it.";
      A("prio", <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: "auto", padding: "7px 8px", fontSize: 12.5 }}>{WORK_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label} priority</option>)}</Select>);
      A("q", <Select aria-label="Quote" value={needQuote} onChange={(e) => setNeedQuote(e.target.value)} style={{ width: "auto", padding: "7px 8px", fontSize: 12.5 }}><option value="yes">Needs a quote</option><option value="no">No quote needed (in-house or fixed price)</option></Select>);
      A("acc", <button type="button" style={btn(true)} onClick={() => onUpdate({ triagedAt: new Date().toISOString(), triagedBy: me || "Unknown", priority, quoteNeeded: needQuote === "yes", ...(needQuote === "no" && work.status === "requested" ? { status: "approved" } : {}) })}><CheckCircle2 size={14} /> Accept job</button>);
      A("rej", <button type="button" style={btn(false, "danger")} onClick={() => { const why = window.prompt("Why is this job rejected?", ""); if (why !== null) onUpdate({ status: "rejected", comments: note(`Rejected at triage${why ? `: ${why}` : ""}`) }); }}>Reject</button>);
    } else text = "Waiting for the office to accept it and set its priority.";
  } else if (cur === "quoteReq") {
    if (office && canEdit) {
      text = sup ? `Ask ${sup.name} for a quote, or mark it as not needed.` : "Choose the supplier below, then ask them for a quote — or mark the quote as not needed.";
      if (sup) A("ask", <button type="button" style={btn(true)} onClick={() => {
        const body = `Hi${sup.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nPlease could you quote for the following work at ${locationName}:\n\n${jobName}${device?.assetTag ? ` (#${device.assetTag})` : ""}\n${work.description}\nPriority: ${(work.priority || "medium").replace(/^./, (c) => c.toUpperCase())}${device?.accessNotes ? `\nAccess: ${device.accessNotes}` : ""}${siteInfoText() ? `\n${siteInfoText()}` : ""}\n\nThanks,\n${me}`;
        window.location.href = `mailto:${encodeURIComponent(sup.managerEmail || sup.email || "")}?subject=${encodeURIComponent(`Quote request — ${jobName}`)}&body=${encodeURIComponent(body)}`;
        onUpdate({ quoteRequestedAt: today });
      }}><Send size={14} /> Email the quote request</button>);
      A("mark", <button type="button" style={btn(false)} onClick={() => onUpdate({ quoteRequestedAt: today })}>Quote already requested</button>);
      A("noq", <button type="button" style={btn(false)} onClick={() => onUpdate({ quoteNeeded: false, ...(work.status === "requested" ? { status: "approved" } : {}) })}>No quote needed</button>);
    } else text = "The office asks the supplier for a quote.";
  } else if (cur === "quoteIn") {
    text = HM ? "The office adds the quote when it comes in." : canEdit ? "Add the supplier's quote when it comes in: Quote / cost further down, or compare quotes." : "Waiting for the supplier's quote.";
    if (office && canEdit && !HM) A("noq", <button type="button" style={btn(false)} onClick={() => onUpdate({ quoteNeeded: false, ...(work.status === "requested" ? { status: "approved" } : {}) })}>No quote needed</button>);
  } else if (cur === "approval") {
    text = needsApproval ? (ACTIVE_CAN_APPROVE ? "Approve or reject the quote — the buttons are just below." : "Waiting for approval by finance, or by someone an admin allows to approve quotes.") : "Waiting for approval.";
  } else if (cur === "scheduled") {
    if (canEdit) {
      text = "Book a date for the work.";
      A("d", <TextInput type="date" aria-label="Booked for" value={date} min={today} onChange={(e) => setDate(e.target.value)} style={{ width: "auto", padding: "7px 8px", fontSize: 12.5 }} />);
      A("b", <button type="button" disabled={!date} style={{ ...btn(true), opacity: date ? 1 : 0.5 }} onClick={() => date && onUpdate({ scheduledFor: date })}>Book</button>);
    } else text = "Waiting for a date to be booked.";
  } else if (cur === "assigned") {
    if (canEdit && office) {
      text = "Assign it to someone on the team, or to a supplier (Assigned supplier, further down).";
      if (ACTIVE_USERS.length) A("p", <Select aria-label="Assign to" value={person} onChange={(e) => setPerson(e.target.value)} style={{ width: "auto", padding: "7px 8px", fontSize: 12.5 }}><option value="">Choose a person…</option>{ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select>);
      A("a", <button type="button" disabled={!person} style={{ ...btn(true), opacity: person ? 1 : 0.5 }} onClick={() => person && onUpdate({ assignee: person })}>Assign</button>);
    } else if (canEdit && me) text = "Nobody is on it yet — take it if it's yours to do.";
    else text = "Waiting for the office to assign it.";
  } else if (cur === "inProgress") {
    text = "Ready to start.";
    if (canEdit) {
      A("s", <button type="button" style={btn(true)} onClick={() => onUpdate({ status: "in_progress" })}><Play size={14} /> Start work</button>);
      A("c", <button type="button" style={btn(false)} onClick={() => onUpdate({ status: "completed" })}>Mark completed</button>);
    }
  } else if (cur === "completed") {
    text = "Work in progress. Mark it completed when it's finished — the office then checks it.";
    if (canEdit) A("c", <button type="button" style={btn(true, "ok")} onClick={() => onUpdate({ status: "completed" })}><CheckCircle2 size={14} /> Mark completed</button>);
  } else if (cur === "check") {
    if (office && canEdit) {
      text = "Check the work: the photos, notes and any supplier sign-off. Then pass it, or send it back.";
      if (redo) {
        A("why", <TextInput aria-label="What still needs doing" autoFocus placeholder="What still needs doing?" value={checkNote} onChange={(e) => setCheckNote(e.target.value)} style={{ minWidth: 200, flex: 1, padding: "7px 8px", fontSize: 12.5 }} />);
        A("send", <button type="button" disabled={!checkNote.trim()} style={{ ...btn(true), opacity: checkNote.trim() ? 1 : 0.5 }} onClick={() => { if (!checkNote.trim()) return; onUpdate({ status: "in_progress", supplierDone: null, comments: note(`Quality check: needs more work — ${checkNote.trim()}`) }); setRedo(false); setCheckNote(""); }}><RotateCcw size={14} /> Send back</button>);
        A("cx", <button type="button" style={btn(false)} onClick={() => { setRedo(false); setCheckNote(""); }}>Cancel</button>);
      } else {
        A("n", <TextInput aria-label="Check note" placeholder="Note (optional)" value={checkNote} onChange={(e) => setCheckNote(e.target.value)} style={{ minWidth: 160, flex: 1, padding: "7px 8px", fontSize: 12.5 }} />);
        A("pass", <button type="button" style={btn(true, "ok")} onClick={() => { onUpdate({ checkedAt: new Date().toISOString(), checkedBy: me || "Unknown", checkNote: checkNote.trim() || null }); setCheckNote(""); }}><CheckCircle2 size={14} /> Passed</button>);
        A("redo", <button type="button" style={btn(false, "danger")} onClick={() => { setRedo(true); setCheckNote(""); }}><RotateCcw size={14} /> Needs more work</button>);
      }
    } else text = "Finished. The office checks the work next.";
  } else if (cur === "invoice") {
    const may = INVOICE_ROLES.includes(role);
    text = may ? "Record the supplier's invoice against this job, or say none is needed." : "Finished and checked. Finance records the supplier's invoice.";
    if (may && canEdit && onInvoice) A("inv", <button type="button" style={btn(true)} onClick={onInvoice}>Record the invoice</button>);
    if (may && canEdit) A("noi", <button type="button" style={btn(false)} onClick={() => onUpdate({ invoiceNeeded: false })}>No invoice needed</button>);
  }
  // Extras that fit any open stage
  const open = !["completed", "rejected"].includes(work.status);
  // booking and assigning can be skipped: the work can start, or be marked done, straight away
  if (canEdit && open && !info.onHold && ["scheduled", "assigned"].includes(cur)) {
    if (work.status !== "in_progress") A("s2", <button type="button" style={btn(false)} onClick={() => onUpdate({ status: "in_progress" })}><Play size={14} /> Start work</button>);
    A("c2", <button type="button" style={btn(false)} onClick={() => onUpdate({ status: "completed" })}>Mark completed</button>);
  }
  if (open && canEdit && me && !work.assignee && !office && role !== "finance") A("take", <button type="button" style={btn(cur === "assigned")} onClick={() => onUpdate({ assignee: me })}><Hand size={14} /> Take this job</button>);
  const quoted = Number(work.quoteAmount) > 0;
  if (!HM && onRaisePO && canEdit && !work.poNumber && quoted && !needsApproval && open && ["scheduled", "assigned", "inProgress", "completed"].includes(cur)) A("po", <button type="button" style={btn(false)} onClick={onRaisePO}>Raise a PO (optional)</button>);
  if (!text && !actions.length) return null;
  return (
    <div data-testid="job-next" style={{ background: "var(--card-hi)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      {text && <div style={{ fontSize: 12.5 }}><b>Next:</b> {text}</div>}
      {actions.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>{actions}</div>}
      {invoiced && !HM && cur !== "invoice" && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Invoice recorded.</div>}
    </div>
  );
}

// Everything that happened, oldest first, with a box to add an update.
export function JobTimeline({ work, me = "", onUpdate }) {
  const [text, setText] = useState("");
  const items = jobTimeline(work);
  function post() {
    if (!text.trim()) return;
    onUpdate({ comments: [...(work.comments || []), { text: text.trim(), by: me || "Unknown", at: new Date().toISOString() }] });
    setText("");
  }
  const when = (at) => { const d = new Date(at); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined, hour: "2-digit", minute: "2-digit" }); };
  return (
    <div data-testid="job-timeline">
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Timeline ({items.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 8, borderLeft: "2px solid var(--border)", marginLeft: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ position: "relative", padding: "4px 0 8px 14px" }}>
            <span style={{ position: "absolute", left: -6, top: 7, width: 10, height: 10, borderRadius: 5, background: it.kind === "comment" ? "var(--card)" : it.kind === "check" ? "var(--ok)" : it.kind === "supplier" ? "var(--accent)" : "var(--faint)", border: it.kind === "comment" ? "2px solid var(--accent)" : "none" }} />
            {it.kind === "comment"
              ? <div style={{ background: "var(--card-hi)", borderRadius: 8, padding: "7px 10px", fontSize: 13, whiteSpace: "pre-wrap", display: "flex", gap: 6 }}><MessageSquare size={13} style={{ flexShrink: 0, marginTop: 2, color: "var(--muted)" }} /><span>{maskMoney(it.text)}</span></div>
              : <div style={{ fontSize: 12.8, color: "var(--text)", display: "flex", gap: 6, alignItems: "baseline" }}>{it.kind === "check" ? <CheckCircle2 size={13} color="var(--ok)" /> : it.kind === "raised" ? <CircleDot size={12} color="var(--muted)" /> : null}<span>{maskMoney(it.text)}</span></div>}
            <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>{[it.by, when(it.at)].filter(Boolean).join(" · ")}</div>
          </div>
        ))}
      </div>
      {ACTIVE_CAN_EDIT && (
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an update…" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") post(); }} />
          <button type="button" onClick={post} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 9, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Post</button>
        </div>
      )}
    </div>
  );
}

// One line for list cards: where the job is in its life.
export function StageChip({ info }) {
  const tone = info.closed ? ["var(--ok)", "var(--ok-soft)"] : info.rejected ? ["var(--muted)", "var(--card-hi)"] : info.onHold ? ["var(--warn)", "var(--warn-soft)"] : ["var(--accent)", "var(--accent-soft)"];
  return <span data-testid="stage-chip" style={{ fontSize: 11, fontWeight: 700, color: tone[0], background: tone[1], padding: "3px 8px", borderRadius: 20 }}>{info.label}</span>;
}
