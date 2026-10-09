// One compliance register built from what the app already records: statutory services, check logs,
// equipment inspections, water temperatures, fire drills, asbestos, COSHH, training, documents,
// contractor insurance and licence dates. Every row says why it's red, amber or green.
import { STATUTORY_ITEMS } from "../../lib/constants.js";
import { addDays, addMonths, daysUntil, matchStatutory } from "../../lib/utils.js";

export const RAG = { red: { label: "Red", tone: "danger", rank: 0 }, amber: { label: "Amber", tone: "warn", rank: 1 }, green: { label: "Green", tone: "ok", rank: 2 } };
const AREA_OF_STAT = { fire_alarm: "Fire", em_light: "Fire", extinguishers: "Fire", fra: "Fire", fire_doors: "Fire", sprinklers: "Fire", gas: "Gas", eicr: "Electrical", pat: "Electrical", lightning: "Electrical", legionella_ra: "Water", water_temps: "Water", lifts: "Lifting", fgas: "HVAC / F-gas", kitchen_extract: "Kitchen", asbestos: "Asbestos" };
export const COMPLIANCE_AREAS = ["Fire", "Water", "Gas", "Electrical", "Lifting", "Asbestos", "COSHH", "HVAC / F-gas", "Kitchen", "Training", "Contractors", "Documents", "Checks", "Equipment", "Other"];

function ragFromDue(n, amberDays = 30) {
  if (n === null) return null;
  return n < 0 ? "red" : n <= amberDays ? "amber" : "green";
}
const dueText = (n) => n === null ? "no date set" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? "due today" : `due in ${n} day${n === 1 ? "" : "s"}`;
const freqText = (d) => Number(d.repeatEveryDays) > 0 ? `Every ${d.repeatEveryDays} days` : Number(d.serviceIntervalMonths) > 0 ? (Number(d.serviceIntervalMonths) === 12 ? "Yearly" : Number(d.serviceIntervalMonths) === 1 ? "Monthly" : `Every ${d.serviceIntervalMonths} months`) : "One-off";

