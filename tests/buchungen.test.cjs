const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// 4.3: Wiederkehrende Buchungen (idempotent, Tag 1, Jahreswechsel) und "Monat übernehmen" (Tag 29 bis 31).
const base = (extra = {}) => ({ tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 }, ...extra });
// Array.from: Arrays aus dem vm-Kontext in Node-Arrays umwandeln (sonst schlägt deepEqual am Prototyp fehl)
const DAYS = s => Array.from(s.tx.map(x => x.d).sort());

test('"Monat übernehmen": 31. Januar wird im Februar auf den 28. gesetzt, nicht als 31.02. gespeichert', () => {
  const state = base({ tx: [{ id: 'j1', d: '2026-01-31', c: 'Wohnen', a: 900, n: 'Miete', r: null }] });
  const app = loadApp({ now: '2026-02-10T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  app.h.setMo('2026-02');
  app.ctx.copyMo();
  const feb = app.h.S().tx.filter(x => x.d.startsWith('2026-02'));
  assert.equal(feb.length, 1);
  assert.equal(feb[0].d, '2026-02-28');
});

test('"Monat übernehmen": 31. März wird im April auf den 30. gesetzt, im Schaltjahr 2028 der 29. Februar', () => {
  const app1 = loadApp({ now: '2026-04-10T10:00:00Z', tz: 'Europe/Berlin', fixture: base({ tx: [{ id: 'm1', d: '2026-03-31', c: 'Wohnen', a: 1, n: 'a', r: null }] }) });
  app1.h.setMo('2026-04'); app1.ctx.copyMo();
  assert.equal(app1.h.S().tx.find(x => x.d.startsWith('2026-04')).d, '2026-04-30');
  const app2 = loadApp({ now: '2028-02-10T10:00:00Z', tz: 'Europe/Berlin', fixture: base({ tx: [{ id: 'j2', d: '2028-01-31', c: 'Wohnen', a: 1, n: 'b', r: null }] }) });
  app2.h.setMo('2028-02'); app2.ctx.copyMo();
  assert.equal(app2.h.S().tx.find(x => x.d.startsWith('2028-02')).d, '2028-02-29');
});

test('Wiederkehrende Buchung wird am ersten Tag des Monats angelegt, auch in kurzen Monaten (Tag 29 bis 31 der Vorlage)', () => {
  const state = base({ rec: [{ id: 'r1', c: 'Wohnen', a: 900, n: 'Miete', e: false }] });
  const app = loadApp({ now: '2027-02-15T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  assert.deepEqual(DAYS(app.h.S()), ['2027-02-01']);
});

test('Wiederkehrende Buchung: mehrfacher Start am selben Tag erzeugt keine Dubletten', () => {
  const state = base({ rec: [{ id: 'r1', c: 'Wohnen', a: 900, n: 'Miete', e: false }] });
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  app.render(); app.render(); app.render();
  app.ctx.applyRec(); app.ctx.applyRec();
  assert.equal(app.h.S().tx.filter(x => x.r === 'r1').length, 1);
  assert.equal(app.h.S().recDone, '2026-10');
});

test('Wiederkehrende Buchung: Jahreswechsel bucht im neuen Jahr genau einmal nach', () => {
  const state = base({ rec: [{ id: 'r1', c: 'Wohnen', a: 900, n: 'Miete', e: false }] });
  const app = loadApp({ now: '2026-12-31T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  app.setNow('2027-01-01T10:00:00Z');
  app.render(); app.render();
  assert.deepEqual(DAYS(app.h.S()), ['2026-12-01', '2027-01-01']);
});

test('Wiederkehrende Buchung: nach einer Pause wird nur der aktuelle Monat automatisch gebucht; frühere Monate per "Recurring anwenden"', () => {
  // Vorlage seit August, App seit Ende August nicht geöffnet. Verhalten laut Code: nur der aktuelle Monat.
  const state = base({ rec: [{ id: 'r1', c: 'Wohnen', a: 900, n: 'Miete', e: false }], recDone: '2026-08' });
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  assert.deepEqual(DAYS(app.h.S()), ['2026-10-01']);
  app.h.setMo('2026-09');
  app.ctx.applyRec();
  assert.deepEqual(DAYS(app.h.S()), ['2026-09-01', '2026-10-01']);
});
