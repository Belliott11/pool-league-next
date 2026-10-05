-- Poolean Intel private player labels. Run this once in the Supabase SQL editor (safe to run again).
--
-- The labels you give players (Gunner, Brick Layer, and so on) are only for writing headlines, so they are kept
-- here, readable and writable by editors only. Visitors never receive them: they see the finished headlines that
-- were saved with each night, not the labels behind them.

create table if not exists public.private_labels (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.private_labels enable row level security;

drop policy if exists "editors can read labels" on public.private_labels;
create policy "editors can read labels"
  on public.private_labels for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "editors can add labels" on public.private_labels;
create policy "editors can add labels"
  on public.private_labels for insert
  to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "editors can change labels" on public.private_labels;
create policy "editors can change labels"
  on public.private_labels for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
