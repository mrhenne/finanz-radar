/* Finanz-Radar Boost: Fokus-Home, Job-Szenarien, Passives Einkommen, Dark Mode, Mikro-Feedback, PWA.
   Geladen nach extras.js. Ändert keine bestehenden Daten, legt nur neue Felder an (S.job, S.pi, S.thv, S.msSeen, S.ui.hf). */
(function () {
  'use strict';
  const W = window, $ = id => document.getElementById(id);
  const card = (t, h) => P('[' + t + ']', h);
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : 0; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const ymNow = () => today().slice(0, 7);
  const addM = (ym, k) => { const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + k, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const monLabel = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''); };
  const txOf = ym => S.tx.filter(x => x.d.startsWith(ym));
  const fm1 = v => (Math.round(v * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nS = h => '<span class="n">' + h + '</span>';
  const go = k => "tab='" + k + "';render();scrollTo(0,0)";
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const toast = msg => { let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  const yr0 = () => new Date().getFullYear();
  const rate = () => (S.f && S.f.r != null && S.f.r !== '' && isFinite(+S.f.r)) ? +S.f.r : 6;
  const baseP = () => ({ v0: Math.max(0, nn()), sr: Math.max(0, avg().s), r: rate(), F: fireF() });
  const liquid = () => S.as.filter(a => ['cash', 'etf', 'aktie', 'crypto', 'gold'].includes(a.k)).reduce((s, a) => s + val(a), 0);
  const runwayM = () => { const f = fixk(); return f > 0 ? liquid() / f : 0; };
  const loggedIn = () => !!($('tb') && $('tb').innerHTML);

  /* Mini-Sparkline */
  function spk(vals, col) {
    const pts = vals.map((x, j) => x == null ? null : [j, x]).filter(Boolean);
    if (pts.length < 2) return '';
    const ys = pts.map(p => p[1]), mn = Math.min(...ys), mx = Math.max(...ys), w = 100, h = 18, n = vals.length - 1 || 1;
    const P2 = pts.map(p => [p[0] / n * w, h - 3 - (p[1] - mn) / ((mx - mn) || 1) * (h - 6)]), last = P2[P2.length - 1];
    return '<svg class="spk" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + P2.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + '" fill="none" stroke="' + (col || 'var(--mut)') + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2" fill="var(--or)"/></svg>';
  }

  /* =====================================================================
     8. Dark Mode: folgt automatisch dem System, passt Statusleiste an
     ===================================================================== */
  const isDark = () => { const t = S.th || 'auto'; if (t === 'dark') return true; if (t === 'light') return false; try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } };
  function migrateTheme() { if (S.thv === 2) return; if (!S.th || S.th === 'light') S.th = 'auto'; S.thv = 2; localSave(); }
  const _applyTh = W.applyTh;
  W.applyTh = function () {
    _applyTh();
    const d = isDark(), t = S.th || 'auto';
    document.documentElement.style.colorScheme = d ? 'dark' : 'light';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', d ? '#17181a' : '#e9eaec'));
    const b = $('th'); if (b) { const l = { light: 'Design: Hell', dark: 'Design: Dunkel', auto: 'Design: Automatisch' }[t]; b.title = l; b.setAttribute('aria-label', l); }
  };
  W.theme = function () {
    S.th = { auto: 'light', light: 'dark', dark: 'auto' }[S.th || 'auto'] || 'auto'; S.thv = 2; save(); W.applyTh();
    toast({ light: 'Design: Hell', dark: 'Design: Dunkel', auto: 'Design: Automatisch, folgt dem iPhone' }[S.th]);
  };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => W.applyTh()); } catch (e) { }
  try { PAL[1] = 'var(--ink)'; } catch (e) { }

  /* =====================================================================
     5. Passives Einkommen
     ===================================================================== */
  const PI_K = { div: 'Dividende/Ausschüttung', zins: 'Zinsen', miete: 'Miete', sonst: 'Sonstiges' };
  const piS = () => { if (!S.pi || typeof S.pi !== 'object' || Array.isArray(S.pi)) S.pi = {}; if (!Array.isArray(S.pi.items)) S.pi.items = []; return S.pi; };
  const piItems = () => piS().items.filter(x => x && typeof x.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.d) && isFinite(+x.a) && +x.a > 0);
  const piSince = ym => piItems().filter(x => x.d.slice(0, 7) >= ym && x.d.slice(0, 7) <= ymNow()).reduce((s, x) => s + +x.a, 0);
  const piMonthly = () => piSince(addM(ymNow(), -11)) / 12;
  const piSet = () => { const p = piS(); return { yd: p.yd != null && isFinite(+p.yd) ? +p.yd : 1.8, yz: p.yz != null && isFinite(+p.yz) ? +p.yz : 2, rent: Math.max(0, +p.rent || 0) }; };
  const piPot = () => { const c = piSet(); return ((byK('etf') + byK('aktie')) * c.yd / 100 + byK('cash') * c.yz / 100) / 12 + c.rent; };
  const piEff = () => { const has = piItems().length > 0; return { v: has ? piMonthly() : piPot(), est: !has }; };
  const piCov = () => { const f = fixk(), e = piEff(); return f > 0 ? e.v / f * 100 : 0; };
  const piGuess = s => /zins/i.test(s) ? 'zins' : /miet/i.test(s) ? 'miete' : /divid|aussch/i.test(s) ? 'div' : 'sonst';
  const piCand = () => { const linked = new Set(piS().items.map(p => p.tx).filter(Boolean)); return S.tx.filter(x => IN.includes(x.c) && /dividend|ausschütt|ausschuett|zinsgutschrift|zinsen|habenzins|kupon|coupon|mieteinnahm/i.test(x.n || '') && !linked.has(x.id)); };

  W.piAdd = () => {
    const a = num($('pi_a').value); if (!(a > 0)) { toast('Bitte einen Betrag eingeben'); return; }
    const k = PI_K[$('pi_k').value] ? $('pi_k').value : 'sonst', d = $('pi_d').value || today(), n = esc($('pi_n').value).trim().slice(0, 60) || PI_K[k];
    const it = { id: uid(), d, k, n, a: Math.round(a * 100) / 100 };
    if ($('pi_tx').checked) { const tid = uid(); S.tx.push({ id: tid, d, c: 'Sonstige Einnahmen', a: it.a, n: 'Passiv: ' + n, r: null }); it.tx = tid; it.own = 1; }
    piS().items.push(it); save(); toast('+' + (S.hide ? '' : eur(it.a) + ' ') + 'passives Einkommen erfasst'); render();
  };
  W.piDel = id => {
    const p = piS(), it = p.items.find(x => x.id === id); if (!it) return;
    if (it.own && it.tx && S.tx.some(x => x.id === it.tx) && confirm('Die dazugehörige Buchung im Cashflow ebenfalls löschen?')) S.tx = S.tx.filter(x => x.id !== it.tx);
    p.items = p.items.filter(x => x.id !== id); save(); render();
  };
  W.piImport = () => {
    const c = piCand(); if (!c.length) return;
    c.forEach(x => piS().items.push({ id: uid(), d: x.d, k: piGuess(x.n || ''), n: String(x.n || x.c).slice(0, 60), a: x.a, tx: x.id }));
    save(); toast(c.length + ' Einträge aus dem Cashflow übernommen'); render();
  };
  W.piSetF = (k, v) => { const p = piS(); p[k] = Math.max(0, num(v)); save(); render(); };

  function piBars() {
    const ms = []; for (let i = -11; i <= 0; i++) ms.push(addM(ymNow(), i));
    const vs = ms.map(m => piItems().filter(x => x.d.startsWith(m)).reduce((s, x) => s + +x.a, 0)), mx = Math.max(...vs, 1), bw = 312 / ms.length;
    if (!vs.some(v => v > 0)) return '';
    let g = '<line x1="40" x2="352" y1="100" y2="100" stroke="var(--ln)"/><text x="36" y="14" font-size="8" text-anchor="end" fill="var(--mut)">' + eur(mx) + '</text>';
    vs.forEach((v, i) => { const h = v / mx * 86, x = 40 + i * bw; g += '<rect x="' + (x + 3).toFixed(1) + '" y="' + (100 - h).toFixed(1) + '" width="' + (bw - 6).toFixed(1) + '" height="' + Math.max(v > 0 ? 1.5 : 0, h).toFixed(1) + '" fill="' + (i === vs.length - 1 ? 'var(--or)' : 'var(--g)') + '"' + (v > 0 ? '' : ' opacity=".3"') + '><title>' + monLabel(ms[i]) + ': ' + eur(v) + '</title></rect>'; if (i % 2 === 1 || i === vs.length - 1) g += '<text x="' + (x + bw / 2).toFixed(1) + '" y="112" font-size="7" text-anchor="middle" fill="var(--mut)">' + monLabel(ms[i]) + '</text>'; });
    return '<svg viewBox="0 0 360 118" class="pib">' + g + '</svg>';
  }

  SUB.push('passive', 'job');
  Object.assign(TT, { passive: 'Passiv', job: 'Job' });

  V.passive = () => {
    const e = piEff(), f = fixk(), cov = f > 0 ? e.v / f * 100 : 0, pot = piPot(), c = piSet(), ytd = piSince(yr0() + '-01'), cand = piCand();
    let h = '<div class="k big"><b>' + eur(e.v) + '</b><span>' + (e.est ? 'geschätzt pro Monat (aus deinem Bestand)' : 'Ø pro Monat · letzte 12 Monate') + '</span></div>'
      + '<div class="cov"><div class="bar"><i style="width:' + Math.min(100, cov) + '%"></i></div><div class="mut">deckt ' + pct(cov) + ' deiner Fixkosten von ' + eur(f) + '</div></div>'
      + '<div class="g2" style="margin-top:12px"><div class="k"><b class="pos">' + eur(ytd) + '</b><span>Erhalten ' + yr0() + '</span></div><div class="k"><b>' + eur(pot) + '</b><span>Potenzial/Monat</span></div></div>';
    if (cand.length) h += '<div class="al w" style="margin-top:12px"><span><b>' + nS(cand.length) + ' passende Buchungen</b><small>im Cashflow gefunden: Dividende, Zinsen, Miete</small></span><button class="chip" onclick="piImport()">Übernehmen</button></div>';
    let out = card('Passiv · Überblick', h);

    const fx = (S.rec || []).filter(r => !IN.includes(r.c) && r.c !== 'Sparen/Invest' && r.a > 0).map(r => ({ n: r.n || r.c, c: r.c, a: r.a })).sort((a, b) => a.a - b.a);
    let left = e.v, rows = '';
    fx.forEach(x => {
      let st, cl, p;
      if (left >= x.a - 0.005) { st = '✓'; cl = 'pos'; p = 100; left -= x.a; } else if (left > 0) { st = '▶'; cl = 'nx'; p = left / x.a * 100; left = 0; } else { st = '○'; cl = ''; p = 0; }
      rows += '<div class="li pc ' + cl + '"><span>' + st + ' ' + esc(x.n) + '<small>' + esc(x.c) + '</small></span><span>' + eur(x.a) + (cl === 'nx' ? '<small>' + pct(p) + ' gedeckt</small>' : '') + '</span></div>';
    });
    out += card('Passiv · Was es schon bezahlt', fx.length ? '<div class="mut" style="margin-bottom:4px">Von klein nach groß: welche Fixkosten dein passives Einkommen schon trägt.</div>' + rows : '<span class="mut">Lege im Cashflow wiederkehrende Ausgaben an (Haken „wiederkehrend“), dann siehst du hier, welche davon dein passives Einkommen schon bezahlt.</span>');

    out += card('Passiv · Neu', '<div class="row"><select id="pi_k">' + Object.entries(PI_K).map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select><input id="pi_a" type="number" inputmode="decimal" placeholder="Betrag €"></div>'
      + '<div class="row" style="margin-top:8px"><input id="pi_n" placeholder="Quelle, z. B. MSCI World" list="pi_dl" autocomplete="off"><input id="pi_d" type="date" value="' + today() + '"></div><datalist id="pi_dl">' + S.as.filter(a => a.k !== 'crypto').map(a => '<option value="' + esc(a.n) + '">').join('') + '</datalist>'
      + '<label class="chk"><input type="checkbox" id="pi_tx">Auch als Einnahme im Cashflow buchen</label><button class="btn" onclick="piAdd()">Erfassen</button>'
      + '<div class="note">Brutto oder netto ist egal, bleib nur einheitlich. Wenn die Ausschüttung schon als Buchung im Cashflow steht, lass den Haken weg oder nutze „Übernehmen“ oben.</div>');

    const L = piItems().slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 15);
    out += card('Passiv · Verlauf', (piBars() || '<span class="mut">Noch keine Einträge.</span>') + L.map(x => '<div class="li"><span>' + esc(x.n) + '<small>' + x.d.slice(8) + '.' + x.d.slice(5, 7) + '.' + x.d.slice(0, 4) + ' · ' + (PI_K[x.k] || 'Sonstiges') + (x.tx ? ' · im Cashflow' : '') + '</small></span><span class="pos">+' + eur(+x.a) + ' <button class="btn x" onclick="piDel(\'' + x.id + '\')">×</button></span></div>').join(''));

    out += card('Passiv · Annahmen Potenzial', '<div class="row"><div><label>Ausschüttung ETF/Aktien %</label><input type="number" step="0.1" inputmode="decimal" value="' + c.yd + '" onchange="piSetF(\'yd\',this.value)"></div><div><label>Zins Cash %</label><input type="number" step="0.1" inputmode="decimal" value="' + c.yz + '" onchange="piSetF(\'yz\',this.value)"></div></div><label>Mieteinnahmen netto €/Monat</label><input type="number" inputmode="decimal" value="' + (c.rent || '') + '" placeholder="0" onchange="piSetF(\'rent\',this.value)">'
      + '<div class="note">Potenzial = (ETF + Aktien) × Ausschüttung + Cash × Zins, pro Monat, plus Miete. Thesaurierende ETFs schütten nichts aus: dann ist das Potenzial eine Rechengröße, kein Geldeingang. Solange keine echten Einträge da sind, nutzt die App das Potenzial als Schätzung.</div>');
    return bk() + out;
  };

  /* =====================================================================
     4. Was-wäre-wenn: Teilzeit, Sabbatical, Start später
     ===================================================================== */
  const K_NET = 0.86;               /* Teilzeit: Netto sinkt wegen Steuerprogression etwas weniger stark als Brutto */
  const WD = 220;                   /* Arbeitstage pro Jahr in Vollzeit */
  const PRESETS = [100, 90, 80, 75, 60, 50];
  function salary() {
    const v = []; for (let i = -11; i <= 0; i++) { const s = txOf(addM(ymNow(), i)).filter(x => x.c === 'Gehalt').reduce((a, x) => a + x.a, 0); if (s > 0) v.push(s); }
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }
  const jobC = () => { const j = S.job && typeof S.job === 'object' && !Array.isArray(S.job) ? S.job : {}; return { inc: num(j.inc) > 0 ? num(j.inc) : Math.round(salary()), sh: clamp(num(j.sh) || 80, 10, 100), sab: clamp(Math.round(num(j.sab)), 0, 36), at: clamp(num(j.at), 0, 30), ov: num(j.ov) > 0 ? num(j.ov) : 0 }; };
  const netAt = (inc, sh) => inc * (1 - (1 - sh / 100) * K_NET);
  function simJob(B, c, sh, useOv) {
    const m = Math.pow(1 + B.r / 100, 1 / 12) - 1, net = useOv && c.ov > 0 ? Math.min(c.ov, c.inc) : netAt(c.inc, sh), loss = Math.max(0, c.inc - net);
    const st = Math.round(c.at * 12), sab = c.sab, rows = [[0, B.v0]];
    let v = B.v0, wd = 0, k = 0, broke = false;
    if (!(B.F > 0)) return { y: null, rows, net, loss, sr: B.sr - loss, wd: null, broke };
    while (v < B.F && k < 720) {
      let cb, w;
      if (k < st) { cb = B.sr; w = 1; } else if (k < st + sab) { cb = B.sr - c.inc; w = 0; } else { cb = B.sr - loss; w = sh / 100; }
      v = v * (1 + m) + cb; wd += WD / 12 * w; k++;
      if (v < 0) { broke = true; rows.push([k / 12, 0]); break; }
      if (k % 12 === 0) rows.push([k / 12, v]);
    }
    const ok = !broke && v >= B.F;
    if (!broke && k % 12) rows.push([k / 12, v]);
    return { y: ok ? k / 12 : null, rows, net, loss, sr: B.sr - loss, wd: ok ? wd : null, broke };
  }
  const at = (rows, t) => { for (const r of rows) if (r[0] >= t - 1e-9) return r[1]; return rows[rows.length - 1][1]; };
  const yTxt = y => y == null ? 'nicht erreicht' : y < 0.05 ? 'erreicht' : fm1(y) + ' J.';
  const dTxt = (a, b) => { if (a == null || b == null) return '–'; const d = a - b; return Math.abs(d) < 0.05 ? '±0' : (d > 0 ? '+' : '−') + fm1(Math.abs(d)) + ' J.'; };
  W.setJob = (k, v) => { const j = S.job && typeof S.job === 'object' && !Array.isArray(S.job) ? S.job : {}; j[k] = Math.max(0, num(v)); if (k === 'sh') j.ov = 0; S.job = j; save(); render(); };

  V.job = () => {
    const B = baseP(), c = jobC(), base = simJob(B, { ...c, at: 0, sab: 0 }, 100, false), sc = simJob(B, c, c.sh, true);
    const head = card('Job · Ausgangslage', '<label>Netto-Gehalt heute €/Monat (nur Hauptjob)</label><input type="number" inputmode="decimal" value="' + (num(S.job && S.job.inc) || '') + '" placeholder="' + (Math.round(salary()) || 'z. B. 2800') + '" onchange="setJob(\'inc\',this.value)">'
      + '<div class="g2" style="margin-top:12px"><div class="k"><b>' + eur(B.sr) + '</b><span>Ø investiert / Monat</span></div><div class="k"><b>' + yTxt(base.y) + '</b><span>bis Fuck Off in Vollzeit' + (base.y ? ' · ' + (yr0() + Math.ceil(base.y)) : '') + '</span></div></div>'
      + '<div class="note">Vorbelegt mit deinem Ø Gehalt der letzten 12 Monate. Nebenjob und andere Einnahmen bleiben in allen Szenarien unverändert.</div>');
    if (!(c.inc > 0) || !(B.F > 0)) return bk() + head + card('Job · Szenario', '<span class="mut">' + (!(B.F > 0) ? 'Es fehlt eine Fuck-Off-Zahl: trag im Tab „Fuck Off“ deine Ausgaben ein.' : 'Trag oben dein Netto-Gehalt ein, dann rechne ich die Szenarien.') + '</span>');

    const chip = (on, lbl, js) => '<button class="chip' + (on ? ' on' : '') + '" onclick="' + js + '">' + lbl + '</button>';
    const est = netAt(c.inc, c.sh), freeD = (1 - c.sh / 100) * WD, perDay = freeD > 0 ? sc.loss * 12 / freeD : 0, dwd = (sc.wd != null && base.wd != null) ? sc.wd - base.wd : null;
    let h = '<label>Arbeitszeit</label><div class="chips">' + PRESETS.slice(1).map(p => chip(c.sh === p, p + ' %', 'setJob(\'sh\',' + p + ')')).join('') + '</div>'
      + '<div class="row" style="margin-top:6px"><div><label>Eigener Anteil %</label><input type="number" inputmode="decimal" value="' + c.sh + '" onchange="setJob(\'sh\',this.value)"></div><div><label>Netto im Szenario €</label><input type="number" inputmode="decimal" value="' + (c.ov || '') + '" placeholder="ca. ' + Math.round(est) + '" onchange="setJob(\'ov\',this.value)"></div></div>'
      + '<label>Sabbatical (Monate ohne Gehalt)</label><div class="chips">' + [0, 3, 6, 12].map(p => chip(c.sab === p, p ? p + ' Mon.' : 'keins', 'setJob(\'sab\',' + p + ')')).join('') + '</div>'
      + '<label>Start</label><div class="chips">' + [0, 1, 2, 5].map(p => chip(c.at === p, p ? 'in ' + p + ' J.' : 'sofort', 'setJob(\'at\',' + p + ')')).join('') + '</div><div class="hatch"></div>';
    if (sc.broke) h += '<div class="neg p">Das Sabbatical zehrt dein Vermögen komplett auf. Kürzer planen oder später starten.</div>';
    h += '<div class="g2"><div class="k big" style="grid-column:1/-1"><b>' + dTxt(sc.y, base.y) + '</b><span>Verschiebung deines Fuck-Off-Datums</span></div>'
      + '<div class="k"><b>' + yTxt(sc.y) + '</b><span>bis Fuck Off' + (sc.y != null ? ' · ' + (yr0() + Math.ceil(sc.y)) : '') + '</span></div>'
      + '<div class="k"><b class="' + (sc.sr < 0 ? 'neg' : '') + '">' + eur(sc.sr) + '</b><span>Sparrate / Monat</span></div>'
      + '<div class="k"><b class="neg">−' + eur(sc.loss) + '</b><span>Netto-Einbuße / Monat</span></div>'
      + '<div class="k"><b>' + nS(Math.round(freeD)) + ' Tage</b><span>mehr frei pro Jahr</span></div>'
      + (perDay > 0 ? '<div class="k"><b>' + eur(perDay) + '</b><span>kostet ein freier Tag</span></div>' : '')
      + (dwd != null ? '<div class="k"><b class="' + (dwd <= 0 ? 'pos' : 'neg') + '">' + (dwd > 0 ? '+' : '−') + nS(Math.round(Math.abs(dwd))) + '</b><span>Arbeitstage bis zum Ziel</span></div>' : '') + '</div>';
    if (dwd != null && c.sh < 100) h += '<div class="' + (dwd <= 0 ? 'pos' : 'mut') + '" style="margin-top:4px">' + (dwd <= 0 ? '✓ Unterm Strich arbeitest du bis zum Ziel sogar weniger Tage als in Vollzeit, weil die Teilzeit früher Freizeit bringt.' : 'Bis zum Ziel arbeitest du insgesamt mehr Tage als in Vollzeit, hast sie aber gleichmäßiger verteilt.') + '</div>';
    const T = Math.min(60, Math.ceil(Math.max(base.y || 0, sc.y || 0, 5)) + 1), rows = [];
    for (let t = 0; t <= T; t++) rows.push(['Jahr ' + t + ' · ' + (yr0() + t), at(sc.rows, t), at(base.rows, t), B.F]);
    h += lc(rows, ['Szenario', 'Vollzeit', 'Ziel'], ['var(--or)', 'var(--mut)', '#ff4d6d'], { dash: 1 });
    let out = card('Job · Szenario', h);

    out += card('Job · Vergleich', '<div class="tw"><table class="pvt cmp"><tr><th>Zeit</th><th>Netto</th><th>Sparrate</th><th>Fuck Off</th><th>Δ</th></tr>' + PRESETS.map(p => { const r = p === 100 ? base : simJob(B, { ...c, sab: 0 }, p, false); return '<tr' + (p === c.sh && !c.sab ? ' class="on"' : '') + ' onclick="setJob(\'sh\',' + p + ')"><td>' + p + ' %</td><td>' + eur(r.net) + '</td><td>' + eur(r.sr) + '</td><td>' + (r.y != null ? yr0() + Math.ceil(r.y) : '–') + '</td><td>' + (p === 100 ? '–' : dTxt(r.y, base.y)) + '</td></tr>'; }).join('') + '</table></div>'
      + '<div class="note">Netto bei Teilzeit ist geschätzt (sinkt wegen der Steuerprogression etwas weniger als das Brutto). Für exakte Werte deinen Betrag aus dem Brutto-Netto-Rechner oben eintragen. Annahmen: Ausgaben bleiben gleich, die Einbuße geht 1:1 von der Sparrate ab, Rendite ' + pct(B.r) + ' p.a. wie im Tab „Fuck Off“. Rente, Krankenversicherung und Zulagen sind nicht modelliert.</div>');
    return bk() + head + out;
  };

  /* Teaser im Fuck-Off-Tab */
  const _fire = V.fire;
  V.fire = () => {
    const h = _fire(), B = baseP(), c = jobC();
    if (!(c.inc > 0) || !(B.F > 0)) return h + card('Was kostet Teilzeit?', '<span class="mut">Rechne aus, wie sich Teilzeit oder ein Sabbatical auf dein Fuck-Off-Datum auswirken.</span><button class="btn o" onclick="' + go('job') + '">Job-Szenarien öffnen</button>');
    const b = simJob(B, { ...c, at: 0, sab: 0 }, 100, false), r = simJob(B, { ...c, at: 0, sab: 0 }, 80, false);
    return h + card('Was kostet Teilzeit?', '<div class="li"><span>80 % Arbeitszeit<small>netto ca. −' + eur(r.loss) + ' / Monat · ' + nS(Math.round(.2 * WD)) + ' Tage mehr frei</small></span><b>' + dTxt(r.y, b.y) + '</b></div><button class="btn o" onclick="' + go('job') + '">Job-Szenarien öffnen</button>');
  };

  /* =====================================================================
     7. Fokus-Home
     ===================================================================== */
  const oldHome = V.home;
  function ring(p) {
    const R = 50, C = 2 * Math.PI * R, f = clamp(p / 100, 0, 1), done = p >= 100;
    return '<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Fortschritt zur Fuck-Off-Zahl"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--ln)" stroke-width="9"/>'
      + [.25, .5, .75].map(q => { const a = q * 2 * Math.PI - Math.PI / 2; return '<line x1="' + (60 + 44 * Math.cos(a)).toFixed(1) + '" y1="' + (60 + 44 * Math.sin(a)).toFixed(1) + '" x2="' + (60 + 56 * Math.cos(a)).toFixed(1) + '" y2="' + (60 + 56 * Math.sin(a)).toFixed(1) + '" stroke="var(--p)" stroke-width="1.5"/>'; }).join('')
      + '<circle class="rga" cx="60" cy="60" r="' + R + '" fill="none" stroke="' + (done ? 'var(--g)' : 'var(--or)') + '" stroke-width="9" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - f)).toFixed(1) + '" transform="rotate(-90 60 60)" style="--c:' + C.toFixed(1) + '"/>'
      + '<text x="60" y="64" text-anchor="middle" font-size="' + (done ? 30 : 22) + '" font-weight="600" fill="var(--ink)">' + (done ? '✓' : Math.floor(p) + ' %') + '</text><text x="60" y="81" text-anchor="middle" font-size="7" letter-spacing="1.2" fill="var(--mut)">FUCK OFF</text></svg>';
  }
  W.qInvest = () => { if (!W.qOpen) return; W.qOpen(); setTimeout(() => { const s = $('q_c'); if (s) { s.value = 'Sparen/Invest'; if (W.Q_manual) W.Q_manual(); } }, 0); };
  W.homeFull = () => { S.ui.hf = !S.ui.hf; save(); render(); };
  function alerts() {
    const a = [], al = (t, s, b, js) => '<div class="al w"><span><b>' + t + '</b><small>' + s + '</small></span><button class="chip" onclick="' + js + '">' + b + '</button></div>';
    let ex = 0; try { ex = Number(localStorage.getItem('fr_exp')) || 0; } catch (e) { }
    const age = ex ? Math.floor((Date.now() - ex) / 864e5) : null;
    if (S.tx.length >= 5 && (age === null || age >= 30)) a.push(al('Backup fällig', age === null ? 'Noch kein Datei-Backup gespeichert' : 'Letztes Datei-Backup vor ' + nS(age) + ' Tagen', 'Sichern', W.dlBackup ? 'dlBackup()' : go('data')));
    const eg = S.as.filter(x => x.eg);
    if (eg.length) { const have = eg.reduce((s, x) => s + val(x), 0), t = S.f.egt > 0 ? S.f.egt : fixk() * (S.f.egm || 3); if (t > 0 && have < t) a.push(al('Notgroschen unter Ziel', 'Es fehlen ' + eur(t - have), 'Ansehen', go('assets'))); }
    const sp = Math.max(0, Number(S.spl && S.spl.t) || 0);
    if (sp > 0 && new Date().getDate() >= 20) { const ist = invSum(txOf(ymNow())); if (ist < sp) a.push(al('Sparplan offen', 'Noch ' + eur(sp - ist) + ' bis zum Monatsziel', 'Buchen', 'qInvest()')); }
    return a;
  }
  V.home = () => {
    const n = nn(), F = fireF(), p = F > 0 ? n / F * 100 : 0, B = baseP(), y = F > 0 ? simYears(B.v0, B.sr, B.r, F) : null;
    const H = (S.hist || []).slice().sort((a, b) => a.m.localeCompare(b.m)), cur = ymNow(), prev = H.filter(x => x.m < cur).pop(), d = prev ? n - prev.nw : null;
    const yT = !(F > 0) ? 'Zielzahl fehlt' : y == null ? 'nicht in Sicht' : y < 0.05 ? 'erreicht ✓' : fm1(y) + ' Jahren', yS = y != null && y >= 0.05 ? '<small>ca. ' + nS(yr0() + Math.ceil(y)) + '</small>' : '';
    let h = '<div class="hero">' + ring(p) + '<div class="hk"><div class="k big"><b>' + eur(n) + '</b><span>Net Worth</span></div>'
      + (d != null ? '<div class="' + (d >= 0 ? 'pos' : 'neg') + ' dl">' + (d >= 0 ? '▲ +' : '▼ ') + eur(d) + ' seit ' + monLabel(prev.m) + '</div>' : '')
      + '<div class="fo"><span class="mut">Fuck Off in</span><b>' + yT + '</b>' + yS + '</div></div></div>';
    const qs = [], ms6 = []; for (let i = -5; i <= 0; i++) ms6.push(addM(cur, i));
    ms6.forEach(m => { const l = txOf(m), i = sm(l, 'in'); qs.push(l.length && i ? invSum(l) / i * 100 : null); });
    const q = qs[5], rw = runwayM(), e = piEff(), cov = piCov();
    const tile = (lbl, v, sub, extra, js) => '<button class="tile" onclick="' + js + '"><span>' + lbl + '</span><b>' + nS(v) + '</b>' + extra + '<small>' + sub + '</small></button>';
    h += '<div class="tiles">'
      + tile('Sparquote', q == null ? '–' : pct(q), monLabel(cur) + ' · 6 Mon.', spk(qs, 'var(--g)'), go('review'))
      + tile('Runway', fm1(rw) + ' Mon.', 'Ziel 12 Mon.', '<div class="bar"><i style="width:' + Math.min(100, rw / 12 * 100) + '%"></i></div>', go('fire'))
      + tile('Passiv', (e.est ? '≈ ' : '') + pct(cov), e.est ? 'geschätzt' : 'der Fixkosten', '<div class="bar"><i style="width:' + Math.min(100, cov) + '%"></i></div>', go('passive'))
      + '</div>';
    const A = alerts();
    h += A.length ? '<div class="alr">' + A.join('') + '</div>' : '<div class="allok pos">✓ Keine offenen Punkte</div>';
    const open = !!(S.ui && S.ui.hf);
    h += '<button class="btn o det" onclick="homeFull()">' + (open ? '▴ Details ausblenden' : '▾ Alle Details anzeigen') + '</button>';
    const fokus = card('Fokus', h);
    if (!open) return edHTML() + fokus;
    const old = oldHome(), e0 = edHTML();
    return (e0 && old.startsWith(e0) ? e0 + fokus + old.slice(e0.length) : fokus + old);
  };

  /* =====================================================================
     10. Mikro-Feedback: Hochzählen, Sparklines, Meilenstein-Effekt
     ===================================================================== */
  W.cu = function () {
    if (reduced()) return;
    const els = [...document.querySelectorAll('#v .k b, #v .tile b')].slice(0, 40), t0 = performance.now(), jobs = [];
    els.forEach(b => {
      const el = b.querySelector('span.n') || b; if (el.children.length) return;
      const m = el.textContent.trim().match(/^([+−-]?)((?:\d{1,3}(?:\.\d{3})+)|\d+)(?:,(\d+))?(\s?(?:€|%|Mon\.|J\.|Monate))$/);
      if (!m) return;
      const dec = m[3] ? m[3].length : 0, to = parseFloat(m[2].replace(/\./g, '') + (dec ? '.' + m[3] : ''));
      if (!(to > 0)) return;
      jobs.push({ el, to, dec, pre: m[1], suf: m[4] });
    });
    if (!jobs.length) return;
    (function f(now) {
      const p = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - p, 3);
      jobs.forEach(j => { if (!j.el.isConnected) return; j.el.textContent = j.pre + (j.to * e).toLocaleString('de-DE', { minimumFractionDigits: j.dec, maximumFractionDigits: j.dec }) + j.suf; });
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  };
  W.bars = function (l, t) {
    const c = {}; l.filter(x => IN.includes(x.c) === (t === 'in')).forEach(x => c[x.c] = (c[x.c] || 0) + x.a);
    const T = Object.values(c).reduce((a, b) => a + b, 0) || 1, ms = []; for (let i = -5; i <= 0; i++) ms.push(addM(mo, i));
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
      const tr = ms.map(m => txOf(m).filter(x => x.c === k).reduce((s, x) => s + x.a, 0)), pr = tr.slice(0, 5).filter(x => x > 0), av = pr.length ? pr.reduce((a, b) => a + b, 0) / pr.length : 0;
      return '<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="flex:1">' + k + '</span><span class="bsp">' + spk(tr, 'var(--mut)') + '</span><b>' + eur(v) + '</b></div><div class="bar"><i style="width:' + (v / T * 100) + '%"></i></div><span class="mut">' + pct(v / T * 100) + (av ? ' · Ø Vormonate ' + eur(av) : '') + '</span></div>';
    }).join('') || '<span class="mut">Keine Einträge</span>';
  };
  const MS = [10000, 50000, 100000, 250000, 500000, 1000000];
  function confetti() {
    if (reduced()) return;
    const box = document.createElement('div'), cols = ['#ff5a1f', '#1f9d63', '#5b6cff', '#d4a017', '#ff4d6d'];
    box.className = 'cft'; box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 40; i++) { const s = document.createElement('i'); s.style.left = (50 + (Math.random() * 20 - 10)) + '%'; s.style.background = cols[i % cols.length]; s.style.setProperty('--dx', ((Math.random() * 2 - 1) * 48).toFixed(1) + 'vw'); s.style.setProperty('--dy', (40 + Math.random() * 55).toFixed(1) + 'vh'); s.style.setProperty('--r', (Math.random() * 900 - 450).toFixed(0) + 'deg'); s.style.animationDelay = (Math.random() * .12).toFixed(2) + 's'; box.appendChild(s); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2400);
  }
  function msCheck() {
    if (!S.as.length && !S.debts.length) return;
    const n = nn(), F = fireF(), marks = MS.concat(F > 0 ? [F] : []), hit = marks.filter(m => n >= m), top = hit.length ? Math.max(...hit) : 0;
    if (typeof S.msSeen !== 'number') { S.msSeen = top; localSave(); return; }
    if (top > S.msSeen) {
      S.msSeen = top; save(); confetti();
      toast(S.hide ? 'Meilenstein erreicht ✓' : (F > 0 && top === F ? 'Fuck-Off-Zahl erreicht: ' : 'Meilenstein erreicht: ') + eur(top));
    }
  }
  W.__fr_ms = { check: msCheck, confetti };

  /* =====================================================================
     11. PWA: Offline, Service Worker, Installations-Hinweis
     ===================================================================== */
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
  function offBar() {
    let b = $('offb');
    if (!b) { const top = document.querySelector('.top'); if (!top) return; b = document.createElement('div'); b.id = 'offb'; b.className = 'offb'; b.textContent = 'Offline · Änderungen bleiben auf dem Gerät und werden später synchronisiert'; top.after(b); }
    const off = navigator.onLine === false; b.classList.toggle('on', off); document.body.classList.toggle('offl', off);
  }
  W.addEventListener('offline', offBar);
  W.addEventListener('online', () => { offBar(); toast('Wieder online'); try { if (typeof sb !== 'undefined' && sb && user) push(); } catch (e) { } });
  function sab() { if ($('sab')) return; const s = document.createElement('div'); s.id = 'sab'; s.className = 'sab'; document.body.appendChild(s); }

  const _more = V.more;
  V.more = () => {
    let h = _more();
    const btn = (k, l) => '<button class="btn o" style="text-align:left" onclick="' + go(k) + '">' + l + '</button>', add = btn('passive', 'Passives Einkommen') + btn('job', 'Job-Szenarien · Teilzeit');
    const i = h.indexOf("onclick=\"tab='goals'"), j = i > 0 ? h.lastIndexOf('<button', i) : -1;
    h = j > 0 ? h.slice(0, j) + add + h.slice(j) : h + card('Neu', add);
    if (!standalone()) h += card('App installieren', '<div class="li"><span>1. Seite in <b>Safari</b> öffnen</span></div><div class="li"><span>2. <b>Teilen</b> antippen, dann „Zum Home-Bildschirm“</span></div><div class="li"><span>3. „Als Web-App öffnen“ aktiv lassen, <b>Hinzufügen</b></span></div><div class="note">Danach startet Finanz-Radar wie eine App: Vollbild, eigenes Icon, Startbildschirm und offline nutzbar. Die Home-Bildschirm-App hat einen eigenen Speicher: mit Cloud-Login sind deine Daten sofort da, ohne Login vorher unter Daten &amp; Backup exportieren.</div>');
    return h;
  };

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    const reg = () => navigator.serviceWorker.register('sw.js').catch(() => { });
    if (document.readyState === 'complete') reg(); else W.addEventListener('load', reg);
  }

  /* =====================================================================
     Einbindung
     ===================================================================== */
  const _render = W.render;
  W.render = function () {
    migrateTheme();
    _render();
    sab(); offBar();
    if (loggedIn()) msCheck();
  };
  W.__fr_boost = { simJob, jobC, baseP, piEff, piMonthly, piPot, piCov, netAt, salary, runwayM };
  render();
})();
