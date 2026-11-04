-- Poolean Intel preseason predictions. Run this once in the Supabase SQL editor (safe to run again).
--
-- Before opening night, friends call next season's award winners and top three. One row per season (the opening night
-- date) and voter; a voter can change their picks until opening night (the app stops offering the form then). Everyone
-- can read the picks and add or change their own row; nobody can delete. It never touches the league data.

create table if not exists public.season_predictions (
  season     text not null,
  voter      text not null,
  picks      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season, voter)
);

alter table public.season_predictions enable row level security;

drop policy if exists "anyone can read predictions" on public.season_predictions;
create policy "anyone can read predictions" on public.season_predictions for select to anon, authenticated using (true);

drop policy if exists "anyone can add a prediction" on public.season_predictions;
create policy "anyone can add a prediction" on public.season_predictions for insert to anon, authenticated with check (jsonb_typeof(picks) = 'object');

drop policy if exists "anyone can change a prediction" on public.season_predictions;
create policy "anyone can change a prediction" on public.season_predictions for update to anon, authenticated using (true) with check (jsonb_typeof(picks) = 'object');
