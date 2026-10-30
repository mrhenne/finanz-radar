const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// Phase 1A (Endurance-Stil): Kauf-Lots bleiben beim Bearbeiten erhalten, Bearbeiten direkt in der Zeile,
// Umfang „Nur aktueller Wert“ (m: 'e') für Positionen ohne Einstand. Erfundene Beispielwerte.
const BASIS = { tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } };
const app = (as, opts = {}) => loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: { ...BASIS, as }, ...opts });
const kopie = x => JSON.parse(JSON.stringify(x));
const mehrereKaeufe = () => [{ id: 'p1', n: 'MSCI World', k: 'etf', q: 15, p: 60, c: 805, l: [{ d: '2025-03-01', q: 10, p: 50, f: 5 }, { d: '2025-09-01', q: 5, p: 60, f: 0 }] }];

// A: Lot-Erhalt
test('Lots: mehrere Käufe bleiben beim Bearbeiten unverändert, nur Name und Kurs werden gespeichert', () => {
  const a = app(mehrereKaeufe());
  const vorher = kopie(a.h.S().as[0]);
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'p1' }); a.render();
  a.el('ef0').value = 'MSCI World Neu'; a.el('ef2').value = '70';
  a.evalApp('edSave()');
  const p = a.h.S().as[0];
  assert.deepEqual(kopie(p.l), vorher.l, 'Kauf-Lots unverändert (Datum, Menge, Kurs, Gebühren)');
  assert.equal(p.c, 805, 'Einstand unverändert');
  assert.equal(p.q, 15, 'Menge unverändert');
  assert.equal(p.n, 'MSCI World Neu');
  assert.equal(p.p, 70, 'aktueller Kurs gespeichert');
});

test('Lots: ein Kauf mit Gebühren gilt als mehrere Käufe, Gebühr bleibt erhalten', () => {
  const a = app([{ id: 'p2', n: 'Gold', k: 'gold', q: 10, p: 80, c: 505, l: [{ d: '2025-03-01', q: 10, p: 50, f: 5 }] }]);
  const vorher = kopie(a.h.S().as[0]);
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'p2' }); a.render();
  a.el('ef2').value = '90';
  a.evalApp('edSave()');
  const p = a.h.S().as[0];
  assert.deepEqual(kopie(p.l), vorher.l, 'Gebühr f=5 bleibt im Lot');
  assert.equal(p.c, 505);
  assert.equal(p.p, 90);
});

test('Lots: genau ein Kauf ohne Gebühr: bisheriges Verhalten (Lot mit Datum, Einstand aus Eingabe)', () => {
  const a = app([{ id: 's1', n: 'Aktie X', k: 'aktie', q: 4, p: 30, c: 160, l: [{ d: '2024-05-02', q: 4, p: 40, f: 0 }] }]);
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 's1' }); a.render();
  a.el('ef1').value = '5'; a.el('ef3').value = '225';
  a.evalApp('edSave()');
  const p = a.h.S().as[0];
  assert.deepEqual(kopie(p.l), [{ d: '2024-05-02', q: 5, p: 45, f: 0 }], 'Lot übernimmt Datum, neue Menge und Einstand je Einheit');
  assert.equal(p.c, 225);
  assert.equal(p.q, 5);
});

// Inline-Bearbeitung
test('Inline: Felder erscheinen in der Zeile der Position, das Formular oben ist weg', () => {
  const a = app(mehrereKaeufe());
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'p1' });
  const html = a.render();
  assert.ok(html.includes('id="edrow"'), 'Editor in der Zeile');
  assert.ok(html.includes('id="ef0"') && html.includes('id="ef2"'), 'Eingabefelder vorhanden');
  assert.ok(!html.includes('[Bearbeiten]'), 'kein Formular oben');
});

test('Inline: eingegebene Werte bleiben bei einem Zwischen-Render erhalten', () => {
  const a = app(mehrereKaeufe());
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'p1' }); a.render();
  a.el('ef0').value = 'Zwischenstand';
  a.render();
  assert.equal(a.el('ef0').value, 'Zwischenstand');
});

test('Inline: Buchung im Cashflow wird in der Liste bearbeitet', () => {
  const a = app([], { fixture: { ...BASIS, as: [], tx: [{ id: 'f2', d: '2026-07-03', c: 'Wohnen', a: 900, n: 'Miete', r: null }] } });
  a.h.setMo('2026-07'); a.h.setTab('cash'); a.h.setEd({ k: 'tx', id: 'f2' });
  const html = a.render();
  assert.ok(html.includes('id="edrow"') && html.includes('id="ef3"'), 'Buchung bearbeitbar');
});

