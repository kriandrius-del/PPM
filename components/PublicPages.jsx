// Public pages opened from links / QR codes (no login):
//   ?supplier=<token>  — a supplier's own job list: accept, ETA, attended, done (with notes, photos, signature)
//   ?meter=<id>        — read a meter from the QR sticker on it
//   ?feedback=<site>   — occupant feedback survey (ratings + comment)
import { useState, useEffect } from "react";
import { CheckCircle2, Camera, Loader2, Send, Wrench, Gauge, Star, Building2 } from "lucide-react";
import { Field, PrimaryButton, SignaturePad, TextArea, TextInput } from "./ui.jsx";
import { SLA_DAYS } from "../lib/constants.js";
import { set_ACTIVE_SLA } from "../lib/globals.js";
import { publicRead, publicWrite } from "../lib/publicApi.js";
import { compressImage, daysUntil, fmtDate, workSla } from "../lib/utils.js";
// These pages read and save only through lib/publicApi.js (narrow database functions when logins are on).
const OFFLINE_MSG = "Can't connect right now — check your signal and try again.";

function Shell({ title, sub, icon: I = Building2, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", color: "var(--text)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: 16 }}>
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "var(--head)", color: "#fff", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><I size={20} color="#F2B45A" /></div>
          <div><div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>{sub && <div style={{ fontSize: 12.5, color: "#C7D0DA" }}>{sub}</div>}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 };
const bigBtn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flex: 1 });

