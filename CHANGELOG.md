# Changelog

Änderungen der Endkontrolle von Finanz-Radar. Basis ist der Tag `backup-vor-endkontrolle-2026-10-26` (Commit `e4e1ff9`), Arbeitsbranch `endkontrolle-2026-10-26`. Nichts ist gepusht oder deployt. Die Entscheidungen für Henne stehen in `ENDKONTROLLE-BERICHT.md`, Abschnitt 5 und 10.5.

## Umsetzung der offenen Vorschläge

### Teil A1: Synchronisierung und Kontowechsel (B-03, B-24, B-25)

- `acd510c` Konflikt-Dialog statt Last-Write-Wins (B-03); Fehlalarm bei frischen Geräten behoben (`features.js`)
- `e61b739` Kontowechsel fragt bei ungesicherten Änderungen (B-25)
- `80f4deb` Upload-Neuversuch mit Backoff, Ereignisse „online“ und Vordergrund (B-24)
- Dieser Commit: README, CHANGELOG und Bericht (Abschnitt 14)

Tests: 157 grün vorher, 185 grün nachher (`sh tests/run-all.sh`).

Sichtbare Änderungen (vorher / nachher):

- Konflikt: vorher überschreibt der letzte Upload eine neuere Cloud-Fassung. Nachher Banner „Synchronisierung pausiert“ und Dialog mit „Cloud-Stand übernehmen“, „Diesen Stand behalten“, „Später entscheiden“.
- Kontowechsel: vorher still verworfen. Nachher Dialog mit „Als Datei sichern und wechseln“, „Verwerfen und wechseln“, „Abbrechen“; Esc = Abbrechen.
- Upload-Fehler: vorher „Nicht synchronisiert: …“ ohne Wiederholung. Nachher automatische Versuche (5 s, 15 s, 45 s, 2 min), Restzeit im Konto, Stopp nach fünf Versuchen.
- 401, 403, 413: vorher technische Meldung, nachher verständlicher Text ohne Wiederholung.
- Wieder online oder Rückkehr in den Vordergrund: sofortiger Versuch, wenn Änderungen ausstehen.

Nicht geprüft: echte Supabase-Latenz und RLS, Safari/iOS, Browser-Lauf des Dialogs, Wirkung des Dateiexports im Browser (Details in Bericht 14.1).

### Teil A2: Nachbesserung, Backup, Ausgaben-Basis, Steuer-Annahmen (S-17, S-18, B-16, B-17, B-18)

- `d37fd04` Konflikt-Vergleich nur über Fachdaten: Darstellung (`ui`, `th`, `hide`) löst keinen Dialog aus (A1-Nachbesserung)
- `bcc98cb` Export ohne Nutzerkennung, Import ignoriert eine Kennung aus der Datei (S-18)
- `a61c956` Import prüft jeden Datensatz (Datum, Betrag, Kategorie, Bereich), verwirft ungültige und meldet übernommen, verworfen und korrigiert; Textbeträge bei eindeutigem Format (S-17)
- `b9d5f23` Fuck-Off-Zahl und Fuck-Off-Rechner nutzen dieselbe Ausgaben-Basis, die Ansicht nennt sie (B-16)
- `4f38e51` Teilfreistellung (30, 15, 0 %) und Kirchensteuer (keine, 8, 9 %) wählbar in Prognose und Rechner; Annahmen-Liste und Hinweise im Tab Steuer (B-17, B-18 teilweise)
- `955e107` Formelwerte der Kirchensteuer als benannte Konstanten
- Dieser Commit: README, CHANGELOG und Bericht (Abschnitt 14.2)

Tests: 185 grün vorher, 230 grün nachher (`sh tests/run-all.sh`). Neue Testdateien: `sync-vergleich`, `export-uid`, `import-pruefung`, `ausgaben-basis`, `steuer-annahmen`.

Sichtbare Änderungen (vorher / nachher):

