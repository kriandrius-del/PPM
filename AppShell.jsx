// The frame around every screen: sidebar (desktop) or bottom bar (phone), top bar with site, search,
// live/offline state, notifications and profile, then the area's sections and the page itself.
import { useState } from "react";
import { Bell, ChevronDown, Cloud, CloudOff, HardDrive, Menu, Search, User, Wrench, X, AlertTriangle, RefreshCw } from "lucide-react";
import { SubNav, useWide } from "../components/ds.jsx";
import { AREA_BY_KEY } from "./navigation.js";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../lib/constants.js";

// LIVE (saved to the company database), OFFLINE (changes waiting on this device) or THIS DEVICE ONLY (no database).
export function liveState({ cloud, pendingCount = 0, saveErrors = 0, syncing = false }) {
  if (saveErrors) return { kind: "error", label: "Not saved", tone: "danger", icon: AlertTriangle, text: "Some changes could not be saved. Open Activity & backup for details, and download a backup to be safe." };
  if (!cloud) return { kind: "local", label: "This device only", tone: "warn", icon: HardDrive, text: "Your data is kept in this browser only — it isn't shared with your team or backed up anywhere else. Download backups regularly, or connect your company database (More → Team & access) to go live." };
  if (pendingCount) return { kind: "offline", label: `Offline · ${pendingCount} waiting`, tone: "warn", icon: CloudOff, text: `${pendingCount} change${pendingCount === 1 ? " is" : "s are"} saved on this device but not yet in the company database. They upload automatically when you're back online — don't sign out until they have.` };
  return { kind: "live", label: syncing ? "Live · syncing" : "Live", tone: "ok", icon: Cloud, text: "Connected to your company's database. Your changes are saved for everyone straight away." };
}

export function LiveChip({ state, onClick, compact = false }) {
  const I = state.icon;
  const short = { local: "Device", live: "Live", offline: state.label.replace("Offline · ", ""), error: "Not saved" }[state.kind] || state.label;
  const fg = state.tone === "ok" ? "var(--ok)" : state.tone === "danger" ? "var(--danger)" : "var(--warn)";
  return (
    <button className="fm-live" onClick={onClick} title={state.text} aria-label={`Data: ${state.label}`} data-live={state.kind} style={{ color: fg }}>
      <I size={14} /> {compact ? short : state.label}
    </button>
  );
}

