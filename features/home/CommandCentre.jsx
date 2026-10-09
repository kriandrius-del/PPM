// Home: what needs my attention → what's happening today → how is the site doing → what's coming next.
// Each role gets the version that fits its work (FM manager, engineer, finance, senior management).
import { AlertTriangle, CalendarClock, ClipboardList, Gauge, Hammer, PoundSterling, QrCode, ScanLine, ShieldAlert, Siren, Sun, Wrench, Building2, CheckCircle2, Clock } from "lucide-react";
import { Btn, Card, Empty, Kpi, LinkBtn, Meter, Pill, Row, ScoreRing } from "../../components/ds.jsx";
import { HealthTiles } from "../health/HealthPanel.jsx";
import { healthBand } from "../health/siteHealth.js";
import { fmtDate, gbp } from "../../lib/utils.js";

const greet = (name) => { const h = new Date().getHours(); return `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}${name ? `, ${String(name).split(" ")[0]}` : ""}`; };
const dateLine = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

function Attention({ items, total, onAll }) {
  const crit = items.filter((a) => a.tone === "danger");
  const act = items.filter((a) => a.tone !== "danger");
  if (!items.length) return <Card title="Needs attention" icon={ShieldAlert}><Empty icon={CheckCircle2} title="Nothing needs your attention" body="No overdue maintenance, expired certificates or urgent jobs at this site." /></Card>;
  const block = (label, list, tone) => list.length > 0 && (
    <div className="fm-list">
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: tone === "danger" ? "var(--danger)" : "var(--warn)" }}>{label} · {list.length}</div>
      {list.slice(0, tone === "danger" ? 6 : 4).map((a) => <Row key={a.key} tone={tone} icon={tone === "danger" ? AlertTriangle : Clock} title={a.title} sub={a.detail} onClick={a.go} />)}
    </div>
  );
  return (
    <Card title="Needs attention" icon={ShieldAlert} right={<LinkBtn onClick={onAll}>All {total}</LinkBtn>}>
      {block("Critical", crit, "danger")}
      {block("Action required", act, "warn")}
    </Card>
  );
}
function Timeline({ title, icon, items, empty, onMore }) {
  return (
    <Card title={title} icon={icon} right={onMore ? <LinkBtn onClick={onMore}>Open</LinkBtn> : null}>
      {items.length ? <div className="fm-list">{items.slice(0, 8).map((x) => <Row key={x.key} tone={x.tone} title={x.title} sub={[x.time, x.sub].filter(Boolean).join(" · ")} onClick={x.go} />)}</div>
        : <div className="fm-sub">{empty}</div>}
      {items.length > 8 && <div className="fm-sub">and {items.length - 8} more</div>}
    </Card>
  );
}
export function MoneyCard({ money, onOpen }) {
  if (!money) return null;
  const pct = money.budget ? Math.round((money.forecast / money.budget) * 100) : null;
  const tone = pct == null ? "info" : pct > 102 ? "danger" : pct > 95 ? "warn" : "ok";
  return (
    <Card title={`Money · ${new Date().getFullYear()}`} icon={PoundSterling} right={<LinkBtn onClick={onOpen}>Commercial</LinkBtn>}>
      <div className="fm-kpis">
        <Kpi label="Budget" value={money.budget ? gbp(money.budget) : "—"} />
        <Kpi label="Spent" value={gbp(money.spent)} />
        <Kpi label="Committed" value={gbp(money.committed)} title="Approved jobs not yet finished" />
        <Kpi label="Remaining" value={money.budget ? gbp(money.budget - money.spent - money.committed) : "—"} tone={money.budget && money.budget - money.spent - money.committed < 0 ? "danger" : undefined} />
        <Kpi label="Forecast" value={gbp(money.forecast)} tone={tone} sub={pct != null ? `${pct}% of budget` : "no budget set"} />
      </div>
      {money.budget > 0 && <Meter pct={(money.spent / money.budget) * 100} tone={tone} />}
      {money.approvals?.length > 0 && <div className="fm-list">{money.approvals.map((a) => <Row key={a.label} tone="warn" title={`${a.n} ${a.label}`} sub={a.amount ? gbp(a.amount) : ""} onClick={a.go} />)}</div>}
    </Card>
  );
}

