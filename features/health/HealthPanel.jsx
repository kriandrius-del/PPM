// Site health on screen: the six scores as tiles, and the full "how was this worked out" explanation.
import { Printer } from "lucide-react";
import { Modal } from "../../components/ui.jsx";
import { Btn, Pill, ScoreRing } from "../../components/ds.jsx";
import { HEALTH_PARTS, healthBand } from "./siteHealth.js";
import { openPrintReport } from "../../lib/reports.js";
import { escapeHtml } from "../../lib/utils.js";

export function HealthTiles({ health, onOpen }) {
  return (
    <div className="fm-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))" }}>
      {HEALTH_PARTS.map((p) => { const s = health.parts[p.key].score; const b = healthBand(s); return (
        <button key={p.key} className="fm-kpi fm-click" onClick={() => onOpen(p.key)} title={`How the ${p.label.toLowerCase()} score is worked out`} data-health={p.key}>
          <div className="fm-kpi-label">{p.label}</div>
          <div className="fm-kpi-value" style={{ color: b.tone === "muted" ? "var(--faint)" : `var(--${b.tone === "ok" ? "ok" : b.tone === "warn" ? "warn" : "danger"})` }}>{s == null ? "—" : s}</div>
          <div className="fm-kpi-sub">{b.label}</div>
        </button>
      ); })}
    </div>
  );
}

export function HealthBreakdown({ health, focus, onGo }) {
  const order = focus ? [HEALTH_PARTS.find((p) => p.key === focus), ...HEALTH_PARTS.filter((p) => p.key !== focus)] : HEALTH_PARTS;
  const wsum = HEALTH_PARTS.filter((p) => health.parts[p.key].score != null).reduce((t, p) => t + p.weight, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ScoreRing score={health.overall} size={72} />
        <div className="fm-sub" style={{ flex: 1 }}>
          The overall score is the weighted average of the scores below that have data: maintenance and compliance count 25% each, safety 20%, assets, suppliers and finance 10% each{wsum && wsum < 100 ? ` (scores with no data are left out, so the rest are scaled up to 100%)` : ""}.
        </div>
      </div>
      {order.map((p) => { const part = health.parts[p.key]; const b = healthBand(part.score); return (
        <div key={p.key} className="fm-card" style={{ boxShadow: "none", borderColor: focus === p.key ? "var(--accent)" : undefined }} data-health-detail={p.key}>
          <div className="fm-card-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ScoreRing score={part.score} size={42} stroke={5} />
              <div><div className="fm-h2">{p.label}</div><div className="fm-sub">{part.score == null ? "Not counted — no data yet" : `Counts ${p.weight}% · ${b.label}`}</div></div>
            </div>
            {onGo && <Btn size="sm" onClick={() => onGo(p.go)}>Open</Btn>}
          </div>
          <div className="fm-list">
            {part.factors.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
                <span style={{ flex: 1, color: f.base ? "var(--text)" : "var(--text-2)" }}>{f.text}</span>
                {!f.base && f.effect !== 0 && <Pill tone={f.effect < 0 ? "danger" : "ok"}>{f.effect > 0 ? "+" : ""}{f.effect}</Pill>}
              </div>
            ))}
          </div>
        </div>
      ); })}
    </div>
  );
}

export function HealthModal({ health, focus, siteName, onGo, onClose }) {
  return (
    <Modal title={`Site health — ${siteName}`} onClose={onClose} width={620}>
      <HealthBreakdown health={health} focus={focus} onGo={(t) => { onClose(); onGo(t); }} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><Btn icon={Printer} onClick={() => printHealth(health, siteName)}>Print</Btn></div>
    </Modal>
  );
}

export function printHealth(health, siteName) {
  const e = escapeHtml;
  const rows = HEALTH_PARTS.map((p) => { const part = health.parts[p.key]; return `<h2>${e(p.label)} — ${part.score == null ? "no data" : `${part.score}/100`} <span class="muted">(weight ${p.weight}%)</span></h2><ul>${part.factors.map((f) => `<li>${e(f.text)}${!f.base && f.effect ? ` <b class="${f.effect < 0 ? "bad" : "ok"}">${f.effect > 0 ? "+" : ""}${f.effect}</b>` : ""}</li>`).join("")}</ul>`; }).join("");
  openPrintReport("Site health", siteName, `<div class="kpis"><div class="kpi">Overall<b>${health.overall ?? "—"}</b></div>${HEALTH_PARTS.map((p) => `<div class="kpi">${e(p.label)}<b>${health.parts[p.key].score ?? "—"}</b></div>`).join("")}</div>${rows}<div class="muted">Overall = weighted average of the scores with data. Every point added or taken away is listed above.</div>`);
}
