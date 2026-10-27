# Endkontrolle Finanz-Radar: Bericht

Stand: 2026-10-26 · Basis: Commit `e4e1ff9` (Tag `backup-vor-endkontrolle-2026-10-26`) · Arbeitsbranch: `endkontrolle-2026-10-26` · Repo: `~/Developer/finanz-radar-endkontrolle`

## 0. Kurzfassung

- **Erledigt:** Phase 1 (Baseline, Inventur, Fixtures), Phase 2 (Sicherheit, Abschnitte 3.1 bis 3.9) und Phase 3 (Berechnungen und Logik, Abschnitt 3a mit Befunden B-01 bis B-29).
- **Nicht begonnen:** Phase 4 (UI), Phase 5 (Performance und Prozesse).
- **Tests:** Phase 1 und 2: vorher 11, nachher 28 grün. Phase 3: 121 grün (+93). Alle `node --check` grün.
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
- **Nicht geprüft (S-25):** Live-Policies, Advisors, `user_state`-RLS. Das ist Aufgabe von Claude (Abschnitt 8).

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
| S-29 | Code | niedrig | app.js: `plan`/`pcalc`, `cu`, `bars`, `applyTh`, `theme` | überschriebene oder tote Funktionen | belegt (Phase 3), Entfernen Phase 5 | Ladeprüfung, Grep, B-29 | – |
| S-30 | Code | niedrig | features.js:82, extras.js:185 | `parseCSV` doppelt (IIFE-lokal) | belegt (4.9): aktiv ist die Version in extras.js | `erweiterungen.test.cjs` (Vergleich) | – |
| S-31 | Datum | mittel | app.js (Monat, `snap`, `doTr`, Standarddatum, `hf`); features.js (`monthNow`); extras.js (`spPanel`, `autoSnap`) | `toISOString` für Kalendertage (UTC, Monatsgrenze) | behoben: lokale Datumsbildung (R-05) | `dates.test.cjs` (8, vorher rot) | 83816a9 |
| S-32 | Design | niedrig | index.html | impeccable-Hook: `dark-glow` (vorbestehend) | gemeldet (Phase 4) | Hook-Ausgabe | – |
| S-33 | UI | niedrig | Login-Ansicht | Konsolenhinweis „Password field is not contained in a form“ | gemeldet (Phase 4) | Chrome-stderr | – |
| S-34 | Header | offen | vercel.json | Cache-Header live nicht geprüft | nicht geprüft | – | – |
| B-01 | Sync | hoch | app.js (`save`, `push`, `pull`) | Nach der Anmeldung lief der Upload-Timer, bevor der Cloud-Stand gelesen war. Ein leerer lokaler Stand konnte die Cloud überschreiben. | behoben | `sync.test.cjs` („zwei Geräte“, „Erster Abruf“), vorher rot | e24c6bc |
| B-02 | Sync | hoch | app.js (`pull`) | Das Laden der Cloud ersetzte ungesicherte lokale Änderungen ohne Sicherung. | behoben (Eintrag in „Sicherungen“, Art `vor-cloud`) | `sync.test.cjs` („ungesicherte Offline-Änderungen“), vorher rot | e24c6bc |
| B-03 | Sync | mittel | app.js (`push`) | Ein Upload überschrieb eine neuere Cloud-Fassung eines anderen Geräts (Last-Write-Wins ohne Konfliktprüfung). | behoben als Sicherung (Art `cloud`); Last-Write-Wins bleibt, Entscheidung Henne (3a.8) | `sync.test.cjs` („gleichzeitiger Upload“), vorher rot | e24c6bc |
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
| B-16 | Kennzahl | mittel | app.js (`fireF`); features.js (`fxP`, Ausgaben-Feld) | Ausgaben-Basis: Die Fuck-Off-Zahl rechnet mit Ø Ausgaben, der Fuck-Off-Rechner mit den Fixkosten, wenn das Ausgaben-Feld leer ist (Fixture: 282.788 € gegen 900 € je Monat Entnahme). | gemeldet, Entscheidung Henne | Nachmessung in 3a.8 | – |
| B-17 | Annahme | mittel | features.js (`fxSim`, `prFin`); app.js (`tax`) | Steuer-Annahmen: keine Verlustverrechnung, keine Vorabpauschale, keine Kirchensteuer; Teilfreistellung im Fuck-Off-Rechner fest 30 %. | gemeldet, teilweise offengelegt | `krypto.test.cjs`, `prognose.test.cjs` | – |
| B-18 | Modell | niedrig | features.js (`prSim`, `prFin`) | Zinsmodell: effektiver Jahreszins, monatlich verzinst; Steuer nur am Ende; Einmalzahlungen am Jahresende. | gemeldet, teilweise offengelegt | `prognose.test.cjs` | – |
| B-19 | Fehlende Funktion | mittel | app.js (`debtsHTML`, `addDebt`) | Schulden ohne Zins, Tilgung und Restlaufzeit. Schuldenabbau (Plan 4.4) ist nicht vorhanden. | gemeldet (Vorschlag) | Code-Lesung | – |
| B-20 | Logik | niedrig | features.js (`autoRecurring`) | Wiederkehrende Buchungen: keine Pause und kein Beenden. Automatisch gebucht wird nur der aktuelle Monat; frühere Monate per „Recurring anwenden“. | gemeldet (Verhalten) | `buchungen.test.cjs` | – |
| B-21 | Fehlende Funktion | niedrig | app.js (`liveHTML`) | Anzeige „Kurs veraltet“ fehlt (Plan 4.5). | gemeldet | Code-Lesung | – |
| B-22 | Text | niedrig | app.js (`liveFetch`) | Fehlertext für Kurse nennt die Entwicklungsumgebung („In der Claude-Vorschau …“). Der Nutzer sieht ihn. | gemeldet (Phase 4, Texte) | Code-Lesung | – |
| B-23 | Datenschutz | niedrig | app.js (`sugg`) | Die Eingabe der Coin-Suche (Name, kein Betrag) wird an CoinGecko gesendet. | gemeldet (Restrisiko) | Code-Lesung | – |
| B-24 | Sync | niedrig | app.js (`push`) | Upload-Fehler ohne automatischen Neuversuch (nur bei nächster Änderung, Netzrückkehr oder manuell). | gemeldet (Vorschlag) | `sync.test.cjs` („Offline“) | – |
| B-25 | Sync, Datenschutz | mittel | app.js (`pull`, `logout`) | Kontowechsel verwirft ungesyncte Daten des vorherigen Kontos (README-Regel). | gemeldet, Entscheidung Henne | `sync.test.cjs` („Konto-Wechsel“) | – |
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
14. **Neuversuch bei Upload-Fehlern** (B-24): kurzer Wiederholungs-Timer mit Obergrenze. Aufwand klein, Verhalten sichtbar im Konto-Tab.
15. **Konflikt-Dialog statt Last-Write-Wins** (B-03): Aufwand mittel, Verhalten sichtbar. Entscheidung Henne.
16. **Kontowechsel mit Sicherung** (B-25): nur wenn Henne das will (Datenschutz gegen Datenverlust abwägen).
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
- **Phase 5 (Code, Performance, Prozesse):** nicht begonnen. Messungen mit der Extrem-Fixture, `defer` und `preconnect`, `validate.yml` erweitern (Syntaxschleife, Version-Prüfung), `tests/run-all.sh`, README/CHATGPT-ANLEITUNG, CHANGELOG.

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
