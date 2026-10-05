// Budget plan, spend, variance, accounting export, roll-forward.
import { useState, useMemo, useEffect } from "react";
import { ShieldAlert, Plus, Sparkles, CopyPlus, FileCheck, CheckCircle2, Pencil, ChevronDown, Trash2, Loader2, Camera, ChevronLeft, ChevronRight, Receipt, Download } from "lucide-react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";
import { CategoryBadge, CategoryOptions, ConfirmDeleteButton, EmptyState, ExportButton, Field, MetricBlock, Modal, PrimaryButton, Select, SubCategoryField, TextInput, ToggleButton } from "../components/ui.jsx";
import { MONTH_LABELS, WEEKDAY_LABELS } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE, CATEGORY_KEYS, CATEGORY_META, emptyCatMap } from "../lib/globals.js";
import { buildAccountingCsv } from "../lib/reports.js";
import { addDays, addMonths, collectActuals, compressImage, downloadBlob, fmtDate, gbp, getMonthGrid, isMirrored, suggestForDevice, toISODate } from "../lib/utils.js";
import { BudgetChecks, BudgetOverview, BudgetTools, CostLinesView, PlanImportModal, budgetModel, exportBudgetPack, printBudgetSummary } from "./BudgetPlus.jsx";

/* ---------------------------------------------------------
   Budget & Cost comparison Tab
--------------------------------------------------------- */

