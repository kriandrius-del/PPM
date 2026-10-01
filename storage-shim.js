/*
  window.storage only exists inside Claude's artifact preview.
  Outside Claude (e.g. on Vercel) this shim provides the same API.

  - By default, data is kept in this browser (localStorage).
  - If a shared database is connected (🕘 → Sharing), "shared" data is stored in a
    Supabase table so everyone sees the same data. Personal settings stay on the device.
  - Optional personal logins (Supabase Auth): each person signs in with email + password.
  - Simultaneous edits are merged record-by-record instead of one overwriting the other.
  - If the connection drops, changes are queued on the device and uploaded automatically.
*/
const REMOTE_CFG_KEY = "ppm:remote";
const SESSION_KEY = "ppm:session";
const PENDING_KEY = "ppm:pending";

function readJSON(k, fallback) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? fallback; } catch (e) { return fallback; } }
// Supabase keys set in Vercel (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) use the existing
// `kv_store` table (key, scope, value) — the same table the original storage-adapter.js used,
// so all existing data carries straight over. A manually connected database (🕘 → Sharing) uses `ppm_store`.
const ENV_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "";
const ENV_KEY = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";
function readRemoteConfig() {
  const c = readJSON(REMOTE_CFG_KEY, null);
  if (c && c.url && c.key) return c;
  if (ENV_URL && ENV_KEY) return { url: ENV_URL, key: ENV_KEY, table: "kv_store", env: true, auth: localStorage.getItem("ppm:authRequired") === "1" };
  return null;
}
function deviceId() {
  let id = localStorage.getItem("ppm_device_id");
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)); localStorage.setItem("ppm_device_id", id); }
  return id;
}

/* ---------- auth ---------- */
function makeAuth(cfg) {
  const base = cfg.url.replace(/\/+$/, "") + "/auth/v1";
  const h = { apikey: cfg.key, "Content-Type": "application/json" };
  const save = (d) => {
    const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), email: d.user?.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s)); return s;
  };
  const err = async (r) => { let m = `Error ${r.status}`; try { const j = await r.json(); m = j.error_description || j.msg || j.message || m; } catch (e) { /* */ } return new Error(m); };
  return {
    session() { return readJSON(SESSION_KEY, null); },
    async signIn(email, password) {
      const r = await fetch(`${base}/token?grant_type=password`, { method: "POST", headers: h, body: JSON.stringify({ email, password }) });
      if (!r.ok) throw await err(r); return save(await r.json());
    },
    async signUp(email, password) {
      const r = await fetch(`${base}/signup`, { method: "POST", headers: h, body: JSON.stringify({ email, password }) });
      if (!r.ok) throw await err(r);
      const d = await r.json();
      return d.access_token ? { session: save(d) } : { session: null };
    },
    async reset(email) { await fetch(`${base}/recover`, { method: "POST", headers: h, body: JSON.stringify({ email }) }); },
    async token() {
      let s = readJSON(SESSION_KEY, null);
      if (!s) return null;
      if (s.expires_at * 1000 - Date.now() < 60000) {
        const r = await fetch(`${base}/token?grant_type=refresh_token`, { method: "POST", headers: h, body: JSON.stringify({ refresh_token: s.refresh_token }) });
        if (!r.ok) { localStorage.removeItem(SESSION_KEY); return null; }
        s = save(await r.json());
      }
      return s.access_token;
    },
    signOut() { localStorage.removeItem(SESSION_KEY); },
  };
}

