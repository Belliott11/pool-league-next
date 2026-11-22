-- Poolean Intel pick'em votes. Run this once in the Supabase SQL editor (safe to run again).
--
-- Friends vote on who wins a game before it starts. A vote is one row per game and voter, and a voter can change it
-- until the game begins (the app stops offering the vote once the game has a score). Everyone can read the votes.
-- A vote belongs to the phone that cast it: the phone keeps a random key, the row keeps only its hash (owner_hash), and
-- votes are cast or changed only through cast_pickem_vote, which checks the key. A vote with no owner yet is claimed by
-- the first phone to change it. Nobody can delete. It never touches the league data.

create table if not exists public.pickem_votes (
  game_id    text not null,
  voter      text not null,
  pick       text not null check (pick in ('A', 'B')),
  updated_at timestamptz not null default now(),
  owner_hash text,
  primary key (game_id, voter)
);
alter table public.pickem_votes add column if not exists owner_hash text;

alter table public.pickem_votes enable row level security;

drop policy if exists "anyone can read votes" on public.pickem_votes;
create policy "anyone can read votes" on public.pickem_votes for select to anon, authenticated using (true);

-- Votes are written only through the function below, never directly.
drop policy if exists "anyone can add a vote" on public.pickem_votes;
drop policy if exists "anyone can change a vote" on public.pickem_votes;

create or replace function public.cast_pickem_vote(p_game_id text, p_voter text, p_pick text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
  n int;
begin
  if p_pick not in ('A', 'B') or length(coalesce(p_key, '')) < 16 or length(p_key) > 200
     or length(coalesce(p_game_id, '')) = 0 or length(p_game_id) > 80 or length(coalesce(p_voter, '')) = 0 or length(p_voter) > 80 then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  insert into public.pickem_votes as v (game_id, voter, pick, updated_at, owner_hash)
  values (p_game_id, p_voter, p_pick, now(), h)
  on conflict (game_id, voter) do update
    set pick = excluded.pick, updated_at = now(), owner_hash = coalesce(v.owner_hash, excluded.owner_hash)
    where v.owner_hash is null or v.owner_hash = excluded.owner_hash;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.cast_pickem_vote(text, text, text, text) from public;
grant execute on function public.cast_pickem_vote(text, text, text, text) to anon, authenticated;