export function CommandCentre(props) {
  const { kind = "manager", userName, siteName, health, onHealth, attention = [], attentionTotal = 0, onAllAlerts, today = [], week = [], money, quick = {}, canEdit, engineer = {}, finance = {}, portfolio = [], onGo } = props;
  const band = healthBand(health?.overall);
  const head = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 21, fontWeight: 750 }}>{greet(userName)}</div>
        <div className="fm-sub">{siteName} · {dateLine()}</div>
      </div>
      {health && (
        <button className="fm-card fm-click" onClick={() => onHealth()} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: "10px 14px" }} data-testid="site-health" aria-label={`Site health ${health.overall ?? "no score"} out of 100 — how it's worked out`}>
          <ScoreRing score={health.overall} size={54} stroke={6} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}><span className="fm-card-title">Site health</span><Pill tone={band.tone}>{band.label}</Pill></span>
        </button>
      )}
    </div>
  );
  const quickBar = canEdit && (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      {quick.onLog && <Btn variant="primary" icon={Wrench} onClick={quick.onLog}>Log a visit</Btn>}
      {quick.onJob && <Btn icon={Hammer} onClick={quick.onJob}>Raise a job</Btn>}
      {quick.onIncident && <Btn icon={Siren} onClick={quick.onIncident}>Report incident</Btn>}
      {quick.onScan && <Btn icon={QrCode} onClick={quick.onScan}>Scan QR</Btn>}
    </div>
  );

  if (kind === "engineer") return (
    <div>
      {head}
      {canEdit && (
        <div className="fm-big-actions" style={{ marginBottom: 14 }}>
          {quick.onScan && <button className="primary" onClick={quick.onScan}><ScanLine size={24} />Scan a QR code</button>}
          {quick.onLog && <button onClick={quick.onLog}><Wrench size={22} />Log a visit</button>}
          {quick.onJob && <button onClick={quick.onJob}><Hammer size={22} />Report a problem</button>}
          {quick.onReading && <button onClick={quick.onReading}><Gauge size={22} />Meter reading</button>}
        </div>
      )}
      <div className="fm-grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Timeline title="My jobs" icon={Hammer} items={engineer.myJobs || []} empty="No open jobs assigned to you." onMore={() => onGo("ops.works")} />
          <Timeline title="Planned maintenance due (7 days)" icon={Wrench} items={engineer.duePpm || []} empty="Nothing due in the next 7 days." onMore={() => onGo("ops.ppm")} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Timeline title="Today" icon={Sun} items={today} empty="Nothing booked for today." onMore={() => onGo("ops.schedule")} />
          <Timeline title="Checks due" icon={ClipboardList} items={engineer.checks || []} empty="All checks are up to date." onMore={() => onGo("ops.logs")} />
          {(engineer.recent || []).length > 0 && <Timeline title="Recent assets" icon={Building2} items={engineer.recent} empty="" />}
        </div>
      </div>
    </div>
  );

  if (kind === "finance") return (
    <div>
      {head}
      <div className="fm-grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card title="Waiting for approval" icon={CheckCircle2} right={<LinkBtn onClick={() => onGo("money.overview")}>Open</LinkBtn>}>
            {(money?.approvals || []).length ? <div className="fm-list">{money.approvals.map((a) => <Row key={a.label} tone="warn" title={`${a.n} ${a.label}`} sub={a.amount ? gbp(a.amount) : ""} onClick={a.go} />)}</div> : <Empty icon={CheckCircle2} title="Nothing to approve" />}
          </Card>
          <MoneyCard money={{ ...money, approvals: [] }} onOpen={() => onGo("money.budget")} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Timeline title="Invoices due for payment (14 days)" icon={PoundSterling} items={finance.invoicesDue || []} empty="No invoices due in the next 14 days." onMore={() => onGo("money.finance")} />
          <Card title="Spend by category" icon={PoundSterling}>
            {(finance.byCategory || []).map((c) => (
              <div key={c.cat} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><b>{c.label}</b><span className="fm-sub">{gbp(c.spent)} of {c.budget ? gbp(c.budget) : "—"} · forecast {gbp(c.forecast)}</span></div>
                <Meter pct={c.budget ? (c.spent / c.budget) * 100 : 0} tone={c.budget && c.forecast > c.budget * 1.02 ? "danger" : "info"} />
              </div>
            ))}
          </Card>
          {health && <Card title="Site health" icon={Gauge}><HealthTiles health={health} onOpen={onHealth} /></Card>}
        </div>
      </div>
    </div>
  );

  if (kind === "director") return (
    <div>
      {head}
      {portfolio.length > 0 && (
        <Card title="Portfolio health" icon={Building2} style={{ marginBottom: 12 }}>
          <div className="fm-scroll-x">
            <table className="fm-table">
              <thead><tr><th>Site</th><th>Health</th><th>Red items</th><th>Overdue PPM</th><th>Spent / budget</th></tr></thead>
              <tbody>
                {portfolio.map((p) => (
                  <tr key={p.siteId} className="fm-click" onClick={p.go} style={{ cursor: "pointer" }}>
                    <td><b>{p.name}</b>{p.current && <span className="fm-sub"> · this site</span>}</td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><ScoreRing score={p.score} size={34} stroke={4} /><Pill tone={healthBand(p.score).tone}>{healthBand(p.score).label}</Pill></span></td>
                    <td>{p.red ? <Pill tone="danger">{p.red}</Pill> : <Pill tone="ok">0</Pill>}</td>
                    <td>{p.overdue || "—"}</td>
                    <td>{gbp(p.spent)} / {p.budget ? gbp(p.budget) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="fm-grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {health && <Card title={`Site health · ${siteName}`} icon={Gauge}><HealthTiles health={health} onOpen={onHealth} /></Card>}
          <Attention items={attention.filter((a) => a.tone === "danger")} total={attentionTotal} onAll={onAllAlerts} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <MoneyCard money={money} onOpen={() => onGo("money.overview")} />
          <Timeline title="Coming up" icon={CalendarClock} items={week} empty="Nothing due in the next 7 days." />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {head}
      {quickBar}
      <div className="fm-grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <Attention items={attention} total={attentionTotal} onAll={onAllAlerts} />
          <Timeline title="Today" icon={Sun} items={today} empty="Nothing booked, due or expected today." onMore={() => onGo("ops.schedule")} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {health && <Card title="How the site is doing" icon={Gauge} right={<LinkBtn onClick={() => onHealth()}>How it's worked out</LinkBtn>}><HealthTiles health={health} onOpen={onHealth} /></Card>}
          <MoneyCard money={money} onOpen={() => onGo("money.overview")} />
          <Timeline title="Coming up this week" icon={CalendarClock} items={week} empty="Nothing due in the next 7 days." />
        </div>
      </div>
    </div>
  );
}

