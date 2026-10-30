const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

// 4.4: Historie ohne doppelte Monate, Bearbeiten ohne Datenschäden.
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

test('Historie: zwei Einträge für einen Monat werden einmal angezeigt (der zuletzt gesetzte gewinnt)', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: fixture('edge.json') });
  app.h.setTab('home');
  app.h.setS({ ...app.h.S(), ui: { c: {}, o: {}, hf: true } });
  const html = app.render();
  const rows = [...html.matchAll(/<span>2026-01<\/span><span>([^<]*)/g)].map(m => m[1]);
  assert.equal(rows.length, 1, 'ein Eintrag für 2026-01');
  assert.match(rows[0], /^1\.100 €/);
});

test('Historie: Verlaufspunkt des laufenden Monats aktualisiert den angezeigten Eintrag, nicht einen verdeckten Duplikat', () => {
  const state = fixture('small.json');
  state.as = [{ id: 'a1', n: 'Tagesgeld', k: 'cash', q: 1, p: 1000, c: 1000, l: [{ d: '2026-01-01', q: 1, p: 1000, f: 0 }] }];
  state.debts = [];
  state.hist = [{ id: 'x1', m: '2026-10', nw: 1 }, { id: 'x2', m: '2026-10', nw: 2 }];
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  app.render();
  const entries = app.h.S().hist.filter(x => x.m === '2026-10');
  assert.equal(entries.length, 2);
  assert.equal(entries[1].nw, 1000, 'der angezeigte Eintrag (zuletzt) wird aktualisiert');
});

test('Bearbeiten einer Buchung ohne Datum behält das bisherige Datum', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: fixture('small.json') });
  app.h.setEd({ k: 'tx', id: 'f2' });
  app.h.setMo('2026-07');   // Inline-Bearbeitung: die Buchung muss im angezeigten Monat stehen
  app.h.setTab('cash');
  app.render();
  app.doc.getElementById('ef0').value = 'Wohnen';
  app.doc.getElementById('ef1').value = '900';
  app.doc.getElementById('ef2').value = '';   // Datumsfeld geleert
  app.doc.getElementById('ef3').value = 'Miete';
  app.ctx.edSave();
  const f2 = app.h.S().tx.find(x => x.id === 'f2');
  assert.equal(f2.d, '2026-07-03', 'Datum unverändert');
});

test('Bearbeiten eines Historie-Eintrags mit ungültigem Monat ändert den Monat nicht', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: fixture('small.json') });
  app.h.setEd({ k: 'hist', id: 'h2' });
  app.h.setS({ ...app.h.S(), ui: { c: {}, o: {}, hf: true } });   // Verlauf steht unter „Alle Details anzeigen“
  app.h.setTab('home');
  app.render();
  app.doc.getElementById('ef0').value = 'August';
  app.doc.getElementById('ef1').value = '9600';
  app.ctx.edSave();
  const h2 = app.h.S().hist.find(x => x.id === 'h2');
  assert.equal(h2.m, '2026-08', 'Monat unverändert');
  assert.equal(h2.nw, 9600);
});
