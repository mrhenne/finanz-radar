'use strict';
// Phase 2B: Navigation. Icon-Rail (Desktop) und Tab-Leiste (Mobil) kommen aus einer Quelle (app.js, navHTML).
// Geprüft mit dem vm-Harness: Einträge mit aria-label, genau ein aria-current="page", Klick ruft goTab über den Dispatcher.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? decode(m[1]) : null; };
const items = app => [...app.el('tb').innerHTML.matchAll(/<button\b([^>]*)>/g)].map(m => m[1]);
const make = () => loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });

test('Navigation rendert 6 Einträge mit aria-label und goTab-Aktion', () => {
  const app = make();
  app.render();
  const list = items(app);
  assert.equal(list.length, 6);
  // Die Beschriftung des Tabs „fire“ setzt features.js um (Fuck Off), daher gegen TABS prüfen
  const tabs = JSON.parse(JSON.stringify(app.h.TABS())); // Arrays aus dem vm-Kontext in den Testkontext kopieren
  assert.equal(tabs.length, 6);
  assert.deepEqual(list.map(a => attr(a, 'aria-label')), tabs.map(t => t[1]));
  for (const a of list) assert.equal(attr(a, 'data-click'), 'goTab');
  assert.deepEqual(list.map(a => JSON.parse(attr(a, 'data-args'))), tabs.map(t => [t[0]]));
});

test('genau ein Eintrag hat aria-current="page", passend zum aktiven Tab (Mehr auch für Unterseiten)', () => {
  const app = make();
  const current = () => items(app).filter(a => /\saria-current="page"/.test(a)).map(a => attr(a, 'aria-label'));
  app.h.setTab('home'); app.render();
  assert.deepEqual(current(), ['Home']);
  app.h.setTab('cash'); app.render();
  assert.deepEqual(current(), ['Cashflow']);
  app.h.setTab('goals'); app.render();
  assert.deepEqual(current(), ['Mehr']);
});

test('Klick auf einen Eintrag ruft goTab über den Dispatcher auf', () => {
  const app = make();
  app.h.setTab('home'); app.render();
  const cash = items(app).find(a => attr(a, 'aria-label') === 'Cashflow');
  // Fake-Ziel wie im Browser: closest('[data-click]') liefert den Button mit data-click="goTab" und data-args
  const node = {
    parentElement: null,
    getAttribute(k) { return k === 'data-click' ? attr(cash, 'data-click') : k === 'data-args' ? attr(cash, 'data-args') : null; },
    closest(sel) { return sel === '[data-click]' ? this : null; },
  };
  app.doc.listeners.click.forEach(fn => fn({ target: node }));
  assert.equal(app.h.tab(), 'cash');
});
