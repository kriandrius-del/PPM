// Shared building blocks: pop-up window, form fields, buttons, badges, signature pad.
import { useMemo, useEffect, useState, useRef } from "react";
import { Download, ImagePlus, Loader2, MapPin, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { WORK_PRIORITIES, WORK_STATUSES, toneStyles } from "../lib/constants.js";
import { ACTIVE_CAN_EDIT, CATEGORY_KEYS, CATEGORY_META } from "../lib/globals.js";
import { compressImage, csvHref, fieldsFor } from "../lib/utils.js";

export function CategoryOptions() { return CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>); }

export function Badge({ tone = "muted", children }) {
  const s = toneStyles[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: s.bg, color: s.fg, fontSize: 12.5, fontWeight: 600,
      padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {children}
    </span>
  );
}

export function CategoryBadge({ category, subCategory }) {
  const m = CATEGORY_META[category] || CATEGORY_META.maintenance;
  const Icon = m.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, background: `${m.color}1A`, color: m.color,
      fontSize: 12, fontWeight: 650, padding: "4px 9px", borderRadius: 20,
    }}>
      <Icon size={12} /> {m.label}{subCategory ? ` · ${subCategory}` : ""}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5 }}>
      <span style={{ fontWeight: 600, color: "#3A4451" }}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle = {
  border: "1px solid #D7DCE1", borderRadius: 8, padding: "9px 11px",
  fontSize: 14, fontFamily: "inherit", color: "#1B2430", background: "#fff", outline: "none",
};

export function TextInput(props) { return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }

export function TextArea(props) { return <textarea {...props} style={{ ...inputStyle, resize: "vertical", minHeight: 64, ...(props.style || {}) }} />; }

export function Select(props) { return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>{props.children}</select>; }

export let subcategoryDatalistSeq = 0;

export function SubCategoryField({ value, onChange, suggestions }) {
  const listId = useMemo(() => `subcat-${++subcategoryDatalistSeq}`, []);
  return (
    <Field label="Subcategory (optional)">
      <TextInput list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Windows, Filters, Hot food" />
      <datalist id={listId}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </Field>
  );
}

export function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-modal-open="1" style={{ position: "fixed", inset: 0, background: "rgba(20,26,33,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto",
        borderRadius: "16px 16px 0 0", padding: 20, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1B2430", fontFamily: "'IBM Plex Sans', sans-serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#EEF0F2", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            <X size={17} color="#5B6672" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, style, ...rest }) {
  return (
    <button {...rest} style={{
      background: "#2B4562", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px",
      fontSize: 14, fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center",
      gap: 7, justifyContent: "center", fontFamily: "inherit", ...style,
    }}>{children}</button>
  );
}

export function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "#8A94A0", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1B2430", marginTop: 2 }}>{value}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, actionLabel, onAction }) {
  return (
    <div style={{ background: "#fff", border: "1px dashed #D7DCE1", borderRadius: 14, padding: "40px 24px", textAlign: "center", marginTop: 20 }}>
      <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#EEF0F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <Icon size={20} color="#8A94A0" />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#8A94A0", maxWidth: 280, margin: "0 auto" }}>{body}</div>
      {actionLabel && <PrimaryButton onClick={onAction} style={{ margin: "16px auto 0" }}><Plus size={15} /> {actionLabel}</PrimaryButton>}
    </div>
  );
}

export function StatusDot({ tone }) { const s = toneStyles[tone]; return <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />; }

export function ConfirmDeleteButton({ onConfirm, size = 15 }) {
  const [confirming, setConfirming] = useState(false);
  if (!ACTIVE_CAN_EDIT) return null;
  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={onConfirm} style={{ background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 6, padding: "4px 8px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Delete</button>
        <button onClick={() => setConfirming(false)} style={{ background: "#EEF0F2", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 10.5, fontWeight: 700, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
      <Trash2 size={size} color="#C0C6CC" />
    </button>
  );
}

export function ExportButton({ rows, filename, label = "Export CSV" }) {
  return (
    <a href={csvHref(rows)} download={filename} style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF0F2", color: "#2B4562",
      border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 650, textDecoration: "none",
    }}><Download size={13} /> {label}</a>
  );
}

export function StatChip({ label, value, tone }) {
  const s = toneStyles[tone];
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: s.dot }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9AA5B1", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export function PriorityTag({ priority }) {
  const p = WORK_PRIORITIES.find((x) => x.key === priority) || WORK_PRIORITIES[1];
  return <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, padding: "3px 8px", borderRadius: 20 }}>{p.label}</span>;
}