// The statutory item a service is for: the one whose matching keyword is the most specific ("f-gas" beats "gas").
function bestStatItem(items, d) {
  const hay = ` ${[d.name, d.category, d.subCategory].filter(Boolean).join(" ").toLowerCase()} `;
  let best = null, len = 0;
  items.forEach((it) => (it.keywords || []).forEach((k) => {
    const ok = k.length <= 3 ? new RegExp(`\\b${k}\\b`).test(hay) : hay.includes(k);
    if (ok && k.length > len) { best = it; len = k.length; }
  }));
  return best;
}
export function complianceRegister({ siteId, devices = [], services = [], suppliers = [], equipment = [], waterOutlets = [], waterReadings = [], drills = [], asbestos = [], coshh = [], training = [], keyDates = [], settings = {}, logEntries = [] }) {
  const rows = [];
  const today = new Date().toISOString().slice(0, 10);
  const push = (r) => rows.push({ siteId, actions: [], ...r });
  const devs = devices.filter((d) => d.locationId === siteId && !d.archived);
  const lastVisit = (id) => services.filter((v) => v.deviceId === id && !v.skipped && !v.aborted).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const supName = (id) => suppliers.find((s) => s.id === id)?.name || "";
  // 1. Statutory services (named in the UK list, certificate required, or tagged statutory)
  const na = (settings.statutoryNA || {})[siteId] || [];
  const statItems = [...STATUTORY_ITEMS, ...(settings.customStatutory || []).map((c) => ({ ...c, custom: true }))];
  const covered = new Set();
  devs.forEach((d) => {
    const item = bestStatItem(statItems.filter((it) => !na.includes(it.key)), d);
    const statutory = !!item || d.certRequired || (d.tags || []).some((t) => /statutory|compliance/i.test(t));
    if (!statutory) return;
    if (item) covered.add(item.key);
    const n = daysUntil(d.nextServiceDate);
    const lv = lastVisit(d.id);
    const reasons = [];
    let status = ragFromDue(n) || "amber";
    if (n === null) reasons.push("No next date set");
    else reasons.push(`Next visit ${dueText(n)}`);
    if (d.certRequired && lv && !lv.certificatePhoto && !(lv.attachments || []).length) { reasons.push("Last visit has no certificate attached"); if (status === "green") status = "amber"; }
    const fails = (lv?.checklistResults || []).filter((x) => x.result === "fail").length;
    if (fails) { reasons.push(`${fails} check${fails === 1 ? "" : "s"} failed at the last visit`); if (status === "green") status = "amber"; }
    push({ id: `svc-${d.id}`, area: AREA_OF_STAT[item?.key] || (d.subCategory && /fire/i.test(d.subCategory) ? "Fire" : "Other"), requirement: d.name, assetId: d.id,
      responsible: d.assignee || supName(d.supplierId) || "", frequency: freqText(d), standard: item?.freq || "", last: lv?.date || d.lastServiceDate || "", next: d.nextServiceDate || "",
      evidence: lv?.certificatePhoto ? "Certificate on file" : lv ? "Visit logged" : "", status, reasons, risk: d.criticality === "critical" ? "high" : d.criticality === "high" ? "medium" : "low", target: { kind: "asset", id: d.id } });
  });
  // statutory requirements with nothing set up (and not marked not-applicable)
  statItems.filter((it) => !it.custom && !na.includes(it.key) && !covered.has(it.key) && !devs.some((d) => matchStatutory(it, d))).forEach((it) => {
    push({ id: `stat-${it.key}`, area: AREA_OF_STAT[it.key] || "Other", requirement: it.label, frequency: it.freq, last: "", next: "", evidence: "", status: "amber",
      reasons: ["No service set up for this yet — add one, or mark it not applicable"], risk: "medium", missing: true, statKey: it.key, target: { kind: "section", id: "safety.register" } });
  });
  // 2. Check logs (fire alarm weekly test etc.)
  (settings.logDefs || []).filter((l) => Number(l.everyDays) > 0 && (!l.locationId || l.locationId === siteId)).forEach((l) => {
    const last = logEntries.filter((e) => e.logId === l.id && e.locationId === siteId).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const next = last ? addDays(last.date, Number(l.everyDays)) : "";
    const n = next ? daysUntil(next) : null;
    const status = !last ? "amber" : n < 0 ? "red" : n <= Math.min(3, Number(l.everyDays)) ? "amber" : "green";
    push({ id: `log-${l.id}`, area: /fire|alarm|emergency/i.test(l.name) ? "Fire" : /water|legionella|flush|temp/i.test(l.name) ? "Water" : "Checks", requirement: l.name, frequency: `Every ${l.everyDays} day${Number(l.everyDays) === 1 ? "" : "s"}`,
      last: last?.date || "", next, evidence: last ? `Logged by ${last.by || "—"}` : "", status, reasons: [!last ? "Never logged" : `Next check ${dueText(n)}`], risk: "medium", target: { kind: "section", id: "ops.logs" } });
  });
  // 3. Equipment inspections
  equipment.filter((q) => q.locationId === siteId && q.status !== "withdrawn").forEach((q) => {
    const n = daysUntil(q.nextDue);
    let status = q.status === "failed" ? "red" : ragFromDue(n) || "amber";
    push({ id: `eq-${q.id}`, area: /extinguisher|fire/i.test(`${q.type} ${q.name}`) ? "Fire" : /lift|loler|hoist/i.test(`${q.type} ${q.name}`) ? "Lifting" : "Equipment", requirement: `${q.name}${q.ref ? ` (${q.ref})` : ""}`,
      frequency: q.everyMonths ? `Every ${q.everyMonths} months` : "", last: q.lastInspected || "", next: q.nextDue || "", evidence: q.lastInspected ? "Inspection recorded" : "",
      status, reasons: [q.status === "failed" ? "Failed its last inspection — withdraw or repair" : n === null ? "No next inspection date" : `Inspection ${dueText(n)}`], risk: q.status === "failed" ? "high" : "medium", target: { kind: "section", id: "safety.equipment" } });
  });
  // 4. Water temperatures (L8): every outlet read at least monthly
  const outlets = waterOutlets.filter((o) => o.locationId === siteId && !o.archived);
  if (outlets.length) {
    const lastByOutlet = outlets.map((o) => waterReadings.filter((r) => r.outletId === o.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.date || "");
    const oldest = lastByOutlet.filter(Boolean).sort()[0] || "";
    const never = lastByOutlet.filter((x) => !x).length;
    const late = lastByOutlet.filter((x) => x && daysUntil(addMonths(x, 1)) < 0).length;
    const next = oldest ? addMonths(oldest, 1) : "";
    const n = next ? daysUntil(next) : null;
    const status = never || late ? "red" : n !== null && n <= 7 ? "amber" : "green";
    push({ id: `water-${siteId}`, area: "Water", requirement: `Monthly water temperatures (${outlets.length} outlet${outlets.length === 1 ? "" : "s"})`, frequency: "Monthly (ACoP L8)", last: lastByOutlet.filter(Boolean).sort().pop() || "", next,
      evidence: `${outlets.length - never} of ${outlets.length} outlets have readings`, status, reasons: [never ? `${never} outlet${never === 1 ? "" : "s"} never read` : late ? `${late} outlet${late === 1 ? "" : "s"} not read for over a month` : `Next round ${dueText(n)}`], risk: "high", target: { kind: "section", id: "safety.water" } });
  }
  // 5. Fire drills (at least yearly; the date you set wins)
  const lastDrill = drills.filter((d) => d.locationId === siteId).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  {
    const next = ((settings.nextDrill || {})[siteId]) || (lastDrill ? addMonths(lastDrill.date, 12) : "");
    const n = next ? daysUntil(next) : null;
    push({ id: `drill-${siteId}`, area: "Fire", requirement: "Fire evacuation drill", frequency: "At least yearly", last: lastDrill?.date || "", next, evidence: lastDrill ? `${lastDrill.people || "—"} people, ${lastDrill.minutes || "—"} min` : "",
      status: !lastDrill && !next ? "amber" : ragFromDue(n, 30) || "amber", reasons: [!lastDrill ? "No drill recorded" : `Next drill ${dueText(n)}`], risk: "high", target: { kind: "section", id: "safety.drills" } });
  }
  // 6. Asbestos re-inspections
  asbestos.filter((a) => a.locationId === siteId && a.action !== "Removed" && a.status !== "removed").forEach((a) => {
    const n = daysUntil(a.nextInspection);
    const status = a.risk === "high" ? "red" : ragFromDue(n) || "amber";
    push({ id: `asb-${a.id}`, area: "Asbestos", requirement: `Asbestos: ${a.location}`, frequency: "Yearly re-inspection", last: a.lastInspection || "", next: a.nextInspection || "", evidence: a.sampleRef ? `Sample ${a.sampleRef}` : "",
      status, reasons: [a.risk === "high" ? "High-risk material — act on the action plan" : n === null ? "No re-inspection date" : `Re-inspection ${dueText(n)}`], risk: a.risk || "medium", target: { kind: "section", id: "safety.asbestos" } });
  });
  // 7. COSHH assessments
  coshh.filter((c) => c.locationId === siteId && !c.archived).forEach((c) => {
    const n = daysUntil(c.reviewDate);
    push({ id: `coshh-${c.id}`, area: "COSHH", requirement: `COSHH: ${c.product}`, frequency: "Review yearly", last: c.assessed || "", next: c.reviewDate || "", evidence: c.sdsUrl ? "Safety data sheet linked" : "",
      status: ragFromDue(n) || "amber", reasons: [n === null ? "No review date" : `Review ${dueText(n)}`], risk: (c.hazards || []).some((h) => /toxic|corrosive|flammable/i.test(h)) ? "medium" : "low", target: { kind: "section", id: "safety.coshh" } });
  });
  // 8. Training certificates
  training.filter((t) => t.locationId === siteId && t.expiry).forEach((t) => {
    const n = daysUntil(t.expiry);
    push({ id: `tr-${t.id}`, area: "Training", requirement: `${t.course} — ${t.person}`, responsible: t.person, frequency: "Refresher before expiry", last: t.date || "", next: t.expiry, evidence: t.certPhoto ? "Certificate on file" : t.provider || "",
      status: ragFromDue(n, 60) || "amber", reasons: [`Certificate ${n < 0 ? "expired" : "expires"} ${n < 0 ? `${-n} days ago` : `in ${n} days`}`], risk: "low", target: { kind: "section", id: "safety.training" } });
  });
  // 9. Site documents with a review/expiry date (FRA, EICR, insurance…)
  ((settings.siteDocs || []).filter((d) => d.locationId === siteId && d.reviewDate)).forEach((d) => {
    const n = daysUntil(d.reviewDate);
    push({ id: `doc-${d.id}`, area: /fire/i.test(d.type) ? "Fire" : /legionella/i.test(d.type) ? "Water" : /eicr|electrical/i.test(d.type) ? "Electrical" : /gas/i.test(d.type) ? "Gas" : /asbestos/i.test(d.type) ? "Asbestos" : /lift|loler/i.test(d.type) ? "Lifting" : "Documents",
      requirement: d.title || d.type, frequency: "Review / renewal", last: d.issued || "", next: d.reviewDate, evidence: d.url ? "Document linked" : d.heldBy || "", status: ragFromDue(n, 60) || "amber", reasons: [`Review ${dueText(n)}`], risk: "medium", target: { kind: "section", id: "resources.docs" } });
  });
  // 10. Contractor insurance and accreditations
  suppliers.filter((s) => s.locationId === siteId && s.status !== "blocked").forEach((s) => {
    [["insuranceExpiry", "Public liability insurance"], ["accreditationExpiry", s.accreditation || "Accreditation"]].forEach(([f, label]) => {
      if (!s[f]) return;
      const n = daysUntil(s[f]);
      push({ id: `sup-${f}-${s.id}`, area: "Contractors", requirement: `${s.name}: ${label}`, responsible: s.managerName || "", frequency: "Renew before expiry", last: "", next: s[f], evidence: "",
        status: ragFromDue(n, 30) || "amber", reasons: [`${label} ${n < 0 ? "expired" : "expires"} ${n < 0 ? `${-n} days ago` : `in ${n} days`}`], risk: "medium", target: { kind: "supplier", id: s.id } });
    });
  });
  // 11. Licences and statutory filings in Key dates
  keyDates.filter((k) => k.locationId === siteId && !k.done && /licen|permit|statutory|certificate/i.test(`${k.type} ${k.title}`)).forEach((k) => {
    const n = daysUntil(k.date);
    push({ id: `kd-${k.id}`, area: "Documents", requirement: k.title, frequency: k.type, last: "", next: k.date, evidence: "", status: ragFromDue(n, Number(k.notifyDays) || 30) || "amber", reasons: [`${dueText(n)}`], risk: "medium", target: { kind: "section", id: "resources.keydates" } });
  });
  rows.sort((a, b) => RAG[a.status].rank - RAG[b.status].rank || String(a.next || "9999").localeCompare(String(b.next || "9999")));
  const counts = { red: rows.filter((r) => r.status === "red").length, amber: rows.filter((r) => r.status === "amber").length, green: rows.filter((r) => r.status === "green").length };
  return { rows, counts, total: rows.length, today };
}
