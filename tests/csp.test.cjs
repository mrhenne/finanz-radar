'use strict';
// Teil B (Phase 6): Content-Security-Policy in vercel.json. Kein 'unsafe-inline' mehr bei script-src,
// keine Inline-Handler (script-src-attr 'none'). style-src behält 'unsafe-inline' (ca. 150 style-Attribute, dokumentiertes Restrisiko).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rule = cfg.headers.find(h => h.source === '/(.*)');
const csp = rule.headers.find(h => h.key === 'Content-Security-Policy').value;
const direktiven = Object.fromEntries(csp.split(';').map(x => x.trim()).filter(Boolean).map(x => {
  const [name, ...werte] = x.split(/\s+/);
  return [name, werte];
}));

test('script-src: nur eigene Dateien und der Supabase-CDN, ohne unsafe-inline und unsafe-eval', () => {
  assert.deepEqual(direktiven['script-src'], ["'self'", 'https://cdn.jsdelivr.net']);
});

test('script-src-attr: Inline-Ereignisattribute sind gesperrt', () => {
  assert.deepEqual(direktiven['script-src-attr'], ["'none'"]);
});

test('style-src: unsafe-inline bleibt (Restrisiko, siehe Bericht 14.4)', () => {
  assert.deepEqual(direktiven['style-src'], ["'self'", "'unsafe-inline'"]);
});

test('übrige Direktiven unverändert: keine Objekte, keine Einbettung, nur eigene Formulare', () => {
  assert.deepEqual(direktiven['default-src'], ["'self'"]);
  assert.deepEqual(direktiven['object-src'], ["'none'"]);
  assert.deepEqual(direktiven['base-uri'], ["'none'"]);
  assert.deepEqual(direktiven['frame-ancestors'], ["'none'"]);
  assert.deepEqual(direktiven['form-action'], ["'self'"]);
  assert.deepEqual(direktiven['img-src'], ["'self'", 'data:']);
  assert.ok(direktiven['connect-src'].includes('https://api.coingecko.com'));
  assert.ok(direktiven['connect-src'].includes('https://fbrzcvhoeqoqonxkyhrl.supabase.co'));
});

test('index.html hat keinen Inline-Skriptblock (script-src ohne unsafe-inline bleibt lauffähig)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) assert.match(m[1], /\bsrc=/, 'Inline-Skript in index.html');
});
