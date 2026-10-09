-- =====================================================================
--  PPM Service Book — Supabase database setup (secure, multi-company)
--  Round 30.2. Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to run again (it updates what's already there).
--
--  What it does
--   • Everyone signs in. Each company's data is visible only to its members.
--   • Roles: owner and admin (manage the team), FM manager (changes everything), coordinator (everything
--     except money), engineer (day-to-day work: visits, jobs, readings, checks, incidents), finance
--     (budgets, POs, invoices, quote approvals), senior management and viewer (read-only).
--     Which lists each role may change is decided here, by ppm_write_roles() — not by the app.
--   • Engineers work on the assets that exist: they can't add, delete or restructure them (ppm_list_guard).
--   • Approving quotes over the approval limit is a separate permission ("Approves quotes"): finance always,
--     anyone else only when an admin gives it to them. Editing jobs never gives it (ppm_can_approve, ppm_list_guard).
--   • Photos and certificates go to private file storage (bucket "ppm-media").
--   • QR pages (report a problem, engineer report, contractor sign-in, meter
--     readings, check sheets, feedback, supplier job links) still work without
--     a login, through narrow functions that only read or add what each page needs.
--   • Data saved before this update (the old open kv_store table) stays locked
--     until you move it into your company with one line (the app shows it to you):
--        select ppm_claim_old_data('you@yourcompany.com');
-- =====================================================================

-- ---------- companies, members, invites ----------
create table if not exists public.ppm_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- the company that took over the data saved before logins: QR stickers printed back then
-- (they don't say which company) are looked up in this company only
alter table public.ppm_orgs add column if not exists legacy boolean not null default false;

create table if not exists public.ppm_members (
  org_id uuid not null references public.ppm_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('owner', 'admin', 'manager', 'coordinator', 'engineer', 'finance', 'director', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists ppm_members_user on public.ppm_members (user_id);

create table if not exists public.ppm_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.ppm_orgs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'coordinator', 'engineer', 'finance', 'director', 'viewer')),
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

-- round 30: more roles. Anyone who was an "editor" becomes an FM manager (same rights as before).
alter table public.ppm_members drop constraint if exists ppm_members_role_check;
alter table public.ppm_invites drop constraint if exists ppm_invites_role_check;
update public.ppm_members set role = 'manager' where role = 'editor';
update public.ppm_invites set role = 'manager' where role = 'editor';
alter table public.ppm_members add constraint ppm_members_role_check check (role in ('owner', 'admin', 'manager', 'coordinator', 'engineer', 'finance', 'director', 'viewer'));
alter table public.ppm_invites add constraint ppm_invites_role_check check (role in ('admin', 'manager', 'coordinator', 'engineer', 'finance', 'director', 'viewer'));

-- round 30.2: approving quotes is its own permission. The company owner starts with it; finance always has it.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ppm_members' and column_name = 'can_approve') then
    alter table public.ppm_members add column can_approve boolean not null default false;
    update public.ppm_members set can_approve = true where role = 'owner';
  end if;
end $$;

-- ---------- the data table (same table the app already uses) ----------
create table if not exists public.kv_store (
  key text not null,
  scope text not null,          -- 'shared' = company data, 'user:<id>' = one person's own settings
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.kv_store add column if not exists org_id uuid;
alter table public.kv_store drop constraint if exists kv_store_pkey;
create unique index if not exists kv_store_org_key_scope on public.kv_store (org_id, key, scope);
alter table public.kv_store add column if not exists id bigint generated always as identity;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.kv_store'::regclass and contype = 'p') then
    alter table public.kv_store add constraint kv_store_id_pkey primary key (id);
  end if;
end $$;
-- the database stamps every change itself (time + a version number); the app saves "only if still version N",
-- so it can tell when someone else saved in between
alter table public.kv_store add column if not exists version bigint not null default 1;
create or replace function public.ppm_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.version := case when tg_op = 'UPDATE' then coalesce(old.version, 0) + 1 else 1 end;
  return new;
end $$;
drop trigger if exists kv_store_touch on public.kv_store;
create trigger kv_store_touch before insert or update on public.kv_store for each row execute function public.ppm_touch();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kv_store_org_fk') then
    alter table public.kv_store add constraint kv_store_org_fk foreign key (org_id) references public.ppm_orgs(id) on delete cascade;
  end if;
end $$;

-- ---------- who am I in this company? (used by the access rules) ----------
create or replace function public.ppm_role(p_org uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.ppm_members where org_id = p_org and user_id = auth.uid()
$$;
create or replace function public.ppm_is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.ppm_members where org_id = p_org and user_id = auth.uid())
$$;
create or replace function public.ppm_can_edit(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.ppm_members where org_id = p_org and user_id = auth.uid() and role in ('owner', 'admin', 'manager', 'coordinator', 'engineer', 'finance'))
$$;
-- Which roles may change each list. The app keeps a copy (app/permissions.js) only to hide what you can't do.
create or replace function public.ppm_write_roles(p_key text) returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select case
    -- everyone who works in the app: activity log, deleted items, profiles; jobs and the visit plan (finance approves quotes and plans spend);
    -- settings (each field has its own rule — see ppm_settings_check)
    when p_key in ('org:activity', 'org:trash', 'org:users', 'org:works', 'org:budgetLines', 'org:visitBudgets', 'org:settings')
      then array['owner', 'admin', 'manager', 'coordinator', 'engineer', 'finance']
    -- day-to-day work, engineers included
    when p_key in ('org:services', 'org:devices', 'org:deviceTasks', 'org:spares', 'org:logEntries', 'org:walkrounds', 'org:meterReadings', 'org:waterReadings',
                   'org:signins', 'org:visitSubmissions', 'org:reminders', 'org:notices', 'org:incidents', 'org:actions', 'org:permits')
      then array['owner', 'admin', 'manager', 'coordinator', 'engineer']
    -- registers, sites, buildings, rooms, suppliers and projects
    when p_key in ('org:projects', 'org:shutdowns', 'org:asbestos', 'org:coshh', 'org:equipment', 'org:audits', 'org:training', 'org:drills', 'org:waterOutlets',
                   'org:keys', 'org:waste', 'org:keyDates', 'org:carPark', 'org:feedback', 'org:isolations', 'org:meters', 'org:countries', 'org:locations',
                   'org:spaces', 'org:floorplans', 'org:buildings', 'org:suppliers')
      then array['owner', 'admin', 'manager', 'coordinator']
    -- money
    when p_key in ('org:budgets', 'org:purchaseOrders', 'org:invoices', 'org:costLines', 'org:savings')
      then array['owner', 'admin', 'manager', 'finance']
    else array['owner', 'admin', 'manager'] end
$$;
create or replace function public.ppm_can_approve(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.ppm_members where org_id = p_org and user_id = auth.uid()
                   and role not in ('director', 'viewer') and (role = 'finance' or can_approve))
$$;
create or replace function public.ppm_can_write(p_org uuid, p_key text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.ppm_members where org_id = p_org and user_id = auth.uid() and role = any (public.ppm_write_roles(p_key)))
$$;
create or replace function public.ppm_is_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.ppm_members where org_id = p_org and user_id = auth.uid() and role in ('owner', 'admin'))
$$;
-- storage folder names are text; compare as text so a bad folder name can't cause an error
create or replace function public.ppm_folder_member(p_folder text, p_edit boolean) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.ppm_members where org_id::text = p_folder and user_id = auth.uid()
                 and (not p_edit or role in ('owner', 'admin', 'manager', 'coordinator', 'engineer', 'finance')))
$$;

-- ---------- access rules ----------
alter table public.ppm_orgs enable row level security;
alter table public.ppm_members enable row level security;
alter table public.ppm_invites enable row level security;
alter table public.kv_store enable row level security;

do $$ declare p record; begin
  -- remove every old rule on these tables (including the old "allow all"), then add the new ones
  for p in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('kv_store', 'ppm_orgs', 'ppm_members', 'ppm_invites') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy ppm_orgs_read on public.ppm_orgs for select to authenticated using (public.ppm_is_member(id));
create policy ppm_members_read on public.ppm_members for select to authenticated using (public.ppm_is_member(org_id));
create policy ppm_invites_read on public.ppm_invites for select to authenticated using (public.ppm_is_admin(org_id));
-- (companies, members and invites are only changed through the functions below)

create policy ppm_kv_read on public.kv_store for select to authenticated
  using (org_id is not null and public.ppm_is_member(org_id) and (scope = 'shared' or scope = 'user:' || auth.uid()::text));
create policy ppm_kv_add on public.kv_store for insert to authenticated
  with check (org_id is not null and (
    (scope = 'shared' and public.ppm_can_write(org_id, key)) or
    (scope = 'user:' || auth.uid()::text and public.ppm_is_member(org_id))));
create policy ppm_kv_change on public.kv_store for update to authenticated
  using (org_id is not null and (
    (scope = 'shared' and public.ppm_can_write(org_id, key)) or
    (scope = 'user:' || auth.uid()::text and public.ppm_is_member(org_id))))
  with check (org_id is not null and (
    (scope = 'shared' and public.ppm_can_write(org_id, key)) or
    (scope = 'user:' || auth.uid()::text and public.ppm_is_member(org_id))));
create policy ppm_kv_remove on public.kv_store for delete to authenticated
  using (org_id is not null and (
    (scope = 'shared' and key <> 'org:settings' and public.ppm_can_write(org_id, key) and public.ppm_role(org_id) in ('owner', 'admin', 'manager')) or
    (scope = 'user:' || auth.uid()::text)));

revoke all on public.ppm_orgs, public.ppm_members, public.ppm_invites from anon;
revoke all on public.kv_store from anon;
revoke insert, update, delete on public.ppm_orgs, public.ppm_members, public.ppm_invites from authenticated;

-- ---------- company & team functions (called by the app when signed in) ----------
drop function if exists public.ppm_my_orgs();
create or replace function public.ppm_my_orgs()
returns table (org_id uuid, name text, role text, created_at timestamptz, can_approve boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.id, o.name, m.role, o.created_at, (m.role = 'finance' or (m.can_approve and m.role not in ('director', 'viewer')))
  from public.ppm_members m join public.ppm_orgs o on o.id = m.org_id
  where m.user_id = auth.uid()
  order by o.created_at
$$;

create or replace function public.ppm_create_org(p_name text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_org uuid;
begin
  if v_uid is null then raise exception 'Please sign in first.' using errcode = '28000'; end if;
  if coalesce(length(btrim(p_name)), 0) = 0 then raise exception 'Enter your company name.'; end if;
  if (select count(*) from public.ppm_orgs where created_by = v_uid) >= 10 then raise exception 'You have reached the limit of 10 companies.'; end if;
  insert into public.ppm_orgs (name, created_by) values (left(btrim(p_name), 120), v_uid) returning id into v_org;
  insert into public.ppm_members (org_id, user_id, email, role, can_approve) values (v_org, v_uid, lower(auth.jwt() ->> 'email'), 'owner', true);
  return v_org;
end $$;

-- Is there data from before logins still waiting to be moved into a company? (yes/no only)
create or replace function public.ppm_legacy_waiting() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.kv_store where org_id is null and scope = 'shared')
$$;

-- Run by you in the SQL Editor (not callable from the app or the internet):
--   select ppm_claim_old_data('you@yourcompany.com');
-- moves the data saved before logins into the company that email owns.
create or replace function public.ppm_claim_old_data(p_email text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_name text; v_n int := 0; r record; v_cur text; a jsonb; b jsonb; v_m jsonb;
begin
  select o.id, o.name into v_org, v_name from public.ppm_orgs o join public.ppm_members m on m.org_id = o.id
  where lower(m.email) = lower(btrim(p_email)) and m.role = 'owner' order by o.created_at limit 1;
  if v_org is null then raise exception 'No company owned by % yet — sign up in the app and create your company first.', p_email; end if;
  if exists (select 1 from public.ppm_orgs where legacy and id <> v_org) then raise exception 'The old data was already moved into another company.'; end if;
  for r in select key, value from public.kv_store where org_id is null and scope = 'shared' loop
    select value into v_cur from public.kv_store where org_id = v_org and key = r.key and scope = 'shared';
    if v_cur is null then
      update public.kv_store set org_id = v_org where org_id is null and scope = 'shared' and key = r.key;
    else
      -- the company already has this list (e.g. made while setting up): keep its records and add the old ones
      a := ppm_private.j(r.value); b := ppm_private.j(v_cur);
      if jsonb_typeof(a) = 'array' and jsonb_typeof(b) = 'array' then
        v_m := b || coalesce((select jsonb_agg(e) from jsonb_array_elements(a) e
                              where not exists (select 1 from jsonb_array_elements(b) x where x ->> 'id' = e ->> 'id')), '[]'::jsonb);
      elsif jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then v_m := a || b;
      else v_m := coalesce(b, a); end if;
      update public.kv_store set value = v_m::text where org_id = v_org and key = r.key and scope = 'shared';
      delete from public.kv_store where org_id is null and scope = 'shared' and key = r.key;
    end if;
    v_n := v_n + 1;
  end loop;
  update public.ppm_orgs set legacy = true where id = v_org;
  return format('Moved %s lists into %s. Go back to the app and tap Reload.', v_n, v_name);
end $$;

-- What an invite link is for, so the app can ask "Join … as …?" before accepting.
create or replace function public.ppm_invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('org', o.name, 'role', i.role, 'email', i.email, 'expired', i.expires_at < now(),
                            'member', exists (select 1 from public.ppm_members m where m.org_id = i.org_id and m.user_id = auth.uid()))
  from public.ppm_invites i join public.ppm_orgs o on o.id = i.org_id where i.token = btrim(coalesce(p_token, ''))
$$;

create or replace function public.ppm_rename_org(p_org uuid, p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ppm_is_admin(p_org) then raise exception 'Only an admin can rename the company.' using errcode = '42501'; end if;
  if coalesce(length(btrim(p_name)), 0) = 0 then raise exception 'Enter a name.'; end if;
  update public.ppm_orgs set name = left(btrim(p_name), 120) where id = p_org;
end $$;

create or replace function public.ppm_team(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_admin boolean := public.ppm_is_admin(p_org);
begin
  if not public.ppm_is_member(p_org) then raise exception 'Not a member of this company.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'email', email, 'role', role, 'since', created_at, 'me', user_id = auth.uid(),
                                                     'can_approve', role = 'finance' or (can_approve and role not in ('director', 'viewer')))
                                   order by array_position(array['owner', 'admin', 'manager', 'coordinator', 'engineer', 'finance', 'director', 'viewer'], role), email)
                         from public.ppm_members where org_id = p_org), '[]'::jsonb),
    'invites', case when v_admin then coalesce((select jsonb_agg(jsonb_build_object('id', id, 'email', email, 'role', role, 'token', token, 'expires_at', expires_at) order by created_at desc)
                                                from public.ppm_invites where org_id = p_org and expires_at > now()), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

create or replace function public.ppm_invite(p_org uuid, p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_token text; v_id uuid;
begin
  if not public.ppm_is_admin(p_org) then raise exception 'Only an admin can invite people.' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  if p_role = 'editor' then p_role := 'manager'; end if;  -- older app versions
  if p_role is null or p_role not in ('admin', 'manager', 'coordinator', 'engineer', 'finance', 'director', 'viewer') then raise exception 'Choose a role.'; end if;
  if exists (select 1 from public.ppm_members where org_id = p_org and lower(email) = v_email) then raise exception '% is already in the team.', v_email; end if;
  delete from public.ppm_invites where org_id = p_org and lower(email) = v_email;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.ppm_invites (org_id, email, role, token, invited_by) values (p_org, v_email, p_role, v_token, auth.uid()) returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

create or replace function public.ppm_cancel_invite(p_org uuid, p_invite uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ppm_is_admin(p_org) then raise exception 'Only an admin can cancel invites.' using errcode = '42501'; end if;
  delete from public.ppm_invites where id = p_invite and org_id = p_org;
end $$;

create or replace function public.ppm_accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_inv public.ppm_invites; v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Please sign in first.' using errcode = '28000'; end if;
  select * into v_inv from public.ppm_invites where token = btrim(coalesce(p_token, ''));
  if not found then raise exception 'This invite link isn''t valid any more — ask for a new one.'; end if;
  if v_inv.expires_at < now() then raise exception 'This invite link has expired — ask for a new one.'; end if;
  if lower(v_inv.email) <> v_email then raise exception 'This invite is for %. Sign in with that email address to accept it.', v_inv.email; end if;
  insert into public.ppm_members (org_id, user_id, email, role) values (v_inv.org_id, auth.uid(), v_email, v_inv.role)
  on conflict (org_id, user_id) do nothing;
  delete from public.ppm_invites where id = v_inv.id;
  return v_inv.org_id;
end $$;

create or replace function public.ppm_set_role(p_org uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cur text;
begin
  if not public.ppm_is_admin(p_org) then raise exception 'Only an admin can change roles.' using errcode = '42501'; end if;
  if p_role = 'editor' then p_role := 'manager'; end if;
  if p_role is null or p_role not in ('admin', 'manager', 'coordinator', 'engineer', 'finance', 'director', 'viewer') then raise exception 'Choose a role.'; end if;
  if p_user = auth.uid() then raise exception 'You can''t change your own role.'; end if;
  select role into v_cur from public.ppm_members where org_id = p_org and user_id = p_user;
  if v_cur is null then raise exception 'That person isn''t in the team.'; end if;
  if v_cur = 'owner' then raise exception 'The owner''s role can''t be changed.'; end if;
  -- a new role starts without "Approves quotes": it has to be given again on purpose
  update public.ppm_members set role = p_role, can_approve = case when role = p_role then can_approve else false end where org_id = p_org and user_id = p_user;
end $$;

-- Give or take away "Approves quotes". Admins only. Finance always approves; read-only roles never do.
create or replace function public.ppm_set_approver(p_org uuid, p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cur text;
begin
  if not public.ppm_is_admin(p_org) then raise exception 'Only an admin can change who approves quotes.' using errcode = '42501'; end if;
  select role into v_cur from public.ppm_members where org_id = p_org and user_id = p_user;
  if v_cur is null then raise exception 'That person isn''t in the team.'; end if;
  if coalesce(p_on, false) and v_cur in ('director', 'viewer') then raise exception 'Read-only roles can''t approve quotes. Give them a working role first.'; end if;
  if v_cur = 'finance' and not coalesce(p_on, false) then raise exception 'Finance always approves quotes. Change their role to take it away.'; end if;
  if v_cur = 'owner' and p_user <> auth.uid() then raise exception 'Only the owner can change the owner''s approval.'; end if;
  update public.ppm_members set can_approve = coalesce(p_on, false) where org_id = p_org and user_id = p_user;
end $$;

create or replace function public.ppm_remove_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cur text;
begin
  select role into v_cur from public.ppm_members where org_id = p_org and user_id = p_user;
  if v_cur is null then return; end if;
  if v_cur = 'owner' then raise exception 'The owner can''t be removed.'; end if;
  if p_user <> auth.uid() and not public.ppm_is_admin(p_org) then raise exception 'Only an admin can remove people.' using errcode = '42501'; end if;
  delete from public.ppm_members where org_id = p_org and user_id = p_user;
end $$;

-- ---------- private helpers for the QR pages (not callable from the app or the internet) ----------
create schema if not exists ppm_private;
revoke all on schema ppm_private from public;

create or replace function ppm_private.now_iso() returns text language sql stable as $$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
create or replace function ppm_private.today() returns text language sql stable as $$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD')
$$;
create or replace function ppm_private.new_id() returns text language sql volatile as $$
  select 'q' || to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
$$;
-- broken values never stop a QR page: they read as nothing
create or replace function ppm_private.j(p text) returns jsonb language plpgsql immutable as $$
begin return p::jsonb; exception when others then return null; end $$;
create or replace function ppm_private.get(p_org uuid, p_key text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select ppm_private.j(value) from public.kv_store where org_id = p_org and key = p_key and scope = 'shared'
$$;
create or replace function ppm_private.arr(p_org uuid, p_key text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end from (select ppm_private.get(p_org, p_key) as v) x
$$;
create or replace function ppm_private.item(p_org uuid, p_key text, p_field text, p_val text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select e from jsonb_array_elements(ppm_private.arr(p_org, p_key)) e where e ->> p_field = p_val limit 1
$$;
-- Which company does this QR link belong to? Links printed with logins say so (?o=<company>); only that
-- company is searched. Older links without it are only looked up in the company that took over the data
-- from before logins — never across other companies.
create or replace function ppm_private.org_with(p_key text, p_field text, p_val text, p_org uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select k.org_id from public.kv_store k
  where k.key = p_key and k.scope = 'shared'
    and k.org_id = coalesce(p_org, (select id from public.ppm_orgs where legacy order by created_at limit 1))
    and left(k.value, 1) = '['
    and ppm_private.j(k.value) @> jsonb_build_array(jsonb_build_object(p_field, p_val))
  limit 1
$$;
-- Simple flood protection for the pages anyone can use: at most p_max saves per minute per link.
create table if not exists ppm_private.hits (k text primary key, since timestamptz not null, n int not null);
create or replace function ppm_private.throttle(p_k text, p_max int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  insert into ppm_private.hits as h (k, since, n) values (left(p_k, 200), now(), 1)
  on conflict (k) do update set n = case when h.since < now() - interval '1 minute' then 1 else h.n + 1 end,
                                since = case when h.since < now() - interval '1 minute' then now() else h.since end
  returning n into v_n;
  if v_n > p_max then raise exception 'Too many submissions from this code — please wait a minute and try again.'; end if;
  if random() < 0.01 then delete from ppm_private.hits where since < now() - interval '10 minutes'; end if;
end $$;
create or replace function ppm_private.hit_count(p_k text) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select n from ppm_private.hits where k = left(p_k, 200) and since >= now() - interval '1 minute'), 0)
$$;
create or replace function ppm_private.txt(p jsonb, p_key text, p_max int) returns text language sql immutable as $$
  select left(btrim(coalesce(p ->> p_key, '')), p_max)
$$;
create or replace function ppm_private.img(p text, p_max int) returns text language sql immutable as $$
  select case when p ~ '^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$' and length(p) <= p_max then p end
$$;
create or replace function ppm_private.imgs(p jsonb, p_n int, p_max int) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from (
    select e #>> '{}' as x, i from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality t(e, i)
    where ppm_private.img(e #>> '{}', p_max) is not null order by i limit p_n) y
$$;
-- add one record to the front of a list, keeping at most p_keep records
create or replace function ppm_private.prepend(p_org uuid, p_key text, p_rec jsonb, p_keep int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; v_len int;
begin
  perform 1 from public.kv_store where org_id = p_org and key = p_key and scope = 'shared' for update;
  select length(value) into v_len from public.kv_store where org_id = p_org and key = p_key and scope = 'shared';
  if coalesce(v_len, 0) > 25000000 then raise exception 'This list is full — please contact the site team directly.'; end if;
  if coalesce(v_len, 0) > 5000000 then   -- photos waiting to be moved into file storage: take the text, not more photos
    if p_rec ? 'photos' then p_rec := jsonb_set(p_rec, '{photos}', '[]'::jsonb); end if;
    p_rec := p_rec - 'photo';
  end if;
  v := jsonb_build_array(p_rec) || ppm_private.arr(p_org, p_key);
  if p_keep is not null and jsonb_array_length(v) > p_keep then
    v := (select jsonb_agg(e order by i) from jsonb_array_elements(v) with ordinality t(e, i) where i <= p_keep);
  end if;
  insert into public.kv_store (org_id, key, scope, value, updated_at) values (p_org, p_key, 'shared', v::text, now())
  on conflict (org_id, key, scope) do update set value = excluded.value, updated_at = now();
end $$;
create or replace function ppm_private.put(p_org uuid, p_key text, p_val jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.kv_store set value = p_val::text, updated_at = now() where org_id = p_org and key = p_key and scope = 'shared'
$$;
revoke all on all functions in schema ppm_private from public, anon, authenticated;

-- ---------- what the QR pages may read (no login) ----------
create or replace function public.ppm_public_read(p_kind text, p_ref text, p_org uuid default null, p_site text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_dev jsonb; v_loc jsonb; v_st jsonb; v_sup jsonb; v_works jsonb; v_meter jsonb; v_today text := ppm_private.today();
begin
  if p_ref is null or length(p_ref) = 0 or length(p_ref) > 120 then return null; end if;

  if p_kind = 'request' then                                   -- ?request=<service id>  (report a problem / engineer report)
    v_org := ppm_private.org_with('org:devices', 'id', p_ref, p_org);
    if v_org is null then return null; end if;
    v_dev := ppm_private.item(v_org, 'org:devices', 'id', p_ref);
    v_loc := ppm_private.item(v_org, 'org:locations', 'id', v_dev ->> 'locationId');
    v_st := ppm_private.get(v_org, 'org:settings');
    return jsonb_build_object(
      'org', v_org,
      'device', jsonb_build_object('id', v_dev -> 'id', 'name', v_dev -> 'name', 'locationId', v_dev -> 'locationId', 'area', v_dev -> 'area',
                                   'checklist', coalesce(v_dev -> 'checklist', '[]'::jsonb)),
      'location', case when v_loc is null then null else jsonb_build_object('id', v_loc -> 'id', 'name', v_loc -> 'name', 'phone', v_loc -> 'phone', 'requestCategories', v_loc -> 'requestCategories') end,
      'recent', coalesce((select jsonb_agg(jsonb_build_object('id', w -> 'id', 'description', w -> 'description', 'dateRaised', w -> 'dateRaised', 'status', w -> 'status') order by i)
                          from (select w, i from jsonb_array_elements(ppm_private.arr(v_org, 'org:works')) with ordinality t(w, i)
                                where w ->> 'deviceId' = p_ref and coalesce(w ->> 'status', '') not in ('completed', 'rejected') order by i limit 8) x), '[]'::jsonb),
      'onCall', (select jsonb_build_object('name', r -> 'name', 'phone', r -> 'phone')
                 from jsonb_array_elements(case when jsonb_typeof(v_st -> 'onCall' -> (v_dev ->> 'locationId')) = 'array' then v_st -> 'onCall' -> (v_dev ->> 'locationId') else '[]'::jsonb end) r
                 where coalesce(r ->> 'from', '') <= v_today and (coalesce(r ->> 'to', '') = '' or r ->> 'to' >= v_today) limit 1)
    );

  elsif p_kind = 'supplier' then                               -- ?supplier=<job link token>
    if length(p_ref) < 12 then return null; end if;
    v_org := ppm_private.org_with('org:suppliers', 'portalToken', p_ref, p_org);
    if v_org is null then return null; end if;
    v_sup := ppm_private.item(v_org, 'org:suppliers', 'portalToken', p_ref);
    v_st := ppm_private.get(v_org, 'org:settings');
    v_works := coalesce((select jsonb_agg(jsonb_build_object('id', w -> 'id', 'description', w -> 'description', 'deviceId', w -> 'deviceId', 'priority', w -> 'priority',
                                                       'dateRaised', w -> 'dateRaised', 'status', w -> 'status', 'supplierAck', w -> 'supplierAck', 'eta', w -> 'eta',
                                                       'attendedAt', w -> 'attendedAt', 'heldSince', w -> 'heldSince', 'heldDays', w -> 'heldDays', 'completedAt', w -> 'completedAt',
                                                       'supplierDone', case when w ? 'supplierDone' then (w -> 'supplierDone') - 'photos' - 'signature' end) order by i)
                         from jsonb_array_elements(ppm_private.arr(v_org, 'org:works')) with ordinality t(w, i)
                         where w ->> 'supplierId' = v_sup ->> 'id' and coalesce(w ->> 'status', '') not in ('completed', 'rejected')), '[]'::jsonb);
    return jsonb_build_object(
      'org', v_org,
      'supplier', jsonb_build_object('id', v_sup -> 'id', 'name', v_sup -> 'name'),
      'works', v_works,
      'devices', coalesce((select jsonb_agg(jsonb_build_object('id', d -> 'id', 'name', d -> 'name', 'area', d -> 'area', 'locationId', d -> 'locationId', 'accessNotes', d -> 'accessNotes', 'instructions', d -> 'instructions'))
                           from jsonb_array_elements(ppm_private.arr(v_org, 'org:devices')) d
                           where exists (select 1 from jsonb_array_elements(v_works) w where w ->> 'deviceId' = d ->> 'id')), '[]'::jsonb),
      'locations', coalesce((select jsonb_agg(jsonb_build_object('id', l -> 'id', 'name', l -> 'name')) from jsonb_array_elements(ppm_private.arr(v_org, 'org:locations')) l
                             where exists (select 1 from jsonb_array_elements(ppm_private.arr(v_org, 'org:devices')) d
                                           where d ->> 'locationId' = l ->> 'id' and exists (select 1 from jsonb_array_elements(v_works) w where w ->> 'deviceId' = d ->> 'id'))), '[]'::jsonb),
      'sla', jsonb_build_object('days', coalesce(v_st -> 'slaDays', '{}'::jsonb), 'workingDays', coalesce(v_st -> 'slaWorkingDays', 'false'::jsonb))
    );

  elsif p_kind = 'meter' then                                  -- ?meter=<meter id>
    v_org := ppm_private.org_with('org:meters', 'id', p_ref, p_org);
    if v_org is null then return null; end if;
    v_meter := ppm_private.item(v_org, 'org:meters', 'id', p_ref);
    v_loc := ppm_private.item(v_org, 'org:locations', 'id', v_meter ->> 'locationId');
    return jsonb_build_object(
      'org', v_org,
      'meter', jsonb_build_object('id', v_meter -> 'id', 'name', v_meter -> 'name', 'unit', v_meter -> 'unit', 'serial', v_meter -> 'serial', 'locationId', v_meter -> 'locationId'),
      'location', case when v_loc is null then null else jsonb_build_object('id', v_loc -> 'id', 'name', v_loc -> 'name') end,
      'last', (select jsonb_build_object('value', r -> 'value', 'date', r -> 'date') from jsonb_array_elements(ppm_private.arr(v_org, 'org:meterReadings')) r
               where r ->> 'meterId' = p_ref order by r ->> 'date' desc nulls last limit 1)
    );

  elsif p_kind in ('feedback', 'signin', 'check') then         -- ?feedback=<site> · ?signin=<site> · ?check=<log>&site=<site>
    v_org := ppm_private.org_with('org:locations', 'id', case when p_kind = 'check' then p_site else p_ref end, p_org);
    if v_org is null then return null; end if;
    v_loc := ppm_private.item(v_org, 'org:locations', 'id', case when p_kind = 'check' then p_site else p_ref end);
    if p_kind = 'feedback' then
      return jsonb_build_object('org', v_org, 'location', jsonb_build_object('id', v_loc -> 'id', 'name', v_loc -> 'name'));
    end if;
    v_st := ppm_private.get(v_org, 'org:settings');
    if p_kind = 'check' then
      return jsonb_build_object(
        'org', v_org,
        'location', jsonb_build_object('id', v_loc -> 'id', 'name', v_loc -> 'name'),
        'def', (select d from jsonb_array_elements(case when jsonb_typeof(v_st -> 'logDefs') = 'array' then v_st -> 'logDefs' else '[]'::jsonb end) d where d ->> 'id' = p_ref limit 1),
        'last', (select jsonb_build_object('at', e -> 'at', 'date', e -> 'date', 'by', e -> 'by') from jsonb_array_elements(ppm_private.arr(v_org, 'org:logEntries')) e
                 where e ->> 'logId' = p_ref and e ->> 'locationId' = p_site order by coalesce(e ->> 'at', e ->> 'date') desc nulls last limit 1)
      );
    end if;
    return jsonb_build_object(                                  -- signin
      'org', v_org,
      'location', jsonb_build_object('id', v_loc -> 'id', 'name', v_loc -> 'name', 'induction', v_loc -> 'induction', 'inductionUrl', v_loc -> 'inductionUrl'),
      'info', jsonb_build_object('access', v_st -> 'siteInfo' -> p_ref -> 'access', 'notes', v_st -> 'siteInfo' -> p_ref -> 'notes'),
      'suppliers', coalesce((select jsonb_agg(jsonb_build_object('id', s -> 'id', 'name', s -> 'name')) from jsonb_array_elements(ppm_private.arr(v_org, 'org:suppliers')) s where s ->> 'locationId' = p_ref), '[]'::jsonb),
      'onSite', coalesce((select jsonb_agg(jsonb_build_object('id', x -> 'id', 'name', x -> 'name', 'company', x -> 'company', 'kind', x -> 'kind',
                                                               'needsPhone', length(regexp_replace(coalesce(x ->> 'phone', ''), '\D', '', 'g')) >= 4,
                                                               'selfOut', coalesce(x ->> 'outKey', '') <> '') order by i)
                          from jsonb_array_elements(ppm_private.arr(v_org, 'org:signins')) with ordinality t(x, i)
                          where x ->> 'locationId' = p_ref and coalesce(x ->> 'outAt', '') = ''), '[]'::jsonb)
    );
  end if;
  return null;
end $$;

-- ---------- what the QR pages may add or change (no login) ----------
create or replace function public.ppm_public_write(p_kind text, p_ref text, p_data jsonb, p_org uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_dev jsonb; v_sup jsonb; v_rec jsonb; v_arr jsonb; v_id text := ppm_private.new_id(); v_now text := ppm_private.now_iso();
        v_name text; v_pr text; v_wid text; v_w jsonb; v_patch jsonb := '{}'::jsonb; v_comment text; v_done jsonb; v_num numeric; v_out jsonb;
begin
  if p_ref is null or length(p_ref) = 0 or length(p_ref) > 120 then raise exception 'Link not recognised.'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Nothing to save.'; end if;
  if length(p_data::text) > 3000000 then raise exception 'Too much data — please use fewer or smaller photos.'; end if;
  -- (sign-out has its own limit below, per person, so nobody can block a whole site's sign-out)
  if p_kind <> 'signout' then perform ppm_private.throttle(p_kind || ':' || p_ref, case when p_kind in ('signin', 'check', 'feedback') then 30 else 12 end); end if;
  v_name := ppm_private.txt(p_data, 'name', 80);

  if p_kind = 'request' then                                   -- report a problem
    v_org := ppm_private.org_with('org:devices', 'id', p_ref, p_org);
    if v_org is null then raise exception 'This QR code doesn''t match a service any more.'; end if;
    v_dev := ppm_private.item(v_org, 'org:devices', 'id', p_ref);
    if v_name = '' or ppm_private.txt(p_data, 'description', 2000) = '' then raise exception 'Please add your name and describe the problem.'; end if;
    if (select count(*) from jsonb_array_elements(ppm_private.arr(v_org, 'org:works')) w
        where w ->> 'deviceId' = p_ref and w ->> 'source' = 'request' and coalesce(w ->> 'status', '') = 'requested') >= 25 then
      raise exception 'There are already lots of open reports for this — please contact the site team directly.';
    end if;
    v_pr := case when p_data ->> 'priority' in ('low', 'medium', 'high') then p_data ->> 'priority' else 'medium' end;
    v_rec := jsonb_build_object('id', v_id, 'deviceId', p_ref, 'description', ppm_private.txt(p_data, 'description', 2000), 'quoteAmount', 0,
      'dateRaised', ppm_private.today(), 'status', 'requested', 'budgetType', 'budgeted',
      'photos', case when ppm_private.img(p_data ->> 'photo', 700000) is not null then jsonb_build_array(p_data ->> 'photo') else '[]'::jsonb end,
      'priority', v_pr, 'supplierId', v_dev -> 'supplierId', 'comments', '[]'::jsonb, 'source', 'request', 'requestedBy', v_name, 'loggedAt', v_now);
    if ppm_private.txt(p_data, 'email', 120) <> '' then v_rec := v_rec || jsonb_build_object('requesterEmail', ppm_private.txt(p_data, 'email', 120)); end if;
    perform ppm_private.prepend(v_org, 'org:works', v_rec, null);
    return jsonb_build_object('id', v_id);

  elsif p_kind = 'engineer' then                               -- engineer's visit report from the service QR
    v_org := ppm_private.org_with('org:devices', 'id', p_ref, p_org);
    if v_org is null then raise exception 'This QR code doesn''t match a service any more.'; end if;
    v_dev := ppm_private.item(v_org, 'org:devices', 'id', p_ref);
    if v_name = '' then raise exception 'Please enter your name.'; end if;
    v_rec := jsonb_build_object('id', v_id, 'deviceId', p_ref, 'locationId', v_dev -> 'locationId', 'name', v_name, 'company', ppm_private.txt(p_data, 'company', 120),
      'date', left(coalesce(p_data ->> 'date', ppm_private.today()), 10), 'arrived', ppm_private.txt(p_data, 'arrived', 5), 'left', ppm_private.txt(p_data, 'left', 5),
      'notes', ppm_private.txt(p_data, 'notes', 4000),
      'checks', coalesce((select jsonb_agg(jsonb_build_object('item', left(c ->> 'item', 300), 'result', left(c ->> 'result', 10), 'value', left(coalesce(c ->> 'value', ''), 40)))
                          from (select c from jsonb_array_elements(case when jsonb_typeof(p_data -> 'checks') = 'array' then p_data -> 'checks' else '[]'::jsonb end) c limit 100) x), '[]'::jsonb),
      'photos', ppm_private.imgs(p_data -> 'photos', 3, 700000), 'submittedAt', v_now);
    perform ppm_private.prepend(v_org, 'org:visitSubmissions', v_rec, 500);
    return jsonb_build_object('id', v_id);

  elsif p_kind = 'supplier' then                               -- supplier updates one of their jobs
    if length(p_ref) < 12 then raise exception 'Link not recognised.'; end if;
    v_org := ppm_private.org_with('org:suppliers', 'portalToken', p_ref, p_org);
    if v_org is null then raise exception 'This job link has expired or been replaced.'; end if;
    v_sup := ppm_private.item(v_org, 'org:suppliers', 'portalToken', p_ref);
    v_wid := p_data ->> 'workId';
    perform 1 from public.kv_store where org_id = v_org and key = 'org:works' and scope = 'shared' for update;
    v_w := ppm_private.item(v_org, 'org:works', 'id', v_wid);
    if v_w is null or v_w ->> 'supplierId' is distinct from v_sup ->> 'id' or coalesce(v_w ->> 'status', '') in ('completed', 'rejected') then
      raise exception 'This job isn''t open for you any more.';
    end if;
    if v_name = '' then raise exception 'Please enter your name first.'; end if;
    if p_data -> 'patch' ? 'supplierAck' then
      v_patch := v_patch || jsonb_build_object('supplierAck', jsonb_strip_nulls(jsonb_build_object('name', v_name, 'at', v_now,
        'declined', case when (p_data -> 'patch' -> 'supplierAck' ->> 'declined') = 'true' then true end,
        'reason', nullif(left(coalesce(p_data -> 'patch' -> 'supplierAck' ->> 'reason', ''), 500), ''))));
    end if;
    if p_data -> 'patch' ? 'eta' and (p_data -> 'patch' ->> 'eta') ~ '^\d{4}-\d{2}-\d{2}$' then v_patch := v_patch || jsonb_build_object('eta', p_data -> 'patch' ->> 'eta'); end if;
    if p_data -> 'patch' ? 'attendedAt' then v_patch := v_patch || jsonb_build_object('attendedAt', left(v_now, 16)); end if;
    if p_data -> 'patch' ? 'supplierDone' then
      v_done := jsonb_build_object('name', v_name, 'at', v_now, 'notes', left(coalesce(p_data -> 'patch' -> 'supplierDone' ->> 'notes', ''), 4000),
        'photos', ppm_private.imgs(p_data -> 'patch' -> 'supplierDone' -> 'photos', 3, 700000),
        'signature', ppm_private.img(p_data -> 'patch' -> 'supplierDone' ->> 'signature', 300000));
      v_patch := v_patch || jsonb_build_object('supplierDone', v_done,
        'photos', (select coalesce(jsonb_agg(p order by i), '[]'::jsonb) from jsonb_array_elements(coalesce(v_w -> 'photos', '[]'::jsonb) || (v_done -> 'photos')) with ordinality t(p, i) where i <= 8));
    end if;
    v_comment := left(coalesce(p_data ->> 'comment', ''), 1000);
    if v_comment <> '' and jsonb_array_length(coalesce(v_w -> 'comments', '[]'::jsonb)) >= 200 then v_comment := ''; end if;
    v_arr := (select jsonb_agg(case when w ->> 'id' = v_wid then
                 w || v_patch || case when v_comment <> '' then jsonb_build_object('comments', coalesce(w -> 'comments', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('text', v_comment, 'by', coalesce(v_sup ->> 'name', 'Supplier') || ' (supplier portal)', 'at', v_now))) else '{}'::jsonb end
               else w end order by i)
              from jsonb_array_elements(ppm_private.arr(v_org, 'org:works')) with ordinality t(w, i));
    perform ppm_private.put(v_org, 'org:works', v_arr);
    return jsonb_build_object('ok', true);

  elsif p_kind = 'meter' then                                  -- meter reading from the QR label
    v_org := ppm_private.org_with('org:meters', 'id', p_ref, p_org);
    if v_org is null then raise exception 'This QR code doesn''t match a meter any more.'; end if;
    begin v_num := (p_data ->> 'value')::numeric; exception when others then v_num := null; end;
    if v_name = '' or v_num is null then raise exception 'Please enter your name and the reading.'; end if;
    v_rec := jsonb_build_object('id', v_id, 'meterId', p_ref, 'date', ppm_private.today(), 'value', v_num, 'by', v_name || ' (QR)', 'at', v_now, 'viaQR', true);
    if ppm_private.img(p_data ->> 'photo', 700000) is not null then v_rec := v_rec || jsonb_build_object('photo', p_data ->> 'photo'); end if;
    if (p_data ->> 'reset') = 'true' then v_rec := v_rec || jsonb_build_object('reset', true); end if;
    perform ppm_private.prepend(v_org, 'org:meterReadings', v_rec, 20000);
    return jsonb_build_object('id', v_id);

  elsif p_kind = 'feedback' then                               -- occupant feedback
    v_org := ppm_private.org_with('org:locations', 'id', p_ref, p_org);
    if v_org is null then raise exception 'This feedback code isn''t linked to a site any more.'; end if;
    v_rec := jsonb_build_object('id', v_id, 'locationId', p_ref, 'area', ppm_private.txt(p_data, 'area', 120),
      'ratings', coalesce((select jsonb_object_agg(k, n) from (select left(k, 60) as k, (v #>> '{}')::int as n from jsonb_each(case when jsonb_typeof(p_data -> 'ratings') = 'object' then p_data -> 'ratings' else '{}'::jsonb end) e(k, v)
                           where (v #>> '{}') ~ '^[1-5]$' limit 12) r), '{}'::jsonb),
      'comment', ppm_private.txt(p_data, 'comment', 2000), 'at', v_now);
    perform ppm_private.prepend(v_org, 'org:feedback', v_rec, 5000);
    return jsonb_build_object('id', v_id);

  elsif p_kind = 'check' then                                  -- site check sheet from a QR poster (ref = log id)
    v_org := ppm_private.org_with('org:locations', 'id', p_data ->> 'locationId', p_org);
    if v_org is null then raise exception 'This QR code isn''t linked to a check sheet any more.'; end if;
    if not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(ppm_private.get(v_org, 'org:settings') -> 'logDefs') = 'array' then ppm_private.get(v_org, 'org:settings') -> 'logDefs' else '[]'::jsonb end) d where d ->> 'id' = p_ref) then
      raise exception 'This QR code isn''t linked to a check sheet any more.';
    end if;
    if v_name = '' then raise exception 'Please enter your name.'; end if;
    v_rec := jsonb_build_object('id', v_id, 'logId', p_ref, 'locationId', p_data ->> 'locationId', 'date', ppm_private.today(),
      'values', coalesce((select jsonb_object_agg(k, v) from (select left(k, 60) as k, case when jsonb_typeof(v) = 'string' then to_jsonb(left(v #>> '{}', 500)) when jsonb_typeof(v) in ('boolean', 'number') then v else 'null'::jsonb end as v
                          from jsonb_each(case when jsonb_typeof(p_data -> 'values') = 'object' then p_data -> 'values' else '{}'::jsonb end) e(k, v) limit 60) x), '{}'::jsonb),
      'by', v_name || ' (QR)', 'at', v_now, 'viaQR', true);
    perform ppm_private.prepend(v_org, 'org:logEntries', v_rec, 20000);
    return jsonb_build_object('id', v_id);

  elsif p_kind = 'signin' then                                 -- contractor / visitor signs in
    v_org := ppm_private.org_with('org:locations', 'id', p_ref, p_org);
    if v_org is null then raise exception 'This sign-in code isn''t linked to a site any more.'; end if;
    if v_name = '' then raise exception 'Please enter your name.'; end if;
    v_rec := jsonb_build_object('id', v_id, 'locationId', p_ref, 'kind', case when p_data ->> 'kind' = 'visitor' then 'visitor' else 'contractor' end,
      'name', v_name, 'company', ppm_private.txt(p_data, 'company', 120), 'phone', ppm_private.txt(p_data, 'phone', 40),
      'purpose', ppm_private.txt(p_data, 'purpose', 200), 'host', ppm_private.txt(p_data, 'host', 120),
      'inductedAt', v_now, 'ramsChecked', false, 'inAt', v_now, 'outAt', null, 'by', 'Self sign-in', 'selfService', true,
      'outKey', replace(gen_random_uuid()::text, '-', ''));
    if coalesce(p_data ->> 'kind', '') <> 'visitor' then v_rec := v_rec || jsonb_build_object('inducted', true); end if;
    perform ppm_private.prepend(v_org, 'org:signins', v_rec, 2000);
    return jsonb_build_object('id', v_id, 'outKey', v_rec ->> 'outKey');

  elsif p_kind = 'signout' then                                -- … and signs out (ref = site, data.id = their sign-in)
    v_org := ppm_private.org_with('org:locations', 'id', p_ref, p_org);
    if v_org is null then raise exception 'This sign-in code isn''t linked to a site any more.'; end if;
    perform 1 from public.kv_store where org_id = v_org and key = 'org:signins' and scope = 'shared' for update;
    v_out := (select x from jsonb_array_elements(ppm_private.arr(v_org, 'org:signins')) x where x ->> 'id' = p_data ->> 'id' and x ->> 'locationId' = p_ref and coalesce(x ->> 'outAt', '') = '' limit 1);
    if v_out is null then raise exception 'You''re already signed out.'; end if;
    -- Only the phone that signed in (it keeps a key — always works), or someone who knows the mobile number
    -- given at sign-in. Wrong numbers are counted per person (the error is returned, not raised, so the count
    -- is kept); after 6 in a minute the number route pauses for that person.
    if not (coalesce(v_out ->> 'outKey', '') <> '' and coalesce(p_data ->> 'outKey', '') = v_out ->> 'outKey') then
      if length(regexp_replace(coalesce(v_out ->> 'phone', ''), '\D', '', 'g')) < 4 then return jsonb_build_object('error', 'RECEPTION'); end if;
      if ppm_private.hit_count('signout-id:' || (v_out ->> 'id')) >= 6 then return jsonb_build_object('error', 'WAIT'); end if;
      if not (length(regexp_replace(coalesce(p_data ->> 'phone', ''), '\D', '', 'g')) >= 4
              and right(regexp_replace(coalesce(v_out ->> 'phone', ''), '\D', '', 'g'), 4) = right(regexp_replace(coalesce(p_data ->> 'phone', ''), '\D', '', 'g'), 4)) then
        perform ppm_private.throttle('signout-id:' || (v_out ->> 'id'), 1000000);
        return jsonb_build_object('error', 'NEEDPHONE');
      end if;
    end if;
    v_arr := (select jsonb_agg(case when x ->> 'id' = p_data ->> 'id' then x || jsonb_build_object('outAt', v_now, 'outBy', 'Self sign-out') else x end order by i)
              from jsonb_array_elements(ppm_private.arr(v_org, 'org:signins')) with ordinality t(x, i));
    perform ppm_private.put(v_org, 'org:signins', v_arr);
    return jsonb_build_object('name', v_out -> 'name');
  end if;
  raise exception 'Unknown page.';
end $$;

-- ---------- settings: one list, but each field has its own rule ----------
-- money fields: finance and up · day-to-day fields (handover notes, expected visitors): engineers and up ·
-- the backup date: anyone working in the app · everything else: coordinators and up
create or replace function public.ppm_settings_field_roles(f text) returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select case
    when f in ('lastBackupAt') then array['owner', 'admin', 'manager', 'coordinator', 'engineer', 'finance']
    when f in ('approvalThreshold', 'poApprovalLimit', 'budgetSettings', 'costCodes', 'planHorizon') then array['owner', 'admin', 'manager', 'finance']
    when f in ('handover', 'expectedVisitors') then array['owner', 'admin', 'manager', 'coordinator', 'engineer']
    else array['owner', 'admin', 'manager', 'coordinator'] end
$$;
create or replace function public.ppm_settings_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_old jsonb; v_new jsonb; v_bad text;
begin
  if new.key <> 'org:settings' or new.scope <> 'shared' or auth.uid() is null then return new; end if;
  v_role := public.ppm_role(new.org_id);
  v_old := case when tg_op = 'UPDATE' then ppm_private.j(old.value) else '{}'::jsonb end;
  v_new := ppm_private.j(new.value);
  if v_old is null or jsonb_typeof(v_old) <> 'object' then v_old := '{}'::jsonb; end if;
  if v_new is null or jsonb_typeof(v_new) <> 'object' then raise exception 'Settings must be a set of named values.' using errcode = '42501'; end if;
  -- the quote approval limit: a plain number, changed only by someone with quote approval permission (any role)
  if (v_old -> 'approvalThreshold') is distinct from (v_new -> 'approvalThreshold') then
    if (coalesce(jsonb_typeof(v_new -> 'approvalThreshold'), 'null') not in ('number', 'null') and coalesce(v_new ->> 'approvalThreshold', '') <> '')
       or (jsonb_typeof(v_new -> 'approvalThreshold') = 'number' and (v_new -> 'approvalThreshold')::numeric <> round((v_new -> 'approvalThreshold')::numeric, 2)) then
      raise exception 'The approval limit must be a number.' using errcode = '42501'; end if;
    if not public.ppm_can_approve(new.org_id) then
      raise exception 'Only someone with quote approval permission can change the approval limit.' using errcode = '42501'; end if;
  end if;
  if v_role is null or v_role in ('owner', 'admin', 'manager') then return new; end if;
  select string_agg(k, ', ' order by k) into v_bad
  from (select jsonb_object_keys(v_old) as k union select jsonb_object_keys(v_new)) x
  where (v_old -> k) is distinct from (v_new -> k) and not (v_role = any (public.ppm_settings_field_roles(k)));
  if v_bad is not null then raise exception 'Your role can''t change these settings: %', v_bad using errcode = '42501'; end if;
  return new;
end $$;
drop trigger if exists kv_store_settings_check on public.kv_store;
create trigger kv_store_settings_check before insert or update on public.kv_store for each row execute function public.ppm_settings_check();
-- A saved row can't be moved to another company, list or scope by the app's users: otherwise a list could be
-- "deleted" by moving it into someone's personal space, or settings edited there and moved back unchecked.
-- (Only the SQL Editor — e.g. ppm_claim_old_data — can move rows.)
create or replace function public.ppm_kv_freeze() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and (new.org_id is distinct from old.org_id or new.key is distinct from old.key or new.scope is distinct from old.scope) then
    raise exception 'A saved list can''t be moved.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists kv_store_freeze on public.kv_store;
-- Record-level rules inside two lists (the app keeps the same rules in app/permissions.js):
--   assets (org:devices): engineers can't add, delete or restructure assets — only the fields their work touches
--   jobs (org:works): only approvers may give approval; a quote over the company's approval limit can't go ahead
--   without approval; a quote raised after approval needs approving again
create or replace function public.ppm_list_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_old jsonb; v_new jsonb; v_bad text; v_limit numeric; v_approver boolean; v_msg text;
  v_fields text[] := array['lastServiceDate', 'nextServiceDate', 'rescheduleLog', 'abortLog', 'usageReadings', 'statusOverride',
                           'changeLog', 'downtime', 'notesLog', 'booking', 'chaseLog'];
begin
  if new.scope <> 'shared' or auth.uid() is null or new.key not in ('org:devices', 'org:works') then return new; end if;
  v_role := public.ppm_role(new.org_id);
  if v_role is null then return new; end if;   -- not a member: the access rules refuse it anyway
  v_old := case when tg_op = 'UPDATE' then ppm_private.j(old.value) else null end;
  v_new := ppm_private.j(new.value);
  if v_old is null or jsonb_typeof(v_old) <> 'array' then v_old := '[]'::jsonb; end if;

  if new.key = 'org:devices' then
    if v_role <> 'engineer' then return new; end if;
    if v_new is null or jsonb_typeof(v_new) <> 'array' then raise exception 'Your role (Engineer) can''t change the asset list like that.' using errcode = '42501'; end if;
    if exists (select 1 from jsonb_array_elements(v_new) n where not exists (select 1 from jsonb_array_elements(v_old) o where o ->> 'id' = n ->> 'id')) then
      raise exception 'Your role (Engineer) can''t add assets.' using errcode = '42501'; end if;
    if exists (select 1 from jsonb_array_elements(v_old) o where not exists (select 1 from jsonb_array_elements(v_new) n where n ->> 'id' = o ->> 'id')) then
      raise exception 'Your role (Engineer) can''t delete assets.' using errcode = '42501'; end if;
    if jsonb_array_length(v_new) <> jsonb_array_length(v_old) then   -- e.g. a second copy of an existing asset
      raise exception 'Your role (Engineer) can''t add assets.' using errcode = '42501'; end if;
    select string_agg(distinct k, ', ') into v_bad
    from jsonb_array_elements(v_new) n join jsonb_array_elements(v_old) o on o ->> 'id' = n ->> 'id',
         lateral (select jsonb_object_keys(n) as k union select jsonb_object_keys(o)) ks
    where (n -> ks.k) is distinct from (o -> ks.k) and not (ks.k = any (v_fields));
    if v_bad is not null then raise exception 'Your role (Engineer) can''t change asset details (%).', v_bad using errcode = '42501'; end if;
    return new;
  end if;

  -- jobs
  if v_new is null or jsonb_typeof(v_new) <> 'array' then raise exception 'The jobs list must be a list of jobs.' using errcode = '42501'; end if;
  -- no second copy of a job (one approval can't be spent twice)
  if (select count(*) - count(distinct n ->> 'id') from jsonb_array_elements(v_new) n) > (select count(*) - count(distinct o ->> 'id') from jsonb_array_elements(v_old) o) then
    raise exception 'Each job can only be in the list once.' using errcode = '42501'; end if;
  -- amounts are plain numbers on any job that changes (so the database and the app read the same amount)
  if exists (select 1 from jsonb_array_elements(v_new) n
             where (jsonb_typeof(n) <> 'object'
                    or not exists (select 1 from jsonb_array_elements(v_old) o where o = n))
               and jsonb_typeof(n) = 'object'
               and exists (select 1 from unnest(array['quoteAmount', 'approvedAmount']) f
                           where (coalesce(jsonb_typeof(n -> f), 'null') not in ('number', 'null') and coalesce(n ->> f, '') <> '')
                              or (jsonb_typeof(n -> f) = 'number' and (n -> f)::numeric <> round((n -> f)::numeric, 2)))) then
    raise exception 'Quote amounts must be numbers in pounds and pence.' using errcode = '42501'; end if;
  v_approver := public.ppm_can_approve(new.org_id);
  -- the limit: settings.approvalThreshold; never set at all = £1,000, the app's default (0 or empty = no limit)
  select case when not coalesce(ppm_private.j(value) ? 'approvalThreshold', false) then 1000
              when jsonb_typeof(ppm_private.j(value) -> 'approvalThreshold') = 'number' then (ppm_private.j(value) -> 'approvalThreshold')::numeric
              when btrim(coalesce(ppm_private.j(value) ->> 'approvalThreshold', '')) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(ppm_private.j(value) ->> 'approvalThreshold')::numeric
              else 0 end
    into v_limit from public.kv_store where org_id = new.org_id and key = 'org:settings' and scope = 'shared';
  v_limit := coalesce(v_limit, 1000);
  select m into v_msg from (
    select case
      -- giving approval
      when not v_approver and exists (select 1 from unnest(array['approvedBy', 'approvedAt', 'approvedAmount']) f
                                        where coalesce(n ->> f, '') <> '' and (n -> f) is distinct from (o -> f))
        then 'Only someone with quote approval permission can approve quotes.'
      -- an over-limit quote can't go ahead without approval: not by moving it on, and not by raising the quote of a
      -- job already under way (one that was already going may carry on unchanged)
      when v_limit > 0 and q >= v_limit and coalesce(n ->> 'approvedBy', '') = '' and (
             (coalesce(n ->> 'status', '') in ('approved', 'in_progress')
               and (o is null or coalesce(o ->> 'status', '') not in ('approved', 'in_progress', 'completed') or q > oq))
          or (n ->> 'status' = 'completed'
               and ((o is null and not v_approver) or (o is not null and (coalesce(o ->> 'status', '') not in ('approved', 'in_progress', 'completed') or q > oq)))))
        then 'This quote is over the approval limit and needs approving first.'
      -- an approved job can't be moved to another supplier or asset and keep its approval, unless an approver does it
      when not v_approver and o is not null and coalesce(o ->> 'approvedBy', '') <> '' and coalesce(n ->> 'approvedBy', '') <> ''
           and ((n -> 'supplierId') is distinct from (o -> 'supplierId') or (n -> 'deviceId') is distinct from (o -> 'deviceId'))
        then 'This job was approved for a different supplier or asset, so it needs approving again.'
      when not v_approver and v_limit > 0 and q >= v_limit and o is not null and coalesce(o ->> 'approvedBy', '') <> '' and coalesce(n ->> 'approvedBy', '') <> ''
           and q > coalesce(case when jsonb_typeof(n -> 'approvedAmount') = 'number' then (n -> 'approvedAmount')::numeric end, oq)
        then 'The quote went up after it was approved, so it needs approving again.'
      end as m
    from jsonb_array_elements(v_new) n
    left join lateral (select x from jsonb_array_elements(v_old) x where x ->> 'id' = n ->> 'id' limit 1) ox(o) on true
    cross join lateral (select case when jsonb_typeof(n -> 'quoteAmount') = 'number' then (n -> 'quoteAmount')::numeric else 0 end as q,
                               case when jsonb_typeof(o -> 'quoteAmount') = 'number' then (o -> 'quoteAmount')::numeric
                                    when btrim(coalesce(o ->> 'quoteAmount', '')) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(o ->> 'quoteAmount')::numeric else 0 end as oq) qq
    where jsonb_typeof(n) = 'object' and (o is null or n is distinct from o)
  ) r where m is not null limit 1;
  if v_msg is not null then raise exception '%', v_msg using errcode = '42501'; end if;
  return new;
end $$;
drop trigger if exists kv_store_list_guard on public.kv_store;
create trigger kv_store_list_guard before insert or update on public.kv_store for each row execute function public.ppm_list_guard();
create trigger kv_store_freeze before update on public.kv_store for each row execute function public.ppm_kv_freeze();

-- ---------- who may call what ----------
revoke all on function public.ppm_role(uuid), public.ppm_is_member(uuid), public.ppm_can_edit(uuid), public.ppm_is_admin(uuid), public.ppm_folder_member(text, boolean) from public, anon;
grant execute on function public.ppm_role(uuid), public.ppm_is_member(uuid), public.ppm_can_edit(uuid), public.ppm_is_admin(uuid), public.ppm_folder_member(text, boolean) to authenticated;
revoke all on function public.ppm_my_orgs(), public.ppm_create_org(text), public.ppm_rename_org(uuid, text), public.ppm_team(uuid), public.ppm_invite(uuid, text, text),
  public.ppm_cancel_invite(uuid, uuid), public.ppm_accept_invite(text), public.ppm_set_role(uuid, uuid, text), public.ppm_remove_member(uuid, uuid),
  public.ppm_legacy_waiting(), public.ppm_invite_info(text) from public, anon;
grant execute on function public.ppm_my_orgs(), public.ppm_create_org(text), public.ppm_rename_org(uuid, text), public.ppm_team(uuid), public.ppm_invite(uuid, text, text),
  public.ppm_cancel_invite(uuid, uuid), public.ppm_accept_invite(text), public.ppm_set_role(uuid, uuid, text), public.ppm_remove_member(uuid, uuid),
  public.ppm_legacy_waiting(), public.ppm_invite_info(text) to authenticated;
-- only you, in the SQL Editor
revoke all on function public.ppm_claim_old_data(text) from public, anon, authenticated;
revoke all on function public.ppm_touch() from public, anon, authenticated;
revoke all on function public.ppm_settings_check() from public, anon, authenticated;
revoke all on function public.ppm_kv_freeze() from public, anon, authenticated;
revoke all on function public.ppm_list_guard() from public, anon, authenticated;
revoke all on function public.ppm_can_approve(uuid), public.ppm_set_approver(uuid, uuid, boolean) from public, anon;
grant execute on function public.ppm_can_approve(uuid), public.ppm_set_approver(uuid, uuid, boolean) to authenticated;
revoke all on function public.ppm_can_write(uuid, text) from public, anon;
grant execute on function public.ppm_can_write(uuid, text), public.ppm_write_roles(text), public.ppm_settings_field_roles(text) to authenticated;
grant execute on function public.ppm_public_read(text, text, uuid, text), public.ppm_public_write(text, text, jsonb, uuid) to anon, authenticated;

-- ---------- private photo storage ----------
insert into storage.buckets (id, name, public) values ('ppm-media', 'ppm-media', false) on conflict (id) do nothing;
update storage.buckets set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'] where id = 'ppm-media';
drop policy if exists "ppm media read" on storage.objects;
drop policy if exists "ppm media upload" on storage.objects;
create policy "ppm media read" on storage.objects for select to authenticated
  using (bucket_id = 'ppm-media' and public.ppm_folder_member((storage.foldername(name))[1], false));
create policy "ppm media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ppm-media' and public.ppm_folder_member((storage.foldername(name))[1], true));

-- tell the API about the new tables and functions
notify pgrst, 'reload schema';
