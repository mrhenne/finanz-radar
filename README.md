# Finanz-Radar

Mobile-first Finanzübersicht als statische Einzeldatei-App.

## Live-Deployment

- **Vercel:** https://finanz-radar-app.vercel.app
- **GitHub:** https://github.com/mrhenne/finanz-radar
- **Produktions-Branch:** `main`

Vercel ist mit diesem Repository verbunden. Jeder Push auf `main` startet automatisch einen neuen Build und ein Deployment. Die App besteht aus `index.html` und benötigt aktuell weder einen Paketmanager noch einen Build-Schritt.

## Daten und Backups

Aktuell sind `SB_URL` und `SB_KEY` in `index.html` leer. Die App läuft daher im lokalen Modus und speichert Daten im `localStorage` des jeweiligen Browsers. Es gibt derzeit keine geräteübergreifende Synchronisierung.

- Exportiere regelmäßig eine JSON-Sicherung unter **Mehr → Daten & Backup**.
- Browserdaten sind nicht dasselbe wie eine Cloud-Sicherung. Ein gelöschter Browser-Speicher kann Daten entfernen.
- Nutze die App für private Daten nur in einem geschützten Benutzerprofil und auf eigenen Geräten.

## Supabase: noch nicht aktiviert

`schema.sql` ist ein Entwurf für die spätere Datenbankeinrichtung. Führe ihn erst aus, nachdem Schema, Authentifizierung, Redirect-URLs und Row-Level-Security gemeinsam geprüft wurden.

Vor der Aktivierung müssen wir mindestens Folgendes erledigen:

1. Supabase-Projekt in einer EU-Region auswählen oder anlegen.
2. SQL und RLS-Policies prüfen und testen.
3. Authentifizierung und Registrierung festlegen.
4. Die Frontend-Konfiguration so lösen, dass keine geheimen Server-Schlüssel im Browser landen.
5. Zwei getrennte Testkonten verwenden und nachweisen, dass kein Konto fremde Daten lesen oder ändern kann.
6. Export, Import und Wiederherstellung testen.

**Wichtig:** Niemals einen Supabase `service_role`- oder Secret-Key in `index.html`, in GitHub oder in eine öffentliche Frontend-Konfiguration eintragen. Ein Publishable-/Anon-Key darf erst zusammen mit funktionierenden RLS-Policies veröffentlicht werden.

## iPhone

In Safari öffnen, **Teilen → Zum Home-Bildschirm** wählen. Damit lässt sich die App wie eine Web-App vom Home-Bildschirm starten.

## Projektstruktur

- `index.html`: Oberfläche, Berechnungen und derzeit lokale Speicherung
- `schema.sql`: Datenbankschema-Entwurf für den späteren Supabase-Schritt
- `vercel.json`: Sicherheits-Header für die ausgelieferte Seite
