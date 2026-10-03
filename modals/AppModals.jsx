// App-wide pop-ups: people, locations, search, activity/backup/sharing, alerts, reports, settings.
import { useState, useMemo, useRef } from "react";
import { AlertTriangle, Bell, BellOff, Building2, CheckCircle2, ChevronDown, ChevronRight, Cloud, CloudOff, CloudSun, Download, FileText, Globe2, HardDrive, LayoutDashboard, Lock, Mail, MapPin, Moon, Palette, Pencil, Plus, Printer, Search, Smartphone, Sparkles, Trash2, Type, Upload, X } from "lucide-react";
import { Badge, ConfirmTextDelete, EmptyState, ExportButton, Field, Modal, PhotoStrip, PrimaryButton, Select, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { ACCENTS, ALERT_GROUPS, AUTH_SQL, BUILTIN_TEMPLATES, COLOR_CHOICES, CURRENCIES, HELP_TOPICS, HOME_CARDS, INCIDENT_TYPES, MONTH_LABELS, SETUP_SQL, SITE_TYPES, STAFF_ROLES, START_TABS, STATUTORY_ITEMS, WHATS_NEW, authSql } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, BUILTIN_CATEGORY_META, CATEGORY_ICONS, CATEGORY_KEYS, CATEGORY_META } from "../lib/globals.js";
import { buildAssetRegister, buildCarbonReport, buildCommittedSpend, buildComplianceReport, buildConditionReport, buildContractCalendar, buildContractorHours, buildIncidentTrend, buildJobSheet, buildLifecycleReport, buildManagementReport, buildMonthCalendar, buildPortfolioReport, buildReactiveVsPlanned, buildRecharges, buildRepeatFaults, buildResponseTimes, buildSlaReport, buildSpendReport, buildStatutoryCalendar, buildSupplierCompliance, buildSupplierLeague, buildSupplierReport, buildSupplierSpend, buildVatSummary, buildWallPlanner, buildWorksAgeing, buildWorstAssets, buildYearReview, downloadWorkbook, openPrintReport } from "../lib/reports.js";
import { addDays, compressImage, countryCodeFor, daysUntil, downloadBlob, findPostcode, fmtDate, gbp, placeFromCoords, placeFromPostcode, relativeDays, replacementYear, searchPlaces, uid } from "../lib/utils.js";
import { AccountingExport } from "../tabs/BudgetTab.jsx";
import { THEMES } from "../lib/theme.js";
import { buildStyledSheet, excelColour, xlsxBlob } from "../lib/excelTemplate.js";
import { CustomFieldsEditor } from "../tabs/MoreViews.jsx";

/* ---------------------------------------------------------
   User & Location setup modals
--------------------------------------------------------- */
export function UserSwitchModal({ users, currentUser, onClose, onChoose, onCreate, locations = [], onSaveSites }) {
  const [name, setName] = useState("");
  const [sitesFor, setSitesFor] = useState("");
  const [role, setRole] = useState("admin");
  return (
    <Modal title="Profile" onClose={onClose}>
      {users.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {users.map((u) => (
            <button key={u.id} onClick={() => onChoose(u.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9,
              border: "1px solid " + (currentUser?.id === u.id ? "#2B4562" : "#E1E4E8"),
              background: currentUser?.id === u.id ? "#F1F4F7" : "var(--card)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{u.name}{u.lastActive && <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--faint)" }}>Last active {u.lastActive === new Date().toISOString().slice(0, 10) ? "today" : relativeDays(u.lastActive)}</span>}</span>
              {u.role === "viewer" && <Badge tone="muted">Viewer</Badge>}
            </button>
          ))}
        </div>
      )}
      {onSaveSites && locations.length > 1 && users.length > 0 && currentUser?.role !== "viewer" && (
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Which sites does each person see?</div>
          <select value={sitesFor} onChange={(e) => setSitesFor(e.target.value)} style={{ ...inputStyle, fontSize: 12.5 }}><option value="">Choose a person…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.sites?.length ? ` (${u.sites.length} site${u.sites.length === 1 ? "" : "s"})` : " (all sites)"}</option>)}</select>
          {sitesFor && (() => { const u = users.find((x) => x.id === sitesFor); const cur = u?.sites || []; return (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {locations.map((l) => <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}><input type="checkbox" checked={!cur.length || cur.includes(l.id)} onChange={(e) => { const base = cur.length ? cur : locations.map((x) => x.id); const next = e.target.checked ? [...new Set([...base, l.id])] : base.filter((x) => x !== l.id); onSaveSites(u.id, next.length === locations.length ? [] : next); }} style={{ margin: 0 }} /> {l.name}</label>)}
              <span style={{ fontSize: 10.5, color: "var(--faint)" }}>Keeps each person's site list tidy. Like the Viewer setting, it's a convenience, not a security restriction.</span>
            </div>
          ); })()}
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
        <span style={{ fontSize: 10.5, color: "var(--faint)", display: "block", marginTop: 4 }}>
          Viewer just hides the add/edit/delete buttons for this profile — it isn't a security restriction, since anyone with access to this app can still switch profiles.
        </span>
      </Field>
    </Modal>
  );
}

export function LocationPickerModal({ devices = [], countries, locations, onClose, onChoose, onAddCountry, onAddLocation, onEditLocation, onEditCountry }) {
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: "var(--text)" }}>
                  <Globe2 size={14} color="#8A94A0" /> {c.name}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--faint)" }}>{c.currency || "GBP"}</span>
                  {ACTIVE_CAN_EDIT && onEditCountry && <button onClick={() => onEditCountry(c)} title="Edit country" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><Pencil size={12} color="#8A94A0" /></button>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {locs.map((l) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
                    <button onClick={() => onChoose(c.id, l.id)} style={{
                      flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "var(--text)",
                    }}>
                      {l.photo ? <img src={l.photo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : <Building2 size={14} color="#5B6672" />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.name}</div>
                        {(l.address || l.type) && <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{[l.type, l.address].filter(Boolean).join(" · ")}</div>}
                        {(l.staff || []).length > 0 && <div style={{ fontSize: 11, color: "var(--faint)" }}>{l.staff.length} {l.staff.length === 1 ? "person" : "people"} based here</div>}
                      </div>
                      {(() => {
                        const ds = devices.filter((d) => d.locationId === l.id);
                        const od = ds.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n < 0; }).length;
                        const soon = ds.filter((d) => { const n = daysUntil(d.nextServiceDate); return n !== null && n >= 0 && n <= 7; }).length;
                        return (
                          <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexShrink: 0 }}>
                            <span style={{ fontSize: 10.5, color: "var(--faint)", fontWeight: 600, alignSelf: "center" }}>{ds.length} services</span>
                            {od > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--on-accent)", background: "#C53030", borderRadius: 10, padding: "2px 7px" }}>{od} overdue</span>}
                            {soon > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--warn)", background: "var(--warn-soft)", borderRadius: 10, padding: "2px 7px" }}>{soon} this week</span>}
                          </div>
                        );
                      })()}
                    </button>
                    {ACTIVE_CAN_EDIT && onEditLocation && <button onClick={() => onEditLocation(l)} title="Edit site" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center" }}><Pencil size={14} color="#5B6672" /></button>}
                    </div>
                  ))}
                  {ACTIVE_CAN_EDIT && (
                    <button onClick={() => onAddLocation(c.id)} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 8,
                      border: "1px dashed var(--border)", background: "none", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 12.5, color: "var(--muted)", fontWeight: 600,
                    }}><Plus size={13} /> Add location in {c.name}</button>
                  )}
                </div>
              </div>
            );
          })}
          {ACTIVE_CAN_EDIT && (
            <button onClick={onAddCountry} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 11px", borderRadius: 8, border: "1px dashed var(--border)",
              background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "var(--accent)", fontWeight: 650,
            }}><Plus size={13} /> Add another country</button>
          )}
        </div>
      )}
    </Modal>
  );
}