test('Umfang: Wechsel auf „Nur aktueller Wert“ fragt nach und entfernt beim Speichern Einstand und Lots', () => {
  const a = app(mehrereKaeufe());
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'p1' }); a.render();
  a.evalApp("edMode('e')");
  assert.equal(a.confirms.length, 1, 'confirm() vor dem Verwerfen');
  assert.equal(a.h.ed().m, 'e');
  const html = a.render();
  assert.ok(!html.includes('id="ef1"'), 'Menge im Nur-Wert-Modus ausgeblendet');
  assert.ok(html.includes('id="ef2"'), 'Gesamtwert-Feld da');
  a.evalApp('edSave()');
  const p = a.h.S().as[0];
  assert.equal(p.m, 'e');
  assert.equal(p.q, 1);
  assert.equal(p.p, 900, 'Gesamtwert = Menge × Kurs vor dem Wechsel');
  assert.ok(!('c' in p) && !('l' in p), 'Einstand und Lots entfernt');
});

test('Umfang: ohne Bestätigung bleibt alles beim Alten', () => {
  const a = app(mehrereKaeufe(), { confirm: false });
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'p1' }); a.render();
  a.evalApp("edMode('e')");
  assert.equal(a.h.ed().m, undefined, 'Modus unverändert');
  a.evalApp('edSave()');
  const p = a.h.S().as[0];
  assert.equal(p.c, 805);
  assert.equal(p.m, undefined);
});

// Modus „Nur aktueller Wert“
const EINFACH = () => [{ id: 'e1', n: 'Fonds', k: 'etf', m: 'e', q: 1, p: 10000 }];

test('Nur aktueller Wert: Position zählt im Net Worth mit ihrem Gesamtwert', () => {
  const a = app(EINFACH());
  assert.equal(a.evalApp('nw()'), 10000);
});

test('Nur aktueller Wert: Anzeige ohne Kauf- und Verkaufsschaltflächen, mit Hinweis', () => {
  const a = app(EINFACH());
  a.h.setTab('assets');
  const html = a.render();
  assert.ok(html.includes('Nur aktueller Wert'));
  assert.ok(!html.includes('trdStart'), 'kein Nachkauf/Verkauf im Nur-Wert-Modus');
  assert.ok(html.includes('G/V und Rendite: – (kein Einstand erfasst)'));
});

test('Steuer: Position ohne Einstand fließt nicht als Gewinn in die Schätzung, kein NaN', () => {
  const a = app(EINFACH());
  a.h.setTab('tax');
  const html = a.render();
  assert.ok(!html.includes('NaN'));
  assert.match(html, /ETF\/Aktien \(nach Teilfreistell\.\)<\/span><b>0 €<\/b>/, 'Schätzung der ETF/Aktien = 0');
  assert.match(html, /Steuer bei Verkauf heute \(ETF\/Aktien\)<\/span><b>0 €<\/b>/, 'Steuer = 0');
  assert.ok(html.includes('1 Position(en) ohne Einstand'), 'Hinweis „kein Einstand erfasst“');
});

test('Steuer: Einstand 0 wie fehlender Einstand behandelt', () => {
  const a = app([{ id: 'n1', n: 'Geschenkte Aktie', k: 'aktie', q: 100, p: 50, c: 0, l: [{ d: '2024-01-02', q: 100, p: 0, f: 0 }] }]);
  a.h.setTab('tax');
  const html = a.render();
  assert.ok(!html.includes('NaN'));
  assert.match(html, /ETF\/Aktien \(nach Teilfreistell\.\)<\/span><b>0 €<\/b>/);
});

test('Nur aktueller Wert: Neuanlage speichert ohne Einstand und Lots', () => {
  const a = app([]);
  a.h.setTab('assets'); a.render();
  a.doc.getElementById('am').value = 'e';
  a.evalApp("setAm('e')");
  a.doc.getElementById('an').value = 'Tagesgeld Test';
  a.doc.getElementById('ak').value = 'cash';
  a.doc.getElementById('ap').value = '2500';
  a.evalApp('addAs()');
  const neu = a.h.S().as[a.h.S().as.length - 1];
  assert.equal(neu.m, 'e');
  assert.equal(neu.q, 1);
  assert.equal(neu.p, 2500);
  assert.ok(!('c' in neu) && !('l' in neu));
  assert.equal(a.evalApp('nw()'), 2500);
});

