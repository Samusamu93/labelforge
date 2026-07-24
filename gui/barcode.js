'use strict';

// Encoder Code 128 (subset B) — genera la sequenza di larghezze di barre/spazi.
// Usato per disegnare un barcode REALE nell'anteprima. La stampa vera resta gestita
// dalla stampante via ZPL; questo serve solo a mostrare fedelmente il codice.
(function () {
  // Pattern canonici Code 128 (indice 0..106). Ogni pattern è la sequenza di
  // larghezze barra/spazio (inizia con una barra). I pattern dati sommano 11, lo stop 13.
  const PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];
  const START_B = 104;
  const STOP = 106;

  // Ritorna un array di larghezze (in moduli) alternate barra/spazio, iniziando con barra.
  function encode128B(text) {
    const s = String(text).replace(/[^\x20-\x7E]/g, ''); // solo ASCII stampabile
    const values = [START_B];
    for (const ch of s) values.push(ch.charCodeAt(0) - 32);
    let sum = START_B;
    for (let i = 1; i < values.length; i++) sum += values[i] * i;
    values.push(sum % 103);
    values.push(STOP);
    const widths = [];
    for (const v of values) for (const d of PATTERNS[v]) widths.push(Number(d));
    return widths; // sequenza: barra, spazio, barra, ... (l'ultima barra dello stop è la barra finale)
  }

  // Genera <rect> SVG per il barcode, a partire da (x,y) in mm, altezza h, e larghezza modulo in mm.
  function code128SVG(text, x, y, h, moduleMm) {
    const widths = encode128B(text);
    let out = '';
    let cursor = x;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i] * moduleMm;
      if (i % 2 === 0) { // posizioni pari = barra
        out += `<rect x="${cursor.toFixed(3)}" y="${y}" width="${w.toFixed(3)}" height="${h}" fill="#111"/>`;
      }
      cursor += w;
    }
    return { svg: out, width: cursor - x };
  }

  const api = { encode128B, code128SVG, PATTERNS };
  if (typeof window !== 'undefined') window.Barcode = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
