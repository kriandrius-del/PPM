// Reports: the monthly FM report first (print/PDF, CSV, Excel), then every other report, and the site health page.
import { useState } from "react";
import { FileBarChart, Printer, Table2, Gauge, Building2 } from "lucide-react";
import { ReportsModal } from "../../modals/AppModals.jsx";
import { Btn, Card, InlineModalContext, Pill, ScoreRing } from "../../components/ds.jsx";
import { Select } from "../../components/ui.jsx";
import { MONTH_NAMES } from "../../lib/constants.js";
import { buildXlsx, openPrintReport } from "../../lib/reports.js";
import { csvHref, downloadBlob, gbp } from "../../lib/utils.js";
import { buildMonthlyFm } from "./monthlyFm.js";
import { HealthBreakdown, printHealth } from "../health/HealthPanel.jsx";
import { healthBand } from "../health/siteHealth.js";

export function ReportsPage({ fmData, reportsData, siteName }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getDate() <= 7 ? (now.getMonth() + 11) % 12 : now.getMonth());
  const [year, setYear] = useState(now.getDate() <= 7 && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [blocked, setBlocked] = useState(false);
  const title = `Monthly FM report — ${MONTH_NAMES[month]} ${year}`;
  const make = () => buildMonthlyFm(fmData, year, month);
  const years = [now.getFullYear() - 1, now.getFullYear()];
  async function excel() {
    const r = make();
    try { const blob = await buildXlsx([{ name: "Monthly FM report", headers: r.csv[0], rows: r.csv.slice(1), widths: [36, 16, 16] }]); downloadBlob(blob, `monthly-fm-report-${year}-${String(month + 1).padStart(2, "0")}.xlsx`); }
    catch (e) { window.location.href = csvHref(r.csv); }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card title="Monthly FM report" icon={FileBarChart}>
        <div className="fm-sub">Executive summary, site health, maintenance and PPM performance, reactive works, open risks, compliance, safety, suppliers, budget and spend, projects, outstanding actions — and how each measure moved against the month before.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: "auto" }} aria-label="Month">{MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}</Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: "auto" }} aria-label="Year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
          <Btn variant="primary" icon={Printer} onClick={() => setBlocked(!openPrintReport(title, siteName, make().html))}>Open / print (PDF)</Btn>
          <a className="fm-btn fm-btn-secondary fm-btn-md" href={csvHref(make().csv)} download={`monthly-fm-report-${year}-${String(month + 1).padStart(2, "0")}.csv`} style={{ textDecoration: "none" }}><Table2 size={15} /> CSV</a>
          <Btn icon={Table2} onClick={excel}>Excel</Btn>
        </div>
        {blocked && <div className="fm-error">Your browser blocked the report window — allow pop-ups for this site and try again.</div>}
      </Card>
      <InlineModalContext.Provider value={true}>
        <ReportsModal data={reportsData} locationName={siteName} onClose={() => {}} />
      </InlineModalContext.Provider>
    </div>
  );
}

export function HealthPage({ health, siteName, portfolio = [], onGo }) {
  return (
    <div className="fm-grid-2">
      <Card title={`Site health — ${siteName}`} icon={Gauge} right={<Btn size="sm" icon={Printer} onClick={() => printHealth(health, siteName)}>Print</Btn>}>
        <HealthBreakdown health={health} onGo={onGo} />
      </Card>
      {portfolio.length > 1 && (
        <Card title="All sites" icon={Building2}>
          <div className="fm-list">
            {portfolio.map((p) => (
              <button key={p.siteId} className="fm-row fm-click" onClick={p.go}>
                <ScoreRing score={p.score} size={38} stroke={4} />
                <span className="fm-row-main"><span className="fm-row-title">{p.name}{p.current ? " · this site" : ""}</span><span className="fm-row-sub">{p.red} red compliance item{p.red === 1 ? "" : "s"} · {p.overdue} overdue · {gbp(p.spent)} spent</span></span>
                <Pill tone={healthBand(p.score).tone}>{healthBand(p.score).label}</Pill>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
