// Choose where something is on a site: building → floor → room. Used by the asset, job, meter, floor plan
// and isolation point forms, so a building added in Assets → Locations can be picked everywhere straight away.
import { createContext, useContext } from "react";
import { Field, Select } from "../../components/ui.jsx";
import { placeLabel, placeOf } from "./places.js";

// The open site's buildings and rooms, for forms deep inside a page (meters, isolation points, floor plans).
export const PlaceContext = createContext({ siteId: "", buildings: [], spaces: [] });
export const usePlaces = () => useContext(PlaceContext);
// "Building A › Floor 2 › Plant room" for a record with buildingId / floorId / spaceId (or "" if none).
export function usePlaceText() {
  const { buildings, spaces } = usePlaces();
  return (rec) => (rec ? placeLabel(placeOf(rec, { buildings, spaces })) : "");
}

// value: { buildingId, floorId, spaceId }. levels: "room" (building, floor and room) or "floor" (building and floor).
export function PlacePicker({ siteId: siteIdProp, buildings: buildingsProp, spaces: spacesProp, value = {}, onChange, levels = "room", label = "Building, floor and room", hint = true, anyLabel = "— Not in a building —" }) {
  const ctx = usePlaces();
  const siteId = siteIdProp ?? ctx.siteId; const buildings = buildingsProp ?? ctx.buildings ?? []; const spaces = spacesProp ?? ctx.spaces ?? [];
  const siteBuildings = buildings.filter((b) => b.locationId === siteId).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const siteRooms = spaces.filter((s) => s.locationId === siteId);
  const bId = value.buildingId || ""; const fId = value.floorId || ""; const sId = value.spaceId || "";
  const building = siteBuildings.find((b) => b.id === bId) || null;
  const floors = [...(building?.floors || [])].sort((x, y) => (Number(x.level) || 0) - (Number(y.level) || 0));
  const rooms = siteRooms.filter((r) => (bId ? r.buildingId === bId : !r.buildingId || !siteBuildings.some((b) => b.id === r.buildingId)) && (!fId || r.floorId === fId))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const set = (patch) => onChange({ buildingId: bId, floorId: fId, spaceId: sId, ...patch });
  if (!siteBuildings.length && !siteRooms.length) {
    return hint ? <div style={{ fontSize: 11.5, color: "var(--faint)" }}>No buildings or rooms on this site yet — add them in Assets → Locations, then choose them here.</div> : null;
  }
  return (
    <Field label={label}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {siteBuildings.length > 0 && (
          <Select aria-label="Building" value={bId} onChange={(e) => set({ buildingId: e.target.value, floorId: "", spaceId: "" })}>
            <option value="">{anyLabel}</option>
            {siteBuildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
        {building && floors.length > 0 && (
          <Select aria-label="Floor" value={fId} onChange={(e) => set({ floorId: e.target.value, spaceId: "" })}>
            <option value="">— Floor not set —</option>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        )}
        {levels === "room" && (rooms.length > 0 || sId) && (
          <Select aria-label="Room" value={sId} onChange={(e) => { const r = siteRooms.find((x) => x.id === e.target.value); set(r ? { spaceId: r.id, buildingId: r.buildingId || bId, floorId: r.floorId || fId } : { spaceId: "" }); }}>
            <option value="">— No particular room —</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        )}
      </div>
      {hint && levels === "room" && bId && rooms.length === 0 && <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }}>No rooms {fId ? "on this floor" : "in this building"} yet — it will sit in the {fId ? "floor" : "building"} itself. Add rooms in Assets → Locations.</div>}
    </Field>
  );
}
