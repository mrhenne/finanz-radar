const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('../harness/load-app.cjs');
const { makeExtreme } = require('../fixtures/extreme.cjs');

// 6.1 (Phase 5): avg() summiert in einem Durchlauf. Das Ergebnis muss exakt dem alten Verfahren
// entsprechen (je Monat alle Buchungen filtern), sonst ändern sich Ø-Ausgaben und Fuck-Off-Zahl.
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8'));
const CASES = {
  leer: () => fixture('empty.json'),
  klein: () => fixture('small.json'),
  grenzfaelle: () => fixture('edge.json'),
  extrem: makeExtreme,
};

// Altes Verfahren als Referenz (Reihenfolge der Summen wie vorher)
function referenz(app, tx) {
  const IN = app.evalApp('IN');
  const sm = (l, t) => l.filter(x => IN.includes(x.c) === (t === 'in') && (t === 'in' || x.c !== 'Sparen/Invest')).reduce((s, x) => s + x.a, 0);
  const ms = [...new Set(tx.map(x => x.d.slice(0, 7)))];
  if (!ms.length) return { i: 0, o: 0, s: 0 };
  let i = 0, o = 0, s = 0;
  ms.forEach(m => {
    const l = tx.filter(x => x.d.startsWith(m));
    i += sm(l, 'in');
    o += sm(l, 'out');
    s += l.filter(x => x.c === 'Sparen/Invest').reduce((z, x) => z + x.a, 0);
  });
  return { i: i / ms.length, o: o / ms.length, s: s / ms.length };
}

for (const [name, make] of Object.entries(CASES)) {
  test(`avg() entspricht dem Referenzverfahren (${name})`, () => {
    const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: make() });
    const got = JSON.parse(JSON.stringify(app.evalApp('avg()')));
    assert.deepEqual(got, referenz(app, app.h.S().tx));
  });
}
