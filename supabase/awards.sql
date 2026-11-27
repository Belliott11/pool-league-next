-- Poolean Intel season award votes. Safe to run again.
--
-- The players vote on the season's awards (src/lib/awardVote.ts), ranked choice: each ballot ranks players in order for an award, and
-- the winner is found by instant runoff on the site. A ballot lives in the league data (awardBallots, newest last); the
-- votes live here. A secret ballot: visitors cannot read this table at all (row level security with no policy). They get only what the
-- functions below hand out: vote counts, their own phone's votes, and the picks for awards the editor has revealed.
--
-- One vote per award per player, cast from the phone that first voted as that player (owner_hash is the hash of the phone's private key,
-- as in Pick'em), and one player per phone on a ballot, so a phone cannot vote as everyone. Votes are only taken for the newest ballot
-- while it is open, for an award on it, for a candidate on it, as a player in the league, and never for yourself.

create table if not exists public.award_votes (
  ballot     text not null,
  award      text not null,
  voter      text not null,
  ranking    jsonb not null, -- player ids, first choice first
  owner_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (ballot, award, voter)
);
-- Before ranked choice (2026-11-27) a vote was one pick; the table was empty when it changed.
alter table public.award_votes add column if not exists ranking jsonb;
alter table public.award_votes drop column if exists pick;
alter table public.award_votes alter column ranking set not null;
drop function if exists public.cast_award_vote(text, text, text, text, text);

alter table public.award_votes enable row level security;
-- No policies: nobody reads or writes the table directly.

create or replace function public.cast_award_vote(p_ballot text, p_award text, p_voter text, p_ranking jsonb, p_key text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d jsonb;
  b jsonb;
  h text;
begin
  if length(coalesce(p_key, '')) < 16 or length(p_key) > 200
     or length(coalesce(p_ballot, '')) = 0 or length(p_ballot) > 80
     or length(coalesce(p_award, '')) = 0 or length(p_award) > 20
     or length(coalesce(p_voter, '')) = 0 or length(p_voter) > 80
     or jsonb_typeof(p_ranking) is distinct from 'array'
     or jsonb_array_length(p_ranking) < 1 or jsonb_array_length(p_ranking) > 30
     or exists (select 1 from jsonb_array_elements(p_ranking) e where jsonb_typeof(e) <> 'string')
     or (select count(distinct e) from jsonb_array_elements_text(p_ranking) e) <> jsonb_array_length(p_ranking)
     or p_ranking ? p_voter then
    return 'no';
  end if;
  select s.data into d from public.league_state s where s.id = 1;
  b := d->'awardBallots'->-1;
  if b is null or b->>'id' <> p_ballot then
    return 'no';
  end if;
  if not coalesce((b->>'open')::boolean, false) then
    return 'closed';
  end if;
  if not (b->'awards') ? p_award
     or exists (select 1 from jsonb_array_elements_text(p_ranking) e where not (b->'candidates') ? e)
     or not exists (select 1 from jsonb_array_elements(d->'players') p where p->>'id' = p_voter) then
    return 'no';
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  -- Another phone already votes as this player, or this phone already votes as someone else.
  if exists (select 1 from public.award_votes v where v.ballot = p_ballot and v.voter = p_voter and v.owner_hash <> h)
     or exists (select 1 from public.award_votes v where v.ballot = p_ballot and v.owner_hash = h and v.voter <> p_voter) then
    return 'taken';
  end if;
  insert into public.award_votes as v (ballot, award, voter, ranking, owner_hash, updated_at)
  values (p_ballot, p_award, p_voter, p_ranking, h, now())
  on conflict (ballot, award, voter) do update set ranking = excluded.ranking, updated_at = now();
  return 'ok';
end;
$$;

-- How many players have voted, how many ballots each award has, and every ranking for the awards already revealed.
create or replace function public.award_vote_counts(p_ballot text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  b jsonb;
  shown text[];
begin
  select s.data->'awardBallots'->-1 into b from public.league_state s where s.id = 1;
  if b is null or b->>'id' <> p_ballot then
    select e into b from public.league_state s, jsonb_array_elements(s.data->'awardBallots') e where s.id = 1 and e->>'id' = p_ballot;
  end if;
  if b is null then
    return null;
  end if;
  select coalesce(array_agg(a), '{}') into shown
  from jsonb_array_elements_text(b->'awards') with ordinality as t(a, i)
  where i <= coalesce((b->>'revealed')::int, 0);
  return jsonb_build_object(
    'voters', (select count(distinct voter) from public.award_votes where ballot = p_ballot),
    'by_award', coalesce((select jsonb_object_agg(award, n) from (select award, count(*) n from public.award_votes where ballot = p_ballot group by award) x), '{}'::jsonb),
    'picks', coalesce((select jsonb_object_agg(award, ps) from (select award, jsonb_agg(ranking order by updated_at) ps from public.award_votes where ballot = p_ballot and award = any(shown) group by award) y), '{}'::jsonb)
  );
end;
$$;

-- This phone's own rankings on a ballot, award to ranking.
create or replace function public.my_award_votes(p_ballot text, p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(award, ranking), '{}'::jsonb)
  from public.award_votes
  where ballot = p_ballot and length(coalesce(p_key, '')) >= 16
    and owner_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
$$;

revoke all on function public.cast_award_vote(text, text, text, jsonb, text) from public;
revoke all on function public.award_vote_counts(text) from public;
revoke all on function public.my_award_votes(text, text) from public;
grant execute on function public.cast_award_vote(text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.award_vote_counts(text) to anon, authenticated;
grant execute on function public.my_award_votes(text, text) to anon, authenticated;
