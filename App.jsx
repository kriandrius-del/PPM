// Entry point: shows the request portal (QR stickers), the sign-in screen, or the main app.
import { MainApp } from "./MainApp.jsx";
import { LoginScreen, RequestPortal } from "./components/RequestPortal.jsx";
import { THEME_CSS } from "./lib/theme.js";
import { SignInPortal } from "./components/SignInPortal.jsx";

export default function App() {
  const requestId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("request") : null;
  if (requestId) return <><style>{THEME_CSS}</style><RequestPortal deviceId={requestId} /></>;
  const signinLoc = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("signin") : null;
  if (signinLoc) return <><style>{THEME_CSS}</style><SignInPortal locationId={signinLoc} /></>;
  if (typeof window !== "undefined" && window.storage?.__needsLogin) return <><style>{THEME_CSS}</style><LoginScreen /></>;
  return <MainApp />;
}
