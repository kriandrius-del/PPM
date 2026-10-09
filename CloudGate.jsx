// Sign-in, company setup and invites — shown before the app when it runs with a database (cloud mode).
// Everything here talks to window.ppmCloud (storage-shim.js); the database enforces who can see what.
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Copy, Database, KeyRound, Loader2, Lock, LogOut, Mail, RefreshCw, UploadCloud, UserCheck, Users, WifiOff } from "lucide-react";
import { Field, PrimaryButton, TextInput } from "./ui.jsx";
import { INVITE_ROLES, ROLES } from "../app/permissions.js";
import { PRODUCT_NAME } from "../lib/constants.js";

const page = { minHeight: "100vh", background: "var(--head)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: "var(--text)" };
const cardS = { background: "var(--card)", borderRadius: 16, padding: 24, width: "min(420px, 100%)", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 10px 40px rgba(0,0,0,.25)" };
const linkBtn = { background: "none", border: "none", color: "var(--accent)", fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0, fontSize: 12.5 };
const subBtn = { background: "var(--card-hi)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
const note = (tone) => ({ fontSize: 12.5, borderRadius: 9, padding: "8px 10px", background: tone === "ok" ? "var(--ok-soft)" : tone === "warn" ? "var(--warn-soft)" : "var(--danger-soft)", color: tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--text-2)" : "var(--danger)" });

function Brand({ sub, icon: I = Lock }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: "#D97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I size={21} color="#fff" /></div>
      <div><div style={{ fontSize: 17, fontWeight: 750 }}>{PRODUCT_NAME}</div><div style={{ fontSize: 12.5, color: "var(--faint)" }}>{sub}</div></div>
    </div>
  );
}

// Friendlier wording for the messages Supabase sends back.
function friendly(e) {
  const m = String(e?.message || e || "Something went wrong");
  if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first — open the link we sent you, then sign in.";
  if (/already registered|already exists/i.test(m)) return "There's already an account with this email — sign in instead (or reset your password).";
  if (/not authorized|error sending|sending (confirmation|recovery|magic)/i.test(m)) return "The confirmation email couldn't be sent. Your admin needs to set up email sending in Supabase (Authentication → Emails → SMTP) — see GOING-LIVE.md.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts — please wait a minute and try again.";
  if (/password/i.test(m) && /least|short|weak/i.test(m)) return "Please choose a longer password (at least 8 characters).";
  if (/offline|failed to fetch|network/i.test(m)) return "Can't reach the database — check your internet connection.";
  return m;
}

export function CloudGate({ children }) {
  const cloud = window.ppmCloud;
  const [st, setSt] = useState(null);      // a copy of cloud.state after each step
  const [step, setStep] = useState(null);  // after creating a company: "claim" (old data waiting in the database), then "import" (data in this browser)
  const [toast, setToast] = useState("");
  const [expired, setExpired] = useState(false);

  async function load() {
    setSt(null);
    const s = await cloud.init();
    setSt({ ...s });
    if (s.notice) { setToast(s.notice); setTimeout(() => setToast(""), 5000); }
    return s;
  }
  useEffect(() => {
    load();
    // a confirm / reset link opened in a tab where the app is already showing
    const onHash = () => { if (/access_token=|error_description=/.test(window.location.hash)) load(); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => setExpired(true);
    window.addEventListener("ppm-signedout", on);
    return () => window.removeEventListener("ppm-signedout", on);
  }, []);

  if (!st) return <div style={page}><Loader2 size={26} color="#fff" style={{ animation: "spin 1s linear infinite" }} /></div>;
  if (st.status === "ready" && !step) {
    return (
      <>
        {children}
        {toast && <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "var(--head)", color: "#fff", padding: "10px 16px", borderRadius: 12, fontSize: 13.5, fontWeight: 650, zIndex: 9999, boxShadow: "0 6px 24px rgba(0,0,0,.3)" }}>{toast}</div>}
        {expired && <SignInAgain email={st.user?.email} onDone={() => { setExpired(false); cloud.flush(); }} />}
      </>
    );
  }
  const afterCreate = async () => {
    const s = await load();
    if (s.status !== "ready") return;
    if (await cloud.legacyWaiting()) { setStep("claim"); return; }
    if (cloud.localDataCount() > 0 && !(await cloud.orgHasData().catch(() => true))) setStep("import");
  };
  if (step === "claim") return <ClaimOldData onDone={() => window.location.reload()} onSkip={async () => { setStep(null); if (cloud.localDataCount() > 0 && !(await cloud.orgHasData().catch(() => true))) setStep("import"); }} />;
  if (step === "import") return <ImportLocal onDone={() => setStep(null)} />;
  if (st.status === "recovery") return <NewPassword onDone={load} />;
  if (st.status === "linkCheck") return <LinkCheck st={st} onContinue={async () => { setSt(null); const s = await cloud.afterSignIn(); setSt({ ...s }); }} />;
  if (st.status === "invite") return <InviteConfirm st={st} onDone={(s) => { setSt({ ...s }); if (s.notice) { setToast(s.notice); setTimeout(() => setToast(""), 5000); } }} />;
  if (st.status === "noOrg") return <NoCompany st={st} onCreated={afterCreate} onJoined={load} />;
  if (st.status === "offline") {
    return (
      <div style={page}><div style={cardS}>
        <Brand sub="Can't connect" icon={WifiOff} />
        <div style={note("err")}>{st.error || "Can't reach the database — check your internet connection."}</div>
        <PrimaryButton onClick={load}><RefreshCw size={15} /> Try again</PrimaryButton>
        <button onClick={() => cloud.signOut()} style={{ ...linkBtn, color: "var(--faint)" }}>Sign out</button>
      </div></div>
    );
  }
  return <SignIn st={st} onSignedIn={load} />;
}

/* ---------- sign in / create account / forgot password ---------- */
function SignIn({ st, onSignedIn }) {
  const cloud = window.ppmCloud;
  const [mode, setMode] = useState(st.hasInvite ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState(st.error ? { tone: "err", text: friendly(st.error) } : null);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    const e = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setMsg({ tone: "err", text: "Enter your email address." }); return; }
    if (mode !== "reset" && !password) { setMsg({ tone: "err", text: "Enter your password." }); return; }
    if (mode === "signup" && password.length < 8) { setMsg({ tone: "err", text: "Choose a password of at least 8 characters." }); return; }
    if (mode === "signup" && password !== password2) { setMsg({ tone: "err", text: "The two passwords don't match." }); return; }
    setBusy(true); setMsg(null);
    try {
      if (mode === "reset") { await cloud.reset(e); setMsg({ tone: "ok", text: `If ${e} has an account, a link to choose a new password is on its way. Check your inbox (and junk folder).` }); }
      else if (mode === "signup") {
        const r = await cloud.signUp(e, password);
        if (r.session) { await onSignedIn(); return; }
        setMode("signin"); setPassword(""); setPassword2("");
        setMsg({ tone: "ok", text: `Account created. We've emailed ${e} — open the link to confirm your address, then sign in here.` });
      } else { await cloud.signIn(e, password); await onSignedIn(); return; }
    } catch (x) { setMsg({ tone: "err", text: friendly(x) }); }
    setBusy(false);
  }
  const enter = (ev) => { if (ev.key === "Enter") go(); };
  return (
    <div style={page}><div style={cardS}>
      <Brand sub={mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to continue"} />
      {st.hasInvite && <div style={note("warn")}><b>You've been invited to join a team.</b> Sign in — or create an account — with the email address the invite was sent to.</div>}
      <Field label="Email"><TextInput type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={enter} autoComplete="email" /></Field>
      {mode !== "reset" && <Field label="Password"><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={enter} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></Field>}
      {mode === "signup" && <Field label="Password again"><TextInput type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} onKeyDown={enter} autoComplete="new-password" /></Field>}
      {msg && <div style={note(msg.tone)}>{msg.text}</div>}
      <PrimaryButton onClick={go}>{busy ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Please wait…</> : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</PrimaryButton>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMsg(null); }} style={linkBtn}>{mode === "signup" ? "I already have an account" : "Create an account"}</button>
        <button onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setMsg(null); }} style={{ ...linkBtn, color: "var(--faint)" }}>{mode === "reset" ? "Back to sign in" : "Forgot password?"}</button>
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>Each person signs in with their own email. Your company's data is only visible to people your admin has invited.</div>
    </div></div>
  );
}

