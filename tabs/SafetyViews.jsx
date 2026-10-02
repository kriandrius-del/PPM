// Site tab safety records: legionella water temperatures, training & competency, fire drills.
import { useMemo, useState } from "react";
import { ASBESTOS_MATERIALS, DOC_TYPES, DRILL_TYPES, LOG_TEMPLATES, TRAINING_COURSES, WATER_LIMITS } from "../lib/constants.js";
import { addMonths, daysUntil, escapeHtml, fmtDate, uid } from "../lib/utils.js";
import { buildAsbestosRegister, openPrintReport, tableHtml } from "../lib/reports.js";
import { ConfirmTextDelete, EmptyState, ExportButton, Field, MetricBlock, Modal, PhotoStrip, PrimaryButton, Select, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { ACTIVE_CAN_EDIT } from "../lib/globals.js";
import { CheckCircle2, ClipboardList, Droplets, FileText, Flame, GraduationCap, Link2, Plus, Printer, ShieldAlert, X } from "lucide-react";

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
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditing({})} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>+ Outlet</button>}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 8 }}>Monthly checks at sentinel outlets (HSG274): hot {WATER_LIMITS.hot.rule} within a minute, cold {WATER_LIMITS.cold.rule} within two minutes, TMVs {WATER_LIMITS.tmv.rule}.</div>
      {outlets.length === 0 ? (
        <EmptyState icon={Droplets} title="No outlets yet" body="Add your sentinel outlets (nearest and furthest from the calorifier/tank) and any TMVs, then record temperatures monthly. Out-of-range readings raise an alert." actionLabel={ACTIVE_CAN_EDIT ? "Add an outlet" : undefined} onAction={() => setEditing({})} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {outlets.map((o) => {
            const l = last(o); const ok = l && WATER_LIMITS[o.type]?.ok(Number(l.temp));
            return (
              <button key={o.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(o)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${!l ? "#8A94A0" : ok ? "#2F855A" : "#C53030"}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{o.name}{o.sentinel && <span style={{ fontSize: 10.5, color: "#2B6CB0", fontWeight: 700 }}> · sentinel</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>{WATER_LIMITS[o.type]?.label}{o.area ? ` · ${o.area}` : ""}{l ? ` · ${fmtDate(l.date)}` : " · not checked"}</div>
                </div>
                {l && <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: ok ? "var(--ok)" : "var(--danger)" }}>{l.temp}°C</b>}
              </button>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={print} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print temperature log</button>
            <ExportButton label="CSV" filename="water-temperatures.csv" rows={[["Date", "Outlet", "Type", "Area", "Sentinel", "Temperature °C", "In range", "By"], ...[...readings].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((r) => { const o = outlets.find((x) => x.id === r.outletId); return [r.date, o?.name || "", WATER_LIMITS[o?.type]?.label || "", o?.area || "", o?.sentinel ? "Yes" : "", r.temp, o && WATER_LIMITS[o.type]?.ok(Number(r.temp)) ? "Yes" : "No", r.by || ""]; })]} />
          </div>
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
                <div style={{ fontSize: 10.8, color: "var(--faint)" }}>{WATER_LIMITS[o.type].label} · target {WATER_LIMITS[o.type].rule}</div>
              </div>
              <TextInput type="number" inputMode="decimal" step="0.1" value={v ?? ""} onChange={(e) => setTemps((p) => ({ ...p, [o.id]: e.target.value }))} placeholder="°C" style={{ width: 76, borderColor: has ? (ok ? "#2F855A" : "#C53030") : undefined }} />
            </div>
          );
        })}
        {entered.some((o) => !WATER_LIMITS[o.type].ok(Number(temps[o.id]))) && <div style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 600 }}>Out-of-range readings: flush the outlet, re-test, and check the TMV / calorifier. These will show as alerts until a good reading is logged.</div>}
        <PrimaryButton onClick={() => entered.length && onSave(entered.map((o) => ({ outletId: o.id, date, temp: Number(temps[o.id]) })))}><CheckCircle2 size={15} /> Save {entered.length} reading{entered.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------- Training & competency ---------- */
export function TrainingView({ required = [], onSaveRequired, records, locationName, onSave, onDelete }) {
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
      {ACTIVE_CAN_EDIT && onSaveRequired && (
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 5 }}>Required for everyone at this site</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{TRAINING_COURSES.filter((c) => c !== "Other").map((c) => <ToggleButton key={c} active={required.includes(c)} onClick={() => onSaveRequired(required.includes(c) ? required.filter((x) => x !== c) : [...required, c])}>{c}</ToggleButton>)}</div>
        </div>
      )}
      {records.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <ToggleButton active={mode === "list"} onClick={() => setMode("list")}>List</ToggleButton>
          <ToggleButton active={mode === "matrix"} onClick={() => setMode("matrix")}>Matrix</ToggleButton>
        </div>
      )}
      {mode === "matrix" && records.length > 0 && (() => {
        const courses = [...new Set([...required, ...records.map((r) => r.course)])];
        const cell = (person, course) => records.filter((r) => r.person === person && r.course === course).sort((a, b) => String(b.expiry || "9999").localeCompare(String(a.expiry || "9999")))[0];
        return (
          <div style={{ overflowX: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 10 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
              <thead><tr><th style={{ textAlign: "left", padding: 6, position: "sticky", left: 0, background: "var(--card)" }}>Person</th>{courses.map((c) => <th key={c} style={{ padding: 6, fontWeight: 650, color: "var(--muted)", minWidth: 70, verticalAlign: "bottom" }}>{c}</th>)}</tr></thead>
              <tbody>{people.map((p) => (
                <tr key={p} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: 6, fontWeight: 650, position: "sticky", left: 0, background: "var(--card)", whiteSpace: "nowrap" }}>{p}</td>
                  {courses.map((c) => { const r = cell(p, c); const n = r?.expiry ? daysUntil(r.expiry) : null; const [bg, fg, t] = !r ? (required.includes(c) ? ["var(--danger-soft)", "var(--danger)", "Needed"] : ["var(--card)", "#C0C6CC", "—"]) : n === null ? ["#EAF4EE", "#2F6B4A", "✓"] : n < 0 ? ["#FBEAEA", "#9B2C2C", "Expired"] : n <= 45 ? ["#FDF1E0", "#8A5A0B", fmtDate(r.expiry)] : ["#EAF4EE", "#2F6B4A", fmtDate(r.expiry)];
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
              <button key={r.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(r)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${n === null ? "#8A94A0" : n < 0 ? "#C53030" : n <= 45 ? "#D97706" : "#2F855A"}`, borderRadius: 10, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{r.person} <span style={{ color: "var(--faint)", fontWeight: 500 }}>· {r.course}</span></div>
                <div style={{ fontSize: 11, color: n !== null && n < 0 ? "var(--danger)" : "var(--faint)", fontWeight: n !== null && n <= 45 ? 700 : 500 }}>{r.date ? `Done ${fmtDate(r.date)}` : ""}{r.expiry ? ` · ${n < 0 ? "expired" : "expires"} ${fmtDate(r.expiry)}` : " · no expiry"}{r.provider ? ` · ${r.provider}` : ""}</div>
              </button>
            );
          })}
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>{people.length} people on the register at {locationName}.</div>
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
  const [certPhotos, setCertPhotos] = useState(existing?.certPhoto ? [existing.certPhoto] : []);
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
        <PhotoStrip photos={certPhotos} onChange={setCertPhotos} max={1} label="Certificate photo (optional)" />
        <PrimaryButton onClick={() => person.trim() && onSave({ id: existing?.id, person: person.trim(), course: course === "Other" ? (other.trim() || "Other") : course, date: date || null, expiry: expiry || null, provider: provider.trim(), certPhoto: certPhotos[0] || null })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this record" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------- Fire drills ---------- */
export function DrillsView({ nextDrill = "", onSaveNextDrill, drills, locationName, onSave, onDelete }) {
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
      {ACTIVE_CAN_EDIT && onSaveNextDrill && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, background: "var(--card-hi)", borderRadius: 10, padding: "8px 10px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 650, flex: 1 }}>Next drill planned for</span>
          <TextInput type="date" value={nextDrill} onChange={(e) => onSaveNextDrill(e.target.value)} style={{ width: 150 }} />
        </div>
      )}
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ width: "100%", marginBottom: 10 }}><Flame size={15} /> Record a drill</PrimaryButton>}
      {sorted.length === 0 ? (
        <EmptyState icon={Flame} title="No drills recorded" body="Hold a fire evacuation drill at least once a year (twice is common practice). Record the time taken, how many people took part and any issues to follow up." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((d) => (
            <button key={d.id} onClick={() => setEditing(d)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 650 }}>{d.type}</span>{d.minutes ? <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{d.minutes} min</b> : null}</div>
              <div style={{ fontSize: 11, color: "var(--faint)" }}>{fmtDate(d.date)}{d.time ? ` ${d.time}` : ""}{d.people ? ` · ${d.people} people` : ""}{d.issues ? " · issues noted" : ""}</div>
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
        {existing && <button onClick={print} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print record</button>}
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
      {missing.length > 0 && <div style={{ fontSize: 11.5, color: "var(--danger)", marginBottom: 8 }}>Not on file: {missing.join(", ")}.</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><FileText size={15} /> Add a document</PrimaryButton>}
        {docs.length > 0 && <button onClick={print} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={14} color="#2B4562" /></button>}
      </div>
      {docs.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" body="Keep your fire risk assessment, asbestos register, legionella risk assessment, certificates and manuals in one list — with links and review dates, so you're reminded before anything lapses." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((d) => {
            const n = d.reviewDate ? daysUntil(d.reviewDate) : null;
            return (
              <div key={d.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${n === null ? "#8A94A0" : n < 0 ? "#C53030" : n <= 30 ? "#D97706" : "#2F855A"}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(d)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: n !== null && n < 0 ? "var(--danger)" : "var(--faint)", fontWeight: n !== null && n <= 30 ? 700 : 500 }}>{d.type}{d.reviewDate ? ` · ${n < 0 ? "review overdue" : "review"} ${fmtDate(d.reviewDate)}` : ""}{d.holder ? ` · ${d.holder}` : ""}</div>
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

/* ---------- Site logs (custom registers) ---------- */
export function LogsView({ defs, entries, onSaveDefs, onSave, onDelete, locationName }) {
  const [openId, setOpenId] = useState(defs[0]?.id || null);
  const [adding, setAdding] = useState(null);
  const [building, setBuilding] = useState(false);
  const def = defs.find((d) => d.id === openId) || defs[0];
  const list = def ? entries.filter((e) => e.logId === def.id).sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
  const fmtVal = (f, v) => f.type === "check" ? (v ? "✓" : "✗") : v === undefined || v === null ? "" : String(v);
  function addTemplate(t) { onSaveDefs([...defs, { ...t, id: `${t.id}_${uid().slice(-4)}`, template: t.id, firealarm: t.id === "firealarm" }]); }
  // Fire alarm rotation: next call point after the last one tested, wrapping at the highest number seen / set.
  const nextCallPoint = (d) => { const last = entries.filter((e) => e.logId === d.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]; const n = Number(String(last?.values?.callpoint || "").replace(/\D/g, "")) || 0; const max = Number(d.callPoints) || 0; return max ? (n % max) + 1 : n + 1; };
  function print() {
    const e = escapeHtml;
    openPrintReport(def.name, locationName, tableHtml(["Date", ...def.fields.map((f) => e(f.label)), "By"], list.map((x) => [fmtDate(x.date), ...def.fields.map((f) => e(fmtVal(f, x.values?.[f.key]))), e(x.by || "")])));
  }
  return (
    <div>
      {defs.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <EmptyState icon={ClipboardList} title="No logs yet" body="Add ready-made logs for routine site checks, or build your own with the columns you need." />
          {ACTIVE_CAN_EDIT && LOG_TEMPLATES.map((t) => <button key={t.id} onClick={() => addTemplate(t)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}><b style={{ fontSize: 13 }}>+ {t.name}</b><div style={{ fontSize: 11, color: "var(--faint)" }}>{t.fields.map((f) => f.label).join(" · ")}{t.everyDays ? ` · reminder every ${t.everyDays} days` : ""}</div></button>)}
          {ACTIVE_CAN_EDIT && <button onClick={() => setBuilding(true)} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: 10, padding: 9, fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>+ Build your own log</button>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {defs.map((d) => <ToggleButton key={d.id} active={def?.id === d.id} onClick={() => setOpenId(d.id)}>{d.name}</ToggleButton>)}
            {ACTIVE_CAN_EDIT && <ToggleButton active={false} onClick={() => setBuilding(true)}>+ Log</ToggleButton>}
          </div>
          {def && (() => {
            const last = list[0]; const age = last ? -daysUntil(last.date) : null; const due = def.everyDays && (!last || age > def.everyDays);
            return (
              <>
                <div style={{ fontSize: 12, color: due ? "var(--danger)" : "var(--muted)", fontWeight: due ? 700 : 500, marginBottom: 8 }}>{last ? `Last entry ${fmtDate(last.date)}${age ? ` (${age} days ago)` : " (today)"}` : "No entries yet"}{def.everyDays ? ` · due every ${def.everyDays} days` : ""}{def.firealarm ? ` · next call point: ${nextCallPoint(def)}` : ""}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setAdding({})} style={{ flex: 1 }}><Plus size={15} /> New entry</PrimaryButton>}
                  {list.length > 0 && <button onClick={print} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={14} color="#2B4562" /></button>}
                  {list.length > 0 && <ExportButton label="CSV" filename={`${def.name.replace(/[^a-z0-9]+/gi, "-")}.csv`} rows={[["Date", ...def.fields.map((f) => f.label), "By"], ...list.map((x) => [x.date, ...def.fields.map((f) => fmtVal(f, x.values?.[f.key])), x.by || ""])]} />}
                </div>
                {list.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 14 }}>Nothing logged yet.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {list.slice(0, 60).map((x) => (
                      <button key={x.id} onClick={() => ACTIVE_CAN_EDIT && setAdding(x)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmtDate(x.date)} <span style={{ color: "var(--faint)", fontWeight: 500 }}>· {x.by}</span></div>
                        <div style={{ fontSize: 11.8, color: "var(--text-2)" }}>{def.fields.filter((f) => x.values?.[f.key] !== undefined && x.values?.[f.key] !== "").map((f) => `${f.label}: ${fmtVal(f, x.values[f.key])}`).join(" · ")}</div>
                      </button>
                    ))}
                  </div>
                )}
                {ACTIVE_CAN_EDIT && <button onClick={() => { if (window.confirm(`Remove the "${def.name}" log? Its entries stay in backups.`)) { onSaveDefs(defs.filter((d) => d.id !== def.id)); setOpenId(null); } }} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>Remove this log</button>}
              </>
            );
          })()}
          {ACTIVE_CAN_EDIT && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>{LOG_TEMPLATES.filter((t) => !defs.some((d) => d.template === t.id)).map((t) => <button key={t.id} onClick={() => addTemplate(t)} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: 8, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>+ {t.name}</button>)}</div>}
        </>
      )}
      {adding && def && <LogEntryModal def={def} existing={adding.id ? adding : null} suggestCallPoint={def.firealarm ? nextCallPoint(def) : null} onClose={() => setAdding(null)} onSave={(x) => { onSave({ ...x, logId: def.id }); setAdding(null); }} onDelete={(id) => { onDelete(id); setAdding(null); }} onSetCallPoints={(n) => onSaveDefs(defs.map((d) => d.id === def.id ? { ...d, callPoints: n } : d))} />}
      {building && <LogBuilderModal onClose={() => setBuilding(false)} onSave={(d) => { onSaveDefs([...defs, d]); setOpenId(d.id); setBuilding(false); }} />}
    </div>
  );
}
function LogEntryModal({ def, existing, suggestCallPoint, onClose, onSave, onDelete, onSetCallPoints }) {
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState(existing?.values || (suggestCallPoint ? { callpoint: String(suggestCallPoint) } : {}));
  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={def.name} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {def.fields.map((f) => (
          f.type === "check" ? (
            <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}><input type="checkbox" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} style={{ margin: 0 }} /> {f.label}</label>
          ) : f.type === "select" ? (
            <Field key={f.key} label={f.label}><Select value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}><option value="">—</option>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
          ) : (
            <Field key={f.key} label={f.label}>
              <TextInput type={f.type === "number" || f.type === "callpoint" ? "number" : f.type === "date" ? "date" : "text"} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              {f.type === "callpoint" && <span style={{ fontSize: 11, color: "var(--muted)" }}>Suggested next in rotation: {suggestCallPoint}. Total call points on site: <input type="number" min="1" defaultValue={def.callPoints || ""} onBlur={(e) => e.target.value && onSetCallPoints(Number(e.target.value))} style={{ width: 52, fontSize: 11 }} /> (so the rotation wraps round)</span>}
            </Field>
          )
        ))}
        <PrimaryButton onClick={() => onSave({ id: existing?.id, date, values })}><CheckCircle2 size={15} /> Save entry</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete entry" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
function LogBuilderModal({ onClose, onSave }) {
  const [name, setName] = useState(""); const [everyDays, setEveryDays] = useState("");
  const [fields, setFields] = useState([{ label: "", type: "text", options: "" }]);
  return (
    <Modal title="Build a log" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Log name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Generator weekly run" /></Field>
        <Field label="Remind me if nothing logged for (days, optional)"><TextInput type="number" min="0" value={everyDays} onChange={(e) => setEveryDays(e.target.value)} placeholder="e.g. 7" /></Field>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Columns</div>
        {fields.map((f, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--card-hi)", borderRadius: 8, padding: 7 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput value={f.label} onChange={(e) => setFields((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Column name" style={{ flex: 1, minWidth: 0 }} />
              <select value={f.type} onChange={(e) => setFields((p) => p.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} style={{ ...inputStyle, width: 110, fontSize: 12 }}>
                <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="check">Tick box</option><option value="select">Choice</option>
              </select>
              {fields.length > 1 && <button onClick={() => setFields((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>}
            </div>
            {f.type === "select" && <TextInput value={f.options} onChange={(e) => setFields((p) => p.map((x, j) => j === i ? { ...x, options: e.target.value } : x))} placeholder="Choices, comma separated" style={{ fontSize: 12 }} />}
          </div>
        ))}
        <button onClick={() => setFields((p) => [...p, { label: "", type: "text", options: "" }])} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>+ Add column</button>
        <PrimaryButton onClick={() => { const fs = fields.filter((f) => f.label.trim()).map((f, i) => ({ key: `f${i}`, label: f.label.trim(), type: f.type, options: f.type === "select" ? f.options.split(",").map((x) => x.trim()).filter(Boolean) : undefined })); if (!name.trim() || !fs.length) return; onSave({ id: `log_${uid()}`, name: name.trim(), everyDays: Number(everyDays) || 0, fields: fs }); }}><CheckCircle2 size={15} /> Create log</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------- Asbestos register ---------- */
export function AsbestosView({ items, areas, locationName, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const sorted = [...items].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.risk] ?? 3) || String(a.location).localeCompare(String(b.location)));
  const overdue = items.filter((i) => i.nextInspection && daysUntil(i.nextInspection) < 0).length;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="Items on register" value={items.length} />
        <MetricBlock label="High risk" value={items.filter((i) => i.risk === "high" && i.action !== "Removed").length} tone={items.some((i) => i.risk === "high" && i.action !== "Removed") ? "danger" : "ok"} />
        <MetricBlock label="Re-inspection overdue" value={overdue} tone={overdue ? "danger" : "ok"} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Plus size={15} /> Add an item</PrimaryButton>}
        {items.length > 0 && <button onClick={() => openPrintReport("Asbestos register", locationName, buildAsbestosRegister(sorted, locationName))} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={14} color="#2B4562" /></button>}
        {items.length > 0 && <ExportButton label="CSV" filename="asbestos-register.csv" rows={[["Location", "Material", "Status", "Condition", "Risk", "Sample ref", "Last inspected", "Next inspection", "Action", "Notes"], ...sorted.map((i) => [i.location, i.material, i.status || "", i.condition || "", i.risk || "", i.sampleRef || "", i.lastInspection || "", i.nextInspection || "", i.action || "", i.notes || ""])]} />}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No asbestos items recorded" body="If your building was built before 2000, record known or presumed asbestos from your survey: where it is, its condition, risk and when it's next inspected. Show the register to contractors before they work." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((i) => {
            const n = i.nextInspection ? daysUntil(i.nextInspection) : null;
            const col = i.risk === "high" ? "var(--danger)" : i.risk === "medium" ? "var(--warn)" : "var(--ok)";
            return (
              <button key={i.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(i)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${col}`, borderRadius: 10, padding: "8px 10px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", opacity: i.action === "Removed" ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 650 }}>{i.location}</span><span style={{ fontSize: 11, fontWeight: 800, color: col, textTransform: "uppercase" }}>{i.risk || ""} risk</span></div>
                <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{i.material} · {i.status}{i.condition ? ` · ${i.condition}` : ""}{i.action ? ` · ${i.action}` : ""}</div>
                {n !== null && <div style={{ fontSize: 11.5, fontWeight: n <= 30 ? 700 : 500, color: n < 0 ? "var(--danger)" : n <= 30 ? "var(--warn)" : "var(--muted)" }}>Next inspection {fmtDate(i.nextInspection)}</div>}
              </button>
            );
          })}
        </div>
      )}
      {editing && <AsbestosModal existing={editing.id ? editing : null} areas={areas} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function AsbestosModal({ existing, areas, onClose, onSave, onDelete }) {
  const [location, setLocation] = useState(existing?.location || "");
  const [material, setMaterial] = useState(existing?.material || ASBESTOS_MATERIALS[0]);
  const [status, setStatus] = useState(existing?.status || "Presumed");
  const [condition, setCondition] = useState(existing?.condition || "Good");
  const [risk, setRisk] = useState(existing?.risk || "low");
  const [sampleRef, setSampleRef] = useState(existing?.sampleRef || "");
  const [lastInspection, setLastInspection] = useState(existing?.lastInspection || new Date().toISOString().slice(0, 10));
  const [nextInspection, setNextInspection] = useState(existing?.nextInspection || addMonths(new Date().toISOString().slice(0, 10), 12));
  const [action, setAction] = useState(existing?.action || "Manage in place");
  const [notes, setNotes] = useState(existing?.notes || "");
  const listId = useMemo(() => `asb-${uid()}`, []);
  return (
    <Modal title={existing ? "Asbestos item" : "Add an asbestos item"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Location"><TextInput list={listId} autoFocus value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Basement plant room, pipe runs" /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Material"><Select value={material} onChange={(e) => setMaterial(e.target.value)}>{ASBESTOS_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}>{["Presumed", "Strongly presumed", "Confirmed (sampled)", "No asbestos detected"].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Condition"><Select value={condition} onChange={(e) => setCondition(e.target.value)}>{["Good", "Minor damage", "Poor / damaged"].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
          <Field label="Sample ref"><TextInput value={sampleRef} onChange={(e) => setSampleRef(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{[["low", "Low risk"], ["medium", "Medium"], ["high", "High risk"]].map(([k, l]) => <ToggleButton key={k} active={risk === k} onClick={() => setRisk(k)}>{l}</ToggleButton>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Last inspected"><TextInput type="date" value={lastInspection} onChange={(e) => { setLastInspection(e.target.value); if (e.target.value) setNextInspection(addMonths(e.target.value, 12)); }} /></Field>
          <Field label="Next inspection"><TextInput type="date" value={nextInspection} onChange={(e) => setNextInspection(e.target.value)} /></Field>
        </div>
        <Field label="Action"><Select value={action} onChange={(e) => setAction(e.target.value)}>{["Manage in place", "Label & monitor", "Encapsulate / seal", "Remove", "Removed"].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <PrimaryButton onClick={() => location.trim() && onSave({ id: existing?.id, location: location.trim(), material, status, condition, risk, sampleRef: sampleRef.trim(), lastInspection: lastInspection || null, nextInspection: nextInspection || null, action, notes: notes.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this item" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
