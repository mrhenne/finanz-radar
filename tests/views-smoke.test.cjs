const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');
const { makeExtreme } = require('./fixtures/extreme.cjs');

// Jede Ansicht mit leeren, kleinen, Grenzfall- und Extremdaten rendern: kein Absturz,
// keine Konsolenfehler, keine NaN/Infinity/undefined-Texte im sichtbaren Inhalt.
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const FIXTURES = {
  leer: () => fixture('empty.json'),
  klein: () => fixture('small.json'),
  grenzfaelle: () => fixture('edge.json'),
  extrem: () => makeExtreme(),
};
const VIEWS = ['home', 'cash', 'assets', 'fire', 'plan', 'more', 'goals', 'tax', 'data', 'year', 'port', 'crypto', 'acct', 'review', 'rebal', 'csv', 'sec', 'passive', 'job'];
const visible = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
const BAD = /NaN|Infinity|undefined|\[object/;

for (const [name, make] of Object.entries(FIXTURES)) {
  test(`alle Ansichten rendern mit Daten "${name}" ohne Fehler`, () => {
    const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: make() });
    for (const v of VIEWS) {
      app.h.setTab(v);
      const html = app.render();
      assert.doesNotMatch(visible(html), BAD, `Ansicht ${v} (${name}) zeigt NaN/Infinity/undefined`);
    }
    assert.deepEqual(app.logsOfErrors(), [], 'keine Konsolenfehler');
  });
}

test('leere Daten: Sparquote und Net Worth zeigen "–" bzw. "0 €", nie NaN', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: FIXTURES.leer() });
  const state = app.h.S();
  state.ui.hf = true; // Details (V.home) einblenden
  app.h.setS(state);
  app.h.setTab('home');
  const html = app.render();
  const spar = html.match(/<b>([^<]*)<\/b><span>Sparquote<\/span>/);
  assert.equal(spar && spar[1], '–');
  assert.ok(html.includes('<b>0 €</b><span>Net Worth</span>'));
});
