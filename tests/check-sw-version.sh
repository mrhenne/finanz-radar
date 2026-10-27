#!/bin/sh
# Prüft: Hat sich eine ausgelieferte Datei seit BASE geändert, muss VERSION in sw.js erhöht sein.
# Aufruf: sh tests/check-sw-version.sh <Basis-Commit>   (in der CI: Basis des Pull Requests bzw. vorheriger Commit)
# Ohne gültige Basis (z. B. erster Commit eines Branches) wird übersprungen, nicht als Fehler gewertet.
cd "$(dirname "$0")/.." || exit 1
BASE="$1"
if [ -z "$BASE" ] || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "Keine gültige Basis ($BASE), VERSION-Prüfung übersprungen."
  exit 0
fi
CHANGED=$(git diff --name-only "$BASE" HEAD -- index.html app.js features.js extras.js boost.js config.js styles.css manifest.webmanifest sw.js)
if [ -z "$CHANGED" ]; then
  echo "Keine ausgelieferten Dateien seit $BASE geändert."
  exit 0
fi
OLD=$(git show "$BASE:sw.js" 2>/dev/null | sed -n "s/^const VERSION = '\(.*\)';.*/\1/p")
NEW=$(sed -n "s/^const VERSION = '\(.*\)';.*/\1/p" sw.js)
echo "Geänderte Dateien:"; printf '  %s\n' $CHANGED
if [ -z "$NEW" ]; then echo "FEHLER: keine VERSION in sw.js gefunden."; exit 1; fi
if [ "$OLD" = "$NEW" ]; then
  echo "FEHLER: ausgelieferte Dateien geändert, aber sw.js VERSION ist unverändert ($NEW)."
  exit 1
fi
echo "VERSION erhöht: $OLD -> $NEW"
