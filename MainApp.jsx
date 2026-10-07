// The main app: loads and saves all data, works out alerts, and lays out the header, tabs and pop-ups.
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Activity, AlertTriangle, Bell, Calendar, CalendarCheck, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock, CloudOff, FileCheck, FileText, Flame, Globe2, HardDrive, HardHat, HelpCircle, History, LayoutDashboard, Loader2, Package, Plus, PoundSterling, Receipt, Search, ShieldAlert, Siren, SlidersHorizontal, Timer, TrendingUp, Undo2, User, Users, Users as UsersIcon, Wrench, X } from "lucide-react";
import { EmptyState, StatChip, ToggleButton } from "./components/ui.jsx";
import { ACCENTS, BUILTIN_TEMPLATES, DEFAULT_AUDIT_TEMPLATES, EQUIPMENT_TYPES, INCIDENT_TYPES, LOG_TEMPLATES, MONTH_LABELS, MONTH_NAMES, ONBOARDING_ITEMS, PKEYS, SKEYS, SLA_DAYS, WASTE_STREAMS, WATER_LIMITS, alertGroup } from "./lib/constants.js";
import { ACTIVE_CAN_EDIT, AREA_SUGGESTIONS_CACHE, CATEGORY_KEYS, CATEGORY_META, applyCategorySettings, emptyCatMap, set_ACTIVE_BRAND, set_ACTIVE_CAN_EDIT, set_ACTIVE_CURRENCY_CODE, set_ACTIVE_CUSTOM_FIELDS, set_ACTIVE_SITE_INFO, set_ACTIVE_SLA, set_ACTIVE_TEMPLATES, set_ACTIVE_USERS, set_AREA_SUGGESTIONS_CACHE, set_PARENT_CANDIDATES_CACHE, set_TAG_SUGGESTIONS_CACHE } from "./lib/globals.js";
import { LAST_LOCAL_WRITE, loadPersonal, loadShared, savePersonal, saveShared, set_SAVE_STATUS_LISTENER } from "./lib/storage.js";
import { addDays, addMonths, appBaseUrl, cachedWeather, computeCompliance, currentBooking, currentDowntime, daysUntil, downloadBlob, escapeHtml, fmtDate, gbp, inBlackout, isMirrored, meterStats, replacementYear, shiftDate, siteWeatherSource, uid, workSla } from "./lib/utils.js";
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
import { AsbestosView, DocumentsView, DrillsView, LogsView, TrainingView, WaterTempsView } from "./tabs/SafetyViews.jsx";
import { FinanceView } from "./tabs/FinanceView.jsx";
import { THEME_CSS } from "./lib/theme.js";
import { PageHeader } from "./components/PageHeader.jsx";
import { ActionModal, ActionsView, BookTogetherModal, BulkEmailModal, CarParkView, CopySiteModal, CoshhView, EquipmentView, FeedbackView, FloorPlansView, IsolationsView, KeyDatesView, MergeServiceModal, PeopleDirectoryModal, RollCallModal, ShutdownsView, SpacesView, SubmissionsModal, TvDashboard, WalkroundsView } from "./tabs/MoreViews.jsx";
import { buildDailyBriefing, buildEmergencySheet, buildLookahead, openPrintReport, tableHtml } from "./lib/reports.js";
import { budgetModel } from "./tabs/BudgetPlus.jsx";

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
  const [weatherTick, setWeatherTick] = useState(0);
  useEffect(() => { const on = () => setWeatherTick((n) => n + 1); window.addEventListener("ppm-weather", on); return () => window.removeEventListener("ppm-weather", on); }, []);
  const [notices, setNotices] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [savings, setSavings] = useState([]);
  const [asbestos, setAsbestos] = useState([]);
  const [actions, setActions] = useState([]);
  const [coshh, setCoshh] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [carPark, setCarPark] = useState([]);
  const [costLines, setCostLines] = useState([]);
  const [shutdowns, setShutdowns] = useState([]);
  const [isolations, setIsolations] = useState([]);
  const [floorplans, setFloorplans] = useState([]);
  const [keyDates, setKeyDates] = useState([]);
  const [showTv, setShowTv] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [planQueue, setPlanQueue] = useState(null); const [planCheckReport, setPlanCheckReport] = useState(false); // service ids whose budget plan should be checked against their schedule
  const queuePlanCheck = (ids) => setPlanQueue((q) => [...new Set([...(q || []), ...ids.filter(Boolean)])]);
  const [openJobOnLoad, setOpenJobOnLoad] = useState(null);
  const [recentIds, setRecentIds] = useState(() => { try { return JSON.parse(localStorage.getItem("ppm:recentServices") || "[]"); } catch (e) { return []; } });
  const [equipment, setEquipment] = useState([]);
  const [visitSubmissions, setVisitSubmissions] = useState([]);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [showRollCall, setShowRollCall] = useState(false);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showPeopleDir, setShowPeopleDir] = useState(false);
  const [showCopySite, setShowCopySite] = useState(false);
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false);
  useEffect(() => { if (!window.matchMedia) return; const mq = window.matchMedia("(prefers-color-scheme: dark)"); const on = (e) => setSystemDark(e.matches); mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener?.(on); return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener?.(on); }; }, []);
  const [spaces, setSpaces] = useState([]);
  const [walkrounds, setWalkrounds] = useState([]);
  const [bookTogether, setBookTogether] = useState(false);
  const [mergeFor, setMergeFor] = useState(null);
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
  const [editLocation, setEditLocation] = useState(null);
  const [editCountryFor, setEditCountryFor] = useState(null);
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
  // Theme: "light" (Clear Light) or "midnight". Older devices may still have the old dark switch on.
  const themeChoice = display.theme || (display.dark ? "midnight" : "light");
  const themeKey = themeChoice === "auto" ? (systemDark ? "midnight" : "light") : themeChoice;
  useEffect(() => {
    document.documentElement.classList.remove("ppm-dark");
    document.documentElement.classList.toggle("ppm-midnight", themeKey === "midnight");
    document.documentElement.classList.toggle("ppm-contrast", themeKey === "contrast");
  }, [themeKey]);
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
  // Record when each person last used the app (once a day), shown in the people list.
  useEffect(() => {
    if (loading || !currentUserId) return;
    const today = new Date().toISOString().slice(0, 10);
    const me = users.find((u) => u.id === currentUserId);
    if (me && me.lastActive !== today) persist.users(users.map((u) => u.id === currentUserId ? { ...u, lastActive: today } : u));
  }, [loading, currentUserId]);
  // Recently viewed services (this device only).
  useEffect(() => {
    if (!historyFor || loading) return;
    const list = [historyFor, ...(display.recent || []).filter((x) => x !== historyFor)].slice(0, 8);
    saveDisplay({ ...display, recent: list });
  }, [historyFor]);
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
      const [u, c, l, d, s, w, sup, b, bl, dt, vb, nav, st, act, mt, mr, si, sn, sp, ky, rm, disp, au, inc, pr, pm, ws, po, inv, wo, wr, tr, dr, trs, nts, lge, svs, asb, acts, spc, wlk, csh, eqp, vsub, fbk, fpl, kdt, cpk, iso, cln, sdn] = await Promise.all([
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
        loadShared(SKEYS.trash), loadShared(SKEYS.notices), loadShared(SKEYS.logEntries), loadShared(SKEYS.savings), loadShared(SKEYS.asbestos),
        loadShared(SKEYS.actions), loadShared(SKEYS.spaces), loadShared(SKEYS.walkrounds),
        loadShared(SKEYS.coshh), loadShared(SKEYS.equipment), loadShared(SKEYS.visitSubmissions),
        loadShared(SKEYS.feedback), loadShared(SKEYS.floorplans), loadShared(SKEYS.keyDates),
        loadShared(SKEYS.carPark), loadShared(SKEYS.isolations), loadShared(SKEYS.costLines), loadShared(SKEYS.shutdowns),
      ]);
      setUsers(u); setCountries(c); setLocations(l); setDevices(d);
      setServices(s); setWorks(w); setSuppliers(sup); setBudgets(b); setBudgetLines(bl); setDeviceTasks(dt); setVisitBudgets(vb);
      if (st && !Array.isArray(st)) setSettings((prev) => ({ ...prev, ...st }));
      setActivity(Array.isArray(act) ? act : []);
      setMeters(Array.isArray(mt) ? mt : []); setMeterReadings(Array.isArray(mr) ? mr : []); setSignins(Array.isArray(si) ? si : []);
      setSnoozed(sn && !Array.isArray(sn) ? sn : {});
      setSpares(Array.isArray(sp) ? sp : []); setKeysList(Array.isArray(ky) ? ky : []); setReminders(Array.isArray(rm) ? rm : []);
      if (disp && !Array.isArray(disp)) setDisplay({ scale: 1, ...disp });
      if (disp?.startTab && disp.startTab !== "last" && !new URLSearchParams(window.location.search).get("service") && !new URLSearchParams(window.location.search).get("job")) setTab(disp.startTab);
      setAudits(Array.isArray(au) ? au : []); setIncidents(Array.isArray(inc) ? inc : []); setProjects(Array.isArray(pr) ? pr : []);
      setPermits(Array.isArray(pm) ? pm : []); setWaste(Array.isArray(ws) ? ws : []);
      setPurchaseOrders(Array.isArray(po) ? po : []); setInvoices(Array.isArray(inv) ? inv : []);
      setWaterOutlets(Array.isArray(wo) ? wo : []); setWaterReadings(Array.isArray(wr) ? wr : []);
      setTraining(Array.isArray(tr) ? tr : []); setDrills(Array.isArray(dr) ? dr : []);
      setAsbestos(Array.isArray(asb) ? asb : []);
      setCostLines(Array.isArray(cln) ? cln : []); setShutdowns(Array.isArray(sdn) ? sdn : []);
      setCarPark(Array.isArray(cpk) ? cpk : []); setIsolations(Array.isArray(iso) ? iso : []);
      setFeedback(Array.isArray(fbk) ? fbk : []); setFloorplans(Array.isArray(fpl) ? fpl : []); setKeyDates(Array.isArray(kdt) ? kdt : []);
      setCoshh(Array.isArray(csh) ? csh : []); setEquipment(Array.isArray(eqp) ? eqp : []); setVisitSubmissions(Array.isArray(vsub) ? vsub : []);
      setActions(Array.isArray(acts) ? acts : []); setSpaces(Array.isArray(spc) ? spc : []); setWalkrounds(Array.isArray(wlk) ? wlk : []);
      setNotices(Array.isArray(nts) ? nts : []); setLogEntries(Array.isArray(lge) ? lge : []); setSavings(Array.isArray(svs) ? svs : []);
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
      const deepJob = new URLSearchParams(window.location.search).get("job");
      const dj = deepJob ? (w || []).find((x) => x.id === deepJob) : null;
      const djDev = dj ? d.find((x) => x.id === dj.deviceId) : null;
      if (dj && djDev) { const lc = l.find((x) => x.id === djDev.locationId); setSelectedLocationId(djDev.locationId); if (lc) setSelectedCountryId(lc.countryId); setTab("works"); setOpenJobOnLoad(dj.id); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading || !planQueue) return;
    let lines = budgetLines, vbs = visitBudgets, added = 0, removed = 0;
    planQueue.forEach((id) => { const dev = devices.find((d) => d.id === id); if (!dev) return; const r = alignPlan(dev, lines, vbs); lines = r.lines; vbs = r.vbs; added += r.added; removed += r.removed; });
    setPlanQueue(null);
    if (added || removed) { persist.budgetLines(lines); persist.visitBudgets(vbs); logActivity("Service plans updated", `${added} planned visit${added === 1 ? "" : "s"} added, ${removed} out-of-date removed`); }
    if (planCheckReport) { setPlanCheckReport(false); showToast("Service plans checked", added || removed ? `${added} planned visit${added === 1 ? "" : "s"} added, ${removed} out-of-date removed` : "Everything already matches its schedule"); }
  }, [planQueue, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading) return;
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem("ppm:planCheckDay") === today) return; localStorage.setItem("ppm:planCheckDay", today); } catch (e) { /* ignore */ }
    const risen = [];
    const nextDevices = devices.map((d) => {
      const p = Number(d.upliftPct) || 0, m = Number(d.upliftMonth) || 0; if (!(p > 0) || !m || d.archived || !(Number(d.budgetPerVisit) > 0)) return d;
      const r = `${today.slice(0, 4)}-${String(m).padStart(2, "0")}-01`;
      if (r > today || (d.lastUpliftOn && d.lastUpliftOn >= r)) return d;
      const nb = Math.round(Number(d.budgetPerVisit) * (1 + p / 100) * 100) / 100; risen.push(`${d.name}: ${gbp(d.budgetPerVisit)} → ${gbp(nb)}`);
      return { ...d, budgetPerVisit: nb, lastUpliftOn: r, changeLog: [...(d.changeLog || []), { at: new Date().toISOString(), by: "Annual price rise", changes: [`Budget per visit ${gbp(d.budgetPerVisit)} → ${gbp(nb)} (+${p}%)`] }].slice(-100) };
    });
    if (risen.length) { persist.devices(nextDevices); logActivity(`Annual price rise applied to ${risen.length} service${risen.length === 1 ? "" : "s"}`, risen.join("; ").slice(0, 300)); showToast(`Annual price rise applied to ${risen.length} service${risen.length === 1 ? "" : "s"}`, risen.slice(0, 3).join(" · ")); }
    queuePlanCheck(devices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0).map((d) => d.id));
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live refresh when a shared database is connected: pull the latest data when the app
  // comes back into view and every minute, so everyone sees each other's changes.
  const REMOTE = typeof window !== "undefined" && !!window.storage?.__remote;
  const SHARED_SETTERS = { users: setUsers, countries: setCountries, locations: setLocations, devices: setDevices, services: setServices, works: setWorks, suppliers: setSuppliers, budgets: setBudgets, budgetLines: setBudgetLines, deviceTasks: setDeviceTasks, visitBudgets: setVisitBudgets, activity: setActivity, meters: setMeters, meterReadings: setMeterReadings, signins: setSignins, spares: setSpares, keys: setKeysList, reminders: setReminders, audits: setAudits, incidents: setIncidents, projects: setProjects, permits: setPermits, waste: setWaste, purchaseOrders: setPurchaseOrders, invoices: setInvoices, waterOutlets: setWaterOutlets, waterReadings: setWaterReadings, training: setTraining, drills: setDrills, trash: setTrash, notices: setNotices, logEntries: setLogEntries, savings: setSavings, asbestos: setAsbestos, actions: setActions, spaces: setSpaces, walkrounds: setWalkrounds, coshh: setCoshh, equipment: setEquipment, visitSubmissions: setVisitSubmissions, feedback: setFeedback, floorplans: setFloorplans, keyDates: setKeyDates, carPark: setCarPark, isolations: setIsolations, costLines: setCostLines, shutdowns: setShutdowns };
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
    notices: useCallback((next) => { setNotices(next); saveShared(SKEYS.notices, next); }, []),
    logEntries: useCallback((next) => { setLogEntries(next); saveShared(SKEYS.logEntries, next); }, []),
    savings: useCallback((next) => { setSavings(next); saveShared(SKEYS.savings, next); }, []),
    asbestos: useCallback((next) => { setAsbestos(next); saveShared(SKEYS.asbestos, next); }, []),
    actions: useCallback((next) => { setActions(next); saveShared(SKEYS.actions, next); }, []),
    spaces: useCallback((next) => { setSpaces(next); saveShared(SKEYS.spaces, next); }, []),
    walkrounds: useCallback((next) => { setWalkrounds(next); saveShared(SKEYS.walkrounds, next); }, []),
    coshh: useCallback((next) => { setCoshh(next); saveShared(SKEYS.coshh, next); }, []),
    equipment: useCallback((next) => { setEquipment(next); saveShared(SKEYS.equipment, next); }, []),
    visitSubmissions: useCallback((next) => { setVisitSubmissions(next); saveShared(SKEYS.visitSubmissions, next); }, []),
    feedback: useCallback((next) => { setFeedback(next); saveShared(SKEYS.feedback, next); }, []),
    floorplans: useCallback((next) => { setFloorplans(next); saveShared(SKEYS.floorplans, next); }, []),
    keyDates: useCallback((next) => { setKeyDates(next); saveShared(SKEYS.keyDates, next); }, []),
    carPark: useCallback((next) => { setCarPark(next); saveShared(SKEYS.carPark, next); }, []),
    isolations: useCallback((next) => { setIsolations(next); saveShared(SKEYS.isolations, next); }, []),
    costLines: useCallback((next) => { setCostLines(next); saveShared(SKEYS.costLines, next); }, []),
    shutdowns: useCallback((next) => { setShutdowns(next); saveShared(SKEYS.shutdowns, next); }, []),
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
      if (pct >= (Number(((settings.budgetSettings || {})[selectedLocationId] || {}).alertPct) || 80)) out.push({ key: `bg-${cat}-${yr}`, tone: pct >= 100 ? "danger" : "warn", title: `${CATEGORY_META[cat].label} budget at ${pct}%`, detail: `${gbp(spent)} of ${gbp(cap)} cap for ${yr}`, tab: "budget" });
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
  const complianceMonthAgo = useMemo(() => {
    const cut = addDays(new Date().toISOString().slice(0, 10), -30);
    return computeCompliance(locDevices, locVisitBudgets.filter((v) => v.date <= cut), locServices.filter((v) => String(v.date) <= cut)).pct;
  }, [locDevices, locVisitBudgets, locServices]);
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
    // Site logs with a regular frequency (e.g. weekly fire alarm test).
    (settings.logDefs || LOG_TEMPLATES.filter((t) => t.id === "firealarm")).filter((d) => d.everyDays && (!d.locationId || d.locationId === selectedLocationId) && (settings.logDefs ? true : false)).forEach((d) => {
      const last = logEntries.filter((x) => x.logId === d.id && x.locationId === selectedLocationId).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const age = last ? -daysUntil(last.date) : null;
      if (!last || age > d.everyDays) extra.push({ key: `log-${d.id}-${last?.date || "none"}`, tone: d.id === "firealarm" || d.firealarm ? "warn" : "info", title: `${d.name} due`, detail: last ? `Last entry ${fmtDate(last.date)} (${age} days ago)` : "No entries yet", tab: "meters" });
    });
    // Planned visits more than 2 weeks past that were never logged or released.
    { const t0 = new Date().toISOString().slice(0, 10); const live = new Set(locDevices.filter((d) => !d.archived).map((d) => d.id)); const missed = locBudgetLines.filter((l) => l.deviceId && live.has(l.deviceId) && l.actualAmount == null && !l.actualServiceId && l.status !== "skipped" && l.date.slice(0, 4) === t0.slice(0, 4) && daysUntil(l.date) < -14); if (missed.length) extra.push({ key: `missed-${t0.slice(0, 7)}-${missed.length}`, tone: "warn", title: `${missed.length} planned visit${missed.length === 1 ? "" : "s"} not logged`, detail: `${gbp(missed.reduce((a, l) => a + (Number(l.amount) || 0), 0))} still in the forecast — log them or release them in Budget → Checks`, tab: "budget" }); }
    // Visits over budget beyond the site's sign-off limit, with nobody named as approving them.
    { const pct = Number(budgetSettingsFor().overspendApprovalPct) || 0; if (pct > 0) { const y = new Date().getFullYear().toString(); const un = locServices.filter((v) => String(v.date).startsWith(y) && Number(v.cost) > 0 && !v.overspendApprovedBy).filter((v) => { const ln = locBudgetLines.find((l) => l.actualServiceId === v.id); const ref = Number(ln?.amount) || Number(locDevices.find((d) => d.id === v.deviceId)?.budgetPerVisit) || 0; return ref > 0 && Number(v.cost) > ref * (1 + pct / 100); }); if (un.length) extra.push({ key: `osp-${un.length}-${y}`, tone: "warn", title: `${un.length} visit${un.length === 1 ? "" : "s"} over budget without sign-off`, detail: `Over the ${pct}% limit — see Budget → Checks`, tab: "budget" }); } }
    // Planned shutdowns this week / happening now.
    shutdowns.filter((s) => s.locationId === selectedLocationId && String(s.end || s.start).slice(0, 10) >= todayISO && String(s.start).slice(0, 10) <= addDays(todayISO, 7)).forEach((s) => extra.push({ key: `sd-${s.id}`, tone: String(s.start).slice(0, 10) <= todayISO ? "warn" : "info", title: `${String(s.start).slice(0, 10) <= todayISO ? "Shutdown today" : "Shutdown coming up"}: ${s.type}`, detail: `${new Date(s.start).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${s.areas ? ` · ${s.areas}` : ""}${s.notifiedAt ? "" : " · occupants not told yet"}`, tab: "meters" }));
    // Little-used water outlets not flushed for a week (Legionella control).
    { const lu = locOutlets.filter((o) => o.littleUsed && (!(o.flushLog || [])[0] || -daysUntil(o.flushLog[0].date) > 7)); if (lu.length) extra.push({ key: `flush-${todayISO.slice(0, 8)}${Math.floor(new Date().getDate() / 7)}-${lu.length}`, tone: "warn", title: `${lu.length} little-used outlet${lu.length === 1 ? "" : "s"} need flushing`, detail: lu.slice(0, 4).map((o) => o.name).join(", "), tab: "meters" }); }
    // Valves and isolators not operated for over a year.
    { const iv = isolations.filter((i) => i.locationId === selectedLocationId && /valve|stopcock|isolator|shut-off/i.test(i.kind) && i.lastExercised && -daysUntil(i.lastExercised) > 365); if (iv.length) extra.push({ key: `isox-${todayISO.slice(0, 7)}`, tone: "info", title: `${iv.length} isolation point${iv.length === 1 ? "" : "s"} not operated for over a year`, detail: "Operate them so they don't seize — " + iv.slice(0, 3).map((i) => i.kind).join(", "), tab: "meters" }); }
    // Disputed invoices left open, recycling below target, car park permits expiring.
    locInvoices.filter((i) => i.status === "disputed" && i.disputedAt && -daysUntil(i.disputedAt.slice(0, 10)) >= 14).forEach((i) => extra.push({ key: `dsp-${i.id}`, tone: "warn", title: `Invoice still disputed: ${i.number}`, detail: `${gbp(i.amount)} · since ${fmtDate(i.disputedAt.slice(0, 10))}${i.disputeReason ? ` — ${i.disputeReason}` : ""}`, tab: "budget" }));
    { const tgt = Number((settings.recyclingTarget || {})[selectedLocationId]); if (tgt) { const yr = String(new Date().getFullYear()); const ytd = locWaste.filter((w) => String(w.date).startsWith(yr)); const tot = ytd.reduce((t, w) => t + (Number(w.weightKg) || 0), 0); const gen = ytd.filter((w) => w.stream === "general" || w.stream === "hazardous").reduce((t, w) => t + (Number(w.weightKg) || 0), 0); const rate = tot ? Math.round(((tot - gen) / tot) * 100) : null; if (rate != null && rate < tgt) extra.push({ key: `rec-${yr}-${rate}`, tone: "info", title: `Recycling ${rate}% — below your ${tgt}% target`, detail: "Check bins and signage, or talk to your waste contractor", tab: "meters" }); } }
    carPark.filter((c) => c.locationId === selectedLocationId && c.expiry && daysUntil(c.expiry) <= 14 && daysUntil(c.expiry) >= -30).forEach((c) => extra.push({ key: `cp-${c.id}-${c.expiry}`, tone: "info", title: `Parking permit ${daysUntil(c.expiry) < 0 ? "expired" : "expiring"}: ${c.name}`, detail: `${c.reg} · ${fmtDate(c.expiry)}`, tab: "meters" }));
    // Key dates coming up.
    keyDates.filter((k) => k.locationId === selectedLocationId && !k.done && k.date && daysUntil(k.date) <= (Number(k.notifyDays) || 60)).forEach((k) => { const n = daysUntil(k.date); extra.push({ key: `kd-${k.id}-${k.date}`, tone: n < 0 ? "danger" : n <= 30 ? "warn" : "info", title: `${k.type}: ${k.title}`, detail: `${fmtDate(k.date)} — ${n < 0 ? `${-n} days ago` : n === 0 ? "today" : `in ${n} days`}`, tab: "meters" }); });
    // Purchase orders waiting for approval.
    locPOs.filter((p) => p.status === "awaiting").forEach((p) => extra.push({ key: `poa-${p.id}`, tone: "warn", title: `PO waiting for approval: ${p.number}`, detail: `${gbp(p.value)} — ${String(p.description || "").slice(0, 50)}`, tab: "budget" }));
    // Supplier updates from their job link.
    locWorks.filter((w) => w.supplierDone && w.status !== "completed").forEach((w) => extra.push({ key: `sdn-${w.id}`, tone: "info", title: `Supplier says done: ${String(w.description).slice(0, 50)}`, detail: `${w.supplierDone.name} · ${fmtDate(w.supplierDone.at.slice(0, 10))} — check and sign it off`, tab: "works" }));
    locWorks.filter((w) => w.supplierAck?.declined && !["completed", "rejected"].includes(w.status)).forEach((w) => extra.push({ key: `sdc-${w.id}`, tone: "warn", title: `Supplier declined: ${String(w.description).slice(0, 50)}`, detail: w.supplierAck.reason || "No reason given", tab: "works" }));
    // Engineer reports waiting for review.
    { const subs = visitSubmissions.filter((x) => x.locationId === selectedLocationId); if (subs.length) extra.push({ key: `vsub-${subs.length}-${subs[0].id}`, tone: "info", title: `${subs.length} engineer report${subs.length === 1 ? "" : "s"} to review`, detail: subs.slice(0, 3).map((x) => `${x.name} — ${fmtDate(x.date)}`).join(", "), tab: "home" }); }
    // New requests nobody has looked at for more than a day.
    locWorks.filter((w) => w.status === "requested" && w.loggedAt && (Date.now() - new Date(w.loggedAt).getTime()) > 86400000 && !(w.comments || []).length).forEach((w) => {
      extra.push({ key: `rqa-${w.id}`, tone: "warn", title: `Request not acknowledged: ${String(w.description).slice(0, 50)}`, detail: `From ${w.requestedBy || "the QR page"} · ${fmtDate(w.dateRaised)} — review it or add a comment`, tab: "works" });
    });
    // Quotes asked for but not received after 7 days.
    locWorks.filter((w) => w.quoteRequestedAt && !Number(w.quoteAmount) && !["completed", "rejected"].includes(w.status) && -daysUntil(w.quoteRequestedAt) >= 7).forEach((w) => {
      extra.push({ key: `qrc-${w.id}`, tone: "info", title: `Chase quote: ${String(w.description).slice(0, 50)}`, detail: `Requested ${fmtDate(w.quoteRequestedAt)} — no quote yet`, tab: "works" });
    });
    // COSHH assessments due for review, equipment inspections due.
    coshh.filter((c) => c.locationId === selectedLocationId && c.reviewDate && daysUntil(c.reviewDate) <= 14).forEach((c) => extra.push({ key: `coshh-${c.id}-${c.reviewDate}`, tone: daysUntil(c.reviewDate) < 0 ? "warn" : "info", title: `COSHH review ${daysUntil(c.reviewDate) < 0 ? "overdue" : "due"}: ${c.product}`, detail: fmtDate(c.reviewDate), tab: "meters" }));
    equipment.filter((q) => q.locationId === selectedLocationId && q.status !== "withdrawn" && (q.status === "failed" || (q.nextDue && daysUntil(q.nextDue) <= 7))).forEach((q) => extra.push({ key: `eq-${q.id}-${q.nextDue}-${q.status}`, tone: q.status === "failed" || daysUntil(q.nextDue) < 0 ? "danger" : "info", title: q.status === "failed" ? `Failed equipment still listed: ${q.name}` : `Inspection ${daysUntil(q.nextDue) < 0 ? "overdue" : "due"}: ${q.name}`, detail: `${EQUIPMENT_TYPES[q.type]?.label || ""}${q.nextDue ? ` · ${fmtDate(q.nextDue)}` : ""}`, tab: "meters" }));
    // Training courses booked this week.
    locTraining.filter((t) => t.bookedFor && daysUntil(t.bookedFor) >= 0 && daysUntil(t.bookedFor) <= 7).forEach((t) => extra.push({ key: `trb-${t.id}-${t.bookedFor}`, tone: "info", title: `${t.person}: ${t.course} on ${fmtDate(t.bookedFor)}`, detail: "Course booked", tab: "meters" }));
    // Actions from risk assessments / audits.
    actions.filter((a) => a.locationId === selectedLocationId && a.status !== "done" && a.due).forEach((a) => {
      const n = daysUntil(a.due);
      if (n < 0) extra.push({ key: `act-${a.id}-${a.due}`, tone: a.priority === "high" ? "danger" : "warn", title: `Action overdue: ${String(a.action || a.finding).slice(0, 60)}`, detail: `${a.source}${a.owner ? ` · ${a.owner}` : ""} · was due ${fmtDate(a.due)}`, tab: "meters" });
      else if (n <= 7) extra.push({ key: `acts-${a.id}-${a.due}`, tone: "info", title: `Action due soon: ${String(a.action || a.finding).slice(0, 60)}`, detail: `${a.source} · ${fmtDate(a.due)}`, tab: "meters" });
    });
    // Certificates the supplier still owes.
    locServices.filter((v) => v.certToFollow && !v.certificatePhoto && !v.certUrl && -daysUntil(v.date) >= 14).forEach((v) => {
      const dv = locDevices.find((d) => d.id === v.deviceId); const sp = suppliers.find((x) => x.id === (v.supplierId || dv?.supplierId));
      extra.push({ key: `cert-${v.id}`, tone: "warn", title: `Certificate still awaited: ${dv?.name || "service"}`, detail: `Visit on ${fmtDate(v.date)} — chase ${sp?.name || "the supplier"}`, tab: "certificates" });
    });
    // Usage-based servicing (run hours).
    locDevices.filter((d) => Number(d.usageInterval) > 0 && (d.usageReadings || []).length).forEach((d) => {
      const latest = Number(d.usageReadings[0].hours); const since = latest - (Number(d.usageAtLastService) || 0);
      if (since >= Number(d.usageInterval)) extra.push({ key: `use-${d.id}-${latest}`, tone: "warn", title: `${d.name} due on run hours`, detail: `${Math.round(since)} h since last service (every ${d.usageInterval} h)`, tab: "devices" });
      else if (since >= Number(d.usageInterval) * 0.9) extra.push({ key: `uses-${d.id}-${latest}`, tone: "info", title: `${d.name} nearly due on run hours`, detail: `${Math.round(since)} of ${d.usageInterval} h`, tab: "devices" });
    });
    // Frost forecast (from the weather tile's cached forecast).
    try {
      const wd = cachedWeather(siteWeatherSource(locations.find((l) => l.id === selectedLocationId), (settings.siteInfo || {})[selectedLocationId], countries.find((c) => c.id === selectedCountryId)?.name));
      if (wd?.days?.some((d) => d.min <= 1)) extra.push({ key: `frost-${new Date().toISOString().slice(0, 10)}`, tone: "info", title: "Frost forecast — plan gritting", detail: `Low of ${Math.min(...wd.days.map((d) => d.min))}°C in the next two days${wd.name ? ` (${wd.name})` : ""}`, tab: "home" });
    } catch (e) { /* no forecast cached */ }
    // Audits that should happen regularly (frequency set per audit type).
    (settings.auditTemplates || []).filter((t) => Number(t.everyDays) > 0).forEach((t) => {
      const last = locAudits.filter((a) => a.templateId === t.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const age = last ? -daysUntil(last.date) : null;
      if (!last || age > Number(t.everyDays)) extra.push({ key: `aud-${t.id}-${last?.date || "none"}`, tone: "info", title: `${t.name} due`, detail: last ? `Last done ${fmtDate(last.date)}` : "Not done yet", tab: "meters" });
    });
    // Next fire drill planned.
    { const nd = (settings.nextDrill || {})[selectedLocationId]; if (nd) { const n = daysUntil(nd); if (n !== null && n <= 7) extra.push({ key: `ndr-${nd}`, tone: n < 0 ? "warn" : "info", title: n < 0 ? "Planned fire drill not recorded" : `Fire drill planned ${n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`}`, detail: `${fmtDate(nd)} — record it under Site → Fire drills`, tab: "meters" }); } }
    // Required training missing.
    { const req = (settings.requiredCourses || {})[selectedLocationId] || []; const people = [...new Set(locTraining.map((t) => t.person))];
      const gaps = people.filter((p) => req.some((c) => !locTraining.some((t) => t.person === p && t.course === c && (!t.expiry || daysUntil(t.expiry) >= 0))));
      if (req.length && gaps.length) extra.push({ key: `reqtr-${gaps.length}-${req.length}`, tone: "info", title: `${gaps.length} ${gaps.length === 1 ? "person is" : "people are"} missing required training`, detail: gaps.slice(0, 4).join(", "), tab: "meters" }); }
    // Asbestos register: re-inspections due and high-risk items.
    asbestos.filter((a) => a.locationId === selectedLocationId).forEach((a) => {
      const n = a.nextInspection ? daysUntil(a.nextInspection) : null;
      if (n !== null && n < 0) extra.push({ key: `asb-${a.id}-${a.nextInspection}`, tone: "warn", title: `Asbestos re-inspection overdue: ${a.location}`, detail: `${a.material} · was due ${fmtDate(a.nextInspection)}`, tab: "meters" });
      else if (n !== null && n <= 30) extra.push({ key: `asbs-${a.id}-${a.nextInspection}`, tone: "info", title: `Asbestos re-inspection due: ${a.location}`, detail: `${a.material} · ${fmtDate(a.nextInspection)}`, tab: "meters" });
      if (a.risk === "high" && a.action !== "Removed") extra.push({ key: `asbh-${a.id}`, tone: "danger", title: `High-risk asbestos: ${a.location}`, detail: `${a.material} — action: ${a.action || "decide"}`, tab: "meters" });
    });
    // Waste carrier registrations.
    locSuppliers.forEach((s) => {
      if (!s.wasteLicenceExpiry) return; const n = daysUntil(s.wasteLicenceExpiry);
      if (n < 0) extra.push({ key: `wl-${s.id}`, tone: "danger", title: `${s.name}: waste carrier registration expired`, detail: `${s.wasteLicence || ""} · ${fmtDate(s.wasteLicenceExpiry)} — don't hand over waste until renewed`, tab: "suppliers" });
      else if (n <= 30) extra.push({ key: `wls-${s.id}`, tone: "warn", title: `${s.name}: waste carrier registration expiring`, detail: `${fmtDate(s.wasteLicenceExpiry)}`, tab: "suppliers" });
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
  }, [alerts, locMeters, locReadings, locSpares, locKeys, locReminders, locSuppliers, locIncidents, locProjects, faultsByDevice, locDevices, locServices, locPermits, locInvoices, locPOs, locOutlets, locWaterReadings, locTraining, locDrills, settings.siteDocs, settings.logDefs, logEntries, asbestos, settings.auditTemplates, settings.nextDrill, settings.requiredCourses, locAudits, actions, spaces, weatherTick, locations, coshh, equipment, visitSubmissions, keyDates, locPOs, locInvoices, locWaste, carPark, shutdowns, locOutlets, isolations]);
  const hiddenGroups = display.hiddenAlertGroups || [];
  const visibleAlerts = useMemo(() => allAlerts.filter((a) => !(snoozed[a.key] && snoozed[a.key] >= todayISO)).filter((a) => a.tone === "danger" || !hiddenGroups.includes(alertGroup(a.key))), [allAlerts, snoozed, todayISO, hiddenGroups.join(",")]);
  const snoozedCount = allAlerts.length - visibleAlerts.length;
  // Remember the last services opened on this device (for "Recently opened" on Home).
  useEffect(() => {
    const base = "PPM Service Book"; const n = (visibleAlerts || []).filter((a) => a.tone === "danger").length;
    try { document.title = n ? `(${n}) ${base}` : base; } catch (e) { /* ignore */ }
  }, [visibleAlerts]);
  useEffect(() => { if (!historyFor) return; setRecentIds((prev) => { const next = [historyFor, ...prev.filter((x) => x !== historyFor)].slice(0, 8); try { localStorage.setItem("ppm:recentServices", JSON.stringify(next)); } catch (e) { /* ignore */ } return next; }); }, [historyFor]);
  function snoozeMany(keys, days) {
    const next = { ...Object.fromEntries(Object.entries(snoozed).filter(([, until]) => until >= todayISO)) };
    keys.forEach((k) => { next[k] = addDays(todayISO, days); });
    setSnoozed(next); savePersonal(PKEYS.snooze, next);
    showToast(`${keys.length} alert${keys.length === 1 ? "" : "s"} snoozed until ${days === 1 ? "tomorrow" : fmtDate(addDays(todayISO, days))}`, "Urgent (red) alerts still show");
  }
  const shutdownOps = makeRecordOps("shutdowns", shutdowns, "Planned shutdown", (r) => `${r.type} ${String(r.start).slice(0, 10)}`);
  function snoozeReminder(id, days) { persist.reminders(reminders.map((r) => r.id === id ? { ...r, due: addDays(todayISO, days) } : r)); showToast(days === 1 ? "Moved to tomorrow" : "Moved to next week"); }
  function addHandover(text) { const all = settings.handover || []; persist.settings({ ...settings, handover: [{ id: uid(), locationId: selectedLocationId, text, by: currentUser?.name, at: new Date().toISOString() }, ...all].slice(0, 200) }); }
  function printTodaySheet() {
    const e = escapeHtml; const t = todayISO;
    const visits = locDevices.filter((d) => !d.archived && ((d.booking?.date === t) || d.nextServiceDate === t || (d.nextServiceDate && d.nextServiceDate < t && !d.booking)));
    const jobs = locWorks.filter((w) => !["completed", "rejected", "on_hold"].includes(w.status) && (!w.supplierId || w.priority === "high"));
    const rem = reminders.filter((r) => r.locationId === selectedLocationId && !r.done && r.due && r.due <= t);
    const sd = shutdowns.filter((s) => s.locationId === selectedLocationId && String(s.start).slice(0, 10) <= t && String(s.end || s.start).slice(0, 10) >= t);
    openPrintReport(`Today's sheet — ${fmtDate(t)}`, locationLabel({ locationId: selectedLocationId }), `${sd.length ? `<div style="border:2px solid #D97706;border-radius:8px;padding:8px;margin-bottom:10px"><b>Shutdown today:</b> ${sd.map((s) => e(`${s.type}${s.areas ? ` (${s.areas})` : ""}`)).join(", ")}</div>` : ""}
      <h2>Visits due or booked (${visits.length})</h2>${tableHtml(["", "Service", "Area", "Supplier", "Time / status", "Access"], visits.map((d) => ["☐", `<b>${e(d.name)}</b>`, e(d.area || ""), e(supplierById[d.supplierId]?.name || ""), d.booking?.date === t ? e(d.booking.time || "booked") : d.nextServiceDate < t ? '<span class="bad">overdue</span>' : "due today", e(d.accessNotes || "")]))}
      <h2>Jobs to do (${jobs.length})</h2><div class="muted">In-house (no supplier) and high-priority open jobs</div>${tableHtml(["", "Job", "Service", "Priority", "Raised", "Notes"], jobs.map((w) => ["☐", `<b>${e(w.description)}</b>`, e(deviceById[w.deviceId]?.name || ""), e(w.priority || "medium"), fmtDate(w.dateRaised), ""]))}
      ${rem.length ? `<h2>Reminders</h2>${tableHtml(["", "Reminder", "Due"], rem.map((r) => ["☐", e(r.text), fmtDate(r.due)]))}` : ""}
      <div style="margin-top:16px">Completed by ____________________ &nbsp; Handed back ________</div>`);
  }
  function reassignActions(from, to) {
    const n = actions.filter((a) => a.locationId === selectedLocationId && a.status !== "done" && a.owner === from).length;
    persist.actions(actions.map((a) => a.locationId === selectedLocationId && a.status !== "done" && a.owner === from ? { ...a, owner: to } : a));
    logActivity(`Reassigned ${n} actions from ${from} to ${to}`); showToast(`${n} action${n === 1 ? "" : "s"} moved to ${to}`);
  }
  function addExpected(v) { const all = settings.expectedVisitors || []; persist.settings({ ...settings, expectedVisitors: [...all.filter((x) => x.date >= addDays(todayISO, -1)), { ...v, id: uid(), locationId: selectedLocationId, addedBy: currentUser?.name }] }); showToast("Visitor expected", `${v.name} · ${fmtDate(v.date)}`); }
  function removeExpected(id) { persist.settings({ ...settings, expectedVisitors: (settings.expectedVisitors || []).filter((x) => x.id !== id) }); }
  function arriveExpected(v) { signIn({ name: v.name, company: v.company || "", kind: v.kind || "visitor", host: v.host || undefined, purpose: v.purpose || "", inductionGiven: v.kind === "contractor" ? false : undefined }); removeExpected(v.id); }
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
  const UNDO_KEYS = ["devices", "services", "works", "suppliers", "budgetLines", "deviceTasks", "visitBudgets", "spares", "keys", "reminders", "audits", "incidents", "projects", "permits", "waste", "purchaseOrders", "invoices", "waterOutlets", "waterReadings", "training", "drills", "signins", "trash", "notices", "logEntries", "savings", "asbestos", "actions", "spaces", "walkrounds", "coshh", "equipment", "visitSubmissions", "feedback", "floorplans", "keyDates", "carPark", "isolations", "costLines", "shutdowns"]; // archive also uses undo
  const currentCollections = { devices, services, works, suppliers, budgetLines, deviceTasks, visitBudgets, spares, keys: keysList, reminders, audits, incidents, projects, permits, waste, purchaseOrders, invoices, waterOutlets, waterReadings, training, drills, signins, trash, notices, logEntries, savings, asbestos, actions, spaces, walkrounds, coshh, equipment, visitSubmissions, feedback, floorplans, keyDates, carPark, isolations, costLines, shutdowns };
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
  const allData = { users, countries, locations, devices, services, works, suppliers, budgets, budgetLines, deviceTasks, visitBudgets, settings, activity, meters, meterReadings, signins, spares, keys: keysList, reminders, audits, incidents, projects, permits, waste, purchaseOrders, invoices, waterOutlets, waterReadings, training, drills, trash, notices, logEntries, savings, asbestos, actions, spaces, walkrounds, coshh, equipment, visitSubmissions, feedback, floorplans, keyDates, carPark, isolations, costLines, shutdowns };
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
    ["meters", "meterReadings", "signins", "spares", "keys", "reminders", "audits", "incidents", "projects", "permits", "waste", "purchaseOrders", "invoices", "waterOutlets", "waterReadings", "training", "drills", "trash", "notices", "logEntries", "savings", "asbestos", "actions", "spaces", "walkrounds", "coshh", "equipment", "visitSubmissions", "feedback", "floorplans", "keyDates", "carPark", "isolations", "costLines", "shutdowns"].forEach((k) => { if (Array.isArray(d[k])) persist[k](d[k]); });
    showToast("Backup restored", payload.exportedAt ? `from ${fmtDate(payload.exportedAt.slice(0, 10))}` : "");
    return null;
  }
  const noticeOps = makeRecordOps("notices", notices, "Notice", (r) => String(r.text).slice(0, 60));
  const savingOps = makeRecordOps("savings", savings, "Saving", (r) => `${r.description} ${gbp(r.amount)}`);
  const logEntryOps = makeRecordOps("logEntries", logEntries, "Log entry", (r) => `${(settings.logDefs || []).find((d) => d.id === r.logId)?.name || "Log"} ${fmtDate(r.date)}`);
  function saveLogDefs(list) { persist.settings({ ...settings, logDefs: list }); }
  function importSuppliers(rows) {
    persist.suppliers([...suppliers, ...rows.map((r) => ({ ...r, id: uid(), locationId: selectedLocationId }))]);
    showToast(`${rows.length} suppliers imported`);
  }
  function markKeyLost(id, note) {
    const k = keysList.find((x) => x.id === id); if (!k) return;
    persist.keys(keysList.map((x) => x.id === id ? { ...x, lost: true, lostAt: new Date().toISOString(), lostNote: note, log: [{ at: new Date().toISOString(), by: currentUser?.name, action: "lost", holder: x.holder, holderCompany: x.holderCompany }, ...(x.log || [])] } : x));
    addReminder({ text: `Lost key "${k.label}" — decide if locks need changing (${k.opens || "check what it opens"})`, due: new Date().toISOString().slice(0, 10), assignee: null, repeat: "none" });
    showToast("Key marked lost — reminder added", k.label);
  }
  function extendPermit(id, until, reason) {
    const pm = permits.find((x) => x.id === id);
    persist.permits(permits.map((x) => x.id === id ? { ...x, validTo: until, extensions: [...(x.extensions || []), { from: x.validTo, to: until, reason, by: currentUser?.name, at: new Date().toISOString() }] } : x));
    showToast("Permit extended", `${pm?.ref} until ${new Date(until).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
  }
  function stockTake(counts) {
    const at = new Date().toISOString(); let changed = 0;
    persist.spares(spares.map((sp) => { if (counts[sp.id] === undefined || counts[sp.id] === "" || Number(counts[sp.id]) === Number(sp.qty)) return sp; changed++; const delta = Number(counts[sp.id]) - Number(sp.qty); return { ...sp, qty: Number(counts[sp.id]), lastCounted: at, log: [{ at, by: currentUser?.name, delta, note: "Stock take" }, ...(sp.log || [])].slice(0, 200) }; }));
    showToast("Stock take saved", `${changed} item${changed === 1 ? "" : "s"} adjusted`);
  }
  const asbestosOps = makeRecordOps("asbestos", asbestos, "Asbestos item", (r) => `${r.location} — ${r.material}`);
  function logWorkChase(ids, supplierName) {
    const at = new Date().toISOString(); const set = new Set(ids);
    persist.works(works.map((w) => set.has(w.id) ? { ...w, comments: [...(w.comments || []), { text: `Chased ${supplierName || "supplier"} by email (overdue)`, by: currentUser?.name || "Unknown", at }] } : w));
  }
  const actionOps = makeRecordOps("actions", actions, "Action", (r) => String(r.action || r.finding).slice(0, 60));
  const spaceOps = makeRecordOps("spaces", spaces, "Space", (r) => r.name);
  const walkOps = makeRecordOps("walkrounds", walkrounds, "Walk-round", (r) => r.title);
  const [actionDraft, setActionDraft] = useState(null);
  const pendingUsage = useRef(null);
  useEffect(() => {
    const p = pendingUsage.current; if (!p) return; pendingUsage.current = null;
    persist.devices(devices.map((d) => d.id === p.id ? { ...d, usageAtLastService: p.hours, usageReadings: [{ date: p.date, hours: p.hours, by: currentUser?.name, atService: true }, ...(d.usageReadings || [])].slice(0, 200) } : d));
  }, [devices]);
  const coshhOps = makeRecordOps("coshh", coshh, "Substance", (r) => r.product);
  const equipOps = makeRecordOps("equipment", equipment, "Equipment", (r) => r.name);
  function acceptSubmission(sub) {
    const dev = deviceById[sub.deviceId];
    if (!dev) { persist.visitSubmissions(visitSubmissions.filter((x) => x.id !== sub.id)); return; }
    saveService({ deviceId: sub.deviceId, date: sub.date, name: dev.name, cost: 0, technician: [sub.name, sub.company].filter(Boolean).join(", "), supplierId: dev.supplierId || null,
      notes: `${sub.notes || ""}${sub.notes ? "\n" : ""}(Engineer report sent from the QR code by ${sub.name}${sub.company ? `, ${sub.company}` : ""})`, checklistResults: (sub.checks || []).map((c) => ({ item: c.item, result: c.result, note: "", value: c.value || "" })),
      photos: sub.photos?.length ? sub.photos : undefined, arrived: sub.arrived || undefined, left: sub.left || undefined, fromEngineer: true });
    persist.visitSubmissions(visitSubmissions.filter((x) => x.id !== sub.id));
    showToast("Visit logged from engineer report", dev.name);
  }
  function rejectSubmission(sub, why) {
    persist.visitSubmissions(visitSubmissions.filter((x) => x.id !== sub.id));
    logActivity(`Rejected engineer report for ${deviceById[sub.deviceId]?.name || "service"}${why ? ` — ${why}` : ""}`);
    showToast("Engineer report rejected");
  }
  const planOps = makeRecordOps("floorplans", floorplans, "Floor plan", (r) => r.name);
  const keyDateOps = makeRecordOps("keyDates", keyDates, "Key date", (r) => `${r.title} ${fmtDate(r.date)}`);
  function supplierPortal(sup, how) {
    let token = sup.portalToken;
    if (!token || how === "new") { token = Array.from(crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(12)) : Array.from({ length: 12 }, () => Math.floor(Math.random() * 256))).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20); persist.suppliers(suppliers.map((s) => s.id === sup.id ? { ...s, portalToken: token } : s)); }
    const url = `${appBaseUrl()}?supplier=${token}`;
    if (how === "email") {
      const body = `Hi${sup.managerName ? ` ${sup.managerName.split(" ")[0]}` : ""},\n\nHere is your own link to the jobs we've raised with you at ${locationLabel({ locationId: selectedLocationId })}:\n\n${url}\n\nOn it you can accept jobs, give an expected completion date, record when your engineer is on site, and mark jobs complete with notes, photos and a signature. Please keep the link private to your team.\n\nThanks`;
      window.location.href = `mailto:${encodeURIComponent(sup.managerEmail || "")}?subject=${encodeURIComponent(`Your job link — ${locationLabel({ locationId: selectedLocationId })}`)}&body=${encodeURIComponent(body)}`;
    } else { try { navigator.clipboard?.writeText(url); } catch (e) { /* ignore */ } showToast(how === "new" ? "New link created — the old one no longer works" : "Supplier job link copied", url); }
  }
  const carOps = makeRecordOps("carPark", carPark, "Vehicle", (r) => `${r.reg} ${r.name}`);
  const isoOps = makeRecordOps("isolations", isolations, "Isolation point", (r) => `${r.kind} — ${r.location}`);
  function useSpareOnWork(workId, spareId, qty) {
    const sp = spares.find((x) => x.id === spareId); const w = works.find((x) => x.id === workId); if (!sp || !w) return;
    const at = new Date().toISOString(); const n = Number(qty) || 1;
    persist.spares(spares.map((x) => x.id === spareId ? { ...x, qty: Math.max(0, (Number(x.qty) || 0) - n), log: [{ at, by: currentUser?.name, delta: -n, note: `Used on job: ${String(w.description).slice(0, 40)}` }, ...(x.log || [])].slice(0, 200) } : x));
    persist.works(works.map((x) => x.id === workId ? { ...x, partsUsed: [...(x.partsUsed || []), { spareId, name: sp.name, qty: n, unitCost: Number(sp.unitCost) || 0, at }], comments: [...(x.comments || []), { text: `Used ${n} × ${sp.name} from stock`, by: currentUser?.name || "Unknown", at }] } : x));
    showToast(`${n} × ${sp.name} taken from stock`);
  }
  function printEmergencySheet() {
    const site = locations.find((l) => l.id === selectedLocationId); const today = new Date().toISOString().slice(0, 10);
    const onCall = (((settings.onCall || {})[selectedLocationId]) || []).find((r) => r.from <= today && (!r.to || r.to >= today));
    const valid = (t) => !t.expiry || daysUntil(t.expiry) >= 0;
    openPrintReport("Emergency information", locationLabel({ locationId: selectedLocationId }), buildEmergencySheet({ site, siteInfo: (settings.siteInfo || {})[selectedLocationId] || {}, onCall,
      isolations: isolations.filter((i) => i.locationId === selectedLocationId), contacts: ((settings.emergencyContacts || {})[selectedLocationId] || []).filter((c) => c.phone),
      keyHolders: locKeys.filter((k) => k.holder), suppliers: locSuppliers.filter((s) => s.oohPhone),
      firstAiders: [...new Set(locTraining.filter((t) => /first aid/i.test(t.course) && valid(t)).map((t) => t.person))], marshals: [...new Set(locTraining.filter((t) => /marshal|warden/i.test(t.course) && valid(t)).map((t) => t.person))] }));
  }
  function exportCalendar() {
    const t0 = new Date().toISOString().slice(0, 10); const t1 = addDays(t0, 365); const loc = locationLabel({ locationId: selectedLocationId });
    const esc = (t) => String(t || "").replace(/[,;\\]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    const day = (d) => d.replace(/-/g, ""); const next = (d) => day(addDays(d, 1));
    const ev = [];
    locDevices.forEach((d) => { const b = currentBooking(d); const date = b?.date || d.nextServiceDate; if (!date || date < t0 || date > t1) return;
      if (b?.time) { const [h, m] = b.time.split(":").map(Number); const end = `${String(Math.min(23, h + 2)).padStart(2, "0")}${String(m).padStart(2, "0")}00`; ev.push([`svc-${d.id}-${date}`, `DTSTART:${day(date)}T${b.time.replace(":", "")}00`, `DTEND:${day(date)}T${end}`, `${d.name} — ${supplierById[d.supplierId]?.name || "visit"} (booked)`]); }
      else ev.push([`svc-${d.id}-${date}`, `DTSTART;VALUE=DATE:${day(date)}`, `DTEND;VALUE=DATE:${next(date)}`, `${d.name} due${b ? " (booked)" : ""}`]); });
    keyDates.filter((k) => k.locationId === selectedLocationId && !k.done && k.date >= t0 && k.date <= t1).forEach((k) => ev.push([`kd-${k.id}`, `DTSTART;VALUE=DATE:${day(k.date)}`, `DTEND;VALUE=DATE:${next(k.date)}`, `${k.type}: ${k.title}`]));
    locSuppliers.filter((s) => s.contractEnd && s.contractEnd >= t0 && s.contractEnd <= t1).forEach((s) => ev.push([`ce-${s.id}`, `DTSTART;VALUE=DATE:${day(s.contractEnd)}`, `DTEND;VALUE=DATE:${next(s.contractEnd)}`, `Contract ends: ${s.name}`]));
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PPM Service Book//EN", `X-WR-CALNAME:PPM — ${esc(loc)}`, ...ev.flatMap(([uidv, s, e2, sum]) => ["BEGIN:VEVENT", `UID:${uidv}@ppm`, `DTSTAMP:${stamp}`, s, e2, `SUMMARY:${esc(sum)}`, `LOCATION:${esc(loc)}`, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
    downloadBlob(new Blob([ics], { type: "text/calendar" }), `ppm-calendar-${loc.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`);
    showToast(`${ev.length} events exported`, "Open the file to add them to Outlook, Google or Apple Calendar");
  }
  function saveUserSites(userId, sitesList) { persist.users(users.map((u) => u.id === userId ? { ...u, sites: sitesList } : u)); }
  function saveCostCodes(list) { persist.settings({ ...settings, costCodes: list }); }
  function saveRecyclingTarget(v) { persist.settings({ ...settings, recyclingTarget: { ...(settings.recyclingTarget || {}), [selectedLocationId]: v === "" ? null : Number(v) } }); }
  function savePoLimit(v) { persist.settings({ ...settings, poApprovalLimit: v === "" ? null : Number(v) }); }
  function duplicateWork(w) { setWorkPrefill({ description: w.description, priority: w.priority, category: w.category }); setAddWorkFor(w.deviceId); }
  function invoiceFromWork(w) {
    const number = window.prompt(`Invoice number for "${String(w.description).slice(0, 40)}" (${gbp(w.finalCost ?? w.quoteAmount)}):`, ""); if (number === null) return;
    invOps.save({ number: number.trim() || `Job ${w.id.slice(-6).toUpperCase()}`, supplierId: w.supplierId || null, amount: Number(w.finalCost ?? w.quoteAmount) || 0, vatRate: 20, workId: w.id, date: new Date().toISOString().slice(0, 10), status: "received", poNumber: w.poNumber || undefined });
    showToast("Invoice recorded", "See Budget → POs & invoices to approve it");
  }
  function poFromWork(w) {
    const nums = purchaseOrders.map((p) => Number(String(p.number).match(/(\d+)\s*$/)?.[1])).filter((n) => !isNaN(n));
    const number = `PO-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
    poOps.save({ number, supplierId: w.supplierId || null, description: `${deviceById[w.deviceId]?.name || ""}: ${w.description}`, value: Number(w.quoteAmount) || 0, date: new Date().toISOString().slice(0, 10), status: settings.poApprovalLimit != null && Number(w.quoteAmount) > settings.poApprovalLimit ? "awaiting" : "open" });
    updateWork(w.id, { poNumber: number });
    showToast(`${number} raised`, settings.poApprovalLimit != null && Number(w.quoteAmount) > settings.poApprovalLimit ? "Over the approval limit — waiting for approval" : "Linked to the job");
  }
  function importWorks(rows) {
    const at = new Date().toISOString();
    persist.works([...rows.map((r) => ({ ...r, id: uid(), photos: [], comments: [], budgetType: "budgeted", loggedBy: currentUser?.name, loggedAt: at, source: "import" })), ...works]);
    logActivity(`Imported ${rows.length} jobs`); showToast(`${rows.length} jobs imported`);
  }
  function bulkInvoices(ids, status) {
    const set = new Set(ids); const at = new Date().toISOString();
    persist.invoices(invoices.map((i) => set.has(i.id) ? { ...i, status, ...(status === "approved" ? { approvedBy: currentUser?.name, approvedAt: at } : { paidAt: at }) } : i));
    showToast(`${ids.length} invoice${ids.length === 1 ? "" : "s"} marked ${status}`);
  }
  function copySite(fromId, { incSuppliers, incChecklists }) {
    const supMap = {};
    let newSups = [];
    if (incSuppliers) newSups = suppliers.filter((s) => s.locationId === fromId).map((s) => { const id = uid(); supMap[s.id] = id; return { ...s, id, locationId: selectedLocationId, contactLog: [], renewal: {}, onboarding: s.onboarding || {} }; });
    const newDevs = devices.filter((d) => d.locationId === fromId && !d.archived).map((d) => ({ id: uid(), locationId: selectedLocationId, name: d.name, serviceCategory: d.serviceCategory, subCategory: d.subCategory, equipmentType: d.equipmentType, serviceIntervalMonths: d.serviceIntervalMonths, budgetPerVisit: d.budgetPerVisit, checklist: incChecklists ? (d.checklist || []) : [], supplierId: incSuppliers ? (supMap[d.supplierId] || null) : null, criticality: d.criticality, tags: d.tags, certRequired: d.certRequired, ramsRequired: d.ramsRequired, permits: d.permits, instructions: d.instructions, usageInterval: d.usageInterval, lastServiceDate: null, nextServiceDate: null, notesLog: [], copiedFrom: d.id }));
    if (newSups.length) persist.suppliers([...suppliers, ...newSups]);
    persist.devices([...devices, ...newDevs]); queuePlanCheck(newDevs.map((d) => d.id));
    setShowCopySite(false); setTab("devices");
    showToast(`${newDevs.length} services copied${newSups.length ? ` and ${newSups.length} suppliers` : ""}`, "Set the first due dates (bulk select → Reschedule)");
  }
  function bookMany(ids, booking) {
    const set = new Set(ids); const at = new Date().toISOString();
    persist.devices(devices.map((d) => set.has(d.id) ? { ...d, booking: { ...booking, forDue: d.nextServiceDate, by: currentUser?.name, at } } : d));
    { let lines = budgetLines, changed = false; ids.forEach((id) => { const d = deviceById[id]; const nl = d && linesAfterBooking(lines, id, d.nextServiceDate, booking.date); if (nl) { lines = nl; changed = true; } }); if (changed) persist.budgetLines(lines); }
    showToast(`${ids.length} visits booked for ${fmtDate(booking.date)}${booking.time ? ` ${booking.time}` : ""}`);
  }
  function mergeDevices(fromId, toId) {
    const from = deviceById[fromId]; const to = deviceById[toId]; if (!from || !to) return;
    toTrash({ type: "service", name: `${from.name} (merged into ${to.name})`, payload: { device: from, services: [], works: [], tasks: [], visitBudgets: [] } });
    persist.services(services.map((v) => v.deviceId === fromId ? { ...v, deviceId: toId } : v));
    persist.works(works.map((w) => w.deviceId === fromId ? { ...w, deviceId: toId } : w));
    persist.deviceTasks(deviceTasks.map((t) => t.deviceId === fromId ? { ...t, deviceId: toId } : t));
    persist.visitBudgets(visitBudgets.filter((v) => v.deviceId !== fromId));
    persist.budgetLines(budgetLines.map((l) => l.deviceId === fromId ? { ...l, deviceId: toId } : l));
    persist.devices(devices.filter((d) => d.id !== fromId).map((d) => d.id === toId ? { ...d, notesLog: [...(d.notesLog || []), ...(from.notesLog || [])], lastServiceDate: [d.lastServiceDate, from.lastServiceDate].filter(Boolean).sort().pop() || null } : d));
    setMergeFor(null); setHistoryFor(toId);
    showToast("Services merged", `${from.name} → ${to.name}`);
  }
  function raiseSparesPO(list) {
    const nums = purchaseOrders.map((p) => Number(String(p.number).replace(/\D/g, ""))).filter(Boolean);
    const number = `PO-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
    const value = list.reduce((t, sp) => t + (Number(sp.unitCost) || 0) * (Number(sp.reorderQty) || 1), 0);
    const sup = list.find((sp) => sp.supplierId)?.supplierId || null;
    persist.purchaseOrders([{ id: uid(), locationId: selectedLocationId, number, supplierId: sup, description: `Spares reorder: ${list.map((sp) => `${sp.reorderQty || 1} × ${sp.name}${sp.partNo ? ` (${sp.partNo})` : ""}`).join("; ")}`, value, date: new Date().toISOString().slice(0, 10), status: "open", costCode: "", by: currentUser?.name, at: new Date().toISOString() }, ...purchaseOrders]);
    showToast(`Purchase order ${number} raised`, `${list.length} item${list.length === 1 ? "" : "s"} · ${gbp(value)} — see Budget → POs & invoices`);
  }
  function saveOnCall(list) { persist.settings({ ...settings, onCall: { ...(settings.onCall || {}), [selectedLocationId]: list } }); }
  function recordUsage(id, hours) {
    persist.devices(devices.map((d) => d.id === id ? { ...d, usageReadings: [{ date: new Date().toISOString().slice(0, 10), hours: Number(hours), by: currentUser?.name }, ...(d.usageReadings || [])].slice(0, 200) } : d));
    showToast("Run hours recorded", `${deviceById[id]?.name}: ${hours} h`);
  }
  function keyAudit(results) {
    const at = new Date().toISOString(); const missing = [];
    persist.keys(keysList.map((k) => { if (!(k.id in results)) return k; const present = results[k.id]; if (!present) missing.push(k.label); return { ...k, lastAudit: at, lastAuditOk: present, log: [{ at, by: currentUser?.name, action: present ? "audited" : "missing at audit", holder: k.holder }, ...(k.log || [])].slice(0, 200) }; }));
    if (missing.length) addReminder({ text: `Key audit: missing — ${missing.join(", ")}. Find them or plan lock changes.`, due: at.slice(0, 10), assignee: null, repeat: "none" });
    showToast("Key audit saved", missing.length ? `${missing.length} missing` : "all present");
  }
  function verifyVisit(id, on) {
    persist.services(services.map((v) => v.id === id ? { ...v, verifiedBy: on ? currentUser?.name : null, verifiedAt: on ? new Date().toISOString() : null } : v));
    showToast(on ? "Visit verified" : "Verification removed");
  }
  function saveNextDrill(date) { persist.settings({ ...settings, nextDrill: { ...(settings.nextDrill || {}), [selectedLocationId]: date || null } }); }
  function saveRequiredCourses(list) { persist.settings({ ...settings, requiredCourses: { ...(settings.requiredCourses || {}), [selectedLocationId]: list } }); }
  function saveBranding(b) { persist.settings({ ...settings, branding: b }); showToast("Report branding saved"); }
  function saveJobTemplates(list) { persist.settings({ ...settings, jobTemplates: list }); }
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
      return { ...w, ...patch, ...extra, ...holdChange(w, patch.status, today) };
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
  function closePermit(id, status, closePhoto) {
    const pm = permits.find((x) => x.id === id);
    persist.permits(permits.map((x) => x.id === id ? { ...x, status, closedAt: new Date().toISOString(), closedBy: currentUser?.name, closePhoto: closePhoto || x.closePhoto } : x));
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
  function importDevices(allRows) {
    const updates = allRows.filter((r) => r._matchId); const rows = allRows.filter((r) => !r._matchId);
    let baseDevices = devices;
    if (updates.length) {
      const byId = Object.fromEntries(updates.map((u) => [u._matchId, u]));
      baseDevices = devices.map((d) => { const u = byId[d.id]; if (!u) return d; const patch = {}; Object.entries(u).forEach(([k, v]) => { if (k !== "_matchId" && v !== "" && v !== null && v !== undefined && !(typeof v === "number" && v === 0 && k === "budgetPerVisit")) patch[k] = v; }); return { ...d, ...patch }; });
      logActivity(`Updated ${updates.length} services from a spreadsheet`);
      if (!rows.length) { persist.devices(baseDevices); showToast(`${updates.length} services updated`); return; }
    }
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
    persist.devices([...baseDevices, ...newDevices]); queuePlanCheck(newDevices.map((d) => d.id));
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
    persist.devices([...devices, ...copies]); queuePlanCheck(copies.map((d) => d.id));
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
    } else if (action === "uplift") {
      const { pct, month } = value; const t0 = new Date().toISOString().slice(0, 10); const r = `${t0.slice(0, 4)}-${String(month).padStart(2, "0")}-01`; const last = r <= t0 ? r : `${Number(t0.slice(0, 4)) - 1}-${String(month).padStart(2, "0")}-01`;
      let lines = budgetLines, vbs = visitBudgets;
      const nextDevices = devices.map((d) => set.has(d.id) ? { ...d, upliftPct: pct > 0 ? pct : null, upliftMonth: pct > 0 ? month : null, lastUpliftOn: pct > 0 ? last : null } : d);
      nextDevices.filter((d) => set.has(d.id) && Number(d.budgetPerVisit) > 0).forEach((d) => { const rr = rebuildPlan(d, lines, vbs); lines = rr.lines; vbs = rr.vbs; });
      persist.devices(nextDevices); persist.budgetLines(lines); persist.visitBudgets(vbs);
      showToast(pct > 0 ? `${ids.length} services: +${pct}% every 1 ${MONTH_NAMES[month - 1]}` : `Price rise removed from ${ids.length} services`, "Planned visits after that date are budgeted at the new price");
    } else if (action === "interval") {
      let lines = budgetLines, vbs = visitBudgets, added = 0;
      const nextDevices = devices.map((d) => set.has(d.id) ? { ...d, serviceIntervalMonths: value, repeatMode: "interval" } : d);
      nextDevices.filter((d) => set.has(d.id)).forEach((d) => { const r = rebuildPlan(d, lines, vbs); lines = r.lines; vbs = r.vbs; added += r.added; });
      persist.devices(nextDevices); persist.budgetLines(lines); persist.visitBudgets(vbs);
      logActivity(`Set ${ids.length} services to every ${value} month${value === 1 ? "" : "s"}`);
      showToast(`${ids.length} services now every ${value} month${value === 1 ? "" : "s"}`, `${added} planned visits in the budget (through ${new Date().getFullYear() + 1})`);
    } else if (action === "budget") {
      let lines = budgetLines, vbs = visitBudgets, added = 0;
      const nextDevices = devices.map((d) => set.has(d.id) ? { ...d, budgetPerVisit: value } : d);
      nextDevices.filter((d) => set.has(d.id)).forEach((d) => { const r = rebuildPlan(d, lines, vbs); lines = r.lines; vbs = r.vbs; added += r.added; });
      persist.devices(nextDevices); persist.budgetLines(lines); persist.visitBudgets(vbs);
      logActivity(`Budget per visit set to ${gbp(value)} on ${ids.length} services`);
      showToast(`Budget set on ${ids.length} services`, value ? `${added} planned visits in the budget` : "Taken out of the budget");
    } else if (action === "checklist") {
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, checklist: [...(d.checklist || []), ...value.filter((x) => !(d.checklist || []).includes(x))] } : d));
      showToast(`Checklist updated on ${ids.length} services`, value.join(", ").slice(0, 120));
    } else if (action === "supplier") {
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, supplierId: value || null } : d));
      { const today = new Date().toISOString().slice(0, 10); persist.budgetLines(budgetLines.map((l) => set.has(l.deviceId) && l.date >= today && l.actualAmount == null ? { ...l, supplierId: value || null } : l)); }
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
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, pausedUntil: null, nextServiceDate: d.nextServiceDate && d.nextServiceDate > today ? today : d.nextServiceDate } : d)); queuePlanCheck(ids);
      showToast("Service resumed", names.join(", ").slice(0, 200));
    } else if (action === "area") {
      persist.devices(devices.map((d) => set.has(d.id) ? { ...d, area: value } : d));
      showToast(`Area set on ${ids.length} services`, value);
    } else if (action === "archive") {
      const today = new Date().toISOString().slice(0, 10);
      withUndo(() => {
        persist.devices(devices.map((d) => set.has(d.id) ? { ...d, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser?.name, archivedNextDue: d.nextServiceDate || d.archivedNextDue || null, nextServiceDate: null } : d));
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
  function signOutAll() {
    const now = new Date().toISOString(); const n = signins.filter((x) => x.locationId === selectedLocationId && !x.outAt).length;
    persist.signins(signins.map((x) => x.locationId === selectedLocationId && !x.outAt ? { ...x, outAt: now, outBy: currentUser?.name, autoOut: true } : x));
    showToast(`${n} contractor${n === 1 ? "" : "s"} signed out`);
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
      persist.devices(devices.map((d) => d.id === id ? { ...d, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser?.name, archivedNextDue: d.nextServiceDate || d.archivedNextDue || null, nextServiceDate: null } : d));
      // Drop future planned visits and unrecorded budget lines — nothing more will be spent on it.
      persist.visitBudgets(visitBudgets.filter((v) => !(v.deviceId === id && v.date >= today)));
      persist.budgetLines(budgetLines.filter((l) => !(l.deviceId === id && l.actualAmount == null && l.date >= today)));
      showToast("Service archived", dev.name);
    });
    setDeviceModal(null);
  }
  function restoreDevice(id) {
    const dev = deviceById[id]; const today = new Date().toISOString().slice(0, 10);
    // Bring back the due date it had when archived; if that's passed, move on to its next occurrence.
    let due = dev?.nextServiceDate || dev?.archivedNextDue || null;
    if (due && due < today && dev) { const n = nextDueAfter({ ...dev, nextServiceDate: due }, addDays(today, -1), due); due = n || today; }
    persist.devices(devices.map((d) => d.id === id ? { ...d, archived: false, archivedAt: null, archivedBy: null, nextServiceDate: due, archivedNextDue: null } : d)); queuePlanCheck([id]);
    showToast(due ? `Service restored — next visit ${fmtDate(due)}` : "Service restored — edit it to set the next due date", dev?.name);
  }
  // A booked visit's budget sits in the month it's booked for. The planned line keeps its original date in
  // plannedFor, so the schedule still recognises it, and it goes back there if the booking is cleared.
  function linesAfterBooking(lines, deviceId, due, bookedDate) {
    if (!due) return null;
    const t = (x) => new Date(x + "T00:00:00").getTime();
    const open = lines.filter((l) => l.deviceId === deviceId && l.actualAmount == null && !l.actualServiceId && l.status !== "skipped" && Math.abs(t(l.plannedFor || l.date) - t(due)) <= 45 * 864e5);
    if (!open.length) return null;
    const line = open.sort((a, b) => Math.abs(t(a.plannedFor || a.date) - t(due)) - Math.abs(t(b.plannedFor || b.date) - t(due)))[0];
    if (bookedDate) { if (line.date === bookedDate) return null; return lines.map((l) => (l.id === line.id ? { ...l, date: bookedDate, plannedFor: l.plannedFor || l.date } : l)); }
    if (!line.plannedFor) return null;
    return lines.map((l) => { if (l.id !== line.id) return l; const { plannedFor, ...rest } = l; return { ...rest, date: plannedFor }; });
  }
  function saveBooking(id, booking) {
    const dev = deviceById[id]; if (!dev) return;
    { const nl = linesAfterBooking(budgetLines, id, dev.booking?.forDue || dev.nextServiceDate, booking?.date || null); if (nl) persist.budgetLines(nl); }
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
  function addLocation(loc) {
    if (loc.id) {
      persist.locations(locations.map((l) => l.id === loc.id ? { ...l, ...loc } : l));
      if (loc.id === selectedLocationId && loc.countryId !== selectedCountryId) saveNav({ selectedCountryId: loc.countryId, selectedLocationId: loc.id });
      logActivity(`Edited site: ${loc.name}`);
      setEditLocation(null); showToast("Site saved", loc.name);
      return;
    }
    const l = { ...loc, id: uid() };
    persist.locations([...locations, l]);
    saveNav({ selectedCountryId: l.countryId, selectedLocationId: l.id });
    setShowAddLocation(null);
    setShowLocationPicker(false);
  }
  // Jobs are raised against a service. A site with no services yet gets a "General building" service on request.
  const [pendingJobFor, setPendingJobFor] = useState(null);
  function startJob() {
    if (locDevices.length) { setAddWorkFor(locDevices[0].id); return; }
    if (!selectedLocationId) { showToast("Choose a site first"); setShowLocationPicker(true); return; }
    if (!window.confirm("This site has no services yet, and jobs are raised against a service.\n\nCreate a \"General building\" service so you can raise jobs now? (You can add proper services later.)")) { setTab("devices"); return; }
    const id = uid();
    persist.devices([...devices, { id, locationId: selectedLocationId, name: "General building", serviceCategory: CATEGORY_KEYS.includes("maintenance") ? "maintenance" : CATEGORY_KEYS[0], checklist: [], lastServiceDate: null, nextServiceDate: null, serviceIntervalMonths: null, budgetPerVisit: 0, notesLog: [], general: true }]);
    setPendingJobFor(id);
  }
  useEffect(() => { if (pendingJobFor && locDevices.some((d) => d.id === pendingJobFor)) { setAddWorkFor(pendingJobFor); setPendingJobFor(null); } }, [pendingJobFor, locDevices]);
  function deleteLocation(id) {
    const l = locations.find((x) => x.id === id);
    persist.locations(locations.filter((x) => x.id !== id));
    if (selectedLocationId === id) saveNav({ selectedLocationId: null });
    logActivity(`Deleted site: ${l?.name || ""}`);
    setEditLocation(null); showToast("Site deleted", l?.name);
  }
  function editCountry(id, name, currency) {
    persist.countries(countries.map((c) => c.id === id ? { ...c, name: name.trim(), currency } : c));
    setEditCountryFor(null); showToast("Country saved", name);
  }
  function chooseLocation(countryId, locationId) {
    saveNav({ selectedCountryId: countryId, selectedLocationId: locationId });
    setShowLocationPicker(false);
  }
  function saveDevice(device) {
    if (Number(device.upliftPct) > 0 && Number(device.upliftMonth) > 0) { const prev = deviceById[device.id]; if (!prev || prev.upliftPct !== device.upliftPct || prev.upliftMonth !== device.upliftMonth || !prev.lastUpliftOn) { const t0 = new Date().toISOString().slice(0, 10); const r = `${t0.slice(0, 4)}-${String(device.upliftMonth).padStart(2, "0")}-01`; device = { ...device, lastUpliftOn: r <= t0 ? r : `${Number(t0.slice(0, 4)) - 1}-${String(device.upliftMonth).padStart(2, "0")}-01` }; } }
    if (device.nextServiceDate && (!device.id || deviceById[device.id]?.nextServiceDate !== device.nextServiceDate)) device = { ...device, dueDay: Number(String(device.nextServiceDate).slice(8, 10)) || null };
    const isEdit = !!device.id;
    const { scheduleDates: rawDates, ...deviceFields } = device;
    // New schedules are moved out of blackout periods (and weekends, if that's switched on).
    const scheduleDates = rawDates ? [...new Set(rawDates.map((d) => shiftFor(deviceFields.locationId, d)))].sort() : rawDates;
    if (!isEdit && deviceFields.nextServiceDate) deviceFields.nextServiceDate = scheduleDates?.[0] || shiftFor(deviceFields.locationId, deviceFields.nextServiceDate);
    if (isEdit) {
      const before = devices.find((d) => d.id === device.id) || {};
      persist.devices(devices.map((d) => d.id === device.id ? { ...d, ...deviceFields } : d));
      setDeviceModal(null);
      // Keep the Budget in step with the service: budget, schedule, name, category and supplier.
      const after = { ...before, ...deviceFields, id: device.id };
      const newAmt = Number(after.budgetPerVisit) || 0; const oldAmt = Number(before.budgetPerVisit) || 0;
      const scheduleChanged = (Number(after.serviceIntervalMonths) || 0) !== (Number(before.serviceIntervalMonths) || 0) || (after.nextServiceDate || "") !== (before.nextServiceDate || "") || (Number(after.upliftPct) || 0) !== (Number(before.upliftPct) || 0) || (Number(after.upliftMonth) || 0) !== (Number(before.upliftMonth) || 0);
      let note = "";
      if (newAmt !== oldAmt || (scheduleChanged && newAmt > 0)) {
        const r = rebuildPlan(after, budgetLines, visitBudgets);
        persist.budgetLines(r.lines); persist.visitBudgets(r.vbs);
        note = newAmt === 0 ? `Budget removed — ${r.removed} planned visit${r.removed === 1 ? "" : "s"} taken out of the budget` : `${r.added} planned visit${r.added === 1 ? "" : "s"} at ${gbp(newAmt)} in the budget (through ${new Date().getFullYear() + 1})`;
      } else if (["name", "serviceCategory", "subCategory", "supplierId", "locationId"].some((k) => (after[k] || "") !== (before[k] || ""))) {
        const today = new Date().toISOString().slice(0, 10);
        persist.budgetLines(budgetLines.map((l) => (l.deviceId === device.id && l.date >= today && l.actualAmount == null ? { ...l, description: after.name, category: after.serviceCategory || l.category, subCategory: after.subCategory || "", supplierId: after.supplierId || null, locationId: after.locationId || l.locationId } : l)));
      }
      queuePlanCheck([device.id]);
      showToast("Service updated", note || device.name);
      return;
    }
    const newId = uid();
    persist.devices([...devices, { ...deviceFields, id: newId }]); queuePlanCheck([newId]);
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
      if (p.budgetLines?.length) persist.budgetLines([...budgetLines.filter((l) => !p.budgetLines.some((x) => x.id === l.id)), ...p.budgetLines]);
    } else if (t.type === "work") persist.works([p.work, ...works.filter((w) => w.id !== p.work.id)]);
    else if (t.type === "supplier") persist.suppliers([...suppliers.filter((s) => s.id !== p.supplier.id), p.supplier]);
    persist.trash(trash.filter((x) => x.trashId !== t.trashId));
    showToast("Restored", t.name);
  }
  function deleteDevice(id) {
    const dev = deviceById[id];
    if (dev) toTrash({ type: "service", name: dev.name, payload: { budgetLines: budgetLines.filter((l) => l.deviceId === id), device: dev, services: services.filter((s) => s.deviceId === id), works: works.filter((w) => w.deviceId === id), tasks: deviceTasks.filter((t) => t.deviceId === id), visitBudgets: visitBudgets.filter((v) => v.deviceId === id) } });
    withUndo(() => {
      persist.devices(devices.filter((d) => d.id !== id));
      persist.services(services.filter((s) => s.deviceId !== id));
      persist.works(works.filter((w) => w.deviceId !== id));
      persist.deviceTasks(deviceTasks.filter((t) => t.deviceId !== id));
      persist.visitBudgets(visitBudgets.filter((v) => v.deviceId !== id));
      persist.budgetLines(budgetLines.filter((l) => l.deviceId !== id));
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
  // Weekly / "N times a year" services repeat every N days. Older ones didn't store that, so work it out from their visit dates.
  function stepDaysFor(dev) {
    if (Number(dev.serviceIntervalMonths) > 0) return 0;
    if (Number(dev.repeatEveryDays) > 0) return Number(dev.repeatEveryDays);
    const ds = plannedDatesFor(dev.id); if (ds.length < 3) return 0;
    const gaps = ds.slice(1).map((d, i) => Math.round((new Date(d + "T12:00:00") - new Date(ds[i] + "T12:00:00")) / 864e5)).sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    if (!(med >= 5 && med <= 120)) return 0;
    return gaps.filter((g) => Math.abs(g - med) <= 3).length >= gaps.length * 0.8 ? med : 0;
  }
  // Plan far enough ahead that next year's budget is complete (Budget → Tools can change this).
  const planHorizonEnd = () => { const h = settings.planHorizon || "nextYear"; const t0 = new Date().toISOString().slice(0, 10); return h === "12" ? addMonths(t0, 12) : h === "24" ? addMonths(t0, 24) : `${new Date().getFullYear() + 1}-12-31`; };
  function nextDueAfter(dev, anchor, fromDue) {
    const planned = plannedDatesFor(dev.id).filter((d) => d > anchor);
    if (planned.length) return planned[0];
    { const sd = stepDaysFor(dev); if (sd && fromDue) { let d = fromDue; let g = 0; do { d = addDays(d, sd); } while (d <= anchor && g++ < 2000); return shiftFor(dev.locationId, d); } }
    if (dev.serviceIntervalMonths && fromDue) {
      const day = Number(dev.dueDay) || Number(String(fromDue).slice(8, 10)); let k = 0, d = fromDue;
      do { k++; d = addMonths(fromDue, k * dev.serviceIntervalMonths, day); } while (d <= anchor && k < 600);
      return shiftFor(dev.locationId, d);
    }
    return null;
  }
  // Logging a NEW visit completes the occurrence that is currently due — however early or late
  // it's logged — and moves the service on to the following one.
  function advanceSchedule(deviceId, visitDate, updatedServices, override) {
    const dev = deviceById[deviceId];
    if (!dev) return null;
    const due = dev.nextServiceDate || visitDate;
    const twoWeeksBefore = addDays(visitDate, -14);
    const anchor = due > twoWeeksBefore ? due : twoWeeksBefore; // a very late visit also covers occurrences it overlapped
    const next = override || nextDueAfter(dev, anchor, due);
    const lastDate = updatedServices.filter((s) => s.deviceId === deviceId && s.date).reduce((m, s) => (s.date > m ? s.date : m), visitDate);
    persist.devices(devices.map((d) => d.id === deviceId ? { ...d, lastServiceDate: lastDate, nextServiceDate: next, ...(override ? { rescheduleLog: [...(d.rescheduleLog || []), { from: nextDueAfter(dev, anchor, due), to: override, by: currentUser?.name || "Unknown", at: new Date().toISOString(), reason: "Set when logging visit" }] } : {}) } : d));
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
    const plus14 = addDays(lastDate, 14);
    planned.forEach((d) => { if (d <= plus14) covered = d; });
    const next = covered ? nextDueAfter(dev, covered, covered) : (dev.serviceIntervalMonths ? addMonths(lastDate, dev.serviceIntervalMonths) : null);
    persist.devices(devices.map((d) => d.id === deviceId ? { ...d, lastServiceDate: lastDate, nextServiceDate: next } : d));
  }
  // A logged visit's cost should also mark the matching auto-generated Budget Plan
  // line as recorded, so the Plan doesn't sit forever showing "not yet spent" for
  // work that's actually been done and paid for.
  // ---------- Service ↔ budget helpers ----------
  // Planned visit dates for a service between two dates: from its interval, or from its own schedule if it has no interval.
  function scheduleDatesFor(dev, from, to) {
    const step = Number(dev.serviceIntervalMonths) || 0;
    if (!step && stepDaysFor(dev)) {
      const sd = stepDaysFor(dev); const known = plannedDatesFor(dev.id).concat(dev.nextServiceDate ? [dev.nextServiceDate] : []).sort();
      const out = known.filter((d) => d >= from && d <= to); let dt = known[known.length - 1]; let g = 0;
      while (dt && (dt = addDays(dt, sd)) <= to && g++ < 400) if (dt >= from) out.push(shiftFor(dev.locationId, dt));
      return [...new Set(out)].sort();
    }
    if (!step) return [...new Set(visitBudgets.filter((v) => v.deviceId === dev.id && v.date >= from && v.date <= to).map((v) => v.date).concat(dev.nextServiceDate && dev.nextServiceDate >= from && dev.nextServiceDate <= to ? [dev.nextServiceDate] : []))].sort();
    const base = dev.nextServiceDate; if (!base) return [];
    const day = Number(dev.dueDay) || Number(base.slice(8, 10)); let k = 0, dt = base;
    while (dt < from && k < 600) { k++; dt = addMonths(base, k * step, day); }
    const out = []; while (dt <= to && out.length < 60) { out.push(shiftFor(dev.locationId, dt)); k++; dt = addMonths(base, k * step, day); }
    return [...new Set(out)];
  }
  // Annual price rise: count the rise dates (1st of the chosen month) after today and up to the visit date.
  const upliftedAmount = (dev, date, amount) => {
    const p = Number(dev.upliftPct) || 0, m = Number(dev.upliftMonth) || 0; if (!(p > 0) || !m || !date) return amount;
    const today = new Date().toISOString().slice(0, 10); let n = 0;
    for (let y = Number(today.slice(0, 4)); y <= Number(String(date).slice(0, 4)); y++) { const r = `${y}-${String(m).padStart(2, "0")}-01`; if (r > today && r <= date) n++; }
    return n ? Math.round(amount * Math.pow(1 + p / 100, n) * 100) / 100 : amount;
  };
  const planLineFor = (dev, date, amount) => ({ id: uid(), locationId: dev.locationId, deviceId: dev.id, category: dev.serviceCategory || "maintenance", subCategory: dev.subCategory || "", supplierId: dev.supplierId || null, description: dev.name, date, amount: upliftedAmount(dev, date, amount), status: "planned", addedBy: currentUser?.name, auto: true });
  // Replace a service's future, not-yet-spent planned visits with ones that match its current schedule and budget.
  function rebuildPlan(dev, lines, vbs, horizonMonths = 12) {
    const today = new Date().toISOString().slice(0, 10); const amount = Number(dev.budgetPerVisit) || 0;
    const keep = lines.filter((l) => !(l.deviceId === dev.id && l.date >= today && l.actualAmount == null && l.status !== "skipped"));
    const removed = lines.length - keep.length;
    const dates = amount > 0 && !dev.archived ? scheduleDatesFor(dev, today, horizonMonths === 12 ? planHorizonEnd() : addMonths(today, horizonMonths)) : [];
    const manual = !(Number(dev.serviceIntervalMonths) || 0) && !stepDaysFor(dev);
    const nextVbs = manual ? vbs.map((v) => (v.deviceId === dev.id && v.date >= today ? { ...v, amount } : v)) : [...vbs.filter((v) => !(v.deviceId === dev.id && v.date >= today)), ...dates.map((date) => ({ id: uid(), deviceId: dev.id, date, amount }))];
    let out = [...keep, ...dates.map((d) => planLineFor(dev, d, amount))];
    // keep a current booking's month: move the rebuilt visit for that due date to the booked date again
    if (dev.booking?.date && (dev.booking.forDue || dev.nextServiceDate)) { const moved = linesAfterBooking(out, dev.id, dev.booking.forDue || dev.nextServiceDate, dev.booking.date); if (moved) out = moved; }
    return { lines: out, vbs: nextVbs, added: dates.length, removed };
  }
  // Keep a service's planned visits following its schedule: drop future planned visits the schedule has moved past,
  // and add every scheduled visit up to the end of next year. Spent, skipped and visit-linked lines are never touched.
  function alignPlan(dev, lines, vbs) {
    const today = new Date().toISOString().slice(0, 10); const amount = Number(dev.budgetPerVisit) || 0;
    const none = { lines, vbs, added: 0, removed: 0 };
    if (!(amount > 0) || dev.archived || (dev.pausedUntil && dev.pausedUntil > today) || !dev.nextServiceDate) return none;
    const interval = Number(dev.serviceIntervalMonths) || 0; const sd = stepDaysFor(dev);
    if (!interval && !sd) { // one-off or hand-picked dates: only make sure the next visit has a planned line
      const t0 = (x) => new Date(x + "T00:00:00").getTime();
      if (dev.nextServiceDate < today || lines.some((l) => l.deviceId === dev.id && Math.abs(t0(l.date) - t0(dev.nextServiceDate)) <= 14 * 864e5)) return none;
      return { lines: [...lines, planLineFor(dev, dev.nextServiceDate, amount)], vbs: vbs.some((v) => v.deviceId === dev.id && v.date === dev.nextServiceDate) ? vbs : [...vbs, { id: uid(), deviceId: dev.id, date: dev.nextServiceDate, amount }], added: 1, removed: 0 };
    }
    const tol = (sd ? Math.max(2, Math.floor(sd / 2)) : 14) * 864e5; const t = (x) => new Date(x + "T00:00:00").getTime();
    const cutoff = t(dev.nextServiceDate) - tol; let removed = 0;
    const stale = (l) => l.deviceId === dev.id && l.actualAmount == null && !l.actualServiceId && l.status !== "skipped" && !l.plannedFor && l.date >= today && t(l.date) < cutoff;
    let nextLines = lines.filter((l) => { if (stale(l)) { removed++; return false; } return true; });
    let nextVbs = vbs.filter((v) => !(v.deviceId === dev.id && v.date >= today && t(v.date) < cutoff));
    const mine = nextLines.filter((l) => l.deviceId === dev.id);
    const fresh = scheduleDatesFor(dev, today, planHorizonEnd()).filter((d) => t(d) >= cutoff && !mine.some((l) => Math.abs(t(l.plannedFor || l.date) - t(d)) <= tol));
    nextLines = [...nextLines, ...fresh.map((d) => planLineFor(dev, d, amount))];
    // Weekly / every-N-days services keep their dates as visit records, so add those too. Interval services follow
    // their interval — adding records there would make the next-due date skip ahead.
    if (!interval) nextVbs = [...nextVbs, ...fresh.filter((d) => !nextVbs.some((v) => v.deviceId === dev.id && v.date === d)).map((date) => ({ id: uid(), deviceId: dev.id, date, amount }))];
    return { lines: nextLines, vbs: nextVbs, added: fresh.length, removed };
  }
  // Add planned visits only where none exist (within 2 weeks) — never removes anything.
  function topUpPlan(dev, lines, horizonMonths = 12) {
    const today = new Date().toISOString().slice(0, 10); const amount = Number(dev.budgetPerVisit) || 0;
    if (!(amount > 0) || dev.archived) return { lines, added: 0 };
    const t = (x) => new Date(x + "T00:00:00").getTime();
    const mine = lines.filter((l) => l.deviceId === dev.id);
    const tol = stepDaysFor(dev) ? Math.max(2, Math.floor(stepDaysFor(dev) / 2)) : 14;
    const fresh = scheduleDatesFor(dev, today, horizonMonths === 12 ? planHorizonEnd() : addMonths(today, horizonMonths)).filter((d) => !mine.some((l) => Math.abs(t(l.plannedFor || l.date) - t(d)) <= tol * 86400000)).map((d) => planLineFor(dev, d, amount));
    return { lines: [...lines, ...fresh], added: fresh.length };
  }
  function planVisitsForServices(ids, horizonMonths = 12) {
    let lines = budgetLines; let added = 0;
    ids.forEach((id) => { const dev = devices.find((d) => d.id === id); if (!dev) return; const r = topUpPlan(dev, lines, horizonMonths); lines = r.lines; added += r.added; });
    if (added) persist.budgetLines(lines);
    showToast(added ? `${added} planned visit${added === 1 ? "" : "s"} added to the budget` : "Every budgeted service is already planned", added ? `Next ${horizonMonths} months` : "");
  }
  function rebuildServicePlan(id) {
    const dev = devices.find((d) => d.id === id); if (!dev) return;
    const r = rebuildPlan(dev, budgetLines, visitBudgets);
    persist.budgetLines(r.lines); persist.visitBudgets(r.vbs);
    logActivity(`Rebuilt planned visits in the budget: ${dev.name}`);
    showToast("Planned visits rebuilt", `${r.added} visit${r.added === 1 ? "" : "s"} at ${gbp(dev.budgetPerVisit || 0)} over the next 12 months`);
  }
  function removeOrphanLines(ids) { const set = new Set(ids); persist.budgetLines(budgetLines.filter((l) => !set.has(l.id))); showToast(`${ids.length} planned visit${ids.length === 1 ? "" : "s"} removed from the budget`); }
  function syncBudgetLineForVisit(deviceId, visitDate, visitCost, visitId, dueDate) {
    if (visitCost == null || visitCost === "") return;
    const deviceLines = budgetLines.filter((l) => l.deviceId === deviceId);
    if (deviceLines.length === 0) return;
    const t = (d) => new Date(d + "T00:00:00").getTime();
    // 1) the line this visit already filled (editing), 2) the line for the occurrence it completed,
    // 3) the earliest line with nothing recorded yet up to 2 weeks after the visit, 4) nearest by date.
    let target = deviceLines.find((l) => visitId && l.actualServiceId === visitId)
      || (dueDate && Math.abs(t(dueDate) - t(visitDate)) <= 120 * 86400000 && deviceLines.find((l) => l.date === dueDate && (l.actualAmount == null || isMirrored(l) && l.actualServiceId === visitId)))
      || deviceLines.filter((l) => l.actualAmount == null && l.status !== "skipped" && t(l.date) <= t(visitDate) + 14 * 86400000 && t(l.date) >= t(visitDate) - 120 * 86400000).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!target) {
      let best = 45 * 86400000; // an extra visit far from any planned one is "unplanned" — its cost still counts, but it doesn't use up another month's budget
      deviceLines.filter((l) => l.actualAmount == null && l.status !== "skipped").forEach((l) => { const diff = Math.abs(t(l.date) - t(visitDate)); if (diff <= best) { best = diff; target = l; } });
    }
    if (!target) return;
    persist.budgetLines(budgetLines.map((l) => l.id === target.id ? { ...l, actualAmount: Number(visitCost), actualDate: visitDate, status: "completed", actualSource: "visit", actualServiceId: visitId || null } : l));
  }
  function saveService(record) {
    queuePlanCheck([record.deviceId]);
    const isEdit = !!record.id;
    const visitId = isEdit ? record.id : uid();
    let next;
    if (isEdit) {
      next = services.map((s) => s.id === record.id ? { ...s, ...record, updatedBy: currentUser?.name, updatedAt: new Date().toISOString() } : s);
    } else {
      next = [{ ...record, id: visitId, loggedBy: currentUser?.name, loggedAt: new Date().toISOString() }, ...services];
    }
    persist.services(next);
    if (!isEdit && record.usageHours != null && record.usageHours !== "") {
      // handled after advanceSchedule below via setTimeout-free merge: store on the device in the same update cycle
      pendingUsage.current = { id: record.deviceId, hours: Number(record.usageHours), date: record.date };
    }
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
      const skipDue = deviceById[record.deviceId]?.nextServiceDate || record.date;
      const tt = (x) => new Date(x + "T00:00:00").getTime();
      const cand = budgetLines.filter((l) => l.deviceId === record.deviceId && l.actualAmount == null && l.status !== "skipped");
      const skipLine = cand.find((l) => l.date === skipDue) || cand.filter((l) => Math.abs(tt(l.date) - tt(skipDue)) <= 45 * 86400000).sort((a, b) => Math.abs(tt(a.date) - tt(skipDue)) - Math.abs(tt(b.date) - tt(skipDue)))[0];
      if (skipLine) persist.budgetLines(budgetLines.map((l) => l.id === skipLine.id ? { ...l, status: "skipped", actualAmount: 0, actualDate: record.date, actualSource: "skipped", skipReason: record.skipReason || "" } : l));
      advanceSchedule(record.deviceId, record.date || new Date().toISOString().slice(0, 10), next);
      setServiceModal(null);
      showToast("Visit skipped — next one scheduled", `${deviceById[record.deviceId]?.name || ""} — ${record.skipReason || ""}`);
      return;
    }
    const completedDue = isEdit ? null : advanceSchedule(record.deviceId, record.date || new Date().toISOString().slice(0, 10), next, record.nextDueOverride || null);
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
    queuePlanCheck([deviceId]);
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
    queuePlanCheck([newId]);
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
      return { ...w, ...patch, ...extra, ...holdChange(w, patch.status, today) };
    }));
  }
  // Going on / coming off hold: the paused days are added to the work's target date.
  function holdChange(w, newStatus, today) {
    if (!newStatus || newStatus === w.status) return {};
    if (newStatus === "on_hold") return { heldSince: today };
    if (w.status === "on_hold" && w.heldSince) return { heldSince: null, heldDays: (Number(w.heldDays) || 0) + Math.max(0, Math.round((new Date(today) - new Date(w.heldSince)) / 86400000)) };
    return {};
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
  // One-time tidy-up: fields created with the short-lived "extra fields" editor become standard custom fields (values keep their keys).
  useEffect(() => {
    if (loading || !ACTIVE_CAN_EDIT) return;
    const list = settings.customFields || [];
    if (list.some((f) => !f.id && f.key)) persist.settings({ ...settings, customFields: list.map((f) => (!f.id && f.key ? { id: f.key, label: f.label, type: f.type || "text", appliesTo: "service", categories: [], options: [], required: false } : f)) });
  }, [loading, settings.customFields]);
  function budgetSettingsFor() { return (settings.budgetSettings || {})[selectedLocationId] || {}; }
  function saveBudgetSettings(patch) {
    const cur = budgetSettingsFor(); const next = { ...cur, ...patch };
    if (patch.changeLog) next.changeLog = patch.changeLog.map((c) => (c.by ? c : { ...c, by: currentUser?.name }));
    persist.settings({ ...settings, budgetSettings: { ...(settings.budgetSettings || {}), [selectedLocationId]: next } });
  }
  function logBudgetChange(year, text) {
    const cur = budgetSettingsFor();
    return { ...(settings.budgetSettings || {}), [selectedLocationId]: { ...cur, changeLog: [...(cur.changeLog || []), { year, at: new Date().toISOString(), by: currentUser?.name, text }].slice(-300) } };
  }
  // Set several category budgets for a year in one save, with a change-log entry.
  function setBudgetsBulk(year, map, reason) {
    let next = [...budgets]; const changes = [];
    Object.entries(map).forEach(([cat, amount]) => {
      const ex = next.find((b) => b.locationId === selectedLocationId && b.year === year && b.category === cat);
      changes.push(`${CATEGORY_META[cat]?.label || cat}: ${gbp(ex ? ex.amount : 0)} → ${gbp(amount)}`);
      next = ex ? next.map((b) => b.id === ex.id ? { ...b, amount } : b) : [...next, { id: uid(), locationId: selectedLocationId, year, category: cat, amount }];
    });
    persist.budgets(next);
    persist.settings({ ...settings, budgetSettings: logBudgetChange(year, `${reason || "Budget changed"} — ${changes.join("; ")}`) });
    showToast("Budget updated", reason || "");
  }
  function moveBudget(year, from, to, amount, reason) {
    const get = (c) => Number(locBudgets.find((b) => b.year === year && b.category === c)?.amount) || 0;
    let next = [...budgets];
    [[from, get(from) - amount], [to, get(to) + amount]].forEach(([cat, amt]) => { const ex = next.find((b) => b.locationId === selectedLocationId && b.year === year && b.category === cat); next = ex ? next.map((b) => b.id === ex.id ? { ...b, amount: amt } : b) : [...next, { id: uid(), locationId: selectedLocationId, year, category: cat, amount: amt }]; });
    persist.budgets(next);
    persist.settings({ ...settings, budgetSettings: logBudgetChange(year, `Moved ${gbp(amount)} from ${CATEGORY_META[from]?.label} to ${CATEGORY_META[to]?.label}${reason ? ` — ${reason}` : ""}`) });
    showToast("Budget moved", `${gbp(amount)} → ${CATEGORY_META[to]?.label}`);
  }
  // Cost lines: save new or changed lines in one go (keeps several edits from overwriting each other).
  function saveCostLines(list) {
    const byId = Object.fromEntries(list.filter((l) => l.id).map((l) => [l.id, l]));
    const fresh = list.filter((l) => !l.id).map((l) => ({ ...l, id: uid(), locationId: selectedLocationId, createdBy: currentUser?.name, createdAt: new Date().toISOString() }));
    persist.costLines([...costLines.map((l) => byId[l.id] ? { ...l, ...byId[l.id], updatedBy: currentUser?.name, updatedAt: new Date().toISOString() } : l), ...fresh]);
    if (fresh.length) showToast(`${fresh.length} cost line${fresh.length === 1 ? "" : "s"} added`);
  }
  function deleteCostLine(id) { const l = costLines.find((x) => x.id === id); persist.costLines(costLines.filter((x) => x.id !== id)); logActivity(`Deleted cost line: ${l?.name || ""}`); }
  function recordCostInvoice(inv) { invOps.save({ ...inv, status: "received", vatRate: 20, fromCostLines: true }); }
  function bulkUpdateLines(map) { persist.budgetLines(budgetLines.map((l) => map[l.id] ? { ...l, ...map[l.id] } : l)); showToast(`${Object.keys(map).length} plan lines updated`); }
  function bulkDeleteLines(ids) { const set = new Set(ids); persist.budgetLines(budgetLines.filter((l) => !set.has(l.id))); showToast(`${ids.length} plan lines deleted`); }
  function setCategoryBudget(year, category, amount) {
    const prevAmt = Number(locBudgets.find((b) => b.year === year && b.category === category)?.amount) || 0;
    if (prevAmt !== Number(amount)) persist.settings({ ...settings, budgetSettings: logBudgetChange(year, `${CATEGORY_META[category]?.label || category}: ${gbp(prevAmt)} → ${gbp(Number(amount) || 0)}`) });
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
  }, [users, countries, locations, devices, services, works, suppliers, budgets, budgetLines, deviceTasks, visitBudgets, settings, activity, meters, meterReadings, signins, spares, keysList, reminders, audits, incidents, projects, permits, waste, purchaseOrders, invoices, waterOutlets, waterReadings, training, drills, trash, notices, logEntries, savings, asbestos, actions, spaces, walkrounds, coshh, equipment, visitSubmissions, feedback, floorplans, keyDates, carPark, isolations, costLines, shutdowns]);

  // Page headers: title and four key figures for each tab, in the bento style.
  const pageHeaders = (() => {
    const t0 = new Date().toISOString().slice(0, 10); const ym = t0.slice(0, 7); const yr = t0.slice(0, 4);
    const dn = (d) => daysUntil(d?.nextServiceDate);
    const overdueN = locDevices.filter((d) => dn(d) !== null && dn(d) < 0).length;
    const weekN = locDevices.filter((d) => dn(d) !== null && dn(d) >= 0 && dn(d) <= 7).length;
    const monthN = locDevices.filter((d) => d.nextServiceDate && d.nextServiceDate.slice(0, 7) === ym).length;
    const notBookedN = locDevices.filter((d) => dn(d) !== null && dn(d) >= 0 && dn(d) <= 14 && !currentBooking(d)).length;
    const bookedN = locDevices.filter((d) => currentBooking(d)).length;
    const visitsYr = locServices.filter((v) => String(v.date).startsWith(yr) && !v.aborted && !v.skipped);
    const visitsMo = visitsYr.filter((v) => String(v.date).startsWith(ym));
    const failsMo = visitsMo.reduce((t, v) => t + (v.checklistResults || []).filter((r) => r.result === "fail").length, 0);
    const certMissing = locDevices.filter((d) => { if (!d.certRequired) return false; const last = locServices.filter((v) => v.deviceId === d.id && !v.aborted && !v.skipped).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]; return last && !last.certificatePhoto; }).length;
    const openW = locWorks.filter((w) => !["completed", "rejected"].includes(w.status));
    const lateW = openW.filter((w) => workSla(w)?.breached).length;
    const reqW = locWorks.filter((w) => w.status === "requested").length;
    const doneW = locWorks.filter((w) => w.status === "completed" && String(w.completedAt || "").startsWith(ym)).length;
    const annual = (x) => (x.costFrequency === "annual" ? Number(x.costAmount) || 0 : (Number(x.costAmount) || 0) * 12);
    const ending = locSuppliers.filter((x) => x.contractEnd && daysUntil(x.contractEnd) >= 0 && daysUntil(x.contractEnd) <= 90).length;
    const flagged = locSuppliers.filter((x) => x.status === "blocked" || x.status === "probation").length;
    const toApprove = locInvoices.filter((i) => i.status === "received").length;
    const budgetHead = budgetModel({ year: new Date().getFullYear(), budgets: locBudgets, services: locServices, works: locWorks, suppliers: locSuppliers, devices: locDevices, budgetLines: locBudgetLines, costLines: costLines.filter((l) => l.locationId === selectedLocationId), bs: (settings.budgetSettings || {})[selectedLocationId] || {} });
    const lowStock = locSpares.filter((x) => x.minQty !== "" && x.minQty != null && Number(x.qty) <= Number(x.minQty)).length;
    const onSite = locSignins.filter((x) => !x.outAt).length;
    const openInc = locIncidents.filter((i) => i.status !== "closed").length;
    const openPtw = locPermits.filter((p) => p.status === "open").length;
    return {
      devices: { title: "Services", subtitle: `${locDevices.length} active${locArchivedDevices.length ? ` · ${locArchivedDevices.length} archived` : ""}`, kpis: [
        { label: "Services", value: locDevices.length, icon: Wrench },
        { label: "Overdue", value: overdueN, tone: overdueN ? "danger" : "ok", icon: Clock },
        { label: "Due this month", value: monthN, icon: Calendar },
        { label: "Not booked", value: notBookedN, sub: "due within 14 days", tone: notBookedN ? "warn" : undefined, icon: CalendarCheck } ] },
      schedule: { title: "Schedule", subtitle: "Planned visits and tasks", kpis: [
        { label: "This week", value: weekN, icon: Calendar },
        { label: "This month", value: monthN, icon: CalendarDays },
        { label: "Overdue", value: overdueN, tone: overdueN ? "danger" : "ok", icon: Clock },
        { label: "Booked", value: bookedN, sub: "with a confirmed date", icon: CalendarCheck } ] },
      certificates: { title: "Completed", subtitle: "Visits, certificates and checks", kpis: [
        { label: `Visits ${yr}`, value: visitsYr.length, icon: CheckCircle2 },
        { label: "This month", value: visitsMo.length, icon: Calendar },
        { label: "Failed checks", value: failsMo, sub: "this month", tone: failsMo ? "danger" : "ok", icon: AlertTriangle },
        { label: "Certificates missing", value: certMissing, tone: certMissing ? "warn" : "ok", icon: FileCheck } ] },
      works: { title: "Works", subtitle: worksView === "projects" ? "Projects" : "Reactive works", kpis: [
        { label: "Open", value: openW.length, icon: Wrench },
        { label: "Past target", value: lateW, tone: lateW ? "danger" : "ok", icon: Timer },
        { label: "New requests", value: reqW, tone: reqW ? "warn" : undefined, icon: Bell },
        { label: "Done this month", value: doneW, tone: "ok", icon: CheckCircle2 } ] },
      suppliers: { title: "Suppliers", subtitle: `${locSuppliers.length} on file`, kpis: [
        { label: "Suppliers", value: locSuppliers.length, icon: Users },
        { label: "Contracts / year", value: gbp(locSuppliers.reduce((t, x) => t + annual(x), 0)), icon: PoundSterling },
        { label: "Ending in 90 days", value: ending, tone: ending ? "warn" : undefined, icon: Calendar },
        { label: "Flagged", value: flagged, sub: "probation or do not use", tone: flagged ? "danger" : undefined, icon: AlertTriangle } ] },
      budget: { title: "Budget", subtitle: `${spendSummary.yr} · ${budgetView === "finance" ? "POs & invoices" : "plan and spend"}${(() => { const m2 = spaces.filter((s) => s.locationId === selectedLocationId).reduce((t, s) => t + (Number(s.areaM2) || 0), 0) || Number(((settings.siteInfo || {})[selectedLocationId] || {}).floorArea) || 0; return m2 && spendSummary.spent ? ` · ${gbp(spendSummary.spent / m2)} per m² so far${spendSummary.forecast ? ` (forecast ${gbp(spendSummary.forecast / m2)})` : ""}` : ""; })()}`, kpis: [
        { label: "Spent so far", value: gbp(budgetHead.spent), icon: PoundSterling },
        { label: "Budget", value: budgetHead.budget ? gbp(budgetHead.budget) : "—", icon: Receipt },
        { label: "Forecast", value: gbp(budgetHead.forecast), tone: budgetHead.budget && budgetHead.forecast > budgetHead.budget ? "danger" : "ok", icon: TrendingUp },
        { label: "Invoices to approve", value: toApprove, tone: toApprove ? "warn" : undefined, icon: FileText } ] },
      meters: { title: "Site", subtitle: "Safety, records and building", kpis: [
        { label: "On site now", value: onSite, sub: "contractors", icon: HardHat },
        { label: "Open incidents", value: openInc, tone: openInc ? "warn" : "ok", icon: Siren },
        { label: "Open permits", value: openPtw, icon: Flame },
        { label: "Low stock", value: lowStock, tone: lowStock ? "warn" : undefined, icon: Package } ] },
    };
  })();
  const navItems = [
    { key: "home", label: "Home", icon: LayoutDashboard },
    { key: "devices", label: "Services", icon: Wrench, count: locDevices.filter((d) => d.nextServiceDate && daysUntil(d.nextServiceDate) < 0).length },
    { key: "schedule", label: "Schedule", icon: Calendar, alert: overdueCount > 0 },
    { key: "certificates", label: "Completed", icon: FileCheck },
    { key: "works", label: "Works", icon: Receipt, count: locWorks.filter((w) => w.status === "requested").length },
    { key: "suppliers", label: "Suppliers", icon: UsersIcon },
    { key: "budget", label: "Budget", icon: PoundSterling },
    { key: "meters", label: "Site", icon: Activity },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "var(--faint)", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <Loader2 size={20} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} /> Loading service book…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Every gbp() call made anywhere in this render pass reads this — set it
  // synchronously before the tree below renders.
  set_ACTIVE_CURRENCY_CODE(selectedCountry?.currency || "GBP");
  applyCategorySettings(settings);
  set_ACTIVE_CUSTOM_FIELDS((settings.customFields || []).map((f) => (!f.id && f.key ? { id: f.key, label: f.label, type: f.type || "text", appliesTo: "service", categories: [], options: [] } : f)));
  set_ACTIVE_TEMPLATES([...BUILTIN_TEMPLATES, ...(settings.serviceTemplates || [])]);
  set_ACTIVE_CAN_EDIT(currentUser?.role !== "viewer");
  set_ACTIVE_USERS(users);
  { const tc = {}; devices.forEach((d) => (d.tags || []).forEach((t) => { tc[d.locationId] = tc[d.locationId] || []; if (!tc[d.locationId].includes(t)) tc[d.locationId].push(t); })); set_TAG_SUGGESTIONS_CACHE(tc); }
  { const pc = {}; devices.forEach((d) => { if (!d.archived) (pc[d.locationId] = pc[d.locationId] || []).push({ id: d.id, name: d.name, parentId: d.parentId, checklist: d.checklist || [], isChild: !!d.parentId }); }); set_PARENT_CANDIDATES_CACHE(pc); }
  set_ACTIVE_SITE_INFO((settings.siteInfo || {})[selectedLocationId] || {});
  set_ACTIVE_BRAND(settings.branding || {});
  set_ACTIVE_SLA({ ...SLA_DAYS, ...(settings.slaDays || {}), workingDays: !!settings.slaWorkingDays });
  set_AREA_SUGGESTIONS_CACHE({}); devices.forEach((d) => { if (d.area) (AREA_SUGGESTIONS_CACHE[d.locationId] = AREA_SUGGESTIONS_CACHE[d.locationId] || []).includes(d.area) || AREA_SUGGESTIONS_CACHE[d.locationId].push(d.area); });

  const needsProfile = !currentUser;
  const needsLocation = !needsProfile && !selectedLocation;

  return (
    <div style={{ background: "var(--track)", minHeight: "100%", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #A3ABB4; }
        button { transition: opacity .15s ease; }
        button:hover { opacity: 0.88; }
        button:active { opacity: 0.7; }
        .ppm-shell { width: 100%; max-width: 100%; }
      `}</style>
      <style>{THEME_CSS}</style>
      <div className="ppm-shell" style={{ ...(ACCENTS[display.accent] ? { "--accent": ACCENTS[display.accent][themeKey === "midnight" ? "dark" : "light"], "--accent-soft": `color-mix(in srgb, ${ACCENTS[display.accent][themeKey === "midnight" ? "dark" : "light"]} ${themeKey === "midnight" ? 18 : 12}%, transparent)`, "--on-accent": themeKey === "midnight" ? "#0B0C10" : "#FFFFFF" } : {}), zoom: display.scale && display.scale !== 1 ? display.scale : undefined, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: "var(--ground)", color: "var(--text)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "var(--head)", padding: "16px 18px", color: "var(--head-text)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                  <span style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: "#D97706", color: "var(--on-accent)", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
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
          <div style={{ display: "flex", background: "var(--card)", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
            {navItems.map((n) => {
              const active = tab === n.key;
              const Icon = n.icon;
              return (
                <button key={n.key} onClick={() => setTab(n.key)} style={{
                  flex: "1 0 auto", background: "none", border: "none", cursor: "pointer", padding: "11px 8px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  borderBottom: active ? "2.5px solid var(--accent)" : "2.5px solid transparent",
                  color: active ? "var(--text)" : "var(--muted)", fontFamily: "inherit",
                }}>
                  <div style={{ position: "relative" }}>
                    <Icon size={17} />
                    {n.count ? <span className="navbadge" data-count={n.count > 99 ? "99+" : String(n.count)} title={`${n.count} need attention`} /> : null}
                    {n.alert ? <span style={{ position: "absolute", top: -3, right: -5, width: 7, height: 7, borderRadius: "50%", background: "#C53030" }} /> : null}
                  </div>
                  <span style={{ fontSize: 10.8, fontWeight: 600 }}>{n.label}</span>
                </button>
              );
            })}
          </div>

          {REMOTE && pendingCount > 0 && Object.keys(saveErrors).length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--warn-soft)", borderBottom: "1px solid #F5D9A8", padding: "8px 16px" }}>
              <CloudOff size={15} color="#8A5A0B" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.3, color: "var(--warn)", fontWeight: 650 }}>Offline — {pendingCount} change{pendingCount === 1 ? "" : "s"} saved on this device, will upload automatically when you're back online.</span>
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
            <button onClick={() => setShowData(true)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--warn-soft)", border: "none", borderBottom: "1px solid #F5D9A8", padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <HardDrive size={15} color="#8A5A0B" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--warn)", fontWeight: 650, flex: 1 }}>Storage {storageInfo.pct}% full — mostly photos. Download a backup and remove old photos.</span>
              <ChevronRight size={14} color="#8A5A0B" />
            </button>
          )}
          {overdueCount > 0 && tab !== "schedule" && (
            <button onClick={() => setTab("schedule")} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--danger-soft)", border: "none",
              borderBottom: "1px solid #F3C6C6", padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
              <ShieldAlert size={15} color="#9B2C2C" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 650, flex: 1 }}>
                {overdueCount} service{overdueCount === 1 ? "" : "s"} overdue — tap to review
              </span>
              <ChevronRight size={14} color="#9B2C2C" />
            </button>
          )}

          {ACTIVE_CAN_EDIT && !backupNagHidden && locDevices.length > 0 && storageInfo.local && (!settings.lastBackupAt || (Date.now() - new Date(settings.lastBackupAt).getTime()) > 14 * 86400000) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--accent-soft)", borderBottom: "1px solid #C9D9EA", padding: "8px 12px 8px 16px" }}>
              <HardDrive size={15} color="#2B4562" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.3, color: "var(--accent)", fontWeight: 600, flex: 1 }}>
                {settings.lastBackupAt ? `Last backup was ${Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / 86400000)} days ago.` : "You haven't backed up yet."}
              </span>
              <button onClick={downloadBackup} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Back up now</button>
              <button onClick={() => setBackupNagHidden(true)} title="Hide for now" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={14} color="#5B6672" /></button>
            </div>
          )}
          <div className={`ppm-content${tab === "home" ? "" : " narrow"}`} style={{ flex: 1, padding: 16, paddingBottom: 90 }}>
            {tab !== "home" && pageHeaders[tab] && <PageHeader {...pageHeaders[tab]} />}
            {tab === "meters" && (
              <SiteTab
                meters={<MetersTab locationName={locationLabel({ locationId: selectedLocationId })} onImportReadings={(list) => { persist.meterReadings([...list.map((r) => ({ ...r, id: uid(), by: currentUser?.name, at: new Date().toISOString(), imported: true })), ...meterReadings]); showToast(`${list.length} readings imported`); }} meters={locMeters} readings={locReadings} suppliers={locSuppliers}
                  onSaveMeter={saveMeter} onArchiveMeter={archiveMeter} onAddReading={addReading} onDeleteReading={deleteReading} />}
                spares={<SparesView onRaisePO={raiseSparesPO} onStockTake={stockTake} spares={locSpares} suppliers={locSuppliers} devices={locDevices} senderName={currentUser?.name}
                  onSave={saveSpare} onAdjust={adjustSpare} onDelete={deleteSpare} />}
                keys={<KeysView onAudit={keyAudit} onLost={markKeyLost} locationName={locationLabel({ locationId: selectedLocationId })} keys={locKeys} onSave={saveKey} onIssue={issueKey} onReturn={returnKey} onDelete={deleteKey} />}
                permits={<PermitsView onExtend={extendPermit} permits={locPermits} devices={locDevices} suppliers={locSuppliers} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })} onSave={savePermit} onClose={closePermit} />}
                waste={<WasteView target={(settings.recyclingTarget || {})[selectedLocationId] ?? null} onSaveTarget={saveRecyclingTarget} waste={locWaste} suppliers={locSuppliers} onSave={saveWaste} onDelete={deleteWaste} />}
                openPermits={locPermits.filter((x) => x.status === "open").length}
                water={<WaterTempsView userName={currentUser?.name} outlets={locOutlets} readings={locWaterReadings} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })}
                  onSaveOutlet={outletOps.save} onDeleteOutlet={outletOps.remove} onAddReadings={addWaterReadings} />}
                training={<TrainingView required={(settings.requiredCourses || {})[selectedLocationId] || []} onSaveRequired={saveRequiredCourses} records={locTraining} onSave={trainingOps.save} onDelete={trainingOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                shutdowns={<ShutdownsView items={shutdowns.filter((x) => x.locationId === selectedLocationId)} onSave={shutdownOps.save} onDelete={shutdownOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} userName={currentUser?.name} />}
                isolations={<IsolationsView items={isolations.filter((x) => x.locationId === selectedLocationId)} onSave={isoOps.save} onDelete={isoOps.remove} onPrintEmergency={printEmergencySheet} />}
                carpark={<CarParkView totalSpaces={((settings.carParkSpaces || {})[selectedLocationId]) ?? null} onSaveSpaces={(v) => persist.settings({ ...settings, carParkSpaces: { ...(settings.carParkSpaces || {}), [selectedLocationId]: v === "" ? null : Number(v) } })} items={carPark.filter((x) => x.locationId === selectedLocationId)} onSave={carOps.save} onDelete={carOps.remove} />}
                floorplans={<FloorPlansView plans={floorplans.filter((p) => p.locationId === selectedLocationId)} devices={locDevices} onSave={planOps.save} onDelete={planOps.remove} onOpenDevice={(id) => setHistoryFor(id)} />}
                keydates={<KeyDatesView items={keyDates.filter((k) => k.locationId === selectedLocationId)} onSave={keyDateOps.save} onDelete={keyDateOps.remove} />}
                feedback={<FeedbackView onRaiseJob={(text) => { setWorkPrefill({ description: text }); startJob(); }} items={feedback.filter((f) => f.locationId === selectedLocationId)} locationId={selectedLocationId} locationName={locationLabel({ locationId: selectedLocationId })} />}
                coshh={<CoshhView items={coshh.filter((c) => c.locationId === selectedLocationId)} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} onSave={coshhOps.save} onDelete={coshhOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                equipment={<EquipmentView items={equipment.filter((c) => c.locationId === selectedLocationId)} onSave={equipOps.save} onDelete={equipOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                actions={<ActionsView onReassign={reassignActions} actions={actions.filter((a) => a.locationId === selectedLocationId)} people={[...new Set([...users.map((u) => u.name), ...((locations.find((l) => l.id === selectedLocationId) || {}).staff || []).map((p) => p.name)])]} onSave={actionOps.save} onDelete={actionOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                spaces={<SpacesView spaces={spaces.filter((s) => s.locationId === selectedLocationId)} devices={locDevices} onSave={spaceOps.save} onDelete={spaceOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} onOpenArea={(a) => { setTab("devices"); setSearch(a); }} />}
                walkrounds={<WalkroundsView walkrounds={walkrounds.filter((w) => w.locationId === selectedLocationId)} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} onSave={walkOps.save} onDelete={walkOps.remove} onRaiseAction={(prefill) => setActionDraft({ prefill: true, ...prefill })} onRaiseJob={(text) => { setWorkPrefill({ description: text }); startJob(); }} locationName={locationLabel({ locationId: selectedLocationId })} />}
                asbestos={<AsbestosView items={asbestos.filter((a) => a.locationId === selectedLocationId)} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })} onSave={asbestosOps.save} onDelete={asbestosOps.remove} />}
                docs={<DocumentsView docs={(settings.siteDocs || []).filter((d) => d.locationId === selectedLocationId)} onSave={saveSiteDocs} locationName={locationLabel({ locationId: selectedLocationId })} />}
                logs={<LogsView locationId={selectedLocationId} defs={settings.logDefs || []} entries={logEntries.filter((x) => x.locationId === selectedLocationId)} onSaveDefs={saveLogDefs} onSave={logEntryOps.save} onDelete={logEntryOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                drills={<DrillsView nextDrill={(settings.nextDrill || {})[selectedLocationId] || ""} onSaveNextDrill={saveNextDrill} drills={locDrills} onSave={drillOps.save} onDelete={drillOps.remove} locationName={locationLabel({ locationId: selectedLocationId })} />}
                audits={<AuditsView onAddAction={(prefill) => setActionDraft({ prefill: true, ...prefill })} audits={locAudits} templates={settings.auditTemplates || DEFAULT_AUDIT_TEMPLATES} suppliers={locSuppliers} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []}
                  locationName={locationLabel({ locationId: selectedLocationId })} senderName={currentUser?.name}
                  onSave={saveAudit} onDelete={deleteAudit} onSaveTemplates={saveAuditTemplates} />}
                incidents={<IncidentsView onAddAction={(prefill) => setActionDraft({ prefill: true, ...prefill })} onShareLesson={(text) => noticeOps.save({ text, pinned: false })} onRaiseWork={locDevices.length ? (inc) => { setWorkPrefill({ incidentId: inc.id, description: `Following incident on ${fmtDate(inc.date)}${inc.area ? ` (${inc.area})` : ""}: ${inc.description}`, priority: inc.type === "injury" ? "high" : "medium" }); setAddWorkFor(locDevices[0].id); } : null} incidents={locIncidents} areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })}
                  onSave={saveIncident} onDelete={deleteIncident} />}
                openIncidents={locIncidents.filter((i) => i.status !== "closed").length}
                badges={(() => { const t = new Date().toISOString().slice(0, 10); const n = (x) => x.length; const B = {};
                  const ao = actions.filter((a) => a.locationId === selectedLocationId && a.status !== "done"); const aOver = ao.filter((a) => a.due && a.due < t);
                  if (ao.length) B.actions = { text: aOver.length ? `${n(aOver)} overdue` : `${n(ao)} open`, tone: aOver.length ? "danger" : undefined };
                  const eq = equipment.filter((q) => q.locationId === selectedLocationId && q.status !== "withdrawn" && (q.status === "failed" || (q.nextDue && q.nextDue < t))); if (eq.length) B.equipment = { text: `${n(eq)} due`, tone: "danger" };
                  const ch = coshh.filter((c) => c.locationId === selectedLocationId && c.reviewDate && c.reviewDate < t); if (ch.length) B.coshh = { text: `${n(ch)} to review`, tone: "warn" };
                  const asb = asbestos.filter((a) => a.locationId === selectedLocationId && a.nextInspection && a.nextInspection < t); if (asb.length) B.asbestos = { text: `${n(asb)} overdue`, tone: "warn" };
                  const kd = keyDates.filter((k) => k.locationId === selectedLocationId && !k.done && k.date && daysUntil(k.date) <= 60); if (kd.length) B.keydates = { text: `${n(kd)} soon`, tone: "warn" };
                  const iso = isolations.filter((i) => i.locationId === selectedLocationId); B.isolations = iso.length ? { text: `${n(iso)}` } : { text: "add", tone: "warn" };
                  const cp = carPark.filter((c) => c.locationId === selectedLocationId); if (cp.length) B.carpark = { text: `${n(cp)}` };
                  const fb = feedback.filter((f) => f.locationId === selectedLocationId && Date.now() - new Date(f.at).getTime() < 30 * 864e5); if (fb.length) B.feedback = { text: `${n(fb)} new` };
                  const sp = spaces.filter((s) => s.locationId === selectedLocationId); if (sp.length) B.spaces = { text: `${n(sp)}` };
                  const tr = locTraining.filter((x) => x.expiry && x.expiry < t); if (tr.length) B.training = { text: `${n(tr)} expired`, tone: "danger" };
                  const lastDrill = [...locDrills].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]; if (!lastDrill || -daysUntil(lastDrill.date) > 365) B.drills = { text: lastDrill ? "overdue" : "none yet", tone: "warn" };
                  return B; })()}
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
                expectedToday={todayItems.bookings} onSignOutAll={signOutAll} locationId={selectedLocationId}
                complianceMonthAgo={complianceMonthAgo}
                onTvMode={() => setShowTv(true)} onEmergencySheet={printEmergencySheet} onTodaySheet={printTodaySheet} onSnoozeReminder={snoozeReminder}
                monthBudget={(() => { const ym = new Date().toISOString().slice(0, 7); const planned = locBudgetLines.filter((l) => String(l.date).startsWith(ym) && l.status !== "skipped").reduce((a, l) => a + (Number(l.amount) || 0), 0); const spent = locServices.filter((v) => String(v.date).startsWith(ym)).reduce((a, v) => a + (Number(v.cost) || 0), 0) + locWorks.filter((w) => w.status === "completed" && !w.warranty && String(w.completedAt || "").startsWith(ym)).reduce((a, w) => a + (Number(w.finalCost ?? w.quoteAmount) || 0), 0); return { planned, spent, label: new Date().toLocaleDateString("en-GB", { month: "long" }) + " budget", go: () => setTab("budget") }; })()}
                handover={(settings.handover || []).filter((h) => h.locationId === selectedLocationId)} onAddHandover={ACTIVE_CAN_EDIT ? addHandover : null}
                waitingOnMe={[
                  [locPOs.filter((p) => p.status === "awaiting").length, "POs to approve", () => { setTab("budget"); saveNav({ budgetView: "finance" }); }],
                  [locInvoices.filter((i) => i.status === "received").length, "Invoices to approve", () => { setTab("budget"); saveNav({ budgetView: "finance" }); }],
                  [locWorks.filter((w) => w.status === "quoted").length, "Quotes to decide on", () => setTab("works")],
                  [locWorks.filter((w) => w.supplierDone && w.status !== "completed").length, "Jobs the supplier says are done", () => setTab("works")],
                  [locWorks.filter((w) => w.status === "requested" && w.source === "request").length, "New requests to review", () => setTab("works")],
                  [visitSubmissions.filter((x) => x.locationId === selectedLocationId).length, "Engineer reports to accept", () => setShowSubmissions(true)],
                ].filter(([n]) => n > 0).map(([n, label, go]) => ({ n, label, go }))}
                doneToday={{ visits: locServices.filter((v) => v.date === todayISO && !v.skipped).length, jobs: locWorks.filter((w) => w.status === "completed" && String(w.completedAt || "").startsWith(todayISO)).length, readings: locReadings.filter((r) => r.date === todayISO).length, checks: logEntries.filter((e) => e.locationId === selectedLocationId && e.date === todayISO).length }}
                recentServices={recentIds.map((id) => deviceById[id]).filter((d) => d && d.locationId === selectedLocationId && !d.archived).slice(0, 5)} onOpenService={(id) => setHistoryFor(id)}
                expected={(settings.expectedVisitors || []).filter((x) => x.locationId === selectedLocationId && x.date >= todayISO).sort((a, b) => a.date.localeCompare(b.date))} onAddExpected={addExpected} onRemoveExpected={removeExpected} onArriveExpected={arriveExpected}
                notesKey={`ppm:notes:${currentUser?.id || "me"}:${selectedLocationId}`}
                upcomingKeyDates={keyDates.filter((k) => k.locationId === selectedLocationId && !k.done && k.date && daysUntil(k.date) <= 120).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)}
                submissionsCount={visitSubmissions.filter((x) => x.locationId === selectedLocationId).length} onReviewSubmissions={() => setShowSubmissions(true)}
                onRollCall={() => setShowRollCall(true)} onPeopleDirectory={() => setShowPeopleDir(true)}
                myActions={actions.filter((a) => a.locationId === selectedLocationId && a.status !== "done" && a.owner && a.owner === currentUser?.name)}
                myReminders={reminders.filter((r) => r.locationId === selectedLocationId && !r.done && r.assignee && r.assignee === currentUser?.name)}
                weatherSource={siteWeatherSource(locations.find((l) => l.id === selectedLocationId), (settings.siteInfo || {})[selectedLocationId], countries.find((c) => c.id === selectedCountryId)?.name)}
                site={locations.find((l) => l.id === selectedLocationId) || null} onEditSite={() => setEditLocation(locations.find((l) => l.id === selectedLocationId))}
                onCall={(settings.onCall || {})[selectedLocationId] || []} onSaveOnCall={saveOnCall}
                onPrintBriefing={() => { const w = (() => { const d = cachedWeather(siteWeatherSource(locations.find((l) => l.id === selectedLocationId), (settings.siteInfo || {})[selectedLocationId], countries.find((c) => c.id === selectedCountryId)?.name))?.days?.[0]; return d ? `${d.min}–${d.max}°C` : ""; })();
                  openPrintReport("Daily briefing", `${locationLabel({ locationId: selectedLocationId })} · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`, buildDailyBriefing({ locationName: locationLabel({ locationId: selectedLocationId }), today: { bookings: todayItems.bookings, dueUnbooked: todayItems.dueToday.map((d) => ({ ...d, supplierName: supplierById[d.supplierId]?.name })) }, permits: todayItems.permits, onSite: locSignins.filter((x) => !x.outAt), works: locWorks.filter((x) => x.priority === "high" && !["completed", "rejected"].includes(x.status)).map((x) => ({ ...x, deviceName: deviceById[x.deviceId]?.name })), reminders: todayItems.reminders, weather: w })); }}
                onWeeklyEmail={() => {
                  const wk = addDays(new Date().toISOString().slice(0, 10), -7); const nx = addDays(new Date().toISOString().slice(0, 10), 7);
                  const done = locServices.filter((v) => v.date >= wk && !v.aborted && !v.skipped); const raised = locWorks.filter((w) => w.dateRaised >= wk); const closed = locWorks.filter((w) => w.status === "completed" && (w.completedAt || "") >= wk);
                  const overdueN = locDevices.filter((d) => d.nextServiceDate && daysUntil(d.nextServiceDate) < 0); const nextWeek = locDevices.filter((d) => d.nextServiceDate && d.nextServiceDate > new Date().toISOString().slice(0, 10) && d.nextServiceDate <= nx);
                  const comp = computeCompliance(locDevices, locVisitBudgets, locServices);
                  const body = [`Weekly facilities update — ${locationLabel({ locationId: selectedLocationId })}`, `Week ending ${fmtDate(new Date().toISOString().slice(0, 10))}`, "", `PPM on time: ${comp.pct == null ? "—" : comp.pct + "%"}`, `Visits completed this week: ${done.length}`, `Overdue services: ${overdueN.length}${overdueN.length ? ` (${overdueN.slice(0, 5).map((d) => d.name).join(", ")})` : ""}`, `Reactive jobs: ${raised.length} raised, ${closed.length} completed, ${locWorks.filter((w) => !["completed", "rejected"].includes(w.status)).length} still open`, `Spend so far this year: ${gbp(spendSummary.spent)}${spendSummary.budget ? ` of ${gbp(spendSummary.budget)}` : ""}`, "", `Coming up next week (${nextWeek.length}):`, ...nextWeek.slice(0, 12).map((d) => `- ${fmtDate(d.nextServiceDate)}: ${d.name}${currentBooking(d) ? " (booked)" : ""}`), "", `Regards,`, currentUser?.name || ""].join("\n");
                  window.location.href = `mailto:?subject=${encodeURIComponent(`Weekly facilities update — ${locationLabel({ locationId: selectedLocationId })}`)}&body=${encodeURIComponent(body)}`;
                }}
                myName={currentUser?.name} myWorks={locWorks.filter((w) => w.assignee && w.assignee === currentUser?.name && !["completed", "rejected"].includes(w.status))}
                emergency={(settings.emergencyContacts || {})[selectedLocationId] || null} onSaveEmergency={saveEmergencyContacts}
                pendingCount={pendingCount} hiddenCards={display.homeHidden || []}
                todayItems={todayItems} weekAhead={weekAhead}
                notices={notices.filter((n) => n.locationId === selectedLocationId)} onSaveNotice={noticeOps.save} onDeleteNotice={noticeOps.remove}
                recentDevices={(display.recent || []).map((id) => locDevices.find((d) => d.id === id)).filter(Boolean)}
                overdueBySupplier={(() => { const m = {}; locDevices.forEach((d) => { if (d.nextServiceDate && daysUntil(d.nextServiceDate) < 0) { const k = d.supplierId || ""; m[k] = (m[k] || 0) + 1; } }); return Object.entries(m).map(([id, n]) => ({ name: supplierById[id]?.name || "No supplier", n })).sort((a, b) => b.n - a.n); })()}
                onQuick={(what) => { if (what === "visit") setTab("devices"); else if (what === "work") startJob(); else if (what === "incident") setTab("meters"); else if (what === "service") setDeviceModal({}); }}
                siteInfo={(settings.siteInfo || {})[selectedLocationId] || null} onSaveSiteInfo={saveSiteInfo}
                customStatutory={settings.customStatutory || []} onSaveCustomStatutory={saveCustomStatutory} pinnedDevices={pinnedIds.map((id) => locDevices.find((d) => d.id === id)).filter(Boolean)} onUnpin={togglePin}
                setup={{ suppliers: locSuppliers.length, devices: locDevices.length, budgets: locBudgets.length + locBudgetLines.length, visits: locServices.length, backup: !!settings.lastBackupAt || REMOTE, shared: REMOTE, hidden: !!display.hideSetup }}
                onHideSetup={() => saveDisplay({ ...display, hideSetup: true })}
                syncInfo={REMOTE ? { lastSync, syncing, onRefresh: () => refreshShared(true) } : null}
                reminders={locReminders} users={users} onAddReminder={addReminder} onToggleReminder={toggleReminder} onDeleteReminder={deleteReminder}
                onGo={(t) => t === "alerts" ? setShowAlerts(true) : setTab(t)} onOpenDevice={setHistoryFor} />
            )}
            {tab === "devices" && (
              <DevicesTab plannedLines={locBudgetLines.filter((l) => l.deviceId && l.actualAmount == null && !l.actualServiceId && l.status !== "skipped" && l.date >= new Date().toISOString().slice(0, 10))} yearByDevice={(() => { const y = String(new Date().getFullYear()); const t0 = new Date().toISOString().slice(0, 10); const m = {}; locServices.forEach((v) => { if (String(v.date).startsWith(y) && Number(v.cost) > 0) { const e = (m[v.deviceId] = m[v.deviceId] || { spent: 0, planned: 0, spentPlanned: 0 }); e.spent += Number(v.cost); } }); budgetLines.forEach((l) => { if (!l.deviceId || !String(l.date).startsWith(y) || l.status === "skipped") return; const e = (m[l.deviceId] = m[l.deviceId] || { spent: 0, planned: 0, spentPlanned: 0 }); if (l.actualAmount == null && !l.actualServiceId) { if (l.date >= t0) e.planned += Number(l.amount) || 0; } else e.spentPlanned += Number(l.amount) || 0; }); return m; })()} lastVisitByDevice={(() => { const m = {}; locServices.forEach((v) => { if (v.skipped || v.aborted) return; if (!m[v.deviceId] || String(v.date) > String(m[v.deviceId].date)) m[v.deviceId] = v; }); return m; })()} onCopySite={locations.length > 1 ? () => setShowCopySite(true) : null} spares={locSpares} onBookTogether={() => setBookTogether(true)} history={locServices} onRemindAll={recordChase} onChaseAll={recordChase} allSupplierList={locSuppliers} locationName={locationLabel({ locationId: selectedLocationId })} pinned={pinnedIds} onTogglePin={togglePin} onDataHealth={() => setShowHealth(true)} onLibrary={() => setShowLibrary(true)} faultsByDevice={faultsByDevice} onImport={() => setShowImport(true)} allLocations={locations.filter((l) => l.id !== selectedLocationId).map((l) => ({ id: l.id, label: `${countryById[l.countryId]?.name || ""} · ${l.name}` }))} onCopyTo={copyDevicesToLocation} onBulkUpdate={bulkUpdateDevices} allSuppliers={locSuppliers} archivedDevices={locArchivedDevices} onRestore={restoreDevice} onBulkLog={bulkLogVisits} onBook={saveBooking} prefs={listPrefs} onPrefs={(patch) => setListPrefs((p) => ({ ...p, ...patch }))} devices={searchAllLocations ? globalFilteredDevices : filteredDevices} search={search} setSearch={setSearch}
                onAdd={() => setDeviceModal({})} onEdit={(record) => setDeviceModal({ record })}
                onLogService={(id) => setServiceModal({ deviceId: id })} onAddWork={setAddWorkFor}
                onDelete={deleteDevice} onHistory={setHistoryFor}
                searchAllLocations={searchAllLocations} onToggleSearchAll={setSearchAllLocations}
                locationLabel={locationLabel} chaseDevices={locDevices} supplierById={supplierById}
                onChased={recordChase} currentUserName={currentUser?.name}
                onQuickLog={() => setQuickLog({})} onScan={() => setShowScanner(true)} />
            )}
            {tab === "schedule" && (
              <ScheduleCalendarTab onExportCalendar={exportCalendar} onPrintLookahead={() => openPrintReport("4-week lookahead", locationLabel({ locationId: selectedLocationId }), buildLookahead({ devices: locDevices, supplierById }))} devices={locDevices} services={locServices} tasks={locDeviceTasks}
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
              <WorksTab budgetByCat={Object.fromEntries(budgetModel({ year: new Date().getFullYear(), budgets: locBudgets, services: locServices, works: locWorks, suppliers: locSuppliers, devices: locDevices, budgetLines: locBudgetLines, costLines: costLines.filter((l) => l.locationId === selectedLocationId), bs: budgetSettingsFor() }).rows.map((r) => [r.cat, { budget: r.budget, forecast: r.forecast, label: CATEGORY_META[r.cat]?.label || r.cat }]))} initialOpenId={openJobOnLoad} onDuplicateWork={duplicateWork} onInvoiceFromWork={invoiceFromWork} onPoFromWork={poFromWork} onImportWorks={importWorks} spares={locSpares} onUseSpare={useSpareOnWork} onLogChase={logWorkChase} onRepeat={(w) => { setWorkPrefill({ description: w.description, priority: w.priority, category: w.category }); setAddWorkFor(w.deviceId); }} invoices={locInvoices} locationName={locationLabel({ locationId: selectedLocationId })} onConvertToProject={convertWorkToProject} onBulkUpdate={bulkUpdateWorks} slaWorkingDays={!!settings.slaWorkingDays} onSetSla={(v, wd) => { persist.settings({ ...settings, slaDays: v, slaWorkingDays: !!wd }); showToast("Target times saved", `High ${v.high}d · Medium ${v.medium}d · Low ${v.low}d`); }} works={locWorks} deviceById={deviceById} supplierById={supplierById} suppliers={locSuppliers}
                onUpdate={updateWork} onDelete={deleteWork} currentUserName={currentUser?.name}
                approvalThreshold={Number(settings.approvalThreshold) || 0} onSetThreshold={(v) => { persist.settings({ ...settings, approvalThreshold: v }); showToast("Approval rule saved"); }}
                onConvertToPlan={convertWorkToPlanLine} onConvertToService={convertWorkToService}
                onAdd={() => startJob()} hasDevices />
            )}
            {tab === "suppliers" && (
              <SuppliersTab onApplyUplift={ACTIVE_CAN_EDIT ? (s) => { const ids = locDevices.filter((d) => d.supplierId === s.id && !d.archived && Number(d.budgetPerVisit) > 0).map((d) => d.id); const month = s.contractEnd ? Number(String(addDays(s.contractEnd, 1)).slice(5, 7)) : 4; bulkUpdateDevices(ids, "uplift", { pct: Number(s.upliftPct), month }); } : null} onPortal={supplierPortal} onBulkEmail={() => setShowBulkEmail(true)} onImport={importSuppliers} packData={{ devices: locDevices, services: locServices, works: locWorks, invoices: locInvoices }} locationName={locationLabel({ locationId: selectedLocationId })} onFollowUpDone={setContactFollowUpDone} invoices={locInvoices} userName={currentUser?.name} onAddContact={addSupplierContact} onMerge={mergeSuppliers} suppliers={locSuppliers} onAdd={() => setSupplierModal({})} onEdit={(record) => setSupplierModal({ record })} onDelete={deleteSupplier}
                devices={locDevices} services={locServices} works={locWorks} budgetLines={locBudgetLines} visitBudgets={locVisitBudgets} />
            )}
            {tab === "budget" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <ToggleButton active={budgetView === "budget"} onClick={() => setBudgetView("budget")}>Budget</ToggleButton>
                <ToggleButton active={budgetView === "finance"} onClick={() => setBudgetView("finance")}>POs &amp; invoices{locInvoices.filter((i) => i.status === "received").length ? ` (${locInvoices.filter((i) => i.status === "received").length} to approve)` : ""}</ToggleButton>
              </div>
            )}
            {tab === "budget" && budgetView === "finance" && (
              <FinanceView costCodes={settings.costCodes || []} onSaveCostCodes={saveCostCodes} poLimit={settings.poApprovalLimit ?? null} onSavePoLimit={savePoLimit} onBulkInvoices={bulkInvoices} locationName={locationLabel({ locationId: selectedLocationId })} allSuppliers={locSuppliers} savings={savings.filter((x) => x.locationId === selectedLocationId)} onSaveSaving={savingOps.save} onDeleteSaving={savingOps.remove} userName={currentUser?.name} pos={locPOs} invoices={locInvoices} suppliers={locSuppliers} works={locWorks} deviceById={deviceById}
                onSavePO={poOps.save} onDeletePO={poOps.remove} onSaveInvoice={invOps.save} onDeleteInvoice={invOps.remove} />
            )}
            {tab === "budget" && budgetView === "budget" && (
              <BudgetTab serviceSync={(() => { const today = new Date().toISOString().slice(0, 10); const active = new Set(locDevices.filter((d) => !d.archived).map((d) => d.id)); return {
                  orphans: locBudgetLines.filter((l) => l.deviceId && !active.has(l.deviceId) && l.date >= today && l.actualAmount == null),
                  unplanned: locDevices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0 && d.nextServiceDate && !locBudgetLines.some((l) => l.deviceId === d.id && l.date >= today && l.status !== "skipped")),
                  thin: locDevices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0 && Number(d.serviceIntervalMonths) > 0 && d.nextServiceDate && locBudgetLines.some((l) => l.deviceId === d.id && l.date >= today) && !locBudgetLines.some((l) => l.deviceId === d.id && l.date >= addMonths(today, 9))),
                  yearly: locDevices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0 && Number(d.serviceIntervalMonths) >= 12),
                  noBudget: locDevices.filter((d) => !d.archived && !Number(d.budgetPerVisit) && services.some((v) => v.deviceId === d.id && Number(v.cost) > 0)),
                  onPlan: (ids, months) => planVisitsForServices(ids, months), onRemoveOrphans: removeOrphanLines, onOpen: (id) => setHistoryFor(id),
                  onSkipLines: (ids) => { const set = new Set(ids); persist.budgetLines(budgetLines.map((l) => set.has(l.id) ? { ...l, status: "skipped", actualAmount: 0, skippedReason: "Didn't happen (released from Budget → Checks)" } : l)); showToast(`${ids.length} planned visit${ids.length === 1 ? "" : "s"} released`, "Their budget no longer counts towards the forecast"); },
                  onRemoveLines: (ids) => { const set = new Set(ids); persist.budgetLines(budgetLines.filter((l) => !set.has(l.id))); showToast(`${ids.length} duplicate planned visit${ids.length === 1 ? "" : "s"} removed`); },
                  planHorizon: settings.planHorizon || "nextYear", onSavePlanHorizon: (v) => { persist.settings({ ...settings, planHorizon: v }); queuePlanCheck(devices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0).map((d) => d.id)); showToast("Plan horizon saved", "Service plans are being updated"); },
                  onCheckPlans: () => { queuePlanCheck(devices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0).map((d) => d.id)); setPlanCheckReport(true); } }; })()}
                key={CATEGORY_KEYS.join("|")} onOpenService={(id) => setHistoryFor(id)} costLines={costLines.filter((l) => l.locationId === selectedLocationId)} onSaveCostLines={saveCostLines} onDeleteCostLine={deleteCostLine} onRecordInvoice={recordCostInvoice} invoices={locInvoices} pos={locPOs} savings={savings.filter((x) => x.locationId === selectedLocationId)}
                floorArea={spaces.filter((s) => s.locationId === selectedLocationId).reduce((t, s) => t + (Number(s.areaM2) || 0), 0) || Number(((settings.siteInfo || {})[selectedLocationId] || {}).floorArea) || 0}
                budgetSettings={(settings.budgetSettings || {})[selectedLocationId] || {}} onSaveBs={saveBudgetSettings} onMoveBudget={moveBudget} onSetBudgetsBulk={setBudgetsBulk}
                onBulkUpdateLines={bulkUpdateLines} onBulkDeleteLines={bulkDeleteLines} userNames={users.map((u) => u.name)} userName={currentUser?.name} locationName={locationLabel({ locationId: selectedLocationId })}
                budgets={locBudgets} services={locServices} works={locWorks} suppliers={locSuppliers}
                devices={locDevices} budgetLines={locBudgetLines} visitBudgets={locVisitBudgets} onSetBudget={setCategoryBudget}
                subcategoriesByCategory={subcategoriesByCategory}
                onAddLines={addBudgetLines} onUpdateLine={updateBudgetLine} onDeleteLine={deleteBudgetLine}
                onApplySuggestion={applySuggestedPlan} onRollForward={rollPlanForward} shiftDateFn={(iso) => shiftFor(selectedLocationId, iso)} />
            )}
          </div>

          {tab === "devices" && ACTIVE_CAN_EDIT && (
            <button onClick={() => setDeviceModal({})} style={{
              position: "fixed", bottom: 20, right: "max(20px, calc((100vw - var(--shell-w)) / 2 + 20px))", width: 54, height: 54, borderRadius: "50%",
              background: "#D97706", color: "var(--on-accent)", border: "none", boxShadow: "0 6px 16px rgba(217,119,6,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}><Plus size={24} /></button>
          )}
          {tab === "suppliers" && ACTIVE_CAN_EDIT && (
            <button onClick={() => setSupplierModal({})} style={{
              position: "fixed", bottom: 20, right: "max(20px, calc((100vw - var(--shell-w)) / 2 + 20px))", width: 54, height: 54, borderRadius: "50%",
              background: "#D97706", color: "var(--on-accent)", border: "none", boxShadow: "0 6px 16px rgba(217,119,6,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}><Plus size={24} /></button>
          )}
        </>
      )}

      {/* Modals */}
      {showUserModal && (
        <UserSwitchModal users={users} currentUser={currentUser} onClose={() => setShowUserModal(false)}
          onChoose={(id) => { saveNav({ currentUserId: id }); setShowUserModal(false); }}
          onCreate={(name, role) => { ensureUser(name, role); setShowUserModal(false); }} locations={locations} onSaveSites={saveUserSites} />
      )}
      {showLocationPicker && (
        <LocationPickerModal countries={countries} locations={currentUser?.sites?.length ? locations.filter((l) => currentUser.sites.includes(l.id)) : locations} onClose={() => setShowLocationPicker(false)}
          devices={devices.filter((d) => !d.archived)} onChoose={chooseLocation} onAddCountry={() => setShowAddCountry(true)} onAddLocation={(cid) => setShowAddLocation(cid)}
          onEditLocation={(l) => setEditLocation(l)} onEditCountry={(c) => setEditCountryFor(c)} />
      )}
      {showAddCountry && <AddCountryModal onClose={() => setShowAddCountry(false)} onSave={addCountry} />}
      {editCountryFor && <AddCountryModal existing={editCountryFor} onClose={() => setEditCountryFor(null)} onSave={(name, cur) => editCountry(editCountryFor.id, name, cur)} />}
      {showAddLocation && <AddLocationModal countryId={showAddLocation} countries={countries} onClose={() => setShowAddLocation(null)} onSave={addLocation} />}
      {editLocation && <AddLocationModal existing={editLocation} countryId={editLocation.countryId} countries={countries} onClose={() => setEditLocation(null)} onSave={addLocation} onDelete={deleteLocation}
        canDelete={!devices.some((d) => d.locationId === editLocation.id) && !suppliers.some((s) => s.locationId === editLocation.id)} />}
      {deviceModal && (
        <AddDeviceModal plannedCount={deviceModal?.record ? budgetLines.filter((l) => l.deviceId === deviceModal.record.id && l.actualAmount == null && !l.actualServiceId && l.status !== "skipped" && l.date >= new Date().toISOString().slice(0, 10)).length : 0} siblingNames={devices.filter((d) => !d.archived && d.locationId === selectedLocationId && d.id !== deviceModal?.record?.id).map((d) => d.name)} allTags={devices.map((d) => d.assetTag).filter(Boolean)} budgetHeadByCat={Object.fromEntries(budgetModel({ year: new Date().getFullYear(), budgets: locBudgets, services: locServices, works: locWorks, suppliers: locSuppliers, devices: locDevices, budgetLines: locBudgetLines, costLines: costLines.filter((l) => l.locationId === selectedLocationId), bs: (settings.budgetSettings || {})[selectedLocationId] || {} }).rows.map((r) => [r.cat, r]))} key={deviceModal.record?.id || (deviceModal.prefill ? `copy-${deviceModal.prefill.name}` : "new-device")}
          onPause={(id, until, drop) => { bulkUpdateDevices([id], "pause", { until, drop }); setDeviceModal(null); }}
          onResume={(id) => { bulkUpdateDevices([id], "resume"); setDeviceModal(null); }}
          onArchive={archiveDevice} prefill={deviceModal.prefill} onDuplicate={(dev) => { setDeviceModal(null); setTimeout(() => duplicateDevice(dev), 0); }} countries={countries} locations={locations} defaultLocationId={selectedLocationId}
          existing={deviceModal.record} subcategoriesByCategory={subcategoriesByCategory} suppliers={suppliers} onClose={() => setDeviceModal(null)} onSave={saveDevice}
          onDelete={(id) => { deleteDevice(id); setDeviceModal(null); }} />
      )}
      {serviceModal && (
        <LogServiceModal key={serviceModal.record?.id || `new-${serviceModal.deviceId}`}
          overspendPct={Number(budgetSettingsFor().overspendApprovalPct) || 0}
          planLine={(() => { const rec = serviceModal.record; const mine = budgetLines.filter((l) => l.deviceId === serviceModal.deviceId && l.status !== "skipped"); if (rec?.id) return mine.find((l) => l.actualServiceId === rec.id) || null; const due = deviceById[serviceModal.deviceId]?.nextServiceDate; if (!due) return null; const t = (x) => new Date(x + "T00:00:00").getTime(); return mine.filter((l) => l.actualAmount == null && !l.actualServiceId && Math.abs(t(l.plannedFor || l.date) - t(due)) <= 45 * 864e5).sort((a, b) => Math.abs(t(a.plannedFor || a.date) - t(due)) - Math.abs(t(b.plannedFor || b.date) - t(due)))[0] || null; })()}
          spares={locSpares}
          onVerify={verifyVisit}
          lastVisit={locServices.filter((v) => v.deviceId === serviceModal.deviceId && !v.aborted && !v.skipped && v.id !== serviceModal.record?.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null}
          locationName={locationLabel({ locationId: deviceById[serviceModal.deviceId]?.locationId })}
          device={deviceById[serviceModal.deviceId]} existing={serviceModal.record} suppliers={locSuppliers} openPermits={locPermits.filter((x) => x.status === "open" && (!x.deviceId || x.deviceId === serviceModal.deviceId))}
          visitBudgets={visitBudgets.filter((v) => v.deviceId === serviceModal.deviceId)}
          onClose={() => setServiceModal(null)} onSave={saveService} onDelete={deleteService} />
      )}
      {historyFor && (
        <DeviceHistoryModal plannedLines={budgetLines.filter((l) => l.deviceId === historyFor && l.actualAmount == null && !l.actualServiceId && l.status !== "skipped" && l.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))} budgetInfo={(() => { const d = deviceById[historyFor]; if (!d) return null; const yr = String(new Date().getFullYear()); const today = new Date().toISOString().slice(0, 10); const ls = budgetLines.filter((l) => l.deviceId === d.id && String(l.date).startsWith(yr)); const spent = services.filter((v) => v.deviceId === d.id && String(v.date).startsWith(yr) && Number(v.cost)).reduce((t, v) => t + Number(v.cost), 0); const next = budgetLines.filter((l) => l.deviceId === d.id && l.date >= today && l.actualAmount == null && l.status !== "skipped").sort((a, b) => a.date.localeCompare(b.date)); return { planned: ls.filter((l) => l.status !== "skipped").reduce((t, l) => t + (Number(l.amount) || 0), 0), spent, skipped: ls.filter((l) => l.status === "skipped").length, future: next.length, next: next[0], perVisit: Number(d.budgetPerVisit) || 0 }; })()} onRebuildPlan={ACTIVE_CAN_EDIT ? () => rebuildServicePlan(historyFor) : null} changeLog={activity.filter((a) => deviceById[historyFor] && String(a.text).includes(deviceById[historyFor].name)).slice(0, 30)} spares={locSpares.filter((sp) => (sp.deviceIds || []).includes(historyFor))} onMerge={ACTIVE_CAN_EDIT ? () => setMergeFor(historyFor) : null} onRecordUsage={(h) => recordUsage(historyFor, h)} allDevices={locAllDevices} onOutOfService={(down, reason) => setOutOfService(historyFor, down, reason)} works={locWorks.filter((w) => w.deviceId === historyFor)} onAddNote={(text) => addDeviceNote(historyFor, text)} onDeleteNote={(nid) => deleteDeviceNote(historyFor, nid)} supplierById={supplierById} locationName={locationLabel({ locationId: deviceById[historyFor]?.locationId })} device={deviceById[historyFor]} services={services.filter((s) => s.deviceId === historyFor)}
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
        <AddWorkModal jobTemplates={settings.jobTemplates || null} onSaveJobTemplates={saveJobTemplates} openWorks={locWorks.filter((w) => !["completed", "rejected"].includes(w.status))} prefill={workPrefill} devices={locDevices} suppliers={locSuppliers} defaultDeviceId={addWorkFor} onClose={() => { setAddWorkFor(null); setWorkPrefill(null); }} onSave={addWork} />
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
      {showTv && <TvDashboard locationName={locationLabel({ locationId: selectedLocationId })} onClose={() => setShowTv(false)} stats={{ pct: computeCompliance(locDevices, locVisitBudgets, locServices).pct, overdue: locDevices.filter((d) => d.nextServiceDate && daysUntil(d.nextServiceDate) < 0).length, openWorks: locWorks.filter((w) => !["completed", "rejected"].includes(w.status)).length, late: locWorks.filter((w) => !["completed", "rejected", "on_hold"].includes(w.status) && workSla(w)?.breached).length, onSite: locSignins.filter((x) => !x.outAt).length, today: [...todayItems.bookings.map((d) => ({ time: d.booking?.time, text: `${d.name}${d.supplierName ? ` — ${d.supplierName}` : ""}` })), ...todayItems.dueToday.map((d) => ({ time: "", text: `${d.name} (due)` }))].slice(0, 8), notices: notices.filter((n) => n.locationId === selectedLocationId && (!n.until || n.until >= new Date().toISOString().slice(0, 10)) && (!n.from || n.from <= new Date().toISOString().slice(0, 10))).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).slice(0, 5).map((n) => n.text) }} />}
      {!["home", "devices", "suppliers"].includes(tab) && ACTIVE_CAN_EDIT && ( /* Services and Suppliers have their own + button in this corner */
        <div style={{ position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 900, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {fabOpen && [["Log a visit", () => setQuickLog({})], ["Raise a job", () => startJob()], ["Add a service", () => setDeviceModal({})], ["Search", () => setShowSearch(true)], ["Go to Home", () => setTab("home")]].map(([l, fn]) => (
            <button key={l} onClick={() => { setFabOpen(false); fn(); }} style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 20, padding: "9px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--shadow)" }}>{l}</button>
          ))}
          <button aria-label="Quick add" onClick={() => setFabOpen((v) => !v)} style={{ width: 52, height: 52, borderRadius: 26, background: "var(--accent)", color: "var(--on-accent)", border: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transform: fabOpen ? "rotate(45deg)" : "none", transition: "transform .15s" }}><Plus size={24} /></button>
        </div>
      )}
      {showSubmissions && <SubmissionsModal submissions={visitSubmissions.filter((x) => x.locationId === selectedLocationId)} deviceById={deviceById} onClose={() => setShowSubmissions(false)} onAccept={acceptSubmission} onReject={rejectSubmission} />}
      {showRollCall && <RollCallModal onSite={locSignins.filter((x) => !x.outAt)} staff={(locations.find((l) => l.id === selectedLocationId) || {}).staff || []} onClose={() => setShowRollCall(false)} />}
      {showBulkEmail && <BulkEmailModal suppliers={locSuppliers} locationName={locationLabel({ locationId: selectedLocationId })} onClose={() => setShowBulkEmail(false)} />}
      {showPeopleDir && <PeopleDirectoryModal locations={locations} onClose={() => setShowPeopleDir(false)} />}
      {showCopySite && <CopySiteModal locations={locations} countries={countries} devices={devices} suppliers={suppliers} currentId={selectedLocationId} onClose={() => setShowCopySite(false)} onCopy={copySite} />}
      {bookTogether && <BookTogetherModal devices={locDevices} suppliers={locSuppliers} onClose={() => setBookTogether(false)} onBook={(ids, b) => { bookMany(ids, b); setBookTogether(false); }} />}
      {mergeFor && deviceById[mergeFor] && <MergeServiceModal device={deviceById[mergeFor]} devices={locDevices} onClose={() => setMergeFor(null)} onMerge={mergeDevices} />}
      {actionDraft && <ActionModal existing={actionDraft} people={[...new Set([...users.map((u) => u.name), ...((locations.find((l) => l.id === selectedLocationId) || {}).staff || []).map((p) => p.name)])]} onClose={() => setActionDraft(null)} onSave={(a) => { actionOps.save(a); setActionDraft(null); showToast("Added to the action tracker", "Site → Actions"); }} onDelete={() => setActionDraft(null)} />}
      {showImport && <ImportModal areas={AREA_SUGGESTIONS_CACHE[selectedLocationId] || []} locationName={locationLabel({ locationId: selectedLocationId })} suppliers={locSuppliers} existing={locAllDevices} onClose={() => setShowImport(false)} onImport={(rows) => { importDevices(rows); setShowImport(false); }} />}
      {showSearch && (
        <GlobalSearchModal extra={{ keyDates: keyDates.filter((k) => k.locationId === selectedLocationId), cars: carPark.filter((c) => c.locationId === selectedLocationId), supContacts: locSuppliers.flatMap((s) => (s.contacts || []).map((c) => ({ ...c, supplier: s.name }))), people: ((locations.find((l) => l.id === selectedLocationId) || {}).staff || []), spaces: spaces.filter((x) => x.locationId === selectedLocationId), actions: actions.filter((x) => x.locationId === selectedLocationId), coshh: coshh.filter((x) => x.locationId === selectedLocationId), equipment: equipment.filter((x) => x.locationId === selectedLocationId), asbestos: asbestos.filter((x) => x.locationId === selectedLocationId), incidents: locIncidents, permits: locPermits, pos: locPOs, invoices: locInvoices, spares: locSpares, keys: locKeys, projects: locProjects }} onGoTab={(t) => { setShowSearch(false); setTab(t); }} devices={locDevices} services={locServices} works={locWorks} suppliers={locSuppliers} deviceById={deviceById} onClose={() => setShowSearch(false)}
          onOpenDevice={(id) => { setShowSearch(false); setHistoryFor(id); }}
          onOpenVisit={(v) => { setShowSearch(false); setServiceModal({ deviceId: v.deviceId, record: v }); }}
          onOpenWork={() => { setShowSearch(false); setTab("works"); }}
          onOpenSupplier={(sup) => { setShowSearch(false); setTab("suppliers"); if (ACTIVE_CAN_EDIT) setSupplierModal({ record: sup }); }} />
      )}
      {showData && (
        <DataModal branding={settings.branding || {}} onSaveBranding={saveBranding} trash={trash.filter((t) => !t.locationId || t.locationId === selectedLocationId)} onRestoreDeleted={restoreFromTrash} users={users} alertCount={visibleAlerts.filter((a) => a.tone !== "info").length} pendingCount={pendingCount} remote={REMOTE} display={display} onDisplay={saveDisplay} activity={activity.filter((a) => !a.locationId || a.locationId === selectedLocationId)} storageInfo={storageInfo}
          saveErrors={saveErrors} lastBackupAt={settings.lastBackupAt} canEdit={ACTIVE_CAN_EDIT}
          onBackup={downloadBackup} onRestore={restoreBackup} onClose={() => setShowData(false)} />
      )}
      {showAlerts && <AlertsModal onSnoozeAll={(keys) => snoozeMany(keys, 1)} snoozedCount={snoozedCount} onSnooze={snoozeAlert} onClearSnoozes={clearSnoozes} locationName={locationLabel({ locationId: selectedLocationId })} senderName={currentUser?.name} alerts={visibleAlerts} onClose={() => setShowAlerts(false)} onGo={(t) => { setTab(t); setShowAlerts(false); }} />}
      {showReports && <ReportsModal onClose={() => setShowReports(false)} locationName={locationLabel({ locationId: selectedLocationId })}
        data={{ overspendPct: Number(budgetSettingsFor().overspendApprovalPct) || 0, outlets: locOutlets, spaces: spaces.filter((x) => x.locationId === selectedLocationId), tenants: (locations.find((l) => l.id === selectedLocationId) || {}).tenants || [], feedback: feedback.filter((f) => f.locationId === selectedLocationId), meters: locMeters, readings: locReadings, invoices: locInvoices, savings: savings.filter((x) => x.locationId === selectedLocationId), waste: locWaste, portfolio: { locations, countries, devices, services, works, budgets, visitBudgets }, settingsFields: settings, incidents: locIncidents, audits: locAudits, signins: locSignins, faultsByDevice, deviceTasks: locDeviceTasks, devices: locDevices, services: locServices, works: locWorks, suppliers: locSuppliers, budgets: locBudgets, budgetLines: locBudgetLines, visitBudgets: locVisitBudgets, deviceById, supplierById }} />}
      {supplierModal && (
        <AddSupplierModal key={supplierModal.record?.id || "new-supplier"} existing={supplierModal.record}
          subcategoriesByCategory={subcategoriesByCategory} onClose={() => setSupplierModal(null)}
          onSave={saveSupplier} onDelete={deleteSupplier} />
      )}
      {toast && (
        <div style={{
          position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", background: "var(--head)", color: "var(--on-accent)",
          padding: toast.undo ? "6px 6px 6px 16px" : "9px 16px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          zIndex: 60, whiteSpace: "nowrap", pointerEvents: toast.undo ? "auto" : "none", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>{toast.msg}</span>
          {toast.undo && ACTIVE_CAN_EDIT && (
            <button onClick={undoLast} style={{ background: "#D97706", color: "var(--on-accent)", border: "none", borderRadius: 14, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <Undo2 size={13} /> Undo
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
