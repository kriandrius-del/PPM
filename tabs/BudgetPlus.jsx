// Budget → Overview, Checks and Tools.
import { useState, useMemo } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { AlertTriangle, ArrowRightLeft, CalendarRange, CheckCircle2, FileSpreadsheet, Gauge, Lock, PiggyBank, Printer, Scale, Settings2, ShieldAlert, TrendingUp, Upload, Wallet } from "lucide-react";
import { Field, Modal, PrimaryButton, Select, TextArea, TextInput, ToggleButton } from "../components/ui.jsx";
import { MONTH_LABELS } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, CATEGORY_KEYS, CATEGORY_META } from "../lib/globals.js";
import { addMonths, daysUntil, escapeHtml, fmtDate, gbp, isMirrored, parseDelimited, replacementYear, toISO } from "../lib/utils.js";
import { openPrintReport, tableHtml } from "../lib/reports.js";
import { buildWorkbook, readSpreadsheetRows, xlsxBlob } from "../lib/excelTemplate.js";
import { downloadBlob } from "../lib/utils.js";

/* ---------------------------------------------------------
   The numbers behind every card: budget, spent so far, committed, still planned, forecast.
--------------------------------------------------------- */
const PHASE_PRESETS = {
  even: Array(12).fill(1),
  winter: [1.5, 1.4, 1.2, 1, 0.8, 0.6, 0.6, 0.6, 0.8, 1, 1.3, 1.5],
  summer: [0.7, 0.7, 0.8, 1, 1.2, 1.4, 1.5, 1.4, 1.1, 0.9, 0.7, 0.6],
};
export function phaseWeights(bs, cat) { const w = bs?.phasing?.[cat]; return Array.isArray(w) && w.length === 12 && w.some((x) => Number(x) > 0) ? w.map((x) => Number(x) || 0) : PHASE_PRESETS.even; }

export function budgetModel({ year, budgets, services, works, suppliers, devices, budgetLines, costLines = [], bs = {}, asOf }) {
  const today = asOf || new Date().toISOString().slice(0, 10);
  const curYear = Number(today.slice(0, 4));
  const elapsedMonths = year < curYear ? 12 : year > curYear ? 0 : Number(today.slice(5, 7));
  const yearFrac = year < curYear ? 1 : year > curYear ? 0 : (Number(today.slice(5, 7)) - 1 + Number(today.slice(8, 10)) / 31) / 12;
  const catOf = Object.fromEntries(devices.map((d) => [d.id, d.serviceCategory || "maintenance"]));
  const z = () => Object.fromEntries(CATEGORY_KEYS.map((c) => [c, 0]));
  const zm = () => Object.fromEntries(CATEGORY_KEYS.map((c) => [c, Array(12).fill(0)]));
  const setB = z(), planned = z(), spent = z(), committed = z(), plannedLeft = z(), contractLeft = z();
  const mSpent = zm(), mFuture = zm();
  const split = { capex: 0, opex: 0, planned: 0, reactive: 0 };
  const inYear = (d) => d && Number(String(d).slice(0, 4)) === year;
  const mon = (d) => Number(String(d).slice(5, 7)) - 1;
  budgets.filter((b) => b.year === year).forEach((b) => { if (setB[b.category] !== undefined) setB[b.category] = Number(b.amount) || 0; });
  budgetLines.forEach((l) => {
    if (!inYear(l.date) || planned[l.category] === undefined) return;
    planned[l.category] += Number(l.amount) || 0;
    if (l.actualAmount != null && !isMirrored(l)) { spent[l.category] += Number(l.actualAmount) || 0; mSpent[l.category][mon(l.actualDate || l.date)] += Number(l.actualAmount) || 0; split[l.capex ? "capex" : "opex"] += Number(l.actualAmount) || 0; split.planned += Number(l.actualAmount) || 0; }
    else if (l.actualAmount == null && l.date > today) { plannedLeft[l.category] += Number(l.amount) || 0; mFuture[l.category][mon(l.date)] += Number(l.amount) || 0; }
  });
  // Cost lines (budget grid): each month's budget is planned; the invoiced amount is spend.
  const fyS = Number(bs.fyStart) || 1;
  costLines.forEach((l) => {
    if (planned[l.category] === undefined) return;
    for (let i = 0; i < 12; i++) {
      const idx = fyS - 1 + i; const cy = l.year + Math.floor(idx / 12); const cm = idx % 12; if (cy !== year) continue;
      const b = Number(l.budget?.[i]) || 0; const a = l.actual?.[i];
      planned[l.category] += b;
      const monthStart = `${cy}-${String(cm + 1).padStart(2, "0")}-01`;
      if (a != null) { spent[l.category] += Number(a) || 0; mSpent[l.category][cm] += Number(a) || 0; split.opex += Number(a) || 0; split.planned += Number(a) || 0; }
      else if (monthStart.slice(0, 7) >= today.slice(0, 7)) { plannedLeft[l.category] += b; mFuture[l.category][cm] += b; } // this month or later, not invoiced yet
    }
  });
  services.forEach((v) => { if (!inYear(v.date) || v.aborted) return; const c = catOf[v.deviceId] || "maintenance"; if (spent[c] === undefined) return; const x = Number(v.cost) || 0; spent[c] += x; mSpent[c][mon(v.date)] += x; split.opex += x; split.planned += x; });
  works.forEach((w) => {
    if (!inYear(w.dateRaised) || w.budgetType === "non_controllable" || w.warranty) return;
    const c = catOf[w.deviceId] || "maintenance"; if (spent[c] === undefined) return; const x = Number(w.finalCost ?? w.quoteAmount) || 0;
    if (w.status === "completed") { spent[c] += x; mSpent[c][mon(w.dateRaised)] += x; split[w.capex ? "capex" : "opex"] += x; split.reactive += x; }
    else if (["approved", "in_progress", "on_hold"].includes(w.status)) { committed[c] += x; const m = Math.min(11, Math.max(mon(w.dateRaised), elapsedMonths ? elapsedMonths - 1 : 0)); mFuture[c][m] += x; }
  });
  suppliers.forEach((s) => {
    const c = s.category; if (spent[c] === undefined) return; const monthly = s.costFrequency === "annual" ? (Number(s.costAmount) || 0) / 12 : Number(s.costAmount) || 0; if (!monthly) return;
    for (let i = 0; i < 12; i++) { if (i < elapsedMonths) { spent[c] += monthly; mSpent[c][i] += monthly; split.opex += monthly; split.planned += monthly; } else { contractLeft[c] += monthly; mFuture[c][i] += monthly; } }
  });
  const rows = CATEGORY_KEYS.map((c) => {
    const budget = setB[c] > 0 ? setB[c] : planned[c];
    const w = phaseWeights(bs, c); const wSum = w.reduce((a, b) => a + b, 0) || 12;
    const phasedMonthly = w.map((x) => (budget * x) / wSum);
    const phasedToDate = phasedMonthly.slice(0, elapsedMonths).reduce((a, b) => a + b, 0) - (elapsedMonths ? phasedMonthly[elapsedMonths - 1] * (1 - (yearFrac * 12 - (elapsedMonths - 1))) : 0);
    const forecast = spent[c] + committed[c] + plannedLeft[c] + contractLeft[c];
    return { cat: c, budget, isSet: setB[c] > 0, planned: planned[c], spent: spent[c], committed: committed[c], plannedLeft: plannedLeft[c], contractLeft: contractLeft[c], forecast, remaining: budget - forecast, phasedMonthly, phasedToDate: Math.max(0, phasedToDate), mSpent: mSpent[c], mFuture: mFuture[c] };
  });
  const tot = (k) => rows.reduce((t, r) => t + (r[k] || 0), 0);
  const mTot = (k) => Array.from({ length: 12 }, (_, i) => rows.reduce((t, r) => t + r[k][i], 0));
  return { rows, budget: tot("budget"), spent: tot("spent"), committed: tot("committed"), plannedLeft: tot("plannedLeft"), contractLeft: tot("contractLeft"), forecast: tot("forecast"), phasedToDate: tot("phasedToDate"), monthlySpent: mTot("mSpent"), monthlyFuture: mTot("mFuture"), monthlyPhased: mTot("phasedMonthly"), elapsedMonths, yearFrac, split, today };
}

