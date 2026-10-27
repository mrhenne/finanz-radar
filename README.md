# Finanz-Radar

Persönliche Finanz-App für Cashflow, Vermögen, Krypto, FIRE, Prognosen und Steuern. Die App besteht aus HTML, CSS und JavaScript und benötigt keinen Build-Schritt.

**Live-App:** https://finanz-radar-app.vercel.app  
**Repository:** https://github.com/mrhenne/finanz-radar

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Einstieg, Metadaten, Supabase-JavaScript-Client (mit SRI und `defer`) |
| `styles.css` | Design und helles/dunkles Theme |
| `config.js` | Öffentliche Supabase-Project-URL und Publishable Key (keine Geheimnisse) |
| `app.js` | Zustand `S`, Speichern, Synchronisierung, Anmeldung, Ansichten Home/Cashflow/Vermögen/FIRE/Mehr, Diagramme, Kurse, fachliche Konstanten |
| `features.js` | Erweiterungen: Monatsrückblick, Fuck-Off-Rechner, Prognose-Reiter, PIN-Sperre, Runway-Stufen |
| `extras.js` | Sparplan-Check, Vorschau nächste 3 Monate, Monatsabschluss, Schnellerfassung (+), CSV-Import, Datenschutz & Auto-Sicherungen |
| `boost.js` | Fokus-Home, Job-Szenarien, Passives Einkommen, Design-Automatik, Offline-Hinweis, Service-Worker-Registrierung |
| `sw.js` | Service Worker: App offline startbar, `VERSION` steuert den Cache |
| `manifest.webmanifest`, `icon-*.png`, `splash/` | Installierbare App (PWA), Startbilder für iPhone |
| `schema.sql` | Tabelle, explizite Data-API-Rechte und Row Level Security |
| `vercel.json` | Sicherheitsheader (CSP, HSTS, COOP, CORP) und Cache-Regeln |
| `tests/` | Automatische Prüfungen (Node, ohne npm), Harness, Fixtures, Messung, UI-Matrix |
| `CHANGELOG.md` | Änderungen der Endkontrolle |

### Ladereihenfolge

`index.html` lädt das Supabase-Skript (mit SRI), dann `config.js`, `app.js`, `features.js`, `extras.js`, `boost.js`. Alle Skripte haben `defer`; die Reihenfolge bleibt erhalten. Supabase muss vor `app.js` laufen, weil `app.js` beim Laden `window.supabase.createClient` aufruft. `app.js`, `features.js`, `extras.js` und `boost.js` rufen am Ende je einmal `render()` auf. Spätere Dateien ersetzen Funktionen über `window` (z. B. `W.render`, `W.theme`, `W.bars`).

## Supabase einrichten

Für Finanz-Radar ist das bestehende Supabase-Projekt **Liquid-Wealth** in der Region Frankfurt (EU Central) vorgesehen. Nicht versehentlich ein zweites Projekt anlegen.

Im Projekt existiert bereits die ältere Tabelle `public.user_state` mit eigenen RLS-Regeln. Sie bleibt unangetastet. Diese Version von Finanz-Radar verwendet ausschließlich `public.finance_state`; die alte Tabelle sollte erst nach einer gesonderten Prüfung entfernt werden.

1. Stelle sicher, dass das Projekt aktiv ist.
2. Öffne den SQL Editor des Projekts und führe den Inhalt von `schema.sql` aus. Das Skript erstellt `public.finance_state`, aktiviert RLS, setzt die Tabellenrechte und erstellt die vier eigenen Nutzer-Policies. Es löscht keine Finanzdatensätze. Die vier gleichnamigen Policies werden bei erneuter Ausführung ersetzt.
3. Kopiere die Project URL sowie den öffentlichen **Publishable Key** aus den Supabase-Projekteinstellungen in `config.js`. Der Schlüssel beginnt üblicherweise mit `sb_publishable_`. Ein alter öffentlicher `anon`-Key ist nur für Kompatibilität vorgesehen. **Niemals einen `service_role`- oder Secret-Key in diese Datei, in GitHub oder in den Browser eintragen.**
4. Öffne in Supabase **Authentication → URL Configuration**. Setze die **Site URL** auf `https://finanz-radar-app.vercel.app` und füge unter **Redirect URLs** mindestens `https://finanz-radar-app.vercel.app/**` hinzu. Login-Link, E-Mail-Bestätigung und Passwort-Reset müssen auf die App zurückführen.
5. Lasse die E-Mail-Bestätigung zunächst aktiviert. Registriere ein Testkonto, bestätige die E-Mail und prüfe Anmeldung, Magic Link, Passwort-Reset und Passwortänderung. Du kannst die Bestätigung später bewusst anpassen, wenn du den gewünschten Ablauf getestet hast.