export function WorkStatusTag({ status }) {
  const s = WORK_STATUSES.find((x) => x.key === status) || WORK_STATUSES[1];
  const colors = { ok: ["#2F6B4A", "#EAF4EE"], warn: ["#8A5A0B", "#FDF1E0"], danger: ["#9B2C2C", "#FBEAEA"], muted: ["#5B6672", "#EEF0F2"] }[s.tone];
  return <span style={{ fontSize: 11, fontWeight: 700, color: colors[0], background: colors[1], padding: "3px 8px", borderRadius: 20 }}>{s.label}</span>;
}

export function BudgetTypeTag({ type }) {
  const isBudgeted = type !== "non_controllable";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 650,
      color: isBudgeted ? "#2F6B4A" : "#9B5B0B", background: isBudgeted ? "#EAF4EE" : "#FDF1E0",
      padding: "3px 8px", borderRadius: 20,
    }}>
      {isBudgeted ? null : <ShieldAlert size={11} />} {isBudgeted ? "Budgeted" : "Non-controllable"}
    </span>
  );
}

export function ToggleButton({ active, children, ...rest }) {
  return (
    <button {...rest} style={{
      flex: 1, background: active ? "#2B4562" : "#fff", color: active ? "#fff" : "#5B6672",
      border: "1px solid " + (active ? "#2B4562" : "#E1E4E8"), borderRadius: 9, padding: "8px 10px",
      fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

export function MetricBlock({ label, value, tone }) {
  const color = tone === "danger" ? "#C53030" : tone === "ok" ? "#2F855A" : "#1B2430";
  return (
    <div style={{ background: "#F7F8F9", borderRadius: 9, padding: "9px 10px" }}>
      <div style={{ fontSize: 10.5, color: "#8A94A0", fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
    </div>
  );
}

export function ConfirmTextDelete({ label, onConfirm }) {
  const [c, setC] = useState(false);
  if (!ACTIVE_CAN_EDIT) return null;
  return c ? (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={onConfirm} style={{ flex: 1, background: "#FBEAEA", color: "#9B2C2C", border: "1px solid #F3C6C6", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Confirm delete</button>
      <button onClick={() => setC(false)} style={{ flex: 1, background: "#EEF0F2", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
    </div>
  ) : (
    <button onClick={() => setC(true)} style={{ background: "none", border: "none", color: "#9B2C2C", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 4 }}><Trash2 size={13} /> {label}</button>
  );
}

/* ---------------------------------------------------------
   Signature pad (finger / stylus / mouse)
--------------------------------------------------------- */
export function SignaturePad({ value, onChange, height = 130 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const dirty = useRef(false);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1B2430";
  }, [value]);
  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); const sx = canvasRef.current.width / (r.width || canvasRef.current.width); const sy = canvasRef.current.height / (r.height || canvasRef.current.height); return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }; };
  function down(e) { e.preventDefault(); drawing.current = true; last.current = pos(e); canvasRef.current.setPointerCapture?.(e.pointerId); }
  function move(e) {
    if (!drawing.current) return; e.preventDefault();
    const ctx = canvasRef.current.getContext("2d"); const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; dirty.current = true;
  }
  function up() { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(canvasRef.current.toDataURL("image/png")); }
  if (value) {
    return (
      <div style={{ position: "relative", border: "1px solid #D7DCE1", borderRadius: 10, background: "#fff", height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={value} alt="signature" style={{ maxWidth: "100%", maxHeight: height - 8 }} />
        <button type="button" onClick={() => { dirty.current = false; onChange(null); }} style={{ position: "absolute", top: 6, right: 6, background: "#EEF0F2", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 650, color: "#5B6672", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} width={600} height={height * 2} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ width: "100%", height, border: "1px dashed #9AA5B1", borderRadius: 10, background: "#FAFBFC", touchAction: "none", display: "block", cursor: "crosshair" }} />
      <span style={{ position: "absolute", left: 12, bottom: 8, fontSize: 11, color: "#A3ABB4", pointerEvents: "none" }}>Sign here with your finger</span>
    </div>
  );
}

export function GpsStamp({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  function stamp() {
    if (!navigator.geolocation) { setErr("Location isn't available on this device."); return; }
    setBusy(true); setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onChange({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0), at: new Date().toISOString() }); },
      (e) => { setBusy(false); setErr(e.code === 1 ? "Location permission was blocked — allow it for this site in your browser settings." : "Couldn't get a location fix — try again near a window or outside."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEF0F2", borderRadius: 9, padding: "9px 11px", fontSize: 12.5 }}>
        <MapPin size={15} color="#2B4562" />
        <span style={{ flex: 1 }}>{value.lat.toFixed(5)}, {value.lng.toFixed(5)}{value.accuracy ? ` (±${value.accuracy} m)` : ""} · <a href={`https://www.google.com/maps?q=${value.lat},${value.lng}`} target="_blank" rel="noreferrer" style={{ color: "#2B4562", fontWeight: 650 }}>map</a></span>
        <button type="button" onClick={() => onChange(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color="#8A94A0" /></button>
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={stamp} disabled={busy} style={{ width: "100%", minHeight: 44, background: "#fff", border: "1px solid #D7DCE1", borderRadius: 10, fontSize: 13.5, fontWeight: 650, color: "#2B4562", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <MapPin size={15} />} {busy ? "Getting location…" : "Add location stamp"}
      </button>
      {err && <div style={{ fontSize: 11.5, color: "#C53030", marginTop: 4 }}>{err}</div>}
    </div>
  );
}

export function SignOffSection({ signatures, onChange, gps, onGps, defaultTechName = "" }) {
  const set = (who, patch) => onChange({ ...signatures, [who]: { ...(signatures[who] || {}), ...patch, at: new Date().toISOString() } });
  const clear = (who) => { const n = { ...signatures }; delete n[who]; onChange(n); };
  const block = (who, label, placeholder) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>{label}</div>
      <TextInput value={signatures[who]?.name ?? (who === "technician" ? defaultTechName : "")} onChange={(e) => set(who, { name: e.target.value })} placeholder={placeholder} />
      <SignaturePad value={signatures[who]?.image || null} onChange={(img) => img ? set(who, { image: img, name: signatures[who]?.name ?? (who === "technician" ? defaultTechName : "") }) : clear(who)} />
    </div>
  );
  return (
    <div style={{ background: "#F7F8F9", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Sign-off</div>
      {block("technician", "Technician", "Technician name")}
      {block("site", "Site contact", "Site contact name")}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6672" }}>Location</div>
      <GpsStamp value={gps} onChange={onGps} />
    </div>
  );
}

export function CustomFieldInputs({ appliesTo, category, values = {}, onChange, large = false, readOnly = false }) {
  const fields = fieldsFor(appliesTo, category);
  if (!fields.length) return null;
  const set = (id, v) => onChange({ ...values, [id]: v });
  const st = large ? { fontSize: 15, padding: "11px 13px" } : {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {fields.map((f) => {
        const label = `${f.label}${f.required ? " *" : ""}`;
        const v = values[f.id];
        if (f.type === "yesno") return (
          <Field key={f.id} label={label}>
            <div style={{ display: "flex", gap: 6 }}>
              {[[true, "Yes"], [false, "No"]].map(([val, l]) => (
                <button key={l} type="button" disabled={readOnly} onClick={() => set(f.id, v === val ? undefined : val)} style={{ flex: 1, minHeight: large ? 44 : 36, borderRadius: 8, border: `1.5px solid ${v === val ? "#2B4562" : "#D7DCE1"}`, background: v === val ? "#2B4562" : "#fff", color: v === val ? "#fff" : "#2B4562", fontWeight: 700, fontSize: 13, cursor: readOnly ? "default" : "pointer", fontFamily: "inherit" }}>{l}</button>
              ))}
            </div>
          </Field>
        );
        if (f.type === "select") return (
          <Field key={f.id} label={label}>
            <Select value={v ?? ""} disabled={readOnly} onChange={(e) => set(f.id, e.target.value || undefined)} style={st}>
              <option value="">—</option>
              {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        );
        return (
          <Field key={f.id} label={label}>
            <TextInput type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} value={v ?? ""} disabled={readOnly} style={st}
              onChange={(e) => set(f.id, f.type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)} />
          </Field>
        );
      })}
    </div>
  );
}

// Up to `max` small photos, compressed so they don't fill storage.
export function PhotoStrip({ photos = [], onChange, max = 4, label = "Photos" }) {
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const files = [...(e.target.files || [])].slice(0, max - photos.length); e.target.value = "";
    if (!files.length) return; setBusy(true);
    try { const out = await Promise.all(files.map((f) => compressImage(f, 640, 0.6))); onChange([...photos, ...out].slice(0, max)); } catch (x) { /* ignore */ }
    setBusy(false);
  }
  return (
    <Field label={`${label} (${photos.length}/${max})`}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={p} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid #E1E4E8" }} />
            {onChange && <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: "#1B2430", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, lineHeight: "20px", padding: 0 }}>×</button>}
          </div>
        ))}
        {onChange && photos.length < max && (
          <label style={{ width: 60, height: 60, borderRadius: 8, border: "1.5px dashed #C0C6CC", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8A94A0", fontSize: 11, textAlign: "center" }}>
            {busy ? "…" : <ImagePlus size={18} />}
            <input type="file" accept="image/*" multiple capture="environment" onChange={pick} style={{ display: "none" }} />
          </label>
        )}
      </div>
    </Field>
  );
}
