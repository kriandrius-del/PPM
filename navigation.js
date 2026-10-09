// The app's map: nine areas, each with its sections. Every screen the app had before still has a home here.
import { Building2, FileBarChart, LayoutDashboard, MoreHorizontal, Package, PoundSterling, ShieldCheck, Users, Wrench } from "lucide-react";
import { normaliseRole } from "./permissions.js";

export const AREAS = [
  { key: "home", label: "Home", icon: LayoutDashboard, sections: [["command", "What needs attention"], ["desk", "Site desk"]] },
  { key: "ops", label: "Operations", icon: Wrench, sections: [["ppm", "Planned maintenance"], ["works", "Reactive works"], ["schedule", "Schedule"], ["projects", "Projects"], ["history", "Visit history"], ["logs", "Logs & checks"], ["walkrounds", "Walk-rounds"], ["shutdowns", "Shutdowns"]] },
  { key: "assets", label: "Assets", icon: Building2, sections: [["locations", "Locations"], ["register", "Asset register"], ["rooms", "Rooms & spaces"], ["meters", "Meters & energy"], ["plans", "Floor plans"], ["isolations", "Isolation points"]] },
  { key: "people", label: "People", icon: Users, sections: [["onsite", "On site & visitors"], ["suppliers", "Suppliers & contractors"], ["team", "Team & contacts"], ["feedback", "Occupant feedback"], ["carpark", "Car park"]] },
  { key: "safety", label: "Compliance & Safety", short: "Compliance", icon: ShieldCheck, sections: [["register", "Compliance register"], ["incidents", "Incidents"], ["actions", "Actions"], ["permits", "Permits to work"], ["water", "Water hygiene"], ["drills", "Fire drills"], ["equipment", "Equipment inspections"], ["asbestos", "Asbestos"], ["coshh", "COSHH"], ["audits", "Audits"], ["training", "Training"]] },
  { key: "money", label: "Commercial", icon: PoundSterling, sections: [["overview", "Overview & approvals"], ["budget", "Budget"], ["finance", "POs & invoices"], ["contracts", "Contracts"]] },
  { key: "resources", label: "Resources", icon: Package, sections: [["spares", "Spares & stock"], ["keys", "Keys & cards"], ["docs", "Documents"], ["keydates", "Key dates"], ["waste", "Waste"]] },
  { key: "reports", label: "Reports", icon: FileBarChart, sections: [["all", "Reports"], ["health", "Site health"]] },
  { key: "more", label: "More", icon: MoreHorizontal, sections: [["menu", "Settings & admin"]] },
];
export const AREA_BY_KEY = Object.fromEntries(AREAS.map((a) => [a.key, a]));
export const sectionId = (area, section) => `${area}.${section}`;
export function sectionLabel(id) {
  const [a, s] = String(id).split(".");
  return (AREA_BY_KEY[a]?.sections || []).find(([k]) => k === s)?.[1] || "";
}
export function defaultSection(area) { return AREA_BY_KEY[area]?.sections[0][0] || "command"; }

// Screens and links from before this version (and from alerts) still work: old tab name → new place.
export const LEGACY_TABS = {
  home: "home.command", devices: "ops.ppm", schedule: "ops.schedule", certificates: "ops.history", works: "ops.works", projects: "ops.projects",
  suppliers: "people.suppliers", budget: "money.budget", finance: "money.finance", meters: "safety.register", alerts: "home.command",
  // old Site sections
  incidents: "safety.incidents", permits: "safety.permits", actions: "safety.actions", water: "safety.water", drills: "safety.drills", asbestos: "safety.asbestos",
  coshh: "safety.coshh", equipment: "safety.equipment", audits: "safety.audits", training: "safety.training", logs: "ops.logs", walkrounds: "ops.walkrounds",
  shutdowns: "ops.shutdowns", spaces: "assets.rooms", floorplans: "assets.plans", isolations: "assets.isolations", energy: "assets.meters",
  spares: "resources.spares", keys: "resources.keys", docs: "resources.docs", keydates: "resources.keydates", waste: "resources.waste",
  feedback: "people.feedback", carpark: "people.carpark",
};
export function resolveTarget(t) {
  if (!t) return "home.command";
  if (String(t).includes(".")) { const [a, s] = String(t).split("."); if (AREA_BY_KEY[a]?.sections.some(([k]) => k === s)) return t; }
  return LEGACY_TABS[t] || "home.command";
}

// Each role sees the areas it works in (everything stays reachable through search and links).
const ROLE_AREAS = {
  engineer: ["home", "ops", "assets", "safety", "resources", "people", "more"],
  finance: ["home", "money", "ops", "people", "reports", "more"],
  director: ["home", "reports", "money", "safety", "ops", "assets", "more"],
};
export function areasFor(role) {
  const keep = ROLE_AREAS[normaliseRole(role)];
  if (!keep) return AREAS;
  return keep.map((k) => AREA_BY_KEY[k]);
}
// The four areas on the phone's bottom bar (plus "Menu" for the rest).
export function phoneAreas(role) {
  const r = normaliseRole(role);
  if (r === "finance") return ["home", "money", "ops", "reports"];
  if (r === "director") return ["home", "reports", "money", "safety"];
  return ["home", "ops", "assets", "safety"];
}

// Where a notification takes you, by the start of its key (more precise than its old tab name).
const ALERT_TARGETS = [
  ["acts-", "safety.actions"], ["act-", "safety.actions"], ["asb", "safety.asbestos"], ["aud-", "safety.audits"], ["coshh-", "safety.coshh"], ["cp-", "people.carpark"],
  ["docs-", "resources.docs"], ["doc-", "resources.docs"], ["drill-", "safety.drills"], ["ndr-", "safety.drills"], ["eq-", "safety.equipment"], ["flush-", "safety.water"],
  ["wtd-", "safety.water"], ["wt", "safety.water"], ["inc-", "safety.incidents"], ["rid-", "safety.incidents"], ["isox-", "assets.isolations"], ["kd-", "resources.keydates"],
  ["ky-", "resources.keys"], ["log-", "ops.logs"], ["mr-", "assets.meters"], ["mt-", "assets.meters"], ["ptw-", "safety.permits"], ["rec-", "resources.waste"],
  ["reqtr-", "safety.training"], ["trb-", "safety.training"], ["trs-", "safety.training"], ["tr-", "safety.training"], ["sd-", "ops.shutdowns"], ["sp-", "resources.spares"],
  ["pj", "ops.projects"], ["rm-", "home.desk"], ["frost-", "home.desk"], ["insuranceExpiry", "people.suppliers"], ["accreditationExpiry", "people.suppliers"],
  ["iva-", "money.finance"], ["ivd-", "money.finance"], ["poa-", "money.finance"], ["pov-", "money.finance"], ["ap-", "ops.works"],
];
export function alertTarget(a) {
  const k = String(a?.key || "");
  const hit = ALERT_TARGETS.find(([p]) => k.startsWith(p));
  return hit ? hit[1] : resolveTarget(a?.tab);
}

// Everything else stays one tap away, under "Other areas" — no screen is hidden from any role.
export function otherAreasFor(role) {
  const mine = new Set(areasFor(role).map((a) => a.key));
  return AREAS.filter((a) => !mine.has(a.key));
}
