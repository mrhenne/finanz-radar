const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// 4.5: Kauf/Verkauf (FIFO, Gebühren, Teilverkauf, Überverkauf), Steuerlogik der Verkäufe.
const NOW = '2026-10-26T10:00:00Z';
const base = (as) => ({ tx: [], as, goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });
const coin = () => ({ id: 'k1', n: 'Coin', k: 'crypto', q: 5, p: 250, c: 800, l: [
  { d: '2026-01-01', q: 2, p: 100, f: 0 },   // kurz gehalten (unter 1 Jahr)
  { d: '2024-01-01', q: 3, p: 200, f: 0 },   // lang gehalten (über 1 Jahr)
] });

function sell(app, id, { q, p, f = 0, d = '' }) {
  app.h.setTrd({ id, m: 's' });
  app.h.setTab('assets');
  app.render();
  app.doc.getElementById('tq').value = String(q);
  app.doc.getElementById('tp2').value = String(p);
  app.doc.getElementById('tf2').value = String(f);
  app.doc.getElementById('td2').value = d;
  app.ctx.doTr();
}

test('FIFO mit Gebühren: 4 Einheiten zu 300 € (Gebühr 10 €) aus den ältesten Lots', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([coin()]) });
  sell(app, 'k1', { q: 4, p: 300, f: 10 });
  const s = app.h.S();
  assert.equal(s.sales.length, 1);
  assert.equal(s.sales[0].g, 590, 'Gesamtgewinn: 1.200 − 10 − 600');
  assert.equal(s.sales[0].gp, 395, 'kurz gehaltene Lots (Haltefrist) als Spekulationsgewinn');
  assert.equal(s.sales[0].gc, 0);
  const pos = s.as[0];
  assert.equal(pos.q, 1, 'Rest: 1 Einheit');
  assert.equal(pos.l.length, 1);
  assert.equal(pos.l[0].p, 200, 'verbleibendes Lot behält seinen Einstand');
  assert.equal(pos.c, 200, 'Einstand des Rests');
});

test('Verkauf über den Bestand hinaus wird abgelehnt und verändert nichts', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([coin()]) });
  sell(app, 'k1', { q: 6, p: 300 });
  assert.ok(app.alerts.some(a => a.includes('Mehr als vorhanden')));
  assert.equal(app.h.S().sales.length, 0);
  assert.equal(app.h.S().as[0].q, 5);
});

test('ETF-Verkauf: Gewinn wird mit 70 % (Teilfreistellung 30 %) angesetzt', () => {
  const etf = { id: 'e1', n: 'ETF', k: 'etf', q: 10, p: 50, c: 450, l: [{ d: '2025-06-01', q: 10, p: 45, f: 0 }] };
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([etf]) });
  sell(app, 'e1', { q: 4, p: 60, f: 0 });
  const sale = app.h.S().sales[0];
  assert.equal(sale.g, 60, 'Gewinn 4 × (60 − 45)');
  assert.ok(Math.abs(sale.gc - 42) < 1e-9, 'steuerpflichtig 70 % von 60');
});

test('Krypto-Freigrenze 1.000 €: unter 1.000 € steuerfrei, darüber 30 % vom gesamten Spekulationsgewinn', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([coin()]) });
  sell(app, 'k1', { q: 4, p: 300, f: 10 });
  assert.match(app.viewOf('tax'), /unter Freigrenze 1\.000 €, steuerfrei/);
  // Zweiter Verkauf mit kurz gehaltenem Lot bringt den Jahressumme über 1.000 €
  const big = { id: 'k2', n: 'Coin2', k: 'crypto', q: 10, p: 500, c: 1000, l: [{ d: '2026-02-01', q: 10, p: 100, f: 0 }] };
  const app2 = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([big]) });
  sell(app2, 'k2', { q: 10, p: 200, f: 0 });
  // Gewinn 10 × (200 − 100) = 1.000 €; Freigrenze: 1.000 € ist nicht über, also steuerfrei
  assert.match(app2.viewOf('tax'), /steuerfrei/);
  const big2 = { id: 'k3', n: 'Coin3', k: 'crypto', q: 10, p: 500, c: 1000, l: [{ d: '2026-02-01', q: 10, p: 100, f: 0 }] };
  const app3 = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([big2]) });
  sell(app3, 'k3', { q: 10, p: 210, f: 0 });
  assert.equal(app3.h.S().sales[0].gp, 1100);
  assert.match(app3.viewOf('tax'), /Steuer ca\. 330 €/, '30 % von 1.100 €');
});