- Konflikt: Eine reine Änderung von Design oder Panel-Zuständen löst keinen Dialog mehr aus. Fachdaten-Unterschiede bleiben beim Dialog.
- Backup-Import: Vorher „Import erfolgreich.“ bei stiller Übernahme ungültiger Daten; Textbetrag „12,50“ wurde 0. Nachher „N übernommen, Y verworfen (Gründe)“, Textbeträge werden bei eindeutigem Format übernommen, unbekannte Kategorien werden Sonstiges.
- Backup-Export: Die Datei enthält keine Nutzerkennung mehr.
- Ausgaben-Basis: Ohne Eingabe im Ausgaben-Feld rechnet der Fuck-Off-Rechner nicht mehr mit den Fixkosten (900 € im Fixture klein), sondern mit Ø Ausgaben (943 €/Monat). Fixture klein: Entnahme netto 1.806 € → 1.845 €/Monat, Steuer in der Entnahme 70.463 € → 67.818 €. Die Fuck-Off-Zahl bleibt 282.788 €. Beide zeigen „Basis: …“.
- Teilfreistellung: Standard 30 % wie vorher; 15 % wählbar (Fixture klein, Prognose: Steuer 12.621 € → 15.382 €).
- Kirchensteuer: Standard keine (unverändert). 8 %: Gesamtsatz 27,819 %, Prognose-Steuer 13.312 €; 9 %: 27,995 %, 13.397 €.
- Tab Steuer: neuer Abschnitt „[Annahmen] Steuer“ mit Satz, Pauschbetrag, Teilfreistellung, Kirchensteuer und Hinweisen zu Verlustverrechnung und Vorabpauschale.

Neue Datenfelder (optional, unter `S.f`): `tf` (Teilfreistellung, Standard 30), `kist` (Kirchensteuer, Standard 0). Pläne: `ks`.

Nicht geprüft: echter Browser (Import-Dialog, Chips, Touch-Ziele, Kontrast), Steuerrecht gegen aktuelle Quellen, gespeicherte Pläne im Browser, Sicherungen-Wiederherstellung ohne Import-Prüfung (Details in Bericht 14.2).

### Teil A3: Schulden mit Zins und Tilgung (B-19), Bewegung (U-33)

- `c43f1c8` Regressionssnapshot der Schulden-Ansicht vor der Änderung (Test)
- `13e740d` Rechenkern `schuldPlan()`: Laufzeit, Ende, Gesamtzins, Restschuld nach 12 Monaten; Nachrechnung in `tests/reference/schulden.cjs` (B-19)
- `c8488cf` Formular und Bearbeiten mit optionalem Zins und Rate; Anzeige der Laufzeit (B-19)
- `364c0da` Import prüft Zins und Rate; ungültige Felder werden entfernt und gemeldet (B-19)
- `963a2eb` Schimmer auf den Fortschrittsbalken entfernt (U-33)
- `476d58a` Badge-Puls auf drei Wiederholungen begrenzt (U-33)
- `3354e97` Blinken roter Warnungen entfernt, ungenutzte Klasse `.s-crypto` entfernt (U-33)
- `d216b28` Test: im Stylesheet läuft nur der Live-Punkt endlos (`ui-static`)
- Dieser Commit: README, CHANGELOG und Bericht (Abschnitt 14.3)

Tests: 230 grün vorher, 269 grün nachher (`bash tests/run-all.sh`). Neue Testdateien: `schulden-regression`, `schulden`, `schulden-ansicht`, `schulden-import`; `ui-static` um zwei Prüfungen erweitert.

Sichtbare Änderungen (vorher / nachher):

- Schulden: Vorher nur Name und Betrag. Nachher optional Zins (% p. a.) und monatliche Rate. Mit beiden Feldern: Laufzeit, Ende, Zinsen bis zum Ende, Restschuld in 12 Monaten. Rate unter dem Zins: Warnhinweis statt Laufzeit. Über 100 Jahre: „länger als 100 Jahre“. Ohne die Felder bleibt die Anzeige wie bisher.
- Eingabe: zwei Felder im Formular und im Bearbeiten-Formular. Ungültige Werte werden mit deutscher Meldung abgewiesen, nichts wird gespeichert.
- Import: Zins über 100 oder negative Rate: Feld entfernt, Datensatz bleibt, Meldung unter „korrigiert“.
- Bewegung: Vorher liefen Schimmer, Badge-Puls und das Blinken roter Warnungen endlos. Nachher entfallen Schimmer und Blinken, der Badge pulsiert drei Mal. Der Live-Punkt bei Synchronisierung bleibt.

Neue Datenfelder (optional, je Schuld unter `S.debts`): `r` (Zins in % p. a., 0 bis 100), `rate` (monatliche Rate in €, ab 0). Beide fehlen bei alten Daten. `schema.sql` ist unverändert.

Nicht geprüft: echter Browser (Layout der neuen Zeilen bei 375 px, Dunkelmodus, Trefferflächen der neuen Felder, Bild der Animationen), Supabase-Synchronisierung mit den neuen Feldern, Datei-Import im Browser. Der SVG-Pulse an den Diagrammen (`ANIM` in `app.js`) ist unverändert und unbegrenzt (Details in Bericht 14.3).

