// App-wide pop-ups: people, locations, search, activity/backup/sharing, alerts, reports, settings.
import { useState, useMemo, useRef } from "react";
import { AlertTriangle, Bell, BellOff, Building2, CheckCircle2, ChevronDown, ChevronRight, Cloud, CloudOff, Download, FileText, Globe2, HardDrive, LayoutDashboard, Lock, Mail, Moon, Plus, Printer, Search, Smartphone, Sparkles, Trash2, Type, Upload } from "lucide-react";
import { Badge, EmptyState, ExportButton, Field, Modal, PrimaryButton, Select, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { AUTH_SQL, BUILTIN_TEMPLATES, COLOR_CHOICES, CURRENCIES, HELP_TOPICS, HOME_CARDS, INCIDENT_TYPES, MONTH_LABELS, SETUP_SQL, WHATS_NEW, authSql } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, BUILTIN_CATEGORY_META, CATEGORY_ICONS, CATEGORY_KEYS, CATEGORY_META } from "../lib/globals.js";
import { buildAssetRegister, buildComplianceReport, buildConditionReport, buildJobSheet, buildLifecycleReport, buildManagementReport, buildPortfolioReport, buildSpendReport, buildSupplierReport, downloadWorkbook, openPrintReport } from "../lib/reports.js";
import { addDays, daysUntil, fmtDate, gbp, relativeDays, replacementYear, uid } from "../lib/utils.js";
import { AccountingExport } from "../tabs/BudgetTab.jsx";

