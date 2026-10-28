const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');

// S-18: Die Nutzerkennung (S.uid) gehört nicht in die Export-Datei und wird beim Import ignoriert.
// Erfundene Beispieldaten.
const tx = (id) => ({ id, d: '2026-03-05', c: 'Lebensmittel', a: 10, n: 'Beispiel', r: null });
const neuesGeraet = () => loadApp({ now: '2026-10-28T10:00:00Z', tz: 'Europe/Berlin' });

test('Export enthält die Nutzerkennung nicht, der lokale Stand behält sie', () => {
  const app = neuesGeraet();
  app.h.S().uid = 'eigene-id';
  app.h.S().tx.push(tx('a'));
  const json = JSON.parse(app.evalApp('exportJson()'));
  assert.equal('uid' in json, false);
  assert.deepEqual(json.tx.map(x => x.id), ['a']);
  app.h.setTab('data');
  app.render();
  app.evalApp('exportBackup()');
  assert.equal('uid' in JSON.parse(app.doc.getElementById('bk').value), false, 'Textfeld des Exports');
  assert.equal(app.h.S().uid, 'eigene-id');
});

test('Import ignoriert eine Nutzerkennung aus der Datei', () => {
  const app = neuesGeraet();
  app.h.setTab('data');
  app.render();
  app.doc.getElementById('bk').value = JSON.stringify({ uid: 'fremde-id', tx: [tx('ok')] });
  app.evalApp('importBackup()');
  assert.match(app.alerts.join('\n'), /Import erfolgreich/);
  assert.deepEqual(Array.from(app.h.S().tx.map(x => x.id)), ['ok']);
  assert.equal(app.h.S().uid, undefined, 'fremde Kennung nicht übernommen');
});
