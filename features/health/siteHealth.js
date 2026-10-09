// Site health: six scores out of 100 and an overall score. No guesswork — each score lists exactly what
// added or took away points, so anyone can check it and see what to fix.
import { computeCompliance, daysUntil, replacementYear, workSla } from "../../lib/utils.js";
import { assetStatus } from "../assets/places.js";

export const HEALTH_PARTS = [
  { key: "maintenance", label: "Maintenance", weight: 25, go: "ops.ppm" },
  { key: "compliance", label: "Compliance", weight: 25, go: "safety.register" },
  { key: "safety", label: "Safety", weight: 20, go: "safety.incidents" },
  { key: "assets", label: "Assets", weight: 10, go: "assets.register" },
  { key: "suppliers", label: "Suppliers", weight: 10, go: "people.suppliers" },
  { key: "financial", label: "Financial", weight: 10, go: "money.overview" },
];
export function healthBand(score) {
  if (score == null) return { label: "No data", tone: "muted" };
  return score >= 85 ? { label: "Good", tone: "ok" } : score >= 70 ? { label: "Fair", tone: "warn" } : { label: "Needs attention", tone: "danger" };
}
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function computeSiteHealth({ devices = [], services = [], works = [], visitBudgets = [], suppliers = [], register = null, incidents = [], actions = [], permits = [], budget = null, invoices = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const active = devices.filter((d) => !d.archived);
  const parts = {};

  // Maintenance: planned visits done on time over the past year, minus what's overdue now
  {
    const f = [];
    const comp = computeCompliance(active, visitBudgets, services);
    let s = comp.pct == null ? 100 : comp.pct;
    f.push(comp.pct == null ? { text: "No planned visits have fallen due yet", effect: 0, base: true } : { text: `${comp.pct}% of planned visits done on time (${comp.totals.onTime} of ${comp.total}) — starting score`, effect: 0, base: true });
    const overdue = active.filter((d) => d.nextServiceDate && daysUntil(d.nextServiceDate) < 0);
    const crit = overdue.filter((d) => d.criticality === "critical" || d.criticality === "high");
    const pen1 = Math.min(40, (overdue.length - crit.length) * 4 + crit.length * 8);
    if (overdue.length) { f.push({ text: `${plural(overdue.length, "service")} overdue now${crit.length ? ` (${crit.length} critical/high)` : ""}`, effect: -pen1 }); s -= pen1; }
    const late = works.filter((w) => { const x = workSla(w); return x && !x.done && x.breached; });
    const pen2 = Math.min(20, late.length * 2);
    if (late.length) { f.push({ text: `${plural(late.length, "reactive job")} past target date`, effect: -pen2 }); s -= pen2; }
    parts.maintenance = active.length ? { score: clamp(s), factors: f } : { score: null, factors: [{ text: "No services set up yet", effect: 0 }] };
  }
  // Compliance: share of register items green (amber counts half)
  if (register && register.total) {
    const { red, amber, green } = register.counts;
    const s = (100 * (green + 0.5 * amber)) / register.total;
    parts.compliance = { score: clamp(s), factors: [
      { text: `${register.total} requirements tracked — score is green items plus half the amber ones, as a share of all`, effect: 0, base: true },
      { text: `${green} green`, effect: 0 }, ...(amber ? [{ text: `${amber} amber (due soon or something missing)`, effect: -Math.round((50 * amber) / register.total) }] : []),
      ...(red ? [{ text: `${red} red (overdue, expired or failed)`, effect: -Math.round((100 * red) / register.total) }] : []),
    ] };
  } else parts.compliance = { score: null, factors: [{ text: "Nothing in the compliance register yet", effect: 0 }] };
  // Safety: open incidents, overdue actions, permits past their end time
  {
    const f = [{ text: "Starts at 100", effect: 0, base: true }]; let s = 100;
    const openInc = incidents.filter((i) => i.status !== "closed");
    const serious = openInc.filter((i) => i.type === "injury" || i.riddor);
    const p1 = Math.min(30, (openInc.length - serious.length) * 5 + serious.length * 10);
    if (openInc.length) { f.push({ text: `${plural(openInc.length, "incident")} still open${serious.length ? ` (${serious.length} injury/RIDDOR)` : ""}`, effect: -p1 }); s -= p1; }
    const unreported = incidents.filter((i) => i.riddor && !i.riddorReported);
    if (unreported.length) { f.push({ text: `${plural(unreported.length, "RIDDOR report")} not made`, effect: -15 }); s -= 15; }
    const od = actions.filter((a) => a.status !== "done" && a.due && a.due < today);
    const odHigh = od.filter((a) => a.priority === "high");
    const p2 = Math.min(30, (od.length - odHigh.length) * 4 + odHigh.length * 8);
    if (od.length) { f.push({ text: `${plural(od.length, "safety action")} overdue${odHigh.length ? ` (${odHigh.length} high priority)` : ""}`, effect: -p2 }); s -= p2; }
    const nowT = new Date().toISOString().slice(0, 16);
    const stale = permits.filter((p) => p.status === "open" && p.end && p.end < nowT);
    if (stale.length) { const p3 = Math.min(15, stale.length * 5); f.push({ text: `${plural(stale.length, "permit")} still open after its end time`, effect: -p3 }); s -= p3; }
    if (f.length === 1) f.push({ text: "Nothing open or overdue", effect: 0 });
    parts.safety = { score: clamp(s), factors: f };
  }
  // Assets: condition grades and current status
  if (active.length) {
    const f = []; const g = { A: 100, B: 80, C: 45, D: 10 };
    const graded = active.filter((d) => g[d.condition] !== undefined);
    let s;
    const st = active.map((d) => assetStatus(d, { works, services }).key);
    const failed = st.filter((x) => x === "failed").length, offline = st.filter((x) => x === "offline").length;
    const statusScore = clamp(100 - failed * 15 - offline * 10);
    if (graded.length) {
      const avg = graded.reduce((t, d) => t + g[d.condition], 0) / graded.length;
      s = 0.6 * avg + 0.4 * statusScore;
      f.push({ text: `Condition of ${graded.length} graded asset${graded.length === 1 ? "" : "s"} averages ${Math.round(avg)} (A=100, B=80, C=45, D=10) — 60% of the score`, effect: 0, base: true });
    } else { s = statusScore; f.push({ text: "No assets have a condition grade yet — score is from status only", effect: 0, base: true }); }
    if (failed || offline) f.push({ text: `${failed} failed, ${offline} offline (−15 / −10 each, 40% of the score)`, effect: -Math.round((100 - statusScore) * (graded.length ? 0.4 : 1)) });
    const yr = new Date().getFullYear();
    const eol = active.filter((d) => { const r = replacementYear(d); return r && r <= yr; });
    if (eol.length) { const p = Math.min(10, eol.length * 2); f.push({ text: `${plural(eol.length, "asset")} at or past end of life`, effect: -p }); s -= p; }
    parts.assets = { score: clamp(s), factors: f };
  } else parts.assets = { score: null, factors: [{ text: "No assets yet", effect: 0 }] };
  // Suppliers: jobs completed within target, insurance and contracts in date
  {
    const sup = suppliers.filter((s) => s.status !== "blocked");
    if (!sup.length) parts.suppliers = { score: null, factors: [{ text: "No suppliers yet", effect: 0 }] };
    else {
      const f = []; const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      const done = works.filter((w) => w.status === "completed" && w.supplierId && (w.completedAt || "") >= yearAgo);
      const onTime = done.filter((w) => { const x = workSla(w); return x && !x.breached; }).length;
      let s = done.length ? (100 * onTime) / done.length : 100;
      f.push(done.length ? { text: `${onTime} of ${done.length} supplier jobs in the last year finished within target — starting score`, effect: 0, base: true } : { text: "No completed supplier jobs in the last year — starts at 100", effect: 0, base: true });
      const insExp = sup.filter((x) => x.insuranceExpiry && daysUntil(x.insuranceExpiry) < 0);
      const insSoon = sup.filter((x) => x.insuranceExpiry && daysUntil(x.insuranceExpiry) >= 0 && daysUntil(x.insuranceExpiry) <= 30);
      const conExp = sup.filter((x) => x.contractEnd && daysUntil(x.contractEnd) < 0);
      if (insExp.length) { const p = Math.min(45, insExp.length * 15); f.push({ text: `${plural(insExp.length, "supplier")} with expired insurance`, effect: -p }); s -= p; }
      if (insSoon.length) { const p = Math.min(15, insSoon.length * 5); f.push({ text: `${plural(insSoon.length, "supplier")} with insurance expiring within 30 days`, effect: -p }); s -= p; }
      if (conExp.length) { const p = Math.min(30, conExp.length * 10); f.push({ text: `${plural(conExp.length, "contract")} expired`, effect: -p }); s -= p; }
      parts.suppliers = { score: clamp(s), factors: f };
    }
  }
  // Financial: year-end forecast against budget, and invoices waiting
  if (budget && budget.budget > 0) {
    const f = []; let s = 100;
    const over = budget.forecast / budget.budget - 1;
    f.push({ text: `Forecast ${Math.round((budget.forecast / budget.budget) * 100)}% of budget${over > 0 ? " — each 1% over takes off 4 points" : " — within budget"}`, effect: over > 0 ? -Math.min(100, Math.round(over * 400)) : 0, base: over <= 0 });
    if (over > 0) s -= Math.min(100, over * 400);
    const stale = invoices.filter((i) => i.status === "received" && i.date && daysUntil(i.date) < -14);
    if (stale.length) { const p = Math.min(15, stale.length * 3); f.push({ text: `${plural(stale.length, "invoice")} waiting over 14 days for approval`, effect: -p }); s -= p; }
    const late = invoices.filter((i) => !["paid", "disputed"].includes(i.status) && i.dueDate && daysUntil(i.dueDate) < 0);
    if (late.length) { const p = Math.min(15, late.length * 3); f.push({ text: `${plural(late.length, "invoice")} past the payment date`, effect: -p }); s -= p; }
    parts.financial = { score: clamp(s), factors: f };
  } else parts.financial = { score: null, factors: [{ text: "No budget set for this year", effect: 0 }] };

  const avail = HEALTH_PARTS.filter((p) => parts[p.key].score != null);
  const wsum = avail.reduce((t, p) => t + p.weight, 0);
  const overall = wsum ? clamp(avail.reduce((t, p) => t + parts[p.key].score * p.weight, 0) / wsum) : null;
  return { overall, parts, weights: Object.fromEntries(HEALTH_PARTS.map((p) => [p.key, p.weight])), used: avail.map((p) => p.key) };
}
