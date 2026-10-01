// Site tab safety records: legionella water temperatures, training & competency, fire drills.
import { useMemo, useState } from "react";
import { DOC_TYPES, DRILL_TYPES, TRAINING_COURSES, WATER_LIMITS } from "../lib/constants.js";
import { addMonths, daysUntil, escapeHtml, fmtDate, uid } from "../lib/utils.js";
import { openPrintReport, tableHtml } from "../lib/reports.js";
import { ConfirmTextDelete, EmptyState, ExportButton, Field, MetricBlock, Modal, PrimaryButton, Select, TextArea, TextInput, ToggleButton } from "../components/ui.jsx";
import { ACTIVE_CAN_EDIT } from "../lib/globals.js";
import { CheckCircle2, Droplets, FileText, Flame, GraduationCap, Link2, Printer } from "lucide-react";

/* ---------- Water temperatures (legionella control) ---------- */
export function WaterTempsView({ outlets, readings, areas, locationName, onSaveOutlet, onDeleteOutlet, onAddReadings }) {
  const [editing, setEditing] = useState(null);
  const [logging, setLogging] = useState(false);
  const last = (o) => readings.filter((r) => r.outletId === o.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const bad = outlets.filter((o) => { const l = last(o); return l && WATER_LIMITS[o.type] && !WATER_LIMITS[o.type].ok(Number(l.temp)); });
  const due = outlets.filter((o) => { const l = last(o); return !l || -daysUntil(l.date) > 35; });
  function print() {
    const e = escapeHtml; const months = [...new Set(readings.map((r) => String(r.date).slice(0, 7)))].sort().slice(-6);
    openPrintReport("Water temperature log (legionella control)", locationName, `<div class="muted">Targets: hot ${WATER_LIMITS.hot.rule} within 1 minute · cold ${WATER_LIMITS.cold.rule} within 2 minutes · TMV ${WATER_LIMITS.tmv.rule}</div>
      ${tableHtml(["Outlet", "Type", ...months.map((m) => new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }))], outlets.map((o) => [`<b>${e(o.name)}</b>${o.area ? `<div class="muted">${e(o.area)}</div>` : ""}${o.sentinel ? '<div class="muted">sentinel</div>' : ""}`, WATER_LIMITS[o.type]?.label || "", ...months.map((m) => {
        const r = readings.filter((x) => x.outletId === o.id && String(x.date).startsWith(m)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
        return r ? `<span class="${WATER_LIMITS[o.type]?.ok(Number(r.temp)) ? "ok" : "bad"}">${r.temp}°C</span>` : "";
      })]))}`);
  }
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Outlets" value={outlets.length} />
        <MetricBlock label="Out of range" value={bad.length} tone={bad.length ? "danger" : "ok"} />
        <MetricBlock label="Check due" value={due.length} tone={due.length ? "danger" : undefined} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && outlets.length > 0 && <PrimaryButton onClick={() => setLogging(true)} style={{ flex: 1 }}><Droplets size={15} /> Record this month's temperatures</PrimaryButton>}
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditing({})} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>+ Outlet</button>}
      </div>
      <div style={{ fontSize: 11, color: "#8A94A0", marginBottom: 8 }}>Monthly checks at sentinel outlets (HSG274): hot {WATER_LIMITS.hot.rule} within a minute, cold {WATER_LIMITS.cold.rule} within two minutes, TMVs {WATER_LIMITS.tmv.rule}.</div>
      {outlets.length === 0 ? (
        <EmptyState icon={Droplets} title="No outlets yet" body="Add your sentinel outlets (nearest and furthest from the calorifier/tank) and any TMVs, then record temperatures monthly. Out-of-range readings raise an alert." actionLabel={ACTIVE_CAN_EDIT ? "Add an outlet" : undefined} onAction={() => setEditing({})} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {outlets.map((o) => {
            const l = last(o); const ok = l && WATER_LIMITS[o.type]?.ok(Number(l.temp));
            return (
              <button key={o.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(o)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${!l ? "#8A94A0" : ok ? "#2F855A" : "#C53030"}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{o.name}{o.sentinel && <span style={{ fontSize: 10.5, color: "#2B6CB0", fontWeight: 700 }}> · sentinel</span>}</div>
                  <div style={{ fontSize: 11, color: "#8A94A0" }}>{WATER_LIMITS[o.type]?.label}{o.area ? ` · ${o.area}` : ""}{l ? ` · ${fmtDate(l.date)}` : " · not checked"}</div>
                </div>
                {l && <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: ok ? "#2F855A" : "#C53030" }}>{l.temp}°C</b>}
              </button>
            );
          })}
          <button onClick={print} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}><Printer size={14} /> Print temperature log</button>
        </div>
      )}
      {editing && <OutletModal existing={editing.id ? editing : null} areas={areas} onClose={() => setEditing(null)} onSave={(o) => { onSaveOutlet(o); setEditing(null); }} onDelete={(id) => { onDeleteOutlet(id); setEditing(null); }} />}
      {logging && <WaterReadingsModal outlets={outlets} onClose={() => setLogging(false)} onSave={(list) => { onAddReadings(list); setLogging(false); }} />}
    </div>
  );
}
function OutletModal({ existing, areas, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || "");
  const [type, setType] = useState(existing?.type || "hot");
  const [area, setArea] = useState(existing?.area || "");
  const [sentinel, setSentinel] = useState(!!existing?.sentinel);
  const listId = useMemo(() => `wo-${uid()}`, []);
  return (
    <Modal title={existing ? "Edit outlet" : "Add an outlet"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Outlet"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. L2 kitchen tap (furthest hot)" /></Field>
        <div style={{ display: "flex", gap: 6 }}>{Object.entries(WATER_LIMITS).map(([k, v]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{v.label}</ToggleButton>)}</div>
        <Field label="Area"><TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><input type="checkbox" checked={sentinel} onChange={(e) => setSentinel(e.target.checked)} style={{ margin: 0 }} /> Sentinel outlet (nearest / furthest from the source)</label>
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), type, area: area.trim(), sentinel })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this outlet" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
function WaterReadingsModal({ outlets, onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [temps, setTemps] = useState({});
  const entered = outlets.filter((o) => temps[o.id] !== undefined && temps[o.id] !== "");
  return (
    <Modal title="Record temperatures" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {outlets.map((o) => {
          const v = temps[o.id]; const has = v !== undefined && v !== ""; const ok = has && WATER_LIMITS[o.type].ok(Number(v));
          return (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.8, fontWeight: 650 }}>{o.name}</div>
                <div style={{ fontSize: 10.8, color: "#8A94A0" }}>{WATER_LIMITS[o.type].label} · target {WATER_LIMITS[o.type].rule}</div>
              </div>
              <TextInput type="number" inputMode="decimal" step="0.1" value={v ?? ""} onChange={(e) => setTemps((p) => ({ ...p, [o.id]: e.target.value }))} placeholder="°C" style={{ width: 76, borderColor: has ? (ok ? "#2F855A" : "#C53030") : undefined }} />
            </div>
          );
        })}
        {entered.some((o) => !WATER_LIMITS[o.type].ok(Number(temps[o.id]))) && <div style={{ fontSize: 11.5, color: "#C53030", fontWeight: 600 }}>Out-of-range readings: flush the outlet, re-test, and check the TMV / calorifier. These will show as alerts until a good reading is logged.</div>}
        <PrimaryButton onClick={() => entered.length && onSave(entered.map((o) => ({ outletId: o.id, date, temp: Number(temps[o.id]) })))}><CheckCircle2 size={15} /> Save {entered.length} reading{entered.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------- Training & competency ---------- */
export function TrainingView({ records, locationName, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState("list");
  const current = (course) => records.filter((r) => r.course === course && (!r.expiry || daysUntil(r.expiry) >= 0));
  const people = [...new Set(records.map((r) => r.person))].sort();
  const sorted = [...records].sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="First aiders (valid)" value={current("First Aid at Work").length + current("Emergency First Aid at Work").length} />
        <MetricBlock label="Fire marshals (valid)" value={current("Fire marshal / warden").length} />
        <MetricBlock label="Expired" value={records.filter((r) => r.expiry && daysUntil(r.expiry) < 0).length} tone={records.some((r) => r.expiry && daysUntil(r.expiry) < 0) ? "danger" : undefined} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><GraduationCap size={15} /> Add training record</PrimaryButton>}
        {records.length > 0 && <ExportButton label="CSV" filename="training-register.csv" rows={[["Person", "Course", "Completed", "Expires", "Provider"], ...records.map((r) => [r.person, r.course, r.date || "", r.expiry || "", r.provider || ""])]} />}
      </div>
      {records.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <ToggleButton active={mode === "list"} onClick={() => setMode("list")}>List</ToggleButton>
          <ToggleButton active={mode === "matrix"} onClick={() => setMode("matrix")}>Matrix</ToggleButton>
        </div>
      )}
      {mode === "matrix" && records.length > 0 && (() => {
        const courses = [...new Set(records.map((r) => r.course))];
        const cell = (person, course) => records.filter((r) => r.person === person && r.course === course).sort((a, b) => String(b.expiry || "9999").localeCompare(String(a.expiry || "9999")))[0];
        return (
          <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, marginBottom: 10 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
              <thead><tr><th style={{ textAlign: "left", padding: 6, position: "sticky", left: 0, background: "#fff" }}>Person</th>{courses.map((c) => <th key={c} style={{ padding: 6, fontWeight: 650, color: "#5B6672", minWidth: 70, verticalAlign: "bottom" }}>{c}</th>)}</tr></thead>
              <tbody>{people.map((p) => (
                <tr key={p} style={{ borderTop: "1px solid #EEF0F2" }}>
                  <td style={{ padding: 6, fontWeight: 650, position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>{p}</td>
                  {courses.map((c) => { const r = cell(p, c); const n = r?.expiry ? daysUntil(r.expiry) : null; const [bg, fg, t] = !r ? ["#fff", "#C0C6CC", "—"] : n === null ? ["#EAF4EE", "#2F6B4A", "✓"] : n < 0 ? ["#FBEAEA", "#9B2C2C", "Expired"] : n <= 45 ? ["#FDF1E0", "#8A5A0B", fmtDate(r.expiry)] : ["#EAF4EE", "#2F6B4A", fmtDate(r.expiry)];
                    return <td key={c} onClick={() => r && ACTIVE_CAN_EDIT && setEditing(r)} style={{ padding: 6, textAlign: "center", background: bg, color: fg, fontWeight: 650, cursor: r ? "pointer" : "default", whiteSpace: "nowrap" }}>{t}</td>; })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        );
      })()}
      {mode === "list" && (records.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No training records yet" body="Keep track of first aiders, fire marshals and other competencies with expiry dates. You'll be reminded 45 days before a certificate runs out." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((r) => {
            const n = r.expiry ? daysUntil(r.expiry) : null;
            return (
              <button key={r.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(r)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${n === null ? "#8A94A0" : n < 0 ? "#C53030" : n <= 45 ? "#D97706" : "#2F855A"}`, borderRadius: 10, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{r.person} <span style={{ color: "#8A94A0", fontWeight: 500 }}>· {r.course}</span></div>
                <div style={{ fontSize: 11, color: n !== null && n < 0 ? "#C53030" : "#8A94A0", fontWeight: n !== null && n <= 45 ? 700 : 500 }}>{r.date ? `Done ${fmtDate(r.date)}` : ""}{r.expiry ? ` · ${n < 0 ? "expired" : "expires"} ${fmtDate(r.expiry)}` : " · no expiry"}{r.provider ? ` · ${r.provider}` : ""}</div>
              </button>
            );
          })}
          <div style={{ fontSize: 11, color: "#8A94A0", marginTop: 4 }}>{people.length} people on the register at {locationName}.</div>
        </div>
      ))}
      {editing && <TrainingModal existing={editing.id ? editing : null} people={people} onClose={() => setEditing(null)} onSave={(r) => { onSave(r); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function TrainingModal({ existing, people, onClose, onSave, onDelete }) {
  const [person, setPerson] = useState(existing?.person || "");
  const [course, setCourse] = useState(existing?.course || TRAINING_COURSES[0]);
  const [other, setOther] = useState(existing && !TRAINING_COURSES.includes(existing.course) ? existing.course : "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [expiry, setExpiry] = useState(existing?.expiry || addMonths(new Date().toISOString().slice(0, 10), 36));
  const [provider, setProvider] = useState(existing?.provider || "");
  const listId = useMemo(() => `tp-${uid()}`, []);
  const typical = { "First Aid at Work": 36, "Emergency First Aid at Work": 36, "Fire marshal / warden": 36, "Asbestos awareness": 12, "Legionella awareness": 24, "Mental health first aid": 36 };
  return (
    <Modal title={existing ? "Training record" : "Add training record"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Person"><TextInput list={listId} autoFocus value={person} onChange={(e) => setPerson(e.target.value)} /><datalist id={listId}>{people.map((p) => <option key={p} value={p} />)}</datalist></Field>
        <Field label="Course">
          <Select value={TRAINING_COURSES.includes(course) ? course : "Other"} onChange={(e) => { setCourse(e.target.value); if (typical[e.target.value] && date) setExpiry(addMonths(date, typical[e.target.value])); }}>{TRAINING_COURSES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </Field>
        {course === "Other" && <Field label="Course name"><TextInput value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Completed"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Expires"><TextInput type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        </div>
        <Field label="Provider (optional)"><TextInput value={provider} onChange={(e) => setProvider(e.target.value)} /></Field>
        <PrimaryButton onClick={() => person.trim() && onSave({ id: existing?.id, person: person.trim(), course: course === "Other" ? (other.trim() || "Other") : course, date: date || null, expiry: expiry || null, provider: provider.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this record" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Fire drills ---------- */
export function DrillsView({ drills, locationName, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const sorted = [...drills].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const lastFire = sorted.find((d) => d.type === "Fire evacuation");
  const times = sorted.filter((d) => d.type === "Fire evacuation" && Number(d.minutes)).slice(0, 5);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Last fire drill" value={lastFire ? fmtDate(lastFire.date) : "—"} tone={!lastFire || -daysUntil(lastFire.date) > 365 ? "danger" : undefined} />
        <MetricBlock label="Last evacuation time" value={times[0] ? `${times[0].minutes} min` : "—"} />
        <MetricBlock label="Drills this year" value={drills.filter((d) => String(d.date).startsWith(String(new Date().getFullYear()))).length} />
      </div>
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ width: "100%", marginBottom: 10 }}><Flame size={15} /> Record a drill</PrimaryButton>}
      {sorted.length === 0 ? (
        <EmptyState icon={Flame} title="No drills recorded" body="Hold a fire evacuation drill at least once a year (twice is common practice). Record the time taken, how many people took part and any issues to follow up." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((d) => (
            <button key={d.id} onClick={() => setEditing(d)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 650 }}>{d.type}</span>{d.minutes ? <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{d.minutes} min</b> : null}</div>
              <div style={{ fontSize: 11, color: "#8A94A0" }}>{fmtDate(d.date)}{d.time ? ` ${d.time}` : ""}{d.people ? ` · ${d.people} people` : ""}{d.issues ? " · issues noted" : ""}</div>
            </button>
          ))}
        </div>
      )}
      {editing && <DrillModal existing={editing.id ? editing : null} locationName={locationName} onClose={() => setEditing(null)} onSave={(d) => { onSave(d); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function DrillModal({ existing, locationName, onClose, onSave, onDelete }) {
  const [type, setType] = useState(existing?.type || DRILL_TYPES[0]);
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(existing?.time || "");
  const [minutes, setMinutes] = useState(existing?.minutes ? String(existing.minutes) : "");
  const [people, setPeople] = useState(existing?.people ? String(existing.people) : "");
  const [issues, setIssues] = useState(existing?.issues || "");
  const [actions, setActions] = useState(existing?.actions || "");
  function print() {
    const e = escapeHtml;
    openPrintReport(`Drill record — ${type}`, `${locationName} · ${fmtDate(date)} ${time}`, tableHtml(["", ""], [["Type", e(type)], ["Date & time", `${fmtDate(date)} ${e(time)}`], ["Time to evacuate", minutes ? `${e(minutes)} minutes` : ""], ["People taking part", e(people)], ["Issues found", e(issues).replace(/\n/g, "<br>")], ["Actions", e(actions).replace(/\n/g, "<br>")], ["Recorded by", e(existing?.by || "")]]));
  }
  return (
    <Modal title={existing ? "Drill record" : "Record a drill"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}>{DRILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Minutes to clear the building"><TextInput type="number" min="0" step="0.5" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
          <Field label="People taking part"><TextInput type="number" min="0" value={people} onChange={(e) => setPeople(e.target.value)} /></Field>
        </div>
        <Field label="Issues found"><TextArea value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="e.g. Sounder not heard in L3 meeting room; one fire door wedged open" /></Field>
        <Field label="Actions"><TextArea value={actions} onChange={(e) => setActions(e.target.value)} /></Field>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => onSave({ id: existing?.id, type, date, time, minutes: minutes ? Number(minutes) : null, people: people ? Number(people) : null, issues: issues.trim(), actions: actions.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>}
        {existing && <button onClick={print} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print record</button>}
        {existing && <ConfirmTextDelete label="Delete this record" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Site documents & certificates ---------- */
export function DocumentsView({ docs, onSave, locationName }) {
  const [editing, setEditing] = useState(null);
  const sorted = [...docs].sort((a, b) => (a.reviewDate || "9999").localeCompare(b.reviewDate || "9999"));
  const overdue = docs.filter((d) => d.reviewDate && daysUntil(d.reviewDate) < 0).length;
  const missing = ["Fire risk assessment", "Asbestos register & survey", "Legionella risk assessment", "EICR (electrical) certificate"].filter((t) => !docs.some((d) => d.type === t));
  function save(doc) { const list = doc.id ? docs.map((d) => d.id === doc.id ? { ...d, ...doc } : d) : [{ ...doc, id: uid() }, ...docs]; onSave(list); setEditing(null); }
  function remove(id) { onSave(docs.filter((d) => d.id !== id)); setEditing(null); }
  function print() {
    const e = escapeHtml;
    openPrintReport("Site documents & certificates", locationName, tableHtml(["Document", "Type", "Issued", "Review / expiry", "Held by / location", "Link"], sorted.map((d) => [`<b>${e(d.title)}</b>`, e(d.type), d.issued ? fmtDate(d.issued) : "", d.reviewDate ? `<span class="${daysUntil(d.reviewDate) < 0 ? "bad" : daysUntil(d.reviewDate) <= 30 ? "warn" : "ok"}">${fmtDate(d.reviewDate)}</span>` : "", e(d.holder || ""), d.url ? e(d.url) : ""])));
  }
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Documents" value={docs.length} />
        <MetricBlock label="Overdue review" value={overdue} tone={overdue ? "danger" : "ok"} />
        <MetricBlock label="Key docs missing" value={missing.length} tone={missing.length ? "danger" : "ok"} />
      </div>
      {missing.length > 0 && <div style={{ fontSize: 11.5, color: "#9B2C2C", marginBottom: 8 }}>Not on file: {missing.join(", ")}.</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><FileText size={15} /> Add a document</PrimaryButton>}
        {docs.length > 0 && <button onClick={print} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={14} color="#2B4562" /></button>}
      </div>
      {docs.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" body="Keep your fire risk assessment, asbestos register, legionella risk assessment, certificates and manuals in one list — with links and review dates, so you're reminded before anything lapses." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((d) => {
            const n = d.reviewDate ? daysUntil(d.reviewDate) : null;
            return (
              <div key={d.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${n === null ? "#8A94A0" : n < 0 ? "#C53030" : n <= 30 ? "#D97706" : "#2F855A"}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(d)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: n !== null && n < 0 ? "#C53030" : "#8A94A0", fontWeight: n !== null && n <= 30 ? 700 : 500 }}>{d.type}{d.reviewDate ? ` · ${n < 0 ? "review overdue" : "review"} ${fmtDate(d.reviewDate)}` : ""}{d.holder ? ` · ${d.holder}` : ""}</div>
                </button>
                {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" title="Open" style={{ padding: 4, display: "flex" }}><Link2 size={15} color="#2B4562" /></a>}
              </div>
            );
          })}
        </div>
      )}
      {editing && <DocModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />}
    </div>
  );
}
function DocModal({ existing, onClose, onSave, onDelete }) {
  const [type, setType] = useState(existing?.type || DOC_TYPES[0]);
  const [title, setTitle] = useState(existing?.title || "");
  const [issued, setIssued] = useState(existing?.issued || "");
  const [reviewDate, setReviewDate] = useState(existing?.reviewDate || "");
  const [holder, setHolder] = useState(existing?.holder || "");
  const [url, setUrl] = useState(existing?.url || "");
  const typical = { "Fire risk assessment": 12, "Legionella risk assessment": 24, "EICR (electrical) certificate": 60, "Gas safety certificate": 12, "Lift thorough examination (LOLER) report": 6, "Asbestos register & survey": 12, "EPC / DEC": 120, "Building insurance": 12 };
  return (
    <Modal title={existing ? "Document" : "Add a document"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Type"><Select value={type} onChange={(e) => { setType(e.target.value); if (!title) setTitle(e.target.value); if (issued && typical[e.target.value]) setReviewDate(addMonths(issued, typical[e.target.value])); }}>{DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type} /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Issued / done"><TextInput type="date" value={issued} onChange={(e) => { setIssued(e.target.value); if (e.target.value && typical[type]) setReviewDate(addMonths(e.target.value, typical[type])); }} /></Field>
          <Field label="Review / expiry"><TextInput type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></Field>
        </div>
        <Field label="Held by / where (optional)"><TextInput value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="e.g. Fire file at reception" /></Field>
        <Field label="Link (SharePoint, Drive…)"><TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        <PrimaryButton onClick={() => onSave({ id: existing?.id, type, title: (title || type).trim(), issued: issued || null, reviewDate: reviewDate || null, holder: holder.trim(), url: url.trim() ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`) : "" })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this document" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
