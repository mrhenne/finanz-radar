# Finanz-Radar

Persönliche Finanz-App für Cashflow, Vermögen, Krypto, FIRE, Prognosen und Steuern. Die App besteht aus HTML, CSS und JavaScript und benötigt keinen Build-Schritt.

**Live-App:** https://finanz-radar-app.vercel.app  
**Repository:** https://github.com/mrhenne/finanz-radar

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Einstieg, Metadaten und Supabase-JavaScript-Client |
| `styles.css` | Design und helles/dunkles Theme |
| `app.js` | App-Logik, Ansichten, Login, Daten-Backup und Synchronisierung |
| `config.js` | Öffentliche Supabase-Project-URL und Publishable Key |
| `schema.sql` | Tabelle, explizite Data-API-Rechte und Row Level Security |
| `vercel.json` | Sicherheitsheader für die Bereitstellung |

## Supabase einrichten

Für Finanz-Radar ist das bestehende Supabase-Projekt **Liquid-Wealth** in der Region Frankfurt (EU Central) vorgesehen. Nicht versehentlich ein zweites Projekt anlegen.

Im Projekt existiert bereits die ältere Tabelle `public.user_state` mit eigenen RLS-Regeln. Sie bleibt unangetastet. Diese Version von Finanz-Radar verwendet ausschließlich `public.finance_state`; die alte Tabelle sollte erst nach einer gesonderten Prüfung entfernt werden.

1. Stelle sicher, dass das Projekt aktiv ist.
2. Öffne den SQL Editor des Projekts und führe den Inhalt von `schema.sql` aus. Das Skript erstellt `public.finance_state`, aktiviert RLS, setzt die Tabellenrechte und erstellt die vier eigenen Nutzer-Policies. Es löscht keine Finanzdatensätze. Die vier gleichnamigen Policies werden bei erneuter Ausführung ersetzt.
3. Kopiere die Project URL sowie den öffentlichen **Publishable Key** aus den Supabase-Projekteinstellungen in `config.js`. Der Schlüssel beginnt üblicherweise mit `sb_publishable_`. Ein alter öffentlicher `anon`-Key ist nur für Kompatibilität vorgesehen. **Niemals einen `service_role`- oder Secret-Key in diese Datei, in GitHub oder in den Browser eintragen.**
4. Öffne in Supabase **Authentication → URL Configuration**. Setze die **Site URL** auf `https://finanz-radar-app.vercel.app` und füge unter **Redirect URLs** mindestens `https://finanz-radar-app.vercel.app/**` hinzu. Login-Link, E-Mail-Bestätigung und Passwort-Reset müssen auf die App zurückführen.
5. Lasse die E-Mail-Bestätigung zunächst aktiviert. Registriere ein Testkonto, bestätige die E-Mail und prüfe Anmeldung, Magic Link, Passwort-Reset und Passwortänderung. Du kannst die Bestätigung später bewusst anpassen, wenn du den gewünschten Ablauf getestet hast.

Die Zugangsdaten in `config.js` sind aktuell leer, bis das Projekt bereit und getestet ist. Nach einer Änderung an GitHub veröffentlicht Vercel die neue Version automatisch.

## Anmeldung und Cloud-Synchronisierung

Die App unterstützt Registrierung, Anmeldung per E-Mail und Passwort, Login-Link, Passwort-Reset und Passwortänderung sowie Abmeldung.

Nach erfolgreicher Anmeldung wird ein Datensatz pro Nutzer in `finance_state` gespeichert. Änderungen werden nach kurzer Verzögerung hochgeladen. Beim Anmelden vergleicht die App lokale und Cloud-Zeitstempel; der neuere Stand wird verwendet. Beim Wechsel zu einem anderen Konto werden lokale App-Daten des vorherigen Kontos vor dem Cloud-Abgleich verworfen.

**Wichtig:** Vor der ersten Anmeldung mit wichtigen Daten bitte über **Mehr → Daten & Backup → Export** ein Backup erstellen. Der Import wird vor dem Ersetzen der aktuellen Daten bestätigt und prüft die Struktur der JSON-Datei. Gefährliche HTML-Zeichen und ungültige Datensatz-IDs werden beim Laden/Import bereinigt. Der Import ist auf 2 MB begrenzt.

## Datensicherheit

- Die Tabelle hat Row Level Security aktiviert. Policies erlauben Zugriff nur, wenn `auth.uid() = user_id`.
- Die Data-API-Rechte werden ausdrücklich nur der Rolle `authenticated` gewährt. `anon` erhält keine direkten Tabellenrechte.
- Der Client verwendet ausschließlich einen öffentlichen Publishable Key. Datenzugriffsschutz wird durch Supabase Auth, Tabellenrechte und RLS erzwungen, nicht durch das Verstecken des Keys.
- Nach der Einrichtung die Supabase Security Advisors kontrollieren und mit zwei getrennten Testkonten prüfen, dass jedes Konto nur seine eigenen Daten lesen und ändern kann.
- Der Supabase Security Advisor meldet derzeit außerdem deaktivierten Schutz gegen bekannte kompromittierte Passwörter. Aktiviere **Authentication → Settings/Password Security → Leaked Password Protection** im Dashboard.
- Eine öffentliche Vercel-Adresse ist erreichbar. Persönliche Finanzdaten sollten erst synchronisiert werden, nachdem Login und Datenisolation erfolgreich getestet wurden.

## Veröffentlichen und testen

Die produktive App läuft bei Vercel: https://finanz-radar-app.vercel.app. Jeder Commit auf `main` stößt ein neues Deployment an.

Nach App-Änderungen diese Punkte überprüfen:

1. Die Tabs Home, Cashflow, Vermögen, FIRE, Prognose und Mehr öffnen.
2. Buchungen, Vermögenswerte, Ziele, Backup-Export und Backup-Import testen.
3. Nach der Supabase-Konfiguration Anmeldung und Synchronisierung mit zwei getrennten Testkonten testen.
4. Browser-Konsole, Vercel-Deployment und Supabase Security Advisors auf Fehler prüfen.

