// Compliance & Safety → Compliance register: every requirement on one red/amber/green list, with the reason.
import { useState } from "react";
import { Printer, ShieldCheck } from "lucide-react";
import { ExportButton } from "../../components/ui.jsx";
import { Btn, Card, Empty, Kpi, Pill, Row, Segmented, useWide } from "../../components/ds.jsx";
import { COMPLIANCE_AREAS, RAG } from "./register.js";
import { openPrintReport } from "../../lib/reports.js";
import { escapeHtml, fmtDate } from "../../lib/utils.js";

export function ComplianceView({ register, siteName, onOpen, onAddStatutory, onNotApplicable, canEdit }) {
  const wide = useWide();
  const [st, setSt] = useState("open"); const [area, setArea] = useState("");
  const { rows, counts, total } = register;
  const areas = COMPLIANCE_AREAS.filter((a) => rows.some((r) => r.area === a));
  const list = rows.filter((r) => (st === "all" || (st === "open" ? r.status !== "green" : r.status === st)) && (!area || r.area === area));
  const byArea = areas.map((a) => { const rs = rows.filter((r) => r.area === a); return { a, red: rs.filter((r) => r.status === "red").length, amber: rs.filter((r) => r.status === "amber").length, n: rs.length }; });
  function print() {
    const e = escapeHtml;
    openPrintReport("Compliance register", siteName, `<div class="kpis"><div class="kpi">Red<b class="bad">${counts.red}</b></div><div class="kpi">Amber<b class="warn">${counts.amber}</b></div><div class="kpi">Green<b class="ok">${counts.green}</b></div></div>
      <table><thead><tr><th>Area</th><th>Requirement</th><th>Responsible</th><th>Frequency</th><th>Last done</th><th>Next due</th><th>Evidence</th><th>Status</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${e(r.area)}</td><td><b>${e(r.requirement)}</b><div class="muted">${e(r.reasons.join("; "))}</div></td><td>${e(r.responsible || "")}</td><td>${e(r.frequency || "")}</td><td>${r.last ? fmtDate(r.last) : "—"}</td><td>${r.next ? fmtDate(r.next) : "—"}</td><td>${e(r.evidence || "")}</td><td class="${r.status === "red" ? "bad" : r.status === "amber" ? "warn" : "ok"}">${RAG[r.status].label}</td></tr>`).join("")}</tbody></table>
      <div class="muted">Built from the services, checks, inspections, registers, training, documents and supplier records in the app.</div>`);
  }
  if (!total) return <Empty icon={ShieldCheck} title="Nothing to track yet" body="Statutory services, check logs, inspections, training and documents you add will appear here with a red, amber or green status." />;
  return (
    <div>
      <div className="fm-kpis" style={{ marginBottom: 12 }}>
        <Kpi label="Red — act now" value={counts.red} tone={counts.red ? "danger" : undefined} onClick={() => setSt("red")} />
        <Kpi label="Amber — due soon" value={counts.amber} tone={counts.amber ? "warn" : undefined} onClick={() => setSt("amber")} />
        <Kpi label="Green — in date" value={counts.green} tone="ok" onClick={() => setSt("green")} />
        <Kpi label="Compliant" value={`${Math.round((100 * counts.green) / total)}%`} sub={`${total} requirements`} />
      </div>
      <Card title="By area" icon={ShieldCheck} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className={`fm-subnav-item${!area ? " on" : ""}`} onClick={() => setArea("")}>All areas</button>
          {byArea.map((x) => <button key={x.a} className={`fm-subnav-item${area === x.a ? " on" : ""}`} onClick={() => setArea(area === x.a ? "" : x.a)}>{x.a}{x.red ? <span className="fm-count">{x.red}</span> : x.amber ? <span className="fm-count warn">{x.amber}</span> : null}</button>)}
        </div>
      </Card>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <Segmented options={[["open", `Needs action (${counts.red + counts.amber})`], ["red", "Red"], ["amber", "Amber"], ["green", "Green"], ["all", "All"]]} value={st} onChange={setSt} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Btn size="sm" icon={Printer} onClick={print}>Print</Btn>
          <ExportButton label="CSV" filename="compliance-register.csv" rows={[["Area", "Requirement", "Responsible", "Frequency", "Last done", "Next due", "Evidence", "Status", "Why", "Risk"], ...rows.map((r) => [r.area, r.requirement, r.responsible || "", r.frequency || "", r.last || "", r.next || "", r.evidence || "", RAG[r.status].label, r.reasons.join("; "), r.risk || ""])]} />
        </div>
      </div>
      {!list.length ? <Empty icon={ShieldCheck} title="Nothing here" body={st === "open" ? "Everything is green." : "No requirements match."} /> : wide ? (
        <div className="fm-card" style={{ padding: 0 }}><div className="fm-scroll-x">
          <table className="fm-table">
            <thead><tr><th>Status</th><th>Requirement</th><th>Area</th><th>Responsible</th><th>Frequency</th><th>Last done</th><th>Next due</th><th>Evidence</th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.id} className="fm-click" style={{ cursor: "pointer" }} onClick={() => onOpen(r)}>
                <td><Pill tone={RAG[r.status].tone} dot>{RAG[r.status].label}</Pill></td>
                <td><b>{r.requirement}</b><div className="fm-sub">{r.reasons.join(" · ")}</div>
                  {r.missing && canEdit && <div style={{ display: "flex", gap: 6, marginTop: 6 }} onClick={(e) => e.stopPropagation()}><Btn size="sm" onClick={() => onAddStatutory(r)}>Set up a service</Btn>{onNotApplicable && <Btn size="sm" variant="ghost" onClick={() => onNotApplicable(r)}>Not applicable</Btn>}</div>}</td>
                <td>{r.area}</td><td>{r.responsible || "—"}</td><td>{r.frequency || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{r.last ? fmtDate(r.last) : "—"}</td><td style={{ whiteSpace: "nowrap" }}>{r.next ? fmtDate(r.next) : "—"}</td><td>{r.evidence || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div></div>
      ) : (
        <div className="fm-list">{list.map((r) => (
          <div key={r.id}>
            <Row tone={RAG[r.status].tone} title={r.requirement} sub={`${r.area} · ${r.reasons[0] || ""}`} right={<Pill tone={RAG[r.status].tone}>{RAG[r.status].label}</Pill>} onClick={() => onOpen(r)} />
            {r.missing && canEdit && <div style={{ display: "flex", gap: 6, margin: "4px 0 4px 18px" }}><Btn size="sm" onClick={() => onAddStatutory(r)}>Set up a service</Btn>{onNotApplicable && <Btn size="sm" variant="ghost" onClick={() => onNotApplicable(r)}>Not applicable</Btn>}</div>}
          </div>
        ))}</div>
      )}
    </div>
  );
}
