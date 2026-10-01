// Entry point: shows the request portal (QR stickers), the sign-in screen, or the main app.
import { MainApp } from "./MainApp.jsx";
import { LoginScreen, RequestPortal } from "./components/RequestPortal.jsx";

export default function App() {
  const requestId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("request") : null;
  if (requestId) return <RequestPortal deviceId={requestId} />;
  if (typeof window !== "undefined" && window.storage?.__needsLogin) return <LoginScreen />;
  return <MainApp />;
}
