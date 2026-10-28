'use strict';
// Teil B (Phase 6): Die gerenderten Ansichten entsprechen dem Stand vor Teil B (909542e), bis auf die Handler-Attribute.
// Snapshot: tests/fixtures/snapshots/handler-alt.json. Je Ansicht x Fixture (19 x 4) wird geprüft:
//  - das HTML ohne Handler-Attribute hat denselben Hash wie vorher (nichts anderes hat sich geändert),
//  - Anzahl und Reihenfolge der Handler (Ereignis, Tag) sind gleich,
//  - der Funktionsname je Handler entspricht der Zuordnung aus dem alten Code (map),
//  - Texte aus dem alten Code, die Argumente sind, stehen in den neuen Argumenten,
//  - jede referenzierte Funktion ist in ACTS registriert und am Fenster eine Funktion.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadApp } = require('./harness/load-app.cjs');
const { makeExtreme } = require('./fixtures/extreme.cjs');

const SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'snapshots', 'handler-alt.json'), 'utf8'));
const fixture = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8'));
const FIX = { leer: () => fixture('empty.json'), klein: () => fixture('small.json'), grenzfaelle: () => fixture('edge.json'), extrem: () => makeExtreme() };
const PLATZHALTER = ['$value', '$checked', '$el', '$event'];
const dec = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#96;/g, '`').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const norm = c => c.replace(/'[^']*'/g, "'S'").replace(/-?\b\d+(?:\.\d+)?\b/g, 'N');
const strip = h => h.replace(/\son(?:click|change|input)="[^"]*"/g, '').replace(/\sdata-(?:click|change|input)="[^"]*"/g, '').replace(/\sdata-args="[^"]*"/g, '');
const tagOf = (html, pos) => { const i = html.lastIndexOf('<', pos); return (html.slice(i + 1).match(/^[a-zA-Z][\w-]*/) || ['?'])[0]; };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const NEU = /\sdata-(click|change|input)="([^"]*)"(?: data-args="([^"]*)")?/g;

function rendern(view, fx) {
  // seed: IDs aus uid() beim Laden sind in Altund Neu gleich (Snapshot mit demselben seed erzeugt)
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: FIX[fx](), seed: 1234 });
  app.h.setTab(view);
  return { html: app.render(), app };
}

test('Snapshot: alle 76 Ansichten x Fixtures und die Zuordnung sind vorhanden', () => {
  assert.equal(Object.keys(SNAP.views).length, 76);
  assert.ok(Object.keys(SNAP.map).length >= 40, 'Zuordnung unvollständig');
});

for (const key of Object.keys(SNAP.views)) {
  const [view, fx] = key.split('|');
  test(`Ansicht ${view} mit Daten "${fx}": gleich wie vor Teil B, nur Handler-Attribute anders`, () => {
    const exp = SNAP.views[key];
    const { html, app } = rendern(view, fx);
    assert.doesNotMatch(html, /\son(?:click|change|input|keydown|submit|focus|blur|load|error)=/, 'Inline-Handler gerendert');
    assert.equal(sha(strip(html)), exp.hash, 'HTML ohne Handler-Attribute unterscheidet sich vom Stand vor Teil B');
    const neu = [...html.matchAll(NEU)].map(m => ({ ev: m[1], tag: tagOf(html, m.index), name: dec(m[2]), args: m[3] ? JSON.parse(dec(m[3])) : [] }));
    assert.equal(neu.length, exp.list.length, 'Anzahl der Handler');
    const registriert = new Set(Array.from(app.evalApp('[...ACTS]')));
    exp.list.forEach(([ev, tag, code], i) => {
      const n = neu[i];
      assert.equal(n.ev, ev, `Ereignis #${i}`);
      assert.equal(n.tag, tag, `Tag #${i}`);
      assert.equal(SNAP.map[norm(code)], n.name, `Funktion #${i} für „${code}“`);
      for (const a of n.args) if (typeof a === 'string' && a.startsWith('$')) assert.ok(PLATZHALTER.includes(a), `Platzhalter ${a}`);
      // Texte aus dem alten Code, die Argumente sind, stehen in den neuen Argumenten (Abfragetext bei Abmelden steht in der Funktion)
      const neuS = n.args.filter(a => typeof a === 'string' && !a.startsWith('$'));
      if (n.name === 'setFNum') {
        // Feldname als Argument: im alten Code S.f.<name>=
        assert.deepEqual(neuS, [code.match(/S\.f\.(\w+)=/)[1]], `Feldname #${i} für „${code}“`);
      } else if (n.name !== 'logoutLokal') {
        const alt = [...code.matchAll(/'([^']*)'/g)].map(m => m[1]);
        assert.deepEqual(neuS, alt, `Argumente #${i} für „${code}“`);
      }
      // Zahlen und Wahrheitswerte als Argumente kommen im alten Code als Literal vor (Vorzeichen zählt)
      const zahlen = code.replace(/'[^']*'/g, '').match(/-?\b\d+(?:\.\d+)?\b/g) || [];
      for (const z of n.args.filter(a => typeof a === 'number')) assert.ok(zahlen.map(Number).includes(z), `Zahl ${z} #${i} fehlt in „${code}“`);
      for (const b of n.args.filter(a => typeof a === 'boolean')) assert.ok(code.includes(String(b)), `Wahrheitswert ${b} #${i} fehlt in „${code}“`);
      assert.ok(registriert.has(n.name), `${n.name} nicht in ACTS`);
      assert.equal(app.evalApp(`typeof window[${JSON.stringify(n.name)}]`), 'function', `${n.name} ist keine Funktion`);
    });
  });
}
