// What the QR pages (no login) can read and save.
// Cloud mode: narrow database functions (ppm_public_read / ppm_public_write in supabase-setup.sql) —
// the page never sees the rest of the company's data.
// Local mode: the same results built from this browser's data (works on the device that holds the data).
import { SKEYS } from "./constants.js";
import { loadShared, saveShared } from "./storage.js";
import { uid } from "./utils.js";

const cloud = () => (typeof window !== "undefined" ? window.ppmCloud : null);
const orgFromUrl = () => { try { return new URLSearchParams(window.location.search).get("o") || null; } catch (e) { return null; } };
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const open = (w) => !["completed", "rejected"].includes(w.status);
const isImg = (p, max = 700000) => typeof p === "string" && p.startsWith("data:image/") && p.length <= max;

export async function publicRead(kind, ref, site) {
  const c = cloud();
  if (c) return c.publicRead(kind, ref, orgFromUrl(), site);
  if (kind === "request") {
    const [devices, locations, works, st] = await Promise.all([loadShared(SKEYS.devices), loadShared(SKEYS.locations), loadShared(SKEYS.works), loadShared(SKEYS.settings)]);
    const d = devices.find((x) => x.id === ref); if (!d) return null;
    const loc = locations.find((l) => l.id === d.locationId) || null;
    const t = today();
    const onCall = (st && !Array.isArray(st) ? (st.onCall || {})[d.locationId] || [] : []).find((r) => (r.from || "") <= t && (!r.to || r.to >= t)) || null;
    return { device: { id: d.id, name: d.name, locationId: d.locationId, area: d.area, checklist: d.checklist || [] }, location: loc && { id: loc.id, name: loc.name, phone: loc.phone, requestCategories: loc.requestCategories },
      recent: works.filter((w) => w.deviceId === ref && open(w)).slice(0, 8).map((w) => ({ id: w.id, description: w.description, dateRaised: w.dateRaised, status: w.status })), onCall: onCall && { name: onCall.name, phone: onCall.phone } };
  }
  if (kind === "supplier") {
    const [sups, works, devices, locations, st] = await Promise.all([loadShared(SKEYS.suppliers), loadShared(SKEYS.works), loadShared(SKEYS.devices), loadShared(SKEYS.locations), loadShared(SKEYS.settings)]);
    const sup = sups.find((s) => s.portalToken && s.portalToken === ref); if (!sup) return null;
    const mine = works.filter((w) => w.supplierId === sup.id && open(w)).map((w) => ({ ...w, supplierDone: w.supplierDone ? { ...w.supplierDone, photos: undefined, signature: undefined } : undefined }));
    return { supplier: { id: sup.id, name: sup.name }, works: mine, devices: devices.filter((d) => mine.some((w) => w.deviceId === d.id)), locations: locations.map((l) => ({ id: l.id, name: l.name })),
      sla: { days: (st && st.slaDays) || {}, workingDays: !!(st && st.slaWorkingDays) } };
  }
  if (kind === "meter") {
    const [meters, readings, locations] = await Promise.all([loadShared(SKEYS.meters), loadShared(SKEYS.meterReadings), loadShared(SKEYS.locations)]);
    const m = meters.find((x) => x.id === ref); if (!m) return null;
    const last = readings.filter((r) => r.meterId === ref).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const loc = locations.find((l) => l.id === m.locationId);
    return { meter: m, location: loc ? { id: loc.id, name: loc.name } : null, last: last ? { value: last.value, date: last.date } : null };
  }
  const locations = await loadShared(SKEYS.locations);
  const loc = locations.find((l) => l.id === (kind === "check" ? site : ref)); if (!loc) return null;
  if (kind === "feedback") return { location: { id: loc.id, name: loc.name } };
  const st = await loadShared(SKEYS.settings);
  if (kind === "check") {
    const entries = await loadShared(SKEYS.logEntries);
    const def = (st && !Array.isArray(st) ? st.logDefs || [] : []).find((d) => d.id === ref) || null;
    const last = entries.filter((e) => e.logId === ref && e.locationId === site).sort((a, b) => String(b.at || b.date).localeCompare(String(a.at || a.date)))[0];
    return { location: { id: loc.id, name: loc.name }, def, last: last ? { at: last.at, date: last.date, by: last.by } : null };
  }
  if (kind === "signin") {
    const [sups, sis] = await Promise.all([loadShared(SKEYS.suppliers), loadShared(SKEYS.signins)]);
    const info = st && !Array.isArray(st) ? (st.siteInfo || {})[ref] || {} : {};
    return { location: { id: loc.id, name: loc.name, induction: loc.induction, inductionUrl: loc.inductionUrl }, info: { access: info.access, notes: info.notes },
      suppliers: sups.filter((s) => s.locationId === ref).map((s) => ({ id: s.id, name: s.name })), onSite: sis.filter((x) => x.locationId === ref && !x.outAt).map((x) => ({ id: x.id, name: x.name, company: x.company, kind: x.kind })) };
  }
  return null;
}

async function prepend(key, rec, keep) {
  const latest = await loadShared(key); // re-read so we don't overwrite someone else's change
  const next = [rec, ...(Array.isArray(latest) ? latest : [])];
  await saveShared(key, keep ? next.slice(0, keep) : next);
}

