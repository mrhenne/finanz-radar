const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// B-19: Zins (r) und Rate (rate) beim Import prüfen, beim Export und im Sync-Vergleich mitführen.
// Erfundene Beispielwerte. Ungültige Felder werden entfernt und im Import-Ergebnis gemeldet (S-17).
const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin' });
const bericht = () => ({ uebernommen: 0, verworfen: {}, korrigiert: {} });
const streng = debts => {
  app.ctx.raw = { debts };
  app.ctx.rep = bericht();
  const st = JSON.parse(JSON.stringify(app.evalApp('normalizeImportedState(raw, rep)')));
  return { debts: st.debts, rep: JSON.parse(JSON.stringify(app.ctx.rep)) };
};
const schuld = (extra = {}) => ({ id: 'd1', n: 'Kredit', a: 10000, ...extra });

test('gültige Zins- und Rate-Felder bleiben unverändert, keine Meldung', () => {
  const { debts, rep } = streng([schuld({ r: 5, rate: 300 })]);
  assert.equal(debts[0].r, 5);
  assert.equal(debts[0].rate, 300);
  assert.equal(rep.uebernommen, 1);
  assert.deepEqual(rep.korrigiert, {});
});

test('Zins über 100 wird entfernt, der Datensatz bleibt und wird als korrigiert gemeldet', () => {
  const { debts, rep } = streng([schuld({ r: 150, rate: 300 })]);
  assert.equal(debts.length, 1);
  assert.equal('r' in debts[0], false);
  assert.equal(debts[0].rate, 300);
  assert.deepEqual(rep.korrigiert, { 'Zins ungültig, Feld entfernt': 1 });
  assert.equal(rep.uebernommen, 1);
});

test('Zins als Text mit Komma wird übernommen und gemeldet', () => {
  const { debts, rep } = streng([schuld({ r: '5,5' })]);
  assert.equal(debts[0].r, 5.5);
  assert.deepEqual(rep.korrigiert, { 'Textbetrag als Zahl übernommen': 1 });
});

test('Zins negativ, Text oder null: Feld entfernt', () => {
  for (const r of [-1, 'abc', null]) {
    const { debts, rep } = streng([schuld({ r })]);
    assert.equal('r' in debts[0], false, 'Zins ' + r);
    assert.deepEqual(rep.korrigiert, { 'Zins ungültig, Feld entfernt': 1 });
  }
});

test('Rate negativ oder über dem Höchstbetrag: Feld entfernt', () => {
  for (const rate of [-300, 2e9]) {
    const { debts, rep } = streng([schuld({ rate })]);
    assert.equal('rate' in debts[0], false, 'Rate ' + rate);
    assert.deepEqual(rep.korrigiert, { 'Rate ungültig, Feld entfernt': 1 });
  }
});

test('Rate 0 ist gültig (keine Tilgung), keine Meldung', () => {
  const { debts, rep } = streng([schuld({ rate: 0 })]);
  assert.equal(debts[0].rate, 0);
  assert.deepEqual(rep.korrigiert, {});
});

test('fehlende Felder bleiben fehlend und werden nicht auf 0 gesetzt', () => {
  const { debts, rep } = streng([schuld()]);
  assert.equal('r' in debts[0], false);
  assert.equal('rate' in debts[0], false);
  assert.deepEqual(rep.korrigiert, {});
});

test('ungültiger Betrag verwirft den Datensatz, auch wenn Zins und Rate gültig sind', () => {
  const { debts, rep } = streng([{ id: 'd2', n: 'Ohne Betrag', r: 5, rate: 300 }]);
  assert.equal(debts.length, 0);
  assert.equal(rep.verworfen['Betrag fehlt'], 1);
});

test('Start aus dem lokalen Stand: ungültige Felder werden still entfernt, Datensatz bleibt', () => {
  app.ctx.raw = { debts: [schuld({ r: 150, rate: -1 }), schuld({ id: 'd2', r: 5, rate: 300 })] };
  const st = JSON.parse(JSON.stringify(app.evalApp('normalizeImportedState(raw)')));
  assert.equal(st.debts.length, 2);
  assert.equal('r' in st.debts[0], false);
  assert.equal('rate' in st.debts[0], false);
  assert.equal(st.debts[1].r, 5);
  assert.equal(st.debts[1].rate, 300);
});

test('Export enthält Zins und Rate je Schuld', () => {
  app.ctx.S0 = { tx: [], as: [], goals: [], rec: [], debts: [schuld({ r: 5, rate: 300 })], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } };
  app.h.setS(app.ctx.S0);
  const ex = JSON.parse(app.evalApp('exportJson()'));
  assert.equal(ex.debts[0].r, 5);
  assert.equal(ex.debts[0].rate, 300);
});

test('Export, Import und Export: Zins und Rate bleiben erhalten (Rundlauf)', () => {
  app.h.setS(app.ctx.S0);
  const ex = app.evalApp('exportJson()');
  app.ctx.raw = JSON.parse(ex);
  app.ctx.rep = bericht();
  const st = JSON.parse(JSON.stringify(app.evalApp('normalizeImportedState(raw, rep)')));
  assert.equal(st.debts[0].r, 5);
  assert.equal(st.debts[0].rate, 300);
  assert.deepEqual(JSON.parse(JSON.stringify(app.ctx.rep)).korrigiert, {});
});

test('Sync-Vergleich: Zins oder Rate ändern den Fachdaten-Stand, Schlüsselreihenfolge nicht', () => {
  app.ctx.A = { debts: [schuld({ r: 5, rate: 300 })] };
  app.ctx.B = { debts: [schuld({ r: 6, rate: 300 })] };
  app.ctx.C = { debts: [{ rate: 300, r: 5, a: 10000, n: 'Kredit', id: 'd1' }] };
  assert.equal(app.evalApp('sameData(A, B)'), false, 'anderer Zins');
  assert.equal(app.evalApp('sameData(A, C)'), true, 'nur Reihenfolge der Schlüssel');
  app.ctx.D = { debts: [schuld({ r: 5 })] };
  assert.equal(app.evalApp('sameData(A, D)'), false, 'Rate fehlt');
});