/* ---------- after a reset link: choose a new password ---------- */
function NewPassword({ onDone }) {
  const cloud = window.ppmCloud;
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    if (pw.length < 8) { setMsg("Choose a password of at least 8 characters."); return; }
    if (pw !== pw2) { setMsg("The two passwords don't match."); return; }
    setBusy(true); setMsg("");
    try { await cloud.setPassword(pw); await onDone(); } catch (e) { setMsg(friendly(e)); setBusy(false); }
  }
  return (
    <div style={page}><div style={cardS}>
      <Brand sub="Choose a new password" icon={KeyRound} />
      <Field label="New password"><TextInput type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
      <Field label="New password again"><TextInput type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} autoComplete="new-password" /></Field>
      {msg && <div style={note("err")}>{msg}</div>}
      <PrimaryButton onClick={() => !busy && save()}>{busy ? "Saving…" : "Save new password"}</PrimaryButton>
    </div></div>
  );
}

/* ---------- signed in, but not in a company yet ---------- */
function NoCompany({ st, onCreated, onJoined }) {
  const cloud = window.ppmCloud;
  const [name, setName] = useState(""); const [link, setLink] = useState("");
  const [msg, setMsg] = useState(st.error ? friendly(st.error) : ""); const [busy, setBusy] = useState("");
  async function create() {
    if (!name.trim()) { setMsg("Enter your company name."); return; }
    setBusy("create"); setMsg("");
    try { await cloud.createOrg(name.trim()); await onCreated(); } catch (e) { setMsg(friendly(e)); setBusy(""); }
  }
  async function join() {
    if (!link.trim()) { setMsg("Paste the invite link from your email."); return; }
    setBusy("join"); setMsg("");
    try { await cloud.acceptInvite(link.trim()); await onJoined(); } catch (e) { setMsg(friendly(e)); setBusy(""); }
  }
  return (
    <div style={page}><div style={{ ...cardS, width: "min(460px, 100%)" }}>
      <Brand sub={`Signed in as ${st.user?.email || ""}`} icon={Building2} />
      <div style={{ background: "var(--card-hi)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 750 }}>Setting up for your team?</div>
        <Field label="Company name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder="e.g. Bedfont Lakes FM" /></Field>
        <PrimaryButton onClick={() => !busy && create()}>{busy === "create" ? "Creating…" : "Create company"}</PrimaryButton>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>You'll be the owner and can invite your team. If your team used {PRODUCT_NAME} before logins were turned on, you'll be shown how to move that data into your company.</div>
      </div>
      <div style={{ background: "var(--card-hi)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 750, display: "flex", alignItems: "center", gap: 6 }}><Mail size={15} /> Joining your team?</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Open the invite link from your email — or paste it here.</div>
        <div style={{ display: "flex", gap: 6 }}>
          <TextInput value={link} onChange={(e) => setLink(e.target.value)} placeholder="Invite link" style={{ flex: 1 }} />
          <button onClick={() => !busy && join()} style={{ ...subBtn, padding: "0 14px" }}>{busy === "join" ? "…" : "Join"}</button>
        </div>
      </div>
      {msg && <div style={note("err")}>{msg}</div>}
      <button onClick={() => cloud.signOut()} style={{ ...linkBtn, color: "var(--faint)", display: "flex", alignItems: "center", gap: 5, alignSelf: "center" }}><LogOut size={13} /> Sign out</button>
    </div></div>
  );
}

/* ---------- new company + this browser still holds data from before ---------- */
function ImportLocal({ onDone }) {
  const cloud = window.ppmCloud;
  const n = cloud.localDataCount();
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function go() {
    setBusy(true); setMsg("");
    try { const k = await cloud.copyLocalData(); setMsg(`Copied ${k} lists.`); setTimeout(onDone, 600); }
    catch (e) { setMsg(friendly(e)); setBusy(false); }
  }
  return (
    <div style={page}><div style={cardS}>
      <Brand sub="Bring your data across" icon={UploadCloud} />
      <div style={{ fontSize: 13.5 }}>This browser still has data saved before you signed in (<b>{n}</b> lists — services, visits, suppliers, budget…). Copy it into your new company so your team can see it?</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>Photos and certificates are moved into private file storage as they're copied. Nothing is deleted from this browser.</div>
      {msg && <div style={note(/Copied/.test(msg) ? "ok" : "err")}>{msg}</div>}
      <PrimaryButton onClick={() => !busy && go()}>{busy ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Copying…</> : "Copy my data in"}</PrimaryButton>
      <button disabled={busy} onClick={onDone} style={subBtn}>Start with an empty company</button>
    </div></div>
  );
}

/* ---------- sign-in expired while working: changes are kept and sent after signing in ---------- */
function SignInAgain({ email, onDone }) {
  const cloud = window.ppmCloud;
  const [pw, setPw] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setMsg("");
    try { await cloud.signIn(email, pw); onDone(); } catch (e) { setMsg(friendly(e)); setBusy(false); }
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,22,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20 }}>
      <div style={cardS}>
        <Brand sub="Please sign in again" />
        <div style={{ fontSize: 13 }}>Your sign-in has expired. Your latest changes are kept on this device and will be saved as soon as you sign in.</div>
        <Field label="Email"><TextInput value={email || ""} readOnly /></Field>
        <Field label="Password"><TextInput type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} autoComplete="current-password" /></Field>
        {msg && <div style={note("err")}>{msg}</div>}
        <PrimaryButton onClick={() => !busy && go()}>{busy ? "Signing in…" : "Sign in"}</PrimaryButton>
        <button onClick={() => cloud.signOut()} style={{ ...linkBtn, color: "var(--faint)" }}>Sign out instead</button>
      </div>
    </div>
  );
}

