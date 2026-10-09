import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Which kind of Vercel deployment this is ("production", "preview", or "" when built elsewhere).
  // A preview copy only connects to a database marked as a test database (see storage-shim.js).
  define: { __DEPLOY_ENV__: JSON.stringify(process.env.VERCEL_ENV || "") },
});
