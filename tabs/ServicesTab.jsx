// Services list: filters, bulk actions, booking, chase emails, quick log, QR scanner.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowUpDown, BookOpen, Calendar, CalendarCheck, CalendarPlus, Camera, CheckCircle2, CheckSquare, FileSpreadsheet, HardHat, LayoutGrid, List, Loader2, Mail, MapPin, MapPinned, MoreHorizontal, PauseCircle, Pencil, Pin, Printer, QrCode, Search, Send, ShieldAlert, ShieldCheck, Square, Tag, UserCheck, Users as UsersIcon, Wrench } from "lucide-react";
import { Badge, CategoryBadge, ConfirmDeleteButton, CustomFieldInputs, EmptyState, ExportButton, Field, Modal, PrimaryButton, Select, SignOffSection, TextArea, TextInput, ToggleButton } from "../components/ui.jsx";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE, ACTIVE_USERS, CATEGORY_KEYS, CATEGORY_META, siteInfoText } from "../lib/globals.js";
import { buildChaseEmail, printBulkStickers, printStickers } from "../lib/reports.js";
import { addMonths, appBaseUrl, compressImage, currentBooking, daysUntil, downloadBlob, dueStatus, fmtDate, gbp, loadJsQR, missingRequiredFields, qrImageUrl, relativeDays, replacementYear, uid } from "../lib/utils.js";
import { CONDITION_GRADES, CRITICALITY } from "../lib/constants.js";
import { buildStyledSheet, excelColour, xlsxBlob } from "../lib/excelTemplate.js";

