const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// 4.1: Anzeige von Geldbeträgen und Prozenten. Ungültige Werte zeigen "–", nie "NaN €" oder "Infinity €".
const emptyState = () => ({ tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });
const app = () => loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: emptyState() });

test('eur(): ungültige Zahlen zeigen "–"', () => {
  const a = app();
  for (const v of [NaN, Infinity, -Infinity, undefined]) assert.equal(a.evalApp('eur')(v), '–', String(v));
});

test('eur(): Minus-Null wird nicht angezeigt, Beträge werden kaufmännisch gerundet', () => {
  const a = app();
  const eur = a.evalApp('eur');
  assert.equal(eur(-0.3), '0 €');
  assert.equal(eur(0), '0 €');
  assert.equal(eur(2.5), '3 €');
  assert.equal(eur(-2.5), '-3 €');
  assert.equal(eur(1234567.89), '1.234.568 €');
  assert.equal(eur(0.1 + 0.2), '0 €');
});

test('pct(): ungültige Zahlen zeigen "–", kleine negative Werte ohne Minus-Null', () => {
  const a = app();
  const pct = a.evalApp('pct');
  assert.equal(pct(NaN), '–');
  assert.equal(pct(Infinity), '–');
  assert.equal(pct(12.34), '12,3 %');
  assert.equal(pct(-0.04), '0 %');
});

test('Anzeige von Ausgaben-Erstattungen: "+40 €" statt "−-40 €"', () => {
  const state = emptyState();
  state.tx = [
    { id: 'e1', d: '2026-10-05', c: 'Freizeit', a: -40, n: 'Erstattung', r: null },
    { id: 'e2', d: '2026-10-06', c: 'Wohnen', a: 900, n: 'Miete', r: null },
    { id: 'e3', d: '2026-10-07', c: 'Gehalt', a: 3000, n: 'Lohn', r: null },
  ];
  const a = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  a.h.setTab('cash');
  a.render();
  const html = a.view();
  assert.ok(!/−-/.test(html), 'kein doppeltes Vorzeichen');
  assert.ok(html.includes('+40 €'), 'Erstattung als Plus');
  assert.ok(html.includes('−900 €'), 'Ausgabe als Minus');
  assert.ok(html.includes('+3.000 €'), 'Einnahme als Plus');
});
