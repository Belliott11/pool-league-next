-- Poolean Intel Play of the Year votes. Safe to run again.
--
-- One vote per phone per match of a bracket (src/lib/playOfYear.ts). Like Pick'em, a vote belongs to the phone that cast it (owner_hash
-- is the hash of the phone's private key) and is made or changed only through cast_poty_vote. Everyone can read the votes. It never
-- touches the league data. A vote is only taken for the newest bracket, for a play in its seeds, while that match's round is open (read
-- from the bracket in the league data: startAt plus days per round). Votes for a play not in the match are ignored when counting.

create table if not exists public.poty_votes (
  bracket    text not null,
  match      text not null,
  pick       text not null,
  owner_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (bracket, match, owner_hash)
);

alter table public.poty_votes enable row level security;

drop policy if exists "anyone can read poty votes" on public.poty_votes;
create policy "anyone can read poty votes" on public.poty_votes for select to anon, authenticated using (true);

create or replace function public.cast_poty_vote(p_bracket text, p_match text, p_pick text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b jsonb;
  r int;
  opens timestamptz;
  h text;
  n int;
begin
  if length(coalesce(p_key, '')) < 16 or length(p_key) > 200
     or length(coalesce(p_bracket, '')) = 0 or length(p_bracket) > 80
     or coalesce(p_match, '') !~ '^r[0-9]m[0-9]{1,2}$'
     or length(coalesce(p_pick, '')) = 0 or length(p_pick) > 80 then
    return false;
  end if;
  select s.data->'playOfYear'->-1 into b from public.league_state s where s.id = 1;
  if b is null or b->>'id' <> p_bracket or not (b->'seeds') ? p_pick then
    return false;
  end if;
  r := substring(p_match from 2 for 1)::int;
  opens := (b->>'startAt')::timestamptz + make_interval(days => r * (b->>'days')::int);
  if now() < opens or now() >= opens + make_interval(days => (b->>'days')::int) then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  insert into public.poty_votes as v (bracket, match, pick, owner_hash, updated_at)
  values (p_bracket, p_match, p_pick, h, now())
  on conflict (bracket, match, owner_hash) do update set pick = excluded.pick, updated_at = now();
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.cast_poty_vote(text, text, text, text) from public;
grant execute on function public.cast_poty_vote(text, text, text, text) to anon, authenticated;