/* ---------------------------------------------------------
   Devices Tab
--------------------------------------------------------- */
export function DevicesTab({ onBookTogether, history = [], onRemindAll, onChaseAll, allSupplierList = [], locationName = "", pinned = [], onTogglePin, onDataHealth, onLibrary, faultsByDevice = {}, onImport, allLocations = [], onCopyTo, onBulkUpdate, allSuppliers = [], archivedDevices = [], onRestore, onBulkLog, onBook, prefs = { dueFilter: "todo", sortBy: "due", cat: "all" }, onPrefs = () => {}, devices, search, setSearch, onAdd, onEdit, onLogService, onAddWork, onDelete, onHistory, searchAllLocations, onToggleSearchAll, locationLabel, chaseDevices = [], supplierById = {}, onChased, currentUserName, onQuickLog, onScan }) {
  const [chaseFocus, setChaseFocus] = useState(null); // null = closed, "all" or a deviceId
  const overdueList = chaseDevices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; });
  const [qrFor, setQrFor] = useState(null);
  const dueFilter = prefs.dueFilter || "todo"; // 'todo' | 'overdue' | 'month' | 'done' | 'all'
  const setDueFilter = (v) => onPrefs({ dueFilter: v });
  const sortBy = prefs.sortBy || "due";
  const catFilter = prefs.cat || "all";
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMore, setBulkMore] = useState(false);
  const [chaseAllOpen, setChaseAllOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [bookFor, setBookFor] = useState(null);
  const toggleSel = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const catsPresent = CATEGORY_KEYS.filter((k) => devices.some((d) => (d.serviceCategory || "maintenance") === k));
  const nowD = new Date();
  const isFinished = (d) => !d.nextServiceDate && !!d.lastServiceDate; // one-off, nothing left to schedule
  const doneThisMonth = (d) => {
    if (!d.lastServiceDate) return false;
    const dt = new Date(d.lastServiceDate + "T00:00:00");
    return dt.getFullYear() === nowD.getFullYear() && dt.getMonth() === nowD.getMonth();
  };
  // A recurring service counts as done once this month's visit is logged; it drops off
  // "To do" and reappears there automatically when the next month starts.
  const isDone = (d) => isFinished(d) || doneThisMonth(d);
  const byDue = (a, b) => (a.nextServiceDate || "9999").localeCompare(b.nextServiceDate || "9999");
  const sorters = {
    due: byDue,
    name: (a, b) => a.name.localeCompare(b.name),
    category: (a, b) => (CATEGORY_META[a.serviceCategory]?.label || "").localeCompare(CATEGORY_META[b.serviceCategory]?.label || "") || a.name.localeCompare(b.name),
    supplier: (a, b) => (supplierById[a.supplierId]?.name || "~").localeCompare(supplierById[b.supplierId]?.name || "~") || byDue(a, b),
    area: (a, b) => (a.area || "~").localeCompare(b.area || "~") || a.name.localeCompare(b.name),
    criticality: (a, b) => ((CRITICALITY[a.criticality || "normal"]?.rank ?? 2) - (CRITICALITY[b.criticality || "normal"]?.rank ?? 2)) || byDue(a, b),
    condition: (a, b) => (b.condition || "").localeCompare(a.condition || "") || byDue(a, b),
  };
  const mineOnly = !!prefs.mine;
  const groupBy = prefs.groupBy || "none";
  const compact = !!prefs.compact;
  const lastVisitOf = (id) => history.filter((v) => v.deviceId === id && !v.aborted && !v.skipped).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const groupOf = (d) => groupBy === "area" ? (d.area || "No area") : groupBy === "category" ? (CATEGORY_META[d.serviceCategory]?.label || "Other") : groupBy === "supplier" ? (supplierById[d.supplierId]?.name || "No supplier") : "";
  const tagFilter = prefs.tag || "";
  const allTags = [...new Set(devices.flatMap((d) => d.tags || []))].sort();
  const filteredDevices = (dueFilter === "archived" ? archivedDevices : devices).filter((d) => !mineOnly || d.assignee === currentUserName).filter((d) => !tagFilter || (d.tags || []).includes(tagFilter)).filter((d) => catFilter === "all" || (d.serviceCategory || "maintenance") === catFilter).filter((d) => {
    if (dueFilter === "all" || dueFilter === "archived") return true;
    if (dueFilter === "done") return isDone(d);
    if (dueFilter === "todo") return !isDone(d);
    const days = daysUntil(d.nextServiceDate);
    if (dueFilter === "overdue") return days !== null && days < 0;
    if (dueFilter === "month") {
      if (!d.nextServiceDate || doneThisMonth(d)) return false;
      const dt = new Date(d.nextServiceDate + "T00:00:00");
      return dt.getFullYear() === nowD.getFullYear() && dt.getMonth() === nowD.getMonth();
    }
    return true;
  }).sort(sorters[sortBy] || byDue);
  return (
    <div>
      {(onQuickLog || onScan) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {ACTIVE_CAN_EDIT && onQuickLog && (
            <button onClick={onQuickLog} style={{ flex: 2, minHeight: 50, background: "#D97706", color: "var(--on-accent)", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 750, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Camera size={18} /> Quick log visit
            </button>
          )}
          {onScan && (
            <button onClick={onScan} style={{ flex: 1, minHeight: 50, background: "var(--head)", color: "var(--on-accent)", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <QrCode size={18} /> Scan
            </button>
          )}
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={16} color="#8A94A0" style={{ position: "absolute", left: 11, top: 11 }} />
        <TextInput placeholder="Search services, tags, categories…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", paddingLeft: 34 }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, cursor: "pointer", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
        <input type="checkbox" checked={searchAllLocations} onChange={(e) => onToggleSearchAll(e.target.checked)} style={{ margin: 0 }} />
        Search all locations
      </label>
      {overdueList.length > 0 && (
        <button onClick={() => setChaseFocus("all")} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, background: "var(--danger-soft)", border: "1px solid #F3C6C6",
          borderRadius: 10, padding: "10px 12px", marginBottom: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
          <ShieldAlert size={16} color="#C53030" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--danger)", fontWeight: 650 }}>
            {overdueList.length} job{overdueList.length === 1 ? "" : "s"} not completed on time — tap to chase suppliers
          </span>
          <Mail size={15} color="#9B2C2C" />
        </button>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <ToggleButton active={dueFilter === "todo"} onClick={() => setDueFilter("todo")}>To do ({devices.filter((d) => !isDone(d)).length})</ToggleButton>
        <ToggleButton active={dueFilter === "overdue"} onClick={() => setDueFilter("overdue")}>Overdue</ToggleButton>
        <ToggleButton active={dueFilter === "month"} onClick={() => setDueFilter("month")}>Due this month</ToggleButton>
        <ToggleButton active={dueFilter === "done"} onClick={() => setDueFilter("done")}>Done ({devices.filter(isDone).length})</ToggleButton>
        <ToggleButton active={dueFilter === "all"} onClick={() => setDueFilter("all")}>All</ToggleButton>
        {ACTIVE_USERS.length > 1 && devices.some((d) => d.assignee) && <ToggleButton active={mineOnly} onClick={() => onPrefs({ mine: !mineOnly })}>Mine</ToggleButton>}
        {archivedDevices.length > 0 && <ToggleButton active={dueFilter === "archived"} onClick={() => setDueFilter("archived")}>Archived ({archivedDevices.length})</ToggleButton>}
        {ACTIVE_CAN_EDIT && onBulkLog && dueFilter !== "archived" && (
          <ToggleButton active={selecting} onClick={() => { setSelecting((v) => !v); setSelected([]); }}>{selecting ? "Cancel select" : "Select…"}</ToggleButton>
        )}
      </div>
      {ACTIVE_CAN_EDIT && onBookTogether && dueFilter !== "archived" && (() => { const g = {}; devices.forEach((d) => { const n = daysUntil(d.nextServiceDate); if (d.supplierId && n !== null && n <= 45 && !currentBooking(d)) g[d.supplierId] = (g[d.supplierId] || 0) + 1; }); return Object.values(g).some((n) => n >= 2) ? (
        <button onClick={onBookTogether} style={{ width: "100%", marginTop: -6, marginBottom: 10, background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <CalendarCheck size={14} /> Book a supplier's due visits together on one day
        </button>
      ) : null; })()}
      {ACTIVE_CAN_EDIT && onChaseAll && (() => { const od = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0 && d.supplierId; }); return od.length > 1 ? (
        <button onClick={() => setChaseAllOpen(true)} style={{ width: "100%", marginTop: -6, marginBottom: 10, background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Mail size={14} /> Chase all {od.length} overdue — one email per supplier
        </button>
      ) : null; })()}
      {ACTIVE_CAN_EDIT && onRemindAll && dueFilter !== "archived" && devices.some((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 14 && d.supplierId; }) && (
        <button onClick={() => setRemindOpen(true)} style={{ width: "100%", marginTop: -4, marginBottom: 10, background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Send size={14} /> Remind suppliers of visits due in the next 14 days
        </button>
      )}
      {remindOpen && <ChaseAllModal mode="remind" devices={devices} suppliers={allSupplierList} locationName={locationName} userName={currentUserName} onClose={() => setRemindOpen(false)} onSent={() => {}} />}
      {chaseAllOpen && <ChaseAllModal devices={devices} suppliers={allSupplierList} locationName={locationName} userName={currentUserName} onClose={() => setChaseAllOpen(false)} onSent={(ids, sid) => onChaseAll(ids, sid)} />}
      <div style={{ display: "flex", gap: 8, marginTop: -6, marginBottom: 14 }}>
        <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "0 8px" }}>
          <ArrowUpDown size={13} color="#8A94A0" />
          <select value={sortBy} onChange={(e) => onPrefs({ sortBy: e.target.value })} style={{ flex: 1, border: "none", background: "none", fontSize: 12.5, padding: "7px 0", fontFamily: "inherit", color: "var(--text)", outline: "none" }}>
            <option value="due">Sort: next due first</option>
            <option value="name">Sort: name A–Z</option>
            <option value="category">Sort: category</option>
            <option value="supplier">Sort: supplier</option>
            <option value="area">Sort: area / room</option>
            <option value="criticality">Sort: most critical first</option>
            <option value="condition">Sort: worst condition first</option>
          </select>
        </label>
        <select value={groupBy} onChange={(e) => onPrefs({ groupBy: e.target.value })} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, background: groupBy !== "none" ? "var(--accent-soft)" : "var(--card)", fontSize: 12.5, padding: "7px 8px", fontFamily: "inherit", color: "var(--text)", outline: "none" }}>
          <option value="none">No grouping</option><option value="area">Group by area</option><option value="category">Group by category</option><option value="supplier">Group by supplier</option>
        </select>
        <button onClick={() => onPrefs({ compact: !compact })} title={compact ? "Card view" : "Compact list"} style={{ border: "1px solid var(--border)", borderRadius: 8, background: compact ? "var(--accent-soft)" : "var(--card)", padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>{compact ? <LayoutGrid size={15} color="var(--text-2)" /> : <List size={15} color="var(--text-2)" />}</button>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={(e) => onPrefs({ tag: e.target.value })} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, background: tagFilter ? "var(--accent-soft)" : "var(--card)", fontSize: 12.5, padding: "7px 8px", fontFamily: "inherit", color: "var(--text)", outline: "none" }}>
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        {catsPresent.length > 1 && (
          <select value={catFilter} onChange={(e) => onPrefs({ cat: e.target.value })} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, background: catFilter === "all" ? "var(--card)" : "var(--accent-soft)", fontSize: 12.5, padding: "7px 8px", fontFamily: "inherit", color: "var(--text)", outline: "none" }}>
            <option value="all">All categories</option>
            {catsPresent.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
          </select>
        )}
      </div>
      {devices.length === 0 ? (
        <EmptyState icon={Wrench} title="No services yet" body="Add the equipment or service you maintain at this location to start its history." actionLabel={ACTIVE_CAN_EDIT ? "Add a service" : undefined} onAction={onAdd} />
      ) : filteredDevices.length === 0 ? (
        <EmptyState icon={Wrench} title={dueFilter === "done" ? "Nothing done this month yet" : dueFilter === "todo" ? "All done for this month" : "Nothing matches this filter"} body={dueFilter === "done" ? "Services show here once this month's visit is logged, plus finished one-off jobs." : dueFilter === "todo" ? "Every service has had its visit logged this month. Tap Done or All to see them." : "Try a different filter or clear it to see everything."} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(groupBy !== "none" ? [...filteredDevices].sort((a, b) => groupOf(a).localeCompare(groupOf(b))) : filteredDevices).map((d, di, arr) => {
            const status = dueStatus(d.nextServiceDate, !!d.lastServiceDate);
            const heading = groupBy !== "none" && (di === 0 || groupOf(arr[di - 1]) !== groupOf(d)) ? <div key={`h-${groupOf(d)}`} style={{ fontSize: 12, fontWeight: 750, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", margin: di ? "10px 0 0" : 0 }}>{groupOf(d)} <span style={{ fontWeight: 600 }}>({arr.filter((x) => groupOf(x) === groupOf(d)).length})</span></div> : null;
            const lv = lastVisitOf(d.id); const lvFails = lv ? (lv.checklistResults || []).filter((r) => r.result === "fail").length : 0;
            if (compact) return (
              <Fragment key={d.id}>{heading}
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
                  {selecting && <button onClick={() => toggleSel(d.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>{selected.includes(d.id) ? <CheckSquare size={18} color="#2B4562" /> : <Square size={18} color="#A3ABB4" />}</button>}
                  <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: status.key === "overdue" ? "var(--danger)" : status.key === "soon" ? "var(--warn)" : "var(--ok)" }} />
                  <button onClick={() => onHistory(d.id)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                    <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{d.nextServiceDate ? `Next ${fmtDate(d.nextServiceDate)}` : "No date"}{d.area ? ` · ${d.area}` : ""}</div>
                  </button>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onLogService(d.id)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Log</button>}
                </div>
              </Fragment>
            );
            return (
              <Fragment key={d.id}>{heading}
              <div style={{ background: "var(--card)", borderRadius: 12, padding: 14, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  {selecting && (
                    <button onClick={() => toggleSel(d.id)} title="Select" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", marginTop: 1 }}>
                      {selected.includes(d.id) ? <CheckSquare size={20} color="#2B4562" /> : <Square size={20} color="#A3ABB4" />}
                    </button>
                  )}
                  {d.photo && <img src={d.photo} alt="" onClick={() => onHistory(d.id)} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)", cursor: "pointer" }} />}
                  <button onClick={() => selecting ? toggleSel(d.id) : onEdit(d)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                    {(d.area || d.assignee) && <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      {d.area && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={11} /> {d.area}</span>}
                      {d.assignee && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: d.assignee === currentUserName ? "#2B6CB0" : "var(--muted)" }}><UserCheck size={11} /> {d.assignee === currentUserName ? "You" : d.assignee}</span>}
                    </div>}
                    {searchAllLocations && (
                      <div style={{ fontSize: 11, color: "#D97706", fontWeight: 650, marginTop: 2 }}>{locationLabel(d)}</div>
                    )}
                    <div style={{ fontSize: 12.5, color: "var(--faint)", display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                      {d.assetTag && <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{d.assetTag}</span>}
                      {d.category && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Tag size={11} />{d.category}</span>}
                      {d.budgetPerVisit ? <span>{gbp(d.budgetPerVisit)}/visit budget</span> : null}
                    </div>
                    {(faultsByDevice[d.id] >= 3 || (d.pausedUntil && d.pausedUntil >= new Date().toISOString().slice(0, 10)) || d.certRequired || d.condition || (d.criticality && d.criticality !== "normal") || d.tags?.length > 0) && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                        {d.pausedUntil && d.pausedUntil >= new Date().toISOString().slice(0, 10) && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", background: "var(--card-hi)", borderRadius: 5, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}><PauseCircle size={10} /> Paused until {fmtDate(d.pausedUntil)}</span>}
                        {faultsByDevice[d.id] >= 3 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 5, padding: "2px 6px" }}>{faultsByDevice[d.id]} faults in 12 mo</span>}
                        {d.criticality && d.criticality !== "normal" && <span style={{ fontSize: 10.5, fontWeight: 700, color: CRITICALITY[d.criticality].color, background: "var(--card)", border: `1px solid ${CRITICALITY[d.criticality].color}`, borderRadius: 5, padding: "1px 6px" }}>{CRITICALITY[d.criticality].label}</span>}
                        {d.condition && <span style={{ fontSize: 10.5, fontWeight: 700, color: CONDITION_GRADES[d.condition].color, background: CONDITION_GRADES[d.condition].bg, borderRadius: 5, padding: "2px 6px" }}>Condition {d.condition}</span>}
                        {(d.tags || []).map((t) => <span key={t} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", background: "var(--card-hi)", borderRadius: 5, padding: "2px 6px" }}>#{t}</span>)}
                        {d.certRequired && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 5, padding: "2px 6px" }}>Certificate required</span>}
                      </div>
                    )}
                    {(d.ramsRequired || d.permits?.length > 0 || (replacementYear(d) && replacementYear(d) <= new Date().getFullYear() + 1)) && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                        {d.ramsRequired && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--warn)", background: "var(--warn-soft)", borderRadius: 5, padding: "2px 6px" }}>RAMS</span>}
                        {(d.permits || []).map((p) => <span key={p} style={{ fontSize: 10.5, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 5, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}><HardHat size={10} /> {p}</span>)}
                        {replacementYear(d) && replacementYear(d) <= new Date().getFullYear() + 1 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#5B21B6", background: "#EFE9FB", borderRadius: 5, padding: "2px 6px" }}>Replace {replacementYear(d)}</span>}
                      </div>
                    )}
                  </button>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setQrFor(d)} title="QR stickers" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <QrCode size={15} color="#8A94A0" />
                    </button>
                    {onTogglePin && <button onClick={() => onTogglePin(d.id)} title={pinned.includes(d.id) ? "Unpin from Home" : "Pin to Home"} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Pin size={14} color={pinned.includes(d.id) ? "#D97706" : "#C0C6CC"} fill={pinned.includes(d.id) ? "#D97706" : "none"} /></button>}
                    {ACTIVE_CAN_EDIT && (
                      <button onClick={() => onEdit(d)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Pencil size={15} color="#8A94A0" />
                      </button>
                    )}
                    <ConfirmDeleteButton onConfirm={() => onDelete(d.id)} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {doneThisMonth(d) && !isFinished(d) ? <Badge tone="ok">✓ Done {fmtDate(d.lastServiceDate)}</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
                    <CategoryBadge category={d.serviceCategory} subCategory={d.subCategory} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--faint)", display: "flex", alignItems: "center", gap: 8 }}>
                    {lv && <span style={{ color: lvFails ? "var(--danger)" : "var(--ok)", fontWeight: 650 }}>{lvFails ? `✗ ${lvFails} failed` : "✓ checks passed"} {fmtDate(lv.date)}{lv.verifiedBy ? " · verified" : ""}</span>}
                    {d.archived ? <span>Archived {d.archivedAt ? fmtDate(d.archivedAt.slice(0, 10)) : ""}</span> : <>Next: {fmtDate(d.nextServiceDate)}</>}
                    {!d.archived && d.nextServiceDate && onBook && ACTIVE_CAN_EDIT && (() => {
                      const b = currentBooking(d); const n = daysUntil(d.nextServiceDate);
                      if (!b && (n === null || n > 30)) return null;
                      const style = b ? (b.status === "confirmed" ? { bg: "#EAF4EE", fg: "#2F6B4A" } : { bg: "#EAF1F8", fg: "#2B4562" }) : { bg: "#EEF0F2", fg: "#5B6672" };
                      return (
                        <button onClick={() => setBookFor(d)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: style.bg, color: style.fg, border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          <CalendarCheck size={11} /> {b ? `${b.status === "confirmed" ? "Confirmed" : "Booked"}${b.date ? ` ${fmtDate(b.date)}` : ""}${b.time ? ` ${b.time}` : ""}` : "Not booked"}
                        </button>
                      );
                    })()}
                    {daysUntil(d.nextServiceDate) !== null && daysUntil(d.nextServiceDate) < 0 && (
                      <button onClick={() => setChaseFocus(d.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#C53030", color: "var(--on-accent)", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        <Mail size={11} /> Chase
                      </button>
                    )}
                  </span>
                </div>
                {d.chaseLog && d.chaseLog.length > 0 && daysUntil(d.nextServiceDate) !== null && daysUntil(d.nextServiceDate) < 0 && (
                  <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>
                    Chased {d.chaseLog.length}× · last {relativeDays(d.chaseLog[d.chaseLog.length - 1].at)} by {d.chaseLog[d.chaseLog.length - 1].by}
                  </div>
                )}
                {d.archived ? (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onRestore?.(d.id)} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><ArchiveRestore size={13} /> Restore</button>}
                  <button onClick={() => onHistory(d.id)} style={{ flex: 1, background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>History</button>
                </div>
                ) : selecting ? null : (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onLogService(d.id)} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Log visit</button>}
                  <button onClick={() => onHistory(d.id)} style={{ flex: 1, background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>History</button>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onAddWork(d.id)} style={{ flex: 1, background: "#F5F1E8", color: "var(--warn)", border: "1px solid #E6D9BC", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Extra work</button>}
                </div>
                )}
              </div>
              </Fragment>
            );
          })}
        </div>
      )}
      {chaseFocus && (
        <ChaseModal devices={chaseFocus === "all" ? overdueList : overdueList.filter((d) => d.id === chaseFocus || (d.supplierId && d.supplierId === (chaseDevices.find((x) => x.id === chaseFocus)?.supplierId)))}
          supplierById={supplierById} locationLabel={locationLabel} currentUserName={currentUserName}
          onChased={onChased} onClose={() => setChaseFocus(null)} />
      )}
      {selecting && (
        <div style={{ position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", width: "min(420px, calc(100vw - 32px))", background: "var(--head)", borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 8, zIndex: 40, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 650, flex: 1, paddingLeft: 4 }}>{selected.length} selected</span>
          <button onClick={() => setSelected(selected.length === filteredDevices.length ? [] : filteredDevices.map((d) => d.id))} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{selected.length === filteredDevices.length ? "None" : "All"}</button>
          {onBulkUpdate && <button disabled={!selected.length} onClick={() => setBulkMore(true)} title="More actions" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 9px", cursor: selected.length ? "pointer" : "default", display: "flex" }}><MoreHorizontal size={16} /></button>}
          <button disabled={!selected.length} onClick={() => setBulkOpen(true)} style={{ background: selected.length ? "#D97706" : "#5B6672", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: selected.length ? "pointer" : "default", fontFamily: "inherit" }}>Log visits</button>
        </div>
      )}
      {bulkOpen && (
        <BulkLogModal devices={[...devices, ...archivedDevices].filter((d) => selected.includes(d.id))} defaultTech={currentUserName || ""} onClose={() => setBulkOpen(false)}
          onSave={(opts) => { onBulkLog(selected, opts); setBulkOpen(false); setSelecting(false); setSelected([]); }} />
      )}
      {ACTIVE_CAN_EDIT && onImport && dueFilter !== "archived" && (
        <button onClick={onImport} style={{ width: "100%", marginTop: 14, background: "none", border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <FileSpreadsheet size={14} /> Import services from a spreadsheet
        </button>
      )}
      {ACTIVE_CAN_EDIT && onLibrary && dueFilter !== "archived" && (
        <button onClick={onLibrary} style={{ width: "100%", marginTop: 8, background: "none", border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <BookOpen size={14} /> Add several from the service library
        </button>
      )}
      {devices.length > 0 && dueFilter !== "archived" && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <button onClick={async () => { const rows = devices.map((d) => [d.name, CATEGORY_META[d.serviceCategory]?.label || "", d.area || "", supplierById[d.supplierId]?.name || "", Number(d.serviceIntervalMonths) || null, d.lastServiceDate ? new Date(d.lastServiceDate + "T00:00:00") : null, d.nextServiceDate ? new Date(d.nextServiceDate + "T00:00:00") : null, Number(d.budgetPerVisit) || null, CRITICALITY[d.criticality || "normal"]?.label || "", d.condition || "", d.assetTag || "", d.manufacturer || "", d.model || "", d.serialNumber || ""]);
            const buf = await buildStyledSheet({ title: "Services register", subtitle: `${locationName} · ${new Date().toLocaleDateString("en-GB")} · ${devices.length} services`, sheetName: "Services", headers: ["Service", "Category", "Area / room", "Supplier", "Interval (months)", "Last visit", "Next due", "Budget per visit", "Criticality", "Condition", "Asset tag", "Make", "Model", "Serial"], rows, widths: [34, 16, 18, 24, 12, 13, 13, 14, 12, 10, 12, 14, 14, 16], numFmts: { 5: "dd/mm/yyyy", 6: "dd/mm/yyyy", 7: "£#,##0.00" },
              cellStyle: (c, v, ri, ci) => { if (ci === 6 && v instanceof Date && v < new Date()) excelColour(c, "FBEAEA", "C53030"); if (ci === 8 && v === "Critical") c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFC53030" } }; } });
            downloadBlob(xlsxBlob(buf), "services-register.xlsx"); }} style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, marginRight: 6 }}><FileSpreadsheet size={13} /> Excel</button>
          <ExportButton label="Export services register (CSV)" filename="services-register.csv" rows={[["Service", "Category", "Area", "Asset tag", "Make", "Model", "Serial", "Supplier", "Interval (months)", "Last visit", "Next due", "Budget per visit", "Condition", "Criticality", "Tags", "Responsible", "Installed", "Warranty ends", "Replacement year"], ...devices.map((d) => [d.name, CATEGORY_META[d.serviceCategory]?.label || "", d.area || "", d.assetTag || "", d.manufacturer || "", d.model || "", d.serialNumber || "", supplierById[d.supplierId]?.name || "", d.serviceIntervalMonths || "", d.lastServiceDate || "", d.nextServiceDate || "", d.budgetPerVisit || "", d.condition || "", d.criticality || "normal", (d.tags || []).join("; "), d.assignee || "", d.installDate || "", d.warrantyEnd || "", replacementYear(d) || ""])]} />
        </div>
      )}
      {onDataHealth && dueFilter !== "archived" && devices.length > 0 && (
        <button onClick={onDataHealth} style={{ width: "100%", marginTop: 8, background: "none", border: "none", padding: "8px 12px", fontSize: 12, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <ShieldCheck size={13} /> Check data quality
        </button>
      )}
      {bulkMore && (
        <BulkActionsModal locations={allLocations} count={selected.length} suppliers={allSuppliers} areas={[...new Set(devices.map((d) => d.area).filter(Boolean))].sort()} onClose={() => setBulkMore(false)}
          onApply={(action, value) => {
            if (action === "qr") printBulkStickers([...devices, ...archivedDevices].filter((d) => selected.includes(d.id)), locationLabel);
            else if (action === "copy") onCopyTo?.(selected, value);
            else onBulkUpdate(selected, action, value);
            setBulkMore(false); setSelecting(false); setSelected([]);
          }} />
      )}
      {bookFor && <BookingModal supplier={supplierById[bookFor.supplierId]} locationName={locationName} device={bookFor} onClose={() => setBookFor(null)} onSave={(b) => { onBook(bookFor.id, b); setBookFor(null); }} />}
      {qrFor && <ServiceQrModal device={qrFor} locationLabel={locationLabel(qrFor)} onClose={() => setQrFor(null)} />}
    </div>
  );
}

export function ServiceQrModal({ device, locationLabel, onClose }) {
  const base = appBaseUrl();
  const stickers = [
    { key: "request", title: "Report a problem", url: `${base}?request=${device.id}`, hint: "Scan with your phone camera — no login needed" },
    { key: "service", title: "Staff: service record", url: `${base}?service=${device.id}`, hint: "Opens history & Log visit" },
  ];
  const [printBlocked, setPrintBlocked] = useState(false);
  return (
    <Modal title={`QR stickers — ${device.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Print these and stick them on or near the asset. Anyone can scan the first one to report an issue; the second takes staff straight to this service's record.</div>
        <div style={{ display: "flex", gap: 10 }}>
          {stickers.map((s) => (
            <div key={s.key} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, padding: 10, textAlign: "center", background: "var(--card)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{s.title}</div>
              <img src={qrImageUrl(s.url, 220)} alt={s.title} style={{ width: "100%", maxWidth: 150, aspectRatio: "1", display: "block", margin: "0 auto" }} />
              <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 6, wordBreak: "break-all" }}>{s.url}</div>
            </div>
          ))}
        </div>
        <PrimaryButton onClick={() => setPrintBlocked(!printStickers(device, locationLabel, stickers))}><Printer size={15} /> Print stickers</PrimaryButton>
        {printBlocked && <div style={{ fontSize: 11.5, color: "var(--danger)" }}>Your browser blocked the print window — allow pop-ups for this site, or long-press / right-click the codes above to save them.</div>}
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>QR images are generated by api.qrserver.com from the link shown — the link only contains this service's ID. Stickers work on your deployed (Vercel) site; links from inside the Claude preview won't open for other people.</div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Bulk log visits
--------------------------------------------------------- */
export function BulkLogModal({ devices, defaultTech, onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [useBudgetCost, setUseBudgetCost] = useState(true);
  const total = devices.reduce((t, d) => t + (Number(d.budgetPerVisit) || 0), 0);
  return (
    <Modal title={`Log ${devices.length} visit${devices.length === 1 ? "" : "s"}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px", maxHeight: 110, overflowY: "auto" }}>
          {devices.map((d) => d.name).join(" · ")}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Visit date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Technician"><TextInput value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder={defaultTech || "Name"} /></Field>
        </div>
        <Field label="Notes (applied to every visit)"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Weekly clean completed" /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
          <input type="checkbox" checked={useBudgetCost} onChange={(e) => setUseBudgetCost(e.target.checked)} style={{ margin: 0 }} />
          Record each service's budget per visit as its cost{total ? ` (${gbp(total)} total)` : ""}
        </label>
        <div style={{ fontSize: 11, color: "var(--faint)" }}>Each service moves on to its next due date. Checklists, photos and signatures can be added afterwards by editing a visit.</div>
        <PrimaryButton onClick={() => date && onSave({ date, technician: technician.trim(), notes: notes.trim(), useBudgetCost })}><CheckCircle2 size={15} /> Log {devices.length} visit{devices.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Booking the next visit with the supplier
--------------------------------------------------------- */
export function BookingModal({ supplier = null, locationName = "", device, onClose, onSave }) {
  const b = currentBooking(device);
  const [status, setStatus] = useState(b?.status || "booked");
  const [date, setDate] = useState(b?.date || device.nextServiceDate || "");
  const [time, setTime] = useState(b?.time || "");
  const [ref, setRef] = useState(b?.ref || "");
  return (
    <Modal title={`Book visit — ${device.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Due {fmtDate(device.nextServiceDate)}. The booking resets automatically once this visit is logged.</div>
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={status === "booked"} onClick={() => setStatus("booked")}>Requested / booked</ToggleButton>
          <ToggleButton active={status === "confirmed"} onClick={() => setStatus("confirmed")}>Confirmed by supplier</ToggleButton>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time (optional)"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Supplier job / booking ref (optional)"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. JOB-55812" /></Field>
        {date && (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => {
              const body = `Hi${supplier?.managerName ? ` ${supplier.managerName.split(" ")[0]}` : ""},\n\nPlease can you confirm your visit for ${device.name}${device.assetTag ? ` (#${device.assetTag})` : ""} on ${fmtDate(date)}${time ? ` at ${time}` : ""}${ref ? ` (your ref ${ref})` : ""}.\n\n${[device.accessNotes && `Access: ${device.accessNotes}`, (device.ramsRequired || device.permits?.length) && `Before starting: ${[device.ramsRequired && "send RAMS in advance", ...(device.permits || []).map((p) => `${p} permit needed`)].filter(Boolean).join(", ")}`, siteInfoText()].filter(Boolean).join("\n")}\n\nKind regards`;
              window.location.href = `mailto:${encodeURIComponent(supplier?.managerEmail || "")}?subject=${encodeURIComponent(`Visit booking — ${device.name} — ${fmtDate(date)}${time ? ` ${time}` : ""}`)}&body=${encodeURIComponent(body)}`;
            }} style={{ flex: 1, background: "var(--accent-soft)", border: "none", borderRadius: 9, padding: "9px 10px", fontSize: 12.3, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Mail size={13} /> Ask supplier to confirm</button>
            <button type="button" onClick={() => {
              const dt = (d, t) => d.replace(/-/g, "") + (t ? `T${t.replace(":", "")}00` : "");
              const endT = time ? (() => { const [h, m] = time.split(":").map(Number); return `${String(Math.min(23, h + 2)).padStart(2, "0")}:${String(m).padStart(2, "0")}`; })() : "";
              const nextDay = (() => { const x = new Date(date + "T00:00:00"); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); })();
              const esc = (t) => String(t || "").replace(/[,;\\]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
              const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PPM Service Book//EN", "BEGIN:VEVENT", `UID:booking-${device.id}-${date}@ppm`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, time ? `DTSTART:${dt(date, time)}` : `DTSTART;VALUE=DATE:${dt(date)}`, time ? `DTEND:${dt(date, endT)}` : `DTEND;VALUE=DATE:${dt(nextDay)}`, `SUMMARY:${esc(`${device.name} — ${supplier?.name || "supplier"} visit`)}`, `LOCATION:${esc(locationName)}`, `DESCRIPTION:${esc([ref && `Ref ${ref}`, device.accessNotes].filter(Boolean).join(" · "))}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
              downloadBlob(new Blob([ics], { type: "text/calendar" }), `visit-${device.name.replace(/[^a-z0-9]+/gi, "-")}-${date}.ics`);
            }} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 10px", fontSize: 12.3, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><CalendarPlus size={13} /> Add to my calendar</button>
          </div>
        )}
        <PrimaryButton onClick={() => onSave({ status, date: date || null, time, ref: ref.trim() })}><CalendarCheck size={15} /> Save booking</PrimaryButton>
        {b && <button onClick={() => onSave(null)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Clear booking</button>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Bulk changes for selected services
--------------------------------------------------------- */
export function BulkActionsModal({ locations = [], count, suppliers, areas, onClose, onApply }) {
  const [copyTo, setCopyTo] = useState(locations[0]?.id || "");
  const [pauseUntil, setPauseUntil] = useState(addMonths(new Date().toISOString().slice(0, 10), 1));
  const [assignTo, setAssignTo] = useState(ACTIVE_USERS[0]?.name || "");
  const [action, setAction] = useState("reschedule");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState("");
  const [area, setArea] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const listId = useMemo(() => `bulkarea-${uid()}`, []);
  return (
    <Modal title={`Change ${count} service${count === 1 ? "" : "s"}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["reschedule", "Move due date"], ["supplier", "Set supplier"], ...(ACTIVE_USERS.length ? [["assign", "Assign to"]] : []), ["area", "Set area"], ["pause", "Pause"], ["qr", "Print QR stickers"], ...(locations.length ? [["copy", "Copy to site"]] : []), ["archive", "Archive"]].map(([k, l]) => <ToggleButton key={k} active={action === k} onClick={() => { setAction(k); setConfirmArchive(false); }}>{l}</ToggleButton>)}
        </div>
        {action === "reschedule" && (
          <>
            <Field label="New next-due date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Matching planned visits and unspent Budget Plan lines move too. Each move is recorded in the service's reschedule history.</div>
            <PrimaryButton onClick={() => date && onApply("reschedule", date)}><Calendar size={15} /> Move {count} service{count === 1 ? "" : "s"}</PrimaryButton>
          </>
        )}
        {action === "supplier" && (
          <>
            <Field label="Default supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <PrimaryButton onClick={() => onApply("supplier", supplierId)}><UsersIcon size={15} /> Apply to {count}</PrimaryButton>
          </>
        )}
        {action === "area" && (
          <>
            <Field label="Area / room">
              <TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Roof" />
              <datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <PrimaryButton onClick={() => onApply("area", area.trim())}><MapPin size={15} /> Apply to {count}</PrimaryButton>
          </>
        )}
        {action === "assign" && (
          <>
            <Field label="Responsible person">
              <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">— Nobody —</option>
                {ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </Select>
            </Field>
            <PrimaryButton onClick={() => onApply("assign", assignTo)}><UserCheck size={15} /> Assign {count}</PrimaryButton>
          </>
        )}
        {action === "pause" && (
          <>
            <Field label="Pause until"><TextInput type="date" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} /></Field>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>No overdue alerts until then; planned visits and unspent budget lines inside the pause are removed. Useful when an area is closed or being refurbished.</div>
            <PrimaryButton onClick={() => pauseUntil && onApply("pause", { until: pauseUntil, drop: true })}><PauseCircle size={15} /> Pause {count}</PrimaryButton>
          </>
        )}
        {action === "qr" && (
          <>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Prints a sheet with two small stickers per service: "Report a problem" for anyone, and "Staff: service record" for your team.</div>
            <PrimaryButton onClick={() => onApply("qr")}><QrCode size={15} /> Print {count * 2} stickers</PrimaryButton>
          </>
        )}
        {action === "copy" && (
          <>
            <Field label="Copy to">
              <Select value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select>
            </Field>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Creates matching services at that site — same names, categories, checklists, schedules and safety notes, without history, photos, asset tags or serial numbers. Handy when opening a new site.</div>
            <PrimaryButton onClick={() => copyTo && onApply("copy", copyTo)}><MapPinned size={15} /> Copy {count} service{count === 1 ? "" : "s"}</PrimaryButton>
          </>
        )}
        {action === "archive" && (
          confirmArchive ? (
            <button onClick={() => onApply("archive")} style={{ background: "#9B2C2C", color: "#fff", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, archive {count} service{count === 1 ? "" : "s"}</button>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Archived services keep their history but leave day-to-day lists; future planned visits and unspent budget lines are removed. You can undo straight after.</div>
              <PrimaryButton onClick={() => setConfirmArchive(true)}><Archive size={15} /> Archive {count}…</PrimaryButton>
            </>
          )
        )}
      </div>
    </Modal>
  );
}

export function ChaseModal({ devices, supplierById, locationLabel, currentUserName, onChased, onClose }) {
  const [copied, setCopied] = useState(null);
  const groups = {};
  devices.forEach((d) => {
    const key = d.supplierId && supplierById[d.supplierId] ? d.supplierId : "__none";
    (groups[key] = groups[key] || []).push(d);
  });
  const keys = Object.keys(groups).sort((a, b) => (a === "__none") - (b === "__none"));
  return (
    <Modal title="Chase outstanding jobs" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {devices.length === 0 && <div style={{ fontSize: 13, color: "var(--faint)" }}>Nothing overdue — all caught up.</div>}
        {keys.map((key) => {
          const jobs = groups[key].sort((a, b) => (a.nextServiceDate || "").localeCompare(b.nextServiceDate || ""));
          if (key === "__none") {
            return (
              <div key={key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>No supplier assigned</div>
                <div style={{ fontSize: 12, color: "var(--faint)", margin: "2px 0 8px" }}>Edit these services and set a default supplier to chase them.</div>
                {jobs.map((d) => <div key={d.id} style={{ fontSize: 12.5, padding: "3px 0" }}>{d.name} — due {fmtDate(d.nextServiceDate)}</div>)}
              </div>
            );
          }
          const s = supplierById[key];
          const locText = [...new Set(jobs.map((d) => locationLabel(d)).filter(Boolean))].join(", ");
          const { subject, body } = buildChaseEmail(s, jobs, locText, currentUserName);
          const mailto = s.managerEmail ? `mailto:${encodeURIComponent(s.managerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
          async function copy() {
            try { await navigator.clipboard.writeText(`To: ${s.managerEmail || ""}\nSubject: ${subject}\n\n${body}`); setCopied(key); } catch (e) { setCopied("fail"); }
            onChased?.(jobs.map((d) => d.id), key);
          }
          return (
            <div key={key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: s.managerEmail ? "var(--muted)" : "#C05621", marginTop: 2 }}>
                    {s.managerEmail ? `${s.managerName || "Manager"} · ${s.managerEmail}` : "No manager email — add one in Suppliers"}
                    {s.managerPhone ? ` · ${s.managerPhone}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{jobs.length} overdue</span>
              </div>
              <div style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: 4 }}>
                {jobs.map((d) => {
                  const late = -daysUntil(d.nextServiceDate);
                  const last = d.chaseLog?.[d.chaseLog.length - 1];
                  return (
                    <div key={d.id} style={{ fontSize: 12.5, background: "var(--card-hi)", borderRadius: 7, padding: "6px 8px" }}>
                      <b>{d.name}</b> — due {fmtDate(d.nextServiceDate)} · <span style={{ color: "var(--danger)", fontWeight: 650 }}>{late}d overdue</span>
                      {last && <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Last chased {relativeDays(last.at)} by {last.by} ({d.chaseLog.length}× total)</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {mailto ? (
                  <a href={mailto} target="_blank" rel="noreferrer" onClick={() => onChased?.(jobs.map((d) => d.id), key)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)",
                    borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, textDecoration: "none",
                  }}><Mail size={14} /> Email {s.managerName ? s.managerName.split(" ")[0] : "manager"}</a>
                ) : null}
                <button onClick={copy} style={{ flex: mailto ? "0 0 auto" : 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>
                  {copied === key ? "Copied ✓" : "Copy text"}
                </button>
              </div>
              {copied === "fail" && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>Couldn't copy automatically on this device.</div>}
            </div>
          );
        })}
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>"Email" opens your own mail app with the message ready to send — nothing is sent automatically. Each chase is recorded on the job with the date and your name.</div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Quick log — phone-first: pick (or scan) a service, photo, cost, checks, sign, save
--------------------------------------------------------- */
export function QuickLogModal({ devices, suppliers, initialDeviceId, currentUserName, onScan, onClose, onSave }) {
  const [deviceId, setDeviceId] = useState(initialDeviceId || null);
  const [q, setQ] = useState("");
  const device = devices.find((d) => d.id === deviceId) || null;
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cost, setCost] = useState("");
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState([]);
  const [signatures, setSignatures] = useState({});
  const [gps, setGps] = useState(null);
  const [custom, setCustom] = useState({});
  const [err, setErr] = useState("");
  useEffect(() => {
    setChecks((device?.checklist || []).map((item) => ({ item, result: "", note: "" })));
    setCost(device?.budgetPerVisit ? String(device.budgetPerVisit) : "");
  }, [deviceId]);
  async function handleFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); try { setPhoto(await compressImage(f)); } catch (x) { /* retry */ } setBusy(false);
  }
  function save() {
    if (!device) return;
    if (checks.some((c) => c.result === "fail" && !c.note.trim())) { setErr("Add a short note for each failed check."); return; }
    const miss = missingRequiredFields("visit", device.serviceCategory, custom);
    if (miss.length) { setErr(`Please fill in: ${miss.join(", ")}`); return; }
    onSave({
      deviceId: device.id, name: `${(CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).label} visit`,
      date: new Date().toISOString().slice(0, 10), technician: technician.trim(), supplierId: device.supplierId || "",
      notes: notes.trim(), cost: cost ? Number(cost) : 0, certificatePhoto: photo, poNumber: "",
      checklistResults: checks.length ? checks : undefined,
      signatures: signatures.technician || signatures.site ? signatures : undefined, gps: gps || undefined, source: "quick-log",
      custom: Object.keys(custom).length ? custom : undefined,
    });
  }
  const big = { minHeight: 52, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };

  if (!device) {
    const today = new Date().toISOString().slice(0, 10);
    const list = devices.filter((d) => !q.trim() || `${d.name} ${d.assetTag || ""} ${d.category || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => (a.nextServiceDate || "9999").localeCompare(b.nextServiceDate || "9999"));
    return (
      <Modal title="Quick log — pick a service" onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onScan} style={{ ...big, background: "var(--head)", color: "var(--on-accent)", border: "none" }}><QrCode size={20} /> Scan QR code or asset tag</button>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="…or search by name / asset tag" style={{ fontSize: 15, padding: "12px 14px" }} />
          {list.map((d) => {
            const n = daysUntil(d.nextServiceDate);
            const tone = n === null ? "#8A94A0" : n < 0 ? "#C53030" : n <= 7 ? "#B7791F" : "#2F855A";
            return (
              <button key={d.id} onClick={() => setDeviceId(d.id)} style={{ ...big, justifyContent: "space-between", background: "var(--card)", border: "1px solid var(--border)", borderLeft: `4px solid ${(CATEGORY_META[d.serviceCategory] || CATEGORY_META.maintenance).color}`, padding: "10px 14px", textAlign: "left" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15 }}>{d.name}</span>
                  {d.assetTag && <span style={{ display: "block", fontSize: 11.5, color: "var(--faint)", fontWeight: 500 }}>{d.assetTag}</span>}
                </span>
                <span style={{ fontSize: 12, color: tone, fontWeight: 700, whiteSpace: "nowrap" }}>{n === null ? "—" : n < 0 ? `${-n}d overdue` : n === 0 ? "Due today" : `Due in ${n}d`}</span>
              </button>
            );
          })}
          {list.length === 0 && <div style={{ fontSize: 13, color: "var(--faint)", textAlign: "center", padding: 12 }}>No services match.</div>}
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={device.name} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!initialDeviceId && <button onClick={() => setDeviceId(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>‹ Change service</button>}
        <label style={{ ...big, minHeight: photo ? 0 : 120, background: photo ? "transparent" : "var(--accent)", color: "var(--on-accent)", flexDirection: "column", border: "none", padding: photo ? 0 : 12 }}>
          {photo ? <img src={photo} alt="" style={{ width: "100%", borderRadius: 12 }} /> : <>{busy ? <Loader2 size={30} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={32} />}<span>Take photo of work / certificate</span></>}
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
        </label>
        {photo && <label style={{ ...big, minHeight: 40, fontSize: 13, background: "var(--card-hi)", color: "var(--accent)" }}><Camera size={15} /> Retake<input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} /></label>}
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" style={{ fontSize: 20, padding: "12px 14px", fontWeight: 700 }} /></Field>
          <Field label="Technician"><TextInput value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Name" style={{ fontSize: 15, padding: "12px 14px" }} /></Field>
        </div>
        {checks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Checklist ({checks.filter((c) => c.result).length}/{checks.length})</div>
            {checks.map((c, i) => (
              <div key={i} style={{ background: c.result === "fail" ? "var(--danger-soft)" : "var(--card-hi)", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>{c.item}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["pass", "Pass", "#2F855A"], ["fail", "Fail", "#C53030"], ["na", "N/A", "#8A94A0"]].map(([k, l, col]) => (
                    <button key={k} type="button" onClick={() => setChecks((p) => p.map((x, idx) => idx === i ? { ...x, result: x.result === k ? "" : k } : x))}
                      style={{ flex: 1, minHeight: 44, borderRadius: 9, border: `2px solid ${col}`, background: c.result === k ? col : "var(--card)", color: c.result === k ? "#fff" : col, fontSize: 14, fontWeight: 750, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                  ))}
                </div>
                {c.result === "fail" && <TextInput value={c.note} onChange={(e) => setChecks((p) => p.map((x, idx) => idx === i ? { ...x, note: e.target.value } : x))} placeholder="What's wrong?" style={{ width: "100%", marginTop: 8, fontSize: 14 }} />}
              </div>
            ))}
            {checks.some((c) => c.result === "fail") && <div style={{ fontSize: 11.5, color: "var(--danger)" }}>Failed checks create high-priority follow-up jobs in Works.</div>}
          </div>
        )}
        <CustomFieldInputs appliesTo="visit" category={device.serviceCategory} values={custom} onChange={setCustom} large />
        <Field label="Notes (optional)"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to report?" style={{ fontSize: 14 }} /></Field>
        <SignOffSection signatures={signatures} onChange={setSignatures} gps={gps} onGps={setGps} defaultTechName={technician} />
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{err}</div>}
        <button onClick={save} style={{ ...big, background: "#2F855A", color: "var(--on-accent)", border: "none", position: "sticky", bottom: 0 }}><CheckCircle2 size={20} /> Save visit</button>
      </div>
    </Modal>
  );
}

export function ScannerModal({ onResult, onClose }) {
  const videoRef = useRef(null);
  const [err, setErr] = useState("");
  const [miss, setMiss] = useState("");
  const [manual, setManual] = useState("");
  const onResultRef = useRef(onResult); onResultRef.current = onResult;
  useEffect(() => {
    let stream = null, timer = null, stopped = false, detector = null, lastMiss = "";
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no camera"), { name: "NotSupported" });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current; v.srcObject = stream; v.setAttribute("playsinline", "true"); v.muted = true;
        await v.play();
        if ("BarcodeDetector" in window) {
          try { detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"] }); } catch (e) { detector = new window.BarcodeDetector(); }
        } else {
          await loadJsQR();
        }
        const tick = async () => {
          if (stopped) return;
          let text = null;
          try {
            if (detector) { const codes = await detector.detect(v); text = codes?.[0]?.rawValue || null; }
            else if (window.jsQR && v.videoWidth) {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(v, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = window.jsQR(img.data, img.width, img.height)?.data || null;
            }
          } catch (e) { /* keep scanning */ }
          if (text) {
            if (onResultRef.current(text)) return;
            if (text !== lastMiss) { lastMiss = text; setMiss(text); }
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        setErr(e?.name === "NotAllowedError" ? "Camera permission was blocked — allow camera access for this site in your browser settings, or type the tag below."
          : e?.message === "jsqr" ? "Couldn't load the QR reader — check your connection, or type the tag below."
          : "The camera isn't available here (it needs the deployed https site and a device with a camera). You can type the asset tag below, or scan the sticker with your phone's normal camera app.");
      }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <Modal title="Scan a QR code or asset tag" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!err && (
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "3 / 4", maxHeight: "55vh" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: "18%", border: "3px solid rgba(217,119,6,0.9)", borderRadius: 14, pointerEvents: "none" }} />
          </div>
        )}
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 9, padding: 10 }}>{err}</div>}
        {miss && <div style={{ fontSize: 12, color: "var(--warn)", background: "var(--warn-soft)", borderRadius: 9, padding: 8 }}>Read "{miss.length > 60 ? miss.slice(0, 60) + "…" : miss}" but it doesn't match any service. Set it as a service's asset tag to link them.</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type asset tag, e.g. AHU-003" style={{ flex: 1, fontSize: 15 }}
            onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { if (!onResult(manual)) setMiss(manual); } }} />
          <button onClick={() => { if (manual.trim() && !onResult(manual)) setMiss(manual); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 9, padding: "0 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Go</button>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Reads the app's QR stickers and barcodes/QR codes printed with an asset tag. Point the camera at the code and hold steady.</div>
      </div>
    </Modal>
  );
}

export function ChaseAllModal({ mode = "chase", devices, suppliers, locationName, userName, onClose, onSent }) {
  const groups = {};
  const remind = mode === "remind";
  devices.forEach((d) => { const n = daysUntil(d.nextServiceDate); if (n !== null && (remind ? n >= 0 && n <= 14 : n < 0) && d.supplierId) (groups[d.supplierId] = groups[d.supplierId] || []).push(d); });
  const [sent, setSent] = useState([]);
  function send(sid) {
    const sup = suppliers.find((s) => s.id === sid); const list = groups[sid];
    const lines = list.map((d) => `- ${d.name}${d.assetTag ? ` (#${d.assetTag})` : ""} — due ${fmtDate(d.nextServiceDate)}${remind ? (currentBooking(d) ? ` (booked ${currentBooking(d).date ? fmtDate(currentBooking(d).date) : ""} ${currentBooking(d).time || ""})` : " (not yet booked — please propose a date)") : ` (${-daysUntil(d.nextServiceDate)} days overdue)`}${d.ramsRequired || d.permits?.length ? " — RAMS/permit required" : ""}`);
    if (remind) {
      const rb = `Hi${sup?.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nA reminder of visits due at ${locationName} in the next two weeks:\n\n${lines.join("\n")}\n\n${siteInfoText()}\n\nPlease confirm attendance and send any RAMS in advance.\n\nKind regards,\n${userName || ""}`;
      window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent(`Upcoming visits — ${locationName}`)}&body=${encodeURIComponent(rb)}`;
      setSent((p) => [...p, sid]); return;
    }
    const body = `Hi${sup?.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nThe following ${list.length === 1 ? "visit is" : `${list.length} visits are`} overdue at ${locationName}:\n\n${lines.join("\n")}\n\nPlease confirm dates for these as soon as possible.\n\nKind regards,\n${userName || ""}`;
    window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent(`Overdue visits — ${locationName}`)}&body=${encodeURIComponent(body)}`;
    onSent(list.map((d) => d.id), sid); setSent((p) => [...p, sid]);
  }
  return (
    <Modal title={remind ? "Remind suppliers" : "Chase overdue visits"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{remind ? "One email per supplier listing their visits due in the next 14 days, with booking status and site details." : "One email per supplier listing all their overdue visits. Each chase is recorded on the services."}</div>
        {Object.entries(groups).map(([sid, list]) => {
          const sup = suppliers.find((s) => s.id === sid);
          return (
            <div key={sid} style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{sup?.name || "Supplier"}</div>
                <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{list.length} {remind ? "due" : "overdue"}: {list.map((d) => d.name).join(", ")}{!sup?.managerEmail ? " · no email saved" : ""}</div>
              </div>
              <button onClick={() => send(sid)} style={{ background: sent.includes(sid) ? "var(--ok-soft)" : "var(--accent)", color: sent.includes(sid) ? "var(--ok)" : "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{sent.includes(sid) ? "Sent ✓" : "Email"}</button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
