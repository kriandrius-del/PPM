// "Needs a job": failed checks and open safety actions are suggested to the office, who raise a job from them in one
// tap or say no job is needed (the owner's decision, 14 Oct 2026: suggest, don't raise automatically).
// Sources: a failed item on a visit's checklist, an asset whose latest field inspection found a problem, a failed tick on
// a check log (fire alarm test, walk-round…), an outlet whose latest water temperature is out of range, equipment that
// failed its inspection, and open safety actions.
// A suggestion goes away once a job carries its key (fromCheck), or the office dismisses it (org:followups).
import { WATER_LIMITS } from "../../lib/constants.js";
import { addDays, fmtDate } from "../../lib/utils.js";

export const SUGGEST_DAYS = 90;   // older failures are history, not a to-do

// A job raised by older versions straight from a failed visit item counts as that suggestion's job.
const legacyMatch = (works, deviceId, date, item) => works.some((w) => w.source === "checklist" && w.deviceId === deviceId && w.dateRaised === date && String(w.description || "").startsWith(`Failed check: ${item}`));

export function jobSuggestions({ siteId, today = new Date().toISOString().slice(0, 10), services = [], deviceById = {}, logEntries = [], logDefs = [], waterReadings = [], waterOutlets = [], equipment = [], actions = [], works = [], followups = [] }) {
  const since = addDays(today, -SUGGEST_DAYS);
  const taken = new Set([...works.map((w) => w.fromCheck).filter(Boolean), ...followups.map((f) => f.id)]);
  const out = [];
  const push = (s) => { if (!taken.has(s.key)) out.push(s); };
  // 1. visits: failed checklist items
  services.forEach((v) => {
    const dev = deviceById[v.deviceId];
    if (!dev || (siteId && dev.locationId !== siteId) || !v.date || v.date < since) return;
    (v.checklistResults || []).filter((r) => r.result === "fail").forEach((r) => {
      if (legacyMatch(works, v.deviceId, v.date, r.item)) return;
      push({ key: `vc:${v.id}:${r.item}`, kind: "Visit check", date: v.date, title: `${dev.name}: ${r.item}`, detail: `Failed at the visit on ${fmtDate(v.date)}${r.note ? ` — ${r.note}` : ""}`,
        priority: "high", prefill: { deviceId: v.deviceId, description: `Failed check: ${r.item}${r.note ? ` — ${r.note}` : ""}`, priority: "high", supplierId: v.supplierId || dev.supplierId || null } });
    });
  });
  // 1b. field inspections (Phase 2 field mode): an asset whose latest inspection found a problem
  Object.values(deviceById).forEach((dev) => {
    if (!dev || dev.archived || (siteId && dev.locationId !== siteId)) return;
    const last = (dev.notesLog || []).filter((n) => n.kind === "inspection").sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
    if (!last || last.result === "ok" || !last.at || last.at.slice(0, 10) < since) return;
    push({ key: `in:${dev.id}:${last.id}`, kind: "Inspection", date: last.at.slice(0, 10), title: `${dev.name}: ${last.result === "failed" ? "not working" : "needs attention"}`, detail: `${last.text.replace(/^Inspection: [^—]*(— )?/, "") || "No details"} · ${last.by || ""}, ${fmtDate(last.at.slice(0, 10))}`,
      priority: last.result === "failed" ? "high" : "medium", prefill: { deviceId: dev.id, description: last.text.replace(/^Inspection: /, ""), priority: last.result === "failed" ? "high" : "medium", supplierId: dev.supplierId || null } });
  });
  // 2. check logs: a tick box left unticked means that check failed
  const defs = Object.fromEntries((logDefs || []).map((d) => [d.id, d]));
  logEntries.forEach((e) => {
    const d = defs[e.logId];
    if (!d || (siteId && e.locationId !== siteId) || !e.date || e.date < since) return;
    (d.fields || []).filter((f) => f.type === "check" && e.values && e.values[f.key] === false).forEach((f) => {
      push({ key: `log:${e.id}:${f.key}`, kind: "Check log", date: e.date, title: `${d.name}: ${f.label}`, detail: `Failed on ${fmtDate(e.date)}${e.by ? ` (${e.by})` : ""}${e.values?.notes ? ` — ${e.values.notes}` : ""}`,
        priority: /fire|alarm|exit|emergency/i.test(`${d.name} ${f.label}`) ? "high" : "medium",
        prefill: { place: true, description: `${d.name} — failed: ${f.label}${e.values?.notes ? ` (${e.values.notes})` : ""}`, priority: /fire|alarm|exit|emergency/i.test(`${d.name} ${f.label}`) ? "high" : "medium" } });
    });
  });
  // 3. water temperatures: an outlet whose latest reading is out of range
  waterOutlets.filter((o) => !o.archived && (!siteId || o.locationId === siteId) && WATER_LIMITS[o.type]).forEach((o) => {
    const last = waterReadings.filter((r) => r.outletId === o.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!last || last.date < since || WATER_LIMITS[o.type].ok(Number(last.temp))) return;
    push({ key: `wr:${last.id}`, kind: "Water temperature", date: last.date, title: `${o.name}: ${last.temp}°C`, detail: `${WATER_LIMITS[o.type].label} water should be ${WATER_LIMITS[o.type].rule} — read on ${fmtDate(last.date)}`,
      priority: "high", prefill: { place: true, description: `Water temperature out of range at ${o.name}: ${last.temp}°C (should be ${WATER_LIMITS[o.type].rule})`, priority: "high", category: "Plumbing" } });
  });
  // 4. equipment that failed its inspection
  equipment.filter((q) => q.status === "failed" && (!siteId || q.locationId === siteId)).forEach((q) => {
    push({ key: `eq:${q.id}:${q.lastInspected || ""}`, kind: "Equipment inspection", date: q.lastInspected || "", title: `${q.name}${q.ref ? ` (${q.ref})` : ""}`, detail: `Failed its inspection${q.lastInspected ? ` on ${fmtDate(q.lastInspected)}` : ""} — repair or replace`,
      priority: "high", prefill: { place: true, description: `Repair or replace ${q.name}${q.ref ? ` (${q.ref})` : ""} — failed its inspection`, priority: "high" } });
  });
  // 5. open safety actions with no job yet
  actions.filter((a) => (!siteId || a.locationId === siteId) && !["done", "closed", "complete", "completed"].includes(a.status) && !a.workId).forEach((a) => {
    push({ key: `ac:${a.id}`, kind: "Safety action", date: a.due || "", title: a.finding || a.action || "Safety action", detail: [a.source, a.action && a.finding ? `Action: ${a.action}` : "", a.due ? `due ${fmtDate(a.due)}` : "", a.owner ? `owner ${a.owner}` : ""].filter(Boolean).join(" · "),
      priority: a.priority === "high" ? "high" : a.priority === "low" ? "low" : "medium", prefill: { place: true, description: [a.finding, a.action].filter(Boolean).join(" — "), priority: a.priority || "medium", actionId: a.id } });
  });
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((x, y) => (rank[x.priority] - rank[y.priority]) || String(y.date).localeCompare(String(x.date)));
}
