# Design system

Every new screen is built from the pieces below, in `components/ds.jsx`. The older screens in `tabs/` still use inline styles and will move across as each area is rebuilt.

## Principles

- **Calm and professional.** One accent colour, plenty of white space, few borders.
- **Order of importance.** Show the important thing first. Secondary actions go under "More" or behind a tap.
- **Explainable.** Anything coloured red, amber or green says why, and scores show how they were worked out.
- **Big targets on phones.** Controls are at least 40 px high, and the field buttons on the engineer's Home are 76 px.
- **Plain words.** "Needs attention", not "SLA breach exceptions".

## Tokens (CSS variables in `lib/theme.js`)

Each theme sets every token: Clear Light, Midnight and High contrast. Always use the token, never a hex value.

| Token | Use |
|---|---|
| `--ground` | Page background |
| `--card`, `--card-hi` | Cards; inner rows and tiles |
| `--border`, `--border-hover` | Lines between things |
| `--text`, `--text-2`, `--muted`, `--faint` | Text, from strongest to weakest |
| `--accent`, `--accent-soft`, `--on-accent` | Primary actions and selection |
| `--ok`, `--warn`, `--danger` (+ `-soft`) | Status: green, amber and red |
| `--shadow`, `--shadow-hover` | Card elevation |

- **Type:** IBM Plex Sans for text and IBM Plex Mono for figures. Page title 22 px/750; section title 15 px/750; label 12 px/700 caps; body 13–13.5 px; secondary 11.5–12.5 px.
- **Spacing:** 4-pixel steps. Cards have 16 px padding, the gap between cards is 12 px, and the page gutter is 20 px on desktop and 12 px on phones.
- **Corners:** cards 16 px, rows and tiles 12 px, buttons and inputs 10 px, pills 10 px.

## Components

| Component | What it's for |
|---|---|
| `Card` | Titled panel; can be clickable |
| `SectionTitle` | Heading inside a page, with an optional action on the right |
| `Btn` | `primary`, `secondary`, `ghost` or `danger`, in sizes `sm`, `md` or `lg` |
| `LinkBtn` | Inline text action, such as "All 26" |
| `Pill`, `Dot` | Status badge (tone `ok`, `warn`, `danger`, `info` or `muted`); `RAG_TONE` maps red/amber/green |
| `Kpi` | Key figure tile |
| `Row` | List row: icon or status dot, title, subtitle, right-hand slot and chevron |
| `ScoreRing` | 0–100 ring (site health) |
| `Meter` | Progress bar |
| `SubNav` | An area's sections (pill tabs) |
| `Segmented` | Filter switch inside a page |
| `Breadcrumb` | Location path (Portfolio › Site › Building › Floor › Room) |
| `Empty`, `Loading`, `Skeleton`, `ErrorBox` | Empty, loading and error states |
| `useWide()` | Wide layout (sidebar, from 1000 px) or phone/tablet layout (bottom bar) |
| `InlineModalContext` | Shows a pop-up screen inside a page, as Reports and Team & contacts do |

**Tables** use `<table className="fm-table">` inside `.fm-scroll-x`. On phones, show `Row` lists instead of tables.

**Layout:** `AppShell` provides the frame. Inside a page, use `.fm-grid-2` for two columns on desktop and one on phones, `.fm-grid` for card grids and `.fm-kpis` for figure rows.

## Status colours

| Meaning | Tone |
|---|---|
| Overdue, expired, failed, over budget | `danger` (red) |
| Due soon, waiting for someone, missing evidence | `warn` (amber) |
| In date, done, within budget | `ok` (green) |
| Information, booked, selected | `info` (accent) |
| Not applicable, archived | `muted` |

## Company branding (ready, not switched on)

Company branding will come later. These hooks are already in place, and nothing changes until they are used:

- **`lib/brand.js`** reads `settings.branding.appLogo` and `settings.branding.palette` (`{ primary, onPrimary? }`) and turns the palette into theme variables. Nothing sets them yet, so the app looks the same.
- **`AppShell`** takes a `brand` prop (`name`, `tagline`, `logo`). When a logo is set, it replaces the app mark in the sidebar and the phone header.
- **Everything coloured uses `--accent`, `--accent-soft` and `--on-accent`,** so a company palette re-colours the whole app in one place. A colour someone picks for their own device (Display) still wins on that device.
- **Product name and tagline** live in `lib/constants.js` (`PRODUCT_NAME`, `PRODUCT_TAGLINE`) and are used everywhere in the app, reports and Excel exports. The only other places are the browser-tab title in `index.html` and the phone-install name in `public/manifest.webmanifest`, which can't read the constant.
- **When branding is built:** add the upload and colour picker under More → Settings, and make the `branding` settings field admin-only in `ppm_settings_field_roles` (today coordinators and up can change it).

## Live, offline and this device only

The chip in the top bar always says where data is. **Live** is green and means saved to the company database. **Offline · N waiting** is amber and means saved on this device and not yet uploaded. **This device only** is amber and means there is no database. Never show anything that suggests local data has been shared.