/* ---------- Supabase table client ---------- */
function makeRemote(cfg, auth, scope = "shared") {
  const kv = cfg.table === "kv_store";
  const base = cfg.url.replace(/\/+$/, "") + `/rest/v1/${kv ? "kv_store" : "ppm_store"}`;
  const space = (cfg.space || "default").trim() || "default";
  const k = (key) => (kv ? key : `${space}:${key}`);
  const sc = kv ? `&scope=eq.${encodeURIComponent(scope)}` : "";
  const headers = async () => {
    const tok = cfg.auth && auth ? await auth.token() : null;
    if (cfg.auth && auth && !tok) { const e = new Error("Signed out"); e.signedOut = true; throw e; }
    return { apikey: cfg.key, Authorization: `Bearer ${tok || cfg.key}`, "Content-Type": "application/json" };
  };
  const fail = (r) => { const e = new Error(`Shared database error ${r.status}`); e.status = r.status; return e; };
  return {
    async getOrNull(key) {
      const r = await fetch(`${base}?key=eq.${encodeURIComponent(k(key))}${sc}&select=value`, { headers: await headers() });
      if (!r.ok) throw fail(r);
      const rows = await r.json();
      return rows.length ? rows[0].value : null;
    },
    async set(key, value) {
      const row = kv ? { key: k(key), scope, value, updated_at: new Date().toISOString() } : { key: k(key), value, updated_at: new Date().toISOString() };
      const r = await fetch(kv ? `${base}?on_conflict=key,scope` : base, { method: "POST", headers: { ...(await headers()), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([row]) });
      if (!r.ok) throw fail(r);
    },
    async del(key) { await fetch(`${base}?key=eq.${encodeURIComponent(k(key))}${sc}`, { method: "DELETE", headers: await headers() }); },
    async list(prefix = "") {
      const r = await fetch(`${base}?key=like.${encodeURIComponent(k(prefix))}*${sc}&select=key`, { headers: await headers() });
      if (!r.ok) throw fail(r);
      return (await r.json()).map((x) => (kv ? x.key : x.key.slice(space.length + 1)));
    },
    async test() {
      const r = await fetch(`${base}?select=key&limit=1`, { headers: await headers() });
      if (!r.ok) throw new Error(r.status === 404 ? `Table ${kv ? "kv_store" : "ppm_store"} not found — run the setup SQL first.` : r.status === 401 ? "Key rejected — use the project's anon public key (or sign in)." : `Error ${r.status}`);
      return true;
    },
  };
}

/* ---------- 3-way merge of lists of records ---------- */
// base = what we last read, ours = what we're saving, theirs = what's in the database now.
function mergeLists(baseStr, oursStr, theirsStr) {
  let base, ours, theirs;
  try { base = JSON.parse(baseStr); ours = JSON.parse(oursStr); theirs = JSON.parse(theirsStr); } catch (e) { return oursStr; }
  const isRecList = (a) => Array.isArray(a) && a.every((x) => x && typeof x === "object" && "id" in x);
  if (!isRecList(ours) || !isRecList(theirs) || !isRecList(base)) return oursStr;
  const B = new Map(base.map((x) => [x.id, JSON.stringify(x)]));
  const T = new Map(theirs.map((x) => [x.id, x]));
  const O = new Map(ours.map((x) => [x.id, x]));
  const out = [];
  // New records added by someone else go first (lists are mostly newest-first).
  theirs.forEach((t) => { if (!O.has(t.id) && !B.has(t.id)) out.push(t); });
  ours.forEach((o) => {
    const b = B.get(o.id); const t = T.get(o.id);
    if (b === undefined) { out.push(o); return; }                 // we added it
    const oursChanged = JSON.stringify(o) !== b;
    if (!t) { if (oursChanged) out.push(o); return; }             // they deleted it: keep only if we edited it
    out.push(oursChanged ? o : t);                                // take whichever side changed it
  });
  return JSON.stringify(out);
}

if (typeof window !== "undefined" && !window.storage) {
  const prefix = (shared) => (shared ? "ppm:shared:" : "ppm:personal:");
  const cfg = readRemoteConfig();
  const auth = cfg ? makeAuth(cfg) : null;
  const remote = cfg ? makeRemote(cfg, auth) : null;
  const personalRemote = cfg && cfg.table === "kv_store" ? makeRemote(cfg, auth, deviceId()) : null;
  const needsLogin = !!(cfg && cfg.auth && !auth.session());
  const baseCache = new Map();
  let pending = readJSON(PENDING_KEY, {});
  const announcePending = () => window.dispatchEvent(new window.CustomEvent("ppm-pending", { detail: { count: Object.keys(pending).length } }));
  const savePending = () => { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); announcePending(); };
  const isNetworkError = (e) => !e.status && !e.signedOut; // fetch() threw: offline / DNS / CORS

  async function remoteSet(key, value) {
    const base = baseCache.get(key);
    if (base !== undefined) {
      const theirs = await remote.getOrNull(key);
      if (theirs !== null && theirs !== base && theirs !== value) {
        const merged = mergeLists(base, value, theirs);
        if (merged !== value) { value = merged; window.dispatchEvent(new window.CustomEvent("ppm-merged", { detail: { key, value } })); }
      }
    }
    await remote.set(key, value);
    baseCache.set(key, value);
  }
  async function flushPending() {
    const keys = Object.keys(pending);
    if (!keys.length || !remote) return;
    for (const key of keys) {
      try { await remoteSet(key, pending[key]); delete pending[key]; } catch (e) { if (isNetworkError(e)) break; delete pending[key]; }
    }
    savePending();
  }

  const local = {
    get(key, shared) { const v = localStorage.getItem(prefix(shared) + key); if (v === null) throw new Error("Key not found: " + key); return v; },
    set(key, value, shared) { localStorage.setItem(prefix(shared) + key, value); },
  };

  window.storage = {
    __local: !remote,
    __remote: !!remote,
    __needsLogin: needsLogin,
    __pendingCount: () => Object.keys(pending).length,
    async get(key, shared = false) {
      if (shared && remote) {
        if (pending[key] !== undefined) return { key, value: pending[key], shared };
        const v = await remote.getOrNull(key);
        if (v === null) throw new Error("Key not found: " + key);
        baseCache.set(key, v);
        return { key, value: v, shared };
      }
      if (!shared && personalRemote) {
        try { const v = await personalRemote.getOrNull(key); if (v !== null) { localStorage.setItem(prefix(false) + key, v); return { key, value: v, shared }; } } catch (e) { /* offline: fall back to this device */ }
      }
      return { key, value: local.get(key, shared), shared };
    },
    async set(key, value, shared = false) {
      if (shared && remote) {
        try { await remoteSet(key, value); if (pending[key] !== undefined) { delete pending[key]; savePending(); } }
        catch (e) { if (!isNetworkError(e)) throw e; pending[key] = value; savePending(); }
      } else {
        local.set(key, value, shared);
        if (!shared && personalRemote) personalRemote.set(key, value).catch(() => {});
      }
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      if (shared && remote) await remote.del(key); else localStorage.removeItem(prefix(shared) + key);
      return { key, deleted: true, shared };
    },
    async list(pfx = "", shared = false) {
      if (shared && remote) return { keys: await remote.list(pfx), prefix: pfx, shared };
      const p = prefix(shared); const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const kk = localStorage.key(i); if (kk && kk.startsWith(p + pfx)) keys.push(kk.slice(p.length)); }
      return { keys, prefix: pfx, shared };
    },
  };

  if (remote) {
    window.addEventListener("online", flushPending);
    setInterval(flushPending, 30000);
    setTimeout(flushPending, 3000);
  }

  window.ppmAuth = auth ? {
    email: auth.session()?.email || null,
    required: !!cfg.auth,
    signIn: (e, p) => auth.signIn(e, p), signUp: (e, p) => auth.signUp(e, p), reset: (e) => auth.reset(e),
    signOut() { auth.signOut(); window.location.reload(); },
  } : null;

  // Helpers for the Sharing screen.
  window.ppmRemote = {
    config: cfg,
    async test(c) { return makeRemote(c, null).test(); },
    async pushLocal(c) {
      const r = makeRemote(c, null); const p = prefix(true); let n = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const kk = localStorage.key(i);
        if (kk && kk.startsWith(p)) { await r.set(kk.slice(p.length), localStorage.getItem(kk)); n++; }
      }
      return n;
    },
    async pullToLocal(c) {
      const r = makeRemote(c, makeAuth(c)); const keys = await r.list(""); const p = prefix(true);
      for (const key of keys) { try { const v = await r.getOrNull(key); if (v !== null) localStorage.setItem(p + key, v); } catch (e) { /* skip */ } }
      return keys.length;
    },
    envMode: !!(cfg && cfg.env),
    connect(c) { localStorage.setItem(REMOTE_CFG_KEY, JSON.stringify(c)); },
    disconnect() { localStorage.removeItem(REMOTE_CFG_KEY); localStorage.removeItem(SESSION_KEY); },
    setAuthRequired(on) {
      const c = readRemoteConfig(); if (!c) return;
      if (c.env) { localStorage.setItem("ppm:authRequired", on ? "1" : "0"); return; }
      c.auth = !!on; localStorage.setItem(REMOTE_CFG_KEY, JSON.stringify(c));
    },
  };
  window.__ppmMergeLists = mergeLists; // exposed for testing
}
