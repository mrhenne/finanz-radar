# UI-Matrix und Sichtprüfung

Werkzeug für Phase 4 der Endkontrolle. Erzeugt Screenshots aller Tabs und Sheets und ein DOM-Audit, ohne npm und ohne Build-Schritt.

## Voraussetzungen

- macOS mit Google Chrome unter `/Applications/Google Chrome.app` (Pfad per `--chrome` änderbar).
- Node 22 oder neuer (globales `WebSocket` und `fetch`).

## Aufruf

```sh
# komplette Matrix: 10 Ansichten × Hell/Dunkel × 5 Breiten × 3 Fixtures = 300 Bilder
node tests/ui/shoot.cjs

# nur eine Fixture (leer | klein | extrem), eigener Zielordner
node tests/ui/shoot.cjs --only klein --out bericht/screens/test

# reduzierte Matrix: Breiten, Themes, Ansichten und Sheets einschränken
node tests/ui/shoot.cjs --only klein --widths 375,430,1280 --themes light,dark --views home,cash,vermoegen,fuckoff,prognose,mehr --sheets none --out bericht/screens/nachher

# eine einzelne Prüfung: JavaScript im Dokument auswerten
node tests/ui/shoot.cjs --probe "document.title" --tab plan --w 375 --fx klein --theme light
```

Die Tests für Kontrast und Barrierefreiheit laufen ohne Browser:

```sh
node --test tests/*.test.cjs
```

## Was das Skript macht

1. Startet einen lokalen Server auf `127.0.0.1` (Zufallsport), der nur Dateien aus dem Repo ausliefert (keine Dotfiles).
2. Ersetzt `config.js` durch den Stand **ohne Supabase-URL**. Die App läuft dann lokal, ohne Netz zu Supabase und ohne Login. Für die Login-Ansicht wird eine Dummy-URL (`127.0.0.1:9`) gesetzt, die nie erreicht wird. Die echte `config.js` im Repo bleibt unverändert.
3. Startet Chrome headless mit DevTools-Protokoll (Port 9333, Profil im Ordner `~/.cache/finanz-radar-shots`, wird bei jedem Lauf neu angelegt).
4. Setzt je Bild die Fixture per `localStorage` (`fr_s`), Design über `th` (`light` oder `dark`). Die PIN-Ansicht bekommt zusätzlich einen Test-PIN-Eintrag (`fr_pin`, Ziffern `1234`, nur erfundene Werte).
5. Schaltet mit `prefers-reduced-motion: reduce` ab, damit die Bilder deterministisch sind. Animationen werden dadurch nicht geprüft.
6. Schreibt pro Bild eine PNG-Datei `<ansicht>__<theme>__<breite>__<fixture>.png` in den Zielordner.
7. Schreibt `audit.json` (horizontaler Überlauf, Ziele unter 44 px je Bild) und `konsole.txt` (Fehler und Ausnahmen der Seite).

## Ansichten und Sheets

| Name | Ansicht |
|---|---|
| `home`, `cash`, `vermoegen`, `fuckoff`, `prognose`, `mehr` | Tabs (Tab-Schlüssel `home`, `cash`, `assets`, `fire`, `plan`, `more`) |
| `schnellerfassung` | Sheet über den „+“-Button |
| `csv-import` | CSV-Import-Ansicht |
| `pin` | PIN-Sperre (Sperr-Overlay mit Ziffernblock) |
| `login` | Login-Ansicht (nur mit Dummy-Konfiguration sichtbar) |

## Fixtures

| Name | Datei | Inhalt |
|---|---|---|
| `leer` | `tests/fixtures/empty.json` | leerer Datensatz |
| `klein` | `tests/fixtures/small.json` | 3 Monate, erfundene Werte |
| `extrem` | `tests/fixtures/extreme.cjs` | 5.000 Buchungen, 12 Jahre, 20 Krypto-Positionen |

## Grenzen

- Nur Chrome headless, kein Safari. Die Bilder zeigen Chrome-Rendering auf dem Mac, nicht den iPhone-Safari-Stand.
- Keine Bedienung (Klicks, Eingaben). Kernabläufe bleiben manuell zu prüfen.
- Der Blur-Modus (◉) wird nicht gesondert fotografiert.
- Die Breiten 375 bis 430 px sind eine Chrome-Geräteemulation mit Touch, kein echtes Gerät.
