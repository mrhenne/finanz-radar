const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

// B-19: Anzeige, Eingabe und Bearbeiten von Schulden mit Zins und Rate. Erfundene Beispielwerte.
// Die Fixture small.json bleibt unverändert (Regressionssnapshot). Hier wird eine Kopie mit Zins und Rate verwendet.
const small = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
const mit = debts => Object.assign(JSON.parse(JSON.stringify(small)), { debts });
const NOW = '2026-10-26T10:00:00Z';
// Text ohne Tags (blurHtml setzt Zahlen in <span class="n">)
const text = h => h.replace(/<[^>]+>/g, '');
const schuldenAnsicht = app => { app.h.setTab('assets'); return text(app.render()); };

test('Schuld mit Zins und Rate: Laufzeit, Ende, Zinsen und Restschuld in der Ansicht', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: mit([{ id: 'd1', n: 'Fixture Kredit', a: 10000, r: 5, rate: 300 }]) });
  const t = schuldenAnsicht(app);
  assert.ok(t.includes('Zins 5 % p. a., Rate 300 € im Monat'), 'Kopfzeile');
  assert.ok(t.includes('Laufzeit 3 Jahre, Ende Oktober 2029'), 'Laufzeit und Ende');
  assert.ok(t.includes('Zinsen bis zum Ende 789 €'), 'Gesamtzins');
  assert.ok(t.includes('Restschuld in 12 Monaten 6.828 €'), 'Restschuld nach 12 Monaten');
});

test('Schuld mit Rate unter dem Zins: Warnhinweis statt Laufzeit, keine Zahl NaN oder Infinity', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: mit([{ id: 'd1', n: 'Zinsfalle', a: 10000, r: 6, rate: 40 }]) });
  const t = schuldenAnsicht(app);
  assert.ok(t.includes('Die Rate deckt die Zinsen nicht (50 € im Monat). Die Schuld wächst.'));
  assert.ok(!t.includes('Laufzeit 3'), 'keine Laufzeit bei zu kleiner Rate');
  assert.doesNotMatch(t, /NaN|Infinity/);
});

test('Schuld mit Zins 0 und Rate 0: Hinweis „keine Rate“, keine Laufzeit', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: mit([{ id: 'd1', n: 'Ohne Rate', a: 1000, r: 0, rate: 0 }]) });
  const t = schuldenAnsicht(app);
  assert.ok(t.includes('Keine Rate eingetragen, daher keine Laufzeit'));
});

test('Sehr lange Laufzeit: „länger als 100 Jahre“, ohne Ende und Gesamtzins', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: mit([{ id: 'd1', n: 'Lang', a: 10000, r: 6, rate: 50.1 }]) });
  const t = schuldenAnsicht(app);
  assert.ok(t.includes('Laufzeit länger als 100 Jahre'));
  assert.ok(!t.includes('Zinsen bis zum Ende'));
  assert.ok(t.includes('Restschuld in 12 Monaten'));
});

test('alte Schulden ohne Zins und Rate: keine Zusatzzeilen', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: small });
  const t = schuldenAnsicht(app);
  assert.ok(t.includes('Fixture Kredit'));
  // Der Hinweistext im Eingabeblock nennt „Laufzeit“ ohne Zahl; geprüft werden nur die Anzeigezeilen
  assert.doesNotMatch(t, /Laufzeit \d|länger als 100|Zinsen bis zum Ende|Restschuld in 12 Monaten \d|Zins \d/);
});

test('Eingabe: Zins und Rate werden übernommen, Ansicht zeigt die Laufzeit', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: small });
  schuldenAnsicht(app);
  app.el('dn').value = 'Neuer Kredit';
  app.el('da').value = '10000';
  app.el('dz').value = '5';
  app.el('dr').value = '300';
  app.evalApp('addDebt()');
  const d = app.h.S().debts[app.h.S().debts.length - 1];
  assert.equal(d.n, 'Neuer Kredit');
  assert.equal(d.r, 5);
  assert.equal(d.rate, 300);
  assert.ok(text(app.view()).includes('Laufzeit 3 Jahre, Ende Oktober 2029'));
});

