// Public 'report a problem' page (from QR stickers) — no login. Reads and saves only through lib/publicApi.js.
import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, Camera, Send, Wrench } from "lucide-react";
import { Field, PrimaryButton, Select, TextArea, TextInput, WorkStatusTag } from "./ui.jsx";
import { PRODUCT_NAME, REQUEST_CATEGORIES } from "../lib/constants.js";
import { publicRead, publicWrite } from "../lib/publicApi.js";
import { checklistLabel, compressImage, fmtDate } from "../lib/utils.js";

export function RequestPortal({ deviceId }) {
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState(null);
  const [location, setLocation] = useState(null);
  const [recent, setRecent] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("report");
  const [category, setCategory] = useState("");
  const [onCall, setOnCall] = useState(null);

  const [loadError, setLoadError] = useState("");
  async function refresh() {
    try {
      const r = await publicRead("request", deviceId);
      setDevice(r?.device || null); setLocation(r?.location || null); setRecent(r?.recent || []); setOnCall(r?.onCall || null); setLoadError("");
    } catch (e) { setLoadError("Can't connect right now — check your signal and try again."); }
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [deviceId]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { setPhoto(await compressImage(file)); } catch (err) { /* allow retry */ }
    setBusy(false);
  }
  async function submit() {
    if (!name.trim() || !description.trim()) { setError("Please add your name and describe the problem."); return; }
    setError(""); setBusy(true);
    const text = `${category && !description.toLowerCase().includes(category.toLowerCase()) ? `${category}: ` : ""}${description.trim()}`;
    try {
      const r = await publicWrite("request", deviceId, { name: name.trim(), email: email.trim(), description: text, priority, photo });
      setSubmitted({ id: r.id });
      setDescription(""); setPhoto(null); setPriority("medium");
      refresh();
    } catch (e) { setError(e.message || "Couldn't send — please try again."); }
    setBusy(false);
  }

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "var(--card-hi)", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", color: "var(--text)", padding: 16 }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ background: "var(--head)", color: "var(--on-accent)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#9AA5B1", fontWeight: 600 }}>Report a problem</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>{device ? device.name : PRODUCT_NAME}</div>
          {location && <div style={{ fontSize: 12.5, color: "#C7D0DA", marginTop: 2 }}>{location.name}</div>}
        </div>
        {children}
      </div>
    </div>
  );
  if (loading) return shell(<div style={{ textAlign: "center", padding: 30, color: "var(--faint)" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>);
  if (loadError) return shell(<div style={{ background: "var(--card)", borderRadius: 12, padding: 18, fontSize: 13.5 }}>{loadError} <button onClick={() => { setLoading(true); refresh(); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button></div>);
  if (!device) return shell(<div style={{ background: "var(--card)", borderRadius: 12, padding: 18, fontSize: 13.5 }}>This QR code doesn't match a service anymore — it may have been removed. Please let the facilities team know directly.</div>);
  if (mode === "engineer") return shell(<EngineerReport device={device} onBack={() => setMode("report")} />);
  return shell(
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setMode("report")} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Report a problem</button>
        <button onClick={() => setMode("engineer")} style={{ flex: 1, background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>I'm the engineer</button>
      </div>
      {submitted && (
        <div style={{ background: "var(--ok-soft)", border: "1px solid #BFDCC9", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "var(--ok)", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} /> Thanks — your request was sent</div>
          <div style={{ fontSize: 12.5, color: "#3A5A46", marginTop: 4 }}>Reference <b>{submitted.id.slice(-6).toUpperCase()}</b>. You can check its status below any time by scanning the same code.</div>
        </div>
      )}
      <div style={{ background: "var(--card)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam from Finance" /></Field>
        <Field label="Your email (optional — for updates)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
        <Field label="What kind of problem?">
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {(location?.requestCategories?.length ? [...location.requestCategories.filter((c) => c !== "Other").map((c) => [c, "", "medium"]), ["Other", "", "medium"]] : REQUEST_CATEGORIES).map(([label, text, pr]) => (
              <button key={label} type="button" onClick={() => { setCategory(label === "Other" ? "" : label); if (text && !description.trim()) setDescription(text); setPriority(pr); }} style={{ background: category === label ? "var(--accent)" : "var(--card-hi)", color: category === label ? "var(--on-accent)" : "var(--text-2)", border: "1px solid var(--border)", borderRadius: 16, padding: "7px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
            ))}
          </div>
        </Field>
        <Field label="What's the problem?"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Tap in the kitchen is leaking" /></Field>
        <Field label="How urgent is it?">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low — when someone gets a chance</option>
            <option value="medium">Medium — needs attention this week</option>
            <option value="high">High — urgent / safety issue</option>
          </Select>
        </Field>
        <Field label="Photo (optional)">
          <label style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--muted)", fontSize: 13, background: "#FAFBFC" }}>
            {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={15} />}
            {photo ? "Replace photo" : "Add a photo"}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          {photo && <img src={photo} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 8 }} />}
        </Field>
        {priority === "high" && (location?.phone || onCall?.phone) && (
          <div style={{ background: "var(--danger-soft)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
            <b style={{ color: "var(--danger)" }}>Urgent or unsafe?</b> Please also phone{onCall?.phone ? <> {onCall.name} (on call): <a href={`tel:${onCall.phone.replace(/[^+0-9]/g, "")}`} style={{ fontWeight: 800 }}>{onCall.phone}</a></> : <> the site: <a href={`tel:${location.phone.replace(/[^+0-9]/g, "")}`} style={{ fontWeight: 800 }}>{location.phone}</a></>}. For fire or injury call 999.
          </div>
        )}
        {error && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{error}</div>}
        <PrimaryButton onClick={() => !busy && submit()}><Send size={15} /> {busy ? "Sending…" : "Send request"}</PrimaryButton>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Open issues for this {device.name.length > 24 ? "service" : device.name} ({recent.length})</div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--faint)" }}>No open issues right now.</div>
        ) : recent.map((w) => (
          <div key={w.id} style={{ background: "var(--card)", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--text)" }}>{w.description}</div>
              <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>Ref {w.id.slice(-6).toUpperCase()} · {fmtDate(w.dateRaised)}</div>
            </div>
            <WorkStatusTag status={w.status} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   Engineer visit report from the service's QR code — saved for the site team to review.
--------------------------------------------------------- */
function EngineerReport({ device, onBack }) {
  const [name, setName] = useState(""); const [company, setCompany] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [arrived, setArrived] = useState(""); const [left, setLeft] = useState("");
  const [notes, setNotes] = useState(""); const [photos, setPhotos] = useState([]);
  const [checks, setChecks] = useState((device.checklist || []).map((item) => ({ item, result: "", value: "" })));
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState("");
  async function addPhotos(e) { const fs = [...(e.target.files || [])].slice(0, 3 - photos.length); e.target.value = ""; setBusy(true); try { const out = await Promise.all(fs.map((f) => compressImage(f, 720, 0.6))); setPhotos((p) => [...p, ...out].slice(0, 3)); } catch (x) { /* ignore */ } setBusy(false); }
  async function send() {
    if (!name.trim()) { setErr("Please enter your name."); return; }
    if (!notes.trim() && !checks.some((c) => c.result)) { setErr("Please describe the work done or complete the checklist."); return; }
    setBusy(true); setErr("");
    try {
      await publicWrite("engineer", device.id, { name: name.trim(), company: company.trim(), date, arrived, left, notes: notes.trim(), checks: checks.filter((c) => c.result), photos });
      setDone(true);
    } catch (e) { setErr(e.message || "Couldn't send — please try again."); }
    setBusy(false);
  }
  if (done) return (
    <div style={{ background: "var(--card)", borderRadius: 12, padding: 20, textAlign: "center" }}>
      <CheckCircle2 size={44} color="var(--ok)" />
      <div style={{ fontSize: 18, fontWeight: 750, marginTop: 6 }}>Thanks — report sent</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>The site team will review it and log the visit. Please still send your certificate or report to them as usual.</div>
      <button onClick={onBack} style={{ marginTop: 12, background: "none", border: "none", color: "var(--accent)", fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
    </div>
  );
  const resBtn = (i, r, label) => <button type="button" onClick={() => setChecks((p) => p.map((c, j) => j === i ? { ...c, result: c.result === r ? "" : r } : c))} style={{ background: checks[i].result === r ? (r === "pass" ? "var(--ok)" : r === "fail" ? "var(--danger)" : "var(--muted)") : "var(--card-hi)", color: checks[i].result === r ? "#fff" : "var(--text-2)", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>;
  return (
    <div style={{ background: "var(--card)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 750 }}><Wrench size={16} /> Engineer visit report</div>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Arrived"><TextInput type="time" value={arrived} onChange={(e) => setArrived(e.target.value)} /></Field>
        <Field label="Left"><TextInput type="time" value={left} onChange={(e) => setLeft(e.target.value)} /></Field>
      </div>
      {checks.length > 0 && (
        <Field label="Checklist">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {checks.map((c, i) => (
              <div key={i} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{checklistLabel(c.item)}</div>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>{resBtn(i, "pass", "Pass")}{resBtn(i, "fail", "Fail")}{resBtn(i, "na", "N/A")}
                  {/\{/.test(c.item) && <TextInput value={c.value} onChange={(e) => setChecks((p) => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="reading" style={{ width: 80, padding: "5px 7px" }} />}
                </div>
              </div>
            ))}
          </div>
        </Field>
      )}
      <Field label="Work done / findings"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Filters changed, belts tensioned. Recommend replacing fan bearing within 3 months." /></Field>
      <Field label={`Photos (${photos.length}/3)`}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 70, height: 70, borderRadius: 8, objectFit: "cover" }} />)}
          {photos.length < 3 && <label style={{ width: 70, height: 70, borderRadius: 8, border: "1.5px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{busy ? <Loader2 size={16} /> : <Camera size={18} color="var(--faint)" />}<input type="file" accept="image/*" multiple capture="environment" onChange={addPhotos} style={{ display: "none" }} /></label>}
        </div>
      </Field>
      {err && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{err}</div>}
      <PrimaryButton onClick={() => !busy && send()}><Send size={15} /> {busy ? "Sending…" : "Send visit report"}</PrimaryButton>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Back to reporting a problem</button>
    </div>
  );
}
