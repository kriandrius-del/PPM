// Excel template for adding services in bulk, styled like the app, with dropdowns.
// ExcelJS is loaded only when someone downloads or uploads a sheet, so the app stays fast.
import { CONDITION_GRADES, CRITICALITY } from "./constants.js";
import { CATEGORY_KEYS, CATEGORY_META } from "./globals.js";

async function loadExcel() {
  const mod = await import("exceljs");
  return mod.default || mod;
}

const NAVY = "FF1B2430";
const ACCENT = "FF2B5D8A";
const AMBER = "FFD97706";
const GROUND = "FFEEF1F4";
const SOFT = "FFF6F8FA";
const BORDER = "FFDCE1E7";
const MUTED = "FF56616D";
const EXAMPLE_PREFIX = "Example — ";
const INTERVALS = [1, 2, 3, 4, 6, 12, 24, 36, 60];
const FIRST_ROW = 6; // first row people fill in (row 5 is the example)
const LAST_ROW = 505;

// Column definitions: header text (matches the importer), width, help note, and how it's checked.
const COLUMNS = [
  { key: "name", header: "Service name", width: 42, required: true, note: "What it is, e.g. \"AHU 3 filter change\" or \"Fire alarm quarterly test\". Required." },
  { key: "category", header: "Category", width: 18, list: "categories", note: "Pick from the list. Decides which budget it counts against." },
  { key: "area", header: "Area / room", width: 22, list: "areas", allowOther: true, note: "Pick an existing area or type a new one." },
  { key: "supplier", header: "Supplier", width: 26, list: "suppliers", allowOther: true, note: "Pick from your suppliers. A name that isn't in the app is left blank on import — add the supplier in the app first to link it." },
  { key: "interval", header: "Interval (months)", width: 14, list: "intervals", allowOther: true, note: "How often it's serviced: 1 = monthly, 3 = quarterly, 6 = six-monthly, 12 = yearly." },
  { key: "next", header: "Next due", width: 14, date: true, note: "Date of the next visit, e.g. 15/11/2026." },
  { key: "budget", header: "Budget per visit", width: 15, money: true, note: "Expected cost of one visit in £ (numbers only)." },
  { key: "criticality", header: "Criticality", width: 13, list: "criticality", note: "Critical = failure stops the building or is a safety risk." },
  { key: "condition", header: "Condition", width: 17, list: "conditions", note: "Condition grade A (good) to D (bad)." },
  { key: "assetTag", header: "Asset tag", width: 13, note: "Your own reference, e.g. AHU-03." },
  { key: "sub", header: "Subcategory", width: 18, note: "Optional, e.g. HVAC, Fire safety." },
  { key: "type", header: "Equipment type", width: 18, note: "Optional, e.g. Air handling unit." },
  { key: "make", header: "Manufacturer", width: 16, note: "Optional." },
  { key: "model", header: "Model", width: 14, note: "Optional." },
  { key: "serial", header: "Serial number", width: 16, note: "Optional." },
  { key: "installed", header: "Install date", width: 14, date: true, note: "Optional, e.g. 01/06/2018." },
];
const colLetter = (i) => String.fromCharCode(65 + i);

