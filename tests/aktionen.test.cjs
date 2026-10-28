'use strict';
// Teil B: Aktionen ohne Inline-Handler. act() erzeugt data-click/-change/-input und data-args,
// der Dispatcher am Dokument ruft nur Namen aus ACTS auf. Geprüft mit dem vm-Harness und Fake-Elementen.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

const PAYLOADS = ['"><img src=x onerror=alert(1)>', "x' onmouseover='alert(1)", "');alert(1);//", '`${alert(1)}`', 'Lidl\'s "Angebot" & Co'];
const decode = s => s.replace(/&quot;|&#39;|&#96;|&lt;|&gt;|&amp;/g, m => ({ '&quot;': '"', '&#39;': "'", '&#96;': '`', '&lt;': '<', '&gt;': '>', '&amp;': '&' })[m]);

// Fake-Element mit den Teilen der DOM-API, die der Dispatcher nutzt
function el(attrs = {}, parent = null, value = '', checked = false) {
  return {
    attrs, parentElement: parent, value, checked,
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    closest(sel) { const k = sel.slice(1, -1); let n = this; while (n) { if (k in n.attrs) return n; n = n.parentElement; } return null; },
  };
}

function setup() {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  app.evalApp('globalThis.__log = []; function aktProbe(...a){ __log.push(a); } function aktProbe2(...a){ __log.push(["2", ...a]); }');
  app.evalApp("ACTS.add('aktProbe'); ACTS.add('aktProbe2');");
  return app;
}
// Aufrufliste in den Realm des Tests kopieren (Arrays aus dem vm-Kontext sind sonst nicht deepEqual)
const log = app => Array.from(app.evalApp('__log'), a => Array.from(a));

test('Dispatcher ist je Ereignisart genau einmal registriert und wächst beim Neuzeichnen nicht', () => {
  const small = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: small });
  const count = () => ['click', 'change', 'input'].map(t => (app.doc.listeners[t] || []).length);
  assert.deepEqual(count(), [1, 1, 1]);
  for (let i = 0; i < 20; i++) app.render();
  assert.deepEqual(count(), [1, 1, 1]);
});

