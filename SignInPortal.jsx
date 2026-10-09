// Public contractor/visitor self sign-in page, opened from a QR code at reception (?signin=<locationId>).
import { useEffect, useState } from "react";
import { publicRead, publicWrite } from "../lib/publicApi.js";
import { CheckCircle2, HardHat } from "lucide-react";
import { Field, TextInput, ToggleButton } from "./ui.jsx";
// Works like the "report a problem" page: no login needed. Reads and saves only through lib/publicApi.js.
// Signing out: the phone that signed in keeps a key; from another phone you're asked for the mobile number you gave.
const KEYS = "ppm:signinKeys";
const readKeys = () => { try { return JSON.parse(localStorage.getItem(KEYS) || "{}"); } catch (e) { return {}; } };
const keepKey = (id, k) => { try { const m = readKeys(); m[id] = k; const ids = Object.keys(m).slice(-50); localStorage.setItem(KEYS, JSON.stringify(Object.fromEntries(ids.map((i) => [i, m[i]])))); } catch (e) { /* ignore */ } };

export function SignInPortal({ locationId }) {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [onSite, setOnSite] = useState([]);
  const [rules, setRules] = useState("");
  const [video, setVideo] = useState("");
  const [mode, setMode] = useState("in");
  const [kind, setKind] = useState("contractor");
  const [name, setName] = useState(""); const [company, setCompany] = useState(""); const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState(""); const [host, setHost] = useState(""); const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  async function refresh() {
    let r;
    try { r = await publicRead("signin", locationId); setLoadError(""); }
    catch (e) { setLoadError("Can't connect right now — check your signal and try again."); setLoading(false); return; }
    const loc = r?.location || null; const info = r?.info || {};
    setLocation(loc);
    setSuppliers(r?.suppliers || []);
    setOnSite(r?.onSite || []);
    setRules(loc?.induction || [info.access, info.notes].filter(Boolean).join("\n"));
    setVideo(loc?.inductionUrl || "");
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [locationId]);
  async function signIn() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!agree) { setError("Please confirm you've read the site safety information."); return; }
    setBusy(true); setError("");
    try {
      const r = await publicWrite("signin", locationId, { kind, name: name.trim(), company: company.trim(), phone: phone.trim(), purpose: purpose.trim(), host: host.trim() });
      if (r?.id && r.outKey) keepKey(r.id, r.outKey);
      setDone({ type: "in", name: name.trim() });
    } catch (e) { setError(e.message || "Couldn't sign you in — please try again."); }
    setBusy(false);
  }
  async function signOut(id) {
    setBusy(true); setError("");
    const send = (extra) => publicWrite("signout", locationId, { id, outKey: readKeys()[id] || "", ...extra });
    try {
      let r = await send({});
      if (r?.error === "NEEDPHONE") {
        const ph = window.prompt("To sign out from this phone, enter the mobile number you gave when you signed in:", "");
        if (ph === null) { setBusy(false); return; }
        r = await send({ phone: ph });
        if (r?.error === "NEEDPHONE") throw new Error("That number doesn't match the one given at sign-in. Please ask reception to sign you out.");
      }
      if (r?.error === "WAIT") throw new Error("Too many tries — please wait a minute, or ask reception to sign you out.");
      if (r?.error) throw new Error("Please sign out on the phone you signed in with, or ask reception.");
      setDone({ type: "out", name: r?.name || "" });
    } catch (e) { setError(e.message || "Couldn't sign you out — please try again."); refresh(); }
    setBusy(false);
  }
  const wrap = { minHeight: "100vh", background: "var(--ground)", color: "var(--text)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", display: "flex", justifyContent: "center", padding: 16 };
  const box = { width: "min(440px, 100%)", display: "flex", flexDirection: "column", gap: 12 };
  if (loading) return <div style={wrap}><div style={box}>Loading…</div></div>;
  if (loadError) return <div style={wrap}><div style={box}><h1 style={{ fontSize: 20 }}>No connection</h1><p>{loadError}</p><button onClick={() => { setLoading(true); refresh(); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 12, padding: "12px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button></div></div>;
  if (!location) return <div style={wrap}><div style={box}><h1 style={{ fontSize: 20 }}>Site not found</h1><p>This sign-in code isn't linked to a site any more. Please ask reception.</p></div></div>;
  if (done) return (
    <div style={wrap}><div style={{ ...box, alignItems: "center", textAlign: "center", paddingTop: 40 }}>
      <CheckCircle2 size={56} color="var(--ok)" />
      <h1 style={{ fontSize: 22, margin: 0 }}>{done.type === "in" ? `Welcome, ${done.name.split(" ")[0]}` : `Goodbye, ${done.name.split(" ")[0]}`}</h1>
      <p style={{ color: "var(--muted)", margin: 0 }}>{done.type === "in" ? `You're signed in at ${location.name}. Please scan again and choose "Signing out" when you leave.` : "You're signed out. Thanks for visiting."}</p>
      <button onClick={() => { setDone(null); setName(""); setCompany(""); setPurpose(""); setHost(""); setAgree(false); refresh(); }} style={{ marginTop: 10, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 12, padding: "12px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
    </div></div>
  );
  return (
    <div style={wrap}><div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--head)", display: "flex", alignItems: "center", justifyContent: "center" }}><HardHat size={22} color="#F2B45A" /></div>
        <div><div style={{ fontSize: 19, fontWeight: 750 }}>{location.name}</div><div style={{ fontSize: 13, color: "var(--muted)" }}>Contractor & visitor sign-in</div></div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <ToggleButton active={mode === "in"} onClick={() => setMode("in")}>Signing in</ToggleButton>
        <ToggleButton active={mode === "out"} onClick={() => setMode("out")}>Signing out ({onSite.length})</ToggleButton>
      </div>
      {mode === "out" ? (
        <div className="bcard" style={{ gap: 8 }}>
          {onSite.length === 0 && <div className="bsub">Nobody is signed in right now.</div>}
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
          {onSite.map((x) => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 650 }}>{x.name}</div><div className="bsub">{x.company || (x.kind === "visitor" ? "Visitor" : "")}</div></div>
              {x.selfOut === false && !x.needsPhone && !readKeys()[x.id] ? <span className="bsub">Ask reception</span>
                : <button disabled={busy} onClick={() => signOut(x.id)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bcard" style={{ gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <ToggleButton active={kind === "contractor"} onClick={() => setKind("contractor")}>Contractor</ToggleButton>
            <ToggleButton active={kind === "visitor"} onClick={() => setKind("visitor")}>Visitor</ToggleButton>
          </div>
          <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label="Company">
            <TextInput list="ss-co" value={company} onChange={(e) => setCompany(e.target.value)} />
            <datalist id="ss-co">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </Field>
          <Field label="Mobile"><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          {kind === "contractor" ? <Field label="What are you working on?"><TextInput value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Boiler service" /></Field>
            : <Field label="Who are you visiting?"><TextInput value={host} onChange={(e) => setHost(e.target.value)} /></Field>}
          <div style={{ background: "var(--warn-soft)", borderRadius: 10, padding: 10, fontSize: 13 }}>
            <b>Before you go in</b>
            {video && <a href={video} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontWeight: 700, color: "var(--accent)" }}>▶ Watch the site induction video</a>}
            <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{rules || "In an emergency, leave by the nearest fire exit and go to the assembly point. Report to reception before starting any work. Hot works, roof access and isolations need a permit."}</div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 20, height: 20, margin: 0 }} /> I've read and understood this</label>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
          <button disabled={busy} onClick={signIn} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 12, padding: "14px 18px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
      )}
    </div></div>
  );
}
