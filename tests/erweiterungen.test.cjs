const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadApp } = require('./harness/load-app.cjs');

// 4.2, 4.3, 4.7, 4.9: Parser, CSV-Import mit Rückgängig, Sparplan, Vorschau, Feed-Reihenfolge, Sankey,
// Job-Modell, Auto-Sicherungen, Monatsnavigation und die beiden CSV-Parser.
const small = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
const empty = () => ({ tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });
const slice = (src, from, to) => { const i = src.indexOf(from), j = src.indexOf(to, i + 1); assert.ok(i >= 0 && j > i, 'Abschnitt fehlt: ' + from); return src.slice(i, j); };
const extras = fs.readFileSync('extras.js', 'utf8');
const features = fs.readFileSync('features.js', 'utf8');
const boost = fs.readFileSync('boost.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

// --- 4.2 Beträge und Datum (Import-Parser aus extras.js) ---
const pctx = {};
vm.runInNewContext(slice(extras, 'const pad = n', 'const addM') + slice(extras, 'function parseAmount(s)', 'const realDay') +
  slice(extras, 'const realDay', 'function importText') + '\nthis.p={parseAmount,parseDate};', pctx, { timeout: 2000 });
const { parseAmount, parseDate } = pctx.p;

test('parseAmount: deutsche, englische und Klammer-Schreibweisen', () => {
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('1,234.56'), 1234.56, 'englische Tausender');
  assert.equal(parseAmount('-12,5'), -12.5);
  assert.equal(parseAmount('12,5 €'), 12.5);
  assert.equal(parseAmount('(12,50)'), -12.5);
  assert.equal(parseAmount('+3,00'), 3);
  assert.equal(parseAmount('NaN'), null, 'NaN wird abgelehnt');
  assert.equal(parseAmount('Infinity'), null, 'Unendlich wird abgelehnt');
});

test('parseDate: ISO, dd.mm.yyyy, zweistelliges Jahr, ungültige Tage', () => {
  assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate('05.10.2026'), '2026-10-05');
  assert.equal(parseDate('05.10.26'), '2026-10-05');
  assert.equal(parseDate('31.02.2026'), null, 'den 31. Februar gibt es nicht');
  assert.equal(parseDate('29.02.2027'), null, '2027 ist kein Schaltjahr');
  assert.equal(parseDate('29.02.2028'), '2028-02-29');
});

// --- 4.3 Sparplan, Vorschau, Feed ---
test('Sparplan-Check: Ist 300 € von 500 € Ziel, Monat läuft noch (vor dem 25.)', () => {
  const state = small();
  state.spl = { t: 500 };
  state.ui = { c: {}, o: {}, hf: true }; // Home-Details mit Sparplan-Panel
  state.tx = [{ id: 'i1', d: '2026-10-03', c: 'Sparen/Invest', a: 300, n: 'ETF', r: null }];
  const a = loadApp({ now: '2026-10-10T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  const html = a.render();
  assert.ok(html.includes('Noch 200 € bis zum Plan'), 'Restbetrag zum Plan');
});

test('Vorschau nächste drei Monate: Cash 5.000 € minus Ø variable Ausgaben (Fixture "klein")', () => {
  const a = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: small() });
  a.h.setTab('cash');
  const html = a.render();
  // Im Oktober ist die Miete (900 €) schon automatisch gebucht. Ø Ausgaben Juli bis Oktober: (900 + 1.110,50 + 860 + 900) / 4 = 942,63 €.
  // Vorlage 900 €, variable Ausgaben 42,63 €. Cash 5.000 € − 942,63 € = 4.057,37 €, danach 3.114,74 €.
  assert.ok(html.includes('4.057 €'), 'erster Vorschaumonat');
  assert.ok(html.includes('3.115 €'), 'zweiter Vorschaumonat');
});

test('Feed: Kategorien nach Summe absteigend (Gehalt 3.000, Wohnen 900, Sparen 300, Lebensmittel 210,50)', () => {
  const a = loadApp({ now: '2026-08-15T10:00:00Z', tz: 'Europe/Berlin', fixture: small() });
  a.h.setMo('2026-08');
  a.h.setTab('cash');
  const html = a.render();
  const pos = c => html.indexOf('<span>' + c + '</span><span>');
  const order = ['Gehalt', 'Wohnen', 'Sparen/Invest', 'Lebensmittel'].map(pos);
  assert.ok(order.every(p => p > 0), 'alle Kategorien im Feed');
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
});

// --- 4.3 Monatsnavigation über Jahreswechsel und in die Zukunft ---
test('Monatsnavigation: Jahreswechsel vorwärts und rückwärts, Sprung in die Zukunft', () => {
  const a = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: empty() });
  a.h.setMo('2026-12');
  a.ctx.sh(1);
  assert.equal(a.h.mo(), '2027-01');
  a.ctx.sh(-1);
  assert.equal(a.h.mo(), '2026-12');
  a.h.setMo('2026-12');
  a.ctx.sh(14);
  assert.equal(a.h.mo(), '2028-02');
});

