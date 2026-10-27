const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness/load-app.cjs');

// 6.1 (Phase 5): Das Hinweis-Element eines Diagramms wird bei pointermove entfernt, ohne das
// Dokument mit querySelectorAll abzusuchen. Sichtbares Verhalten: Hinweis folgt dem Zeiger, verschwindet außerhalb.
test('Diagramm-Hinweis erscheint, wird ersetzt und verschwindet ohne querySelectorAll', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  const svg = app.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('data-pts', JSON.stringify([['Jan', 100, 50], ['Feb', 200, 80]]));
  svg.setAttribute('viewBox', '0 0 300 100');
  Object.assign(svg.dataset, { x0: '10', x1: '290', top: '10', bot: '90', min: '0', max: '100', names: 'Wert' });

  let qsa = 0;
  const origQsa = app.doc.querySelectorAll;
  app.doc.querySelectorAll = (...a) => { qsa++; return origQsa.apply(app.doc, a); };

  const handlers = app.doc.listeners.pointermove || [];
  const over = { target: { closest: sel => (sel === 'svg[data-pts]' ? svg : null) }, clientX: 150, clientY: 40, preventDefault() {} };
  const away = { target: { closest: () => null }, clientX: 0, clientY: 0, preventDefault() {} };
  const tips = () => svg.children.filter(c => c.attrs.class === 'tip').length;

  handlers.forEach(h => h(over));
  assert.equal(tips(), 1, 'Hinweis erscheint beim Darüberfahren');
  handlers.forEach(h => h(over));
  assert.equal(tips(), 1, 'Hinweis wird ersetzt, nicht gestapelt');
  handlers.forEach(h => h(away));
  assert.equal(tips(), 0, 'Hinweis verschwindet außerhalb des Diagramms');
  assert.equal(qsa, 0, 'kein querySelectorAll im Dokument bei pointermove');
});