const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 };
const H = ({ icon: I, children, right }) => <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><div className="blabel">{I && <I size={14} />}<span>{children}</span></div>{right}</div>;
const Bar2 = ({ pct, color }) => <div style={{ height: 7, background: "var(--track)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 4 }} /></div>;
const rag = (r) => { if (!r.budget) return ["—", "var(--faint)"]; const p = r.forecast / r.budget; return p > 1.02 ? ["Over", "var(--danger)"] : p > 0.95 ? ["Tight", "var(--warn)"] : ["On track", "var(--ok)"]; };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

/* ---------- Overview ---------- */
export function BudgetOverview({ model, year, prevModel, services, works, suppliers, devices, invoices = [], pos = [], savings = [], floorArea = 0, bs = {}, onSaveBs }) {
  const m = model; const yearPct = Math.round(m.yearFrac * 100); const usedPct = m.budget ? Math.round((m.spent / m.budget) * 100) : null;
  const devById = Object.fromEntries(devices.map((d) => [d.id, d])); const supById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const inYear = (d) => d && Number(String(d).slice(0, 4)) === year;
  const [noteFor, setNoteFor] = useState(null);
  // breakdowns
  const bySup = {}; const byTrade = {}; const byArea = {};
  services.forEach((v) => { if (!inYear(v.date) || v.aborted) return; const s = v.supplierId || devById[v.deviceId]?.supplierId; const x = Number(v.cost) || 0; if (s) bySup[s] = (bySup[s] || 0) + x; const a = devById[v.deviceId]?.area || "No area"; byArea[a] = (byArea[a] || 0) + x; });
  works.forEach((w) => { if (!inYear(w.dateRaised) || w.status !== "completed" || w.budgetType === "non_controllable" || w.warranty) return; const x = Number(w.finalCost ?? w.quoteAmount) || 0; if (w.supplierId) bySup[w.supplierId] = (bySup[w.supplierId] || 0) + x; byTrade[w.category || "Not set"] = (byTrade[w.category || "Not set"] || 0) + x; const a = devById[w.deviceId]?.area || "No area"; byArea[a] = (byArea[a] || 0) + x; });
  suppliers.forEach((s) => { const mo = s.costFrequency === "annual" ? (Number(s.costAmount) || 0) / 12 : Number(s.costAmount) || 0; if (mo) bySup[s.id] = (bySup[s.id] || 0) + mo * m.elapsedMonths; });
  const byCode = {}; invoices.filter((i) => inYear(i.date) && i.costCode).forEach((i) => { byCode[i.costCode] = (byCode[i.costCode] || 0) + (Number(i.amount) || 0); });
  pos.filter((p) => inYear(p.date) && p.costCode && p.status !== "closed").forEach((p) => { byCode[`${p.costCode} (PO)`] = (byCode[`${p.costCode} (PO)`] || 0) + (Number(p.value) || 0); });
  const top = (o, n = 6) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const savingsYr = savings.filter((s) => inYear(s.date)).reduce((t, s) => t + (Number(s.amount) || 0), 0);
  const dueSoon = invoices.filter((i) => i.status !== "paid" && i.status !== "disputed" && i.dueDate && daysUntil(i.dueDate) <= 30).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  // quarters & YoY
  const q = [0, 1, 2, 3].map((i) => ({ q: `Q${i + 1}`, actual: m.monthlySpent.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0) + (m.elapsedMonths <= i * 3 + 2 ? m.monthlyFuture.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0) : 0), budget: m.monthlyPhased.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0), done: m.elapsedMonths >= (i + 1) * 3 }));
  const lastSame = prevModel ? prevModel.monthlySpent.slice(0, Math.max(1, m.elapsedMonths)).reduce((a, b) => a + b, 0) : null;
  const thisSame = m.monthlySpent.slice(0, Math.max(1, m.elapsedMonths)).reduce((a, b) => a + b, 0);
  const chart = MONTH_LABELS.map((lab, i) => ({ m: lab, actual: i < m.elapsedMonths ? Math.round(m.monthlySpent[i]) : null, forecast: i >= m.elapsedMonths - 1 ? Math.round((i < m.elapsedMonths ? m.monthlySpent[i] : 0) + m.monthlyFuture[i]) : null, budget: Math.round(m.monthlyPhased[i]) }));
  let cum = 0; const cumData = chart.map((c, i) => { cum += (c.actual ?? 0) + (i >= m.elapsedMonths ? m.monthlyFuture[i] : 0); return { ...c, cumulative: Math.round(cum) }; });
  const maxHeat = Math.max(1, ...m.rows.flatMap((r) => r.mSpent));
  const k = (label, value, tone, sub) => (
    <div className="bcard c1" style={{ padding: "12px 14px", gap: 4 }}>
      <div className="blabel">{label}</div>
      <div className="bbig" style={{ fontSize: 24, color: tone }}>{value}</div>
      {sub && <div className="bsub" style={{ fontSize: 11.5 }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="bento kpis">
        {k("Budget used", usedPct == null ? "—" : `${usedPct}%`, usedPct != null && usedPct > yearPct + 5 && year === new Date().getFullYear() ? "var(--warn)" : "var(--text)", `${gbp(m.spent)} of ${gbp(m.budget)}`)}
        {k("Committed", gbp(m.committed), m.committed ? "var(--warn)" : "var(--text)", "approved jobs not finished")}
        {k("Still to come", gbp(m.plannedLeft + m.contractLeft), "var(--text)", "planned lines, visits & contracts")}
        {k(m.budget && m.forecast > m.budget ? "Over at year end" : "Left at year end", m.budget ? gbp(Math.abs(m.budget - m.forecast)) : "—", m.budget && m.forecast > m.budget ? "var(--danger)" : "var(--ok)", `forecast ${gbp(m.forecast)}`)}
      </div>
      {m.budget > 0 && year === new Date().getFullYear() && (
        <div style={{ ...card, flexDirection: "row", alignItems: "center", gap: 12, background: usedPct > yearPct + 5 ? "var(--warn-soft)" : "var(--ok-soft)", border: "none" }}>
          <Gauge size={22} color={usedPct > yearPct + 5 ? "var(--warn)" : "var(--ok)"} />
          <div style={{ flex: 1, fontSize: 13 }}><b>{usedPct}% of the budget used with {yearPct}% of the year gone</b> — {usedPct > yearPct + 5 ? "spending is running ahead of the year. Check the categories below." : usedPct < yearPct - 15 ? "well under — check planned visits are being logged with their costs." : "on track."}{m.phasedToDate > 0 ? ` Against your monthly phasing you'd expect ${gbp(m.phasedToDate)} by now.` : ""}</div>
        </div>
      )}
      <div style={card}>
        <H icon={Scale}>By category</H>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.3 }}>
            <thead><tr style={{ color: "var(--muted)", textAlign: "right" }}><th style={{ textAlign: "left", padding: "4px 6px" }}>Category</th><th>Budget</th><th>Spent</th><th>Committed</th><th>Still planned</th><th>Forecast</th><th>Status</th></tr></thead>
            <tbody>{m.rows.filter((r) => r.budget || r.forecast).map((r) => { const [lab, col] = rag(r); const meta = CATEGORY_META[r.cat]; return (
              <tr key={r.cat} style={{ borderTop: "1px solid var(--border)", textAlign: "right", ...mono }}>
                <td style={{ textAlign: "left", padding: "7px 6px", fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 700 }}>{meta?.label}</div>
                  {bs.owners?.[r.cat] && <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Owner: {bs.owners[r.cat]}</div>}
                  {(bs.varianceNotes?.[year]?.[r.cat]) && <div style={{ fontSize: 10.5, color: "var(--text-2)", fontStyle: "italic" }}>"{bs.varianceNotes[year][r.cat]}"</div>}
                  {ACTIVE_CAN_EDIT && onSaveBs && <button onClick={() => setNoteFor(r.cat)} style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" }}>{bs.varianceNotes?.[year]?.[r.cat] ? "edit note" : "explain variance"}</button>}
                </td>
                <td>{gbp(r.budget)}</td><td>{gbp(r.spent)}</td><td>{r.committed ? gbp(r.committed) : "—"}</td><td>{gbp(r.plannedLeft + r.contractLeft)}</td><td style={{ fontWeight: 700 }}>{gbp(r.forecast)}</td>
                <td style={{ fontFamily: "inherit" }}><span style={{ fontSize: 11, fontWeight: 750, color: col }}>{lab}</span></td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      </div>
      <div style={card}>
        <H icon={TrendingUp} right={<span style={{ fontSize: 11, color: "var(--faint)" }}>bars = month spend · line = running total · dashed = phased budget</span>}>Cash flow {year}</H>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cumData} margin={{ top: 5, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="m" tick={{ fontSize: 10 }} /><YAxis yAxisId="a" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} /><YAxis yAxisId="b" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
              <Tooltip formatter={(v) => gbp(v)} /><Legend wrapperStyle={{ fontSize: 10.5 }} />
              <Bar yAxisId="a" dataKey="actual" name="Spent" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="a" dataKey="forecast" name="Expected" fill="var(--chart-plan)" radius={[3, 3, 0, 0]} />
              <Line yAxisId="a" dataKey="budget" name="Phased budget" stroke="var(--warn)" strokeDasharray="5 4" dot={false} />
              <Line yAxisId="b" dataKey="cumulative" name="Running total" stroke="var(--danger)" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div style={card}>
          <H icon={CalendarRange}>Quarters</H>
          {q.map((x) => <div key={x.q} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}><b style={{ width: 26 }}>{x.q}</b><div style={{ flex: 1 }}><Bar2 pct={x.budget ? (x.actual / x.budget) * 100 : 0} color={x.budget && x.actual > x.budget ? "var(--danger)" : "var(--accent)"} /></div><span style={{ ...mono, width: 140, textAlign: "right" }}>{gbp(x.actual)} / {gbp(x.budget)}{x.done ? "" : "*"}</span></div>)}
          <div style={{ fontSize: 10.5, color: "var(--faint)" }}>* includes what's still expected this quarter</div>
        </div>
        <div style={card}>
          <H icon={TrendingUp}>Compared with last year</H>
          {lastSame == null ? <div className="bsub">No data for {year - 1}.</div> : <>
            <div style={{ fontSize: 13 }}>Jan–{MONTH_LABELS[Math.max(0, m.elapsedMonths - 1)]}: <b style={mono}>{gbp(thisSame)}</b> this year vs <b style={mono}>{gbp(lastSame)}</b> last year</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: thisSame > lastSame ? "var(--danger)" : "var(--ok)" }}>{lastSame ? `${thisSame >= lastSame ? "▲" : "▼"} ${Math.abs(Math.round(((thisSame - lastSame) / lastSame) * 100))}%` : "—"}</div>
            {prevModel.rows.filter((r) => r.spent || r.budget).map((r) => { const cur = m.rows.find((x) => x.cat === r.cat); const prevSame = r.mSpent.slice(0, Math.max(1, m.elapsedMonths)).reduce((a, b) => a + b, 0); const curSame = cur.mSpent.slice(0, Math.max(1, m.elapsedMonths)).reduce((a, b) => a + b, 0); return <div key={r.cat} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>{CATEGORY_META[r.cat]?.label}</span><span style={mono}>{gbp(curSame)} vs {gbp(prevSame)}</span></div>; })}
          </>}
        </div>
        <div style={card}>
          <H icon={Scale}>Where it goes</H>
          <div style={{ fontSize: 12.5 }}>Planned (PPM & contracts) <b style={mono}>{gbp(m.split.planned)}</b> · Reactive <b style={mono}>{gbp(m.split.reactive)}</b></div>
          <Bar2 pct={m.split.planned + m.split.reactive ? (m.split.planned / (m.split.planned + m.split.reactive)) * 100 : 0} color="var(--ok)" />
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{m.split.planned + m.split.reactive ? `${Math.round((m.split.planned / (m.split.planned + m.split.reactive)) * 100)}% planned — 70–80% is healthy` : ""}</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Capital (capex) <b style={mono}>{gbp(m.split.capex)}</b> · Operating (opex) <b style={mono}>{gbp(m.split.opex)}</b></div>
          {floorArea > 0 && <div style={{ fontSize: 12.5 }}>Per m²: <b style={mono}>{gbp(m.spent / floorArea)}</b> so far · <b style={mono}>{gbp(m.forecast / floorArea)}</b> forecast</div>}
          {Number(bs.headcount) > 0 && <div style={{ fontSize: 12.5 }}>Per person ({bs.headcount}): <b style={mono}>{gbp(m.spent / bs.headcount)}</b> so far · <b style={mono}>{gbp(m.forecast / bs.headcount)}</b> forecast</div>}
          {savingsYr > 0 && <div style={{ fontSize: 12.5, color: "var(--ok)", fontWeight: 650 }}>Savings delivered: {gbp(savingsYr)}{m.budget ? ` (${((savingsYr / m.budget) * 100).toFixed(1)}% of budget)` : ""}</div>}
        </div>
        <div style={card}>
          <H icon={Wallet}>Top suppliers</H>
          {top(bySup).length === 0 ? <div className="bsub">No supplier spend yet.</div> : top(bySup).map(([id, v]) => <div key={id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.3 }}><span style={{ width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{supById[id]?.name || "?"}</span><div style={{ flex: 1 }}><Bar2 pct={(v / top(bySup)[0][1]) * 100} color="var(--accent)" /></div><span style={{ ...mono, width: 78, textAlign: "right" }}>{gbp(v)}</span></div>)}
        </div>
        {Object.keys(byTrade).length > 0 && <div style={card}><H icon={Wallet}>Reactive spend by trade</H>{top(byTrade).map(([t, v]) => <div key={t} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.3 }}><span>{t}</span><b style={mono}>{gbp(v)}</b></div>)}</div>}
        {Object.keys(byArea).length > 1 && <div style={card}><H icon={Wallet}>Spend by area</H>{top(byArea).map(([t, v]) => <div key={t} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.3 }}><span>{t}</span><b style={mono}>{gbp(v)}</b></div>)}</div>}
        {Object.keys(byCode).length > 0 && <div style={card}><H icon={Wallet}>By cost code</H>{top(byCode, 8).map(([t, v]) => <div key={t} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.3 }}><span style={mono}>{t}</span><b style={mono}>{gbp(v)}</b></div>)}</div>}
        <div style={card}>
          <H icon={CalendarRange}>Next 3 months</H>
          <div style={{ fontSize: 13 }}>About <b style={mono}>{gbp(m.monthlyFuture.slice(m.elapsedMonths, m.elapsedMonths + 3).reduce((a, b) => a + b, 0) + m.committed)}</b> still to come: planned visits and lines, contract payments and committed jobs.</div>
          {dueSoon.length > 0 && <><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>Invoices due to pay (30 days)</div>{dueSoon.slice(0, 5).map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.3, color: daysUntil(i.dueDate) < 0 ? "var(--danger)" : "var(--text)" }}><span>{i.number} · {supById[i.supplierId]?.name || ""}</span><span style={mono}>{gbp(i.amount)} · {fmtDate(i.dueDate)}</span></div>)}</>}
        </div>
      </div>
      <div style={card}>
        <H icon={CalendarRange}>Spend heatmap {year}</H>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 11, width: "100%" }}>
            <thead><tr><th></th>{MONTH_LABELS.map((x) => <th key={x} style={{ color: "var(--faint)", fontWeight: 600 }}>{x}</th>)}</tr></thead>
            <tbody>{m.rows.filter((r) => r.spent).map((r) => <tr key={r.cat}><td style={{ fontWeight: 650, whiteSpace: "nowrap", paddingRight: 4 }}>{CATEGORY_META[r.cat]?.label}</td>{r.mSpent.map((v, i) => <td key={i} title={`${MONTH_LABELS[i]}: ${gbp(v)}`} style={{ height: 22, minWidth: 22, borderRadius: 4, background: v ? `color-mix(in srgb, var(--accent) ${Math.round(15 + (v / maxHeat) * 85)}%, transparent)` : "var(--card-hi)" }} />)}</tr>)}</tbody>
          </table>
        </div>
      </div>
      {noteFor && <Modal title={`Explain ${CATEGORY_META[noteFor]?.label} ${year}`} onClose={() => setNoteFor(null)}>
        <NoteForm initial={bs.varianceNotes?.[year]?.[noteFor] || ""} placeholder="e.g. Over because of unplanned chiller compressor (£4.2k) — insurance claim submitted" onSave={(t) => { onSaveBs({ varianceNotes: { ...(bs.varianceNotes || {}), [year]: { ...((bs.varianceNotes || {})[year] || {}), [noteFor]: t } } }); setNoteFor(null); }} />
      </Modal>}
    </div>
  );
}
function NoteForm({ initial, placeholder, onSave }) {
  const [t, setT] = useState(initial);
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><TextArea autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} style={{ minHeight: 80 }} /><PrimaryButton onClick={() => onSave(t.trim())}><CheckCircle2 size={15} /> Save</PrimaryButton></div>;
}

