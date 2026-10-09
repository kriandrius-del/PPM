// Assets → Locations: Portfolio → Site → Building → Floor → Room → Asset, with what matters at each level.
import { useMemo, useState } from "react";
import { Building2, DoorOpen, Layers, MapPin, Plus, Pencil, Boxes, Wand2, Trash2 } from "lucide-react";
import { Modal, Field, TextInput, TextArea, PrimaryButton } from "../../components/ui.jsx";
import { Breadcrumb, Btn, Card, Empty, Kpi, Pill, Row } from "../../components/ds.jsx";
import { SpaceModal } from "../../tabs/MoreViews.jsx";
import { assetStatus, assetsUnder, portfolioOf, siteTree } from "./places.js";
import { daysUntil, gbp, uid } from "../../lib/utils.js";

function BuildingModal({ existing, onClose, onSave, onDelete, canDelete }) {
  const [name, setName] = useState(existing?.name || "");
  const [code, setCode] = useState(existing?.code || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [floors, setFloors] = useState(() => (existing?.floors?.length ? existing.floors : [{ id: uid(), name: "Ground floor", level: 0 }]).map((f) => ({ ...f })));
  const setF = (i, patch) => setFloors((l) => l.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <Modal title={existing ? `Building — ${existing.name}` : "Add a building"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Building name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Building A" /></Field>
          <Field label="Code (optional)"><TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BLA" style={{ maxWidth: 110 }} /></Field>
        </div>
        <Field label="Floors (lowest first)">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {floors.map((f, i) => (
              <div key={f.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <TextInput value={f.name} onChange={(e) => setF(i, { name: e.target.value })} placeholder="Floor name" aria-label={`Floor ${i + 1} name`} style={{ flex: 1 }} />
                <TextInput type="number" value={f.level} onChange={(e) => setF(i, { level: e.target.value === "" ? "" : Number(e.target.value) })} aria-label={`Floor ${i + 1} level`} title="Level (−1 basement, 0 ground, 1 first…)" style={{ width: 70 }} />
                <button className="fm-icon-btn" onClick={() => setFloors((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${f.name || "floor"}`} title="Remove floor"><Trash2 size={14} /></button>
              </div>
            ))}
            <Btn size="sm" icon={Plus} onClick={() => setFloors((l) => [...l, { id: uid(), name: l.length ? `Floor ${l.length}` : "Ground floor", level: l.length }])}>Add floor</Btn>
          </div>
        </Field>
        <Field label="Notes (optional)"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Address, access, landlord…" style={{ minHeight: 50 }} /></Field>
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), code: code.trim(), notes: notes.trim(), floors: floors.filter((f) => String(f.name).trim()).map((f) => ({ id: f.id, name: String(f.name).trim(), level: f.level === "" ? 0 : Number(f.level) || 0 })) })}>Save building</PrimaryButton>
        {existing && onDelete && (canDelete ? <Btn variant="danger" icon={Trash2} onClick={() => onDelete(existing.id)}>Delete building</Btn> : <div className="fm-sub">Move or delete its rooms before deleting the building.</div>)}
      </div>
    </Modal>
  );
}

// One-off helper: turn the Area text already typed on assets into rooms inside a building.
function OrganiseModal({ siteName, areas, onClose, onRun }) {
  const [bname, setBname] = useState(siteName ? `${siteName} — main building` : "Main building");
  return (
    <Modal title="Organise assets into rooms" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
        <div>Your assets already say where they are ({areas.length} different area{areas.length === 1 ? "" : "s"}). This creates one room for each, inside a building, and links the assets to them. Nothing else changes, and you can rename, move or delete the rooms afterwards.</div>
        <div className="fm-sub" style={{ maxHeight: 120, overflowY: "auto" }}>{areas.join(" · ")}</div>
        <Field label="Building to put the rooms in"><TextInput value={bname} onChange={(e) => setBname(e.target.value)} /></Field>
        <PrimaryButton onClick={() => bname.trim() && onRun(bname.trim())}><Wand2 size={15} /> Create {areas.length} room{areas.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

export function LocationsView({ org, countries = [], sites = [], siteId, buildings = [], spaces = [], devices = [], works = [], services = [], spendByDevice = {}, canEdit, onChooseSite, onOpenAsset, onSaveBuilding, onDeleteBuilding, onSaveSpace, onDeleteSpace, onOrganise }) {
  const [path, setPath] = useState({ level: "site" });   // level: portfolio | site | building | floor | room | loose | unplaced
  const [editB, setEditB] = useState(null); const [editR, setEditR] = useState(null); const [organise, setOrganise] = useState(false);
  const site = sites.find((s) => s.id === siteId);
  const tree = useMemo(() => siteTree({ siteId, buildings, spaces, devices: devices.filter((d) => !d.archived) }), [siteId, buildings, spaces, devices]);
  const bNode = tree.buildings.find((b) => b.id === path.buildingId);
  const fNode = bNode?.floors.find((f) => f.id === path.floorId);
  const rNode = (fNode?.rooms || tree.looseRooms).find((r) => r.id === path.roomId) || (path.level === "room" ? [...tree.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms)), ...tree.looseRooms].find((r) => r.id === path.roomId) : null);
  const node = path.level === "building" ? bNode : path.level === "floor" ? fNode : path.level === "room" ? rNode : null;
  const assets = path.level === "site" ? tree.assets : path.level === "unplaced" ? tree.unplaced : path.level === "loose" ? tree.looseRooms.flatMap((r) => r.assets) : assetsUnder(node);
  const ids = new Set(assets.map((a) => a.id));
  const openWorks = works.filter((w) => ids.has(w.deviceId) && !["completed", "rejected"].includes(w.status));
  const overdue = assets.filter((a) => a.nextServiceDate && daysUntil(a.nextServiceDate) < 0);
  const status = (a) => assetStatus(a, { works, services });
  const attention = assets.filter((a) => ["attention", "failed", "offline"].includes(status(a).key));
  const spend = assets.reduce((t, a) => t + (spendByDevice[a.id] || 0), 0);
  const areasToOrganise = [...new Set(tree.unplaced.map((d) => String(d.area || "").trim()).filter(Boolean))];
  const portfolio = portfolioOf(site, countries);
  const crumbs = [
    { label: org || "Organisation", onClick: () => setPath({ level: "portfolio" }) },
    { label: portfolio, onClick: () => setPath({ level: "portfolio" }) },
    { label: site?.name || "Site", onClick: path.level !== "site" ? () => setPath({ level: "site" }) : undefined },
    ...(bNode ? [{ label: bNode.name, onClick: path.level !== "building" ? () => setPath({ level: "building", buildingId: bNode.id }) : undefined }] : []),
    ...(fNode ? [{ label: fNode.name, onClick: path.level !== "floor" ? () => setPath({ level: "floor", buildingId: bNode.id, floorId: fNode.id }) : undefined }] : []),
    ...(path.level === "room" && rNode ? [{ label: rNode.name }] : []),
    ...(path.level === "loose" ? [{ label: "Rooms not in a building" }] : []), ...(path.level === "unplaced" ? [{ label: "Assets not in a room" }] : []),
  ];
  const summary = (
    <div className="fm-kpis" style={{ marginBottom: 12 }}>
      <Kpi label="Assets" value={assets.length} />
      <Kpi label="Need attention" value={attention.length} tone={attention.length ? "warn" : undefined} />
      <Kpi label="Maintenance overdue" value={overdue.length} tone={overdue.length ? "danger" : undefined} />
      <Kpi label="Open jobs" value={openWorks.length} />
      <Kpi label={`Spend ${new Date().getFullYear()}`} value={gbp(spend)} />
    </div>
  );
  const assetRows = (list) => list.length ? (
    <div className="fm-list">{list.slice(0, 200).map((a) => { const st = status(a); return <Row key={a.id} tone={st.tone} title={a.name} sub={[a.assetTag, st.label, st.reasons[0]].filter(Boolean).join(" · ")} right={<Pill tone={st.tone}>{st.label}</Pill>} onClick={() => onOpenAsset(a.id)} />; })}</div>
  ) : <div className="fm-sub">No assets here yet.</div>;
  const roomRows = (rooms) => <div className="fm-list">{rooms.map((r) => <Row key={r.id} icon={DoorOpen} title={r.name} sub={[r.room.use, r.room.areaM2 && `${r.room.areaM2} m²`, `${r.assets.length} asset${r.assets.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")} onClick={() => setPath({ level: "room", buildingId: path.buildingId || r.room.buildingId, floorId: path.floorId || r.room.floorId, roomId: r.id })} />)}</div>;

  let body;
  if (path.level === "portfolio") {
    const groups = {}; sites.forEach((s) => { (groups[portfolioOf(s, countries)] = groups[portfolioOf(s, countries)] || []).push(s); });
    body = Object.entries(groups).map(([p, list]) => (
      <Card key={p} title={p} icon={MapPin} style={{ marginBottom: 12 }}>
        <div className="fm-list">{list.map((s) => { const n = devices.filter((d) => d.locationId === s.id && !d.archived).length; const nb = buildings.filter((b) => b.locationId === s.id).length; return (
          <Row key={s.id} icon={MapPin} title={s.name} sub={`${nb} building${nb === 1 ? "" : "s"} · ${n} asset${n === 1 ? "" : "s"}${s.id === siteId ? " · open now" : ""}`} onClick={() => { if (s.id !== siteId) onChooseSite(s.id); setPath({ level: "site" }); }} />
        ); })}</div>
      </Card>
    ));
  } else if (path.level === "site") {
    body = (
      <>
        {summary}
        <div className="fm-section-title"><div className="fm-h2">Buildings</div>{canEdit && <Btn size="sm" icon={Plus} onClick={() => setEditB({})}>Add building</Btn>}</div>
        {tree.buildings.length ? <div className="fm-list">{tree.buildings.map((b) => { const n = assetsUnder(b).length; const nr = b.floors.reduce((t, f) => t + f.rooms.length, 0); return <Row key={b.id} icon={Building2} title={b.name} sub={`${(b.building.floors || []).length} floor${(b.building.floors || []).length === 1 ? "" : "s"} · ${nr} room${nr === 1 ? "" : "s"} · ${n} asset${n === 1 ? "" : "s"}`} onClick={() => setPath({ level: "building", buildingId: b.id })} />; })}</div>
          : <Empty icon={Building2} title="No buildings yet" body="Add the buildings on this site with their floors, then put rooms on each floor. Assets you already have can be placed in rooms automatically from their Area." action={canEdit ? <Btn variant="primary" icon={Plus} onClick={() => setEditB({})}>Add a building</Btn> : null} />}
        {canEdit && areasToOrganise.length > 0 && (
          <Card title="Place your assets in rooms" icon={Wand2} style={{ marginTop: 12 }}>
            <div className="fm-sub">{tree.unplaced.length} asset{tree.unplaced.length === 1 ? " isn't" : "s aren't"} in a room yet, but {areasToOrganise.length === 1 ? "has an Area" : `have ${areasToOrganise.length} different Areas`} typed in. Turn those into rooms in one go.</div>
            <div><Btn variant="primary" icon={Wand2} onClick={() => setOrganise(true)}>Organise into rooms</Btn></div>
          </Card>
        )}
        {(tree.looseRooms.length > 0 || tree.unplaced.length > 0) && (
          <div className="fm-list" style={{ marginTop: 12 }}>
            {tree.looseRooms.length > 0 && <Row icon={DoorOpen} title="Rooms not in a building" sub={`${tree.looseRooms.length} room${tree.looseRooms.length === 1 ? "" : "s"}`} onClick={() => setPath({ level: "loose" })} />}
            {tree.unplaced.length > 0 && <Row icon={Boxes} title="Assets not in a room" sub={`${tree.unplaced.length} asset${tree.unplaced.length === 1 ? "" : "s"}`} onClick={() => setPath({ level: "unplaced" })} />}
          </div>
        )}
      </>
    );
  } else if (path.level === "building" && bNode) {
    body = (
      <>
        {summary}
        <div className="fm-section-title"><div className="fm-h2">Floors</div>{canEdit && <Btn size="sm" icon={Pencil} onClick={() => setEditB(bNode.building)}>Edit building</Btn>}</div>
        <div className="fm-list">{bNode.floors.map((f) => <Row key={f.id} icon={Layers} title={f.name} sub={`${f.rooms.length} room${f.rooms.length === 1 ? "" : "s"} · ${assetsUnder(f).length} asset${assetsUnder(f).length === 1 ? "" : "s"}`} onClick={() => setPath({ level: "floor", buildingId: bNode.id, floorId: f.id })} />)}</div>
        {bNode.building.notes && <div className="fm-sub" style={{ marginTop: 10 }}>{bNode.building.notes}</div>}
      </>
    );
  } else if (path.level === "floor" && fNode) {
    body = (
      <>
        {summary}
        <div className="fm-section-title"><div className="fm-h2">Rooms</div>{canEdit && <Btn size="sm" icon={Plus} onClick={() => setEditR({ defaults: { buildingId: bNode.id, floorId: fNode.virtual ? "" : fNode.id } })}>Add room</Btn>}</div>
        {fNode.rooms.length ? roomRows(fNode.rooms) : <div className="fm-sub">No rooms on this floor yet.</div>}
      </>
    );
  } else if (path.level === "room" && rNode) {
    body = (
      <>
        {summary}
        <div className="fm-section-title"><div className="fm-h2">Assets in {rNode.name}</div>{canEdit && <Btn size="sm" icon={Pencil} onClick={() => setEditR({ existing: rNode.room })}>Edit room</Btn>}</div>
        {assetRows(rNode.assets)}
        {openWorks.length > 0 && <><div className="fm-section-title"><div className="fm-h2">Open jobs</div></div><div className="fm-list">{openWorks.map((w) => <Row key={w.id} tone={w.priority === "high" ? "danger" : "warn"} title={w.description} sub={devices.find((d) => d.id === w.deviceId)?.name} />)}</div></>}
      </>
    );
  } else if (path.level === "loose") {
    body = <>{summary}{roomRows(tree.looseRooms)}</>;
  } else if (path.level === "unplaced") {
    body = <>{summary}<div className="fm-sub" style={{ marginBottom: 8 }}>Open an asset and edit its Area to match a room name, or use “Organise into rooms” on the site page.</div>{assetRows(tree.unplaced)}</>;
  } else body = <Empty icon={MapPin} title="That place has gone" body="It may have been deleted." action={<Btn onClick={() => setPath({ level: "site" })}>Back to the site</Btn>} />;

  return (
    <div>
      <div style={{ marginBottom: 12 }}><Breadcrumb items={crumbs} /></div>
      {body}
      {(path.level === "site" || path.level === "building" || path.level === "floor") && path.level !== "portfolio" && path.level !== "site" && (
        <>
          <div className="fm-section-title"><div className="fm-h2">Assets</div></div>
          {assetRows(assets)}
        </>
      )}
      {editB && <BuildingModal existing={editB.id ? editB : null} canDelete={editB.id ? !spaces.some((s) => s.buildingId === editB.id) : false} onClose={() => setEditB(null)} onDelete={(id) => { onDeleteBuilding(id); setEditB(null); setPath({ level: "site" }); }} onSave={(b) => { onSaveBuilding(b); setEditB(null); }} />}
      {editR && <SpaceModal buildings={buildings.filter((b) => b.locationId === siteId)} existing={editR.existing || null} defaults={editR.defaults || {}} onClose={() => setEditR(null)} onSave={(r) => { onSaveSpace(r); setEditR(null); }} onDelete={(id) => { onDeleteSpace(id); setEditR(null); setPath({ level: "site" }); }} />}
      {organise && <OrganiseModal siteName={site?.name} areas={areasToOrganise} onClose={() => setOrganise(false)} onRun={(name) => { onOrganise(name, areasToOrganise); setOrganise(false); }} />}
    </div>
  );
}
