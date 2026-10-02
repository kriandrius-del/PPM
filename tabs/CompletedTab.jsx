// Completed visits and certificates, compliance card.
import { useState, useMemo } from "react";
import { FileCheck, Search, ChevronRight, Gauge, ChevronDown } from "lucide-react";
import { EmptyState, ExportButton, TextInput, ToggleButton } from "../components/ui.jsx";
import { COMPLIANCE_GRACE_DAYS } from "../lib/constants.js";
import { computeCompliance, fmtDate, formatCustomValues, gbp } from "../lib/utils.js";

/* ---------------------------------------------------------
   Certificates Tab
--------------------------------------------------------- */
export function CertificatesTab({ services, deviceById, supplierById, onEdit, devices = [], visitBudgets = [] }) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  if (services.length === 0) return (
    <div>
      <ComplianceCard devices={devices} visitBudgets={visitBudgets} services={services} supplierById={supplierById} />
      <EmptyState icon={FileCheck} title="No completed visits yet" body="Log a completed visit to build your certificate archive." />
    </div>
  );

  const filtered = services.filter((s) => {
    if (dateFrom && (!s.date || s.date < dateFrom)) return false;
    if (dateTo && (!s.date || s.date > dateTo)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const dev = deviceById[s.deviceId];
      const hay = `${s.name || ""} ${dev?.name || ""} ${s.technician || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const csvRows = [
    ["Visit name", "Service", "Supplier", "Date", "Technician", "Cost", "Logged by", "Notes"],
    ...filtered.map((s) => [s.name || "", deviceById[s.deviceId]?.name || "", s.supplierId ? (supplierById[s.supplierId]?.name || "") : "", s.date || "", s.technician || "", s.cost || 0, s.updatedBy || s.loggedBy || "", s.notes || ""]),
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ComplianceCard devices={devices} visitBudgets={visitBudgets} services={services} supplierById={supplierById} />
      <div style={{ position: "relative" }}>
        <Search size={16} color="#8A94A0" style={{ position: "absolute", left: 11, top: 11 }} />
        <TextInput placeholder="Search visit name, service, technician…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", paddingLeft: 34 }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ flex: 1 }} aria-label="From date" />
        <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ flex: 1 }} aria-label="To date" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "9px 11px", fontSize: 12, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Clear</button>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600 }}>{filtered.length} of {services.length}</span>
        <ExportButton rows={csvRows} filename="certificates.csv" />
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, padding: "24px 0" }}>Nothing matches this search or date range.</div>
      ) : filtered.map((s) => {
        const dev = deviceById[s.deviceId];
        const supplier = s.supplierId ? supplierById[s.supplierId] : null;
        return (
          <button key={s.id} onClick={() => onEdit(s)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ width: 52, height: 52, borderRadius: 8, background: "var(--card-hi)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {s.certificatePhoto ? <img src={s.certificatePhoto} alt="certificate" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FileCheck size={20} color="#8A94A0" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650, fontSize: 14 }}>{s.name || (dev ? dev.name : "Service")}</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{dev ? dev.name : "Unknown service"}{supplier ? ` · ${supplier.name}` : ""}</div>
              <div style={{ fontSize: 12, color: "var(--faint)" }}>{fmtDate(s.date)} · {s.technician || "No technician noted"}{s.cost ? ` · ${gbp(s.cost)}` : ""}{s.poNumber ? ` · PO ${s.poNumber}` : ""}</div>
              {s.custom && Object.keys(s.custom).length > 0 && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{formatCustomValues("visit", s.custom)}</div>
              )}
              {(s.signatures?.technician || s.signatures?.site || s.gps) && (
                <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  {s.signatures?.technician && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ok)", background: "var(--ok-soft)", padding: "2px 7px", borderRadius: 20 }}>✍ Technician signed</span>}
                  {s.signatures?.site && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ok)", background: "var(--ok-soft)", padding: "2px 7px", borderRadius: 20 }}>✍ Site signed</span>}
                  {s.gps && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)", background: "var(--card-hi)", padding: "2px 7px", borderRadius: 20 }}>📍 Located</span>}
                </div>
              )}
              {s.checklistResults && s.checklistResults.length > 0 && (() => {
                const answered = s.checklistResults.filter((r) => r.result && r.result !== "na");
                const passed = answered.filter((r) => r.result === "pass").length;
                const failed = answered.filter((r) => r.result === "fail").length;
                return <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3, color: failed ? "var(--danger)" : "var(--ok)" }}>Checklist {passed}/{answered.length} passed{failed ? ` · ${failed} failed` : ""}</div>;
              })()}
            </div>
            <ChevronRight size={16} color="#C0C6CC" />
          </button>
        );
      })}
    </div>
  );
}

export function ComplianceCard({ devices, visitBudgets, services, supplierById }) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState("service"); // 'service' | 'supplier'
  const c = useMemo(() => computeCompliance(devices, visitBudgets, services), [devices, visitBudgets, services]);
  if (c.pct === null && c.checklistPct === null) return null;
  const tone = (p) => p === null ? "#8A94A0" : p >= 90 ? "#2F855A" : p >= 70 ? "#B7791F" : "#C53030";
  let rows = c.perDevice.map((r) => ({ key: r.device.id, label: r.device.name, ...r }));
  if (by === "supplier") {
    const g = {};
    c.perDevice.forEach((r) => {
      const name = r.device.supplierId ? (supplierById[r.device.supplierId]?.name || "Unknown supplier") : "No supplier set";
      g[name] = g[name] || { key: name, label: name, onTime: 0, late: 0, missed: 0, total: 0 };
      ["onTime", "late", "missed", "total"].forEach((k) => { g[name][k] += r[k]; });
    });
    rows = Object.values(g).map((r) => ({ ...r, pct: Math.round((r.onTime / r.total) * 100) })).sort((a, b) => a.pct - b.pct);
  }
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 4, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <Gauge size={18} color="#2B4562" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Compliance</div>
          <div style={{ fontSize: 11, color: "var(--faint)" }}>Planned visits done within ±{COMPLIANCE_GRACE_DAYS} days</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", color: tone(c.pct) }}>{c.pct === null ? "—" : `${c.pct}%`}</div>
          <div style={{ fontSize: 10, color: "var(--faint)" }}>on time</div>
        </div>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[["On time", c.totals.onTime, "#2F855A"], ["Late", c.totals.late, "#B7791F"], ["Missed", c.totals.missed, "#C53030"], ["Checks passed", c.checklistPct === null ? "—" : `${c.checklistPct}%`, tone(c.checklistPct)]].map(([label, val, color]) => (
              <div key={label} style={{ flex: 1, background: "var(--card-hi)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
                <div style={{ fontSize: 10, color: "var(--faint)", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <ToggleButton active={by === "service"} onClick={() => setBy("service")}>By service</ToggleButton>
                <ToggleButton active={by === "supplier"} onClick={() => setBy("supplier")}>By supplier</ToggleButton>
              </div>
              {rows.map((r) => (
                <div key={r.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ fontWeight: 650 }}>{r.label}</span>
                    <span style={{ color: tone(r.pct), fontWeight: 700 }}>{r.pct}% <span style={{ color: "var(--faint)", fontWeight: 500 }}>({r.onTime}/{r.total}{r.missed ? `, ${r.missed} missed` : ""}{r.late ? `, ${r.late} late` : ""})</span></span>
                  </div>
                  <div style={{ height: 6, background: "var(--card-hi)", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ width: `${r.pct}%`, height: "100%", background: tone(r.pct) }} />
                  </div>
                </div>
              ))}
            </>
          )}
          <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Based on each service's planned visit dates (its visit budgets) that are now in the past. Services without planned dates aren't scored.</div>
        </div>
      )}
    </div>
  );
}
