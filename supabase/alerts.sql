-- Poolean Intel: game alerts. A phone that turns them on gets a notification when a game goes live and when it ends. Applied
-- 2026-11-25 (safe to run again).
--
-- push_subscriptions: one row per phone's push address. Written only through save_push_subscription / delete_push_subscription, with the
-- same phone-owned key as Pick'em (the row keeps only its hash), so a phone can only change its own. Nobody can read them but the
-- game-alerts function (service role). push_sent: which alerts went out, so each game's "live" and "final" go once. push_vapid: the
-- site's signing key, made by the function itself on first use and never readable by visitors.
-- A trigger on league_state pings the game-alerts function whenever the set of live games changes; the function reads the league data
-- itself and only sends what is true and not yet sent, so a stray call can do no harm.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  endpoint   text primary key check (endpoint ~ '^https://' and length(endpoint) < 1000),
  p256dh     text not null check (length(p256dh) between 40 and 200),
  auth       text not null check (length(auth) between 10 and 100),
  owner_hash text not null,
  created_at timestamptz not null default now(),
  hello_at   timestamptz -- when the "you're set" notification went to it (once)
);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions add column if not exists hello_at timestamptz;

create table if not exists public.push_sent (
  game_id text not null,
  kind    text not null check (kind in ('live', 'final')),
  sent_at timestamptz not null default now(),
  primary key (game_id, kind)
);
alter table public.push_sent enable row level security;

create table if not exists public.push_vapid (
  id int primary key default 1 check (id = 1),
  d  text not null,
  x  text not null,
  y  text not null
);
alter table public.push_vapid enable row level security;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
  n int;
begin
  if p_endpoint !~ '^https://' or length(p_endpoint) >= 1000 or length(coalesce(p_p256dh, '')) not between 40 and 200
     or length(coalesce(p_auth, '')) not between 10 and 100 or length(coalesce(p_key, '')) < 16 or length(p_key) > 200 then
    return false;
  end if;
  h := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  insert into public.push_subscriptions as s (endpoint, p256dh, auth, owner_hash)
  values (p_endpoint, p_p256dh, p_auth, h)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth
    where s.owner_hash = excluded.owner_hash;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  delete from public.push_subscriptions
  where endpoint = p_endpoint and owner_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.delete_push_subscription(text, text) from public;
grant execute on function public.save_push_subscription(text, text, text, text) to anon, authenticated;
grant execute on function public.delete_push_subscription(text, text) to anon, authenticated;

-- Ping the game-alerts function when the set of live games changes (a game went live, finished or was discarded).
create or replace function public.league_state_alerts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  was jsonb;
  now_live jsonb;
begin
  select coalesce(jsonb_agg(g->>'id' order by g->>'id'), '[]'::jsonb) into was
  from jsonb_array_elements(coalesce(old.data->'games', '[]'::jsonb)) g where (g->>'liveInProgress') = 'true';
  select coalesce(jsonb_agg(g->>'id' order by g->>'id'), '[]'::jsonb) into now_live
  from jsonb_array_elements(coalesce(new.data->'games', '[]'::jsonb)) g where (g->>'liveInProgress') = 'true';
  if was is distinct from now_live then
    -- Never let an alert problem stop the league data from saving.
    begin
      perform net.http_post(
        url := 'https://cthhlwvhmpvthpkivwps.supabase.co/functions/v1/game-alerts',
        body := '{}'::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists league_state_alerts on public.league_state;
create trigger league_state_alerts after update of data on public.league_state
for each row execute function public.league_state_alerts();
