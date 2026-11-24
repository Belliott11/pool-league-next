-- Same policies, same logic: auth.uid() wrapped in a select so Postgres evaluates it once per query instead of once per row
-- (Supabase performance advisor, auth_rls_initplan). Plus an index for league_state.updated_by (unindexed_foreign_keys).
alter policy "an account can see its own admin row" on public.admins
  using (user_id = (select auth.uid()));

alter policy "editors can insert" on public.league_state
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
alter policy "editors can update" on public.league_state
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

alter policy "editors can add history" on public.league_state_history
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
alter policy "editors can read history" on public.league_state_history
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

alter policy "editors can add labels" on public.private_labels
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
alter policy "editors can change labels" on public.private_labels
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
alter policy "editors can read labels" on public.private_labels
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create index if not exists league_state_updated_by_idx on public.league_state (updated_by);