export async function publicWrite(kind, ref, data) {
  const c = cloud();
  if (c) return c.publicWrite(kind, ref, data, orgFromUrl());
  const name = String(data.name || "").trim().slice(0, 80); const id = uid(); const at = nowIso();
  if (kind === "request") {
    const devices = await loadShared(SKEYS.devices); const d = devices.find((x) => x.id === ref); if (!d) throw new Error("This QR code doesn't match a service any more.");
    if (!name || !String(data.description || "").trim()) throw new Error("Please add your name and describe the problem.");
    const rec = { id, deviceId: ref, description: String(data.description).trim().slice(0, 2000), quoteAmount: 0, dateRaised: today(), status: "requested", budgetType: "budgeted",
      photos: isImg(data.photo) ? [data.photo] : [], priority: ["low", "medium", "high"].includes(data.priority) ? data.priority : "medium", supplierId: d.supplierId || null, comments: [],
      source: "request", requestedBy: name, requesterEmail: String(data.email || "").trim() || undefined, loggedAt: at };
    await prepend(SKEYS.works, rec); return { id };
  }
  if (kind === "engineer") {
    const devices = await loadShared(SKEYS.devices); const d = devices.find((x) => x.id === ref); if (!d) throw new Error("This QR code doesn't match a service any more.");
    if (!name) throw new Error("Please enter your name.");
    await prepend(SKEYS.visitSubmissions, { id, deviceId: ref, locationId: d.locationId, name, company: String(data.company || "").trim(), date: data.date || today(), arrived: data.arrived || "", left: data.left || "",
      notes: String(data.notes || "").trim(), checks: (data.checks || []).slice(0, 100), photos: (data.photos || []).filter((p) => isImg(p)).slice(0, 3), submittedAt: at }, 500);
    return { id };
  }
  if (kind === "supplier") {
    const [sups, works] = await Promise.all([loadShared(SKEYS.suppliers), loadShared(SKEYS.works)]);
    const sup = sups.find((s) => s.portalToken && s.portalToken === ref); if (!sup) throw new Error("This job link has expired or been replaced.");
    const w = works.find((x) => x.id === data.workId);
    if (!w || w.supplierId !== sup.id || !open(w)) throw new Error("This job isn't open for you any more.");
    if (!name) throw new Error("Please enter your name first.");
    const p = data.patch || {}; const patch = {};
    if (p.supplierAck) patch.supplierAck = { name, at, ...(p.supplierAck.declined ? { declined: true, reason: String(p.supplierAck.reason || "").slice(0, 500) || undefined } : {}) };
    if (p.eta && /^\d{4}-\d{2}-\d{2}$/.test(p.eta)) patch.eta = p.eta;
    if (p.attendedAt) patch.attendedAt = at.slice(0, 16);
    if (p.supplierDone) {
      const photos = (p.supplierDone.photos || []).filter((x) => isImg(x)).slice(0, 3);
      patch.supplierDone = { name, at, notes: String(p.supplierDone.notes || "").slice(0, 4000), photos, signature: isImg(p.supplierDone.signature, 300000) ? p.supplierDone.signature : null };
      patch.photos = [...(w.photos || []), ...photos].slice(0, 8);
    }
    const comment = String(data.comment || "").slice(0, 1000);
    await saveShared(SKEYS.works, works.map((x) => x.id === w.id ? { ...x, ...patch, ...(comment ? { comments: [...(x.comments || []), { text: comment, by: `${sup.name} (supplier portal)`, at }] } : {}) } : x));
    return { ok: true };
  }
  if (kind === "meter") {
    const v = Number(String(data.value).replace(/,/g, ""));
    if (!name || data.value === "" || isNaN(v)) throw new Error("Please enter your name and the reading.");
    await prepend(SKEYS.meterReadings, { id, meterId: ref, date: today(), value: v, by: `${name} (QR)`, at, viaQR: true, photo: isImg(data.photo) ? data.photo : undefined, reset: data.reset ? true : undefined });
    return { id };
  }
  if (kind === "feedback") {
    const ratings = {}; Object.entries(data.ratings || {}).forEach(([k, n]) => { if ([1, 2, 3, 4, 5].includes(Number(n))) ratings[k] = Number(n); });
    await prepend(SKEYS.feedback, { id, locationId: ref, area: String(data.area || ""), ratings, comment: String(data.comment || "").trim(), at }, 5000);
    return { id };
  }
  if (kind === "check") {
    if (!name) throw new Error("Please enter your name.");
    await prepend(SKEYS.logEntries, { id, logId: ref, locationId: data.locationId, date: today(), values: data.values || {}, by: `${name} (QR)`, at, viaQR: true }, 20000);
    return { id };
  }
  if (kind === "signin") {
    if (!name) throw new Error("Please enter your name.");
    const kindV = data.kind === "visitor" ? "visitor" : "contractor";
    await prepend(SKEYS.signins, { id, locationId: ref, kind: kindV, name, company: String(data.company || "").trim(), phone: String(data.phone || "").trim(), purpose: String(data.purpose || "").trim(), host: String(data.host || "").trim(),
      inducted: kindV === "contractor" ? true : undefined, inductedAt: at, ramsChecked: false, inAt: at, outAt: null, by: "Self sign-in", selfService: true }, 2000);
    return { id };  // (on this device anyone may sign out — the database version checks a key or the mobile number)
  }
  if (kind === "signout") {
    const latest = await loadShared(SKEYS.signins); const e = latest.find((x) => x.id === data.id && x.locationId === ref && !x.outAt);
    if (!e) throw new Error("You're already signed out.");
    await saveShared(SKEYS.signins, latest.map((x) => x.id === data.id ? { ...x, outAt: at, outBy: "Self sign-out" } : x));
    return { name: e.name };
  }
  throw new Error("Unknown page.");
}
