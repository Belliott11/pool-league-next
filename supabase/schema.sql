-- Poolean Intel shared data. Run this once in the Supabase SQL editor.
--
-- One row holds the whole league state. Anyone (including visitors who are not signed in) can READ
-- it, which is the public viewer link. Only accounts listed in `admins` can WRITE it.

create table if not exists public.league_state (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.league_state enable row level security;
alter table public.admins enable row level security;

-- Visitors: read the shared data.
drop policy if exists "anyone can read the league" on public.league_state;
create policy "anyone can read the league"
  on public.league_state for select
  to anon, authenticated
  using (true);

-- A signed-in account can see only its own row in admins, which is how the app learns it may edit.
drop policy if exists "an account can see its own admin row" on public.admins;
create policy "an account can see its own admin row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- Editors: insert and update the shared data.
drop policy if exists "editors can insert" on public.league_state;
create policy "editors can insert"
  on public.league_state for insert
  to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "editors can update" on public.league_state;
create policy "editors can update"
  on public.league_state for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- No delete policy: nobody can delete the row through the API.

-- After you create your account (see docs/cloud-setup.md), make it an editor. Put your own email in:
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