/* ---------- Checks: things worth a look ---------- */
export function BudgetChecks({ costLines = [], fyStart = 1, year, services, works, suppliers, devices, budgetLines, invoices = [], model }) {
  const devById = Object.fromEntries(devices.map((d) => [d.id, d])); const inYear = (d) => d && Number(String(d).slice(0, 4)) === year;
  const overVisits = services.filter((v) => inYear(v.date) && !v.aborted && Number(devById[v.deviceId]?.budgetPerVisit) > 0 && Number(v.cost) > Number(devById[v.deviceId].budgetPerVisit) * 1.1).sort((a, b) => (Number(b.cost) - Number(devById[b.deviceId].budgetPerVisit)) - (Number(a.cost) - Number(devById[a.deviceId].budgetPerVisit)));
  const plannedDevs = new Set(budgetLines.filter((l) => inYear(l.date) && l.deviceId).map((l) => l.deviceId));
  const unbudgetedVisits = services.filter((v) => inYear(v.date) && !v.aborted && Number(v.cost) > 0 && !Number(devById[v.deviceId]?.budgetPerVisit) && !plannedDevs.has(v.deviceId));
  const zeroCats = new Set(model.rows.filter((r) => !r.budget).map((r) => r.cat));
  const unbudgetedWorks = works.filter((w) => inYear(w.dateRaised) && ["approved", "in_progress", "completed"].includes(w.status) && (w.budgetType === "non_controllable" || zeroCats.has(devById[w.deviceId]?.serviceCategory || "maintenance")));
  const invoicedWork = new Set(invoices.map((i) => i.workId).filter(Boolean));
  const accrualWorks = works.filter((w) => w.status === "completed" && !w.warranty && Number(w.finalCost ?? w.quoteAmount) > 0 && !invoicedWork.has(w.id) && inYear(w.completedAt || w.dateRaised));
  const missedLines = budgetLines.filter((l) => inYear(l.date) && l.actualAmount == null && !isMirrored(l) && l.date < model.today);
  const missedCost = []; costLines.forEach((l) => { for (let i = 0; i < 12; i++) { const idx = fyStart - 1 + i; const cy = l.year + Math.floor(idx / 12); const cm = idx % 12; const ym = `${cy}-${String(cm + 1).padStart(2, "0")}`; if (cy === year && ym < model.today.slice(0, 7) && l.actual?.[i] == null && Number(l.budget?.[i]) > 0) missedCost.push({ id: `${l.id}-${i}`, name: l.name, cat: l.category, ym, amount: Number(l.budget[i]) }); } });
  const contracts = suppliers.filter((s) => Number(s.costAmount) > 0).map((s) => { const annual = s.costFrequency === "annual" ? Number(s.costAmount) : Number(s.costAmount) * 12; const inv = invoices.filter((i) => i.supplierId === s.id && inYear(i.date)).reduce((t, i) => t + (Number(i.amount) || 0), 0); return { s, annual, inv, pct: annual ? Math.round((inv / annual) * 100) : 0 }; });
  const uplift = suppliers.filter((s) => Number(s.upliftPct) > 0 && Number(s.costAmount) > 0).map((s) => { const annual = s.costFrequency === "annual" ? Number(s.costAmount) : Number(s.costAmount) * 12; return { s, annual, extra: annual * Number(s.upliftPct) / 100 }; });
  const Section = ({ icon, title, count, children, empty }) => (
    <div style={card}>
      <H icon={icon} right={<span style={{ fontSize: 11.5, fontWeight: 750, color: count ? "var(--warn)" : "var(--ok)" }}>{count ? count : "✓ none"}</span>}>{title}</H>
      {count ? children : <div className="bsub">{empty}</div>}
    </div>
  );
  const row = (k, a, b, c) => <div key={k} style={{ display: "flex", gap: 8, fontSize: 12.3, borderTop: "1px solid var(--border)", paddingTop: 5 }}><span style={{ flex: 1, minWidth: 0 }}>{a}</span><span style={{ color: "var(--faint)" }}>{b}</span><b style={mono}>{c}</b></div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
      <Section icon={AlertTriangle} title="Visits over their budget (10%+)" count={overVisits.length} empty="Every visit came in within 10% of its budget.">
        {overVisits.slice(0, 10).map((v) => row(v.id, devById[v.deviceId]?.name, fmtDate(v.date), `${gbp(v.cost)} vs ${gbp(devById[v.deviceId].budgetPerVisit)}`))}
      </Section>
      <Section icon={ShieldAlert} title="Spend with no budget behind it" count={unbudgetedVisits.length + unbudgetedWorks.length} empty="All spend this year is covered by a budget.">
        {unbudgetedVisits.slice(0, 6).map((v) => row(v.id, `${devById[v.deviceId]?.name} (visit)`, fmtDate(v.date), gbp(v.cost)))}
        {unbudgetedWorks.slice(0, 6).map((w) => row(w.id, `${w.description}${w.budgetType === "non_controllable" ? " (non-controllable)" : " (category has no budget)"}`, fmtDate(w.dateRaised), gbp(w.finalCost ?? w.quoteAmount)))}
      </Section>
      <Section icon={Wallet} title="Accruals — work done, no invoice yet" count={accrualWorks.length + missedLines.length + missedCost.length} empty="Nothing finished without an invoice or a recorded cost.">
        {missedCost.slice(0, 8).map((c) => row(c.id, `${CATEGORY_META[c.cat]?.label}: ${c.name} (cost line, no invoice entered)`, `${MONTH_LABELS[Number(c.ym.slice(5)) - 1]} ${c.ym.slice(0, 4)}`, gbp(c.amount)))}
        {accrualWorks.slice(0, 8).map((w) => row(w.id, w.description, w.completedAt ? fmtDate(w.completedAt) : "", gbp(w.finalCost ?? w.quoteAmount)))}
        {missedLines.slice(0, 6).map((l) => row(l.id, `${l.description} (plan line, no actual recorded)`, fmtDate(l.date), gbp(l.amount)))}
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Total to accrue: <b style={mono}>{gbp(accrualWorks.reduce((t, w) => t + (Number(w.finalCost ?? w.quoteAmount) || 0), 0) + missedLines.reduce((t, l) => t + (Number(l.amount) || 0), 0) + missedCost.reduce((t, c) => t + c.amount, 0))}</b> — useful for month-end.</div>
      </Section>
      <Section icon={Scale} title="Contracts: invoiced vs contract value" count={contracts.filter((c) => c.inv > 0).length} empty="No invoices recorded against contract suppliers yet.">
        {contracts.filter((c) => c.inv > 0).sort((a, b) => b.pct - a.pct).slice(0, 10).map((c) => row(c.s.id, c.s.name, `${c.pct}% of ${gbp(c.annual)}`, <span style={{ color: c.pct > Math.round(model.yearFrac * 100) + 10 ? "var(--danger)" : "inherit" }}>{gbp(c.inv)}</span>))}
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Red = invoiced ahead of the year so far ({Math.round(model.yearFrac * 100)}% gone).</div>
      </Section>
      <Section icon={TrendingUp} title="Price increases expected at renewal" count={uplift.length} empty="Set an expected % increase on supplier contracts to see next year's impact.">
        {uplift.map((u) => row(u.s.id, `${u.s.name} +${u.s.upliftPct}%`, u.s.contractEnd ? `renews ${fmtDate(u.s.contractEnd)}` : "", `+${gbp(u.extra)}/yr`))}
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Total extra next year: <b style={mono}>{gbp(uplift.reduce((t, u) => t + u.extra, 0))}</b></div>
      </Section>
    </div>
  );
}

