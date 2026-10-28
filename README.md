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
| `vercel.json` | Sicherheitsheader (CSP ohne `'unsafe-inline'` bei Skripten, `script-src-attr 'none'`, HSTS, COOP, CORP) und Cache-Regeln |
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

Nach erfolgreicher Anmeldung wird ein Datensatz pro Nutzer in `finance_state` gespeichert. Hochgeladen wird erst, nachdem der Cloud-Stand gelesen wurde. Ist der Cloud-Stand neuer als der bekannte Stand, liegen auf dem Gerät ungesicherte Änderungen (`fr_dirty`) und unterscheidet sich der Inhalt, überschreibt die App nichts. Verglichen werden nur Fachdaten (`tx`, `as`, `goals`, `rec`, `debts`, `hist`, `sales`, `f`, `spl`, `mnotes`, `msn`, `prPlans`, `lastImp`, `pi`). Darstellung (`ui`, `th`, `hide`) löst keinen Dialog aus. Die Synchronisierung pausiert, ein Banner erklärt das, und ein Dialog bietet drei Wege: **Cloud-Stand übernehmen** (lokale Fassung vorher in die Sicherungen), **Diesen Stand behalten** (Cloud-Fassung vorher in die Sicherungen, danach hochladen) oder **Später entscheiden** (nichts ändern, die Synchronisierung bleibt pausiert). Zusammengeführt wird nicht. Ohne ungesicherte Änderungen oder bei gleichem Inhalt gibt es keinen Dialog; die Cloud-Fassung wird dann geladen. Sicherungen liegen unter **Mehr → Datenschutz → Sicherungen**: „vor Cloud-Abgleich“ für lokale Fassungen, „Cloud-Stand vor Überschreiben“ für verdrängte Cloud-Fassungen.

Scheitert ein Upload wegen Netz, Zeitüberschreitung oder Serverfehler (5xx), wird er nach 5 s, 15 s, 45 s und 2 min erneut versucht, insgesamt fünf Versuche. Bei den Ereignissen „wieder online“ und Rückkehr in den Vordergrund wird sofort erneut versucht, wenn etwas aussteht. Der Sync-Status im Konto zeigt die Restzeit. Bei 401, 403 und 413 wird nicht erneut versucht; die Meldung nennt die Ursache. Nach fünf erfolglosen Versuchen wartet die App auf eine Änderung, auf Netzrückkehr oder auf „Jetzt hochladen“.

Beim Wechsel zu einem anderen Konto prüft die App, ob auf dem Gerät ungesicherte Änderungen des vorherigen Kontos liegen. Wenn ja, fragt sie: **als Datei sichern und wechseln**, **verwerfen und wechseln** oder **abbrechen** (dann wird das neue Konto abgemeldet und der bisherige Stand bleibt unverändert). Ohne ungesicherte Änderungen wechselt die App direkt. Daten des vorherigen Kontos erscheinen nie im neuen Konto und werden nie in dessen Cloud hochgeladen.

### Vorhandene ältere Cloud-Daten

In diesem Supabase-Projekt existiert bereits ein älterer Datensatz in `public.user_state`. Er bleibt unverändert erhalten. Das ältere Datenformat ist nicht identisch mit dem aktuellen Finanz-Radar-Datenmodell. Wenn für einen Nutzer noch kein Datensatz in `finance_state` existiert, prüft die App zuerst `user_state` und pausiert eine erstmalige Cloud-Synchronisierung, wenn dort ältere Daten gefunden werden. Erst nach deiner bewussten Auswahl in der App wird der aktuelle lokale Finanz-Radar-Datenstand in `finance_state` angelegt. Der ältere Datensatz wird dabei **nicht** automatisch konvertiert, gelöscht oder überschrieben.

**Wichtig:** Vor der ersten Anmeldung mit wichtigen Daten bitte über **Mehr → Daten & Backup → Export** ein Backup erstellen. Der Import wird vor dem Ersetzen der aktuellen Daten bestätigt und prüft die Struktur der JSON-Datei sowie jeden Datensatz: Datumsfelder sind echte Kalendertage (YYYY-MM-DD, Monate YYYY-MM), Beträge endliche Zahlen bis 1 Mrd. € (Textbeträge wie „12,50“ nur bei eindeutigem Format), unbekannte Kategorien werden „Sonstiges“. Bei Schulden werden Zins (0 bis 100 %) und Rate (ab 0 €) geprüft; ein ungültiges Feld wird entfernt und als korrigiert gemeldet. Ungültige Datensätze werden verworfen; die Meldung nennt Anzahl und Gründe. Die Nutzerkennung (`uid`) wird weder exportiert noch übernommen. Gefährliche HTML-Zeichen und ungültige Datensatz-IDs werden beim Laden/Import bereinigt. Der Import ist auf 2 MB begrenzt.

