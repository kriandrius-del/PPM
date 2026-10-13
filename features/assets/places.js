// Where everything is: Organisation → Portfolio → Site → Building → Floor → Room → Asset.
// Sites are the app's locations; portfolios group sites (a site's "portfolio" field, or its country);
// buildings (with their floors) are their own list; rooms are the existing Spaces list; an asset sits in a
// room either by a direct link (spaceId) or because its Area text matches the room's name.
import { currentBooking, currentDowntime, daysUntil } from "../../lib/utils.js";

const norm = (s) => String(s || "").trim().toLowerCase();

export function portfolioOf(site, countries = []) {
  return (site?.portfolio || "").trim() || countries.find((c) => c.id === site?.countryId)?.name || "Portfolio";
}

// The room an asset is in (or null).
export function roomFor(device, spaces) {
  if (!device) return null;
  const mine = spaces.filter((s) => s.locationId === device.locationId);
  if (device.spaceId) { const r = mine.find((s) => s.id === device.spaceId); if (r) return r; }
  const a = norm(device.area);
  if (!a) return null;
  // Placed straight in a building (or on a floor): its Area text only matches rooms there.
  const pool = device.buildingId ? mine.filter((s) => s.buildingId === device.buildingId && (!device.floorId || s.floorId === device.floorId)) : mine;
  return pool.find((s) => norm(s.name) === a) || null;
}

// Full place of an asset (or a meter, isolation point…): { site, building, floor, room }.
// A record can sit in a room, or straight in a building or on a floor when it isn't in any room (buildingId/floorId).
export function placeOf(device, { locations = [], buildings = [], spaces = [] }) {
  const site = locations.find((l) => l.id === device?.locationId) || null;
  const room = roomFor(device, spaces);
  const bId = room ? room.buildingId : device?.buildingId;
  const building = bId ? buildings.find((b) => b.id === bId) || null : null;
  const fId = room ? room.floorId : device?.floorId;
  const floor = building && fId ? (building.floors || []).find((f) => f.id === fId) || null : null;
  return { site, building, floor, room, floorText: !floor && room?.floor ? room.floor : "" };
}
// The building/floor/room fields to store for a place chosen in a form (the room decides the building and floor).
export function placeFields({ buildingId = "", floorId = "", spaceId = "" } = {}, spaces = []) {
  const room = spaceId ? spaces.find((s) => s.id === spaceId) : null;
  if (room) return { spaceId: room.id, buildingId: room.buildingId || null, floorId: room.floorId || null };
  return { spaceId: null, buildingId: buildingId || null, floorId: (buildingId && floorId) || null };
}
export function placeLabel(p, { withSite = false } = {}) {
  return [withSite && p.site?.name, p.building?.name, p.floor?.name || p.floorText, p.room?.name].filter(Boolean).join(" › ");
}

// The tree for one site. Floors come from the building; rooms not given a floor sit under "No floor set";
// rooms not in any building and assets not in any room are listed separately so nothing is hidden.
export function siteTree({ siteId, buildings = [], spaces = [], devices = [] }) {
  const rooms = spaces.filter((s) => s.locationId === siteId);
  const assets = devices.filter((d) => d.locationId === siteId);
  const assetsIn = new Map(rooms.map((r) => [r.id, []]));
  const siteBuildingIds = new Set(buildings.filter((b) => b.locationId === siteId).map((b) => b.id));
  const unplaced = []; const inBuilding = [];   // inBuilding: placed in a building (or on a floor) but not in a room
  assets.forEach((d) => { const r = roomFor(d, rooms); if (r) assetsIn.get(r.id).push(d); else if (d.buildingId && siteBuildingIds.has(d.buildingId)) inBuilding.push(d); else unplaced.push(d); });
  const roomNode = (r) => ({ type: "room", id: r.id, name: r.name, room: r, assets: assetsIn.get(r.id) || [] });
  const bl = buildings.filter((b) => b.locationId === siteId).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const used = new Set();
  const bNodes = bl.map((b) => {
    const mineRooms = rooms.filter((r) => r.buildingId === b.id); mineRooms.forEach((r) => used.add(r.id));
    const floors = [...(b.floors || [])].sort((x, y) => (Number(x.level) || 0) - (Number(y.level) || 0) || String(x.name).localeCompare(String(y.name)));
    const mineLoose = inBuilding.filter((d) => d.buildingId === b.id);
    const fNodes = floors.map((f) => ({ type: "floor", id: f.id, name: f.name, floor: f, building: b, rooms: mineRooms.filter((r) => r.floorId === f.id).map(roomNode), assetsHere: mineLoose.filter((d) => d.floorId === f.id) }));
    const noFloor = mineRooms.filter((r) => !r.floorId || !floors.some((f) => f.id === r.floorId));
    if (noFloor.length) fNodes.push({ type: "floor", id: `${b.id}:none`, name: "No floor set", building: b, rooms: noFloor.map(roomNode), assetsHere: [], virtual: true });
    return { type: "building", id: b.id, name: b.name, building: b, floors: fNodes, assetsHere: mineLoose.filter((d) => !d.floorId || !floors.some((f) => f.id === d.floorId)) };
  });
  const loose = rooms.filter((r) => !used.has(r.id)).map(roomNode);
  return { buildings: bNodes, looseRooms: loose, unplaced, rooms, assets };
}
export function assetsUnder(node) {
  if (!node) return [];
  if (node.type === "room") return node.assets;
  if (node.type === "floor") return [...node.rooms.flatMap((r) => r.assets), ...(node.assetsHere || [])];
  if (node.type === "building") return [...node.floors.flatMap((f) => [...f.rooms.flatMap((r) => r.assets), ...(f.assetsHere || [])]), ...(node.assetsHere || [])];
  return [];
}

