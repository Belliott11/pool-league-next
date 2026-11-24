-- Poolean Intel: players answer "I'm in" or "Can't make it" for a night themselves. Run this once in the Supabase SQL editor (safe to
-- run again; applied on 2026-11-24).
--
-- One row per night and player. Everyone can read them. A reply belongs to the phone that made it: the phone keeps a random key, the
-- row keeps only its hash (owner_hash), and replies are made or changed only through save_rsvp, which checks the key, the same way as
-- pick'em votes (supabase/pickem.sql). Nobody can delete. It never touches the league data; the site shows the editor's RSVP list with
-- these replies on top (a player's own reply wins).

create table if not exists public.rsvp_replies (
  night      text not null check (night ~ '^\d{4}-\d{2}-\d{2}$'),
  player     text not null,
  going      boolean not null,
  updated_at timestamptz not null default now(),
  owner_hash text,
  primary key (night, player)
);

alter table public.rsvp_replies enable row level security;

drop policy if exists "anyone can read rsvp replies" on public.rsvp_replies;
create policy "anyone can read rsvp replies" on public.rsvp_replies for select to anon, authenticated using (true);

create or replace function public.save_rsvp(p_night text, p_player text, p_going boolean, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
  n int;
begin
  if p_night !~ '^\d{4}-\d{2}-\d{2}$' or p_going is null or length(coalesce(p_key, '')) < 16 or length(p_key) > 200
     or length(coalesce(p_player, '')) = 0 or length(p_player) > 80 then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  insert into public.rsvp_replies as r (night, player, going, updated_at, owner_hash)
  values (p_night, p_player, p_going, now(), h)
  on conflict (night, player) do update
    set going = excluded.going, updated_at = now()
    where r.owner_hash = excluded.owner_hash;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.save_rsvp(text, text, boolean, text) from public;
grant execute on function public.save_rsvp(text, text, boolean, text) to anon, authenticated;
