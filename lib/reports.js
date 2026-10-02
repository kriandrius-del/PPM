// Printable reports, QR sticker sheets, permits, calendar and Excel exports.
import { COMPLIANCE_GRACE_DAYS, CONDITION_GRADES, CONTACT_TYPES, CRITICALITY, INCIDENT_TYPES, MONTH_LABELS, PERMIT_PRECAUTIONS, WORK_STATUSES } from "./constants.js";
import { ACTIVE_CURRENCY_CODE, ACTIVE_CUSTOM_FIELDS, ACTIVE_SLA, CATEGORY_KEYS, CATEGORY_META, siteInfoText } from "./globals.js";
import { addDays, appBaseUrl, collectActuals, computeCompliance, csvEscape, currentBooking, daysUntil, downloadBlob, escapeHtml, fmtDate, gbp, isMirrored, plusDays, qrImageUrl, replacementYear, supplierStats, ukDate, workSla } from "./utils.js";

export function printStickers(device, locationLabel, stickers) {
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

export function printBulkStickers(devs, locationLabel) {
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

export function buildBlankChecklist(d, supplierById) {
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

export function printPermit(p, devices, locationName) {
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

export function buildChaseEmail(supplier, jobs, locationText, senderName) {
  const first = (supplier?.managerName || "").split(" ")[0] || "there";
  const lines = jobs.map((d) => {
    const late = -daysUntil(d.nextServiceDate);
    return `• ${d.name}${d.assetTag ? ` (${d.assetTag})` : ""} — due ${fmtDate(d.nextServiceDate)}, ${late} day${late === 1 ? "" : "s"} overdue`;
  });
  const subject = `Outstanding scheduled visits${locationText ? ` — ${locationText}` : ""}`;
  const body = `Hi ${first},\n\nThe following scheduled visit${jobs.length === 1 ? " hasn't" : "s haven't"} been completed yet${locationText ? ` at ${locationText}` : ""}:\n\n${lines.join("\n")}\n\nCould you please confirm when ${jobs.length === 1 ? "this will" : "these will"} be attended to, and send over the service report once done?\n\nThanks,\n${senderName || ""}`;
  return { subject, body };
}

/* ---------------------------------------------------------
   Reports — print-ready pages the browser can save as PDF
--------------------------------------------------------- */
export function openPrintReport(title, subtitle, bodyHtml) {
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

export const money = (n) => gbp(Number(n) || 0);

export function tableHtml(headers, rows, numericCols = []) {
  if (!rows.length) return `<div class="muted">Nothing to show.</div>`;
  return `<table><tr>${headers.map((h, i) => `<th${numericCols.includes(i) ? ' class="num"' : ""}>${escapeHtml(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td${numericCols.includes(i) ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
}

export function pctClass(p) { return p === null || p === undefined ? "muted" : p >= 90 ? "ok" : p >= 70 ? "warn" : "bad"; }

export function buildComplianceReport(data, year, month) {
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

export function buildSpendReport(data, year) {
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

export function buildSupplierReport(data, year) {
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

export function buildAssetRecord(d, services, tasks, supplierById) {
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

export function buildJobSheet(data) {
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
    [r.d.instructions && `<i>${e(r.d.instructions)}</i>`, r.d.accessNotes && e(r.d.accessNotes), (r.d.ramsRequired || r.d.permits?.length) && `<b>${[r.d.ramsRequired && "RAMS", ...(r.d.permits || [])].filter(Boolean).map(e).join(", ")}</b>`].filter(Boolean).join("<br>"),
    box, "<span style=\"display:inline-block;width:90px;border-bottom:1px solid #8A94A0\">&nbsp;</span>",
  ]))}`;
}

export function buildAssetRegister(data) {
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

export function buildKeyRegister(keys) {
  const e = escapeHtml;
  return `<div class="kpis"><div class="kpi">Keys & cards<b>${keys.length}</b></div><div class="kpi">Issued<b>${keys.filter((k) => k.holder).length}</b></div><div class="kpi">Overdue back<b class="bad">${keys.filter((k) => k.holder && k.dueBack && daysUntil(k.dueBack) < 0).length}</b></div></div>
  ${tableHtml(["Key / card", "No.", "Opens", "Kept in", "Currently with", "Since", "Due back"], [...keys].sort((a, b) => a.label.localeCompare(b.label)).map((k) => [`<b>${e(k.label)}</b><div class="muted">${k.type === "card" ? "Access card" : k.type === "fob" ? "Fob" : "Key"}</div>`, e(k.number || ""), e(k.opens || ""), e(k.kept || ""), k.holder ? `<b>${e(k.holder)}</b>${k.holderCompany ? `<div class="muted">${e(k.holderCompany)}</div>` : ""}` : '<span class="ok">In</span>', k.issuedAt ? fmtDate(k.issuedAt.slice(0, 10)) : "", k.dueBack ? `<span class="${daysUntil(k.dueBack) < 0 ? "bad" : ""}">${fmtDate(k.dueBack)}</span>` : ""]))}
  <h2>Audit check</h2><div>Checked by ____________________ &nbsp; Date __________ &nbsp; All keys accounted for: ☐ Yes ☐ No</div>`;
}
export function buildManagementReport(data, year, month) {
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

export function buildLifecycleReport(data) {
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

export function downloadIcs(devices, tasks, visitBudgets, suppliers, locationName) {
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
export const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();

export function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

export function zipStore(files) {
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

export function xmlEsc(t) { return String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }

export function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

// sheet: { name, headers: [...], rows: [[...]], money: [colIdx], pct: [colIdx], widths: [...] }
export function buildXlsx(sheets) {
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

export function workbookSheets(data, year) {
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

export function downloadWorkbook(data, year, locationName) {
  const safe = (locationName || "ppm").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  downloadBlob(buildXlsx(workbookSheets(data, year)), `ppm-${safe}-${year}.xlsx`);
}

export function buildAccountingCsv(format, items, supMap, accountCode) {
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

export function buildConditionReport(data) {
  const e = escapeHtml;
  const list = [...data.devices].sort((a, b) => (a.condition || "Z").localeCompare(b.condition || "Z") * -1 || ((CRITICALITY[a.criticality || "normal"]?.rank ?? 2) - (CRITICALITY[b.criticality || "normal"]?.rank ?? 2)));
  const count = (g) => data.devices.filter((d) => d.condition === g).length;
  const rows = (arr) => arr.map((d) => [
    `<b>${e(d.name)}</b>${d.area ? `<div class="muted">${e(d.area)}</div>` : ""}`,
    d.condition ? `<span style="font-weight:700;color:${CONDITION_GRADES[d.condition].color}">${e(CONDITION_GRADES[d.condition].label)}</span>` : '<span class="muted">not graded</span>',
    e(CRITICALITY[d.criticality || "normal"].label), d.conditionDate ? fmtDate(d.conditionDate) : "",
    replacementYear(d) ? String(replacementYear(d)) : "", d.replacementCost ? money(d.replacementCost) : "", e(d.conditionNotes || ""),
  ]);
  const actionNow = list.filter((d) => d.condition === "D" || (d.condition === "C" && d.criticality === "critical"));
  return `<div class="kpis">${["A", "B", "C", "D"].map((g) => `<div class="kpi">${e(CONDITION_GRADES[g].label)}<b style="color:${CONDITION_GRADES[g].color}">${count(g)}</b></div>`).join("")}<div class="kpi">Not graded<b>${data.devices.filter((d) => !d.condition).length}</b></div></div>
  ${actionNow.length ? `<h2>Action now — grade D, or grade C on a critical asset</h2>${tableHtml(["Asset", "Condition", "Criticality", "Graded", "Replace", "Est. cost", "Notes"], rows(actionNow))}` : ""}
  <h2>All assets</h2>${tableHtml(["Asset", "Condition", "Criticality", "Graded", "Replace", "Est. cost", "Notes"], rows(list))}
  <div class="muted">A Good · B Satisfactory · C Poor · D Bad. Grades are set per service under Asset details.</div>`;
}

export function buildPortfolioReport(p) {
  const e = escapeHtml; const yr = new Date().getFullYear();
  const rows = p.locations.map((l) => {
    const ds = p.devices.filter((d) => d.locationId === l.id && !d.archived); const ids = new Set(ds.map((d) => d.id));
    const vs = p.services.filter((v) => ids.has(v.deviceId)); const ws = p.works.filter((w) => ids.has(w.deviceId));
    const overdue = ds.filter((d) => d.nextServiceDate && daysUntil(d.nextServiceDate) < 0).length;
    const comp = computeCompliance(ds, p.visitBudgets.filter((v) => ids.has(v.deviceId)), vs);
    const spend = vs.filter((v) => String(v.date).startsWith(String(yr))).reduce((t, v) => t + (Number(v.cost) || 0), 0) + ws.filter((w) => String(w.dateRaised).startsWith(String(yr)) && ["approved", "in_progress", "completed"].includes(w.status)).reduce((t, w) => t + (Number(w.finalCost ?? w.quoteAmount) || 0), 0);
    const budget = p.budgets.filter((b) => b.locationId === l.id && b.year === yr).reduce((t, b) => t + (Number(b.amount) || 0), 0);
    const openWorks = ws.filter((w) => !["completed", "rejected"].includes(w.status)).length;
    return { l, n: ds.length, overdue, pct: comp.pct, spend, budget, openWorks, country: p.countries.find((c) => c.id === l.countryId)?.name || "" };
  });
  return `<div class="kpis"><div class="kpi">Sites<b>${rows.length}</b></div><div class="kpi">Services<b>${rows.reduce((t, r) => t + r.n, 0)}</b></div><div class="kpi">Overdue<b class="${rows.some((r) => r.overdue) ? "bad" : "ok"}">${rows.reduce((t, r) => t + r.overdue, 0)}</b></div><div class="kpi">Spend ${yr}<b>${money(rows.reduce((t, r) => t + r.spend, 0))}</b></div></div>
  ${tableHtml(["Site", "Services", "Overdue", "PPM on time", "Open works", `Spend ${yr}`, "Budget", "Used"], rows.sort((a, b) => b.overdue - a.overdue).map((r) => [`<b>${e(r.l.name)}</b><div class="muted">${e(r.country)}</div>`, String(r.n), r.overdue ? `<span class="bad">${r.overdue}</span>` : "0", r.pct == null ? "—" : `<span class="${r.pct >= 90 ? "ok" : r.pct >= 70 ? "warn" : "bad"}">${r.pct}%</span>`, String(r.openWorks), money(r.spend), r.budget ? money(r.budget) : "—", r.budget ? `${Math.round((r.spend / r.budget) * 100)}%` : "—"]), [5, 6])}`;
}
export function buildSupplierPack(s, d) {
  const e = escapeHtml; const since = addDays(new Date().toISOString().slice(0, 10), -90);
  const mine = (v) => v.supplierId === s.id || (!v.supplierId && d.devices.find((x) => x.id === v.deviceId)?.supplierId === s.id);
  const devs = d.devices.filter((x) => x.supplierId === s.id);
  const visits = d.services.filter((v) => mine(v) && v.date >= since).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const overdue = devs.filter((x) => x.nextServiceDate && daysUntil(x.nextServiceDate) < 0);
  const upcoming = devs.filter((x) => x.nextServiceDate && daysUntil(x.nextServiceDate) >= 0 && daysUntil(x.nextServiceDate) <= 60).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate));
  const works = d.works.filter((w) => w.supplierId === s.id && !["completed", "rejected"].includes(w.status));
  const rated = d.services.filter((v) => mine(v) && v.rating); const avg = rated.length ? (rated.reduce((t, v) => t + v.rating, 0) / rated.length).toFixed(1) : "—";
  const late = visits.filter((v) => v.lateReason).length; const notDone = visits.filter((v) => v.aborted).length;
  const inv = (d.invoices || []).filter((i) => i.supplierId === s.id && i.status !== "paid");
  return `<div class="kpis"><div class="kpi">Visits (90 days)<b>${visits.length}</b></div><div class="kpi">Late<b class="${late ? "warn" : "ok"}">${late}</b></div><div class="kpi">Not completed<b class="${notDone ? "bad" : "ok"}">${notDone}</b></div><div class="kpi">Overdue now<b class="${overdue.length ? "bad" : "ok"}">${overdue.length}</b></div><div class="kpi">Rating<b>${avg}</b></div></div>
  ${overdue.length ? `<h2>Overdue — agree dates</h2>${tableHtml(["Service", "Was due", "Days"], overdue.map((x) => [e(x.name), fmtDate(x.nextServiceDate), String(-daysUntil(x.nextServiceDate))]))}` : ""}
  ${works.length ? `<h2>Open works</h2>${tableHtml(["Raised", "Service", "Work", "Status", "Target", "Quote"], works.map((w) => [fmtDate(w.dateRaised), e(d.devices.find((x) => x.id === w.deviceId)?.name || ""), e(w.description), e(w.status.replace("_", " ")), workSla(w) ? fmtDate(workSla(w).deadline) : "", money(w.quoteAmount)]))}` : ""}
  ${upcoming.length ? `<h2>Coming up (60 days)</h2>${tableHtml(["Due", "Service", "Booked"], upcoming.map((x) => [fmtDate(x.nextServiceDate), e(x.name), currentBooking(x) ? `${currentBooking(x).date ? fmtDate(currentBooking(x).date) : ""} ${e(currentBooking(x).time || "")}` : '<span class="warn">not booked</span>']))}` : ""}
  ${visits.length ? `<h2>Visits in the last 90 days</h2>${tableHtml(["Date", "Service", "Outcome", "Cost"], visits.map((v) => [fmtDate(v.date), e(d.devices.find((x) => x.id === v.deviceId)?.name || ""), v.aborted ? `<span class="bad">Not completed — ${e(v.abortReason || "")}</span>` : v.lateReason ? `<span class="warn">Late — ${e(v.lateReason)}</span>` : '<span class="ok">Done</span>', money(v.cost)]), [3])}` : ""}
  ${inv.length ? `<h2>Invoices not yet paid</h2>${tableHtml(["Invoice", "Date", "Amount", "Status"], inv.map((i) => [e(i.number), fmtDate(i.date), money(i.amount), e(i.status)]))}` : ""}
  ${(s.contactLog || []).length ? `<h2>Recent contact</h2>${tableHtml(["Date", "Type", "Summary"], s.contactLog.slice(0, 8).map((c) => [fmtDate(c.date), e(CONTACT_TYPES[c.type] || ""), e(c.summary)]))}` : ""}
  <h2>Actions agreed</h2><div style="height:110px;border:1px solid #D7DCE1;border-radius:6px"></div>`;
}

export function buildSlaReport(data, year) {
  const e = escapeHtml; const ys = String(year);
  const ws = data.works.filter((w) => String(w.dateRaised).startsWith(ys) && w.status !== "rejected");
  const done = ws.filter((w) => w.status === "completed");
  const row = (list) => { const fin = list.filter((w) => w.status === "completed"); const late = fin.filter((w) => workSla(w)?.breached).length; const openLate = list.filter((w) => w.status !== "completed" && workSla(w)?.breached).length; return [String(list.length), String(fin.length), fin.length ? `${Math.round(((fin.length - late) / fin.length) * 100)}%` : "—", String(openLate)]; };
  const pr = ["high", "medium", "low"].map((p) => [e(p[0].toUpperCase() + p.slice(1)), ...row(ws.filter((w) => (w.priority || "medium") === p))]);
  const sups = [...new Set(ws.map((w) => w.supplierId).filter(Boolean))].map((id) => [e(data.supplierById[id]?.name || "?"), ...row(ws.filter((w) => w.supplierId === id))]);
  const cats = [...new Set(ws.map((w) => w.category).filter(Boolean))].map((c) => [e(c), ...row(ws.filter((w) => w.category === c))]);
  const lateDone = done.filter((w) => workSla(w)?.breached).length;
  return `<div class="kpis"><div class="kpi">Works raised<b>${ws.length}</b></div><div class="kpi">Completed<b>${done.length}</b></div><div class="kpi">On time<b class="${lateDone ? "warn" : "ok"}">${done.length ? Math.round(((done.length - lateDone) / done.length) * 100) + "%" : "—"}</b></div><div class="kpi">Open & overdue<b class="bad">${ws.filter((w) => w.status !== "completed" && workSla(w)?.breached).length}</b></div></div>
  <h2>By priority</h2>${tableHtml(["Priority", "Raised", "Completed", "On time", "Open & late"], pr)}
  ${sups.length ? `<h2>By supplier</h2>${tableHtml(["Supplier", "Raised", "Completed", "On time", "Open & late"], sups)}` : ""}
  ${cats.length ? `<h2>By trade</h2>${tableHtml(["Trade", "Raised", "Completed", "On time", "Open & late"], cats)}` : ""}
  <div class="muted">Targets: high ${ACTIVE_SLA.high}, medium ${ACTIVE_SLA.medium}, low ${ACTIVE_SLA.low} ${ACTIVE_SLA.workingDays ? "working " : ""}days from being raised.</div>`;
}
export function buildIncidentTrend(data, year) {
  const e = escapeHtml; const ys = String(year);
  const inc = (data.incidents || []).filter((i) => String(i.date).startsWith(ys));
  const types = Object.keys(INCIDENT_TYPES);
  const byMonth = MONTH_LABELS.map((m, i) => [m, ...types.map((t) => String(inc.filter((x) => x.type === t && new Date(x.date).getMonth() === i).length || "")), String(inc.filter((x) => new Date(x.date).getMonth() === i).length || "")]);
  const causes = {}; inc.forEach((i) => { if (i.rootCause) causes[i.rootCause] = (causes[i.rootCause] || 0) + 1; });
  const areas = {}; inc.forEach((i) => { if (i.area) areas[i.area] = (areas[i.area] || 0) + 1; });
  return `<div class="kpis"><div class="kpi">Incidents ${ys}<b>${inc.length}</b></div><div class="kpi">Injuries<b class="${inc.some((i) => i.type === "injury") ? "bad" : "ok"}">${inc.filter((i) => i.type === "injury").length}</b></div><div class="kpi">Near misses<b>${inc.filter((i) => i.type === "near_miss").length}</b></div><div class="kpi">RIDDOR<b>${inc.filter((i) => i.riddor).length}</b></div></div>
  <h2>By month</h2>${tableHtml(["Month", ...types.map((t) => e(INCIDENT_TYPES[t])), "Total"], byMonth)}
  ${Object.keys(causes).length ? `<h2>Root causes</h2>${tableHtml(["Cause", "Count"], Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([c, n]) => [e(c), String(n)]))}` : ""}
  ${Object.keys(areas).length ? `<h2>Where</h2>${tableHtml(["Area", "Count"], Object.entries(areas).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => [e(c), String(n)]))}` : ""}
  <div class="muted">A healthy safety culture reports plenty of near misses — they show people are spotting hazards before anyone gets hurt.</div>`;
}
export function buildWallPlanner(data, year) {
  const e = escapeHtml;
  const devs = [...data.devices].sort((a, b) => (a.area || "~").localeCompare(b.area || "~") || a.name.localeCompare(b.name));
  const datesFor = (d) => new Set([...(data.visitBudgets || []).filter((v) => v.deviceId === d.id).map((v) => v.date), d.nextServiceDate].filter((x) => x && String(x).startsWith(String(year))).map((x) => new Date(x).getMonth()));
  const done = (d) => new Set(data.services.filter((v) => v.deviceId === d.id && String(v.date).startsWith(String(year)) && !v.aborted && !v.skipped).map((v) => new Date(v.date).getMonth()));
  return `<style>@page{size:A4 landscape}.wp td{text-align:center;padding:3px}.wp td:first-child{text-align:left}</style>
  <table class="wp"><thead><tr><th>Service</th>${MONTH_LABELS.map((m) => `<th>${m}</th>`).join("")}</tr></thead><tbody>
  ${devs.map((d) => { const p = datesFor(d), dn = done(d); return `<tr><td><b>${e(d.name)}</b>${d.area ? ` <span class="muted">${e(d.area)}</span>` : ""}</td>${MONTH_LABELS.map((_, i) => `<td>${dn.has(i) ? '<span class="ok">●</span>' : p.has(i) ? "○" : ""}</td>`).join("")}</tr>`; }).join("")}
  </tbody></table><div class="muted">○ planned · <span class="ok">●</span> done. Print on A4 landscape for the plant room or office wall.</div>`;
}
export function buildWorkOrderSheet(w, device, supplier, locationName) {
  const e = escapeHtml; const sla = workSla(w);
  return `${tableHtml(["", ""], [["Work order", `<b>${e(w.poNumber || w.id.slice(-6).toUpperCase())}</b>`], ["Site", e(locationName)], ["Service / asset", `${e(device?.name || "")}${device?.assetTag ? ` (#${e(device.assetTag)})` : ""}${device?.area ? ` — ${e(device.area)}` : ""}`], ["Supplier", e(supplier?.name || "")], ["Priority", e(w.priority || "medium")], ["Raised", fmtDate(w.dateRaised)], ["Complete by", sla ? fmtDate(sla.deadline) : ""], ["Agreed amount", Number(w.quoteAmount) ? money(w.quoteAmount) : ""], ["Trade", e(w.category || "")]].filter((r) => r[1]))}
  <h2>Work required</h2><div style="white-space:pre-wrap">${e(w.description)}</div>
  ${device?.accessNotes || device?.instructions ? `<h2>Access & instructions</h2><div>${e([device.accessNotes, device.instructions].filter(Boolean).join("\n")).replace(/\n/g, "<br>")}</div>` : ""}
  ${siteInfoText() ? `<h2>Site</h2><div>${e(siteInfoText()).replace(/\n/g, "<br>")}</div>` : ""}
  <h2>Completion</h2><div>Work completed ☐ &nbsp; Area left safe and clean ☐</div><div style="margin-top:10px">Engineer ____________________ Date ________ &nbsp; Signed for site ____________________</div>`;
}
