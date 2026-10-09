# Feature map — round 30.2 (FMOS phase 1, for review)

**Status:** Phase 1 is complete and frozen for your review. Phase 2 starts only after you approve it.

**Round 30.2 changes** (role controls you asked for before the review):

- **Engineers and assets:** engineers work on the assets that exist. They can log visits and inspections, take an asset out of service or set its status, and add notes, run hours, bookings and photos on visits and jobs. They can't add, delete, archive, merge, import, copy or restructure assets: no supplier, interval, room, budget or detail changes. The database enforces this (`ppm_list_guard`), and the buttons are gone from the engineer's screens. Tapping an asset opens its record instead of the editor.
- **Quote approval is its own permission:** approving a quote over the approval limit needs **Approves quotes**. Finance always has it, the owner starts with it, and admins tick it for anyone else in Team & access. A role change clears it.
  - Editing a job never approves it.
  - Over-limit quotes can't be approved, started or finished without approval.
  - A quote raised after approval, or a job moved to another supplier or asset, goes back for approval.
  - Only approvers can change the limit.
  - The database enforces all of this (`ppm_can_approve`, `ppm_set_approver`, `ppm_list_guard`).
  - An independent review tried to get round these rules. Every gap it found is now closed and covered by tests.
- **Review-copy safety lock:** a Vercel preview build won't connect to any database unless the database is marked as the test one (`VITE_TEST_DATABASE=yes`).

**Round 30.1 changes** (fixes only, no new features): nothing from before is hidden, and each role is offered only what it can save.

- **Header figures:** the Overdue, Due ≤30d and Open quotes figures are back in the top bar, on both phone and desktop.
- **Overdue banner:** the "N services overdue — tap to review" banner is back.
- **Every area for every role:** each role sees its own areas first, then the rest under **Other areas** in the sidebar and the phone menu.
- **Section counts:** the small counts from the old Site page are back on each section, and the old Site summary figures sit on the compliance register.
- **Page summaries:** each page's one-line summary is back under its title.
- **Search:** finds vehicles again.
- **Notifications:** "snooze all non-critical" is back.
- **Branding:** hooks are in place for a company logo and colour palette, but not switched on (see DESIGN-SYSTEM.md).
- **Restore on first run:** a new, empty company can restore everything from a backup file straight from the first screen again.
- **Roles match the database:** a role is no longer offered a button the database would refuse. Settings (under More), Documents, the quote approval limit, "Not applicable" on statutory items, the on-call rota, emergency contacts, site information and site details are only editable by the roles allowed to change them. If the database does refuse a change, the app now says why (for example "Your role (Engineer) can't change site documents") and puts the screen back to what is saved.
- **Product name** is used from one place everywhere, including Excel exports.

What the app does, where each feature lives now, and where its code is. No feature was removed. Every old screen has a new place, and old links and alerts still lead to it (`app/navigation.js` → `LEGACY_TABS`).

## Where everything is now

