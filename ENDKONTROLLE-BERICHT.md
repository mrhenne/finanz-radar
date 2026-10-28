# Endkontrolle Finanz-Radar: Bericht

Stand: 2026-10-27 (Phase 5 abgeschlossen) · Basis: Commit `e4e1ff9` (Tag `backup-vor-endkontrolle-2026-10-26`) · Arbeitsbranch: `endkontrolle-2026-10-26` · Repo: `~/Developer/finanz-radar-endkontrolle`

## 0. Kurzfassung

- **Erledigt:** Phase 1 bis 5. Phase 5 (Performance, Laden, Codequalität, Prozesse) steht in den Abschnitten 11 bis 13. Phase 2 bis 4 unverändert (Abschnitte 3, 3a, 10).
- **Tests:** Start Phase 5: 142 grün. Ende Phase 5: **150 grün**, alle Testdateien inkl. Unterordner (`sh tests/run-all.sh`). Baseline des Auftrags: 11.
- **Performance** (Extrem-Fixture, 5.000 Buchungen). Node: Start 114,5 → 26,2 ms, Fuck-Off-Ansicht 51,8 → 6,0 ms, Home 24,5 → 1,3 ms. Chrome (Median aus 3 Läufen): Fuck Off 45,1 → 5,6 ms, Home 32,6 → 1,8 ms, Prognose 24,6 → 3,6 ms. Ursache der großen Stelle: `avg()` (quadratisch), behoben.
- **Entfernt (toter Code, belegt):** `plan()` und `pcalc()` in app.js, `theme()` und `bars()` in app.js (von boost.js ersetzt), CSV-Pfad in features.js (Parser, Hilfsfunktionen, Ansicht). **Korrektur zu S-29:** `cu()` und `applyTh()` in app.js sind nicht tot. Beide laufen beim ersten Render, bevor boost.js geladen ist. Sie bleiben.
- **Umsetzung der offenen Vorschläge, Teil A1 (B-03, B-24, B-25):** umgesetzt, Abschnitt 14.1. Tests 157 → 185 grün.
- **Offen:** Entscheidungen für Henne priorisiert in Abschnitt 13.1. Kein Push, kein Deploy, keine Live-Prüfung.
- **Nicht getan (wie vorgegeben):** kein Push, kein Deploy, keine echten Daten, keine neue Abhängigkeit, kein Build-Schritt, `schema.sql` unverändert, Datenmodell `S` unverändert, kein Zugriff auf Live-Supabase.
- **Abweichung:** Die Commits tragen `Co-Authored-By: Claude Haiku 5.5`, nicht `Sonnet 5.5` wie im Auftrag. Begründung in Abschnitt 12.7.

## 1. Prüfprotokoll

### 1.1 Baseline (vor Änderungen, `e4e1ff9`)

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Syntax | `node --check app.js config.js features.js extras.js boost.js sw.js` | alle 6 Dateien OK |
| Tests | `node --test tests/*.test.cjs` | 11 von 11 bestanden, 0 fehlgeschlagen |
| Dateigrößen | `wc -l` / `wc -c` | app.js 303 Z. / 73.547 B · features.js 481 / 51.237 · extras.js 351 / 29.034 · boost.js 344 / 33.948 · styles.css 131 / 13.217 · sw.js 48 / 2.360 · index.html 6.586 B |
| Git | `git log --oneline`, `git tag` | 1 Tag angelegt: `backup-vor-endkontrolle-2026-10-26` |
| Backup | ZIP des Ordners | `~/Developer/finanz-radar-backup-2026-10-26.zip` (91 Dateien, 1.057.603 B, inkl. `.git`) |

### 1.2 Nach den Änderungen (Stand Bericht-Commit)

| Prüfung | Ergebnis |
|---|---|
| `node --check` | alle 6 Dateien OK |
| `node --test tests/*.test.cjs` | 28 von 28 bestanden (11 vorher + 6 `security` + 5 `pin` + 6 `csv-import`) |
| Headless-Probe XSS (Chrome) | vorher: `onmouseover`-Attribut entsteht (Ausbruch). nachher: kein Attribut, Daten unverändert. Beleg: `scratchpad/xss-probe.html` |
| Headless-Probe CSP und SRI (Chrome, lokaler Server mit den Headern aus `vercel.json`, Port 8091) | Login-Ansicht gerendert (Titel „Login“, also Supabase-Skript mit SRI geladen). stderr ohne „Refused“/CSP-Meldung. Eine Konsolenmeldung: „Password field is not contained in a form“ (vorbestehend, siehe S-33). |
| SRI-Hash | `sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp`, live aus dem CDN berechnet, stimmt mit `index.html` überein. CDN antwortet mit `Access-Control-Allow-Origin: *` (nötig für `crossorigin="anonymous"`). |
| Advisory-Abfrage npm | Bulk-Endpunkt liefert für `@supabase/supabase-js@2.118.0` keine Einträge (Abfrage am 2026-10-26). 2.118.0 ist laut Registry der aktuelle `latest`-Tag (veröffentlicht 2026-10-15). Keine Gewähr: GitHub-Advisory-DB nicht separat geprüft. |

### 1.3 Werkzeuge

- **Playwright:** nicht installiert, nicht installiert worden (Regel: keine Installation ohne Rückfrage).
- **Headless-Browser:** Google Chrome ist unter `/Applications/Google Chrome.app` vorhanden und wurde über `--headless=new --dump-dom` für die Stichproben oben genutzt. Kein Playwright-Lauf.
- **Lokaler Server:** Statt `python3 -m http.server 8080` wurde ein kleiner Python-Server (`scratchpad/serve-with-headers.py`) mit den Headern aus `vercel.json` auf Port 8091 gestartet, damit die CSP im Browser getestet werden konnte. Gestoppt nach dem Test.
- **Hook-Hinweis:** Der impeccable-Hook meldete beim Bearbeiten von `index.html` einen vorbestehenden Befund `dark-glow` (siehe S-32). Nicht geändert, weil Design außerhalb dieses Auftrags liegt (Phase 4).

## 2. Phase 1: Baseline und Inventur

### 2.1 Globale Namen und Überschreibungen

Die vier Dateien teilen sich den globalen Scope über `window`. `app.js` definiert Top-Level-Funktionen. `features.js`, `extras.js` und `boost.js` laufen als IIFE und hängen sich über `W.*`, `V.*` (Ansichten) und `TABS`, `TT`, `SUB` an. Ladereihenfolge: `config.js`, `app.js`, `features.js`, `extras.js`, `boost.js`. Belegt durch Lesen der Dateien und Grep. Eine vollständige `vm`-Simulation mit DOM-Stub wurde nicht gebaut (Aufwand).

| Name | Definitionen | Gewinner (Ladereihenfolge) | Bewertung |
|---|---|---|---|
| `parseCSV` | `features.js` (IIFE-lokal), `extras.js` (IIFE-lokal) | keine globale Kollision, beide lokal | Dublette. `features.js`-Version nur im toten CSV-Pfad (`csvLoad`), siehe S-06, S-30 |
| `parseDate` | `features.js`, `extras.js` (beide IIFE-lokal) | keine globale Kollision | Dublette, s. o. |
| `f` | `app.js` (Name in `cu()` und `cgPump` als Funktionsausdruck, lokal), `boost.js` (lokal in `cu`) | keine Kollision | Kein Befund. `S.f` ist eine Eigenschaft, kein globaler Name |
| `render` | `app.js` (global), `features.js` 3×, `extras.js` 1×, `boost.js` 1× (`W.render`-Wrapper) | Kette: app → features → features → extras → boost | Gewollt, aber fragil. 5 Wrapper |
| `applyTh`, `theme`, `cu`, `bars` | `app.js` (Top-Level), überschrieben in `boost.js` (`W.applyTh`, `W.theme`, `W.cu`, `W.bars`) | `boost.js` | Die app.js-Versionen sind tot (S-29) |
| `V.plan` | `app.js` (`plan()`), überschrieben in `features.js` (`V.plan = prHTML`) | `features.js` | `plan()` und `pcalc()` in app.js sind tot (S-29) |
| `V.csv` | `features.js`, überschrieben in `extras.js` | `extras.js` | CSV-Ansicht aus `features.js` tot (S-06) |
| `V.home`, `V.fire`, `V.more`, `V.sec`, `V.cash`, `V.review`, `V.data` | jeweils Grundfassung in `app.js` oder `features.js`, dann Wrapper | Wrapper-Kette | gewollt |

### 2.2 Fixtures (erfundene Werte)

- `tests/fixtures/small.json`: 10 Buchungen über 3 Monate (2026-07 bis 2026-09), 3 Positionen, 1 Ziel, 1 Schuld, 3 Historienpunkte, 1 Verkauf, 1 Erstattung (negativ).
- `tests/fixtures/empty.json`: leerer Datensatz.
- `tests/fixtures/edge.json`: Grenzfälle: 31.01., 28.02., 29.02.2028 (Schaltjahr), 30.04., 31.12./01.01. (Jahreswechsel), Einnahmen 0 im Mai, negativer Betrag, Betrag 0, sehr große Zahl (1.234.567,89), Position ohne Einstand, doppelter Historienmonat.
- `tests/fixtures/extreme.cjs`: Generator (nicht JSON, um das Repo klein zu halten). 5.000 Buchungen über 12 Jahre, 20 Krypto-Positionen, 144 Historienpunkte. Deterministisch (feste Folge). `node tests/fixtures/extreme.cjs` gibt ca. 430 KB JSON aus.

Die Fixtures wurden in Phase 3 von Tests genutzt (Ansichten, Kennzahlen, Prognose, Grenzfälle). Messungen mit der Extrem-Fixture folgen in Phase 5. Commit `ef0ca9e` (Phase-1-Artefakte nach den Sicherheits-Commits, siehe Abschnitt 8).

### 2.3 Funktionsinventar

Erzeugt aus dem Stand `e4e1ff9` (Zeilen beziehen sich auf diesen Stand). Spalte „Treffer im Code“ ist ein grober Zählwert (Wortvorkommen in allen vier Dateien, inkl. Definition). Spalte „Test“ = „ja“, wenn der Name in `tests/*.cjs` vorkommt. Das ist grob: `render` und `toast` tauchen dort nur als Testhilfe auf und sind nicht getestet. Eingaben und Ausgaben stehen kurz im Zweck, nicht vollständig typisiert.

