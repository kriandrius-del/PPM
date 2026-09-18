// Drop-in replacement for the Claude-artifact `window.storage` API, backed by
// a real Supabase table. The app itself (App.jsx) never needed to change —
// it just calls window.storage.get/set exactly as before.
//
// "shared" data (shared=true) is the same row for every visitor — that's
// your team's countries, locations, services, budget, etc.
// "personal" data (shared=false) is scoped to this browser only, via a
// random ID stored in localStorage — that's just "which profile did I pick
// on this device" and "which location am I currently viewing."
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in your " +
    ".env.local file (for local dev) or in your Vercel project's Environment " +
    "Variables (for the deployed site)."
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getDeviceId() {
  let id = localStorage.getItem("ppm_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ppm_device_id", id);
  }
  return id;
}

// Every row lives in one scope: "shared" for team-wide data, or this
// browser's device id for personal data. Using a fixed string instead of
// NULL avoids a Postgres gotcha where NULL != NULL breaks unique constraints.
function scopeFor(shared) {
  return shared ? "shared" : getDeviceId();
}

async function get(key, shared) {
  const scope = scopeFor(shared);
  const { data, error } = await supabase
    .from("kv_store")
    .select("value")
    .eq("key", key)
    .eq("scope", scope)
    .maybeSingle();
  if (error) { console.error("storage.get failed:", error); return null; }
  if (!data) return null;
  return { key, value: data.value, shared: !!shared };
}

async function set(key, value, shared) {
  const scope = scopeFor(shared);
  const { error } = await supabase
    .from("kv_store")
    .upsert({ key, scope, value, updated_at: new Date().toISOString() }, { onConflict: "key,scope" });
  if (error) { console.error("storage.set failed:", error); return null; }
  return { key, value, shared: !!shared };
}

async function del(key, shared) {
  const scope = scopeFor(shared);
  const { error } = await supabase.from("kv_store").delete().eq("key", key).eq("scope", scope);
  return { key, deleted: !error, shared: !!shared };
}

async function list(prefix, shared) {
  const scope = scopeFor(shared);
  let query = supabase.from("kv_store").select("key").eq("scope", scope);
  if (prefix) query = query.like("key", `${prefix}%`);
  const { data, error } = await query;
  if (error) { console.error("storage.list failed:", error); return { keys: [], prefix, shared: !!shared }; }
  return { keys: (data || []).map((r) => r.key), prefix, shared: !!shared };
}

window.storage = { get, set, delete: del, list };
