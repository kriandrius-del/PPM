// Budget → POs & invoices: purchase orders with remaining balance, and supplier invoices matched to them.
import { useState } from "react";
import { addDays, daysUntil, escapeHtml, fmtDate, gbp } from "../lib/utils.js";
import { ConfirmTextDelete, EmptyState, ExportButton, Field, MetricBlock, Modal, PhotoStrip, PrimaryButton, Select, TextInput, ToggleButton } from "../components/ui.jsx";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE } from "../lib/globals.js";
import { CheckCircle2, FileText, PiggyBank, Printer, Receipt, X } from "lucide-react";
import { SAVING_TYPES, VAT_RATES } from "../lib/constants.js";
import { buildPurchaseOrder, openPrintReport, tableHtml } from "../lib/reports.js";

export function FinanceView({ costCodes = [], onSaveCostCodes, poLimit = null, onSavePoLimit, onBulkInvoices, locationName = "", savings = [], onSaveSaving, onDeleteSaving, userName = "", pos, invoices, suppliers, works, deviceById, onSavePO, onDeletePO, onSaveInvoice, onDeleteInvoice }) {
  const [view, setView] = useState("invoices");
  const [editPO, setEditPO] = useState(null);
  const [editInv, setEditInv] = useState(null);
  const [invFilter, setInvFilter] = useState("open");
  const supName = (id) => suppliers.find((s) => s.id === id)?.name || "";
  const invoicedFor = (po) => invoices.filter((iv) => iv.poId === po.id).reduce((t, iv) => t + (Number(iv.amount) || 0), 0);
  const worksFor = (po) => works.filter((w) => w.poNumber && po.number && w.poNumber.trim().toLowerCase() === po.number.trim().toLowerCase());
  const toApprove = invoices.filter((i) => i.status === "received");
  const toPay = invoices.filter((i) => i.status === "approved");
  const overdue = invoices.filter((i) => i.status !== "paid" && i.dueDate && daysUntil(i.dueDate) < 0);
  const openPOs = pos.filter((p) => p.status !== "closed");
  const committed = openPOs.reduce((t, p) => t + Math.max(0, (Number(p.value) || 0) - invoicedFor(p)), 0);
  const invList = invoices.filter((i) => invFilter === "all" || (invFilter === "open" ? i.status !== "paid" : i.status === "paid")).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const statusColor = { received: "#B7791F", approved: "#2B6CB0", paid: "#2F855A", disputed: "#C53030" };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <MetricBlock label="To approve" value={`${toApprove.length} · ${gbp(toApprove.reduce((t, i) => t + (Number(i.amount) || 0), 0))}`} />
        <MetricBlock label="Approved, to pay" value={`${toPay.length} · ${gbp(toPay.reduce((t, i) => t + (Number(i.amount) || 0), 0))}`} tone={overdue.length ? "danger" : undefined} />
        <MetricBlock label="Open PO balance" value={gbp(committed)} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <ToggleButton active={view === "invoices"} onClick={() => setView("invoices")}>Invoices ({invoices.length})</ToggleButton>
        <ToggleButton active={view === "pos"} onClick={() => setView("pos")}>Purchase orders ({pos.length})</ToggleButton>
        <ToggleButton active={view === "savings"} onClick={() => setView("savings")}>Savings</ToggleButton>
      </div>

      {view === "invoices" && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
            <ToggleButton active={invFilter === "open"} onClick={() => setInvFilter("open")}>Not paid</ToggleButton>
            <ToggleButton active={invFilter === "paid"} onClick={() => setInvFilter("paid")}>Paid</ToggleButton>
            <ToggleButton active={invFilter === "all"} onClick={() => setInvFilter("all")}>All</ToggleButton>
            {invoices.length > 0 && <ExportButton label="CSV" filename="invoices.csv" rows={[["Invoice no.", "Supplier", "PO", "Cost code", "Date", "Due", "Net", "VAT %", "VAT", "Gross", "Status", "Paid on", "Notes"], ...invoices.map((i) => [i.number, supName(i.supplierId), pos.find((p) => p.id === i.poId)?.number || "", i.costCode || pos.find((p) => p.id === i.poId)?.costCode || "", i.date || "", i.dueDate || "", i.amount, i.vatRate ?? "", i.vat ?? "", i.gross ?? i.amount, i.status, i.paidDate || "", i.notes || ""])]} />}
          </div>
          {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditInv({})} style={{ width: "100%", marginBottom: 10 }}><Receipt size={15} /> Record an invoice</PrimaryButton>}
          {(() => { const t7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); const run = invoices.filter((i) => i.status === "approved" && i.dueDate && i.dueDate <= t7).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))); if (!run.length) return null; const tot = run.reduce((t, i) => t + (Number(i.amount) || 0) * (1 + Number(i.vatRate ?? 20) / 100), 0); return (
            <div style={{ background: "var(--accent-soft)", borderRadius: 12, padding: "10px 12px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><b style={{ fontSize: 13 }}>Payment run — due within 7 days ({run.length})</b><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{gbp(tot)} inc VAT</span></div>
              {run.slice(0, 6).map((i) => <div key={i.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", color: i.dueDate < new Date().toISOString().slice(0, 10) ? "var(--danger)" : "inherit" }}><span>{i.number} · {suppliers.find((s2) => s2.id === i.supplierId)?.name || ""}</span><span>{fmtDate(i.dueDate)} · {gbp(i.amount)}</span></div>)}
              <button onClick={() => { const e = escapeHtml; openPrintReport("Payment run", locationName, tableHtml(["Due", "Invoice", "Supplier", "Net", "VAT", "Gross", "Approved by"], run.map((i) => { const net = Number(i.amount) || 0, vat = net * Number(i.vatRate ?? 20) / 100; return [fmtDate(i.dueDate), e(i.number), e(suppliers.find((s2) => s2.id === i.supplierId)?.name || ""), gbp(net), gbp(vat), `<b>${gbp(net + vat)}</b>`, e(i.approvedBy || "")]; }), [3, 4, 5]) + `<div class="kpis"><div class="kpi">Total to pay<b>${gbp(tot)}</b></div></div><div style="margin-top:20px">Authorised ____________________ Date ________</div>`); }} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Print payment run for finance</button>
            </div>
          ); })()}
          {ACTIVE_CAN_EDIT && onBulkInvoices && (invoices.some((i) => i.status === "received") || invoices.some((i) => i.status === "approved")) && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {invoices.some((i) => i.status === "received") && <button onClick={() => { const ids = invoices.filter((i) => i.status === "received").map((i) => i.id); if (window.confirm(`Approve all ${ids.length} received invoice${ids.length === 1 ? "" : "s"}?`)) onBulkInvoices(ids, "approved"); }} style={{ flex: 1, background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.3, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Approve all received ({invoices.filter((i) => i.status === "received").length})</button>}
              {invoices.some((i) => i.status === "approved") && <button onClick={() => { const ids = invoices.filter((i) => i.status === "approved").map((i) => i.id); if (window.confirm(`Mark all ${ids.length} approved invoice${ids.length === 1 ? "" : "s"} as paid?`)) onBulkInvoices(ids, "paid"); }} style={{ flex: 1, background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.3, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Mark approved as paid ({invoices.filter((i) => i.status === "approved").length})</button>}
            </div>
          )}
          {invList.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices here" body="Record supplier invoices, match them to a purchase order, then mark them approved and paid. You'll get alerts for invoices waiting too long or past their payment date." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {invList.map((i) => {
                const late = i.status !== "paid" && i.dueDate && daysUntil(i.dueDate) < 0;
                const po = pos.find((p) => p.id === i.poId);
                return (
                  <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `3px solid ${late ? "#C53030" : statusColor[i.status] || "#8A94A0"}`, borderRadius: 12, padding: 11 }}>
                    <button onClick={() => ACTIVE_CAN_EDIT && setEditInv(i)} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{supName(i.supplierId) || "Supplier"} · <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{i.number}</span>{i.status === "disputed" && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 800 }}> DISPUTED{i.disputeReason ? ` — ${i.disputeReason}` : ""}</span>}{Number(i.amount) < 0 && <span style={{ fontSize: 11, color: "var(--ok)", fontWeight: 800 }}> CREDIT</span>}{i.workId && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}> · {deviceById[works.find((w) => w.id === i.workId)?.deviceId]?.name || "work"}</span>}</span>
                        <b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(i.amount)}{i.vat ? <span style={{ fontSize: 10.5, color: "var(--faint)", fontWeight: 600 }}> +VAT</span> : null}</b>
                      </div>
                      <div style={{ fontSize: 11.3, color: late ? "var(--danger)" : "var(--faint)", fontWeight: late ? 700 : 500 }}>
                        {fmtDate(i.date)}{i.dueDate ? ` · ${late ? "was due" : "due"} ${fmtDate(i.dueDate)}` : ""}{po ? ` · PO ${po.number}` : " · no PO"}{i.status === "paid" && i.paidDate ? ` · paid ${fmtDate(i.paidDate)}` : ""}
                      </div>
                    </button>
                    <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor[i.status], flex: 1 }}>{i.status === "received" ? "Waiting for approval" : i.status === "approved" ? `Approved${i.approvedBy ? ` by ${i.approvedBy}` : ""}` : "Paid"}</span>
                      {ACTIVE_CAN_EDIT && i.status === "received" && <button onClick={() => onSaveInvoice({ ...i, status: "approved", approvedBy: userName, approvedAt: new Date().toISOString() })} style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Approve</button>}
                      {ACTIVE_CAN_EDIT && i.status === "approved" && <button onClick={() => onSaveInvoice({ ...i, status: "paid", paidDate: new Date().toISOString().slice(0, 10) })} style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Mark paid</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === "pos" && (
        <>
          {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditPO({})} style={{ width: "100%", marginBottom: 10 }}><FileText size={15} /> Raise a purchase order</PrimaryButton>}
          {ACTIVE_CAN_EDIT && onSaveCostCodes && <CostCodesEditor codes={costCodes} onSave={onSaveCostCodes} />}
          {ACTIVE_CAN_EDIT && onSavePoLimit && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12.5 }}><span style={{ color: "var(--muted)" }}>POs over</span><TextInput type="number" min="0" defaultValue={poLimit ?? ""} onBlur={(e) => onSavePoLimit(e.target.value)} placeholder="no limit" style={{ width: 100, padding: "5px 8px" }} /><span style={{ color: "var(--muted)" }}>need approval</span></div>}
          {pos.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><ExportButton label="CSV" filename="purchase-orders.csv" rows={[["PO", "Supplier", "Description", "Cost code", "Date", "Value", "Invoiced", "Remaining", "Status"], ...pos.map((p) => [p.number, supName(p.supplierId), p.description || "", p.costCode || "", p.date || "", p.value, invoicedFor(p), (Number(p.value) || 0) - invoicedFor(p), p.status || "open"])]} /></div>}
          {pos.length === 0 ? (
            <EmptyState icon={FileText} title="No purchase orders yet" body="Record POs with their value; invoices matched to them show how much is left. Works with the same PO number are linked automatically." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...pos].sort((a, b) => (a.status === "closed") - (b.status === "closed") || String(b.date).localeCompare(String(a.date))).map((p) => {
                const inv = invoicedFor(p); const val = Number(p.value) || 0; const pct = val ? Math.round((inv / val) * 100) : 0; const ws = worksFor(p);
                return (
                  <button key={p.id} onClick={() => ACTIVE_CAN_EDIT && setEditPO(p)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit", opacity: p.status === "closed" ? 0.65 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.number}</span> · {supName(p.supplierId)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.status === "closed" ? "var(--muted)" : p.status === "awaiting" ? "var(--warn)" : "#2B6CB0" }}>{p.status === "closed" ? "Closed" : p.status === "awaiting" ? "Awaiting approval" : "Open"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>{p.description}</div>
                    <div style={{ height: 6, background: "var(--track)", borderRadius: 3, overflow: "hidden", marginTop: 6 }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 100 ? "#C53030" : "#2B6CB0" }} /></div>
                    <div style={{ fontSize: 11.3, color: pct > 100 ? "var(--danger)" : "var(--muted)", marginTop: 3 }}>{gbp(inv)} invoiced of {gbp(val)} · <b>{gbp(val - inv)}</b> left{ws.length ? ` · ${ws.length} linked work${ws.length === 1 ? "" : "s"}` : ""}</div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {view === "savings" && <SavingsView savings={savings} suppliers={suppliers} onSave={onSaveSaving} onDelete={onDeleteSaving} />}
      {editPO && <POModal poLimit={poLimit} userName={userName} locationName={locationName} existing={editPO.id ? editPO : null} suppliers={suppliers} existingNumbers={pos.map((p) => p.number)} onClose={() => setEditPO(null)} onSave={(p) => { onSavePO(p); setEditPO(null); }} onDelete={(id) => { onDeletePO(id); setEditPO(null); }} />}
      {editInv && <InvoiceModal allInvoices={invoices} works={works} deviceById={deviceById} existing={editInv.id ? editInv : null} suppliers={suppliers} pos={pos} invoicedFor={invoicedFor} onClose={() => setEditInv(null)} onSave={(i) => { onSaveInvoice(i); setEditInv(null); }} onDelete={(id) => { onDeleteInvoice(id); setEditInv(null); }} />}
    </div>
  );
}
function POModal({ poLimit = null, userName = "", locationName = "", existing, suppliers, existingNumbers, onClose, onSave, onDelete }) {
  const nextNo = () => { const nums = existingNumbers.map((n) => Number(String(n).replace(/\D/g, ""))).filter(Boolean); return `PO-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`; };
  const [number, setNumber] = useState(existing?.number || nextNo());
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [value, setValue] = useState(existing?.value != null ? String(existing.value) : "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(existing?.status || "open");
  const [costCode, setCostCode] = useState(existing?.costCode || "");
  return (
    <Modal title={existing ? `PO ${existing.number}` : "Raise a purchase order"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="PO number"><TextInput value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Supplier"><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="What it covers"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 2026/27 cleaning contract, AHU 3 repair" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label={`Value, net (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          <Field label="Cost code (optional)"><TextInput list="ppm-cost-codes" value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder="e.g. 6120-FM" /><datalist id="ppm-cost-codes">{(COST_CODES_CACHE || []).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist></Field>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={status === "open"} onClick={() => setStatus("open")}>Open</ToggleButton>
          <ToggleButton active={status === "closed"} onClick={() => setStatus("closed")}>Closed</ToggleButton>
        </div>
        <PrimaryButton onClick={() => number.trim() && onSave({ id: existing?.id, number: number.trim(), supplierId: supplierId || null, description: description.trim(), value: Number(value) || 0, date, status: poLimit != null && Number(value) > poLimit && !existing?.approvedBy && status === "open" ? "awaiting" : status, costCode: costCode.trim(), approvedBy: existing?.approvedBy, approvedAt: existing?.approvedAt })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {poLimit != null && Number(value) > poLimit && !existing?.approvedBy && <div style={{ fontSize: 12, color: "var(--warn)", fontWeight: 650 }}>Over the {gbp(poLimit)} approval limit — it will wait for approval before it can be used.</div>}
        {existing?.status === "awaiting" && ACTIVE_CAN_EDIT && <button type="button" onClick={() => onSave({ ...existing, number: number.trim(), supplierId: supplierId || null, description: description.trim(), value: Number(value) || 0, date, costCode: costCode.trim(), status: "open", approvedBy: userName || "Unknown", approvedAt: new Date().toISOString() })} style={{ background: "var(--ok)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Approve this PO</button>}
        {existing?.approvedBy && <div style={{ fontSize: 12, color: "var(--ok)" }}>Approved by {existing.approvedBy} · {fmtDate(String(existing.approvedAt).slice(0, 10))}</div>}
        {existing && <button type="button" onClick={() => openPrintReport(`Purchase order ${existing.number}`, locationName, buildPurchaseOrder({ ...existing }, suppliers.find((x) => x.id === existing.supplierId), locationName))} style={{ background: "var(--card-hi)", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 650, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Printer size={14} /> Print / save as PDF to send</button>}
        {existing && <ConfirmTextDelete label="Delete this PO" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
function InvoiceModal({ allInvoices = [], works = [], deviceById = {}, existing, suppliers, pos, invoicedFor, onClose, onSave, onDelete }) {
  const [number, setNumber] = useState(existing?.number || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [poId, setPoId] = useState(existing?.poId || "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(existing?.dueDate || addDays(new Date().toISOString().slice(0, 10), 30));
  const [amount, setAmount] = useState(existing?.amount != null ? String(Math.abs(existing.amount)) : "");
  const [status, setStatus] = useState(existing?.status || "received");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [disputeReason, setDisputeReason] = useState(existing?.disputeReason || "");
  const [workId, setWorkId] = useState(existing?.workId || "");
  const [attachments, setAttachments] = useState(existing?.attachments || []);
  const [docUrl, setDocUrl] = useState(existing?.docUrl || "");
  const [credit, setCredit] = useState(Number(existing?.amount) < 0);
  const [vatRate, setVatRate] = useState(existing?.vatRate != null ? String(existing.vatRate) : "20");
  const [costCode, setCostCode] = useState(existing?.costCode || "");
  const net = (Number(amount) || 0) * (credit ? -1 : 1); const vat = Math.round(net * (Number(vatRate) || 0)) / 100; const gross = net + vat;
  const supplierPOs = pos.filter((p) => p.status !== "closed" && (!supplierId || p.supplierId === supplierId));
  const po = pos.find((p) => p.id === poId);
  const left = po ? (Number(po.value) || 0) - invoicedFor(po) + (existing?.poId === po.id ? Number(existing.amount) || 0 : 0) : null;
  return (
    <Modal title={existing ? `Invoice ${existing.number}` : "Record an invoice"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Supplier"><Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPoId(""); const sp = suppliers.find((x) => x.id === e.target.value); if (sp && !existing) setDueDate(addDays(date, Number(sp.paymentDays) || 30)); }}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Invoice number"><TextInput value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
          <Field label={`Net amount (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Field label="VAT">
            <Select value={vatRate} onChange={(e) => setVatRate(e.target.value)}>{VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</Select>
          </Field>
          <Field label="Cost code (optional)"><TextInput list="ppm-cost-codes" value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder="e.g. 6120-FM" /><datalist id="ppm-cost-codes">{(COST_CODES_CACHE || []).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist></Field>
        </div>
        {number.trim() && allInvoices.some((x) => x.id !== existing?.id && String(x.number).trim().toLowerCase() === number.trim().toLowerCase() && (!supplierId || x.supplierId === supplierId)) && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 8, padding: "7px 10px" }}>Invoice {number.trim()} is already recorded for this supplier — check it isn't a duplicate.</div>}
        {net > 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>Net {gbp(net)} + VAT {gbp(vat)} = <b>{gbp(gross)}</b> gross</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Invoice date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Payment due"><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>
        <Field label="Purchase order">
          <Select value={poId} onChange={(e) => setPoId(e.target.value)}><option value="">— No PO —</option>{supplierPOs.map((p) => <option key={p.id} value={p.id}>{p.number} — {p.description}</option>)}</Select>
          {po && <span style={{ fontSize: 11.5, color: left - (Number(amount) || 0) < 0 ? "var(--danger)" : "var(--muted)", fontWeight: 600 }}>{gbp(left)} left on this PO{Number(amount) ? ` → ${gbp(left - Number(amount))} after this invoice` : ""}</span>}
        </Field>
        <Field label="For which work (optional)">
          <Select value={workId} onChange={(e) => setWorkId(e.target.value)}>
            <option value="">—</option>
            {works.filter((w) => !supplierId || w.supplierId === supplierId || w.id === workId).slice(0, 80).map((w) => <option key={w.id} value={w.id}>{deviceById[w.deviceId]?.name || "Work"} — {String(w.description).slice(0, 50)}</option>)}
          </Select>
        </Field>
        {status === "disputed" && <Field label="Why is it disputed?"><TextInput value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="e.g. Charged for 6 hours, engineer was on site 3" /></Field>}
        <PhotoStrip photos={attachments} onChange={setAttachments} max={2} label="Photo of the invoice (optional)" />
        <Field label="Link to the invoice (optional)"><TextInput value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="SharePoint / email link" /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.8, fontWeight: 600, cursor: "pointer" }}><input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} style={{ margin: 0 }} /> This is a credit note (reduces the amount owed)</label>
        <div style={{ display: "flex", gap: 6 }}>
          {[["received", "Received"], ["approved", "Approved"], ["paid", "Paid"], ["disputed", "Disputed"]].map(([k, l]) => <ToggleButton key={k} active={status === k} onClick={() => setStatus(k)}>{l}</ToggleButton>)}
        </div>
        <Field label="Notes"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <PrimaryButton onClick={() => number.trim() && amount !== "" && onSave({ ...(existing || {}), number: number.trim(), supplierId: supplierId || null, poId: poId || null, date, dueDate: dueDate || null, disputeReason: status === "disputed" ? disputeReason.trim() : "", disputedAt: status === "disputed" ? (existing?.status === "disputed" ? existing.disputedAt : new Date().toISOString()) : null, workId: workId || null, attachments, docUrl: docUrl.trim(), amount: net, vatRate: Number(vatRate) || 0, vat, gross, costCode: costCode.trim(), status, notes: notes.trim(), paidDate: status === "paid" ? existing?.paidDate || new Date().toISOString().slice(0, 10) : null })}><CheckCircle2 size={15} /> Save invoice</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this invoice" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

function SavingsView({ savings, suppliers, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const yr = String(new Date().getFullYear());
  const ytd = savings.filter((s) => String(s.date).startsWith(yr));
  const total = ytd.reduce((t, s) => t + (Number(s.amount) || 0), 0);
  return (
    <div>
      <div style={{ background: "var(--ok-soft)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, color: "var(--ok)", fontWeight: 650 }}>Savings delivered in {yr}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ok)", fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(total)}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{Object.entries(SAVING_TYPES).map(([k, v]) => [v, ytd.filter((s) => s.type === k).reduce((t, s) => t + (Number(s.amount) || 0), 0)]).filter(([, n]) => n).map(([v, n]) => `${v} ${gbp(n)}`).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ACTIVE_CAN_EDIT && <PrimaryButton onClick={() => setEditing({})} style={{ flex: 1 }}><PiggyBank size={15} /> Record a saving</PrimaryButton>}
        {savings.length > 0 && <ExportButton label="CSV" filename="savings.csv" rows={[["Date", "Description", "Type", "Supplier", "Amount", "Recorded by"], ...savings.map((s) => [s.date, s.description, SAVING_TYPES[s.type] || "", suppliers.find((x) => x.id === s.supplierId)?.name || "", s.amount, s.by || ""])]} />}
      </div>
      {savings.length === 0 ? <EmptyState icon={PiggyBank} title="No savings recorded" body="Log negotiated reductions, costs avoided and rebates — a running total that's handy for your annual review and management reports." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...savings].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((s) => (
            <button key={s.id} onClick={() => ACTIVE_CAN_EDIT && setEditing(s)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 650 }}>{s.description}</div><div style={{ fontSize: 11, color: "var(--faint)" }}>{fmtDate(s.date)} · {SAVING_TYPES[s.type]}{s.supplierId ? ` · ${suppliers.find((x) => x.id === s.supplierId)?.name || ""}` : ""}</div></div>
              <b style={{ color: "var(--ok)", fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(s.amount)}</b>
            </button>
          ))}
        </div>
      )}
      {editing && <SavingModal existing={editing.id ? editing : null} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(s) => { onSave(s); setEditing(null); }} onDelete={(id) => { onDelete(id); setEditing(null); }} />}
    </div>
  );
}
function SavingModal({ existing, suppliers, onClose, onSave, onDelete }) {
  const [description, setDescription] = useState(existing?.description || "");
  const [type, setType] = useState(existing?.type || "negotiated");
  const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount) : "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  return (
    <Modal title={existing ? "Saving" : "Record a saving"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="What was saved"><TextInput autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Cleaning contract renegotiated at renewal" /></Field>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{Object.entries(SAVING_TYPES).map(([k, v]) => <ToggleButton key={k} active={type === k} onClick={() => setType(k)}>{v}</ToggleButton>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label={`Amount saved (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Supplier (optional)"><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <PrimaryButton onClick={() => description.trim() && amount !== "" && onSave({ id: existing?.id, description: description.trim(), type, amount: Number(amount), date, supplierId: supplierId || null })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}

let COST_CODES_CACHE = [];
function CostCodesEditor({ codes, onSave }) {
  COST_CODES_CACHE = codes;
  const [open, setOpen] = useState(false); const [code, setCode] = useState(""); const [label, setLabel] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", padding: 0, marginBottom: 8, color: "var(--accent)", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Cost codes ({codes.length}) — manage</button>;
  return (
    <div style={{ background: "var(--card-hi)", borderRadius: 10, padding: 10, marginBottom: 10, display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>Cost codes <span style={{ fontWeight: 500, color: "var(--faint)" }}>— offered when you type a cost code on POs and invoices</span></div>
      {codes.map((c) => <div key={c.code} style={{ display: "flex", gap: 6, fontSize: 12.5 }}><b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{c.code}</b><span style={{ flex: 1 }}>{c.label}</span><button onClick={() => onSave(codes.filter((x) => x.code !== c.code))} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={12} color="#A3ABB4" /></button></div>)}
      <div style={{ display: "flex", gap: 5 }}>
        <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" style={{ width: 100 }} />
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What it's for, e.g. Planned maintenance" style={{ flex: 1, minWidth: 0 }} />
        <button onClick={() => { if (!code.trim()) return; onSave([...codes.filter((x) => x.code !== code.trim()), { code: code.trim(), label: label.trim() }]); setCode(""); setLabel(""); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
      </div>
      <button onClick={() => setOpen(false)} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--muted)", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
    </div>
  );
}
