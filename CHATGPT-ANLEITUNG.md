# Anleitung für Änderungen an mrhenne/finanz-radar (für ChatGPT)

Hallo ChatGPT, bitte arbeite an diesem Repo nach dieser Anleitung. Repo `mrhenne/finanz-radar`, Branch `main`. Vercel veröffentlicht jeden Commit auf `main` automatisch. **Nichts pushen oder deployen, ohne dass Henne ausdrücklich zustimmt.**

## Stand

Die Endkontrolle (Sicherheit, Berechnungen, UI, Performance, Prozesse) ist abgeschlossen. Die Änderungen stehen in `CHANGELOG.md`, offene Entscheidungen und Restrisiken in `ENDKONTROLLE-BERICHT.md`. Die README beschreibt Dateien, Ladereihenfolge, lokale Schlüssel und die Regeln ausführlich.

## Ablauf (immer in dieser Reihenfolge)

1. **Backup:** vor der ersten Änderung ZIP des Ordners oder ein Git-Tag anlegen.
2. **Ändern:** nur die Dateien, die der Auftrag nennt. Vorhandenen Stil und Formatierung übernehmen. Keine Umbauten „nebenbei“.
3. **Testen:** `sh tests/run-all.sh` ausführen. Prüft Syntax aller JavaScript-Dateien, alle Tests (inklusive Unterordner) und den Secret-Scan. Rot heißt: Änderung zurücknehmen oder den Fehler beheben.
4. **Doppelt prüfen:** `git diff` ein zweites Mal lesen. Achte auf:
   - neue `innerHTML`-Stellen ohne `esc()`,
   - `toISOString()` für Kalendertage,
   - `console.log` mit Nutzerdaten, Tokens oder Beträgen,
   - geänderte fachliche Regeln, geänderte Felder in `S`, neue externe Domains,
   - abgeschwächte oder gelöschte Tests.
5. **Zusammenfassung:** welche Dateien geändert wurden, was sich für Henne sichtbar ändert, was getestet wurde und was offen bleibt.

## Regeln für den Code

- **Nutzertext immer mit `esc()` ausgeben.** `esc()` escaped `& < > " ' \``. Attribute und Argumente in `onclick` nie aus Rohtext bauen.
- **Kalendertage nie mit `toISOString()` bilden** (UTC). Stattdessen `ymdOf()`, `ymOf()` oder `ldate()` aus `app.js`.
- **`VERSION` in `sw.js` erhöhen**, sobald eine ausgelieferte Datei geändert wird (`index.html`, `styles.css`, `config.js`, `app.js`, `features.js`, `extras.js`, `boost.js`, `manifest.webmanifest`, `sw.js`). Die CI prüft das gegen die Basis.
- **Fachliche Werte** (Steuern, Freibeträge, Limits, Fristen) als benannte Konstanten führen. Werte nur mit zugehörigem Test ändern.
- **Ladereihenfolge:** `index.html` lädt Supabase (mit SRI und `defer`), dann `config.js`, `app.js`, `features.js`, `extras.js`, `boost.js`. Supabase muss vor `app.js` laufen.
- **Tests:** im bestehenden Muster bleiben (Funktionen per `vm` aus dem Quelltext laden, Harness in `tests/harness/`). Neue nicht-triviale Logik braucht mindestens einen Test.

## Nicht anfassen ohne Freigabe

- `config.js` enthält nur die Project-URL und den **öffentlichen** Publishable Key. Kein `service_role`- oder Secret-Key, nie.
- `schema.sql`, Supabase-Einstellungen und Policies: nicht ändern oder ausführen. Vorschläge liegen in `vorschlaege/`.
- Datenmodell `S`: keine Felder umbenennen oder entfernen. Neue Felder nur nach Absprache.
- Lokale Schlüssel (`fr_s`, `fr_dirty`, `fr_s_defekt*`, `fr_bk`, `fr_pin`, `fr_sec`, `fr_exp`, `fr_cg`): Namen und Bedeutung nicht ändern.
- Fachliche Regeln aus der README (Sparquote, Feed-Reihenfolge, „Fuck Off“, Blur, Prognose-IDs `pr_`).
- Keine neuen Abhängigkeiten, kein Build-Schritt.

## Prüfungen in der CI

`.github/workflows/validate.yml` führt aus: Syntax aller Dateien, alle Tests, Erreichbarkeit und SRI-Hash des Supabase-Skripts (braucht Netz), Konfigurationsprüfung, Secret-Scan und die VERSION-Prüfung. Lokal reicht `sh tests/run-all.sh`. Die Netzprüfungen laufen nur in der CI.

Messung (optional): `node tests/perf/measure.cjs`. UI-Matrix mit Chrome (optional): `node tests/ui/shoot.cjs`, siehe `tests/ui/README.md`.

## Checks nach dem Deployment

1. https://finanz-radar-app.vercel.app öffnen. Die Tabs Home, Cashflow, Vermögen, FIRE, Prognose und Mehr müssen sich öffnen.
2. Browser-Konsole: keine roten Fehler.
3. https://finanz-radar-app.vercel.app/sw.js liefert JavaScript (kein 404) und die neue `VERSION`.
4. Falls die alte Version hängen bleibt: Seite einmal neu laden. Der Service Worker übernimmt die neue Version beim zweiten Aufruf.

## Rückbau im Notfall

Den letzten Commit zurücknehmen (`git revert`), nicht die Historie umschreiben. Vor einem Rückbau mit Henne abstimmen.
