// Site records (now spread across Operations, Assets, Compliance & Safety and Resources): meters, spares, keys, audits, incidents, permits to work, waste.
import { useState, useMemo } from "react";
import { Activity, BellRing, BookOpen, CalendarClock, Camera, Car, CheckCircle2, ChevronLeft, ClipboardCheck, ClipboardList, FileSignature, FileText, Flame, FlaskConical, Gauge, GraduationCap, Key, KeyRound, LayoutGrid, Leaf as LeafIcon, ListChecks, Mail, MapPin, Megaphone, Package, Pencil, Plus, Power, Printer, QrCode, Recycle, ShieldAlert, Siren, Star, Thermometer, Trash2, Upload, Wrench, ZapOff } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ConfirmDeleteButton, ConfirmTextDelete, EmptyState, ExportButton, Field, MetricBlock, Modal, PhotoStrip, PrimaryButton, Select, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { DEFAULT_CO2, INCIDENT_TYPES, INVESTIGATION_STEPS, METER_TYPES, MONTH_LABELS, PERMIT_PRECAUTIONS, PERMIT_TYPES, WASTE_STREAMS } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE } from "../lib/globals.js";
import { buildBlankAudit, buildKeyRegister, openPrintReport, printPermit, tableHtml } from "../lib/reports.js";
import { appBaseUrl, orgParam, compressImage, daysUntil, escapeHtml, fmtDate, gbp, meterStats, parseDelimited, qrImageUrl, scoreTone, toISO, uid } from "../lib/utils.js";
import { xlsxToText } from "../lib/excelTemplate.js";

