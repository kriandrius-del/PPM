// Design system: the shared building blocks for every new screen (see DESIGN-SYSTEM.md).
// Colours come from the theme variables, so light, Midnight and High contrast all work.
import { createContext, useContext, useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, Loader2, RefreshCw } from "lucide-react";

export const TONES = {
  ok: { fg: "var(--ok)", bg: "var(--ok-soft)" },
  warn: { fg: "var(--warn)", bg: "var(--warn-soft)" },
  danger: { fg: "var(--danger)", bg: "var(--danger-soft)" },
  info: { fg: "var(--accent)", bg: "var(--accent-soft)" },
  muted: { fg: "var(--muted)", bg: "var(--card-hi)" },
};
export const toneOf = (t) => TONES[t] || TONES.muted;
export const RAG_TONE = { red: "danger", amber: "warn", green: "ok" };

// Wide screen (sidebar layout) or phone/tablet (bottom bar)
export function useWide(min = 1000) {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(`(min-width: ${min}px)`) : null;
  const [wide, setWide] = useState(() => (q ? q.matches : true));
  useEffect(() => { if (!q) return; const on = (e) => setWide(e.matches); q.addEventListener ? q.addEventListener("change", on) : q.addListener(on); return () => { q.removeEventListener ? q.removeEventListener("change", on) : q.removeListener(on); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return wide;
}

export function Pill({ tone = "muted", children, title, dot = false, style }) {
  const t = toneOf(tone);
  return <span className="fm-pill" title={title} style={{ color: t.fg, background: t.bg, ...style }}>{dot && <span className="fm-dot" style={{ background: t.fg }} />}{children}</span>;
}
export function Dot({ tone = "muted", size = 9 }) { return <span className="fm-dot" style={{ background: toneOf(tone).fg, width: size, height: size }} />; }

export function Card({ title, icon: I, right, children, onClick, className = "", style, pad = true }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`fm-card${onClick ? " fm-click" : ""} ${className}`} onClick={onClick} style={{ padding: pad ? undefined : 0, ...style }}>
      {(title || right) && <div className="fm-card-head"><div className="fm-card-title">{I && <I size={15} />}<span>{title}</span></div>{right}</div>}
      {children}
    </Tag>
  );
}
export function SectionTitle({ children, right, sub }) {
  return <div className="fm-section-title"><div><div className="fm-h2">{children}</div>{sub && <div className="fm-sub">{sub}</div>}</div>{right}</div>;
}
export function Btn({ variant = "secondary", size = "md", icon: I, children, style, ...rest }) {
  return <button className={`fm-btn fm-btn-${variant} fm-btn-${size}`} style={style} {...rest}>{I && <I size={size === "sm" ? 13 : 15} />}{children}</button>;
}
export function LinkBtn({ children, ...rest }) { return <button className="fm-link" {...rest}>{children}</button>; }

export function ScoreRing({ score, size = 64, stroke = 7, tone, label }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  const t = toneOf(tone || (score == null ? "muted" : score >= 85 ? "ok" : score >= 70 ? "warn" : "danger"));
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <span className="fm-ring" style={{ width: size, height: size }} aria-label={label || (score == null ? "No score" : `${score} out of 100`)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.fg} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="fm-ring-n" style={{ fontSize: Math.round(size * 0.3) }}>{score == null ? "—" : score}</span>
    </span>
  );
}
export function Kpi({ label, value, sub, tone, onClick, title }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`fm-kpi${onClick ? " fm-click" : ""}`} onClick={onClick} title={title}>
      <div className="fm-kpi-label">{label}</div>
      <div className="fm-kpi-value" style={tone ? { color: toneOf(tone).fg } : undefined}>{value}</div>
      {sub && <div className="fm-kpi-sub">{sub}</div>}
    </Tag>
  );
}
export function Row({ icon: I, tone, title, sub, right, onClick, chevron = true }) {
  const Tag = onClick ? "button" : "div";
  const t = tone ? toneOf(tone) : null;
  return (
    <Tag className={`fm-row${onClick ? " fm-click" : ""}`} onClick={onClick}>
      {I ? <span className="fm-row-icon" style={t ? { color: t.fg, background: t.bg } : undefined}><I size={15} /></span> : tone ? <Dot tone={tone} /> : null}
      <span className="fm-row-main"><span className="fm-row-title">{title}</span>{sub && <span className="fm-row-sub">{sub}</span>}</span>
      {right}
      {onClick && chevron && <ChevronRight size={15} className="fm-row-chev" />}
    </Tag>
  );
}
export function SubNav({ items, active, onChange, label = "Sections" }) {
  return (
    <nav className="fm-subnav" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} className={`fm-subnav-item${it.key === active ? " on" : ""}`} aria-current={it.key === active ? "page" : undefined} onClick={() => onChange(it.key)}>
          {it.label}{it.badge ? <span className={`fm-count ${it.badgeTone || ""}`}>{it.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}
export function Breadcrumb({ items }) {
  return (
    <div className="fm-crumbs">
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          {i > 0 && <ChevronRight size={12} style={{ flexShrink: 0, color: "var(--faint)" }} />}
          {it.onClick ? <button className="fm-link" onClick={it.onClick}>{it.label}</button> : <span>{it.label}</span>}
        </span>
      ))}
    </div>
  );
}
export function Skeleton({ lines = 3 }) { return <div className="fm-skel">{Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${90 - i * 12}%` }} />)}</div>; }
export function Loading({ text = "Loading…" }) { return <div className="fm-loading"><Loader2 size={16} className="fm-spin" /> {text}</div>; }
export function ErrorBox({ title = "Something went wrong", body, onRetry }) {
  return <div className="fm-error"><AlertTriangle size={16} /><div style={{ flex: 1 }}><b>{title}</b>{body && <div>{body}</div>}</div>{onRetry && <Btn size="sm" icon={RefreshCw} onClick={onRetry}>Try again</Btn>}</div>;
}
export function Empty({ icon: I, title, body, action }) {
  return <div className="fm-empty">{I && <span className="fm-empty-icon"><I size={20} /></span>}<b>{title}</b>{body && <div>{body}</div>}{action}</div>;
}
export function Meter({ pct, tone = "info" }) {
  return <div className="fm-meter"><span style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, background: toneOf(tone).fg }} /></div>;
}
export function Segmented({ options, value, onChange }) {
  return <div className="fm-seg" role="tablist">{options.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

// Screens that are pop-ups elsewhere can sit inside a page (Reports, Settings…): Modal reads this.
export const InlineModalContext = createContext(false);
export function useInlineModal() { return useContext(InlineModalContext); }

export const DS_CSS = `
.fm-app { display: flex; min-height: 100vh; width: 100%; background: linear-gradient(to right, var(--card) 228px, var(--border) 228px, var(--border) 229px, var(--ground) 229px); color: var(--text); }
.fm-side { width: 228px; flex-shrink: 0; background: var(--card); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.fm-brand { display: flex; align-items: center; gap: 10px; padding: 16px 16px 14px; }
.fm-brand-mark { width: 34px; height: 34px; border-radius: 10px; background: var(--accent); color: var(--on-accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fm-brand-name { font-weight: 750; font-size: 15px; letter-spacing: .1px; }
.fm-brand-tag { font-size: 11px; color: var(--faint); }
.fm-nav { display: flex; flex-direction: column; gap: 2px; padding: 6px 10px; }
.fm-nav-item { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; border-radius: 10px; border: none; background: none; color: var(--muted); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; text-align: left; width: 100%; }
.fm-nav-item:hover { background: var(--card-hi); color: var(--text); opacity: 1; }
.fm-nav-divider { font-size: 11px; font-weight: 700; color: var(--faint); letter-spacing: .05em; text-transform: uppercase; padding: 12px 10px 4px; }
.fm-brand-logo { border-radius: 10px; object-fit: contain; background: var(--card); flex-shrink: 0; }
.fm-stats { display: flex; gap: 6px; flex-shrink: 0; }
.fm-stat { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 10px; border-radius: 16px; border: 1px solid var(--border); background: var(--card); color: var(--muted); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.fm-stat b { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 13px; color: var(--text); }
.fm-stat.danger { background: var(--danger-soft); border-color: transparent; color: var(--danger); } .fm-stat.danger b { color: var(--danger); }
.fm-stat.warn { background: var(--warn-soft); border-color: transparent; color: var(--warn); } .fm-stat.warn b { color: var(--warn); }
.fm-stat.ok { background: var(--accent-soft); border-color: transparent; color: var(--accent); } .fm-stat.ok b { color: var(--accent); }
.fm-stats-row { padding: 8px 12px; background: var(--card); border-bottom: 1px solid var(--border); overflow-x: auto; }
@media (max-width: 1240px) and (min-width: 1000px) { .fm-top .fm-stats .fm-stat span { display: none; } }
.fm-nav-item.on { background: var(--accent-soft); color: var(--accent); }
.fm-nav-item .fm-count { margin-left: auto; }
.fm-side-foot { margin-top: auto; padding: 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.fm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fm-top { display: flex; align-items: center; gap: 10px; padding: 10px 20px; background: var(--card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; min-height: 58px; }
.fm-top-phone { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
.fm-site-btn { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); color: var(--text); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.fm-site-btn .fm-sub { font-weight: 500; }
.fm-search { flex: 1; max-width: 520px; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--card-hi); color: var(--faint); font: inherit; font-size: 13px; cursor: text; text-align: left; }
.fm-search { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fm-search kbd { margin-left: auto; font-family: inherit; font-size: 11px; border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; color: var(--faint); background: var(--card); }
.fm-icon-btn { position: relative; width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); color: var(--text); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.fm-icon-btn .fm-count { position: absolute; top: -6px; right: -6px; }
.fm-live { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; padding: 0 10px; border-radius: 16px; border: 1px solid var(--border); background: var(--card); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.fm-page { width: 100%; max-width: 1180px; margin: 0 auto; padding: 18px 20px 100px; min-width: 0; }
.fm-page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.fm-h1 { font-size: 22px; font-weight: 750; letter-spacing: -.01em; margin: 0; }
.fm-h2 { font-size: 15px; font-weight: 750; }
.fm-sub { font-size: 12.5px; color: var(--muted); }
.fm-subnav { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 10px; margin-bottom: 8px; scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
.fm-subnav-item { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 13px; border-radius: 18px; border: 1px solid var(--border); background: var(--card); color: var(--text-2); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; white-space: nowrap; }
.fm-subnav-item.on { background: var(--text); color: var(--card); border-color: var(--text); }
.fm-count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--danger); color: #fff; font-size: 10.5px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
.fm-count.warn { background: var(--warn); } .fm-count.muted { background: var(--faint); }
.fm-bottom { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; background: var(--card); border-top: 1px solid var(--border); padding-bottom: env(safe-area-inset-bottom, 0px); }
.fm-bottom button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 58px; border: none; background: none; color: var(--muted); font: inherit; font-size: 10.8px; font-weight: 650; cursor: pointer; position: relative; }
.fm-bottom button.on { color: var(--accent); }
.fm-bottom .fm-count { position: absolute; top: 5px; left: calc(50% + 6px); }
.fm-sheet-back { position: fixed; inset: 0; background: rgba(20,26,33,.45); z-index: 60; display: flex; align-items: flex-end; }
.fm-sheet { width: 100%; background: var(--card); border-radius: 20px 20px 0 0; padding: 14px 14px calc(18px + env(safe-area-inset-bottom, 0px)); max-height: 85vh; overflow-y: auto; }
.fm-sheet-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.fm-sheet-grid button { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px; border-radius: 14px; border: 1px solid var(--border); background: var(--card-hi); color: var(--text); font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; text-align: center; }
.fm-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; color: var(--text); font: inherit; text-align: left; box-shadow: var(--shadow); }
.fm-click { cursor: pointer; transition: border-color .2s, box-shadow .2s, transform .2s; }
@media (hover: hover) { .fm-click:hover { border-color: var(--border-hover); box-shadow: var(--shadow-hover); opacity: 1; } }
.fm-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.fm-card-title { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
.fm-section-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; margin: 18px 0 8px; }
.fm-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); }
.fm-grid-2 { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1000px) { .fm-grid-2 { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); } }
.fm-kpis { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(130px, 100%), 1fr)); }
.fm-kpi { background: var(--card-hi); border: 1px solid transparent; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; font: inherit; text-align: left; color: var(--text); }
.fm-kpi-label { font-size: 11.5px; font-weight: 650; color: var(--muted); }
.fm-kpi-value { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 20px; font-weight: 600; letter-spacing: -.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-kpi-sub { font-size: 11.5px; color: var(--faint); }
.fm-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 8px 10px; border-radius: 12px; border: none; background: var(--card-hi); color: var(--text); font: inherit; text-align: left; }
.fm-row-icon { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
.fm-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.fm-row-title { font-size: 13.3px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-row-sub { font-size: 11.8px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-row-chev { color: var(--faint); flex-shrink: 0; }
.fm-list { display: flex; flex-direction: column; gap: 6px; }
.fm-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 10px; padding: 2px 8px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.fm-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.fm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 10px; font: inherit; font-weight: 650; cursor: pointer; white-space: nowrap; border: 1px solid transparent; }
.fm-btn-md { min-height: 40px; padding: 0 14px; font-size: 13.5px; } .fm-btn-sm { min-height: 32px; padding: 0 10px; font-size: 12.5px; } .fm-btn-lg { min-height: 52px; padding: 0 18px; font-size: 15px; }
.fm-btn-primary { background: var(--accent); color: var(--on-accent); }
.fm-btn-secondary { background: var(--card); color: var(--text); border-color: var(--border); }
.fm-btn-ghost { background: none; color: var(--accent); }
.fm-btn-danger { background: var(--danger-soft); color: var(--danger); }
.fm-btn:disabled { opacity: .5; cursor: not-allowed; }
.fm-link { background: none; border: none; padding: 0; color: var(--accent); font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.fm-ring { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fm-ring svg { position: absolute; inset: 0; }
.fm-ring-n { position: relative; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 600; letter-spacing: -.03em; }
.fm-crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); }
.fm-skel { display: flex; flex-direction: column; gap: 8px; } .fm-skel span { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--card-hi), var(--track), var(--card-hi)); background-size: 200% 100%; animation: fm-shimmer 1.2s infinite; }
@keyframes fm-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.fm-loading { display: flex; align-items: center; gap: 8px; color: var(--faint); font-size: 13px; padding: 20px; justify-content: center; }
.fm-spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.fm-error { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 12px; background: var(--danger-soft); color: var(--danger); font-size: 13px; }
.fm-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 26px 16px; color: var(--muted); font-size: 13px; }
.fm-empty b { color: var(--text); font-size: 14px; }
.fm-empty-icon { width: 42px; height: 42px; border-radius: 12px; background: var(--accent-soft); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; }
.fm-meter { height: 7px; border-radius: 4px; background: var(--track); overflow: hidden; } .fm-meter span { display: block; height: 100%; border-radius: 4px; }
.fm-seg { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--card-hi); border: 1px solid var(--border); gap: 2px; }
.fm-seg button { min-height: 30px; padding: 0 11px; border-radius: 8px; border: none; background: none; color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.fm-seg button.on { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.fm-table { width: 100%; border-collapse: collapse; font-size: 13px; overflow-wrap: normal; word-break: normal; }
.fm-fab { bottom: calc(20px + env(safe-area-inset-bottom, 0px)) !important; }
@media (max-width: 999px) { .fm-fab { bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important; } }
.fm-table th { text-align: left; font-size: 11.5px; font-weight: 700; color: var(--muted); padding: 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.fm-table td { padding: 9px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.fm-table tr.fm-click:hover td { background: var(--card-hi); }
.fm-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.fm-tree button { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 36px; padding: 0 8px; border-radius: 9px; border: none; background: none; color: var(--text); font: inherit; font-size: 13px; cursor: pointer; text-align: left; }
.fm-tree button.on { background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.fm-tree button:hover { background: var(--card-hi); opacity: 1; }
.fm-big-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.fm-big-actions button { min-height: 76px; border-radius: 16px; border: 1px solid var(--border); background: var(--card); color: var(--text); font: inherit; font-size: 14px; font-weight: 700; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.fm-big-actions button.primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.fm-inline-modal { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
@media (max-width: 999px) { .fm-page { padding: 14px 12px 96px; } .fm-h1 { font-size: 19px; } }
`;
