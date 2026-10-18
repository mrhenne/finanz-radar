# Finanz-Radar

Persoenliche Finanz-App (Cashflow, Vermoegen, Krypto, FIRE, Prognose, Steuer). Reines HTML/CSS/JavaScript, kein Build noetig.

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | Grundgeruest, bindet alles ein |
| `styles.css` | komplettes Design (hell/dunkel) |
| `app.js` | gesamte App-Logik, Ansichten, Charts, Login/Sync |
| `config.js` | **hier die Supabase-Zugangsdaten eintragen** |
| `schema.sql` | Tabelle `finance_state` + Row Level Security |

## Supabase einrichten
1. Projekt auf supabase.com anlegen.
2. SQL Editor: Inhalt von `schema.sql` ausfuehren.
3. Project Settings -> API: **Project URL** und **anon/publishable Key** in `config.js` eintragen (nie den service_role Key).
4. Authentication -> URL Configuration: **Site URL** = Adresse der App (z. B. `https://<name>.github.io/finanz-radar/`), dieselbe Adresse unter **Redirect URLs** eintragen. Das braucht der Link aus Bestaetigungs-, Magic-Link- und Passwort-Reset-Mails.
5. Authentication -> Providers -> Email: Registrierung aktiv lassen. Optional "Confirm email" abschalten, dann geht Login direkt nach der Registrierung.

## Login-Funktionen
Registrieren, Anmelden (E-Mail + Passwort), Login-Link per E-Mail, Passwort vergessen/neu setzen, Passwort aendern, Abmelden (optional mit Loeschen der lokalen Daten), automatische Sitzungsverlaengerung.

## Synchronisation
Eine Zeile pro Nutzer in `finance_state` (`data` = JSON). Aenderungen werden nach 1,5 s hochgeladen. Beim Login gewinnt der neuere Stand (Zeitstempel). Anderer Nutzer auf demselben Geraet: lokale Daten werden vorher verworfen, es gibt keinen Datenmix.

## Veroeffentlichen
GitHub Pages: Settings -> Pages -> Branch `main`, Ordner `/ (root)`. Oder das Repository bei Vercel importieren.

## Hinweise zur Weiterentwicklung
`app.js` ist eine lange Datei mit zusammenhaengenden Teilen. Nach jeder Aenderung alle Tabs oeffnen (Home, Cashflow, Vermoegen, FIRE, Prognose, Mehr) und die Browser-Konsole auf Fehler pruefen. Vor Updates ein Backup unter Mehr -> Daten & Backup exportieren.
