// Budget → POs & invoices: purchase orders with remaining balance, and supplier invoices matched to them.
import { useState } from "react";
import { addDays, daysUntil, fmtDate, gbp } from "../lib/utils.js";
import { ConfirmTextDelete, EmptyState, ExportButton, Field, MetricBlock, Modal, PrimaryButton, Select, TextInput, ToggleButton } from "../components/ui.jsx";
import { ACTIVE_CAN_EDIT, ACTIVE_CURRENCY_CODE } from "../lib/globals.js";
import { CheckCircle2, FileText, Receipt } from "lucide-react";
import { VAT_RATES } from "../lib/constants.js";

export function FinanceView({ userName = "", pos, invoices, suppliers, works, deviceById, onSavePO, onDeletePO, onSaveInvoice, onDeleteInvoice }) {
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
  const statusColor = { received: "#B7791F", approved: "#2B6CB0", paid: "#2F855A" };
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
          {invList.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices here" body="Record supplier invoices, match them to a purchase order, then mark them approved and paid. You'll get alerts for invoices waiting too long or past their payment date." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {invList.map((i) => {
                const late = i.status !== "paid" && i.dueDate && daysUntil(i.dueDate) < 0;
                const po = pos.find((p) => p.id === i.poId);
                return (
                  <div key={i.id} style={{ background: "#fff", border: "1px solid #E1E4E8", borderLeft: `3px solid ${late ? "#C53030" : statusColor[i.status] || "#8A94A0"}`, borderRadius: 12, padding: 11 }}>
                    <button onClick={() => ACTIVE_CAN_EDIT && setEditInv(i)} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{supName(i.supplierId) || "Supplier"} · <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{i.number}</span></span>
                        <b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{gbp(i.amount)}{i.vat ? <span style={{ fontSize: 10.5, color: "#8A94A0", fontWeight: 600 }}> +VAT</span> : null}</b>
                      </div>
                      <div style={{ fontSize: 11.3, color: late ? "#C53030" : "#8A94A0", fontWeight: late ? 700 : 500 }}>
                        {fmtDate(i.date)}{i.dueDate ? ` · ${late ? "was due" : "due"} ${fmtDate(i.dueDate)}` : ""}{po ? ` · PO ${po.number}` : " · no PO"}{i.status === "paid" && i.paidDate ? ` · paid ${fmtDate(i.paidDate)}` : ""}
                      </div>
                    </button>
                    <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor[i.status], flex: 1 }}>{i.status === "received" ? "Waiting for approval" : i.status === "approved" ? `Approved${i.approvedBy ? ` by ${i.approvedBy}` : ""}` : "Paid"}</span>
                      {ACTIVE_CAN_EDIT && i.status === "received" && <button onClick={() => onSaveInvoice({ ...i, status: "approved", approvedBy: userName, approvedAt: new Date().toISOString() })} style={{ background: "#EAF1F8", color: "#2B4562", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Approve</button>}
                      {ACTIVE_CAN_EDIT && i.status === "approved" && <button onClick={() => onSaveInvoice({ ...i, status: "paid", paidDate: new Date().toISOString().slice(0, 10) })} style={{ background: "#EAF4EE", color: "#2F6B4A", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Mark paid</button>}
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
          {pos.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><ExportButton label="CSV" filename="purchase-orders.csv" rows={[["PO", "Supplier", "Description", "Cost code", "Date", "Value", "Invoiced", "Remaining", "Status"], ...pos.map((p) => [p.number, supName(p.supplierId), p.description || "", p.costCode || "", p.date || "", p.value, invoicedFor(p), (Number(p.value) || 0) - invoicedFor(p), p.status || "open"])]} /></div>}
          {pos.length === 0 ? (
            <EmptyState icon={FileText} title="No purchase orders yet" body="Record POs with their value; invoices matched to them show how much is left. Works with the same PO number are linked automatically." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...pos].sort((a, b) => (a.status === "closed") - (b.status === "closed") || String(b.date).localeCompare(String(a.date))).map((p) => {
                const inv = invoicedFor(p); const val = Number(p.value) || 0; const pct = val ? Math.round((inv / val) * 100) : 0; const ws = worksFor(p);
                return (
                  <button key={p.id} onClick={() => ACTIVE_CAN_EDIT && setEditPO(p)} style={{ background: "#fff", border: "1px solid #E1E4E8", borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer", fontFamily: "inherit", opacity: p.status === "closed" ? 0.65 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.number}</span> · {supName(p.supplierId)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.status === "closed" ? "#5B6672" : "#2B6CB0" }}>{p.status === "closed" ? "Closed" : "Open"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#3A4451" }}>{p.description}</div>
                    <div style={{ height: 6, background: "#E1E4E8", borderRadius: 3, overflow: "hidden", marginTop: 6 }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 100 ? "#C53030" : "#2B6CB0" }} /></div>
                    <div style={{ fontSize: 11.3, color: pct > 100 ? "#C53030" : "#5B6672", marginTop: 3 }}>{gbp(inv)} invoiced of {gbp(val)} · <b>{gbp(val - inv)}</b> left{ws.length ? ` · ${ws.length} linked work${ws.length === 1 ? "" : "s"}` : ""}</div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {editPO && <POModal existing={editPO.id ? editPO : null} suppliers={suppliers} existingNumbers={pos.map((p) => p.number)} onClose={() => setEditPO(null)} onSave={(p) => { onSavePO(p); setEditPO(null); }} onDelete={(id) => { onDeletePO(id); setEditPO(null); }} />}
      {editInv && <InvoiceModal existing={editInv.id ? editInv : null} suppliers={suppliers} pos={pos} invoicedFor={invoicedFor} onClose={() => setEditInv(null)} onSave={(i) => { onSaveInvoice(i); setEditInv(null); }} onDelete={(id) => { onDeleteInvoice(id); setEditInv(null); }} />}
    </div>
  );
}
function POModal({ existing, suppliers, existingNumbers, onClose, onSave, onDelete }) {
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
          <Field label="Cost code (optional)"><TextInput value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder="e.g. 6120-FM" /></Field>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleButton active={status === "open"} onClick={() => setStatus("open")}>Open</ToggleButton>
          <ToggleButton active={status === "closed"} onClick={() => setStatus("closed")}>Closed</ToggleButton>
        </div>
        <PrimaryButton onClick={() => number.trim() && onSave({ id: existing?.id, number: number.trim(), supplierId: supplierId || null, description: description.trim(), value: Number(value) || 0, date, status, costCode: costCode.trim() })}><CheckCircle2 size={15} /> Save</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this PO" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
function InvoiceModal({ existing, suppliers, pos, invoicedFor, onClose, onSave, onDelete }) {
  const [number, setNumber] = useState(existing?.number || "");
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [poId, setPoId] = useState(existing?.poId || "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(existing?.dueDate || addDays(new Date().toISOString().slice(0, 10), 30));
  const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount) : "");
  const [status, setStatus] = useState(existing?.status || "received");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [vatRate, setVatRate] = useState(existing?.vatRate != null ? String(existing.vatRate) : "20");
  const [costCode, setCostCode] = useState(existing?.costCode || "");
  const net = Number(amount) || 0; const vat = Math.round(net * (Number(vatRate) || 0)) / 100; const gross = net + vat;
  const supplierPOs = pos.filter((p) => p.status !== "closed" && (!supplierId || p.supplierId === supplierId));
  const po = pos.find((p) => p.id === poId);
  const left = po ? (Number(po.value) || 0) - invoicedFor(po) + (existing?.poId === po.id ? Number(existing.amount) || 0 : 0) : null;
  return (
    <Modal title={existing ? `Invoice ${existing.number}` : "Record an invoice"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Supplier"><Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPoId(""); }}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Invoice number"><TextInput value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
          <Field label={`Net amount (${ACTIVE_CURRENCY_CODE})`}><TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Field label="VAT">
            <Select value={vatRate} onChange={(e) => setVatRate(e.target.value)}>{VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</Select>
          </Field>
          <Field label="Cost code (optional)"><TextInput value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder="e.g. 6120-FM" /></Field>
        </div>
        {net > 0 && <div style={{ fontSize: 12, color: "#5B6672" }}>Net {gbp(net)} + VAT {gbp(vat)} = <b>{gbp(gross)}</b> gross</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Invoice date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Payment due"><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>
        <Field label="Purchase order">
          <Select value={poId} onChange={(e) => setPoId(e.target.value)}><option value="">— No PO —</option>{supplierPOs.map((p) => <option key={p.id} value={p.id}>{p.number} — {p.description}</option>)}</Select>
          {po && <span style={{ fontSize: 11.5, color: left - (Number(amount) || 0) < 0 ? "#C53030" : "#5B6672", fontWeight: 600 }}>{gbp(left)} left on this PO{Number(amount) ? ` → ${gbp(left - Number(amount))} after this invoice` : ""}</span>}
        </Field>
        <div style={{ display: "flex", gap: 6 }}>
          {[["received", "Received"], ["approved", "Approved"], ["paid", "Paid"]].map(([k, l]) => <ToggleButton key={k} active={status === k} onClick={() => setStatus(k)}>{l}</ToggleButton>)}
        </div>
        <Field label="Notes"><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <PrimaryButton onClick={() => number.trim() && amount !== "" && onSave({ ...(existing || {}), number: number.trim(), supplierId: supplierId || null, poId: poId || null, date, dueDate: dueDate || null, amount: Number(amount), vatRate: Number(vatRate) || 0, vat, gross, costCode: costCode.trim(), status, notes: notes.trim(), paidDate: status === "paid" ? existing?.paidDate || new Date().toISOString().slice(0, 10) : null })}><CheckCircle2 size={15} /> Save invoice</PrimaryButton>
        {existing && <ConfirmTextDelete label="Delete this invoice" onConfirm={() => onDelete(existing.id)} />}
      </div>
    </Modal>
  );
}
