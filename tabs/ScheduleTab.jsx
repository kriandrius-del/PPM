// Schedule: calendar views, capacity and blackout dates.
import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Trash2, Plus } from "lucide-react";
import { CategoryBadge, EmptyState, Field, Modal, PrimaryButton, StatusDot, TextInput, ToggleButton } from "../components/ui.jsx";
import { MONTH_LABELS, UK_BANK_HOLIDAYS, WEEKDAY_LABELS } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, CATEGORY_META, emptyCatMap } from "../lib/globals.js";
import { downloadIcs } from "../lib/reports.js";
import { addDays, dueStatus, fmtDate, gbp, getMonthGrid, inBlackout, toISODate, uid, weekStart } from "../lib/utils.js";

/* ---------------------------------------------------------
   Schedule Tab — colour-coded calendar (month / year)
   Shows both upcoming due dates (ring) and completed service
   dates (filled dot) so logged history actually appears here.
--------------------------------------------------------- */
export function ScheduleCalendarTab({ devices, services, tasks, onLogService, onEditService, onMarkTaskDone, visitBudgets = [], suppliers = [], locationName = "", blackouts = [], avoidWeekends = false, onReschedule, onRescheduleTask, onSaveBlackouts, onShiftOutOfBlackouts }) {
  const [moving, setMoving] = useState(null); // { kind: 'device'|'task', id, name, from }
  const [showBlackouts, setShowBlackouts] = useState(false);
  function doMove(item, iso) {
    if (!item || !iso) return;
    if (item.kind === "task") onRescheduleTask?.(item.id, iso); else onReschedule?.(item.id, iso);
    setMoving(null);
  }
  function dropOn(e, iso) {
    e.preventDefault();
    try { doMove(JSON.parse(e.dataTransfer.getData("text/plain")), iso); } catch (err) { /* not one of ours */ }
  }
  const [icsMsg, setIcsMsg] = useState("");
  const today = new Date();
  const [view, setView] = useState("month"); // 'month' | 'year'
  const [cursorYear, setCursorYear] = useState(today.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const deviceById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);
  const dueDevices = devices.filter((d) => d.nextServiceDate);
  const dueTasks = tasks.filter((t) => t.nextDate);

  const dueByDate = useMemo(() => {
    const map = {};
    dueDevices.forEach((d) => { (map[d.nextServiceDate] = map[d.nextServiceDate] || []).push(d); });
    return map;
  }, [dueDevices]);

  const taskDueByDate = useMemo(() => {
    const map = {};
    dueTasks.forEach((t) => { (map[t.nextDate] = map[t.nextDate] || []).push(t); });
    return map;
  }, [dueTasks]);

  const doneByDate = useMemo(() => {
    const map = {};
    services.filter((s) => s.date).forEach((s) => { (map[s.date] = map[s.date] || []).push(s); });
    return map;
  }, [services]);

  if (devices.length === 0) {
    return <EmptyState icon={Calendar} title="Nothing scheduled" body="Add services with a repeat schedule to see their next due dates here." />;
  }

  function goMonth(delta) {
    let m = cursorMonth + delta, y = cursorYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setCursorMonth(m); setCursorYear(y); setSelectedDate(null);
  }

  const grid = getMonthGrid(cursorYear, cursorMonth);
  const monthDue = dueDevices
    .filter((d) => { const dt = new Date(d.nextServiceDate + "T00:00:00"); return dt.getFullYear() === cursorYear && dt.getMonth() === cursorMonth; })
    .sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate));
  const monthTasks = dueTasks
    .filter((t) => { const dt = new Date(t.nextDate + "T00:00:00"); return dt.getFullYear() === cursorYear && dt.getMonth() === cursorMonth; })
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const monthDone = services
    .filter((s) => { if (!s.date) return false; const dt = new Date(s.date + "T00:00:00"); return dt.getFullYear() === cursorYear && dt.getMonth() === cursorMonth; })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <ToggleButton active={view === "month"} onClick={() => setView("month")}>Month</ToggleButton>
        <ToggleButton active={view === "year"} onClick={() => setView("year")}>Year</ToggleButton>
        <ToggleButton active={view === "capacity"} onClick={() => setView("capacity")}>Capacity</ToggleButton>
        {ACTIVE_CAN_EDIT && <button onClick={() => setShowBlackouts(true)} title="Holidays & blackouts" style={{ display: "flex", alignItems: "center", gap: 5, background: blackouts.length ? "#FDF1E0" : "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 650, color: blackouts.length ? "#8A5A0B" : "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Blackouts{blackouts.length ? ` (${blackouts.length})` : ""}</button>}
        <button onClick={() => { const n = downloadIcs(devices, tasks, visitBudgets, suppliers, locationName); setIcsMsg(n ? `${n} visits exported — open the file to add them to your calendar` : "Nothing scheduled in the next 12 months"); }} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>
          <Calendar size={13} /> Add to calendar
        </button>
      </div>
      {icsMsg && <div style={{ fontSize: 11.5, color: "#2F6B4A", marginBottom: 8 }}>{icsMsg}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {Object.entries(CATEGORY_META).map(([key, m]) => (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#5B6672", fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} /> {m.label}
          </span>
        ))}
        <span style={{ display: "flex", gap: 10, marginLeft: "auto", fontSize: 10.5, color: "#A3ABB4" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, border: "1.5px solid #8A94A0" }} /> due</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#8A94A0" }} /> done</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 15, height: 15, borderRadius: 8, background: "#1B2430", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>3</span> count</span>
        </span>
      </div>

      {moving && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#2B4562", color: "#fff", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 650 }}>Tap a day to move {moving.name}{moving.from ? ` (due ${fmtDate(moving.from)})` : ""}</span>
          <button onClick={() => setMoving(null)} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}
      {view === "capacity" ? (
        <CapacityView devices={devices} tasks={tasks} visitBudgets={visitBudgets} suppliers={suppliers} services={services} />
      ) : view === "month" ? (
        <>
          <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button onClick={() => goMonth(-1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronLeft size={15} color="#5B6672" /></button>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{new Date(cursorYear, cursorMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
              <button onClick={() => goMonth(1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronRight size={15} color="#5B6672" /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
              {WEEKDAY_LABELS.map((w) => <div key={w} style={{ fontSize: 10, fontWeight: 700, color: "#A3ABB4", textAlign: "center" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {grid.map((dt, i) => {
                if (!dt) return <div key={i} />;
                const iso = toISODate(dt);
                const due = dueByDate[iso] || [];
                const done = doneByDate[iso] || [];
                const dueTasksToday = taskDueByDate[iso] || [];
                const isToday = iso === toISODate(today);
                const totalCount = due.length + done.length + dueTasksToday.length;
                const hasItems = totalCount > 0;
                const dueCats = new Set([
                  ...due.map((d) => d.serviceCategory || "maintenance"),
                  ...dueTasksToday.map((t) => deviceById[t.deviceId]?.serviceCategory || "maintenance"),
                ]);
                const doneCats = new Set(done.map((s) => deviceById[s.deviceId]?.serviceCategory || "maintenance"));
                const allCats = [...new Set([...dueCats, ...doneCats])];
                const singleColor = allCats.length === 1 ? CATEGORY_META[allCats[0]].color : null;
                return (
                  <button key={i} onClick={() => moving ? doMove(moving, iso) : hasItems && setSelectedDate(iso)}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOn(e, iso)}
                    title={inBlackout(iso, blackouts) ? `Blackout: ${inBlackout(iso, blackouts).name}` : undefined} style={{
                    position: "relative", aspectRatio: "1", borderRadius: 9,
                    border: isToday ? "1.5px solid #D97706" : moving ? "1px dashed #2B4562" : hasItems ? `1px solid ${singleColor ? singleColor + "55" : "#E1E4E8"}` : "1px solid #F1F2F4",
                    background: singleColor ? `${singleColor}17` : inBlackout(iso, blackouts) ? "repeating-linear-gradient(45deg,#EEF0F2,#EEF0F2 4px,#fff 4px,#fff 8px)" : "#fff",
                    cursor: hasItems || moving ? "pointer" : "default", padding: 3, overflow: "hidden",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontFamily: "inherit",
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: isToday ? 800 : 600, color: "#1B2430" }}>{dt.getDate()}</span>
                    {hasItems && (
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
                        {allCats.slice(0, 3).map((cat) => {
                          const meta = CATEGORY_META[cat];
                          const isDone = doneCats.has(cat);
                          return (
                            <span key={cat} style={{
                              width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                              background: isDone ? meta.color : "transparent",
                              border: `1.5px solid ${meta.color}`,
                            }} />
                          );
                        })}
                      </div>
                    )}
                    {totalCount > 1 && (
                      <span style={{
                        position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8, background: "#1B2430",
                        color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                      }}>{totalCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Due this month ({monthDue.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {monthDue.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due.</div>}
              {monthDue.map((d) => <DueRow key={d.id} device={d} onLogService={onLogService} onMove={ACTIVE_CAN_EDIT ? () => setMoving({ kind: "device", id: d.id, name: d.name, from: d.nextServiceDate }) : undefined} />)}
            </div>

            {tasks.length > 0 && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", margin: "16px 0 8px" }}>Tasks due this month ({monthTasks.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {monthTasks.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due.</div>}
                  {monthTasks.map((t) => <TaskDueRow key={t.id} task={t} device={deviceById[t.deviceId]} onMarkDone={onMarkTaskDone} onMove={ACTIVE_CAN_EDIT ? () => setMoving({ kind: "task", id: t.id, name: t.name, from: t.nextDate }) : undefined} />)}
                </div>
              </>
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", margin: "16px 0 8px" }}>Completed this month ({monthDone.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {monthDone.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing logged.</div>}
              {monthDone.map((s) => (
                <CompletedRow key={s.id} service={s} device={deviceById[s.deviceId]} onEdit={onEditService} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <YearCalendar year={cursorYear} dueByDate={dueByDate} doneByDate={doneByDate} deviceById={deviceById} onYearChange={setCursorYear}
          onOpenMonth={(m) => { setCursorMonth(m); setView("month"); setSelectedDate(null); }} />
      )}

      {selectedDate && (
        <DayDetailModal date={selectedDate} due={dueByDate[selectedDate] || []} done={doneByDate[selectedDate] || []}
          dueTasks={taskDueByDate[selectedDate] || []} deviceById={deviceById} onClose={() => setSelectedDate(null)}
          onLogService={(id) => { setSelectedDate(null); onLogService(id); }}
          onEditService={(record) => { setSelectedDate(null); onEditService(record); }}
          onMarkTaskDone={(id) => { setSelectedDate(null); onMarkTaskDone(id); }}
          onMove={ACTIVE_CAN_EDIT ? (item) => { setSelectedDate(null); setMoving(item); } : undefined} />
      )}
      {showBlackouts && <BlackoutsModal blackouts={blackouts} avoidWeekends={avoidWeekends} onClose={() => setShowBlackouts(false)} onSave={onSaveBlackouts} onShift={onShiftOutOfBlackouts} />}
    </div>
  );
}

export function DayDetailModal({ date, due, done, dueTasks, deviceById, onClose, onLogService, onEditService, onMarkTaskDone, onMove }) {
  return (
    <Modal title={fmtDate(date)} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Due ({due.length})</div>
          {due.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due today.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {due.map((d) => <DueRow key={d.id} device={d} onLogService={onLogService} onMove={onMove ? () => onMove({ kind: "device", id: d.id, name: d.name, from: d.nextServiceDate }) : undefined} />)}
            </div>
          )}
        </div>
        {dueTasks && dueTasks.length > 0 && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Tasks due ({dueTasks.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dueTasks.map((t) => <TaskDueRow key={t.id} task={t} device={deviceById[t.deviceId]} onMarkDone={onMarkTaskDone} onMove={onMove ? () => onMove({ kind: "task", id: t.id, name: t.name, from: t.nextDate }) : undefined} />)}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Completed ({done.length})</div>
          {done.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing logged today.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {done.map((s) => <CompletedRow key={s.id} service={s} device={deviceById[s.deviceId]} onEdit={onEditService} />)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function TaskDueRow({ task, device, onMarkDone, onMove }) {
  const status = dueStatus(task.nextDate);
  const catColor = (CATEGORY_META[device?.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <div draggable={!!onMove} onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "task", id: task.id, name: task.name, from: task.nextDate })); }} style={{ cursor: onMove ? "grab" : "default", background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <StatusDot tone={status.tone} />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{task.name}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{device ? device.name : "Unknown service"}</div>
        </div>
      </div>
      {onMove && <button onClick={onMove} title="Reschedule" style={{ background: "none", border: "1px solid #D7DCE1", borderRadius: 8, padding: "5px 8px", fontSize: 11.5, fontWeight: 600, color: "#5B6672", cursor: "pointer", fontFamily: "inherit", marginRight: 6, whiteSpace: "nowrap" }}>Move</button>}
      {ACTIVE_CAN_EDIT && (
        <button onClick={() => onMarkDone(task.id)} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Mark done</button>
      )}
    </div>
  );
}

export function DueRow({ device, onLogService, onMove }) {
  const status = dueStatus(device.nextServiceDate);
  const catColor = (CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <div draggable={!!onMove} onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "device", id: device.id, name: device.name, from: device.nextServiceDate })); }} style={{ cursor: onMove ? "grab" : "default", background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <StatusDot tone={status.tone} />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{device.name}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0", display: "flex", alignItems: "center", gap: 5 }}>
            <CategoryBadge category={device.serviceCategory} />
          </div>
        </div>
      </div>
      {onMove && <button onClick={onMove} title="Reschedule" style={{ background: "none", border: "1px solid #D7DCE1", borderRadius: 8, padding: "5px 8px", fontSize: 11.5, fontWeight: 600, color: "#5B6672", cursor: "pointer", fontFamily: "inherit", marginRight: 6, whiteSpace: "nowrap" }}>Move</button>}
      {ACTIVE_CAN_EDIT && (
        <button onClick={() => onLogService(device.id)} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Log</button>
      )}
    </div>
  );
}

export function CompletedRow({ service, device, onEdit }) {
  const catColor = (CATEGORY_META[device?.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <button onClick={() => onEdit(service)} style={{
      background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex",
      alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <CheckCircle2 size={16} color="#2F855A" />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{service.name || (device ? device.name : "Service")}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{device ? device.name : "Unknown service"}{service.cost ? ` · ${gbp(service.cost)}` : ""}</div>
        </div>
      </div>
      <ChevronRight size={15} color="#C0C6CC" />
    </button>
  );
}

export function YearCalendar({ year, dueByDate, doneByDate, deviceById, onYearChange, onOpenMonth }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => onYearChange(year - 1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronLeft size={15} color="#5B6672" /></button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{year}</span>
        <button onClick={() => onYearChange(year + 1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronRight size={15} color="#5B6672" /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {MONTH_LABELS.map((label, m) => {
          const dueCounts = emptyCatMap();
          Object.entries(dueByDate).forEach(([iso, list]) => {
            const dt = new Date(iso + "T00:00:00");
            if (dt.getFullYear() === year && dt.getMonth() === m) list.forEach((d) => { dueCounts[d.serviceCategory || "maintenance"] += 1; });
          });
          let doneCount = 0;
          Object.entries(doneByDate).forEach(([iso, list]) => {
            const dt = new Date(iso + "T00:00:00");
            if (dt.getFullYear() === year && dt.getMonth() === m) doneCount += list.length;
          });
          const dueTotal = dueCounts.cleaning + dueCounts.maintenance + dueCounts.catering;
          return (
            <button key={label} onClick={() => onOpenMonth(m)} style={{
              background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: 10, cursor: "pointer",
              textAlign: "left", fontFamily: "inherit",
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{label}</div>
              {dueTotal === 0 && doneCount === 0 ? (
                <div style={{ fontSize: 11, color: "#C0C6CC" }}>Nothing</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {Object.entries(dueCounts).filter(([, c]) => c > 0).map(([cat, c]) => (
                    <span key={cat} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#5B6672" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", border: `1.3px solid ${CATEGORY_META[cat].color}` }} /> {c} due ({CATEGORY_META[cat].label.toLowerCase()})
                    </span>
                  ))}
                  {doneCount > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#5B6672" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8A94A0" }} /> {doneCount} completed
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CapacityView({ devices, tasks, visitBudgets, suppliers, services }) {
  const [limit, setLimit] = useState(5);
  const [openCell, setOpenCell] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, i * 7));
  const pastWeeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, (i - 7) * 7));
  const supMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const devMap = Object.fromEntries(devices.map((d) => [d.id, d]));
  const items = [];
  devices.forEach((d) => {
    const dates = new Set(visitBudgets.filter((v) => v.deviceId === d.id && v.date >= thisWeek).map((v) => v.date));
    if (d.nextServiceDate) dates.add(d.nextServiceDate);
    dates.forEach((date) => items.push({ date: date < thisWeek ? thisWeek : date, overdue: date < today, label: d.name, sup: d.supplierId || "__none" }));
  });
  tasks.forEach((t) => { if (t.nextDate) items.push({ date: t.nextDate < thisWeek ? thisWeek : t.nextDate, overdue: t.nextDate < today, label: `${t.name} (task)`, sup: devMap[t.deviceId]?.supplierId || "__none" }); });
  const grid = {};
  items.forEach((it) => { const w = weekStart(it.date); if (!weeks.includes(w)) return; const k = `${it.sup}|${w}`; (grid[k] = grid[k] || []).push(it); });
  const rows = [...new Set(items.map((i) => i.sup))].sort((a, b) => (a === "__none") - (b === "__none") || (supMap[a]?.name || "").localeCompare(supMap[b]?.name || ""));
  const techGrid = {}; const techs = new Set();
  services.forEach((v) => { if (!v.date) return; const w = weekStart(v.date); if (!pastWeeks.includes(w)) return; const t = (v.technician || "").trim() || "Not recorded"; techs.add(t); techGrid[`${t}|${w}`] = (techGrid[`${t}|${w}`] || 0) + 1; });
  const wk = (w) => { const d = new Date(w + "T00:00:00"); return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`; };
  const cellStyle = (n, over) => ({ textAlign: "center", fontSize: 12, fontWeight: 700, padding: "6px 2px", borderRadius: 6, cursor: n ? "pointer" : "default", border: "none", fontFamily: "inherit", width: "100%",
    background: !n ? "#F7F8F9" : over ? "#FBEAEA" : `rgba(43,69,98,${Math.min(0.12 + n * 0.1, 0.55)})`, color: !n ? "#C0C6CC" : over ? "#C53030" : n >= 3 ? "#fff" : "#1B2430" });
  const open = openCell ? grid[openCell] || [] : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Planned visits per supplier — next 8 weeks</div>
          <label style={{ fontSize: 11, color: "#5B6672", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>Flag over
            <input type="number" min="1" value={limit} onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))} style={{ width: 38, padding: "2px 4px", border: "1px solid #D7DCE1", borderRadius: 5, fontSize: 11 }} /> /wk</label>
        </div>
        {rows.length === 0 ? <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing planned in the next 8 weeks.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 3, width: "100%", minWidth: 420 }}>
              <thead><tr><th style={{ textAlign: "left", fontSize: 10.5, color: "#8A94A0" }}>Supplier</th>{weeks.map((w) => <th key={w} style={{ fontSize: 10, color: "#8A94A0", fontWeight: 600, whiteSpace: "nowrap" }}>{wk(w)}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r}>
                  <td style={{ fontSize: 12, fontWeight: 650, whiteSpace: "nowrap", paddingRight: 6 }}>{r === "__none" ? "No supplier" : supMap[r]?.name || "Unknown"}</td>
                  {weeks.map((w) => { const k = `${r}|${w}`; const n = (grid[k] || []).length; return <td key={w}><button onClick={() => n && setOpenCell(openCell === k ? null : k)} style={{ ...cellStyle(n, n > limit), outline: openCell === k ? "2px solid #D97706" : "none" }}>{n || "·"}</button></td>; })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {openCell && (
          <div style={{ marginTop: 8, background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5B6672", marginBottom: 4 }}>{openCell.split("|")[0] === "__none" ? "No supplier" : supMap[openCell.split("|")[0]]?.name} · week of {wk(openCell.split("|")[1])}</div>
            {open.sort((a, b) => a.date.localeCompare(b.date)).map((it, i) => <div key={i} style={{ fontSize: 12, color: it.overdue ? "#C53030" : "#1B2430" }}>{it.overdue ? "Overdue — " : `${fmtDate(it.date)} · `}{it.label}</div>)}
          </div>
        )}
        <div style={{ fontSize: 10.5, color: "#A3ABB4", marginTop: 8 }}>Counts each service's planned dates and recurring tasks by its default supplier. Overdue items are counted in the current week. Use Month view → Move to spread out busy weeks.</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Technician workload — visits logged, last 8 weeks</div>
        {techs.size === 0 ? <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>No visits logged in the last 8 weeks.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 3, width: "100%", minWidth: 420 }}>
              <thead><tr><th style={{ textAlign: "left", fontSize: 10.5, color: "#8A94A0" }}>Technician</th>{pastWeeks.map((w) => <th key={w} style={{ fontSize: 10, color: "#8A94A0", fontWeight: 600, whiteSpace: "nowrap" }}>{wk(w)}</th>)}</tr></thead>
              <tbody>{[...techs].sort().map((t) => (
                <tr key={t}><td style={{ fontSize: 12, fontWeight: 650, whiteSpace: "nowrap", paddingRight: 6 }}>{t}</td>
                  {pastWeeks.map((w) => { const n = techGrid[`${t}|${w}`] || 0; return <td key={w}><div style={cellStyle(n, false)}>{n || "·"}</div></td>; })}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Holidays & blackout periods
--------------------------------------------------------- */
export function BlackoutsModal({ blackouts, avoidWeekends, onClose, onSave, onShift }) {
  const [list, setList] = useState(blackouts);
  const [weekends, setWeekends] = useState(avoidWeekends);
  const [name, setName] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [msg, setMsg] = useState("");
  const yr = new Date().getFullYear();
  const presets = [
    { name: `Christmas shutdown ${yr}`, start: `${yr}-12-24`, end: `${yr + 1}-01-01` },
    { name: `Summer bank holiday ${yr + 1}`, start: `${yr + 1}-08-31`, end: `${yr + 1}-08-31` },
  ];
  function add(b) {
    if (!b.name.trim() || !b.start) return;
    const e = b.end && b.end >= b.start ? b.end : b.start;
    const next = [...list, { id: uid(), name: b.name.trim(), start: b.start, end: e }].sort((a, c) => a.start.localeCompare(c.start));
    setList(next); onSave(next, weekends); setName(""); setStart(""); setEnd(""); setMsg("");
  }
  return (
    <Modal title="Holidays & blackout periods" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>No visits are scheduled inside these dates at this location. New schedules and repeat visits automatically move to the next available day.</div>
        {list.length === 0 ? <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>No blackout periods yet.</div> : list.map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 650 }}>{b.name}</div><div style={{ fontSize: 11.5, color: "#8A94A0" }}>{fmtDate(b.start)}{b.end !== b.start ? ` – ${fmtDate(b.end)}` : ""}</div></div>
            <button onClick={() => { const next = list.filter((x) => x.id !== b.id); setList(next); onSave(next, weekends); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#A3ABB4" /></button>
          </div>
        ))}
        <div style={{ border: "1px solid #E1E4E8", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Office closure" />
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="From"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="To"><TextInput type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <PrimaryButton onClick={() => add({ name, start, end })}><Plus size={15} /> Add blackout</PrimaryButton>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {UK_BANK_HOLIDAYS.some(([d]) => d >= new Date().toISOString().slice(0, 10) && !list.some((b) => b.start === d)) && (
              <button onClick={() => { const next = [...list, ...UK_BANK_HOLIDAYS.filter(([d]) => d >= new Date().toISOString().slice(0, 10) && !list.some((b) => b.start === d)).map(([d, n]) => ({ id: uid(), name: n, start: d, end: d }))].sort((a, c) => a.start.localeCompare(c.start)); setList(next); onSave(next, weekends); setMsg("UK bank holidays added — visits will avoid them."); }} style={{ background: "#EAF1F8", color: "#2B4562", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ All UK bank holidays (to end of 2027)</button>
            )}
            {presets.filter((p) => !list.some((b) => b.name === p.name)).map((p) => <button key={p.name} onClick={() => add(p)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>+ {p.name}</button>)}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={weekends} onChange={(e) => { setWeekends(e.target.checked); onSave(list, e.target.checked); }} /> Also avoid weekends (move Sat/Sun to Monday)
        </label>
        <button onClick={() => { const n = onShift(); setMsg(n ? `Moved ${n} planned date${n === 1 ? "" : "s"} out of blackouts${weekends ? " and weekends" : ""}.` : "Nothing needed moving."); }} style={{ background: "#FDF1E0", border: "1px solid #E6D9BC", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#8A5A0B", cursor: "pointer", fontFamily: "inherit" }}>
          Move existing planned visits out of these dates
        </button>
        {msg && <div style={{ fontSize: 12, color: "#2F6B4A" }}>{msg}</div>}
      </div>
    </Modal>
  );
}
