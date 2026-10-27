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
    // Auch Eingaben mit ${…} in den Attributen zählen: sie wurden früher übersprungen (Befund U-20, Nachabnahme)
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
  // ganze Wörter: Funktionsnamen wie autoRecurring zählen nicht als UI-Text
  const forbidden = /\bRecurring\b|Fuck You|Save changes|\bCancel\b/;
  assert.doesNotMatch(all, forbidden);
});

test('PWA: Manifest mit maskable-Icon und Namen', () => {
  const man = JSON.parse(read('manifest.webmanifest'));
  assert.ok(man.name && man.short_name);
  assert.ok(man.icons.some(i => /maskable/.test(i.purpose || '')), 'kein maskable-Icon');
});

test('Eingabefelder: Schrift mindestens 16 px (kein Zoom in iOS), auch inline', () => {
  assert.match(css, /input,select,textarea\{[^}]*font-size:16px/);
  const small = [];
  for (const m of all.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
    const f = m[0].match(/font-size:\s*(\d+)px/);
    if (f && Number(f[1]) < 16) small.push(m[0].slice(0, 90));
  }
  assert.deepEqual(small, [], 'Eingabefeld unter 16 px');
});

// Trefferflächen: Box-Maße aus der Probe bei 375 px (Kopfzeilen-Icon 28 × 25 px,
// Abschnittskopf-Span 15 px hoch, Chip 31 px hoch). Geprüft werden die Erweiterungen (::after) in CSS.
test('Kopfzeilen-Icons: Trefferfläche mindestens 44 px breit und hoch', () => {
  // ◉ reicht nach links, ☀ nach rechts; die Lücke dazwischen gehört keinem doppelt
  const four = '(-?\\d+)(?:px)? (-?\\d+)(?:px)? (-?\\d+)(?:px)? (-?\\d+)(?:px)?';
  const auge = css.match(new RegExp('\\.top \\.x:not\\(#th\\)::after\\{inset:' + four + '\\}'));
  const sonne = css.match(new RegExp('#th::after\\{inset:' + four + '\\}'));
  assert.ok(auge && sonne, 'Erweiterungen der Kopfzeilen-Icons fehlen');
  assert.ok(28 + Math.abs(Number(auge[4])) >= 44, '◉ zu schmal');
  assert.ok(28 + Math.abs(Number(sonne[2])) >= 44, '☀ zu schmal');
  assert.ok(25 + 2 * Math.abs(Number(auge[1])) >= 44, '◉ zu niedrig');
  assert.ok(25 + 2 * Math.abs(Number(sonne[1])) >= 44, '☀ zu niedrig');
});

// Die Rechnung aus dem CSS allein überschätzt die Fläche: Probe bei −15 px ergab 41 px (Ziel 44).
// Deshalb die gemessenen Werte als Grenze: Abschnittskopf −22 px (47 px), Chip −8 px (46 px).
test('Trefferflächen: Abschnittskopf und Chip mindestens 44 px hoch (Erweiterung je Seite)', () => {
  const h2 = css.match(/\.panel h2>span\[onclick\]::after\{content:"";position:absolute;inset:(-?\d+)px/);
  const chip = css.match(/\.chip::after\{content:"";position:absolute;inset:(-?\d+)px/);
  assert.ok(h2 && chip, 'Erweiterungen fehlen');
  assert.ok(Math.abs(Number(h2[1])) >= 22, 'Abschnittskopf: Erweiterung unter 22 px');
  assert.ok(Math.abs(Number(chip[1])) >= 8, 'Chip: Erweiterung unter 8 px');
});

test('Vorschau-Tabelle: bei 375 bis 430 px kleinere Schrift und Innenabstand, ab 431 px unverändert', () => {
  assert.match(js, /<table class="pvt">/);
  assert.match(css, /@media \(max-width:430px\)\{\.pvt:not\(\.cmp\)\{font-size:10px\}\.pvt:not\(\.cmp\) th,\.pvt:not\(\.cmp\) td\{padding:6px 4px\}/);
});

test('Kategorie-Farben: nur der ■-Marker ist farbig und aria-hidden, der Name steht in Textfarbe', () => {
  assert.doesNotMatch(js, /style="color:[^"]*">■[^<]/, 'Farbe und Text im selben Element');
  assert.doesNotMatch(js, /<i style="color:/, 'Marker als <i> ohne aria-hidden');
  assert.ok((js.match(/<span aria-hidden="true" style="color:/g) || []).length >= 3, 'Marker-Muster fehlt');
});
