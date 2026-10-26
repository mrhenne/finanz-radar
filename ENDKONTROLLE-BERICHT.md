# Endkontrolle Finanz-Radar: Bericht

Stand: 2026-10-26 · Basis: Commit `e4e1ff9` (Tag `backup-vor-endkontrolle-2026-10-26`) · Arbeitsbranch: `endkontrolle-2026-10-26` · Repo: `~/Developer/finanz-radar-endkontrolle`

## 0. Kurzfassung

- **Erledigt:** Phase 1 (Baseline, Inventur, Fixtures) und Phase 2 (Sicherheit, Abschnitte 3.1 bis 3.9).
- **Nicht begonnen:** Phase 3 (Berechnungen), Phase 4 (UI), Phase 5 (Performance und Prozesse). Der Auftrag beschränkte sich auf Phase 1 und 2.
- **Tests:** vorher 11 grün, nachher 28 grün (+17). Alle `node --check` grün.
- **Nicht getan (wie vorgegeben):** kein Push, kein Deploy, kein Zugriff auf die Live-Supabase, keine echten Daten, keine neuen Abhängigkeiten, nichts installiert.
- **Abweichungen:** siehe Abschnitt 8.

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

Die Fixtures werden noch von keinem Test genutzt. Ihre Nutzung ist Phase 3/5 (Messung, Nachrechnung). Commit `ef0ca9e` (Phase-1-Artefakte nach den Sicherheits-Commits, siehe Abschnitt 8).

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
- **Nicht geprüft (S-25):** Live-Policies, Advisors, `user_state`-RLS. Das ist Aufgabe von Claude (Abschnitt 8).

### 3.9 Öffentliches Repo: gemeldet

- **Commit-Metadaten (S-21):** Die private Adresse `thehenne@googlemail.com` steht als Autor in 43 Commits. Der Autor `Claude <noreply@anthropic.com>` in 5 Commits. Die Historie lässt sich nicht ändern. Entscheidung Henne.
- **Dokumente (S-23):** README und CHATGPT-ANLEITUNG enthalten keine Beträge, Klarnamen oder E-Mail-Adressen. Genannt werden der Projektname „Liquid-Wealth“ und die Tabelle `user_state`. Das ist Betriebswissen, kein Geheimnis, aber öffentlich.
- **Veraltete Aussage (S-22):** README sagt, `config.js` sei leer. Die Datei enthält URL und publishable Key.
- **Code:** Die Prognose-Ansicht verlinkt `claude.ai/artifact/…` (app.js, `plan()`, toter Code). Kein Befund.

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
| S-17 | Import | niedrig | app.js:15–42 (`normalizeImportedState`) | Backup-Datumsfelder ungeprüft; Textbeträge werden 0 (Datenverlust bei fremden Backups) | gemeldet | Code | – |
| S-18 | Export | niedrig | app.js:243 (`exportBackup`), extras.js (`dlBackup`) | Backup enthält `S.uid` (Supabase-Nutzer-ID) und `ts` | gemeldet | Code | – |
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
| S-29 | Code | niedrig | app.js: `plan`/`pcalc`, `cu`, `bars`, `applyTh`, `theme` | überschriebene oder tote Funktionen | gemeldet (Phase 3/5) | Ladeprüfung, Grep | – |
| S-30 | Code | niedrig | features.js:82, extras.js:185 | `parseCSV` doppelt (IIFE-lokal) | gemeldet (4.9) | Grep | – |
| S-31 | Datum | mittel | app.js:5, 52, 138, 222, 253; features.js:8; extras.js:56, 302 | `toISOString` für Kalendertage (UTC, Monatsgrenze) | gemeldet (Phase 3, 4.2) | Grep (8 Zeilen) | – |
| S-32 | Design | niedrig | index.html | impeccable-Hook: `dark-glow` (vorbestehend) | gemeldet (Phase 4) | Hook-Ausgabe | – |
| S-33 | UI | niedrig | Login-Ansicht | Konsolenhinweis „Password field is not contained in a form“ | gemeldet (Phase 4) | Chrome-stderr | – |
| S-34 | Header | offen | vercel.json | Cache-Header live nicht geprüft | nicht geprüft | – | – |

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

## 6. Restrisiken

