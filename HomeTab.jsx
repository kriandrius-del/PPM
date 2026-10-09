// Home dashboard: KPIs, reminders, contractor sign-in, emergency contacts, statutory register.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, ArrowUpRight, Building2, CalendarCheck, CalendarClock, CalendarDays, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, CloudSun, Contact, Flame, HardHat, History, Inbox, ListTodo, LogIn, LogOut, Mail, Megaphone, Monitor, Pencil, Phone, PhoneCall, Pin, Plus, PoundSterling, Printer, RefreshCw, Rocket, ScrollText, Siren, Square, StickyNote, Sun, UserCheck, UserPlus, Wallet, Wrench, X } from "lucide-react";
import { ConfirmDeleteButton, ExportButton, Field, Modal, PrimaryButton, Select, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { DEFAULT_EMERGENCY, REPEAT_OPTIONS, STATUTORY_ITEMS } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT } from "../lib/globals.js";
import { openPrintReport, tableHtml } from "../lib/reports.js";
import { appBaseUrl, orgParam, cachedWeather, computeCompliance, currentBooking, daysUntil, escapeHtml, fmtDate, gbp, matchStatutory, qrImageUrl, relativeDays, searchPlaces, uid, workSla } from "../lib/utils.js";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OnCallCard, printBadge } from "./MoreViews.jsx";

