'use strict';
// Unabhängige Nachrechnung der Schuldentilgung (B-19), ohne Code aus der App.
// Monatliche Schleife: Zins = Restschuld × r/12/100, Rate abzüglich Zins, letzte Rate kleiner.
// Liefert Anzahl der Raten, Summe der Zinsen und Restschuld nach 12 Raten.

function nachrechnung(B, rPct, rate, obergrenze = 1200) {
  const i = rPct / 1200;
  let b = B, k = 0, zinsSumme = 0, rest12 = null;
  while (b > 1e-9) {
    if (k >= obergrenze) return { lang: true, rest12 };
    const zins = b * i;
    const rateHeute = Math.min(rate, b + zins);
    b = b + zins - rateHeute;
    zinsSumme += zins;
    k++;
    if (k === 12) rest12 = Math.max(0, b);
  }
  if (rest12 === null) rest12 = 0;
  return { lang: false, n: k, gesamt: zinsSumme, rest12 };
}

module.exports = { nachrechnung };