export function MetersTab({ locationName = "", onImportReadings, meters, readings, suppliers, onSaveMeter, onArchiveMeter, onAddReading, onDeleteReading }) {
  const [editing, setEditing] = useState(null);
  const [readingFor, setReadingFor] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("en-GB", { maximumFractionDigits: 1 });
  // Year-to-date totals across all meters.
  const yr = String(new Date().getFullYear());
  const ytd = meters.reduce((acc, m) => {
    const st = meterStats(m, readings);
    const used = st.periods.filter((p) => p.to.startsWith(yr)).reduce((t, p) => t + p.used, 0);
    const factor = m.co2Factor != null ? Number(m.co2Factor) : DEFAULT_CO2[m.type] || 0;
    return { cost: acc.cost + (m.tariff ? used * Number(m.tariff) : 0), co2: acc.co2 + used * factor, priced: acc.priced || !!m.tariff };
  }, { cost: 0, co2: 0, priced: false });
  const csv = [["Meter", "Type", "Date", "Reading", "Unit", "Meter replaced", "Entered by"], ...readings.map((r) => { const m = meters.find((x) => x.id === r.meterId); return [m?.name || "", METER_TYPES[m?.type]?.label || "", r.date, r.value, m?.unit || "", r.reset ? "Yes" : "", r.by || ""]; })];
  if (meters.length === 0) {
    return (
      <>
        <EmptyState icon={Activity} title="No meters yet" body="Add your electricity, gas and water meters to log readings and track consumption month by month." actionLabel={ACTIVE_CAN_EDIT ? "Add a meter" : undefined} onAction={() => setEditing({})} />
        {editing && <MeterModal existing={editing.id ? editing : null} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(m) => { onSaveMeter(m); setEditing(null); }} />}
      </>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT ? <button onClick={() => setEditing({})} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Plus size={14} /> Add meter</button> : <span />}
        <div style={{ display: "flex", gap: 6 }}>
          {meters.length > 0 && <button onClick={() => { const e = escapeHtml; openPrintReport("Meter QR labels", locationName, `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">${meters.map((m) => `<div style="border:1.5px solid #1B2430;border-radius:10px;padding:10px;text-align:center;page-break-inside:avoid"><img src="${qrImageUrl(`${appBaseUrl()}?meter=${m.id}${orgParam()}`, 220)}" style="width:150px;height:150px"><div style="font-weight:800;font-size:13px;margin-top:4px">${e(m.name)}</div><div style="font-size:10.5px;color:#56616D">${e(m.serial ? `Serial ${m.serial}` : m.type || "")} · scan to submit a reading</div></div>`).join("")}</div>`); }} title="Print QR labels to stick on each meter" style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><QrCode size={13} /> QR labels</button>}
          {ACTIVE_CAN_EDIT && onImportReadings && <button onClick={() => setImportOpen(true)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Upload size={13} /> Import</button>}
          <ExportButton rows={csv} filename="meter-readings.csv" />
        </div>
        {importOpen && <ReadingsImportModal meters={meters} onClose={() => setImportOpen(false)} onImport={(list) => { onImportReadings(list); setImportOpen(false); }} />}
      </div>
      {(ytd.co2 > 0 || ytd.priced) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {ytd.priced && <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>Energy & water cost {yr}</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(ytd.cost)}</div></div>}
          <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "var(--ok)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><LeafIcon size={11} /> Carbon {yr}</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{ytd.co2 >= 1000 ? `${(ytd.co2 / 1000).toFixed(2)} t` : `${Math.round(ytd.co2)} kg`} CO₂e</div></div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meters.map((m) => {
          const st = meterStats(m, readings); const t = METER_TYPES[m.type] || METER_TYPES.other;
          const since = st.last ? -daysUntil(st.last.date) : null;
          const chart = Object.entries(st.monthly).sort().slice(-12).map(([k, v]) => ({ month: new Date(k + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" }), used: Math.round(v * 10) / 10 }));
          return (
            <div key={m.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${t.color}`, borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <button onClick={() => setOpenId(openId === m.id ? null : m.id)} style={{ flex: 1, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{t.label}{m.serial ? ` · #${m.serial}` : ""}{m.mpan ? ` · ${m.mpan}` : ""}</div>
                  {(() => { const d0 = new Date(); d0.setDate(1); d0.setMonth(d0.getMonth() - 1); const k = d0.toISOString().slice(0, 7); const kLy = `${Number(k.slice(0, 4)) - 1}${k.slice(4)}`; const a = st.monthly[k], b = st.monthly[kLy]; if (!a || !b) return null; const pct = Math.round(((a - b) / b) * 100); return <div style={{ fontSize: 11.5, fontWeight: 650, color: pct > 5 ? "var(--danger)" : pct < -5 ? "var(--ok)" : "var(--muted)" }}>{d0.toLocaleDateString("en-GB", { month: "long" })}: {Math.round(a).toLocaleString("en-GB")} {m.unit} — {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}% vs last year</div>; })()}
                </button>
                {ACTIVE_CAN_EDIT && <button onClick={() => setEditing(m)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Pencil size={14} color="#8A94A0" /></button>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                <MetricBlock label="Last reading" value={st.last ? `${fmt(st.last.value)}` : "—"} />
                <MetricBlock label={`Used last period`} value={st.lastP ? `${fmt(st.lastP.used)} ${m.unit}` : "—"} tone={st.spike ? "danger" : undefined} />
                <MetricBlock label="Avg per day" value={st.avgDaily != null ? `${fmt(st.avgDaily)} ${m.unit}` : "—"} />
              </div>
              {st.lastP && (m.tariff || (m.co2Factor ?? DEFAULT_CO2[m.type])) ? (
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6, fontWeight: 600 }}>
                  Last period: {m.tariff ? `${gbp(st.lastP.used * Number(m.tariff))} · ` : ""}{fmt(st.lastP.used * Number(m.co2Factor ?? DEFAULT_CO2[m.type] ?? 0))} kg CO₂e
                </div>
              ) : null}
              {Number(m.annualTarget) > 0 && (() => {
                const yrS = String(new Date().getFullYear()); const used = st.periods.filter((p) => p.to.startsWith(yrS)).reduce((t, p) => t + p.used, 0);
                const doy = Math.max(1, Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000)); const proj = (used / doy) * 365; const over = proj > Number(m.annualTarget) * 1.05;
                return used > 0 ? <div style={{ fontSize: 11.5, fontWeight: 650, marginTop: 6, color: over ? "var(--danger)" : "var(--ok)" }}>{fmt(used)} {m.unit} so far · on course for {fmt(proj)} vs target {fmt(m.annualTarget)} {over ? "— over" : "— on track"}</div> : null;
              })()}
              <div style={{ fontSize: 11, color: since != null && since > (Number(m.readEveryDays) || 31) ? "var(--warn)" : "var(--faint)", marginTop: 6 }}>
                {st.last ? `Read ${fmtDate(st.last.date)} (${since === 0 ? "today" : `${since} days ago`})` : "No readings yet"} · read every {Number(m.readEveryDays) || 31} days
                {(() => { const now = new Date(); const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); const k = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}`; const ly = `${lm.getFullYear() - 1}-${String(lm.getMonth() + 1).padStart(2, "0")}`; const a = st.monthly[k], b = st.monthly[ly]; if (a == null || !b) return null; const pct = Math.round(((a - b) / b) * 100); return <span style={{ color: pct > 5 ? "var(--danger)" : pct < -5 ? "var(--ok)" : "var(--muted)", fontWeight: 650 }}> · {lm.toLocaleDateString("en-GB", { month: "short" })} {fmt(a)} vs {fmt(b)} last year ({pct > 0 ? "+" : ""}{pct}%)</span>; })()}
                {st.spike && <span style={{ color: "var(--danger)", fontWeight: 700 }}> · Usage up {Math.round((st.lastDaily / st.avgDaily - 1) * 100)}% on average — check for leaks or plant left running</span>}
              </div>
              {openId === m.id && chart.length > 0 && (
                <div style={{ height: 150, marginTop: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `${fmt(v)} ${m.unit}`} />
                      <Bar dataKey="used" fill={t.color} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {openId === m.id && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  {[...st.rs].reverse().slice(0, 12).map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, background: "var(--card-hi)", borderRadius: 7, padding: "5px 8px" }}>
                      {r.viaQR && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)" }}>QR</span>}
                      {r.photo && <img src={r.photo} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover" }} />}
                      <span style={{ flex: 1 }}>{fmtDate(r.date)}{r.reset ? " · new meter" : ""}{r.by ? <span style={{ color: "var(--faint)" }}> · {r.by}</span> : null}</span>
                      <b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(r.value)}</b>
                      <ConfirmDeleteButton onConfirm={() => onDeleteReading(r.id)} size={12} />
                    </div>
                  ))}
                  {ACTIVE_CAN_EDIT && <button onClick={() => onArchiveMeter(m.id)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>Remove this meter</button>}
                </div>
              )}
              {ACTIVE_CAN_EDIT && <button onClick={() => setReadingFor(m)} style={{ width: "100%", marginTop: 10, background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Add reading</button>}
            </div>
          );
        })}
      </div>
      {editing && <MeterModal existing={editing.id ? editing : null} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(m) => { onSaveMeter(m); setEditing(null); }} />}
      {readingFor && <ReadingModal meter={readingFor} last={meterStats(readingFor, readings).last} onClose={() => setReadingFor(null)} onSave={(r) => { onAddReading(r); setReadingFor(null); }} />}
    </div>
  );
}

export function MeterModal({ existing, suppliers, onClose, onSave }) {
  const [name, setName] = useState(existing?.name || "");
  const [type, setType] = useState(existing?.type || "electricity");
  const [unit, setUnit] = useState(existing?.unit ?? METER_TYPES.electricity.unit);
  const [serial, setSerial] = useState(existing?.serial || "");
  const [mpan, setMpan] = useState(existing?.mpan || "");
  const [readEveryDays, setReadEveryDays] = useState(String(existing?.readEveryDays || 31));
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [annualTarget, setAnnualTarget] = useState(existing?.annualTarget ? String(existing.annualTarget) : "");
  const [tariff, setTariff] = useState(existing?.tariff != null ? String(existing.tariff) : "");
  const [co2, setCo2] = useState(existing?.co2Factor != null ? String(existing.co2Factor) : String(DEFAULT_CO2[existing?.type || "electricity"]));
  return (
    <Modal title={existing ? "Edit meter" : "Add a meter"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Meter name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main electricity incomer" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Type">
            <Select value={type} onChange={(e) => { setType(e.target.value); if (!existing) { setUnit(METER_TYPES[e.target.value].unit); setCo2(String(DEFAULT_CO2[e.target.value])); } }}>
              {Object.entries(METER_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Unit"><TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kWh" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Meter serial (optional)"><TextInput value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>
          <Field label="MPAN / MPRN (optional)"><TextInput value={mpan} onChange={(e) => setMpan(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Read every (days)"><TextInput type="number" min="1" value={readEveryDays} onChange={(e) => setReadEveryDays(e.target.value)} /></Field>
          <Field label="Energy supplier (optional)">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— None —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Yearly target (${unit || "units"})`}><TextInput type="number" min="0" value={annualTarget} onChange={(e) => setAnnualTarget(e.target.value)} placeholder="optional" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Price per ${unit || "unit"} (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" step="0.0001" min="0" value={tariff} onChange={(e) => setTariff(e.target.value)} placeholder="e.g. 0.245" /></Field>
          <Field label={`kg CO₂e per ${unit || "unit"}`}><TextInput type="number" step="0.001" min="0" value={co2} onChange={(e) => setCo2(e.target.value)} /></Field>
        </div>
        <span style={{ fontSize: 10.5, color: "var(--faint)", marginTop: -6 }}>Carbon defaults are approximate UK factors (electricity 0.207 kg/kWh, gas 2.04 kg/m³, water 0.34 kg/m³) — update to your supplier's or the latest government figures.</span>
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), type, unit: unit.trim(), serial: serial.trim(), mpan: mpan.trim(), readEveryDays: Number(readEveryDays) || 31, supplierId: supplierId || null, tariff: tariff === "" ? null : Number(tariff), co2Factor: co2 === "" ? null : Number(co2), annualTarget: annualTarget === "" ? null : Number(annualTarget) })}><CheckCircle2 size={15} /> Save meter</PrimaryButton>
      </div>
    </Modal>
  );
}

export function ReadingModal({ meter, last, onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [reset, setReset] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [err, setErr] = useState("");
  function submit() {
    const v = Number(value);
    if (value === "" || isNaN(v)) { setErr("Enter the number shown on the meter."); return; }
    if (last && !reset && v < Number(last.value)) { setErr(`That's lower than the last reading (${last.value}). If the meter was replaced, tick the box below.`); return; }
    onSave({ meterId: meter.id, date, value: v, reset: reset || undefined, photo: photos[0] || undefined });
  }
  return (
    <Modal title={`Reading — ${meter.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {last && <div style={{ fontSize: 12, color: "var(--muted)" }}>Last reading: <b>{last.value} {meter.unit}</b> on {fmtDate(last.date)}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={`Reading${meter.unit ? ` (${meter.unit})` : ""}`}><TextInput autoFocus type="number" inputMode="decimal" step="any" value={value} onChange={(e) => { setValue(e.target.value); setErr(""); }} /></Field>
        </div>
        {last && value !== "" && !isNaN(Number(value)) && !reset && Number(value) >= Number(last.value) && (
          <div style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>Used since last reading: {(Number(value) - Number(last.value)).toLocaleString("en-GB", { maximumFractionDigits: 1 })} {meter.unit}</div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
          <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} style={{ margin: 0 }} /> New / replaced meter (starts a fresh count)
        </label>
        <PhotoStrip photos={photos} onChange={setPhotos} max={1} label="Photo of the meter (optional, proof of reading)" />
        {err && <div style={{ fontSize: 12, color: "var(--danger)" }}>{err}</div>}
        <PrimaryButton onClick={submit}><CheckCircle2 size={15} /> Save reading</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Site tab: meters, spares and keys
--------------------------------------------------------- */
// Site sections, grouped so the page opens on a tidy overview instead of a long row of buttons.
export const SITE_GROUPS = [
  { key: "safety", label: "Safety & compliance", items: [
    ["incidents", "Incidents", Siren], ["permits", "Permits to work", Flame], ["actions", "Action tracker", ListChecks], ["drills", "Fire drills", BellRing],
    ["training", "Training", GraduationCap], ["water", "Water temperatures", Thermometer], ["asbestos", "Asbestos", ShieldAlert], ["coshh", "COSHH", FlaskConical],
    ["equipment", "Equipment inspections", ClipboardCheck], ["audits", "Audits", ClipboardList], ["isolations", "Isolation points", Power],
  ] },
  { key: "building", label: "Building & assets", items: [
    ["meters", "Meters & energy", Gauge], ["waste", "Waste & recycling", Recycle], ["spaces", "Spaces", LayoutGrid], ["floorplans", "Floor plans", MapPin],
    ["docs", "Documents", FileText], ["keydates", "Key dates", CalendarClock], ["shutdowns", "Planned shutdowns", ZapOff], ["logs", "Logs & checks", BookOpen], ["walkrounds", "Walk-rounds", Camera],
  ] },
  { key: "people", label: "Security, stores & people", items: [
    ["keys", "Keys & cards", KeyRound], ["carpark", "Car park", Car], ["spares", "Spare parts", Package], ["feedback", "Occupant feedback", Star],
  ] },
];
export function SiteTab({ shutdowns, badges = {}, isolations, carpark, floorplans, keydates, feedback, coshh, equipment, actions, spaces, walkrounds, asbestos, logs, docs, meters, spares, keys, audits, incidents, permits, waste, water, training, drills, openPermits = 0, openIncidents = 0, counts = {} }) {
  const [view, setView] = useState(() => { try { return sessionStorage.getItem("ppm:siteView") || ""; } catch (e) { return ""; } });
  const go = (v) => { setView(v); try { sessionStorage.setItem("ppm:siteView", v); } catch (e) { /* ignore */ } window.scrollTo?.({ top: 0 }); };
  const content = { shutdowns, meters, spares, keys, audits, incidents, permits, waste, water, training, drills, docs, logs, asbestos, actions, spaces, walkrounds, coshh, equipment, floorplans, keydates, feedback, isolations, carpark };
  const b = { ...badges, spares: badges.spares ?? (counts.lowStock ? { text: `${counts.lowStock} low`, tone: "warn" } : null), keys: badges.keys ?? (counts.keysOut ? { text: `${counts.keysOut} out` } : null), incidents: badges.incidents ?? (openIncidents ? { text: `${openIncidents} open`, tone: "warn" } : null), permits: badges.permits ?? (openPermits ? { text: `${openPermits} live` } : null) };
  const group = SITE_GROUPS.find((g) => g.items.some(([k]) => k === view));
  const item = group?.items.find(([k]) => k === view);
  const Badge2 = ({ x }) => x ? <span style={{ fontSize: 11, fontWeight: 750, color: x.tone === "danger" ? "var(--danger)" : x.tone === "warn" ? "var(--warn)" : "var(--accent)", background: x.tone === "danger" ? "var(--danger-soft)" : x.tone === "warn" ? "var(--warn-soft)" : "var(--accent-soft)", borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap" }}>{x.text}</span> : null;
  if (!item) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {SITE_GROUPS.map((g) => (
        <div key={g.key}>
          <div style={{ fontSize: 12, fontWeight: 750, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>{g.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {g.items.map(([k, label, I]) => (
              <button key={k} data-site={k} className="bcard" onClick={() => go(k)} style={{ padding: "12px 12px", gap: 6, cursor: "pointer", minHeight: 78, justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, width: "100%" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I size={16} color="var(--accent)" /></span>
                  <Badge2 x={b[k]} />
                </span>
                <span style={{ fontSize: 13.3, fontWeight: 700, lineHeight: 1.25, color: "var(--text)" }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minWidth: 0 }}>
        <button onClick={() => go("")} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 10px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}><ChevronLeft size={15} /> All sections</button>
        <div style={{ fontSize: 17, fontWeight: 750, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item[1]}</div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 10, WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}>
        {group.items.map(([k, label]) => (
          <button key={k} onClick={() => go(k)} style={{ flexShrink: 0, background: k === view ? "var(--accent)" : "var(--card)", color: k === view ? "var(--on-accent)" : "var(--text-2)", border: `1px solid ${k === view ? "transparent" : "var(--border)"}`, borderRadius: 16, padding: "6px 11px", fontSize: 12.3, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}{b[k] ? ` · ${b[k].text}` : ""}</button>
        ))}
      </div>
      <div style={{ minWidth: 0 }}>{content[view]}</div>
    </div>
  );
}

export function SparesView({ onRaisePO, onStockTake, spares, suppliers, devices, senderName, onSave, onAdjust, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null); // { spare, dir }
  const [taking, setTaking] = useState(false);
  const [q, setQ] = useState("");
  const low = (sp) => sp.minQty !== "" && sp.minQty != null && Number(sp.qty) <= Number(sp.minQty);
  const list = spares.filter((sp) => !q.trim() || [sp.name, sp.partNo, sp.store].filter(Boolean).some((v) => v.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (low(b) - low(a)) || a.name.localeCompare(b.name));
  const lowList = spares.filter(low);
  const value = spares.reduce((t, sp) => t + (Number(sp.qty) || 0) * (Number(sp.unitCost) || 0), 0);
  function reorderEmail() {
    const bySup = {};
    lowList.forEach((sp) => { (bySup[sp.supplierId || ""] = bySup[sp.supplierId || ""] || []).push(sp); });
    const [supId, items] = Object.entries(bySup)[0] || [];
    if (!items) return;
    const sup = suppliers.find((x) => x.id === supId);
    const lines = items.map((sp) => `- ${sp.name}${sp.partNo ? ` (part ${sp.partNo})` : ""}: please supply ${Math.max(1, (Number(sp.reorderQty) || Number(sp.minQty) * 2 || 1) - Number(sp.qty))}`);
    window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent("Spares order")}&body=${encodeURIComponent(`Hi,\n\nPlease could you quote / supply:\n\n${lines.join("\n")}\n\nKind regards,\n${senderName || ""}`)}`;
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spares…" style={{ flex: 1 }} />
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditing({})} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Plus size={14} /> Add</button>}
      </div>
      {spares.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--muted)" }}>{spares.length} items · stock value {gbp(value)}{lowList.length ? <b style={{ color: "var(--warn)" }}> · {lowList.length} low</b> : null}</span>
          {ACTIVE_CAN_EDIT && onStockTake && <button onClick={() => setTaking(true)} style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Stock take</button>}
          {lowList.length > 0 && ACTIVE_CAN_EDIT && onRaisePO && <button onClick={() => onRaisePO(lowList)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Raise PO</button>}
          {lowList.length > 0 && ACTIVE_CAN_EDIT && <button onClick={reorderEmail} style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Mail size={12} /> Reorder</button>}
          <ExportButton label="CSV" filename="spares.csv" rows={[["Item", "Part no.", "Qty", "Unit", "Reorder at", "Store", "Unit cost", "Supplier"], ...spares.map((sp) => [sp.name, sp.partNo || "", sp.qty, sp.unit || "", sp.minQty ?? "", sp.store || "", sp.unitCost || "", suppliers.find((x) => x.id === sp.supplierId)?.name || ""])]} />
        </div>
      )}
      {spares.length === 0 ? (
        <EmptyState icon={Package} title="No spares yet" body="Track filters, belts, lamps and other parts you keep on site, with a reorder level so you never run out." actionLabel={ACTIVE_CAN_EDIT ? "Add a spare part" : undefined} onAction={() => setEditing({})} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((sp) => (
            <div key={sp.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: low(sp) ? "3px solid #D97706" : "1px solid var(--border)", borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => ACTIVE_CAN_EDIT && setEditing(sp)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{sp.name}</div>
                <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{[sp.partNo && `#${sp.partNo}`, sp.store, sp.deviceIds?.length ? `for ${sp.deviceIds.map((id) => devices.find((d) => d.id === id)?.name).filter(Boolean).join(", ")}` : null].filter(Boolean).join(" · ") || "—"}</div>
                {low(sp) && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)" }}>Reorder — at or below {sp.minQty}</div>}
                {(() => { const since = Date.now() - 90 * 86400000; const used = (sp.log || []).filter((l) => l.delta < 0 && l.note !== "Stock take" && new Date(l.at).getTime() >= since).reduce((t, l) => t - l.delta, 0); if (!used) return null; const perWeek = used / 13; const weeks = Number(sp.qty) / perWeek; return <div style={{ fontSize: 11, color: weeks < 4 ? "var(--warn)" : "var(--faint)", fontWeight: weeks < 4 ? 700 : 500 }}>Using ~{perWeek < 1 ? perWeek.toFixed(1) : Math.round(perWeek)}/week · {Number(sp.qty) <= 0 ? "out of stock" : `lasts ~${weeks < 1 ? "under a week" : `${Math.round(weeks)} week${Math.round(weeks) === 1 ? "" : "s"}`}`}</div>; })()}
              </button>
              <div style={{ textAlign: "center", minWidth: 44 }}>
                <div style={{ fontSize: 18, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace", color: Number(sp.qty) <= 0 ? "var(--danger)" : "var(--text)" }}>{sp.qty}</div>
                <div style={{ fontSize: 10, color: "var(--faint)" }}>{sp.unit || "in stock"}</div>
              </div>
              {ACTIVE_CAN_EDIT && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => setAdjusting({ spare: sp, dir: 1 })} title="Add stock" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 7, width: 30, height: 26, fontWeight: 800, cursor: "pointer" }}>+</button>
                  <button onClick={() => setAdjusting({ spare: sp, dir: -1 })} title="Use stock" style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: 7, width: 30, height: 26, fontWeight: 800, cursor: "pointer" }}>−</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {taking && <StockTakeModal spares={spares} onClose={() => setTaking(false)} onSave={(c) => { onStockTake(c); setTaking(false); }} />}
      {editing && <SpareModal existing={editing.id ? editing : null} suppliers={suppliers} devices={devices} onClose={() => setEditing(null)} onSave={(sp) => { onSave(sp); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
      {adjusting && <AdjustStockModal spare={adjusting.spare} dir={adjusting.dir} devices={devices} onClose={() => setAdjusting(null)} onSave={(delta, note) => { onAdjust(adjusting.spare.id, delta, note); setAdjusting(null); }} />}
    </div>
  );
}

export function SpareModal({ existing, suppliers, devices, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || "");
  const [partNo, setPartNo] = useState(existing?.partNo || "");
  const [qty, setQty] = useState(existing?.qty != null ? String(existing.qty) : "0");
  const [unit, setUnit] = useState(existing?.unit || "");
  const [minQty, setMinQty] = useState(existing?.minQty != null ? String(existing.minQty) : "");
  const [reorderQty, setReorderQty] = useState(existing?.reorderQty != null ? String(existing.reorderQty) : "");
  const [store, setStore] = useState(existing?.store || "");
  const [unitCost, setUnitCost] = useState(existing?.unitCost != null ? String(existing.unitCost) : "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [deviceIds, setDeviceIds] = useState(existing?.deviceIds || []);
  return (
    <Modal title={existing ? "Edit spare" : "Add a spare part"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Item"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. G4 panel filter 592×592" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Part number"><TextInput value={partNo} onChange={(e) => setPartNo(e.target.value)} /></Field>
          <Field label="Stored in"><TextInput value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Plant room cage" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!existing && <Field label="Quantity now"><TextInput type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>}
          <Field label="Unit"><TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. each, box" /></Field>
          <Field label="Reorder at"><TextInput type="number" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} placeholder="e.g. 4" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Order up to (optional)"><TextInput type="number" min="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} placeholder="e.g. 12" /></Field>
          <Field label={`Unit cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></Field>
        </div>
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {devices.length > 0 && (
          <Field label="Used on (optional)">
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxHeight: 120, overflowY: "auto" }}>
              {devices.map((d) => <ToggleButton key={d.id} active={deviceIds.includes(d.id)} onClick={() => setDeviceIds((p) => p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id])}>{d.name}</ToggleButton>)}
            </div>
          </Field>
        )}
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), partNo: partNo.trim(), qty: existing ? existing.qty : Number(qty) || 0, unit: unit.trim(), minQty: minQty === "" ? null : Number(minQty), reorderQty: reorderQty === "" ? null : Number(reorderQty), store: store.trim(), unitCost: unitCost === "" ? null : Number(unitCost), supplierId: supplierId || null, deviceIds })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this spare" onConfirm={() => onDelete(existing.id)} />}
        {existing?.log?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Stock history</div>
            {existing.log.slice(0, 15).map((l, i) => (
              <div key={i} style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", gap: 6 }}>
                <b style={{ color: l.delta < 0 ? "var(--danger)" : "var(--ok)", minWidth: 34 }}>{l.delta > 0 ? "+" : ""}{l.delta}</b>
                <span style={{ flex: 1 }}>{l.note || ""}</span>
                <span>{l.by} · {fmtDate(l.at.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AdjustStockModal({ spare, dir, devices, onClose, onSave }) {
  const [n, setN] = useState("1");
  const [note, setNote] = useState("");
  const listId = useMemo(() => `adj-${uid()}`, []);
  return (
    <Modal title={`${dir > 0 ? "Add stock" : "Use stock"} — ${spare.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>In stock now: <b>{spare.qty} {spare.unit || ""}</b></div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="How many"><TextInput autoFocus type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Field label={dir > 0 ? "Note (e.g. delivery ref)" : "Used on"}>
            <TextInput list={listId} value={note} onChange={(e) => setNote(e.target.value)} placeholder={dir > 0 ? "e.g. Delivery DN-4412" : "e.g. AHU 3"} />
            <datalist id={listId}>{devices.map((d) => <option key={d.id} value={d.name} />)}</datalist>
          </Field>
        </div>
        <PrimaryButton onClick={() => Number(n) > 0 && onSave(dir * Number(n), note.trim())}>{dir > 0 ? "Add to stock" : "Take from stock"}</PrimaryButton>
      </div>
    </Modal>
  );
}

export function KeysView({ onAudit, onLost, locationName = "", keys, onSave, onIssue, onReturn, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [issuing, setIssuing] = useState(null);
  const [filter, setFilter] = useState("all");
  const list = keys.filter((k) => filter === "all" || (filter === "out" ? !!k.holder : !k.holder)).sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <ToggleButton active={filter === "all"} onClick={() => setFilter("all")}>All ({keys.length})</ToggleButton>
        <ToggleButton active={filter === "out"} onClick={() => setFilter("out")}>Issued ({keys.filter((k) => k.holder).length})</ToggleButton>
        <ToggleButton active={filter === "in"} onClick={() => setFilter("in")}>In</ToggleButton>
        {keys.length > 0 && ACTIVE_CAN_EDIT && onAudit && <button onClick={() => setAuditing(true)} title="Key audit" style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>Audit</button>}
        {keys.length > 0 && <button onClick={() => { const e = escapeHtml; openPrintReport("Key tags", locationName, `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${keys.map((k) => `<div style="border:1.5px solid #1B2430;border-radius:20px 6px 6px 20px;padding:8px 10px;page-break-inside:avoid"><div style="font-weight:800;font-size:13px">${e(k.label)}</div><div style="font-family:monospace;font-size:12px">${e(k.number || "")}</div><div style="font-size:10px;color:#56616D">${e(k.opens || "")}</div></div>`).join("")}</div><div class="muted">Cut out and fit to key-ring tags. Don't write the full address on tags.</div>`); }} title="Print key tags" style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Tags</button>}
        {keys.length > 0 && <button onClick={() => openPrintReport("Key & access card register", locationName, buildKeyRegister(keys))} title="Print key register" style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex" }}><Printer size={14} /></button>}
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditing({})} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Plus size={14} /></button>}
      </div>
      {keys.length === 0 ? (
        <EmptyState icon={Key} title="No keys or access cards yet" body="Keep track of plant room keys, riser keys and access cards — who has them and when they're due back." actionLabel={ACTIVE_CAN_EDIT ? "Add a key" : undefined} onAction={() => setEditing({})} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((k) => {
            const late = k.holder && k.dueBack && daysUntil(k.dueBack) < 0;
            return (
              <div key={k.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${late ? "#C53030" : k.holder ? "#D97706" : "#2F855A"}`, borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(k)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{k.label}{k.number ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--faint)", fontWeight: 600 }}> #{k.number}</span> : null}</div>
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{[k.type === "card" ? "Access card" : k.type === "fob" ? "Fob" : "Key", k.opens && `opens ${k.opens}`, k.kept && `kept in ${k.kept}`].filter(Boolean).join(" · ")}</div>
                  {k.lost ? <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--danger)" }}>LOST {k.lostAt ? fmtDate(k.lostAt.slice(0, 10)) : ""}{k.lostNote ? ` — ${k.lostNote}` : ""}</div> : null}
                  {k.holder ? (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: late ? "var(--danger)" : "var(--warn)" }}>With {k.holder}{k.holderCompany ? ` (${k.holderCompany})` : ""} since {fmtDate(k.issuedAt?.slice(0, 10))}{k.dueBack ? ` · ${late ? "was due" : "due"} back ${fmtDate(k.dueBack)}` : ""}</div>
                  ) : <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ok)" }}>In</div>}
                </button>
                {k.holder && <button onClick={() => openPrintReport("Key holder agreement", locationName, `${tableHtml(["", ""], [["Key / card", `<b>${escapeHtml(k.label)}</b>${k.number ? ` #${escapeHtml(k.number)}` : ""}`], ["Opens", escapeHtml(k.opens || "")], ["Issued to", escapeHtml(k.holder)], ["Company", escapeHtml(k.holderCompany || "")], ["Issued", k.issuedAt ? fmtDate(k.issuedAt.slice(0, 10)) : ""], ["Return by", k.dueBack ? fmtDate(k.dueBack) : "On request / end of contract"]])}<h2>Agreement</h2><ol><li>I will keep this key / card safe and not copy, lend or give it to anyone else.</li><li>I will report its loss to the facilities team immediately.</li><li>I will return it by the date above, or when asked, or when I leave.</li><li>I understand I may be charged for replacement keys or lock changes if it is lost through carelessness.</li></ol><table style="margin-top:30px"><tr><td>Signed (holder) ______________________</td><td>Date __________</td></tr><tr><td style="padding-top:24px">Issued by ______________________</td><td style="padding-top:24px">Date __________</td></tr></table>`)} title="Print holder agreement" style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "7px 8px", cursor: "pointer", display: "flex" }}><FileSignature size={14} color="#2B4562" /></button>}
                {ACTIVE_CAN_EDIT && (k.holder ? (<>
                  <button onClick={() => { const note = window.prompt(`Mark "${k.label}" as lost? Add a note (who lost it / when):`, k.holder ? `Lost by ${k.holder}` : ""); if (note !== null) onLost?.(k.id, note); }} title="Mark lost" style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "none", borderRadius: 8, padding: "7px 8px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Lost</button>
                  <button onClick={() => onReturn(k.id)} style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Returned</button></>
                ) : (
                  <button onClick={() => setIssuing(k)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Issue</button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {auditing && <KeyAuditModal keys={keys} onClose={() => setAuditing(false)} onSave={(r) => { onAudit(r); setAuditing(false); }} />}
      {editing && <KeyModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(k) => { onSave(k); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
      {issuing && <IssueKeyModal k={issuing} onClose={() => setIssuing(null)} onSave={(h, c, d) => { onIssue(issuing.id, h, c, d); setIssuing(null); }} />}
    </div>
  );
}

export function KeyModal({ existing, onClose, onSave, onDelete }) {
  const [label, setLabel] = useState(existing?.label || "");
  const [type, setType] = useState(existing?.type || "key");
  const [number, setNumber] = useState(existing?.number || "");
  const [opens, setOpens] = useState(existing?.opens || "");
  const [kept, setKept] = useState(existing?.kept || "");
  return (
    <Modal title={existing ? "Edit key" : "Add a key or card"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["key", "Key"], ["card", "Access card"], ["fob", "Fob"]].map(([k, l]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{l}</ToggleButton>)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Name"><TextInput autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Roof plant room" /></Field>
          <Field label="Number / tag"><TextInput value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. K14" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Opens"><TextInput value={opens} onChange={(e) => setOpens(e.target.value)} placeholder="e.g. Riser cupboards L1–L4" /></Field>
          <Field label="Normally kept in"><TextInput value={kept} onChange={(e) => setKept(e.target.value)} placeholder="e.g. Reception key safe" /></Field>
        </div>
        <PrimaryButton onClick={() => label.trim() && onSave({ id: existing?.id, label: label.trim(), type, number: number.trim(), opens: opens.trim(), kept: kept.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this key" onConfirm={() => onDelete(existing.id)} />}
        {existing?.log?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>History</div>
            {existing.log.slice(0, 20).map((l, i) => <div key={i} style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtDate(l.at.slice(0, 10))} · {l.action === "issued" ? "Issued to" : "Returned by"} {l.holder}{l.holderCompany ? ` (${l.holderCompany})` : ""} · {l.by}</div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function IssueKeyModal({ k, onClose, onSave }) {
  const [holder, setHolder] = useState("");
  const [company, setCompany] = useState("");
  const [dueBack, setDueBack] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Modal title={`Issue — ${k.label}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Given to"><TextInput autoFocus value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Name" /></Field>
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="optional" /></Field>
        </div>
        <Field label="Due back"><TextInput type="date" value={dueBack} onChange={(e) => setDueBack(e.target.value)} /></Field>
        <PrimaryButton onClick={() => holder.trim() && onSave(holder.trim(), company.trim(), dueBack || null)}><Key size={15} /> Issue key</PrimaryButton>
      </div>
    </Modal>
  );
}

export function AuditsView({ onAddAction, audits, templates, suppliers, areas, locationName, senderName, onSave, onDelete, onSaveTemplates }) {
  const [editing, setEditing] = useState(null);
  const [editTemplates, setEditTemplates] = useState(false);
  const sorted = [...audits].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const byTemplate = {};
  sorted.forEach((a) => { (byTemplate[a.templateName] = byTemplate[a.templateName] || []).push(a); });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><ClipboardCheck size={15} /> New audit</PrimaryButton>}
        {templates.length > 0 && <select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) openPrintReport(`${t.name} — blank form`, locationName, buildBlankAudit(t, locationName)); }} title="Print a blank form" style={{ ...inputStyle, width: 120, fontSize: 12 }}><option value="">Blank form…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditTemplates(true)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Templates</button>}
      </div>
      {Object.keys(byTemplate).length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, overflowX: "auto" }}>
          {Object.entries(byTemplate).map(([name, list]) => {
            const last6 = list.slice(0, 6); const avg = Math.round(last6.reduce((t, a) => t + a.score, 0) / last6.length);
            const [fg] = scoreTone(avg);
            return (
              <div key={name} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 11px", minWidth: 140 }}>
                <div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 650 }}>{name}</div>
                <div style={{ fontSize: 18, fontWeight: 750, color: fg, fontFamily: "'IBM Plex Mono', monospace" }}>{avg}%</div>
                <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 20, marginTop: 3 }}>
                  {[...last6].reverse().map((a) => <div key={a.id} title={`${fmtDate(a.date)} ${a.score}%`} style={{ width: 8, height: Math.max(3, a.score / 5), background: scoreTone(a.score)[0], borderRadius: 2 }} />)}
                </div>
                <div style={{ fontSize: 10, color: "var(--faint)" }}>avg of last {last6.length}</div>
              </div>
            );
          })}
        </div>
      )}
      {sorted.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No audits yet" body="Score cleaning, washrooms or a site walk-round item by item. Results build a trend per supplier you can share with them." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((a) => {
            const [fg, bg] = scoreTone(a.score);
            return (
              <button key={a.id} onClick={() => setEditing(a)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.templateName}{a.area ? ` — ${a.area}` : ""}</div>
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{fmtDate(a.date)} · {a.by || ""}{a.supplierId ? ` · ${suppliers.find((s) => s.id === a.supplierId)?.name || ""}` : ""}{a.items.filter((i) => i.score !== null && i.score <= 2).length ? ` · ${a.items.filter((i) => i.score !== null && i.score <= 2).length} poor` : ""}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: fg, background: bg, borderRadius: 10, padding: "4px 10px", fontFamily: "'IBM Plex Mono', monospace" }}>{a.score}%</span>
              </button>
            );
          })}
        </div>
      )}
      {editing && <AuditModal onAddAction={onAddAction} existing={editing.id ? editing : null} templates={templates} suppliers={suppliers} areas={areas} locationName={locationName} senderName={senderName} onClose={() => setEditing(null)} onSave={(a) => { onSave(a); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
      {editTemplates && <AuditTemplatesModal templates={templates} onClose={() => setEditTemplates(false)} onSave={(t) => { onSaveTemplates(t); setEditTemplates(false); }} />}
    </div>
  );
}

export function AuditModal({ onAddAction, existing, templates, suppliers, areas, locationName, senderName, onClose, onSave, onDelete }) {
  const [templateId, setTemplateId] = useState(existing?.templateId || templates[0]?.id || "");
  const tpl = templates.find((t) => t.id === templateId);
  const [items, setItems] = useState(existing?.items || (tpl?.items || []).map((item) => ({ item, score: null, note: "" })));
  const [area, setArea] = useState(existing?.area || "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(existing?.supplierId || (templateId === "cleaning" ? suppliers.find((s) => s.category === "cleaning")?.id || "" : ""));
  const [notes, setNotes] = useState(existing?.notes || "");
  const listId = useMemo(() => `aud-${uid()}`, []);
  function pickTemplate(id) { setTemplateId(id); const t = templates.find((x) => x.id === id); setItems((t?.items || []).map((item) => ({ item, score: null, note: "" }))); if (id === "cleaning" && !supplierId) setSupplierId(suppliers.find((s) => s.category === "cleaning")?.id || ""); }
  const scored = items.filter((i) => i.score !== null);
  const score = scored.length ? Math.round((scored.reduce((t, i) => t + i.score, 0) / (scored.length * 5)) * 100) : 0;
  const payload = () => ({ id: existing?.id, templateId, templateName: tpl?.name || existing?.templateName || "Audit", area: area.trim(), date, supplierId: supplierId || null, items, notes: notes.trim(), score });
  function email() {
    const sup = suppliers.find((s) => s.id === supplierId);
    const poor = items.filter((i) => i.score !== null && i.score <= 2);
    const body = `Hi${sup?.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\n${tpl?.name || "Audit"} at ${locationName}${area ? ` — ${area}` : ""} on ${fmtDate(date)}: ${score}%.\n\n${items.map((i) => `${i.item}: ${i.score === null ? "N/A" : `${i.score}/5`}${i.note ? ` — ${i.note}` : ""}`).join("\n")}\n\n${poor.length ? `Please address the ${poor.length} item${poor.length === 1 ? "" : "s"} scored 2 or below and confirm when done.\n\n` : ""}${notes ? `Notes: ${notes}\n\n` : ""}Kind regards,\n${senderName || ""}`;
    window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent(`${tpl?.name || "Audit"} result — ${score}% — ${fmtDate(date)}`)}&body=${encodeURIComponent(body)}`;
  }
  return (
    <Modal title={existing ? "Audit" : "New audit"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!existing && (
          <Field label="Audit type">
            <Select value={templateId} onChange={(e) => pickTemplate(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          </Field>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Area"><TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Level 2" /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Supplier being audited (optional)">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Score each item 0 (very poor) to 5 (excellent), or N/A.</div>
        {items.map((it, i) => (
          <div key={i} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "8px 9px" }}>
            <div style={{ fontSize: 12.8, fontWeight: 650, marginBottom: 5 }}>{it.item}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2, 3, 4, 5].map((n) => {
                const on = it.score === n; const [fg, bg] = scoreTone(n * 20);
                return <button key={n} onClick={() => setItems((p) => p.map((x, j) => j === i ? { ...x, score: n } : x))} style={{ flex: 1, background: on ? fg : "var(--card)", color: on ? "#fff" : "var(--muted)", border: `1px solid ${on ? fg : "#D7DCE1"}`, borderRadius: 7, padding: "6px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>;
              })}
              <button onClick={() => setItems((p) => p.map((x, j) => j === i ? { ...x, score: null } : x))} style={{ flex: 1.3, background: it.score === null ? "#5B6672" : "var(--card)", color: it.score === null ? "#fff" : "var(--muted)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>N/A</button>
            </div>
            {it.score !== null && it.score <= 2 && <TextInput value={it.note} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="What's wrong?" style={{ width: "100%", marginTop: 6, fontSize: 12.5 }} />}
            {it.score !== null && it.score <= 2 && onAddAction && ACTIVE_CAN_EDIT && <button type="button" onClick={() => onAddAction({ source: "Site audit", sourceRef: `${templates.find((t) => t.id === templateId)?.name || "Audit"} ${fmtDate(date)}`, finding: `${area ? `${area}: ` : ""}${it.item}${it.note ? ` — ${it.note}` : ""}`, action: "", priority: it.score <= 1 ? "high" : "medium" })} style={{ background: "none", border: "none", padding: 0, marginTop: 4, color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>+ Add to action tracker</button>}
          </div>
        ))}
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", color: scoreTone(score)[0] }}>Score: {scored.length ? `${score}%` : "—"} <span style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600 }}>({scored.length} of {items.length} scored)</span></div>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => scored.length && onSave(payload())}><CheckCircle2 size={15} /> Save audit</PrimaryButton>}
        {existing && <button onClick={email} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Mail size={14} /> Email result to supplier</button>}
        {existing && <ConfirmTextDelete label="Delete this audit" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

export function AuditTemplatesModal({ templates, onClose, onSave }) {
  // everyDays: optional reminder frequency for each audit type
  const [list, setList] = useState(templates.map((t) => ({ ...t, text: t.items.join("\n") })));
  return (
    <Modal title="Audit templates" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>One item per line. Changes apply to new audits only.</div>
        {list.map((t, i) => (
          <div key={t.id} style={{ background: "var(--card-hi)", borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput value={t.name} onChange={(e) => setList((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1, fontWeight: 700 }} />
              <TextInput type="number" min="0" value={t.everyDays || ""} onChange={(e) => setList((p) => p.map((x, j) => j === i ? { ...x, everyDays: Number(e.target.value) || 0 } : x))} placeholder="every … days" title="Remind me if not done for this many days" style={{ width: 96, fontSize: 12 }} />
              {list.length > 1 && <button onClick={() => setList((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color="#C0C6CC" /></button>}
            </div>
            <TextArea value={t.text} onChange={(e) => setList((p) => p.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} style={{ minHeight: 90, fontSize: 12.5 }} />
          </div>
        ))}
        <button onClick={() => setList((p) => [...p, { id: `t_${uid()}`, name: "New audit", text: "" }])} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: 9, padding: 9, fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>+ Add a template</button>
        <PrimaryButton onClick={() => onSave(list.map(({ text, ...t }) => ({ ...t, items: text.split("\n").map((x) => x.trim()).filter(Boolean) })).filter((t) => t.items.length))}><CheckCircle2 size={15} /> Save templates</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Incident & near-miss log
--------------------------------------------------------- */
export function IncidentsView({ onAddAction, onShareLesson, onRaiseWork, incidents, areas, locationName, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("open");
  const list = incidents.filter((i) => filter === "all" || (filter === "open" ? i.status !== "closed" : i.status === "closed")).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const yr = String(new Date().getFullYear());
  const thisYear = incidents.filter((i) => String(i.date).startsWith(yr));
  const csv = [["Date", "Time", "Type", "Area", "Description", "Person involved", "Root cause", "Action taken", "RIDDOR", "RIDDOR reported", "Insurance claim", "Claim status", "Claim amount", "Status", "Reported by"], ...incidents.map((i) => [i.date, i.time || "", INCIDENT_TYPES[i.type] || "", i.area || "", i.description || "", i.person || "", i.rootCause || "", i.actions || "", i.riddor ? "Yes" : "No", i.riddorReported ? "Yes" : "", i.claimRef || "", i.claimStatus || "", i.claimAmount ?? "", i.status || "open", i.reportedBy || ""])];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <ToggleButton active={filter === "open"} onClick={() => setFilter("open")}>Open ({incidents.filter((i) => i.status !== "closed").length})</ToggleButton>
        <ToggleButton active={filter === "closed"} onClick={() => setFilter("closed")}>Closed</ToggleButton>
        <ToggleButton active={filter === "all"} onClick={() => setFilter("all")}>All</ToggleButton>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Siren size={15} /> Log incident / near miss</PrimaryButton>}
        {incidents.length > 0 && <ExportButton label="CSV" filename="incident-log.csv" rows={csv} />}
      </div>
      {thisYear.length > 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>{yr}: {Object.entries(INCIDENT_TYPES).map(([k, v]) => [v, thisYear.filter((i) => i.type === k).length]).filter(([, n]) => n).map(([v, n]) => `${n} ${v.toLowerCase()}`).join(" · ")}</div>}
      {list.length === 0 ? (
        <EmptyState icon={Siren} title={filter === "open" ? "No open incidents" : "Nothing here"} body="Record accidents, near misses, property damage, spills and security issues — with actions taken and a RIDDOR reminder where needed." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((i) => (
            <button key={i.id} onClick={() => setEditing(i)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${i.type === "injury" ? "#C53030" : i.type === "near_miss" ? "#D97706" : "#2B4562"}`, borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{INCIDENT_TYPES[i.type]}{i.area ? ` — ${i.area}` : ""}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: i.status === "closed" ? "var(--ok)" : "var(--warn)" }}>{i.status === "closed" ? "Closed" : "Open"}</span>
              </div>
              <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{fmtDate(i.date)}{i.time ? ` ${i.time}` : ""} · {i.reportedBy || ""}{i.riddor ? <b style={{ color: i.riddorReported ? "var(--ok)" : "var(--danger)" }}> · RIDDOR {i.riddorReported ? "reported" : "to report"}</b> : null}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.description}</div>
            </button>
          ))}
        </div>
      )}
      {editing && <IncidentModal onAddAction={onAddAction} onShareLesson={onShareLesson} onRaiseWork={onRaiseWork ? (inc) => { setEditing(null); onRaiseWork(inc); } : null} existing={editing.id ? editing : null} areas={areas} locationName={locationName} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}

export function IncidentModal({ onAddAction, onShareLesson, onRaiseWork, existing, areas, locationName, onClose, onSave, onDelete }) {
  const [type, setType] = useState(existing?.type || "near_miss");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(existing?.time || new Date().toTimeString().slice(0, 5));
  const [area, setArea] = useState(existing?.area || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [person, setPerson] = useState(existing?.person || "");
  const [actions, setActions] = useState(existing?.actions || "");
  const [riddor, setRiddor] = useState(!!existing?.riddor);
  const [riddorReported, setRiddorReported] = useState(!!existing?.riddorReported);
  const [status, setStatus] = useState(existing?.status || "open");
  const [rootCause, setRootCause] = useState(existing?.rootCause || "");
  const [investigation, setInvestigation] = useState(existing?.investigation || {});
  const [witnesses, setWitnesses] = useState(existing?.witnesses || "");
  const [claimRef, setClaimRef] = useState(existing?.claimRef || "");
  const [claimStatus, setClaimStatus] = useState(existing?.claimStatus || "");
  const [incPhotos, setIncPhotos] = useState(existing?.photos || []);
  const [claimAmount, setClaimAmount] = useState(existing?.claimAmount != null ? String(existing.claimAmount) : "");
  const listId = useMemo(() => `inc-${uid()}`, []);
  function print() {
    const e = escapeHtml;
    openPrintReport(`Incident report — ${INCIDENT_TYPES[type]}`, `${locationName} · ${fmtDate(date)} ${time}`, tableHtml(["Field", "Detail"], [["Type", INCIDENT_TYPES[type]], ["Date & time", `${fmtDate(date)} ${time}`], ["Area", area], ["What happened", description], ["Person involved", person], ["Action taken / to prevent recurrence", actions], ["RIDDOR reportable", riddor ? (riddorReported ? "Yes — reported" : "Yes — NOT yet reported") : "No"], ["Status", status], ["Reported by", existing?.reportedBy || ""]].map(([a, b]) => [e(a), e(b || "").replace(/\n/g, "<br>")])));
  }
  return (
    <Modal title={existing ? "Incident" : "Log an incident"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Object.entries(INCIDENT_TYPES).map(([k, v]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{v}</ToggleButton>)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Where"><TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Loading bay" /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
        <Field label="What happened"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the incident and any immediate cause" /></Field>
        {type === "injury" && <Field label="Person involved (name / company)"><TextInput value={person} onChange={(e) => setPerson(e.target.value)} /></Field>}
        <PhotoStrip photos={incPhotos} onChange={ACTIVE_CAN_EDIT ? setIncPhotos : null} label="Photos" />
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Investigation — {INVESTIGATION_STEPS.filter((s) => investigation[s]).length}/{INVESTIGATION_STEPS.length} done</div>
          {INVESTIGATION_STEPS.map((st) => (
            <label key={st} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}>
              <input type="checkbox" checked={!!investigation[st]} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => setInvestigation((p) => { const n = { ...p }; if (e.target.checked) n[st] = new Date().toISOString().slice(0, 10); else delete n[st]; return n; })} style={{ margin: 0 }} />
              <span style={{ flex: 1 }}>{st}</span>{investigation[st] && <span style={{ fontSize: 10.5, color: "var(--faint)" }}>{fmtDate(investigation[st])}</span>}
            </label>
          ))}
          <TextInput value={witnesses} onChange={(e) => setWitnesses(e.target.value)} placeholder="Witness names & contact" style={{ fontSize: 12.5 }} />
        </div>
        <Field label="Root cause (optional)">
          <Select value={rootCause} onChange={(e) => setRootCause(e.target.value)}>
            <option value="">— Not yet known —</option>
            {["Equipment / building defect", "Housekeeping (spill, obstruction)", "Procedure not followed", "No / poor procedure", "Training / competence", "Contractor", "Weather / external", "Other"].map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Action taken / to prevent it happening again"><TextArea value={actions} onChange={(e) => setActions(e.target.value)} /></Field>
        {(type === "property" || type === "injury" || claimRef) && (
          <div style={{ background: "var(--card-hi)", borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Insurance claim (optional)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="Claim ref"><TextInput value={claimRef} onChange={(e) => setClaimRef(e.target.value)} /></Field>
              <Field label={`Amount (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} /></Field>
            </div>
            <Select value={claimStatus} onChange={(e) => setClaimStatus(e.target.value)}>
              <option value="">— Claim status —</option>
              {["Notified to insurer", "Loss adjuster appointed", "Accepted", "Settled", "Declined", "Withdrawn"].map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
        )}
        {existing && onAddAction && ACTIVE_CAN_EDIT && (
          <button type="button" onClick={() => onAddAction({ source: "Incident", sourceRef: `${INCIDENT_TYPES[type]} ${fmtDate(date)}`, finding: `${area ? `${area}: ` : ""}${description}`, action: "", priority: type === "injury" || riddor ? "high" : "medium" })} style={{ background: "var(--accent-soft)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><ListChecks size={14} /> Add a follow-up action to the tracker</button>
        )}
        {existing && onShareLesson && ACTIVE_CAN_EDIT && actions.trim() && (
          <button type="button" onClick={() => { onShareLesson(`Safety lesson (${INCIDENT_TYPES[type].toLowerCase()}${area ? `, ${area}` : ""}): ${actions.trim()}`); onClose(); }} style={{ background: "var(--warn-soft)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--warn)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Megaphone size={14} /> Share the lesson on the team noticeboard</button>
        )}
        {existing && onRaiseWork && ACTIVE_CAN_EDIT && (
          existing.workId ? <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 650 }}>✓ Work request raised for this incident</div>
          : <button type="button" onClick={() => onRaiseWork(existing)} style={{ background: "var(--accent-soft)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Wrench size={14} /> Raise a work request to fix this</button>
        )}
        {(type === "injury" || type === "environmental" || riddor) && (
          <div style={{ background: "var(--warn-soft)", borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, fontWeight: 650, cursor: "pointer" }}><input type="checkbox" checked={riddor} onChange={(e) => setRiddor(e.target.checked)} style={{ margin: 0 }} /> RIDDOR reportable</label>
            {riddor && <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, fontWeight: 650, cursor: "pointer" }}><input type="checkbox" checked={riddorReported} onChange={(e) => setRiddorReported(e.target.checked)} style={{ margin: 0 }} /> Reported to the HSE</label>}
            <span style={{ fontSize: 10.8, color: "var(--warn)" }}>Examples: specified injuries, over-7-day incapacitation, dangerous occurrences. Check the HSE RIDDOR guidance if unsure.</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={status === "open"} onClick={() => setStatus("open")}>Open</ToggleButton>
          <ToggleButton active={status === "closed"} onClick={() => setStatus("closed")}>Closed</ToggleButton>
        </div>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => description.trim() && onSave({ id: existing?.id, type, date, time, area: area.trim(), description: description.trim(), person: person.trim(), actions: actions.trim(), riddor, riddorReported, status, rootCause, investigation, witnesses: witnesses.trim(), claimRef: claimRef.trim(), claimStatus, claimAmount: claimAmount === "" ? null : Number(claimAmount), photos: incPhotos })}><CheckCircle2 size={15} /> Save</PrimaryButton>}
        {existing && <button onClick={print} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print incident report</button>}
        {existing && <ConfirmTextDelete label="Delete this incident" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Permits to work
--------------------------------------------------------- */
export function PermitsView({ onExtend, permits, devices, suppliers, areas, locationName, onSave, onClose }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("open");
  const list = permits.filter((p) => filter === "all" || (filter === "open" ? p.status === "open" : p.status !== "open")).sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
  const fmtDT = (v) => v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <ToggleButton active={filter === "open"} onClick={() => setFilter("open")}>Open ({permits.filter((p) => p.status === "open").length})</ToggleButton>
        <ToggleButton active={filter === "closed"} onClick={() => setFilter("closed")}>Closed</ToggleButton>
        <ToggleButton active={filter === "all"} onClick={() => setFilter("all")}>All</ToggleButton>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Flame size={15} /> Issue a permit to work</PrimaryButton>}
        {permits.length > 0 && <ExportButton label="CSV" filename="permit-register.csv" rows={[["Ref", "Type", "Contractor", "Company", "Work", "Area", "Valid from", "Valid to", "Issued by", "Status", "Closed"], ...permits.map((p) => [p.ref, p.type, p.contractor || "", p.company || "", p.description || "", p.area || "", fmtDT(p.validFrom), fmtDT(p.validTo), p.issuedBy || "", p.status, fmtDT(p.closedAt)])]} />}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Flame} title={filter === "open" ? "No open permits" : "Nothing here"} body="Issue hot works, working at height, confined space and isolation permits, print them for the contractor, and close them when the work is done." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((p) => {
            const expired = p.status === "open" && p.validTo && new Date(p.validTo).getTime() < Date.now();
            return (
              <div key={p.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${p.status !== "open" ? "#8A94A0" : expired ? "#C53030" : "#D97706"}`, borderRadius: 12, padding: 11 }}>
                <button onClick={() => setEditing(p)} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.ref}</span> · {p.type}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.status === "open" ? (expired ? "var(--danger)" : "var(--warn)") : "var(--muted)" }}>{p.status === "open" ? (expired ? "Expired — close it" : "Open") : p.status === "cancelled" ? "Cancelled" : "Closed"}</span>
                  </div>
                  <div style={{ fontSize: 11.3, color: "var(--faint)" }}>{[p.contractor, p.company, p.area].filter(Boolean).join(" · ")} · {fmtDT(p.validFrom)} → {fmtDT(p.validTo)}</div>
                  <div style={{ fontSize: 12.3, color: "var(--text-2)", marginTop: 2 }}>{p.description}</div>
                  {(p.extensions || []).length > 0 && <div style={{ fontSize: 11, color: "var(--warn)" }}>Extended {p.extensions.length}× — last: {p.extensions[p.extensions.length - 1].reason}</div>}
                </button>
                {ACTIVE_CAN_EDIT && p.status === "open" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => { const hrs = window.prompt("Extend by how many hours?", "4"); if (!hrs || isNaN(Number(hrs))) return; const reason = window.prompt("Reason for the extension:", "Work not finished") || ""; onExtend?.(p.id, new Date(Math.max(Date.now(), new Date(p.validTo).getTime()) + Number(hrs) * 3600000).toISOString(), reason); }} style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Extend</button>
                    <label title="Close with a photo of the area left safe" style={{ background: "var(--card-hi)", borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}><Camera size={14} color="#2B4562" /><input type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { onClose(p.id, "closed", await compressImage(f, 720, 0.6)); } catch (x) { onClose(p.id, "closed"); } }} style={{ display: "none" }} /></label>
                    <button onClick={() => onClose(p.id, "closed")} style={{ flex: 1, background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Work done — close permit</button>
                    <button onClick={() => printPermit(p, devices, locationName)} style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Printer size={13} /> Print</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && <PermitModal existing={editing.id ? editing : null} devices={devices} suppliers={suppliers} areas={areas} locationName={locationName} onClose={() => setEditing(null)} onCancelPermit={(id) => { onClose(id, "cancelled"); setEditing(null); }}
        onSave={(pm, print) => { const ref = onSave(pm); if (print) printPermit({ ...pm, ref: pm.ref || ref, issuedAt: pm.issuedAt || new Date().toISOString() }, devices, locationName); setEditing(null); }} />}
    </div>
  );
}

export function PermitModal({ existing, devices, suppliers, areas, locationName, onClose, onSave, onCancelPermit }) {
  const now = new Date(); const later = new Date(now.getTime() + 8 * 3600000);
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [type, setType] = useState(existing?.type || PERMIT_TYPES[0]);
  const [deviceId, setDeviceId] = useState(existing?.deviceId || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [company, setCompany] = useState(existing?.company || "");
  const [contractor, setContractor] = useState(existing?.contractor || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [area, setArea] = useState(existing?.area || "");
  const [validFrom, setValidFrom] = useState(existing?.validFrom ? local(new Date(existing.validFrom)) : local(now));
  const [validTo, setValidTo] = useState(existing?.validTo ? local(new Date(existing.validTo)) : local(later));
  const [checks, setChecks] = useState(existing?.checks || []);
  const [extra, setExtra] = useState(existing?.extra || "");
  const listId = useMemo(() => `ptw-${uid()}`, []);
  const precautions = PERMIT_PRECAUTIONS[type] || [];
  const allChecked = precautions.every((x) => checks.includes(x));
  const payload = () => ({ ...(existing || {}), type, deviceId: deviceId || null, supplierId: supplierId || null, company: company.trim(), contractor: contractor.trim(), description: description.trim(), area: area.trim(), validFrom: new Date(validFrom).toISOString(), validTo: new Date(validTo).toISOString(), checks, extra: extra.trim() });
  const readOnly = existing && existing.status !== "open";
  return (
    <Modal title={existing ? `Permit ${existing.ref}` : "Issue a permit to work"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{PERMIT_TYPES.map((t) => <ToggleButton key={t} active={type === t} onClick={() => !readOnly && (setType(t), setChecks([]))}>{t}</ToggleButton>)}</div>
        <Field label="Work to be done"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Brazing on chilled water pipework in plant room" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Service (optional)"><Select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); const d = devices.find((x) => x.id === e.target.value); if (d?.area && !area) setArea(d.area); if (d?.supplierId && !supplierId) { setSupplierId(d.supplierId); setCompany(suppliers.find((s) => s.id === d.supplierId)?.name || ""); } }}><option value="">—</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Where"><TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Contractor name"><TextInput value={contractor} onChange={(e) => setContractor(e.target.value)} /></Field>
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Valid from"><TextInput type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field>
          <Field label="Valid until"><TextInput type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></Field>
        </div>
        <div style={{ background: "var(--warn-soft)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>Precautions confirmed</div>
          {precautions.map((x) => (
            <label key={x} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}>
              <input type="checkbox" checked={checks.includes(x)} disabled={readOnly} onChange={(e) => setChecks((p) => e.target.checked ? [...p, x] : p.filter((y) => y !== x))} style={{ margin: 0 }} /> {x}
            </label>
          ))}
          <TextInput value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Additional precautions (optional)" style={{ fontSize: 12.5 }} />
          {!allChecked && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>Tick every precaution before the work starts.</span>}
        </div>
        {!readOnly && ACTIVE_CAN_EDIT && (
          <>
            <PrimaryButton onClick={() => description.trim() && contractor.trim() && onSave(payload(), true)}><Printer size={15} /> {existing ? "Save & print" : "Issue & print permit"}</PrimaryButton>
            <button onClick={() => description.trim() && contractor.trim() && onSave(payload(), false)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>{existing ? "Save" : "Issue without printing"}</button>
            {existing && <button onClick={() => onCancelPermit(existing.id)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel this permit</button>}
          </>
        )}
        {readOnly && <div style={{ fontSize: 12, color: "var(--muted)" }}>{existing.status === "cancelled" ? "Cancelled" : "Closed"} by {existing.closedBy} on {new Date(existing.closedAt).toLocaleString("en-GB")}.</div>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Waste & recycling
--------------------------------------------------------- */
export function WasteView({ target = null, onSaveTarget, waste, suppliers, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const yr = String(new Date().getFullYear());
  const ytd = waste.filter((w) => String(w.date).startsWith(yr));
  const total = ytd.reduce((t, w) => t + (Number(w.weightKg) || 0), 0);
  const general = ytd.filter((w) => w.stream === "general" || w.stream === "hazardous").reduce((t, w) => t + (Number(w.weightKg) || 0), 0);
  const rate = total ? Math.round(((total - general) / total) * 100) : null;
  const cost = ytd.reduce((t, w) => t + (Number(w.cost) || 0), 0);
  const byStream = Object.keys(WASTE_STREAMS).map((k) => [k, ytd.filter((w) => w.stream === k).reduce((t, w) => t + (Number(w.weightKg) || 0), 0)]).filter(([, v]) => v > 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label={`Waste ${yr}`} value={total >= 1000 ? `${(total / 1000).toFixed(2)} t` : `${Math.round(total)} kg`} />
        <MetricBlock label={target ? `Recycling (target ${target}%)` : "Recycling rate"} value={rate == null ? "—" : `${rate}%`} tone={rate == null ? undefined : target ? (rate >= target ? "ok" : "danger") : rate >= 60 ? "ok" : rate < 40 ? "danger" : undefined} />
        <MetricBlock label="Cost" value={gbp(cost)} />
      </div>
      {byStream.length > 0 && (
        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 4 }}>
          {byStream.map(([k, v]) => <div key={k} title={`${WASTE_STREAMS[k]} ${Math.round(v)} kg`} style={{ width: `${(v / total) * 100}%`, background: { general: "#5B6672", mixed: "#2F855A", cardboard: "#B7791F", food: "#8E4585", glass: "#2B6CB0", paper: "#2B7A78", weee: "#C05621", hazardous: "#C53030" }[k] }} />)}
        </div>
      )}
      {ACTIVE_CAN_EDIT && onSaveTarget && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12.5 }}><span style={{ color: "var(--muted)" }}>Recycling target</span><TextInput type="number" min="0" max="100" defaultValue={target ?? ""} onBlur={(e) => onSaveTarget(e.target.value)} placeholder="e.g. 70" style={{ width: 70, padding: "5px 8px" }} /><span style={{ color: "var(--muted)" }}>%</span></div>}
      {ytd.length > 0 && (() => {
        const months = MONTH_LABELS.map((m, i) => { const list = ytd.filter((w) => new Date(w.date).getMonth() === i); const tot = list.reduce((t, w) => t + (Number(w.weightKg) || 0), 0); const gen = list.filter((w) => w.stream === "general" || w.stream === "hazardous").reduce((t, w) => t + (Number(w.weightKg) || 0), 0); return { m, recycled: Math.round(tot - gen), general: Math.round(gen) }; }).slice(0, new Date().getMonth() + 1);
        return (
          <div style={{ height: 150, marginBottom: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="m" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => `${v} kg`} /><Legend wrapperStyle={{ fontSize: 10.5 }} />
                <Bar dataKey="recycled" name="Recycled" stackId="a" fill="#2F855A" /><Bar dataKey="general" name="General / hazardous" stackId="a" fill="#8A94A0" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}
      {byStream.length > 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>{byStream.map(([k, v]) => `${WASTE_STREAMS[k]} ${Math.round(v)} kg`).join(" · ")}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Recycle size={15} /> Log a collection</PrimaryButton>}
        {waste.length > 0 && <ExportButton label="CSV" filename="waste-log.csv" rows={[["Date", "Stream", "Weight (kg)", "Carrier", "Waste transfer note", "Cost", "Logged by"], ...waste.map((w) => [w.date, WASTE_STREAMS[w.stream] || w.stream, w.weightKg, suppliers.find((s) => s.id === w.supplierId)?.name || w.carrier || "", w.wtn || "", w.cost || "", w.by || ""])]} />}
      </div>
      {waste.length === 0 ? (
        <EmptyState icon={Recycle} title="No waste records yet" body="Log each collection's stream, weight, carrier and waste transfer note. You get a recycling rate and yearly totals for ESG and environmental reports." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...waste].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 60).map((w) => (
            <button key={w.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(w)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{WASTE_STREAMS[w.stream]}</div>
                <div style={{ fontSize: 11, color: "var(--faint)" }}>{fmtDate(w.date)}{(suppliers.find((s) => s.id === w.supplierId)?.name || w.carrier) ? ` · ${suppliers.find((s) => s.id === w.supplierId)?.name || w.carrier}` : ""}{w.wtn ? ` · WTN ${w.wtn}` : ""}</div>
              </div>
              <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{w.weightKg} kg</b>
            </button>
          ))}
        </div>
      )}
      {editing && <WasteModal existing={editing.id ? editing : null} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(w) => { onSave(w); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}

export function WasteModal({ existing, suppliers, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [stream, setStream] = useState(existing?.stream || "general");
  const [weightKg, setWeightKg] = useState(existing?.weightKg != null ? String(existing.weightKg) : "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [carrier, setCarrier] = useState(existing?.carrier || "");
  const [wtn, setWtn] = useState(existing?.wtn || "");
  const [cost, setCost] = useState(existing?.cost != null ? String(existing.cost) : "");
  return (
    <Modal title={existing ? "Waste collection" : "Log a waste collection"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{Object.entries(WASTE_STREAMS).map(([k, v]) => <ToggleButton key={k} active={stream === k} onClick={() => setStream(k)}>{v}</ToggleButton>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Weight (kg)"><TextInput type="number" min="0" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="from the ticket" /></Field>
        </div>
        <Field label="Carrier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">— Other —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        {!supplierId && <Field label="Carrier name"><TextInput value={carrier} onChange={(e) => setCarrier(e.target.value)} /></Field>}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Waste transfer note no."><TextInput value={wtn} onChange={(e) => setWtn(e.target.value)} /></Field>
          <Field label={`Cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </div>
        <PrimaryButton onClick={() => weightKg !== "" && onSave({ id: existing?.id, date, stream, weightKg: Number(weightKg), supplierId: supplierId || null, carrier: carrier.trim(), wtn: wtn.trim(), cost: cost === "" ? null : Number(cost) })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this record" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

export function ReadingsImportModal({ meters, onClose, onImport }) {
  const [text, setText] = useState("");
  const rows = text.trim() ? parseDelimited(text) : [];
  const body = rows.length && /meter|name/i.test(rows[0][0] || "") ? rows.slice(1) : rows;
  const parsed = body.map((r) => {
    const m = meters.find((x) => x.name.trim().toLowerCase() === String(r[0] || "").trim().toLowerCase() || (x.serial && x.serial === String(r[0] || "").trim()));
    const date = toISO(r[1]); const value = Number(String(r[2] || "").replace(/,/g, ""));
    return { ok: !!(m && date && !isNaN(value) && String(r[2] || "").trim() !== ""), meter: m, date, value, raw: r };
  });
  const good = parsed.filter((p) => p.ok);
  return (
    <Modal title="Import meter readings" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Paste three columns — <b>meter name (or serial), date, reading</b> — from a spreadsheet or your energy supplier's export.</div>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Upload size={14} /> Upload an Excel or CSV file
          <input type="file" accept=".xlsx,.csv,.txt" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setText(/\.xlsx$/i.test(f.name) ? await xlsxToText(f) : await f.text()); } catch (x) { alert("Couldn't read that file — try copying the cells and pasting them instead."); } }} style={{ display: "none" }} />
        </label>
        <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder={`…or paste: Main electricity\t01/09/2026\t15230`} style={{ minHeight: 110, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
        {parsed.length > 0 && <div style={{ fontSize: 12, color: good.length === parsed.length ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>{good.length} of {parsed.length} rows ready{parsed.length > good.length ? " — rows with an unknown meter or bad date are skipped" : ""}</div>}
        <PrimaryButton onClick={() => good.length && onImport(good.map((p) => ({ meterId: p.meter.id, date: p.date, value: p.value })))}><Upload size={15} /> Import {good.length} reading{good.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

export function StockTakeModal({ spares, onClose, onSave }) {
  const [counts, setCounts] = useState({});
  const changed = spares.filter((sp) => counts[sp.id] !== undefined && counts[sp.id] !== "" && Number(counts[sp.id]) !== Number(sp.qty));
  return (
    <Modal title="Stock take" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Count what's actually on the shelf. Leave a box blank if you didn't count that item.</div>
        {[...spares].sort((a, b) => String(a.store || "~").localeCompare(String(b.store || "~")) || a.name.localeCompare(b.name)).map((sp) => {
          const v = counts[sp.id]; const diff = v !== undefined && v !== "" ? Number(v) - Number(sp.qty) : 0;
          return (
            <div key={sp.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.8, fontWeight: 650 }}>{sp.name}</div><div style={{ fontSize: 10.8, color: "var(--faint)" }}>{sp.store || "—"} · system says {sp.qty}</div></div>
              {diff !== 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: diff < 0 ? "var(--danger)" : "var(--ok)" }}>{diff > 0 ? "+" : ""}{diff}</span>}
              <TextInput type="number" min="0" value={v ?? ""} onChange={(e) => setCounts((p) => ({ ...p, [sp.id]: e.target.value }))} placeholder="count" style={{ width: 70, padding: "5px 7px" }} />
            </div>
          );
        })}
        <PrimaryButton onClick={() => onSave(counts)}><CheckCircle2 size={15} /> Save stock take{changed.length ? ` (${changed.length} change${changed.length === 1 ? "" : "s"})` : ""}</PrimaryButton>
      </div>
    </Modal>
  );
}

export function KeyAuditModal({ keys, onClose, onSave }) {
  const [res, setRes] = useState(Object.fromEntries(keys.map((k) => [k.id, k.holder ? true : null])));
  const checked = Object.values(res).filter((v) => v !== null).length;
  return (
    <Modal title="Key audit" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Check each key or card is where it should be. Keys signed out to someone count as present.</div>
        {keys.map((k) => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card-hi)", borderRadius: 9, padding: "7px 9px" }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 650 }}>{k.label}{k.number ? ` #${k.number}` : ""}</div><div style={{ fontSize: 11, color: "var(--faint)" }}>{k.holder ? `With ${k.holder}` : k.kept || ""}</div></div>
            <ToggleButton active={res[k.id] === true} onClick={() => setRes((p) => ({ ...p, [k.id]: true }))}>Present</ToggleButton>
            <ToggleButton active={res[k.id] === false} onClick={() => setRes((p) => ({ ...p, [k.id]: false }))}>Missing</ToggleButton>
          </div>
        ))}
        <PrimaryButton onClick={() => onSave(Object.fromEntries(Object.entries(res).filter(([, v]) => v !== null)))}><CheckCircle2 size={15} /> Save audit ({checked}/{keys.length} checked)</PrimaryButton>
      </div>
    </Modal>
  );
}
