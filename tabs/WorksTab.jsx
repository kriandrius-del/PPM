// Reactive works and projects.
import { useState } from "react";
import { CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, FileSpreadsheet, FolderKanban, Mail, Printer, Receipt, Repeat, Send, Siren, Square, Timer, Trash2, Upload, X } from "lucide-react";
import { BudgetTypeTag, CategoryBadge, ConfirmTextDelete, CustomFieldInputs, EmptyState, ExportButton, Field, Modal, PrimaryButton, PriorityTag, Select, TextArea, TextInput, ToggleButton, WorkStatusTag, inputStyle } from "../components/ui.jsx";
import { PRIORITY_RANK, PROJECT_STATUSES, SLA_DAYS, WORK_BUDGET_TYPES, WORK_CATEGORIES, WORK_PRIORITIES, WORK_STATUSES } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE, ACTIVE_SLA, ACTIVE_USERS, siteInfoText } from "../lib/globals.js";
import { addDays, daysUntil, downloadBlob, escapeHtml, fmtDate, gbp, parseDelimited, replacementYear, toISO, uid, workSla } from "../lib/utils.js";
import { buildWorkOrderSheet, openPrintReport, tableHtml } from "../lib/reports.js";
import { buildStyledSheet, excelColour, xlsxBlob } from "../lib/excelTemplate.js";

