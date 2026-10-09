// Monthly FM report: one document for management, built from the app's records — no spreadsheet work.
import { MONTH_NAMES } from "../../lib/constants.js";
import { computeCompliance, escapeHtml, fmtDate, gbp, workSla } from "../../lib/utils.js";
import { HEALTH_PARTS } from "../health/siteHealth.js";
import { CATEGORY_META } from "../../lib/globals.js";

const ym = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const inMonth = (d, key) => String(d || "").slice(0, 7) === key;

function monthStats(data, key) {
  const { devices, services, works, visitBudgets, incidents = [], actions = [] } = data;
  const visits = services.filter((v) => inMonth(v.date, key) && !v.skipped && !v.aborted);
  const planned = visitBudgets.filter((v) => inMonth(v.date, key));
  const comp = computeCompliance(devices, planned, services);
  const raised = works.filter((w) => inMonth(w.dateRaised, key));
  const done = works.filter((w) => w.status === "completed" && inMonth(w.completedAt, key));
  const inTarget = done.filter((w) => { const s = workSla(w); return s && !s.breached; }).length;
  const spend = visits.reduce((t, v) => t + (Number(v.cost) || 0), 0) + done.filter((w) => !w.warranty && w.budgetType !== "non_controllable").reduce((t, w) => t + (Number(w.finalCost ?? w.quoteAmount) || 0), 0);
  return {
    visits: visits.length, planned: planned.length, onTime: comp.pct, raised: raised.length, completed: done.length,
    slaPct: done.length ? Math.round((100 * inTarget) / done.length) : null, spend,
    incidents: incidents.filter((i) => inMonth(i.date, key)).length,
    actionsClosed: actions.filter((a) => a.status === "done" && inMonth(a.doneAt || a.closedAt, key)).length,
  };
}

