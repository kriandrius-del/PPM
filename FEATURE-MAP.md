# Feature map — round 31.1 (FMOS phase 2, parts 1 and 2)

**Status:** Phase 1 was approved by the owner on 14 Oct 2026, on round 30.4 (commit `d96b32b`). Before going live, the owner's Roles & permissions and QR/link checks must still pass (deferred from the review). **Phase 2 (Operations) is being built on the review copy:** part 1 (one job lifecycle) and part 2 (engineer field mode and visits) are in round 31.1; part 3 (jobs and visits in proper database tables) comes next. Phase 2 needs the owner's review and approval like Phase 1.

**Round 31.1 — Phase 2, parts 1 and 2** (the owner's decisions of 14 Oct 2026: skip stages a job doesn't need; engineers see their own jobs first; the office checks every finished job; failed checks suggest a job for the office to confirm):

- **One life for every job:** request → triage → prioritised → quote required → quote received → approval → scheduled → assigned → in progress → completed → quality check → invoice → closed. Every job shows the same strip; a stage it doesn't need is skipped with the reason (no quote for in-house work, no approval under the limit, no invoice for in-house, warranty or no-cost work), and a stage the work went past is marked not needed. The job pop-up shows the strip (tap for every stage), **Next** with its buttons, and a **Timeline** of everything that happened (events, comments, supplier sign-off). Rules: `features/operations/lifecycle.js` (`jobStages`, `lifecycleEvents`, `jobTimeline`); screens: `features/operations/JobLifecycle.jsx` (`LifecycleStrip`, `JobNext`, `JobTimeline`, `StageChip`), used by `tabs/WorksTab.jsx`. The 30.3 steps (quote → approval → PO → work done → invoice) are inside it; Raise a PO is offered once the job can go ahead.
  - **Triage:** jobs raised by engineers, QR codes or older requests wait in **To triage**; the office (coordinators and up) accepts them with a priority and whether a quote is needed (no quote = go ahead, status Approved), or rejects them. Jobs the office raises are accepted straight away.
  - **Booked for** (`scheduledFor`) and **Assigned to** a person (`assignee`) as well as a supplier; engineers get **Take this job** on unassigned jobs; booking and assigning can be skipped (Start work / Mark completed straight away).
  - **Quality check:** jobs finished from round 31 (`lc: 2`) wait in **To check** until the office passes them (who, when, a note) or sends them back with what still needs doing. Older finished jobs show "before checks began".
  - **Invoice:** supplier jobs wait in **To invoice** (finance and FM managers) until an invoice is recorded against the job or its PO, or they say **No invoice needed**.
  - **Lists:** My jobs, To triage, To check, To invoice filters; each card shows its stage; engineers see their own jobs first. **Closed** filter renamed **Finished** (completed or rejected) because "closed" is now the last stage. Home: the engineer's My jobs shows each job's stage and booking; the office gets "New job to accept" and "Finished — check the work" alerts.
  - **Needs a job:** failed visit checklist items, failed field inspections, failed check-log ticks, outlets whose latest water temperature is out of range, failed equipment inspections and open safety actions (last 90 days) are listed for the office under Reactive works → **Needs a job**: **Raise a job** (form filled in; the job carries `fromCheck`, a safety action gets `workId`) or **No job needed** with the reason (`org:followups`). Failed visit checks no longer create jobs on their own. `features/operations/suggestions.js`, `NeedsAJob.jsx`.
  - **Database:** only the office may set `triagedAt`/`triagedBy`/`checkedAt`/`checkedBy`/`checkNote`; only finance and FM managers and up may set `invoiceNeeded`; `org:followups` is written by coordinators and up (`ppm_list_guard`, `ppm_write_roles`; app copy `lifecycleRefusal` in `app/permissions.js`). QR-reported jobs carry `lc: 2`.
  - **Code:** the job rules (approval, lifecycle follow-ons, timeline events, refusals) moved out of MainApp into `features/operations/useWorks.js`.
