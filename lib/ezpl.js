'use strict';

// Generatore EZPL (Godex) — SPERIMENTALE E NON TESTATO su stampante reale.
// Usato dalle stampanti Godex (serie G500, RT200, DT2x, ecc.).
// I comandi di disegno sono in stile EPL dentro una cornice ^Q/^W/^L ... E.

const { mmToDots, fillPlaceholders } = require('./zpl');

function esc(s) { return String(s).replace(/"/g, '\\"'); }

function renderElement(el, dpi, data) {
  const x = mmToDots(el.x_mm ?? el.x, dpi);
  const y = mmToDots(el.y_mm ?? el.y, dpi);
  switch (el.type) {
    case 'text': {
      const mul = Math.max(1, Math.round((el.height_mm || 3) / 2));
      return `AA,${x},${y},${mul},${mul},0,"${esc(fillPlaceholders(el.text, data))}"`;
    }
    case 'barcode128':
    case 'code39':
    case 'ean13': {
      const height = el.bar_height_dots || mmToDots(el.bar_height_mm || 10, dpi);
      const narrow = el.module_width || 2;
      const wide = narrow * 2;
      const sym = el.type === 'barcode128' ? '1' : el.type === 'code39' ? '3' : 'E30';
      return `B${x},${y},0,${sym},${narrow},${wide},${height},"${esc(fillPlaceholders(el.text, data))}"`;
    }
    case 'qrcode': {
      const cell = el.magnification || 4;
      return `W${x},${y},Q,3,${cell},"${esc(fillPlaceholders(el.text, data))}"`;
    }
    case 'box': {
      const w = mmToDots(el.width_mm, dpi);
      const h = mmToDots(el.height_mm, dpi);
      const t = el.thickness_dots || mmToDots(el.thickness_mm || 0.3, dpi) || 1;
      return `R${x},${y},${x + w},${y + h},${t},${t}`;
    }
    case 'line': {
      const w = mmToDots(el.width_mm, dpi);
      const t = el.thickness_dots || mmToDots(el.thickness_mm || 0.3, dpi) || 1;
      return `R${x},${y},${x + w},${y + t},${t},${t}`;
    }
    default:
      return `; (elemento ${el.type} non supportato in EZPL)`;
  }
}

function renderLabel(template, data, opts) {
  const dpi = template.dpi || 203;
  const parts = [
    `^Q${template.height_mm},${template.gap_mm != null ? template.gap_mm : 3}`,
    `^W${template.width_mm}`,
    '^H10', '^P1', '^L',
  ];
  const enabledSet = Array.isArray(opts && opts.enabledIndices) ? new Set(opts.enabledIndices) : null;
  (template.elements || []).forEach((el, i) => {
    const on = enabledSet ? enabledSet.has(i) : el.enabled !== false;
    if (on) parts.push(renderElement(el, dpi, data));
  });
  parts.push('E');
  return parts.join('\n');
}

function buildEzpl(template, dataList, opts = {}) {
  const chunks = [];
  const copies = opts.copiesPerLabel || 1;
  for (const data of dataList) for (let i = 0; i < copies; i++) chunks.push(renderLabel(template, data, opts));
  return Buffer.from(chunks.join('\n') + '\n', 'ascii');
}

module.exports = { buildEzpl };