export function buildMonthlyFm(data, year, month) {
  const e = escapeHtml;
  const key = ym(year, month); const pm = month === 0 ? 11 : month - 1; const py = month === 0 ? year - 1 : year; const prevKey = ym(py, pm);
  const cur = monthStats(data, key); const prev = monthStats(data, prevKey);
  const { health, register, model, devices, works, suppliers, projects = [], actions = [], incidents = [], services } = data;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = devices.filter((d) => d.nextServiceDate && d.nextServiceDate < today);
  const openWorks = works.filter((w) => !["completed", "rejected"].includes(w.status));
  const reds = register ? register.rows.filter((r) => r.status === "red") : [];
  const openActions = actions.filter((a) => a.status !== "done");
  const openInc = incidents.filter((i) => i.status !== "closed");
  const pctTxt = (x) => (x == null ? "—" : `${x}%`);
  const delta = (a, b, money, good = "up") => {
    if (a == null || b == null) return "";
    const d = a - b; if (!d) return '<span class="muted">no change</span>';
    const better = good === "up" ? d > 0 : d < 0;
    return `<span class="${better ? "ok" : "bad"}">${d > 0 ? "▲" : "▼"} ${money ? gbp(Math.abs(d)) : Math.abs(d)}</span>`;
  };
  // executive summary in plain sentences
  const summary = [
    health && health.overall != null ? `Site health is <b>${health.overall}/100</b>.` : "",
    cur.onTime != null ? `${cur.onTime}% of planned visits due in ${MONTH_NAMES[month]} were done on time${prev.onTime != null ? ` (${prev.onTime}% the month before)` : ""}.` : `${cur.visits} visits were logged in ${MONTH_NAMES[month]}.`,
    `${cur.raised} reactive job${cur.raised === 1 ? " was" : "s were"} raised and ${cur.completed} completed${cur.slaPct != null ? `, ${cur.slaPct}% within target` : ""}. ${openWorks.length} still open.`,
    overdue.length ? `<b class="bad">${overdue.length} service${overdue.length === 1 ? " is" : "s are"} overdue</b> today.` : "No planned maintenance is overdue today.",
    register ? `Compliance: ${register.counts.red} red, ${register.counts.amber} amber, ${register.counts.green} green.` : "",
    model?.budget ? `Spend this year is ${gbp(model.spent)} of a ${gbp(model.budget)} budget; forecast ${gbp(model.forecast)} (${Math.round((model.forecast / model.budget) * 100)}%).` : "",
    cur.incidents ? `${cur.incidents} incident${cur.incidents === 1 ? "" : "s"} recorded.` : "No incidents recorded.",
  ].filter(Boolean);
  const supRows = suppliers.map((s) => {
    const v = services.filter((x) => inMonth(x.date, key) && (x.supplierId === s.id || (!x.supplierId && devices.find((d) => d.id === x.deviceId)?.supplierId === s.id)));
    const j = works.filter((w) => w.supplierId === s.id && w.status === "completed" && inMonth(w.completedAt, key));
    const ok = j.filter((w) => { const x = workSla(w); return x && !x.breached; }).length;
    return { s, v: v.length, j: j.length, ok, spend: v.reduce((t, x) => t + (Number(x.cost) || 0), 0) + j.reduce((t, w) => t + (Number(w.finalCost ?? w.quoteAmount) || 0), 0) };
  }).filter((r) => r.v || r.j);
  const html = `
    <h2>Executive summary</h2><ul>${summary.map((s) => `<li>${s}</li>`).join("")}</ul>
    ${health ? `<h2>Site health</h2><div class="kpis"><div class="kpi">Overall<b>${health.overall ?? "—"}</b></div>${HEALTH_PARTS.map((p) => `<div class="kpi">${e(p.label)}<b>${health.parts[p.key].score ?? "—"}</b></div>`).join("")}</div>` : ""}
    <h2>Trend against ${MONTH_NAMES[pm]}</h2>
    <table><thead><tr><th>Measure</th><th>${MONTH_NAMES[pm]}</th><th>${MONTH_NAMES[month]}</th><th>Change</th></tr></thead><tbody>
      <tr><td>Planned visits due</td><td>${prev.planned}</td><td>${cur.planned}</td><td></td></tr>
      <tr><td>Visits logged</td><td>${prev.visits}</td><td>${cur.visits}</td><td>${delta(cur.visits, prev.visits)}</td></tr>
      <tr><td>Planned visits on time</td><td>${pctTxt(prev.onTime)}</td><td>${pctTxt(cur.onTime)}</td><td>${delta(cur.onTime, prev.onTime)}</td></tr>
      <tr><td>Reactive jobs raised</td><td>${prev.raised}</td><td>${cur.raised}</td><td>${delta(cur.raised, prev.raised, false, "down")}</td></tr>
      <tr><td>Reactive jobs completed</td><td>${prev.completed}</td><td>${cur.completed}</td><td>${delta(cur.completed, prev.completed)}</td></tr>
      <tr><td>Completed within target</td><td>${pctTxt(prev.slaPct)}</td><td>${pctTxt(cur.slaPct)}</td><td>${delta(cur.slaPct, prev.slaPct)}</td></tr>
      <tr><td>Spend (visits and jobs)</td><td>${gbp(prev.spend)}</td><td>${gbp(cur.spend)}</td><td>${delta(cur.spend, prev.spend, true, "down")}</td></tr>
      <tr><td>Incidents</td><td>${prev.incidents}</td><td>${cur.incidents}</td><td>${delta(cur.incidents, prev.incidents, false, "down")}</td></tr>
    </tbody></table>
    <h2>Maintenance</h2>
    <p>${cur.visits} visits logged; ${overdue.length} service${overdue.length === 1 ? "" : "s"} overdue today.</p>
    ${overdue.length ? `<table><thead><tr><th>Overdue service</th><th>Was due</th></tr></thead><tbody>${overdue.slice(0, 20).map((d) => `<tr><td>${e(d.name)}</td><td class="bad">${fmtDate(d.nextServiceDate)}</td></tr>`).join("")}</tbody></table>` : ""}
    <h2>Reactive works</h2>
    <p>${cur.raised} raised · ${cur.completed} completed · ${openWorks.length} open (${openWorks.filter((w) => w.priority === "high").length} high priority) · ${openWorks.filter((w) => workSla(w)?.breached).length} past target.</p>
    <h2>Open risks</h2>
    ${reds.length || openActions.some((a) => a.priority === "high") || openInc.length ? `<ul>${reds.slice(0, 15).map((r) => `<li><b class="bad">Compliance:</b> ${e(r.requirement)} — ${e(r.reasons.join("; "))}</li>`).join("")}${openActions.filter((a) => a.priority === "high").map((a) => `<li><b class="warn">Action:</b> ${e(a.action || a.finding)}${a.due ? ` (due ${fmtDate(a.due)})` : ""}</li>`).join("")}${openInc.map((i) => `<li><b class="warn">Incident:</b> ${e(i.description)} (${fmtDate(i.date)})</li>`).join("")}</ul>` : "<p>No open high risks.</p>"}
    ${register ? `<h2>Compliance</h2><div class="kpis"><div class="kpi">Red<b class="bad">${register.counts.red}</b></div><div class="kpi">Amber<b class="warn">${register.counts.amber}</b></div><div class="kpi">Green<b class="ok">${register.counts.green}</b></div></div>` : ""}
    <h2>Safety</h2><p>${cur.incidents} incident${cur.incidents === 1 ? "" : "s"} this month · ${openInc.length} open · ${openActions.length} safety action${openActions.length === 1 ? "" : "s"} open (${openActions.filter((a) => a.due && a.due < today).length} overdue) · ${cur.actionsClosed} closed this month.</p>
    <h2>Supplier performance</h2>
    ${supRows.length ? `<table><thead><tr><th>Supplier</th><th>Visits</th><th>Jobs completed</th><th>Within target</th><th>Spend</th></tr></thead><tbody>${supRows.map((r) => `<tr><td>${e(r.s.name)}</td><td>${r.v}</td><td>${r.j}</td><td>${r.j ? `${Math.round((100 * r.ok) / r.j)}%` : "—"}</td><td>${gbp(r.spend)}</td></tr>`).join("")}</tbody></table>` : "<p>No supplier activity recorded this month.</p>"}
    ${model ? `<h2>Budget and spend (${year})</h2><table><thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Committed</th><th>Forecast</th></tr></thead><tbody>${model.rows.filter((r) => r.budget || r.spent).map((r) => `<tr><td>${e(CATEGORY_META[r.cat]?.label || r.cat)}</td><td>${gbp(r.budget)}</td><td>${gbp(r.spent)}</td><td>${gbp(r.committed)}</td><td class="${r.budget && r.forecast > r.budget ? "bad" : ""}">${gbp(r.forecast)}</td></tr>`).join("")}<tr><td><b>Total</b></td><td><b>${gbp(model.budget)}</b></td><td><b>${gbp(model.spent)}</b></td><td><b>${gbp(model.committed)}</b></td><td><b>${gbp(model.forecast)}</b></td></tr></tbody></table>` : ""}
    ${projects.length ? `<h2>Projects</h2><table><thead><tr><th>Project</th><th>Status</th><th>Budget</th></tr></thead><tbody>${projects.map((p) => `<tr><td>${e(p.name)}</td><td>${e(p.status || "")}</td><td>${p.budget ? gbp(p.budget) : "—"}</td></tr>`).join("")}</tbody></table>` : ""}
    <h2>Outstanding actions</h2>
    ${openActions.length ? `<table><thead><tr><th>Action</th><th>Owner</th><th>Due</th></tr></thead><tbody>${openActions.slice(0, 30).map((a) => `<tr><td>${e(a.action || a.finding)}</td><td>${e(a.owner || "")}</td><td class="${a.due && a.due < today ? "bad" : ""}">${a.due ? fmtDate(a.due) : "—"}</td></tr>`).join("")}</tbody></table>` : "<p>None.</p>"}
  `;
  const csv = [["Measure", MONTH_NAMES[pm], MONTH_NAMES[month]], ["Planned visits due", prev.planned, cur.planned], ["Visits logged", prev.visits, cur.visits], ["Planned visits on time %", prev.onTime ?? "", cur.onTime ?? ""], ["Reactive jobs raised", prev.raised, cur.raised], ["Reactive jobs completed", prev.completed, cur.completed], ["Completed within target %", prev.slaPct ?? "", cur.slaPct ?? ""], ["Spend", Math.round(prev.spend), Math.round(cur.spend)], ["Incidents", prev.incidents, cur.incidents], ["Site health (today)", "", health?.overall ?? ""], ["Compliance red / amber / green (today)", "", register ? `${register.counts.red} / ${register.counts.amber} / ${register.counts.green}` : ""], ["Overdue services (today)", "", overdue.length], ["Open reactive jobs (today)", "", openWorks.length]];
  return { html, csv };
}
