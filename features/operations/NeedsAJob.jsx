// "Needs a job": failed checks and open safety actions waiting for the office to raise a job or say none is needed.
import { useState } from "react";
import { ClipboardX, Plus } from "lucide-react";
import { fmtDate } from "../../lib/utils.js";

const tone = { high: "var(--danger)", medium: "var(--warn)", low: "var(--muted)" };

export function NeedsAJob({ suggestions = [], onRaise, onDismiss }) {
  const [all, setAll] = useState(false);
  const [why, setWhy] = useState({});   // key → reason being typed for "No job needed"
  if (!suggestions.length) return null;
  const shown = all ? suggestions : suggestions.slice(0, 3);
  return (
    <section data-testid="needs-a-job" aria-label="Needs a job" style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: "3px solid var(--warn)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <ClipboardX size={16} color="var(--warn)" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 750 }}>Needs a job ({suggestions.length})</h3>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Failed checks and open safety actions. Raise a job for each one, or say no job is needed.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((s) => (
          <div key={s.key} data-suggestion={s.key} style={{ background: "var(--card-hi)", borderRadius: 10, padding: "9px 10px" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 750, color: tone[s.priority] || "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.kind}</span>
              {s.date && <span style={{ fontSize: 11, color: "var(--faint)" }}>{fmtDate(s.date)}</span>}
            </div>
            <div style={{ fontSize: 13.2, fontWeight: 700, marginTop: 1, overflowWrap: "anywhere" }}>{s.title}</div>
            {s.detail && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>{s.detail}</div>}
            {why[s.key] !== undefined ? (
              <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                <input aria-label="Why no job is needed" autoFocus value={why[s.key]} onChange={(e) => setWhy((p) => ({ ...p, [s.key]: e.target.value }))} placeholder="Why? e.g. fixed on the spot" style={{ flex: 1, minWidth: 160, border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, fontFamily: "inherit", background: "var(--card)", color: "var(--text)" }} />
                <button type="button" onClick={() => { onDismiss?.(s, why[s.key].trim()); setWhy((p) => { const n = { ...p }; delete n[s.key]; return n; }); }} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                <button type="button" onClick={() => setWhy((p) => { const n = { ...p }; delete n[s.key]; return n; })} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", color: "var(--muted)" }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                <button type="button" onClick={() => onRaise?.(s)} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 34 }}><Plus size={13} /> Raise a job</button>
                <button type="button" onClick={() => setWhy((p) => ({ ...p, [s.key]: "" }))} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", color: "var(--accent)", minHeight: 34 }}>No job needed</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {suggestions.length > 3 && <button type="button" onClick={() => setAll((v) => !v)} style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit" }}>{all ? "Show fewer" : `Show all ${suggestions.length}`}</button>}
    </section>
  );
}
