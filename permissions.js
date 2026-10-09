// Roles and what each one may change. The database enforces the same rules (supabase-setup.sql,
// ppm_can_write and the settings check); this copy lets the app hide what you can't do and refuse
// a save straight away instead of queueing it. Keep the two in step.

export const ROLES = {
  owner: { label: "Owner", short: "Owner", desc: "Full control, including the team. Set when the company is created." },
  admin: { label: "System administrator", short: "Admin", desc: "Full control, including the team and settings." },
  manager: { label: "FM manager", short: "FM manager", desc: "Runs the site: operations, assets, suppliers, compliance and finance." },
  coordinator: { label: "Facilities coordinator", short: "Coordinator", desc: "Jobs, contractors, schedules, visitors and safety records. Can't change budgets, POs or invoices." },
  engineer: { label: "Engineer", short: "Engineer", desc: "Logs visits, updates jobs, readings, checks and incidents. Can't add or delete assets, or change budgets, suppliers or settings." },
  finance: { label: "Finance", short: "Finance", desc: "Budgets, purchase orders and invoices, and approves quotes over the limit." },
  director: { label: "Senior management", short: "Director", desc: "Dashboards and reports across sites. Read-only." },
  viewer: { label: "Viewer", short: "Viewer", desc: "Can look at everything, can't change anything." },
};
// Roles someone can be invited as (owner is only ever the person who created the company).
export const INVITE_ROLES = ["admin", "manager", "coordinator", "engineer", "finance", "director", "viewer"];
// Before this version there were three: editor became FM manager.
export function normaliseRole(r) {
  if (r === "editor") return "manager";
  return ROLES[r] ? r : "viewer";
}

const FULL = ["owner", "admin", "manager"];
const COORD = [...FULL, "coordinator"];
const OPS = [...COORD, "engineer"];
const MONEY = [...FULL, "finance"];
const DOERS = [...OPS, "finance"];

export const READ_ONLY_ROLES = ["director", "viewer"];
export const isReadOnly = (role) => READ_ONLY_ROLES.includes(normaliseRole(role));
export const isAdminRole = (role) => ["owner", "admin"].includes(normaliseRole(role));

// list → roles that may change it
export const WRITE_RULES = {
  // everyone who works in the app: the activity log, deleted items, linking their own profile
  "org:activity": DOERS, "org:trash": DOERS, "org:users": DOERS,
  // day-to-day work, engineers included: visits (which move the service's next date and plan), jobs, readings, checks, incidents
  "org:services": OPS, "org:devices": OPS, "org:deviceTasks": OPS, "org:spares": OPS, "org:logEntries": OPS, "org:walkrounds": OPS,
  "org:meterReadings": OPS, "org:waterReadings": OPS, "org:signins": OPS, "org:visitSubmissions": OPS, "org:reminders": OPS,
  "org:notices": OPS, "org:incidents": OPS, "org:actions": OPS, "org:permits": OPS,
  // jobs and the planned-visit budget: finance too (approving quotes, planning spend)
  "org:works": DOERS, "org:budgetLines": DOERS, "org:visitBudgets": DOERS,
  // registers, buildings, suppliers and projects: coordinators and up
  "org:projects": COORD, "org:shutdowns": COORD, "org:asbestos": COORD, "org:coshh": COORD, "org:equipment": COORD, "org:audits": COORD,
  "org:training": COORD, "org:drills": COORD, "org:waterOutlets": COORD, "org:keys": COORD, "org:waste": COORD, "org:keyDates": COORD,
  "org:carPark": COORD, "org:feedback": COORD, "org:isolations": COORD, "org:meters": COORD, "org:countries": COORD,
  "org:locations": COORD, "org:spaces": COORD, "org:floorplans": COORD, "org:buildings": COORD, "org:suppliers": COORD,
  // money
  "org:budgets": MONEY, "org:purchaseOrders": MONEY, "org:invoices": MONEY, "org:costLines": MONEY, "org:savings": MONEY,
  // settings: anyone who works in the app, but each field has its own rule (below)
  "org:settings": DOERS,
};
// ---------- assets: who may add, delete and restructure them ----------
// Owners, admins, FM managers and coordinators manage the asset register. Engineers work on assets that exist:
// they may only change the fields their day-to-day work touches (database: ppm_list_guard).
export const ASSET_MANAGERS = COORD;
export const canManageAssets = (role) => ASSET_MANAGERS.includes(normaliseRole(role));
export const ENGINEER_ASSET_FIELDS = ["lastServiceDate", "nextServiceDate", "rescheduleLog", "abortLog", "usageReadings", "statusOverride",
  "changeLog", "downtime", "notesLog", "booking", "chaseLog"];