/* ---------- Supplier job portal ---------- */
export function SupplierPortal({ token }) {
  const [state, setState] = useState({ loading: true });
  const [openId, setOpenId] = useState(null);
  async function refresh() {
    let r;
    try { r = await publicRead("supplier", token); } catch (e) { setState({ loading: false, sup: null, error: OFFLINE_MSG }); return; }
    const sup = r?.supplier;
    if (!sup) { setState({ loading: false, sup: null }); return; }
    if (r.sla) set_ACTIVE_SLA({ ...SLA_DAYS, ...(r.sla.days || {}), workingDays: !!r.sla.workingDays });
    const devices = r.devices || []; const locations = r.locations || [];
    const mine = (r.works || []).filter((w) => !["completed", "rejected"].includes(w.status)).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority || "medium"] - { high: 0, medium: 1, low: 2 }[b.priority || "medium"]) || String(a.dateRaised).localeCompare(String(b.dateRaised)));
    setState({ loading: false, sup, works: mine, devices, locations });
  }
  useEffect(() => { refresh(); }, [token]);
  async function update(id, name, patch, comment) {
    await publicWrite("supplier", token, { workId: id, name, patch, comment });
    await refresh();
  }
  if (state.loading) return <Shell title="Your jobs"><div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} /></div></Shell>;
  if (state.error) return <Shell title="Your jobs"><div style={card}>{state.error}</div></Shell>;
  if (!state.sup) return <Shell title="Link not recognised"><div style={card}>This job link has expired or been replaced. Please ask the facilities team for a new one.</div></Shell>;
  const { sup, works, devices, locations } = state;
  const dev = (id) => devices.find((d) => d.id === id); const loc = (d) => locations.find((l) => l.id === d?.locationId);
  return (
    <Shell title={`${sup.name} — jobs`} sub={`${works.length} open job${works.length === 1 ? "" : "s"} · tap a job to update it`} icon={Wrench}>
      {works.length === 0 && <div style={card}>No open jobs for you right now. Thank you!</div>}
      {works.map((w) => {
        const d = dev(w.deviceId); const sla = workSla(w); const ack = w.supplierAck;
        return (
          <div key={w.id} style={{ ...card, borderLeft: `4px solid ${w.priority === "high" ? "var(--danger)" : w.priority === "low" ? "var(--faint)" : "var(--warn)"}` }}>
            <button onClick={() => setOpenId(openId === w.id ? null : w.id)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
              <div style={{ fontSize: 15, fontWeight: 750 }}>{w.description}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{d?.name || "Service"}{d?.area ? ` · ${d.area}` : ""} · {loc(d)?.name || ""}</div>
              <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>Ref <b>{w.id.slice(-6).toUpperCase()}</b></span>
                <span style={{ fontWeight: 700, color: w.priority === "high" ? "var(--danger)" : "var(--text-2)" }}>{(w.priority || "medium").toUpperCase()}</span>
                {sla && <span style={{ color: sla.breached ? "var(--danger)" : "var(--muted)", fontWeight: sla.breached ? 700 : 500 }}>Complete by {fmtDate(sla.deadline)}</span>}
                {ack?.declined ? <span style={{ color: "var(--danger)", fontWeight: 700 }}>Declined</span> : ack ? <span style={{ color: "var(--ok)", fontWeight: 700 }}>Accepted ✓</span> : <span style={{ color: "var(--warn)", fontWeight: 700 }}>Please accept</span>}
                {w.supplierDone && <span style={{ color: "var(--ok)", fontWeight: 700 }}>Marked done — awaiting sign-off</span>}
              </div>
            </button>
            {openId === w.id && <SupplierJobEditor w={w} device={d} supplierName={sup.name} onUpdate={(name, patch, c) => update(w.id, name, patch, c)} />}
          </div>
        );
      })}
    </Shell>
  );
}
function SupplierJobEditor({ w, device, supplierName, onUpdate }) {
  const [name, setName] = useState(w.supplierAck?.name || ""); const [eta, setEta] = useState(w.eta || "");
  const [notes, setNotes] = useState(""); const [photos, setPhotos] = useState([]); const [sig, setSig] = useState(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function addPhotos(e) { const fs = [...(e.target.files || [])].slice(0, 3 - photos.length); e.target.value = ""; setBusy(true); try { const out = await Promise.all(fs.map((f) => compressImage(f, 720, 0.6))); setPhotos((p) => [...p, ...out].slice(0, 3)); } catch (x) { /* ignore */ } setBusy(false); }
  const go = async (patch, comment, okMsg) => {
    if (!name.trim()) { setMsg("Please enter your name first."); return; }
    setBusy(true); setMsg("");
    try { await onUpdate(name.trim(), patch, comment); setMsg(okMsg); } catch (e) { setMsg(`Please try again — ${e.message || "couldn't save"}`); }
    setBusy(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      {device?.accessNotes && <div style={{ fontSize: 12.5, background: "var(--warn-soft)", borderRadius: 8, padding: "7px 9px" }}><b>Access:</b> {device.accessNotes}</div>}
      {device?.instructions && <div style={{ fontSize: 12.5, background: "var(--accent-soft)", borderRadius: 8, padding: "7px 9px" }}><b>Instructions:</b> {device.instructions}</div>}
      <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {!w.supplierAck && (
        <div style={{ display: "flex", gap: 6 }}>
          <button disabled={busy} onClick={() => go({ supplierAck: { name: name.trim(), at: new Date().toISOString() } }, `Job accepted by ${name.trim()}`, "Accepted — thank you.")} style={bigBtn("var(--ok)")}>Accept job</button>
          <button disabled={busy} onClick={() => { const why = window.prompt("Why can't you take this job?", ""); if (why !== null) go({ supplierAck: { name: name.trim(), at: new Date().toISOString(), declined: true, reason: why } }, `Job declined by ${name.trim()}${why ? `: ${why}` : ""}`, "Declined — the team has been told."); }} style={bigBtn("var(--card-hi)", "var(--danger)")}>Decline</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <Field label="Expected completion"><TextInput type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></Field>
        <button disabled={busy || !eta} onClick={() => go({ eta }, `Expected completion set to ${fmtDate(eta)} by ${name.trim()}`, "Date saved.")} style={{ ...bigBtn("var(--accent)", "var(--on-accent)"), flex: "none" }}>Save date</button>
      </div>
      {!w.attendedAt && <button disabled={busy} onClick={() => go({ attendedAt: new Date().toISOString().slice(0, 16) }, `Engineer ${name.trim()} on site`, "Attendance recorded.")} style={bigBtn("var(--card-hi)", "var(--accent)")}>I'm on site now</button>}
      {!w.supplierDone && (
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Finished?</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done, parts used, anything the site should know" style={{ minHeight: 60 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />)}
            {photos.length < 3 && <label style={{ width: 60, height: 60, borderRadius: 8, border: "1.5px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Camera size={18} color="var(--faint)" /><input type="file" accept="image/*" multiple capture="environment" onChange={addPhotos} style={{ display: "none" }} /></label>}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Signature</div>
          <SignaturePad value={sig} onChange={setSig} height={110} />
          <button disabled={busy} onClick={() => { if (!notes.trim()) { setMsg("Please say what was done."); return; } go({ supplierDone: { name: name.trim(), at: new Date().toISOString(), notes: notes.trim(), photos, signature: sig }, photos: [...(w.photos || []), ...photos].slice(0, 8) }, `Marked complete by ${name.trim()}: ${notes.trim()}`, "Thanks — the site team will sign it off."); }} style={bigBtn("var(--ok)")}>Mark job complete</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 13, fontWeight: 650, color: msg.startsWith("Please") ? "var(--danger)" : "var(--ok)" }}>{msg}</div>}
    </div>
  );
}

/* ---------- Meter reading by QR ---------- */
export function MeterPortal({ meterId }) {
  const [state, setState] = useState({ loading: true });
  const [value, setValue] = useState(""); const [name, setName] = useState(""); const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [done, setDone] = useState(false);
  useEffect(() => { (async () => {
    try { const r = await publicRead("meter", meterId); setState({ loading: false, m: r?.meter || null, last: r?.last || null, loc: r?.location || null }); }
    catch (e) { setState({ loading: false, m: null, error: OFFLINE_MSG }); }
  })(); }, [meterId]);
  async function save() {
    const v = Number(String(value).replace(/,/g, ""));
    if (!name.trim() || value === "" || isNaN(v)) { setMsg("Please enter your name and the reading."); return; }
    if (state.last && v < Number(state.last.value) && !window.confirm(`That's lower than the last reading (${state.last.value}). Has the meter been replaced or reset?`)) return;
    setBusy(true); setMsg("");
    try { await publicWrite("meter", meterId, { name: name.trim(), value: v, photo: photo || undefined, reset: !!(state.last && v < Number(state.last.value)) }); setDone(true); }
    catch (e) { setMsg(e.message || "Couldn't save — please try again."); }
    setBusy(false);
  }
  if (state.loading) return <Shell title="Meter reading" icon={Gauge}><div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} /></div></Shell>;
  if (state.error) return <Shell title="Meter reading" icon={Gauge}><div style={card}>{state.error}</div></Shell>;
  if (!state.m) return <Shell title="Meter not found" icon={Gauge}><div style={card}>This QR code doesn't match a meter any more.</div></Shell>;
  if (done) return <Shell title={state.m.name} sub={state.loc?.name} icon={Gauge}><div style={{ ...card, alignItems: "center", textAlign: "center" }}><CheckCircle2 size={44} color="var(--ok)" /><div style={{ fontSize: 18, fontWeight: 750 }}>Reading saved</div><div style={{ color: "var(--muted)", fontSize: 13 }}>Thank you.</div></div></Shell>;
  return (
    <Shell title={state.m.name} sub={`${state.loc?.name || ""}${state.m.serial ? ` · serial ${state.m.serial}` : ""}`} icon={Gauge}>
      <div style={card}>
        {state.last && <div style={{ fontSize: 13, color: "var(--muted)" }}>Last reading: <b style={{ color: "var(--text)" }}>{Number(state.last.value).toLocaleString("en-GB")} {state.m.unit}</b> on {fmtDate(state.last.date)}</div>}
        <Field label={`Reading now (${state.m.unit || "units"})`}><TextInput type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} style={{ fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }} /></Field>
        <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--accent)", fontWeight: 650, cursor: "pointer" }}><Camera size={16} /> {photo ? "Photo added ✓" : "Add a photo of the meter (optional)"}<input type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setPhoto(await compressImage(f, 720, 0.6)); } catch (x) { /* ignore */ } } }} style={{ display: "none" }} /></label>
        {msg && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{msg}</div>}
        <PrimaryButton onClick={() => !busy && save()}><Send size={15} /> {busy ? "Saving…" : "Save reading"}</PrimaryButton>
      </div>
    </Shell>
  );
}

/* ---------- Occupant feedback survey ---------- */
export const FEEDBACK_TOPICS = ["Cleanliness", "Temperature", "Toilets & washrooms", "Lighting", "Kitchen / tea points", "Overall"];
export function FeedbackPortal({ locationId, area }) {
  const [loc, setLoc] = useState(undefined); const [ratings, setRatings] = useState({}); const [comment, setComment] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { publicRead("feedback", locationId).then((r) => setLoc(r?.location || null)).catch(() => { setErr(OFFLINE_MSG); setLoc(null); }); }, [locationId]);
  async function send() {
    if (!Object.keys(ratings).length && !comment.trim()) return;
    setBusy(true); setErr("");
    const clean = Object.fromEntries(Object.entries(ratings).filter(([, n]) => n));
    try { await publicWrite("feedback", locationId, { area: area || "", ratings: clean, comment: comment.trim() }); setDone(true); }
    catch (e) { setErr(e.message || "Couldn't send — please try again."); }
    setBusy(false);
  }
  if (loc === undefined) return <Shell title="Feedback"><div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} /></div></Shell>;
  if (!loc) return <Shell title="Feedback"><div style={card}>{err || "This feedback code isn't linked to a site any more."}</div></Shell>;
  if (done) return <Shell title="Thank you!" sub={loc.name} icon={Star}><div style={{ ...card, alignItems: "center", textAlign: "center" }}><CheckCircle2 size={44} color="var(--ok)" /><div style={{ fontSize: 16, fontWeight: 700 }}>Your feedback helps us look after the building.</div><div style={{ fontSize: 13, color: "var(--muted)" }}>Need something fixed? Scan the QR sticker on the equipment to report it.</div></div></Shell>;
  return (
    <Shell title="How are we doing?" sub={`${loc.name}${area ? ` · ${area}` : ""} · takes 20 seconds, anonymous`} icon={Star}>
      <div style={card}>
        {FEEDBACK_TOPICS.map((t) => (
          <div key={t}>
            <div style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 4 }}>{t}</div>
            <div style={{ display: "flex", gap: 4 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRatings((r) => ({ ...r, [t]: r[t] === n ? undefined : n }))} style={{ flex: 1, background: (ratings[t] || 0) >= n ? "#D97706" : "var(--card-hi)", color: (ratings[t] || 0) >= n ? "#fff" : "var(--faint)", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 18, cursor: "pointer" }}>★</button>)}</div>
          </div>
        ))}
        <Field label="Anything else? (optional)"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Meeting room 3 is always cold in the mornings" /></Field>
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{err}</div>}
        <PrimaryButton onClick={() => !busy && send()}><Send size={15} /> {busy ? "Sending…" : "Send feedback"}</PrimaryButton>
      </div>
    </Shell>
  );
}

/* ---------- QR check sheet: fill in any site log from a poster (e.g. toilet checks) ---------- */
export function CheckPortal({ logId, locationId, area }) {
  const [state, setState] = useState({ loading: true }); const [values, setValues] = useState(area ? { area } : {}); const [name, setName] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { (async () => {
    try { const r = await publicRead("check", logId, locationId); setState({ loading: false, def: r?.def || null, loc: r?.location || null, last: r?.last || null }); }
    catch (e) { setState({ loading: false, error: OFFLINE_MSG }); }
  })(); }, [logId, locationId]);
  async function save() {
    if (!name.trim()) { setErr("Please enter your name."); return; }
    setBusy(true); setErr("");
    try { await publicWrite("check", logId, { locationId, values, name: name.trim() }); setDone(true); }
    catch (e) { setErr(e.message || "Couldn't save — please try again."); }
    setBusy(false);
  }
  if (state.loading) return <Shell title="Check sheet"><div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} /></div></Shell>;
  if (state.error) return <Shell title="Check sheet"><div style={card}>{state.error}</div></Shell>;
  if (!state.def || !state.loc) return <Shell title="Check sheet"><div style={card}>This QR code isn't linked to a check sheet any more. Please tell the facilities team.</div></Shell>;
  if (done) return <Shell title={state.def.name} sub={state.loc.name}><div style={{ ...card, alignItems: "center", textAlign: "center" }}><CheckCircle2 size={44} color="var(--ok)" /><div style={{ fontSize: 18, fontWeight: 750 }}>Check recorded</div><div style={{ fontSize: 13, color: "var(--muted)" }}>{new Date().toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} — thank you, {name.split(" ")[0]}.</div></div></Shell>;
  const { def, loc, last } = state;
  return (
    <Shell title={def.name} sub={`${loc.name}${area ? ` · ${area}` : ""}`}>
      <div style={card}>
        {last && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Last check: {new Date(last.at || last.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} by {String(last.by || "").replace(" (QR)", "")}</div>}
        {def.fields.map((f) => f.type === "check" ? (
          <button key={f.key} type="button" onClick={() => setValues((p) => ({ ...p, [f.key]: !p[f.key] }))} style={{ display: "flex", alignItems: "center", gap: 10, background: values[f.key] ? "var(--ok-soft)" : "var(--card-hi)", border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 650, color: "var(--text)", textAlign: "left" }}>
            {values[f.key] ? <CheckCircle2 size={22} color="var(--ok)" /> : <span style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid var(--faint)" }} />} {f.label}
          </button>
        ) : f.type === "select" ? (
          <Field key={f.key} label={f.label}><select value={values[f.key] || ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", fontSize: 14 }}><option value="">—</option>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
        ) : (
          <Field key={f.key} label={f.label}><TextInput type={f.type === "number" || f.type === "callpoint" ? "number" : f.type === "date" ? "date" : "text"} value={values[f.key] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} /></Field>
        ))}
        <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{err}</div>}
        <PrimaryButton onClick={() => !busy && save()}><Send size={15} /> {busy ? "Saving…" : "Record check"}</PrimaryButton>
      </div>
    </Shell>
  );
}