// --- 4.7 CSV-Import mit Vorschau, Duplikaten und Rückgängig ---
const CSV = 'Buchungstag;Verwendungszweck;Betrag\n05.10.2026;REWE Markt;-23,40\n06.10.2026;Gehalt Oktober;2.500,00\n';
test('CSV-Import: Vorschau, Import und Rückgängig stellen den Ausgangsstand her', () => {
  const state = empty();
  const a = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: state });
  const I = a.ctx.__fr_extras.IMP;
  assert.equal(a.ctx.impText(CSV), 2);
  assert.equal(I.rows.length, 2);
  a.ctx.impGo();
  assert.equal(a.h.S().tx.length, 2, 'beide importiert');
  assert.ok(a.h.S().lastImp && a.h.S().lastImp.ids.length === 2, 'Import gemerkt');
  a.ctx.impUndo();
  assert.equal(a.h.S().tx.length, 0, 'Rückgängig entfernt genau diesen Import');
  assert.equal(a.h.S().lastImp, undefined);
});

test('CSV-Import: erneuter Import derselben Datei markiert alles als Duplikat', () => {
  const a = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: empty() });
  a.ctx.impText(CSV);
  a.ctx.impGo();
  a.ctx.impText(CSV);
  const I = a.ctx.__fr_extras.IMP;
  assert.ok(I.rows.every(r => r.dup), 'alle Zeilen Duplikate');
});

// --- 4.3 Auto-Sicherungen: höchstens fünf, eine je Ortstag ---
test('Auto-Sicherungen: über sieben Tage bleiben genau fünf, je Ortstag eine', () => {
  const a = loadApp({ now: '2026-10-20T12:00:00Z', tz: 'Europe/Berlin', fixture: small() });
  for (let d = 0; d < 7; d++) {
    a.setNow(`2026-10-${String(20 + d).padStart(2, '0')}T12:00:00Z`);
    a.doc.hidden = true; a.doc.listeners.visibilitychange.forEach(fn => fn());
    a.doc.hidden = false; a.doc.listeners.visibilitychange.forEach(fn => fn());
  }
  const list = JSON.parse(a.storage.getItem('fr_bk'));
  assert.equal(list.length, 5);
  assert.equal(new Set(list.map(x => x.t.slice(0, 10))).size, 5, 'je ein Eintrag je Tag');
});

// --- 4.7 Sankey: keine NaN, keine negativen Maße bei 0 und Erstattungen ---
test('Sankey: leer, nur Einnahmen und Erstattung ohne NaN und ohne negative Maße', () => {
  const a = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: empty() });
  const sankey = t => a.evalApp('sankey(' + JSON.stringify(t) + ')');
  assert.match(sankey([]), /Keine Daten/);
  const withRefund = sankey([{ c: 'Gehalt', a: 3000, d: '2026-10-01', n: '' }, { c: 'Freizeit', a: -40, d: '2026-10-02', n: '' }, { c: 'Wohnen', a: 900, d: '2026-10-03', n: '' }]);
  assert.ok(!/NaN|Infinity/.test(withRefund));
  const heights = [...withRefund.matchAll(/height="([-\d.]+)"/g)].map(m => +m[1]);
  assert.ok(heights.every(h => h >= 0), 'keine negative Höhe');
});

// --- 4.7 Job-Modell (Netto-Näherung, offengelegt) ---
const bc = {};
vm.runInNewContext(slice(boost, 'const K_NET = 0.86;', 'const at = (rows') + '\nthis.j={netAt,simJob,K_NET};', bc, { timeout: 2000 });
test('Job: Netto bei Teilzeit ist eine Näherung (86 % des Brutto-Anteils), bei 100 % gleich Brutto', () => {
  assert.equal(bc.j.K_NET, 0.86);
  assert.equal(bc.j.netAt(3000, 100), 3000);
  assert.ok(Math.abs(bc.j.netAt(3000, 80) - 2484) < 1e-9, '80 %: 3.000 × (1 − 0,2 × 0,86)');
});

// --- 4.9 Ladereihenfolge und doppelte Parser ---
const fp = {};
vm.runInNewContext(slice(features, 'function parseCSV(text) {', 'const rules = [') + '\nthis.f=parseCSV;', fp, { timeout: 2000 });
const ep = {};
vm.runInNewContext(slice(extras, 'function parseCSV(text, d) {', 'const normH') + '\nthis.e=parseCSV;', ep, { timeout: 2000 });
test('parseCSV: zwei Versionen (features.js: toter Pfad, extras.js: aktiv) liefern für Semikolon-Dateien dasselbe', () => {
  const text = 'a;b\n"x;y";1\r\n\n"quote ""q""";2\n';
  assert.deepEqual(JSON.parse(JSON.stringify(fp.f(text))), JSON.parse(JSON.stringify(ep.e(text, ';'))));
});
test('parseCSV: Tab-Trennung wird nur von der aktiven Version (extras.js) erkannt', () => {
  const text = 'a\tb\n1\t2\n';
  assert.equal(ep.e(text, '\t')[0].length, 2);
  assert.equal(fp.f(text)[0].length, 1, 'die tote Version kennt kein Tab');
});

test('Ladereihenfolge: config, app, features, extras, boost laufen ohne Fehler im gemeinsamen Gültigkeitsbereich', () => {
  const a = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: small() });
  assert.deepEqual(a.logsOfErrors(), []);
  assert.equal(typeof a.ctx.impText, 'function', 'extras.js geladen');
  assert.equal(typeof a.ctx.piAdd, 'function', 'boost.js geladen');
  assert.equal(typeof a.ctx.csvLoad, 'function', 'features.js geladen');
});
