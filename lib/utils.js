// Helpers: dates, money, CSV, images, compliance maths, meter stats.
import { COMPLIANCE_GRACE_DAYS, CURRENCIES, SLA_DAYS } from "./constants.js";
import { ACTIVE_CURRENCY_CODE, ACTIVE_CUSTOM_FIELDS, ACTIVE_SLA } from "./globals.js";

// A plan line whose actual was copied from a logged visit: the visit already counts as spend,
// so spend totals skip the line to avoid counting the same money twice.
export const isMirrored = (l) => l && l.actualSource === "visit";

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export function workSla(w) {
  if (!w?.dateRaised || w.status === "rejected") return null;
  const days = (ACTIVE_SLA || SLA_DAYS)[w.priority || "medium"] ?? 7;
  const deadline = ACTIVE_SLA?.workingDays ? addWorkingDays(w.dateRaised, days) : addDays(w.dateRaised, days);
  const today = new Date().toISOString().slice(0, 10);
  if (w.status === "completed") return { deadline, done: true, breached: !!w.completedAt && w.completedAt > deadline };
  return { deadline, done: false, breached: today > deadline, dueSoon: today <= deadline && today >= addDays(deadline, -1) };
}

export function matchStatutory(item, d) {
  const hay = ` ${[d.name, d.category, d.subCategory].filter(Boolean).join(" ").toLowerCase()} `;
  return item.keywords.some((k) => k.length <= 3 ? new RegExp(`\\b${k}\\b`).test(hay) : hay.includes(k));
}

// A booking only counts for the visit that is currently due.
export function currentBooking(d) { return d?.booking && d.booking.forDue === d.nextServiceDate ? d.booking : null; }

// Year an asset is due for replacement, from its install date and expected life.
export function replacementYear(d) {
  if (!d?.installDate || !Number(d.expectedLifeYears)) return null;
  return Number(d.installDate.slice(0, 4)) + Number(d.expectedLifeYears);
}

export function gbp(amount) {
  const code = CURRENCIES[ACTIVE_CURRENCY_CODE] ? ACTIVE_CURRENCY_CODE : "GBP";
  return (Number(amount) || 0).toLocaleString(CURRENCIES[code].locale, { style: "currency", currency: code, maximumFractionDigits: 0 });
}

