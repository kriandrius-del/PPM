// Engineer field mode (Phase 2, round 31.2): scan an asset's QR code → one screen with big buttons →
// Start visit · Log inspection · Report a problem · Photo · Meter reading. Minimal typing; everything else is one tap away.
import { useState } from "react";
import { AlertTriangle, Camera, ClipboardCheck, FileText, Gauge, Loader2, Play, Timer } from "lucide-react";
import { Modal, TextArea, TextInput } from "../../components/ui.jsx";
import { compressImage, daysUntil, fmtDate } from "../../lib/utils.js";
import { INSPECTION_RESULTS, durationText, hhmm, minutesBetween } from "./usePlanned.js";

const TONE = { ok: ["var(--ok)", "var(--ok-soft)"], warn: ["var(--warn)", "var(--warn-soft)"], danger: ["var(--danger)", "var(--danger-soft)"], info: ["var(--accent)", "var(--accent-soft)"], muted: ["var(--muted)", "var(--card-hi)"] };
const big = (bg, fg, border) => ({ minHeight: 76, borderRadius: 14, border: border || "none", background: bg, color: fg, fontSize: 15, fontWeight: 750, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, textAlign: "center" });
const small = (primary) => ({ minHeight: 48, borderRadius: 12, border: primary ? "none" : "1px solid var(--border)", background: primary ? "var(--accent)" : "var(--card)", color: primary ? "var(--on-accent)" : "var(--accent)", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flex: 1 });

function PhotoInput({ photo, onPhoto, label = "Take a photo" }) {
  const [busy, setBusy] = useState(false);
  async function pick(e) { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { onPhoto(await compressImage(f)); } catch (x) { /* try again */ } setBusy(false); }
  return (
    <label style={{ ...big(photo ? "transparent" : "var(--card-hi)", "var(--accent)", photo ? "none" : "1px dashed var(--border)"), minHeight: photo ? 0 : 76, padding: photo ? 0 : 10 }}>
      {photo ? <img src={photo} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} /> : <>{busy ? <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={24} />}<span>{label}</span></>}
      <input type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: "none" }} />
    </label>
  );
}