const ids = (list) => new Set((Array.isArray(list) ? list : []).filter((x) => x && x.id != null).map((x) => String(x.id)));
export function assetRefusal(role, oldList, newList) {
  const r = normaliseRole(role);
  if (canManageAssets(r) || r !== "engineer") return "";
  const a = Array.isArray(oldList) ? oldList : []; const b = Array.isArray(newList) ? newList : [];
  const before = ids(a), after = ids(b);
  if ([...after].some((id) => !before.has(id))) return `Your role (${ROLES[r].label}) can't add assets.`;
  if ([...before].some((id) => !after.has(id))) return `Your role (${ROLES[r].label}) can't delete assets.`;
  if (b.length !== a.length) return `Your role (${ROLES[r].label}) can't add assets.`;   // e.g. a second copy of one
  const old = new Map(a.map((x) => [String(x.id), x]));
  const bad = new Set();
  b.forEach((x) => { const o = old.get(String(x.id)) || {}; changedFields(o, x).forEach((f) => { if (!ENGINEER_ASSET_FIELDS.includes(f)) bad.add(f); }); });
  if (bad.size) return `Your role (${ROLES[r].label}) can't change asset details (${[...bad].slice(0, 4).join(", ")}).`;
  return "";
}

// ---------- quote approval: a separate permission, never part of editing jobs ----------
// Finance always approves. Anyone else in a working role only when an admin gives them "Approves quotes"
// (the owner has it from the start). Read-only roles never approve. The database checks the same thing
// (ppm_can_approve, ppm_list_guard), together with the company's approval limit.
export const APPROVAL_FIELDS = ["approvedBy", "approvedAt", "approvedAmount"];
export const GO_AHEAD = ["approved", "in_progress"];
export function isApprover(role, granted) {
  const r = normaliseRole(role);
  if (isReadOnly(r)) return false;
  return r === "finance" || !!granted;
}
const filled = (v) => v !== undefined && v !== null && v !== "";
// Why a change to the jobs list can't be saved by someone who isn't an approver ("" = fine).
export function worksRefusal(oldList, newList, { approver = false, limit = 0 } = {}) {
  const a = Array.isArray(oldList) ? oldList : []; const b = Array.isArray(newList) ? newList : [];
  const old = new Map(a.map((x) => [String(x && x.id), x]));
  const lim = Number(limit) || 0;
  const dups = (l) => l.length - new Set(l.map((x) => String(x && x.id))).size;
  if (dups(b) > dups(a)) return "Each job can only be in the list once.";
  const num = (v) => v === undefined || v === null || v === "" || (typeof v === "number" && isFinite(v) && Math.round(v * 100) / 100 === v);
  for (const w of b) {
    if (!w || typeof w !== "object") continue;
    const o = old.get(String(w.id));
    if (JSON.stringify(o) !== JSON.stringify(w) && (!num(w.quoteAmount) || !num(w.approvedAmount))) return "Quote amounts must be numbers.";
    const q = Number(w.quoteAmount) || 0;
    // giving approval
    if (!approver && APPROVAL_FIELDS.some((f) => filled(w[f]) && JSON.stringify(w[f]) !== JSON.stringify(o ? o[f] : undefined))) return "Only someone with quote approval permission can approve quotes.";
    if (lim > 0 && q >= lim) {
      // an over-limit quote can't go ahead without approval: not by moving it on, and not by raising the quote of a
      // job that's already under way (a job that was already going may carry on unchanged, so clearing an approval is allowed)
      const active = (st) => GO_AHEAD.includes(st) || st === "completed";
      const wentUp = o && q > (Number(o.quoteAmount) || 0);
      if (!filled(w.approvedBy) && ((GO_AHEAD.includes(w.status) && (!o || !active(o.status) || wentUp)) || (w.status === "completed" && ((!o && !approver) || (o && (!active(o.status) || wentUp)))))) return "This quote is over the approval limit and needs approving first.";
      // raising a quote after it was approved
      if (!approver && o && filled(o.approvedBy) && filled(w.approvedBy) && q > (Number(filled(w.approvedAmount) ? w.approvedAmount : o.quoteAmount) || 0)) return "The quote went up after it was approved, so it needs approving again.";
    }
    // an approved job keeps its approval only for the supplier and asset it was approved for
    if (!approver && o && filled(o.approvedBy) && filled(w.approvedBy) && (JSON.stringify(w.supplierId) !== JSON.stringify(o.supplierId) || JSON.stringify(w.deviceId) !== JSON.stringify(o.deviceId))) return "This job was approved for a different supplier or asset, so it needs approving again.";
  }
  return "";
}