export async function buildServicesTemplate({ suppliers = [], areas = [], locationName = "", companyName = "" } = {}) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "PPM Service Book";
  wb.created = new Date();
  const font = { name: "Arial", size: 10, color: { argb: "FF16202C" } };
  const thin = { style: "thin", color: { argb: BORDER } };
  const lastCol = colLetter(COLUMNS.length - 1);

  // Dropdown sources (written to a hidden "Lists" sheet at the end)
  const listData = {
    categories: CATEGORY_KEYS.map((k) => CATEGORY_META[k].label),
    suppliers: [...new Set(suppliers.map((s) => s.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    areas: [...new Set(areas.filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    intervals: INTERVALS,
    criticality: Object.values(CRITICALITY).map((c) => c.label),
    conditions: Object.values(CONDITION_GRADES).map((c) => c.label),
  };
  const listRef = {};
  Object.entries(listData).forEach(([name, values], i) => { if (values.length) listRef[name] = `Lists!$${colLetter(i)}$2:$${colLetter(i)}$${values.length + 1}`; });

  // ---------- Services: the sheet people fill in ----------
  const ws = wb.addWorksheet("Services", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 20, tabColor: { argb: ACCENT } },
  });
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  // Title band (row 1–2), legend (row 3), headers (row 4)
  ws.mergeCells(`A1:${lastCol}1`);
  const title = ws.getCell("A1");
  title.value = `${companyName ? `${companyName} · ` : ""}PPM Service Book — add services in bulk`;
  title.font = { name: "Arial", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  title.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells(`A2:${lastCol}2`);
  const sub = ws.getCell("A2");
  sub.value = `${locationName ? `${locationName} · ` : ""}Created ${new Date().toLocaleDateString("en-GB")} · Upload this file in the app: Services → Import services from a spreadsheet`;
  sub.font = { name: "Arial", size: 9.5, color: { argb: "FFF2B45A" } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sub.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 20;
  ws.mergeCells(`A3:${lastCol}3`);
  const legend = ws.getCell("A3");
  legend.value = "Fill in the white rows from row 6. Columns marked ▾ have a dropdown — click the cell and use the arrow. Only Service name is required. The grey row 5 is an example: overwrite or delete it (rows starting \"Example —\" are ignored).";
  legend.font = { name: "Arial", size: 9.5, color: { argb: MUTED } };
  legend.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUND } };
  legend.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  ws.getRow(3).height = 30;

  const head = ws.getRow(4);
  head.height = 30;
  COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = `${c.header}${c.required ? " *" : ""}${c.list ? " ▾" : ""}`;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? AMBER : ACCENT } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    cell.border = { bottom: { style: "medium", color: { argb: NAVY } } };
  });

  // Example row (row 5)
  const ex = {
    name: `${EXAMPLE_PREFIX}Emergency lighting monthly test`, category: CATEGORY_META.maintenance?.label || listData.categories[0],
    area: listData.areas[0] || "Ground floor", supplier: listData.suppliers[0] || "", interval: 1,
    next: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), budget: 45, criticality: "High", condition: CONDITION_GRADES.B.label,
    assetTag: "EL-01", sub: "Fire safety", type: "Emergency lighting", make: "", model: "", serial: "", installed: null,
  };
  const exRow = ws.getRow(5);
  COLUMNS.forEach((c, i) => {
    const cell = exRow.getCell(i + 1);
    cell.value = ex[c.key] ?? null;
    cell.font = { ...font, italic: true, color: { argb: "FF7A8591" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
    cell.border = { bottom: thin };
    cell.alignment = { vertical: "middle", indent: 1 };
    if (c.date) cell.numFmt = "dd/mm/yyyy";
    if (c.money) cell.numFmt = "£#,##0.00";
  });

  // Input rows: white cells with light grid, formats and dropdowns
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    const row = ws.getRow(r);
    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = font;
      cell.border = { top: thin, bottom: thin, left: thin, right: thin };
      cell.alignment = { vertical: "middle", indent: 1 };
      if (c.date) cell.numFmt = "dd/mm/yyyy";
      if (c.money) cell.numFmt = "£#,##0.00";
      if (c.required) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
    });
  }
  COLUMNS.forEach((c, i) => {
    const L = colLetter(i);
    const range = `${L}5:${L}${LAST_ROW}`;
    if (c.list && listRef[c.list]) {
      ws.dataValidations.add(range, {
        type: "list", allowBlank: true, formulae: [listRef[c.list]], showErrorMessage: true,
        errorStyle: c.allowOther ? "information" : "stop",
        errorTitle: c.header, error: c.allowOther ? `That ${c.header.toLowerCase()} isn't in the list yet — it will be added as typed.` : `Please pick a ${c.header.toLowerCase()} from the dropdown.`,
        showInputMessage: true, promptTitle: c.header, prompt: c.note.slice(0, 250),
      });
    } else if (c.date) {
      ws.dataValidations.add(range, { type: "date", operator: "greaterThan", allowBlank: true, formulae: [new Date(1990, 0, 1)], showErrorMessage: true, errorStyle: "stop", errorTitle: c.header, error: "Please enter a date, e.g. 15/11/2026.", showInputMessage: true, promptTitle: c.header, prompt: c.note });
    } else if (c.money) {
      ws.dataValidations.add(range, { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorStyle: "stop", errorTitle: c.header, error: "Please enter an amount in pounds, numbers only.", showInputMessage: true, promptTitle: c.header, prompt: c.note });
    } else if (c.required) {
      ws.dataValidations.add(range, { type: "textLength", operator: "lessThanOrEqual", allowBlank: true, formulae: [120], showInputMessage: true, promptTitle: c.header, prompt: c.note });
    }
  });
  // Highlight next-due dates that are already in the past
  const nextCol = colLetter(COLUMNS.findIndex((c) => c.key === "next"));
  ws.addConditionalFormatting({
    ref: `${nextCol}${FIRST_ROW}:${nextCol}${LAST_ROW}`,
    rules: [{ type: "expression", formulae: [`AND(${nextCol}${FIRST_ROW}<>"",${nextCol}${FIRST_ROW}<TODAY())`], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFBEAEA" } }, font: { color: { argb: "FFC53030" }, bold: true } } }],
  });
  ws.autoFilter = { from: "A4", to: `${lastCol}4` };

  // ---------- How to fill in ----------
  const help = wb.addWorksheet("How to fill in", { views: [{ showGridLines: false }], properties: { tabColor: { argb: AMBER } } });
  help.columns = [{ width: 22 }, { width: 12 }, { width: 70 }];
  help.mergeCells("A1:C1");
  const ht = help.getCell("A1");
  ht.value = "How to fill in the services sheet";
  ht.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  ht.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ht.alignment = { vertical: "middle", indent: 1 };
  help.getRow(1).height = 30;
  const steps = [
    "1. Go to the Services sheet and fill in one row per service, starting at row 6.",
    "2. Use the dropdowns (▾) where you can — they match the names used in the app.",
    "3. Save the file, then in the app open Services → Import services from a spreadsheet and choose this file.",
    "4. Check the preview: rows with problems are flagged before anything is imported. Services that already exist are skipped.",
  ];
  steps.forEach((t, i) => {
    help.mergeCells(`A${i + 2}:C${i + 2}`);
    const c = help.getCell(`A${i + 2}`); c.value = t; c.font = { name: "Arial", size: 10 }; c.alignment = { vertical: "middle", indent: 1, wrapText: true };
    help.getRow(i + 2).height = 20;
  });
  const hr = help.getRow(7);
  ["Column", "Required?", "What to enter"].forEach((t, i) => {
    const c = hr.getCell(i + 1); c.value = t;
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    c.alignment = { vertical: "middle", indent: 1 };
  });
  hr.height = 22;
  COLUMNS.forEach((col, i) => {
    const r = help.getRow(8 + i);
    r.getCell(1).value = col.header; r.getCell(2).value = col.required ? "Yes" : "Optional"; r.getCell(3).value = col.note + (col.list ? " (dropdown)" : "");
    [1, 2, 3].forEach((n) => {
      const c = r.getCell(n);
      c.font = { name: "Arial", size: 10, bold: n === 1, color: { argb: n === 2 && col.required ? AMBER : "FF16202C" } };
      c.alignment = { vertical: "middle", wrapText: true, indent: 1 };
      c.border = { bottom: thin };
      if (i % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
    });
    r.height = 30;
  });
  // Hidden sheet holding the dropdown lists
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });
  Object.entries(listData).forEach(([name, values], i) => {
    const L = colLetter(i);
    lists.getCell(`${L}1`).value = name;
    values.forEach((v, j) => { lists.getCell(`${L}${j + 2}`).value = v; });
  });
  wb.views = [{ activeTab: 0, firstSheet: 0, visibility: "visible" }];
  const buf = await wb.xlsx.writeBuffer();
  return buf;
}

