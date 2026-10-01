// Reactive works and projects.
import { useState } from "react";
import { CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, FolderKanban, Mail, Receipt, Send, Square, Timer, Trash2, X } from "lucide-react";
import { BudgetTypeTag, CategoryBadge, ConfirmTextDelete, CustomFieldInputs, EmptyState, ExportButton, Field, Modal, PrimaryButton, PriorityTag, Select, TextArea, TextInput, ToggleButton, WorkStatusTag, inputStyle } from "../components/ui.jsx";
import { PRIORITY_RANK, PROJECT_STATUSES, SLA_DAYS, WORK_BUDGET_TYPES, WORK_PRIORITIES, WORK_STATUSES } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE, ACTIVE_SLA, ACTIVE_USERS, siteInfoText } from "../lib/globals.js";
import { addDays, daysUntil, escapeHtml, fmtDate, gbp, replacementYear, uid, workSla } from "../lib/utils.js";
import { openPrintReport, tableHtml } from "../lib/reports.js";

export function WorksTab({ onConvertToProject, slaWorkingDays = false, onBulkUpdate, onSetSla, works, deviceById, supplierById, suppliers, onUpdate, onDelete, onAdd, hasDevices, currentUserName, approvalThreshold = 0, onSetThreshold, onConvertToPlan, onConvertToService }) {
  const needsApproval = (w) => approvalThreshold > 0 && Number(w.quoteAmount) >= approvalThreshold && !w.approvedBy && w.status !== "rejected" && w.status !== "completed";
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState(String(approvalThreshold || ""));
  const [statusFilter, setStatusFilter] = useState("open"); // 'open' | 'requested' | 'all' | 'closed'
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
    .filter((w) => statusFilter === "all" ? true : statusFilter === "closed" ? isClosed(w) : statusFilter === "requested" ? w.status === "requested" : !isClosed(w))
    .sort((a, b) => (PRIORITY_RANK[a.priority || "medium"] - PRIORITY_RANK[b.priority || "medium"]) || (b.dateRaised || "").localeCompare(a.dateRaised || ""));
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
            <span style={{ fontSize: 11.5, color: "#5B6672" }}>Approval over</span>
            <TextInput type="number" min="0" value={thresholdDraft} onChange={(e) => setThresholdDraft(e.target.value)} style={{ width: 90, padding: "6px 8px" }} />
            <button onClick={() => { onSetThreshold?.(Number(thresholdDraft) || 0); setEditingThreshold(false); }} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          </div>
        ) : (
          <button onClick={() => ACTIVE_CAN_EDIT && setEditingThreshold(true)} style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, color: "#5B6672", cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
            {approvalThreshold > 0 ? <>Quotes over <b>{gbp(approvalThreshold)}</b> need approval{ACTIVE_CAN_EDIT ? " · edit" : ""}</> : <>No approval rule{ACTIVE_CAN_EDIT ? " · set one" : ""}</>}
          </button>
        )}
        <ExportButton rows={csvRows} filename="extra-works.csv" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Budgeted total</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(budgetedTotal)}</div>
        </div>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#8A5A0B", fontWeight: 600 }}>Non-controllable</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: "#8A5A0B" }}>{gbp(nonControllableTotal)}</div>
        </div>
      </div>
      {slaEdit ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontSize: 11.5, color: "#5B6672" }}>
          Target days —
          {["high", "medium", "low"].map((k) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>{k}
              <TextInput type="number" min="0" value={slaEdit[k]} onChange={(e) => setSlaEdit((p) => ({ ...p, [k]: e.target.value }))} style={{ width: 52, padding: "4px 6px" }} />
            </label>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={!!slaEdit.wd} onChange={(e) => setSlaEdit((p) => ({ ...p, wd: e.target.checked }))} style={{ margin: 0 }} /> working days only</label>
          <button onClick={() => { onSetSla?.({ high: Number(slaEdit.high) || 1, medium: Number(slaEdit.medium) || 7, low: Number(slaEdit.low) || 28 }, slaEdit.wd); setSlaEdit(null); }} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
        </div>
      ) : (
        <button onClick={() => ACTIVE_CAN_EDIT && onSetSla && setSlaEdit({ ...ACTIVE_SLA, wd: slaWorkingDays })} style={{ background: "none", border: "none", padding: 0, fontSize: 10.5, color: "#8A94A0", marginBottom: 8, cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
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
              <div key={st.key} style={{ minWidth: 200, width: 200, flexShrink: 0, background: "#E6E9EC", borderRadius: 12, padding: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 750, color: "#3A4451", marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{st.label}</span><span style={{ color: "#8A94A0" }}>{col.length}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {col.map((w) => {
                    const sla = workSla(w);
                    return (
                      <div key={w.id} style={{ background: "#fff", borderRadius: 9, padding: 8, borderLeft: `3px solid ${(WORK_PRIORITIES.find((p) => p.key === (w.priority || "medium")) || {}).color || "#8A94A0"}` }}>
                        <button onClick={() => setOpenWorkId(w.id)} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                          <div style={{ fontSize: 12.3, fontWeight: 700 }}>{deviceById[w.deviceId]?.name || "Service"}</div>
                          <div style={{ fontSize: 11.5, color: "#3A4451", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{w.description}</div>
                          <div style={{ fontSize: 10.5, color: sla?.breached && !sla.done ? "#C53030" : "#8A94A0", fontWeight: sla?.breached && !sla.done ? 700 : 500, marginTop: 3 }}>{gbp(w.quoteAmount)}{w.assignee ? ` · ${w.assignee}` : ""}{sla && !sla.done ? ` · ${sla.breached ? "overdue" : `by ${fmtDate(sla.deadline)}`}` : ""}</div>
                        </button>
                        {ACTIVE_CAN_EDIT && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <button disabled={si === 0} onClick={() => onUpdate(w.id, { status: arr[si - 1].key })} title={si ? `Move to ${arr[si - 1].label}` : ""} style={{ background: "#EEF0F2", border: "none", borderRadius: 6, padding: "2px 8px", cursor: si ? "pointer" : "default", opacity: si ? 1 : 0.3, display: "flex" }}><ChevronLeft size={13} /></button>
                            <button disabled={si === arr.length - 1} onClick={() => onUpdate(w.id, { status: arr[si + 1].key })} title={si < arr.length - 1 ? `Move to ${arr[si + 1].label}` : ""} style={{ background: "#EEF0F2", border: "none", borderRadius: 6, padding: "2px 8px", cursor: si < arr.length - 1 ? "pointer" : "default", opacity: si < arr.length - 1 ? 1 : 0.3, display: "flex" }}><ChevronRight size={13} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {col.length === 0 && <div style={{ fontSize: 11, color: "#A3ABB4", textAlign: "center", padding: 8 }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {layout === "board" && <div style={{ fontSize: 10.5, color: "#8A94A0", marginBottom: 12 }}>Use the arrows to move a job along. Completed shows the last 30 days.</div>}
      {layout === "list" && <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <ToggleButton active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Open</ToggleButton>
        <ToggleButton active={statusFilter === "requested"} onClick={() => setStatusFilter("requested")}>New requests{requestedCount ? ` (${requestedCount})` : ""}</ToggleButton>
        <ToggleButton active={statusFilter === "closed"} onClick={() => setStatusFilter("closed")}>Closed</ToggleButton>
        <ToggleButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</ToggleButton>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "#A3ABB4", fontSize: 12.5, padding: "24px 0" }}>Nothing in this view.</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((w) => {
          const dev = deviceById[w.deviceId];
          const assignee = w.supplierId ? supplierById[w.supplierId] : null;
          const commentCount = (w.comments || []).length;
          return (
            <button key={w.id} onClick={() => selecting ? toggleSel(w.id) : setOpenWorkId(w.id)} style={{ outline: selecting && selected.includes(w.id) ? "2px solid #2B4562" : "none", background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${(WORK_PRIORITIES.find((p) => p.key === (w.priority || "medium")) || WORK_PRIORITIES[1]).color}`, borderRadius: 12, padding: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}>{selecting && (selected.includes(w.id) ? <CheckSquare size={17} color="#2B4562" /> : <Square size={17} color="#A3ABB4" />)}{dev ? dev.name : "Unknown service"}</div>
                  <div style={{ fontSize: 12, color: "#8A94A0", marginTop: 2 }}>Raised {fmtDate(w.dateRaised)}{w.requestedBy ? ` by ${w.requestedBy}` : ""}</div>
                </div>
                <WorkStatusTag status={w.status} />
              </div>
              <div style={{ margin: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <PriorityTag priority={w.priority || "medium"} />
                {(() => {
                  const sla = workSla(w); if (!sla) return null;
                  if (sla.done) return sla.breached ? <span style={{ fontSize: 11, fontWeight: 700, color: "#9B2C2C", background: "#FBEAEA", padding: "3px 8px", borderRadius: 20 }}>Completed late</span> : null;
                  return <span style={{ fontSize: 11, fontWeight: 700, color: sla.breached ? "#fff" : sla.dueSoon ? "#8A5A0B" : "#5B6672", background: sla.breached ? "#C53030" : sla.dueSoon ? "#FDF1E0" : "#EEF0F2", padding: "3px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 3 }}><Timer size={10} /> {sla.breached ? `Overdue since ${fmtDate(sla.deadline)}` : `Target ${fmtDate(sla.deadline)}`}</span>;
                })()}
                {w.quoteValidUntil && ["quoted", "requested"].includes(w.status) && daysUntil(w.quoteValidUntil) <= 14 && <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(w.quoteValidUntil) < 0 ? "#9B2C2C" : "#8A5A0B", background: daysUntil(w.quoteValidUntil) < 0 ? "#FBEAEA" : "#FDF1E0", padding: "3px 8px", borderRadius: 20 }}>{daysUntil(w.quoteValidUntil) < 0 ? "Quote expired" : `Quote valid to ${fmtDate(w.quoteValidUntil)}`}</span>}
                {needsApproval(w) && <span style={{ fontSize: 11, fontWeight: 700, color: "#8A5A0B", background: "#FDF1E0", padding: "3px 8px", borderRadius: 20 }}>Needs approval</span>}
                {w.approvedBy && <span style={{ fontSize: 11, fontWeight: 700, color: "#2F6B4A", background: "#EAF4EE", padding: "3px 8px", borderRadius: 20 }}>✓ Approved</span>}
                {w.poNumber && <span style={{ fontSize: 11, fontWeight: 700, color: "#2B4562", background: "#EEF0F2", padding: "3px 8px", borderRadius: 20 }}>PO {w.poNumber}</span>}
                {w.finalCost != null && Number(w.quoteAmount) > 0 && (() => { const v = Number(w.finalCost) - Number(w.quoteAmount); const pct = Math.round((v / Number(w.quoteAmount)) * 100); return <span style={{ fontSize: 11, fontWeight: 700, color: v > 0 ? "#9B2C2C" : "#2F6B4A", background: v > 0 ? "#FBEAEA" : "#EAF4EE", padding: "3px 8px", borderRadius: 20 }}>Final {gbp(w.finalCost)} ({v > 0 ? "+" : ""}{pct}%)</span>; })()}
                {w.eta && !["completed", "rejected"].includes(w.status) && <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(w.eta) < 0 ? "#9B2C2C" : "#2B4562", background: daysUntil(w.eta) < 0 ? "#FBEAEA" : "#EAF1F8", padding: "3px 8px", borderRadius: 20 }}>Supplier ETA {fmtDate(w.eta)}</span>}
                {(w.links || []).length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#2B4562", background: "#EEF0F2", padding: "3px 8px", borderRadius: 20 }}>📎 {w.links.length}</span>}
                {w.incidentId && <span style={{ fontSize: 11, fontWeight: 700, color: "#9B2C2C", background: "#FBEAEA", padding: "3px 8px", borderRadius: 20 }}>From incident</span>}
                <CategoryBadge category={dev?.serviceCategory} />
                <BudgetTypeTag type={w.budgetType} />
              </div>
              <p style={{ fontSize: 13.5, color: "#3A4451", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{w.description}</p>
              {w.photos && w.photos.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
                  {w.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #E1E4E8" }} />)}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#8A94A0" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: "#1B2430" }}>{gbp(w.quoteAmount)}</span>
                <span>{assignee ? assignee.name : "Unassigned"} · {commentCount} comment{commentCount === 1 ? "" : "s"}</span>
              </div>
            </button>
          );
        })}
      </div>
      )}
      </>}
      {selecting && (
        <div style={{ position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", width: "min(440px, calc(100vw - 32px))", background: "#1B2430", borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 6, zIndex: 40, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", flexWrap: "wrap" }}>
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
        <WorkDetailModal work={openWork} device={deviceById[openWork.deviceId]} suppliers={suppliers} currentUserName={currentUserName}
          approvalThreshold={approvalThreshold} needsApproval={needsApproval(openWork)}
          onConvertToProject={onConvertToProject ? () => { onConvertToProject(openWork); setOpenWorkId(null); } : null}
          onConvertToPlan={() => onConvertToPlan?.(openWork)} onConvertToService={() => onConvertToService?.(openWork)}
          onClose={() => setOpenWorkId(null)} onUpdate={(patch) => onUpdate(openWork.id, patch)}
          onDelete={() => { onDelete(openWork.id); setOpenWorkId(null); }} />
      )}
    </div>
  );
}

export function WorkDetailModal({ onConvertToProject, work, device, suppliers, currentUserName, onClose, onUpdate, onDelete, approvalThreshold = 0, needsApproval = false, onConvertToPlan, onConvertToService }) {
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
        <div style={{ fontSize: 13.5, color: "#3A4451", whiteSpace: "pre-wrap" }}>{work.description}</div>
        <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Raised {fmtDate(work.dateRaised)}{work.requestedBy ? ` by ${work.requestedBy}` : work.loggedBy ? ` by ${work.loggedBy}` : ""}{work.source === "checklist" ? " · from a failed checklist item" : work.source === "request" ? " · via request portal" : ""}</div>
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
        {statusMsg && <div style={{ fontSize: 12, color: "#9B2C2C", marginTop: -4 }}>{statusMsg}</div>}
        {needsApproval && (
          <div style={{ background: "#FDF1E0", border: "1px solid #E6D9BC", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A5A0B" }}>Needs approval — quote is {gbp(work.quoteAmount)}, over the {gbp(approvalThreshold)} limit</div>
            {(work.loggedBy || work.requestedBy) === currentUserName && <div style={{ fontSize: 11, color: "#8A5A0B", marginTop: 2 }}>You raised this job — ideally someone else approves it.</div>}
            {ACTIVE_CAN_EDIT && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setStatusMsg(""); onUpdate({ approvedBy: currentUserName || "Unknown", approvedAt: new Date().toISOString(), status: "approved", comments: [...(work.comments || []), { text: `Approved ${gbp(work.quoteAmount)}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] }); }} style={{ flex: 1, background: "#2F855A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Approve</button>
                <button onClick={() => onUpdate({ status: "rejected", comments: [...(work.comments || []), { text: "Quote rejected", by: currentUserName || "Unknown", at: new Date().toISOString() }] })} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
              </div>
            )}
          </div>
        )}
        {work.approvedBy && <div style={{ fontSize: 11.5, color: "#2F6B4A", fontWeight: 650 }}>✓ Approved by {work.approvedBy} on {fmtDate(work.approvedAt?.slice(0, 10))}</div>}
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
          }} style={{ background: "#FDF1E0", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#8A5A0B", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Mail size={14} /> Request approval by email
          </button>
        )}
        <WorkLinks links={work.links || []} onChange={ACTIVE_CAN_EDIT ? (links) => onUpdate({ links }) : null} />
        {onConvertToProject && ACTIVE_CAN_EDIT && !work.projectId && !["completed", "rejected"].includes(work.status) && (
          <button type="button" onClick={onConvertToProject} style={{ background: "none", border: "none", color: "#5B6672", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}><FolderKanban size={13} /> Too big for a work? Turn it into a project</button>
        )}
        {work.projectId && <div style={{ fontSize: 12, color: "#2B4562", fontWeight: 650 }}>✓ Being handled as a project</div>}
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
          }} style={{ background: "#EAF4EE", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2F6B4A", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
            <button type="button" onClick={sendOrder} style={{ background: "#EAF1F8", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
          <Field label="Budget type">
            <Select value={work.budgetType || "budgeted"} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ budgetType: e.target.value })}>
              {WORK_BUDGET_TYPES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </Select>
          </Field>
        </div>
        {work.photos && work.photos.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {work.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #E1E4E8" }} />)}
          </div>
        )}
        {ACTIVE_CAN_EDIT && ["approved", "in_progress", "completed"].includes(work.status) && (
          <div style={{ background: "#F1F4F7", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672", marginBottom: 6 }}>Turn this into…</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onConvertToPlan} style={{ flex: 1, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Budget Plan line</button>
              <button onClick={onConvertToService} style={{ flex: 1, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>New service</button>
            </div>
            {(work.convertedTo || []).length > 0 && <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 6 }}>Already converted: {work.convertedTo.map((c) => c.type === "plan" ? "Plan line" : "Service").join(", ")}</div>}
          </div>
        )}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 6 }}>Comments ({comments.length})</div>
          {comments.length === 0 ? (
            <div style={{ fontSize: 12, color: "#A3ABB4", marginBottom: 8 }}>No comments yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {comments.map((c, i) => (
                <div key={i} style={{ background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 13, color: "#1B2430", whiteSpace: "pre-wrap" }}>{c.text}</div>
                  <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 3 }}>{c.by} · {new Date(c.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
          )}
          {ACTIVE_CAN_EDIT && (
            <div style={{ display: "flex", gap: 8 }}>
              <TextInput value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add an update…" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} />
              <button onClick={addComment} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Post</button>
            </div>
          )}
        </div>
        {ACTIVE_CAN_EDIT && (confirmingDelete ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onDelete} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
            <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
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
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Approved & live budget</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(budget)}</div></div>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Spent so far</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace", color: spent > budget ? "#C53030" : "#1B2430" }}>{gbp(spent)}</div></div>
      </div>
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ marginBottom: 10, width: "100%" }}><FolderKanban size={15} /> New project</PrimaryButton>}
      {projects.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <ToggleButton active={mode === "list"} onClick={() => setMode("list")}>List</ToggleButton>
          <ToggleButton active={mode === "timeline"} onClick={() => setMode("timeline")}>Timeline</ToggleButton>
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
              <button key={p.id} onClick={() => setEditing(p)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${st.color}`, borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 11.3, color: late ? "#C53030" : "#8A94A0", fontWeight: late ? 700 : 500 }}>
                  {p.target ? `${late ? "Was due" : "Target"} ${fmtDate(p.target)}` : "No target date"}{ms.length ? ` · ${ms.filter((m) => m.done).length}/${ms.length} milestones` : ""}{(p.snags || []).filter((x) => !x.done).length ? ` · ${(p.snags || []).filter((x) => !x.done).length} open snags` : ""}{p.supplierId ? ` · ${suppliers.find((s) => s.id === p.supplierId)?.name || ""}` : ""}
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 6, background: "#E1E4E8", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 100 ? "#C53030" : "#2F855A" }} /></div>
                    <div style={{ fontSize: 11, color: "#5B6672", marginTop: 2 }}>{gbp(p.spent || 0)} of {gbp(p.budget)} ({pct}%)</div>
                  </div>
                )}
              </button>
            );
          })}
          {projects.some((p) => p.status === "complete") && <button onClick={() => setShowDone((v) => !v)} style={{ background: "none", border: "none", color: "#8A94A0", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{showDone ? "Hide" : "Show"} completed projects</button>}
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
          <Field label={`Spent (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" value={spent} onChange={(e) => setSpent(e.target.value)} /></Field>
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
              <label key={sg.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer", background: sg.done ? "#EAF4EE" : "#FDF1E0", borderRadius: 7, padding: "5px 8px" }}>
                <input type="checkbox" checked={!!sg.done} onChange={(e) => setSnags((p) => p.map((x, j) => j === i ? { ...x, done: e.target.checked, clearedAt: e.target.checked ? new Date().toISOString().slice(0, 10) : null } : x))} style={{ margin: 0 }} />
                <span style={{ flex: 1, textDecoration: sg.done ? "line-through" : "none" }}>{sg.text}{sg.area ? <span style={{ color: "#8A94A0" }}> · {sg.area}</span> : null}</span>
                <span style={{ fontSize: 10.5, color: "#8A94A0" }}>{sg.done && sg.clearedAt ? `cleared ${fmtDate(sg.clearedAt)}` : fmtDate(sg.raised)}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); setSnags((p) => p.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={12} color="#A3ABB4" /></button>
              </label>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput value={newSnag} onChange={(e) => setNewSnag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSnag(); }} placeholder="e.g. Ceiling tile stained above AHU" style={{ flex: 2, minWidth: 0 }} />
              <TextInput value={snagArea} onChange={(e) => setSnagArea(e.target.value)} placeholder="Where" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" onClick={addSnag} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
            {snags.length > 0 && <button type="button" onClick={() => openPrintReport(`Snagging list — ${name}`, `${snags.filter((x) => !x.done).length} open of ${snags.length}`, tableHtml(["#", "Snag", "Where", "Raised", "Cleared"], snags.map((sg, i) => [String(i + 1), escapeHtml(sg.text), escapeHtml(sg.area || ""), fmtDate(sg.raised), sg.done ? `<span class="ok">${sg.clearedAt ? fmtDate(sg.clearedAt) : "Yes"}</span>` : "☐"])))} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Print snagging list</button>}
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
              <button type="button" onClick={() => { if (newMs.trim()) { setMilestones((p) => [...p, { text: newMs.trim(), done: false }]); setNewMs(""); } }} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          </div>
        </Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), status, budget: budget ? Number(budget) : 0, spent: spent ? Number(spent) : 0, start: start || null, target: target || null, supplierId: supplierId || null, deviceIds, notes: notes.trim(), milestones, snags })}><CheckCircle2 size={15} /> Save project</PrimaryButton>}
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
    <div style={{ border: "1px solid #E1E4E8", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: quotes.length || adding ? 8 : 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672" }}>Quotes to compare ({quotes.length})</span>
        {ACTIVE_CAN_EDIT && !adding && <button onClick={() => setAdding(true)} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add quote</button>}
      </div>
      {quotes.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: "#8A94A0", fontSize: 10.5, textAlign: "left" }}><th style={{ padding: 4 }}>Supplier</th><th style={{ padding: 4, textAlign: "right" }}>Amount</th><th style={{ padding: 4 }}>Lead time</th><th style={{ padding: 4 }}>Notes</th><th /></tr></thead>
            <tbody>
              {quotes.map((q) => {
                const name = suppliers.find((s) => s.id === q.supplierId)?.name || "Other / not listed";
                const best = q.amount === cheapest && quotes.length > 1;
                return (
                  <tr key={q.id} style={{ borderTop: "1px solid #EEF0F2", background: q.accepted ? "#EAF4EE" : "none" }}>
                    <td style={{ padding: 4, fontWeight: 650 }}>{name}{q.accepted && <span style={{ color: "#2F6B4A" }}> ✓</span>}</td>
                    <td style={{ padding: 4, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: best ? "#2F855A" : "#1B2430" }}>{gbp(q.amount)}{best && <div style={{ fontSize: 9.5, fontFamily: "inherit" }}>lowest</div>}</td>
                    <td style={{ padding: 4, color: "#5B6672" }}>{q.leadTime || "—"}</td>
                    <td style={{ padding: 4, color: "#5B6672" }}>{q.note || "—"}</td>
                    <td style={{ padding: 4, textAlign: "right", whiteSpace: "nowrap" }}>
                      {ACTIVE_CAN_EDIT && !q.accepted && <button onClick={() => onAccept(q, quotes.map((x) => ({ ...x, accepted: x.id === q.id })))} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept</button>}
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
            <button onClick={add} style={{ flex: 1, background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Add quote</button>
            <button onClick={() => setAdding(false)} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}
      {quotes.length > 1 && !quotes.some((q) => q.accepted) && <div style={{ fontSize: 10.5, color: "#A3ABB4", marginTop: 6 }}>Accepting a quote sets this job's supplier and amount (the approval rule then applies to that amount).</div>}
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
            <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12.8, color: "#2B4562", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {l.label}</a>
            {onChange && <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>}
          </div>
        ))}
        {onChange && (
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ width: "32%" }} />
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={{ flex: 1, minWidth: 0 }} />
            <button type="button" onClick={() => { if (!url.trim()) return; onChange([...links, { label: label.trim() || "Document", url: /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}` }]); setLabel(""); setUrl(""); }} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "0 11px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        )}
      </div>
    </Field>
  );
}

function ProjectTimeline({ projects, onOpen }) {
  const dated = projects.filter((p) => p.start || p.target);
  if (!dated.length) return <div style={{ fontSize: 12.5, color: "#8A94A0", textAlign: "center", padding: 16 }}>Add start and target dates to projects to see them on the timeline.</div>;
  const toM = (d) => { const x = new Date(d + "T00:00:00"); return x.getFullYear() * 12 + x.getMonth(); };
  const today = new Date().toISOString().slice(0, 10);
  const lo = Math.min(...dated.map((p) => toM(p.start || p.target)), toM(today)); const hi = Math.max(...dated.map((p) => toM(p.target || p.start)), toM(today)) + 1;
  const span = Math.max(1, hi - lo);
  const months = Array.from({ length: span }, (_, i) => { const y = Math.floor((lo + i) / 12); const m = (lo + i) % 12; return new Date(y, m, 1).toLocaleDateString("en-GB", { month: "short" }); });
  const pos = (d) => { const x = new Date(d + "T00:00:00"); return ((toM(d) - lo) + (x.getDate() - 1) / 31) / span * 100; };
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 10, overflowX: "auto", marginBottom: 10 }}>
      <div style={{ minWidth: Math.max(320, span * 48) }}>
        <div style={{ display: "flex", marginLeft: 110 }}>{months.map((m, i) => <div key={i} style={{ flex: 1, fontSize: 10, color: "#8A94A0", borderLeft: "1px solid #EEF0F2", paddingLeft: 3 }}>{m}</div>)}</div>
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
        <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 4, marginLeft: 110 }}>Red line = today. Colours show status.</div>
      </div>
    </div>
  );
}
