import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wrench, Calendar, FileCheck, Receipt, Plus, X, Camera,
  MapPin, ChevronRight, ChevronLeft, ChevronDown, CheckCircle2, Clock,
  Trash2, Tag, Download, Search, Loader2, Globe2, Building2,
  User, Users as UsersIcon, PoundSterling, Sparkles, Soup, SprayCan,
  ShieldAlert, PieChart, Pencil, RefreshCw, QrCode, Printer, Gauge, Send,
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
  deviceTasks: "org:deviceTasks", visitBudgets: "org:visitBudgets",
};
const PKEYS = { nav: "me:nav" };

async function loadShared(key) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : []; }
  catch (e) { return []; }
}
async function saveShared(key, list) {
  try { await window.storage.set(key, JSON.stringify(list), true); }
  catch (e) { console.error("shared save failed", e); }
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
const CATEGORY_META = {
  cleaning: { label: "Cleaning", color: "#2B7A78", icon: SprayCan },
  maintenance: { label: "Maintenance", color: "#2B4562", icon: Wrench },
  catering: { label: "Catering", color: "#8E4585", icon: Soup },
};

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
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,26,33,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
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

  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedCountryId, setSelectedCountryId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  const [tab, setTab] = useState("devices");
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
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  function showToast(msg) { setToast(msg); }

  useEffect(() => {
    (async () => {
      const [u, c, l, d, s, w, sup, b, bl, dt, vb, nav] = await Promise.all([
        loadShared(SKEYS.users), loadShared(SKEYS.countries), loadShared(SKEYS.locations),
        loadShared(SKEYS.devices), loadShared(SKEYS.services), loadShared(SKEYS.works),
        loadShared(SKEYS.suppliers), loadShared(SKEYS.budgets), loadShared(SKEYS.budgetLines),
        loadShared(SKEYS.deviceTasks), loadShared(SKEYS.visitBudgets),
        loadPersonal(PKEYS.nav, {}),
      ]);
      setUsers(u); setCountries(c); setLocations(l); setDevices(d);
      setServices(s); setWorks(w); setSuppliers(sup); setBudgets(b); setBudgetLines(bl); setDeviceTasks(dt); setVisitBudgets(vb);
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
  };
  function saveNav(patch) {
    const next = { currentUserId, selectedCountryId, selectedLocationId, ...patch };
    if ("currentUserId" in patch) setCurrentUserId(patch.currentUserId);
    if ("selectedCountryId" in patch) setSelectedCountryId(patch.selectedCountryId);
    if ("selectedLocationId" in patch) setSelectedLocationId(patch.selectedLocationId);
    savePersonal(PKEYS.nav, next);
  }

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const selectedCountry = countries.find((c) => c.id === selectedCountryId) || null;
  const selectedLocation = locations.find((l) => l.id === selectedLocationId) || null;

  const locDevices = useMemo(() => devices.filter((d) => d.locationId === selectedLocationId), [devices, selectedLocationId]);
  const locDeviceIds = useMemo(() => new Set(locDevices.map((d) => d.id)), [locDevices]);
  const locServices = useMemo(() => services.filter((s) => locDeviceIds.has(s.deviceId)), [services, locDeviceIds]);
  const locWorks = useMemo(() => works.filter((w) => locDeviceIds.has(w.deviceId)), [works, locDeviceIds]);
  const locSuppliers = useMemo(() => suppliers.filter((s) => s.locationId === selectedLocationId), [suppliers, selectedLocationId]);
  const locBudgets = useMemo(() => budgets.filter((b) => b.locationId === selectedLocationId), [budgets, selectedLocationId]);
  const locBudgetLines = useMemo(() => budgetLines.filter((b) => b.locationId === selectedLocationId), [budgetLines, selectedLocationId]);
  const locDeviceTasks = useMemo(() => deviceTasks.filter((t) => locDeviceIds.has(t.deviceId)), [deviceTasks, locDeviceIds]);
  const locVisitBudgets = useMemo(() => visitBudgets.filter((v) => locDeviceIds.has(v.deviceId)), [visitBudgets, locDeviceIds]);

  // Subcategory suggestions for autocomplete — anything typed before, for this
  // category, anywhere (services, suppliers, or budget lines) at this location.
  const subcategoriesByCategory = useMemo(() => {
    const m = { cleaning: new Set(), maintenance: new Set(), catering: new Set() };
    locDevices.forEach((d) => { if (d.subCategory && m[d.serviceCategory]) m[d.serviceCategory].add(d.subCategory); });
    locSuppliers.forEach((s) => { if (s.subCategory && m[s.category]) m[s.category].add(s.subCategory); });
    locBudgetLines.forEach((l) => { if (l.subCategory && m[l.category]) m[l.category].add(l.subCategory); });
    return { cleaning: [...m.cleaning].sort(), maintenance: [...m.maintenance].sort(), catering: [...m.catering].sort() };
  }, [locDevices, locSuppliers, locBudgetLines]);

  const deviceById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);
  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locDevices;
    return locDevices.filter((d) => [d.name, d.assetTag, d.category].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
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
    if (!q) return devices;
    return devices.filter((d) => [d.name, d.assetTag, d.category].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  }, [devices, search]);
  const sortedByDue = useMemo(() => [...locDevices].sort((a, b) => {
    const da = a.nextServiceDate ? new Date(a.nextServiceDate) : new Date(8640000000000000);
    const db = b.nextServiceDate ? new Date(b.nextServiceDate) : new Date(8640000000000000);
    return da - db;
  }), [locDevices]);

  const overdueCount = locDevices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; }).length;
  const dueSoonCount = locDevices.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 30; }).length;
  const openWorksCount = locWorks.filter((w) => w.status === "quoted" || w.status === "approved").length;

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
    const { scheduleDates, ...deviceFields } = device;
    if (isEdit) {
      persist.devices(devices.map((d) => d.id === device.id ? { ...d, ...deviceFields } : d));
      setDeviceModal(null);
      showToast("Service updated");
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
    showToast(scheduleDates && scheduleDates.length > 1 ? `Service added with ${scheduleDates.length} planned visits` : "Service added");
  }
  function deleteDevice(id) {
    persist.devices(devices.filter((d) => d.id !== id));
    persist.services(services.filter((s) => s.deviceId !== id));
    persist.works(works.filter((w) => w.deviceId !== id));
    persist.deviceTasks(deviceTasks.filter((t) => t.deviceId !== id));
    persist.visitBudgets(visitBudgets.filter((v) => v.deviceId !== id));
    showToast("Service deleted");
  }
  function recomputeSchedule(deviceId, updatedServices) {
    const dev = deviceById[deviceId];
    if (!dev) return;
    const forDevice = updatedServices.filter((s) => s.deviceId === deviceId && s.date);
    if (forDevice.length === 0) return; // no services logged — leave manually-set schedule alone
    const lastDate = forDevice.reduce((max, s) => (s.date > max ? s.date : max), forDevice[0].date);
    // Find the planned visit-budget date nearest to the one just logged (the visit may have
    // happened a day or two early or late) and advance to whichever date comes after THAT one —
    // not just "any date after the logged one", which could still be this same occurrence.
    const deviceVBDates = [...new Set(visitBudgets.filter((v) => v.deviceId === deviceId).map((v) => v.date))].sort();
    let upcomingPlanned;
    if (deviceVBDates.length > 0) {
      let nearestIdx = 0, nearestDiff = Infinity;
      deviceVBDates.forEach((d, i) => {
        const diff = Math.abs(new Date(d + "T00:00:00").getTime() - new Date(lastDate + "T00:00:00").getTime());
        if (diff < nearestDiff) { nearestDiff = diff; nearestIdx = i; }
      });
      upcomingPlanned = deviceVBDates[nearestIdx + 1];
    }
    const nextDate = upcomingPlanned || (dev.serviceIntervalMonths ? addMonths(lastDate, dev.serviceIntervalMonths) : null);
    persist.devices(devices.map((d) => d.id === deviceId ? { ...d, lastServiceDate: lastDate, nextServiceDate: nextDate } : d));
  }
  // A logged visit's cost should also mark the matching auto-generated Budget Plan
  // line as recorded, so the Plan doesn't sit forever showing "not yet spent" for
  // work that's actually been done and paid for.
  function syncBudgetLineForVisit(deviceId, visitDate, visitCost) {
    if (visitCost == null || visitCost === "") return;
    const deviceLines = budgetLines.filter((l) => l.deviceId === deviceId);
    if (deviceLines.length === 0) return;
    let nearest = null, nearestDiff = Infinity;
    deviceLines.forEach((l) => {
      const diff = Math.abs(new Date(l.date + "T00:00:00").getTime() - new Date(visitDate + "T00:00:00").getTime());
      if (diff < nearestDiff) { nearestDiff = diff; nearest = l; }
    });
    if (!nearest) return;
    persist.budgetLines(budgetLines.map((l) => l.id === nearest.id ? { ...l, actualAmount: Number(visitCost), actualDate: visitDate, status: "completed" } : l));
  }
  function saveService(record) {
    const isEdit = !!record.id;
    let next;
    if (isEdit) {
      next = services.map((s) => s.id === record.id ? { ...s, ...record, updatedBy: currentUser?.name, updatedAt: new Date().toISOString() } : s);
    } else {
      next = [{ ...record, id: uid(), loggedBy: currentUser?.name, loggedAt: new Date().toISOString() }, ...services];
    }
    persist.services(next);
    recomputeSchedule(record.deviceId, next);
    if (record.date && record.cost) syncBudgetLineForVisit(record.deviceId, record.date, record.cost);
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
    showToast(isEdit ? "Visit updated" : "Visit logged");
  }
  function deleteService(id, deviceId) {
    const next = services.filter((s) => s.id !== id);
    persist.services(next);
    recomputeSchedule(deviceId, next);
    setServiceModal(null);
    showToast("Visit deleted");
  }
  function addWork(work) {
    persist.works([{ ...work, id: uid(), loggedBy: currentUser?.name, loggedAt: new Date().toISOString() }, ...works]);
    setAddWorkFor(null);
    showToast("Extra work added");
  }
  function updateWorkStatus(id, status) { persist.works(works.map((w) => w.id === id ? { ...w, status } : w)); }
  function updateWork(id, patch) { persist.works(works.map((w) => w.id === id ? { ...w, ...patch } : w)); }
  function deleteWork(id) { persist.works(works.filter((w) => w.id !== id)); showToast("Extra work deleted"); }
  function saveSupplier(supplier) {
    if (supplier.id) {
      persist.suppliers(suppliers.map((s) => s.id === supplier.id ? { ...s, ...supplier } : s));
      showToast("Supplier updated");
    } else {
      persist.suppliers([{ ...supplier, id: uid(), locationId: selectedLocationId }, ...suppliers]);
      showToast("Supplier added");
    }
    setSupplierModal(null);
  }
  function deleteSupplier(id) { persist.suppliers(suppliers.filter((s) => s.id !== id)); showToast("Supplier deleted"); setSupplierModal(null); }
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
    persist.budgetLines(budgetLines.filter((l) => l.id !== id));
    showToast("Contract line deleted");
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
    persist.deviceTasks(deviceTasks.filter((t) => t.id !== id));
    showToast("Task deleted");
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
    persist.visitBudgets(visitBudgets.filter((v) => v.id !== id));
    showToast("Visit budget deleted");
  }
  function syncDeviceToBudgetPlan(deviceId) {
    const dev = deviceById[deviceId];
    if (!dev || !dev.budgetPerVisit) { showToast("Set a budget per visit first"); return; }
    const existingDates = new Set(visitBudgets.filter((v) => v.deviceId === deviceId).map((v) => v.date));
    const startDate = dev.nextServiceDate || new Date().toISOString().slice(0, 10);
    const count = dev.serviceIntervalMonths ? 12 : 1;
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

  const navItems = [
    { key: "devices", label: "Services", icon: Wrench },
    { key: "schedule", label: "Schedule", icon: Calendar, alert: overdueCount > 0 },
    { key: "certificates", label: "Completed", icon: FileCheck },
    { key: "works", label: "Works", icon: Receipt },
    { key: "suppliers", label: "Suppliers", icon: UsersIcon },
    { key: "budget", label: "Budget", icon: PoundSterling },
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
  ACTIVE_CAN_EDIT = currentUser?.role !== "viewer";

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
        @media (min-width: 640px) {
          .ppm-shell { max-width: 460px; box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 24px 70px rgba(0,0,0,0.18); }
        }
      `}</style>
      <div className="ppm-shell" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: "#EEF0F2", color: "#1B2430", display: "flex", flexDirection: "column" }}>
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

        {!needsProfile && (
          <button onClick={() => setShowLocationPicker(true)} style={{
            width: "100%", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10,
            padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, color: "#fff", fontSize: 13, fontWeight: 600 }}>
              <Globe2 size={14} color="#D97706" />
              {selectedLocation ? `${selectedCountry?.name} · ${selectedLocation.name}` : "Choose a country & location"}
            </span>
            <ChevronDown size={15} color="#9AA5B1" />
          </button>
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

          <div style={{ flex: 1, padding: 16, paddingBottom: 90 }}>
            {tab === "devices" && (
              <DevicesTab devices={searchAllLocations ? globalFilteredDevices : filteredDevices} search={search} setSearch={setSearch}
                onAdd={() => setDeviceModal({})} onEdit={(record) => setDeviceModal({ record })}
                onLogService={(id) => setServiceModal({ deviceId: id })} onAddWork={setAddWorkFor}
                onDelete={deleteDevice} onHistory={setHistoryFor}
                searchAllLocations={searchAllLocations} onToggleSearchAll={setSearchAllLocations}
                locationLabel={locationLabel} />
            )}
            {tab === "schedule" && (
              <ScheduleCalendarTab devices={locDevices} services={locServices} tasks={locDeviceTasks}
                onLogService={(id) => setServiceModal({ deviceId: id })}
                onEditService={(record) => setServiceModal({ deviceId: record.deviceId, record })}
                onMarkTaskDone={markTaskDone} />
            )}
            {tab === "certificates" && (
              <CertificatesTab devices={locDevices} visitBudgets={locVisitBudgets} services={locServices} deviceById={deviceById} supplierById={supplierById}
                onEdit={(record) => setServiceModal({ deviceId: record.deviceId, record })} />
            )}
            {tab === "works" && (
              <WorksTab works={locWorks} deviceById={deviceById} supplierById={supplierById} suppliers={locSuppliers}
                onUpdate={updateWork} onDelete={deleteWork} currentUserName={currentUser?.name}
                onAdd={() => setAddWorkFor(locDevices[0]?.id ?? null)} hasDevices={locDevices.length > 0} />
            )}
            {tab === "suppliers" && (
              <SuppliersTab suppliers={locSuppliers} onAdd={() => setSupplierModal({})} onEdit={(record) => setSupplierModal({ record })} onDelete={deleteSupplier} />
            )}
            {tab === "budget" && (
              <BudgetTab budgets={locBudgets} services={locServices} works={locWorks} suppliers={locSuppliers}
                devices={locDevices} budgetLines={locBudgetLines} visitBudgets={locVisitBudgets} onSetBudget={setCategoryBudget}
                subcategoriesByCategory={subcategoriesByCategory}
                onAddLines={addBudgetLines} onUpdateLine={updateBudgetLine} onDeleteLine={deleteBudgetLine} />
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
          onChoose={chooseLocation} onAddCountry={() => setShowAddCountry(true)} onAddLocation={(cid) => setShowAddLocation(cid)} />
      )}
      {showAddCountry && <AddCountryModal onClose={() => setShowAddCountry(false)} onSave={addCountry} />}
      {showAddLocation && <AddLocationModal countryId={showAddLocation} onClose={() => setShowAddLocation(null)} onSave={addLocation} />}
      {deviceModal && (
        <AddDeviceModal key={deviceModal.record?.id || "new-device"} countries={countries} locations={locations} defaultLocationId={selectedLocationId}
          existing={deviceModal.record} subcategoriesByCategory={subcategoriesByCategory} suppliers={suppliers} onClose={() => setDeviceModal(null)} onSave={saveDevice}
          onDelete={(id) => { deleteDevice(id); setDeviceModal(null); }} />
      )}
      {serviceModal && (
        <LogServiceModal key={serviceModal.record?.id || `new-${serviceModal.deviceId}`}
          device={deviceById[serviceModal.deviceId]} existing={serviceModal.record} suppliers={locSuppliers}
          visitBudgets={visitBudgets.filter((v) => v.deviceId === serviceModal.deviceId)}
          onClose={() => setServiceModal(null)} onSave={saveService} onDelete={deleteService} />
      )}
      {historyFor && (
        <DeviceHistoryModal device={deviceById[historyFor]} services={services.filter((s) => s.deviceId === historyFor)}
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
      {supplierModal && (
        <AddSupplierModal key={supplierModal.record?.id || "new-supplier"} existing={supplierModal.record}
          subcategoriesByCategory={subcategoriesByCategory} onClose={() => setSupplierModal(null)}
          onSave={saveSupplier} onDelete={deleteSupplier} />
      )}
      {toast && (
        <div style={{
          position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", background: "#1B2430", color: "#fff",
          padding: "9px 16px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          zIndex: 60, whiteSpace: "nowrap", pointerEvents: "none",
        }}>{toast}</div>
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

function LocationPickerModal({ countries, locations, onClose, onChoose, onAddCountry, onAddLocation }) {
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
function DevicesTab({ devices, search, setSearch, onAdd, onEdit, onLogService, onAddWork, onDelete, onHistory, searchAllLocations, onToggleSearchAll, locationLabel }) {
  const [qrFor, setQrFor] = useState(null);
  const [dueFilter, setDueFilter] = useState("active"); // 'active' | 'overdue' | 'month' | 'completed'
  const isCompleted = (d) => !d.nextServiceDate && !!d.lastServiceDate;
  const filteredDevices = devices.filter((d) => {
    if (dueFilter === "completed") return isCompleted(d);
    if (dueFilter === "active") return !isCompleted(d);
    const days = daysUntil(d.nextServiceDate);
    if (dueFilter === "overdue") return days !== null && days < 0;
    if (dueFilter === "month") {
      if (!d.nextServiceDate) return false;
      const dt = new Date(d.nextServiceDate + "T00:00:00");
      const now = new Date();
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    }
    return true;
  });
  return (
    <div>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={16} color="#8A94A0" style={{ position: "absolute", left: 11, top: 11 }} />
        <TextInput placeholder="Search services, tags, categories…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", paddingLeft: 34 }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, cursor: "pointer", fontSize: 12, color: "#5B6672", fontWeight: 600 }}>
        <input type="checkbox" checked={searchAllLocations} onChange={(e) => onToggleSearchAll(e.target.checked)} style={{ margin: 0 }} />
        Search all locations
      </label>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <ToggleButton active={dueFilter === "active"} onClick={() => setDueFilter("active")}>Active ({devices.filter((d) => !isCompleted(d)).length})</ToggleButton>
        <ToggleButton active={dueFilter === "overdue"} onClick={() => setDueFilter("overdue")}>Overdue</ToggleButton>
        <ToggleButton active={dueFilter === "month"} onClick={() => setDueFilter("month")}>Due this month</ToggleButton>
        <ToggleButton active={dueFilter === "completed"} onClick={() => setDueFilter("completed")}>Completed</ToggleButton>
      </div>
      {devices.length === 0 ? (
        <EmptyState icon={Wrench} title="No services yet" body="Add the equipment or service you maintain at this location to start its history." actionLabel={ACTIVE_CAN_EDIT ? "Add a service" : undefined} onAction={onAdd} />
      ) : filteredDevices.length === 0 ? (
        <EmptyState icon={Wrench} title={dueFilter === "completed" ? "Nothing completed yet" : "Nothing matches this filter"} body={dueFilter === "completed" ? "One-off services with no more visits scheduled will show up here once logged." : "Try a different filter or clear it to see everything."} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredDevices.map((d) => {
            const status = dueStatus(d.nextServiceDate, !!d.lastServiceDate);
            return (
              <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #E1E4E8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <button onClick={() => onEdit(d)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                    {searchAllLocations && (
                      <div style={{ fontSize: 11, color: "#D97706", fontWeight: 650, marginTop: 2 }}>{locationLabel(d)}</div>
                    )}
                    <div style={{ fontSize: 12.5, color: "#8A94A0", display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                      {d.assetTag && <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{d.assetTag}</span>}
                      {d.category && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Tag size={11} />{d.category}</span>}
                      {d.budgetPerVisit ? <span>{gbp(d.budgetPerVisit)}/visit budget</span> : null}
                    </div>
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
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <CategoryBadge category={d.serviceCategory} subCategory={d.subCategory} />
                  </div>
                  <span style={{ fontSize: 12, color: "#8A94A0" }}>Next: {fmtDate(d.nextServiceDate)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onLogService(d.id)} style={{ flex: 1, background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Log visit</button>}
                  <button onClick={() => onHistory(d.id)} style={{ flex: 1, background: "#EEF0F2", color: "#2B4562", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>History</button>
                  {ACTIVE_CAN_EDIT && <button onClick={() => onAddWork(d.id)} style={{ flex: 1, background: "#F5F1E8", color: "#8A5A0B", border: "1px solid #E6D9BC", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Extra work</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {qrFor && <ServiceQrModal device={qrFor} locationLabel={locationLabel(qrFor)} onClose={() => setQrFor(null)} />}
    </div>
  );
}

function DeviceHistoryModal({ device, services, tasks, visitBudgets, onClose, onEdit, onAddTask, onUpdateTask, onMarkTaskDone, onDeleteTask, onAddVisitBudget, onUpdateVisitBudget, onDeleteVisitBudget, onSyncBudget }) {
  const sorted = [...services].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const sortedVisitBudgets = [...visitBudgets].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [addingVisitBudget, setAddingVisitBudget] = useState(false);
  const [editingVisitBudget, setEditingVisitBudget] = useState(null);
  return (
    <Modal title={`${device ? device.name : ""}`} onClose={onClose}>
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
function ScheduleCalendarTab({ devices, services, tasks, onLogService, onEditService, onMarkTaskDone }) {
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
      </div>

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

      {view === "month" ? (
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
                  <button key={i} onClick={() => hasItems && setSelectedDate(iso)} style={{
                    position: "relative", aspectRatio: "1", borderRadius: 9,
                    border: isToday ? "1.5px solid #D97706" : hasItems ? `1px solid ${singleColor ? singleColor + "55" : "#E1E4E8"}` : "1px solid #F1F2F4",
                    background: singleColor ? `${singleColor}17` : "#fff",
                    cursor: hasItems ? "pointer" : "default", padding: 3, overflow: "hidden",
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
              {monthDue.map((d) => <DueRow key={d.id} device={d} onLogService={onLogService} />)}
            </div>

            {tasks.length > 0 && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", margin: "16px 0 8px" }}>Tasks due this month ({monthTasks.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {monthTasks.length === 0 && <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due.</div>}
                  {monthTasks.map((t) => <TaskDueRow key={t.id} task={t} device={deviceById[t.deviceId]} onMarkDone={onMarkTaskDone} />)}
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
          onMarkTaskDone={(id) => { setSelectedDate(null); onMarkTaskDone(id); }} />
      )}
    </div>
  );
}

function DayDetailModal({ date, due, done, dueTasks, deviceById, onClose, onLogService, onEditService, onMarkTaskDone }) {
  return (
    <Modal title={fmtDate(date)} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Due ({due.length})</div>
          {due.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#A3ABB4" }}>Nothing due today.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {due.map((d) => <DueRow key={d.id} device={d} onLogService={onLogService} />)}
            </div>
          )}
        </div>
        {dueTasks && dueTasks.length > 0 && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5B6672", marginBottom: 8 }}>Tasks due ({dueTasks.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dueTasks.map((t) => <TaskDueRow key={t.id} task={t} device={deviceById[t.deviceId]} onMarkDone={onMarkTaskDone} />)}
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

function TaskDueRow({ task, device, onMarkDone }) {
  const status = dueStatus(task.nextDate);
  const catColor = (CATEGORY_META[device?.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <StatusDot tone={status.tone} />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{task.name}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{device ? device.name : "Unknown service"}</div>
        </div>
      </div>
      {ACTIVE_CAN_EDIT && (
        <button onClick={() => onMarkDone(task.id)} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Mark done</button>
      )}
    </div>
  );
}

function DueRow({ device, onLogService }) {
  const status = dueStatus(device.nextServiceDate);
  const catColor = (CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).color;
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E1E4E8", borderLeft: `3px solid ${catColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <StatusDot tone={status.tone} />
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{device.name}</div>
          <div style={{ fontSize: 11.5, color: "#8A94A0", display: "flex", alignItems: "center", gap: 5 }}>
            <CategoryBadge category={device.serviceCategory} />
          </div>
        </div>
      </div>
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
          const dueCounts = { cleaning: 0, maintenance: 0, catering: 0 };
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
              <div style={{ fontSize: 12, color: "#8A94A0" }}>{fmtDate(s.date)} · {s.technician || "No technician noted"}{s.cost ? ` · ${gbp(s.cost)}` : ""}</div>
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

function WorksTab({ works, deviceById, supplierById, suppliers, onUpdate, onDelete, onAdd, hasDevices, currentUserName }) {
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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
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
          onClose={() => setOpenWorkId(null)} onUpdate={(patch) => onUpdate(openWork.id, patch)}
          onDelete={() => { onDelete(openWork.id); setOpenWorkId(null); }} />
      )}
    </div>
  );
}

