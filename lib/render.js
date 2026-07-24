'use strict';

// Dispatcher del linguaggio di stampa: sceglie il generatore in base a template.language.
// - 'zpl'  (default) → Zebra / compatibili ZPL
// - 'tspl'          → TSC e simili
const { buildZpl, extractPlaceholders, mmToDots, fillPlaceholders, renderLabelBody } = require('./zpl');
const { buildTspl } = require('./tspl');
const { buildEpl } = require('./epl');
const { buildCpcl } = require('./cpcl');
const { buildEzpl } = require('./ezpl');

// Solo ZPL è testato. TSPL/EPL/CPCL/EZPL sono sperimentali e NON testati su hardware reale.
function buildLabel(template, dataList, opts = {}) {
  const lang = (template && template.language) || 'zpl';
  switch (lang) {
    case 'tspl': return buildTspl(template, dataList, opts);
    case 'epl': return buildEpl(template, dataList, opts);
    case 'cpcl': return buildCpcl(template, dataList, opts);
    case 'ezpl': return buildEzpl(template, dataList, opts);
    default: return buildZpl(template, dataList, opts);
  }
}

module.exports = { buildLabel, buildZpl, buildTspl, buildEpl, buildCpcl, buildEzpl, extractPlaceholders, mmToDots, fillPlaceholders, renderLabelBody };
