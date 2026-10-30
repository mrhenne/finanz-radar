'use strict';
// Phase 3A (endurance-hub-Stil): Schriften, Service-Worker-Precache, Fuck-Off-Gauge und Glättung der Verläufe.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const FONTS = ['onest-latin-wght-normal.woff2', 'onest-latin-ext-wght-normal.woff2',
  'big-shoulders-display-latin-wght-normal.woff2', 'big-shoulders-display-latin-ext-wght-normal.woff2'];

test('(a) Schriften: vier @font-face-Blöcke vor :root, Tokens und echte woff2-Dateien vorhanden', () => {
  const faces = css.match(/@font-face\{[^}]*\}/g) || [];
  assert.equal(faces.length, 4, 'vier @font-face-Blöcke');
  for (const f of FONTS) assert.ok(faces.some(b => b.includes('url(fonts/' + f + ')')), 'Block für ' + f);
  assert.match(css, /--font-display:'Big Shoulders Display Variable'/);
  assert.match(css, /--font-text:'Onest Variable'/);
  assert.ok(css.indexOf('@font-face') < css.indexOf(':root{'), '@font-face steht vor :root');
  for (const f of FONTS) {
    const file = path.join(ROOT, 'fonts', f);
    assert.ok(fs.existsSync(file), 'fonts/' + f + ' fehlt');
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', f + ' ist kein woff2');
  }
  for (const f of ['LICENSE-onest.txt', 'LICENSE-big-shoulders-display.txt']) assert.ok(fs.existsSync(path.join(ROOT, 'fonts', f)), f);
});

test('(b) Service Worker: Fonts stehen im Precache', () => {
  const shell = sw.match(/const SHELL = (\[[^\]]*\]);/)[1];
  for (const f of FONTS) assert.ok(shell.includes("'fonts/" + f + "'"), 'Precache ohne ' + f);
});

test('(c) Gauge: 41 Striche, aktive Striche bei 0, 50 und 100 Prozent', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  const count = (svg, re) => (svg.match(re) || []).length;
  for (const [p, aktiv] of [[0, 0], [50, 21], [100, 41]]) {
    const svg = app.evalApp(`window.gaugeSVG(${p})`);
    assert.equal(count(svg, /<line class="tk/g), 41, 'Anzahl Striche bei ' + p + ' %');
    assert.equal(count(svg, /<line class="tk on"/g), aktiv, 'aktive Striche bei ' + p + ' %');
  }
  assert.match(app.evalApp('window.gaugeSVG(100)'), /class="ring gauge done"/, 'Erledigt-Zustand');
});

test('(d) smoothPath: unter zwei Punkten leer, bei drei Punkten zwei C-Segmente', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  assert.equal(app.evalApp('smoothPath([])'), '');
  assert.equal(app.evalApp('smoothPath([[1,2]])'), '');
  const d = app.evalApp('smoothPath([[0,0],[10,5],[20,0]])');
  assert.equal((d.match(/ C/g) || []).length, 2, 'zwei C-Segmente');
  assert.match(d, /^M0\.0,0\.0/);
});

test('(e) Panel-Titel: [Kat] allein ist sichtbarer Titel, der Fokus-Hero bleibt ohne sichtbaren Titel', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
  app.h.setTab('assets');
  const vermoegen = app.render();
  assert.match(vermoegen, /cursor:pointer" data-click="tg"[^>]*>Notgroschen<\/span>/, 'Notgroschen ist als sichtbarer Titel gerendert');
  assert.doesNotMatch(vermoegen, /<span class="sr-only">Notgroschen<\/span>/, 'kein sr-only-Titel bei [Kat] allein');
  app.h.setTab('home');
  assert.match(app.render(), /<span class="sr-only">Fokus<\/span>/, 'Fokus-Hero bleibt sr-only');
});