export function toCSV(rows) {
  return rows.map((row) => row.map((cell) => {
    const s = String(cell ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
}

export function csvHref(rows) {
  return "data:text/csv;charset=utf-8," + encodeURIComponent(toCSV(rows));
}

export function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function addMonths(dateStr, months) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

export function inBlackout(iso, blackouts) { return (blackouts || []).find((b) => iso >= b.start && iso <= b.end) || null; }

export function isWeekend(iso) { const wd = new Date(iso + "T00:00:00").getDay(); return wd === 0 || wd === 6; }

// Move a date forward out of any blackout period (and off weekends if asked).
export function shiftDate(iso, blackouts, avoidWeekends) {
  if (!iso) return iso;
  let d = iso;
  for (let i = 0; i < 400; i++) {
    const b = inBlackout(d, blackouts);
    if (b) { d = addDays(b.end, 1); continue; }
    if (avoidWeekends && isWeekend(d)) { d = addDays(d, 1); continue; }
    break;
  }
  return d;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

export function dueStatus(dateStr, everServiced) {
  const d = daysUntil(dateStr);
  if (d === null) return everServiced ? { label: "Completed", tone: "ok" } : { label: "Not yet scheduled", tone: "muted" };
  if (d < 0) return { label: `Overdue ${Math.abs(d)}d`, tone: "danger" };
  if (d <= 30) return { label: `Due in ${d}d`, tone: "warn" };
  return { label: `Due in ${d}d`, tone: "ok" };
}

export function toISODate(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

// Returns a flat array of cells (Date or null for padding) for a Mon-start month grid.
export function getMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ---------------------------------------------------------
   Image compression
--------------------------------------------------------- */
export function compressImage(file, maxDim = 900, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------
   QR codes & public request portal
--------------------------------------------------------- */
export function appBaseUrl() {
  if (typeof window === "undefined") return "";
  return window.location.origin + window.location.pathname;
}

export function qrImageUrl(data, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}

export function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function meterStats(m, readings) {
  const rs = readings.filter((r) => r.meterId === m.id).sort((a, b) => a.date.localeCompare(b.date) || String(a.at).localeCompare(String(b.at)));
  const periods = [];
  for (let i = 1; i < rs.length; i++) {
    if (rs[i].reset) continue; // meter replaced — no consumption across the swap
    const days = Math.max(1, Math.round((new Date(rs[i].date) - new Date(rs[i - 1].date)) / 86400000));
    periods.push({ from: rs[i - 1].date, to: rs[i].date, used: Number(rs[i].value) - Number(rs[i - 1].value), days });
  }
  const monthly = {};
  periods.forEach((p) => { const k = p.to.slice(0, 7); monthly[k] = (monthly[k] || 0) + p.used; });
  const last = rs[rs.length - 1] || null;
  const lastP = periods[periods.length - 1] || null;
  const avgDaily = periods.length ? periods.reduce((t, p) => t + p.used, 0) / periods.reduce((t, p) => t + p.days, 0) : null;
  const lastDaily = lastP ? lastP.used / lastP.days : null;
  return { rs, periods, monthly, last, lastP, avgDaily, lastDaily, spike: avgDaily && lastDaily && periods.length >= 3 && lastDaily > avgDaily * 1.25 };
}

/* ---------------------------------------------------------
   Import services from a spreadsheet (CSV or pasted cells)
--------------------------------------------------------- */
export function parseDelimited(text) {
  const first = text.split(/\r?\n/)[0] || "";
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

export function toISO(v) {
  const t = String(v || "").trim(); if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return null;
}

/* ---------------------------------------------------------
   Audits (cleaning, washroom, walk-round) with scores
--------------------------------------------------------- */
export function scoreTone(p) { return p >= 85 ? ["#2F855A", "#EAF4EE"] : p >= 70 ? ["#B7791F", "#FDF1E0"] : ["#C53030", "#FBEAEA"]; }

export function computeCompliance(devices, visitBudgets, services) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const DAY = 86400000;
  const t = (d) => new Date(d + "T00:00:00").getTime();
  const perDevice = [];
  devices.forEach((dev) => {
    const planned = [...new Set(visitBudgets.filter((v) => v.deviceId === dev.id).map((v) => v.date))].sort();
    const due = planned.filter((d) => d <= todayISO);
    if (due.length === 0) return;
    const visits = services.filter((s) => s.deviceId === dev.id && s.date && !s.aborted && !s.skipped).map((s) => s.date).sort();
    const used = new Set();
    let onTime = 0, late = 0, missed = 0;
    due.forEach((pd, i) => {
      const nextPlanned = planned[planned.indexOf(pd) + 1];
      let match = visits.findIndex((vd, vi) => !used.has(vi) && Math.abs(t(vd) - t(pd)) <= COMPLIANCE_GRACE_DAYS * DAY);
      if (match >= 0) { used.add(match); onTime++; return; }
      match = visits.findIndex((vd, vi) => !used.has(vi) && t(vd) > t(pd) && (!nextPlanned || vd < nextPlanned));
      if (match >= 0) { used.add(match); late++; return; }
      // still inside the grace window — not missed yet
      if ((Date.now() - t(pd)) / DAY <= COMPLIANCE_GRACE_DAYS) return;
      missed++;
    });
    const total = onTime + late + missed;
    if (total > 0) perDevice.push({ device: dev, onTime, late, missed, total, pct: Math.round((onTime / total) * 100) });
  });
  const totals = perDevice.reduce((a, r) => ({ onTime: a.onTime + r.onTime, late: a.late + r.late, missed: a.missed + r.missed }), { onTime: 0, late: 0, missed: 0 });
  const total = totals.onTime + totals.late + totals.missed;
  const answered = services.flatMap((s) => (s.checklistResults || []).filter((r) => r.result === "pass" || r.result === "fail"));
  const passed = answered.filter((r) => r.result === "pass").length;
  return {
    perDevice: perDevice.sort((a, b) => a.pct - b.pct), totals, total,
    pct: total ? Math.round((totals.onTime / total) * 100) : null,
    checklistPct: answered.length ? Math.round((passed / answered.length) * 100) : null, checksAnswered: answered.length,
  };
}

/* ---------------------------------------------------------
   Chasing overdue jobs: one pre-written email per supplier manager
--------------------------------------------------------- */
export function relativeDays(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function supplierStats(s, { devices, services, works, budgetLines, visitBudgets }, year) {
  const yr = (d) => !year || (d && new Date(d).getFullYear() === year);
  const devs = devices.filter((d) => d.supplierId === s.id);
  const comp = computeCompliance(devs, visitBudgets, services);
  const visits = services.filter((v) => (v.supplierId === s.id || (!v.supplierId && devs.some((d) => d.id === v.deviceId))) && yr(v.date));
  const lines = budgetLines.filter((l) => l.supplierId === s.id && l.actualAmount != null && yr(l.date));
  const variances = lines.map((l) => Number(l.actualAmount) - Number(l.amount));
  const avgVar = variances.length ? variances.reduce((a, b) => a + b, 0) / variances.length : null;
  const budgeted = lines.reduce((a, l) => a + (Number(l.amount) || 0), 0);
  const fails = visits.reduce((a, v) => a + (v.checklistResults || []).filter((r) => r.result === "fail").length, 0);
  const checks = visits.reduce((a, v) => a + (v.checklistResults || []).filter((r) => r.result === "pass" || r.result === "fail").length, 0);
  const jobs = works.filter((w) => w.supplierId === s.id && yr(w.dateRaised));
  const chases = devs.reduce((a, d) => a + (d.chaseLog || []).filter((c) => c.supplierId === s.id && yr(c.at)).length, 0);
  const spend = visits.reduce((a, v) => a + (Number(v.cost) || 0), 0) + lines.filter((l) => !isMirrored(l)).reduce((a, l) => a + Number(l.actualAmount), 0);
  // Overall score: on-time (50%), checklist pass (30%), cost within budget (20%) — only parts with data count.
  const parts = [];
  if (comp.pct !== null) parts.push([comp.pct, 50]);
  if (checks) parts.push([Math.round(((checks - fails) / checks) * 100), 30]);
  if (budgeted) parts.push([Math.max(0, Math.min(100, Math.round(100 - (Math.max(0, spend - budgeted) / budgeted) * 100))), 20]);
  const score = parts.length ? Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / parts.reduce((a, [, w]) => a + w, 0)) : null;
  return { comp, visits, lines, avgVar, budgeted, fails, checks, jobs, chases, spend, score, devs };
}

/* ---------------------------------------------------------
   Shared: every real cost in a period, attributed to service/supplier/category.
   Mirrored plan-line actuals are skipped (the visit already counts).
--------------------------------------------------------- */
export function collectActuals({ devices, services, works, budgetLines }, inRange) {
  const devMap = {}; devices.forEach((d) => { devMap[d.id] = d; });
  const out = [];
  services.forEach((v) => { if (v.cost && v.date && inRange(v.date)) out.push({ id: `v-${v.id}`, kind: "Visit", date: v.date, amount: Number(v.cost) || 0, deviceId: v.deviceId, supplierId: v.supplierId || devMap[v.deviceId]?.supplierId || null, category: devMap[v.deviceId]?.serviceCategory || "maintenance", label: v.name || devMap[v.deviceId]?.name || "Visit", ref: v.poNumber || "" }); });
  works.forEach((w) => { if (w.dateRaised && inRange(w.dateRaised) && w.budgetType !== "non_controllable" && ["approved", "in_progress", "completed"].includes(w.status)) out.push({ id: `w-${w.id}`, kind: "Extra work", date: w.dateRaised, amount: Number(w.quoteAmount) || 0, deviceId: w.deviceId, supplierId: w.supplierId || null, category: devMap[w.deviceId]?.serviceCategory || "maintenance", label: w.description, ref: w.poNumber || "" }); });
  budgetLines.forEach((l) => { if (l.actualAmount != null && !isMirrored(l) && l.date && inRange(l.date)) out.push({ id: `l-${l.id}`, kind: "Plan actual", date: l.actualDate || l.date, amount: Number(l.actualAmount) || 0, deviceId: l.deviceId || null, supplierId: l.supplierId || null, category: l.category, label: l.description, ref: l.poNumber || "" }); });
  return out;
}

/* ---------------------------------------------------------
   Calendar export (.ics) — planned visits for the next 12 months
--------------------------------------------------------- */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------------------------------------------------------
   Accounting export — CSV in the layout of common bill-import templates
--------------------------------------------------------- */
export function csvEscape(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export function ukDate(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }

export function plusDays(iso, n) { const x = new Date(iso + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }

/* ---------------------------------------------------------
   Schedule → Capacity: planned visits per supplier per week, plus technician workload
--------------------------------------------------------- */
export function weekStart(iso) { const d = new Date(iso + "T00:00:00"); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.toISOString().slice(0, 10); }

/* ---------------------------------------------------------
   Suggested 12-month plan, from each service's history
--------------------------------------------------------- */
export function median(arr) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

export function suggestForDevice(dev, services, visitBudgets, shiftDateFn) {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })();
  const t = (d) => new Date(d + "T00:00:00").getTime();
  const visits = services.filter((v) => v.deviceId === dev.id && v.date).sort((a, b) => a.date.localeCompare(b.date));
  const planned = [...new Set(visitBudgets.filter((v) => v.deviceId === dev.id).map((v) => v.date))].sort();
  const gaps = (list) => list.slice(1).map((d, i) => Math.round((t(d) - t(list[i])) / 86400000)).filter((g) => g > 0);
  let step = null, basis = "";
  if (dev.serviceIntervalMonths) { step = { months: dev.serviceIntervalMonths }; basis = `repeats every ${dev.serviceIntervalMonths} month${dev.serviceIntervalMonths === 1 ? "" : "s"}`; }
  else if (visits.length >= 3) { const g = median(gaps(visits.map((v) => v.date))); if (g) { step = g >= 25 ? { months: Math.max(1, Math.round(g / 30.44)) } : { days: g }; basis = `from ${visits.length} logged visits`; } }
  if (!step && planned.length >= 2) { const g = median(gaps(planned)); if (g) { step = g >= 25 ? { months: Math.max(1, Math.round(g / 30.44)) } : { days: g }; basis = "from its current plan"; } }
  if (!step && visits.length === 2) { const g = gaps(visits.map((v) => v.date))[0]; if (g) { step = g >= 25 ? { months: Math.max(1, Math.round(g / 30.44)) } : { days: g }; basis = "from 2 logged visits"; } }
  if (!step) return { dev, skip: "One-off or not enough history to spot a pattern" };
  const costs = visits.filter((v) => Number(v.cost) > 0).slice(-3).map((v) => Number(v.cost));
  const amount = costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : Number(dev.budgetPerVisit) || 0;
  const costBasis = costs.length ? `avg of last ${costs.length} visit${costs.length === 1 ? "" : "s"}` : amount ? "budget per visit" : "no cost data";
  const advance = (d) => step.months ? addMonths(d, step.months) : addDays(d, step.days);
  let d = dev.nextServiceDate || (visits.length ? advance(visits[visits.length - 1].date) : today);
  while (d < today) d = advance(d);
  const dates = [];
  for (let i = 0; i < 400 && d <= horizon; i++) { dates.push(shiftDateFn(d)); d = advance(d); }
  const fresh = [...new Set(dates)].filter((x) => !planned.some((p) => Math.abs(t(p) - t(x)) <= 7 * 86400000));
  const label = step.months ? `every ${step.months} month${step.months === 1 ? "" : "s"}` : step.days % 7 === 0 ? `every ${step.days / 7} week${step.days === 7 ? "" : "s"}` : `every ${step.days} days`;
  return { dev, dates: fresh, total: dates.length, already: dates.length - fresh.length, amount, basis, costBasis, label };
}

/* ---------------------------------------------------------
   Camera scanner: native BarcodeDetector where available, otherwise jsQR (loaded on demand)
--------------------------------------------------------- */
export let jsQrPromise = null;

export function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  if (!jsQrPromise) jsQrPromise = new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    sc.onload = () => resolve(); sc.onerror = () => { jsQrPromise = null; reject(new Error("jsqr")); };
    document.head.appendChild(sc);
  });
  return jsQrPromise;
}

/* ---------------------------------------------------------
   Custom fields
--------------------------------------------------------- */
export function fieldsFor(appliesTo, category) { return ACTIVE_CUSTOM_FIELDS.filter((f) => f.appliesTo === appliesTo && (!f.categories?.length || !category || f.categories.includes(category))); }

export function missingRequiredFields(appliesTo, category, values = {}) {
  return fieldsFor(appliesTo, category).filter((f) => f.required && (values[f.id] === undefined || values[f.id] === "" || values[f.id] === null || (f.type === "yesno" && values[f.id] !== true && values[f.id] !== false))).map((f) => f.label);
}

export function formatCustomValues(appliesTo, values = {}) {
  return ACTIVE_CUSTOM_FIELDS.filter((f) => f.appliesTo === appliesTo && values[f.id] !== undefined && values[f.id] !== "")
    .map((f) => `${f.label}: ${values[f.id] === true ? "Yes" : values[f.id] === false ? "No" : f.type === "date" ? fmtDate(values[f.id]) : values[f.id]}`).join(" · ");
}

// Add working days (Mon–Fri) to an ISO date.
export function addWorkingDays(iso, n) {
  const d = new Date(iso + "T00:00:00"); let left = n;
  while (left > 0) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) left--; }
  return d.toISOString().slice(0, 10);
}
// Numeric checklist items, written like "Supply air temperature {18-22 °C}".
export function parseReading(item) {
  const m = String(item || "").match(/\{\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)\s*([^}]*)\}/);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2]), unit: m[3].trim(), label: item.replace(m[0], "").trim() };
}
export function checklistLabel(item) { const r = parseReading(item); return r ? `${r.label} (${r.min}–${r.max}${r.unit ? ` ${r.unit}` : ""})` : item; }
// Out-of-service periods: current one, and % available over the last N days.
export function currentDowntime(d) { const l = (d?.downtime || [])[0]; return l && !l.to ? l : null; }
export function availability(d, days = 90) {
  const end = Date.now(); const start = end - days * 86400000; let down = 0;
  (d?.downtime || []).forEach((p) => { const a = Math.max(start, new Date(p.from).getTime()); const b = Math.min(end, p.to ? new Date(p.to).getTime() : end); if (b > a) down += b - a; });
  return Math.max(0, Math.round((1 - down / (end - start)) * 1000) / 10);
}
