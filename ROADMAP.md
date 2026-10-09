# Roadmap — from service book to facilities management OS

**Phase 1 (foundation) is in round 30:**

- Nine areas, with role-based navigation
- Command-centre Home in four versions
- Explainable site health score
- Portfolio → site → building → floor → room → asset
- Asset register with statuses
- Compliance register
- Eight roles enforced by the database
- Design system
- Global search
- Notification centre
- Live / offline / this-device state
- Monthly FM report

Each later phase is small enough to ship and test on its own, keeping the app working throughout.

> **Phase 1 is under review.** No Phase 2 work starts until it is approved.
> The product name stays **Service Book** for now, and the commercial name will be decided later. It's one line: `PRODUCT_NAME` in `lib/constants.js`.

## Later — Company branding

Upload a company logo and choose a colour palette, both admin only. The hooks are already in place (`lib/brand.js`, the `AppShell` `brand` prop and the theme tokens). See DESIGN-SYSTEM.md.

## Phase 2 — Operations

- **One work lifecycle.** Every job goes request → triage → prioritised → quote required → quote received → approval → scheduled → assigned → in progress → completed → quality check → invoice → closed. Each job shows its stage as a progress strip and keeps a full activity timeline. Safety actions and failed checks feed the same queue.
- **Engineer field mode.** Scan → action → done. The asset QR opens a one-screen card with Start visit, Log inspection, Report problem, Photo and Meter reading, using big buttons and minimal typing.
- **Visits.** A visit records start and finish times, a signature, and its evidence on one page.
- **Code.** Move Operations state out of MainApp into `features/operations/useWorks()` and `usePlanned()`.
- **Database.** Real `works`, `work_events` and `visits` tables with foreign keys to assets, so access can be enforced per record. For example, an engineer could be limited to assigned jobs only.

## Phase 3 — Assets

- **Register fields.** Full register fields, components under an asset, and warranty claims.
- **Documents.** Documents and drawings attached to an asset, room or building, with expiry dates.
- **Bulk tools.** Bulk QR sticker sheets per room or floor, and asset import with building, floor and room columns.
- **Database.** `sites`, `buildings`, `floors`, `rooms` and `assets` tables with foreign keys, migrated from the lists.

## Phase 4 — People & suppliers

- **Contractor portal.** Assigned jobs, site information, permit and RAMS requirements, evidence upload and sign-off, on the existing token links, with an optional contractor login later.
- **Supplier health.** A green/amber/red supplier scorecard from SLA, response time, rating, insurance and accreditations.
- **Visitors.** Host notifications (email) when a visitor signs in, and an emergency list printout per building.

## Phase 5 — Compliance & safety

- **Compliance engine.** A responsible person, evidence upload and an actions list per requirement, with custom requirements per site.
- **Safety actions.** Every safety action raises or links to a job in the work system.
- **Training matrix.** Training by role, showing who needs what.

## Phase 6 — Commercial

- **Money on every job.** Each job carries estimate → quote → approved value → PO → invoice → actual.
- **Approvals.** Approval chains by value, and finance sign-off recorded with the approver.
- **Filters.** Filter by building, asset, supplier, category, department, month and year.
- **Contracts.** Contract documents, renewals and price-rise letters.
- **Approval limits per person.** Each approver gets their own limit, building on the separate **Approves quotes** permission from Phase 1. Final cost above the approved amount is held for approval too; in Phase 1 the limit applies to the quote.


## Phase 7 — Intelligence

- **Automation rules,** run daily. Examples: "insurance expires in 30 days → notify FM manager", "PPM 7 days overdue → escalate", "inspection failed → corrective action".
- **Scheduled reports.** The monthly FM report emailed on the 1st.
- **Health over time.** Stored health snapshots so trends can be shown.
- **AI facilities manager.** Answers questions from the company's own data within the asker's permissions, and only takes actions after confirmation.

## Rule for every new feature

Does it help someone operate, maintain, protect, understand or financially manage a facility? If not, it doesn't go in.
