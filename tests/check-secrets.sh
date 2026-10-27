#!/bin/sh
# Einfacher Secret-Scan über alle versionierten Textdateien (git ls-files).
# Sucht Dienstschlüssel, JWT-artige Tokens, Dienst-Rollen mit Wert und private Schlüssel.
# Der publishable Key (sb_publishable_) ist öffentlich und wird nicht gemeldet.
# Ausgenommen sind die drei Dateien, die diese Muster selbst enthalten.
# Aufruf: sh tests/check-secrets.sh
cd "$(dirname "$0")/.." || exit 1
PATTERN="sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}|service_role[[:space:]]*[:=][[:space:]]*[^[:space:];]{20,}|BEGIN [A-Z ]*PRIVATE KEY"
FILES=$(git ls-files | grep -v -E '^(tests/check-secrets[.]sh|tests/run-all[.]sh|[.]github/workflows/validate[.]yml)$')
COUNT=$(printf '%s\n' "$FILES" | wc -l | tr -d ' ')
HITS=$(printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 grep -I -n -E "$PATTERN" 2>/dev/null)
if [ -n "$HITS" ]; then
  printf '%s\n' "$HITS" | sed 's/^/FUND: /'
  echo "Secret-Scan: Treffer in den Zeilen oben. Bitte prüfen, bevor etwas gepusht wird."
  exit 1
fi
echo "Secret-Scan: keine Treffer in $COUNT Dateien."