export function AppShell({ areas, otherAreas = [], stats = [], brand = {}, area, section, onNavigate, areaBadges = {}, sectionBadges = {}, siteLabel, siteSub, onSite, onSearch, alertsCount = 0, onAlerts, live, onLive, userName, roleLabel, onProfile, phoneKeys = [], banners = null, pageTitle, pageSub, pageRight, children, onRefresh, syncing }) {
  const wide = useWide();
  const [menu, setMenu] = useState(false);
  const cur = AREA_BY_KEY[area];
  const subItems = (cur?.sections || []).map(([k, l]) => ({ key: k, label: l, badge: sectionBadges[`${area}.${k}`]?.n, badgeTone: sectionBadges[`${area}.${k}`]?.tone }));
  const go = (a, s) => { setMenu(false); onNavigate(a, s); };
  const count = (n, tone) => (n ? <span className={`fm-count ${tone || ""}`}>{n > 99 ? "99+" : n}</span> : null);
  // company branding hook: a logo replaces the default mark when one is set (not switched on in this version)
  const mark = (size) => brand.logo ? <img src={brand.logo} alt="" className="fm-brand-logo" style={{ width: size, height: size }} /> : <span className="fm-brand-mark" style={{ width: size, height: size }}><Wrench size={Math.round(size / 2)} /></span>;
  const brandName = brand.name || PRODUCT_NAME; const brandTag = brand.tagline || PRODUCT_TAGLINE;
  // the quick figures that used to sit in the header (overdue, due within 30 days, open quotes)
  const statChips = stats.length > 0 && (
    <div className="fm-stats" role="group" aria-label="Quick figures">
      {stats.map((st) => <button key={st.label} className={`fm-stat ${st.value ? st.tone || "" : "zero"}`} onClick={st.onClick} title={st.title || st.label}><b>{st.value}</b> {st.label}</button>)}
    </div>
  );
  const navButton = (a) => { const I = a.icon; return (
    <button key={a.key} className={`fm-nav-item${a.key === area ? " on" : ""}`} aria-current={a.key === area ? "page" : undefined} onClick={() => go(a.key)}>
      <I size={17} /> {a.label} {count(areaBadges[a.key]?.n, areaBadges[a.key]?.tone)}
    </button>
  ); };
  const page = (
    <div className="fm-page">
      <div className="fm-page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="fm-h1">{pageTitle || cur?.label}</h1>
          {pageSub && <div className="fm-sub" style={{ marginTop: 2 }}>{pageSub}</div>}
        </div>
        {pageRight}
      </div>
      {subItems.length > 1 && <SubNav items={subItems} active={section} onChange={(k) => onNavigate(area, k)} label={`${cur.label} sections`} />}
      {children}
    </div>
  );
  if (wide) return (
    <div className="fm-app">
      <aside className="fm-side" aria-label="Main navigation">
        <div className="fm-brand">{mark(34)}<div><div className="fm-brand-name">{brandName}</div><div className="fm-brand-tag">{brandTag}</div></div></div>
        <nav className="fm-nav">
          {areas.map(navButton)}
          {otherAreas.length > 0 && <div className="fm-nav-divider">Other areas</div>}
          {otherAreas.map(navButton)}
        </nav>
        <div className="fm-side-foot">
          <LiveChip state={live} onClick={onLive} />
          {onRefresh && <button className="fm-link" onClick={onRefresh} style={{ display: "flex", alignItems: "center", gap: 5 }}><RefreshCw size={12} className={syncing ? "fm-spin" : ""} /> Refresh now</button>}
        </div>
      </aside>
      <div className="fm-main">
        <header className="fm-top">
          <button className="fm-site-btn" onClick={onSite} title="Change site"><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siteLabel}{siteSub && <span className="fm-sub"> · {siteSub}</span>}</span><ChevronDown size={14} /></button>
          <button className="fm-search" onClick={onSearch} aria-label="Search everything"><Search size={15} /> Search assets, jobs, suppliers, rooms… <kbd>/</kbd></button>
          {statChips}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button className="fm-icon-btn" onClick={onAlerts} title="Notifications" aria-label="Notifications">{<Bell size={16} />}{count(alertsCount)}</button>
            <button className="fm-site-btn" onClick={onProfile} title="Profile"><User size={14} /><span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName || "Profile"}</span>{roleLabel && <span className="fm-sub">{roleLabel}</span>}</button>
          </div>
        </header>
        {banners}
        {page}
      </div>
    </div>
  );
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "var(--ground)", color: "var(--text)" }}>
      <header className="fm-top-phone">
        <button className="fm-site-btn" onClick={onSite} style={{ flex: 1, justifyContent: "space-between", border: "none", padding: "0 4px", background: "none" }} title="Change site">
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{mark(30)}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siteLabel}</span></span>
          <ChevronDown size={14} />
        </button>
        <LiveChip state={live} onClick={onLive} compact />
        <button className="fm-icon-btn" onClick={onSearch} aria-label="Search everything" title="Search everything"><Search size={16} /></button>
        <button className="fm-icon-btn" onClick={onAlerts} aria-label="Notifications" title="Notifications"><Bell size={16} />{count(alertsCount)}</button>
        <button className="fm-icon-btn" onClick={onProfile} aria-label="Profile" title={userName || "Profile"}><User size={16} /></button>
      </header>
      {statChips && <div className="fm-stats-row">{statChips}</div>}
      {banners}
      {page}
      <nav className="fm-bottom" aria-label="Main navigation">
        {phoneKeys.map((k) => { const a = AREA_BY_KEY[k]; const I = a.icon; return (
          <button key={k} className={k === area ? "on" : ""} aria-current={k === area ? "page" : undefined} onClick={() => go(k)}><I size={19} />{a.short || a.label}{count(areaBadges[k]?.n, areaBadges[k]?.tone)}</button>
        ); })}
        <button className={!phoneKeys.includes(area) ? "on" : ""} onClick={() => setMenu(true)} aria-label="All areas"><Menu size={19} />Menu</button>
      </nav>
      {menu && (
        <div className="fm-sheet-back" onClick={() => setMenu(false)}>
          <div className="fm-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="All areas">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="fm-h2">{brandName}</div>
              <button className="fm-icon-btn" onClick={() => setMenu(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="fm-sheet-grid">
              {areas.map((a) => { const I = a.icon; return <button key={a.key} onClick={() => go(a.key)} style={a.key === area ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}><I size={20} />{a.label}{count(areaBadges[a.key]?.n, areaBadges[a.key]?.tone)}</button>; })}
            </div>
            {otherAreas.length > 0 && <>
              <div className="fm-nav-divider" style={{ padding: "14px 2px 8px" }}>Other areas</div>
              <div className="fm-sheet-grid">
                {otherAreas.map((a) => { const I = a.icon; return <button key={a.key} onClick={() => go(a.key)} style={a.key === area ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}><I size={20} />{a.label}{count(areaBadges[a.key]?.n, areaBadges[a.key]?.tone)}</button>; })}
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
