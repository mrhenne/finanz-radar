// Statische UI-Prüfungen (Phase 4): Barrierefreiheit, Formulare, Touch-Ziele, Texte, PWA.
// Liest index.html, styles.css und die JS-Dateien als Text. Keine Browser-Abhängigkeit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const JS_FILES = ['app.js', 'features.js', 'extras.js', 'boost.js'];
const html = read('index.html');
const css = read('styles.css');
const js = JS_FILES.map(read).join('\n');
const all = html + '\n' + js;

// Inhalt eines Elements ohne Tags und ohne ${…}-Ausdrücke
// dynamischer Text (${…}) zählt als Text: Buttons wie <button>${r[0]}</button> sind nicht icon-only
const visibleText = s => s.replace(/<[^>]*>/g, '').trim();

test('viewport-fit=cover und theme-color in Hell und Dunkel', () => {
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: dark\)"/);
});

test('Icon-Buttons ohne sichtbaren Text haben aria-label oder title', () => {
  const bad = [];
  for (const m of all.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const text = visibleText(m[2]);
    if (!/[\p{L}\p{N}]/u.test(text) && !/aria-label=|title=/.test(m[1])) bad.push(m[0].slice(0, 90));
  }
  assert.deepEqual(bad, [], 'Icon-Button ohne Namen');
});

test('Eingabefelder haben einen Namen (aria-label, aria-labelledby oder label for)', () => {
  const bad = [];
  for (const m of all.matchAll(/<(input|select|textarea)\b([^>]*?)\/?>/g)) {
    const attrs = m[2];
    if (/type=["']?(hidden)/.test(attrs)) continue;
    if (/aria-label=|aria-labelledby=/.test(attrs)) continue;
    const id = (attrs.match(/\bid=["']?([\w-]+)/) || [])[1];
    if (id && !/\$\{/.test(id) && all.includes('for="' + id + '"')) continue;
    if (/\$\{/.test(attrs)) continue; // dynamische IDs: im Browser-Audit geprüft
    bad.push(m[0].slice(0, 90));
  }
  assert.deepEqual(bad, [], 'Eingabefeld ohne Namen');
});

test('Tab-Leiste mit role=tablist und role=tab', () => {
  assert.match(all, /role="tablist"/); // steht in index.html
  assert.match(js, /role="tab"/);
  assert.match(js, /aria-selected/);
});

test('Dialoge mit role=dialog und aria-modal', () => {
  const sheet = (js.match(/<div class="qsh"[^>]*>/) || [''])[0];
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
});

test('dekorative Fensterpunkte sind aria-hidden', () => {
  const dots = html.match(/<span class="dot"[^>]*>/g) || [];
  assert.ok(dots.length >= 3);
  for (const d of dots) assert.match(d, /aria-hidden="true"/);
});

test('sichtbarer Tastaturfokus ist per CSS definiert', () => {
  assert.match(css, /:focus-visible\{[^}]*outline:/);
});

test('Touch-Ziele: Tab-Schaltflächen mindestens 44 px hoch', () => {
  assert.match(css, /\.tabs button\{[^}]*min-height:44px/);
});

test('Touch-Ziele: Kopfzeilen-Icons haben 44 px Trefferfläche', () => {
  assert.match(css, /\.top \.x::after\{[^}]*inset:-\d+px/);
});

test('Schnellerfassung-Sheet scrollt bei kleinem Display', () => {
  assert.match(css, /\.qsh>div\{[^}]*max-height:[^;]+;[^}]*overflow-y:auto/);
});

test('reduzierte Bewegung ist in CSS abgeschaltet', () => {
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\*\{animation:none!important/);
});

test('Texte: keine englischen Bedienbegriffe im Deutschen Oberfläche', () => {
  const forbidden = /Recurring|Fuck You|Save changes|Cancel\b/;
  assert.doesNotMatch(all, forbidden);
});

test('PWA: Manifest mit maskable-Icon und Namen', () => {
  const man = JSON.parse(read('manifest.webmanifest'));
  assert.ok(man.name && man.short_name);
  assert.ok(man.icons.some(i => /maskable/.test(i.purpose || '')), 'kein maskable-Icon');
});
