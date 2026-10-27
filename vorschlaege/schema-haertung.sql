-- VORSCHLAG (nicht ausführen). Härtung für public.finance_state, ergänzend zu schema.sql.
-- Stand: Endkontrolle 2026-10-26. Vor einer Anwendung im Supabase-Projekt (Liquid-Wealth) prüfen,
-- ob die Live-Tabelle dem Stand von schema.sql entspricht, und mit einem Testkonto gegenprüfen.
-- Die Datei ändert keine Daten. Die Tabelle user_state wird nicht angefasst.

-- 1) Größenbegrenzung für den JSON-Datensatz (Schutz vor übergroßen Uploads).
--    Der Client begrenzt Backup-Importe auf 2 MB; diese Grenze gilt zusätzlich serverseitig.
alter table public.finance_state
  add constraint finance_state_data_size_check
  check (pg_column_size(data) < 5000000);

-- 2) user_id mit auth.uid() vorbelegen. Ein Insert ohne user_id erhält so den eigenen Nutzer.
--    Die bestehende RLS-Prüfung (with check auth.uid() = user_id) bleibt unverändert.
alter table public.finance_state
  alter column user_id set default auth.uid();

-- 3) Optional: updated_at serverseitig setzen.
--    ACHTUNG: Die App vergleicht Cloud- und Lokalzeitstempel (Last-Write-Wins) und sendet updated_at selbst.
--    Dieser Trigger würde den Client-Zeitstempel überschreiben. Vor der Aktivierung app.js anpassen
--    oder den Trigger weglassen.
-- create or replace function public.finance_state_touch()
-- returns trigger language plpgsql set search_path = '' as $$
-- begin
--   new.updated_at := now();
--   return new;
-- end;
-- $$;
-- drop trigger if exists finance_state_touch on public.finance_state;
-- create trigger finance_state_touch
--   before update on public.finance_state
--   for each row execute function public.finance_state_touch();

-- 4) Hinweis zu Funktionen im Schema public: Die Funktion oben nutzt search_path = '' und
--    vollqualifizierte Namen. Für neue Funktionen dasselbe Muster verwenden.

-- 5) Rechte der Rolle authenticated, die RLS nicht abdeckt.
--    Live-Prüfung durch Claude am 27.10.2026: authenticated hat auf public.finance_state die Rechte
--    TRUNCATE, REFERENCES und TRIGGER. RLS greift bei TRUNCATE nicht, und die Data API bietet TRUNCATE
--    nicht an. Das Risiko ist daher niedrig; das Entziehen ist Best Practice.
--    Gilt analog für public.user_state (dort nicht angefasst, nur hier erwähnt).
revoke truncate, references, trigger on table public.finance_state from authenticated;
