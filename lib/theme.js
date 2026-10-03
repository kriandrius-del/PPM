// Visual themes: "Clear Light" (default) and "Midnight".
// THEME_CSS holds the colour variables used by the shell and Home, the responsive
// layout (wide Home on desktop, bento grid) and, for Midnight, a mapping that
// re-colours every other screen's light colours to their dark equivalents.
export const THEMES = { light: "Clear Light", midnight: "Midnight", contrast: "High contrast", auto: "Auto (match device)" };
export const THEME_CSS = `
:root, .ppm-shell { --text-2: #3A4451; --faint: #7A8591; --track: #E1E4E8; --border-strong: #C7D0DA; --input: #FFFFFF; --ground: #EEF1F4; --card: #FFFFFF; --card-hi: #F6F8FA; --border: #DCE1E7; --border-hover: #B7C1CC; --text: #16202C; --muted: #56616D; --accent: #2B5D8A; --accent-soft: #E6EEF6; --ok: #1F7A4D; --ok-soft: #E6F4EC; --warn: #B45309; --warn-soft: #FDF1E0; --danger: #B42318; --danger-soft: #FDECEA; --head: #1B2430; --head-text: #FFFFFF; --on-accent: #FFFFFF; --shadow: 0 1px 2px rgba(16,24,40,0.06); --shadow-hover: 0 10px 28px rgba(16,24,40,0.10); --chart-plan: #B7C1CC; --chart-fill: rgba(43,93,138,0.14); --blur: none; }
html.ppm-midnight, html.ppm-midnight .ppm-shell { --text-2: #CBD5DE; --faint: #8796A3; --track: #2A3440; --border-strong: rgba(255,255,255,0.22); --input: #0F151C; --ground: #0B0C10; --card: #161D25; --card-hi: #1D2630; --border: rgba(255,255,255,0.10); --border-hover: rgba(255,255,255,0.24); --text: #E9EEF2; --muted: #A3B1BD; --accent: #5CC8C2; --accent-soft: rgba(69,162,158,0.16); --ok: #6FD69C; --ok-soft: rgba(111,214,156,0.14); --warn: #F2B45A; --warn-soft: rgba(242,180,90,0.14); --danger: #FF8A7A; --danger-soft: rgba(255,122,107,0.14); --head: #0B0C10; --head-text: #E9EEF2; --on-accent: #0B0C10; --shadow: none; --shadow-hover: 0 12px 32px rgba(0,0,0,0.5); --chart-plan: rgba(255,255,255,0.28); --chart-fill: rgba(92,200,194,0.18); --blur: blur(12px); }
:root { --shell-w: 100vw; }
@media (min-width: 640px) { :root { --shell-w: 460px; } .ppm-shell { max-width: 460px; box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 24px 70px rgba(0,0,0,0.18); } }
@media (min-width: 1000px) { :root { --shell-w: 1240px; } .ppm-shell { max-width: 1240px; } }
.ppm-content { width: 100%; margin: 0 auto; }
.ppm-content.narrow { max-width: 760px; }
/* Bento grid (Home) */
.bento { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; grid-auto-flow: row dense; }
.bento > .c1 { grid-column: span 1; }
.bento > .c2, .bento > .c4 { grid-column: span 2; }
@media (min-width: 1000px) {
  .bento { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .bento > .c4 { grid-column: span 4; }
  .bento > .r2 { grid-row: span 2; }
}
.bento > * { min-width: 0; animation: ppm-rise .4s ease-out both; }
.bento > *:nth-child(2) { animation-delay: .04s; } .bento > *:nth-child(3) { animation-delay: .08s; } .bento > *:nth-child(4) { animation-delay: .12s; }
.bento > *:nth-child(5) { animation-delay: .16s; } .bento > *:nth-child(6) { animation-delay: .2s; } .bento > *:nth-child(7) { animation-delay: .24s; }
.bento > *:nth-child(n+8) { animation-delay: .28s; }
.bento > .wrap > * { margin-top: 0 !important; border-radius: 20px !important; height: 100%; background: var(--card) !important; border: 1px solid var(--border) !important; box-shadow: var(--shadow); }
.bcard { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 18px; box-shadow: var(--shadow); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); color: var(--text); display: flex; flex-direction: column; gap: 10px; text-align: left; font-family: inherit; }
.bcard, .bento > .wrap > * { transition: transform .25s ease-out, border-color .25s ease-out, box-shadow .25s ease-out; }
@media (hover: hover) {
  .bcard:hover, .bento > .wrap > *:hover { transform: translateY(-3px); border-color: var(--border-hover) !important; box-shadow: var(--shadow-hover) !important; opacity: 1; }
  .brow:hover .nudge { transform: translate(2px, -2px); }
  .bcard:hover .glow { filter: drop-shadow(0 0 4px var(--accent)); }
}
.brow { display: flex; align-items: flex-start; gap: 12px; padding: 11px 12px; border-radius: 14px; border: none; width: 100%; text-align: left; cursor: pointer; font-family: inherit; color: var(--text); }
.brow .nudge { transition: transform .2s ease-out; }
.blabel { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 650; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
.bbig { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 40px; font-weight: 600; letter-spacing: -.03em; line-height: 1; }
.bsub { font-size: 12.5px; color: var(--muted); }
.bbtn { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
@media (hover: hover) { .bbtn:hover { border-color: var(--accent); opacity: 1; } }
@keyframes ppm-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .bento > *, .bcard, .brow .nudge { animation: none !important; transition: none !important; } .bcard:hover { transform: none !important; } }

html.ppm-midnight [style^="background: rgb(255, 255, 255)"], html.ppm-midnight [style*="; background: rgb(255, 255, 255)"], html.ppm-midnight [style*="background-color: rgb(255, 255, 255)"] { background: #161D25 !important; }
html.ppm-midnight [style^="background: rgb(247, 248, 249)"], html.ppm-midnight [style*="; background: rgb(247, 248, 249)"], html.ppm-midnight [style*="background-color: rgb(247, 248, 249)"] { background: #1D2630 !important; }
html.ppm-midnight [style^="background: rgb(238, 240, 242)"], html.ppm-midnight [style*="; background: rgb(238, 240, 242)"], html.ppm-midnight [style*="background-color: rgb(238, 240, 242)"] { background: #1D2630 !important; }
html.ppm-midnight [style^="background: rgb(246, 248, 250)"], html.ppm-midnight [style*="; background: rgb(246, 248, 250)"], html.ppm-midnight [style*="background-color: rgb(246, 248, 250)"] { background: #1D2630 !important; }
html.ppm-midnight [style^="background: rgb(230, 233, 236)"], html.ppm-midnight [style*="; background: rgb(230, 233, 236)"], html.ppm-midnight [style*="background-color: rgb(230, 233, 236)"] { background: #1D2630 !important; }
html.ppm-midnight [style^="background: rgb(225, 228, 232)"], html.ppm-midnight [style*="; background: rgb(225, 228, 232)"], html.ppm-midnight [style*="background-color: rgb(225, 228, 232)"] { background: #2A3440 !important; }
html.ppm-midnight [style^="background: rgb(253, 241, 224)"], html.ppm-midnight [style*="; background: rgb(253, 241, 224)"], html.ppm-midnight [style*="background-color: rgb(253, 241, 224)"] { background: rgba(242,180,90,0.16) !important; }
html.ppm-midnight [style^="background: rgb(251, 234, 234)"], html.ppm-midnight [style*="; background: rgb(251, 234, 234)"], html.ppm-midnight [style*="background-color: rgb(251, 234, 234)"] { background: rgba(255,122,107,0.16) !important; }
html.ppm-midnight [style^="background: rgb(234, 244, 238)"], html.ppm-midnight [style*="; background: rgb(234, 244, 238)"], html.ppm-midnight [style*="background-color: rgb(234, 244, 238)"] { background: rgba(111,214,156,0.14) !important; }
html.ppm-midnight [style^="background: rgb(234, 241, 248)"], html.ppm-midnight [style*="; background: rgb(234, 241, 248)"], html.ppm-midnight [style*="background-color: rgb(234, 241, 248)"] { background: rgba(92,200,194,0.14) !important; }
html.ppm-midnight [style^="background: rgb(255, 251, 235)"], html.ppm-midnight [style*="; background: rgb(255, 251, 235)"], html.ppm-midnight [style*="background-color: rgb(255, 251, 235)"] { background: rgba(242,180,90,0.10) !important; }
html.ppm-midnight [style^="background: rgb(239, 233, 251)"], html.ppm-midnight [style*="; background: rgb(239, 233, 251)"], html.ppm-midnight [style*="background-color: rgb(239, 233, 251)"] { background: rgba(167,139,250,0.16) !important; }
html.ppm-midnight [style^="background: rgb(27, 36, 48)"], html.ppm-midnight [style*="; background: rgb(27, 36, 48)"], html.ppm-midnight [style*="background-color: rgb(27, 36, 48)"] { background: #0B0C10 !important; }
html.ppm-midnight [style^="background: rgb(43, 69, 98)"], html.ppm-midnight [style*="; background: rgb(43, 69, 98)"], html.ppm-midnight [style*="background-color: rgb(43, 69, 98)"] { background: #2E7C78 !important; }
html.ppm-midnight [style^="background: rgb(253, 236, 234)"], html.ppm-midnight [style*="; background: rgb(253, 236, 234)"], html.ppm-midnight [style*="background-color: rgb(253, 236, 234)"] { background: rgba(255,122,107,0.16) !important; }
html.ppm-midnight [style^="color: rgb(27, 36, 48)"], html.ppm-midnight [style*="; color: rgb(27, 36, 48)"] { color: #E9EEF2 !important; }
html.ppm-midnight [style^="color: rgb(22, 32, 44)"], html.ppm-midnight [style*="; color: rgb(22, 32, 44)"] { color: #E9EEF2 !important; }
html.ppm-midnight [style^="color: rgb(58, 68, 81)"], html.ppm-midnight [style*="; color: rgb(58, 68, 81)"] { color: #CBD5DE !important; }
html.ppm-midnight [style^="color: rgb(91, 102, 114)"], html.ppm-midnight [style*="; color: rgb(91, 102, 114)"] { color: #A3B1BD !important; }
html.ppm-midnight [style^="color: rgb(86, 97, 109)"], html.ppm-midnight [style*="; color: rgb(86, 97, 109)"] { color: #A3B1BD !important; }
html.ppm-midnight [style^="color: rgb(138, 148, 160)"], html.ppm-midnight [style*="; color: rgb(138, 148, 160)"] { color: #8796A3 !important; }
html.ppm-midnight [style^="color: rgb(163, 171, 180)"], html.ppm-midnight [style*="; color: rgb(163, 171, 180)"] { color: #7D8A96 !important; }
html.ppm-midnight [style^="color: rgb(43, 69, 98)"], html.ppm-midnight [style*="; color: rgb(43, 69, 98)"] { color: #5CC8C2 !important; }
html.ppm-midnight [style^="color: rgb(43, 108, 176)"], html.ppm-midnight [style*="; color: rgb(43, 108, 176)"] { color: #7FB3E8 !important; }
html.ppm-midnight [style^="color: rgb(197, 48, 48)"], html.ppm-midnight [style*="; color: rgb(197, 48, 48)"] { color: #FF8A7A !important; }
html.ppm-midnight [style^="color: rgb(155, 44, 44)"], html.ppm-midnight [style*="; color: rgb(155, 44, 44)"] { color: #FF8A7A !important; }
html.ppm-midnight [style^="color: rgb(183, 121, 31)"], html.ppm-midnight [style*="; color: rgb(183, 121, 31)"] { color: #F2B45A !important; }
html.ppm-midnight [style^="color: rgb(138, 90, 11)"], html.ppm-midnight [style*="; color: rgb(138, 90, 11)"] { color: #F2B45A !important; }
html.ppm-midnight [style^="color: rgb(180, 83, 9)"], html.ppm-midnight [style*="; color: rgb(180, 83, 9)"] { color: #F2B45A !important; }
html.ppm-midnight [style^="color: rgb(217, 119, 6)"], html.ppm-midnight [style*="; color: rgb(217, 119, 6)"] { color: #F2B45A !important; }
html.ppm-midnight [style^="color: rgb(47, 133, 90)"], html.ppm-midnight [style*="; color: rgb(47, 133, 90)"] { color: #6FD69C !important; }
html.ppm-midnight [style^="color: rgb(47, 107, 74)"], html.ppm-midnight [style*="; color: rgb(47, 107, 74)"] { color: #6FD69C !important; }
html.ppm-midnight [style^="color: rgb(91, 33, 182)"], html.ppm-midnight [style*="; color: rgb(91, 33, 182)"] { color: #C4B5FD !important; }
html.ppm-midnight [style^="color: rgb(102, 102, 102)"], html.ppm-midnight [style*="; color: rgb(102, 102, 102)"] { color: #A3B1BD !important; }
html.ppm-midnight [style*="solid rgb(225, 228, 232)"], html.ppm-midnight [style*="solid rgb(215, 220, 225)"], html.ppm-midnight [style*="solid rgb(199, 208, 218)"], html.ppm-midnight [style*="solid rgb(192, 198, 204)"], html.ppm-midnight [style*="solid rgb(238, 240, 242)"], html.ppm-midnight [style*="solid rgb(201, 217, 234)"], html.ppm-midnight [style*="solid rgb(243, 198, 198)"], html.ppm-midnight [style*="solid rgb(245, 217, 168)"], html.ppm-midnight [style*="solid rgb(245, 225, 164)"], html.ppm-midnight [style*="solid rgb(220, 225, 231)"] { border-color: rgba(255,255,255,0.12) !important; }
html.ppm-midnight svg[stroke="#2B4562"] { stroke: #5CC8C2; }
html.ppm-midnight svg[stroke="#1B2430"] { stroke: #E9EEF2; }
html.ppm-midnight svg[stroke="#3A4451"] { stroke: #CBD5DE; }
html.ppm-midnight svg[stroke="#5B6672"] { stroke: #A3B1BD; }
html.ppm-midnight svg[stroke="#8A94A0"] { stroke: #8796A3; }
html.ppm-midnight svg[stroke="#A3ABB4"] { stroke: #7D8A96; }
html.ppm-midnight svg[stroke="#C0C6CC"] { stroke: #5F6B77; }
html.ppm-midnight svg[stroke="#2F855A"] { stroke: #6FD69C; }
html.ppm-midnight svg[stroke="#C53030"] { stroke: #FF8A7A; }
html.ppm-midnight svg[stroke="#B7791F"] { stroke: #F2B45A; }
html.ppm-midnight svg[stroke="#D97706"] { stroke: #F2B45A; }
html.ppm-midnight svg[stroke="#2B6CB0"] { stroke: #7FB3E8; }
html.ppm-midnight, html.ppm-midnight body { background: #0B0C10; color-scheme: dark; }
html.ppm-midnight input, html.ppm-midnight select, html.ppm-midnight textarea { color: #E9EEF2 !important; color-scheme: dark; }
html.ppm-midnight ::placeholder { color: #6B7884 !important; }
html.ppm-midnight .recharts-text { fill: #A3B1BD; }
html.ppm-midnight .recharts-cartesian-grid line { stroke: rgba(255,255,255,0.08); }
html.ppm-midnight .recharts-default-tooltip { background: #161D25 !important; border-color: rgba(255,255,255,0.12) !important; }
html.ppm-midnight [data-modal-open] > div { border: 1px solid rgba(255,255,255,0.10); }
html.ppm-midnight .ppm-shell { box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 24px 70px rgba(0,0,0,0.6) !important; }
html.ppm-midnight [style^="background: rgb(215, 220, 225)"], html.ppm-midnight [style*="; background: rgb(215, 220, 225)"], html.ppm-midnight [style*="background-color: rgb(215, 220, 225)"] { background: #2A3440 !important; }
html.ppm-midnight [style^="background: rgb(245, 241, 232)"], html.ppm-midnight [style*="; background: rgb(245, 241, 232)"], html.ppm-midnight [style*="background-color: rgb(245, 241, 232)"] { background: rgba(255,255,255,0.06) !important; }
html.ppm-midnight [style^="background: rgb(234, 238, 242)"], html.ppm-midnight [style*="; background: rgb(234, 238, 242)"], html.ppm-midnight [style*="background-color: rgb(234, 238, 242)"] { background: #1D2630 !important; }
html.ppm-midnight [style^="background: rgb(246, 247, 249)"], html.ppm-midnight [style*="; background: rgb(246, 247, 249)"], html.ppm-midnight [style*="background-color: rgb(246, 247, 249)"] { background: #1D2630 !important; }
.ppm-content.narrow { max-width: 880px !important; }
.bento.kpis { margin-bottom: 4px; }
@media (min-width: 1000px) { .bento.kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
/* Cards on every page: softer corners, gentle lift on hover (desktop) */
.ppm-content [style*="background: var(--card)"][style*="border-radius: 12px"],
.ppm-content [style*="background: var(--card)"][style*="border-radius: 10px"] { border-radius: 16px !important; }
@media (hover: hover) {
  .ppm-content.narrow button[style*="background: var(--card)"][style*="border: 1px solid"]:hover { border-color: var(--border-hover) !important; box-shadow: var(--shadow-hover); transform: translateY(-1px); opacity: 1; }
}
.ppm-content.narrow button[style*="background: var(--card)"] { transition: transform .2s ease-out, box-shadow .2s ease-out, border-color .2s ease-out; }
[data-modal-open] > div { border-radius: 22px 22px 0 0; }
@media (min-width: 640px) { [data-modal-open] > div { border-radius: 22px; } }

.navbadge { position: absolute; top: -6px; right: -12px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--danger); padding: 0 4px; display: flex; align-items: center; justify-content: center; }
.navbadge::after { content: attr(data-count); color: #fff; font-size: 9.5px; font-weight: 800; line-height: 1; }

/* High contrast: black text, strong borders, deeper colours — for bright sunlight or low vision */
html.ppm-contrast, html.ppm-contrast .ppm-shell { --ground: #FFFFFF; --card: #FFFFFF; --card-hi: #F0F2F5; --border: #1B2430; --border-hover: #000000; --border-strong: #000000; --text: #000000; --text-2: #111111; --muted: #2B2B2B; --faint: #3D3D3D; --accent: #003F8A; --accent-soft: #DCE8F7; --ok: #0B5A2A; --ok-soft: #DDF1E4; --warn: #8A3B00; --warn-soft: #FCE6CC; --danger: #A00000; --danger-soft: #FBDCDC; --head: #000000; --on-accent: #FFFFFF; --track: #C9CED6; --input: #FFFFFF; --shadow: none; --chart-plan: #555555; --chart-fill: rgba(0,63,138,0.18); }
html.ppm-contrast .bcard, html.ppm-contrast .ppm-content [style*="background: var(--card)"] { border-width: 2px !important; }
html.ppm-contrast a { text-decoration: underline; }
`;
