/*
  Where the app keeps its data.

  LOCAL MODE — no database set up: everything stays in this browser (localStorage), as before.

  CLOUD MODE — Supabase keys set in Vercel (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) or connected
  under More → Team & access:
   - everyone signs in with their own email + password (Supabase Auth);
   - data belongs to a company; the database only lets members of that company read it, and each role may
     only change the lists it works with (rules in supabase-setup.sql — enforced by the database; the app
     checks the same rules first, from app/permissions.js, so a refused change is reported straight away);
   - personal settings (last tab, filters) are saved per person;
   - photos, certificates and signatures are moved out of the data into private file storage and shown
     through signed links that only work for signed-in members;
   - simultaneous edits are merged record-by-record; changes made offline are queued and sent later.
*/
import { canWrite, hasFieldRules, isReadOnly, writeRefusal } from "./app/permissions.js";

const REMOTE_CFG_KEY = "ppm:remote";
const SESSION_KEY = "ppm:session";
const PENDING_KEY = "ppm:pending2";
const ORG_KEY = "ppm:org";
const INVITE_KEY = "ppm:invite";
const SIGNED_KEY = "ppm:signed";
const UPLOADED_KEY = "ppm:uploaded";
const BUCKET = "ppm-media";
const MEDIA_PREFIX = "ppm-media:";
const SIGN_SECONDS = 7 * 24 * 3600;

function readJSON(k, fallback) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? fallback; } catch (e) { return fallback; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full — not critical */ } }
const ENV_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "";
const ENV_KEY = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";
// Safety lock for review copies: a Vercel preview build never connects to a database unless that database is
// marked as the test one (VITE_TEST_DATABASE=yes, set only for the review branch). So a preview that picked up the
// live database's settings by mistake can't read or change live data. Production builds are not affected.
const DEPLOY_ENV = typeof __DEPLOY_ENV__ !== "undefined" ? __DEPLOY_ENV__ : "";
const TEST_DB = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_TEST_DATABASE) || "";
export const REVIEW_LOCKED = DEPLOY_ENV === "preview" && String(TEST_DB).toLowerCase() !== "yes";
if (typeof window !== "undefined" && REVIEW_LOCKED && ENV_URL) window.ppmReviewLock = true;
function readRemoteConfig() {
  if (REVIEW_LOCKED) return null;
  if (ENV_URL && ENV_KEY) return { url: ENV_URL.replace(/\/+$/, ""), key: ENV_KEY, env: true };
  const c = readJSON(REMOTE_CFG_KEY, null);
  if (c && c.url && c.key) return { url: String(c.url).replace(/\/+$/, ""), key: c.key, env: false };
  return null;
}
function jwtClaims(t) { try { return JSON.parse(decodeURIComponent(escape(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))); } catch (e) { return {}; } }
function appUrl() { return window.location.origin + window.location.pathname; }
async function errorFrom(r) {
  let m = `Error ${r.status}`; let code = "";
  try { const j = await r.json(); m = j.msg || j.message || j.error_description || j.error || m; code = j.code || j.error_code || ""; } catch (e) { /* not JSON */ }
  const e = new Error(m); e.status = r.status; e.code = code; return e;
}