/* ---------- an email link signed you in: say who as, before going on ---------- */
function LinkCheck({ st, onContinue }) {
  const cloud = window.ppmCloud;
  const lc = st.linkCheck || {};
  return (
    <div style={page}><div style={cardS}>
      <Brand sub="Email confirmed" icon={UserCheck} />
      <div style={{ fontSize: 14 }}>You're signed in as <b>{lc.email}</b>.</div>
      {lc.prevEmail && lc.prevEmail !== lc.email && <div style={note("warn")}>This browser was signed in as <b>{lc.prevEmail}</b> before you opened the link.</div>}
      <PrimaryButton onClick={onContinue}>Continue as {lc.email}</PrimaryButton>
      <button onClick={() => cloud.signOut(true)} style={{ ...linkBtn, color: "var(--faint)", alignSelf: "center" }}>That's not me — sign out</button>
    </div></div>
  );
}

/* ---------- an invite link: ask before joining ---------- */
const ROLE_NAME = Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.label])); ROLE_NAME.editor = ROLES.manager.label;
function InviteConfirm({ st, onDone }) {
  const cloud = window.ppmCloud;
  const inv = st.invite || {};
  const mismatch = inv.email && st.user?.email && inv.email.toLowerCase() !== st.user.email.toLowerCase();
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function join() { setBusy(true); setMsg(""); try { onDone(await cloud.acceptPendingInvite()); } catch (e) { setMsg(friendly(e)); setBusy(false); } }
  return (
    <div style={page}><div style={cardS}>
      <Brand sub="You've been invited" icon={Users} />
      <div style={{ fontSize: 14 }}>Join <b>{inv.org}</b> as <b>{ROLE_NAME[inv.role] || inv.role}</b>?</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Signed in as {st.user?.email}.</div>
      {mismatch && <div style={note("warn")}>This invite was sent to <b>{inv.email}</b>. Sign out and sign in (or create an account) with that address to accept it.</div>}
      {msg && <div style={note("err")}>{msg}</div>}
      {!mismatch && <PrimaryButton onClick={() => !busy && join()}>{busy ? "Joining…" : `Join ${inv.org}`}</PrimaryButton>}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button disabled={busy} onClick={async () => onDone(await cloud.declineInvite())} style={{ ...linkBtn, color: "var(--faint)" }}>No thanks</button>
        <button onClick={() => cloud.signOut()} style={{ ...linkBtn, color: "var(--faint)" }}>Sign out</button>
      </div>
    </div></div>
  );
}

