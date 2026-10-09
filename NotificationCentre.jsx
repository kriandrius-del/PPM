// Notification centre: everything that needs attention, sorted into Critical, Action required, Reminder and
// Information. Each can be opened, snoozed, or marked done (hidden until it changes); opening the centre marks them read.
import { useEffect, useState } from "react";
import { BellOff, Check, CheckCircle2, Mail } from "lucide-react";
import { Modal } from "../../components/ui.jsx";
import { Btn, Empty, Pill, Segmented } from "../../components/ds.jsx";
import { alertGroup } from "../../lib/constants.js";
import { fmtDate } from "../../lib/utils.js";

export const NOTIF_KINDS = {
  critical: { label: "Critical", tone: "danger" },
  action: { label: "Action required", tone: "warn" },
  reminder: { label: "Reminder", tone: "info" },
  info: { label: "Information", tone: "muted" },
};
export function notifKind(a) {
  if (alertGroup(a.key) === "reminders") return "reminder";
  return a.tone === "danger" ? "critical" : a.tone === "warn" ? "action" : "info";
}
// fingerprint: a "done" or "read" mark only lasts while the notification still says the same thing
export const notifPrint = (a) => `${a.key}|${a.title}`;

export function NotificationCentre({ onSnoozeAll, alerts, state = {}, onState, onGo, onSnooze, snoozedCount = 0, onClearSnoozes, locationName = "", senderName = "", onClose }) {
  const [tab, setTab] = useState("all");
  const done = state.done || {}; const seen = state.seen || {};
  const live = alerts.filter((a) => done[a.key] !== notifPrint(a));
  const doneList = alerts.filter((a) => done[a.key] === notifPrint(a));
  const counts = Object.fromEntries(Object.keys(NOTIF_KINDS).map((k) => [k, live.filter((a) => notifKind(a) === k).length]));
  const list = tab === "done" ? doneList : live.filter((a) => tab === "all" || notifKind(a) === tab);
  // everything on screen now counts as read
  useEffect(() => {
    const nextSeen = { ...seen }; let changed = false;
    alerts.forEach((a) => { if (nextSeen[a.key] !== notifPrint(a)) { nextSeen[a.key] = notifPrint(a); changed = true; } });
    if (changed) onState({ ...state, seen: nextSeen });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const markDone = (a) => onState({ ...state, done: { ...done, [a.key]: notifPrint(a) } });
  const undo = (a) => { const d = { ...done }; delete d[a.key]; onState({ ...state, done: d }); };
  function emailSummary() {
    const lines = live.map((a) => `- [${NOTIF_KINDS[notifKind(a)].label}] ${a.title}${a.detail ? ` (${a.detail})` : ""}`);
    const subject = `Site status — ${locationName} — ${fmtDate(new Date().toISOString().slice(0, 10))}`;
    const body = `Hi,\n\nHere's what needs attention at ${locationName}:\n\n${lines.join("\n") || "Nothing needs attention."}\n\nKind regards,\n${senderName}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return (
    <Modal title={`Notifications (${live.length})`} onClose={onClose} width={600}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ overflowX: "auto" }}>
          <Segmented value={tab} onChange={setTab} options={[["all", `All (${live.length})`], ...Object.entries(NOTIF_KINDS).filter(([k]) => counts[k]).map(([k, v]) => [k, `${v.label} (${counts[k]})`]), ...(doneList.length ? [["done", `Done (${doneList.length})`]] : [])]} />
        </div>
        {!list.length && <Empty icon={CheckCircle2} title={tab === "done" ? "Nothing marked done" : "All clear"} body={tab === "done" ? "" : "Nothing needs attention right now."} />}
        {list.map((a) => { const k = notifKind(a); const unread = seen[a.key] !== notifPrint(a); return (
          <div key={a.key} className="fm-row" style={{ alignItems: "flex-start", background: "var(--card-hi)", borderLeft: `3px solid var(--${NOTIF_KINDS[k].tone === "danger" ? "danger" : NOTIF_KINDS[k].tone === "warn" ? "warn" : NOTIF_KINDS[k].tone === "info" ? "accent" : "faint"})` }} data-notif={a.key}>
            <button onClick={() => onGo(a.tab, a)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "var(--text)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {unread && <span className="fm-dot" style={{ background: "var(--accent)" }} title="New" />}
                <span style={{ fontSize: 13.3, fontWeight: 700 }}>{a.title}</span>
              </div>
              {a.detail && <div className="fm-row-sub" style={{ whiteSpace: "normal" }}>{a.detail}</div>}
              <div style={{ marginTop: 4 }}><Pill tone={NOTIF_KINDS[k].tone}>{NOTIF_KINDS[k].label}</Pill></div>
            </button>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {tab === "done" ? <Btn size="sm" onClick={() => undo(a)}>Undo</Btn> : <>
                {onSnooze && k !== "critical" && <button className="fm-icon-btn" style={{ width: 34, height: 34 }} onClick={() => onSnooze(a.key, 7)} title="Snooze for 7 days" aria-label={`Snooze: ${a.title}`}><BellOff size={14} /></button>}
                <button className="fm-icon-btn" style={{ width: 34, height: 34 }} onClick={() => markDone(a)} title="Mark done — hide until it changes" aria-label={`Mark done: ${a.title}`}><Check size={14} /></button>
              </>}
            </div>
          </div>
        ); })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {live.length > 0 && <Btn icon={Mail} onClick={emailSummary}>Email this summary</Btn>}
          {onSnoozeAll && live.filter((a) => notifKind(a) !== "critical").length > 2 && <Btn variant="ghost" onClick={() => { onSnoozeAll(live.filter((a) => notifKind(a) !== "critical").map((a) => a.key)); onClose(); }}>Snooze all non-critical until tomorrow</Btn>}
          {snoozedCount > 0 && <Btn variant="ghost" onClick={onClearSnoozes}>{snoozedCount} snoozed — show again</Btn>}
        </div>
        <div className="fm-sub" style={{ fontSize: 11 }}>Critical items can't be snoozed. “Done” hides an item until it changes (for example, when it becomes more overdue).</div>
      </div>
    </Modal>
  );
}
