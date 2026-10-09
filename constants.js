// Fixed lists and settings: storage keys, statutory items, permit types, waste streams, templates.
/* ---------------------------------------------------------
   Storage helpers
   Organisation data (countries/locations/devices/services/
   works/suppliers/budgets/users) is SHARED — everyone using
   this app sees the same records. Only "which profile is
   active on this device" is kept personal.
--------------------------------------------------------- */
export const SKEYS = {
  users: "org:users", countries: "org:countries", locations: "org:locations",
  devices: "org:devices", services: "org:services", works: "org:works",
  suppliers: "org:suppliers", budgets: "org:budgets", budgetLines: "org:budgetLines",
  deviceTasks: "org:deviceTasks", visitBudgets: "org:visitBudgets", settings: "org:settings",
  activity: "org:activity",
  meters: "org:meters", meterReadings: "org:meterReadings", signins: "org:signins",
  spares: "org:spares", keys: "org:keys", reminders: "org:reminders",
  audits: "org:audits", incidents: "org:incidents", projects: "org:projects",
  permits: "org:permits", waste: "org:waste",
  purchaseOrders: "org:purchaseOrders", invoices: "org:invoices",
  waterOutlets: "org:waterOutlets", waterReadings: "org:waterReadings", training: "org:training", drills: "org:drills",
  trash: "org:trash", notices: "org:notices", logEntries: "org:logEntries", savings: "org:savings",
  asbestos: "org:asbestos", actions: "org:actions", spaces: "org:spaces", walkrounds: "org:walkrounds",
  coshh: "org:coshh", equipment: "org:equipment", visitSubmissions: "org:visitSubmissions",
  feedback: "org:feedback", floorplans: "org:floorplans", keyDates: "org:keyDates",
  carPark: "org:carPark", isolations: "org:isolations", costLines: "org:costLines", shutdowns: "org:shutdowns",
  buildings: "org:buildings",
};
 // team members, for "assign to" pickers
export const PERMIT_PRECAUTIONS = {
  "Hot works": ["Fire extinguisher at the work area", "Combustibles removed or protected", "Detector heads isolated only if agreed (note which)", "Fire watch for 60 minutes after work ends"],
  "Working at height": ["Access equipment inspected and suitable", "Area below cordoned off", "Weather / wind checked", "Harness and anchor where required"],
  "Confined space": ["Atmosphere tested before entry", "Rescue plan and equipment in place", "Standby person outside", "Ventilation provided"],
  "Electrical isolation": ["Circuit isolated and locked off", "Proved dead at point of work", "Warning signs posted", "Key held by person doing the work"],
  "Asbestos check": ["Asbestos register checked for this area", "Area confirmed free of ACMs or managed", "Workers briefed on findings"],
  "General / cold work": ["Work area segregated / signed", "Services isolated where needed", "RAMS reviewed with the team", "Area left safe at end of shift"],
  "Excavation / digging": ["Underground services located (CAT scan / drawings)", "Edge protection / barriers in place", "Spoil kept back from the edge", "Access / egress provided if over 1.2 m deep"],
  "Roof access": ["Access route agreed", "Edge protection or fall arrest in place", "No lone working", "Weather checked"],
};

export const WASTE_STREAMS = { general: "General waste", mixed: "Mixed recycling", cardboard: "Cardboard", food: "Food waste", glass: "Glass", paper: "Confidential paper", weee: "WEEE (electrical)", hazardous: "Hazardous" };

export const DEFAULT_EMERGENCY = [
  { label: "Gas emergency (National Gas)", phone: "0800 111 999" },
  { label: "Power cut (any network)", phone: "105" },
  { label: "Water supplier — leaks", phone: "" },
  { label: "Fire alarm maintenance company", phone: "" },
  { label: "Lift engineer / call-out", phone: "" },
  { label: "Out-of-hours key holder", phone: "" },
  { label: "Security / alarm monitoring", phone: "" },
];

export const DEFAULT_AUDIT_TEMPLATES = [
  { id: "cleaning", name: "Cleaning audit", items: ["Floors & carpets", "Desks & work surfaces", "Kitchen / tea points", "Toilets & washrooms", "Consumables stocked (soap, paper)", "Bins emptied", "Glass, mirrors & high touch points", "Entrance & reception"] },
  { id: "washroom", name: "Washroom check", items: ["Floors clean & dry", "Toilets & urinals clean", "Basins & taps clean", "Soap & paper stocked", "Sanitary bins serviced", "No odours"] },
  { id: "walkround", name: "FM site walk-round", items: ["Fire exits clear", "Emergency lighting working", "Fire extinguishers in place", "Lighting working", "No trip hazards", "Plant rooms locked & tidy", "External areas & bins tidy", "Signage in place"] },
];

export const INCIDENT_TYPES = { near_miss: "Near miss", injury: "Injury", property: "Property damage", environmental: "Environmental / spill", security: "Security", other: "Other" };

export const PROJECT_STATUSES = [
  { key: "idea", label: "Proposed", color: "#5B6672" }, { key: "approved", label: "Approved", color: "#2B6CB0" },
  { key: "in_progress", label: "In progress", color: "#D97706" }, { key: "on_hold", label: "On hold", color: "#8A94A0" }, { key: "complete", label: "Complete", color: "#2F855A" },
];