function WorkDetailModal({ work, device, suppliers, currentUserName, onClose, onUpdate, onDelete }) {
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
            <Select value={work.status} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ status: e.target.value })}>
              {WORK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={work.priority || "medium"} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ priority: e.target.value })}>
              {WORK_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Assigned supplier">
          <Select value={work.supplierId || ""} disabled={!ACTIVE_CAN_EDIT} onChange={(e) => onUpdate({ supplierId: e.target.value || null })}>
            <option value="">— Unassigned —</option>
            {relevantSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {otherSuppliers.length > 0 && <optgroup label="Other categories">{otherSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
          </Select>
        </Field>
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
function SuppliersTab({ suppliers, onAdd, onEdit, onDelete }) {
  if (suppliers.length === 0) {
    return <EmptyState icon={UsersIcon} title="No suppliers yet" body="Add cleaning, maintenance and catering suppliers for this location." actionLabel={ACTIVE_CAN_EDIT ? "Add supplier" : undefined} onAction={onAdd} />;
  }
  const groups = ["cleaning", "maintenance", "catering"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                    <ConfirmDeleteButton onConfirm={() => onDelete(s.id)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddSupplierModal({ existing, subcategoriesByCategory, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [category, setCategory] = useState(existing?.category || "cleaning");
  const [name, setName] = useState(existing?.name || "");
  const [subCategory, setSubCategory] = useState(existing?.subCategory || "");
  const [contact, setContact] = useState(existing?.contact || "");
  const [costAmount, setCostAmount] = useState(existing?.costAmount ? String(existing.costAmount) : "");
  const [costFrequency, setCostFrequency] = useState(existing?.costFrequency || "monthly");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submit() {
    if (!name.trim()) return;
    onSave({ id: existing?.id, category, subCategory: subCategory.trim(), name: name.trim(), contact: contact.trim(), costAmount: costAmount ? Number(costAmount) : 0, costFrequency });
  }
  return (
    <Modal title={isEdit ? "Edit supplier" : "Add supplier"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Service category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="cleaning">Cleaning</option>
            <option value="maintenance">Maintenance</option>
            <option value="catering">Catering</option>
          </Select>
        </Field>
        <SubCategoryField value={subCategory} onChange={setSubCategory} suggestions={subcategoriesByCategory?.[category] || []} />
        <Field label="Supplier name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brightspace Cleaning Ltd" /></Field>
        <Field label="Contact (optional)"><TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone, email" /></Field>
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
const CATEGORY_KEYS = ["cleaning", "maintenance", "catering"];

function BudgetTab({ budgets, services, works, suppliers, devices, budgetLines, visitBudgets, subcategoriesByCategory, onSetBudget, onAddLines, onUpdateLine, onDeleteLine }) {
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
    const m = { cleaning: 0, maintenance: 0, catering: 0 };
    budgets.filter((b) => b.year === year).forEach((b) => { if (m[b.category] !== undefined) m[b.category] = Number(b.amount) || 0; });
    return m;
  }, [budgets, year]);

  // Sum of everything planned in Budget → Plan for this year, by category —
  // shown alongside the max so it's clear added lines are being tracked even
  // before a max is set.
  const plannedByCategory = useMemo(() => {
    const m = { cleaning: 0, maintenance: 0, catering: 0 };
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
    const catMax = { cleaning: 0, maintenance: 0, catering: 0 };
    budgets.filter((b) => b.year === y).forEach((b) => { if (catMax[b.category] !== undefined) catMax[b.category] = Number(b.amount) || 0; });
    const catPlanned = { cleaning: 0, maintenance: 0, catering: 0 };
    budgetLines.forEach((l) => {
      if (new Date(l.date).getFullYear() !== y) return;
      if (catPlanned[l.category] !== undefined) catPlanned[l.category] += Number(l.amount) || 0;
    });
    return CATEGORY_KEYS.reduce((s, c) => s + (catMax[c] > 0 ? catMax[c] : catPlanned[c]), 0);
  }

  const supplierMonthlyByCategory = useMemo(() => {
    const m = { cleaning: 0, maintenance: 0, catering: 0 };
    suppliers.forEach((s) => {
      const monthly = s.costFrequency === "annual" ? Number(s.costAmount) / 12 : Number(s.costAmount);
      if (m[s.category] !== undefined) m[s.category] += monthly;
    });
    return m;
  }, [suppliers]);

  // Year totals split by category — services + budgeted works + supplier (annualised); non-controllable tracked separately.
  const actualByCategory = useMemo(() => {
    const m = { cleaning: 0, maintenance: 0, catering: 0 };
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
      if (l.actualAmount == null) return;
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
      if (l.actualAmount != null) bl += Number(l.actualAmount) || 0;
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
      const bl = budgetLines.filter((l) => l.actualAmount != null && new Date(l.date).getFullYear() === y).reduce((sum, l) => sum + (Number(l.actualAmount) || 0), 0);
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
      if (!l.date || l.actualAmount == null) return;
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
    budgetLines.forEach((l) => { if (l.actualAmount != null) items.push({ date: l.date, amount: Number(l.actualAmount) || 0, supplierId: l.supplierId || null, deviceId: l.deviceId || null }); });
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
      const deviceLineSpends = budgetLines.filter((l) => l.deviceId === d.id && l.actualAmount != null);
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
      const loggedLines = budgetLines.filter((l) => l.supplierId === s.id && l.actualAmount != null && new Date(l.date).getFullYear() === year).reduce((sum, l) => sum + (Number(l.actualAmount) || 0), 0);
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
      const lineCost = budgetLines.filter((l) => l.deviceId === d.id && l.actualAmount != null && new Date(l.date).getFullYear() === year).reduce((sum, l) => sum + (Number(l.actualAmount) || 0), 0);
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
    const m = { cleaning: 0, maintenance: 0, catering: 0 };
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
    onSave({ actualAmount: Number(amount), actualDate: date, status: "completed" });
  }
  function clear() {
    onSave({ actualAmount: null, actualDate: null, status: "planned" });
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
            <option value="cleaning">Cleaning</option>
            <option value="maintenance">Maintenance</option>
            <option value="catering">Catering</option>
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
function AddDeviceModal({ countries, locations, defaultLocationId, existing, subcategoriesByCategory, suppliers, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name || "");
  const [assetTag, setAssetTag] = useState(existing?.assetTag || "");
  const [category, setCategory] = useState(existing?.category || "");
  const [serviceCategory, setServiceCategory] = useState(existing?.serviceCategory || "maintenance");
  const [subCategory, setSubCategory] = useState(existing?.subCategory || "");
  const [locationId, setLocationId] = useState(existing?.locationId || defaultLocationId || locations[0]?.id || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [checklist, setChecklist] = useState(existing?.checklist || []);
  const [newCheckItem, setNewCheckItem] = useState("");
  function addCheckItem() { if (!newCheckItem.trim()) return; setChecklist((p) => [...p, newCheckItem.trim()]); setNewCheckItem(""); }
  const [interval, setInterval] = useState(existing?.serviceIntervalMonths != null ? String(existing.serviceIntervalMonths) : "12");
  const [nextDate, setNextDate] = useState(existing?.nextServiceDate || new Date().toISOString().slice(0, 10));
  const [budgetPerVisit, setBudgetPerVisit] = useState(existing?.budgetPerVisit ? String(existing.budgetPerVisit) : "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const locationSuppliers = suppliers.filter((s) => s.locationId === locationId);

  // Repeat schedule — same options as Budget Plan contract lines, so setting up
  // a service's visits and its budget lines stay in sync. Only used when adding new.
  const [repeat, setRepeat] = useState("once"); // 'once' | 'interval' | 'manual' | 'weekly' | 'monthly' | 'quarterly' | 'custom'
  const [customCount, setCustomCount] = useState("7");
  const [manualDates, setManualDates] = useState([new Date().toISOString().slice(0, 10)]);

  function updateManualDate(i, value) { setManualDates((prev) => prev.map((d, idx) => idx === i ? value : d)); }
  function addManualDate() { setManualDates((prev) => [...prev, prev[prev.length - 1] || nextDate]); }
  function removeManualDate(i) { setManualDates((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev); }

  function submit() {
    if (!name.trim() || !locationId) return;
    const base = {
      id: existing?.id, name: name.trim(), assetTag: assetTag.trim(), category: category.trim(), serviceCategory,
      subCategory: subCategory.trim(), locationId, supplierId: supplierId || null, checklist,
      lastServiceDate: existing?.lastServiceDate ?? null,
      budgetPerVisit: budgetPerVisit ? Number(budgetPerVisit) : 0,
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
      if (intervalMonths) scheduleDates = Array.from({ length: 12 }, (_, i) => addMonths(nextDate, i * intervalMonths));
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
    <Modal title={isEdit ? "Edit service" : "Add a service"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Asset tag"><TextInput value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="AHU-003" /></Field>
          <Field label="Equipment type"><TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="HVAC" /></Field>
        </div>
        <Field label="Service category">
          <Select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
            <option value="cleaning">Cleaning</option>
            <option value="maintenance">Maintenance</option>
            <option value="catering">Catering</option>
          </Select>
        </Field>
        <SubCategoryField value={subCategory} onChange={setSubCategory} suggestions={subcategoriesByCategory?.[serviceCategory] || []} />
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
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Log Service Modal
--------------------------------------------------------- */
function LogServiceModal({ device, existing, suppliers, visitBudgets, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const defaultName = device ? `${(CATEGORY_META[device.serviceCategory] || CATEGORY_META.maintenance).label} visit` : "Visit";
  const [name, setName] = useState(existing?.name || defaultName);
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [technician, setTechnician] = useState(existing?.technician || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || device?.supplierId || "");
  const [notes, setNotes] = useState(existing?.notes || "");
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
    if (!device) return;
    onSave({
      id: existing?.id, deviceId: device.id, name: name.trim() || defaultName, date,
      technician: technician.trim(), supplierId: supplierId || null,
      notes: notes.trim(), cost: cost ? Number(cost) : 0, certificatePhoto: photo,
      checklistResults: checkResults.length ? checkResults : undefined,
    });
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
    if (!deviceId || !description.trim()) return;
    onSave({ deviceId, description: description.trim(), quoteAmount: quoteAmount ? Number(quoteAmount) : 0, dateRaised, status, budgetType, photos, priority, supplierId: supplierId || null, comments: [] });
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

export default function App() {
  const requestId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("request") : null;
  if (requestId) return <RequestPortal deviceId={requestId} />;
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
    const visits = services.filter((s) => s.deviceId === dev.id && s.date).map((s) => s.date).sort();
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