test('act() erzeugt data-click mit Argumenten als JSON, Nutzerdaten sind im Attribut escaped', () => {
  const app = setup();
  for (const p of PAYLOADS) {
    const out = app.evalApp('act("aktProbe", ' + JSON.stringify([p, 3]) + ')');
    assert.match(out, /^data-click="aktProbe" data-args="[^"<>']*"$/, p);
    assert.deepEqual(JSON.parse(decode(out.match(/data-args="([^"]*)"/)[1])), [p, 3]);
  }
  assert.equal(app.evalApp("act('aktProbe2')"), 'data-click="aktProbe2"');
  assert.equal(app.evalApp("act('aktProbe2', [], 'change')"), 'data-change="aktProbe2"');
  assert.equal(app.evalApp("act('aktProbe2', ['$value'], 'input')"), 'data-input="aktProbe2" data-args="[&quot;$value&quot;]"');
});

test('act() verweigert Namen, die nicht in ACTS stehen (auch wenn es eine globale Funktion gibt)', () => {
  const app = setup();
  assert.throws(() => app.evalApp("act('nichtRegistriert')"), /nicht registriert/);
  assert.throws(() => app.evalApp("act('render')"), /nicht registriert/);
  assert.throws(() => app.evalApp("act('constructor')"), /nicht registriert/);
});

test('Dispatcher: Klick ruft die Aktionen von innen nach außen auf, mit Argumenten', () => {
  const app = setup();
  const outer = el({ 'data-click': 'aktProbe', 'data-args': '["außen"]' });
  const inner = el({ 'data-click': 'aktProbe2', 'data-args': '["innen",1]' }, outer);
  const textZiel = el({}, inner); // Ziel ohne Attribut, Vorfahren zählen
  app.doc.listeners.click[0]({ target: textZiel });
  assert.deepEqual(log(app), [['2', 'innen', 1], ['außen']]);
});

test('Dispatcher: $value, $checked und $el werden eingesetzt', () => {
  const app = setup();
  const input = el({ 'data-change': 'aktProbe', 'data-args': '["$value","$checked",3]' }, null, '12,5', true);
  app.doc.listeners.change[0]({ target: input });
  const box = el({ 'data-input': 'aktProbe2', 'data-args': '["$el"]' });
  app.doc.listeners.input[0]({ target: box });
  const l = log(app);
  assert.deepEqual(l[0], ['12,5', true, 3]);
  assert.equal(l[1][0], '2');
  assert.equal(l[1][1], box);
});

test('Dispatcher: Namen aus Daten, die nicht in ACTS stehen, werden nie aufgerufen', () => {
  const app = setup();
  const evil = el({ 'data-click': 'constructor' });
  assert.throws(() => app.doc.listeners.click[0]({ target: evil }), /nicht registriert/);
  const render = el({ 'data-click': 'render' });
  assert.throws(() => app.doc.listeners.click[0]({ target: render }), /nicht registriert/);
  assert.deepEqual(log(app), []);
});

test('Dispatcher: Fehler in einer Aktion stoppt die übrigen Ziele nicht', () => {
  const app = setup();
  app.evalApp("ACTS.add('aktKaputt'); function aktKaputt(){ throw new Error('kaputt'); }");
  const outer = el({ 'data-click': 'aktProbe', 'data-args': '["weiter"]' });
  const inner = el({ 'data-click': 'aktKaputt' }, outer);
  app.doc.listeners.click[0]({ target: inner });
  assert.deepEqual(log(app), [['weiter']]);
  // Der Fehler wird wie bei einem Inline-Handler als ungefangene Ausnahme gemeldet (asynchron)
  assert.ok(app.pendingTimers() >= 1);
});

// Jede Aktion, die im Quelltext per act('…') vorkommt, steht in ACTS. Jeder Name in ACTS ist nach dem Laden eine Funktion am Fenster.
const QUELL = ['index.html', 'app.js', 'features.js', 'extras.js', 'boost.js'];
const quelltext = () => QUELL.map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');

test('jeder Name in act(…) im Quelltext steht in ACTS', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  const registriert = new Set(Array.from(app.evalApp('[...ACTS]')));
  const genutzt = new Set([...quelltext().matchAll(/act\('([A-Za-z_$][\w$]*)'|data-(?:click|change|input)="([A-Za-z_$][\w$]*)"/g)].map(m => m[1] || m[2]));
  assert.ok(genutzt.size > 40, 'Liste der act()-Namen ist leer: Prüfung wäre leer');
  assert.deepEqual([...genutzt].filter(n => !registriert.has(n)), [], 'nicht registriert');
});

test('jeder Name in ACTS ist nach dem Laden eine Funktion am Fenster (window[name])', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  const nichtFunktion = app.evalApp("[...ACTS].filter(n => typeof window[n] !== 'function')");
  assert.deepEqual(Array.from(nichtFunktion), []);
});

test('keine Aktion ist überflüssig: jeder Name in ACTS wird im Quelltext genutzt', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  const registriert = Array.from(app.evalApp('[...ACTS]'));
  const genutzt = new Set([...quelltext().matchAll(/act\('([A-Za-z_$][\w$]*)'|data-(?:click|change|input)="([A-Za-z_$][\w$]*)"/g)].map(m => m[1] || m[2]));
  // Nur Namen zählen, die im Quelltext als act('name' vorkommen; der Aufruf in den Tests zählt nicht
  assert.deepEqual(registriert.filter(n => !genutzt.has(n)), []);
});

test('Dispatcher: $event übergibt das Ereignis (für Links: preventDefault statt return false)', () => {
  const app = setup();
  app.evalApp("ACTS.add('aktEreignis'); function aktEreignis(x){ __log.push(['ev', x && x.typ]); }");
  const link = el({ 'data-click': 'aktEreignis', 'data-args': '["$event"]' });
  app.doc.listeners.click[0]({ target: link, typ: 'click' });
  assert.deepEqual(log(app), [['ev', 'click']]);
});
