// Public contractor/visitor self sign-in page, opened from a QR code at reception (?signin=<locationId>).
import { useEffect, useState } from "react";
import { loadShared, saveShared } from "../lib/storage.js";
import { SKEYS } from "../lib/constants.js";
import { uid } from "../lib/utils.js";
import { CheckCircle2, HardHat } from "lucide-react";
import { Field, TextInput, ToggleButton } from "./ui.jsx";
// Works like the "report a problem" page: no login needed, saves straight to the shared register.

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
  async function refresh() {
    const [locs, sups, sis, st] = await Promise.all([loadShared(SKEYS.locations), loadShared(SKEYS.suppliers), loadShared(SKEYS.signins), loadShared(SKEYS.settings)]);
    const loc = (locs || []).find((l) => l.id === locationId) || null;
    setLocation(loc);
    setSuppliers((sups || []).filter((x) => x.locationId === locationId));
    setOnSite((sis || []).filter((x) => x.locationId === locationId && !x.outAt));
    const info = st && !Array.isArray(st) ? (st.siteInfo || {})[locationId] || {} : {};
    setRules(loc?.induction || [info.access, info.notes].filter(Boolean).join("\n"));
    setVideo(loc?.inductionUrl || "");
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [locationId]);
  async function signIn() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!agree) { setError("Please confirm you've read the site safety information."); return; }
    setBusy(true); setError("");
    const latest = await loadShared(SKEYS.signins);
    const entry = { id: uid(), locationId, kind, name: name.trim(), company: company.trim(), phone: phone.trim(), purpose: purpose.trim(), host: host.trim(), inducted: kind === "contractor" ? true : undefined, inductedAt: new Date().toISOString(), ramsChecked: false, inAt: new Date().toISOString(), outAt: null, by: "Self sign-in", selfService: true };
    await saveShared(SKEYS.signins, [entry, ...(latest || [])].slice(0, 2000));
    setDone({ type: "in", name: entry.name }); setBusy(false);
  }
  async function signOut(id) {
    setBusy(true);
    const latest = await loadShared(SKEYS.signins);
    const e = (latest || []).find((x) => x.id === id);
    await saveShared(SKEYS.signins, (latest || []).map((x) => x.id === id ? { ...x, outAt: new Date().toISOString(), outBy: "Self sign-out" } : x));
    setDone({ type: "out", name: e?.name || "" }); setBusy(false);
  }
  const wrap = { minHeight: "100vh", background: "var(--ground)", color: "var(--text)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", display: "flex", justifyContent: "center", padding: 16 };
  const box = { width: "min(440px, 100%)", display: "flex", flexDirection: "column", gap: 12 };
  if (loading) return <div style={wrap}><div style={box}>Loading…</div></div>;
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
          {onSite.map((x) => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 650 }}>{x.name}</div><div className="bsub">{x.company || (x.kind === "visitor" ? "Visitor" : "")}</div></div>
              <button disabled={busy} onClick={() => signOut(x.id)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
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
