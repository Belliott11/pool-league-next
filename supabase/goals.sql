-- Poolean Intel summer goals. Safe to run again.
--
-- Each player picks up to two goals for a season on their own phone (src/lib/goals.ts). Like Pick'em and RSVP replies, the goals belong
-- to the phone that set them: owner_hash is the hash of the phone's private key, and the first phone to set a goal for a player that
-- season owns that player's goals. Made, changed or cleared (a null target) only through save_season_goal. Everyone can read them.
-- It never touches the league data; progress is worked out from the games on the site.

create table if not exists public.season_goals (
  season     text not null check (season ~ '^\d{4}$'),
  player     text not null,
  slot       int not null check (slot in (1, 2)),
  goal       text not null,
  target     numeric not null,
  owner_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (season, player, slot)
);

alter table public.season_goals enable row level security;

drop policy if exists "anyone can read season goals" on public.season_goals;
create policy "anyone can read season goals" on public.season_goals for select to anon, authenticated using (true);

create or replace function public.save_season_goal(p_season text, p_player text, p_slot int, p_goal text, p_target numeric, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
  n int;
begin
  if coalesce(p_season, '') !~ '^\d{4}$' or p_slot not in (1, 2) or length(coalesce(p_key, '')) < 16 or length(p_key) > 200
     or length(coalesce(p_player, '')) = 0 or length(p_player) > 80
     or (p_target is not null and (p_target < 0 or p_target > 1000
         or coalesce(p_goal, '') not in ('ppg', 'apg', 'rpg', 'threePct', 'ts', 'winPct', 'gamePts', 'gameAst', 'games'))) then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  if exists (select 1 from public.season_goals g where g.season = p_season and g.player = p_player and g.owner_hash <> h) then
    return false;
  end if;
  if p_target is null then
    delete from public.season_goals g where g.season = p_season and g.player = p_player and g.slot = p_slot and g.owner_hash = h;
    return true;
  end if;
  insert into public.season_goals as g (season, player, slot, goal, target, owner_hash, updated_at)
  values (p_season, p_player, p_slot, p_goal, p_target, h, now())
  on conflict (season, player, slot) do update
    set goal = excluded.goal, target = excluded.target, updated_at = now()
    where g.owner_hash = excluded.owner_hash;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.save_season_goal(text, text, int, text, numeric, text) from public;
grant execute on function public.save_season_goal(text, text, int, text, numeric, text) to anon, authenticated;