`config.js` enthält die Project-URL und den öffentlichen Publishable Key. Beides ist öffentlich und darf im Repo stehen. Ein `service_role`- oder Secret-Key gehört nie dorthin. Der Secret-Scan (`tests/check-secrets.sh`) und die CI prüfen das.

## Anmeldung und Cloud-Synchronisierung

Die App unterstützt Registrierung, Anmeldung per E-Mail und Passwort, Login-Link, Passwort-Reset und Passwortänderung sowie Abmeldung.

Nach erfolgreicher Anmeldung wird ein Datensatz pro Nutzer in `finance_state` gespeichert. Hochgeladen wird erst, nachdem der Cloud-Stand gelesen wurde. Beim Anmelden vergleicht die App lokale und Cloud-Zeitstempel; der neuere Stand wird verwendet (der letzte Upload gewinnt). Vor jedem Überschreiben einer Fassung legt die App eine Sicherung unter **Mehr → Datenschutz → Sicherungen** ab: „vor Cloud-Abgleich“ für ungesicherte lokale Änderungen, „Cloud-Stand vor Überschreiben“ für die überschriebene Cloud-Fassung. Scheitert ein Upload, wird er bei der nächsten Änderung, nach Rückkehr der Verbindung oder manuell erneut versucht; es gibt keinen automatischen Wiederholungs-Timer.

Beim Wechsel zu einem anderen Konto werden lokale App-Daten des vorherigen Kontos vor dem Cloud-Abgleich verworfen. Das ist bewusst so entschieden und im Bericht als Entscheidung für Henne offen geführt.

### Vorhandene ältere Cloud-Daten

In diesem Supabase-Projekt existiert bereits ein älterer Datensatz in `public.user_state`. Er bleibt unverändert erhalten. Das ältere Datenformat ist nicht identisch mit dem aktuellen Finanz-Radar-Datenmodell. Wenn für einen Nutzer noch kein Datensatz in `finance_state` existiert, prüft die App zuerst `user_state` und pausiert eine erstmalige Cloud-Synchronisierung, wenn dort ältere Daten gefunden werden. Erst nach deiner bewussten Auswahl in der App wird der aktuelle lokale Finanz-Radar-Datenstand in `finance_state` angelegt. Der ältere Datensatz wird dabei **nicht** automatisch konvertiert, gelöscht oder überschrieben.

**Wichtig:** Vor der ersten Anmeldung mit wichtigen Daten bitte über **Mehr → Daten & Backup → Export** ein Backup erstellen. Der Import wird vor dem Ersetzen der aktuellen Daten bestätigt und prüft die Struktur der JSON-Datei. Gefährliche HTML-Zeichen und ungültige Datensatz-IDs werden beim Laden/Import bereinigt. Der Import ist auf 2 MB begrenzt.

## Datensicherheit

- Die Tabelle hat Row Level Security aktiviert. Policies erlauben Zugriff nur, wenn `auth.uid() = user_id`.
- Die Data-API-Rechte werden ausdrücklich nur der Rolle `authenticated` gewährt. `anon` erhält keine direkten Tabellenrechte.
- Der Client verwendet ausschließlich einen öffentlichen Publishable Key. Datenzugriffsschutz wird durch Supabase Auth, Tabellenrechte und RLS erzwungen, nicht durch das Verstecken des Keys.
- Nach der Einrichtung die Supabase Security Advisors kontrollieren und mit zwei getrennten Testkonten prüfen, dass jedes Konto nur seine eigenen Daten lesen und ändern kann.
- Der Supabase Security Advisor meldet derzeit außerdem deaktivierten Schutz gegen bekannte kompromittierte Passwörter. Aktiviere **Authentication → Settings/Password Security → Leaked Password Protection** im Dashboard.
- Eine öffentliche Vercel-Adresse ist erreichbar. Persönliche Finanzdaten sollten erst synchronisiert werden, nachdem Login und Datenisolation erfolgreich getestet wurden.
- Die **PIN-Sperre** ist ein Sichtschutz auf dem Gerät. Die PIN wird mit PBKDF2-SHA-256 (310.000 Iterationen, Zufallssalt) gespeichert; alte PIN-Einträge bleiben gültig und werden beim nächsten Entsperren umgestellt. Nach Fehlversuchen steigt die Sperrzeit (30 s, 60 s, 120 s … höchstens 15 min).
- Die Daten liegen unverschlüsselt im `localStorage` des Geräts. Wer die Entwicklerwerkzeuge des Geräts öffnet, kommt an die Daten. Die Sperre ersetzt keine Verschlüsselung.
- Die CSP erlaubt `'unsafe-inline'`, weil die Oberfläche noch Inline-Handler (`onclick`) nutzt. Der XSS-Schutz hängt deshalb an `esc()` (siehe Regeln unten).