// Read an uploaded .xlsx into rows of text (like a CSV), using the Services sheet if present.
export async function readSpreadsheetRows(arrayBuffer) {
  const ExcelJS = await loadExcel();
  let wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(arrayBuffer); }
  catch (e) {
    // Some programs save cell notes in a way the reader can't handle — notes aren't needed, so drop them and retry.
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await stripNotes(arrayBuffer));
  }
  const ws = wb.getWorksheet("Services") || wb.worksheets.find((s) => s.state !== "veryHidden" && s.state !== "hidden") || wb.worksheets[0];
  if (!ws) return [];
  const pad = (n) => String(n).padStart(2, "0");
  const text = (v) => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
    if (typeof v === "object") {
      if (v.result !== undefined) return text(v.result);
      if (v.richText) return v.richText.map((t) => t.text).join("");
      if (v.text !== undefined) return String(v.text);
      return "";
    }
    return String(v);
  };
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = [];
    for (let i = 1; i <= Math.max(ws.columnCount, row.cellCount); i++) vals.push(text(row.getCell(i).value).trim());
    if (vals.some((v) => v)) rows.push(vals);
  });
  return rows;
}

async function stripNotes(buf) {
  const mod = await import("jszip"); const JSZip = mod.default || mod;
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  for (const n of names) if (/(^|\/)comments[^/]*\.xml$|\/comments\/|vmlDrawing|threadedComments|persons\//i.test(n)) zip.remove(n);
  for (const n of names.filter((x) => /^xl\/worksheets\/_rels\/.*\.rels$/.test(x) && zip.file(x))) {
    const x = await zip.file(n).async("string");
    zip.file(n, x.replace(/<Relationship [^>]*Type="[^"]*\/(comments|vmlDrawing|threadedComment)"[^>]*\/>/g, ""));
  }
  for (const n of names.filter((x) => /^xl\/worksheets\/[^/]+\.xml$/.test(x) && zip.file(x))) {
    const x = await zip.file(n).async("string");
    zip.file(n, x.replace(/<legacyDrawing[^>]*\/>/g, ""));
  }
  if (zip.file("[Content_Types].xml")) {
    const ct = await zip.file("[Content_Types].xml").async("string");
    zip.file("[Content_Types].xml", ct.replace(/<Override [^>]*PartName="[^"]*(comments|vmlDrawing|threadedComment|person)[^"]*"[^>]*\/>/gi, ""));
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

export const TEMPLATE_EXAMPLE_PREFIX = EXAMPLE_PREFIX;

// A styled, app-coloured Excel export of any table.
export async function buildStyledSheet({ title, subtitle = "", sheetName = "Sheet1", headers, rows, widths = [], numFmts = {}, cellStyle = null }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook(); wb.creator = "PPM Service Book";
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
  const lastCol = colLetter(Math.min(25, headers.length - 1));
  ws.mergeCells(`A1:${lastCol}1`); const t = ws.getCell("A1");
  t.value = title; t.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; t.alignment = { vertical: "middle", indent: 1 }; ws.getRow(1).height = 30;
  ws.mergeCells(`A2:${lastCol}2`); const s2 = ws.getCell("A2");
  s2.value = subtitle; s2.font = { name: "Arial", size: 9.5, color: { argb: "FFF2B45A" } };
  s2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; s2.alignment = { vertical: "middle", indent: 1 };
  const hr = ws.getRow(3); hr.height = 28;
  headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } }; c.alignment = { vertical: "middle", wrapText: true, indent: 1 }; });
  const thin = { style: "thin", color: { argb: BORDER } };
  rows.forEach((r, ri) => {
    const row = ws.getRow(4 + ri);
    r.forEach((v, ci) => {
      const c = row.getCell(ci + 1); c.value = v === "" ? null : v;
      c.font = { name: "Arial", size: 10 }; c.border = { bottom: thin }; c.alignment = { vertical: "middle", indent: 1 };
      if (ri % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
      if (numFmts[ci]) c.numFmt = numFmts[ci];
      if (cellStyle) cellStyle(c, v, ri, ci);
    });
  });
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = widths[i] || 14; });
  ws.autoFilter = { from: "A3", to: `${colLetter(Math.min(25, headers.length - 1))}3` };
  return wb.xlsx.writeBuffer();
}
export function excelColour(c, hex, fontHex) {
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } };
  if (fontHex) c.font = { ...(c.font || {}), name: "Arial", size: 10, bold: true, color: { argb: `FF${fontHex}` } };
  c.alignment = { horizontal: "center", vertical: "middle" };
}
export function xlsxBlob(buf) { return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); }
// Turn an uploaded .xlsx into tab-separated text (for the existing paste-style importers).
export async function xlsxToText(file) { const rows = await readSpreadsheetRows(await file.arrayBuffer()); return rows.map((r) => r.join("\t")).join("\n"); }

