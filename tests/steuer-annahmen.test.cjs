const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ref = require('./reference/forecast.cjs');
const { loadApp } = require('./harness/load-app.cjs');

// B-17 und B-18: Teilfreistellung und Kirchensteuer als Auswahl, Annahmen-Liste und Hinweise.
// Standardwerte (keine Kirchensteuer, 30 % Teilfreistellung) bleiben unverändert. Vergleich mit tests/reference/forecast.cjs.
const app = fs.readFileSync('app.js', 'utf8');
const feat = fs.readFileSync('features.js', 'utf8');
const slice = (src, from, to) => {
  const i = src.indexOf(from), j = src.indexOf(to, i + 1);
  assert.ok(i >= 0 && j > i, 'Abschnitt fehlt: ' + from);
  return src.slice(i, j);
};
// Reine Funktionen aus dem Quelltext (wie prognose.test.cjs).
const fn = {};
vm.runInNewContext(
  slice(app, 'const SYNC_DELAY_MS', '\n') + '\n' +
  slice(app, 'function kirchSatz(k)', '\n') +
  slice(feat, 'function fxSim(rg,P){', 'const fm=') +
  '\nthis.fn={kirchSatz,fxSim};',
  fn, { timeout: 2000 }
);
const { kirchSatz, fxSim } = fn.fn;
const eq = (a, b, msg, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b}`);

test('Kirchensteuer ohne Auswahl: Gesamtsatz 26,375 % (Standard unverändert)', () => {
  assert.equal(kirchSatz(0), 26.375);
});

test('Kirchensteuer 8 % und 9 %: Formel stimmt mit der Nachrechnung aus den Bestandteilen überein', () => {
  eq(kirchSatz(8), ref.refKirchSatz(8), '8 %');
  eq(kirchSatz(9), ref.refKirchSatz(9), '9 %');
});

test('Kirchensteuer: nachgerechnete Werte (3 Nachkommastellen)', () => {
  assert.equal(kirchSatz(8).toFixed(3), '27.819', '8 %: 25 / 1,02 × 1,135');
  assert.equal(kirchSatz(9).toFixed(3), '27.995', '9 %: 25 / 1,0225 × 1,145');
});

test('Fuck-Off-Rechner: Teilfreistellung 15 % und Kirchensteuer 8 % stimmen mit der Referenz überein', () => {
  const P = { v0: 10000, b0: 10000, sr: 500, F: 100000, wm: 1000, wy: 10, wi: false, inf: 2, kt: kirchSatz(8), pb: 1000, tf: 15, r: 6 };
  const r = fxSim(6, P), n = ref.refFx({ rg: 6, ...P, tf: 15 });
  eq(r.tax, n.tax, 'Steuer in der Entnahme', 0.005);
  eq(r.net, n.net, 'Netto', 0.005);
  assert.ok(r.tax > 0, 'es fällt Steuer an');
});

test('Fuck-Off-Rechner ohne Teilfreistellungsangabe: 30 % wie bisher', () => {
  const P = { v0: 10000, b0: 10000, sr: 500, F: 100000, wm: 1000, wy: 10, wi: false, inf: 2, kt: 26.375, pb: 1000, r: 6 };
  const ohne = fxSim(6, P), mit30 = fxSim(6, { ...P, tf: 30 });
  assert.equal(ohne.tax, mit30.tax);
  assert.equal(ohne.net, mit30.net);
  const n = ref.refFx({ rg: 6, ...P });
  eq(ohne.tax, n.tax, 'gegen Referenz', 0.005);
});

/* Prognose über die Oberfläche: Net Worth 10.000 € (Cash), Sparrate 500 €/Monat (zwei Monate), Standardwerte der Prognose. */
const prognose = (f = {}) => {
  const a = loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin' });
  a.h.setS({
    tx: [{ id: 's1', d: '2026-08-05', c: 'Sparen/Invest', a: 500, n: 'Sparplan', r: null }, { id: 's2', d: '2026-09-05', c: 'Sparen/Invest', a: 500, n: 'Sparplan', r: null }],
    as: [{ id: 'c1', n: 'Tagesgeld', k: 'cash', q: 1, p: 10000, c: 10000, eg: false, l: [{ d: '2026-01-01', q: 1, p: 10000, f: 0 }] }],
    goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6, ...f },
  });
  a.h.setTab('plan');
  a.render();
  return a;
};
const euro = el => Number(String(el.textContent).replace(/[^\d,-]/g, '').replace(',', '.'));

test('Prognose Standard: Steuer am Ende entspricht der Referenz (Teilfreistellung 30 %, 26,375 %)', () => {
  const a = prognose();
  const sim = ref.refSim({ s0: 10000, sm: 500, years: 20, annualPct: 7, ter: 0.2, inf: 2, tf: 30, tr: 26.375, fb: 1000 });
  const y = sim.yearEnd[20];
  const gain = y.v - y.inv;
  const expected = ref.taxEnd(gain, { tf: 30, fb: 1000, tr: 26.375 });
  assert.ok(Math.abs(euro(a.doc.getElementById('pr_o5')) - expected) <= 0.5, `Steuer ${euro(a.doc.getElementById('pr_o5'))} ≠ ${expected}`);
});

test('Prognose mit Kirchensteuer 8 %: Satz 27,819 %, Steuer nach Referenz', () => {
  const a = prognose({ kist: 8 });
  const sim = ref.refSim({ s0: 10000, sm: 500, years: 20, annualPct: 7, ter: 0.2, inf: 2, tf: 30, tr: 26.375, fb: 1000 });
  const y = sim.yearEnd[20];
  const expected = ref.taxEnd(y.v - y.inv, { tf: 30, fb: 1000, tr: ref.refKirchSatz(8) });
  assert.ok(Math.abs(euro(a.doc.getElementById('pr_o5')) - expected) <= 0.5, `Steuer ${euro(a.doc.getElementById('pr_o5'))} ≠ ${expected}`);
  assert.match(a.doc.getElementById('pr_ksn').textContent, /27,819 %/);
});

test('Prognose Teilfreistellung 15 % (gleiche Einstellung wie im Rechner): Steuer nach Referenz', () => {
  const a = prognose({ tf: 15 });
  const sim = ref.refSim({ s0: 10000, sm: 500, years: 20, annualPct: 7, ter: 0.2, inf: 2, tf: 15, tr: 26.375, fb: 1000 });
  const y = sim.yearEnd[20];
  const expected = ref.taxEnd(y.v - y.inv, { tf: 15, fb: 1000, tr: 26.375 });
  assert.ok(Math.abs(euro(a.doc.getElementById('pr_o5')) - expected) <= 0.5);
});

test('Auswahl über die Oberfläche speichert in S.f und zeigt die Annahmen', () => {
  const a = prognose();
  a.ctx.setKist(9);
  assert.equal(a.h.S().f.kist, 9);
  a.ctx.setTf(0);
  assert.equal(a.h.S().f.tf, 0);
  a.ctx.setKist(0);
  assert.equal(a.h.S().f.kist, 0);
  a.h.setTab('tax');
  assert.match(a.render(), /Kirchensteuer Prognose und Fuck-Off-Rechner/);
});

test('Steuer-Übersicht: Annahmen an einer Stelle, Hinweise zu Verlustverrechnung und Vorabpauschale', () => {
  const a = loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin' });
  a.h.setTab('tax');
  const html = a.render();
  assert.match(html, />Steuer<\/span>/);
  assert.match(html, /Abgeltung \+ Soli/);
  assert.match(html, /Pauschbetrag/);
  assert.match(html, /Teilfreistellung Aktien-ETF \(fest\)/);
  assert.match(html, /Teilfreistellung Prognose und Fuck-Off-Rechner/);
  assert.match(html, /Kirchensteuer Prognose und Fuck-Off-Rechner/);
  assert.match(html, /Verlustverrechnung|Verluste werden nur im selben Jahr verrechnet/);
  assert.match(html, /Vorabpauschale: nicht modelliert/);
  assert.match(html, /Keine Steuerberatung/);
  a.ctx.setKist(8);
  assert.match(a.render(), /8 % \(Gesamtsatz 27,819 %\)/);
});

test('Fuck-Off-Rechner-Ansicht: Steuer-Zeile nennt Teilfreistellung und Kirchensteuer', () => {
  const a = loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin' });
  a.h.setTab('fire');
  a.ctx.setKist(9);
  assert.match(a.render(), /Steuer 27,995 % \(Teilfreistellung 30 %, Kirchensteuer 9 %\)/);
});