## Datensicherheit

- Die Tabelle hat Row Level Security aktiviert. Policies erlauben Zugriff nur, wenn `auth.uid() = user_id`.
- Die Data-API-Rechte werden ausdrücklich nur der Rolle `authenticated` gewährt. `anon` erhält keine direkten Tabellenrechte.
- Der Client verwendet ausschließlich einen öffentlichen Publishable Key. Datenzugriffsschutz wird durch Supabase Auth, Tabellenrechte und RLS erzwungen, nicht durch das Verstecken des Keys.
- Nach der Einrichtung die Supabase Security Advisors kontrollieren und mit zwei getrennten Testkonten prüfen, dass jedes Konto nur seine eigenen Daten lesen und ändern kann.
- Der Supabase Security Advisor meldet derzeit außerdem deaktivierten Schutz gegen bekannte kompromittierte Passwörter. Aktiviere **Authentication → Settings/Password Security → Leaked Password Protection** im Dashboard.
- Eine öffentliche Vercel-Adresse ist erreichbar. Persönliche Finanzdaten sollten erst synchronisiert werden, nachdem Login und Datenisolation erfolgreich getestet wurden.
- Die **PIN-Sperre** ist ein Sichtschutz auf dem Gerät. Die PIN wird mit PBKDF2-SHA-256 (310.000 Iterationen, Zufallssalt) gespeichert; alte PIN-Einträge bleiben gültig und werden beim nächsten Entsperren umgestellt. Nach Fehlversuchen steigt die Sperrzeit (30 s, 60 s, 120 s … höchstens 15 min).
- Die Daten liegen unverschlüsselt im `localStorage` des Geräts. Wer die Entwicklerwerkzeuge des Geräts öffnet, kommt an die Daten. Die Sperre ersetzt keine Verschlüsselung.
- Die CSP erlaubt nur Skripte aus der App und dem Supabase-CDN (`script-src 'self' https://cdn.jsdelivr.net`) und keine Inline-Ereignisattribute (`script-src-attr 'none'`). Die Oberfläche arbeitet ohne Inline-Handler. `style-src` erlaubt weiterhin `'unsafe-inline'`, weil es rund 150 `style=`-Attribute gibt (Restrisiko, siehe Bericht 14.4). Der XSS-Schutz hängt an `esc()` und an `act()` (siehe Regeln unten).

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
- `node tests/ui/smoke.cjs`: Browser-Smoketest über CDP mit der CSP aus `vercel.json` (18 Schritte, Konsole und CSP-Verletzungen werden je Schritt geprüft; siehe `tests/ui/README.md`).

## Regeln für Änderungen

