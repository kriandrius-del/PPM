// Entry point: shows the request portal (QR stickers), the sign-in screen, or the main app.
import { MainApp } from "./MainApp.jsx";
import { LoginScreen, RequestPortal } from "./components/RequestPortal.jsx";
import { THEME_CSS } from "./lib/theme.js";
import { SignInPortal } from "./components/SignInPortal.jsx";
import { CheckPortal, FeedbackPortal, MeterPortal, SupplierPortal } from "./components/PublicPages.jsx";

export default function App() {
  const requestId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("request") : null;
  if (requestId) return <><style>{THEME_CSS}</style><RequestPortal deviceId={requestId} /></>;
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  if (qs.get("supplier")) return <><style>{THEME_CSS}</style><SupplierPortal token={qs.get("supplier")} /></>;
  if (qs.get("meter")) return <><style>{THEME_CSS}</style><MeterPortal meterId={qs.get("meter")} /></>;
  if (qs.get("check")) return <><style>{THEME_CSS}</style><CheckPortal logId={qs.get("check")} locationId={qs.get("site") || ""} area={qs.get("area") || ""} /></>;
  if (qs.get("feedback")) return <><style>{THEME_CSS}</style><FeedbackPortal locationId={qs.get("feedback")} area={qs.get("area") || ""} /></>;
  const signinLoc = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("signin") : null;
  if (signinLoc) return <><style>{THEME_CSS}</style><SignInPortal locationId={signinLoc} /></>;
  if (typeof window !== "undefined" && window.storage?.__needsLogin) return <><style>{THEME_CSS}</style><LoginScreen /></>;
  return <MainApp />;
}
