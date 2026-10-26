/* Finanz-Radar Erweiterungen: Sparplan-Check, Vorschau, Monatsabschluss, Schnellerfassung, CSV-Import, Sicherheit */
(function () {
  'use strict';
  const W = window;
  const card = (t, h) => P('[' + t + ']', h);
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : 0; };
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const addM = (ym, k) => { const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + k, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const monLabel = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }); };
  const txOf = ym => S.tx.filter(x => x.d.startsWith(ym));
  const colored = (v, txt) => '<span class="' + (v < 0 ? 'neg' : 'pos') + '">' + txt + '</span>';
  const insAfterFirst = (html, panel) => { const i = html.indexOf('<div class="panel"', 10); return i < 0 ? html + panel : html.slice(0, i) + panel + html.slice(i); };
  const wrap = (name, fn) => { const old = V[name]; V[name] = function () { return fn(old.call(V)); }; };
  const toast = msg => { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  const ALLC = () => IN.concat(OUT);

  /* ---------- Kategorie-Vorschlag (Verlauf + Stichworte) ---------- */
  const KW = [
    [/rewe|aldi|lidl|edeka|kaufland|netto|penny|rossmann|bäcker|baecker|metzger|supermarkt|lebensmittel/i, 'Lebensmittel'],
    [/tankstelle|shell|aral|esso|bahn|uber|bolt|bvg|vrr|ticket|parkhaus|parken|kfz|adac/i, 'Mobilität'],
    [/netflix|spotify|disney|prime video|dazn|youtube|apple\.com|icloud|google one|abo\b/i, 'Abos'],
    [/miete|nebenkosten|strom|stadtwerke|wasser|internet|telekom|vodafone|hausgeld/i, 'Wohnen'],
    [/versicherung|pkv|krankenkasse|haftpflicht|allianz|huk|ergo|axa|debeka/i, 'Versicherung'],
    [/kino|restaurant|café|cafe|pizza|mcdonald|burger|urlaub|hotel|konzert|steam|playstation|fitness|sport/i, 'Freizeit'],
    [/etf|sparplan|trade republic|scalable|bitcoin|krypto|coinbase|wertpapier|depot/i, 'Sparen/Invest'],
    [/gehalt|lohn|bezüge|bezuege/i, 'Gehalt'],
    [/honorar|nebenjob/i, 'Nebenjob']
  ];
  function suggestCat(note, sign) {
    const n = String(note || '').toLowerCase().trim();
    let best = '';
    if (n.length >= 2) {
      const exact = {}, part = {};
      const toks = n.split(/[^a-z0-9äöüß]+/).filter(t => t.length >= 4);
      S.tx.forEach(x => {
        const xn = String(x.n || '').toLowerCase();
        if (!xn) return;
        if (xn === n) exact[x.c] = (exact[x.c] || 0) + 1;
        else if (toks.some(t => xn.includes(t))) part[x.c] = (part[x.c] || 0) + 1;
      });
      const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
      best = (top(exact) || top(part) || [''])[0];
      if (!best) { const k = KW.find(r => r[0].test(n)); if (k) best = k[1]; }
    }
    if (best && sign != null) { if (sign > 0 && !IN.includes(best) && best !== 'Sparen/Invest') best = ''; if (sign < 0 && IN.includes(best)) best = ''; }
    return best;
  }

  /* ---------- 1. Sparplan-Check ---------- */
  const spT = () => Math.max(0, Number(S.spl && S.spl.t) || 0);
  W.setSpl = () => { S.spl = { t: Math.max(0, Math.round(num($('sp_t').value))) }; save(); render(); };
  W.useSpl = v => { S.spl = { t: Math.max(0, Math.round(v)) }; save(); render(); };
  function spPanel() {
    const t = spT(), a = avg(), ist = invSum(txOf(mo)), sug = Math.round(a.s / 10) * 10;
    const cur = new Date().toISOString().slice(0, 7), day = new Date().getDate();
    let h = '<div class="row"><div><label>Sparziel pro Monat €</label><input id="sp_t" type="number" inputmode="decimal" value="' + (t || '') + '" placeholder="z. B. ' + (sug || 300) + '"></div><button class="btn o" style="margin:0;align-self:end" onclick="setSpl()">Speichern</button></div>';
    if (!t) return card('Sparplan', h + '<div class="note">Lege ein monatliches Sparziel fest, dann zeige ich dir Soll und Ist.' + (sug > 0 ? ' Dein Ø investiert pro Monat: ' + eur(a.s) + '. <a href="#" onclick="useSpl(' + sug + ');return false" style="color:var(--or)">' + eur(sug) + ' übernehmen</a>' : '') + '</div>');
    const pc = Math.min(100, ist / t * 100), diff = ist - t;
    let status;
    if (diff >= 0) status = '<b class="pos">✓ Plan erfüllt</b> · ' + eur(ist) + ' von ' + eur(t) + (diff > 0 ? ' (+' + eur(diff) + ')' : '');
    else if (mo === cur && day < 25) status = '<b>Noch ' + eur(-diff) + ' bis zum Plan</b> · ' + eur(ist) + ' von ' + eur(t);
    else status = '<b class="neg">Unter Plan: ' + eur(diff) + '</b> · ' + eur(ist) + ' von ' + eur(t);
    const rows = []; let streak = 0, counting = true;
    for (let i = 0; i > -6; i--) {
      const m = addM(mo, i), l = txOf(m), v = invSum(l), hit = v >= t;
      rows.push('<div class="li"><span>' + monLabel(m) + '</span><span>' + (l.length ? eur(v) + ' / ' + eur(t) + ' ' + (hit ? '<span class="pos">✓</span>' : '<span class="neg">✗</span>') : '–') + '</span></div>');
      if (counting) { if (l.length && hit) streak++; else if (i !== 0) counting = false; }
    }
    h += '<div style="margin-top:10px">' + status + '</div><div class="bar"><i style="width:' + pc + '%"></i></div><div class="mut">' + pct(ist / t * 100) + ' vom Ziel' + (streak ? ' · ' + streak + (streak === 1 ? ' Monat' : ' Monate') + ' in Folge im Plan' : '') + '</div><div style="margin-top:8px">' + rows.join('') + '</div>';
    return card('Sparplan', h);
  }

  /* ---------- Backup-Hinweis ---------- */
  const expAt = () => { try { return Number(localStorage.getItem('fr_exp')) || 0; } catch (e) { return 0; } };
  W.dlBackup = () => {
    const b = new Blob([JSON.stringify(S)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'finanz-radar-backup-' + today() + '.json'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    try { localStorage.setItem('fr_exp', String(Date.now())); } catch (e) { }
    toast('Backup gespeichert'); render();
  };
  function backupBanner() {
    if (S.tx.length < 5) return '';
    const age = expAt() ? Math.floor((Date.now() - expAt()) / 86400000) : null;
    if (age !== null && age < 30) return '';
    return card('Hinweis', '<b class="neg">Backup fällig</b><div class="mut" style="margin-top:4px">' + (age === null ? 'Noch kein Datei-Backup gespeichert.' : 'Letztes Datei-Backup vor ' + age + ' Tagen.') + '</div><button class="btn o" onclick="dlBackup()">Jetzt als Datei sichern</button>');
  }
  wrap('home', h => insAfterFirst(h, backupBanner() + spPanel()));

  /* ---------- 2. Vorschau nächste 3 Monate ---------- */
  const PV = { v: true };
  W.pvToggle = () => { PV.v = !PV.v; render(); };
  function pvPanel() {
    const rec = S.rec || [];
    if (!rec.length) return card('Vorschau', '<span class="mut">Buche etwas mit „wiederkehrend“, dann zeige ich dir hier die nächsten 3 Monate.</span>');
    const inc = rec.filter(r => IN.includes(r.c)).reduce((s, r) => s + r.a, 0), inv = rec.filter(r => r.c === 'Sparen/Invest').reduce((s, r) => s + r.a, 0), exp = rec.filter(r => !IN.includes(r.c) && r.c !== 'Sparen/Invest').reduce((s, r) => s + r.a, 0);
    const varE = PV.v ? Math.max(0, avg().o - exp) : 0;
    let cash = byK('cash'), neg = null, rows = '';
    for (let i = 1; i <= 3; i++) {
      const m = addM(mo, i), out = exp + varE;
      cash += inc - out - inv; if (cash < 0 && !neg) neg = monLabel(m);
      rows += '<tr><td>' + monLabel(m) + '</td><td>' + eur(inc) + '</td><td>' + eur(out) + '</td><td>' + eur(inv) + '</td><td>' + colored(cash, eur(cash)) + '</td></tr>';
    }
    return card('Vorschau', '<div class="row" style="align-items:center"><span class="mut" style="flex:1">Cash-Bestand heute: ' + eur(byK('cash')) + '</span><button class="chip' + (PV.v ? ' on' : '') + '" onclick="pvToggle()">+ Ø variable Ausgaben</button></div><div class="tw"><table class="pvt"><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Investiert</th><th>Cash</th></tr>' + rows + '</table></div>'
      + (neg ? '<div class="neg" style="margin-top:8px">Achtung: Der Cash-Bestand wird voraussichtlich im ' + neg + ' negativ.</div>' : '')
      + '<div class="note">Basis: deine wiederkehrenden Vorlagen und der Cash-Bestand aus Vermögen. Ø variable Ausgaben = Ø Ausgaben minus Vorlagen.</div>');
  }
  wrap('cash', h => h.replace('<div class="panel" data-pk="cash:Neu', pvPanel() + '<div class="panel" data-pk="cash:Neu'));

  /* ---------- 4. Monatsabschluss (Rückblick) ---------- */
  W.setMNote = v => { S.mnotes = S.mnotes || {}; const t = clean(v).trim().slice(0, 500); if (t) S.mnotes[mo] = t; else delete S.mnotes[mo]; save(); toast('Notiz gespeichert'); };
  function histPanel() {
    const rows = []; let best = null, worst = null;
    for (let i = -5; i <= 0; i++) {
      const m = addM(mo, i), l = txOf(m), inc = sm(l, 'in'), out = sm(l, 'out'), inv = invSum(l), q = inc ? inv / inc * 100 : null;
      rows.push({ m, has: l.length > 0, inc, out, inv, q });
      if (q !== null) { if (!best || q > best.q) best = rows[rows.length - 1]; if (!worst || q < worst.q) worst = rows[rows.length - 1]; }
    }
    const t = rows.map(r => '<tr><td>' + monLabel(r.m) + '</td>' + (r.has ? '<td>' + eur(r.inc) + '</td><td>' + eur(r.out) + '</td><td>' + eur(r.inv) + '</td><td>' + (r.q === null ? '–' : pct(r.q) + (best && r.m === best.m && best !== worst ? ' ★' : '')) + '</td>' : '<td colspan="4" class="mut">keine Daten</td>') + '</tr>').join('');
    return card('Verlauf', '<div class="tw"><table class="pvt"><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Investiert</th><th>Sparquote</th></tr>' + t + '</table></div><div class="note">★ = beste Sparquote der letzten 6 Monate.</div>');
  }
  function tipsPanel() {
    const cur = {}, hist = {}; let n = 0;
    txOf(mo).filter(x => !IN.includes(x.c) && x.c !== 'Sparen/Invest').forEach(x => cur[x.c] = (cur[x.c] || 0) + x.a);
    for (let i = -6; i <= -1; i++) { const l = txOf(addM(mo, i)); if (!l.length) continue; n++; l.filter(x => !IN.includes(x.c) && x.c !== 'Sparen/Invest').forEach(x => hist[x.c] = (hist[x.c] || 0) + x.a); }
    let h = '';
    if (n >= 1) {
      const tips = Object.keys(Object.assign({}, cur, hist)).map(c => { const a = (hist[c] || 0) / n, v = cur[c] || 0; return { c, v, a, d: v - a }; })
        .filter(x => Math.abs(x.d) >= 30 && (x.a === 0 || Math.abs(x.d) >= x.a * .15)).sort((p, q) => Math.abs(q.d) - Math.abs(p.d)).slice(0, 3);
      h += tips.length ? tips.map(x => '<div class="li"><span>' + esc(x.c) + '<small>Ø ' + eur(x.a) + ' (letzte ' + n + (n === 1 ? ' Monat' : ' Monate') + ')</small></span><span>' + eur(x.v) + ' ' + colored(-x.d, (x.d > 0 ? '+' : '') + eur(x.d)) + '</span></div>').join('') : '<span class="mut">Keine auffälligen Abweichungen zum Durchschnitt.</span>';
    } else h = '<span class="mut">Für Tipps brauche ich mindestens einen Vormonat mit Buchungen.</span>';
    return card('Abschluss', h + '<label>Notiz zum Monat</label><textarea rows="3" maxlength="500" onchange="setMNote(this.value)" placeholder="Was war los? Was nimmst du mit?">' + esc((S.mnotes && S.mnotes[mo]) || '') + '</textarea>');
  }
  wrap('review', h => h + tipsPanel() + histPanel());

  /* ---------- 6. Schnellerfassung ---------- */
  const Q = { manual: false };
  function topCats() {
    const c = {}; S.tx.slice(-150).forEach(x => c[x.c] = (c[x.c] || 0) + 1);
    const t = Object.entries(c).sort((a, b) => b[1] - a[1]).map(e => e[0]).filter(k => ALLC().includes(k)).slice(0, 5);
    return t.length ? t : ['Lebensmittel', 'Mobilität', 'Freizeit', 'Gehalt', 'Sparen/Invest'];
  }
  function buildSheet() {
    if (document.getElementById('qsh')) return;
    const el = document.createElement('div'); el.id = 'qsh'; el.className = 'qsh';
    el.innerHTML = '<div><h2 style="margin:0 0 10px;font-size:11px;letter-spacing:.14em;color:var(--mut);text-transform:uppercase">[Schnell] Buchung</h2>'
      + '<input id="q_a" type="number" inputmode="decimal" placeholder="Betrag €" style="font-size:22px"><input id="q_n" placeholder="Notiz, z. B. Rewe" style="margin-top:8px" autocomplete="off" oninput="qSug()">'
      + '<div class="chips" id="q_ch" style="margin-top:8px"></div><div class="row" style="margin-top:8px"><select id="q_c" onchange="Q_manual()"></select><input id="q_d" type="date"></div>'
      + '<div class="mut" id="q_h" style="margin-top:6px;min-height:14px"></div><div class="row"><button class="btn o" onclick="qClose()">Abbrechen</button><button class="btn" onclick="qSave()">Buchen</button></div></div>';
    el.addEventListener('click', e => { if (e.target === el) qClose(); });
    document.body.appendChild(el);
  }
  W.Q_manual = () => { Q.manual = true; qChips(); };
  function qChips() {
    const box = document.getElementById('q_ch'), sel = $('q_c').value;
    box.innerHTML = '';
    topCats().forEach(c => { const b = document.createElement('button'); b.className = 'chip' + (c === sel ? ' on' : ''); b.textContent = c; b.onclick = () => { $('q_c').value = c; Q.manual = true; qChips(); }; box.appendChild(b); });
  }
  W.qSug = () => {
    if (Q.manual) return;
    const s = suggestCat($('q_n').value, null);
    if (s) { $('q_c').value = s; $('q_h').textContent = 'Vorschlag: ' + s; } else $('q_h').textContent = '';
    qChips();
  };
  W.qOpen = () => {
    buildSheet(); Q.manual = false;
    $('q_c').innerHTML = ALLC().map(c => '<option>' + c + '</option>').join(''); $('q_c').value = topCats()[0];
    $('q_a').value = ''; $('q_n').value = ''; $('q_d').value = today(); $('q_h').textContent = '';
    qChips(); $('qsh').classList.add('on'); setTimeout(() => $('q_a').focus(), 60);
  };
  W.qClose = () => { const e = document.getElementById('qsh'); if (e) e.classList.remove('on'); };
  W.qSave = () => {
    const a = num($('q_a').value); if (!(a > 0)) { $('q_h').textContent = 'Bitte einen Betrag eingeben.'; return; }
    const c = $('q_c').value, d = $('q_d').value || today(), n = clean($('q_n').value).trim().slice(0, 80);
    S.tx.push({ id: uid(), d, c, a, n }); save(); qClose(); render(); toast('Gebucht: ' + eur(a) + ' · ' + c);
  };
  function buildFab() {
    if (document.getElementById('qfab')) return;
    const b = document.createElement('button'); b.id = 'qfab'; b.className = 'qfab'; b.setAttribute('aria-label', 'Schnell buchen'); b.textContent = '+'; b.onclick = W.qOpen; document.body.appendChild(b);
  }

  /* ---------- 7. CSV-Import ---------- */
  const IMP = { rows: [], info: '' };
  function parseCSV(text, d) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows;
  }
  const normH = h => String(h || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
  function parseAmount(s) {
    let t = String(s || '').replace(/[€\s\u00a0]|eur/gi, '').replace(/^\+/, '');
    if (!t) return null;
    const neg = /^-|^\(|-$/.test(t); t = t.replace(/[()\-]/g, '');
    if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (t.includes(',')) t = t.replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const v = parseFloat(t); return isFinite(v) ? (neg ? -v : v) : null;
  }
  function parseDate(s) {
    const t = String(s || '').trim(); let m;
    if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/))) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})\b/))) return '20' + m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    return null;
  }
  function importText(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    if (text.length > 2000000) throw new Error('Die Datei ist größer als 2 MB.');
    const first = text.split(/\r?\n/).slice(0, 12).join('\n'), cnt = c => (first.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length;
    const delim = [';', ',', '\t'].sort((a, b) => cnt(b) - cnt(a))[0], all = parseCSV(text, delim);
    let hi = -1, cols = null;
    for (let i = 0; i < Math.min(all.length, 25); i++) {
      const h = all[i].map(normH), find = f => h.findIndex(f);
      const di = find(x => /^(buchungstag|buchungsdatum|datum|date|bookingdate|bookingdatum)/.test(x));
      const dv = di >= 0 ? di : find(x => /^(valuta|wertstellung)/.test(x));
      let ai = find(x => /^(betrag|umsatz|amount)/.test(x));
      const si = find(x => x === 'soll' || x.startsWith('soll')), hh = find(x => x === 'haben' || x.startsWith('haben'));
      if (dv >= 0 && (ai >= 0 || (si >= 0 && hh >= 0))) {
        const pay = h.map((x, k) => /^(zahlungsempfänger|empfänger|empfaenger|auftraggeber|payee|name|beguenstigter|begünstigter|zahlungspflichtige)/.test(x) ? k : -1).filter(k => k >= 0);
        const pur = h.map((x, k) => /^(verwendungszweck|buchungstext|beschreibung|details|text|vorgang|reference|memo)/.test(x) ? k : -1).filter(k => k >= 0);
        cols = { d: dv, a: ai, s: si, h: hh, t: pay.concat(pur).slice(0, 3) }; hi = i; break;
      }
    }
    if (!cols) throw new Error('Keine Spalten für Datum und Betrag gefunden. Erwartet werden z. B. „Buchungstag“ und „Betrag“ in der Kopfzeile.');
    const rows = []; let skipped = 0;
    all.slice(hi + 1, hi + 1 + 1500).forEach(r => {
      const d = parseDate(r[cols.d]); let a = cols.a >= 0 ? parseAmount(r[cols.a]) : ((parseAmount(r[cols.h]) || 0) - (parseAmount(r[cols.s]) || 0));
      if (!d || a == null || a === 0) { skipped++; return; }
      const n = clean(cols.t.map(k => (r[k] || '').trim()).filter(Boolean).join(' · ')).replace(/\s+/g, ' ').slice(0, 70), sign = a > 0 ? 1 : -1;
      let c = suggestCat(n, sign) || (sign > 0 ? 'Sonstige Einnahmen' : 'Sonstiges');
      const ac = Math.round(Math.abs(a) * 100), dup = S.tx.some(x => x.d === d && Math.round(x.a * 100) === ac && (IN.includes(x.c) === (sign > 0) || x.c === 'Sparen/Invest'));
      rows.push({ d, a: Math.abs(a), sign, n, c, dup, inc: !dup });
    });
    IMP.rows = rows; IMP.info = rows.length + ' Zeilen erkannt' + (skipped ? ', ' + skipped + ' übersprungen' : '') + '.';
    return rows.length;
  }
  W.impUndo = () => {
    const L = S.lastImp && Array.isArray(S.lastImp.ids) ? S.lastImp.ids : [];
    if (!L.length || !confirm(L.length + ' Buchungen des letzten Imports wieder entfernen?')) return;
    const set = new Set(L); S.tx = S.tx.filter(x => !set.has(x.id)); delete S.lastImp; save(); render(); toast('Import rückgängig gemacht');
  };
  W.impText = importText;
  W.impFile = inp => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > 2000000) { alert('Die Datei ist größer als 2 MB.'); inp.value = ''; return; }
    const fr = new FileReader();
    fr.onload = () => {
      try {
        let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(fr.result); } catch (e) { t = new TextDecoder('windows-1252').decode(fr.result); }
        importText(t);
      } catch (e) { IMP.rows = []; IMP.info = 'Fehler: ' + (e && e.message ? e.message : 'Datei nicht lesbar.'); }
      impDraw();
    };
    fr.readAsArrayBuffer(f);
  };
  W.impSet = (i, k, v) => { const r = IMP.rows[i]; if (!r) return; if (k === 'inc') r.inc = !!v; else if (k === 'c' && ALLC().includes(v)) r.c = v; impDraw(); };
  W.impAll = v => { IMP.rows.forEach(r => { if (!(v && r.dup)) r.inc = !!v; }); impDraw(); };
  W.impClear = () => { IMP.rows = []; IMP.info = ''; const f = $('imp_f'); if (f) f.value = ''; impDraw(); };
  W.impGo = () => {
    const sel = IMP.rows.filter(r => r.inc); if (!sel.length) return;
    if (!confirm(sel.length + ' Buchungen importieren?')) return;
    const ids = []; sel.forEach(r => { const id = uid(); ids.push(id); S.tx.push({ id, d: r.d, c: r.c, a: r.a, n: r.n }); });
    S.lastImp = { ids, t: Date.now() };
    save(); const n = sel.length; IMP.rows = []; IMP.info = ''; render(); toast(n + ' Buchungen importiert');
  };
  function impPreview() {
    if (!IMP.rows.length) return IMP.info ? '<div class="mut" style="margin-top:8px">' + esc(IMP.info) + '</div>' : '';
    const sel = IMP.rows.filter(r => r.inc), dups = IMP.rows.filter(r => r.dup).length, shown = IMP.rows.slice(0, 300);
    return '<div class="mut" style="margin-top:8px">' + esc(IMP.info) + ' ' + dups + ' mögliche Duplikate (abgewählt). Ausgewählt: ' + sel.length + '.</div>'
      + '<div class="row" style="margin-top:6px"><button class="btn o" style="margin:0" onclick="impAll(true)">Alle wählen</button><button class="btn o" style="margin:0" onclick="impAll(false)">Keine</button></div>'
      + '<div style="margin-top:8px">' + shown.map((r, i) => '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><label style="margin:0;display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0"><input type="checkbox" style="width:auto" ' + (r.inc ? 'checked ' : '') + 'onchange="impSet(' + i + ',\'inc\',this.checked)"><span class="mut">' + r.d.slice(8) + '.' + r.d.slice(5, 7) + '.' + r.d.slice(2, 4) + '</span>' + (r.dup ? '<span class="neg">Duplikat?</span>' : '') + '</label><b class="' + (r.sign > 0 ? 'pos' : '') + '">' + (r.sign > 0 ? '+' : '−') + eur(r.a) + '</b></div><div class="mut" style="margin:4px 0">' + (esc(r.n) || '–') + '</div><select onchange="impSet(' + i + ',\'c\',this.value)">' + ALLC().map(c => '<option' + (c === r.c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>').join('') + '</div>'
      + (IMP.rows.length > 300 ? '<div class="note">Es werden die ersten 300 Zeilen angezeigt; alle ausgewählten Zeilen werden importiert (Auswahl der restlichen Zeilen ist per „Alle/Keine“ steuerbar).</div>' : '')
      + '<button class="btn" onclick="impGo()">' + sel.length + ' Buchungen importieren</button><button class="btn o" onclick="impClear()">Verwerfen</button>';
  }
  function impDraw() { const el = document.getElementById('imp_out'); if (el) { el.innerHTML = impPreview(); if (typeof blurNums === 'function') blurNums(); } }
  function impPanel() {
    return card('Import', '<label>CSV-Kontoauszug (Bank, Trade Republic u. ä.)</label><input id="imp_f" type="file" accept=".csv,.txt,text/csv,text/plain" onchange="impFile(this)"><div class="note">Erkannt werden Kopfzeile, Trennzeichen und Zahlenformat automatisch. Kategorien werden aus deinen früheren Buchungen und Stichworten vorgeschlagen; vor dem Import kannst du alles anpassen. Bereits vorhandene Buchungen mit gleichem Datum und Betrag werden als Duplikat abgewählt.</div><div id="imp_out">' + impPreview() + '</div>' + (S.lastImp && S.lastImp.ids && S.lastImp.ids.length ? '<button class="btn o" onclick="impUndo()">Letzten Import rückgängig (' + S.lastImp.ids.length + ')</button>' : ''));
  }
  wrap('data', h => h + card('Sicherung', '<div class="mut">Letztes Datei-Backup: ' + (expAt() ? new Date(expAt()).toLocaleDateString('de-DE') : 'noch nie') + '</div><button class="btn o" onclick="dlBackup()">Backup als Datei speichern</button>'));
  V.csv = () => bk() + impPanel();

  /* ---------- 8. Sicherheit & Datenschutz ---------- */
  const SEC_K = 'fr_sec', BK_K = 'fr_bk';
  const secGet = () => { try { return Object.assign({ cover: true, idle: 0 }, JSON.parse(localStorage.getItem(SEC_K) || '{}')); } catch (e) { return { cover: true, idle: 0 }; } };
  W.secSet = (k, v) => { const s = secGet(); s[k] = k === 'cover' ? !!v : Math.max(0, Number(v) || 0); try { localStorage.setItem(SEC_K, JSON.stringify(s)); } catch (e) { } render(); };
  const bkGet = () => { try { const a = JSON.parse(localStorage.getItem(BK_K) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  let lastSnap = 0;
  function autoSnap() {
    lastSnap = Date.now();
    try {
      if (!S.tx.length && !S.as.length) return;
      const d = JSON.stringify(S); if (d.length > 900000) return;
      const a = bkGet(), day = new Date().toISOString().slice(0, 10), last = a[a.length - 1], rec = { t: new Date().toISOString(), n: S.tx.length, u: S.uid || '', d };
      if (last && last.t.slice(0, 10) === day) a[a.length - 1] = rec; else a.push(rec);
      while (a.length > 5) a.shift();
      localStorage.setItem(BK_K, JSON.stringify(a));
    } catch (e) { }
  }
  W.snapRestore = i => {
    const a = bkGet(), r = a[i]; if (!r) return;
    if (!confirm('Den Stand vom ' + new Date(r.t).toLocaleString('de-DE') + ' wiederherstellen? Der aktuelle Stand wird ersetzt.')) return;
    try { S = normalizeImportedState(JSON.parse(r.d)); save(); render(); toast('Stand wiederhergestellt'); } catch (e) { alert('Wiederherstellung fehlgeschlagen.'); }
  };
  wrap('sec', h => {
    const s = secGet(), hasPin = !!(function () { try { return localStorage.getItem('fr_pin'); } catch (e) { return null; } })();
    const snaps = bkGet().map((r, i) => ({ r, i })).filter(x => !x.r.u || !S.uid || x.r.u === S.uid).reverse();
    return h + card('Datenschutz', '<label class="chk"><input type="checkbox" ' + (s.cover ? 'checked ' : '') + 'onchange="secSet(\'cover\',this.checked)">App-Inhalt beim Wechsel verdecken</label><div class="note">Zeigt beim App-Wechsel und im Task-Switcher nur das Logo statt deiner Zahlen.</div>'
      + '<label>Automatisch sperren nach Inaktivität' + (hasPin ? '' : ' (benötigt eine PIN)') + '</label><select onchange="secSet(\'idle\',this.value)">' + [[0, 'aus'], [1, '1 Minute'], [2, '2 Minuten'], [5, '5 Minuten'], [10, '10 Minuten']].map(o => '<option value="' + o[0] + '"' + (s.idle === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>')
      + card('Sicherungen', '<div class="mut">Täglich wird automatisch ein Stand auf diesem Gerät gesichert (die letzten 5).</div>' + (snaps.length ? snaps.map(x => '<div class="li"><span>' + new Date(x.r.t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) + '<small>' + x.r.n + ' Buchungen</small></span><span><button class="btn x" onclick="snapRestore(' + x.i + ')">Wiederherstellen</button></span></div>').join('') : '<div class="mut" style="margin-top:6px">Noch keine Sicherung vorhanden.</div>') + '<div class="note">Diese Sicherungen ersetzen kein Datei-Backup (Mehr → Daten → „Backup als Datei speichern“).</div>');
  });

  /* Verdecken beim App-Wechsel + Inaktivitäts-Sperre */
  function buildCover() {
    if (document.getElementById('pcv')) return;
    const c = document.createElement('div'); c.id = 'pcv'; c.className = 'pcv'; c.innerHTML = '<div>◉<br><span>Finanz-Radar</span></div>'; document.body.appendChild(c);
  }
  const cover = on => { const c = document.getElementById('pcv'); if (!c) return; if (on && secGet().cover) c.classList.add('on'); else c.classList.remove('on'); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cover(true); autoSnap(); } else cover(false); });
  W.addEventListener('pagehide', () => cover(true));
  W.addEventListener('pageshow', () => cover(false));
  W.addEventListener('blur', () => cover(true));
  W.addEventListener('focus', () => cover(false));
  let lastAct = Date.now();
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(e => document.addEventListener(e, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => {
    const s = secGet(); if (!(s.idle > 0) || document.hidden) return;
    let pin = null; try { pin = localStorage.getItem('fr_pin'); } catch (e) { }
    if (pin && !document.querySelector('.lk') && Date.now() - lastAct >= s.idle * 60000 && W.lockNow) { W.lockNow(); lastAct = Date.now(); }
  }, 15000);

  /* ---------- Einbindung ---------- */
  const _render = W.render;
  W.render = function () {
    _render();
    buildFab(); buildCover();
    const fab = document.getElementById('qfab'); if (fab) fab.style.display = $('tb') && $('tb').innerHTML ? '' : 'none';
    if (Date.now() - lastSnap > 300000) autoSnap();
  };
  setTimeout(autoSnap, 20000);
  W.__fr_extras = { suggestCat, importText, IMP };
  render();
})();