## Lokale Schlüssel (nur auf dem Gerät, nicht in der Cloud)

| Schlüssel | Inhalt | Beim Abmelden mit „lokale Daten löschen“ |
|---|---|---|
| `fr_s` | Stand der App (Datenmodell `S`) | gelöscht |
| `fr_dirty` | `1`, solange lokale Änderungen noch nicht hochgeladen sind. Wird nach erfolgreichem Upload gelöscht, sofern währenddessen nichts geändert wurde | gelöscht |
| `fr_s_defekt`, `fr_s_defekt_<Zeitstempel>` | Rohdaten eines nicht lesbaren lokalen Stands. Werden gesichert, bevor die App mit leerem Stand startet | gelöscht |
| `fr_bk` | bis zu 5 Sicherungen. Feld `k`: `vor-cloud` oder `cloud`; alte Einträge ohne `k` bleiben gültig | gelöscht |
| `fr_exp` | Zeitpunkt des letzten Datei-Backups | gelöscht |
| `fr_pin` | PIN-Eintrag (PBKDF2, Version 2) und Fehlversuche | bleibt (Entscheidung offen) |
| `fr_sec` | Datenschutz-Einstellungen (Sichtschutz, Auto-Sperre) | bleibt |
| `fr_cg` | Kursverlauf-Cache (nur Kurse) | bleibt |

## Prüfen

```sh
sh tests/run-all.sh
```

Der Befehl prüft die Syntax aller JavaScript-Dateien im Wurzelverzeichnis und in `tests/`, führt alle Tests aus (inklusive Unterordner `tests/perf`, `tests/harness`, `tests/ui`) und startet den Secret-Scan über alle versionierten Dateien. Er braucht Node 22 oder neuer, aber kein npm und keinen Build-Schritt.

Die GitHub-Action `.github/workflows/validate.yml` führt dieselben Prüfungen aus und zusätzlich:

- Erreichbarkeit des Supabase-CDN-Skripts und Vergleich des SRI-Hashs mit `index.html` (braucht Netz),
- eine Konfigurationsprüfung (URL, Publishable Key, `defer`, Skript-Reihenfolge, Policies in `schema.sql`),
- die VERSION-Prüfung: Wurden ausgelieferte Dateien gegenüber der Basis geändert, muss `VERSION` in `sw.js` erhöht sein.

Weitere Werkzeuge:

- `node tests/perf/measure.cjs`: Laufzeiten und DOM-Zähler mit der Extrem-Fixture (5.000 Buchungen, erfundene Werte).
- `node tests/ui/shoot.cjs`: Screenshots und DOM-Audit in Chrome (siehe `tests/ui/README.md`).

## Regeln für Änderungen

- **Nutzertext immer mit `esc()` ausgeben** (escaped `& < > " ' \``). Attribute und Argumente in `onclick` nie aus Rohtext bauen.
- **Keine `toISOString()` für Kalendertage.** Das liefert UTC und verschiebt Buchungen am Monatsersten in den Vormonat. Stattdessen `ymdOf()`, `ymOf()` oder `ldate()` aus `app.js` verwenden.
- **Jede Änderung an einer ausgelieferten Datei** (`index.html`, `styles.css`, `config.js`, `app.js`, `features.js`, `extras.js`, `boost.js`, `manifest.webmanifest`, `sw.js`) erhöht `VERSION` in `sw.js`. Die CI prüft das.
- **Fachliche Werte** (Steuersätze, Freibeträge, Limits, Fristen) stehen als benannte Konstanten möglichst am Anfang der Datei. Änderungen nur zusammen mit dem zugehörigen Test.
- **Ablauf:** Backup (Export) → ändern → testen (`sh tests/run-all.sh`) → Diff ein zweites Mal lesen → Zusammenfassung mit geänderten Dateien und Auswirkungen.
- Datenmodell `S`, lokale Schlüssel und `schema.sql` nur nach ausdrücklicher Freigabe ändern.

## Sichtbare Änderungen aus der Endkontrolle

