const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// Teil „Kurse gebündelt“ (Endurance-Stil): Zeitlimit der Abrufe, Sammelabruf /simple/price, Neuzeichnen bei Eingabefokus,
// Such-Zuordnung ohne Kursänderung im Modus „Nur aktueller Wert“, Cache. Alle Abrufe sind Attrappen, kein Netzzugriff.
const NOW = '2026-10-26T10:00:00Z';
const base = as => ({ tx: [], as, goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });
const ok = json => ({ ok: true, status: 200, json: async () => json, headers: { get: () => null } });
const chart = () => ok({ prices: [[Date.parse(NOW) - 1e5, 1], [Date.parse(NOW), 2]] });
const markt = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000, market_cap_rank: 1, sparkline_in_7d: { price: [1, 2] } },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3000, market_cap_rank: 2, sparkline_in_7d: { price: [1, 2] } },
];
const app = (as, opts = {}) => loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: base(as), ...opts });

test('Zeitlimit: eine hängende Verlaufsabfrage blockiert die Warteschlange nicht', async () => {
  let chartCalls = 0;
  const a = app([], {
    fetch: async url => {
      if (!url.includes('market_chart')) return ok(markt);
      chartCalls++;
      if (chartCalls === 1) return new Promise(() => {}); // antwortet nie
      return chart();
    },
  });
  a.h.setLrg('7T');
  a.evalApp("series('bitcoin')");
  a.evalApp("series('ethereum')");
  await a.settle(40);
  assert.equal(a.h.CGQ().run, 0, 'Warteschlange wieder frei');
  assert.equal(a.h.CH()['bitcoin:7'].e, 1, 'hängende Abfrage als Fehler markiert');
  assert.ok(Array.isArray(a.h.CH()['ethereum:7'].d), 'nächste Abfrage ist gelaufen');
});

test('Sammelabruf: ein /simple/price-Aufruf für alle Portfolio-Coins mit cg-ID, auch außerhalb der Top-Liste', async () => {
  const pos = [
    { id: 'a', n: 'Bitcoin', k: 'crypto', q: 1, p: 1, c: 100, cg: 'bitcoin', l: [{ d: '', q: 1, p: 100, f: 0 }] },
    { id: 'b', n: 'Nischencoin', k: 'crypto', q: 2, p: 1, c: 2, cg: 'nischen-x', l: [{ d: '', q: 2, p: 1, f: 0 }] },
    { id: 'c', n: 'Ethereum', k: 'crypto', q: 1, p: 1, c: 1, cg: 'ethereum', l: [{ d: '', q: 1, p: 1, f: 0 }] },
  ];
  const a = app(pos, {
    fetch: async url => url.includes('simple/price')
      ? ok({ bitcoin: { eur: 61000 }, 'nischen-x': { eur: 7 }, ethereum: { eur: 3100 } })
      : ok(markt),
  });
  await a.settle(); // Startabruf abwarten, damit nur der Aufruf unten gezählt wird
  a.calls.length = 0;
  await a.ctx.liveFetch();
  const simple = a.calls.filter(c => c.url.includes('simple/price'));
  assert.equal(simple.length, 1, 'genau ein Sammelabruf');
  const ids = decodeURIComponent(simple[0].url.match(/ids=([^&]+)/)[1]).split(',').sort();
  assert.deepEqual(ids, ['bitcoin', 'ethereum', 'nischen-x']);
  assert.match(simple[0].url, /include_24hr_change=true/);
  const s = a.h.S().as;
  assert.deepEqual([s[0].p, s[1].p, s[2].p], [61000, 7, 3100], 'Kurse aus dem Sammelabruf');
  const markets = a.calls.filter(c => c.url.includes('coins/markets'));
  assert.equal(markets.length, 1);
  assert.match(markets[0].url, /per_page=20/);
  assert.ok(!/sparkline=true/.test(markets[0].url), 'ohne Sparkline außerhalb des Krypto-Tabs');
});

test('Neuzeichnen: nicht während ein Eingabefeld Fokus hat, danach genau einmal', async () => {
  const a = app([]);
  a.h.setTab('crypto');
  a.evalApp('(function(){const o=render;window.__rc=0;render=function(){__rc++;return o.apply(this,arguments)}})()');
  a.doc.activeElement = { tagName: 'INPUT' };
  a.evalApp('rq();rq();rq()');
  await a.settle();
  assert.equal(a.evalApp('__rc'), 0, 'kein Render bei fokussiertem Eingabefeld');
  a.doc.activeElement = { tagName: 'BODY' };
  a.fire('focusout');
  await a.settle();
  assert.equal(a.evalApp('__rc'), 1, 'genau ein Render nach dem Verlassen des Feldes');
});

test('Suche im Modus „Nur aktueller Wert“ (Neuanlage): setzt nur die cg-ID, der Gesamtwert bleibt', () => {
  const a = app([]);
  a.h.setTab('assets'); a.render();
  a.doc.getElementById('am').value = 'e';
  a.evalApp("setAm('e')");
  a.doc.getElementById('an').value = 'Bitcoin';
  a.doc.getElementById('ak').value = 'crypto';
  a.doc.getElementById('ap').value = '2500';
  a.evalApp("SG=[{id:'bitcoin',n:'Bitcoin',s:'btc',p:61000}];pick(0)");
  assert.equal(a.doc.getElementById('ap').value, '2500', 'Gesamtwert nicht durch den Stückkurs ersetzt');
  a.evalApp('addAs()');
  const neu = a.h.S().as[a.h.S().as.length - 1];
  assert.equal(neu.cg, 'bitcoin', 'cg-ID gesetzt');
  assert.equal(neu.p, 2500, 'Wert unverändert');
  assert.equal(neu.m, 'e');
});