export function BudgetTab({ serviceSync = null, onOpenService, costLines = [], onSaveCostLines, onDeleteCostLine, onRecordInvoice, invoices = [], pos = [], savings = [], floorArea = 0, budgetSettings = {}, onSaveBs, onMoveBudget, onSetBudgetsBulk, onBulkUpdateLines, onBulkDeleteLines, userNames = [], userName = "", locationName = "", onRollForward, budgets, services, works, suppliers, devices, budgetLines, visitBudgets, subcategoriesByCategory, onSetBudget, onAddLines, onUpdateLine, onDeleteLine, onApplySuggestion, shiftDateFn = (d) => d }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [view, setView] = useState("overview"); // 'overview' | 'month' | 'year' | 'calendar' | 'plan' | 'variance' | 'checks' | 'tools'
  const [planQ, setPlanQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calSelectedDate, setCalSelectedDate] = useState(null);
  const [planGroupBy, setPlanGroupBy] = useState("category"); // 'category' | 'subcategory' | 'supplier' | 'month'
  const [planView, setPlanView] = useState("sheet"); // 'sheet' | 'grouped'
  const [recordingSpendFor, setRecordingSpendFor] = useState(null); // budget line
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [addingLine, setAddingLine] = useState(false);
  const [editingLine, setEditingLine] = useState(null);

  const bs = budgetSettings || {};
  const model = useMemo(() => budgetModel({ year, budgets, services, works, suppliers, devices, budgetLines, costLines, bs }), [year, budgets, services, works, suppliers, devices, budgetLines, costLines, bs]);
  const prevModel = useMemo(() => budgetModel({ year: year - 1, budgets, services, works, suppliers, devices, budgetLines, costLines, bs, asOf: `${year - 1}-12-31` }), [year, budgets, services, works, suppliers, devices, budgetLines, costLines, bs]);
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
  const qMatch = (l) => !planQ.trim() || [l.description, CATEGORY_META[l.category]?.label, l.subCategory, supplierById[l.supplierId]?.name].filter(Boolean).some((v) => v.toLowerCase().includes(planQ.trim().toLowerCase()));
  const displaySheetLines = (showOnlyOverdue ? sheetLines.filter((l) => l.actualAmount == null && l.date < todayISO) : sheetLines).filter(qMatch);

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
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100, fontSize: 13, visibility: view === "costlines" ? "hidden" : "visible" }}>
          {Array.from({ length: 6 }, (_, i) => thisYear - 4 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <div style={{ display: "flex", gap: 10 }}>
          <MetricBlock label="Total budget" value={gbp(totalBudget)} />
          <MetricBlock label={variance >= 0 ? "Remaining" : "Over budget"} value={gbp(Math.abs(variance))} tone={variance >= 0 ? "ok" : "danger"} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {[["overview", "Overview"], ["costlines", "Cost lines"], ["plan", "Plan"], ["month", "Month"], ["year", "Year"], ["calendar", "Calendar"], ["variance", "Variance"], ["checks", "Checks"], ["tools", "Tools"]].map(([k, l]) => <ToggleButton key={k} active={view === k} onClick={() => setView(k)}>{l}</ToggleButton>)}
      </div>
      {view === "overview" && <BudgetOverview model={model} prevModel={prevModel} year={year} services={services} works={works} suppliers={suppliers} devices={devices} invoices={invoices} pos={pos} savings={savings} floorArea={floorArea} bs={bs} onSaveBs={onSaveBs} />}
      {view === "costlines" && <CostLinesView onOpenService={onOpenService} serviceRowsFor={(cat, fy, fyS) => {
        const key = (y, m) => { const idx = (y - fy) * 12 + (m - fyS); return idx >= 0 && idx < 12 ? idx : -1; };
        return devices.filter((d) => !d.archived && (d.serviceCategory || "maintenance") === cat).map((d) => {
          const budget = Array(12).fill(0); const actual = Array(12).fill(null); let visits = 0;
          budgetLines.forEach((l) => { if (l.deviceId !== d.id || l.status === "skipped") return; const [y, m] = String(l.date).split("-").map(Number); const k = key(y, m); if (k < 0) return; budget[k] += Number(l.amount) || 0; visits++; });
          services.forEach((v) => { if (v.deviceId !== d.id || !Number(v.cost)) return; const [y, m] = String(v.date).split("-").map(Number); const k = key(y, m); if (k < 0) return; actual[k] = (actual[k] || 0) + Number(v.cost); });
          return { id: `svc-${d.id}`, deviceId: d.id, name: d.name, budget, actual, visits, auto: true };
        }).filter((r) => r.budget.some(Boolean) || r.actual.some((x) => x != null));
      }} lines={costLines} suppliers={suppliers} fyStart={Number(bs.fyStart) || 1} bs={bs} onSaveBs={onSaveBs} onSaveMany={onSaveCostLines} onDelete={onDeleteCostLine} onRecordInvoice={onRecordInvoice} locationName={locationName} userName={userName} />}
      {view === "checks" && serviceSync && <ServiceSyncPanel sync={serviceSync} />}
      {view === "tools" && serviceSync && ACTIVE_CAN_EDIT && <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}><div style={{ flex: "1 1 240px", fontSize: 13 }}><b>Plan service visits ahead</b><div style={{ fontSize: 12, color: "var(--muted)" }}>Adds any missing planned visits for every service with a budget per visit — nothing existing is changed.</div></div><button onClick={() => serviceSync.onPlan(devices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0).map((d) => d.id), 12)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Next 12 months</button><button onClick={() => serviceSync.onPlan(devices.filter((d) => !d.archived && Number(d.budgetPerVisit) > 0).map((d) => d.id), 24)} style={{ background: "var(--card-hi)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Next 24 months</button></div>}
      {view === "checks" && <BudgetChecks costLines={costLines} fyStart={Number(bs.fyStart) || 1} model={model} year={year} services={services} works={works} suppliers={suppliers} devices={devices} budgetLines={budgetLines} invoices={invoices} />}
      {view === "tools" && <BudgetTools userName={userName} year={year} model={model} budgets={budgets} devices={devices} bs={bs} onSaveBs={onSaveBs} onMoveBudget={onMoveBudget} onSetBudgetsBulk={onSetBudgetsBulk} users={userNames} locationName={locationName} exportData={{ excel: () => exportBudgetPack({ model, year, locationName, lines: budgetLines, suppliers, bs }), print: () => printBudgetSummary({ model, year, locationName, bs }) }} />}
      {!["overview", "checks", "tools", "costlines"].includes(view) && <>
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
            <div key={cat} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                  <meta.icon size={14} color={meta.color} /> {meta.label}
                </span>
                {ACTIVE_CAN_EDIT && (
                  <button onClick={() => setEditingCategory(cat)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>
                    {max ? "Edit max" : "Set max"}
                  </button>
                )}
              </div>
              <div style={{ height: 7, background: "var(--card-hi)", borderRadius: 20, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: over ? "#C53030" : meta.color, borderRadius: 20, transition: "width .2s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--faint)" }}>
                <span>{gbp(actual)} spent</span>
                <span style={{ color: over ? "var(--danger)" : "var(--faint)", fontWeight: over ? 700 : 500 }}>
                  of {gbp(effectiveMax)} {max > 0 ? "max" : "planned"}
                </span>
              </div>
              {planned > 0 && (
                <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>
                  {gbp(planned)} planned across Budget → Plan lines this year{max === 0 ? " — set a max to cap it instead" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10.5, color: "var(--faint)", marginBottom: 10 }}>
        "Spent" above counts logged service costs, approved/completed works, recurring supplier contracts, and any Plan line where you've recorded an actual spend. Log the same cost in only one place to avoid double-counting it.
      </div>

      {nonControllableTotal > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--warn-soft)", border: "1px solid #E6D9BC", borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12.5, color: "var(--warn)", fontWeight: 600 }}>
          <ShieldAlert size={14} /> {gbp(nonControllableTotal)} in non-controllable works this year — outside category maximums.
        </div>
      )}

      </>}

      {(view === "month" || view === "year") && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <ToggleButton active={chartBreakdown === "total"} onClick={() => setChartBreakdown("total")}>Total</ToggleButton>
          <ToggleButton active={chartBreakdown === "supplier"} onClick={() => setChartBreakdown("supplier")}>By supplier</ToggleButton>
          <ToggleButton active={chartBreakdown === "service"} onClick={() => setChartBreakdown("service")}>By service</ToggleButton>
        </div>
      )}

      {view === "month" || view === "year" ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 8px 4px" }}>
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
            <div style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, padding: "20px 0" }}>No recorded spend to break down yet.</div>
          )}
        </div>
      ) : view === "variance" ? (
        <VarianceView year={year} devices={devices} services={services} works={works} budgetLines={budgetLines} suppliers={suppliers} />
      ) : view === "calendar" ? (
        <SpendCalendar year={year} month={calMonth} onMonthChange={setCalMonth} spendByDate={spendByDate}
          selectedDate={calSelectedDate} onSelectDate={setCalSelectedDate} />
      ) : view === "plan" ? (
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
            <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 12, marginTop: -6 }}>
              Nothing recorded as spent yet — tap any line below and enter its actual cost to start tracking against budget.
            </div>
          )}

          {(varianceByCategory.cleaning !== 0 || varianceByCategory.maintenance !== 0 || varianceByCategory.catering !== 0) && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {CATEGORY_KEYS.filter((c) => varianceByCategory[c] !== 0).map((c) => {
                const v = varianceByCategory[c];
                const meta = CATEGORY_META[c];
                return (
                  <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 650, background: v >= 0 ? "var(--ok-soft)" : "var(--danger-soft)", color: v >= 0 ? "var(--ok)" : "var(--danger)", padding: "5px 10px", borderRadius: 20 }}>
                    <meta.icon size={12} /> {meta.label} {v >= 0 ? "+" : ""}{gbp(v)}
                  </span>
                );
              })}
            </div>
          )}

          {overdueUnspentLines.length > 0 && (
            <button onClick={() => setShowOnlyOverdue((v) => !v)} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", background: showOnlyOverdue ? "var(--accent)" : "var(--warn-soft)",
              border: "1px solid " + (showOnlyOverdue ? "#2B4562" : "#E6D9BC"), borderRadius: 10, padding: "9px 12px", marginBottom: 12,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
              <ShieldAlert size={14} color={showOnlyOverdue ? "#fff" : "#8A5A0B"} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: showOnlyOverdue ? "#fff" : "var(--warn)", fontWeight: 650, flex: 1 }}>
                {overdueUnspentLines.length} line{overdueUnspentLines.length === 1 ? "" : "s"} past due with no spend recorded
                {showOnlyOverdue ? " — showing only these" : " — tap to filter"}
              </span>
            </button>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            <TextInput value={planQ} onChange={(e) => setPlanQ(e.target.value)} placeholder="Search plan lines (description, supplier, category)" style={{ flex: "1 1 200px", minWidth: 0 }} />
            {ACTIVE_CAN_EDIT && onAddLines && <button onClick={() => setImportOpen(true)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Import lines</button>}
            {ACTIVE_CAN_EDIT && onBulkUpdateLines && displaySheetLines.length > 0 && <button onClick={() => setBulkOpen((v) => !v)} style={{ background: bulkOpen ? "var(--accent)" : "var(--card-hi)", color: bulkOpen ? "var(--on-accent)" : "var(--accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Change {planQ.trim() ? "these" : "all"} {displaySheetLines.length}</button>}
          </div>
          {planQ.trim() && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{displaySheetLines.length} line{displaySheetLines.length === 1 ? "" : "s"} match · budgeted <b>{gbp(displaySheetLines.reduce((t, l) => t + (Number(l.amount) || 0), 0))}</b> · actual <b>{gbp(displaySheetLines.reduce((t, l) => t + (Number(l.actualAmount) || 0), 0))}</b></div>}
          {bulkOpen && <PlanBulkPanel lines={displaySheetLines} onApply={(map) => { onBulkUpdateLines(map); setBulkOpen(false); }} onDelete={(ids) => { onBulkDeleteLines(ids); setBulkOpen(false); }} />}
          {importOpen && <PlanImportModal year={year} suppliers={suppliers} onClose={() => setImportOpen(false)} onImport={(ls) => { onAddLines(ls); setImportOpen(false); }} />}
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
              width: "100%", background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 9, padding: "10px 14px",
              fontSize: 13.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 7, marginBottom: 14,
            }}><Plus size={15} /> Add contract line</button>
          )}
          {ACTIVE_CAN_EDIT && onApplySuggestion && (
            <button onClick={() => setShowSuggest(true)} style={{ width: "100%", background: "var(--card)", color: "var(--accent)", border: "1px dashed var(--border-strong)", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: -6, marginBottom: 14 }}>
              <Sparkles size={15} /> Suggest a 12-month plan
            </button>
          )}
          {ACTIVE_CAN_EDIT && onRollForward && yearLines.length > 0 && (
            <button onClick={() => setRollOpen(true)} style={{ width: "100%", background: "var(--card)", color: "var(--accent)", border: "1px dashed var(--border-strong)", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: -6, marginBottom: 14 }}>
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
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--card-hi)", borderBottom: "1px solid var(--border)" }}>
                      {["Date", "Service", "Category", "Budgeted", "Actual", "Variance", ""].map((h) => (
                        <th key={h} style={{ textAlign: h === "Date" || h === "Service" || h === "Category" ? "left" : "right", padding: "10px 10px", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displaySheetLines.map((l) => {
                      const spent = l.actualAmount != null;
                      const variance = spent ? Number(l.amount) - Number(l.actualAmount) : null;
                      return (
                        <tr key={l.id} onClick={() => setRecordingSpendFor(l)} style={{ borderBottom: "1px solid #F0F1F3", cursor: "pointer" }}>
                          <td style={{ padding: "10px 10px", whiteSpace: "nowrap", color: "var(--muted)" }}>{fmtDate(l.date)}</td>
                          <td style={{ padding: "10px 10px", fontWeight: 600, maxWidth: 160 }}>{l.description}</td>
                          <td style={{ padding: "10px 10px" }}><CategoryBadge category={l.category} subCategory={l.subCategory} /></td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(l.amount)}</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: spent ? "var(--text)" : "#C0C6CC" }}>{spent ? gbp(l.actualAmount) : "—"}</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: variance === null ? "#C0C6CC" : variance >= 0 ? "var(--ok)" : "var(--danger)" }}>
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
      ) : null}

      {perVisitRows.length > 0 && !["overview", "checks", "tools", "costlines"].includes(view) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Budget per visit vs actual</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {perVisitRows.map(({ device, avg, visits, targetAvg, variesByVisit }) => {
              const over = avg !== null && avg > targetAvg;
              return (
                <div key={device.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650 }}>{device.name}</div>
                    <div style={{ fontSize: 11, color: "var(--faint)" }}>{visits} logged visit{visits === 1 ? "" : "s"}{variesByVisit ? " · budget varies by visit" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: over ? "var(--danger)" : "var(--ok)" }}>
                      {avg !== null ? gbp(avg) : "—"} avg
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{variesByVisit ? "avg target " : "target "}{gbp(targetAvg)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {serviceLineRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Spend by service line ({year})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {serviceLineRows.map(({ device, total }) => (
              <div key={device.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Spend by supplier ({year})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {supplierRows.map(({ supplier, recurring, logged, total }) => (
              <div key={supplier.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CategoryBadge category={supplier.category} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{supplier.name}</span>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>{gbp(total)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>
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

export function BudgetGroupSection({ group, supplierById, onRecordSpend, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  const spentCount = group.lines.filter((l) => l.actualAmount != null).length;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px",
        background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <ChevronDown size={16} color="#8A94A0" style={{ flexShrink: 0, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{group.label}</span>
          <span style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600, flexShrink: 0 }}>{spentCount}/{group.lines.length} recorded</span>
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

export function BudgetLineRow({ line, supplier, onRecordSpend, onEdit, onDelete }) {
  const spent = line.actualAmount != null;
  const variance = spent ? Number(line.amount) - Number(line.actualAmount) : null;
  const [viewingPhoto, setViewingPhoto] = useState(false);
  return (
    <>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onRecordSpend} disabled={!ACTIVE_CAN_EDIT} style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: spent ? "none" : "1.5px solid var(--border-strong)",
          background: spent ? (variance >= 0 ? "#2F855A" : "#C53030") : "var(--card)", cursor: ACTIVE_CAN_EDIT ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {spent && <CheckCircle2 size={14} color="#fff" />}
        </button>
        {line.attachment && (
          <button onClick={() => setViewingPhoto(true)} style={{ width: 30, height: 30, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", padding: 0, cursor: "pointer", flexShrink: 0 }}>
            <img src={line.attachment} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        )}
        <button onClick={onEdit} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ fontSize: 13, fontWeight: 650 }}>{line.description}</div>
          <div style={{ fontSize: 11, color: "var(--faint)", display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <span>{fmtDate(line.date)}</span>
            {supplier && <span>· {supplier.name}</span>}
            <CategoryBadge category={line.category} subCategory={line.subCategory} />
          </div>
        </button>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13 }}>{gbp(spent ? line.actualAmount : line.amount)}</div>
          {spent && (
            <div style={{ fontSize: 10, fontWeight: 700, color: variance >= 0 ? "var(--ok)" : "var(--danger)" }}>
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

export function RecordSpendModal({ line, onClose, onSave, onEditDetails }) {
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
          <div style={{ fontSize: 12, color: "var(--faint)" }}>Budgeted for {fmtDate(line.date)}: <strong style={{ color: "var(--text)" }}>{gbp(line.amount)}</strong></div>
          {ACTIVE_CAN_EDIT && (
            <button onClick={onEditDetails} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, padding: 2, flexShrink: 0 }}>
              <Pencil size={11} /> Edit details
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Date spent"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={`Actual spend (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        </div>
        {amount && (
          <div style={{ fontSize: 12.5, fontWeight: 650, color: variance >= 0 ? "var(--ok)" : "var(--danger)" }}>
            {variance >= 0 ? `${gbp(variance)} under budget` : `${gbp(Math.abs(variance))} over budget`}
          </div>
        )}
        <PrimaryButton onClick={submit}><CheckCircle2 size={15} /> {alreadySpent ? "Update spend" : "Record spend"}</PrimaryButton>
        {alreadySpent && (
          <button onClick={clear} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>
            Clear — mark as not yet spent
          </button>
        )}
      </div>
    </Modal>
  );
}

export function AddBudgetLineModal({ suppliers, defaultYear, existing, subcategoriesByCategory, onClose, onSave, onDelete }) {
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
  const [capex, setCapex] = useState(!!existing?.capex);
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
      const patch = { description: description.trim(), category, subCategory: subCategory.trim(), supplierId: supplierId || null, date: startDate, amount: amt, attachment, capex: capex || undefined };
      if (existing.amount !== amt) {
        const prevHistory = existing.amountHistory || [];
        patch.amountHistory = [...prevHistory, { amount: existing.amount, changedAt: new Date().toISOString().slice(0, 10) }];
      }
      onSave([patch]);
      return;
    }
    if (repeat === "manual") {
      const lines = manualDates.filter(Boolean).map((date) => ({
        description: description.trim(), category, subCategory: subCategory.trim(), supplierId: supplierId || null, date, amount: amt, attachment, capex: capex || undefined,
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
      date: dateFor(i), amount: amt, attachment, capex: capex || undefined,
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
            <span style={{ fontSize: 10.5, color: "var(--faint)" }}>Pick any year — this doesn't have to match the year you're currently browsing.</span>
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
                border: "1px dashed var(--border)", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "var(--accent)", fontWeight: 650,
              }}><Plus size={13} /> Add another visit date</button>
            </div>
            <span style={{ fontSize: 11, color: "var(--faint)" }}>Creates {manualDates.filter(Boolean).length} lines, one per date above, all with the same description and amount.</span>
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
          <div style={{ fontSize: 11, color: "var(--faint)", background: "var(--card-hi)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontWeight: 700, marginBottom: 3, color: "var(--muted)" }}>Budget history</div>
            {existing.amountHistory.map((h, i) => (
              <div key={i}>{gbp(h.amount)} until {fmtDate(h.changedAt)}</div>
            ))}
            <div>{gbp(existing.amount)} since {fmtDate(existing.amountHistory[existing.amountHistory.length - 1].changedAt)}</div>
          </div>
        )}
        <Field label="Contract page / evidence photo (optional)">
          <label style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--muted)", fontSize: 12.5, background: attachment ? "transparent" : "#FAFBFC" }}>
            {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={15} />}
            {attachment ? "Replace photo" : "Attach a photo (e.g. the contract page)"}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          {attachment && <img src={attachment} alt="attachment preview" style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid var(--border)" }} />}
          <span style={{ fontSize: 10.5, color: "var(--faint)" }}>Storage here only holds images, not PDFs — a clear photo of the contract page works well as a substitute.</span>
        </Field>
        {!isEdit && repeat === "custom" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Field label="How many times a year"><TextInput type="number" min="1" max="365" value={customCount} onChange={(e) => setCustomCount(e.target.value)} placeholder="e.g. 7" /></Field>
            <span style={{ fontSize: 11, color: "var(--faint)" }}>
              Creates {Math.max(1, Number(customCount) || 1)} lines, spaced about {Math.round(365 / Math.max(1, Number(customCount) || 1))} days apart, starting from the start date.
            </span>
          </div>
        )}
        {!isEdit && (repeat === "weekly" || repeat === "monthly" || repeat === "quarterly") && (
          <span style={{ fontSize: 11, color: "var(--faint)" }}>
            Creates {repeat === "monthly" ? 12 : repeat === "weekly" ? 52 : 4} lines, one per {repeat === "monthly" ? "month" : repeat === "weekly" ? "week" : "quarter"}, starting from the start date — this can roll into the following year automatically.
          </span>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, fontWeight: 600, cursor: "pointer" }}><input type="checkbox" checked={capex} onChange={(e) => setCapex(e.target.checked)} style={{ margin: 0 }} /> Capital spend (capex) — a new or replacement asset rather than running cost</label>
        <PrimaryButton onClick={submit}>{isEdit ? <CheckCircle2 size={15} /> : <Plus size={15} />} {isEdit ? "Save changes" : "Add to plan"}</PrimaryButton>
        {isEdit && (
          confirmingDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onDelete} style={{ flex: 1, background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}>
              <Trash2 size={13} /> Delete this line
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

export function SpendCalendar({ year, month, onMonthChange, spendByDate, selectedDate, onSelectDate }) {
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
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => go(-1)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronLeft size={15} color="#5B6672" /></button>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
          <button onClick={() => go(1)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 7, padding: 6, cursor: "pointer" }}><ChevronRight size={15} color="#5B6672" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map((w) => <div key={w} style={{ fontSize: 10, fontWeight: 700, color: "var(--faint)", textAlign: "center" }}>{w}</div>)}
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
                minHeight: 40, borderRadius: 8, border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: total > 0 ? (flagged ? "var(--warn-soft)" : "#F1F4F7") : "var(--card)", cursor: total > 0 ? "pointer" : "default",
                padding: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontFamily: "inherit",
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text)" }}>{dt.getDate()}</span>
                {total > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: flagged ? "var(--warn)" : "var(--accent)" }}>£{total >= 1000 ? Math.round(total / 1000) + "k" : Math.round(total)}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDate && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{fmtDate(selectedDate)}</div>
          {selectedItems.map((item, i) => (
            <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: item.controllable ? "var(--muted)" : "var(--warn)", fontWeight: 600 }}>{item.controllable ? "Budgeted" : "Non-controllable"}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{gbp(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SetCategoryBudgetModal({ year, category, current, onClose, onSave }) {
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
   Copy a year's plan into the next year
--------------------------------------------------------- */
export function RollForwardModal({ year, lines, budgets, onClose, onApply }) {
  const [pct, setPct] = useState("3");
  const [caps, setCaps] = useState(true);
  const total = lines.reduce((t, l) => t + (Number(l.amount) || 0), 0);
  const f = 1 + (Number(pct) || 0) / 100;
  const hasCaps = budgets.some((b) => b.year === year);
  return (
    <Modal title={`Create the ${year + 1} plan`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Copies all {lines.length} {year} plan lines to the same dates in {year + 1} (moved out of blackout periods), as planned with nothing spent. Lines for archived services are skipped, and lines already in {year + 1} aren't duplicated.</div>
        <Field label="Price uplift (%)">
          <TextInput type="number" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} />
          <span style={{ fontSize: 11, color: "var(--faint)" }}>e.g. CPI or your contracts' indexation clause. Use 0 to copy prices as they are.</span>
        </Field>
        {hasCaps && (
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={caps} onChange={(e) => setCaps(e.target.checked)} style={{ margin: 0 }} /> Also copy category budget caps (with the same uplift)
          </label>
        )}
        <div style={{ background: "var(--card-hi)", borderRadius: 9, padding: "9px 11px", fontSize: 12.5 }}>
          {year}: <b>{gbp(total)}</b> → {year + 1}: <b>{gbp(total * f)}</b> <span style={{ color: "var(--faint)" }}>({(Number(pct) || 0) >= 0 ? "+" : ""}{gbp(total * f - total)})</span>
        </div>
        <PrimaryButton onClick={() => onApply(Number(pct) || 0, hasCaps && caps)}><CopyPlus size={15} /> Create {year + 1} plan</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Budget → Variance: planned vs actual with filters and drill-down
--------------------------------------------------------- */
export function VarianceView({ year, devices, services, works, budgetLines, suppliers }) {
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
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
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
          <div key={l} style={{ background: "var(--card-hi)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, color: "var(--faint)", fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(v)}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: 16 }}>Nothing planned or spent for these filters.</div> : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 4, fontSize: 10.5, fontWeight: 700, color: "var(--faint)", padding: "0 6px 4px" }}>
            <span>{groupBy[0].toUpperCase() + groupBy.slice(1)}</span><span style={{ textAlign: "right" }}>Planned</span><span style={{ textAlign: "right" }}>Actual</span><span style={{ textAlign: "right" }}>Variance</span>
          </div>
          {rows.map((r) => (
            <div key={r.key} style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setOpen(open === r.key ? null : r.key)} style={{ width: "100%", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 4, alignItems: "center", background: open === r.key ? "var(--card-hi)" : "none", border: "none", padding: "8px 6px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 12.5, fontWeight: 650, display: "flex", alignItems: "center", gap: 4 }}><ChevronDown size={12} color="#A3ABB4" style={{ transform: open === r.key ? "none" : "rotate(-90deg)" }} />{nameOf(r.key)}</span>
                <span style={cell}>{gbp(r.planned)}</span>
                <span style={cell}>{gbp(r.actual)}</span>
                <span style={{ ...cell, fontWeight: 700, color: vColor(r.variance) }}>{r.variance >= 0 ? "+" : "−"}{gbp(Math.abs(r.variance))}</span>
              </button>
              {open === r.key && (
                <div style={{ padding: "2px 6px 8px 22px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {r.entries.sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5 }}>
                      <span style={{ color: "var(--muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fmtDate(e.date)} · <b style={{ color: e.kind === "Planned" ? "var(--faint)" : "var(--accent)" }}>{e.kind}</b> · {e.label}{groupBy !== "service" && e.deviceId && devMap[e.deviceId] ? ` · ${devMap[e.deviceId].name}` : ""}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0, color: e.kind === "Planned" ? "var(--faint)" : "var(--text)" }}>{gbp(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Planned = Budget Plan lines. Actual = logged visit costs, approved/in-progress/completed extra works and costs recorded on plan lines. Recurring supplier contract fees and non-controllable works aren't included here. Tap a row to see what makes it up.</div>
    </div>
  );
}

export function AccountingExport({ data, year, month }) {
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
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Receipt size={20} color="#8E4585" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Accounting export (CSV)</div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>Costs laid out as bill lines for import.</div>
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
      <button onClick={go} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Download size={14} /> Download CSV</button>
      {msg && <div style={{ fontSize: 11.5, color: "var(--ok)" }}>{msg}</div>}
      <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Amounts are exported as net of VAT at the standard 20% rate. Import templates vary by account and change over time — check the column names against your system's current bill-import template, and fill in account codes and (for Sage) supplier account references to match your ledger. PO numbers are used as the invoice reference where set.</div>
    </div>
  );
}

export function SuggestPlanModal({ devices, services, visitBudgets, shiftDateFn, onClose, onApply }) {
  const suggestions = useMemo(() => devices.map((d) => suggestForDevice(d, services, visitBudgets, shiftDateFn)), [devices, services, visitBudgets]);
  const usable = suggestions.filter((s) => !s.skip && s.dates.length > 0);
  const [picked, setPicked] = useState(() => new Set(usable.map((s) => s.dev.id)));
  const chosen = usable.filter((s) => picked.has(s.dev.id));
  const total = chosen.reduce((a, s) => a + s.dates.length * s.amount, 0);
  return (
    <Modal title="Suggested 12-month plan" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Worked out from each service's repeat setting or visit history. Only dates not already in your plan are added; blackout days are avoided.</div>
        {suggestions.map((s) => s.skip || s.dates.length === 0 ? (
          <div key={s.dev.id} style={{ fontSize: 12, color: "var(--faint)", padding: "4px 2px" }}><b style={{ color: "var(--faint)" }}>{s.dev.name}</b> — {s.skip || `already fully planned (${s.already} visits)`}</div>
        ) : (
          <label key={s.dev.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)", borderRadius: 10, padding: 10, cursor: "pointer", background: picked.has(s.dev.id) ? "var(--card)" : "var(--card-hi)" }}>
            <input type="checkbox" checked={picked.has(s.dev.id)} onChange={(e) => { const n = new Set(picked); e.target.checked ? n.add(s.dev.id) : n.delete(s.dev.id); setPicked(n); }} style={{ marginTop: 3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{s.dev.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(s.dates.length * s.amount)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{s.dates.length} visit{s.dates.length === 1 ? "" : "s"} · {s.label} ({s.basis}) · {gbp(s.amount)} each ({s.costBasis}){s.already ? ` · ${s.already} already planned` : ""}</div>
              <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>{s.dates.slice(0, 6).map(fmtDate).join(", ")}{s.dates.length > 6 ? ` … +${s.dates.length - 6} more` : ""}</div>
            </div>
          </label>
        ))}
        {usable.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--faint)" }}>Nothing to add — every repeating service is already planned for the next 12 months.</div> : (
          <PrimaryButton onClick={() => onApply(chosen.map((s) => ({ deviceId: s.dev.id, dates: s.dates, amount: s.amount })))}>
            <Plus size={15} /> Add {chosen.reduce((a, s) => a + s.dates.length, 0)} visits to plan ({gbp(total)})
          </PrimaryButton>
        )}
      </div>
    </Modal>
  );
}

function PlanBulkPanel({ lines, onApply, onDelete }) {
  const [pct, setPct] = useState(""); const [months, setMonths] = useState(""); const [onlyPlanned, setOnlyPlanned] = useState(true);
  const target = lines.filter((l) => !onlyPlanned || l.actualAmount == null);
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>Change {target.length} line{target.length === 1 ? "" : "s"} at once</div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}><input type="checkbox" checked={onlyPlanned} onChange={(e) => setOnlyPlanned(e.target.checked)} style={{ margin: 0 }} /> Only lines with no actual spend recorded</label>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5 }}>Change amounts by</span><TextInput type="number" step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="e.g. 5 or -10" style={{ width: 100 }} /><span style={{ fontSize: 12.5 }}>%</span>
        <button onClick={() => { const p = Number(pct); if (!p) return; onApply(Object.fromEntries(target.map((l) => [l.id, { amount: Math.round((Number(l.amount) || 0) * (1 + p / 100) * 100) / 100 }]))); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Apply</button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5 }}>Move dates by</span><TextInput type="number" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="e.g. 1 or -2" style={{ width: 100 }} /><span style={{ fontSize: 12.5 }}>months</span>
        <button onClick={() => { const m = Number(months); if (!m) return; onApply(Object.fromEntries(target.map((l) => [l.id, { date: addMonths(l.date, m) }]))); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Apply</button>
      </div>
      <button onClick={() => { if (window.confirm(`Delete ${target.length} plan line${target.length === 1 ? "" : "s"}? This can't be undone.`)) onDelete(target.map((l) => l.id)); }} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--danger)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Delete these {target.length} lines</button>
    </div>
  );
}

// Services and the budget out of step — with one-tap fixes.
function ServiceSyncPanel({ sync }) {
  const { orphans = [], unplanned = [], thin = [], noBudget = [], onPlan, onRemoveOrphans, onOpen } = sync;
  const total = orphans.length + unplanned.length + thin.length + noBudget.length;
  const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 };
  const act = { background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" };
  const link = (d) => <button key={d.id} onClick={() => onOpen(d.id)} style={{ background: "var(--card-hi)", border: "none", borderRadius: 12, padding: "3px 9px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>{d.name}{Number(d.budgetPerVisit) ? ` · ${gbp(d.budgetPerVisit)}` : ""}</button>;
  return (
    <div style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 14 }}>Services ↔ budget</b><span style={{ fontSize: 12, fontWeight: 750, color: total ? "var(--warn)" : "var(--ok)" }}>{total ? `${total} to sort` : "✓ all in step"}</span></div>
      {!total && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Every service with a budget has its visits planned, and there are no leftover lines from removed services.</div>}
      {unplanned.length > 0 && <>
        <div style={{ fontSize: 12.5 }}><b>{unplanned.length} service{unplanned.length === 1 ? " has" : "s have"} a budget per visit but no visits planned in the budget</b> — so their cost isn't in your forecast.</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{unplanned.slice(0, 12).map(link)}</div>
        {ACTIVE_CAN_EDIT && <button onClick={() => onPlan(unplanned.map((d) => d.id), 12)} style={act}>Plan their visits (next 12 months)</button>}
      </>}
      {thin.length > 0 && <>
        <div style={{ fontSize: 12.5, marginTop: 4 }}><b>{thin.length} service{thin.length === 1 ? " is" : "s are"} planned for less than 9 months ahead</b> — top them up so next year's budget isn't short.</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{thin.slice(0, 12).map(link)}</div>
        {ACTIVE_CAN_EDIT && <button onClick={() => onPlan(thin.map((d) => d.id), 12)} style={act}>Top up to 12 months</button>}
      </>}
      {orphans.length > 0 && <>
        <div style={{ fontSize: 12.5, marginTop: 4 }}><b>{orphans.length} planned visit{orphans.length === 1 ? "" : "s"} for services that were deleted or archived</b> — still counted in your forecast ({gbp(orphans.reduce((t, l) => t + (Number(l.amount) || 0), 0))}).</div>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{[...new Set(orphans.map((l) => l.description))].slice(0, 8).join(" · ")}</div>
        {ACTIVE_CAN_EDIT && <button onClick={() => onRemoveOrphans(orphans.map((l) => l.id))} style={{ ...act, background: "var(--danger)" }}>Remove them from the budget</button>}
      </>}
      {noBudget.length > 0 && <>
        <div style={{ fontSize: 12.5, marginTop: 4 }}><b>{noBudget.length} service{noBudget.length === 1 ? " has" : "s have"} visit costs but no budget per visit</b> — set one so the spend has a budget behind it.</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{noBudget.slice(0, 12).map(link)}</div>
      </>}
    </div>
  );
}
