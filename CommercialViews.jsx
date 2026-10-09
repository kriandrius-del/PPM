// Commercial → Overview & approvals, and Contracts.
import { useMemo, useState } from "react";
import { CheckCircle2, FileSignature, PoundSterling, Printer, Boxes, Building2, Truck } from "lucide-react";
import { ExportButton, Select } from "../../components/ui.jsx";
import { Btn, Card, Empty, Kpi, Meter, Pill, Row, useWide } from "../../components/ds.jsx";
import { CATEGORY_META } from "../../lib/globals.js";
import { openPrintReport, buildContractCalendar } from "../../lib/reports.js";
import { daysUntil, fmtDate, gbp } from "../../lib/utils.js";
import { placeOf } from "../assets/places.js";

export function CommercialOverview({ model, year, approvals = [], devices = [], services = [], works = [], suppliers = [], locations = [], buildings = [], spaces = [], onGo, onOpenAsset }) {
  const [cat, setCat] = useState("");
  const rows = model.rows.filter((r) => r.budget || r.spent || r.forecast);
  const inYear = (d) => String(d || "").slice(0, 4) === String(year);
  const catOf = Object.fromEntries(devices.map((d) => [d.id, d.serviceCategory || "maintenance"]));
  // what each asset has cost this year (visits + finished jobs)
  const byAsset = useMemo(() => {
    const m = {};
    services.forEach((v) => { if (inYear(v.date) && Number(v.cost)) m[v.deviceId] = (m[v.deviceId] || 0) + Number(v.cost); });
    works.forEach((w) => { if (w.status === "completed" && !w.warranty && w.budgetType !== "non_controllable" && inYear(w.completedAt || w.dateRaised)) m[w.deviceId] = (m[w.deviceId] || 0) + (Number(w.finalCost ?? w.quoteAmount) || 0); });
    return m;
  }, [services, works, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const devById = Object.fromEntries(devices.map((d) => [d.id, d]));
  const assetTop = Object.entries(byAsset).filter(([id]) => devById[id] && (!cat || catOf[id] === cat)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const byBuilding = {}; Object.entries(byAsset).forEach(([id, x]) => { const d = devById[id]; if (!d || (cat && catOf[id] !== cat)) return; const b = placeOf(d, { locations, buildings, spaces }).building?.name || "Not in a building"; byBuilding[b] = (byBuilding[b] || 0) + x; });
  const bySup = {}; services.forEach((v) => { if (!inYear(v.date) || (cat && catOf[v.deviceId] !== cat)) return; const s = v.supplierId || devById[v.deviceId]?.supplierId; if (s) bySup[s] = (bySup[s] || 0) + (Number(v.cost) || 0); });
  works.forEach((w) => { if (w.status !== "completed" || !w.supplierId || !inYear(w.completedAt || w.dateRaised) || (cat && catOf[w.deviceId] !== cat)) return; bySup[w.supplierId] = (bySup[w.supplierId] || 0) + (Number(w.finalCost ?? w.quoteAmount) || 0); });
  const supTop = Object.entries(bySup).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const m = cat ? model.rows.find((r) => r.cat === cat) || { budget: 0, spent: 0, committed: 0, forecast: 0 } : model;
  const tone = (r) => !r.budget ? "muted" : r.forecast > r.budget * 1.02 ? "danger" : r.forecast > r.budget * 0.95 ? "warn" : "ok";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: "auto" }} aria-label="Category"><option value="">All categories</option>{model.rows.map((r) => <option key={r.cat} value={r.cat}>{CATEGORY_META[r.cat]?.label || r.cat}</option>)}</Select>
        <span className="fm-sub">{year} · this site</span>
      </div>
      <div className="fm-kpis" style={{ marginBottom: 12 }}>
        <Kpi label="Budget" value={m.budget ? gbp(m.budget) : "—"} />
        <Kpi label="Committed" value={gbp(m.committed)} sub="approved, not finished" />
        <Kpi label="Spent" value={gbp(m.spent)} />
        <Kpi label="Remaining" value={m.budget ? gbp(m.budget - m.spent - m.committed) : "—"} tone={m.budget && m.budget - m.spent - m.committed < 0 ? "danger" : undefined} />
        <Kpi label="Forecast" value={gbp(m.forecast)} tone={tone(m)} sub={m.budget ? `${Math.round((m.forecast / m.budget) * 100)}% of budget` : ""} />
      </div>
      <div className="fm-grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <Card title="Waiting for approval" icon={CheckCircle2}>
            {approvals.length ? <div className="fm-list">{approvals.map((a) => <Row key={a.key} tone={a.tone || "warn"} title={a.title} sub={a.sub} right={a.amount ? <b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(a.amount)}</b> : null} onClick={a.go} />)}</div>
              : <Empty icon={CheckCircle2} title="Nothing waiting" body="Quotes, purchase orders and invoices that need a decision show here." />}
          </Card>
          <Card title="By category" icon={PoundSterling} right={<Btn size="sm" variant="ghost" onClick={() => onGo("money.budget")}>Budget</Btn>}>
            {rows.length ? rows.map((r) => (
              <div key={r.cat} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}><b>{CATEGORY_META[r.cat]?.label || r.cat}</b><span className="fm-sub">{gbp(r.spent)} spent · {gbp(r.committed)} committed · forecast {gbp(r.forecast)} of {r.budget ? gbp(r.budget) : "—"}</span></div>
                <Meter pct={r.budget ? (r.spent / r.budget) * 100 : 0} tone={tone(r) === "muted" ? "info" : tone(r)} />
              </div>
            )) : <div className="fm-sub">No budget or spend yet this year.</div>}
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <Card title="Assets that cost the most" icon={Boxes}>
            {assetTop.length ? <div className="fm-list">{assetTop.map(([id, x]) => <Row key={id} title={devById[id].name} right={<b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(x)}</b>} onClick={() => onOpenAsset(id)} />)}</div> : <div className="fm-sub">No spend recorded against assets this year.</div>}
          </Card>
          <Card title="By building" icon={Building2}>
            {Object.keys(byBuilding).length ? <div className="fm-list">{Object.entries(byBuilding).sort((a, b) => b[1] - a[1]).map(([b, x]) => <Row key={b} title={b} right={<b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(x)}</b>} />)}</div> : <div className="fm-sub">No spend yet. Put assets in rooms (Assets → Locations) to see spend by building.</div>}
          </Card>
          <Card title="By supplier" icon={Truck}>
            {supTop.length ? <div className="fm-list">{supTop.map(([id, x]) => <Row key={id} title={suppliers.find((s) => s.id === id)?.name || "Unknown supplier"} right={<b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(x)}</b>} />)}</div> : <div className="fm-sub">No supplier spend yet this year.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ContractsView({ suppliers = [], siteName, onOpenSupplier }) {
  const wide = useWide();
  const annual = (s) => (s.costFrequency === "annual" ? Number(s.costAmount) || 0 : (Number(s.costAmount) || 0) * 12);
  const list = suppliers.filter((s) => s.contractEnd || s.contractStart || s.contractRef || Number(s.costAmount)).sort((a, b) => String(a.contractEnd || "9999").localeCompare(String(b.contractEnd || "9999")));
  const total = list.reduce((t, s) => t + annual(s), 0);
  const endingSoon = list.filter((s) => s.contractEnd && daysUntil(s.contractEnd) >= 0 && daysUntil(s.contractEnd) <= (Number(s.noticeDays) || 60)).length;
  const ended = list.filter((s) => s.contractEnd && daysUntil(s.contractEnd) < 0).length;
  const stat = (s) => { const n = daysUntil(s.contractEnd); if (n === null) return ["No end date", "muted"]; if (n < 0) return ["Ended", "danger"]; if (n <= (Number(s.noticeDays) || 60)) return [`Notice window · ${n}d`, "warn"]; return [`${n} days left`, "ok"]; };
  if (!list.length) return <Empty icon={FileSignature} title="No contracts yet" body="Add contract dates and values to your suppliers (People → Suppliers & contractors) and they'll be listed here with renewal warnings." />;
  return (
    <div>
      <div className="fm-kpis" style={{ marginBottom: 12 }}>
        <Kpi label="Contracts" value={list.length} />
        <Kpi label="Yearly value" value={gbp(total)} />
        <Kpi label="In notice window" value={endingSoon} tone={endingSoon ? "warn" : undefined} />
        <Kpi label="Ended" value={ended} tone={ended ? "danger" : undefined} />
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 10 }}>
        <Btn size="sm" icon={Printer} onClick={() => openPrintReport("Contract calendar", siteName, buildContractCalendar(suppliers))}>Print calendar</Btn>
        <ExportButton label="CSV" filename="contracts.csv" rows={[["Supplier", "Category", "Contract ref", "Start", "End", "Notice days", "Yearly value", "Insurance expires", "Status"], ...list.map((s) => [s.name, CATEGORY_META[s.category]?.label || s.category || "", s.contractRef || "", s.contractStart || "", s.contractEnd || "", s.noticeDays || "", annual(s), s.insuranceExpiry || "", stat(s)[0]])]} />
      </div>
      {wide ? (
        <div className="fm-card" style={{ padding: 0 }}><div className="fm-scroll-x">
          <table className="fm-table">
            <thead><tr><th>Supplier</th><th>Ref</th><th>Start</th><th>End</th><th>Yearly value</th><th>Insurance</th><th>Status</th></tr></thead>
            <tbody>{list.map((s) => { const [l, t] = stat(s); const ins = daysUntil(s.insuranceExpiry); return (
              <tr key={s.id} className="fm-click" style={{ cursor: "pointer" }} onClick={() => onOpenSupplier(s)}>
                <td><b>{s.name}</b><div className="fm-sub">{CATEGORY_META[s.category]?.label || ""}{s.subCategory ? ` · ${s.subCategory}` : ""}</div></td>
                <td>{s.contractRef || "—"}</td><td style={{ whiteSpace: "nowrap" }}>{s.contractStart ? fmtDate(s.contractStart) : "—"}</td><td style={{ whiteSpace: "nowrap" }}>{s.contractEnd ? fmtDate(s.contractEnd) : "—"}</td>
                <td>{annual(s) ? gbp(annual(s)) : "—"}</td>
                <td>{s.insuranceExpiry ? <Pill tone={ins < 0 ? "danger" : ins <= 30 ? "warn" : "ok"}>{ins < 0 ? "Expired" : fmtDate(s.insuranceExpiry)}</Pill> : "—"}</td>
                <td><Pill tone={t}>{l}</Pill></td>
              </tr>
            ); })}</tbody>
          </table>
        </div></div>
      ) : <div className="fm-list">{list.map((s) => { const [l, t] = stat(s); return <Row key={s.id} tone={t} title={s.name} sub={[s.contractEnd && `ends ${fmtDate(s.contractEnd)}`, annual(s) && `${gbp(annual(s))} a year`].filter(Boolean).join(" · ")} right={<Pill tone={t}>{l}</Pill>} onClick={() => onOpenSupplier(s)} />; })}</div>}
    </div>
  );
}
