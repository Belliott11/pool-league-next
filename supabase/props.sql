-- Poolean Intel prop picks. Safe to run again.
--
-- Over or under on a player's points in a live game, picked before its first basket, next to Pick'em. One row per game, player and
-- voter; the line it was picked against is kept with it. Like Pick'em, a pick belongs to the phone that made it (owner_hash is the hash of
-- the phone's private key) and is made or changed only through cast_prop_pick. Everyone can read the picks. It never touches the league
-- data. A voter cannot pick a line on themselves, and a pick is only taken while the game is live with no basket yet and is not a test
-- game (read from the league data). Standings score picks against the line worked out from the league data, not the line sent.

create table if not exists public.prop_picks (
  game_id    text not null,
  pid        text not null,
  voter      text not null,
  pick       text not null check (pick in ('over', 'under')),
  line       numeric not null,
  updated_at timestamptz not null default now(),
  owner_hash text,
  primary key (game_id, pid, voter)
);

alter table public.prop_picks enable row level security;

drop policy if exists "anyone can read prop picks" on public.prop_picks;
create policy "anyone can read prop picks" on public.prop_picks for select to anon, authenticated using (true);

create or replace function public.cast_prop_pick(p_game_id text, p_pid text, p_voter text, p_pick text, p_line numeric, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
  n int;
begin
  if p_pick not in ('over', 'under') or p_line is null or p_line < 0 or p_line > 99
     or length(coalesce(p_key, '')) < 16 or length(p_key) > 200
     or length(coalesce(p_game_id, '')) = 0 or length(p_game_id) > 80
     or length(coalesce(p_pid, '')) = 0 or length(p_pid) > 80
     or length(coalesce(p_voter, '')) = 0 or length(p_voter) > 80 or p_voter = p_pid then
    return false;
  end if;
  if not exists (
    select 1 from public.league_state s, jsonb_array_elements(s.data->'games') g
    where s.id = 1 and g->>'id' = p_game_id
      and coalesce((g->>'liveInProgress')::boolean, false)
      and not coalesce((g->>'test')::boolean, false)
      and coalesce(jsonb_array_length(g->'liveScores'), 0) + coalesce(jsonb_array_length(g->'scorekeeperScores'), 0) = 0
      and ((g->'teamA') ? p_pid or (g->'teamB') ? p_pid)
  ) then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  insert into public.prop_picks as v (game_id, pid, voter, pick, line, updated_at, owner_hash)
  values (p_game_id, p_pid, p_voter, p_pick, p_line, now(), h)
  on conflict (game_id, pid, voter) do update
    set pick = excluded.pick, line = excluded.line, updated_at = now()
    where v.owner_hash = excluded.owner_hash;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.cast_prop_pick(text, text, text, text, numeric, text) from public;
grant execute on function public.cast_prop_pick(text, text, text, text, numeric, text) to anon, authenticated;