test('Haltefrist: Lot genau ein Jahr alt ist noch steuerpflichtig, 366 Tage alt ist steuerfrei', () => {
  const lot = d => ({ id: 'k9', n: 'C', k: 'crypto', q: 1, p: 200, c: 100, l: [{ d, q: 1, p: 100, f: 0 }] });
  const a1 = loadApp({ now: '2026-11-01T10:00:00Z', tz: 'Europe/Berlin', fixture: base([lot('2025-11-01')]) });
  a1.h.setTab('assets'); const v1 = a1.render();
  assert.ok(v1.includes('in Haltefrist bis'), 'Kauf 1.11.2025, heute 1.11.2026: noch Haltefrist');
  const a2 = loadApp({ now: '2026-11-02T10:00:00Z', tz: 'Europe/Berlin', fixture: base([lot('2025-11-01')]) });
  a2.h.setTab('assets'); const v2 = a2.render();
  assert.ok(v2.includes('steuerfrei (&gt;1 J.)') || v2.includes('steuerfrei (>1 J.)'), 'nach mehr als einem Jahr steuerfrei');
});

test('Durchschnittskaufpreis: 2 × 100 € und 3 × 200 € ergeben Ø 160 €', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([coin()]) });
  app.h.setTab('crypto');
  const html = app.render();
  assert.ok(html.includes('Ø 160 €'), 'Ø Kauf im Krypto-Tab');
});

test('Positionen ohne Einstand (c = 0): kein Gewinn angezeigt, keine NaN', () => {
  const x = { id: 'k5', n: 'Ohne', k: 'crypto', q: 2, p: 100, c: 0, l: [{ d: '', q: 2, p: 0, f: 0 }] };
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([x]) });
  app.h.setTab('crypto');
  const html = app.render();
  assert.ok(!/NaN|Infinity/.test(html));
});

test('Haltefrist Schaltjahr: Kauf 1.3.2027, Verkauf 1.3.2028 ist noch steuerpflichtig, 2.3.2028 steuerfrei', () => {
  const lot = { id: 'k7', n: 'C', k: 'crypto', q: 1, p: 200, c: 100, l: [{ d: '2027-03-01', q: 1, p: 100, f: 0 }] };
  const a = loadApp({ now: '2028-03-01T10:00:00Z', tz: 'Europe/Berlin', fixture: base([lot]) });
  sell(a, 'k7', { q: 1, p: 200, f: 0, d: '2028-03-01' });
  assert.equal(a.h.S().sales[0].gp, 100, 'am Jahrestag noch Spekulationsgewinn');
  const b = loadApp({ now: '2028-03-02T10:00:00Z', tz: 'Europe/Berlin', fixture: base([{ ...lot, l: [{ d: '2027-03-01', q: 1, p: 100, f: 0 }] }]) });
  sell(b, 'k7', { q: 1, p: 200, f: 0, d: '2028-03-02' });
  assert.equal(b.h.S().sales[0].gp, 0, 'einen Tag später steuerfrei');
});

test('Haltefrist-Anzeige nennt das späteste Ende der Haltefrist über alle Lots (zwei Lots, Ende 1.6.2026)', () => {
  const x = { id: 'k8', n: 'C', k: 'crypto', q: 2, p: 200, c: 200, l: [
    { d: '2025-03-01', q: 1, p: 100, f: 0 }, { d: '2025-06-01', q: 1, p: 100, f: 0 }] };
  const a = loadApp({ now: '2026-02-01T10:00:00Z', tz: 'Europe/Berlin', fixture: base([x]) });
  a.h.setTab('assets');
  const html = a.render();
  assert.ok(html.includes('2 Einh. in Haltefrist bis 1.6.2026'), 'spätestes Ende der Haltefrist');
});
