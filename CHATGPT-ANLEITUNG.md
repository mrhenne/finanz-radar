# Update für mrhenne/finanz-radar: Fokus-Home, Job-Szenarien, Passives Einkommen, Dark Mode, PWA

Hallo ChatGPT, bitte lade dieses Update ins Repo `mrhenne/finanz-radar` (Branch `main`). Vercel deployt danach automatisch.

## Was hinzukommt

| Datei | Status | Inhalt |
|---|---|---|
| `boost.js` | NEU | Fokus-Home, Job-Szenarien (Teilzeit/Sabbatical), Passives Einkommen, Dark-Mode-Automatik, Hochzählen, Sparklines, Meilenstein-Effekt, Offline-Hinweis, Installations-Hinweis |
| `sw.js` | NEU | Service Worker: App startet offline, Updates kommen trotzdem sofort (Netzwerk zuerst) |
| `splash/` (22 PNGs) | NEU | iPhone-Startbildschirme, hell und dunkel |
| `tests/boost.test.cjs` | NEU | CI-Checks für Ladereihenfolge, Service Worker, Splash-Dateien |
| `index.html` | GEÄNDERT | `boost.js` nach `extras.js` eingebunden, Statusleiste `black-translucent`, `color-scheme`, zwei `theme-color`, Splash-Links |
| `styles.css` | ERGÄNZT | Block „Boost“ am Ende angehängt, nichts Bestehendes verändert |
| `manifest.webmanifest` | GEÄNDERT | `id`, `scope`, `lang`, `description`, Farben an Hintergrund angepasst |
| `vercel.json` | ERGÄNZT | Header für `/sw.js`: kein Caching |
| `.github/workflows/validate.yml` | ERGÄNZT | `node --check boost.js` und `node --check sw.js` |

## Bitte NICHT anfassen

- `app.js`, `features.js`, `extras.js`: unverändert, bitte nicht überschreiben oder „aufräumen“
- `config.js`, `schema.sql`, Supabase-Login und Sync: unverändert
- Keine neuen Supabase-Tabellen nötig. Neue Felder (`job`, `pi`, `thv`, `msSeen`, `ui.hf`) liegen im bestehenden JSON-Datensatz

## Vorgehen

1. ZIP entpacken und alle oben genannten Dateien ins Repo-Root kopieren (Ordner `splash/` komplett mit hochladen).
2. Commit, z. B. `Fokus-Home, Job-Szenarien, Passives Einkommen, PWA`.
3. Warten, bis die GitHub-Action „Validate Finanz-Radar“ grün ist.

## Checks nach dem Deployment

1. https://finanz-radar-app.vercel.app öffnen, einloggen: Home zeigt den Fortschrittsring, drei Kacheln und den Button „Alle Details anzeigen“.
2. Mehr → „Passives Einkommen“ und „Job-Szenarien · Teilzeit“ öffnen sich ohne Fehler.
3. `https://finanz-radar-app.vercel.app/sw.js` liefert JavaScript (kein 404).
4. Browser-Konsole: keine roten Fehler.
5. Falls die alte Version hängen bleibt: Seite einmal neu laden. Der Service Worker übernimmt ab dem zweiten Aufruf.

## Rückbau im Notfall

`<script src="boost.js"></script>` aus `index.html` entfernen. Die App läuft dann exakt wie vorher. Den Service Worker zusätzlich in den Browser-Einstellungen abmelden oder `sw.js` durch eine Datei ersetzen, die nur `self.registration.unregister()` aufruft.