export function WorksTab({ onDuplicateWork, onInvoiceFromWork, onPoFromWork, onImportWorks, spares = [], onUseSpare, onLogChase, onRepeat, invoices = [], locationName = "", onConvertToProject, slaWorkingDays = false, onBulkUpdate, onSetSla, works, deviceById, supplierById, suppliers, onUpdate, onDelete, onAdd, hasDevices, currentUserName, approvalThreshold = 0, onSetThreshold, onConvertToPlan, onConvertToService }) {
  const [importOpen, setImportOpen] = useState(false);
  const needsApproval = (w) => approvalThreshold > 0 && Number(w.quoteAmount) >= approvalThreshold && !w.approvedBy && w.status !== "rejected" && w.status !== "completed";
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState(String(approvalThreshold || ""));
  const [statusFilter, setStatusFilter] = useState("open"); // 'open' | 'requested' | 'all' | 'closed'
  const [tradeFilter, setTradeFilter] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [chaseOpen, setChaseOpen] = useState(false);
  const overdueWorks = works.filter((w) => !["completed", "rejected", "on_hold"].includes(w.status) && workSla(w)?.breached && w.supplierId);
  const [openWorkId, setOpenWorkId] = useState(null);
  const [layout, setLayout] = useState("list"); // 'list' | 'board'
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [slaEdit, setSlaEdit] = useState(null);
  const toggleSel = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const countable = works.filter((w) => w.status !== "rejected" && w.status !== "requested");
  const budgetedTotal = countable.filter((w) => w.budgetType !== "non_controllable").reduce((sum, w) => sum + (Number(w.quoteAmount) || 0), 0);
  const nonControllableTotal = countable.filter((w) => w.budgetType === "non_controllable").reduce((sum, w) => sum + (Number(w.quoteAmount) || 0), 0);
  if (works.length === 0) {
    return <EmptyState icon={Receipt} title="No extra works logged" body={hasDevices ? "Track work outside the regular service plan — requests, quotes, approvals and follow-ups from failed checks." : "Add a service first, then log extra works against it."} actionLabel={hasDevices && ACTIVE_CAN_EDIT ? "Add extra work" : undefined} onAction={hasDevices ? onAdd : undefined} />;
  }
  const isClosed = (w) => w.status === "completed" || w.status === "rejected";
  const requestedCount = works.filter((w) => w.status === "requested").length;
  const filtered = works
    .filter((w) => !tradeFilter || w.category === tradeFilter)
    .filter((w) => statusFilter === "all" ? true : statusFilter === "closed" ? isClosed(w) : statusFilter === "requested" ? w.status === "requested" : !isClosed(w))
    .sort((a, b) => sortBy === "newest" ? (b.dateRaised || "").localeCompare(a.dateRaised || "") : sortBy === "oldest" ? (a.dateRaised || "").localeCompare(b.dateRaised || "") : sortBy === "target" ? String(workSla(a)?.deadline || "9999").localeCompare(String(workSla(b)?.deadline || "9999")) : sortBy === "value" ? (Number(b.quoteAmount) || 0) - (Number(a.quoteAmount) || 0) : (PRIORITY_RANK[a.priority || "medium"] - PRIORITY_RANK[b.priority || "medium"]) || (b.dateRaised || "").localeCompare(a.dateRaised || ""));
  const openWork = openWorkId ? works.find((w) => w.id === openWorkId) : null;
  const csvRows = [
    ["Service", "Description", "Priority", "Assigned to", "Amount", "Status", "Budget type", "Date raised", "Raised by", "Comments"],
    ...works.map((w) => [deviceById[w.deviceId]?.name || "", w.description || "", w.priority || "medium", w.supplierId ? (supplierById[w.supplierId]?.name || "") : "", w.quoteAmount || 0, w.status || "", w.budgetType === "non_controllable" ? "Non-controllable" : "Budgeted", w.dateRaised || "", w.requestedBy || w.loggedBy || "", (w.comments || []).length]),
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        {editingThreshold ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Approval over</span>
            <TextInput type="number" min="0" value={thresholdDraft} onChange={(e) => setThresholdDraft(e.target.value)} style={{ width: 90, padding: "6px 8px" }} />
            <button onClick={() => { onSetThreshold?.(Number(thresholdDraft) || 0); setEditingThreshold(false); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          </div>
        ) : (
          <button onClick={() => ACTIVE_CAN_EDIT && setEditingThreshold(true)} style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, color: "var(--muted)", cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
            {approvalThreshold > 0 ? <>Quotes over <b>{gbp(approvalThreshold)}</b> need approval{ACTIVE_CAN_EDIT ? " · edit" : ""}</> : <>No approval rule{ACTIVE_CAN_EDIT ? " · set one" : ""}</>}
          </button>
        )}
        <button onClick={async () => { const rows = works.map((w) => [w.dateRaised ? new Date(w.dateRaised + "T00:00:00") : null, deviceById[w.deviceId]?.name || "", w.description, w.category || "", w.priority || "medium", WORK_STATUSES.find((s) => s.key === w.status)?.label || w.status, supplierById[w.supplierId]?.name || "", Number(w.quoteAmount) || null, w.finalCost != null ? Number(w.finalCost) : null, workSla(w) ? new Date(workSla(w).deadline + "T00:00:00") : null, workSla(w)?.breached ? "Late" : "", w.poNumber || "", w.requestedBy || ""]);
          const buf = await buildStyledSheet({ title: "Reactive works", subtitle: `${locationName} · ${new Date().toLocaleDateString("en-GB")} · ${works.length} jobs`, sheetName: "Works", headers: ["Raised", "Service", "Work", "Trade", "Priority", "Status", "Supplier", "Quote", "Final cost", "Target", "On target?", "PO", "Requested by"], rows, widths: [12, 24, 40, 16, 10, 14, 22, 12, 12, 12, 10, 12, 16], numFmts: { 0: "dd/mm/yyyy", 7: "£#,##0.00", 8: "£#,##0.00", 9: "dd/mm/yyyy" }, cellStyle: (c, v, ri, ci) => { if (ci === 10 && v === "Late") excelColour(c, "FBEAEA", "C53030"); if (ci === 4 && v === "high") c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFC53030" } }; } });
          downloadBlob(xlsxBlob(buf), "reactive-works.xlsx"); }} style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, marginRight: 6 }}><FileSpreadsheet size={13} /> Excel</button>
        {ACTIVE_CAN_EDIT && onImportWorks && <button onClick={() => setImportOpen(true)} style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, marginRight: 6 }}><Upload size={13} /> Import jobs</button>}
        {importOpen && <ImportWorksModal devices={Object.values(deviceById)} suppliers={suppliers} onClose={() => setImportOpen(false)} onImport={(rows) => { onImportWorks(rows); setImportOpen(false); }} />}
        <ExportButton rows={csvRows} filename="extra-works.csv" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>Budgeted total</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(budgetedTotal)}</div>
        </div>
        <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>Non-controllable</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: "var(--warn)" }}>{gbp(nonControllableTotal)}</div>
        </div>
      </div>
      {slaEdit ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontSize: 11.5, color: "var(--muted)" }}>
          Target days —
          {["high", "medium", "low"].map((k) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>{k}
              <TextInput type="number" min="0" value={slaEdit[k]} onChange={(e) => setSlaEdit((p) => ({ ...p, [k]: e.target.value }))} style={{ width: 52, padding: "4px 6px" }} />
            </label>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={!!slaEdit.wd} onChange={(e) => setSlaEdit((p) => ({ ...p, wd: e.target.checked }))} style={{ margin: 0 }} /> working days only</label>
          <button onClick={() => { onSetSla?.({ high: Number(slaEdit.high) || 1, medium: Number(slaEdit.medium) || 7, low: Number(slaEdit.low) || 28 }, slaEdit.wd); setSlaEdit(null); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
        </div>
      ) : (
        <button onClick={() => ACTIVE_CAN_EDIT && onSetSla && setSlaEdit({ ...ACTIVE_SLA, wd: slaWorkingDays })} style={{ background: "none", border: "none", padding: 0, fontSize: 10.5, color: "var(--faint)", marginBottom: 8, cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
          Target completion: high {ACTIVE_SLA.high} day{ACTIVE_SLA.high === 1 ? "" : "s"}, medium {ACTIVE_SLA.medium} days, low {ACTIVE_SLA.low} days{slaWorkingDays ? " (working days)" : ""} from being raised.{ACTIVE_CAN_EDIT && onSetSla ? " · edit" : ""}
        </button>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <ToggleButton active={layout === "list"} onClick={() => setLayout("list")}>List</ToggleButton>
        <ToggleButton active={layout === "board"} onClick={() => { setLayout("board"); setSelecting(false); }}>Board</ToggleButton>
        {ACTIVE_CAN_EDIT && onBulkUpdate && layout === "list" && <ToggleButton active={selecting} onClick={() => { setSelecting((v) => !v); setSelected([]); }}>{selecting ? "Cancel select" : "Select…"}</ToggleButton>}
      </div>
      {layout === "board" && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
          {WORK_STATUSES.filter((s) => s.key !== "rejected").map((st, si, arr) => {
            const col = works.filter((w) => w.status === st.key && (st.key !== "completed" || (w.completedAt || w.dateRaised || "") >= addDays(new Date().toISOString().slice(0, 10), -30)))
              .sort((a, b) => (PRIORITY_RANK[a.priority || "medium"] - PRIORITY_RANK[b.priority || "medium"]) || (a.dateRaised || "").localeCompare(b.dateRaised || ""));
            return (
              <div key={st.key} style={{ minWidth: 200, width: 200, flexShrink: 0, background: "var(--card-hi)", borderRadius: 12, padding: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 750, color: "var(--text-2)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{st.label}</span><span style={{ color: "var(--faint)" }}>{col.length}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {col.map((w) => {
                    const sla = workSla(w);
                    return (
                      <div key={w.id} style={{ background: "var(--card)", borderRadius: 9, padding: 8, borderLeft: `3px solid ${(WORK_PRIORITIES.find((p) => p.key === (w.priority || "medium")) || {}).color || "#8A94A0"}` }}>
                        <button onClick={() => setOpenWorkId(w.id)} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                          <div style={{ fontSize: 12.3, fontWeight: 700 }}>{deviceById[w.deviceId]?.name || "Service"}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-2)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{w.description}</div>
                          <div style={{ fontSize: 10.5, color: sla?.breached && !sla.done ? "var(--danger)" : "var(--faint)", fontWeight: sla?.breached && !sla.done ? 700 : 500, marginTop: 3 }}>{gbp(w.quoteAmount)}{w.assignee ? ` · ${w.assignee}` : ""}{sla && !sla.done ? ` · ${sla.breached ? "overdue" : `by ${fmtDate(sla.deadline)}`}` : ""}</div>
                        </button>
                        {ACTIVE_CAN_EDIT && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <button disabled={si === 0} onClick={() => onUpdate(w.id, { status: arr[si - 1].key })} title={si ? `Move to ${arr[si - 1].label}` : ""} style={{ background: "var(--card-hi)", border: "none", borderRadius: 6, padding: "2px 8px", cursor: si ? "pointer" : "default", opacity: si ? 1 : 0.3, display: "flex" }}><ChevronLeft size={13} /></button>
                            <button disabled={si === arr.length - 1} onClick={() => onUpdate(w.id, { status: arr[si + 1].key })} title={si < arr.length - 1 ? `Move to ${arr[si + 1].label}` : ""} style={{ background: "var(--card-hi)", border: "none", borderRadius: 6, padding: "2px 8px", cursor: si < arr.length - 1 ? "pointer" : "default", opacity: si < arr.length - 1 ? 1 : 0.3, display: "flex" }}><ChevronRight size={13} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {col.length === 0 && <div style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", padding: 8 }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {layout === "board" && <div style={{ fontSize: 10.5, color: "var(--faint)", marginBottom: 12 }}>Use the arrows to move a job along. Completed shows the last 30 days.</div>}
      {layout === "list" && <>
      {ACTIVE_CAN_EDIT && onLogChase && overdueWorks.length > 0 && (
        <button onClick={() => setChaseOpen(true)} style={{ width: "100%", marginBottom: 10, background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Mail size={14} /> Chase {overdueWorks.length} overdue job{overdueWorks.length === 1 ? "" : "s"} — one email per supplier
        </button>
      )}
      {(() => { const rated = works.filter((w) => w.satisfaction); return rated.length ? <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Requester satisfaction: <b style={{ color: "#D97706" }}>{(rated.reduce((t, w) => t + w.satisfaction, 0) / rated.length).toFixed(1)} ★</b> from {rated.length} job{rated.length === 1 ? "" : "s"}</div> : null; })()}
      {chaseOpen && <ChaseWorksModal works={overdueWorks} suppliers={suppliers} deviceById={deviceById} locationName={locationName} onClose={() => setChaseOpen(false)} onSent={onLogChase} />}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <ToggleButton active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Open</ToggleButton>
        <ToggleButton active={statusFilter === "requested"} onClick={() => setStatusFilter("requested")}>New requests{requestedCount ? ` (${requestedCount})` : ""}</ToggleButton>
        <ToggleButton active={statusFilter === "closed"} onClick={() => setStatusFilter("closed")}>Closed</ToggleButton>
        <ToggleButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</ToggleButton>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 8px", fontSize: 12.5 }}>
          <option value="priority">Priority first</option><option value="target">Target date</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="value">Highest value</option>
        </select>
        {works.some((w) => w.category) && (
          <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 8px", fontSize: 12.5 }}>
            <option value="">All trades</option>
            {[...new Set(works.map((w) => w.category).filter(Boolean))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, padding: "24px 0" }}>Nothing in this view.</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((w) => {
          const dev = deviceById[w.deviceId];
          const assignee = w.supplierId ? supplierById[w.supplierId] : null;
          const commentCount = (w.comments || []).length;
          return (
            <button key={w.id} onClick={() => selecting ? toggleSel(w.id) : setOpenWorkId(w.id)} style={{ outline: selecting && selected.includes(w.id) ? "2px solid var(--accent)" : "none", background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${(WORK_PRIORITIES.find((p) => p.key === (w.priority || "medium")) || WORK_PRIORITIES[1]).color}`, borderRadius: 12, padding: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}>{selecting && (selected.includes(w.id) ? <CheckSquare size={17} color="#2B4562" /> : <Square size={17} color="#A3ABB4" />)}{dev ? dev.name : "Unknown service"}</div>
                  <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>Raised {fmtDate(w.dateRaised)}{w.requestedBy ? ` by ${w.requestedBy}` : ""}</div>
                </div>
                <WorkStatusTag status={w.status} />
              </div>
              <div style={{ margin: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <PriorityTag priority={w.priority || "medium"} />
                {(() => {
                  const sla = workSla(w); if (!sla) return null;
                  if (sla.done) return sla.breached ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", padding: "3px 8px", borderRadius: 20 }}>Completed late</span> : null;
                  return <span style={{ fontSize: 11, fontWeight: 700, color: sla.breached ? "var(--on-accent)" : sla.dueSoon ? "var(--warn)" : "var(--muted)", background: sla.breached ? "#C53030" : sla.dueSoon ? "var(--warn-soft)" : "var(--card-hi)", padding: "3px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 3 }}><Timer size={10} /> {sla.breached ? `Overdue since ${fmtDate(sla.deadline)}` : `Target ${fmtDate(sla.deadline)}`}</span>;
                })()}
                {w.quoteValidUntil && ["quoted", "requested"].includes(w.status) && daysUntil(w.quoteValidUntil) <= 14 && <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(w.quoteValidUntil) < 0 ? "var(--danger)" : "var(--warn)", background: daysUntil(w.quoteValidUntil) < 0 ? "var(--danger-soft)" : "var(--warn-soft)", padding: "3px 8px", borderRadius: 20 }}>{daysUntil(w.quoteValidUntil) < 0 ? "Quote expired" : `Quote valid to ${fmtDate(w.quoteValidUntil)}`}</span>}
                {needsApproval(w) && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)", background: "var(--warn-soft)", padding: "3px 8px", borderRadius: 20 }}>Needs approval</span>}
                {w.approvedBy && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)", background: "var(--ok-soft)", padding: "3px 8px", borderRadius: 20 }}>✓ Approved</span>}
                {w.poNumber && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--card-hi)", padding: "3px 8px", borderRadius: 20 }}>PO {w.poNumber}</span>}
                {w.finalCost != null && Number(w.quoteAmount) > 0 && (() => { const v = Number(w.finalCost) - Number(w.quoteAmount); const pct = Math.round((v / Number(w.quoteAmount)) * 100); return <span style={{ fontSize: 11, fontWeight: 700, color: v > 0 ? "var(--danger)" : "var(--ok)", background: v > 0 ? "var(--danger-soft)" : "var(--ok-soft)", padding: "3px 8px", borderRadius: 20 }}>Final {gbp(w.finalCost)} ({v > 0 ? "+" : ""}{pct}%)</span>; })()}
                {w.eta && !["completed", "rejected"].includes(w.status) && <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(w.eta) < 0 ? "var(--danger)" : "var(--accent)", background: daysUntil(w.eta) < 0 ? "var(--danger-soft)" : "var(--accent-soft)", padding: "3px 8px", borderRadius: 20 }}>Supplier ETA {fmtDate(w.eta)}</span>}
                {w.waitingOn && !["completed", "rejected"].includes(w.status) && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)", background: "var(--warn-soft)", padding: "3px 8px", borderRadius: 20 }}>Waiting: {w.waitingOn.toLowerCase()}</span>}
                {!["completed", "rejected"].includes(w.status) && w.dateRaised && -daysUntil(w.dateRaised) > 7 && <span style={{ fontSize: 11, fontWeight: 650, color: -daysUntil(w.dateRaised) > 30 ? "var(--danger)" : "var(--muted)", background: "var(--card-hi)", padding: "3px 8px", borderRadius: 20 }}>Open {-daysUntil(w.dateRaised)} days</span>}
                {w.priority === "high" && !w.attendedAt && !["completed", "rejected", "on_hold"].includes(w.status) && (Date.now() - new Date(w.loggedAt || `${w.dateRaised}T09:00:00`).getTime()) > 86400000 && <span style={{ fontSize: 11, fontWeight: 750, color: "#fff", background: "var(--danger)", padding: "3px 8px", borderRadius: 20 }}>No attendance 24h+</span>}
                {w.supplierAck && !w.supplierAck.declined && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)", background: "var(--ok-soft)", padding: "3px 8px", borderRadius: 20 }}>Supplier accepted</span>}
                {w.supplierAck?.declined && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", padding: "3px 8px", borderRadius: 20 }}>Supplier declined</span>}
                {w.supplierDone && w.status !== "completed" && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "3px 8px", borderRadius: 20 }}>Supplier says done</span>}
                {w.warranty && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)", background: "var(--ok-soft)", padding: "3px 8px", borderRadius: 20 }}>Warranty claim</span>}
                {w.category && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--card-hi)", padding: "3px 8px", borderRadius: 20 }}>{w.category}</span>}
                {(w.links || []).length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--card-hi)", padding: "3px 8px", borderRadius: 20 }}>📎 {w.links.length}</span>}
                {w.incidentId && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", padding: "3px 8px", borderRadius: 20 }}>From incident</span>}
                <CategoryBadge category={dev?.serviceCategory} />
                <BudgetTypeTag type={w.budgetType} />
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{w.description}</p>
              {w.photos && w.photos.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
                  {w.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }} />)}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--faint)" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{gbp(w.quoteAmount)}</span>
                <span>{assignee ? assignee.name : "Unassigned"} · {commentCount} comment{commentCount === 1 ? "" : "s"}</span>
              </div>
            </button>
          );
        })}
      </div>
      )}
      </>}
      {selecting && (
        <div style={{ position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", width: "min(440px, calc(100vw - 32px))", background: "var(--head)", borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 6, zIndex: 40, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", flexWrap: "wrap" }}>
          <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 650, flex: 1, paddingLeft: 4 }}>{selected.length} selected</span>
          <select disabled={!selected.length} value="" onChange={(e) => { if (e.target.value) { onBulkUpdate(selected, { status: e.target.value }); setSelecting(false); setSelected([]); } }} style={{ borderRadius: 8, padding: "7px 6px", fontSize: 12, fontFamily: "inherit" }}>
            <option value="">Set status…</option>
            {WORK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {ACTIVE_USERS.length > 0 && (
            <select disabled={!selected.length} value="" onChange={(e) => { if (e.target.value) { onBulkUpdate(selected, { assignee: e.target.value === "__none" ? null : e.target.value }); setSelecting(false); setSelected([]); } }} style={{ borderRadius: 8, padding: "7px 6px", fontSize: 12, fontFamily: "inherit" }}>
              <option value="">Assign…</option>
              <option value="__none">Nobody</option>
              {ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          )}
        </div>
      )}
      {openWork && (
        <WorkDetailModal onDuplicate={onDuplicateWork ? () => { onDuplicateWork(openWork); setOpenWorkId(null); } : null} onInvoice={onInvoiceFromWork ? () => onInvoiceFromWork(openWork) : null} onRaisePO={onPoFromWork ? () => onPoFromWork(openWork) : null} spares={spares} onUseSpare={onUseSpare ? (sid, q) => onUseSpare(openWork.id, sid, q) : null} onRepeat={onRepeat ? () => { const w = openWork; setOpenWorkId(null); onRepeat(w); } : null} locationName={locationName} invoicedTotal={invoices.filter((iv) => iv.workId === openWork.id || (openWork.poNumber && iv.poNumberText === openWork.poNumber)).reduce((t, iv) => t + (Number(iv.amount) || 0), 0)} work={openWork} device={deviceById[openWork.deviceId]} suppliers={suppliers} currentUserName={currentUserName}
          approvalThreshold={approvalThreshold} needsApproval={needsApproval(openWork)}
          onConvertToProject={onConvertToProject ? () => { onConvertToProject(openWork); setOpenWorkId(null); } : null}
          onConvertToPlan={() => onConvertToPlan?.(openWork)} onConvertToService={() => onConvertToService?.(openWork)}
          onClose={() => setOpenWorkId(null)} onUpdate={(patch) => onUpdate(openWork.id, patch)}
          onDelete={() => { onDelete(openWork.id); setOpenWorkId(null); }} />
      )}
    </div>
  );
}

export function WorkDetailModal({ onDuplicate, onInvoice, onRaisePO, spares = [], onUseSpare, onRepeat, locationName = "", invoicedTotal = 0, onConvertToProject, work, device, suppliers, currentUserName, onClose, onUpdate, onDelete, approvalThreshold = 0, needsApproval = false, onConvertToPlan, onConvertToService }) {
  const [po, setPo] = useState(work.poNumber || "");
  const [statusMsg, setStatusMsg] = useState("");
  const [comment, setComment] = useState("");
  const [amount, setAmount] = useState(work.quoteAmount ? String(work.quoteAmount) : "");
  const [finalCost, setFinalCost] = useState(work.finalCost != null ? String(work.finalCost) : "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const comments = work.comments || [];
  const relevantSuppliers = suppliers.filter((s) => !device || s.category === device.serviceCategory);
  const otherSuppliers = suppliers.filter((s) => device && s.category !== device.serviceCategory);
  function addComment() {
    if (!comment.trim()) return;
    onUpdate({ comments: [...comments, { text: comment.trim(), by: currentUserName || "Unknown", at: new Date().toISOString() }] });
    setComment("");
  }
  return (
    <Modal title={device ? device.name : "Extra work"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13.5, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{work.description}</div>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Raised {fmtDate(work.dateRaised)}{work.requestedBy ? ` by ${work.requestedBy}` : work.loggedBy ? ` by ${work.loggedBy}` : ""}{work.source === "checklist" ? " · from a failed checklist item" : work.source === "request" ? " · via request portal" : ""}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Status">
            <Select value={work.status} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => {
              const v = e.target.value;
              if (needsApproval && ["approved", "in_progress", "completed"].includes(v)) { setStatusMsg(`This quote is over ${gbp(approvalThreshold)} — use Approve below first.`); return; }
              setStatusMsg(""); onUpdate({ status: v });
            }}>
              {WORK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={work.priority || "medium"} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ priority: e.target.value })}>
              {WORK_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
          </Field>
        </div>
        {statusMsg && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: -4 }}>{statusMsg}</div>}
        {needsApproval && (
          <div style={{ background: "var(--warn-soft)", border: "1px solid #E6D9BC", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--warn)" }}>Needs approval — quote is {gbp(work.quoteAmount)}, over the {gbp(approvalThreshold)} limit</div>
            {(work.loggedBy || work.requestedBy) === currentUserName && <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 2 }}>You raised this job — ideally someone else approves it.</div>}
            {ACTIVE_CAN_EDIT && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setStatusMsg(""); onUpdate({ approvedBy: currentUserName || "Unknown", approvedAt: new Date().toISOString(), status: "approved", comments: [...(work.comments || []), { text: `Approved ${gbp(work.quoteAmount)}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] }); }} style={{ flex: 1, background: "#2F855A", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Approve</button>
                <button onClick={() => onUpdate({ status: "rejected", comments: [...(work.comments || []), { text: "Quote rejected", by: currentUserName || "Unknown", at: new Date().toISOString() }] })} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
              </div>
            )}
          </div>
        )}
        {work.approvedBy && <div style={{ fontSize: 11.5, color: "var(--ok)", fontWeight: 650 }}>✓ Approved by {work.approvedBy} on {fmtDate(work.approvedAt?.slice(0, 10))}</div>}
        <CustomFieldInputs appliesTo="work" category={device?.serviceCategory} values={work.custom || {}} onChange={(v) => onUpdate({ custom: v })} readOnly={!ACTIVE_CAN_EDIT} />
        <QuoteComparison work={work} suppliers={suppliers} currentUserName={currentUserName}
          onAccept={(q, quotes) => { setAmount(String(q.amount)); onUpdate({ quotes, supplierId: q.supplierId || null, quoteAmount: q.amount, comments: [...(work.comments || []), { text: `Accepted quote from ${suppliers.find((x) => x.id === q.supplierId)?.name || q.supplierName || "supplier"}: ${gbp(q.amount)}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] }); }}
          onChange={(quotes) => onUpdate({ quotes })} />
        <Field label="PO / work order number">
          <TextInput value={po} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => setPo(e.target.value)} onBlur={() => po !== (work.poNumber || "") && onUpdate({ poNumber: po.trim() })} placeholder="e.g. PO-40213" />
        </Field>
        <Field label="Assigned supplier">
          <Select value={work.supplierId || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ supplierId: e.target.value || null })}>
            <option value="">— Unassigned —</option>
            {relevantSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {otherSuppliers.length > 0 && <optgroup label="Other categories">{otherSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
          </Select>
        </Field>
        {needsApproval && ACTIVE_CAN_EDIT && (
          <button type="button" onClick={() => {
            const body = `Hi,\n\nPlease could you approve the following work${device ? ` on ${device.name}` : ""}:\n\n${work.description}\n\nQuote: ${gbp(work.quoteAmount)}${suppliers.find((s) => s.id === work.supplierId) ? ` from ${suppliers.find((s) => s.id === work.supplierId).name}` : ""}\nPriority: ${work.priority || "medium"}\nRaised: ${fmtDate(work.dateRaised)}${work.poNumber ? `\nPO: ${work.poNumber}` : ""}${(work.links || []).length ? `\n\nDocuments:\n${work.links.map((l) => `${l.label}: ${l.url}`).join("\n")}` : ""}\n\nThanks,\n${currentUserName || ""}`;
            window.location.href = `mailto:?subject=${encodeURIComponent(`Approval needed: ${gbp(work.quoteAmount)} — ${device?.name || "work"}`)}&body=${encodeURIComponent(body)}`;
            onUpdate({ comments: [...(work.comments || []), { text: "Approval requested by email", by: currentUserName || "Unknown", at: new Date().toISOString() }] });
          }} style={{ background: "var(--warn-soft)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--warn)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Mail size={14} /> Request approval by email
          </button>
        )}
        {invoicedTotal > 0 && <div style={{ fontSize: 12.5, color: invoicedTotal > (Number(work.finalCost ?? work.quoteAmount) || 0) * 1.05 ? "var(--danger)" : "var(--ok)", fontWeight: 650 }}>Invoiced so far: {gbp(invoicedTotal)}{Number(work.quoteAmount) ? ` of ${gbp(work.finalCost ?? work.quoteAmount)}` : ""}</div>}
        <button type="button" onClick={() => openPrintReport(`Work order — ${device?.name || ""}`, locationName, buildWorkOrderSheet(work, device, suppliers.find((s) => s.id === work.supplierId), locationName))} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print work order</button>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          {!["completed", "rejected"].includes(work.status) && <Field label="Waiting on"><Select value={work.waitingOn || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ waitingOn: e.target.value || null, comments: e.target.value ? [...(work.comments || []), { text: `Waiting on ${e.target.value.toLowerCase()}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] : work.comments })}><option value="">Nothing</option>{["Parts", "Quote", "Access", "Approval", "Supplier", "Other"].map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            onDuplicate && ACTIVE_CAN_EDIT && ["Duplicate job", onDuplicate],
            ["Copy summary", () => { const sup = suppliers.find((s) => s.id === work.supplierId); const t = `${device?.name || "Job"}: ${work.description}\nRef ${work.id.slice(-6).toUpperCase()} · ${(work.priority || "medium").toUpperCase()} · ${WORK_STATUSES.find((x) => x.key === work.status)?.label || work.status}${sup ? ` · ${sup.name}` : ""}${work.quoteAmount ? ` · ${gbp(work.finalCost ?? work.quoteAmount)}` : ""}${work.poNumber ? ` · PO ${work.poNumber}` : ""}\nRaised ${fmtDate(work.dateRaised)}${workSla(work) ? ` · target ${fmtDate(workSla(work).deadline)}` : ""}`; try { navigator.clipboard?.writeText(t); } catch (e) { /* ignore */ } alert("Job summary copied — paste it into Teams, WhatsApp or an email."); }],
            onRaisePO && ACTIVE_CAN_EDIT && !work.poNumber && Number(work.quoteAmount) > 0 && ["Raise a PO", onRaisePO],
            onInvoice && ACTIVE_CAN_EDIT && ["approved", "in_progress", "completed"].includes(work.status) && ["Record the invoice", onInvoice],
          ].filter(Boolean).map(([l, fn]) => <button key={l} type="button" onClick={fn} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
        </div>
        <LabourMaterials work={work} onUpdate={onUpdate} spares={spares} onUseSpare={onUseSpare} />
        <WorkLinks links={work.links || []} onChange={ACTIVE_CAN_EDIT ? (links) => onUpdate({ links }) : null} />
        {onConvertToProject && ACTIVE_CAN_EDIT && !work.projectId && !["completed", "rejected"].includes(work.status) && (
          <button type="button" onClick={onConvertToProject} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}><FolderKanban size={13} /> Too big for a work? Turn it into a project</button>
        )}
        {work.supplierDone && work.status !== "completed" && (
          <div style={{ background: "var(--accent-soft)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Supplier marked this done — {work.supplierDone.name}, {new Date(work.supplierDone.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{work.supplierDone.notes}</div>
            {(work.supplierDone.photos || []).length > 0 && <div style={{ display: "flex", gap: 5 }}>{work.supplierDone.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 7, objectFit: "cover" }} />)}</div>}
            {work.supplierDone.signature && <img src={work.supplierDone.signature} alt="Signature" style={{ height: 50, alignSelf: "flex-start", background: "#fff", borderRadius: 6 }} />}
            {ACTIVE_CAN_EDIT && <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => onUpdate({ status: "completed", comments: [...(work.comments || []), { text: "Completion confirmed after supplier sign-off", by: currentUserName || "Unknown", at: new Date().toISOString() }] })} style={{ flex: 1, background: "var(--ok)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Confirm complete</button>
              <button type="button" onClick={() => { const why = window.prompt("What still needs doing?", ""); if (why) onUpdate({ supplierDone: null, comments: [...(work.comments || []), { text: `Not accepted as complete: ${why}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] }); }} style={{ background: "var(--card)", color: "var(--danger)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Not finished</button>
            </div>}
          </div>
        )}
        {ACTIVE_CAN_EDIT && !["completed", "rejected", "on_hold"].includes(work.status) && (work.priority === "high" || workSla(work)?.breached) && suppliers.find((s) => s.id === work.supplierId)?.managerEmail && (
          <button type="button" onClick={() => {
            const sup = suppliers.find((s) => s.id === work.supplierId);
            const body = `Hi${sup.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nI need to escalate this job at ${locationName}:\n\n${device?.name || ""}: ${work.description}\nRaised: ${fmtDate(work.dateRaised)}${workSla(work) ? ` · target ${fmtDate(workSla(work).deadline)}` : ""}${work.poNumber ? ` · PO ${work.poNumber}` : ""}\nPriority: ${(work.priority || "medium").toUpperCase()}\n\n${work.attendedAt ? "" : "No engineer has attended yet. "}Please confirm today when this will be resolved.\n\nThanks,\n${currentUserName || ""}`;
            window.location.href = `mailto:${encodeURIComponent(sup.managerEmail)}?subject=${encodeURIComponent(`ESCALATION: ${device?.name || "job"} — ${locationName}`)}&body=${encodeURIComponent(body)}`;
            onUpdate({ escalatedAt: new Date().toISOString(), comments: [...(work.comments || []), { text: `Escalated to ${sup.name}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] });
          }} style={{ background: "var(--danger-soft)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, color: "var(--danger)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Siren size={14} /> Escalate to supplier's manager{work.escalatedAt ? ` (last ${fmtDate(work.escalatedAt.slice(0, 10))})` : ""}</button>
        )}
        {work.status === "completed" && (work.source === "request" || work.requestedBy) && (
          <Field label="Requester's satisfaction (ask them)">
            <div style={{ display: "flex", gap: 4 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" disabled={!ACTIVE_CAN_EDIT} onClick={() => onUpdate({ satisfaction: work.satisfaction === n ? null : n })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: (work.satisfaction || 0) >= n ? "#D97706" : "#C0C6CC", padding: 0 }}>★</button>)}</div>
          </Field>
        )}
        {work.status === "on_hold" && (
          <Field label="Why is it on hold? (the target date is paused)">
            <TextInput value={work.holdReason || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ holdReason: e.target.value })} placeholder="e.g. Waiting for parts / access / landlord approval" />
          </Field>
        )}
        {ACTIVE_CAN_EDIT && onRepeat && (
          <button type="button" onClick={onRepeat} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}><Repeat size={13} /> Raise this job again (repeat)</button>
        )}
        {work.projectId && <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 650 }}>✓ Being handled as a project</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Quote requested on">
            <TextInput type="date" value={work.quoteRequestedAt || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ quoteRequestedAt: e.target.value || null })} />
          </Field>
          <Field label="Engineer attended">
            <TextInput type="datetime-local" value={work.attendedAt ? String(work.attendedAt).slice(0, 16) : ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ attendedAt: e.target.value || null })} />
          </Field>
        </div>
        {work.attendedAt && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -4 }}>Response time: <b>{(() => { const h = Math.max(0, (new Date(work.attendedAt) - new Date(work.loggedAt || `${work.dateRaised}T09:00:00`)) / 3600000); return h < 48 ? `${h.toFixed(1)} hours` : `${(h / 24).toFixed(1)} days`; })()}</b> from being raised</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Supplier's expected completion">
            <TextInput type="date" value={work.eta || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ eta: e.target.value || null })} />
          </Field>
          <Field label="Requester email">
            <TextInput type="email" value={work.requesterEmail || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ requesterEmail: e.target.value })} placeholder="for updates" />
          </Field>
        </div>
        {work.requesterEmail && ACTIVE_CAN_EDIT && (
          <button type="button" onClick={() => {
            const st = WORK_STATUSES.find((s) => s.key === work.status)?.label || work.status;
            const body = `Hi${work.requestedBy ? ` ${String(work.requestedBy).split(" ")[0]}` : ""},\n\nAn update on the problem you reported${device ? ` (${device.name})` : ""}:\n\n"${work.description}"\n\nStatus: ${st}${work.eta && work.status !== "completed" ? `\nExpected to be fixed by: ${fmtDate(work.eta)}` : ""}${work.status === "completed" ? "\n\nThis has now been completed — please let us know if there's still a problem." : ""}\n\nThanks,\n${currentUserName || "Facilities"}`;
            window.location.href = `mailto:${encodeURIComponent(work.requesterEmail)}?subject=${encodeURIComponent(`Update: ${device?.name || "your request"} — ${st}`)}&body=${encodeURIComponent(body)}`;
            onUpdate({ comments: [...(work.comments || []), { text: `Update emailed to requester (${st})`, by: currentUserName || "Unknown", at: new Date().toISOString() }] });
          }} style={{ background: "var(--ok-soft)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--ok)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Mail size={14} /> Email the requester an update
          </button>
        )}
        {ACTIVE_USERS.length > 0 && (
          <Field label="Assigned to">
            <Select value={work.assignee || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ assignee: e.target.value || null })}>
              <option value="">— Nobody —</option>
              {ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Quote valid until (optional)">
          <TextInput type="date" value={work.quoteValidUntil || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ quoteValidUntil: e.target.value || null })} />
        </Field>
        {ACTIVE_CAN_EDIT && (() => {
          const sup = suppliers.find((x) => x.id === work.supplierId);
          const sla = workSla(work);
          function sendOrder() {
            const lines = [
              `Service / asset: ${device?.name || ""}${device?.assetTag ? ` (#${device.assetTag})` : ""}`,
              `Work required: ${work.description}`, `Priority: ${(work.priority || "medium").replace(/^./, (c) => c.toUpperCase())}`,
              sla && `Please complete by: ${fmtDate(sla.deadline)}`, work.poNumber && `PO number: ${work.poNumber}`,
              Number(work.quoteAmount) ? `Agreed amount: ${gbp(work.quoteAmount)}` : null,
              device?.accessNotes && `Access: ${device.accessNotes}`,
              siteInfoText(),
              (device?.ramsRequired || device?.permits?.length) && `Before starting: ${[device.ramsRequired && "send RAMS", ...(device.permits || []).map((p) => `${p} permit needed`)].filter(Boolean).join(", ")}`,
            ].filter(Boolean);
            window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent(`Work order${work.poNumber ? ` ${work.poNumber}` : ""} — ${device?.name || ""}`)}&body=${encodeURIComponent(`Hi${sup?.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nPlease carry out the following work:\n\n${lines.join("\n")}\n\nPlease confirm receipt and your attendance date.\n\nKind regards,\n${currentUserName || ""}`)}`;
            onUpdate({ comments: [...(work.comments || []), { text: `Work order emailed${sup ? ` to ${sup.name}` : ""}`, by: currentUserName || "Unknown", at: new Date().toISOString() }], ...(work.status === "approved" ? {} : {}) });
          }
          return (
            <button type="button" onClick={sendOrder} style={{ background: "var(--accent-soft)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Send size={14} /> Email work order{sup ? ` to ${sup.name}` : ""}
            </button>
          );
        })()}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <Field label={`Quote / cost (${ACTIVE_CURRENCY_CODE})`}>
            <TextInput type="number" min="0" step="0.01" value={amount} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => setAmount(e.target.value)} onBlur={() => onUpdate({ quoteAmount: amount ? Number(amount) : 0 })} placeholder="0.00" />
          </Field>
          {work.status === "completed" && (
            <Field label={`Final cost (${ACTIVE_CURRENCY_CODE})`}>
              <TextInput type="number" min="0" step="0.01" value={finalCost} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => setFinalCost(e.target.value)} onBlur={() => onUpdate({ finalCost: finalCost === "" ? null : Number(finalCost) })} placeholder="actual" />
            </Field>
          )}
          <Field label="Trade">
            <Select value={work.category || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ category: e.target.value || null })}><option value="">—</option>{WORK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Capex?">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.8, cursor: "pointer", paddingTop: 6 }}><input type="checkbox" checked={!!work.capex} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ capex: e.target.checked || undefined })} style={{ margin: 0 }} /> Capital</label>
          </Field>
          <Field label="Budget type">
            <Select value={work.budgetType || "budgeted"} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ budgetType: e.target.value })}>
              {WORK_BUDGET_TYPES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </Select>
          </Field>
        </div>
        {work.photos && work.photos.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {work.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }} />)}
          </div>
        )}
        {ACTIVE_CAN_EDIT && ["approved", "in_progress", "completed"].includes(work.status) && (
          <div style={{ background: "#F1F4F7", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Turn this into…</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onConvertToPlan} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Budget Plan line</button>
              <button onClick={onConvertToService} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>New service</button>
            </div>
            {(work.convertedTo || []).length > 0 && <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 6 }}>Already converted: {work.convertedTo.map((c) => c.type === "plan" ? "Plan line" : "Service").join(", ")}</div>}
          </div>
        )}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Comments ({comments.length})</div>
          {comments.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--faint)", marginBottom: 8 }}>No comments yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {comments.map((c, i) => (
                <div key={i} style={{ background: "var(--card-hi)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap" }}>{c.text}</div>
                  <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>{c.by} · {new Date(c.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
          )}
          {ACTIVE_CAN_EDIT && (
            <div style={{ display: "flex", gap: 8 }}>
              <TextInput value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add an update…" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} />
              <button onClick={addComment} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 9, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Post</button>
            </div>
          )}
        </div>
        {ACTIVE_CAN_EDIT && (confirmingDelete ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onDelete} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
            <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
            <Trash2 size={13} /> Delete this work
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Capital projects
--------------------------------------------------------- */
export function ProjectsView({ projects, devices, suppliers, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [mode, setMode] = useState("list");
  const list = projects.filter((p) => showDone || p.status !== "complete").sort((a, b) => (a.target || "9999").localeCompare(b.target || "9999"));
  const active = projects.filter((p) => ["approved", "in_progress"].includes(p.status));
  const budget = active.reduce((t, p) => t + (Number(p.budget) || 0), 0);
  const spent = active.reduce((t, p) => t + (Number(p.spent) || 0), 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>Approved & live budget</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(budget)}</div></div>
        <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>Spent so far</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace", color: spent > budget ? "var(--danger)" : "var(--text)" }}>{gbp(spent)}</div></div>
      </div>
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ marginBottom: 10, width: "100%" }}><FolderKanban size={15} /> New project</PrimaryButton>}
      {projects.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <ToggleButton active={mode === "list"} onClick={() => setMode("list")}>List</ToggleButton>
          <ToggleButton active={mode === "timeline"} onClick={() => setMode("timeline")}>Timeline</ToggleButton>
          <button onClick={() => openPrintReport("Projects summary", new Date().toLocaleDateString("en-GB"), tableHtml(["Project", "Status", "Start", "Target", "Budget", "Spent", "Milestones", "Open snags"], projects.map((p) => [`<b>${escapeHtml(p.name)}</b>`, escapeHtml(PROJECT_STATUSES.find((x) => x.key === p.status)?.label || ""), p.start ? fmtDate(p.start) : "", p.target ? fmtDate(p.target) : "", gbp(p.budget || 0), gbp(p.spent || 0), `${(p.milestones || []).filter((m) => m.done).length}/${(p.milestones || []).length}`, String((p.snags || []).filter((x) => !x.done).length)])))} title="Print summary" style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex" }}><Printer size={14} color="#2B4562" /></button>
          <ExportButton label="CSV" filename="projects.csv" rows={[["Project", "Status", "Start", "Target", "Budget", "Spent", "Supplier", "Milestones done", "Milestones", "Open snags", "Notes"], ...projects.map((p) => [p.name, p.status, p.start || "", p.target || "", p.budget || 0, p.spent || 0, suppliers.find((s) => s.id === p.supplierId)?.name || "", (p.milestones || []).filter((m) => m.done).length, (p.milestones || []).length, (p.snags || []).filter((x) => !x.done).length, p.notes || ""])]} />
        </div>
      )}
      {mode === "timeline" && <ProjectTimeline projects={list} onOpen={setEditing} />}
      {mode === "list" && (projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" body="Track bigger one-off jobs — plant replacements, refurbishments, upgrades — with budget, spend, target date and milestones." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((p) => {
            const st = PROJECT_STATUSES.find((s) => s.key === p.status) || PROJECT_STATUSES[0];
            const pct = Number(p.budget) ? Math.round((Number(p.spent) || 0) / Number(p.budget) * 100) : null;
            const ms = p.milestones || []; const late = p.target && daysUntil(p.target) < 0 && p.status !== "complete";
            return (
              <button key={p.id} onClick={() => setEditing(p)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${st.color}`, borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 11.3, color: late ? "var(--danger)" : "var(--faint)", fontWeight: late ? 700 : 500 }}>
                  {p.target ? `${late ? "Was due" : "Target"} ${fmtDate(p.target)}` : "No target date"}{ms.length ? ` · ${ms.filter((m) => m.done).length}/${ms.length} milestones` : ""}{(p.snags || []).filter((x) => !x.done).length ? ` · ${(p.snags || []).filter((x) => !x.done).length} open snags` : ""}{p.supplierId ? ` · ${suppliers.find((s) => s.id === p.supplierId)?.name || ""}` : ""}
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 6, background: "var(--track)", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 100 ? "#C53030" : "#2F855A" }} /></div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{gbp(p.spent || 0)} of {gbp(p.budget)} ({pct}%)</div>
                  </div>
                )}
              </button>
            );
          })}
          {projects.some((p) => p.status === "complete") && <button onClick={() => setShowDone((v) => !v)} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{showDone ? "Hide" : "Show"} completed projects</button>}
        </div>
      ))}
      {editing && <ProjectModal existing={editing.id ? editing : null} devices={devices} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}

export function ProjectModal({ existing, devices, suppliers, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || "");
  const [status, setStatus] = useState(existing?.status || "idea");
  const [budget, setBudget] = useState(existing?.budget ? String(existing.budget) : "");
  const [costs, setCosts] = useState(existing?.costs || []);
  const [costDraft, setCostDraft] = useState({ date: new Date().toISOString().slice(0, 10), desc: "", amount: "" });
  const [spent, setSpent] = useState(existing?.spent ? String(existing.spent) : "");
  const [start, setStart] = useState(existing?.start || "");
  const [target, setTarget] = useState(existing?.target || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [deviceIds, setDeviceIds] = useState(existing?.deviceIds || []);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [milestones, setMilestones] = useState(existing?.milestones || []);
  const [newMs, setNewMs] = useState("");
  const [snags, setSnags] = useState(existing?.snags || []);
  const [newSnag, setNewSnag] = useState("");
  const [snagArea, setSnagArea] = useState("");
  const addSnag = () => { if (!newSnag.trim()) return; setSnags((p) => [...p, { id: uid(), text: newSnag.trim(), area: snagArea.trim(), raised: new Date().toISOString().slice(0, 10), done: false }]); setNewSnag(""); };
  const suggested = devices.filter((d) => replacementYear(d) && replacementYear(d) <= new Date().getFullYear() + 1 && !deviceIds.includes(d.id));
  return (
    <Modal title={existing ? "Project" : "New project"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Project name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Replace AHU 3" /></Field>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{PROJECT_STATUSES.map((s) => <ToggleButton key={s.key} active={status === s.key} onClick={() => setStatus(s.key)}>{s.label}</ToggleButton>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label={`Budget (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label={`Spent (${ACTIVE_CURRENCY_CODE})${costs.length ? " — from the cost log" : ""}`}><TextInput type="number" min="0" value={costs.length ? String(costs.reduce((t, c) => t + (Number(c.amount) || 0), 0)) : spent} disabled={!!costs.length} onChange={(e) => setSpent(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Start"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Target completion"><TextInput type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        </div>
        <Field label="Contractor">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">— None yet —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Related services / assets">
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {deviceIds.map((id) => <ToggleButton key={id} active onClick={() => setDeviceIds((p) => p.filter((x) => x !== id))}>{devices.find((d) => d.id === id)?.name || "?"} ✕</ToggleButton>)}
            <select value="" onChange={(e) => e.target.value && setDeviceIds((p) => [...p, e.target.value])} style={{ ...inputStyle, padding: "7px 8px", fontSize: 12.5 }}>
              <option value="">+ Link a service…</option>
              {devices.filter((d) => !deviceIds.includes(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {!existing && suggested.length > 0 && <span style={{ fontSize: 11, color: "#5B21B6" }}>Due for replacement soon: {suggested.slice(0, 4).map((d) => d.name).join(", ")}</span>}
        </Field>
        <Field label={`Snagging list${snags.length ? ` — ${snags.filter((x) => x.done).length}/${snags.length} cleared` : ""}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {snags.map((sg, i) => (
              <label key={sg.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer", background: sg.done ? "var(--ok-soft)" : "var(--warn-soft)", borderRadius: 7, padding: "5px 8px" }}>
                <input type="checkbox" checked={!!sg.done} onChange={(e) => setSnags((p) => p.map((x, j) => j === i ? { ...x, done: e.target.checked, clearedAt: e.target.checked ? new Date().toISOString().slice(0, 10) : null } : x))} style={{ margin: 0 }} />
                <span style={{ flex: 1, textDecoration: sg.done ? "line-through" : "none" }}>{sg.text}{sg.area ? <span style={{ color: "var(--faint)" }}> · {sg.area}</span> : null}</span>
                <span style={{ fontSize: 10.5, color: "var(--faint)" }}>{sg.done && sg.clearedAt ? `cleared ${fmtDate(sg.clearedAt)}` : fmtDate(sg.raised)}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); setSnags((p) => p.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={12} color="#A3ABB4" /></button>
              </label>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput value={newSnag} onChange={(e) => setNewSnag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSnag(); }} placeholder="e.g. Ceiling tile stained above AHU" style={{ flex: 2, minWidth: 0 }} />
              <TextInput value={snagArea} onChange={(e) => setSnagArea(e.target.value)} placeholder="Where" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" onClick={addSnag} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
            {snags.length > 0 && <button type="button" onClick={() => openPrintReport(`Snagging list — ${name}`, `${snags.filter((x) => !x.done).length} open of ${snags.length}`, tableHtml(["#", "Snag", "Where", "Raised", "Cleared"], snags.map((sg, i) => [String(i + 1), escapeHtml(sg.text), escapeHtml(sg.area || ""), fmtDate(sg.raised), sg.done ? `<span class="ok">${sg.clearedAt ? fmtDate(sg.clearedAt) : "Yes"}</span>` : "☐"])))} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Print snagging list</button>}
          </div>
        </Field>
        <Field label={`Cost log (${costs.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {costs.map((c, i) => <div key={i} style={{ display: "flex", gap: 6, fontSize: 12.3, background: "var(--card-hi)", borderRadius: 7, padding: "5px 8px" }}><span style={{ color: "var(--faint)" }}>{fmtDate(c.date)}</span><span style={{ flex: 1 }}>{c.desc}</span><b>{gbp(c.amount)}</b><button type="button" onClick={() => setCosts((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={12} color="#A3ABB4" /></button></div>)}
            <div style={{ display: "flex", gap: 5 }}>
              <TextInput type="date" value={costDraft.date} onChange={(e) => setCostDraft((p) => ({ ...p, date: e.target.value }))} style={{ width: 140 }} />
              <TextInput value={costDraft.desc} onChange={(e) => setCostDraft((p) => ({ ...p, desc: e.target.value }))} placeholder="e.g. Invoice 2231 — scaffolding" style={{ flex: 1, minWidth: 0 }} />
              <TextInput type="number" min="0" value={costDraft.amount} onChange={(e) => setCostDraft((p) => ({ ...p, amount: e.target.value }))} placeholder="£" style={{ width: 80 }} />
              <button type="button" onClick={() => { if (!costDraft.amount) return; setCosts((p) => [...p, { ...costDraft, amount: Number(costDraft.amount) }]); setCostDraft((p) => ({ ...p, desc: "", amount: "" })); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "0 10px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          </div>
        </Field>
        <Field label="Milestones">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {milestones.map((m, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}>
                <input type="checkbox" checked={!!m.done} onChange={(e) => setMilestones((p) => p.map((x, j) => j === i ? { ...x, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString().slice(0, 10) : null } : x))} style={{ margin: 0 }} />
                <span style={{ flex: 1, textDecoration: m.done ? "line-through" : "none" }}>{m.text}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); setMilestones((p) => p.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={12} color="#A3ABB4" /></button>
              </label>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput value={newMs} onChange={(e) => setNewMs(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newMs.trim()) { setMilestones((p) => [...p, { text: newMs.trim(), done: false }]); setNewMs(""); } }} placeholder="e.g. Quotes received" style={{ flex: 1 }} />
              <button type="button" onClick={() => { if (newMs.trim()) { setMilestones((p) => [...p, { text: newMs.trim(), done: false }]); setNewMs(""); } }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          </div>
        </Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), status, budget: budget ? Number(budget) : 0, spent: costs.length ? costs.reduce((t, c) => t + (Number(c.amount) || 0), 0) : spent ? Number(spent) : 0, costs, start: start || null, target: target || null, supplierId: supplierId || null, deviceIds, notes: notes.trim(), milestones, snags })}><CheckCircle2 size={15} /> Save project</PrimaryButton>}
        {existing && <ConfirmTextDelete label="Delete this project" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Side-by-side quote comparison on an extra work
--------------------------------------------------------- */
export function QuoteComparison({ work, suppliers, currentUserName, onAccept, onChange }) {
  const quotes = work.quotes || [];
  const [adding, setAdding] = useState(false);
  const [qs, setQs] = useState(""); const [qa, setQa] = useState(""); const [qn, setQn] = useState(""); const [qd, setQd] = useState("");
  const cheapest = quotes.length ? Math.min(...quotes.map((q) => q.amount)) : null;
  function add() {
    if (!qa) return;
    onChange([...quotes, { id: uid(), supplierId: qs || null, amount: Number(qa), note: qn.trim(), leadTime: qd.trim(), addedBy: currentUserName || "", at: new Date().toISOString() }]);
    setQs(""); setQa(""); setQn(""); setQd(""); setAdding(false);
  }
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: quotes.length || adding ? 8 : 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Quotes to compare ({quotes.length})</span>
        {ACTIVE_CAN_EDIT && !adding && <button onClick={() => setAdding(true)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add quote</button>}
      </div>
      {quotes.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: "var(--faint)", fontSize: 10.5, textAlign: "left" }}><th style={{ padding: 4 }}>Supplier</th><th style={{ padding: 4, textAlign: "right" }}>Amount</th><th style={{ padding: 4 }}>Lead time</th><th style={{ padding: 4 }}>Notes</th><th /></tr></thead>
            <tbody>
              {quotes.map((q) => {
                const name = suppliers.find((s) => s.id === q.supplierId)?.name || "Other / not listed";
                const best = q.amount === cheapest && quotes.length > 1;
                return (
                  <tr key={q.id} style={{ borderTop: "1px solid var(--border)", background: q.accepted ? "var(--ok-soft)" : "none" }}>
                    <td style={{ padding: 4, fontWeight: 650 }}>{name}{q.accepted && <span style={{ color: "var(--ok)" }}> ✓</span>}</td>
                    <td style={{ padding: 4, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: best ? "var(--ok)" : "var(--text)" }}>{gbp(q.amount)}{best && <div style={{ fontSize: 9.5, fontFamily: "inherit" }}>lowest</div>}</td>
                    <td style={{ padding: 4, color: "var(--muted)" }}>{q.leadTime || "—"}</td>
                    <td style={{ padding: 4, color: "var(--muted)" }}>{q.note || "—"}</td>
                    <td style={{ padding: 4, textAlign: "right", whiteSpace: "nowrap" }}>
                      {ACTIVE_CAN_EDIT && !q.accepted && <button onClick={() => onAccept(q, quotes.map((x) => ({ ...x, accepted: x.id === q.id })))} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept</button>}
                      {ACTIVE_CAN_EDIT && <button onClick={() => onChange(quotes.filter((x) => x.id !== q.id))} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}><X size={12} color="#A3ABB4" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Select value={qs} onChange={(e) => setQs(e.target.value)} style={{ flex: 2, fontSize: 12.5 }}>
              <option value="">Supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <TextInput type="number" min="0" value={qa} onChange={(e) => setQa(e.target.value)} placeholder="Amount" style={{ flex: 1, fontSize: 12.5 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={qd} onChange={(e) => setQd(e.target.value)} placeholder="Lead time (e.g. 2 weeks)" style={{ flex: 1, fontSize: 12.5 }} />
            <TextInput value={qn} onChange={(e) => setQn(e.target.value)} placeholder="Notes / inclusions" style={{ flex: 1, fontSize: 12.5 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={add} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Add quote</button>
            <button onClick={() => setAdding(false)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}
      {quotes.length > 1 && !quotes.some((q) => q.accepted) && <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 6 }}>Accepting a quote sets this job's supplier and amount (the approval rule then applies to that amount).</div>}
    </div>
  );
}

function WorkLinks({ links, onChange }) {
  const [label, setLabel] = useState(""); const [url, setUrl] = useState("");
  if (!onChange && !links.length) return null;
  return (
    <Field label="Documents & links (quotes, photos, reports)">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {links.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12.8, color: "var(--accent)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {l.label}</a>
            {onChange && <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>}
          </div>
        ))}
        {onChange && (
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ width: "32%" }} />
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={{ flex: 1, minWidth: 0 }} />
            <button type="button" onClick={() => { if (!url.trim()) return; onChange([...links, { label: label.trim() || "Document", url: /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}` }]); setLabel(""); setUrl(""); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "0 11px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        )}
      </div>
    </Field>
  );
}

function ProjectTimeline({ projects, onOpen }) {
  const dated = projects.filter((p) => p.start || p.target);
  if (!dated.length) return <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 16 }}>Add start and target dates to projects to see them on the timeline.</div>;
  const toM = (d) => { const x = new Date(d + "T00:00:00"); return x.getFullYear() * 12 + x.getMonth(); };
  const today = new Date().toISOString().slice(0, 10);
  const lo = Math.min(...dated.map((p) => toM(p.start || p.target)), toM(today)); const hi = Math.max(...dated.map((p) => toM(p.target || p.start)), toM(today)) + 1;
  const span = Math.max(1, hi - lo);
  const months = Array.from({ length: span }, (_, i) => { const y = Math.floor((lo + i) / 12); const m = (lo + i) % 12; return new Date(y, m, 1).toLocaleDateString("en-GB", { month: "short" }); });
  const pos = (d) => { const x = new Date(d + "T00:00:00"); return ((toM(d) - lo) + (x.getDate() - 1) / 31) / span * 100; };
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 10, overflowX: "auto", marginBottom: 10 }}>
      <div style={{ minWidth: Math.max(320, span * 48) }}>
        <div style={{ display: "flex", marginLeft: 110 }}>{months.map((m, i) => <div key={i} style={{ flex: 1, fontSize: 10, color: "var(--faint)", borderLeft: "1px solid var(--border)", paddingLeft: 3 }}>{m}</div>)}</div>
        {dated.map((p) => {
          const st = PROJECT_STATUSES.find((x) => x.key === p.status) || PROJECT_STATUSES[0];
          const a = pos(p.start || p.target); const b = pos(p.target || p.start) + 1.5;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", height: 26 }}>
              <button onClick={() => onOpen(p)} style={{ width: 110, flexShrink: 0, background: "none", border: "none", padding: "0 6px 0 0", fontSize: 11.5, fontWeight: 650, textAlign: "left", cursor: "pointer", fontFamily: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</button>
              <div style={{ flex: 1, position: "relative", height: 14 }}>
                <div style={{ position: "absolute", left: `${pos(today)}%`, top: -6, bottom: -6, width: 1.5, background: "#C53030" }} />
                <div onClick={() => onOpen(p)} title={`${p.start ? fmtDate(p.start) : "?"} → ${p.target ? fmtDate(p.target) : "?"}`} style={{ position: "absolute", left: `${a}%`, width: `${Math.max(1.5, b - a)}%`, top: 0, bottom: 0, background: st.color, borderRadius: 4, opacity: 0.85, cursor: "pointer" }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4, marginLeft: 110 }}>Red line = today. Colours show status.</div>
      </div>
    </div>
  );
}

function ChaseWorksModal({ works, suppliers, deviceById, locationName, onClose, onSent }) {
  const groups = {}; works.forEach((w) => { (groups[w.supplierId] = groups[w.supplierId] || []).push(w); });
  const [sent, setSent] = useState([]);
  function send(sid) {
    const sup = suppliers.find((s) => s.id === sid); const list = groups[sid];
    const lines = list.map((w) => `- ${deviceById[w.deviceId]?.name || "Service"}: ${w.description}${w.poNumber ? ` (PO ${w.poNumber})` : ""} — target was ${fmtDate(workSla(w).deadline)}`);
    const body = `Hi${sup?.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nThe following job${list.length === 1 ? " is" : "s are"} past the agreed completion date at ${locationName}:\n\n${lines.join("\n")}\n\nPlease confirm when ${list.length === 1 ? "it" : "they"} will be completed.\n\nKind regards`;
    window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent(`Overdue jobs — ${locationName}`)}&body=${encodeURIComponent(body)}`;
    onSent?.(list.map((w) => w.id), sup?.name); setSent((p) => [...p, sid]);
  }
  return (
    <Modal title="Chase overdue jobs" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>One email per supplier listing their jobs past target. Each chase is noted on the job.</div>
        {Object.entries(groups).map(([sid, list]) => (
          <div key={sid} style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{suppliers.find((s) => s.id === sid)?.name || "Supplier"}</div>
              <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{list.length} overdue: {list.map((w) => String(w.description).slice(0, 30)).join(", ")}</div>
            </div>
            <button onClick={() => send(sid)} style={{ background: sent.includes(sid) ? "var(--ok-soft)" : "var(--accent)", color: sent.includes(sid) ? "var(--ok)" : "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{sent.includes(sid) ? "Sent ✓" : "Email"}</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* Labour, materials and stock used on a job — adds up to a cost you can use as the final cost. */
function LabourMaterials({ work, onUpdate, spares = [], onUseSpare }) {
  const [open, setOpen] = useState(!!(work.lines || []).length || !!(work.partsUsed || []).length);
  const [d, setD] = useState({ type: "labour", desc: "", qty: "", rate: "" });
  const [spareId, setSpareId] = useState(""); const [spareQty, setSpareQty] = useState("1");
  const lines = work.lines || []; const parts = work.partsUsed || [];
  const total = lines.reduce((t, l) => t + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0) + parts.reduce((t, p) => t + (Number(p.qty) || 0) * (Number(p.unitCost) || 0), 0);
  if (!open) return ACTIVE_CAN_EDIT ? <button type="button" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>+ Record labour, materials or spares used</button> : null;
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}><span>Labour & materials</span><span>{gbp(total)}</span></div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 6, fontSize: 12.3, alignItems: "center" }}>
          <span style={{ flex: 1 }}>{l.type === "labour" ? "👷" : "📦"} {l.desc || (l.type === "labour" ? "Labour" : "Materials")} — {l.qty} {l.type === "labour" ? "h" : "×"} {gbp(l.rate)}</span>
          <b>{gbp((Number(l.qty) || 0) * (Number(l.rate) || 0))}</b>
          {ACTIVE_CAN_EDIT && <button type="button" onClick={() => onUpdate({ lines: lines.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={12} color="#A3ABB4" /></button>}
        </div>
      ))}
      {parts.map((p, i) => <div key={`p${i}`} style={{ fontSize: 12.3, display: "flex", gap: 6 }}><span style={{ flex: 1 }}>🔧 {p.qty} × {p.name} (from stock)</span><b>{gbp((Number(p.qty) || 0) * (Number(p.unitCost) || 0))}</b></div>)}
      {ACTIVE_CAN_EDIT && (
        <>
          <div style={{ display: "flex", gap: 5 }}>
            <select value={d.type} onChange={(e) => setD((p) => ({ ...p, type: e.target.value }))} style={{ ...inputStyle, width: 100, fontSize: 12 }}><option value="labour">Labour</option><option value="material">Materials</option></select>
            <TextInput value={d.desc} onChange={(e) => setD((p) => ({ ...p, desc: e.target.value }))} placeholder="What" style={{ flex: 1, minWidth: 0 }} />
            <TextInput type="number" min="0" step="0.25" value={d.qty} onChange={(e) => setD((p) => ({ ...p, qty: e.target.value }))} placeholder={d.type === "labour" ? "hrs" : "qty"} style={{ width: 58 }} />
            <TextInput type="number" min="0" step="0.01" value={d.rate} onChange={(e) => setD((p) => ({ ...p, rate: e.target.value }))} placeholder="£ each" style={{ width: 70 }} />
            <button type="button" onClick={() => { if (!d.qty || !d.rate) return; onUpdate({ lines: [...lines, { ...d, qty: Number(d.qty), rate: Number(d.rate) }] }); setD({ type: d.type, desc: "", qty: "", rate: d.rate }); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
          {spares.length > 0 && onUseSpare && (
            <div style={{ display: "flex", gap: 5 }}>
              <select value={spareId} onChange={(e) => setSpareId(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 12 }}><option value="">Use a spare part from stock…</option>{spares.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} ({sp.qty} in stock)</option>)}</select>
              <TextInput type="number" min="1" value={spareQty} onChange={(e) => setSpareQty(e.target.value)} style={{ width: 54 }} />
              <button type="button" onClick={() => { if (!spareId) return; onUseSpare(spareId, Number(spareQty) || 1); setSpareId(""); setSpareQty("1"); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Use</button>
            </div>
          )}
          {total > 0 && Number(work.finalCost) !== Math.round(total * 100) / 100 && <button type="button" onClick={() => onUpdate({ finalCost: Math.round(total * 100) / 100 })} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--ok)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Use {gbp(total)} as the final cost</button>}
        </>
      )}
    </div>
  );
}

function ImportWorksModal({ devices, suppliers, onClose, onImport }) {
  const [text, setText] = useState(""); const [rows, setRows] = useState(null); const [err, setErr] = useState("");
  const all = rows || (text.trim() ? parseDelimited(text) : []);
  const norm = (h) => String(h || "").trim().toLowerCase();
  const hi = Math.max(0, all.findIndex((r) => r.some((h) => ["description", "job", "work", "problem"].includes(norm(h)))));
  const head = (all[hi] || []).map(norm); const col = (...n) => head.findIndex((h) => n.includes(h));
  const ix = { desc: col("description", "job", "work", "problem"), svc: col("service", "asset", "equipment"), pr: col("priority"), sup: col("supplier", "contractor"), q: col("quote", "cost", "amount", "value"), d: col("date", "raised", "date raised"), st: col("status") };
  const findDev = (v) => { const t = norm(v); return devices.find((d) => norm(d.name) === t) || devices.find((d) => t && norm(d.name).includes(t)); };
  const parsed = all.slice(hi + 1).map((r) => { const g = (k) => (ix[k] >= 0 ? String(r[ix[k]] ?? "").trim() : ""); const dev = findDev(g("svc")); const sup = suppliers.find((s) => norm(s.name) === norm(g("sup"))); const pr = norm(g("pr")); const st = norm(g("st"));
    return { description: g("desc"), device: dev, deviceId: dev?.id, priority: ["high", "urgent", "p1"].includes(pr) ? "high" : ["low", "p3"].includes(pr) ? "low" : "medium", supplierId: sup?.id || dev?.supplierId || null, quoteAmount: Number(g("q").replace(/[£$€,]/g, "")) || 0, dateRaised: toISO(g("d")) || new Date().toISOString().slice(0, 10), status: WORK_STATUSES.find((x) => norm(x.label) === st || x.key === st)?.key || "requested" }; }).filter((p) => p.description);
  const ok = parsed.filter((p) => p.deviceId);
  async function file(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setErr(""); try { if (/\.xlsx$/i.test(f.name)) { const { readSpreadsheetRows } = await import("../lib/excelTemplate.js"); setRows(await readSpreadsheetRows(await f.arrayBuffer())); setText(""); } else { setRows(null); setText(await f.text()); } } catch (x) { setErr("Couldn't read that file — try pasting the cells instead."); } }
  return (
    <Modal title="Import jobs" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Columns: <b>Description</b> and <b>Service</b> (matched to your service names), and optionally Priority, Supplier, Quote, Date, Status. Handy for moving jobs over from a helpdesk or spreadsheet.</div>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Upload size={14} /> Upload Excel or CSV<input type="file" accept=".xlsx,.csv,.txt" onChange={file} style={{ display: "none" }} /></label>
        <TextArea value={text} onChange={(e) => { setText(e.target.value); setRows(null); }} placeholder="…or paste cells here" style={{ minHeight: 90, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
        {err && <div style={{ fontSize: 12, color: "var(--danger)" }}>{err}</div>}
        {parsed.length > 0 && <div style={{ fontSize: 12.5 }}>{ok.length} of {parsed.length} jobs matched to a service{parsed.length > ok.length ? <span style={{ color: "var(--warn)" }}> — {parsed.length - ok.length} skipped (service name not found)</span> : ""}</div>}
        {ok.slice(0, 6).map((p, i) => <div key={i} style={{ fontSize: 12, background: "var(--card-hi)", borderRadius: 7, padding: "5px 8px" }}><b>{p.device.name}</b> · {p.description} · {p.priority}{p.quoteAmount ? ` · ${gbp(p.quoteAmount)}` : ""}</div>)}
        <PrimaryButton onClick={() => ok.length && onImport(ok.map(({ device, ...w }) => w))} style={{ opacity: ok.length ? 1 : 0.5 }}><Upload size={15} /> Import {ok.length} job{ok.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}
