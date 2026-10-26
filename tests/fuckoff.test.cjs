const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

// 4.1 / 4.7: Fuck-Off-Zahl und Runway-Stufen bei ungültigen oder leeren Eingaben.
const small = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
const empty = () => ({ tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });

test('Fuck-Off-Zahl mit Entnahmerate 0 (Sicherung eingespielt): Standard 4 % statt Unendlich', () => {
  const state = small();
  state.f = { wr: 0, exp: '2000', r: 6 };
  const app = loadApp({ now: '2026-09-15T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  assert.equal(app.evalApp('fireF()'), 600000);
  app.h.setTab('fire');
  const html = app.render();
  assert.ok(!html.includes('Infinity') && !html.includes('∞'), 'keine Unendlich-Anzeige');
});

test('Fuck-Off-Zahl mit fehlender oder ungültiger Entnahmerate: Standard 4 %', () => {
  const state = small();
  state.f = { exp: '2000', r: 6 };
  const a = loadApp({ now: '2026-09-15T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  assert.equal(a.evalApp('fireF()'), 600000);
  state.f = { wr: 'abc', exp: '2000', r: 6 };
  const b = loadApp({ now: '2026-09-15T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  assert.equal(b.evalApp('fireF()'), 600000);
});

test('Runway-Stufen ohne Fixkosten: keine Zeitangabe "ca. 0,0 Jahre" bei Stufen mit Ziel 0', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: empty() });
  app.h.setTab('fire');
  const html = app.render();
  assert.ok(!/ca\. 0,0 Jahre/.test(html), 'keine Zeitangabe bei Ziel 0');
  assert.ok(!html.includes('NaN'));
});
