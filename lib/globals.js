// App-wide values set by MainApp (can the user edit, currency, categories, team list).
import { SprayCan, Wrench, Soup, Tag, Sparkles, ShieldAlert, Building2, Globe2, Flame, Zap, Leaf, Droplets } from "lucide-react";

export let ACTIVE_USERS = [];

export let AREA_SUGGESTIONS_CACHE = {};

// Set once per render from the selected country, then read by every gbp() call
// made while rendering that pass — see the note where it's assigned in App().
export let ACTIVE_CURRENCY_CODE = "GBP";

// Same pattern — set once per render in App(), read by any button that should
// hide itself for a "viewer" profile. This is a UI convenience, NOT security:
// the underlying storage has no per-user write restriction, so a viewer could
// still call the storage API directly. See the note in the chat reply.
export let ACTIVE_CAN_EDIT = true;

export const BUILTIN_CATEGORY_META = {
  cleaning: { label: "Cleaning", color: "#2B7A78", icon: SprayCan, iconName: "SprayCan" },
  maintenance: { label: "Maintenance", color: "#2B4562", icon: Wrench, iconName: "Wrench" },
  catering: { label: "Catering", color: "#8E4585", icon: Soup, iconName: "Soup" },
};

export const CATEGORY_ICONS = { SprayCan, Wrench, Soup, Tag, Sparkles, ShieldAlert, Building2, Globe2, Flame, Zap, Leaf, Droplets };

// Live category list: the three built-ins (which can be renamed/recoloured) plus any custom ones.
// Rebuilt from settings on every render, like the active currency.
export let CATEGORY_META = { ...BUILTIN_CATEGORY_META };

export let CATEGORY_KEYS = Object.keys(CATEGORY_META);

export let ACTIVE_CUSTOM_FIELDS = [];

export let ACTIVE_TEMPLATES = [];

export function applyCategorySettings(st) {
  const meta = {};
  Object.entries(BUILTIN_CATEGORY_META).forEach(([k, m]) => {
    const o = (st?.categoryOverrides || {})[k] || {};
    meta[k] = { ...m, label: o.label || m.label, color: o.color || m.color };
  });
  (st?.customCategories || []).forEach((c) => {
    meta[c.key] = { label: c.label, color: c.color || "#5B6672", icon: CATEGORY_ICONS[c.icon] || Tag, iconName: c.icon || "Tag", custom: true };
  });
  CATEGORY_META = meta;
  CATEGORY_KEYS = Object.keys(meta);
}

export function emptyCatMap(init = 0) { return Object.fromEntries(CATEGORY_KEYS.map((k) => [k, typeof init === "function" ? init() : init])); }
export function set_ACTIVE_CURRENCY_CODE(v) { ACTIVE_CURRENCY_CODE = v; }
export function set_ACTIVE_CUSTOM_FIELDS(v) { ACTIVE_CUSTOM_FIELDS = v; }
export function set_ACTIVE_TEMPLATES(v) { ACTIVE_TEMPLATES = v; }
export function set_ACTIVE_CAN_EDIT(v) { ACTIVE_CAN_EDIT = v; }
export function set_ACTIVE_USERS(v) { ACTIVE_USERS = v; }
export function set_AREA_SUGGESTIONS_CACHE(v) { AREA_SUGGESTIONS_CACHE = v; }

// Target days to complete reactive works, by priority — editable on the Works tab.
export let ACTIVE_SLA = { high: 1, medium: 7, low: 28 };
export function set_ACTIVE_SLA(v) { ACTIVE_SLA = v; }

export let TAG_SUGGESTIONS_CACHE = {}; // locationId -> tags already used
export function set_TAG_SUGGESTIONS_CACHE(v) { TAG_SUGGESTIONS_CACHE = v; }

export let PARENT_CANDIDATES_CACHE = {}; // locationId -> services that can be a parent
export function set_PARENT_CANDIDATES_CACHE(v) { PARENT_CANDIDATES_CACHE = v; }

export let ACTIVE_SITE_INFO = {}; // the selected location's address, hours, access & site contact
export function set_ACTIVE_SITE_INFO(v) { ACTIVE_SITE_INFO = v || {}; }
// One-line site details for emails to suppliers.
export function siteInfoText() {
  const s = ACTIVE_SITE_INFO || {};
  return [s.address && `Site address: ${s.address}`, s.hours && `Opening hours: ${s.hours}`, s.access && `Access: ${s.access}`, s.parking && `Parking: ${s.parking}`, (s.contactName || s.contactPhone) && `On-site contact: ${[s.contactName, s.contactPhone].filter(Boolean).join(", ")}`].filter(Boolean).join("\n");
}
