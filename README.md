# PPM Service Book

Planned maintenance, works, suppliers, budgets and site safety records for facilities teams.

## How it's deployed
Vercel builds this repo automatically on every commit (Vite). Data is stored in Supabase
(table `kv_store`) using the keys set in Vercel → Settings → Environment Variables:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Where things live
    main.jsx               starts the app
    storage-shim.js        saves data to Supabase (kv_store) — merges simultaneous edits, works offline
    App.jsx / MainApp.jsx  entry point; data loading, alerts and layout
    components/            shared form fields, buttons, QR request page, sign-in screen
    lib/                   constants, helpers, reports and exports
    tabs/                  one file per tab (Home, Services, Schedule, Works, Suppliers, Budget, Site…)
    modals/                pop-up windows
    public/                app icons and offline support

`storage-adapter.js` is the original storage file; it is no longer used and can be deleted.

## Updating
Replace only the files that changed (Add file → Upload files), keeping the same folders.
