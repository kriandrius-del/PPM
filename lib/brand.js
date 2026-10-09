// Company branding — the hook for a later version (company logo and colour palette).
// Nothing here is switched on yet: there is no screen to set these, so the app looks exactly as before.
// When branding is built, it will save to settings.branding:
//   appLogo  — image (data URL or stored photo) shown in place of the app mark
//   palette  — { primary: "#RRGGBB", onPrimary?: "#RRGGBB" } applied to the theme's accent colour
// Reports already use settings.branding.companyName and .logo (More → Display → Branding).
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "./constants.js";

const HEX = /^#[0-9a-f]{6}$/i;
function readable(hex) {   // black or white text on a colour, whichever reads better
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0B0C10" : "#FFFFFF";
}
export function brandFrom(settings) {
  const b = (settings && settings.branding) || {};
  const p = b.palette && HEX.test(String(b.palette.primary || "")) ? { primary: b.palette.primary, onPrimary: HEX.test(String(b.palette.onPrimary || "")) ? b.palette.onPrimary : readable(b.palette.primary) } : null;
  return { name: PRODUCT_NAME, tagline: PRODUCT_TAGLINE, companyName: b.companyName || "", logo: typeof b.appLogo === "string" && /^(data:image\/(png|jpeg|webp);|https:\/\/)/.test(b.appLogo) ? b.appLogo : null, palette: p };
}
// Theme variables for the company palette (empty until a palette is set).
export function brandCssVars(brand, dark = false) {
  if (!brand || !brand.palette) return {};
  const c = brand.palette.primary;
  return { "--accent": c, "--accent-soft": `color-mix(in srgb, ${c} ${dark ? 18 : 12}%, transparent)`, "--on-accent": brand.palette.onPrimary };
}
