// Site → Actions, Spaces and Walk-rounds; the on-call rota; booking several visits together; merging duplicate services.
import { useEffect, useState } from "react";
import { addDays, addMonths, appBaseUrl, orgParam, checklistLabel, compressImage, currentBooking, daysUntil, escapeHtml, fmtDate, qrImageUrl, uid } from "../lib/utils.js";
import { buildCleaningSchedule, buildWalkroundReport, openPrintReport, tableHtml } from "../lib/reports.js";
import { ConfirmTextDelete, EmptyState, ExportButton, Field, MetricBlock, Modal, PhotoStrip, PrimaryButton, Select, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { ACTIVE_CAN_EDIT } from "../lib/globals.js";
import { CalendarCheck, CalendarClock, Camera, Car, CheckCircle2, CheckSquare, ClipboardCheck, Copy, FlaskConical, LayoutGrid, ListChecks, ListPlus, Mail, MapPin, Phone, PhoneCall, Plus, Power, Printer, QrCode, Siren, Sparkles, Square, Star, Trash2, Upload, X, ZapOff } from "lucide-react";
import { ACTION_SOURCES, CLEANING_FREQ, COSHH_HAZARDS, EQUIPMENT_TYPES, ISOLATION_KINDS, KEY_DATE_TYPES, SHUTDOWN_TYPES, SPACE_USES } from "../lib/constants.js";
import { FEEDBACK_TOPICS } from "../components/PublicPages.jsx";

/* ---------- Action tracker (risk assessment / audit / incident findings) ---------- */
export function ActionsView({ onReassign, actions, people = [], onSave, onDelete, locationName }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("open");
  const rank = { high: 0, medium: 1, low: 2 };
  const list = actions.filter((a) => (filter === "open" ? a.status !== "done" : filter === "done" ? a.status === "done" : true))
    .sort((a, b) => (a.status === "done") - (b.status === "done") || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || String(a.due || "9999").localeCompare(String(b.due || "9999")));
  const overdue = actions.filter((a) => a.status !== "done" && a.due && daysUntil(a.due) < 0).length;
  const openN = actions.filter((a) => a.status !== "done").length;
  function print() {
    const e = escapeHtml;
    openPrintReport("Action tracker", locationName, `<div class="kpis"><div class="kpi">Open<b>${openN}</b></div><div class="kpi">Overdue<b class="${overdue ? "bad" : "ok"}">${overdue}</b></div><div class="kpi">Completed<b class="ok">${actions.length - openN}</b></div></div>` +
      tableHtml(["Source", "Finding", "Action", "Priority", "Owner", "Due", "Status"], [...actions].sort((a, b) => (a.status === "done") - (b.status === "done")).map((a) => [e(`${a.source}${a.sourceRef ? ` (${a.sourceRef})` : ""}`), e(a.finding || ""), e(a.action || ""), `<span class="${a.priority === "high" ? "bad" : a.priority === "medium" ? "warn" : ""}">${e(a.priority || "")}</span>`, e(a.owner || ""), a.due ? `<span class="${a.status !== "done" && daysUntil(a.due) < 0 ? "bad" : ""}">${fmtDate(a.due)}</span>` : "", a.status === "done" ? `<span class="ok">Done ${a.doneAt ? fmtDate(a.doneAt.slice(0, 10)) : ""}</span>` : e(a.status === "in_progress" ? "In progress" : "Open")])));
  }
  return (
    <div>
      {ACTIVE_CAN_EDIT && onReassign && [...new Set(actions.filter((a) => a.status !== "done" && a.owner).map((a) => a.owner))].length > 0 && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}><button onClick={() => { const owners = [...new Set(actions.filter((a) => a.status !== "done" && a.owner).map((a) => a.owner))]; const from = window.prompt(`Reassign the open actions of which person?\n${owners.join(", ")}`, owners[0]); if (!from) return; const to = window.prompt(`Give ${from}'s ${actions.filter((a) => a.status !== "done" && a.owner === from).length} open action(s) to:`, ""); if (to && to.trim()) onReassign(from.trim(), to.trim()); }} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Reassign someone's actions</button></div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Open actions" value={openN} />
        <MetricBlock label="Overdue" value={overdue} tone={overdue ? "danger" : "ok"} />
        <MetricBlock label="High priority open" value={actions.filter((a) => a.status !== "done" && a.priority === "high").length} tone={actions.some((a) => a.status !== "done" && a.priority === "high") ? "danger" : "ok"} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Plus size={15} /> Add an action</PrimaryButton>}
        {actions.length > 0 && <button onClick={print} title="Print" style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={14} color="#2B4562" /></button>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["open", "Open"], ["done", "Done"], ["all", "All"]].map(([k, l]) => <ToggleButton key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</ToggleButton>)}
      </div>
      {actions.length === 0 ? (
        <EmptyState icon={ListChecks} title="No actions yet" body="Track the findings from your fire risk assessment, legionella risk assessment, insurance surveys and audits: what needs doing, who owns it and by when. You'll be reminded when actions go overdue." />
      ) : list.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 14 }}>Nothing here.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((a) => {
            const n = a.due ? daysUntil(a.due) : null; const done = a.status === "done";
            const col = done ? "var(--ok)" : a.priority === "high" ? "var(--danger)" : a.priority === "medium" ? "var(--warn)" : "var(--faint)";
            return (
              <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${col}`, borderRadius: 10, padding: "8px 10px", display: "flex", gap: 8, alignItems: "flex-start", opacity: done ? 0.7 : 1 }}>
                {ACTIVE_CAN_EDIT && <button onClick={() => onSave({ ...a, status: done ? "open" : "done", doneAt: done ? null : new Date().toISOString() })} title={done ? "Reopen" : "Mark done"} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 1 }}>{done ? <CheckSquare size={18} color="var(--ok)" /> : <Square size={18} color="#A3ABB4" />}</button>}
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(a)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                  <div style={{ fontSize: 13, fontWeight: 650, textDecoration: done ? "line-through" : "none" }}>{a.action || a.finding}</div>
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{a.source}{a.sourceRef ? ` · ${a.sourceRef}` : ""}{a.owner ? ` · ${a.owner}` : ""}{a.status === "in_progress" ? " · in progress" : ""}</div>
                  {a.due && !done && <div style={{ fontSize: 11.5, fontWeight: n !== null && n <= 7 ? 700 : 500, color: n < 0 ? "var(--danger)" : n <= 7 ? "var(--warn)" : "var(--muted)" }}>{n < 0 ? `Overdue — was due ${fmtDate(a.due)}` : `Due ${fmtDate(a.due)}`}</div>}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {editing && <ActionModal existing={editing.id || editing.prefill ? editing : null} people={people} onClose={() => setEditing(null)} onSave={(a) => { onSave(a); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
export function ActionModal({ existing, people = [], onClose, onSave, onDelete }) {
  const [source, setSource] = useState(existing?.source || ACTION_SOURCES[0]);
  const [sourceRef, setSourceRef] = useState(existing?.sourceRef || "");
  const [finding, setFinding] = useState(existing?.finding || "");
  const [action, setAction] = useState(existing?.action || "");
  const [priority, setPriority] = useState(existing?.priority || "medium");
  const [owner, setOwner] = useState(existing?.owner || "");
  const [due, setDue] = useState(existing?.due || addDays(new Date().toISOString().slice(0, 10), 30));
  const [status, setStatus] = useState(existing?.status || "open");
  const [notes, setNotes] = useState(existing?.notes || "");
  return (
    <Modal title={existing?.id ? "Action" : "Add an action"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="From"><Select value={source} onChange={(e) => setSource(e.target.value)}>{ACTION_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
          <Field label="Reference"><TextInput value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="e.g. FRA item 4.2" /></Field>
        </div>
        <Field label="Finding"><TextArea value={finding} onChange={(e) => setFinding(e.target.value)} placeholder="What was found" style={{ minHeight: 50 }} /></Field>
        <Field label="Action needed"><TextInput autoFocus value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Fit intumescent strips to plant room door" /></Field>
        <div style={{ display: "flex", gap: 6 }}>{[["high", "High"], ["medium", "Medium"], ["low", "Low"]].map(([k, l]) => <ToggleButton key={k} active={priority === k} onClick={() => setPriority(k)}>{l} priority</ToggleButton>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Owner"><TextInput list="act-owners" value={owner} onChange={(e) => setOwner(e.target.value)} /><datalist id="act-owners">{people.map((p) => <option key={p} value={p} />)}</datalist></Field>
          <Field label="Due by"><TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{[["open", "Open"], ["in_progress", "In progress"], ["done", "Done"]].map(([k, l]) => <ToggleButton key={k} active={status === k} onClick={() => setStatus(k)}>{l}</ToggleButton>)}</div>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 50 }} /></Field>
        <PrimaryButton onClick={() => (action.trim() || finding.trim()) && onSave({ id: existing?.id, source, sourceRef: sourceRef.trim(), finding: finding.trim(), action: action.trim(), priority, owner: owner.trim(), due: due || null, status, doneAt: status === "done" ? existing?.doneAt || new Date().toISOString() : null, notes: notes.trim(), linkId: existing?.linkId })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing?.id && <ConfirmTextDelete label="Delete this action" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Spaces (rooms / areas with floor area) ---------- */
export function SpacesView({ spaces, buildings = [], devices = [], onSave, onDelete, locationName, onOpenArea }) {
  const [editing, setEditing] = useState(null);
  const total = spaces.reduce((t, s) => t + (Number(s.areaM2) || 0), 0);
  const bName = (id) => buildings.find((b) => b.id === id)?.name || ""; const byFloor = {}; spaces.forEach((s) => { const k = [bName(s.buildingId), s.floor].filter(Boolean).join(" · ") || "—"; (byFloor[k] = byFloor[k] || []).push(s); });
  const count = (name) => devices.filter((d) => (d.area || "").trim().toLowerCase() === name.trim().toLowerCase()).length;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Spaces" value={spaces.length} />
        <MetricBlock label="Floor area" value={total ? `${Math.round(total).toLocaleString("en-GB")} m²` : "—"} />
        <MetricBlock label="Capacity" value={spaces.reduce((t, s) => t + (Number(s.capacity) || 0), 0) || "—"} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Plus size={15} /> Add a room or space</PrimaryButton>}
        {spaces.some((s) => s.cleaning) && <button onClick={() => openPrintReport("Cleaning schedule", locationName, buildCleaningSchedule(spaces))} title="Print cleaning schedule" style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 650, color: "var(--accent)", fontFamily: "inherit" }}><Sparkles size={13} /> Cleaning</button>}
        {spaces.length > 0 && <ExportButton label="CSV" filename="spaces.csv" rows={[["Space", "Floor", "Use", "Area m²", "Capacity", "Services", "Notes"], ...spaces.map((s) => [s.name, s.floor || "", s.use || "", s.areaM2 || "", s.capacity || "", count(s.name), s.notes || ""])]} />}
      </div>
      {spaces.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No spaces yet" body="List your rooms and areas with their floor area and use. Services in each area are counted automatically, and total floor area gives you cost per m² on the Budget page." />
      ) : Object.entries(byFloor).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([fl, list]) => (
        <div key={fl} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 750, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{fl === "—" ? "No floor set" : fl} · {Math.round(list.reduce((t, s) => t + (Number(s.areaM2) || 0), 0)).toLocaleString("en-GB")} m²</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {list.sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
              <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(s)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{s.name}</div>
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{s.use || "—"}{s.areaM2 ? ` · ${s.areaM2} m²` : ""}{s.capacity ? ` · ${s.capacity} people` : ""}{s.cleaning ? ` · cleaned ${CLEANING_FREQ[s.cleaning].toLowerCase()}` : ""}{s.condition ? <span style={{ color: s.condition <= 2 ? "var(--danger)" : "var(--faint)" }}> · {"★".repeat(s.condition)}</span> : ""}</div>
                </button>
                {count(s.name) > 0 && <button onClick={() => onOpenArea?.(s.name)} style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 12, padding: "3px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{count(s.name)} service{count(s.name) === 1 ? "" : "s"}</button>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {editing && <SpaceModal buildings={buildings} existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(s) => { onSave(s); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
export function SpaceModal({ existing, buildings = [], defaults = {}, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || ""); const [floor, setFloor] = useState(existing?.floor || "");
  const [buildingId, setBuildingId] = useState(existing?.buildingId || defaults.buildingId || (buildings.length === 1 ? buildings[0].id : ""));
  const [floorId, setFloorId] = useState(existing?.floorId || defaults.floorId || "");
  const bld = buildings.find((b) => b.id === buildingId); const floors = bld?.floors || [];
  const [use, setUse] = useState(existing?.use || SPACE_USES[0]); const [areaM2, setAreaM2] = useState(existing?.areaM2 != null ? String(existing.areaM2) : "");
  const [capacity, setCapacity] = useState(existing?.capacity != null ? String(existing.capacity) : ""); const [notes, setNotes] = useState(existing?.notes || "");
  const [cleaning, setCleaning] = useState(existing?.cleaning || ""); const [cleaningNotes, setCleaningNotes] = useState(existing?.cleaningNotes || "");
  const [condition, setCondition] = useState(existing?.condition || 0); const [conditionNote, setConditionNote] = useState(existing?.conditionNote || "");
  return (
    <Modal title={existing ? "Room / space" : "Add a room or space"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Name (match the Area / room used on services)"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plant room" /></Field>
        {buildings.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Building"><Select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setFloorId(""); }}><option value="">— not in a building —</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            {floors.length > 0 && <Field label="Floor"><Select value={floorId} onChange={(e) => { setFloorId(e.target.value); const f = floors.find((x) => x.id === e.target.value); if (f) setFloor(f.name); }}><option value="">— choose —</option>{floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {!(buildings.length > 0 && floors.length > 0) && <Field label="Floor"><TextInput value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. Ground" /></Field>}
          <Field label="Use"><Select value={use} onChange={(e) => setUse(e.target.value)}>{SPACE_USES.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Floor area (m²)"><TextInput type="number" min="0" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} /></Field>
          <Field label="Capacity (people)"><TextInput type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
        </div>
        <Field label="Condition"><div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setCondition(condition === n ? 0 : n)} title={["", "Poor", "Below average", "Fair", "Good", "Excellent"][n]} style={{ background: condition >= n ? "#D97706" : "var(--card-hi)", color: condition >= n ? "#fff" : "var(--faint)", border: "none", borderRadius: 7, width: 34, height: 30, fontSize: 15, cursor: "pointer" }}>★</button>)}<TextInput value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} placeholder="e.g. Carpet worn by door" style={{ flex: 1, minWidth: 120 }} /></div></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Cleaned"><Select value={cleaning} onChange={(e) => setCleaning(e.target.value)}><option value="">—</option>{Object.entries(CLEANING_FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Cleaning notes"><TextInput value={cleaningNotes} onChange={(e) => setCleaningNotes(e.target.value)} placeholder="e.g. Deep clean monthly" /></Field>
        </div>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 50 }} /></Field>
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), floor: (floors.find((f) => f.id === floorId)?.name || floor).trim(), buildingId: buildingId || null, floorId: (buildingId && floorId) || null, use, areaM2: areaM2 === "" ? null : Number(areaM2), capacity: capacity === "" ? null : Number(capacity), notes: notes.trim(), cleaning, cleaningNotes: cleaningNotes.trim(), condition: condition || null, conditionNote: conditionNote.trim(), conditionAt: condition && condition !== existing?.condition ? new Date().toISOString().slice(0, 10) : existing?.conditionAt })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this space" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Photo walk-rounds ---------- */
export function WalkroundsView({ onRaiseJob, walkrounds, areas = [], onSave, onDelete, onRaiseAction, locationName }) {
  const [editing, setEditing] = useState(null);
  return (
    <div>
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ width: "100%", marginBottom: 10 }}><Camera size={15} /> Start a walk-round</PrimaryButton>}
      {walkrounds.length === 0 ? (
        <EmptyState icon={Camera} title="No walk-rounds yet" body="Walk the building, snap photos with a note for anything worth recording, and print a tidy photo report — handy for landlord inspections, handovers and condition records." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...walkrounds].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((w) => (
            <div key={w.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10 }}>
              {w.items[0]?.photo && <img src={w.items[0].photo} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />}
              <button onClick={() => ACTIVE_CAN_EDIT && setEditing(w)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{w.title}</div>
                <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{fmtDate(w.date)} · {w.items.length} item{w.items.length === 1 ? "" : "s"}{w.items.some((i) => i.action) ? ` · ${w.items.filter((i) => i.action).length} need action` : ""} · {w.by}</div>
              </button>
              <button onClick={() => openPrintReport(w.title, locationName, buildWalkroundReport(w, locationName))} title="Print photo report" style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex" }}><Printer size={14} color="#2B4562" /></button>
            </div>
          ))}
        </div>
      )}
      {editing && <WalkroundModal onRaiseJob={onRaiseJob ? (t) => { setEditing(null); onRaiseJob(t); } : null} existing={editing.id ? editing : null} areas={areas} onClose={() => setEditing(null)} onRaiseAction={onRaiseAction} onSave={(w) => { onSave(w); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function WalkroundModal({ onRaiseJob, existing, areas, onClose, onSave, onDelete, onRaiseAction }) {
  const [title, setTitle] = useState(existing?.title || `Walk-round ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState(existing?.items || []);
  const [busy, setBusy] = useState(false);
  async function addPhoto(e) {
    const files = [...(e.target.files || [])]; e.target.value = ""; if (!files.length) return; setBusy(true);
    try { const ps = await Promise.all(files.map((f) => compressImage(f, 800, 0.6))); setItems((p) => [...p, ...ps.map((photo) => ({ photo, note: "", area: "", action: false }))]); } catch (x) { /* ignore */ }
    setBusy(false);
  }
  const listId = "wr-areas";
  return (
    <Modal title={existing ? "Walk-round" : "New walk-round"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8, background: "var(--card-hi)", borderRadius: 10, padding: 8 }}>
            {it.photo ? <img src={it.photo} alt="" style={{ width: 84, height: 84, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : null}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              <TextInput list={listId} value={it.area} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, area: e.target.value } : x))} placeholder="Where" style={{ fontSize: 12.5 }} />
              <TextArea value={it.note} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="What you saw" style={{ minHeight: 40, fontSize: 12.5 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={!!it.action} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, action: e.target.checked } : x))} style={{ margin: 0 }} /> Needs action</label>
                {it.action && onRaiseJob && ACTIVE_CAN_EDIT && <button type="button" onClick={() => { onSave({ id: existing?.id, title: title.trim() || "Walk-round", date, items }); onRaiseJob(`${it.area ? `${it.area}: ` : ""}${it.note}`); }} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>+ Raise a job</button>}
                {it.action && onRaiseAction && <button type="button" onClick={() => onRaiseAction({ source: "Site audit", sourceRef: title, finding: `${it.area ? `${it.area}: ` : ""}${it.note}`, action: "" })} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>+ Add to action tracker</button>}
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => setItems((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={14} color="#A3ABB4" /></button>
              </div>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Camera size={14} /> {busy ? "Adding…" : "Add photos"}
            <input type="file" accept="image/*" multiple capture="environment" onChange={addPhoto} style={{ display: "none" }} />
          </label>
          <button type="button" onClick={() => setItems((p) => [...p, { photo: null, note: "", area: "", action: false }])} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>+ Note without photo</button>
        </div>
        <PrimaryButton onClick={() => onSave({ id: existing?.id, title: title.trim() || "Walk-round", date, items })}><CheckCircle2 size={15} /> Save walk-round</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this walk-round" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- On-call rota ---------- */
export function OnCallCard({ rota = [], onSave }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const now = rota.find((r) => r.from <= today && (!r.to || r.to >= today));
  const next = rota.filter((r) => r.from > today).sort((a, b) => a.from.localeCompare(b.from))[0];
  const [draft, setDraft] = useState({ from: today, to: addDays(today, 6), name: "", phone: "" });
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8, color: "var(--text)" }}>
        <PhoneCall size={17} color="#2B4562" />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>On call {now ? <span style={{ fontWeight: 600, color: "var(--accent)" }}>— {now.name}</span> : <span style={{ fontWeight: 500, color: "var(--faint)" }}>— nobody set</span>}</span>
        {now?.phone && <a href={`tel:${now.phone.replace(/[^+0-9]/g, "")}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>{now.phone}</a>}
      </button>
      {next && !open && <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }}>Next: {next.name} from {fmtDate(next.from)}</div>}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {[...rota].filter((r) => !r.to || r.to >= today).sort((a, b) => a.from.localeCompare(b.from)).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, background: r === now ? "var(--accent-soft)" : "var(--card-hi)", borderRadius: 8, padding: "6px 9px" }}>
              <span style={{ flex: 1 }}><b>{r.name}</b>{r.phone ? ` · ${r.phone}` : ""}</span>
              <span style={{ color: "var(--faint)" }}>{fmtDate(r.from)}{r.to ? ` – ${fmtDate(r.to)}` : ""}</span>
              {ACTIVE_CAN_EDIT && onSave && <button onClick={() => onSave(rota.filter((x) => x.id !== r.id))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={12} color="#A3ABB4" /></button>}
            </div>
          ))}
          {ACTIVE_CAN_EDIT && onSave && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, background: "var(--card-hi)", borderRadius: 9, padding: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Name" style={{ flex: 1, minWidth: 0 }} />
                <TextInput type="tel" value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} placeholder="Mobile" style={{ flex: 1, minWidth: 0 }} />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <TextInput type="date" value={draft.from} onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value }))} style={{ flex: 1 }} />
                <span style={{ fontSize: 12 }}>to</span>
                <TextInput type="date" value={draft.to} onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))} style={{ flex: 1 }} />
                <button onClick={() => { if (!draft.name.trim() || !draft.from) return; onSave([...rota, { ...draft, id: uid(), name: draft.name.trim(), phone: draft.phone.trim() }]); setDraft({ from: addDays(draft.to || draft.from, 1), to: addDays(draft.to || draft.from, 7), name: "", phone: "" }); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 12px", height: 36, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Book a supplier's due visits on one day ---------- */
export function BookTogetherModal({ devices, suppliers, onClose, onBook }) {
  const groups = {};
  devices.forEach((d) => { const n = daysUntil(d.nextServiceDate); if (d.supplierId && n !== null && n <= 45 && !currentBooking(d)) (groups[d.supplierId] = groups[d.supplierId] || []).push(d); });
  const entries = Object.entries(groups).filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length);
  const [sel, setSel] = useState(entries[0]?.[0] || "");
  const [date, setDate] = useState(""); const [time, setTime] = useState(""); const [ref, setRef] = useState("");
  const [picked, setPicked] = useState(() => (entries[0]?.[1] || []).map((d) => d.id));
  const list = groups[sel] || [];
  return (
    <Modal title="Book visits together" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Suppliers with two or more unbooked visits due in the next 45 days. Book them on one day to save call-out charges and disruption.</div>
        {entries.length === 0 ? <div style={{ fontSize: 13, color: "var(--faint)", textAlign: "center", padding: 12 }}>No suppliers have several unbooked visits coming up.</div> : (
          <>
            <Field label="Supplier"><Select value={sel} onChange={(e) => { setSel(e.target.value); setPicked((groups[e.target.value] || []).map((d) => d.id)); }}>{entries.map(([id, l]) => <option key={id} value={id}>{suppliers.find((s) => s.id === id)?.name || "Supplier"} ({l.length} visits)</option>)}</Select></Field>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {list.map((d) => (
                <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "var(--card-hi)", borderRadius: 8, padding: "6px 9px", cursor: "pointer" }}>
                  <input type="checkbox" checked={picked.includes(d.id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id))} style={{ margin: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span><span style={{ fontSize: 11.5, color: daysUntil(d.nextServiceDate) < 0 ? "var(--danger)" : "var(--faint)" }}>due {fmtDate(d.nextServiceDate)}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Time"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
              <Field label="Job ref"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
            </div>
            <PrimaryButton onClick={() => date && picked.length && onBook(picked, { status: "booked", date, time, ref: ref.trim() })} style={{ opacity: date && picked.length ? 1 : 0.5 }}><CalendarCheck size={15} /> Book {picked.length} visit{picked.length === 1 ? "" : "s"} on one day</PrimaryButton>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Merge a duplicate service into another ---------- */
export function MergeServiceModal({ device, devices, onClose, onMerge }) {
  const [target, setTarget] = useState("");
  const others = devices.filter((d) => d.id !== device.id).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal title="Merge duplicate service" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Moves every visit, job, task and planned visit from <b>{device.name}</b> onto the service you choose, then removes <b>{device.name}</b>. It can be restored for 30 days from More → Deleted items.</div>
        <Field label="Keep this service"><Select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose…</option>{others.map((d) => <option key={d.id} value={d.id}>{d.name}{d.area ? ` — ${d.area}` : ""}</option>)}</Select></Field>
        <PrimaryButton onClick={() => target && onMerge(device.id, target)} style={{ opacity: target ? 1 : 0.5 }}><CheckCircle2 size={15} /> Merge into this service</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------- COSHH register (hazardous substances) ---------- */
export function CoshhView({ items, areas = [], onSave, onDelete, locationName }) {
  const [editing, setEditing] = useState(null);
  const due = items.filter((i) => i.reviewDate && daysUntil(i.reviewDate) < 0).length;
  const noSds = items.filter((i) => !i.sdsUrl).length;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Substances" value={items.length} />
        <MetricBlock label="Review overdue" value={due} tone={due ? "danger" : "ok"} />
        <MetricBlock label="No safety data sheet" value={noSds} tone={noSds ? "warn" : "ok"} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Plus size={15} /> Add a substance</PrimaryButton>}
        {items.length > 0 && <button title="Print" onClick={() => { const e = escapeHtml; openPrintReport("COSHH register", locationName, tableHtml(["Product", "Supplier", "Used for", "Stored", "Hazards", "PPE / controls", "Assessed", "Review", "SDS"], items.map((i) => [`<b>${e(i.product)}</b>`, e(i.maker || ""), e(i.use || ""), e(i.location || ""), e((i.hazards || []).join(", ")), e(i.controls || ""), i.assessed ? fmtDate(i.assessed) : "", i.reviewDate ? `<span class="${daysUntil(i.reviewDate) < 0 ? "bad" : ""}">${fmtDate(i.reviewDate)}</span>` : "", i.sdsUrl ? "Yes" : '<span class="warn">Missing</span>'])) + '<div class="muted">Keep safety data sheets available to anyone who uses these products.</div>'); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={14} color="#2B4562" /></button>}
      </div>
      {items.length === 0 ? <EmptyState icon={FlaskConical} title="No substances recorded" body="List cleaning chemicals, water-treatment products, fuels, oils and paints kept on site — with hazards, controls, where they're stored and a link to the safety data sheet. You'll be reminded when assessments are due for review." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...items].sort((a, b) => String(a.product).localeCompare(String(b.product))).map((i) => {
            const n = i.reviewDate ? daysUntil(i.reviewDate) : null;
            return (
              <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(i)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{i.product}</div>
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{[(i.hazards || []).join(", "), i.location, i.qty].filter(Boolean).join(" · ") || "—"}</div>
                  {n !== null && <div style={{ fontSize: 11.5, fontWeight: n <= 30 ? 700 : 500, color: n < 0 ? "var(--danger)" : n <= 30 ? "var(--warn)" : "var(--muted)" }}>Review {fmtDate(i.reviewDate)}</div>}
                </button>
                {i.sdsUrl ? <a href={i.sdsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>SDS</a> : <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)" }}>No SDS</span>}
              </div>
            );
          })}
        </div>
      )}
      {editing && <CoshhModal existing={editing.id ? editing : null} areas={areas} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function CoshhModal({ existing, areas, onClose, onSave, onDelete }) {
  const [product, setProduct] = useState(existing?.product || ""); const [maker, setMaker] = useState(existing?.maker || "");
  const [use, setUse] = useState(existing?.use || ""); const [location, setLocation] = useState(existing?.location || "");
  const [hazards, setHazards] = useState(existing?.hazards || []); const [controls, setControls] = useState(existing?.controls || "");
  const [firstAid, setFirstAid] = useState(existing?.firstAid || ""); const [sdsUrl, setSdsUrl] = useState(existing?.sdsUrl || ""); const [qty, setQty] = useState(existing?.qty || "");
  const [assessed, setAssessed] = useState(existing?.assessed || new Date().toISOString().slice(0, 10)); const [reviewDate, setReviewDate] = useState(existing?.reviewDate || addMonths(new Date().toISOString().slice(0, 10), 12));
  return (
    <Modal title={existing ? "Substance" : "Add a substance"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Product name"><TextInput autoFocus value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. Bleach 5L" /></Field>
          <Field label="Made / supplied by"><TextInput value={maker} onChange={(e) => setMaker(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Used for"><TextInput value={use} onChange={(e) => setUse(e.target.value)} placeholder="e.g. Toilet cleaning" /></Field>
          <Field label="Stored in"><TextInput list="coshh-areas" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Cleaners' cupboard L1" /><datalist id="coshh-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
        </div>
        <Field label="Hazards"><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{COSHH_HAZARDS.map((h) => <ToggleButton key={h} active={hazards.includes(h)} onClick={() => setHazards((p) => p.includes(h) ? p.filter((x) => x !== h) : [...p, h])}>{h}</ToggleButton>)}</div></Field>
        <Field label="Controls & PPE"><TextArea value={controls} onChange={(e) => setControls(e.target.value)} placeholder="e.g. Gloves and goggles; ventilate; never mix with other products" style={{ minHeight: 50 }} /></Field>
        <Field label="First aid"><TextInput value={firstAid} onChange={(e) => setFirstAid(e.target.value)} placeholder="e.g. Eyes: rinse with water for 15 minutes" /></Field>
        <Field label="Quantity held"><TextInput value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 4 × 5 L" /></Field>
        <Field label="Safety data sheet link"><TextInput value={sdsUrl} onChange={(e) => setSdsUrl(e.target.value)} placeholder="https://…" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Assessed"><TextInput type="date" value={assessed} onChange={(e) => { setAssessed(e.target.value); if (e.target.value) setReviewDate(addMonths(e.target.value, 12)); }} /></Field>
          <Field label="Review by"><TextInput type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></Field>
        </div>
        <PrimaryButton onClick={() => product.trim() && onSave({ id: existing?.id, product: product.trim(), maker: maker.trim(), use: use.trim(), location: location.trim(), hazards, controls: controls.trim(), firstAid: firstAid.trim(), qty: qty.trim(), sdsUrl: sdsUrl.trim() ? (/^https?:\/\//i.test(sdsUrl.trim()) ? sdsUrl.trim() : `https://${sdsUrl.trim()}`) : "", assessed: assessed || null, reviewDate: reviewDate || null })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <button type="button" onClick={() => { const e = escapeHtml; openPrintReport(`COSHH — ${existing.product}`, "", `<div style="border:3px solid #D97706;border-radius:12px;padding:16px;max-width:520px"><div style="font-size:22px;font-weight:800">${e(existing.product)}</div><div style="font-size:12px;color:#56616D">${e(existing.maker || "")}${existing.use ? ` · ${e(existing.use)}` : ""}</div><div style="margin:10px 0;font-weight:800;color:#C53030">${e((existing.hazards || []).join(" · ") || "No hazards recorded")}</div><div><b>Controls & PPE:</b> ${e(existing.controls || "—")}</div><div style="margin-top:6px"><b>First aid:</b> ${e(existing.firstAid || "—")}</div><div style="margin-top:6px"><b>Stored:</b> ${e(existing.location || "—")}</div><div style="margin-top:10px;font-size:11px;color:#56616D">Safety data sheet: ${existing.sdsUrl ? e(existing.sdsUrl) : "ask the facilities team"} · Review by ${existing.reviewDate ? fmtDate(existing.reviewDate) : "—"}</div></div>`); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Print data card (to display where it's stored)</button>}
        {existing && <ConfirmTextDelete label="Delete" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Equipment inspection register (ladders, harnesses, PAT, lifting gear…) ---------- */
export function EquipmentView({ items, onSave, onDelete, locationName }) {
  const [editing, setEditing] = useState(null); const [type, setType] = useState("");
  const list = items.filter((i) => !type || i.type === type).sort((a, b) => String(a.nextDue || "9999").localeCompare(String(b.nextDue || "9999")));
  const overdue = items.filter((i) => i.nextDue && daysUntil(i.nextDue) < 0 && i.status !== "withdrawn").length;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Items" value={items.filter((i) => i.status !== "withdrawn").length} />
        <MetricBlock label="Inspection overdue" value={overdue} tone={overdue ? "danger" : "ok"} />
        <MetricBlock label="Failed / withdrawn" value={items.filter((i) => i.status === "failed" || i.status === "withdrawn").length} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Plus size={15} /> Add equipment</PrimaryButton>}
        {items.length > 0 && <button title="Print inspection labels" onClick={() => { const e = escapeHtml; openPrintReport("Equipment inspection labels", locationName, `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${items.filter((i) => i.status !== "withdrawn").map((i) => `<div style="border:1.5px solid #1B2430;border-radius:8px;padding:8px;page-break-inside:avoid"><div style="font-weight:800;font-size:13px">${e(i.name)}</div><div style="font-family:monospace;font-size:12px">${e(i.ref || "")}</div><div style="font-size:11px;margin-top:4px">Inspected: <b>${i.lastInspected ? fmtDate(i.lastInspected) : "—"}</b></div><div style="font-size:11px">Next due: <b>${i.nextDue ? fmtDate(i.nextDue) : "—"}</b></div><div style="font-size:9.5px;color:#56616D;margin-top:4px">Do not use after the due date</div></div>`).join("")}</div>`); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 650, color: "var(--accent)", fontFamily: "inherit" }}>Labels</button>}
        {items.length > 0 && <button title="Print" onClick={() => { const e = escapeHtml; openPrintReport("Equipment inspection register", locationName, tableHtml(["Item", "Type", "ID / serial", "Location", "Last inspected", "Result", "Next due"], [...items].sort((a, b) => String(a.type).localeCompare(String(b.type))).map((i) => [`<b>${e(i.name)}</b>`, e(EQUIPMENT_TYPES[i.type]?.label || ""), e(i.ref || ""), e(i.location || ""), i.lastInspected ? fmtDate(i.lastInspected) : "", i.status === "failed" ? '<span class="bad">Failed</span>' : i.status === "withdrawn" ? "Withdrawn" : '<span class="ok">Pass</span>', i.nextDue ? `<span class="${daysUntil(i.nextDue) < 0 ? "bad" : ""}">${fmtDate(i.nextDue)}</span>` : ""]))); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={14} color="#2B4562" /></button>}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        <ToggleButton active={!type} onClick={() => setType("")}>All</ToggleButton>
        {Object.entries(EQUIPMENT_TYPES).filter(([k]) => items.some((i) => i.type === k)).map(([k, v]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{v.label}</ToggleButton>)}
      </div>
      {items.length === 0 ? <EmptyState icon={ClipboardCheck} title="No equipment yet" body="Ladders, harnesses, lifting gear, portable appliances and other kit that needs regular inspection. Log each check in one tap — the next due date is worked out for you." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((i) => {
            const n = i.nextDue ? daysUntil(i.nextDue) : null; const bad = i.status === "failed";
            return (
              <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, opacity: i.status === "withdrawn" ? 0.55 : 1 }}>
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(i)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{i.name}{i.ref ? <span style={{ color: "var(--faint)", fontWeight: 500 }}> #{i.ref}</span> : null}</div>
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{EQUIPMENT_TYPES[i.type]?.label}{i.location ? ` · ${i.location}` : ""}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 650, color: bad ? "var(--danger)" : n !== null && n < 0 ? "var(--danger)" : n !== null && n <= 14 ? "var(--warn)" : "var(--muted)" }}>{bad ? "FAILED — do not use" : i.status === "withdrawn" ? "Withdrawn" : n === null ? "No inspection yet" : n < 0 ? `Inspection overdue (${fmtDate(i.nextDue)})` : `Next inspection ${fmtDate(i.nextDue)}`}</div>
                </button>
                {ACTIVE_CAN_EDIT && i.status !== "withdrawn" && <button onClick={() => { const today = new Date().toISOString().slice(0, 10); onSave({ ...i, lastInspected: today, nextDue: addMonths(today, Number(i.everyMonths) || EQUIPMENT_TYPES[i.type]?.months || 12), status: "ok", history: [{ date: today, result: "pass" }, ...(i.history || [])].slice(0, 50) }); }} style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Passed</button>}
              </div>
            );
          })}
        </div>
      )}
      {editing && <EquipmentModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function EquipmentModal({ existing, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || ""); const [type, setType] = useState(existing?.type || "ladder");
  const [ref, setRef] = useState(existing?.ref || ""); const [location, setLocation] = useState(existing?.location || "");
  const [everyMonths, setEveryMonths] = useState(String(existing?.everyMonths || EQUIPMENT_TYPES[existing?.type || "ladder"].months));
  const [lastInspected, setLastInspected] = useState(existing?.lastInspected || ""); const [status, setStatus] = useState(existing?.status || "ok");
  const [notes, setNotes] = useState(existing?.notes || "");
  const next = lastInspected ? addMonths(lastInspected, Number(everyMonths) || 12) : null;
  return (
    <Modal title={existing ? "Equipment" : "Add equipment"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Item"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 6-tread stepladder" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Type"><Select value={type} onChange={(e) => { setType(e.target.value); if (!existing) setEveryMonths(String(EQUIPMENT_TYPES[e.target.value].months)); }}>{Object.entries(EQUIPMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          <Field label="ID / serial"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. LAD-03" /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Kept in"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          <Field label="Inspect every (months)"><TextInput type="number" min="1" value={everyMonths} onChange={(e) => setEveryMonths(e.target.value)} /></Field>
        </div>
        <Field label="Last inspected"><TextInput type="date" value={lastInspected} onChange={(e) => setLastInspected(e.target.value)} /></Field>
        {next && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -4 }}>Next inspection: <b>{fmtDate(next)}</b></div>}
        <div style={{ display: "flex", gap: 6 }}>{[["ok", "In use"], ["failed", "Failed — do not use"], ["withdrawn", "Withdrawn / disposed"]].map(([k, l]) => <ToggleButton key={k} active={status === k} onClick={() => setStatus(k)}>{l}</ToggleButton>)}</div>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 45 }} /></Field>
        {(existing?.history || []).length > 0 && <div style={{ fontSize: 12, background: "var(--card-hi)", borderRadius: 9, padding: "7px 10px" }}><b>Inspection history</b>{existing.history.slice(0, 8).map((h, k) => <div key={k} style={{ color: h.result === "fail" ? "var(--danger)" : "var(--text-2)" }}>{fmtDate(h.date)} — {h.result === "fail" ? "failed" : "passed"}</div>)}</div>}
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), type, ref: ref.trim(), location: location.trim(), everyMonths: Number(everyMonths) || 12, lastInspected: lastInspected || null, nextDue: next, status, notes: notes.trim(), history: existing?.history || [] })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Live fire roll call ---------- */
export function RollCallModal({ onSite, staff = [], onClose }) {
  const people = [...onSite.map((s) => ({ id: s.id, name: s.name, sub: s.kind === "visitor" ? `Visitor${s.host ? ` · visiting ${s.host}` : ""}` : (s.company || "Contractor"), area: s.purpose || "", vehicle: s.vehicleReg })), ...staff.map((p) => ({ id: `st-${p.id}`, name: p.name, sub: `${p.role}${p.company ? ` · ${p.company}` : ""}`, staff: true }))];
  const [safe, setSafe] = useState({}); const [extra, setExtra] = useState(""); const [added, setAdded] = useState([]);
  const all = [...people, ...added]; const n = all.filter((p) => safe[p.id]).length;
  return (
    <Modal title="Fire roll call" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: n === all.length && all.length ? "var(--ok-soft)" : "var(--danger-soft)", borderRadius: 12, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", color: n === all.length && all.length ? "var(--ok)" : "var(--danger)" }}>{n} / {all.length}</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{all.length === 0 ? "Nobody on the register" : n === all.length ? "Everyone accounted for" : `${all.length - n} not yet accounted for`}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Started {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · tap each person as they reach the assembly point</div>
        </div>
        {all.map((p) => (
          <button key={p.id} onClick={() => setSafe((s) => ({ ...s, [p.id]: s[p.id] ? null : new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }))} style={{ display: "flex", alignItems: "center", gap: 10, background: safe[p.id] ? "var(--ok-soft)" : "var(--card)", border: `1px solid ${safe[p.id] ? "transparent" : "var(--border)"}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "var(--text)" }}>
            {safe[p.id] ? <CheckCircle2 size={22} color="var(--ok)" /> : <Square size={22} color="#A3ABB4" />}
            <span style={{ flex: 1 }}><b style={{ fontSize: 14.5 }}>{p.name}</b><span style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>{p.sub}{p.area ? ` · ${p.area}` : ""}{p.staff ? " · based here" : ""}</span></span>
            {safe[p.id] && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ok)" }}>{safe[p.id]}</span>}
          </button>
        ))}
        <div style={{ display: "flex", gap: 6 }}>
          <TextInput value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add someone not on the list" style={{ flex: 1 }} />
          <button onClick={() => { if (extra.trim()) { setAdded((a) => [...a, { id: `x-${Date.now()}`, name: extra.trim(), sub: "Added during roll call" }]); setExtra(""); } }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
        </div>
        <button onClick={() => { const e = escapeHtml; openPrintReport("Fire roll call record", new Date().toLocaleString("en-GB"), tableHtml(["Name", "Who", "Accounted for"], all.map((p) => [e(p.name), e(p.sub), safe[p.id] ? `<span class="ok">✓ ${safe[p.id]}</span>` : '<span class="bad">NOT ACCOUNTED FOR</span>'])) + `<div style="margin-top:16px">Fire marshal ____________________ &nbsp; Time all clear __________</div>`); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print the record</button>
      </div>
    </Modal>
  );
}
export function printBadge(s, locationName) {
  const e = escapeHtml; const vis = s.kind === "visitor";
  openPrintReport(vis ? "Visitor" : "Contractor", locationName, `<div style="border:3px solid ${vis ? "#2B5D8A" : "#D97706"};border-radius:14px;padding:20px;max-width:340px;margin:10px auto;text-align:center">
    <div style="font-size:13px;font-weight:800;letter-spacing:.12em;color:${vis ? "#2B5D8A" : "#B45309"}">${vis ? "VISITOR" : "CONTRACTOR"}</div>
    <div style="font-size:26px;font-weight:800;margin:10px 0 4px">${e(s.name)}</div>
    <div style="font-size:14px">${e(s.company || "")}</div>
    ${vis && s.host ? `<div style="font-size:13px;margin-top:6px">Visiting: <b>${e(s.host)}</b></div>` : ""}
    ${!vis && s.purpose ? `<div style="font-size:13px;margin-top:6px">${e(s.purpose)}</div>` : ""}
    <div style="font-size:12px;color:#56616D;margin-top:12px">${new Date(s.inAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${s.passNo ? ` · Pass ${e(s.passNo)}` : ""}</div>
    <div style="font-size:11px;color:#56616D;margin-top:10px">Please wear at all times and return when you leave. In a fire, go to the assembly point.</div></div>`);
}

/* ---------- Supplier contacts ---------- */
export function ContactsEditor({ contacts, onChange }) {
  const blank = { name: "", role: "", phone: "", email: "" };
  const [d, setD] = useState(blank);
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Other contacts (engineers, accounts, helpdesk…)</div>
      {contacts.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "var(--card)", borderRadius: 8, padding: "6px 8px" }}>
          <span style={{ flex: 1, minWidth: 0 }}><b>{c.name}</b>{c.role ? ` · ${c.role}` : ""}<span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>{[c.phone, c.email].filter(Boolean).join(" · ")}</span></span>
          <button type="button" onClick={() => onChange(contacts.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
        <TextInput value={d.name} onChange={(e) => setD((p) => ({ ...p, name: e.target.value }))} placeholder="Name" />
        <TextInput value={d.role} onChange={(e) => setD((p) => ({ ...p, role: e.target.value }))} placeholder="Role, e.g. Engineer" />
        <TextInput type="tel" value={d.phone} onChange={(e) => setD((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
        <TextInput type="email" value={d.email} onChange={(e) => setD((p) => ({ ...p, email: e.target.value }))} placeholder="Email" />
      </div>
      <button type="button" onClick={() => { if (!d.name.trim()) return; onChange([...contacts, { name: d.name.trim(), role: d.role.trim(), phone: d.phone.trim(), email: d.email.trim() }]); setD(blank); }} style={{ alignSelf: "flex-start", background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add contact</button>
    </div>
  );
}

/* ---------- Email several suppliers at once ---------- */
export function BulkEmailModal({ suppliers, locationName, onClose }) {
  const withEmail = suppliers.filter((s) => s.managerEmail || (s.contacts || []).some((c) => c.email));
  const [sel, setSel] = useState(withEmail.map((s) => s.id));
  const [subject, setSubject] = useState(`${locationName}: `); const [body, setBody] = useState("");
  const emails = [...new Set(withEmail.filter((s) => sel.includes(s.id)).map((s) => s.managerEmail || (s.contacts || []).find((c) => c.email)?.email).filter(Boolean))];
  const templates = [["Site closure", `Site closure — ${locationName}`, `Please note the site will be closed from [date] to [date]. No visits can take place during this time — please rebook any planned visits.`], ["Access change", `Access arrangements — ${locationName}`, `From [date], contractors must report to [location] and sign in using the QR code at reception before starting work.`], ["Insurance request", "Request for up-to-date insurance certificate", `Please send your current public liability and employer's liability insurance certificates so we can keep our records up to date.`]];
  return (
    <Modal title="Email suppliers" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{templates.map(([l, s, b]) => <ToggleButton key={l} active={false} onClick={() => { setSubject(s); setBody(b); }}>{l}</ToggleButton>)}</div>
        <Field label="Subject"><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message"><TextArea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 90 }} /></Field>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Send to ({sel.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflowY: "auto" }}>
          {withEmail.map((s) => <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}><input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => setSel((p) => e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id))} style={{ margin: 0 }} /> {s.name}</label>)}
          {withEmail.length < suppliers.length && <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{suppliers.length - withEmail.length} supplier{suppliers.length - withEmail.length === 1 ? " has" : "s have"} no email saved.</div>}
        </div>
        <PrimaryButton onClick={() => { if (!emails.length) return; window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }}><Mail size={15} /> Open email to {emails.length} supplier{emails.length === 1 ? "" : "s"} (BCC)</PrimaryButton>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Addresses go in BCC so suppliers don't see each other.</div>
      </div>
    </Modal>
  );
}

/* ---------- Engineer visit reports sent from the QR page ---------- */
export function SubmissionsModal({ submissions, deviceById, onClose, onAccept, onReject }) {
  return (
    <Modal title={`Engineer reports to review (${submissions.length})`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {submissions.length === 0 && <div style={{ fontSize: 13, color: "var(--faint)", textAlign: "center", padding: 14 }}>Nothing waiting.</div>}
        {submissions.map((s) => (
          <div key={s.id} style={{ background: "var(--card-hi)", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{deviceById[s.deviceId]?.name || "Service"} <span style={{ fontWeight: 500, color: "var(--faint)", fontSize: 12 }}>· {fmtDate(s.date)}</span></div>
            <div style={{ fontSize: 12.3 }}>{s.name}{s.company ? ` · ${s.company}` : ""}{s.arrived ? ` · on site ${s.arrived}–${s.left || "?"}` : ""}</div>
            {s.notes && <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap", color: "var(--text-2)" }}>{s.notes}</div>}
            {(s.checks || []).length > 0 && <div style={{ fontSize: 12 }}>{s.checks.map((c, i) => <span key={i} style={{ display: "inline-block", marginRight: 8, color: c.result === "fail" ? "var(--danger)" : "var(--ok)", fontWeight: 650 }}>{c.result === "fail" ? "✗" : c.result === "na" ? "–" : "✓"} {checklistLabel(c.item)}{c.value ? ` ${c.value}` : ""}</span>)}</div>}
            {(s.photos || []).length > 0 && <div style={{ display: "flex", gap: 5 }}>{s.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 7, objectFit: "cover" }} />)}</div>}
            {ACTIVE_CAN_EDIT && <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => onAccept(s)} style={{ flex: 1, background: "var(--ok)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept — log the visit</button>
              <button onClick={() => { const why = window.prompt("Reason for rejecting (optional):", ""); if (why !== null) onReject(s, why); }} style={{ background: "var(--card)", color: "var(--danger)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
            </div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- People across all sites ---------- */
export function PeopleDirectoryModal({ locations, onClose }) {
  const [q, setQ] = useState("");
  const all = locations.flatMap((l) => (l.staff || []).map((p) => ({ ...p, site: l.name })));
  const list = all.filter((p) => !q.trim() || [p.name, p.role, p.company, p.site, p.skills].filter(Boolean).some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal title={`People directory (${all.length})`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, site or skill (e.g. F-Gas)" />
        {list.length === 0 && <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 12 }}>{all.length ? "No one matches." : "Add people to each site under Edit site."}</div>}
        {list.map((p) => (
          <div key={`${p.site}-${p.id}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card-hi)", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650 }}>{p.name} <span style={{ fontWeight: 500, fontSize: 11.5, color: "var(--faint)" }}>{p.role}</span></div>
              <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{[p.site, p.company, p.skills].filter(Boolean).join(" · ")}</div>
            </div>
            {p.phone && <a href={`tel:${p.phone.replace(/[^+0-9]/g, "")}`} style={{ color: "var(--ok)" }}><Phone size={16} /></a>}
            {p.email && <a href={`mailto:${p.email}`} style={{ color: "var(--accent)" }}><Mail size={16} /></a>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- Copy a site's services & suppliers to another site ---------- */
export function CopySiteModal({ locations, countries, devices, suppliers, currentId, onClose, onCopy }) {
  const [from, setFrom] = useState(locations.find((l) => l.id !== currentId && devices.some((d) => d.locationId === l.id))?.id || "");
  const [incSuppliers, setIncSuppliers] = useState(true); const [incChecklists, setIncChecklists] = useState(true);
  const n = devices.filter((d) => d.locationId === from && !d.archived).length; const ns = suppliers.filter((s) => s.locationId === from).length;
  const to = locations.find((l) => l.id === currentId);
  return (
    <Modal title={`Copy services into ${to?.name || "this site"}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Set up a similar site in seconds: copies the services (names, categories, intervals, checklists, budgets) and optionally the suppliers. Visit history, bookings and dates are not copied — set the first due dates afterwards.</div>
        <Field label="Copy from"><Select value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Choose a site…</option>{locations.filter((l) => l.id !== currentId).map((l) => <option key={l.id} value={l.id}>{l.name} ({countries.find((c) => c.id === l.countryId)?.name || ""})</option>)}</Select></Field>
        {from && <div style={{ fontSize: 12.5 }}>{n} service{n === 1 ? "" : "s"} and {ns} supplier{ns === 1 ? "" : "s"} at that site.</div>}
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}><input type="checkbox" checked={incSuppliers} onChange={(e) => setIncSuppliers(e.target.checked)} style={{ margin: 0 }} /> Copy suppliers too (and link services to the copies)</label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}><input type="checkbox" checked={incChecklists} onChange={(e) => setIncChecklists(e.target.checked)} style={{ margin: 0 }} /> Copy visit checklists</label>
        <PrimaryButton onClick={() => from && n && onCopy(from, { incSuppliers, incChecklists })} style={{ opacity: from && n ? 1 : 0.5 }}><Copy size={15} /> Copy {n} service{n === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------- Floor plans with service pins ---------- */
export function FloorPlansView({ plans, devices, onSave, onDelete, onOpenDevice }) {
  const [openId, setOpenId] = useState(plans[0]?.id || null);
  const [placing, setPlacing] = useState(""); const [busy, setBusy] = useState(false); const [name, setName] = useState("");
  const plan = plans.find((p) => p.id === openId) || plans[0];
  async function upload(e) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setBusy(true);
    try { const image = await compressImage(f, 1600, 0.7); const id = uid(); onSave({ name: name.trim() || f.name.replace(/\.[^.]+$/, ""), image, pins: [] }); setName(""); } catch (x) { alert("Couldn't read that image — use a JPG or PNG (save a PDF plan as an image first)."); }
    setBusy(false);
  }
  function place(e) {
    if (!placing || !plan) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    onSave({ ...plan, pins: [...(plan.pins || []).filter((p) => p.deviceId !== placing), { deviceId: placing, x, y }] }); setPlacing("");
  }
  const colour = (d) => { const n = daysUntil(d?.nextServiceDate); return n === null ? "#8A94A0" : n < 0 ? "#C53030" : n <= 30 ? "#D97706" : "#2F855A"; };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {plans.map((p) => <ToggleButton key={p.id} active={plan?.id === p.id} onClick={() => setOpenId(p.id)}>{p.name}</ToggleButton>)}
      </div>
      {ACTIVE_CAN_EDIT && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name, e.g. Ground floor" style={{ flex: 1 }} />
          <label style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 9, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Upload size={14} /> {busy ? "Adding…" : "Add plan"}<input type="file" accept="image/*" onChange={upload} style={{ display: "none" }} /></label>
        </div>
      )}
      {!plan ? <EmptyState icon={MapPin} title="No floor plans yet" body="Upload a picture of each floor plan (a photo or screenshot is fine), then pin your services on it. Pins are coloured by when each service is due — tap one to open it." /> : (
        <>
          {ACTIVE_CAN_EDIT && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <select value={placing} onChange={(e) => setPlacing(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 12.5 }}>
                <option value="">Pin a service on this plan…</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{(plan.pins || []).some((p) => p.deviceId === d.id) ? "✓ " : ""}{d.name}{d.area ? ` — ${d.area}` : ""}</option>)}
              </select>
              <button onClick={() => { if (window.confirm(`Delete the plan "${plan.name}"?`)) { onDelete(plan.id); setOpenId(null); } }} title="Delete plan" style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex" }}><Trash2 size={14} color="#9B2C2C" /></button>
            </div>
          )}
          {placing && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>Now tap the plan where "{devices.find((d) => d.id === placing)?.name}" is.</div>}
          <div onClick={place} style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", cursor: placing ? "crosshair" : "default", background: "#fff" }}>
            <img src={plan.image} alt={plan.name} style={{ width: "100%", display: "block", userSelect: "none" }} draggable={false} />
            {(plan.pins || []).map((p) => { const d = devices.find((x) => x.id === p.deviceId); if (!d) return null; return (
              <button key={p.deviceId} onClick={(e) => { e.stopPropagation(); if (!placing) onOpenDevice(d.id); }} title={`${d.name}${d.nextServiceDate ? ` — due ${fmtDate(d.nextServiceDate)}` : ""}`}
                style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%)", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ background: colour(d), color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>{d.name}</span>
                <span style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${colour(d)}` }} />
              </button>
            ); })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>Pins: <span style={{ color: "#C53030", fontWeight: 700 }}>overdue</span> · <span style={{ color: "#D97706", fontWeight: 700 }}>due in 30 days</span> · <span style={{ color: "#2F855A", fontWeight: 700 }}>OK</span>. To move a pin, pick the service again and tap the new spot.</div>
        </>
      )}
    </div>
  );
}

/* ---------- Key dates (lease events, renewals, statutory filings) ---------- */
export function KeyDatesView({ items, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const open = items.filter((i) => !i.done).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const done = items.filter((i) => i.done);
  return (
    <div>
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ width: "100%", marginBottom: 10 }}><CalendarClock size={15} /> Add a key date</PrimaryButton>}
      {items.length === 0 ? <EmptyState icon={CalendarClock} title="No key dates yet" body="Lease breaks, rent reviews, insurance renewals, licence expiries, contract notice deadlines — the dates that are expensive to miss. You'll be reminded in good time." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {open.map((i) => { const n = daysUntil(i.date); const warn = n <= (Number(i.notifyDays) || 60); return (
            <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${n < 0 ? "var(--danger)" : warn ? "var(--warn)" : "var(--ok)"}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => ACTIVE_CAN_EDIT && setEditing(i)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{i.title}</div>
                <div style={{ fontSize: 11.5, color: n < 0 ? "var(--danger)" : warn ? "var(--warn)" : "var(--faint)", fontWeight: warn ? 700 : 500 }}>{i.type} · {fmtDate(i.date)} · {n < 0 ? `${-n} days ago` : n === 0 ? "today" : `in ${n} days`}{i.url && <a href={/^https?:/i.test(i.url) ? i.url : `https://${i.url}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ marginLeft: 6, color: "var(--accent)" }}>document</a>}</div>
              </button>
              {ACTIVE_CAN_EDIT && <button onClick={() => { const m = window.prompt("Postpone by how many months?", "1"); if (m && Number(m)) onSave({ ...i, date: addMonths(i.date, Number(m)), notes: `${i.notes ? `${i.notes}\n` : ""}Postponed from ${fmtDate(i.date)}` }); }} title="Postpone" style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "6px 9px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Postpone</button>}
              {ACTIVE_CAN_EDIT && <button onClick={() => onSave({ ...i, done: true, doneAt: new Date().toISOString() })} style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Done</button>}
            </div>
          ); })}
          {done.length > 0 && <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>Completed: {done.map((d) => d.title).join(", ")}</div>}
        </div>
      )}
      {editing && <KeyDateModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function KeyDateModal({ existing, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(existing?.title || ""); const [type, setType] = useState(existing?.type || KEY_DATE_TYPES[0]);
  const [date, setDate] = useState(existing?.date || ""); const [notifyDays, setNotifyDays] = useState(String(existing?.notifyDays ?? 90)); const [notes, setNotes] = useState(existing?.notes || ""); const [url, setUrl] = useState(existing?.url || "");
  return (
    <Modal title={existing ? "Key date" : "Add a key date"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="What"><TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tenant break option — Unit B" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}>{KEY_DATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Remind me this many days before"><TextInput type="number" min="0" value={notifyDays} onChange={(e) => setNotifyDays(e.target.value)} /></Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 6 months' written notice required" style={{ minHeight: 50 }} /></Field>
        <Field label="Document link (lease, policy…)"><TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        <PrimaryButton onClick={() => title.trim() && date && onSave({ id: existing?.id, title: title.trim(), type, date, notifyDays: Number(notifyDays) || 0, notes: notes.trim(), url: url.trim(), done: existing?.done || false })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Occupant feedback results ---------- */
export function FeedbackView({ onRaiseJob, items, locationId, locationName, areas = [] }) {
  const [days, setDays] = useState(90); const [area, setArea] = useState("");
  const since = Date.now() - days * 86400000;
  const list = items.filter((f) => new Date(f.at).getTime() >= since && (!area || f.area === area));
  const avg = (t) => { const v = list.map((f) => f.ratings?.[t]).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const url = `${appBaseUrl()}?feedback=${locationId}${orgParam()}`;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {[30, 90, 365].map((d) => <ToggleButton key={d} active={days === d} onClick={() => setDays(d)}>{d === 365 ? "Year" : `${d} days`}</ToggleButton>)}
        {[...new Set(items.map((f) => f.area).filter(Boolean))].length > 0 && <select value={area} onChange={(e) => setArea(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12.5, padding: "6px 8px" }}><option value="">All areas</option>{[...new Set(items.map((f) => f.area).filter(Boolean))].map((a) => <option key={a} value={a}>{a}</option>)}</select>}
        <span style={{ flex: 1 }} />
        <button onClick={() => { const a = window.prompt("Area for this poster (optional, e.g. 'Level 2 kitchen'):", "") ?? ""; const u = a ? `${url}&area=${encodeURIComponent(a)}` : url; openPrintReport("How are we doing?", locationName, `<div style="text-align:center;margin-top:30px"><div style="font-size:30px;font-weight:800">How are we doing?</div><div style="font-size:17px;margin:8px 0 22px">Scan to rate cleaning, temperature, toilets and more — anonymous, 20 seconds${a ? `<br><b>${escapeHtml(a)}</b>` : ""}</div><img src="${qrImageUrl(u, 420)}" style="width:300px;height:300px"><div class="muted" style="margin-top:14px">${escapeHtml(u)}</div></div>`); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><QrCode size={13} /> Print QR poster</button>
      </div>
      {items.length === 0 ? <EmptyState icon={Star} title="No feedback yet" body="Print a QR poster for kitchens, toilets and meeting rooms. People scan it, give quick star ratings and a comment — and you see what needs attention." /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 10 }}>
            {FEEDBACK_TOPICS.map((t) => { const a = avg(t); return <MetricBlock key={t} label={t} value={a == null ? "—" : `${a.toFixed(1)} ★`} tone={a == null ? undefined : a >= 4 ? "ok" : a >= 3 ? undefined : "danger"} />; })}
          </div>
          {(() => { const ms = Array.from({ length: 6 }, (_, k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - k)); return d.toISOString().slice(0, 7); }); const av = ms.map((m) => { const v = items.filter((f) => String(f.at).startsWith(m) && f.ratings?.Overall).map((f) => f.ratings.Overall); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }); if (av.filter((x) => x != null).length < 2) return null; return (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 54, marginBottom: 10 }}>{av.map((v, k) => <div key={k} style={{ flex: 1, textAlign: "center" }}><div title={v == null ? "No responses" : `${v.toFixed(1)}★`} style={{ height: v == null ? 3 : `${(v / 5) * 40}px`, background: v == null ? "var(--card-hi)" : v >= 4 ? "var(--ok)" : v >= 3 ? "var(--warn)" : "var(--danger)", borderRadius: "3px 3px 0 0" }} /><div style={{ fontSize: 9.5, color: "var(--faint)" }}>{new Date(ms[k] + "-01").toLocaleDateString("en-GB", { month: "short" })}</div></div>)}<span style={{ fontSize: 10.5, color: "var(--faint)" }}>Overall ★ by month</span></div>
          ); })()}
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{list.length} response{list.length === 1 ? "" : "s"} in this period</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {list.filter((f) => f.comment).slice(0, 40).map((f) => (
              <div key={f.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 13 }}>"{f.comment}"</div>
                <div style={{ fontSize: 11, color: "var(--faint)", display: "flex", gap: 8, alignItems: "center" }}><span style={{ flex: 1 }}>{new Date(f.at).toLocaleDateString("en-GB")}{f.area ? ` · ${f.area}` : ""}{f.ratings?.Overall ? ` · overall ${f.ratings.Overall}★` : ""}</span>{ACTIVE_CAN_EDIT && onRaiseJob && <button onClick={() => onRaiseJob(`${f.area ? `${f.area}: ` : ""}${f.comment} (from occupant feedback)`)} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Raise a job</button>}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- TV / reception dashboard ---------- */
export function TvDashboard({ locationName, stats, onClose }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); const k = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); try { document.documentElement.requestFullscreen?.(); } catch (e) { /* not allowed */ } return () => { clearInterval(t); window.removeEventListener("keydown", k); try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch (e) { /* ignore */ } }; }, []);
  const tile = (label, value, colour, sub) => (
    <div style={{ background: "#161D25", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "22px 26px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 18, color: "#A3B1BD", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 68, fontWeight: 700, color: colour, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 17, color: "#A3B1BD" }}>{sub}</div>}
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0B0C10", color: "#E9EEF2", zIndex: 9999, padding: "32px 40px", display: "flex", flexDirection: "column", gap: 24, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{locationName}</div>
        <div style={{ fontSize: 26, color: "#A3B1BD" }}>{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
        {tile("PPM on time", stats.pct == null ? "—" : `${stats.pct}%`, stats.pct == null ? "#E9EEF2" : stats.pct >= 90 ? "#6FD69C" : stats.pct >= 70 ? "#F2B45A" : "#FF8A7A")}
        {tile("Overdue", stats.overdue, stats.overdue ? "#FF8A7A" : "#6FD69C", "services")}
        {tile("Open jobs", stats.openWorks, "#E9EEF2", stats.late ? `${stats.late} past target` : "all within target")}
        {tile("On site now", stats.onSite, "#5CC8C2", "contractors & visitors")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, flex: 1, minHeight: 0 }}>
        <div style={{ background: "#161D25", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "22px 26px" }}>
          <div style={{ fontSize: 18, color: "#A3B1BD", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Today</div>
          {stats.today.length === 0 ? <div style={{ fontSize: 22, color: "#A3B1BD" }}>Nothing booked today</div> : stats.today.map((t, i) => <div key={i} style={{ fontSize: 24, padding: "8px 0", borderTop: i ? "1px solid rgba(255,255,255,0.08)" : "none" }}><b style={{ color: "#5CC8C2", fontFamily: "'IBM Plex Mono', monospace" }}>{t.time || "—"}</b> &nbsp;{t.text}</div>)}
        </div>
        <div style={{ background: "#161D25", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "22px 26px" }}>
          <div style={{ fontSize: 18, color: "#A3B1BD", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Notices</div>
          {stats.notices.length === 0 ? <div style={{ fontSize: 22, color: "#A3B1BD" }}>No notices</div> : stats.notices.map((n, i) => <div key={i} style={{ fontSize: 22, padding: "8px 0", borderTop: i ? "1px solid rgba(255,255,255,0.08)" : "none" }}>{n}</div>)}
        </div>
      </div>
      <div style={{ fontSize: 14, color: "#5F6B77", textAlign: "center" }}>Updates automatically · tap anywhere or press Esc to exit</div>
    </div>
  );
}


/* ---------- Isolation points (stopcocks, gas valves, isolators…) ---------- */
export function IsolationsView({ items, onSave, onDelete, onPrintEmergency }) {
  const [editing, setEditing] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: "1 1 200px" }}><Plus size={15} /> Add an isolation point</PrimaryButton>}
        {onPrintEmergency && <button onClick={onPrintEmergency} style={{ flex: "1 1 160px", minHeight: 40, background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Siren size={14} /> Print emergency sheet</button>}
      </div>
      {items.length > 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{items.length} point{items.length === 1 ? "" : "s"} recorded · {ISOLATION_KINDS.slice(0, 3).filter((k) => !items.some((i) => i.kind === k)).length ? `still to add: ${ISOLATION_KINDS.slice(0, 3).filter((k) => !items.some((i) => i.kind === k)).join(", ").toLowerCase()}` : "main water, gas and electricity points all recorded ✓"}</div>}
      {items.length === 0 ? <EmptyState icon={Power} title="No isolation points yet" body="Where are the water stopcock, gas emergency valve and main electrical isolator? Record them with a photo so anyone can find them fast in a leak, gas smell or power fault." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...items].sort((a, b) => ISOLATION_KINDS.indexOf(a.kind) - ISOLATION_KINDS.indexOf(b.kind)).map((i) => (
            <button key={i.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(i)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
              {i.photo ? <img src={i.photo} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : <span style={{ width: 52, height: 52, borderRadius: 8, background: "var(--danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Power size={20} color="var(--danger)" /></span>}
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}><b style={{ fontSize: 13.5 }}>{i.kind}</b><span style={{ display: "block", fontSize: 12.3 }}>{i.location}</span>{/valve|stopcock|isolator|shut-off/i.test(i.kind) && <span style={{ display: "block", fontSize: 11, fontWeight: 650, color: !i.lastExercised || -daysUntil(i.lastExercised) > 365 ? "var(--warn)" : "var(--ok)" }}>{i.lastExercised ? `Last operated ${fmtDate(i.lastExercised)}` : "Not operated on record"}{ACTIVE_CAN_EDIT && <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onSave({ ...i, lastExercised: new Date().toISOString().slice(0, 10) }); }} style={{ marginLeft: 8, color: "var(--accent)", textDecoration: "underline" }}>operated today</span>}</span>}{i.serves && <span style={{ display: "block", fontSize: 11.3, color: "var(--faint)" }}>Serves: {i.serves}</span>}</span>
            </button>
          ))}
        </div>
      )}
      {editing && <IsolationModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function IsolationModal({ existing, onClose, onSave, onDelete }) {
  const [kind, setKind] = useState(existing?.kind || ISOLATION_KINDS[0]); const [location, setLocation] = useState(existing?.location || "");
  const [serves, setServes] = useState(existing?.serves || ""); const [notes, setNotes] = useState(existing?.notes || ""); const [photos, setPhotos] = useState(existing?.photo ? [existing.photo] : []);
  return (
    <Modal title={existing ? "Isolation point" : "Add an isolation point"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="What"><Select value={kind} onChange={(e) => setKind(e.target.value)}>{ISOLATION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field>
        <Field label="Exactly where"><TextInput autoFocus value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Under the sink in the ground-floor cleaners' cupboard" /></Field>
        <Field label="What it shuts off"><TextInput value={serves} onChange={(e) => setServes(e.target.value)} placeholder="e.g. Whole building cold water" /></Field>
        <Field label="Notes"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Turn clockwise · key on the reception key safe" /></Field>
        <PhotoStrip photos={photos} onChange={setPhotos} max={1} label="Photo" />
        <PrimaryButton onClick={() => location.trim() && onSave({ id: existing?.id, kind, location: location.trim(), serves: serves.trim(), notes: notes.trim(), photo: photos[0] || null })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Car park register ---------- */
export function CarParkView({ totalSpaces = null, onSaveSpaces, items, onSave, onDelete }) {
  const [editing, setEditing] = useState(null); const [q, setQ] = useState("");
  const norm = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();
  const list = items.filter((i) => !q.trim() || norm(i.reg).includes(norm(q)) || String(i.name).toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const expiring = items.filter((i) => i.expiry && daysUntil(i.expiry) <= 30).length;
  return (
    <div>
      <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a registration or name" style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, fontSize: 15 }} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: "1 1 180px" }}><Plus size={15} /> Add a vehicle</PrimaryButton>}
        {items.length > 0 && <ExportButton label="CSV" filename="car-park.csv" rows={[["Name", "Registration", "Vehicle", "Space", "Permit", "Expires", "Phone"], ...items.map((i) => [i.name, i.reg, i.vehicle || "", i.space || "", i.permit || "", i.expiry || "", i.phone || ""])]} />}
      </div>
      {(onSaveSpaces || totalSpaces) && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12.5, flexWrap: "wrap" }}><span style={{ color: "var(--muted)" }}>Spaces on site</span>{ACTIVE_CAN_EDIT && onSaveSpaces ? <TextInput type="number" min="0" defaultValue={totalSpaces ?? ""} onBlur={(e) => onSaveSpaces(e.target.value)} style={{ width: 70, padding: "5px 8px" }} /> : <b>{totalSpaces}</b>}{totalSpaces ? <span><b>{items.filter((i) => i.space).length}</b> allocated · <b style={{ color: "var(--ok)" }}>{Math.max(0, totalSpaces - items.filter((i) => i.space).length)}</b> free</span> : null}</div>}
      {expiring > 0 && <div style={{ fontSize: 12, color: "var(--warn)", fontWeight: 650, marginBottom: 8 }}>{expiring} permit{expiring === 1 ? "" : "s"} expired or expiring within 30 days</div>}
      {items.length === 0 ? <EmptyState icon={Car} title="No vehicles yet" body="Staff and regular contractors' vehicles, parking spaces and permits — so you can find who to call when a car is blocking a delivery bay." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((i) => (
            <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ background: "#F2C94C", color: "#000", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800, fontSize: 13, padding: "4px 7px", borderRadius: 5, border: "1.5px solid #000", flexShrink: 0, whiteSpace: "nowrap", textAlign: "center" }}>{String(i.reg).toUpperCase()}</span>
              <button onClick={() => ACTIVE_CAN_EDIT && setEditing(i)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{i.name}</div>
                <div style={{ fontSize: 11.3, color: i.expiry && daysUntil(i.expiry) < 0 ? "var(--danger)" : "var(--faint)" }}>{[i.vehicle, i.space && `Space ${i.space}`, i.permit && `Permit ${i.permit}`, i.expiry && `${daysUntil(i.expiry) < 0 ? "expired" : "to"} ${fmtDate(i.expiry)}`].filter(Boolean).join(" · ")}</div>
              </button>
              <button onClick={() => { const e = escapeHtml; openPrintReport("Parking permit", "", `<div style="border:4px solid #2B5D8A;border-radius:14px;padding:18px;max-width:420px;text-align:center"><div style="font-size:14px;font-weight:800;letter-spacing:.12em;color:#2B5D8A">PARKING PERMIT</div><div style="font-size:34px;font-weight:800;font-family:monospace;background:#F2C94C;border:2px solid #000;border-radius:6px;margin:12px auto;padding:4px 10px;display:inline-block">${e(String(i.reg).toUpperCase())}</div><div style="font-size:16px;font-weight:700">${e(i.name)}</div>${i.space ? `<div style="font-size:14px">Space ${e(i.space)}</div>` : ""}${i.permit ? `<div style="font-size:12px">Permit ${e(i.permit)}</div>` : ""}<div style="font-size:13px;margin-top:8px">Valid until <b>${i.expiry ? fmtDate(i.expiry) : "further notice"}</b></div>${i.phone ? `<div style="font-size:11px;color:#56616D;margin-top:6px">If this car needs moving: ${e(i.phone)}</div>` : ""}</div>`); }} title="Print permit" style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex" }}><Printer size={15} color="#5B6672" /></button>
              {i.phone && <a href={`tel:${i.phone.replace(/[^+0-9]/g, "")}`} title={`Call ${i.name}`}><Phone size={16} color="var(--ok)" /></a>}
            </div>
          ))}
        </div>
      )}
      {editing && <CarModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function CarModal({ existing, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || ""); const [reg, setReg] = useState(existing?.reg || ""); const [vehicle, setVehicle] = useState(existing?.vehicle || "");
  const [space, setSpace] = useState(existing?.space || ""); const [permit, setPermit] = useState(existing?.permit || ""); const [expiry, setExpiry] = useState(existing?.expiry || ""); const [phone, setPhone] = useState(existing?.phone || "");
  return (
    <Modal title={existing ? "Vehicle" : "Add a vehicle"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Registration"><TextInput autoFocus value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder="AB12 CDE" /></Field>
          <Field label="Owner / driver"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Make / colour"><TextInput value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. Blue VW Golf" /></Field>
          <Field label="Mobile"><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          <Field label="Space"><TextInput value={space} onChange={(e) => setSpace(e.target.value)} /></Field>
          <Field label="Permit no."><TextInput value={permit} onChange={(e) => setPermit(e.target.value)} /></Field>
          <Field label="Permit expires"><TextInput type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        </div>
        <PrimaryButton onClick={() => reg.trim() && name.trim() && onSave({ id: existing?.id, name: name.trim(), reg: reg.trim(), vehicle: vehicle.trim(), space: space.trim(), permit: permit.trim(), expiry: expiry || null, phone: phone.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Planned shutdowns (power, water, lifts…) with occupant notices ---------- */
export function ShutdownsView({ items, onSave, onDelete, locationName = "", userName = "" }) {
  const [editing, setEditing] = useState(null);
  const now = new Date().toISOString().slice(0, 16);
  const upcoming = items.filter((s) => (s.end || s.start) >= now).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const past = items.filter((s) => (s.end || s.start) < now).sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const when = (s) => `${new Date(s.start).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${s.end ? ` – ${new Date(s.end).toLocaleString("en-GB", s.end.slice(0, 10) === s.start.slice(0, 10) ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`;
  const notice = (s) => { const e = escapeHtml; openPrintReport(`Planned ${s.type.toLowerCase()} shutdown`, locationName, `<div style="border:4px solid #D97706;border-radius:14px;padding:22px;text-align:center"><div style="font-size:15px;font-weight:800;letter-spacing:.1em;color:#B45309">PLANNED SHUTDOWN</div><div style="font-size:30px;font-weight:800;margin:8px 0">${e(s.type)}</div><div style="font-size:20px;font-weight:700">${e(when(s))}</div>${s.areas ? `<div style="font-size:16px;margin-top:10px">Affected: <b>${e(s.areas)}</b></div>` : ""}${s.reason ? `<div style="font-size:14px;margin-top:10px">${e(s.reason)}</div>` : ""}${s.impact ? `<div style="font-size:14px;margin-top:10px;background:#FEF3C7;border-radius:8px;padding:8px">${e(s.impact)}</div>` : ""}<div style="font-size:12px;color:#56616D;margin-top:14px">Questions? Contact the facilities team${s.contact ? ` — ${e(s.contact)}` : ""}. We're sorry for any inconvenience.</div></div>`); };
  const email = (s) => { window.location.href = `mailto:?subject=${encodeURIComponent(`Planned ${s.type.toLowerCase()} shutdown — ${when(s)}`)}&body=${encodeURIComponent(`Hello,\n\nPlease note there will be a planned ${s.type.toLowerCase()} shutdown at ${locationName}:\n\nWhen: ${when(s)}${s.areas ? `\nAffected areas: ${s.areas}` : ""}${s.reason ? `\nWhy: ${s.reason}` : ""}${s.impact ? `\n\nWhat this means for you: ${s.impact}` : ""}\n\nWe're sorry for any inconvenience.${s.contact ? `\nQuestions: ${s.contact}` : ""}\n\n${userName}`)}`; onSave({ ...s, notifiedAt: new Date().toISOString() }); };
  const row = (s) => (
    <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.start <= now && (s.end || s.start) >= now ? "var(--danger)" : "#D97706"}`, borderRadius: 10, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 4 }}>
      <button onClick={() => ACTIVE_CAN_EDIT && setEditing(s)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.type}{s.start <= now && (s.end || s.start) >= now ? <span style={{ color: "var(--danger)" }}> · happening now</span> : null}</div>
        <div style={{ fontSize: 12.3 }}>{when(s)}</div>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{[s.areas, s.contractor && `by ${s.contractor}`, s.notifiedAt && `occupants told ${fmtDate(s.notifiedAt.slice(0, 10))}`].filter(Boolean).join(" · ")}</div>
      </button>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => notice(s)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Print notice</button>
        {ACTIVE_CAN_EDIT && <button onClick={() => email(s)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>{s.notifiedAt ? "Email occupants again" : "Email occupants"}</button>}
      </div>
    </div>
  );
  return (
    <div>
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ width: "100%", marginBottom: 10 }}><Plus size={15} /> Plan a shutdown</PrimaryButton>}
      {items.length === 0 ? <EmptyState icon={ZapOff} title="No planned shutdowns" body="Power, water, gas, heating, lifts… record planned outages, print a notice for doors and lifts, and email occupants in advance. You'll be reminded the week before." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {upcoming.map(row)}
          {past.length > 0 && <details style={{ marginTop: 6 }}><summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--muted)" }}>Past shutdowns ({past.length})</summary><div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>{past.slice(0, 20).map(row)}</div></details>}
        </div>
      )}
      {editing && <ShutdownModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function ShutdownModal({ existing, onClose, onSave, onDelete }) {
  const [type, setType] = useState(existing?.type || SHUTDOWN_TYPES[0]); const [start, setStart] = useState(existing?.start || ""); const [end, setEnd] = useState(existing?.end || "");
  const [areas, setAreas] = useState(existing?.areas || ""); const [reason, setReason] = useState(existing?.reason || ""); const [impact, setImpact] = useState(existing?.impact || "");
  const [contractor, setContractor] = useState(existing?.contractor || ""); const [contact, setContact] = useState(existing?.contact || "");
  return (
    <Modal title={existing ? "Planned shutdown" : "Plan a shutdown"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="What's being shut down"><Select value={type} onChange={(e) => setType(e.target.value)}>{SHUTDOWN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          <Field label="From"><TextInput type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Until"><TextInput type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <Field label="Areas affected"><TextInput value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="e.g. Whole building / Level 2 east wing" /></Field>
        <Field label="Why (shown on the notice)"><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual electrical safety testing" /></Field>
        <Field label="What it means for people"><TextArea value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="e.g. No lifts — use the stairs. Save your work and shut down PCs before 7am." style={{ minHeight: 60 }} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Contractor"><TextInput value={contractor} onChange={(e) => setContractor(e.target.value)} /></Field>
          <Field label="Contact for questions"><TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name / phone" /></Field>
        </div>
        <PrimaryButton onClick={() => start && onSave({ id: existing?.id, type, start, end, areas: areas.trim(), reason: reason.trim(), impact: impact.trim(), contractor: contractor.trim(), contact: contact.trim(), notifiedAt: existing?.notifiedAt })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
