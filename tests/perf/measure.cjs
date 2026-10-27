#!/usr/bin/env node
'use strict';
// Messskript für Phase 5 (Abschnitt 6.1): Laufzeiten und DOM-Zähler mit der Extrem-Fixture
// (5.000 Buchungen, 20 Krypto-Positionen, 144 Historienpunkte, erfundene Werte).
// Läuft in Node mit dem DOM-Stub aus tests/harness. Die Zeiten sind Vergleichswerte vor und nach
// Änderungen, keine Browser-Zeiten. Blur (blurNums, blurHtml) braucht einen echten DOM-Baum und
// wird deshalb im Browser gemessen (siehe ENDKONTROLLE-BERICHT.md, Abschnitt 11).
// Aufruf: node tests/perf/measure.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadApp, StubEl } = require('../harness/load-app.cjs');
const { makeExtreme } = require('../fixtures/extreme.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNS = 5;
const NOW = '2026-10-26T10:00:00Z', TZ = 'Europe/Berlin';

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ms = fn => { const t = performance.now(); fn(); return performance.now() - t; };
// Ein Aufruf als Aufwärmlauf, danach RUNS gemessene Läufe; Rückgabe: Median in ms
const medianMs = fn => { fn(); return median(Array.from({ length: RUNS }, () => ms(fn))); };

// Zähler für Listener-Registrierungen und querySelectorAll (Stub-Klassen und das Dokument)
const counts = { el: 0, doc: 0, qsa: 0 };
const origAdd = StubEl.prototype.addEventListener, origQsa = StubEl.prototype.querySelectorAll;
StubEl.prototype.addEventListener = function (...a) { counts.el++; return origAdd.apply(this, a); };
StubEl.prototype.querySelectorAll = function (...a) { counts.qsa++; return origQsa.apply(this, a); };
const count = fn => {
  counts.el = counts.doc = counts.qsa = 0;
  fn();
  return { listeners: counts.el + counts.doc, qsa: counts.qsa };
};
const docListeners = doc => Object.values(doc.listeners).reduce((n, a) => n + a.length, 0);
const domStats = html => ({ nodes: (html.match(/<[a-zA-Z]/g) || []).length, handlers: (html.match(/\son[a-z]+="/g) || []).length });

const fixture = makeExtreme();
const fixtureBytes = Buffer.byteLength(JSON.stringify(fixture), 'utf8');
const result = {};

// Start: Laden der fünf Skripte, inkl. erstem Render (render() am Ende von app.js)
result.startMs = medianMs(() => loadApp({ now: NOW, tz: TZ, fixture: makeExtreme() }));
const app = loadApp({ now: NOW, tz: TZ, fixture });
// Zähler auch für das Dokument (document.addEventListener, document.querySelectorAll)
const docAdd = app.doc.addEventListener, docQsa = app.doc.querySelectorAll;
app.doc.addEventListener = function (...a) { counts.doc++; return docAdd.apply(this, a); };
app.doc.querySelectorAll = function (...a) { counts.qsa++; return docQsa.apply(this, a); };
result.frsBytes = Buffer.byteLength(app.storage.getItem('fr_s'), 'utf8');
result.fixtureBytes = fixtureBytes;

// Ansichten: Render-Zeit, DOM-Knoten (Näherung über Tags), Inline-Handler, Listener-Aufrufe je Render
const views = [...new Set([...app.h.TABS().map(t => t[0]), ...app.h.SUB()])];
result.views = views.map(v => {
  app.h.setTab(v);
  app.render();
  const c = count(() => app.render());
  const row = { view: v, ms: medianMs(() => app.render()), listeners: c.listeners, qsa: c.qsa };
  return Object.assign(row, domStats(app.el('v').innerHTML));
});

// Buchung anlegen bis Anzeige (addTx speichert und rendert)
app.h.setTab('cash');
app.render();
// Felder vor jedem Lauf setzen: render() baut das Formular neu auf
const fillForm = () => {
  Object.assign(app.el('ta'), { value: '12,34' });
  Object.assign(app.el('tc'), { value: 'Lebensmittel' });
  Object.assign(app.el('tn'), { value: 'Messbuchung' });
  Object.assign(app.el('td'), { value: '2026-10-26' });
};
result.addTxMs = medianMs(() => { fillForm(); app.evalApp('addTx()'); });
result.localSaveMs = medianMs(() => app.evalApp('localSave()'));

// Sankey für den Monat 2026-10 (Eingabe: Buchungen als { c, a })
app.ctx.__flows = app.h.S().tx.filter(x => x.d.startsWith('2026-10')).map(x => ({ c: x.c, a: x.a }));
result.sankeyMs = medianMs(() => app.evalApp('sankey(__flows)'));

// Prognose-Ansicht (prHTML mit allen Szenarien, enthält prSim)
result.planMs = medianMs(() => app.viewOf('plan'));

// CSV-Import: Parser und Vorschau aus extras.js (gleicher Ausschnitt wie in tests/csv-import.test.cjs)
const extras = fs.readFileSync(path.join(ROOT, 'extras.js'), 'utf8');
const impStart = extras.indexOf('const IMP = { rows: []'), impEnd = extras.indexOf('W.impUndo = ');
const csvCtx = { S: { tx: [] }, IN: ['Gehalt', 'Nebenjob', 'Sonstige Einnahmen'], suggestCat: () => '', clean: s => String(s || '').replace(/[<>&"]/g, ''), pad: n => String(n).padStart(2, '0'), W: {}, TextDecoder, Math, Date };
vm.runInNewContext(extras.slice(impStart, impEnd) + '\nthis.api={importText};', csvCtx, { timeout: 60000 });
const csvText = n => ['Datum;Betrag;Text', ...Array.from({ length: n }, (_, i) => `01.01.2026;-1,00;Zeile ${i}`)].join('\n');
const csv1500 = csvText(1500), csv5000 = csvText(5000);
result.csv1500Ms = medianMs(() => csvCtx.api.importText(csv1500));
result.csv5000Ms = medianMs(() => csvCtx.api.importText(csv5000));

// pointermove: Zahl der querySelectorAll-Aufrufe je Ereignis (ohne Treffer auf ein Diagramm)
const fakeEvt = { target: { closest: () => null }, clientX: 0, clientY: 0, preventDefault() {} };
const moveHandlers = () => app.doc.listeners.pointermove || [];
app.h.setTab('home');
app.render();
result.qsaPerMove = count(() => moveHandlers().forEach(h => h(fakeEvt))).qsa;
result.move1000Ms = medianMs(() => { for (let i = 0; i < 1000; i++) moveHandlers().forEach(h => h(fakeEvt)); });

// Lecktest: nach 50 Renders dürfen keine neuen Dokument-Listener oder Timer dazukommen
app.h.setTab('plan');
app.render();
const docBefore = docListeners(app.doc), timersBefore = app.pendingTimers();
for (let i = 0; i < 50; i++) app.render();
result.leakDocListeners = docListeners(app.doc) - docBefore;
result.leakTimers = app.pendingTimers() - timersBefore;

// Ausgabe
const f = n => n.toFixed(1);
console.log('Messung (Node, DOM-Stub, Extrem-Fixture, Median aus ' + RUNS + ' Läufen)');
console.log('Start (Skripte laden, erster Render)     : ' + f(result.startMs) + ' ms');
console.log('Fixture (JSON) / fr_s im Speicher        : ' + result.fixtureBytes + ' / ' + result.frsBytes + ' Bytes');
console.log('localSave()                              : ' + f(result.localSaveMs) + ' ms');
console.log('Buchung anlegen bis Anzeige (addTx)      : ' + f(result.addTxMs) + ' ms');
console.log('Sankey (Monat 2026-10)                   : ' + f(result.sankeyMs) + ' ms');
console.log('Prognose-Ansicht (alle Szenarien)        : ' + f(result.planMs) + ' ms');
console.log('CSV-Import 1.500 Zeilen                  : ' + f(result.csv1500Ms) + ' ms');
console.log('CSV-Import 5.000 Zeilen (Limit 1.500)    : ' + f(result.csv5000Ms) + ' ms');
console.log('pointermove: querySelectorAll je Ereignis: ' + result.qsaPerMove + ' (1.000 Ereignisse: ' + f(result.move1000Ms) + ' ms)');
console.log('Lecktest 50 Renders (Tab Prognose)       : Dokument-Listener +' + result.leakDocListeners + ', Timer +' + result.leakTimers);
console.log('');
console.log('Ansicht        | ms     | DOM-Knoten | Inline-Handler | Listener/Render | querySelectorAll/Render');
for (const r of result.views) {
  console.log([r.view.padEnd(14), f(r.ms).padStart(6), String(r.nodes).padStart(10), String(r.handlers).padStart(14), String(r.listeners).padStart(15), String(r.qsa).padStart(23)].join(' | '));
}
