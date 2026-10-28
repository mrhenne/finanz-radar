const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadApp } = require('./harness/load-app.cjs');
const { makeExtreme } = require('./fixtures/extreme.cjs');

// S-17 und S-18: Prüfung des Dateiimports. Erfundene Beispieldaten.
// Der Ausschnitt aus app.js wird wie in import-safety.test.cjs geladen, zusätzlich die Listen IN, OUT, KIND.
const app = fs.readFileSync('app.js', 'utf8');
const start = app.indexOf('function sanitizeImportedValue');
const end = app.indexOf("\ntry{const j=localStorage.getItem('fr_s')", start);
const listen = app.slice(app.indexOf('const IN='), app.indexOf('let yr='));
assert.ok(start >= 0 && end > start && listen.includes('const KIND='), 'Prüffunktionen und Listen müssen in app.js stehen');

let n = 0;
const context = { uid: () => 'test_' + (++n) };
vm.runInNewContext(listen + '\n' + app.slice(start, end) +
  '\nthis.imp = { normalizeImportedState, betragAus, istKalendertag, istMonat };', context, { timeout: 2000 });
const { normalizeImportedState, betragAus, istKalendertag, istMonat } = context.imp;
const plain = v => JSON.parse(JSON.stringify(v));
const bericht = () => ({ uebernommen: 0, verworfen: {}, korrigiert: {} });
const tx = (id, extra = {}) => ({ id, d: '2026-03-05', c: 'Lebensmittel', a: 10, n: 'Beispiel', r: null, ...extra });
/* Streng: Import mit Bericht. */
const importe = raw => { const rep = bericht(); const state = plain(normalizeImportedState(raw, rep)); return { state, rep }; };

test('Kalendertag: nur echte Tage im Format YYYY-MM-DD', () => {
  assert.equal(istKalendertag('2026-02-28'), true);
  assert.equal(istKalendertag('2028-02-29'), true, 'Schaltjahr');
  assert.equal(istKalendertag('2026-02-29'), false, 'kein Schalttag');
  assert.equal(istKalendertag('2026-02-30'), false);
  assert.equal(istKalendertag('2026-13-01'), false);
  assert.equal(istKalendertag('2026-1-5'), false);
  assert.equal(istKalendertag('05.03.2026'), false);
  assert.equal(istKalendertag('2026-03-05T00:00:00Z'), false);
  assert.equal(istKalendertag(20260305), false);
  assert.equal(istKalendertag(undefined), false);
});

test('Monat: YYYY-MM mit Monat 01 bis 12', () => {
  assert.equal(istMonat('2026-05'), true);
  assert.equal(istMonat('2026-00'), false);
  assert.equal(istMonat('2026-13'), false);
  assert.equal(istMonat('2026-5'), false);
  assert.equal(istMonat('Mai 2026'), false);
  assert.equal(istMonat('2026-05-01'), false);
});

test('Betrag: Textbeträge nur bei eindeutigem Format', () => {
  assert.equal(betragAus(12.5), 12.5);
  assert.equal(betragAus('12,50'), 12.5);
  assert.equal(betragAus('12,50 €'), 12.5);
  assert.equal(betragAus('1.234,50'), 1234.5);
  assert.equal(betragAus('-1.234,5'), -1234.5);
  assert.equal(betragAus('12.50'), 12.5, 'Punkt mit zwei Stellen ist Dezimalpunkt');
  assert.equal(betragAus('1.234'), null, 'mehrdeutig: Tausender oder Dezimal?');
  assert.equal(betragAus('12,500'), null, 'drei Nachkommastellen nicht eindeutig');
  assert.equal(betragAus('abc'), null);
  assert.equal(betragAus(''), null);
  assert.equal(betragAus(NaN), null);
  assert.equal(betragAus(null), null);
  assert.equal(betragAus({}), null);
});

test('alte gültige Backups (Fixtures) bleiben ohne Verwerfung importierbar', () => {
  for (const f of ['small.json', 'edge.json', 'empty.json']) {
    const raw = JSON.parse(fs.readFileSync('tests/fixtures/' + f, 'utf8'));
    const { state, rep } = importe(raw);
    assert.deepEqual(rep.verworfen, {}, f + ': nichts verworfen');
    assert.deepEqual(rep.korrigiert, {}, f + ': nichts korrigiert');
    const anzahl = ['tx', 'as', 'goals', 'rec', 'debts', 'hist', 'sales'].reduce((s, k) => s + (raw[k] || []).length, 0);
    assert.equal(rep.uebernommen, anzahl, f + ': alle Datensätze übernommen');
    const lokal = plain(normalizeImportedState(raw));
    assert.deepEqual(state, lokal, f + ': Ergebnis wie beim lokalen Laden');
  }
});

test('Extremfixture (5.000 Buchungen) wird vollständig übernommen', () => {
  const { rep } = importe(plain(makeExtreme()));
  assert.deepEqual(rep.verworfen, {});
  assert.equal(rep.uebernommen, 5000 + 20 + 144);
});

