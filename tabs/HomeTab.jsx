// Home dashboard: KPIs, reminders, contractor sign-in, emergency contacts, statutory register.
import { useMemo, useState } from "react";
import { Building2, CalendarCheck, CalendarDays, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, Clock, Cloud, CloudOff, Flame, HardHat, ListTodo, LogIn, LogOut, Phone, PhoneCall, Pin, Printer, RefreshCw, Rocket, ScrollText, Square, Sun, UserCheck, X } from "lucide-react";
import { ConfirmDeleteButton, ExportButton, Field, Modal, PrimaryButton, Select, TextArea, TextInput } from "../components/ui.jsx";
import { DEFAULT_EMERGENCY, REPEAT_OPTIONS, STATUTORY_ITEMS } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT } from "../lib/globals.js";
import { openPrintReport, tableHtml } from "../lib/reports.js";
import { computeCompliance, currentBooking, daysUntil, escapeHtml, fmtDate, gbp, matchStatutory, relativeDays, uid, workSla } from "../lib/utils.js";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* ---------------------------------------------------------
   Home dashboard
--------------------------------------------------------- */
export function HomeTab({ weekAhead = null, siteInfo = null, onSaveSiteInfo, customStatutory = [], onSaveCustomStatutory, pinnedDevices = [], onUnpin, todayItems = null, hiddenCards = [], myName, myWorks = [], emergency, onSaveEmergency, pendingCount = 0, setup, onHideSetup, syncInfo, reminders = [], users = [], onAddReminder, onToggleReminder, onDeleteReminder, userName, devices, services, works, visitBudgets, alerts, activity, spend, onGo, onOpenDevice, statutoryNA = [], onStatutoryNA, onAddStatutory, locationName = "", signins = [], suppliers = [], onSignIn, onSignOut }) {
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const comp = useMemo(() => computeCompliance(devices, visitBudgets, services), [devices, visitBudgets, services]);
  const overdue = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; });
  const next7 = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 7; });
  const notBooked = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 14 && !currentBooking(d); });
  const openWorks = works.filter((w) => !["completed", "rejected"].includes(w.status));
  const slaBreached = openWorks.filter((w) => workSla(w)?.breached);
  const spendPct = spend.budget ? Math.round((spend.spent / spend.budget) * 100) : null;
  const upcoming = devices.filter((d) => d.nextServiceDate).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate)).slice(0, 6);
  const yr = new Date().getFullYear();
  const lateByReason = {};
  services.filter((v) => v.lateReason && String(v.date).startsWith(String(yr))).forEach((v) => { lateByReason[v.lateReason] = (lateByReason[v.lateReason] || 0) + 1; });
  const card = { background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 };
  const Kpi = ({ label, value, sub, tone = "muted", onClick }) => {
    const c = { danger: "#C53030", warn: "#B7791F", ok: "#2F855A", muted: "#1B2430" }[tone];
    return (
      <button onClick={onClick} style={{ ...card, textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 650, color: "#8A94A0" }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 750, color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
        {sub && <span style={{ fontSize: 10.5, color: "#8A94A0" }}>{sub}</span>}
      </button>
    );
  };
  const H = ({ children, action, onAction }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#3A4451" }}>{children}</span>
      {action && <button onClick={onAction} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{action}</button>}
    </div>
  );
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 750 }}>{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}{userName ? `, ${userName.split(" ")[0]}` : ""}</div>
        <div style={{ fontSize: 12.5, color: "#8A94A0" }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Kpi label="PPM on time" value={comp.pct === null ? "—" : `${comp.pct}%`} sub={comp.total ? `${comp.totals.onTime} of ${comp.total} planned visits` : "No planned visits due yet"} tone={comp.pct === null ? "muted" : comp.pct >= 90 ? "ok" : comp.pct >= 70 ? "warn" : "danger"} onClick={() => onGo("certificates")} />
        <Kpi label="Overdue" value={overdue.length} sub="services past due" tone={overdue.length ? "danger" : "ok"} onClick={() => onGo("schedule")} />
        <Kpi label="Due next 7 days" value={next7.length} sub={notBooked.length ? `${notBooked.length} due in 14 days not booked` : "all booked"} tone={notBooked.length ? "warn" : "muted"} onClick={() => onGo("devices")} />
        <Kpi label="Open works" value={openWorks.length} sub={slaBreached.length ? `${slaBreached.length} past target date` : "all within target"} tone={slaBreached.length ? "danger" : "muted"} onClick={() => onGo("works")} />
      </div>
      {!hiddenCards.includes("spend") && <button onClick={() => onGo("budget")} style={{ ...card, width: "100%", marginTop: 8, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 650, color: "#8A94A0" }}>
          <span>Spend {spend.yr} to date</span>
          <span>{spendPct === null ? "No annual budget set" : `${spendPct}% of budget`}</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace", margin: "3px 0 6px" }}>
          {gbp(spend.spent)}{spend.budget ? <span style={{ fontSize: 12.5, color: "#8A94A0", fontWeight: 600 }}> / {gbp(spend.budget)}</span> : null}
        </div>
        {spend.budget > 0 && (() => {
          const expected = Math.round(((new Date().getMonth() + new Date().getDate() / 31) / 12) * 100);
          return (
            <>
              <div style={{ position: "relative", height: 8, background: "#E1E4E8", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, spendPct)}%`, height: "100%", background: spendPct > 100 ? "#C53030" : spendPct > expected + 10 ? "#D97706" : "#2F855A" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, expected)}%`, width: 2, background: "#1B2430" }} />
              </div>
              <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 4 }}>Black line = where spend would be if spread evenly across the year ({expected}%).</div>
              {spend.curve && <SpendCurve curve={spend.curve} />}
              {spend.forecast != null && (
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: spend.forecast > spend.budget ? "#C53030" : "#2F855A" }}>
                  Forecast year-end: {gbp(spend.forecast)} ({Math.round((spend.forecast / spend.budget) * 100)}% of budget){spend.forecast > spend.budget ? ` — ${gbp(spend.forecast - spend.budget)} over` : ""}
                </div>
              )}
            </>
          );
        })()}
      </button>}

      {syncInfo && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5B6672", margin: "8px 0 0" }}>
          {pendingCount > 0 ? <CloudOff size={13} color="#B7791F" /> : <Cloud size={13} color="#2F855A" />} Shared database · {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to upload` : syncInfo.syncing ? "syncing…" : syncInfo.lastSync ? `updated ${syncInfo.lastSync.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "connected"}
          <button onClick={syncInfo.onRefresh} title="Refresh now" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><RefreshCw size={12} color="#2B4562" /></button>
        </div>
      )}
      {setup && !setup.hidden && ACTIVE_CAN_EDIT && (() => {
        const steps = [
          ["Add your suppliers", setup.suppliers > 0, "suppliers"], ["Add services (or import a spreadsheet)", setup.devices > 0, "devices"],
          ["Set a budget or plan", setup.budgets > 0, "budget"], ["Log your first visit", setup.visits > 0, "devices"],
          ["Back up, or connect a shared database", setup.backup, null],
        ];
        const done = steps.filter((x) => x[1]).length;
        if (done === steps.length) return null;
        return (
          <div style={{ background: "#EAF1F8", border: "1px solid #C9D9EA", borderRadius: 12, padding: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Rocket size={16} color="#2B4562" />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "#2B4562" }}>Getting started — {done}/{steps.length}</span>
              <button onClick={onHideSetup} title="Hide" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={14} color="#5B6672" /></button>
            </div>
            {steps.map(([label, ok, tab]) => (
              <button key={label} onClick={() => tab && onGo(tab)} disabled={ok} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", background: "none", border: "none", padding: "4px 0", cursor: ok || !tab ? "default" : "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 12.8, color: ok ? "#8A94A0" : "#1B2430", textDecoration: ok ? "line-through" : "none" }}>
                {ok ? <CheckCircle2 size={15} color="#2F855A" /> : <Square size={15} color="#8A94A0" />} {label}
              </button>
            ))}
          </div>
        );
      })()}
      {!hiddenCards.includes("today") && todayItems && <TodayCard items={todayItems} onOpenDevice={onOpenDevice} onGo={onGo} />}
      {!hiddenCards.includes("week") && weekAhead && <WeekAheadCard days={weekAhead} onOpenDevice={onOpenDevice} />}
      {!hiddenCards.includes("pinned") && pinnedDevices.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Pin size={16} color="#D97706" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Pinned</span></div>
          {pinnedDevices.map((d) => { const n = daysUntil(d.nextServiceDate); return (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #EEF0F2", padding: "6px 0" }}>
              <button onClick={() => onOpenDevice(d.id)} style={{ flex: 1, display: "flex", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 12.8 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{d.name}</span>
                <span style={{ color: n !== null && n < 0 ? "#C53030" : "#8A94A0", fontWeight: n !== null && n < 0 ? 700 : 500 }}>{n === null ? "no date" : n < 0 ? `${-n}d overdue` : n === 0 ? "today" : `in ${n}d`}</span>
              </button>
              <button onClick={() => onUnpin(d.id)} title="Unpin" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={13} color="#A3ABB4" /></button>
            </div>
          ); })}
        </div>
      )}
      {!hiddenCards.includes("assigned") && myName && (() => {
        const myDevices = devices.filter((d) => d.assignee === myName && d.nextServiceDate && daysUntil(d.nextServiceDate) <= 14).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate));
        if (!myDevices.length && !myWorks.length) return null;
        return (
          <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><UserCheck size={17} color="#2B6CB0" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Assigned to you</span></div>
            {myDevices.slice(0, 6).map((d) => { const n = daysUntil(d.nextServiceDate); return (
              <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ display: "flex", width: "100%", gap: 8, background: "none", border: "none", borderTop: "1px solid #EEF0F2", padding: "6px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 12.8 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{d.name}</span><span style={{ color: n < 0 ? "#C53030" : "#8A94A0", fontWeight: n < 0 ? 700 : 500 }}>{n < 0 ? `${-n}d overdue` : n === 0 ? "today" : `in ${n}d`}</span>
              </button>
            ); })}
            {myWorks.slice(0, 4).map((w) => (
              <button key={w.id} onClick={() => onGo("works")} style={{ display: "flex", width: "100%", gap: 8, background: "none", border: "none", borderTop: "1px solid #EEF0F2", padding: "6px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 12.8 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{w.description}</span><span style={{ color: workSla(w)?.breached ? "#C53030" : "#8A94A0" }}>{w.status.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        );
      })()}
      {!hiddenCards.includes("siteinfo") && <SiteInfoCard info={siteInfo} onSave={onSaveSiteInfo} />}
      {!hiddenCards.includes("emergency") && <EmergencyContacts contacts={emergency} onSave={onSaveEmergency} />}
      {!hiddenCards.includes("reminders") && <RemindersCard reminders={reminders} users={users} onAdd={onAddReminder} onToggle={onToggleReminder} onDelete={onDeleteReminder} />}
      {!hiddenCards.includes("contractors") && <SiteRegister signins={signins} suppliers={suppliers} devices={devices} locationName={locationName} onSignIn={onSignIn} onSignOut={onSignOut} />}

      {!hiddenCards.includes("attention") && <>
      <H action={alerts.length > 5 ? `All ${alerts.length}` : null} onAction={() => onGo("alerts")}>Needs attention</H>
      {alerts.length === 0 ? (
        <div style={{ ...card, fontSize: 12.5, color: "#2F855A", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} /> All clear — nothing needs attention.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {alerts.slice(0, 5).map((a) => (
            <button key={a.key} onClick={() => onGo(a.tab)} style={{ ...card, padding: "9px 11px", borderLeft: `3px solid ${a.tone === "danger" ? "#C53030" : a.tone === "warn" ? "#D97706" : "#2B4562"}`, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 12.8, fontWeight: 700 }}>{a.title}</div>
              {a.detail && <div style={{ fontSize: 11.3, color: "#8A94A0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</div>}
            </button>
          ))}
        </div>
      )}

      </>}
      {!hiddenCards.includes("upcoming") && <>
      <H action="Schedule" onAction={() => onGo("schedule")}>Coming up</H>
      {upcoming.length === 0 ? <div style={{ ...card, fontSize: 12.5, color: "#8A94A0" }}>Nothing scheduled.</div> : (
        <div style={{ ...card, padding: 0 }}>
          {upcoming.map((d, i) => {
            const n = daysUntil(d.nextServiceDate); const b = currentBooking(d);
            return (
              <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", borderTop: i ? "1px solid #EEF0F2" : "none", padding: "9px 12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 750, color: n < 0 ? "#C53030" : "#1B2430" }}>{new Date(d.nextServiceDate + "T00:00:00").getDate()}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#8A94A0", textTransform: "uppercase" }}>{new Date(d.nextServiceDate + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: n < 0 ? "#C53030" : "#8A94A0" }}>{n < 0 ? `${-n} days overdue` : n === 0 ? "Due today" : `In ${n} day${n === 1 ? "" : "s"}`}{b ? ` · ${b.status === "confirmed" ? "Confirmed" : "Booked"}${b.time ? ` ${b.time}` : ""}` : n >= 0 && n <= 14 ? " · not booked" : ""}</div>
                </div>
                <ChevronRight size={14} color="#A3ABB4" />
              </button>
            );
          })}
        </div>
      )}

      </>}
      {!hiddenCards.includes("statutory") && <StatutoryRegister custom={customStatutory} onSaveCustom={onSaveCustomStatutory} devices={devices} na={statutoryNA} onNA={onStatutoryNA} onAdd={onAddStatutory} onOpenDevice={onOpenDevice} locationName={locationName} />}

      {!hiddenCards.includes("late") && Object.keys(lateByReason).length > 0 && (
        <>
          <H>Late visits in {yr} — why</H>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(lateByReason).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
              <div key={r} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{r}</span><b>{n}</b></div>
            ))}
          </div>
        </>
      )}

      {!hiddenCards.includes("activity") && <>
      <H>Recent activity</H>
      {activity.length === 0 ? <div style={{ ...card, fontSize: 12.5, color: "#8A94A0" }}>No activity yet.</div> : (
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          {activity.slice(0, 5).map((a) => (
            <div key={a.id}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.text}</div>
              <div style={{ fontSize: 10.8, color: "#8A94A0" }}>{a.by} · {relativeDays(a.at)}</div>
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}

/* ---------------------------------------------------------
   Statutory compliance register (UK)
--------------------------------------------------------- */
export function StatutoryRegister({ custom = [], onSaveCustom, devices, na = [], onNA, onAdd, onOpenDevice, locationName }) {
  const [open, setOpen] = useState(false);
  const [addingReq, setAddingReq] = useState(false);
  const rows = [...STATUTORY_ITEMS, ...custom.map((c) => ({ ...c, custom: true, category: "maintenance" }))].map((item) => {
    const matched = devices.filter((d) => matchStatutory(item, d));
    const overdue = matched.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; });
    const status = na.includes(item.key) ? "na" : !matched.length ? "missing" : overdue.length ? "overdue" : "ok";
    return { item, matched, overdue, status };
  });
  const counts = { ok: rows.filter((r) => r.status === "ok").length, overdue: rows.filter((r) => r.status === "overdue").length, missing: rows.filter((r) => r.status === "missing").length };
  const applicable = rows.filter((r) => r.status !== "na").length;
  const tone = { ok: ["#2F855A", "#EAF4EE", "In place"], overdue: ["#C53030", "#FBEAEA", "Overdue"], missing: ["#8A5A0B", "#FDF1E0", "Not set up"], na: ["#8A94A0", "#EEF0F2", "Not applicable"] };
  function print() {
    const e = escapeHtml;
    openPrintReport("Statutory compliance register", locationName, `<div class="kpis"><div class="kpi">In place<b class="ok">${counts.ok}</b></div><div class="kpi">Overdue<b class="bad">${counts.overdue}</b></div><div class="kpi">Not set up<b class="warn">${counts.missing}</b></div></div>
      ${tableHtml(["Requirement", "Frequency", "Status", "Services", "Next due"], rows.map((r) => [
        `<b>${e(r.item.label)}</b>`, e(r.item.freq),
        `<span class="${r.status === "ok" ? "ok" : r.status === "overdue" ? "bad" : r.status === "missing" ? "warn" : "muted"}">${tone[r.status][2]}</span>`,
        e(r.matched.map((d) => d.name).join(", ")),
        r.matched.map((d) => d.nextServiceDate ? fmtDate(d.nextServiceDate) : "—").join(", "),
      ]))}<div class="muted">Matched by service name. Frequencies are typical UK guidance — confirm against your own risk assessments and insurer requirements.</div>`);
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 18 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <ScrollText size={18} color="#2B4562" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Statutory compliance</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>
            {counts.ok} of {applicable} in place{counts.overdue ? ` · ${counts.overdue} overdue` : ""}{counts.missing ? ` · ${counts.missing} not set up` : ""}
          </div>
        </div>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {rows.map((r) => {
            const [fg, bg, label] = tone[r.status];
            return (
              <div key={r.item.key} style={{ background: "#F7F8F9", borderRadius: 9, padding: "8px 10px", opacity: r.status === "na" ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 700 }}>{r.item.label}</div>
                    <div style={{ fontSize: 10.8, color: "#8A94A0" }}>{r.item.freq}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, borderRadius: 10, padding: "2px 8px", flexShrink: 0 }}>{label}</span>
                </div>
                {r.matched.length > 0 && r.status !== "na" && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                    {r.matched.map((d) => (
                      <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 6, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: r.overdue.includes(d) ? "#C53030" : "#2B4562", fontWeight: 600 }}>{d.name}</button>
                    ))}
                  </div>
                )}
                {ACTIVE_CAN_EDIT && (r.status === "missing" || r.status === "na") && (
                  <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                    {r.status === "missing" && <button onClick={() => onAdd(r.item)} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Set up this service</button>}
                    <button onClick={() => onNA(r.status === "na" ? na.filter((k) => k !== r.item.key) : [...na, r.item.key])} style={{ background: "none", border: "none", padding: 0, color: "#8A94A0", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{r.status === "na" ? "Mark as applicable" : "Not applicable here"}</button>
                  </div>
                )}
              </div>
            );
          })}
          {ACTIVE_CAN_EDIT && onSaveCustom && (addingReq ? (
            <CustomRequirementForm onCancel={() => setAddingReq(false)} onSave={(item) => { onSaveCustom([...custom, item]); setAddingReq(false); }} />
          ) : (
            <button onClick={() => setAddingReq(true)} style={{ background: "none", border: "1px dashed #C7D0DA", borderRadius: 9, padding: 8, fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>+ Add your own requirement</button>
          ))}
          {custom.length > 0 && ACTIVE_CAN_EDIT && onSaveCustom && <div style={{ fontSize: 11, color: "#8A94A0" }}>Your requirements: {custom.map((c) => <span key={c.key}>{c.label} <button onClick={() => onSaveCustom(custom.filter((x) => x.key !== c.key))} style={{ background: "none", border: "none", color: "#9B2C2C", cursor: "pointer", fontSize: 11, padding: 0 }}>(remove)</button> </span>)}</div>}
          <button onClick={print} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print register</button>
          <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Services are matched by name (e.g. "Emergency lighting test"). Frequencies are typical UK guidance — always follow your own risk assessments.</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Contractor sign-in register
--------------------------------------------------------- */
export function SiteRegister({ signins, suppliers, devices, locationName, onSignIn, onSignOut }) {
  const [adding, setAdding] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const onSite = signins.filter((x) => !x.outAt);
  const time = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  function rollCall() {
    const e = escapeHtml;
    const box = `<span style="display:inline-block;width:14px;height:14px;border:1.5px solid #1B2430;border-radius:3px"></span>`;
    openPrintReport("Fire roll call — contractors on site", `${locationName} · ${new Date().toLocaleString("en-GB")}`,
      `<div class="kpis"><div class="kpi">On site now<b>${onSite.length}</b></div></div>${tableHtml(["Accounted for", "Name", "Company", "Working on", "Signed in", "Phone"], onSite.map((x) => [box, `<b>${e(x.name)}</b>`, e(x.company || ""), e(x.purpose || ""), time(x.inAt), e(x.phone || "")]))}`);
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <HardHat size={18} color="#D97706" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Contractors on site: {onSite.length}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Sign-in register and fire roll call</div>
        </div>
        {ACTIVE_CAN_EDIT && <button onClick={() => setAdding(true)} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><LogIn size={13} /> Sign in</button>}
      </div>
      {onSite.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {onSite.map((x) => (
            <div key={x.id} style={{ background: "#F7F8F9", borderRadius: 9, padding: "7px 9px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.8, fontWeight: 700 }}>{x.name}{x.company ? <span style={{ color: "#8A94A0", fontWeight: 600 }}> · {x.company}</span> : null}</div>
                <div style={{ fontSize: 11, color: "#8A94A0" }}>In {time(x.inAt)}{x.purpose ? ` · ${x.purpose}` : ""}{x.ramsChecked ? " · RAMS ✓" : ""}{x.inducted ? " · inducted ✓" : <b style={{ color: "#C53030" }}> · no induction</b>}{x.badge ? ` · pass ${x.badge}` : ""}</div>
              </div>
              {ACTIVE_CAN_EDIT && <button onClick={() => onSignOut(x.id)} style={{ background: "#fff", border: "1px solid #D7DCE1", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><LogOut size={12} /> Out</button>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {onSite.length > 0 && <button onClick={rollCall} style={{ background: "none", border: "none", padding: 0, color: "#C53030", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Print fire roll call</button>}
        {signins.length > 0 && <button onClick={() => setShowLog(true)} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Full register ({signins.length})</button>}
      </div>
      {adding && <SignInModal signins={signins} suppliers={suppliers} devices={devices} onClose={() => setAdding(false)} onSave={(e) => { onSignIn(e); setAdding(false); }} />}
      {showLog && (
        <Modal title="Contractor register" onClose={() => setShowLog(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ alignSelf: "flex-end" }}>
              <ExportButton filename="contractor-register.csv" rows={[["Date", "Name", "Company", "Phone", "Working on", "RAMS checked", "Pass", "In", "Out", "Signed in by"], ...signins.map((x) => [fmtDate(x.inAt.slice(0, 10)), x.name, x.company || "", x.phone || "", x.purpose || "", x.ramsChecked ? "Yes" : "No", x.badge || "", time(x.inAt), x.outAt ? time(x.outAt) : "On site", x.by || ""])]} />
            </div>
            {signins.slice(0, 100).map((x) => (
              <div key={x.id} style={{ background: "#F7F8F9", borderRadius: 9, padding: "7px 9px" }}>
                <div style={{ fontSize: 12.8, fontWeight: 700 }}>{x.name}{x.company ? ` · ${x.company}` : ""}</div>
                <div style={{ fontSize: 11, color: "#8A94A0" }}>{fmtDate(x.inAt.slice(0, 10))} · {time(x.inAt)}–{x.outAt ? time(x.outAt) : "on site"}{x.purpose ? ` · ${x.purpose}` : ""}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function SignInModal({ signins = [], suppliers, devices, onClose, onSave }) {
  const [supplierId, setSupplierId] = useState("");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [ramsChecked, setRamsChecked] = useState(false);
  const [inducted, setInducted] = useState(false);
  const priorInduction = signins.filter((x) => x.inducted && x.name.trim().toLowerCase() === name.trim().toLowerCase() && name.trim()).sort((a, b) => String(b.inAt).localeCompare(String(a.inAt)))[0];
  const inductionValid = priorInduction && (Date.now() - new Date(priorInduction.inductedAt || priorInduction.inAt).getTime()) < 365 * 86400000;
  const [badge, setBadge] = useState("");
  const listId = useMemo(() => `purpose-${uid()}`, []);
  return (
    <Modal title="Sign in a contractor" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Company">
          <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setCompany(suppliers.find((s) => s.id === e.target.value)?.name || ""); }}>
            <option value="">— Other / not a listed supplier —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {!supplierId && <Field label="Company name"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. ABC Electrical" /></Field>}
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
          <Field label="Mobile"><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" /></Field>
        </div>
        <Field label="Working on">
          <TextInput list={listId} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. AHU 3 service" />
          <datalist id={listId}>{devices.map((d) => <option key={d.id} value={d.name} />)}</datalist>
        </Field>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <Field label="Visitor pass no. (optional)"><TextInput value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="e.g. 14" /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4451", cursor: "pointer", paddingBottom: 10 }}>
            <input type="checkbox" checked={ramsChecked} onChange={(e) => setRamsChecked(e.target.checked)} style={{ margin: 0 }} /> RAMS checked
          </label>
        </div>
        {inductionValid ? (
          <div style={{ fontSize: 12, color: "#2F6B4A", fontWeight: 650 }}>✓ Site induction done {fmtDate(String(priorInduction.inductedAt || priorInduction.inAt).slice(0, 10))} — valid for a year</div>
        ) : (
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: name.trim() && !inducted ? "#9B2C2C" : "#3A4451", cursor: "pointer", background: "#FDF1E0", borderRadius: 8, padding: "8px 10px" }}>
            <input type="checkbox" checked={inducted} onChange={(e) => setInducted(e.target.checked)} style={{ margin: 0 }} /> Site induction given (fire exits, assembly point, first aid, sign-out)
          </label>
        )}
        <PrimaryButton onClick={() => name.trim() && onSave({ name: name.trim(), company: company.trim(), supplierId: supplierId || null, phone: phone.trim(), purpose: purpose.trim(), ramsChecked, badge: badge.trim(), inducted: inducted || !!inductionValid, inductedAt: inducted ? new Date().toISOString() : inductionValid ? (priorInduction.inductedAt || priorInduction.inAt) : null })}><LogIn size={15} /> Sign in</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Reminders / to-do on Home
--------------------------------------------------------- */
export function RemindersCard({ reminders, users, onAdd, onToggle, onDelete }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [showDone, setShowDone] = useState(false);
  const open = reminders.filter((r) => !r.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const done = reminders.filter((r) => r.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  function add() { if (!text.trim()) return; onAdd({ text: text.trim(), due: due || (repeat !== "none" ? new Date().toISOString().slice(0, 10) : null), assignee: assignee || null, repeat }); setText(""); setDue(""); setAssignee(""); setRepeat("none"); }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <ListTodo size={18} color="#2B4562" />
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Reminders{open.length ? ` (${open.length})` : ""}</div>
      </div>
      {ACTIVE_CAN_EDIT && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: open.length ? 8 : 0 }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="e.g. Chase insurer about roof leak claim" />
          {text.trim() && (
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ flex: 1 }} />
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ flex: 1 }}>
                <option value="">For anyone</option>
                {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </Select>
            </div>
          )}
          {text.trim() && (
            <div style={{ display: "flex", gap: 6 }}>
              <Select value={repeat} onChange={(e) => setRepeat(e.target.value)} style={{ flex: 1 }}>
                {Object.entries(REPEAT_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <button onClick={add} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          )}
        </div>
      )}
      {open.map((r) => {
        const n = r.due ? daysUntil(r.due) : null;
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderTop: "1px solid #EEF0F2" }}>
            <button onClick={() => ACTIVE_CAN_EDIT && onToggle(r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", marginTop: 1 }}><Square size={17} color="#8A94A0" /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.8, fontWeight: 600 }}>{r.text}</div>
              <div style={{ fontSize: 10.8, color: n !== null && n < 0 ? "#C53030" : n === 0 ? "#B7791F" : "#8A94A0", fontWeight: n !== null && n <= 0 ? 700 : 500 }}>
                {r.due ? (n < 0 ? `Overdue — ${fmtDate(r.due)}` : n === 0 ? "Today" : `Due ${fmtDate(r.due)}`) : "No date"}{r.assignee ? ` · ${r.assignee}` : ""}{r.repeat && r.repeat !== "none" ? ` · repeats ${REPEAT_OPTIONS[r.repeat].toLowerCase()}` : ""}
              </div>
            </div>
            <ConfirmDeleteButton onConfirm={() => onDelete(r.id)} size={12} />
          </div>
        );
      })}
      {done.length > 0 && <button onClick={() => setShowDone((v) => !v)} style={{ background: "none", border: "none", color: "#8A94A0", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>{showDone ? "Hide" : "Show"} {done.length} done</button>}
      {showDone && done.slice(0, 20).map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", opacity: 0.65 }}>
          <button onClick={() => ACTIVE_CAN_EDIT && onToggle(r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}><CheckSquare size={17} color="#2F855A" /></button>
          <span style={{ flex: 1, fontSize: 12.5, textDecoration: "line-through" }}>{r.text}</span>
          <span style={{ fontSize: 10.5, color: "#8A94A0" }}>{r.doneBy}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   Emergency contacts on Home
--------------------------------------------------------- */
export function EmergencyContacts({ contacts, onSave }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const list = contacts || DEFAULT_EMERGENCY;
  const [draft, setDraft] = useState(list);
  const filled = list.filter((c) => c.phone);
  function print() {
    openPrintReport("Emergency contacts", "Keep by reception, in the plant room and with key holders", tableHtml(["Who", "Name", "Phone", "Notes"], list.filter((c) => c.phone).map((c) => [`<b>${escapeHtml(c.label)}</b>`, escapeHtml(c.name || ""), `<b style="font-size:15px">${escapeHtml(c.phone)}</b>`, escapeHtml(c.notes || "")])));
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <PhoneCall size={17} color="#C53030" />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Emergency contacts <span style={{ color: "#8A94A0", fontWeight: 600, fontSize: 12 }}>({filled.length})</span></span>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && !editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {filled.map((c, i) => (
            <a key={i} href={`tel:${c.phone.replace(/[^+0-9]/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F8F9", borderRadius: 8, padding: "8px 10px", textDecoration: "none", color: "#1B2430" }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.8, fontWeight: 650 }}>{c.label}</div>{(c.name || c.notes) && <div style={{ fontSize: 11, color: "#8A94A0" }}>{[c.name, c.notes].filter(Boolean).join(" · ")}</div>}</div>
              <b style={{ fontSize: 13, color: "#2F855A", display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} /> {c.phone}</b>
            </a>
          ))}
          {filled.length === 0 && <div style={{ fontSize: 12, color: "#8A94A0" }}>Add your site's numbers so anyone can call in one tap.</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {ACTIVE_CAN_EDIT && <button onClick={() => { setDraft(list); setEditing(true); }} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>}
            {filled.length > 0 && <button onClick={print} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Print</button>}
          </div>
        </div>
      )}
      {open && editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {draft.map((c, i) => (
            <div key={i} style={{ background: "#F7F8F9", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={c.label} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ flex: 1, fontWeight: 650, fontSize: 12.5 }} />
                <button onClick={() => setDraft((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={c.name || ""} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name / company" style={{ flex: 1, fontSize: 12.5 }} />
                <TextInput type="tel" value={c.phone || ""} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} placeholder="Phone" style={{ flex: 1, fontSize: 12.5 }} />
              </div>
              <TextInput value={c.notes || ""} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} placeholder="Notes (account no., contract ref…)" style={{ fontSize: 12 }} />
            </div>
          ))}
          <button onClick={() => setDraft((p) => [...p, { label: "New contact", phone: "" }])} style={{ background: "none", border: "1px dashed #C7D0DA", borderRadius: 8, padding: 7, fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>+ Add contact</button>
          <PrimaryButton onClick={() => { onSave(draft.filter((c) => c.label.trim())); setEditing(false); }}><CheckCircle2 size={15} /> Save contacts</PrimaryButton>
        </div>
      )}
    </div>
  );
}

// What's happening on site today: booked visits, open permits, contractors expected, reminders due.
export function TodayCard({ items, onOpenDevice, onGo }) {
  const { bookings = [], permits = [], reminders = [], dueToday = [] } = items;
  const total = bookings.length + permits.length + reminders.length + dueToday.length;
  const row = (key, icon, main, sub, onClick) => (
    <button key={key} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", borderTop: "1px solid #EEF0F2", padding: "6px 0", cursor: onClick ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
      {icon}<div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.8, fontWeight: 600 }}>{main}</div>{sub && <div style={{ fontSize: 11, color: "#8A94A0" }}>{sub}</div>}</div>
    </button>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Sun size={17} color="#D97706" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Today{total ? ` (${total})` : ""}</span></div>
      {total === 0 && <div style={{ fontSize: 12, color: "#8A94A0" }}>Nothing booked or due today.</div>}
      {[...bookings].sort((a, b) => String(a.time || "99").localeCompare(String(b.time || "99"))).map((d) => row(`b-${d.id}`, <CalendarCheck size={14} color="#2B6CB0" />, `${d.booking.time ? `${d.booking.time} · ` : ""}${d.name}`, `${d.supplierName || "Supplier"} ${d.booking.status === "confirmed" ? "confirmed" : "booked"}${d.booking.ref ? ` · ref ${d.booking.ref}` : ""}${d.accessNotes ? ` · ${d.accessNotes}` : ""}`, () => onOpenDevice(d.id)))}
      {dueToday.map((d) => row(`d-${d.id}`, <Clock size={14} color="#B7791F" />, d.name, "Due today — not booked", () => onOpenDevice(d.id)))}
      {permits.map((p) => row(`p-${p.id}`, <Flame size={14} color="#C53030" />, `${p.ref} · ${p.type}`, `${p.contractor || ""} · until ${new Date(p.validTo).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`, () => onGo("meters")))}
      {reminders.map((r) => row(`r-${r.id}`, <ListTodo size={14} color="#2B4562" />, r.text, r.assignee ? `for ${r.assignee}` : "reminder"))}
    </div>
  );
}

// Cumulative spend against the plan (and the budget spread evenly), month by month.
export function SpendCurve({ curve }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6 }}>
      <span role="button" onClick={() => setOpen((v) => !v)} style={{ fontSize: 11.5, fontWeight: 650, color: "#2B4562", cursor: "pointer" }}>{open ? "Hide" : "Show"} spend curve</span>
      {open && (
        <div style={{ height: 160, marginTop: 6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 5, right: 6, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip formatter={(v) => gbp(v)} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              <Line type="monotone" dataKey="plan" name="Plan" stroke="#8A94A0" strokeDasharray="4 3" dot={false} />
              {curve.some((c) => c.budget) && <Line type="monotone" dataKey="budget" name="Budget" stroke="#2B6CB0" strokeOpacity={0.5} dot={false} />}
              <Line type="monotone" dataKey="actual" name="Actual" stroke="#D97706" strokeWidth={2.5} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CustomRequirementForm({ onSave, onCancel }) {
  const [label, setLabel] = useState(""); const [freq, setFreq] = useState(""); const [kw, setKw] = useState(""); const [months, setMonths] = useState("12");
  return (
    <div style={{ background: "#F7F8F9", borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
      <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Requirement, e.g. Dry riser test" />
      <div style={{ display: "flex", gap: 6 }}>
        <TextInput value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="Frequency text, e.g. 6-monthly" style={{ flex: 1 }} />
        <TextInput type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="months" style={{ width: 70 }} />
      </div>
      <TextInput value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Words to match service names, comma separated (e.g. dry riser, riser)" />
      <div style={{ display: "flex", gap: 6 }}>
        <PrimaryButton onClick={() => label.trim() && onSave({ key: `c_${uid()}`, label: label.trim(), freq: freq.trim() || `Every ${months} months`, months: Number(months) || 12, keywords: (kw || label).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) })} style={{ flex: 1 }}>Add</PrimaryButton>
        <button onClick={onCancel} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </div>
  );
}
export function SiteInfoCard({ info, onSave }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState(false);
  const [d, setD] = useState(info || {});
  const fields = [["address", "Address"], ["hours", "Opening hours"], ["access", "Contractor access"], ["parking", "Parking"], ["contactName", "Site contact"], ["contactPhone", "Contact phone"], ["notes", "Other notes"]];
  const filled = fields.filter(([k]) => (info || {})[k]);
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <Building2 size={17} color="#2B4562" />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Site information {!filled.length && <span style={{ fontSize: 11.5, color: "#B7791F", fontWeight: 600 }}>— not filled in</span>}</span>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && !editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {filled.map(([k, l]) => <div key={k} style={{ fontSize: 12.5 }}><span style={{ color: "#8A94A0", fontWeight: 600 }}>{l}: </span>{k === "contactPhone" ? <a href={`tel:${String(info[k]).replace(/[^+0-9]/g, "")}`}>{info[k]}</a> : info[k]}</div>)}
          {!filled.length && <div style={{ fontSize: 12, color: "#8A94A0" }}>Add the address, hours, access arrangements and site contact. They're added to work orders and booking emails automatically.</div>}
          {ACTIVE_CAN_EDIT && <button onClick={() => { setD(info || {}); setEditing(true); }} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>Edit</button>}
        </div>
      )}
      {open && editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {fields.map(([k, l]) => <Field key={k} label={l}>{k === "address" || k === "access" || k === "notes" ? <TextArea value={d[k] || ""} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} style={{ minHeight: 50 }} /> : <TextInput value={d[k] || ""} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} />}</Field>)}
          <PrimaryButton onClick={() => { onSave(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v || "").trim()]))); setEditing(false); }}><CheckCircle2 size={15} /> Save</PrimaryButton>
        </div>
      )}
    </div>
  );
}
export function WeekAheadCard({ days, onOpenDevice }) {
  const total = days.reduce((t, d) => t + d.items.length, 0);
  const color = { booked: "#2B6CB0", due: "#B7791F", task: "#5B6672", reminder: "#2F855A" };
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><CalendarDays size={17} color="#2B4562" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Week ahead{total ? ` (${total})` : ""}</span></div>
      {days.map(({ day, items }, i) => (
        <div key={day} style={{ display: "flex", gap: 8, borderTop: "1px solid #EEF0F2", padding: "5px 0", opacity: items.length ? 1 : 0.55 }}>
          <div style={{ width: 52, flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: i === 0 ? "#D97706" : "#3A4451" }}>{i === 0 ? "Today" : new Date(day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {items.length === 0 && <span style={{ fontSize: 11.5, color: "#A3ABB4" }}>—</span>}
            {items.map((it) => (
              <button key={it.k} onClick={() => it.id && onOpenDevice(it.id)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: it.id ? "pointer" : "default", fontFamily: "inherit", fontSize: 12, display: "flex", gap: 5, alignItems: "baseline" }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: color[it.kind], flexShrink: 0, marginTop: 4 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.time ? `${it.time} · ` : ""}{it.text}{it.kind === "due" ? " (not booked)" : ""}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