export function FieldCard({ device, placeText = "", status = null, openJobs = [], me = "", meters = [], readings = [], draft = null, canEdit = true, onStartVisit, onInspection, onReport, onPhoto, onMeter, onOpenJob, onFullRecord, onClose }) {
  const [mode, setMode] = useState("menu");
  const [result, setResult] = useState(null); const [note, setNote] = useState(""); const [photo, setPhoto] = useState(null); const [flag, setFlag] = useState(true);
  const [caption, setCaption] = useState("");
  const linked = meters.filter((m) => m.deviceId === device.id);
  const [meterId, setMeterId] = useState((linked[0] || meters[0] || {}).id || ""); const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const mine = draft && draft.deviceId === device.id;
  const elsewhere = draft && draft.deviceId !== device.id;
  const n = daysUntil(device.nextServiceDate);
  const back = () => { setMode("menu"); setErr(""); setResult(null); setNote(""); setPhoto(null); setCaption(""); setValue(""); };
  const tone = TONE[status?.tone] || TONE.muted;
  const lastReading = (id) => readings.filter((r) => r.meterId === id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  return (
    <Modal title={device.name} onClose={onClose}>
      <div data-testid="field-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 12.5, color: "var(--muted)" }}>
          {status && <span style={{ fontSize: 11.5, fontWeight: 750, color: tone[0], background: tone[1], padding: "3px 9px", borderRadius: 20 }}>{status.label}</span>}
          {placeText && <span>{placeText}</span>}
          {device.assetTag && <span>· {device.assetTag}</span>}
        </div>
        {device.nextServiceDate && <div style={{ fontSize: 13, color: n < 0 ? "var(--danger)" : "var(--text-2)", fontWeight: n < 0 ? 700 : 500 }}>Planned maintenance {n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? "due today" : `due ${fmtDate(device.nextServiceDate)}`}{device.lastServiceDate ? ` · last visit ${fmtDate(device.lastServiceDate)}` : ""}</div>}
        {openJobs.length > 0 && mode === "menu" && (
          <div style={{ background: "var(--card-hi)", borderRadius: 12, padding: "8px 10px" }}>
            <div style={{ fontSize: 12, fontWeight: 750, color: "var(--muted)", marginBottom: 4 }}>Open jobs here ({openJobs.length})</div>
            {openJobs.slice(0, 4).map((w) => (
              <button key={w.id} type="button" onClick={() => onOpenJob?.(w.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "5px 0", fontSize: 13.5, color: "var(--text)", cursor: "pointer", fontFamily: "inherit", borderTop: "1px solid var(--border)" }}>
                {w.assignee === me && me ? <b style={{ color: "var(--accent)" }}>Yours · </b> : null}{w.description}
              </button>
            ))}
          </div>
        )}
        {mode === "menu" && (
          <>
            {elsewhere && <div style={{ fontSize: 12.5, background: "var(--warn-soft)", color: "var(--warn)", borderRadius: 10, padding: "8px 10px", fontWeight: 650 }}>You have a visit in progress on another asset. Finish it first: starting a visit here asks before it discards that one.</div>}
            {canEdit && (
              <button type="button" onClick={() => onStartVisit?.()} style={{ ...big("var(--accent)", "var(--on-accent)"), minHeight: 84, flexDirection: "row", gap: 10 }}>
                {mine ? <Timer size={26} /> : <Play size={26} />}
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span>{mine ? "Continue visit" : "Start visit"}</span>
                  <span style={{ fontSize: 12, fontWeight: 550, opacity: 0.9 }}>{mine ? `Started ${hhmm(draft.startedAt)} · ${durationText(minutesBetween(draft.startedAt, new Date().toISOString()))} so far` : "Times it, then checklist, photos and sign-off"}</span>
                </span>
              </button>
            )}
            {canEdit && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button type="button" onClick={() => setMode("inspect")} style={big("var(--card)", "var(--text)", "1px solid var(--border)")}><ClipboardCheck size={24} color="var(--ok)" />Log inspection</button>
                <button type="button" onClick={() => onReport?.()} style={big("var(--card)", "var(--text)", "1px solid var(--border)")}><AlertTriangle size={24} color="var(--danger)" />Report a problem</button>
                <button type="button" onClick={() => setMode("photo")} style={big("var(--card)", "var(--text)", "1px solid var(--border)")}><Camera size={24} color="var(--accent)" />Photo</button>
                <button type="button" onClick={() => setMode("meter")} disabled={!meters.length} style={{ ...big("var(--card)", "var(--text)", "1px solid var(--border)"), opacity: meters.length ? 1 : 0.5 }}><Gauge size={24} color="var(--warn)" />Meter reading</button>
              </div>
            )}
          </>
        )}
        {mode === "inspect" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 750 }}>How is it?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {Object.entries(INSPECTION_RESULTS).map(([k, r]) => { const t = TONE[r.tone]; const on = result === k; return (
                <button key={k} type="button" aria-pressed={on} onClick={() => { setResult(k); setErr(""); }} style={{ minHeight: 64, borderRadius: 12, border: `2px solid ${t[0]}`, background: on ? t[0] : "var(--card)", color: on ? "#fff" : t[0], fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{r.label}</button>
              ); })}
            </div>
            {result && result !== "ok" && <TextArea aria-label="What's wrong" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong?" style={{ fontSize: 15 }} />}
            {result && result !== "ok" && <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}><input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} style={{ width: 20, height: 20, margin: 0 }} /> Mark the asset “{result === "failed" ? "Failed" : "Attention required"}”</label>}
            <PhotoInput photo={photo} onPhoto={setPhoto} label="Add a photo (optional)" />
            {result && result !== "ok" && <div style={{ fontSize: 12, color: "var(--muted)" }}>The office sees it under Needs a job and raises a job if one is needed. To raise one yourself, use Report a problem.</div>}
            {err && <div style={{ fontSize: 13, color: "var(--danger)" }}>{err}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={back} style={small(false)}>Back</button>
              <button type="button" onClick={() => { if (!result) { setErr("Choose how it is."); return; } if (result !== "ok" && !note.trim()) { setErr("Say what's wrong."); return; } if (onInspection?.({ result, note, photo, setStatus: flag })) back(); }} style={small(true)}>Save inspection</button>
            </div>
          </div>
        )}
        {mode === "photo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PhotoInput photo={photo} onPhoto={setPhoto} />
            <TextInput aria-label="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" style={{ fontSize: 15, padding: "12px 14px" }} />
            {err && <div style={{ fontSize: 13, color: "var(--danger)" }}>{err}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={back} style={small(false)}>Back</button>
              <button type="button" onClick={() => { if (!photo) { setErr("Take a photo first."); return; } if (onPhoto?.(photo, caption)) back(); }} style={small(true)}>Save photo</button>
            </div>
          </div>
        )}
        {mode === "meter" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <select aria-label="Meter" value={meterId} onChange={(e) => setMeterId(e.target.value)} style={{ fontSize: 15, padding: "12px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", fontFamily: "inherit" }}>
              {[...linked, ...meters.filter((m) => !linked.includes(m))].map((m) => <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ""}</option>)}
            </select>
            {meterId && lastReading(meterId) && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Last reading {lastReading(meterId).value} on {fmtDate(lastReading(meterId).date)}</div>}
            <TextInput aria-label="Reading" type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Reading" style={{ fontSize: 22, padding: "12px 14px", fontFamily: "'IBM Plex Mono', monospace" }} />
            {err && <div style={{ fontSize: 13, color: "var(--danger)" }}>{err}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={back} style={small(false)}>Back</button>
              <button type="button" onClick={() => { if (value === "" || isNaN(Number(value))) { setErr("Type the reading."); return; } const last = lastReading(meterId); if (last && Number(value) < Number(last.value) && !window.confirm(`That's lower than the last reading (${last.value}). Save it anyway?`)) return; if (onMeter?.(meterId, value)) back(); }} style={small(true)}>Save reading</button>
            </div>
          </div>
        )}
        <button type="button" onClick={onFullRecord} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 6 }}><FileText size={15} /> Open the full record</button>
      </div>
    </Modal>
  );
}
