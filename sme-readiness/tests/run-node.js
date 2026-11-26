#!/usr/bin/env node
// Runs the Kinhold engine tests in Node. Usage: node sme-readiness/tests/run-node.js
'use strict';
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'data', f));
const ctx = {
  S: require('../js/engine/scoring.js'),
  R: require('../js/engine/recommend.js'),
  C: require('../js/engine/checker.js'),
  data: { questions: load('questions.json'), recommendations: load('recommendations.json'), sources: load('sources.json'), messages: load('messages.json'), benchmarks: load('benchmarks.json') },
};
let pass = 0, fail = 0;
require('./engine.tests.js')((name, fn) => {
  let ok, detail;
  try { [ok, detail] = fn(); } catch (e) { ok = false; detail = e.stack; }
  if (ok) pass++; else fail++;
  if (!ok || process.argv.includes('-v')) console.log((ok ? 'ok    ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''));
}, ctx);
console.log(fail ? fail + ' failed, ' + pass + ' passed' : 'All ' + pass + ' tests passed.');
process.exit(fail ? 1 : 0);
