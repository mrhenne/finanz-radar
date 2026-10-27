#!/bin/sh
# Ein Befehl für alle lokalen Prüfungen. Dieselben Schritte laufen in .github/workflows/validate.yml.
# Aufruf: sh tests/run-all.sh   (Node 22 oder neuer; ohne npm, ohne Build-Schritt, ohne Netz)
# Die Prüfungen gegen den Supabase-CDN (Erreichbarkeit, SRI-Hash) brauchen Netz und laufen nur in der CI.
cd "$(dirname "$0")/.." || exit 1
echo "== 1/3 Syntax (alle JavaScript-Dateien)"
sh tests/check-syntax.sh || { echo "Syntax: FEHLER"; exit 1; }
echo "== 2/3 Tests (alle Testdateien, inkl. Unterordner)"
node --test $(find tests -name '*.test.cjs' | sort) || { echo "Tests: FEHLER"; exit 1; }
echo "== 3/3 Secret-Scan"
sh tests/check-secrets.sh || { echo "Secret-Scan: FEHLER"; exit 1; }
echo "Alle lokalen Prüfungen bestanden."
