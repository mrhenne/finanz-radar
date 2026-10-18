# Finanz-Radar

Einzeldatei-App (`index.html`), laeuft ohne Build auf GitHub Pages. Daten liegen lokal im Browser; mit Supabase-Login werden sie zusaetzlich verschluesselt uebertragen und geraeteuebergreifend synchronisiert.

## 1. Supabase
1. Projekt auf supabase.com anlegen.
2. SQL Editor: Inhalt von `schema.sql` ausfuehren (legt Tabelle + Row Level Security an: jeder sieht nur seine eigene Zeile).
3. Project Settings -> API: **Project URL** und **anon/publishable Key** kopieren (NIEMALS den service_role Key verwenden).
4. In `index.html` oben im Skript `SB_URL` und `SB_KEY` eintragen.
5. Authentication -> URL Configuration: **Site URL** = deine GitHub-Pages-Adresse (siehe unten). Optional unter Providers -> Email die Bestaetigungs-Mail abschalten.

## 2. GitHub
1. Neues Repository, alle Dateien dieses Ordners hochladen (inkl. `.github/workflows/pages.yml`).
2. Settings -> Pages -> Source: **GitHub Actions**.
3. Nach dem Push baut der Workflow die Seite: `https://<name>.github.io/<repo>/`.

## 3. iPhone
Seite in Safari oeffnen -> Teilen -> Zum Home-Bildschirm.

Ohne eingetragene Keys laeuft die App im lokalen Modus (kein Login).
