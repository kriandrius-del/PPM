import React from "react";
import ReactDOM from "react-dom/client";
import "./storage-shim.js";
import App from "./App.jsx";
import "./index.css";

// Install as an app (phone home screen / desktop). The browser's install prompt is
// kept so the app can offer an "Install app" button.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window.__ppmInstallPrompt = e; });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