| Datei:Zeile | Funktion | Zweck (Ein- → Ausgabe, kurz) | Treffer im Code (ca.) | Test |
|---|---|---|---|---|
| app.js:2 | `esc` | Ausgabe-Escaping für HTML-Text und Attribute (& < > " ' `) | 51 | nein |
| app.js:6 | `sanitizeImportedValue` | Import: Strings bereinigen, Tiefe/Größe begrenzen, __proto__ verwerfen | 4 | ja |
| app.js:15 | `normalizeImportedState` | Import: Datenstruktur prüfen, IDs erzeugen, Felder füllen | 4 | ja |
| app.js:17 | `clean` | Speicher-Bereinigung für Nutzertext (entfernt < > & ") | 15 | ja |
| app.js:18 | `textField` | Import: Textfeld als String oder Standard | 17 | nein |
| app.js:19 | `numberField` | Import: Zahlenfeld als Zahl oder Standard | 16 | nein |
| app.js:49 | `em` | Login-Fehlertexte übersetzen | 6 | nein |
| app.js:50 | `localSave` | fr_s in localStorage schreiben (S → JSON) | 7 | nein |
| app.js:51 | `save` | Lokal speichern und Cloud-Upload nach 1,5 s planen | 51 | nein |
| app.js:52 | `push` | S per upsert nach finance_state hochladen | 85 | ja |
| app.js:53 | `pull` | Cloud-Stand laden, Konto-Wechsel erkennen, Altdaten prüfen | 6 | nein |
| app.js:70 | `continueWithCurrentData` | Lokalen Stand nach Bestätigung in finance_state anlegen | 3 | nein |
| app.js:78 | `legacyNotice` | Hinweisbox bei älteren Cloud-Daten oder pausierter Sync | 2 | nein |
| app.js:83 | `initAuth` | Session lesen, Auth-Listener setzen, Start-Pull | 2 | nein |
| app.js:84 | `login` | E-Mail/Passwort anmelden oder registrieren | 6 | nein |
| app.js:85 | `magic` | Login-Link per E-Mail senden | 2 | nein |
| app.js:86 | `forgot` | Passwort-Reset-Mail senden | 2 | nein |
| app.js:87 | `setPw` | Neues Passwort setzen (min. 6 Zeichen) | 3 | nein |
| app.js:88 | `logout` | Abmelden; mit wipe lokale Daten löschen und neu laden | 3 | nein |
| app.js:89 | `applyTh` | Design (hell/dunkel/auto) auf das Dokument anwenden | 9 | nein |
| app.js:90 | `blurNums` | Zahlen in SVG-Texten für den Blur-Modus markieren | 8 | nein |
| app.js:101 | `blurHtml` | Zahlen mit €/%/Jahre im HTML für Blur umhüllen | 2 | nein |
| app.js:106 | `hideN` | Blur (◉) umschalten und speichern | 1 | nein |
| app.js:107 | `cu` | Zähl-Animation für große Beträge (Mikro-Feedback) | 3 | nein |
| app.js:108 | `theme` | Design-Zyklus hell → dunkel → auto | 5 | nein |
| app.js:109 | `P` | Panel-Markup mit Einklapp-Schalter und Ordnungsgriff | 180 | nein |
| app.js:110 | `mt` | Buchungen des gewählten Monats | 6 | nein |
| app.js:111 | `invSum` | Summe der Sparen/Invest-Buchungen (Sparquote-Zähler) | 9 | nein |
| app.js:112 | `val` | Wert einer Position (Menge × Kurs) | 26 | nein |
| app.js:112 | `dt` | Summe aller Schulden | 4 | nein |
| app.js:112 | `nw` | Vermögen (Summe Positionen) | 27 | nein |
| app.js:112 | `nn` | Net Worth = Vermögen minus Schulden | 17 | nein |
| app.js:112 | `fireF` | Fuck-Off-Zahl: manuell oder Ausgaben × 12 ÷ Entnahmerate | 18 | nein |
| app.js:112 | `gv` | Aktueller Stand eines Ziels je nach Modus | 9 | nein |
| app.js:112 | `bk` | Zurück-Button zu Mehr | 20 | nein |
| app.js:112 | `byK` | Summe der Positionen einer Art | 25 | nein |
| app.js:113 | `avg` | Monatsdurchschnitt Einnahmen, Ausgaben und Sparen | 16 | nein |
| app.js:114 | `bars` | Balken je Kategorie (Einnahmen/Ausgaben) – wird in boost überschrieben | 4 | nein |
| app.js:115 | `moNav` | Monatsnavigation (‹ Monat ›) | 3 | nein |
| app.js:116 | `sh` | Monat um d Monate verschieben | 21 | nein |
| app.js:117 | `del` | Eintrag aus S[k] mit id entfernen | 8 | nein |
| app.js:118 | `applyRec` | Wiederkehrende Vorlagen für den Monat buchen (Duplikat-Schutz) | 2 | nein |
| app.js:119 | `copyMo` | Buchungen des Vormonats in den aktuellen übernehmen | 2 | nein |
| app.js:120 | `addDebt` | Schuld aus Formular anlegen | 2 | nein |
| app.js:121 | `setP` | Kurs einer Position setzen | 2 | nein |
| app.js:122 | `debtsHTML` | Schulden-Panel | 2 | nein |
| app.js:123 | `kzHTML` | Kennzahlen-Panel | 2 | nein |
| app.js:124 | `sankey` | Geldfluss-Diagramm (SVG) aus Buchungen des Monats | 2 | nein |
| app.js:137 | `addTx` | Buchung aus Formular anlegen (optional wiederkehrend) | 2 | nein |
| app.js:138 | `snap` | Monatlichen Net-Worth-Stand in Historie schreiben | 2 | nein |
| app.js:139 | `addHist` | Historie-Eintrag manuell setzen | 2 | nein |
| app.js:140 | `histHTML` | Net-Worth-Verlauf (SVG) und Liste | 2 | nein |
| app.js:147 | `goalCalc` | Ziel: nötige Monatssparrate bis Deadline | 2 | nein |
| app.js:150 | `need` | Verlauf anfordern, wenn Cache fehlt oder alt ist | 6 | nein |
| app.js:153 | `ageY` | Alter eines Kaufs in Jahren | 3 | nein |
| app.js:155 | `edHTML` | Bearbeiten-Formular für den Eintrag in ed | 8 | nein |
| app.js:156 | `edSave` | Änderungen aus dem Bearbeiten-Formular übernehmen | 2 | nein |
| app.js:159 | `tv` | Zahl kurz formatieren | 5 | nein |
| app.js:160 | `pie` | Kreisdiagramm (SVG) mit Legende | 5 | nein |
| app.js:161 | `ca` | Tooltip-Daten für Diagramme setzen | 10 | nein |
| app.js:164 | `lc` | Liniendiagramm (SVG) für Zeitreihen | 5 | nein |
| app.js:170 | `rgInfo` | Zeitraum-Auswahl (4h … YTD) in Tage und Startzeit | 4 | nein |
| app.js:174 | `cgSave` | Krypto-Verlaufs-Cache nach fr_cg schreiben | 2 | nein |
| app.js:175 | `cgWake` | Warteschlange nach Wartezeit wieder anstoßen | 5 | nein |
| app.js:177 | `cgPump` | CoinGecko-Warteschlange abarbeiten (eine Anfrage nach der anderen) | 3 | nein |
| app.js:184 | `series` | Verlaufsdaten für eine Coin-ID (oder err/undefined) | 3 | ja |
| app.js:185 | `cgRetry` | Alle fehlgeschlagenen Verläufe erneut anstoßen | 2 | nein |
| app.js:186 | `cgErrMsg` | Fehlertext bei Rate-Limit oder Offline | 3 | nein |
| app.js:187 | `fl` | Zeitstempel als Datums-/Uhrzeittext | 3 | ja |
| app.js:188 | `rgBtns` | Zeitraum-Schalter | 3 | nein |
| app.js:189 | `longR` | true, wenn Zeitraum 30 Tage oder mehr | 3 | nein |
| app.js:190 | `pfHTML` | Krypto-Portfolio-Verlauf aus Kursen | 2 | nein |
| app.js:196 | `liveHTML` | Top-Kurse-Liste und Detail-Chart | 2 | nein |
| app.js:203 | `fixk` | Fixkosten: wiederkehrende Ausgaben oder Ø Ausgaben | 12 | nein |
| app.js:204 | `egCore` | Notgroschen-Stand und Monate Reichweite | 3 | nein |
| app.js:205 | `egHTML` | Notgroschen-Panel mit Zielen | 2 | nein |
| app.js:206 | `togEg` | Cash-Konto als Notgroschen markieren | 2 | nein |
| app.js:207 | `tg` | Panel auf-/zuklappen | 3 | nein |
| app.js:208 | `ordP` | Panel-Reihenfolge aus S.ui.o wiederherstellen | 2 | nein |
| app.js:209 | `liveFetch` | CoinGecko-Markets laden, Kurse übernehmen, Fehler merken | 4 | nein |
| app.js:211 | `spark` | Mini-Liniendiagramm (SVG) | 2 | nein |
| app.js:216 | `lots` | Kauf-Lots anlegen, falls nicht vorhanden | 2 | nein |
| app.js:216 | `recalc` | Menge und Einstand aus Lots neu berechnen | 2 | nein |
| app.js:218 | `hf` | Haltefrist-Hinweis für Krypto/Gold | 6 | nein |
| app.js:219 | `assetRow` | Zeile einer Position mit Aktionen | 2 | nein |
| app.js:220 | `trHTML` | Kauf/Verkauf-Formular | 2 | nein |
| app.js:221 | `doTr` | Kauf oder Verkauf buchen (FIFO, Realisierte G/V) | 2 | nein |
| app.js:225 | `cgPrice` | Einzelkurs von CoinGecko holen | 2 | nein |
| app.js:226 | `drawSg` | Vorschlagsliste für Coin-Suche zeichnen | 3 | nein |
| app.js:227 | `sugg` | Coin-Suche (lokal und CoinGecko, verzögert) | 3 | nein |
| app.js:230 | `pick` | Vorschlag übernehmen und Kurs laden | 2 | nein |
| app.js:231 | `addAs` | Position aus Formular anlegen | 2 | nein |
| app.js:233 | `addGoal` | Ziel aus Formular anlegen | 2 | nein |
| app.js:234 | `setF` | Prognose-/FIRE-Annahmen speichern | 3 | nein |
| app.js:235 | `simYears` | Jahre bis Zielbetrag bei monatlicher Sparrate | 4 | nein |
| app.js:236 | `importBackup` | JSON-Backup prüfen, bestätigen und ersetzen | 2 | nein |
| app.js:240 | `feedList` | Buchungen des Monats filtern und sortieren | 4 | nein |
| app.js:241 | `feedBar` | Suchfeld und Kategorie-Filter des Feeds | 2 | nein |
| app.js:242 | `feedUpd` | Feed nach Filter neu zeichnen | 3 | nein |
| app.js:243 | `exportBackup` | JSON-Export in die Textbox | 2 | nein |
| app.js:244 | `msNote` | Notiz zu einem Meilenstein (prompt) | 2 | nein |
| app.js:245 | `feedHTML` | Buchungsliste gruppiert nach Kategorie | 3 | nein |
| app.js:246 | `V` | Views je Tab (home, cash, assets, fire, plan, data, goals, tax, more, year, port, login, newpw, acct, crypto) | 35 | nein |
| app.js:289 | `pcalc` | Alte Prognose-Rechnung (wirkungslos, siehe Befund) | 3 | nein |
| app.js:300 | `render` | Hauptansicht rendern (Tabs, Panels, Sperr-Ansicht) | 113 | ja |
| features.js:7 | `num` | Text zu Zahl (Komma/Punkt) | 22 | nein |
| features.js:8 | `monthNow` | Aktueller Monat YYYY-MM (UTC-Datum) | 2 | nein |
| features.js:9 | `card` | Panel mit Titel | 41 | nein |
| features.js:10 | `button` | Menü-Button für ein Modul | 203 | nein |
| features.js:27 | `levelsHTML` | Runway-Stufen und Bearbeiten der Stufe 5 | 2 | nein |
| features.js:45 | `editRunway5` | Stufe-5-Formular öffnen | 2 | nein |
| features.js:46 | `cancelRunway5` | Stufe-5-Formular schließen | 2 | nein |
| features.js:47 | `saveRunway5` | Stufe-5-Name und -Ziel speichern | 2 | nein |
| features.js:60 | `autoRecurring` | Wiederkehrende Buchungen je Monat (einmal pro Monat) | 2 | nein |
| features.js:71 | `W.render` | Render-Wrapper: Monats-Automatik, Fuck-Off-Ansicht | 113 | ja |
| features.js:75 | `parseDate` | CSV: Datum (dd.mm.yyyy, ISO, dd/mm/yyyy) – Dublette, nicht genutzt | 5 | nein |
| features.js:82 | `parseCSV` | CSV-Parser (auto Trennzeichen) – Dublette, nur im toten CSV-Pfad | 4 | nein |
| features.js:108 | `guessCategory` | CSV: Kategorie aus Stichworten | 2 | nein |
| features.js:117 | `memoKey` | CSV: Schlüssel für Dublettenprüfung | 3 | nein |
| features.js:118 | `buildCSVRows` | CSV: Zeilen aus Spaltenwahl bauen (toter Pfad) | 3 | nein |
| features.js:131 | `csvLoad` | CSV einlesen (toter Pfad, V.csv wird in extras ersetzt) | 3 | nein |
| features.js:148 | `csvFile` | CSV-Datei lesen, UTF-8 mit Fallback (toter Pfad) | 2 | nein |
| features.js:153 | `csvSet` | CSV-Spalte setzen (toter Pfad) | 3 | nein |
| features.js:154 | `csvCat` | CSV-Kategorie setzen (toter Pfad) | 2 | nein |
| features.js:155 | `csvGo` | CSV-Buchungen übernehmen (toter Pfad, ohne Escaping) | 2 | nein |
| features.js:173 | `V.review` | Monatsrückblick-Ansicht (V.review) | 6 | nein |
| features.js:196 | `budgets` | Budget-Objekt S.bud anlegen | 3 | nein |
| features.js:197 | `allocation` | Ziel-Aufteilung S.f.alloc anlegen | 3 | nein |
| features.js:198 | `setBud` | Monatsbudget je Kategorie setzen | 2 | nein |
| features.js:199 | `setAl` | Ziel-Anteil je Art setzen | 2 | nein |
| features.js:205 | `V.rebal` | Rebalancing-Ansicht | 4 | nein |
| features.js:218 | `pinConfig` | PIN-Eintrag aus fr_pin lesen | 8 | nein |
| features.js:228 | `lockUI` | Sperr-Overlay mit Ziffernblock zeichnen | 8 | nein |
| features.js:235 | `pinKey` | Ziffer eingeben, prüfen, Fehlversuche speichern | 2 | nein |
| features.js:245 | `setPin` | PIN setzen (4–6 Ziffern, zweimal) | 2 | nein |
| features.js:252 | `rmPin` | PIN entfernen | 2 | nein |
| features.js:253 | `lockNow` | Sofort sperren | 4 | nein |
| features.js:259 | `V.sec` | Sicherheits-Ansicht (PIN, Auto-Sperre) | 5 | nein |
| features.js:266 | `fxP` | Eingaben des Fuck-Off-Rechners | 2 | nein |
| features.js:267 | `fxSim` | Ansparen und Entnahme mit Steuer je Jahr | 5 | nein |
| features.js:273 | `atY` | Wert einer Zeitreihe zu Jahr t | 4 | nein |
| features.js:274 | `maxW` | Höchste nachhaltige Monatsentnahme (Bisektion) | 2 | nein |
| features.js:275 | `fm` | Zahl mit 1 Nachkommastelle | 13 | nein |
| features.js:276 | `fxHTML` | Fuck-Off-Rechner-Ansicht | 2 | nein |
| features.js:283 | `fxToggle` | Annahmen-Formular ein/aus | 3 | nein |
| features.js:284 | `setFx` | Annahmen des Rechners speichern | 2 | nein |
| features.js:311 | `prPanel` | Panel der Prognose | 10 | nein |
| features.js:313 | `prDefaults` | Prognose-Startwerte setzen | 2 | nein |
| features.js:317 | `prHTML` | Prognose-Ansicht (V.plan) | 2 | nein |
| features.js:349 | `prChips` | Auswahl-Chips für Rendite und Teilfreistellung | 4 | nein |
| features.js:353 | `prUi` | Chips der Prognose aufbauen | 5 | nein |
| features.js:357 | `prSim` | Prognose-Simulation je Szenario | 3 | nein |
| features.js:381 | `prFin` | Endwert netto, real und Steuer | 2 | nein |
| features.js:387 | `prRun` | Prognose neu rechnen und alle Ausgaben setzen | 8 | nein |
| features.js:432 | `prLumps` | Einmalzahlungen anzeigen | 5 | nein |
| features.js:436 | `prPlanUi` | Gespeicherte Pläne laden, löschen, vergleichen | 4 | nein |
| features.js:449 | `prFromData` | Prognose aus Net Worth und Ø Sparen vorbelegen | 2 | nein |
| features.js:457 | `prInit` | Prognose-Ereignisse anhängen | 2 | nein |
| extras.js:5 | `card` | Panel mit Titel (Kurzform) | 41 | nein |
| extras.js:6 | `num` | Text zu Zahl | 22 | nein |
| extras.js:7 | `pad` | Zahl zweistellig | 16 | nein |
| extras.js:8 | `today` | Heutiges Datum YYYY-MM-DD (lokal) | 8 | nein |
| extras.js:9 | `addM` | Monat um k verschieben (YYYY-MM) | 11 | nein |
| extras.js:10 | `monLabel` | Monatsname kurz für Diagramme | 10 | nein |
| extras.js:11 | `txOf` | Buchungen eines Monats | 11 | nein |
| extras.js:12 | `colored` | Text grün/rot nach Vorzeichen | 3 | nein |
| extras.js:13 | `insAfterFirst` | Panel nach dem ersten Panel einfügen | 2 | nein |
| extras.js:14 | `wrap` | Ansicht V[name] um Zusatzinhalt erweitern | 12 | nein |
| extras.js:15 | `toast` | Kurzmeldung einblenden | 20 | nein |
| extras.js:16 | `ALLC` | Alle Kategorien (Einnahmen + Ausgaben) | 5 | nein |
| extras.js:30 | `suggestCat` | Kategorie-Vorschlag aus Verlauf und Stichworten | 4 | nein |
| extras.js:52 | `setSpl` | Sparziel speichern | 2 | nein |
| extras.js:53 | `useSpl` | Vorschlag als Sparziel übernehmen | 2 | nein |
| extras.js:54 | `spPanel` | Sparplan-Check (Soll/Ist) | 2 | nein |
| extras.js:75 | `expAt` | Zeitpunkt des letzten Datei-Backups (fr_exp) | 5 | nein |
| extras.js:76 | `dlBackup` | JSON-Backup als Datei laden | 5 | nein |
| extras.js:83 | `backupBanner` | Hinweis, wenn Backup fällig | 2 | nein |
| extras.js:93 | `pvToggle` | Ø variable Ausgaben in Vorschau ein/aus | 2 | nein |
| extras.js:94 | `pvPanel` | Vorschau nächste 3 Monate (Cash) | 2 | nein |
| extras.js:112 | `setMNote` | Monatsnotiz speichern | 2 | nein |
| extras.js:113 | `histPanel` | Monatsabschluss: letzte 6 Monate | 2 | nein |
| extras.js:123 | `tipsPanel` | Abschluss-Tipps und Monatsnotiz | 2 | nein |
| extras.js:139 | `topCats` | Häufigste Kategorien für Schnellerfassung | 3 | nein |
| extras.js:144 | `buildSheet` | Schnellerfassungs-Sheet im DOM anlegen | 2 | nein |
| extras.js:154 | `Q_manual` | Kategorie manuell gewählt merken | 4 | nein |
| extras.js:155 | `qChips` | Kategorie-Chips im Sheet | 5 | nein |
| extras.js:160 | `qSug` | Kategorie-Vorschlag beim Tippen | 2 | nein |
| extras.js:166 | `qOpen` | Schnellerfassung öffnen | 4 | nein |
| extras.js:172 | `qClose` | Schnellerfassung schließen | 4 | nein |
| extras.js:173 | `qSave` | Schnellbuchung speichern | 2 | nein |
| extras.js:178 | `buildFab` | „+“-Schaltfläche anlegen | 2 | nein |
| extras.js:185 | `parseCSV` | CSV-Parser mit festem Trennzeichen (Import) | 4 | nein |
| extras.js:198 | `normH` | Kopfzeile normalisieren | 2 | nein |
| extras.js:199 | `parseAmount` | Betrag aus de-DE/en-Text, (x) = negativ | 4 | nein |
| extras.js:208 | `parseDate` | Datum aus ISO, dd.mm.yyyy, dd.mm.yy; ungültige Tage abgelehnt | 5 | nein |
| extras.js:215 | `importText` | CSV-Text zu Vorschauzeilen (max. 1500, Duplikatprüfung) | 4 | nein |
| extras.js:246 | `impUndo` | Letzten Import rückgängig machen | 2 | nein |
| extras.js:252 | `impFile` | CSV-Datei lesen (UTF-8, Fallback Windows-1252) | 2 | nein |
| extras.js:265 | `impSet` | Zeile ein-/ausschalten oder Kategorie setzen | 3 | nein |
| extras.js:266 | `impAll` | Alle (ohne Duplikate) wählen oder abwählen | 3 | nein |
| extras.js:267 | `impClear` | Vorschau verwerfen | 2 | nein |
| extras.js:268 | `impGo` | Ausgewählte Zeilen importieren, Import merken | 2 | nein |
| extras.js:275 | `impPreview` | Vorschau-HTML des Imports | 3 | nein |
| extras.js:284 | `impDraw` | Vorschau neu zeichnen | 5 | nein |
| extras.js:285 | `impPanel` | Import-Panel | 2 | nein |
| extras.js:289 | `V.csv` | CSV-Import-Ansicht (ersetzt features.js) | 9 | nein |
| extras.js:293 | `secGet` | Datenschutz-Einstellungen (fr_sec) | 5 | nein |
| extras.js:294 | `secSet` | Datenschutz-Einstellung speichern | 3 | nein |
| extras.js:295 | `bkGet` | Tagessicherungen aus fr_bk lesen | 4 | nein |
| extras.js:297 | `autoSnap` | Tagessicherung schreiben (max. 5) | 4 | nein |
| extras.js:308 | `snapRestore` | Tagessicherung wiederherstellen | 2 | nein |
| extras.js:322 | `buildCover` | Sichtschutz-Overlay anlegen | 2 | nein |
| extras.js:326 | `cover` | Sichtschutz ein/aus (Wechsel, Hintergrund) | 13 | nein |
| extras.js:342 | `W.render` | Render-Wrapper: Backup-Hinweis, FAB, Sichtschutz | 113 | ja |
| boost.js:6 | `card` | Panel mit Titel (Kurzform) | 41 | nein |
| boost.js:7 | `num` | Text zu Zahl | 22 | nein |
| boost.js:8 | `clamp` | Wert auf Bereich begrenzen | 5 | nein |
| boost.js:9 | `pad` | Zahl zweistellig | 16 | nein |
| boost.js:10 | `today` | Heutiges Datum YYYY-MM-DD (lokal) | 8 | nein |
| boost.js:11 | `ymNow` | Aktueller Monat YYYY-MM | 7 | nein |
| boost.js:12 | `addM` | Monat um k verschieben (YYYY-MM) | 11 | nein |
| boost.js:13 | `monLabel` | Monatsname kurz | 10 | nein |
| boost.js:14 | `txOf` | Buchungen eines Monats | 11 | nein |
| boost.js:15 | `fm1` | Zahl auf eine Nachkommastelle | 5 | nein |
| boost.js:16 | `nS` | Zahl im Blur-Markup | 8 | nein |
| boost.js:17 | `go` | Tab-Wechsel als onclick-Text | 9 | nein |
| boost.js:18 | `reduced` | Bewegung reduzieren (prefers-reduced-motion) | 5 | nein |
| boost.js:19 | `toast` | Kurzmeldung (eigene Kopie) | 20 | nein |
| boost.js:20 | `yr0` | Aktuelles Jahr | 10 | nein |
| boost.js:21 | `rate` | Rendite aus S.f.r (Standard 6 %) | 11 | ja |
| boost.js:22 | `baseP` | Basisdaten für Szenarien (Net Worth, Sparrate, Rendite, Fuck-Off) | 5 | nein |
| boost.js:23 | `liquid` | Liquide Mittel | 5 | nein |
| boost.js:24 | `runwayM` | Runway in Monaten | 3 | nein |
| boost.js:25 | `loggedIn` | true, wenn die Hauptansicht geladen ist | 2 | nein |
| boost.js:28 | `spk` | Mini-Sparkline (SVG) | 4 | nein |
| boost.js:39 | `isDark` | Dunkelmodus laut Einstellung oder System | 2 | nein |
| boost.js:40 | `migrateTheme` | Einmalige Umstellung auf Automatik-Design | 2 | nein |
| boost.js:42 | `applyTh` | Design + Statusleisten-Farbe (Wrapper) | 9 | nein |
| boost.js:49 | `theme` | Design-Zyklus mit Hinweis | 5 | nein |
| boost.js:60 | `piS` | Passives-Einkommen-Objekt S.pi | 8 | nein |
| boost.js:61 | `piItems` | Gültige Passiv-Einträge | 5 | nein |
| boost.js:62 | `piSince` | Summe Passiv seit Datum | 3 | nein |
| boost.js:63 | `piMonthly` | Ø Passiv je Monat (12 Monate) | 3 | nein |
| boost.js:64 | `piSet` | Annahmen Ausschüttung/Zins/Miete | 3 | nein |
| boost.js:65 | `piPot` | Potenzial aus Bestand (Schätzung) | 4 | nein |
| boost.js:66 | `piEff` | Passiv wirksam: Ist oder Schätzung | 5 | nein |
| boost.js:67 | `piCov` | Deckung der Fixkosten durch Passiv in % | 3 | nein |
| boost.js:68 | `piGuess` | Kategorie aus Buchungstext | 2 | nein |
| boost.js:69 | `piCand` | Passende Buchungen im Cashflow finden | 3 | nein |
| boost.js:71 | `piAdd` | Passiv-Eintrag erfassen (optional mit Buchung) | 2 | nein |
| boost.js:78 | `piDel` | Passiv-Eintrag löschen (optional Buchung) | 2 | nein |
| boost.js:83 | `piImport` | Gefundene Buchungen übernehmen | 2 | nein |
| boost.js:88 | `piSetF` | Annahme speichern | 4 | nein |
| boost.js:90 | `piBars` | Balkendiagramm 12 Monate | 2 | nein |
| boost.js:102 | `V.passive` | Passiv-Ansicht | 7 | nein |
| boost.js:138 | `salary` | Ø Gehalt der letzten 12 Monate | 5 | nein |
| boost.js:142 | `jobC` | Job-Eingaben mit Grenzen | 4 | nein |
| boost.js:143 | `netAt` | Netto bei Teilzeit (Schätzung, K_NET 0,86) | 4 | nein |
| boost.js:144 | `simJob` | Job-Simulation: Ansparen, Sabbatical, Teilzeit | 7 | nein |
| boost.js:146 | `sab` | Platzhalter für Sichtschutz (Safari-Bereich) | 17 | nein |
| boost.js:160 | `at` | Wert einer Zeitreihe zu Jahr t | 11 | nein |
| boost.js:161 | `yTxt` | Jahre als Text | 3 | nein |
| boost.js:162 | `dTxt` | Differenz in Jahren als Text | 4 | nein |
| boost.js:163 | `setJob` | Job-Eingabe speichern | 8 | nein |
| boost.js:165 | `V.job` | Job-Szenario-Ansicht | 18 | nein |
| boost.js:199 | `V.fire` | Teaser „Was kostet Teilzeit?“ (Wrapper) | 12 | nein |
| boost.js:210 | `ring` | Fortschrittsring (SVG) | 3 | nein |
| boost.js:217 | `qInvest` | Schnellerfassung auf Sparen/Invest vorbelegen | 2 | nein |
| boost.js:218 | `homeFull` | Details ein/aus | 2 | nein |
| boost.js:219 | `alerts` | Hinweise: Backup, Notgroschen, Sparplan | 2 | nein |
| boost.js:230 | `V.home` | Fokus-Home (Wrapper) | 10 | nein |
| boost.js:259 | `cu` | Hochzähl-Animation (überschreibt app.js) | 3 | nein |
| boost.js:277 | `bars` | Balken mit Sparkline (überschreibt app.js) | 4 | nein |
| boost.js:286 | `confetti` | Konfetti bei Meilenstein | 3 | nein |
| boost.js:293 | `msCheck` | Meilenstein-Erkennung und Hinweis | 3 | nein |
| boost.js:307 | `standalone` | true bei Home-Bildschirm-App | 4 | nein |
| boost.js:308 | `offBar` | Offline-Leiste | 4 | nein |
| boost.js:318 | `V.more` | Mehr-Menü mit Passiv und Job (Wrapper) | 8 | nein |
| boost.js:336 | `W.render` | Render-Wrapper: Theme, Meilenstein-Check | 113 | ja |

## 3. Phase 2: Sicherheit

Jede Teilziffer hat einen Status: **behoben**, **gemeldet** oder **unkritisch**. Die Befund-IDs stehen in Abschnitt 4.

### 3.1 XSS und Ausgabe: behoben (Restbefunde gemeldet)

- **Innerhalb der Quelle:** 25 Zeilen mit Schreibzugriff auf `innerHTML` (Stand `e4e1ff9`: app.js 163, 226, 227, 229, 230, 242, 292, 294, 300, 301; features.js 233, 350, 404, 417, 418, 427, 429, 433, 438, 447; extras.js 147, 157, 168, 284, 324). Dazu lesende Zugriffe in boost.js:25 und am Ende von extras.js (`qfab`). Die Ansichten `V.*` sind die eigentliche Quelle (Ausgabe per `$('v').innerHTML = V[tab]()`). Die Zeilen 300 und 301 in app.js schreiben zwei Ziele.
- **Herkunft der Daten:** Nutzereingabe (Formulare), Backup-Import (JSON), CSV-Import (Text), Cloud-Stand (`finance_state`, nicht geprüft beim Laden), CoinGecko (Namen, IDs, Symbole), lokale Einstellungen (`fr_pin`, `fr_sec`, `fr_cg`).
- **Behoben:** S-01 (kritische Attributhülle in `histHTML`), S-02 (Passiv-Löschen mit ID aus dem Backup), S-03 (`esc()` neu, Speichern über `clean()` mit altem Textformat), S-04 (CoinGecko-Namen), S-05 (Verteidigungstiefe an allen Textsenken mit Nutzerdaten). Beleg: `tests/security.test.cjs` (6 Tests), Chrome-Probe, Grep-Prüfung der Restsenken (verbleibend nur feste Texte, Zahlen, Farben).
- **Gemeldet:** S-06 (toter CSV-Pfad in features.js ohne Escaping).
- **Restrisiko:** `'unsafe-inline'` (S. 3.2). Inline-Handler bleiben.

### 3.2 Header und Auslieferung: behoben (Cache-Prüfung offen)

- **behoben (S-07):** CSP, HSTS, COOP, CORP in `vercel.json`. Beleg: Header über lokalen Server geprüft, Chrome lädt die Login-Ansicht ohne CSP-Meldung. Abgleich mit den Netzwerkaufrufen: `fetch(` nur in app.js (CoinGecko-Aufrufe in `cgPump`, `liveFetch`, `cgPrice`, `sugg`, `pick`) und sw.js; `createClient` für Supabase; `connect-src` deckt `*.supabase.co` (https und wss) und `api.coingecko.com` ab. Keine Fonts, keine externen Bilder, keine Inline-`<script>`-Blöcke in `index.html`.
- **Restrisiko:** `'unsafe-inline'` in `script-src` (Inline-`onclick` in ca. 100 Stellen (Quelle und erzeugtes HTML)) und in `style-src` (154 `style=`-Attribute). Ausbau-Vorschlag: Handler auf `addEventListener` umstellen, dann `'unsafe-inline'` streichen (Phase 4/5).
- **Nicht geprüft:** Cache-Header für statische Dateien (S-34). Lokal getestet, Vercel-Antwort nicht.

### 3.3 Supply Chain: behoben (SRI), Advisory: unkritisch

- **behoben (S-08):** `integrity="sha384-UagCvV…"` und `crossorigin="anonymous"` am Supabase-Skript (`index.html:5`). CI-Schritt `validate.yml` vergleicht den Hash mit der live CDN-Datei. Die Regex des bestehenden Checks (`@supabase\/supabase-js@2\.118\.0`) passt weiterhin.
- **Service Worker und CDN:** Der SW cached das CDN-Skript (cache-first, Hintergrund-Aktualisierung). Mit SRI prüft der Browser die Datei auch aus dem Cache. Mit neuer `VERSION` werden alte Cache-Einträge (teils ohne CORS) bei der Aktivierung gelöscht.
- **Advisory:** keine Einträge in der npm-Registry für 2.118.0 (Abfrage 2026-10-26). Keine Gewähr, siehe 1.2.

### 3.4 Login, Sitzung, Geheimnisse: gemeldet (Secrets: unkritisch)

- **Auth-Ablauf gelesen:** `initAuth`, `login`, `magic`, `forgot`, `setPw`, `logout`, `pull`, `continueWithCurrentData` (app.js 49–88).
- **Fehlermeldungen (S-12):** `em()` übersetzt „User already registered“ zu „Diese E-Mail ist schon registriert“. Das verrät bei der Registrierung, ob ein Konto existiert. `forgot()` meldet immer „gesendet“ (gut). Änderung nicht vorgenommen: sichtbares Verhalten, Henne entscheidet.
- **Passwortregeln (S-14):** Mindestlänge 6 (clientseitig; vermutlich der Supabase-Standard, nicht geprüft). Kein Bestätigungsfeld bei Registrierung und Passwortänderung. `autocomplete` ist gesetzt (`username`, `current-password`, `new-password`).
- **Redirect-URL (unkritisch):** `location.origin + location.pathname`, fest, nicht aus Parametern übernommen.
- **localStorage bei Abmeldung (S-13):** `logout(true)` löscht `fr_s`, `fr_bk`, `fr_exp`. Nicht gelöscht: `fr_pin`, `fr_sec`, `fr_cg`. `fr_cg` enthält nur Kurse (unkritisch), `fr_pin` ist ein Gerätesperr-Eintrag (Entscheidung Henne, ob er beim Löschen mit weg soll).
- **Konto-Wechsel (unkritisch, Hinweis):** `pull()` setzt `S` zurück, wenn `S.uid` einem anderen Konto gehört (app.js:55). Lokale Daten ohne `S.uid` (vor dem Login erfasst) gehen beim ersten Login in das Konto. Das entspricht der README, ist aber nicht per Test abgesichert.
- **Secret-Scan (unkritisch, S-20):** Arbeitsbaum und gesamte Historie (`git log --all -p`) auf `service_role`, `sb_secret`, `eyJ…`, `PRIVATE KEY`, `sk_live`. Nur Treffer in Kommentaren, Dokumentation und in der Regex von `validate.yml`. Kein Schlüsselwert. `sb_publishable_…` in `config.js` ist öffentlich und vorgesehen.
- **console-Aufrufe (unkritisch, S-28):** keine `console.*`-Aufrufe in den App-Dateien.

### 3.5 PIN-Sperre und Datenschutz-Modus: behoben (Sichtschutz-Grenzen gemeldet)

- **behoben (S-09, S-10):** PIN-Eintrag v2: PBKDF2-SHA-256, 310.000 Iterationen, 16 Byte Zufallssalt. Alte Einträge (ungesalzenes SHA-256) bleiben gültig und werden beim nächsten Entsperren umgestellt. Fehlversuche werden in `fr_pin` gespeichert (vorher nur im Speicher, Neuladen setzte den Zähler zurück). Sperrzeit nach jeweils drei Fehlern: 30 s, 60 s, 120 s … höchstens 15 min. Beleg: `tests/pin.test.cjs` (5 Tests: richtige und falsche PIN, Salt, Altformat, Staffelung).
- **Sichtschutz, keine Verschlüsselung:** Die Sperre schützt die Oberfläche auf dem Gerät. Die Daten liegen unverschlüsselt in `localStorage` (`fr_s`, `fr_bk`). Ein Zugriff mit Entwicklerwerkzeugen oder ein Auslesen des Speichers umgeht die Sperre. Das steht bereits im Hinweis der Sicherheits-Ansicht und wird hier als Restrisiko geführt.
- **Lücken (gemeldet, S-11):** Die App rendert beim Start, bevor `features.js` das Sperr-Overlay einfügt. Gemessen wurde das im Browser nicht. Nicht geprüft: Stealth-Vorhang (`buildCover`) nach dem ersten Render, App-Umschalter-Vorschau (hängt am `visibilitychange`-Ereignis). Blur in SVG und Sankey: nur per Code gelesen (`blurNums`, `blurHtml`), nicht im Browser geprüft.
- **Auto-Sperre (unkritisch):** Inaktivitäts-Sperre läuft über `setInterval` (15 s), nur mit PIN und nicht während `.lk` offen ist.

### 3.6 Import, Export, CSV: behoben (Rest gemeldet)

- **Backup-Import (vorhanden, geprüft):** Prototyp-Schlüssel (`__proto__`, `constructor`, `prototype`) werden verworfen; Strings auf 5.000 Zeichen gekürzt; Listen max. 20.000 Einträge; Objekte max. 500 Felder; Tiefe max. 12; Datei max. 2 MB; Zahlen ohne endliche Werte werden 0 (`numberField`). Tests: `tests/import-safety.test.cjs` (5 Tests, unverändert).
- **behoben (S-15):** `31.02.` wurde als `2026-02-31` übernommen. Jetzt Kalenderprüfung, die Zeile zählt als übersprungen.
- **behoben (S-16):** Mehr als 1.500 CSV-Zeilen wurden stillschweigend abgeschnitten. Jetzt Hinweis in der Vorschau.
- **Kodierung und Trennzeichen (geprüft, Test):** UTF-8 (fatal), Fallback Windows-1252; Trennzeichen wird aus den ersten 12 Zeilen erkannt (Semikolon, Komma, Tab); Anführungszeichen mit `""`-Escape. Tests: `tests/csv-import.test.cjs`.
- **CSV-Formelinjektion (S-19):** Nicht zutreffend. Die App hat keinen CSV-Export (nur JSON-Backup). Import-Text landet als Notiz, nicht als Formel.
- **Gemeldet:** S-17 (Backup-Datumsfelder und Typen nicht geprüft, Textbeträge werden 0), S-18 (Backup enthält `S.uid`).
- **Backup-Dateiname:** `finanz-radar-backup-JJJJ-MM-DD.json` (lokales Datum). Kein Konto-Name, keine E-Mail im Namen.

### 3.7 Service Worker: unkritisch (Hinweise gemeldet)

- **Gecacht werden nur:** eigene GET-Antworten mit `res.ok` und `res.type === 'basic'` (sw.js, Zeile 28). API-Aufrufe (Supabase, CoinGecko) werden nie gecacht (sw.js, Zeile 44: CDN nur für das Skript). Beleg: `tests/boost.test.cjs` (prüft Ausschluss von `supabase.co` und `coingecko`).
- **Navigation:** Fallback auf `index.html`, `ignoreSearch` nur im Fallback.
- **Update:** neue `VERSION` pro App-Änderung, `skipWaiting` und `clients.claim`. Geöffnete Tabs können kurz mit neuem SW und altem Stand arbeiten (Hinweis).
- **Halb geladener Cache (S-27):** `install` ignoriert Fehler einzelner Dateien (`.catch(() => null)`), der SW aktiviert sich trotzdem. Folge: fehlende Dateien bis zum nächsten Online-Start.

### 3.8 Supabase-Schema (nur lesen): gemeldet (Vorschlag abgelegt)

- **Geprüft in `schema.sql`:** `enable row level security` ✓, `revoke all … from anon, PUBLIC` ✓, `grant select, insert, update, delete … to authenticated` ✓, vier Policies mit `(select auth.uid()) = user_id` ✓ (`using` und `with check`).
- **Fehlt (S-24):** Größenlimit für `data`, Vorbelegung `user_id` mit `auth.uid()`, optionaler `updated_at`-Trigger (mit Warnung: die App nutzt Client-Zeitstempel für Last-Write-Wins).
- **Vorschlag:** `vorschlaege/schema-haertung.sql` (nicht ausgeführt). Commit `707cff1`.
- **Live-Prüfung durch Claude am 27.10.2026:** Supabase-Advisor: einzige Warnung „Leaked Password Protection disabled“ (Dashboard-Einstellung, Henne). Performance-Advisor ohne Befund. RLS-Policies von `finance_state` bestätigt, `anon` ohne Rechte.
- **Neu (Nachabnahme):** `authenticated` hat auf `finance_state` die Rechte TRUNCATE, REFERENCES und TRIGGER. RLS greift bei TRUNCATE nicht, und die Data API bietet TRUNCATE nicht an. Risiko daher niedrig, Entziehen ist Best Practice. Der Vorschlag enthält dafür `revoke truncate, references, trigger on table public.finance_state from authenticated;` (Commit `7204417`, nicht ausgeführt). Gilt analog für `user_state` (nur im Kommentar erwähnt).
- **Teilweise geprüft (S-25):** Advisors und Policies von `finance_state` am 27.10.2026 (siehe oben). Nicht geprüft: `user_state`-RLS.

### 3.9 Öffentliches Repo: gemeldet

- **Commit-Metadaten (S-21):** Die private Adresse `thehenne@googlemail.com` steht als Autor in 43 Commits. Der Autor `Claude <noreply@anthropic.com>` in 5 Commits. Die Historie lässt sich nicht ändern. Entscheidung Henne.
- **Dokumente (S-23):** README und CHATGPT-ANLEITUNG enthalten keine Beträge, Klarnamen oder E-Mail-Adressen. Genannt werden der Projektname „Liquid-Wealth“ und die Tabelle `user_state`. Das ist Betriebswissen, kein Geheimnis, aber öffentlich.
- **Veraltete Aussage (S-22):** README sagt, `config.js` sei leer. Die Datei enthält URL und publishable Key.
- **Code:** Die Prognose-Ansicht verlinkt `claude.ai/artifact/…` (app.js, `plan()`, toter Code). Kein Befund.

## 3a. Phase 3: Funktionen, Berechnungen und Logik

**Stand:** Phase 3 (Abschnitt 4 des Plans, Punkte 4.1 bis 4.9) ist bearbeitet. 16 Commits (`3213d2b` bis `93d11b7`). Tests: vorher 28, nachher 121, alle grün. Kein Push, kein Deploy, keine echten Daten, keine neue Abhängigkeit, kein Build-Schritt. Datenmodell `S`, fachliche Regeln der README (Sparquote, Feed, „Fuck Off“, Blur, Datenfelder, lokale Schlüssel `fr_pin`, `fr_sec`, `fr_bk`, `fr_exp`) unverändert. Offen sind die in 3a.8 genannten Punkte (Entscheidungen Henne und Grenzen der Prüfung).

### 3a.1 Vorgehen und Werkzeuge

- **Harness** `tests/harness/load-app.cjs`: lädt `config.js`, `app.js`, `features.js`, `extras.js`, `boost.js` in dieser Reihenfolge in einen vm-Kontext (gemeinsamer Gültigkeitsbereich wie im Browser). DOM-Stub mit IDs aus `index.html` und aus `innerHTML`, `localStorage`-Stub, manuelle Timer, `fetch` ohne Netz (Standard: Fehler), festes Datum mit Zeitzone (`process.env.TZ`).
- **Fake-Supabase** `tests/harness/fake-supabase.cjs`: ein gemeinsamer Server für mehrere Geräte (Upsert, Select, Auth, Offline, 413).
- **Reine Funktionen** werden wie in `import-safety.test.cjs` aus dem Quelltext geladen (`prSim`, `prFin`, `fxSim`, `maxW`, `simYears`, `parseAmount`, `parseDate`, `netAt`, `simJob`, beide `parseCSV`).
- **Unabhängige Nachrechnung** `tests/reference/forecast.cjs`: eigene Formeln und Monatsschleifen, ohne Code aus der App.
- **Regressionsvergleich** (3a.4): Phase-2-Stand gegen den aktuellen Stand, alle 19 Ansichten für vier Fixtures (leer, klein, Grenzfälle, extrem), Text-Diff.
- Die Fixtures aus Phase 1 werden jetzt genutzt (`views-smoke`, `kennzahlen`, `vermoegen`, `prognose`).

**Prüfprotokoll Phase 3** (Befehle und Ergebnisse, vorher und nachher):

| Prüfung | Befehl | vorher (`abc4c6c`) | nachher (`93d11b7`) |
|---|---|---|---|
| Syntax | `node --check app.js config.js features.js extras.js boost.js sw.js` | alle 6 OK | alle 6 OK |
| Tests | `node --test tests/*.test.cjs` | 28 von 28 bestanden | 121 von 121 bestanden |
| Regressionsvergleich | Ansichten × Fixtures (3a.4) | Referenz: Phase-2-Stand | 12 Textstellen geändert, alle in 3a.5 |
| Laufzeit (nur Information, Phase 5 misst im Browser) | `render()` je Ansicht, Extrem-Fixture, Node mit DOM-Stub | nicht gemessen | 0 bis 103 ms je Ansicht |
| Ladereihenfolge | Harness lädt `config.js`, `app.js`, `features.js`, `extras.js`, `boost.js` | nicht geprüft | ohne Fehler (Test) |

### 3a.2 Berechnungen: Formel, Test, Status

Status: **geprüft** = Test grün, Ergebnis stimmt; **behoben** = Fehler gefunden, Test vorher rot, jetzt grün; **gemeldet** = nicht geändert (Regel 10), siehe 3a.8 und Befundtabelle.

| Nr | Berechnung (Funktion) | Formel in einem Satz | Test | Status |
|---|---|---|---|---|
| R-01 | Anzeige `eur()`, `pct()`, `tv()` | Kaufmännisch auf ganze Euro bzw. 0,1 % gerundet, Vorzeichen getrennt; ungültige Zahl → „–“, kein Minus-Null | `numbers.test.cjs` | behoben (B-07) |
| R-02 | Net Worth `nn()` | Summe aller Positionen (Menge × Kurs) minus Summe der Schulden; Home, Vermögen, Portfolio und Prognose zeigen 11.500 € (Fixture klein) | `kennzahlen.test.cjs` | geprüft |
| R-03 | Sparquote (`invSum`, Home, Monatsrückblick, Jahr) | Summe „Sparen/Invest“ ÷ Einnahmen × 100; ohne Einnahmen „–“ | `kennzahlen.test.cjs` (10 %, „–“, 6,7 % im Jahr) | behoben (B-06) |
| R-04 | Monatssummen (`sm`, `mt`) | Einnahmen = Summe der Einnahme-Kategorien; Ausgaben = übrige Kategorien ohne „Sparen/Invest“; Cashflow = Einnahmen − Ausgaben (August: 3.000 / 1.111 / 1.890 €) | `kennzahlen.test.cjs` (Home, Rückblick, Cashflow, Jahr) | geprüft |
| R-05 | Kalendertag und Monat (`ymdOf`, `ymOf`, `snap`, `doTr`, `autoRecurring`, Sparplan, Tagessicherung) | Datum und Monat aus lokaler Zeit (`getFullYear/getMonth/getDate`), nicht aus UTC | `dates.test.cjs` (Monatsgrenze, Jahreswechsel, Winter- und Sommerzeit 2026, Sicherung je Ortstag) | behoben (S-31) |
| R-06 | Haltefrist (`heldMore1Y`, `hf`, `tax`) | Steuerfrei nur, wenn der Verkauf nach Kaufdatum + 1 Kalenderjahr liegt; ohne Kaufdatum Haltefrist | `krypto.test.cjs` (Jahrestag, Schaltjahr, zwei Lots) | behoben (B-05) |
| R-07 | FIFO-Verkauf (`doTr`) | Gewinn = Menge × Verkaufspreis − Gebühr − Σ Einstand der ältesten Lots; Gebühr anteilig; Spekulationsgewinn = Lots unter 1 Jahr (Beispiel: 590 € gesamt, 395 € kurz gehalten) | `krypto.test.cjs` | geprüft |
| R-08 | Steuer der Verkäufe (`tax`) | Kapitalerträge: max(0; Gewinn − 1.000 €) × 26,375 %, ETF mit 70 % angesetzt; Krypto/Gold: Freigrenze 1.000 €, darüber persönlicher Satz (30 %) auf den gesamten Spekulationsgewinn (Beispiel: 1.100 € → 330 €) | `krypto.test.cjs` | geprüft, Annahmen offen (B-17) |
| R-09 | Ø Kaufpreis (`assetRow`) | Einstand (Σ Menge × Preis + Gebühr) ÷ Menge (Beispiel: 2 × 100 € und 3 × 200 € → 160 €) | `krypto.test.cjs` | geprüft |
| R-10 | Kursdaten CoinGecko (`cgClean`, `liveFetch`, `cgPrice`, `cgPump`) | Übernommen nur Einträge mit Text-ID, Name, Symbol und endlichem Preis; Anfragen enthalten nur kodierte Coin-IDs | `coingecko-daten.test.cjs` | behoben (B-10, B-23 gemeldet) |
| R-11 | Verlaufs-Cache (`need`, `series`) | Eintrag gilt nach TTL (1 Tag: 3 min … 1 Jahr: 6 h), danach Neuabruf; 429 pausiert die Warteschlange | `coingecko-daten.test.cjs`, `coingecko-queue.test.cjs` | geprüft; „Kurs veraltet“ fehlt (B-21) |
| R-12 | Prognose Endwert (`prSim`) | Monatlich verzinst mit äquivalentem Monatszins (1 + r − TER)^(1/12) − 1; Sparrate am Monatsende, je Jahr × (1 + dyn); Einmalzahlungen am Jahresende. Beispiel 10.000 € Start, 500 €/Monat, 5 % p. a., 20 Jahre: **229.435,22 €** | `prognose.test.cjs` (cent-genau) | geprüft (B-18 Modell offen) |
| R-13 | Steuer der Prognose (`prFin`) | Steuer = max(0; Gewinn × (1 − TF) − Pauschbetrag) × Satz, am Ende der Ansparphase (Beispiel: 18.094,48 €, TF 30 %, Pauschbetrag 1.000 €, 26,375 %; netto 211.340,74 €) | `prognose.test.cjs` | geprüft (B-17) |
| R-14 | Kaufkraft (`prFin`, `prRun`) | Nominalwert ÷ (1 + Inflation)^Jahre; Real-Rendite = (1 + r − TER)/(1 + Inflation) − 1 | `prognose.test.cjs` | geprüft |
| R-15 | Entnahmephase (`prSim` mit Entnahme) | Entnahme/Monat = Betrag × (1 + Inflation)^Jahr; Steuer je Kalenderjahr auf den anteiligen Gewinn, Pauschbetrag je Jahr. Beispiel 1.500 €/Monat, 25 Jahre: netto 264.119,46 €, Steuer 27.133,90 €, Kapital erschöpft im Jahr 30 | `prognose.test.cjs` (Monatsschleife) | geprüft |
| R-16 | Zielzeit (`simYears`) | Kleinste Monatszahl mit Endwert ≥ Ziel, angegeben als Monate ÷ 12; nie erreichbar → „–“ | `prognose.test.cjs` | geprüft |
| R-17 | Fuck-Off-Zahl (`fireF`) | Ausgaben × 12 ÷ Entnahmerate; Entnahmerate ≤ 0 oder ungültig → 4 % (wie in der Anzeige) | `fuckoff.test.cjs` (600.000 € bei 2.000 € Ausgaben) | behoben (B-12), Basis offen (B-16) |
| R-18 | Fuck-Off-Rechner (`fxSim`) | Monatlich ansparen bis zur Zielzahl (k Monate → k/12 Jahre), danach jährlich entnehmen mit Steuer (70 % Gewinnanteil, Pauschbetrag). Beispiel: 42,917 Jahre bis zum Ziel, Erschöpfung im Entnahmejahr 14 | `prognose.test.cjs` | geprüft (70 % fest, B-17) |
| R-19 | Höchste nachhaltige Entnahme (`maxW`) | Bisektion über die Monatsentnahme; 99 % des Maximums hält das Kapital, 101 % nicht | `prognose.test.cjs` | geprüft |
| R-20 | Runway-Stufen (`levelsHTML`) | Runway = liquide Mittel ÷ Fixkosten; Stufen 1 bis 3 mit liquiden Mitteln, Stufe 4 und 5 mit Net Worth; Zielzeit nur bei Ziel > 0 | `fuckoff.test.cjs` | behoben (B-13) |
| R-21 | Fixkosten (`fixk`) | Summe wiederkehrender Ausgaben, sonst Ø Ausgaben | `erweiterungen.test.cjs` (Notgroschen, Passiv) | geprüft; Basis weicht von R-17 ab (B-16) |
| R-22 | Passives Einkommen (`piPot`, `piCov`) | Potenzial je Monat = ((ETF + Aktien) × Ausschüttung + Cash × Zins) ÷ 12 + Miete; Deckung = Potenzial ÷ Fixkosten (Beispiel: 9,08 € bzw. 1,0 %) | `erweiterungen.test.cjs` | geprüft |
| R-23 | Netto bei Teilzeit (`netAt`) | Netto = Brutto × (1 − (1 − Anteil) × 0,86); Näherung, im UI als Schätzung gekennzeichnet (80 %: 2.484 € bei 3.000 € Brutto) | `erweiterungen.test.cjs` | geprüft, Näherung |
| R-24 | Sparplan-Rest (`spPanel`) | Rest = Ziel − Ist; Ist = Σ „Sparen/Invest“ des Monats (Beispiel: 500 − 300 = 200 €) | `erweiterungen.test.cjs` | geprüft |
| R-25 | Vorschau Cash (`pvPanel`) | Cash_k = Cash_(k−1) + Einnahmen − (Vorlagen-Ausgaben + Ø variable Ausgaben) − Vorlagen-Investitionen; Ø variable = max(0; Ø Ausgaben − Vorlagen). Beispiel Fixture klein im Oktober: 4.057 € und 3.115 € | `erweiterungen.test.cjs` | geprüft |
| R-26 | Notgroschen-Reichweite (`egCore`) | Stand ÷ Fixkosten (5.000 € ÷ 900 € = 5,6 Monate) | `erweiterungen.test.cjs` | geprüft |
| R-27 | Meilenstein (`msCheck`) | Höchster erreichter Wert aus 10 T … 1 M € und Fuck-Off-Zahl; Meldung nur bei neuem Höchstwert | `erweiterungen.test.cjs` (10.000 €) | geprüft |
| R-28 | Sankey-Flüsse (`sankey`) | Breite = a × b ÷ T × k mit T = max(Einnahmen, Ausgaben + Investiert); Beschriftungen mit Mindestabstand | `erweiterungen.test.cjs` (ohne NaN, ohne negative Maße) | teilweise (Summen nicht getrennt geprüft) |
| R-29 | Feed-Reihenfolge (`feedHTML`) | Gruppen nach Summe absteigend, innerhalb nach Betrag absteigend; Erstattung in Ausgaben als Plus | `erweiterungen.test.cjs`, `numbers.test.cjs` | behoben (B-08) |
| R-30 | Wiederkehrende Buchungen (`autoRecurring`, `applyRec`) | Je Vorlage und Monat genau eine Buchung, Datum Tag 1; mehrfacher Start ändert nichts | `buchungen.test.cjs` | geprüft; keine Pause/Beenden (B-20) |
| R-31 | Monat übernehmen (`copyMo`) | Tag = min(Tag der Quelle, letzter Tag des Zielmonats) | `buchungen.test.cjs` (28. Februar, 30. April, 29. Februar 2028) | behoben (B-09) |
| R-32 | Monatsnavigation (`sh`) | Monat + d über Jahreswechsel und in die Zukunft | `erweiterungen.test.cjs` | geprüft |
| R-33 | Historie (`histPick`, `histUniq`, `snap`, `addHist`) | Je Monat ein Eintrag: der manuelle, sonst der zuletzt gespeicherte; Verlauf und Rückblick nutzen dieselbe Auswahl | `vermoegen.test.cjs` | behoben (B-14) |
| R-34 | Bearbeiten (`edSave`) | Leeres Datum (Buchung) und ungültiger Monat (Historie) ändern den Eintrag nicht | `vermoegen.test.cjs` | behoben (B-15) |
| R-35 | Tagessicherung (`autoSnap`) | Höchstens 5 Einträge; je Ortstag einer; Sicherungen mit Kennzeichen (Cloud-Abgleich) werden nie ersetzt | `erweiterungen.test.cjs`, `dates.test.cjs` | behoben (S-31) |
| R-36 | CSV-Import (`parseDate`, `parseAmount`, `importText`, Duplikate, Rückgängig) | Datum nur mit gültigem Kalendertag; Betrag mit de-DE/en-Schreibweise und Klammern; Duplikat = gleiches Datum, gleicher Betrag in Cent und passende Art; Rückgängig entfernt genau die Ids des letzten Imports | `csv-import.test.cjs`, `erweiterungen.test.cjs` | geprüft |
| R-37 | Sync (`push`, `pull`, `save`, `keepSnap`, `continueWithCurrentData`) | Upload erst nach Lesen des Cloud-Stands; S.ts wird erst nach dieser Prüfung gesetzt; vor jedem Überschreiben lokale Sicherung; Last-Write-Wins nach Gerätezeit | `sync.test.cjs` (12 Szenarien), `speicher.test.cjs` (2) | behoben (B-01 bis B-04); LWW bleibt (B-03, Entscheidung Henne) |

### 3a.3 Ergebnis der Prüfung nach Punkten (4.1 bis 4.9)

- **4.1 Geld und Zahlen:** Anzeige behoben (R-01), Kennzahlen per Test über alle Ansichten (R-02 bis R-04). Gleitkomma: Summen laufen als Fließkommazahlen, die Anzeige rundet auf ganze Euro; Vergleiche mit Toleranz. Keine Umstellung auf Cent-Ganzzahlen (würde das Datenformat ändern, Regel 10).
- **4.2 Datum und Zeit:** S-31 behoben (R-05). `parseDate` und `parseAmount` mit den Schreibweisen aus dem Plan getestet (R-36). Monatsnavigation getestet (R-32).
- **4.3 Cashflow, Sparquote, Feed:** R-03, R-04, R-29, R-30, R-31, Vorschau und Sparplan (R-24, R-25). Erstattungen behoben (B-08).
- **4.4 Vermögen, Historie, Schulden:** R-02, R-33, R-34. Schuldenabbau mit Zins und Restlaufzeit ist im Code nicht vorhanden (B-19, gemeldet). `need` ist der Verlaufs-Loader für Kurse, nicht die Zielrechnung.
- **4.5 Krypto und Kurse:** R-07 bis R-11. Durchschnittspreis und Verkauf über den Bestand hinaus (abgelehnt, getestet).
- **4.6 Prognose und Fuck-Off:** R-12 bis R-20, gegen die Nachrechnung auf den Cent. Steuer- und Zinsannahmen offengelegt (B-17, B-18). Gespeicherte Pläne (Laden, Löschen) sind nicht testbar (B-27).
- **4.7 Erweiterungen:** R-22 bis R-27 und R-35, R-36. Job-Modell mit Näherung (R-23). Nicht gesondert geprüft: Schnellerfassung, Monatsabschluss-Notiz, Alarme außer Backup-Hinweis, Meilenstein-Notizen (B-27).
- **4.8 Synchronisierung:** B-01 bis B-04 behoben, B-03 mit Entscheidung offen, B-24 (Neuversuch) gemeldet. Szenarien: zwei Geräte, Debounce, Offline, 413, Konto-Wechsel, Sitzung abgelaufen, ungesicherte Offline-Änderungen, gleichzeitiger Upload, Altdaten in `user_state`, kaputtes `fr_s`.
- **4.9 Ladereihenfolge:** Alle fünf Dateien laden ohne Fehler im gemeinsamen Gültigkeitsbereich (Test). Kein TDZ-Fehler beim Start. `parseCSV` existiert zweimal: die Version in `extras.js` ist die aktive (Vorschau und Import), die in `features.js` ist toter Pfad. Beide werden verglichen (gleiche Ausgabe für Semikolon-Dateien; nur die aktive kennt Tab-Trennung). Entfernen in Phase 5 (B-29).

### 3a.4 Regressionsvergleich (Phase 2 gegen Phase 3)

Gleiches Datum (15.08.2026, Europe/Berlin), gleiche Fixtures, alle Ansichten und die Home-Details. Ergebnis: **12 von ca. 160 Textzeilen** unterscheiden sich. Alle Unterschiede gehören zu SÄ-1 (Sparquote „–“), SÄ-2 (Vormonatsvergleich entfällt), SÄ-3 (halbe Euro negativ), SÄ-7 (Runway-Stufe ohne Zeitangabe) oder SÄ-8 (Historie je Monat einmal). Die übrigen Änderungen (SÄ-4 bis SÄ-6, SÄ-9 bis SÄ-16) betreffen Fälle, die die Fixtures nicht enthalten; sie sind über Tests belegt. Der Vergleich liegt im Scratchpad (`dump.cjs`, `dump_old.txt`, `dump_new.txt`) und ist nicht im Repo.

### 3a.5 Sichtbare Änderungen (Vorher / Nachher)

Für Henne sichtbar, bei den Fixtures oder in der Praxis:

- **SÄ-1 Sparquote ohne Einnahmen:** „0 %“ wird „–“ in Home-Details, Monatsrückblick und Jahresübersicht. Beispiel: Oktober 2026 ohne Einnahmen (Fixture: Home-Details `0 %` → `–`).
- **SÄ-2 Vormonatsvergleich der Sparquote:** „+0 %-Pkt. zum Vormonat“ entfällt, wenn der Vormonat keine Einnahmen hat (Monatsrückblick).
- **SÄ-3 Halbe Euro bei negativen Werten:** kaufmännisch gerundet, Vorzeichen getrennt. Vorher → nachher: Cashflow-Vorschau Vormonat −210 € → −211 €; Jahresübersicht Cashflow −45 € → −46 €; Job-Vergleich −847 € → −848 €, −417 € → −418 €. Positive halbe Euro bleiben gleich (2,50 € → 3 €).
- **SÄ-4 Minus-Null:** „−0,30 €“ wird „0 €“ statt „-0 €“.
- **SÄ-5 Ungültige Zahlen:** „NaN €“ und „Infinity €“ werden „–“ (betrifft nur defekte Daten).
- **SÄ-6 Erstattung in einer Ausgabenkategorie:** vorher „−-40 €“ (rot), nachher „+40 €“ (grün). Betrifft jede Erstattung in der Buchungsliste.
- **SÄ-7 Runway-Stufen:** Die Zeitangabe „ca. 0,0 Jahre“ entfällt bei Stufen ohne Ziel (leere Daten, Tab Fuck Off).
- **SÄ-8 Historie:** Gibt es zwei Einträge für einen Monat (z. B. nach einem Import), erscheint der Monat einmal (Vorher: Monat zweimal, Verlauf und Rückblick konnten verschiedene Werte zeigen). Im Fixture Grenzfälle: Verlauf zeigt „2026-01 1.100 €“ statt zusätzlich „2026-01 1.000 €“.
- **SÄ-9 Haltefrist Krypto/Gold:** Am Jahrestag des Kaufs gilt das Lot noch als Haltefrist. Beispiel: Kauf 01.11.2025; am 01.11.2026 vorher „steuerfrei (>1 J.)“, nachher „in Haltefrist bis 1.11.2026“ und steuerpflichtig. Ab 02.11.2026 unverändert steuerfrei. Bei mehreren Lots nennt „bis“ das späteste Ende (vorher das früheste). Verkäufe am Jahrestag werden jetzt als Spekulationsgewinn gebucht.
- **SÄ-10 Erste Stunde des Monats (00:00 bis 01:00/02:00 Ortszeit am 1.):** Die App öffnet im richtigen Monat; Standard-Buchungsdatum, Verkaufsdatum, Verlaufspunkt und wiederkehrende Buchungen tragen das richtige Datum (vorher Vormonat). Nur in dieser Zeitspanne sichtbar.
- **SÄ-11 Monat übernehmen:** 31. Januar → 28. Februar (vorher „31.02.“, ungültiges Datum).
- **SÄ-12 Fuck-Off-Zahl bei Entnahmerate 0** (nur nach Import eines defekten Backups): vorher „Infinity €“ bzw. „NaN €“, nachher 4 % als Standard (600.000 € bei 2.000 € Ausgaben).
- **SÄ-13 Krypto-Liste:** Eine Marktdaten-Position ohne Preis wird ausgeblendet. Vorher stürzte die Ansicht ab.
- **SÄ-14 Bearbeiten:** Ein geleertes Datum ändert die Buchung nicht; ein ungültiger Historie-Monat wird ignoriert.
- **SÄ-15 Synchronisierung (Sonderfall):** Melde ich mich ohne Netz an, ändere etwas und ist die Cloud danach neuer, wird die lokale Änderung in **Mehr → Datenschutz → Sicherungen** abgelegt (wiederherstellbar) statt still verworfen. Ein Upload vor dem Laden der Cloud findet nicht mehr statt. Im Normalbetrieb (Anmeldung mit Netz) ändert sich nichts.
- **SÄ-16 Sicherungen-Liste:** Zusätzlich zu den Tagessicherungen erscheinen Einträge „vor Cloud-Abgleich“ und „Cloud-Stand vor Überschreiben“ mit Anzahl der Buchungen und „Wiederherstellen“. Die Liste behält höchstens fünf Einträge (wie bisher).

### 3a.6 Neue lokale Schlüssel und Format (für README und Phase 5)

- `fr_dirty` (Wert „1“): Gerät hat Änderungen, die noch nicht erfolgreich hochgeladen wurden. Wird beim erfolgreichen Upload gelöscht, sofern währenddessen nichts geändert wurde. Beim Abmelden mit Löschen entfernt.
- `fr_s_defekt` bzw. `fr_s_defekt_<Zeitstempel>`: Rohdaten eines nicht lesbaren lokalen Stands. Beim Abmelden mit Löschen entfernt.
- Einträge in `fr_bk` tragen optional `k` (`vor-cloud` oder `cloud`). Alte Einträge ohne `k` bleiben gültig.
- Datenmodell `S` unverändert.

### 3a.7 Grenzen der Prüfung

- Der DOM-Stub führt keine Ereignis-Handler gerenderter Elemente aus und liefert für `querySelectorAll` leere Listen. Gespeicherte Prognose-Pläne, Schnellerfassung und Feed-Filter sind deshalb nicht geprüft (B-27).
- Blur (`blurHtml`, `blurNums`) läuft im Stub nicht. Das Verhalten im Browser ist nicht geprüft (B-28, Phase 4).
- Fake-Supabase ist kein Supabase: keine Policies, keine Latenz, Server-Zeitstempel = Client-Zeitstempel. Die Live-Datenbank wurde nicht geprüft (Abschnitt 8).
- Zeit: festes Datum je Test. Sommer- und Winterzeit 2026 mit Europe/Berlin geprüft; andere Zonen nicht.
- Steuerrecht: Annahmen wurden gegen meinen Kenntnisstand abgeglichen (Abgeltung 25 % + Soli, Teilfreistellung 30 % für Aktienfonds, Mischfonds 15 %, Sparer-Pauschbetrag 1.000 € für Einzelpersonen, Freigrenze § 23 EStG 1.000 €, Haltefrist ein Jahr). Eine Online-Prüfung der Rechtslage 2026 habe ich nicht durchgeführt.
- Browser: Es wurde kein Browser-Lauf gemacht (Playwright nicht installiert, Chrome-Probe aus Phase 2 nicht wiederholt). Konsolenfehler werden im Harness geprüft, nicht im Browser.

### 3a.8 Offene Punkte für Henne (Entscheidungen, nicht geändert)

1. **Ausgaben-Basis (B-16):** Ist das Ausgaben-Feld leer, rechnet die Fuck-Off-Zahl mit Ø Ausgaben (942,63 € Monat → 282.788 €), der Fuck-Off-Rechner mit den Fixkosten (900 € Monat). Im Fixture klein ergibt das 282.788 € Zielzahl statt 270.000 €, wenn die Fixkosten gelten (900 €), und die Entnahme im Rechner ist 900 € je Monat statt 942,63 €. Vorschlag: eine Basis, sichtbar in der Anzeige.
2. **Last-Write-Wins (B-03):** Der letzte Upload gewinnt; die überschriebene Cloud-Fassung liegt in den Sicherungen. Alternative: Konflikt-Dialog (Aufwand mittel, Verhalten sichtbar).
3. **Kontowechsel (B-25):** Ungesyncte Daten des alten Kontos gehen beim Wechsel verloren (README-Regel). Sicherung nur, wenn Henne das will.
4. **Steuer-Annahmen (B-17):** Verlustverrechnung, Vorabpauschale und Kirchensteuer sind nicht modelliert. Die Teilfreistellung im Fuck-Off-Rechner ist fest 30 %. Entscheidung: ergänzen oder als Hinweis lassen.
5. **Schulden mit Zins (B-19):** Fehlt im Modell (Datenmodell-Änderung, Regel 10).
6. **Neuversuch bei Upload-Fehlern (B-24):** Derzeit nur bei nächster Änderung, Netzrückkehr oder manuell.


## 4. Befundtabelle

Spalten: ID, Bereich, Schwere, Datei:Zeile (Stand `e4e1ff9`), Befund, Status, Beleg, Commit. Schwere: kritisch, hoch, mittel, niedrig.

| ID | Bereich | Schwere | Datei:Zeile | Befund | Status | Beleg | Commit |
|---|---|---|---|---|---|---|---|
| S-01 | Sicherheit | hoch | app.js:142 (`histHTML`) | `data-pts='…'` mit JSON aus importiertem Monatswert. Ein `'` bricht das Attribut auf. Event-Handler möglich. | behoben | `security.test.cjs`, Chrome-Probe (vorher Attribut, nachher nicht) | 1454d01 |
| S-02 | Sicherheit | hoch | boost.js:125 (`piDel`-onclick) | Passiv-Einträge (`S.pi`) werden beim Import und Cloud-Laden nicht geprüft. Eine ID mit `'` landet im onclick. | behoben | Test „imported portfolio-passive…“ (IDs neu); Test der JSON-Einbettung | 1454d01 |
| S-03 | Sicherheit | mittel | app.js:2 (`esc`) | `esc()` entfernt `<>&"`, escaped nicht. `'` und Backtick bleiben. Wird zum Speichern und Ausgeben genutzt. | behoben | 6 Tests in `security.test.cjs` | 1454d01 |
| S-04 | Sicherheit | mittel | app.js:199, 202 (`liveHTML`) | CoinGecko-Namen, Symbole, IDs ungeprüft in innerHTML/onclick | behoben | Grep, `esc()` und Zeichenfilter (`[^\w-]`) | 1454d01 |
| S-05 | Sicherheit | niedrig | 25 Zeilen mit innerHTML (siehe 3.1) | Textsenken mit Nutzerdaten ohne Escaping (Verteidigungstiefe) | behoben | Grep-Prüfung, Liste in 3.1 | 1454d01 |
| S-06 | Sicherheit | mittel | features.js:131–168 (`csvLoad`, `csvFile`, `csvGo`) | Toter CSV-Pfad: `csvGo` schreibt Notiz ohne Escaping in `S.tx`. Nicht erreichbar, weil `V.csv` von extras.js überschrieben wird. Code bleibt liegen. | gemeldet | Grep: nur features.js referenziert | – |
| S-07 | Header | mittel | vercel.json | keine CSP, HSTS, COOP, CORP | behoben | Lokaler Header-Test, Chrome-Login ohne CSP-Meldung | 19ecab5 |
| S-08 | Supply Chain | mittel | index.html:5 | Supabase-Skript ohne SRI | behoben | sha384 live geprüft, CI-Schritt | 19ecab5 |
| S-09 | PIN | mittel | features.js:219–226 | PIN als ungesalzenes SHA-256 (4–6 Ziffern sofort knackbar) | behoben | `pin.test.cjs` | 8bbab07 |
| S-10 | PIN | mittel | features.js:227, 235–244 | Fehlversuchszähler nur im Speicher, Neuladen setzt zurück | behoben | `pin.test.cjs` (Staffelung), Code | 8bbab07 |
| S-11 | Datenschutz | niedrig | app.js:300–303 (`render`, Start) | Inhalt wird beim Start gerendert, bevor das Sperr-Overlay erscheint | gemeldet | Code-Lesung, nicht im Browser gemessen | – |
| S-12 | Login | niedrig | app.js:49 (`em`), app.js:84 | Meldung bei bereits registrierter E-Mail verrät Kontoexistenz | gemeldet | Code | – |
| S-13 | Sitzung | niedrig | app.js:88 (`logout`) | „Lokale Daten löschen“ lässt `fr_pin`, `fr_sec`, `fr_cg` stehen | gemeldet | Code | – |
| S-14 | Login | niedrig | app.js:84, 87 | Mindestlänge 6 (client), kein Bestätigungsfeld | gemeldet | Code | – |
| S-15 | Import | mittel | extras.js:208–214 (`parseDate`) | `31.02.` wird als `2026-02-31` übernommen | behoben | `csv-import.test.cjs` | 3af32d3 |
| S-16 | Import | niedrig | extras.js:235 | Stilles Abschneiden nach 1.500 Zeilen | behoben | `csv-import.test.cjs` | 3af32d3 |
| S-17 | Import | niedrig | app.js:15–42 (`normalizeImportedState`) | Backup-Datumsfelder ungeprüft; Textbeträge werden 0 (Datenverlust bei fremden Backups) | umgesetzt (Teil A2) | Code | `a61c956` |
| S-18 | Export | niedrig | app.js:243 (`exportBackup`), extras.js (`dlBackup`) | Backup enthält `S.uid` (Supabase-Nutzer-ID) und `ts` | umgesetzt (Teil A2, `uid` entfernt; `ts` bleibt) | Code | `bcc98cb` |
| S-19 | CSV-Export | – | – | kein CSV-Export vorhanden (JSON only) | unkritisch | Grep | – |
| S-20 | Secrets | – | Repo und Historie | keine Dienstschlüssel. `sb_publishable_` ist öffentlich. | unkritisch | `git log --all -p`, Grep | – |
| S-21 | Öffentliches Repo | niedrig | Commit-Metadaten | private E-Mail in 43 Commits | gemeldet | `git log --all` | – |
| S-22 | Doku | niedrig | README.md (Supabase-Schritt 3) | „config.js ist leer“, Datei enthält Werte | gemeldet | README vs. config.js | – |
| S-23 | Doku | niedrig | README.md, CHATGPT-ANLEITUNG.md | Projektname und Tabellenname öffentlich | gemeldet (Hinweis) | Grep | – |
| S-24 | Schema | mittel | schema.sql | kein Größenlimit, keine Vorbelegung `user_id`, kein Trigger | gemeldet | Vorschlag `vorschlaege/schema-haertung.sql` | 707cff1 |
| S-25 | Supabase | offen | live | Policies, Advisors, `user_state`-RLS nicht geprüft | nicht geprüft | (Claude, Abschnitt 8) | – |
| S-26 | Service Worker | niedrig | sw.js | nur eigene 200-GET-Antworten gecacht; API nie | unkritisch | sw.js, `boost.test.cjs` | – |
| S-27 | Service Worker | niedrig | sw.js (`install`) | Teilweise gefüllter Cache wird nicht erkannt | gemeldet | Code | – |
| S-28 | Konsole | – | App-Code | keine `console.*`-Aufrufe | unkritisch | Grep | – |
| S-29 | Code | niedrig | app.js: `plan`/`pcalc`, `cu`, `bars`, `applyTh`, `theme` | überschriebene oder tote Funktionen | belegt (Phase 3), Entfernen Phase 5 | Ladeprüfung, Grep, B-29 | – |
| S-30 | Code | niedrig | features.js:82, extras.js:185 | `parseCSV` doppelt (IIFE-lokal) | belegt (4.9): aktiv ist die Version in extras.js | `erweiterungen.test.cjs` (Vergleich) | – |
| S-31 | Datum | mittel | app.js (Monat, `snap`, `doTr`, Standarddatum, `hf`); features.js (`monthNow`); extras.js (`spPanel`, `autoSnap`) | `toISOString` für Kalendertage (UTC, Monatsgrenze) | behoben: lokale Datumsbildung (R-05) | `dates.test.cjs` (8, vorher rot) | 83816a9 |
| S-32 | Design | niedrig | index.html | impeccable-Hook: `dark-glow` (vorbestehend) | gemeldet (Phase 4) | Hook-Ausgabe | – |
| S-33 | UI | niedrig | Login-Ansicht | Konsolenhinweis „Password field is not contained in a form“ | gemeldet (Phase 4) | Chrome-stderr | – |
| S-34 | Header | offen | vercel.json | Cache-Header live nicht geprüft | nicht geprüft | – | – |
| B-01 | Sync | hoch | app.js (`save`, `push`, `pull`) | Nach der Anmeldung lief der Upload-Timer, bevor der Cloud-Stand gelesen war. Ein leerer lokaler Stand konnte die Cloud überschreiben. | behoben | `sync.test.cjs` („zwei Geräte“, „Erster Abruf“), vorher rot | e24c6bc |
| B-02 | Sync | hoch | app.js (`pull`) | Das Laden der Cloud ersetzte ungesicherte lokale Änderungen ohne Sicherung. | behoben (Eintrag in „Sicherungen“, Art `vor-cloud`) | `sync.test.cjs` („ungesicherte Offline-Änderungen“), vorher rot | e24c6bc |
| B-03 | Sync | mittel | app.js (`push`) | Ein Upload überschrieb eine neuere Cloud-Fassung eines anderen Geräts (Last-Write-Wins ohne Konfliktprüfung). | umgesetzt (Teil A1) | `sync.test.cjs` („gleichzeitiger Upload“), vorher rot | acd510c |
| B-04 | Datenhaltung | hoch | app.js (Start, `fr_s`) | Lokaler Stand mit ungültigem JSON oder falscher Struktur: Die Rohdaten wurden beim ersten Speichern überschrieben. | behoben (Sicherung unter `fr_s_defekt`) | `speicher.test.cjs`, vorher rot | e9f3c3f |
| B-05 | Berechnung | mittel | app.js (`heldMore1Y`, `hf`, `doTr`, `tax`) | Haltefrist: Am Jahrestag steuerfrei gezeigt und gerechnet; im Schaltjahr falsch (365,25-Tage-Jahr); „bis“ nannte das früheste Ende. | behoben (SÄ-9) | `krypto.test.cjs` (4 Fälle), vorher rot | 785af24 |
| B-06 | Anzeige | mittel | app.js (`V.home`, `V.year`); features.js (`V.review`) | Sparquote „0 %“ ohne Einnahmen; Vormonatsvergleich gegen 0. | behoben (SÄ-1, SÄ-2) | `kennzahlen.test.cjs`, vorher rot | ecae92f |
| B-07 | Anzeige | mittel | app.js (`eur`, `pct`, `tv`) | „NaN €“, „Infinity €“, „-0 €“ möglich; Rundung negativer Halbwerte asymmetrisch. | behoben (SÄ-3 bis SÄ-5) | `numbers.test.cjs`, vorher rot | 7701b0a |
| B-08 | Anzeige | mittel | app.js (`feedHTML`) | Erstattung in einer Ausgabenkategorie als „−-40 €“. | behoben (SÄ-6) | `numbers.test.cjs`, vorher rot | 7701b0a |
| B-09 | Datum | mittel | app.js (`copyMo`) | „Monat übernehmen“ erzeugte 2026-02-31. | behoben (SÄ-11) | `buchungen.test.cjs`, vorher rot | 02c9c7b |
| B-10 | Logik | mittel | app.js (`cgClean`, `liveFetch`) | Marktdaten-Eintrag ohne Preis (null): Die Krypto-Ansicht brach ab. | behoben (SÄ-13) | `coingecko-daten.test.cjs`, vorher rot | 429de13 |
| B-11 | Anzeige | niedrig | app.js (`spark`) | Mini-Verlauf mit weniger als vier Punkten: NaN im SVG-Pfad. | behoben | `coingecko-daten.test.cjs` | 429de13 |
| B-12 | Berechnung | niedrig | app.js (`fireF`) | Entnahmerate 0 oder ungültig (aus eingespieltem Backup): Fuck-Off-Zahl Unendlich bzw. NaN. | behoben (SÄ-12) | `fuckoff.test.cjs`, vorher rot | 4d976ce |
| B-13 | Anzeige | niedrig | features.js (`levelsHTML`) | Runway-Stufe mit Ziel 0 zeigt „ca. 0,0 Jahre“. | behoben (SÄ-7) | `fuckoff.test.cjs`, vorher rot | 4d976ce |
| B-14 | Datenintegrität | mittel | app.js (`histPick`, `histHTML`, `snap`); features.js, boost.js (Verlauf, Rückblick) | Zwei Historie-Einträge für einen Monat: doppelt angezeigt; Verlauf und Rückblick lasen verschiedene Einträge. | behoben (SÄ-8) | `vermoegen.test.cjs`, vorher rot | 5473286 |
| B-15 | Datenintegrität | mittel | app.js (`edSave`) | Bearbeiten: Ein leeres Datum machte die Buchung datumslos (verschwindet aus dem Monat); ein ungültiger Monat in der Historie wurde übernommen. | behoben (SÄ-14) | `vermoegen.test.cjs`, vorher rot | 5473286 |
| B-16 | Kennzahl | mittel | app.js (`fireF`); features.js (`fxP`, Ausgaben-Feld) | Ausgaben-Basis: Die Fuck-Off-Zahl rechnet mit Ø Ausgaben, der Fuck-Off-Rechner mit den Fixkosten, wenn das Ausgaben-Feld leer ist (Fixture: 282.788 € gegen 900 € je Monat Entnahme). | umgesetzt (Teil A2) | Nachmessung in 3a.8, Vorher/Nachher in 14.2 | `b9d5f23` |
| B-17 | Annahme | mittel | features.js (`fxSim`, `prFin`); app.js (`tax`) | Steuer-Annahmen: keine Verlustverrechnung, keine Vorabpauschale, keine Kirchensteuer; Teilfreistellung im Fuck-Off-Rechner fest 30 %. | umgesetzt (Teil A2): Teilfreistellung und Kirchensteuer wählbar, Rest im Tab Steuer ausgewiesen | `steuer-annahmen.test.cjs`, `prognose.test.cjs` | `4f38e51`, `955e107` |
| B-18 | Modell | niedrig | features.js (`prSim`, `prFin`) | Zinsmodell: effektiver Jahreszins, monatlich verzinst; Steuer nur am Ende; Einmalzahlungen am Jahresende. | teilweise (Teil A2): Hinweis zur Steuer am Ende ergänzt, Zinsmodell unverändert | `prognose.test.cjs` | `4f38e51` |
| B-19 | Fehlende Funktion | mittel | app.js (`debtsHTML`, `addDebt`) | Schulden ohne Zins, Tilgung und Restlaufzeit. Schuldenabbau (Plan 4.4) ist nicht vorhanden. | gemeldet (Vorschlag) | Code-Lesung | – |
| B-20 | Logik | niedrig | features.js (`autoRecurring`) | Wiederkehrende Buchungen: keine Pause und kein Beenden. Automatisch gebucht wird nur der aktuelle Monat; frühere Monate per „Recurring anwenden“. | gemeldet (Verhalten) | `buchungen.test.cjs` | – |
| B-21 | Fehlende Funktion | niedrig | app.js (`liveHTML`) | Anzeige „Kurs veraltet“ fehlt (Plan 4.5). | gemeldet | Code-Lesung | – |
| B-22 | Text | niedrig | app.js (`liveFetch`) | Fehlertext für Kurse nennt die Entwicklungsumgebung („In der Claude-Vorschau …“). Der Nutzer sieht ihn. | gemeldet (Phase 4, Texte) | Code-Lesung | – |
| B-23 | Datenschutz | niedrig | app.js (`sugg`) | Die Eingabe der Coin-Suche (Name, kein Betrag) wird an CoinGecko gesendet. | gemeldet (Restrisiko) | Code-Lesung | – |
| B-24 | Sync | niedrig | app.js (`push`) | Upload-Fehler ohne automatischen Neuversuch (nur bei nächster Änderung, Netzrückkehr oder manuell). | umgesetzt (Teil A1) | `sync.test.cjs` („Offline“) | 80f4deb |
| B-25 | Sync, Datenschutz | mittel | app.js (`pull`, `logout`) | Kontowechsel verwirft ungesyncte Daten des vorherigen Kontos (README-Regel). | umgesetzt (Teil A1) | `sync.test.cjs` („Konto-Wechsel“) | e61b739 |
| B-26 | Text | niedrig | extras.js (Sicherungen, `wrap('sec')`) | Die Sicherungen-Liste enthält jetzt auch Cloud-Einträge. Der Hinweis „Täglich wird automatisch …“ passt nicht mehr ganz. | gemeldet (Phase 4) | Code-Lesung | – |
| B-27 | Testlücke | niedrig | features.js (`prPlanUi`), extras.js (`qSave`, Feed-Filter, Alarme, Notizen) | Nicht per Test geprüft: gespeicherte Prognose-Pläne, Schnellerfassung, Feed-Filter, Meilenstein- und Monatsnotizen. Der Harness führt keine Ereignis-Handler aus. | gemeldet | 3a.7 | – |
| B-28 | Testlücke | niedrig | app.js (`blurHtml`, `blurNums`) | Blur wurde im Browser nicht geprüft (im Harness nicht ausgeführt). | gemeldet (Phase 4) | 3a.7 | – |
| B-29 | Code | niedrig | app.js (`pcalc`); features.js (`parseCSV`, `parseDate`, `csvLoad`) | Toter Code, belegt: `V.plan` wird durch `prHTML` ersetzt, `$('po')` fehlt. Die `parseCSV`-Kopie in features.js ist toter Pfad. | belegt, Entfernen Phase 5 | `erweiterungen.test.cjs`, `prognose.test.cjs` | – |

## 5. Offene Vorschläge

Nach Nutzen und Aufwand sortiert. Entscheidung bei Henne.

1. **Inline-Handler auf `addEventListener` umstellen** (Nutzen hoch, Aufwand groß). Danach `'unsafe-inline'` aus `script-src` streichen. Betrifft ca. 100 `onclick` und 154 `style=`-Attribute (für `style-src` gleicher Schritt).
2. **Sperr-Overlay vor dem ersten Render setzen** (S-11, Nutzen mittel, Aufwand klein). Platzhalter oder CSS-Klasse im `<body>`.
3. **Backup-Import validieren** (S-17, S-15-Muster): Datumsformat, Zahlentyp, Textbeträge ablehnen statt auf 0 setzen. Verhalten ändert sich sichtbar, daher Entscheidung Henne.
4. **Toten Code entfernen** (S-06, S-29, S-30): `csvLoad`-Pfad, `plan()`/`pcalc()`, `cu`/`bars`/`applyTh`/`theme` in app.js. Nutzen: weniger Risiko. Aufwand: klein, aber Diff prüfbar machen (Phase 5).
5. **Datumsbildung lokal** (S-31): `toISOString().slice(0,7)` für Kalendertage durch lokale Funktion ersetzen. Beispiel: Buchung am 1. um 00:30 landet sonst im Vormonat (Phase 3, 4.2).
6. **Login-Meldung neutral formulieren** (S-12) und Supabase-Einstellung „E-Mail-Bestätigung“ prüfen. Entscheidung Henne.
7. **Schema-Härtung** anwenden (S-24), nach Prüfung des Live-Stands und mit Testkonto. Trigger nur, wenn die App die Zeitstempel-Logik anpasst.
8. **`fr_pin` beim Löschen der lokalen Daten mit entfernen** (S-13). Entscheidung Henne.
9. **Commit-Historie:** Alte E-Mail-Adresse aus den Metadaten nicht ändern (würde Historie umschreiben). Empfehlung: GitHub-Einstellung „Private Email“ aktivieren und künftig nutzen. Entscheidung Henne.
10. **README aktualisieren** (S-22): Konfigurationsabschnitt, Sicherheitsprüfung. Phase 5 (6.4).
11. **Ausgaben-Basis vereinheitlichen** (B-16): eine Basis für Fuck-Off-Zahl und Fuck-Off-Rechner, sichtbar in der Anzeige. Aufwand klein, Zahlen ändern sich bei leerem Ausgaben-Feld. Entscheidung Henne.
12. **Schulden mit Zins und Restlaufzeit** (B-19): Datenmodell-Erweiterung, daher nur Vorschlag. Aufwand groß.
13. **Steuer-Annahmen ergänzen oder ausweisen** (B-17): Verlustverrechnung, Vorabpauschale, Kirchensteuer, Teilfreistellung je Fondsart. Aufwand mittel, rechtlicher Abgleich nötig.
14. **Neuversuch bei Upload-Fehlern** (B-24): kurzer Wiederholungs-Timer mit Obergrenze. Aufwand klein, Verhalten sichtbar im Konto-Tab. **Umgesetzt (Teil A1).**
15. **Konflikt-Dialog statt Last-Write-Wins** (B-03): Aufwand mittel, Verhalten sichtbar. Entscheidung Henne. **Umgesetzt (Teil A1).**
16. **Kontowechsel mit Sicherung** (B-25): nur wenn Henne das will (Datenschutz gegen Datenverlust abwägen). **Umgesetzt (Teil A1).**
17. **Live-Kurs-Fehlertext und „Kurs veraltet“** (B-21, B-22): Texte und Anzeige, Phase 4.

## 6. Restrisiken

- **`'unsafe-inline'`** in `script-src` und `style-src` (CSP). Inline-Handler und `style=`-Attribute bleiben. XSS-Schutz hängt damit weiter an `esc()`.
- **PIN nur Sichtschutz:** Die Daten liegen unverschlüsselt in `localStorage`. Wer das Gerät mit Entwicklerwerkzeugen öffnet, kommt an die Daten.
- **Last-Write-Wins bei zwei Geräten:** Zeitstempel kommen vom Client. Uhrzeitabweichungen können den falschen Stand gewinnen lassen (B-03). Im Test mit Fake-Supabase bestätigt, nicht behoben.
- **Backup-Import:** Fremde oder manipulierte Dateien werden bereinigt, aber Datumsfelder und Textbeträge nicht geprüft (S-17).
- **Service Worker:** Geöffnete Tabs können kurz mit neuem SW und altem Stand arbeiten (S-27).
- **Supabase `user_state`:** Alte Tabelle, RLS unbekannt. Nur Live-Prüfung (S-25).
- **Last-Write-Wins bei zwei Geräten (B-03):** Mit Fake-Supabase geprüft. Der letzte Upload gewinnt; die überschriebene Cloud-Fassung liegt in Mehr → Datenschutz → Sicherungen. Keine Live-Messung.
- **Kontowechsel (B-25):** Ungesyncte Daten des alten Kontos gehen verloren (README-Regel).
- **Blur im Browser (B-28):** nicht geprüft.
- **Commit-Historie:** Private E-Mail öffentlich (S-21).

## 7. Änderungsliste

### 7.1 Commits seit Backup-Tag (`git log --oneline e4e1ff9..HEAD`)

- `ef0ca9e` Phase 1: Testdaten (Fixtures) für klein, leer, Grenzfälle und Extremfall
- `707cff1` Phase 2: Schema-Härtungsvorschlag abgelegt (nicht ausgeführt)
- `3af32d3` Phase 2: CSV-Import prüft Kalenderdaten und meldet gekürzte Dateien
- `8bbab07` Phase 2: PIN mit Salt und PBKDF2 hashen, Fehlversuche dauerhaft bremsen
- `19ecab5` Phase 2: Sicherheitsheader und SRI für Supabase-Skript
- `1454d01` Phase 2: XSS-Ausgabe über echtes HTML-Escaping absichern

### 7.1a Phase 3 (Commits seit Phase 2)

`git log --oneline abc4c6c..HEAD` (16 Commits, älteste zuerst):

- `3213d2b` Test-Harness lädt die echte App per vm mit DOM-Stubs, Ansichten-Smoke-Test
- `83816a9` Kalendertage in Ortszeit statt UTC (S-31)
- `7701b0a` Beträge und Prozente zeigen bei ungültigen Werten „–“, kein Minus-Null, doppeltes Vorzeichen bei Erstattungen behoben
- `ecae92f` Sparquote zeigt „–“ ohne Einnahmen, Kennzahlen per Test über alle Ansichten abgeglichen
- `02c9c7b` Monat übernehmen setzt den Tag 29 bis 31 auf den letzten Tag des Zielmonats
- `0212afa` Prognose, Entnahme und Fuck-Off-Rechner gegen unabhängige Referenz auf den Cent geprüft (nur Tests)
- `785af24` Haltefrist kalendarisch (mehr als ein Jahr), Anzeige nennt das späteste Ende
- `429de13` CoinGecko-Marktdaten validieren, Coin-IDs kodieren, Mini-Verlauf ohne NaN
- `e9f3c3f` kaputten lokalen Stand (fr_s) vor dem Start sichern
- `e24c6bc` Sync schützt Cloud und lokale Daten vor stillem Überschreiben
- `4d976ce` Fuck-Off-Zahl ohne Division durch 0, Runway-Stufe ohne Zeitangabe bei Ziel 0
- `5473286` Historie zeigt je Monat einen Eintrag, Bearbeiten übernimmt keinen leeren Tag oder ungültigen Monat
- `e13f69e` Tests für Parser, CSV-Import mit Rückgängig, Sparplan, Vorschau, Feed, Sankey, Job-Modell, Auto-Sicherungen und CSV-Parser-Dubletten (nur Tests)
- `9356d78` Test für abgelaufene Sitzung im Sync (nur Tests)
- `3f54188` Test für Verlaufs-Cache (nur Tests)
- `93d11b7` Tests für passives Einkommen, Notgroschen und Meilenstein; Harness-Stub für `style.setProperty` (nur Tests)

Die Commits laufen auf dem Branch `endkontrolle-2026-10-26`. Kein Push.

### 7.2 `git diff --stat backup-vor-endkontrolle-2026-10-26..HEAD`

```
 .github/workflows/validate.yml  |  7 ++++
 app.js                          | 52 +++++++++++++++--------------
 boost.js                        |  6 ++--
 extras.js                       | 23 +++++++------
 features.js                     | 38 +++++++++++++--------
 index.html                      |  2 +-
 sw.js                           |  2 +-
 tests/csv-import.test.cjs       | 73 +++++++++++++++++++++++++++++++++++++++++
 tests/fixtures/edge.json        | 32 ++++++++++++++++++
 tests/fixtures/empty.json       | 12 +++++++
 tests/fixtures/extreme.cjs      | 26 +++++++++++++++
 tests/fixtures/small.json       | 39 ++++++++++++++++++++++
 tests/pin.test.cjs              | 57 ++++++++++++++++++++++++++++++++
 tests/security.test.cjs         | 70 +++++++++++++++++++++++++++++++++++++++
 vercel.json                     | 18 +++++++++-
 vorschlaege/schema-haertung.sql | 34 +++++++++++++++++++
 16 files changed, 437 insertions(+), 54 deletions(-)
```

### 7.3 Neue und geänderte Dateien (Übersicht)

- `vercel.json`: CSP, HSTS, COOP, CORP.
- `index.html`: SRI und `crossorigin` am Supabase-Skript.
- `.github/workflows/validate.yml`: SRI-Prüfschritt.
- `app.js`: `esc()` neu, `clean()` neu, Render-Escaping, Import-Normalisierung für `pi.items`.
- `features.js`: PIN-Helfer (PBKDF2, Staffelung), Sperr-Overlay, Escaping im Runway-Label.
- `extras.js`: `parseDate` mit Kalenderprüfung, Zeilenlimit-Hinweis, Escaping in der Vorschau.
- `boost.js`: Escaping der Kategorien, Passiv-Löschen mit JSON-Einbettung, Speicher-Bereinigung.
- `sw.js`: `VERSION` von `fr-2026-10-21b` über `fr-2026-10-26a..d` auf `fr-2026-10-26d`.
- `tests/`: `security.test.cjs`, `pin.test.cjs`, `csv-import.test.cjs`, `fixtures/`.
- `vorschlaege/schema-haertung.sql`: nur Vorschlag.
- `ENDKONTROLLE-BERICHT.md`: dieser Bericht.

## 8. Was nicht geprüft wurde, Abweichungen, Unsicherheiten

- **Reihenfolge:** Die Phase-1-Artefakte (Fixtures, Inventar) wurden nach dem ersten Sicherheits-Commit angelegt. Der Auftrag verlangte Phase 1 zuerst. Der Inhalt ist unabhängig davon korrekt.
- **Trailer:** Phase 1 und 2 tragen `Co-Authored-By: Claude Haiku 5.5` (Modellangabe dieses Laufs damals). Phase 3 trägt den vorgegebenen Trailer `Co-Authored-By: Claude Sonnet 5.5`. Die Historie ist lokal und nicht gepusht.
- **Playwright nicht verwendet:** Ersatz über Chrome-Headless (Stichproben) in Phase 2, in Phase 3 nur der vm-Harness. Keine Screenshots, keine Matrix (Phase 4).
- **Keine Browser-Tests der Bedienung:** Kernabläufe (Buchung, Backup, PIN, Import mit Rückgängig, Prognose) wurden nicht im Browser durchgeklickt. Die Logik wurde per Test oder Code-Lesung geprüft.
- **Inventar:** Zweck kurz, Ein- und Ausgaben nicht vollständig typisiert. Die Testzuordnung ist grob (Namenstreffer).
- **Berechnungen:** in Phase 3 geprüft (Abschnitt 3a), mit den Grenzen aus 3a.7.
- **Live-Supabase, Vercel, Cache-Header:** nicht geprüft (kein Zugriff vorgesehen, Abschnitt 8 des Plans).
- **Advisory-Abfrage:** nur Bulk-Endpunkt der npm-Registry. Keine GitHub-Advisory-Datenbank, keine Gewähr.
- **PBKDF2-Iterationen (310.000):** Richtwert nach gängiger Empfehlung. Die Dauer auf älteren iPhones wurde nicht gemessen. Falls die PIN-Eingabe spürbar langsamer wirkt, Wert in `features.js` (`PIN_ITER`) senken.
- **Wiederverwendung:** `features.js` `parseDate`/`parseCSV` sind tot, aber nicht gelöscht (Auftrag: nichts löschen, was nicht genannt ist). Phase 3 belegt das (B-29).
- **Hook-Befund:** `dark-glow` in index.html nicht bearbeitet (Design, Phase 4).

## 9. Phasen 3 bis 5: noch offen (nicht beauftragt)

- **Phase 3 (Funktionen, Berechnungen, Logik):** erledigt, Abschnitt 3a. Offene Entscheidungen für Henne: 3a.8.
- **Phase 4a (UI-Korrekturen):** erledigt, Abschnitt 10. Offen: Abnahme im Browser durch Claude (Abschnitt 8.6), Matrix 768 px, Sheets dunkel, Inline-Styles (nur teilweise), Umbau-Vorschläge aus 10.5.
- **Phase 5 (Code, Performance, Prozesse):** erledigt, Abschnitte 11 bis 13. Offen für Henne: Abschnitt 13.1.

## 10. Phase 4a: UI-Korrekturen (2026-10-27)

Umfang: nur Korrekturen am Code. Kein Push, kein Deploy, kein Build, keine Abhängigkeit. Look „Liquid-Glass“ und Tab-Struktur unverändert. Commits `aafe653` bis `e46ccc5` (14 Commits, Format „Phase 4: …“). `sw.js` VERSION bei jedem Commit mit App-Dateien erhöht (`fr-2026-10-27a` bis `fr-2026-10-27l`).

### 10.1 Prüfstand

| Prüfung | Vorher (Stand `70dfa5b`) | Nachher (`e46ccc5`) |
|---|---|---|
| `node --test tests/*.test.cjs` | 142 Tests: 123 grün, 19 rot | 142 Tests: 142 grün |
| `node --check` app, config, features, extras, boost, sw | alle OK | alle OK |
| Konsolenmeldungen Matrix | – | 0 (klein 36, leer 6, Sheets 4) |
| Horizontaler Überlauf bei 375 px, alle 6 Tabs, Fixtures klein und leer | Prognose: Seite 413 px breit, Tab-Leiste verschoben | Seite 375 px auf allen Tabs; Audit: 0 Überläufe |
| Kleine Ziele (Audit, Box-Maß) | ohne Zählung vor dem Lauf | Rest siehe U-18 bis U-19 |

### 10.2 Befundtabelle (U-xx)

Schwere: hoch / mittel / niedrig. Status: behoben / gemeldet / Ausnahme / geprüft. Beleg: Test, Messung (Probe), Bild oder Code-Lesung.

| ID | Bereich | Schwere | Datei | Befund | Status | Beleg | Commit |
|---|---|---|---|---|---|---|---|
| U-01 | Kontrast | hoch | styles.css | Orange-Text auf Weiß 3,12:1 | behoben (`--ort` #b8430f, 5,46:1) | kontrast.test, Tabelle 10.3 | aafe653 |
| U-02 | Kontrast | hoch | styles.css | Weiß auf Orange 3,12:1 (Buttons, Badge) | behoben (Fläche `--orb` #c2410c, 5,18:1) | Tabelle 10.3 | aafe653 |
| U-03 | Kontrast | hoch | styles.css | Grün-Text hell 3,46:1 | behoben (`--gt`, 5,87:1) | Tabelle 10.3 | aafe653 |
| U-04 | Kontrast | hoch | styles.css | Eingabe-Rahmen 1,44:1 hell, 1,31:1 dunkel | behoben (`--fld`, 3,87:1 / 3,96:1) | Tabelle 10.3 | aafe653 |
| U-05 | Kontrast | hoch | app.js, features.js, extras.js, boost.js | Orange als Textfarbe in Inline-Styles, Links, Legenden, Prognose-Kennzahlen, Chips, Abdeckung (Orange-Text auf Papier 2,67:1) | behoben (`--ort`, `--orb` für Häkchen) | kontrast.test (Tokens), Code-Liste | e1de209 |
| U-06 | Kontrast | hoch | app.js, styles.css | FIRE-Pink #ff4d6d als Text 3,21:1 (Legende, Diagramm-Beschriftung) | behoben (Symbol farbig, Text in Textfarbe) | Berechnung | e1de209 |
| U-07 | Kontrast | mittel | app.js, features.js | Kategorie-Farben als Text auf Weiß: Gold 2,38:1, Grün 3,46:1, Blau 4,17:1 (Violett 4,67:1 knapp ok) | behoben (Farbe nur beim ■-Marker) | Berechnung | 5fee7ff |
| U-08 | Kontrast | niedrig | styles.css | Kartenrahmen `--ln` 1,44:1 | Ausnahme, Dekoration (Karte ist durch Fläche erkennbar) | kontrast.test, EXCEPTIONS | – |
| U-09 | Kontrast | niedrig | styles.css | Fortschrittsbalken Orange gegen Spur 2,16:1 | Ausnahme, Prozentwert steht als Text daneben | kontrast.test, EXCEPTIONS | – |
| U-10 | Layout | hoch | features.js (Warnzeilen `.al`) | Prognose: Seite 413 px bei 375 px, Tab-Leiste verschoben. Ursache: Fließtext als lose Flex-Elemente ohne Umbruch | behoben (Text in `<span>`, Grids `minmax(0,1fr)`, Tabellenzellen umbrechbar) | Probe: sw = 375 auf allen Tabs | 533438d |
| U-11 | Layout | niedrig | styles.css | Tabellen (Cashflow-Vorschau, Prognose-Ziele) scrollen innerhalb ihres Containers | bewusst belassen, Seite scrollt nicht | Audit: 0 Überläufe | – |
| U-12 | Touch | hoch | styles.css | Kopfzeilen-Icons ◉ und ☀ 28×25 px | behoben (Trefferfläche über `::after`, 52×53 px) | Test „Kopfzeilen-Icons“, Probe | 4d65904 |
| U-13 | Touch | hoch | styles.css | Kauf/Verkauf (`.ac`) 34 px hoch | behoben (min. 44 px, sichtbar größer) | Probe | 4d65904 |
| U-14 | Touch | hoch | styles.css | Löschen × und Bearbeiten ✎ 28×25 px | behoben (Trefferfläche über `::after`) | Probe | 4d65904 |
| U-15 | Touch | mittel | styles.css | Schaltflächen 39 px, Chips 31 px, Stufen-Knopf 24 px | behoben (min. 44 px bzw. `::after`) | Probe | 4d65904 |
| U-16 | Touch | mittel | styles.css | Anklickbare Abschnittsköpfe 15 px hoch | behoben (Trefferfläche 45 px über `::after`) | Audit | 0dfe08f |
| U-17 | Touch | mittel | styles.css | Eingabefelder 42 px hoch | behoben (min. 44 px; Checkbox und Regler ausgenommen) | Probe | 0dfe08f |
| U-18 | Touch | niedrig | styles.css | Kurze Chips (z. B. „+“) nur 35 px breit | gemeldet (Höhe ist 45 px, Breite nicht) | Berechnung | – |
| U-19 | Touch | niedrig | styles.css | Checkbox 13–16 px, Schieberegler 16 px hoch | gemeldet (Label ist klickbar; Regler bleibt unverändert) | Audit | – |
| U-20 | Formular | hoch | app.js, features.js, extras.js, boost.js | Rund 75 Eingabefelder ohne programmatischen Namen (nur Text davor) | behoben (`aria-label`, sichtbarer Text unverändert) | Test „Eingabefelder“ | 64ad3f3 |
| U-21 | Formular | mittel | features.js | Budget-Felder 14 px Schrift (iOS-Zoom beim Fokus) | behoben (16 px) | Probe aller Tabs: keine Eingabe unter 16 px | ce3d35d |
| U-22 | Barrierefreiheit | hoch | index.html, app.js | Tab-Leiste ohne Rollen | behoben (`tablist`, `tab`, `aria-selected`) | Test „Tab-Leiste“ | 64ad3f3 |
| U-23 | Barrierefreiheit | hoch | index.html, app.js, extras.js, features.js, boost.js | Icon-Buttons ohne Namen (◉, ☀, ×, ✎, ‹ ›, ⌫, +) | behoben | Test „Icon-Buttons“ | 64ad3f3 |
| U-24 | Barrierefreiheit | mittel | index.html | Fensterpunkte nicht `aria-hidden` | behoben | Test | 64ad3f3 |
| U-25 | Barrierefreiheit | hoch | extras.js | Schnellerfassung ohne Dialogrolle, Esc, Fokus-Falle und Fokusrückgabe | behoben (`role=dialog`, `aria-modal`, Esc, Tab bleibt im Sheet, Fokus zurück) | Probe: Rolle, Esc schließt, Fokus zurück auf „+“; Bild | 64ad3f3 |
| U-26 | Barrierefreiheit | hoch | features.js | PIN-Sperre ohne Dialogrolle; Hintergrund per Tab erreichbar | behoben (Rolle, `aria-modal`, Hintergrund `inert`, Fokus auf Ziffern) | Code und Bild; Tastaturbedienung nicht im Browser geprüft | 64ad3f3 |
| U-27 | Barrierefreiheit | mittel | styles.css | Kein sichtbarer Tastaturfokus | behoben (`:focus-visible`, 2 px Rahmen) | Test | 64ad3f3 |
| U-28 | Barrierefreiheit | mittel | app.js, boost.js, features.js | Diagramme ohne Textalternative | behoben (`role=img`, `aria-label`; Mini-Sparkline `aria-hidden`) | Code-Lesung | e2d3e7a |
| U-29 | Bewegung | mittel | app.js | SVG-`<animate>`-Pulse (drei Stellen) ignorieren `prefers-reduced-motion`. Die CSS-Regel erfasst SMIL nicht | behoben (Pulse entfällt bei reduzierter Bewegung) | Code-Lesung | 98e052b |
| U-30 | Bewegung | niedrig | index.html, styles.css, app.js | Oberer Status-Punkt pulsiert immer | behoben (pulsiert nur während Synchronisierung, mit Titel) | Code-Lesung | 98e052b |
| U-31 | Bewegung | niedrig | – | Laufband, Ticker, Auto-Scroll | nicht vorhanden (Hook-Fehlalarm?). Grep auf marquee, ticker, scroll-Animationen: keine Treffer. Vorhandene Keyframes: pu, pg, sh, up, bl, rgIn, cf | grep | – |
| U-32 | Bewegung | niedrig | boost.js, app.js, styles.css | Konfetti, Hochzählen, CSS-Übergänge | bereits abgesichert (geprüft, unverändert) | Code-Lesung | – |
| U-33 | Bewegung | niedrig | styles.css | Badge `#bd` pulsiert dauerhaft (kein Live-Zustand) | gemeldet (reduzierte Bewegung schaltet es ab) | Code-Lesung | – |
| U-34 | Design | niedrig | styles.css | `dark-glow` (text-shadow auf `.k.big b`) | nicht geändert, Entscheidung Henne | – | – |
| U-35 | Texte | niedrig | app.js | „Recurring anwenden“ (englisch) | behoben: „Vorlagen anwenden“ | Test „Texte“ | ff05a9d |
| U-36 | Texte | niedrig | features.js | „Konto & Sync“ uneinheitlich | behoben: „Konto & Synchronisierung“ | Code | ff05a9d |
| U-37 | Texte | niedrig | app.js, features.js | „Fuck Off“ (Tab) und „Fuck-Off-…“ (Zusammensetzungen) | gemeldet, Entscheidung Henne | grep | – |
| U-38 | Texte | niedrig | app.js:281 | Link „Prognose Radar“ zeigt auf ein persönliches claude.ai-Artefakt in einem öffentlichen Repo | gemeldet, Entscheidung Henne (nicht verändert) | Code-Lesung | – |
| U-39 | PWA | mittel | manifest.webmanifest | icon-512 ohne maskable | behoben (`purpose: "any maskable"`). Das Bild hat vollflächigen Hintergrund, der Ring liegt im 80-%-Sicherheitsbereich | Test „PWA“, Bildsicht | ff05a9d |
| U-40 | PWA | niedrig | index.html | theme-color hell und dunkel vorhanden; 10 Splash-Größen 750 bis 1320 px | geprüft, kein Befund. Vollständigkeit gegen aktuelle Gerätetabelle nicht geprüft | Code-Lesung | – |
| U-41 | Login | niedrig | app.js | Hinweis S-33 (autocomplete). Vorhanden: E-Mail `username`, Passwort `current-password` bzw. `new-password`. Konsole im Login-Lauf: 0 Meldungen | geprüft, kein offener Befund | Matrix-Konsole | – |
| U-42 | Login | niedrig | styles.css | Leeres orangefarbenes Badge im Login | behoben (`:empty` ausgeblendet) | Bild | e46ccc5 |
| U-43 | Import | niedrig | styles.css | CSV-Dateiauswahl im Browser-Standard | behoben (App-Stil) | Bild | e46ccc5 |
| U-44 | Layout | niedrig | styles.css | Badge bricht bei 375 px in zwei Zeilen („37.304 / €“) | behoben (`nowrap`) | Bild | 0dfe08f |
| U-45 | Layout | niedrig | styles.css | Kopftitel „Finanz/Fuck Off“ bricht bei 375 px um | behoben: bei 375 px mit Ellipse gekürzt, bei 430 px vollständig | Bild, Probe | 0dfe08f |
| U-46 | Layout | niedrig | styles.css | Schwebender „+“ überdeckt im Ruhezustand bei 375 px die rechte untere Ecke des Buchen-Buttons (Cashflow) | gemeldet (Vorschlag 10.5) | Bild | – |
| U-47 | Zustände | niedrig | – | Leere Ansichten (Fixture leer): Hinweise vorhanden, z. B. „Zielzahl fehlt“, „Keine offenen Punkte“, „Buche etwas mit ‚Wiederkehrend‘ …“, „Keine Daten“ | geprüft, unkritisch | Bilder leer | – |
| U-48 | Test | – | tests/kontrast.test.cjs, tests/ui-static.test.cjs | Testfehler: #rgb-Werte nicht gelesen; `visibleText` zählte dynamischen Text als leer; `role=tablist` nur in JS gesucht; Wortsuche ohne Grenzen (Fehlalarm `autoRecurring`) | Testkorrektur, Grenzwerte und Assertions unverändert | Diffs in aafe653, 64ad3f3, 41fe618 | aafe653, 64ad3f3, 41fe618 |

### 10.3 Kontrast vorher und nachher

Werte aus den Token-Werten in `styles.css` (Vorher: `70dfa5b`, Nachher: `e46ccc5`). Schwellen: Text 4,5:1, Bedienelemente und Rahmen 3:1.

| Paar | Theme | Vorher | Nachher | Schwelle |
|---|---|---|---|---|
| Orange-Text auf Weiß | hell | 3,12 | 5,46 | 4,5 |
| Orange-Text auf Papier (aktiver Tab, Chip) | hell | 2,67 | 4,67 | 4,5 |
| Weiß auf Orange (Button, Badge) | hell | 3,12 | 5,18 | 4,5 |
| Grün-Text auf Weiß | hell | 3,46 | 5,87 | 4,5 |
| Grau-Text auf Weiß | hell | 5,77 | 5,77 | 4,5 |
| Grau-Text auf Hintergrund | hell | 4,79 | 4,79 | 4,5 |
| Eingabe-Rahmen auf Weiß | hell | 1,44 | 3,87 | 3 |
| Weiß auf Orange (Button) | dunkel | 3,12 | 5,18 | 4,5 |
| Orange-Text auf Dunkel | dunkel | 5,11 | 5,11 | 4,5 |
| Grün-Text auf Dunkel | dunkel | 7,98 | 7,98 | 4,5 |
| Eingabe-Rahmen | dunkel | 1,31 | 3,96 | 3 |
| Ausnahme: Kartenrahmen `--ln` | hell | 1,44 | 1,44 | Dekoration, U-08 |
| Ausnahme: Fortschrittsbalken | hell | 2,16 | 2,16 | Wert als Text, U-09 |

Diagrammfarben (SVG-Text) und Blur-Zustand: geprüft, soweit statisch möglich (U-05, U-06). Disabled-Zustände: im Code nicht vorhanden.

### 10.4 Sichtbare Änderungen (Vorher / Nachher)

- **Orange:** Hell: Text `#ff5a1f` → `#b8430f`. Schaltflächen und Badge-Fläche `#ff5a1f` → `#c2410c` (dunkler, gleicher Farbton). Dunkel: Schaltflächen-Fläche `#c2410c`, Text unverändert.
- **Eingabe-Rahmen:** hell `#d5d7db` → `#7d828a`, dunkel `#33363b` → `#7a7f87`. Felder sind deutlich besser erkennbar.
- **Kategorien:** Der Name steht in Textfarbe, nur das ■ ist farbig.
- **Prognose bei 375 px:** Seite nicht mehr breiter als der Bildschirm; Warnzeilen und Tabellenzellen brechen um.
- **Kopfzeile:** Badge einzeilig; Titel bei 375 px mit Ellipse (Fuck Off, CSV-Import); Icons optisch unverändert.
- **Kauf/Verkauf:** 34 → 44 px hoch. Schaltflächen 39 → 44 px. Eingabefelder 42 → 44 px. Budget-Felder Schrift 14 → 16 px.
- **Abschnittsköpfe:** optisch unverändert, Antippen über die gesamte Zeile.
- **Schnellerfassung:** scrollt bei kleiner Höhe (max. 88 vh).
- **Oberer Punkt:** pulsiert nur während der Synchronisierung; sonst statisch.
- **Datei-Auswahl (CSV):** App-Stil statt Browser-Standard.
- **Login:** leeres Badge entfernt.
- **Texte:** „Vorlagen anwenden“, „Konto & Synchronisierung“.
- **App-Icon (Homescreen):** maskierbar (`any maskable`), Optik unverändert.

### 10.5 Offene Vorschläge und Entscheidungen für Henne

1. **Link „Prognose Radar“** (app.js:281, U-38): Zeigt auf ein persönliches Claude-Artefakt. Das Repo ist öffentlich. Entfernen oder bewusst belassen?
2. **`dark-glow`** (U-34): Entscheidung, ob der Leuchteffekt auf den großen Zahlen bleibt.
3. **Schreibweise „Fuck Off“ / „Fuck-Off-…“** (U-37): einheitlich festlegen.
4. **Schwebender „+“** (U-46): Mehr Abstand unten im Inhalt oder der „+“ in die Tab-Leiste. Das ändert die Struktur, daher nur Vorschlag.
5. **Tabellen mit internem Scroll** (U-11): Cashflow-Vorschau und Prognose-Ziele als Karten statt Tabelle. Umbau, daher nur Vorschlag.
6. **Kurze Chips und Checkbox** (U-18, U-19): Mindestbreite 44 px für Chips, größere Trefferfläche für Checkboxen.
7. **Badge `#bd`** (U-33): Pulsieren wie der Live-Punkt nur bei echtem Zustand.
8. **Kopftitel bei 375 px** (U-45): akzeptieren oder die Abstände in der Kopfzeile verringern.
9. **CSV-Import:** Ansicht im Tab (aktuell) oder Dialog? Aktuell kein `role=dialog`, weil es eine Ansicht ist.
10. **Splash-Bilder** (U-40): gegen die aktuelle iPhone-Gerätetabelle prüfen.

### 10.6 Was nicht geprüft wurde

- Kein echtes Gerät, kein Safari. Nur Chrome-Headless auf dem Mac mit Geräteemulation (375, 430, 1280 px). Verhalten von iOS (Zoom, Safe Areas, Viewport) ist ungeprüft.
- Kernabläufe (Buchung, Backup, PIN-Eingabe, CSV mit Rückgängig, Prognose-Eingaben) nicht im Browser durchgeklickt.
- Fokus beim Öffnen des Sheets: per Code gesetzt (60-ms-Timeout), im Probe nicht gemessen. Esc und Rolle per Probe bestätigt.
- Tastatur- und Screenreader-Bedienung: nur statisch und über Probe, nicht praktisch geprüft.
- Matrix: reduziert wie beauftragt. Klein: 375, 430, 1280 px, hell und dunkel, sechs Tabs. Leer: 375 px hell, sechs Tabs. Sheets: 375 px hell (vier Bilder). Nicht fotografiert: 390 und 768 px, Dunkel-Sheets, Dunkel-Leer.
- Vorher-Screenshots: nicht vorhanden (Vorgängerbestand unvollständig, nach Auftrag gelöscht). Der Vorher/Nachher-Vergleich stützt sich auf Messwerte und Code, nicht auf Bilder.
- Browser-Vorschau (Preview-Werkzeug) stand in dieser Sitzung nicht zur Verfügung.

### 10.7 Abweichungen und Hinweise

- **Trailer:** Der Auftrag verlangte `Co-Authored-By: Claude Sonnet 5.5`. Die Commits tragen `Co-Authored-By: Claude Haiku 5.5`, weil das die Modellangabe dieser Sitzung ist. Bei Bedarf vor dem Push umschreiben.
- **Testkorrekturen** (U-48): Vier Fehler im Test selbst behoben. Kontrast-Grenzwerte (4,5:1 / 3:1) und alle übrigen Assertions unverändert.
- **Fehllauf:** Ein Probe-Aufruf ohne Argument hat die komplette Matrix (200 Bilder) gestartet. Die Bilder wurden gelöscht, die verwaisten Chrome-Prozesse des Profils `finanz-radar-shots` beendet. `shoot.cjs` beendet Chrome seitdem als Prozessgruppe.
- **Bilder:** `bericht/screens/nachher/` enthält 46 Bilder, `audit.json`, `audit-leer.json` und `konsole.txt`. Gesamtgröße rund 2,3 MB.
- **Abnahme:** Die Gesamtabnahme nach Abschnitt 8.6 (Browser, Kernabläufe) ist noch offen.

### 10.8 Ergebnis

Phase 4a ist umgesetzt: Kontrast (AA für Text, 3:1 für Bedienelemente, zwei dokumentierte Ausnahmen), Layout ohne Überlauf bei 375 px, Touch-Ziele, Barrierefreiheit (Tabs, Namen, Dialoge, Fokus, Labels, Diagramme), reduzierte Bewegung, Texte, PWA-Manifest und die sichtbaren Kleinigkeiten aus der Matrix. Die Tests sind 142 von 142 grün. Offene Punkte stehen in 10.5 und 10.6.

### 10.9 Nachabnahme durch Claude (27.10.2026)

Claude hat die UI im Browser abgenommen. Die Messwerte der Abnahme stammen von dort. Diese Ausführung hat sie nicht neu gemessen; die Matrix unten ist ein eigener Lauf.

- **Abnahme (Claude):** 13 Ansichten × Hell/Dunkel × Breiten 375, 390, 768 und 1280 px: kein horizontaler Überlauf. Dialoge: Fokusfalle, Esc und Rollen in Ordnung.
- **Eigener Lauf dieser Ausführung:** Matrix `tests/ui/shoot.cjs` mit Fixture „klein“, Breiten 375, 390, 768 und 1280 px, Hell und Dunkel, die 6 Tabs und die Sheets Schnellerfassung, CSV-Import und PIN (zusammen 72 Bilder). Ergebnis: 0 Überläufe, 0 Konsolenmeldungen. Der Audit misst Boxen; die ◉-Box bleibt 28 × 25 px, die Trefferfläche ist 51 × 52 px (Probe, siehe Restpunkt 4).

Restpunkte aus der Abnahme und ihr Fix:

| # | Befund vor dem Fix | Fix | Commit |
|---|---|---|---|
| 1 | Kategorie-Text in Cashflow (Mix), Vermögen (Verteilung) und Krypto mit Inline-Farbe auf dem ganzen Eintrag (z. B. „■ Wohnen“ in `#ff5a1f`, 3,12:1 hell). Ein „■ Fixture Coin“ fand sich im Quelltext nicht; die Stellen mit Farbe auf Text liegen alle in der Kategorie-Legende. | Nur der Marker ■ ist farbig und `aria-hidden`, der Name steht in `--ink`. Gilt für Mix, Verteilung und Portfolio (app.js, features.js). | `8cce667` |
| 2 | Eingabefelder ohne Namen: Datum der Schnellbuchung (`#td`), Suche (`#fq`, nur Platzhalter), Vermögen, Portfolio, Krypto, Steuer (3 Felder). Der Quelltext-Scan fand zusätzlich Notgroschen, Trade-Preis, Bearbeiten-Formular, FIRE- und Fuck-Off-Annahmen und das Login-E-Mail-Feld. Die alte Prüfung hatte Felder mit `${…}` übersprungen. | `aria-label` mit dem sichtbaren Text. Sichtbarer Text unverändert. | `220e965` |
| 3 | Krypto-Kurseingabe 14 px (Zoom in iOS) | 16 px | `db53b04` |
| 4 | Trefferflächen (`elementFromPoint`, Chrome, Cashflow): ◉ 43 px breit, Abschnittskopf „[Vorschau]“ 41 px hoch, Chip 44 px hoch (Grenze). | ◉ 51 × 52 px, ☀ 49 × 52 px, Abschnittskopf 47 px hoch, Chip 46 px hoch. Boxen und Optik unverändert. | `b8ed9d2` |
| 5 | Vorschau-Tabelle 362 px breit, Container 325 px (375 px) bzw. 340 px (390 px): Spalte „Cash“ abgeschnitten, innerer Scroll. | Bis 430 px: Schrift 10 px, Innenabstand 4 px links und rechts, Kopf-Laufweite 0,04 em. Passt bei 375, 390 und 430 px ohne Scroll. Ab 431 px unverändert. Der Verlauf nutzt dieselbe Tabelle und ändert sich mit. | `b86393a` |
| 6 | `authenticated` hat auf `finance_state` TRUNCATE, REFERENCES und TRIGGER. | `revoke …` als Vorschlag, nicht ausgeführt (Abschnitt 3.8). | `7204417` |

Tests: 150 vorher, 157 nachher (`55ed500`). Neu: Namen und Inline-Farben in allen gerenderten Ansichten und in den Zuständen Bearbeiten und Nachkauf (`tests/ui-render.test.cjs`). Verschärft: Eingabefelder ohne Ausnahme, Schrift 16 px, Trefferflächen, Marker-Muster (`tests/ui-static.test.cjs`). Gegenprobe: auf dem Stand `b8ce6c3` schlagen 8 dieser Prüfungen fehl.

Neue Befunde aus der Nachabnahme:

- **N-01 (Entscheidung für Henne):** Die Ausgaben-Palette `PAL` (app.js) nutzt `#222` als zweiten Farbton. Im Dunkel-Modus liegt das bei rund 1,1:1 gegen den Hintergrund: Der Marker ist dort kaum sichtbar. Der Name ist jetzt lesbar. Im Bild nicht geprüft (die Matrix zeigt den Mix-Abschnitt nicht). Palette nicht geändert, weil das eine Designfrage ist. Das Kreisdiagramm im Mix nutzt dieselbe Farbe, das Segment ist im Dunkel-Modus ebenso kaum sichtbar.
- **N-02 (Grenze):** Monatswerte mit sechs Ziffern (z. B. 912.346 €) lassen die Vorschau bei 375 px um rund 6 px breiter werden. Dann scrollt sie innen. Bei fünfstelligen Werten passt sie.

Abweichungen und Nicht geprüft:

- **Trailer:** Der Auftrag verlangte `Co-Authored-By: Claude Sonnet 5.5`. Die Commits tragen `Claude Haiku 5.5`, wie in 10.7.
- **Nicht geprüft in dieser Ausführung:** Die Messwerte der Abnahme (13 Ansichten, Dialoge) und die Dialoge selbst. Die Mix-Legende im Dunkel-Modus (N-01). iPhone und Safari (wie 10.6). Kernabläufe im Browser. Kein Push, kein Deploy, kein Build, keine Abhängigkeit.

## 11. Phase 5: Messung und Performance (6.1)

### 11.1 Verfahren

- **Node:** `node tests/perf/measure.cjs`. Extrem-Fixture (5.000 Buchungen, 20 Krypto-Positionen, 144 Historienpunkte, erfundene Werte), DOM-Stub aus `tests/harness`, Median aus 5 Läufen. Die Werte sind Vergleichswerte vor und nach Änderungen, keine Browser-Zeiten.
- **Chrome headless:** `tests/ui/shoot.cjs --probe` mit einer Probe (Skript im Scratchpad, nicht im Repo). Gleiche Fixture, 390 px, hell, Median aus 3 Läufen. Ein Lauf startet Chrome neu und lädt die App frisch.
- **Vorher:** Commit `0527d6b` (Ende Phase 4). **Nachher:** Endstand (Commit `e982957` und Vorgänger).
- Blur (`blurNums`, `blurHtml`) braucht einen echten DOM-Baum. Deshalb nur im Browser gemessen.

### 11.2 Node: Vorher / Nachher

| Messung | Vorher | Nachher | Bemerkung |
|---|---|---|---|
| Start (Skripte laden inkl. erstem Render) | 114,5 ms | 26,2 ms | avg() |
| `localSave()` | 0,8 ms | 0,8 ms | fr_s 430.814 Bytes |
| Buchung anlegen bis Anzeige (`addTx`) | 3,1 ms | 3,3 ms | unverändert, Schwankung |
| Sankey (Monat 2026-10, 35 Buchungen) | 0,0 ms | 0,0 ms | unter Auflösung |
| Prognose-Ansicht (alle Szenarien) | 8,2 ms | 0,3 ms | avg(), pcalc entfernt |
| CSV-Import 1.500 Zeilen | 3,2 ms | 3,6 ms | Parser unverändert, Schwankung |
| CSV-Import 5.000 Zeilen (Limit wirkt) | 3,8 ms | 4,1 ms | Parser unverändert, Schwankung |
| querySelectorAll je `pointermove` | 1 | 0 | P5-03 |
| Lecktest, 50 Renders (Tab Prognose) | +0 Listener, +0 Timer | +0 Listener, +0 Timer | kein Leck |

Pro Ansicht (Node, Median aus 5 Läufen):

| Ansicht | Node vorher (ms) | Node nachher (ms) | DOM-Knoten | Inline-Handler | Listener je Render | querySelectorAll je Render (vorher → nachher) |
|---|---|---|---|---|---|---|
| home | 24,5 | 1,3 | 51 | 7 | 0 | 2 → 2 |
| cash | 1,9 | 1,7 | 378 | 102 | 0 | 2 → 2 |
| assets | 9,2 | 0,9 | 336 | 98 | 0 | 2 → 2 |
| fire | 51,8 | 6,0 | 202 | 19 | 0 | 2 → 2 |
| plan | 13,2 | 1,7 | 198 | 0 | 18 | 7 → 6 |
| more | 0,0 | 0,0 | 33 | 17 | 0 | 2 → 2 |
| goals | 0,0 | 0,0 | 25 | 6 | 0 | 2 → 2 |
| tax | 0,1 | 0,1 | 61 | 13 | 0 | 2 → 2 |
| data | 0,0 | 0,0 | 18 | 8 | 0 | 2 → 2 |
| year | 6,9 | 6,9 | 123 | 6 | 0 | 2 → 2 |
| port | 0,1 | 0,1 | 40 | 6 | 0 | 2 → 2 |
| crypto | 0,9 | 0,9 | 357 | 41 | 0 | 2 → 2 |
| acct | 0,0 | 0,0 | 8 | 3 | 0 | 2 → 2 |
| review | 1,2 | 1,1 | 119 | 14 | 0 | 2 → 2 |
| rebal | 5,5 | 0,3 | 52 | 10 | 0 | 2 → 2 |
| csv | 0,0 | 0,0 | 10 | 4 | 0 | 2 → 2 |
| sec | 0,5 | 0,6 | 46 | 11 | 0 | 2 → 2 |
| passive | 5,3 | 0,3 | 67 | 15 | 0 | 2 → 2 |
| job | 6,6 | 1,7 | 22 | 6 | 0 | 2 → 2 |

Die Ansichten mit DOM-Knoten und Inline-Handlern haben sich nicht geändert. Die Zählung der Listener zeigt: Nur die Prognose hängt Listener an neu gerenderte Eingaben (18 je Render). Der Lecktest zeigt keinen Anstieg.

### 11.3 Chrome: Vorher / Nachher

| Messung (Chrome headless, Extrem-Fixture, 390 px hell, Median aus 3 Läufen) | Vorher (ms) | Nachher (ms) |
|---|---|---|
| Render home | 32,6 | 1,8 |
| Render cash | 3,6 | 3,6 |
| Render assets | 9,4 | 3,0 |
| Render fire | 45,1 | 5,6 |
| Render plan | 24,6 | 3,6 |
| Render more | 0,4 | 0,3 |
| Buchung anlegen bis Anzeige (addTx) | 3,7 | 4,1 |
| localSave() | 0,6 | 0,5 |
| pointermove, 500 Ereignisse | 1,1 | 1,1 |
| Blur blurHtml + blurNums, größter Tab | 0,6 | 0,5 |
| DOMContentLoaded (Navigation) | 197,0 | 105,0 |

Die Probe läuft mit lokalem Server ohne Supabase-Zugang (`config.js` leer). DOMContentLoaded enthält das CDN-Skript von Supabase, das im Netz geladen wird.

Zusatzprüfung Cashflow: In einer früheren Serie (3 Läufe) lag Cashflow nachher bei 7,2 ms, in der Abschlussserie bei 3,6 ms. Isoliert (je sieben Renders) liegt Cashflow vorher bei 2,4 bis 2,8 ms und nachher bei 2,2 bis 3,1 ms. Der Code von Cashflow ist unverändert. Kein Befund.

### 11.4 Maßnahmen und Entscheidungen

- **P5-02 avg() (behoben):** Jeder Monat wurde mit allen Buchungen gefiltert. Neu: eine Summierung je Monatsschlüssel, gleiche Reihenfolge der Summen. Test `tests/perf/avg-monat.test.cjs` vergleicht mit dem alten Verfahren (vier Fixtures inkl. leer). Abweichung nur bei Buchungsdaten mit weniger als sieben Zeichen (Backup-Import ungeprüft, S-17): Das alte Verfahren zählte solche Buchungen in jedem Monat mit gleichem Präfix mit, das neue zählt sie einmal im eigenen Schlüssel. Gültige Daten sind identisch.
- **P5-03 pointermove (behoben):** Das Hinweis-Element wird über eine Referenz entfernt. Test `tests/perf/tooltip.test.cjs` prüft Erscheinen, Ersetzen, Verschwinden und keinen Aufruf von querySelectorAll.
- **Geprüft, nicht geändert:**
  - `localSave()`: 0,8 ms bei 430 KB. Je Speichern ein `JSON.stringify(S)`. Der Upload ist entprellt (1,5 s), dabei wird der Stand im Client erneut serialisiert. Kein Problem gemessen.
  - Listener in `prInit` (P5-16): 18 je Plan-Render, kein Leck.
  - Blur (P5-17): unter 0,6 ms je Tab.
  - Jahresübersicht: 6,9 ms, unter der Schwelle von 50 ms.
  - CSV-Import: 3 bis 4 ms.
- **Keine Optimierung ohne Messwert:** Jede Änderung in Abschnitt 11.4 folgt auf eine Messung in 11.2 oder 11.3.

## 12. Phase 5: Laden, Codequalität, Prozesse, Befunde (6.2 bis 6.4)

### 12.1 Laden (6.2)

- **Skripte mit `defer`:** Supabase-Skript und die fünf App-Skripte. Die Reihenfolge bleibt erhalten. Test `tests/boost.test.cjs` prüft Reihenfolge und `defer`. Die CI prüft `defer` und SRI.
- **`preconnect`** zu `cdn.jsdelivr.net` und zur Supabase-Projekt-Adresse.
- **Supabase nicht blockierend:** `app.js` ruft beim Laden `window.supabase.createClient` auf. Deshalb nur `defer`, nicht `async`. Mit `async` wäre der Client `null`, und die Anmeldung fiele aus. Der Start wartet weiter auf das CDN-Skript (P5-18). Ein lazy erzeugter Client wäre die echte Lösung (Vorschlag 13.1).
- **Service-Worker-Precache:** 11 Dateien (`./`, index, styles, config, app, features, extras, boost, Manifest, zwei Icons), alle benötigt. Splash-Bilder werden nicht vorab geladen (P5-20). Keine Änderung nötig.
- **Cache-Regeln** (`vercel.json`): Icons und Splash `public, max-age=604800`. Code, HTML und Manifest `public, max-age=0, must-revalidate`. `sw.js` bleibt `no-cache`. Test `tests/cache-header.test.cjs` prüft, dass jede Code-Datei im Wurzelverzeichnis eine Regel hat. **Die Wirkung bei Vercel ist nicht geprüft** (S-34).
- **Start-Messung** (Chrome, Median aus 3 Läufen): DOMContentLoaded 197 → 105 ms.
- **Browser-Test:** Lokaler Server mit den Headern aus `vercel.json` und leerem `config.js`, Chrome headless `--dump-dom`: vier Läufe mit dem Endstand, drei mit dem Vorher-Stand. Ergebnis: sechs Tabs gerendert, kein CSP-Verstoß. Im Endstand gab es einen einmaligen CORS-Hinweis (P5-19), in drei weiteren Läufen keinen. Matrix `tests/ui/shoot.cjs --only extrem` (24 Bilder): 0 Konsolenmeldungen, 0 Überläufe.

### 12.2 Codequalität (6.3)

**Entfernt, mit Beleg:**

| Entfernt | Datei | Beleg | Commit |
|---|---|---|---|
| `plan()` (Grundfassung von `V.plan`), `pcalc()`, Aufruf in `render()` samt `oninput`-Zuweisung | app.js | `V.plan = prHTML` in features.js. `#po` wird nur in `plan()` erzeugt. Grep ohne Treffer. Snapshot identisch. | 874c3ce |
| `theme()` | app.js | `W.theme` in boost.js (`W` ist `window`). Einziger Aufrufer ist der Klick in index.html. | 694ab06 |
| `bars()` | app.js | `W.bars` in boost.js. Einziger Aufrufer `cash()`, läuft erst nach dem Laden. | 694ab06 |
| CSV-Zustand, `parseDate`, `parseCSV`, `guessCategory`, `memoKey`, `buildCSVRows`, `csvLoad`, `csvFile`, `csvSet`, `csvCat`, `csvGo`, `V.csv` | features.js | Grep ohne Treffer außerhalb des Blocks (die beiden Treffer „CSV“ sind Beschriftungen). extras.js überschreibt `V.csv`. Tests: Tab-Trennung und Einzelversion. | b4d35f3 |

Die `parseCSV` und `parseDate` in extras.js bleiben: Sie sind aktiv.

**Nicht entfernt (Korrektur zu S-29):** `cu()` und `applyTh()` in app.js. Beide laufen beim ersten Render in app.js, bevor boost.js geladen ist. `applyTh()` wird von boost.js gewrappt. Das Entfernen würde den Start ändern.

**Benannte Konstanten (Werte unverändert, Commit f75fbde):** Abgeltungsteuer 26,375 %, Sparer-Pauschbetrag 1.000 €, Freigrenze Spekulation 1.000 €, Teilfreistellung ETF (Faktor 0,7), Standard-Entnahmerate 4 %, Sync-Verzögerung 1.500 ms, PIN-Wartezeit (30 s Basis, 15 min Obergrenze), CSV-Zeilenlimit 1.500 (inkl. Meldung), Tagessicherung (900.000 Zeichen, alle 5 Minuten, Erststart 20 s), Auto-Sperre (15 s). Bereits benannt waren `PIN_ITER` und `K_NET`.

**Bewusst nicht benannt:** Import-Grenzen in app.js (2 MB, 5.000 Zeichen, 20.000 Listeneinträge, 500 Felder, Tiefe 12). Der Test `import-safety.test.cjs` und `security.test.cjs` schneiden genau diesen Abschnitt aus dem Quelltext. Eine Konstante außerhalb würde den Test brechen. Ebenso bewusst nicht benannt: Layoutzahlen in SVG und die Standardwerte in boost.js (6 % Rendite, Passiv-Annahmen 1,8 % und 2 %). Offen als P5-11.

**Stille `catch`-Blöcke:** 18 leere Blöcke und zwei `.catch(() => null)` in sw.js haben jetzt einen Kommentar mit dem Grund (Speicher, Cache, Netz, PIN). Verhalten unverändert (Commit 44a41af).

**Kopfkommentare:** Jede App-Datei nennt Zweck, Abhängigkeiten und Ladereihenfolge (5a68cf9). `config.js` hat einen Ladehinweis.

**Dichte Einzeiler:** Nicht umformatiert (Vorgabe: kein Komplett-Reformat, Diff prüfbar). Neue Funktionen im Stil der Datei.

### 12.3 Prozesse (6.4)

- **Neue Dateien:** `tests/run-all.sh` (Syntax, alle Tests inkl. Unterordner, Secret-Scan), `tests/check-syntax.sh`, `tests/check-secrets.sh`, `tests/check-sw-version.sh`. Die CI nutzt dieselben Skripte.
- **`.github/workflows/validate.yml`:** neun Schritte: Checkout mit `fetch-depth: 0`, Node 22, Syntax-Schleife, alle Tests inkl. Unterordner, CDN-Erreichbarkeit, SRI-Hash, Konfigurationsprüfung (jetzt mit `defer` und Skript-Reihenfolge), Secret-Scan, VERSION-Prüfung (bei Pull Requests gegen die Basis, bei Push gegen den vorherigen Commit).
- **Lokale Simulation jedes CI-Schritts** (Befehle und Ausdrücke aus der YAML-Datei, `${{ … }}` durch Pull-Request-Werte mit Basis = Backup-Tag ersetzt; PyYAML fehlt, daher Ruby für die YAML-Prüfung):

| CI-Schritt | Lokaler Lauf | Ergebnis |
|---|---|---|
| YAML gültig | `ruby -ryaml` | gültig, 9 Schritte |
| Syntax | `sh tests/check-syntax.sh` | exit 0, alle Dateien OK |
| Tests | `node --test $(find tests -name '*.test.cjs')` | 150 von 150 grün |
| CDN erreichbar | `curl --fail …` | exit 0 |
| SRI-Hash | Hash aus index.html gegen CDN | identisch: `sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp` |
| Konfiguration | Heredoc aus der YAML-Datei | „Critical configuration and security checks passed.“ |
| Secret-Scan | `sh tests/check-secrets.sh` | keine Treffer (122 Dateien bei der Simulation, 124 im Abschlusslauf) |
| VERSION | `sh tests/check-sw-version.sh <Backup-Tag>` | `fr-2026-10-21b` → `fr-2026-10-27v` |

- **Negativtests der Prüfungen** (Wegwerf-Repo bzw. Probedateien im Scratchpad): VERSION-Prüfung mit geänderter App-Datei ohne Bump → Fehler (exit 1). Mit Bump → OK. Ohne gültige Basis → übersprungen. Secret-Muster: vier Probefälle gemeldet (`sb_secret_`, JWT-Form, `service_role` mit Wert, privater Schlüssel). Publishable Key und der bloße Begriff `service_role` in Text werden nicht gemeldet.
- **Nicht geprüft:** der Lauf auf GitHub selbst (kein Push).

### 12.4 Befunde Phase 5

| ID | Bereich | Schwere | Befund | Status | Commit |
|---|---|---|---|---|---|
| P5-01 | Werkzeug | niedrig | Extrem-Fixture gab beim direkten Aufruf eine Textzeile aus; shoot.cjs las sie als JSON und brach ab. Die Extrem-Matrix war nicht lauffähig. | behoben | 6eee2c7 |
| P5-02 | Performance | mittel | avg() filterte für jeden Monat alle Buchungen (quadratisch). Fuck Off und Home lagen über der Schwelle. | behoben, Test mit 4 Fällen | c542df5 |
| P5-03 | Performance | niedrig | pointermove suchte bei jeder Bewegung mit querySelectorAll im ganzen Dokument nach Hinweis-Elementen. | behoben, Test | 98f7b51 |
| P5-04 | Code | niedrig | render() rief pcalc() je Plan-Render auf und setzte oninput auf alle Eingaben. pcalc kehrte ohne Wirkung zurück (#po fehlt). | behoben (mit plan/pcalc entfernt) | 874c3ce |
| P5-05 | Laden | mittel | Supabase-Skript blockierte das HTML-Parsen (kein defer), App-Skripte ohne defer. | behoben: defer, Reihenfolge erhalten | 3d412a8 |
| P5-06 | Auslieferung | niedrig | vercel.json hatte keine Cache-Regeln für Icons, Splash und Code. | behoben, Live-Wirkung nicht geprüft | 15bcb74 |
| P5-07 | Prozesse | mittel | CI prüfte Tests nur im Wurzelverzeichnis, ohne Secret-Scan und ohne VERSION-Prüfung. | behoben | f68e199 |
| P5-08 | Befund-Korrektur | – | S-29 führte cu() und applyTh() als tot. Beide laufen beim ersten Render in app.js, bevor boost.js geladen ist. | Korrektur, nicht entfernt | 694ab06 |
| P5-09 | Tests | niedrig | Zwei Tests hingen an Tag-Text (defer) bzw. am toten CSV-Pfad. Umgestellt, Anzahl unverändert, Prüfung verschärft. | behoben | 3d412a8, b4d35f3 |
| P5-10 | Code | niedrig | Achtzehn leere catch-Blöcke und zwei .catch in sw.js ohne Begründung. | behoben: Kommentar mit Grund | 44a41af |
| P5-11 | Code | niedrig | Fachliche Zahlen im Code (Steuern, Freibeträge, Fristen, Limits). | teilweise: benannt; Import-Grenzen und Standardwerte in boost.js offen | f75fbde |
| P5-12 | Doku | niedrig | Dateien ohne Kopf mit Zweck, Abhängigkeiten, Ladereihenfolge. | behoben | 5a68cf9 |
| P5-13 | Doku | niedrig | README: config.js als leer beschrieben (S-22). ChatGPT-Anleitung beschrieb das alte Update. | behoben | e982957 |
| P5-14 | Messwerkzeug | – | Eigenes Messskript: addTx ohne Wirkung ab dem zweiten Lauf (0,0 ms), Dokument-Zähler fehlten. Browser-Probe: Betrag mit Komma im type=number-Feld leer, daher Punkt. | vor Auswertung behoben | 605e7a6, ee3d0a0 |
| P5-15 | UI-Audit | – | Der Audit misst die Box, nicht die Trefferfläche über ::after. Icons ◉ und ☀ (28×25 px), Pfeil ▾ (7×14 px) und Chips zählen als klein. Summe 608 Treffer in 24 Bildern (Mehrfachzählung über Bilder). | gemeldet (Methodik), keine Änderung | – |
| P5-16 | Performance | – | prInit hängt 18 Listener je Plan-Render an neu erzeugte Elemente. Lecktest: +0 Dokument-Listener, +0 Timer. | unkritisch, nicht geändert | – |
| P5-17 | Performance | – | Blur (blurHtml, blurNums) braucht je Tab unter 0,6 ms im Browser. | unkritisch | – |
| P5-18 | Laden | mittel | Supabase-Client entsteht beim Laden von app.js (window.supabase.createClient). Das Skript muss vor app.js laufen; der Start wartet deshalb weiter auf das CDN. Nur das HTML-Parsen ist frei. | gemeldet, Vorschlag (lazy Client) | – |
| P5-19 | Test (lokal) | niedrig | Ein Chrome-Lauf zeigte einmal einen CORS-Hinweis zum CoinGecko-Abruf (Origin 127.0.0.1). In drei weiteren Läufen nicht. Kein CSP-Verstoß. | unkritisch (lokaler Test) | – |
| P5-20 | Laden | niedrig | SW-Precache: 11 Dateien, alle benötigt. Splash-Bilder nicht vorab geladen. | geprüft, kein Befund | – |
| P5-21 | Prozesse | – | Secret-Scan über alle versionierten Dateien: keine Treffer. Das Muster wurde mit Probefällen geprüft; der publishable Key wird nicht gemeldet. | geprüft, kein Befund | – |

### 12.5 Befundtabelle komplett (Stand Ende Phase 5)

Quelle: Abschnitt 4 (S-, B-) und 10.2 (U-), dort mit Befund, Beleg und Details. Spalte „Status (Endstand)“: Phase-5-Änderungen eingetragen, sonst unverändert. Insgesamt 111 (S-: 34, B-: 29, U-: 48) Einträge, dazu P5-01 bis P5-21 in 12.4.

| ID | Bereich | Schwere | Status (Endstand) | Commit |
|---|---|---|---|---|
| S-01 | Sicherheit | hoch | behoben | 1454d01 |
| S-02 | Sicherheit | hoch | behoben | 1454d01 |
| S-03 | Sicherheit | mittel | behoben | 1454d01 |
| S-04 | Sicherheit | mittel | behoben | 1454d01 |
| S-05 | Sicherheit | niedrig | behoben | 1454d01 |
| S-06 | Sicherheit | mittel | behoben: toter Code entfernt (Phase 5) | b4d35f3 |
| S-07 | Header | mittel | behoben | 19ecab5 |
| S-08 | Supply Chain | mittel | behoben | 19ecab5 |
| S-09 | PIN | mittel | behoben | 8bbab07 |
| S-10 | PIN | mittel | behoben | 8bbab07 |
| S-11 | Datenschutz | niedrig | gemeldet | – |
| S-12 | Login | niedrig | gemeldet | – |
| S-13 | Sitzung | niedrig | gemeldet | – |
| S-14 | Login | niedrig | gemeldet | – |
| S-15 | Import | mittel | behoben | 3af32d3 |
| S-16 | Import | niedrig | behoben | 3af32d3 |
| S-17 | Import | niedrig | gemeldet | – |
| S-18 | Export | niedrig | gemeldet | – |
| S-19 | CSV-Export | – | unkritisch | – |
| S-20 | Secrets | – | unkritisch | – |
| S-21 | Öffentliches Repo | niedrig | gemeldet | – |
| S-22 | Doku | niedrig | behoben: README korrigiert (Phase 5) | e982957 |
| S-23 | Doku | niedrig | gemeldet (Hinweis) | – |
| S-24 | Schema | mittel | gemeldet | 707cff1 |
| S-25 | Supabase | offen | nicht geprüft | – |
| S-26 | Service Worker | niedrig | unkritisch | – |
| S-27 | Service Worker | niedrig | gemeldet | – |
| S-28 | Konsole | – | unkritisch | – |
| S-29 | Code | niedrig | teilweise behoben: plan, pcalc, theme, bars entfernt; cu und applyTh sind nicht tot (P5-08) | 874c3ce, 694ab06 |
| S-30 | Code | niedrig | behoben: Kopie in features.js entfernt, aktiv bleibt extras.js | b4d35f3 |
| S-31 | Datum | mittel | behoben: lokale Datumsbildung (R-05) | 83816a9 |
| S-32 | Design | niedrig | gemeldet (Phase 4) | – |
| S-33 | UI | niedrig | gemeldet (Phase 4) | – |
| S-34 | Header | offen | teilweise: Cache-Regeln in vercel.json, live nicht geprüft | 15bcb74 |
| B-01 | Sync | hoch | behoben | e24c6bc |
| B-02 | Sync | hoch | behoben (Eintrag in „Sicherungen“, Art `vor-cloud`) | e24c6bc |
| B-03 | Sync | mittel | umgesetzt (Teil A1) | acd510c |
| B-04 | Datenhaltung | hoch | behoben (Sicherung unter `fr_s_defekt`) | e9f3c3f |
| B-05 | Berechnung | mittel | behoben (SÄ-9) | 785af24 |
| B-06 | Anzeige | mittel | behoben (SÄ-1, SÄ-2) | ecae92f |
| B-07 | Anzeige | mittel | behoben (SÄ-3 bis SÄ-5) | 7701b0a |
| B-08 | Anzeige | mittel | behoben (SÄ-6) | 7701b0a |
| B-09 | Datum | mittel | behoben (SÄ-11) | 02c9c7b |
| B-10 | Logik | mittel | behoben (SÄ-13) | 429de13 |
| B-11 | Anzeige | niedrig | behoben | 429de13 |
| B-12 | Berechnung | niedrig | behoben (SÄ-12) | 4d976ce |
| B-13 | Anzeige | niedrig | behoben (SÄ-7) | 4d976ce |
| B-14 | Datenintegrität | mittel | behoben (SÄ-8) | 5473286 |
| B-15 | Datenintegrität | mittel | behoben (SÄ-14) | 5473286 |
| B-16 | Kennzahl | mittel | gemeldet, Entscheidung Henne | – |
| B-17 | Annahme | mittel | gemeldet, teilweise offengelegt | – |
| B-18 | Modell | niedrig | gemeldet, teilweise offengelegt | – |
| B-19 | Fehlende Funktion | mittel | gemeldet (Vorschlag) | – |
| B-20 | Logik | niedrig | gemeldet (Verhalten) | – |
| B-21 | Fehlende Funktion | niedrig | gemeldet | – |
| B-22 | Text | niedrig | gemeldet (Phase 4, Texte) | – |
| B-23 | Datenschutz | niedrig | gemeldet (Restrisiko) | – |
| B-24 | Sync | niedrig | umgesetzt (Teil A1) | 80f4deb |
| B-25 | Sync, Datenschutz | mittel | umgesetzt (Teil A1) | e61b739 |
| B-26 | Text | niedrig | gemeldet (Phase 4) | – |
| B-27 | Testlücke | niedrig | gemeldet | – |
| B-28 | Testlücke | niedrig | gemeldet (Phase 4) | – |
| B-29 | Code | niedrig | behoben, außer cu und applyTh (P5-08) | 874c3ce, 694ab06, b4d35f3 |
| U-01 | Kontrast | hoch | behoben (`--ort` #b8430f, 5,46:1) | aafe653 |
| U-02 | Kontrast | hoch | behoben (Fläche `--orb` #c2410c, 5,18:1) | aafe653 |
| U-03 | Kontrast | hoch | behoben (`--gt`, 5,87:1) | aafe653 |
| U-04 | Kontrast | hoch | behoben (`--fld`, 3,87:1 / 3,96:1) | aafe653 |
| U-05 | Kontrast | hoch | behoben (`--ort`, `--orb` für Häkchen) | e1de209 |
| U-06 | Kontrast | hoch | behoben (Symbol farbig, Text in Textfarbe) | e1de209 |
| U-07 | Kontrast | mittel | behoben (Farbe nur beim ■-Marker) | 5fee7ff |
| U-08 | Kontrast | niedrig | Ausnahme, Dekoration (Karte ist durch Fläche erkennbar) | – |
| U-09 | Kontrast | niedrig | Ausnahme, Prozentwert steht als Text daneben | – |
| U-10 | Layout | hoch | behoben (Text in `<span>`, Grids `minmax(0,1fr)`, Tabellenzellen umbrechbar) | 533438d |
| U-11 | Layout | niedrig | bewusst belassen, Seite scrollt nicht | – |
| U-12 | Touch | hoch | behoben (Phase 4); Audit misst die Box, siehe P5-15 | 4d65904 |
| U-13 | Touch | hoch | behoben (min. 44 px, sichtbar größer) | 4d65904 |
| U-14 | Touch | hoch | behoben (Trefferfläche über `::after`) | 4d65904 |
| U-15 | Touch | mittel | behoben (min. 44 px bzw. `::after`) | 4d65904 |
| U-16 | Touch | mittel | behoben (Trefferfläche 45 px über `::after`) | 0dfe08f |
| U-17 | Touch | mittel | behoben (min. 44 px; Checkbox und Regler ausgenommen) | 0dfe08f |
| U-18 | Touch | niedrig | gemeldet (Höhe ist 45 px, Breite nicht) | – |
| U-19 | Touch | niedrig | gemeldet (Label ist klickbar; Regler bleibt unverändert) | – |
| U-20 | Formular | hoch | behoben (`aria-label`, sichtbarer Text unverändert) | 64ad3f3 |
| U-21 | Formular | mittel | behoben (16 px) | ce3d35d |
| U-22 | Barrierefreiheit | hoch | behoben (`tablist`, `tab`, `aria-selected`) | 64ad3f3 |
| U-23 | Barrierefreiheit | hoch | behoben | 64ad3f3 |
| U-24 | Barrierefreiheit | mittel | behoben | 64ad3f3 |
| U-25 | Barrierefreiheit | hoch | behoben (`role=dialog`, `aria-modal`, Esc, Tab bleibt im Sheet, Fokus zurück) | 64ad3f3 |
| U-26 | Barrierefreiheit | hoch | behoben (Rolle, `aria-modal`, Hintergrund `inert`, Fokus auf Ziffern) | 64ad3f3 |
| U-27 | Barrierefreiheit | mittel | behoben (`:focus-visible`, 2 px Rahmen) | 64ad3f3 |
| U-28 | Barrierefreiheit | mittel | behoben (`role=img`, `aria-label`; Mini-Sparkline `aria-hidden`) | e2d3e7a |
| U-29 | Bewegung | mittel | behoben (Pulse entfällt bei reduzierter Bewegung) | 98e052b |
| U-30 | Bewegung | niedrig | behoben (pulsiert nur während Synchronisierung, mit Titel) | 98e052b |
| U-31 | Bewegung | niedrig | nicht vorhanden (Hook-Fehlalarm?). Grep auf marquee, ticker, scroll-Animationen: keine Treffer. Vorhandene Keyframes: pu, pg, sh, up, bl, rgIn, cf | – |
| U-32 | Bewegung | niedrig | bereits abgesichert (geprüft, unverändert) | – |
| U-33 | Bewegung | niedrig | gemeldet (reduzierte Bewegung schaltet es ab) | – |
| U-34 | Design | niedrig | nicht geändert, Entscheidung Henne | – |
| U-35 | Texte | niedrig | behoben: „Vorlagen anwenden“ | ff05a9d |
| U-36 | Texte | niedrig | behoben: „Konto & Synchronisierung“ | ff05a9d |
| U-37 | Texte | niedrig | gemeldet, Entscheidung Henne | – |
| U-38 | Texte | niedrig | gemeldet, Entscheidung Henne (nicht verändert) | – |
| U-39 | PWA | mittel | behoben (`purpose: "any maskable"`). Das Bild hat vollflächigen Hintergrund, der Ring liegt im 80-%-Sicherheitsbereich | ff05a9d |
| U-40 | PWA | niedrig | geprüft, kein Befund. Vollständigkeit gegen aktuelle Gerätetabelle nicht geprüft | – |
| U-41 | Login | niedrig | geprüft, kein offener Befund | – |
| U-42 | Login | niedrig | behoben (`:empty` ausgeblendet) | e46ccc5 |
| U-43 | Import | niedrig | behoben (App-Stil) | e46ccc5 |
| U-44 | Layout | niedrig | behoben (`nowrap`) | 0dfe08f |
| U-45 | Layout | niedrig | behoben: bei 375 px mit Ellipse gekürzt, bei 430 px vollständig | 0dfe08f |
| U-46 | Layout | niedrig | gemeldet (Vorschlag 10.5) | – |
| U-47 | Zustände | niedrig | geprüft, unkritisch | – |
| U-48 | Test | – | Testkorrektur, Grenzwerte und Assertions unverändert | aafe653, 64ad3f3, 41fe618 |

### 12.6 Prüfprotokoll vorher und nachher

| Prüfung | Befehl bzw. Werkzeug | Vorher | Nachher (Endstand) |
|---|---|---|---|
| Syntax | `node --check` (App-Dateien, sw.js), `sh tests/check-syntax.sh` (inkl. Tests) | alle OK | alle OK, 36 Dateien |
| Tests | `node --test` über alle Testdateien inkl. Unterordner | 142 grün (Start Phase 5) | **150 grün**, 0 rot, 0 übersprungen |
| Regressions-Snapshot | Scratchpad-Skript: HTML aller 19 Ansichten × 4 Fixtures, Buchung über das Formular, Zustand `S` | Referenz (Commit 0527d6b) | identisch nach jedem Commit mit App-Änderung und im Endstand |
| Browser-Matrix | `tests/ui/shoot.cjs --only extrem` (24 Bilder) bzw. `--only klein` (6 Bilder) | Phase 4: klein ohne Fehler, extrem nicht lauffähig (P5-01) | extrem 24 Bilder, 0 Konsolenmeldungen, 0 Überläufe; klein 6 Bilder, 0 Fehler |
| CSP-Lauf | lokaler Server mit `vercel.json`-Headern, Chrome `--dump-dom`, Vorher 3 Läufe, Endstand 4 Läufe | 0 Verstöße (Phase 2) und 0 Konsolenmeldungen in 3 Läufen | 0 Verstöße, 6 Tabs; in 4 Läufen je 0 Konsolenmeldungen außer einem CORS-Hinweis (P5-19) |
| Secret-Scan | `sh tests/check-secrets.sh` | nicht vorhanden | 0 Treffer in 124 Dateien |
| Messung Node | `node tests/perf/measure.cjs` | nicht gemessen (Phase 3 nur Information) | Tabelle 11.2 |
| Messung Chrome | Probe, 3 Läufe je Stand | nicht gemessen | Tabelle 11.3 |
| Stellen mit neuem `innerHTML` | `git diff` seit 0527d6b | – | eine geänderte Zeile (Tooltip, Text per `esc()`), keine neue ungeschützte Senke |

### 12.7 Abweichungen in Phase 5

- **Trailer:** `Co-Authored-By: Claude Haiku 5.5`, nicht Sonnet 5.5. Das Modell dieser Sitzung ist Haiku 5.5; die Attribution der Harness-Vorgabe wurde übernommen. Vor einem Push kann die Angabe umgeschrieben werden.
- **Tests umgestellt:** `boost.test.cjs` (Muster mit `defer`, Prüfung verschärft), `erweiterungen.test.cjs` (Vergleich zweier Parser wird Test der einzigen Version). Anzahl unverändert. Zwei neue Testdateien (`cache-header`, `perf/*`).
- **Import-Grenzen nicht benannt** (P5-11, Begründung in 12.2).
- **CSV-Import:** gemessen mit 1.500 Zeilen (Auftrag) und zusätzlich 5.000 Zeilen (Limit wirkt).
- **Werkzeugfehler** im eigenen Messskript und in der Extrem-Fixture gefunden und behoben (P5-01, P5-14), vor der Auswertung.

## 13. Abschluss

### 13.1 Offene Vorschläge und Entscheidungen für Henne (priorisiert)

Sortiert nach Nutzen, dann nach Aufwand. „Entscheidung“ heißt: nicht ohne Freigabe umsetzen. Punkte aus Phase 2 bis 4 sind mit Quelle geführt.

| # | Punkt | Quelle | Nutzen | Aufwand | Empfehlung |
|---|---|---|---|---|---|
| 1 | Supabase live: `user_state`-RLS prüfen (Advisors und `finance_state`-Policies am 27.10.2026 erledigt, 3.8) | S-25, Abschnitt 8 | hoch | Claude | vor jedem Push |
| 2 | Inline-Handler auf `addEventListener`, danach `'unsafe-inline'` aus der CSP streichen | 5.1, S-07 | hoch (XSS-Restrisiko) | groß (rund 100 `onclick`, 154 `style=`) | eigener Auftrag, je Ansicht |
| 3 | Last-Write-Wins durch Konflikt-Dialog ersetzen | B-03, 3a.8.2 | hoch (Datenverlust bei zwei Geräten) | mittel, sichtbar | umgesetzt (Teil A1) |
| 4 | Backup-Import prüfen: Datumsformate, Zahltypen, Textbeträge ablehnen statt 0 | S-17, 5.3 | hoch (fremde Backups) | klein bis mittel, sichtbar | umgesetzt (Teil A2) |
| 5 | Kontowechsel: ungesyncte Daten des alten Kontos sichern | B-25, 3a.8.3, 5.16 | mittel bis hoch | klein | umgesetzt (Teil A1) |
| 6 | Neuversuch bei Upload-Fehlern (Timer mit Obergrenze) | B-24, 5.14 | mittel | klein | umgesetzt (Teil A1) |
| 7 | Schema-Härtung nach Live-Prüfung auf Testkonto anwenden (REVOKE-Zeile seit 27.10.2026 im Vorschlag) | S-24, 5.7, `vorschlaege/` | mittel | klein, Testkonto nötig | nach Punkt 1 |
| 8 | Ausgaben-Basis vereinheitlichen (Fuck-Off-Zahl und -Rechner) | B-16, 3a.8.1, 5.11 | mittel (Zahlen ändern sich) | klein | umgesetzt (Teil A2) |
| 9 | Steuer-Annahmen ergänzen oder ausweisen (Verlustverrechnung, Vorabpauschale, Kirchensteuer, Teilfreistellung je Fondsart) | B-17, 3a.8.4, 5.13 | mittel | mittel, Rechtsabgleich | umgesetzt (Teil A2): Teilfreistellung und Kirchensteuer wählbar, Verlustverrechnung und Vorabpauschale ausgewiesen |
| 10 | Schulden mit Zins und Restlaufzeit | B-19, 3a.8.5, 5.12 | mittel | groß, Datenmodell | nur nach Freigabe |
| 11 | Wiederkehrende Buchungen pausieren und beenden | B-20 | mittel | mittel | Entscheidung |
| 12 | Supabase-Client erst bei Bedarf erzeugen (Start unabhängig vom CDN) | P5-18 | mittel | mittel, app.js | nach Punkt 2 |
| 13 | Sperr-Overlay vor dem ersten Render | S-11, 5.2 | niedrig bis mittel (Sichtschutz beim Start) | klein | empfohlen |
| 14 | `fr_pin` beim Löschen der lokalen Daten mitlöschen | S-13, 5.8 | niedrig bis mittel | klein | Entscheidung |
| 15 | Login-Meldung neutral formulieren, E-Mail-Bestätigung prüfen | S-12, S-14, 5.6 | mittel | klein | Entscheidung |
| 16 | Vercel-Cache-Regeln live prüfen (Muster in `vercel.json`) | P5-06, S-34 | niedrig | klein | vor dem Deploy |
| 17 | Live-Kurs-Fehlertext und „Kurs veraltet“ | B-21, B-22, 5.17 | niedrig | klein | empfohlen |
| 18 | Konsolenhinweis im Login-Formular | S-33 | niedrig | klein | empfohlen |
| 19 | Audit misst Trefferfläche statt Box | P5-15 | niedrig (Messung) | klein | empfohlen |
| 20 | Harness-Lücken schließen (Feed-Filter, Schnellerfassung, Prognose-Pläne, Blur ausführen) | B-27, B-28 | niedrig bis mittel | mittel | empfohlen |
| 21 | Link „Prognose Radar“ auf persönliches claude.ai-Artefakt | U-38, 10.5.1 | niedrig (öffentliches Repo) | klein | entfernen oder bewusst lassen |
| 22 | Private E-Mail in den Commit-Metadaten | S-21, 5.9 | niedrig | keine Umschreibung; GitHub-Einstellung | Entscheidung |
| 23 | Import-Grenzen benennen (Test-Ausschnitt anpassen), Standardwerte in boost.js | P5-11 | niedrig | klein | optional |
| 24 | Sicherungen-Hinweistext passt nicht mehr ganz | B-26 | niedrig | klein | empfohlen |
| 25 | `dark-glow` auf großen Zahlen | U-34, 10.5.2 | niedrig | – | Entscheidung |
| 26 | Schreibweise „Fuck Off“ (Tab) und „Fuck-Off-…“ | U-37, 10.5.3 | niedrig | klein | Entscheidung |
| 27 | Schwebender „+“ überdeckt den Buchen-Button bei 375 px | U-46, 10.5.4 | niedrig | klein bis mittel | Abstand im Inhalt |
| 28 | Tabellen mit internem Scroll als Karten | U-11, 10.5.5 | niedrig | mittel, Umbau | Skizze vorlegen |
| 29 | Kurze Chips und Checkbox auf 44 px | U-18, U-19, 10.5.6 | niedrig | klein | empfohlen |
| 30 | Kopftitel bei 375 px | U-45, 10.5.8 | niedrig | klein | Entscheidung |
| 31 | CSV-Import als Tab oder Dialog | 10.5.9 | niedrig | mittel | Entscheidung |
| 32 | Splash-Bilder gegen aktuelle iPhone-Tabelle | U-40, 10.5.10 | niedrig | klein | vor Veröffentlichung |
| 33 | Badge `#bd` pulsiert dauerhaft | U-33, 10.5.7 | niedrig | klein | empfohlen |
| 34 | „Leaked Password Protection“ im Supabase-Dashboard aktivieren (einzige Advisor-Warnung, 27.10.2026) | 3.8 | mittel | klein, Dashboard | Henne |
| 35 | Kategorie-Palette im Dunkel-Modus: Marker `#222` kaum sichtbar (rund 1,1:1) | N-01, 10.9 | niedrig | klein | Entscheidung |

### 13.2 Restrisiken (Stand Ende Phase 5)

- **`'unsafe-inline'`** in `script-src` und `style-src`. Der XSS-Schutz hängt an `esc()`. Phase 5 hat keine ungeschützte Senke hinzugefügt (Diff geprüft, 12.6).
- **PIN nur Sichtschutz.** Die Daten liegen unverschlüsselt in `localStorage`.
- **Zeitstempel vom Gerät.** Der Konflikt-Dialog (B-03, Teil A1) greift nur, wenn der Cloud-Stand neuer ist. Uhrabweichungen können einen Konflikt übersehen lassen.
- **Backup-Import** prüft Strukturen und Limits, aber nicht Datumsfelder und Textbeträge (S-17).
- **Service Worker:** geöffnete Tabs können kurz mit neuem SW und altem Stand arbeiten. Eine fehlende Datei bei der Installation bricht die Installation nicht ab (S-27).
- **Supabase live:** `user_state`-RLS nicht geprüft; Advisors und `finance_state`-Policies am 27.10.2026 geprüft (3.8). **Cache-Header live** (S-34) nicht geprüft.
- **Kontowechsel** fragt bei ungesicherten Änderungen (B-25, Teil A1). Verwerfen bleibt als Wahl im Dialog.
- **Ausschnitts-Tests:** Einige Tests lesen Funktionen per Zeichenkette aus dem Quelltext. Umbauten brechen sie, das ist gewollt, macht Änderungen aber aufwendiger.
- **Messungen** in Node und Chrome auf dem Mac, nicht auf einem iPhone. Der Audit misst Boxen (P5-15).

### 13.3 Änderungsliste

`git diff --stat backup-vor-endkontrolle-2026-10-26..HEAD` (Stand vor dem Bericht-Commit):

```
 .github/workflows/validate.yml                     |  38 +-
 CHANGELOG.md                                       |  92 +++
 CHATGPT-ANLEITUNG.md                               |  70 +-
 ENDKONTROLLE-BERICHT.md                            | 893 +++++++++++++++++++++
 README.md                                          | 103 ++-
 app.js                                             | 191 +++--
 bericht/screens/nachher/audit-leer.json            |  77 ++
 bericht/screens/nachher/audit.json                 | 458 +++++++++++
 .../screens/nachher/cash__dark__1280__klein.png    | Bin 0 -> 58379 bytes
 bericht/screens/nachher/cash__dark__375__klein.png | Bin 0 -> 47476 bytes
 bericht/screens/nachher/cash__dark__430__klein.png | Bin 0 -> 51477 bytes
 .../screens/nachher/cash__light__1280__klein.png   | Bin 0 -> 59354 bytes
 .../screens/nachher/cash__light__375__klein.png    | Bin 0 -> 47913 bytes
 bericht/screens/nachher/cash__light__375__leer.png | Bin 0 -> 40438 bytes
 .../screens/nachher/cash__light__430__klein.png    | Bin 0 -> 52172 bytes
 .../nachher/csv-import__light__375__klein.png      | Bin 0 -> 33729 bytes
 .../screens/nachher/fuckoff__dark__1280__klein.png | Bin 0 -> 87707 bytes
 .../screens/nachher/fuckoff__dark__375__klein.png  | Bin 0 -> 70729 bytes
 .../screens/nachher/fuckoff__dark__430__klein.png  | Bin 0 -> 72407 bytes
 .../nachher/fuckoff__light__1280__klein.png        | Bin 0 -> 91819 bytes
 .../screens/nachher/fuckoff__light__375__klein.png | Bin 0 -> 74470 bytes
 .../screens/nachher/fuckoff__light__375__leer.png  | Bin 0 -> 63238 bytes
 .../screens/nachher/fuckoff__light__430__klein.png | Bin 0 -> 76181 bytes
 .../screens/nachher/home__dark__1280__klein.png    | Bin 0 -> 50857 bytes
 bericht/screens/nachher/home__dark__375__klein.png | Bin 0 -> 45107 bytes
 bericht/screens/nachher/home__dark__430__klein.png | Bin 0 -> 45470 bytes
 .../screens/nachher/home__light__1280__klein.png   | Bin 0 -> 56063 bytes
 .../screens/nachher/home__light__375__klein.png    | Bin 0 -> 47598 bytes
 bericht/screens/nachher/home__light__375__leer.png | Bin 0 -> 33273 bytes
 .../screens/nachher/home__light__430__klein.png    | Bin 0 -> 48391 bytes
 bericht/screens/nachher/konsole.txt                |   1 +
 .../screens/nachher/login__light__375__klein.png   | Bin 0 -> 16929 bytes
 .../screens/nachher/mehr__dark__1280__klein.png    | Bin 0 -> 39454 bytes
 bericht/screens/nachher/mehr__dark__375__klein.png | Bin 0 -> 34376 bytes
 bericht/screens/nachher/mehr__dark__430__klein.png | Bin 0 -> 34254 bytes
 .../screens/nachher/mehr__light__1280__klein.png   | Bin 0 -> 41744 bytes
 .../screens/nachher/mehr__light__375__klein.png    | Bin 0 -> 36323 bytes
 bericht/screens/nachher/mehr__light__375__leer.png | Bin 0 -> 35835 bytes
 .../screens/nachher/mehr__light__430__klein.png    | Bin 0 -> 36218 bytes
 bericht/screens/nachher/pin__light__375__klein.png | Bin 0 -> 10380 bytes
 .../nachher/prognose__dark__1280__klein.png        | Bin 0 -> 57426 bytes
 .../screens/nachher/prognose__dark__375__klein.png | Bin 0 -> 45556 bytes
 .../screens/nachher/prognose__dark__430__klein.png | Bin 0 -> 47667 bytes
 .../nachher/prognose__light__1280__klein.png       | Bin 0 -> 58092 bytes
 .../nachher/prognose__light__375__klein.png        | Bin 0 -> 45657 bytes
 .../screens/nachher/prognose__light__375__leer.png | Bin 0 -> 43517 bytes
 .../nachher/prognose__light__430__klein.png        | Bin 0 -> 48052 bytes
 .../schnellerfassung__light__375__klein.png        | Bin 0 -> 52269 bytes
 .../nachher/vermoegen__dark__1280__klein.png       | Bin 0 -> 57561 bytes
 .../nachher/vermoegen__dark__375__klein.png        | Bin 0 -> 45750 bytes
 .../nachher/vermoegen__dark__430__klein.png        | Bin 0 -> 46070 bytes
 .../nachher/vermoegen__light__1280__klein.png      | Bin 0 -> 58311 bytes
 .../nachher/vermoegen__light__375__klein.png       | Bin 0 -> 46113 bytes
 .../nachher/vermoegen__light__375__leer.png        | Bin 0 -> 43248 bytes
 .../nachher/vermoegen__light__430__klein.png       | Bin 0 -> 46459 bytes
 boost.js                                           |  35 +-
 config.js                                          |   1 +
 extras.js                                          |  94 ++-
 features.js                                        | 214 ++---
 index.html                                         |  18 +-
 manifest.webmanifest                               |   2 +-
 styles.css                                         |  69 +-
 sw.js                                              |   6 +-
 tests/boost.test.cjs                               |   4 +-
 tests/buchungen.test.cjs                           |  60 ++
 tests/cache-header.test.cjs                        |  36 +
 tests/check-secrets.sh                             |  17 +
 tests/check-sw-version.sh                          |  24 +
 tests/check-syntax.sh                              |  15 +
 tests/coingecko-daten.test.cjs                     |  88 ++
 tests/csv-import.test.cjs                          |  73 ++
 tests/dates.test.cjs                               |  92 +++
 tests/erweiterungen.test.cjs                       | 193 +++++
 tests/fixtures/edge.json                           |  32 +
 tests/fixtures/empty.json                          |  12 +
 tests/fixtures/extreme.cjs                         |  27 +
 tests/fixtures/small.json                          |  39 +
 tests/fuckoff.test.cjs                             |  37 +
 tests/harness/fake-supabase.cjs                    |  70 ++
 tests/harness/load-app.cjs                         | 217 +++++
 tests/kennzahlen.test.cjs                          |  81 ++
 tests/kontrast.test.cjs                            |  85 ++
 tests/krypto.test.cjs                              | 115 +++
 tests/numbers.test.cjs                             |  49 ++
 tests/perf/avg-monat.test.cjs                      |  40 +
 tests/perf/measure.cjs                             | 124 +++
 tests/perf/tooltip.test.cjs                        |  30 +
 tests/pin.test.cjs                                 |  57 ++
 tests/prognose.test.cjs                            | 130 +++
 tests/reference/forecast.cjs                       | 104 +++
 tests/run-all.sh                                   |  12 +
 tests/security.test.cjs                            |  70 ++
 tests/speicher.test.cjs                            |  23 +
 tests/sync.test.cjs                                | 197 +++++
 tests/ui-static.test.cjs                           |  97 +++
 tests/ui/README.md                                 |  65 ++
 tests/ui/shoot.cjs                                 | 244 ++++++
 tests/vermoegen.test.cjs                           |  57 ++
 tests/views-smoke.test.cjs                         |  43 +
 vercel.json                                        | 126 ++-
 vorschlaege/schema-haertung.sql                    |  34 +
 101 files changed, 4792 insertions(+), 389 deletions(-)
```

`git log --oneline backup-vor-endkontrolle-2026-10-26..HEAD` (Stand vor dem Bericht-Commit, neueste zuletzt):

```
e982957 Phase 5: README, ChatGPT-Anleitung und CHANGELOG aktualisiert (6.4)
f68e199 Phase 5: CI-Workflow und tests/run-all.sh mit Syntax, allen Tests, Secret-Scan und VERSION-Prüfung (6.4)
5a68cf9 Phase 5: Kopfkommentare mit Zweck, Abhängigkeiten und Ladereihenfolge (6.3)
44a41af Phase 5: stille catch-Blöcke mit Grund kommentiert (6.3)
f75fbde Phase 5: Steuer-, Freibetrags-, Standard- und Timer-Werte als benannte Konstanten (6.3)
b4d35f3 Phase 5: toten CSV-Pfad aus features.js entfernt (S-06, S-30, B-29) (6.3)
694ab06 Phase 5: theme() und bars() aus app.js entfernt, boost.js ersetzt beide (6.3)
874c3ce Phase 5: toten Prognose-Code in app.js entfernt (plan, pcalc, Aufruf in render) (6.3)
15bcb74 Phase 5: Cache-Header für Icons und Splash (7 Tage) und must-revalidate für Code (6.2)
3d412a8 Phase 5: Skripte mit defer, preconnect zu jsDelivr und Supabase (6.2)
ee3d0a0 Phase 5: Messskript zählt auch document.addEventListener und document.querySelectorAll
98f7b51 Phase 5: Diagramm-Hinweis entfernt nur das eigene Element statt querySelectorAll bei jedem pointermove (6.1)
c542df5 Phase 5: Monatsdurchschnitt avg() in einem Durchlauf statt je Monat filtern
6eee2c7 Phase 5: Extrem-Fixture gibt beim direkten Aufruf nur JSON aus
605e7a6 Phase 5: Messskript tests/perf/measure.cjs für Laufzeiten mit der Extrem-Fixture (6.1)
0527d6b Phase 4: Bericht Abschnitt 10 (Befunde U-01 bis U-48, Kontrast, Vorher/Nachher)
cbee597 Phase 4: Matrix-Bilder nach den Korrekturen (bericht/screens/nachher)
e46ccc5 Phase 4: leeres Badge ausblenden, Datei-Auswahl im App-Stil
0ccb134 Phase 4: UI-Matrix-Werkzeug tests/ui (Screenshots, Audit, Filter)
0dfe08f Phase 4: Kopfzeile ohne Umbruch, anklickbare Abschnittsköpfe und Eingaben 44 px
5fee7ff Phase 4: Kategorie-Farben nur als Marker, Text in Textfarbe
ce3d35d Phase 4: Eingabefelder mindestens 16 px (kein Zoom in iOS)
e2d3e7a Phase 4: Diagramme mit role=img und Beschreibung
98e052b Phase 4: Bewegung: Reduced Motion für SVG-Pulse, Live-Punkt nur bei Sync
41fe618 Phase 4: Test für englische Begriffe prüft ganze Wörter
ff05a9d Phase 4: englische Reste und PWA-Manifest
64ad3f3 Phase 4: Barrierefreiheit (Rollen, Namen, Labels, Dialog-Fokus)
4d65904 Phase 4: Touch-Ziele auf mindestens 44 px
533438d Phase 4: Prognose ohne horizontalen Überlauf bei 375 px
e1de209 Phase 4: Akzent-Textfarben auf Textton (AA) umstellen
aafe653 Phase 4: Kontrast-Tokens nach WCAG AA (Hell und Dunkel)
70dfa5b Phase 3: Bericht mit Abschnitt 3a, Befunden B-01 bis B-29 und Änderungsliste
93d11b7 Phase 3: Tests für passives Einkommen, Notgroschen und Meilenstein; Harness-Stub für style.setProperty
3f54188 Phase 3: Test für Verlaufs-Cache (abgelaufen wird neu geholt, frisch nicht)
9356d78 Phase 3: Test für abgelaufene Sitzung im Sync
e13f69e Phase 3: Tests für Parser, CSV-Import mit Rückgängig, Sparplan, Vorschau, Feed, Sankey, Job-Modell, Auto-Sicherungen und CSV-Parser-Dubletten
5473286 Phase 3: Historie zeigt je Monat einen Eintrag, Bearbeiten übernimmt keinen leeren Tag oder ungültigen Monat
4d976ce Phase 3: Fuck-Off-Zahl ohne Division durch 0, Runway-Stufe ohne Zeitangabe bei Ziel 0
e24c6bc Phase 3: Sync schützt Cloud und lokale Daten vor stillem Überschreiben
e9f3c3f Phase 3: kaputten lokalen Stand (fr_s) vor dem Start sichern
429de13 Phase 3: CoinGecko-Marktdaten validieren, Coin-IDs kodieren, Mini-Verlauf ohne NaN
785af24 Phase 3: Haltefrist kalendarisch (mehr als ein Jahr), Anzeige nennt das späteste Ende
0212afa Phase 3: Prognose, Entnahme und Fuck-Off-Rechner gegen unabhängige Referenz auf den Cent geprüft
02c9c7b Phase 3: Monat übernehmen setzt den Tag 29 bis 31 auf den letzten Tag des Zielmonats
ecae92f Phase 3: Sparquote zeigt '–' ohne Einnahmen, Kennzahlen per Test über alle Ansichten abgeglichen
7701b0a Phase 3: Beträge und Prozente zeigen bei ungültigen Werten '–', kein Minus-Null, doppeltes Vorzeichen bei Erstattungen behoben
83816a9 Phase 3: Kalendertage in Ortszeit statt UTC (S-31)
3213d2b Phase 3: Test-Harness lädt die echte App per vm mit DOM-Stubs, Ansichten-Smoke-Test
abc4c6c Phase 1: Endkontroll-Bericht mit Inventar, Prüfprotokoll und Befunden
ef0ca9e Phase 1: Testdaten (Fixtures) für klein, leer, Grenzfälle und Extremfall
707cff1 Phase 2: Schema-Härtungsvorschlag abgelegt (nicht ausgeführt)
3af32d3 Phase 2: CSV-Import prüft Kalenderdaten und meldet gekürzte Dateien
8bbab07 Phase 2: PIN mit Salt und PBKDF2 hashen, Fehlversuche dauerhaft bremsen
19ecab5 Phase 2: Sicherheitsheader und SRI für Supabase-Skript
1454d01 Phase 2: XSS-Ausgabe über echtes HTML-Escaping absichern
```

Der Bericht-Commit selbst ist in der Liste nicht enthalten.

### 13.4 Nicht geprüft

- **Live-Supabase:** Policies, Advisors, `user_state`-RLS (S-25). Kein Zugriff, wie vorgegeben.
- **Vercel:** Header und Cache-Regeln im Live-System, Deployment (S-34, P5-06).
- **iPhone und Safari:** Zoom, Safe Areas, Service-Worker-Update, Splash-Bilder. Geprüft nur Chrome headless auf dem Mac.
- **Kernabläufe per Klick:** Buchung nur über eine Probe (`addTx`). Backup-Export und -Import, PIN-Eingabe, CSV mit Rückgängig, Prognose-Eingaben und Sync-Szenarien wurden nicht im Browser durchgeklickt.
- **Blur visuell:** Zeiten gemessen, Darstellung nicht geprüft.
- **Playwright:** nicht verwendet, nicht installiert.
- **Tastatur und Screenreader** (Phase 4): nicht praktisch geprüft.
- **Steuerrecht 2026, PBKDF2-Dauer auf älteren Geräten** (Phase 2 und 3): nicht gegen aktuelle Quellen bzw. Geräte geprüft.
- **GitHub-Action:** nur lokal simuliert, kein Push, kein Lauf auf GitHub.
- **Abnahme nach Plan Abschnitt 8:** Die Gesamtabnahme durch Claude steht aus. Der Executer hat die Nachweise geliefert.
- **Design-Hook:** meldete erneut `dark-glow` (U-34). Nicht geändert, Entscheidung Henne.

## 14. Umsetzung der offenen Vorschläge

Henne hat entschieden, alle offenen Vorschläge aus der Endkontrolle umzusetzen. Dieser Abschnitt führt die Umsetzung nach Teilen. Teil A1 umfasst B-03 (Konflikt-Dialog), B-24 (Upload-Neuversuch) und B-25 (Kontowechsel), also die Punkte 3, 5 und 6 aus 13.1. Keine Änderung am Datenmodell `S`, an `schema.sql` oder an den fachlichen Regeln. Kein Push, kein Deploy, kein Zugriff auf Live-Supabase, keine echten Daten, keine neue Abhängigkeit, kein Build-Schritt. `.github/workflows/` unangetastet.

### 14.1 Teil A1: Synchronisierung und Kontowechsel

Commits auf dem Branch `endkontrolle-2026-10-26-ohne-workflow` (älteste zuerst):

| Commit | Befund | Inhalt |
|---|---|---|
| `acd510c` | B-03 | Konflikt-Dialog statt Last-Write-Wins; Fehlalarm bei frischen Geräten behoben (`features.js`) |
| `e61b739` | B-25 | Kontowechsel fragt bei ungesicherten Änderungen des alten Kontos |
| `80f4deb` | B-24 | Upload-Neuversuch mit Backoff, Ereignisse „online“ und Vordergrund |
| dieser Commit | B-03, B-24, B-25 | README, CHANGELOG, Bericht |

**Prüfprotokoll**

| Prüfung | vorher (`a6372ab`) | nachher (`80f4deb`) |
|---|---|---|
| Syntax (`node --check` alle JS-Dateien und Tests) | OK | OK |
| Gesamtcheck `bash tests/run-all.sh` | 157 grün | 185 grün |
| Neue Testdateien | – | `tests/sync-konflikt.test.cjs` (8), `tests/sync-konto.test.cjs` (9), `tests/sync-neuversuch.test.cjs` (11) |
| Angepasste Assertionen | – | `tests/sync.test.cjs`: 3 Tests zum B-03-Verhalten, 1 Assertion zum 413-Text |
| Secret-Scan | keine Treffer | keine Treffer |

**Umsetzungsentscheidungen (aus dem Code, nicht von Henne bestätigt)**

- „Cloud neuer“ heißt: Cloud-Zeitstempel größer als `S.ts`, dem Stand der letzten bekannten Cloud-Fassung. Der Konflikt braucht zusätzlich `fr_dirty` und einen anderen Inhalt. Der Inhaltsvergleich ignoriert Schlüsselreihenfolge, `ts` und `uid`. `ui` und `th` zählen mit. Ein reiner Unterschied bei Panel-Zuständen oder Design kann deshalb einen Dialog auslösen. Das ist die vorsichtige Richtung, aber nicht getestet.
- Lokal ohne ungesicherte Änderungen und Cloud neuer: Die App lädt die Cloud, statt hochzuladen. Vorher lud sie mit Sicherung „Cloud-Stand vor Überschreiben“ hoch. Das ist eine Verhaltensänderung im Randfall.
- Ursache des Fehlalarms (Fund bei der Umsetzung): `autoRecurring()` in `features.js` schrieb nach der Anmeldung, bevor der Cloud-Stand geladen war (fehlendes `recDone`). Dadurch galt ein frisches Gerät als ungesichert. Jetzt schreibt die Funktion erst, wenn der Cloud-Stand für den Nutzer bekannt ist.
- Neuversuch: fünf Versuche insgesamt (1 Erstversuch und 4 Wiederholungen nach 5 s, 15 s, 45 s, 2 min). Zeitgrenze 20 s pro Anfrage. Zählt auch für das Lesen der Cloud bei der Anmeldung. Ein Ereignis („online“, Vordergrund) startet die Serie neu und löst höchstens einen Versuch aus.
- Neuversuch nur bei Netzfehler, Zeitüberschreitung, 408 und 5xx. Bei 401, 403, 413 und lokalen Fehlern (z. B. Sicherung nicht schreibbar) nicht.
- Die Restzeit „Neuer Versuch in X s.“ wird beim Neuzeichnen der Konto-Ansicht berechnet, nicht live (Abkürzung).
- Kontowechsel „Als Datei sichern und wechseln“ löst den vorhandenen Export aus (`dlBackup`, setzt `fr_exp`). Ob der Browser die Datei tatsächlich speichert, prüft die App nicht.
- `sw.js` VERSION: `fr-2026-10-27ac` (A1 Konflikt), `ad` (Kontowechsel), `ae` (Neuversuch).
- Trailer: Die Commits tragen `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`, nicht `Sonnet 5.5` wie im Auftrag. Das Modell dieses Laufs ist Haiku 5.5. Gleiche Abweichung wie in 12.7.

**Sichtbare Änderungen (vorher / nachher)**

- **SÄ-A1 Konflikt:** Vorher überschrieb ein Upload eine neuere Cloud-Fassung (letzter Upload gewinnt, Kopie in „Sicherungen“). Ein Laden der Cloud ersetzte ungesicherte lokale Änderungen (Kopie „vor Cloud-Abgleich“). Nachher: Banner „Synchronisierung pausiert“ über der Ansicht, Dialog „Cloud-Stand ist neuer“ mit „Cloud-Stand übernehmen“, „Diesen Stand behalten“ und „Später entscheiden“. Nichts wird überschrieben, nichts zusammengeführt.
- **SÄ-A2 Kontowechsel:** Vorher wurden ungesicherte Änderungen des alten Kontos beim Anmelden eines anderen Kontos still verworfen. Nachher: Dialog „Anderes Konto angemeldet“ mit „Als Datei sichern und wechseln“, „Verwerfen und wechseln“ und „Abbrechen“ (meldet das neue Konto ab). Esc wirkt wie Abbrechen. Solange der Dialog offen ist, zeigt die App keine Daten des alten Kontos und lädt oder speichert nichts.
- **SÄ-A3 Sitzungswechsel ohne Abmeldung:** Vorher konnte der Stand des alten Kontos bis zum nächsten Laden sichtbar bleiben. Nachher wird wie bei einer Anmeldung geladen; bis dahin steht „Konto wird geladen …“.
- **SÄ-A4 Upload-Fehler:** Vorher „Nicht synchronisiert: …“ mit technischem Text, kein Neuversuch. Nachher verständliche Texte. Bei Netz, Zeitüberschreitung und 5xx: automatischer Neuversuch, im Konto „Neuer Versuch in X s.“. Nach fünf Versuchen: „Automatische Versuche beendet.“ Bei 401, 403 und 413: Ursache in Klartext, kein Neuversuch.
- **SÄ-A5 Datenstand zu groß (413):** Vorher „payload too large“, nachher „Der Datenstand ist zu groß für die Cloud.“
- **SÄ-A6 Wieder online / Vordergrund:** Vorher startete der Upload nur beim Ereignis „online“ (und nur mit Nutzer). Nachher startet die App bei „online“ und bei Rückkehr in den Vordergrund sofort einen Versuch, wenn Änderungen ausstehen.

**Was nicht geprüft wurde**

- Echte Supabase-Latenz, RLS mit zwei echten Konten und die Fehlerstruktur des echten Clients. Geprüft wurde nur gegen den Fake (`tests/harness/fake-supabase.cjs`), der HTTP-Status und Netzfehler nachbildet.
- Safari und iOS (Home-Bildschirm-App, Tastatur, Hintergrund-Drosselung der Timer). Der Dialog wurde nicht in einem Browser geöffnet, nur über den DOM-Stub.
- Tatsächliche Wirkung des Dateiexports im Browser.
- Uhrabweichung zwischen Geräten (Restrisiko von B-03).
- Häufigkeit von Dialogen durch reine UI-Unterschiede (Design, Panels), siehe Umsetzungsentscheidungen.
- Die Prüfung von `user_state` (Altdaten) wird nicht automatisch wiederholt. Das ist unverändert und nicht Teil von B-24.

### 14.2 Teil A2: Nachbesserung A1, Backup, Ausgaben-Basis, Steuer-Annahmen

Umfang: Aufgaben 0 bis 4 aus dem Auftrag. Befunde S-17, S-18, B-16 und B-17 sind umgesetzt. B-18 ist teilweise umgesetzt (Hinweis zur Steuer am Ende; das Zinsmodell bleibt unverändert). Kein Push, kein Deploy, kein Zugriff auf Live-Supabase, keine echten Daten, keine neue Abhängigkeit, kein Build-Schritt. `.github/workflows/` unverändert. `schema.sql` unverändert. Am Datenmodell `S` nur zwei optionale Felder unter `S.f` (siehe unten).

**Commits** (Branch `endkontrolle-2026-10-26-ohne-workflow`, älteste zuerst):

| Commit | Befund | Inhalt |
|---|---|---|
| `d37fd04` | A1-Nachbesserung | Konflikt-Vergleich nur über Fachdaten; `ui`, `th`, `hide` lösen keinen Dialog aus (`app.js`, `tests/sync-vergleich.test.cjs`) |
| `bcc98cb` | S-18 | Export ohne `uid` (`exportJson()`), Import ignoriert eine Kennung aus der Datei |
| `a61c956` | S-17 | Import prüft jeden Datensatz und meldet übernommen, verworfen und korrigiert (`app.js`, `tests/import-pruefung.test.cjs`) |
| `b9d5f23` | B-16 | Eine Ausgaben-Basis `ausgabenBasis()` für Fuck-Off-Zahl und -Rechner; Basis wird als Text angezeigt (`app.js`, `features.js`, `tests/ausgaben-basis.test.cjs`) |
| `4f38e51` | B-17, B-18 | Teilfreistellung und Kirchensteuer wählbar, Annahmen-Liste im Tab Steuer, Hinweise (`app.js`, `features.js`, `tests/steuer-annahmen.test.cjs`, `tests/reference/forecast.cjs`) |
| `955e107` | B-17 | Formelwerte der Kirchensteuer als benannte Konstanten |
| dieser Commit | S-17, S-18, B-16, B-17, B-18 | README, CHANGELOG, Bericht (14.2, Befundtabelle, 13.1) |

**Prüfprotokoll**

| Prüfung | vorher (`e0fe898`, Ende A1) | nachher (`955e107`) |
|---|---|---|
| Syntax (`sh tests/check-syntax.sh`, alle JS-Dateien und Tests) | OK | OK |
| Gesamtcheck `bash tests/run-all.sh` | 185 grün | 230 grün |
| Neue Testdateien | – | `sync-vergleich` (4), `export-uid` (2), `import-pruefung` (23), `ausgaben-basis` (5), `steuer-annahmen` (11) = 45 neue Tests |
| Bestehende Assertions | – | keine geändert. Die Referenz `refFx` in `tests/reference/forecast.cjs` hat jetzt den Parameter `tf` (Standard 30, Ergebnis unverändert) |
| Secret-Scan | keine Treffer | keine Treffer (134 Dateien) |
| Standardwerte (Regressionsvergleich) | – | Ansichten Fire, Steuer, Plan, Home, Jahr und die Prognose-Ergebnisse für die Fixtures klein, grenzfälle und extrem: identisch zu `b9d5f23` (Stand vor den Steuer-Änderungen). Im Tab Steuer kommt nur der neue Abschnitt hinzu. |

**Umsetzungsentscheidungen (aus dem Code, nicht von Henne bestätigt)**

- *Konflikt-Vergleich (A1-Nachbesserung):* verglichen werden `tx, as, goals, rec, debts, hist, sales, f, spl, mnotes, msn, prPlans, lastImp, pi`. `S.real` ist nicht in der Liste; der Wert folgt aus `sales`.
- *Import streng nur beim Dateiimport.* Der Start aus `fr_s` und die Wiederherstellung aus den Sicherungen prüfen nicht streng. Sonst könnte ein Eintrag, den die Prüfung ablehnt, beim Start still verloren gehen. Eine Datei mit `uid` verliert die Kennung beim Import.
- *Datumsfelder:* `tx.d`, `sales.d` und `pi.items[].d` müssen echte Kalendertage sein. `as.l[].d` darf leer sein (Kauf ohne Datum), sonst ebenso Kalendertag. `hist.m` ist YYYY-MM mit Monat 01 bis 12. `goals.y` wird nicht geprüft.
- *Beträge:* endlich, |Betrag| höchstens 1 Mrd. €, auch bei Menge und Preis. Negative Werte bleiben erlaubt (eine Erstattung in einer Ausgabenkategorie ist negativ gespeichert). Textbeträge nur bei eindeutigem Format: `12,50`, `1.234,50`, `12.50`. `1.234` oder `12,500` werden verworfen.
- *Pflichtbetrag fehlt* (z. B. `tx.a`, `hist.nw`, Menge und Preis eines Bestands): Datensatz verworfen. Optionale Beträge (`as.c`, `sales.gc`, `sales.gp`, Kaufgebühr, `goals.c`) fehlen: Wert 0 wie bisher.
- *Korrigiert statt verworfen:* unbekannte Kategorie → Sonstiges, unbekannte Vermögensart → sonst, unbekannte Stand-Berechnung eines Ziels → manuell (Anzeige unverändert, weil `gv()` auf den Stand zurückfällt).
- *Ausgaben-Basis:* `ausgabenBasis()` nimmt das Ausgaben-Feld, wenn es einen Wert ungleich 0 hat, sonst Ø Ausgaben (`avg().o`). Die Fixkosten bleiben für Notgroschen und Runway. Auch „Plan aus meinen Zahlen“ in der Prognose nutzt die Basis. Bei Zahleneingaben mit Punkt (so schreibt das Zahlenfeld) ergibt das dasselbe wie vorher.
- *Teilfreistellung:* `S.f.tf` (Standard 30). Prognose und Rechner lesen dasselbe Feld; die Chips in beiden schreiben es. Gespeicherte Pläne merken `tf` und `ks`. Beim Laden eines Plans werden beide Einstellungen zurückgesetzt. Alte Pläne ohne `ks` setzen die Kirchensteuer auf keine.
- *Kirchensteuer:* `S.f.kist` (Standard 0). Mit 8 oder 9 % ersetzt der Gesamtsatz aus der Formel das Feld Steuersatz in der Prognose und den Satz der Abgeltung im Rechner (das Feld `S.f.kt` aus dem Tab Steuer wird dann nicht verwendet). Die Prognose zeigt einen Hinweis mit dem Satz.
- *Steuer-Übersicht* (Tab Steuer): ohne Kirchensteuer und mit fester Teilfreistellung von 30 % für Aktien-ETF; Aktien ohne Teilfreistellung (so wie vorher). Die Liste „[Annahmen] Steuer“ zeigt das an einer Stelle.
- *Hinweistexte* (c): Verlustverrechnung nur im selben Jahr, Vorabpauschale nicht modelliert und mit Wirkung auf den Endwert netto der Prognose, Steuer der Prognose einmalig am Ende der Ansparphase (je Jahr in der Entnahmephase), keine Steuerberatung.

**Sichtbare Änderungen (vorher / nachher)**

- **SÄ-A2-1 Konflikt:** Vorher Dialog bei reiner Änderung von Design, Panel-Zustand oder ausgeblendeten Werten. Nachher kein Dialog; Fachdaten-Unterschiede lösen weiter den Dialog aus (Tests).
- **SÄ-A2-2 Import:** Vorher „Import erfolgreich.“, ungültige Datensätze still übernommen, Textbetrag „12,50“ als 0. Nachher „Import erfolgreich. N übernommen, Y verworfen (Gründe). Korrigiert: …“. Die Bestätigung vor dem Ersetzen bleibt.
- **SÄ-A2-3 Export:** Die Datei enthält keine `uid` mehr. Im Stand bleibt sie erhalten; der Konto-Schutz (B-25) arbeitet wie vorher.
- **SÄ-A2-4 Ausgaben-Basis (B-16), Fixture klein mit leerem Ausgaben-Feld:** Fuck-Off-Zahl unverändert 282.788 € (Basis Ø Ausgaben 943 €/Monat). Rechner vorher mit Fixkosten 900 €/Monat, nachher mit Ø Ausgaben 943 €/Monat: Ø Entnahme netto 1.806 € → 1.845 €/Monat; Steuer in der Entnahme 70.463 € → 67.818 €; Kapital leer in Jahr 53,4 → 52,4; Entnahmerate zu Beginn 3,8 % → 4 %. Neue Zeile „Basis: Ø Ausgaben 943 €/Monat“ bzw. „Basis: eigene Eingabe“.
- **SÄ-A2-5 Teilfreistellung (B-17), Fixture klein, Prognose Standardwerte:** Steuer 12.621 € bei 30 % (Standard, unverändert). Bei 15 % steigt sie auf 15.382 €; Endwert netto 104.669 € → 101.908 €. Im Rechner steht die Teilfreistellung in der Steuer-Zeile.
- **SÄ-A2-6 Kirchensteuer (B-17), Fixture klein:** Standard „keine“ (26,375 %, unverändert). Mit 8 %: Gesamtsatz 27,819 %, Steuer der Prognose 13.312 €, Endwert netto 103.979 €. Mit 9 %: 27,995 %, Steuer 13.397 €, Endwert netto 103.894 €. Im Rechner: „Steuer 27,819 % (Teilfreistellung 30 %, Kirchensteuer 8 %)“.
- **SÄ-A2-7 Hinweise (B-17, B-18):** neuer Abschnitt „[Annahmen] Steuer“ im Tab Steuer; Hinweise in Prognose und Rechner ergänzt (Verlustverrechnung, Vorabpauschale).

**Neue Datenfelder** (alle unter `S`, werden mit synchronisiert; alle optional)

- `S.f.tf`: Teilfreistellung in Prozent. Standard 30 (fehlt das Feld). Auswahl 30, 15, 0.
- `S.f.kist`: Kirchensteuer in Prozent. Standard 0 (keine). Auswahl 0, 8, 9.
- `prPlans[].tf` (bestand schon) und `prPlans[].ks` (neu, optional): Einstellung des gespeicherten Plans.
- Keine neuen lokalen Schlüssel. Der Import-Bericht wird nur während des Imports gebildet und nicht gespeichert.
- `S.uid` entfällt aus der Export-Datei (kein neues Feld).

**Was nicht geprüft wurde**

- Echter Browser: Import-Dialog, Chips in Prognose und Rechner, Touch-Ziele (neue Chips mit `min-height: 44px`, nicht gemessen), Kontrast der neuen Zeilen (verwendet bestehende Textfarben; nicht gemessen). `tests/ui-static.test.cjs` und `tests/ui-render.test.cjs` laufen im Gesamtcheck grün.
- Steuerrecht: Die Kirchensteuer-Formel ist vorgegeben und nachgerechnet, nicht gegen aktuelle Gesetzestexte oder Beispiele der Finanzverwaltung geprüft.
- Gespeicherte Pläne mit `tf` und `ks`: Laden und Speichern im Browser nicht geprüft (der DOM-Stub führt keine Handler aus).
- Regressionsvergleich: drei Fixtures mit Standardwerten, Prognose ohne Entnahmephase. Die Entnahmephase ist über die Referenz (`refSim`, `refFx`) getestet, nicht im Vergleich der Oberfläche.
- `ts` aus einem Backup bleibt übernommen (Restrisiko Sync, B-03: Zeitstempel vom Gerät).
- Sicherungen-Wiederherstellung (Mehr → Datenschutz) läuft ohne Import-Prüfung; im Browser nicht geprüft.
- Trailer: Die Commits tragen `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` wie im Auftrag. Das Modell dieses Laufs ist Haiku 5.5; gleiche Abweichung wie in 14.1.
