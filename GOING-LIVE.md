# Going live with logins — round 30.2

> **Phase 1 is in review.** Review it on a separate test copy first: the Phase 1 review checklist has the steps. Only follow this guide for your live app once Phase 1 is approved.

## Already live on round 29? Upgrade in 5 minutes

1. **Download a backup.** In the app you use now, go to 🕘 → **Backup & storage** → **Download backup**.
2. **Run the new `supabase-setup.sql`.** In Supabase, go to SQL Editor → New query, paste the whole file and press **Run**. It adds the new roles and their rules. Anyone who was an **Editor** becomes an **FM manager**, so nobody loses access. It's safe to run more than once.
3. **Upload the full pack to GitHub** and commit. Keep the folders: there are new ones, `app/` and `features/`.
4. **Set people's roles.** Go to More → Team & access and give each person the role that fits (see "Roles" below).
5. **Choose who approves quotes.** In the same list, tick **Approves quotes** for each person who may approve quotes over your approval limit. Finance always can and the owner starts with it; nobody else can until you tick them.

The old app keeps working between steps 2 and 3, so there's no rush.

---

## First time: about 20 minutes, done once

Do Steps 2–4 one straight after the other: between Step 2 and Step 4 the app shows no data.

## What changes

- **Everyone signs in** with their own email and password.
- **Your data belongs to your company.** Only people you invite can see it. Each person has a role (see "Roles" below). The database enforces these roles; the app doesn't just hide buttons.
- **Photos, certificates and signatures move into private file storage.** They show only to signed-in members of your company.
- **The pages people open without logging in keep working:** QR stickers, supplier job links, the contractor sign-in poster, meter labels, check-sheet posters and the feedback survey. Each page can only read and add what it needs.
- **Your existing data moves into your company** when you run one line in Supabase. The app shows you the line, already filled in with your email. Only someone who can log in to your Supabase project can run it, so nobody else can claim your data.

## Before you start

1. In the app you use today, download a backup. It's under the clock icon (🕘 → **Backup & storage**) in older versions, and More → **Backup & restore** in this one. Keep the file safe.
2. Note your app's address, for example `https://ppm-xxxx.vercel.app`.

## Step 1 — Supabase settings (5 minutes)

Do these in your Supabase project, the same one the app already uses:

1. Go to **Authentication → URL Configuration**:
   - Set **Site URL** to your app's address.
   - Add the same address under **Redirect URLs**.
2. Go to **Authentication → Sign In / Providers → Email** and leave **Confirm email** on.
3. **Set up email sending.** Supabase's built-in email only reaches people in your Supabase account team, and only about 2 emails an hour. So before you invite colleagues:
   - Go to **Authentication → Emails → SMTP Settings** and turn on custom SMTP.
   - Enter the server details from an email provider. Brevo and Resend both have free plans, or ask your IT team for the company's SMTP details.
   - *For a quick trial with one or two people only,* you can instead turn **Confirm email** off. Nobody then has to prove they own their email address, so anyone who got hold of an invite link could use it. Only send links directly to the person, and turn **Confirm email** back on once email sending is set up.
4. Recommended: **Organization settings → Billing → Pro plan** (about $25 a month). It gives you daily backups, and your project is never paused for being unused.

## Step 2 — Run the database setup (2 minutes)

1. In Supabase, go to **SQL Editor → New query**.
2. Open `supabase-setup.sql` from this pack, copy all of it, paste it in and press **Run**.
3. You should see "Success. No rows returned". It's safe to run again.

From now on the old version of the app can't read the data. That's what locks it down, so go straight on to Steps 3 and 4.

## Step 3 — Upload the app (2 minutes)

1. Go to your repo on GitHub → **Add file → Upload files**.
2. Drag in everything from the pack, keeping the folders.
3. Press **Commit**. Vercel redeploys in about a minute.

`storage-adapter.js` isn't used any more. You can delete it from GitHub, or leave it.

## Step 4 — Create your account and company, and bring your data in (5 minutes)

1. Open the app and tap **Create an account**. Use your work email and a password of at least 8 characters.
2. Open the confirmation email. The app says who you're signed in as; tap **Continue**.
3. **Create company**, for example "Bedfont Lakes FM".
4. The app shows **Bring in your existing data** with one line, like `select ppm_claim_old_data('you@yourcompany.com');`.
   - Tap **Copy**.
   - In Supabase, go to **SQL Editor → New query**, paste the line and press **Run**. It answers "Moved 48 lists into Bedfont Lakes FM…".
   - Back in the app, tap **I've run it — continue**.
5. Tap **Set up profile** → tap your name. Your login is now linked to that profile on every device.
6. Choose your site.
7. Check that your services, visits, works and budget are all there. In the first minute, photos are moved into file storage in the background.

If you skipped the data step, the same line is waiting in More → **Team & access**.

## Step 5 — Invite your team

1. Go to More → **Team & access** → **Invite someone**.
2. Enter their email, pick a role and tap **Create invite link**.
3. Tap **Open email** to send it. Or tap **Copy link** and send the link yourself.
4. They open the link and create an account with that same email. The app asks them "Join … as …?", they tap **Join**, and they're in. The first time, they tap their name under Profile (or add it).

