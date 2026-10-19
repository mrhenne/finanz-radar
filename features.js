/* Finanz-Radar Erweiterungen. Geladen nach app.js. */
(function () {
  'use strict';
  const W = window, $ = id => document.getElementById(id);
  const css = '.lk{position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:20px}.dots{display:flex;gap:12px}.dots i{width:14px;height:14px;border:1px solid var(--or);border-radius:50%}.dots i.f{background:var(--or)}.pad{display:grid;grid-template-columns:repeat(3,76px);gap:10px}.pad button{height:56px;font:inherit;font-size:20px;background:var(--p);border:1px solid var(--ln);color:var(--ink);border-radius:0}.pad button:active{background:var(--orl)}.mini{width:90px!important;padding:4px 6px!important;font-size:14px!important}';
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const num = s => { s = String(s == null ? '' : s).replace(/[^\d,.\-+]/g, ''); if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); return parseFloat(s); };
  const monthNow = () => new Date().toISOString().slice(0, 7);
  const card = (t, h) => P('[' + t + ']', h);
  const button = (k, label) => '<button class="btn o" style="text-align:left" onclick="tab=\'' + k + '\';render();scrollTo(0,0)">' + label + '</button>';

  TABS.find(t => t[0] === 'fire')[1] = 'Fuck You';
  TT.fire = 'Fuck You';
  ['review', 'rebal', 'csv', 'sec'].forEach(k => { if (!SUB.includes(k)) SUB.push(k); });
  Object.assign(TT, { review: 'Rückblick', rebal: 'Rebalancing', csv: 'CSV-Import', sec: 'Sicherheit' });
  V.more = () => card('Module', [
    ['review','Monatsrückblick'], ['year','Jahresübersicht'], ['port','Portfolio & Risiko'],
    ['rebal','Rebalancing'], ['crypto','Krypto'], ['goals','Ziele & Sparrate'],
    ['tax','Steuer-Übersicht'], ['csv','CSV-Import'], ['sec','Sicherheit & PIN'],
    ['acct','Konto & Sync'], ['data','Daten & Backup']
  ].map(x => button(x[0], x[1])).join(''));

  /* Fuck-You-Level und Runway */
  const liquid = () => S.as.filter(a => ['cash','etf','aktie','crypto','gold'].includes(a.k)).reduce((s,a) => s + val(a), 0);
  const runway = () => { const f = fixk(); return f > 0 ? liquid() / f : 0; };
  let runway5Edit = false;
  function levelsHTML() {
    const r = runway(), f = fixk(), target = fireF(), net = nn();
    const customTarget = Number(S.f.runway5Target) > 0 ? Number(S.f.runway5Target) : 120*f;
    const customName = typeof S.f.runway5Name === 'string' && S.f.runway5Name.trim() ? S.f.runway5Name.trim() : 'Stufe 5 · Eigenes Ziel';
    const levels = [['Stufe 1 · 3 Monate Puffer', 3*f], ['Stufe 2 · 1 Jahr Freiheit', 12*f], ['Stufe 3 · 5 Jahre Freiheit', 60*f], ['Stufe 4 · Fuck-You-Zahl', target], [customName, customTarget]];
    const have = i => i < 3 ? liquid() : net;
    const done = levels.map((x,i) => x[1] > 0 && have(i) >= x[1]), current = done.indexOf(false);
    let html = '<div class="k big"><b>' + r.toFixed(1).replace('.', ',') + ' Monate</b><span>Runway bei Fixkosten von ' + eur(f) + ' / Monat</span></div>';
    html += levels.map((x,i) => {
      const p = x[1] > 0 ? Math.min(100, have(i) / x[1] * 100) : 0;
      const y = i === current ? simYears(have(i), avg().s, S.f.r, x[1]) : null;
      return '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between"><span>' + (done[i]?'✓':i===current?'▶':'○') + ' ' + x[0] + '</span><b>' + eur(x[1]) + '</b></div><div class="bar"><i style="width:' + p + '%"></i></div><div class="mut">' + (done[i]?'erreicht':pct(p) + ' · noch ' + eur(Math.max(0,x[1]-have(i))) + (y != null ? ' · ca. ' + y.toFixed(1).replace('.', ',') + ' Jahre' : '')) + '</div></div>';
    }).join('');
    html += runway5Edit
      ? '<div class="hatch"></div><label>Stufe 5 · Bezeichnung</label><input id="r5n" value="' + esc(customName) + '" maxlength="80"><label>Stufe 5 · Zielbetrag € (Standard: 10 Jahre Fixkosten)</label><input id="r5t" type="number" inputmode="decimal" value="' + customTarget + '"><button class="btn o" onclick="saveRunway5()">Stufe 5 speichern</button><button class="btn o" onclick="cancelRunway5()">Abbrechen</button>'
      : '<div class="hatch"></div><button class="btn o" onclick="editRunway5()">✎ Stufe 5 bearbeiten</button>';
    return card('Runway · Fuck-You-Level', html + '<div class="note">Runway ist eine grobe Orientierung: liquide Mittel geteilt durch monatliche Fixkosten. ETF, Aktien, Gold und Krypto können im Verkaufszeitpunkt stark schwanken. Stufen 1 bis 3 vergleichen liquide Mittel, Stufe 4 und 5 den Net Worth.</div>');
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
  V.fire = () => levelsHTML() + oldFire().replace('[FIRE] Zielzahl', '[FIRE] Fuck-You-Zahl').replace('FIRE-Zahl', 'Fuck-You-Zahl');
  V.home = () => oldHome() + card('Runway · Freiheit', '<div class="k"><b>' + runway().toFixed(1).replace('.', ',') + ' Monate</b><span>so lange reichen liquide Mittel bei heutigen Fixkosten</span></div><div class="bar"><i style="width:' + Math.min(100, runway()/12*100) + '%"></i></div><div class="mut">Orientierungsmarke: 12 Monate · Details im Tab „Fuck You“</div>');

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
    let html = '<input type="file" accept=".csv,.txt,text/csv" onchange="csvFile(this.files[0])"><label>Oder CSV-Text einfügen</label><textarea id="csvt" rows="3" placeholder="Buchungstag;Verwendungszweck;Betrag …"></textarea><button class="btn o" onclick="csvLoad($(\'csvt\').value)">Einlesen</button><div class="note">' + esc(CSV.msg) + ' CSV mit Semikolon oder Komma, Datum TT.MM.JJJJ und Betrag 1.234,56 werden unterstützt. Duplikate werden übersprungen.</div>';
    if (CSV.head.length) html += card('Spalten', '<div class="row"><div><label>Datum</label><select onchange="csvSet(\'d\',this.value)">' + opts(CSV.col.d) + '</select></div><div><label>Betrag</label><select onchange="csvSet(\'a\',this.value)">' + opts(CSV.col.a) + '</select></div></div>');
    if (CSV.rows.length) html += card('Vorschau', fresh + ' neu / ' + (CSV.rows.length-fresh) + ' Duplikate') + CSV.rows.slice(0,15).map((r,i) => '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between"><span>' + r.d.slice(8) + '.' + r.d.slice(5,7) + '. ' + esc(r.n.slice(0,34)) + '</span><b class="' + (r.a>0?'pos':'neg') + '">' + eur(r.a) + '</b></div>' + (r.dup ? '<div class="mut">Duplikat, wird übersprungen</div>' : '<select onchange="csvCat(' + i + ',this.value)">' + categories.map(c => '<option' + (c===r.c?' selected':'') + '>' + c + '</option>').join('') + '</select>') + '</div>').join('') + '<button class="btn" onclick="csvGo()">' + fresh + ' Buchungen importieren</button>';
    return bk() + card('CSV-Import · Kontoauszug', html);
  };

  /* Monatsrückblick */
  V.review = () => {
    const parts = mo.split('-').map(Number), prior = new Date(parts[0],parts[1]-2,1), pm = prior.getFullYear() + '-' + String(prior.getMonth()+1).padStart(2,'0');
    const now = S.tx.filter(x => x.d.startsWith(mo)), before = S.tx.filter(x => x.d.startsWith(pm));
    const inc=sm(now,'in'), out=sm(now,'out'), pinc=sm(before,'in'), pout=sm(before,'out');
    const rate=inc?(inc-out)/inc*100:0, prate=pinc?(pinc-pout)/pinc*100:0, cats={};
    now.filter(x => !IN.includes(x.c) && x.c !== 'Sparen/Invest').forEach(x => cats[x.c]=(cats[x.c]||0)+x.a);
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0], big=now.filter(x=>!IN.includes(x.c) && x.c!=='Sparen/Invest').sort((a,b)=>b.a-a.a)[0];
    const compare = (a,b,lowerBad) => { const d=a-b, good=lowerBad?d<=0:d>=0; return '<small class="' + (good?'pos':'neg') + '">' + (d>=0?'+':'') + eur(d) + ' zum Vormonat</small>'; };
    const highlights=[];
    if (top) highlights.push('Größter Ausgabenposten: <b>' + esc(top[0]) + '</b> mit ' + eur(top[1]));
    if (big) highlights.push('Größte Einzelausgabe: <b>' + esc(big.n || big.c) + '</b> ' + eur(big.a));
    const saved=now.filter(x=>x.c==='Sparen/Invest').reduce((s,x)=>s+x.a,0);
    if (saved) highlights.push('Investiert/gespart: <b>' + eur(saved) + '</b>');
    const currentHist=(S.hist||[]).find(x=>x.m===mo), prevHist=(S.hist||[]).find(x=>x.m===pm);
    if (currentHist && prevHist) highlights.push('Net Worth Veränderung: <b>' + eur(currentHist.nw-prevHist.nw) + '</b>');
    const breaches=Object.keys(S.bud||{}).filter(c => S.bud[c]>0 && (cats[c]||0)>S.bud[c]);
    if (breaches.length) highlights.push('Budget überschritten: <b class="neg">' + breaches.map(esc).join(', ') + '</b>');
    const verdict=!inc?'Noch keine Einnahmen in diesem Monat gebucht.':rate>=30?'Starker Monat: mehr als 30 % Sparquote.':rate>=15?'Solider Monat.':rate>=0?'Wenig Spielraum zum Sparen.':'Mehr ausgegeben als eingenommen.';
    return bk() + card('Zeitraum',moNav()) + card('Monatsrückblick','<div class="k"><b>' + verdict + '</b></div><div class="g2"><div class="k"><b class="pos">' + eur(inc) + '</b><span>Einnahmen</span>' + compare(inc,pinc,false) + '</div><div class="k"><b class="neg">' + eur(out) + '</b><span>Ausgaben</span>' + compare(out,pout,true) + '</div><div class="k"><b>' + eur(inc-out) + '</b><span>Cashflow</span>' + compare(inc-out,pinc-pout,false) + '</div><div class="k"><b>' + pct(rate) + '</b><span>Sparquote</span>' + compare(rate,prate,false) + '</div></div>') + (highlights.length ? card('Highlights',highlights.map(h=>'<div class="li"><span>' + h + '</span></div>').join('')) : '');
  };

  /* Budgets und Rebalancing */
  const budgets = () => S.bud || (S.bud = {});
  const allocation = () => S.f.alloc || (S.f.alloc = {});
  W.setBud = (c,v) => { budgets()[c] = Math.max(0,num(v)||0); save(); render(); };
  W.setAl = (k,v) => { allocation()[k] = Math.max(0,num(v)||0); save(); render(); };
  const oldCash = V.cash;
  V.cash = () => oldCash() + card('Budgets · Monatslimits', OUT.filter(c => c !== 'Sparen/Invest').map(c => {
    const spent=mt().filter(x=>x.c===c).reduce((s,x)=>s+x.a,0), limit=budgets()[c]||0, p=limit?spent/limit*100:0;
    return '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>' + c + '</span><span class="' + (p>100?'neg p':p>85?'neg':'') + '">' + eur(spent) + ' / <input class="mini" type="number" inputmode="decimal" value="' + (limit||'') + '" placeholder="Limit" onchange="setBud(\'' + c + '\',this.value)"></span></div>' + (limit ? '<div class="bar"><i style="width:' + Math.min(100,p) + '%;' + (p>85?'background:#ff4d6d':'') + '"></i></div><div class="' + (p>100?'neg p':'mut') + '">' + (p>100?'Über Limit um '+eur(spent-limit):pct(p)+' genutzt · noch '+eur(limit-spent)) + '</div>' : '') + '</div>';
  }).join(''));
  V.rebal = () => {
    const t=allocation(), total=nw(), keys=Object.keys(KIND), sum=keys.reduce((s,k)=>s+(+t[k]||0),0), gaps=[];
    const rows=keys.map(k => {
      const actual=byK(k), target=+t[k]||0, delta=total*target/100-actual, weight=total?actual/total*100:0;
      if (delta>total*.02) gaps.push([k,delta]);
      return '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="color:' + COL[k] + '">■ ' + KIND[k] + '</span><span>Ist ' + pct(weight) + ' · Ziel <input class="mini" style="width:64px!important" type="number" inputmode="decimal" value="' + (t[k]!=null?t[k]:'') + '" placeholder="0" onchange="setAl(\'' + k + '\',this.value)"> %</span></div>' + ((target||actual) ? '<div class="' + (Math.abs(delta)<total*.02?'pos':'neg') + '">' + (Math.abs(delta)<total*.02?'im Zielbereich':(delta>0?'zukaufen ':'abbauen ')+eur(Math.abs(delta))) + '</div>' : '') + '</div>';
    }).join('');
    const sr=avg().s, gapTotal=gaps.reduce((s,x)=>s+x[1],0);
    return bk() + card('Rebalancing · Ziel-Aufteilung','<div class="mut">Summe der Ziele: <b class="' + (Math.abs(sum-100)<.01?'pos':'neg') + '">' + pct(sum) + '</b> (soll 100 %)</div>' + rows + '<div class="note">Zielwerte sind Planungswerte, keine automatische Handelsanweisung. Verkäufe können Steuern auslösen.</div>') + (gaps.length && sr>0 && gapTotal>0 ? card('Sparrate verteilen','<div class="mut">Ø Sparleistung ' + eur(sr) + ' / Monat</div>' + gaps.map(x=>'<div class="li"><span>' + KIND[x[0]] + '</span><b>' + eur(sr*x[1]/gapTotal) + '</b></div>').join('')) : '');
  };

  /* Gerätesperre: Die PIN liegt lokal, nicht in der Cloud. */
  const PIN_KEY='fr_pin';
  const pinConfig=()=>{ try { return JSON.parse(localStorage.getItem(PIN_KEY)||'null'); } catch(e) { return null; } };
  async function pinHash(pin) {
    const bytes=new TextEncoder().encode('fr-'+pin);
    if (W.crypto && W.crypto.subtle) {
      const digest=await W.crypto.subtle.digest('SHA-256',bytes);
      return Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
    }
    let h=5381; for (const ch of 'fr-'+pin) h=(h*33+ch.charCodeAt(0))>>>0; return 'x'+h;
  }
  let buffer='', locked=!!pinConfig(), failed=0, blockedUntil=0, hiddenAt=0, pinMessage='';
  function lockUI() {
    let el=$('lk');
    if (!locked || !pinConfig()) { if(el) el.remove(); return; }
    if (!el) { el=document.createElement('div'); el.id='lk'; el.className='lk'; document.body.appendChild(el); }
    const config=pinConfig(), wait=Date.now()<blockedUntil;
    el.innerHTML='<div style="font-size:12px;letter-spacing:.14em;color:var(--mut)">FINANZ/<b style="color:var(--ink)">GESPERRT</b></div><div class="dots">' + Array.from({length:config.n},(_,i)=>'<i class="' + (i<buffer.length?'f':'') + '"></i>').join('') + '</div><div class="mut">' + (wait?'Zu viele Versuche: bitte 30 Sekunden warten':'PIN eingeben') + '</div><div class="pad">' + [1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':'<button onclick="pinKey(\''+k+'\')">'+k+'</button>').join('') + '</div>';
  }
  W.pinKey = async key => {
    if (Date.now()<blockedUntil) return;
    const config=pinConfig(); if(!config){locked=false;return lockUI();}
    if(key==='⌫') buffer=buffer.slice(0,-1); else if(buffer.length<config.n) buffer+=key;
    if(buffer.length===config.n) {
      const ok=await pinHash(buffer)===config.h; buffer='';
      if(ok){locked=false;failed=0;} else if(++failed>=3){blockedUntil=Date.now()+30000;failed=0;setTimeout(lockUI,30100);}
    }
    lockUI();
  };
  W.setPin = async () => {
    const a=$('pn1').value, b=$('pn2').value;
    if(!/^\d{4,6}$/.test(a)||a!==b){pinMessage='Bitte dieselbe PIN mit 4 bis 6 Ziffern zweimal eingeben.';return render();}
    try { localStorage.setItem(PIN_KEY,JSON.stringify({h:await pinHash(a),n:a.length,m:+$('lm').value})); pinMessage='PIN gespeichert.'; }
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
    return bk()+card('Sicherheit · PIN','<div class="' + (p?'pos':'mut') + '">' + (p?'PIN ist aktiv ('+p.n+' Stellen)':'Keine PIN gesetzt') + '</div><label>Neue PIN (4 bis 6 Ziffern)</label><input id="pn1" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><label>PIN wiederholen</label><input id="pn2" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><label>Automatisch sperren nach</label><select id="lm">' + [[0,'sofort beim Verlassen'],[1,'1 Minute'],[5,'5 Minuten'],[15,'15 Minuten']].map(x=>'<option value="'+x[0]+'" '+(p&&p.m===x[0]?'selected':'')+'>'+x[1]+'</option>').join('') + '</select><button class="btn" onclick="setPin()">PIN speichern</button>' + (p?'<button class="btn o" onclick="lockNow()">Jetzt sperren</button><button class="btn o" onclick="rmPin()">PIN entfernen</button>':'') + '<div class="note">' + esc(pinMessage) + ' Die PIN gilt pro Gerät und wird nicht in die Cloud übertragen. Sie schützt vor neugierigen Blicken, ersetzt aber keine Verschlüsselung der Daten.</div>');
  };
/* ---------- 7. Fuck-You-Rechner: Ansparen bis zur Zahl, dann Entnahme (Szenarien, Steuer) ---------- */
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
const fm=v=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
function fxHTML(){const P=fxP(),sp=2,N=fxSim(P.r,P),Pe=fxSim(P.r-sp,P),O=fxSim(P.r+sp,P),y0=new Date().getFullYear(),T=Math.ceil(Math.max(N.ya,Pe.ya,O.ya))+P.wy,yrsW=N.dep||P.wy,real=v=>v/Math.pow(1+P.inf/100,N.ya),mx=maxW(P),rate=N.vs?P.wm*12/N.vs*100:0;
const rows=[];for(let t=0;t<=T;t++)rows.push(['Jahr '+t+' · '+(y0+t),atY(N.rows,t),atY(Pe.rows,t),atY(O.rows,t)]);
const kp=(b,l,c)=>`<div class="k"><b class="${c||''}">${b}</b><span>${l}</span></div>`;
const edit=fxEdit?`<div class="row"><div><label>Ausgaben/Mon. €</label><input id="fe" type="number" inputmode="decimal" value="${S.f.exp}" placeholder="${Math.round(fixk())}"></div><div><label>Entnahme % (Zielzahl)</label><input id="fw" type="number" step="0.1" value="${S.f.wr}"></div></div><div class="row"><div><label>Entnahme/Monat €</label><input id="fm" type="number" inputmode="decimal" value="${S.f.wm||''}" placeholder="${Math.round(P.wm)}"></div><div><label>Dauer (Jahre)</label><input id="fy" type="number" value="${P.wy}"></div></div><div class="row"><div><label>Rendite % p.a.</label><input id="fr" type="number" step="0.1" value="${S.f.r}"></div><div><label>Inflation %</label><input id="fi" type="number" step="0.1" value="${P.inf}"></div></div><label>Fuck-You-Zahl € (leer = automatisch)</label><input id="ftarget" type="number" inputmode="decimal" value="${S.f.fireTarget||''}" placeholder="${Math.round(((parseFloat(S.f.exp)||fixk())*12)/(((+S.f.wr)||4)/100))}"><label class="mut" style="display:flex;gap:8px;align-items:center;text-transform:none"><input type="checkbox" id="fx_wi" style="width:auto" ${P.wi?'checked':''}> Entnahme steigt mit Inflation</label><button class="btn" onclick="setFx()">Übernehmen</button><button class="btn o" onclick="fxToggle(false)">Abbrechen</button>`:`<button class="btn o" onclick="fxToggle(true)">✎ Annahmen bearbeiten</button><div class="mut" style="margin-top:6px">Rendite ${fm(P.r)} % · Inflation ${fm(P.inf)} % · Entnahme ${eur(P.wm)}/Mon. · ${P.wy} J. · Steuer ${fm(P.kt)} % (30 % Teilfreistellung)</div>`;
const msg=!N.ok?`<div class="neg p">Die Zielzahl ${eur(P.F)} wird in 60 Jahren nicht erreicht. Mehr sparen, weniger Fixkosten oder höhere Rendite nötig.</div>`:N.dep?`<div class="neg p">Kapital reicht nur bis Jahr ${fm(N.ya+N.dep)} (${N.dep} J. Entnahme). Nachhaltig möglich: ${eur(mx)}/Monat.</div>`:`<div class="pos">✓ Kapital reicht für die gesamte Entnahmedauer.</div>`;
return P_('[Entnahme] Fuck-You-Rechner',`<div class="g2">${kp(N.ok?fm(N.ya)+' J.':'–','bis Fuck-You-Zahl (ca. '+(N.ok?y0+Math.ceil(N.ya):'–')+')')}${kp(eur(N.vs),'Kapital bei Start · real '+eur(real(N.vs)))}${kp(eur(N.net/(12*yrsW)),'Ø Entnahme netto / Monat','pos')}${kp(eur(N.tax),'Steuer in der Entnahme')}${kp(N.dep?'leer in Jahr '+fm(N.ya+N.dep):'reicht ✓','Kapital',N.dep?'neg':'pos')}${kp(eur(N.rest),'Restkapital nach '+P.wy+' J.')}${kp(eur(mx),'max. nachhaltige Entnahme/Mon. (brutto)')}${kp(fm(rate)+' %','Entnahmerate zu Beginn',rate>4?'neg':'pos')}</div>`+msg+lc(rows,['Normal','Pessimistisch','Optimistisch'],['var(--or)','var(--mut)','var(--mut)'],{dash:1})+`<div class="mut" style="margin-top:6px">Vermögen über die Zeit: erst Ansparen (Ø Sparleistung ${eur(P.sr)}/Mon.), ab Erreichen der Zielzahl Entnahme. Szenarien ±${sp} % Rendite. Tippen/Ziehen zeigt Jahr und Werte.</div>`+`<div class="hatch"></div>`+`<table style="border-collapse:collapse;width:100%;font-size:11px"><tr><th align="left">Szenario</th><th align="right">Rendite</th><th align="right">Start nach</th><th align="right">Rest</th></tr>${[['Pessimistisch',P.r-sp,Pe],['Normal',P.r,N],['Optimistisch',P.r+sp,O]].map(([n,r,x])=>`<tr><td style="padding:6px 4px;border-bottom:1px solid var(--ln)">${n}</td><td align="right" style="border-bottom:1px solid var(--ln)">${fm(r)} %</td><td align="right" style="border-bottom:1px solid var(--ln)">${x.ok?fm(x.ya)+' J.':'–'}</td><td align="right" style="border-bottom:1px solid var(--ln)" class="${x.dep?'neg':''}">${x.dep?'leer J. '+fm(x.ya+x.dep):eur(x.rest)}</td></tr>`).join('')}</table>`+`<div class="hatch"></div>`+edit+`<div class="note">Vereinfachung: Rendite nach Kosten, Steuer nur auf den Gewinnanteil jeder Entnahme (Pauschbetrag ${eur(P.pb)}/Jahr), keine Vorabpauschale/Kirchensteuer. Keine Anlageberatung.</div>`)}
const P_=P;
W.fxToggle=v=>{fxEdit=v;render()};
W.setFx=()=>{const g=i=>parseFloat(String($(i).value).replace(',','.')),f=S.f;f.exp=$('fe').value;f.wr=g('fw')||4;f.r=isFinite(g('fr'))?g('fr'):6;f.wm=g('fm')||0;f.wy=Math.max(1,Math.min(80,g('fy')||30));f.inf=isFinite(g('fi'))?g('fi'):2;f.fireTarget=g('ftarget')>0?g('ftarget'):'';f.wi=$('fx_wi').checked;fxEdit=false;save();render()};
const _fire2=V.fire;V.fire=()=>_fire2().replace(/<div class="hatch"><\/div><div class="row"><div><label>Ausgaben\/Mon\. €<\/label>[\s\S]*?onclick="setF\(\)">Übernehmen<\/button>/,'')+fxHTML();
const _render2=render;W.render=function(){if(tab!==lastT){fxEdit=false;lastT=tab}_render2()};

  lockUI();
  render();
})();