- **Sparquote** ohne Einnahmen zeigt „–“ statt „0 %“ (Home, Monatsrückblick, Jahr).
- **Beträge:** kein „NaN €“, kein „-0 €“. Eine Erstattung in einer Ausgabenkategorie zeigt ein Plus.
- **Haltefrist** Krypto/Gold: Am Jahrestag des Kaufs gilt das Lot noch als Haltefrist. Die Anzeige nennt das späteste Ende.
- **Monat übernehmen:** Der 29. bis 31. wird auf den letzten Tag des Zielmonats gesetzt (kein 31.02.).
- **Historie:** Je Monat erscheint ein Eintrag, Verlauf und Rückblick zeigen dieselbe Auswahl.
- **Synchronisierung:** Ungesicherte lokale Änderungen werden vor dem Laden der Cloud gesichert, nicht still verworfen. Die Sicherungen-Liste enthält dafür Einträge „vor Cloud-Abgleich“ und „Cloud-Stand vor Überschreiben“.
- **Kaputter lokaler Stand:** Die Rohdaten werden als `fr_s_defekt` gesichert, bevor die App startet.
- **PIN:** Neues Verfahren mit Salt, alte PINs bleiben gültig. Fehlversuche werden dauerhaft gezählt.
- **CSV-Import:** Ungültige Kalendertage (z. B. 31.02.) werden übersprungen. Mehr als 1.500 Zeilen werden in der Vorschau gemeldet.
- **Bedienung:** Schaltflächen und Eingabefelder mindestens 44 px hoch, Eingabefelder mit 16 px Schrift (kein Zoom auf dem iPhone), sichtbarer Tastaturfokus. Die Schnellerfassung schließt mit Esc und gibt den Fokus an den „+“-Button zurück.
- **Farben:** Textfarben nach WCAG AA. Kategorie-Farben stehen nur im Marker.
- **Texte:** „Vorlagen anwenden“, „Konto & Synchronisierung“.
- **App-Icon:** maskierbar (`any maskable`).

## Bekannte Grenzen

Offene Entscheidungen und Restrisiken stehen in `ENDKONTROLLE-BERICHT.md`. Die wichtigsten: Last-Write-Wins bei zwei Geräten, Kontowechsel verwirft ungesyncte Daten des alten Kontos, Schulden ohne Zins und Tilgung, Steuerannahmen ohne Verlustverrechnung und Kirchensteuer.

## Fachliche Regeln (bitte bei Änderungen beibehalten)

- **Sparquote** = Summe der Buchungen der Kategorie `Sparen/Invest` ÷ Einnahmen des Monats (nur investiertes Geld, nicht Cashflow ÷ Einnahmen). Gilt in Home, Monatsrückblick und Jahresübersicht. Hilfsfunktion: `invSum()` in `app.js`.
- **Buchungs-Feed** (Cashflow): nach Kategorie gruppiert, Kategorien nach Summe absteigend, darin Beträge absteigend (`feedHTML()` in `app.js`).
- **Prognose-Reiter**: Block „Prognose-Reiter nach Vorbild Prognose Radar“ in `features.js`. Alle Element-IDs beginnen mit `pr_`, Zustand liegt in `PR`, gespeicherte Pläne in `S.prPlans` (werden mit dem Datenstand synchronisiert).
- Der frühere Bereich „Fuck You“ heißt überall **„Fuck Off“**.
- **Blur** („◉“-Schalter): `blurHtml()` in `app.js` umhüllt automatisch jede Zahl mit €, %, Jahre/Monate in der Ansicht mit `<span class="n">`; SVG-Texte übernimmt `blurNums()`. Neue Ansichten brauchen dafür keine Sonderregeln.
- **Neue Datenfelder** (alle unter `S`, werden mit synchronisiert): `S.spl` (Sparziel), `S.mnotes` (Monatsnotizen), `S.msn` (Meilenstein-Notizen), `S.prPlans` (Prognose-Pläne), `S.lastImp` (letzter CSV-Import für „Rückgängig“).
- **Nur auf dem Gerät gespeichert** (nicht in der Cloud): `fr_pin`, `fr_sec` (Datenschutz-Einstellungen), `fr_bk` (die letzten 5 automatischen Tagessicherungen), `fr_exp` (Zeitpunkt des letzten Datei-Backups).
- **Schnellerfassung**: Der „+“-Button unten rechts öffnet ein Sheet; Kategorie-Vorschlag aus früheren Buchungen und Stichworten (`suggestCat()` in `extras.js`).

## Veröffentlichen und testen

Die produktive App läuft bei Vercel: https://finanz-radar-app.vercel.app. Jeder Commit auf `main` stößt ein neues Deployment an.

Vor dem Push: `sh tests/run-all.sh` muss grün sein. Nach App-Änderungen diese Punkte überprüfen:

1. Die Tabs Home, Cashflow, Vermögen, FIRE, Prognose und Mehr öffnen.
2. Buchungen, Vermögenswerte, Ziele, Backup-Export und Backup-Import testen.
3. Nach der Supabase-Konfiguration Anmeldung und Synchronisierung mit zwei getrennten Testkonten testen.
4. Browser-Konsole, Vercel-Deployment und Supabase Security Advisors auf Fehler prüfen.
5. Nach dem Deployment: Service Worker übernimmt die neue Version beim zweiten Aufruf (`VERSION` in `sw.js` prüfen).
