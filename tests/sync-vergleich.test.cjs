const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');
const { makeServer, makeClient } = require('./harness/fake-supabase.cjs');

// A1-Nachbesserung: Der Konflikt-Vergleich zählt nur Fachdaten. Reine Darstellung (th, ui, hide) löst keinen Dialog aus.
// Erfundene Beispieldaten, feste Zeitpunkte über setNow.
const EMAIL = 'a@example.test', PW = 'geheim123';
const T = { t0: '2026-10-26T10:00:00Z', t2: '2026-10-26T10:10:00Z', t3: '2026-10-26T10:15:00Z' };
const tx = (id, a) => ({ id, d: '2026-10-05', c: 'Lebensmittel', a, n: 'Beispiel ' + id, r: null });

function device(server, now, storage) {
  return loadApp({ now, tz: 'Europe/Berlin', storage, supabase: makeClient(server) });
}
async function login(app) {
  await app.settle();
  app.render();
  app.doc.getElementById('le').value = EMAIL;
  app.doc.getElementById('lp').value = PW;
  await app.ctx.login(false);
  await app.settle();
}
const addTx = (app, t) => { const s = app.h.S(); s.tx.push(t); app.h.setS(s); app.ctx.save(); };
const konfliktOffen = app => /id="kf"/.test(app.render());
const pausiert = app => /Synchronisierung pausiert|Cloud-Stand ist neuer/.test(app.render());

/* Zwei Geräte, beide offline mit gleichem Startstand. B ändert danach nur das, was B anders macht (Callback). */
async function zwei(bAendern) {
  const server = makeServer();
  server.addUser(EMAIL, PW);
  const A = device(server, T.t0); await login(A);
  const B = device(server, T.t0); await login(B);
  server.offline = true;
  addTx(A, tx('gleich', 7));
  addTx(B, tx('gleich', 7));
  bAendern(B);
  await A.settle();
  await B.settle();
  server.offline = false;
  A.setNow(T.t2); await A.ctx.push();
  B.setNow(T.t3); await B.ctx.push();
  return { server, A, B };
}

test('nur Darstellung unterschiedlich (th, ui, hide): kein Konfliktdialog, Cloud-Stand wird übernommen', async () => {
  const { B } = await zwei(b => b.evalApp("S.th='dark';S.hide=true;S.ui.c['x']=true;S.ui.o['y']=[];save()"));
  assert.equal(konfliktOffen(B), false, 'kein Dialog');
  assert.doesNotMatch(B.render(), /Synchronisierung pausiert|Cloud-Stand ist neuer/);
  assert.deepEqual(Array.from(B.h.S().tx.map(x => x.id)), ['gleich']);
  assert.equal(B.h.sync().syncOk, true, 'Stand aus der Cloud übernommen');
});

test('Fachdaten unterschiedlich (Einstellung f): Konfliktdialog erscheint', async () => {
  const { B } = await zwei(b => b.evalApp("S.f.r=9;save()"));
  assert.ok(konfliktOffen(B), 'Dialog offen');
  assert.equal(B.h.sync().syncOk, false);
});

test('Fachdaten unterschiedlich (Buchung): Konfliktdialog erscheint', async () => {
  const { B } = await zwei(b => addTx(b, tx('nur-b', 2)));
  assert.ok(konfliktOffen(B), 'Dialog offen');
});

test('sameData: Darstellung ignoriert, Fachdaten zählen, Schlüsselreihenfolge egal', async () => {
  const server = makeServer();
  const A = device(server, T.t0);
  const same = A.evalApp("sameData({tx:[{id:'1',a:1}],f:{r:6},th:'light',ui:{c:{}},hide:false,ts:5,uid:'x'},{f:{r:6},tx:[{a:1,id:'1'}],th:'dark',ui:{c:{k:1}},hide:true,ts:9,uid:'y'})");
  assert.equal(same, true);
  const diff = A.evalApp("sameData({tx:[{id:'1',a:1}]},{tx:[{id:'1',a:2}]})");
  assert.equal(diff, false);
});
