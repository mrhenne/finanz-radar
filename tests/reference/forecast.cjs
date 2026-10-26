'use strict';
// Unabhängige Nachrechnung der Prognose-Formeln (ohne Code aus der App).
// Modell der App: effektiver Jahreszins r - TER, dazu äquivalenter Monatszins m = (1+r)^(1/12) - 1,
// Sparrate am Monatsende. Steuer auf den Gewinn: 30 % Teilfreistellung, Sparer-Pauschbetrag je Jahr,
// Abgeltungsteuer mit Soli 26,375 %.

// Geschlossene Formel für monatlich verzinsten Endwert mit Sparraten am Monatsende.
function fvEquivalent(s0, sm, years, annualPct) {
  const m = Math.pow(1 + annualPct / 100, 1 / 12) - 1, n = years * 12;
  return s0 * Math.pow(1 + m, n) + sm * (Math.pow(1 + m, n) - 1) / m;
}

// Zum Vergleich: nomineller Jahreszins, monatlich verzinst (r/12 je Monat).
function fvNominalMonthly(s0, sm, years, annualPct) {
  const m = annualPct / 100 / 12, n = years * 12;
  return s0 * Math.pow(1 + m, n) + sm * (Math.pow(1 + m, n) - 1) / m;
}

// Zum Vergleich: jährlich verzinst, Sparraten zu Jahresende.
function fvAnnual(s0, sm, years, annualPct) {
  const q = 1 + annualPct / 100;
  return s0 * Math.pow(q, years) + sm * 12 * (Math.pow(q, years) - 1) / (q - 1) * 1;
}

// Steuer auf den Gewinn am Ende der Ansparphase (Teilfreistellung 30 %, Pauschbetrag 1.000 €, 26,375 %).
function taxEnd(gain, { tf = 30, fb = 1000, tr = 26.375 } = {}) {
  return Math.max(0, gain * (1 - tf / 100) - fb) * tr / 100;
}

// Inflationsbereinigter Wert in heutigen Euro.
function real(value, inflPct, years) {
  return value / Math.pow(1 + inflPct / 100, years);
}

module.exports = { fvEquivalent, fvNominalMonthly, fvAnnual, taxEnd, real };

// Schrittweise Nachrechnung (monatliche Schleife, unabhängig vom App-Code).
// Ansparphase: Sparrate am Monatsende, Sparrate steigt jährlich um dyn %, Einmalzahlungen am Jahresende.
// Entnahmephase: Entnahme am Monatsende, Steuer je Kalenderjahr (Teilfreistellung, Pauschbetrag).
function refSim({ s0, sm, dyn = 0, years, annualPct, ter = 0, lumps = [], ex = false, T = years, wm = 0, wy = 0, wi = true, inf = 0, tf = 30, fb = 1000, tr = 26.375, tx = true }) {
  const m = Math.pow(1 + (annualPct - ter) / 100, 1 / 12) - 1;
  let v = s0, inv = s0, sr = sm;
  const yearEnd = [{ y: 0, inv, v }];
  for (let y = 1; y <= years; y++) {
    for (let k = 0; k < 12; k++) { v = v * (1 + m) + sr; inv += sr; }
    for (const l of lumps) if (l.y === y) { v += l.a; inv += l.a; }
    yearEnd.push({ y, inv, v });
    sr *= 1 + dyn / 100;
  }
  const out = { yearEnd, tax: 0, net: 0, dep: null };
  if (!ex) return out;
  let b = inv;
  for (let y = years + 1; y <= T; y++) {
    const wmY = wm * (wi ? Math.pow(1 + inf / 100, y) : 1);
    let tb = 0, gr = 0;
    for (let k = 0; k < 12; k++) {
      v *= 1 + m;
      const g = Math.min(wmY, Math.max(v, 0));
      if (g > 0) { const fr = Math.max(0, (v - b) / v); tb += g * fr * (1 - tf / 100); b -= g * (1 - fr); v -= g; gr += g; }
    }
    const tax = tx ? Math.max(0, tb - fb) * tr / 100 : 0;
    out.tax += tax; out.net += gr - tax;
    if (v <= 0.5 && out.dep === null) out.dep = y; // absolutes Jahr, wie in der App (w.dep)
    yearEnd.push({ y, inv, v: Math.max(v, 0) });
  }
  out.final = Math.max(v, 0);
  return out;
}

// Fuck-Off-Rechner: Ansparen bis zur Zielzahl F (monatlich), danach jährliche Entnahme mit Steuer.
function refFx({ rg, v0, b0, sr, F, wm, wy, wi, inf, kt, pb }) {
  const m = Math.pow(1 + rg / 100, 1 / 12) - 1;
  let v = v0, b = Math.min(b0, v0), k = 0;
  while (v < F && k < 720) { v = v * (1 + m) + sr; b += sr; k++; }
  const ya = k / 12;
  let tax = 0, net = 0, dep = null;
  for (let j = 1; j <= wy; j++) {
    let tb = 0, gr = 0;
    for (let q = 0; q < 12; q++) {
      v *= 1 + m;
      const w = wm * (wi ? Math.pow(1 + inf / 100, ya + (j - 1) + q / 12) : 1);
      const g = Math.min(w, Math.max(v, 0));
      if (g > 0) { const fr = Math.max(0, (v - b) / v); tb += g * fr * 0.7; b -= g * (1 - fr); v -= g; gr += g; }
    }
    const t = Math.max(0, tb - pb) * kt / 100;
    tax += t; net += gr - t;
    if (v <= 0.5 && dep === null) dep = j;
  }
  return { ya, tax, net, dep, rest: Math.max(v, 0) };
}

// Kleinster ganzzahliger Monat k mit Endwert >= F (geschlossene Formel, ohne Schleife über die App).
function refYearsToTarget(v0, sr, annualPct, F) {
  const m = Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  for (let k = 0; k <= 960; k++) {
    const fv = k === 0 ? v0 : v0 * Math.pow(1 + m, k) + sr * (Math.pow(1 + m, k) - 1) / m;
    if (fv >= F) return k / 12;
  }
  return null;
}

module.exports.refSim = refSim;
module.exports.refFx = refFx;
module.exports.refYearsToTarget = refYearsToTarget;
