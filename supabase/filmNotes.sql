-- Poolean Intel film room notes. Safe to run again.
--
-- A short note on one play (a game and a shot or turnover id) from the film room (src/lib/filmNotes.ts), shown to everyone under that
-- play. Like Pick'em, a note belongs to the phone that wrote it: owner_hash is the hash of the phone's private key, and notes are added
-- or removed only through add_film_note and delete_film_note. A phone can add up to 40 notes a day. It never touches the league data.

create table if not exists public.film_notes (
  id         bigint generated always as identity primary key,
  game_id    text not null,
  event_id   text not null,
  note       text not null check (length(note) between 1 and 280),
  author     text,
  owner_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists film_notes_game on public.film_notes (game_id);

alter table public.film_notes enable row level security;

drop policy if exists "anyone can read film notes" on public.film_notes;
create policy "anyone can read film notes" on public.film_notes for select to anon, authenticated using (true);

create or replace function public.add_film_note(p_game_id text, p_event_id text, p_note text, p_author text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
  n text := btrim(coalesce(p_note, ''));
begin
  if length(coalesce(p_key, '')) < 16 or length(p_key) > 200 or length(n) = 0 or length(n) > 280
     or length(coalesce(p_game_id, '')) = 0 or length(p_game_id) > 80 or length(coalesce(p_event_id, '')) = 0 or length(p_event_id) > 80
     or length(coalesce(p_author, '')) > 80 then
    return false;
  end if;
  if not exists (
    select 1 from public.league_state s, jsonb_array_elements(s.data->'games') g
    where s.id = 1 and g->>'id' = p_game_id
      and (exists (select 1 from jsonb_array_elements(g->'scoringEvents') e where e->>'id' = p_event_id)
        or exists (select 1 from jsonb_array_elements(g->'turnoverEvents') e where e->>'id' = p_event_id))
  ) then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  if (select count(*) from public.film_notes where owner_hash = h and created_at > now() - interval '1 day') >= 40 then
    return false;
  end if;
  insert into public.film_notes (game_id, event_id, note, author, owner_hash) values (p_game_id, p_event_id, n, nullif(p_author, ''), h);
  return true;
end;
$$;

create or replace function public.delete_film_note(p_id bigint, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  if length(coalesce(p_key, '')) < 16 or length(p_key) > 200 then
    return false;
  end if;
  delete from public.film_notes where id = p_id and owner_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.add_film_note(text, text, text, text, text) from public;
revoke all on function public.delete_film_note(bigint, text) from public;
grant execute on function public.add_film_note(text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_film_note(bigint, text) to anon, authenticated;
