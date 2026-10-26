const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ref = require('./reference/forecast.cjs');

// 4.6: Prognose (prSim, prFin), Fuck-Off-Rechner (fxSim, maxW) und Zielzeit (simYears).
// Die Funktionen werden aus dem Quelltext geladen (wie import-safety.test.cjs). Vergleich mit tests/reference/forecast.cjs auf den Cent.
const feat = fs.readFileSync('features.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const slice = (src, from, to) => {
  const i = src.indexOf(from), j = src.indexOf(to, i + 1);
  assert.ok(i >= 0 && j > i, 'Abschnitt fehlt: ' + from);
  return src.slice(i, j);
};
const api = {};
vm.runInNewContext(
  slice(feat, 'function prSim(rg, P) {', 'function prRun() {') +
  slice(feat, 'function fxSim(rg,P){', 'const fm=') +
  slice(app, 'function simYears(', 'function importBackup()') +
  '\nthis.api={prSim,prFin,fxSim,maxW,simYears};',
  api, { timeout: 2000 }
);
const { prSim, prFin, fxSim, maxW, simYears } = api.api;
const cent = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} ≠ ${b} (Abweichung ${Math.abs(a - b)})`);
const P = o => ({ s0: 10000, sm: 500, dyn: 0, y: 20, ter: 0, lump: [], ex: false, T: 20, wm: 0, wy: 1, wi: true, inf: 2, tr: 26.375, fb: 1000, tf: 30, tx: false, ...o });

test('Zinseszins: 10.000 € Start, 500 €/Monat, 5 % p. a., 20 Jahre, monatlich verzinst (Endwert auf den Cent)', () => {
  const arr = prSim(5, P({}));
  const expected = ref.fvEquivalent(10000, 500, 20, 5);
  cent(arr[20].v, expected);
  assert.equal(arr[20].inv, 130000);
  cent(arr[20].v, 229435.22); // Referenzwert, siehe tests/reference/forecast.cjs
});

test('Zinsmodelle: monatlich mit Jahreszins 5 % ergibt 229.435,22 €; nominal monatlich und jährlich weichen ab', () => {
  const equiv = ref.fvEquivalent(10000, 500, 20, 5);
  const nominal = ref.fvNominalMonthly(10000, 500, 20, 5);
  const annual = ref.fvAnnual(10000, 500, 20, 5);
  cent(equiv, 229435.22);
  cent(nominal, 232643.24);
  cent(annual, 224928.70);
  assert.ok(nominal > equiv && equiv > annual, 'Reihenfolge der Modelle');
});

test('Zinseszins mit TER: effektiver Satz ist Rendite minus Kosten (5 % minus 0,2 % = 4,8 %)', () => {
  const arr = prSim(5, P({ ter: 0.2 }));
  cent(arr[20].v, ref.fvEquivalent(10000, 500, 20, 4.8));
});

test('Steuer am Ende der Ansparphase: 30 % Teilfreistellung, 1.000 € Pauschbetrag, 26,375 %', () => {
  const arr = prSim(5, P({ tx: true }));
  const f = prFin(arr, P({ tx: true }));
  const v = ref.fvEquivalent(10000, 500, 20, 5);
  const net = v - ref.taxEnd(v - 130000);
  cent(f.t, ref.taxEnd(v - 130000));
  cent(f.net, net);
  cent(f.real, ref.real(net, 2, 20));
});

test('Kaufkraft: Endwert netto geteilt durch Inflation (2 % p. a., 20 Jahre)', () => {
  const arr = prSim(5, P({}));
  const f = prFin(arr, P({ tx: false }));
  cent(f.real, ref.real(arr[20].v, 2, 20));
});

test('Dynamische Sparrate: +3 % je Jahr, nachgerechnet mit der Monatsschleife', () => {
  const arr = prSim(5, P({ dyn: 3 }));
  const r = ref.refSim({ s0: 10000, sm: 500, dyn: 3, years: 20, annualPct: 5 });
  cent(arr[20].v, r.yearEnd[20].v);
  cent(arr[20].inv, r.yearEnd[20].inv);
});

test('Einmalzahlung im Jahr 5 (+10.000 €) wird am Jahresende gutgeschrieben und zählt als eingezahlt', () => {
  const lumps = [{ y: 5, a: 10000 }];
  const arr = prSim(5, P({ lump: lumps }));
  const r = ref.refSim({ s0: 10000, sm: 500, years: 20, annualPct: 5, lumps });
  cent(arr[20].v, r.yearEnd[20].v);
  cent(arr[20].inv, 140000);
  cent(arr[5].inv, 10000 + 500 * 60 + 10000);
});

test('Entnahmephase: 1.500 € je Monat mit Inflation, Steuer je Jahr, Kapital reicht bis Jahr 10 (nachgerechnet)', () => {
  const p = P({ tx: true, ex: true, T: 45, wm: 1500, wy: 25, wi: true });
  const arr = prSim(5, p);
  const r = ref.refSim({ s0: 10000, sm: 500, years: 20, annualPct: 5, ex: true, T: 45, wm: 1500, wy: 25, wi: true, inf: 2, tx: true });
  cent(arr.w.net, r.net);
  cent(arr.w.tax, r.tax);
  assert.equal(arr.w.dep, r.dep, 'Jahr der Erschöpfung');
  cent(arr[45].v, r.final);
});

test('Grenzfälle: Startkapital 0, Sparrate 0, Laufzeit 1 Jahr geben keine NaN und keine Steuer', () => {
  const arr = prSim(5, P({ s0: 0, sm: 0, y: 1, T: 1 }));
  const f = prFin(arr, P({ s0: 0, sm: 0, y: 1, T: 1, tx: true }));
  for (const x of [f.net, f.real, f.t, f.g]) assert.ok(Number.isFinite(x));
  assert.equal(f.t, 0);
  assert.equal(arr[1].v, 0);
});

test('Zielzeit (simYears) entspricht der kleinsten Monatszahl mit Endwert ≥ Ziel, Ergebnis in Jahren', () => {
  assert.equal(simYears(10000, 500, 5, 229435), 20);
  assert.equal(simYears(10000, 500, 5, 229435), ref.refYearsToTarget(10000, 500, 5, 229435));
  assert.equal(simYears(10000, 500, 5, 1000), 0, 'Ziel schon erreicht');
  assert.equal(simYears(0, 0, 0, 100), null, 'nie erreichbar');
});

test('Fuck-Off-Rechner Ansparphase: Monate bis zur Zielzahl stimmen mit der Referenz überein', () => {
  const P2 = { v0: 11500, sr: 200, b0: 9000, F: 600000, r: 6, wm: 2000, wy: 30, wi: true, inf: 2, kt: 26.375, pb: 1000 };
  const app2 = fxSim(6, P2);
  const r = ref.refFx({ ...P2, rg: 6 }); // Rendite als rg übergeben, wie fxSim(rg, P)
  assert.equal(app2.ya, r.ya, 'Jahre bis Ziel');
  cent(app2.tax, r.tax);
  cent(app2.net, r.net);
  assert.equal(app2.dep, r.dep, 'Jahr der Erschöpfung');
});

test('Fuck-Off-Rechner: höchste nachhaltige Entnahme (maxW) hält 30 Jahre, 1 % darüber nicht', () => {
  const P2 = { v0: 11500, sr: 200, b0: 9000, F: 600000, r: 6, wm: 0, wy: 30, wi: false, inf: 0, kt: 26.375, pb: 1000 };
  const max = maxW(P2);
  assert.ok(max > 0 && Number.isFinite(max));
  assert.equal(fxSim(6, { ...P2, wm: max * 0.99 }).dep, null, 'unter dem Maximum hält das Kapital');
  assert.notEqual(fxSim(6, { ...P2, wm: max * 1.01 }).dep, null, 'darüber reicht es nicht');
});

test('Fuck-Off-Rechner ohne Ansparrate und mit Null-Rendite: keine NaN, Zielzahl nie erreicht', () => {
  const res = fxSim(0, { v0: 1000, sr: 0, b0: 1000, F: 5000, wm: 100, wy: 2, wi: false, inf: 0, kt: 26.375, pb: 1000 });
  assert.equal(res.ok, false);
  assert.ok(Number.isFinite(res.net) && Number.isFinite(res.tax));
});