test('Neuanlage im Modus „Mit Einkaufswerten“ bleibt wie bisher', () => {
  const a = app([]);
  a.h.setTab('assets'); a.render();
  a.doc.getElementById('am').value = 'd';
  a.doc.getElementById('an').value = 'Test ETF';
  a.doc.getElementById('ak').value = 'etf';
  a.doc.getElementById('aq').value = '2';
  a.doc.getElementById('ap').value = '100';
  a.doc.getElementById('ab').value = '80';
  a.doc.getElementById('af').value = '1';
  a.doc.getElementById('ad').value = '2026-01-05';
  a.evalApp('addAs()');
  const neu = a.h.S().as[a.h.S().as.length - 1];
  assert.equal(neu.q, 2);
  assert.equal(neu.p, 100);
  assert.equal(neu.c, 161, 'Menge × Einstand + Gebühr');
  assert.deepEqual(kopie(neu.l), [{ d: '2026-01-05', q: 2, p: 80, f: 1 }]);
  assert.ok(!('m' in neu), 'detailliert ohne Kennzeichen');
});

test('Import: Modus bleibt erhalten, unbekannte Werte fallen auf detailliert zurück', () => {
  const a = app([]);
  const raw = { as: [{ id: 'x1', n: 'A', k: 'etf', q: 1, p: 500, m: 'e', l: [{ d: '', q: 1, p: 1, f: 0 }] }, { id: 'x2', n: 'B', k: 'etf', q: 2, p: 10, c: 15, m: 'x' }] };
  const out = a.evalApp(`normalizeImportedState(${JSON.stringify(raw)})`);
  assert.equal(out.as[0].m, 'e');
  assert.ok(!('l' in out.as[0]), 'Nur-Wert ohne Lots');
  assert.equal(out.as[1].m, undefined);
  assert.equal(out.as[1].c, 15);
});

test('Krypto: ohne Einstand „–“ bei Investiert und G/V', () => {
  const a = app([{ id: 'k1', n: 'Bitcoin', k: 'crypto', m: 'e', q: 1, p: 1000, cg: 'bitcoin' }]);
  a.h.setTab('crypto');
  const html = a.render();
  assert.ok(html.includes('<b>–</b><span>Investiert</span>'));
  assert.ok(!html.includes('NaN'));
});

test('Krypto: Live-Kurse überschreiben Positionen im Nur-Wert-Modus nicht, detaillierte schon', async () => {
  const liste = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', current_price: 99999 },
    { id: 'ethereum', name: 'Ethereum', symbol: 'eth', current_price: 3000 },
  ];
  const a = app([
    { id: 'k1', n: 'Bitcoin', k: 'crypto', m: 'e', q: 1, p: 1000, cg: 'bitcoin' },
    { id: 'k2', n: 'Ethereum', k: 'crypto', q: 0.5, p: 2000, c: 800, cg: 'ethereum', l: [{ d: '2024-01-01', q: 0.5, p: 1600, f: 0 }] },
  ], { fetch: async url => url.includes('simple/price')
    ? { ok: true, status: 200, json: async () => ({ ethereum: { eur: 3000 } }) }
    : { ok: true, status: 200, json: async () => liste } });
  await a.evalApp('liveFetch()');
  const [k1, k2] = a.h.S().as;
  assert.equal(k1.p, 1000, 'Nur-Wert-Gesamtwert unverändert');
  assert.equal(k2.p, 3000, 'detaillierte Position bekommt den Live-Kurs');
});

test('Umfang: Nur-Wert zurück auf „Mit Einkaufswerten“ zeigt Menge, Kurs und Einstand, Speichern setzt Einstand', () => {
  const a = app(EINFACH());
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'e1' }); a.render();
  a.evalApp("edMode('d')");
  assert.equal(a.confirms.length, 0, 'Wechsel zu „detailliert“ verwirft nichts, daher keine Rückfrage');
  const html = a.render();
  assert.ok(html.includes('id="ef1"') && html.includes('id="ef3"'), 'Menge und Einstand sichtbar');
  a.doc.getElementById('ef1').value = '4';
  a.doc.getElementById('ef2').value = '250';
  a.doc.getElementById('ef3').value = '800';
  a.evalApp('edSave()');
  const p = a.h.S().as[0];
  assert.equal(p.m, 'd');
  assert.equal(p.q, 4);
  assert.equal(p.p, 250);
  assert.equal(p.c, 800);
  assert.deepEqual(kopie(p.l), [{ d: '', q: 4, p: 200, f: 0 }]);
  assert.equal(a.evalApp('nw()'), 1000, 'Gesamtwert = Menge × Kurs');
});

test('Mehrere Käufe: im Bearbeiten nur Name und Kurs sichtbar, Menge und Einstand ausgeblendet', () => {
  const a = app(mehrereKaeufe());
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'p1' });
  const html = a.render();
  assert.ok(!html.includes('id="ef1"') && !html.includes('id="ef3"'), 'Menge und Einstand ausgeblendet');
  assert.ok(html.includes('id="ef0"') && html.includes('id="ef2"'));
  assert.ok(html.includes('Kauf-Lots'), 'Hinweis auf die Käufe');
});
