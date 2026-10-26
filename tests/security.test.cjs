const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const boost = fs.readFileSync('boost.js', 'utf8');
const features = fs.readFileSync('features.js', 'utf8');
const slice = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

// esc() (Ausgabe, HTML-Text und Attribute) und clean() (Speicherformat) aus app.js laden
const escCtx = {};
vm.runInNewContext(slice(app, 'const esc=', 'const IN=') + '\nthis.esc=esc;this.clean=clean;', escCtx, { timeout: 1000 });
const { esc, clean } = escCtx;

const PAYLOADS = [
  '"><img src=x onerror=alert(1)>',
  "x' onmouseover='alert(1)",
  "');alert(1);//",
  '`${alert(1)}`',
  '<svg onload=alert(1)>',
  '&lt;script&gt;',
  "Lidl's \"Angebot\" & Co",
];

// Entschlüsselt genau die Entitäten, die esc() erzeugt (wie der HTML-Parser beim Attributwert).
const decode = s => s.replace(/&quot;|&#39;|&#96;|&lt;|&gt;|&amp;/g, m => ({ '&quot;': '"', '&#39;': "'", '&#96;': '`', '&lt;': '<', '&gt;': '>', '&amp;': '&' })[m]);

test('esc() neutralises markup, attribute and JS-string breakouts', () => {
  for (const p of PAYLOADS) assert.doesNotMatch(esc(p), /[<>"'`]/, p);
  assert.equal(esc('Tom & Jerry'), 'Tom &amp; Jerry');
  assert.equal(esc("it's"), 'it&#39;s');
  assert.equal(esc(''), '');
  assert.equal(esc(undefined), '');
});

test('escaped text decodes back to the original (no data change for display)', () => {
  for (const p of PAYLOADS) assert.equal(decode(esc(p)), p);
});

test('histHTML data-pts attribute cannot be broken out of (imported month value with quote)', () => {
  const payload = "x' onmouseover='alert(1)//";
  const json = JSON.stringify([[payload, 5]]);
  const tag = '<svg data-pts="' + esc(json) + '">';
  const value = tag.slice(tag.indexOf('"') + 1, tag.lastIndexOf('"'));
  assert.doesNotMatch(value, /["']/);
  assert.deepEqual(JSON.parse(decode(value)), [[payload, 5]]);
  assert.match(app, /data-pts="\$\{esc\(JSON\.stringify\(H\.map\(x=>\[x\.m,x\.nw\]\)\)\)\}"/);
  assert.doesNotMatch(app, /data-pts='\$\{JSON\.stringify\(H/);
});

test('clean() keeps the stored text format of earlier versions', () => {
  assert.equal(clean('Haus & Hof <img>'), 'Haus  Hof img');
  assert.equal(clean("Lidl's"), "Lidl's");
  assert.equal(clean(null), '');
});

test('imported portfolio-passive items get safe IDs (piDel handler is built from the ID)', () => {
  const ctx = { uid: () => 'gen_1' };
  vm.runInNewContext(slice(app, 'function sanitizeImportedValue', '\ntry{const j=localStorage') + '\nthis.n=normalizeImportedState;', ctx, { timeout: 1000 });
  const st = JSON.parse(JSON.stringify(ctx.n({ pi: { items: [{ id: "x');alert(1);//", d: '2026-01-01', a: 5 }] } })));
  assert.equal(st.pi.items[0].id, 'gen_1');
});

test('source keeps the escaped handler and label forms', () => {
  assert.match(boost, /onclick="piDel\(' \+ esc\(JSON\.stringify\(x\.id\)\) \+ '\)"/);
  assert.match(boost, /<span style="flex:1">' \+ esc\(k\) \+ '<\/span>/);
  assert.match(features, /\+ ' ' \+ esc\(x\[0\]\) \+ '<\/span><b>'/);
  assert.match(app, /const clean=s=>/);
});
