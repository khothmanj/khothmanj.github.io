/* Runs the Tenor engine tests in Node: node tenor/tests/run-node.js */
const path = require('path');
const fs = require('fs');
const dir = path.join(__dirname, '..');
const E = require(path.join(dir, 'js/engine.js'));
const A = require(path.join(dir, 'js/adapter.js'));
const { runTenorTests } = require(path.join(__dirname, 'engine.tests.js'));
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'data', f), 'utf8'));
const data = { cases: load('cases.json'), sectors: load('sectors.json'), defaults: load('defaults.json') };

const results = runTenorTests(E, A, data);
let failed = 0;
results.forEach((r) => { if (!r.pass) failed++; console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail ? '  (' + r.detail + ')' : '')); });
if (process.argv.includes('--cases') && results.caseResults) {
  console.log('\nCase results');
  const pct = (x) => (x === null || x === undefined ? 'n/a' : (x * 100).toFixed(1) + '%');
  const f2 = (x) => (x === null || x === undefined ? 'n/a' : x.toFixed(2));
  results.caseResults.forEach((c) => {
    if (!c.model) return console.log(c.id, 'ERROR', c.problems.join('; '));
    const k = c.model.kpis;
    console.log([c.id.padEnd(34), 'yrs ' + c.model.N, 'EBITDA% ' + pct(k.ebitdaMargin), 'minDSCR ' + f2(k.dscrMin), 'LLCR ' + f2(k.llcr),
      'pIRR ' + pct(k.projectIRR), 'eIRR ' + pct(k.equityIRR), 'payback ' + f2(k.paybackYears), 'lowCash ' + Math.round(k.lowestCash).toLocaleString('en-GB'),
      'ready ' + c.readiness.score, 'most sensitive: ' + c.sens.ranked[0]].join(' | '));
  });
}
console.log('\n' + (results.length - failed) + ' of ' + results.length + ' tests passed');
process.exit(failed ? 1 : 0);
