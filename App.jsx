import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Wrench, Calendar, FileCheck, Receipt, Plus, X, Camera,
  MapPin, ChevronRight, ChevronLeft, ChevronDown, CheckCircle2, Clock,
  Trash2, Tag, Download, Search, Loader2, Globe2, Building2,
  User, Users as UsersIcon, PoundSterling, Sparkles, Soup, SprayCan,
  ShieldAlert, PieChart, Pencil, RefreshCw, SlidersHorizontal, Flame, Zap, Leaf, Droplets, QrCode, Printer, Gauge, Send, Mail, Bell, FileText, History, Undo2, Copy, Upload, AlertTriangle, HardDrive, Star, HardHat, ArrowUpDown, KeyRound,
  LayoutDashboard, Phone, Archive, ArchiveRestore, CheckSquare, Square, StickyNote, CalendarCheck, ClipboardList, Timer,
  BellOff, LogIn, LogOut, Activity, ScrollText, CopyPlus, Smartphone,
  Package, Key, Link2, ListTodo, Type, MoreHorizontal, Leaf as LeafIcon, ImagePlus,
  FileSpreadsheet, ClipboardCheck, Siren, FolderKanban, Moon, Repeat, MapPinned,
  Cloud, CloudOff, PauseCircle, Ban, Rocket, TrendingUp,
  Recycle, PhoneCall, BookOpen, UserCheck, Lock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ---------------------------------------------------------
   Storage helpers
   Organisation data (countries/locations/devices/services/
   works/suppliers/budgets/users) is SHARED — everyone using
   this app sees the same records. Only "which profile is
   active on this device" is kept personal.
--------------------------------------------------------- */
const SKEYS = {
  users: "org:users", countries: "org:countries", locations: "org:locations",
  devices: "org:devices", services: "org:services", works: "org:works",
  suppliers: "org:suppliers", budgets: "org:budgets", budgetLines: "org:budgetLines",
  deviceTasks: "org:deviceTasks", visitBudgets: "org:visitBudgets", settings: "org:settings",
  activity: "org:activity",
  meters: "org:meters", meterReadings: "org:meterReadings", signins: "org:signins",
  spares: "org:spares", keys: "org:keys", reminders: "org:reminders",
  audits: "org:audits", incidents: "org:incidents", projects: "org:projects",
  permits: "org:permits", waste: "org:waste",
};
let ACTIVE_USERS = []; // team members, for "assign to" pickers
const PERMIT_PRECAUTIONS = {
  "Hot works": ["Fire extinguisher at the work area", "Combustibles removed or protected", "Detector heads isolated only if agreed (note which)", "Fire watch for 60 minutes after work ends"],
  "Working at height": ["Access equipment inspected and suitable", "Area below cordoned off", "Weather / wind checked", "Harness and anchor where required"],
  "Confined space": ["Atmosphere tested before entry", "Rescue plan and equipment in place", "Standby person outside", "Ventilation provided"],
  "Electrical isolation": ["Circuit isolated and locked off", "Proved dead at point of work", "Warning signs posted", "Key held by person doing the work"],
  "Asbestos check": ["Asbestos register checked for this area", "Area confirmed free of ACMs or managed", "Workers briefed on findings"],
  "Roof access": ["Access route agreed", "Edge protection or fall arrest in place", "No lone working", "Weather checked"],
};
const WASTE_STREAMS = { general: "General waste", mixed: "Mixed recycling", cardboard: "Cardboard", food: "Food waste", glass: "Glass", paper: "Confidential paper", weee: "WEEE (electrical)", hazardous: "Hazardous" };
const DEFAULT_EMERGENCY = [
  { label: "Gas emergency (National Gas)", phone: "0800 111 999" },
  { label: "Power cut (any network)", phone: "105" },
  { label: "Water supplier — leaks", phone: "" },
  { label: "Fire alarm maintenance company", phone: "" },
  { label: "Lift engineer / call-out", phone: "" },
  { label: "Out-of-hours key holder", phone: "" },
  { label: "Security / alarm monitoring", phone: "" },
];
const DEFAULT_AUDIT_TEMPLATES = [
  { id: "cleaning", name: "Cleaning audit", items: ["Floors & carpets", "Desks & work surfaces", "Kitchen / tea points", "Toilets & washrooms", "Consumables stocked (soap, paper)", "Bins emptied", "Glass, mirrors & high touch points", "Entrance & reception"] },
  { id: "washroom", name: "Washroom check", items: ["Floors clean & dry", "Toilets & urinals clean", "Basins & taps clean", "Soap & paper stocked", "Sanitary bins serviced", "No odours"] },
  { id: "walkround", name: "FM site walk-round", items: ["Fire exits clear", "Emergency lighting working", "Fire extinguishers in place", "Lighting working", "No trip hazards", "Plant rooms locked & tidy", "External areas & bins tidy", "Signage in place"] },
];
const INCIDENT_TYPES = { near_miss: "Near miss", injury: "Injury", property: "Property damage", environmental: "Environmental / spill", security: "Security", other: "Other" };
const PROJECT_STATUSES = [
  { key: "idea", label: "Proposed", color: "#5B6672" }, { key: "approved", label: "Approved", color: "#2B6CB0" },
  { key: "in_progress", label: "In progress", color: "#D97706" }, { key: "on_hold", label: "On hold", color: "#8A94A0" }, { key: "complete", label: "Complete", color: "#2F855A" },
];
const REPEAT_OPTIONS = { none: "Doesn't repeat", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
// Improvement: saves no longer fail silently — MainApp registers a listener that shows a warning banner.
let SAVE_STATUS_LISTENER = null;
let LAST_LOCAL_WRITE = 0; // used to avoid pulling shared data straight after our own save
const PKEYS = { nav: "me:nav", snooze: "me:snooze", display: "me:display" };
// Documents a supplier should provide before starting work on site.
const ONBOARDING_ITEMS = ["Public liability insurance", "Employer's liability insurance", "Health & safety policy", "Generic RAMS / method statements", "Trade accreditations (Gas Safe, NICEIC…)", "Signed contract / terms", "Bank details verified", "Site induction completed"];
let AREA_SUGGESTIONS_CACHE = {}; // locationId -> areas already used, for the Area field autocomplete
// Approximate UK carbon factors (kgCO2e per unit) — editable per meter.
const DEFAULT_CO2 = { electricity: 0.207, gas: 2.04, water: 0.34, other: 0 };
// A plan line whose actual was copied from a logged visit: the visit already counts as spend,
// so spend totals skip the line to avoid counting the same money twice.
const isMirrored = (l) => l && l.actualSource === "visit";

async function loadShared(key) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : []; }
  catch (e) { return []; }
}
async function saveShared(key, list) {
  try {
    LAST_LOCAL_WRITE = Date.now();
    const r = await window.storage.set(key, JSON.stringify(list), true);
    if (r === null) throw new Error("storage returned null");
    SAVE_STATUS_LISTENER && SAVE_STATUS_LISTENER(key, true);
  }
  catch (e) { console.error("shared save failed", e); SAVE_STATUS_LISTENER && SAVE_STATUS_LISTENER(key, false, e); }
}
async function loadPersonal(key, fallback) {
  try { const r = await window.storage.get(key, false); return r ? JSON.parse(r.value) : fallback; }
  catch (e) { return fallback; }
}
async function savePersonal(key, val) {
  try { await window.storage.set(key, JSON.stringify(val), false); }
  catch (e) { console.error("personal save failed", e); }
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
// Permits a job can need before work starts (UK FM practice).
const PERMIT_TYPES = ["Hot works", "Working at height", "Confined space", "Electrical isolation", "Asbestos check", "Roof access"];
// Target days to complete reactive works, by priority.
const SLA_DAYS = { high: 1, medium: 7, low: 28 };
function workSla(w) {
  if (!w?.dateRaised || w.status === "rejected") return null;
  const days = SLA_DAYS[w.priority || "medium"] ?? 7;
  const deadline = addDays(w.dateRaised, days);
  const today = new Date().toISOString().slice(0, 10);
  if (w.status === "completed") return { deadline, done: true, breached: !!w.completedAt && w.completedAt > deadline };
  return { deadline, done: false, breached: today > deadline, dueSoon: today <= deadline && today >= addDays(deadline, -1) };
}
// UK statutory / best-practice inspections a site is usually expected to have in place.
const STATUTORY_ITEMS = [
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
function matchStatutory(item, d) {
  const hay = ` ${[d.name, d.category, d.subCategory].filter(Boolean).join(" ").toLowerCase()} `;
  return item.keywords.some((k) => k.length <= 3 ? new RegExp(`\\b${k}\\b`).test(hay) : hay.includes(k));
}
const LATE_REASONS = ["Supplier no-show", "Rescheduled by supplier", "Rescheduled by site", "No access to area", "Parts / equipment awaited", "Other"];
// A booking only counts for the visit that is currently due.
function currentBooking(d) { return d?.booking && d.booking.forDue === d.nextServiceDate ? d.booking : null; }
// Year an asset is due for replacement, from its install date and expected life.
function replacementYear(d) {
  if (!d?.installDate || !Number(d.expectedLifeYears)) return null;
  return Number(d.installDate.slice(0, 4)) + Number(d.expectedLifeYears);
}

/* ---------------------------------------------------------
   Formatting helpers
--------------------------------------------------------- */
const CURRENCIES = {
  GBP: { locale: "en-GB" }, EUR: { locale: "en-IE" }, USD: { locale: "en-US" },
  AUD: { locale: "en-AU" }, CAD: { locale: "en-CA" }, CHF: { locale: "de-CH" },
  INR: { locale: "en-IN" }, AED: { locale: "en-AE" },
};
// Set once per render from the selected country, then read by every gbp() call
// made while rendering that pass — see the note where it's assigned in App().
let ACTIVE_CURRENCY_CODE = "GBP";
// Same pattern — set once per render in App(), read by any button that should
// hide itself for a "viewer" profile. This is a UI convenience, NOT security:
// the underlying storage has no per-user write restriction, so a viewer could
// still call the storage API directly. See the note in the chat reply.
let ACTIVE_CAN_EDIT = true;
function gbp(amount) {
  const code = CURRENCIES[ACTIVE_CURRENCY_CODE] ? ACTIVE_CURRENCY_CODE : "GBP";
  return (Number(amount) || 0).toLocaleString(CURRENCIES[code].locale, { style: "currency", currency: code, maximumFractionDigits: 0 });
}
function toCSV(rows) {
  return rows.map((row) => row.map((cell) => {
    const s = String(cell ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
}
function csvHref(rows) {
  return "data:text/csv;charset=utf-8," + encodeURIComponent(toCSV(rows));
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function addMonths(dateStr, months) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}
function inBlackout(iso, blackouts) { return (blackouts || []).find((b) => iso >= b.start && iso <= b.end) || null; }
function isWeekend(iso) { const wd = new Date(iso + "T00:00:00").getDay(); return wd === 0 || wd === 6; }
// Move a date forward out of any blackout period (and off weekends if asked).
function shiftDate(iso, blackouts, avoidWeekends) {
  if (!iso) return iso;
  let d = iso;
  for (let i = 0; i < 400; i++) {
    const b = inBlackout(d, blackouts);
    if (b) { d = addDays(b.end, 1); continue; }
    if (avoidWeekends && isWeekend(d)) { d = addDays(d, 1); continue; }
    break;
  }
  return d;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / 86400000);
}
function dueStatus(dateStr, everServiced) {
  const d = daysUntil(dateStr);
  if (d === null) return everServiced ? { label: "Completed", tone: "ok" } : { label: "Not yet scheduled", tone: "muted" };
  if (d < 0) return { label: `Overdue ${Math.abs(d)}d`, tone: "danger" };
  if (d <= 30) return { label: `Due in ${d}d`, tone: "warn" };
  return { label: `Due in ${d}d`, tone: "ok" };
}
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toISODate(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}
// Returns a flat array of cells (Date or null for padding) for a Mon-start month grid.
function getMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ---------------------------------------------------------
   Image compression
--------------------------------------------------------- */
function compressImage(file, maxDim = 900, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------
   UI atoms
--------------------------------------------------------- */
const toneStyles = {
  ok: { bg: "#EAF4EE", fg: "#2F6B4A", dot: "#2F855A" },
  warn: { bg: "#FDF1E0", fg: "#8A5A0B", dot: "#D97706" },
  danger: { bg: "#FBEAEA", fg: "#9B2C2C", dot: "#C53030" },
  muted: { bg: "#EEF0F2", fg: "#5B6672", dot: "#8A94A0" },
};
const BUILTIN_CATEGORY_META = {
  cleaning: { label: "Cleaning", color: "#2B7A78", icon: SprayCan, iconName: "SprayCan" },
  maintenance: { label: "Maintenance", color: "#2B4562", icon: Wrench, iconName: "Wrench" },
  catering: { label: "Catering", color: "#8E4585", icon: Soup, iconName: "Soup" },
};
const CATEGORY_ICONS = { SprayCan, Wrench, Soup, Tag, Sparkles, ShieldAlert, Building2, Globe2, Flame, Zap, Leaf, Droplets };
// Live category list: the three built-ins (which can be renamed/recoloured) plus any custom ones.
// Rebuilt from settings on every render, like the active currency.
let CATEGORY_META = { ...BUILTIN_CATEGORY_META };
let CATEGORY_KEYS = Object.keys(CATEGORY_META);
let ACTIVE_CUSTOM_FIELDS = [];
let ACTIVE_TEMPLATES = [];
function applyCategorySettings(st) {
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
function emptyCatMap(init = 0) { return Object.fromEntries(CATEGORY_KEYS.map((k) => [k, typeof init === "function" ? init() : init])); }
function CategoryOptions() { return CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>); }

function Badge({ tone = "muted", children }) {
  const s = toneStyles[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: s.bg, color: s.fg, fontSize: 12.5, fontWeight: 600,
      padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {children}
    </span>
  );
}
function CategoryBadge({ category, subCategory }) {
  const m = CATEGORY_META[category] || CATEGORY_META.maintenance;
  const Icon = m.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, background: `${m.color}1A`, color: m.color,
      fontSize: 12, fontWeight: 650, padding: "4px 9px", borderRadius: 20,
    }}>
      <Icon size={12} /> {m.label}{subCategory ? ` · ${subCategory}` : ""}
    </span>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5 }}>
      <span style={{ fontWeight: 600, color: "#3A4451" }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = {
  border: "1px solid #D7DCE1", borderRadius: 8, padding: "9px 11px",
  fontSize: 14, fontFamily: "inherit", color: "#1B2430", background: "#fff", outline: "none",
};
function TextInput(props) { return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function TextArea(props) { return <textarea {...props} style={{ ...inputStyle, resize: "vertical", minHeight: 64, ...(props.style || {}) }} />; }
function Select(props) { return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>{props.children}</select>; }
let subcategoryDatalistSeq = 0;
function SubCategoryField({ value, onChange, suggestions }) {
  const listId = useMemo(() => `subcat-${++subcategoryDatalistSeq}`, []);
  return (
    <Field label="Subcategory (optional)">
      <TextInput list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Windows, Filters, Hot food" />
      <datalist id={listId}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </Field>
  );
}

function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-modal-open="1" style={{ position: "fixed", inset: 0, background: "rgba(20,26,33,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto",
        borderRadius: "16px 16px 0 0", padding: 20, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1B2430", fontFamily: "'IBM Plex Sans', sans-serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            <X size={17} color="#5B6672" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function PrimaryButton({ children, style, ...rest }) {
  return (
    <button {...rest} style={{
      background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px",
      fontSize: 14, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center",
      gap: 7, justifyContent: "center", fontFamily: "inherit", ...style,
    }}>{children}</button>
  );
}
function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1B2430", marginTop: 2 }}>{value}</div>
    </div>
  );
}
function EmptyState({ icon: Icon, title, body, actionLabel, onAction }) {
  return (
    <div style={{ background: "#fff", border: "1px dashed #D7DCE1", borderRadius: 14, padding: "40px 24px", textAlign: "center", marginTop: 20 }}>
      <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#EEF0F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <Icon size={20} color="#8A94A0" />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#8A94A0", maxWidth: 280, margin: "0 auto" }}>{body}</div>
      {actionLabel && <PrimaryButton onClick={onAction} style={{ margin: "16px auto 0" }}><Plus size={15} /> {actionLabel}</PrimaryButton>}
    </div>
  );
}
function StatusDot({ tone }) { const s = toneStyles[tone]; return <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />; }
function ConfirmDeleteButton({ onConfirm, size = 15 }) {
  const [confirming, setConfirming] = useState(false);
  if (!ACTIVE_CAN_EDIT) return null;
  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={onConfirm} style={{ background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 6, padding: "4px 8px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Delete</button>
        <button onClick={() => setConfirming(false)} style={{ background: "#EEF0F2", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 10.5, fontWeight: 700, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
      <Trash2 size={size} color="#C0C6CC" />
    </button>
  );
}
function ExportButton({ rows, filename, label = "Export CSV" }) {
  return (
    <a href={csvHref(rows)} download={filename} style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF0F2", color: "#2B4562",
      border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 650, textDecoration: "none",
    }}><Download size={13} /> {label}</a>
  );
}

/* ---------------------------------------------------------
   Main App
--------------------------------------------------------- */
function MainApp() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [services, setServices] = useState([]);
  const [works, setWorks] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [budgetLines, setBudgetLines] = useState([]);
  const [deviceTasks, setDeviceTasks] = useState([]);
  const [visitBudgets, setVisitBudgets] = useState([]);
  const [settings, setSettings] = useState({ approvalThreshold: 1000 });
  const [activity, setActivity] = useState([]);
  const [meters, setMeters] = useState([]);
  const [meterReadings, setMeterReadings] = useState([]);
  const [signins, setSignins] = useState([]);
  const [snoozed, setSnoozed] = useState({});
  const [spares, setSpares] = useState([]);
  const [keysList, setKeysList] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [display, setDisplay] = useState({ scale: 1 });
  const [audits, setAudits] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [worksView, setWorksView] = useState("reactive");
  const [permits, setPermits] = useState([]);
  const [waste, setWaste] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [saveErrors, setSaveErrors] = useState({}); // key -> message, for keys whose last save failed
  const [showAlerts, setShowAlerts] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [quickLog, setQuickLog] = useState(null); // null | { deviceId? }
  const [showScanner, setShowScanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedCountryId, setSelectedCountryId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  const [tab, setTab] = useState("home");
  const [listPrefs, setListPrefs] = useState({ dueFilter: "todo", sortBy: "due", cat: "all" });
  const [backupNagHidden, setBackupNagHidden] = useState(false);
  const [search, setSearch] = useState("");

  const [showUserModal, setShowUserModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAddCountry, setShowAddCountry] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(null); // countryId
  const [deviceModal, setDeviceModal] = useState(null); // { record? } — record present = editing; {} = adding new
  const [serviceModal, setServiceModal] = useState(null); // { deviceId, record? } — record present = editing
  const [historyFor, setHistoryFor] = useState(null); // deviceId — service history list
  const [addWorkFor, setAddWorkFor] = useState(null);
  const [supplierModal, setSupplierModal] = useState(null); // { record? } — record present = editing
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 7000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    SAVE_STATUS_LISTENER = (key, ok, err) => setSaveErrors((prev) => {
      if (ok) { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; }
      const quota = /quota/i.test(String(err?.name || err?.message || ""));
      return { ...prev, [key]: quota ? "Storage is full" : "Save failed" };
    });
    return () => { SAVE_STATUS_LISTENER = null; };
  }, []);
  // Dark mode: invert the page colours at the root (keeps fixed pop-ups positioned correctly).
  useEffect(() => {
    document.documentElement.classList.toggle("ppm-dark", !!display.dark);
  }, [display.dark]);
  // Remember the open tab and the Services list filters/sorting on this device.
  useEffect(() => {
    if (loading) return;
    savePersonal(PKEYS.nav, { currentUserId, selectedCountryId, selectedLocationId, tab, listPrefs });
  }, [tab, listPrefs]);
  // Keyboard shortcuts (desktop): "/" search, "n" new service.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target; const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[data-modal-open]")) return;
      if (e.key === "/") { e.preventDefault(); setShowSearch(true); }
      else if (e.key === "n" && ACTIVE_CAN_EDIT) { e.preventDefault(); setTab("devices"); setDeviceModal({}); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Every toast is also written to the shared activity log (who did what, when, where).
  const NO_LOG = new Set(["Set a budget per visit first", "Already up to date"]);
  function showToast(msg, detail) {
    setToast({ msg });
    if (!NO_LOG.has(msg)) logActivity(detail ? `${msg} — ${detail}` : msg);
  }
  function logActivity(text) {
    const entry = { id: uid(), at: new Date().toISOString(), by: currentUserRef.current || "Unknown", locationId: locationRef.current || null, text };
    setActivity((prev) => { const next = [entry, ...prev].slice(0, 500); saveShared(SKEYS.activity, next); return next; });
  }

  useEffect(() => {
    (async () => {
      const [u, c, l, d, s, w, sup, b, bl, dt, vb, nav, st, act, mt, mr, si, sn, sp, ky, rm, disp, au, inc, pr, pm, ws] = await Promise.all([
        loadShared(SKEYS.users), loadShared(SKEYS.countries), loadShared(SKEYS.locations),
        loadShared(SKEYS.devices), loadShared(SKEYS.services), loadShared(SKEYS.works),
        loadShared(SKEYS.suppliers), loadShared(SKEYS.budgets), loadShared(SKEYS.budgetLines),
        loadShared(SKEYS.deviceTasks), loadShared(SKEYS.visitBudgets),
        loadPersonal(PKEYS.nav, {}), loadShared(SKEYS.settings), loadShared(SKEYS.activity),
        loadShared(SKEYS.meters), loadShared(SKEYS.meterReadings), loadShared(SKEYS.signins), loadPersonal(PKEYS.snooze, {}),
        loadShared(SKEYS.spares), loadShared(SKEYS.keys), loadShared(SKEYS.reminders), loadPersonal(PKEYS.display, { scale: 1 }),
        loadShared(SKEYS.audits), loadShared(SKEYS.incidents), loadShared(SKEYS.projects),
        loadShared(SKEYS.permits), loadShared(SKEYS.waste),
      ]);
      setUsers(u); setCountries(c); setLocations(l); setDevices(d);
      setServices(s); setWorks(w); setSuppliers(sup); setBudgets(b); setBudgetLines(bl); setDeviceTasks(dt); setVisitBudgets(vb);
      if (st && !Array.isArray(st)) setSettings((prev) => ({ ...prev, ...st }));
      setActivity(Array.isArray(act) ? act : []);
      setMeters(Array.isArray(mt) ? mt : []); setMeterReadings(Array.isArray(mr) ? mr : []); setSignins(Array.isArray(si) ? si : []);
      setSnoozed(sn && !Array.isArray(sn) ? sn : {});
      setSpares(Array.isArray(sp) ? sp : []); setKeysList(Array.isArray(ky) ? ky : []); setReminders(Array.isArray(rm) ? rm : []);
      if (disp && !Array.isArray(disp)) setDisplay({ scale: 1, ...disp });
      setAudits(Array.isArray(au) ? au : []); setIncidents(Array.isArray(inc) ? inc : []); setProjects(Array.isArray(pr) ? pr : []);
      setPermits(Array.isArray(pm) ? pm : []); setWaste(Array.isArray(ws) ? ws : []);
      let migrated = false;
      const blFixed = bl.map((line) => {
        if (line.actualAmount == null || line.actualSource || !line.deviceId) return line;
        const match = s.find((v) => v.deviceId === line.deviceId && v.date === line.actualDate && Number(v.cost) === Number(line.actualAmount));
        if (!match) return line;
        migrated = true;
        return { ...line, actualSource: "visit", actualServiceId: match.id };
      });
      if (migrated) { setBudgetLines(blFixed); saveShared(SKEYS.budgetLines, blFixed); }
      if (nav.tab) setTab(nav.tab);
      if (nav.listPrefs) setListPrefs((p) => ({ ...p, ...nav.listPrefs }));
      setCurrentUserId(nav.currentUserId || null);
      setSelectedCountryId(nav.selectedCountryId || null);
      setSelectedLocationId(nav.selectedLocationId || null);
      // Deep link from a staff QR sticker: ?service=<id> jumps to that service's history.
      const deepId = new URLSearchParams(window.location.search).get("service");
      const deepDev = deepId ? d.find((x) => x.id === deepId) : null;
      if (deepDev) {
        const deepLoc = l.find((x) => x.id === deepDev.locationId);
        setSelectedLocationId(deepDev.locationId);
        if (deepLoc) setSelectedCountryId(deepLoc.countryId);
        setTab("devices");
        setHistoryFor(deepDev.id);
      }
      setLoading(false);
    })();
  }, []);

  // Live refresh when a shared database is connected: pull the latest data when the app
  // comes back into view and every minute, so everyone sees each other's changes.
  const REMOTE = typeof window !== "undefined" && !!window.storage?.__remote;
  const SHARED_SETTERS = { users: setUsers, countries: setCountries, locations: setLocations, devices: setDevices, services: setServices, works: setWorks, suppliers: setSuppliers, budgets: setBudgets, budgetLines: setBudgetLines, deviceTasks: setDeviceTasks, visitBudgets: setVisitBudgets, activity: setActivity, meters: setMeters, meterReadings: setMeterReadings, signins: setSignins, spares: setSpares, keys: setKeysList, reminders: setReminders, audits: setAudits, incidents: setIncidents, projects: setProjects, permits: setPermits, waste: setWaste };
  // When two people save the same list at once, the shared-storage layer merges both sets of
  // changes and tells us the merged result, so this screen shows everyone's edits.
  useEffect(() => {
    const onMerged = (e) => {
      const { key, value } = e.detail || {};
      const k = Object.keys(SKEYS).find((x) => SKEYS[x] === key);
      if (!k) return;
      try { const v = JSON.parse(value); if (SHARED_SETTERS[k] && Array.isArray(v)) SHARED_SETTERS[k](v); } catch (x) { /* ignore */ }
    };
    const onPending = (e) => setPendingCount(e.detail?.count || 0);
    window.addEventListener("ppm-merged", onMerged);
    window.addEventListener("ppm-pending", onPending);
    setPendingCount(window.storage?.__pendingCount?.() || 0);
    return () => { window.removeEventListener("ppm-merged", onMerged); window.removeEventListener("ppm-pending", onPending); };
  }, []);
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  async function refreshShared(force) {
    if (!REMOTE || syncing) return;
    if (!force && Date.now() - LAST_LOCAL_WRITE < 8000) return;
    setSyncing(true);
    try {
      const setters = SHARED_SETTERS; const keys = Object.keys(setters);
      const vals = await Promise.all(keys.map((k) => loadShared(SKEYS[k])));
      if (!force && Date.now() - LAST_LOCAL_WRITE < 8000) return; // a save happened while we were fetching
      keys.forEach((k, i) => { if (Array.isArray(vals[i])) setters[k]((prev) => (JSON.stringify(prev) === JSON.stringify(vals[i]) ? prev : vals[i])); });
      const st = await loadShared(SKEYS.settings);
      if (st && !Array.isArray(st)) setSettings((prev) => ({ ...prev, ...st }));
      setLastSync(new Date());
    } catch (e) { console.error("refresh failed", e); }
    finally { setSyncing(false); }
  }
  useEffect(() => {
    if (!REMOTE || loading) return;
    setLastSync(new Date());
    const onVis = () => { if (document.visibilityState === "visible") refreshShared(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    const t = setInterval(() => { if (document.visibilityState === "visible" && !document.querySelector("[data-modal-open]")) refreshShared(); }, 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); clearInterval(t); };
  }, [loading]);

  const persist = {
    users: useCallback((next) => { setUsers(next); saveShared(SKEYS.users, next); }, []),
    countries: useCallback((next) => { setCountries(next); saveShared(SKEYS.countries, next); }, []),
    locations: useCallback((next) => { setLocations(next); saveShared(SKEYS.locations, next); }, []),
    devices: useCallback((next) => { setDevices(next); saveShared(SKEYS.devices, next); }, []),
    services: useCallback((next) => { setServices(next); saveShared(SKEYS.services, next); }, []),
    works: useCallback((next) => { setWorks(next); saveShared(SKEYS.works, next); }, []),
    suppliers: useCallback((next) => { setSuppliers(next); saveShared(SKEYS.suppliers, next); }, []),
    budgets: useCallback((next) => { setBudgets(next); saveShared(SKEYS.budgets, next); }, []),
    budgetLines: useCallback((next) => { setBudgetLines(next); saveShared(SKEYS.budgetLines, next); }, []),
    deviceTasks: useCallback((next) => { setDeviceTasks(next); saveShared(SKEYS.deviceTasks, next); }, []),
    visitBudgets: useCallback((next) => { setVisitBudgets(next); saveShared(SKEYS.visitBudgets, next); }, []),
    settings: useCallback((next) => { setSettings(next); saveShared(SKEYS.settings, next); }, []),
    meters: useCallback((next) => { setMeters(next); saveShared(SKEYS.meters, next); }, []),
    meterReadings: useCallback((next) => { setMeterReadings(next); saveShared(SKEYS.meterReadings, next); }, []),
    signins: useCallback((next) => { setSignins(next); saveShared(SKEYS.signins, next); }, []),
    spares: useCallback((next) => { setSpares(next); saveShared(SKEYS.spares, next); }, []),
    keys: useCallback((next) => { setKeysList(next); saveShared(SKEYS.keys, next); }, []),
    reminders: useCallback((next) => { setReminders(next); saveShared(SKEYS.reminders, next); }, []),
    audits: useCallback((next) => { setAudits(next); saveShared(SKEYS.audits, next); }, []),
    incidents: useCallback((next) => { setIncidents(next); saveShared(SKEYS.incidents, next); }, []),
    projects: useCallback((next) => { setProjects(next); saveShared(SKEYS.projects, next); }, []),
    permits: useCallback((next) => { setPermits(next); saveShared(SKEYS.permits, next); }, []),
    waste: useCallback((next) => { setWaste(next); saveShared(SKEYS.waste, next); }, []),
  };
  function saveNav(patch) {
    const next = { currentUserId, selectedCountryId, selectedLocationId, tab, listPrefs, ...patch };
    if ("currentUserId" in patch) setCurrentUserId(patch.currentUserId);
    if ("selectedCountryId" in patch) setSelectedCountryId(patch.selectedCountryId);
    if ("selectedLocationId" in patch) setSelectedLocationId(patch.selectedLocationId);
    savePersonal(PKEYS.nav, next);
  }

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const currentUserRef = useRef(null); currentUserRef.current = currentUser?.name || null;
  const locationRef = useRef(null); locationRef.current = selectedLocationId;
  const selectedCountry = countries.find((c) => c.id === selectedCountryId) || null;
  const selectedLocation = locations.find((l) => l.id === selectedLocationId) || null;

  const locAllDevices = useMemo(() => devices.filter((d) => d.locationId === selectedLocationId), [devices, selectedLocationId]);
  const locDevices = useMemo(() => locAllDevices.filter((d) => !d.archived), [locAllDevices]); // archived = decommissioned, hidden from day-to-day lists
  const locArchivedDevices = useMemo(() => locAllDevices.filter((d) => d.archived), [locAllDevices]);
  const locDeviceIds = useMemo(() => new Set(locAllDevices.map((d) => d.id)), [locAllDevices]);
  const locServices = useMemo(() => services.filter((s) => locDeviceIds.has(s.deviceId)), [services, locDeviceIds]);
  const locWorks = useMemo(() => works.filter((w) => locDeviceIds.has(w.deviceId)), [works, locDeviceIds]);
  const locSuppliers = useMemo(() => suppliers.filter((s) => s.locationId === selectedLocationId), [suppliers, selectedLocationId]);
  const locBudgets = useMemo(() => budgets.filter((b) => b.locationId === selectedLocationId), [budgets, selectedLocationId]);
  const locBudgetLines = useMemo(() => budgetLines.filter((b) => b.locationId === selectedLocationId), [budgetLines, selectedLocationId]);
  const locDeviceTasks = useMemo(() => deviceTasks.filter((t) => locDeviceIds.has(t.deviceId)), [deviceTasks, locDeviceIds]);
  const locVisitBudgets = useMemo(() => visitBudgets.filter((v) => locDeviceIds.has(v.deviceId)), [visitBudgets, locDeviceIds]);

  // Notification centre: everything that needs attention at this location right now.
  const alerts = useMemo(() => {
    const out = [];
    const today = new Date();
    const yr = today.getFullYear();
    locDevices.forEach((d) => {
      const n = daysUntil(d.nextServiceDate);
      if (n === null) return;
      if (n < 0) out.push({ key: `od-${d.id}`, tone: "danger", title: `${d.name} is ${-n} day${n === -1 ? "" : "s"} overdue`, detail: `Was due ${fmtDate(d.nextServiceDate)}${d.chaseLog?.length ? ` · chased ${d.chaseLog.length}×` : " · not chased yet"}`, tab: "devices" });
      const bo = inBlackout(d.nextServiceDate, (settings.blackouts || []).filter((b) => !b.locationId || b.locationId === d.locationId));
      if (bo && n >= 0) out.push({ key: `bo-${d.id}`, tone: "warn", title: `${d.name} is due during "${bo.name}"`, detail: `Due ${fmtDate(d.nextServiceDate)} · blackout ${fmtDate(bo.start)}–${fmtDate(bo.end)}`, tab: "schedule" });
      if (n >= 0 && n <= 7) out.push({ key: `ds-${d.id}`, tone: "warn", title: `${d.name} due ${n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`}`, detail: fmtDate(d.nextServiceDate), tab: "devices" });
    });
    const threshold = Number(settings.approvalThreshold) || 0;
    const devMap = {}; locDevices.forEach((d) => { devMap[d.id] = d; });
    locWorks.forEach((w) => {
      const dev = devMap[w.deviceId];
      if (w.status === "requested") out.push({ key: `rq-${w.id}`, tone: w.priority === "high" ? "danger" : "warn", title: `New request: ${dev?.name || "service"}`, detail: w.description, tab: "works" });
      else if (threshold > 0 && Number(w.quoteAmount) >= threshold && !w.approvedBy && (w.status === "quoted" || w.status === "requested")) out.push({ key: `ap-${w.id}`, tone: "warn", title: `Quote needs approval: ${gbp(w.quoteAmount)}`, detail: `${dev?.name || ""} — ${w.description}`, tab: "works" });
      else if (w.status === "quoted") out.push({ key: `oq-${w.id}`, tone: "info", title: `Open quote: ${gbp(w.quoteAmount)}`, detail: `${dev?.name || ""} — ${w.description}`, tab: "works" });
    });
    const catOf = {}; locDevices.forEach((d) => { catOf[d.id] = d.serviceCategory || "maintenance"; });
    CATEGORY_KEYS.forEach((cat) => {
      const cap = Number(locBudgets.find((b) => b.year === yr && b.category === cat)?.amount) || 0;
      if (!cap) return;
      let spent = 0;
      locServices.forEach((s) => { if (catOf[s.deviceId] === cat && new Date(s.date).getFullYear() === yr) spent += Number(s.cost) || 0; });
      locWorks.forEach((w) => { if (catOf[w.deviceId] === cat && w.budgetType !== "non_controllable" && ["approved", "in_progress", "completed"].includes(w.status) && new Date(w.dateRaised).getFullYear() === yr) spent += Number(w.quoteAmount) || 0; });
      locBudgetLines.forEach((l) => { if (l.category === cat && l.actualAmount != null && !isMirrored(l) && new Date(l.date).getFullYear() === yr) spent += Number(l.actualAmount) || 0; });
      locSuppliers.forEach((s) => { if (s.category === cat) spent += s.costFrequency === "annual" ? Number(s.costAmount) || 0 : (Number(s.costAmount) || 0) * 12; });
      const pct = Math.round((spent / cap) * 100);
      if (pct >= 80) out.push({ key: `bg-${cat}-${yr}`, tone: pct >= 100 ? "danger" : "warn", title: `${CATEGORY_META[cat].label} budget at ${pct}%`, detail: `${gbp(spent)} of ${gbp(cap)} cap for ${yr}`, tab: "budget" });
    });
    locSuppliers.forEach((s) => {
      const n = daysUntil(s.contractEnd);
      if (n === null) return;
      const notice = Number(s.noticeDays) || 60;
      if (n < 0) out.push({ key: `ce-${s.id}`, tone: "danger", title: `${s.name} contract has expired`, detail: `Ended ${fmtDate(s.contractEnd)}`, tab: "suppliers" });
      else if (n <= notice) out.push({ key: `cr-${s.id}`, tone: "warn", title: `${s.name} contract ends in ${n} days`, detail: `Ends ${fmtDate(s.contractEnd)} · ${notice}-day notice window`, tab: "suppliers" });
    });
    // Asset warranties: flag 60 days ahead, and for 30 days after they lapse.
    locDevices.forEach((d) => {
      const n = daysUntil(d.warrantyEnd);
      if (n === null) return;
      if (n < 0 && n >= -30) out.push({ key: `we-${d.id}`, tone: "warn", title: `${d.name} warranty has expired`, detail: `Ended ${fmtDate(d.warrantyEnd)}`, tab: "devices" });
      else if (n >= 0 && n <= 60) out.push({ key: `ws-${d.id}`, tone: "info", title: `${d.name} warranty ends in ${n} day${n === 1 ? "" : "s"}`, detail: `Ends ${fmtDate(d.warrantyEnd)} — book any claims before then`, tab: "devices" });
    });
    // Visits due within 14 days that haven't been booked with the supplier yet.
    locDevices.forEach((d) => {
      const n = daysUntil(d.nextServiceDate);
      if (n === null || n < 0 || n > 14 || currentBooking(d)) return;
      out.push({ key: `nb-${d.id}`, tone: "info", title: `${d.name} not booked yet`, detail: `Due ${fmtDate(d.nextServiceDate)} — confirm a date with the supplier`, tab: "devices" });
    });
    // Quotes about to lapse.
    locWorks.forEach((w) => {
      if (!w.quoteValidUntil || !["quoted", "requested"].includes(w.status)) return;
      const n = daysUntil(w.quoteValidUntil);
      if (n === null || n > 7) return;
      out.push({ key: `qx-${w.id}`, tone: n < 0 ? "warn" : "info", title: n < 0 ? `Quote expired: ${devMap[w.deviceId]?.name || "work"}` : `Quote expires in ${n} day${n === 1 ? "" : "s"}: ${devMap[w.deviceId]?.name || "work"}`, detail: `${gbp(w.quoteAmount)} — ${w.description}`, tab: "works" });
    });
    // Reactive works past their target completion date.
    locWorks.forEach((w) => {
      const sla = workSla(w);
      if (!sla || sla.done || !sla.breached) return;
      out.push({ key: `sla-${w.id}`, tone: w.priority === "high" ? "danger" : "warn", title: `Work overdue: ${devMap[w.deviceId]?.name || "service"}`, detail: `${w.description} · target was ${fmtDate(sla.deadline)}`, tab: "works" });
    });
    // Asset lifecycle: flag assets reaching the end of their expected life.
    locDevices.forEach((d) => {
      const ry = replacementYear(d);
      if (!ry || ry > yr + 1) return;
      out.push({ key: `rp-${d.id}`, tone: ry <= yr ? "warn" : "info", title: ry <= yr ? `${d.name} is at end of life (${ry})` : `${d.name} due for replacement in ${ry}`, detail: `Installed ${fmtDate(d.installDate)} · ${d.expectedLifeYears}-year life — plan it into next year's budget`, tab: "devices" });
    });
    // Supplier compliance documents: insurance and accreditation.
    locSuppliers.forEach((s) => {
      [["insuranceExpiry", "insurance"], ["accreditationExpiry", s.accreditation || "accreditation"]].forEach(([field, label]) => {
        const n = daysUntil(s[field]);
        if (n === null) return;
        if (n < 0) out.push({ key: `${field}-${s.id}`, tone: "danger", title: `${s.name}: ${label} has expired`, detail: `Expired ${fmtDate(s[field])} — ask for an updated certificate`, tab: "suppliers" });
        else if (n <= 30) out.push({ key: `${field}-${s.id}`, tone: "warn", title: `${s.name}: ${label} expires in ${n} day${n === 1 ? "" : "s"}`, detail: `Expires ${fmtDate(s[field])}`, tab: "suppliers" });
      });
    });
    const rank = { danger: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [locDevices, locWorks, locServices, locBudgets, locBudgetLines, locSuppliers, settings]);

  // Year-to-date spend and budget totals for the Home dashboard (same rules as the budget alerts).
  const spendSummary = useMemo(() => {
    const yr = new Date().getFullYear();
    const catOf = {}; locAllDevices.forEach((d) => { catOf[d.id] = d.serviceCategory || "maintenance"; });
    let spent = 0;
    locServices.forEach((s) => { if (new Date(s.date).getFullYear() === yr) spent += Number(s.cost) || 0; });
    locWorks.forEach((w) => { if (w.budgetType !== "non_controllable" && ["approved", "in_progress", "completed"].includes(w.status) && new Date(w.dateRaised).getFullYear() === yr) spent += Number(w.quoteAmount) || 0; });
    locBudgetLines.forEach((l) => { if (l.actualAmount != null && !isMirrored(l) && new Date(l.date).getFullYear() === yr) spent += Number(l.actualAmount) || 0; });
    const monthsSoFar = new Date().getMonth() + 1;
    locSuppliers.forEach((s) => { const monthly = s.costFrequency === "annual" ? (Number(s.costAmount) || 0) / 12 : Number(s.costAmount) || 0; spent += monthly * monthsSoFar; });
    const budget = locBudgets.filter((b) => b.year === yr).reduce((t, b) => t + (Number(b.amount) || 0), 0);
    // Year-end forecast: spend so far + planned lines still to come + the rest of this year's contracts.
    const todayS = new Date().toISOString().slice(0, 10);
    let remaining = 0;
    locBudgetLines.forEach((l) => { if (l.actualAmount == null && !isMirrored(l) && l.date > todayS && new Date(l.date).getFullYear() === yr) remaining += Number(l.amount) || 0; });
    locSuppliers.forEach((s) => { const monthly = s.costFrequency === "annual" ? (Number(s.costAmount) || 0) / 12 : Number(s.costAmount) || 0; remaining += monthly * (12 - monthsSoFar); });
    return { spent, budget, yr, forecast: spent + remaining };
  }, [locAllDevices, locServices, locWorks, locBudgetLines, locSuppliers, locBudgets]);

  const locMeters = useMemo(() => meters.filter((m) => m.locationId === selectedLocationId && !m.archived), [meters, selectedLocationId]);
  const locMeterIds = useMemo(() => new Set(locMeters.map((m) => m.id)), [locMeters]);
  const locReadings = useMemo(() => meterReadings.filter((r) => locMeterIds.has(r.meterId)), [meterReadings, locMeterIds]);
  const locSignins = useMemo(() => signins.filter((x) => x.locationId === selectedLocationId), [signins, selectedLocationId]);
  const locSpares = useMemo(() => spares.filter((x) => x.locationId === selectedLocationId), [spares, selectedLocationId]);
  const locKeys = useMemo(() => keysList.filter((x) => x.locationId === selectedLocationId), [keysList, selectedLocationId]);
  // Services with 3+ reactive works in the last 12 months — candidates for a root-cause look or replacement.
  const faultsByDevice = useMemo(() => {
    const since = addDays(new Date().toISOString().slice(0, 10), -365); const m = {};
    locWorks.forEach((w) => { if (w.status !== "rejected" && w.dateRaised >= since) m[w.deviceId] = (m[w.deviceId] || 0) + 1; });
    return m;
  }, [locWorks]);
  const locPermits = useMemo(() => permits.filter((x) => x.locationId === selectedLocationId), [permits, selectedLocationId]);
  const locWaste = useMemo(() => waste.filter((x) => x.locationId === selectedLocationId), [waste, selectedLocationId]);
  const locAudits = useMemo(() => audits.filter((x) => x.locationId === selectedLocationId), [audits, selectedLocationId]);
  const locIncidents = useMemo(() => incidents.filter((x) => x.locationId === selectedLocationId), [incidents, selectedLocationId]);
  const locProjects = useMemo(() => projects.filter((x) => x.locationId === selectedLocationId), [projects, selectedLocationId]);
  const locReminders = useMemo(() => reminders.filter((x) => x.locationId === selectedLocationId), [reminders, selectedLocationId]);
  // Everything that needs attention, less anything this person has snoozed.
  const todayISO = new Date().toISOString().slice(0, 10);
  const allAlerts = useMemo(() => {
    const extra = [];
    locMeters.forEach((m) => {
      const last = locReadings.filter((r) => r.meterId === m.id).reduce((mx, r) => (r.date > mx ? r.date : mx), "");
      const n = last ? -daysUntil(last) : null;
      if (!last || n > (Number(m.readEveryDays) || 31) + 4) extra.push({ key: `mr-${m.id}-${last}`, tone: "info", title: `${m.name} meter reading due`, detail: last ? `Last read ${fmtDate(last)} (${n} days ago)` : "No readings yet", tab: "meters" });
    });
    locSpares.forEach((sp) => {
      if (sp.minQty == null || sp.minQty === "" || Number(sp.qty) > Number(sp.minQty)) return;
      extra.push({ key: `sp-${sp.id}-${sp.qty}`, tone: Number(sp.qty) <= 0 ? "warn" : "info", title: `Low stock: ${sp.name}`, detail: `${sp.qty} left (reorder at ${sp.minQty})${sp.store ? ` · ${sp.store}` : ""}`, tab: "meters" });
    });
    locKeys.forEach((k) => {
      if (!k.holder || !k.dueBack) return;
      const n = daysUntil(k.dueBack);
      if (n !== null && n < 0) extra.push({ key: `ky-${k.id}-${k.dueBack}`, tone: "warn", title: `Key not returned: ${k.label}`, detail: `${k.holder}${k.holderCompany ? ` (${k.holderCompany})` : ""} · was due back ${fmtDate(k.dueBack)}`, tab: "meters" });
    });
    locReminders.forEach((r) => {
      if (r.done || !r.due) return;
      const n = daysUntil(r.due);
      if (n !== null && n <= 0) extra.push({ key: `rm-${r.id}`, tone: n < 0 ? "warn" : "info", title: n < 0 ? `Reminder overdue: ${r.text}` : `Reminder today: ${r.text}`, detail: `${r.assignee ? `For ${r.assignee} · ` : ""}due ${fmtDate(r.due)}`, tab: "home" });
    });
    locSuppliers.forEach((sup) => {
      const done = Object.keys(sup.onboarding || {}).filter((k) => ONBOARDING_ITEMS.includes(k)).length;
      if (sup.onboarding && done < ONBOARDING_ITEMS.length && done > 0) extra.push({ key: `ob-${sup.id}-${done}`, tone: "info", title: `${sup.name}: onboarding ${done}/${ONBOARDING_ITEMS.length}`, detail: `Missing: ${ONBOARDING_ITEMS.filter((k) => !(sup.onboarding || {})[k]).slice(0, 3).join(", ")}${ONBOARDING_ITEMS.length - done > 3 ? "…" : ""}`, tab: "suppliers" });
    });
    Object.entries(faultsByDevice).forEach(([id, n]) => {
      const dev = locAllDevices.find((d) => d.id === id);
      if (n < 3 || !dev || dev.archived) return;
      extra.push({ key: `rf-${id}-${n}`, tone: "info", title: `Repeat faults: ${dev.name}`, detail: `${n} reactive jobs in the last 12 months — worth a root-cause check or replacement review`, tab: "devices" });
    });
    locDevices.forEach((d) => {
      if (!d.certRequired) return;
      const last = locServices.filter((v) => v.deviceId === d.id && !v.aborted).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      if (last && !last.certificatePhoto) extra.push({ key: `cm-${last.id}`, tone: "warn", title: `Certificate missing: ${d.name}`, detail: `Visit on ${fmtDate(last.date)} has no certificate attached — ask the supplier for it`, tab: "certificates" });
    });
    locPermits.forEach((pm) => {
      if (pm.status !== "open" || !pm.validTo) return;
      if (new Date(pm.validTo).getTime() < Date.now()) extra.push({ key: `ptw-${pm.id}`, tone: "warn", title: `Permit not closed: ${pm.ref}`, detail: `${pm.type} · ${pm.contractor || ""} · expired ${new Date(pm.validTo).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`, tab: "meters" });
    });
    locIncidents.forEach((i) => {
      if (i.status === "closed") return;
      if (i.riddor && !i.riddorReported) extra.push({ key: `rid-${i.id}`, tone: "danger", title: `RIDDOR report needed: ${INCIDENT_TYPES[i.type] || "incident"} ${fmtDate(i.date)}`, detail: "Reportable incidents must be reported to the HSE — mark as reported once done", tab: "meters" });
      else if (-daysUntil(i.date) > 14) extra.push({ key: `inc-${i.id}`, tone: "warn", title: `Incident still open: ${INCIDENT_TYPES[i.type] || "incident"}`, detail: `${fmtDate(i.date)} · ${String(i.description || "").slice(0, 60)}`, tab: "meters" });
    });
    locProjects.forEach((pj) => {
      if (["complete", "on_hold", "idea"].includes(pj.status) || !pj.target) return;
      if (daysUntil(pj.target) < 0) extra.push({ key: `pj-${pj.id}`, tone: "warn", title: `Project past target: ${pj.name}`, detail: `Target was ${fmtDate(pj.target)}`, tab: "works" });
      if (Number(pj.budget) && Number(pj.spent) > Number(pj.budget)) extra.push({ key: `pjb-${pj.id}`, tone: "warn", title: `Project over budget: ${pj.name}`, detail: `${gbp(pj.spent)} of ${gbp(pj.budget)}`, tab: "works" });
    });
    return [...alerts, ...extra];
  }, [alerts, locMeters, locReadings, locSpares, locKeys, locReminders, locSuppliers, locIncidents, locProjects, faultsByDevice, locDevices, locServices, locPermits]);
  const visibleAlerts = useMemo(() => allAlerts.filter((a) => !(snoozed[a.key] && snoozed[a.key] >= todayISO)), [allAlerts, snoozed, todayISO]);
  const snoozedCount = allAlerts.length - visibleAlerts.length;
  function snoozeAlert(key, days) {
    const next = { ...Object.fromEntries(Object.entries(snoozed).filter(([, until]) => until >= todayISO)) };
    if (days) next[key] = addDays(todayISO, days); else delete next[key];
    setSnoozed(next); savePersonal(PKEYS.snooze, next);
  }
  function clearSnoozes() { setSnoozed({}); savePersonal(PKEYS.snooze, {}); }

  // Subcategory suggestions for autocomplete — anything typed before, for this
  // category, anywhere (services, suppliers, or budget lines) at this location.
  const subcategoriesByCategory = useMemo(() => {
    const m = emptyCatMap(() => new Set());
    locDevices.forEach((d) => { if (d.subCategory && m[d.serviceCategory]) m[d.serviceCategory].add(d.subCategory); });
    locSuppliers.forEach((s) => { if (s.subCategory && m[s.category]) m[s.category].add(s.subCategory); });
    locBudgetLines.forEach((l) => { if (l.subCategory && m[l.category]) m[l.category].add(l.subCategory); });
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort()]));
  }, [locDevices, locSuppliers, locBudgetLines, settings]);

  const deviceById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);
  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locDevices;
    return locDevices.filter((d) => [d.name, d.assetTag, d.category, d.serialNumber, d.manufacturer, d.model, d.area].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  }, [locDevices, search]);

  const locationById = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);
  const countryById = useMemo(() => Object.fromEntries(countries.map((c) => [c.id, c])), [countries]);
  function locationLabel(device) {
    const loc = locationById[device.locationId];
    if (!loc) return "";
    const country = countryById[loc.countryId];
    return country ? `${country.name} · ${loc.name}` : loc.name;
  }
  const [searchAllLocations, setSearchAllLocations] = useState(false);
  const globalFilteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices.filter((d) => !d.archived);
    return devices.filter((d) => !d.archived).filter((d) => [d.name, d.assetTag, d.category, d.serialNumber, d.manufacturer, d.model].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  }, [devices, search]);
  const sortedByDue = useMemo(() => [...locDevices].sort((a, b) => {
    const da = a.nextServiceDate ? new Date(a.nextServiceDate) : new Date(8640000000000000);
    const db = b.nextServiceDate ? new Date(b.nextServiceDate) : new Date(8640000000000000);
    return da - db;
  }), [locDevices]);

  const overdueCount = locDevices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; }).length;
  const dueSoonCount = locDevices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 30; }).length;
  const openWorksCount = locWorks.filter((w) => w.status === "quoted" || w.status === "approved").length;

  /* ---- undo: take a snapshot before a delete, restore it if the user taps Undo ---- */
  const UNDO_KEYS = ["devices", "services", "works", "suppliers", "budgetLines", "deviceTasks", "visitBudgets", "spares", "keys", "reminders", "audits", "incidents", "projects", "permits", "waste"]; // archive also uses undo
  const currentCollections = { devices, services, works, suppliers, budgetLines, deviceTasks, visitBudgets, spares, keys: keysList, reminders, audits, incidents, projects, permits, waste };
  function withUndo(fn) {
    const snap = { ...currentCollections };
    fn();
    setToast((t) => ({ msg: t?.msg || "Deleted", undo: snap }));
  }
  function undoLast() {
    const snap = toast?.undo; if (!snap) return;
    UNDO_KEYS.forEach((k) => { if (snap[k] !== currentCollections[k]) persist[k](snap[k]); });
    setToast(null);
    showToast("Undone — deleted item restored");
  }
  /* ---- backup & restore ---- */
  const allData = { users, countries, locations, devices, services, works, suppliers, budgets, budgetLines, deviceTasks, visitBudgets, settings, activity, meters, meterReadings, signins, spares, keys: keysList, reminders, audits, incidents, projects, permits, waste };
  function downloadBackup() {
    const payload = { app: "PPM Service Book", version: 1, exportedAt: new Date().toISOString(), exportedBy: currentUser?.name || "", data: allData };
    downloadBlob(new Blob([JSON.stringify(payload)], { type: "application/json" }), `ppm-backup-${new Date().toISOString().slice(0, 10)}.json`);
    persist.settings({ ...settings, lastBackupAt: new Date().toISOString() });
    showToast("Backup downloaded");
  }
  function restoreBackup(payload) {
    const d = payload?.data;
    if (!d || !Array.isArray(d.devices) || !Array.isArray(d.locations)) return "This doesn't look like a PPM Service Book backup file.";
    ["users", "countries", "locations", "devices", "services", "works", "suppliers", "budgets", "budgetLines", "deviceTasks", "visitBudgets"].forEach((k) => {
      persist[k](Array.isArray(d[k]) ? d[k] : []);
    });
    if (d.settings && !Array.isArray(d.settings)) persist.settings(d.settings);
    if (Array.isArray(d.activity)) { setActivity(d.activity); saveShared(SKEYS.activity, d.activity); }
    ["meters", "meterReadings", "signins", "spares", "keys", "reminders", "audits", "incidents", "projects", "permits", "waste"].forEach((k) => { if (Array.isArray(d[k])) persist[k](d[k]); });
    showToast("Backup restored", payload.exportedAt ? `from ${fmtDate(payload.exportedAt.slice(0, 10))}` : "");
    return null;
  }
  /* ---- permits to work ---- */
  function savePermit(pm) {
    if (pm.id) { persist.permits(permits.map((x) => x.id === pm.id ? { ...x, ...pm } : x)); showToast("Permit updated", pm.ref); return pm.ref; }
    const n = permits.filter((x) => x.locationId === selectedLocationId).length + 1;
    const ref = `PTW-${String(n).padStart(4, "0")}`;
    persist.permits([{ ...pm, id: uid(), ref, locationId: selectedLocationId, issuedBy: currentUser?.name, issuedAt: new Date().toISOString(), status: "open" }, ...permits]);
    showToast("Permit issued", `${ref} — ${pm.type}`);
    return ref;
  }
  function closePermit(id, status) {
    const pm = permits.find((x) => x.id === id);
    persist.permits(permits.map((x) => x.id === id ? { ...x, status, closedAt: new Date().toISOString(), closedBy: currentUser?.name } : x));
    showToast(status === "cancelled" ? "Permit cancelled" : "Permit closed", pm?.ref);
  }
  /* ---- waste ---- */
  function saveWaste(w) {
    if (w.id) { persist.waste(waste.map((x) => x.id === w.id ? { ...x, ...w } : x)); showToast("Waste record updated"); }
    else { persist.waste([{ ...w, id: uid(), locationId: selectedLocationId, by: currentUser?.name }, ...waste]); showToast("Waste collection logged", `${WASTE_STREAMS[w.stream]} ${w.weightKg} kg`); }
  }
  function deleteWaste(id) { withUndo(() => { persist.waste(waste.filter((x) => x.id !== id)); showToast("Waste record deleted"); }); }
  function saveEmergencyContacts(list) { persist.settings({ ...settings, emergencyContacts: { ...(settings.emergencyContacts || {}), [selectedLocationId]: list } }); showToast("Emergency contacts saved"); }
  /* ---- audits ---- */
  function saveAudit(a) {
    if (a.id) { persist.audits(audits.map((x) => x.id === a.id ? { ...x, ...a } : x)); showToast("Audit updated", `${a.templateName} ${a.score}%`); }
    else { persist.audits([{ ...a, id: uid(), locationId: selectedLocationId, by: currentUser?.name, at: new Date().toISOString() }, ...audits]); showToast("Audit saved", `${a.templateName}${a.area ? ` — ${a.area}` : ""}: ${a.score}%`); }
  }
  function deleteAudit(id) { withUndo(() => { persist.audits(audits.filter((x) => x.id !== id)); showToast("Audit deleted"); }); }
  function saveAuditTemplates(list) { persist.settings({ ...settings, auditTemplates: list }); }
  /* ---- incidents ---- */
  function saveIncident(i) {
    if (i.id) { persist.incidents(incidents.map((x) => x.id === i.id ? { ...x, ...i } : x)); showToast("Incident updated", INCIDENT_TYPES[i.type]); }
    else { persist.incidents([{ ...i, id: uid(), locationId: selectedLocationId, reportedBy: currentUser?.name, at: new Date().toISOString() }, ...incidents]); showToast("Incident logged", INCIDENT_TYPES[i.type]); }
  }
  function deleteIncident(id) { withUndo(() => { persist.incidents(incidents.filter((x) => x.id !== id)); showToast("Incident deleted"); }); }
  /* ---- projects ---- */
  function saveProject(pj) {
    if (pj.id) { persist.projects(projects.map((x) => x.id === pj.id ? { ...x, ...pj } : x)); showToast("Project updated", pj.name); }
    else { persist.projects([{ ...pj, id: uid(), locationId: selectedLocationId, by: currentUser?.name, at: new Date().toISOString() }, ...projects]); showToast("Project added", pj.name); }
  }
  function deleteProject(id) { const pj = projects.find((x) => x.id === id); withUndo(() => { persist.projects(projects.filter((x) => x.id !== id)); showToast("Project deleted", pj?.name); }); }
  /* ---- import services from a spreadsheet ---- */
  function importDevices(rows) {
    const newDevices = []; const newVB = []; const newBL = [];
    rows.forEach((r) => {
      const id = uid();
      const { scheduleYear, ...fields } = r;
      const { scheduleDates, ...rest } = fields;
      newDevices.push({ ...rest, id, locationId: selectedLocationId, checklist: fields.checklist || [], lastServiceDate: null, imported: true, nextServiceDate: scheduleDates?.[0] || fields.nextServiceDate || null });
      if (scheduleDates?.length) {
        scheduleDates.forEach((date) => {
          newVB.push({ id: uid(), deviceId: id, date, amount: r.budgetPerVisit || 0 });
          if (r.budgetPerVisit) newBL.push({ id: uid(), locationId: selectedLocationId, deviceId: id, category: r.serviceCategory, subCategory: r.subCategory || "", supplierId: r.supplierId || null, description: r.name, date, amount: r.budgetPerVisit, status: "planned", addedBy: currentUser?.name, source: "library" });
        });
      } else if (r.budgetPerVisit && r.nextServiceDate && r.serviceIntervalMonths) {
        const n = Math.max(1, Math.ceil(12 / r.serviceIntervalMonths));
        for (let i = 0; i < n; i++) {
          const date = shiftFor(selectedLocationId, addMonths(r.nextServiceDate, i * r.serviceIntervalMonths));
          newVB.push({ id: uid(), deviceId: id, date, amount: r.budgetPerVisit });
          newBL.push({ id: uid(), locationId: selectedLocationId, deviceId: id, category: r.serviceCategory, subCategory: r.subCategory || "", supplierId: r.supplierId || null, description: r.name, date, amount: r.budgetPerVisit, status: "planned", addedBy: currentUser?.name, source: "import" });
        }
      }
    });
    persist.devices([...devices, ...newDevices]);
    if (newVB.length) persist.visitBudgets([...visitBudgets, ...newVB]);
    if (newBL.length) persist.budgetLines([...budgetLines, ...newBL]);
    showToast(`${newDevices.length} services imported`, newBL.length ? `${newBL.length} planned visits added to the Budget Plan` : "");
  }
  /* ---- copy services to another site ---- */
  function copyDevicesToLocation(ids, locationId) {
    const targetSupplierIds = new Set(suppliers.filter((x) => x.locationId === locationId).map((x) => x.id));
    const copies = ids.map((id) => deviceById[id]).filter(Boolean).map((d) => {
      const { id, lastServiceDate, chaseLog, rescheduleLog, booking, notesLog, photo, archived, archivedAt, archivedBy, sourceWorkId, ...rest } = d;
      return { ...rest, id: uid(), locationId, assetTag: "", serialNumber: "", supplierId: targetSupplierIds.has(d.supplierId) ? d.supplierId : null, lastServiceDate: null, copiedFrom: d.id };
    });
    persist.devices([...devices, ...copies]);
    showToast(`${copies.length} services copied`, `to ${locationById[locationId]?.name || "another site"} — set suppliers and dates there`);
  }
  /* ---- spares ---- */
  function saveSpare(sp) {
    if (sp.id) { persist.spares(spares.map((x) => x.id === sp.id ? { ...x, ...sp } : x)); showToast("Spare updated", sp.name); }
    else { persist.spares([{ ...sp, id: uid(), locationId: selectedLocationId, log: [{ at: new Date().toISOString(), by: currentUser?.name, delta: Number(sp.qty) || 0, note: "Opening stock" }] }, ...spares]); showToast("Spare added", sp.name); }
  }
  function adjustSpare(id, delta, note) {
    const sp = spares.find((x) => x.id === id); if (!sp) return;
    const qty = Math.max(0, (Number(sp.qty) || 0) + delta);
    persist.spares(spares.map((x) => x.id === id ? { ...x, qty, log: [{ at: new Date().toISOString(), by: currentUser?.name, delta, note: note || "" }, ...(x.log || [])].slice(0, 200) } : x));
    showToast(delta < 0 ? "Stock used" : "Stock added", `${sp.name}: ${delta > 0 ? "+" : ""}${delta} → ${qty}`);
  }
  function deleteSpare(id) { const sp = spares.find((x) => x.id === id); withUndo(() => { persist.spares(spares.filter((x) => x.id !== id)); showToast("Spare deleted", sp?.name); }); }
  /* ---- keys & access cards ---- */
  function saveKey(k) {
    if (k.id) { persist.keys(keysList.map((x) => x.id === k.id ? { ...x, ...k } : x)); showToast("Key updated", k.label); }
    else { persist.keys([...keysList, { ...k, id: uid(), locationId: selectedLocationId, log: [] }]); showToast("Key added", k.label); }
  }
  function issueKey(id, holder, holderCompany, dueBack) {
    const k = keysList.find((x) => x.id === id); if (!k) return;
    const entry = { at: new Date().toISOString(), by: currentUser?.name, action: "issued", holder, holderCompany };
    persist.keys(keysList.map((x) => x.id === id ? { ...x, holder, holderCompany, issuedAt: new Date().toISOString(), dueBack: dueBack || null, log: [entry, ...(x.log || [])].slice(0, 200) } : x));
    showToast("Key issued", `${k.label} → ${holder}`);
  }
  function returnKey(id) {
    const k = keysList.find((x) => x.id === id); if (!k) return;
    const entry = { at: new Date().toISOString(), by: currentUser?.name, action: "returned", holder: k.holder, holderCompany: k.holderCompany };
    persist.keys(keysList.map((x) => x.id === id ? { ...x, holder: null, holderCompany: null, issuedAt: null, dueBack: null, log: [entry, ...(x.log || [])].slice(0, 200) } : x));
    showToast("Key returned", `${k.label} from ${k.holder}`);
  }
  function deleteKey(id) { const k = keysList.find((x) => x.id === id); withUndo(() => { persist.keys(keysList.filter((x) => x.id !== id)); showToast("Key deleted", k?.label); }); }
  /* ---- reminders ---- */
  function addReminder(r) { persist.reminders([{ ...r, id: uid(), locationId: selectedLocationId, done: false, by: currentUser?.name, at: new Date().toISOString() }, ...reminders]); showToast("Reminder added", r.text); }
  function toggleReminder(id) {
    const r = reminders.find((x) => x.id === id);
    if (r && !r.done && r.repeat && r.repeat !== "none" && r.due) {
      const next = r.repeat === "weekly" ? addDays(r.due, 7) : addMonths(r.due, { monthly: 1, quarterly: 3, yearly: 12 }[r.repeat] || 1);
      persist.reminders(reminders.map((x) => x.id === id ? { ...x, due: next, lastDoneAt: new Date().toISOString(), lastDoneBy: currentUser?.name, doneCount: (x.doneCount || 0) + 1 } : x));
      showToast("Reminder done — next one set", `${r.text} · ${fmtDate(next)}`);
      return;
    }
    persist.reminders(reminders.map((x) => x.id === id ? { ...x, done: !x.done, doneBy: !x.done ? currentUser?.name : null, doneAt: !x.done ? new Date().toISOString() : null } : x)); if (r && !r.done) showToast("Reminder done", r.text); }
  function deleteReminder(id) { withUndo(() => { persist.reminders(reminders.filter((x) => x.id !== id)); showToast("Reminder deleted"); }); }
  /* ---- bulk changes to selected services ---- */
  function bulkUpdateDevices(ids, action, value) {
    const set = new Set(ids); const names = ids.map((id) => deviceById[id]?.name).filter(Boolean);
    if (action === "reschedule") {
      const by = currentUser?.name || "Unknown"; const at = new Date().toISOString();
      const moves = {}; ids.forEach((id) => { const d = deviceById[id]; if (d && d.nextServiceDate !== value) moves[id] = d.nextServiceDate; });
      persist.devices(devices.map((d) => d.id in moves ? { ...d, nextServiceDate: value, rescheduleLog: [...(d.rescheduleLog || []), { from: moves[d.id], to: value, by, at }] } : d));
      persist.visitBudgets(visitBudgets.map((v) => v.deviceId in moves && v.date === moves[v.deviceId] ? { ...v, date: value } : v));
      persist.budgetLines(budgetLines.map((l) => l.deviceId in moves && l.date === moves[l.deviceId] && l.actualAmount == null ? { ...l, date: value } : l));
      showToast(`${Object.keys(moves).length} services moved to ${fmtDate(value)}`, names.join(", ").slice(0, 200));
    } else if (action === "supplier") {
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, supplierId: value || null } : d));
      showToast(`Supplier set on ${ids.length} services`, `${supplierById[value]?.name || "None"} — ${names.join(", ")}`.slice(0, 200));
    } else if (action === "assign") {
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, assignee: value || null } : d));
      showToast(value ? `${ids.length} service${ids.length === 1 ? "" : "s"} assigned to ${value}` : "Assignment cleared", names.join(", ").slice(0, 200));
    } else if (action === "pause") {
      const { until, drop } = value; const today = new Date().toISOString().slice(0, 10);
      const by = currentUser?.name || "Unknown"; const at = new Date().toISOString();
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, pausedUntil: until, pausedFrom: today, pausedBy: by, nextServiceDate: until, rescheduleLog: [...(d.rescheduleLog || []), { from: d.nextServiceDate, to: until, by, at, reason: "Paused" }] } : d));
      if (drop) {
        persist.visitBudgets(visitBudgets.filter((v) => !(set.has(v.deviceId) && v.date >= today && v.date < until)));
        persist.budgetLines(budgetLines.filter((l) => !(set.has(l.deviceId) && l.actualAmount == null && l.date >= today && l.date < until)));
      }
      showToast(`${ids.length} service${ids.length === 1 ? "" : "s"} paused until ${fmtDate(until)}`, names.join(", ").slice(0, 200));
    } else if (action === "resume") {
      const today = new Date().toISOString().slice(0, 10);
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, pausedUntil: null, nextServiceDate: d.nextServiceDate && d.nextServiceDate > today ? today : d.nextServiceDate } : d));
      showToast("Service resumed", names.join(", ").slice(0, 200));
    } else if (action === "area") {
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, area: value } : d));
      showToast(`Area set on ${ids.length} services`, value);
    } else if (action === "archive") {
      const today = new Date().toISOString().slice(0, 10);
      withUndo(() => {
        persist.devices(devices.map((d) => set.has(d.id) ? { ...d, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser?.name, nextServiceDate: null } : d));
        persist.visitBudgets(visitBudgets.filter((v) => !(set.has(v.deviceId) && v.date >= today)));
        persist.budgetLines(budgetLines.filter((l) => !(set.has(l.deviceId) && l.actualAmount == null && l.date >= today)));
        showToast(`${ids.length} services archived`, names.join(", ").slice(0, 200));
      });
    }
  }
  function saveDisplay(next) { setDisplay(next); savePersonal(PKEYS.display, next); }
  /* ---- meters ---- */
  function saveMeter(m) {
    if (m.id) { persist.meters(meters.map((x) => x.id === m.id ? { ...x, ...m } : x)); showToast("Meter updated", m.name); }
    else { persist.meters([...meters, { ...m, id: uid(), locationId: selectedLocationId }]); showToast("Meter added", m.name); }
  }
  function archiveMeter(id) { const m = meters.find((x) => x.id === id); withUndo(() => { persist.meters(meters.map((x) => x.id === id ? { ...x, archived: true } : x)); showToast("Meter removed", m?.name); }); }
  function addReading(r) {
    const m = meters.find((x) => x.id === r.meterId);
    persist.meterReadings([...meterReadings, { ...r, id: uid(), by: currentUser?.name, at: new Date().toISOString() }]);
    showToast("Reading saved", `${m?.name || "Meter"}: ${r.value} ${m?.unit || ""}`);
  }
  function deleteReading(id) { withUndo(() => { persist.meterReadings(meterReadings.filter((r) => r.id !== id)); showToast("Reading deleted"); }); }
  /* ---- contractor sign-in register ---- */
  function signIn(entry) {
    persist.signins([{ ...entry, id: uid(), locationId: selectedLocationId, inAt: new Date().toISOString(), outAt: null, by: currentUser?.name }, ...signins].slice(0, 2000));
    showToast("Signed in", `${entry.name}${entry.company ? ` (${entry.company})` : ""}`);
  }
  function signOut(id) {
    const e = signins.find((x) => x.id === id);
    persist.signins(signins.map((x) => x.id === id ? { ...x, outAt: new Date().toISOString(), outBy: currentUser?.name } : x));
    showToast("Signed out", e?.name);
  }
  /* ---- copy a year's Budget Plan into the next year ---- */
  function rollPlanForward(fromYear, upliftPct, includeCaps) {
    const f = 1 + (Number(upliftPct) || 0) / 100;
    const round = (n) => Math.round(n * 100) / 100;
    const src = locBudgetLines.filter((l) => new Date(l.date).getFullYear() === fromYear);
    const key = (l) => `${l.deviceId || ""}|${l.description}|${l.date}`;
    const existing = new Set(locBudgetLines.map(key));
    const newLines = []; const newVB = [];
    src.forEach((l) => {
      const dev = l.deviceId ? deviceById[l.deviceId] : null;
      if (dev?.archived) return;
      const date = shiftFor(selectedLocationId, addMonths(l.date, 12));
      const line = { id: uid(), locationId: selectedLocationId, deviceId: l.deviceId || null, category: l.category, subCategory: l.subCategory || "", supplierId: l.supplierId || null, description: l.description, date, amount: round((Number(l.amount) || 0) * f), status: "planned", addedBy: currentUser?.name, source: "rolled", poNumber: "" };
      if (existing.has(key(line))) return;
      newLines.push(line);
      if (l.deviceId && !visitBudgets.some((v) => v.deviceId === l.deviceId && v.date === date)) newVB.push({ id: uid(), deviceId: l.deviceId, date, amount: line.amount });
    });
    if (newLines.length) persist.budgetLines([...budgetLines, ...newLines]);
    if (newVB.length) persist.visitBudgets([...visitBudgets, ...newVB]);
    let caps = 0;
    if (includeCaps) {
      const add = [];
      locBudgets.filter((b) => b.year === fromYear).forEach((b) => {
        if (locBudgets.some((x) => x.year === fromYear + 1 && x.category === b.category)) return;
        add.push({ id: uid(), locationId: selectedLocationId, year: fromYear + 1, category: b.category, amount: round((Number(b.amount) || 0) * f) }); caps++;
      });
      if (add.length) persist.budgets([...budgets, ...add]);
    }
    showToast(`${fromYear + 1} plan created: ${newLines.length} line${newLines.length === 1 ? "" : "s"}${caps ? `, ${caps} budget cap${caps === 1 ? "" : "s"}` : ""}`, upliftPct ? `${upliftPct}% uplift` : "no uplift");
    return newLines.length;
  }
  function archiveDevice(id) {
    const dev = deviceById[id]; if (!dev) return;
    const today = new Date().toISOString().slice(0, 10);
    withUndo(() => {
      persist.devices(devices.map((d) => d.id === id ? { ...d, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser?.name, nextServiceDate: null } : d));
      // Drop future planned visits and unrecorded budget lines — nothing more will be spent on it.
      persist.visitBudgets(visitBudgets.filter((v) => !(v.deviceId === id && v.date >= today)));
      persist.budgetLines(budgetLines.filter((l) => !(l.deviceId === id && l.actualAmount == null && l.date >= today)));
      showToast("Service archived", dev.name);
    });
    setDeviceModal(null);
  }
  function restoreDevice(id) {
    persist.devices(devices.map((d) => d.id === id ? { ...d, archived: false, archivedAt: null, archivedBy: null } : d));
    showToast("Service restored — edit it to set the next due date", deviceById[id]?.name);
  }
  function saveBooking(id, booking) {
    const dev = deviceById[id]; if (!dev) return;
    persist.devices(devices.map((d) => d.id === id ? { ...d, booking: booking ? { ...booking, forDue: d.nextServiceDate, by: currentUser?.name, at: new Date().toISOString() } : null } : d));
    showToast(booking ? (booking.status === "confirmed" ? "Visit confirmed" : "Visit booked") : "Booking cleared", `${dev.name}${booking?.date ? ` — ${fmtDate(booking.date)}${booking.time ? ` ${booking.time}` : ""}` : ""}`);
  }
  function addDeviceNote(id, text) {
    const entry = { id: uid(), at: new Date().toISOString(), by: currentUser?.name || "Unknown", text: text.trim() };
    persist.devices(devices.map((d) => d.id === id ? { ...d, notesLog: [entry, ...(d.notesLog || [])] } : d));
    showToast("Note added", deviceById[id]?.name);
  }
  function deleteDeviceNote(id, noteId) {
    persist.devices(devices.map((d) => d.id === id ? { ...d, notesLog: (d.notesLog || []).filter((n) => n.id !== noteId) } : d));
  }
  // Log the same visit against several services at once (e.g. a weekly cleaning round).
  function bulkLogVisits(ids, { date, technician, notes, useBudgetCost }) {
    const now = new Date().toISOString();
    const t = (x) => new Date(x + "T00:00:00").getTime();
    let nextServices = services; let nextLines = budgetLines; let linesChanged = false;
    const devPatch = {}; const names = [];
    ids.forEach((id) => {
      const dev = deviceById[id]; if (!dev) return;
      names.push(dev.name);
      const visitId = uid();
      const cost = useBudgetCost ? Number(dev.budgetPerVisit) || 0 : 0;
      nextServices = [{ id: visitId, deviceId: id, name: `${(CATEGORY_META[dev.serviceCategory] || CATEGORY_META.maintenance).label} visit`, date, technician, supplierId: dev.supplierId || null, notes, cost, loggedBy: currentUser?.name, loggedAt: now, bulk: true }, ...nextServices];
      const due = dev.nextServiceDate || date;
      const twoWeeksBefore = addDays(date, -14);
      const anchor = due > twoWeeksBefore ? due : twoWeeksBefore;
      devPatch[id] = { lastServiceDate: dev.lastServiceDate && dev.lastServiceDate > date ? dev.lastServiceDate : date, nextServiceDate: nextDueAfter(dev, anchor, due) };
      if (cost) {
        const lines = nextLines.filter((l) => l.deviceId === id && l.actualAmount == null);
        const target = lines.find((l) => l.date === due) || lines.filter((l) => t(l.date) <= t(date) + 14 * 86400000).sort((a, b) => a.date.localeCompare(b.date))[0];
        if (target) { linesChanged = true; nextLines = nextLines.map((l) => l.id === target.id ? { ...l, actualAmount: cost, actualDate: date, status: "completed", actualSource: "visit", actualServiceId: visitId } : l); }
      }
    });
    persist.services(nextServices);
    persist.devices(devices.map((d) => devPatch[d.id] ? { ...d, ...devPatch[d.id] } : d));
    if (linesChanged) persist.budgetLines(nextLines);
    showToast(`${names.length} visit${names.length === 1 ? "" : "s"} logged`, names.join(", ").slice(0, 200));
  }
  function duplicateDevice(dev) {
    const { id, lastServiceDate, chaseLog, rescheduleLog, sourceWorkId, ...rest } = dev;
    setDeviceModal({ prefill: { ...rest, name: `${dev.name} (copy)`, assetTag: "", serialNumber: "" } });
  }

  /* ---- mutators ---- */
  function ensureUser(name, role) {
    const existing = users.find((u) => u.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) { saveNav({ currentUserId: existing.id }); return; }
    const newUser = { id: uid(), name: name.trim(), role: role || "admin" };
    persist.users([...users, newUser]);
    saveNav({ currentUserId: newUser.id });
  }
  function addCountry(name, currency) {
    const c = { id: uid(), name: name.trim(), currency: currency || "GBP" };
    persist.countries([...countries, c]);
    saveNav({ selectedCountryId: c.id, selectedLocationId: null });
    setShowAddCountry(false);
  }
  function addLocation(countryId, name, address) {
    const l = { id: uid(), countryId, name: name.trim(), address: address.trim() };
    persist.locations([...locations, l]);
    saveNav({ selectedCountryId: countryId, selectedLocationId: l.id });
    setShowAddLocation(null);
    setShowLocationPicker(false);
  }
  function chooseLocation(countryId, locationId) {
    saveNav({ selectedCountryId: countryId, selectedLocationId: locationId });
    setShowLocationPicker(false);
  }
  function saveDevice(device) {
    const isEdit = !!device.id;
    const { scheduleDates: rawDates, ...deviceFields } = device;
    // New schedules are moved out of blackout periods (and weekends, if that's switched on).
    const scheduleDates = rawDates ? [...new Set(rawDates.map((d) => shiftFor(deviceFields.locationId, d)))].sort() : rawDates;
    if (!isEdit && deviceFields.nextServiceDate) deviceFields.nextServiceDate = scheduleDates?.[0] || shiftFor(deviceFields.locationId, deviceFields.nextServiceDate);
    if (isEdit) {
      persist.devices(devices.map((d) => d.id === device.id ? { ...d, ...deviceFields } : d));
      setDeviceModal(null);
      showToast("Service updated", device.name);
      return;
    }
    const newId = uid();
    persist.devices([...devices, { ...deviceFields, id: newId }]);
    // A repeat schedule was chosen — create matching visit budgets and Budget
    // Plan lines for each date, so the service and Budget tab stay linked.
    if (scheduleDates && scheduleDates.length > 0 && deviceFields.budgetPerVisit) {
      const newVisitBudgets = scheduleDates.map((date) => ({ id: uid(), deviceId: newId, date, amount: deviceFields.budgetPerVisit }));
      persist.visitBudgets([...visitBudgets, ...newVisitBudgets]);
      const newBudgetLines = scheduleDates.map((date) => ({
        id: uid(), locationId: deviceFields.locationId, deviceId: newId, category: deviceFields.serviceCategory, subCategory: deviceFields.subCategory,
        supplierId: deviceFields.supplierId || null,
        description: deviceFields.name, date, amount: deviceFields.budgetPerVisit, status: "planned", addedBy: currentUser?.name,
      }));
      persist.budgetLines([...budgetLines, ...newBudgetLines]);
    }
    setDeviceModal(null);
    showToast(scheduleDates && scheduleDates.length > 1 ? `Service added with ${scheduleDates.length} planned visits` : "Service added", deviceFields.name);
  }
  function deleteDevice(id) {
    withUndo(() => {
      persist.devices(devices.filter((d) => d.id !== id));
      persist.services(services.filter((s) => s.deviceId !== id));
      persist.works(works.filter((w) => w.deviceId !== id));
      persist.deviceTasks(deviceTasks.filter((t) => t.deviceId !== id));
      persist.visitBudgets(visitBudgets.filter((v) => v.deviceId !== id));
      showToast("Service deleted", deviceById[id]?.name);
    });
  }
  // Planned dates for a service: its visit-budget schedule, if it has one.
  function blackoutsFor(locationId) { return (settings.blackouts || []).filter((b) => !b.locationId || b.locationId === locationId); }
  function shiftFor(locationId, iso) { return shiftDate(iso, blackoutsFor(locationId), !!settings.avoidWeekends); }
  function plannedDatesFor(deviceId) {
    return [...new Set(visitBudgets.filter((v) => v.deviceId === deviceId).map((v) => v.date))].sort();
  }
  // The due date that comes after `anchor`: next planned date, else step the repeat interval, else none.
  function nextDueAfter(dev, anchor, fromDue) {
    const planned = plannedDatesFor(dev.id).filter((d) => d > anchor);
    if (planned.length) return planned[0];
    if (dev.serviceIntervalMonths && fromDue) {
      let d = fromDue;
      do { d = addMonths(d, dev.serviceIntervalMonths); } while (d <= anchor);
      return shiftFor(dev.locationId, d);
    }
    return null;
  }
  // Logging a NEW visit completes the occurrence that is currently due — however early or late
  // it's logged — and moves the service on to the following one.
  function advanceSchedule(deviceId, visitDate, updatedServices) {
    const dev = deviceById[deviceId];
    if (!dev) return null;
    const due = dev.nextServiceDate || visitDate;
    const twoWeeksBefore = (() => { const x = new Date(visitDate + "T00:00:00"); x.setDate(x.getDate() - 14); return x.toISOString().slice(0, 10); })();
    const anchor = due > twoWeeksBefore ? due : twoWeeksBefore; // a very late visit also covers occurrences it overlapped
    const next = nextDueAfter(dev, anchor, due);
    const lastDate = updatedServices.filter((s) => s.deviceId === deviceId && s.date).reduce((m, s) => (s.date > m ? s.date : m), visitDate);
    persist.devices(devices.map((d) => d.id === deviceId ? { ...d, lastServiceDate: lastDate, nextServiceDate: next } : d));
    return due;
  }
  // After editing or deleting a visit, rebuild from the latest remaining visit.
  function recomputeSchedule(deviceId, updatedServices) {
    const dev = deviceById[deviceId];
    if (!dev) return;
    const forDevice = updatedServices.filter((s) => s.deviceId === deviceId && s.date && !s.aborted);
    if (forDevice.length === 0) {
      const planned = plannedDatesFor(deviceId);
      persist.devices(devices.map((d) => d.id === deviceId ? { ...d, lastServiceDate: null, nextServiceDate: planned.find((x) => x >= new Date().toISOString().slice(0, 10)) || planned[0] || d.nextServiceDate } : d));
      return;
    }
    const lastDate = forDevice.reduce((max, s) => (s.date > max ? s.date : max), forDevice[0].date);
    const planned = plannedDatesFor(deviceId);
    let covered = null; // the planned occurrence the latest visit most plausibly fulfilled: the last one on or before visit+14d
    const plus14 = (() => { const x = new Date(lastDate + "T00:00:00"); x.setDate(x.getDate() + 14); return x.toISOString().slice(0, 10); })();
    planned.forEach((d) => { if (d <= plus14) covered = d; });
    const next = covered ? nextDueAfter(dev, covered, covered) : (dev.serviceIntervalMonths ? addMonths(lastDate, dev.serviceIntervalMonths) : null);
    persist.devices(devices.map((d) => d.id === deviceId ? { ...d, lastServiceDate: lastDate, nextServiceDate: next } : d));
  }
  // A logged visit's cost should also mark the matching auto-generated Budget Plan
  // line as recorded, so the Plan doesn't sit forever showing "not yet spent" for
  // work that's actually been done and paid for.
  function syncBudgetLineForVisit(deviceId, visitDate, visitCost, visitId, dueDate) {
    if (visitCost == null || visitCost === "") return;
    const deviceLines = budgetLines.filter((l) => l.deviceId === deviceId);
    if (deviceLines.length === 0) return;
    const t = (d) => new Date(d + "T00:00:00").getTime();
    // 1) the line this visit already filled (editing), 2) the line for the occurrence it completed,
    // 3) the earliest line with nothing recorded yet up to 2 weeks after the visit, 4) nearest by date.
    let target = deviceLines.find((l) => visitId && l.actualServiceId === visitId)
      || (dueDate && deviceLines.find((l) => l.date === dueDate && (l.actualAmount == null || isMirrored(l) && l.actualServiceId === visitId)))
      || deviceLines.filter((l) => l.actualAmount == null && t(l.date) <= t(visitDate) + 14 * 86400000).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!target) {
      let best = Infinity;
      deviceLines.filter((l) => l.actualAmount == null).forEach((l) => { const diff = Math.abs(t(l.date) - t(visitDate)); if (diff < best) { best = diff; target = l; } });
    }
    if (!target) return;
    persist.budgetLines(budgetLines.map((l) => l.id === target.id ? { ...l, actualAmount: Number(visitCost), actualDate: visitDate, status: "completed", actualSource: "visit", actualServiceId: visitId || null } : l));
  }
  function saveService(record) {
    const isEdit = !!record.id;
    const visitId = isEdit ? record.id : uid();
    let next;
    if (isEdit) {
      next = services.map((s) => s.id === record.id ? { ...s, ...record, updatedBy: currentUser?.name, updatedAt: new Date().toISOString() } : s);
    } else {
      next = [{ ...record, id: visitId, loggedBy: currentUser?.name, loggedAt: new Date().toISOString() }, ...services];
    }
    persist.services(next);
    if (record.aborted) {
      // Supplier attended but couldn't complete: keep the record, don't move the schedule on.
      if (isEdit) recomputeSchedule(record.deviceId, next);
      if (!isEdit) persist.devices(devices.map((d) => d.id === record.deviceId ? { ...d, abortLog: [...(d.abortLog || []), { date: record.date, reason: record.abortReason, by: currentUser?.name }] } : d));
      setServiceModal(null);
      showToast("Visit recorded as not completed", `${deviceById[record.deviceId]?.name || ""} — ${record.abortReason || ""}`);
      return;
    }
    const completedDue = isEdit ? null : advanceSchedule(record.deviceId, record.date || new Date().toISOString().slice(0, 10), next);
    if (isEdit) recomputeSchedule(record.deviceId, next);
    if (record.date && record.cost) syncBudgetLineForVisit(record.deviceId, record.date, record.cost, visitId, completedDue);
    // Failed checklist items become high-priority follow-up works — only for items that
    // weren't already failed on a previous save of this same visit, so edits don't duplicate them.
    const prevFails = new Set(isEdit ? (services.find((s) => s.id === record.id)?.checklistResults || []).filter((r) => r.result === "fail").map((r) => r.item) : []);
    const newFails = (record.checklistResults || []).filter((r) => r.result === "fail" && !prevFails.has(r.item));
    if (newFails.length) {
      const dev = deviceById[record.deviceId];
      const followUps = newFails.map((r) => ({
        id: uid(), deviceId: record.deviceId, description: `Failed check: ${r.item}${r.note ? ` — ${r.note}` : ""}`,
        quoteAmount: 0, dateRaised: record.date || new Date().toISOString().slice(0, 10), status: "requested",
        budgetType: "budgeted", photos: [], priority: "high", supplierId: record.supplierId || dev?.supplierId || null,
        comments: [], source: "checklist", loggedBy: currentUser?.name, loggedAt: new Date().toISOString(),
      }));
      persist.works([...followUps, ...works]);
      showToast(`Visit logged · ${newFails.length} follow-up job${newFails.length === 1 ? "" : "s"} created`);
      setServiceModal(null);
      return;
    }
    setServiceModal(null);
    showToast(isEdit ? "Visit updated" : "Visit logged", deviceById[record.deviceId]?.name);
  }
  function deleteService(id, deviceId) { withUndo(() => deleteServiceInner(id, deviceId)); }
  function deleteServiceInner(id, deviceId) {
    const next = services.filter((s) => s.id !== id);
    persist.services(next);
    recomputeSchedule(deviceId, next);
    if (budgetLines.some((l) => l.actualServiceId === id)) {
      persist.budgetLines(budgetLines.map((l) => l.actualServiceId === id ? { ...l, actualAmount: null, actualDate: null, status: "planned", actualSource: null, actualServiceId: null } : l));
    }
    setServiceModal(null);
    showToast("Visit deleted", deviceById[deviceId]?.name);
  }
  function addWork(work) {
    persist.works([{ ...work, id: uid(), loggedBy: currentUser?.name, loggedAt: new Date().toISOString() }, ...works]);
    setAddWorkFor(null);
    showToast("Extra work added", `${deviceById[work.deviceId]?.name || ""} — ${String(work.description || "").slice(0, 60)}`);
  }
  function updateWorkStatus(id, status) { updateWork(id, { status }); }
  function convertWorkToPlanLine(work) {
    const dev = deviceById[work.deviceId];
    persist.budgetLines([...budgetLines, {
      id: uid(), locationId: dev?.locationId || selectedLocationId, deviceId: work.deviceId, category: dev?.serviceCategory || "maintenance",
      subCategory: dev?.subCategory || "", supplierId: work.supplierId || null, description: work.description.slice(0, 80),
      date: work.dateRaised || new Date().toISOString().slice(0, 10), amount: Number(work.quoteAmount) || 0, status: "planned",
      addedBy: currentUser?.name, sourceWorkId: work.id, poNumber: work.poNumber || "",
    }]);
    persist.works(works.map((w) => w.id === work.id ? { ...w, convertedTo: [...(w.convertedTo || []), { type: "plan", at: new Date().toISOString(), by: currentUser?.name }] } : w));
    showToast("Added to Budget Plan");
  }
  function convertWorkToService(work) {
    const dev = deviceById[work.deviceId];
    const newId = uid();
    persist.devices([...devices, {
      id: newId, name: work.description.slice(0, 60), assetTag: "", category: dev?.category || "", serviceCategory: dev?.serviceCategory || "maintenance",
      subCategory: dev?.subCategory || "", locationId: dev?.locationId || selectedLocationId, supplierId: work.supplierId || dev?.supplierId || null,
      checklist: [], serviceIntervalMonths: null, nextServiceDate: new Date().toISOString().slice(0, 10), lastServiceDate: null,
      budgetPerVisit: Number(work.quoteAmount) || 0, sourceWorkId: work.id,
    }]);
    persist.works(works.map((w) => w.id === work.id ? { ...w, convertedTo: [...(w.convertedTo || []), { type: "service", id: newId, at: new Date().toISOString(), by: currentUser?.name }] } : w));
    showToast("New service created — edit it to set its schedule");
  }
  function rescheduleDevice(deviceId, newDate) {
    const dev = deviceById[deviceId];
    if (!dev || !newDate || newDate === dev.nextServiceDate) return;
    const from = dev.nextServiceDate;
    const entry = { from, to: newDate, by: currentUser?.name || "Unknown", at: new Date().toISOString() };
    persist.devices(devices.map((d) => d.id === deviceId ? { ...d, nextServiceDate: newDate, rescheduleLog: [...(d.rescheduleLog || []), entry] } : d));
    if (from) {
      if (visitBudgets.some((v) => v.deviceId === deviceId && v.date === from)) persist.visitBudgets(visitBudgets.map((v) => v.deviceId === deviceId && v.date === from ? { ...v, date: newDate } : v));
      if (budgetLines.some((l) => l.deviceId === deviceId && l.date === from && l.actualAmount == null)) persist.budgetLines(budgetLines.map((l) => l.deviceId === deviceId && l.date === from && l.actualAmount == null ? { ...l, date: newDate } : l));
    }
    const b = inBlackout(newDate, blackoutsFor(dev.locationId));
    showToast(b ? `Moved to ${fmtDate(newDate)} — note: that's inside "${b.name}"` : `${dev.name} moved to ${fmtDate(newDate)}`);
  }
  function rescheduleTask(taskId, newDate) {
    persist.deviceTasks(deviceTasks.map((t) => t.id === taskId ? { ...t, nextDate: newDate } : t));
    showToast(`Task moved to ${fmtDate(newDate)}`);
  }
  // Push every future planned date at this location out of blackouts / weekends.
  function shiftPlannedOutOfBlackouts() {
    const today = new Date().toISOString().slice(0, 10);
    const locIds = new Set(locDevices.map((d) => d.id));
    const mv = (d) => (d && d >= today ? shiftFor(selectedLocationId, d) : d);
    let moved = 0;
    const nextDevices = devices.map((d) => { if (!locIds.has(d.id)) return d; const n = mv(d.nextServiceDate); if (n !== d.nextServiceDate) { moved++; return { ...d, nextServiceDate: n }; } return d; });
    const nextVB = visitBudgets.map((v) => { if (!locIds.has(v.deviceId)) return v; const n = mv(v.date); if (n !== v.date) { moved++; return { ...v, date: n }; } return v; });
    const nextBL = budgetLines.map((l) => { if (l.locationId !== selectedLocationId || l.actualAmount != null) return l; const n = mv(l.date); return n !== l.date ? { ...l, date: n } : l; });
    const nextTasks = deviceTasks.map((t) => { if (!locIds.has(t.deviceId)) return t; const n = mv(t.nextDate); if (n !== t.nextDate) { moved++; return { ...t, nextDate: n }; } return t; });
    persist.devices(nextDevices); persist.visitBudgets(nextVB); persist.budgetLines(nextBL); persist.deviceTasks(nextTasks);
    return moved;
  }
  function saveLocationBlackouts(list, avoidWeekends) {
    const others = (settings.blackouts || []).filter((b) => b.locationId && b.locationId !== selectedLocationId);
    persist.settings({ ...settings, blackouts: [...others, ...list.map((b) => ({ ...b, locationId: selectedLocationId }))], avoidWeekends });
  }
  function applySuggestedPlan(entries) {
    const newVB = []; const newBL = [];
    entries.forEach(({ deviceId, dates, amount }) => {
      const dev = deviceById[deviceId]; if (!dev) return;
      dates.forEach((date) => {
        newVB.push({ id: uid(), deviceId, date, amount });
        newBL.push({ id: uid(), locationId: dev.locationId, deviceId, category: dev.serviceCategory || "maintenance", subCategory: dev.subCategory || "", supplierId: dev.supplierId || null, description: dev.name, date, amount, status: "planned", addedBy: currentUser?.name, source: "suggested" });
      });
    });
    persist.visitBudgets([...visitBudgets, ...newVB]); persist.budgetLines([...budgetLines, ...newBL]);
    const firstByDev = {}; entries.forEach((e) => { firstByDev[e.deviceId] = e.dates[0]; });
    persist.devices(devices.map((d) => firstByDev[d.id] && !d.nextServiceDate ? { ...d, nextServiceDate: firstByDev[d.id] } : d));
    showToast(`Added ${newBL.length} planned visits across ${entries.length} service${entries.length === 1 ? "" : "s"}`);
  }
  // A scanned code can be one of our QR sticker links (?service= / ?request=) or a printed asset tag.
  function findScannedDevice(text) {
    const raw = String(text || "").trim();
    let id = null;
    try { const u = new URL(raw); id = u.searchParams.get("service") || u.searchParams.get("request"); } catch (e) { /* not a URL */ }
    if (id && deviceById[id]) return deviceById[id];
    const tag = raw.toLowerCase();
    return devices.find((d) => d.assetTag && d.assetTag.trim().toLowerCase() === tag) || devices.find((d) => d.id === raw) || null;
  }
  function handleScan(text) {
    const dev = findScannedDevice(text);
    if (!dev) return false;
    setShowScanner(false);
    if (dev.locationId !== selectedLocationId) {
      const loc = locationById[dev.locationId];
      setSelectedLocationId(dev.locationId); if (loc) setSelectedCountryId(loc.countryId);
      saveNav({ selectedLocationId: dev.locationId, selectedCountryId: loc?.countryId || selectedCountryId });
    }
    setTab("devices");
    if (ACTIVE_CAN_EDIT) setQuickLog({ deviceId: dev.id }); else setHistoryFor(dev.id);
    return true;
  }
  // How many records use each category (a category in use can't be deleted).
  const categoryUsage = (() => {
    const u = {};
    const bump = (k) => { if (k) u[k] = (u[k] || 0) + 1; };
    devices.forEach((d) => bump(d.serviceCategory)); suppliers.forEach((x) => bump(x.category)); budgetLines.forEach((l) => bump(l.category)); budgets.forEach((b) => bump(b.category));
    return u;
  })();
  function recordChase(deviceIds, supplierId) {
    const entry = { at: new Date().toISOString(), by: currentUser?.name || "Unknown", supplierId: supplierId || null };
    persist.devices(devices.map((d) => deviceIds.includes(d.id) ? { ...d, chaseLog: [...(d.chaseLog || []), entry] } : d));
    showToast(`Chase logged for ${deviceIds.length} job${deviceIds.length === 1 ? "" : "s"}`);
  }
  function updateWork(id, patch) {
    const today = new Date().toISOString().slice(0, 10);
    persist.works(works.map((w) => {
      if (w.id !== id) return w;
      const extra = patch.status === "completed" && w.status !== "completed" ? { completedAt: today } : patch.status && patch.status !== "completed" ? { completedAt: null } : {};
      return { ...w, ...patch, ...extra };
    }));
  }
  function deleteWork(id) { const w = works.find((x) => x.id === id); withUndo(() => { persist.works(works.filter((x) => x.id !== id)); showToast("Extra work deleted", w?.description?.slice(0, 60)); }); }
  function saveSupplier(supplier) {
    if (supplier.id) {
      persist.suppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, ...supplier } : s));
      showToast("Supplier updated", supplier.name);
    } else {
      persist.suppliers([{ ...supplier, id: uid(), locationId: selectedLocationId }, ...suppliers]);
      showToast("Supplier added", supplier.name);
    }
    setSupplierModal(null);
  }
  function deleteSupplier(id) { const sup = supplierById[id]; withUndo(() => { persist.suppliers(suppliers.filter((s) => s.id !== id)); showToast("Supplier deleted", sup?.name); }); setSupplierModal(null); }
  function setCategoryBudget(year, category, amount) {
    const existing = locBudgets.find((b) => b.year === year && b.category === category);
    if (existing) {
      persist.budgets(budgets.map((b) => b.id === existing.id ? { ...b, amount } : b));
    } else {
      persist.budgets([...budgets, { id: uid(), locationId: selectedLocationId, year, category, amount }]);
    }
    showToast("Budget updated");
  }
  function addBudgetLines(lines) {
    const withIds = lines.map((l) => ({ ...l, id: uid(), locationId: selectedLocationId, status: "planned", addedBy: currentUser?.name }));
    persist.budgetLines([...withIds, ...budgetLines]);
    showToast(lines.length > 1 ? `${lines.length} contract lines added` : "Contract line added");
  }
  function updateBudgetLine(id, patch) {
    persist.budgetLines(budgetLines.map((l) => l.id === id ? { ...l, ...patch } : l));
    if (patch.status) showToast(patch.status === "completed" ? "Marked completed" : "Marked planned");
    else showToast("Contract line updated");
  }
  function deleteBudgetLine(id) {
    const line = budgetLines.find((l) => l.id === id);
    withUndo(() => { persist.budgetLines(budgetLines.filter((l) => l.id !== id)); showToast("Contract line deleted", line?.description); });
  }
  function addDeviceTask(task) {
    persist.deviceTasks([...deviceTasks, { ...task, id: uid() }]);
    showToast("Task added");
  }
  function updateDeviceTask(id, patch) {
    persist.deviceTasks(deviceTasks.map((t) => t.id === id ? { ...t, ...patch } : t));
    showToast("Task updated");
  }
  function markTaskDone(id) {
    const task = deviceTasks.find((t) => t.id === id);
    if (!task) return;
    const today = new Date().toISOString().slice(0, 10);
    const nextDate = task.intervalMonths ? addMonths(today, task.intervalMonths) : task.nextDate;
    persist.deviceTasks(deviceTasks.map((t) => t.id === id ? { ...t, lastDoneDate: today, nextDate } : t));
    showToast("Task marked done");
  }
  function deleteDeviceTask(id) {
    const task = deviceTasks.find((t) => t.id === id);
    withUndo(() => { persist.deviceTasks(deviceTasks.filter((t) => t.id !== id)); showToast("Task deleted", task?.name); });
  }
  function addVisitBudget(vb) {
    persist.visitBudgets([...visitBudgets, { ...vb, id: uid() }]);
    showToast("Visit budget added");
  }
  function updateVisitBudget(id, patch) {
    persist.visitBudgets(visitBudgets.map((v) => v.id === id ? { ...v, ...patch } : v));
    showToast("Visit budget updated");
  }
  function deleteVisitBudget(id) {
    withUndo(() => { persist.visitBudgets(visitBudgets.filter((v) => v.id !== id)); showToast("Visit budget deleted"); });
  }
  function syncDeviceToBudgetPlan(deviceId) {
    const dev = deviceById[deviceId];
    if (!dev || !dev.budgetPerVisit) { showToast("Set a budget per visit first"); return; }
    const existingDates = new Set(visitBudgets.filter((v) => v.deviceId === deviceId).map((v) => v.date));
    const startDate = dev.nextServiceDate || new Date().toISOString().slice(0, 10);
    const count = dev.serviceIntervalMonths ? Math.max(1, Math.ceil(12 / dev.serviceIntervalMonths)) : 1;
    const dates = Array.from({ length: count }, (_, i) => dev.serviceIntervalMonths ? addMonths(startDate, i * dev.serviceIntervalMonths) : startDate)
      .filter((d) => !existingDates.has(d));
    if (dates.length === 0) { showToast("Already up to date"); return; }
    const newVisitBudgets = dates.map((date) => ({ id: uid(), deviceId, date, amount: dev.budgetPerVisit }));
    persist.visitBudgets([...visitBudgets, ...newVisitBudgets]);
    const newBudgetLines = dates.map((date) => ({
      id: uid(), locationId: dev.locationId, deviceId, category: dev.serviceCategory, subCategory: dev.subCategory,
      supplierId: dev.supplierId || null, description: dev.name, date, amount: dev.budgetPerVisit, status: "planned", addedBy: currentUser?.name,
    }));
    persist.budgetLines([...budgetLines, ...newBudgetLines]);
    showToast(`Added ${dates.length} line${dates.length === 1 ? "" : "s"} to Budget Plan`);
  }

  // Rough size of everything saved. Browser storage (used outside Claude) holds about 5 MB.
  const storageInfo = useMemo(() => {
    const local = typeof window !== "undefined" && !!window.storage?.__local;
    const chars = Object.values(allData).reduce((sum, v) => sum + JSON.stringify(v || "").length, 0);
    const limit = 5 * 1024 * 1024;
    return { local, chars, pct: Math.min(100, Math.round((chars / limit) * 100)) };
  }, [users, countries, locations, devices, services, works, suppliers, budgets, budgetLines, deviceTasks, visitBudgets, settings, activity, meters, meterReadings, signins, spares, keysList, reminders, audits, incidents, projects, permits, waste]);

  const navItems = [
    { key: "home", label: "Home", icon: LayoutDashboard },
    { key: "devices", label: "Services", icon: Wrench },
    { key: "schedule", label: "Schedule", icon: Calendar, alert: overdueCount > 0 },
    { key: "certificates", label: "Completed", icon: FileCheck },
    { key: "works", label: "Works", icon: Receipt },
    { key: "suppliers", label: "Suppliers", icon: UsersIcon },
    { key: "budget", label: "Budget", icon: PoundSterling },
    { key: "meters", label: "Site", icon: Activity },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "#8A94A0", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <Loader2 size={20} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} /> Loading service book…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Every gbp() call made anywhere in this render pass reads this — set it
  // synchronously before the tree below renders.
  ACTIVE_CURRENCY_CODE = selectedCountry?.currency || "GBP";
  applyCategorySettings(settings);
  ACTIVE_CUSTOM_FIELDS = settings.customFields || [];
  ACTIVE_TEMPLATES = [...BUILTIN_TEMPLATES, ...(settings.serviceTemplates || [])];
  ACTIVE_CAN_EDIT = currentUser?.role !== "viewer";
  ACTIVE_USERS = users;
  AREA_SUGGESTIONS_CACHE = {}; devices.forEach((d) => { if (d.area) (AREA_SUGGESTIONS_CACHE[d.locationId] = AREA_SUGGESTIONS_CACHE[d.locationId] || []).includes(d.area) || AREA_SUGGESTIONS_CACHE[d.locationId].push(d.area); });

  const needsProfile = !currentUser;
  const needsLocation = !needsProfile && !selectedLocation;

  return (
    <div style={{ background: "#D7DCE1", minHeight: "100%", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #A3ABB4; }
        button { transition: opacity .15s ease; }
        button:hover { opacity: 0.88; }
        button:active { opacity: 0.7; }
        .ppm-shell { width: 100%; max-width: 100%; }
        html.ppm-dark { filter: invert(0.9) hue-rotate(180deg); background: #fff; }
        html.ppm-dark img, html.ppm-dark .recharts-surface { filter: invert(1) hue-rotate(180deg); }
        @media (min-width: 640px) {
          .ppm-shell { max-width: 460px; box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 24px 70px rgba(0,0,0,0.18); }
        }
      `}</style>
      <div className="ppm-shell" style={{ zoom: display.scale && display.scale !== 1 ? display.scale : undefined, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: "#EEF0F2", color: "#1B2430", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#1B2430", padding: "16px 18px", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#2B4562", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wrench size={18} color="#D97706" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: 0.2 }}>PPM Service Book</div>
              <div style={{ fontSize: 11.5, color: "#9AA5B1" }}>Planned maintenance &amp; asset log</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!needsProfile && selectedLocationId && (
            <>
              {ACTIVE_CAN_EDIT && <button onClick={() => setShowSettings(true)} title="Settings" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 20, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <SlidersHorizontal size={15} color="#fff" />
              </button>}
              <button onClick={() => setShowReports(true)} title="Reports" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 20, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <FileText size={15} color="#fff" />
              </button>
              <button onClick={() => setShowAlerts(true)} title="Notifications" style={{ position: "relative", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 20, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Bell size={15} color="#fff" />
                {visibleAlerts.filter((a) => a.tone !== "info").length > 0 && (
                  <span style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: "#D97706", color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                    {visibleAlerts.filter((a) => a.tone !== "info").length}
                  </span>
                )}
              </button>
            </>
          )}
          <button onClick={() => setShowUserModal(true)} style={{
            background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 20, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#fff",
          }}>
            <User size={14} />
            <span style={{ fontSize: 12.5, fontWeight: 600, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser ? currentUser.name : "Sign in"}
            </span>
          </button>
          </div>
        </div>

        {!needsProfile && (
          <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowLocationPicker(true)} style={{
            flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10,
            padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, color: "#fff", fontSize: 13, fontWeight: 600 }}>
              <Globe2 size={14} color="#D97706" />
              {selectedLocation ? `${selectedCountry?.name} · ${selectedLocation.name}` : "Choose a country & location"}
            </span>
            <ChevronDown size={15} color="#9AA5B1" />
          </button>
          {selectedLocation && (
            <>
              <button onClick={() => setShowSearch(true)} title="Search everything" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, width: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Search size={15} color="#fff" />
              </button>
              <button onClick={() => setShowData(true)} title="Activity log & backup" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, width: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <History size={15} color="#fff" />
              </button>
            </>
          )}
          </div>
        )}

        {!needsProfile && !needsLocation && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <StatChip label="Overdue" value={overdueCount} tone={overdueCount ? "danger" : "muted"} />
            <StatChip label="Due ≤30d" value={dueSoonCount} tone={dueSoonCount ? "warn" : "muted"} />
            <StatChip label="Open quotes" value={openWorksCount} tone={openWorksCount ? "ok" : "muted"} />
          </div>
        )}
      </div>

      {needsProfile ? (
        <div style={{ padding: 16 }}>
          <EmptyState icon={User} title="Set up your profile" body="Add your name to start logging services, certificates and costs." actionLabel="Set up profile" onAction={() => setShowUserModal(true)} />
        </div>
      ) : needsLocation ? (
        <div style={{ padding: 16 }}>
          <EmptyState icon={Globe2} title="Choose a country and location" body="Everything you log — devices, certificates, suppliers, budgets — belongs to a location." actionLabel="Choose location" onAction={() => setShowLocationPicker(true)} />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #E1E4E8", overflowX: "auto" }}>
            {navItems.map((n) => {
              const active = tab === n.key;
              const Icon = n.icon;
              return (
                <button key={n.key} onClick={() => setTab(n.key)} style={{
                  flex: "1 0 auto", background: "none", border: "none", cursor: "pointer", padding: "11px 8px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  borderBottom: active ? "2.5px solid #2B4562" : "2.5px solid transparent",
                  color: active ? "#1B2430" : "#8A94A0", fontFamily: "inherit",
                }}>
                  <div style={{ position: "relative" }}>
                    <Icon size={17} />
                    {n.alert ? <span style={{ position: "absolute", top: -3, right: -5, width: 7, height: 7, borderRadius: "50%", background: "#C53030" }} /> : null}
                  </div>
                  <span style={{ fontSize: 10.8, fontWeight: 600 }}>{n.label}</span>
                </button>
              );
            })}
          </div>

          {REMOTE && pendingCount > 0 && Object.keys(saveErrors).length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#FDF1E0", borderBottom: "1px solid #F5D9A8", padding: "8px 16px" }}>
              <CloudOff size={15} color="#8A5A0B" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.3, color: "#8A5A0B", fontWeight: 650 }}>Offline — {pendingCount} change{pendingCount === 1 ? "" : "s"} saved on this device, will upload automatically when you're back online.</span>
            </div>
          )}
          {Object.keys(saveErrors).length > 0 && (
            <button onClick={() => setShowData(true)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#9B2C2C", border: "none", padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <AlertTriangle size={15} color="#fff" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#fff", fontWeight: 650, flex: 1 }}>
                {Object.values(saveErrors).includes("Storage is full") ? "Storage is full — your last changes were NOT saved. Download a backup now." : "Some changes could not be saved. Download a backup to be safe."}
              </span>
              <ChevronRight size={14} color="#fff" />
            </button>
          )}
          {storageInfo.local && storageInfo.pct >= 80 && !Object.keys(saveErrors).length && (
            <button onClick={() => setShowData(true)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#FDF1E0", border: "none", borderBottom: "1px solid #F5D9A8", padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <HardDrive size={15} color="#8A5A0B" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#8A5A0B", fontWeight: 650, flex: 1 }}>Storage {storageInfo.pct}% full — mostly photos. Download a backup and remove old photos.</span>
              <ChevronRight size={14} color="#8A5A0B" />
            </button>
          )}
          {overdueCount > 0 && tab !== "schedule" && (
            <button onClick={() => setTab("schedule")} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#FBEAEA", border: "none",
              borderBottom: "1px solid #F3C6C6", padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
              <ShieldAlert size={15} color="#9B2C2C" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#9B2C2C", fontWeight: 650, flex: 1 }}>
                {overdueCount} service{overdueCount === 1 ? "" : "s"} overdue — tap to review
              </span>
              <ChevronRight size={14} color="#9B2C2C" />
            </button>
          )}

          {ACTIVE_CAN_EDIT && !backupNagHidden && locDevices.length > 0 && storageInfo.local && (!settings.lastBackupAt || (Date.now() - new Date(settings.lastBackupAt).getTime()) > 14 * 86400000) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#EAF1F8", borderBottom: "1px solid #C9D9EA", padding: "8px 12px 8px 16px" }}>
              <HardDrive size={15} color="#2B4562" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.3, color: "#2B4562", fontWeight: 600, flex: 1 }}>
                {settings.lastBackupAt ? `Last backup was ${Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / 86400000)} days ago.` : "You haven't backed up yet."}
              </span>
              <button onClick={downloadBackup} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Back up now</button>
              <button onClick={() => setBackupNagHidden(true)} title="Hide for now" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={14} color="#5B6672" /></button>
            </div>
          )}
          <div style={{ flex: 1, padding: 16, paddingBottom: 90 }}>
            {tab === "meters" && (
              <SiteTab
                meters={<MetersTab meters={locMeters} readings={locReadings} suppliers={locSuppliers}
                  onSaveMeter={saveMeter} onArchiveMeter={archiveMeter} onAddReading={addReading} onDeleteReading={deleteReading} />}
                spares={<SparesView spares={locSpares} suppliers={locSuppliers} devices={locDevices} senderName={currentUser?.name}
                  onSave={saveSpare} onAdjust={adjustSpare} onDelete={deleteSpare} />}
                keys={<KeysView keys={locKeys} onSave={saveKey} onIssue={issueKey} onReturn={returnKey} onDelete={deleteKey} />}
                permits={<PermitsView permits={locPermits} devices={locDevices} suppliers={locSuppliers} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })} onSave={savePermit} onClose={closePermit} />}
                waste={<WasteView waste={locWaste} suppliers={locSuppliers} onSave={saveWaste} onDelete={deleteWaste} />}
                openPermits={locPermits.filter((x) => x.status === "open").length}
                audits={<AuditsView audits={locAudits} templates={settings.auditTemplates || DEFAULT_AUDIT_TEMPLATES} suppliers={locSuppliers} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []}
                  locationName={locationLabel({ locationId: selectedLocationId })} senderName={currentUser?.name}
                  onSave={saveAudit} onDelete={deleteAudit} onSaveTemplates={saveAuditTemplates} />}
                incidents={<IncidentsView incidents={locIncidents} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })}
                  onSave={saveIncident} onDelete={deleteIncident} />}
                openIncidents={locIncidents.filter((i) => i.status !== "closed").length}
                counts={{ lowStock: locSpares.filter((x) => x.minQty !== "" && x.minQty != null && Number(x.qty) <= Number(x.minQty)).length, keysOut: locKeys.filter((k) => k.holder).length }} />
            )}
            {tab === "home" && (
              <HomeTab userName={currentUser?.name} devices={locDevices} services={locServices} works={locWorks} visitBudgets={locVisitBudgets}
                alerts={visibleAlerts} activity={activity.filter((a) => a.locationId === selectedLocationId)} spend={spendSummary}
                statutoryNA={(settings.statutoryNA || {})[selectedLocationId] || []}
                onStatutoryNA={(keys) => persist.settings({ ...settings, statutoryNA: { ...(settings.statutoryNA || {}), [selectedLocationId]: keys } })}
                onAddStatutory={(item) => setDeviceModal({ prefill: { certRequired: true, name: item.label, serviceCategory: CATEGORY_META[item.category] ? item.category : "maintenance", serviceIntervalMonths: item.months || null, repeatMode: item.repeatMode || (item.months ? "interval" : "once"), locationId: selectedLocationId } })}
                locationName={locationLabel({ locationId: selectedLocationId })}
                signins={locSignins} suppliers={locSuppliers} onSignIn={signIn} onSignOut={signOut}
                myName={currentUser?.name} myWorks={locWorks.filter((w) => w.assignee && w.assignee === currentUser?.name && !["completed", "rejected"].includes(w.status))}
                emergency={(settings.emergencyContacts || {})[selectedLocationId] || null} onSaveEmergency={saveEmergencyContacts}
                pendingCount={pendingCount}
                setup={{ suppliers: locSuppliers.length, devices: locDevices.length, budgets: locBudgets.length + locBudgetLines.length, visits: locServices.length, backup: !!settings.lastBackupAt || REMOTE, shared: REMOTE, hidden: !!display.hideSetup }}
                onHideSetup={() => saveDisplay({ ...display, hideSetup: true })}
                syncInfo={REMOTE ? { lastSync, syncing, onRefresh: () => refreshShared(true) } : null}
                reminders={locReminders} users={users} onAddReminder={addReminder} onToggleReminder={toggleReminder} onDeleteReminder={deleteReminder}
                onGo={(t) => t === "alerts" ? setShowAlerts(true) : setTab(t)} onOpenDevice={setHistoryFor} />
            )}
            {tab === "devices" && (
              <DevicesTab onLibrary={() => setShowLibrary(true)} faultsByDevice={faultsByDevice} onImport={() => setShowImport(true)} allLocations={locations.filter((l) => l.id !== selectedLocationId).map((l) => ({ id: l.id, label: `${countryById[l.countryId]?.name || ""} · ${l.name}` }))} onCopyTo={copyDevicesToLocation} onBulkUpdate={bulkUpdateDevices} allSuppliers={locSuppliers} archivedDevices={locArchivedDevices} onRestore={restoreDevice} onBulkLog={bulkLogVisits} onBook={saveBooking} prefs={listPrefs} onPrefs={(patch) => setListPrefs((p) => ({ ...p, ...patch }))} devices={searchAllLocations ? globalFilteredDevices : filteredDevices} search={search} setSearch={setSearch}
                onAdd={() => setDeviceModal({})} onEdit={(record) => setDeviceModal({ record })}
                onLogService={(id) => setServiceModal({ deviceId: id })} onAddWork={setAddWorkFor}
                onDelete={deleteDevice} onHistory={setHistoryFor}
                searchAllLocations={searchAllLocations} onToggleSearchAll={setSearchAllLocations}
                locationLabel={locationLabel} chaseDevices={locDevices} supplierById={supplierById}
                onChased={recordChase} currentUserName={currentUser?.name}
                onQuickLog={() => setQuickLog({})} onScan={() => setShowScanner(true)} />
            )}
            {tab === "schedule" && (
              <ScheduleCalendarTab devices={locDevices} services={locServices} tasks={locDeviceTasks}
                visitBudgets={locVisitBudgets} suppliers={locSuppliers} locationName={locationLabel({ locationId: selectedLocationId })}
                blackouts={blackoutsFor(selectedLocationId)} avoidWeekends={!!settings.avoidWeekends}
                onReschedule={rescheduleDevice} onRescheduleTask={rescheduleTask}
                onSaveBlackouts={saveLocationBlackouts} onShiftOutOfBlackouts={shiftPlannedOutOfBlackouts}
                onLogService={(id) => setServiceModal({ deviceId: id })}
                onEditService={(record) => setServiceModal({ deviceId: record.deviceId, record })}
                onMarkTaskDone={markTaskDone} />
            )}
            {tab === "certificates" && (
              <CertificatesTab devices={locDevices} visitBudgets={locVisitBudgets} services={locServices} deviceById={deviceById} supplierById={supplierById}
                onEdit={(record) => setServiceModal({ deviceId: record.deviceId, record })} />
            )}
            {tab === "works" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <ToggleButton active={worksView === "reactive"} onClick={() => setWorksView("reactive")}>Reactive works</ToggleButton>
                <ToggleButton active={worksView === "projects"} onClick={() => setWorksView("projects")}>Projects{locProjects.filter((p) => !["complete"].includes(p.status)).length ? ` (${locProjects.filter((p) => p.status !== "complete").length})` : ""}</ToggleButton>
              </div>
            )}
            {tab === "works" && worksView === "projects" && (
              <ProjectsView projects={locProjects} devices={locDevices} suppliers={locSuppliers} onSave={saveProject} onDelete={deleteProject} />
            )}
            {tab === "works" && worksView === "reactive" && (
              <WorksTab works={locWorks} deviceById={deviceById} supplierById={supplierById} suppliers={locSuppliers}
                onUpdate={updateWork} onDelete={deleteWork} currentUserName={currentUser?.name}
                approvalThreshold={Number(settings.approvalThreshold) || 0} onSetThreshold={(v) => { persist.settings({ ...settings, approvalThreshold: v }); showToast("Approval rule saved"); }}
                onConvertToPlan={convertWorkToPlanLine} onConvertToService={convertWorkToService}
                onAdd={() => setAddWorkFor(locDevices[0]?.id ?? null)} hasDevices={locDevices.length > 0} />
            )}
            {tab === "suppliers" && (
              <SuppliersTab suppliers={locSuppliers} onAdd={() => setSupplierModal({})} onEdit={(record) => setSupplierModal({ record })} onDelete={deleteSupplier}
                devices={locDevices} services={locServices} works={locWorks} budgetLines={locBudgetLines} visitBudgets={locVisitBudgets} />
            )}
            {tab === "budget" && (
              <BudgetTab key={CATEGORY_KEYS.join("|")} budgets={locBudgets} services={locServices} works={locWorks} suppliers={locSuppliers}
                devices={locDevices} budgetLines={locBudgetLines} visitBudgets={locVisitBudgets} onSetBudget={setCategoryBudget}
                subcategoriesByCategory={subcategoriesByCategory}
                onAddLines={addBudgetLines} onUpdateLine={updateBudgetLine} onDeleteLine={deleteBudgetLine}
                onApplySuggestion={applySuggestedPlan} onRollForward={rollPlanForward} shiftDateFn={(iso) => shiftFor(selectedLocationId, iso)} />
            )}
          </div>

          {tab === "devices" && ACTIVE_CAN_EDIT && (
            <button onClick={() => setDeviceModal({})} style={{
              position: "fixed", bottom: 20, right: "max(20px, calc((100vw - 460px) / 2 + 20px))", width: 54, height: 54, borderRadius: "50%",
              background: "#D97706", color: "#fff", border: "none", boxShadow: "0 6px 16px rgba(217,119,6,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}><Plus size={24} /></button>
          )}
          {tab === "suppliers" && ACTIVE_CAN_EDIT && (
            <button onClick={() => setSupplierModal({})} style={{
              position: "fixed", bottom: 20, right: "max(20px, calc((100vw - 460px) / 2 + 20px))", width: 54, height: 54, borderRadius: "50%",
              background: "#D97706", color: "#fff", border: "none", boxShadow: "0 6px 16px rgba(217,119,6,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}><Plus size={24} /></button>
          )}
        </>
      )}

      {/* Modals */}
      {showUserModal && (
        <UserSwitchModal users={users} currentUser={currentUser} onClose={() => setShowUserModal(false)}
          onChoose={(id) => { saveNav({ currentUserId: id }); setShowUserModal(false); }}
          onCreate={(name, role) => { ensureUser(name, role); setShowUserModal(false); }} />
      )}
      {showLocationPicker && (
        <LocationPickerModal countries={countries} locations={locations} onClose={() => setShowLocationPicker(false)}
          devices={devices.filter((d) => !d.archived)} onChoose={chooseLocation} onAddCountry={() => setShowAddCountry(true)} onAddLocation={(cid) => setShowAddLocation(cid)} />
      )}
      {showAddCountry && <AddCountryModal onClose={() => setShowAddCountry(false)} onSave={addCountry} />}
      {showAddLocation && <AddLocationModal countryId={showAddLocation} onClose={() => setShowAddLocation(null)} onSave={addLocation} />}
      {deviceModal && (
        <AddDeviceModal key={deviceModal.record?.id || (deviceModal.prefill ? `copy-${deviceModal.prefill.name}` : "new-device")}
          onPause={(id, until, drop) => { bulkUpdateDevices([id], "pause", { until, drop }); setDeviceModal(null); }}
          onResume={(id) => { bulkUpdateDevices([id], "resume"); setDeviceModal(null); }}
          onArchive={archiveDevice} prefill={deviceModal.prefill} onDuplicate={(dev) => { setDeviceModal(null); setTimeout(() => duplicateDevice(dev), 0); }} countries={countries} locations={locations} defaultLocationId={selectedLocationId}
          existing={deviceModal.record} subcategoriesByCategory={subcategoriesByCategory} suppliers={suppliers} onClose={() => setDeviceModal(null)} onSave={saveDevice}
          onDelete={(id) => { deleteDevice(id); setDeviceModal(null); }} />
      )}
      {serviceModal && (
        <LogServiceModal key={serviceModal.record?.id || `new-${serviceModal.deviceId}`}
          device={deviceById[serviceModal.deviceId]} existing={serviceModal.record} suppliers={locSuppliers} openPermits={locPermits.filter((x) => x.status === "open" && (!x.deviceId || x.deviceId === serviceModal.deviceId))}
          visitBudgets={visitBudgets.filter((v) => v.deviceId === serviceModal.deviceId)}
          onClose={() => setServiceModal(null)} onSave={saveService} onDelete={deleteService} />
      )}
      {historyFor && (
        <DeviceHistoryModal works={locWorks.filter((w) => w.deviceId === historyFor)} onAddNote={(text) => addDeviceNote(historyFor, text)} onDeleteNote={(nid) => deleteDeviceNote(historyFor, nid)} supplierById={supplierById} locationName={locationLabel({ locationId: deviceById[historyFor]?.locationId })} device={deviceById[historyFor]} services={services.filter((s) => s.deviceId === historyFor)}
          tasks={deviceTasks.filter((t) => t.deviceId === historyFor)}
          visitBudgets={visitBudgets.filter((v) => v.deviceId === historyFor)}
          onClose={() => setHistoryFor(null)}
          onEdit={(record) => { setHistoryFor(null); setServiceModal({ deviceId: historyFor, record }); }}
          onAddTask={(task) => addDeviceTask({ deviceId: historyFor, ...task })}
          onUpdateTask={updateDeviceTask}
          onMarkTaskDone={markTaskDone} onDeleteTask={deleteDeviceTask}
          onAddVisitBudget={(vb) => addVisitBudget({ deviceId: historyFor, ...vb })}
          onUpdateVisitBudget={updateVisitBudget} onDeleteVisitBudget={deleteVisitBudget}
          onSyncBudget={() => syncDeviceToBudgetPlan(historyFor)} />
      )}
      {addWorkFor && locDevices.length > 0 && (
        <AddWorkModal devices={locDevices} suppliers={locSuppliers} defaultDeviceId={addWorkFor} onClose={() => setAddWorkFor(null)} onSave={addWork} />
      )}
      {quickLog && (
        <QuickLogModal devices={locDevices} suppliers={locSuppliers} initialDeviceId={quickLog.deviceId} currentUserName={currentUser?.name}
          onScan={() => { setQuickLog(null); setShowScanner(true); }} onClose={() => setQuickLog(null)}
          onSave={(record) => { saveService(record); setQuickLog(null); }} />
      )}
      {showSettings && <SettingsModal settings={settings} devices={locDevices} usage={categoryUsage} onClose={() => setShowSettings(false)}
        onSave={(patch) => { persist.settings({ ...settings, ...patch }); }} />}
      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onResult={handleScan} />}
      {showLibrary && <LibraryModal existing={locAllDevices} suppliers={locSuppliers} onClose={() => setShowLibrary(false)} onAdd={(rows) => { importDevices(rows); setShowLibrary(false); }} />}
      {showImport && <ImportModal suppliers={locSuppliers} existing={locAllDevices} onClose={() => setShowImport(false)} onImport={(rows) => { importDevices(rows); setShowImport(false); }} />}
      {showSearch && (
        <GlobalSearchModal devices={locDevices} services={locServices} works={locWorks} suppliers={locSuppliers} deviceById={deviceById} onClose={() => setShowSearch(false)}
          onOpenDevice={(id) => { setShowSearch(false); setHistoryFor(id); }}
          onOpenVisit={(v) => { setShowSearch(false); setServiceModal({ deviceId: v.deviceId, record: v }); }}
          onOpenWork={() => { setShowSearch(false); setTab("works"); }}
          onOpenSupplier={(sup) => { setShowSearch(false); setTab("suppliers"); if (ACTIVE_CAN_EDIT) setSupplierModal({ record: sup }); }} />
      )}
      {showData && (
        <DataModal pendingCount={pendingCount} remote={REMOTE} display={display} onDisplay={saveDisplay} activity={activity.filter((a) => !a.locationId || a.locationId === selectedLocationId)} storageInfo={storageInfo}
          saveErrors={saveErrors} lastBackupAt={settings.lastBackupAt} canEdit={ACTIVE_CAN_EDIT}
          onBackup={downloadBackup} onRestore={restoreBackup} onClose={() => setShowData(false)} />
      )}
      {showAlerts && <AlertsModal snoozedCount={snoozedCount} onSnooze={snoozeAlert} onClearSnoozes={clearSnoozes} locationName={locationLabel({ locationId: selectedLocationId })} senderName={currentUser?.name} alerts={visibleAlerts} onClose={() => setShowAlerts(false)} onGo={(t) => { setTab(t); setShowAlerts(false); }} />}
      {showReports && <ReportsModal onClose={() => setShowReports(false)} locationName={locationLabel({ locationId: selectedLocationId })}
        data={{ settingsFields: settings, incidents: locIncidents, audits: locAudits, signins: locSignins, faultsByDevice, deviceTasks: locDeviceTasks, devices: locDevices, services: locServices, works: locWorks, suppliers: locSuppliers, budgets: locBudgets, budgetLines: locBudgetLines, visitBudgets: locVisitBudgets, deviceById, supplierById }} />}
      {supplierModal && (
        <AddSupplierModal key={supplierModal.record?.id || "new-supplier"} existing={supplierModal.record}
          subcategoriesByCategory={subcategoriesByCategory} onClose={() => setSupplierModal(null)}
          onSave={saveSupplier} onDelete={deleteSupplier} />
      )}
      {toast && (
        <div style={{
          position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", background: "#1B2430", color: "#fff",
          padding: toast.undo ? "6px 6px 6px 16px" : "9px 16px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          zIndex: 60, whiteSpace: "nowrap", pointerEvents: toast.undo ? "auto" : "none", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>{toast.msg}</span>
          {toast.undo && ACTIVE_CAN_EDIT && (
            <button onClick={undoLast} style={{ background: "#D97706", color: "#fff", border: "none", borderRadius: 14, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <Undo2 size={13} /> Undo
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function StatChip({ label, value, tone }) {
  const s = toneStyles[tone];
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: s.dot }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9AA5B1", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------
   User & Location setup modals
--------------------------------------------------------- */
function UserSwitchModal({ users, currentUser, onClose, onChoose, onCreate }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("admin");
  return (
    <Modal title="Profile" onClose={onClose}>
      {users.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {users.map((u) => (
            <button key={u.id} onClick={() => onChoose(u.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9,
              border: "1px solid " + (currentUser?.id === u.id ? "#2B4562" : "#E1E4E8"),
              background: currentUser?.id === u.id ? "#F1F4F7" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2B4562", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{u.name}</span>
              {u.role === "viewer" && <Badge tone="muted">Viewer</Badge>}
            </button>
          ))}
        </div>
      )}
      <Field label="Add a new profile">
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={{ flex: 1 }} />
          <PrimaryButton onClick={() => { if (name.trim()) { onCreate(name, role); setName(""); } }} style={{ padding: "9px 14px" }}>Add</PrimaryButton>
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">Admin — can add/edit/delete</option>
          <option value="viewer">Viewer — read-only in this app's UI</option>
        </Select>
        <span style={{ fontSize: 10.5, color: "#A3ABB4", display: "block", marginTop: 4 }}>
          Viewer just hides the add/edit/delete buttons for this profile — it isn't a security restriction, since anyone with access to this app can still switch profiles.
        </span>
      </Field>
    </Modal>
  );
}

function LocationPickerModal({ devices = [], countries, locations, onClose, onChoose, onAddCountry, onAddLocation }) {
  return (
    <Modal title="Country & location" onClose={onClose}>
      {countries.length === 0 ? (
        <EmptyState icon={Globe2} title="No countries yet" body="Add the first country your organisation operates in." actionLabel={ACTIVE_CAN_EDIT ? "Add country" : undefined} onAction={onAddCountry} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {countries.map((c) => {
            const locs = locations.filter((l) => l.countryId === c.id);
            return (
              <div key={c.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: "#1B2430" }}>
                  <Globe2 size={14} color="#8A94A0" /> {c.name}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#A3ABB4" }}>{c.currency || "GBP"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {locs.map((l) => (
                    <button key={l.id} onClick={() => onChoose(c.id, l.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 8,
                      border: "1px solid #E1E4E8", background: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}>
                      <Building2 size={14} color="#5B6672" />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.name}</div>
                        {l.address && <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{l.address}</div>}
                      </div>
                      {(() => {
                        const ds = devices.filter((d) => d.locationId === l.id);
                        const od = ds.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; }).length;
                        const soon = ds.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 7; }).length;
                        return (
                          <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexShrink: 0 }}>
                            <span style={{ fontSize: 10.5, color: "#8A94A0", fontWeight: 600, alignSelf: "center" }}>{ds.length} services</span>
                            {od > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#C53030", borderRadius: 10, padding: "2px 7px" }}>{od} overdue</span>}
                            {soon > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A5A0B", background: "#FDF1E0", borderRadius: 10, padding: "2px 7px" }}>{soon} this week</span>}
                          </div>
                        );
                      })()}
                    </button>
                  ))}
                  {ACTIVE_CAN_EDIT && (
                    <button onClick={() => onAddLocation(c.id)} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 8,
                      border: "1px dashed #D7DCE1", background: "none", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 12.5, color: "#5B6672", fontWeight: 600,
                    }}><Plus size={13} /> Add location in {c.name}</button>
                  )}
                </div>
              </div>
            );
          })}
          {ACTIVE_CAN_EDIT && (
            <button onClick={onAddCountry} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 11px", borderRadius: 8, border: "1px dashed #D7DCE1",
              background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "#2B4562", fontWeight: 650,
            }}><Plus size={13} /> Add another country</button>
          )}
        </div>
      )}
    </Modal>
  );
}

function AddCountryModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  return (
    <Modal title="Add country" onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Country name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. United Kingdom" /></Field>
        <Field label="Currency">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <PrimaryButton onClick={() => name.trim() && onSave(name, currency)}><Plus size={15} /> Save country</PrimaryButton>
      </div>
    </Modal>
  );
}

function AddLocationModal({ countryId, onClose, onSave }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  return (
    <Modal title="Add location" onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Location name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manchester Distribution Centre" /></Field>
        <Field label="Address (optional)"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, postcode" /></Field>
        <PrimaryButton onClick={() => name.trim() && onSave(countryId, name, address)}><Plus size={15} /> Save location</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Devices Tab
--------------------------------------------------------- */
function DevicesTab({ onLibrary, faultsByDevice = {}, onImport, allLocations = [], onCopyTo, onBulkUpdate, allSuppliers = [], archivedDevices = [], onRestore, onBulkLog, onBook, prefs = { dueFilter: "todo", sortBy: "due", cat: "all" }, onPrefs = () => {}, devices, search, setSearch, onAdd, onEdit, onLogService, onAddWork, onDelete, onHistory, searchAllLocations, onToggleSearchAll, locationLabel, chaseDevices = [], supplierById = {}, onChased, currentUserName, onQuickLog, onScan }) {
  const [chaseFocus, setChaseFocus] = useState(null); // null = closed, "all" or a deviceId
  const overdueList = chaseDevices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; });
  const [qrFor, setQrFor] = useState(null);
  const dueFilter = prefs.dueFilter || "todo"; // 'todo' | 'overdue' | 'month' | 'done' | 'all'
  const setDueFilter = (v) => onPrefs({ dueFilter: v });
  const sortBy = prefs.sortBy || "due";
  const catFilter = prefs.cat || "all";
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMore, setBulkMore] = useState(false);
  const [bookFor, setBookFor] = useState(null);
  const toggleSel = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const catsPresent = CATEGORY_KEYS.filter((k) => devices.some((d) => (d.serviceCategory || "maintenance") === k));
  const nowD = new Date();
  const isFinished = (d) => !d.nextServiceDate && !!d.lastServiceDate; // one-off, nothing left to schedule
  const doneThisMonth = (d) => {
    if (!d.lastServiceDate) return false;
    const dt = new Date(d.lastServiceDate + "T00:00:00");
    return dt.getFullYear() === nowD.getFullYear() && dt.getMonth() === nowD.getMonth();
  };
  // A recurring service counts as done once this month's visit is logged; it drops off
  // "To do" and reappears there automatically when the next month starts.
  const isDone = (d) => isFinished(d) || doneThisMonth(d);
  const byDue = (a, b) => (a.nextServiceDate || "9999").localeCompare(b.nextServiceDate || "9999");
  const sorters = {
    due: byDue,
    name: (a, b) => a.name.localeCompare(b.name),
    category: (a, b) => (CATEGORY_META[a.serviceCategory]?.label || "").localeCompare(CATEGORY_META[b.serviceCategory]?.label || "") || a.name.localeCompare(b.name),
    supplier: (a, b) => (supplierById[a.supplierId]?.name || "~").localeCompare(supplierById[b.supplierId]?.name || "~") || byDue(a, b),
    area: (a, b) => (a.area || "~").localeCompare(b.area || "~") || a.name.localeCompare(b.name),
  };
  const mineOnly = !!prefs.mine;
  const filteredDevices = (dueFilter === "archived" ? archivedDevices : devices).filter((d) => !mineOnly || d.assignee === currentUserName).filter((d) => catFilter === "all" || (d.serviceCategory || "maintenance") === catFilter).filter((d) => {
    if (dueFilter === "all" || dueFilter === "archived") return true;
    if (dueFilter === "done") return isDone(d);
    if (dueFilter === "todo") return !isDone(d);
    const days = daysUntil(d.nextServiceDate);
    if (dueFilter === "overdue") return days !== null && days < 0;
    if (dueFilter === "month") {
      if (!d.nextServiceDate || doneThisMonth(d)) return false;
      const dt = new Date(d.nextServiceDate + "T00:00:00");
      return dt.getFullYear() === nowD.getFullYear() && dt.getMonth() === nowD.getMonth();
    }
    return true;
  }).sort(sorters[sortBy] || byDue);
  return (
    <div>
      {(onQuickLog || onScan) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {ACTIVE_CAN_EDIT && onQuickLog && (
            <button onClick={onQuickLog} style={{ flex: 2, minHeight: 50, background: "#D97706", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 750, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Camera size={18} /> Quick log visit
            </button>
          )}
          {onScan && (
            <button onClick={onScan} style={{ flex: 1, minHeight: 50, background: "#1B2430", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <QrCode size={18} /> Scan
            </button>
          )}
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={16} color="#8A94A0" style={{ position: "absolute", left: 11, top: 11 }} />
        <TextInput placeholder="Search services, tags, categories…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", paddingLeft: 34 }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, cursor: "pointer", fontSize: 12, color: "#5B6672", fontWeight: 600 }}>
        <input type="checkbox" checked={searchAllLocations} onChange={(e) => onToggleSearchAll(e.target.checked)} style={{ margin: 0 }} />
        Search all locations
      </label>
      {overdueList.length > 0 && (
        <button onClick={() => setChaseFocus("all")} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, background: "#FBEAEA", border: "1px solid #F3C6C6",
          borderRadius: 10, padding: "10px 12px", marginBottom: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
          <ShieldAlert size={16} color="#C53030" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12.5, color: "#9B2C2C", fontWeight: 650 }}>
            {overdueList.length} job{overdueList.length === 1 ? "" : "s"} not completed on time — tap to chase suppliers
          </span>
          <Mail size={15} color="#9B2C2C" />
        </button>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <ToggleButton active={dueFilter === "todo"} onClick={() => setDueFilter("todo")}>To do ({devices.filter((d) => !isDone(d)).length})</ToggleButton>
        <ToggleButton active={dueFilter === "overdue"} onClick={() => setDueFilter("overdue")}>Overdue</ToggleButton>
        <ToggleButton active={dueFilter === "month"} onClick={() => setDueFilter("month")}>Due this month</ToggleButton>
        <ToggleButton active={dueFilter === "done"} onClick={() => setDueFilter("done")}>Done ({devices.filter(isDone).length})</ToggleButton>
        <ToggleButton active={dueFilter === "all"} onClick={() => setDueFilter("all")}>All</ToggleButton>
        {ACTIVE_USERS.length > 1 && devices.some((d) => d.assignee) && <ToggleButton active={mineOnly} onClick={() => onPrefs({ mine: !mineOnly })}>Mine</ToggleButton>}
        {archivedDevices.length > 0 && <ToggleButton active={dueFilter === "archived"} onClick={() => setDueFilter("archived")}>Archived ({archivedDevices.length})</ToggleButton>}
        {ACTIVE_CAN_EDIT && onBulkLog && dueFilter !== "archived" && (
          <ToggleButton active={selecting} onClick={() => { setSelecting((v) => !v); setSelected([]); }}>{selecting ? "Cancel select" : "Select…"}</ToggleButton>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: -6, marginBottom: 14 }}>
        <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 8, padding: "0 8px" }}>
          <ArrowUpDown size={13} color="#8A94A0" />
          <select value={sortBy} onChange={(e) => onPrefs({ sortBy: e.target.value })} style={{ flex: 1, border: "none", background: "none", fontSize: 12.5, padding: "7px 0", fontFamily: "inherit", color: "#1B2430", outline: "none" }}>
            <option value="due">Sort: next due first</option>
            <option value="name">Sort: name A–Z</option>
            <option value="category">Sort: category</option>
            <option value="supplier">Sort: supplier</option>
            <option value="area">Sort: area / room</option>
          </select>
        </label>
        {catsPresent.length > 1 && (
          <select value={catFilter} onChange={(e) => onPrefs({ cat: e.target.value })} style={{ flex: 1, border: "1px solid #D7DCE1", borderRadius: 8, background: catFilter === "all" ? "#fff" : "#EAF1F8", fontSize: 12.5, padding: "7px 8px", fontFamily: "inherit", color: "#1B2430", outline: "none" }}>
            <option value="all">All categories</option>
            {catsPresent.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
          </select>
        )}
      </div>
      {devices.length === 0 ? (
        <EmptyState icon={Wrench} title="No services yet" body="Add the equipment or service you maintain at this location to start its history." actionLabel={ACTIVE_CAN_EDIT ? "Add a service" : undefined} onAction={onAdd} />
      ) : filteredDevices.length === 0 ? (
        <EmptyState icon={Wrench} title={dueFilter === "done" ? "Nothing done this month yet" : dueFilter === "todo" ? "All done for this month" : "Nothing matches this filter"} body={dueFilter === "done" ? "Services show here once this month's visit is logged, plus finished one-off jobs." : dueFilter === "todo" ? "Every service has had its visit logged this month. Tap Done or All to see them." : "Try a different filter or clear it to see everything."} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredDevices.map((d) => {
            const status = dueStatus(d.nextServiceDate, !!d.lastServiceDate);
            return (
              <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #E1E4E8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  {selecting && (
                    <button onClick={() => toggleSel(d.id)} title="Select" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", marginTop: 1 }}>
                      {selected.includes(d.id) ? <CheckSquare size={20} color="#2B4562" /> : <Square size={20} color="#A3ABB4" />}
                    </button>
                  )}
                  {d.photo && <img src={d.photo} alt="" onClick={() => onHistory(d.id)} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #E1E4E8", cursor: "pointer" }} />}
                  <button onClick={() => selecting ? toggleSel(d.id) : onEdit(d)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                    {(d.area || d.assignee) && <div style={{ fontSize: 11.5, color: "#5B6672", fontWeight: 600, marginTop: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      {d.area && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={11} /> {d.area}</span>}
                      {d.assignee && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: d.assignee === currentUserName ? "#2B6CB0" : "#5B6672" }}><UserCheck size={11} /> {d.assignee === currentUserName ? "You" : d.assignee}</span>}
                    </div>}
                    {searchAllLocations && (
                      <div style={{ fontSize: 11, color: "#D97706", fontWeight: 650, marginTop: 2 }}>{locationLabel(d)}</div>
                    )}
                    <div style={{ fontSize: 12.5, color: "#8A94A0", display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                      {d.assetTag && <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{d.assetTag}</span>}
                      {d.category && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Tag size={11} />{d.category}</span>}
                      {d.budgetPerVisit ? <span>{gbp(d.budgetPerVisit)}/visit budget</span> : null}
                    </div>
                    {(faultsByDevice[d.id] >= 3 || (d.pausedUntil && d.pausedUntil >= new Date().toISOString().slice(0, 10)) || d.certRequired) && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                        {d.pausedUntil && d.pausedUntil >= new Date().toISOString().slice(0, 10) && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#5B6672", background: "#EEF0F2", borderRadius: 5, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}><PauseCircle size={10} /> Paused until {fmtDate(d.pausedUntil)}</span>}
                        {faultsByDevice[d.id] >= 3 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9B2C2C", background: "#FBEAEA", borderRadius: 5, padding: "2px 6px" }}>{faultsByDevice[d.id]} faults in 12 mo</span>}
                        {d.certRequired && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2B4562", background: "#EAF1F8", borderRadius: 5, padding: "2px 6px" }}>Certificate required</span>}
                      </div>
                    )}
                    {(d.ramsRequired || d.permits?.length > 0 || (replacementYear(d) && replacementYear(d) <= new Date().getFullYear() + 1)) && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                        {d.ramsRequired && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A5A0B", background: "#FDF1E0", borderRadius: 5, padding: "2px 6px" }}>RAMS</span>}
                        {(d.permits || []).map((p) => <span key={p} style={{ fontSize: 10.5, fontWeight: 700, color: "#9B2C2C", background: "#FBEAEA", borderRadius: 5, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}><HardHat size={10} /> {p}</span>)}
                        {replacementYear(d) && replacementYear(d) <= new Date().getFullYear() + 1 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#5B21B6", background: "#EFE9FB", borderRadius: 5, padding: "2px 6px" }}>Replace {replacementYear(d)}</span>}
                      </div>
                    )}
                  </button>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setQrFor(d)} title="QR stickers" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <QrCode size={15} color="#8A94A0" />
                    </button>
                    {ACTIVE_CAN_EDIT && (
                      <button onClick={() => onEdit(d)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Pencil size={15} color="#8A94A0" />
                      </button>
                    )}
                    <ConfirmDeleteButton onConfirm={() => onDelete(d.id)} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {doneThisMonth(d) && !isFinished(d) ? <Badge tone="ok">✓ Done {fmtDate(d.lastServiceDate)}</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
                    <CategoryBadge category={d.serviceCategory} subCategory={d.subCategory} />
                  </div>
                  <span style={{ fontSize: 12, color: "#8A94A0", display: "flex", alignItems: "center", gap: 8 }}>
                    {d.archived ? <span>Archived {d.archivedAt ? fmtDate(d.archivedAt.slice(0, 10)) : ""}</span> : <>Next: {fmtDate(d.nextServiceDate)}</>}
                    {!d.archived && d.nextServiceDate && onBook && ACTIVE_CAN_EDIT && (() => {
                      const b = currentBooking(d); const n = daysUntil(d.nextServiceDate);
                      if (!b && (n === null || n > 30)) return null;
                      const style = b ? (b.status === "confirmed" ? { bg: "#EAF4EE", fg: "#2F6B4A" } : { bg: "#EAF1F8", fg: "#2B4562" }) : { bg: "#EEF0F2", fg: "#5B6672" };
                      return (
                        <button onClick={() => setBookFor(d)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: style.bg, color: style.fg, border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          <CalendarCheck size={11} /> {b ? `${b.status === "confirmed" ? "Confirmed" : "Booked"}${b.date ? ` ${fmtDate(b.date)}` : ""}${b.time ? ` ${b.time}` : ""}` : "Not booked"}
                        </button>
                      );
                    })()}
                    {daysUntil(d.nextServiceDate) !== null && daysUntil(d.nextServiceDate) < 0 && (
                      <button onClick={() => setChaseFocus(d.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#C53030", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        <Mail size={11} /> Chase
                      </button>
                    )}
                  </span>
                </div>
                {d.chaseLog && d.chaseLog.length > 0 && daysUntil(d.nextServiceDate) !== null && daysUntil(d.nextServiceDate) < 0 && (
                  <div style={{ fontSize: 11, color: "#9B2C2C", marginTop: 6 }}>
                    Chased {d.chaseLog.length}× · last {relativeDays(d.chaseLog[d.chaseLog.length - 1].at)} by {d.chaseLog[d.chaseLog.length - 1].by}
                  </div>
                )}
                {d.archived ? (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onRestore?.(d.id)} style={{ flex: 1, background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><ArchiveRestore size={13} /> Restore</button>}
                  <button onClick={() => onHistory(d.id)} style={{ flex: 1, background: "#EEF0F2", color: "#2B4562", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>History</button>
                </div>
                ) : selecting ? null : (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onLogService(d.id)} style={{ flex: 1, background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Log visit</button>}
                  <button onClick={() => onHistory(d.id)} style={{ flex: 1, background: "#EEF0F2", color: "#2B4562", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>History</button>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onAddWork(d.id)} style={{ flex: 1, background: "#F5F1E8", color: "#8A5A0B", border: "1px solid #E6D9BC", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Extra work</button>}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {chaseFocus && (
        <ChaseModal devices={chaseFocus === "all" ? overdueList : overdueList.filter((d) => d.id === chaseFocus || (d.supplierId && d.supplierId === (chaseDevices.find((x) => x.id === chaseFocus)?.supplierId)))}
          supplierById={supplierById} locationLabel={locationLabel} currentUserName={currentUserName}
          onChased={onChased} onClose={() => setChaseFocus(null)} />
      )}
      {selecting && (
        <div style={{ position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", width: "min(420px, calc(100vw - 32px))", background: "#1B2430", borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 8, zIndex: 40, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 650, flex: 1, paddingLeft: 4 }}>{selected.length} selected</span>
          <button onClick={() => setSelected(selected.length === filteredDevices.length ? [] : filteredDevices.map((d) => d.id))} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{selected.length === filteredDevices.length ? "None" : "All"}</button>
          {onBulkUpdate && <button disabled={!selected.length} onClick={() => setBulkMore(true)} title="More actions" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 9px", cursor: selected.length ? "pointer" : "default", display: "flex" }}><MoreHorizontal size={16} /></button>}
          <button disabled={!selected.length} onClick={() => setBulkOpen(true)} style={{ background: selected.length ? "#D97706" : "#5B6672", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: selected.length ? "pointer" : "default", fontFamily: "inherit" }}>Log visits</button>
        </div>
      )}
      {bulkOpen && (
        <BulkLogModal devices={[...devices, ...archivedDevices].filter((d) => selected.includes(d.id))} defaultTech={currentUserName || ""} onClose={() => setBulkOpen(false)}
          onSave={(opts) => { onBulkLog(selected, opts); setBulkOpen(false); setSelecting(false); setSelected([]); }} />
      )}
      {ACTIVE_CAN_EDIT && onImport && dueFilter !== "archived" && (
        <button onClick={onImport} style={{ width: "100%", marginTop: 14, background: "none", border: "1px dashed #C7D0DA", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <FileSpreadsheet size={14} /> Import services from a spreadsheet
        </button>
      )}
      {ACTIVE_CAN_EDIT && onLibrary && dueFilter !== "archived" && (
        <button onClick={onLibrary} style={{ width: "100%", marginTop: 8, background: "none", border: "1px dashed #C7D0DA", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <BookOpen size={14} /> Add several from the service library
        </button>
      )}
      {bulkMore && (
        <BulkActionsModal locations={allLocations} count={selected.length} suppliers={allSuppliers} areas={[...new Set(devices.map((d) => d.area).filter(Boolean))].sort()} onClose={() => setBulkMore(false)}
          onApply={(action, value) => {
            if (action === "qr") printBulkStickers([...devices, ...archivedDevices].filter((d) => selected.includes(d.id)), locationLabel);
            else if (action === "copy") onCopyTo?.(selected, value);
            else onBulkUpdate(selected, action, value);
            setBulkMore(false); setSelecting(false); setSelected([]);
          }} />
      )}
      {bookFor && <BookingModal device={bookFor} onClose={() => setBookFor(null)} onSave={(b) => { onBook(bookFor.id, b); setBookFor(null); }} />}
      {qrFor && <ServiceQrModal device={qrFor} locationLabel={locationLabel(qrFor)} onClose={() => setQrFor(null)} />}
    </div>
  );
}

function DeviceHistoryModal({ works = [], onAddNote, onDeleteNote, device, services, tasks, visitBudgets, supplierById = {}, locationName = "", onClose, onEdit, onAddTask, onUpdateTask, onMarkTaskDone, onDeleteTask, onAddVisitBudget, onUpdateVisitBudget, onDeleteVisitBudget, onSyncBudget }) {
  const sorted = [...services].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const sortedVisitBudgets = [...visitBudgets].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [addingVisitBudget, setAddingVisitBudget] = useState(false);
  const [editingVisitBudget, setEditingVisitBudget] = useState(null);
  return (
    <Modal title={`${device ? device.name : ""}`} onClose={onClose}>
      {device && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {(device.photo || device.area || device.links?.length > 0) && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              {device.photo && <img src={device.photo} alt="" style={{ width: 88, height: 88, borderRadius: 10, objectFit: "cover", border: "1px solid #E1E4E8", flexShrink: 0 }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                {device.area && <div style={{ fontSize: 12.5, fontWeight: 650, color: "#3A4451", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {device.area}</div>}
                {(device.links || []).map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "#2B4562", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Link2 size={12} /> {l.label}</a>
                ))}
              </div>
            </div>
          )}
          {(device.manufacturer || device.model || device.serialNumber || device.installDate || device.warrantyEnd) && (
            <div style={{ fontSize: 12, color: "#5B6672", background: "#F7F8F9", borderRadius: 9, padding: "8px 10px" }}>
              {[device.manufacturer, device.model].filter(Boolean).join(" ")}{device.serialNumber ? ` · S/N ${device.serialNumber}` : ""}
              {device.installDate ? ` · Installed ${fmtDate(device.installDate)}` : ""}{device.warrantyEnd ? ` · Warranty to ${fmtDate(device.warrantyEnd)}` : ""}
              {replacementYear(device) ? ` · Replace ${replacementYear(device)}` : ""}
            </div>
          )}
          {(device.accessNotes || device.ramsRequired || device.permits?.length > 0) && (
            <div style={{ fontSize: 12, color: "#8A5A0B", background: "#FDF1E0", borderRadius: 9, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
              {device.accessNotes && <span><KeyRound size={11} style={{ verticalAlign: -1 }} /> {device.accessNotes}</span>}
              {(device.ramsRequired || device.permits?.length > 0) && <span style={{ fontWeight: 700 }}><HardHat size={11} style={{ verticalAlign: -1 }} /> Needs: {[device.ramsRequired && "RAMS", ...(device.permits || []).map((p) => `${p} permit`)].filter(Boolean).join(", ")}</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => openPrintReport(`Checklist — ${device.name}`, `${locationName}${device.assetTag ? ` · #${device.assetTag}` : ""}`, buildBlankChecklist(device, supplierById))}
            style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ClipboardList size={14} /> Blank checklist
          </button>
          <button onClick={() => openPrintReport(`Asset record — ${device.name}`, `${locationName}${device.assetTag ? ` · #${device.assetTag}` : ""}`, buildAssetRecord(device, services, tasks, supplierById))}
            style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Printer size={14} /> Asset record
          </button>
          </div>
          <CostHistory device={device} services={services} works={works} />
          <NotesLog notes={device.notesLog || []} onAdd={onAddNote} onDelete={onDeleteNote} />
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672" }}>Recurring tasks</span>
          {ACTIVE_CAN_EDIT && (
            <button onClick={() => setAddingTask(true)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Add task
            </button>
          )}
        </div>
        {tasks.length === 0 ? (
          <div style={{ fontSize: 12, color: "#A3ABB4" }}>No extra recurring tasks — this device just follows its main service schedule.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.map((t) => {
              const status = dueStatus(t.nextDate);
              return (
                <div key={t.id} style={{ background: "#F7F8F9", border: "1px solid #E1E4E8", borderRadius: 10, padding: "9px 11px", display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setEditingTask(t)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 13, fontWeight: 650 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#8A94A0", display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span>every {t.intervalMonths}mo</span>
                    </div>
                  </button>
                  {ACTIVE_CAN_EDIT && (
                    <button onClick={() => onMarkTaskDone(t.id)} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 7, padding: "6px 9px", fontSize: 11, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Mark done</button>
                  )}
                  <ConfirmDeleteButton onConfirm={() => onDeleteTask(t.id)} size={13} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672" }}>Visit budgets</span>
          {ACTIVE_CAN_EDIT && (
            <button onClick={() => setAddingVisitBudget(true)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Add visit budget
            </button>
          )}
        </div>
        {sortedVisitBudgets.length === 0 ? (
          <div style={{ fontSize: 12, color: "#A3ABB4" }}>No per-visit budgets set — {device?.budgetPerVisit ? `falls back to the flat ${gbp(device.budgetPerVisit)}/visit budget.` : "add one to budget a specific visit differently, e.g. a bigger amount for a winter service."}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedVisitBudgets.map((v) => (
              <button key={v.id} onClick={() => setEditingVisitBudget(v)} style={{
                background: "#F7F8F9", border: "1px solid #E1E4E8", borderRadius: 10, padding: "9px 11px",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{fmtDate(v.date)}</div>
                  {v.note && <div style={{ fontSize: 11, color: "#8A94A0", marginTop: 2 }}>{v.note}</div>}
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>{gbp(v.amount)}</span>
              </button>
            ))}
          </div>
        )}
        {ACTIVE_CAN_EDIT && device?.budgetPerVisit > 0 && (
          <button onClick={onSyncBudget} style={{
            width: "100%", marginTop: 8, background: "#F1F4F7", border: "1px dashed #C7D0DA", borderRadius: 8, padding: "8px 10px",
            fontSize: 11.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            <RefreshCw size={12} /> Sync to Budget Plan
          </button>
        )}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Visit history</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: "#8A94A0", textAlign: "center", padding: "20px 0" }}>No visits logged yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((s) => (
            <button key={s.id} onClick={() => onEdit(s)} style={{
              background: "#F7F8F9", border: "1px solid #E1E4E8", borderRadius: 10, padding: "10px 12px",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%",
            }}>
              <div>
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>{s.name || "Service"}</div>
                <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{fmtDate(s.date)}{s.cost ? ` · ${gbp(s.cost)}` : ""}{(s.updatedBy || s.loggedBy) ? ` · ${s.updatedBy || s.loggedBy}` : ""}</div>
              </div>
              <Pencil size={14} color="#8A94A0" />
            </button>
          ))}
        </div>
      )}

      {addingTask && (
        <AddDeviceTaskModal onClose={() => setAddingTask(false)} onSave={(task) => { onAddTask(task); setAddingTask(false); }} />
      )}
      {editingTask && (
        <AddDeviceTaskModal existing={editingTask} onClose={() => setEditingTask(null)}
          onSave={(task) => { onUpdateTask(editingTask.id, task); setEditingTask(null); }}
          onDelete={() => { onDeleteTask(editingTask.id); setEditingTask(null); }} />
      )}
      {addingVisitBudget && (
        <AddVisitBudgetModal onClose={() => setAddingVisitBudget(false)} onSave={(vb) => { onAddVisitBudget(vb); setAddingVisitBudget(false); }} />
      )}
      {editingVisitBudget && (
        <AddVisitBudgetModal existing={editingVisitBudget} onClose={() => setEditingVisitBudget(null)}
          onSave={(vb) => { onUpdateVisitBudget(editingVisitBudget.id, vb); setEditingVisitBudget(null); }}
          onDelete={() => { onDeleteVisitBudget(editingVisitBudget.id); setEditingVisitBudget(null); }} />
      )}
    </Modal>
  );
}

function AddVisitBudgetModal({ existing, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(existing?.amount ? String(existing.amount) : "");
  const [note, setNote] = useState(existing?.note || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  function submit() {
    if (!amount) return;
    onSave({ date, amount: Number(amount), note: note.trim() });
  }
  return (
    <Modal title={isEdit ? "Edit visit budget" : "Add visit budget"} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Visit date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={`Budgeted amount (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        </div>
        <Field label="Note (optional)"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Winter service — extra parts expected" /></Field>
        <PrimaryButton onClick={submit}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Add visit budget"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onDelete} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this visit budget
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

function AddDeviceTaskModal({ existing, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name || "");
  const [intervalMonths, setIntervalMonths] = useState(existing?.intervalMonths ? String(existing.intervalMonths) : "1");
  const [nextDate, setNextDate] = useState(existing?.nextDate || new Date().toISOString().slice(0, 10));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  function submit() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), intervalMonths: Number(intervalMonths) || 1, nextDate });
  }
  return (
    <Modal title={isEdit ? "Edit recurring task" : "Add recurring task"} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Task name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Filter change" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Repeats every (months)"><TextInput type="number" min="1" value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} /></Field>
          <Field label="Next due"><TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
        </div>
        <PrimaryButton onClick={submit}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Add task"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onDelete} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this task
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Schedule Tab — colour-coded calendar (month / year)
   Shows both upcoming due dates (ring) and completed service
   dates (filled dot) so logged history actually appears here.
--------------------------------------------------------- */
function ScheduleCalendarTab({ devices, services, tasks, onLogService, onEditService, onMarkTaskDone, visitBudgets = [], suppliers = [], locationName = "", blackouts = [], avoidWeekends = false, onReschedule, onRescheduleTask, onSaveBlackouts, onShiftOutOfBlackouts }) {
  const [moving, setMoving] = useState(null); // { kind: 'device'|'task', id, name, from }
  const [showBlackouts, setShowBlackouts] = useState(false);
  function doMove(item, iso) {
    if (!item || !iso) return;
    if (item.kind === "task") onRescheduleTask?.(item.id, iso); else onReschedule?.(item.id, iso);
    setMoving(null);
  }
  function dropOn(e, iso) {
    e.preventDefault();
    try { doMove(JSON.parse(e.dataTransfer.getData("text/plain")), iso); } catch (err) { /* not one of ours */ }
  }
  const [icsMsg, setIcsMsg] = useState("");
  const today = new Date();
  const [view, setView] = useState("month"); // 'month' | 'year'
  const [cursorYear, setCursorYear] = useState(today.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const deviceById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);
  const dueDevices = devices.filter((d) => d.nextServiceDate);
  const dueTasks = tasks.filter((t) => t.nextDate);

  const dueByDate = useMemo(() => {
    const map = {};
    dueDevices.forEach((d) => { (map[d.nextServiceDate] = map[d.nextServiceDate] || []).push(d); });
    return map;
  }, [dueDevices]);

  const taskDueByDate = useMemo(() => {
    const map = {};
    dueTasks.forEach((t) => { (map[t.nextDate] = map[t.nextDate] || []).push(t); });
    return map;
  }, [dueTasks]);

  const doneByDate = useMemo(() => {
    const map = {};
    services.filter((s) => s.date).forEach((s) => { (map[s.date] = map[s.date] || []).push(s); });
    return map;
  }, [services]);

  if (devices.length === 0) {
    return <EmptyState icon={Calendar} title="Nothing scheduled" body="Add services with a repeat schedule to see their next due dates here." />;
  }

  function goMonth(delta) {
    let m = cursorMonth + delta, y = cursorYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setCursorMonth(m); setCursorYear(y); setSelectedDate(null);
  }

  const grid = getMonthGrid(cursorYear, cursorMonth);
  const monthDue = dueDevices
    .filter((d) => { const dt = new Date(d.nextServiceDate + "T00:00:00"); return dt.getFullYear() === cursorYear && dt.getMonth() === cursorMonth; })
    .sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate));
  const monthTasks = dueTasks
    .filter((t) => { const dt = new Date(t.nextDate + "T00:00:00"); return dt.getFullYear() === cursorYear && dt.getMonth() === cursorMonth; })
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const monthDone = services
    .filter((s) => { if (!s.date) return false; const dt = new Date(s.date + "T00:00:00"); return dt.getFullYear() === cursorYear && dt.getMonth() === cursorMonth; })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <ToggleButton active={view === "month"} onClick={() => setView("month")}>Month</ToggleButton>
        <ToggleButton active={view === "year"} onClick={() => setView("year")}>Year</ToggleButton>
        <ToggleButton active={view === "capacity"} onClick={() => setView("capacity")}>Capacity</ToggleButton>
        {ACTIVE_CAN_EDIT && <button onClick={() => setShowBlackouts(true)} title="Holidays & blackouts" style={{ display: "flex", alignItems: "center", gap: 5, background: blackouts.length ? "#FDF1E0" : "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 650, color: blackouts.length ? "#8A5A0B" : "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Blackouts{blackouts.length ? ` (${blackouts.length})` : ""}</button>}
        <button onClick={() => { const n = downloadIcs(devices, tasks, visitBudgets, suppliers, locationName); setIcsMsg(n ? `${n} visits exported — open the file to add them to your calendar` : "Nothing scheduled in the next 12 months"); }} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>
          <Calendar size={13} /> Add to calendar
        </button>
      </div>
      {icsMsg && <div style={{ fontSize: 11.5, color: "#2F6B4A", marginBottom: 8 }}>{icsMsg}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {Object.entries(CATEGORY_META).map(([key, m]) => (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#5B6672", fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} /> {m.label}
          </span>
        ))}
        <span style={{ display: "flex", gap: 10, marginLeft: "auto", fontSize: 10.5, color: "#A3ABB4" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, border: "1.5px solid #8A94A0" }} /> due</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#8A94A0" }} /> done</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 15, height: 15, borderRadius: 8, background: "#1B2430", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>3</span> count</span>
        </span>
      </div>

      {moving && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#2B4562", color: "#fff", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 650 }}>Tap a day to move {moving.name}{moving.from ? ` (due ${fmtDate(moving.from)})` : ""}</span>
          <button onClick={() => setMoving(null)} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}
      {view === "capacity" ? (
        <CapacityView devices={devices} tasks={tasks} visitBudgets={visitBudgets} suppliers={suppliers} services={services} />
      ) : view === "month" ? (
        <>
          <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button onClick={() => goMonth(-1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronLeft size={15} color="#5B6672" /></button>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{new Date(cursorYear, cursorMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
              <button onClick={() => goMonth(1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronRight size={15} color="#5B6672" /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
              {WEEKDAY_LABELS.map((w) => <div key={w} style={{ fontSize: 10, fontWeight: 700, color: "#A3ABB4", textAlign: "center" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {grid.map((dt, i) => {
                if (!dt) return <div key={i} />;
                const iso = toISODate(dt);
                const due = dueByDate[iso] || [];
                const done = doneByDate[iso] || [];
                const dueTasksToday = taskDueByDate[iso] || [];
                const isToday = iso === toISODate(today);
                const totalCount = due.length + done.length + dueTasksToday.length;
                const hasItems = totalCount > 0;
                const dueCats = new Set([
                  ...due.map((d) => d.serviceCategory || "maintenance"),
                  ...dueTasksToday.map((t) => deviceById[t.deviceId]?.serviceCategory || "maintenance"),
                ]);
                const doneCats = new Set(done.map((s) => deviceById[s.deviceId]?.serviceCategory || "maintenance"));
                const allCats = [...new Set([...dueCats, ...doneCats])];
                const singleColor = allCats.length === 1 ? CATEGORY_META[allCats[0]].color : null;
                return (
                  <button key={i} onClick={() => moving ? doMove(moving, iso) : hasItems && setSelectedDate(iso)}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOn(e, iso)}
                    title={inBlackout(iso, blackouts) ? `Blackout: ${inBlackout(iso, blackouts).name}` : undefined} style={{
                    position: "relative", aspectRatio: "1", borderRadius: 9,
                    border: isToday ? "1.5px solid #D97706" : moving ? "1px dashed #2B4562" : hasItems ? `1px solid ${singleColor ? singleColor + "55" : "#E1E4E8"}` : "1px solid #F1F2F4",
                    background: singleColor ? `${singleColor}17` : inBlackout(iso, blackouts) ? "repeating-linear-gradient(45deg,#EEF0F2,#EEF0F2 4px,#fff 4px,#fff 8px)" : "#fff",
                    cursor: hasItems || moving ? "pointer" : "default", padding: 3, overflow: "hidden",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontFamily: "inherit",
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: isToday ? 800 : 600, color: "#1B2430" }}>{dt.getDate()}</span>
                    {hasItems && (
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
                        {allCats.slice(0, 3).map((cat) => {
                          const meta = CATEGORY_META[cat];
                          const isDone = doneCats.has(cat);
                          return (
                            <span key={cat} style={{
                              width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                              background: isDone ? meta.color : "transparent",
                              border: `1.5px solid ${meta.color}`,
                            }} />
                          );
                        })}
                      </div>
                    )}
                    {totalCount > 1 && (
                      <span style={{
                        position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8, background: "#1B2430",
                        color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                      }}>{totalCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Due this month ({monthDue.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {monthDue.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due.</div>}
              {monthDue.map((d) => <DueRow key={d.id} device={d} onLogService={onLogService} onMove={ACTIVE_CAN_EDIT ? () => setMoving({ kind: "device", id: d.id, name: d.name, from: d.nextServiceDate }) : undefined} />)}
            </div>

            {tasks.length > 0 && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", margin: "16px 0 8px" }}>Tasks due this month ({monthTasks.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {monthTasks.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due.</div>}
                  {monthTasks.map((t) => <TaskDueRow key={t.id} task={t} device={deviceById[t.deviceId]} onMarkDone={onMarkTaskDone} onMove={ACTIVE_CAN_EDIT ? () => setMoving({ kind: "task", id: t.id, name: t.name, from: t.nextDate }) : undefined} />)}
                </div>
              </>
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", margin: "16px 0 8px" }}>Completed this month ({monthDone.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {monthDone.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing logged.</div>}
              {monthDone.map((s) => (
                <CompletedRow key={s.id} service={s} device={deviceById[s.deviceId]} onEdit={onEditService} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <YearCalendar year={cursorYear} dueByDate={dueByDate} doneByDate={doneByDate} deviceById={deviceById} onYearChange={setCursorYear}
          onOpenMonth={(m) => { setCursorMonth(m); setView("month"); setSelectedDate(null); }} />
      )}

      {selectedDate && (
        <DayDetailModal date={selectedDate} due={dueByDate[selectedDate] || []} done={doneByDate[selectedDate] || []}
          dueTasks={taskDueByDate[selectedDate] || []} deviceById={deviceById} onClose={() => setSelectedDate(null)}
          onLogService={(id) => { setSelectedDate(null); onLogService(id); }}
          onEditService={(record) => { setSelectedDate(null); onEditService(record); }}
          onMarkTaskDone={(id) => { setSelectedDate(null); onMarkTaskDone(id); }}
          onMove={ACTIVE_CAN_EDIT ? (item) => { setSelectedDate(null); setMoving(item); } : undefined} />
      )}
      {showBlackouts && <BlackoutsModal blackouts={blackouts} avoidWeekends={avoidWeekends} onClose={() => setShowBlackouts(false)} onSave={onSaveBlackouts} onShift={onShiftOutOfBlackouts} />}
    </div>
  );
}

function DayDetailModal({ date, due, done, dueTasks, deviceById, onClose, onLogService, onEditService, onMarkTaskDone, onMove }) {
  return (
    <Modal title={fmtDate(date)} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Due ({due.length})</div>
          {due.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due today.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {due.map((d) => <DueRow key={d.id} device={d} onLogService={onLogService} onMove={onMove ? () => onMove({ kind: "device", id: d.id, name: d.name, from: d.nextServiceDate }) : undefined} />)}
            </div>
          )}
        </div>
        {dueTasks && dueTasks.length > 0 && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Tasks due ({dueTasks.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dueTasks.map((t) => <TaskDueRow key={t.id} task={t} device={deviceById[t.deviceId]} onMarkDone={onMarkTaskDone} onMove={onMove ? () => onMove({ kind: "task", id: t.id, name: t.name, from: t.nextDate }) : undefined} />)}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Completed ({done.length})</div>
          {done.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing logged today.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {done.map((s) => <CompletedRow key={s.id} service={s} device={deviceById[s.deviceId]} onEdit={onEditService} />)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TaskDueRow({ task, device, onMarkDone, onMove }) {
  const status = dueStatus(task.nextDate);
  const catColor = (CATEGORY_META[device?.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <div draggable={!!onMove} onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "task", id: task.id, name: task.name, from: task.nextDate })); }} style={{ cursor: onMove ? "grab" : "default", background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <StatusDot tone={status.tone} />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{task.name}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{device ? device.name : "Unknown service"}</div>
        </div>
      </div>
      {onMove && <button onClick={onMove} title="Reschedule" style={{ background: "none", border: "1px solid #D7DCE1", borderRadius: 8, padding: "5px 8px", fontSize: 11.5, fontWeight: 600, color: "#5B6672", cursor: "pointer", fontFamily: "inherit", marginRight: 6, whiteSpace: "nowrap" }}>Move</button>}
      {ACTIVE_CAN_EDIT && (
        <button onClick={() => onMarkDone(task.id)} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Mark done</button>
      )}
    </div>
  );
}

function DueRow({ device, onLogService, onMove }) {
  const status = dueStatus(device.nextServiceDate);
  const catColor = (CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <div draggable={!!onMove} onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "device", id: device.id, name: device.name, from: device.nextServiceDate })); }} style={{ cursor: onMove ? "grab" : "default", background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <StatusDot tone={status.tone} />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{device.name}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0", display: "flex", alignItems: "center", gap: 5 }}>
            <CategoryBadge category={device.serviceCategory} />
          </div>
        </div>
      </div>
      {onMove && <button onClick={onMove} title="Reschedule" style={{ background: "none", border: "1px solid #D7DCE1", borderRadius: 8, padding: "5px 8px", fontSize: 11.5, fontWeight: 600, color: "#5B6672", cursor: "pointer", fontFamily: "inherit", marginRight: 6, whiteSpace: "nowrap" }}>Move</button>}
      {ACTIVE_CAN_EDIT && (
        <button onClick={() => onLogService(device.id)} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Log</button>
      )}
    </div>
  );
}

function CompletedRow({ service, device, onEdit }) {
  const catColor = (CATEGORY_META[device?.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <button onClick={() => onEdit(service)} style={{
      background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex",
      alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <CheckCircle2 size={16} color="#2F855A" />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{service.name || (device ? device.name : "Service")}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{device ? device.name : "Unknown service"}{service.cost ? ` · ${gbp(service.cost)}` : ""}</div>
        </div>
      </div>
      <ChevronRight size={15} color="#C0C6CC" />
    </button>
  );
}

function YearCalendar({ year, dueByDate, doneByDate, deviceById, onYearChange, onOpenMonth }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => onYearChange(year - 1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronLeft size={15} color="#5B6672" /></button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{year}</span>
        <button onClick={() => onYearChange(year + 1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronRight size={15} color="#5B6672" /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {MONTH_LABELS.map((label, m) => {
          const dueCounts = emptyCatMap();
          Object.entries(dueByDate).forEach(([iso, list]) => {
            const dt = new Date(iso + "T00:00:00");
            if (dt.getFullYear() === year && dt.getMonth() === m) list.forEach((d) => { dueCounts[d.serviceCategory || "maintenance"] += 1; });
          });
          let doneCount = 0;
          Object.entries(doneByDate).forEach(([iso, list]) => {
            const dt = new Date(iso + "T00:00:00");
            if (dt.getFullYear() === year && dt.getMonth() === m) doneCount += list.length;
          });
          const dueTotal = dueCounts.cleaning + dueCounts.maintenance + dueCounts.catering;
          return (
            <button key={label} onClick={() => onOpenMonth(m)} style={{
              background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: 10, cursor: "pointer",
              textAlign: "left", fontFamily: "inherit",
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{label}</div>
              {dueTotal === 0 && doneCount === 0 ? (
                <div style={{ fontSize: 11, color: "#C0C6CC" }}>Nothing</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {Object.entries(dueCounts).filter(([, c]) => c > 0).map(([cat, c]) => (
                    <span key={cat} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#5B6672" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", border: `1.3px solid ${CATEGORY_META[cat].color}` }} /> {c} due ({CATEGORY_META[cat].label.toLowerCase()})
                    </span>
                  ))}
                  {doneCount > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#5B6672" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8A94A0" }} /> {doneCount} completed
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Certificates Tab
--------------------------------------------------------- */
function CertificatesTab({ services, deviceById, supplierById, onEdit, devices = [], visitBudgets = [] }) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  if (services.length === 0) return (
    <div>
      <ComplianceCard devices={devices} visitBudgets={visitBudgets} services={services} supplierById={supplierById} />
      <EmptyState icon={FileCheck} title="No completed visits yet" body="Log a completed visit to build your certificate archive." />
    </div>
  );

  const filtered = services.filter((s) => {
    if (dateFrom && (!s.date || s.date < dateFrom)) return false;
    if (dateTo && (!s.date || s.date > dateTo)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const dev = deviceById[s.deviceId];
      const hay = `${s.name || ""} ${dev?.name || ""} ${s.technician || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const csvRows = [
    ["Visit name", "Service", "Supplier", "Date", "Technician", "Cost", "Logged by", "Notes"],
    ...filtered.map((s) => [s.name || "", deviceById[s.deviceId]?.name || "", s.supplierId ? (supplierById[s.supplierId]?.name || "") : "", s.date || "", s.technician || "", s.cost || 0, s.updatedBy || s.loggedBy || "", s.notes || ""]),
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ComplianceCard devices={devices} visitBudgets={visitBudgets} services={services} supplierById={supplierById} />
      <div style={{ position: "relative" }}>
        <Search size={16} color="#8A94A0" style={{ position: "absolute", left: 11, top: 11 }} />
        <TextInput placeholder="Search visit name, service, technician…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", paddingLeft: 34 }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ flex: 1 }} aria-label="From date" />
        <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ flex: 1 }} aria-label="To date" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "9px 11px", fontSize: 12, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Clear</button>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: "#8A94A0", fontWeight: 600 }}>{filtered.length} of {services.length}</span>
        <ExportButton rows={csvRows} filename="certificates.csv" />
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "#A3ABB4", fontSize: 12.5, padding: "24px 0" }}>Nothing matches this search or date range.</div>
      ) : filtered.map((s) => {
        const dev = deviceById[s.deviceId];
        const supplier = s.supplierId ? supplierById[s.supplierId] : null;
        return (
          <button key={s.id} onClick={() => onEdit(s)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ width: 52, height: 52, borderRadius: 8, background: "#EEF0F2", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {s.certificatePhoto ? <img src={s.certificatePhoto} alt="certificate" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FileCheck size={20} color="#8A94A0" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650, fontSize: 14 }}>{s.name || (dev ? dev.name : "Service")}</div>
              <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{dev ? dev.name : "Unknown service"}{supplier ? ` · ${supplier.name}` : ""}</div>
              <div style={{ fontSize: 12, color: "#8A94A0" }}>{fmtDate(s.date)} · {s.technician || "No technician noted"}{s.cost ? ` · ${gbp(s.cost)}` : ""}{s.poNumber ? ` · PO ${s.poNumber}` : ""}</div>
              {s.custom && Object.keys(s.custom).length > 0 && (
                <div style={{ fontSize: 11, color: "#5B6672", marginTop: 2 }}>{formatCustomValues("visit", s.custom)}</div>
              )}
              {(s.signatures?.technician || s.signatures?.site || s.gps) && (
                <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  {s.signatures?.technician && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2F6B4A", background: "#EAF4EE", padding: "2px 7px", borderRadius: 20 }}>✍ Technician signed</span>}
                  {s.signatures?.site && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2F6B4A", background: "#EAF4EE", padding: "2px 7px", borderRadius: 20 }}>✍ Site signed</span>}
                  {s.gps && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2B4562", background: "#EEF0F2", padding: "2px 7px", borderRadius: 20 }}>📍 Located</span>}
                </div>
              )}
              {s.checklistResults && s.checklistResults.length > 0 && (() => {
                const answered = s.checklistResults.filter((r) => r.result && r.result !== "na");
                const passed = answered.filter((r) => r.result === "pass").length;
                const failed = answered.filter((r) => r.result === "fail").length;
                return <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3, color: failed ? "#C53030" : "#2F855A" }}>Checklist {passed}/{answered.length} passed{failed ? ` · ${failed} failed` : ""}</div>;
              })()}
            </div>
            <ChevronRight size={16} color="#C0C6CC" />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   Extra Works / Quotes Tab
--------------------------------------------------------- */
const WORK_STATUSES = [
  { key: "requested", label: "Requested", tone: "warn" },
  { key: "quoted", label: "Quoted", tone: "muted" },
  { key: "approved", label: "Approved", tone: "warn" },
  { key: "in_progress", label: "In progress", tone: "warn" },
  { key: "completed", label: "Completed", tone: "ok" },
  { key: "rejected", label: "Rejected", tone: "danger" },
];
const WORK_PRIORITIES = [
  { key: "high", label: "High", color: "#C53030", bg: "#FBEAEA" },
  { key: "medium", label: "Medium", color: "#B7791F", bg: "#FDF1E0" },
  { key: "low", label: "Low", color: "#5B6672", bg: "#EEF0F2" },
];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const CHECKLIST_PRESETS = {
  cleaning: ["All areas cleaned to spec", "Washrooms cleaned & restocked", "Bins emptied", "Kitchen / tea points cleaned", "Consumables levels checked", "Issues or damage reported"],
  maintenance: ["Visual inspection completed", "Safety checks passed", "Filters / consumables replaced", "Operating readings within range", "Area left clean and safe", "Asset labels / records updated"],
  catering: ["Food temperatures recorded", "Fridge / freezer temps in range", "Allergen labelling correct", "Hygiene & cleaning schedule followed", "Stock rotation checked", "Waste removed"],
};
function PriorityTag({ priority }) {
  const p = WORK_PRIORITIES.find((x) => x.key === priority) || WORK_PRIORITIES[1];
  return <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, padding: "3px 8px", borderRadius: 20 }}>{p.label}</span>;
}
function WorkStatusTag({ status }) {
  const s = WORK_STATUSES.find((x) => x.key === status) || WORK_STATUSES[1];
  const colors = { ok: ["#2F6B4A", "#EAF4EE"], warn: ["#8A5A0B", "#FDF1E0"], danger: ["#9B2C2C", "#FBEAEA"], muted: ["#5B6672", "#EEF0F2"] }[s.tone];
  return <span style={{ fontSize: 11, fontWeight: 700, color: colors[0], background: colors[1], padding: "3px 8px", borderRadius: 20 }}>{s.label}</span>;
}
const WORK_BUDGET_TYPES = [
  { key: "budgeted", label: "Budgeted", hint: "Planned, counts toward the budget" },
  { key: "non_controllable", label: "Non-controllable", hint: "Unplanned / unavoidable, tracked separately" },
];

function BudgetTypeTag({ type }) {
  const isBudgeted = type !== "non_controllable";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 650,
      color: isBudgeted ? "#2F6B4A" : "#9B5B0B", background: isBudgeted ? "#EAF4EE" : "#FDF1E0",
      padding: "3px 8px", borderRadius: 20,
    }}>
      {isBudgeted ? null : <ShieldAlert size={11} />} {isBudgeted ? "Budgeted" : "Non-controllable"}
    </span>
  );
}

function WorksTab({ works, deviceById, supplierById, suppliers, onUpdate, onDelete, onAdd, hasDevices, currentUserName, approvalThreshold = 0, onSetThreshold, onConvertToPlan, onConvertToService }) {
  const needsApproval = (w) => approvalThreshold > 0 && Number(w.quoteAmount) >= approvalThreshold && !w.approvedBy && w.status !== "rejected" && w.status !== "completed";
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState(String(approvalThreshold || ""));
  const [statusFilter, setStatusFilter] = useState("open"); // 'open' | 'requested' | 'all' | 'closed'
  const [openWorkId, setOpenWorkId] = useState(null);
  const countable = works.filter((w) => w.status !== "rejected" && w.status !== "requested");
  const budgetedTotal = countable.filter((w) => w.budgetType !== "non_controllable").reduce((sum, w) => sum + (Number(w.quoteAmount) || 0), 0);
  const nonControllableTotal = countable.filter((w) => w.budgetType === "non_controllable").reduce((sum, w) => sum + (Number(w.quoteAmount) || 0), 0);
  if (works.length === 0) {
    return <EmptyState icon={Receipt} title="No extra works logged" body={hasDevices ? "Track work outside the regular service plan — requests, quotes, approvals and follow-ups from failed checks." : "Add a service first, then log extra works against it."} actionLabel={hasDevices && ACTIVE_CAN_EDIT ? "Add extra work" : undefined} onAction={hasDevices ? onAdd : undefined} />;
  }
  const isClosed = (w) => w.status === "completed" || w.status === "rejected";
  const requestedCount = works.filter((w) => w.status === "requested").length;
  const filtered = works
    .filter((w) => statusFilter === "all" ? true : statusFilter === "closed" ? isClosed(w) : statusFilter === "requested" ? w.status === "requested" : !isClosed(w))
    .sort((a, b) => (PRIORITY_RANK[a.priority || "medium"] - PRIORITY_RANK[b.priority || "medium"]) || (b.dateRaised || "").localeCompare(a.dateRaised || ""));
  const openWork = openWorkId ? works.find((w) => w.id === openWorkId) : null;
  const csvRows = [
    ["Service", "Description", "Priority", "Assigned to", "Amount", "Status", "Budget type", "Date raised", "Raised by", "Comments"],
    ...works.map((w) => [deviceById[w.deviceId]?.name || "", w.description || "", w.priority || "medium", w.supplierId ? (supplierById[w.supplierId]?.name || "") : "", w.quoteAmount || 0, w.status || "", w.budgetType === "non_controllable" ? "Non-controllable" : "Budgeted", w.dateRaised || "", w.requestedBy || w.loggedBy || "", (w.comments || []).length]),
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        {editingThreshold ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "#5B6672" }}>Approval over</span>
            <TextInput type="number" min="0" value={thresholdDraft} onChange={(e) => setThresholdDraft(e.target.value)} style={{ width: 90, padding: "6px 8px" }} />
            <button onClick={() => { onSetThreshold?.(Number(thresholdDraft) || 0); setEditingThreshold(false); }} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          </div>
        ) : (
          <button onClick={() => ACTIVE_CAN_EDIT && setEditingThreshold(true)} style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, color: "#5B6672", cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
            {approvalThreshold > 0 ? <>Quotes over <b>{gbp(approvalThreshold)}</b> need approval{ACTIVE_CAN_EDIT ? " · edit" : ""}</> : <>No approval rule{ACTIVE_CAN_EDIT ? " · set one" : ""}</>}
          </button>
        )}
        <ExportButton rows={csvRows} filename="extra-works.csv" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Budgeted total</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(budgetedTotal)}</div>
        </div>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#8A5A0B", fontWeight: 600 }}>Non-controllable</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: "#8A5A0B" }}>{gbp(nonControllableTotal)}</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: "#8A94A0", marginBottom: 8 }}>Target completion: high {SLA_DAYS.high} day, medium {SLA_DAYS.medium} days, low {SLA_DAYS.low} days from being raised.</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <ToggleButton active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Open</ToggleButton>
        <ToggleButton active={statusFilter === "requested"} onClick={() => setStatusFilter("requested")}>New requests{requestedCount ? ` (${requestedCount})` : ""}</ToggleButton>
        <ToggleButton active={statusFilter === "closed"} onClick={() => setStatusFilter("closed")}>Closed</ToggleButton>
        <ToggleButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</ToggleButton>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "#A3ABB4", fontSize: 12.5, padding: "24px 0" }}>Nothing in this view.</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((w) => {
          const dev = deviceById[w.deviceId];
          const assignee = w.supplierId ? supplierById[w.supplierId] : null;
          const commentCount = (w.comments || []).length;
          return (
            <button key={w.id} onClick={() => setOpenWorkId(w.id)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${(WORK_PRIORITIES.find((p) => p.key === (w.priority || "medium")) || WORK_PRIORITIES[1]).color}`, borderRadius: 12, padding: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{dev ? dev.name : "Unknown service"}</div>
                  <div style={{ fontSize: 12, color: "#8A94A0", marginTop: 2 }}>Raised {fmtDate(w.dateRaised)}{w.requestedBy ? ` by ${w.requestedBy}` : ""}</div>
                </div>
                <WorkStatusTag status={w.status} />
              </div>
              <div style={{ margin: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <PriorityTag priority={w.priority || "medium"} />
                {(() => {
                  const sla = workSla(w); if (!sla) return null;
                  if (sla.done) return sla.breached ? <span style={{ fontSize: 11, fontWeight: 700, color: "#9B2C2C", background: "#FBEAEA", padding: "3px 8px", borderRadius: 20 }}>Completed late</span> : null;
                  return <span style={{ fontSize: 11, fontWeight: 700, color: sla.breached ? "#fff" : sla.dueSoon ? "#8A5A0B" : "#5B6672", background: sla.breached ? "#C53030" : sla.dueSoon ? "#FDF1E0" : "#EEF0F2", padding: "3px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 3 }}><Timer size={10} /> {sla.breached ? `Overdue since ${fmtDate(sla.deadline)}` : `Target ${fmtDate(sla.deadline)}`}</span>;
                })()}
                {w.quoteValidUntil && ["quoted", "requested"].includes(w.status) && daysUntil(w.quoteValidUntil) <= 14 && <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(w.quoteValidUntil) < 0 ? "#9B2C2C" : "#8A5A0B", background: daysUntil(w.quoteValidUntil) < 0 ? "#FBEAEA" : "#FDF1E0", padding: "3px 8px", borderRadius: 20 }}>{daysUntil(w.quoteValidUntil) < 0 ? "Quote expired" : `Quote valid to ${fmtDate(w.quoteValidUntil)}`}</span>}
                {needsApproval(w) && <span style={{ fontSize: 11, fontWeight: 700, color: "#8A5A0B", background: "#FDF1E0", padding: "3px 8px", borderRadius: 20 }}>Needs approval</span>}
                {w.approvedBy && <span style={{ fontSize: 11, fontWeight: 700, color: "#2F6B4A", background: "#EAF4EE", padding: "3px 8px", borderRadius: 20 }}>✓ Approved</span>}
                {w.poNumber && <span style={{ fontSize: 11, fontWeight: 700, color: "#2B4562", background: "#EEF0F2", padding: "3px 8px", borderRadius: 20 }}>PO {w.poNumber}</span>}
                <CategoryBadge category={dev?.serviceCategory} />
                <BudgetTypeTag type={w.budgetType} />
              </div>
              <p style={{ fontSize: 13.5, color: "#3A4451", margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{w.description}</p>
              {w.photos && w.photos.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
                  {w.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #E1E4E8" }} />)}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#8A94A0" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: "#1B2430" }}>{gbp(w.quoteAmount)}</span>
                <span>{assignee ? assignee.name : "Unassigned"} · {commentCount} comment{commentCount === 1 ? "" : "s"}</span>
              </div>
            </button>
          );
        })}
      </div>
      )}
      {openWork && (
        <WorkDetailModal work={openWork} device={deviceById[openWork.deviceId]} suppliers={suppliers} currentUserName={currentUserName}
          approvalThreshold={approvalThreshold} needsApproval={needsApproval(openWork)}
          onConvertToPlan={() => onConvertToPlan?.(openWork)} onConvertToService={() => onConvertToService?.(openWork)}
          onClose={() => setOpenWorkId(null)} onUpdate={(patch) => onUpdate(openWork.id, patch)}
          onDelete={() => { onDelete(openWork.id); setOpenWorkId(null); }} />
      )}
    </div>
  );
}

function WorkDetailModal({ work, device, suppliers, currentUserName, onClose, onUpdate, onDelete, approvalThreshold = 0, needsApproval = false, onConvertToPlan, onConvertToService }) {
  const [po, setPo] = useState(work.poNumber || "");
  const [statusMsg, setStatusMsg] = useState("");
  const [comment, setComment] = useState("");
  const [amount, setAmount] = useState(work.quoteAmount ? String(work.quoteAmount) : "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const comments = work.comments || [];
  const relevantSuppliers = suppliers.filter((s) => !device || s.category === device.serviceCategory);
  const otherSuppliers = suppliers.filter((s) => device && s.category !== device.serviceCategory);
  function addComment() {
    if (!comment.trim()) return;
    onUpdate({ comments: [...comments, { text: comment.trim(), by: currentUserName || "Unknown", at: new Date().toISOString() }] });
    setComment("");
  }
  return (
    <Modal title={device ? device.name : "Extra work"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13.5, color: "#3A4451", whiteSpace: "pre-wrap" }}>{work.description}</div>
        <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Raised {fmtDate(work.dateRaised)}{work.requestedBy ? ` by ${work.requestedBy}` : work.loggedBy ? ` by ${work.loggedBy}` : ""}{work.source === "checklist" ? " · from a failed checklist item" : work.source === "request" ? " · via request portal" : ""}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Status">
            <Select value={work.status} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => {
              const v = e.target.value;
              if (needsApproval && ["approved", "in_progress", "completed"].includes(v)) { setStatusMsg(`This quote is over ${gbp(approvalThreshold)} — use Approve below first.`); return; }
              setStatusMsg(""); onUpdate({ status: v });
            }}>
              {WORK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={work.priority || "medium"} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ priority: e.target.value })}>
              {WORK_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
          </Field>
        </div>
        {statusMsg && <div style={{ fontSize: 12, color: "#9B2C2C", marginTop: -4 }}>{statusMsg}</div>}
        {needsApproval && (
          <div style={{ background: "#FDF1E0", border: "1px solid #E6D9BC", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A5A0B" }}>Needs approval — quote is {gbp(work.quoteAmount)}, over the {gbp(approvalThreshold)} limit</div>
            {(work.loggedBy || work.requestedBy) === currentUserName && <div style={{ fontSize: 11, color: "#8A5A0B", marginTop: 2 }}>You raised this job — ideally someone else approves it.</div>}
            {ACTIVE_CAN_EDIT && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setStatusMsg(""); onUpdate({ approvedBy: currentUserName || "Unknown", approvedAt: new Date().toISOString(), status: "approved", comments: [...(work.comments || []), { text: `Approved ${gbp(work.quoteAmount)}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] }); }} style={{ flex: 1, background: "#2F855A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Approve</button>
                <button onClick={() => onUpdate({ status: "rejected", comments: [...(work.comments || []), { text: "Quote rejected", by: currentUserName || "Unknown", at: new Date().toISOString() }] })} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
              </div>
            )}
          </div>
        )}
        {work.approvedBy && <div style={{ fontSize: 11.5, color: "#2F6B4A", fontWeight: 650 }}>✓ Approved by {work.approvedBy} on {fmtDate(work.approvedAt?.slice(0, 10))}</div>}
        <CustomFieldInputs appliesTo="work" category={device?.serviceCategory} values={work.custom || {}} onChange={(v) => onUpdate({ custom: v })} readOnly={!ACTIVE_CAN_EDIT} />
        <QuoteComparison work={work} suppliers={suppliers} currentUserName={currentUserName}
          onAccept={(q, quotes) => { setAmount(String(q.amount)); onUpdate({ quotes, supplierId: q.supplierId || null, quoteAmount: q.amount, comments: [...(work.comments || []), { text: `Accepted quote from ${suppliers.find((x) => x.id === q.supplierId)?.name || q.supplierName || "supplier"}: ${gbp(q.amount)}`, by: currentUserName || "Unknown", at: new Date().toISOString() }] }); }}
          onChange={(quotes) => onUpdate({ quotes })} />
        <Field label="PO / work order number">
          <TextInput value={po} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => setPo(e.target.value)} onBlur={() => po !== (work.poNumber || "") && onUpdate({ poNumber: po.trim() })} placeholder="e.g. PO-40213" />
        </Field>
        <Field label="Assigned supplier">
          <Select value={work.supplierId || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ supplierId: e.target.value || null })}>
            <option value="">— Unassigned —</option>
            {relevantSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {otherSuppliers.length > 0 && <optgroup label="Other categories">{otherSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
          </Select>
        </Field>
        {ACTIVE_USERS.length > 0 && (
          <Field label="Assigned to">
            <Select value={work.assignee || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ assignee: e.target.value || null })}>
              <option value="">— Nobody —</option>
              {ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Quote valid until (optional)">
          <TextInput type="date" value={work.quoteValidUntil || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ quoteValidUntil: e.target.value || null })} />
        </Field>
        {ACTIVE_CAN_EDIT && (() => {
          const sup = suppliers.find((x) => x.id === work.supplierId);
          const sla = workSla(work);
          function sendOrder() {
            const lines = [
              `Service / asset: ${device?.name || ""}${device?.assetTag ? ` (#${device.assetTag})` : ""}`,
              `Work required: ${work.description}`, `Priority: ${(work.priority || "medium").replace(/^./, (c) => c.toUpperCase())}`,
              sla && `Please complete by: ${fmtDate(sla.deadline)}`, work.poNumber && `PO number: ${work.poNumber}`,
              Number(work.quoteAmount) ? `Agreed amount: ${gbp(work.quoteAmount)}` : null,
              device?.accessNotes && `Access: ${device.accessNotes}`,
              (device?.ramsRequired || device?.permits?.length) && `Before starting: ${[device.ramsRequired && "send RAMS", ...(device.permits || []).map((p) => `${p} permit needed`)].filter(Boolean).join(", ")}`,
            ].filter(Boolean);
            window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent(`Work order${work.poNumber ? ` ${work.poNumber}` : ""} — ${device?.name || ""}`)}&body=${encodeURIComponent(`Hi${sup?.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nPlease carry out the following work:\n\n${lines.join("\n")}\n\nPlease confirm receipt and your attendance date.\n\nKind regards,\n${currentUserName || ""}`)}`;
            onUpdate({ comments: [...(work.comments || []), { text: `Work order emailed${sup ? ` to ${sup.name}` : ""}`, by: currentUserName || "Unknown", at: new Date().toISOString() }], ...(work.status === "approved" ? {} : {}) });
          }
          return (
            <button type="button" onClick={sendOrder} style={{ background: "#EAF1F8", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Send size={14} /> Email work order{sup ? ` to ${sup.name}` : ""}
            </button>
          );
        })()}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <Field label={`Quote / cost (${ACTIVE_CURRENCY_CODE})`}>
            <TextInput type="number" min="0" step="0.01" value={amount} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => setAmount(e.target.value)} onBlur={() => onUpdate({ quoteAmount: amount ? Number(amount) : 0 })} placeholder="0.00" />
          </Field>
          <Field label="Budget type">
            <Select value={work.budgetType || "budgeted"} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ budgetType: e.target.value })}>
              {WORK_BUDGET_TYPES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </Select>
          </Field>
        </div>
        {work.photos && work.photos.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {work.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #E1E4E8" }} />)}
          </div>
        )}
        {ACTIVE_CAN_EDIT && ["approved", "in_progress", "completed"].includes(work.status) && (
          <div style={{ background: "#F1F4F7", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672", marginBottom: 6 }}>Turn this into…</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onConvertToPlan} style={{ flex: 1, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Budget Plan line</button>
              <button onClick={onConvertToService} style={{ flex: 1, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>New service</button>
            </div>
            {(work.convertedTo || []).length > 0 && <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 6 }}>Already converted: {work.convertedTo.map((c) => c.type === "plan" ? "Plan line" : "Service").join(", ")}</div>}
          </div>
        )}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 6 }}>Comments ({comments.length})</div>
          {comments.length === 0 ? (
            <div style={{ fontSize: 12, color: "#A3ABB4", marginBottom: 8 }}>No comments yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {comments.map((c, i) => (
                <div key={i} style={{ background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 13, color: "#1B2430", whiteSpace: "pre-wrap" }}>{c.text}</div>
                  <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 3 }}>{c.by} · {new Date(c.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
          )}
          {ACTIVE_CAN_EDIT && (
            <div style={{ display: "flex", gap: 8 }}>
              <TextInput value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add an update…" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} />
              <button onClick={addComment} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Post</button>
            </div>
          )}
        </div>
        {ACTIVE_CAN_EDIT && (confirmingDelete ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onDelete} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
            <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
            <Trash2 size={13} /> Delete this work
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Suppliers Tab
--------------------------------------------------------- */
function SuppliersTab({ suppliers, onAdd, onEdit, onDelete, devices = [], services = [], works = [], budgetLines = [], visitBudgets = [] }) {
  const [scoreFor, setScoreFor] = useState(null);
  if (suppliers.length === 0) {
    return <EmptyState icon={UsersIcon} title="No suppliers yet" body="Add cleaning, maintenance and catering suppliers for this location." actionLabel={ACTIVE_CAN_EDIT ? "Add supplier" : undefined} onAction={onAdd} />;
  }
  const groups = CATEGORY_KEYS;
  const annual = (x) => (x.costFrequency === "annual" ? Number(x.costAmount) || 0 : (Number(x.costAmount) || 0) * 12);
  const totalAnnual = suppliers.reduce((t, x) => t + annual(x), 0);
  const ending90 = suppliers.filter((x) => x.contractEnd && daysUntil(x.contractEnd) >= 0 && daysUntil(x.contractEnd) <= 90);
  const top = [...suppliers].sort((a, b) => annual(b) - annual(a)).filter((x) => annual(x) > 0).slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {suppliers.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Contract value per year</div><div style={{ fontSize: 17, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(totalAnnual)}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Contracts ending in 90 days</div><div style={{ fontSize: 17, fontWeight: 750, color: ending90.length ? "#B7791F" : "#1B2430", fontFamily: "'IBM Plex Mono', monospace" }}>{ending90.length}</div></div>
          </div>
          {top.length > 0 && <div style={{ fontSize: 11.5, color: "#5B6672" }}>Largest: {top.map((x) => `${x.name} ${gbp(annual(x))}`).join(" · ")}</div>}
          {ending90.length > 0 && <div style={{ fontSize: 11.5, color: "#B7791F", fontWeight: 650 }}>Ending: {ending90.map((x) => `${x.name} (${fmtDate(x.contractEnd)})`).join(" · ")}</div>}
        </div>
      )}
      {groups.map((cat) => {
        const list = suppliers.filter((s) => s.category === cat);
        if (list.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <meta.icon size={14} color={meta.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((s) => (
                <div key={s.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <button onClick={() => onEdit(s)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{s.name}{s.subCategory ? ` · ${s.subCategory}` : ""}</div>
                    <div style={{ fontSize: 12, color: "#8A94A0", marginTop: 2 }}>{s.contact || "No contact on file"}</div>
                    <div style={{ fontSize: 12, color: s.managerEmail ? "#2B4562" : "#C05621", marginTop: 2, fontWeight: 600 }}>
                      {s.managerName || s.managerEmail ? `Manager: ${s.managerName || ""}${s.managerEmail ? ` · ${s.managerEmail}` : ""}${s.managerPhone ? ` · ${s.managerPhone}` : ""}` : "No manager set — add one to enable chase emails"}
                    </div>
                    {s.contractEnd && (() => {
                      const n = daysUntil(s.contractEnd); const notice = Number(s.noticeDays) || 60;
                      const color = n < 0 ? "#C53030" : n <= notice ? "#B7791F" : "#2F855A";
                      return <div style={{ fontSize: 11.5, fontWeight: 700, color, marginTop: 3 }}>{n < 0 ? `Contract expired ${fmtDate(s.contractEnd)}` : `Contract ends ${fmtDate(s.contractEnd)} (${n}d)`}{s.contractRef ? ` · ${s.contractRef}` : ""}</div>;
                    })()}
                    {(s.insuranceExpiry || s.accreditationExpiry) && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 3 }}>
                        {[["Insurance", s.insuranceExpiry], [s.accreditation || "Accreditation", s.accreditationExpiry]].filter(([, d]) => d).map(([label, d]) => {
                          const n = daysUntil(d); const color = n < 0 ? "#C53030" : n <= 30 ? "#B7791F" : "#2F855A";
                          return <span key={label} style={{ fontSize: 11.5, fontWeight: 700, color }}>{n < 0 ? "✗" : "✓"} {label} {n < 0 ? "expired" : "to"} {fmtDate(d)}</span>;
                        })}
                      </div>
                    )}
                    {(s.links || []).length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 3 }} onClick={(e) => e.stopPropagation()}>
                        {s.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "#2B4562", fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 3 }}><Link2 size={11} /> {l.label}</a>)}
                      </div>
                    )}
                    {(() => {
                      const done = Object.keys(s.onboarding || {}).filter((k) => ONBOARDING_ITEMS.includes(k)).length;
                      if (!s.onboarding) return null;
                      return <div style={{ fontSize: 11.5, fontWeight: 700, color: done === ONBOARDING_ITEMS.length ? "#2F855A" : "#B7791F", marginTop: 3 }}>{done === ONBOARDING_ITEMS.length ? "✓ Onboarding complete" : `Onboarding ${done}/${ONBOARDING_ITEMS.length}`}</div>;
                    })()}
                    {(() => {
                      const rated = services.filter((v) => v.rating && (v.supplierId === s.id || (!v.supplierId && devices.find((d) => d.id === v.deviceId)?.supplierId === s.id)));
                      if (!rated.length) return null;
                      const avg = rated.reduce((t, v) => t + v.rating, 0) / rated.length;
                      return <div style={{ fontSize: 12, fontWeight: 700, color: avg >= 4 ? "#2F855A" : avg >= 3 ? "#B7791F" : "#C53030", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><Star size={12} fill="currentColor" /> {avg.toFixed(1)} <span style={{ color: "#8A94A0", fontWeight: 600 }}>from {rated.length} rated visit{rated.length === 1 ? "" : "s"}</span></div>;
                    })()}
                    <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {gbp(s.costAmount)} / {s.costFrequency === "annual" ? "yr" : "mo"}
                    </div>
                  </button>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {ACTIVE_CAN_EDIT && (
                      <button onClick={() => onEdit(s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Pencil size={15} color="#8A94A0" />
                      </button>
                    )}
                    {(s.managerPhone || /^[+0-9 ()-]{7,}$/.test(s.contact || "")) && (
                      <a href={`tel:${(s.managerPhone || s.contact).replace(/[^+0-9]/g, "")}`} title={`Call ${s.managerName || s.name}`} style={{ padding: 4, display: "flex" }}><Phone size={15} color="#2F855A" /></a>
                    )}
                    {s.managerEmail && (
                      <a href={`mailto:${s.managerEmail}?subject=${encodeURIComponent(`Re: ${s.name}`)}`} title={`Email ${s.managerName || s.managerEmail}`} style={{ padding: 4, display: "flex" }}><Mail size={15} color="#2B4562" /></a>
                    )}
                    <button onClick={() => setScoreFor(s)} title="Scorecard" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Gauge size={15} color="#2B4562" />
                    </button>
                    <ConfirmDeleteButton onConfirm={() => onDelete(s.id)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {scoreFor && <SupplierScorecardModal supplier={scoreFor} devices={devices} services={services} works={works} budgetLines={budgetLines} visitBudgets={visitBudgets} onClose={() => setScoreFor(null)} />}
    </div>
  );
}

function AddSupplierModal({ existing, subcategoriesByCategory, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [category, setCategory] = useState(existing?.category || "cleaning");
  const [name, setName] = useState(existing?.name || "");
  const [subCategory, setSubCategory] = useState(existing?.subCategory || "");
  const [contact, setContact] = useState(existing?.contact || "");
  const [managerName, setManagerName] = useState(existing?.managerName || "");
  const [managerEmail, setManagerEmail] = useState(existing?.managerEmail || "");
  const [managerPhone, setManagerPhone] = useState(existing?.managerPhone || "");
  const [contractStart, setContractStart] = useState(existing?.contractStart || "");
  const [contractEnd, setContractEnd] = useState(existing?.contractEnd || "");
  const [noticeDays, setNoticeDays] = useState(existing?.noticeDays ? String(existing.noticeDays) : "60");
  const [contractRef, setContractRef] = useState(existing?.contractRef || "");
  const [costAmount, setCostAmount] = useState(existing?.costAmount ? String(existing.costAmount) : "");
  const [costFrequency, setCostFrequency] = useState(existing?.costFrequency || "monthly");
  const [insuranceExpiry, setInsuranceExpiry] = useState(existing?.insuranceExpiry || "");
  const [accreditation, setAccreditation] = useState(existing?.accreditation || "");
  const [accreditationExpiry, setAccreditationExpiry] = useState(existing?.accreditationExpiry || "");
  const [onboarding, setOnboarding] = useState(existing?.onboarding || {});
  const [supLinks, setSupLinks] = useState(existing?.links || []);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submit() {
    if (!name.trim()) return;
    onSave({ id: existing?.id, category, subCategory: subCategory.trim(), name: name.trim(), contact: contact.trim(),
      managerName: managerName.trim(), managerEmail: managerEmail.trim(), managerPhone: managerPhone.trim(),
      contractStart: contractStart || null, contractEnd: contractEnd || null, noticeDays: noticeDays ? Number(noticeDays) : 60, contractRef: contractRef.trim(),
      priceHistory: existing && Number(existing.costAmount) !== (costAmount ? Number(costAmount) : 0)
        ? [...(existing.priceHistory || []), { amount: Number(existing.costAmount) || 0, frequency: existing.costFrequency, until: new Date().toISOString().slice(0, 10) }]
        : (existing?.priceHistory || []),
      costAmount: costAmount ? Number(costAmount) : 0, costFrequency,
      insuranceExpiry: insuranceExpiry || null, accreditation: accreditation.trim(), accreditationExpiry: accreditationExpiry || null, onboarding,
      links: supLinks.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim() || "Document", url: /^https?:\/\//i.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}` })) });
  }
  return (
    <Modal title={isEdit ? "Edit supplier" : "Add supplier"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Service category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <CategoryOptions />
          </Select>
        </Field>
        <SubCategoryField value={subCategory} onChange={setSubCategory} suggestions={subcategoriesByCategory?.[category] || []} />
        <Field label="Supplier name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brightspace Cleaning Ltd" /></Field>
        <Field label="General contact (optional)"><TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Office phone or helpdesk email" /></Field>
        <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Account manager — used for chase-up emails</div>
          <Field label="Manager name"><TextInput value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. Jane Smith" /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Email"><TextInput type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="jane@supplier.co.uk" /></Field>
            <Field label="Phone"><TextInput type="tel" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} placeholder="07…" /></Field>
          </div>
        </div>
        <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Contract</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Start"><TextInput type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} /></Field>
            <Field label="End"><TextInput type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Remind me (days before end)"><TextInput type="number" min="0" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} /></Field>
            <Field label="Contract ref (optional)"><TextInput value={contractRef} onChange={(e) => setContractRef(e.target.value)} placeholder="e.g. CT-2026-014" /></Field>
          </div>
        </div>
        <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Compliance documents — you'll be alerted 30 days before expiry</div>
          <Field label="Public liability insurance expires"><TextInput type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Accreditation"><TextInput value={accreditation} onChange={(e) => setAccreditation(e.target.value)} placeholder="e.g. Gas Safe, SafeContractor" /></Field>
            <Field label="Expires"><TextInput type="date" value={accreditationExpiry} onChange={(e) => setAccreditationExpiry(e.target.value)} /></Field>
          </div>
        </div>
        <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Documents &amp; links (contract, insurance certificate, RAMS…)</div>
          {supLinks.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <TextInput value={l.label} onChange={(e) => setSupLinks((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ width: "35%" }} />
              <TextInput value={l.url} onChange={(e) => setSupLinks((p) => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" onClick={() => setSupLinks((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={14} color="#A3ABB4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setSupLinks((p) => [...p, { label: "", url: "" }])} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: "0 0 6px" }}>+ Add a link</button>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Onboarding checklist — {Object.keys(onboarding).filter((k) => ONBOARDING_ITEMS.includes(k)).length}/{ONBOARDING_ITEMS.length} received</div>
          {ONBOARDING_ITEMS.map((item) => (
            <label key={item} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, color: "#3A4451", cursor: "pointer" }}>
              <input type="checkbox" checked={!!onboarding[item]} onChange={(e) => setOnboarding((p) => { const n = { ...p }; if (e.target.checked) n[item] = new Date().toISOString().slice(0, 10); else delete n[item]; return n; })} style={{ margin: 0 }} />
              <span style={{ flex: 1 }}>{item}</span>
              {onboarding[item] && <span style={{ fontSize: 10.5, color: "#8A94A0" }}>{fmtDate(onboarding[item])}</span>}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Billing">
            <Select value={costFrequency} onChange={(e) => setCostFrequency(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </Select>
          </Field>
        </div>
        <PrimaryButton onClick={submit}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Save supplier"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onDelete(existing.id)} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this supplier
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Budget & Cost comparison Tab
--------------------------------------------------------- */

function BudgetTab({ onRollForward, budgets, services, works, suppliers, devices, budgetLines, visitBudgets, subcategoriesByCategory, onSetBudget, onAddLines, onUpdateLine, onDeleteLine, onApplySuggestion, shiftDateFn = (d) => d }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [view, setView] = useState("month"); // 'month' | 'year' | 'calendar' | 'plan'
  const [editingCategory, setEditingCategory] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calSelectedDate, setCalSelectedDate] = useState(null);
  const [planGroupBy, setPlanGroupBy] = useState("category"); // 'category' | 'subcategory' | 'supplier' | 'month'
  const [planView, setPlanView] = useState("sheet"); // 'sheet' | 'grouped'
  const [recordingSpendFor, setRecordingSpendFor] = useState(null); // budget line
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [addingLine, setAddingLine] = useState(false);
  const [editingLine, setEditingLine] = useState(null);

  const deviceCat = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d.serviceCategory || "maintenance"])), [devices]);
  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

  const maxByCategory = useMemo(() => {
    const m = emptyCatMap();
    budgets.filter((b) => b.year === year).forEach((b) => { if (m[b.category] !== undefined) m[b.category] = Number(b.amount) || 0; });
    return m;
  }, [budgets, year]);

  // Sum of everything planned in Budget → Plan for this year, by category —
  // shown alongside the max so it's clear added lines are being tracked even
  // before a max is set.
  const plannedByCategory = useMemo(() => {
    const m = emptyCatMap();
    budgetLines.forEach((l) => {
      if (new Date(l.date).getFullYear() !== year) return;
      if (m[l.category] !== undefined) m[l.category] += Number(l.amount) || 0;
    });
    return m;
  }, [budgetLines, year]);

  // The number actually used as "budget" everywhere (header total, charts,
  // category bars): the max you set, or — until you set one — what you've
  // planned in Budget → Plan lines, so nothing shows as £0 just because a
  // max was never entered.
  const effectiveMaxByCategory = useMemo(() => {
    const m = {};
    CATEGORY_KEYS.forEach((c) => { m[c] = maxByCategory[c] > 0 ? maxByCategory[c] : plannedByCategory[c]; });
    return m;
  }, [maxByCategory, plannedByCategory]);
  const totalBudget = CATEGORY_KEYS.reduce((s, c) => s + effectiveMaxByCategory[c], 0);

  // Same fallback, but for an arbitrary year (used by the multi-year chart).
  function effectiveTotalBudgetForYear(y) {
    const catMax = emptyCatMap();
    budgets.filter((b) => b.year === y).forEach((b) => { if (catMax[b.category] !== undefined) catMax[b.category] = Number(b.amount) || 0; });
    const catPlanned = emptyCatMap();
    budgetLines.forEach((l) => {
      if (new Date(l.date).getFullYear() !== y) return;
      if (catPlanned[l.category] !== undefined) catPlanned[l.category] += Number(l.amount) || 0;
    });
    return CATEGORY_KEYS.reduce((s, c) => s + (catMax[c] > 0 ? catMax[c] : catPlanned[c]), 0);
  }

  const supplierMonthlyByCategory = useMemo(() => {
    const m = emptyCatMap();
    suppliers.forEach((s) => {
      const monthly = s.costFrequency === "annual" ? Number(s.costAmount) / 12 : Number(s.costAmount);
      if (m[s.category] !== undefined) m[s.category] += monthly;
    });
    return m;
  }, [suppliers]);

  // Year totals split by category — services + budgeted works + supplier (annualised); non-controllable tracked separately.
  const actualByCategory = useMemo(() => {
    const m = emptyCatMap();
    services.forEach((s) => {
      const d = new Date(s.date);
      if (d.getFullYear() !== year) return;
      const cat = deviceCat[s.deviceId] || "maintenance";
      if (m[cat] !== undefined) m[cat] += Number(s.cost) || 0;
    });
    works.forEach((w) => {
      if (w.status !== "approved" && w.status !== "in_progress" && w.status !== "completed") return;
      if (w.budgetType === "non_controllable") return;
      const d = new Date(w.dateRaised);
      if (d.getFullYear() !== year) return;
      const cat = deviceCat[w.deviceId] || "maintenance";
      if (m[cat] !== undefined) m[cat] += Number(w.quoteAmount) || 0;
    });
    budgetLines.forEach((l) => {
      if (l.actualAmount == null || isMirrored(l)) return;
      const d = new Date(l.date);
      if (d.getFullYear() !== year) return;
      if (m[l.category] !== undefined) m[l.category] += Number(l.actualAmount) || 0;
    });
    CATEGORY_KEYS.forEach((c) => { m[c] += supplierMonthlyByCategory[c] * 12; });
    return m;
  }, [services, works, budgetLines, deviceCat, year, supplierMonthlyByCategory]);

  const nonControllableTotal = useMemo(() => works
    .filter((w) => w.budgetType === "non_controllable" && w.status !== "rejected" && new Date(w.dateRaised).getFullYear() === year)
    .reduce((sum, w) => sum + (Number(w.quoteAmount) || 0), 0), [works, year]);

  const totalActual = CATEGORY_KEYS.reduce((s, c) => s + actualByCategory[c], 0);
  const variance = totalBudget - totalActual;

  const monthlyData = useMemo(() => MONTH_LABELS.map((label, i) => {
    let svc = 0, wk = 0, bl = 0, plannedThisMonth = 0;
    services.forEach((s) => { const d = new Date(s.date); if (d.getFullYear() === year && d.getMonth() === i) svc += Number(s.cost) || 0; });
    works.forEach((w) => {
      if (w.budgetType === "non_controllable") return;
      if (w.status !== "approved" && w.status !== "in_progress" && w.status !== "completed") return;
      const d = new Date(w.dateRaised);
      if (d.getFullYear() === year && d.getMonth() === i) wk += Number(w.quoteAmount) || 0;
    });
    budgetLines.forEach((l) => {
      const d = new Date(l.date);
      if (d.getFullYear() !== year || d.getMonth() !== i) return;
      plannedThisMonth += Number(l.amount) || 0; // what was budgeted for this specific month
      if (l.actualAmount != null && !isMirrored(l)) bl += Number(l.actualAmount) || 0;
    });
    const supplierMonthly = CATEGORY_KEYS.reduce((s, c) => s + supplierMonthlyByCategory[c], 0);
    return { month: label, cost: Math.round(svc + wk + bl + supplierMonthly), budget: Math.round(plannedThisMonth + supplierMonthly) };
  }), [services, works, budgetLines, year, supplierMonthlyByCategory]);

  const yearlyData = useMemo(() => {
    const years = []; for (let y = thisYear - 4; y <= thisYear; y++) years.push(y);
    const supplierAnnual = CATEGORY_KEYS.reduce((s, c) => s + supplierMonthlyByCategory[c] * 12, 0);
    return years.map((y) => {
      const svc = services.filter((s) => new Date(s.date).getFullYear() === y).reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
      const wk = works.filter((w) => w.budgetType !== "non_controllable" && (w.status === "approved" || w.status === "in_progress" || w.status === "completed") && new Date(w.dateRaised).getFullYear() === y).reduce((sum, w) => sum + (Number(w.quoteAmount) || 0), 0);
      const bl = budgetLines.filter((l) => l.actualAmount != null && !isMirrored(l) && new Date(l.date).getFullYear() === y).reduce((sum, l) => sum + (Number(l.actualAmount) || 0), 0);
      const budgetY = effectiveTotalBudgetForYear(y);
      return { year: String(y), cost: Math.round(svc + wk + bl + supplierAnnual), budget: Math.round(budgetY) };
    });
  }, [services, works, budgetLines, budgets, thisYear, supplierMonthlyByCategory]);

  // Per-day spend for the calendar view — logged visits, works, AND any Budget
  // Plan line with a recorded actual spend, all placed on their real dates.
  const spendByDate = useMemo(() => {
    const m = {};
    services.forEach((s) => {
      if (!s.date || !s.cost) return;
      (m[s.date] = m[s.date] || []).push({ amount: Number(s.cost), controllable: true });
    });
    works.forEach((w) => {
      if (!w.dateRaised || !w.quoteAmount || w.status === "rejected") return;
      (m[w.dateRaised] = m[w.dateRaised] || []).push({ amount: Number(w.quoteAmount), controllable: w.budgetType !== "non_controllable" });
    });
    budgetLines.forEach((l) => {
      if (!l.date || l.actualAmount == null || isMirrored(l)) return;
      (m[l.date] = m[l.date] || []).push({ amount: Number(l.actualAmount), controllable: true });
    });
    return m;
  }, [services, works, budgetLines]);

  // Actual spend broken down by supplier or by service, for the Month/Year chart's
  // "By supplier" / "By service" option — one flat list of dated, attributed spend.
  const [chartBreakdown, setChartBreakdown] = useState("total"); // 'total' | 'supplier' | 'service'
  const BREAKDOWN_COLORS = ["#2B4562", "#D97706", "#2F855A", "#8E4585", "#2B7A78", "#9B2C2C", "#5B6672", "#C53030"];

  const actualItems = useMemo(() => {
    const items = [];
    services.forEach((s) => { if (s.cost) items.push({ date: s.date, amount: Number(s.cost) || 0, supplierId: s.supplierId || null, deviceId: s.deviceId || null }); });
    budgetLines.forEach((l) => { if (l.actualAmount != null && !isMirrored(l)) items.push({ date: l.date, amount: Number(l.actualAmount) || 0, supplierId: l.supplierId || null, deviceId: l.deviceId || null }); });
    return items;
  }, [services, budgetLines]);

  const supplierNameById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const deviceNameById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d.name])), [devices]);

  function buildBreakdownData(periods, periodKeyFor, groupBy) {
    const nameFor = (item) => {
      if (groupBy === "supplier") return item.supplierId ? (supplierNameById[item.supplierId] || "Unknown supplier") : "No supplier";
      return item.deviceId ? (deviceNameById[item.deviceId] || "Unknown service") : "No service";
    };
    const periodKeys = new Set(periods.map((p) => p.key));
    const relevant = actualItems.filter((it) => it.date && periodKeys.has(periodKeyFor(it.date)));
    const totals = {};
    relevant.forEach((it) => { const n = nameFor(it); totals[n] = (totals[n] || 0) + it.amount; });
    const sortedNames = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const topNames = sortedNames.slice(0, 6);
    const hasOther = sortedNames.length > 6;
    const seriesNames = hasOther ? [...topNames, "Other"] : topNames;
    const data = periods.map((p) => {
      const row = { label: p.label };
      seriesNames.forEach((n) => { row[n] = 0; });
      relevant.forEach((it) => {
        if (periodKeyFor(it.date) !== p.key) return;
        let n = nameFor(it);
        if (hasOther && !topNames.includes(n)) n = "Other";
        row[n] = (row[n] || 0) + it.amount;
      });
      return row;
    });
    return { data, seriesNames };
  }

  const monthBreakdown = useMemo(() => {
    if (chartBreakdown === "total") return null;
    const periods = MONTH_LABELS.map((label, i) => ({ label, key: `${year}-${i}` }));
    return buildBreakdownData(periods, (dateStr) => { const d = new Date(dateStr); return `${d.getFullYear()}-${d.getMonth()}`; }, chartBreakdown);
  }, [chartBreakdown, year, actualItems, supplierNameById, deviceNameById]);

  const yearBreakdown = useMemo(() => {
    if (chartBreakdown === "total") return null;
    const years = []; for (let y = thisYear - 4; y <= thisYear; y++) years.push(y);
    const periods = years.map((y) => ({ label: String(y), key: String(y) }));
    return buildBreakdownData(periods, (dateStr) => String(new Date(dateStr).getFullYear()), chartBreakdown);
  }, [chartBreakdown, thisYear, actualItems, supplierNameById, deviceNameById]);

  // Per-device budget-per-visit comparison — uses the nearest visit-specific
  // budget for each logged visit where set, falling back to the device's flat rate.
  // Counts both logged visits (Log visit) and Budget Plan lines with a recorded
  // spend that are linked to this device, so either way of recording it shows up here.
  const perVisitRows = useMemo(() => {
    const vbByDevice = {};
    visitBudgets.forEach((v) => { (vbByDevice[v.deviceId] = vbByDevice[v.deviceId] || []).push(v); });
    return devices.filter((d) => d.budgetPerVisit || vbByDevice[d.id]?.length).map((d) => {
      const deviceServices = services.filter((s) => s.deviceId === d.id && s.cost);
      const deviceLineSpends = budgetLines.filter((l) => l.deviceId === d.id && l.actualAmount != null && !isMirrored(l));
      const allDates = [...deviceServices.map((s) => s.date), ...deviceLineSpends.map((l) => l.date)];
      const costs = [...deviceServices.map((s) => Number(s.cost)), ...deviceLineSpends.map((l) => Number(l.actualAmount))];
      const avg = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
      const vbList = vbByDevice[d.id] || [];
      let targetAvg = d.budgetPerVisit || 0;
      if (vbList.length && allDates.length) {
        const targets = allDates.map((date) => {
          let best = null, bestDiff = Infinity;
          vbList.forEach((v) => {
            const diff = Math.abs(new Date(v.date + "T00:00:00").getTime() - new Date(date + "T00:00:00").getTime());
            if (diff < bestDiff) { bestDiff = diff; best = v; }
          });
          return best ? Number(best.amount) : (d.budgetPerVisit || 0);
        });
        targetAvg = targets.reduce((a, b) => a + b, 0) / targets.length;
      } else if (vbList.length) {
        targetAvg = vbList.reduce((a, b) => a + Number(b.amount), 0) / vbList.length;
      }
      return { device: d, avg, visits: costs.length, targetAvg, variesByVisit: vbList.length > 1 };
    });
  }, [devices, services, budgetLines, visitBudgets]);

  // Per-supplier breakdown for the year: recurring contract cost (annualised) +
  // any logged visit or Budget Plan line (with a recorded spend) tied to that supplier.
  const supplierRows = useMemo(() => {
    const rows = suppliers.map((s) => {
      const recurring = (s.costFrequency === "annual" ? Number(s.costAmount) : Number(s.costAmount) * 12) || 0;
      const loggedVisits = services.filter((sv) => sv.supplierId === s.id && new Date(sv.date).getFullYear() === year).reduce((sum, sv) => sum + (Number(sv.cost) || 0), 0);
      const loggedLines = budgetLines.filter((l) => l.supplierId === s.id && l.actualAmount != null && !isMirrored(l) && new Date(l.date).getFullYear() === year).reduce((sum, l) => sum + (Number(l.actualAmount) || 0), 0);
      const logged = loggedVisits + loggedLines;
      return { supplier: s, recurring, logged, total: recurring + logged };
    });
    return rows.sort((a, b) => b.total - a.total);
  }, [suppliers, services, budgetLines, year]);

  // Per-service-line (device) breakdown for the year: logged visit costs + budgeted
  // work costs + Budget Plan lines linked to that device with a recorded spend.
  const serviceLineRows = useMemo(() => {
    const rows = devices.map((d) => {
      const svcCost = services.filter((s) => s.deviceId === d.id && new Date(s.date).getFullYear() === year).reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
      const wkCost = works.filter((w) => w.deviceId === d.id && w.budgetType !== "non_controllable" && (w.status === "approved" || w.status === "in_progress" || w.status === "completed") && new Date(w.dateRaised).getFullYear() === year).reduce((sum, w) => sum + (Number(w.quoteAmount) || 0), 0);
      const lineCost = budgetLines.filter((l) => l.deviceId === d.id && l.actualAmount != null && !isMirrored(l) && new Date(l.date).getFullYear() === year).reduce((sum, l) => sum + (Number(l.actualAmount) || 0), 0);
      return { device: d, total: svcCost + wkCost + lineCost };
    }).filter((r) => r.total > 0);
    return rows.sort((a, b) => b.total - a.total);
  }, [devices, services, works, budgetLines, year]);

  // Contract plan for the year
  const yearLines = useMemo(() => budgetLines.filter((l) => new Date(l.date).getFullYear() === year), [budgetLines, year]);
  const planTotal = yearLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const spentLines = yearLines.filter((l) => l.actualAmount != null);
  const planSpent = spentLines.reduce((s, l) => s + (Number(l.actualAmount) || 0), 0);
  const planSpentBudgeted = spentLines.reduce((s, l) => s + (Number(l.amount) || 0), 0); // what those same lines were budgeted at
  const planVariance = planSpentBudgeted - planSpent; // positive = under budget so far
  const planRemaining = yearLines.filter((l) => l.actualAmount == null).reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const sheetLines = useMemo(() => [...yearLines].sort((a, b) => (a.date || "").localeCompare(b.date || "")), [yearLines]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const overdueUnspentLines = useMemo(() => yearLines.filter((l) => l.actualAmount == null && l.date < todayISO), [yearLines, todayISO]);
  const displaySheetLines = showOnlyOverdue ? sheetLines.filter((l) => l.actualAmount == null && l.date < todayISO) : sheetLines;

  // Variance rollup by category — only lines with a recorded actual spend.
  const varianceByCategory = useMemo(() => {
    const m = emptyCatMap();
    yearLines.forEach((l) => {
      if (l.actualAmount == null) return;
      if (m[l.category] !== undefined) m[l.category] += Number(l.amount) - Number(l.actualAmount);
    });
    return m;
  }, [yearLines]);

  const planGroups = useMemo(() => {
    const groups = {};
    const keyFor = (l) => {
      if (planGroupBy === "supplier") return l.supplierId ? (supplierById[l.supplierId]?.name || "Unknown supplier") : "No supplier";
      if (planGroupBy === "subcategory") return l.subCategory ? `${CATEGORY_META[l.category]?.label || l.category} · ${l.subCategory}` : `${CATEGORY_META[l.category]?.label || l.category} · No subcategory`;
      if (planGroupBy === "month") return new Date(l.date + "T00:00:00").toLocaleDateString("en-GB", { month: "long" });
      return CATEGORY_META[l.category]?.label || "Other";
    };
    yearLines.forEach((l) => { (groups[keyFor(l)] = groups[keyFor(l)] || []).push(l); });
    return Object.entries(groups)
      .map(([label, lines]) => ({ label, lines: lines.sort((a, b) => a.date.localeCompare(b.date)), subtotal: lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [yearLines, planGroupBy, supplierById]);

  const displayGroups = useMemo(() => {
    if (!showOnlyOverdue) return planGroups;
    return planGroups
      .map((g) => ({ ...g, lines: g.lines.filter((l) => l.actualAmount == null && l.date < todayISO) }))
      .filter((g) => g.lines.length > 0);
  }, [planGroups, showOnlyOverdue, todayISO]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100, fontSize: 13 }}>
          {Array.from({ length: 6 }, (_, i) => thisYear - 4 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <div style={{ display: "flex", gap: 10 }}>
          <MetricBlock label="Total budget" value={gbp(totalBudget)} />
          <MetricBlock label={variance >= 0 ? "Remaining" : "Over budget"} value={gbp(Math.abs(variance))} tone={variance >= 0 ? "ok" : "danger"} />
        </div>
      </div>

      {/* Per-category max & control */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {CATEGORY_KEYS.map((cat) => {
          const meta = CATEGORY_META[cat];
          const max = maxByCategory[cat];
          const planned = plannedByCategory[cat];
          const actual = actualByCategory[cat];
          const effectiveMax = max > 0 ? max : planned;
          const pct = effectiveMax > 0 ? Math.min(100, Math.round((actual / effectiveMax) * 100)) : 0;
          const over = effectiveMax > 0 && actual > effectiveMax;
          return (
            <div key={cat} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                  <meta.icon size={14} color={meta.color} /> {meta.label}
                </span>
                {ACTIVE_CAN_EDIT && (
                  <button onClick={() => setEditingCategory(cat)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>
                    {max ? "Edit max" : "Set max"}
                  </button>
                )}
              </div>
              <div style={{ height: 7, background: "#EEF0F2", borderRadius: 20, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: over ? "#C53030" : meta.color, borderRadius: 20, transition: "width .2s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#8A94A0" }}>
                <span>{gbp(actual)} spent</span>
                <span style={{ color: over ? "#C53030" : "#8A94A0", fontWeight: over ? 700 : 500 }}>
                  of {gbp(effectiveMax)} {max > 0 ? "max" : "planned"}
                </span>
              </div>
              {planned > 0 && (
                <div style={{ fontSize: 10.5, color: "#A3ABB4", marginTop: 3 }}>
                  {gbp(planned)} planned across Budget → Plan lines this year{max === 0 ? " — set a max to cap it instead" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10.5, color: "#A3ABB4", marginBottom: 10 }}>
        "Spent" above counts logged service costs, approved/completed works, recurring supplier contracts, and any Plan line where you've recorded an actual spend. Log the same cost in only one place to avoid double-counting it.
      </div>

      {nonControllableTotal > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FDF1E0", border: "1px solid #E6D9BC", borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12.5, color: "#8A5A0B", fontWeight: 600 }}>
          <ShieldAlert size={14} /> {gbp(nonControllableTotal)} in non-controllable works this year — outside category maximums.
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <ToggleButton active={view === "month"} onClick={() => setView("month")}>Month</ToggleButton>
        <ToggleButton active={view === "year"} onClick={() => setView("year")}>Year</ToggleButton>
        <ToggleButton active={view === "calendar"} onClick={() => setView("calendar")}>Calendar</ToggleButton>
        <ToggleButton active={view === "plan"} onClick={() => setView("plan")}>Plan</ToggleButton>
        <ToggleButton active={view === "variance"} onClick={() => setView("variance")}>Variance</ToggleButton>
      </div>

      {(view === "month" || view === "year") && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <ToggleButton active={chartBreakdown === "total"} onClick={() => setChartBreakdown("total")}>Total</ToggleButton>
          <ToggleButton active={chartBreakdown === "supplier"} onClick={() => setChartBreakdown("supplier")}>By supplier</ToggleButton>
          <ToggleButton active={chartBreakdown === "service"} onClick={() => setChartBreakdown("service")}>By service</ToggleButton>
        </div>
      )}

      {view === "month" || view === "year" ? (
        <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "14px 8px 4px" }}>
          <ResponsiveContainer width="100%" height={230}>
            {chartBreakdown === "total" ? (
              <BarChart data={view === "month" ? monthlyData : yearlyData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" vertical={false} />
                <XAxis dataKey={view === "month" ? "month" : "year"} tick={{ fontSize: 11, fill: "#8A94A0" }} axisLine={{ stroke: "#E1E4E8" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8A94A0" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `£${v >= 1000 ? Math.round(v / 1000) + "k" : v}`} />
                <Tooltip formatter={(v) => gbp(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E1E4E8" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="cost" name="Actual" fill="#2B4562" radius={[4, 4, 0, 0]} />
                <Bar dataKey="budget" name="Budget" fill="#D97706" radius={[4, 4, 0, 0]} opacity={0.55} />
              </BarChart>
            ) : (() => {
              const b = view === "month" ? monthBreakdown : yearBreakdown;
              if (!b || b.seriesNames.length === 0) return <div />;
              return (
                <BarChart data={b.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A94A0" }} axisLine={{ stroke: "#E1E4E8" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#8A94A0" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `£${v >= 1000 ? Math.round(v / 1000) + "k" : v}`} />
                  <Tooltip formatter={(v) => gbp(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E1E4E8" }} />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  {b.seriesNames.map((name, i) => (
                    <Bar key={name} dataKey={name} name={name} stackId="a" fill={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} radius={i === b.seriesNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              );
            })()}
          </ResponsiveContainer>
          {chartBreakdown !== "total" && (!(view === "month" ? monthBreakdown : yearBreakdown)?.seriesNames.length) && (
            <div style={{ textAlign: "center", color: "#A3ABB4", fontSize: 12.5, padding: "20px 0" }}>No recorded spend to break down yet.</div>
          )}
        </div>
      ) : view === "variance" ? (
        <VarianceView year={year} devices={devices} services={services} works={works} budgetLines={budgetLines} suppliers={suppliers} />
      ) : view === "calendar" ? (
        <SpendCalendar year={year} month={calMonth} onMonthChange={setCalMonth} spendByDate={spendByDate}
          selectedDate={calSelectedDate} onSelectDate={setCalSelectedDate} />
      ) : (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <MetricBlock label="Budgeted total" value={gbp(planTotal)} />
            <MetricBlock label="Not yet spent" value={gbp(planRemaining)} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <MetricBlock label="Spent so far" value={gbp(planSpent)} />
            <MetricBlock label={planVariance >= 0 ? "Under budget" : "Over budget"} value={gbp(Math.abs(planVariance))} tone={planVariance >= 0 ? "ok" : "danger"} />
          </div>
          {planSpent === 0 && planTotal > 0 && (
            <div style={{ fontSize: 11.5, color: "#8A94A0", marginBottom: 12, marginTop: -6 }}>
              Nothing recorded as spent yet — tap any line below and enter its actual cost to start tracking against budget.
            </div>
          )}

          {(varianceByCategory.cleaning !== 0 || varianceByCategory.maintenance !== 0 || varianceByCategory.catering !== 0) && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {CATEGORY_KEYS.filter((c) => varianceByCategory[c] !== 0).map((c) => {
                const v = varianceByCategory[c];
                const meta = CATEGORY_META[c];
                return (
                  <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 650, background: v >= 0 ? "#EAF4EE" : "#FBEAEA", color: v >= 0 ? "#2F6B4A" : "#9B2C2C", padding: "5px 10px", borderRadius: 20 }}>
                    <meta.icon size={12} /> {meta.label} {v >= 0 ? "+" : ""}{gbp(v)}
                  </span>
                );
              })}
            </div>
          )}

          {overdueUnspentLines.length > 0 && (
            <button onClick={() => setShowOnlyOverdue((v) => !v)} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", background: showOnlyOverdue ? "#2B4562" : "#FDF1E0",
              border: "1px solid " + (showOnlyOverdue ? "#2B4562" : "#E6D9BC"), borderRadius: 10, padding: "9px 12px", marginBottom: 12,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
              <ShieldAlert size={14} color={showOnlyOverdue ? "#fff" : "#8A5A0B"} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: showOnlyOverdue ? "#fff" : "#8A5A0B", fontWeight: 650, flex: 1 }}>
                {overdueUnspentLines.length} line{overdueUnspentLines.length === 1 ? "" : "s"} past due with no spend recorded
                {showOnlyOverdue ? " — showing only these" : " — tap to filter"}
              </span>
            </button>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <ToggleButton active={planView === "sheet"} onClick={() => setPlanView("sheet")}>Sheet</ToggleButton>
              <ToggleButton active={planView === "grouped"} onClick={() => setPlanView("grouped")}>Grouped</ToggleButton>
            </div>
            {yearLines.length > 0 && (
              <ExportButton filename={`contract-plan-${year}.csv`} rows={[
                ["Description", "Category", "Supplier", "Date", "Budgeted", "Actual", "Status", "Added by"],
                ...sheetLines.map((l) => [l.description, CATEGORY_META[l.category]?.label || l.category, l.supplierId ? (supplierById[l.supplierId]?.name || "") : "", l.date, l.amount, l.actualAmount ?? "", l.status, l.addedBy || ""]),
              ]} />
            )}
          </div>
          {planView === "grouped" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <ToggleButton active={planGroupBy === "category"} onClick={() => setPlanGroupBy("category")}>Category</ToggleButton>
              <ToggleButton active={planGroupBy === "subcategory"} onClick={() => setPlanGroupBy("subcategory")}>Subcategory</ToggleButton>
              <ToggleButton active={planGroupBy === "supplier"} onClick={() => setPlanGroupBy("supplier")}>Supplier</ToggleButton>
              <ToggleButton active={planGroupBy === "month"} onClick={() => setPlanGroupBy("month")}>Month</ToggleButton>
            </div>
          )}
          {ACTIVE_CAN_EDIT && (
            <button onClick={() => setAddingLine(true)} style={{
              width: "100%", background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "10px 14px",
              fontSize: 13.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 7, marginBottom: 14,
            }}><Plus size={15} /> Add contract line</button>
          )}
          {ACTIVE_CAN_EDIT && onApplySuggestion && (
            <button onClick={() => setShowSuggest(true)} style={{ width: "100%", background: "#fff", color: "#2B4562", border: "1px dashed #9AA5B1", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: -6, marginBottom: 14 }}>
              <Sparkles size={15} /> Suggest a 12-month plan
            </button>
          )}
          {ACTIVE_CAN_EDIT && onRollForward && yearLines.length > 0 && (
            <button onClick={() => setRollOpen(true)} style={{ width: "100%", background: "#fff", color: "#2B4562", border: "1px dashed #9AA5B1", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: -6, marginBottom: 14 }}>
              <CopyPlus size={15} /> Copy {year} plan into {year + 1}
            </button>
          )}
          {rollOpen && <RollForwardModal year={year} lines={yearLines} budgets={budgets} onClose={() => setRollOpen(false)} onApply={(pct, caps) => { onRollForward(year, pct, caps); setRollOpen(false); setYear(year + 1); }} />}
          {showSuggest && <SuggestPlanModal devices={devices} services={services} visitBudgets={visitBudgets} shiftDateFn={shiftDateFn} onClose={() => setShowSuggest(false)} onApply={(entries) => { onApplySuggestion(entries); setShowSuggest(false); }} />}

          {yearLines.length === 0 ? (
            <EmptyState icon={FileCheck} title="No contract lines yet" body="Add everything in this year's contracts up front, then record what each one actually cost as it happens." />
          ) : showOnlyOverdue && overdueUnspentLines.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing overdue" body="Every past-due line has a spend recorded. Tap the banner above to see everything again." />
          ) : planView === "sheet" ? (
            <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#F7F8F9", borderBottom: "1px solid #E1E4E8" }}>
                      {["Date", "Service", "Category", "Budgeted", "Actual", "Variance", ""].map((h) => (
                        <th key={h} style={{ textAlign: h === "Date" || h === "Service" || h === "Category" ? "left" : "right", padding: "10px 10px", fontWeight: 700, color: "#5B6672", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displaySheetLines.map((l) => {
                      const spent = l.actualAmount != null;
                      const variance = spent ? Number(l.amount) - Number(l.actualAmount) : null;
                      return (
                        <tr key={l.id} onClick={() => setRecordingSpendFor(l)} style={{ borderBottom: "1px solid #F0F1F3", cursor: "pointer" }}>
                          <td style={{ padding: "10px 10px", whiteSpace: "nowrap", color: "#5B6672" }}>{fmtDate(l.date)}</td>
                          <td style={{ padding: "10px 10px", fontWeight: 600, maxWidth: 160 }}>{l.description}</td>
                          <td style={{ padding: "10px 10px" }}><CategoryBadge category={l.category} subCategory={l.subCategory} /></td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(l.amount)}</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: spent ? "#1B2430" : "#C0C6CC" }}>{spent ? gbp(l.actualAmount) : "—"}</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: variance === null ? "#C0C6CC" : variance >= 0 ? "#2F855A" : "#C53030" }}>
                            {variance === null ? "—" : (variance >= 0 ? "+" : "") + gbp(variance)}
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "right" }}>
                            {ACTIVE_CAN_EDIT && (
                              <button onClick={(e) => { e.stopPropagation(); setEditingLine(l); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}>
                                <Pencil size={12} color="#A3ABB4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {displayGroups.map((g) => (
                <BudgetGroupSection key={g.label} group={g} supplierById={supplierById}
                  onRecordSpend={setRecordingSpendFor} onEdit={setEditingLine} onDelete={onDeleteLine} />
              ))}
            </div>
          )}
        </div>
      )}

      {perVisitRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Budget per visit vs actual</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {perVisitRows.map(({ device, avg, visits, targetAvg, variesByVisit }) => {
              const over = avg !== null && avg > targetAvg;
              return (
                <div key={device.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650 }}>{device.name}</div>
                    <div style={{ fontSize: 11, color: "#8A94A0" }}>{visits} logged visit{visits === 1 ? "" : "s"}{variesByVisit ? " · budget varies by visit" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: over ? "#C53030" : "#2F855A" }}>
                      {avg !== null ? gbp(avg) : "—"} avg
                    </div>
                    <div style={{ fontSize: 10.5, color: "#8A94A0" }}>{variesByVisit ? "avg target " : "target "}{gbp(targetAvg)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {serviceLineRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Spend by service line ({year})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {serviceLineRows.map(({ device, total }) => (
              <div key={device.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CategoryBadge category={device.serviceCategory} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{device.name}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>{gbp(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {supplierRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Spend by supplier ({year})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {supplierRows.map(({ supplier, recurring, logged, total }) => (
              <div key={supplier.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: "9px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CategoryBadge category={supplier.category} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{supplier.name}</span>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>{gbp(total)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 3 }}>
                  {gbp(recurring)} contract{logged > 0 ? ` + ${gbp(logged)} logged services` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingCategory && (
        <SetCategoryBudgetModal year={year} category={editingCategory} current={maxByCategory[editingCategory]}
          onClose={() => setEditingCategory(null)}
          onSave={(amt) => { onSetBudget(year, editingCategory, amt); setEditingCategory(null); }} />
      )}
      {addingLine && (
        <AddBudgetLineModal suppliers={suppliers} defaultYear={year} subcategoriesByCategory={subcategoriesByCategory} onClose={() => setAddingLine(false)}
          onSave={(lines) => { onAddLines(lines); setAddingLine(false); }} />
      )}
      {editingLine && (
        <AddBudgetLineModal suppliers={suppliers} defaultYear={year} existing={editingLine} subcategoriesByCategory={subcategoriesByCategory} onClose={() => setEditingLine(null)}
          onSave={(lines) => { onUpdateLine(editingLine.id, lines[0]); setEditingLine(null); }}
          onDelete={() => { onDeleteLine(editingLine.id); setEditingLine(null); }} />
      )}
      {recordingSpendFor && (
        <RecordSpendModal line={recordingSpendFor} onClose={() => setRecordingSpendFor(null)}
          onSave={(patch) => { onUpdateLine(recordingSpendFor.id, patch); setRecordingSpendFor(null); }}
          onEditDetails={() => { setEditingLine(recordingSpendFor); setRecordingSpendFor(null); }} />
      )}
    </div>
  );
}

function BudgetGroupSection({ group, supplierById, onRecordSpend, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  const spentCount = group.lines.filter((l) => l.actualAmount != null).length;
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px",
        background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <ChevronDown size={16} color="#8A94A0" style={{ flexShrink: 0, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1B2430" }}>{group.label}</span>
          <span style={{ fontSize: 11.5, color: "#A3ABB4", fontWeight: 600, flexShrink: 0 }}>{spentCount}/{group.lines.length} recorded</span>
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>{gbp(group.subtotal)}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px 12px" }}>
          {group.lines.map((l) => (
            <BudgetLineRow key={l.id} line={l} supplier={l.supplierId ? supplierById[l.supplierId] : null}
              onRecordSpend={() => onRecordSpend(l)}
              onEdit={() => onEdit(l)}
              onDelete={() => onDelete(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetLineRow({ line, supplier, onRecordSpend, onEdit, onDelete }) {
  const spent = line.actualAmount != null;
  const variance = spent ? Number(line.amount) - Number(line.actualAmount) : null;
  const [viewingPhoto, setViewingPhoto] = useState(false);
  return (
    <>
      <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onRecordSpend} disabled={!ACTIVE_CAN_EDIT} style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: spent ? "none" : "1.5px solid #C0C6CC",
          background: spent ? (variance >= 0 ? "#2F855A" : "#C53030") : "#fff", cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {spent && <CheckCircle2 size={14} color="#fff" />}
        </button>
        {line.attachment && (
          <button onClick={() => setViewingPhoto(true)} style={{ width: 30, height: 30, borderRadius: 6, overflow: "hidden", border: "1px solid #E1E4E8", padding: 0, cursor: "pointer", flexShrink: 0 }}>
            <img src={line.attachment} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        )}
        <button onClick={onEdit} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ fontSize: 13, fontWeight: 650 }}>{line.description}</div>
          <div style={{ fontSize: 11, color: "#8A94A0", display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <span>{fmtDate(line.date)}</span>
            {supplier && <span>· {supplier.name}</span>}
            <CategoryBadge category={line.category} subCategory={line.subCategory} />
          </div>
        </button>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>{gbp(spent ? line.actualAmount : line.amount)}</div>
          {spent && (
            <div style={{ fontSize: 10, fontWeight: 700, color: variance >= 0 ? "#2F855A" : "#C53030" }}>
              budget {gbp(line.amount)} · {variance >= 0 ? "+" : ""}{gbp(variance)}
            </div>
          )}
        </div>
        <ConfirmDeleteButton onConfirm={onDelete} size={13} />
      </div>
      {viewingPhoto && line.attachment && (
        <Modal title={line.description} onClose={() => setViewingPhoto(false)} width={420}>
          <img src={line.attachment} alt="attachment" style={{ width: "100%", borderRadius: 10 }} />
        </Modal>
      )}
    </>
  );
}

function RecordSpendModal({ line, onClose, onSave, onEditDetails }) {
  const alreadySpent = line.actualAmount != null;
  const [amount, setAmount] = useState(alreadySpent ? String(line.actualAmount) : String(line.amount));
  const [date, setDate] = useState(line.actualDate || new Date().toISOString().slice(0, 10));
  function submit() {
    if (!amount) return;
    onSave({ actualAmount: Number(amount), actualDate: date, status: "completed", actualSource: "manual", actualServiceId: null });
  }
  function clear() {
    onSave({ actualAmount: null, actualDate: null, status: "planned", actualSource: null, actualServiceId: null });
  }
  const variance = amount ? Number(line.amount) - Number(amount) : null;
  return (
    <Modal title={line.description} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#8A94A0" }}>Budgeted for {fmtDate(line.date)}: <strong style={{ color: "#1B2430" }}>{gbp(line.amount)}</strong></div>
          {ACTIVE_CAN_EDIT && (
            <button onClick={onEditDetails} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, padding: 2, flexShrink: 0 }}>
              <Pencil size={11} /> Edit details
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Date spent"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={`Actual spend (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        </div>
        {amount && (
          <div style={{ fontSize: 12.5, fontWeight: 650, color: variance >= 0 ? "#2F855A" : "#C53030" }}>
            {variance >= 0 ? `${gbp(variance)} under budget` : `${gbp(Math.abs(variance))} over budget`}
          </div>
        )}
        <PrimaryButton onClick={submit}><CheckCircle2 size={15} /> {alreadySpent ? "Update spend" : "Record spend"}</PrimaryButton>
        {alreadySpent && (
          <button onClick={clear} style={{ background: "none", border: "none", color: "#8A94A0", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>
            Clear — mark as not yet spent
          </button>
        )}
      </div>
    </Modal>
  );
}

function AddBudgetLineModal({ suppliers, defaultYear, existing, subcategoriesByCategory, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const thisYear = new Date().getFullYear();
  const [description, setDescription] = useState(existing?.description || "");
  const [category, setCategory] = useState(existing?.category || "maintenance");
  const [subCategory, setSubCategory] = useState(existing?.subCategory || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [targetYear, setTargetYear] = useState(existing ? new Date(existing.date).getFullYear() : defaultYear);
  const [startDate, setStartDate] = useState(existing?.date || `${defaultYear}-01-15`);
  const [amount, setAmount] = useState(existing?.amount ? String(existing.amount) : "");
  const [repeat, setRepeat] = useState("once"); // 'once' | 'weekly' | 'monthly' | 'quarterly' | 'custom' | 'manual'
  const [customCount, setCustomCount] = useState("7");
  const [manualDates, setManualDates] = useState(existing?.date ? [existing.date] : [`${defaultYear}-01-15`]);
  const [attachment, setAttachment] = useState(existing?.attachment || null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Keep the date's year in sync when the Year selector changes (for new lines).
  function handleYearChange(y) {
    setTargetYear(y);
    const [, m, d] = startDate.split("-");
    setStartDate(`${y}-${m}-${d}`);
  }

  function updateManualDate(i, value) {
    setManualDates((prev) => prev.map((d, idx) => idx === i ? value : d));
  }
  function addManualDate() {
    setManualDates((prev) => [...prev, prev[prev.length - 1] || `${targetYear}-01-15`]);
  }
  function removeManualDate(i) {
    setManualDates((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { setAttachment(await compressImage(file)); } catch (err) { /* allow retry */ }
    setBusy(false);
  }
  function submit() {
    if (!description.trim() || !amount) return;
    const amt = Number(amount);
    if (isEdit) {
      const patch = { description: description.trim(), category, subCategory: subCategory.trim(), supplierId: supplierId || null, date: startDate, amount: amt, attachment };
      if (existing.amount !== amt) {
        const prevHistory = existing.amountHistory || [];
        patch.amountHistory = [...prevHistory, { amount: existing.amount, changedAt: new Date().toISOString().slice(0, 10) }];
      }
      onSave([patch]);
      return;
    }
    if (repeat === "manual") {
      const lines = manualDates.filter(Boolean).map((date) => ({
        description: description.trim(), category, subCategory: subCategory.trim(), supplierId: supplierId || null, date, amount: amt, attachment,
      }));
      onSave(lines);
      return;
    }
    let count = 1, dateFor = () => startDate;
    if (repeat === "monthly") { count = 12; dateFor = (i) => addMonths(startDate, i); }
    else if (repeat === "quarterly") { count = 4; dateFor = (i) => addMonths(startDate, i * 3); }
    else if (repeat === "weekly") { count = 52; dateFor = (i) => addDays(startDate, i * 7); }
    else if (repeat === "custom") {
      count = Math.max(1, Number(customCount) || 1);
      const stepDays = Math.round(365 / count);
      dateFor = (i) => addDays(startDate, i * stepDays);
    }
    const lines = Array.from({ length: count }, (_, i) => ({
      description: description.trim(), category, subCategory: subCategory.trim(), supplierId: supplierId || null,
      date: dateFor(i), amount: amt, attachment,
    }));
    onSave(lines);
  }

  return (
    <Modal title={isEdit ? "Edit contract line" : "Add contract line"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Description"><TextInput autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Monthly office cleaning" /></Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <CategoryOptions />
          </Select>
        </Field>
        <SubCategoryField value={subCategory} onChange={setSubCategory} suggestions={subcategoriesByCategory?.[category] || []} />
        <Field label="Supplier (optional)">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {!isEdit && (
          <Field label="Year">
            <Select value={targetYear} onChange={(e) => handleYearChange(Number(e.target.value))}>
              {Array.from({ length: 8 }, (_, i) => thisYear - 1 + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <span style={{ fontSize: 10.5, color: "#A3ABB4" }}>Pick any year — this doesn't have to match the year you're currently browsing.</span>
          </Field>
        )}
        {!isEdit && (
          <Field label="Repeat">
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="once">One-off</option>
              <option value="manual">Pick each date myself</option>
              <option value="weekly">Weekly (52 occurrences)</option>
              <option value="monthly">Monthly (12 occurrences)</option>
              <option value="quarterly">Quarterly (4 occurrences)</option>
              <option value="custom">Custom — set how many times a year (evenly spread)</option>
            </Select>
          </Field>
        )}
        {repeat === "manual" && !isEdit ? (
          <Field label="Visit dates">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {manualDates.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <TextInput type="date" value={d} onChange={(e) => updateManualDate(i, e.target.value)} style={{ flex: 1 }} />
                  {manualDates.length > 1 && (
                    <button onClick={() => removeManualDate(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Trash2 size={14} color="#C0C6CC" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addManualDate} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 11px", borderRadius: 8,
                border: "1px dashed #D7DCE1", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "#2B4562", fontWeight: 650,
              }}><Plus size={13} /> Add another visit date</button>
            </div>
            <span style={{ fontSize: 11, color: "#8A94A0" }}>Creates {manualDates.filter(Boolean).length} lines, one per date above, all with the same description and amount.</span>
          </Field>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <Field label={isEdit ? "Date" : "Start date"}><TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label={`Amount per occurrence (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
          </div>
        )}
        {repeat === "manual" && !isEdit && (
          <Field label={`Amount per occurrence (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        )}
        {isEdit && existing.amountHistory?.length > 0 && (
          <div style={{ fontSize: 11, color: "#8A94A0", background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontWeight: 700, marginBottom: 3, color: "#5B6672" }}>Budget history</div>
            {existing.amountHistory.map((h, i) => (
              <div key={i}>{gbp(h.amount)} until {fmtDate(h.changedAt)}</div>
            ))}
            <div>{gbp(existing.amount)} since {fmtDate(existing.amountHistory[existing.amountHistory.length - 1].changedAt)}</div>
          </div>
        )}
        <Field label="Contract page / evidence photo (optional)">
          <label style={{ border: "1px dashed #D7DCE1", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#5B6672", fontSize: 12.5, background: attachment ? "transparent" : "#FAFBFC" }}>
            {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={15} />}
            {attachment ? "Replace photo" : "Attach a photo (e.g. the contract page)"}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          {attachment && <img src={attachment} alt="attachment preview" style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid #E1E4E8" }} />}
          <span style={{ fontSize: 10.5, color: "#A3ABB4" }}>Storage here only holds images, not PDFs — a clear photo of the contract page works well as a substitute.</span>
        </Field>
        {!isEdit && repeat === "custom" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Field label="How many times a year"><TextInput type="number" min="1" max="365" value={customCount} onChange={(e) => setCustomCount(e.target.value)} placeholder="e.g. 7" /></Field>
            <span style={{ fontSize: 11, color: "#8A94A0" }}>
              Creates {Math.max(1, Number(customCount) || 1)} lines, spaced about {Math.round(365 / Math.max(1, Number(customCount) || 1))} days apart, starting from the start date.
            </span>
          </div>
        )}
        {!isEdit && (repeat === "weekly" || repeat === "monthly" || repeat === "quarterly") && (
          <span style={{ fontSize: 11, color: "#8A94A0" }}>
            Creates {repeat === "monthly" ? 12 : repeat === "weekly" ? 52 : 4} lines, one per {repeat === "monthly" ? "month" : repeat === "weekly" ? "week" : "quarter"}, starting from the start date — this can roll into the following year automatically.
          </span>
        )}
        <PrimaryButton onClick={submit}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Add to plan"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onDelete} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this line
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

function SpendCalendar({ year, month, onMonthChange, spendByDate, selectedDate, onSelectDate }) {
  function go(delta) {
    let m = month + delta;
    if (m < 0) m = 11; else if (m > 11) m = 0;
    onMonthChange(m);
    onSelectDate(null);
  }
  const grid = getMonthGrid(year, month);
  const dayTotal = (iso) => (spendByDate[iso] || []).reduce((s, i) => s + i.amount, 0);
  const hasNonControllable = (iso) => (spendByDate[iso] || []).some((i) => !i.controllable);
  const selectedItems = selectedDate ? (spendByDate[selectedDate] || []) : [];

  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => go(-1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronLeft size={15} color="#5B6672" /></button>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
          <button onClick={() => go(1)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronRight size={15} color="#5B6672" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map((w) => <div key={w} style={{ fontSize: 10, fontWeight: 700, color: "#A3ABB4", textAlign: "center" }}>{w}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {grid.map((dt, i) => {
            if (!dt) return <div key={i} />;
            const iso = toISODate(dt);
            const total = dayTotal(iso);
            const flagged = hasNonControllable(iso);
            const isSelected = iso === selectedDate;
            return (
              <button key={i} onClick={() => total > 0 && onSelectDate(iso === selectedDate ? null : iso)} style={{
                minHeight: 40, borderRadius: 8, border: isSelected ? "1.5px solid #2B4562" : "1px solid #EEF0F2",
                background: total > 0 ? (flagged ? "#FDF1E0" : "#F1F4F7") : "#fff", cursor: total > 0 ? "pointer" : "default",
                padding: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontFamily: "inherit",
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#1B2430" }}>{dt.getDate()}</span>
                {total > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: flagged ? "#8A5A0B" : "#2B4562" }}>£{total >= 1000 ? Math.round(total / 1000) + "k" : Math.round(total)}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDate && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>{fmtDate(selectedDate)}</div>
          {selectedItems.map((item, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: item.controllable ? "#5B6672" : "#8A5A0B", fontWeight: 600 }}>{item.controllable ? "Budgeted" : "Non-controllable"}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{gbp(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleButton({ active, children, ...rest }) {
  return (
    <button {...rest} style={{
      flex: 1, background: active ? "#2B4562" : "#fff", color: active ? "#fff" : "#5B6672",
      border: "1px solid " + (active ? "#2B4562" : "#E1E4E8"), borderRadius: 9, padding: "8px 10px",
      fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

function MetricBlock({ label, value, tone }) {
  const color = tone === "danger" ? "#C53030" : tone === "ok" ? "#2F855A" : "#1B2430";
  return (
    <div style={{ background: "#F7F8F9", borderRadius: 9, padding: "9px 10px" }}>
      <div style={{ fontSize: 10.5, color: "#8A94A0", fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
    </div>
  );
}

function SetCategoryBudgetModal({ year, category, current, onClose, onSave }) {
  const [amount, setAmount] = useState(current || "");
  const meta = CATEGORY_META[category];
  return (
    <Modal title={`${meta.label} max — ${year}`} onClose={onClose} width={360}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label={`Maximum annual spend (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <PrimaryButton onClick={() => onSave(amount ? Number(amount) : 0)}><CheckCircle2 size={15} /> Save maximum</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Add Device Modal
--------------------------------------------------------- */
function AddDeviceModal({ onPause, onResume, onArchive, countries, locations, defaultLocationId, existing, prefill, subcategoriesByCategory, suppliers, onClose, onSave, onDelete, onDuplicate }) {
  const isEdit = !!existing;
  const src = existing || prefill || null; // prefill = duplicating another service
  const [name, setName] = useState(src?.name || "");
  const [assetTag, setAssetTag] = useState(src?.assetTag || "");
  const [category, setCategory] = useState(src?.category || "");
  const [serviceCategory, setServiceCategory] = useState(src?.serviceCategory || "maintenance");
  const [subCategory, setSubCategory] = useState(src?.subCategory || "");
  const [locationId, setLocationId] = useState(src?.locationId || defaultLocationId || locations[0]?.id || "");
  const [supplierId, setSupplierId] = useState(src?.supplierId || "");
  const [checklist, setChecklist] = useState(src?.checklist || []);
  const [custom, setCustom] = useState(src?.custom || {});
  const [templateId, setTemplateId] = useState("");
  const [fieldErr, setFieldErr] = useState("");
  function applyTemplate(id) {
    setTemplateId(id);
    const t = ACTIVE_TEMPLATES.find((x) => x.id === id); if (!t) return;
    if (!name.trim() || ACTIVE_TEMPLATES.some((x) => x.name === name)) setName(t.name);
    if (t.serviceCategory && CATEGORY_META[t.serviceCategory]) setServiceCategory(t.serviceCategory);
    setSubCategory(t.subCategory || ""); setCategory(t.equipmentType || "");
    setChecklist(t.checklist || []);
    if (t.repeat?.mode === "interval") { setRepeat("interval"); setInterval(String(t.repeat.months)); }
    else if (t.repeat?.mode === "custom") { setRepeat("custom"); setCustomCount(String(t.repeat.count)); }
    else if (t.repeat?.mode) setRepeat(t.repeat.mode);
  }
  const [newCheckItem, setNewCheckItem] = useState("");
  function addCheckItem() { if (!newCheckItem.trim()) return; setChecklist((p) => [...p, newCheckItem.trim()]); setNewCheckItem(""); }
  const [interval, setInterval] = useState(src?.serviceIntervalMonths != null ? String(src.serviceIntervalMonths) : "12");
  const [nextDate, setNextDate] = useState(src?.nextServiceDate || new Date().toISOString().slice(0, 10));
  const [budgetPerVisit, setBudgetPerVisit] = useState(src?.budgetPerVisit ? String(src.budgetPerVisit) : "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [manufacturer, setManufacturer] = useState(src?.manufacturer || "");
  const [model, setModel] = useState(src?.model || "");
  const [serialNumber, setSerialNumber] = useState(src?.serialNumber || "");
  const [installDate, setInstallDate] = useState(src?.installDate || "");
  const [warrantyEnd, setWarrantyEnd] = useState(src?.warrantyEnd || "");
  const [area, setArea] = useState(src?.area || "");
  const [photo, setPhoto] = useState(src?.photo || null);
  const [links, setLinks] = useState(src?.links || []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const areaListId = useMemo(() => `areas-${uid()}`, []);
  async function pickPhoto(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setPhotoBusy(true); try { setPhoto(await compressImage(f, 480, 0.6)); } catch (x) { /* ignore */ } setPhotoBusy(false); }
  const [replacementCost, setReplacementCost] = useState(src?.replacementCost ? String(src.replacementCost) : "");
  const [expectedLifeYears, setExpectedLifeYears] = useState(src?.expectedLifeYears ? String(src.expectedLifeYears) : "");
  const [accessNotes, setAccessNotes] = useState(src?.accessNotes || "");
  const [permits, setPermits] = useState(src?.permits || []);
  const [ramsRequired, setRamsRequired] = useState(!!src?.ramsRequired);
  const [certRequired, setCertRequired] = useState(!!src?.certRequired);
  const [assignee, setAssignee] = useState(src?.assignee || "");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseUntil, setPauseUntil] = useState(addMonths(new Date().toISOString().slice(0, 10), 1));
  const [pauseDrop, setPauseDrop] = useState(true);
  const [showSafety, setShowSafety] = useState(!!(src?.accessNotes || src?.permits?.length || src?.ramsRequired || src?.certRequired));
  const [showAsset, setShowAsset] = useState(!!(src?.manufacturer || src?.model || src?.serialNumber || src?.installDate || src?.warrantyEnd || src?.photo || src?.links?.length));
  const locationSuppliers = suppliers.filter((s) => s.locationId === locationId);

  // Repeat schedule — same options as Budget Plan contract lines, so setting up
  // a service's visits and its budget lines stay in sync. Only used when adding new.
  const [repeat, setRepeat] = useState(prefill?.repeatMode || (prefill?.serviceIntervalMonths ? "interval" : "once")); // 'once' | 'interval' | 'manual' | 'weekly' | 'monthly' | 'quarterly' | 'custom'
  const [customCount, setCustomCount] = useState("7");
  const [manualDates, setManualDates] = useState([new Date().toISOString().slice(0, 10)]);

  function updateManualDate(i, value) { setManualDates((prev) => prev.map((d, idx) => idx === i ? value : d)); }
  function addManualDate() { setManualDates((prev) => [...prev, prev[prev.length - 1] || nextDate]); }
  function removeManualDate(i) { setManualDates((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev); }

  function submit() {
    if (!name.trim() || !locationId) return;
    const missing = missingRequiredFields("service", serviceCategory, custom);
    if (missing.length) { setFieldErr(`Please fill in: ${missing.join(", ")}`); return; }
    const base = {
      id: existing?.id, name: name.trim(), assetTag: assetTag.trim(), category: category.trim(), serviceCategory,
      subCategory: subCategory.trim(), locationId, supplierId: supplierId || null, checklist, custom,
      lastServiceDate: existing?.lastServiceDate ?? null,
      budgetPerVisit: budgetPerVisit ? Number(budgetPerVisit) : 0,
      manufacturer: manufacturer.trim(), model: model.trim(), serialNumber: serialNumber.trim(),
      installDate: installDate || null, warrantyEnd: warrantyEnd || null,
      expectedLifeYears: expectedLifeYears ? Number(expectedLifeYears) : null, replacementCost: replacementCost ? Number(replacementCost) : null,
      accessNotes: accessNotes.trim(), permits, ramsRequired, certRequired, assignee: assignee || null,
      area: area.trim(), photo: photo || null, links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim() || "Link", url: /^https?:\/\//i.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}` })),
    };
    if (isEdit) {
      onSave({ ...base, serviceIntervalMonths: interval ? Number(interval) : null, nextServiceDate: nextDate || null });
      return;
    }
    // New service — build the visit schedule based on the chosen repeat pattern.
    // "once" (the default) deliberately makes NO recurring schedule — nextServiceDate
    // clears after that single visit is logged, instead of silently recurring.
    let scheduleDates = [nextDate];
    let intervalMonths = null;
    if (repeat === "interval") {
      intervalMonths = interval ? Number(interval) : null;
      // Still generate a year's worth of linked Budget Plan lines, same as every
      // other recurring mode — this used to be skipped here, which is why a
      // "Recurring every N months" service never showed up in Budget.
      if (intervalMonths) scheduleDates = Array.from({ length: Math.max(1, Math.ceil(12 / intervalMonths)) }, (_, i) => addMonths(nextDate, i * intervalMonths));
    }
    else if (repeat === "manual") { scheduleDates = manualDates.filter(Boolean); intervalMonths = null; }
    else if (repeat === "weekly") { scheduleDates = Array.from({ length: 52 }, (_, i) => addDays(nextDate, i * 7)); intervalMonths = null; }
    else if (repeat === "monthly") { scheduleDates = Array.from({ length: 12 }, (_, i) => addMonths(nextDate, i)); intervalMonths = 1; }
    else if (repeat === "quarterly") { scheduleDates = Array.from({ length: 4 }, (_, i) => addMonths(nextDate, i * 3)); intervalMonths = 3; }
    else if (repeat === "custom") {
      const count = Math.max(1, Number(customCount) || 1);
      const stepDays = Math.round(365 / count);
      scheduleDates = Array.from({ length: count }, (_, i) => addDays(nextDate, i * stepDays));
      intervalMonths = null;
    }
    scheduleDates = scheduleDates.filter(Boolean).sort();
    onSave({
      ...base, serviceIntervalMonths: intervalMonths, nextServiceDate: scheduleDates[0] || nextDate,
      scheduleDates,
    });
  }
  return (
    <Modal title={isEdit ? "Edit service" : prefill ? "Add a copy of a service" : "Add a service"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!isEdit && ACTIVE_TEMPLATES.length > 0 && (
          <Field label="Start from a template (optional)">
            <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— Blank service —</option>
              {ACTIVE_TEMPLATES.some((t) => t.custom) && <optgroup label="Your templates">{ACTIVE_TEMPLATES.filter((t) => t.custom).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
              <optgroup label="Standard templates">{ACTIVE_TEMPLATES.filter((t) => !t.custom).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
            </Select>
            {templateId && ACTIVE_TEMPLATES.find((t) => t.id === templateId)?.note && <span style={{ fontSize: 11, color: "#5B6672", background: "#F1F4F7", borderRadius: 7, padding: "6px 8px", marginTop: 4 }}>{ACTIVE_TEMPLATES.find((t) => t.id === templateId).note}</span>}
          </Field>
        )}
        <Field label="Service name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rooftop AHU 3, or Cleaning" /></Field>
        <Field label="Location">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {countries.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {locations.filter((l) => l.countryId === c.id).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Area / room (optional)">
          <TextInput list={areaListId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Ground floor plant room, Kitchen, Roof" />
          <datalist id={areaListId}>{(AREA_SUGGESTIONS_CACHE[locationId] || []).map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Asset tag"><TextInput value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="AHU-003" /></Field>
          <Field label="Equipment type"><TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="HVAC" /></Field>
        </div>
        <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => setShowAsset((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#5B6672" }}>
            <span>Asset details — photo, make, model, serial, warranty, documents (optional)</span>
            <ChevronDown size={14} style={{ transform: showAsset ? "rotate(180deg)" : "none" }} />
          </button>
          {showAsset && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Manufacturer"><TextInput value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. Daikin" /></Field>
                <Field label="Model"><TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. FXZQ50A" /></Field>
              </div>
              <Field label="Serial number"><TextInput value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. J0123456" /></Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Installed"><TextInput type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></Field>
                <Field label="Warranty ends"><TextInput type="date" value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} /></Field>
              </div>
              <Field label="Photo of the equipment">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {photo && <img src={photo} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid #E1E4E8" }} />}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer" }}>
                    <ImagePlus size={14} /> {photoBusy ? "Processing…" : photo ? "Change" : "Add photo"}
                    <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display: "none" }} />
                  </label>
                  {photo && <button type="button" onClick={() => setPhoto(null)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                </div>
                <span style={{ fontSize: 10.5, color: "#A3ABB4" }}>Helps technicians find the right unit. Saved small to keep storage down.</span>
              </Field>
              <Field label="Documents & links (O&M manual, drawings, SharePoint…)">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {links.map((l, i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <TextInput value={l.label} onChange={(e) => setLinks((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ width: "35%" }} />
                      <TextInput value={l.url} onChange={(e) => setLinks((p) => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" style={{ flex: 1, minWidth: 0 }} />
                      <button type="button" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={14} color="#A3ABB4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setLinks((p) => [...p, { label: "", url: "" }])} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>+ Add a link</button>
                </div>
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Expected life (years)"><TextInput type="number" min="0" value={expectedLifeYears} onChange={(e) => setExpectedLifeYears(e.target.value)} placeholder="e.g. 15" /></Field>
                <Field label={`Replacement cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" value={replacementCost} onChange={(e) => setReplacementCost(e.target.value)} placeholder="estimate" /></Field>
              </div>
              {installDate && Number(expectedLifeYears) > 0 && <span style={{ fontSize: 11, color: "#5B21B6", fontWeight: 600 }}>Replacement due in {Number(installDate.slice(0, 4)) + Number(expectedLifeYears)}</span>}
              <span style={{ fontSize: 10.5, color: "#A3ABB4" }}>You'll get a notification 60 days before the warranty ends, and the year before replacement is due.</span>
            </>
          )}
        </div>
        <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => setShowSafety((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#5B6672" }}>
            <span>Access &amp; safety — RAMS, permits, access notes (optional)</span>
            <ChevronDown size={14} style={{ transform: showSafety ? "rotate(180deg)" : "none" }} />
          </button>
          {showSafety && (
            <>
              <Field label="Access notes"><TextArea value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="e.g. Plant room key at reception. Access via loading bay. Out of hours only." /></Field>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4451", cursor: "pointer" }}>
                <input type="checkbox" checked={ramsRequired} onChange={(e) => setRamsRequired(e.target.checked)} style={{ margin: 0 }} /> RAMS required before work starts
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4451", cursor: "pointer" }}>
                <input type="checkbox" checked={certRequired} onChange={(e) => setCertRequired(e.target.checked)} style={{ margin: 0 }} /> Certificate required for every visit (alerts if one is missing)
              </label>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#3A4451" }}>Permits needed</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PERMIT_TYPES.map((p) => (
                  <ToggleButton key={p} active={permits.includes(p)} onClick={() => setPermits((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}>{p}</ToggleButton>
                ))}
              </div>
              <span style={{ fontSize: 10.5, color: "#A3ABB4" }}>Shown on the service card and job sheet, and checked when a visit is logged.</span>
            </>
          )}
        </div>
        <Field label="Service category">
          <Select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
            <CategoryOptions />
          </Select>
        </Field>
        <SubCategoryField value={subCategory} onChange={setSubCategory} suggestions={subcategoriesByCategory?.[serviceCategory] || []} />
        {ACTIVE_USERS.length > 0 && (
          <Field label="Responsible person (optional)">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— Nobody in particular —</option>
              {ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Default supplier (optional)">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {locationSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({CATEGORY_META[s.category]?.label})</option>)}
          </Select>
          {locationSuppliers.length === 0 && (
            <span style={{ fontSize: 10.5, color: "#A3ABB4" }}>No suppliers added at this location yet — add one from the Suppliers tab first.</span>
          )}
        </Field>
        <Field label={`Budget per visit (${ACTIVE_CURRENCY_CODE}, optional)`}><TextInput type="number" min="0" step="0.01" value={budgetPerVisit} onChange={(e) => setBudgetPerVisit(e.target.value)} placeholder="0.00" /></Field>
        <Field label={`Visit checklist (${checklist.length} item${checklist.length === 1 ? "" : "s"}, optional)`}>
          {checklist.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
              {checklist.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F7F8F9", borderRadius: 7, padding: "6px 8px" }}>
                  <CheckCircle2 size={13} color="#8A94A0" />
                  <span style={{ flex: 1, fontSize: 12.5 }}>{item}</span>
                  <button type="button" onClick={() => setChecklist((p) => p.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={13} color="#A3ABB4" /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheckItem(); } }} placeholder="e.g. Filters cleaned" style={{ flex: 1 }} />
            <button type="button" onClick={addCheckItem} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
          {checklist.length === 0 && (
            <button type="button" onClick={() => setChecklist(CHECKLIST_PRESETS[serviceCategory] || [])} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: "4px 0", textAlign: "left" }}>
              + Start from a standard {(CATEGORY_META[serviceCategory] || CATEGORY_META.maintenance).label.toLowerCase()} checklist
            </button>
          )}
          <span style={{ fontSize: 10.5, color: "#A3ABB4" }}>Ticked off Pass / Fail / N/A each time a visit is logged. Failed items create follow-up jobs in Works.</span>
        </Field>
        <CustomFieldInputs appliesTo="service" category={serviceCategory} values={custom} onChange={setCustom} />
        {fieldErr && <div style={{ fontSize: 12, color: "#C53030" }}>{fieldErr}</div>}

        {isEdit ? (
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Service interval (months)"><TextInput type="number" min="0" value={interval} onChange={(e) => setInterval(e.target.value)} /></Field>
            <Field label="Next visit due"><TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
          </div>
        ) : (
          <>
            <Field label="First visit date"><TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
            <Field label="Repeat">
              <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                <option value="once">One-off — no repeat</option>
                <option value="interval">Recurring — every N months</option>
                <option value="manual">Pick each visit date myself</option>
                <option value="weekly">Weekly (52 visits)</option>
                <option value="monthly">Monthly (12 visits)</option>
                <option value="quarterly">Quarterly (4 visits)</option>
                <option value="custom">Custom — set how many times a year</option>
              </Select>
            </Field>
            {repeat === "interval" && (
              <Field label="Repeats every (months)"><TextInput type="number" min="0" value={interval} onChange={(e) => setInterval(e.target.value)} /></Field>
            )}
            {repeat === "custom" && (
              <Field label="How many times a year">
                <TextInput type="number" min="1" max="365" value={customCount} onChange={(e) => setCustomCount(e.target.value)} placeholder="e.g. 7" />
                <span style={{ fontSize: 11, color: "#8A94A0" }}>Creates {Math.max(1, Number(customCount) || 1)} visits, spaced about {Math.round(365 / Math.max(1, Number(customCount) || 1))} days apart.</span>
              </Field>
            )}
            {repeat === "manual" && (
              <Field label="Visit dates">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {manualDates.map((d, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <TextInput type="date" value={d} onChange={(e) => updateManualDate(i, e.target.value)} style={{ flex: 1 }} />
                      {manualDates.length > 1 && (
                        <button onClick={() => removeManualDate(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Trash2 size={14} color="#C0C6CC" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addManualDate} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 11px", borderRadius: 8,
                    border: "1px dashed #D7DCE1", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "#2B4562", fontWeight: 650,
                  }}><Plus size={13} /> Add another visit date</button>
                </div>
              </Field>
            )}
            {(repeat === "once" || repeat === "weekly" || repeat === "monthly" || repeat === "quarterly" || repeat === "custom" || repeat === "manual") && (
              <div style={{ fontSize: 11, color: "#8A94A0", background: "#F1F4F7", borderRadius: 8, padding: "8px 10px" }}>
                This also adds a matching visit budget and Budget → Plan line for each date, using the budget per visit above — so this service and the Budget tab stay in sync.
              </div>
            )}
          </>
        )}
        <PrimaryButton onClick={submit} style={{ marginTop: 6 }}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Save service"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onDelete(existing.id)} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this service
            </button>
          )
        )}
        {isEdit && onDuplicate && ACTIVE_CAN_EDIT && (
          <button type="button" onClick={() => onDuplicate(existing)} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, color: "#2B4562", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px" }}>
            <Copy size={13} /> Duplicate this service (e.g. another unit of the same kind)
          </button>
        )}
        {isEdit && onPause && ACTIVE_CAN_EDIT && !existing.archived && (
          existing.pausedUntil && existing.pausedUntil >= new Date().toISOString().slice(0, 10) ? (
            <button type="button" onClick={() => onResume(existing.id)} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, color: "#2B4562", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px" }}>
              <PauseCircle size={13} /> Paused until {fmtDate(existing.pausedUntil)} — resume now
            </button>
          ) : pauseOpen ? (
            <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <Field label="Pause until (next due becomes this date)"><TextInput type="date" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} /></Field>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#3A4451", cursor: "pointer" }}>
                <input type="checkbox" checked={pauseDrop} onChange={(e) => setPauseDrop(e.target.checked)} style={{ margin: 0 }} /> Remove planned visits and budget lines during the pause
              </label>
              <PrimaryButton onClick={() => pauseUntil && onPause(existing.id, pauseUntil, pauseDrop)}><PauseCircle size={15} /> Pause service</PrimaryButton>
            </div>
          ) : (
            <button type="button" onClick={() => setPauseOpen(true)} style={{ background: "none", border: "none", color: "#5B6672", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <PauseCircle size={13} /> Pause — e.g. area closed or refurbishment (no alerts until it restarts)
            </button>
          )
        )}
        {isEdit && onArchive && ACTIVE_CAN_EDIT && !existing.archived && (
          <button type="button" onClick={() => onArchive(existing.id)} style={{ background: "none", border: "none", color: "#5B6672", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
            <Archive size={13} /> Archive — decommissioned / no longer maintained (keeps history)
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Log Service Modal
--------------------------------------------------------- */
function LogServiceModal({ openPermits = [], device, existing, suppliers, visitBudgets, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const defaultName = device ? `${(CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).label} visit` : "Visit";
  const [name, setName] = useState(existing?.name || defaultName);
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [technician, setTechnician] = useState(existing?.technician || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || device?.supplierId || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [visitPo, setVisitPo] = useState(existing?.poNumber || "");
  const [visitCustom, setVisitCustom] = useState(existing?.custom || {});
  const [visitFieldErr, setVisitFieldErr] = useState("");
  const [signatures, setSignatures] = useState(existing?.signatures || {});
  const [gps, setGps] = useState(existing?.gps || null);
  const [showSignoff, setShowSignoff] = useState(!!(existing?.signatures?.technician || existing?.signatures?.site || existing?.gps));
  const [ramsReceived, setRamsReceived] = useState(!!existing?.ramsReceived);
  const [permitRef, setPermitRef] = useState(existing?.permitRef || "");
  const [rating, setRating] = useState(existing?.rating || 0);
  const [lateReason, setLateReason] = useState(existing?.lateReason || "");
  const [aborted, setAborted] = useState(!!existing?.aborted);
  const [abortReason, setAbortReason] = useState(existing?.abortReason || "");
  const needsRams = !!device?.ramsRequired;
  const needsPermit = (device?.permits || []).length > 0;
  const templateItems = device?.checklist || [];
  const [checkResults, setCheckResults] = useState(() => {
    const prev = existing?.checklistResults || [];
    return templateItems.map((item) => {
      const found = prev.find((r) => r.item === item);
      return { item, result: found?.result || "", note: found?.note || "" };
    });
  });
  function setCheck(i, patch) { setCheckResults((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  const [cost, setCost] = useState(existing?.cost ? String(existing.cost) : "");
  const [photo, setPhoto] = useState(existing?.certificatePhoto || null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nearestVisitBudget = useMemo(() => {
    if (!visitBudgets || visitBudgets.length === 0 || !date) return null;
    const target = new Date(date + "T00:00:00").getTime();
    let best = null, bestDiff = Infinity;
    visitBudgets.forEach((v) => {
      if (!v.date) return;
      const diff = Math.abs(new Date(v.date + "T00:00:00").getTime() - target);
      if (diff < bestDiff) { bestDiff = diff; best = v; }
    });
    return best;
  }, [visitBudgets, date]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { setPhoto(await compressImage(file)); } catch (err) { /* allow retry */ }
    setBusy(false);
  }
  function submit() {
    { const miss = missingRequiredFields("visit", device?.serviceCategory, visitCustom); if (miss.length) { setVisitFieldErr(`Please fill in: ${miss.join(", ")}`); return; } }
    if (!device) return;
    onSave({
      id: existing?.id, deviceId: device.id, name: name.trim() || defaultName, date,
      technician: technician.trim(), supplierId: supplierId || null,
      notes: notes.trim(), cost: cost ? Number(cost) : 0, certificatePhoto: photo,
      checklistResults: checkResults.length ? checkResults : undefined,
      poNumber: visitPo.trim(),
      custom: Object.keys(visitCustom).length ? visitCustom : undefined,
      signatures: signatures.technician || signatures.site ? signatures : undefined,
      gps: gps || undefined,
      ramsReceived: ramsReceived || undefined, permitRef: permitRef.trim() || undefined, rating: rating || undefined,
      lateReason: isLate || existing?.lateReason ? lateReason || undefined : undefined,
      aborted: aborted || undefined, abortReason: aborted ? abortReason || "Not completed" : undefined, dueDateAtLog: (isEdit ? existing?.dueDateAtLog : device.nextServiceDate) || undefined,
    });
  }
  // A visit more than 7 days after the date it was due counts as late — ask why.
  const dueRef = existing?.dueDateAtLog || (!isEdit ? device?.nextServiceDate : null);
  const isLate = !!(dueRef && date && date > addDays(dueRef, 7));
  function emailSummary() {
    const sup = suppliers.find((x) => x.id === supplierId);
    const fails = checkResults.filter((r) => r.result === "fail");
    const lines = [
      `Service: ${device?.name}${device?.assetTag ? ` (#${device.assetTag})` : ""}`, `Visit: ${name}`, `Date: ${fmtDate(date)}`,
      technician && `Technician: ${technician}`, sup && `Supplier: ${sup.name}`,
      checkResults.some((r) => r.result) && `Checklist: ${checkResults.filter((r) => r.result === "pass").length} pass, ${fails.length} fail${fails.length ? ` — ${fails.map((r) => r.item + (r.note ? ` (${r.note})` : "")).join("; ")}` : ""}`,
      cost && `Cost: ${gbp(Number(cost))}`, visitPo && `PO: ${visitPo}`,
      (ramsReceived || permitRef) && `Safety: ${[ramsReceived && "RAMS received", permitRef && `permit ${permitRef}`].filter(Boolean).join(", ")}`,
      lateReason && `Late — reason: ${lateReason}`, notes && `Notes: ${notes}`,
    ].filter(Boolean);
    const to = sup?.managerEmail || "";
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Visit report — ${device?.name} — ${fmtDate(date)}`)}&body=${encodeURIComponent(`Hi,\n\nSummary of the visit:\n\n${lines.join("\n")}\n\nKind regards`)}`;
  }
  return (
    <Modal title={isEdit ? `Edit visit — ${device ? device.name : ""}` : `Log visit — ${device ? device.name : ""}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Visit name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quarterly PPM inspection" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Service date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Technician"><TextInput value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Name" /></Field>
        </div>
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({CATEGORY_META[s.category]?.label})</option>)}
          </Select>
        </Field>
        <Field label={`Cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" /></Field>
        {nearestVisitBudget ? (
          <div style={{ fontSize: 11.5, color: "#8A5A0B", background: "#FDF1E0", border: "1px solid #E6D9BC", borderRadius: 8, padding: "7px 10px" }}>
            Nearest visit budget: {gbp(nearestVisitBudget.amount)} (set for {fmtDate(nearestVisitBudget.date)}{nearestVisitBudget.note ? ` — ${nearestVisitBudget.note}` : ""})
          </div>
        ) : device?.budgetPerVisit ? (
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Flat per-visit budget for this service: {gbp(device.budgetPerVisit)}</div>
        ) : null}
        {checkResults.length > 0 && (
          <Field label={`Checklist (${checkResults.filter((r) => r.result).length}/${checkResults.length} answered)`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {checkResults.map((r, i) => (
                <div key={i} style={{ background: r.result === "fail" ? "#FBEAEA" : "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "#1B2430", fontWeight: 600, flex: 1 }}>{r.item}</span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {[["pass", "Pass", "#2F855A"], ["fail", "Fail", "#C53030"], ["na", "N/A", "#8A94A0"]].map(([key, label, color]) => (
                        <button key={key} type="button" onClick={() => setCheck(i, { result: r.result === key ? "" : key })} style={{
                          border: `1.5px solid ${color}`, background: r.result === key ? color : "#fff", color: r.result === key ? "#fff" : color,
                          borderRadius: 7, padding: "4px 8px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {r.result === "fail" && (
                    <TextInput value={r.note} onChange={(e) => setCheck(i, { note: e.target.value })} placeholder="What's wrong? (creates a follow-up job)" style={{ width: "100%", marginTop: 6, fontSize: 12.5 }} />
                  )}
                </div>
              ))}
            </div>
            {checkResults.some((r) => r.result === "fail") && (
              <span style={{ fontSize: 11, color: "#9B2C2C" }}>Each failed item will create a high-priority follow-up in Works.</span>
            )}
          </Field>
        )}
        {(() => {
          const budget = Number(nearestVisitBudget?.amount || device?.budgetPerVisit) || 0;
          const c = Number(cost) || 0;
          if (!budget || c <= budget * 1.1) return null;
          return <div style={{ fontSize: 12, color: "#8A5A0B", background: "#FDF1E0", borderRadius: 8, padding: "8px 10px", fontWeight: 600 }}>
            {gbp(c - budget)} over the {gbp(budget)} visit budget (+{Math.round(((c - budget) / budget) * 100)}%). Please say why in the notes — it will show in the Budget tab variance.
          </div>;
        })()}
        <div style={{ background: aborted ? "#FBEAEA" : "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 650, color: aborted ? "#9B2C2C" : "#3A4451", cursor: "pointer" }}>
            <input type="checkbox" checked={aborted} onChange={(e) => setAborted(e.target.checked)} style={{ margin: 0 }} /> <Ban size={13} /> Visit NOT completed (supplier attended but couldn't do the work)
          </label>
          {aborted && (
            <>
              <Select value={abortReason} onChange={(e) => setAbortReason(e.target.value)}>
                <option value="">— Why? —</option>
                {["No access to area", "Area in use / meeting", "Equipment isolated or faulty", "Wrong parts / tools", "Missing RAMS or permit", "Technician left early", "Other"].map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
              <span style={{ fontSize: 11, color: "#9B2C2C" }}>The service stays due — it won't move to the next date. This counts against the supplier if the reason is theirs.</span>
            </>
          )}
        </div>
        {(isLate || lateReason) && !aborted && (
          <Field label={isLate ? `Late visit — due ${fmtDate(dueRef)}. Why?` : "Late visit reason"}>
            <Select value={lateReason} onChange={(e) => setLateReason(e.target.value)}>
              <option value="">— Choose a reason —</option>
              {LATE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        )}
        {(needsRams || needsPermit) && (
          <div style={{ background: "#FDF1E0", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8A5A0B", display: "flex", alignItems: "center", gap: 5 }}><HardHat size={13} /> Safety paperwork for this job</div>
            {device?.accessNotes && <div style={{ fontSize: 11.5, color: "#5B6672" }}><KeyRound size={11} style={{ verticalAlign: -1 }} /> {device.accessNotes}</div>}
            {needsRams && (
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4451", cursor: "pointer" }}>
                <input type="checkbox" checked={ramsReceived} onChange={(e) => setRamsReceived(e.target.checked)} style={{ margin: 0 }} /> RAMS received and reviewed
              </label>
            )}
            {needsPermit && (
              <Field label={`Permit reference (${device.permits.join(", ")})`}>
                <TextInput list="open-permits" value={permitRef} onChange={(e) => setPermitRef(e.target.value)} placeholder="e.g. PTW-0142" />
                <datalist id="open-permits">{openPermits.map((pm) => <option key={pm.id} value={pm.ref}>{pm.type} — {pm.contractor}</option>)}</datalist>
                {openPermits.length > 0 && !permitRef && <span style={{ fontSize: 11, color: "#2B4562" }}>Open permits: {openPermits.map((pm) => pm.ref).join(", ")}</span>}
              </Field>
            )}
            {((needsRams && !ramsReceived) || (needsPermit && !permitRef.trim())) && (
              <span style={{ fontSize: 11, color: "#9B2C2C", fontWeight: 600 }}>Missing: {[needsRams && !ramsReceived && "RAMS", needsPermit && !permitRef.trim() && "permit reference"].filter(Boolean).join(" and ")} — you can still save, but it will show as missing on the record.</span>
            )}
          </div>
        )}
        <Field label="Rate the supplier's work (optional)">
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(rating === n ? 0 : n)} title={`${n} star${n === 1 ? "" : "s"}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                <Star size={24} color={n <= rating ? "#D97706" : "#C0C6CC"} fill={n <= rating ? "#D97706" : "none"} />
              </button>
            ))}
            <span style={{ fontSize: 11.5, color: "#8A94A0", marginLeft: 6 }}>{["", "Poor", "Below par", "OK", "Good", "Excellent"][rating]}</span>
          </div>
        </Field>
        {isEdit && (
          <button type="button" onClick={emailSummary} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Mail size={14} /> Email visit summary{suppliers.find((x) => x.id === supplierId)?.managerEmail ? " to supplier" : ""}
          </button>
        )}
        {showSignoff ? (
          <SignOffSection signatures={signatures} onChange={setSignatures} gps={gps} onGps={setGps} defaultTechName={technician} />
        ) : (
          <button type="button" onClick={() => setShowSignoff(true)} style={{ background: "#F1F4F7", border: "1px dashed #C7D0DA", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>
            + Add sign-off signatures &amp; location stamp
          </button>
        )}
        <CustomFieldInputs appliesTo="visit" category={device?.serviceCategory} values={visitCustom} onChange={setVisitCustom} />
        {visitFieldErr && <div style={{ fontSize: 12, color: "#C53030" }}>{visitFieldErr}</div>}
        <Field label="PO / work order number (optional)"><TextInput value={visitPo} onChange={(e) => setVisitPo(e.target.value)} placeholder="e.g. PO-40213" /></Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work performed, parts replaced, readings…" /></Field>
        <Field label="Certificate photo">
          <label style={{ border: "1px dashed #D7DCE1", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#5B6672", fontSize: 13, background: photo ? "transparent" : "#FAFBFC" }}>
            {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
            {photo ? "Replace photo" : "Upload certificate or job photo"}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          {photo && <img src={photo} alt="preview" style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid #E1E4E8" }} />}
        </Field>
        {device?.serviceIntervalMonths ? (
          <div style={{ fontSize: 12, color: "#8A94A0" }}>Next visit will auto-set to {fmtDate(addMonths(date, device.serviceIntervalMonths))} ({device.serviceIntervalMonths}mo interval) based on the latest logged date.</div>
        ) : null}
        {ACTIVE_CAN_EDIT ? (
          <>
            <PrimaryButton onClick={submit} style={{ marginTop: 4 }}><CheckCircle2 size={15} /> {isEdit ? "Save changes" : "Save visit"}</PrimaryButton>
            {isEdit && (
              confirmingDelete ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onDelete(existing.id, device.id)} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
                  <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
                  <Trash2 size={13} /> Delete this visit
                </button>
              )
            )}
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: "#A3ABB4", textAlign: "center" }}>Viewing only — this profile can't save changes.</div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Add Extra Work Modal
--------------------------------------------------------- */
function AddWorkModal({ devices, suppliers = [], defaultDeviceId, onClose, onSave }) {
  const [deviceId, setDeviceId] = useState(defaultDeviceId || devices[0]?.id);
  const [priority, setPriority] = useState("medium");
  const [poNumber, setPoNumber] = useState("");
  const [workCustom, setWorkCustom] = useState({});
  const [workFieldErr, setWorkFieldErr] = useState("");
  const [supplierId, setSupplierId] = useState(() => devices.find((d) => d.id === (defaultDeviceId || devices[0]?.id))?.supplierId || "");
  const [description, setDescription] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [dateRaised, setDateRaised] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("quoted");
  const [budgetType, setBudgetType] = useState("budgeted");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setPhotos((prev) => [...prev, ...compressed]);
    } catch (err) { /* allow retry */ }
    setBusy(false);
  }
  function removePhoto(i) { setPhotos((prev) => prev.filter((_, idx) => idx !== i)); }
  function submit() {
    { const miss = missingRequiredFields("work", devices.find((d) => d.id === deviceId)?.serviceCategory, workCustom); if (miss.length) { setWorkFieldErr(`Please fill in: ${miss.join(", ")}`); return; } }
    if (!deviceId || !description.trim()) return;
    onSave({ deviceId, description: description.trim(), quoteAmount: quoteAmount ? Number(quoteAmount) : 0, dateRaised, status, budgetType, photos, priority, supplierId: supplierId || null, comments: [], poNumber: poNumber.trim(), custom: Object.keys(workCustom).length ? workCustom : undefined });
  }
  return (
    <Modal title="Add extra work" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Service">
          <Select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); const d = devices.find((x) => x.id === e.target.value); if (d?.supplierId) setSupplierId(d.supplierId); }}>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {WORK_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Assigned supplier">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Unassigned —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="PO / work order number (optional)"><TextInput value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-40213" /></Field>
        <CustomFieldInputs appliesTo="work" category={devices.find((d) => d.id === deviceId)?.serviceCategory} values={workCustom} onChange={setWorkCustom} />
        {workFieldErr && <div style={{ fontSize: 12, color: "#C53030" }}>{workFieldErr}</div>}
        <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What extra work is being quoted or done?" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Quote amount (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Date raised"><TextInput type="date" value={dateRaised} onChange={(e) => setDateRaised(e.target.value)} /></Field>
        </div>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {WORK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Budget type">
          <Select value={budgetType} onChange={(e) => setBudgetType(e.target.value)}>
            {WORK_BUDGET_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
          <span style={{ fontSize: 11, color: "#8A94A0" }}>{WORK_BUDGET_TYPES.find((t) => t.key === budgetType)?.hint}</span>
        </Field>
        <Field label="Photos">
          <label style={{ border: "1px dashed #D7DCE1", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#5B6672", fontSize: 13, background: "#FAFBFC" }}>
            {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
            Add photos
            <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
          </label>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={p} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid #E1E4E8" }} />
                  <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, background: "#1B2430", borderRadius: "50%", width: 18, height: 18, border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </Field>
        <PrimaryButton onClick={submit} style={{ marginTop: 4 }}><Plus size={15} /> Save extra work</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   QR codes & public request portal
--------------------------------------------------------- */
function appBaseUrl() {
  if (typeof window === "undefined") return "";
  return window.location.origin + window.location.pathname;
}
function qrImageUrl(data, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function printStickers(device, locationLabel, stickers) {
  const w = window.open("", "_blank");
  if (!w) return false;
  const cards = stickers.map((s) => `
    <div class="card">
      <div class="head">${escapeHtml(s.title)}</div>
      <img src="${qrImageUrl(s.url, 360)}" />
      <div class="name">${escapeHtml(device.name)}</div>
      <div class="sub">${escapeHtml(locationLabel || "")}</div>
      <div class="hint">${escapeHtml(s.hint)}</div>
    </div>`).join("");
  w.document.write(`<!doctype html><html><head><title>QR stickers — ${escapeHtml(device.name)}</title>
    <style>body{font-family:Helvetica,Arial,sans-serif;margin:24px;display:flex;gap:24px;flex-wrap:wrap}
    .card{width:300px;border:2px solid #1B2430;border-radius:14px;padding:16px;text-align:center;page-break-inside:avoid}
    .head{background:#1B2430;color:#fff;font-weight:700;padding:8px;border-radius:8px;font-size:16px}
    img{width:240px;height:240px;margin:12px auto;display:block}
    .name{font-weight:700;font-size:17px}.sub{color:#5B6672;font-size:12px;margin-top:2px}
    .hint{color:#5B6672;font-size:11px;margin-top:8px}</style></head>
    <body>${cards}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
  return true;
}
function printBulkStickers(devs, locationLabel) {
  const base = appBaseUrl();
  const w = window.open("", "_blank");
  if (!w) return false;
  const card = (d, title, url, hint) => `<div class="card"><div class="head">${escapeHtml(title)}</div><img src="${qrImageUrl(url, 240)}" /><div class="name">${escapeHtml(d.name)}</div><div class="sub">${escapeHtml([d.area, d.assetTag && `#${d.assetTag}`].filter(Boolean).join(" · ") || locationLabel(d) || "")}</div><div class="hint">${escapeHtml(hint)}</div></div>`;
  const cards = devs.map((d) => card(d, "Report a problem", `${base}?request=${d.id}`, "Scan with your phone camera") + card(d, "Staff: service record", `${base}?service=${d.id}`, "History & log visit")).join("");
  w.document.write(`<!doctype html><html><head><title>QR stickers</title><style>body{font-family:Helvetica,Arial,sans-serif;margin:12mm;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .card{border:1.5px solid #1B2430;border-radius:10px;padding:8px;text-align:center;page-break-inside:avoid}.head{background:#1B2430;color:#fff;font-weight:700;padding:4px;border-radius:6px;font-size:11px}
    img{width:120px;height:120px;margin:6px auto;display:block}.name{font-weight:700;font-size:12px}.sub{color:#5B6672;font-size:10px}.hint{color:#5B6672;font-size:9px;margin-top:3px}</style></head>
    <body>${cards}<script>window.onload=function(){setTimeout(function(){window.print()},600)}<\/script></body></html>`);
  w.document.close();
  return true;
}
function ServiceQrModal({ device, locationLabel, onClose }) {
  const base = appBaseUrl();
  const stickers = [
    { key: "request", title: "Report a problem", url: `${base}?request=${device.id}`, hint: "Scan with your phone camera — no login needed" },
    { key: "service", title: "Staff: service record", url: `${base}?service=${device.id}`, hint: "Opens history & Log visit" },
  ];
  const [printBlocked, setPrintBlocked] = useState(false);
  return (
    <Modal title={`QR stickers — ${device.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>Print these and stick them on or near the asset. Anyone can scan the first one to report an issue; the second takes staff straight to this service's record.</div>
        <div style={{ display: "flex", gap: 10 }}>
          {stickers.map((s) => (
            <div key={s.key} style={{ flex: 1, border: "1px solid #E1E4E8", borderRadius: 10, padding: 10, textAlign: "center", background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1B2430", marginBottom: 6 }}>{s.title}</div>
              <img src={qrImageUrl(s.url, 220)} alt={s.title} style={{ width: "100%", maxWidth: 150, aspectRatio: "1", display: "block", margin: "0 auto" }} />
              <div style={{ fontSize: 10, color: "#8A94A0", marginTop: 6, wordBreak: "break-all" }}>{s.url}</div>
            </div>
          ))}
        </div>
        <PrimaryButton onClick={() => setPrintBlocked(!printStickers(device, locationLabel, stickers))}><Printer size={15} /> Print stickers</PrimaryButton>
        {printBlocked && <div style={{ fontSize: 11.5, color: "#9B2C2C" }}>Your browser blocked the print window — allow pop-ups for this site, or long-press / right-click the codes above to save them.</div>}
        <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>QR images are generated by api.qrserver.com from the link shown — the link only contains this service's ID. Stickers work on your deployed (Vercel) site; links from inside the Claude preview won't open for other people.</div>
      </div>
    </Modal>
  );
}

function RequestPortal({ deviceId }) {
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState(null);
  const [location, setLocation] = useState(null);
  const [recent, setRecent] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");

  async function refresh() {
    const [devices, locations, works] = await Promise.all([loadShared(SKEYS.devices), loadShared(SKEYS.locations), loadShared(SKEYS.works)]);
    const dev = devices.find((d) => d.id === deviceId) || null;
    setDevice(dev);
    setLocation(dev ? locations.find((l) => l.id === dev.locationId) || null : null);
    setRecent(works.filter((w) => w.deviceId === deviceId && w.status !== "completed" && w.status !== "rejected").slice(0, 8));
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [deviceId]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { setPhoto(await compressImage(file)); } catch (err) { /* allow retry */ }
    setBusy(false);
  }
  async function submit() {
    if (!name.trim() || !description.trim()) { setError("Please add your name and describe the problem."); return; }
    setError(""); setBusy(true);
    const latest = await loadShared(SKEYS.works); // re-read so we don't overwrite someone else's change
    const record = {
      id: uid(), deviceId, description: description.trim(), quoteAmount: 0,
      dateRaised: new Date().toISOString().slice(0, 10), status: "requested", budgetType: "budgeted",
      photos: photo ? [photo] : [], priority, supplierId: device?.supplierId || null, comments: [],
      source: "request", requestedBy: name.trim(), loggedAt: new Date().toISOString(),
    };
    await saveShared(SKEYS.works, [record, ...latest]);
    setSubmitted(record); setBusy(false);
    setDescription(""); setPhoto(null); setPriority("medium");
    refresh();
  }

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "#EEF0F2", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", color: "#1B2430", padding: 16 }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ background: "#1B2430", color: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#9AA5B1", fontWeight: 600 }}>Report a problem</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>{device ? device.name : "PPM Service Book"}</div>
          {location && <div style={{ fontSize: 12.5, color: "#C7D0DA", marginTop: 2 }}>{location.name}</div>}
        </div>
        {children}
      </div>
    </div>
  );
  if (loading) return shell(<div style={{ textAlign: "center", padding: 30, color: "#8A94A0" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>);
  if (!device) return shell(<div style={{ background: "#fff", borderRadius: 12, padding: 18, fontSize: 13.5 }}>This QR code doesn't match a service anymore — it may have been removed. Please let the facilities team know directly.</div>);
  return shell(
    <>
      {submitted && (
        <div style={{ background: "#EAF4EE", border: "1px solid #BFDCC9", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "#2F6B4A", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} /> Thanks — your request was sent</div>
          <div style={{ fontSize: 12.5, color: "#3A5A46", marginTop: 4 }}>Reference <b>{submitted.id.slice(-6).toUpperCase()}</b>. You can check its status below any time by scanning the same code.</div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Your name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam from Finance" /></Field>
        <Field label="What's the problem?"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Tap in the kitchen is leaking" /></Field>
        <Field label="How urgent is it?">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low — when someone gets a chance</option>
            <option value="medium">Medium — needs attention this week</option>
            <option value="high">High — urgent / safety issue</option>
          </Select>
        </Field>
        <Field label="Photo (optional)">
          <label style={{ border: "1px dashed #D7DCE1", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#5B6672", fontSize: 13, background: "#FAFBFC" }}>
            {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={15} />}
            {photo ? "Replace photo" : "Add a photo"}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          {photo && <img src={photo} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 8 }} />}
        </Field>
        {error && <div style={{ fontSize: 12.5, color: "#C53030" }}>{error}</div>}
        <PrimaryButton onClick={submit}><Send size={15} /> Send request</PrimaryButton>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 6 }}>Open issues for this {device.name.length > 24 ? "service" : device.name} ({recent.length})</div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#8A94A0" }}>No open issues right now.</div>
        ) : recent.map((w) => (
          <div key={w.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#1B2430" }}>{w.description}</div>
              <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 2 }}>Ref {w.id.slice(-6).toUpperCase()} · {fmtDate(w.dateRaised)}</div>
            </div>
            <WorkStatusTag status={w.status} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   Search everything — services, visits, works and suppliers
--------------------------------------------------------- */
function GlobalSearchModal({ devices, services, works, suppliers, deviceById, onClose, onOpenDevice, onOpenVisit, onOpenWork, onOpenSupplier }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const hit = (...vals) => vals.filter(Boolean).some((v) => String(v).toLowerCase().includes(query));
  const res = useMemo(() => {
    if (query.length < 2) return null;
    return {
      devices: devices.filter((d) => hit(d.name, d.assetTag, d.category, d.subCategory, d.serialNumber, d.manufacturer, d.model, d.area)).slice(0, 15),
      visits: services.filter((v) => hit(v.name, v.notes, v.technician, v.poNumber, deviceById[v.deviceId]?.name)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 15),
      works: works.filter((w) => hit(w.description, w.poNumber, deviceById[w.deviceId]?.name)).slice(0, 15),
      suppliers: suppliers.filter((s) => hit(s.name, s.contact, s.managerName, s.managerEmail, s.contractRef, s.subCategory, s.accreditation)).slice(0, 15),
    };
  }, [query, devices, services, works, suppliers]);
  const total = res ? res.devices.length + res.visits.length + res.works.length + res.suppliers.length : 0;
  const row = (key, title, sub, onClick) => (
    <button key={key} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#F7F8F9", border: "none", borderRadius: 9, padding: "9px 11px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: "#1B2430", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: "#8A94A0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      <ChevronRight size={14} color="#A3ABB4" />
    </button>
  );
  const section = (label, items) => items.length > 0 && (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 6 }}>{label} ({items.length})</div>
      {items}
    </div>
  );
  return (
    <Modal title="Search everything" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <Search size={15} color="#8A94A0" style={{ position: "absolute", left: 11, top: 12 }} />
          <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, asset tag, serial, PO number, supplier…" style={{ width: "100%", paddingLeft: 34 }} />
        </div>
        {!res && <div style={{ fontSize: 12, color: "#A3ABB4", padding: "8px 2px" }}>Type at least 2 letters. Searches services, logged visits, works and suppliers at this location.</div>}
        {res && total === 0 && <div style={{ fontSize: 13, color: "#8A94A0", textAlign: "center", padding: "20px 0" }}>No matches for "{q}".</div>}
        {res && section("Services", res.devices.map((d) => row(`d-${d.id}`, d.name, [d.assetTag, d.manufacturer, d.model, d.serialNumber && `S/N ${d.serialNumber}`].filter(Boolean).join(" · "), () => onOpenDevice(d.id))))}
        {res && section("Logged visits", res.visits.map((v) => row(`v-${v.id}`, `${deviceById[v.deviceId]?.name || "Service"} — ${v.name || "Visit"}`, [fmtDate(v.date), v.technician, v.poNumber && `PO ${v.poNumber}`].filter(Boolean).join(" · "), () => onOpenVisit(v))))}
        {res && section("Works", res.works.map((w) => row(`w-${w.id}`, w.description, [deviceById[w.deviceId]?.name, w.status, w.quoteAmount ? gbp(w.quoteAmount) : null].filter(Boolean).join(" · "), () => onOpenWork(w))))}
        {res && section("Suppliers", res.suppliers.map((s) => row(`s-${s.id}`, s.name, [s.managerName, s.managerEmail, s.contractRef].filter(Boolean).join(" · "), () => onOpenSupplier(s))))}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Activity log, backup & restore, storage usage
--------------------------------------------------------- */
function DataModal({ pendingCount = 0, remote = false, display = { scale: 1 }, onDisplay, activity, storageInfo, saveErrors, lastBackupAt, canEdit, onBackup, onRestore, onClose }) {
  const [view, setView] = useState("activity");
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(null); // parsed backup waiting for confirmation
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const shown = activity.filter((a) => !filter.trim() || `${a.text} ${a.by}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const daysSinceBackup = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000) : null;
  function pickFile(e) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setErr("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed?.data?.devices) { setErr("That file isn't a PPM Service Book backup."); return; }
        setPending(parsed);
      } catch (x) { setErr("Couldn't read that file — is it a .json backup?"); }
    };
    reader.readAsText(file);
  }
  function confirmRestore() {
    const msg = onRestore(pending);
    if (msg) { setErr(msg); setPending(null); return; }
    setPending(null); onClose();
  }
  const tabBtn = (k, label) => (
    <button onClick={() => setView(k)} style={{ flex: 1, background: view === k ? "#2B4562" : "#EEF0F2", color: view === k ? "#fff" : "#5B6672", border: "none", borderRadius: 8, padding: "8px 6px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );
  const mb = (n) => (n / (1024 * 1024)).toFixed(2);
  return (
    <Modal title="Activity, backup & display" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>{tabBtn("activity", "Activity log")}{tabBtn("backup", "Backup & storage")}{tabBtn("display", "Display")}{tabBtn("sharing", "Sharing")}</div>
        {view === "sharing" && <SharingPanel remote={remote} />}
        {view === "display" && (
          <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Type size={14} /> Text size</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[[1, "Normal"], [1.12, "Large"], [1.25, "Extra large"]].map(([v, label]) => (
                <ToggleButton key={v} active={(display.scale || 1) === v} onClick={() => onDisplay?.({ ...display, scale: v })}>{label}</ToggleButton>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><Moon size={14} /> Dark mode</div>
            <div style={{ display: "flex", gap: 6 }}>
              <ToggleButton active={!display.dark} onClick={() => onDisplay?.({ ...display, dark: false })}>Light</ToggleButton>
              <ToggleButton active={!!display.dark} onClick={() => onDisplay?.({ ...display, dark: true })}>Dark</ToggleButton>
            </div>
            <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Makes everything bigger — handy on a tablet in the plant room or for easier reading. Only changes this device.</div>
          </div>
        )}

        {view === "activity" && (
          <>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by person or action" style={{ flex: 1 }} />
              <ExportButton label="CSV" filename="ppm-activity-log.csv" rows={[["When", "Who", "What"], ...shown.map((a) => [new Date(a.at).toLocaleString("en-GB"), a.by, a.text])]} />
            </div>
            {shown.length === 0 && <div style={{ fontSize: 13, color: "#8A94A0", textAlign: "center", padding: "20px 0" }}>No activity recorded yet. Every change made from now on appears here.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shown.slice(0, 150).map((a) => (
                <div key={a.id} style={{ background: "#F7F8F9", borderRadius: 9, padding: "8px 10px" }}>
                  <div style={{ fontSize: 12.8, fontWeight: 600, color: "#1B2430" }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: "#8A94A0", marginTop: 2 }}>{a.by} · {new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Keeps the latest 500 changes across all locations.</div>
          </>
        )}

        {view === "backup" && (
          <>
            {Object.keys(saveErrors).length > 0 && (
              <div style={{ background: "#FBEAEA", color: "#9B2C2C", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, fontWeight: 600 }}>
                Recent changes could not be saved ({Object.values(saveErrors)[0]}). Download a backup now so nothing is lost.
              </div>
            )}
            <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Backup</div>
              <div style={{ fontSize: 12, color: "#5B6672" }}>
                Downloads one file with every location, service, visit, photo, supplier and budget.{" "}
                {lastBackupAt ? `Last backup: ${fmtDate(lastBackupAt.slice(0, 10))}${daysSinceBackup > 7 ? ` (${daysSinceBackup} days ago)` : ""}.` : "No backup taken yet."}
              </div>
              <PrimaryButton onClick={onBackup}><Download size={15} /> Download backup</PrimaryButton>
            </div>
            {canEdit && (
              <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Restore</div>
                <div style={{ fontSize: 12, color: "#5B6672" }}>Replaces ALL current data with the contents of a backup file.</div>
                <input ref={fileRef} type="file" accept=".json,application/json" onChange={pickFile} style={{ display: "none" }} />
                {!pending ? (
                  <button onClick={() => fileRef.current?.click()} style={{ background: "#fff", border: "1px solid #D7DCE1", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Upload size={14} /> Choose backup file
                  </button>
                ) : (
                  <div style={{ background: "#FDF1E0", borderRadius: 9, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12.5, color: "#8A5A0B", fontWeight: 600 }}>
                      Backup from {pending.exportedAt ? new Date(pending.exportedAt).toLocaleString("en-GB") : "unknown date"}{pending.exportedBy ? ` by ${pending.exportedBy}` : ""}: {pending.data.devices.length} services, {(pending.data.services || []).length} visits, {(pending.data.suppliers || []).length} suppliers. Current data will be overwritten.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={confirmRestore} style={{ flex: 1, background: "#9B2C2C", color: "#fff", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Replace my data</button>
                      <button onClick={() => setPending(null)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                )}
                {err && <div style={{ fontSize: 12, color: "#C53030" }}>{err}</div>}
              </div>
            )}
            <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Smartphone size={14} /> Install as an app</div>
              <div style={{ fontSize: 12, color: "#5B6672" }}>Put PPM Service Book on your phone's home screen or desktop so it opens full-screen like a normal app. On iPhone: Share → Add to Home Screen. On Android / Chrome: menu → Install app.</div>
              {typeof window !== "undefined" && window.__ppmInstallPrompt && (
                <PrimaryButton onClick={() => { window.__ppmInstallPrompt.prompt(); window.__ppmInstallPrompt = null; }}><Smartphone size={15} /> Install app</PrimaryButton>
              )}
            </div>
            <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><HardDrive size={14} /> Storage</div>
              <div style={{ fontSize: 12, color: "#5B6672" }}>
                Data size: {mb(storageInfo.chars)} MB{storageInfo.local ? ` of about 5 MB browser storage (${storageInfo.pct}%)` : ""}. Photos take up most of the space.
              </div>
              {storageInfo.local && (
                <div style={{ height: 8, background: "#E1E4E8", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${storageInfo.pct}%`, height: "100%", background: storageInfo.pct >= 90 ? "#C53030" : storageInfo.pct >= 80 ? "#D97706" : "#2F855A" }} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Home dashboard
--------------------------------------------------------- */
function HomeTab({ myName, myWorks = [], emergency, onSaveEmergency, pendingCount = 0, setup, onHideSetup, syncInfo, reminders = [], users = [], onAddReminder, onToggleReminder, onDeleteReminder, userName, devices, services, works, visitBudgets, alerts, activity, spend, onGo, onOpenDevice, statutoryNA = [], onStatutoryNA, onAddStatutory, locationName = "", signins = [], suppliers = [], onSignIn, onSignOut }) {
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const comp = useMemo(() => computeCompliance(devices, visitBudgets, services), [devices, visitBudgets, services]);
  const overdue = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; });
  const next7 = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 7; });
  const notBooked = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 14 && !currentBooking(d); });
  const openWorks = works.filter((w) => !["completed", "rejected"].includes(w.status));
  const slaBreached = openWorks.filter((w) => workSla(w)?.breached);
  const spendPct = spend.budget ? Math.round((spend.spent / spend.budget) * 100) : null;
  const upcoming = devices.filter((d) => d.nextServiceDate).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate)).slice(0, 6);
  const yr = new Date().getFullYear();
  const lateByReason = {};
  services.filter((v) => v.lateReason && String(v.date).startsWith(String(yr))).forEach((v) => { lateByReason[v.lateReason] = (lateByReason[v.lateReason] || 0) + 1; });
  const card = { background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 };
  const Kpi = ({ label, value, sub, tone = "muted", onClick }) => {
    const c = { danger: "#C53030", warn: "#B7791F", ok: "#2F855A", muted: "#1B2430" }[tone];
    return (
      <button onClick={onClick} style={{ ...card, textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 650, color: "#8A94A0" }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 750, color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
        {sub && <span style={{ fontSize: 10.5, color: "#8A94A0" }}>{sub}</span>}
      </button>
    );
  };
  const H = ({ children, action, onAction }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#3A4451" }}>{children}</span>
      {action && <button onClick={onAction} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{action}</button>}
    </div>
  );
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 750 }}>{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}{userName ? `, ${userName.split(" ")[0]}` : ""}</div>
        <div style={{ fontSize: 12.5, color: "#8A94A0" }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Kpi label="PPM on time" value={comp.pct === null ? "—" : `${comp.pct}%`} sub={comp.total ? `${comp.totals.onTime} of ${comp.total} planned visits` : "No planned visits due yet"} tone={comp.pct === null ? "muted" : comp.pct >= 90 ? "ok" : comp.pct >= 70 ? "warn" : "danger"} onClick={() => onGo("certificates")} />
        <Kpi label="Overdue" value={overdue.length} sub="services past due" tone={overdue.length ? "danger" : "ok"} onClick={() => onGo("schedule")} />
        <Kpi label="Due next 7 days" value={next7.length} sub={notBooked.length ? `${notBooked.length} due in 14 days not booked` : "all booked"} tone={notBooked.length ? "warn" : "muted"} onClick={() => onGo("devices")} />
        <Kpi label="Open works" value={openWorks.length} sub={slaBreached.length ? `${slaBreached.length} past target date` : "all within target"} tone={slaBreached.length ? "danger" : "muted"} onClick={() => onGo("works")} />
      </div>
      <button onClick={() => onGo("budget")} style={{ ...card, width: "100%", marginTop: 8, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 650, color: "#8A94A0" }}>
          <span>Spend {spend.yr} to date</span>
          <span>{spendPct === null ? "No annual budget set" : `${spendPct}% of budget`}</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace", margin: "3px 0 6px" }}>
          {gbp(spend.spent)}{spend.budget ? <span style={{ fontSize: 12.5, color: "#8A94A0", fontWeight: 600 }}> / {gbp(spend.budget)}</span> : null}
        </div>
        {spend.budget > 0 && (() => {
          const expected = Math.round(((new Date().getMonth() + new Date().getDate() / 31) / 12) * 100);
          return (
            <>
              <div style={{ position: "relative", height: 8, background: "#E1E4E8", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, spendPct)}%`, height: "100%", background: spendPct > 100 ? "#C53030" : spendPct > expected + 10 ? "#D97706" : "#2F855A" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, expected)}%`, width: 2, background: "#1B2430" }} />
              </div>
              <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 4 }}>Black line = where spend would be if spread evenly across the year ({expected}%).</div>
              {spend.forecast != null && (
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: spend.forecast > spend.budget ? "#C53030" : "#2F855A" }}>
                  Forecast year-end: {gbp(spend.forecast)} ({Math.round((spend.forecast / spend.budget) * 100)}% of budget){spend.forecast > spend.budget ? ` — ${gbp(spend.forecast - spend.budget)} over` : ""}
                </div>
              )}
            </>
          );
        })()}
      </button>

      {syncInfo && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5B6672", margin: "8px 0 0" }}>
          {pendingCount > 0 ? <CloudOff size={13} color="#B7791F" /> : <Cloud size={13} color="#2F855A" />} Shared database · {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to upload` : syncInfo.syncing ? "syncing…" : syncInfo.lastSync ? `updated ${syncInfo.lastSync.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "connected"}
          <button onClick={syncInfo.onRefresh} title="Refresh now" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><RefreshCw size={12} color="#2B4562" /></button>
        </div>
      )}
      {setup && !setup.hidden && ACTIVE_CAN_EDIT && (() => {
        const steps = [
          ["Add your suppliers", setup.suppliers > 0, "suppliers"], ["Add services (or import a spreadsheet)", setup.devices > 0, "devices"],
          ["Set a budget or plan", setup.budgets > 0, "budget"], ["Log your first visit", setup.visits > 0, "devices"],
          ["Back up, or connect a shared database", setup.backup, null],
        ];
        const done = steps.filter((x) => x[1]).length;
        if (done === steps.length) return null;
        return (
          <div style={{ background: "#EAF1F8", border: "1px solid #C9D9EA", borderRadius: 12, padding: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Rocket size={16} color="#2B4562" />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "#2B4562" }}>Getting started — {done}/{steps.length}</span>
              <button onClick={onHideSetup} title="Hide" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={14} color="#5B6672" /></button>
            </div>
            {steps.map(([label, ok, tab]) => (
              <button key={label} onClick={() => tab && onGo(tab)} disabled={ok} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", background: "none", border: "none", padding: "4px 0", cursor: ok || !tab ? "default" : "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 12.8, color: ok ? "#8A94A0" : "#1B2430", textDecoration: ok ? "line-through" : "none" }}>
                {ok ? <CheckCircle2 size={15} color="#2F855A" /> : <Square size={15} color="#8A94A0" />} {label}
              </button>
            ))}
          </div>
        );
      })()}
      {myName && (() => {
        const myDevices = devices.filter((d) => d.assignee === myName && d.nextServiceDate && daysUntil(d.nextServiceDate) <= 14).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate));
        if (!myDevices.length && !myWorks.length) return null;
        return (
          <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><UserCheck size={17} color="#2B6CB0" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>Assigned to you</span></div>
            {myDevices.slice(0, 6).map((d) => { const n = daysUntil(d.nextServiceDate); return (
              <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ display: "flex", width: "100%", gap: 8, background: "none", border: "none", borderTop: "1px solid #EEF0F2", padding: "6px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 12.8 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{d.name}</span><span style={{ color: n < 0 ? "#C53030" : "#8A94A0", fontWeight: n < 0 ? 700 : 500 }}>{n < 0 ? `${-n}d overdue` : n === 0 ? "today" : `in ${n}d`}</span>
              </button>
            ); })}
            {myWorks.slice(0, 4).map((w) => (
              <button key={w.id} onClick={() => onGo("works")} style={{ display: "flex", width: "100%", gap: 8, background: "none", border: "none", borderTop: "1px solid #EEF0F2", padding: "6px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 12.8 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{w.description}</span><span style={{ color: workSla(w)?.breached ? "#C53030" : "#8A94A0" }}>{w.status.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        );
      })()}
      <EmergencyContacts contacts={emergency} onSave={onSaveEmergency} />
      <RemindersCard reminders={reminders} users={users} onAdd={onAddReminder} onToggle={onToggleReminder} onDelete={onDeleteReminder} />
      <SiteRegister signins={signins} suppliers={suppliers} devices={devices} locationName={locationName} onSignIn={onSignIn} onSignOut={onSignOut} />

      <H action={alerts.length > 5 ? `All ${alerts.length}` : null} onAction={() => onGo("alerts")}>Needs attention</H>
      {alerts.length === 0 ? (
        <div style={{ ...card, fontSize: 12.5, color: "#2F855A", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} /> All clear — nothing needs attention.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {alerts.slice(0, 5).map((a) => (
            <button key={a.key} onClick={() => onGo(a.tab)} style={{ ...card, padding: "9px 11px", borderLeft: `3px solid ${a.tone === "danger" ? "#C53030" : a.tone === "warn" ? "#D97706" : "#2B4562"}`, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 12.8, fontWeight: 700 }}>{a.title}</div>
              {a.detail && <div style={{ fontSize: 11.3, color: "#8A94A0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</div>}
            </button>
          ))}
        </div>
      )}

      <H action="Schedule" onAction={() => onGo("schedule")}>Coming up</H>
      {upcoming.length === 0 ? <div style={{ ...card, fontSize: 12.5, color: "#8A94A0" }}>Nothing scheduled.</div> : (
        <div style={{ ...card, padding: 0 }}>
          {upcoming.map((d, i) => {
            const n = daysUntil(d.nextServiceDate); const b = currentBooking(d);
            return (
              <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", borderTop: i ? "1px solid #EEF0F2" : "none", padding: "9px 12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 750, color: n < 0 ? "#C53030" : "#1B2430" }}>{new Date(d.nextServiceDate + "T00:00:00").getDate()}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#8A94A0", textTransform: "uppercase" }}>{new Date(d.nextServiceDate + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: n < 0 ? "#C53030" : "#8A94A0" }}>{n < 0 ? `${-n} days overdue` : n === 0 ? "Due today" : `In ${n} day${n === 1 ? "" : "s"}`}{b ? ` · ${b.status === "confirmed" ? "Confirmed" : "Booked"}${b.time ? ` ${b.time}` : ""}` : n >= 0 && n <= 14 ? " · not booked" : ""}</div>
                </div>
                <ChevronRight size={14} color="#A3ABB4" />
              </button>
            );
          })}
        </div>
      )}

      <StatutoryRegister devices={devices} na={statutoryNA} onNA={onStatutoryNA} onAdd={onAddStatutory} onOpenDevice={onOpenDevice} locationName={locationName} />

      {Object.keys(lateByReason).length > 0 && (
        <>
          <H>Late visits in {yr} — why</H>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(lateByReason).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
              <div key={r} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{r}</span><b>{n}</b></div>
            ))}
          </div>
        </>
      )}

      <H>Recent activity</H>
      {activity.length === 0 ? <div style={{ ...card, fontSize: 12.5, color: "#8A94A0" }}>No activity yet.</div> : (
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          {activity.slice(0, 5).map((a) => (
            <div key={a.id}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.text}</div>
              <div style={{ fontSize: 10.8, color: "#8A94A0" }}>{a.by} · {relativeDays(a.at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Bulk log visits
--------------------------------------------------------- */
function BulkLogModal({ devices, defaultTech, onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [useBudgetCost, setUseBudgetCost] = useState(true);
  const total = devices.reduce((t, d) => t + (Number(d.budgetPerVisit) || 0), 0);
  return (
    <Modal title={`Log ${devices.length} visit${devices.length === 1 ? "" : "s"}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "#5B6672", background: "#F7F8F9", borderRadius: 9, padding: "8px 10px", maxHeight: 110, overflowY: "auto" }}>
          {devices.map((d) => d.name).join(" · ")}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Visit date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Technician"><TextInput value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder={defaultTech || "Name"} /></Field>
        </div>
        <Field label="Notes (applied to every visit)"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Weekly clean completed" /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4451", cursor: "pointer" }}>
          <input type="checkbox" checked={useBudgetCost} onChange={(e) => setUseBudgetCost(e.target.checked)} style={{ margin: 0 }} />
          Record each service's budget per visit as its cost{total ? ` (${gbp(total)} total)` : ""}
        </label>
        <div style={{ fontSize: 11, color: "#8A94A0" }}>Each service moves on to its next due date. Checklists, photos and signatures can be added afterwards by editing a visit.</div>
        <PrimaryButton onClick={() => date && onSave({ date, technician: technician.trim(), notes: notes.trim(), useBudgetCost })}><CheckCircle2 size={15} /> Log {devices.length} visit{devices.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Booking the next visit with the supplier
--------------------------------------------------------- */
function BookingModal({ device, onClose, onSave }) {
  const b = currentBooking(device);
  const [status, setStatus] = useState(b?.status || "booked");
  const [date, setDate] = useState(b?.date || device.nextServiceDate || "");
  const [time, setTime] = useState(b?.time || "");
  const [ref, setRef] = useState(b?.ref || "");
  return (
    <Modal title={`Book visit — ${device.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "#5B6672" }}>Due {fmtDate(device.nextServiceDate)}. The booking resets automatically once this visit is logged.</div>
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={status === "booked"} onClick={() => setStatus("booked")}>Requested / booked</ToggleButton>
          <ToggleButton active={status === "confirmed"} onClick={() => setStatus("confirmed")}>Confirmed by supplier</ToggleButton>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time (optional)"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Supplier job / booking ref (optional)"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. JOB-55812" /></Field>
        <PrimaryButton onClick={() => onSave({ status, date: date || null, time, ref: ref.trim() })}><CalendarCheck size={15} /> Save booking</PrimaryButton>
        {b && <button onClick={() => onSave(null)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Clear booking</button>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Dated site notes on a service
--------------------------------------------------------- */
function NotesLog({ notes, onAdd, onDelete }) {
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? notes : notes.slice(0, 3);
  return (
    <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", display: "flex", alignItems: "center", gap: 5 }}><StickyNote size={13} /> Site notes ({notes.length})</div>
      {ACTIVE_CAN_EDIT && onAdd && (
        <div style={{ display: "flex", gap: 6 }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onAdd(text); setText(""); } }} placeholder="e.g. Fan belt worn — monitor next visit" style={{ flex: 1, fontSize: 13 }} />
          <button onClick={() => { if (text.trim()) { onAdd(text); setText(""); } }} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
        </div>
      )}
      {list.map((n) => (
        <div key={n.id} style={{ background: "#fff", borderRadius: 8, padding: "7px 9px", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{n.text}</div>
            <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 2 }}>{n.by} · {fmtDate(n.at.slice(0, 10))}</div>
          </div>
          {onDelete && <ConfirmDeleteButton onConfirm={() => onDelete(n.id)} size={12} />}
        </div>
      ))}
      {notes.length > 3 && <button onClick={() => setShowAll((v) => !v)} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{showAll ? "Show fewer" : `Show all ${notes.length}`}</button>}
    </div>
  );
}

function buildBlankChecklist(d, supplierById) {
  const e = escapeHtml;
  const box = `<span style="display:inline-block;width:14px;height:14px;border:1.5px solid #1B2430;border-radius:3px"></span>`;
  const line = (w) => `<span style="display:inline-block;width:${w}px;border-bottom:1px solid #8A94A0">&nbsp;</span>`;
  const items = d.checklist?.length ? d.checklist : ["General inspection", "Work carried out as specified", "Area left clean and safe"];
  return `<table><tr><td><b>Date</b> ${line(120)}</td><td><b>Technician</b> ${line(160)}</td><td><b>Supplier</b> ${e(supplierById[d.supplierId]?.name || "")}</td></tr>
  <tr><td><b>Arrived</b> ${line(80)}</td><td><b>Left</b> ${line(80)}</td><td><b>PO / job ref</b> ${line(120)}</td></tr></table>
  ${d.accessNotes || d.ramsRequired || d.permits?.length ? `<h2>Access &amp; safety</h2><div>${e(d.accessNotes || "")}</div>${d.ramsRequired ? `<div>${box} RAMS received and reviewed</div>` : ""}${(d.permits || []).map((p) => `<div>${box} ${e(p)} permit — ref ${line(120)}</div>`).join("")}` : ""}
  <h2>Checklist</h2>${tableHtml(["Item", "Pass", "Fail", "N/A", "Notes"], items.map((it) => [e(it), box, box, box, line(200)]))}
  <h2>Notes / defects found</h2><div style="height:90px;border:1px solid #D7DCE1;border-radius:6px"></div>
  <h2>Sign-off</h2><table><tr><td><b>Technician signature</b><div style="height:40px"></div>${line(220)}</td><td><b>Site representative</b><div style="height:40px"></div>${line(220)}</td></tr></table>`;
}

/* ---------------------------------------------------------
   Statutory compliance register (UK)
--------------------------------------------------------- */
function StatutoryRegister({ devices, na = [], onNA, onAdd, onOpenDevice, locationName }) {
  const [open, setOpen] = useState(false);
  const rows = STATUTORY_ITEMS.map((item) => {
    const matched = devices.filter((d) => matchStatutory(item, d));
    const overdue = matched.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; });
    const status = na.includes(item.key) ? "na" : !matched.length ? "missing" : overdue.length ? "overdue" : "ok";
    return { item, matched, overdue, status };
  });
  const counts = { ok: rows.filter((r) => r.status === "ok").length, overdue: rows.filter((r) => r.status === "overdue").length, missing: rows.filter((r) => r.status === "missing").length };
  const applicable = rows.filter((r) => r.status !== "na").length;
  const tone = { ok: ["#2F855A", "#EAF4EE", "In place"], overdue: ["#C53030", "#FBEAEA", "Overdue"], missing: ["#8A5A0B", "#FDF1E0", "Not set up"], na: ["#8A94A0", "#EEF0F2", "Not applicable"] };
  function print() {
    const e = escapeHtml;
    openPrintReport("Statutory compliance register", locationName, `<div class="kpis"><div class="kpi">In place<b class="ok">${counts.ok}</b></div><div class="kpi">Overdue<b class="bad">${counts.overdue}</b></div><div class="kpi">Not set up<b class="warn">${counts.missing}</b></div></div>
      ${tableHtml(["Requirement", "Frequency", "Status", "Services", "Next due"], rows.map((r) => [
        `<b>${e(r.item.label)}</b>`, e(r.item.freq),
        `<span class="${r.status === "ok" ? "ok" : r.status === "overdue" ? "bad" : r.status === "missing" ? "warn" : "muted"}">${tone[r.status][2]}</span>`,
        e(r.matched.map((d) => d.name).join(", ")),
        r.matched.map((d) => d.nextServiceDate ? fmtDate(d.nextServiceDate) : "—").join(", "),
      ]))}<div class="muted">Matched by service name. Frequencies are typical UK guidance — confirm against your own risk assessments and insurer requirements.</div>`);
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 18 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <ScrollText size={18} color="#2B4562" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Statutory compliance</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>
            {counts.ok} of {applicable} in place{counts.overdue ? ` · ${counts.overdue} overdue` : ""}{counts.missing ? ` · ${counts.missing} not set up` : ""}
          </div>
        </div>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {rows.map((r) => {
            const [fg, bg, label] = tone[r.status];
            return (
              <div key={r.item.key} style={{ background: "#F7F8F9", borderRadius: 9, padding: "8px 10px", opacity: r.status === "na" ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 700 }}>{r.item.label}</div>
                    <div style={{ fontSize: 10.8, color: "#8A94A0" }}>{r.item.freq}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, borderRadius: 10, padding: "2px 8px", flexShrink: 0 }}>{label}</span>
                </div>
                {r.matched.length > 0 && r.status !== "na" && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                    {r.matched.map((d) => (
                      <button key={d.id} onClick={() => onOpenDevice(d.id)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 6, padding: "2px 7px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: r.overdue.includes(d) ? "#C53030" : "#2B4562", fontWeight: 600 }}>{d.name}</button>
                    ))}
                  </div>
                )}
                {ACTIVE_CAN_EDIT && (r.status === "missing" || r.status === "na") && (
                  <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                    {r.status === "missing" && <button onClick={() => onAdd(r.item)} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Set up this service</button>}
                    <button onClick={() => onNA(r.status === "na" ? na.filter((k) => k !== r.item.key) : [...na, r.item.key])} style={{ background: "none", border: "none", padding: 0, color: "#8A94A0", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{r.status === "na" ? "Mark as applicable" : "Not applicable here"}</button>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={print} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print register</button>
          <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Services are matched by name (e.g. "Emergency lighting test"). Frequencies are typical UK guidance — always follow your own risk assessments.</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Contractor sign-in register
--------------------------------------------------------- */
function SiteRegister({ signins, suppliers, devices, locationName, onSignIn, onSignOut }) {
  const [adding, setAdding] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const onSite = signins.filter((x) => !x.outAt);
  const time = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  function rollCall() {
    const e = escapeHtml;
    const box = `<span style="display:inline-block;width:14px;height:14px;border:1.5px solid #1B2430;border-radius:3px"></span>`;
    openPrintReport("Fire roll call — contractors on site", `${locationName} · ${new Date().toLocaleString("en-GB")}`,
      `<div class="kpis"><div class="kpi">On site now<b>${onSite.length}</b></div></div>${tableHtml(["Accounted for", "Name", "Company", "Working on", "Signed in", "Phone"], onSite.map((x) => [box, `<b>${e(x.name)}</b>`, e(x.company || ""), e(x.purpose || ""), time(x.inAt), e(x.phone || "")]))}`);
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <HardHat size={18} color="#D97706" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Contractors on site: {onSite.length}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Sign-in register and fire roll call</div>
        </div>
        {ACTIVE_CAN_EDIT && <button onClick={() => setAdding(true)} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><LogIn size={13} /> Sign in</button>}
      </div>
      {onSite.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {onSite.map((x) => (
            <div key={x.id} style={{ background: "#F7F8F9", borderRadius: 9, padding: "7px 9px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.8, fontWeight: 700 }}>{x.name}{x.company ? <span style={{ color: "#8A94A0", fontWeight: 600 }}> · {x.company}</span> : null}</div>
                <div style={{ fontSize: 11, color: "#8A94A0" }}>In {time(x.inAt)}{x.purpose ? ` · ${x.purpose}` : ""}{x.ramsChecked ? " · RAMS ✓" : ""}{x.badge ? ` · pass ${x.badge}` : ""}</div>
              </div>
              {ACTIVE_CAN_EDIT && <button onClick={() => onSignOut(x.id)} style={{ background: "#fff", border: "1px solid #D7DCE1", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><LogOut size={12} /> Out</button>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {onSite.length > 0 && <button onClick={rollCall} style={{ background: "none", border: "none", padding: 0, color: "#C53030", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Print fire roll call</button>}
        {signins.length > 0 && <button onClick={() => setShowLog(true)} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Full register ({signins.length})</button>}
      </div>
      {adding && <SignInModal suppliers={suppliers} devices={devices} onClose={() => setAdding(false)} onSave={(e) => { onSignIn(e); setAdding(false); }} />}
      {showLog && (
        <Modal title="Contractor register" onClose={() => setShowLog(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ alignSelf: "flex-end" }}>
              <ExportButton filename="contractor-register.csv" rows={[["Date", "Name", "Company", "Phone", "Working on", "RAMS checked", "Pass", "In", "Out", "Signed in by"], ...signins.map((x) => [fmtDate(x.inAt.slice(0, 10)), x.name, x.company || "", x.phone || "", x.purpose || "", x.ramsChecked ? "Yes" : "No", x.badge || "", time(x.inAt), x.outAt ? time(x.outAt) : "On site", x.by || ""])]} />
            </div>
            {signins.slice(0, 100).map((x) => (
              <div key={x.id} style={{ background: "#F7F8F9", borderRadius: 9, padding: "7px 9px" }}>
                <div style={{ fontSize: 12.8, fontWeight: 700 }}>{x.name}{x.company ? ` · ${x.company}` : ""}</div>
                <div style={{ fontSize: 11, color: "#8A94A0" }}>{fmtDate(x.inAt.slice(0, 10))} · {time(x.inAt)}–{x.outAt ? time(x.outAt) : "on site"}{x.purpose ? ` · ${x.purpose}` : ""}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function SignInModal({ suppliers, devices, onClose, onSave }) {
  const [supplierId, setSupplierId] = useState("");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [ramsChecked, setRamsChecked] = useState(false);
  const [badge, setBadge] = useState("");
  const listId = useMemo(() => `purpose-${uid()}`, []);
  return (
    <Modal title="Sign in a contractor" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Company">
          <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setCompany(suppliers.find((s) => s.id === e.target.value)?.name || ""); }}>
            <option value="">— Other / not a listed supplier —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {!supplierId && <Field label="Company name"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. ABC Electrical" /></Field>}
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
          <Field label="Mobile"><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" /></Field>
        </div>
        <Field label="Working on">
          <TextInput list={listId} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. AHU 3 service" />
          <datalist id={listId}>{devices.map((d) => <option key={d.id} value={d.name} />)}</datalist>
        </Field>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <Field label="Visitor pass no. (optional)"><TextInput value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="e.g. 14" /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4451", cursor: "pointer", paddingBottom: 10 }}>
            <input type="checkbox" checked={ramsChecked} onChange={(e) => setRamsChecked(e.target.checked)} style={{ margin: 0 }} /> RAMS checked
          </label>
        </div>
        <PrimaryButton onClick={() => name.trim() && onSave({ name: name.trim(), company: company.trim(), supplierId: supplierId || null, phone: phone.trim(), purpose: purpose.trim(), ramsChecked, badge: badge.trim() })}><LogIn size={15} /> Sign in</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Utility meters
--------------------------------------------------------- */
const METER_TYPES = { electricity: { label: "Electricity", unit: "kWh", color: "#D97706" }, gas: { label: "Gas", unit: "m³", color: "#C53030" }, water: { label: "Water", unit: "m³", color: "#2B6CB0" }, other: { label: "Other", unit: "", color: "#5B6672" } };
function meterStats(m, readings) {
  const rs = readings.filter((r) => r.meterId === m.id).sort((a, b) => a.date.localeCompare(b.date) || String(a.at).localeCompare(String(b.at)));
  const periods = [];
  for (let i = 1; i < rs.length; i++) {
    if (rs[i].reset) continue; // meter replaced — no consumption across the swap
    const days = Math.max(1, Math.round((new Date(rs[i].date) - new Date(rs[i - 1].date)) / 86400000));
    periods.push({ from: rs[i - 1].date, to: rs[i].date, used: Number(rs[i].value) - Number(rs[i - 1].value), days });
  }
  const monthly = {};
  periods.forEach((p) => { const k = p.to.slice(0, 7); monthly[k] = (monthly[k] || 0) + p.used; });
  const last = rs[rs.length - 1] || null;
  const lastP = periods[periods.length - 1] || null;
  const avgDaily = periods.length ? periods.reduce((t, p) => t + p.used, 0) / periods.reduce((t, p) => t + p.days, 0) : null;
  const lastDaily = lastP ? lastP.used / lastP.days : null;
  return { rs, periods, monthly, last, lastP, avgDaily, lastDaily, spike: avgDaily && lastDaily && periods.length >= 3 && lastDaily > avgDaily * 1.25 };
}
function MetersTab({ meters, readings, suppliers, onSaveMeter, onArchiveMeter, onAddReading, onDeleteReading }) {
  const [editing, setEditing] = useState(null);
  const [readingFor, setReadingFor] = useState(null);
  const [openId, setOpenId] = useState(null);
  const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("en-GB", { maximumFractionDigits: 1 });
  // Year-to-date totals across all meters.
  const yr = String(new Date().getFullYear());
  const ytd = meters.reduce((acc, m) => {
    const st = meterStats(m, readings);
    const used = st.periods.filter((p) => p.to.startsWith(yr)).reduce((t, p) => t + p.used, 0);
    const factor = m.co2Factor != null ? Number(m.co2Factor) : DEFAULT_CO2[m.type] || 0;
    return { cost: acc.cost + (m.tariff ? used * Number(m.tariff) : 0), co2: acc.co2 + used * factor, priced: acc.priced || !!m.tariff };
  }, { cost: 0, co2: 0, priced: false });
  const csv = [["Meter", "Type", "Date", "Reading", "Unit", "Meter replaced", "Entered by"], ...readings.map((r) => { const m = meters.find((x) => x.id === r.meterId); return [m?.name || "", METER_TYPES[m?.type]?.label || "", r.date, r.value, m?.unit || "", r.reset ? "Yes" : "", r.by || ""]; })];
  if (meters.length === 0) {
    return (
      <>
        <EmptyState icon={Activity} title="No meters yet" body="Add your electricity, gas and water meters to log readings and track consumption month by month." actionLabel={ACTIVE_CAN_EDIT ? "Add a meter" : undefined} onAction={() => setEditing({})} />
        {editing && <MeterModal existing={editing.id ? editing : null} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(m) => { onSaveMeter(m); setEditing(null); }} />}
      </>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT ? <button onClick={() => setEditing({})} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Plus size={14} /> Add meter</button> : <span />}
        <ExportButton rows={csv} filename="meter-readings.csv" />
      </div>
      {(ytd.co2 > 0 || ytd.priced) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {ytd.priced && <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Energy & water cost {yr}</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(ytd.cost)}</div></div>}
          <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "#2F855A", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><LeafIcon size={11} /> Carbon {yr}</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{ytd.co2 >= 1000 ? `${(ytd.co2 / 1000).toFixed(2)} t` : `${Math.round(ytd.co2)} kg`} CO₂e</div></div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meters.map((m) => {
          const st = meterStats(m, readings); const t = METER_TYPES[m.type] || METER_TYPES.other;
          const since = st.last ? -daysUntil(st.last.date) : null;
          const chart = Object.entries(st.monthly).sort().slice(-12).map(([k, v]) => ({ month: new Date(k + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" }), used: Math.round(v * 10) / 10 }));
          return (
            <div key={m.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${t.color}`, borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <button onClick={() => setOpenId(openId === m.id ? null : m.id)} style={{ flex: 1, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{t.label}{m.serial ? ` · #${m.serial}` : ""}{m.mpan ? ` · ${m.mpan}` : ""}</div>
                </button>
                {ACTIVE_CAN_EDIT && <button onClick={() => setEditing(m)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Pencil size={14} color="#8A94A0" /></button>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                <MetricBlock label="Last reading" value={st.last ? `${fmt(st.last.value)}` : "—"} />
                <MetricBlock label={`Used last period`} value={st.lastP ? `${fmt(st.lastP.used)} ${m.unit}` : "—"} tone={st.spike ? "danger" : undefined} />
                <MetricBlock label="Avg per day" value={st.avgDaily != null ? `${fmt(st.avgDaily)} ${m.unit}` : "—"} />
              </div>
              {st.lastP && (m.tariff || (m.co2Factor ?? DEFAULT_CO2[m.type])) ? (
                <div style={{ fontSize: 11.5, color: "#5B6672", marginTop: 6, fontWeight: 600 }}>
                  Last period: {m.tariff ? `${gbp(st.lastP.used * Number(m.tariff))} · ` : ""}{fmt(st.lastP.used * Number(m.co2Factor ?? DEFAULT_CO2[m.type] ?? 0))} kg CO₂e
                </div>
              ) : null}
              <div style={{ fontSize: 11, color: since != null && since > (Number(m.readEveryDays) || 31) ? "#B7791F" : "#8A94A0", marginTop: 6 }}>
                {st.last ? `Read ${fmtDate(st.last.date)} (${since === 0 ? "today" : `${since} days ago`})` : "No readings yet"} · read every {Number(m.readEveryDays) || 31} days
                {st.spike && <span style={{ color: "#C53030", fontWeight: 700 }}> · Usage up {Math.round((st.lastDaily / st.avgDaily - 1) * 100)}% on average — check for leaks or plant left running</span>}
              </div>
              {openId === m.id && chart.length > 0 && (
                <div style={{ height: 150, marginTop: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `${fmt(v)} ${m.unit}`} />
                      <Bar dataKey="used" fill={t.color} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {openId === m.id && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  {[...st.rs].reverse().slice(0, 12).map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, background: "#F7F8F9", borderRadius: 7, padding: "5px 8px" }}>
                      <span style={{ flex: 1 }}>{fmtDate(r.date)}{r.reset ? " · new meter" : ""}{r.by ? <span style={{ color: "#8A94A0" }}> · {r.by}</span> : null}</span>
                      <b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(r.value)}</b>
                      <ConfirmDeleteButton onConfirm={() => onDeleteReading(r.id)} size={12} />
                    </div>
                  ))}
                  {ACTIVE_CAN_EDIT && <button onClick={() => onArchiveMeter(m.id)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>Remove this meter</button>}
                </div>
              )}
              {ACTIVE_CAN_EDIT && <button onClick={() => setReadingFor(m)} style={{ width: "100%", marginTop: 10, background: "#EEF0F2", color: "#2B4562", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Add reading</button>}
            </div>
          );
        })}
      </div>
      {editing && <MeterModal existing={editing.id ? editing : null} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(m) => { onSaveMeter(m); setEditing(null); }} />}
      {readingFor && <ReadingModal meter={readingFor} last={meterStats(readingFor, readings).last} onClose={() => setReadingFor(null)} onSave={(r) => { onAddReading(r); setReadingFor(null); }} />}
    </div>
  );
}
function MeterModal({ existing, suppliers, onClose, onSave }) {
  const [name, setName] = useState(existing?.name || "");
  const [type, setType] = useState(existing?.type || "electricity");
  const [unit, setUnit] = useState(existing?.unit ?? METER_TYPES.electricity.unit);
  const [serial, setSerial] = useState(existing?.serial || "");
  const [mpan, setMpan] = useState(existing?.mpan || "");
  const [readEveryDays, setReadEveryDays] = useState(String(existing?.readEveryDays || 31));
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [tariff, setTariff] = useState(existing?.tariff != null ? String(existing.tariff) : "");
  const [co2, setCo2] = useState(existing?.co2Factor != null ? String(existing.co2Factor) : String(DEFAULT_CO2[existing?.type || "electricity"]));
  return (
    <Modal title={existing ? "Edit meter" : "Add a meter"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Meter name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main electricity incomer" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Type">
            <Select value={type} onChange={(e) => { setType(e.target.value); if (!existing) { setUnit(METER_TYPES[e.target.value].unit); setCo2(String(DEFAULT_CO2[e.target.value])); } }}>
              {Object.entries(METER_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Unit"><TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kWh" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Meter serial (optional)"><TextInput value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>
          <Field label="MPAN / MPRN (optional)"><TextInput value={mpan} onChange={(e) => setMpan(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Read every (days)"><TextInput type="number" min="1" value={readEveryDays} onChange={(e) => setReadEveryDays(e.target.value)} /></Field>
          <Field label="Energy supplier (optional)">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— None —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Price per ${unit || "unit"} (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" step="0.0001" min="0" value={tariff} onChange={(e) => setTariff(e.target.value)} placeholder="e.g. 0.245" /></Field>
          <Field label={`kg CO₂e per ${unit || "unit"}`}><TextInput type="number" step="0.001" min="0" value={co2} onChange={(e) => setCo2(e.target.value)} /></Field>
        </div>
        <span style={{ fontSize: 10.5, color: "#A3ABB4", marginTop: -6 }}>Carbon defaults are approximate UK factors (electricity 0.207 kg/kWh, gas 2.04 kg/m³, water 0.34 kg/m³) — update to your supplier's or the latest government figures.</span>
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), type, unit: unit.trim(), serial: serial.trim(), mpan: mpan.trim(), readEveryDays: Number(readEveryDays) || 31, supplierId: supplierId || null, tariff: tariff === "" ? null : Number(tariff), co2Factor: co2 === "" ? null : Number(co2) })}><CheckCircle2 size={15} /> Save meter</PrimaryButton>
      </div>
    </Modal>
  );
}
function ReadingModal({ meter, last, onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [reset, setReset] = useState(false);
  const [err, setErr] = useState("");
  function submit() {
    const v = Number(value);
    if (value === "" || isNaN(v)) { setErr("Enter the number shown on the meter."); return; }
    if (last && !reset && v < Number(last.value)) { setErr(`That's lower than the last reading (${last.value}). If the meter was replaced, tick the box below.`); return; }
    onSave({ meterId: meter.id, date, value: v, reset: reset || undefined });
  }
  return (
    <Modal title={`Reading — ${meter.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {last && <div style={{ fontSize: 12, color: "#5B6672" }}>Last reading: <b>{last.value} {meter.unit}</b> on {fmtDate(last.date)}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={`Reading${meter.unit ? ` (${meter.unit})` : ""}`}><TextInput autoFocus type="number" inputMode="decimal" step="any" value={value} onChange={(e) => { setValue(e.target.value); setErr(""); }} /></Field>
        </div>
        {last && value !== "" && !isNaN(Number(value)) && !reset && Number(value) >= Number(last.value) && (
          <div style={{ fontSize: 12, color: "#2F855A", fontWeight: 600 }}>Used since last reading: {(Number(value) - Number(last.value)).toLocaleString("en-GB", { maximumFractionDigits: 1 })} {meter.unit}</div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#3A4451", cursor: "pointer" }}>
          <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} style={{ margin: 0 }} /> New / replaced meter (starts a fresh count)
        </label>
        {err && <div style={{ fontSize: 12, color: "#C53030" }}>{err}</div>}
        <PrimaryButton onClick={submit}><CheckCircle2 size={15} /> Save reading</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Copy a year's plan into the next year
--------------------------------------------------------- */
function RollForwardModal({ year, lines, budgets, onClose, onApply }) {
  const [pct, setPct] = useState("3");
  const [caps, setCaps] = useState(true);
  const total = lines.reduce((t, l) => t + (Number(l.amount) || 0), 0);
  const f = 1 + (Number(pct) || 0) / 100;
  const hasCaps = budgets.some((b) => b.year === year);
  return (
    <Modal title={`Create the ${year + 1} plan`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>Copies all {lines.length} {year} plan lines to the same dates in {year + 1} (moved out of blackout periods), as planned with nothing spent. Lines for archived services are skipped, and lines already in {year + 1} aren't duplicated.</div>
        <Field label="Price uplift (%)">
          <TextInput type="number" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} />
          <span style={{ fontSize: 11, color: "#8A94A0" }}>e.g. CPI or your contracts' indexation clause. Use 0 to copy prices as they are.</span>
        </Field>
        {hasCaps && (
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4451", cursor: "pointer" }}>
            <input type="checkbox" checked={caps} onChange={(e) => setCaps(e.target.checked)} style={{ margin: 0 }} /> Also copy category budget caps (with the same uplift)
          </label>
        )}
        <div style={{ background: "#F7F8F9", borderRadius: 9, padding: "9px 11px", fontSize: 12.5 }}>
          {year}: <b>{gbp(total)}</b> → {year + 1}: <b>{gbp(total * f)}</b> <span style={{ color: "#8A94A0" }}>({(Number(pct) || 0) >= 0 ? "+" : ""}{gbp(total * f - total)})</span>
        </div>
        <PrimaryButton onClick={() => onApply(Number(pct) || 0, hasCaps && caps)}><CopyPlus size={15} /> Create {year + 1} plan</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Site tab: meters, spares and keys
--------------------------------------------------------- */
function SiteTab({ meters, spares, keys, audits, incidents, permits, waste, openPermits = 0, openIncidents = 0, counts = {} }) {
  const [view, setView] = useState("meters");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <ToggleButton active={view === "meters"} onClick={() => setView("meters")}>Meters</ToggleButton>
        <ToggleButton active={view === "spares"} onClick={() => setView("spares")}>Spares{counts.lowStock ? ` (${counts.lowStock} low)` : ""}</ToggleButton>
        <ToggleButton active={view === "keys"} onClick={() => setView("keys")}>Keys{counts.keysOut ? ` (${counts.keysOut} out)` : ""}</ToggleButton>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: -6, marginBottom: 12 }}>
        <ToggleButton active={view === "audits"} onClick={() => setView("audits")}>Audits</ToggleButton>
        <ToggleButton active={view === "incidents"} onClick={() => setView("incidents")}>Incidents{openIncidents ? ` (${openIncidents} open)` : ""}</ToggleButton>
        <ToggleButton active={view === "permits"} onClick={() => setView("permits")}>Permits{openPermits ? ` (${openPermits})` : ""}</ToggleButton>
        <ToggleButton active={view === "waste"} onClick={() => setView("waste")}>Waste</ToggleButton>
      </div>
      {view === "meters" && meters}
      {view === "spares" && spares}
      {view === "keys" && keys}
      {view === "audits" && audits}
      {view === "incidents" && incidents}
      {view === "permits" && permits}
      {view === "waste" && waste}
    </div>
  );
}

function SparesView({ spares, suppliers, devices, senderName, onSave, onAdjust, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null); // { spare, dir }
  const [q, setQ] = useState("");
  const low = (sp) => sp.minQty !== "" && sp.minQty != null && Number(sp.qty) <= Number(sp.minQty);
  const list = spares.filter((sp) => !q.trim() || [sp.name, sp.partNo, sp.store].filter(Boolean).some((v) => v.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (low(b) - low(a)) || a.name.localeCompare(b.name));
  const lowList = spares.filter(low);
  const value = spares.reduce((t, sp) => t + (Number(sp.qty) || 0) * (Number(sp.unitCost) || 0), 0);
  function reorderEmail() {
    const bySup = {};
    lowList.forEach((sp) => { (bySup[sp.supplierId || ""] = bySup[sp.supplierId || ""] || []).push(sp); });
    const [supId, items] = Object.entries(bySup)[0] || [];
    if (!items) return;
    const sup = suppliers.find((x) => x.id === supId);
    const lines = items.map((sp) => `- ${sp.name}${sp.partNo ? ` (part ${sp.partNo})` : ""}: please supply ${Math.max(1, (Number(sp.reorderQty) || Number(sp.minQty) * 2 || 1) - Number(sp.qty))}`);
    window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent("Spares order")}&body=${encodeURIComponent(`Hi,\n\nPlease could you quote / supply:\n\n${lines.join("\n")}\n\nKind regards,\n${senderName || ""}`)}`;
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spares…" style={{ flex: 1 }} />
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditing({})} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Plus size={14} /> Add</button>}
      </div>
      {spares.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: 12, color: "#5B6672" }}>{spares.length} items · stock value {gbp(value)}{lowList.length ? <b style={{ color: "#B7791F" }}> · {lowList.length} low</b> : null}</span>
          {lowList.length > 0 && ACTIVE_CAN_EDIT && <button onClick={reorderEmail} style={{ background: "#FDF1E0", color: "#8A5A0B", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Mail size={12} /> Reorder</button>}
          <ExportButton label="CSV" filename="spares.csv" rows={[["Item", "Part no.", "Qty", "Unit", "Reorder at", "Store", "Unit cost", "Supplier"], ...spares.map((sp) => [sp.name, sp.partNo || "", sp.qty, sp.unit || "", sp.minQty ?? "", sp.store || "", sp.unitCost || "", suppliers.find((x) => x.id === sp.supplierId)?.name || ""])]} />
        </div>
      )}
      {spares.length === 0 ? (
        <EmptyState icon={Package} title="No spares yet" body="Track filters, belts, lamps and other parts you keep on site, with a reorder level so you never run out." actionLabel={ACTIVE_CAN_EDIT ? "Add a spare part" : undefined} onAction={() => setEditing({})} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((sp) => (
            <div key={sp.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: low(sp) ? "3px solid #D97706" : "1px solid #E1E4E8", borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => ACTIVE_CAN_EDIT && setEditing(sp)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{sp.name}</div>
                <div style={{ fontSize: 11.3, color: "#8A94A0" }}>{[sp.partNo && `#${sp.partNo}`, sp.store, sp.deviceIds?.length ? `for ${sp.deviceIds.map((id) => devices.find((d) => d.id === id)?.name).filter(Boolean).join(", ")}` : null].filter(Boolean).join(" · ") || "—"}</div>
                {low(sp) && <div style={{ fontSize: 11, fontWeight: 700, color: "#B7791F" }}>Reorder — at or below {sp.minQty}</div>}
              </button>
              <div style={{ textAlign: "center", minWidth: 44 }}>
                <div style={{ fontSize: 18, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace", color: Number(sp.qty) <= 0 ? "#C53030" : "#1B2430" }}>{sp.qty}</div>
                <div style={{ fontSize: 10, color: "#8A94A0" }}>{sp.unit || "in stock"}</div>
              </div>
              {ACTIVE_CAN_EDIT && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => setAdjusting({ spare: sp, dir: 1 })} title="Add stock" style={{ background: "#EAF4EE", color: "#2F6B4A", border: "none", borderRadius: 7, width: 30, height: 26, fontWeight: 800, cursor: "pointer" }}>+</button>
                  <button onClick={() => setAdjusting({ spare: sp, dir: -1 })} title="Use stock" style={{ background: "#FBEAEA", color: "#9B2C2C", border: "none", borderRadius: 7, width: 30, height: 26, fontWeight: 800, cursor: "pointer" }}>−</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && <SpareModal existing={editing.id ? editing : null} suppliers={suppliers} devices={devices} onClose={() => setEditing(null)} onSave={(sp) => { onSave(sp); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
      {adjusting && <AdjustStockModal spare={adjusting.spare} dir={adjusting.dir} devices={devices} onClose={() => setAdjusting(null)} onSave={(delta, note) => { onAdjust(adjusting.spare.id, delta, note); setAdjusting(null); }} />}
    </div>
  );
}
function SpareModal({ existing, suppliers, devices, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || "");
  const [partNo, setPartNo] = useState(existing?.partNo || "");
  const [qty, setQty] = useState(existing?.qty != null ? String(existing.qty) : "0");
  const [unit, setUnit] = useState(existing?.unit || "");
  const [minQty, setMinQty] = useState(existing?.minQty != null ? String(existing.minQty) : "");
  const [reorderQty, setReorderQty] = useState(existing?.reorderQty != null ? String(existing.reorderQty) : "");
  const [store, setStore] = useState(existing?.store || "");
  const [unitCost, setUnitCost] = useState(existing?.unitCost != null ? String(existing.unitCost) : "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [deviceIds, setDeviceIds] = useState(existing?.deviceIds || []);
  return (
    <Modal title={existing ? "Edit spare" : "Add a spare part"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Item"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. G4 panel filter 592×592" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Part number"><TextInput value={partNo} onChange={(e) => setPartNo(e.target.value)} /></Field>
          <Field label="Stored in"><TextInput value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Plant room cage" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!existing && <Field label="Quantity now"><TextInput type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>}
          <Field label="Unit"><TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. each, box" /></Field>
          <Field label="Reorder at"><TextInput type="number" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} placeholder="e.g. 4" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Order up to (optional)"><TextInput type="number" min="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} placeholder="e.g. 12" /></Field>
          <Field label={`Unit cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></Field>
        </div>
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {devices.length > 0 && (
          <Field label="Used on (optional)">
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxHeight: 120, overflowY: "auto" }}>
              {devices.map((d) => <ToggleButton key={d.id} active={deviceIds.includes(d.id)} onClick={() => setDeviceIds((p) => p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id])}>{d.name}</ToggleButton>)}
            </div>
          </Field>
        )}
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), partNo: partNo.trim(), qty: existing ? existing.qty : Number(qty) || 0, unit: unit.trim(), minQty: minQty === "" ? null : Number(minQty), reorderQty: reorderQty === "" ? null : Number(reorderQty), store: store.trim(), unitCost: unitCost === "" ? null : Number(unitCost), supplierId: supplierId || null, deviceIds })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this spare" onConfirm={() => onDelete(existing.id)} />}
        {existing?.log?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Stock history</div>
            {existing.log.slice(0, 15).map((l, i) => (
              <div key={i} style={{ fontSize: 11.5, color: "#5B6672", display: "flex", gap: 6 }}>
                <b style={{ color: l.delta < 0 ? "#9B2C2C" : "#2F6B4A", minWidth: 34 }}>{l.delta > 0 ? "+" : ""}{l.delta}</b>
                <span style={{ flex: 1 }}>{l.note || ""}</span>
                <span>{l.by} · {fmtDate(l.at.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
function AdjustStockModal({ spare, dir, devices, onClose, onSave }) {
  const [n, setN] = useState("1");
  const [note, setNote] = useState("");
  const listId = useMemo(() => `adj-${uid()}`, []);
  return (
    <Modal title={`${dir > 0 ? "Add stock" : "Use stock"} — ${spare.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>In stock now: <b>{spare.qty} {spare.unit || ""}</b></div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="How many"><TextInput autoFocus type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Field label={dir > 0 ? "Note (e.g. delivery ref)" : "Used on"}>
            <TextInput list={listId} value={note} onChange={(e) => setNote(e.target.value)} placeholder={dir > 0 ? "e.g. Delivery DN-4412" : "e.g. AHU 3"} />
            <datalist id={listId}>{devices.map((d) => <option key={d.id} value={d.name} />)}</datalist>
          </Field>
        </div>
        <PrimaryButton onClick={() => Number(n) > 0 && onSave(dir * Number(n), note.trim())}>{dir > 0 ? "Add to stock" : "Take from stock"}</PrimaryButton>
      </div>
    </Modal>
  );
}
function ConfirmTextDelete({ label, onConfirm }) {
  const [c, setC] = useState(false);
  if (!ACTIVE_CAN_EDIT) return null;
  return c ? (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={onConfirm} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
      <button onClick={() => setC(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
    </div>
  ) : (
    <button onClick={() => setC(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}><Trash2 size={13} /> {label}</button>
  );
}

function KeysView({ keys, onSave, onIssue, onReturn, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [issuing, setIssuing] = useState(null);
  const [filter, setFilter] = useState("all");
  const list = keys.filter((k) => filter === "all" || (filter === "out" ? !!k.holder : !k.holder)).sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <ToggleButton active={filter === "all"} onClick={() => setFilter("all")}>All ({keys.length})</ToggleButton>
        <ToggleButton active={filter === "out"} onClick={() => setFilter("out")}>Issued ({keys.filter((k) => k.holder).length})</ToggleButton>
        <ToggleButton active={filter === "in"} onClick={() => setFilter("in")}>In</ToggleButton>
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditing({})} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Plus size={14} /></button>}
      </div>
      {keys.length === 0 ? (
        <EmptyState icon={Key} title="No keys or access cards yet" body="Keep track of plant room keys, riser keys and access cards — who has them and when they're due back." actionLabel={ACTIVE_CAN_EDIT ? "Add a key" : undefined} onAction={() => setEditing({})} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((k) => {
            const late = k.holder && k.dueBack && daysUntil(k.dueBack) < 0;
            return (
              <div key={k.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${late ? "#C53030" : k.holder ? "#D97706" : "#2F855A"}`, borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => ACTIVE_CAN_EDIT && setEditing(k)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{k.label}{k.number ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8A94A0", fontWeight: 600 }}> #{k.number}</span> : null}</div>
                  <div style={{ fontSize: 11.3, color: "#8A94A0" }}>{[k.type === "card" ? "Access card" : k.type === "fob" ? "Fob" : "Key", k.opens && `opens ${k.opens}`, k.kept && `kept in ${k.kept}`].filter(Boolean).join(" · ")}</div>
                  {k.holder ? (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: late ? "#C53030" : "#8A5A0B" }}>With {k.holder}{k.holderCompany ? ` (${k.holderCompany})` : ""} since {fmtDate(k.issuedAt?.slice(0, 10))}{k.dueBack ? ` · ${late ? "was due" : "due"} back ${fmtDate(k.dueBack)}` : ""}</div>
                  ) : <div style={{ fontSize: 11.5, fontWeight: 700, color: "#2F855A" }}>In</div>}
                </button>
                {ACTIVE_CAN_EDIT && (k.holder ? (
                  <button onClick={() => onReturn(k.id)} style={{ background: "#EAF4EE", color: "#2F6B4A", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Returned</button>
                ) : (
                  <button onClick={() => setIssuing(k)} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Issue</button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {editing && <KeyModal existing={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={(k) => { onSave(k); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
      {issuing && <IssueKeyModal k={issuing} onClose={() => setIssuing(null)} onSave={(h, c, d) => { onIssue(issuing.id, h, c, d); setIssuing(null); }} />}
    </div>
  );
}
function KeyModal({ existing, onClose, onSave, onDelete }) {
  const [label, setLabel] = useState(existing?.label || "");
  const [type, setType] = useState(existing?.type || "key");
  const [number, setNumber] = useState(existing?.number || "");
  const [opens, setOpens] = useState(existing?.opens || "");
  const [kept, setKept] = useState(existing?.kept || "");
  return (
    <Modal title={existing ? "Edit key" : "Add a key or card"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["key", "Key"], ["card", "Access card"], ["fob", "Fob"]].map(([k, l]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{l}</ToggleButton>)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Name"><TextInput autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Roof plant room" /></Field>
          <Field label="Number / tag"><TextInput value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. K14" /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Opens"><TextInput value={opens} onChange={(e) => setOpens(e.target.value)} placeholder="e.g. Riser cupboards L1–L4" /></Field>
          <Field label="Normally kept in"><TextInput value={kept} onChange={(e) => setKept(e.target.value)} placeholder="e.g. Reception key safe" /></Field>
        </div>
        <PrimaryButton onClick={() => label.trim() && onSave({ id: existing?.id, label: label.trim(), type, number: number.trim(), opens: opens.trim(), kept: kept.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this key" onConfirm={() => onDelete(existing.id)} />}
        {existing?.log?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>History</div>
            {existing.log.slice(0, 20).map((l, i) => <div key={i} style={{ fontSize: 11.5, color: "#5B6672" }}>{fmtDate(l.at.slice(0, 10))} · {l.action === "issued" ? "Issued to" : "Returned by"} {l.holder}{l.holderCompany ? ` (${l.holderCompany})` : ""} · {l.by}</div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}
function IssueKeyModal({ k, onClose, onSave }) {
  const [holder, setHolder] = useState("");
  const [company, setCompany] = useState("");
  const [dueBack, setDueBack] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Modal title={`Issue — ${k.label}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Given to"><TextInput autoFocus value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Name" /></Field>
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="optional" /></Field>
        </div>
        <Field label="Due back"><TextInput type="date" value={dueBack} onChange={(e) => setDueBack(e.target.value)} /></Field>
        <PrimaryButton onClick={() => holder.trim() && onSave(holder.trim(), company.trim(), dueBack || null)}><Key size={15} /> Issue key</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Reminders / to-do on Home
--------------------------------------------------------- */
function RemindersCard({ reminders, users, onAdd, onToggle, onDelete }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [showDone, setShowDone] = useState(false);
  const open = reminders.filter((r) => !r.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const done = reminders.filter((r) => r.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  function add() { if (!text.trim()) return; onAdd({ text: text.trim(), due: due || (repeat !== "none" ? new Date().toISOString().slice(0, 10) : null), assignee: assignee || null, repeat }); setText(""); setDue(""); setAssignee(""); setRepeat("none"); }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <ListTodo size={18} color="#2B4562" />
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Reminders{open.length ? ` (${open.length})` : ""}</div>
      </div>
      {ACTIVE_CAN_EDIT && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: open.length ? 8 : 0 }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="e.g. Chase insurer about roof leak claim" />
          {text.trim() && (
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ flex: 1 }} />
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ flex: 1 }}>
                <option value="">For anyone</option>
                {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </Select>
            </div>
          )}
          {text.trim() && (
            <div style={{ display: "flex", gap: 6 }}>
              <Select value={repeat} onChange={(e) => setRepeat(e.target.value)} style={{ flex: 1 }}>
                {Object.entries(REPEAT_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <button onClick={add} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          )}
        </div>
      )}
      {open.map((r) => {
        const n = r.due ? daysUntil(r.due) : null;
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderTop: "1px solid #EEF0F2" }}>
            <button onClick={() => ACTIVE_CAN_EDIT && onToggle(r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", marginTop: 1 }}><Square size={17} color="#8A94A0" /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.8, fontWeight: 600 }}>{r.text}</div>
              <div style={{ fontSize: 10.8, color: n !== null && n < 0 ? "#C53030" : n === 0 ? "#B7791F" : "#8A94A0", fontWeight: n !== null && n <= 0 ? 700 : 500 }}>
                {r.due ? (n < 0 ? `Overdue — ${fmtDate(r.due)}` : n === 0 ? "Today" : `Due ${fmtDate(r.due)}`) : "No date"}{r.assignee ? ` · ${r.assignee}` : ""}{r.repeat && r.repeat !== "none" ? ` · repeats ${REPEAT_OPTIONS[r.repeat].toLowerCase()}` : ""}
              </div>
            </div>
            <ConfirmDeleteButton onConfirm={() => onDelete(r.id)} size={12} />
          </div>
        );
      })}
      {done.length > 0 && <button onClick={() => setShowDone((v) => !v)} style={{ background: "none", border: "none", color: "#8A94A0", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>{showDone ? "Hide" : "Show"} {done.length} done</button>}
      {showDone && done.slice(0, 20).map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", opacity: 0.65 }}>
          <button onClick={() => ACTIVE_CAN_EDIT && onToggle(r.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}><CheckSquare size={17} color="#2F855A" /></button>
          <span style={{ flex: 1, fontSize: 12.5, textDecoration: "line-through" }}>{r.text}</span>
          <span style={{ fontSize: 10.5, color: "#8A94A0" }}>{r.doneBy}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   Bulk changes for selected services
--------------------------------------------------------- */
function BulkActionsModal({ locations = [], count, suppliers, areas, onClose, onApply }) {
  const [copyTo, setCopyTo] = useState(locations[0]?.id || "");
  const [pauseUntil, setPauseUntil] = useState(addMonths(new Date().toISOString().slice(0, 10), 1));
  const [assignTo, setAssignTo] = useState(ACTIVE_USERS[0]?.name || "");
  const [action, setAction] = useState("reschedule");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState("");
  const [area, setArea] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const listId = useMemo(() => `bulkarea-${uid()}`, []);
  return (
    <Modal title={`Change ${count} service${count === 1 ? "" : "s"}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["reschedule", "Move due date"], ["supplier", "Set supplier"], ...(ACTIVE_USERS.length ? [["assign", "Assign to"]] : []), ["area", "Set area"], ["pause", "Pause"], ["qr", "Print QR stickers"], ...(locations.length ? [["copy", "Copy to site"]] : []), ["archive", "Archive"]].map(([k, l]) => <ToggleButton key={k} active={action === k} onClick={() => { setAction(k); setConfirmArchive(false); }}>{l}</ToggleButton>)}
        </div>
        {action === "reschedule" && (
          <>
            <Field label="New next-due date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Matching planned visits and unspent Budget Plan lines move too. Each move is recorded in the service's reschedule history.</div>
            <PrimaryButton onClick={() => date && onApply("reschedule", date)}><Calendar size={15} /> Move {count} service{count === 1 ? "" : "s"}</PrimaryButton>
          </>
        )}
        {action === "supplier" && (
          <>
            <Field label="Default supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <PrimaryButton onClick={() => onApply("supplier", supplierId)}><UsersIcon size={15} /> Apply to {count}</PrimaryButton>
          </>
        )}
        {action === "area" && (
          <>
            <Field label="Area / room">
              <TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Roof" />
              <datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <PrimaryButton onClick={() => onApply("area", area.trim())}><MapPin size={15} /> Apply to {count}</PrimaryButton>
          </>
        )}
        {action === "assign" && (
          <>
            <Field label="Responsible person">
              <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">— Nobody —</option>
                {ACTIVE_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </Select>
            </Field>
            <PrimaryButton onClick={() => onApply("assign", assignTo)}><UserCheck size={15} /> Assign {count}</PrimaryButton>
          </>
        )}
        {action === "pause" && (
          <>
            <Field label="Pause until"><TextInput type="date" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} /></Field>
            <div style={{ fontSize: 12, color: "#5B6672" }}>No overdue alerts until then; planned visits and unspent budget lines inside the pause are removed. Useful when an area is closed or being refurbished.</div>
            <PrimaryButton onClick={() => pauseUntil && onApply("pause", { until: pauseUntil, drop: true })}><PauseCircle size={15} /> Pause {count}</PrimaryButton>
          </>
        )}
        {action === "qr" && (
          <>
            <div style={{ fontSize: 12, color: "#5B6672" }}>Prints a sheet with two small stickers per service: "Report a problem" for anyone, and "Staff: service record" for your team.</div>
            <PrimaryButton onClick={() => onApply("qr")}><QrCode size={15} /> Print {count * 2} stickers</PrimaryButton>
          </>
        )}
        {action === "copy" && (
          <>
            <Field label="Copy to">
              <Select value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select>
            </Field>
            <div style={{ fontSize: 12, color: "#5B6672" }}>Creates matching services at that site — same names, categories, checklists, schedules and safety notes, without history, photos, asset tags or serial numbers. Handy when opening a new site.</div>
            <PrimaryButton onClick={() => copyTo && onApply("copy", copyTo)}><MapPinned size={15} /> Copy {count} service{count === 1 ? "" : "s"}</PrimaryButton>
          </>
        )}
        {action === "archive" && (
          confirmArchive ? (
            <button onClick={() => onApply("archive")} style={{ background: "#9B2C2C", color: "#fff", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, archive {count} service{count === 1 ? "" : "s"}</button>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#5B6672" }}>Archived services keep their history but leave day-to-day lists; future planned visits and unspent budget lines are removed. You can undo straight after.</div>
              <PrimaryButton onClick={() => setConfirmArchive(true)}><Archive size={15} /> Archive {count}…</PrimaryButton>
            </>
          )
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Import services from a spreadsheet (CSV or pasted cells)
--------------------------------------------------------- */
function parseDelimited(text) {
  const first = text.split(/\r?\n/)[0] || "";
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}
const IMPORT_FIELDS = [
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
];
function toISO(v) {
  const t = String(v || "").trim(); if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return null;
}
function ImportModal({ suppliers, existing, onClose, onImport }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const rows = useMemo(() => (text.trim() ? parseDelimited(text) : []), [text]);
  const header = rows[0] || [];
  const map = useMemo(() => {
    const m = {};
    header.forEach((h, i) => {
      const k = String(h).trim().toLowerCase().replace(/[_*]/g, " ").replace(/\s+/g, " ");
      const f = IMPORT_FIELDS.find((f) => f.aliases.includes(k) || f.label.toLowerCase() === k);
      if (f && m[f.key] === undefined) m[f.key] = i;
    });
    return m;
  }, [text]);
  const catKey = (v) => { const t = String(v || "").trim().toLowerCase(); if (!t) return "maintenance"; return CATEGORY_KEYS.find((k) => k === t || CATEGORY_META[k].label.toLowerCase() === t) || "maintenance"; };
  const existingNames = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  const parsed = rows.slice(1).map((r) => {
    const get = (k) => (map[k] !== undefined ? String(r[map[k]] ?? "").trim() : "");
    const supName = get("supplier");
    const sup = supName ? suppliers.find((s) => s.name.trim().toLowerCase() === supName.toLowerCase()) : null;
    const issues = [];
    if (!get("name")) issues.push("no name");
    if (get("nextServiceDate") && !toISO(get("nextServiceDate"))) issues.push("date not recognised");
    if (supName && !sup) issues.push(`supplier "${supName}" not found`);
    if (get("name") && existingNames.has(get("name").toLowerCase())) issues.push("already exists");
    const interval = Number(get("serviceIntervalMonths")) || null;
    return {
      issues, skip: !get("name"),
      device: {
        name: get("name"), assetTag: get("assetTag"), serviceCategory: catKey(get("serviceCategory")), subCategory: get("subCategory"), category: get("category"),
        area: get("area"), supplierId: sup?.id || null, serviceIntervalMonths: interval, nextServiceDate: toISO(get("nextServiceDate")),
        budgetPerVisit: Number(String(get("budgetPerVisit")).replace(/[£$€,]/g, "")) || 0, manufacturer: get("manufacturer"), model: get("model"),
        serialNumber: get("serialNumber"), installDate: toISO(get("installDate")),
      },
    };
  });
  const good = parsed.filter((p) => !p.skip);
  function readFile(e) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { setErr("Please save the sheet as CSV first (File → Save as → CSV), or copy the cells and paste them below."); return; }
    const r = new FileReader(); r.onload = () => { setErr(""); setText(String(r.result)); }; r.readAsText(f);
  }
  function template() {
    downloadBlob(new Blob([toCSV([IMPORT_FIELDS.map((f) => f.label), ["Emergency lighting test", "EL-01", "Maintenance", "", "Emergency lighting", "Ground floor", suppliers[0]?.name || "", "1", "01/11/2026", "45", "", "", "", ""]])], { type: "text/csv" }), "services-import-template.csv");
  }
  return (
    <Modal title="Import services" onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>Bring in your asset register in one go. Upload a CSV, or copy the cells from Excel / Google Sheets (including the header row) and paste them below. Only a <b>Service name</b> column is required.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#2B4562", color: "#fff", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Upload size={14} /> Choose CSV file
            <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" onChange={readFile} style={{ display: "none" }} />
          </label>
          <button onClick={template} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Download size={14} /> Template</button>
        </div>
        <TextArea value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} placeholder="…or paste cells here" style={{ minHeight: 80, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
        {err && <div style={{ fontSize: 12, color: "#C53030" }}>{err}</div>}
        {rows.length > 0 && (
          <>
            <div style={{ fontSize: 11.5, color: "#5B6672" }}>
              Columns recognised: {Object.keys(map).length ? IMPORT_FIELDS.filter((f) => map[f.key] !== undefined).map((f) => f.label).join(", ") : <b style={{ color: "#C53030" }}>none — check the header row</b>}
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #E1E4E8", borderRadius: 9 }}>
              {parsed.slice(0, 200).map((p, i) => (
                <div key={i} style={{ padding: "6px 9px", borderTop: i ? "1px solid #EEF0F2" : "none", fontSize: 12, opacity: p.skip ? 0.5 : 1 }}>
                  <b>{p.device.name || "(no name)"}</b>
                  <span style={{ color: "#8A94A0" }}> · {CATEGORY_META[p.device.serviceCategory]?.label}{p.device.area ? ` · ${p.device.area}` : ""}{p.device.serviceIntervalMonths ? ` · every ${p.device.serviceIntervalMonths} mo` : ""}{p.device.nextServiceDate ? ` · due ${fmtDate(p.device.nextServiceDate)}` : ""}{p.device.budgetPerVisit ? ` · ${gbp(p.device.budgetPerVisit)}` : ""}</span>
                  {p.issues.length > 0 && <div style={{ color: p.skip ? "#C53030" : "#B7791F", fontSize: 11 }}>{p.issues.join(" · ")}</div>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#8A94A0" }}>Services with an interval, next due date and budget per visit also get a year of planned visits in the Budget Plan. Unknown suppliers are left blank — add them in Suppliers first to link them.</div>
            <PrimaryButton onClick={() => good.length && onImport(good.map((p) => p.device))} style={{ opacity: good.length ? 1 : 0.5 }}><FileSpreadsheet size={15} /> Import {good.length} service{good.length === 1 ? "" : "s"}</PrimaryButton>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Audits (cleaning, washroom, walk-round) with scores
--------------------------------------------------------- */
function scoreTone(p) { return p >= 85 ? ["#2F855A", "#EAF4EE"] : p >= 70 ? ["#B7791F", "#FDF1E0"] : ["#C53030", "#FBEAEA"]; }
function AuditsView({ audits, templates, suppliers, areas, locationName, senderName, onSave, onDelete, onSaveTemplates }) {
  const [editing, setEditing] = useState(null);
  const [editTemplates, setEditTemplates] = useState(false);
  const sorted = [...audits].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const byTemplate = {};
  sorted.forEach((a) => { (byTemplate[a.templateName] = byTemplate[a.templateName] || []).push(a); });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><ClipboardCheck size={15} /> New audit</PrimaryButton>}
        {ACTIVE_CAN_EDIT && <button onClick={() => setEditTemplates(true)} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Templates</button>}
      </div>
      {Object.keys(byTemplate).length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, overflowX: "auto" }}>
          {Object.entries(byTemplate).map(([name, list]) => {
            const last6 = list.slice(0, 6); const avg = Math.round(last6.reduce((t, a) => t + a.score, 0) / last6.length);
            const [fg] = scoreTone(avg);
            return (
              <div key={name} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "9px 11px", minWidth: 140 }}>
                <div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 650 }}>{name}</div>
                <div style={{ fontSize: 18, fontWeight: 750, color: fg, fontFamily: "'IBM Plex Mono', monospace" }}>{avg}%</div>
                <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 20, marginTop: 3 }}>
                  {[...last6].reverse().map((a) => <div key={a.id} title={`${fmtDate(a.date)} ${a.score}%`} style={{ width: 8, height: Math.max(3, a.score / 5), background: scoreTone(a.score)[0], borderRadius: 2 }} />)}
                </div>
                <div style={{ fontSize: 10, color: "#8A94A0" }}>avg of last {last6.length}</div>
              </div>
            );
          })}
        </div>
      )}
      {sorted.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No audits yet" body="Score cleaning, washrooms or a site walk-round item by item. Results build a trend per supplier you can share with them." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((a) => {
            const [fg, bg] = scoreTone(a.score);
            return (
              <button key={a.id} onClick={() => setEditing(a)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.templateName}{a.area ? ` — ${a.area}` : ""}</div>
                  <div style={{ fontSize: 11.3, color: "#8A94A0" }}>{fmtDate(a.date)} · {a.by || ""}{a.supplierId ? ` · ${suppliers.find((s) => s.id === a.supplierId)?.name || ""}` : ""}{a.items.filter((i) => i.score !== null && i.score <= 2).length ? ` · ${a.items.filter((i) => i.score !== null && i.score <= 2).length} poor` : ""}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: fg, background: bg, borderRadius: 10, padding: "4px 10px", fontFamily: "'IBM Plex Mono', monospace" }}>{a.score}%</span>
              </button>
            );
          })}
        </div>
      )}
      {editing && <AuditModal existing={editing.id ? editing : null} templates={templates} suppliers={suppliers} areas={areas} locationName={locationName} senderName={senderName} onClose={() => setEditing(null)} onSave={(a) => { onSave(a); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
      {editTemplates && <AuditTemplatesModal templates={templates} onClose={() => setEditTemplates(false)} onSave={(t) => { onSaveTemplates(t); setEditTemplates(false); }} />}
    </div>
  );
}
function AuditModal({ existing, templates, suppliers, areas, locationName, senderName, onClose, onSave, onDelete }) {
  const [templateId, setTemplateId] = useState(existing?.templateId || templates[0]?.id || "");
  const tpl = templates.find((t) => t.id === templateId);
  const [items, setItems] = useState(existing?.items || (tpl?.items || []).map((item) => ({ item, score: null, note: "" })));
  const [area, setArea] = useState(existing?.area || "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(existing?.supplierId || (templateId === "cleaning" ? suppliers.find((s) => s.category === "cleaning")?.id || "" : ""));
  const [notes, setNotes] = useState(existing?.notes || "");
  const listId = useMemo(() => `aud-${uid()}`, []);
  function pickTemplate(id) { setTemplateId(id); const t = templates.find((x) => x.id === id); setItems((t?.items || []).map((item) => ({ item, score: null, note: "" }))); if (id === "cleaning" && !supplierId) setSupplierId(suppliers.find((s) => s.category === "cleaning")?.id || ""); }
  const scored = items.filter((i) => i.score !== null);
  const score = scored.length ? Math.round((scored.reduce((t, i) => t + i.score, 0) / (scored.length * 5)) * 100) : 0;
  const payload = () => ({ id: existing?.id, templateId, templateName: tpl?.name || existing?.templateName || "Audit", area: area.trim(), date, supplierId: supplierId || null, items, notes: notes.trim(), score });
  function email() {
    const sup = suppliers.find((s) => s.id === supplierId);
    const poor = items.filter((i) => i.score !== null && i.score <= 2);
    const body = `Hi${sup?.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\n${tpl?.name || "Audit"} at ${locationName}${area ? ` — ${area}` : ""} on ${fmtDate(date)}: ${score}%.\n\n${items.map((i) => `${i.item}: ${i.score === null ? "N/A" : `${i.score}/5`}${i.note ? ` — ${i.note}` : ""}`).join("\n")}\n\n${poor.length ? `Please address the ${poor.length} item${poor.length === 1 ? "" : "s"} scored 2 or below and confirm when done.\n\n` : ""}${notes ? `Notes: ${notes}\n\n` : ""}Kind regards,\n${senderName || ""}`;
    window.location.href = `mailto:${encodeURIComponent(sup?.managerEmail || "")}?subject=${encodeURIComponent(`${tpl?.name || "Audit"} result — ${score}% — ${fmtDate(date)}`)}&body=${encodeURIComponent(body)}`;
  }
  return (
    <Modal title={existing ? "Audit" : "New audit"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!existing && (
          <Field label="Audit type">
            <Select value={templateId} onChange={(e) => pickTemplate(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          </Field>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Area"><TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Level 2" /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Supplier being audited (optional)">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <div style={{ fontSize: 11.5, color: "#8A94A0" }}>Score each item 0 (very poor) to 5 (excellent), or N/A.</div>
        {items.map((it, i) => (
          <div key={i} style={{ background: "#F7F8F9", borderRadius: 9, padding: "8px 9px" }}>
            <div style={{ fontSize: 12.8, fontWeight: 650, marginBottom: 5 }}>{it.item}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2, 3, 4, 5].map((n) => {
                const on = it.score === n; const [fg, bg] = scoreTone(n * 20);
                return <button key={n} onClick={() => setItems((p) => p.map((x, j) => j === i ? { ...x, score: n } : x))} style={{ flex: 1, background: on ? fg : "#fff", color: on ? "#fff" : "#5B6672", border: `1px solid ${on ? fg : "#D7DCE1"}`, borderRadius: 7, padding: "6px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>;
              })}
              <button onClick={() => setItems((p) => p.map((x, j) => j === i ? { ...x, score: null } : x))} style={{ flex: 1.3, background: it.score === null ? "#5B6672" : "#fff", color: it.score === null ? "#fff" : "#5B6672", border: "1px solid #D7DCE1", borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>N/A</button>
            </div>
            {it.score !== null && it.score <= 2 && <TextInput value={it.note} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="What's wrong?" style={{ width: "100%", marginTop: 6, fontSize: 12.5 }} />}
          </div>
        ))}
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", color: scoreTone(score)[0] }}>Score: {scored.length ? `${score}%` : "—"} <span style={{ fontSize: 11.5, color: "#8A94A0", fontWeight: 600 }}>({scored.length} of {items.length} scored)</span></div>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => scored.length && onSave(payload())}><CheckCircle2 size={15} /> Save audit</PrimaryButton>}
        {existing && <button onClick={email} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Mail size={14} /> Email result to supplier</button>}
        {existing && <ConfirmTextDelete label="Delete this audit" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
function AuditTemplatesModal({ templates, onClose, onSave }) {
  const [list, setList] = useState(templates.map((t) => ({ ...t, text: t.items.join("\n") })));
  return (
    <Modal title="Audit templates" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, color: "#5B6672" }}>One item per line. Changes apply to new audits only.</div>
        {list.map((t, i) => (
          <div key={t.id} style={{ background: "#F7F8F9", borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput value={t.name} onChange={(e) => setList((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1, fontWeight: 700 }} />
              {list.length > 1 && <button onClick={() => setList((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color="#C0C6CC" /></button>}
            </div>
            <TextArea value={t.text} onChange={(e) => setList((p) => p.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} style={{ minHeight: 90, fontSize: 12.5 }} />
          </div>
        ))}
        <button onClick={() => setList((p) => [...p, { id: `t_${uid()}`, name: "New audit", text: "" }])} style={{ background: "none", border: "1px dashed #C7D0DA", borderRadius: 9, padding: 9, fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>+ Add a template</button>
        <PrimaryButton onClick={() => onSave(list.map(({ text, ...t }) => ({ ...t, items: text.split("\n").map((x) => x.trim()).filter(Boolean) })).filter((t) => t.items.length))}><CheckCircle2 size={15} /> Save templates</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Incident & near-miss log
--------------------------------------------------------- */
function IncidentsView({ incidents, areas, locationName, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("open");
  const list = incidents.filter((i) => filter === "all" || (filter === "open" ? i.status !== "closed" : i.status === "closed")).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const yr = String(new Date().getFullYear());
  const thisYear = incidents.filter((i) => String(i.date).startsWith(yr));
  const csv = [["Date", "Time", "Type", "Area", "Description", "Person involved", "Action taken", "RIDDOR", "RIDDOR reported", "Status", "Reported by"], ...incidents.map((i) => [i.date, i.time || "", INCIDENT_TYPES[i.type] || "", i.area || "", i.description || "", i.person || "", i.actions || "", i.riddor ? "Yes" : "No", i.riddorReported ? "Yes" : "", i.status || "open", i.reportedBy || ""])];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <ToggleButton active={filter === "open"} onClick={() => setFilter("open")}>Open ({incidents.filter((i) => i.status !== "closed").length})</ToggleButton>
        <ToggleButton active={filter === "closed"} onClick={() => setFilter("closed")}>Closed</ToggleButton>
        <ToggleButton active={filter === "all"} onClick={() => setFilter("all")}>All</ToggleButton>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Siren size={15} /> Log incident / near miss</PrimaryButton>}
        {incidents.length > 0 && <ExportButton label="CSV" filename="incident-log.csv" rows={csv} />}
      </div>
      {thisYear.length > 0 && <div style={{ fontSize: 11.5, color: "#5B6672", marginBottom: 8 }}>{yr}: {Object.entries(INCIDENT_TYPES).map(([k, v]) => [v, thisYear.filter((i) => i.type === k).length]).filter(([, n]) => n).map(([v, n]) => `${n} ${v.toLowerCase()}`).join(" · ")}</div>}
      {list.length === 0 ? (
        <EmptyState icon={Siren} title={filter === "open" ? "No open incidents" : "Nothing here"} body="Record accidents, near misses, property damage, spills and security issues — with actions taken and a RIDDOR reminder where needed." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((i) => (
            <button key={i.id} onClick={() => setEditing(i)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${i.type === "injury" ? "#C53030" : i.type === "near_miss" ? "#D97706" : "#2B4562"}`, borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{INCIDENT_TYPES[i.type]}{i.area ? ` — ${i.area}` : ""}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: i.status === "closed" ? "#2F855A" : "#B7791F" }}>{i.status === "closed" ? "Closed" : "Open"}</span>
              </div>
              <div style={{ fontSize: 11.3, color: "#8A94A0" }}>{fmtDate(i.date)}{i.time ? ` ${i.time}` : ""} · {i.reportedBy || ""}{i.riddor ? <b style={{ color: i.riddorReported ? "#2F855A" : "#C53030" }}> · RIDDOR {i.riddorReported ? "reported" : "to report"}</b> : null}</div>
              <div style={{ fontSize: 12.5, color: "#3A4451", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.description}</div>
            </button>
          ))}
        </div>
      )}
      {editing && <IncidentModal existing={editing.id ? editing : null} areas={areas} locationName={locationName} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function IncidentModal({ existing, areas, locationName, onClose, onSave, onDelete }) {
  const [type, setType] = useState(existing?.type || "near_miss");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(existing?.time || new Date().toTimeString().slice(0, 5));
  const [area, setArea] = useState(existing?.area || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [person, setPerson] = useState(existing?.person || "");
  const [actions, setActions] = useState(existing?.actions || "");
  const [riddor, setRiddor] = useState(!!existing?.riddor);
  const [riddorReported, setRiddorReported] = useState(!!existing?.riddorReported);
  const [status, setStatus] = useState(existing?.status || "open");
  const listId = useMemo(() => `inc-${uid()}`, []);
  function print() {
    const e = escapeHtml;
    openPrintReport(`Incident report — ${INCIDENT_TYPES[type]}`, `${locationName} · ${fmtDate(date)} ${time}`, tableHtml(["Field", "Detail"], [["Type", INCIDENT_TYPES[type]], ["Date & time", `${fmtDate(date)} ${time}`], ["Area", area], ["What happened", description], ["Person involved", person], ["Action taken / to prevent recurrence", actions], ["RIDDOR reportable", riddor ? (riddorReported ? "Yes — reported" : "Yes — NOT yet reported") : "No"], ["Status", status], ["Reported by", existing?.reportedBy || ""]].map(([a, b]) => [e(a), e(b || "").replace(/\n/g, "<br>")])));
  }
  return (
    <Modal title={existing ? "Incident" : "Log an incident"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Object.entries(INCIDENT_TYPES).map(([k, v]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{v}</ToggleButton>)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Where"><TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Loading bay" /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
        <Field label="What happened"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the incident and any immediate cause" /></Field>
        {type === "injury" && <Field label="Person involved (name / company)"><TextInput value={person} onChange={(e) => setPerson(e.target.value)} /></Field>}
        <Field label="Action taken / to prevent it happening again"><TextArea value={actions} onChange={(e) => setActions(e.target.value)} /></Field>
        {(type === "injury" || type === "environmental" || riddor) && (
          <div style={{ background: "#FDF1E0", borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, fontWeight: 650, cursor: "pointer" }}><input type="checkbox" checked={riddor} onChange={(e) => setRiddor(e.target.checked)} style={{ margin: 0 }} /> RIDDOR reportable</label>
            {riddor && <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, fontWeight: 650, cursor: "pointer" }}><input type="checkbox" checked={riddorReported} onChange={(e) => setRiddorReported(e.target.checked)} style={{ margin: 0 }} /> Reported to the HSE</label>}
            <span style={{ fontSize: 10.8, color: "#8A5A0B" }}>Examples: specified injuries, over-7-day incapacitation, dangerous occurrences. Check the HSE RIDDOR guidance if unsure.</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={status === "open"} onClick={() => setStatus("open")}>Open</ToggleButton>
          <ToggleButton active={status === "closed"} onClick={() => setStatus("closed")}>Closed</ToggleButton>
        </div>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => description.trim() && onSave({ id: existing?.id, type, date, time, area: area.trim(), description: description.trim(), person: person.trim(), actions: actions.trim(), riddor, riddorReported, status })}><CheckCircle2 size={15} /> Save</PrimaryButton>}
        {existing && <button onClick={print} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print incident report</button>}
        {existing && <ConfirmTextDelete label="Delete this incident" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Capital projects
--------------------------------------------------------- */
function ProjectsView({ projects, devices, suppliers, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const list = projects.filter((p) => showDone || p.status !== "complete").sort((a, b) => (a.target || "9999").localeCompare(b.target || "9999"));
  const active = projects.filter((p) => ["approved", "in_progress"].includes(p.status));
  const budget = active.reduce((t, p) => t + (Number(p.budget) || 0), 0);
  const spent = active.reduce((t, p) => t + (Number(p.spent) || 0), 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Approved & live budget</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(budget)}</div></div>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: "9px 11px" }}><div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>Spent so far</div><div style={{ fontSize: 16, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace", color: spent > budget ? "#C53030" : "#1B2430" }}>{gbp(spent)}</div></div>
      </div>
      {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ marginBottom: 10, width: "100%" }}><FolderKanban size={15} /> New project</PrimaryButton>}
      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" body="Track bigger one-off jobs — plant replacements, refurbishments, upgrades — with budget, spend, target date and milestones." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((p) => {
            const st = PROJECT_STATUSES.find((s) => s.key === p.status) || PROJECT_STATUSES[0];
            const pct = Number(p.budget) ? Math.round((Number(p.spent) || 0) / Number(p.budget) * 100) : null;
            const ms = p.milestones || []; const late = p.target && daysUntil(p.target) < 0 && p.status !== "complete";
            return (
              <button key={p.id} onClick={() => setEditing(p)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${st.color}`, borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 11.3, color: late ? "#C53030" : "#8A94A0", fontWeight: late ? 700 : 500 }}>
                  {p.target ? `${late ? "Was due" : "Target"} ${fmtDate(p.target)}` : "No target date"}{ms.length ? ` · ${ms.filter((m) => m.done).length}/${ms.length} milestones` : ""}{p.supplierId ? ` · ${suppliers.find((s) => s.id === p.supplierId)?.name || ""}` : ""}
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 6, background: "#E1E4E8", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 100 ? "#C53030" : "#2F855A" }} /></div>
                    <div style={{ fontSize: 11, color: "#5B6672", marginTop: 2 }}>{gbp(p.spent || 0)} of {gbp(p.budget)} ({pct}%)</div>
                  </div>
                )}
              </button>
            );
          })}
          {projects.some((p) => p.status === "complete") && <button onClick={() => setShowDone((v) => !v)} style={{ background: "none", border: "none", color: "#8A94A0", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{showDone ? "Hide" : "Show"} completed projects</button>}
        </div>
      )}
      {editing && <ProjectModal existing={editing.id ? editing : null} devices={devices} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(x) => { onSave(x); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function ProjectModal({ existing, devices, suppliers, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || "");
  const [status, setStatus] = useState(existing?.status || "idea");
  const [budget, setBudget] = useState(existing?.budget ? String(existing.budget) : "");
  const [spent, setSpent] = useState(existing?.spent ? String(existing.spent) : "");
  const [start, setStart] = useState(existing?.start || "");
  const [target, setTarget] = useState(existing?.target || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [deviceIds, setDeviceIds] = useState(existing?.deviceIds || []);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [milestones, setMilestones] = useState(existing?.milestones || []);
  const [newMs, setNewMs] = useState("");
  const suggested = devices.filter((d) => replacementYear(d) && replacementYear(d) <= new Date().getFullYear() + 1 && !deviceIds.includes(d.id));
  return (
    <Modal title={existing ? "Project" : "New project"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Project name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Replace AHU 3" /></Field>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{PROJECT_STATUSES.map((s) => <ToggleButton key={s.key} active={status === s.key} onClick={() => setStatus(s.key)}>{s.label}</ToggleButton>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label={`Budget (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label={`Spent (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" value={spent} onChange={(e) => setSpent(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Start"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Target completion"><TextInput type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        </div>
        <Field label="Contractor">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">— None yet —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Related services / assets">
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {deviceIds.map((id) => <ToggleButton key={id} active onClick={() => setDeviceIds((p) => p.filter((x) => x !== id))}>{devices.find((d) => d.id === id)?.name || "?"} ✕</ToggleButton>)}
            <select value="" onChange={(e) => e.target.value && setDeviceIds((p) => [...p, e.target.value])} style={{ ...inputStyle, padding: "7px 8px", fontSize: 12.5 }}>
              <option value="">+ Link a service…</option>
              {devices.filter((d) => !deviceIds.includes(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {!existing && suggested.length > 0 && <span style={{ fontSize: 11, color: "#5B21B6" }}>Due for replacement soon: {suggested.slice(0, 4).map((d) => d.name).join(", ")}</span>}
        </Field>
        <Field label="Milestones">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {milestones.map((m, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}>
                <input type="checkbox" checked={!!m.done} onChange={(e) => setMilestones((p) => p.map((x, j) => j === i ? { ...x, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString().slice(0, 10) : null } : x))} style={{ margin: 0 }} />
                <span style={{ flex: 1, textDecoration: m.done ? "line-through" : "none" }}>{m.text}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); setMilestones((p) => p.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={12} color="#A3ABB4" /></button>
              </label>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <TextInput value={newMs} onChange={(e) => setNewMs(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newMs.trim()) { setMilestones((p) => [...p, { text: newMs.trim(), done: false }]); setNewMs(""); } }} placeholder="e.g. Quotes received" style={{ flex: 1 }} />
              <button type="button" onClick={() => { if (newMs.trim()) { setMilestones((p) => [...p, { text: newMs.trim(), done: false }]); setNewMs(""); } }} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          </div>
        </Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), status, budget: budget ? Number(budget) : 0, spent: spent ? Number(spent) : 0, start: start || null, target: target || null, supplierId: supplierId || null, deviceIds, notes: notes.trim(), milestones })}><CheckCircle2 size={15} /> Save project</PrimaryButton>}
        {existing && <ConfirmTextDelete label="Delete this project" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Cost per year for one asset — repair vs replace
--------------------------------------------------------- */
function CostHistory({ device, services, works }) {
  const y0 = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => y0 - 4 + i);
  const per = years.map((y) => {
    const ppm = services.filter((v) => String(v.date).startsWith(String(y))).reduce((t, v) => t + (Number(v.cost) || 0), 0);
    const reactive = works.filter((w) => String(w.dateRaised).startsWith(String(y)) && ["approved", "in_progress", "completed"].includes(w.status)).reduce((t, w) => t + (Number(w.quoteAmount) || 0), 0);
    return { y, ppm, reactive, total: ppm + reactive };
  });
  const max = Math.max(1, ...per.map((p) => p.total));
  if (per.every((p) => p.total === 0)) return null;
  const since = addDays(new Date().toISOString().slice(0, 10), -365);
  const reactive12 = works.filter((w) => w.dateRaised >= since && ["approved", "in_progress", "completed"].includes(w.status)).reduce((t, w) => t + (Number(w.quoteAmount) || 0), 0);
  const rc = Number(device.replacementCost) || 0;
  const ry = replacementYear(device);
  const advice = rc && reactive12 >= rc * 0.5 ? `Repairs in the last 12 months (${gbp(reactive12)}) are ${Math.round((reactive12 / rc) * 100)}% of the replacement cost — worth considering replacement.`
    : ry && ry <= y0 && reactive12 > 0 ? "Past its expected life and still needing repairs — consider planning a replacement." : null;
  return (
    <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}><TrendingUp size={13} /> Cost per year</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70 }}>
        {per.map((p) => (
          <div key={p.y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ fontSize: 9.5, color: "#5B6672", fontWeight: 600 }}>{p.total ? gbp(p.total).replace(".00", "") : ""}</div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 44 }}>
              <div style={{ height: `${(p.reactive / max) * 44}px`, background: "#D97706", borderRadius: "3px 3px 0 0" }} />
              <div style={{ height: `${(p.ppm / max) * 44}px`, background: "#2B4562", borderRadius: p.reactive ? 0 : "3px 3px 0 0" }} />
            </div>
            <div style={{ fontSize: 10, color: "#8A94A0" }}>{p.y}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 4 }}><span style={{ color: "#2B4562", fontWeight: 700 }}>■</span> Planned visits <span style={{ color: "#D97706", fontWeight: 700, marginLeft: 6 }}>■</span> Reactive works</div>
      {advice && <div style={{ fontSize: 11.5, color: "#9B2C2C", fontWeight: 650, marginTop: 6 }}>{advice}</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   Sharing: connect a Supabase database so everyone sees the same data
--------------------------------------------------------- */
const SETUP_SQL = `create table if not exists ppm_store (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
alter table ppm_store enable row level security;
create policy "ppm app access" on ppm_store
  for all using (true) with check (true);`;
const AUTH_SQL = `drop policy if exists "ppm app access" on ppm_store;
create policy "ppm signed-in team" on ppm_store
  for all to authenticated using (true) with check (true);`;
function SharingPanel({ remote }) {
  const helper = typeof window !== "undefined" ? window.ppmRemote : null;
  const cfg = helper?.config || null;
  const [url, setUrl] = useState(cfg?.url || "");
  const [key, setKey] = useState(cfg?.key || "");
  const [space, setSpace] = useState(cfg?.space || "default");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  if (!helper) {
    return <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 12, fontSize: 12.5, color: "#5B6672" }}>Sharing is set up on your deployed site (e.g. on Vercel). Inside Claude's preview, data is already stored by Claude.</div>;
  }
  const current = { url: url.trim(), key: key.trim(), space: space.trim() || "default" };
  const setupCode = cfg ? btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))) : "";
  function applyCode() {
    try { const c = JSON.parse(decodeURIComponent(escape(atob(code.trim())))); setUrl(c.url || ""); setKey(c.key || ""); setSpace(c.space || "default"); setStatus("Code read — now tap Test, then Use shared data."); }
    catch (e) { setStatus("That code isn't valid."); }
  }
  async function test() {
    setBusy(true); setStatus("Testing…");
    try { await helper.test(current); setStatus("✓ Connected — the table is ready."); } catch (e) { setStatus(`✗ ${e.message}`); }
    setBusy(false);
  }
  async function connect(upload) {
    setBusy(true);
    try {
      await helper.test(current);
      if (upload) { setStatus("Uploading this device's data…"); const n = await helper.pushLocal(current); setStatus(`Uploaded ${n} data sets.`); }
      helper.connect(current); setStatus("Connected — reloading…");
      setTimeout(() => window.location.reload(), 700);
    } catch (e) { setStatus(`✗ ${e.message}`); setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setStatus("Saving a copy on this device…");
    try { await helper.pullToLocal(cfg); } catch (e) { /* keep going */ }
    helper.disconnect(); setStatus("Disconnected — reloading…");
    setTimeout(() => window.location.reload(), 700);
  }
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500); } catch (e) { /* ignore */ } };
  const box = { background: "#F7F8F9", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 };
  if (remote) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...box, background: "#EAF4EE" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2F6B4A", display: "flex", alignItems: "center", gap: 6 }}><Cloud size={15} /> Shared database connected</div>
          <div style={{ fontSize: 12, color: "#3A4451" }}>Everyone connected to <b>{cfg?.url?.replace(/^https?:\/\//, "")}</b> (space "{cfg?.space || "default"}") sees the same services, visits, suppliers and budgets. Changes from others appear within a minute, or when you come back to the app.</div>
        </div>
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Connect another phone or computer</div>
          <div style={{ fontSize: 12, color: "#5B6672" }}>Open the app on the other device → 🕘 → Sharing → paste this setup code. Only share it with your team — anyone with it can see and change the data.</div>
          <TextArea readOnly value={setupCode} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
          <button onClick={() => copy(setupCode, "code")} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copied === "code" ? "Copied ✓" : "Copy setup code"}</button>
        </div>
        {window.ppmAuth?.required ? (
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} /> Personal logins are on</div>
            <div style={{ fontSize: 12, color: "#5B6672" }}>Signed in as <b>{window.ppmAuth.email || "—"}</b>. Everyone needs their own account; access without signing in is blocked once the SQL below has been run.</div>
            <TextArea readOnly value={AUTH_SQL} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => copy(AUTH_SQL, "auth")} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>{copied === "auth" ? "Copied ✓" : "Copy SQL"}</button>
              <button onClick={() => window.ppmAuth.signOut()} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#9B2C2C", cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
            </div>
          </div>
        ) : (
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} /> Personal logins (recommended)</div>
            <div style={{ fontSize: 12, color: "#5B6672" }}>Instead of one shared code, each person signs in with their own email and password.</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#3A4451", display: "flex", flexDirection: "column", gap: 3 }}>
              <li>Tap <b>Turn on logins</b> below and create your account (Supabase may email you a confirmation link).</li>
              <li>Copy the new setup code and share it; each colleague creates their own account.</li>
              <li>When everyone is in, run this SQL in Supabase so nobody can get in without signing in. Afterwards, turn off "Allow new users to sign up" under Authentication → Settings.</li>
            </ol>
            <TextArea readOnly value={AUTH_SQL} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => copy(AUTH_SQL, "auth")} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>{copied === "auth" ? "Copied ✓" : "Copy SQL"}</button>
              <button onClick={() => { helper.setAuthRequired(true); window.location.reload(); }} style={{ flex: 1, background: "#2B4562", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Turn on logins</button>
            </div>
          </div>
        )}
        <button disabled={busy} onClick={disconnect} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><CloudOff size={13} /> Disconnect this device (keeps a copy here)</button>
        {status && <div style={{ fontSize: 12, color: "#5B6672" }}>{status}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: "#5B6672" }}>Right now your data is saved only in this browser. Connect a free <b>Supabase</b> database so your whole team — and all your devices — share the same data.</div>
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Joining an existing setup?</div>
        <div style={{ display: "flex", gap: 6 }}>
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste setup code from a colleague" style={{ flex: 1, fontSize: 12 }} />
          <button onClick={applyCode} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Use</button>
        </div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>First-time setup (about 5 minutes)</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#3A4451", display: "flex", flexDirection: "column", gap: 4 }}>
          <li>Create a free project at supabase.com.</li>
          <li>Open <b>SQL Editor</b>, paste the SQL below and press Run.</li>
          <li>Go to <b>Project Settings → API</b> and copy the Project URL and the <b>anon public</b> key into the boxes below.</li>
        </ol>
        <TextArea readOnly value={SETUP_SQL} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 120 }} />
        <button onClick={() => copy(SETUP_SQL, "sql")} style={{ alignSelf: "flex-start", background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>{copied === "sql" ? "Copied ✓" : "Copy SQL"}</button>
      </div>
      <Field label="Project URL"><TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></Field>
      <Field label="Anon public key"><TextInput value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" /></Field>
      <Field label="Space name (optional — lets several teams share one database)"><TextInput value={space} onChange={(e) => setSpace(e.target.value)} /></Field>
      <button disabled={busy || !current.url || !current.key} onClick={test} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Test connection</button>
      {status && <div style={{ fontSize: 12, color: status.startsWith("✗") ? "#C53030" : "#2F6B4A", fontWeight: 600 }}>{status}</div>}
      <PrimaryButton onClick={() => !busy && current.url && current.key && connect(true)}><Cloud size={15} /> Upload this device's data &amp; connect</PrimaryButton>
      <button disabled={busy || !current.url || !current.key} onClick={() => connect(false)} style={{ background: "#fff", border: "1px solid #D7DCE1", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>Use shared data already in the database</button>
      <div style={{ fontSize: 11, color: "#8A94A0" }}>Use "Upload" on the first device (the one with your data). On every other device, use "Use shared data". Take a backup first. Anyone with the setup code can read and change the data, so keep it within your team.</div>
    </div>
  );
}

/* ---------------------------------------------------------
   Permits to work
--------------------------------------------------------- */
function PermitsView({ permits, devices, suppliers, areas, locationName, onSave, onClose }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("open");
  const list = permits.filter((p) => filter === "all" || (filter === "open" ? p.status === "open" : p.status !== "open")).sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
  const fmtDT = (v) => v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <ToggleButton active={filter === "open"} onClick={() => setFilter("open")}>Open ({permits.filter((p) => p.status === "open").length})</ToggleButton>
        <ToggleButton active={filter === "closed"} onClick={() => setFilter("closed")}>Closed</ToggleButton>
        <ToggleButton active={filter === "all"} onClick={() => setFilter("all")}>All</ToggleButton>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Flame size={15} /> Issue a permit to work</PrimaryButton>}
        {permits.length > 0 && <ExportButton label="CSV" filename="permit-register.csv" rows={[["Ref", "Type", "Contractor", "Company", "Work", "Area", "Valid from", "Valid to", "Issued by", "Status", "Closed"], ...permits.map((p) => [p.ref, p.type, p.contractor || "", p.company || "", p.description || "", p.area || "", fmtDT(p.validFrom), fmtDT(p.validTo), p.issuedBy || "", p.status, fmtDT(p.closedAt)])]} />}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Flame} title={filter === "open" ? "No open permits" : "Nothing here"} body="Issue hot works, working at height, confined space and isolation permits, print them for the contractor, and close them when the work is done." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((p) => {
            const expired = p.status === "open" && p.validTo && new Date(p.validTo).getTime() < Date.now();
            return (
              <div key={p.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${p.status !== "open" ? "#8A94A0" : expired ? "#C53030" : "#D97706"}`, borderRadius: 12, padding: 11 }}>
                <button onClick={() => setEditing(p)} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.ref}</span> · {p.type}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.status === "open" ? (expired ? "#C53030" : "#B7791F") : "#5B6672" }}>{p.status === "open" ? (expired ? "Expired — close it" : "Open") : p.status === "cancelled" ? "Cancelled" : "Closed"}</span>
                  </div>
                  <div style={{ fontSize: 11.3, color: "#8A94A0" }}>{[p.contractor, p.company, p.area].filter(Boolean).join(" · ")} · {fmtDT(p.validFrom)} → {fmtDT(p.validTo)}</div>
                  <div style={{ fontSize: 12.3, color: "#3A4451", marginTop: 2 }}>{p.description}</div>
                </button>
                {ACTIVE_CAN_EDIT && p.status === "open" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => onClose(p.id, "closed")} style={{ flex: 1, background: "#EAF4EE", color: "#2F6B4A", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Work done — close permit</button>
                    <button onClick={() => printPermit(p, devices, locationName)} style={{ background: "#EEF0F2", color: "#2B4562", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Printer size={13} /> Print</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && <PermitModal existing={editing.id ? editing : null} devices={devices} suppliers={suppliers} areas={areas} locationName={locationName} onClose={() => setEditing(null)} onCancelPermit={(id) => { onClose(id, "cancelled"); setEditing(null); }}
        onSave={(pm, print) => { const ref = onSave(pm); if (print) printPermit({ ...pm, ref: pm.ref || ref, issuedAt: pm.issuedAt || new Date().toISOString() }, devices, locationName); setEditing(null); }} />}
    </div>
  );
}
function printPermit(p, devices, locationName) {
  const e = escapeHtml;
  const box = `<span style="display:inline-block;width:14px;height:14px;border:1.5px solid #1B2430;border-radius:3px;vertical-align:-2px"></span>`;
  const line = `<span style="display:inline-block;width:200px;border-bottom:1px solid #8A94A0">&nbsp;</span>`;
  const dt = (v) => v ? new Date(v).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const dev = devices.find((d) => d.id === p.deviceId);
  openPrintReport(`Permit to work — ${p.type}`, `${locationName} · ${p.ref}`, `
    ${tableHtml(["", ""], [["Permit no.", `<b>${e(p.ref)}</b>`], ["Type", e(p.type)], ["Work to be done", e(p.description || "")], ["Equipment / service", e(dev?.name || "")], ["Location", e(p.area || dev?.area || "")], ["Contractor", `${e(p.contractor || "")}${p.company ? ` (${e(p.company)})` : ""}`], ["Valid from", dt(p.validFrom)], ["Valid until", dt(p.validTo)], ["Issued by", e(p.issuedBy || "")]])}
    <h2>Precautions — confirmed before work starts</h2>${(PERMIT_PRECAUTIONS[p.type] || []).map((x) => `<div style="margin:6px 0">${(p.checks || []).includes(x) ? "☑" : box} ${e(x)}</div>`).join("")}${p.extra ? `<div style="margin-top:6px"><b>Additional:</b> ${e(p.extra)}</div>` : ""}
    <h2>Acceptance</h2><div>I have read and understood this permit and will follow its conditions.</div><table><tr><td>Contractor signature ${line}</td><td>Time ${line}</td></tr></table>
    <h2>Hand-back / closure</h2><div>${box} Work complete &nbsp; ${box} Area left safe &nbsp; ${box} Isolations removed / systems restored ${p.type === "Hot works" ? `&nbsp; ${box} Fire watch completed` : ""}</div>
    <table><tr><td>Contractor ${line}</td><td>Issuer ${line}</td><td>Time ${line}</td></tr></table>`);
}
function PermitModal({ existing, devices, suppliers, areas, locationName, onClose, onSave, onCancelPermit }) {
  const now = new Date(); const later = new Date(now.getTime() + 8 * 3600000);
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [type, setType] = useState(existing?.type || PERMIT_TYPES[0]);
  const [deviceId, setDeviceId] = useState(existing?.deviceId || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [company, setCompany] = useState(existing?.company || "");
  const [contractor, setContractor] = useState(existing?.contractor || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [area, setArea] = useState(existing?.area || "");
  const [validFrom, setValidFrom] = useState(existing?.validFrom ? local(new Date(existing.validFrom)) : local(now));
  const [validTo, setValidTo] = useState(existing?.validTo ? local(new Date(existing.validTo)) : local(later));
  const [checks, setChecks] = useState(existing?.checks || []);
  const [extra, setExtra] = useState(existing?.extra || "");
  const listId = useMemo(() => `ptw-${uid()}`, []);
  const precautions = PERMIT_PRECAUTIONS[type] || [];
  const allChecked = precautions.every((x) => checks.includes(x));
  const payload = () => ({ ...(existing || {}), type, deviceId: deviceId || null, supplierId: supplierId || null, company: company.trim(), contractor: contractor.trim(), description: description.trim(), area: area.trim(), validFrom: new Date(validFrom).toISOString(), validTo: new Date(validTo).toISOString(), checks, extra: extra.trim() });
  const readOnly = existing && existing.status !== "open";
  return (
    <Modal title={existing ? `Permit ${existing.ref}` : "Issue a permit to work"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{PERMIT_TYPES.map((t) => <ToggleButton key={t} active={type === t} onClick={() => !readOnly && (setType(t), setChecks([]))}>{t}</ToggleButton>)}</div>
        <Field label="Work to be done"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Brazing on chilled water pipework in plant room" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Service (optional)"><Select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); const d = devices.find((x) => x.id === e.target.value); if (d?.area && !area) setArea(d.area); if (d?.supplierId && !supplierId) { setSupplierId(d.supplierId); setCompany(suppliers.find((s) => s.id === d.supplierId)?.name || ""); } }}><option value="">—</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Where"><TextInput list={listId} value={area} onChange={(e) => setArea(e.target.value)} /><datalist id={listId}>{areas.map((a) => <option key={a} value={a} />)}</datalist></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Contractor name"><TextInput value={contractor} onChange={(e) => setContractor(e.target.value)} /></Field>
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Valid from"><TextInput type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field>
          <Field label="Valid until"><TextInput type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></Field>
        </div>
        <div style={{ background: "#FDF1E0", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A5A0B" }}>Precautions confirmed</div>
          {precautions.map((x) => (
            <label key={x} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}>
              <input type="checkbox" checked={checks.includes(x)} disabled={readOnly} onChange={(e) => setChecks((p) => e.target.checked ? [...p, x] : p.filter((y) => y !== x))} style={{ margin: 0 }} /> {x}
            </label>
          ))}
          <TextInput value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Additional precautions (optional)" style={{ fontSize: 12.5 }} />
          {!allChecked && <span style={{ fontSize: 11, color: "#9B2C2C", fontWeight: 600 }}>Tick every precaution before the work starts.</span>}
        </div>
        {!readOnly && ACTIVE_CAN_EDIT && (
          <>
            <PrimaryButton onClick={() => description.trim() && contractor.trim() && onSave(payload(), true)}><Printer size={15} /> {existing ? "Save & print" : "Issue & print permit"}</PrimaryButton>
            <button onClick={() => description.trim() && contractor.trim() && onSave(payload(), false)} style={{ background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>{existing ? "Save" : "Issue without printing"}</button>
            {existing && <button onClick={() => onCancelPermit(existing.id)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel this permit</button>}
          </>
        )}
        {readOnly && <div style={{ fontSize: 12, color: "#5B6672" }}>{existing.status === "cancelled" ? "Cancelled" : "Closed"} by {existing.closedBy} on {new Date(existing.closedAt).toLocaleString("en-GB")}.</div>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Waste & recycling
--------------------------------------------------------- */
function WasteView({ waste, suppliers, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const yr = String(new Date().getFullYear());
  const ytd = waste.filter((w) => String(w.date).startsWith(yr));
  const total = ytd.reduce((t, w) => t + (Number(w.weightKg) || 0), 0);
  const general = ytd.filter((w) => w.stream === "general" || w.stream === "hazardous").reduce((t, w) => t + (Number(w.weightKg) || 0), 0);
  const rate = total ? Math.round(((total - general) / total) * 100) : null;
  const cost = ytd.reduce((t, w) => t + (Number(w.cost) || 0), 0);
  const byStream = Object.keys(WASTE_STREAMS).map((k) => [k, ytd.filter((w) => w.stream === k).reduce((t, w) => t + (Number(w.weightKg) || 0), 0)]).filter(([, v]) => v > 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label={`Waste ${yr}`} value={total >= 1000 ? `${(total / 1000).toFixed(2)} t` : `${Math.round(total)} kg`} />
        <MetricBlock label="Recycling rate" value={rate == null ? "—" : `${rate}%`} tone={rate == null ? undefined : rate >= 60 ? "ok" : rate < 40 ? "danger" : undefined} />
        <MetricBlock label="Cost" value={gbp(cost)} />
      </div>
      {byStream.length > 0 && (
        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 4 }}>
          {byStream.map(([k, v]) => <div key={k} title={`${WASTE_STREAMS[k]} ${Math.round(v)} kg`} style={{ width: `${(v / total) * 100}%`, background: { general: "#5B6672", mixed: "#2F855A", cardboard: "#B7791F", food: "#8E4585", glass: "#2B6CB0", paper: "#2B7A78", weee: "#C05621", hazardous: "#C53030" }[k] }} />)}
        </div>
      )}
      {byStream.length > 0 && <div style={{ fontSize: 11, color: "#5B6672", marginBottom: 10 }}>{byStream.map(([k, v]) => `${WASTE_STREAMS[k]} ${Math.round(v)} kg`).join(" · ")}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><Recycle size={15} /> Log a collection</PrimaryButton>}
        {waste.length > 0 && <ExportButton label="CSV" filename="waste-log.csv" rows={[["Date", "Stream", "Weight (kg)", "Carrier", "Waste transfer note", "Cost", "Logged by"], ...waste.map((w) => [w.date, WASTE_STREAMS[w.stream] || w.stream, w.weightKg, suppliers.find((s) => s.id === w.supplierId)?.name || w.carrier || "", w.wtn || "", w.cost || "", w.by || ""])]} />}
      </div>
      {waste.length === 0 ? (
        <EmptyState icon={Recycle} title="No waste records yet" body="Log each collection's stream, weight, carrier and waste transfer note. You get a recycling rate and yearly totals for ESG and environmental reports." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...waste].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 60).map((w) => (
            <button key={w.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(w)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{WASTE_STREAMS[w.stream]}</div>
                <div style={{ fontSize: 11, color: "#8A94A0" }}>{fmtDate(w.date)}{(suppliers.find((s) => s.id === w.supplierId)?.name || w.carrier) ? ` · ${suppliers.find((s) => s.id === w.supplierId)?.name || w.carrier}` : ""}{w.wtn ? ` · WTN ${w.wtn}` : ""}</div>
              </div>
              <b style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{w.weightKg} kg</b>
            </button>
          ))}
        </div>
      )}
      {editing && <WasteModal existing={editing.id ? editing : null} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(w) => { onSave(w); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function WasteModal({ existing, suppliers, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [stream, setStream] = useState(existing?.stream || "general");
  const [weightKg, setWeightKg] = useState(existing?.weightKg != null ? String(existing.weightKg) : "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [carrier, setCarrier] = useState(existing?.carrier || "");
  const [wtn, setWtn] = useState(existing?.wtn || "");
  const [cost, setCost] = useState(existing?.cost != null ? String(existing.cost) : "");
  return (
    <Modal title={existing ? "Waste collection" : "Log a waste collection"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{Object.entries(WASTE_STREAMS).map(([k, v]) => <ToggleButton key={k} active={stream === k} onClick={() => setStream(k)}>{v}</ToggleButton>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Weight (kg)"><TextInput type="number" min="0" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="from the ticket" /></Field>
        </div>
        <Field label="Carrier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">— Other —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        {!supplierId && <Field label="Carrier name"><TextInput value={carrier} onChange={(e) => setCarrier(e.target.value)} /></Field>}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Waste transfer note no."><TextInput value={wtn} onChange={(e) => setWtn(e.target.value)} /></Field>
          <Field label={`Cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </div>
        <PrimaryButton onClick={() => weightKg !== "" && onSave({ id: existing?.id, date, stream, weightKg: Number(weightKg), supplierId: supplierId || null, carrier: carrier.trim(), wtn: wtn.trim(), cost: cost === "" ? null : Number(cost) })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this record" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Add several services from the template library at once
--------------------------------------------------------- */
function LibraryModal({ existing, suppliers, onClose, onAdd }) {
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState("");
  const [start, setStart] = useState(addDays(new Date().toISOString().slice(0, 10), 7));
  const [supplierId, setSupplierId] = useState("");
  const have = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  const list = ACTIVE_TEMPLATES.filter((t) => !q.trim() || `${t.name} ${t.subCategory || ""} ${t.equipmentType || ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const freq = (t) => t.repeat?.mode === "weekly" ? "Weekly" : t.repeat?.mode === "monthly" ? "Monthly" : t.repeat?.mode === "quarterly" ? "Quarterly" : t.repeat?.mode === "custom" ? `${t.repeat.count}× a year` : t.repeat?.months ? `Every ${t.repeat.months} months` : "One-off";
  function datesFor(t) {
    const r = t.repeat || {};
    if (r.mode === "weekly") return Array.from({ length: 52 }, (_, i) => addDays(start, i * 7));
    if (r.mode === "monthly") return Array.from({ length: 12 }, (_, i) => addMonths(start, i));
    if (r.mode === "quarterly") return Array.from({ length: 4 }, (_, i) => addMonths(start, i * 3));
    if (r.mode === "custom" && r.count) return Array.from({ length: r.count }, (_, i) => addMonths(start, Math.round((12 / r.count) * i)));
    if (r.months) return Array.from({ length: Math.max(1, Math.ceil(12 / r.months)) }, (_, i) => addMonths(start, i * r.months));
    return [start];
  }
  function add() {
    const rows = ACTIVE_TEMPLATES.filter((t) => picked.includes(t.id)).map((t) => ({
      name: t.name, serviceCategory: CATEGORY_META[t.serviceCategory] ? t.serviceCategory : "maintenance", subCategory: t.subCategory || "", category: t.equipmentType || "",
      checklist: t.checklist || [], serviceIntervalMonths: t.repeat?.mode === "interval" ? t.repeat.months : t.repeat?.mode === "monthly" ? 1 : t.repeat?.mode === "quarterly" ? 3 : null,
      supplierId: supplierId || null, scheduleDates: datesFor(t), budgetPerVisit: 0, certRequired: /gas|eicr|fire|emergency|lift|legionella|extinguisher|loler/i.test(t.name),
    }));
    onAdd(rows);
  }
  return (
    <Modal title="Service library" onClose={onClose} width={540}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>Tick the services your site needs — each comes with a typical UK frequency and checklist. You can adjust any of them afterwards.</div>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search e.g. fire, water, lift…" />
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {list.map((t) => {
            const on = picked.includes(t.id); const exists = have.has(t.name.trim().toLowerCase());
            return (
              <button key={t.id} onClick={() => setPicked((p) => on ? p.filter((x) => x !== t.id) : [...p, t.id])} style={{ display: "flex", alignItems: "center", gap: 8, background: on ? "#EAF1F8" : "#F7F8F9", border: `1px solid ${on ? "#2B4562" : "transparent"}`, borderRadius: 9, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                {on ? <CheckSquare size={17} color="#2B4562" /> : <Square size={17} color="#A3ABB4" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{t.name}{exists && <span style={{ fontSize: 10.5, color: "#B7791F", fontWeight: 700 }}> · already added</span>}</div>
                  <div style={{ fontSize: 11, color: "#8A94A0" }}>{freq(t)}{t.subCategory ? ` · ${t.subCategory}` : ""}{t.checklist?.length ? ` · ${t.checklist.length} checks` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="First visits from"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Supplier (optional)"><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">— Set later —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <PrimaryButton onClick={() => picked.length && add()} style={{ opacity: picked.length ? 1 : 0.5 }}><BookOpen size={15} /> Add {picked.length} service{picked.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Emergency contacts on Home
--------------------------------------------------------- */
function EmergencyContacts({ contacts, onSave }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const list = contacts || DEFAULT_EMERGENCY;
  const [draft, setDraft] = useState(list);
  const filled = list.filter((c) => c.phone);
  function print() {
    openPrintReport("Emergency contacts", "Keep by reception, in the plant room and with key holders", tableHtml(["Who", "Name", "Phone", "Notes"], list.filter((c) => c.phone).map((c) => [`<b>${escapeHtml(c.label)}</b>`, escapeHtml(c.name || ""), `<b style="font-size:15px">${escapeHtml(c.phone)}</b>`, escapeHtml(c.notes || "")])));
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <PhoneCall size={17} color="#C53030" />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Emergency contacts <span style={{ color: "#8A94A0", fontWeight: 600, fontSize: 12 }}>({filled.length})</span></span>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && !editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {filled.map((c, i) => (
            <a key={i} href={`tel:${c.phone.replace(/[^+0-9]/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F8F9", borderRadius: 8, padding: "8px 10px", textDecoration: "none", color: "#1B2430" }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.8, fontWeight: 650 }}>{c.label}</div>{(c.name || c.notes) && <div style={{ fontSize: 11, color: "#8A94A0" }}>{[c.name, c.notes].filter(Boolean).join(" · ")}</div>}</div>
              <b style={{ fontSize: 13, color: "#2F855A", display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} /> {c.phone}</b>
            </a>
          ))}
          {filled.length === 0 && <div style={{ fontSize: 12, color: "#8A94A0" }}>Add your site's numbers so anyone can call in one tap.</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {ACTIVE_CAN_EDIT && <button onClick={() => { setDraft(list); setEditing(true); }} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>}
            {filled.length > 0 && <button onClick={print} style={{ background: "none", border: "none", padding: 0, color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Print</button>}
          </div>
        </div>
      )}
      {open && editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {draft.map((c, i) => (
            <div key={i} style={{ background: "#F7F8F9", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={c.label} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ flex: 1, fontWeight: 650, fontSize: 12.5 }} />
                <button onClick={() => setDraft((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={c.name || ""} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name / company" style={{ flex: 1, fontSize: 12.5 }} />
                <TextInput type="tel" value={c.phone || ""} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} placeholder="Phone" style={{ flex: 1, fontSize: 12.5 }} />
              </div>
              <TextInput value={c.notes || ""} onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} placeholder="Notes (account no., contract ref…)" style={{ fontSize: 12 }} />
            </div>
          ))}
          <button onClick={() => setDraft((p) => [...p, { label: "New contact", phone: "" }])} style={{ background: "none", border: "1px dashed #C7D0DA", borderRadius: 8, padding: 7, fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>+ Add contact</button>
          <PrimaryButton onClick={() => { onSave(draft.filter((c) => c.label.trim())); setEditing(false); }}><CheckCircle2 size={15} /> Save contacts</PrimaryButton>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Personal sign-in (when the shared database requires it)
--------------------------------------------------------- */
function LoginScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!email.trim()) return;
    setBusy(true); setMsg("");
    try {
      if (mode === "reset") { await window.ppmAuth.reset(email.trim()); setMsg("If that email has an account, a reset link is on its way."); }
      else if (mode === "signup") { const r = await window.ppmAuth.signUp(email.trim(), password); if (r.session) window.location.reload(); else setMsg("Account created — check your email to confirm it, then sign in."); }
      else { await window.ppmAuth.signIn(email.trim(), password); window.location.reload(); }
    } catch (e) { setMsg(e.message || "Something went wrong"); }
    setBusy(false);
  }
  return (
    <div style={{ minHeight: "100vh", background: "#1B2430", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(380px, 100%)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={20} color="#fff" /></div>
          <div><div style={{ fontSize: 17, fontWeight: 750 }}>PPM Service Book</div><div style={{ fontSize: 12, color: "#8A94A0" }}>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to continue"}</div></div>
        </div>
        <Field label="Email"><TextInput type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        {mode !== "reset" && <Field label="Password"><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></Field>}
        {msg && <div style={{ fontSize: 12.5, color: /created|on its way/.test(msg) ? "#2F6B4A" : "#C53030" }}>{msg}</div>}
        <PrimaryButton onClick={() => !busy && go()}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</PrimaryButton>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMsg(""); }} style={{ background: "none", border: "none", color: "#2B4562", fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{mode === "signup" ? "I have an account" : "Create an account"}</button>
          <button onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setMsg(""); }} style={{ background: "none", border: "none", color: "#8A94A0", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{mode === "reset" ? "Back to sign in" : "Forgot password?"}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const requestId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("request") : null;
  if (requestId) return <RequestPortal deviceId={requestId} />;
  if (typeof window !== "undefined" && window.storage?.__needsLogin) return <LoginScreen />;
  return <MainApp />;
}

/* ---------------------------------------------------------
   Compliance: were planned visits done on time?
   A planned visit (from a service's visit-budget schedule) that's now in the past counts as
   on time if a visit was logged within ±GRACE days of it, late if logged after that but before
   the next planned date, and missed otherwise.
--------------------------------------------------------- */
const COMPLIANCE_GRACE_DAYS = 7;
function computeCompliance(devices, visitBudgets, services) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const DAY = 86400000;
  const t = (d) => new Date(d + "T00:00:00").getTime();
  const perDevice = [];
  devices.forEach((dev) => {
    const planned = [...new Set(visitBudgets.filter((v) => v.deviceId === dev.id).map((v) => v.date))].sort();
    const due = planned.filter((d) => d <= todayISO);
    if (due.length === 0) return;
    const visits = services.filter((s) => s.deviceId === dev.id && s.date && !s.aborted).map((s) => s.date).sort();
    const used = new Set();
    let onTime = 0, late = 0, missed = 0;
    due.forEach((pd, i) => {
      const nextPlanned = planned[planned.indexOf(pd) + 1];
      let match = visits.findIndex((vd, vi) => !used.has(vi) && Math.abs(t(vd) - t(pd)) <= COMPLIANCE_GRACE_DAYS * DAY);
      if (match >= 0) { used.add(match); onTime++; return; }
      match = visits.findIndex((vd, vi) => !used.has(vi) && t(vd) > t(pd) && (!nextPlanned || vd < nextPlanned));
      if (match >= 0) { used.add(match); late++; return; }
      // still inside the grace window — not missed yet
      if ((Date.now() - t(pd)) / DAY <= COMPLIANCE_GRACE_DAYS) return;
      missed++;
    });
    const total = onTime + late + missed;
    if (total > 0) perDevice.push({ device: dev, onTime, late, missed, total, pct: Math.round((onTime / total) * 100) });
  });
  const totals = perDevice.reduce((a, r) => ({ onTime: a.onTime + r.onTime, late: a.late + r.late, missed: a.missed + r.missed }), { onTime: 0, late: 0, missed: 0 });
  const total = totals.onTime + totals.late + totals.missed;
  const answered = services.flatMap((s) => (s.checklistResults || []).filter((r) => r.result === "pass" || r.result === "fail"));
  const passed = answered.filter((r) => r.result === "pass").length;
  return {
    perDevice: perDevice.sort((a, b) => a.pct - b.pct), totals, total,
    pct: total ? Math.round((totals.onTime / total) * 100) : null,
    checklistPct: answered.length ? Math.round((passed / answered.length) * 100) : null, checksAnswered: answered.length,
  };
}
function ComplianceCard({ devices, visitBudgets, services, supplierById }) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState("service"); // 'service' | 'supplier'
  const c = useMemo(() => computeCompliance(devices, visitBudgets, services), [devices, visitBudgets, services]);
  if (c.pct === null && c.checklistPct === null) return null;
  const tone = (p) => p === null ? "#8A94A0" : p >= 90 ? "#2F855A" : p >= 70 ? "#B7791F" : "#C53030";
  let rows = c.perDevice.map((r) => ({ key: r.device.id, label: r.device.name, ...r }));
  if (by === "supplier") {
    const g = {};
    c.perDevice.forEach((r) => {
      const name = r.device.supplierId ? (supplierById[r.device.supplierId]?.name || "Unknown supplier") : "No supplier set";
      g[name] = g[name] || { key: name, label: name, onTime: 0, late: 0, missed: 0, total: 0 };
      ["onTime", "late", "missed", "total"].forEach((k) => { g[name][k] += r[k]; });
    });
    rows = Object.values(g).map((r) => ({ ...r, pct: Math.round((r.onTime / r.total) * 100) })).sort((a, b) => a.pct - b.pct);
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, marginBottom: 4, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <Gauge size={18} color="#2B4562" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Compliance</div>
          <div style={{ fontSize: 11, color: "#8A94A0" }}>Planned visits done within ±{COMPLIANCE_GRACE_DAYS} days</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", color: tone(c.pct) }}>{c.pct === null ? "—" : `${c.pct}%`}</div>
          <div style={{ fontSize: 10, color: "#8A94A0" }}>on time</div>
        </div>
        <ChevronDown size={16} color="#8A94A0" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[["On time", c.totals.onTime, "#2F855A"], ["Late", c.totals.late, "#B7791F"], ["Missed", c.totals.missed, "#C53030"], ["Checks passed", c.checklistPct === null ? "—" : `${c.checklistPct}%`, tone(c.checklistPct)]].map(([label, val, color]) => (
              <div key={label} style={{ flex: 1, background: "#F7F8F9", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
                <div style={{ fontSize: 10, color: "#8A94A0", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <ToggleButton active={by === "service"} onClick={() => setBy("service")}>By service</ToggleButton>
                <ToggleButton active={by === "supplier"} onClick={() => setBy("supplier")}>By supplier</ToggleButton>
              </div>
              {rows.map((r) => (
                <div key={r.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ fontWeight: 650 }}>{r.label}</span>
                    <span style={{ color: tone(r.pct), fontWeight: 700 }}>{r.pct}% <span style={{ color: "#A3ABB4", fontWeight: 500 }}>({r.onTime}/{r.total}{r.missed ? `, ${r.missed} missed` : ""}{r.late ? `, ${r.late} late` : ""})</span></span>
                  </div>
                  <div style={{ height: 6, background: "#EEF0F2", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ width: `${r.pct}%`, height: "100%", background: tone(r.pct) }} />
                  </div>
                </div>
              ))}
            </>
          )}
          <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Based on each service's planned visit dates (its visit budgets) that are now in the past. Services without planned dates aren't scored.</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Chasing overdue jobs: one pre-written email per supplier manager
--------------------------------------------------------- */
function relativeDays(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
function buildChaseEmail(supplier, jobs, locationText, senderName) {
  const first = (supplier?.managerName || "").split(" ")[0] || "there";
  const lines = jobs.map((d) => {
    const late = -daysUntil(d.nextServiceDate);
    return `• ${d.name}${d.assetTag ? ` (${d.assetTag})` : ""} — due ${fmtDate(d.nextServiceDate)}, ${late} day${late === 1 ? "" : "s"} overdue`;
  });
  const subject = `Outstanding scheduled visits${locationText ? ` — ${locationText}` : ""}`;
  const body = `Hi ${first},\n\nThe following scheduled visit${jobs.length === 1 ? " hasn't" : "s haven't"} been completed yet${locationText ? ` at ${locationText}` : ""}:\n\n${lines.join("\n")}\n\nCould you please confirm when ${jobs.length === 1 ? "this will" : "these will"} be attended to, and send over the service report once done?\n\nThanks,\n${senderName || ""}`;
  return { subject, body };
}
function ChaseModal({ devices, supplierById, locationLabel, currentUserName, onChased, onClose }) {
  const [copied, setCopied] = useState(null);
  const groups = {};
  devices.forEach((d) => {
    const key = d.supplierId && supplierById[d.supplierId] ? d.supplierId : "__none";
    (groups[key] = groups[key] || []).push(d);
  });
  const keys = Object.keys(groups).sort((a, b) => (a === "__none") - (b === "__none"));
  return (
    <Modal title="Chase outstanding jobs" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {devices.length === 0 && <div style={{ fontSize: 13, color: "#8A94A0" }}>Nothing overdue — all caught up.</div>}
        {keys.map((key) => {
          const jobs = groups[key].sort((a, b) => (a.nextServiceDate || "").localeCompare(b.nextServiceDate || ""));
          if (key === "__none") {
            return (
              <div key={key} style={{ border: "1px solid #E1E4E8", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>No supplier assigned</div>
                <div style={{ fontSize: 12, color: "#8A94A0", margin: "2px 0 8px" }}>Edit these services and set a default supplier to chase them.</div>
                {jobs.map((d) => <div key={d.id} style={{ fontSize: 12.5, padding: "3px 0" }}>{d.name} — due {fmtDate(d.nextServiceDate)}</div>)}
              </div>
            );
          }
          const s = supplierById[key];
          const locText = [...new Set(jobs.map((d) => locationLabel(d)).filter(Boolean))].join(", ");
          const { subject, body } = buildChaseEmail(s, jobs, locText, currentUserName);
          const mailto = s.managerEmail ? `mailto:${encodeURIComponent(s.managerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
          async function copy() {
            try { await navigator.clipboard.writeText(`To: ${s.managerEmail || ""}\nSubject: ${subject}\n\n${body}`); setCopied(key); } catch (e) { setCopied("fail"); }
            onChased?.(jobs.map((d) => d.id), key);
          }
          return (
            <div key={key} style={{ border: "1px solid #E1E4E8", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: s.managerEmail ? "#5B6672" : "#C05621", marginTop: 2 }}>
                    {s.managerEmail ? `${s.managerName || "Manager"} · ${s.managerEmail}` : "No manager email — add one in Suppliers"}
                    {s.managerPhone ? ` · ${s.managerPhone}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9B2C2C", background: "#FBEAEA", padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{jobs.length} overdue</span>
              </div>
              <div style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: 4 }}>
                {jobs.map((d) => {
                  const late = -daysUntil(d.nextServiceDate);
                  const last = d.chaseLog?.[d.chaseLog.length - 1];
                  return (
                    <div key={d.id} style={{ fontSize: 12.5, background: "#F7F8F9", borderRadius: 7, padding: "6px 8px" }}>
                      <b>{d.name}</b> — due {fmtDate(d.nextServiceDate)} · <span style={{ color: "#C53030", fontWeight: 650 }}>{late}d overdue</span>
                      {last && <div style={{ fontSize: 10.5, color: "#8A94A0" }}>Last chased {relativeDays(last.at)} by {last.by} ({d.chaseLog.length}× total)</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {mailto ? (
                  <a href={mailto} target="_blank" rel="noreferrer" onClick={() => onChased?.(jobs.map((d) => d.id), key)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#2B4562", color: "#fff",
                    borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, textDecoration: "none",
                  }}><Mail size={14} /> Email {s.managerName ? s.managerName.split(" ")[0] : "manager"}</a>
                ) : null}
                <button onClick={copy} style={{ flex: mailto ? "0 0 auto" : 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>
                  {copied === key ? "Copied ✓" : "Copy text"}
                </button>
              </div>
              {copied === "fail" && <div style={{ fontSize: 11, color: "#C53030", marginTop: 4 }}>Couldn't copy automatically on this device.</div>}
            </div>
          );
        })}
        <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>"Email" opens your own mail app with the message ready to send — nothing is sent automatically. Each chase is recorded on the job with the date and your name.</div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Notification centre
--------------------------------------------------------- */
function AlertsModal({ alerts, onClose, onGo, locationName = "", senderName = "", onSnooze, snoozedCount = 0, onClearSnoozes }) {
  function emailSummary() {
    const lines = alerts.map((a) => `- ${a.tone === "danger" ? "[URGENT] " : ""}${a.title}${a.detail ? ` (${a.detail})` : ""}`);
    const subject = `PPM status — ${locationName} — ${fmtDate(new Date().toISOString().slice(0, 10))}`;
    const body = `Hi,\n\nHere's the current PPM status for ${locationName}:\n\n${lines.join("\n") || "Nothing needs attention."}\n\nUrgent: ${alerts.filter((a) => a.tone === "danger").length} · Warnings: ${alerts.filter((a) => a.tone === "warn").length}\n\nKind regards,\n${senderName}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const colors = { danger: ["#9B2C2C", "#FBEAEA", "#C53030"], warn: ["#8A5A0B", "#FDF1E0", "#D97706"], info: ["#2B4562", "#EEF0F2", "#2B4562"] };
  return (
    <Modal title={`Notifications (${alerts.length})`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {alerts.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: "#8A94A0", fontSize: 13 }}><CheckCircle2 size={22} color="#2F855A" /><div style={{ marginTop: 6 }}>All clear — nothing needs attention.</div></div>}
        {alerts.map((a) => {
          const [fg, bg, edge] = colors[a.tone];
          return (
            <div key={a.key} style={{ background: bg, borderLeft: `3px solid ${edge}`, borderRadius: 9, display: "flex", alignItems: "center" }}>
              <button onClick={() => onGo(a.tab)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: "9px 4px 9px 11px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>{a.title}</div>
                  {a.detail && <div style={{ fontSize: 11.5, color: "#5B6672", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</div>}
                </div>
                <ChevronRight size={15} color="#A3ABB4" />
              </button>
              {onSnooze && a.tone !== "danger" && (
                <button onClick={() => onSnooze(a.key, 7)} title="Snooze for 7 days" style={{ background: "none", border: "none", cursor: "pointer", padding: "9px 10px", display: "flex" }}><BellOff size={14} color="#8A94A0" /></button>
              )}
            </div>
          );
        })}
        {snoozedCount > 0 && (
          <button onClick={onClearSnoozes} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>{snoozedCount} snoozed — show them again</button>
        )}
        {alerts.length > 0 && (
          <PrimaryButton onClick={emailSummary} style={{ marginTop: 4 }}><Mail size={15} /> Email this summary</PrimaryButton>
        )}
        <div style={{ fontSize: 10.5, color: "#A3ABB4", marginTop: 4 }}>Covers overdue and due-within-7-days services, new requests, quotes awaiting approval or reply, budgets at 80%+ of their cap, contracts inside their renewal notice window, supplier insurance and accreditation expiry, and asset warranties ending. Tap the bell-off icon to snooze a non-urgent item for 7 days (only for you).</div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Reports — print-ready pages the browser can save as PDF
--------------------------------------------------------- */
function openPrintReport(title, subtitle, bodyHtml) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Helvetica,Arial,sans-serif;color:#1B2430;margin:32px;font-size:12px}
    .band{background:#1B2430;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:18px}
    .band h1{margin:0;font-size:20px}.band div{color:#C7D0DA;font-size:12px;margin-top:4px}
    h2{font-size:14px;color:#2B4562;border-bottom:2px solid #D7DCE1;padding-bottom:4px;margin:22px 0 8px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#2B4562;color:#fff;text-align:left;padding:6px 8px;font-size:11px}
    td{padding:6px 8px;border-bottom:1px solid #E1E4E8;font-size:11.5px}tr:nth-child(even) td{background:#F7F8F9}
    .num{text-align:right;font-family:Menlo,monospace}.ok{color:#2F855A;font-weight:700}.warn{color:#B7791F;font-weight:700}.bad{color:#C53030;font-weight:700}
    .kpis{display:flex;gap:10px;margin-bottom:6px}.kpi{flex:1;border:1px solid #D7DCE1;border-radius:8px;padding:10px}.kpi b{display:block;font-size:18px;margin-top:2px}
    .muted{color:#8A94A0}.foot{margin-top:28px;color:#8A94A0;font-size:10px;border-top:1px solid #E1E4E8;padding-top:6px}
    @media print{body{margin:14mm}.noprint{display:none}}
  </style></head><body><div class="band"><h1>${escapeHtml(title)}</h1><div>${escapeHtml(subtitle)}</div></div>${bodyHtml}
  <div class="foot">Generated ${new Date().toLocaleString("en-GB")} · PPM Service Book</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
  return true;
}
const money = (n) => gbp(Number(n) || 0);
function tableHtml(headers, rows, numericCols = []) {
  if (!rows.length) return `<div class="muted">Nothing to show.</div>`;
  return `<table><tr>${headers.map((h, i) => `<th${numericCols.includes(i) ? ' class="num"' : ""}>${escapeHtml(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td${numericCols.includes(i) ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
}
function pctClass(p) { return p === null || p === undefined ? "muted" : p >= 90 ? "ok" : p >= 70 ? "warn" : "bad"; }

function buildComplianceReport(data, year, month) {
  const { devices, services, works, visitBudgets, deviceById, supplierById } = data;
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const inMonth = (d) => d && d >= monthStart && d <= monthEnd;
  const today = new Date().toISOString().slice(0, 10);
  const planned = [];
  devices.forEach((dev) => {
    [...new Set(visitBudgets.filter((v) => v.deviceId === dev.id).map((v) => v.date))].filter(inMonth).forEach((pd) => {
      const t = (x) => new Date(x + "T00:00:00").getTime();
      const visit = services.filter((s) => s.deviceId === dev.id && s.date).sort((a, b) => Math.abs(t(a.date) - t(pd)) - Math.abs(t(b.date) - t(pd)))[0];
      const diff = visit ? Math.round((t(visit.date) - t(pd)) / 86400000) : null;
      let status;
      if (visit && Math.abs(diff) <= COMPLIANCE_GRACE_DAYS) status = '<span class="ok">On time</span>';
      else if (visit && diff > 0) status = `<span class="warn">Late (${diff}d)</span>`;
      else if (pd > today) status = '<span class="muted">Upcoming</span>';
      else status = '<span class="bad">Missed / not logged</span>';
      planned.push([escapeHtml(dev.name), escapeHtml(dev.supplierId ? supplierById[dev.supplierId]?.name || "" : "—"), fmtDate(pd), visit ? fmtDate(visit.date) : "—", status]);
    });
  });
  const visits = services.filter((s) => inMonth(s.date)).sort((a, b) => a.date.localeCompare(b.date));
  const failed = visits.flatMap((s) => (s.checklistResults || []).filter((r) => r.result === "fail").map((r) => [fmtDate(s.date), escapeHtml(deviceById[s.deviceId]?.name || ""), escapeHtml(r.item), escapeHtml(r.note || "")]));
  const overdue = devices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; });
  const openWorks = works.filter((w) => !["completed", "rejected"].includes(w.status));
  const c = computeCompliance(devices, visitBudgets, services);
  const answered = visits.flatMap((s) => (s.checklistResults || []).filter((r) => r.result === "pass" || r.result === "fail"));
  const passPct = answered.length ? Math.round(answered.filter((r) => r.result === "pass").length / answered.length * 100) : null;
  return `<div class="kpis">
      <div class="kpi">On-time (all time)<b class="${pctClass(c.pct)}">${c.pct === null ? "—" : c.pct + "%"}</b></div>
      <div class="kpi">Visits logged this month<b>${visits.length}</b></div>
      <div class="kpi">Checklist pass rate<b class="${pctClass(passPct)}">${passPct === null ? "—" : passPct + "%"}</b></div>
      <div class="kpi">Overdue now<b class="${overdue.length ? "bad" : "ok"}">${overdue.length}</b></div></div>
    <h2>Planned visits this month</h2>${tableHtml(["Service", "Supplier", "Planned", "Logged", "Status"], planned)}
    <h2>Visits logged</h2>${tableHtml(["Date", "Service", "Supplier", "Technician", "PO", "Checklist", "Sign-off", "Cost"], visits.map((s) => {
      const a = (s.checklistResults || []).filter((r) => r.result === "pass" || r.result === "fail");
      const so = [s.signatures?.technician && `Tech: ${escapeHtml(s.signatures.technician.name || "signed")}`, s.signatures?.site && `Site: ${escapeHtml(s.signatures.site.name || "signed")}`].filter(Boolean).join("<br/>") || '<span class="muted">—</span>';
      return [fmtDate(s.date), escapeHtml(deviceById[s.deviceId]?.name || ""), escapeHtml(s.supplierId ? supplierById[s.supplierId]?.name || "" : ""), escapeHtml(s.technician || ""), escapeHtml(s.poNumber || ""), a.length ? `${a.filter((r) => r.result === "pass").length}/${a.length}` : "—", so + (s.gps ? `<br/><span class="muted">📍 ${s.gps.lat.toFixed(4)}, ${s.gps.lng.toFixed(4)}</span>` : ""), money(s.cost)];
    }), [7])}
    <h2>Failed checklist items</h2>${tableHtml(["Date", "Service", "Check", "Note"], failed)}
    <h2>Overdue services (as of today)</h2>${tableHtml(["Service", "Due", "Days overdue", "Chased"], overdue.map((d) => [escapeHtml(d.name), fmtDate(d.nextServiceDate), `<span class="bad">${-daysUntil(d.nextServiceDate)}</span>`, d.chaseLog?.length ? `${d.chaseLog.length}×` : "No"]))}
    <h2>Open extra works &amp; requests</h2>${tableHtml(["Raised", "Service", "Description", "Priority", "Status", "PO", "Amount"], openWorks.map((w) => [fmtDate(w.dateRaised), escapeHtml(deviceById[w.deviceId]?.name || ""), escapeHtml(w.description), escapeHtml(w.priority || "medium"), escapeHtml((WORK_STATUSES.find((s) => s.key === w.status) || {}).label || w.status), escapeHtml(w.poNumber || ""), money(w.quoteAmount)]), [6])}`;
}

function buildSpendReport(data, year) {
  const { devices, services, works, suppliers, budgets, budgetLines, deviceById, supplierById } = data;
  const yr = (d) => d && new Date(d).getFullYear() === year;
  const catOf = {}; devices.forEach((d) => { catOf[d.id] = d.serviceCategory || "maintenance"; });
  const items = [];
  services.forEach((s) => { if (yr(s.date) && s.cost) items.push({ date: s.date, amount: Number(s.cost), cat: catOf[s.deviceId], dev: s.deviceId, sup: s.supplierId, kind: "Visit" }); });
  works.forEach((w) => { if (yr(w.dateRaised) && w.budgetType !== "non_controllable" && ["approved", "in_progress", "completed"].includes(w.status)) items.push({ date: w.dateRaised, amount: Number(w.quoteAmount) || 0, cat: catOf[w.deviceId], dev: w.deviceId, sup: w.supplierId, kind: "Extra work" }); });
  budgetLines.forEach((l) => { if (yr(l.date) && l.actualAmount != null && !isMirrored(l)) items.push({ date: l.date, amount: Number(l.actualAmount), cat: l.category, dev: l.deviceId, sup: l.supplierId, kind: "Plan line" }); });
  const nonCtrl = works.filter((w) => yr(w.dateRaised) && w.budgetType === "non_controllable" && w.status !== "rejected").reduce((s, w) => s + (Number(w.quoteAmount) || 0), 0);
  const planned = {}; CATEGORY_KEYS.forEach((c) => { planned[c] = budgetLines.filter((l) => yr(l.date) && l.category === c).reduce((s, l) => s + (Number(l.amount) || 0), 0); });
  const catRows = CATEGORY_KEYS.map((c) => {
    const cap = Number(budgets.find((b) => b.year === year && b.category === c)?.amount) || 0;
    const target = cap || planned[c];
    const contract = suppliers.filter((s) => s.category === c).reduce((sum, s) => sum + (s.costFrequency === "annual" ? Number(s.costAmount) || 0 : (Number(s.costAmount) || 0) * 12), 0);
    const actual = items.filter((i) => i.cat === c).reduce((s, i) => s + i.amount, 0) + contract;
    const v = target - actual;
    return [CATEGORY_META[c].label, cap ? money(cap) : `<span class="muted">${money(planned[c])} planned</span>`, money(actual), `<span class="${v >= 0 ? "ok" : "bad"}">${v >= 0 ? "" : "−"}${money(Math.abs(v))}</span>`, target ? `${Math.round(actual / target * 100)}%` : "—"];
  });
  const months = MONTH_LABELS.map((m, i) => {
    const inM = (d) => new Date(d).getMonth() === i;
    const act = items.filter((x) => inM(x.date)).reduce((s, x) => s + x.amount, 0);
    const plan = budgetLines.filter((l) => yr(l.date) && inM(l.date)).reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return [m, money(plan), money(act), `<span class="${plan - act >= 0 ? "ok" : "bad"}">${money(plan - act)}</span>`];
  });
  const group = (keyFn, nameFn) => {
    const g = {}; items.forEach((i) => { const k = keyFn(i) || "__none"; g[k] = (g[k] || 0) + i.amount; });
    return Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => [escapeHtml(k === "__none" ? "Not assigned" : nameFn(k)), money(v)]);
  };
  const total = items.reduce((s, i) => s + i.amount, 0);
  return `<div class="kpis"><div class="kpi">Logged spend ${year}<b>${money(total)}</b></div><div class="kpi">Non-controllable works<b>${money(nonCtrl)}</b></div><div class="kpi">Entries<b>${items.length}</b></div></div>
    <h2>By category (budget vs actual, incl. recurring supplier contracts)</h2>${tableHtml(["Category", "Budget", "Actual", "Variance", "Used"], catRows, [1, 2, 3, 4])}
    <h2>By month (planned vs actual)</h2>${tableHtml(["Month", "Planned", "Actual", "Variance"], months, [1, 2, 3])}
    <h2>By supplier</h2>${tableHtml(["Supplier", "Spend"], group((i) => i.sup, (k) => supplierById[k]?.name || "Unknown"), [1])}
    <h2>By service</h2>${tableHtml(["Service", "Spend"], group((i) => i.dev, (k) => deviceById[k]?.name || "Unknown"), [1])}`;
}

function supplierStats(s, { devices, services, works, budgetLines, visitBudgets }, year) {
  const yr = (d) => !year || (d && new Date(d).getFullYear() === year);
  const devs = devices.filter((d) => d.supplierId === s.id);
  const comp = computeCompliance(devs, visitBudgets, services);
  const visits = services.filter((v) => (v.supplierId === s.id || (!v.supplierId && devs.some((d) => d.id === v.deviceId))) && yr(v.date));
  const lines = budgetLines.filter((l) => l.supplierId === s.id && l.actualAmount != null && yr(l.date));
  const variances = lines.map((l) => Number(l.actualAmount) - Number(l.amount));
  const avgVar = variances.length ? variances.reduce((a, b) => a + b, 0) / variances.length : null;
  const budgeted = lines.reduce((a, l) => a + (Number(l.amount) || 0), 0);
  const fails = visits.reduce((a, v) => a + (v.checklistResults || []).filter((r) => r.result === "fail").length, 0);
  const checks = visits.reduce((a, v) => a + (v.checklistResults || []).filter((r) => r.result === "pass" || r.result === "fail").length, 0);
  const jobs = works.filter((w) => w.supplierId === s.id && yr(w.dateRaised));
  const chases = devs.reduce((a, d) => a + (d.chaseLog || []).filter((c) => c.supplierId === s.id && yr(c.at)).length, 0);
  const spend = visits.reduce((a, v) => a + (Number(v.cost) || 0), 0) + lines.filter((l) => !isMirrored(l)).reduce((a, l) => a + Number(l.actualAmount), 0);
  // Overall score: on-time (50%), checklist pass (30%), cost within budget (20%) — only parts with data count.
  const parts = [];
  if (comp.pct !== null) parts.push([comp.pct, 50]);
  if (checks) parts.push([Math.round(((checks - fails) / checks) * 100), 30]);
  if (budgeted) parts.push([Math.max(0, Math.min(100, Math.round(100 - (Math.max(0, spend - budgeted) / budgeted) * 100))), 20]);
  const score = parts.length ? Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / parts.reduce((a, [, w]) => a + w, 0)) : null;
  return { comp, visits, lines, avgVar, budgeted, fails, checks, jobs, chases, spend, score, devs };
}

function buildSupplierReport(data, year) {
  const rows = data.suppliers.map((s) => {
    const st = supplierStats(s, data, year);
    return [escapeHtml(s.name), escapeHtml(CATEGORY_META[s.category]?.label || ""), `<span class="${pctClass(st.score)}">${st.score === null ? "—" : st.score}</span>`,
      `<span class="${pctClass(st.comp.pct)}">${st.comp.pct === null ? "—" : st.comp.pct + "%"}</span>`, `${st.comp.totals.missed}`, st.checks ? `${Math.round((st.checks - st.fails) / st.checks * 100)}%` : "—",
      st.avgVar === null ? "—" : `<span class="${st.avgVar <= 0 ? "ok" : "bad"}">${st.avgVar > 0 ? "+" : ""}${money(st.avgVar)}</span>`, `${st.jobs.length}`, `${st.chases}`, money(st.spend),
      s.contractEnd ? fmtDate(s.contractEnd) : "—"];
  });
  return `<div class="muted" style="margin-bottom:8px">Score = on-time % (50%), checklist pass rate (30%) and cost within budget (20%), using whichever of those have data.</div>
    ${tableHtml(["Supplier", "Category", "Score", "On time", "Missed", "Checks passed", "Avg vs budget", "Extra jobs", "Chases", "Spend", "Contract ends"], rows, [9])}`;
}

function buildAssetRecord(d, services, tasks, supplierById) {
  const e = escapeHtml;
  const sup = supplierById[d.supplierId];
  const sorted = [...services].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const total = sorted.reduce((t, v) => t + (Number(v.cost) || 0), 0);
  const detail = [
    ["Service category", CATEGORY_META[d.serviceCategory]?.label || ""], ["Area / room", d.area], ["Equipment type", d.category], ["Asset tag", d.assetTag],
    ["Manufacturer / model", [d.manufacturer, d.model].filter(Boolean).join(" ")], ["Serial number", d.serialNumber],
    ["Installed", d.installDate ? fmtDate(d.installDate) : ""], ["Warranty ends", d.warrantyEnd ? fmtDate(d.warrantyEnd) : ""],
    ["Replacement due", replacementYear(d) ? `${replacementYear(d)}${d.replacementCost ? ` · est. ${money(d.replacementCost)}` : ""}` : ""], ["Default supplier", sup?.name], ["Service interval", d.serviceIntervalMonths ? `Every ${d.serviceIntervalMonths} months` : ""],
    ["Last visit", d.lastServiceDate ? fmtDate(d.lastServiceDate) : ""], ["Next due", d.nextServiceDate ? fmtDate(d.nextServiceDate) : ""],
    ["Access notes", d.accessNotes], ["Safety", [d.ramsRequired && "RAMS", ...(d.permits || []).map((p) => `${p} permit`)].filter(Boolean).join(", ")],
  ].filter(([, v]) => v);
  return `<div class="kpis"><div class="kpi">Visits logged<b>${sorted.length}</b></div><div class="kpi">Total spend<b>${money(total)}</b></div><div class="kpi">Checklist fails<b>${sorted.reduce((t, v) => t + (v.checklistResults || []).filter((r) => r.result === "fail").length, 0)}</b></div></div>
  <h2>Asset details</h2>${tableHtml(["Field", "Value"], detail.map(([k, v]) => [e(k), e(String(v))]))}
  <h2>Service history</h2>${tableHtml(["Date", "Visit", "Supplier", "Technician", "Checks", "RAMS / permit", "Cost"], sorted.map((v) => {
    const cr = v.checklistResults || []; const fails = cr.filter((r) => r.result === "fail").length;
    return [fmtDate(v.date), e(v.name || ""), e(supplierById[v.supplierId]?.name || ""), e(v.technician || ""),
      cr.length ? (fails ? `<span class="bad">${fails} fail</span>` : `<span class="ok">All pass</span>`) : "",
      [v.ramsReceived && "RAMS ✓", v.permitRef && `Permit ${e(v.permitRef)}`, v.lateReason && `<span class="warn">Late: ${e(v.lateReason)}</span>`].filter(Boolean).join(" · "), money(v.cost)];
  }), [6])}
  ${(d.notesLog || []).length ? `<h2>Site notes</h2>${tableHtml(["Date", "By", "Note"], d.notesLog.map((n) => [fmtDate(n.at.slice(0, 10)), e(n.by), e(n.text)]))}` : ""}
  ${tasks.length ? `<h2>Recurring tasks</h2>${tableHtml(["Task", "Every", "Last done", "Next due"], tasks.map((t) => [e(t.name), `${t.intervalMonths} mo`, t.lastDoneDate ? fmtDate(t.lastDoneDate) : "", t.nextDate ? fmtDate(t.nextDate) : ""]))}` : ""}`;
}
function buildJobSheet(data) {
  const e = escapeHtml;
  const today = new Date().toISOString().slice(0, 10); const end = addDays(today, 7);
  const box = `<span style="display:inline-block;width:14px;height:14px;border:1.5px solid #1B2430;border-radius:3px"></span>`;
  const rows = [];
  data.devices.forEach((d) => { if (d.nextServiceDate && d.nextServiceDate <= end) rows.push({ date: d.nextServiceDate, d, what: "Service visit" }); });
  (data.deviceTasks || []).forEach((t) => { const d = data.deviceById[t.deviceId]; if (d && t.nextDate && t.nextDate <= end) rows.push({ date: t.nextDate, d, what: t.name }); });
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const overdue = rows.filter((r) => r.date < today).length;
  return `<div class="kpis"><div class="kpi">Jobs on sheet<b>${rows.length}</b></div><div class="kpi">Overdue<b class="${overdue ? "bad" : "ok"}">${overdue}</b></div><div class="kpi">Need RAMS / permit<b>${rows.filter((r) => r.d.ramsRequired || r.d.permits?.length).length}</b></div></div>
  <h2>Jobs</h2>${tableHtml(["Due", "Service", "Task", "Supplier", "Access & safety", "Done", "Signed"], rows.map((r) => [
    r.date < today ? `<span class="bad">${fmtDate(r.date)}</span>` : fmtDate(r.date),
    `<b>${e(r.d.name)}</b>${r.d.area ? `<div class="muted">${e(r.d.area)}</div>` : ""}${r.d.assetTag ? `<div class="muted">#${e(r.d.assetTag)}</div>` : ""}`, e(r.what),
    e(data.supplierById[r.d.supplierId]?.name || "") + (currentBooking(r.d) && r.what === "Service visit" ? `<div class="ok">${currentBooking(r.d).status === "confirmed" ? "Confirmed" : "Booked"} ${currentBooking(r.d).date ? fmtDate(currentBooking(r.d).date) : ""} ${e(currentBooking(r.d).time || "")}</div>` : ""),
    [r.d.accessNotes && e(r.d.accessNotes), (r.d.ramsRequired || r.d.permits?.length) && `<b>${[r.d.ramsRequired && "RAMS", ...(r.d.permits || [])].filter(Boolean).map(e).join(", ")}</b>`].filter(Boolean).join("<br>"),
    box, "<span style=\"display:inline-block;width:90px;border-bottom:1px solid #8A94A0\">&nbsp;</span>",
  ]))}`;
}

function buildAssetRegister(data) {
  const e = escapeHtml;
  const list = [...data.devices].sort((a, b) => (a.area || "~").localeCompare(b.area || "~") || a.name.localeCompare(b.name));
  return `<div class="kpis"><div class="kpi">Services<b>${list.length}</b></div><div class="kpi">With serial no.<b>${list.filter((d) => d.serialNumber).length}</b></div><div class="kpi">Under warranty<b>${list.filter((d) => d.warrantyEnd && daysUntil(d.warrantyEnd) >= 0).length}</b></div></div>
  ${tableHtml(["Service", "Area", "Tag", "Make / model", "Serial", "Installed", "Warranty", "Supplier", "Frequency", "Last", "Next"], list.map((d) => [
    `<b>${e(d.name)}</b><div class="muted">${e(CATEGORY_META[d.serviceCategory]?.label || "")}${d.category ? ` · ${e(d.category)}` : ""}</div>`, e(d.area || ""), e(d.assetTag || ""),
    e([d.manufacturer, d.model].filter(Boolean).join(" ")), e(d.serialNumber || ""), d.installDate ? fmtDate(d.installDate) : "",
    d.warrantyEnd ? `<span class="${daysUntil(d.warrantyEnd) < 0 ? "muted" : "ok"}">${fmtDate(d.warrantyEnd)}</span>` : "",
    e(data.supplierById[d.supplierId]?.name || ""), d.serviceIntervalMonths ? `${d.serviceIntervalMonths} mo` : "",
    d.lastServiceDate ? fmtDate(d.lastServiceDate) : "", d.nextServiceDate ? `<span class="${daysUntil(d.nextServiceDate) < 0 ? "bad" : ""}">${fmtDate(d.nextServiceDate)}</span>` : "",
  ]))}`;
}
function buildManagementReport(data, year, month) {
  const e = escapeHtml;
  const pad = (n) => String(n).padStart(2, "0");
  const from = `${year}-${pad(month + 1)}-01`;
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const inM = (d) => d && d >= from && d <= to;
  const visits = data.services.filter((v) => inM(v.date) && !v.aborted);
  const aborted = data.services.filter((v) => inM(v.date) && v.aborted);
  const late = visits.filter((v) => v.lateReason);
  const raised = data.works.filter((w) => inM(w.dateRaised));
  const completedW = data.works.filter((w) => inM(w.completedAt));
  const slaLate = completedW.filter((w) => workSla(w)?.breached);
  const spendVisits = visits.reduce((t, v) => t + (Number(v.cost) || 0), 0);
  const spendWorks = data.works.filter((w) => inM(w.dateRaised) && ["approved", "in_progress", "completed"].includes(w.status)).reduce((t, w) => t + (Number(w.quoteAmount) || 0), 0);
  const incidents = (data.incidents || []).filter((i) => inM(i.date));
  const audits = (data.audits || []).filter((a) => inM(a.date));
  const auditAvg = audits.length ? Math.round(audits.reduce((t, a) => t + a.score, 0) / audits.length) : null;
  const signins = (data.signins || []).filter((x) => inM(String(x.inAt).slice(0, 10)));
  const comp = computeCompliance(data.devices, data.visitBudgets.filter((v) => v.date <= to), data.services);
  const nextFrom = new Date(year, month + 1, 1).toISOString().slice(0, 10); const nextTo = new Date(year, month + 2, 0).toISOString().slice(0, 10);
  const upcoming = data.devices.filter((d) => d.nextServiceDate && d.nextServiceDate >= nextFrom && d.nextServiceDate <= nextTo).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate));
  const overdueNow = data.devices.filter((d) => d.nextServiceDate && daysUntil(d.nextServiceDate) < 0);
  const repeat = Object.entries(data.faultsByDevice || {}).filter(([, n]) => n >= 3).map(([id, n]) => `${e(data.deviceById[id]?.name || "")} (${n})`);
  return `<div class="kpis">
    <div class="kpi">Visits completed<b>${visits.length}</b>${aborted.length ? `<span class="warn">${aborted.length} not completed</span>` : ""}</div>
    <div class="kpi">PPM on time (YTD)<b class="${comp.pct >= 90 ? "ok" : comp.pct >= 70 ? "warn" : "bad"}">${comp.pct == null ? "—" : comp.pct + "%"}</b></div>
    <div class="kpi">Overdue now<b class="${overdueNow.length ? "bad" : "ok"}">${overdueNow.length}</b></div>
    <div class="kpi">Works raised / done<b>${raised.length} / ${completedW.length}</b>${slaLate.length ? `<span class="bad">${slaLate.length} late</span>` : ""}</div>
    <div class="kpi">Spend in month<b>${money(spendVisits + spendWorks)}</b><span class="muted">visits ${money(spendVisits)} · works ${money(spendWorks)}</span></div>
    <div class="kpi">Incidents<b class="${incidents.length ? "warn" : "ok"}">${incidents.length}</b></div>
    <div class="kpi">Audit average<b>${auditAvg == null ? "—" : auditAvg + "%"}</b></div>
    <div class="kpi">Contractor visits<b>${signins.length}</b></div>
  </div>
  <h2>Highlights</h2><ul>
    ${late.length ? `<li>${late.length} visit${late.length === 1 ? " was" : "s were"} late: ${e([...new Set(late.map((v) => v.lateReason))].join(", "))}.</li>` : "<li>No late visits recorded.</li>"}
    ${aborted.length ? `<li>${aborted.length} visit${aborted.length === 1 ? "" : "s"} not completed: ${e([...new Set(aborted.map((v) => v.abortReason))].join(", "))}.</li>` : ""}
    ${overdueNow.length ? `<li>Overdue now: ${overdueNow.slice(0, 8).map((d) => e(d.name)).join(", ")}${overdueNow.length > 8 ? "…" : ""}.</li>` : ""}
    ${repeat.length ? `<li>Repeat faults (12 months): ${repeat.join(", ")}.</li>` : ""}
    ${incidents.filter((i) => i.type === "injury").length ? `<li class="bad">${incidents.filter((i) => i.type === "injury").length} injury incident(s) this month.</li>` : ""}
  </ul>
  ${visits.length ? `<h2>Visits completed</h2>${tableHtml(["Date", "Service", "Supplier", "Cost"], visits.sort((a, b) => a.date.localeCompare(b.date)).map((v) => [fmtDate(v.date), e(data.deviceById[v.deviceId]?.name || ""), e(data.supplierById[v.supplierId || data.deviceById[v.deviceId]?.supplierId]?.name || ""), money(v.cost)]), [3])}` : ""}
  ${raised.length ? `<h2>Reactive works raised</h2>${tableHtml(["Raised", "Service", "Work", "Priority", "Status"], raised.map((w) => [fmtDate(w.dateRaised), e(data.deviceById[w.deviceId]?.name || ""), e(w.description), e(w.priority || "medium"), e(w.status)]))}` : ""}
  ${incidents.length ? `<h2>Incidents</h2>${tableHtml(["Date", "Type", "Where", "What happened", "Status"], incidents.map((i) => [fmtDate(i.date), e(INCIDENT_TYPES[i.type] || ""), e(i.area || ""), e(i.description), e(i.status || "open")]))}` : ""}
  ${upcoming.length ? `<h2>Coming up next month</h2>${tableHtml(["Due", "Service", "Supplier"], upcoming.map((d) => [fmtDate(d.nextServiceDate), e(d.name), e(data.supplierById[d.supplierId]?.name || "")]))}` : ""}`;
}
function buildLifecycleReport(data) {
  const e = escapeHtml; const y0 = new Date().getFullYear();
  const assets = data.devices.filter((d) => replacementYear(d));
  const overdue = assets.filter((d) => replacementYear(d) < y0);
  const years = Array.from({ length: 5 }, (_, i) => y0 + i);
  const noData = data.devices.filter((d) => !replacementYear(d)).length;
  const rowsFor = (list) => list.sort((a, b) => a.name.localeCompare(b.name)).map((d) => [`<b>${e(d.name)}</b>${d.area ? `<div class="muted">${e(d.area)}</div>` : ""}`, e([d.manufacturer, d.model].filter(Boolean).join(" ")), d.installDate ? fmtDate(d.installDate) : "", `${d.expectedLifeYears} yrs`, d.replacementCost ? money(d.replacementCost) : `<span class="warn">no estimate</span>`]);
  const total = (list) => list.reduce((t, d) => t + (Number(d.replacementCost) || 0), 0);
  return `<div class="kpis">${years.map((y) => `<div class="kpi">${y}<b>${money(total(assets.filter((d) => replacementYear(d) === y)))}</b><span class="muted">${assets.filter((d) => replacementYear(d) === y).length} assets</span></div>`).join("")}</div>
  ${overdue.length ? `<h2>Already past expected life</h2>${tableHtml(["Asset", "Make / model", "Installed", "Life", "Est. cost"], rowsFor(overdue), [4])}<div>Total: <b>${money(total(overdue))}</b></div>` : ""}
  ${years.map((y) => { const l = assets.filter((d) => replacementYear(d) === y); return l.length ? `<h2>${y}</h2>${tableHtml(["Asset", "Make / model", "Installed", "Life", "Est. cost"], rowsFor(l), [4])}<div>Total ${y}: <b>${money(total(l))}</b></div>` : ""; }).join("")}
  <div class="muted" style="margin-top:14px">${noData} service${noData === 1 ? "" : "s"} have no install date or expected life recorded, so aren't included. Add them under Asset details.</div>`;
}

function ReportsModal({ data, locationName, onClose }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [blocked, setBlocked] = useState(false);
  const years = []; for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 1; y++) years.push(y);
  const run = (title, sub, html) => setBlocked(!openPrintReport(title, sub, html));
  const reports = [
    { title: "Monthly compliance pack", desc: "Planned vs logged visits, failed checks, overdue items, open works.", go: () => run("Monthly compliance pack", `${locationName} · ${MONTH_LABELS[month]} ${year}`, buildComplianceReport(data, year, month)) },
    { title: "Annual spend summary", desc: "Budget vs actual by category and month, spend by supplier and service.", go: () => run("Annual spend summary", `${locationName} · ${year}`, buildSpendReport(data, year)) },
    { title: "Monthly management report", desc: "One-page summary for your manager: visits, on-time %, works & SLA, spend, incidents, audits, contractors and what's coming next month.", go: () => run("Monthly management report", `${locationName} · ${MONTH_LABELS[month]} ${year}`, buildManagementReport(data, year, month)) },
    { title: "Asset register", desc: "Every service with area, asset tag, make/model, serial, install date, warranty, supplier, frequency, last and next visit.", go: () => run("Asset register", `${locationName} · ${data.devices.length} services`, buildAssetRegister(data)) },
    { title: "Job sheet — next 7 days", desc: "Overdue and upcoming visits and tasks with access notes, RAMS/permits and sign-off boxes — for the technician or reception.", go: () => run("Job sheet — next 7 days", `${locationName} · ${fmtDate(new Date().toISOString().slice(0, 10))} to ${fmtDate(addDays(new Date().toISOString().slice(0, 10), 7))}`, buildJobSheet(data)) },
    { title: "5-year replacement forecast", desc: "Assets reaching end of life each year with estimated replacement costs — for capital budget planning.", go: () => run("5-year replacement forecast", `${locationName} · ${now.getFullYear()}–${now.getFullYear() + 4}`, buildLifecycleReport(data)) },
    { title: "Supplier performance", desc: "Score, on-time %, checklist pass rate, cost variance, chases and contract dates.", go: () => run("Supplier performance", `${locationName} · ${year}`, buildSupplierReport(data, year)) },
  ];
  return (
    <Modal title="Reports" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Month (compliance pack)"><Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTH_LABELS.map((m, i) => <option key={m} value={i}>{m}</option>)}</Select></Field>
          <Field label="Year"><Select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select></Field>
        </div>
        {reports.map((r) => (
          <button key={r.title} onClick={r.go} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="#2B4562" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title}</div>
              <div style={{ fontSize: 11.5, color: "#8A94A0", marginTop: 2 }}>{r.desc}</div>
            </div>
            <Printer size={16} color="#8A94A0" />
          </button>
        ))}
        <button onClick={() => downloadWorkbook(data, year, locationName)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
          <Download size={20} color="#2F855A" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Excel workbook ({year})</div>
            <div style={{ fontSize: 11.5, color: "#8A94A0", marginTop: 2 }}>Summary, monthly, services, visits, works, plan and suppliers — one sheet each.</div>
          </div>
        </button>
        <AccountingExport data={data} year={year} month={month} />
        {blocked && <div style={{ fontSize: 11.5, color: "#9B2C2C" }}>Your browser blocked the report window — allow pop-ups for this site and try again.</div>}
        <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Each report opens as a print-ready page — choose "Save as PDF" in the print dialog to keep or email it.</div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Supplier scorecard
--------------------------------------------------------- */
function SupplierScorecardModal({ supplier, devices, services, works, budgetLines, visitBudgets, onClose }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const st = supplierStats(supplier, { devices, services, works, budgetLines, visitBudgets }, year);
  const tone = (p) => p === null ? "#8A94A0" : p >= 90 ? "#2F855A" : p >= 70 ? "#B7791F" : "#C53030";
  const priceRows = [
    ...st.visits.filter((v) => v.cost).map((v) => ({ date: v.date, label: devices.find((d) => d.id === v.deviceId)?.name || "Visit", amount: Number(v.cost) })),
    ...st.lines.filter((l) => !isMirrored(l)).map((l) => ({ date: l.date, label: `${l.description} (plan)`, amount: Number(l.actualAmount), budget: Number(l.amount) })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const kpis = [
    ["Score", st.score === null ? "—" : st.score, tone(st.score)],
    ["On time", st.comp.pct === null ? "—" : `${st.comp.pct}%`, tone(st.comp.pct)],
    ["Checks passed", st.checks ? `${Math.round((st.checks - st.fails) / st.checks * 100)}%` : "—", tone(st.checks ? Math.round((st.checks - st.fails) / st.checks * 100) : null)],
    ["Avg vs budget", st.avgVar === null ? "—" : `${st.avgVar > 0 ? "+" : ""}${gbp(st.avgVar)}`, st.avgVar === null ? "#8A94A0" : st.avgVar <= 0 ? "#2F855A" : "#C53030"],
  ];
  return (
    <Modal title={`${supplier.name} — scorecard`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[0, 1, 2, 3].map((i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
        </Select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {kpis.map(([label, val, color]) => (
            <div key={label} style={{ background: "#F7F8F9", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "#8A94A0", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: "#3A4451", lineHeight: 1.7 }}>
          <div>Services assigned: <b>{st.devs.length}</b> · Visits logged: <b>{st.visits.length}</b> · Spend: <b>{gbp(st.spend)}</b></div>
          <div>Planned visits: <b>{st.comp.totals.onTime}</b> on time, <b>{st.comp.totals.late}</b> late, <b style={{ color: st.comp.totals.missed ? "#C53030" : undefined }}>{st.comp.totals.missed}</b> missed</div>
          <div>Failed checks: <b>{st.fails}</b> · Extra jobs / requests: <b>{st.jobs.length}</b> · Times chased: <b>{st.chases}</b></div>
          {supplier.contractEnd && <div>Contract: {supplier.contractStart ? `${fmtDate(supplier.contractStart)} – ` : "ends "}{fmtDate(supplier.contractEnd)}{supplier.contractRef ? ` · ${supplier.contractRef}` : ""}</div>}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 6 }}>Contract rate history</div>
          {(supplier.priceHistory || []).length === 0 ? <div style={{ fontSize: 12, color: "#A3ABB4" }}>Current rate {gbp(supplier.costAmount)} / {supplier.costFrequency === "annual" ? "yr" : "mo"} — earlier rates are recorded here whenever you change it.</div> : (
            <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
              {supplier.priceHistory.map((p, i) => <div key={i}>{gbp(p.amount)} / {p.frequency === "annual" ? "yr" : "mo"} <span style={{ color: "#8A94A0" }}>until {fmtDate(p.until)}</span></div>)}
              <div><b>{gbp(supplier.costAmount)} / {supplier.costFrequency === "annual" ? "yr" : "mo"}</b> <span style={{ color: "#8A94A0" }}>current</span></div>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 6 }}>Price history — visits &amp; recorded costs ({priceRows.length})</div>
          {priceRows.length === 0 ? <div style={{ fontSize: 12, color: "#A3ABB4" }}>No costs recorded for {year}.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflowY: "auto" }}>
              {priceRows.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 8px", background: i % 2 ? "#fff" : "#F7F8F9", borderRadius: 6 }}>
                  <span>{fmtDate(r.date)} · {r.label}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: r.budget != null ? (r.amount <= r.budget ? "#2F855A" : "#C53030") : "#1B2430" }}>{gbp(r.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Score weights on-time visits 50%, checklist pass rate 30% and staying within budget 20%, using whichever have data.</div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Shared: every real cost in a period, attributed to service/supplier/category.
   Mirrored plan-line actuals are skipped (the visit already counts).
--------------------------------------------------------- */
function collectActuals({ devices, services, works, budgetLines }, inRange) {
  const devMap = {}; devices.forEach((d) => { devMap[d.id] = d; });
  const out = [];
  services.forEach((v) => { if (v.cost && v.date && inRange(v.date)) out.push({ id: `v-${v.id}`, kind: "Visit", date: v.date, amount: Number(v.cost) || 0, deviceId: v.deviceId, supplierId: v.supplierId || devMap[v.deviceId]?.supplierId || null, category: devMap[v.deviceId]?.serviceCategory || "maintenance", label: v.name || devMap[v.deviceId]?.name || "Visit", ref: v.poNumber || "" }); });
  works.forEach((w) => { if (w.dateRaised && inRange(w.dateRaised) && w.budgetType !== "non_controllable" && ["approved", "in_progress", "completed"].includes(w.status)) out.push({ id: `w-${w.id}`, kind: "Extra work", date: w.dateRaised, amount: Number(w.quoteAmount) || 0, deviceId: w.deviceId, supplierId: w.supplierId || null, category: devMap[w.deviceId]?.serviceCategory || "maintenance", label: w.description, ref: w.poNumber || "" }); });
  budgetLines.forEach((l) => { if (l.actualAmount != null && !isMirrored(l) && l.date && inRange(l.date)) out.push({ id: `l-${l.id}`, kind: "Plan actual", date: l.actualDate || l.date, amount: Number(l.actualAmount) || 0, deviceId: l.deviceId || null, supplierId: l.supplierId || null, category: l.category, label: l.description, ref: l.poNumber || "" }); });
  return out;
}

/* ---------------------------------------------------------
   Budget → Variance: planned vs actual with filters and drill-down
--------------------------------------------------------- */
function VarianceView({ year, devices, services, works, budgetLines, suppliers }) {
  const [groupBy, setGroupBy] = useState("month");
  const [cat, setCat] = useState("all");
  const [sup, setSup] = useState("all");
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [open, setOpen] = useState(null);
  useEffect(() => { setFrom(`${year}-01-01`); setTo(`${year}-12-31`); }, [year]);
  const devMap = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);
  const supMap = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);
  const inRange = (d) => d >= from && d <= to;
  const pass = (e) => (cat === "all" || e.category === cat) && (sup === "all" || (sup === "none" ? !e.supplierId : e.supplierId === sup));
  const planned = budgetLines.filter((l) => l.date && inRange(l.date)).map((l) => ({ id: `p-${l.id}`, kind: "Planned", date: l.date, amount: Number(l.amount) || 0, deviceId: l.deviceId || null, supplierId: l.supplierId || null, category: l.category, label: l.description })).filter(pass);
  const actual = collectActuals({ devices, services, works, budgetLines }, inRange).filter(pass);
  const keyOf = (e) => groupBy === "month" ? e.date.slice(0, 7) : groupBy === "service" ? (e.deviceId || "__none") : groupBy === "supplier" ? (e.supplierId || "__none") : e.category;
  const nameOf = (k) => {
    if (groupBy === "month") { const [y, m] = k.split("-"); return `${MONTH_LABELS[Number(m) - 1]} ${y}`; }
    if (k === "__none") return groupBy === "service" ? "No service linked" : "No supplier";
    if (groupBy === "service") return devMap[k]?.name || "Removed service";
    if (groupBy === "supplier") return supMap[k]?.name || "Removed supplier";
    return CATEGORY_META[k]?.label || k;
  };
  const groups = {};
  [...planned, ...actual].forEach((e) => { const k = keyOf(e); (groups[k] = groups[k] || { key: k, planned: 0, actual: 0, entries: [] }); if (e.kind === "Planned") groups[k].planned += e.amount; else groups[k].actual += e.amount; groups[k].entries.push(e); });
  const rows = Object.values(groups).map((g) => ({ ...g, variance: g.planned - g.actual }))
    .sort((a, b) => groupBy === "month" ? a.key.localeCompare(b.key) : Math.abs(b.variance) - Math.abs(a.variance));
  const tot = rows.reduce((a, r) => ({ planned: a.planned + r.planned, actual: a.actual + r.actual }), { planned: 0, actual: 0 });
  const vColor = (v) => v >= 0 ? "#2F855A" : "#C53030";
  const cell = { fontFamily: "'IBM Plex Mono', monospace", textAlign: "right", fontSize: 12 };
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["month", "Month"], ["service", "Service"], ["supplier", "Supplier"], ["category", "Category"]].map(([k, l]) => <ToggleButton key={k} active={groupBy === k} onClick={() => { setGroupBy(k); setOpen(null); }}>{l}</ToggleButton>)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} style={{ flex: 1, fontSize: 12.5 }}>
          <option value="all">All categories</option>
          {CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
        </Select>
        <Select value={sup} onChange={(e) => setSup(e.target.value)} style={{ flex: 1, fontSize: 12.5 }}>
          <option value="all">All suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="none">No supplier</option>
        </Select>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ flex: 1, fontSize: 12.5 }} aria-label="From" />
        <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ flex: 1, fontSize: 12.5 }} aria-label="To" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[["Planned", tot.planned, "#1B2430"], ["Actual", tot.actual, "#1B2430"], [tot.planned - tot.actual >= 0 ? "Under" : "Over", Math.abs(tot.planned - tot.actual), vColor(tot.planned - tot.actual)]].map(([l, v, c]) => (
          <div key={l} style={{ background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, color: "#8A94A0", fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(v)}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? <div style={{ fontSize: 12.5, color: "#A3ABB4", textAlign: "center", padding: 16 }}>Nothing planned or spent for these filters.</div> : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#8A94A0", padding: "0 6px 4px" }}>
            <span>{groupBy[0].toUpperCase() + groupBy.slice(1)}</span><span style={{ textAlign: "right" }}>Planned</span><span style={{ textAlign: "right" }}>Actual</span><span style={{ textAlign: "right" }}>Variance</span>
          </div>
          {rows.map((r) => (
            <div key={r.key} style={{ borderTop: "1px solid #EEF0F2" }}>
              <button onClick={() => setOpen(open === r.key ? null : r.key)} style={{ width: "100%", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 4, alignItems: "center", background: open === r.key ? "#F7F8F9" : "none", border: "none", padding: "8px 6px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 12.5, fontWeight: 650, display: "flex", alignItems: "center", gap: 4 }}><ChevronDown size={12} color="#A3ABB4" style={{ transform: open === r.key ? "none" : "rotate(-90deg)" }} />{nameOf(r.key)}</span>
                <span style={cell}>{gbp(r.planned)}</span>
                <span style={cell}>{gbp(r.actual)}</span>
                <span style={{ ...cell, fontWeight: 700, color: vColor(r.variance) }}>{r.variance >= 0 ? "+" : "−"}{gbp(Math.abs(r.variance))}</span>
              </button>
              {open === r.key && (
                <div style={{ padding: "2px 6px 8px 22px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {r.entries.sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5 }}>
                      <span style={{ color: "#5B6672", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fmtDate(e.date)} · <b style={{ color: e.kind === "Planned" ? "#8A94A0" : "#2B4562" }}>{e.kind}</b> · {e.label}{groupBy !== "service" && e.deviceId && devMap[e.deviceId] ? ` · ${devMap[e.deviceId].name}` : ""}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0, color: e.kind === "Planned" ? "#8A94A0" : "#1B2430" }}>{gbp(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Planned = Budget Plan lines. Actual = logged visit costs, approved/in-progress/completed extra works and costs recorded on plan lines. Recurring supplier contract fees and non-controllable works aren't included here. Tap a row to see what makes it up.</div>
    </div>
  );
}

/* ---------------------------------------------------------
   Side-by-side quote comparison on an extra work
--------------------------------------------------------- */
function QuoteComparison({ work, suppliers, currentUserName, onAccept, onChange }) {
  const quotes = work.quotes || [];
  const [adding, setAdding] = useState(false);
  const [qs, setQs] = useState(""); const [qa, setQa] = useState(""); const [qn, setQn] = useState(""); const [qd, setQd] = useState("");
  const cheapest = quotes.length ? Math.min(...quotes.map((q) => q.amount)) : null;
  function add() {
    if (!qa) return;
    onChange([...quotes, { id: uid(), supplierId: qs || null, amount: Number(qa), note: qn.trim(), leadTime: qd.trim(), addedBy: currentUserName || "", at: new Date().toISOString() }]);
    setQs(""); setQa(""); setQn(""); setQd(""); setAdding(false);
  }
  return (
    <div style={{ border: "1px solid #E1E4E8", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: quotes.length || adding ? 8 : 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672" }}>Quotes to compare ({quotes.length})</span>
        {ACTIVE_CAN_EDIT && !adding && <button onClick={() => setAdding(true)} style={{ background: "none", border: "none", color: "#2B4562", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add quote</button>}
      </div>
      {quotes.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: "#8A94A0", fontSize: 10.5, textAlign: "left" }}><th style={{ padding: 4 }}>Supplier</th><th style={{ padding: 4, textAlign: "right" }}>Amount</th><th style={{ padding: 4 }}>Lead time</th><th style={{ padding: 4 }}>Notes</th><th /></tr></thead>
            <tbody>
              {quotes.map((q) => {
                const name = suppliers.find((s) => s.id === q.supplierId)?.name || "Other / not listed";
                const best = q.amount === cheapest && quotes.length > 1;
                return (
                  <tr key={q.id} style={{ borderTop: "1px solid #EEF0F2", background: q.accepted ? "#EAF4EE" : "none" }}>
                    <td style={{ padding: 4, fontWeight: 650 }}>{name}{q.accepted && <span style={{ color: "#2F6B4A" }}> ✓</span>}</td>
                    <td style={{ padding: 4, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: best ? "#2F855A" : "#1B2430" }}>{gbp(q.amount)}{best && <div style={{ fontSize: 9.5, fontFamily: "inherit" }}>lowest</div>}</td>
                    <td style={{ padding: 4, color: "#5B6672" }}>{q.leadTime || "—"}</td>
                    <td style={{ padding: 4, color: "#5B6672" }}>{q.note || "—"}</td>
                    <td style={{ padding: 4, textAlign: "right", whiteSpace: "nowrap" }}>
                      {ACTIVE_CAN_EDIT && !q.accepted && <button onClick={() => onAccept(q, quotes.map((x) => ({ ...x, accepted: x.id === q.id })))} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept</button>}
                      {ACTIVE_CAN_EDIT && <button onClick={() => onChange(quotes.filter((x) => x.id !== q.id))} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}><X size={12} color="#A3ABB4" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Select value={qs} onChange={(e) => setQs(e.target.value)} style={{ flex: 2, fontSize: 12.5 }}>
              <option value="">Supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <TextInput type="number" min="0" value={qa} onChange={(e) => setQa(e.target.value)} placeholder="Amount" style={{ flex: 1, fontSize: 12.5 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={qd} onChange={(e) => setQd(e.target.value)} placeholder="Lead time (e.g. 2 weeks)" style={{ flex: 1, fontSize: 12.5 }} />
            <TextInput value={qn} onChange={(e) => setQn(e.target.value)} placeholder="Notes / inclusions" style={{ flex: 1, fontSize: 12.5 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={add} style={{ flex: 1, background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Add quote</button>
            <button onClick={() => setAdding(false)} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}
      {quotes.length > 1 && !quotes.some((q) => q.accepted) && <div style={{ fontSize: 10.5, color: "#A3ABB4", marginTop: 6 }}>Accepting a quote sets this job's supplier and amount (the approval rule then applies to that amount).</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   Calendar export (.ics) — planned visits for the next 12 months
--------------------------------------------------------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadIcs(devices, tasks, visitBudgets, suppliers, locationName) {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(); horizon.setFullYear(horizon.getFullYear() + 1);
  const end = horizon.toISOString().slice(0, 10);
  const supMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const ymd = (d) => d.replace(/-/g, "");
  const nextDay = (d) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = [];
  devices.forEach((dev) => {
    const dates = new Set(visitBudgets.filter((v) => v.deviceId === dev.id && v.date >= today && v.date <= end).map((v) => v.date));
    if (dev.nextServiceDate && dev.nextServiceDate <= end) dates.add(dev.nextServiceDate);
    const sup = dev.supplierId ? supMap[dev.supplierId] : null;
    dates.forEach((d) => events.push({ uid: `${dev.id}-${d}@ppm-service-book`, date: d, summary: `${dev.name}${sup ? ` — ${sup.name}` : ""}`, desc: `${CATEGORY_META[dev.serviceCategory]?.label || ""} visit${dev.budgetPerVisit ? ` · budget ${gbp(dev.budgetPerVisit)}` : ""}${sup?.managerName ? `\nSupplier contact: ${sup.managerName} ${sup.managerPhone || sup.managerEmail || ""}` : ""}` }));
  });
  tasks.forEach((t) => {
    if (!t.nextDate || t.nextDate > end) return;
    const dev = devices.find((d) => d.id === t.deviceId);
    events.push({ uid: `task-${t.id}-${t.nextDate}@ppm-service-book`, date: t.nextDate, summary: `${t.name}${dev ? ` (${dev.name})` : ""}`, desc: "Recurring task" });
  });
  if (!events.length) return 0;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PPM Service Book//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:PPM — ${esc(locationName)}`];
  events.sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`,
      `SUMMARY:${esc(e.summary)}`, `DESCRIPTION:${esc(e.desc)}`, `LOCATION:${esc(locationName)}`, "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.summary)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  downloadBlob(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }), "ppm-schedule.ics");
  return events.length;
}

/* ---------------------------------------------------------
   Excel (.xlsx) writer — no library: minimal OOXML in an uncompressed zip
--------------------------------------------------------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
  files.forEach((f) => {
    const nameB = enc.encode(f.name); const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const crc = crc32(data); const size = data.length;
    const local = new Uint8Array(30 + nameB.length); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true); lv.setUint16(26, nameB.length, true); local.set(nameB, 30);
    const cen = new Uint8Array(46 + nameB.length); const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint16(28, nameB.length, true); cv.setUint32(42, offset, true); cen.set(nameB, 46);
    parts.push(local, data); central.push(cen); offset += local.length + size;
  });
  const cenSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function xmlEsc(t) { return String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
// sheet: { name, headers: [...], rows: [[...]], money: [colIdx], pct: [colIdx], widths: [...] }
function buildXlsx(sheets) {
  const sheetXml = (sh) => {
    const all = [sh.headers, ...sh.rows];
    const rowsXml = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = `${colName(ci)}${ri + 1}`;
      if (ri === 0) return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEsc(v)}</t></is></c>`;
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}" s="${(sh.money || []).includes(ci) ? 2 : (sh.pct || []).includes(ci) ? 3 : 0}"><v>${v}</v></c>`;
      if (v === null || v === undefined || v === "") return "";
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const cols = sh.headers.map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${(sh.widths || [])[i] || Math.max(10, Math.min(45, String(h).length + 4))}" customWidth="1"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
  };
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sh, i) => `<sheet name="${xmlEsc(sh.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2B4562"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((sh, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(sh) })),
  ];
  return zipStore(files);
}
function workbookSheets(data, year) {
  const { devices, services, works, suppliers, budgets, budgetLines, deviceById, supplierById } = data;
  const yr = (d) => d && new Date(d).getFullYear() === year;
  const sName = (id) => (id && supplierById[id]?.name) || "";
  const dName = (id) => (id && deviceById[id]?.name) || "";
  const actuals = collectActuals(data, yr);
  const cur = ACTIVE_CURRENCY_CODE;
  const summary = CATEGORY_KEYS.map((c) => {
    const cap = Number(budgets.find((b) => b.year === year && b.category === c)?.amount) || 0;
    const planned = budgetLines.filter((l) => yr(l.date) && l.category === c).reduce((a, l) => a + (Number(l.amount) || 0), 0);
    const contracts = suppliers.filter((s) => s.category === c).reduce((a, s) => a + (s.costFrequency === "annual" ? Number(s.costAmount) || 0 : (Number(s.costAmount) || 0) * 12), 0);
    const logged = actuals.filter((a) => a.category === c).reduce((x, a) => x + a.amount, 0);
    const target = cap || planned; const actual = logged + contracts;
    return [CATEGORY_META[c].label, cap, planned, logged, contracts, actual, target - actual, target ? actual / target : ""];
  });
  const monthly = MONTH_LABELS.map((m, i) => {
    const inM = (d) => new Date(d).getMonth() === i;
    const planned = budgetLines.filter((l) => yr(l.date) && inM(l.date)).reduce((a, l) => a + (Number(l.amount) || 0), 0);
    const act = actuals.filter((a) => inM(a.date)).reduce((x, a) => x + a.amount, 0);
    return [`${m} ${year}`, planned, act, planned - act];
  });
  const withCustom = (sheet, appliesTo, records) => {
    const fields = ACTIVE_CUSTOM_FIELDS.filter((f) => f.appliesTo === appliesTo);
    if (!fields.length) return sheet;
    return { ...sheet, headers: [...sheet.headers, ...fields.map((f) => f.label)], rows: sheet.rows.map((r, i) => [...r, ...fields.map((f) => { const v = records[i]?.custom?.[f.id]; return v === true ? "Yes" : v === false ? "No" : v ?? ""; })]), widths: [...(sheet.widths || []), ...fields.map(() => 16)] };
  };
  const svcRecords = devices;
  const visitRecords = services.filter((v) => yr(v.date)).sort((a, b) => a.date.localeCompare(b.date));
  const workRecords = works.filter((w) => yr(w.dateRaised));
  const sheets = [
    { name: "Summary", headers: ["Category", `Cap (${cur})`, `Planned (${cur})`, `Logged spend (${cur})`, `Supplier contracts (${cur})`, `Total actual (${cur})`, `Variance (${cur})`, "Used"], rows: summary, money: [1, 2, 3, 4, 5, 6], pct: [7], widths: [16, 14, 14, 18, 20, 16, 14, 8] },
    { name: "Monthly", headers: ["Month", `Planned (${cur})`, `Actual (${cur})`, `Variance (${cur})`], rows: monthly, money: [1, 2, 3], widths: [14, 16, 16, 16] },
    // custom field columns are appended to the relevant sheets below
    { name: "Services", headers: ["Service", "Category", "Subcategory", "Supplier", "Repeat (months)", "Next due", "Last done", `Budget/visit (${cur})`, "Checklist items"], rows: devices.map((d) => [d.name, CATEGORY_META[d.serviceCategory]?.label || "", d.subCategory || "", sName(d.supplierId), d.serviceIntervalMonths || "", d.nextServiceDate || "", d.lastServiceDate || "", Number(d.budgetPerVisit) || 0, (d.checklist || []).length]), money: [7], widths: [28, 13, 16, 22, 14, 12, 12, 16, 14] },
    { name: "Visits", headers: ["Date", "Service", "Visit", "Supplier", "Technician", "PO", `Cost (${cur})`, "Checks passed", "Checks failed", "Signed by technician", "Signed by site contact", "GPS", "Notes"], rows: services.filter((v) => yr(v.date)).sort((a, b) => a.date.localeCompare(b.date)).map((v) => [v.date, dName(v.deviceId), v.name || "", sName(v.supplierId), v.technician || "", v.poNumber || "", Number(v.cost) || 0, (v.checklistResults || []).filter((r) => r.result === "pass").length, (v.checklistResults || []).filter((r) => r.result === "fail").length, v.signatures?.technician ? (v.signatures.technician.name || "Yes") : "", v.signatures?.site ? (v.signatures.site.name || "Yes") : "", v.gps ? `${v.gps.lat.toFixed(5)}, ${v.gps.lng.toFixed(5)}` : "", v.notes || ""]), money: [6], widths: [12, 24, 22, 20, 16, 12, 12, 13, 13, 20, 22, 22, 40] },
    { name: "Extra works", headers: ["Raised", "Service", "Description", "Priority", "Status", "Supplier", "PO", `Amount (${cur})`, "Budget type", "Approved by", "Quotes"], rows: works.filter((w) => yr(w.dateRaised)).map((w) => [w.dateRaised || "", dName(w.deviceId), w.description || "", w.priority || "medium", (WORK_STATUSES.find((s) => s.key === w.status) || {}).label || w.status, sName(w.supplierId), w.poNumber || "", Number(w.quoteAmount) || 0, w.budgetType === "non_controllable" ? "Non-controllable" : "Budgeted", w.approvedBy || "", (w.quotes || []).length]), money: [7], widths: [12, 22, 40, 10, 12, 20, 12, 14, 16, 16, 8] },
    { name: "Budget plan", headers: ["Date", "Description", "Category", "Supplier", `Budgeted (${cur})`, `Actual (${cur})`, `Variance (${cur})`, "Actual from"], rows: budgetLines.filter((l) => yr(l.date)).sort((a, b) => a.date.localeCompare(b.date)).map((l) => [l.date, l.description, CATEGORY_META[l.category]?.label || "", sName(l.supplierId), Number(l.amount) || 0, l.actualAmount != null ? Number(l.actualAmount) : "", l.actualAmount != null ? Number(l.amount) - Number(l.actualAmount) : "", l.actualAmount == null ? "" : isMirrored(l) ? "Logged visit" : "Entered on plan"]), money: [4, 5, 6], widths: [12, 30, 13, 20, 14, 14, 14, 16] },
    { name: "Suppliers", headers: ["Supplier", "Category", "Manager", "Email", "Phone", `Rate (${cur})`, "Per", "Contract start", "Contract end", "Score", "On time"], rows: suppliers.map((s) => { const st = supplierStats(s, data, year); return [s.name, CATEGORY_META[s.category]?.label || "", s.managerName || "", s.managerEmail || "", s.managerPhone || "", Number(s.costAmount) || 0, s.costFrequency === "annual" ? "year" : "month", s.contractStart || "", s.contractEnd || "", st.score ?? "", st.comp.pct === null ? "" : st.comp.pct / 100]; }), money: [5], pct: [10], widths: [22, 13, 18, 26, 14, 12, 8, 14, 14, 8, 9] },
  ];
  return sheets.map((sh) => sh.name === "Services" ? withCustom(sh, "service", svcRecords) : sh.name === "Visits" ? withCustom(sh, "visit", visitRecords) : sh.name === "Extra works" ? withCustom(sh, "work", workRecords) : sh);
}
function downloadWorkbook(data, year, locationName) {
  const safe = (locationName || "ppm").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  downloadBlob(buildXlsx(workbookSheets(data, year)), `ppm-${safe}-${year}.xlsx`);
}

/* ---------------------------------------------------------
   Accounting export — CSV in the layout of common bill-import templates
--------------------------------------------------------- */
function csvEscape(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function ukDate(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function plusDays(iso, n) { const x = new Date(iso + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function buildAccountingCsv(format, items, supMap, accountCode) {
  const ref = (it) => it.ref || `PPM-${it.id.slice(-6).toUpperCase()}`;
  const supName = (it) => (it.supplierId && supMap[it.supplierId]?.name) || "Unassigned supplier";
  const accRef = (it) => supName(it).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
  let headers, rows;
  if (format === "xero") {
    headers = ["*ContactName", "*InvoiceNumber", "*InvoiceDate", "*DueDate", "Description", "*Quantity", "*UnitAmount", "*AccountCode", "*TaxType"];
    rows = items.map((it) => [supName(it), ref(it), ukDate(it.date), ukDate(plusDays(it.date, 30)), `${it.kind}: ${it.label}`, 1, it.amount.toFixed(2), accountCode, "20% (VAT on Expenses)"]);
  } else if (format === "quickbooks") {
    headers = ["Bill No", "Supplier", "Bill Date", "Due Date", "Terms", "Memo", "Account", "Line Description", "Line Amount", "Line Tax Code"];
    rows = items.map((it) => [ref(it), supName(it), ukDate(it.date), ukDate(plusDays(it.date, 30)), "Net 30", "PPM Service Book export", accountCode, `${it.kind}: ${it.label}`, it.amount.toFixed(2), "20.0% S"]);
  } else {
    headers = ["Type", "Account Reference", "Nominal A/C Ref", "Department Code", "Date", "Reference", "Details", "Net Amount", "Tax Code", "Tax Amount"];
    rows = items.map((it) => ["PI", accRef(it), accountCode, "", ukDate(it.date), ref(it), `${it.kind}: ${it.label}`.slice(0, 60), it.amount.toFixed(2), "T1", (it.amount * 0.2).toFixed(2)]);
  }
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}
function AccountingExport({ data, year, month }) {
  const [format, setFormat] = useState("xero");
  const [period, setPeriod] = useState("month");
  const [accountCode, setAccountCode] = useState("");
  const [msg, setMsg] = useState("");
  const supMap = data.supplierById;
  function go() {
    const mm = String(month + 1).padStart(2, "0");
    const inRange = period === "month" ? (d) => d.startsWith(`${year}-${mm}`) : (d) => d.startsWith(`${year}-`);
    const items = collectActuals(data, inRange).filter((i) => i.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (!items.length) { setMsg("No costs recorded in that period."); return; }
    const csv = buildAccountingCsv(format, items, supMap, accountCode.trim());
    downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `ppm-${format}-${period === "month" ? `${year}-${mm}` : year}.csv`);
    setMsg(`${items.length} line${items.length === 1 ? "" : "s"} exported (${gbp(items.reduce((a, i) => a + i.amount, 0))}).`);
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Receipt size={20} color="#8E4585" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Accounting export (CSV)</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0", marginTop: 2 }}>Costs laid out as bill lines for import.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Select value={format} onChange={(e) => setFormat(e.target.value)} style={{ flex: 1, fontSize: 12.5 }}>
          <option value="xero">Xero</option><option value="quickbooks">QuickBooks Online</option><option value="sage">Sage 50 / Accounting</option>
        </Select>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ flex: 1, fontSize: 12.5 }}>
          <option value="month">{MONTH_LABELS[month]} {year}</option><option value="year">All of {year}</option>
        </Select>
      </div>
      <TextInput value={accountCode} onChange={(e) => setAccountCode(e.target.value)} placeholder={format === "sage" ? "Nominal code, e.g. 7800 (optional)" : "Account code, e.g. 429 (optional)"} style={{ fontSize: 12.5 }} />
      <button onClick={go} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Download size={14} /> Download CSV</button>
      {msg && <div style={{ fontSize: 11.5, color: "#2F6B4A" }}>{msg}</div>}
      <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Amounts are exported as net of VAT at the standard 20% rate. Import templates vary by account and change over time — check the column names against your system's current bill-import template, and fill in account codes and (for Sage) supplier account references to match your ledger. PO numbers are used as the invoice reference where set.</div>
    </div>
  );
}

/* ---------------------------------------------------------
   Schedule → Capacity: planned visits per supplier per week, plus technician workload
--------------------------------------------------------- */
function weekStart(iso) { const d = new Date(iso + "T00:00:00"); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.toISOString().slice(0, 10); }
function CapacityView({ devices, tasks, visitBudgets, suppliers, services }) {
  const [limit, setLimit] = useState(5);
  const [openCell, setOpenCell] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, i * 7));
  const pastWeeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, (i - 7) * 7));
  const supMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const devMap = Object.fromEntries(devices.map((d) => [d.id, d]));
  const items = [];
  devices.forEach((d) => {
    const dates = new Set(visitBudgets.filter((v) => v.deviceId === d.id && v.date >= thisWeek).map((v) => v.date));
    if (d.nextServiceDate) dates.add(d.nextServiceDate);
    dates.forEach((date) => items.push({ date: date < thisWeek ? thisWeek : date, overdue: date < today, label: d.name, sup: d.supplierId || "__none" }));
  });
  tasks.forEach((t) => { if (t.nextDate) items.push({ date: t.nextDate < thisWeek ? thisWeek : t.nextDate, overdue: t.nextDate < today, label: `${t.name} (task)`, sup: devMap[t.deviceId]?.supplierId || "__none" }); });
  const grid = {};
  items.forEach((it) => { const w = weekStart(it.date); if (!weeks.includes(w)) return; const k = `${it.sup}|${w}`; (grid[k] = grid[k] || []).push(it); });
  const rows = [...new Set(items.map((i) => i.sup))].sort((a, b) => (a === "__none") - (b === "__none") || (supMap[a]?.name || "").localeCompare(supMap[b]?.name || ""));
  const techGrid = {}; const techs = new Set();
  services.forEach((v) => { if (!v.date) return; const w = weekStart(v.date); if (!pastWeeks.includes(w)) return; const t = (v.technician || "").trim() || "Not recorded"; techs.add(t); techGrid[`${t}|${w}`] = (techGrid[`${t}|${w}`] || 0) + 1; });
  const wk = (w) => { const d = new Date(w + "T00:00:00"); return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`; };
  const cellStyle = (n, over) => ({ textAlign: "center", fontSize: 12, fontWeight: 700, padding: "6px 2px", borderRadius: 6, cursor: n ? "pointer" : "default", border: "none", fontFamily: "inherit", width: "100%",
    background: !n ? "#F7F8F9" : over ? "#FBEAEA" : `rgba(43,69,98,${Math.min(0.12 + n * 0.1, 0.55)})`, color: !n ? "#C0C6CC" : over ? "#C53030" : n >= 3 ? "#fff" : "#1B2430" });
  const open = openCell ? grid[openCell] || [] : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Planned visits per supplier — next 8 weeks</div>
          <label style={{ fontSize: 11, color: "#5B6672", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>Flag over
            <input type="number" min="1" value={limit} onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))} style={{ width: 38, padding: "2px 4px", border: "1px solid #D7DCE1", borderRadius: 5, fontSize: 11 }} /> /wk</label>
        </div>
        {rows.length === 0 ? <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing planned in the next 8 weeks.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 3, width: "100%", minWidth: 420 }}>
              <thead><tr><th style={{ textAlign: "left", fontSize: 10.5, color: "#8A94A0" }}>Supplier</th>{weeks.map((w) => <th key={w} style={{ fontSize: 10, color: "#8A94A0", fontWeight: 600, whiteSpace: "nowrap" }}>{wk(w)}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r}>
                  <td style={{ fontSize: 12, fontWeight: 650, whiteSpace: "nowrap", paddingRight: 6 }}>{r === "__none" ? "No supplier" : supMap[r]?.name || "Unknown"}</td>
                  {weeks.map((w) => { const k = `${r}|${w}`; const n = (grid[k] || []).length; return <td key={w}><button onClick={() => n && setOpenCell(openCell === k ? null : k)} style={{ ...cellStyle(n, n > limit), outline: openCell === k ? "2px solid #D97706" : "none" }}>{n || "·"}</button></td>; })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {openCell && (
          <div style={{ marginTop: 8, background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5B6672", marginBottom: 4 }}>{openCell.split("|")[0] === "__none" ? "No supplier" : supMap[openCell.split("|")[0]]?.name} · week of {wk(openCell.split("|")[1])}</div>
            {open.sort((a, b) => a.date.localeCompare(b.date)).map((it, i) => <div key={i} style={{ fontSize: 12, color: it.overdue ? "#C53030" : "#1B2430" }}>{it.overdue ? "Overdue — " : `${fmtDate(it.date)} · `}{it.label}</div>)}
          </div>
        )}
        <div style={{ fontSize: 10.5, color: "#A3ABB4", marginTop: 8 }}>Counts each service's planned dates and recurring tasks by its default supplier. Overdue items are counted in the current week. Use Month view → Move to spread out busy weeks.</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Technician workload — visits logged, last 8 weeks</div>
        {techs.size === 0 ? <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>No visits logged in the last 8 weeks.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 3, width: "100%", minWidth: 420 }}>
              <thead><tr><th style={{ textAlign: "left", fontSize: 10.5, color: "#8A94A0" }}>Technician</th>{pastWeeks.map((w) => <th key={w} style={{ fontSize: 10, color: "#8A94A0", fontWeight: 600, whiteSpace: "nowrap" }}>{wk(w)}</th>)}</tr></thead>
              <tbody>{[...techs].sort().map((t) => (
                <tr key={t}><td style={{ fontSize: 12, fontWeight: 650, whiteSpace: "nowrap", paddingRight: 6 }}>{t}</td>
                  {pastWeeks.map((w) => { const n = techGrid[`${t}|${w}`] || 0; return <td key={w}><div style={cellStyle(n, false)}>{n || "·"}</div></td>; })}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Holidays & blackout periods
--------------------------------------------------------- */
function BlackoutsModal({ blackouts, avoidWeekends, onClose, onSave, onShift }) {
  const [list, setList] = useState(blackouts);
  const [weekends, setWeekends] = useState(avoidWeekends);
  const [name, setName] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [msg, setMsg] = useState("");
  const yr = new Date().getFullYear();
  const presets = [
    { name: `Christmas shutdown ${yr}`, start: `${yr}-12-24`, end: `${yr + 1}-01-01` },
    { name: `Summer bank holiday ${yr + 1}`, start: `${yr + 1}-08-31`, end: `${yr + 1}-08-31` },
  ];
  function add(b) {
    if (!b.name.trim() || !b.start) return;
    const e = b.end && b.end >= b.start ? b.end : b.start;
    const next = [...list, { id: uid(), name: b.name.trim(), start: b.start, end: e }].sort((a, c) => a.start.localeCompare(c.start));
    setList(next); onSave(next, weekends); setName(""); setStart(""); setEnd(""); setMsg("");
  }
  return (
    <Modal title="Holidays & blackout periods" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>No visits are scheduled inside these dates at this location. New schedules and repeat visits automatically move to the next available day.</div>
        {list.length === 0 ? <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>No blackout periods yet.</div> : list.map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F8F9", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 650 }}>{b.name}</div><div style={{ fontSize: 11.5, color: "#8A94A0" }}>{fmtDate(b.start)}{b.end !== b.start ? ` – ${fmtDate(b.end)}` : ""}</div></div>
            <button onClick={() => { const next = list.filter((x) => x.id !== b.id); setList(next); onSave(next, weekends); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#A3ABB4" /></button>
          </div>
        ))}
        <div style={{ border: "1px solid #E1E4E8", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Office closure" />
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="From"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="To"><TextInput type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <PrimaryButton onClick={() => add({ name, start, end })}><Plus size={15} /> Add blackout</PrimaryButton>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {presets.filter((p) => !list.some((b) => b.name === p.name)).map((p) => <button key={p.name} onClick={() => add(p)} style={{ background: "#EEF0F2", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>+ {p.name}</button>)}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={weekends} onChange={(e) => { setWeekends(e.target.checked); onSave(list, e.target.checked); }} /> Also avoid weekends (move Sat/Sun to Monday)
        </label>
        <button onClick={() => { const n = onShift(); setMsg(n ? `Moved ${n} planned date${n === 1 ? "" : "s"} out of blackouts${weekends ? " and weekends" : ""}.` : "Nothing needed moving."); }} style={{ background: "#FDF1E0", border: "1px solid #E6D9BC", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#8A5A0B", cursor: "pointer", fontFamily: "inherit" }}>
          Move existing planned visits out of these dates
        </button>
        {msg && <div style={{ fontSize: 12, color: "#2F6B4A" }}>{msg}</div>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Suggested 12-month plan, from each service's history
--------------------------------------------------------- */
function median(arr) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function suggestForDevice(dev, services, visitBudgets, shiftDateFn) {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })();
  const t = (d) => new Date(d + "T00:00:00").getTime();
  const visits = services.filter((v) => v.deviceId === dev.id && v.date).sort((a, b) => a.date.localeCompare(b.date));
  const planned = [...new Set(visitBudgets.filter((v) => v.deviceId === dev.id).map((v) => v.date))].sort();
  const gaps = (list) => list.slice(1).map((d, i) => Math.round((t(d) - t(list[i])) / 86400000)).filter((g) => g > 0);
  let step = null, basis = "";
  if (dev.serviceIntervalMonths) { step = { months: dev.serviceIntervalMonths }; basis = `repeats every ${dev.serviceIntervalMonths} month${dev.serviceIntervalMonths === 1 ? "" : "s"}`; }
  else if (visits.length >= 3) { const g = median(gaps(visits.map((v) => v.date))); if (g) { step = g >= 25 ? { months: Math.max(1, Math.round(g / 30.44)) } : { days: g }; basis = `from ${visits.length} logged visits`; } }
  if (!step && planned.length >= 2) { const g = median(gaps(planned)); if (g) { step = g >= 25 ? { months: Math.max(1, Math.round(g / 30.44)) } : { days: g }; basis = "from its current plan"; } }
  if (!step && visits.length === 2) { const g = gaps(visits.map((v) => v.date))[0]; if (g) { step = g >= 25 ? { months: Math.max(1, Math.round(g / 30.44)) } : { days: g }; basis = "from 2 logged visits"; } }
  if (!step) return { dev, skip: "One-off or not enough history to spot a pattern" };
  const costs = visits.filter((v) => Number(v.cost) > 0).slice(-3).map((v) => Number(v.cost));
  const amount = costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : Number(dev.budgetPerVisit) || 0;
  const costBasis = costs.length ? `avg of last ${costs.length} visit${costs.length === 1 ? "" : "s"}` : amount ? "budget per visit" : "no cost data";
  const advance = (d) => step.months ? addMonths(d, step.months) : addDays(d, step.days);
  let d = dev.nextServiceDate || (visits.length ? advance(visits[visits.length - 1].date) : today);
  while (d < today) d = advance(d);
  const dates = [];
  for (let i = 0; i < 400 && d <= horizon; i++) { dates.push(shiftDateFn(d)); d = advance(d); }
  const fresh = [...new Set(dates)].filter((x) => !planned.some((p) => Math.abs(t(p) - t(x)) <= 7 * 86400000));
  const label = step.months ? `every ${step.months} month${step.months === 1 ? "" : "s"}` : step.days % 7 === 0 ? `every ${step.days / 7} week${step.days === 7 ? "" : "s"}` : `every ${step.days} days`;
  return { dev, dates: fresh, total: dates.length, already: dates.length - fresh.length, amount, basis, costBasis, label };
}
function SuggestPlanModal({ devices, services, visitBudgets, shiftDateFn, onClose, onApply }) {
  const suggestions = useMemo(() => devices.map((d) => suggestForDevice(d, services, visitBudgets, shiftDateFn)), [devices, services, visitBudgets]);
  const usable = suggestions.filter((s) => !s.skip && s.dates.length > 0);
  const [picked, setPicked] = useState(() => new Set(usable.map((s) => s.dev.id)));
  const chosen = usable.filter((s) => picked.has(s.dev.id));
  const total = chosen.reduce((a, s) => a + s.dates.length * s.amount, 0);
  return (
    <Modal title="Suggested 12-month plan" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#5B6672" }}>Worked out from each service's repeat setting or visit history. Only dates not already in your plan are added; blackout days are avoided.</div>
        {suggestions.map((s) => s.skip || s.dates.length === 0 ? (
          <div key={s.dev.id} style={{ fontSize: 12, color: "#A3ABB4", padding: "4px 2px" }}><b style={{ color: "#8A94A0" }}>{s.dev.name}</b> — {s.skip || `already fully planned (${s.already} visits)`}</div>
        ) : (
          <label key={s.dev.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid #E1E4E8", borderRadius: 10, padding: 10, cursor: "pointer", background: picked.has(s.dev.id) ? "#fff" : "#F7F8F9" }}>
            <input type="checkbox" checked={picked.has(s.dev.id)} onChange={(e) => { const n = new Set(picked); e.target.checked ? n.add(s.dev.id) : n.delete(s.dev.id); setPicked(n); }} style={{ marginTop: 3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{s.dev.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(s.dates.length * s.amount)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "#5B6672", marginTop: 2 }}>{s.dates.length} visit{s.dates.length === 1 ? "" : "s"} · {s.label} ({s.basis}) · {gbp(s.amount)} each ({s.costBasis}){s.already ? ` · ${s.already} already planned` : ""}</div>
              <div style={{ fontSize: 10.5, color: "#8A94A0", marginTop: 3 }}>{s.dates.slice(0, 6).map(fmtDate).join(", ")}{s.dates.length > 6 ? ` … +${s.dates.length - 6} more` : ""}</div>
            </div>
          </label>
        ))}
        {usable.length === 0 ? <div style={{ fontSize: 12.5, color: "#8A94A0" }}>Nothing to add — every repeating service is already planned for the next 12 months.</div> : (
          <PrimaryButton onClick={() => onApply(chosen.map((s) => ({ deviceId: s.dev.id, dates: s.dates, amount: s.amount })))}>
            <Plus size={15} /> Add {chosen.reduce((a, s) => a + s.dates.length, 0)} visits to plan ({gbp(total)})
          </PrimaryButton>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Signature pad (finger / stylus / mouse)
--------------------------------------------------------- */
function SignaturePad({ value, onChange, height = 130 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const dirty = useRef(false);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1B2430";
  }, [value]);
  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); const sx = canvasRef.current.width / (r.width || canvasRef.current.width); const sy = canvasRef.current.height / (r.height || canvasRef.current.height); return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }; };
  function down(e) { e.preventDefault(); drawing.current = true; last.current = pos(e); canvasRef.current.setPointerCapture?.(e.pointerId); }
  function move(e) {
    if (!drawing.current) return; e.preventDefault();
    const ctx = canvasRef.current.getContext("2d"); const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; dirty.current = true;
  }
  function up() { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(canvasRef.current.toDataURL("image/png")); }
  if (value) {
    return (
      <div style={{ position: "relative", border: "1px solid #D7DCE1", borderRadius: 10, background: "#fff", height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={value} alt="signature" style={{ maxWidth: "100%", maxHeight: height - 8 }} />
        <button type="button" onClick={() => { dirty.current = false; onChange(null); }} style={{ position: "absolute", top: 6, right: 6, background: "#EEF0F2", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} width={600} height={height * 2} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ width: "100%", height, border: "1px dashed #9AA5B1", borderRadius: 10, background: "#FAFBFC", touchAction: "none", display: "block", cursor: "crosshair" }} />
      <span style={{ position: "absolute", left: 12, bottom: 8, fontSize: 11, color: "#A3ABB4", pointerEvents: "none" }}>Sign here with your finger</span>
    </div>
  );
}

function GpsStamp({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  function stamp() {
    if (!navigator.geolocation) { setErr("Location isn't available on this device."); return; }
    setBusy(true); setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onChange({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0), at: new Date().toISOString() }); },
      (e) => { setBusy(false); setErr(e.code === 1 ? "Location permission was blocked — allow it for this site in your browser settings." : "Couldn't get a location fix — try again near a window or outside."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEF0F2", borderRadius: 9, padding: "9px 11px", fontSize: 12.5 }}>
        <MapPin size={15} color="#2B4562" />
        <span style={{ flex: 1 }}>{value.lat.toFixed(5)}, {value.lng.toFixed(5)}{value.accuracy ? ` (±${value.accuracy} m)` : ""} · <a href={`https://www.google.com/maps?q=${value.lat},${value.lng}`} target="_blank" rel="noreferrer" style={{ color: "#2B4562", fontWeight: 650 }}>map</a></span>
        <button type="button" onClick={() => onChange(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color="#8A94A0" /></button>
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={stamp} disabled={busy} style={{ width: "100%", minHeight: 44, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 10, fontSize: 13.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <MapPin size={15} />} {busy ? "Getting location…" : "Add location stamp"}
      </button>
      {err && <div style={{ fontSize: 11.5, color: "#C53030", marginTop: 4 }}>{err}</div>}
    </div>
  );
}

function SignOffSection({ signatures, onChange, gps, onGps, defaultTechName = "" }) {
  const set = (who, patch) => onChange({ ...signatures, [who]: { ...(signatures[who] || {}), ...patch, at: new Date().toISOString() } });
  const clear = (who) => { const n = { ...signatures }; delete n[who]; onChange(n); };
  const block = (who, label, placeholder) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>{label}</div>
      <TextInput value={signatures[who]?.name ?? (who === "technician" ? defaultTechName : "")} onChange={(e) => set(who, { name: e.target.value })} placeholder={placeholder} />
      <SignaturePad value={signatures[who]?.image || null} onChange={(img) => img ? set(who, { image: img, name: signatures[who]?.name ?? (who === "technician" ? defaultTechName : "") }) : clear(who)} />
    </div>
  );
  return (
    <div style={{ background: "#F7F8F9", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Sign-off</div>
      {block("technician", "Technician", "Technician name")}
      {block("site", "Site contact", "Site contact name")}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Location</div>
      <GpsStamp value={gps} onChange={onGps} />
    </div>
  );
}

/* ---------------------------------------------------------
   Quick log — phone-first: pick (or scan) a service, photo, cost, checks, sign, save
--------------------------------------------------------- */
function QuickLogModal({ devices, suppliers, initialDeviceId, currentUserName, onScan, onClose, onSave }) {
  const [deviceId, setDeviceId] = useState(initialDeviceId || null);
  const [q, setQ] = useState("");
  const device = devices.find((d) => d.id === deviceId) || null;
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cost, setCost] = useState("");
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState([]);
  const [signatures, setSignatures] = useState({});
  const [gps, setGps] = useState(null);
  const [custom, setCustom] = useState({});
  const [err, setErr] = useState("");
  useEffect(() => {
    setChecks((device?.checklist || []).map((item) => ({ item, result: "", note: "" })));
    setCost(device?.budgetPerVisit ? String(device.budgetPerVisit) : "");
  }, [deviceId]);
  async function handleFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); try { setPhoto(await compressImage(f)); } catch (x) { /* retry */ } setBusy(false);
  }
  function save() {
    if (!device) return;
    if (checks.some((c) => c.result === "fail" && !c.note.trim())) { setErr("Add a short note for each failed check."); return; }
    const miss = missingRequiredFields("visit", device.serviceCategory, custom);
    if (miss.length) { setErr(`Please fill in: ${miss.join(", ")}`); return; }
    onSave({
      deviceId: device.id, name: `${(CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).label} visit`,
      date: new Date().toISOString().slice(0, 10), technician: technician.trim(), supplierId: device.supplierId || "",
      notes: notes.trim(), cost: cost ? Number(cost) : 0, certificatePhoto: photo, poNumber: "",
      checklistResults: checks.length ? checks : undefined,
      signatures: signatures.technician || signatures.site ? signatures : undefined, gps: gps || undefined, source: "quick-log",
      custom: Object.keys(custom).length ? custom : undefined,
    });
  }
  const big = { minHeight: 52, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };

  if (!device) {
    const today = new Date().toISOString().slice(0, 10);
    const list = devices.filter((d) => !q.trim() || `${d.name} ${d.assetTag || ""} ${d.category || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => (a.nextServiceDate || "9999").localeCompare(b.nextServiceDate || "9999"));
    return (
      <Modal title="Quick log — pick a service" onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onScan} style={{ ...big, background: "#1B2430", color: "#fff", border: "none" }}><QrCode size={20} /> Scan QR code or asset tag</button>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="…or search by name / asset tag" style={{ fontSize: 15, padding: "12px 14px" }} />
          {list.map((d) => {
            const n = daysUntil(d.nextServiceDate);
            const tone = n === null ? "#8A94A0" : n < 0 ? "#C53030" : n <= 7 ? "#B7791F" : "#2F855A";
            return (
              <button key={d.id} onClick={() => setDeviceId(d.id)} style={{ ...big, justifyContent: "space-between", background: "#fff", border: "1px solid #E1E4E8", borderLeft: `4px solid ${(CATEGORY_META[d.serviceCategory] || CATEGORY_META.maintenance).color}`, padding: "10px 14px", textAlign: "left" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15 }}>{d.name}</span>
                  {d.assetTag && <span style={{ display: "block", fontSize: 11.5, color: "#8A94A0", fontWeight: 500 }}>{d.assetTag}</span>}
                </span>
                <span style={{ fontSize: 12, color: tone, fontWeight: 700, whiteSpace: "nowrap" }}>{n === null ? "—" : n < 0 ? `${-n}d overdue` : n === 0 ? "Due today" : `Due in ${n}d`}</span>
              </button>
            );
          })}
          {list.length === 0 && <div style={{ fontSize: 13, color: "#A3ABB4", textAlign: "center", padding: 12 }}>No services match.</div>}
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={device.name} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!initialDeviceId && <button onClick={() => setDeviceId(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#2B4562", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>‹ Change service</button>}
        <label style={{ ...big, minHeight: photo ? 0 : 120, background: photo ? "transparent" : "#2B4562", color: "#fff", flexDirection: "column", border: "none", padding: photo ? 0 : 12 }}>
          {photo ? <img src={photo} alt="" style={{ width: "100%", borderRadius: 12 }} /> : <>{busy ? <Loader2 size={30} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={32} />}<span>Take photo of work / certificate</span></>}
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
        </label>
        {photo && <label style={{ ...big, minHeight: 40, fontSize: 13, background: "#EEF0F2", color: "#2B4562" }}><Camera size={15} /> Retake<input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} /></label>}
        <div style={{ display: "flex", gap: 10 }}>
          <Field label={`Cost (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" style={{ fontSize: 20, padding: "12px 14px", fontWeight: 700 }} /></Field>
          <Field label="Technician"><TextInput value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Name" style={{ fontSize: 15, padding: "12px 14px" }} /></Field>
        </div>
        {checks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#5B6672" }}>Checklist ({checks.filter((c) => c.result).length}/{checks.length})</div>
            {checks.map((c, i) => (
              <div key={i} style={{ background: c.result === "fail" ? "#FBEAEA" : "#F7F8F9", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>{c.item}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["pass", "Pass", "#2F855A"], ["fail", "Fail", "#C53030"], ["na", "N/A", "#8A94A0"]].map(([k, l, col]) => (
                    <button key={k} type="button" onClick={() => setChecks((p) => p.map((x, idx) => idx === i ? { ...x, result: x.result === k ? "" : k } : x))}
                      style={{ flex: 1, minHeight: 44, borderRadius: 9, border: `2px solid ${col}`, background: c.result === k ? col : "#fff", color: c.result === k ? "#fff" : col, fontSize: 14, fontWeight: 750, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                  ))}
                </div>
                {c.result === "fail" && <TextInput value={c.note} onChange={(e) => setChecks((p) => p.map((x, idx) => idx === i ? { ...x, note: e.target.value } : x))} placeholder="What's wrong?" style={{ width: "100%", marginTop: 8, fontSize: 14 }} />}
              </div>
            ))}
            {checks.some((c) => c.result === "fail") && <div style={{ fontSize: 11.5, color: "#9B2C2C" }}>Failed checks create high-priority follow-up jobs in Works.</div>}
          </div>
        )}
        <CustomFieldInputs appliesTo="visit" category={device.serviceCategory} values={custom} onChange={setCustom} large />
        <Field label="Notes (optional)"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to report?" style={{ fontSize: 14 }} /></Field>
        <SignOffSection signatures={signatures} onChange={setSignatures} gps={gps} onGps={setGps} defaultTechName={technician} />
        {err && <div style={{ fontSize: 12.5, color: "#C53030" }}>{err}</div>}
        <button onClick={save} style={{ ...big, background: "#2F855A", color: "#fff", border: "none", position: "sticky", bottom: 0 }}><CheckCircle2 size={20} /> Save visit</button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Camera scanner: native BarcodeDetector where available, otherwise jsQR (loaded on demand)
--------------------------------------------------------- */
let jsQrPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  if (!jsQrPromise) jsQrPromise = new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    sc.onload = () => resolve(); sc.onerror = () => { jsQrPromise = null; reject(new Error("jsqr")); };
    document.head.appendChild(sc);
  });
  return jsQrPromise;
}
function ScannerModal({ onResult, onClose }) {
  const videoRef = useRef(null);
  const [err, setErr] = useState("");
  const [miss, setMiss] = useState("");
  const [manual, setManual] = useState("");
  const onResultRef = useRef(onResult); onResultRef.current = onResult;
  useEffect(() => {
    let stream = null, timer = null, stopped = false, detector = null, lastMiss = "";
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no camera"), { name: "NotSupported" });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current; v.srcObject = stream; v.setAttribute("playsinline", "true"); v.muted = true;
        await v.play();
        if ("BarcodeDetector" in window) {
          try { detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"] }); } catch (e) { detector = new window.BarcodeDetector(); }
        } else {
          await loadJsQR();
        }
        const tick = async () => {
          if (stopped) return;
          let text = null;
          try {
            if (detector) { const codes = await detector.detect(v); text = codes?.[0]?.rawValue || null; }
            else if (window.jsQR && v.videoWidth) {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(v, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = window.jsQR(img.data, img.width, img.height)?.data || null;
            }
          } catch (e) { /* keep scanning */ }
          if (text) {
            if (onResultRef.current(text)) return;
            if (text !== lastMiss) { lastMiss = text; setMiss(text); }
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        setErr(e?.name === "NotAllowedError" ? "Camera permission was blocked — allow camera access for this site in your browser settings, or type the tag below."
          : e?.message === "jsqr" ? "Couldn't load the QR reader — check your connection, or type the tag below."
          : "The camera isn't available here (it needs the deployed https site and a device with a camera). You can type the asset tag below, or scan the sticker with your phone's normal camera app.");
      }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <Modal title="Scan a QR code or asset tag" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!err && (
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "3 / 4", maxHeight: "55vh" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: "18%", border: "3px solid rgba(217,119,6,0.9)", borderRadius: 14, pointerEvents: "none" }} />
          </div>
        )}
        {err && <div style={{ fontSize: 12.5, color: "#9B2C2C", background: "#FBEAEA", borderRadius: 9, padding: 10 }}>{err}</div>}
        {miss && <div style={{ fontSize: 12, color: "#8A5A0B", background: "#FDF1E0", borderRadius: 9, padding: 8 }}>Read "{miss.length > 60 ? miss.slice(0, 60) + "…" : miss}" but it doesn't match any service. Set it as a service's asset tag to link them.</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type asset tag, e.g. AHU-003" style={{ flex: 1, fontSize: 15 }}
            onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { if (!onResult(manual)) setMiss(manual); } }} />
          <button onClick={() => { if (manual.trim() && !onResult(manual)) setMiss(manual); }} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "0 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Go</button>
        </div>
        <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Reads the app's QR stickers and barcodes/QR codes printed with an asset tag. Point the camera at the code and hold steady.</div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Service templates — typical UK facilities schedules. Frequencies are common
   practice / guidance, not legal advice: check your own risk assessments and insurer.
--------------------------------------------------------- */
const BUILTIN_TEMPLATES = [
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
   Custom fields
--------------------------------------------------------- */
function fieldsFor(appliesTo, category) { return ACTIVE_CUSTOM_FIELDS.filter((f) => f.appliesTo === appliesTo && (!f.categories?.length || !category || f.categories.includes(category))); }
function missingRequiredFields(appliesTo, category, values = {}) {
  return fieldsFor(appliesTo, category).filter((f) => f.required && (values[f.id] === undefined || values[f.id] === "" || values[f.id] === null || (f.type === "yesno" && values[f.id] !== true && values[f.id] !== false))).map((f) => f.label);
}
function formatCustomValues(appliesTo, values = {}) {
  return ACTIVE_CUSTOM_FIELDS.filter((f) => f.appliesTo === appliesTo && values[f.id] !== undefined && values[f.id] !== "")
    .map((f) => `${f.label}: ${values[f.id] === true ? "Yes" : values[f.id] === false ? "No" : f.type === "date" ? fmtDate(values[f.id]) : values[f.id]}`).join(" · ");
}
function CustomFieldInputs({ appliesTo, category, values = {}, onChange, large = false, readOnly = false }) {
  const fields = fieldsFor(appliesTo, category);
  if (!fields.length) return null;
  const set = (id, v) => onChange({ ...values, [id]: v });
  const st = large ? { fontSize: 15, padding: "11px 13px" } : {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {fields.map((f) => {
        const label = `${f.label}${f.required ? " *" : ""}`;
        const v = values[f.id];
        if (f.type === "yesno") return (
          <Field key={f.id} label={label}>
            <div style={{ display: "flex", gap: 6 }}>
              {[[true, "Yes"], [false, "No"]].map(([val, l]) => (
                <button key={l} type="button" disabled={readOnly} onClick={() => set(f.id, v === val ? undefined : val)} style={{ flex: 1, minHeight: large ? 44 : 36, borderRadius: 8, border: `1.5px solid ${v === val ? "#2B4562" : "#D7DCE1"}`, background: v === val ? "#2B4562" : "#fff", color: v === val ? "#fff" : "#2B4562", fontWeight: 700, fontSize: 13, cursor: readOnly ? "default" : "pointer", fontFamily: "inherit" }}>{l}</button>
              ))}
            </div>
          </Field>
        );
        if (f.type === "select") return (
          <Field key={f.id} label={label}>
            <Select value={v ?? ""} disabled={readOnly} onChange={(e) => set(f.id, e.target.value || undefined)} style={st}>
              <option value="">—</option>
              {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        );
        return (
          <Field key={f.id} label={label}>
            <TextInput type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} value={v ?? ""} disabled={readOnly} style={st}
              onChange={(e) => set(f.id, f.type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)} />
          </Field>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   Settings: categories, custom fields, templates
--------------------------------------------------------- */
const COLOR_CHOICES = ["#2B7A78", "#2B4562", "#8E4585", "#B7791F", "#C05621", "#2F855A", "#C53030", "#5B6672", "#3182CE", "#805AD5"];
function SettingsModal({ settings, devices, usage, onClose, onSave }) {
  const [tab, setTab] = useState("categories");
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  const overrides = settings.categoryOverrides || {};
  const customCats = settings.customCategories || [];
  const fields = settings.customFields || [];
  const templates = settings.serviceTemplates || [];
  // new category form
  const [cLabel, setCLabel] = useState(""); const [cColor, setCColor] = useState(COLOR_CHOICES[3]); const [cIcon, setCIcon] = useState("Tag");
  // new field form
  const [fLabel, setFLabel] = useState(""); const [fType, setFType] = useState("text"); const [fApplies, setFApplies] = useState("visit");
  const [fOptions, setFOptions] = useState(""); const [fRequired, setFRequired] = useState(false); const [fCats, setFCats] = useState([]);
  // template from service
  const [fromDev, setFromDev] = useState("");
  const allCats = CATEGORY_KEYS;
  function saveCategory(key, patch) {
    if (BUILTIN_CATEGORY_META[key]) onSave({ categoryOverrides: { ...overrides, [key]: { ...(overrides[key] || {}), ...patch } } });
    else onSave({ customCategories: customCats.map((c) => c.key === key ? { ...c, ...patch } : c) });
  }
  function addCategory() {
    const label = cLabel.trim(); if (!label) return;
    if (allCats.some((k) => CATEGORY_META[k].label.toLowerCase() === label.toLowerCase())) { flash("A category with that name already exists."); return; }
    onSave({ customCategories: [...customCats, { key: `cat_${uid()}`, label, color: cColor, icon: cIcon }] });
    setCLabel(""); flash(`Added "${label}"`);
  }
  function addField() {
    const label = fLabel.trim(); if (!label) return;
    const options = fType === "select" ? fOptions.split(",").map((o) => o.trim()).filter(Boolean) : [];
    if (fType === "select" && options.length < 2) { flash("Add at least two options, separated by commas."); return; }
    onSave({ customFields: [...fields, { id: `f_${uid()}`, label, type: fType, appliesTo: fApplies, options, required: fRequired, categories: fCats }] });
    setFLabel(""); setFOptions(""); setFRequired(false); setFCats([]); flash(`Added "${label}"`);
  }
  function templateFromService() {
    const d = devices.find((x) => x.id === fromDev); if (!d) return;
    const repeat = d.serviceIntervalMonths ? { mode: "interval", months: d.serviceIntervalMonths } : null;
    onSave({ serviceTemplates: [...templates, { id: `ut_${uid()}`, custom: true, name: d.name, serviceCategory: d.serviceCategory, subCategory: d.subCategory || "", equipmentType: d.category || "", repeat, checklist: d.checklist || [], note: repeat ? `Repeats every ${repeat.months} month${repeat.months === 1 ? "" : "s"}.` : "" }] });
    setFromDev(""); flash(`Saved "${d.name}" as a template`);
  }
  const pill = (active) => ({ padding: "5px 9px", borderRadius: 7, border: `1.5px solid ${active ? "#2B4562" : "#D7DCE1"}`, background: active ? "#2B4562" : "#fff", color: active ? "#fff" : "#2B4562", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" });
  const APPLIES = { service: "Services", visit: "Visits", work: "Extra works" };
  const TYPES = { text: "Text", number: "Number", date: "Date", select: "Choice list", yesno: "Yes / No" };
  return (
    <Modal title="Settings" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={tab === "categories"} onClick={() => setTab("categories")}>Categories</ToggleButton>
          <ToggleButton active={tab === "fields"} onClick={() => setTab("fields")}>Custom fields</ToggleButton>
          <ToggleButton active={tab === "templates"} onClick={() => setTab("templates")}>Templates</ToggleButton>
        </div>
        {msg && <div style={{ fontSize: 12, color: "#2F6B4A", background: "#EAF4EE", borderRadius: 8, padding: "6px 10px" }}>{msg}</div>}

        {tab === "categories" && (
          <>
            {allCats.map((k) => {
              const m = CATEGORY_META[k]; const Icon = m.icon; const used = usage[k] || 0;
              return (
                <div key={k} style={{ border: "1px solid #E1E4E8", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={16} color={m.color} />
                    <TextInput defaultValue={m.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.label) { saveCategory(k, { label: v }); flash("Renamed"); } }} style={{ flex: 1, fontSize: 13.5, fontWeight: 650 }} />
                    {m.custom && (used ? <span style={{ fontSize: 10.5, color: "#8A94A0", whiteSpace: "nowrap" }}>in use ({used})</span> : (
                      <button onClick={() => { onSave({ customCategories: customCats.filter((c) => c.key !== k) }); flash(`Removed "${m.label}"`); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#C53030" /></button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {COLOR_CHOICES.map((c) => <button key={c} onClick={() => saveCategory(k, { color: c })} title={c} style={{ width: 22, height: 22, borderRadius: 11, background: c, border: m.color === c ? "3px solid #1B2430" : "2px solid #fff", boxShadow: "0 0 0 1px #D7DCE1", cursor: "pointer" }} />)}
                  </div>
                  {!m.custom && <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Built-in category — can be renamed and recoloured, not removed.</div>}
                </div>
              );
            })}
            <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672" }}>Add a category</div>
              <TextInput value={cLabel} onChange={(e) => setCLabel(e.target.value)} placeholder="e.g. Security, Waste, Grounds" />
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {COLOR_CHOICES.map((c) => <button key={c} onClick={() => setCColor(c)} style={{ width: 22, height: 22, borderRadius: 11, background: c, border: cColor === c ? "3px solid #1B2430" : "2px solid #fff", boxShadow: "0 0 0 1px #D7DCE1", cursor: "pointer" }} />)}
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {Object.entries(CATEGORY_ICONS).map(([n, I]) => <button key={n} onClick={() => setCIcon(n)} style={{ ...pill(cIcon === n), padding: 6, display: "flex" }}><I size={14} /></button>)}
              </div>
              <PrimaryButton onClick={addCategory}><Plus size={15} /> Add category</PrimaryButton>
            </div>
            <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>New categories appear everywhere: service and supplier forms, budget caps, charts, reports and exports. A category can only be removed while nothing uses it.</div>
          </>
        )}

        {tab === "fields" && (
          <>
            {fields.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>No custom fields yet — add things like "Refrigerant type", "Job number" or "Access arranged?".</div>}
            {fields.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #E1E4E8", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650 }}>{f.label}{f.required ? " *" : ""}</div>
                  <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{TYPES[f.type]} · on {APPLIES[f.appliesTo]}{f.categories?.length ? ` · ${f.categories.map((c) => CATEGORY_META[c]?.label).filter(Boolean).join(", ")} only` : ""}{f.type === "select" ? ` · ${f.options.join(" / ")}` : ""}</div>
                </div>
                <button onClick={() => { onSave({ customFields: fields.map((x) => x.id === f.id ? { ...x, required: !x.required } : x) }); }} style={pill(f.required)}>{f.required ? "Required" : "Optional"}</button>
                <button onClick={() => { onSave({ customFields: fields.filter((x) => x.id !== f.id) }); flash(`Removed "${f.label}" (existing values are kept)`); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#C53030" /></button>
              </div>
            ))}
            <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672" }}>Add a field</div>
              <TextInput value={fLabel} onChange={(e) => setFLabel(e.target.value)} placeholder="Field name, e.g. Refrigerant type" />
              <div style={{ display: "flex", gap: 8 }}>
                <Select value={fApplies} onChange={(e) => setFApplies(e.target.value)} style={{ flex: 1 }}>{Object.entries(APPLIES).map(([k, l]) => <option key={k} value={k}>On {l}</option>)}</Select>
                <Select value={fType} onChange={(e) => setFType(e.target.value)} style={{ flex: 1 }}>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              </div>
              {fType === "select" && <TextInput value={fOptions} onChange={(e) => setFOptions(e.target.value)} placeholder="Options, comma separated: R32, R410A, R134a" />}
              <div style={{ fontSize: 11.5, color: "#5B6672" }}>Show for categories (none selected = all):</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {allCats.map((k) => <button key={k} onClick={() => setFCats((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k])} style={pill(fCats.includes(k))}>{CATEGORY_META[k].label}</button>)}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><input type="checkbox" checked={fRequired} onChange={(e) => setFRequired(e.target.checked)} /> Required</label>
              <PrimaryButton onClick={addField}><Plus size={15} /> Add field</PrimaryButton>
            </div>
            <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Custom fields appear on the add/edit forms (and the quick log for visits), on completed visits, and as extra columns in the Excel workbook.</div>
          </>
        )}

        {tab === "templates" && (
          <>
            <div style={{ fontSize: 12.5, color: "#5B6672" }}>Templates appear under "Start from a template" when you add a service. They fill in the category, repeat schedule and checklist.</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672" }}>Your templates ({templates.length})</div>
            {templates.length === 0 && <div style={{ fontSize: 12, color: "#A3ABB4" }}>None yet — save one of your services as a template below.</div>}
            {templates.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #E1E4E8", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 650 }}>{t.name}</div><div style={{ fontSize: 11.5, color: "#8A94A0" }}>{CATEGORY_META[t.serviceCategory]?.label || ""} · {t.checklist?.length || 0} checks{t.repeat?.months ? ` · every ${t.repeat.months} mo` : ""}</div></div>
                <button onClick={() => { onSave({ serviceTemplates: templates.filter((x) => x.id !== t.id) }); flash(`Removed "${t.name}"`); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#C53030" /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <Select value={fromDev} onChange={(e) => setFromDev(e.target.value)} style={{ flex: 1 }}>
                <option value="">Save an existing service as a template…</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <button onClick={templateFromService} disabled={!fromDev} style={{ background: fromDev ? "#2B4562" : "#C0C6CC", color: "#fff", border: "none", borderRadius: 9, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: fromDev ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginTop: 4 }}>Standard templates ({BUILTIN_TEMPLATES.length})</div>
            {BUILTIN_TEMPLATES.map((t) => (
              <div key={t.id} style={{ fontSize: 12, color: "#3A4451", borderBottom: "1px solid #EEF0F2", paddingBottom: 5 }}>
                <b>{t.name}</b> <span style={{ color: "#8A94A0" }}>— {t.repeat.mode === "weekly" ? "weekly" : t.repeat.mode === "custom" ? `${t.repeat.count}× a year` : `every ${t.repeat.months} month${t.repeat.months === 1 ? "" : "s"}`}, {t.checklist.length} checks</span>
                <div style={{ fontSize: 11, color: "#8A94A0" }}>{t.note}</div>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: "#A3ABB4" }}>Standard frequencies reflect common UK guidance and practice, not legal advice — always follow your own risk assessments, insurer and manufacturer requirements.</div>
          </>
        )}
      </div>
    </Modal>
  );
}
