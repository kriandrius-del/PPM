// Global search: one box for assets, places, work, maintenance, suppliers, people, compliance, documents,
// money and resources. When the best match is an asset, everything connected to it is shown underneath.
import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Building2, ClipboardList, FileText, Hammer, MapPin, Package, PoundSterling, Search, ShieldCheck, Truck, Users, Wrench, DoorOpen } from "lucide-react";
import { Modal } from "../../components/ui.jsx";
import { Pill, Row } from "../../components/ds.jsx";
import { INCIDENT_TYPES } from "../../lib/constants.js";
import { fmtDate, gbp } from "../../lib/utils.js";
import { placeOf, placeLabel } from "../assets/places.js";

const GROUPS = [
  ["assets", "Assets", Boxes], ["places", "Sites, buildings & rooms", Building2], ["work", "Jobs & projects", Hammer], ["maintenance", "Visits & certificates", Wrench],
  ["suppliers", "Suppliers & contacts", Truck], ["people", "People", Users], ["compliance", "Compliance & safety", ShieldCheck], ["documents", "Documents", FileText],
  ["money", "Purchase orders & invoices", PoundSterling], ["resources", "Spares, keys, key dates & vehicles", Package],
];

export function SearchModal({ d, onClose, onOpenAsset, onOpenVisit, onOpenWork, onOpenSupplier, onGo, onChooseSite }) {
  const [q, setQ] = useState("");
  const inp = useRef(null);
  useEffect(() => { inp.current?.focus(); }, []);
  const query = q.trim().toLowerCase();
  const hit = (...v) => v.filter(Boolean).some((x) => String(x).toLowerCase().includes(query));
  const devById = useMemo(() => Object.fromEntries((d.devices || []).map((x) => [x.id, x])), [d.devices]);
  const supById = useMemo(() => Object.fromEntries((d.suppliers || []).map((x) => [x.id, x])), [d.suppliers]);
  const res = useMemo(() => {
    if (query.length < 2) return null;
    const R = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
    const place = (dev) => placeLabel(placeOf(dev, d));
    (d.devices || []).forEach((x) => { if (hit(x.name, x.assetTag, x.subCategory, x.serialNumber, x.manufacturer, x.model, x.area, place(x))) R.assets.push({ k: `a-${x.id}`, title: x.name, sub: [x.assetTag, place(x) || x.area, supById[x.supplierId]?.name].filter(Boolean).join(" · "), go: () => onOpenAsset(x.id), dev: x }); });
    (d.locations || []).forEach((x) => { if (hit(x.name, x.address, x.portfolio)) R.places.push({ k: `s-${x.id}`, icon: MapPin, title: x.name, sub: `Site${x.address ? ` · ${x.address}` : ""}`, go: () => onChooseSite(x.id) }); });
    (d.buildings || []).forEach((x) => { if (hit(x.name, x.code)) R.places.push({ k: `b-${x.id}`, icon: Building2, title: x.name, sub: `Building · ${(x.floors || []).length} floors`, go: () => onGo("assets.locations") }); (x.floors || []).forEach((f) => { if (hit(`${x.name} ${f.name}`) && hit(f.name)) R.places.push({ k: `f-${f.id}`, icon: Building2, title: `${f.name}`, sub: `Floor · ${x.name}`, go: () => onGo("assets.locations") }); }); });
    (d.spaces || []).forEach((x) => { if (hit(x.name, x.floor, x.use)) R.places.push({ k: `r-${x.id}`, icon: DoorOpen, title: x.name, sub: ["Room", (d.buildings || []).find((b) => b.id === x.buildingId)?.name, x.floor, x.use].filter(Boolean).join(" · "), go: () => onGo("assets.locations") }); });
    (d.works || []).forEach((w) => { if (hit(w.description, w.poNumber, w.ref, devById[w.deviceId]?.name, w.requestedBy)) R.work.push({ k: `w-${w.id}`, title: w.description, sub: [devById[w.deviceId]?.name, w.status.replace("_", " "), w.quoteAmount ? gbp(w.quoteAmount) : ""].filter(Boolean).join(" · "), go: () => onOpenWork(w) }); });
    (d.projects || []).forEach((p) => { if (hit(p.name, p.notes)) R.work.push({ k: `p-${p.id}`, title: `Project: ${p.name}`, sub: p.status, go: () => onGo("ops.projects") }); });
    (d.services || []).forEach((v) => { if (hit(v.name, v.notes, v.technician, v.poNumber, devById[v.deviceId]?.name)) R.maintenance.push({ k: `v-${v.id}`, title: `${devById[v.deviceId]?.name || v.name} — ${fmtDate(v.date)}`, sub: [v.technician, v.certificatePhoto ? "certificate" : "", v.cost ? gbp(v.cost) : ""].filter(Boolean).join(" · "), go: () => onOpenVisit(v), date: v.date }); });
    R.maintenance.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    (d.suppliers || []).forEach((s) => { if (hit(s.name, s.contact, s.managerName, s.managerEmail, s.contractRef, s.subCategory, s.accreditation, ...(s.trades || []))) R.suppliers.push({ k: `su-${s.id}`, title: s.name, sub: [s.subCategory, s.managerName, s.managerPhone].filter(Boolean).join(" · "), go: () => onOpenSupplier(s) }); (s.contacts || []).forEach((c, i) => { if (hit(c.name, c.role, c.phone, c.email)) R.suppliers.push({ k: `sc-${s.id}-${i}`, title: c.name, sub: [s.name, c.role, c.phone].filter(Boolean).join(" · "), go: () => onOpenSupplier(s) }); }); });
    [...(d.users || []).map((u) => ({ ...u, kind: "Team" })), ...(d.staff || []).map((u) => ({ ...u, kind: "Site staff" }))].forEach((p, i) => { if (hit(p.name, p.role, p.jobTitle, p.company, p.skills, p.phone, p.email)) R.people.push({ k: `pe-${i}-${p.id}`, title: p.name, sub: [p.kind, p.jobTitle || p.role, p.company, p.phone].filter(Boolean).join(" · "), go: () => onGo("people.team") }); });
    (d.register || []).forEach((r) => { if (hit(r.requirement, r.area, r.responsible)) R.compliance.push({ k: `cr-${r.id}`, title: r.requirement, sub: `${r.area} · ${r.reasons[0] || ""}`, tone: r.status === "red" ? "danger" : r.status === "amber" ? "warn" : "ok", go: () => onGo("safety.register") }); });
    (d.incidents || []).forEach((i) => { if (hit(i.description, i.area, INCIDENT_TYPES[i.type])) R.compliance.push({ k: `i-${i.id}`, title: `Incident: ${i.description}`, sub: `${INCIDENT_TYPES[i.type] || ""} · ${fmtDate(i.date)} · ${i.status}`, go: () => onGo("safety.incidents") }); });
    (d.permits || []).forEach((p) => { if (hit(p.ref, p.type, p.contractor, p.description)) R.compliance.push({ k: `pt-${p.id}`, title: `Permit ${p.ref} — ${p.type}`, sub: `${p.contractor || ""} · ${p.status}`, go: () => onGo("safety.permits") }); });
    (d.actions || []).forEach((a) => { if (hit(a.action, a.finding, a.owner, a.source)) R.compliance.push({ k: `ac-${a.id}`, title: `Action: ${a.action || a.finding}`, sub: [a.source, a.owner, a.due && `due ${fmtDate(a.due)}`, a.status === "done" ? "done" : ""].filter(Boolean).join(" · "), go: () => onGo("safety.actions") }); });
    (d.docs || []).forEach((x) => { if (hit(x.title, x.type, x.heldBy)) R.documents.push({ k: `d-${x.id}`, title: x.title || x.type, sub: [x.type, x.reviewDate && `review ${fmtDate(x.reviewDate)}`].filter(Boolean).join(" · "), go: () => onGo("resources.docs") }); });
    (d.services || []).forEach((v) => { if (v.certificatePhoto && hit(devById[v.deviceId]?.name, "certificate")) R.documents.push({ k: `cert-${v.id}`, title: `Certificate — ${devById[v.deviceId]?.name || v.name}`, sub: fmtDate(v.date), go: () => onOpenVisit(v), date: v.date }); });
    (d.pos || []).forEach((p) => { if (hit(p.number, p.description, p.costCode, supById[p.supplierId]?.name)) R.money.push({ k: `po-${p.id}`, title: `PO ${p.number}`, sub: [p.description, gbp(p.value), p.status].filter(Boolean).join(" · "), go: () => onGo("money.finance") }); });
    (d.invoices || []).forEach((i) => { if (hit(i.number, i.notes, i.costCode, supById[i.supplierId]?.name)) R.money.push({ k: `in-${i.id}`, title: `Invoice ${i.number}`, sub: [supById[i.supplierId]?.name, gbp(i.amount), i.status].filter(Boolean).join(" · "), go: () => onGo("money.finance") }); });
    (d.spares || []).forEach((s) => { if (hit(s.name, s.partNo, s.store)) R.resources.push({ k: `sp-${s.id}`, title: `Spare: ${s.name}`, sub: `${s.qty} in stock${s.store ? ` · ${s.store}` : ""}`, go: () => onGo("resources.spares") }); });
    (d.keys || []).forEach((k) => { if (hit(k.label, k.number, k.opens, k.holder)) R.resources.push({ k: `k-${k.id}`, title: `Key: ${k.label}`, sub: k.holder ? `with ${k.holder}` : "in the key safe", go: () => onGo("resources.keys") }); });
    (d.cars || []).forEach((x) => { if (hit(String(x.reg || "").replace(/\s+/g, ""), x.reg, x.name, x.space)) R.resources.push({ k: `car-${x.id}`, title: `Vehicle ${String(x.reg || "").toUpperCase()}`, sub: [x.name, x.phone, x.space && `space ${x.space}`].filter(Boolean).join(" · "), go: () => onGo("people.carpark") }); });
    (d.keyDates || []).forEach((x) => { if (hit(x.title, x.type, x.notes)) R.resources.push({ k: `kd-${x.id}`, title: x.title, sub: `${x.type} · ${fmtDate(x.date)}`, go: () => onGo("resources.keydates") }); });
    Object.keys(R).forEach((k) => { R[k] = R[k].slice(0, 12); });
    return R;
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = res ? Object.values(res).reduce((t, l) => t + l.length, 0) : 0;
  // the asset everything else hangs off: exact name/tag match, or the only asset found
  const top = res && (res.assets.find((a) => String(a.dev.name).toLowerCase() === query || String(a.dev.assetTag || "").toLowerCase() === query) || (res.assets.length === 1 ? res.assets[0] : null));
  const connected = top && (() => {
    const id = top.dev.id; const sup = supById[top.dev.supplierId];
    const jobs = (d.works || []).filter((w) => w.deviceId === id && !["completed", "rejected"].includes(w.status));
    const visits = (d.services || []).filter((v) => v.deviceId === id && !v.skipped).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const yr = String(new Date().getFullYear());
    const cost = visits.filter((v) => String(v.date).startsWith(yr)).reduce((t, v) => t + (Number(v.cost) || 0), 0) + (d.works || []).filter((w) => w.deviceId === id && w.status === "completed" && String(w.completedAt || "").startsWith(yr)).reduce((t, w) => t + (Number(w.finalCost ?? w.quoteAmount) || 0), 0);
    return { sup, jobs, visits, certs: visits.filter((v) => v.certificatePhoto), cost };
  })();
  return (
    <Modal title="Search everything" onClose={onClose} width={640}>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: 13, color: "var(--faint)" }} />
        <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && res) { const first = GROUPS.map(([k]) => res[k][0]).find(Boolean); if (first) first.go(); } }}
          placeholder="Try “boiler”, an asset tag, a room, a supplier, a PO number…" aria-label="Search everything"
          style={{ width: "100%", boxSizing: "border-box", minHeight: 44, padding: "0 12px 0 34px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--input)", color: "var(--text)", font: "inherit", fontSize: 14.5 }} />
      </div>
      {!res && <div className="fm-sub">Type at least two letters. Searches assets, buildings and rooms, jobs, visits and certificates, suppliers and their contacts, people, the compliance register, incidents, permits, actions, documents, POs, invoices, spares, keys, key dates and vehicles at this site.</div>}
      {res && total === 0 && <div className="fm-sub" style={{ textAlign: "center", padding: 16 }}>Nothing found for “{q}”.</div>}
      {connected && (
        <div className="fm-card" style={{ boxShadow: "none", background: "var(--accent-soft)", borderColor: "transparent", marginBottom: 12 }}>
          <div className="fm-card-title"><Boxes size={14} /> {top.dev.name} — connected</div>
          <div className="fm-list">
            <Row icon={Boxes} title="Open asset record" sub={top.sub} onClick={top.go} />
            {connected.sup && <Row icon={Truck} title={connected.sup.name} sub="Supplier" onClick={() => onOpenSupplier(connected.sup)} />}
            {connected.jobs.map((w) => <Row key={w.id} icon={Hammer} tone={w.priority === "high" ? "danger" : "warn"} title={w.description} sub={`Open job · ${w.status.replace("_", " ")}`} onClick={() => onOpenWork(w)} />)}
            {connected.visits[0] && <Row icon={Wrench} title={`Last visit ${fmtDate(connected.visits[0].date)}`} sub={[connected.visits[0].technician, connected.visits[0].cost ? gbp(connected.visits[0].cost) : ""].filter(Boolean).join(" · ")} onClick={() => onOpenVisit(connected.visits[0])} />}
            <Row icon={FileText} title={`${connected.certs.length} certificate${connected.certs.length === 1 ? "" : "s"} · ${gbp(connected.cost)} spent this year`} sub={top.dev.nextServiceDate ? `Next maintenance ${fmtDate(top.dev.nextServiceDate)}` : ""} onClick={top.go} />
          </div>
        </div>
      )}
      {res && GROUPS.map(([k, label, I]) => res[k].length > 0 && (
        <div key={k} style={{ marginBottom: 12 }}>
          <div className="fm-card-title" style={{ marginBottom: 6 }}><I size={13} /> {label} <Pill tone="muted">{res[k].length}</Pill></div>
          <div className="fm-list">{res[k].map((r) => <Row key={r.k} icon={r.icon || I} tone={r.tone} title={r.title} sub={r.sub} onClick={r.go} />)}</div>
        </div>
      ))}
      {res && <div className="fm-sub" style={{ fontSize: 11 }}>Press Enter to open the first result. <ClipboardList size={11} style={{ verticalAlign: "-1px" }} /> Searches this site; switch site from the top bar to search another.</div>}
    </Modal>
  );
}