### Teil B: Aktionen ohne Inline-Handler, CSP ohne unsafe-inline bei Skripten (S-07)

- `8cd0e1e` Dispatcher und `act()`: eine Auflösung am Dokument für click, change und input, Allowlist `ACTS`, Platzhalter `$value`, `$checked`, `$el`, `$event` (`app.js`, `tests/aktionen.test.cjs`)
- `faec892` `app.js` umgestellt (76 Attribute); mehrteilige Handler als benannte Funktionen
- `9f8a2c6` `features.js` umgestellt (15); Ausschnitt FIRE und Suche im Mehr-Tab an `act()` angepasst
- `f0465c5` `boost.js` umgestellt (17 Attribute, dazu 3 über die Parameter von `chip`, `al`, `tile`); `go()` liefert das Attribut
- `fd65e84` CSS-Auswahl `[data-click]` (`styles.css`, `ui-static`, `shoot.cjs`)
- `44d5d13` `extras.js` umgestellt (21); Link im Sparplan mit `$event` und `preventDefault()` statt `return false`
- `2814524` `index.html` umgestellt (2)
- `969c91e` Test: Äquivalenz der 76 Ansichten gegen 909542e (Hash ohne Handler-Attribute, Anzahl und Reihenfolge, Funktion und Argumente je Handler), statische Prüfung auf `on*`-Attribute
- `b87da41` Test: Browser-Smoketest `tests/ui/smoke.cjs` (18 Schritte, Chrome über CDP, CSP aus `vercel.json`)
- `2397c49` `vercel.json`: `script-src 'self' https://cdn.jsdelivr.net` ohne `'unsafe-inline'`, neu `script-src-attr 'none'`; `tests/csp.test.cjs`
- Dieser Commit: README, CHATGPT-ANLEITUNG, CHANGELOG und Bericht (Abschnitt 14.4)

Tests: 269 grün vorher, 364 grün nachher (`bash tests/run-all.sh`). Neue Testdateien: `aktionen` (11), `handler-aequivalenz` (77), `handler-statisch` (2), `csp` (5). Geändert: `security` (Prüfung der Passiv-ID auf `act()` umgestellt), `schulden-regression` (Snapshot nur bei den Handler-Attributen), `ui-static` (Selektor `[data-click]`). Die Testhilfe `tests/harness/load-app.cjs` hat die Option `seed` für `Math.random`.

Sichtbare Änderungen: keine. Der Render-Vergleich zeigt für alle 76 Fälle (19 Ansichten, 4 Fixtures) dasselbe HTML ohne Handler-Attribute. Die Screenshots von 6 Ansichten, Schnellerfassung, CSV-Import, PIN und Login sind je Breite und Design bytegleich mit 909542e (44 Bilder).

Sicherheit: Inline-Skripte und Inline-Ereignisattribute sind gesperrt. `style-src` behält `'unsafe-inline'` (Restrisiko, Bericht 14.4).

Nicht geprüft: Safari und iOS, echte Supabase-Verbindung (Smoketest ohne Konfiguration), Live-Header auf Vercel (lokaler Server), Cache-Regeln. Die Eigenschaften `el.onclick = …` in `features.js` und `extras.js` (10 Stellen) sind keine Attribute und bleiben unverändert.

## Endkontrolle (Phase 1 bis 5)

### Phase 1: Baseline und Inventur

Bericht mit Inventar, Prüfprotokoll und Befunden; Testdaten (Fixtures) für kleine, leere, Grenzfall- und Extremdaten.

- `ef0ca9e` Testdaten (Fixtures) für klein, leer, Grenzfälle und Extremfall
- `abc4c6c` Endkontroll-Bericht mit Inventar, Prüfprotokoll und Befunden

### Phase 2: Sicherheit

XSS-Ausgabe mit echtem HTML-Escaping, Sicherheitsheader, SRI für das Supabase-Skript, PIN mit Salt und PBKDF2, CSV-Import mit Kalenderprüfung.

- `1454d01` XSS-Ausgabe über echtes HTML-Escaping absichern
- `19ecab5` Sicherheitsheader und SRI für Supabase-Skript
- `8bbab07` PIN mit Salt und PBKDF2 hashen, Fehlversuche dauerhaft bremsen
- `3af32d3` CSV-Import prüft Kalenderdaten und meldet gekürzte Dateien
- `707cff1` Schema-Härtungsvorschlag abgelegt (nicht ausgeführt)