// Asset status, worked out from what the app knows — always with the reason.
export const ASSET_STATUSES = {
  operational: { label: "Operational", tone: "ok" },
  attention: { label: "Attention required", tone: "warn" },
  maintenance: { label: "Under maintenance", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  offline: { label: "Offline", tone: "danger" },
  decommissioned: { label: "Decommissioned", tone: "muted" },
};
export function assetStatus(d, { works = [], services = [] } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const mk = (key, reasons) => ({ key, ...ASSET_STATUSES[key], reasons });
  if (!d) return mk("operational", []);
  if (d.archived) return mk("decommissioned", ["Archived (decommissioned)"]);
  const down = currentDowntime(d);
  if (down) return mk("offline", [`Out of service since ${String(down.from).slice(0, 10)}${down.reason ? ` — ${down.reason}` : ""}`]);
  const ov = d.statusOverride;
  if (ov?.status && ASSET_STATUSES[ov.status] && ov.status !== "operational") return mk(ov.status, [`Marked ${ASSET_STATUSES[ov.status].label.toLowerCase()} by ${ov.by || "someone"}${ov.note ? ` — ${ov.note}` : ""}`]);
  if (d.condition === "D") return mk("failed", ["Condition D — failed or about to fail"]);
  const open = works.filter((w) => w.deviceId === d.id && !["completed", "rejected"].includes(w.status));
  const booking = currentBooking(d);
  if (open.some((w) => w.status === "in_progress") || (booking && booking.date === today)) return mk("maintenance", [open.some((w) => w.status === "in_progress") ? "A job on it is in progress" : "Engineer booked for today"]);
  const reasons = [];
  const n = daysUntil(d.nextServiceDate);
  if (n !== null && n < 0) reasons.push(`Planned maintenance ${-n} day${n === -1 ? "" : "s"} overdue`);
  const high = open.filter((w) => w.priority === "high");
  if (high.length) reasons.push(`${high.length} urgent job${high.length === 1 ? "" : "s"} open`);
  else if (open.length) reasons.push(`${open.length} job${open.length === 1 ? "" : "s"} open`);
  if (d.condition === "C") reasons.push("Condition C — defects");
  const last = services.filter((v) => v.deviceId === d.id && !v.skipped && !v.aborted).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const fails = (last?.checklistResults || []).filter((r) => r.result === "fail").length;
  if (fails) reasons.push(`Last visit: ${fails} check${fails === 1 ? "" : "s"} failed`);
  return reasons.length ? mk("attention", reasons) : mk("operational", []);
}

// ---------- jobs on a place (round 30.4) ----------
// A job is raised against an asset, or — a Phase 1 decision — on a room, floor or building with no asset
// (deviceId empty; locationId + buildingId/floorId/spaceId say where).
export const isPlaceJob = (w) => !!w && !w.deviceId && !!(w.spaceId || w.buildingId);
export function jobSite(w, deviceById = {}) { return deviceById[w?.deviceId]?.locationId || w?.locationId || null; }
// What a job is for: its asset's name, or where it is ("Annexe › Floor 2 › Kitchen").
export function jobWhat(w, deviceById = {}, { buildings = [], spaces = [] } = {}) {
  const d = deviceById[w?.deviceId];
  if (d) return d.name;
  if (w?.deviceId) return "Unknown asset";
  return placeLabel(placeOf(w, { buildings, spaces })) || w?.placeName || "No asset";
}