| Area | Sections | Code |
|---|---|---|
| **Home** | What needs attention (new command centre: critical → action required → today → site health → money → coming up), Site desk (the previous Home: noticeboard, handover, reminders, notes, weather, on call, emergency contacts, statutory list, TV mode, daily briefing, weekly email) | `features/home/CommandCentre.jsx`, `tabs/HomeTab.jsx` |
| **Operations** | Planned maintenance, Reactive works, Schedule, Projects, Visit history, Logs & checks, Walk-rounds, Shutdowns | `tabs/ServicesTab.jsx`, `WorksTab.jsx`, `ScheduleTab.jsx`, `CompletedTab.jsx`, `SafetyViews.LogsView`, `MoreViews` |
| **Assets** | Locations (portfolio → site → building → floor → room → asset), Asset register (status and the reason for it), Rooms & spaces, Meters & energy, Floor plans, Isolation points | `features/assets/*`, `MoreViews.SpacesView`, `SiteTab.MetersTab` |
| **People** | On site & visitors (sign-in register, roll call, expected visitors), Suppliers & contractors (scorecard, onboarding, portal links), Team & contacts (profiles, directory, on call, emergency contacts), Occupant feedback, Car park | `features/people/PeopleViews.jsx`, `tabs/SuppliersTab.jsx` |
| **Compliance & Safety** | Compliance register (new: one red/amber/green list), Incidents, Actions, Permits, Water hygiene, Fire drills, Equipment inspections, Asbestos, COSHH, Audits, Training | `features/compliance/*`, `tabs/SiteTab.jsx`, `SafetyViews.jsx`, `MoreViews.jsx` |
| **Commercial** | Overview & approvals (new: budget, committed, spent, remaining, forecast; approval queue; cost by asset, building and supplier), Budget, POs & invoices, Contracts (new) | `features/commercial/*`, `tabs/BudgetTab.jsx`, `BudgetPlus.jsx`, `FinanceView.jsx` |
| **Resources** | Spares & stock, Keys & cards, Documents, Key dates, Waste | `tabs/SiteTab.jsx`, `SafetyViews.DocumentsView`, `MoreViews.KeyDatesView` |
| **Reports** | Monthly FM report (new: PDF, CSV and Excel, with trend against last month) and the 25 existing reports; Site health (with every site side by side) | `features/reports/*`, `modals/AppModals.ReportsModal` |
| **More** | Account, Team & access, Settings, Display, Data health, Activity log, Backup & restore, Deleted items, Help, Shortcuts | `features/more/MoreMenu.jsx`, `modals/AppModals.jsx`, `components/CloudGate.jsx` |
| **Everywhere** | Global search (grouped, with "connected" results for an asset), notification centre (critical / action required / reminder / information; read, snooze, done), live / offline / this-device chip, quick-add button | `features/search`, `features/notifications`, `app/AppShell.jsx` |
| **QR and link pages** | Report a problem, engineer visit report, supplier job portal, meter reading, check sheet, feedback, contractor self sign-in (no login, unchanged) | `components/RequestPortal.jsx`, `PublicPages.jsx`, `SignInPortal.jsx` |

## What's connected now

- **Assets.** An asset's record (tap any asset, or scan its QR code) now opens with where it is (site › building › floor › room), its status and why, and its open jobs. It also shows the next maintenance date, spend this year and to date, certificates, the supplier's insurance and contract, its compliance rows, and its QR sticker. Below that is the existing service history, tasks, notes and planned visits.
- **Places.** Each level of Locations shows its assets, how many need attention, overdue maintenance, open jobs and spend.
- **Compliance.** The register is built from statutory services, check logs, equipment inspections, water temperatures, drills, asbestos, COSHH, training, documents, contractor insurance and licences. Its red items feed Home, site health and the monthly report.
- **Money.** Approvals collect quotes over the limit, quotes to decide, POs and invoices in one place. Cost is shown by asset, building and supplier.
- **Search.** "Boiler" finds the asset and shows its supplier, open jobs, last visit, certificates and spend this year together.

## Data

- **Storage:** one JSON list per company per kind of record, in `kv_store` (key `org:<name>`), 49 lists in all.
- **New in round 30:**
  - `org:buildings`: buildings with their floors.
  - Rooms (`org:spaces`) gain `buildingId` and `floorId`.
  - Assets (`org:devices`) gain `spaceId` and an optional `statusOverride`.
  - Personal `me:notif` holds which notifications you've read or marked done.
- **Links:** an asset is in a room either through `spaceId` or because its Area text matches the room's name. **Assets → Locations → Organise into rooms** creates the rooms from Areas in one go.
- **Roles:** the database decides who may change each list (`ppm_write_roles`), with a field-by-field rule for settings (`ppm_settings_check`). Saved rows can't be moved between lists, scopes or companies (`ppm_kv_freeze`).

## Technical debt still to pay

- **MainApp.jsx** still holds all the state and save handlers (it has grown to about 3,000 lines). The plan in ROADMAP.md moves each area's state and handlers into `features/<area>/` hooks.
- **Older screens** (`tabs/`) use inline styles and the render-time `ACTIVE_CAN_EDIT` flag. New screens use the design system, but the old ones move across area by area.
- **Storage:** one JSON blob per list means the database can enforce rules per list, not per record. For example, an engineer may change the asset list because logging a visit updates it. Real tables with foreign keys come in phases 2–3.
- **Duplication:** the old statutory card on the Site desk overlaps the compliance register. It is kept for now and will be retired once the register has been in use for a while.
