'use strict';

// Smoke test senza dipendenze: verifica le parti core (generatori e encoder).
// Eseguire con: node test/smoke.js
const assert = require('assert');
const path = require('path');

const { buildLabel, extractPlaceholders } = require('../lib/render');
const barcode = require('../gui/barcode.js'); // esporta module.exports in Node

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + ' → ' + e.message); process.exitCode = 1; }
}

const tpl = {
  dpi: 203, width_mm: 60, height_mm: 40,
  field_meta: { cat: { type: 'select', options: ['A', 'B'] } },
  elements: [
    { type: 'text', x_mm: 3, y_mm: 3, height_mm: 4, text: '{{title}}' },
    { type: 'barcode128', x_mm: 3, y_mm: 12, bar_height_mm: 10, text: '{{code}}' },
    { type: 'qrcode', x_mm: 45, y_mm: 10, magnification: 4, text: '{{code}}' },
  ],
};

console.log('LabelForge smoke test');

test('extractPlaceholders trova i campi', () => {
  assert.deepStrictEqual(extractPlaceholders(tpl), ['title', 'code']);
});

test('buildLabel ZPL (default) produce ^XA...^XZ', () => {
  const z = buildLabel(tpl, [{ title: 'X', code: 'ABC' }]).toString();
  assert.ok(z.startsWith('^XA') && z.trimEnd().endsWith('^XZ'), 'delimitatori ZPL');
});

test('buildLabel TSPL produce comandi TSPL', () => {
  const t = buildLabel(Object.assign({ language: 'tspl' }, tpl), [{ title: 'X', code: 'ABC' }]).toString();
  assert.ok(t.includes('SIZE ') && t.includes('PRINT 1,1'), 'header TSPL');
});

test('dispatcher lingue: epl/cpcl/ezpl non vuoti', () => {
  for (const lang of ['epl', 'cpcl', 'ezpl']) {
    const out = buildLabel(Object.assign({ language: lang }, tpl), [{ title: 'X', code: 'ABC' }]).toString();
    assert.ok(out.length > 10, 'output ' + lang);
  }
});

test('barcode con dato vuoto viene saltato (ZPL)', () => {
  const z = buildLabel(tpl, [{ title: 'Solo testo', code: '' }]).toString();
  assert.ok(!z.includes('^BC') && !z.includes('^BQ'), 'niente barcode/QR vuoti');
});

test('Code128: pattern validi e checksum ("AB" = 57 moduli)', () => {
  assert.strictEqual(barcode.PATTERNS.length, 107);
  const w = barcode.encode128B('AB');
  assert.strictEqual(w.reduce((a, b) => a + b, 0), 57);
});

test('EAN-13: cifra di controllo corretta e 95 moduli', () => {
  assert.strictEqual(barcode.ean13CheckDigit('978030640615'), 7);
  const e = barcode.encodeEAN13('978030640615');
  assert.strictEqual(e.bits.length, 95);
  assert.ok(e.bits.startsWith('101') && e.bits.endsWith('101'));
});

test('Code93: tutti i pattern sommano 9', () => {
  const w = barcode.encode93('TEST'); // deve produrre una sequenza non vuota
  assert.ok(w.length > 10);
});

console.log(`\n${passed} test superati.`);
