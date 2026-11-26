#!/usr/bin/env node
/*
 * Runs every saved query against the generated database with the sqlite3 command line tool.
 * A quick check while developing; the browser test page (queries.test.html) is the real test,
 * because it runs the same queries through sql.js, exactly as Signal does.
 *
 * Usage: node fintech-analytics/data/generate.js --keep && node fintech-analytics/tests/run-queries-node.js
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const Q = require('../js/queries.js');
const db = path.join(__dirname, '..', 'data', 'signal.sqlite');
const combos = [
  ['defaults', {}],
  ['microfinance banks, growth plan', { lender_type: 'microfinance_bank', plan: 'growth' }],
  ['North, bureau only, 6 months', { region: 'North', endpoint: 'bureau', from_month: '2026-05', to_month: '2026-10' }],
  ['all 24 months', { from_month: '2024-11', to_month: '2026-10' }],
];
let failed = 0;
for (const q of Q.list) {
  for (const [label, params] of combos) {
    const sql = Q.render(q.id, params);
    const t = Date.now();
    const r = spawnSync('sqlite3', ['-json', '-bail', db], { input: sql, encoding: 'utf8', maxBuffer: 1 << 28 });
    const ms = Date.now() - t;
    const err = r.status !== 0 || r.stderr.trim();
    const rows = err ? 0 : (r.stdout.trim() ? JSON.parse(r.stdout).length : 0);
    const mustHaveRows = label === 'defaults';
    const bad = err || (mustHaveRows && rows === 0);
    if (bad) failed++;
    if (bad || label === 'defaults') console.log((bad ? 'FAIL ' : 'ok   ') + q.id.padEnd(30) + String(rows).padStart(6) + ' rows ' + String(ms).padStart(5) + ' ms  ' + label + (err ? '\n     ' + r.stderr.trim() : ''));
  }
}
console.log(failed ? failed + ' failed' : 'All ' + Q.list.length + ' queries ran with every filter combination.');
process.exit(failed ? 1 : 0);