// Several styled sheets in one workbook (used for the budget pack).
export async function buildWorkbook(sheets) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook(); wb.creator = "PPM Service Book";
  const thin = { style: "thin", color: { argb: BORDER } };
  sheets.forEach((sh) => {
    const ws = wb.addWorksheet(sh.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
    const lastCol = colLetter(Math.min(25, sh.headers.length - 1));
    ws.mergeCells(`A1:${lastCol}1`); const t = ws.getCell("A1"); t.value = sh.title; t.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } }; t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; t.alignment = { vertical: "middle", indent: 1 }; ws.getRow(1).height = 28;
    ws.mergeCells(`A2:${lastCol}2`); const s2 = ws.getCell("A2"); s2.value = sh.subtitle || ""; s2.font = { name: "Arial", size: 9.5, color: { argb: "FFF2B45A" } }; s2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; s2.alignment = { vertical: "middle", indent: 1 };
    const hr = ws.getRow(3); hr.height = 24;
    sh.headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } }; c.alignment = { vertical: "middle", wrapText: true, indent: 1 }; });
    const money = new Set(sh.money || []); const dates = new Set(sh.dates || []);
    sh.rows.forEach((r, ri) => {
      const row = ws.getRow(4 + ri); const isTotal = String(r[0]) === "Total";
      r.forEach((v, ci) => { const c = row.getCell(ci + 1); c.value = v === "" ? null : (typeof v === "number" ? Math.round(v * 100) / 100 : v); c.font = { name: "Arial", size: 10, bold: isTotal }; c.border = { bottom: thin }; c.alignment = { vertical: "middle", indent: 1 }; if (ri % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } }; if (money.has(ci)) c.numFmt = "£#,##0.00"; if (dates.has(ci)) c.numFmt = "dd/mm/yyyy"; if (isTotal) c.border = { top: { style: "medium", color: { argb: NAVY } } }; });
    });
    sh.headers.forEach((_, i) => { ws.getColumn(i + 1).width = (sh.widths || [])[i] || 14; });
  });
  return wb.xlsx.writeBuffer();
}