- **Engineer field mode:** scanning an asset (in-app scanner, or its QR link for engineers and anyone on a touch screen) opens one screen with big buttons: **Start visit**, **Log inspection** (All OK / Needs attention / Not working, with a note and photo; can mark the asset's status), **Report a problem**, **Photo** (with a caption), **Meter reading**. The asset record has a **Field card** button. `features/operations/FieldCard.jsx`, `usePlanned.js`.
  - **Visits on one page:** a visit started at the asset is timed; it's kept for the person (`me:visit`) until finished, with a "Visit in progress — continue" bar; Finish needs the technician's signature and records `startedAt`, `finishedAt`, `arrived`, `left`, `minutesOnSite`, more photos (`photos`) and the sign-off. Quick log can also record arrived/left times and more photos.

**Round 30.4 changes** (the review's two decisions — no Phase 2 work):

- **Engineers see no prices (decision d-eng-money):** for the engineer role, every amount shows as a dash and the money parts of each screen are left out — quotes, final costs, labour and materials prices, visit costs, budgets, spend, contract values, rates, POs and invoices, on screen, in search, notifications, CSV/Excel exports (money columns dropped) and printouts (amounts masked). Engineers don't type money either: no quote, cost, unit cost or PO fields; the office adds them.
  - `ACTIVE_HIDE_MONEY` (lib/globals.js) is set from `seesMoney(role)` (app/permissions.js); `gbp()` returns "—"; `maskMoney()` masks amounts in free text (job comments, activity); `withoutMoneyColumns()` / `MONEY_HEADER` (lib/utils.js) drop money columns from `downloadCsv`, `buildStyledSheet` and `tableHtml`; `openPrintReport` masks the whole printout.
  - The database enforces it: an engineer's new jobs, visits and spare parts leave `quoteAmount`, `finalCost`, `quotes`, `lines`, `approvedAmount` / `cost`, `costBreakdown` / `unitCost` empty, and an engineer can't change them (`ppm_list_guard`; app copy `MONEY_FIELDS` / `moneyRefusal`). Engineers still use spare parts on jobs and mark planned visits skipped.
  - Visits an engineer logs are marked `costPending`; Visit history has a **Cost to add** filter for the office. New jobs with no quote start as **Requested**.
  - Limit: the amounts are still in the data the app downloads to an engineer's device (hidden, not removed); per-field security comes with proper tables in Phases 2–3.
- **Jobs on a room or building (decision d-job-no-asset):** Raise a job has **No particular asset — the room or building itself**; choose the building (and floor / room). The job has no asset (`deviceId` empty) and stores `locationId`, `buildingId`, `floorId`, `spaceId` and a `placeName`; the supplier is left empty and assigned on the job later. Locations has **Raise a job here** on every building, floor and room page and lists the jobs on each; jobs, search, alerts, reports, the supplier job link and budgets (counted under Maintenance) all handle them. Helpers: `isPlaceJob`, `jobSite`, `jobWhat` (features/assets/places.js).
- **Smaller:** refusal reasons now show on screen for quote approval too; a read-only role opening a supplier gets its scorecard instead of an edit form.

**Round 30.3 changes** (fixes from the Phase 1 review — no Phase 2 work):

- **Buildings, floors and rooms everywhere (AST-01, AST-03, AST-07):** asset, meter and isolation point forms have a building → floor → room picker, floor plans record their building and floor, and Raise a job can narrow its asset list by place. Locations has **Add an asset here** and **Move assets here** on every building, floor and room. A floor typed for a room becomes one of its building's floors, and Rooms & spaces groups rooms by building, then floor. Assets, meters and isolation points can sit straight in a building or on a floor (`buildingId`, `floorId`) as well as in a room (`spaceId`).
- **Figures match their lists (HOM-06, OPS-05):** Overdue, Due ≤30d and Open quotes open exactly the list they count; "Due this month" has one meaning everywhere (`isDueThisMonth` in `lib/utils.js`); Reactive works has an **Open quotes** filter and counts on every filter; Visit history is newest first with a filter per year and Show all.
- **A job's steps (OPS-03):** quote → approval → purchase order → work done → invoice, with the next step and its button. A PO can't be raised while an over-limit quote waits for approval, and an invoice recorded from a job is linked to the job's PO.
- **Booking emails (OPS-04):** Book from the Schedule, and **Write the booking email** opens your email app with it written out (Service Book doesn't send email itself — see GOING-LIVE.md).
- **Tablets and phones (HOM-04, RES-01, CS-04, OPS-06):** pop-ups size themselves to the part of the screen above the on-screen keyboard and are centred on tablets; button labels no longer break in the middle of a word; CSV exports are real downloads (they did nothing on iPad); **Report incident** opens the form straight away; the top-bar search becomes a magnifier when space is tight.
- **Smaller fixes:** shutdown type "Other" asks what it is; imports refuse impossible dates (31/02); using a part on a job checks the quantity and stock and ignores a double tap; when something is refused, the message now shows the reason (`tellUser` in `MainApp.jsx` — not written to the activity log) and long messages wrap on phones; the labour and materials boxes on a job wrap on phones.
- **Decision applied — hide other areas:** engineers, finance and senior management only see their own areas, in the menu, search and notifications (`otherAreasFor` / `canSeeArea` in `app/navigation.js`). Links into a hidden area go to Home.

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
- **Every area for every role:** each role sees its own areas first, then the rest under **Other areas** in the sidebar and the phone menu. *(Changed in 30.3 after review: engineers, finance and senior management no longer get Other areas.)*
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
| **Operations** | Planned maintenance, Reactive works (with job stages, Needs a job, To triage / To check / To invoice), Schedule, Projects, Visit history, Logs & checks, Walk-rounds, Shutdowns; field card after a scan | `tabs/ServicesTab.jsx`, `WorksTab.jsx`, `ScheduleTab.jsx`, `CompletedTab.jsx`, `SafetyViews.LogsView`, `MoreViews`, `features/operations/*` |
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

- **Storage:** one JSON list per company per kind of record, in `kv_store` (key `org:<name>`), 50 lists in all.
- **New in round 30:**
  - `org:buildings`: buildings with their floors.
  - Rooms (`org:spaces`) gain `buildingId` and `floorId`.
  - Assets (`org:devices`) gain `spaceId` and an optional `statusOverride`.
  - Round 30.3: assets, meters (`org:meters`) and isolation points (`org:isolations`) can also carry `buildingId` / `floorId`; floor plans (`org:floorplans`) carry `buildingId` / `floorId`; shutdowns carry `typeOther`.
  - Round 30.4: a job (`org:works`) may have no `deviceId`, with `locationId` + `buildingId` / `floorId` / `spaceId` + `placeName` instead; visits (`org:services`) may carry `costPending: true` (logged by an engineer, cost to be added by the office).
  - Round 31.1: jobs gain `lc` (2 = raised or finished under the Phase 2 lifecycle), `triagedAt`/`triagedBy`, `quoteNeeded`, `quotedAt`, `scheduledFor`, `startedAt`, `checkedAt`/`checkedBy`/`checkNote`, `invoiceNeeded`, `fromCheck` and `events` (the timeline); new list `org:followups` (suggestions the office said need no job); safety actions may carry `workId`; asset notes (`notesLog`) may be inspections (`kind: "inspection"`, `result`) or photos (`kind: "photo"`); visits may carry `startedAt`, `finishedAt`, `minutesOnSite` and `photos`; meter readings may carry `fromDeviceId`.
  - Personal `me:notif` holds which notifications you've read or marked done; `me:visit` holds the visit you have in progress.
- **Links:** an asset is in a room either through `spaceId` or because its Area text matches the room's name. **Assets → Locations → Organise into rooms** creates the rooms from Areas in one go.
- **Roles:** the database decides who may change each list (`ppm_write_roles`), with a field-by-field rule for settings (`ppm_settings_check`). Saved rows can't be moved between lists, scopes or companies (`ppm_kv_freeze`).

## Technical debt still to pay

- **MainApp.jsx** still holds most state and save handlers (about 3,200 lines). Phase 2 started moving them out: the job rules are in `features/operations/useWorks.js` and the field actions in `usePlanned.js`; the visit schedule and budget rules (`saveService`) are next, with the move to tables.
- **Older screens** (`tabs/`) use inline styles and the render-time `ACTIVE_CAN_EDIT` flag. New screens use the design system, but the old ones move across area by area.
- **Storage:** one JSON blob per list means the database can enforce rules per list, not per record. For example, an engineer may change the asset list because logging a visit updates it. Real tables with foreign keys come in phases 2–3.
- **Duplication:** the old statutory card on the Site desk overlaps the compliance register. It is kept for now and will be retired once the register has been in use for a while.