test('Datum ungültig: Buchung wird verworfen, gültiger Schalttag bleibt', () => {
  const { state, rep } = importe({ tx: [tx('a', { d: '2026-02-30' }), tx('b', { d: '2026-02-29' }), tx('c', { d: '2028-02-29' }), tx('d', { d: '05.03.2026' }), tx('e', { d: '' })] });
  assert.deepEqual(state.tx.map(x => x.id), ['c']);
  assert.equal(rep.verworfen['Datum ungültig'], 4);
  assert.equal(rep.uebernommen, 1);
});

test('Monat in der Historie: ungültiger Monat wird verworfen', () => {
  const { state, rep } = importe({ hist: [{ id: 'h1', m: '2026-05', nw: 1000 }, { id: 'h2', m: '2026-13', nw: 1 }, { id: 'h3', m: 'Mai', nw: 2 }] });
  assert.deepEqual(state.hist.map(x => x.id), ['h1']);
  assert.equal(rep.verworfen['Monat ungültig'], 2);
});

test('Textbetrag wird gerettet statt auf 0 gesetzt, mehrdeutiger Betrag wird verworfen', () => {
  const { state, rep } = importe({ tx: [tx('a', { a: '12,50' }), tx('b', { a: '1.234' }), tx('c', { a: '1.234,50' })] });
  assert.deepEqual(state.tx.map(x => [x.id, x.a]), [['a', 12.5], ['c', 1234.5]]);
  assert.equal(rep.verworfen['Betrag keine gültige Zahl'], 1);
  assert.equal(rep.korrigiert['Textbetrag als Zahl übernommen'], 2);
});

test('Betrag fehlt bei Pflichtfeldern: verworfen; optionale Felder bleiben 0', () => {
  const { state, rep } = importe({ tx: [{ id: 'a', d: '2026-03-05', c: 'Gehalt', n: 'x' }], as: [{ id: 'k', n: 'Cash', k: 'cash', q: 1, p: 500 }] });
  assert.equal(state.tx.length, 0);
  assert.equal(rep.verworfen['Betrag fehlt'], 1);
  assert.equal(state.as.length, 1, 'c fehlt: optional, bleibt 0');
  assert.equal(state.as[0].c, 0);
});

test('Betrag außerhalb des Bereichs (|Betrag| über 1e9) wird verworfen', () => {
  const { state, rep } = importe({ tx: [tx('a', { a: 2e9 }), tx('b', { a: -2e9 }), tx('c', { a: 1e9 }), tx('d', { a: -1e9 })] });
  assert.deepEqual(state.tx.map(x => x.id), ['c', 'd']);
  assert.equal(rep.verworfen['Betrag außerhalb des Bereichs'], 2);
});

test('unbekannte Kategorie wird Sonstiges, bekannte bleiben (auch Sparen/Invest und Erstattung)', () => {
  const { state, rep } = importe({ tx: [tx('a', { c: 'Hobbys' }), tx('b', { c: 'Sparen/Invest' }), tx('c', { c: 'Freizeit', a: -40 })], rec: [{ id: 'r', c: 'Gehalt2', a: 5 }] });
  assert.deepEqual(state.tx.map(x => x.c), ['Sonstiges', 'Sparen/Invest', 'Freizeit']);
  assert.equal(state.tx[2].a, -40, 'negative Erstattung bleibt');
  assert.equal(state.rec[0].c, 'Sonstiges');
  assert.equal(rep.korrigiert['Kategorie unbekannt, als Sonstiges übernommen'], 2);
});

test('unbekannte Vermögensart wird sonst (Sonstiges)', () => {
  const { state, rep } = importe({ as: [{ id: 'k', n: 'Bitcoin', k: 'bitcoin', q: 1, p: 100, c: 50 }, { id: 'j', n: 'Konstrukt', k: 'constructor', q: 1, p: 1 }] });
  assert.deepEqual(state.as.map(x => x.k), ['sonst', 'sonst']);
  assert.equal(rep.korrigiert['Art unbekannt, als Sonstiges übernommen'], 2);
});

test('Vermögen mit ungültigem Kaufdatum wird verworfen; leeres Kaufdatum bleibt erlaubt', () => {
  const ok = { id: 'a1', n: 'ETF', k: 'etf', q: 2, p: 50, c: 90, l: [{ d: '', q: 2, p: 45, f: 0 }] };
  const bad = { id: 'a2', n: 'ETF2', k: 'etf', q: 2, p: 50, c: 90, l: [{ d: '2025-02-29', q: 2, p: 45, f: 0 }] };
  const { state, rep } = importe({ as: [ok, bad] });
  assert.deepEqual(state.as.map(x => x.id), ['a1']);
  assert.equal(rep.verworfen['Kaufdatum ungültig'], 1);
});

test('Zielstand: unbekannte Berechnung wird manuell', () => {
  const { state, rep } = importe({ goals: [{ id: 'g', n: 'Reise', t: 1000, c: 100, m: 'irgendwas' }] });
  assert.equal(state.goals[0].m, 'man');
  assert.equal(rep.korrigiert['Stand-Berechnung unbekannt, als manuell übernommen'], 1);
});

