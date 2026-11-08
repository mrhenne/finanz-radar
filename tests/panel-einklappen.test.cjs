const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// Bug: Panels mit Sonderzeichen im Titel (z. B. „Gold & Edelmetalle“) ließen sich nicht einklappen.
// Ursache: Lesen mit dem escapten Schlüssel, Schreiben mit dem rohen Schlüssel. Erfundene Beispielwerte.
const BASIS = { tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } };
const GOLD = { id: 'g1', n: 'Maple Leaf', k: 'gold', q: 2, p: 1300, c: 2000, l: [{ d: '2025-03-01', q: 2, p: 1000, f: 0 }] };
const AKTIE = { id: 'a1', n: 'Aktie X', k: 'aktie', q: 10, p: 600, c: 5000, l: [{ d: '2024-05-02', q: 10, p: 500, f: 0 }] };
const app = (extra = {}) => loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: { ...BASIS, as: [GOLD, AKTIE], ...extra } });

const entschluesseln = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#96;/g, '`').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// HTML-Ausschnitt eines Panels: vom data-pk bis zum nächsten Panel.
const panel = (html, key) => {
  const i = html.indexOf(`data-pk="${key.replace(/&/g, '&amp;')}"`);
  if (i < 0) return '';
  const j = html.indexOf('<div class="panel"', i + 1);
  return html.slice(i, j < 0 ? undefined : j);
};
// Führt die Aktion des Panel-Kopfs aus, so wie ein Klick (Dispatcher: window[fn](...args)).
const klick = (a, key) => {
  const m = panel(a.render(), key).match(/data-click="tg" data-args="([^"]*)"/);
  assert.ok(m, 'Panel-Kopf hat die Aktion tg');
  const args = JSON.parse(entschluesseln(m[1]));
  a.evalApp(`window.tg(${JSON.stringify(args[0])})`);
  return a.render();
};

test('Panel „Gold & Edelmetalle“ lässt sich einklappen und wieder aufklappen', () => {
  const a = app();
  a.h.setTab('assets');
  const key = 'assets:Gold & Edelmetalle';
  let html = a.render();
  assert.ok(panel(html, key).includes('Maple Leaf'), 'offen: Inhalt sichtbar');
  html = klick(a, key);
  assert.ok(!panel(html, key).includes('Maple Leaf'), 'eingeklappt: Inhalt weg');
  assert.ok(panel(html, key).includes('>▸<'), 'eingeklappt: Pfeil ▸');
  html = klick(a, key);
  assert.ok(panel(html, key).includes('Maple Leaf'), 'wieder offen: Inhalt da');
  assert.ok(panel(html, key).includes('>▾<'), 'wieder offen: Pfeil ▾');
});

test('Gegenprobe: Panel „Aktien“ (ohne Sonderzeichen) klappt ein und auf', () => {
  const a = app();
  a.h.setTab('assets');
  const key = 'assets:Aktien';
  let html = klick(a, key);
  assert.ok(!panel(html, key).includes('Aktie X'), 'eingeklappt');
  assert.ok(panel(html, key).includes('>▸<'));
  html = klick(a, key);
  assert.ok(panel(html, key).includes('Aktie X'), 'aufgeklappt');
  assert.ok(panel(html, key).includes('>▾<'));
});

// Der Lader entfernt „&“ aus Schlüsseln (normalizeImportedState). Der Zustand muss den Neustart überleben.
test('Nach Neustart (Stand wird neu geladen) bleibt „Gold & Edelmetalle“ eingeklappt und klappt wieder auf', () => {
  const key = 'assets:Gold & Edelmetalle';
  const a = app();
  a.h.setTab('assets');
  klick(a, key);
  const stand = JSON.parse(JSON.stringify(a.h.S()));
  const b = app({ ...stand, as: stand.as });
  b.h.setTab('assets');
  let html = b.render();
  assert.ok(!panel(html, key).includes('Maple Leaf'), 'nach Neustart: eingeklappt');
  assert.ok(panel(html, key).includes('>▸<'));
  html = klick(b, key);
  assert.ok(panel(html, key).includes('Maple Leaf'), 'Klick: aufgeklappt');
});