// Settings fields: money ones (finance and up), day-to-day ones (engineers and up), the backup date (anyone working),
// everything else coordinators and up.
export const SETTINGS_MONEY = ["approvalThreshold", "poApprovalLimit", "budgetSettings", "costCodes", "planHorizon"];
export const SETTINGS_DAY = ["handover", "expectedVisitors"];
export const SETTINGS_ANY = ["lastBackupAt"];
export function settingsFieldRoles(field) {
  if (SETTINGS_ANY.includes(field)) return DOERS;
  if (SETTINGS_MONEY.includes(field)) return MONEY;
  if (SETTINGS_DAY.includes(field)) return OPS;
  return COORD;
}

export function canWrite(role, key) {
  const r = normaliseRole(role);
  return (WRITE_RULES[key] || FULL).includes(r);
}
// Settings: which top-level fields changed between two versions
export function changedFields(oldObj, newObj) {
  const a = oldObj && typeof oldObj === "object" && !Array.isArray(oldObj) ? oldObj : {};
  const b = newObj && typeof newObj === "object" && !Array.isArray(newObj) ? newObj : {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
export function canWriteSettings(role, fields) {
  const r = normaliseRole(role);
  return fields.every((f) => settingsFieldRoles(f).includes(r));
}
// Full check for a save: list rules, then the field rules for settings. Returns "" when allowed, else the reason.
export function writeRefusal(role, key, oldStr, newStr, ctx = {}) {
  const r = normaliseRole(role);
  if (!canWrite(r, key)) return `Your role (${ROLES[r].label}) can't change ${KEY_LABELS[key] || "this"}.`;
  if (key === "org:devices" || key === "org:works") {
    let a = [], b = [];
    try { a = oldStr ? JSON.parse(oldStr) : []; } catch (e) { a = []; }
    try { b = newStr ? JSON.parse(newStr) : []; } catch (e) { b = []; }
    if (key === "org:devices") return assetRefusal(r, a, b);
    return worksRefusal(a, b, { approver: isApprover(r, ctx.canApprove), limit: ctx.limit });
  }
  if (key === "org:settings") {
    let a = {}, b = {};
    try { a = oldStr ? JSON.parse(oldStr) : {}; } catch (e) { a = {}; }
    try { b = newStr ? JSON.parse(newStr) : {}; } catch (e) { b = {}; }
    if (JSON.stringify(a.approvalThreshold) !== JSON.stringify(b.approvalThreshold)) {
      if (!(b.approvalThreshold === undefined || b.approvalThreshold === null || b.approvalThreshold === "" || (typeof b.approvalThreshold === "number" && Math.round(b.approvalThreshold * 100) / 100 === b.approvalThreshold))) return "The approval limit must be a number.";
      if (!isApprover(r, ctx.canApprove)) return "Only someone with quote approval permission can change the approval limit.";
    }
    const bad = changedFields(a, b).filter((f) => !settingsFieldRoles(f).includes(r));
    if (bad.length) return `Your role (${ROLES[r].label}) can't change ${bad.map((f) => SETTINGS_LABELS[f] || f).join(", ")}.`;
  }
  return "";
}
// Plain names for settings fields, used when a change is refused.
export const SETTINGS_LABELS = {
  siteDocs: "site documents", statutoryNA: "the statutory checklist", customStatutory: "the statutory checklist", onCall: "the on-call rota",
  emergencyContacts: "emergency contacts", siteInfo: "site information", slaDays: "response targets", approvalThreshold: "the quote approval limit",
  poApprovalLimit: "the PO approval limit", costCodes: "cost codes", budgetSettings: "budget settings", planHorizon: "the planning horizon",
  jobTemplates: "job templates", customFields: "custom fields", categories: "categories", branding: "report branding", logDefs: "check definitions",
  auditTemplates: "audit templates", requiredCourses: "required training", blackouts: "blackout dates", carParkSpaces: "car park spaces",
  recyclingTarget: "the recycling target", nextDrill: "the next fire drill", handover: "handover notes", expectedVisitors: "expected visitors",
};
// Lists where this role may only change some fields or records — background jobs (moving photos) leave them alone.
export function hasFieldRules(role, key) {
  const r = normaliseRole(role);
  if (key === "org:settings") return !FULL.includes(r);
  if (key === "org:devices") return r === "engineer";
  return false;
}
export const KEY_LABELS = {
  "org:budgets": "budgets", "org:purchaseOrders": "purchase orders", "org:invoices": "invoices", "org:costLines": "budget cost lines", "org:savings": "savings",
  "org:suppliers": "suppliers", "org:locations": "sites", "org:countries": "portfolios", "org:buildings": "buildings", "org:spaces": "rooms", "org:settings": "settings",
  "org:devices": "assets and services", "org:services": "visits", "org:works": "jobs", "org:users": "profiles",
};

// What each part of the app writes, so a screen is read-only for roles that can't change it.
export const SECTION_WRITES = {
  "home.command": ["org:works"], "home.desk": ["org:notices"],
  "ops.ppm": ["org:devices", "org:services"], "ops.works": ["org:works"], "ops.schedule": ["org:devices"], "ops.projects": ["org:projects"],
  "ops.history": ["org:services"], "ops.logs": ["org:logEntries"], "ops.walkrounds": ["org:walkrounds"], "ops.shutdowns": ["org:shutdowns"],
  "assets.locations": ["org:buildings", "org:spaces"], "assets.register": ["org:devices"], "assets.rooms": ["org:spaces"], "assets.meters": ["org:meterReadings"],
  "assets.plans": ["org:floorplans"], "assets.isolations": ["org:isolations"],
  "people.onsite": ["org:signins"], "people.suppliers": ["org:suppliers"], "people.team": ["org:locations"], "people.feedback": ["org:feedback"], "people.carpark": ["org:carPark"],
  "safety.register": ["org:devices"], "safety.incidents": ["org:incidents"], "safety.actions": ["org:actions"], "safety.permits": ["org:permits"], "safety.water": ["org:waterReadings"],
  "safety.drills": ["org:drills"], "safety.asbestos": ["org:asbestos"], "safety.coshh": ["org:coshh"], "safety.equipment": ["org:equipment"], "safety.audits": ["org:audits"], "safety.training": ["org:training"],
  "money.overview": ["org:budgets"], "money.budget": ["org:budgets"], "money.finance": ["org:invoices"], "money.contracts": ["org:suppliers"],
  "resources.spares": ["org:spares"], "resources.keys": ["org:keys"], "resources.docs": ["org:settings#siteDocs"], "resources.keydates": ["org:keyDates"], "resources.waste": ["org:waste"],
  "reports.all": [], "reports.health": [], "more.menu": ["org:settings#siteInfo"],
};
export function canEditSection(role, sectionId) {
  if (isReadOnly(role)) return false;
  const keys = SECTION_WRITES[sectionId];
  if (!keys || !keys.length) return !isReadOnly(role);
  // "org:settings#field" = one field of the settings (each field has its own rule)
  return keys.every((k) => (k.includes("#") ? canWrite(role, k.split("#")[0]) && canWriteSettings(role, [k.split("#")[1]]) : canWrite(role, k)));
}

// Which version of Home each role gets.
export function homeKind(role) {
  const r = normaliseRole(role);
  if (r === "engineer") return "engineer";
  if (r === "finance") return "finance";
  if (r === "director") return "director";
  return "manager";
}
