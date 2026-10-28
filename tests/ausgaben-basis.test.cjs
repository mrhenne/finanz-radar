const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// B-16: Fuck-Off-Zahl und Fuck-Off-Rechner nutzen dieselbe Ausgaben-Basis.
// Erfundene Beispieldaten: Ø Ausgaben 1.250 €/Monat (Juli 1.200 €, August 1.300 €, Oktober 1.250 €), Fixkosten (Vorlage) 900 €/Monat.
// Die Oktober-Buchung der Vorlage verhindert, dass autoRecurring beim Rendern eine zweite Miete einträgt.
const tx = (id, d, c, a) => ({ id, d, c, a, n: 'Beispiel ' + id, r: null });
function stand(exp) {
  return {
    tx: [tx('j1', '2026-07-01', 'Wohnen', 900), tx('j2', '2026-07-10', 'Lebensmittel', 300),
         tx('a1', '2026-08-01', 'Wohnen', 900), tx('a2', '2026-08-10', 'Lebensmittel', 400),
         { ...tx('o1', '2026-10-01', 'Wohnen', 900), r: 'r1' }, tx('o2', '2026-10-10', 'Lebensmittel', 350)],
    as: [], goals: [], rec: [{ id: 'r1', c: 'Wohnen', a: 900, n: 'Miete', e: false }], debts: [], hist: [], sales: [],
    ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp, r: 6 },
  };
}
const app = exp => {
  const a = loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin' });
  a.h.setS(stand(exp));
  return a;
};

test('ohne eigene Eingabe: Basis sind Ø Ausgaben (1.250 €), nicht die Fixkosten (900 €)', () => {
  const a = app('');
  assert.equal(a.evalApp('fixk()'), 900, 'Fixkosten unverändert für Notgroschen und Runway');
  assert.equal(a.evalApp('ausgabenBasis().wert'), 1250);
  assert.equal(a.evalApp("ausgabenBasis().quelle"), 'Ø Ausgaben');
  assert.equal(a.evalApp('fireF()'), 375000, '1.250 × 12 ÷ 4 %');
  assert.match(a.viewOf('fire'), /Entnahme 1\.250 €\/Mon\./, 'Rechner-Entnahme folgt derselben Basis');
  assert.equal(a.evalApp('basisText()'), 'Basis: Ø Ausgaben 1.250 €/Monat');
});

test('mit eigener Eingabe: Basis ist die Eingabe, Fuck-Off-Zahl und Rechner stimmen überein', () => {
  const a = app('2000');
  assert.equal(a.evalApp("ausgabenBasis().quelle"), 'eigene Eingabe');
  assert.equal(a.evalApp('fireF()'), 600000, '2.000 × 12 ÷ 4 %');
  assert.match(a.viewOf('fire'), /Entnahme 2\.000 €\/Mon\./);
  assert.equal(a.evalApp('basisText()'), 'Basis: eigene Eingabe');
});

test('Eingabe 0 gilt wie leer: Ø Ausgaben', () => {
  const a = app('0');
  assert.equal(a.evalApp('ausgabenBasis().wert'), 1250);
  assert.match(a.viewOf('fire'), /Entnahme 1\.250 €\/Mon\./);
});

test('Fuck-Off-Zahl und Rechner nennen die Basis in der Ansicht (FIRE-Tab)', () => {
  const a = app('');
  const view = a.viewOf('fire');
  assert.ok(view.includes('Basis: Ø Ausgaben 1.250 €/Monat'), 'FIRE-Tab nennt die Basis');
  assert.equal(view.split('Basis: Ø Ausgaben 1.250 €/Monat').length - 1, 2, 'Fuck-Off-Zahl und Rechner nennen sie');
  const b = app('2000');
  assert.ok(b.viewOf('fire').includes('Basis: eigene Eingabe'));
});

test('Bearbeiten-Formular: Platzhalter zeigen die Basis', () => {
  const a = app('');
  a.ctx.fxToggle(true);
  const html = a.viewOf('fire');
  assert.match(html, /id="fe" type="number"[^>]*placeholder="1250"/, 'Ausgaben-Platzhalter');
  assert.match(html, /id="ftarget"[^>]*placeholder="375000"/, 'Fuck-Off-Zahl-Platzhalter');
  assert.match(html, /Basis: Ø Ausgaben 1.250 €\/Monat/);
});
