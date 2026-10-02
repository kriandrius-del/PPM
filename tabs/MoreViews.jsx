// Site → Actions, Spaces and Walk-rounds; the on-call rota; booking several visits together; merging duplicate services.
import { useState } from "react";
import { addDays, compressImage, currentBooking, daysUntil, escapeHtml, fmtDate, uid } from "../lib/utils.js";
import { buildWalkroundReport, openPrintReport, tableHtml } from "../lib/reports.js";
import { ConfirmTextDelete, EmptyState, ExportButton, Field, MetricBlock, Modal, PrimaryButton, Select, TextArea, TextInput, ToggleButton } from "../components/ui.jsx";
import { ACTIVE_CAN_EDIT } from "../lib/globals.js";
import { CalendarCheck, Camera, CheckCircle2, CheckSquare, LayoutGrid, ListChecks, PhoneCall, Plus, Printer, Square, X } from "lucide-react";
import { ACTION_SOURCES, SPACE_USES } from "../lib/constants.js";

/* ---------- Action tracker (risk assessment / audit / incident findings) ---------- */
export function ActionsView({ actions, people = [], onSave, onDelete, locationName }) {
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
export function SpacesView({ spaces, devices = [], onSave, onDelete, locationName, onOpenArea }) {
  const [editing, setEditing] = useState(null);
  const total = spaces.reduce((t, s) => t + (Number(s.areaM2) || 0), 0);
  const byFloor = {}; spaces.forEach((s) => { (byFloor[s.floor || "—"] = byFloor[s.floor || "—"] || []).push(s); });
  const count = (name) => devices.filter((d) => (d.area || "").trim().toLowerCase() === name.trim().toLowerCase()).length;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Spaces" value={spaces.length} />
        <MetricBlock label="Floor area" value={total ? `${Math.round(total).toLocaleString("en-GB")} m²` : "—"} />
        <MetricBlock label="Capacity" value={spaces.reduce((t, s) => t + (Number(s.capacity) || 0), 0) || "—"} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Plus size={15} /> Add a space</PrimaryButton>}
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
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{s.use || "—"}{s.areaM2 ? ` · ${s.areaM2} m²` : ""}{s.capacity ? ` · ${s.capacity} people` : ""}</div>
                </button>
                {count(s.name) > 0 && <button onClick={() => onOpenArea?.(s.name)} style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 12, padding: "3px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{count(s.name)} service{count(s.name) === 1 ? "" : "s"}</button>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {editing && <SpaceModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(s) => { onSave(s); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function SpaceModal({ existing, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || ""); const [floor, setFloor] = useState(existing?.floor || "");
  const [use, setUse] = useState(existing?.use || SPACE_USES[0]); const [areaM2, setAreaM2] = useState(existing?.areaM2 != null ? String(existing.areaM2) : "");
  const [capacity, setCapacity] = useState(existing?.capacity != null ? String(existing.capacity) : ""); const [notes, setNotes] = useState(existing?.notes || "");
  return (
    <Modal title={existing ? "Space" : "Add a space"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Name (match the Area / room used on services)"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plant room" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Floor"><TextInput value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. Ground" /></Field>
          <Field label="Use"><Select value={use} onChange={(e) => setUse(e.target.value)}>{SPACE_USES.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Floor area (m²)"><TextInput type="number" min="0" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} /></Field>
          <Field label="Capacity (people)"><TextInput type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 50 }} /></Field>
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), floor: floor.trim(), use, areaM2: areaM2 === "" ? null : Number(areaM2), capacity: capacity === "" ? null : Number(capacity), notes: notes.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this space" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Photo walk-rounds ---------- */
export function WalkroundsView({ walkrounds, areas = [], onSave, onDelete, onRaiseAction, locationName }) {
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
      {editing && <WalkroundModal existing={editing.id ? editing : null} areas={areas} onClose={() => setEditing(null)} onRaiseAction={onRaiseAction} onSave={(w) => { onSave(w); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function WalkroundModal({ existing, areas, onClose, onSave, onDelete, onRaiseAction }) {
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
              {ACTIVE_CAN_EDIT && <button onClick={() => onSave(rota.filter((x) => x.id !== r.id))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={12} color="#A3ABB4" /></button>}
            </div>
          ))}
          {ACTIVE_CAN_EDIT && (
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
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Moves every visit, job, task and planned visit from <b>{device.name}</b> onto the service you choose, then removes <b>{device.name}</b>. It can be restored for 30 days from 🕘 → Deleted.</div>
        <Field label="Keep this service"><Select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose…</option>{others.map((d) => <option key={d.id} value={d.id}>{d.name}{d.area ? ` — ${d.area}` : ""}</option>)}</Select></Field>
        <PrimaryButton onClick={() => target && onMerge(device.id, target)} style={{ opacity: target ? 1 : 0.5 }}><CheckCircle2 size={15} /> Merge into this service</PrimaryButton>
      </div>
    </Modal>
  );
}
