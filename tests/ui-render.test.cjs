// Gerenderte Ansichten über den vm-Harness: Namen der Eingabefelder und Inline-Farben auf Text.
// Ergänzt die Prüfung des Quelltexts in ui-static.test.cjs. Erfasst auch Zustände, die nur mit
// gesetzter Auswahl erscheinen (Bearbeiten-Formular, Nachkauf).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

const VIEWS = ['home', 'cash', 'assets', 'fire', 'plan', 'more', 'goals', 'tax', 'data', 'year', 'port', 'crypto', 'acct', 'review', 'rebal', 'csv', 'sec', 'passive', 'job'];
const small = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
// Textfarben mit geprüftem Kontrast (kontrast.test.cjs). Andere Farben nur als Marker ■.
const TEXT_COLORS = ['var(--ink)', 'var(--mut)', 'var(--ort)', 'var(--gt)'];

function renderStates() {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: small });
  const out = [];
  for (const v of VIEWS) { app.h.setTab(v); out.push([v, app.render()]); }
  // Zustände mit Auswahl: Bearbeiten (Buchung und Position) und Nachkauf
  app.h.setTab('cash'); app.h.setEd({ k: 'tx', id: 'f2' }); out.push(['cash:bearbeiten', app.render()]); app.h.setEd(null);
  app.h.setTab('assets'); app.h.setEd({ k: 'as', id: 'a3' }); out.push(['assets:bearbeiten', app.render()]); app.h.setEd(null);
  app.h.setTrd({ id: 'a3', m: 'b' }); out.push(['assets:nachkauf', app.render()]); app.h.setTrd(null);
  return out;
}

test('gerenderte Ansichten: jedes Eingabefeld hat einen Namen (aria-label oder aria-labelledby)', () => {
  const bad = [];
  for (const [view, html] of renderStates()) {
    for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
      if (/type="hidden"/.test(m[0])) continue;
      if (!/aria-label=|aria-labelledby=/.test(m[0])) bad.push(view + ': ' + m[0].slice(0, 90));
    }
  }
  assert.deepEqual(bad, [], 'Eingabefeld ohne Namen');
});

test('gerenderte Ansichten: Inline-Farbe steht nur auf dem ■-Marker oder auf einer Textfarbe', () => {
  const bad = [];
  let markers = 0;
  for (const [view, html] of renderStates()) {
    // Element mit style="…color:…" und dem Text direkt darin (bis zum nächsten Tag)
    for (const m of html.matchAll(/<([a-z]+)\b[^>]*style="[^"]*\bcolor:([^;"]+)[^"]*"[^>]*>([^<]*)/g)) {
      const color = m[2].trim(), text = m[3].trim();
      if (text === '') continue; // reiner Container; Text darin wird separat geprüft
      if (text === '■') {
        markers++;
        if (!/aria-hidden="true"/.test(m[0])) bad.push(view + ': Marker ohne aria-hidden: ' + m[0].slice(0, 90));
        continue;
      }
      if (!TEXT_COLORS.includes(color)) bad.push(view + ': ' + color + ' auf Text "' + text.slice(0, 20) + '"');
    }
  }
  assert.ok(markers > 0, 'keine Marker gefunden: Prüfung wäre leer');
  assert.deepEqual(bad, [], 'Text mit Kategorie- oder Akzentfarbe');
});