- **Nutzertext immer mit `esc()` ausgeben** (escaped `& < > " ' \``). Argumente in Aktionen nie aus Rohtext bauen: `act()` legt sie als JSON im Attribut ab und escaped sie.
- **Keine Inline-Handler (`onclick` etc.) mehr; Aktionen über `data-click`/`data-args` und Registrierung.** Ein Element nennt die Funktion mit `act(name, [args], ereignis)`, die Funktion steht in `ACTS` (app.js) und ist eine `function`-Deklaration (nicht `const`), damit der Dispatcher sie am Fenster findet. Beispiel:

  ```js
  // Vorlage (Ansicht): Klick mit Nutzer-ID, Eingabe mit Elementwert
  `<button class="btn x" ${act('del', ['tx', x.id])}>×</button>`
  `<input aria-label="Name" ${act('setSchuldName', [d.id, '$value'], 'change')}>`
  // app.js: Name in ACTS aufnehmen, Funktion als Deklaration
  const ACTS = new Set([..., 'setSchuldName']);
  function setSchuldName(id, v) { const d = S.debts.find(x => x.id === id); if (d) { d.n = clean(v); save(); render(); } }
  ```

  Platzhalter: `'$value'` (Wert), `'$checked'` (Haken), `'$el'` (Element), `'$event'` (Ereignis). Mehrere Anweisungen gehören in eine benannte Funktion. `tests/aktionen.test.cjs` und `tests/handler-statisch.test.cjs` prüfen die Registrierung und das Fehlen von `on*`-Attributen.
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
- **Konflikt (B-03):** Vorher überschrieb der letzte Upload eine neuere Cloud-Fassung. Nachher pausiert die Synchronisierung und fragt nach einer Entscheidung.
- **Teil B (Inline-Handler):** keine sichtbaren Änderungen. Die Oberfläche ist vor und nach dem Umbau bytegleich gerendert (Screenshots von 6 Ansichten, Schnellerfassung, CSV-Import, PIN und Login, je Breite und Design).
- **Kontowechsel (B-25):** Vorher wurden ungesicherte Änderungen des alten Kontos still verworfen. Nachher fragt die App vorher.
- **Upload-Fehler (B-24):** Vorher kein Neuversuch. Nachher automatische Versuche mit Restzeit im Konto-Status; bei 401, 403 und 413 keine Wiederholung, sondern eine Meldung mit Ursache.
- **Kaputter lokaler Stand:** Die Rohdaten werden als `fr_s_defekt` gesichert, bevor die App startet.
- **PIN:** Neues Verfahren mit Salt, alte PINs bleiben gültig. Fehlversuche werden dauerhaft gezählt.
- **CSV-Import:** Ungültige Kalendertage (z. B. 31.02.) werden übersprungen. Mehr als 1.500 Zeilen werden in der Vorschau gemeldet.
- **Bedienung:** Schaltflächen und Eingabefelder mindestens 44 px hoch, Eingabefelder mit 16 px Schrift (kein Zoom auf dem iPhone), sichtbarer Tastaturfokus. Die Schnellerfassung schließt mit Esc und gibt den Fokus an den „+“-Button zurück.
- **Farben:** Textfarben nach WCAG AA. Kategorie-Farben stehen nur im Marker.
- **Texte:** „Vorlagen anwenden“, „Konto & Synchronisierung“.
- **App-Icon:** maskierbar (`any maskable`).
- **Konflikt-Vergleich (A1-Nachbesserung):** Vorher löste eine reine Änderung von Design oder Panel-Zuständen den Konfliktdialog aus. Nachher zählen nur Fachdaten.
- **Backup-Import (S-17):** Vorher wurden ungültige Daten still übernommen, Textbeträge wie „12,50“ wurden zu 0. Nachher verwirft der Import ungültige Datensätze und meldet Anzahl und Gründe („X übernommen, Y verworfen“). Textbeträge werden bei eindeutigem Format übernommen, unbekannte Kategorien werden „Sonstiges“.
- **Backup-Export (S-18):** Vorher enthielt die Datei die Nutzerkennung. Nachher nicht mehr; ein Import ignoriert eine Kennung aus der Datei.
- **Ausgaben-Basis (B-16):** Vorher rechnete der Fuck-Off-Rechner ohne Ausgaben-Eingabe mit den Fixkosten (900 € im Beispiel), die Fuck-Off-Zahl mit Ø Ausgaben. Nachher nutzen beide das Ausgaben-Feld, sonst Ø Ausgaben; die Ansicht nennt die Basis („Basis: Ø Ausgaben 943 €/Monat“ bzw. „Basis: eigene Eingabe“). Notgroschen und Runway nutzen weiter die Fixkosten.
- **Steuer-Annahmen (B-17):** Teilfreistellung (30, 15 oder 0 %) und Kirchensteuer (keine, 8 oder 9 %) sind in Prognose und Fuck-Off-Rechner wählbar. Standard bleibt 30 % und keine Kirchensteuer. Der Tab Steuer listet alle Annahmen an einer Stelle.
- **Schulden mit Zins und Tilgung (B-19):** Vorher nur Name und Betrag. Nachher optional Zins (% p. a.) und monatliche Rate. Mit beiden Feldern zeigt die Schuld Laufzeit, Ende, Zinsen bis zum Ende und Restschuld in 12 Monaten. Ohne die Felder bleibt die Anzeige wie bisher. Das Nettovermögen ändert sich nicht.
- **Bewegung (U-33):** Vorher liefen Schimmer auf den Fortschrittsbalken, der Badge-Puls und das Blinken roter Warnungen endlos. Nachher entfallen Schimmer und Blinken, der Badge pulsiert drei Mal. Der Live-Punkt bei Synchronisierung bleibt.

## Bekannte Grenzen

Offene Entscheidungen und Restrisiken stehen in `ENDKONTROLLE-BERICHT.md`. Die wichtigsten: Zeitstempel kommen vom Gerät (eine falsche Uhr kann einen Konflikt übersehen lassen), Schulden nur mit festem Zins und gleichbleibender Rate (ohne Sondertilgung), Steuerannahmen ohne Verlustverrechnung über Jahre und ohne Vorabpauschale (Kirchensteuer nur als Auswahl).

## Fachliche Regeln (bitte bei Änderungen beibehalten)