export const REPEAT_OPTIONS = { none: "Doesn't repeat", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
 // used to avoid pulling shared data straight after our own save
export const PKEYS = { nav: "me:nav", snooze: "me:snooze", display: "me:display", notif: "me:notif" };

// Documents a supplier should provide before starting work on site.
export const ONBOARDING_ITEMS = ["Public liability insurance", "Employer's liability insurance", "Health & safety policy", "Generic RAMS / method statements", "Trade accreditations (Gas Safe, NICEIC…)", "Signed contract / terms", "Bank details verified", "Site induction completed"];
 // locationId -> areas already used, for the Area field autocomplete
// Approximate UK carbon factors (kgCO2e per unit) — editable per meter.
export const DEFAULT_CO2 = { electricity: 0.207, gas: 2.04, water: 0.34, other: 0 };

// Permits a job can need before work starts (UK FM practice).
export const PERMIT_TYPES = ["Hot works", "Working at height", "Confined space", "Electrical isolation", "Asbestos check", "Roof access", "General / cold work", "Excavation / digging"];

// Target days to complete reactive works, by priority.
export const SLA_DAYS = { high: 1, medium: 7, low: 28 };

// UK statutory / best-practice inspections a site is usually expected to have in place.
export const STATUTORY_ITEMS = [
  { key: "fire_alarm", label: "Fire alarm test", freq: "Weekly test + 6-monthly service (BS 5839)", keywords: ["fire alarm"], category: "maintenance", repeatMode: "weekly" },
  { key: "em_light", label: "Emergency lighting", freq: "Monthly flick test + annual 3-hour test (BS 5266)", keywords: ["emergency light"], category: "maintenance", months: 1 },
  { key: "extinguishers", label: "Fire extinguishers", freq: "Annual service (BS 5306)", keywords: ["extinguisher"], category: "maintenance", months: 12 },
  { key: "fra", label: "Fire risk assessment", freq: "Annual review (RRO 2005)", keywords: ["fire risk"], category: "maintenance", months: 12 },
  { key: "fire_doors", label: "Fire door inspection", freq: "Quarterly to 6-monthly", keywords: ["fire door"], category: "maintenance", months: 6 },
  { key: "gas", label: "Gas safety / boiler service", freq: "Annual (Gas Safety Regs 1998)", keywords: ["gas", "boiler"], category: "maintenance", months: 12 },
  { key: "eicr", label: "Fixed wiring (EICR)", freq: "Every 5 years", keywords: ["eicr", "fixed wiring", "electrical installation"], category: "maintenance", months: 60 },
  { key: "pat", label: "Portable appliance testing", freq: "Risk-based, typically annual", keywords: ["pat test", "portable appliance", "pat"], category: "maintenance", months: 12 },
  { key: "legionella_ra", label: "Legionella risk assessment", freq: "Review every 2 years (ACoP L8)", keywords: ["legionella"], category: "maintenance", months: 24 },
  { key: "water_temps", label: "Water temperature monitoring", freq: "Monthly (ACoP L8)", keywords: ["water temp", "tmv", "temperature check"], category: "maintenance", months: 1 },
  { key: "lifts", label: "Lift thorough examination", freq: "Every 6 months (LOLER)", keywords: ["lift", "loler", "elevator"], category: "maintenance", months: 6 },
  { key: "fgas", label: "Air conditioning F-gas checks", freq: "Leak checks by charge size (F-gas Regs); TM44 every 5 years", keywords: ["f-gas", "fgas", "air con", "aircon", "hvac", "ahu", "tm44", "chiller"], category: "maintenance", months: 12 },
  { key: "kitchen_extract", label: "Kitchen extract cleaning", freq: "3–12 monthly by use (TR19)", keywords: ["extract", "tr19", "grease duct", "canopy"], category: "catering", months: 6 },
  { key: "asbestos", label: "Asbestos register re-inspection", freq: "Annual (CAR 2012)", keywords: ["asbestos"], category: "maintenance", months: 12 },
  { key: "lightning", label: "Lightning protection test", freq: "Annual (BS EN 62305)", keywords: ["lightning"], category: "maintenance", months: 12 },
  { key: "sprinklers", label: "Sprinkler system", freq: "Weekly test + annual service", keywords: ["sprinkler"], category: "maintenance", months: 12 },
];

export const LATE_REASONS = ["Supplier no-show", "Rescheduled by supplier", "Rescheduled by site", "No access to area", "Parts / equipment awaited", "Other"];

/* ---------------------------------------------------------
   Formatting helpers
--------------------------------------------------------- */
export const CURRENCIES = {
  GBP: { locale: "en-GB" }, EUR: { locale: "en-IE" }, USD: { locale: "en-US" },
  AUD: { locale: "en-AU" }, CAD: { locale: "en-CA" }, CHF: { locale: "de-CH" },
  INR: { locale: "en-IN" }, AED: { locale: "en-AE" },
};

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------------------------------------------------------
   UI atoms
--------------------------------------------------------- */
export const toneStyles = {
  ok: { bg: "#EAF4EE", fg: "#2F6B4A", dot: "#2F855A" },
  warn: { bg: "#FDF1E0", fg: "#8A5A0B", dot: "#D97706" },
  danger: { bg: "#FBEAEA", fg: "#9B2C2C", dot: "#C53030" },
  muted: { bg: "#EEF0F2", fg: "#5B6672", dot: "#8A94A0" },
};

/* ---------------------------------------------------------
   Extra Works / Quotes Tab
--------------------------------------------------------- */
export const WORK_STATUSES = [
  { key: "requested", label: "Requested", tone: "warn" },
  { key: "quoted", label: "Quoted", tone: "muted" },
  { key: "approved", label: "Approved", tone: "warn" },
  { key: "in_progress", label: "In progress", tone: "warn" },
  { key: "on_hold", label: "On hold", tone: "muted" },
  { key: "completed", label: "Completed", tone: "ok" },
  { key: "rejected", label: "Rejected", tone: "danger" },
];

export const WORK_PRIORITIES = [
  { key: "high", label: "High", color: "#C53030", bg: "#FBEAEA" },
  { key: "medium", label: "Medium", color: "#B7791F", bg: "#FDF1E0" },
  { key: "low", label: "Low", color: "#5B6672", bg: "#EEF0F2" },
];

export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export const CHECKLIST_PRESETS = {
  cleaning: ["All areas cleaned to spec", "Washrooms cleaned & restocked", "Bins emptied", "Kitchen / tea points cleaned", "Consumables levels checked", "Issues or damage reported"],
  maintenance: ["Visual inspection completed", "Safety checks passed", "Filters / consumables replaced", "Operating readings within range", "Area left clean and safe", "Asset labels / records updated"],
  catering: ["Food temperatures recorded", "Fridge / freezer temps in range", "Allergen labelling correct", "Hygiene & cleaning schedule followed", "Stock rotation checked", "Waste removed"],
};

export const WORK_BUDGET_TYPES = [
  { key: "budgeted", label: "Budgeted", hint: "Planned, counts toward the budget" },
  { key: "non_controllable", label: "Non-controllable", hint: "Unplanned / unavoidable, tracked separately" },
];

/* ---------------------------------------------------------
   Utility meters
--------------------------------------------------------- */
export const METER_TYPES = { electricity: { label: "Electricity", unit: "kWh", color: "#D97706" }, gas: { label: "Gas", unit: "m³", color: "#C53030" }, water: { label: "Water", unit: "m³", color: "#2B6CB0" }, other: { label: "Other", unit: "", color: "#5B6672" } };

export const IMPORT_FIELDS = [
  { key: "name", label: "Service name", aliases: ["name", "service", "service name", "asset", "asset name", "description", "equipment"] },
  { key: "assetTag", label: "Asset tag", aliases: ["asset tag", "tag", "asset id", "asset no", "asset number", "ref"] },
  { key: "serviceCategory", label: "Category", aliases: ["category", "service category", "type of service"] },
  { key: "subCategory", label: "Subcategory", aliases: ["subcategory", "sub category", "sub-category"] },
  { key: "category", label: "Equipment type", aliases: ["equipment type", "type", "system"] },
  { key: "area", label: "Area / room", aliases: ["area", "room", "location", "floor", "zone"] },
  { key: "supplier", label: "Supplier", aliases: ["supplier", "contractor", "vendor"] },
  { key: "serviceIntervalMonths", label: "Interval (months)", aliases: ["interval", "interval months", "frequency", "frequency months", "months"] },
  { key: "nextServiceDate", label: "Next due", aliases: ["next due", "next service", "due date", "next visit", "due"] },
  { key: "budgetPerVisit", label: "Budget per visit", aliases: ["budget per visit", "cost per visit", "budget", "cost", "price"] },
  { key: "manufacturer", label: "Manufacturer", aliases: ["manufacturer", "make", "brand"] },
  { key: "model", label: "Model", aliases: ["model"] },
  { key: "serialNumber", label: "Serial number", aliases: ["serial", "serial number", "serial no", "s/n"] },
  { key: "installDate", label: "Install date", aliases: ["install date", "installed", "installation date"] },
  { key: "criticality", label: "Criticality", aliases: ["criticality", "critical", "importance"] },
  { key: "condition", label: "Condition", aliases: ["condition", "condition grade", "grade"] },
];


/* ---------------------------------------------------------
   Compliance: were planned visits done on time?
   A planned visit (from a service's visit-budget schedule) that's now in the past counts as
   on time if a visit was logged within ±GRACE days of it, late if logged after that but before
   the next planned date, and missed otherwise.
--------------------------------------------------------- */
export const COMPLIANCE_GRACE_DAYS = 7;

/* ---------------------------------------------------------
   Service templates — typical UK facilities schedules. Frequencies are common
   practice / guidance, not legal advice: check your own risk assessments and insurer.
--------------------------------------------------------- */
export const BUILTIN_TEMPLATES = [
  { id: "t-boiler", name: "Gas boiler service", serviceCategory: "maintenance", subCategory: "Heating", equipmentType: "Boiler", repeat: { mode: "interval", months: 12 },
    checklist: ["Combustion / flue gas analysis recorded", "Flue and ventilation checked", "Safety devices tested", "Gas tightness test passed", "Pressure and controls checked", "Engineer's Gas Safe ID recorded"],
    note: "Typically annual, by a Gas Safe registered engineer." },
  { id: "t-fa-weekly", name: "Fire alarm — weekly test", serviceCategory: "maintenance", subCategory: "Fire safety", equipmentType: "Fire alarm", repeat: { mode: "weekly" },
    checklist: ["Call point tested (rotate each week)", "Sounders heard in all areas", "Panel shows no faults", "Test recorded in fire log book"],
    note: "BS 5839-1 recommends a weekly test from a different manual call point each week." },
  { id: "t-fa-service", name: "Fire alarm — 6-monthly service", serviceCategory: "maintenance", subCategory: "Fire safety", equipmentType: "Fire alarm", repeat: { mode: "interval", months: 6 },
    checklist: ["Panel and power supplies checked", "Standby batteries tested", "Detectors functionally tested (per schedule)", "Fault log reviewed", "Service certificate received"],
    note: "BS 5839-1 recommends servicing at intervals not exceeding 6 months." },
  { id: "t-el-monthly", name: "Emergency lighting — monthly test", serviceCategory: "maintenance", subCategory: "Fire safety", equipmentType: "Emergency lighting", repeat: { mode: "interval", months: 1 },
    checklist: ["All luminaires lit on test", "Exit signs illuminated", "Faulty fittings reported", "Test recorded in log"],
    note: "BS 5266-1: short functional test monthly, plus a full-duration test annually." },
  { id: "t-el-annual", name: "Emergency lighting — annual duration test", serviceCategory: "maintenance", subCategory: "Fire safety", equipmentType: "Emergency lighting", repeat: { mode: "interval", months: 12 },
    checklist: ["Full rated-duration test completed", "All fittings lasted the full duration", "Failed fittings listed", "Certificate received"],
    note: "BS 5266-1: annual full rated-duration test." },
  { id: "t-extinguishers", name: "Fire extinguisher service", serviceCategory: "maintenance", subCategory: "Fire safety", equipmentType: "Extinguishers", repeat: { mode: "interval", months: 12 },
    checklist: ["Each extinguisher inspected and tagged", "Pressures in range", "Signage and brackets in place", "Items for refill/replacement listed"],
    note: "BS 5306-3: annual service by a competent person, with monthly visual checks by staff." },
  { id: "t-pat", name: "PAT testing", serviceCategory: "maintenance", subCategory: "Electrical", equipmentType: "Portable appliances", repeat: { mode: "interval", months: 12 },
    checklist: ["Items tested and labelled", "Failed items removed from use", "Asset register updated", "Results certificate received"],
    note: "Frequency depends on equipment type and environment — see the IET Code of Practice." },
  { id: "t-eicr", name: "Fixed wire test (EICR)", serviceCategory: "maintenance", subCategory: "Electrical", equipmentType: "Electrical installation", repeat: { mode: "interval", months: 60 },
    checklist: ["EICR completed", "C1 / C2 defects listed", "Remedial works raised", "Certificate stored"],
    note: "Commercial premises are commonly inspected every 5 years (IET guidance); some uses need more often." },
  { id: "t-legionella", name: "Legionella — monthly temperature checks", serviceCategory: "maintenance", subCategory: "Water hygiene", equipmentType: "Water system", repeat: { mode: "interval", months: 1 },
    checklist: ["Hot water ≥50°C at sentinel outlets within 1 minute", "Cold water <20°C within 2 minutes", "Calorifier flow ≥60°C, return ≥50°C", "Little-used outlets flushed", "Readings recorded in log"],
    note: "Based on HSE ACoP L8 / HSG274 Part 2. Follow your site's own legionella risk assessment." },
  { id: "t-aircon", name: "Air conditioning service (incl. F-gas check)", serviceCategory: "maintenance", subCategory: "HVAC", equipmentType: "Air conditioning", repeat: { mode: "interval", months: 6 },
    checklist: ["Filters cleaned or replaced", "Coils and condensate drains cleaned", "Refrigerant leak check done, F-gas log updated", "Operating temperatures recorded"],
    note: "Commonly 3–6 monthly. Mandatory F-gas leak-check frequency depends on the refrigerant charge (CO₂e)." },
  { id: "t-lift-loler", name: "Passenger lift — LOLER thorough examination", serviceCategory: "maintenance", subCategory: "Lifts", equipmentType: "Passenger lift", repeat: { mode: "interval", months: 6 },
    checklist: ["Thorough examination completed by competent person", "Report received", "Defects actioned"],
    note: "LOLER: lifts carrying people need a thorough examination at least every 6 months (separate from routine maintenance)." },
  { id: "t-tr19", name: "Kitchen extract cleaning (TR19)", serviceCategory: "catering", subCategory: "Kitchen extract", equipmentType: "Canopy & ductwork", repeat: { mode: "interval", months: 6 },
    checklist: ["Canopy, filters and ductwork cleaned", "Grease thickness recorded before and after", "Access panels checked", "Post-clean certificate and photos received"],
    note: "TR19 Grease: typically 3, 6 or 12-monthly depending on daily hours of cooking." },
  { id: "t-catering-equip", name: "Catering equipment service", serviceCategory: "catering", subCategory: "Kitchen equipment", equipmentType: "Kitchen appliances", repeat: { mode: "interval", months: 6 },
    checklist: ["Appliances safety-checked", "Gas interlock tested (if fitted)", "Fridge / freezer seals and temperatures checked", "Service report received"],
    note: "Commonly 6-monthly; gas appliances also need an annual gas safety check." },
  { id: "t-window", name: "Window cleaning", serviceCategory: "cleaning", subCategory: "Windows", equipmentType: "Glazing", repeat: { mode: "interval", months: 1 },
    checklist: ["Internal glazing cleaned", "External glazing cleaned", "Frames and sills wiped", "Signed off by site contact"], note: "Frequency is a site choice — monthly is common for offices." },
  { id: "t-deepclean", name: "Deep clean", serviceCategory: "cleaning", subCategory: "Periodic", equipmentType: "Whole site", repeat: { mode: "interval", months: 3 },
    checklist: ["High-level dusting", "Carpets / floors deep cleaned", "Washrooms descaled", "Kitchen deep cleaned", "Snag list completed"], note: "Quarterly is typical for offices." },
  { id: "t-pest", name: "Pest control", serviceCategory: "cleaning", subCategory: "Pest control", equipmentType: "Bait stations", repeat: { mode: "custom", count: 8 },
    checklist: ["Bait / monitoring stations inspected", "Activity recorded", "Proofing recommendations noted", "Visit report received"], note: "Contracts commonly specify around 8 routine visits a year." },
  { id: "t-gutters", name: "Gutter & roof drain clearing", serviceCategory: "maintenance", subCategory: "Building fabric", equipmentType: "Gutters", repeat: { mode: "interval", months: 6 },
    checklist: ["Gutters cleared", "Downpipes and outlets flowing", "Roof drains cleared", "Defects photographed"], note: "Typically spring and autumn." },
];

/* ---------------------------------------------------------
   Settings: categories, custom fields, templates
--------------------------------------------------------- */
export const COLOR_CHOICES = ["#2B7A78", "#2B4562", "#8E4585", "#B7791F", "#C05621", "#2F855A", "#C53030", "#5B6672", "#3182CE", "#805AD5"];

// Legionella control (HSG274): hot water should reach 50°C+ within a minute, cold should be below 20°C
// within two minutes; thermostatic mixing valves typically deliver 38–46°C.
export const WATER_LIMITS = {
  hot: { label: "Hot", ok: (t) => t >= 50, rule: "50°C or above" },
  cold: { label: "Cold", ok: (t) => t < 20, rule: "below 20°C" },
  tmv: { label: "Mixed (TMV)", ok: (t) => t >= 38 && t <= 46, rule: "38–46°C" },
};
export const TRAINING_COURSES = ["First Aid at Work", "Emergency First Aid at Work", "Fire marshal / warden", "IOSH Managing Safely", "Asbestos awareness", "Legionella awareness", "Working at height", "Manual handling", "Mental health first aid", "Other"];
export const DRILL_TYPES = ["Fire evacuation", "Bomb threat / suspicious package", "Invacuation / lockdown", "Other"];
export const HOME_CARDS = [
  ["notices", "Team noticeboard"], ["today", "Today"], ["week", "Week ahead"], ["recent", "Recently viewed"], ["overdueSup", "Overdue by supplier"], ["weather", "Weather"], ["oncall", "On call"], ["siteprofile", "Site profile & people"], ["keydates", "Key dates"], ["pinned", "Pinned services"], ["siteinfo", "Site information"], ["spend", "Spend & forecast"], ["assigned", "Assigned to you"], ["emergency", "Emergency contacts"], ["reminders", "Reminders"],
  ["contractors", "Contractors on site"], ["attention", "Needs attention"], ["upcoming", "Coming up"], ["statutory", "Statutory compliance"],
  ["late", "Late visits"], ["activity", "Recent activity"],
];

// Asset condition (RICS-style A–D) and how critical an asset is to the building.
export const CONDITION_GRADES = {
  A: { label: "A — Good", color: "#2F855A", bg: "#EAF4EE", note: "Performing as intended, no issues" },
  B: { label: "B — Satisfactory", color: "#2B6CB0", bg: "#EAF1F8", note: "Minor wear, no action needed yet" },
  C: { label: "C — Poor", color: "#B7791F", bg: "#FDF1E0", note: "Defects; repair or plan replacement" },
  D: { label: "D — Bad", color: "#C53030", bg: "#FBEAEA", note: "Failed or about to fail; act now" },
};
export const CRITICALITY = {
  critical: { label: "Critical", rank: 0, color: "#C53030", note: "Failure stops the building or is a safety risk" },
  high: { label: "High", rank: 1, color: "#B7791F", note: "Failure causes major disruption" },
  normal: { label: "Normal", rank: 2, color: "#5B6672", note: "" },
};
export const VAT_RATES = [20, 5, 0];
export const SKIP_REASONS = ["Not needed this time (seasonal / low use)", "Equipment out of use", "Covered by another visit", "Area closed", "Client decision / budget", "Other"];
export const CONTACT_TYPES = { call: "Phone call", email: "Email", meeting: "Meeting", site: "Site visit", other: "Other" };

// England & Wales bank holidays (check gov.uk/bank-holidays each year).
export const UK_BANK_HOLIDAYS = [
  ["2026-01-01", "New Year's Day"], ["2026-04-03", "Good Friday"], ["2026-04-06", "Easter Monday"], ["2026-05-04", "Early May bank holiday"],
  ["2026-05-25", "Spring bank holiday"], ["2026-08-31", "Summer bank holiday"], ["2026-12-25", "Christmas Day"], ["2026-12-28", "Boxing Day (substitute)"],
  ["2027-01-01", "New Year's Day"], ["2027-03-26", "Good Friday"], ["2027-03-29", "Easter Monday"], ["2027-05-03", "Early May bank holiday"],
  ["2027-05-31", "Spring bank holiday"], ["2027-08-30", "Summer bank holiday"], ["2027-12-27", "Christmas Day (substitute)"], ["2027-12-28", "Boxing Day (substitute)"],
];
export const SUPPLIER_STATUSES = {
  approved: { label: "Approved", color: "#2F855A" },
  probation: { label: "On probation", color: "#B7791F" },
  blocked: { label: "Do not use", color: "#C53030" },
};
export const DOC_TYPES = ["Fire risk assessment", "Fire strategy / evacuation plan", "Asbestos register & survey", "Legionella risk assessment", "EICR (electrical) certificate", "Gas safety certificate", "Lift thorough examination (LOLER) report", "Pressure systems written scheme", "EPC / DEC", "Building insurance", "O&M manuals", "As-built drawings", "Health & safety file", "Lease / landlord documents", "Other"];

export const WHATS_NEW = [
  ["Approving quotes is its own permission", "Quotes over the approval limit can only be approved by finance or by someone an admin has ticked as \"Approves quotes\" (More → Team & access). Editing a job never approves it, and a quote raised after approval goes back for approval."],
  ["Engineers work on assets, managers shape them", "Engineers log visits, inspections, readings, problems and photos on assets, but only FM managers, coordinators and admins add, delete or restructure them."],
  ["One system for the whole site", "The app is now organised into nine areas — Home, Operations, Assets, People, Compliance & Safety, Commercial, Resources, Reports and More. Everything you had before is still there, just grouped by what it's for."],
  ["Home shows what needs attention", "Critical items first, then today, site health, money and the week ahead. Engineers, finance and senior managers each get their own version."],
  ["Site health score", "A score out of 100 for maintenance, compliance, safety, assets, suppliers and finance. Tap any score to see exactly how it was worked out."],
  ["Buildings, floors and rooms", "Assets → Locations: portfolio, site, building, floor, room and asset, with everything connected at each level."],
  ["Compliance register", "One red/amber/green list of every statutory service, check, inspection, certificate, insurance and licence."],
  ["New roles", "FM manager, coordinator, engineer, finance and senior management, each limited by the database to the data they work with."],
  ["Logins & team access", "Everyone signs in with their own email. Your company's data is only visible to people you invite — with a role (FM manager, coordinator, engineer, finance, senior management or viewer) enforced by the database (More → Team & access)."],
  ["Private photo storage", "Photos, certificates and signatures are kept in private file storage, shown only to your team. Backups still include them."],
  ["Site information", "Address, opening hours, access and site contact on Home — added to work orders and booking emails automatically."],
  ["Bookings", "Email the supplier to confirm a booking, and add it to your own calendar."],
  ["Week ahead", "A seven-day view on Home of visits, bookings, permits and reminders."],
  ["Parts used", "Record spares used on a visit and the stock comes down automatically."],
  ["Photos", "Up to four photos on visits and incidents."],
  ["Recently deleted", "Deleted services, works and suppliers can be restored for 30 days (More → Deleted items)."],
  ["Works", "Request approval by email, attach links, and turn a work into a project."],
  ["Projects timeline", "See projects as bars across the months."],
  ["Training matrix", "People against courses, green / amber / red at a glance."],
  ["Supplier review pack", "Print a pack for monthly contractor meetings."],
  ["Portfolio report", "Compare every site side by side."],
  ["Meters", "Yearly consumption targets and importing readings from a spreadsheet."],
  ["Statutory register", "Add your own requirements to the register."],
];
export const HELP_TOPICS = [
  ["How it's organised", "Nine areas: Home (what needs attention), Operations (maintenance, jobs, schedule, projects, checks), Assets (buildings, rooms, asset register, meters), People (on site, suppliers, team), Compliance & Safety (register, incidents, permits, water, fire, training…), Commercial (budget, approvals, POs, invoices, contracts), Resources (spares, keys, documents, waste), Reports and More (settings and admin)."],
  ["Getting started", "Add suppliers (People), then assets and their planned maintenance (Operations → Planned maintenance, or import a spreadsheet). Add buildings and rooms under Assets → Locations — “Organise into rooms” uses the Area already on your assets."],
  ["Logging a visit", "Operations → Planned maintenance → Log visit (or scan the asset's QR code). Tick checklist items, add cost, photos, certificate and sign-off. Each failed check creates a follow-up job."],
  ["Site health", "Home and Reports → Site health. Six scores out of 100; tap one to see every point added or taken away."],
  ["Compliance register", "Compliance & Safety → Compliance register: every statutory service, check, inspection, certificate, insurance and licence as red, amber or green, with the reason."],
  ["Reactive works", "Operations → Reactive works: raise a job against an asset. Target dates come from priority. Quotes over your approval limit wait in Commercial → Overview & approvals."],
  ["Budgets and money", "Commercial → Overview shows budget, committed, spent, remaining and forecast; Budget holds the plan; POs & invoices tracks purchase orders and supplier invoices."],
  ["Roles", "With logins, each person has a role (FM manager, coordinator, engineer, finance, senior management, viewer) and the database only lets them change what that role covers. More → Team & access."],
  ["Live or this device only", "The chip at the top shows where your data is: Live (company database), Offline (changes waiting to upload) or This device only (no database — back up regularly)."],
  ["Backups", "More → Backup & restore downloads everything in one file. Restore replaces all data with a backup."],
  ["Recently deleted", "More → Deleted items lists records removed in the last 30 days; tap Restore to bring one back."],
  ["Reports", "Reports: the monthly FM report (PDF, CSV or Excel) plus compliance pack, spend, asset register, condition survey, job sheet and more."],
  ["Keyboard shortcuts", "/ search · N new service · H Home · S maintenance · W works · A notifications · ? help · Esc close."],
];

export const WORK_CATEGORIES = ["Plumbing", "Electrical", "HVAC / mechanical", "Fabric & building", "Doors, locks & glazing", "Lifts", "Fire & security", "Grounds & external", "Cleaning", "Catering equipment", "IT / AV", "Other"];
export const SAVING_TYPES = { negotiated: "Negotiated price", avoided: "Cost avoided", energy: "Energy / utilities", rebate: "Rebate / credit", other: "Other" };
// Ready-made site logs. Field types: text, number, date, select, check, callpoint (fire alarm rotation).
export const LOG_TEMPLATES = [
  { id: "firealarm", name: "Fire alarm weekly test", icon: "bell", everyDays: 7, fields: [
    { key: "callpoint", label: "Call point tested", type: "callpoint" }, { key: "zone", label: "Zone", type: "text" },
    { key: "sounders", label: "Sounders heard throughout", type: "check" }, { key: "panel", label: "Panel reset & normal", type: "check" },
    { key: "notes", label: "Faults / notes", type: "text" }] },
  { id: "pest", name: "Pest control", icon: "bug", everyDays: 0, fields: [
    { key: "kind", label: "Type", type: "select", options: ["Sighting", "Contractor visit", "Bait check", "Treatment"] },
    { key: "pest", label: "Pest", type: "select", options: ["Mice", "Rats", "Insects", "Birds", "Other"] },
    { key: "area", label: "Where", type: "text" }, { key: "action", label: "Action taken", type: "text" }] },
  { id: "gritting", name: "Winter gritting", icon: "snowflake", everyDays: 0, fields: [
    { key: "areas", label: "Areas gritted", type: "text" }, { key: "salt", label: "Salt used (kg)", type: "number" },
    { key: "temp", label: "Air temp (°C)", type: "number" }, { key: "time", label: "Time", type: "text" }] },
  { id: "ooh", name: "Out-of-hours call-outs", icon: "phone", everyDays: 0, fields: [
    { key: "time", label: "Time called", type: "text" }, { key: "issue", label: "Issue", type: "text" },
    { key: "attended", label: "Who attended", type: "text" }, { key: "cost", label: "Cost (£)", type: "number" }, { key: "followup", label: "Follow-up needed", type: "check" }] },
  { id: "emlight", name: "Emergency lighting monthly test", icon: "bulb", everyDays: 31, fields: [
    { key: "circuit", label: "Area / circuit", type: "text" }, { key: "tested", label: "Fittings tested", type: "number" },
    { key: "allok", label: "All fittings lit on test", type: "check" }, { key: "failed", label: "Failed fittings (where)", type: "text" }] },
  { id: "generator", name: "Generator test run", icon: "zap", everyDays: 31, fields: [
    { key: "minutes", label: "Run time (minutes)", type: "number" }, { key: "fuel", label: "Fuel level (%)", type: "number" },
    { key: "onload", label: "Tested on load", type: "check" }, { key: "faults", label: "Faults / alarms", type: "text" }] },
  { id: "flushing", name: "Weekly water flushing (little-used outlets)", icon: "droplet", everyDays: 7, fields: [
    { key: "outlets", label: "Outlets flushed", type: "text" }, { key: "minutes", label: "Minutes each", type: "number" },
    { key: "showers", label: "Shower heads descaled / checked", type: "check" }, { key: "notes", label: "Notes", type: "text" }] },
  { id: "opening", name: "Daily opening checks", icon: "sun", everyDays: 1, fields: [
    { key: "exits", label: "Fire exits clear & unlocked", type: "check" }, { key: "panel", label: "Fire panel normal", type: "check" },
    { key: "lifts", label: "Lifts working", type: "check" }, { key: "lighting", label: "Lighting & heating OK", type: "check" }, { key: "notes", label: "Issues found", type: "text" }] },
  { id: "aed", name: "Defibrillator (AED) weekly check", icon: "heart", everyDays: 7, fields: [
    { key: "location", label: "AED location", type: "text" }, { key: "ready", label: "Status light shows ready", type: "check" },
    { key: "pads", label: "Pads in date (note expiry)", type: "text" }, { key: "kit", label: "Rescue kit present (razor, gloves, scissors)", type: "check" }] },
  { id: "extinguishers", name: "Fire extinguisher monthly visual check", icon: "flame", everyDays: 31, fields: [
    { key: "area", label: "Area / floor", type: "text" }, { key: "inplace", label: "All in place & visible", type: "check" },
    { key: "pressure", label: "Gauges in the green / pins & tags intact", type: "check" }, { key: "issues", label: "Missing or discharged (where)", type: "text" }] },
  { id: "lostproperty", name: "Lost property", icon: "box", everyDays: 0, fields: [
    { key: "item", label: "Item", type: "text" }, { key: "found", label: "Where found", type: "text" }, { key: "foundBy", label: "Found by", type: "text" },
    { key: "stored", label: "Stored in", type: "text" }, { key: "returned", label: "Returned to owner (name / date)", type: "text" }] },
  { id: "toilets", name: "Toilet & washroom checks", icon: "droplet", everyDays: 1, fields: [
    { key: "area", label: "Washroom", type: "text" }, { key: "clean", label: "Clean & dry", type: "check" },
    { key: "consumables", label: "Soap, paper & towels stocked", type: "check" }, { key: "working", label: "All taps, flushes & dryers working", type: "check" }, { key: "issues", label: "Issues", type: "text" }] },
  { id: "deliveries", name: "Deliveries & post", icon: "box", everyDays: 0, fields: [
    { key: "from", label: "From / courier", type: "text" }, { key: "for", label: "For (person / team)", type: "text" },
    { key: "items", label: "Items", type: "number" }, { key: "collected", label: "Collected by (name / time)", type: "text" }] },
  { id: "roof", name: "Roof & gutter inspection", icon: "home", everyDays: 92, fields: [
    { key: "gutters", label: "Gutters & outlets clear", type: "check" }, { key: "covering", label: "Roof covering sound", type: "check" },
    { key: "access", label: "Access & edge protection OK", type: "check" }, { key: "issues", label: "Issues found", type: "text" }] },
  { id: "firstaid", name: "First aid kit checks", icon: "cross", everyDays: 31, fields: [
    { key: "kit", label: "Kit / location", type: "text" }, { key: "complete", label: "Contents complete", type: "check" },
    { key: "expired", label: "Expired items replaced", type: "check" }, { key: "notes", label: "Items needed", type: "text" }] },
];

export const JOB_TEMPLATES = [
  { description: "Replace failed lamp / LED fitting", priority: "low", category: "Electrical" },
  { description: "Blocked toilet / drain", priority: "high", category: "Plumbing" },
  { description: "Leaking tap or pipe", priority: "medium", category: "Plumbing" },
  { description: "Door closer needs adjusting", priority: "low", category: "Doors, locks & glazing" },
  { description: "Lock / access control fault", priority: "high", category: "Doors, locks & glazing" },
  { description: "Stained or damaged ceiling tile", priority: "low", category: "Fabric & building" },
  { description: "Radiator not heating", priority: "medium", category: "HVAC / mechanical" },
  { description: "Air con not cooling", priority: "medium", category: "HVAC / mechanical" },
  { description: "Lift out of service", priority: "high", category: "Lifts" },
];
export const ACCENTS = {
  navy: { label: "Navy", light: "#2B5D8A", dark: "#7FB3E8" },
  teal: { label: "Teal", light: "#1F7A75", dark: "#5CC8C2" },
  green: { label: "Green", light: "#2F7D4A", dark: "#6FD69C" },
  purple: { label: "Purple", light: "#6941C6", dark: "#B9A4F5" },
  orange: { label: "Orange", light: "#B54708", dark: "#F7B267" },
};
export const ASBESTOS_MATERIALS = ["Ceiling tiles", "Pipe / boiler lagging", "Floor tiles / adhesive", "Textured coating (Artex)", "AIB board / panels", "Cement sheet / roofing", "Gaskets / rope seals", "Other"];
export const RENEWAL_STEPS = ["Review supplier performance", "Decide: renew or re-tender", "Get quotes / negotiate", "Approve budget & supplier", "Issue new contract / PO"];

// Which alerts belong to which group (for Display → Alerts to show).
export const ALERT_GROUPS = {
  services: { label: "Services & visits", prefixes: ["od-", "ds-", "nb-", "cm-", "down-", "rf-", "rp-", "we-", "ws-", "bo-"] },
  works: { label: "Works & projects", prefixes: ["sla-", "qx-", "pj", "rq-", "oq-", "ap-"] },
  finance: { label: "Budgets & invoices", prefixes: ["ivd-", "iva-", "pov-", "bg-"] },
  suppliers: { label: "Suppliers & contracts", prefixes: ["fu-", "ob-", "wl", "cr-", "ce-", "insuranceExpiry", "accreditationExpiry"] },
  safety: { label: "Site safety & compliance", prefixes: ["rid-", "inc-", "ptw-", "wt", "tr-", "trs-", "drill-", "asb", "doc", "log-", "aud-", "ndr-", "reqtr-"] },
  site: { label: "Meters, stock & keys", prefixes: ["mr-", "mt-", "sp-", "ky-"] },
  reminders: { label: "Reminders", prefixes: ["rm-"] },
};
export function alertGroup(key) {
  const k = String(key || "");
  for (const [g, v] of Object.entries(ALERT_GROUPS)) if (v.prefixes.some((p) => k.startsWith(p))) return g;
  return "services";
}
export const START_TABS = { last: "Where I left off", home: "Home", devices: "Planned maintenance", schedule: "Schedule", works: "Reactive works", meters: "Compliance register", "assets.register": "Asset register", "money.overview": "Commercial" };

export const ACTION_SOURCES = ["Fire risk assessment", "Legionella risk assessment", "Health & safety audit", "Insurance survey", "Asbestos survey", "Site audit", "Incident", "Other"];
export const SPACE_USES = ["Office", "Meeting room", "Reception", "Kitchen / tea point", "Toilets / washrooms", "Plant room", "Store", "Corridor / circulation", "Server / comms room", "Car park", "External", "Other"];
export const INVESTIGATION_STEPS = ["Area made safe", "First aid given / injured person cared for", "Witnesses identified", "Photos taken", "CCTV preserved", "Statements taken", "RIDDOR decision recorded", "Risk assessment reviewed", "Lessons shared with the team"];

export const SITE_TYPES = ["Office", "Warehouse / distribution", "Retail", "Industrial / manufacturing", "Data centre", "Laboratory", "School / education", "Healthcare", "Residential", "Mixed use", "Other"];
export const STAFF_ROLES = ["Site manager", "Facilities manager", "Facilities coordinator", "Engineer", "Technician", "Electrician", "Plumber", "Handyperson", "Security", "Cleaner", "Receptionist", "Health & safety", "Other"];

export const KEY_DATE_TYPES = ["Lease break", "Rent review", "Lease expiry", "Insurance renewal", "Licence / permit expiry", "Contract notice date", "Statutory filing", "Other"];
export const COSHH_HAZARDS = ["Flammable", "Corrosive", "Toxic", "Harmful / irritant", "Oxidising", "Environmental hazard", "Gas under pressure", "Health hazard (long-term)"];
export const EQUIPMENT_TYPES = { ladder: { label: "Ladders & steps", months: 3 }, harness: { label: "Harnesses & fall arrest", months: 6 }, lifting: { label: "Lifting equipment (LOLER)", months: 12 }, pat: { label: "Portable appliances (PAT)", months: 12 }, extinguisher: { label: "Fire extinguishers", months: 12 }, ppe: { label: "PPE / RPE", months: 6 }, fireDoor: { label: "Fire doors", months: 6 }, emLight: { label: "Emergency light fittings", months: 12 }, tools: { label: "Power tools", months: 12 }, other: { label: "Other", months: 12 } };
export const CLEANING_FREQ = { daily: "Daily", "twice-weekly": "Twice weekly", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", quarterly: "Quarterly" };
export const REQUEST_CATEGORIES = [["Too hot", "Too hot", "medium"], ["Too cold", "Too cold", "medium"], ["Lights out", "Lights not working", "low"], ["Leak", "Water leak", "high"], ["Toilet / drain", "Toilet or drain blocked", "high"], ["Door / lock", "Door or lock not working", "medium"], ["Cleaning", "Needs cleaning", "low"], ["Damage", "Something is damaged", "medium"], ["Smell", "Strange smell", "high"], ["Other", "", "medium"]];

export const SHUTDOWN_TYPES = ["Power", "Water", "Gas", "Heating / hot water", "Air conditioning", "Lifts", "Fire alarm", "Access / doors", "IT / network", "Other"];
export const ISOLATION_KINDS = ["Water stopcock", "Gas emergency valve", "Main electrical isolator", "Distribution board", "Fire alarm panel", "Sprinkler / riser valve", "Fuel / oil shut-off", "Lift motor room", "Other"];

// Shown in Settings and the Budget page so it is easy to see which version is running.
export const APP_VERSION = "2026-10-09 · round 30.2 (FMOS phase 1 — for review)";
// The product's name, shown in the app, on reports and in invite emails — change it here.
export const PRODUCT_NAME = "Service Book";
export const PRODUCT_TAGLINE = "Facilities management OS";

// Typical UK service frequencies (months between visits) by service name — a starting point, not a rule.
export const FREQ_HINTS = [
  [/emergency light/i, 12, "Annual 3-hour duration test (BS 5266); monthly flick tests in-house"],
  [/fire alarm/i, 6, "Six-monthly service (BS 5839-1); weekly call-point test in-house"],
  [/extinguisher/i, 12, "Annual service (BS 5306-3)"],
  [/sprinkler/i, 3, "Quarterly inspection; weekly checks in-house"],
  [/dry riser|wet riser/i, 6, "Six-monthly visual; annual pressure test"],
  [/fire door/i, 6, "Six-monthly inspection is common practice"],
  [/fire risk assessment/i, 12, "Review at least annually"],
  [/\blift\b|elevator|escalator/i, 6, "Thorough examination every 6 months for passenger lifts (LOLER)"],
  [/boiler|gas safety|gas appliance/i, 12, "Annual gas safety service"],
  [/\bahu\b|air handling/i, 3, "Quarterly filter change and checks"],
  [/chiller|air con|a\/c|split unit|vrf|vrv/i, 6, "Six-monthly service; F-gas leak checks by charge size"],
  [/legionella|water risk/i, 24, "Review the water risk assessment at least every 2 years (ACoP L8)"],
  [/water tank|cold water storage/i, 6, "Six-monthly tank inspection (L8)"],
  [/\btmv\b|thermostatic mixing/i, 12, "Annual TMV service"],
  [/\bpat\b|portable appliance/i, 12, "Annual is typical for offices"],
  [/eicr|fixed wire|electrical installation/i, 60, "EICR every 5 years for commercial premises (BS 7671)"],
  [/lightning/i, 12, "Annual test (BS EN 62305)"],
  [/generator/i, 3, "Quarterly service; monthly run test in-house"],
  [/\bups\b/i, 12, "Annual service"],
  [/kitchen extract|grease duct|ductwork clean/i, 6, "TR19 cleaning every 3–12 months depending on use"],
  [/fall arrest|mansafe|roof anchor/i, 12, "Annual inspection (BS 7883)"],
  [/ladder/i, 6, "Six-monthly inspection"],
  [/asbestos/i, 12, "Annual re-inspection of asbestos-containing materials"],
  [/gutter/i, 6, "Twice a year — spring and autumn"],
  [/roller shutter|automatic door|gate/i, 6, "Six-monthly service"],
  [/pest/i, 1, "Monthly visits are common"],
  [/window clean/i, 1, "Monthly or quarterly depending on site"],
];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