To change someone's role or remove them, use **Team & access**. Removing someone takes effect straight away.

## Roles

| Role | Can change | Typical person |
|---|---|---|
| **Owner** | Everything, including the team. Set when the company is created, and can't be changed. | You |
| **System administrator** | Everything, including the team and settings | IT or a second FM lead |
| **FM manager** | All data: operations, assets, suppliers, compliance and money | Facilities manager |
| **Facilities coordinator** | Jobs, maintenance, schedules, suppliers, visitors, safety records, buildings and rooms, and settings other than money. Can't change budgets, POs or invoices. | Helpdesk or coordinator |
| **Engineer** | Working on the assets that exist: logging visits and inspections, out-of-service and status, notes, run hours and bookings. Also jobs (but not approving quotes), meter and water readings, checks, incidents, actions, permits, spares, sign-ins and handover notes. Can't add, delete or restructure assets. | In-house engineer |
| **Finance** | Budgets, POs, invoices and savings, and always approves quotes over the limit. Can't change maintenance, assets or suppliers. | Finance / accounts |
| **Senior management** | Nothing (read-only). Home shows every site's health side by side. | Director |
| **Viewer** | Nothing (read-only) | Anyone who just needs to look |

Things to know about roles:

- **Approving quotes is a separate permission.** Quotes over the approval limit (set on Reactive works) can only be approved by finance, or by someone an admin has ticked as **Approves quotes** in Team & access. The owner starts with it. Editing a job never approves it, and the database checks this:
  - A quote over the limit can't be marked approved, started or finished without approval.
  - A quote raised after approval goes back for approval, and so does a job moved to another supplier or asset.
  - Only someone with the permission can change the approval limit.
  - A new role starts without the permission. The database applies a change straight away; the person's screens update the next time they open or refresh the app.
- **Assets are shaped by managers.** Owners, admins, FM managers and coordinators add, delete and restructure assets. Engineers work on the ones that exist.
- **Each person gets their own version of the app.** Home and the menu change with the role. For example, an engineer gets big Scan / Log / Report buttons, and finance gets the approval queue.
- **The database decides per list.** An engineer can't change a budget even by calling the database directly. Within a list it can't tell one record from another, so an engineer who may log visits may also edit other visits. Per-record rules come with the move to proper tables (see ROADMAP.md).
- **Contractors don't need a login.** Send them their job link: People → Suppliers & contractors → **Send a job link**. They only ever see their own jobs.

## Questions

- **QR stickers we've already printed?** They keep working for your company (the one you moved the old data into). New stickers also include your company's id.
- **Contractors signing out?** They sign out on the phone they signed in with. From another phone, they enter the mobile number they gave. People signed in by reception are signed out by reception, in the app.
- **Supplier job links?** They keep working.
- **Other phones and computers?** They now show the sign-in page.
- **Data that was only saved in one browser?** Sign in on that browser, then go to More → **Team & access** → **Copy into the company**. Nothing that's already there is lost.
- **Forgot password?** Use **Forgot password?** on the sign-in page. It needs email sending to be set up (Step 1).
- **Backups?** The Pro plan backs up daily. The **Download backup** file still works and now includes the photos.

## If something goes wrong

- **"The database isn't set up for logins yet"** → run `supabase-setup.sql` (Step 2).
- **"The confirmation email couldn't be sent"** → set up email sending (Step 1, point 3).
- **Your data isn't in your company** → run the line from Step 4 (it's also in More → **Team & access**). If it still isn't there, go to More → **Backup & restore** → **Choose backup file** and pick the backup from "Before you start".
- **The confirmation email never arrived** → check the junk folder. You can see every account in Supabase under **Authentication → Users**.

## For whoever maintains it

- `kv_store` has an `org_id` column. The `scope` column is `shared` for company data and `user:<id>` for one person's settings.
- Every table has row-level security. Companies, members and invites only change through the `ppm_*` functions.
- Saves are conditional on a `version` number that a trigger bumps. If someone else saved in between, the app re-reads, merges record by record and tries again.
- `ppm_claim_old_data(email)` can only be run from the SQL Editor. QR links without `?o=` are only looked up in the company that claimed the old data.
- The QR pages use only `ppm_public_read` and `ppm_public_write`. The helper functions sit in the `ppm_private` schema, which isn't reachable through the API.
- Inside two lists the database also checks single records (`ppm_list_guard`): engineers can't add, delete or restructure assets, and quote approvals follow the rules above (`ppm_can_approve`, `ppm_set_approver`). Settings can't be deleted, and amounts must be in pounds and pence.
- Who may change each list is decided by `ppm_write_roles(key)`, which the access rules use through `ppm_can_write(org, key)`. For settings, the `ppm_settings_check` trigger also checks each field. `ppm_kv_freeze` stops anyone signed in from moving a saved row to another list, scope or company. The app keeps the same rules in `app/permissions.js` so it can hide what you can't do. Keep the two in step.
- Photos are stored in the private bucket `ppm-media` at `<company id>/<sha256>.<ext>`. The data holds `ppm-media:<path>`, and the app shows each photo through a signed link that lasts 7 days.