export function AddCountryModal({ existing = null, onClose, onSave }) {
  const [name, setName] = useState(existing?.name || "");
  const [currency, setCurrency] = useState(existing?.currency || "GBP");
  return (
    <Modal title={existing ? "Edit country" : "Add country"} onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Country name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. United Kingdom" /></Field>
        <Field label="Currency">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <PrimaryButton onClick={() => name.trim() && onSave(name, currency)}><CheckCircle2 size={15} /> {existing ? "Save changes" : "Save country"}</PrimaryButton>
      </div>
    </Modal>
  );
}

export function AddLocationModal({ countryId, existing = null, countries = [], canDelete = false, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || "");
  const [cid, setCid] = useState(existing?.countryId || countryId);
  const [address, setAddress] = useState(existing?.address || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [type, setType] = useState(existing?.type || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [photos, setPhotos] = useState(existing?.photo ? [existing.photo] : []);
  const [staff, setStaff] = useState(existing?.staff || []);
  const [weather, setWeather] = useState(existing?.weather || null);
  const [requestCategories, setRequestCategories] = useState((existing?.requestCategories || []).join(", "));
  const [induction, setInduction] = useState(existing?.induction || ""); const [inductionUrl, setInductionUrl] = useState(existing?.inductionUrl || "");
  const [tenants, setTenants] = useState(existing?.tenants || []);
  const [editing, setEditing] = useState(null);
  const save = () => name.trim() && onSave({ id: existing?.id, countryId: cid, name: name.trim(), address: address.trim(), description: description.trim(), type, phone: phone.trim(), email: email.trim(), photo: photos[0] || null, staff, weather, requestCategories: requestCategories.split(",").map((x) => x.trim()).filter(Boolean), induction: induction.trim(), inductionUrl: inductionUrl.trim(), tenants: tenants.filter((t) => t.name.trim()) });
  return (
    <Modal title={existing ? "Edit site" : "Add location"} onClose={onClose} width={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Location name"><TextInput autoFocus={!existing} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manchester Distribution Centre" /></Field>
        {existing && countries.length > 1 && (
          <Field label="Country"><Select value={cid} onChange={(e) => setCid(e.target.value)}>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        )}
        <Field label="Address (optional)"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, postcode" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Type of site"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="">—</option>{SITE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Main phone"><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <Field label="Site email (optional)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. facilities.manchester@company.com" /></Field>
        <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 3-storey office, 450 staff, built 2005. Plant on the roof and in the basement. Shared car park with Unit B." style={{ minHeight: 70 }} /></Field>
        <PhotoStrip photos={photos} onChange={setPhotos} max={1} label="Site photo" />
        <details style={{ background: "var(--card-hi)", borderRadius: 12, padding: 10 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>QR pages, induction & tenants (optional)</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <Field label="Problem buttons on the 'report a problem' page (comma separated)"><TextInput value={requestCategories} onChange={(e) => setRequestCategories(e.target.value)} placeholder="Leave blank for the standard set, e.g. Too hot, Too cold, Lift, Car park barrier" /></Field>
            <Field label="Contractor induction (shown on the self sign-in page)"><TextArea value={induction} onChange={(e) => setInduction(e.target.value)} placeholder="e.g. Report to reception. Assembly point is the front car park. Hot works need a permit. Hi-vis in the yard." style={{ minHeight: 70 }} /></Field>
            <Field label="Induction video link (optional)"><TextInput value={inductionUrl} onChange={(e) => setInductionUrl(e.target.value)} placeholder="https://…" /></Field>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Tenants for service-charge recharges ({tenants.reduce((t, x) => t + (Number(x.share) || 0), 0)}% allocated)</div>
            {tenants.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <TextInput value={t.name} onChange={(e) => setTenants((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Tenant" style={{ flex: 1 }} />
                <TextInput type="number" min="0" max="100" value={t.share} onChange={(e) => setTenants((p) => p.map((x, j) => j === i ? { ...x, share: e.target.value } : x))} placeholder="%" style={{ width: 70 }} />
                <button type="button" onClick={() => setTenants((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} color="#A3ABB4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setTenants((p) => [...p, { name: "", share: "" }])} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>+ Add tenant</button>
          </div>
        </details>
        <WeatherLocationPicker value={weather} onChange={setWeather} address={address} siteName={name} countryName={countries.find((c) => c.id === cid)?.name} />

        <div style={{ background: "var(--card-hi)", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>People based here ({staff.length})</span>
            <button type="button" onClick={() => setEditing({})} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add person</button>
          </div>
          {staff.length === 0 && <div style={{ fontSize: 12, color: "var(--faint)" }}>Engineers, technicians, site managers, security, cleaners… anyone based at this site.</div>}
          {staff.map((p) => (
            <button key={p.id} type="button" onClick={() => setEditing(p)} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 9px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
              {p.photo ? <img src={p.photo} alt="" style={{ width: 34, height: 34, borderRadius: 17, objectFit: "cover" }} /> : <span style={{ width: 34, height: 34, borderRadius: 17, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{p.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 650 }}>{p.name}</span>
                <span style={{ display: "block", fontSize: 11.3, color: "var(--faint)" }}>{[p.role, p.company, p.phone].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          ))}
        </div>
        <PrimaryButton onClick={save}><CheckCircle2 size={15} /> {existing ? "Save changes" : "Save location"}</PrimaryButton>
        {existing && onDelete && (canDelete
          ? <ConfirmTextDelete label="Delete this site" onConfirm={() => onDelete(existing.id)} />
          : <div style={{ fontSize: 11.5, color: "var(--faint)", textAlign: "center" }}>To delete this site, first remove or move its services and suppliers.</div>)}
      </div>
      {editing && <StaffModal existing={editing.id ? editing : null} onClose={() => setEditing(null)}
        onSave={(p) => { setStaff((list) => p.id ? list.map((x) => x.id === p.id ? p : x) : [...list, { ...p, id: uid() }]); setEditing(null); }}
        onDelete={(id) => { setStaff((list) => list.filter((x) => x.id !== id)); setEditing(null); }} />}
    </Modal>
  );
}
function StaffModal({ existing, onClose, onSave, onDelete }) {
  const [name, setName] = useState(existing?.name || ""); const [role, setRole] = useState(existing?.role || STAFF_ROLES[3]);
  const [company, setCompany] = useState(existing?.company || ""); const [phone, setPhone] = useState(existing?.phone || "");
  const [email, setEmail] = useState(existing?.email || ""); const [hours, setHours] = useState(existing?.hours || "");
  const [skills, setSkills] = useState(existing?.skills || ""); const [photos, setPhotos] = useState(existing?.photo ? [existing.photo] : []);
  return (
    <Modal title={existing ? "Person" : "Add a person"} onClose={onClose} width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value)}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="In-house or contractor name" /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Mobile"><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <Field label="Working hours / days (optional)"><TextInput value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. Mon–Fri 7am–3pm" /></Field>
        <Field label="Skills / tickets (optional)"><TextInput value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. 18th Edition, F-Gas, IPAF, first aider" /></Field>
        <PhotoStrip photos={photos} onChange={setPhotos} max={1} label="Photo" />
        <PrimaryButton onClick={() => name.trim() && onSave({ id: existing?.id, name: name.trim(), role, company: company.trim(), phone: phone.trim(), email: email.trim(), hours: hours.trim(), skills: skills.trim(), photo: photos[0] || null })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Remove this person" onConfirm={() => onDelete(existing.id)} />}
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
        ...(extra.people || []).filter((p) => hit(p.name, p.role, p.company, p.skills, p.phone)).map((p) => ({ k: `pp-${p.id}`, title: `Person — ${p.name}`, sub: [p.role, p.company, p.phone].filter(Boolean).join(" · "), tab: "home" })),
        ...(extra.spaces || []).filter((x) => hit(x.name, x.floor, x.use)).map((x) => ({ k: `sp-${x.id}`, title: `Space — ${x.name}`, sub: [x.floor, x.use, x.areaM2 && `${x.areaM2} m²`].filter(Boolean).join(" · "), tab: "meters" })),
        ...(extra.actions || []).filter((x) => hit(x.action, x.finding, x.owner, x.source, x.sourceRef)).map((x) => ({ k: `ac-${x.id}`, title: `Action — ${String(x.action || x.finding).slice(0, 60)}`, sub: `${x.source}${x.due ? ` · due ${fmtDate(x.due)}` : ""}${x.status === "done" ? " · done" : ""}`, tab: "meters" })),
        ...(extra.coshh || []).filter((x) => hit(x.product, x.maker, x.location)).map((x) => ({ k: `co-${x.id}`, title: `COSHH — ${x.product}`, sub: x.location || "", tab: "meters" })),
        ...(extra.equipment || []).filter((x) => hit(x.name, x.ref, x.location)).map((x) => ({ k: `eq-${x.id}`, title: `Equipment — ${x.name}`, sub: x.nextDue ? `next inspection ${fmtDate(x.nextDue)}` : "", tab: "meters" })),
        ...(extra.asbestos || []).filter((x) => hit(x.location, x.material)).map((x) => ({ k: `as-${x.id}`, title: `Asbestos — ${x.location}`, sub: `${x.material} · ${x.risk || ""} risk`, tab: "meters" })),
      ].slice(0, 20),
    };
  }, [query, devices, services, works, suppliers]);
  const total = res ? res.devices.length + res.visits.length + res.works.length + res.suppliers.length + res.other.length : 0;
  const row = (key, title, sub, onClick) => (
    <button key={key} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 11px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      <ChevronRight size={14} color="#A3ABB4" />
    </button>
  );
  const section = (label, items) => items.length > 0 && (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 6 }}>{label} ({items.length})</div>
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
        {!res && <div style={{ fontSize: 12, color: "var(--faint)", padding: "8px 2px" }}>Type at least 2 letters. Searches services, logged visits, works and suppliers at this location.</div>}
        {res && total === 0 && <div style={{ fontSize: 13, color: "var(--faint)", textAlign: "center", padding: "20px 0" }}>No matches for "{q}".</div>}
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
export function DataModal({ customFields = [], onSaveCustomFields, branding = {}, onSaveBranding, trash = [], onRestoreDeleted, alertCount = 0, pendingCount = 0, remote = false, display = { scale: 1 }, onDisplay, activity, storageInfo, saveErrors, lastBackupAt, canEdit, onBackup, onRestore, onClose }) {
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
    <button onClick={() => setView(k)} style={{ flex: 1, background: view === k ? "var(--accent)" : "var(--card-hi)", color: view === k ? "var(--on-accent)" : "var(--muted)", border: "none", borderRadius: 8, padding: "8px 6px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );
  const mb = (n) => (n / (1024 * 1024)).toFixed(2);
  return (
    <Modal title="Activity, backup & display" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>{tabBtn("activity", "Activity log")}{tabBtn("backup", "Backup & storage")}{tabBtn("display", "Display")}{tabBtn("sharing", "Sharing")}{tabBtn("deleted", `Deleted${trash.length ? ` (${trash.length})` : ""}`)}</div>
        {view === "deleted" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Services, works and suppliers deleted in the last 30 days. Restoring a service brings back its visits, works and plan too.</div>
            {trash.length === 0 && <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 16 }}>Nothing deleted recently.</div>}
            {trash.map((t) => (
              <div key={t.trashId} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.8, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>{t.type === "service" ? "Service" : t.type === "work" ? "Work" : "Supplier"} · deleted {relativeDays(t.deletedAt)}{t.by ? ` by ${t.by}` : ""}</div>
                </div>
                {canEdit && <button onClick={() => onRestoreDeleted?.(t)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Restore</button>}
              </div>
            ))}
          </div>
        )}
        {view === "sharing" && <SharingPanel remote={remote} />}
        {view === "display" && (
          <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
              <div style={{ fontSize: 11.5, color: "var(--faint)" }}>This browser doesn't support notifications.</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6 }}>
                  <ToggleButton active={!display.notify} onClick={() => onDisplay?.({ ...display, notify: false })}>Off</ToggleButton>
                  <ToggleButton active={!!display.notify} onClick={async () => { let perm = Notification.permission; if (perm === "default") { try { perm = await Notification.requestPermission(); } catch (e) { /* */ } } onDisplay?.({ ...display, notify: perm === "granted", lastNotified: null }); }}>On</ToggleButton>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{Notification.permission === "denied" ? "Notifications are blocked for this site in your browser settings." : `When you open the app, get one notification a day summarising urgent items${alertCount ? ` (currently ${alertCount})` : ""}. Works best when the app is installed on your phone.`}</div>
              </>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><Bell size={14} /> Alerts to show</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.entries(ALERT_GROUPS).map(([k, g]) => { const on = !(display.hiddenAlertGroups || []).includes(k); return <ToggleButton key={k} active={on} onClick={() => onDisplay?.({ ...display, hiddenAlertGroups: on ? [...(display.hiddenAlertGroups || []), k] : (display.hiddenAlertGroups || []).filter((x) => x !== k) })}>{g.label}</ToggleButton>; })}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Turn off groups you don't look after. Urgent (red) alerts always show.</div>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><LayoutDashboard size={14} /> Open the app on</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{Object.entries(START_TABS).map(([k, l]) => <ToggleButton key={k} active={(display.startTab || "last") === k} onClick={() => onDisplay?.({ ...display, startTab: k })}>{l}</ToggleButton>)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><Palette size={14} /> Accent colour</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(ACCENTS).map(([k, a]) => {
                const on = (display.accent || "navy") === k;
                return <button key={k} onClick={() => onDisplay?.({ ...display, accent: k })} title={a.label} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: `2px solid ${on ? a.light : "var(--border)"}`, borderRadius: 18, padding: "5px 10px 5px 6px", fontSize: 12, fontWeight: 650, color: "var(--text)", cursor: "pointer", fontFamily: "inherit" }}><span style={{ width: 16, height: 16, borderRadius: 8, background: a.light }} />{a.label}</button>;
              })}
            </div>
            {onSaveBranding && canEdit && <BrandingEditor branding={branding} onSave={onSaveBranding} />}
            {onSaveCustomFields && canEdit && <CustomFieldsEditor fields={customFields} onSave={onSaveCustomFields} />}
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><Moon size={14} /> Theme</div>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(THEMES).map(([k, label]) => {
                const cur = display.theme || (display.dark ? "midnight" : "light");
                return <ToggleButton key={k} active={cur === k} onClick={() => onDisplay?.({ ...display, theme: k, dark: false })}>{label}</ToggleButton>;
              })}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Clear Light is easiest to read in bright places; Midnight is a dark theme for offices and evenings; Auto follows your phone or computer's light/dark setting. Only changes this device.</div>
            <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Makes everything bigger — handy on a tablet in the plant room or for easier reading. Only changes this device.</div>
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
            {shown.length === 0 && <div style={{ fontSize: 13, color: "var(--faint)", textAlign: "center", padding: "20px 0" }}>No activity recorded yet. Every change made from now on appears here.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shown.slice(0, 150).map((a) => (
                <div key={a.id} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px" }}>
                  <div style={{ fontSize: 12.8, fontWeight: 600, color: "var(--text)" }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{a.by} · {new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Keeps the latest 500 changes across all locations.</div>
          </>
        )}

        {view === "backup" && (
          <>
            {Object.keys(saveErrors).length > 0 && (
              <div style={{ background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, fontWeight: 600 }}>
                Recent changes could not be saved ({Object.values(saveErrors)[0]}). Download a backup now so nothing is lost.
              </div>
            )}
            <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Backup</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Downloads one file with every location, service, visit, photo, supplier and budget.{" "}
                {lastBackupAt ? `Last backup: ${fmtDate(lastBackupAt.slice(0, 10))}${daysSinceBackup > 7 ? ` (${daysSinceBackup} days ago)` : ""}.` : "No backup taken yet."}
              </div>
              <PrimaryButton onClick={onBackup}><Download size={15} /> Download backup</PrimaryButton>
            </div>
            {canEdit && (
              <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Restore</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Replaces ALL current data with the contents of a backup file.</div>
                <input ref={fileRef} type="file" accept=".json,application/json" onChange={pickFile} style={{ display: "none" }} />
                {!pending ? (
                  <button onClick={() => fileRef.current?.click()} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Upload size={14} /> Choose backup file
                  </button>
                ) : (
                  <div style={{ background: "var(--warn-soft)", borderRadius: 9, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12.5, color: "var(--warn)", fontWeight: 600 }}>
                      Backup from {pending.exportedAt ? new Date(pending.exportedAt).toLocaleString("en-GB") : "unknown date"}{pending.exportedBy ? ` by ${pending.exportedBy}` : ""}: {pending.data.devices.length} services, {(pending.data.services || []).length} visits, {(pending.data.suppliers || []).length} suppliers. Current data will be overwritten.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={confirmRestore} style={{ flex: 1, background: "#9B2C2C", color: "#fff", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Replace my data</button>
                      <button onClick={() => setPending(null)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                )}
                {err && <div style={{ fontSize: 12, color: "var(--danger)" }}>{err}</div>}
              </div>
            )}
            <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Smartphone size={14} /> Install as an app</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Put PPM Service Book on your phone's home screen or desktop so it opens full-screen like a normal app. On iPhone: Share → Add to Home Screen. On Android / Chrome: menu → Install app.</div>
              {typeof window !== "undefined" && window.__ppmInstallPrompt && (
                <PrimaryButton onClick={() => { window.__ppmInstallPrompt.prompt(); window.__ppmInstallPrompt = null; }}><Smartphone size={15} /> Install app</PrimaryButton>
              )}
            </div>
            <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><HardDrive size={14} /> Storage</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Data size: {mb(storageInfo.chars)} MB{storageInfo.local ? ` of about 5 MB browser storage (${storageInfo.pct}%)` : ""}. Photos take up most of the space.
              </div>
              {storageInfo.local && (
                <div style={{ height: 8, background: "var(--track)", borderRadius: 4, overflow: "hidden" }}>
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
    return <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 12, fontSize: 12.5, color: "var(--muted)" }}>Sharing is set up on your deployed site (e.g. on Vercel). Inside Claude's preview, data is already stored by Claude.</div>;
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
  const box = { background: "var(--card-hi)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 };
  if (remote) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...box, background: "var(--ok-soft)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ok)", display: "flex", alignItems: "center", gap: 6 }}><Cloud size={15} /> Shared database connected</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>{envMode ? <>Connected through your Vercel settings to <b>{cfg?.url?.replace(/^https?:\/\//, "")}</b> (table kv_store). Everyone who opens the site sees the same data — nothing to set up on other devices.</> : <>Everyone connected to <b>{cfg?.url?.replace(/^https?:\/\//, "")}</b> (space "{cfg?.space || "default"}") sees the same services, visits, suppliers and budgets.</>} Changes from others appear within a minute, or when you come back to the app.</div>
        </div>
        {!envMode && (<>
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Connect another phone or computer</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Open the app on the other device → 🕘 → Sharing → paste this setup code. Only share it with your team — anyone with it can see and change the data.</div>
          <TextArea readOnly value={setupCode} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
          <button onClick={() => copy(setupCode, "code")} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copied === "code" ? "Copied ✓" : "Copy setup code"}</button>
        </div>
        </>)}
        {window.ppmAuth?.required ? (
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} /> Personal logins are on</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Signed in as <b>{window.ppmAuth.email || "—"}</b>. Everyone needs their own account; access without signing in is blocked once the SQL below has been run.</div>
            <TextArea readOnly value={AUTH_SQL} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => copy(AUTH_SQL, "auth")} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>{copied === "auth" ? "Copied ✓" : "Copy SQL"}</button>
              <button onClick={() => window.ppmAuth.signOut()} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "var(--danger)", cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
            </div>
          </div>
        ) : (
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} /> Personal logins (recommended)</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Instead of one shared code, each person signs in with their own email and password.</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 3 }}>
              <li>Tap <b>Turn on logins</b> below and create your account (Supabase may email you a confirmation link).</li>
              <li>{envMode ? "Ask each colleague to open the site and create their own account." : "Copy the new setup code and share it; each colleague creates their own account."}</li>
              <li>When everyone is in, run this SQL in Supabase so nobody can get in without signing in. Afterwards, turn off "Allow new users to sign up" under Authentication → Settings.</li>
            </ol>
            <TextArea readOnly value={AUTH_SQL} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 60 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => copy(AUTH_SQL, "auth")} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>{copied === "auth" ? "Copied ✓" : "Copy SQL"}</button>
              <button onClick={() => { helper.setAuthRequired(true); window.location.reload(); }} style={{ flex: 1, background: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "var(--on-accent)", cursor: "pointer", fontFamily: "inherit" }}>Turn on logins</button>
            </div>
          </div>
        )}
        {!envMode && <button disabled={busy} onClick={disconnect} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><CloudOff size={13} /> Disconnect this device (keeps a copy here)</button>}
        {status && <div style={{ fontSize: 12, color: "var(--muted)" }}>{status}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Right now your data is saved only in this browser. Connect a free <b>Supabase</b> database so your whole team — and all your devices — share the same data.</div>
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Joining an existing setup?</div>
        <div style={{ display: "flex", gap: 6 }}>
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste setup code from a colleague" style={{ flex: 1, fontSize: 12 }} />
          <button onClick={applyCode} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Use</button>
        </div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>First-time setup (about 5 minutes)</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 4 }}>
          <li>Create a free project at supabase.com.</li>
          <li>Open <b>SQL Editor</b>, paste the SQL below and press Run.</li>
          <li>Go to <b>Project Settings → API</b> and copy the Project URL and the <b>anon public</b> key into the boxes below.</li>
        </ol>
        <TextArea readOnly value={SETUP_SQL} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minHeight: 120 }} />
        <button onClick={() => copy(SETUP_SQL, "sql")} style={{ alignSelf: "flex-start", background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>{copied === "sql" ? "Copied ✓" : "Copy SQL"}</button>
      </div>
      <Field label="Project URL"><TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></Field>
      <Field label="Anon public key"><TextInput value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" /></Field>
      <Field label="Space name (optional — lets several teams share one database)"><TextInput value={space} onChange={(e) => setSpace(e.target.value)} /></Field>
      <button disabled={busy || !current.url || !current.key} onClick={test} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Test connection</button>
      {status && <div style={{ fontSize: 12, color: status.startsWith("✗") ? "var(--danger)" : "var(--ok)", fontWeight: 600 }}>{status}</div>}
      <PrimaryButton onClick={() => !busy && current.url && current.key && connect(true)}><Cloud size={15} /> Upload this device's data &amp; connect</PrimaryButton>
      <button disabled={busy || !current.url || !current.key} onClick={() => connect(false)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Use shared data already in the database</button>
      <div style={{ fontSize: 11, color: "var(--faint)" }}>Use "Upload" on the first device (the one with your data). On every other device, use "Use shared data". Take a backup first. Anyone with the setup code can read and change the data, so keep it within your team.</div>
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
        {alerts.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: "var(--faint)", fontSize: 13 }}><CheckCircle2 size={22} color="#2F855A" /><div style={{ marginTop: 6 }}>All clear — nothing needs attention.</div></div>}
        {alerts.map((a) => {
          const [fg, bg, edge] = colors[a.tone];
          return (
            <div key={a.key} style={{ background: bg, borderLeft: `3px solid ${edge}`, borderRadius: 9, display: "flex", alignItems: "center" }}>
              <button onClick={() => onGo(a.tab)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: "9px 4px 9px 11px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>{a.title}</div>
                  {a.detail && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</div>}
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
          <button onClick={onClearSnoozes} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>{snoozedCount} snoozed — show them again</button>
        )}
        {alerts.length > 0 && (
          <PrimaryButton onClick={emailSummary} style={{ marginTop: 4 }}><Mail size={15} /> Email this summary</PrimaryButton>
        )}
        <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}>Covers overdue and due-within-7-days services, new requests, quotes awaiting approval or reply, budgets at 80%+ of their cap, contracts inside their renewal notice window, supplier insurance and accreditation expiry, and asset warranties ending. Tap the bell-off icon to snooze a non-urgent item for 7 days (only for you).</div>
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
    { title: "Works on-time (SLA) performance", desc: "Reactive works completed within target, by priority, supplier and trade, for the selected year.", go: () => run("Works on-time performance", `${locationName} · ${year}`, buildSlaReport(data, year)) },
    { title: "Incident trends", desc: "Incidents by type and month, root causes and hot-spot areas for the selected year.", go: () => run("Incident trends", `${locationName} · ${year}`, buildIncidentTrend(data, year)) },
    { title: "Wall planner", desc: "Year-at-a-glance grid of every service by month — planned and done — to print A4 landscape.", go: () => run(`PPM wall planner ${year}`, locationName, buildWallPlanner(data, year)) },
    { title: "Statutory compliance calendar", desc: "When each statutory requirement falls due across the year, month by month.", go: () => run(`Statutory calendar ${year}`, locationName, buildStatutoryCalendar(data.devices, [...STATUTORY_ITEMS, ...((data.settingsFields || {}).customStatutory || [])], year)) },
    { title: "VAT summary", desc: "Net, VAT and gross on recorded invoices by quarter and by VAT rate.", go: () => run(`VAT summary ${year}`, locationName, buildVatSummary(data.invoices || [], year)) },
    { title: "Most expensive assets", desc: "The 15 services that cost the most over the last 12 months — candidates for replacement.", go: () => run("Most expensive assets", locationName, buildWorstAssets(data)) },
    { title: "Repeat faults", desc: "Services with 3 or more reactive jobs in the last 12 months, with every job listed.", go: () => run("Repeat faults", locationName, buildRepeatFaults(data)) },
    ...((data.tenants || []).length ? [{ title: "Service charge recharges", desc: "This year's maintenance costs split between tenants by their share (set tenants under Edit site).", go: () => run(`Recharges ${year}`, locationName, buildRecharges(data, year, data.tenants)) }] : []),
    { title: "Works ageing", desc: "Open jobs grouped by how long they've been waiting — oldest first.", go: () => run("Works ageing", locationName, buildWorksAgeing(data)) },
    { title: "Planned vs reactive spend", desc: "How much of the year's maintenance spend was planned (PPM) versus reactive, month by month.", go: () => run(`Planned vs reactive ${year}`, locationName, buildReactiveVsPlanned(data, year)) },
    { title: "Supplier league table", desc: "Suppliers ranked by on-time visits, jobs on target, ratings and audit scores.", go: () => run(`Supplier league table ${year}`, locationName, buildSupplierLeague(data, year)) },
    { title: "Response times", desc: "How quickly engineers attended reactive jobs, by priority and supplier.", go: () => run(`Response times ${year}`, locationName, buildResponseTimes(data, year)) },
    { title: "Contract renewals calendar", desc: "Every supplier contract ending in the next 12 months, with value and renewal progress.", go: () => run("Contract renewals", locationName, buildContractCalendar(data.suppliers)) },
    { title: "Supplier compliance", desc: "Insurance, accreditation and waste carrier registration for every supplier — expired items in red.", go: () => run("Supplier compliance", locationName, buildSupplierCompliance(data.suppliers)) },
    { title: "Contractor hours on site", desc: "Hours each company spent on site this year, from the sign-in register — check time-and-materials invoices against it.", go: () => run(`Contractor hours ${year}`, locationName, buildContractorHours(data.signins, year, data.suppliers)) },
    { title: "Energy & carbon", desc: "Consumption, cost and CO₂e by meter and month, for carbon reporting.", go: () => run(`Energy & carbon ${year}`, locationName, buildCarbonReport(data.meters || [], data.readings || [], year)) },
    { title: "Committed spend", desc: "Approved jobs not yet invoiced — money already promised that will hit the budget.", go: () => run("Committed spend", locationName, buildCommittedSpend(data)) },
    { title: "Annual planner (Excel)", desc: "Every service with ○ planned / ● done for each month, as a colour-coded Excel sheet you can filter and share.", go: async () => {
      const yrS = String(year);
      const rows = [...data.devices].sort((a, b) => (a.area || "~").localeCompare(b.area || "~") || a.name.localeCompare(b.name)).map((d) => {
        const planned = new Set([...(data.visitBudgets || []).filter((v) => v.deviceId === d.id).map((v) => v.date), d.nextServiceDate].filter((x) => x && String(x).startsWith(yrS)).map((x) => new Date(x).getMonth()));
        const done = new Set(data.services.filter((v) => v.deviceId === d.id && String(v.date).startsWith(yrS) && !v.aborted && !v.skipped).map((v) => new Date(v.date).getMonth()));
        return [d.name, d.area || "", data.supplierById[d.supplierId]?.name || "", ...MONTH_LABELS.map((_, i) => (done.has(i) ? "●" : planned.has(i) ? "○" : ""))];
      });
      const buf = await buildStyledSheet({ title: `PPM annual planner ${yrS}`, subtitle: `${locationName} · ● done  ○ planned`, sheetName: `Planner ${yrS}`, headers: ["Service", "Area", "Supplier", ...MONTH_LABELS], rows, widths: [34, 16, 22, ...MONTH_LABELS.map(() => 6)],
        cellStyle: (c, v, ri, ci) => { if (ci >= 3) { c.alignment = { horizontal: "center", vertical: "middle" }; if (v === "●") excelColour(c, "E6F4EC", "1F7A4D"); else if (v === "○") { const past = Number(yrS) < new Date().getFullYear() || (Number(yrS) === new Date().getFullYear() && ci - 3 < new Date().getMonth()); excelColour(c, past ? "FBEAEA" : "E6EEF6", past ? "C53030" : "2B5D8A"); } } } });
      downloadBlob(xlsxBlob(buf), `ppm-planner-${yrS}.xlsx`);
    } },
    { title: "Year in review", desc: "Annual summary for your manager: visits, on-time %, works, spend vs budget, savings, incidents, audits, recycling and top suppliers.", go: () => run(`Year in review ${year}`, locationName, buildYearReview(data, year)) },
    { title: "Spend by supplier", desc: "What you've spent with each supplier this year — visits, works and contract — against the plan.", go: () => run(`Spend by supplier ${year}`, locationName, buildSupplierSpend(data, year)) },
    { title: "Monthly calendar", desc: "A printable month view with every booked visit (with times), due services and recurring tasks.", go: () => run(`${MONTH_LABELS[month]} ${year}`, locationName, buildMonthCalendar(data, year, month)) },
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
          <button key={r.title} onClick={r.go} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="#2B4562" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>{r.desc}</div>
            </div>
            <Printer size={16} color="#8A94A0" />
          </button>
        ))}
        <button onClick={() => downloadWorkbook(data, year, locationName)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
          <Download size={20} color="#2F855A" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Excel workbook ({year})</div>
            <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>Summary, monthly, services, visits, works, plan and suppliers — one sheet each.</div>
          </div>
        </button>
        <AccountingExport data={data} year={year} month={month} />
        {blocked && <div style={{ fontSize: 11.5, color: "var(--danger)" }}>Your browser blocked the report window — allow pop-ups for this site and try again.</div>}
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Each report opens as a print-ready page — choose "Save as PDF" in the print dialog to keep or email it.</div>
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
        {msg && <div style={{ fontSize: 12, color: "var(--ok)", background: "var(--ok-soft)", borderRadius: 8, padding: "6px 10px" }}>{msg}</div>}

        {tab === "categories" && (
          <>
            {allCats.map((k) => {
              const m = CATEGORY_META[k]; const Icon = m.icon; const used = usage[k] || 0;
              return (
                <div key={k} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={16} color={m.color} />
                    <TextInput defaultValue={m.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.label) { saveCategory(k, { label: v }); flash("Renamed"); } }} style={{ flex: 1, fontSize: 13.5, fontWeight: 650 }} />
                    {m.custom && (used ? <span style={{ fontSize: 10.5, color: "var(--faint)", whiteSpace: "nowrap" }}>in use ({used})</span> : (
                      <button onClick={() => { onSave({ customCategories: customCats.filter((c) => c.key !== k) }); flash(`Removed "${m.label}"`); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#C53030" /></button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {COLOR_CHOICES.map((c) => <button key={c} onClick={() => saveCategory(k, { color: c })} title={c} style={{ width: 22, height: 22, borderRadius: 11, background: c, border: m.color === c ? "3px solid #1B2430" : "2px solid #fff", boxShadow: "0 0 0 1px #D7DCE1", cursor: "pointer" }} />)}
                  </div>
                  {!m.custom && <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Built-in category — can be renamed and recoloured, not removed.</div>}
                </div>
              );
            })}
            <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Add a category</div>
              <TextInput value={cLabel} onChange={(e) => setCLabel(e.target.value)} placeholder="e.g. Security, Waste, Grounds" />
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {COLOR_CHOICES.map((c) => <button key={c} onClick={() => setCColor(c)} style={{ width: 22, height: 22, borderRadius: 11, background: c, border: cColor === c ? "3px solid #1B2430" : "2px solid #fff", boxShadow: "0 0 0 1px #D7DCE1", cursor: "pointer" }} />)}
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {Object.entries(CATEGORY_ICONS).map(([n, I]) => <button key={n} onClick={() => setCIcon(n)} style={{ ...pill(cIcon === n), padding: 6, display: "flex" }}><I size={14} /></button>)}
              </div>
              <PrimaryButton onClick={addCategory}><Plus size={15} /> Add category</PrimaryButton>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--faint)" }}>New categories appear everywhere: service and supplier forms, budget caps, charts, reports and exports. A category can only be removed while nothing uses it.</div>
          </>
        )}

        {tab === "fields" && (
          <>
            {fields.length === 0 && <div style={{ fontSize: 12.5, color: "var(--faint)" }}>No custom fields yet — add things like "Refrigerant type", "Job number" or "Access arranged?".</div>}
            {fields.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650 }}>{f.label}{f.required ? " *" : ""}</div>
                  <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{TYPES[f.type]} · on {APPLIES[f.appliesTo]}{f.categories?.length ? ` · ${f.categories.map((c) => CATEGORY_META[c]?.label).filter(Boolean).join(", ")} only` : ""}{f.type === "select" ? ` · ${f.options.join(" / ")}` : ""}</div>
                </div>
                <button onClick={() => { onSave({ customFields: fields.map((x) => x.id === f.id ? { ...x, required: !x.required } : x) }); }} style={pill(f.required)}>{f.required ? "Required" : "Optional"}</button>
                <button onClick={() => { onSave({ customFields: fields.filter((x) => x.id !== f.id) }); flash(`Removed "${f.label}" (existing values are kept)`); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#C53030" /></button>
              </div>
            ))}
            <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Add a field</div>
              <TextInput value={fLabel} onChange={(e) => setFLabel(e.target.value)} placeholder="Field name, e.g. Refrigerant type" />
              <div style={{ display: "flex", gap: 8 }}>
                <Select value={fApplies} onChange={(e) => setFApplies(e.target.value)} style={{ flex: 1 }}>{Object.entries(APPLIES).map(([k, l]) => <option key={k} value={k}>On {l}</option>)}</Select>
                <Select value={fType} onChange={(e) => setFType(e.target.value)} style={{ flex: 1 }}>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              </div>
              {fType === "select" && <TextInput value={fOptions} onChange={(e) => setFOptions(e.target.value)} placeholder="Options, comma separated: R32, R410A, R134a" />}
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Show for categories (none selected = all):</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {allCats.map((k) => <button key={k} onClick={() => setFCats((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k])} style={pill(fCats.includes(k))}>{CATEGORY_META[k].label}</button>)}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><input type="checkbox" checked={fRequired} onChange={(e) => setFRequired(e.target.checked)} /> Required</label>
              <PrimaryButton onClick={addField}><Plus size={15} /> Add field</PrimaryButton>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Custom fields appear on the add/edit forms (and the quick log for visits), on completed visits, and as extra columns in the Excel workbook.</div>
          </>
        )}

        {tab === "templates" && (
          <>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Templates appear under "Start from a template" when you add a service. They fill in the category, repeat schedule and checklist.</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Your templates ({templates.length})</div>
            {templates.length === 0 && <div style={{ fontSize: 12, color: "var(--faint)" }}>None yet — save one of your services as a template below.</div>}
            {templates.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 650 }}>{t.name}</div><div style={{ fontSize: 11.5, color: "var(--faint)" }}>{CATEGORY_META[t.serviceCategory]?.label || ""} · {t.checklist?.length || 0} checks{t.repeat?.months ? ` · every ${t.repeat.months} mo` : ""}</div></div>
                <button onClick={() => { onSave({ serviceTemplates: templates.filter((x) => x.id !== t.id) }); flash(`Removed "${t.name}"`); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={14} color="#C53030" /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <Select value={fromDev} onChange={(e) => setFromDev(e.target.value)} style={{ flex: 1 }}>
                <option value="">Save an existing service as a template…</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <button onClick={templateFromService} disabled={!fromDev} style={{ background: fromDev ? "var(--accent)" : "#C0C6CC", color: "var(--on-accent)", border: "none", borderRadius: 9, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: fromDev ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>Standard templates ({BUILTIN_TEMPLATES.length})</div>
            {BUILTIN_TEMPLATES.map((t) => (
              <div key={t.id} style={{ fontSize: 12, color: "var(--text-2)", borderBottom: "1px solid var(--border)", paddingBottom: 5 }}>
                <b>{t.name}</b> <span style={{ color: "var(--faint)" }}>— {t.repeat.mode === "weekly" ? "weekly" : t.repeat.mode === "custom" ? `${t.repeat.count}× a year` : `every ${t.repeat.months} month${t.repeat.months === 1 ? "" : "s"}`}, {t.checklist.length} checks</span>
                <div style={{ fontSize: 11, color: "var(--faint)" }}>{t.note}</div>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Standard frequencies reflect common UK guidance and practice, not legal advice — always follow your own risk assessments, insurer and manufacturer requirements.</div>
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
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Core data complete: <b style={{ color: score >= 90 ? "var(--ok)" : score >= 70 ? "var(--warn)" : "var(--danger)", fontSize: 16 }}>{score}%</b> <span style={{ fontSize: 11.5 }}>(due dates, suppliers and budgets across {devices.length} services)</span></div>
        {checks.map((c) => {
          const bad = devices.filter(c.test);
          return (
            <div key={c.key} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "8px 10px" }}>
              <button onClick={() => setOpen(open === c.key ? null : c.key)} disabled={!bad.length} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: bad.length ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
                {bad.length ? <AlertTriangle size={15} color="#B7791F" /> : <CheckCircle2 size={15} color="#2F855A" />}
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 650 }}>{c.label}: {bad.length}</div>{bad.length > 0 && <div style={{ fontSize: 11, color: "var(--faint)" }}>These {c.why}.</div>}</div>
                {bad.length > 0 && <ChevronDown size={14} color="#8A94A0" style={{ transform: open === c.key ? "rotate(180deg)" : "none" }} />}
              </button>
              {open === c.key && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                  {bad.slice(0, 40).map((d) => (
                    <button key={d.id} onClick={() => ACTIVE_CAN_EDIT && onEdit(d)} style={{ display: "flex", justifyContent: "space-between", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 8px", fontSize: 12.3, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <span>{d.name}</span>{ACTIVE_CAN_EDIT && <span style={{ color: "var(--accent)", fontWeight: 650 }}>Fix</span>}
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
            <kbd style={{ minWidth: 34, textAlign: "center", background: "var(--card-hi)", border: "1px solid var(--border)", borderBottomWidth: 2, borderRadius: 6, padding: "3px 7px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{k}</kbd>{v}
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>Shortcuts work on a computer when you're not typing in a box.</div>
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
              <div key={t} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "9px 11px" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2, lineHeight: 1.45 }}>{b}</div>
              </div>
            ))}
            {topics.length === 0 && <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 12 }}>No help topics match "{q}".</div>}
          </>
        )}
        {tab === "new" && WHATS_NEW.map(([t, b]) => (
          <div key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Sparkles size={14} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>{t}</div><div style={{ fontSize: 12.3, color: "var(--muted)" }}>{b}</div></div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function BrandingEditor({ branding, onSave }) {
  const [name, setName] = useState(branding.companyName || ""); const [logo, setLogo] = useState(branding.logo || null);
  async function pick(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setLogo(await compressImage(f, 360, 0.8)); } catch (x) { /* ignore */ } }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={14} /> Report branding (everyone)</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {logo && <img src={logo} alt="" style={{ height: 40, maxWidth: 110, objectFit: "contain", background: "#fff", borderRadius: 6, padding: 3, border: "1px solid var(--border)" }} />}
        <label style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer" }}>{logo ? "Change logo" : "Upload logo"}<input type="file" accept="image/*" onChange={pick} style={{ display: "none" }} /></label>
        {logo && <button onClick={() => setLogo(null)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
      </div>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name on reports" />
      <button onClick={() => onSave({ companyName: name.trim(), logo })} style={{ alignSelf: "flex-start", background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save branding</button>
      <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Your logo and company name appear at the top of every printed report, permit and work order.</div>
    </div>
  );
}

function WeatherLocationPicker({ value, onChange, address, siteName, countryName }) {
  const [q, setQ] = useState(""); const [results, setResults] = useState(null); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState("");
  const pc = findPostcode(address);
  const pick = (p) => { onChange({ name: `${p.name}${p.admin && !p.name.includes(p.admin) ? `, ${p.admin}` : ""}${p.country && p.country !== "GB" ? ` (${p.country})` : ""}`, lat: p.lat, lon: p.lon }); setResults(null); setQ(""); setMsg(""); };
  async function search() {
    if (!q.trim()) return; setBusy("search"); setMsg("");
    try { const r = await searchPlaces(q.trim(), countryCodeFor(countryName)); setResults(r); if (!r.length) setMsg(`No places called "${q.trim()}" found — try a nearby town or the postcode.`); }
    catch (e) { setMsg("Couldn't reach the place search — check your connection."); }
    setBusy("");
  }
  async function usePostcode() {
    setBusy("pc"); setMsg("");
    try { pick(await placeFromPostcode(pc)); } catch (e) { setMsg(`Couldn't look up ${pc} — check the postcode, or search for the town instead.`); }
    setBusy("");
  }
  function useHere() {
    if (!navigator.geolocation) { setMsg("This device can't share its location."); return; }
    setBusy("gps"); setMsg("");
    navigator.geolocation.getCurrentPosition(async (pos) => { pick(await placeFromCoords(pos.coords.latitude, pos.coords.longitude)); setBusy(""); },
      () => { setMsg("Location permission was refused — allow it in your browser settings, or search instead."); setBusy(""); }, { enableHighAccuracy: false, timeout: 10000 });
  }
  const btn = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 };
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><CloudSun size={14} /> Weather location</div>
      <div style={{ fontSize: 12, color: value ? "var(--ok)" : "var(--muted)", fontWeight: value ? 650 : 500 }}>
        {value ? `📍 ${value.name}` : `Not set — the weather tile will guess from "${siteName || "the site name"}".`}
        {value && <button type="button" onClick={() => onChange(null)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", marginLeft: 6 }}>clear</button>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {pc && <button type="button" onClick={usePostcode} disabled={!!busy} style={btn}>{busy === "pc" ? "Looking up…" : `Use postcode ${pc}`}</button>}
        <button type="button" onClick={useHere} disabled={!!busy} style={btn}><MapPin size={13} /> {busy === "gps" ? "Finding you…" : "Use my current location"}</button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} placeholder="Or search a town, e.g. Feltham" style={{ flex: 1, minWidth: 0 }} />
        <button type="button" onClick={search} disabled={!!busy} style={{ ...btn, background: "var(--accent)", color: "var(--on-accent)", border: "none" }}>{busy === "search" ? "…" : "Find"}</button>
      </div>
      {results && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Tap the right one:</div>
          {results.map((r, i) => (
            <button key={i} type="button" onClick={() => pick(r)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
              <b style={{ fontSize: 13 }}>{r.name}</b> <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{[r.admin, r.country].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: "var(--danger)" }}>{msg}</div>}
    </div>
  );
}
