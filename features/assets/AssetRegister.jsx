// Assets → Asset register: every asset with where it is, its status (and why), condition and next maintenance.
import { useMemo, useState } from "react";
import { Boxes, Search } from "lucide-react";
import { ExportButton, TextInput, Select } from "../../components/ui.jsx";
import { Empty, Pill, Row, Segmented, useWide } from "../../components/ds.jsx";
import { ASSET_STATUSES, assetStatus, placeOf, placeLabel } from "./places.js";
import { CONDITION_GRADES, CRITICALITY } from "../../lib/constants.js";
import { fmtDate, daysUntil } from "../../lib/utils.js";

export function AssetRegister({ devices = [], archived = [], works = [], services = [], locations = [], buildings = [], spaces = [], suppliers = [], onOpen, onAdd }) {
  const wide = useWide();
  const [q, setQ] = useState(""); const [st, setSt] = useState("all"); const [bld, setBld] = useState(""); const [crit, setCrit] = useState("");
  const rows = useMemo(() => [...devices, ...archived].map((d) => ({ d, status: assetStatus(d, { works, services }), place: placeOf(d, { locations, buildings, spaces }) })), [devices, archived, works, services, locations, buildings, spaces]);
  const counts = Object.fromEntries(Object.keys(ASSET_STATUSES).map((k) => [k, rows.filter((r) => r.status.key === k).length]));
  const supName = (id) => suppliers.find((s) => s.id === id)?.name || "";
  const query = q.trim().toLowerCase();
  const list = rows.filter((r) => (st === "all" ? r.status.key !== "decommissioned" : r.status.key === st)
    && (!bld || r.place.building?.id === bld) && (!crit || (r.d.criticality || "normal") === crit)
    && (!query || [r.d.name, r.d.assetTag, r.d.manufacturer, r.d.model, r.d.serialNumber, r.d.area, placeLabel(r.place), supName(r.d.supplierId)].filter(Boolean).some((x) => String(x).toLowerCase().includes(query))))
    .sort((a, b) => ASSET_ORDER[a.status.key] - ASSET_ORDER[b.status.key] || String(a.d.name).localeCompare(String(b.d.name)));
  const myBuildings = [...new Set(rows.map((r) => r.place.building).filter(Boolean))];
  const filters = [["all", `All (${rows.length - counts.decommissioned})`], ...Object.entries(ASSET_STATUSES).filter(([k]) => counts[k]).map(([k, v]) => [k, `${v.label} (${counts[k]})`])];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}><Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--faint)" }} /><TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, tag, make, serial, room…" style={{ paddingLeft: 30 }} aria-label="Search assets" /></div>
        {myBuildings.length > 0 && <Select value={bld} onChange={(e) => setBld(e.target.value)} style={{ width: "auto" }} aria-label="Building"><option value="">All buildings</option>{myBuildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>}
        <Select value={crit} onChange={(e) => setCrit(e.target.value)} style={{ width: "auto" }} aria-label="Criticality"><option value="">Any criticality</option>{Object.entries(CRITICALITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        <ExportButton label="CSV" filename="asset-register.csv" rows={[["Asset", "Tag", "Status", "Why", "Site", "Building", "Floor", "Room", "Make", "Model", "Serial", "Installed", "Warranty to", "Condition", "Criticality", "Supplier", "Next maintenance"], ...list.map((r) => [r.d.name, r.d.assetTag || "", r.status.label, r.status.reasons.join("; "), r.place.site?.name || "", r.place.building?.name || "", r.place.floor?.name || r.place.floorText || "", r.place.room?.name || r.d.area || "", r.d.manufacturer || "", r.d.model || "", r.d.serialNumber || "", r.d.installDate || "", r.d.warrantyEnd || "", CONDITION_GRADES[r.d.condition]?.label || "", CRITICALITY[r.d.criticality || "normal"]?.label || "", supName(r.d.supplierId), r.d.nextServiceDate || ""])]} />
      </div>
      <div style={{ overflowX: "auto", marginBottom: 10 }}><Segmented options={filters} value={st} onChange={setSt} /></div>
      {!list.length ? <Empty icon={Boxes} title={rows.length ? "No assets match" : "No assets yet"} body={rows.length ? "Try a different search or filter." : "Add your plant and equipment under Operations → Planned maintenance, or import a spreadsheet."} />
        : wide ? (
          <div className="fm-card" style={{ padding: 0 }}><div className="fm-scroll-x">
            <table className="fm-table">
              <thead><tr><th>Asset</th><th>Where</th><th>Status</th><th>Condition</th><th>Criticality</th><th>Next maintenance</th><th>Supplier</th></tr></thead>
              <tbody>{list.map((r) => { const n = daysUntil(r.d.nextServiceDate); return (
                <tr key={r.d.id} className="fm-click" style={{ cursor: "pointer" }} onClick={() => onOpen(r.d.id)}>
                  <td><b>{r.d.name}</b>{r.d.assetTag && <div className="fm-sub">{r.d.assetTag}{r.d.manufacturer ? ` · ${r.d.manufacturer} ${r.d.model || ""}` : ""}</div>}</td>
                  <td>{placeLabel(r.place) || <span className="fm-sub">{r.d.area || "—"}</span>}</td>
                  <td><Pill tone={r.status.tone} title={r.status.reasons.join("\n")}>{r.status.label}</Pill>{r.status.reasons[0] && <div className="fm-sub" style={{ marginTop: 3 }}>{r.status.reasons[0]}</div>}</td>
                  <td>{r.d.condition ? <span style={{ color: CONDITION_GRADES[r.d.condition].color, fontWeight: 700 }}>{r.d.condition}</span> : <span className="fm-sub">—</span>}</td>
                  <td>{CRITICALITY[r.d.criticality || "normal"]?.label}</td>
                  <td style={{ color: n !== null && n < 0 ? "var(--danger)" : undefined, whiteSpace: "nowrap" }}>{r.d.nextServiceDate ? fmtDate(r.d.nextServiceDate) : "—"}</td>
                  <td>{supName(r.d.supplierId) || "—"}</td>
                </tr>
              ); })}</tbody>
            </table>
          </div></div>
        ) : <div className="fm-list">{list.map((r) => <Row key={r.d.id} tone={r.status.tone} title={r.d.name} sub={[placeLabel(r.place) || r.d.area, r.status.reasons[0] || r.status.label].filter(Boolean).join(" · ")} right={<Pill tone={r.status.tone}>{r.status.label}</Pill>} onClick={() => onOpen(r.d.id)} />)}</div>}
    </div>
  );
}
const ASSET_ORDER = { failed: 0, offline: 1, attention: 2, maintenance: 3, operational: 4, decommissioned: 5 };
