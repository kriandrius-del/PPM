// Public 'report a problem' page (from QR stickers) and the personal sign-in screen.
import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, Camera, Send, Lock } from "lucide-react";
import { Field, PrimaryButton, Select, TextArea, TextInput, WorkStatusTag } from "./ui.jsx";
import { SKEYS } from "../lib/constants.js";
import { loadShared, saveShared } from "../lib/storage.js";
import { compressImage, fmtDate, uid } from "../lib/utils.js";

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

  async function refresh() {
    const [devices, locations, works] = await Promise.all([loadShared(SKEYS.devices), loadShared(SKEYS.locations), loadShared(SKEYS.works)]);
    const dev = devices.find((d) => d.id === deviceId) || null;
    setDevice(dev);
    setLocation(dev ? locations.find((l) => l.id === dev.locationId) || null : null);
    setRecent(works.filter((w) => w.deviceId === deviceId && w.status !== "completed" && w.status !== "rejected").slice(0, 8));
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
    const latest = await loadShared(SKEYS.works); // re-read so we don't overwrite someone else's change
    const record = {
      id: uid(), deviceId, description: description.trim(), quoteAmount: 0,
      dateRaised: new Date().toISOString().slice(0, 10), status: "requested", budgetType: "budgeted",
      photos: photo ? [photo] : [], priority, supplierId: device?.supplierId || null, comments: [],
      source: "request", requestedBy: name.trim(), requesterEmail: email.trim() || undefined, loggedAt: new Date().toISOString(),
    };
    await saveShared(SKEYS.works, [record, ...latest]);
    setSubmitted(record); setBusy(false);
    setDescription(""); setPhoto(null); setPriority("medium");
    refresh();
  }

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "var(--card-hi)", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", color: "var(--text)", padding: 16 }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ background: "var(--head)", color: "var(--on-accent)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#9AA5B1", fontWeight: 600 }}>Report a problem</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>{device ? device.name : "PPM Service Book"}</div>
          {location && <div style={{ fontSize: 12.5, color: "#C7D0DA", marginTop: 2 }}>{location.name}</div>}
        </div>
        {children}
      </div>
    </div>
  );
  if (loading) return shell(<div style={{ textAlign: "center", padding: 30, color: "var(--faint)" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>);
  if (!device) return shell(<div style={{ background: "var(--card)", borderRadius: 12, padding: 18, fontSize: 13.5 }}>This QR code doesn't match a service anymore — it may have been removed. Please let the facilities team know directly.</div>);
  return shell(
    <>
      {submitted && (
        <div style={{ background: "var(--ok-soft)", border: "1px solid #BFDCC9", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "var(--ok)", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} /> Thanks — your request was sent</div>
          <div style={{ fontSize: 12.5, color: "#3A5A46", marginTop: 4 }}>Reference <b>{submitted.id.slice(-6).toUpperCase()}</b>. You can check its status below any time by scanning the same code.</div>
        </div>
      )}
      <div style={{ background: "var(--card)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam from Finance" /></Field>
        <Field label="Your email (optional — for updates)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
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
        {error && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{error}</div>}
        <PrimaryButton onClick={submit}><Send size={15} /> Send request</PrimaryButton>
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
   Personal sign-in (when the shared database requires it)
--------------------------------------------------------- */
export function LoginScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!email.trim()) return;
    setBusy(true); setMsg("");
    try {
      if (mode === "reset") { await window.ppmAuth.reset(email.trim()); setMsg("If that email has an account, a reset link is on its way."); }
      else if (mode === "signup") { const r = await window.ppmAuth.signUp(email.trim(), password); if (r.session) window.location.reload(); else setMsg("Account created — check your email to confirm it, then sign in."); }
      else { await window.ppmAuth.signIn(email.trim(), password); window.location.reload(); }
    } catch (e) { setMsg(e.message || "Something went wrong"); }
    setBusy(false);
  }
  return (
    <div style={{ minHeight: "100vh", background: "var(--head)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, width: "min(380px, 100%)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={20} color="#fff" /></div>
          <div><div style={{ fontSize: 17, fontWeight: 750 }}>PPM Service Book</div><div style={{ fontSize: 12, color: "var(--faint)" }}>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to continue"}</div></div>
        </div>
        <Field label="Email"><TextInput type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        {mode !== "reset" && <Field label="Password"><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></Field>}
        {msg && <div style={{ fontSize: 12.5, color: /created|on its way/.test(msg) ? "var(--ok)" : "var(--danger)" }}>{msg}</div>}
        <PrimaryButton onClick={() => !busy && go()}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</PrimaryButton>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMsg(""); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{mode === "signup" ? "I have an account" : "Create an account"}</button>
          <button onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setMsg(""); }} style={{ background: "none", border: "none", color: "var(--faint)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{mode === "reset" ? "Back to sign in" : "Forgot password?"}</button>
        </div>
      </div>
    </div>
  );
}
