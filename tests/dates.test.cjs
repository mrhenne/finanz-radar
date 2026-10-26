const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// S-31: Kalendertage und Monate müssen in der Ortszeit des Geräts gebildet werden.
// toISOString() liefert UTC: zwischen 00:00 und 01:00/02:00 Ortszeit am 1. wäre das der Vormonat.
// Der Lauf setzt TZ=Europe/Berlin (Winter- und Sommerzeit getestet).
const BERLIN = { tz: 'Europe/Berlin' };
const emptyState = () => ({ tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });

test('Monatsgrenze: 1. November 00:30 Ortszeit startet im November, nicht im Oktober', () => {
  const app = loadApp({ ...BERLIN, now: '2026-10-31T23:30:00Z', fixture: emptyState() });
  assert.equal(app.h.mo(), '2026-11');
});

test('Monatsgrenze: Verlaufspunkt (snap) wird dem Ortsmonat zugeordnet', () => {
  const state = emptyState();
  state.as = [{ id: 'a1', n: 'Tagesgeld', k: 'cash', q: 1, p: 1000, c: 1000, l: [{ d: '2026-01-01', q: 1, p: 1000, f: 0 }] }];
  const app = loadApp({ ...BERLIN, now: '2026-10-31T23:30:00Z', fixture: state });
  app.render();
  assert.ok(app.h.S().hist.some(x => x.m === '2026-11'), 'Eintrag für 2026-11 vorhanden');
  assert.ok(!app.h.S().hist.some(x => x.m === '2026-10'), 'kein Eintrag für den Vormonat');
});

test('Jahreswechsel: 1. Januar 00:30 Ortszeit gehört zum neuen Jahr', () => {
  const state = emptyState();
  state.as = [{ id: 'a1', n: 'Tagesgeld', k: 'cash', q: 1, p: 1000, c: 1000, l: [{ d: '2026-01-01', q: 1, p: 1000, f: 0 }] }];
  const app = loadApp({ ...BERLIN, now: '2026-12-31T23:30:00Z', fixture: state });
  app.render();
  assert.equal(app.h.mo(), '2027-01');
  assert.ok(app.h.S().hist.some(x => x.m === '2027-01'));
});

test('Winterzeit (Umstellung am 25.10.2026): am 26.10. 00:30 CET ist das Buchungsdatum der 26.10., nicht der 25.10.', () => {
  const app = loadApp({ ...BERLIN, now: '2026-10-25T23:30:00Z', fixture: emptyState() });
  app.h.setMo('2026-10');
  app.h.setTab('cash');
  app.render();
  // Standard-Buchungsdatum im Cashflow-Formular (heutiges Datum, wenn der Monat der aktuelle ist)
  const m = app.view().match(/id="td"[^>]*value="([^"]*)"/);
  assert.equal(m && m[1], '2026-10-26');
});

test('Sommerzeit-Umstellung (29.03.2026, 00:30 CET): Buchungsdatum ist der 29.03.', () => {
  const app = loadApp({ ...BERLIN, now: '2026-03-28T23:30:00Z', fixture: emptyState() });
  app.h.setMo('2026-03');
  app.h.setTab('cash');
  app.render();
  const m = app.view().match(/id="td"[^>]*value="([^"]*)"/);
  assert.equal(m && m[1], '2026-03-29');
});

test('Verkauf ohne Datum wird mit dem heutigen Ortsdatum gebucht (nicht UTC)', () => {
  const state = emptyState();
  state.as = [{ id: 'k1', n: 'Coin', k: 'crypto', q: 2, p: 100, c: 100, l: [{ d: '2025-01-01', q: 2, p: 50, f: 0 }] }];
  const app = loadApp({ ...BERLIN, now: '2026-10-31T23:30:00Z', fixture: state });
  app.h.setTrd({ id: 'k1', m: 's' });
  app.h.setTab('assets');
  app.render();
  app.doc.getElementById('tq').value = '1';
  app.doc.getElementById('tp2').value = '100';
  app.doc.getElementById('tf2').value = '0';
  app.doc.getElementById('td2').value = '';
  app.ctx.doTr();
  const sale = app.h.S().sales[0];
  assert.ok(sale, 'Verkauf gebucht');
  assert.equal(sale.d, '2026-11-01');
});

test('Wiederkehrende Buchung am 1. um 00:30 Ortszeit landet im richtigen Monat', () => {
  const state = emptyState();
  state.rec = [{ id: 'r1', c: 'Wohnen', a: 900, n: 'Miete', e: false }];
  const app = loadApp({ ...BERLIN, now: '2026-10-31T23:30:00Z', fixture: state });
  app.render();
  const booked = app.h.S().tx.filter(x => x.r === 'r1');
  assert.equal(booked.length, 1);
  assert.equal(booked[0].d, '2026-11-01');
  assert.equal(app.h.S().recDone, '2026-11');
});

test('Sicherung wird pro Ortstag rotiert: zwei Sicherungen am selben Ortstag ergeben eine', () => {
  const state = emptyState();
  state.tx = [{ id: 't1', d: '2026-10-01', c: 'Gehalt', a: 1000, n: 'x', r: null }];
  const app = loadApp({ ...BERLIN, now: '2026-10-31T23:30:00Z', fixture: state });
  app.render();
  app.doc.hidden = true;
  app.doc.listeners.visibilitychange.forEach(fn => fn());
  app.setNow('2026-11-01T06:00:00Z'); // 07:00 Ortszeit, gleicher Ortstag (1. November)
  app.doc.listeners.visibilitychange.forEach(fn => fn());
  const list = JSON.parse(app.storage.getItem('fr_bk') || '[]');
  assert.equal(list.length, 1, 'eine Sicherung je Ortstag');
});