/* ---------------------------------------------------------
   Home dashboard
--------------------------------------------------------- */
export function HomeTab({ monthBudget = null, onSnoozeReminder, waitingOnMe = [], doneToday = null, handover = [], onAddHandover, onTodaySheet, recentServices = [], onOpenService, expected = [], onAddExpected, onRemoveExpected, onArriveExpected, notesKey = "", onEmergencySheet, upcomingKeyDates = [], onTvMode, submissionsCount = 0, onReviewSubmissions, onRollCall, onPeopleDirectory, myActions = [], myReminders = [], weatherSource = null, site = null, onEditSite, complianceMonthAgo = null, onCall = [], onSaveOnCall, onPrintBriefing, onWeeklyEmail, locationId = null, expectedToday = [], onSignOutAll, notices = [], onSaveNotice, onDeleteNotice, recentDevices = [], overdueBySupplier = [], onQuick, weekAhead = null, siteInfo = null, onSaveSiteInfo, customStatutory = [], onSaveCustomStatutory, pinnedDevices = [], onUnpin, todayItems = null, hiddenCards = [], myName, myWorks = [], emergency, onSaveEmergency, pendingCount = 0, setup, onHideSetup, syncInfo, reminders = [], users = [], onAddReminder, onToggleReminder, onDeleteReminder, userName, devices, services, works, visitBudgets, alerts, activity, spend, onGo, onOpenDevice, statutoryNA = [], onStatutoryNA, onAddStatutory, locationName = "", signins = [], suppliers = [], onSignIn, onSignOut }) {
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
  const greeting = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}${userName ? `, ${userName.split(" ")[0]}` : ""}`;
  const toneVar = (t) => (t === "danger" ? "var(--danger)" : t === "warn" ? "var(--warn)" : "var(--accent)");
  const toneSoft = (t) => (t === "danger" ? "var(--danger-soft)" : t === "warn" ? "var(--warn-soft)" : "var(--accent-soft)");
  const Label = ({ icon: I, children, right }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div className="blabel">{I && <I size={14} />}<span>{children}</span></div>
      {right}
    </div>
  );
  const linkBtn = { background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" };
  const BigKpi = ({ label, icon, value, sub, color, onClick, bar }) => (
    <button className="bcard c1" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <Label icon={icon}>{label}</Label>
      <div className="bbig" style={{ color }}>{value}</div>
      {sub && <div className="bsub">{sub}</div>}
      {bar != null && <div style={{ height: 6, borderRadius: 3, background: "var(--card-hi)", overflow: "hidden", marginTop: "auto" }}><div style={{ width: `${Math.max(0, Math.min(100, bar))}%`, height: "100%", background: color }} /></div>}
    </button>
  );
  // Small chart of cumulative spend against plan for the spend tile.
  const spark = (() => {
    const c = spend.curve || []; if (!c.length) return null;
    const W = 520, Hh = 80; const max = Math.max(1, ...c.map((x) => Math.max(x.plan || 0, x.actual || 0, x.budget || 0)));
    const X = (i) => Math.round((i / (c.length - 1)) * W); const Y = (v) => Math.round(Hh - (v / max) * (Hh - 4));
    const line = (key) => c.map((x, i) => (x[key] == null ? null : `${X(i)} ${Y(x[key])}`)).filter(Boolean);
    const act = line("actual"); const plan = line("plan");
    if (!plan.length) return null;
    const lastI = c.reduce((m, x, i) => (x.actual != null ? i : m), -1);
    return (
      <svg width="100%" height={Hh} viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" aria-label="Cumulative spend against plan" style={{ display: "block" }}>
        {act.length > 1 && <path d={`M ${act.join(" L ")} L ${X(lastI)} ${Hh} L 0 ${Hh} Z`} fill="var(--chart-fill)" />}
        <path d={`M ${plan.join(" L ")}`} fill="none" stroke="var(--chart-plan)" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        {act.length > 1 && <path className="glow" d={`M ${act.join(" L ")}`} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
      </svg>
    );
  })();
  const myDevices = myName ? devices.filter((d) => d.assignee === myName && d.nextServiceDate && daysUntil(d.nextServiceDate) <= 14).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate)) : [];
  const show = (k) => !hiddenCards.includes(k);
  const setupSteps = setup ? [
    ["Add your suppliers", setup.suppliers > 0, "suppliers"], ["Add services (or import a spreadsheet)", setup.devices > 0, "devices"],
    ["Set a budget or plan", setup.budgets > 0, "budget"], ["Log your first visit", setup.visits > 0, "devices"],
    ["Back up, or connect a shared database", setup.backup, null],
  ] : [];
  const setupDone = setupSteps.filter((x) => x[1]).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{greeting}</h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        {syncInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            {pendingCount > 0 ? <CloudOff size={13} color="var(--warn)" /> : <Cloud size={13} color="var(--ok)" />} {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to upload` : syncInfo.syncing ? "Syncing…" : syncInfo.lastSync ? `Shared · updated ${syncInfo.lastSync.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Shared database"}
            <button onClick={syncInfo.onRefresh} title="Refresh now" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><RefreshCw size={12} color="var(--accent)" /></button>
          </div>
        )}
      </div>
      {ACTIVE_CAN_EDIT && onQuick && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
          {onPrintBriefing && <button className="bbtn" onClick={onPrintBriefing} style={{ flexShrink: 0 }}><Printer size={16} color="var(--accent)" /> Today's briefing</button>}
          {onWeeklyEmail && <button className="bbtn" onClick={onWeeklyEmail} style={{ flexShrink: 0 }}><Mail size={16} color="var(--accent)" /> Weekly update email</button>}
          {onTodaySheet && <button className="bbtn" onClick={onTodaySheet} style={{ flexShrink: 0 }}><ClipboardList size={16} color="var(--accent)" /> Today's sheet</button>}
          {onTvMode && <button className="bbtn" onClick={onTvMode} style={{ flexShrink: 0 }}><Monitor size={16} color="var(--accent)" /> TV mode</button>}
          {onEmergencySheet && <button className="bbtn" onClick={onEmergencySheet} style={{ flexShrink: 0 }}><Siren size={16} color="var(--danger)" /> Emergency sheet</button>}
          {[["visit", "Log a visit", CheckCircle2], ["work", "Raise a job", Wrench], ["service", "Add service", Plus], ["incident", "Report incident", Siren]].map(([k, l, I]) => (
            <button key={k} className="bbtn" onClick={() => onQuick(k)} style={{ flexShrink: 0 }}><I size={16} color="var(--accent)" /> {l}</button>
          ))}
        </div>
      )}
      <div className="bento">
        {setup && !setup.hidden && ACTIVE_CAN_EDIT && setupDone < setupSteps.length && (
          <section className="bcard c4" style={{ background: "var(--accent-soft)" }}>
            <Label icon={Rocket} right={<button onClick={onHideSetup} title="Hide" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={14} color="var(--muted)" /></button>}>Getting started — {setupDone}/{setupSteps.length}</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
              {setupSteps.map(([label, ok, tab]) => (
                <button key={label} onClick={() => tab && onGo(tab)} disabled={ok} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: "4px 0", cursor: ok || !tab ? "default" : "pointer", fontFamily: "inherit", fontSize: 13, color: ok ? "var(--muted)" : "var(--text)", textDecoration: ok ? "line-through" : "none" }}>
                  {ok ? <CheckCircle2 size={15} color="var(--ok)" /> : <Square size={15} color="var(--muted)" />} {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {submissionsCount > 0 && ACTIVE_CAN_EDIT && (
          <button className="bcard c4" onClick={onReviewSubmissions} style={{ cursor: "pointer", background: "var(--accent-soft)", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Wrench size={20} color="var(--accent)" />
            <span style={{ flex: 1, textAlign: "left" }}><b style={{ fontSize: 14 }}>{submissionsCount} engineer report{submissionsCount === 1 ? "" : "s"} to review</b><span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>Sent from service QR codes — accept to log the visit</span></span>
            <ChevronRight size={16} color="var(--accent)" />
          </button>
        )}
        {show("attention") && (
          <section className="bcard c2 r2" aria-label="Needs attention">
            <Label icon={AlertTriangle} right={alerts.length > 6 ? <button style={linkBtn} onClick={() => onGo("alerts")}>All {alerts.length}</button> : null}>Needs attention</Label>
            {alerts.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ok)", fontSize: 14, fontWeight: 600, padding: "18px 0" }}><CheckCircle2 size={18} /> All clear — nothing needs attention.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alerts.slice(0, 6).map((a) => (
                  <button key={a.key} className="brow" onClick={() => onGo(a.tab)} style={{ background: toneSoft(a.tone) }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, background: toneVar(a.tone) }} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 650 }}>{a.title}</span>
                      {a.detail && <span style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</span>}
                    </span>
                    <ArrowUpRight className="nudge" size={15} color="var(--muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <BigKpi label="PPM on time" icon={CheckCircle2} value={comp.pct === null ? "—" : `${comp.pct}%`} sub={comp.total ? `${comp.totals.onTime} of ${comp.total} planned visits${comp.pct != null && complianceMonthAgo != null && comp.pct !== complianceMonthAgo ? ` · ${comp.pct > complianceMonthAgo ? "▲" : "▼"} ${Math.abs(comp.pct - complianceMonthAgo)} pts vs a month ago` : ""}` : "No planned visits due yet"} color={comp.pct === null ? "var(--text)" : comp.pct >= 90 ? "var(--ok)" : comp.pct >= 70 ? "var(--warn)" : "var(--danger)"} bar={comp.pct} onClick={() => onGo("certificates")} />
        <BigKpi label="Overdue" icon={Clock} value={overdue.length} sub={overdue.length ? "services past due — tap to see" : "nothing overdue"} color={overdue.length ? "var(--danger)" : "var(--ok)"} onClick={() => onGo("schedule")} />

        {show("spend") && (
          <button className="bcard c2" onClick={() => onGo("budget")} style={{ cursor: "pointer" }}>
            <Label icon={PoundSterling} right={<span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{spendPct === null ? "No annual budget set" : `${spendPct}% of budget`}</span>}>Spend {spend.yr}</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>{gbp(spend.spent)}</span>
              {spend.budget ? <span className="bsub">of {gbp(spend.budget)}</span> : null}
            </div>
            {spark}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12.3 }}>
              <span style={{ color: "var(--muted)" }}><b style={{ color: "var(--accent)" }}>━</b> Actual &nbsp; <b style={{ color: "var(--chart-plan)" }}>┅</b> Plan</span>
              {spend.forecast != null && spend.budget > 0 && <span style={{ fontWeight: 650, color: spend.forecast > spend.budget ? "var(--danger)" : "var(--ok)" }}>Forecast {gbp(spend.forecast)}{spend.forecast > spend.budget ? ` — ${gbp(spend.forecast - spend.budget)} over` : " · on track"}</span>}
            </div>
          </button>
        )}

        {show("weather") && <WeatherTile source={weatherSource} onSetLocation={onEditSite} />}
        <BigKpi label="Due next 7 days" icon={CalendarCheck} value={next7.length} sub={notBooked.length ? `${notBooked.length} due in 14 days not booked` : "all booked"} color={notBooked.length ? "var(--warn)" : "var(--text)"} onClick={() => onGo("devices")} />
        <BigKpi label="Open works" icon={Wrench} value={openWorks.length} sub={slaBreached.length ? `${slaBreached.length} past target date` : "all within target"} color={slaBreached.length ? "var(--danger)" : "var(--text)"} onClick={() => onGo("works")} />

        {show("today") && todayItems && <div className="wrap c2"><TodayCard items={todayItems} onOpenDevice={onOpenDevice} onGo={onGo} /></div>}
        {show("week") && weekAhead && <div className="wrap c2"><WeekAheadCard days={weekAhead} onOpenDevice={onOpenDevice} /></div>}
        {show("notices") && (ACTIVE_CAN_EDIT || notices.length > 0) && <div className="wrap c2"><NoticeBoard notices={notices} onSave={onSaveNotice} onDelete={onDeleteNotice} /></div>}
        {show("reminders") && <div className="wrap c2"><RemindersCard onSnooze={onSnoozeReminder} reminders={reminders} users={users} onAdd={onAddReminder} onToggle={onToggleReminder} onDelete={onDeleteReminder} /></div>}

        {show("upcoming") && (
          <section className="bcard c2" aria-label="Coming up">
            <Label icon={CalendarDays} right={<button style={linkBtn} onClick={() => onGo("schedule")}>Schedule</button>}>Coming up</Label>
            {upcoming.length === 0 ? <div className="bsub">Nothing scheduled.</div> : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {upcoming.map((d, i) => {
                  const n = daysUntil(d.nextServiceDate); const b = currentBooking(d);
                  return (
                    <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", borderTop: i ? "1px solid var(--border)" : "none", padding: "8px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "var(--text)" }}>
                      <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: n < 0 ? "var(--danger)" : "var(--text)" }}>{new Date(d.nextServiceDate + "T00:00:00").getDate()}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{new Date(d.nextServiceDate + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                        <div style={{ fontSize: 12, color: n < 0 ? "var(--danger)" : "var(--muted)" }}>{n < 0 ? `${-n} days overdue` : n === 0 ? "Due today" : `In ${n} day${n === 1 ? "" : "s"}`}{b ? ` · ${b.status === "confirmed" ? "Confirmed" : "Booked"}${b.time ? ` ${b.time}` : ""}` : n >= 0 && n <= 14 ? " · not booked" : ""}</div>
                      </div>
                      <ChevronRight size={14} color="var(--muted)" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {show("assigned") && myName && (myDevices.length > 0 || myWorks.length > 0 || myActions.length > 0 || myReminders.length > 0) && (
          <section className="bcard c2" aria-label="Assigned to you">
            <Label icon={UserCheck}>Assigned to you</Label>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {myDevices.slice(0, 6).map((d, i) => { const n = daysUntil(d.nextServiceDate); return (
                <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ display: "flex", gap: 8, background: "none", border: "none", borderTop: i ? "1px solid var(--border)" : "none", padding: "7px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 13, color: "var(--text)" }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{d.name}</span><span style={{ color: n < 0 ? "var(--danger)" : "var(--muted)", fontWeight: n < 0 ? 700 : 500 }}>{n < 0 ? `${-n}d overdue` : n === 0 ? "today" : `in ${n}d`}</span>
                </button>
              ); })}
              {myActions.slice(0, 4).map((a) => (
                <button key={a.id} onClick={() => onGo("meters")} style={{ display: "flex", gap: 8, background: "none", border: "none", borderTop: "1px solid var(--border)", padding: "7px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 13, color: "var(--text)" }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>Action: {a.action || a.finding}</span><span style={{ color: a.due && daysUntil(a.due) < 0 ? "var(--danger)" : "var(--muted)" }}>{a.due ? fmtDate(a.due) : ""}</span>
                </button>
              ))}
              {myReminders.slice(0, 4).map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", padding: "7px 0", fontSize: 13 }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>Reminder: {r.text}</span><span style={{ color: r.due && daysUntil(r.due) < 0 ? "var(--danger)" : "var(--muted)" }}>{r.due ? fmtDate(r.due) : ""}</span>
                </div>
              ))}
              {myWorks.slice(0, 4).map((w) => (
                <button key={w.id} onClick={() => onGo("works")} style={{ display: "flex", gap: 8, background: "none", border: "none", borderTop: "1px solid var(--border)", padding: "7px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 13, color: "var(--text)" }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{w.description}</span><span style={{ color: workSla(w)?.breached ? "var(--danger)" : "var(--muted)" }}>{w.status.replace("_", " ")}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {show("pinned") && pinnedDevices.length > 0 && (
          <section className="bcard c2" aria-label="Pinned">
            <Label icon={Pin}>Pinned</Label>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {pinnedDevices.map((d, i) => { const n = daysUntil(d.nextServiceDate); return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, borderTop: i ? "1px solid var(--border)" : "none", padding: "7px 0" }}>
                  <button onClick={() => onOpenDevice(d.id)} style={{ flex: 1, display: "flex", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 13, color: "var(--text)" }}>
                    <span style={{ flex: 1, fontWeight: 600 }}>{d.name}</span>
                    <span style={{ color: n !== null && n < 0 ? "var(--danger)" : "var(--muted)", fontWeight: n !== null && n < 0 ? 700 : 500 }}>{n === null ? "no date" : n < 0 ? `${-n}d overdue` : n === 0 ? "today" : `in ${n}d`}</span>
                  </button>
                  <button onClick={() => onUnpin(d.id)} title="Unpin" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={13} color="var(--muted)" /></button>
                </div>
              ); })}
            </div>
          </section>
        )}

        {show("overdueSup") && overdueBySupplier.length > 0 && (
          <section className="bcard c2" aria-label="Overdue by supplier">
            <Label icon={Clock}>Overdue by supplier</Label>
            {overdueBySupplier.slice(0, 6).map((r) => { const max = overdueBySupplier[0].n; return (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 120, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <div style={{ flex: 1, height: 10, background: "var(--card-hi)", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${(r.n / max) * 100}%`, height: "100%", background: "var(--danger)", borderRadius: 5 }} /></div>
                <b style={{ fontSize: 12.5, width: 22, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{r.n}</b>
              </div>
            ); })}
          </section>
        )}

        {show("contractors") && <div className="wrap c2"><SiteRegister onRollCall={onRollCall} locationId={locationId} expected={expectedToday} onSignOutAll={onSignOutAll} signins={signins} suppliers={suppliers} devices={devices} locationName={locationName} onSignIn={onSignIn} onSignOut={onSignOut} /></div>}
        {show("keydates") && upcomingKeyDates.length > 0 && (
          <section className="bcard c2" aria-label="Key dates">
            <div className="blabel"><CalendarClock size={14} /><span>Key dates</span></div>
            {upcomingKeyDates.map((k) => { const n = daysUntil(k.date); return (
              <div key={k.id} style={{ display: "flex", gap: 10, alignItems: "baseline", borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: n < 0 ? "var(--danger)" : n <= 30 ? "var(--warn)" : "var(--text)", width: 62, flexShrink: 0 }}>{fmtDate(k.date).replace(/ \d{4}$/, "")}</span>
                <span style={{ flex: 1, fontSize: 13 }}><b>{k.title}</b><span style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>{k.type} · {n < 0 ? `${-n} days ago` : n === 0 ? "today" : `in ${n} days`}</span></span>
              </div>
            ); })}
          </section>
        )}
        {show("oncall") && (onCall.length > 0 || (ACTIVE_CAN_EDIT && onSaveOnCall)) && <div className="wrap c2"><OnCallCard rota={onCall} onSave={onSaveOnCall} /></div>}
        {show("emergency") && <div className="wrap c2"><EmergencyContacts suppliers={suppliers} contacts={emergency} onSave={onSaveEmergency} /></div>}
        {show("statutory") && <div className="wrap c2"><StatutoryRegister custom={customStatutory} onSaveCustom={onSaveCustomStatutory} devices={devices} na={statutoryNA} onNA={onStatutoryNA} onAdd={onAddStatutory} onOpenDevice={onOpenDevice} locationName={locationName} /></div>}
        {(() => { const h = new Date().getHours(); const on = (signins || []).filter((x) => !x.outAt && x.locationId === (site?.id || x.locationId)); return h >= 18 && on.length > 0 ? (
          <section className="bcard c4" style={{ background: "var(--warn-soft)", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Clock size={18} color="var(--warn)" />
            <span style={{ flex: 1, fontSize: 13 }}><b>{on.length} still signed in after 6pm:</b> {on.slice(0, 6).map((x) => x.name).join(", ")}{on.length > 6 ? "…" : ""} — check they've left, or sign them out in the register below.</span>
          </section>
        ) : null; })()}
        {(expected.length > 0 || onAddExpected) && ACTIVE_CAN_EDIT && <div className="wrap c2"><ExpectedVisitors list={expected} onAdd={onAddExpected} onRemove={onRemoveExpected} onArrive={onArriveExpected} /></div>}
        {waitingOnMe.length > 0 && ACTIVE_CAN_EDIT && (
          <section className="bcard c2" aria-label="Waiting on me">
            <div className="blabel"><Inbox size={14} /><span>Waiting on you</span></div>
            {waitingOnMe.map((w) => <button key={w.label} onClick={w.go} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: "none", border: "none", borderTop: "1px solid var(--border)", padding: "7px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--text)", textAlign: "left" }}><span>{w.label}</span><b style={{ color: "var(--accent)" }}>{w.n}</b></button>)}
          </section>
        )}
        {monthBudget && monthBudget.planned + monthBudget.spent > 0 && (
          <section className="bcard c1" aria-label="This month's budget" onClick={monthBudget.go} style={{ cursor: "pointer" }}>
            <div className="blabel"><Wallet size={14} /><span>{monthBudget.label}</span></div>
            <div className="bbig" style={{ fontSize: 24 }}>{gbp(monthBudget.spent).replace(/\.00$/, "")}</div>
            <div className="bsub">spent · {gbp(monthBudget.planned).replace(/\.00$/, "")} planned this month{monthBudget.planned > 0 ? ` (${Math.round((monthBudget.spent / monthBudget.planned) * 100)}%)` : ""}</div>
          </section>
        )}
        {doneToday && (doneToday.visits + doneToday.jobs + doneToday.readings + doneToday.checks) > 0 && (
          <section className="bcard c1" aria-label="Done today">
            <div className="blabel"><CheckCircle2 size={14} /><span>Done today</span></div>
            <div className="bbig" style={{ fontSize: 28 }}>{doneToday.visits + doneToday.jobs + doneToday.readings + doneToday.checks}</div>
            <div className="bsub">{[doneToday.visits && `${doneToday.visits} visit${doneToday.visits === 1 ? "" : "s"}`, doneToday.jobs && `${doneToday.jobs} job${doneToday.jobs === 1 ? "" : "s"} closed`, doneToday.readings && `${doneToday.readings} reading${doneToday.readings === 1 ? "" : "s"}`, doneToday.checks && `${doneToday.checks} check${doneToday.checks === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</div>
          </section>
        )}
        {onAddHandover && <div className="wrap c2"><HandoverCard items={handover} onAdd={onAddHandover} /></div>}
        {recentServices.length > 0 && (
          <section className="bcard c2" aria-label="Recently opened">
            <div className="blabel"><History size={14} /><span>Recently opened</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{recentServices.map((d) => <button key={d.id} onClick={() => onOpenService(d.id)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 14, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>{d.name}</button>)}</div>
          </section>
        )}
        {notesKey && <div className="wrap c2"><MyNotes storageKey={notesKey} /></div>}
        {show("siteprofile") && site && <div className="wrap c2"><SiteProfileCard site={site} onEdit={onEditSite} onDirectory={onPeopleDirectory} /></div>}
        {show("siteinfo") && <div className="wrap c2"><SiteInfoCard info={siteInfo} onSave={onSaveSiteInfo} /></div>}

        {show("late") && Object.keys(lateByReason).length > 0 && (
          <section className="bcard c2" aria-label="Late visits">
            <Label icon={Clock}>Late visits in {yr} — why</Label>
            {Object.entries(lateByReason).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
              <div key={r} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{r}</span><b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{n}</b></div>
            ))}
          </section>
        )}

        {show("activity") && (
          <section className="bcard c2" aria-label="Recent activity">
            <Label icon={History}>Recent activity</Label>
            {activity.length === 0 ? <div className="bsub">No activity yet.</div> : activity.slice(0, 5).map((a) => (
              <div key={a.id}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.text}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.by} · {relativeDays(a.at)}</div>
              </div>
            ))}
          </section>
        )}

        {show("recent") && recentDevices.length > 0 && (
          <div className="c4" style={{ display: "flex", gap: 6, overflowX: "auto", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 650, flexShrink: 0 }}>Recently viewed:</span>
            {recentDevices.slice(0, 8).map((d) => <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ flexShrink: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "5px 11px", fontSize: 12, fontWeight: 650, color: "var(--text)", cursor: "pointer", fontFamily: "inherit" }}>{d.name}</button>)}
          </div>
        )}
      </div>
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
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 18 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <ScrollText size={18} color="#2B4562" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Statutory compliance</div>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
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
              <div key={r.item.key} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px", opacity: r.status === "na" ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 700 }}>{r.item.label}</div>
                    <div style={{ fontSize: 10.8, color: "var(--faint)" }}>{r.item.freq}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, borderRadius: 10, padding: "2px 8px", flexShrink: 0 }}>{label}</span>
                </div>
                {r.matched.length > 0 && r.status !== "na" && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                    {r.matched.map((d) => (
                      <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: r.overdue.includes(d) ? "var(--danger)" : "var(--accent)", fontWeight: 600 }}>{d.name}</button>
                    ))}
                  </div>
                )}
                {ACTIVE_CAN_EDIT && (onAdd || onNA) && (r.status === "missing" || r.status === "na") && (
                  <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                    {r.status === "missing" && onAdd && <button onClick={() => onAdd(r.item)} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Set up this service</button>}
                    {onNA && <button onClick={() => onNA(r.status === "na" ? na.filter((k) => k !== r.item.key) : [...na, r.item.key])} style={{ background: "none", border: "none", padding: 0, color: "var(--faint)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{r.status === "na" ? "Mark as applicable" : "Not applicable here"}</button>}
                  </div>
                )}
              </div>
            );
          })}
          {ACTIVE_CAN_EDIT && onSaveCustom && (addingReq ? (
            <CustomRequirementForm onCancel={() => setAddingReq(false)} onSave={(item) => { onSaveCustom([...custom, item]); setAddingReq(false); }} />
          ) : (
            <button onClick={() => setAddingReq(true)} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: 9, padding: 8, fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>+ Add your own requirement</button>
          ))}
          {custom.length > 0 && ACTIVE_CAN_EDIT && onSaveCustom && <div style={{ fontSize: 11, color: "var(--faint)" }}>Your requirements: {custom.map((c) => <span key={c.key}>{c.label} <button onClick={() => onSaveCustom(custom.filter((x) => x.key !== c.key))} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 11, padding: 0 }}>(remove)</button> </span>)}</div>}
          <button onClick={print} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print register</button>
          <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Services are matched by name (e.g. "Emergency lighting test"). Frequencies are typical UK guidance — always follow your own risk assessments.</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Contractor sign-in register
--------------------------------------------------------- */
export function SiteRegister({ onRollCall, locationId = null, expected = [], onSignOutAll, signins, suppliers, devices, locationName, onSignIn, onSignOut }) {
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
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <HardHat size={18} color="#D97706" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Contractors on site: {onSite.length}</div>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Sign-in register and fire roll call</div>
        </div>
        {ACTIVE_CAN_EDIT && <button onClick={() => setAdding(true)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><LogIn size={13} /> Sign in</button>}
      </div>
      {ACTIVE_CAN_EDIT && expected.filter((d) => !signins.some((x) => !x.outAt && (x.purpose || "").includes(d.name))).length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Expected today</div>
          {expected.filter((d) => !signins.some((x) => !x.outAt && (x.purpose || "").includes(d.name))).map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent-soft)", borderRadius: 9, padding: "6px 9px" }}>
              <span style={{ flex: 1, fontSize: 12.5 }}><b>{d.booking?.time ? `${d.booking.time} · ` : ""}{d.supplierName || "Supplier"}</b> — {d.name}</span>
              <button onClick={() => setAdding({ supplierId: d.supplierId || "", company: d.supplierName || "", purpose: d.name })} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sign in</button>
            </div>
          ))}
        </div>
      )}
      {onSite.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {onSite.map((x) => (
            <div key={x.id} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "7px 9px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.8, fontWeight: 700 }}>{x.name}{x.kind === "visitor" && <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--accent)" }}> VISITOR{x.host ? ` · visiting ${x.host}` : ""}</span>}{x.selfService && <span style={{ fontSize: 10.5, color: "var(--faint)" }}> · self sign-in</span>}{!x.outAt && Date.now() - new Date(x.inAt).getTime() > 10 * 3600000 && <span style={{ fontSize: 10.5, color: "var(--danger)", fontWeight: 700 }}> · on site {Math.floor((Date.now() - new Date(x.inAt).getTime()) / 3600000)}h — signed out?</span>}{x.vehicleReg && <span style={{ fontSize: 10.5, color: "var(--faint)" }}> · 🚗 {x.vehicleReg}</span>}{x.company ? <span style={{ color: "var(--faint)", fontWeight: 600 }}> · {x.company}</span> : null}</div>
                <div style={{ fontSize: 11, color: "var(--faint)" }}>In {time(x.inAt)}{x.purpose ? ` · ${x.purpose}` : ""}{x.ramsChecked ? " · RAMS ✓" : ""}{x.inducted ? " · inducted ✓" : <b style={{ color: "var(--danger)" }}> · no induction</b>}{x.badge ? ` · pass ${x.badge}` : ""}</div>
              </div>
              {ACTIVE_CAN_EDIT && <><button onClick={() => printBadge(x, locationName)} title="Print badge" style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", marginRight: 4 }}><Contact size={14} color="#2B4562" /></button>
                <button onClick={() => onSignOut(x.id)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><LogOut size={12} /> Out</button></>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {onSite.length > 1 && ACTIVE_CAN_EDIT && onSignOutAll && <button onClick={() => { if (window.confirm(`Sign out all ${onSite.length} contractors now?`)) onSignOutAll(); }} style={{ background: "none", border: "none", padding: 0, color: "var(--muted)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Sign everyone out</button>}
        {locationId && ACTIVE_CAN_EDIT && <button onClick={() => { const url = `${appBaseUrl()}?signin=${locationId}${orgParam()}`; openPrintReport("Sign in here", locationName, `<div style="text-align:center;margin-top:30px"><div style="font-size:28px;font-weight:800;margin-bottom:6px">Contractors & visitors</div><div style="font-size:18px;margin-bottom:24px">Scan with your phone camera to sign in and out</div><img src="${qrImageUrl(url, 420)}" style="width:300px;height:300px"><div class="muted" style="margin-top:16px">${escapeHtml(url)}</div><div style="margin-top:28px;font-size:14px">No app needed · please sign out when you leave</div></div>`); }} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Print self sign-in QR</button>}
        {onSite.length > 0 && onRollCall && <button onClick={onRollCall} style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔥 Live roll call</button>}
        {onSite.length > 0 && <button onClick={rollCall} style={{ background: "none", border: "none", padding: 0, color: "var(--danger)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Print fire roll call</button>}
        {signins.length > 0 && <button onClick={() => setShowLog(true)} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Full register ({signins.length})</button>}
      </div>
      {adding && <SignInModal prefill={adding === true ? null : adding} signins={signins} suppliers={suppliers} devices={devices} onClose={() => setAdding(false)} onSave={(e) => { onSignIn(e); setAdding(false); }} />}
      {showLog && (
        <Modal title="Contractor register" onClose={() => setShowLog(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ alignSelf: "flex-end" }}>
              <ExportButton filename="contractor-register.csv" rows={[["Date", "Name", "Company", "Phone", "Working on", "RAMS checked", "Pass", "In", "Out", "Signed in by"], ...signins.map((x) => [fmtDate(x.inAt.slice(0, 10)), x.name, x.company || "", x.phone || "", x.purpose || "", x.ramsChecked ? "Yes" : "No", x.badge || "", time(x.inAt), x.outAt ? time(x.outAt) : "On site", x.by || ""])]} />
            </div>
            {signins.slice(0, 100).map((x) => (
              <div key={x.id} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "7px 9px" }}>
                <div style={{ fontSize: 12.8, fontWeight: 700 }}>{x.name}{x.company ? ` · ${x.company}` : ""}</div>
                <div style={{ fontSize: 11, color: "var(--faint)" }}>{fmtDate(x.inAt.slice(0, 10))} · {time(x.inAt)}–{x.outAt ? time(x.outAt) : "on site"}{x.purpose ? ` · ${x.purpose}` : ""}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function SignInModal({ prefill = null, signins = [], suppliers, devices, onClose, onSave }) {
  const [supplierId, setSupplierId] = useState(prefill?.supplierId || "");
  const [company, setCompany] = useState(prefill?.company || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState(prefill?.purpose || "");
  const [ramsChecked, setRamsChecked] = useState(false);
  const [inducted, setInducted] = useState(false);
  const [kind, setKind] = useState(prefill?.kind || "contractor");
  const [vehicleReg, setVehicleReg] = useState("");
  const [host, setHost] = useState("");
  const priorInduction = signins.filter((x) => x.inducted && x.name.trim().toLowerCase() === name.trim().toLowerCase() && name.trim()).sort((a, b) => String(b.inAt).localeCompare(String(a.inAt)))[0];
  const inductionValid = priorInduction && (Date.now() - new Date(priorInduction.inductedAt || priorInduction.inAt).getTime()) < 365 * 86400000;
  const [badge, setBadge] = useState("");
  const listId = useMemo(() => `purpose-${uid()}`, []);
  return (
    <Modal title="Sign in a contractor" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(() => { const sp = suppliers.find((x) => x.id === supplierId); if (!sp) return null; const warn = [sp.status === "blocked" && "marked Do not use", sp.status === "probation" && "on probation", sp.insuranceExpiry && daysUntil(sp.insuranceExpiry) < 0 && `insurance expired ${fmtDate(sp.insuranceExpiry)}`, sp.accreditationExpiry && daysUntil(sp.accreditationExpiry) < 0 && "accreditation expired"].filter(Boolean); return warn.length ? <div style={{ background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 700 }}>⚠ {sp.name}: {warn.join(" · ")} — check before letting them work.</div> : null; })()}
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={kind === "contractor"} onClick={() => setKind("contractor")}>Contractor</ToggleButton>
          <ToggleButton active={kind === "visitor"} onClick={() => setKind("visitor")}>Visitor</ToggleButton>
        </div>
        {kind === "visitor" && <Field label="Visiting (host)"><TextInput value={host} onChange={(e) => setHost(e.target.value)} placeholder="Who are they here to see?" /></Field>}
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
        <Field label="Vehicle registration (optional)"><TextInput value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} placeholder="For the car park list" /></Field>
        <Field label="Working on">
          <TextInput list={listId} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. AHU 3 service" />
          <datalist id={listId}>{devices.map((d) => <option key={d.id} value={d.name} />)}</datalist>
        </Field>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <Field label="Visitor pass no. (optional)"><TextInput value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="e.g. 14" /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer", paddingBottom: 10 }}>
            <input type="checkbox" checked={ramsChecked} onChange={(e) => setRamsChecked(e.target.checked)} style={{ margin: 0 }} /> RAMS checked
          </label>
        </div>
        {inductionValid ? (
          <div style={{ fontSize: 12, color: "var(--ok)", fontWeight: 650 }}>✓ Site induction done {fmtDate(String(priorInduction.inductedAt || priorInduction.inAt).slice(0, 10))} — valid for a year</div>
        ) : (
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: name.trim() && !inducted ? "var(--danger)" : "var(--text-2)", cursor: "pointer", background: "var(--warn-soft)", borderRadius: 8, padding: "8px 10px" }}>
            <input type="checkbox" checked={inducted} onChange={(e) => setInducted(e.target.checked)} style={{ margin: 0 }} /> Site induction given (fire exits, assembly point, first aid, sign-out)
          </label>
        )}
        <PrimaryButton onClick={() => name.trim() && onSave({ name: name.trim(), company: company.trim(), supplierId: supplierId || null, phone: phone.trim(), purpose: purpose.trim(), ramsChecked, badge: badge.trim(), kind, host: kind === "visitor" ? host.trim() : undefined, vehicleReg: vehicleReg.trim().toUpperCase() || undefined, inducted: inducted || !!inductionValid, inductedAt: inducted ? new Date().toISOString() : inductionValid ? (priorInduction.inductedAt || priorInduction.inAt) : null })}><LogIn size={15} /> Sign in</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Reminders / to-do on Home
--------------------------------------------------------- */
export function RemindersCard({ onSnooze, reminders, users, onAdd, onToggle, onDelete }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [showDone, setShowDone] = useState(false);
  const open = reminders.filter((r) => !r.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const done = reminders.filter((r) => r.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  function add() { if (!text.trim()) return; onAdd({ text: text.trim(), due: due || (repeat !== "none" ? new Date().toISOString().slice(0, 10) : null), assignee: assignee || null, repeat }); setText(""); setDue(""); setAssignee(""); setRepeat("none"); }
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8 }}>
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
              <button onClick={add} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          )}
        </div>
      )}
      {open.map((r) => {
        const n = r.due ? daysUntil(r.due) : null;
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
            <button onClick={() => ACTIVE_CAN_EDIT && onToggle(r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", marginTop: 1 }}><Square size={17} color="#8A94A0" /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.8, fontWeight: 600 }}>{r.text}</div>
              <div style={{ fontSize: 10.8, color: n !== null && n < 0 ? "var(--danger)" : n === 0 ? "var(--warn)" : "var(--faint)", fontWeight: n !== null && n <= 0 ? 700 : 500 }}>
                {r.due ? (n < 0 ? `Overdue — ${fmtDate(r.due)}` : n === 0 ? "Today" : `Due ${fmtDate(r.due)}`) : "No date"}{r.assignee ? ` · ${r.assignee}` : ""}{r.repeat && r.repeat !== "none" ? ` · repeats ${REPEAT_OPTIONS[r.repeat].toLowerCase()}` : ""}
              </div>
              {ACTIVE_CAN_EDIT && onSnooze && n !== null && n <= 0 && <div style={{ display: "flex", gap: 8, marginTop: 2 }}>{[[1, "Tomorrow"], [7, "Next week"]].map(([dd, l]) => <button key={dd} onClick={() => onSnooze(r.id, dd)} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 10.8, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}</div>}
            </div>
            <ConfirmDeleteButton onConfirm={() => onDelete(r.id)} size={12} />
          </div>
        );
      })}
      {done.length > 0 && <button onClick={() => setShowDone((v) => !v)} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>{showDone ? "Hide" : "Show"} {done.length} done</button>}
      {showDone && done.slice(0, 20).map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", opacity: 0.65 }}>
          <button onClick={() => ACTIVE_CAN_EDIT && onToggle(r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}><CheckSquare size={17} color="#2F855A" /></button>
          <span style={{ flex: 1, fontSize: 12.5, textDecoration: "line-through" }}>{r.text}</span>
          <span style={{ fontSize: 10.5, color: "var(--faint)" }}>{r.doneBy}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   Emergency contacts on Home
--------------------------------------------------------- */
export function EmergencyContacts({ suppliers = [], contacts, onSave }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const list = contacts || DEFAULT_EMERGENCY;
  const [draft, setDraft] = useState(list);
  const filled = list.filter((c) => c.phone);
  function print() {
    openPrintReport("Emergency contacts", "Keep by reception, in the plant room and with key holders", tableHtml(["Who", "Name", "Phone", "Notes"], list.filter((c) => c.phone).map((c) => [`<b>${escapeHtml(c.label)}</b>`, escapeHtml(c.name || ""), `<b style="font-size:15px">${escapeHtml(c.phone)}</b>`, escapeHtml(c.notes || "")])));
  }
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <PhoneCall size={17} color="#C53030" />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Emergency contacts <span style={{ color: "var(--faint)", fontWeight: 600, fontSize: 12 }}>({filled.length})</span></span>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && !editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {filled.map((c, i) => (
            <a key={i} href={`tel:${c.phone.replace(/[^+0-9]/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card-hi)", borderRadius: 8, padding: "8px 10px", textDecoration: "none", color: "var(--text)" }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.8, fontWeight: 650 }}>{c.label}</div>{(c.name || c.notes) && <div style={{ fontSize: 11, color: "var(--faint)" }}>{[c.name, c.notes].filter(Boolean).join(" · ")}</div>}</div>
              <b style={{ fontSize: 13, color: "var(--ok)", display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} /> {c.phone}</b>
            </a>
          ))}
          {filled.length === 0 && <div style={{ fontSize: 12, color: "var(--faint)" }}>Add your site's numbers so anyone can call in one tap.</div>}
          {suppliers.filter((s) => s.oohPhone).map((s) => (
            <a key={s.id} href={`tel:${s.oohPhone.replace(/[^+0-9]/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--danger-soft)", borderRadius: 8, padding: "8px 10px", textDecoration: "none", color: "var(--text)" }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.8, fontWeight: 650 }}>{s.name} — 24h</div><div style={{ fontSize: 11, color: "var(--faint)" }}>Supplier out-of-hours line</div></div>
              <b style={{ fontSize: 13, color: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} /> {s.oohPhone}</b>
            </a>
          ))}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {ACTIVE_CAN_EDIT && onSave && <button onClick={() => { setDraft(list); setEditing(true); }} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>}
            {filled.length > 0 && <button onClick={print} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Print</button>}
          </div>
        </div>
      )}
      {open && editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {draft.map((c, i) => (
            <div key={i} style={{ background: "var(--card-hi)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
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
          <button onClick={() => setDraft((p) => [...p, { label: "New contact", phone: "" }])} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: 8, padding: 7, fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>+ Add contact</button>
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
    <button key={key} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", borderTop: "1px solid var(--border)", padding: "6px 0", cursor: onClick ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
      {icon}<div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.8, fontWeight: 600 }}>{main}</div>{sub && <div style={{ fontSize: 11, color: "var(--faint)" }}>{sub}</div>}</div>
    </button>
  );
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Sun size={17} color="#D97706" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Today{total ? ` (${total})` : ""}</span></div>
      {total === 0 && <div style={{ fontSize: 12, color: "var(--faint)" }}>Nothing booked or due today.</div>}
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
      <span role="button" onClick={() => setOpen((v) => !v)} style={{ fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer" }}>{open ? "Hide" : "Show"} spend curve</span>
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
    <div style={{ background: "var(--card-hi)", borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
      <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Requirement, e.g. Dry riser test" />
      <div style={{ display: "flex", gap: 6 }}>
        <TextInput value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="Frequency text, e.g. 6-monthly" style={{ flex: 1 }} />
        <TextInput type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="months" style={{ width: 70 }} />
      </div>
      <TextInput value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Words to match service names, comma separated (e.g. dry riser, riser)" />
      <div style={{ display: "flex", gap: 6 }}>
        <PrimaryButton onClick={() => label.trim() && onSave({ key: `c_${uid()}`, label: label.trim(), freq: freq.trim() || `Every ${months} months`, months: Number(months) || 12, keywords: (kw || label).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) })} style={{ flex: 1 }}>Add</PrimaryButton>
        <button onClick={onCancel} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
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
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <Building2 size={17} color="#2B4562" />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Site information {!filled.length && <span style={{ fontSize: 11.5, color: "var(--warn)", fontWeight: 600 }}>— not filled in</span>}</span>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && !editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {filled.map(([k, l]) => <div key={k} style={{ fontSize: 12.5 }}><span style={{ color: "var(--faint)", fontWeight: 600 }}>{l}: </span>{k === "contactPhone" ? <a href={`tel:${String(info[k]).replace(/[^+0-9]/g, "")}`}>{info[k]}</a> : info[k]}{k === "address" && <> · <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 650 }}>Open in Maps</a></>}</div>)}
          {!filled.length && <div style={{ fontSize: 12, color: "var(--faint)" }}>Add the address, hours, access arrangements and site contact. They're added to work orders and booking emails automatically.</div>}
          {ACTIVE_CAN_EDIT && onSave && <button onClick={() => { setD(info || {}); setEditing(true); }} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>Edit</button>}
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
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><CalendarDays size={17} color="#2B4562" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Week ahead{total ? ` (${total})` : ""}</span></div>
      {days.map(({ day, items }, i) => (
        <div key={day} style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", padding: "5px 0", opacity: items.length ? 1 : 0.55 }}>
          <div style={{ width: 52, flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: i === 0 ? "#D97706" : "var(--text-2)" }}>{i === 0 ? "Today" : new Date(day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {items.length === 0 && <span style={{ fontSize: 11.5, color: "var(--faint)" }}>—</span>}
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

export function NoticeBoard({ notices, onSave, onDelete }) {
  const [text, setText] = useState("");
  const [until, setUntil] = useState(""); const [from, setFrom] = useState("");
  const list = [...notices].filter((n) => (!n.until || n.until >= new Date().toISOString().slice(0, 10)) && (!n.from || n.from <= new Date().toISOString().slice(0, 10) || ACTIVE_CAN_EDIT)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.at).localeCompare(String(a.at))).slice(0, 8);
  if (!ACTIVE_CAN_EDIT && !list.length) return null;
  return (
    <div style={{ background: "var(--warn-soft)", border: "1px solid #F5E1A4", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Megaphone size={16} color="#B7791F" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Team noticeboard</span></div>
      {list.map((n) => (
        <div key={n.id} style={{ borderTop: "1px solid #F5E1A4", padding: "6px 0", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.8, whiteSpace: "pre-wrap" }}>{n.pinned && "📌 "}{n.text}</div>
            <div style={{ fontSize: 10.8, color: "var(--faint)" }}>{n.by} · {relativeDays(n.at)}{n.until ? ` · until ${fmtDate(n.until)}` : ""}</div>
          </div>
          {ACTIVE_CAN_EDIT && <button onClick={() => onSave({ ...n, pinned: !n.pinned })} title={n.pinned ? "Unpin" : "Pin"} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Pin size={12} color={n.pinned ? "#D97706" : "#C0C6CC"} /></button>}
          {ACTIVE_CAN_EDIT && <ConfirmDeleteButton onConfirm={() => onDelete(n.id)} size={12} />}
        </div>
      ))}
      {ACTIVE_CAN_EDIT && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onSave({ text: text.trim(), until: until || null, from: from || null }); setText(""); setUntil(""); } }} placeholder="Post a note for the team, e.g. Lift 2 out until Thursday" style={{ flex: 1, fontSize: 12.5 }} />
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Show from (optional)" style={{ width: 140 }} />
          <TextInput type="date" value={until} onChange={(e) => setUntil(e.target.value)} title="Show until (optional)" style={{ width: 130, fontSize: 12 }} />
          <button onClick={() => { if (text.trim()) { onSave({ text: text.trim(), until: until || null, from: from || null }); setText(""); setUntil(""); } }} style={{ background: "#B7791F", color: "#fff", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Post</button>
        </div>
      )}
    </div>
  );
}

// Today & tomorrow's weather for the site (Open-Meteo, no account needed), with FM prompts:
// frost → grit paths, heavy rain → check gutters/roof drains, high wind → secure external items.
const WEATHER_TEXT = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog", 51: "Drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };
export function WeatherTile({ source, onSetLocation }) {
  const [w, setW] = useState(() => cachedWeather(source)); const [err, setErr] = useState("");
  useEffect(() => {
    setErr(""); if (!source) { setW(null); return; }
    const cached = cachedWeather(source); if (cached) { setW(cached); return; }
    setW(null);
    let cancelled = false;
    (async () => {
      try {
        let lat = source.lat, lon = source.lon, name = source.label;
        if (lat == null) {
          const res = await searchPlaces(source.place, source.country);
          if (!res.length) { if (!cancelled) setErr(`Couldn't find "${source.place}"`); return; }
          ({ lat, lon } = res[0]); name = `${res[0].name}${res[0].admin ? `, ${res[0].admin}` : ""}`;
        }
        const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=2`)).json();
        const d = f.daily; if (!d) { if (!cancelled) setErr("Weather service didn't answer"); return; }
        const data = { name, guessed: source.lat == null, days: [0, 1].map((i) => ({ min: Math.round(d.temperature_2m_min[i]), max: Math.round(d.temperature_2m_max[i]), rain: d.precipitation_sum[i], wind: Math.round(d.wind_speed_10m_max[i]), code: d.weather_code[i] })) };
        localStorage.setItem(`ppm:weather:${source.key}`, JSON.stringify({ at: Date.now(), data }));
        if (!cancelled) setW(data);
        try { window.dispatchEvent(new window.Event("ppm-weather")); } catch (e) { /* alerts refresh on the next change instead */ }
      } catch (e) { if (!cancelled) setErr(navigator.onLine === false ? "Weather unavailable offline" : "Couldn't reach the weather service"); }
    })();
    return () => { cancelled = true; };
  }, [source?.key]);
  const warn = w ? [
    w.days.some((d) => d.min <= 1) && ["Frost risk — grit paths & car park", "var(--accent)"],
    w.days.some((d) => d.rain >= 10) && ["Heavy rain — check gutters & roof drains", "var(--warn)"],
    w.days.some((d) => d.wind >= 50) && ["High winds — secure outside items, no roof work", "var(--danger)"],
  ].filter(Boolean) : [];
  const change = ACTIVE_CAN_EDIT && onSetLocation ? <button onClick={onSetLocation} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{w && !w.guessed ? "Change location" : "Set weather location"}</button> : null;
  return (
    <section className="bcard c1" aria-label="Weather">
      <div className="blabel"><CloudSun size={14} /><span>Weather</span></div>
      {!w ? (
        <>
          <div className="bsub">{err || (source ? "Loading…" : "No location set")}</div>
          {change}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span className="bbig" style={{ fontSize: 34 }}>{w.days[0].max}°</span><span className="bsub">low {w.days[0].min}° · {WEATHER_TEXT[w.days[0].code] || ""}</span></div>
          <div className="bsub">Tomorrow {w.days[1].min}–{w.days[1].max}° · {WEATHER_TEXT[w.days[1].code] || ""}{w.days[1].rain >= 1 ? ` · ${Math.round(w.days[1].rain)}mm` : ""}</div>
          {warn.map(([t, c]) => <div key={t} style={{ fontSize: 12, fontWeight: 700, color: c }}>{t}</div>)}
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: "auto" }}>📍 {w.name}{w.guessed ? " (best guess)" : ""}</div>
          {w.guessed && change}
          {!w.guessed && ACTIVE_CAN_EDIT && onSetLocation && <span style={{ display: "none" }} />}
        </>
      )}
    </section>
  );
}

export function SiteProfileCard({ site, onEdit, onDirectory }) {
  const [all, setAll] = useState(false);
  const staff = site.staff || [];
  const shown = all ? staff : staff.slice(0, 4);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginTop: 8 }}>
      {site.photo && <img src={site.photo} alt="" style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 750 }}>{site.name}</div>
            <div style={{ fontSize: 12, color: "var(--faint)" }}>{[site.type, site.address].filter(Boolean).join(" · ") || "Add a type, address and photo"}</div>
          </div>
          {ACTIVE_CAN_EDIT && onEdit && <button onClick={onEdit} title="Edit site" style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "6px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 650, color: "var(--accent)", fontFamily: "inherit" }}><Pencil size={12} /> Edit</button>}
        </div>
        {site.description && <div style={{ fontSize: 12.8, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{site.description}</div>}
        {(site.phone || site.email) && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5 }}>
            {site.phone && <a href={`tel:${site.phone.replace(/[^+0-9]/g, "")}`} style={{ color: "var(--accent)", fontWeight: 650, display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} /> {site.phone}</a>}
            {site.email && <a href={`mailto:${site.email}`} style={{ color: "var(--accent)", fontWeight: 650, display: "flex", alignItems: "center", gap: 4 }}><Mail size={13} /> {site.email}</a>}
          </div>
        )}
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>People based here ({staff.length})</div>
        {staff.length === 0 && <div style={{ fontSize: 12, color: "var(--faint)" }}>{ACTIVE_CAN_EDIT ? "Tap Edit to add engineers and other staff based at this site." : "No one added yet."}</div>}
        {shown.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {p.photo ? <img src={p.photo} alt="" style={{ width: 34, height: 34, borderRadius: 17, objectFit: "cover", flexShrink: 0 }} /> : <span style={{ width: 34, height: 34, borderRadius: 17, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12.5, flexShrink: 0 }}>{p.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650 }}>{p.name} <span style={{ fontWeight: 500, color: "var(--faint)", fontSize: 11.5 }}>{p.role}{p.company ? ` · ${p.company}` : ""}</span></div>
              {(p.hours || p.skills) && <div style={{ fontSize: 11.3, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[p.hours, p.skills].filter(Boolean).join(" · ")}</div>}
            </div>
            {p.phone && <a href={`tel:${p.phone.replace(/[^+0-9]/g, "")}`} title={`Call ${p.name}`} style={{ width: 34, height: 34, borderRadius: 17, background: "var(--ok-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Phone size={14} color="var(--ok)" /></a>}
            {p.email && <a href={`mailto:${p.email}`} title={`Email ${p.name}`} style={{ width: 34, height: 34, borderRadius: 17, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Mail size={14} color="var(--accent)" /></a>}
          </div>
        ))}
        {onDirectory && <button onClick={onDirectory} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>People at all sites →</button>}
        {staff.length > 4 && <button onClick={() => setAll((v) => !v)} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{all ? "Show fewer" : `Show all ${staff.length}`}</button>}
      </div>
    </div>
  );
}

export function ExpectedVisitors({ list, onAdd, onRemove, onArrive }) {
  const [adding, setAdding] = useState(false); const [d, setD] = useState({ name: "", company: "", host: "", date: new Date().toISOString().slice(0, 10), kind: "visitor" });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="blabel" style={{ margin: 0 }}><UserPlus size={14} /><span>Expected visitors</span></span><button onClick={() => setAdding((v) => !v)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{adding ? "Close" : "+ Expect someone"}</button></div>
      {adding && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <TextInput value={d.name} onChange={(e) => setD((p) => ({ ...p, name: e.target.value }))} placeholder="Name" />
          <TextInput value={d.company} onChange={(e) => setD((p) => ({ ...p, company: e.target.value }))} placeholder="Company" />
          <TextInput value={d.host} onChange={(e) => setD((p) => ({ ...p, host: e.target.value }))} placeholder="Visiting (host)" />
          <TextInput type="date" value={d.date} onChange={(e) => setD((p) => ({ ...p, date: e.target.value }))} />
          <select value={d.kind} onChange={(e) => setD((p) => ({ ...p, kind: e.target.value }))} style={{ ...inputStyle, fontSize: 12.5 }}><option value="visitor">Visitor</option><option value="contractor">Contractor</option></select>
          <button onClick={() => { if (!d.name.trim()) return; onAdd({ ...d, name: d.name.trim(), company: d.company.trim(), host: d.host.trim() }); setD((p) => ({ ...p, name: "", company: "" })); setAdding(false); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
        </div>
      )}
      {list.length === 0 && !adding && <div className="bsub">Pre-register visitors and contractors — on the day, sign them in with one tap.</div>}
      {list.slice(0, 8).map((v) => (
        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.8, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          <span style={{ flex: 1, minWidth: 0 }}><b>{v.name}</b>{v.company ? ` · ${v.company}` : ""}<span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>{v.date === today ? "Today" : fmtDate(v.date)}{v.host ? ` · visiting ${v.host}` : ""} · {v.kind}</span></span>
          {v.date === today && onArrive && <button onClick={() => onArrive(v)} style={{ background: "var(--ok)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Arrived</button>}
          <button onClick={() => onRemove(v.id)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>
        </div>
      ))}
    </div>
  );
}
function MyNotes({ storageKey }) {
  const [t, setT] = useState(() => { try { return localStorage.getItem(storageKey) || ""; } catch (e) { return ""; } });
  const [saved, setSaved] = useState(true);
  useEffect(() => { try { setT(localStorage.getItem(storageKey) || ""); } catch (e) { /* ignore */ } }, [storageKey]);
  useEffect(() => { if (saved) return; const h = setTimeout(() => { try { localStorage.setItem(storageKey, t); } catch (e) { /* ignore */ } setSaved(true); }, 600); return () => clearTimeout(h); }, [t, saved, storageKey]);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span className="blabel" style={{ margin: 0 }}><StickyNote size={14} /><span>My notes</span></span><span style={{ fontSize: 10.5, color: "var(--faint)" }}>{saved ? "Saved on this device · private" : "Saving…"}</span></div>
      <textarea value={t} onChange={(e) => { setT(e.target.value); setSaved(false); }} placeholder="Jot things down — only you see these, on this device." style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontSize: 13 }} />
    </div>
  );
}

function HandoverCard({ items, onAdd }) {
  const [t, setT] = useState("");
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="blabel" style={{ margin: 0 }}><ArrowRightLeft size={14} /><span>Shift handover</span></span>
      {ACTIVE_CAN_EDIT && <div style={{ display: "flex", gap: 6 }}><TextInput value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && t.trim()) { onAdd(t.trim()); setT(""); } }} placeholder="e.g. Boiler 2 locked out at 16:00 — engineer booked 8am" style={{ flex: 1, minWidth: 0 }} /><button onClick={() => { if (t.trim()) { onAdd(t.trim()); setT(""); } }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button></div>}
      {items.length === 0 && <div className="bsub">Leave notes for the next shift or a colleague — everyone on the team sees them.</div>}
      {items.slice(0, 6).map((h) => <div key={h.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 5 }}><div style={{ fontSize: 12.8 }}>{h.text}</div><div style={{ fontSize: 10.8, color: "var(--faint)" }}>{h.by || "—"} · {new Date(h.at).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</div></div>)}
    </div>
  );
}
