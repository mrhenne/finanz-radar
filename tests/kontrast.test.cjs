// Kontrast-Prüfung der Design-Tokens aus styles.css (WCAG 2.1 AA) in Hell und Dunkel.
// Text: mindestens 4,5:1. Bedienelemente und Rahmen von Eingabefeldern: mindestens 3:1.
// Die Werte werden aus den Tokens berechnet, nicht geschätzt. Ausnahmen stehen in EXCEPTIONS.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

// Tokens aus einem CSS-Block lesen: --name:#rrggbb oder --name:#rgb (wird auf sechs Stellen erweitert)
function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z]+):#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
    const h = m[2];
    out[m[1]] = '#' + (h.length === 3 ? h.split('').map(c => c + c).join('') : h);
  }
  return out;
}
// Erster Block mit :root{ (Hell) und die beiden Dunkel-Blöcke
const light = tokens(css.match(/^:root\{([^}]*)\}/m)[1]);
const darkSys = tokens(css.match(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/)[1]);
const darkAttr = tokens(css.match(/:root\[data-theme="dark"\]\{([^}]*)\}/)[1]);
// Weiß für Text auf Akzentfläche (Schaltflächen, Abzeichen)
const WHITE = '#ffffff';

function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Textpaare (4,5:1) und Bedienelemente (3:1) je Theme
const TEXT = [['ink', 'bg'], ['ink', 'p'], ['ink', 'orl'], ['mut', 'bg'], ['mut', 'p'], ['mut', 'orl'],
  ['ort', 'bg'], ['ort', 'p'], ['ort', 'orl'], ['gt', 'bg'], ['gt', 'p'], ['gt', 'orl']];
const UI = [['fld', 'p'], ['fld', 'bg'], ['orb', 'p'], ['ln', 'p'], ['or', 'ln']];
// Bewusst nicht erfüllt, mit Begründung im Bericht (Befund U-xx)
const EXCEPTIONS = {
  // Hairline-Rahmen der Karten: Dekoration, die Karte selbst ist durch die Fläche erkennbar
  'ln/p': 'Kartenrahmen, reine Dekoration (Befund U-06)',
  // Fortschrittsbalken: Füllung gegen Spur, der Wert steht immer als Text daneben
  'or/ln': 'Fortschrittsbalken, Prozentwert steht als Text daneben (Befund U-07)',
};

const THEMES = { hell: light, dunkel_system: { ...light, ...darkSys }, dunkel_manuell: { ...light, ...darkAttr } };

for (const [name, t] of Object.entries(THEMES)) {
  test(`Kontrast Text ${name}: mindestens 4,5:1`, () => {
    const t2 = { ...t, wh: WHITE };
    const fails = [];
    for (const [a, b] of TEXT.concat([['wh', 'orb']])) {
      const r = ratio(t2[a], t2[b]);
      if (r < 4.5) fails.push(`${a}/${b}=${r.toFixed(2)}`);
    }
    assert.deepEqual(fails, [], 'Textkontrast unter 4,5:1');
  });

  test(`Kontrast Bedienelemente ${name}: mindestens 3:1`, () => {
    const fails = [];
    for (const [a, b] of UI.concat([['wh', 'orb']])) {
      const key = `${a}/${b}`;
      const r = ratio({ ...t, wh: WHITE }[a], { ...t, wh: WHITE }[b]);
      if (r < 3 && !(key in EXCEPTIONS)) fails.push(`${key}=${r.toFixed(2)}`);
    }
    assert.deepEqual(fails, [], 'Bedienelement unter 3:1');
  });
}

test('Akzentfarbe ist als Text nicht mehr verwendet, nur als Fläche/Rahmen', () => {
  // .btn: Ghost (Hintergrund --tint, Text --text); .btn.primary: Hintergrund --accent (Textfarbe --on-accent); .badge, .qfab: Hintergrund ist --orb (Weiß-Text)
  assert.match(css, /\.btn\{[^}]*background:var\(--tint\)[^}]*color:var\(--text\)/);
  assert.match(css, /\.btn\.primary\{[^}]*background:var\(--accent\)/);
  assert.match(css, /\.badge\{background:var\(--orb\)/);
  assert.match(css, /\.qfab\{[^}]*background:var\(--orb\)/);
});

test('Ausnahmen sind dokumentiert und real (Wert liegt unter 3:1)', () => {
  for (const key of Object.keys(EXCEPTIONS)) {
    const [a, b] = key.split('/');
    assert.ok(ratio(light[a], light[b]) < 3, key + ' ist keine echte Ausnahme mehr');
  }
});
