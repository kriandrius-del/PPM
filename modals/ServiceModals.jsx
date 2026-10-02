// Add/edit service, log a visit, service history, import and service library.
import { useState, useMemo } from "react";
import { Archive, Ban, BookOpen, Camera, CheckCircle2, CheckSquare, ChevronDown, ClipboardList, Copy, Download, FileSpreadsheet, HardHat, ImagePlus, KeyRound, Link2, Loader2, Mail, MapPin, PauseCircle, Pencil, Plus, Printer, RefreshCw, SkipForward, Square, Star, StickyNote, Trash2, TrendingUp, Upload, X } from "lucide-react";
import { Badge, CategoryOptions, ConfirmDeleteButton, CustomFieldInputs, ExportButton, Field, Modal, PhotoStrip, PrimaryButton, Select, SignOffSection, SubCategoryField, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { CHECKLIST_PRESETS, CONDITION_GRADES, CRITICALITY, IMPORT_FIELDS, LATE_REASONS, PERMIT_TYPES, SKIP_REASONS, WORK_BUDGET_TYPES, WORK_CATEGORIES, WORK_PRIORITIES, WORK_STATUSES } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE, ACTIVE_TEMPLATES, ACTIVE_USERS, AREA_SUGGESTIONS_CACHE, CATEGORY_KEYS, CATEGORY_META, PARENT_CANDIDATES_CACHE, TAG_SUGGESTIONS_CACHE } from "../lib/globals.js";
import { buildAssetRecord, buildBlankChecklist, openPrintReport, tableHtml } from "../lib/reports.js";
import { addDays, addMonths, availability, checklistLabel, compressImage, currentDowntime, downloadBlob, dueStatus, escapeHtml, fmtDate, gbp, missingRequiredFields, parseDelimited, parseReading, replacementYear, toCSV, toISO, uid } from "../lib/utils.js";

