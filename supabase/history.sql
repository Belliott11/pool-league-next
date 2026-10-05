-- Poolean Intel version history. Run this once in the Supabase SQL editor (safe to run again).
--
-- Every save overwrites the one shared row, so a bad publish or an accidental delete would otherwise be
-- permanent. This keeps snapshots of the data as it was before a save, so an editor can restore one from
-- the account menu ("Past versions"). A snapshot is taken at most every 30 minutes, and always when a
-- save would leave fewer games than before (a delete). The newest 100 are kept.

create table if not exists public.league_state_history (
  id           bigint generated always as identity primary key,
  data         jsonb not null,
  version_at   timestamptz not null,
  saved_at     timestamptz not null default now(),
  game_count   int not null default 0,
  player_count int not null default 0
);

alter table public.league_state_history enable row level security;

-- Only editors can see or add history. Nobody can edit or delete it through the API.
drop policy if exists "editors can read history" on public.league_state_history;
create policy "editors can read history"
  on public.league_state_history for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "editors can add history" on public.league_state_history;
create policy "editors can add history"
  on public.league_state_history for insert
  to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create or replace function public.snapshot_league_state() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
  old_games int := coalesce(jsonb_array_length(old.data -> 'games'), 0);
  new_games int := coalesce(jsonb_array_length(new.data -> 'games'), 0);
begin
  select max(saved_at) into last_at from public.league_state_history;
  if last_at is null or last_at < now() - interval '30 minutes' or new_games < old_games then
    insert into public.league_state_history (data, version_at, game_count, player_count)
    values (old.data, old.updated_at, old_games, coalesce(jsonb_array_length(old.data -> 'players'), 0));
    delete from public.league_state_history
      where id not in (select id from public.league_state_history order by id desc limit 100);
  end if;
  return new;
end;
$$;

drop trigger if exists league_state_snapshot on public.league_state;
create trigger league_state_snapshot
  before update on public.league_state
  for each row execute function public.snapshot_league_state();
