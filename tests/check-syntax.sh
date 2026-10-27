#!/bin/sh
# Syntaxprüfung: alle JavaScript-Dateien im Wurzelverzeichnis und alle Testdateien (inkl. Unterordner).
# Aufruf: sh tests/check-syntax.sh   (Node 22 oder neuer, keine Abhängigkeiten)
cd "$(dirname "$0")/.." || exit 1
status=0
for f in *.js $(find tests -name '*.cjs' | sort); do
  if node --check "$f" >/dev/null 2>&1; then
    echo "OK     $f"
  else
    echo "FEHLER $f"
    node --check "$f"
    status=1
  fi
done
exit $status
