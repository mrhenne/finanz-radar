const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const extras = fs.readFileSync('extras.js', 'utf8');
const start = extras.indexOf('const IMP = { rows: []');
const end = extras.indexOf('W.impUndo = ');
assert.ok(start > 0 && end > start, 'CSV import functions must stay in extras.js');

function load(tx = []) {
  const ctx = {
    S: { tx }, IN: ['Gehalt', 'Nebenjob', 'Sonstige Einnahmen'],
    suggestCat: () => '', clean: s => String(s || '').replace(/[<>&"]/g, ''),
    pad: n => String(n).padStart(2, '0'), W: {}, TextDecoder, Math, Date,
  };
  vm.runInNewContext(extras.slice(start, end) + '\nthis.api={IMP,importText,parseDate,parseAmount,parseCSV};', ctx, { timeout: 2000 });
  return ctx.api;
}

test('parseDate accepts real calendar dates in the three supported formats', () => {
  const { parseDate } = load();
  assert.equal(parseDate('2026-02-28'), '2026-02-28');
  assert.equal(parseDate('28.02.2026'), '2026-02-28');
  assert.equal(parseDate('1.3.26'), '2026-03-01');
  assert.equal(parseDate('29.02.2028'), '2028-02-29');
});

test('parseDate rejects days that do not exist', () => {
  const { parseDate } = load();
  assert.equal(parseDate('31.02.2026'), null);
  assert.equal(parseDate('29.02.2026'), null);
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('00.01.2026'), null);
  assert.equal(parseDate(''), null);
});

test('parseAmount reads German and English number formats and negatives', () => {
  const { parseAmount } = load();
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('-12,5'), -12.5);
  assert.equal(parseAmount('12,5 €'), 12.5);
  assert.equal(parseAmount('(12,50)'), -12.5);
  assert.equal(parseAmount('1234.56'), 1234.56);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
});

test('importText detects semicolon delimiter, skips bad rows and reports them', () => {
  const api = load();
  const text = '﻿Buchungstag;Verwendungszweck;Betrag\n' +
    '05.01.2026;"REWE Markt; Berlin";-23,40\n' +
    '31.02.2026;Ungültiges Datum;-5,00\n' +
    '06.01.2026;Gehalt;2.500,00\n';
  assert.equal(api.importText(text), 2);
  assert.equal(api.IMP.rows[0].n, 'REWE Markt; Berlin');
  assert.equal(api.IMP.rows[0].a, 23.4);
  assert.match(api.IMP.info, /1 übersprungen/);
});

test('importText tells the user when more than 1500 rows were not read', () => {
  const lines = ['Datum;Betrag;Text'];
  for (let i = 0; i < 1600; i++) lines.push('01.01.2026;-1,00;Zeile ' + i);
  const api = load();
  assert.equal(api.importText(lines.join('\n')), 1500);
  assert.match(api.IMP.info, /Nur die ersten 1500 Zeilen wurden gelesen, 100 weitere nicht/);
});

test('importText without the limit does not claim truncation', () => {
  const api = load();
  api.importText('Datum;Betrag\n01.01.2026;-1,00\n');
  assert.doesNotMatch(api.IMP.info, /weitere nicht/);
});
