// The main app: loads and saves all data, works out alerts, and lays out the header, tabs and pop-ups.
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Activity, AlertTriangle, Bell, Calendar, ChevronDown, ChevronRight, CloudOff, FileCheck, FileText, Globe2, HardDrive, HelpCircle, History, LayoutDashboard, Loader2, Plus, PoundSterling, Receipt, Search, ShieldAlert, SlidersHorizontal, Undo2, User, Users as UsersIcon, Wrench, X } from "lucide-react";
import { EmptyState, StatChip, ToggleButton } from "./components/ui.jsx";
import { BUILTIN_TEMPLATES, DEFAULT_AUDIT_TEMPLATES, INCIDENT_TYPES, MONTH_LABELS, ONBOARDING_ITEMS, PKEYS, SKEYS, SLA_DAYS, WASTE_STREAMS, WATER_LIMITS } from "./lib/constants.js";
import { ACTIVE_CAN_EDIT, AREA_SUGGESTIONS_CACHE, CATEGORY_KEYS, CATEGORY_META, applyCategorySettings, emptyCatMap, set_ACTIVE_CAN_EDIT, set_ACTIVE_CURRENCY_CODE, set_ACTIVE_CUSTOM_FIELDS, set_ACTIVE_SITE_INFO, set_ACTIVE_SLA, set_ACTIVE_TEMPLATES, set_ACTIVE_USERS, set_AREA_SUGGESTIONS_CACHE, set_PARENT_CANDIDATES_CACHE, set_TAG_SUGGESTIONS_CACHE } from "./lib/globals.js";
import { LAST_LOCAL_WRITE, loadPersonal, loadShared, savePersonal, saveShared, set_SAVE_STATUS_LISTENER } from "./lib/storage.js";
import { addDays, addMonths, currentBooking, currentDowntime, daysUntil, downloadBlob, fmtDate, gbp, inBlackout, isMirrored, meterStats, replacementYear, shiftDate, uid, workSla } from "./lib/utils.js";
import { AddCountryModal, AddLocationModal, AlertsModal, DataHealthModal, DataModal, GlobalSearchModal, HelpModal, LocationPickerModal, ReportsModal, SettingsModal, ShortcutsModal, UserSwitchModal } from "./modals/AppModals.jsx";
import { AddDeviceModal, AddWorkModal, DeviceHistoryModal, ImportModal, LibraryModal, LogServiceModal } from "./modals/ServiceModals.jsx";
import { BudgetTab } from "./tabs/BudgetTab.jsx";
import { CertificatesTab } from "./tabs/CompletedTab.jsx";
import { HomeTab } from "./tabs/HomeTab.jsx";
import { ScheduleCalendarTab } from "./tabs/ScheduleTab.jsx";
import { DevicesTab, QuickLogModal, ScannerModal } from "./tabs/ServicesTab.jsx";
import { AuditsView, IncidentsView, KeysView, MetersTab, PermitsView, SiteTab, SparesView, WasteView } from "./tabs/SiteTab.jsx";
import { AddSupplierModal, SuppliersTab } from "./tabs/SuppliersTab.jsx";
import { ProjectsView, WorksTab } from "./tabs/WorksTab.jsx";
import { DocumentsView, DrillsView, TrainingView, WaterTempsView } from "./tabs/SafetyViews.jsx";
import { FinanceView } from "./tabs/FinanceView.jsx";