test('Eingabe: leere Zins- und Rate-Felder fehlen im Datensatz', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: small });
  schuldenAnsicht(app);
  app.el('dn').value = 'Ohne Zins';
  app.el('da').value = '500';
  app.el('dz').value = '';
  app.el('dr').value = '';
  app.evalApp('addDebt()');
  const d = app.h.S().debts[app.h.S().debts.length - 1];
  assert.equal(d.n, 'Ohne Zins');
  assert.equal('r' in d, false);
  assert.equal('rate' in d, false);
});

test('Eingabe: ungültige Zahl wird mit deutscher Meldung abgewiesen, nichts gespeichert', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: small });
  schuldenAnsicht(app);
  const vorher = app.h.S().debts.length;
  const fall = [['150', '', 'Zins bitte als Zahl von 0 bis 100 eingeben (% p. a.).'], ['5', '-3', 'Rate bitte als Zahl ab 0 eingeben (Euro je Monat).'], ['abc', '', 'Zins bitte als Zahl von 0 bis 100 eingeben (% p. a.).']];
  for (const [z, r, msg] of fall) {
    app.el('dn').value = 'Fehler';
    app.el('da').value = '1000';
    app.el('dz').value = z;
    app.el('dr').value = r;
    app.evalApp('addDebt()');
    assert.equal(app.h.S().debts.length, vorher, 'nichts gespeichert: ' + z + '/' + r);
    assert.equal(app.el('dfehl').textContent, msg);
  }
});

test('Eingabe: Komma als Dezimaltrenner wird akzeptiert', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: small });
  schuldenAnsicht(app);
  app.el('dn').value = 'Komma';
  app.el('da').value = '1000';
  app.el('dz').value = '4,5';
  app.el('dr').value = '100';
  app.evalApp('addDebt()');
  assert.equal(app.h.S().debts[app.h.S().debts.length - 1].r, 4.5);
});

test('Bearbeiten: Zins und Rate setzen, leer lassen entfernt die Felder, ungültig meldet', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: mit([{ id: 'd1', n: 'Fixture Kredit', a: 4000 }]) });
  app.h.setTab('assets');
  app.h.setEd({ k: 'debts', id: 'd1' });
  app.render();
  app.el('ef2').value = '5';
  app.el('ef3').value = '300';
  app.evalApp('edSave()');
  let d = app.h.S().debts[0];
  assert.equal(d.r, 5);
  assert.equal(d.rate, 300);

  app.h.setEd({ k: 'debts', id: 'd1' });
  app.render();
  app.el('ef2').value = 'abc';
  app.el('ef3').value = '300';
  app.evalApp('edSave()');
  assert.equal(app.h.S().debts[0].r, 5, 'ungültiger Wert ändert nichts');
  assert.equal(app.el('edfehl').textContent, 'Zins bitte als Zahl von 0 bis 100 eingeben (% p. a.).');

  app.h.setEd({ k: 'debts', id: 'd1' });
  app.render();
  app.el('ef2').value = '';
  app.el('ef3').value = '';
  app.evalApp('edSave()');
  d = app.h.S().debts[0];
  assert.equal('r' in d, false, 'leer entfernt das Feld');
  assert.equal('rate' in d, false);
  assert.equal(d.a, 4000, 'Betrag unverändert');
});

test('Eingabefelder der Schulden haben Namen (label for oder aria-label), Textfeld mit Dezimaltastatur', () => {
  const app = loadApp({ now: NOW, tz: 'Europe/Berlin', fixture: small });
  app.h.setTab('assets');
  const h = app.render();
  for (const id of ['dz', 'dr']) {
    assert.match(h, new RegExp('<label for="' + id + '">'), 'Beschriftung ' + id);
    assert.match(h, new RegExp('<input id="' + id + '" aria-label="[^"]+" type="text" inputmode="decimal"'), 'Feld ' + id);
  }
});