/* ---------- data from before logins: moved in by the owner with one line in Supabase ---------- */
function ClaimSteps() {
  const cloud = window.ppmCloud;
  const line = cloud.claimSql();
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(line); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) { window.prompt("Copy this line:", line); } };
  return (
    <>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.8, display: "flex", flexDirection: "column", gap: 5 }}>
        <li>Open your project at <b>supabase.com</b> → <b>SQL Editor</b> → New query.</li>
        <li>Paste this line and press <b>Run</b>:</li>
      </ol>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <code style={{ flex: 1, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: "var(--card-hi)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", wordBreak: "break-all" }}>{line}</code>
        <button onClick={copy} style={{ ...subBtn, padding: "0 12px" }}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>It moves the old data into the company you own. Only someone who can log in to your Supabase project can run it — that's what keeps the data safe.</div>
    </>
  );
}
function ClaimOldData({ onDone, onSkip }) {
  const cloud = window.ppmCloud;
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function check() {
    setBusy(true); setMsg("");
    if (await cloud.legacyWaiting()) { setMsg("The data hasn't moved yet — run the line in Supabase first (it should say \"Moved … lists\")."); setBusy(false); return; }
    onDone();
  }
  return (
    <div style={page}><div style={{ ...cardS, width: "min(480px, 100%)" }}>
      <Brand sub="Bring in your existing data" icon={Database} />
      <div style={{ fontSize: 13.5 }}>Your database still holds the data saved before logins were turned on. To move it into <b>{cloud.state.org?.name}</b>:</div>
      <ClaimSteps />
      {msg && <div style={note("err")}>{msg}</div>}
      <PrimaryButton onClick={() => !busy && check()}>{busy ? "Checking…" : "I've run it — continue"}</PrimaryButton>
      <button disabled={busy} onClick={onSkip} style={subBtn}>Skip — start with an empty company</button>
    </div></div>
  );
}

