const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// 4.8: Lokaler Stand (fr_s) darf den Start nicht blockieren, und Rohdaten gehen nicht verloren.
const T = { t0: '2026-10-26T10:00:00Z' };
test('kaputtes fr_s (kein gültiges JSON): App startet mit leerem Stand, Rohdaten werden vorher gesichert', () => {
  const broken = '{"tx":[{"id":"x1"';
  const app = loadApp({ now: T.t0, tz: 'Europe/Berlin', storage: { fr_s: broken } });
  assert.equal(app.h.S().tx.length, 0);
  app.h.setTab('home');
  app.render();
  const keys = [...app.storage.m.keys()].filter(k => k.startsWith('fr_s') && k !== 'fr_s');
  assert.ok(keys.some(k => app.storage.getItem(k) === broken), 'Rohdaten unter eigenem Schlüssel gesichert');
});

test('fr_s mit falscher Struktur (tx als Objekt): wie beim kaputten JSON, Sicherung vorher', () => {
  const bad = '{"tx":{"kein":"liste"}}';
  const app = loadApp({ now: T.t0, tz: 'Europe/Berlin', storage: { fr_s: bad } });
  assert.equal(app.h.S().tx.length, 0);
  const keys = [...app.storage.m.keys()].filter(k => k.startsWith('fr_s') && k !== 'fr_s');
  assert.ok(keys.some(k => app.storage.getItem(k) === bad));
});