/* ---------------------------------------------------------
   User & Location setup modals
--------------------------------------------------------- */
export function UserSwitchModal({ users, currentUser, onClose, onChoose, onCreate }) {
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

export function LocationPickerModal({ devices = [], countries, locations, onClose, onChoose, onAddCountry, onAddLocation }) {
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

export function AddCountryModal({ onClose, onSave }) {
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

export function AddLocationModal({ countryId, onClose, onSave }) {
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
   Search everything — services, visits, works and suppliers
--------------------------------------------------------- */
export function GlobalSearchModal({ extra = {}, onGoTab, devices, services, works, suppliers, deviceById, onClose, onOpenDevice, onOpenVisit, onOpenWork, onOpenSupplier }) {
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
      other: [
        ...(extra.incidents || []).filter((i) => hit(i.description, i.area, i.claimRef, INCIDENT_TYPES[i.type])).map((i) => ({ k: `i-${i.id}`, title: `Incident — ${INCIDENT_TYPES[i.type]}`, sub: `${fmtDate(i.date)} · ${i.description}`, tab: "meters" })),
        ...(extra.permits || []).filter((p) => hit(p.ref, p.type, p.contractor, p.company, p.description)).map((p) => ({ k: `p-${p.id}`, title: `Permit ${p.ref} — ${p.type}`, sub: `${p.contractor || ""} · ${p.status}`, tab: "meters" })),
        ...(extra.pos || []).filter((p) => hit(p.number, p.description, p.costCode)).map((p) => ({ k: `po-${p.id}`, title: `PO ${p.number}`, sub: `${p.description || ""} · ${gbp(p.value)}`, tab: "budget" })),
        ...(extra.invoices || []).filter((i) => hit(i.number, i.notes, i.costCode)).map((i) => ({ k: `in-${i.id}`, title: `Invoice ${i.number}`, sub: `${gbp(i.amount)} · ${i.status}`, tab: "budget" })),
        ...(extra.spares || []).filter((s) => hit(s.name, s.partNo, s.store)).map((s) => ({ k: `sp-${s.id}`, title: `Spare — ${s.name}`, sub: `${s.qty} in stock${s.store ? ` · ${s.store}` : ""}`, tab: "meters" })),
        ...(extra.keys || []).filter((k) => hit(k.label, k.number, k.opens, k.holder)).map((k) => ({ k: `k-${k.id}`, title: `Key — ${k.label}`, sub: k.holder ? `with ${k.holder}` : "in", tab: "meters" })),
        ...(extra.projects || []).filter((p) => hit(p.name, p.notes)).map((p) => ({ k: `pr-${p.id}`, title: `Project — ${p.name}`, sub: p.status, tab: "works" })),
      ].slice(0, 20),
    };
  }, [query, devices, services, works, suppliers]);
  const total = res ? res.devices.length + res.visits.length + res.works.length + res.suppliers.length + res.other.length : 0;
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
        {res && section("Other records", res.other.map((o) => row(o.k, o.title, o.sub, () => onGoTab?.(o.tab))))}
        {res && section("Suppliers", res.suppliers.map((s) => row(`s-${s.id}`, s.name, [s.managerName, s.managerEmail, s.contractRef].filter(Boolean).join(" · "), () => onOpenSupplier(s))))}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Activity log, backup & restore, storage usage
--------------------------------------------------------- */
export function DataModal({ trash = [], onRestoreDeleted, alertCount = 0, pendingCount = 0, remote = false, display = { scale: 1 }, onDisplay, activity, storageInfo, saveErrors, lastBackupAt, canEdit, onBackup, onRestore, onClose }) {
  const [view, setView] = useState("activity");
  const [filter, setFilter] = useState("");
  const [who, setWho] = useState("");
  const [range, setRange] = useState("all");
  const [pending, setPending] = useState(null); // parsed backup waiting for confirmation
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const since = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
  const people = [...new Set(activity.map((a) => a.by).filter(Boolean))].sort();
  const shown = activity.filter((a) => (!filter.trim() || `${a.text} ${a.by}`.toLowerCase().includes(filter.trim().toLowerCase())) && (!who || a.by === who) && (!since || new Date(a.at).getTime() >= since));
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
        <div style={{ display: "flex", gap: 6 }}>{tabBtn("activity", "Activity log")}{tabBtn("backup", "Backup & storage")}{tabBtn("display", "Display")}{tabBtn("sharing", "Sharing")}{tabBtn("deleted", `Deleted${trash.length ? ` (${trash.length})` : ""}`)}</div>
        {view === "deleted" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#5B6672" }}>Services, works and suppliers deleted in the last 30 days. Restoring a service brings back its visits, works and plan too.</div>
            {trash.length === 0 && <div style={{ fontSize: 12.5, color: "#8A94A0", textAlign: "center", padding: 16 }}>Nothing deleted recently.</div>}
            {trash.map((t) => (
              <div key={t.trashId} style={{ background: "#F7F8F9", borderRadius: 9, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.8, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#8A94A0" }}>{t.type === "service" ? "Service" : t.type === "work" ? "Work" : "Supplier"} · deleted {relativeDays(t.deletedAt)}{t.by ? ` by ${t.by}` : ""}</div>
                </div>
                {canEdit && <button onClick={() => onRestoreDeleted?.(t)} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Restore</button>}
              </div>
            ))}
          </div>
        )}
        {view === "sharing" && <SharingPanel remote={remote} />}
        {view === "display" && (
          <div style={{ background: "#F7F8F9", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Type size={14} /> Text size</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[[1, "Normal"], [1.12, "Large"], [1.25, "Extra large"]].map(([v, label]) => (
                <ToggleButton key={v} active={(display.scale || 1) === v} onClick={() => onDisplay?.({ ...display, scale: v })}>{label}</ToggleButton>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><LayoutDashboard size={14} /> Home screen cards</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {HOME_CARDS.map(([k, label]) => {
                const on = !(display.homeHidden || []).includes(k);
                return <ToggleButton key={k} active={on} onClick={() => onDisplay?.({ ...display, homeHidden: on ? [...(display.homeHidden || []), k] : (display.homeHidden || []).filter((x) => x !== k) })}>{label}</ToggleButton>;
              })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><Bell size={14} /> Daily notification</div>
            {typeof Notification === "undefined" ? (
              <div style={{ fontSize: 11.5, color: "#8A94A0" }}>This browser doesn't support notifications.</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6 }}>
                  <ToggleButton active={!display.notify} onClick={() => onDisplay?.({ ...display, notify: false })}>Off</ToggleButton>
                  <ToggleButton active={!!display.notify} onClick={async () => { let perm = Notification.permission; if (perm === "default") { try { perm = await Notification.requestPermission(); } catch (e) { /* */ } } onDisplay?.({ ...display, notify: perm === "granted", lastNotified: null }); }}>On</ToggleButton>
                </div>
                <div style={{ fontSize: 11.5, color: "#8A94A0" }}>{Notification.permission === "denied" ? "Notifications are blocked for this site in your browser settings." : `When you open the app, get one notification a day summarising urgent items${alertCount ? ` (currently ${alertCount})` : ""}. Works best when the app is installed on your phone.`}</div>
              </>
            )}
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
              <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search actions" style={{ flex: 1, minWidth: 0 }} />
              <select value={who} onChange={(e) => setWho(e.target.value)} style={{ ...inputStyle, width: 100, padding: "8px 6px", fontSize: 12 }}><option value="">Everyone</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              <select value={range} onChange={(e) => setRange(e.target.value)} style={{ ...inputStyle, width: 90, padding: "8px 6px", fontSize: 12 }}><option value="all">Any time</option><option value="1">Today</option><option value="7">7 days</option><option value="30">30 days</option></select>
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

export function SharingPanel({ remote }) {
  const helper = typeof window !== "undefined" ? window.ppmRemote : null;
  const cfg = helper?.config || null;
  const envMode = !!helper?.envMode;
  const AUTH_SQL = authSql(envMode ? "kv_store" : "ppm_store");
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
          <div style={{ fontSize: 12, color: "#3A4451" }}>{envMode ? <>Connected through your Vercel settings to <b>{cfg?.url?.replace(/^https?:\/\//, "")}</b> (table kv_store). Everyone who opens the site sees the same data — nothing to set up on other devices.</> : <>Everyone connected to <b>{cfg?.url?.replace(/^https?:\/\//, "")}</b> (space "{cfg?.space || "default"}") sees the same services, visits, suppliers and budgets.</>} Changes from others appear within a minute, or when you come back to the app.</div>
        </div>
        {!envMode && (<>
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Connect another phone or computer</div>
          <div style={{ fontSize: 12, color: "#5B6672" }}>Open the app on the other device → 🕘 → Sharing → paste this setup code. Only share it with your team — anyone with it can see and change the data.</div>
          <TextArea readOnly value={setupCode} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
          <button onClick={() => copy(setupCode, "code")} style={{ background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copied === "code" ? "Copied ✓" : "Copy setup code"}</button>
        </div>
        </>)}
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
              <li>{envMode ? "Ask each colleague to open the site and create their own account." : "Copy the new setup code and share it; each colleague creates their own account."}</li>
              <li>When everyone is in, run this SQL in Supabase so nobody can get in without signing in. Afterwards, turn off "Allow new users to sign up" under Authentication → Settings.</li>
            </ol>
            <TextArea readOnly value={AUTH_SQL} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => copy(AUTH_SQL, "auth")} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit" }}>{copied === "auth" ? "Copied ✓" : "Copy SQL"}</button>
              <button onClick={() => { helper.setAuthRequired(true); window.location.reload(); }} style={{ flex: 1, background: "#2B4562", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Turn on logins</button>
            </div>
          </div>
        )}
        {!envMode && <button disabled={busy} onClick={disconnect} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><CloudOff size={13} /> Disconnect this device (keeps a copy here)</button>}
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
   Notification centre
--------------------------------------------------------- */
export function AlertsModal({ alerts, onClose, onGo, locationName = "", senderName = "", onSnooze, snoozedCount = 0, onClearSnoozes }) {
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

export function ReportsModal({ data, locationName, onClose }) {
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
    ...(data.portfolio && data.portfolio.locations.length > 1 ? [{ title: "Portfolio — all sites", desc: "Every site side by side: services, overdue, PPM on time, open works and spend against budget.", go: () => run("Portfolio — all sites", `${data.portfolio.locations.length} sites · ${fmtDate(new Date().toISOString().slice(0, 10))}`, buildPortfolioReport(data.portfolio)) }] : []),
    { title: "Condition survey", desc: "Every asset's condition grade (A–D) and criticality, with an 'act now' list of failing or poor critical assets.", go: () => run("Condition survey", `${locationName} · ${data.devices.length} assets`, buildConditionReport(data)) },
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

export function SettingsModal({ settings, devices, usage, onClose, onSave }) {
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

// Checks the services register for gaps that stop alerts, budgets or reports working properly.
export function DataHealthModal({ devices, suppliers, onClose, onEdit }) {
  const checks = [
    { key: "due", label: "No next due date", why: "won't appear in the schedule or overdue alerts", test: (d) => !d.nextServiceDate && !d.pausedUntil },
    { key: "supplier", label: "No supplier", why: "chase emails and work orders can't be addressed", test: (d) => !d.supplierId && suppliers.length > 0 },
    { key: "budget", label: "No budget per visit", why: "spend and the year-end forecast will be understated", test: (d) => !Number(d.budgetPerVisit) },
    { key: "checklist", label: "No checklist", why: "visits can't record pass/fail checks", test: (d) => !(d.checklist || []).length },
    { key: "tag", label: "No asset tag", why: "harder to match QR stickers and invoices", test: (d) => !d.assetTag },
    { key: "condition", label: "No condition grade", why: "not included in the condition survey", test: (d) => !d.condition },
    { key: "life", label: "No install date / expected life", why: "not included in the replacement forecast", test: (d) => !replacementYear(d) },
  ];
  const [open, setOpen] = useState(null);
  const score = devices.length ? Math.round((1 - checks.slice(0, 3).reduce((t, c) => t + devices.filter(c.test).length, 0) / (devices.length * 3)) * 100) : 100;
  return (
    <Modal title="Data quality check" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, color: "#5B6672" }}>Core data complete: <b style={{ color: score >= 90 ? "#2F855A" : score >= 70 ? "#B7791F" : "#C53030", fontSize: 16 }}>{score}%</b> <span style={{ fontSize: 11.5 }}>(due dates, suppliers and budgets across {devices.length} services)</span></div>
        {checks.map((c) => {
          const bad = devices.filter(c.test);
          return (
            <div key={c.key} style={{ background: "#F7F8F9", borderRadius: 9, padding: "8px 10px" }}>
              <button onClick={() => setOpen(open === c.key ? null : c.key)} disabled={!bad.length} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: bad.length ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
                {bad.length ? <AlertTriangle size={15} color="#B7791F" /> : <CheckCircle2 size={15} color="#2F855A" />}
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 650 }}>{c.label}: {bad.length}</div>{bad.length > 0 && <div style={{ fontSize: 11, color: "#8A94A0" }}>These {c.why}.</div>}</div>
                {bad.length > 0 && <ChevronDown size={14} color="#8A94A0" style={{ transform: open === c.key ? "rotate(180deg)" : "none" }} />}
              </button>
              {open === c.key && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                  {bad.slice(0, 40).map((d) => (
                    <button key={d.id} onClick={() => ACTIVE_CAN_EDIT && onEdit(d)} style={{ display: "flex", justifyContent: "space-between", background: "#fff", border: "1px solid #E1E4E8", borderRadius: 7, padding: "6px 8px", fontSize: 12.3, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <span>{d.name}</span>{ACTIVE_CAN_EDIT && <span style={{ color: "#2B4562", fontWeight: 650 }}>Fix</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
export function ShortcutsModal({ onClose }) {
  const list = [["/", "Search everything"], ["N", "Add a new service"], ["H", "Home"], ["S", "Services"], ["W", "Works"], ["A", "Notifications"], ["?", "This list"], ["Esc", "Close a pop-up"]];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <kbd style={{ minWidth: 34, textAlign: "center", background: "#EEF0F2", border: "1px solid #D7DCE1", borderBottomWidth: 2, borderRadius: 6, padding: "3px 7px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{k}</kbd>{v}
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: "#8A94A0", marginTop: 6 }}>Shortcuts work on a computer when you're not typing in a box.</div>
      </div>
    </Modal>
  );
}

export function HelpModal({ onClose }) {
  const [q, setQ] = useState(""); const [tab, setTab] = useState("help");
  const topics = HELP_TOPICS.filter(([t, b]) => !q.trim() || `${t} ${b}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Modal title="Help" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={tab === "help"} onClick={() => setTab("help")}>How do I…</ToggleButton>
          <ToggleButton active={tab === "new"} onClick={() => setTab("new")}>What's new</ToggleButton>
        </div>
        {tab === "help" && (
          <>
            <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help, e.g. booking, backup, budget" />
            {topics.map(([t, b]) => (
              <div key={t} style={{ background: "#F7F8F9", borderRadius: 9, padding: "9px 11px" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t}</div>
                <div style={{ fontSize: 12.5, color: "#3A4451", marginTop: 2, lineHeight: 1.45 }}>{b}</div>
              </div>
            ))}
            {topics.length === 0 && <div style={{ fontSize: 12.5, color: "#8A94A0", textAlign: "center", padding: 12 }}>No help topics match "{q}".</div>}
          </>
        )}
        {tab === "new" && WHATS_NEW.map(([t, b]) => (
          <div key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Sparkles size={14} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>{t}</div><div style={{ fontSize: 12.3, color: "#5B6672" }}>{b}</div></div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