- **`'unsafe-inline'`** in `script-src` und `style-src` (CSP). Inline-Handler und `style=`-Attribute bleiben. XSS-Schutz hängt damit weiter an `esc()`.
- **PIN nur Sichtschutz:** Die Daten liegen unverschlüsselt in `localStorage`. Wer das Gerät mit Entwicklerwerkzeugen öffnet, kommt an die Daten.
- **Last-Write-Wins bei zwei Geräten:** Zeitstempel kommen vom Client. Uhrzeitabweichungen können den falschen Stand gewinnen lassen. Nicht getestet (Phase 3, 4.8).
- **Backup-Import:** Fremde oder manipulierte Dateien werden bereinigt, aber Datumsfelder und Textbeträge nicht geprüft (S-17).
- **Service Worker:** Geöffnete Tabs können kurz mit neuem SW und altem Stand arbeiten (S-27).
- **Supabase `user_state`:** Alte Tabelle, RLS unbekannt. Nur Live-Prüfung (S-25).
- **Commit-Historie:** Private E-Mail öffentlich (S-21).

## 7. Änderungsliste

### 7.1 Commits seit Backup-Tag (`git log --oneline e4e1ff9..HEAD`)

- `ef0ca9e` Phase 1: Testdaten (Fixtures) für klein, leer, Grenzfälle und Extremfall
- `707cff1` Phase 2: Schema-Härtungsvorschlag abgelegt (nicht ausgeführt)
- `3af32d3` Phase 2: CSV-Import prüft Kalenderdaten und meldet gekürzte Dateien
- `8bbab07` Phase 2: PIN mit Salt und PBKDF2 hashen, Fehlversuche dauerhaft bremsen
- `19ecab5` Phase 2: Sicherheitsheader und SRI für Supabase-Skript
- `1454d01` Phase 2: XSS-Ausgabe über echtes HTML-Escaping absichern

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
- **Trailer:** Der Auftrag verlangte `Co-Authored-By: Claude Sonnet 5.5`. Die Commits tragen `Co-Authored-By: Claude Haiku 5.5`, weil das die Modellangabe dieses Laufs ist und die Attribution sonst unzutreffend wäre. Bei Bedarf in der Historie anpassen (lokal, nicht gepusht).
- **Playwright nicht verwendet:** Ersatz über Chrome-Headless (Stichproben). Keine Screenshots, keine Matrix (Phase 4).
- **Keine Browser-Tests der Bedienung:** Kernabläufe (Buchung, Backup, PIN, Import mit Rückgängig, Prognose) wurden nicht im Browser durchgeklickt. Die Logik wurde per Test oder Code-Lesung geprüft.
- **Inventar:** Zweck kurz, Ein- und Ausgaben nicht vollständig typisiert. Die Testzuordnung ist grob (Namenstreffer).
- **Berechnungen:** nicht geprüft (Phase 3). Die Dateien wurden nur auf Sicherheit gelesen.
- **Live-Supabase, Vercel, Cache-Header:** nicht geprüft (kein Zugriff vorgesehen, Abschnitt 8 des Plans).
- **Advisory-Abfrage:** nur Bulk-Endpunkt der npm-Registry. Keine GitHub-Advisory-Datenbank, keine Gewähr.
- **PBKDF2-Iterationen (310.000):** Richtwert nach gängiger Empfehlung. Die Dauer auf älteren iPhones wurde nicht gemessen. Falls die PIN-Eingabe spürbar langsamer wirkt, Wert in `features.js` (`PIN_ITER`) senken.
- **Wiederverwendung:** `features.js` `parseDate`/`parseCSV` sind tot, aber nicht gelöscht (Auftrag: nichts löschen, was nicht genannt ist).
- **Hook-Befund:** `dark-glow` in index.html nicht bearbeitet (Design, Phase 4).

## 9. Phasen 3 bis 5: noch offen (nicht beauftragt)

- **Phase 3 (Funktionen, Berechnungen, Logik):** nicht begonnen. Schwerpunkte laut Plan: Gleitkomma (4.1), Datum (4.2, S-31), Sparquote und Feed (4.3), Vermögen (4.4), Krypto (4.5), Prognose und Steuer (4.6), Erweiterungen (4.7), Synchronisierung (4.8), Ladereihenfolge (4.9, S-30).
- **Phase 4 (UI):** nicht begonnen. Matrix Hell/Dunkel × 375, 390, 430, 768, 1280 px, Kontrast, Touch-Ziele, Labels (S-33), Inline-Styles.
- **Phase 5 (Code, Performance, Prozesse):** nicht begonnen. Messungen mit der Extrem-Fixture, `defer` und `preconnect`, `validate.yml` erweitern (Syntaxschleife, Version-Prüfung), `tests/run-all.sh`, README/CHATGPT-ANLEITUNG, CHANGELOG.