/* ---------- Team & access (inside the app: More → Team & access) ---------- */
const ROLE_LABEL = ROLE_NAME;
const ROLE_HELP = Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.desc.replace(/\.$/, "")])); ROLE_HELP.editor = ROLE_HELP.manager;
export function TeamPanel() {
  const cloud = window.ppmCloud;
  const st = cloud.state;
  const isAdmin = ["owner", "admin"].includes(st.org?.role);
  const [team, setTeam] = useState(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState(""); const [role, setRole] = useState("manager");
  const [made, setMade] = useState(null); const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(""); const [rename, setRename] = useState(null);
  const [newCo, setNewCo] = useState(null);
  const localN = cloud.localDataCount();
  const [legacy, setLegacy] = useState(false);
  async function reload() { try { setTeam(await cloud.team()); setErr(""); } catch (e) { setErr(friendly(e)); } }
  useEffect(() => { reload(); if (st.org?.role === "owner") cloud.legacyWaiting().then(setLegacy); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500); } catch (e) { window.prompt("Copy this link:", text); } };
  const mailto = (to, link, r) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Join ${st.org.name} on ${PRODUCT_NAME}`)}&body=${encodeURIComponent(`Hi,\n\nYou've been invited to ${st.org.name} on ${PRODUCT_NAME} as ${ROLE_LABEL[r] || r}.\n\nOpen this link and create an account (or sign in) with this email address (${to}):\n${link}\n\nThe link works once and expires in 14 days.\n`)}`;
  async function act(fn) { setBusy(true); setErr(""); try { await fn(); await reload(); } catch (e) { setErr(friendly(e)); } setBusy(false); }
  async function invite() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter their email address."); return; }
    await act(async () => { const r = await cloud.invite(email.trim(), role); setMade({ email: email.trim().toLowerCase(), role, link: r.link }); setEmail(""); });
  }
  const box = { background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 };
  const small = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", color: "var(--accent)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Building2 size={16} />
          {rename === null ? <div style={{ fontSize: 14, fontWeight: 750, flex: 1 }}>{st.org.name}</div>
            : <TextInput autoFocus value={rename} onChange={(e) => setRename(e.target.value)} style={{ flex: 1 }} />}
          {isAdmin && (rename === null ? <button onClick={() => setRename(st.org.name)} style={small}>Rename</button>
            : <button disabled={busy} onClick={() => act(async () => { await cloud.renameOrg(rename); setRename(null); })} style={small}>Save</button>)}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>Signed in as <b>{st.user?.email}</b> · {ROLE_LABEL[st.org.role]}{st.org.role !== "owner" && ` — ${ROLE_HELP[st.org.role]}`}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => cloud.signOut()} style={{ ...small, color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }}><LogOut size={12} /> Sign out</button>
          {st.orgs.length > 1 && st.orgs.filter((o) => o.org_id !== st.org.id).map((o) => <button key={o.org_id} onClick={() => cloud.switchOrg(o.org_id)} style={small}>Switch to {o.name}</button>)}
          {st.org.role !== "owner" && <button onClick={() => { if (window.confirm(`Leave ${st.org.name}? You'll lose access straight away.`)) cloud.leave().catch((e) => setErr(friendly(e))); }} style={{ ...small, color: "var(--faint)" }}>Leave company</button>}
          {newCo === null ? <button onClick={() => setNewCo("")} style={{ ...small, color: "var(--faint)" }}>Set up another company</button> : (
            <span style={{ display: "flex", gap: 5, flex: "1 1 100%" }}>
              <TextInput autoFocus value={newCo} onChange={(e) => setNewCo(e.target.value)} placeholder="New company name" style={{ flex: 1, padding: "6px 8px" }} />
              <button disabled={busy || !newCo.trim()} onClick={() => act(async () => { const id = await cloud.createOrg(newCo.trim()); cloud.switchOrg(id); })} style={small}>Create</button>
            </span>
          )}
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 13.5, fontWeight: 750, display: "flex", alignItems: "center", gap: 6 }}><Users size={15} /> Team {team ? `(${team.members.length})` : ""}</div>
        {!team && !err && <div style={{ fontSize: 12, color: "var(--faint)" }}>Loading…</div>}
        {team?.members.map((m) => (
          <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card)", borderRadius: 9, padding: "7px 9px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.8, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}{m.me ? " (you)" : ""}</div>
              <div style={{ fontSize: 10.5, color: "var(--faint)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>since {String(m.since || "").slice(0, 10)}</span>
                {/* Approving quotes over the limit is its own permission: finance always, anyone else only when an admin ticks it */}
                {m.role === "finance" ? <span style={{ color: "var(--ok)", fontWeight: 650 }}>Approves quotes (finance)</span>
                  : ["director", "viewer"].includes(m.role) ? null
                  : isAdmin ? (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: m.can_approve ? "var(--ok)" : "var(--muted)", fontWeight: 650 }}>
                      <input type="checkbox" aria-label={`Approves quotes: ${m.email}`} disabled={busy} checked={!!m.can_approve} onChange={(e) => act(() => cloud.setApprover(m.user_id, e.target.checked))} /> Approves quotes
                    </label>
                  ) : m.can_approve ? <span style={{ color: "var(--ok)", fontWeight: 650 }}>Approves quotes</span> : null}
              </div>
            </div>
            {isAdmin && !m.me && m.role !== "owner" ? (
              <>
                <select aria-label={`Role for ${m.email}`} disabled={busy} value={m.role} onChange={(e) => act(() => cloud.setRole(m.user_id, e.target.value))} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 7, border: "1px solid var(--border)", fontFamily: "inherit", background: "var(--card)", color: "var(--text)" }}>
                  {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
                </select>
                <button disabled={busy} onClick={() => { if (window.confirm(`Remove ${m.email} from ${st.org.name}? They lose access straight away.`)) act(() => cloud.removeMember(m.user_id)); }} style={{ ...small, color: "var(--danger)" }}>Remove</button>
              </>
            ) : <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{ROLE_LABEL[m.role]}</span>}
          </div>
        ))}
        {team && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Approving quotes over the approval limit is separate from the role: finance always can, anyone else only when an admin ticks <b>Approves quotes</b>. Editing a job never lets someone approve it.</div>}
        {isAdmin && team?.invites.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Invited — waiting to join</div>}
        {isAdmin && team?.invites.map((i) => {
          const link = cloud.inviteLink(i.token);
          return (
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card)", borderRadius: 9, padding: "7px 9px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 12.5, fontWeight: 650 }}>{i.email}</div>
                <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{ROLE_LABEL[i.role]} · link expires {String(i.expires_at).slice(0, 10)}</div>
              </div>
              <button onClick={() => copy(link, i.id)} style={small}>{copied === i.id ? "Copied ✓" : "Copy link"}</button>
              <a href={mailto(i.email, link, i.role)} style={{ ...small, textDecoration: "none" }}>Email</a>
              <button disabled={busy} onClick={() => act(() => cloud.cancelInvite(i.id))} style={{ ...small, color: "var(--faint)" }}>Cancel</button>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div style={box}>
          <div style={{ fontSize: 13.5, fontWeight: 750, display: "flex", alignItems: "center", gap: 6 }}><Mail size={15} /> Invite someone</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") invite(); }} placeholder="their.name@company.com" style={{ flex: "1 1 180px" }} />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ fontSize: 13, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "inherit", background: "var(--card)", color: "var(--text)" }}>
              {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{ROLE_LABEL[role]} — {ROLE_HELP[role]}.</div>
          <PrimaryButton onClick={() => !busy && invite()}>Create invite link</PrimaryButton>
          {made && (
            <div style={{ ...note("ok"), display: "flex", flexDirection: "column", gap: 6 }}>
              <div><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Invite ready for <b>{made.email}</b>. Send them the link — it works once, for that email only.</div>
              <div style={{ display: "flex", gap: 6 }}>
                <a href={mailto(made.email, made.link, made.role)} style={{ ...small, textDecoration: "none" }}>Open email</a>
                <button onClick={() => copy(made.link, "made")} style={small}>{copied === "made" ? "Copied ✓" : "Copy link"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {legacy && (
        <div style={box}>
          <div style={{ fontSize: 13.5, fontWeight: 750, display: "flex", alignItems: "center", gap: 6 }}><Database size={15} /> Data from before logins is waiting</div>
          <ClaimSteps />
          <button onClick={() => window.location.reload()} style={{ ...small, alignSelf: "flex-start" }}>I've run it — reload</button>
        </div>
      )}
      {localN > 0 && isAdmin && <ImportFromBrowser n={localN} />}
      {err && <div style={note("err")}>{err}</div>}
      <div style={{ fontSize: 11, color: "var(--faint)" }}>Who can see and change what is enforced by the database, not just hidden in the app. QR stickers and supplier links still work without signing in, but only show and add what each page needs.</div>
    </div>
  );
}

function ImportFromBrowser({ n }) {
  const cloud = window.ppmCloud;
  const [state, setState] = useState("");
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Data saved in this browser</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>This browser still holds {n} lists saved before you signed in. Copying adds their records to {cloud.state.org.name}; where a record is in both, the company's version is kept.</div>
      <button disabled={!!state && state !== "error"} onClick={async () => { if (!window.confirm("Copy this browser's data into the company?")) return; setState("busy"); try { await cloud.copyLocalData(); setState("done"); setTimeout(() => window.location.reload(), 800); } catch (e) { setState("error"); } }} style={{ ...subBtn, alignSelf: "flex-start" }}>
        {state === "busy" ? "Copying…" : state === "done" ? "Copied ✓ — reloading" : state === "error" ? "Couldn't copy — try again" : "Copy into the company"}
      </button>
    </div>
  );
}
