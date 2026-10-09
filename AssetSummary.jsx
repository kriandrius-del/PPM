// The top of an asset's record: where it is, its status and why, and everything connected to it —
// maintenance, jobs, supplier and contract, costs, certificates, documents, meters and QR code.
import { useState } from "react";
import { FileCheck, Gauge, Hammer, QrCode, ShieldCheck, Truck, Wrench, Flag } from "lucide-react";
import { Breadcrumb, Btn, Kpi, Pill } from "../../components/ds.jsx";
import { ASSET_STATUSES } from "./places.js";
import { CRITICALITY, CONDITION_GRADES } from "../../lib/constants.js";
import { daysUntil, fmtDate, gbp } from "../../lib/utils.js";

export function AssetSummary({ device, status, crumbs = [], supplier, stats = {}, compliance = [], meters = [], docs = [], canEdit, onLog, onJob, onQr, onSetStatus, onGoSupplier, onGoMeters }) {
  const [marking, setMarking] = useState(false);
  if (!device) return null;
  const ins = supplier?.insuranceExpiry ? daysUntil(supplier.insuranceExpiry) : null;
  const con = supplier?.contractEnd ? daysUntil(supplier.contractEnd) : null;
  const n = daysUntil(device.nextServiceDate);
  return (
    <div className="fm-card" style={{ boxShadow: "none", marginBottom: 14, background: "var(--card-hi)" }} data-testid="asset-summary">
      {crumbs.length > 0 && <Breadcrumb items={crumbs} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Pill tone={status.tone} dot>{status.label}</Pill>
        {device.assetTag && <Pill tone="muted">{device.assetTag}</Pill>}
        {device.criticality && device.criticality !== "normal" && <Pill tone={device.criticality === "critical" ? "danger" : "warn"}>{CRITICALITY[device.criticality]?.label}</Pill>}
        {device.condition && <Pill tone={device.condition === "D" ? "danger" : device.condition === "C" ? "warn" : "ok"}>{CONDITION_GRADES[device.condition]?.label}</Pill>}
        {canEdit && onSetStatus && <Btn size="sm" variant="ghost" icon={Flag} onClick={() => setMarking((v) => !v)}>Set status</Btn>}
      </div>
      {status.reasons.length > 0 && <div className="fm-sub">{status.reasons.join(" · ")}</div>}
      {marking && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["operational", "attention", "failed", "maintenance"].map((k) => <Btn key={k} size="sm" variant={device.statusOverride?.status === k ? "primary" : "secondary"} onClick={() => { const note = k === "operational" ? "" : window.prompt(`Why is it ${ASSET_STATUSES[k].label.toLowerCase()}? (optional)`) || ""; onSetStatus(k === "operational" ? null : { status: k, note }); setMarking(false); }}>{ASSET_STATUSES[k].label}</Btn>)}
          <div className="fm-sub" style={{ width: "100%" }}>Offline is set with “Out of service” below; decommissioned by archiving.</div>
        </div>
      )}
      <div className="fm-kpis">
        <Kpi label="Next maintenance" value={device.nextServiceDate ? new Date(device.nextServiceDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"} tone={n !== null && n < 0 ? "danger" : undefined} sub={n === null ? "" : `${device.nextServiceDate.slice(0, 4)} · ${n < 0 ? `${-n} days overdue` : `in ${n} days`}`} />
        <Kpi label="Open jobs" value={stats.openJobs ?? 0} tone={stats.openJobs ? "warn" : undefined} />
        <Kpi label={`Spend ${new Date().getFullYear()}`} value={gbp(stats.spentYear || 0)} sub={`${gbp(stats.spentLife || 0)} all time`} />
        <Kpi label="Certificates" value={stats.certs ?? 0} sub={stats.lastCert ? `latest ${fmtDate(stats.lastCert)}` : "none on file"} />
      </div>
      <div className="fm-list">
        {supplier && (
          <button className="fm-row fm-click" onClick={onGoSupplier} style={{ background: "var(--card)" }}>
            <span className="fm-row-icon"><Truck size={15} /></span>
            <span className="fm-row-main"><span className="fm-row-title">{supplier.name}</span>
              <span className="fm-row-sub">{[supplier.managerName, supplier.managerPhone, supplier.contractEnd && `contract to ${fmtDate(supplier.contractEnd)}`].filter(Boolean).join(" · ")}</span></span>
            {ins !== null && <Pill tone={ins < 0 ? "danger" : ins <= 30 ? "warn" : "ok"}>{ins < 0 ? "Insurance expired" : ins <= 30 ? `Insurance ${ins}d` : "Insured"}</Pill>}
            {con !== null && con < 0 && <Pill tone="danger">Contract ended</Pill>}
          </button>
        )}
        {compliance.length > 0 && compliance.map((c) => <div key={c.id} className="fm-row" style={{ background: "var(--card)" }}><span className="fm-row-icon"><ShieldCheck size={15} /></span><span className="fm-row-main"><span className="fm-row-title">Compliance: {c.frequency}</span><span className="fm-row-sub">{c.reasons.join(" · ")}</span></span><Pill tone={c.status === "red" ? "danger" : c.status === "amber" ? "warn" : "ok"}>{c.status === "red" ? "Red" : c.status === "amber" ? "Amber" : "Green"}</Pill></div>)}
        {meters.length > 0 && <button className="fm-row fm-click" onClick={onGoMeters} style={{ background: "var(--card)" }}><span className="fm-row-icon"><Gauge size={15} /></span><span className="fm-row-main"><span className="fm-row-title">{meters.length} meter{meters.length === 1 ? "" : "s"}</span><span className="fm-row-sub">{meters.map((m) => m.name).join(", ")}</span></span></button>}
        {docs.length > 0 && <div className="fm-row" style={{ background: "var(--card)" }}><span className="fm-row-icon"><FileCheck size={15} /></span><span className="fm-row-main"><span className="fm-row-title">{docs.length} document{docs.length === 1 ? "" : "s"}</span><span className="fm-row-sub">{docs.map((d) => d.label || d.title).join(", ")}</span></span></div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {canEdit && onLog && <Btn size="sm" variant="primary" icon={Wrench} onClick={onLog}>Log a visit</Btn>}
        {canEdit && onJob && <Btn size="sm" icon={Hammer} onClick={onJob}>Raise a job</Btn>}
        {onQr && <Btn size="sm" icon={QrCode} onClick={onQr}>QR sticker</Btn>}
      </div>
    </div>
  );
}

