// Suppliers, supplier form and scorecard.
import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, FileWarning, Gauge, Link2, Mail, Merge, MessageSquare, Pencil, Phone, Plus, Printer, Star, Trash2, Upload, Users as UsersIcon, X } from "lucide-react";
import { CategoryOptions, ConfirmDeleteButton, EmptyState, ExportButton, Field, Modal, PrimaryButton, Select, SubCategoryField, TextArea, TextInput, ToggleButton, inputStyle } from "../components/ui.jsx";
import { CONTACT_TYPES, ONBOARDING_ITEMS, RENEWAL_STEPS, SUPPLIER_STATUSES, WORK_CATEGORIES } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE, CATEGORY_KEYS, CATEGORY_META } from "../lib/globals.js";
import { computeCompliance, daysUntil, fmtDate, gbp, isMirrored, parseDelimited, supplierStats, toISO, uid } from "../lib/utils.js";
import { buildSupplierPack, openPrintReport } from "../lib/reports.js";
import { xlsxToText } from "../lib/excelTemplate.js";
import { ContactsEditor } from "./MoreViews.jsx";

/* ---------------------------------------------------------
   Suppliers Tab
--------------------------------------------------------- */
export function SuppliersTab({ onPortal, onBulkEmail, onImport, packData = null, locationName = "", onFollowUpDone, invoices = [], onAddContact, onMerge, userName = "", suppliers, onAdd, onEdit, onDelete, devices = [], services = [], works = [], budgetLines = [], visitBudgets = [] }) {
  const [scoreFor, setScoreFor] = useState(null);
  const [contactFor, setContactFor] = useState(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const ratingOf = (s) => { const r = services.filter((v) => v.rating && (v.supplierId === s.id || (!v.supplierId && devices.find((d) => d.id === v.deviceId)?.supplierId === s.id))); return r.length ? r.reduce((t, v) => t + v.rating, 0) / r.length : -1; };
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
      {suppliers.length > 3 && (
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers…" style={{ flex: 1, minWidth: 0 }} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, width: 130, fontSize: 12.5 }}>
            <option value="name">Name A–Z</option><option value="value">Contract value</option><option value="rating">Rating</option><option value="end">Contract end</option>
          </select>
        </div>
      )}
      {suppliers.length > 1 && ACTIVE_CAN_EDIT && onBulkEmail && <button onClick={onBulkEmail} style={{ order: 96, background: "none", border: "1px dashed #C7D0DA", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Mail size={14} /> Email several suppliers (site closure, access change…)</button>}
      {suppliers.length > 0 && <div style={{ order: 97, display: "flex", justifyContent: "center" }}><ExportButton label="Export suppliers (CSV)" filename="suppliers.csv" rows={[["Name", "Category", "Status", "Trades", "Contact", "Email", "Phone", "Out of hours", "Contract value", "Per", "Contract end", "Payment terms", "Insurance expiry", "Accreditation", "Accreditation expiry", "Waste carrier reg.", "Rating"], ...suppliers.map((x) => [x.name, CATEGORY_META[x.category]?.label || x.category, SUPPLIER_STATUSES[x.status || "approved"]?.label || "", (x.trades || []).join("; "), x.managerName || "", x.managerEmail || "", x.managerPhone || "", x.oohPhone || "", x.costAmount || 0, x.costFrequency || "", x.contractEnd || "", x.paymentDays ?? "", x.insuranceExpiry || "", x.accreditation || "", x.accreditationExpiry || "", x.wasteLicence || "", ratingOf(x) >= 0 ? ratingOf(x).toFixed(1) : ""])]} /></div>}
      {importOpen && <SupplierImportModal existing={suppliers} onClose={() => setImportOpen(false)} onImport={(rows) => { onImport(rows); setImportOpen(false); }} />}
      {ACTIVE_CAN_EDIT && onImport && <button onClick={() => setImportOpen(true)} style={{ order: 98, background: "none", border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FileSpreadsheet size={14} /> Import suppliers from a spreadsheet</button>}
      {contactFor && <ContactLogModal onFollowUpDone={(cid) => onFollowUpDone?.(contactFor.id, cid)} supplier={suppliers.find((x) => x.id === contactFor.id) || contactFor} userName={userName} onClose={() => setContactFor(null)} onAdd={(entry) => onAddContact(contactFor.id, entry)} />}
      {mergeOpen && <MergeSuppliersModal suppliers={suppliers} onClose={() => setMergeOpen(false)} onMerge={(keepId, dropId) => { onMerge(keepId, dropId); setMergeOpen(false); }} />}
      {ACTIVE_CAN_EDIT && onMerge && suppliers.length > 1 && <button onClick={() => setMergeOpen(true)} style={{ order: 99, background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Merge size={13} /> Merge duplicate suppliers</button>}
      {suppliers.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>Contract value per year</div><div style={{ fontSize: 17, fontWeight: 750, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(totalAnnual)}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>Contracts ending in 90 days</div><div style={{ fontSize: 17, fontWeight: 750, color: ending90.length ? "var(--warn)" : "var(--text)", fontFamily: "'IBM Plex Mono', monospace" }}>{ending90.length}</div></div>
          </div>
          {top.length > 0 && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Largest: {top.map((x) => `${x.name} ${gbp(annual(x))}`).join(" · ")}</div>}
          {ending90.length > 0 && <div style={{ fontSize: 11.5, color: "var(--warn)", fontWeight: 650 }}>Ending: {ending90.map((x) => `${x.name} (${fmtDate(x.contractEnd)})`).join(" · ")}</div>}
        </div>
      )}
      {groups.map((cat) => {
        const list = suppliers.filter((s) => s.category === cat).filter((s) => !q.trim() || [s.name, s.managerName, s.contact, s.subCategory, s.contractRef].filter(Boolean).some((v) => v.toLowerCase().includes(q.trim().toLowerCase())))
          .sort((a, b) => sortBy === "value" ? annual(b) - annual(a) : sortBy === "rating" ? ratingOf(b) - ratingOf(a) : sortBy === "end" ? String(a.contractEnd || "9999").localeCompare(String(b.contractEnd || "9999")) : a.name.localeCompare(b.name));
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
                <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <button onClick={() => onEdit(s)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{s.name}{s.subCategory ? ` · ${s.subCategory}` : ""}</div>
                    <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{s.contact || "No contact on file"}</div>
                    <div style={{ fontSize: 12, color: s.managerEmail ? "var(--accent)" : "#C05621", marginTop: 2, fontWeight: 600 }}>
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
                    {s.wasteLicence && <div style={{ fontSize: 11.5, color: s.wasteLicenceExpiry && daysUntil(s.wasteLicenceExpiry) < 0 ? "var(--danger)" : "var(--muted)", marginTop: 3, fontWeight: 600 }}>♻ Carrier reg. {s.wasteLicence}{s.wasteLicenceExpiry ? ` · ${daysUntil(s.wasteLicenceExpiry) < 0 ? "expired" : "to"} ${fmtDate(s.wasteLicenceExpiry)}` : ""}</div>}
                    {s.contractEnd && daysUntil(s.contractEnd) >= 0 && daysUntil(s.contractEnd) <= 180 && <div style={{ fontSize: 11.5, color: "var(--warn)", marginTop: 3, fontWeight: 650 }}>Renewal: {Object.keys(s.renewal || {}).filter((k) => RENEWAL_STEPS.includes(k)).length}/{RENEWAL_STEPS.length} steps · ends {fmtDate(s.contractEnd)}</div>}
                    {s.oohPhone && <a href={`tel:${s.oohPhone.replace(/[^+0-9]/g, "")}`} onClick={(e) => e.stopPropagation()} style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: "var(--danger)", marginTop: 3, textDecoration: "none" }}>☎ 24h: {s.oohPhone}</a>}
                    {s.status && s.status !== "approved" && <div style={{ fontSize: 11.5, fontWeight: 800, color: SUPPLIER_STATUSES[s.status].color, marginTop: 3 }}>{s.status === "blocked" ? "⛔ " : "⚠ "}{SUPPLIER_STATUSES[s.status].label}{s.statusReason ? ` — ${s.statusReason}` : ""}</div>}
                    {Number(s.targetOnTime) > 0 && (() => { const comp = computeCompliance(devices.filter((d) => d.supplierId === s.id), visitBudgets || [], services); if (comp.pct == null) return null; const t = Number(s.targetOnTime); const col = comp.pct >= t ? "var(--ok)" : comp.pct >= t - 10 ? "var(--warn)" : "var(--danger)"; return <div style={{ fontSize: 11.5, fontWeight: 700, color: col, marginTop: 3 }}>● On time {comp.pct}% (target {t}%)</div>; })()}
                    {(s.contacts || []).length > 0 && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>+{s.contacts.length} contact{s.contacts.length === 1 ? "" : "s"}: {s.contacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ")}</div>}
                    {(s.trades || []).length > 0 && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{s.trades.join(" · ")}</div>}
                    {(() => {
                      const yr = String(new Date().getFullYear());
                      const visits = services.filter((v) => String(v.date).startsWith(yr) && (v.supplierId === s.id || (!v.supplierId && devices.find((d) => d.id === v.deviceId)?.supplierId === s.id))).reduce((t, v) => t + (Number(v.cost) || 0), 0);
                      const wk = works.filter((w) => w.supplierId === s.id && String(w.dateRaised).startsWith(yr) && ["approved", "in_progress", "completed"].includes(w.status)).reduce((t, w) => t + (Number(w.finalCost ?? w.quoteAmount) || 0), 0);
                      const contract = (s.costFrequency === "annual" ? (Number(s.costAmount) || 0) / 12 : Number(s.costAmount) || 0) * (new Date().getMonth() + 1);
                      const total = visits + wk + contract;
                      return total > 0 ? <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>Spend {yr}: <b>{gbp(total)}</b>{wk ? ` (works ${gbp(wk)})` : ""}</div> : null;
                    })()}
                    {s.rates && (s.rates.hourly != null || s.rates.callout != null) && (
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{[s.rates.hourly != null && `${gbp(s.rates.hourly)}/hr`, s.rates.callout != null && `call-out ${gbp(s.rates.callout)}`, s.rates.outOfHours != null && `OOH ${gbp(s.rates.outOfHours)}/hr`, s.rates.materialsMarkup != null && `materials +${s.rates.materialsMarkup}%`].filter(Boolean).join(" · ")}</div>
                    )}
                    {(s.contactLog || []).length > 0 && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>Last contact {fmtDate(s.contactLog[0].date)} — {CONTACT_TYPES[s.contactLog[0].type] || ""}: {String(s.contactLog[0].summary).slice(0, 60)}</div>}
                    {(s.links || []).length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 3 }} onClick={(e) => e.stopPropagation()}>
                        {s.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 3 }}><Link2 size={11} /> {l.label}</a>)}
                      </div>
                    )}
                    {(() => {
                      const done = Object.keys(s.onboarding || {}).filter((k) => ONBOARDING_ITEMS.includes(k)).length;
                      if (!s.onboarding) return null;
                      return <div style={{ fontSize: 11.5, fontWeight: 700, color: done === ONBOARDING_ITEMS.length ? "var(--ok)" : "var(--warn)", marginTop: 3 }}>{done === ONBOARDING_ITEMS.length ? "✓ Onboarding complete" : `Onboarding ${done}/${ONBOARDING_ITEMS.length}`}</div>;
                    })()}
                    {(() => {
                      const rated = services.filter((v) => v.rating && (v.supplierId === s.id || (!v.supplierId && devices.find((d) => d.id === v.deviceId)?.supplierId === s.id)));
                      if (!rated.length) return null;
                      const avg = rated.reduce((t, v) => t + v.rating, 0) / rated.length;
                      return <div style={{ fontSize: 12, fontWeight: 700, color: avg >= 4 ? "var(--ok)" : avg >= 3 ? "var(--warn)" : "var(--danger)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><Star size={12} fill="currentColor" /> {avg.toFixed(1)} <span style={{ color: "var(--faint)", fontWeight: 600 }}>from {rated.length} rated visit{rated.length === 1 ? "" : "s"}</span></div>;
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
                    {ACTIVE_CAN_EDIT && onPortal && <button onClick={() => { const how = s.portalToken ? window.prompt(`Supplier job link for ${s.name}:\n\n1 = email it to them\n2 = copy it\n3 = make a new link (the old one stops working)\n\nType 1, 2 or 3:`, "1") : "1"; if (how === "1") onPortal(s, "email"); else if (how === "2") onPortal(s, "copy"); else if (how === "3") onPortal(s, "new"); }} title={s.portalToken ? "Supplier job link" : "Send a job link"} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><Link2 size={15} color={s.portalToken ? "#2F855A" : "#5B6672"} /></button>}
                    {s.managerEmail && ACTIVE_CAN_EDIT && <button onClick={() => { const body = `Hi${s.managerName ? ` ${s.managerName.split(" ")[0]}` : ""},\n\nBefore your next visit to ${locationName}, please send:\n\n- Risk assessment and method statement (RAMS) for the work\n- Names of the engineers attending\n- Current public liability insurance certificate\n- Any permits you will need (hot works, working at height, isolations)\n\nThanks`; window.location.href = `mailto:${encodeURIComponent(s.managerEmail)}?subject=${encodeURIComponent(`RAMS request — ${locationName}`)}&body=${encodeURIComponent(body)}`; }} title="Ask for RAMS" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><FileWarning size={15} color="#5B6672" /></button>}
                    {packData && <button onClick={() => openPrintReport(`Supplier review — ${s.name}`, `${locationName} · ${fmtDate(new Date().toISOString().slice(0, 10))}`, buildSupplierPack(s, packData))} title="Review meeting pack" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><Printer size={15} color="#5B6672" /></button>}
                    {onAddContact && <button onClick={() => setContactFor(s)} title="Contact log" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><MessageSquare size={15} color="#5B6672" /></button>}
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

export function AddSupplierModal({ existing, subcategoriesByCategory, onClose, onSave, onDelete }) {
  const isEdit = !!existing;
  const [category, setCategory] = useState(existing?.category || "cleaning");
  const [name, setName] = useState(existing?.name || "");
  const [subCategory, setSubCategory] = useState(existing?.subCategory || "");
  const [contact, setContact] = useState(existing?.contact || "");
  const [managerName, setManagerName] = useState(existing?.managerName || "");
  const [managerEmail, setManagerEmail] = useState(existing?.managerEmail || "");
  const [managerPhone, setManagerPhone] = useState(existing?.managerPhone || "");
  const [oohPhone, setOohPhone] = useState(existing?.oohPhone || "");
  const [contractStart, setContractStart] = useState(existing?.contractStart || "");
  const [contractEnd, setContractEnd] = useState(existing?.contractEnd || "");
  const [noticeDays, setNoticeDays] = useState(existing?.noticeDays ? String(existing.noticeDays) : "60");
  const [contractRef, setContractRef] = useState(existing?.contractRef || "");
  const [costAmount, setCostAmount] = useState(existing?.costAmount ? String(existing.costAmount) : "");
  const [costFrequency, setCostFrequency] = useState(existing?.costFrequency || "monthly");
  const [hourlyRate, setHourlyRate] = useState(existing?.rates?.hourly != null ? String(existing.rates.hourly) : "");
  const [calloutFee, setCalloutFee] = useState(existing?.rates?.callout != null ? String(existing.rates.callout) : "");
  const [outOfHours, setOutOfHours] = useState(existing?.rates?.outOfHours != null ? String(existing.rates.outOfHours) : "");
  const [markup, setMarkup] = useState(existing?.rates?.materialsMarkup != null ? String(existing.rates.materialsMarkup) : "");
  const [status, setStatus] = useState(existing?.status || "approved");
  const [statusReason, setStatusReason] = useState(existing?.statusReason || "");
  const [trades, setTrades] = useState(existing?.trades || []);
  const [contacts, setContacts] = useState(existing?.contacts || []);
  const [targetOnTime, setTargetOnTime] = useState(existing?.targetOnTime != null ? String(existing.targetOnTime) : "");
  const [upliftPct, setUpliftPct] = useState(existing?.upliftPct != null ? String(existing.upliftPct) : "");
  const [paymentDays, setPaymentDays] = useState(existing?.paymentDays != null ? String(existing.paymentDays) : "30");
  const [wasteLicence, setWasteLicence] = useState(existing?.wasteLicence || "");
  const [wasteLicenceExpiry, setWasteLicenceExpiry] = useState(existing?.wasteLicenceExpiry || "");
  const [renewal, setRenewal] = useState(existing?.renewal || {});
  const [insuranceExpiry, setInsuranceExpiry] = useState(existing?.insuranceExpiry || "");
  const [accreditation, setAccreditation] = useState(existing?.accreditation || "");
  const [accreditationExpiry, setAccreditationExpiry] = useState(existing?.accreditationExpiry || "");
  const [onboarding, setOnboarding] = useState(existing?.onboarding || {});
  const [supLinks, setSupLinks] = useState(existing?.links || []);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function submit() {
    if (!name.trim()) return;
    onSave({ status, statusReason: status === "approved" ? "" : statusReason.trim(), contacts, trades, paymentDays: Number(paymentDays) || 30, upliftPct: upliftPct === "" ? null : Number(upliftPct), targetOnTime: targetOnTime === "" ? null : Number(targetOnTime), rates: { hourly: hourlyRate === "" ? null : Number(hourlyRate), callout: calloutFee === "" ? null : Number(calloutFee), outOfHours: outOfHours === "" ? null : Number(outOfHours), materialsMarkup: markup === "" ? null : Number(markup) }, id: existing?.id, category, subCategory: subCategory.trim(), name: name.trim(), contact: contact.trim(),
      managerName: managerName.trim(), managerEmail: managerEmail.trim(), managerPhone: managerPhone.trim(), oohPhone: oohPhone.trim(),
      contractStart: contractStart || null, contractEnd: contractEnd || null, noticeDays: noticeDays ? Number(noticeDays) : 60, contractRef: contractRef.trim(),
      priceHistory: existing && Number(existing.costAmount) !== (costAmount ? Number(costAmount) : 0)
        ? [...(existing.priceHistory || []), { amount: Number(existing.costAmount) || 0, frequency: existing.costFrequency, until: new Date().toISOString().slice(0, 10) }]
        : (existing?.priceHistory || []),
      costAmount: costAmount ? Number(costAmount) : 0, costFrequency,
      wasteLicence: wasteLicence.trim(), wasteLicenceExpiry: wasteLicenceExpiry || null, renewal,
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
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Account manager — used for chase-up emails</div>
          <Field label="Manager name"><TextInput value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. Jane Smith" /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Email"><TextInput type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="jane@supplier.co.uk" /></Field>
            <Field label="Phone"><TextInput type="tel" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} placeholder="07…" /></Field>
          </div>
          <Field label="Out-of-hours / emergency number"><TextInput type="tel" value={oohPhone} onChange={(e) => setOohPhone(e.target.value)} placeholder="24-hour helpdesk" /></Field>
          <ContactsEditor contacts={contacts} onChange={setContacts} />
        </div>
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Contract</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Start"><TextInput type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} /></Field>
            <Field label="End"><TextInput type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Remind me (days before end)"><TextInput type="number" min="0" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} /></Field>
            <Field label="Contract ref (optional)"><TextInput value={contractRef} onChange={(e) => setContractRef(e.target.value)} placeholder="e.g. CT-2026-014" /></Field>
          </div>
        </div>
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {category === "cleaning" || /waste|recycl|skip/i.test(`${name} ${subCategory}`) || wasteLicence ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Waste carrier registration no."><TextInput value={wasteLicence} onChange={(e) => setWasteLicence(e.target.value)} placeholder="e.g. CBDU123456" /></Field>
            <Field label="Registration expires"><TextInput type="date" value={wasteLicenceExpiry} onChange={(e) => setWasteLicenceExpiry(e.target.value)} /></Field>
          </div>
        ) : null}
        {contractEnd && daysUntil(contractEnd) <= 180 && (
          <div style={{ background: "var(--warn-soft)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>Contract renewal — ends {fmtDate(contractEnd)} ({Object.keys(renewal).filter((k) => RENEWAL_STEPS.includes(k)).length}/{RENEWAL_STEPS.length} steps done)</div>
            {RENEWAL_STEPS.map((st) => (
              <label key={st} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, cursor: "pointer" }}>
                <input type="checkbox" checked={!!renewal[st]} onChange={(e) => setRenewal((p) => { const n = { ...p }; if (e.target.checked) n[st] = new Date().toISOString().slice(0, 10); else delete n[st]; return n; })} style={{ margin: 0 }} />
                <span style={{ flex: 1 }}>{st}</span>{renewal[st] && <span style={{ fontSize: 10.5, color: "var(--faint)" }}>{fmtDate(renewal[st])}</span>}
              </label>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Compliance documents — you'll be alerted 30 days before expiry</div>
          <Field label="Public liability insurance expires"><TextInput type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Accreditation"><TextInput value={accreditation} onChange={(e) => setAccreditation(e.target.value)} placeholder="e.g. Gas Safe, SafeContractor" /></Field>
            <Field label="Expires"><TextInput type="date" value={accreditationExpiry} onChange={(e) => setAccreditationExpiry(e.target.value)} /></Field>
          </div>
        </div>
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Documents &amp; links (contract, insurance certificate, RAMS…)</div>
          {supLinks.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <TextInput value={l.label} onChange={(e) => setSupLinks((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ width: "35%" }} />
              <TextInput value={l.url} onChange={(e) => setSupLinks((p) => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" onClick={() => setSupLinks((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={14} color="#A3ABB4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setSupLinks((p) => [...p, { label: "", url: "" }])} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", padding: "0 0 6px" }}>+ Add a link</button>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Onboarding checklist — {Object.keys(onboarding).filter((k) => ONBOARDING_ITEMS.includes(k)).length}/{ONBOARDING_ITEMS.length} received</div>
          {ONBOARDING_ITEMS.map((item) => (
            <label key={item} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, color: "var(--text-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!onboarding[item]} onChange={(e) => setOnboarding((p) => { const n = { ...p }; if (e.target.checked) n[item] = new Date().toISOString().slice(0, 10); else delete n[item]; return n; })} style={{ margin: 0 }} />
              <span style={{ flex: 1 }}>{item}</span>
              {onboarding[item] && <span style={{ fontSize: 10.5, color: "var(--faint)" }}>{fmtDate(onboarding[item])}</span>}
            </label>
          ))}
        </div>
        <Field label="Status">
          <div style={{ display: "flex", gap: 5 }}>{Object.entries(SUPPLIER_STATUSES).map(([k, v]) => <ToggleButton key={k} active={status === k} onClick={() => setStatus(k)}>{v.label}</ToggleButton>)}</div>
        </Field>
        {status !== "approved" && <Field label="Reason"><TextInput value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="e.g. Repeated no-shows in 2026; failed audit" /></Field>}
        <Field label="Trades they cover (used to suggest suppliers for new jobs)">
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{WORK_CATEGORIES.map((c) => <ToggleButton key={c} active={trades.includes(c)} onClick={() => setTrades((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])}>{c}</ToggleButton>)}</div>
        </Field>
        <Field label="Target: visits on time (%) — shown red/amber/green on the card"><TextInput type="number" min="0" max="100" value={targetOnTime} onChange={(e) => setTargetOnTime(e.target.value)} placeholder="e.g. 95" /></Field>
        <Field label="Expected price increase at renewal (%)"><TextInput type="number" step="0.5" value={upliftPct} onChange={(e) => setUpliftPct(e.target.value)} placeholder="e.g. 5 — shows next year's impact in Budget → Checks" /></Field>
        <Field label="Payment terms (days) — sets invoice due dates"><TextInput type="number" min="0" value={paymentDays} onChange={(e) => setPaymentDays(e.target.value)} /></Field>
        <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Rate card (optional) — to check quotes and invoices against</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Hourly rate"><TextInput type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} /></Field>
            <Field label="Call-out fee"><TextInput type="number" min="0" step="0.01" value={calloutFee} onChange={(e) => setCalloutFee(e.target.value)} /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Out-of-hours rate"><TextInput type="number" min="0" step="0.01" value={outOfHours} onChange={(e) => setOutOfHours(e.target.value)} /></Field>
            <Field label="Materials mark-up %"><TextInput type="number" min="0" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} /></Field>
          </div>
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
              <button onClick={() => onDelete(existing.id)} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this supplier
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Supplier scorecard
--------------------------------------------------------- */
export function SupplierScorecardModal({ supplier, devices, services, works, budgetLines, visitBudgets, onClose }) {
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
            <div key={label} style={{ background: "var(--card-hi)", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.7 }}>
          <div>Services assigned: <b>{st.devs.length}</b> · Visits logged: <b>{st.visits.length}</b> · Spend: <b>{gbp(st.spend)}</b></div>
          <div>Planned visits: <b>{st.comp.totals.onTime}</b> on time, <b>{st.comp.totals.late}</b> late, <b style={{ color: st.comp.totals.missed ? "var(--danger)" : undefined }}>{st.comp.totals.missed}</b> missed</div>
          <div>Failed checks: <b>{st.fails}</b> · Extra jobs / requests: <b>{st.jobs.length}</b> · Times chased: <b>{st.chases}</b></div>
          {supplier.contractEnd && <div>Contract: {supplier.contractStart ? `${fmtDate(supplier.contractStart)} – ` : "ends "}{fmtDate(supplier.contractEnd)}{supplier.contractRef ? ` · ${supplier.contractRef}` : ""}</div>}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Contract rate history</div>
          {(supplier.priceHistory || []).length === 0 ? <div style={{ fontSize: 12, color: "var(--faint)" }}>Current rate {gbp(supplier.costAmount)} / {supplier.costFrequency === "annual" ? "yr" : "mo"} — earlier rates are recorded here whenever you change it.</div> : (
            <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
              {supplier.priceHistory.map((p, i) => <div key={i}>{gbp(p.amount)} / {p.frequency === "annual" ? "yr" : "mo"} <span style={{ color: "var(--faint)" }}>until {fmtDate(p.until)}</span></div>)}
              <div><b>{gbp(supplier.costAmount)} / {supplier.costFrequency === "annual" ? "yr" : "mo"}</b> <span style={{ color: "var(--faint)" }}>current</span></div>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Price history — visits &amp; recorded costs ({priceRows.length})</div>
          {priceRows.length === 0 ? <div style={{ fontSize: 12, color: "var(--faint)" }}>No costs recorded for {year}.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflowY: "auto" }}>
              {priceRows.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 8px", background: i % 2 ? "var(--card)" : "var(--card-hi)", borderRadius: 6 }}>
                  <span>{fmtDate(r.date)} · {r.label}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: r.budget != null ? (r.amount <= r.budget ? "var(--ok)" : "var(--danger)") : "var(--text)" }}>{gbp(r.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Score weights on-time visits 50%, checklist pass rate 30% and staying within budget 20%, using whichever have data.</div>
      </div>
    </Modal>
  );
}

export function ContactLogModal({ onFollowUpDone, supplier, userName, onClose, onAdd }) {
  const [type, setType] = useState("call");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [who, setWho] = useState(supplier.managerName || "");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState("");
  const log = supplier.contactLog || [];
  return (
    <Modal title={`Contact log — ${supplier.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ACTIVE_CAN_EDIT && (
          <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{Object.entries(CONTACT_TYPES).map(([k, v]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{v}</ToggleButton>)}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="With"><TextInput value={who} onChange={(e) => setWho(e.target.value)} /></Field>
            </div>
            <Field label="What was discussed / agreed"><TextArea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Agreed to re-attend Thursday to finish AHU 3 belts at no charge" /></Field>
            <Field label="Follow up by (optional)"><TextInput type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></Field>
            <PrimaryButton onClick={() => { if (!summary.trim()) return; onAdd({ id: uid(), type, date, who: who.trim(), summary: summary.trim(), followUp: followUp || null, by: userName }); setSummary(""); setFollowUp(""); }}><CheckCircle2 size={15} /> Add to log</PrimaryButton>
          </div>
        )}
        {log.length === 0 && <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 12 }}>No contacts logged yet. Keeping a record of calls and agreements helps with disputes and contract reviews.</div>}
        {log.map((c) => (
          <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px" }}>
            <div style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600 }}>{fmtDate(c.date)} · {CONTACT_TYPES[c.type]}{c.who ? ` with ${c.who}` : ""} · {c.by}</div>
            <div style={{ fontSize: 12.8, whiteSpace: "pre-wrap", marginTop: 2 }}>{c.summary}</div>
            {c.followUp && (c.followUpDone ? <div style={{ fontSize: 11.5, color: "var(--ok)", fontWeight: 650, marginTop: 2 }}>✓ Followed up</div> : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: daysUntil(c.followUp) < 0 ? "var(--danger)" : "var(--warn)" }}>Follow up by {fmtDate(c.followUp)}</span>
                {ACTIVE_CAN_EDIT && onFollowUpDone && <button onClick={() => onFollowUpDone(c.id)} style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Done</button>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
export function MergeSuppliersModal({ suppliers, onClose, onMerge }) {
  const [dropId, setDropId] = useState("");
  const [keepId, setKeepId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const drop = suppliers.find((s) => s.id === dropId); const keep = suppliers.find((s) => s.id === keepId);
  return (
    <Modal title="Merge duplicate suppliers" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Moves everything linked to one supplier — services, visits, works, budget lines, POs, invoices, spares, waste records — onto the other, then removes the duplicate.</div>
        <Field label="Duplicate to remove"><Select value={dropId} onChange={(e) => { setDropId(e.target.value); setConfirm(false); }}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Keep and move everything to"><Select value={keepId} onChange={(e) => { setKeepId(e.target.value); setConfirm(false); }}><option value="">—</option>{suppliers.filter((s) => s.id !== dropId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        {drop && keep && !confirm && <PrimaryButton onClick={() => setConfirm(true)}><Merge size={15} /> Merge "{drop.name}" into "{keep.name}"…</PrimaryButton>}
        {drop && keep && confirm && <button onClick={() => onMerge(keepId, dropId)} style={{ background: "#9B2C2C", color: "#fff", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, merge — you can undo straight after</button>}
      </div>
    </Modal>
  );
}

export function SupplierImportModal({ existing, onClose, onImport }) {
  const [text, setText] = useState("");
  const rows = text.trim() ? parseDelimited(text) : [];
  const head = (rows[0] || []).map((h) => String(h).trim().toLowerCase());
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const ix = { name: col("name", "supplier", "company", "supplier name"), cat: col("category", "type"), sub: col("subcategory", "sub category", "service"), mgr: col("contact", "contact name", "account manager", "manager"), email: col("email", "e-mail", "contact email"), phone: col("phone", "telephone", "mobile"), ooh: col("out of hours", "ooh", "emergency", "24h"), cost: col("cost", "contract value", "value"), freq: col("frequency", "per"), end: col("contract end", "end date", "expiry") };
  const have = new Set(existing.map((s) => s.name.trim().toLowerCase()));
  const catKey = (v) => { const t = String(v || "").trim().toLowerCase(); return CATEGORY_KEYS.find((k) => k === t || CATEGORY_META[k].label.toLowerCase() === t) || "maintenance"; };
  const get = (r, k) => (ix[k] >= 0 ? String(r[ix[k]] ?? "").trim() : "");
  const parsed = rows.slice(1).map((r) => ({ name: get(r, "name"), category: catKey(get(r, "cat")), subCategory: get(r, "sub"), managerName: get(r, "mgr"), managerEmail: get(r, "email"), managerPhone: get(r, "phone"), oohPhone: get(r, "ooh"), costAmount: Number(get(r, "cost").replace(/[£,]/g, "")) || 0, costFrequency: /year|annual/i.test(get(r, "freq")) ? "annual" : "monthly", contractEnd: toISO(get(r, "end")), status: "approved" })).filter((p) => p.name);
  const fresh = parsed.filter((p) => !have.has(p.name.toLowerCase()));
  return (
    <Modal title="Import suppliers" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Copy your supplier list from Excel (with a header row) and paste it below. Recognised columns: Name, Category, Subcategory, Contact, Email, Phone, Out of hours, Cost, Frequency, Contract end.</div>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Upload size={14} /> Upload an Excel or CSV file
          <input type="file" accept=".xlsx,.csv,.txt" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setText(/\.xlsx$/i.test(f.name) ? await xlsxToText(f) : await f.text()); } catch (x) { alert("Couldn't read that file — try copying the cells and pasting them instead."); } }} style={{ display: "none" }} />
        </label>
        <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste cells here" style={{ minHeight: 100, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
        {rows.length > 0 && ix.name < 0 && <div style={{ fontSize: 12, color: "var(--danger)" }}>No "Name" column found in the header row.</div>}
        {parsed.length > 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{fresh.length} new · {parsed.length - fresh.length} already in the list (skipped)</div>}
        {fresh.slice(0, 8).map((p, i) => <div key={i} style={{ fontSize: 12, background: "var(--card-hi)", borderRadius: 7, padding: "5px 8px" }}><b>{p.name}</b> <span style={{ color: "var(--faint)" }}>· {CATEGORY_META[p.category]?.label}{p.managerEmail ? ` · ${p.managerEmail}` : ""}</span></div>)}
        <PrimaryButton onClick={() => fresh.length && onImport(fresh)}><FileSpreadsheet size={15} /> Import {fresh.length} supplier{fresh.length === 1 ? "" : "s"}</PrimaryButton>
      </div>
    </Modal>
  );
}
