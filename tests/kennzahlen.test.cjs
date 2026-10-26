const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

// 4.1 / 4.3: Gleiche Kennzahl muss in allen Ansichten denselben Wert zeigen.
// Fixture "small": Juli bis September 2026. August: Einnahmen 3.000 €, Investiert 300 €, Ausgaben 1.110,50 €.
const small = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
const txt = s => s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const first = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

function app(now, mo, extra = {}) {
  const a = loadApp({ now, tz: 'Europe/Berlin', fixture: small() });
  a.h.setMo(mo);
  if (extra.details) { const s = a.h.S(); s.ui.hf = true; a.h.setS(s); }
  return a;
}

test('Net Worth (Home, Vermögen, Portfolio, Prognose) ist überall 11.500 €', () => {
  const a = app('2026-08-15T10:00:00Z', '2026-08');
  a.h.setTab('home'); const home = first(a.render(), /<span>Net Worth<\/span>|<b>([^<]*)<\/b><span>Net Worth<\/span>/);
  const homeVal = first(a.view(), /<b>([^<]*)<\/b><span>Net Worth<\/span>/);
  a.h.setTab('assets'); const assets = first(a.render(), /<span class="mut">Net Worth<\/span><b>([^<]*)<\/b>/);
  a.h.setTab('port'); const port = first(a.render(), /NET WORTH<\/text><text[^>]*>([^<]*)<\/text>/);
  a.h.setTab('plan'); a.render();
  const plan = a.doc.getElementById('pr_s0').value;
  assert.equal(homeVal, '11.500 €', 'Home');
  assert.equal(assets, '11.500 €', 'Vermögen');
  assert.equal(port, '11.500 €', 'Portfolio');
  assert.equal(Number(plan), 11500, 'Prognose Startkapital');
  assert.ok(home !== null);
});

test('Sparquote 10 % im August: Home-Details, Monatsrückblick, Verlauf und Fokus-Kachel stimmen überein', () => {
  const a = app('2026-08-15T10:00:00Z', '2026-08', { details: true });
  a.h.setTab('home');
  const homeDetails = first(a.render(), /<b>([^<]*)<\/b><span>Sparquote<\/span>/);
  const tile = first(a.view(), /<span>Sparquote<\/span><b><span class="n">([^<]*)<\/span><\/b>/);
  a.h.setTab('review');
  const review = first(a.render(), /<b>([^<]*)<\/b><span>Sparquote · investiert<\/span>/);
  const hist = txt(a.view()).match(/Aug\. 26 3\.000 € 1\.111 € 300 € (\S+)/);
  assert.equal(homeDetails, '10 %', 'Home-Details');
  assert.equal(tile, '10 %', 'Fokus-Kachel');
  assert.equal(review, '10 %', 'Monatsrückblick');
  assert.equal(hist && hist[1], '10', 'Verlauf (6 Monate)');
});

test('Sparquote bei Einnahmen 0 zeigt "–" in Home, Monatsrückblick und Jahresübersicht', () => {
  // Oktober 2026 ist im Fixture ohne Buchungen (keine Einnahmen).
  const a = app('2026-10-26T10:00:00Z', '2026-10', { details: true });
  a.h.setTab('home');
  const homeDetails = first(a.render(), /<b>([^<]*)<\/b><span>Sparquote<\/span>/);
  a.h.setTab('review');
  const review = first(a.render(), /<b>([^<]*)<\/b><span>Sparquote · investiert<\/span>/);
  a.h.setTab('year');
  a.render();
  const yearSpar = first(a.view(), /<b>([^<]*)<\/b><span>Sparquote<\/span>/);
  assert.equal(homeDetails, '–', 'Home-Details');
  assert.equal(review, '–', 'Monatsrückblick');
  assert.equal(yearSpar, '6,7 %', 'Jahresübersicht 2026 (600 € investiert von 9.000 € Einnahmen)');
});

test('Monatssummen August: Einnahmen, Ausgaben und Cashflow gleich in Home, Monatsrückblick, Cashflow und Jahresübersicht', () => {
  const a = app('2026-08-15T10:00:00Z', '2026-08', { details: true });
  a.h.setTab('home');
  const h = a.render();
  const home = [first(h, /<b class="pos">([^<]*)<\/b><span>Einnahmen<\/span>/), first(h, /<b class="neg">([^<]*)<\/b><span>Ausgaben<\/span>/), first(h, /<b>([^<]*)<\/b><span>Cashflow<\/span>/)];
  a.h.setTab('review');
  const r = a.render();
  const review = [first(r, /<b class="pos">([^<]*)<\/b><span>Einnahmen<\/span>/), first(r, /<b class="neg">([^<]*)<\/b><span>Ausgaben<\/span>/), first(r, /<b>([^<]*)<\/b><span>Cashflow<\/span>/)];
  a.h.setTab('cash');
  const c = a.render();
  const cash = [first(c, /\[Einnahmen\] ([^<]*)</), first(c, /\[Ausgaben\] ([^<]*)</)];
  a.h.setTab('year');
  const y = txt(a.render()).match(/Aug 3\.000 € 1\.111 € 300 € (\S+ €)/);
  assert.deepEqual(home, ['3.000 €', '1.111 €', '1.890 €']);
  assert.deepEqual(review, home, 'Monatsrückblick');
  assert.deepEqual(cash, ['3.000 €', '1.111 €'], 'Cashflow-Ansicht');
  assert.equal(y && y[1], '1.890 €', 'Jahresübersicht');
});