export function DeviceHistoryModal({ allDevices = [], onOutOfService, works = [], onAddNote, onDeleteNote, device, services, tasks, visitBudgets, supplierById = {}, locationName = "", onClose, onEdit, onAddTask, onUpdateTask, onMarkTaskDone, onDeleteTask, onAddVisitBudget, onUpdateVisitBudget, onDeleteVisitBudget, onSyncBudget }) {
  const sorted = [...services].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const sortedVisitBudgets = [...visitBudgets].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [addingVisitBudget, setAddingVisitBudget] = useState(false);
  const [editingVisitBudget, setEditingVisitBudget] = useState(null);
  return (
    <Modal title={`${device ? device.name : ""}`} onClose={onClose}>
      {device && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {(device.photo || device.area || device.links?.length > 0) && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              {device.photo && <img src={device.photo} alt="" style={{ width: 88, height: 88, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                {device.area && <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {device.area}</div>}
                {(device.links || []).map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Link2 size={12} /> {l.label}</a>
                ))}
              </div>
            </div>
          )}
          {(device.manufacturer || device.model || device.serialNumber || device.installDate || device.warrantyEnd) && (
            <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px" }}>
              {[device.manufacturer, device.model].filter(Boolean).join(" ")}{device.serialNumber ? ` · S/N ${device.serialNumber}` : ""}
              {device.installDate ? ` · Installed ${fmtDate(device.installDate)}` : ""}{device.warrantyEnd ? ` · Warranty to ${fmtDate(device.warrantyEnd)}` : ""}
              {replacementYear(device) ? ` · Replace ${replacementYear(device)}` : ""}
            </div>
          )}
          {(device.accessNotes || device.ramsRequired || device.permits?.length > 0) && (
            <div style={{ fontSize: 12, color: "var(--warn)", background: "var(--warn-soft)", borderRadius: 9, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
              {device.accessNotes && <span><KeyRound size={11} style={{ verticalAlign: -1 }} /> {device.accessNotes}</span>}
              {(device.ramsRequired || device.permits?.length > 0) && <span style={{ fontWeight: 700 }}><HardHat size={11} style={{ verticalAlign: -1 }} /> Needs: {[device.ramsRequired && "RAMS", ...(device.permits || []).map((p) => `${p} permit`)].filter(Boolean).join(", ")}</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => openPrintReport(`Checklist — ${device.name}`, `${locationName}${device.assetTag ? ` · #${device.assetTag}` : ""}`, buildBlankChecklist(device, supplierById))}
            style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ClipboardList size={14} /> Blank checklist
          </button>
          <button onClick={() => openPrintReport(`Asset record — ${device.name}`, `${locationName}${device.assetTag ? ` · #${device.assetTag}` : ""}`, buildAssetRecord(device, services, tasks, supplierById))}
            style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Printer size={14} /> Asset record
          </button>
          <ExportButton label="CSV" filename={`history-${device.name.replace(/[^a-z0-9]+/gi, "-")}.csv`} rows={[["Date", "Visit", "Supplier", "Technician", "Outcome", "Cost", "Labour", "Parts", "Call-out", "Checks passed", "Checks failed", "PO", "Notes"], ...services.map((v) => [v.date, v.name || "", supplierById[v.supplierId]?.name || "", v.technician || "", v.aborted ? `Not completed: ${v.abortReason || ""}` : v.skipped ? `Skipped: ${v.skipReason || ""}` : "Done", v.cost || 0, v.costBreakdown?.labour ?? "", v.costBreakdown?.parts ?? "", v.costBreakdown?.callout ?? "", (v.checklistResults || []).filter((r) => r.result === "pass").length, (v.checklistResults || []).filter((r) => r.result === "fail").length, v.poNumber || "", v.notes || ""])]} />
          </div>
          {(() => {
            const dt = currentDowntime(device); const kids = allDevices.filter((x) => x.parentId === device.id); const parent = allDevices.find((x) => x.id === device.parentId);
            return (
              <>
                {(parent || kids.length > 0) && (
                  <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px" }}>
                    {parent && <div>Part of <b>{parent.name}</b></div>}
                    {kids.length > 0 && <div>Includes: {kids.map((k) => k.name).join(", ")}</div>}
                  </div>
                )}
                <div style={{ background: dt ? "var(--danger-soft)" : "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: dt ? "var(--danger)" : "var(--ok)" }}>{dt ? `Out of service since ${fmtDate(dt.from.slice(0, 10))}${dt.reason ? ` — ${dt.reason}` : ""}` : "In service"}</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{availability(device)}% available (90 days)</span>
                  </div>
                  {ACTIVE_CAN_EDIT && onOutOfService && (dt ? (
                    <button onClick={() => onOutOfService(false)} style={{ background: "#2F855A", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Back in service</button>
                  ) : (
                    <OutOfServiceForm onSubmit={(reason) => onOutOfService(true, reason)} />
                  ))}
                </div>
              </>
            );
          })()}
          <CostHistory device={device} services={services} works={works} />
          <NotesLog notes={device.notesLog || []} onAdd={onAddNote} onDelete={onDeleteNote} />
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Recurring tasks</span>
          {ACTIVE_CAN_EDIT && (
            <button onClick={() => setAddingTask(true)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Add task
            </button>
          )}
        </div>
        {tasks.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--faint)" }}>No extra recurring tasks — this device just follows its main service schedule.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.map((t) => {
              const status = dueStatus(t.nextDate);
              return (
                <div key={t.id} style={{ background: "var(--card-hi)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setEditingTask(t)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 13, fontWeight: 650 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "var(--faint)", display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span>every {t.intervalMonths}mo</span>
                    </div>
                  </button>
                  {ACTIVE_CAN_EDIT && (
                    <button onClick={() => onMarkTaskDone(t.id)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 7, padding: "6px 9px", fontSize: 11, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Mark done</button>
                  )}
                  <ConfirmDeleteButton onConfirm={() => onDeleteTask(t.id)} size={13} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Visit budgets</span>
          {ACTIVE_CAN_EDIT && (
            <button onClick={() => setAddingVisitBudget(true)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Add visit budget
            </button>
          )}
        </div>
        {sortedVisitBudgets.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--faint)" }}>No per-visit budgets set — {device?.budgetPerVisit ? `falls back to the flat ${gbp(device.budgetPerVisit)}/visit budget.` : "add one to budget a specific visit differently, e.g. a bigger amount for a winter service."}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedVisitBudgets.map((v) => (
              <button key={v.id} onClick={() => setEditingVisitBudget(v)} style={{
                background: "var(--card-hi)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{fmtDate(v.date)}</div>
                  {v.note && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{v.note}</div>}
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>{gbp(v.amount)}</span>
              </button>
            ))}
          </div>
        )}
        {ACTIVE_CAN_EDIT && device?.budgetPerVisit > 0 && (
          <button onClick={onSyncBudget} style={{
            width: "100%", marginTop: 8, background: "#F1F4F7", border: "1px dashed var(--border-strong)", borderRadius: 8, padding: "8px 10px",
            fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            <RefreshCw size={12} /> Sync to Budget Plan
          </button>
        )}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Visit history</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--faint)", textAlign: "center", padding: "20px 0" }}>No visits logged yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((s) => (
            <button key={s.id} onClick={() => onEdit(s)} style={{
              background: "var(--card-hi)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%",
            }}>
              <div>
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>{s.name || "Service"}</div>
                <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{fmtDate(s.date)}{s.cost ? ` · ${gbp(s.cost)}` : ""}{s.arrived && s.left ? ` · on site ${s.arrived}–${s.left}` : ""}{s.skipped ? " · skipped" : s.aborted ? " · not completed" : ""}{(s.updatedBy || s.loggedBy) ? ` · ${s.updatedBy || s.loggedBy}` : ""}</div>
              </div>
              <Pencil size={14} color="#8A94A0" />
            </button>
          ))}
        </div>
      )}

      {addingTask && (
        <AddDeviceTaskModal onClose={() => setAddingTask(false)} onSave={(task) => { onAddTask(task); setAddingTask(false); }} />
      )}
      {editingTask && (
        <AddDeviceTaskModal existing={editingTask} onClose={() => setEditingTask(null)}
          onSave={(task) => { onUpdateTask(editingTask.id, task); setEditingTask(null); }}
          onDelete={() => { onDeleteTask(editingTask.id); setEditingTask(null); }} />
      )}
      {addingVisitBudget && (
        <AddVisitBudgetModal onClose={() => setAddingVisitBudget(false)} onSave={(vb) => { onAddVisitBudget(vb); setAddingVisitBudget(false); }} />
      )}
      {editingVisitBudget && (
        <AddVisitBudgetModal existing={editingVisitBudget} onClose={() => setEditingVisitBudget(null)}
          onSave={(vb) => { onUpdateVisitBudget(editingVisitBudget.id, vb); setEditingVisitBudget(null); }}
          onDelete={() => { onDeleteVisitBudget(editingVisitBudget.id); setEditingVisitBudget(null); }} />
      )}
    </Modal>
  );
}

export function AddVisitBudgetModal({ existing, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(existing?.amount ? String(existing.amount) : "");
  const [note, setNote] = useState(existing?.note || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  function submit() {
    if (!amount) return;
    onSave({ date, amount: Number(amount), note: note.trim() });
  }
  return (
    <Modal title={isEdit ? "Edit visit budget" : "Add visit budget"} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Visit date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={`Budgeted amount (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        </div>
        <Field label="Note (optional)"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Winter service — extra parts expected" /></Field>
        <PrimaryButton onClick={submit}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Add visit budget"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onDelete} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this visit budget
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

export function AddDeviceTaskModal({ existing, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name || "");
  const [intervalMonths, setIntervalMonths] = useState(existing?.intervalMonths ? String(existing.intervalMonths) : "1");
  const [nextDate, setNextDate] = useState(existing?.nextDate || new Date().toISOString().slice(0, 10));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  function submit() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), intervalMonths: Number(intervalMonths) || 1, nextDate });
  }
  return (
    <Modal title={isEdit ? "Edit recurring task" : "Add recurring task"} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Task name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Filter change" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Repeats every (months)"><TextInput type="number" min="1" value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} /></Field>
          <Field label="Next due"><TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
        </div>
        <PrimaryButton onClick={submit}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Add task"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onDelete} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this task
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Add Device Modal
--------------------------------------------------------- */
export function AddDeviceModal({ onPause, onResume, onArchive, countries, locations, defaultLocationId, existing, prefill, subcategoriesByCategory, suppliers, onClose, onSave, onDelete, onDuplicate }) {
  const isEdit = !!existing;
  const src = existing || prefill || null; // prefill = duplicating another service
  const [name, setName] = useState(src?.name || "");
  const [assetTag, setAssetTag] = useState(src?.assetTag || "");
  const [category, setCategory] = useState(src?.category || "");
  const [serviceCategory, setServiceCategory] = useState(src?.serviceCategory || "maintenance");
  const [subCategory, setSubCategory] = useState(src?.subCategory || "");
  const [locationId, setLocationId] = useState(src?.locationId || defaultLocationId || locations[0]?.id || "");
  const [supplierId, setSupplierId] = useState(src?.supplierId || "");
  const [checklist, setChecklist] = useState(src?.checklist || []);
  const [custom, setCustom] = useState(src?.custom || {});
  const [templateId, setTemplateId] = useState("");
  const [fieldErr, setFieldErr] = useState("");
  function applyTemplate(id) {
    setTemplateId(id);
    const t = ACTIVE_TEMPLATES.find((x) => x.id === id); if (!t) return;
    if (!name.trim() || ACTIVE_TEMPLATES.some((x) => x.name === name)) setName(t.name);
    if (t.serviceCategory && CATEGORY_META[t.serviceCategory]) setServiceCategory(t.serviceCategory);
    setSubCategory(t.subCategory || ""); setCategory(t.equipmentType || "");
    setChecklist(t.checklist || []);
    if (t.repeat?.mode === "interval") { setRepeat("interval"); setInterval(String(t.repeat.months)); }
    else if (t.repeat?.mode === "custom") { setRepeat("custom"); setCustomCount(String(t.repeat.count)); }
    else if (t.repeat?.mode) setRepeat(t.repeat.mode);
  }
  const [newCheckItem, setNewCheckItem] = useState("");
  function addCheckItem() { if (!newCheckItem.trim()) return; setChecklist((p) => [...p, newCheckItem.trim()]); setNewCheckItem(""); }
  const [interval, setInterval] = useState(src?.serviceIntervalMonths != null ? String(src.serviceIntervalMonths) : "12");
  const [nextDate, setNextDate] = useState(src?.nextServiceDate || new Date().toISOString().slice(0, 10));
  const [budgetPerVisit, setBudgetPerVisit] = useState(src?.budgetPerVisit ? String(src.budgetPerVisit) : "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [manufacturer, setManufacturer] = useState(src?.manufacturer || "");
  const [model, setModel] = useState(src?.model || "");
  const [serialNumber, setSerialNumber] = useState(src?.serialNumber || "");
  const [installDate, setInstallDate] = useState(src?.installDate || "");
  const [warrantyEnd, setWarrantyEnd] = useState(src?.warrantyEnd || "");
  const [area, setArea] = useState(src?.area || "");
  const [photo, setPhoto] = useState(src?.photo || null);
  const [links, setLinks] = useState(src?.links || []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const areaListId = useMemo(() => `areas-${uid()}`, []);
  async function pickPhoto(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setPhotoBusy(true); try { setPhoto(await compressImage(f, 480, 0.6)); } catch (x) { /* ignore */ } setPhotoBusy(false); }
  const [condition, setCondition] = useState(src?.condition || "");
  const [conditionNotes, setConditionNotes] = useState(src?.conditionNotes || "");
  const [criticality, setCriticality] = useState(src?.criticality || "normal");
  const [tags, setTags] = useState((src?.tags || []).join(", "));
  const [parentId, setParentId] = useState(src?.parentId || "");
  const [replacementCost, setReplacementCost] = useState(src?.replacementCost ? String(src.replacementCost) : "");
  const [expectedLifeYears, setExpectedLifeYears] = useState(src?.expectedLifeYears ? String(src.expectedLifeYears) : "");
  const [accessNotes, setAccessNotes] = useState(src?.accessNotes || "");
  const [instructions, setInstructions] = useState(src?.instructions || "");
  const [permits, setPermits] = useState(src?.permits || []);
  const [ramsRequired, setRamsRequired] = useState(!!src?.ramsRequired);
  const [certRequired, setCertRequired] = useState(!!src?.certRequired);
  const [assignee, setAssignee] = useState(src?.assignee || "");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseUntil, setPauseUntil] = useState(addMonths(new Date().toISOString().slice(0, 10), 1));
  const [pauseDrop, setPauseDrop] = useState(true);
  const [showSafety, setShowSafety] = useState(!!(src?.instructions || src?.accessNotes || src?.permits?.length || src?.ramsRequired || src?.certRequired));
  const [showAsset, setShowAsset] = useState(!!(src?.manufacturer || src?.model || src?.serialNumber || src?.installDate || src?.warrantyEnd || src?.photo || src?.links?.length));
  const locationSuppliers = suppliers.filter((s) => s.locationId === locationId);

  // Repeat schedule — same options as Budget Plan contract lines, so setting up
  // a service's visits and its budget lines stay in sync. Only used when adding new.
  const [repeat, setRepeat] = useState(prefill?.repeatMode || (prefill?.serviceIntervalMonths ? "interval" : "once")); // 'once' | 'interval' | 'manual' | 'weekly' | 'monthly' | 'quarterly' | 'custom'
  const [customCount, setCustomCount] = useState("7");
  const [manualDates, setManualDates] = useState([new Date().toISOString().slice(0, 10)]);

  function updateManualDate(i, value) { setManualDates((prev) => prev.map((d, idx) => idx === i ? value : d)); }
  function addManualDate() { setManualDates((prev) => [...prev, prev[prev.length - 1] || nextDate]); }
  function removeManualDate(i) { setManualDates((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev); }

  function submit() {
    if (!name.trim() || !locationId) return;
    const missing = missingRequiredFields("service", serviceCategory, custom);
    if (missing.length) { setFieldErr(`Please fill in: ${missing.join(", ")}`); return; }
    const base = {
      id: existing?.id, name: name.trim(), assetTag: assetTag.trim(), category: category.trim(), serviceCategory,
      subCategory: subCategory.trim(), locationId, supplierId: supplierId || null, checklist, custom,
      lastServiceDate: existing?.lastServiceDate ?? null,
      budgetPerVisit: budgetPerVisit ? Number(budgetPerVisit) : 0,
      manufacturer: manufacturer.trim(), model: model.trim(), serialNumber: serialNumber.trim(),
      installDate: installDate || null, warrantyEnd: warrantyEnd || null,
      expectedLifeYears: expectedLifeYears ? Number(expectedLifeYears) : null, replacementCost: replacementCost ? Number(replacementCost) : null,
      condition: condition || null, conditionNotes: conditionNotes.trim(), conditionDate: condition && condition !== (existing?.condition || "") ? new Date().toISOString().slice(0, 10) : (existing?.conditionDate || null),
      parentId: parentId || null, criticality, tags: [...new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))],
      accessNotes: accessNotes.trim(), instructions: instructions.trim(), permits, ramsRequired, certRequired, assignee: assignee || null,
      area: area.trim(), photo: photo || null, links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim() || "Link", url: /^https?:\/\//i.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}` })),
    };
    if (isEdit) {
      onSave({ ...base, serviceIntervalMonths: interval ? Number(interval) : null, nextServiceDate: nextDate || null });
      return;
    }
    // New service — build the visit schedule based on the chosen repeat pattern.
    // "once" (the default) deliberately makes NO recurring schedule — nextServiceDate
    // clears after that single visit is logged, instead of silently recurring.
    let scheduleDates = [nextDate];
    let intervalMonths = null;
    if (repeat === "interval") {
      intervalMonths = interval ? Number(interval) : null;
      // Still generate a year's worth of linked Budget Plan lines, same as every
      // other recurring mode — this used to be skipped here, which is why a
      // "Recurring every N months" service never showed up in Budget.
      if (intervalMonths) scheduleDates = Array.from({ length: Math.max(1, Math.ceil(12 / intervalMonths)) }, (_, i) => addMonths(nextDate, i * intervalMonths));
    }
    else if (repeat === "manual") { scheduleDates = manualDates.filter(Boolean); intervalMonths = null; }
    else if (repeat === "weekly") { scheduleDates = Array.from({ length: 52 }, (_, i) => addDays(nextDate, i * 7)); intervalMonths = null; }
    else if (repeat === "monthly") { scheduleDates = Array.from({ length: 12 }, (_, i) => addMonths(nextDate, i)); intervalMonths = 1; }
    else if (repeat === "quarterly") { scheduleDates = Array.from({ length: 4 }, (_, i) => addMonths(nextDate, i * 3)); intervalMonths = 3; }
    else if (repeat === "custom") {
      const count = Math.max(1, Number(customCount) || 1);
      const stepDays = Math.round(365 / count);
      scheduleDates = Array.from({ length: count }, (_, i) => addDays(nextDate, i * stepDays));
      intervalMonths = null;
    }
    scheduleDates = scheduleDates.filter(Boolean).sort();
    onSave({
      ...base, serviceIntervalMonths: intervalMonths, nextServiceDate: scheduleDates[0] || nextDate,
      scheduleDates,
    });
  }
  return (
    <Modal title={isEdit ? "Edit service" : prefill ? "Add a copy of a service" : "Add a service"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!isEdit && ACTIVE_TEMPLATES.length > 0 && (
          <Field label="Start from a template (optional)">
            <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— Blank service —</option>
              {ACTIVE_TEMPLATES.some((t) => t.custom) && <optgroup label="Your templates">{ACTIVE_TEMPLATES.filter((t) => t.custom).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
              <optgroup label="Standard templates">{ACTIVE_TEMPLATES.filter((t) => !t.custom).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
            </Select>
            {templateId && ACTIVE_TEMPLATES.find((t) => t.id === templateId)?.note && <span style={{ fontSize: 11, color: "var(--muted)", background: "#F1F4F7", borderRadius: 7, padding: "6px 8px", marginTop: 4 }}>{ACTIVE_TEMPLATES.find((t) => t.id === templateId).note}</span>}
          </Field>
        )}
        <Field label="Service name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rooftop AHU 3, or Cleaning" /></Field>
        <Field label="Location">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {countries.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {locations.filter((l) => l.countryId === c.id).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="How critical is it?">
            <Select value={criticality} onChange={(e) => setCriticality(e.target.value)}>
              {Object.entries(CRITICALITY).map(([k, v]) => <option key={k} value={k}>{v.label}{v.note ? ` — ${v.note}` : ""}</option>)}
            </Select>
          </Field>
          <Field label="Condition">
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Not graded</option>
              {Object.entries(CONDITION_GRADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
        </div>
        {condition && <Field label="Condition notes (optional)"><TextInput value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} placeholder={CONDITION_GRADES[condition].note} /></Field>}
        {(PARENT_CANDIDATES_CACHE[locationId] || []).filter((d) => d.id !== existing?.id).length > 0 && (
          <Field label="Part of (optional)">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Stand-alone —</option>
              {(PARENT_CANDIDATES_CACHE[locationId] || []).filter((d) => d.id !== existing?.id && d.parentId !== existing?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Tags (optional, comma separated)"><TextInput list="ppm-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. roof, landlord, winter" /><datalist id="ppm-tags">{(TAG_SUGGESTIONS_CACHE[locationId] || []).map((t) => <option key={t} value={t} />)}</datalist></Field>
        <Field label="Area / room (optional)">
          <TextInput list={areaListId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Ground floor plant room, Kitchen, Roof" />
          <datalist id={areaListId}>{(AREA_SUGGESTIONS_CACHE[locationId] || []).map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Asset tag"><TextInput value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="AHU-003" /></Field>
          <Field label="Equipment type"><TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="HVAC" /></Field>
        </div>
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => setShowAsset((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
            <span>Asset details — photo, make, model, serial, warranty, documents (optional)</span>
            <ChevronDown size={14} style={{ transform: showAsset ? "rotate(180deg)" : "none" }} />
          </button>
          {showAsset && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Manufacturer"><TextInput value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. Daikin" /></Field>
                <Field label="Model"><TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. FXZQ50A" /></Field>
              </div>
              <Field label="Serial number"><TextInput value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. J0123456" /></Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Installed"><TextInput type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></Field>
                <Field label="Warranty ends"><TextInput type="date" value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} /></Field>
              </div>
              <Field label="Photo of the equipment">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {photo && <img src={photo} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }} />}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer" }}>
                    <ImagePlus size={14} /> {photoBusy ? "Processing…" : photo ? "Change" : "Add photo"}
                    <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display: "none" }} />
                  </label>
                  {photo && <button type="button" onClick={() => setPhoto(null)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                </div>
                <span style={{ fontSize: 10.5, color: "var(--faint)" }}>Helps technicians find the right unit. Saved small to keep storage down.</span>
              </Field>
              <Field label="Documents & links (O&M manual, drawings, SharePoint…)">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {links.map((l, i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <TextInput value={l.label} onChange={(e) => setLinks((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ width: "35%" }} />
                      <TextInput value={l.url} onChange={(e) => setLinks((p) => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" style={{ flex: 1, minWidth: 0 }} />
                      <button type="button" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={14} color="#A3ABB4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setLinks((p) => [...p, { label: "", url: "" }])} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>+ Add a link</button>
                </div>
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Expected life (years)"><TextInput type="number" min="0" value={expectedLifeYears} onChange={(e) => setExpectedLifeYears(e.target.value)} placeholder="e.g. 15" /></Field>
                <Field label={`Replacement cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" value={replacementCost} onChange={(e) => setReplacementCost(e.target.value)} placeholder="estimate" /></Field>
              </div>
              {installDate && Number(expectedLifeYears) > 0 && <span style={{ fontSize: 11, color: "#5B21B6", fontWeight: 600 }}>Replacement due in {Number(installDate.slice(0, 4)) + Number(expectedLifeYears)}</span>}
              <span style={{ fontSize: 10.5, color: "var(--faint)" }}>You'll get a notification 60 days before the warranty ends, and the year before replacement is due.</span>
            </>
          )}
        </div>
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => setShowSafety((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
            <span>Instructions, access &amp; safety — RAMS, permits (optional)</span>
            <ChevronDown size={14} style={{ transform: showSafety ? "rotate(180deg)" : "none" }} />
          </button>
          {showSafety && (
            <>
              <Field label="Instructions for the technician (what to do, where, special steps)"><TextArea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Isolate at DB-3 before opening. Replace both filter banks. Record supply air temperature." /></Field>
              <Field label="Access notes"><TextArea value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="e.g. Plant room key at reception. Access via loading bay. Out of hours only." /></Field>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={ramsRequired} onChange={(e) => setRamsRequired(e.target.checked)} style={{ margin: 0 }} /> RAMS required before work starts
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={certRequired} onChange={(e) => setCertRequired(e.target.checked)} style={{ margin: 0 }} /> Certificate required for every visit (alerts if one is missing)
              </label>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Permits needed</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PERMIT_TYPES.map((p) => (
                  <ToggleButton key={p} active={permits.includes(p)} onClick={() => setPermits((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}>{p}</ToggleButton>
                ))}
              </div>
              <span style={{ fontSize: 10.5, color: "var(--faint)" }}>Shown on the service card and job sheet, and checked when a visit is logged.</span>
            </>
          )}
        </div>
        <Field label="Service category">
          <Select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
            <CategoryOptions />
          </Select>
        </Field>
        <SubCategoryField value={subCategory} onChange={setSubCategory} suggestions={subcategoriesByCategory?.[serviceCategory] || []} />
        {ACTIVE_USERS.length > 0 && (
          <Field label="Responsible person (optional)">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— Nobody in particular —</option>
              {ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Default supplier (optional)">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {locationSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({CATEGORY_META[s.category]?.label})</option>)}
          </Select>
          {locationSuppliers.length === 0 && (
            <span style={{ fontSize: 10.5, color: "var(--faint)" }}>No suppliers added at this location yet — add one from the Suppliers tab first.</span>
          )}
        </Field>
        <Field label={`Budget per visit (${ACTIVE_CURRENCY_CODE}, optional)`}><TextInput type="number" min="0" step="0.01" value={budgetPerVisit} onChange={(e) => setBudgetPerVisit(e.target.value)} placeholder="0.00" /></Field>
        <Field label={`Visit checklist (${checklist.length} item${checklist.length === 1 ? "" : "s"}, optional)`}>
          {checklist.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
              {checklist.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card-hi)", borderRadius: 7, padding: "6px 8px" }}>
                  <CheckCircle2 size={13} color="#8A94A0" />
                  <span style={{ flex: 1, fontSize: 12.5 }}>{item}</span>
                  <button type="button" onClick={() => setChecklist((p) => p.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={13} color="#A3ABB4" /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheckItem(); } }} placeholder="e.g. Filters cleaned" style={{ flex: 1 }} />
            <button type="button" onClick={addCheckItem} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
          {checklist.length === 0 && (
            <button type="button" onClick={() => setChecklist(CHECKLIST_PRESETS[serviceCategory] || [])} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: "4px 0", textAlign: "left" }}>
              + Start from a standard {(CATEGORY_META[serviceCategory] || CATEGORY_META.maintenance).label.toLowerCase()} checklist
            </button>
          )}
          <span style={{ fontSize: 10.5, color: "var(--faint)" }}>Ticked off Pass / Fail / N/A each time a visit is logged. Failed items create follow-up jobs in Works.</span>
        </Field>
        <CustomFieldInputs appliesTo="service" category={serviceCategory} values={custom} onChange={setCustom} />
        {fieldErr && <div style={{ fontSize: 12, color: "var(--danger)" }}>{fieldErr}</div>}

        {isEdit ? (
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Service interval (months)"><TextInput type="number" min="0" value={interval} onChange={(e) => setInterval(e.target.value)} /></Field>
            <Field label="Next visit due"><TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
          </div>
        ) : (
          <>
            <Field label="First visit date"><TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
            <Field label="Repeat">
              <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                <option value="once">One-off — no repeat</option>
                <option value="interval">Recurring — every N months</option>
                <option value="manual">Pick each visit date myself</option>
                <option value="weekly">Weekly (52 visits)</option>
                <option value="monthly">Monthly (12 visits)</option>
                <option value="quarterly">Quarterly (4 visits)</option>
                <option value="custom">Custom — set how many times a year</option>
              </Select>
            </Field>
            {repeat === "interval" && (
              <Field label="Repeats every (months)"><TextInput type="number" min="0" value={interval} onChange={(e) => setInterval(e.target.value)} /></Field>
            )}
            {repeat === "custom" && (
              <Field label="How many times a year">
                <TextInput type="number" min="1" max="365" value={customCount} onChange={(e) => setCustomCount(e.target.value)} placeholder="e.g. 7" />
                <span style={{ fontSize: 11, color: "var(--faint)" }}>Creates {Math.max(1, Number(customCount) || 1)} visits, spaced about {Math.round(365 / Math.max(1, Number(customCount) || 1))} days apart.</span>
              </Field>
            )}
            {repeat === "manual" && (
              <Field label="Visit dates">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {manualDates.map((d, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <TextInput type="date" value={d} onChange={(e) => updateManualDate(i, e.target.value)} style={{ flex: 1 }} />
                      {manualDates.length > 1 && (
                        <button onClick={() => removeManualDate(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Trash2 size={14} color="#C0C6CC" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addManualDate} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 11px", borderRadius: 8,
                    border: "1px dashed var(--border)", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "var(--accent)", fontWeight: 650,
                  }}><Plus size={13} /> Add another visit date</button>
                </div>
              </Field>
            )}
            {(repeat === "once" || repeat === "weekly" || repeat === "monthly" || repeat === "quarterly" || repeat === "custom" || repeat === "manual") && (
              <div style={{ fontSize: 11, color: "var(--faint)", background: "#F1F4F7", borderRadius: 8, padding: "8px 10px" }}>
                This also adds a matching visit budget and Budget → Plan line for each date, using the budget per visit above — so this service and the Budget tab stay in sync.
              </div>
            )}
          </>
        )}
        <PrimaryButton onClick={submit} style={{ marginTop: 6 }}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Save service"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onDelete(existing.id)} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this service
            </button>
          )
        )}
        {isEdit && onDuplicate && ACTIVE_CAN_EDIT && (
          <button type="button" onClick={() => onDuplicate(existing)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, color: "var(--accent)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px" }}>
            <Copy size={13} /> Duplicate this service (e.g. another unit of the same kind)
          </button>
        )}
        {isEdit && onPause && ACTIVE_CAN_EDIT && !existing.archived && (
          existing.pausedUntil && existing.pausedUntil >= new Date().toISOString().slice(0, 10) ? (
            <button type="button" onClick={() => onResume(existing.id)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, color: "var(--accent)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px" }}>
              <PauseCircle size={13} /> Paused until {fmtDate(existing.pausedUntil)} — resume now
            </button>
          ) : pauseOpen ? (
            <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <Field label="Pause until (next due becomes this date)"><TextInput type="date" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} /></Field>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={pauseDrop} onChange={(e) => setPauseDrop(e.target.checked)} style={{ margin: 0 }} /> Remove planned visits and budget lines during the pause
              </label>
              <PrimaryButton onClick={() => pauseUntil && onPause(existing.id, pauseUntil, pauseDrop)}><PauseCircle size={15} /> Pause service</PrimaryButton>
            </div>
          ) : (
            <button type="button" onClick={() => setPauseOpen(true)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <PauseCircle size={13} /> Pause — e.g. area closed or refurbishment (no alerts until it restarts)
            </button>
          )
        )}
        {isEdit && onArchive && ACTIVE_CAN_EDIT && !existing.archived && (
          <button type="button" onClick={() => onArchive(existing.id)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
            <Archive size={13} /> Archive — decommissioned / no longer maintained (keeps history)
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Log Service Modal
--------------------------------------------------------- */
export function LogServiceModal({ spares = [], lastVisit = null, locationName = "", openPermits = [], device, existing, suppliers, visitBudgets, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const defaultName = device ? `${(CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).label} visit` : "Visit";
  const [name, setName] = useState(existing?.name || defaultName);
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [technician, setTechnician] = useState(existing?.technician || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || device?.supplierId || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [visitPo, setVisitPo] = useState(existing?.poNumber || "");
  const [visitCustom, setVisitCustom] = useState(existing?.custom || {});
  const [visitFieldErr, setVisitFieldErr] = useState("");
  const [signatures, setSignatures] = useState(existing?.signatures || {});
  const [gps, setGps] = useState(existing?.gps || null);
  const [showSignoff, setShowSignoff] = useState(!!(existing?.signatures?.technician || existing?.signatures?.site || existing?.gps));
  const [ramsReceived, setRamsReceived] = useState(!!existing?.ramsReceived);
  const [permitRef, setPermitRef] = useState(existing?.permitRef || "");
  const [rating, setRating] = useState(existing?.rating || 0);
  const [lateReason, setLateReason] = useState(existing?.lateReason || "");
  const [aborted, setAborted] = useState(!!existing?.aborted);
  const [skipped, setSkipped] = useState(!!existing?.skipped);
  const [arrived, setArrived] = useState(existing?.arrived || "");
  const [left, setLeft] = useState(existing?.left || "");
  const [skipReason, setSkipReason] = useState(existing?.skipReason || "");
  const [abortReason, setAbortReason] = useState(existing?.abortReason || "");
  const needsRams = !!device?.ramsRequired;
  const needsPermit = (device?.permits || []).length > 0;
  const templateItems = device?.checklist || [];
  const [checkResults, setCheckResults] = useState(() => {
    const prev = existing?.checklistResults || [];
    return templateItems.map((item) => {
      const found = prev.find((r) => r.item === item);
      return { item, result: found?.result || "", note: found?.note || "", value: found?.value ?? "" };
    });
  });
  function setCheck(i, patch) { setCheckResults((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  const [cost, setCost] = useState(existing?.cost ? String(existing.cost) : "");
  const [breakdown, setBreakdown] = useState(existing?.costBreakdown || null);
  const [nextOverride, setNextOverride] = useState("");
  const setPart = (k, v) => setBreakdown((p) => { const n = { ...(p || {}), [k]: v }; const total = ["labour", "parts", "callout", "other"].reduce((t, x) => t + (Number(n[x]) || 0), 0); setCost(total ? String(Math.round(total * 100) / 100) : ""); return n; });
  const [photo, setPhoto] = useState(existing?.certificatePhoto || null);
  const [visitPhotos, setVisitPhotos] = useState(existing?.photos || []);
  const [partsUsed, setPartsUsed] = useState(existing?.partsUsed || []);
  const deviceSpares = spares.filter((sp) => (sp.deviceIds || []).includes(device?.id));
  const otherSpares = spares.filter((sp) => !(sp.deviceIds || []).includes(device?.id));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nearestVisitBudget = useMemo(() => {
    if (!visitBudgets || visitBudgets.length === 0 || !date) return null;
    const target = new Date(date + "T00:00:00").getTime();
    let best = null, bestDiff = Infinity;
    visitBudgets.forEach((v) => {
      if (!v.date) return;
      const diff = Math.abs(new Date(v.date + "T00:00:00").getTime() - target);
      if (diff < bestDiff) { bestDiff = diff; best = v; }
    });
    return best;
  }, [visitBudgets, date]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { setPhoto(await compressImage(file)); } catch (err) { /* allow retry */ }
    setBusy(false);
  }
  function submit() {
    { const miss = missingRequiredFields("visit", device?.serviceCategory, visitCustom); if (miss.length) { setVisitFieldErr(`Please fill in: ${miss.join(", ")}`); return; } }
    if (!device) return;
    onSave({
      id: existing?.id, deviceId: device.id, name: name.trim() || defaultName, date,
      technician: technician.trim(), supplierId: supplierId || null,
      notes: notes.trim(), cost: cost ? Number(cost) : 0, costBreakdown: breakdown && Object.values(breakdown).some((x) => Number(x)) ? Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, Number(v) || 0])) : undefined, nextDueOverride: !isEdit && nextOverride ? nextOverride : undefined, certificatePhoto: photo, photos: visitPhotos.length ? visitPhotos : undefined, partsUsed: partsUsed.filter((p) => Number(p.qty) > 0).length ? partsUsed.filter((p) => Number(p.qty) > 0).map((p) => ({ ...p, qty: Number(p.qty) })) : undefined,
      checklistResults: checkResults.length ? checkResults : undefined,
      poNumber: visitPo.trim(),
      custom: Object.keys(visitCustom).length ? visitCustom : undefined,
      signatures: signatures.technician || signatures.site ? signatures : undefined,
      gps: gps || undefined,
      ramsReceived: ramsReceived || undefined, permitRef: permitRef.trim() || undefined, rating: rating || undefined,
      lateReason: isLate || existing?.lateReason ? lateReason || undefined : undefined,
      aborted: aborted || undefined, abortReason: aborted ? abortReason || "Not completed" : undefined,
      arrived: arrived || undefined, left: left || undefined,
      skipped: skipped && !aborted ? true : undefined, skipReason: skipped && !aborted ? skipReason || "Skipped" : undefined, dueDateAtLog: (isEdit ? existing?.dueDateAtLog : device.nextServiceDate) || undefined,
    });
  }
  // A visit more than 7 days after the date it was due counts as late — ask why.
  const dueRef = existing?.dueDateAtLog || (!isEdit ? device?.nextServiceDate : null);
  const isLate = !!(dueRef && date && date > addDays(dueRef, 7));
  function emailSummary() {
    const sup = suppliers.find((x) => x.id === supplierId);
    const fails = checkResults.filter((r) => r.result === "fail");
    const lines = [
      `Service: ${device?.name}${device?.assetTag ? ` (#${device.assetTag})` : ""}`, `Visit: ${name}`, `Date: ${fmtDate(date)}`,
      technician && `Technician: ${technician}`, sup && `Supplier: ${sup.name}`,
      checkResults.some((r) => r.result) && `Checklist: ${checkResults.filter((r) => r.result === "pass").length} pass, ${fails.length} fail${fails.length ? ` — ${fails.map((r) => r.item + (r.note ? ` (${r.note})` : "")).join("; ")}` : ""}`,
      cost && `Cost: ${gbp(Number(cost))}`, visitPo && `PO: ${visitPo}`,
      (ramsReceived || permitRef) && `Safety: ${[ramsReceived && "RAMS received", permitRef && `permit ${permitRef}`].filter(Boolean).join(", ")}`,
      lateReason && `Late — reason: ${lateReason}`, notes && `Notes: ${notes}`,
    ].filter(Boolean);
    const to = sup?.managerEmail || "";
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Visit report — ${device?.name} — ${fmtDate(date)}`)}&body=${encodeURIComponent(`Hi,\n\nSummary of the visit:\n\n${lines.join("\n")}\n\nKind regards`)}`;
  }
  return (
    <Modal title={isEdit ? `Edit visit — ${device ? device.name : ""}` : `Log visit — ${device ? device.name : ""}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Visit name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quarterly PPM inspection" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Service date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Technician"><TextInput value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Name" /></Field>
        </div>
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({CATEGORY_META[s.category]?.label})</option>)}
          </Select>
        </Field>
        <Field label={`Cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" /></Field>
        {breakdown ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: "var(--card-hi)", borderRadius: 9, padding: 8 }}>
            {[["labour", "Labour"], ["parts", "Parts"], ["callout", "Call-out"], ["other", "Other"]].map(([k, l]) => (
              <label key={k} style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>{l}<TextInput type="number" min="0" step="0.01" value={breakdown[k] ?? ""} onChange={(e) => setPart(k, e.target.value)} style={{ width: "100%", padding: "5px 7px" }} /></label>
            ))}
            <span style={{ gridColumn: "1 / -1", fontSize: 11, color: "var(--faint)" }}>The cost above is the total of these.</span>
          </div>
        ) : (
          <button type="button" onClick={() => setBreakdown({ labour: "", parts: "", callout: "", other: "" })} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", marginTop: -6 }}>Split cost into labour / parts / call-out</button>
        )}
        {nearestVisitBudget ? (
          <div style={{ fontSize: 11.5, color: "var(--warn)", background: "var(--warn-soft)", border: "1px solid #E6D9BC", borderRadius: 8, padding: "7px 10px" }}>
            Nearest visit budget: {gbp(nearestVisitBudget.amount)} (set for {fmtDate(nearestVisitBudget.date)}{nearestVisitBudget.note ? ` — ${nearestVisitBudget.note}` : ""})
          </div>
        ) : device?.budgetPerVisit ? (
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Flat per-visit budget for this service: {gbp(device.budgetPerVisit)}</div>
        ) : null}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Arrived (optional)"><TextInput type="time" value={arrived} onChange={(e) => setArrived(e.target.value)} /></Field>
          <Field label="Left (optional)"><TextInput type="time" value={left} onChange={(e) => setLeft(e.target.value)} /></Field>
        </div>
        {arrived && left && left > arrived && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6 }}>Time on site: {(() => { const [ah, am] = arrived.split(":").map(Number); const [lh, lm] = left.split(":").map(Number); const mins = lh * 60 + lm - (ah * 60 + am); return `${Math.floor(mins / 60)}h ${mins % 60}m`; })()}</div>}
        {!isEdit && lastVisit && (
          <button type="button" onClick={() => { if (lastVisit.technician) setTechnician(lastVisit.technician); if (lastVisit.supplierId) setSupplierId(lastVisit.supplierId); if (lastVisit.cost && !cost) setCost(String(lastVisit.cost)); if (lastVisit.name) setName(lastVisit.name); }} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>
            ↺ Copy details from last visit ({fmtDate(lastVisit.date)}{lastVisit.technician ? `, ${lastVisit.technician}` : ""})
          </button>
        )}
        {checkResults.length > 0 && (
          <Field label={`Checklist (${checkResults.filter((r) => r.result).length}/${checkResults.length} answered)`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {checkResults.map((r, i) => (
                <div key={i} style={{ background: r.result === "fail" ? "var(--danger-soft)" : "var(--card-hi)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, flex: 1 }}>{checklistLabel(r.item)}</span>
                    {parseReading(r.item) && (() => { const rd = parseReading(r.item); return (
                      <TextInput type="number" inputMode="decimal" step="any" value={r.value} placeholder={rd.unit || "value"} style={{ width: 78, padding: "5px 7px" }}
                        onChange={(e) => { const v = e.target.value; const num = Number(v); setCheck(i, { value: v, result: v === "" ? "" : num >= rd.min && num <= rd.max ? "pass" : "fail", note: v !== "" && !(num >= rd.min && num <= rd.max) && !r.note ? `Reading ${v}${rd.unit ? ` ${rd.unit}` : ""} outside ${rd.min}–${rd.max}` : r.note }); }} />
                    ); })()}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {[["pass", "Pass", "#2F855A"], ["fail", "Fail", "#C53030"], ["na", "N/A", "#8A94A0"]].map(([key, label, color]) => (
                        <button key={key} type="button" onClick={() => setCheck(i, { result: r.result === key ? "" : key })} style={{
                          border: `1.5px solid ${color}`, background: r.result === key ? color : "var(--card)", color: r.result === key ? "#fff" : color,
                          borderRadius: 7, padding: "4px 8px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {r.result === "fail" && (
                    <TextInput value={r.note} onChange={(e) => setCheck(i, { note: e.target.value })} placeholder="What's wrong? (creates a follow-up job)" style={{ width: "100%", marginTop: 6, fontSize: 12.5 }} />
                  )}
                </div>
              ))}
            </div>
            {checkResults.some((r) => r.result === "fail") && (
              <span style={{ fontSize: 11, color: "var(--danger)" }}>Each failed item will create a high-priority follow-up in Works.</span>
            )}
          </Field>
        )}
        {(() => {
          const budget = Number(nearestVisitBudget?.amount || device?.budgetPerVisit) || 0;
          const c = Number(cost) || 0;
          if (!budget || c <= budget * 1.1) return null;
          return <div style={{ fontSize: 12, color: "var(--warn)", background: "var(--warn-soft)", borderRadius: 8, padding: "8px 10px", fontWeight: 600 }}>
            {gbp(c - budget)} over the {gbp(budget)} visit budget (+{Math.round(((c - budget) / budget) * 100)}%). Please say why in the notes — it will show in the Budget tab variance.
          </div>;
        })()}
        <div style={{ background: aborted ? "var(--danger-soft)" : "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 650, color: aborted ? "var(--danger)" : "var(--text-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={aborted} onChange={(e) => setAborted(e.target.checked)} style={{ margin: 0 }} /> <Ban size={13} /> Visit NOT completed (supplier attended but couldn't do the work)
          </label>
          {aborted && (
            <>
              <Select value={abortReason} onChange={(e) => setAbortReason(e.target.value)}>
                <option value="">— Why? —</option>
                {["No access to area", "Area in use / meeting", "Equipment isolated or faulty", "Wrong parts / tools", "Missing RAMS or permit", "Technician left early", "Other"].map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
              <span style={{ fontSize: 11, color: "var(--danger)" }}>The service stays due — it won't move to the next date. This counts against the supplier if the reason is theirs.</span>
            </>
          )}
        </div>
        {!isEdit && !aborted && (
          <div style={{ background: skipped ? "var(--card-hi)" : "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 650, color: "var(--text-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={skipped} onChange={(e) => setSkipped(e.target.checked)} style={{ margin: 0 }} /> <SkipForward size={13} /> Skip this visit on purpose (moves on to the next date)
            </label>
            {skipped && (
              <>
                <Select value={skipReason} onChange={(e) => setSkipReason(e.target.value)}>
                  <option value="">— Why? —</option>
                  {SKIP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Recorded as skipped (not a completed visit) and the next visit is scheduled as normal.</span>
              </>
            )}
          </div>
        )}
        {(isLate || lateReason) && !aborted && !skipped && (
          <Field label={isLate ? `Late visit — due ${fmtDate(dueRef)}. Why?` : "Late visit reason"}>
            <Select value={lateReason} onChange={(e) => setLateReason(e.target.value)}>
              <option value="">— Choose a reason —</option>
              {LATE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        )}
        {device?.instructions && (
          <div style={{ background: "var(--accent-soft)", borderRadius: 10, padding: "9px 11px", fontSize: 12.3, color: "var(--accent)" }}><b>Instructions:</b> <span style={{ whiteSpace: "pre-wrap" }}>{device.instructions}</span></div>
        )}
        {!isEdit && !aborted && !skipped && (
          <Field label="Next visit due (optional — leave blank to follow the schedule)"><TextInput type="date" value={nextOverride} onChange={(e) => setNextOverride(e.target.value)} /></Field>
        )}
        {(needsRams || needsPermit) && (
          <div style={{ background: "var(--warn-soft)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)", display: "flex", alignItems: "center", gap: 5 }}><HardHat size={13} /> Safety paperwork for this job</div>
            {device?.accessNotes && <div style={{ fontSize: 11.5, color: "var(--muted)" }}><KeyRound size={11} style={{ verticalAlign: -1 }} /> {device.accessNotes}</div>}
            {needsRams && (
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={ramsReceived} onChange={(e) => setRamsReceived(e.target.checked)} style={{ margin: 0 }} /> RAMS received and reviewed
              </label>
            )}
            {needsPermit && (
              <Field label={`Permit reference (${device.permits.join(", ")})`}>
                <TextInput list="open-permits" value={permitRef} onChange={(e) => setPermitRef(e.target.value)} placeholder="e.g. PTW-0142" />
                <datalist id="open-permits">{openPermits.map((pm) => <option key={pm.id} value={pm.ref}>{pm.type} — {pm.contractor}</option>)}</datalist>
                {openPermits.length > 0 && !permitRef && <span style={{ fontSize: 11, color: "var(--accent)" }}>Open permits: {openPermits.map((pm) => pm.ref).join(", ")}</span>}
              </Field>
            )}
            {((needsRams && !ramsReceived) || (needsPermit && !permitRef.trim())) && (
              <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>Missing: {[needsRams && !ramsReceived && "RAMS", needsPermit && !permitRef.trim() && "permit reference"].filter(Boolean).join(" and ")} — you can still save, but it will show as missing on the record.</span>
            )}
          </div>
        )}
        <PhotoStrip photos={visitPhotos} onChange={setVisitPhotos} label="Photos of the work" />
        {spares.length > 0 && (
          <Field label="Parts used from stock (optional)">
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {partsUsed.map((p, i) => { const sp = spares.find((x) => x.id === p.spareId); return (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ flex: 1, fontSize: 12.8 }}>{sp?.name || "Part"} <span style={{ color: "var(--faint)" }}>({sp?.qty ?? 0} in stock)</span></span>
                  <TextInput type="number" min="1" value={p.qty} disabled={isEdit} onChange={(e) => setPartsUsed((prev) => prev.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} style={{ width: 64, padding: "5px 7px" }} />
                  {!isEdit && <button type="button" onClick={() => setPartsUsed((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>}
                </div>
              ); })}
              {!isEdit && (
                <select value="" onChange={(e) => e.target.value && setPartsUsed((prev) => [...prev, { spareId: e.target.value, name: spares.find((x) => x.id === e.target.value)?.name, qty: 1 }])} style={{ ...inputStyle, fontSize: 12.5 }}>
                  <option value="">+ Add a part…</option>
                  {deviceSpares.length > 0 && <optgroup label="For this service">{deviceSpares.filter((sp) => !partsUsed.some((p) => p.spareId === sp.id)).map((sp) => <option key={sp.id} value={sp.id}>{sp.name} ({sp.qty})</option>)}</optgroup>}
                  <optgroup label="Other spares">{otherSpares.filter((sp) => !partsUsed.some((p) => p.spareId === sp.id)).map((sp) => <option key={sp.id} value={sp.id}>{sp.name} ({sp.qty})</option>)}</optgroup>
                </select>
              )}
              {!isEdit && partsUsed.length > 0 && <span style={{ fontSize: 11, color: "var(--faint)" }}>Stock is reduced when you save.</span>}
            </div>
          </Field>
        )}
        <Field label="Rate the supplier's work (optional)">
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(rating === n ? 0 : n)} title={`${n} star${n === 1 ? "" : "s"}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                <Star size={24} color={n <= rating ? "#D97706" : "#C0C6CC"} fill={n <= rating ? "#D97706" : "none"} />
              </button>
            ))}
            <span style={{ fontSize: 11.5, color: "var(--faint)", marginLeft: 6 }}>{["", "Poor", "Below par", "OK", "Good", "Excellent"][rating]}</span>
          </div>
        </Field>
        {isEdit && (
          <button type="button" onClick={() => {
            const e = escapeHtml; const sup = suppliers.find((x) => x.id === supplierId);
            openPrintReport(`Visit report — ${device?.name || ""}`, `${locationName} · ${fmtDate(date)}`, `
              ${tableHtml(["", ""], [["Service", e(device?.name || "")], ["Visit", e(name)], ["Date", fmtDate(date)], ["Time on site", arrived && left ? `${arrived}–${left}` : ""], ["Supplier", e(sup?.name || "")], ["Technician", e(technician || "")], ["Cost", cost ? gbp(Number(cost)) : ""], ["PO", e(visitPo || "")], ["Safety", [ramsReceived && "RAMS received", permitRef && `Permit ${e(permitRef)}`].filter(Boolean).join(", ")]].filter((r) => r[1]))}
              ${checkResults.length ? `<h2>Checklist</h2>${tableHtml(["Item", "Reading", "Result", "Note"], checkResults.map((r) => [e(checklistLabel(r.item)), r.value !== "" && r.value != null ? e(String(r.value)) : "", r.result === "pass" ? '<span class="ok">Pass</span>' : r.result === "fail" ? '<span class="bad">Fail</span>' : r.result === "na" ? "N/A" : "", e(r.note || "")]))}` : ""}
              ${notes ? `<h2>Notes</h2><div>${e(notes).replace(/\n/g, "<br>")}</div>` : ""}
              ${signatures?.technician || signatures?.site ? `<h2>Sign-off</h2><table><tr>${signatures.technician ? `<td>Technician<br><img src="${signatures.technician}" style="max-height:70px"></td>` : ""}${signatures.site ? `<td>Site<br><img src="${signatures.site}" style="max-height:70px"></td>` : ""}</tr></table>` : ""}`);
          }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Printer size={14} /> Print visit report
          </button>
        )}
        {isEdit && (
          <button type="button" onClick={emailSummary} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Mail size={14} /> Email visit summary{suppliers.find((x) => x.id === supplierId)?.managerEmail ? " to supplier" : ""}
          </button>
        )}
        {showSignoff ? (
          <SignOffSection signatures={signatures} onChange={setSignatures} gps={gps} onGps={setGps} defaultTechName={technician} />
        ) : (
          <button type="button" onClick={() => setShowSignoff(true)} style={{ background: "#F1F4F7", border: "1px dashed var(--border-strong)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>
            + Add sign-off signatures &amp; location stamp
          </button>
        )}
        <CustomFieldInputs appliesTo="visit" category={device?.serviceCategory} values={visitCustom} onChange={setVisitCustom} />
        {visitFieldErr && <div style={{ fontSize: 12, color: "var(--danger)" }}>{visitFieldErr}</div>}
        <Field label="PO / work order number (optional)"><TextInput value={visitPo} onChange={(e) => setVisitPo(e.target.value)} placeholder="e.g. PO-40213" /></Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work performed, parts replaced, readings…" /></Field>
        <Field label="Certificate photo">
          <label style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--muted)", fontSize: 13, background: photo ? "transparent" : "#FAFBFC" }}>
            {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
            {photo ? "Replace photo" : "Upload certificate or job photo"}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          {photo && <img src={photo} alt="preview" style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid var(--border)" }} />}
        </Field>
        {device?.serviceIntervalMonths ? (
          <div style={{ fontSize: 12, color: "var(--faint)" }}>Next visit will auto-set to {fmtDate(addMonths(date, device.serviceIntervalMonths))} ({device.serviceIntervalMonths}mo interval) based on the latest logged date.</div>
        ) : null}
        {ACTIVE_CAN_EDIT ? (
          <>
            <PrimaryButton onClick={submit} style={{ marginTop: 4 }}><CheckCircle2 size={15} /> {isEdit ? "Save changes" : "Save visit"}</PrimaryButton>
            {isEdit && (
              confirmingDelete ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onDelete(existing.id, device.id)} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
                  <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
                  <Trash2 size={13} /> Delete this visit
                </button>
              )
            )}
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: "var(--faint)", textAlign: "center" }}>Viewing only — this profile can't save changes.</div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Add Extra Work Modal
--------------------------------------------------------- */
export function AddWorkModal({ openWorks = [], prefill = null, devices, suppliers = [], defaultDeviceId, onClose, onSave }) {
  const [deviceId, setDeviceId] = useState(defaultDeviceId || devices[0]?.id);
  const [priority, setPriority] = useState(prefill?.priority || "medium");
  const [poNumber, setPoNumber] = useState("");
  const [workCustom, setWorkCustom] = useState({});
  const [workFieldErr, setWorkFieldErr] = useState("");
  const [supplierId, setSupplierId] = useState(() => devices.find((d) => d.id === (defaultDeviceId || devices[0]?.id))?.supplierId || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [dateRaised, setDateRaised] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("quoted");
  const [budgetType, setBudgetType] = useState("budgeted");
  const [category, setCategory] = useState(prefill?.category || "");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setPhotos((prev) => [...prev, ...compressed]);
    } catch (err) { /* allow retry */ }
    setBusy(false);
  }
  function removePhoto(i) { setPhotos((prev) => prev.filter((_, idx) => idx !== i)); }
  function submit() {
    { const miss = missingRequiredFields("work", devices.find((d) => d.id === deviceId)?.serviceCategory, workCustom); if (miss.length) { setWorkFieldErr(`Please fill in: ${miss.join(", ")}`); return; } }
    if (!deviceId || !description.trim()) return;
    if (suppliers.find((s) => s.id === supplierId)?.status === "blocked" && !window.confirm("This supplier is marked 'Do not use'. Raise the work anyway?")) return;
    onSave({ category: category || null, deviceId, description: description.trim(), quoteAmount: quoteAmount ? Number(quoteAmount) : 0, dateRaised, status, budgetType, photos, priority, supplierId: supplierId || null, comments: [], poNumber: poNumber.trim(), custom: Object.keys(workCustom).length ? workCustom : undefined });
  }
  return (
    <Modal title="Add extra work" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(() => { const dup = openWorks.filter((w) => w.deviceId === deviceId); return dup.length ? <div style={{ fontSize: 12, color: "var(--warn)", background: "var(--warn-soft)", borderRadius: 8, padding: "8px 10px", fontWeight: 600 }}>This service already has {dup.length} open job{dup.length === 1 ? "" : "s"}: {dup.slice(0, 2).map((w) => `"${String(w.description).slice(0, 40)}" (${w.status.replace("_", " ")})`).join(", ")}. Check it isn't the same problem.</div> : null; })()}
        {suppliers.find((s) => s.id === supplierId)?.status === "blocked" && <div style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 8, padding: "8px 10px", fontWeight: 700 }}>This supplier is marked "Do not use".</div>}
        <Field label="Service">
          <Select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); const d = devices.find((x) => x.id === e.target.value); if (d?.supplierId) setSupplierId(d.supplierId); }}>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Trade (optional)">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">—</option>{WORK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {WORK_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Assigned supplier">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Unassigned —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="PO / work order number (optional)"><TextInput value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-40213" /></Field>
        <CustomFieldInputs appliesTo="work" category={devices.find((d) => d.id === deviceId)?.serviceCategory} values={workCustom} onChange={setWorkCustom} />
        {workFieldErr && <div style={{ fontSize: 12, color: "var(--danger)" }}>{workFieldErr}</div>}
        <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What extra work is being quoted or done?" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Quote amount (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Date raised"><TextInput type="date" value={dateRaised} onChange={(e) => setDateRaised(e.target.value)} /></Field>
        </div>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {WORK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Budget type">
          <Select value={budgetType} onChange={(e) => setBudgetType(e.target.value)}>
            {WORK_BUDGET_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
          <span style={{ fontSize: 11, color: "var(--faint)" }}>{WORK_BUDGET_TYPES.find((t) => t.key === budgetType)?.hint}</span>
        </Field>
        <Field label="Photos">
          <label style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--muted)", fontSize: 13, background: "#FAFBFC" }}>
            {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
            Add photos
            <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
          </label>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={p} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }} />
                  <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, background: "var(--head)", borderRadius: "50%", width: 18, height: 18, border: "none", color: "var(--on-accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </Field>
        <PrimaryButton onClick={submit} style={{ marginTop: 4 }}><Plus size={15} /> Save extra work</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Dated site notes on a service
--------------------------------------------------------- */
export function NotesLog({ notes, onAdd, onDelete }) {
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? notes : notes.slice(0, 3);
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}><StickyNote size={13} /> Site notes ({notes.length})</div>
      {ACTIVE_CAN_EDIT && onAdd && (
        <div style={{ display: "flex", gap: 6 }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onAdd(text); setText(""); } }} placeholder="e.g. Fan belt worn — monitor next visit" style={{ flex: 1, fontSize: 13 }} />
          <button onClick={() => { if (text.trim()) { onAdd(text); setText(""); } }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
        </div>
      )}
      {list.map((n) => (
        <div key={n.id} style={{ background: "var(--card)", borderRadius: 8, padding: "7px 9px", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{n.text}</div>
            <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>{n.by} · {fmtDate(n.at.slice(0, 10))}</div>
          </div>
          {onDelete && <ConfirmDeleteButton onConfirm={() => onDelete(n.id)} size={12} />}
        </div>
      ))}
      {notes.length > 3 && <button onClick={() => setShowAll((v) => !v)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{showAll ? "Show fewer" : `Show all ${notes.length}`}</button>}
    </div>
  );
}

export function ImportModal({ suppliers, existing, onClose, onImport }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const rows = useMemo(() => (text.trim() ? parseDelimited(text) : []), [text]);
  const header = rows[0] || [];
  const map = useMemo(() => {
    const m = {};
    header.forEach((h, i) => {
      const k = String(h).trim().toLowerCase().replace(/[_*]/g, " ").replace(/\s+/g, " ");
      const f = IMPORT_FIELDS.find((f) => f.aliases.includes(k) || f.label.toLowerCase() === k);
      if (f && m[f.key] === undefined) m[f.key] = i;
    });
    return m;
  }, [text]);
  const catKey = (v) => { const t = String(v || "").trim().toLowerCase(); if (!t) return "maintenance"; return CATEGORY_KEYS.find((k) => k === t || CATEGORY_META[k].label.toLowerCase() === t) || "maintenance"; };
  const existingNames = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  const parsed = rows.slice(1).map((r) => {
    const get = (k) => (map[k] !== undefined ? String(r[map[k]] ?? "").trim() : "");
    const supName = get("supplier");
    const sup = supName ? suppliers.find((s) => s.name.trim().toLowerCase() === supName.toLowerCase()) : null;
    const issues = [];
    if (!get("name")) issues.push("no name");
    if (get("nextServiceDate") && !toISO(get("nextServiceDate"))) issues.push("date not recognised");
    if (supName && !sup) issues.push(`supplier "${supName}" not found`);
    if (get("name") && existingNames.has(get("name").toLowerCase())) issues.push("already exists");
    const interval = Number(get("serviceIntervalMonths")) || null;
    return {
      issues, skip: !get("name"),
      device: {
        name: get("name"), assetTag: get("assetTag"), serviceCategory: catKey(get("serviceCategory")), subCategory: get("subCategory"), category: get("category"),
        area: get("area"), supplierId: sup?.id || null, serviceIntervalMonths: interval, nextServiceDate: toISO(get("nextServiceDate")),
        budgetPerVisit: Number(String(get("budgetPerVisit")).replace(/[£$€,]/g, "")) || 0, manufacturer: get("manufacturer"), model: get("model"),
        serialNumber: get("serialNumber"), installDate: toISO(get("installDate")),
      },
    };
  });
  const good = parsed.filter((p) => !p.skip);
  function readFile(e) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { setErr("Please save the sheet as CSV first (File → Save as → CSV), or copy the cells and paste them below."); return; }
    const r = new FileReader(); r.onload = () => { setErr(""); setText(String(r.result)); }; r.readAsText(f);
  }
  function template() {
    downloadBlob(new Blob([toCSV([IMPORT_FIELDS.map((f) => f.label), ["Emergency lighting test", "EL-01", "Maintenance", "", "Emergency lighting", "Ground floor", suppliers[0]?.name || "", "1", "01/11/2026", "45", "", "", "", ""]])], { type: "text/csv" }), "services-import-template.csv");
  }
  return (
    <Modal title="Import services" onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Bring in your asset register in one go. Upload a CSV, or copy the cells from Excel / Google Sheets (including the header row) and paste them below. Only a <b>Service name</b> column is required.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Upload size={14} /> Choose CSV file
            <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" onChange={readFile} style={{ display: "none" }} />
          </label>
          <button onClick={template} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Download size={14} /> Template</button>
        </div>
        <TextArea value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} placeholder="…or paste cells here" style={{ minHeight: 80, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
        {err && <div style={{ fontSize: 12, color: "var(--danger)" }}>{err}</div>}
        {rows.length > 0 && (
          <>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
              Columns recognised: {Object.keys(map).length ? IMPORT_FIELDS.filter((f) => map[f.key] !== undefined).map((f) => f.label).join(", ") : <b style={{ color: "var(--danger)" }}>none — check the header row</b>}
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 9 }}>
              {parsed.slice(0, 200).map((p, i) => (
                <div key={i} style={{ padding: "6px 9px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12, opacity: p.skip ? 0.5 : 1 }}>
                  <b>{p.device.name || "(no name)"}</b>
                  <span style={{ color: "var(--faint)" }}> · {CATEGORY_META[p.device.serviceCategory]?.label}{p.device.area ? ` · ${p.device.area}` : ""}{p.device.serviceIntervalMonths ? ` · every ${p.device.serviceIntervalMonths} mo` : ""}{p.device.nextServiceDate ? ` · due ${fmtDate(p.device.nextServiceDate)}` : ""}{p.device.budgetPerVisit ? ` · ${gbp(p.device.budgetPerVisit)}` : ""}</span>
                  {p.issues.length > 0 && <div style={{ color: p.skip ? "var(--danger)" : "var(--warn)", fontSize: 11 }}>{p.issues.join(" · ")}</div>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)" }}>Services with an interval, next due date and budget per visit also get a year of planned visits in the Budget Plan. Unknown suppliers are left blank — add them in Suppliers first to link them.</div>
            <PrimaryButton onClick={() => good.length && onImport(good.map((p) => p.device))} style={{ opacity: good.length ? 1 : 0.5 }}><FileSpreadsheet size={15} /> Import {good.length} service{good.length === 1 ? "" : "s"}</PrimaryButton>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Cost per year for one asset — repair vs replace
--------------------------------------------------------- */
export function CostHistory({ device, services, works }) {
  const y0 = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => y0 - 4 + i);
  const per = years.map((y) => {
    const ppm = services.filter((v) => String(v.date).startsWith(String(y))).reduce((t, v) => t + (Number(v.cost) || 0), 0);
    const reactive = works.filter((w) => String(w.dateRaised).startsWith(String(y)) && ["approved", "in_progress", "completed"].includes(w.status)).reduce((t, w) => t + (Number(w.quoteAmount) || 0), 0);
    return { y, ppm, reactive, total: ppm + reactive };
  });
  const max = Math.max(1, ...per.map((p) => p.total));
  if (per.every((p) => p.total === 0)) return null;
  const since = addDays(new Date().toISOString().slice(0, 10), -365);
  const reactive12 = works.filter((w) => w.dateRaised >= since && ["approved", "in_progress", "completed"].includes(w.status)).reduce((t, w) => t + (Number(w.quoteAmount) || 0), 0);
  const rc = Number(device.replacementCost) || 0;
  const ry = replacementYear(device);
  const advice = rc && reactive12 >= rc * 0.5 ? `Repairs in the last 12 months (${gbp(reactive12)}) are ${Math.round((reactive12 / rc) * 100)}% of the replacement cost — worth considering replacement.`
    : ry && ry <= y0 && reactive12 > 0 ? "Past its expected life and still needing repairs — consider planning a replacement." : null;
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}><TrendingUp size={13} /> Cost per year</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70 }}>
        {per.map((p) => (
          <div key={p.y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 600 }}>{p.total ? gbp(p.total).replace(".00", "") : ""}</div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 44 }}>
              <div style={{ height: `${(p.reactive / max) * 44}px`, background: "#D97706", borderRadius: "3px 3px 0 0" }} />
              <div style={{ height: `${(p.ppm / max) * 44}px`, background: "var(--accent)", borderRadius: p.reactive ? 0 : "3px 3px 0 0" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--faint)" }}>{p.y}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}><span style={{ color: "var(--accent)", fontWeight: 700 }}>■</span> Planned visits <span style={{ color: "#D97706", fontWeight: 700, marginLeft: 6 }}>■</span> Reactive works</div>
      {advice && <div style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 650, marginTop: 6 }}>{advice}</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   Add several services from the template library at once
--------------------------------------------------------- */
export function LibraryModal({ existing, suppliers, onClose, onAdd }) {
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState("");
  const [start, setStart] = useState(addDays(new Date().toISOString().slice(0, 10), 7));
  const [supplierId, setSupplierId] = useState("");
  const have = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  const list = ACTIVE_TEMPLATES.filter((t) => !q.trim() || `${t.name} ${t.subCategory || ""} ${t.equipmentType || ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const freq = (t) => t.repeat?.mode === "weekly" ? "Weekly" : t.repeat?.mode === "monthly" ? "Monthly" : t.repeat?.mode === "quarterly" ? "Quarterly" : t.repeat?.mode === "custom" ? `${t.repeat.count}× a year` : t.repeat?.months ? `Every ${t.repeat.months} months` : "One-off";
  function datesFor(t) {
    const r = t.repeat || {};
    if (r.mode === "weekly") return Array.from({ length: 52 }, (_, i) => addDays(start, i * 7));
    if (r.mode === "monthly") return Array.from({ length: 12 }, (_, i) => addMonths(start, i));
    if (r.mode === "quarterly") return Array.from({ length: 4 }, (_, i) => addMonths(start, i * 3));
    if (r.mode === "custom" && r.count) return Array.from({ length: r.count }, (_, i) => addMonths(start, Math.round((12 / r.count) * i)));
    if (r.months) return Array.from({ length: Math.max(1, Math.ceil(12 / r.months)) }, (_, i) => addMonths(start, i * r.months));
    return [start];
  }
  function add() {
    const rows = ACTIVE_TEMPLATES.filter((t) => picked.includes(t.id)).map((t) => ({
      name: t.name, serviceCategory: CATEGORY_META[t.serviceCategory] ? t.serviceCategory : "maintenance", subCategory: t.subCategory || "", category: t.equipmentType || "",
      checklist: t.checklist || [], serviceIntervalMonths: t.repeat?.mode === "interval" ? t.repeat.months : t.repeat?.mode === "monthly" ? 1 : t.repeat?.mode === "quarterly" ? 3 : null,
      supplierId: supplierId || null, scheduleDates: datesFor(t), budgetPerVisit: 0, certRequired: /gas|eicr|fire|emergency|lift|legionella|extinguisher|loler/i.test(t.name),
    }));
    onAdd(rows);
  }
  return (
    <Modal title="Service library" onClose={onClose} width={540}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Tick the services your site needs — each comes with a typical UK frequency and checklist. You can adjust any of them afterwards.</div>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search e.g. fire, water, lift…" />
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {list.map((t) => {
            const on = picked.includes(t.id); const exists = have.has(t.name.trim().toLowerCase());
            return (
              <button key={t.id} onClick={() => setPicked((p) => on ? p.filter((x) => x !== t.id) : [...p, t.id])} style={{ display: "flex", alignItems: "center", gap: 8, background: on ? "var(--accent-soft)" : "var(--card-hi)", border: `1px solid ${on ? "#2B4562" : "transparent"}`, borderRadius: 9, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                {on ? <CheckSquare size={17} color="#2B4562" /> : <Square size={17} color="#A3ABB4" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{t.name}{exists && <span style={{ fontSize: 10.5, color: "var(--warn)", fontWeight: 700 }}> · already added</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>{freq(t)}{t.subCategory ? ` · ${t.subCategory}` : ""}{t.checklist?.length ? ` · ${t.checklist.length} checks` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="First visits from"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Supplier (optional)"><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">— Set later —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <PrimaryButton onClick={() => picked.length && add()} style={{ opacity: picked.length ? 1 : 0.5 }}><BookOpen size={15} /> Add {picked.length} service{picked.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

function OutOfServiceForm({ onSubmit }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} style={{ background: "var(--card)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Mark out of service…</button>;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <TextInput autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. compressor failed" style={{ flex: 1, fontSize: 12.5 }} />
      <button onClick={() => onSubmit(reason.trim())} style={{ background: "#C53030", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Mark down</button>
    </div>
  );
}