test('Verkäufe: ungültiges Datum wird verworfen', () => {
  const { state, rep } = importe({ sales: [{ id: 's1', d: '2026-04-31', n: 'Coin', k: 'crypto', g: 10, gc: 0, gp: 5 }, { id: 's2', d: '2026-04-30', n: 'Coin', k: 'crypto', g: 10 }] });
  assert.deepEqual(state.sales.map(x => x.id), ['s2']);
  assert.equal(rep.verworfen['Datum ungültig'], 1);
});

test('Datensätze, die keine Objekte sind, werden gezählt statt den Import abzubrechen', () => {
  const { state, rep } = importe({ tx: [null, 5, 'Text', tx('ok')] });
  assert.deepEqual(state.tx.map(x => x.id), ['ok']);
  assert.equal(rep.verworfen['kein Datensatz (Text oder Zahl)'], 3);
});

test('Investitions-Einträge (pi): ungültiges Datum und Textbetrag', () => {
  const { state, rep } = importe({ pi: { yd: 1.8, items: [{ id: 'p1', d: '2026-02-30', a: 5 }, { id: 'p2', d: '2026-02-01', a: '7,50' }] } });
  assert.deepEqual(state.pi.items.map(x => [x.id, x.a]), [['p2', 7.5]]);
  assert.equal(rep.verworfen['Datum ungültig'], 1);
});

test('S.uid aus einer Datei wird nie übernommen (S-18)', () => {
  const { state } = importe({ uid: 'fremde-nutzer-id', tx: [tx('a')] });
  assert.equal('uid' in state, false);
  const lokal = plain(normalizeImportedState({ uid: 'eigene-id', tx: [] }));
  assert.equal(lokal.uid, 'eigene-id', 'lokaler Stand behält die Kennung');
});

test('gemischtes Backup: Zähler stimmen mit dem Ergebnis überein', () => {
  const raw = { tx: [tx('a'), tx('b', { d: '2026-02-30' }), tx('c', { a: '12,50' }), tx('d', { c: 'X' })], hist: [{ id: 'h', m: '2026-01', nw: 5 }, { id: 'i', m: '2026-14', nw: 5 }] };
  const { state, rep } = importe(raw);
  assert.equal(state.tx.length + state.hist.length, rep.uebernommen);
  assert.equal(rep.uebernommen, 4);
  assert.equal(rep.verworfen['Datum ungültig'], 1);
  assert.equal(rep.verworfen['Monat ungültig'], 1);
  assert.equal(rep.korrigiert['Textbetrag als Zahl übernommen'], 1);
  assert.equal(rep.korrigiert['Kategorie unbekannt, als Sonstiges übernommen'], 1);
});

test('lokales Laden (ohne Bericht) verwirft nichts und wirft nicht bei Textbetrag', () => {
  const state = plain(normalizeImportedState({ tx: [tx('a', { d: '2026-02-30', a: '12,50' })] }));
  assert.equal(state.tx.length, 1, 'Datensatz bleibt erhalten');
});

test('Import-Ablauf mit Bestätigung: Meldung nennt übernommen und verworfen, Stand wird ersetzt', () => {
  const app2 = loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin' });
  app2.h.setTab('data');
  app2.render();
  const raw = JSON.stringify({ tx: [tx('ok'), tx('kaputt', { d: '2026-02-30' })], uid: 'fremd' });
  app2.doc.getElementById('bk').value = raw;
  app2.evalApp('importBackup()');
  const meldung = app2.alerts.find(m => /Import erfolgreich/.test(m));
  assert.ok(meldung, 'Erfolgsmeldung');
  assert.match(meldung, /1 übernommen, 1 verworfen \(1 × Datum ungültig\)/);
  assert.deepEqual(Array.from(app2.h.S().tx.map(x => x.id)), ['ok']);
  assert.equal(app2.h.S().uid, undefined, 'fremde Kennung nicht übernommen');
});

test('Import-Ablauf ohne Bestätigung: nichts wird ersetzt', () => {
  const app2 = loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin', confirm: false });
  app2.h.setTab('data');
  app2.render();
  const vorher = JSON.stringify(app2.h.S());
  app2.doc.getElementById('bk').value = JSON.stringify({ tx: [tx('ok')] });
  app2.evalApp('importBackup()');
  assert.equal(JSON.stringify(app2.h.S()), vorher);
});

test('Export enthält die Nutzerkennung nicht (S-18)', () => {
  const app2 = loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin' });
  app2.h.S().uid = 'eigene-id';
  app2.h.S().tx.push(tx('a'));
  const json = JSON.parse(app2.evalApp('exportJson()'));
  assert.equal('uid' in json, false);
  assert.deepEqual(json.tx.map(x => x.id), ['a']);
  app2.h.setTab('data');
  app2.render();
  app2.evalApp('exportBackup()');
  assert.equal('uid' in JSON.parse(app2.doc.getElementById('bk').value), false, 'Textfeld des Exports');
  assert.equal(app2.h.S().uid, 'eigene-id', 'der lokale Stand behält seine Kennung');
});