test('Inline-Suche einer Krypto-Position im Modus „Nur aktueller Wert“: nur cg wird gespeichert', () => {
  const a = app([{ id: 'e1', n: 'Bitcoin', k: 'crypto', m: 'e', q: 1, p: 1000 }]);
  a.h.setTab('assets'); a.h.setEd({ k: 'as', id: 'e1' }); a.render();
  a.evalApp("ECG=[{id:'bitcoin',n:'Bitcoin',s:'btc'}];cgPick(0)");
  assert.match(a.render(), /Zugeordnet: Bitcoin/);
  a.evalApp('edSave()');
  const p = a.h.S().as[0];
  assert.equal(p.cg, 'bitcoin');
  assert.equal(p.p, 1000, 'Gesamtwert unverändert');
  assert.equal(p.m, 'e');
});

test('Zuordnung ohne cg-ID: nur eindeutige Treffer; sonst Hinweis in der Zeile', async () => {
  const a = app([
    { id: 'x1', n: 'Nischencoin', k: 'crypto', q: 1, p: 5, c: 5, l: [{ d: '', q: 1, p: 5, f: 0 }] },
    { id: 'x2', n: 'Ethereum', k: 'crypto', q: 1, p: 1, c: 1, l: [{ d: '', q: 1, p: 1, f: 0 }] },
  ], { fetch: async () => ok(markt) });
  await a.settle();
  assert.equal(a.h.S().as[1].p, 3000, 'Ethereum über den exakten Namen zugeordnet');
  assert.equal(a.h.S().as[0].p, 5, 'Nischencoin ohne Treffer: Kurs unverändert');
  a.h.setTab('assets');
  assert.match(a.render(), /Keine CoinGecko-Zuordnung – tippe ✎ und wähle den Coin/);
  a.h.setLIVE({ ts: 1, err: '', list: [
    { id: 'a1', name: 'Alpha', symbol: 'xx', current_price: 1, sparkline_in_7d: { price: [] } },
    { id: 'a2', name: 'Beta', symbol: 'xx', current_price: 2, sparkline_in_7d: { price: [] } },
  ] });
  assert.equal(a.evalApp("cgTreffer('xx')"), null, 'mehrdeutiges Symbol: kein Treffer');
  assert.equal(a.evalApp("cgTreffer('alpha').id"), 'a1', 'exakter Name: eindeutiger Treffer');
});

test('Verlaufs-Cache: veralteter Eintrag erscheint sofort, die Aktualisierung läuft im Hintergrund', async () => {
  const t = Date.parse(NOW) - 45 * 6e4; // 45 min alt: für 7 Tage veraltet (TTL 30 min), aber unter 24 h
  const cache = { 'bitcoin:7': { d: [[Date.parse(NOW) - 1e5, 1]], t } };
  const a = app([], {
    storage: { fr_cg: JSON.stringify(cache) },
    fetch: async url => url.includes('market_chart') ? chart() : ok(markt),
  });
  a.h.setLrg('7T');
  const v = a.evalApp("series('bitcoin')");
  assert.ok(Array.isArray(v) && v.length === 1, 'gespeicherter Verlauf sofort verfügbar');
  await a.settle();
  assert.equal(a.calls.filter(c => c.url.includes('market_chart')).length, 1, 'Aktualisierung im Hintergrund');
});

test('Suche /search: gleicher Begriff innerhalb von 5 min kommt aus dem Cache', async () => {
  const a = app([], {
    fetch: async url => url.includes('/search') ? ok({ coins: [{ id: 'ethereum', name: 'Ethereum', symbol: 'eth' }] }) : ok(markt),
  });
  await a.settle();
  a.calls.length = 0;
  const r1 = await a.evalApp("cgSearch('Eth')");
  const r2 = await a.evalApp("cgSearch('eth')");
  assert.equal(a.calls.filter(c => c.url.includes('/search')).length, 1, 'nur ein Abruf');
  assert.equal(r1[0].id, 'ethereum');
  assert.deepEqual(r2, r1);
});

test('Sichtbarkeit: Rückkehr in den Tab holt Kurse nur bei Krypto-Bezug und nach mehr als 60 s', async () => {
  let marktAbrufe = 0;
  const a = app([], { fetch: async url => { if (url.includes('coins/markets')) marktAbrufe++; return ok(markt); } });
  await a.settle();
  marktAbrufe = 0;
  a.h.setTab('crypto');
  a.fire('visibilitychange'); // gerade eben geladen: kein Abruf
  await a.settle();
  assert.equal(marktAbrufe, 0, 'letzter Abruf jünger als 60 s');
  a.setNow('2026-10-26T10:02:00Z');
  a.doc.hidden = true;
  a.fire('visibilitychange'); // Tab nicht sichtbar: kein Abruf
  await a.settle();
  assert.equal(marktAbrufe, 0, 'Tab nicht sichtbar');
  a.doc.hidden = false;
  a.fire('visibilitychange');
  await a.settle();
  assert.equal(marktAbrufe, 1, 'Rückkehr nach über 60 s holt die Kurse');
  a.h.setTab('cash');
  a.setNow('2026-10-26T10:05:00Z');
  a.fire('visibilitychange');
  await a.settle();
  assert.equal(marktAbrufe, 1, 'Ansicht ohne Krypto-Bezug: kein Abruf');
});
