/* Finanz-Radar Erweiterungen. Geladen nach app.js. */
(function () {
  'use strict';
  const W = window, $ = id => document.getElementById(id);
  const css = '.lk{position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:20px}.dots{display:flex;gap:12px}.dots i{width:14px;height:14px;border:1px solid var(--or);border-radius:50%}.dots i.f{background:var(--or)}.pad{display:grid;grid-template-columns:repeat(3,76px);gap:10px}.pad button{height:56px;font:inherit;font-size:20px;background:var(--p);border:1px solid var(--ln);color:var(--ink);border-radius:0}.pad button:active{background:var(--orl)}.mini{width:90px!important;padding:4px 6px!important;font-size:16px!important}';
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const num = s => { s = String(s == null ? '' : s).replace(/[^\d,.\-+]/g, ''); if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); return parseFloat(s); };
  const monthNow = () => ymOf();
  const card = (t, h) => P('[' + t + ']', h);
  const button = (k, label) => '<button class="btn o" style="text-align:left" onclick="tab=\'' + k + '\';render();scrollTo(0,0)">' + label + '</button>';

  TABS.find(t => t[0] === 'fire')[1] = 'Fuck Off';
  TT.fire = 'Fuck Off';
  ['review', 'rebal', 'csv', 'sec'].forEach(k => { if (!SUB.includes(k)) SUB.push(k); });
  Object.assign(TT, { review: 'Rückblick', rebal: 'Rebalancing', csv: 'CSV-Import', sec: 'Sicherheit' });
  V.more = () => card('Module', [
    ['review','Monatsrückblick'], ['year','Jahresübersicht'], ['port','Portfolio & Risiko'],
    ['rebal','Rebalancing'], ['crypto','Krypto'], ['goals','Ziele & Sparrate'],
    ['tax','Steuer-Übersicht'], ['csv','CSV-Import'], ['sec','Sicherheit & PIN'],
    ['acct','Konto & Synchronisierung'], ['data','Daten & Backup']
  ].map(x => button(x[0], x[1])).join(''));

  /* Fuck-Off-Level und Runway */
  const liquid = () => S.as.filter(a => ['cash','etf','aktie','crypto','gold'].includes(a.k)).reduce((s,a) => s + val(a), 0);
  const runway = () => { const f = fixk(); return f > 0 ? liquid() / f : 0; };
  let runway5Edit = false;
  function levelsHTML() {
    const r = runway(), f = fixk(), target = fireF(), net = nn();
    const customTarget = Number(S.f.runway5Target) > 0 ? Number(S.f.runway5Target) : 120*f;
    const customName = typeof S.f.runway5Name === 'string' && S.f.runway5Name.trim() ? S.f.runway5Name.trim() : 'Stufe 5 · Eigenes Ziel';
    const levels = [['Stufe 1 · 3 Monate Puffer', 3*f], ['Stufe 2 · 1 Jahr Freiheit', 12*f], ['Stufe 3 · 5 Jahre Freiheit', 60*f], ['Stufe 4 · Fuck-Off-Zahl', target], [customName, customTarget]];
    const have = i => i < 3 ? liquid() : net;
    const done = levels.map((x,i) => x[1] > 0 && have(i) >= x[1]), current = done.indexOf(false);
    let html = '<div class="k big"><b>' + r.toFixed(1).replace('.', ',') + ' Monate</b><span>Runway bei Fixkosten von ' + eur(f) + ' / Monat</span></div>';
    html += levels.map((x,i) => {
      const p = x[1] > 0 ? Math.min(100, have(i) / x[1] * 100) : 0;
      const y = (i === current && x[1] > 0) ? simYears(have(i), avg().s, S.f.r, x[1]) : null;
      return '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between"><span>' + (done[i]?'✓':i===current?'▶':'○') + ' ' + esc(x[0]) + '</span><b>' + eur(x[1]) + '</b></div><div class="bar"><i style="width:' + p + '%"></i></div><div class="mut">' + (done[i]?'erreicht':pct(p) + ' · noch ' + eur(Math.max(0,x[1]-have(i))) + (y != null ? ' · ca. ' + y.toFixed(1).replace('.', ',') + ' Jahre' : '')) + '</div></div>';
    }).join('');
    html += runway5Edit
      ? '<div class="hatch"></div><label>Stufe 5 · Bezeichnung</label><input aria-label="Stufe 5 Bezeichnung" id="r5n" value="' + esc(customName) + '" maxlength="80"><label>Stufe 5 · Zielbetrag € (Standard: 10 Jahre Fixkosten)</label><input aria-label="Stufe 5 Zielbetrag in Euro" id="r5t" type="number" inputmode="decimal" value="' + customTarget + '"><button class="btn o" onclick="saveRunway5()">Stufe 5 speichern</button><button class="btn o" onclick="cancelRunway5()">Abbrechen</button>'
      : '<div class="hatch"></div><button class="btn o" onclick="editRunway5()">✎ Stufe 5 bearbeiten</button>';
    return card('Runway · Fuck-Off-Level', html + '<div class="note">Runway ist eine grobe Orientierung: liquide Mittel geteilt durch monatliche Fixkosten. ETF, Aktien, Gold und Krypto können im Verkaufszeitpunkt stark schwanken. Stufen 1 bis 3 vergleichen liquide Mittel, Stufe 4 und 5 den Net Worth.</div>');
  }
  W.editRunway5 = function () { runway5Edit = true; render(); };
  W.cancelRunway5 = function () { runway5Edit = false; render(); };
  W.saveRunway5 = function () {
    const name = String($('r5n').value || '').trim().slice(0,80);
    const target = num($('r5t').value);
    if (!name || !Number.isFinite(target) || target <= 0) { alert('Bitte eine Bezeichnung und einen Zielbetrag größer als 0 eingeben.'); return; }
    S.f = { ...S.f, runway5Name: name, runway5Target: target };
    runway5Edit = false;
    save(); render();
  };
  const oldFire = V.fire, oldHome = V.home;
  V.fire = () => levelsHTML() + oldFire().replace('[FIRE] Zielzahl', '[FIRE] Fuck-Off-Zahl').replace('FIRE-Zahl', 'Fuck-Off-Zahl');
  V.home = () => oldHome() + card('Runway · Freiheit', '<div class="k"><b>' + runway().toFixed(1).replace('.', ',') + ' Monate</b><span>so lange reichen liquide Mittel bei heutigen Fixkosten</span></div><div class="bar"><i style="width:' + Math.min(100, runway()/12*100) + '%"></i></div><div class="mut">Orientierungsmarke: 12 Monate · Details im Tab „Fuck Off“</div>');

  /* Wiederkehrende Buchungen: idempotent pro Monat */
  function autoRecurring() {
    if (typeof sb !== 'undefined' && sb && (!authReady || !user || recMode)) return;
    const m = monthNow();
    if (S.recDone === m) return;
    (S.rec || []).forEach(r => {
      if (!S.tx.some(x => x.r === r.id && x.d.startsWith(m))) S.tx.push({ id: uid(), d: m + '-01', c: r.c, a: r.a, n: r.n, r: r.id });
    });
    S.recDone = m;
    save();
  }
  const oldRender = render;
  W.render = function () { autoRecurring(); oldRender(); };

  /* CSV-Import */
  const CSV = { head: [], raw: [], rows: [], col: { d: 0, a: 1, t: [] }, msg: '' };
  const parseDate = s => {
    s = String(s || '').trim();
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/);
    if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0') : '';
  };
  function parseCSV(text) {
    const first = String(text || '').split(/\r?\n/).find(x => x.trim()) || '';
    const delim = first.split(';').length >= first.split(',').length ? ';' : ',';
    const rows = []; let row = [], field = '', quoted = false;
    text = String(text || '');
    for (let i=0; i<text.length; i++) {
      const c = text[i];
      if (quoted) { if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else quoted = false; } else field += c; }
      else if (c === '"') quoted = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; row.push(field); field = ''; if (row.some(v => v.trim())) rows.push(row); row = []; }
      else field += c;
    }
    row.push(field); if (row.some(v => v.trim())) rows.push(row);
    return rows;
  }
  const rules = [
    ['Gehalt', /gehalt|lohn|bezüge|salary/i],
    ['Wohnen', /miete|nebenkosten|hausverwaltung|strom|stadtwerke|wasser/i],
    ['Lebensmittel', /rewe|edeka|aldi|lidl|penny|netto|kaufland|rossmann|bäcker|backwerk/i],
    ['Mobilität', /tank|aral|shell|esso|bahn|uber|bolt|parken|kfz|adac|vrr/i],
    ['Abos', /netflix|spotify|disney|amazon prime|apple|google|youtube|dazn/i],
    ['Versicherung', /versicherung|allianz|huk|debeka|ergo/i],
    ['Freizeit', /restaurant|kino|steam|playstation|fitness|urlaub|hotel|booking|café|cafe/i],
    ['Sparen/Invest', /trade republic|scalable|sparplan|depot|bitpanda|kraken|coinbase/i]
  ];
  const guessCategory = (text, amount) => {
    for (const r of rules) {
      if (!r[1].test(text)) continue;
      if (amount > 0 && r[0] !== 'Gehalt') return 'Sonstige Einnahmen';
      if (amount < 0 && IN.includes(r[0])) continue;
      return r[0];
    }
    return amount > 0 ? 'Sonstige Einnahmen' : 'Sonstiges';
  };
  const memoKey = s => String(s || '').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').replace(/[^\p{L}\p{N}]/gu,'').slice(0,60);
  function buildCSVRows() {
    CSV.rows = [];
    CSV.raw.forEach(r => {
      const d = parseDate(r[CSV.col.d]), a = num(r[CSV.col.a]);
      if (!d || !isFinite(a) || a === 0) return;
      const idx = CSV.col.t.length ? CSV.col.t : CSV.head.map((_,i) => i).filter(i => i !== CSV.col.d && i !== CSV.col.a);
      const memo = idx.map(i => r[i] || '').join(' ').replace(/\s+/g,' ').trim().slice(0,70);
      const key = memoKey(memo);
      const duplicate = S.tx.some(x => x.d === d && Math.abs(x.a - Math.abs(a)) < 0.005 && memoKey(x.n) === key);
      CSV.rows.push({ d: d, a: a, n: memo, c: guessCategory(memo,a), dup: duplicate });
    });
    CSV.msg = CSV.rows.length ? '' : 'Keine Buchungszeilen erkannt. Bitte Datum und Betragsspalte prüfen.';
  }
  W.csvLoad = function (text) {
    const rows = parseCSV(text);
    if (!rows.length) { CSV.head=[]; CSV.raw=[]; CSV.rows=[]; CSV.msg='Die Datei enthält keine lesbaren Zeilen.'; return render(); }
    const headRow = rows.findIndex(r => r.length >= 2 && r.some(v => /buchungstag|buchungsdatum|datum|valuta|date/i.test(v)) && r.some(v => /betrag|umsatz|amount|value/i.test(v)));
    const hasHeader = headRow >= 0;
    CSV.head = hasHeader ? rows[headRow] : rows[0].map((_,i) => 'Spalte ' + (i+1));
    CSV.raw = hasHeader ? rows.slice(headRow+1) : rows;
    const find = re => CSV.head.findIndex(v => re.test(v));
    if (hasHeader) {
      CSV.col = { d: Math.max(0,find(/buchungstag|buchungsdatum|datum|valuta|date/i)), a: Math.max(0,find(/betrag|umsatz|amount|value/i)), t: CSV.head.map((v,i) => /verwendung|buchungstext|beschreibung|empf|auftraggeber|zahlungs|gegenkonto|name|text|zweck/i.test(v) ? i : -1).filter(i => i >= 0) };
    } else {
      const f = CSV.raw[0] || [], di = f.findIndex(v => !!parseDate(v));
      const ai = f.findIndex((v,i) => i !== di && isFinite(num(v)) && num(v) !== 0);
      CSV.col = { d: Math.max(0,di), a: Math.max(0,ai), t: CSV.head.map((_,i) => i).filter(i => i !== di && i !== ai) };
    }
    buildCSVRows(); render();
  };
  W.csvFile = async function (file) {
    if (!file) return;
    try { const buffer = await file.arrayBuffer(); let text = new TextDecoder('utf-8').decode(buffer); if (text.includes('\ufffd')) text = new TextDecoder('windows-1252').decode(buffer); W.csvLoad(text); }
    catch (e) { CSV.msg = 'Datei konnte nicht gelesen werden: ' + (e.message || e); render(); }
  };
  W.csvSet = (key,value) => { CSV.col[key] = +value; buildCSVRows(); render(); };
  W.csvCat = (i,value) => { if (CSV.rows[i]) CSV.rows[i].c = value; };
  W.csvGo = function () {
    const rows = CSV.rows.filter(r => !r.dup);
    rows.forEach(r => S.tx.push({ id:uid(), d:r.d, c:r.c, a:Math.abs(r.a), n:r.n }));
    CSV.msg = rows.length + ' Buchungen importiert.'; CSV.rows=[]; CSV.raw=[];
    if (rows.length) mo = rows.map(r => r.d).sort().pop().slice(0,7);
    save(); tab='cash'; render();
  };
  V.csv = () => {
    const opts = sel => CSV.head.map((h,i) => '<option value="' + i + '"' + (i===sel?' selected':'') + '>' + esc(h || ('Spalte ' + (i+1))) + '</option>').join('');
    const categories = IN.concat(OUT);
    const fresh = CSV.rows.filter(r => !r.dup).length;
    let html = '<input aria-label="CSV-Datei auswählen" type="file" accept=".csv,.txt,text/csv" onchange="csvFile(this.files[0])"><label>Oder CSV-Text einfügen</label><textarea aria-label="CSV-Text einfügen" id="csvt" rows="3" placeholder="Buchungstag;Verwendungszweck;Betrag …"></textarea><button class="btn o" onclick="csvLoad($(\'csvt\').value)">Einlesen</button><div class="note">' + esc(CSV.msg) + ' CSV mit Semikolon oder Komma, Datum TT.MM.JJJJ und Betrag 1.234,56 werden unterstützt. Duplikate werden übersprungen.</div>';
    if (CSV.head.length) html += card('Spalten', '<div class="row"><div><label>Datum</label><select aria-label="Datumsspalte" onchange="csvSet(\'d\',this.value)">' + opts(CSV.col.d) + '</select></div><div><label>Betrag</label><select aria-label="Betragsspalte" onchange="csvSet(\'a\',this.value)">' + opts(CSV.col.a) + '</select></div></div>');
    if (CSV.rows.length) html += card('Vorschau', fresh + ' neu / ' + (CSV.rows.length-fresh) + ' Duplikate') + CSV.rows.slice(0,15).map((r,i) => '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between"><span>' + r.d.slice(8) + '.' + r.d.slice(5,7) + '. ' + esc(r.n.slice(0,34)) + '</span><b class="' + (r.a>0?'pos':'neg') + '">' + eur(r.a) + '</b></div>' + (r.dup ? '<div class="mut">Duplikat, wird übersprungen</div>' : '<select aria-label="Kategorie der Zeile" onchange="csvCat(' + i + ',this.value)">' + categories.map(c => '<option' + (c===r.c?' selected':'') + '>' + c + '</option>').join('') + '</select>') + '</div>').join('') + '<button class="btn" onclick="csvGo()">' + fresh + ' Buchungen importieren</button>';
    return bk() + card('CSV-Import · Kontoauszug', html);
  };

  /* Monatsrückblick */
  V.review = () => {
    const parts = mo.split('-').map(Number), prior = new Date(parts[0],parts[1]-2,1), pm = prior.getFullYear() + '-' + String(prior.getMonth()+1).padStart(2,'0');
    const now = S.tx.filter(x => x.d.startsWith(mo)), before = S.tx.filter(x => x.d.startsWith(pm));
    const inc=sm(now,'in'), out=sm(now,'out'), pinc=sm(before,'in'), pout=sm(before,'out');
    const rate=inc?invSum(now)/inc*100:null, prate=pinc?invSum(before)/pinc*100:null, cats={};
    now.filter(x => !IN.includes(x.c) && x.c !== 'Sparen/Invest').forEach(x => cats[x.c]=(cats[x.c]||0)+x.a);
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0], big=now.filter(x=>!IN.includes(x.c) && x.c!=='Sparen/Invest').sort((a,b)=>b.a-a.a)[0];
    const compare = (a,b,lowerBad) => { const d=a-b, good=lowerBad?d<=0:d>=0; return '<small class="' + (good?'pos':'neg') + '">' + (d>=0?'+':'') + eur(d) + ' zum Vormonat</small>'; };
    const highlights=[];
    if (top) highlights.push('Größter Ausgabenposten: <b>' + esc(top[0]) + '</b> mit ' + eur(top[1]));
    if (big) highlights.push('Größte Einzelausgabe: <b>' + esc(big.n || big.c) + '</b> ' + eur(big.a));
    const saved=now.filter(x=>x.c==='Sparen/Invest').reduce((s,x)=>s+x.a,0);
    if (saved) highlights.push('Investiert/gespart: <b>' + eur(saved) + '</b>');
    const currentHist=histPick(mo), prevHist=histPick(pm);
    if (currentHist && prevHist) highlights.push('Net Worth Veränderung: <b>' + eur(currentHist.nw-prevHist.nw) + '</b>');
    const breaches=Object.keys(S.bud||{}).filter(c => S.bud[c]>0 && (cats[c]||0)>S.bud[c]);
    if (breaches.length) highlights.push('Budget überschritten: <b class="neg">' + breaches.map(esc).join(', ') + '</b>');
    const verdict=!inc?'Noch keine Einnahmen in diesem Monat gebucht.':inc-out<0?'Mehr ausgegeben als eingenommen.':rate>=30?'Starker Monat: mehr als 30 % Sparquote.':rate>=15?'Solider Monat.':rate>0?'Wenig investiert.':'Diesen Monat nichts investiert.';
    const cmpP=(a,b)=>{const d=a-b;return '<small class="'+(d>=0?'pos':'neg')+'">'+(d>=0?'+':'')+d.toLocaleString('de-DE',{maximumFractionDigits:1})+' %-Pkt. zum Vormonat</small>';};
    return bk() + card('Zeitraum',moNav()) + card('Monatsrückblick','<div class="k"><b>' + verdict + '</b></div><div class="g2"><div class="k"><b class="pos">' + eur(inc) + '</b><span>Einnahmen</span>' + compare(inc,pinc,false) + '</div><div class="k"><b class="neg">' + eur(out) + '</b><span>Ausgaben</span>' + compare(out,pout,true) + '</div><div class="k"><b>' + eur(inc-out) + '</b><span>Cashflow</span>' + compare(inc-out,pinc-pout,false) + '</div><div class="k"><b>' + (rate==null?'–':pct(rate)) + '</b><span>Sparquote · investiert</span>' + (rate!=null&&prate!=null?cmpP(rate,prate):'') + '</div></div>') + (highlights.length ? card('Highlights',highlights.map(h=>'<div class="li"><span>' + h + '</span></div>').join('')) : '');
  };

  /* Budgets und Rebalancing */
  const budgets = () => S.bud || (S.bud = {});
  const allocation = () => S.f.alloc || (S.f.alloc = {});
  W.setBud = (c,v) => { budgets()[c] = Math.max(0,num(v)||0); save(); render(); };
  W.setAl = (k,v) => { allocation()[k] = Math.max(0,num(v)||0); save(); render(); };
  const oldCash = V.cash;
  V.cash = () => oldCash() + card('Budgets · Monatslimits', OUT.filter(c => c !== 'Sparen/Invest').map(c => {
    const spent=mt().filter(x=>x.c===c).reduce((s,x)=>s+x.a,0), limit=budgets()[c]||0, p=limit?spent/limit*100:0;
    return '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>' + c + '</span><span class="' + (p>100?'neg p':p>85?'neg':'') + '">' + eur(spent) + ' / <input class="mini" aria-label="Monatsbudget in Euro" type="number" inputmode="decimal" value="' + (limit||'') + '" placeholder="Limit" onchange="setBud(\'' + c + '\',this.value)"></span></div>' + (limit ? '<div class="bar"><i style="width:' + Math.min(100,p) + '%;' + (p>85?'background:#ff4d6d':'') + '"></i></div><div class="' + (p>100?'neg p':'mut') + '">' + (p>100?'Über Limit um '+eur(spent-limit):pct(p)+' genutzt · noch '+eur(limit-spent)) + '</div>' : '') + '</div>';
  }).join(''));
  V.rebal = () => {
    const t=allocation(), total=nw(), keys=Object.keys(KIND), sum=keys.reduce((s,k)=>s+(+t[k]||0),0), gaps=[];
    const rows=keys.map(k => {
      const actual=byK(k), target=+t[k]||0, delta=total*target/100-actual, weight=total?actual/total*100:0;
      if (delta>total*.02) gaps.push([k,delta]);
      return '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span><i style="color:' + COL[k] + ';font-style:normal">■</i> ' + KIND[k] + '</span><span>Ist ' + pct(weight) + ' · Ziel <input class="mini" aria-label="Zielanteil in Prozent" style="width:64px!important" type="number" inputmode="decimal" value="' + (t[k]!=null?t[k]:'') + '" placeholder="0" onchange="setAl(\'' + k + '\',this.value)"> %</span></div>' + ((target||actual) ? '<div class="' + (Math.abs(delta)<total*.02?'pos':'neg') + '">' + (Math.abs(delta)<total*.02?'im Zielbereich':(delta>0?'zukaufen ':'abbauen ')+eur(Math.abs(delta))) + '</div>' : '') + '</div>';
    }).join('');
    const sr=avg().s, gapTotal=gaps.reduce((s,x)=>s+x[1],0);
    return bk() + card('Rebalancing · Ziel-Aufteilung','<div class="mut">Summe der Ziele: <b class="' + (Math.abs(sum-100)<.01?'pos':'neg') + '">' + pct(sum) + '</b> (soll 100 %)</div>' + rows + '<div class="note">Zielwerte sind Planungswerte, keine automatische Handelsanweisung. Verkäufe können Steuern auslösen.</div>') + (gaps.length && sr>0 && gapTotal>0 ? card('Sparrate verteilen','<div class="mut">Ø Sparleistung ' + eur(sr) + ' / Monat</div>' + gaps.map(x=>'<div class="li"><span>' + KIND[x[0]] + '</span><b>' + eur(sr*x[1]/gapTotal) + '</b></div>').join('')) : '');
  };

  /* Gerätesperre: Die PIN liegt lokal, nicht in der Cloud. */
  const PIN_KEY='fr_pin';
  const pinConfig=()=>{ try { return JSON.parse(localStorage.getItem(PIN_KEY)||'null'); } catch(e) { return null; } };
  /* v2: PBKDF2-SHA-256 mit zufälligem Salt. Alte Einträge ohne v (ungesalzenes SHA-256) werden beim nächsten Entsperren umgestellt. */
  const PIN_ITER=310000;
  const hexOf=buf=>Array.from(new Uint8Array(buf)).map(v=>v.toString(16).padStart(2,'0')).join('');
  const pinStore=c=>{try{localStorage.setItem(PIN_KEY,JSON.stringify(c))}catch(e){}};
  const pinBackoffMs=blocks=>Math.min(30000*Math.pow(2,Math.max(0,blocks-1)),900000);
  async function pinKdf(pin,saltHex,iter){
    const key=await W.crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    const salt=new Uint8Array(saltHex.match(/../g).map(x=>parseInt(x,16)));
    return hexOf(await W.crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},key,256));
  }
  async function pinHashLegacy(pin){
    const bytes=new TextEncoder().encode('fr-'+pin);
    if (W.crypto && W.crypto.subtle) return hexOf(await W.crypto.subtle.digest('SHA-256',bytes));
    let h=5381; for (const ch of 'fr-'+pin) h=(h*33+ch.charCodeAt(0))>>>0; return 'x'+h;
  }
  async function pinCheck(pin,c){ return c.v===2 ? (await pinKdf(pin,c.s,c.i))===c.h : (await pinHashLegacy(pin))===c.h; }
  async function pinRecord(pin,m){ const s=hexOf(W.crypto.getRandomValues(new Uint8Array(16))); return {h:await pinKdf(pin,s,PIN_ITER),n:pin.length,m,v:2,s,i:PIN_ITER,f:0,b:0,u:0}; }
  let buffer='', locked=!!pinConfig(), hiddenAt=0, pinMessage='', pinTm=null;
  function lockUI() {
    let el=$('lk');
    if (!locked || !pinConfig()) { if(el) { el.remove(); document.querySelectorAll('.wrap,.tabs').forEach(x=>x.inert=false); } return; }
    if (!el) { el=document.createElement('div'); el.id='lk'; el.className='lk'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','App gesperrt'); document.body.appendChild(el); document.querySelectorAll('.wrap,.tabs').forEach(x=>x.inert=true); setTimeout(()=>{const k=el.querySelector('.pad button'); if(k) k.focus();},0); }
    const config=pinConfig(), wait=Date.now()<(config.u||0), secs=Math.ceil(((config.u||0)-Date.now())/1000);
    clearTimeout(pinTm); if (wait) pinTm=setTimeout(lockUI,1000);
    el.innerHTML='<div style="font-size:12px;letter-spacing:.14em;color:var(--mut)">FINANZ/<b style="color:var(--ink)">GESPERRT</b></div><div class="dots">' + Array.from({length:config.n},(_,i)=>'<i class="' + (i<buffer.length?'f':'') + '"></i>').join('') + '</div><div class="mut">' + (wait?'Zu viele Versuche: bitte '+secs+' Sekunden warten':'PIN eingeben') + '</div><div class="pad">' + [1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':'<button'+(k==='⌫'?' aria-label="Letzte Ziffer löschen"':'')+' onclick="pinKey(\''+k+'\')">'+k+'</button>').join('') + '</div>';
  }
  W.pinKey = async key => {
    const config=pinConfig(); if(!config){locked=false;return lockUI();}
    if(Date.now()<(config.u||0)) return lockUI();
    if(key==='⌫') buffer=buffer.slice(0,-1); else if(buffer.length<config.n) buffer+=key;
    if(buffer.length===config.n) {
      const typed=buffer; buffer='';
      let ok=false; try { ok=await pinCheck(typed,config); } catch(e) { ok=false; }
      if(ok){ locked=false; try { pinStore(config.v===2?{...config,f:0,b:0,u:0}:await pinRecord(typed,config.m)); } catch(e) {} }
      else { let f=(config.f||0)+1, b=config.b||0, u=0; if(f>=3){ b+=1; f=0; u=Date.now()+pinBackoffMs(b); } pinStore({...config,f,b,u}); }
    }
    lockUI();
  };
  W.setPin = async () => {
    const a=$('pn1').value, b=$('pn2').value;
    if(!/^\d{4,6}$/.test(a)||a!==b){pinMessage='Bitte dieselbe PIN mit 4 bis 6 Ziffern zweimal eingeben.';return render();}
    try { localStorage.setItem(PIN_KEY,JSON.stringify(await pinRecord(a,+$('lm').value))); pinMessage='PIN gespeichert.'; }
    catch(e) { pinMessage='PIN konnte auf diesem Gerät nicht gespeichert werden.'; }
    render();
  };
  W.rmPin = () => { try{localStorage.removeItem(PIN_KEY);}catch(e){} locked=false;pinMessage='PIN entfernt.';lockUI();render(); };
  W.lockNow = () => { if(pinConfig()){locked=true;buffer='';lockUI();} };
  document.addEventListener('visibilitychange',() => {
    if(document.hidden){hiddenAt=Date.now();return;}
    const config=pinConfig();
    if(config && hiddenAt && Date.now()-hiddenAt >= (config.m||0)*60000){locked=true;buffer='';lockUI();}
  });
  V.sec = () => {
    const p=pinConfig();
    return bk()+card('Sicherheit · PIN','<div class="' + (p?'pos':'mut') + '">' + (p?'PIN ist aktiv ('+p.n+' Stellen)':'Keine PIN gesetzt') + '</div><label>Neue PIN (4 bis 6 Ziffern)</label><input aria-label="Neue PIN" id="pn1" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><label>PIN wiederholen</label><input aria-label="PIN wiederholen" id="pn2" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><label>Automatisch sperren nach</label><select aria-label="Automatisch sperren nach" id="lm">' + [[0,'sofort beim Verlassen'],[1,'1 Minute'],[5,'5 Minuten'],[15,'15 Minuten']].map(x=>'<option value="'+x[0]+'" '+(p&&p.m===x[0]?'selected':'')+'>'+x[1]+'</option>').join('') + '</select><button class="btn" onclick="setPin()">PIN speichern</button>' + (p?'<button class="btn o" onclick="lockNow()">Jetzt sperren</button><button class="btn o" onclick="rmPin()">PIN entfernen</button>':'') + '<div class="note">' + esc(pinMessage) + ' Die PIN gilt pro Gerät und wird nicht in die Cloud übertragen. Sie schützt vor neugierigen Blicken, ersetzt aber keine Verschlüsselung der Daten.</div>');
  };
/* ---------- 7. Fuck-Off-Rechner: Ansparen bis zur Zahl, dann Entnahme (Szenarien, Steuer) ---------- */
let fxEdit=false,lastT=tab;
const LQ=['cash','etf','aktie','crypto','gold'];
const fxP=()=>{const f=S.f,a=avg(),exp=parseFloat(f.exp)||fixk();return{r:(f.r!=null&&f.r!=='')?+f.r:6,inf:f.inf!=null?+f.inf:2,wm:+f.wm||exp,wy:+f.wy||30,wi:f.wi!==false,kt:f.kt!=null?+f.kt:26.375,pb:f.pb!=null?+f.pb:1000,sr:Math.max(0,a.s),v0:Math.max(0,nn()),F:fireF(),b0:S.as.filter(x=>LQ.includes(x.k)).reduce((s,x)=>s+((x.k==='cash'||!x.c)?val(x):x.c),0)}};
function fxSim(rg,P){const m=Math.pow(1+rg/100,1/12)-1,rows=[[0,P.v0]];let v=P.v0,b=Math.min(P.b0,P.v0),k=0,tax=0,net=0,gross=0,dep=null;
while(v<P.F&&k<720){v=v*(1+m)+P.sr;b+=P.sr;k++;if(k%12===0)rows.push([k/12,v])}
const ya=k/12,ok=v>=P.F,vs=v;if(k%12)rows.push([ya,v]);
for(let j=1;j<=P.wy;j++){let tb=0,gr=0;for(let q=0;q<12;q++){v*=1+m;const w=P.wm*(P.wi?Math.pow(1+P.inf/100,ya+(j-1)+q/12):1),g=Math.min(w,Math.max(v,0));if(g>0){const fr=Math.max(0,(v-b)/v);tb+=g*fr*.7;b-=g*(1-fr);v-=g;gr+=g}}
const tx=Math.max(0,tb-P.pb)*P.kt/100;tax+=tx;net+=gr-tx;gross+=gr;if(v<=.5&&dep===null)dep=j;rows.push([ya+j,Math.max(v,0)])}
return{ya,ok,vs,rows,tax,net,gross,dep,rest:Math.max(v,0)}}
const atY=(rows,t)=>{if(t>=rows[rows.length-1][0])return rows[rows.length-1][1];for(let i=0;i<rows.length-1;i++){const a=rows[i],b=rows[i+1];if(t>=a[0]&&t<=b[0])return b[0]===a[0]?b[1]:a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0])}return rows[0][1]};
const maxW=P=>{let lo=0,hi=P.v0+P.sr*600+1;for(let i=0;i<30;i++){const mid=(lo+hi)/2,r=fxSim(P.r,{...P,wm:mid});if(r.dep===null)lo=mid;else hi=mid}return lo};
const fm=v=>isFinite(v)?v.toLocaleString('de-DE',{maximumFractionDigits:1}):'–';
function fxHTML(){const P=fxP(),sp=2,N=fxSim(P.r,P),Pe=fxSim(P.r-sp,P),O=fxSim(P.r+sp,P),y0=new Date().getFullYear(),T=Math.ceil(Math.max(N.ya,Pe.ya,O.ya))+P.wy,yrsW=N.dep||P.wy,real=v=>v/Math.pow(1+P.inf/100,N.ya),mx=maxW(P),rate=N.vs?P.wm*12/N.vs*100:0;
const rows=[];for(let t=0;t<=T;t++)rows.push(['Jahr '+t+' · '+(y0+t),atY(N.rows,t),atY(Pe.rows,t),atY(O.rows,t)]);
const kp=(b,l,c)=>`<div class="k"><b class="${c||''}">${b}</b><span>${l}</span></div>`;
const edit=fxEdit?`<div class="row"><div><label>Ausgaben/Mon. €</label><input id="fe" type="number" inputmode="decimal" value="${S.f.exp}" placeholder="${Math.round(fixk())}"></div><div><label>Entnahme % (Zielzahl)</label><input id="fw" type="number" step="0.1" value="${S.f.wr}"></div></div><div class="row"><div><label>Entnahme/Monat €</label><input id="fm" type="number" inputmode="decimal" value="${S.f.wm||''}" placeholder="${Math.round(P.wm)}"></div><div><label>Dauer (Jahre)</label><input id="fy" type="number" value="${P.wy}"></div></div><div class="row"><div><label>Rendite % p.a.</label><input id="fr" type="number" step="0.1" value="${S.f.r}"></div><div><label>Inflation %</label><input id="fi" type="number" step="0.1" value="${P.inf}"></div></div><label>Fuck-Off-Zahl € (leer = automatisch)</label><input id="ftarget" type="number" inputmode="decimal" value="${S.f.fireTarget||''}" placeholder="${Math.round(((parseFloat(S.f.exp)||fixk())*12)/(wrOf()/100))}"><label class="mut" style="display:flex;gap:8px;align-items:center;text-transform:none"><input type="checkbox" id="fx_wi" style="width:auto" ${P.wi?'checked':''}> Entnahme steigt mit Inflation</label><button class="btn" onclick="setFx()">Übernehmen</button><button class="btn o" onclick="fxToggle(false)">Abbrechen</button>`:`<button class="btn o" onclick="fxToggle(true)">✎ Annahmen bearbeiten</button><div class="mut" style="margin-top:6px">Rendite ${fm(P.r)} % · Inflation ${fm(P.inf)} % · Entnahme ${eur(P.wm)}/Mon. · ${P.wy} J. · Steuer ${fm(P.kt)} % (30 % Teilfreistellung)</div>`;
const msg=!N.ok?`<div class="neg p">Die Zielzahl ${eur(P.F)} wird in 60 Jahren nicht erreicht. Mehr sparen, weniger Fixkosten oder höhere Rendite nötig.</div>`:N.dep?`<div class="neg p">Kapital reicht nur bis Jahr ${fm(N.ya+N.dep)} (${N.dep} J. Entnahme). Nachhaltig möglich: ${eur(mx)}/Monat.</div>`:`<div class="pos">✓ Kapital reicht für die gesamte Entnahmedauer.</div>`;
return P_('[Entnahme] Fuck-Off-Rechner',`<div class="g2">${kp(N.ok?fm(N.ya)+' J.':'–','bis Fuck-Off-Zahl (ca. '+(N.ok?y0+Math.ceil(N.ya):'–')+')')}${kp(eur(N.vs),'Kapital bei Start · real '+eur(real(N.vs)))}${kp(eur(N.net/(12*yrsW)),'Ø Entnahme netto / Monat','pos')}${kp(eur(N.tax),'Steuer in der Entnahme')}${kp(N.dep?'leer in Jahr '+fm(N.ya+N.dep):'reicht ✓','Kapital',N.dep?'neg':'pos')}${kp(eur(N.rest),'Restkapital nach '+P.wy+' J.')}${kp(eur(mx),'max. nachhaltige Entnahme/Mon. (brutto)')}${kp(fm(rate)+' %','Entnahmerate zu Beginn',rate>4?'neg':'pos')}</div>`+msg+lc(rows,['Normal','Pessimistisch','Optimistisch'],['var(--or)','var(--mut)','var(--mut)'],{dash:1})+`<div class="mut" style="margin-top:6px">Vermögen über die Zeit: erst Ansparen (Ø Sparleistung ${eur(P.sr)}/Mon.), ab Erreichen der Zielzahl Entnahme. Szenarien ±${sp} % Rendite. Tippen/Ziehen zeigt Jahr und Werte.</div>`+`<div class="hatch"></div>`+`<table style="border-collapse:collapse;width:100%;font-size:11px"><tr><th align="left">Szenario</th><th align="right">Rendite</th><th align="right">Start nach</th><th align="right">Rest</th></tr>${[['Pessimistisch',P.r-sp,Pe],['Normal',P.r,N],['Optimistisch',P.r+sp,O]].map(([n,r,x])=>`<tr><td style="padding:6px 4px;border-bottom:1px solid var(--ln)">${n}</td><td align="right" style="border-bottom:1px solid var(--ln)">${fm(r)} %</td><td align="right" style="border-bottom:1px solid var(--ln)">${x.ok?fm(x.ya)+' J.':'–'}</td><td align="right" style="border-bottom:1px solid var(--ln)" class="${x.dep?'neg':''}">${x.dep?'leer J. '+fm(x.ya+x.dep):eur(x.rest)}</td></tr>`).join('')}</table>`+`<div class="hatch"></div>`+edit+`<div class="note">Vereinfachung: Rendite nach Kosten, Steuer nur auf den Gewinnanteil jeder Entnahme (Pauschbetrag ${eur(P.pb)}/Jahr), keine Vorabpauschale/Kirchensteuer. Keine Anlageberatung.</div>`)}
const P_=P;
W.fxToggle=v=>{fxEdit=v;render()};
W.setFx=()=>{const g=i=>parseFloat(String($(i).value).replace(',','.')),f=S.f;f.exp=$('fe').value;f.wr=g('fw')||4;f.r=isFinite(g('fr'))?g('fr'):6;f.wm=g('fm')||0;f.wy=Math.max(1,Math.min(80,g('fy')||30));f.inf=isFinite(g('fi'))?g('fi'):2;f.fireTarget=g('ftarget')>0?g('ftarget'):'';f.wi=$('fx_wi').checked;fxEdit=false;save();render()};
const _fire2=V.fire;V.fire=()=>_fire2().replace(/<div class="hatch"><\/div><div class="row"><div><label>Ausgaben\/Mon\. €<\/label>[\s\S]*?onclick="setF\(\)">Übernehmen<\/button>/,'')+fxHTML();
const _render2=render;W.render=function(){if(tab!==lastT){fxEdit=false;lastT=tab}_render2()};


  /* ===== Prognose-Reiter nach Vorbild "Prognose Radar" ===== */
  const prCss = '.prw .c{position:absolute;width:10px;height:10px;border:1px solid var(--ink);pointer-events:none}.prw .c1{top:5px;left:5px;border-right:0;border-bottom:0}.prw .c2{top:5px;right:5px;border-left:0;border-bottom:0}.prw .c3{bottom:5px;left:5px;border-right:0;border-top:0}.prw .c4{bottom:5px;right:5px;border-left:0;border-top:0}'
    + '.prw .row{align-items:center}.prw .row>*{flex:initial}.prw .row>input{flex:1}.prw .u{color:var(--mut);font-size:11px;min-width:34px}'
    + '.prw input[type=range]{border:0;padding:0;accent-color:var(--or);margin:6px 0 0}'
    + '.prw .chips{display:flex;flex-wrap:wrap;gap:6px}.prw .chip{font:inherit;font-size:11px;padding:7px 9px;border:1px solid var(--ln);background:transparent;color:var(--ink);border-radius:0;cursor:pointer;width:auto;margin:0;letter-spacing:0;text-transform:none}.prw .chip.on{border-color:var(--or);background:var(--orl);color:var(--ort)}'
    + '.prw .chk{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;color:var(--ink)}.prw .chk input{appearance:none;-webkit-appearance:none;width:16px;height:16px;padding:0;border:1px solid var(--or);margin:0;border-radius:0;display:grid;place-items:center;flex:none}.prw .chk input:checked{background:var(--orb)}.prw .chk input:checked::after{content:"✓";color:#fff;font-size:11px}'
    + '.prw .kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 10px}.prw .k.hi b{color:var(--ort)}.prw .k.big{grid-column:1/-1}.prw .k.big b{font-size:32px;color:var(--ink)}.prw .k.big.hi b{color:var(--ort)}'
    + '.prw .leg{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--mut);margin-top:8px;letter-spacing:.08em;text-transform:uppercase}.prw .leg i{display:inline-block;width:14px;height:2px;vertical-align:middle;margin-right:5px}'
    + '.prw .tw{overflow-x:auto;max-width:100%;min-width:0}.prw table{border-collapse:collapse;width:100%;font-size:11px;white-space:normal}.prw th,.prw td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--ln)}.prw th{color:var(--mut);font-weight:500;font-size:10px;letter-spacing:.1em;text-transform:uppercase}.prw th:first-child,.prw td:first-child{text-align:left}'
    + '.prw .al{border-left:3px solid var(--ln);padding:8px 10px;margin-top:6px;font-size:11px}.prw .al.w{border-color:var(--or);background:linear-gradient(90deg,var(--orl),transparent)}.prw .al small{color:var(--mut);display:block;letter-spacing:.06em}.prw .al .chip{padding:3px 8px;margin-left:4px}';
  const prStyle = document.createElement('style'); prStyle.textContent = prCss; document.head.appendChild(prStyle);

  const PR = { v: null, c: { tx: true, ex: false, wi: true }, tf: 30, pre: 0, lump: [], last: {} };
  const PR_IDS = ['s0','sm','dyn','y','r','ter','sp','inf','tr','fb','wm','wy'], PR_CK = ['tx','ex','wi'];
  const PR_PRE = [['MSCI World',7],['S&P 500',8.5],['MSCI EM',6],['Europa',6],['Anleihen',3],['Tagesgeld',2.5],['Manuell',null]];
  const PR_TF = [['Aktien-ETF 30 %',30],['Misch 15 %',15],['Keine 0 %',0]];
  const pe = id => $('pr_' + id);
  const pn = id => { const x = parseFloat(String(pe(id).value).replace(',', '.')); return isFinite(x) ? x : 0; };
  const prE = x => isFinite(x) ? ((Math.round(x) || 0).toLocaleString('de-DE', {maximumFractionDigits:0}) + ' €') : '–';
  const prP = x => isFinite(x) ? (((Math.round(x * 100) / 100) || 0).toLocaleString('de-DE', {maximumFractionDigits:2}) + ' %') : '–';
  const prPlans = () => Array.isArray(S.prPlans) ? S.prPlans : (S.prPlans = []);
  const prCorners = '<i class="c c1"></i><i class="c c2"></i><i class="c c3"></i><i class="c c4"></i>';
  const prPanel = h => '<div class="panel">' + prCorners + h + '</div>';

  function prDefaults() {
    if (PR.v) return;
    PR.v = { s0: Math.max(0, Math.round(nn())), sm: Math.max(0, Math.round(avg().s)) || 300, dyn: 0, y: 20, r: 7, ter: 0.2, sp: 2, inf: 2, tr: 26.375, fb: 1000, wm: 1500, wy: 25 };
  }
  function prHTML() {
    prDefaults();
    const v = id => esc(String(PR.v[id])), ck = id => PR.c[id] ? ' checked' : '';
    const inp = (id, label, unit, step, mode) => '<label>' + label + '</label><div class="row"><input type="number" aria-label="' + label + '" id="pr_' + id + '" inputmode="' + (mode || 'decimal') + '" value="' + v(id) + '"' + (step ? ' step="' + step + '"' : '') + '><span class="u">' + unit + '</span></div>';
    return '<div class="prw">'
      + prPanel('<h2>[Daten] Meine Zahlen</h2><div class="g2"><div class="k"><b>' + eur(nn()) + '</b><span>Net Worth</span></div><div class="k"><b>' + eur(avg().s) + '</b><span>Ø investiert / Monat</span></div></div><button class="btn" id="pr_fm">Plan aus meinen Zahlen</button><div class="note">Übernimmt Net Worth als Startkapital, Ø Investiertes als Sparrate sowie Rendite und Ausgaben aus dem Tab Fuck Off. Darunter siehst du, wann deine Stufen erreicht sind.</div>')
      + prPanel('<h2>[Eingabe] Kapital</h2>'
        + inp('s0', 'Startkapital', 'EUR') + inp('sm', 'Sparrate / Monat', 'EUR') + inp('dyn', 'Sparrate steigt jährlich um', '%', '0.5')
        + '<label>Laufzeit · <span id="pr_yl">' + v('y') + '</span> Jahre</label><input aria-label="Laufzeit in Jahren" type="range" id="pr_y" min="1" max="50" value="' + v('y') + '">'
        + '<div class="hatch"></div><h2>[Layer] Einmalzahlungen</h2>'
        + '<div class="row"><input aria-label="Jahr der Einmalzahlung" type="number" id="pr_ly" placeholder="Jahr" inputmode="numeric"><input aria-label="Betrag der Einmalzahlung in Euro" type="number" id="pr_la" placeholder="± EUR" inputmode="decimal"><button class="chip on" id="pr_lb" aria-label="Einmalzahlung hinzufügen">+</button></div><div id="pr_ll"></div>'
        + '<div class="hatch"></div><h2>[Layer] Rendite</h2><div class="chips" id="pr_pre"></div>'
        + inp('r', 'Erwartete Rendite p.a. (brutto)', '%', '0.1') + inp('ter', 'Kosten (TER) p.a.', '%', '0.05') + inp('sp', 'Szenario-Spanne (±)', '%', '0.5')
        + '<div class="hatch"></div><h2>[Layer] Inflation &amp; Steuer</h2>'
        + inp('inf', 'Inflation p.a.', '%', '0.1')
        + '<label class="chk" style="margin-top:8px"><input aria-label="Steuer berücksichtigen" type="checkbox" id="pr_tx"' + ck('tx') + '>Steuer berücksichtigen</label>'
        + '<div id="pr_txo">' + inp('tr', 'Steuersatz (Abgeltung+Soli)', '%', '0.001') + '<label>Teilfreistellung</label><div class="chips" id="pr_tf"></div>' + inp('fb', 'Sparerpauschbetrag (gesamt)', 'EUR') + '</div>')
      + prPanel('<h2>[Phase 2] Entnahme</h2><label class="chk"><input aria-label="Entnahmephase aktivieren" type="checkbox" id="pr_ex"' + ck('ex') + '>Entnahmephase aktivieren</label>'
        + '<div id="pr_exo" style="display:none">' + inp('wm', 'Entnahme / Monat (brutto)', 'EUR') + inp('wy', 'Entnahme-Dauer', 'Jahre', '', 'numeric') + '<label class="chk"><input aria-label="Entnahme steigt mit Inflation" type="checkbox" id="pr_wi"' + ck('wi') + '>Entnahme steigt mit Inflation</label></div>')
      + prPanel('<h2>[Ergebnis] Normalfall</h2><div class="kpis">'
        + '<div class="k big hi"><b id="pr_o1">–</b><span>Endwert netto (nominal)</span></div>'
        + [['o2','Kaufkraft heute'],['o3','Eingezahlt'],['o4','Gewinn brutto'],['o5','Steuer'],['o6','Ø Rendite netto p.a.'],['o7','Real-Rendite p.a.'],['o8','Verdopplung nach']].map(x => '<div class="k"><b id="pr_' + x[0] + '">–</b><span>' + x[1] + '</span></div>').join('')
        + '<div id="pr_wp" class="kpis" style="display:none;grid-column:1/-1;border-top:1px solid var(--ln);padding-top:14px"><div class="k hi"><b id="pr_w1">–</b><span>Ø Entnahme netto / Monat</span></div><div class="k"><b id="pr_w4">–</b><span>Kapital</span></div><div class="k"><b id="pr_w2">–</b><span>Steuer (Entnahme)</span></div><div class="k"><b id="pr_w3">–</b><span>Restkapital</span></div></div></div>')
      + prPanel('<h2>[Ziele] Wann erreicht?</h2><div class="tw"><table id="pr_gt"></table></div><div class="note">Kaufkraft-bereinigt (nach Inflation, Wert in heutigen Euro). Basis: dein Net Worth gegen die Ziele aus dem Tab Fuck Off.</div>')
      + prPanel('<h2>[Verlauf] Vermögen</h2><svg role="img" aria-label="Prognosekurve über die Laufzeit: Vermögen nominal, real und eingezahlt" id="pr_ch" viewBox="0 0 360 200"></svg><div class="leg"><span><i style="background:var(--or)"></i>Normal</span><span><i style="background:var(--mut)"></i>Pess./Opt.</span><span><i style="background:var(--ink)"></i>Eingezahlt</span><span><i style="background:var(--or);opacity:.45"></i>Real</span></div><div class="hatch"></div><h2>[Szenarien] Endwert netto</h2><div class="tw"><table id="pr_sc"></table></div>')
      + prPanel('<h2 id="pr_fh">[Feed] Hinweise</h2><div id="pr_fd"></div>')
      + prPanel('<h2>[Replay] Jahresübersicht</h2><div class="tw"><table id="pr_tb"></table></div>')
      + prPanel('<h2>[Pläne] Speichern &amp; Vergleichen</h2><div class="row"><input aria-label="Name des Plans" type="text" id="pr_pn" placeholder="Name, z. B. ETF 300 €"><button class="chip on" id="pr_ps">Speichern</button></div><div id="pr_pl"></div><div class="tw" style="margin-top:10px"><table id="pr_pc"></table></div>')
      + '<p class="note">Modellannahmen: thesaurierender ETF, Sparrate am Monatsende, Rendite nach TER, Steuer einmalig am Ende auf den Gewinn (bei aktiver Entnahme anteilig je Entnahme; der Pauschbetrag gilt dann pro Jahr) (nach Teilfreistellung und Pauschbetrag). Vorabpauschale, Kirchensteuer und Währungseffekte nicht berücksichtigt. Startkapital und Sparrate sind aus Net Worth und Ø Investiert vorbelegt. Vergangene Renditen sind keine Garantie. Keine Anlageberatung.</p>'
      + '</div>';
  }

  function prChips(el, arr, get, set) {
    const box = $(el); box.innerHTML = '';
    arr.forEach((a, i) => { const b = document.createElement('button'); b.className = 'chip' + (get() === i ? ' on' : ''); b.textContent = a[0]; b.onclick = () => { set(i); prChips(el, arr, get, set); prRun(); }; box.appendChild(b); });
  }
  function prUi() {
    prChips('pr_pre', PR_PRE, () => PR.pre, i => { PR.pre = i; if (PR_PRE[i][1] != null) { pe('r').value = PR_PRE[i][1]; PR.v.r = PR_PRE[i][1]; } });
    prChips('pr_tf', PR_TF, () => PR_TF.findIndex(t => t[1] === PR.tf), i => { PR.tf = PR_TF[i][1]; });
  }
  function prSim(rg, P) {
    const rn = (rg - P.ter) / 100, m = Math.pow(1 + rn, 1 / 12) - 1, out = [{ y: 0, inv: P.s0, v: P.s0 }];
    let v = P.s0, inv = P.s0, sr = P.sm;
    for (let y = 1; y <= P.y; y++) {
      for (let k = 0; k < 12; k++) { v = v * (1 + m) + sr; inv += sr; }
      P.lump.forEach(l => { if (l.y === y) { v += l.a; inv += l.a; } });
      out.push({ y, inv, v }); sr *= 1 + P.dyn / 100;
    }
    const w = { tax: 0, net: 0, dep: null };
    if (P.ex) {
      let b = inv;
      for (let y = P.y + 1; y <= P.T; y++) {
        let gr = 0, tb = 0; const wm = P.wm * (P.wi ? Math.pow(1 + P.inf / 100, y) : 1);
        for (let k = 0; k < 12; k++) {
          v *= 1 + m; const g = Math.min(wm, Math.max(v, 0));
          if (g > 0) { const fr = Math.max(0, (v - b) / v); tb += g * fr * (1 - P.tf / 100); b -= g * (1 - fr); v -= g; gr += g; }
        }
        const tx = P.tx ? Math.max(0, tb - P.fb) * P.tr / 100 : 0;
        w.tax += tx; w.net += gr - tx; if (v <= 0.5 && w.dep === null) w.dep = y;
        out.push({ y, inv, v: Math.max(v, 0) });
      }
    }
    out.w = w; return out;
  }
  function prFin(arr, P) {
    const l = arr[P.y], g = l.v - l.inv; let t = 0;
    if (P.tx && !P.ex) t = Math.max(0, g * (1 - P.tf / 100) - P.fb) * P.tr / 100;
    const net = l.v - t, real = net / Math.pow(1 + P.inf / 100, P.y);
    return { l, g, t, net, real };
  }
  function prRun() {
    if (!pe('s0')) return;
    const P = { s0: pn('s0'), sm: pn('sm'), dyn: pn('dyn'), y: Math.max(1, Math.round(pn('y'))), r: pn('r'), ter: pn('ter'), sp: pn('sp'), inf: pn('inf'), tx: pe('tx').checked, tr: pn('tr'), tf: PR.tf, fb: pn('fb'), ex: pe('ex').checked, wm: pn('wm'), wy: Math.max(1, Math.round(pn('wy'))), wi: pe('wi').checked, lump: PR.lump };
    P.T = P.y + (P.ex ? P.wy : 0);
    $('pr_yl').textContent = P.y; $('pr_txo').style.display = P.tx ? '' : 'none'; $('pr_exo').style.display = P.ex ? '' : 'none';
    const SC = [['Pessimistisch', P.r - P.sp], ['Normal', P.r], ['Optimistisch', P.r + P.sp]].map(([n, r]) => { const a = prSim(r, P); return { n, r, a, f: prFin(a, P) }; });
    const M = SC[1], f = M.f, set = (id, t) => { $('pr_' + id).textContent = t; };
    set('o1', prE(f.net)); set('o2', prE(f.real)); set('o3', prE(f.l.inv)); set('o4', prE(f.g)); set('o5', prE(f.t));
    const rn = P.r - P.ter, rr = ((1 + rn / 100) / (1 + P.inf / 100) - 1) * 100;
    set('o6', prP(rn)); set('o7', prP(rr));
    const dbl = rn > 0 ? Math.log(2) / Math.log(1 + rn / 100) : null; set('o8', dbl ? dbl.toFixed(1).replace('.', ',') + ' J.' : '–');
    PR.last = { net: f.net, real: f.real, r: P.r, y: P.y }; $('pr_wp').style.display = P.ex ? '' : 'none';
    if (P.ex) { const w = M.a.w, last = M.a[M.a.length - 1], yw = w.dep ? Math.max(1, w.dep - P.y) : P.wy; set('w1', prE(w.net / (12 * yw))); set('w2', prE(w.tax)); set('w3', prE(last.v)); set('w4', w.dep ? 'leer in Jahr ' + w.dep : 'reicht ✓'); }
    const f4 = Number(fireF()) || 0, fxk = Number(fixk()) || 0, t5 = Number(S.f && S.f.runway5Target) > 0 ? Number(S.f.runway5Target) : 120 * fxk, n5 = S.f && typeof S.f.runway5Name === 'string' && S.f.runway5Name.trim() ? esc(S.f.runway5Name.trim()) : 'Stufe 5 · Eigenes Ziel';
    const GOALS = [['Stufe 4 · Fuck-Off-Zahl', f4], [n5, t5], ['Meilenstein', 250000], ['Meilenstein', 500000], ['Meilenstein', 1000000]].filter(x => x[1] > 0);
    const hit = (a, t) => { for (const d of a) { if (d.y > P.y) break; if (d.v / Math.pow(1 + P.inf / 100, d.y) >= t) return d.y; } return null; };
    const yr0 = new Date().getFullYear(), hitTxt = y => y === null ? '> ' + P.y + ' J.' : y === 0 ? 'bereits' : 'Jahr ' + y + ' (' + (yr0 + y) + ')';
    $('pr_gt').innerHTML = '<tr><th>Ziel</th><th>Betrag</th><th>Pess.</th><th>Normal</th><th>Opt.</th></tr>' + GOALS.map(x => '<tr><td>' + x[0] + '</td><td>' + prE(x[1]) + '</td>' + SC.map(s => '<td>' + hitTxt(hit(s.a, x[1])) + '</td>').join('') + '</tr>').join('');
    const mx0 = Math.max(...SC[2].a.map(d => d.v), 1);
    const CW = 360, CH = 200, pl = 44, pb = 22, pt = 8, pr = 8, mx = Math.max(mx0 * 1.05, f4 > 0 ? Math.min(f4 * 1.05, mx0 * 1.9) : 0), X = y => pl + (CW - pl - pr) * y / P.T, Y = v => pt + (CH - pt - pb) * (1 - v / mx);
    const line = (a, k) => a.map((d, i) => (i ? 'L' : 'M') + X(d.y).toFixed(1) + ' ' + Y(k(d)).toFixed(1)).join('');
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = mx * i / 4, y = Y(v); g += '<line x1="' + pl + '" x2="' + (CW - pr) + '" y1="' + y + '" y2="' + y + '" stroke="var(--ln)" stroke-width="1"/><text x="' + (pl - 5) + '" y="' + (y + 3) + '" font-size="8" text-anchor="end" fill="var(--mut)">' + (v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' M' : Math.round(v / 1000) + ' T') + '</text>'; }
    const st = Math.max(1, Math.ceil(P.T / 6)); for (let y = 0; y <= P.T; y += st) g += '<text x="' + X(y) + '" y="' + (CH - 7) + '" font-size="8" text-anchor="middle" fill="var(--mut)">' + y + 'J</text>';
    if (f4 > 0 && f4 <= mx) g += '<line x1="' + pl + '" x2="' + (CW - pr) + '" y1="' + Y(f4) + '" y2="' + Y(f4) + '" stroke="var(--or)" stroke-dasharray="4 3" opacity=".75"/><text x="' + (CW - pr) + '" y="' + (Y(f4) - 3) + '" font-size="8" text-anchor="end" fill="var(--ort)">Fuck-Off-Zahl</text>';
    const rl = M.a.map(d => ({ y: d.y, v: d.v / Math.pow(1 + P.inf / 100, d.y) }));
    g += '<path d="' + line(SC[2].a, d => d.v) + line(SC[0].a.slice().reverse(), d => d.v).replace(/M/, 'L') + 'Z" fill="var(--or)" opacity=".08"/>';
    g += '<path d="' + line(SC[2].a, d => d.v) + '" fill="none" stroke="var(--mut)" stroke-width="1" stroke-dasharray="3 3"/><path d="' + line(SC[0].a, d => d.v) + '" fill="none" stroke="var(--mut)" stroke-width="1" stroke-dasharray="3 3"/>';
    g += '<path d="' + line(M.a, d => d.inv) + '" fill="none" stroke="var(--ink)" stroke-width="1.5"/><path d="' + line(rl, d => d.v) + '" fill="none" stroke="var(--or)" stroke-width="1.2" opacity=".45"/><path d="' + line(M.a, d => d.v) + '" fill="none" stroke="var(--or)" stroke-width="2"/>';
    const e = M.a[P.y]; g += (P.ex ? '<line x1="' + X(P.y) + '" x2="' + X(P.y) + '" y1="' + pt + '" y2="' + (CH - pb) + '" stroke="var(--or)" stroke-dasharray="2 3"/>' : '') + '<circle cx="' + X(e.y) + '" cy="' + Y(e.v) + '" r="3.5" fill="var(--p)" stroke="var(--or)" stroke-width="1.5"/>';
    $('pr_ch').innerHTML = g;
    $('pr_sc').innerHTML = '<tr><th>Szenario</th><th>Rendite</th><th>Netto</th><th>Real</th></tr>' + SC.map(s => '<tr><td>' + s.n + '</td><td>' + prP(s.r) + '</td><td>' + prE(s.f.net) + '</td><td>' + prE(s.f.real) + '</td></tr>').join('');
    const A = [];
    if (rr <= 0) A.push(['w', 'CRIT · Real-Rendite ≤ 0', 'Inflation (' + prP(P.inf) + ') frisst die Rendite nach Kosten.']);
    if (SC[0].f.real < f.l.inv) A.push(['w', 'WARN · Pessimistisch real unter Einzahlung', 'Kaufkraft im Szenario ' + prP(SC[0].r) + ': ' + prE(SC[0].f.real) + ' bei ' + prE(f.l.inv) + ' Einzahlung.']);
    if (P.r > 10) A.push(['w', 'WARN · Rendite > 10 % p.a.', 'Langfristig sehr ambitioniert; Aktienmärkte liegen historisch oft bei 6–9 %.']);
    if (P.tx && f.g * (1 - P.tf / 100) < P.fb && f.g > 0) A.push(['', 'INFO · Gewinn unter Pauschbetrag', 'Es fällt rechnerisch keine Steuer an.']);
    A.push(['', 'INFO · Kosteneffekt', 'TER ' + prP(P.ter) + ' kostet über ' + P.y + ' Jahre ca. ' + prE(prSim(P.r, { ...P, ter: 0, ex: false })[P.y].v - M.a[P.y].v) + ' Endwert (brutto).']);
    A.push(['', 'INFO · Steuer-Anteil', f.g > 0 ? prP(f.t / f.g * 100) + ' des Gewinns gehen an das Finanzamt.' : 'Kein Gewinn.']);
    if (P.ex && M.a.w.dep) A.unshift(['w', 'CRIT · Kapital aufgebraucht', 'Im Normalfall ist das Vermögen in Jahr ' + M.a.w.dep + ' leer. Entnahme senken oder Laufzeit/Sparrate erhöhen.']);
    $('pr_fd').innerHTML = A.map(a => '<div class="al ' + a[0] + '"><small>' + a[1] + '</small><span>' + a[2] + '</span></div>').join('');
    $('pr_fh').textContent = '[Feed] Hinweise · Alerts ' + A.filter(a => a[0]).length;
    $('pr_tb').innerHTML = '<tr><th>Jahr</th><th>Eingezahlt</th><th>Wert</th><th>Real</th></tr>' + M.a.slice(1).map(d => '<tr><td>' + d.y + '</td><td>' + prE(d.inv) + '</td><td>' + prE(d.v) + '</td><td>' + prE(d.v / Math.pow(1 + P.inf / 100, d.y)) + '</td></tr>').join('');
    if (typeof blurNums === 'function') blurNums();
  }
  function prLumps() {
    $('pr_ll').innerHTML = PR.lump.map((l, i) => '<div class="al"><small>Jahr ' + l.y + '</small>' + (l.a > 0 ? '+' : '') + prE(l.a) + '<button class="chip" aria-label="Löschen" data-i="' + i + '" style="float:right">×</button></div>').join('');
    $('pr_ll').querySelectorAll('button').forEach(b => b.onclick = () => { PR.lump.splice(+b.dataset.i, 1); prLumps(); prRun(); });
  }
  function prPlanUi() {
    const L = prPlans();
    $('pr_pl').innerHTML = L.map((p, i) => '<div class="al"><small>' + esc(p.n) + '</small><button class="chip" data-l="' + i + '">Laden</button><button class="chip" data-d="' + i + '">Löschen</button></div>').join('');
    $('pr_pl').querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
      const p = L[+b.dataset.l]; if (!p || !p.v || !p.c) return;
      PR_IDS.forEach(k => { if (p.v[k] != null) { pe(k).value = p.v[k]; PR.v[k] = p.v[k]; } });
      PR_CK.forEach(k => { pe(k).checked = !!p.c[k]; PR.c[k] = !!p.c[k]; });
      PR.tf = Number(p.tf) || 0; PR.lump = (Array.isArray(p.l) ? p.l : []).map(x => ({ y: Number(x.y) || 0, a: Number(x.a) || 0 })); PR.pre = PR_PRE.length - 1;
      prUi(); prLumps(); prRun();
    });
    $('pr_pl').querySelectorAll('[data-d]').forEach(b => b.onclick = () => { L.splice(+b.dataset.d, 1); save(); prPlanUi(); });
    $('pr_pc').innerHTML = L.length ? '<tr><th>Plan</th><th>Netto</th><th>Real</th><th>Rend.</th><th>J.</th></tr>' + L.map(p => '<tr><td>' + esc(p.n) + '</td><td>' + prE(p.s ? p.s.net : 0) + '</td><td>' + prE(p.s ? p.s.real : 0) + '</td><td>' + prP(p.s ? p.s.r : 0) + '</td><td>' + (p.s ? p.s.y : 0) + '</td></tr>').join('') : '';
  }
  function prFromData() {
    const v = PR.v, ex = Number(S.f && S.f.exp) || Math.round(avg().o);
    v.s0 = Math.max(0, Math.round(nn())); v.sm = Math.max(0, Math.round(avg().s));
    if (Number(S.f && S.f.r) > 0) v.r = Number(S.f.r);
    if (ex > 0) v.wm = ex;
    ['s0', 'sm', 'r', 'wm'].forEach(k => { pe(k).value = v[k]; });
    PR.pre = PR_PRE.length - 1; prUi(); prRun();
  }
  function prInit() {
    if (!pe('s0')) return;
    $('pr_fm').onclick = prFromData;
    PR_IDS.concat(PR_CK).forEach(id => {
      const el = pe(id), h = () => {
        if (PR_CK.includes(id)) PR.c[id] = el.checked; else PR.v[id] = el.value;
        if (id === 'r') { PR.pre = PR_PRE.length - 1; prUi(); }
        prRun();
      };
      el.addEventListener('input', h); if (PR_CK.includes(id)) el.addEventListener('change', h);
    });
    $('pr_lb').onclick = () => { const y = Math.round(pn('ly')), a = pn('la'); if (y >= 1 && a) { PR.lump.push({ y, a }); PR.lump.sort((p, q) => p.y - q.y); pe('ly').value = ''; pe('la').value = ''; prLumps(); prRun(); } };
    $('pr_ps').onclick = () => {
      const n = (pe('pn').value || 'Plan ' + (prPlans().length + 1)).replace(/[<>&"]/g, ''), v = {}, c = {};
      PR_IDS.forEach(k => v[k] = pe(k).value); PR_CK.forEach(k => c[k] = pe(k).checked);
      prPlans().push({ n, v, c, tf: PR.tf, l: PR.lump.slice(), s: { ...PR.last } }); pe('pn').value = ''; save(); prPlanUi();
    };
    prUi(); prLumps(); prPlanUi(); prRun();
  }
  V.plan = prHTML;
  const _render3 = render;
  W.render = function () { _render3(); if (tab === 'plan') prInit(); };

  lockUI();
  render();
})();