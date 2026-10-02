// Page title plus a row of key-figure tiles, in the same bento style as Home.
export function PageHeader({ title, subtitle, kpis = [] }) {
  const tone = (t) => (t === "danger" ? "var(--danger)" : t === "warn" ? "var(--warn)" : t === "ok" ? "var(--ok)" : "var(--text)");
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{title}</h1>
        {subtitle && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{subtitle}</span>}
      </div>
      {kpis.length > 0 && (
        <div className="bento kpis">
          {kpis.map((k) => {
            const I = k.icon;
            const Tag = k.onClick ? "button" : "div";
            return (
              <Tag key={k.label} className="bcard c1" onClick={k.onClick} style={{ padding: "14px 16px", gap: 6, cursor: k.onClick ? "pointer" : "default" }}>
                <div className="blabel">{I && <I size={13} />}<span>{k.label}</span></div>
                <div className="bbig" style={{ fontSize: 26, color: tone(k.tone) }}>{k.value}</div>
                {k.sub && <div className="bsub" style={{ fontSize: 11.5 }}>{k.sub}</div>}
              </Tag>
            );
          })}
        </div>
      )}
    </div>
  );
}
