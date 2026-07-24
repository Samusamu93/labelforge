'use strict';

// Anteprima SVG dell'etichetta. Non è una resa ZPL esatta, ma riproduce
// fedelmente posizioni e dimensioni (in mm) di testo, barcode, QR, linee e riquadri,
// così da vedere il layout mentre si compila o si modifica un template.
(function () {
  function fillPlaceholders(str, data) {
    if (typeof str !== 'string') return '';
    return str.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (_, k) => {
      const v = (data || {})[k];
      return v === undefined || v === null || v === '' ? '' : String(v);
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Genera barre pseudo-casuali ma deterministiche dal valore (solo estetica anteprima).
  function barcodeBars(value, x, y, totalW, h) {
    const seedStr = value || '000';
    let bars = '';
    let cursor = x;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    while (cursor < x + totalW - 0.3) {
      const w = 0.25 + rnd() * 0.6;
      if (rnd() > 0.4) {
        bars += `<rect x="${cursor.toFixed(2)}" y="${y}" width="${w.toFixed(2)}" height="${h}" fill="#111"/>`;
      }
      cursor += w + 0.2;
    }
    return bars;
  }

  // QR stilizzato: griglia a scacchi deterministica.
  function qrBox(value, x, y, size) {
    const n = 12;
    const cell = size / n;
    const seedStr = value || 'QR';
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    let cells = `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff" stroke="#111" stroke-width="0.15"/>`;
    const finder = (fx, fy) => {
      cells += `<rect x="${fx}" y="${fy}" width="${cell * 3}" height="${cell * 3}" fill="#111"/>`;
      cells += `<rect x="${fx + cell}" y="${fy + cell}" width="${cell}" height="${cell}" fill="#fff"/>`;
    };
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const inFinder = (r < 3 && c < 3) || (r < 3 && c > n - 4) || (r > n - 4 && c < 3);
        if (inFinder) continue;
        if (rnd() > 0.5) {
          cells += `<rect x="${(x + c * cell).toFixed(2)}" y="${(y + r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#111"/>`;
        }
      }
    }
    finder(x, y);
    finder(x + cell * (n - 3), y);
    finder(x, y + cell * (n - 3));
    return cells;
  }

  function renderElement(el, dpi, data) {
    const x = Number(el.x_mm) || 0;
    const y = Number(el.y_mm) || 0;
    switch (el.type) {
      case 'text': {
        const text = fillPlaceholders(el.text, data);
        // altezza carattere in mm: da height_mm o da height_dots
        const hmm = el.height_mm || (el.height_dots ? (el.height_dots / dpi) * 25.4 : 3);
        const fontSize = hmm * 0.95;
        return `<text x="${x}" y="${y}" font-size="${fontSize.toFixed(2)}" font-family="Arial, sans-serif" dominant-baseline="text-before-edge" fill="#111">${esc(text) || ' '}</text>`;
      }
      case 'barcode128': {
        const text = fillPlaceholders(el.text, data);
        const h = el.bar_height_mm || (el.bar_height_dots ? (el.bar_height_dots / dpi) * 25.4 : 10);
        const w = Math.max(20, (text.length || 6) * 2.2);
        let out = barcodeBars(text, x, y, w, h);
        if (el.show_text !== false) {
          out += `<text x="${(x + w / 2).toFixed(2)}" y="${(y + h + 3).toFixed(2)}" font-size="2.6" font-family="monospace" text-anchor="middle" fill="#111">${esc(text)}</text>`;
        }
        return out;
      }
      case 'qrcode': {
        const text = fillPlaceholders(el.text, data);
        const size = (el.magnification || 4) * 5; // ~mm indicativi
        return qrBox(text, x, y, size);
      }
      case 'line':
      case 'box': {
        const w = Number(el.width_mm) || 0;
        const h = Number(el.height_mm) || 0;
        const t = el.thickness_mm || 0.3;
        return `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, t)}" fill="none" stroke="#111" stroke-width="${t}"/>`;
      }
      default:
        return '';
    }
  }

  // Ritorna una stringa SVG. enabledIndices opzionale (array).
  function renderPreviewSVG(template, data, enabledIndices) {
    const dpi = template.dpi || 203;
    const W = Number(template.width_mm) || 50;
    const H = Number(template.height_mm) || 25;
    const enabledSet = Array.isArray(enabledIndices) ? new Set(enabledIndices) : null;
    let body = '';
    (template.elements || []).forEach((el, i) => {
      const on = enabledSet ? enabledSet.has(i) : el.enabled !== false;
      if (on) body += renderElement(el, dpi, data);
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#cbd5e1" stroke-width="0.3"/>
      ${body}
    </svg>`;
  }

  // Bounding box (in mm) di ogni elemento, per l'interazione (selezione/trascinamento) nell'editor.
  function computeBoxes(template, data) {
    const dpi = template.dpi || 203;
    const boxes = [];
    (template.elements || []).forEach((el, index) => {
      const x = Number(el.x_mm) || 0;
      const y = Number(el.y_mm) || 0;
      let w = 4, h = 4;
      if (el.type === 'text') {
        const text = fillPlaceholders(el.text, data) || 'testo';
        const hmm = el.height_mm || (el.height_dots ? (el.height_dots / dpi) * 25.4 : 3);
        h = hmm; w = Math.max(6, text.length * hmm * 0.62);
      } else if (el.type === 'barcode128') {
        const text = fillPlaceholders(el.text, data);
        h = el.bar_height_mm || 10; w = Math.max(20, (text.length || 6) * 2.2);
        if (el.show_text !== false) h += 3.5;
      } else if (el.type === 'qrcode') {
        w = h = (el.magnification || 4) * 5;
      } else if (el.type === 'box' || el.type === 'line') {
        w = Number(el.width_mm) || 0; h = Math.max(Number(el.height_mm) || 0, el.thickness_mm || 0.3);
      }
      boxes.push({ index, type: el.type, x, y, w, h });
    });
    return boxes;
  }

  window.LabelPreview = { renderPreviewSVG, computeBoxes };
})();
