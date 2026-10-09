# Service Book — facilities management operating system

Run your entire facility from one place. Maintenance, compliance, contractors, assets, finance, safety and people, all connected.

The app is organised into nine areas:

- **Home:** what needs attention, today, site health, money, coming next. There is a different version for each role.
- **Operations:** planned maintenance, reactive works, schedule, projects, visit history, checks, walk-rounds and shutdowns.
- **Assets:** portfolio → site → building → floor → room → asset, the asset register, meters, floor plans and isolations.
- **People:** on site and visitors, suppliers and contractors, team and contacts, feedback and car park.
- **Compliance & Safety:** the compliance register, incidents, actions, permits, water, fire drills, equipment inspections, asbestos, COSHH, audits and training.
- **Commercial:** overview and approvals, budget, POs and invoices, and contracts.
- **Resources:** spares, keys, documents, key dates and waste.
- **Reports:** the monthly FM report, every other report, and site health.
- **More:** settings, team and access, backups and help.

## How it's deployed

Vercel builds this repo automatically on every commit (Vite).

- **Data:** stored in Supabase, using the keys set in Vercel → Settings → Environment Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Access:** everyone signs in. Each company's data is visible only to its members, and each role can change only the lists it works with. The rules are in `supabase-setup.sql` and the database enforces them.
- **Setup:** first-time setup, and upgrading from round 29, are in **GOING-LIVE.md**.
- **Without the keys:** the app keeps everything in the browser, and the top bar says **This device only**.
- **Review copies (Vercel Preview):** a preview only connects to a database marked as a test one (`VITE_TEST_DATABASE=yes` for that branch). Otherwise it shows a locked screen, so a preview can never touch live data. Production is not affected.

## Where things live

    main.jsx               starts the app
    App.jsx                QR / link pages, then sign-in (cloud), then the app
    MainApp.jsx            loads and saves the data, works out alerts, and connects the areas to their screens
    app/                   AppShell (sidebar, top bar, phone bottom bar), navigation (areas, sections, old links),
                           permissions (roles — the same rules the database enforces)
    features/              the new, connected screens:
      home/                  command-centre Home (manager, engineer, finance, senior management)
      health/                site health score — the maths and the explanations
      assets/                buildings/floors/rooms (places.js), Locations, Asset register, asset summary
      compliance/            the compliance register (red/amber/green) and its page
      commercial/            overview & approvals, contracts
      people/                on site & visitors, team & contacts
      notifications/         notification centre (critical / action / reminder / info; read, snooze, done)
      search/                global search with "connected" results
      reports/               monthly FM report, reports page, site health page
      more/                  settings & admin menu
    components/            design system (ds.jsx), shared form fields (ui.jsx), sign-in & team (CloudGate.jsx), QR pages
    tabs/                  the original screens, now shown inside the areas (Services, Works, Budget, Safety…)
    modals/                pop-up windows
    lib/                   constants, helpers, reports and exports; publicApi.js = what QR pages may read and save
                           brand.js = hook for company logo and colour palette (not switched on yet)
    storage-shim.js        saves data: browser only, or Supabase with logins, company data and private photo storage;
                           merges simultaneous edits, queues changes made offline, refuses changes your role can't make
    supabase-setup.sql     database setup: companies, roles and their write rules, photo storage, QR page functions
    public/                app icons and offline support

Also read **FEATURE-MAP.md** (what exists and where it went), **ROADMAP.md** (phases 2–7) and **DESIGN-SYSTEM.md**.

## Updating

Upload the whole pack (Add file → Upload files, dragging the folders in so they keep their structure), then commit.
If `supabase-setup.sql` changed, run it again in Supabase first. It's safe to run more than once.
