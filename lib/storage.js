// Loading and saving data (browser or shared database via storage-shim.js).
// Improvement: saves no longer fail silently — MainApp registers a listener that shows a warning banner.
export let SAVE_STATUS_LISTENER = null;

export let LAST_LOCAL_WRITE = 0;

export async function loadShared(key) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : []; }
  catch (e) { return []; }
}

export async function saveShared(key, list) {
  try {
    LAST_LOCAL_WRITE = Date.now();
    const r = await window.storage.set(key, JSON.stringify(list), true);
    if (r === null) throw new Error("storage returned null");
    SAVE_STATUS_LISTENER && SAVE_STATUS_LISTENER(key, true);
  }
  catch (e) { console.error("shared save failed", e); SAVE_STATUS_LISTENER && SAVE_STATUS_LISTENER(key, false, e); }
}

export async function loadPersonal(key, fallback) {
  try { const r = await window.storage.get(key, false); return r ? JSON.parse(r.value) : fallback; }
  catch (e) { return fallback; }
}

export async function savePersonal(key, val) {
  try { await window.storage.set(key, JSON.stringify(val), false); }
  catch (e) { console.error("personal save failed", e); }
}
export function set_SAVE_STATUS_LISTENER(v) { SAVE_STATUS_LISTENER = v; }
