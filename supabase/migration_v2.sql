-- Migration additive : conserve les événements et données déjà présents.
-- À exécuter une seule fois dans Supabase > SQL Editor.

alter table public.events
  add column if not exists production jsonb not null default '{}'::jsonb,
  add column if not exists staffing jsonb not null default '{}'::jsonb,
  add column if not exists groups jsonb not null default '[]'::jsonb;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Admins can read app settings" on public.app_settings;
create policy "Admins can read app settings" on public.app_settings
  for select using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "Admins can insert app settings" on public.app_settings;
create policy "Admins can insert app settings" on public.app_settings
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings" on public.app_settings
  for update using (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));
