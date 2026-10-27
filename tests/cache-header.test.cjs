const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 6.2 (Phase 5): Cache-Regeln in vercel.json. Code und HTML müssen nach einem Deploy neu geprüft werden,
// Icons und Splash-Bilder dürfen länger gecacht werden. Jede Code-Datei im Wurzelverzeichnis braucht eine Regel.
const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rules = cfg.headers.filter(h => h.headers.some(x => x.key === 'Cache-Control'));
const cacheOf = src => {
  const r = rules.find(h => h.source === src);
  return r ? r.headers.find(x => x.key === 'Cache-Control').value : null;
};

test('jede Code-Datei im Wurzelverzeichnis ist must-revalidate', () => {
  // sw.js hat eine eigene Regel (no-cache, Test unten)
  const files = fs.readdirSync(ROOT).filter(f => /\.(js|css|html|webmanifest)$/.test(f) && f !== 'sw.js');
  assert.ok(files.length >= 6, 'Dateien gefunden');
  for (const f of files) {
    const v = cacheOf('/' + f);
    assert.ok(v && /must-revalidate/.test(v) && /max-age=0/.test(v), `${f}: keine must-revalidate-Regel (${v})`);
  }
  assert.match(cacheOf('/'), /must-revalidate/, 'Startseite /');
});

test('Icons und Splash-Bilder sind langlebig gecacht', () => {
  const minAge = v => Number((v || '').match(/max-age=(\d+)/)?.[1] || 0);
  for (const src of ['/icon-180.png', '/icon-512.png', '/splash/(.*)']) {
    assert.ok(minAge(cacheOf(src)) >= 86400, `${src}: max-age mindestens 1 Tag`);
  }
});

test('sw.js wird nie gecacht', () => {
  assert.match(cacheOf('/sw.js'), /no-cache/);
});
