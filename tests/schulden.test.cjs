const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');
const { nachrechnung } = require('./reference/schulden.cjs');

// B-19: Schulden mit Zins und Tilgung. Rechenkern schuldPlan() gegen die unabhängige Nachrechnung.
// Erfundene Beispielwerte. Heute ist der 26.10.2026 (festes Datum).
const small = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: small });
const plan = (B, r, rate, heute) => app.evalApp(`schuldPlan(${B}, ${r}, ${rate}${heute ? ', new Date(' + heute + ')' : ''})`);
const monatsIndex = d => d.getFullYear() * 12 + d.getMonth();

test('Beispiel: 10.000 € Restschuld, 5 % p. a., 300 €/Monat ergibt 36 Raten', () => {
  const p = plan(10000, 5, 300);
  assert.equal(p.art, 'plan');
  assert.equal(p.n, 36);
  assert.ok(Math.abs(p.zins - 41.6667) < 0.001, 'Zins im ersten Monat');
  assert.ok(Math.abs(p.gesamt - 788.72) < 0.01, 'Gesamtzins');
  assert.ok(Math.abs(p.rest12 - 6827.96) < 0.01, 'Restschuld nach 12 Monaten');
  assert.equal(p.lang, false);
  // Erste Rate im Folgemonat (November 2026), Ende 36 Raten später: Oktober 2029
  assert.equal(p.ende.getFullYear(), 2029);
  assert.equal(p.ende.getMonth(), 9);
});

test('0 % Zins: n = ceil(B / Rate), kein Zins, Restschuld linear', () => {
  const p = plan(10000, 0, 300);
  assert.equal(p.art, 'plan');
  assert.equal(p.n, 34, 'ceil(33,33)');
  assert.equal(p.gesamt, 0);
  assert.equal(p.rest12, 6400);
  assert.equal(p.zins, 0);
  assert.equal(p.ende.getFullYear(), 2029);
  assert.equal(p.ende.getMonth(), 7, 'Oktober 2026 plus 34 Monate ist August 2029');
});

test('Rate zu klein: keine Laufzeit, sondern Hinweis (Rate unter dem Zins)', () => {
  const p = plan(10000, 5, 40);
  assert.equal(p.art, 'zins');
  assert.ok(Math.abs(p.zins - 41.6667) < 0.001, 'Zins je Monat als Grund des Hinweises');
  assert.equal(p.n, undefined);
  assert.equal(p.ende, undefined);
});

test('Rate genau gleich dem Zins: Hinweis, keine Division durch null', () => {
  // 10.000 € bei 6 % p. a. ergeben genau 50 € Zins je Monat
  const p = plan(10000, 6, 50);
  assert.equal(p.art, 'zins');
  assert.equal(p.zins, 50);
});

test('Rate knapp über dem Zins: lange, aber endliche Laufzeit (789 Raten)', () => {
  const p = plan(10000, 6, 51);
  assert.equal(p.art, 'plan');
  assert.equal(p.n, 789);
  assert.equal(p.lang, false);
  const ref = nachrechnung(10000, 6, 51);
  assert.equal(p.n, ref.n);
  assert.ok(Math.abs(p.gesamt - ref.gesamt) < 0.01);
});

test('mehr als 100 Jahre: Obergrenze, kein Ende und kein Gesamtzins, Restschuld bleibt endlich', () => {
  const p = plan(10000, 6, 50.1);
  assert.equal(p.art, 'plan');
  assert.equal(p.lang, true);
  assert.equal(p.n > 1200, true);
  assert.equal(p.ende, undefined);
  assert.equal(p.gesamt, undefined);
  assert.ok(Number.isFinite(p.rest12));
});

test('Rate 0: keine Tilgung eingetragen, keine Laufzeit', () => {
  assert.equal(plan(10000, 0, 0).art, 'keine-rate');
  assert.equal(plan(10000, 5, 0).art, 'keine-rate');
});

test('Restschuld 0: getilgt, keine Rechnung', () => {
  assert.equal(plan(0, 5, 300).art, 'getilgt');
});

test('Ende: Monat heute plus n, auch über den Jahreswechsel', () => {
  // 1.000 € ohne Zins, Rate 1.000 € ab 15.12.2026: eine Rate, Ende Januar 2027
  const p = plan(1000, 0, 1000, '2026, 11, 15');
  assert.equal(p.n, 1);
  assert.equal(p.ende.getFullYear(), 2027);
  assert.equal(p.ende.getMonth(), 0);
});

test('Gitter gegen die Nachrechnung: Raten, Gesamtzins und Restschuld stimmen überein', () => {
  const faelle = [];
  for (const B of [500, 4000, 10000, 123456.78]) {
    for (const r of [0, 0.5, 3.5, 5, 12, 19.99]) {
      for (const f of [1.05, 1.5, 3, 20]) {
        const zins = B * r / 1200;
        faelle.push([B, r, Math.round((zins * f + 1) * 100) / 100]);
      }
    }
  }
  let geprueft = 0;
  for (const [B, r, rate] of faelle) {
    const p = plan(B, r, rate);
    const ref = nachrechnung(B, r, rate);
    const label = `B=${B} r=${r} rate=${rate}`;
    assert.equal(p.art, 'plan', label);
    assert.equal(p.lang, ref.lang, 'Obergrenze ' + label);
    assert.ok(Number.isFinite(p.rest12), label);
    assert.ok(Math.abs(p.rest12 - ref.rest12) < 0.01, 'Restschuld ' + label);
    if (!ref.lang) {
      assert.equal(p.n, ref.n, 'Raten ' + label);
      assert.ok(Math.abs(p.gesamt - ref.gesamt) < 0.01, 'Gesamtzins ' + label);
      geprueft++;
    }
  }
  assert.ok(geprueft > 50, 'genug Fälle innerhalb der Obergrenze');
});

test('Eingaben ergeben nie NaN oder Infinity', () => {
  for (const [B, r, rate] of [[1e9, 0, 0.01], [1e9, 100, 1e9], [1, 100, 0.0001], [10000, 100, 83.34]]) {
    const p = plan(B, r, rate);
    for (const k of ['zins', 'n', 'rest12', 'gesamt']) {
      if (p[k] !== undefined) assert.ok(Number.isFinite(p[k]), `${k} bei ${B}/${r}/${rate}`);
    }
  }
});
