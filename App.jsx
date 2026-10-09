// Entry point: QR / link pages (no login), then — when the app runs with a database — sign-in and
// company setup (CloudGate), then the main app.
import { MainApp } from "./MainApp.jsx";
import { RequestPortal } from "./components/RequestPortal.jsx";
import { CloudGate } from "./components/CloudGate.jsx";
import { THEME_CSS } from "./lib/theme.js";
import { SignInPortal } from "./components/SignInPortal.jsx";
import { CheckPortal, FeedbackPortal, MeterPortal, SupplierPortal } from "./components/PublicPages.jsx";

export default function App() {
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const pub = (el) => <><style>{THEME_CSS}</style>{el}</>;
  // A review copy whose database isn't marked as the test one stops here, so it can never touch live data.
  if (typeof window !== "undefined" && window.ppmReviewLock) return pub(<ReviewLocked />);
  if (qs.get("request")) return pub(<RequestPortal deviceId={qs.get("request")} />);
  if (qs.get("supplier")) return pub(<SupplierPortal token={qs.get("supplier")} />);
  if (qs.get("meter")) return pub(<MeterPortal meterId={qs.get("meter")} />);
  if (qs.get("check")) return pub(<CheckPortal logId={qs.get("check")} locationId={qs.get("site") || ""} area={qs.get("area") || ""} />);
  if (qs.get("feedback")) return pub(<FeedbackPortal locationId={qs.get("feedback")} area={qs.get("area") || ""} />);
  if (qs.get("signin")) return pub(<SignInPortal locationId={qs.get("signin")} />);
  if (typeof window !== "undefined" && window.ppmCloud) return pub(<CloudGate><MainApp /></CloudGate>);
  return <MainApp />;
}

function ReviewLocked() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--ground, #EEF1F4)", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 520, background: "var(--card, #fff)", color: "var(--text, #17212C)", border: "1px solid var(--border, #DCE2E8)", borderRadius: 14, padding: "22px 22px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 19, fontWeight: 750 }}>This review copy is locked</div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>It's a preview build, and its database settings aren't marked as a test database, so it won't connect to anything. That keeps your live data safe.</div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>To use it, open Vercel → Settings → Environment Variables and, for this branch only (Preview), set <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> to your <b>test</b> Supabase project, and <b>VITE_TEST_DATABASE</b> to <b>yes</b>. Then redeploy this branch.</div>
        <div style={{ fontSize: 12.5, color: "var(--muted, #66727F)" }}>Your live site is not affected by this message.</div>
      </div>
    </div>
  );
}
