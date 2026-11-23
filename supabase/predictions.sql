-- Poolean Intel preseason predictions. Run this once in the Supabase SQL editor (safe to run again).
--
-- Before opening night, friends call next season's award winners and top three. One row per season (the opening night
-- date) and voter; a voter can change their picks until opening night (the app stops offering the form then). Everyone
-- can read the picks. Picks belong to the phone that made them: the phone keeps a random key, the row keeps only its hash
-- (owner_hash), and picks are saved only through save_season_prediction, which checks the key. A row with no owner yet is
-- claimed by the first phone to change it. Nobody can delete. It never touches the league data.

create table if not exists public.season_predictions (
  season     text not null,
  voter      text not null,
  picks      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  owner_hash text,
  primary key (season, voter)
);
alter table public.season_predictions add column if not exists owner_hash text;

alter table public.season_predictions enable row level security;

drop policy if exists "anyone can read predictions" on public.season_predictions;
create policy "anyone can read predictions" on public.season_predictions for select to anon, authenticated using (true);

-- Picks are written only through the function below, never directly.
drop policy if exists "anyone can add a prediction" on public.season_predictions;
drop policy if exists "anyone can change a prediction" on public.season_predictions;

create or replace function public.save_season_prediction(p_season text, p_voter text, p_picks jsonb, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
  n int;
begin
  if jsonb_typeof(p_picks) <> 'object' or length(p_picks::text) > 4000 or length(coalesce(p_key, '')) < 16 or length(p_key) > 200
     or length(coalesce(p_season, '')) = 0 or length(p_season) > 40 or length(coalesce(p_voter, '')) = 0 or length(p_voter) > 80 then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  insert into public.season_predictions as s (season, voter, picks, updated_at, owner_hash)
  values (p_season, p_voter, p_picks, now(), h)
  on conflict (season, voter) do update
    set picks = excluded.picks, updated_at = now(), owner_hash = coalesce(s.owner_hash, excluded.owner_hash)
    where s.owner_hash is null or s.owner_hash = excluded.owner_hash;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.save_season_prediction(text, text, jsonb, text) from public;
grant execute on function public.save_season_prediction(text, text, jsonb, text) to anon, authenticated;