/* ---------------------------------------------------------
   Main App
--------------------------------------------------------- */
export function MainApp() {
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
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [waterOutlets, setWaterOutlets] = useState([]);
  const [waterReadings, setWaterReadings] = useState([]);
  const [training, setTraining] = useState([]);
  const [drills, setDrills] = useState([]);
  const [budgetView, setBudgetView] = useState("budget");
  const [trash, setTrash] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
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
  const [workPrefill, setWorkPrefill] = useState(null);
  const [showHealth, setShowHealth] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [supplierModal, setSupplierModal] = useState(null); // { record? } — record present = editing
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 7000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    set_SAVE_STATUS_LISTENER((key, ok, err) => setSaveErrors((prev) => {
      if (ok) { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; }
      const quota = /quota/i.test(String(err?.name || err?.message || ""));
      return { ...prev, [key]: quota ? "Storage is full" : "Save failed" };
    }));
    return () => { set_SAVE_STATUS_LISTENER(null); };
  }, []);
  // Dark mode: invert the page colours at the root (keeps fixed pop-ups positioned correctly).
  useEffect(() => {
    document.documentElement.classList.toggle("ppm-dark", !!display.dark);
  }, [display.dark]);
  // Daily device notification (if switched on in Display): one summary of urgent items per day.
  useEffect(() => {
    if (loading || !display.notify || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    if (display.lastNotified === today) return;
    const urgent = visibleAlerts.filter((a) => a.tone !== "info");
    if (urgent.length) {
      try { new Notification("PPM Service Book", { body: `${urgent.length} item${urgent.length === 1 ? "" : "s"} need attention: ${urgent.slice(0, 3).map((a) => a.title).join("; ")}${urgent.length > 3 ? "…" : ""}`, icon: "/icon-192.png", tag: "ppm-daily" }); } catch (e) { /* not supported */ }
    }
    saveDisplay({ ...display, lastNotified: today });
  }, [loading, display.notify, selectedLocationId]);
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
      else if (e.key === "?") { e.preventDefault(); setShowHelp(true); }
      else if (e.key === "h") { e.preventDefault(); setTab("home"); }
      else if (e.key === "s") { e.preventDefault(); setTab("devices"); }
      else if (e.key === "w") { e.preventDefault(); setTab("works"); }
      else if (e.key === "a") { e.preventDefault(); setShowAlerts(true); }
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
      const [u, c, l, d, s, w, sup, b, bl, dt, vb, nav, st, act, mt, mr, si, sn, sp, ky, rm, disp, au, inc, pr, pm, ws, po, inv, wo, wr, tr, dr, trs] = await Promise.all([
        loadShared(SKEYS.users), loadShared(SKEYS.countries), loadShared(SKEYS.locations),
        loadShared(SKEYS.devices), loadShared(SKEYS.services), loadShared(SKEYS.works),
        loadShared(SKEYS.suppliers), loadShared(SKEYS.budgets), loadShared(SKEYS.budgetLines),
        loadShared(SKEYS.deviceTasks), loadShared(SKEYS.visitBudgets),
        loadPersonal(PKEYS.nav, {}), loadShared(SKEYS.settings), loadShared(SKEYS.activity),
        loadShared(SKEYS.meters), loadShared(SKEYS.meterReadings), loadShared(SKEYS.signins), loadPersonal(PKEYS.snooze, {}),
        loadShared(SKEYS.spares), loadShared(SKEYS.keys), loadShared(SKEYS.reminders), loadPersonal(PKEYS.display, { scale: 1 }),
        loadShared(SKEYS.audits), loadShared(SKEYS.incidents), loadShared(SKEYS.projects),
        loadShared(SKEYS.permits), loadShared(SKEYS.waste),
        loadShared(SKEYS.purchaseOrders), loadShared(SKEYS.invoices), loadShared(SKEYS.waterOutlets), loadShared(SKEYS.waterReadings), loadShared(SKEYS.training), loadShared(SKEYS.drills),
        loadShared(SKEYS.trash),
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
      setPurchaseOrders(Array.isArray(po) ? po : []); setInvoices(Array.isArray(inv) ? inv : []);
      setWaterOutlets(Array.isArray(wo) ? wo : []); setWaterReadings(Array.isArray(wr) ? wr : []);
      setTraining(Array.isArray(tr) ? tr : []); setDrills(Array.isArray(dr) ? dr : []);
      setTrash(Array.isArray(trs) ? trs.filter((t) => Date.now() - new Date(t.deletedAt).getTime() < 30 * 86400000) : []);
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
  const SHARED_SETTERS = { users: setUsers, countries: setCountries, locations: setLocations, devices: setDevices, services: setServices, works: setWorks, suppliers: setSuppliers, budgets: setBudgets, budgetLines: setBudgetLines, deviceTasks: setDeviceTasks, visitBudgets: setVisitBudgets, activity: setActivity, meters: setMeters, meterReadings: setMeterReadings, signins: setSignins, spares: setSpares, keys: setKeysList, reminders: setReminders, audits: setAudits, incidents: setIncidents, projects: setProjects, permits: setPermits, waste: setWaste, purchaseOrders: setPurchaseOrders, invoices: setInvoices, waterOutlets: setWaterOutlets, waterReadings: setWaterReadings, training: setTraining, drills: setDrills, trash: setTrash };
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
    purchaseOrders: useCallback((next) => { setPurchaseOrders(next); saveShared(SKEYS.purchaseOrders, next); }, []),
    invoices: useCallback((next) => { setInvoices(next); saveShared(SKEYS.invoices, next); }, []),
    waterOutlets: useCallback((next) => { setWaterOutlets(next); saveShared(SKEYS.waterOutlets, next); }, []),
    waterReadings: useCallback((next) => { setWaterReadings(next); saveShared(SKEYS.waterReadings, next); }, []),
    training: useCallback((next) => { setTraining(next); saveShared(SKEYS.training, next); }, []),
    drills: useCallback((next) => { setDrills(next); saveShared(SKEYS.drills, next); }, []),
    trash: useCallback((next) => { setTrash(next); saveShared(SKEYS.trash, next); }, []),
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
    // Cumulative spend vs plan by month, for the spend curve on Home.
    const monthly = Array.from({ length: 12 }, () => ({ actual: 0, plan: 0 }));
    const mIdx = (d) => (d && new Date(d).getFullYear() === yr ? new Date(d).getMonth() : -1);
    locServices.forEach((s) => { const m = mIdx(s.date); if (m >= 0) monthly[m].actual += Number(s.cost) || 0; });
    locWorks.forEach((w) => { const m = mIdx(w.dateRaised); if (m >= 0 && w.budgetType !== "non_controllable" && ["approved", "in_progress", "completed"].includes(w.status)) monthly[m].actual += Number(w.finalCost ?? w.quoteAmount) || 0; });
    locBudgetLines.forEach((l) => { const m = mIdx(l.date); if (m < 0 || isMirrored(l)) return; monthly[m].plan += Number(l.amount) || 0; if (l.actualAmount != null) { const am = mIdx(l.actualDate || l.date); if (am >= 0) monthly[am].actual += Number(l.actualAmount) || 0; } });
    locSuppliers.forEach((s) => { const mo = s.costFrequency === "annual" ? (Number(s.costAmount) || 0) / 12 : Number(s.costAmount) || 0; monthly.forEach((x, i) => { x.plan += mo; if (i < monthsSoFar) x.actual += mo; }); });
    let ca = 0, cp = 0;
    const curve = monthly.map((x, i) => { ca += x.actual; cp += x.plan; return { m: MONTH_LABELS[i], plan: Math.round(cp), actual: i < monthsSoFar ? Math.round(ca) : null, budget: budget ? Math.round((budget / 12) * (i + 1)) : null }; });
    return { spent, budget, yr, forecast: spent + remaining, curve };
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
  const weekAhead = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(new Date().toISOString().slice(0, 10), i));
    return days.map((day) => ({
      day,
      items: [
        ...locDevices.filter((d) => { const b = currentBooking(d); return b ? b.date === day : d.nextServiceDate === day; }).map((d) => ({ k: `d-${d.id}`, kind: currentBooking(d) ? "booked" : "due", text: d.name, time: currentBooking(d)?.time || "", id: d.id })),
        ...deviceTasks.filter((t) => t.nextDate === day && locDevices.some((d) => d.id === t.deviceId)).map((t) => ({ k: `t-${t.id}`, kind: "task", text: `${t.name} — ${locDevices.find((d) => d.id === t.deviceId)?.name || ""}`, id: t.deviceId })),
        ...reminders.filter((r) => r.locationId === selectedLocationId && !r.done && r.due === day).map((r) => ({ k: `r-${r.id}`, kind: "reminder", text: r.text })),
      ].sort((a, b) => String(a.time || "99").localeCompare(String(b.time || "99"))),
    }));
  }, [locDevices, deviceTasks, reminders, selectedLocationId]);
  const todayItems = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10); const now = Date.now();
    const bookings = locDevices.filter((d) => { const b = currentBooking(d); return b && b.date === today; }).map((d) => ({ ...d, booking: currentBooking(d), supplierName: suppliers.find((s) => s.id === d.supplierId)?.name }));
    const dueToday = locDevices.filter((d) => d.nextServiceDate === today && !currentBooking(d));
    const permitsNow = permits.filter((p) => p.locationId === selectedLocationId && p.status === "open" && new Date(p.validFrom).getTime() <= now + 12 * 3600000 && new Date(p.validTo).getTime() >= now);
    const remindersToday = reminders.filter((r) => r.locationId === selectedLocationId && !r.done && r.due === today);
    return { bookings, dueToday, permits: permitsNow, reminders: remindersToday };
  }, [locDevices, suppliers, permits, reminders, selectedLocationId]);
  const locPOs = useMemo(() => purchaseOrders.filter((x) => x.locationId === selectedLocationId), [purchaseOrders, selectedLocationId]);
  const locInvoices = useMemo(() => invoices.filter((x) => x.locationId === selectedLocationId), [invoices, selectedLocationId]);
  const locOutlets = useMemo(() => waterOutlets.filter((x) => x.locationId === selectedLocationId && !x.archived), [waterOutlets, selectedLocationId]);
  const locWaterReadings = useMemo(() => { const ids = new Set(locOutlets.map((o) => o.id)); return waterReadings.filter((r) => ids.has(r.outletId)); }, [waterReadings, locOutlets]);
  const locTraining = useMemo(() => training.filter((x) => x.locationId === selectedLocationId), [training, selectedLocationId]);
  const locDrills = useMemo(() => drills.filter((x) => x.locationId === selectedLocationId), [drills, selectedLocationId]);
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
    // Meters heading over their yearly consumption target.
    locMeters.forEach((m) => {
      if (!Number(m.annualTarget)) return;
      const yrS = String(new Date().getFullYear()); const st = meterStats(m, locReadings);
      const used = st.periods.filter((p) => p.to.startsWith(yrS)).reduce((t, p) => t + p.used, 0);
      const dayOfYear = Math.max(1, Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000));
      const projected = (used / dayOfYear) * 365;
      if (used > 0 && projected > Number(m.annualTarget) * 1.05) extra.push({ key: `mt-${m.id}-${yrS}`, tone: "warn", title: `${m.name} heading over target`, detail: `On course for ${Math.round(projected).toLocaleString("en-GB")} ${m.unit} against a target of ${Number(m.annualTarget).toLocaleString("en-GB")}`, tab: "meters" });
    });
    // Assets out of service.
    locDevices.forEach((d) => {
      const dt = currentDowntime(d); if (!dt) return;
      const days = Math.floor((Date.now() - new Date(dt.from).getTime()) / 86400000);
      extra.push({ key: `down-${d.id}-${dt.from}`, tone: d.criticality === "critical" ? "danger" : "warn", title: `Out of service: ${d.name}`, detail: `Since ${fmtDate(dt.from.slice(0, 10))}${days ? ` (${days} day${days === 1 ? "" : "s"})` : ""}${dt.reason ? ` — ${dt.reason}` : ""}`, tab: "devices" });
    });
    // Supplier follow-ups promised in the contact log.
    locSuppliers.forEach((s) => (s.contactLog || []).forEach((c) => {
      if (!c.followUp || c.followUpDone || daysUntil(c.followUp) > 0) return;
      extra.push({ key: `fu-${c.id}`, tone: daysUntil(c.followUp) < 0 ? "warn" : "info", title: `Follow up with ${s.name}`, detail: `${fmtDate(c.followUp)} — ${String(c.summary).slice(0, 70)}`, tab: "suppliers" });
    }));
    // Site documents due for review / expired.
    (settings.siteDocs || []).filter((x) => x.locationId === selectedLocationId && x.reviewDate).forEach((doc) => {
      const n = daysUntil(doc.reviewDate);
      if (n < 0) extra.push({ key: `doc-${doc.id}-${doc.reviewDate}`, tone: "warn", title: `Document overdue for review: ${doc.title}`, detail: `Review / renewal was due ${fmtDate(doc.reviewDate)}`, tab: "meters" });
      else if (n <= 30) extra.push({ key: `docs-${doc.id}-${doc.reviewDate}`, tone: "info", title: `Document review due: ${doc.title}`, detail: `Due ${fmtDate(doc.reviewDate)}`, tab: "meters" });
    });
    // Finance: invoices past their payment date, invoices waiting for approval, POs over-invoiced.
    locInvoices.forEach((iv) => {
      if (iv.status !== "paid" && iv.dueDate && daysUntil(iv.dueDate) < 0) extra.push({ key: `ivd-${iv.id}`, tone: "warn", title: `Invoice overdue for payment: ${iv.number}`, detail: `${gbp(iv.amount)} · due ${fmtDate(iv.dueDate)}`, tab: "budget" });
      else if (iv.status === "received" && iv.date && -daysUntil(iv.date) > 7) extra.push({ key: `iva-${iv.id}`, tone: "info", title: `Invoice waiting for approval: ${iv.number}`, detail: `${gbp(iv.amount)} · received ${fmtDate(iv.date)}`, tab: "budget" });
    });
    locPOs.forEach((po) => {
      if (po.status === "closed") return;
      const inv = locInvoices.filter((iv) => iv.poId === po.id).reduce((t, iv) => t + (Number(iv.amount) || 0), 0);
      if (Number(po.value) && inv > Number(po.value)) extra.push({ key: `pov-${po.id}-${inv}`, tone: "warn", title: `PO over-invoiced: ${po.number}`, detail: `${gbp(inv)} invoiced against ${gbp(po.value)}`, tab: "budget" });
    });
    // Legionella: out-of-range temperatures and monthly checks due.
    locOutlets.forEach((o) => {
      const rs = locWaterReadings.filter((r) => r.outletId === o.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const last = rs[0];
      if (last && WATER_LIMITS[o.type] && !WATER_LIMITS[o.type].ok(Number(last.temp))) extra.push({ key: `wt-${last.id}`, tone: "warn", title: `Water temperature out of range: ${o.name}`, detail: `${last.temp}°C on ${fmtDate(last.date)} — should be ${WATER_LIMITS[o.type].rule}. Flush and re-test.`, tab: "meters" });
      if (!last || -daysUntil(last.date) > 35) extra.push({ key: `wtd-${o.id}-${last?.date || ""}`, tone: "info", title: `Monthly water temperature check due: ${o.name}`, detail: last ? `Last checked ${fmtDate(last.date)}` : "Not checked yet", tab: "meters" });
    });
    // Training & certificates expiring.
    locTraining.forEach((t) => {
      const n = daysUntil(t.expiry); if (n === null) return;
      if (n < 0) extra.push({ key: `tr-${t.id}`, tone: "warn", title: `Training expired: ${t.person} — ${t.course}`, detail: `Expired ${fmtDate(t.expiry)}`, tab: "meters" });
      else if (n <= 45) extra.push({ key: `trs-${t.id}`, tone: "info", title: `Training expiring: ${t.person} — ${t.course}`, detail: `Expires ${fmtDate(t.expiry)} — book a refresher`, tab: "meters" });
    });
    // Fire drills: at least one a year (more often is good practice).
    {
      const lastFire = locDrills.filter((d) => d.type === "Fire evacuation").sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const since = lastFire ? -daysUntil(lastFire.date) : null;
      if (!lastFire || since > 365) extra.push({ key: `drill-${lastFire?.date || "none"}`, tone: "warn", title: "Fire drill overdue", detail: lastFire ? `Last fire drill ${fmtDate(lastFire.date)}` : "No fire drill recorded — hold one at least once a year", tab: "meters" });
    }
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
  }, [alerts, locMeters, locReadings, locSpares, locKeys, locReminders, locSuppliers, locIncidents, locProjects, faultsByDevice, locDevices, locServices, locPermits, locInvoices, locPOs, locOutlets, locWaterReadings, locTraining, locDrills, settings.siteDocs]);
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
  const UNDO_KEYS = ["devices", "services", "works", "suppliers", "budgetLines", "deviceTasks", "visitBudgets", "spares", "keys", "reminders", "audits", "incidents", "projects", "permits", "waste", "purchaseOrders", "invoices", "waterOutlets", "waterReadings", "training", "drills", "signins", "trash"]; // archive also uses undo
  const currentCollections = { devices, services, works, suppliers, budgetLines, deviceTasks, visitBudgets, spares, keys: keysList, reminders, audits, incidents, projects, permits, waste, purchaseOrders, invoices, waterOutlets, waterReadings, training, drills, signins, trash };
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
  const allData = { users, countries, locations, devices, services, works, suppliers, budgets, budgetLines, deviceTasks, visitBudgets, settings, activity, meters, meterReadings, signins, spares, keys: keysList, reminders, audits, incidents, projects, permits, waste, purchaseOrders, invoices, waterOutlets, waterReadings, training, drills, trash };
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
    ["meters", "meterReadings", "signins", "spares", "keys", "reminders", "audits", "incidents", "projects", "permits", "waste", "purchaseOrders", "invoices", "waterOutlets", "waterReadings", "training", "drills", "trash"].forEach((k) => { if (Array.isArray(d[k])) persist[k](d[k]); });
    showToast("Backup restored", payload.exportedAt ? `from ${fmtDate(payload.exportedAt.slice(0, 10))}` : "");
    return null;
  }
  function convertWorkToProject(work) {
    const dev = deviceById[work.deviceId];
    const pid = uid();
    persist.projects([{ id: pid, locationId: selectedLocationId, name: `${dev?.name ? `${dev.name}: ` : ""}${String(work.description).slice(0, 60)}`, status: "idea", budget: Number(work.quoteAmount) || 0, spent: 0, deviceIds: work.deviceId ? [work.deviceId] : [], supplierId: work.supplierId || null, notes: `From reactive work raised ${fmtDate(work.dateRaised)}:\n${work.description}`, milestones: [], by: currentUser?.name, at: new Date().toISOString() }, ...projects]);
    persist.works(works.map((w) => w.id === work.id ? { ...w, projectId: pid, comments: [...(w.comments || []), { text: "Turned into a project", by: currentUser?.name || "Unknown", at: new Date().toISOString() }] } : w));
    setWorksView("projects");
    showToast("Project created from work", dev?.name);
  }
  function saveSiteInfo(info) { persist.settings({ ...settings, siteInfo: { ...(settings.siteInfo || {}), [selectedLocationId]: info } }); showToast("Site information saved"); }
  function saveCustomStatutory(list) { persist.settings({ ...settings, customStatutory: list }); }
  /* ---- out of service ---- */
  function setOutOfService(id, down, reason) {
    const now = new Date().toISOString(); const dev = deviceById[id];
    persist.devices(devices.map((d) => {
      if (d.id !== id) return d;
      const list = [...(d.downtime || [])];
      if (down) list.unshift({ from: now, to: null, reason: reason || "", by: currentUser?.name });
      else if (list[0] && !list[0].to) list[0] = { ...list[0], to: now, backBy: currentUser?.name };
      return { ...d, downtime: list.slice(0, 100) };
    }));
    showToast(down ? "Marked out of service" : "Back in service", `${dev?.name || ""}${reason ? ` — ${reason}` : ""}`);
  }
  function setContactFollowUpDone(supplierId, contactId) {
    persist.suppliers(suppliers.map((s) => s.id === supplierId ? { ...s, contactLog: (s.contactLog || []).map((c) => c.id === contactId ? { ...c, followUpDone: true } : c) } : s));
  }
  function saveSiteDocs(list) { persist.settings({ ...settings, siteDocs: [...(settings.siteDocs || []).filter((d) => d.locationId !== selectedLocationId), ...list.map((d) => ({ ...d, locationId: selectedLocationId }))] }); }
  /* ---- suppliers: contact log and merging duplicates ---- */
  function addSupplierContact(id, entry) {
    persist.suppliers(suppliers.map((s) => s.id === id ? { ...s, contactLog: [entry, ...(s.contactLog || [])].slice(0, 300) } : s));
    showToast("Contact logged", `${supplierById[id]?.name || ""} — ${entry.summary.slice(0, 60)}`);
  }
  function mergeSuppliers(keepId, dropId) {
    const keep = supplierById[keepId]; const drop = supplierById[dropId]; if (!keep || !drop) return;
    const swap = (list) => list.map((x) => x.supplierId === dropId ? { ...x, supplierId: keepId } : x);
    withUndo(() => {
      persist.devices(swap(devices)); persist.services(swap(services)); persist.works(swap(works)); persist.budgetLines(swap(budgetLines));
      persist.purchaseOrders(swap(purchaseOrders)); persist.invoices(swap(invoices)); persist.spares(swap(spares)); persist.waste(swap(waste)); persist.signins(swap(signins));
      persist.suppliers(suppliers.filter((s) => s.id !== dropId).map((s) => s.id === keepId ? { ...s, contactLog: [...(s.contactLog || []), ...(drop.contactLog || [])], links: [...(s.links || []), ...(drop.links || [])] } : s));
      showToast("Suppliers merged", `${drop.name} → ${keep.name}`);
    });
  }
  const pinnedIds = (display.pinned || []);
  function togglePin(id) { saveDisplay({ ...display, pinned: pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id] }); }
  /* ---- simple record lists: POs, invoices, water outlets/readings, training, drills ---- */
  function makeRecordOps(kind, list, label, describe) {
    return {
      save(rec) {
        if (rec.id) { persist[kind](list.map((x) => x.id === rec.id ? { ...x, ...rec } : x)); showToast(`${label} updated`, describe(rec)); }
        else { persist[kind]([{ ...rec, id: uid(), locationId: selectedLocationId, by: currentUser?.name, at: new Date().toISOString() }, ...list]); showToast(`${label} added`, describe(rec)); }
      },
      remove(id) { const rec = list.find((x) => x.id === id); withUndo(() => { persist[kind](list.filter((x) => x.id !== id)); showToast(`${label} deleted`, rec ? describe(rec) : ""); }); },
    };
  }
  const poOps = makeRecordOps("purchaseOrders", purchaseOrders, "Purchase order", (r) => `${r.number} ${gbp(r.value)}`);
  const invOps = makeRecordOps("invoices", invoices, "Invoice", (r) => `${r.number} ${gbp(r.amount)}`);
  const outletOps = makeRecordOps("waterOutlets", waterOutlets, "Outlet", (r) => r.name);
  const trainingOps = makeRecordOps("training", training, "Training record", (r) => `${r.person} — ${r.course}`);
  const drillOps = makeRecordOps("drills", drills, "Drill", (r) => `${r.type} ${fmtDate(r.date)}`);
  function addWaterReadings(list) {
    persist.waterReadings([...list.map((r) => ({ ...r, id: uid(), by: currentUser?.name })), ...waterReadings]);
    const bad = list.filter((r) => { const o = waterOutlets.find((x) => x.id === r.outletId); return o && WATER_LIMITS[o.type] && !WATER_LIMITS[o.type].ok(Number(r.temp)); }).length;
    showToast(`${list.length} temperature${list.length === 1 ? "" : "s"} recorded`, bad ? `${bad} out of range` : "all in range");
  }
  function bulkUpdateWorks(ids, patch) {
    const set = new Set(ids); const today = new Date().toISOString().slice(0, 10);
    persist.works(works.map((w) => {
      if (!set.has(w.id)) return w;
      const extra = patch.status === "completed" && w.status !== "completed" ? { completedAt: today } : patch.status && patch.status !== "completed" ? { completedAt: null } : {};
      return { ...w, ...patch, ...extra };
    }));
    showToast(`${ids.length} work${ids.length === 1 ? "" : "s"} updated`, patch.status ? `status: ${patch.status.replace("_", " ")}` : patch.assignee !== undefined ? `assigned to ${patch.assignee || "nobody"}` : "");
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
  function toTrash(entry) { persist.trash([{ ...entry, trashId: uid(), deletedAt: new Date().toISOString(), by: currentUser?.name, locationId: selectedLocationId }, ...trash.filter((t) => Date.now() - new Date(t.deletedAt).getTime() < 30 * 86400000)].slice(0, 300)); }
  function restoreFromTrash(t) {
    const p = t.payload || {};
    if (t.type === "service") {
      persist.devices([...devices.filter((d) => d.id !== p.device.id), p.device]);
      if (p.services?.length) persist.services([...p.services, ...services]);
      if (p.works?.length) persist.works([...p.works, ...works]);
      if (p.tasks?.length) persist.deviceTasks([...deviceTasks, ...p.tasks]);
      if (p.visitBudgets?.length) persist.visitBudgets([...visitBudgets, ...p.visitBudgets]);
    } else if (t.type === "work") persist.works([p.work, ...works.filter((w) => w.id !== p.work.id)]);
    else if (t.type === "supplier") persist.suppliers([...suppliers.filter((s) => s.id !== p.supplier.id), p.supplier]);
    persist.trash(trash.filter((x) => x.trashId !== t.trashId));
    showToast("Restored", t.name);
  }
  function deleteDevice(id) {
    const dev = deviceById[id];
    if (dev) toTrash({ type: "service", name: dev.name, payload: { device: dev, services: services.filter((s) => s.deviceId === id), works: works.filter((w) => w.deviceId === id), tasks: deviceTasks.filter((t) => t.deviceId === id), visitBudgets: visitBudgets.filter((v) => v.deviceId === id) } });
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
    const forDevice = updatedServices.filter((s) => s.deviceId === deviceId && s.date && !s.aborted && !s.skipped);
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
    if (!isEdit && record.partsUsed?.length) {
      const at = new Date().toISOString(); const devName = deviceById[record.deviceId]?.name || "";
      persist.spares(spares.map((sp) => { const u = record.partsUsed.find((p) => p.spareId === sp.id); if (!u) return sp; const qty = Math.max(0, (Number(sp.qty) || 0) - Number(u.qty)); return { ...sp, qty, log: [{ at, by: currentUser?.name, delta: -Number(u.qty), note: `Used on ${devName} visit ${fmtDate(record.date)}` }, ...(sp.log || [])].slice(0, 200) }; }));
    }
    if (record.aborted) {
      // Supplier attended but couldn't complete: keep the record, don't move the schedule on.
      if (isEdit) recomputeSchedule(record.deviceId, next);
      if (!isEdit) persist.devices(devices.map((d) => d.id === record.deviceId ? { ...d, abortLog: [...(d.abortLog || []), { date: record.date, reason: record.abortReason, by: currentUser?.name }] } : d));
      setServiceModal(null);
      showToast("Visit recorded as not completed", `${deviceById[record.deviceId]?.name || ""} — ${record.abortReason || ""}`);
      return;
    }
    if (record.skipped && !isEdit) {
      // Deliberately skipped: record it and move on to the next planned date, no spend.
      advanceSchedule(record.deviceId, record.date || new Date().toISOString().slice(0, 10), next);
      setServiceModal(null);
      showToast("Visit skipped — next one scheduled", `${deviceById[record.deviceId]?.name || ""} — ${record.skipReason || ""}`);
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
    const id = uid();
    const incidentId = workPrefill?.incidentId || null;
    persist.works([{ ...work, id, incidentId, loggedBy: currentUser?.name, loggedAt: new Date().toISOString() }, ...works]);
    if (incidentId) persist.incidents(incidents.map((i) => i.id === incidentId ? { ...i, workId: id } : i));
    setAddWorkFor(null); setWorkPrefill(null);
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
  function deleteWork(id) { const w = works.find((x) => x.id === id); if (w) toTrash({ type: "work", name: `${deviceById[w.deviceId]?.name || "Work"} — ${String(w.description).slice(0, 50)}`, payload: { work: w } }); withUndo(() => { persist.works(works.filter((x) => x.id !== id)); showToast("Extra work deleted", w?.description?.slice(0, 60)); }); }
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
  function deleteSupplier(id) { const sup = supplierById[id]; if (sup) toTrash({ type: "supplier", name: sup.name, payload: { supplier: sup } }); withUndo(() => { persist.suppliers(suppliers.filter((s) => s.id !== id)); showToast("Supplier deleted", sup?.name); }); setSupplierModal(null); }
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
  }, [users, countries, locations, devices, services, works, suppliers, budgets, budgetLines, deviceTasks, visitBudgets, settings, activity, meters, meterReadings, signins, spares, keysList, reminders, audits, incidents, projects, permits, waste, purchaseOrders, invoices, waterOutlets, waterReadings, training, drills, trash]);

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
  set_ACTIVE_CURRENCY_CODE(selectedCountry?.currency || "GBP");
  applyCategorySettings(settings);
  set_ACTIVE_CUSTOM_FIELDS(settings.customFields || []);
  set_ACTIVE_TEMPLATES([...BUILTIN_TEMPLATES, ...(settings.serviceTemplates || [])]);
  set_ACTIVE_CAN_EDIT(currentUser?.role !== "viewer");
  set_ACTIVE_USERS(users);
  { const tc = {}; devices.forEach((d) => (d.tags || []).forEach((t) => { tc[d.locationId] = tc[d.locationId] || []; if (!tc[d.locationId].includes(t)) tc[d.locationId].push(t); })); set_TAG_SUGGESTIONS_CACHE(tc); }
  { const pc = {}; devices.forEach((d) => { if (!d.archived && !d.parentId) (pc[d.locationId] = pc[d.locationId] || []).push({ id: d.id, name: d.name, parentId: d.parentId }); }); set_PARENT_CANDIDATES_CACHE(pc); }
  set_ACTIVE_SITE_INFO((settings.siteInfo || {})[selectedLocationId] || {});
  set_ACTIVE_SLA({ ...SLA_DAYS, ...(settings.slaDays || {}), workingDays: !!settings.slaWorkingDays });
  set_AREA_SUGGESTIONS_CACHE({}); devices.forEach((d) => { if (d.area) (AREA_SUGGESTIONS_CACHE[d.locationId] = AREA_SUGGESTIONS_CACHE[d.locationId] || []).includes(d.area) || AREA_SUGGESTIONS_CACHE[d.locationId].push(d.area); });

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
              <button onClick={() => setShowHelp(true)} title="Help & what's new" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, width: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <HelpCircle size={15} color="#fff" />
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
                meters={<MetersTab onImportReadings={(list) => { persist.meterReadings([...list.map((r) => ({ ...r, id: uid(), by: currentUser?.name, at: new Date().toISOString(), imported: true })), ...meterReadings]); showToast(`${list.length} readings imported`); }} meters={locMeters} readings={locReadings} suppliers={locSuppliers}
                  onSaveMeter={saveMeter} onArchiveMeter={archiveMeter} onAddReading={addReading} onDeleteReading={deleteReading} />}
                spares={<SparesView spares={locSpares} suppliers={locSuppliers} devices={locDevices} senderName={currentUser?.name}
                  onSave={saveSpare} onAdjust={adjustSpare} onDelete={deleteSpare} />}
                keys={<KeysView locationName={locationLabel({ locationId: selectedLocationId })} keys={locKeys} onSave={saveKey} onIssue={issueKey} onReturn={returnKey} onDelete={deleteKey} />}
                permits={<PermitsView permits={locPermits} devices={locDevices} suppliers={locSuppliers} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })} onSave={savePermit} onClose={closePermit} />}
                waste={<WasteView waste={locWaste} suppliers={locSuppliers} onSave={saveWaste} onDelete={deleteWaste} />}
                openPermits={locPermits.filter((x) => x.status === "open").length}
                water={<WaterTempsView outlets={locOutlets} readings={locWaterReadings} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })}
                  onSaveOutlet={outletOps.save} onDeleteOutlet={outletOps.remove} onAddReadings={addWaterReadings} />}
                training={<TrainingView records={locTraining} onSave={trainingOps.save} onDelete={trainingOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                docs={<DocumentsView docs={(settings.siteDocs || []).filter((d) => d.locationId === selectedLocationId)} onSave={saveSiteDocs} locationName={locationLabel({ locationId: selectedLocationId })} />}
                drills={<DrillsView drills={locDrills} onSave={drillOps.save} onDelete={drillOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                audits={<AuditsView audits={locAudits} templates={settings.auditTemplates || DEFAULT_AUDIT_TEMPLATES} suppliers={locSuppliers} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []}
                  locationName={locationLabel({ locationId: selectedLocationId })} senderName={currentUser?.name}
                  onSave={saveAudit} onDelete={deleteAudit} onSaveTemplates={saveAuditTemplates} />}
                incidents={<IncidentsView onRaiseWork={locDevices.length ? (inc) => { setWorkPrefill({ incidentId: inc.id, description: `Following incident on ${fmtDate(inc.date)}${inc.area ? ` (${inc.area})` : ""}: ${inc.description}`, priority: inc.type === "injury" ? "high" : "medium" }); setAddWorkFor(locDevices[0].id); } : null} incidents={locIncidents} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })}
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
                pendingCount={pendingCount} hiddenCards={display.homeHidden || []}
                todayItems={todayItems} weekAhead={weekAhead}
                siteInfo={(settings.siteInfo || {})[selectedLocationId] || null} onSaveSiteInfo={saveSiteInfo}
                customStatutory={settings.customStatutory || []} onSaveCustomStatutory={saveCustomStatutory} pinnedDevices={pinnedIds.map((id) => locDevices.find((d) => d.id === id)).filter(Boolean)} onUnpin={togglePin}
                setup={{ suppliers: locSuppliers.length, devices: locDevices.length, budgets: locBudgets.length + locBudgetLines.length, visits: locServices.length, backup: !!settings.lastBackupAt || REMOTE, shared: REMOTE, hidden: !!display.hideSetup }}
                onHideSetup={() => saveDisplay({ ...display, hideSetup: true })}
                syncInfo={REMOTE ? { lastSync, syncing, onRefresh: () => refreshShared(true) } : null}
                reminders={locReminders} users={users} onAddReminder={addReminder} onToggleReminder={toggleReminder} onDeleteReminder={deleteReminder}
                onGo={(t) => t === "alerts" ? setShowAlerts(true) : setTab(t)} onOpenDevice={setHistoryFor} />
            )}
            {tab === "devices" && (
              <DevicesTab onChaseAll={recordChase} allSupplierList={locSuppliers} locationName={locationLabel({ locationId: selectedLocationId })} pinned={pinnedIds} onTogglePin={togglePin} onDataHealth={() => setShowHealth(true)} onLibrary={() => setShowLibrary(true)} faultsByDevice={faultsByDevice} onImport={() => setShowImport(true)} allLocations={locations.filter((l) => l.id !== selectedLocationId).map((l) => ({ id: l.id, label: `${countryById[l.countryId]?.name || ""} · ${l.name}` }))} onCopyTo={copyDevicesToLocation} onBulkUpdate={bulkUpdateDevices} allSuppliers={locSuppliers} archivedDevices={locArchivedDevices} onRestore={restoreDevice} onBulkLog={bulkLogVisits} onBook={saveBooking} prefs={listPrefs} onPrefs={(patch) => setListPrefs((p) => ({ ...p, ...patch }))} devices={searchAllLocations ? globalFilteredDevices : filteredDevices} search={search} setSearch={setSearch}
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
              <WorksTab onConvertToProject={convertWorkToProject} onBulkUpdate={bulkUpdateWorks} slaWorkingDays={!!settings.slaWorkingDays} onSetSla={(v, wd) => { persist.settings({ ...settings, slaDays: v, slaWorkingDays: !!wd }); showToast("Target times saved", `High ${v.high}d · Medium ${v.medium}d · Low ${v.low}d`); }} works={locWorks} deviceById={deviceById} supplierById={supplierById} suppliers={locSuppliers}
                onUpdate={updateWork} onDelete={deleteWork} currentUserName={currentUser?.name}
                approvalThreshold={Number(settings.approvalThreshold) || 0} onSetThreshold={(v) => { persist.settings({ ...settings, approvalThreshold: v }); showToast("Approval rule saved"); }}
                onConvertToPlan={convertWorkToPlanLine} onConvertToService={convertWorkToService}
                onAdd={() => setAddWorkFor(locDevices[0]?.id ?? null)} hasDevices={locDevices.length > 0} />
            )}
            {tab === "suppliers" && (
              <SuppliersTab packData={{ devices: locDevices, services: locServices, works: locWorks, invoices: locInvoices }} locationName={locationLabel({ locationId: selectedLocationId })} onFollowUpDone={setContactFollowUpDone} invoices={locInvoices} userName={currentUser?.name} onAddContact={addSupplierContact} onMerge={mergeSuppliers} suppliers={locSuppliers} onAdd={() => setSupplierModal({})} onEdit={(record) => setSupplierModal({ record })} onDelete={deleteSupplier}
                devices={locDevices} services={locServices} works={locWorks} budgetLines={locBudgetLines} visitBudgets={locVisitBudgets} />
            )}
            {tab === "budget" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <ToggleButton active={budgetView === "budget"} onClick={() => setBudgetView("budget")}>Budget</ToggleButton>
                <ToggleButton active={budgetView === "finance"} onClick={() => setBudgetView("finance")}>POs &amp; invoices{locInvoices.filter((i) => i.status === "received").length ? ` (${locInvoices.filter((i) => i.status === "received").length} to approve)` : ""}</ToggleButton>
              </div>
            )}
            {tab === "budget" && budgetView === "finance" && (
              <FinanceView userName={currentUser?.name} pos={locPOs} invoices={locInvoices} suppliers={locSuppliers} works={locWorks} deviceById={deviceById}
                onSavePO={poOps.save} onDeletePO={poOps.remove} onSaveInvoice={invOps.save} onDeleteInvoice={invOps.remove} />
            )}
            {tab === "budget" && budgetView === "budget" && (
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
          spares={locSpares}
          lastVisit={locServices.filter((v) => v.deviceId === serviceModal.deviceId && !v.aborted && !v.skipped && v.id !== serviceModal.record?.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null}
          locationName={locationLabel({ locationId: deviceById[serviceModal.deviceId]?.locationId })}
          device={deviceById[serviceModal.deviceId]} existing={serviceModal.record} suppliers={locSuppliers} openPermits={locPermits.filter((x) => x.status === "open" && (!x.deviceId || x.deviceId === serviceModal.deviceId))}
          visitBudgets={visitBudgets.filter((v) => v.deviceId === serviceModal.deviceId)}
          onClose={() => setServiceModal(null)} onSave={saveService} onDelete={deleteService} />
      )}
      {historyFor && (
        <DeviceHistoryModal allDevices={locAllDevices} onOutOfService={(down, reason) => setOutOfService(historyFor, down, reason)} works={locWorks.filter((w) => w.deviceId === historyFor)} onAddNote={(text) => addDeviceNote(historyFor, text)} onDeleteNote={(nid) => deleteDeviceNote(historyFor, nid)} supplierById={supplierById} locationName={locationLabel({ locationId: deviceById[historyFor]?.locationId })} device={deviceById[historyFor]} services={services.filter((s) => s.deviceId === historyFor)}
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
        <AddWorkModal openWorks={locWorks.filter((w) => !["completed", "rejected"].includes(w.status))} prefill={workPrefill} devices={locDevices} suppliers={locSuppliers} defaultDeviceId={addWorkFor} onClose={() => { setAddWorkFor(null); setWorkPrefill(null); }} onSave={addWork} />
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
      {showHealth && <DataHealthModal devices={locDevices} suppliers={locSuppliers} onClose={() => setShowHealth(false)} onEdit={(d) => { setShowHealth(false); setDeviceModal({ record: d }); }} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showImport && <ImportModal suppliers={locSuppliers} existing={locAllDevices} onClose={() => setShowImport(false)} onImport={(rows) => { importDevices(rows); setShowImport(false); }} />}
      {showSearch && (
        <GlobalSearchModal extra={{ incidents: locIncidents, permits: locPermits, pos: locPOs, invoices: locInvoices, spares: locSpares, keys: locKeys, projects: locProjects }} onGoTab={(t) => { setShowSearch(false); setTab(t); }} devices={locDevices} services={locServices} works={locWorks} suppliers={locSuppliers} deviceById={deviceById} onClose={() => setShowSearch(false)}
          onOpenDevice={(id) => { setShowSearch(false); setHistoryFor(id); }}
          onOpenVisit={(v) => { setShowSearch(false); setServiceModal({ deviceId: v.deviceId, record: v }); }}
          onOpenWork={() => { setShowSearch(false); setTab("works"); }}
          onOpenSupplier={(sup) => { setShowSearch(false); setTab("suppliers"); if (ACTIVE_CAN_EDIT) setSupplierModal({ record: sup }); }} />
      )}
      {showData && (
        <DataModal trash={trash.filter((t) => !t.locationId || t.locationId === selectedLocationId)} onRestoreDeleted={restoreFromTrash} users={users} alertCount={visibleAlerts.filter((a) => a.tone !== "info").length} pendingCount={pendingCount} remote={REMOTE} display={display} onDisplay={saveDisplay} activity={activity.filter((a) => !a.locationId || a.locationId === selectedLocationId)} storageInfo={storageInfo}
          saveErrors={saveErrors} lastBackupAt={settings.lastBackupAt} canEdit={ACTIVE_CAN_EDIT}
          onBackup={downloadBackup} onRestore={restoreBackup} onClose={() => setShowData(false)} />
      )}
      {showAlerts && <AlertsModal snoozedCount={snoozedCount} onSnooze={snoozeAlert} onClearSnoozes={clearSnoozes} locationName={locationLabel({ locationId: selectedLocationId })} senderName={currentUser?.name} alerts={visibleAlerts} onClose={() => setShowAlerts(false)} onGo={(t) => { setTab(t); setShowAlerts(false); }} />}
      {showReports && <ReportsModal onClose={() => setShowReports(false)} locationName={locationLabel({ locationId: selectedLocationId })}
        data={{ portfolio: { locations, countries, devices, services, works, budgets, visitBudgets }, settingsFields: settings, incidents: locIncidents, audits: locAudits, signins: locSignins, faultsByDevice, deviceTasks: locDeviceTasks, devices: locDevices, services: locServices, works: locWorks, suppliers: locSuppliers, budgets: locBudgets, budgetLines: locBudgetLines, visitBudgets: locVisitBudgets, deviceById, supplierById }} />}
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
