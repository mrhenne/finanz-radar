const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// 4.5: Kursdaten von CoinGecko sind ein Vertrauensrand. Fehlende oder kaputte Felder dürfen die Ansicht nicht stoppen,
// und an CoinGecko gehen nur Coin-IDs, nie Beträge oder Mengen.
const NOW = '2026-10-26T10:00:00Z';
const base = (as) => ({ tx: [], as, goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });
const marketBody = () => [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000, market_cap_rank: 1, sparkline_in_7d: { price: [1, 2, 3] }, price_change_percentage_24h: 1.5 },
  { id: 'broken', symbol: 'bro', name: 'Kaputt', current_price: null, market_cap_rank: 2, sparkline_in_7d: { price: [1] } },
  { id: 'nosparkline', symbol: 'nsp', name: 'Ohne Verlauf', current_price: 5, market_cap_rank: null },
  { id: 'nolist', name: 'ohne id', symbol: 'x', current_price: 1 },
];
function fetchWith(body, status = 200) {
  return async url => {
    if (url.includes('coins/markets')) return { ok: status === 200, status, json: async () => body, headers: { get: () => null } };
    if (url.includes('simple/price')) return { ok: true, status: 200, json: async () => ({ bitcoin: { eur: 61000 } }), headers: { get: () => null } };
    throw new TypeError('offline');
  };
}

test('Marktliste mit fehlendem Preis und fehlenden Feldern: Krypto-Ansicht rendert, kaputte Einträge fallen weg', async () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([]), fetch: fetchWith(marketBody()) });
  await app.ctx.liveFetch();
  app.h.setTab('crypto');
  const html = app.render();
  assert.ok(html.includes('Bitcoin'));
  assert.ok(!html.includes('Kaputt'), 'Eintrag ohne Preis ausgeblendet');
  assert.ok(!html.includes('null'), 'kein "null" im Text');
  assert.ok(!/NaN|Infinity|undefined/.test(html));
  assert.deepEqual(app.logsOfErrors(), []);
});

test('Kurs aus der Marktliste übernimmt den Preis der Position (Coin-ID aus cg)', async () => {
  const pos = { id: 'k1', n: 'Bitcoin', k: 'crypto', q: 0.5, p: 1, c: 6000, cg: 'bitcoin', l: [{ d: '2025-01-01', q: 0.5, p: 12000, f: 0 }] };
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([pos]), fetch: fetchWith(marketBody()) });
  await app.ctx.liveFetch();
  assert.equal(app.h.S().as[0].p, 60000);
});

test('Fehlender Kurs in der Positionsliste (Netz aus): bisheriger Kurs bleibt, Fehlermeldung statt Absturz', async () => {
  const pos = { id: 'k1', n: 'Bitcoin', k: 'crypto', q: 0.5, p: 1234, c: 6000, cg: 'bitcoin', l: [{ d: '2025-01-01', q: 0.5, p: 12000, f: 0 }] };
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([pos]) }); // fetch wirft: offline
  await app.ctx.liveFetch();
  assert.equal(app.h.S().as[0].p, 1234, 'Kurs unverändert');
  assert.match(app.h.LIVE().err, /nicht erreichbar/);
  app.h.setTab('crypto');
  app.render();
});

test('Rate-Limit (429) bei den Marktdaten: Meldung, keine Kursänderung, Warteschlange gesetzt', async () => {
  const pos = { id: 'k1', n: 'Bitcoin', k: 'crypto', q: 0.5, p: 1234, c: 6000, cg: 'bitcoin', l: [] };
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([pos]), fetch: fetchWith([], 429) });
  await app.ctx.liveFetch();
  assert.equal(app.h.S().as[0].p, 1234);
  assert.match(app.h.LIVE().err, /HTTP 429/);
  assert.ok(app.h.CGQ().until > Date.parse(NOW), 'Pause gesetzt');
});

test('An CoinGecko gehen nur Coin-IDs und Parameter, keine Mengen oder Beträge', async () => {
  const pos = { id: 'k1', n: 'Bitcoin', k: 'crypto', q: 0.51734, p: 1, c: 6123.45, cg: 'bitcoin', l: [{ d: '2025-01-01', q: 0.51734, p: 11832.1, f: 0 }] };
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base([pos]), fetch: fetchWith(marketBody()) });
  await app.ctx.liveFetch();
  const urls = app.calls.map(c => c.url);
  assert.ok(urls.length >= 1);
  for (const u of urls) {
    assert.match(u, /^https:\/\/api\.coingecko\.com\/api\/v3\/(coins\/markets|simple\/price)\?/, u);
    assert.ok(!/0\.51734|6123|11832/.test(u), 'keine Portfolio-Zahlen in der URL');
    assert.ok(!/thehenne|@/.test(u), 'keine E-Mail-Adresse in der URL');
  }
});