/* ---------- sign-in (Supabase Auth over plain fetch) ---------- */
function makeAuth(cfg) {
  const base = cfg.url + "/auth/v1";
  const h = { apikey: cfg.key, "Content-Type": "application/json" };
  const save = (d) => {
    const c = jwtClaims(d.access_token);
    const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Number(d.expires_at) || Math.floor(Date.now() / 1000) + Number(d.expires_in || 3600), email: d.user?.email || c.email || "", user_id: d.user?.id || c.sub || "" };
    writeJSON(SESSION_KEY, s); return s;
  };
  let refreshing = null;
  const auth = {
    session() { return readJSON(SESSION_KEY, null); },
    async signIn(email, password) {
      const r = await fetch(`${base}/token?grant_type=password`, { method: "POST", headers: h, body: JSON.stringify({ email, password }) });
      if (!r.ok) throw await errorFrom(r); return save(await r.json());
    },
    async signUp(email, password) {
      const r = await fetch(`${base}/signup?redirect_to=${encodeURIComponent(appUrl())}`, { method: "POST", headers: h, body: JSON.stringify({ email, password }) });
      if (!r.ok) throw await errorFrom(r);
      const d = await r.json();
      return d.access_token ? { session: save(d) } : { session: null };
    },
    async reset(email) {
      const r = await fetch(`${base}/recover?redirect_to=${encodeURIComponent(appUrl())}`, { method: "POST", headers: h, body: JSON.stringify({ email }) });
      if (!r.ok) throw await errorFrom(r);
    },
    async setPassword(password) {
      const tok = await auth.token(); if (!tok) throw new Error("Your reset link has expired — ask for a new one.");
      const r = await fetch(`${base}/user`, { method: "PUT", headers: { ...h, Authorization: `Bearer ${tok}` }, body: JSON.stringify({ password }) });
      if (!r.ok) throw await errorFrom(r);
    },
    async token(force) {
      let s = readJSON(SESSION_KEY, null);
      if (!s) return null;
      if (force || s.expires_at * 1000 - Date.now() < 90000) {
        if (!refreshing) refreshing = (async () => {
          let r;
          try { r = await fetch(`${base}/token?grant_type=refresh_token`, { method: "POST", headers: h, body: JSON.stringify({ refresh_token: s.refresh_token }) }); }
          catch (e) { return { offline: true }; }
          if (!r.ok) { if (r.status >= 400 && r.status < 500) { localStorage.removeItem(SESSION_KEY); return { gone: true }; } return { offline: true }; }
          return { s: save(await r.json()) };
        })().finally(() => { refreshing = null; });
        const res = await refreshing;
        if (res.s) s = res.s;
        else if (res.gone) return null;
        else if (s.expires_at * 1000 > Date.now()) return s.access_token;   // offline but token still valid
        else throw new Error("offline");                                     // network error: callers queue the change
      }
      return s.access_token;
    },
    signOut() {
      const s = readJSON(SESSION_KEY, null);
      if (s) fetch(`${base}/logout`, { method: "POST", headers: { ...h, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
      localStorage.removeItem(SESSION_KEY);
    },
    // Links in Supabase emails (confirm account, reset password) come back as #access_token=…&type=…
    consumeLink() {
      const hash = window.location.hash || "";
      if (!/access_token=|error_description=/.test(hash)) return null;
      const p = new URLSearchParams(hash.slice(1));
      try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { /* ignore */ }
      if (p.get("error_description")) return { error: p.get("error_description").replace(/\+/g, " ") };
      const prevEmail = readJSON(SESSION_KEY, null)?.email || "";
      save({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_at: p.get("expires_at"), expires_in: p.get("expires_in") });
      return { type: p.get("type") || "", prevEmail };
    },
  };
  return auth;
}

/* ---------- 3-way merge of lists of records ---------- */
// base = what we last read, ours = what we're saving, theirs = what's in the database now.
function mergeLists(baseStr, oursStr, theirsStr) {
  let base, ours, theirs;
  try { base = JSON.parse(baseStr); ours = JSON.parse(oursStr); theirs = JSON.parse(theirsStr); } catch (e) { return oursStr; }
  const isRecList = (a) => Array.isArray(a) && a.every((x) => x && typeof x === "object" && "id" in x);
  const isObj = (a) => a && typeof a === "object" && !Array.isArray(a);
  // a single set of values (settings): keep each field someone else changed unless we changed that same field
  if (isObj(ours) && isObj(theirs)) {
    const b = isObj(base) ? base : {}; const out = { ...theirs };
    new Set([...Object.keys(ours), ...Object.keys(b)]).forEach((k) => {
      if (JSON.stringify(ours[k]) === JSON.stringify(b[k])) return;   // we didn't touch it: theirs stands
      if (k in ours) out[k] = ours[k]; else delete out[k];
    });
    return JSON.stringify(out);
  }
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

/* ---------- local mode ---------- */
function installLocal() {
  const prefix = (shared) => (shared ? "ppm:shared:" : "ppm:personal:");
  window.storage = {
    __local: true, __remote: false, __cloud: false, __pendingCount: () => 0,
    async get(key, shared = false) { const v = localStorage.getItem(prefix(shared) + key); if (v === null) throw new Error("Key not found: " + key); return { key, value: v, shared }; },
    async set(key, value, shared = false) { localStorage.setItem(prefix(shared) + key, value); return { key, value, shared }; },
    async delete(key, shared = false) { localStorage.removeItem(prefix(shared) + key); return { key, deleted: true, shared }; },
    async list(pfx = "", shared = false) {
      const p = prefix(shared); const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const kk = localStorage.key(i); if (kk && kk.startsWith(p + pfx)) keys.push(kk.slice(p.length)); }
      return { keys, prefix: pfx, shared };
    },
    async inlineMedia(s) { return s; },
  };
}

/* ---------- offline queue: kept in IndexedDB (room for photos), localStorage as a fallback ---------- */
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    try { const r = indexedDB.open("ppm", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("kv", mode); const req = fn(t.objectStore("kv")); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  return { get: (k) => tx("readonly", (st) => st.get(k)), set: (k, v) => tx("readwrite", (st) => st.put(v, k)), del: (k) => tx("readwrite", (st) => st.delete(k)) };
})();

/* ---------- cloud mode ---------- */
function installCloud(cfg) {
  const auth = makeAuth(cfg);
  const ctx = { org: null, role: null, canApprove: false, userId: null, email: null };
  const state = { status: "loading", cfg: { url: cfg.url, env: cfg.env }, user: null, org: null, orgs: [], notice: "", error: "" };
  const baseCache = new Map();   // key -> the database value the screen is based on (photos as references)
  const peekCache = new Map();   // key -> a value read by a background refresh, until the screen takes it
  let pending = {};              // "<org>|<key>" -> { v: value waiting to be sent, b: the base it was built on }
  let pendingLoaded = false;
  const pendingStore = () => `pending:${ctx.userId}`;
  const isNetworkError = (e) => !e.status && !e.signedOut && !e.conflict && !e.denied;
  const announcePending = () => window.dispatchEvent(new window.CustomEvent("ppm-pending", { detail: { count: pendingCount() } }));
  const pendingCount = () => Object.keys(pending).filter((k) => k.startsWith(ctx.org + "|")).length;
  async function loadPending() {
    if (pendingLoaded || !ctx.userId) return;
    try { pending = (await idb.get(pendingStore())) || readJSON(`${PENDING_KEY}:${ctx.userId}`, {}); } catch (e) { pending = readJSON(`${PENDING_KEY}:${ctx.userId}`, {}); }
    pendingLoaded = true;
    // photo links are kept per person; drop any left by someone else on this device
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && (k === SIGNED_KEY || (k.startsWith(SIGNED_KEY + ":") && k !== signedKey()))) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } }
    signed = readJSON(signedKey(), {});
  }
  function savePending() {
    const copy = { ...pending };
    idb.set(pendingStore(), copy).then(() => { try { localStorage.removeItem(`${PENDING_KEY}:${ctx.userId}`); } catch (e) { /* ignore */ } })
      .catch(() => { try { localStorage.setItem(`${PENDING_KEY}:${ctx.userId}`, JSON.stringify(copy)); } catch (e) { window.dispatchEvent(new window.CustomEvent("ppm-pending-unsafe")); } });
    announcePending();
  }

  async function api(path, { method = "GET", body, headers = {}, anon = false, raw = false } = {}, retried = false) {
    let tok = null;
    if (!anon) { tok = await auth.token(); if (!tok) { const e = new Error("Please sign in again."); e.signedOut = true; throw e; } }
    const r = await fetch(cfg.url + path, { method, headers: { apikey: cfg.key, Authorization: `Bearer ${tok || cfg.key}`, ...(raw ? {} : { "Content-Type": "application/json" }), ...headers }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
    if (r.status === 401 && !anon && !retried) { await auth.token(true); return api(path, { method, body, headers, anon, raw }, true); }
    if (!r.ok) throw await errorFrom(r);
    if (r.status === 204) return null;
    const t = await r.text(); if (!t) return null;
    try { return JSON.parse(t); } catch (e) { return t; }
  }
  const rpc = (fn, args = {}, opts = {}) => api(`/rest/v1/rpc/${fn}`, { method: "POST", body: args, ...opts });
  const scopeOf = (shared) => (shared ? "shared" : `user:${ctx.userId}`);
  const rowFilter = (key, scope) => `org_id=eq.${ctx.org}&key=eq.${encodeURIComponent(key)}&scope=eq.${encodeURIComponent(scope)}`;
  const kv = {
    async get(key, scope) { const r = await kv.row(key, scope); return r ? r.value : null; },
    async row(key, scope) {
      const rows = await api(`/rest/v1/kv_store?${rowFilter(key, scope)}&select=value,version`);
      return rows && rows.length ? rows[0] : null;
    },
    // Only replaces the value if nobody has saved since we read it (the database bumps a version number).
    async update(key, scope, value, version) {
      const rows = await api(`/rest/v1/kv_store?${rowFilter(key, scope)}&version=eq.${Number(version)}&select=version`, { method: "PATCH", body: { value }, headers: { Prefer: "return=representation" } });
      return Array.isArray(rows) && rows.length > 0;
    },
    async insert(key, scope, value) {
      try { await api(`/rest/v1/kv_store`, { method: "POST", body: [{ org_id: ctx.org, key, scope, value }], headers: { Prefer: "return=minimal" } }); return true; }
      catch (e) { if (e.status === 409 || e.code === "23505") return false; throw e; }
    },
    set(key, scope, value) {   // personal settings: last save wins
      return api(`/rest/v1/kv_store?on_conflict=org_id,key,scope`, { method: "POST", body: [{ org_id: ctx.org, key, scope, value }], headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    },
    del(key, scope) { return api(`/rest/v1/kv_store?${rowFilter(key, scope)}`, { method: "DELETE" }); },
    async list(prefix, scope) {
      const rows = await api(`/rest/v1/kv_store?org_id=eq.${ctx.org}&scope=eq.${encodeURIComponent(scope)}&key=like.${encodeURIComponent(prefix)}*&select=key`);
      return (rows || []).map((x) => x.key);
    },
  };
  const personalKey = (key) => `ppm:personal:${ctx.userId}:${key}`;

  /* --- photos: data URLs in saved data become references to files in private storage --- */
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const SIGNED_RE = () => new RegExp(`${esc(cfg.url)}/storage/v1/object/sign/${BUCKET}/([0-9a-f-]{36}/[0-9a-f]{64}\\.(?:jpg|png|webp|gif))\\?token=[A-Za-z0-9._~%-]+`, "g");
  const DATA_RE = /"data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)"/g;
  const REF_RE = /"ppm-media:([0-9a-f-]{36}\/[0-9a-f]{64}\.(?:jpg|png|webp|gif))"/g;
  const signedKey = () => `${SIGNED_KEY}:${ctx.userId || "anon"}`;
  let signed = {};                             // path -> [url, expiresAt(ms)] (kept per person: loaded after sign-in)
  const uploaded = new Set(readJSON(UPLOADED_KEY, []));
  const rememberUploaded = (p) => { uploaded.add(p); const arr = [...uploaded]; writeJSON(UPLOADED_KEY, arr.slice(-3000)); };
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function b64ToBytes(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  async function upload(path, type, b64) {
    if (uploaded.has(path)) return true;
    try {
      await api(`/storage/v1/object/${BUCKET}/${path}`, { method: "POST", raw: true, body: b64ToBytes(b64), headers: { "Content-Type": `image/${type}`, "x-upsert": "false", "cache-control": "max-age=31536000" } });
    } catch (e) {
      if (!(/duplicate|already exists/i.test(e.message || "") || e.code === "409")) { if (!isNetworkError(e)) console.warn("photo upload failed", path, e.message); return false; }
    }
    rememberUploaded(path); return true;
  }
  async function externalize(str) {
    if (typeof str !== "string" || !ctx.org) return str;
    let out = str.replace(SIGNED_RE(), (m, p) => MEDIA_PREFIX + p);
    if (!out.includes('"data:image/')) return out;
    if (isReadOnly(ctx.role) || !(crypto && crypto.subtle)) return out;
    const found = new Map();
    out.replace(DATA_RE, (m, type, b64) => { if (m.length > 1500) found.set(m, { type, b64 }); return m; });
    if (!found.size) return out;
    const swap = new Map();
    await Promise.all([...found].map(async ([m, { type, b64 }]) => {
      const path = `${ctx.org}/${await sha256(m)}.${type === "jpeg" ? "jpg" : type}`;
      if (await upload(path, type, b64)) {
        swap.set(m, `"${MEDIA_PREFIX}${path}"`);
        signed[path] = signed[path] || [`data:image/${type};base64,${b64}`, Date.now() + 10 * 60000]; // show the local copy until a link is fetched
      }
    }));
    return swap.size ? out.replace(DATA_RE, (m) => swap.get(m) || m) : out;
  }
  // Collect every photo that needs a link and fetch them together (one request for the whole first load).
  let signQueue = new Set(); let signTimer = null; let signWaiters = [];
  function ensureSigned(paths) {
    const need = paths.filter((p) => !signed[p] || signed[p][1] < Date.now() + 3600000 || signed[p][0].startsWith("data:"));
    if (!need.length) return Promise.resolve();
    need.forEach((p) => signQueue.add(p));
    return new Promise((resolve) => {
      signWaiters.push(resolve);
      if (signTimer) return;
      signTimer = setTimeout(async () => {
        const batch = [...signQueue]; const waiters = signWaiters;
        signQueue = new Set(); signWaiters = []; signTimer = null;
        try {
          for (let i = 0; i < batch.length; i += 200) {
            try {
              const res = await api(`/storage/v1/object/sign/${BUCKET}`, { method: "POST", body: { expiresIn: SIGN_SECONDS, paths: batch.slice(i, i + 200) } });
              (res || []).forEach((x) => {
                const rel = x.signedURL || x.signedUrl; if (!rel || x.error) return;
                signed[x.path] = [/^https?:/.test(rel) ? rel : `${cfg.url}/storage/v1${rel}`, Date.now() + SIGN_SECONDS * 1000];
              });
            } catch (e) { /* offline: the photo shows when we're back online */ }
          }
          const now = Date.now(); const keep = {};
          Object.entries(signed).filter(([, v]) => v[1] > now && !v[0].startsWith("data:")).slice(-1500).forEach(([k, v]) => { keep[k] = v; });
          writeJSON(signedKey(), keep); signed = { ...keep, ...Object.fromEntries(Object.entries(signed).filter(([, v]) => v[0].startsWith("data:") && v[1] > now)) };
        } finally { waiters.forEach((w) => w()); }
      }, 15);
    });
  }
  async function internalize(str) {
    if (typeof str !== "string" || !str.includes(`"${MEDIA_PREFIX}`)) return str;
    const paths = []; str.replace(REF_RE, (m, p) => { paths.push(p); return m; });
    await ensureSigned([...new Set(paths)]);
    return str.replace(REF_RE, (m, p) => (signed[p] ? JSON.stringify(signed[p][0]) : m));
  }
  // For backups: put the actual photos back into the file so it works on its own.
  async function inlineMedia(str) {
    const canon = str.replace(SIGNED_RE(), (m, p) => MEDIA_PREFIX + p);
    const paths = []; canon.replace(REF_RE, (m, p) => { paths.push(p); return m; });
    const uniq = [...new Set(paths)]; if (!uniq.length) return canon;
    await ensureSigned(uniq);
    const data = {};
    for (let i = 0; i < uniq.length; i += 6) {
      await Promise.all(uniq.slice(i, i + 6).map(async (p) => {
        try {
          const u = signed[p]?.[0]; if (!u) return;
          if (u.startsWith("data:")) { data[p] = u; return; }
          const blob = await (await fetch(u)).blob();
          data[p] = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        } catch (e) { /* leave the reference */ }
      }));
    }
    return canon.replace(REF_RE, (m, p) => (data[p] ? JSON.stringify(data[p]) : m));
  }

  /* --- saving a shared list: merge with anything saved by others since the screen read it, write only if
         nothing changed in between (otherwise read again and re-merge), one save per list at a time.
         base = the database value the saved list was built from (captured when the save was asked for).
         background saves (moving photos, copying a browser's data) never change what the screen is based on. --- */
  async function remoteSet(key, value, base, { background = false } = {}) {
    const canon = await externalize(value);
    for (let attempt = 0; attempt < 5; attempt++) {
      const cur = await kv.row(key, "shared");
      const theirs = cur ? cur.value : null;
      let out = canon;
      // never read before (e.g. saved while the first load failed)? treat as new, so nobody else's records are lost
      if (theirs !== null && theirs !== canon && theirs !== base) out = mergeLists(base === undefined ? "[]" : base, canon, theirs);
      const done = cur ? (out === theirs ? true : await kv.update(key, "shared", out, cur.version)) : await kv.insert(key, "shared", out);
      if (done) {
        if (!background) {
          // links for any new photos first, then update the base and the screen together (no gap in between)
          const shown = out !== canon ? await internalize(out) : null;
          baseCache.set(key, out); peekCache.delete(key);
          if (shown !== null) window.dispatchEvent(new window.CustomEvent("ppm-merged", { detail: { key, value: shown } }));
        }
        return out;
      }
      if (cur) {   // nothing written: someone saved in between — or we may not change this any more
        const again = await kv.row(key, "shared");
        if (again && String(again.version) === String(cur.version)) { const e = new Error("You don't have permission to change this any more — ask your admin."); e.status = 403; e.denied = true; throw e; }
      }
    }
    const e = new Error("Several people are saving this at once — please try again."); e.status = 409; e.conflict = true; throw e;
  }
  const chains = new Map();
  function serial(key, fn) {
    const prev = chains.get(key) || Promise.resolve();
    const p = prev.catch(() => {}).then(fn);
    chains.set(key, p);
    p.catch(() => {}).finally(() => { if (chains.get(key) === p) chains.delete(key); });
    return p;
  }
  const permanent = (e) => e.denied || (e.status >= 400 && e.status < 500 && ![401, 408, 409, 429].includes(e.status));
  let flushing = false;
  async function flushPending() {
    if (!ctx.org || flushing) return;
    const keys = Object.keys(pending).filter((k) => k.startsWith(ctx.org + "|"));
    if (!keys.length) return;
    flushing = true;
    try {
      for (const pk of keys) {
        const key = pk.slice(ctx.org.length + 1); const entry = pending[pk];
        try {
          await serial(key, async () => {
            if (pending[pk] !== entry) return;          // a newer save replaced it meanwhile
            await remoteSet(key, entry.v, entry.b);
            if (pending[pk] === entry) delete pending[pk];
          });
        } catch (e) {
          if (!permanent(e)) break;                     // offline, signed out, busy: try again later
          console.error("queued save refused", key, e); if (pending[pk] === entry) delete pending[pk];
          window.dispatchEvent(new window.CustomEvent("ppm-save-refused", { detail: { key, message: e.message } }));
        }
      }
    } finally { flushing = false; savePending(); }
  }

  const notReady = () => { const e = new Error("Not signed in"); e.signedOut = true; return e; };
  window.storage = {
    __local: false, __remote: true, __cloud: true,
    __pendingCount: () => pendingCount(),
    // opts.peek: a background refresh — the value only becomes the base for merging once the screen takes it (accept)
    async get(key, shared = false, opts = {}) {
      if (!ctx.org) throw notReady();
      if (shared) {
        const pk = `${ctx.org}|${key}`;
        if (pending[pk] !== undefined) { peekCache.delete(key); return { key, value: pending[pk].v, shared }; }
        let v;
        try { v = await kv.get(key, "shared"); }
        catch (e) {
          // connection dropped: keep showing what we last read instead of an empty list
          if (isNetworkError(e) && baseCache.has(key)) { peekCache.delete(key); return { key, value: await internalize(baseCache.get(key)), shared }; }
          throw e;
        }
        if (v === null) throw new Error("Key not found: " + key);
        if (opts && opts.peek) peekCache.set(key, v); else baseCache.set(key, v);
        return { key, value: await internalize(v), shared };
      }
      try { const v = await kv.get(key, scopeOf(false)); if (v !== null) { try { localStorage.setItem(personalKey(key), v); } catch (e) { /* full */ } return { key, value: v, shared }; } } catch (e) { /* offline: use this device's copy */ }
      const v = localStorage.getItem(personalKey(key)); if (v === null) throw new Error("Key not found: " + key);
      return { key, value: v, shared };
    },
    // true = the screen may show the refreshed value (nothing of ours is being saved or waiting for this list)
    accept(key) {
      if (chains.has(key) || pending[`${ctx.org}|${key}`] !== undefined || !peekCache.has(key)) return false;
      baseCache.set(key, peekCache.get(key)); peekCache.delete(key); return true;
    },
    async set(key, value, shared = false) {
      if (!ctx.org) throw notReady();
      if (shared) {
        if (isReadOnly(ctx.role)) return { key, value, shared }; // read-only: the database would refuse it anyway
        const pk = `${ctx.org}|${key}`;
        const base = pending[pk] !== undefined ? pending[pk].b : baseCache.get(key);   // what this list was built from
        // your role can't change this: say so now rather than queueing something the database will refuse
        const canon = (v) => (typeof v === "string" ? v.replace(SIGNED_RE(), (m, p) => MEDIA_PREFIX + p) : v);
        const limit = (() => { try { const st = JSON.parse(baseCache.get("org:settings") || "{}"); return "approvalThreshold" in st ? Number(st.approvalThreshold) || 0 : 1000; } catch (e) { return 1000; } })();   // never set = the app's £1,000 default
        const refused = writeRefusal(ctx.role, key, base === undefined ? null : canon(base), canon(value), { canApprove: ctx.canApprove, limit });
        if (refused) { const e = new Error(refused); e.status = 403; e.denied = true; throw e; }
        try {
          await serial(key, async () => { await remoteSet(key, value, base); if (pending[pk] !== undefined) { delete pending[pk]; savePending(); } });
        } catch (e) {
          if (!isNetworkError(e) && !e.signedOut) throw e;
          pending[pk] = { v: value, b: base }; savePending();   // kept on this device and sent later
          if (e.signedOut) window.dispatchEvent(new window.CustomEvent("ppm-signedout"));
        }
      } else {
        try { localStorage.setItem(personalKey(key), value); } catch (e) { /* full */ }
        kv.set(key, scopeOf(false), value).catch(() => {});
      }
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      if (!ctx.org) throw notReady();
      if (shared && isReadOnly(ctx.role)) return { key, deleted: false, shared };
      await kv.del(key, scopeOf(shared)); if (!shared) localStorage.removeItem(personalKey(key));
      return { key, deleted: true, shared };
    },
    async list(pfx = "", shared = false) { if (!ctx.org) throw notReady(); return { keys: await kv.list(pfx, scopeOf(shared)), prefix: pfx, shared }; },
    inlineMedia,
  };

  function localSharedKeys() {
    const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("ppm:shared:")) out.push(k); }
    return out;
  }
  // Photos saved before this update (or sent from QR pages) are moved into file storage in the background.
  let migrating = false;
  async function migrateMedia() {
    if (!ctx.org || isReadOnly(ctx.role) || migrating) return;
    migrating = true; let again = false;
    try {
      const rows = await api(`/rest/v1/kv_store?org_id=eq.${ctx.org}&scope=eq.shared&value=like.${encodeURIComponent("*data:image/*")}&select=key`);
      for (const { key } of rows || []) {
        if (!canWrite(ctx.role, key) || hasFieldRules(ctx.role, key)) continue;   // left for someone whose role can change the whole list
        try {
          await serial(key, async () => {
            const raw = await kv.get(key, "shared"); if (raw === null) return;
            await remoteSet(key, raw, raw, { background: true });   // the screen keeps its own base; merges take care of the rest
          });
        } catch (e) { again = true; console.warn("moving photos to file storage failed for", key, e.message); }
      }
    } catch (e) { again = true; console.warn("photo move check failed", e.message); }
    migrating = false;
    if (again) setTimeout(migrateMedia, 60000);
  }
  async function enterOrg(o) {
    ctx.org = o.org_id; ctx.role = o.role; ctx.canApprove = !!o.can_approve;
    state.org = { id: o.org_id, name: o.name, role: o.role, canApprove: !!o.can_approve };
    try { localStorage.setItem(ORG_KEY, o.org_id); } catch (e) { /* ignore */ }
    state.status = "ready";
    if (!window.__ppmFlushTimers) {
      window.__ppmFlushTimers = true;
      window.addEventListener("online", flushPending);
      setInterval(flushPending, 30000);
      setTimeout(flushPending, 3000);
      setTimeout(migrateMedia, 8000);
    }
  }
  const allPending = () => Object.keys(pending).length;
  async function clearDevice() {
    // nothing from this person's session stays behind on a shared computer
    const drop = [ORG_KEY, SIGNED_KEY, signedKey(), UPLOADED_KEY, INVITE_KEY, `${PENDING_KEY}:${ctx.userId}`];
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && ctx.userId && k.startsWith(`ppm:personal:${ctx.userId}:`)) drop.push(k); }
    drop.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    signed = {};
    if (ctx.userId) { try { await Promise.race([idb.del(pendingStore()), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* ignore */ } }
  }

  const cloud = {
    state,
    async init() {
      state.error = ""; state.linkCheck = null;
      // a link from an email (confirm sign-up, reset password)?
      const link = auth.consumeLink();
      if (link?.error) state.error = link.error;
      // an invite link: ?invite=<token>
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("invite")) {
        try { localStorage.setItem(INVITE_KEY, qs.get("invite")); } catch (e) { /* ignore */ }
        qs.delete("invite");
        try { window.history.replaceState(null, "", window.location.pathname + (qs.toString() ? `?${qs}` : "") + window.location.hash); } catch (e) { /* ignore */ }
      }
      state.hasInvite = !!localStorage.getItem(INVITE_KEY);
      if (link?.type === "recovery") { state.status = "recovery"; state.user = { email: auth.session()?.email }; return state; }
      let tok;
      try { tok = auth.session() ? await auth.token() : null; }
      catch (e) { state.status = "offline"; state.error = "Can't reach the database — check your internet connection."; return state; }
      if (!tok) { state.status = "signedOut"; return state; }
      const s = auth.session();
      ctx.userId = s.user_id || jwtClaims(tok).sub; ctx.email = (s.email || jwtClaims(tok).email || "").toLowerCase();
      state.user = { id: ctx.userId, email: ctx.email };
      await loadPending();
      // A sign-in link opened from an email: say who it signs you in as before going on.
      if (link && link.type !== "recovery" && !link.error) { state.status = "linkCheck"; state.linkCheck = { email: ctx.email, prevEmail: link.prevEmail || "" }; return state; }
      return cloud.afterSignIn();
    },
    async afterSignIn() {
      state.linkCheck = null;
      try {
        const inv = localStorage.getItem(INVITE_KEY);
        if (inv) {
          let info = null;
          try { info = await rpc("ppm_invite_info", { p_token: inv }); } catch (e) { if (isNetworkError(e)) throw e; }
          if (!info || info.expired) { localStorage.removeItem(INVITE_KEY); state.hasInvite = false; state.error = "That invite link isn't valid any more — ask for a new one."; }
          else if (info.member) { localStorage.removeItem(INVITE_KEY); state.hasInvite = false; state.notice = `You're already in ${info.org}.`; }
          else { state.status = "invite"; state.invite = { ...info, token: inv }; return state; }
        }
        const orgs = (await rpc("ppm_my_orgs")) || [];
        state.orgs = orgs;
        if (!orgs.length) { state.status = "noOrg"; return state; }
        const saved = localStorage.getItem(ORG_KEY);
        await enterOrg(orgs.find((o) => o.org_id === saved) || orgs[0]);
      } catch (e) {
        if (e.signedOut) { state.status = "signedOut"; return state; }
        state.status = "offline"; state.error = isNetworkError(e) ? "Can't reach the database — check your internet connection." : (e.message || "Something went wrong");
        if (/ppm_my_orgs|ppm_invite_info|ppm_accept_invite|schema cache|does not exist/i.test(state.error)) state.error = "The database isn't set up for logins yet — run supabase-setup.sql in Supabase (SQL Editor).";
      }
      return state;
    },
    async acceptPendingInvite() {
      const inv = localStorage.getItem(INVITE_KEY);
      const org = await rpc("ppm_accept_invite", { p_token: inv });
      localStorage.removeItem(INVITE_KEY); state.hasInvite = false; state.invite = null;
      localStorage.setItem(ORG_KEY, org); state.notice = "You've joined the team.";
      return cloud.afterSignIn();
    },
    declineInvite() { localStorage.removeItem(INVITE_KEY); state.hasInvite = false; state.invite = null; return cloud.afterSignIn(); },
    pendingTotal: allPending,
    async signIn(email, password) { await auth.signIn(email.trim(), password); },
    async signUp(email, password) { return auth.signUp(email.trim(), password); },
    async reset(email) { await auth.reset(email.trim()); },
    async setPassword(pw) { await auth.setPassword(pw); },
    // force: sign out even with changes waiting to be sent (they're lost)
    signOut(force) {
      const n = allPending();
      if (n && !force && !window.confirm(`${n} change${n === 1 ? " hasn't" : "s haven't"} reached the database yet (no connection). Sign out anyway? ${n === 1 ? "It" : "They"} will be lost.`)) return false;
      auth.signOut(); clearDevice().finally(() => window.location.reload()); return true;
    },
    async createOrg(name) { const id = await rpc("ppm_create_org", { p_name: name }); localStorage.setItem(ORG_KEY, id); return id; },
    async acceptInvite(linkOrToken) {
      const m = String(linkOrToken || "").match(/invite=([A-Za-z0-9]+)/); const tok = m ? m[1] : String(linkOrToken || "").trim();
      const id = await rpc("ppm_accept_invite", { p_token: tok }); localStorage.setItem(ORG_KEY, id); return id;
    },
    switchOrg(id) { localStorage.setItem(ORG_KEY, id); window.location.reload(); },
    team() { return rpc("ppm_team", { p_org: ctx.org }); },
    async invite(email, role) { const r = await rpc("ppm_invite", { p_org: ctx.org, p_email: email, p_role: role }); return { ...r, link: `${appUrl()}?invite=${r.token}` }; },
    inviteLink(token) { return `${appUrl()}?invite=${token}`; },
    cancelInvite(id) { return rpc("ppm_cancel_invite", { p_org: ctx.org, p_invite: id }); },
    setRole(userId, role) { return rpc("ppm_set_role", { p_org: ctx.org, p_user: userId, p_role: role }); },
    setApprover(userId, on) { return rpc("ppm_set_approver", { p_org: ctx.org, p_user: userId, p_on: !!on }); },
    removeMember(userId) { return rpc("ppm_remove_member", { p_org: ctx.org, p_user: userId }); },
    async renameOrg(name) { await rpc("ppm_rename_org", { p_org: ctx.org, p_name: name }); state.org = { ...state.org, name: name.trim() }; },
    async leave() { await rpc("ppm_remove_member", { p_org: ctx.org, p_user: ctx.userId }); localStorage.removeItem(ORG_KEY); window.location.reload(); },
    // Data saved before logins, waiting in the database to be moved into a company (yes/no) — and the one
    // line the owner runs in Supabase's SQL Editor to move it.
    async legacyWaiting() { try { return !!(await rpc("ppm_legacy_waiting")); } catch (e) { return false; } },
    claimSql() { return `select ppm_claim_old_data('${String(ctx.email || "").replace(/'/g, "''")}');`; },
    // Data saved in this browser before the database was connected
    localDataCount() { return localStorage.getItem("ppm:localCopied") ? 0 : localSharedKeys().length; },
    // Adds this browser's records to the company: lists are merged, and where a record exists in both the
    // company's version is kept; single values such as settings are only copied when the company has none.
    async copyLocalData() {
      let n = 0;
      for (const k of localSharedKeys()) {
        const key = k.slice("ppm:shared:".length); const mine = localStorage.getItem(k);
        let mineV; try { mineV = JSON.parse(mine); } catch (e) { continue; }
        await serial(key, async () => {
          const theirs = await kv.get(key, "shared");
          let value = mine;
          if (theirs !== null) {
            if (!Array.isArray(mineV)) return;
            let theirsV; try { theirsV = JSON.parse(theirs); } catch (e) { return; }
            if (!Array.isArray(theirsV)) return;
            const have = new Set(theirsV.map((x) => x && x.id));
            value = JSON.stringify([...theirsV, ...mineV.filter((x) => !(x && have.has(x.id)))]);
          }
          await remoteSet(key, value, theirs === null ? undefined : theirs, { background: true }); n++;
        });
      }
      try { localStorage.setItem("ppm:localCopied", ctx.org); } catch (e) { /* ignore */ }
      return n;
    },
    migrateMedia,
    flush: () => flushPending(),
    async orgHasData() { const keys = await kv.list("org:", "shared"); return keys.length > 0; },
    // QR pages (no login): narrow database functions
    publicRead(kind, ref, org, site) { return rpc("ppm_public_read", { p_kind: kind, p_ref: ref, p_org: org || null, p_site: site || null }, { anon: true }); },
    publicWrite(kind, ref, data, org) { return rpc("ppm_public_write", { p_kind: kind, p_ref: ref, p_data: data, p_org: org || null }, { anon: true }); },
  };
  window.ppmCloud = cloud;
}

if (typeof window !== "undefined" && !window.storage) {
  const cfg = readRemoteConfig();
  if (cfg) installCloud(cfg); else installLocal();

  // Helpers for the Team & access screen (connecting a database without redeploying).
  window.ppmRemote = {
    config: cfg, envMode: !!(cfg && cfg.env),
    async test(c) {
      const url = String(c.url || "").replace(/\/+$/, "");
      let r;
      try { r = await fetch(`${url}/rest/v1/rpc/ppm_public_read`, { method: "POST", headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_kind: "ping", p_ref: "x" }) }); }
      catch (e) { throw new Error("Can't reach that address — check the Project URL."); }
      if (r.status === 404) throw new Error("Connected, but the database isn't set up — run supabase-setup.sql in Supabase → SQL Editor first.");
      if (r.status === 401 || r.status === 403) throw new Error("Key rejected — use the project's anon public key.");
      if (!r.ok) throw new Error(`Error ${r.status}`);
      return true;
    },
    connect(c) { localStorage.setItem(REMOTE_CFG_KEY, JSON.stringify({ url: String(c.url).trim().replace(/\/+$/, ""), key: String(c.key).trim() })); },
    disconnect() { localStorage.removeItem(REMOTE_CFG_KEY); localStorage.removeItem(SESSION_KEY); localStorage.removeItem(ORG_KEY); },
  };
  window.__ppmMergeLists = mergeLists; // exposed for testing
}
