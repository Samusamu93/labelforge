'use strict';

// Dispatcher del linguaggio di stampa: sceglie il generatore in base a template.language.
// - 'zpl'  (default) → Zebra / compatibili ZPL
// - 'tspl'          → TSC e simili
const { buildZpl, extractPlaceholders, mmToDots, fillPlaceholders, renderLabelBody } = require('./zpl');
const { buildTspl } = require('./tspl');

function buildLabel(template, dataList, opts = {}) {
  const lang = (template && template.language) || 'zpl';
  if (lang === 'tspl') return buildTspl(template, dataList, opts);
  return buildZpl(template, dataList, opts);
}

module.exports = { buildLabel, buildZpl, buildTspl, extractPlaceholders, mmToDots, fillPlaceholders, renderLabelBody };
