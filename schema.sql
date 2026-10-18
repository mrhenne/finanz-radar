-- Finanz-Radar: sichere, wiederholt ausfuehrbare Einrichtung.
-- Diese Datei loescht keine Daten aus finance_state.
-- Eine vorhandene public.user_state-Tabelle aus einer aelteren App bleibt unangetastet.
create table if not exists public.finance_state (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_state enable row level security;

-- Explizite Data-API-Rechte: Zugriff nur fuer angemeldete Nutzer.
revoke all on table public.finance_state from anon, PUBLIC;
grant select, insert, update, delete
  on table public.finance_state to authenticated;

-- Erlaubt eine erneute Ausfuehrung ohne Policy-Duplikate.
drop policy if exists "own select" on public.finance_state;
drop policy if exists "own insert" on public.finance_state;
drop policy if exists "own update" on public.finance_state;
drop policy if exists "own delete" on public.finance_state;

create policy "own select"
  on public.finance_state
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "own insert"
  on public.finance_state
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "own update"
  on public.finance_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own delete"
  on public.finance_state
  for delete to authenticated
  using ((select auth.uid()) = user_id);
