'use strict';
// Teil B (Phase 6): Statische Prüfung. Im Quelltext (HTML, JS-Vorlagen, CSS) gibt es keine on*-Attribute mehr.
// Gerenderte Ansichten prüft tests/handler-aequivalenz.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const QUELL = ['index.html', 'app.js', 'features.js', 'extras.js', 'boost.js', 'styles.css', 'sw.js'];
// Attribut-artig: on<ereignis>= gefolgt von Anführungszeichen (auch escaped in JS-Zeichenketten)
const ATTR = /\bon[a-z]+\s*=\s*\\?["'`]/gi;

test('keine on*-Attribute im Quelltext (HTML, JS-Vorlagen, CSS)', () => {
  const treffer = [];
  for (const f of QUELL) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of s.matchAll(ATTR)) treffer.push(f + ': ' + s.slice(m.index, m.index + 40));
  }
  assert.deepEqual(treffer, []);
});

test('Prüfung wirkt: das Muster findet bekannte on*-Attribute in Testtext', () => {
  assert.ok('<button onclick="x()">'.match(ATTR));
  assert.ok("'<b onchange=\\\"y()\\\">'".match(ATTR));
  assert.equal('<button data-click="x">'.match(ATTR), null);
});
