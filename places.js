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
  return a ? mine.find((s) => norm(s.name) === a) || null : null;
}

// Full place of an asset: { site, building, floor, room }.
export function placeOf(device, { locations = [], buildings = [], spaces = [] }) {
  const site = locations.find((l) => l.id === device?.locationId) || null;
  const room = roomFor(device, spaces);
  const building = room?.buildingId ? buildings.find((b) => b.id === room.buildingId) || null : null;
  const floor = building && room?.floorId ? (building.floors || []).find((f) => f.id === room.floorId) || null : null;
  return { site, building, floor, room, floorText: !floor && room?.floor ? room.floor : "" };
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
  const unplaced = [];
  assets.forEach((d) => { const r = roomFor(d, rooms); if (r) assetsIn.get(r.id).push(d); else unplaced.push(d); });
  const roomNode = (r) => ({ type: "room", id: r.id, name: r.name, room: r, assets: assetsIn.get(r.id) || [] });
  const bl = buildings.filter((b) => b.locationId === siteId).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const used = new Set();
  const bNodes = bl.map((b) => {
    const mineRooms = rooms.filter((r) => r.buildingId === b.id); mineRooms.forEach((r) => used.add(r.id));
    const floors = [...(b.floors || [])].sort((x, y) => (Number(x.level) || 0) - (Number(y.level) || 0) || String(x.name).localeCompare(String(y.name)));
    const fNodes = floors.map((f) => ({ type: "floor", id: f.id, name: f.name, floor: f, building: b, rooms: mineRooms.filter((r) => r.floorId === f.id).map(roomNode) }));
    const noFloor = mineRooms.filter((r) => !r.floorId || !floors.some((f) => f.id === r.floorId));
    if (noFloor.length) fNodes.push({ type: "floor", id: `${b.id}:none`, name: "No floor set", building: b, rooms: noFloor.map(roomNode), virtual: true });
    return { type: "building", id: b.id, name: b.name, building: b, floors: fNodes };
  });
  const loose = rooms.filter((r) => !used.has(r.id)).map(roomNode);
  return { buildings: bNodes, looseRooms: loose, unplaced, rooms, assets };
}
export function assetsUnder(node) {
  if (!node) return [];
  if (node.type === "room") return node.assets;
  if (node.type === "floor") return node.rooms.flatMap((r) => r.assets);
  if (node.type === "building") return node.floors.flatMap((f) => f.rooms.flatMap((r) => r.assets));
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
