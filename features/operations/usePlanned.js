// Planned maintenance in the field (Phase 2, round 31.2): what an engineer does at an asset after scanning it —
// a visit with start and finish times, a quick inspection, a photo, a meter reading. MainApp keeps the state and the
// saving (saveService still runs the schedule and budget rules for a visit); this hook gets them in `ctx`.
// The visit in progress is kept in the person's own storage (me:visit), so it survives closing the app.
import { useMemo } from "react";
import { uid } from "../../lib/utils.js";

export const INSPECTION_RESULTS = {
  ok: { label: "All OK", tone: "ok", status: null },
  attention: { label: "Needs attention", tone: "warn", status: "attention" },
  failed: { label: "Not working", tone: "danger", status: "failed" },
};
const hhmm = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
export function durationText(min) { if (min < 60) return `${min} min`; const h = Math.floor(min / 60); const m = min % 60; return `${h} h${m ? ` ${m} min` : ""}`; }

export function makePlannedActions(ctx) {
  const { devices = [], persistDevices, meters = [], meterReadings = [], persistMeterReadings, userName, showToast = () => {}, draft = null, saveDraft = () => {} } = ctx;
  const by = userName || "Unknown";
  const name = (id) => devices.find((d) => d.id === id)?.name || "";

  // A quick look at the asset: OK, needs attention, or not working (which can also mark the asset's status).
  function logInspection(deviceId, { result = "ok", note = "", photo = null, setStatus = true }) {
    const d = devices.find((x) => x.id === deviceId); if (!d) return false;
    const at = new Date().toISOString(); const R = INSPECTION_RESULTS[result] || INSPECTION_RESULTS.ok;
    const entry = { id: uid(), at, by, kind: "inspection", result, text: `Inspection: ${R.label}${note.trim() ? ` — ${note.trim()}` : ""}`, ...(photo ? { photo } : {}) };
    const patch = { notesLog: [entry, ...(d.notesLog || [])] };
    if (setStatus && R.status) {
      patch.statusOverride = { status: R.status, note: note.trim() || R.label, by, at };
      patch.changeLog = [...(d.changeLog || []), { at, by, changes: [`Status set to ${R.status} after an inspection${note.trim() ? ` — ${note.trim()}` : ""}`] }].slice(-100);
    }
    persistDevices(devices.map((x) => (x.id === deviceId ? { ...x, ...patch } : x)));
    showToast("Inspection logged", `${d.name} — ${R.label}${R.status ? " · the office is told" : ""}`);
    return true;
  }
  // A photo of the asset, with an optional caption, kept with its notes.
  function addAssetPhoto(deviceId, photo, caption = "") {
    const d = devices.find((x) => x.id === deviceId); if (!d || !photo) return false;
    const entry = { id: uid(), at: new Date().toISOString(), by, kind: "photo", photo, text: caption.trim() || "Photo" };
    persistDevices(devices.map((x) => (x.id === deviceId ? { ...x, notesLog: [entry, ...(x.notesLog || [])] } : x)));
    showToast("Photo saved", d.name);
    return true;
  }
  function addMeterReading(meterId, value, deviceId = null) {
    const m = meters.find((x) => x.id === meterId); if (!m || value === "" || isNaN(Number(value))) return false;
    persistMeterReadings([...meterReadings, { id: uid(), meterId, date: new Date().toISOString().slice(0, 10), value: Number(value), by, at: new Date().toISOString(), ...(deviceId ? { fromDeviceId: deviceId } : {}) }]);
    showToast("Reading saved", `${m.name}: ${value} ${m.unit || ""}`);
    return true;
  }
  // The visit in progress (one per person): start it at the asset, carry on later, finish it with a signature.
  function startVisit(deviceId) {
    if (draft && draft.deviceId === deviceId) return draft;
    const next = { deviceId, startedAt: new Date().toISOString(), by };
    saveDraft(next);
    showToast("Visit started", `${name(deviceId)} — ${hhmm(next.startedAt)}`);
    return next;
  }
  function updateDraft(patch) { if (draft) saveDraft({ ...draft, ...patch }); }
  function discardDraft() { saveDraft(null); }
  // The times a finished visit records (arrived / left are what the visit form has always shown).
  function finishTimes(startedAt, finishedAt = new Date().toISOString()) {
    return { startedAt, finishedAt, arrived: hhmm(startedAt), left: hhmm(finishedAt), minutesOnSite: minutesBetween(startedAt, finishedAt) };
  }
  return { logInspection, addAssetPhoto, addMeterReading, startVisit, updateDraft, discardDraft, finishTimes };
}

export function usePlanned(ctx) {
  const { devices, persistDevices, meters, meterReadings, persistMeterReadings, userName, showToast, draft, saveDraft } = ctx;
  return useMemo(() => makePlannedActions(ctx), [devices, persistDevices, meters, meterReadings, persistMeterReadings, userName, showToast, draft, saveDraft]); // eslint-disable-line react-hooks/exhaustive-deps
}
export { hhmm };
