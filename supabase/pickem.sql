-- Poolean Intel pick'em votes. Run this once in the Supabase SQL editor (safe to run again).
--
-- Friends vote on who wins a game before it starts. A vote is one row per game and voter, and a voter can change it
-- until the game begins (the app stops offering the vote once the game has a score). Everyone can read the votes
-- and add or change one; nobody can delete. It never touches the league data.

create table if not exists public.pickem_votes (
  game_id    text not null,
  voter      text not null,
  pick       text not null check (pick in ('A', 'B')),
  updated_at timestamptz not null default now(),
  primary key (game_id, voter)
);

alter table public.pickem_votes enable row level security;

drop policy if exists "anyone can read votes" on public.pickem_votes;
create policy "anyone can read votes" on public.pickem_votes for select to anon, authenticated using (true);

drop policy if exists "anyone can add a vote" on public.pickem_votes;
create policy "anyone can add a vote" on public.pickem_votes for insert to anon, authenticated with check (pick in ('A', 'B'));

drop policy if exists "anyone can change a vote" on public.pickem_votes;
create policy "anyone can change a vote" on public.pickem_votes for update to anon, authenticated using (true) with check (pick in ('A', 'B'));