- **Sparquote** = Summe der Buchungen der Kategorie `Sparen/Invest` ÷ Einnahmen des Monats (nur investiertes Geld, nicht Cashflow ÷ Einnahmen). Gilt in Home, Monatsrückblick und Jahresübersicht. Hilfsfunktion: `invSum()` in `app.js`.
- **Buchungs-Feed** (Cashflow): nach Kategorie gruppiert, Kategorien nach Summe absteigend, darin Beträge absteigend (`feedHTML()` in `app.js`).
- **Prognose-Reiter**: Block „Prognose-Reiter nach Vorbild Prognose Radar“ in `features.js`. Alle Element-IDs beginnen mit `pr_`, Zustand liegt in `PR`, gespeicherte Pläne in `S.prPlans` (werden mit dem Datenstand synchronisiert).
- Der frühere Bereich „Fuck You“ heißt überall **„Fuck Off“**.
- **Blur** („◉“-Schalter): `blurHtml()` in `app.js` umhüllt automatisch jede Zahl mit €, %, Jahre/Monate in der Ansicht mit `<span class="n">`; SVG-Texte übernimmt `blurNums()`. Neue Ansichten brauchen dafür keine Sonderregeln.
- **Neue Datenfelder** (alle unter `S`, werden mit synchronisiert): `S.spl` (Sparziel), `S.mnotes` (Monatsnotizen), `S.msn` (Meilenstein-Notizen), `S.prPlans` (Prognose-Pläne), `S.lastImp` (letzter CSV-Import für „Rückgängig“). Optionale Felder unter `S.f` (fehlen sie, gilt der Standard): `S.f.tf` (Teilfreistellung in %, Standard 30; erlaubt 30, 15, 0) und `S.f.kist` (Kirchensteuer in %, Standard 0 für keine; erlaubt 0, 8, 9). Je Schuld unter `S.debts` (B-19): `r` (Zins in % p. a., 0 bis 100) und `rate` (monatliche Rate in €, ab 0), beide optional. Fehlen sie, gilt die bisherige Anzeige.
- **Nur auf dem Gerät gespeichert** (nicht in der Cloud): `fr_pin`, `fr_sec` (Datenschutz-Einstellungen), `fr_bk` (die letzten 5 automatischen Tagessicherungen), `fr_exp` (Zeitpunkt des letzten Datei-Backups).
- **Ausgaben-Basis** für Fuck-Off-Zahl und Fuck-Off-Rechner: `ausgabenBasis()` in `app.js` (Ausgaben-Feld, sonst Ø Ausgaben). Die Fixkosten (`fixk()`) bleiben für Notgroschen und Runway.
- **Steuer-Annahmen**: `kirchSatz()`, `tfWert()` und `kistWert()` in `app.js`. Mit Kirchensteuer k: Steuersatz = 25 % / (1 + 0,25 × k), plus Soli 5,5 % auf die Steuer, plus k × Steuer (8 %: 27,819 %, 9 %: 27,995 %). Nachrechnung in `tests/reference/forecast.cjs`.
- **Schulden mit Zins und Rate** (B-19): `schuldPlan()` in `app.js`. Monatlicher Zins i = r/12/100. Anzahl Raten n = ceil(B/rate) bei 0 %, sonst ceil(−ln(1 − i·B/rate) / ln(1 + i)). Ist rate ≤ i·B, gibt es keine Laufzeit, sondern einen Hinweis. Obergrenze 100 Jahre. Die erste Rate fällt im Folgemonat an. Nachrechnung in `tests/reference/schulden.cjs`.
- **Schnellerfassung**: Der „+“-Button unten rechts öffnet ein Sheet; Kategorie-Vorschlag aus früheren Buchungen und Stichworten (`suggestCat()` in `extras.js`).

## Veröffentlichen und testen

Die produktive App läuft bei Vercel: https://finanz-radar-app.vercel.app. Jeder Commit auf `main` stößt ein neues Deployment an.

Vor dem Push: `sh tests/run-all.sh` muss grün sein. Nach App-Änderungen diese Punkte überprüfen:

1. Die Tabs Home, Cashflow, Vermögen, FIRE, Prognose und Mehr öffnen.
2. Buchungen, Vermögenswerte, Ziele, Backup-Export und Backup-Import testen.
3. Nach der Supabase-Konfiguration Anmeldung und Synchronisierung mit zwei getrennten Testkonten testen.
4. Browser-Konsole, Vercel-Deployment und Supabase Security Advisors auf Fehler prüfen.
5. Nach dem Deployment: Service Worker übernimmt die neue Version beim zweiten Aufruf (`VERSION` in `sw.js` prüfen).