### Phase 3: Funktionen, Berechnungen, Logik

Berechnungen gegen unabhängige Nachrechnung geprüft, Sync gegen Datenverlust abgesichert, Kalendertage in Ortszeit, Anzeige bei ungültigen Werten.

- `3213d2b` Test-Harness lädt die echte App per vm mit DOM-Stubs, Ansichten-Smoke-Test
- `83816a9` Kalendertage in Ortszeit statt UTC (S-31)
- `7701b0a` Beträge und Prozente zeigen bei ungültigen Werten '–', kein Minus-Null, doppeltes Vorzeichen bei Erstattungen behoben
- `ecae92f` Sparquote zeigt '–' ohne Einnahmen, Kennzahlen per Test über alle Ansichten abgeglichen
- `02c9c7b` Monat übernehmen setzt den Tag 29 bis 31 auf den letzten Tag des Zielmonats
- `0212afa` Prognose, Entnahme und Fuck-Off-Rechner gegen unabhängige Referenz auf den Cent geprüft
- `785af24` Haltefrist kalendarisch (mehr als ein Jahr), Anzeige nennt das späteste Ende
- `429de13` CoinGecko-Marktdaten validieren, Coin-IDs kodieren, Mini-Verlauf ohne NaN
- `e9f3c3f` kaputten lokalen Stand (fr_s) vor dem Start sichern
- `e24c6bc` Sync schützt Cloud und lokale Daten vor stillem Überschreiben
- `4d976ce` Fuck-Off-Zahl ohne Division durch 0, Runway-Stufe ohne Zeitangabe bei Ziel 0
- `5473286` Historie zeigt je Monat einen Eintrag, Bearbeiten übernimmt keinen leeren Tag oder ungültigen Monat
- `e13f69e` Tests für Parser, CSV-Import mit Rückgängig, Sparplan, Vorschau, Feed, Sankey, Job-Modell, Auto-Sicherungen und CSV-Parser-Dubletten
- `9356d78` Test für abgelaufene Sitzung im Sync
- `3f54188` Test für Verlaufs-Cache (abgelaufen wird neu geholt, frisch nicht)
- `93d11b7` Tests für passives Einkommen, Notgroschen und Meilenstein; Harness-Stub für style.setProperty
- `70dfa5b` Bericht mit Abschnitt 3a, Befunden B-01 bis B-29 und Änderungsliste

### Phase 4: UI-Korrekturen

Kontrast nach WCAG AA, Touch-Ziele 44 px, Barrierefreiheit (Rollen, Namen, Fokus), reduzierte Bewegung, Layout ohne Überlauf bei 375 px, PWA-Manifest.

- `aafe653` Kontrast-Tokens nach WCAG AA (Hell und Dunkel)
- `e1de209` Akzent-Textfarben auf Textton (AA) umstellen
- `533438d` Prognose ohne horizontalen Überlauf bei 375 px
- `4d65904` Touch-Ziele auf mindestens 44 px
- `64ad3f3` Barrierefreiheit (Rollen, Namen, Labels, Dialog-Fokus)
- `ff05a9d` englische Reste und PWA-Manifest
- `41fe618` Test für englische Begriffe prüft ganze Wörter
- `98e052b` Bewegung: Reduced Motion für SVG-Pulse, Live-Punkt nur bei Sync
- `e2d3e7a` Diagramme mit role=img und Beschreibung
- `ce3d35d` Eingabefelder mindestens 16 px (kein Zoom in iOS)
- `5fee7ff` Kategorie-Farben nur als Marker, Text in Textfarbe
- `0dfe08f` Kopfzeile ohne Umbruch, anklickbare Abschnittsköpfe und Eingaben 44 px
- `0ccb134` UI-Matrix-Werkzeug tests/ui (Screenshots, Audit, Filter)
- `e46ccc5` leeres Badge ausblenden, Datei-Auswahl im App-Stil
- `cbee597` Matrix-Bilder nach den Korrekturen (bericht/screens/nachher)
- `0527d6b` Bericht Abschnitt 10 (Befunde U-01 bis U-48, Kontrast, Vorher/Nachher)

Nachabnahme im Browser durch Claude (27.10.2026), sechs Restpunkte:

- `8cce667` Kategorie-Legende: nur der Marker ■ in Farbe, Name in Textfarbe (Mix, Verteilung, Portfolio)
- `220e965` Eingabefelder mit programmatischem Namen (Datum, Suche, Steuer, Krypto, Notgroschen und weitere)
- `db53b04` Krypto-Kurseingabe auf 16 px (kein Zoom in iOS)
- `b8ed9d2` Trefferflächen Kopfzeile (◉, ☀), Abschnittskopf „[Vorschau]“ und Chip auf mindestens 44 px
- `b86393a` Vorschau-Tabelle bei 375 bis 430 px ohne inneren Scroll (ab 431 px unverändert)
- `55ed500` Tests: Namen, Inline-Farben und Schrift gerendert und statisch geprüft (150 auf 157 Tests)
- `7204417` Schema-Vorschlag: REVOKE TRUNCATE, REFERENCES, TRIGGER für authenticated (nicht ausgeführt)

### Phase 5: Code, Performance, Prozesse

- **Performance (gemessen, Extrem-Fixture mit 5.000 Buchungen, Node mit DOM-Stub):** Start 114 ms → 26 ms, Fuck-Off-Ansicht 52 ms → 6 ms, Home 25 ms → 1,3 ms, Prognose 8 ms → 0,2 ms. Ursache: `avg()` filterte für jeden Monat alle Buchungen. Browser-Werte im Bericht, Abschnitt 11.
- **Laden:** Skripte mit `defer` (Reihenfolge erhalten), `preconnect` zu jsDelivr und Supabase, Cache-Regeln in `vercel.json` (Icons und Splash 7 Tage, Code `must-revalidate`).
- **Toter Code entfernt:** `plan()` und `pcalc()` (app.js), `theme()` und `bars()` (app.js, ersetzt durch boost.js), CSV-Pfad in features.js (Parser, Ansicht, Hilfsfunktionen). Belege im Commit.
- **Benannte Konstanten:** Steuersätze, Freibeträge, Teilfreistellung, Standard-Entnahmerate, Sync-Verzögerung, PIN-Wartezeit, CSV-Zeilenlimit, Tagessicherung und Auto-Sperre. Werte unverändert.
- **Stille `catch`-Blöcke** kommentiert, Kopfkommentare je Datei mit Zweck, Abhängigkeiten und Ladereihenfolge.
- **Prozesse:** `tests/run-all.sh` (Syntax, alle Tests, Secret-Scan), CI-Workflow mit denselben Schritten plus Test-Unterordner und VERSION-Prüfung, Messskript `tests/perf/measure.cjs`.
- **Dokumentation:** README (Ladereihenfolge, lokale Schlüssel, Regeln, sichtbare Änderungen, korrigierte Aussage zu `config.js`), CHATGPT-ANLEITUNG (Ablauf Backup, ändern, testen, doppelt prüfen, Zusammenfassung), dieses CHANGELOG.

- `605e7a6` Messskript tests/perf/measure.cjs für Laufzeiten mit der Extrem-Fixture (6.1)
- `6eee2c7` Extrem-Fixture gibt beim direkten Aufruf nur JSON aus
- `c542df5` Monatsdurchschnitt avg() in einem Durchlauf statt je Monat filtern
- `98f7b51` Diagramm-Hinweis entfernt nur das eigene Element statt querySelectorAll bei jedem pointermove (6.1)
- `ee3d0a0` Messskript zählt auch document.addEventListener und document.querySelectorAll
- `3d412a8` Skripte mit defer, preconnect zu jsDelivr und Supabase (6.2)
- `15bcb74` Cache-Header für Icons und Splash (7 Tage) und must-revalidate für Code (6.2)
- `874c3ce` toten Prognose-Code in app.js entfernt (plan, pcalc, Aufruf in render) (6.3)
- `694ab06` theme() und bars() aus app.js entfernt, boost.js ersetzt beide (6.3)
- `b4d35f3` toten CSV-Pfad aus features.js entfernt (S-06, S-30, B-29) (6.3)
- `f75fbde` Steuer-, Freibetrags-, Standard- und Timer-Werte als benannte Konstanten (6.3)
- `44a41af` stille catch-Blöcke mit Grund kommentiert (6.3)
- `5a68cf9` Kopfkommentare mit Zweck, Abhängigkeiten und Ladereihenfolge (6.3)
- `f68e199` CI-Workflow und tests/run-all.sh mit Syntax, allen Tests, Secret-Scan und VERSION-Prüfung (6.4)

Ungeprüft im Live-System: Cache-Header bei Vercel, RLS von `user_state`, Verhalten auf einem iPhone. Supabase-Advisors und Policies von `finance_state` sind am 27.10.2026 geprüft (Bericht, Abschnitt 3.8). Details im Bericht, Abschnitt 13.
