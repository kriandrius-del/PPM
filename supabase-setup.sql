-- Run this once in your Supabase project's SQL Editor before first deploy.

create table if not exists kv_store (
  key text not null,
  scope text not null,       -- 'shared' for team data, or a device id for personal data
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (key, scope)
);

alter table kv_store enable row level security;

-- This app has no login system — it works the same way the original Claude
-- artifact did, where anyone with the link can read and write. If you later
-- want real access control, replace this policy with proper auth rules.
create policy "allow all" on kv_store
  for all
  using (true)
  with check (true);