/* ---------- Tools ---------- */
export function BudgetTools({ userName = "", year, model, budgets, devices, bs = {}, onSaveBs, onMoveBudget, onSetBudgetsBulk, users = [], locationName = "", exportData }) {
  const [phCat, setPhCat] = useState(CATEGORY_KEYS[0]);
  const [vir, setVir] = useState({ from: CATEGORY_KEYS[0], to: CATEGORY_KEYS[1] || CATEGORY_KEYS[0], amount: "", reason: "" });
  const [draw, setDraw] = useState({ cat: CATEGORY_KEYS[0], amount: "", reason: "" });
  const [monthNote, setMonthNote] = useState({});
  const inflation = Number(bs.inflation ?? 4);
  const original = bs.original?.[year] || null;
  const current = Object.fromEntries(CATEGORY_KEYS.map((c) => [c, Number(budgets.find((b) => b.year === year && b.category === c)?.amount) || 0]));
  const contingency = Number(bs.contingency?.[year]) || 0;
  const draws = (bs.contingencyDraws || []).filter((d) => d.year === year);
  const contLeft = contingency - draws.reduce((t, d) => t + (Number(d.amount) || 0), 0);
  const next = year + 1;
  const lifecycle = useMemo(() => { const out = {}; devices.forEach((d) => { const y = replacementYear(d); if (y && y > year && y <= year + 5 && Number(d.replacementCost) > 0) (out[y] = out[y] || []).push(d); }); return out; }, [devices, year]);
  const builder = model.rows.map((r) => { const base = r.forecast || r.budget; const lifeNext = (lifecycle[next] || []).filter((d) => (d.serviceCategory || "maintenance") === r.cat).reduce((t, d) => t + Number(d.replacementCost), 0); return { cat: r.cat, base, inflated: base * (1 + inflation / 100), lifeNext, suggested: Math.round((base * (1 + inflation / 100) + lifeNext) / 100) * 100 }; });
  const weights = phaseWeights(bs, phCat);
  const setW = (arr) => onSaveBs({ phasing: { ...(bs.phasing || {}), [phCat]: arr } });
  const box = { ...card };
  const smallBtn = { background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const log = (bs.changeLog || []).filter((c) => c.year === year).slice(-15).reverse();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
      <div style={box}>
        <H icon={Settings2}>Settings for this site</H>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="People on site"><TextInput type="number" min="0" defaultValue={bs.headcount ?? ""} onBlur={(e) => onSaveBs({ headcount: e.target.value === "" ? null : Number(e.target.value) })} placeholder="for cost per person" /></Field>
          <Field label="Inflation for planning (%)"><TextInput type="number" min="0" step="0.5" defaultValue={bs.inflation ?? 4} onBlur={(e) => onSaveBs({ inflation: Number(e.target.value) || 0 })} /></Field>
          <Field label="Financial year starts in"><Select value={Number(bs.fyStart) || 1} onChange={(e) => onSaveBs({ fyStart: Number(e.target.value) })}>{MONTH_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</Select></Field>
          <Field label="Warn me at (% of budget)"><TextInput type="number" min="1" max="200" defaultValue={bs.alertPct ?? 80} onBlur={(e) => onSaveBs({ alertPct: Number(e.target.value) || 80 })} /></Field>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Budget owners</div>
        {CATEGORY_KEYS.map((c) => <div key={c} style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ width: 110, fontSize: 12.5 }}>{CATEGORY_META[c]?.label}</span><TextInput list="bud-owners" defaultValue={bs.owners?.[c] || ""} onBlur={(e) => onSaveBs({ owners: { ...(bs.owners || {}), [c]: e.target.value.trim() } })} placeholder="Name" style={{ flex: 1 }} /></div>)}
        <datalist id="bud-owners">{users.map((u) => <option key={u} value={u} />)}</datalist>
      </div>

      <div style={box}>
        <H icon={Lock}>Original vs revised budget {year}</H>
        {!original ? (
          <>
            <div className="bsub">Lock the budget as agreed at the start of the year. Every later change is then shown against it, with a log of who changed what and why.</div>
            {ACTIVE_CAN_EDIT && <button onClick={() => onSaveBs({ original: { ...(bs.original || {}), [year]: current }, changeLog: [...(bs.changeLog || []), { year, at: new Date().toISOString(), text: `Original budget locked (${gbp(Object.values(current).reduce((a, b) => a + b, 0))})` }] })} style={smallBtn}>Lock original {year} budget</button>}
          </>
        ) : (
          <>
            {CATEGORY_KEYS.map((c) => { const d = current[c] - (original[c] || 0); return <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{CATEGORY_META[c]?.label}</span><span style={mono}>{gbp(original[c] || 0)} → {gbp(current[c])} {d ? <b style={{ color: d > 0 ? "var(--warn)" : "var(--ok)" }}>({d > 0 ? "+" : ""}{gbp(d)})</b> : null}</span></div>; })}
            {log.length > 0 && <details style={{ fontSize: 12 }}><summary style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 650 }}>Change log ({log.length})</summary>{log.map((c, i) => <div key={i} style={{ marginTop: 4 }}><span style={{ color: "var(--faint)" }}>{new Date(c.at).toLocaleDateString("en-GB")} {c.by ? `· ${c.by}` : ""}:</span> {c.text}</div>)}</details>}
          </>
        )}
      </div>

      <div style={box}>
        <H icon={ArrowRightLeft}>Move budget between categories</H>
        <div className="bsub">A virement: take money from one category and give it to another, with a reason that's kept in the change log.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="From"><Select value={vir.from} onChange={(e) => setVir((p) => ({ ...p, from: e.target.value }))}>{CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORY_META[c]?.label} ({gbp(current[c])})</option>)}</Select></Field>
          <Field label="To"><Select value={vir.to} onChange={(e) => setVir((p) => ({ ...p, to: e.target.value }))}>{CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORY_META[c]?.label}</option>)}</Select></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}><TextInput type="number" min="0" value={vir.amount} onChange={(e) => setVir((p) => ({ ...p, amount: e.target.value }))} placeholder="£" style={{ width: 100 }} /><TextInput value={vir.reason} onChange={(e) => setVir((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason" style={{ flex: 1, minWidth: 0 }} /></div>
        {ACTIVE_CAN_EDIT && <button onClick={() => { const a = Number(vir.amount); if (!a || vir.from === vir.to) return; if (a > current[vir.from] && !window.confirm(`That's more than the ${gbp(current[vir.from])} set for ${CATEGORY_META[vir.from]?.label}. Continue?`)) return; onMoveBudget(year, vir.from, vir.to, a, vir.reason.trim()); setVir((p) => ({ ...p, amount: "", reason: "" })); }} style={{ ...smallBtn, alignSelf: "flex-start" }}>Move {vir.amount ? gbp(Number(vir.amount)) : "budget"}</button>}
      </div>

      <div style={box}>
        <H icon={PiggyBank}>Contingency {year}</H>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Field label="Contingency held back (£)"><TextInput type="number" min="0" defaultValue={contingency || ""} onBlur={(e) => onSaveBs({ contingency: { ...(bs.contingency || {}), [year]: Number(e.target.value) || 0 } })} /></Field>
          <div style={{ fontSize: 13, paddingBottom: 8 }}>Left: <b style={{ ...mono, color: contLeft < 0 ? "var(--danger)" : "var(--ok)" }}>{gbp(contLeft)}</b></div>
        </div>
        {draws.map((d, i) => <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>{fmtDate(d.at.slice(0, 10))} → {CATEGORY_META[d.cat]?.label}: {d.reason}</span><b style={mono}>{gbp(d.amount)}</b></div>)}
        {ACTIVE_CAN_EDIT && contingency > 0 && <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Select value={draw.cat} onChange={(e) => setDraw((p) => ({ ...p, cat: e.target.value }))} style={{ flex: "1 1 120px" }}>{CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORY_META[c]?.label}</option>)}</Select>
            <TextInput type="number" min="0" value={draw.amount} onChange={(e) => setDraw((p) => ({ ...p, amount: e.target.value }))} placeholder="£" style={{ width: 90 }} />
            <TextInput value={draw.reason} onChange={(e) => setDraw((p) => ({ ...p, reason: e.target.value }))} placeholder="What for" style={{ flex: "2 1 140px", minWidth: 0 }} />
          </div>
          <button onClick={() => { const a = Number(draw.amount); if (!a) return; onSetBudgetsBulk(year, { [draw.cat]: current[draw.cat] + a }, `Contingency released to ${CATEGORY_META[draw.cat]?.label}: ${draw.reason}`); onSaveBs({ contingencyDraws: [...(bs.contingencyDraws || []), { year, cat: draw.cat, amount: a, reason: draw.reason.trim(), at: new Date().toISOString() }] }); setDraw((p) => ({ ...p, amount: "", reason: "" })); }} style={{ ...smallBtn, alignSelf: "flex-start" }}>Release from contingency</button>
        </>}
      </div>

      <div style={box}>
        <H icon={CalendarRange}>Monthly phasing</H>
        <div className="bsub">How each category's budget is spread over the year — used for "expected by now" and the cash-flow chart.</div>
        <Select value={phCat} onChange={(e) => setPhCat(e.target.value)}>{CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORY_META[c]?.label}</option>)}</Select>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{[["even", "Even"], ["winter", "Winter-heavy"], ["summer", "Summer-heavy"]].map(([kk, l]) => <ToggleButton key={kk} active={JSON.stringify(weights) === JSON.stringify(PHASE_PRESETS[kk])} onClick={() => ACTIVE_CAN_EDIT && setW(PHASE_PRESETS[kk])}>{l}</ToggleButton>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>{MONTH_LABELS.map((lab, i) => <label key={i} style={{ fontSize: 10.5, color: "var(--faint)", textAlign: "center" }}>{lab}<TextInput type="number" min="0" step="0.1" value={weights[i]} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => { const w = [...weights]; w[i] = Number(e.target.value) || 0; setW(w); }} style={{ width: "100%", padding: "4px 2px", textAlign: "center", fontSize: 12 }} /></label>)}</div>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{MONTH_LABELS.map((lab, i) => `${lab} ${gbp(model.rows.find((r) => r.cat === phCat)?.phasedMonthly[i] || 0)}`).slice(0, 12).join(" · ")}</div>
      </div>

      <div style={box}>
        <H icon={TrendingUp}>Build next year's budget ({next})</H>
        <div className="bsub">This year's forecast + {inflation}% inflation + assets due for replacement in {next}.</div>
        {builder.filter((b) => b.base || b.lifeNext).map((b) => <div key={b.cat} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{CATEGORY_META[b.cat]?.label}</span><span style={mono}>{gbp(b.base)} → <b>{gbp(b.suggested)}</b>{b.lifeNext ? <span style={{ color: "var(--warn)" }}> (incl. {gbp(b.lifeNext)} replacements)</span> : null}</span></div>)}
        <div style={{ fontSize: 13, fontWeight: 700 }}>Suggested total: <span style={mono}>{gbp(builder.reduce((t, b) => t + b.suggested, 0))}</span></div>
        {ACTIVE_CAN_EDIT && <button onClick={() => { if (window.confirm(`Set the ${next} budget for each category to these suggested amounts?`)) onSetBudgetsBulk(next, Object.fromEntries(builder.map((b) => [b.cat, b.suggested])), `${next} budget set from the next-year builder (${inflation}% inflation)`); }} style={{ ...smallBtn, alignSelf: "flex-start" }}>Use as the {next} budget</button>}
      </div>

      <div style={box}>
        <H icon={CalendarRange}>Replacements due — next 5 years</H>
        {Object.keys(lifecycle).length === 0 ? <div className="bsub">Add install dates, expected life and replacement cost to services to see what's due.</div> : Object.entries(lifecycle).sort((a, b) => a[0] - b[0]).map(([y, ds]) => (
          <div key={y}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}><span>{y}</span><span style={mono}>{gbp(ds.reduce((t, d) => t + Number(d.replacementCost), 0))}</span></div><div style={{ fontSize: 11.5, color: "var(--faint)" }}>{ds.map((d) => `${d.name} (${gbp(d.replacementCost)})`).join(" · ")}</div></div>
        ))}
      </div>

      <div style={box}>
        <H icon={CheckCircle2}>Month-end review {year}</H>
        <div className="bsub">Note what happened each month and mark it reviewed — a simple record for finance.</div>
        {MONTH_LABELS.slice(0, Math.max(1, model.elapsedMonths)).map((lab, i) => { const key = `${year}-${String(i + 1).padStart(2, "0")}`; const r = bs.monthNotes?.[key]; const sp = model.monthlySpent[i]; const ph = model.monthlyPhased[i]; return (
          <div key={key} style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><b>{lab}</b><span style={mono}>{gbp(sp)} <span style={{ color: sp > ph * 1.1 ? "var(--danger)" : "var(--faint)" }}>vs {gbp(ph)}</span></span></div>
            {r?.reviewedBy ? <div style={{ fontSize: 11.5, color: "var(--ok)" }}>✓ Reviewed by {r.reviewedBy}{r.note ? ` — ${r.note}` : ""}</div> : ACTIVE_CAN_EDIT ? <div style={{ display: "flex", gap: 5, marginTop: 3 }}><TextInput value={monthNote[key] ?? ""} onChange={(e) => setMonthNote((p) => ({ ...p, [key]: e.target.value }))} placeholder="Commentary (optional)" style={{ flex: 1, minWidth: 0, fontSize: 12 }} /><button onClick={() => onSaveBs({ monthNotes: { ...(bs.monthNotes || {}), [key]: { note: (monthNote[key] || "").trim(), reviewedBy: userName || "Unknown", at: new Date().toISOString() } } })} style={{ ...smallBtn, padding: "5px 10px", fontSize: 11.5 }}>Reviewed</button></div> : null}
          </div>
        ); })}
      </div>

      <div style={box}>
        <H icon={FileSpreadsheet}>Export & print</H>
        <div className="bsub">A full budget pack for finance, or a one-page summary for your manager.</div>
        <button onClick={exportData.excel} style={{ ...smallBtn, background: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FileSpreadsheet size={14} /> Excel budget pack (5 sheets)</button>
        <button onClick={exportData.print} style={{ ...smallBtn, background: "var(--card-hi)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> One-page budget summary</button>
      </div>
    </div>
  );
}

/* ---------- Import plan lines from Excel / CSV ---------- */
export function PlanImportModal({ year, suppliers, onClose, onImport }) {
  const [text, setText] = useState(""); const [rows, setRows] = useState(null); const [err, setErr] = useState("");
  const all = rows || (text.trim() ? parseDelimited(text) : []);
  const norm = (h) => String(h || "").trim().toLowerCase();
  const hi = Math.max(0, all.findIndex((r) => r.some((h) => ["description", "item", "what", "line"].includes(norm(h)))));
  const head = (all[hi] || []).map(norm);
  const col = (...n) => head.findIndex((h) => n.includes(h));
  const ix = { desc: col("description", "item", "what", "line"), cat: col("category", "type"), date: col("date", "month", "when"), amount: col("amount", "budget", "cost", "value", "£"), sup: col("supplier", "contractor"), capex: col("capex", "capital") };
  const catKey = (v) => { const t = norm(v); return CATEGORY_KEYS.find((k) => k === t || CATEGORY_META[k]?.label.toLowerCase() === t) || "maintenance"; };
  const parsed = all.slice(hi + 1).map((r) => { const g = (k) => (ix[k] >= 0 ? String(r[ix[k]] ?? "").trim() : ""); const d = toISO(g("date")) || `${year}-01-15`; const sup = suppliers.find((s) => s.name.toLowerCase() === g("sup").toLowerCase()); return { description: g("desc"), category: catKey(g("cat")), date: d, amount: Number(g("amount").replace(/[£$€,]/g, "")) || 0, supplierId: sup?.id || null, capex: /^(y|yes|true|1|capex)$/i.test(g("capex")) || undefined }; }).filter((p) => p.description && p.amount);
  async function file(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setErr(""); try { if (/\.xlsx$/i.test(f.name)) { setRows(await readSpreadsheetRows(await f.arrayBuffer())); setText(""); } else { setRows(null); setText(await f.text()); } } catch (x) { setErr("Couldn't read that file — try pasting the cells instead."); } }
  return (
    <Modal title="Import plan lines" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Columns: <b>Description</b>, <b>Amount</b>, and optionally Category, Date, Supplier, Capex (yes/no). One row per planned cost.</div>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Upload size={14} /> Upload Excel or CSV<input type="file" accept=".xlsx,.csv,.txt" onChange={file} style={{ display: "none" }} /></label>
        <TextArea value={text} onChange={(e) => { setText(e.target.value); setRows(null); }} placeholder="…or paste cells here" style={{ minHeight: 90, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
        {err && <div style={{ fontSize: 12, color: "var(--danger)" }}>{err}</div>}
        {all.length > 0 && ix.desc < 0 && <div style={{ fontSize: 12, color: "var(--danger)" }}>No "Description" column found.</div>}
        {parsed.length > 0 && <div style={{ fontSize: 12.5 }}>{parsed.length} lines · total <b>{gbp(parsed.reduce((t, p) => t + p.amount, 0))}</b></div>}
        {parsed.slice(0, 6).map((p, i) => <div key={i} style={{ fontSize: 12, background: "var(--card-hi)", borderRadius: 7, padding: "5px 8px" }}>{fmtDate(p.date)} · <b>{p.description}</b> · {CATEGORY_META[p.category]?.label} · {gbp(p.amount)}</div>)}
        <PrimaryButton onClick={() => parsed.length && onImport(parsed)} style={{ opacity: parsed.length ? 1 : 0.5 }}><Upload size={15} /> Import {parsed.length} line{parsed.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------- Excel pack and printable summary ---------- */
export async function exportBudgetPack({ model, year, locationName, lines, suppliers, bs }) {
  const sup = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
  const buf = await buildWorkbook([
    { name: "Summary", title: `Budget ${year} — summary`, subtitle: `${locationName} · ${new Date().toLocaleDateString("en-GB")}`, headers: ["Category", "Budget", "Spent", "Committed", "Still planned", "Forecast", "Remaining", "Owner"], rows: [...model.rows.map((r) => [CATEGORY_META[r.cat]?.label, r.budget, r.spent, r.committed, r.plannedLeft + r.contractLeft, r.forecast, r.remaining, bs.owners?.[r.cat] || ""]), ["Total", model.budget, model.spent, model.committed, model.plannedLeft + model.contractLeft, model.forecast, model.budget - model.forecast, ""]], widths: [20, 14, 14, 14, 14, 14, 14, 16], money: [1, 2, 3, 4, 5, 6] },
    { name: "By month", title: `Spend by month ${year}`, subtitle: "Actual to date, expected for the rest of the year", headers: ["Month", "Spent", "Expected", "Phased budget"], rows: MONTH_LABELS.map((m, i) => [m, i < model.elapsedMonths ? model.monthlySpent[i] : null, i >= model.elapsedMonths ? model.monthlyFuture[i] : null, model.monthlyPhased[i]]), widths: [12, 14, 14, 16], money: [1, 2, 3] },
    { name: "Category by month", title: "Category × month (spent)", subtitle: String(year), headers: ["Category", ...MONTH_LABELS], rows: model.rows.map((r) => [CATEGORY_META[r.cat]?.label, ...r.mSpent]), widths: [20, ...MONTH_LABELS.map(() => 11)], money: MONTH_LABELS.map((_, i) => i + 1) },
    { name: "Plan lines", title: `Plan lines ${year}`, subtitle: "Budgeted and actual for each line", headers: ["Date", "Description", "Category", "Supplier", "Budgeted", "Actual", "Capex"], rows: lines.filter((l) => String(l.date).startsWith(String(year))).sort((a, b) => String(a.date).localeCompare(String(b.date))).map((l) => [new Date(l.date + "T00:00:00"), l.description, CATEGORY_META[l.category]?.label || l.category, sup[l.supplierId] || "", Number(l.amount) || 0, l.actualAmount == null ? null : Number(l.actualAmount), l.capex ? "Yes" : ""]), widths: [12, 34, 16, 20, 13, 13, 8], money: [4, 5], dates: [0] },
    { name: "Change log", title: "Budget changes", subtitle: String(year), headers: ["When", "Who", "Change"], rows: (bs.changeLog || []).filter((c) => c.year === year || c.year === year + 1).map((c) => [new Date(c.at), c.by || "", c.text]), widths: [14, 16, 70], dates: [0] },
  ]);
  downloadBlob(xlsxBlob(buf), `budget-pack-${year}.xlsx`);
}
export function printBudgetSummary({ model, year, locationName, bs }) {
  const e = escapeHtml;
  openPrintReport(`Budget summary ${year}`, locationName, `<div class="kpis"><div class="kpi">Budget<b>${gbp(model.budget)}</b></div><div class="kpi">Spent so far<b>${gbp(model.spent)}</b></div><div class="kpi">Committed<b>${gbp(model.committed)}</b></div><div class="kpi">Forecast<b class="${model.budget && model.forecast > model.budget ? "bad" : "ok"}">${gbp(model.forecast)}</b></div></div>
  ${tableHtml(["Category", "Budget", "Spent", "Committed", "Forecast", "Remaining", "Comment"], model.rows.filter((r) => r.budget || r.forecast).map((r) => [`<b>${e(CATEGORY_META[r.cat]?.label || "")}</b>${bs.owners?.[r.cat] ? `<div class="muted">${e(bs.owners[r.cat])}</div>` : ""}`, gbp(r.budget), gbp(r.spent), gbp(r.committed), `<b>${gbp(r.forecast)}</b>`, `<span class="${r.remaining < 0 ? "bad" : "ok"}">${gbp(r.remaining)}</span>`, e(bs.varianceNotes?.[year]?.[r.cat] || "")]), [1, 2, 3, 4, 5])}
  <h2>Month by month</h2>${tableHtml(["Month", "Spent", "Expected", "Phased budget"], MONTH_LABELS.map((m, i) => [m, i < model.elapsedMonths ? gbp(model.monthlySpent[i]) : "", i >= model.elapsedMonths ? gbp(model.monthlyFuture[i]) : "", gbp(model.monthlyPhased[i])]), [1, 2, 3])}
  <div class="muted">Spent = logged visits, completed jobs, contract payments to date and recorded plan-line actuals. Committed = approved jobs not yet finished. Forecast = spent + committed + still planned.</div>`);
}

/* ---------------------------------------------------------
   Cost lines: a budget grid — one row per cost (salaries, travel, utilities…), one column per month,
   budget vs what the invoices actually said.
--------------------------------------------------------- */
export const COST_LINE_SETS = {
  catering: ["Salaries", "Extra labour / agency", "Staff travel", "Utilities", "Food cost", "Consumables & packaging", "Equipment & repairs", "Cleaning materials", "Uniforms & laundry", "Management fee"],
  cleaning: ["Salaries", "Extra labour / cover", "Materials & consumables", "Washroom services", "Window cleaning", "Equipment", "Management fee"],
  security: ["Officer salaries", "Overtime / cover", "Mobile patrols", "Alarm response", "Equipment", "Management fee"],
};
export function fyMonth(fyYear, fyStart, i) { const idx = (fyStart - 1) + i; return { y: fyYear + Math.floor(idx / 12), m: (idx % 12) + 1 }; }
export function fyLabel(fyYear, fyStart) { return fyStart === 1 ? String(fyYear) : `${fyYear}/${String((fyYear + 1) % 100).padStart(2, "0")}`; }
export function currentFy(fyStart, today = new Date()) { const y = today.getFullYear(), m = today.getMonth() + 1; return m >= fyStart ? y : y - 1; }

export function CostLinesView({ lines, suppliers = [], fyStart = 1, bs = {}, onSaveBs, onSaveMany, onDelete, onRecordInvoice, locationName = "", userName = "" }) {
  const [fy, setFy] = useState(currentFy(fyStart));
  const [cat, setCat] = useState(() => (lines.find((l) => l.year === currentFy(fyStart))?.category) || "catering");
  const [adding, setAdding] = useState(false); const [cell, setCell] = useState(null); const [invoiceOpen, setInvoiceOpen] = useState(false); const [editLine, setEditLine] = useState(null);
  const months = Array.from({ length: 12 }, (_, i) => fyMonth(fy, fyStart, i));
  const mLabel = (i) => `${MONTH_LABELS[months[i].m - 1]}${fyStart === 1 ? "" : ` ${String(months[i].y).slice(2)}`}`;
  const today = new Date().toISOString().slice(0, 10);
  const isPast = (i) => `${months[i].y}-${String(months[i].m).padStart(2, "0")}-31` < today;
  const isCurrent = (i) => today.startsWith(`${months[i].y}-${String(months[i].m).padStart(2, "0")}`);
  const elapsed = months.filter((_, i) => isPast(i) || isCurrent(i)).length;
  const rows = lines.filter((l) => l.year === fy && l.category === cat).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name)));
  const catsUsed = [...new Set(lines.filter((l) => l.year === fy).map((l) => l.category))];
  const sum = (arr, to = 12) => (arr || []).slice(0, to).reduce((t, x) => t + (Number(x) || 0), 0);
  const tB = rows.reduce((t, l) => t + sum(l.budget), 0), tA = rows.reduce((t, l) => t + sum(l.actual), 0);
  const ytdB = rows.reduce((t, l) => t + sum(l.budget, elapsed), 0), ytdA = rows.reduce((t, l) => t + sum(l.actual, elapsed), 0);
  const missing = rows.reduce((t, l) => t + months.filter((_, i) => isPast(i) && l.actual?.[i] == null && Number(l.budget?.[i]) > 0).length, 0);
  const colB = (i) => rows.reduce((t, l) => t + (Number(l.budget?.[i]) || 0), 0); const colA = (i) => rows.reduce((t, l) => t + (Number(l.actual?.[i]) || 0), 0);
  const hasA = (i) => rows.some((l) => l.actual?.[i] != null);
  const cellColour = (b, a) => a == null ? "var(--faint)" : !b ? "var(--warn)" : a > b * 1.05 ? "var(--danger)" : a < b * 0.95 ? "var(--ok)" : "var(--text)";
  const th = { padding: "6px 6px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textAlign: "right", whiteSpace: "nowrap", background: "var(--card-hi)" };
  const td = { padding: "5px 6px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, whiteSpace: "nowrap", borderTop: "1px solid var(--border)" };
  const sticky = { position: "sticky", left: 0, background: "var(--card)", zIndex: 1, textAlign: "left", minWidth: 130, maxWidth: 170 };
  function exportXlsx() {
    const head = ["Cost line", ...months.map((_, i) => mLabel(i)), "Total"];
    const mk = (k) => rows.map((l) => [l.name, ...months.map((_, i) => (l[k]?.[i] == null ? null : Number(l[k][i]))), sum(l[k])]);
    const tot = (k) => ["Total", ...months.map((_, i) => rows.reduce((t, l) => t + (Number(l[k]?.[i]) || 0), 0)), rows.reduce((t, l) => t + sum(l[k]), 0)];
    const varRows = rows.map((l) => [l.name, ...months.map((_, i) => (l.actual?.[i] == null ? null : (Number(l.budget?.[i]) || 0) - Number(l.actual[i]))), sum(l.budget, elapsed) - sum(l.actual, elapsed)]);
    const money = head.map((_, i) => i).slice(1);
    buildWorkbook([
      { name: "Budget", title: `${CATEGORY_META[cat]?.label || cat} budget ${fyLabel(fy, fyStart)}`, subtitle: locationName, headers: head, rows: [...mk("budget"), tot("budget")], widths: [26, ...months.map(() => 11), 13], money },
      { name: "Actual", title: `${CATEGORY_META[cat]?.label || cat} actual ${fyLabel(fy, fyStart)}`, subtitle: "From invoices", headers: head, rows: [...mk("actual"), tot("actual")], widths: [26, ...months.map(() => 11), 13], money },
      { name: "Variance", title: "Budget minus actual (positive = under budget)", subtitle: `Year to date column covers ${elapsed} month${elapsed === 1 ? "" : "s"}`, headers: [...head.slice(0, -1), "Year to date"], rows: varRows, widths: [26, ...months.map(() => 11), 13], money },
    ]).then((buf) => downloadBlob(xlsxBlob(buf), `${cat}-cost-lines-${fyLabel(fy, fyStart).replace("/", "-")}.xlsx`));
  }
  function printGrid() {
    const e = escapeHtml;
    openPrintReport(`${CATEGORY_META[cat]?.label || cat} — budget vs actual ${fyLabel(fy, fyStart)}`, locationName, `<div class="kpis"><div class="kpi">Year budget<b>${gbp(tB)}</b></div><div class="kpi">Budget to date<b>${gbp(ytdB)}</b></div><div class="kpi">Actual to date<b class="${ytdA > ytdB ? "bad" : "ok"}">${gbp(ytdA)}</b></div><div class="kpi">Variance to date<b class="${ytdA > ytdB ? "bad" : "ok"}">${gbp(ytdB - ytdA)}</b></div></div>
    ${tableHtml(["Cost line", ...months.slice(0, Math.max(elapsed, 1)).map((_, i) => mLabel(i)), "Budget YTD", "Actual YTD", "Variance"], [...rows.map((l) => [`<b>${e(l.name)}</b>`, ...months.slice(0, Math.max(elapsed, 1)).map((_, i) => l.actual?.[i] == null ? `<span class="muted">${gbp(l.budget?.[i] || 0)}</span>` : `<span class="${Number(l.actual[i]) > Number(l.budget?.[i] || 0) * 1.05 ? "bad" : ""}">${gbp(l.actual[i])}</span>`), gbp(sum(l.budget, elapsed)), gbp(sum(l.actual, elapsed)), `<b class="${sum(l.actual, elapsed) > sum(l.budget, elapsed) ? "bad" : "ok"}">${gbp(sum(l.budget, elapsed) - sum(l.actual, elapsed))}</b>`]), ["<b>Total</b>", ...months.slice(0, Math.max(elapsed, 1)).map((_, i) => `<b>${gbp(colA(i))}</b>`), `<b>${gbp(ytdB)}</b>`, `<b>${gbp(ytdA)}</b>`, `<b>${gbp(ytdB - ytdA)}</b>`]])}
    <div class="muted">Month cells show the invoiced amount; grey = budget only, no invoice entered yet. Red = more than 5% over budget.</div>`);
  }
  function copyToNextYear() {
    const pct = window.prompt(`Copy these ${rows.length} lines into ${fyLabel(fy + 1, fyStart)}. Increase budgets by what %? (0 for the same)`, String(bs.inflation ?? 0));
    if (pct === null) return; const f = 1 + (Number(pct) || 0) / 100;
    const exists = new Set(lines.filter((l) => l.year === fy + 1 && l.category === cat).map((l) => l.name.toLowerCase()));
    const fresh = rows.filter((l) => !exists.has(l.name.toLowerCase())).map((l) => ({ name: l.name, category: l.category, supplierId: l.supplierId || null, order: l.order, year: fy + 1, budget: (l.budget || []).map((b) => Math.round((Number(b) || 0) * f * 100) / 100), actual: Array(12).fill(null), refs: {} }));
    if (!fresh.length) { window.alert("Those lines are already in next year."); return; }
    onSaveMany(fresh); setFy(fy + 1);
  }
  const btnS = { background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Select value={fy} onChange={(e) => setFy(Number(e.target.value))} style={{ width: 110, fontSize: 13 }}>{Array.from({ length: 6 }, (_, i) => currentFy(fyStart) - 3 + i).map((y) => <option key={y} value={y}>{fyLabel(y, fyStart)}</option>)}</Select>
        {CATEGORY_KEYS.map((c) => <ToggleButton key={c} active={cat === c} onClick={() => setCat(c)}>{CATEGORY_META[c]?.label}{catsUsed.includes(c) ? ` (${lines.filter((l) => l.year === fy && l.category === c).length})` : ""}</ToggleButton>)}
      </div>
      {rows.length > 0 && (
        <div className="bento kpis">
          {[["Year budget", gbp(tB), "var(--text)"], ["Budget to date", gbp(ytdB), "var(--text)"], ["Invoiced to date", gbp(ytdA), ytdA > ytdB ? "var(--danger)" : "var(--ok)"], [ytdA > ytdB ? "Over to date" : "Under to date", gbp(Math.abs(ytdB - ytdA)), ytdA > ytdB ? "var(--danger)" : "var(--ok)"]].map(([l, v, c]) => (
            <div key={l} className="bcard c1" style={{ padding: "11px 13px", gap: 3 }}><div className="blabel">{l}</div><div className="bbig" style={{ fontSize: 22, color: c }}>{v}</div></div>
          ))}
        </div>
      )}
      {missing > 0 && <div style={{ fontSize: 12.5, background: "var(--warn-soft)", color: "var(--warn)", borderRadius: 10, padding: "8px 11px", fontWeight: 650 }}>{missing} past month{missing === 1 ? "" : "s"} across these lines with no invoice amount yet — shown in grey.</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ACTIVE_CAN_EDIT && rows.length > 0 && <PrimaryButton onClick={() => setInvoiceOpen(true)} style={{ flex: "1 1 200px" }}><FileSpreadsheet size={15} /> Enter an invoice</PrimaryButton>}
        {ACTIVE_CAN_EDIT && <button onClick={() => setAdding(true)} style={{ ...btnS, flex: rows.length ? "0 0 auto" : "1 1 200px", justifyContent: "center", background: rows.length ? "var(--card-hi)" : "var(--accent)", color: rows.length ? "var(--accent)" : "var(--on-accent)", padding: "10px 12px" }}>+ Add cost line{rows.length ? "" : "s"}</button>}
      </div>
      {rows.length === 0 ? (
        <div style={{ ...card, alignItems: "center", textAlign: "center", padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 750 }}>No {CATEGORY_META[cat]?.label?.toLowerCase()} cost lines for {fyLabel(fy, fyStart)}</div>
          <div className="bsub" style={{ maxWidth: 440 }}>Add each cost you budget for — salaries, extra labour, travel, utilities… — with its monthly budget. Then each month enter what the invoice says, and you'll see budget vs actual for every line.</div>
          {ACTIVE_CAN_EDIT && COST_LINE_SETS[cat] && <button onClick={() => onSaveMany(COST_LINE_SETS[cat].map((n, i) => ({ name: n, category: cat, year: fy, order: i, budget: Array(12).fill(0), actual: Array(12).fill(null), refs: {} })))} style={{ ...btnS, marginTop: 6 }}>Start with the usual {CATEGORY_META[cat]?.label?.toLowerCase()} lines ({COST_LINE_SETS[cat].length})</button>}
          {lines.some((l) => l.year === fy - 1 && l.category === cat) && <div className="bsub">Tip: open {fyLabel(fy - 1, fyStart)} and use "Copy to next year".</div>}
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={{ ...th, ...sticky, background: "var(--card-hi)" }}>Cost line</th>{months.map((_, i) => <th key={i} style={{ ...th, color: isCurrent(i) ? "var(--accent)" : th.color }}>{mLabel(i)}</th>)}<th style={th}>Year</th><th style={th}>To date</th></tr></thead>
              <tbody>
                {rows.map((l) => { const vb = sum(l.budget, elapsed), va = sum(l.actual, elapsed); return (
                  <tr key={l.id}>
                    <td style={{ ...td, ...sticky, fontFamily: "inherit", fontSize: 12.3, fontWeight: 650, whiteSpace: "normal" }}><button onClick={() => ACTIVE_CAN_EDIT && setEditLine(l)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontWeight: 650, color: "var(--text)" }}>{l.name}</button>{l.supplierId && <div style={{ fontSize: 10, color: "var(--faint)", fontWeight: 500 }}>{suppliers.find((s) => s.id === l.supplierId)?.name}</div>}</td>
                    {months.map((_, i) => { const b = Number(l.budget?.[i]) || 0; const a = l.actual?.[i] == null ? null : Number(l.actual[i]); return (
                      <td key={i} onClick={() => ACTIVE_CAN_EDIT && setCell({ line: l, i })} title={`Budget ${gbp(b)}${a != null ? ` · invoiced ${gbp(a)}` : ""}${l.refs?.[i] ? ` · ${l.refs[i]}` : ""}`} style={{ ...td, cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", background: isCurrent(i) ? "var(--accent-soft)" : undefined }}>
                        <div style={{ fontWeight: a != null ? 700 : 400, color: cellColour(b, a) }}>{a != null ? gbp(a).replace(/\.00$/, "") : isPast(i) && b ? "—" : ""}</div>
                        <div style={{ fontSize: 9.5, color: "var(--faint)" }}>{b ? gbp(b).replace(/\.00$/, "") : ""}</div>
                      </td>
                    ); })}
                    <td style={{ ...td, fontWeight: 700 }}>{gbp(sum(l.budget)).replace(/\.00$/, "")}</td>
                    <td style={{ ...td, fontWeight: 700, color: va > vb ? "var(--danger)" : "var(--ok)" }}>{va || vb ? `${va > vb ? "+" : "−"}${gbp(Math.abs(va - vb)).replace(/\.00$/, "")}` : ""}</td>
                  </tr>
                ); })}
                <tr style={{ background: "var(--card-hi)" }}>
                  <td style={{ ...td, ...sticky, background: "var(--card-hi)", fontFamily: "inherit", fontWeight: 800, fontSize: 12.3 }}>Total</td>
                  {months.map((_, i) => <td key={i} style={{ ...td, fontWeight: 800 }}><div style={{ color: hasA(i) ? cellColour(colB(i), colA(i)) : "var(--faint)" }}>{hasA(i) ? gbp(colA(i)).replace(/\.00$/, "") : ""}</div><div style={{ fontSize: 9.5, color: "var(--faint)", fontWeight: 500 }}>{gbp(colB(i)).replace(/\.00$/, "")}</div></td>)}
                  <td style={{ ...td, fontWeight: 800 }}>{gbp(tB).replace(/\.00$/, "")}</td>
                  <td style={{ ...td, fontWeight: 800, color: ytdA > ytdB ? "var(--danger)" : "var(--ok)" }}>{`${ytdA > ytdB ? "+" : "−"}${gbp(Math.abs(ytdA - ytdB)).replace(/\.00$/, "")}`}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", padding: "7px 10px", borderTop: "1px solid var(--border)" }}>Each cell: <b>invoiced</b> (top) · budget (small). <span style={{ color: "var(--danger)" }}>Red</span> = over budget by 5%+, <span style={{ color: "var(--ok)" }}>green</span> = under. "To date" = invoiced minus budget so far. Tap a cell to change it, or a line name to edit the line.</div>
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={exportXlsx} style={btnS}><FileSpreadsheet size={13} /> Excel</button>
          <button onClick={printGrid} style={btnS}><Printer size={13} /> Print</button>
          {ACTIVE_CAN_EDIT && <button onClick={copyToNextYear} style={btnS}>Copy to next year</button>}
        </div>
      )}
      {adding && <CostLineModal cat={cat} fy={fy} suppliers={suppliers} months={months} mLabel={mLabel} onClose={() => setAdding(false)} onSave={(ls) => { onSaveMany(ls.map((x, k) => ({ ...x, order: rows.length + k }))); setAdding(false); }} />}
      {editLine && <CostLineModal existing={editLine} cat={cat} fy={fy} suppliers={suppliers} months={months} mLabel={mLabel} onClose={() => setEditLine(null)} onSave={(ls) => { onSaveMany(ls); setEditLine(null); }} onDelete={() => { if (window.confirm(`Delete "${editLine.name}" and all its figures for ${fyLabel(fy, fyStart)}?`)) { onDelete(editLine.id); setEditLine(null); } }} />}
      {cell && <CellModal line={cell.line} i={cell.i} label={`${cell.line.name} — ${mLabel(cell.i)} ${months[cell.i].y}`} onClose={() => setCell(null)} onSave={(patch) => { onSaveMany([{ ...cell.line, ...patch }]); setCell(null); }} />}
      {invoiceOpen && <InvoiceSplitModal rows={rows} months={months} mLabel={mLabel} suppliers={suppliers} defaultMonth={Math.max(0, Math.min(11, elapsed - (months[elapsed - 1] && isCurrent(elapsed - 1) && new Date().getDate() < 15 ? 2 : 1)))} catLabel={CATEGORY_META[cat]?.label}
        onClose={() => setInvoiceOpen(false)} onSave={({ i, amounts, mode, ref, supplierId, date, record }) => {
          const changed = rows.filter((l) => amounts[l.id] !== undefined && amounts[l.id] !== "").map((l) => { const a = [...(l.actual || Array(12).fill(null))]; const v = Number(amounts[l.id]) || 0; a[i] = mode === "add" && a[i] != null ? Number(a[i]) + v : v; return { ...l, actual: a, refs: { ...(l.refs || {}), [i]: [mode === "add" && l.refs?.[i] ? l.refs[i] : "", ref].filter(Boolean).join(", ") } }; });
          onSaveMany(changed);
          const total = rows.reduce((t, l) => t + (Number(amounts[l.id]) || 0), 0);
          if (record && onRecordInvoice && total) onRecordInvoice({ number: ref || `${CATEGORY_META[cat]?.label} ${mLabel(i)}`, supplierId: supplierId || null, amount: total, date, note: `Split across ${changed.length} ${CATEGORY_META[cat]?.label?.toLowerCase()} cost lines (${mLabel(i)} ${months[i].y})` });
          setInvoiceOpen(false);
        }} />}
    </div>
  );
}

function CostLineModal({ existing, cat, fy, suppliers, months, mLabel, onClose, onSave, onDelete }) {
  const [names, setNames] = useState(existing ? existing.name : ""); const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [mode, setMode] = useState(existing ? "keep" : "monthly"); const [amount, setAmount] = useState("");
  const build = () => { const a = Number(amount) || 0; if (mode === "monthly") return Array(12).fill(a); if (mode === "annual") { const base = Math.floor((a / 12) * 100) / 100; const arr = Array(12).fill(base); arr[11] = Math.round((a - base * 11) * 100) / 100; return arr; } return null; };
  function save() {
    if (existing) { const b = mode === "keep" ? existing.budget : build(); onSave([{ ...existing, name: names.trim() || existing.name, supplierId: supplierId || null, budget: b }]); return; }
    const list = names.split(/\n|,/).map((x) => x.trim()).filter(Boolean); if (!list.length) return;
    onSave(list.map((n) => ({ name: n, category: cat, year: fy, supplierId: supplierId || null, budget: build() || Array(12).fill(0), actual: Array(12).fill(null), refs: {} })));
  }
  return (
    <Modal title={existing ? "Cost line" : "Add cost lines"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {existing ? <Field label="Name"><TextInput value={names} onChange={(e) => setNames(e.target.value)} /></Field>
          : <Field label="Cost line name(s) — one per line to add several"><TextArea autoFocus value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Salaries\nExtra labour\nStaff travel\nUtilities"} style={{ minHeight: 90 }} /></Field>}
        <Field label="Supplier (optional)"><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>Budget</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {existing && <ToggleButton active={mode === "keep"} onClick={() => setMode("keep")}>Keep as it is</ToggleButton>}
          <ToggleButton active={mode === "monthly"} onClick={() => setMode("monthly")}>Same every month</ToggleButton>
          <ToggleButton active={mode === "annual"} onClick={() => setMode("annual")}>Annual total, split evenly</ToggleButton>
          <ToggleButton active={mode === "later"} onClick={() => setMode("later")}>I'll fill in each month</ToggleButton>
        </div>
        {(mode === "monthly" || mode === "annual") && <Field label={mode === "monthly" ? "Budget per month (£)" : "Budget for the year (£)"}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
        {mode === "later" && <div className="bsub">Tap each month's cell in the grid to set its budget — useful when months differ (e.g. extra labour at Christmas).</div>}
        {existing && mode === "keep" && <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{months.map((_, i) => `${mLabel(i)} ${gbp(existing.budget?.[i] || 0)}`).join(" · ")}</div>}
        <PrimaryButton onClick={save}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && onDelete && <button onClick={onDelete} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Delete this line</button>}
      </div>
    </Modal>
  );
}

function CellModal({ line, i, label, onClose, onSave }) {
  const [budget, setBudget] = useState(String(line.budget?.[i] ?? "")); const [actual, setActual] = useState(line.actual?.[i] == null ? "" : String(line.actual[i])); const [ref, setRef] = useState(line.refs?.[i] || "");
  const [applyRest, setApplyRest] = useState(false);
  return (
    <Modal title={label} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Budget for this month (£)"><TextInput type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
        {i < 11 && <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}><input type="checkbox" checked={applyRest} onChange={(e) => setApplyRest(e.target.checked)} style={{ margin: 0 }} /> Use this budget for the rest of the year too</label>}
        <Field label="Actual from the invoice (£) — leave blank if not invoiced yet"><TextInput autoFocus type="number" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
        <Field label="Invoice number / note"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. INV-2231" /></Field>
        {actual !== "" && budget !== "" && <div style={{ fontSize: 12.5, fontWeight: 650, color: Number(actual) > Number(budget) ? "var(--danger)" : "var(--ok)" }}>{Number(actual) > Number(budget) ? `${gbp(Number(actual) - Number(budget))} over budget` : `${gbp(Number(budget) - Number(actual))} under budget`}</div>}
        <PrimaryButton onClick={() => { const b = [...(line.budget || Array(12).fill(0))]; const bv = Number(budget) || 0; if (applyRest) { for (let k = i; k < 12; k++) b[k] = bv; } else b[i] = bv; const a = [...(line.actual || Array(12).fill(null))]; a[i] = actual === "" ? null : Number(actual); onSave({ budget: b, actual: a, refs: { ...(line.refs || {}), [i]: ref.trim() } }); }}><CheckCircle2 size={15} /> Save</PrimaryButton>
      </div>
    </Modal>
  );
}

function InvoiceSplitModal({ rows, months, mLabel, suppliers, defaultMonth, catLabel, onClose, onSave }) {
  const [i, setI] = useState(defaultMonth); const [amounts, setAmounts] = useState({}); const [ref, setRef] = useState(""); const [mode, setMode] = useState("replace");
  const [supplierId, setSupplierId] = useState(rows.find((r) => r.supplierId)?.supplierId || ""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [record, setRecord] = useState(true);
  const total = rows.reduce((t, l) => t + (Number(amounts[l.id]) || 0), 0); const budgetTotal = rows.reduce((t, l) => t + (Number(l.budget?.[i]) || 0), 0);
  const already = rows.some((l) => l.actual?.[i] != null);
  return (
    <Modal title={`Enter a ${catLabel?.toLowerCase() || ""} invoice`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="For month"><Select value={i} onChange={(e) => setI(Number(e.target.value))}>{months.map((mm, k) => <option key={k} value={k}>{mLabel(k)} {mm.y}</option>)}</Select></Field>
          <Field label="Invoice number"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. INV-2231" /></Field>
          <Field label="Supplier"><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Invoice date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {already && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}><span style={{ fontSize: 12, color: "var(--warn)", fontWeight: 650 }}>Some lines already have an amount for {mLabel(i)}:</span><ToggleButton active={mode === "replace"} onClick={() => setMode("replace")}>Replace</ToggleButton><ToggleButton active={mode === "add"} onClick={() => setMode("add")}>Add to it (second invoice)</ToggleButton></div>}
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Enter the amount for each line as shown on the invoice (net of VAT). Leave a line blank if it isn't on this invoice.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {rows.map((l) => { const b = Number(l.budget?.[i]) || 0; const v = amounts[l.id]; return (
            <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.8 }}>{l.name}<span style={{ display: "block", fontSize: 10.5, color: "var(--faint)" }}>budget {gbp(b)}{l.actual?.[i] != null ? ` · now ${gbp(l.actual[i])}` : ""}</span></span>
              <TextInput type="number" step="0.01" value={v ?? ""} onChange={(e) => setAmounts((p) => ({ ...p, [l.id]: e.target.value }))} placeholder={b ? String(b) : "£"} style={{ width: 110, textAlign: "right", borderColor: v !== undefined && v !== "" && Number(v) > b * 1.05 && b ? "var(--danger)" : undefined }} />
            </div>
          ); })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 8 }}><span>Invoice total</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: total > budgetTotal && budgetTotal ? "var(--danger)" : "var(--text)" }}>{gbp(total)} <span style={{ fontWeight: 500, color: "var(--faint)" }}>vs {gbp(budgetTotal)} budget</span></span></div>
        <button type="button" onClick={() => setAmounts(Object.fromEntries(rows.map((l) => [l.id, String(Number(l.budget?.[i]) || 0)])))} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Fill every line with its budget (then change the ones that differ)</button>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} style={{ margin: 0 }} /> Also record it in POs &amp; invoices (for approval and payment tracking)</label>
        <PrimaryButton onClick={() => total && onSave({ i, amounts, mode, ref: ref.trim(), supplierId, date, record })} style={{ opacity: total ? 1 : 0.5 }}><CheckCircle2 size={15} /> Save invoice ({gbp(total)})</PrimaryButton>
      </div>
    </Modal>
  );
}
