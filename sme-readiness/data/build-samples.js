#!/usr/bin/env node
/*
 * Builds data/sample-clients.json: four fictional small businesses, each with two checks a few
 * months apart, the actions that closed gaps between them, and plan steps done since the latest. Deterministic, so the sample is the same
 * every time. Usage: node sme-readiness/data/build-samples.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./questions.json');
const S = require('../js/engine/scoring.js');
global.KinholdScoring = S;
const R = require('../js/engine/recommend.js');
const RECS = require('./recommendations.json');

// Small seeded generator so answers look natural but never change between runs.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function answers(profile, maturity, seed, fixed) {
  const r = rng(seed), out = {};
  S.applicable(Q.questions, profile).forEach((q) => {
    // Heavier questions are a little more likely to be in place in a mature business.
    const p = maturity + (q.weight - 2) * 0.05, x = r();
    out[q.id] = x < p ? 'yes' : x < p + 0.15 ? 'partly' : x < p + 0.27 ? 'unsure' : 'no';
  });
  return Object.assign(out, fixed || {});
}
function improve(before, ids) { const a = Object.assign({}, before); ids.forEach((id) => { if (a[id] !== undefined) a[id] = 'yes'; }); return a; }

const clients = [
  {
    id: 'brightloaf', name: 'Brightloaf Bakery', contact: 'Owner', town: 'Hebden Bridge',
    profile: { sector: 'shop', size: 'micro', online: 'yes', domain: 'yes', invoices: 'no', ai: 'unsure', chatbot: 'no' },
    maturity: 0.38, seed: 11, fixed: { pw1: 'yes', pay1: 'no', ai3: 'unsure' },
    later: ['pay1', 'pay3', 'bk3', 'ac1', 'dv1', 'ai3'], since: 3, first: '2026-07-14', second: '2026-10-20',
  },
  {
    id: 'northlight', name: 'Northlight Dental Studio', contact: 'Practice manager', town: 'Stockport',
    profile: { sector: 'clinic', size: 'small', online: 'yes', domain: 'yes', invoices: 'yes', ai: 'yes', chatbot: 'no' },
    maturity: 0.58, seed: 23, fixed: { pw1: 'yes', pay1: 'yes', dt4: 'unsure' },
    later: ['dt4', 'dt3', 'ai5', 'ai7', 'ir1', 'bk2'], since: 5, first: '2026-06-02', second: '2026-09-29',
  },
  {
    id: 'kilnworks', name: 'Kilnworks Joinery', contact: 'Director', town: 'Salford',
    profile: { sector: 'trades', size: 'micro', online: 'no', domain: 'no', invoices: 'yes', ai: 'no', chatbot: 'no' },
    maturity: 0.24, seed: 37, fixed: { pw1: 'no', pay1: 'no' },
    later: ['pw1', 'pw2', 'pay1'], since: 2, first: '2026-08-18', second: '2026-11-03',
  },
  {
    id: 'fernpath', name: 'Fernpath Creative', contact: 'Operations lead', town: 'Manchester',
    profile: { sector: 'office', size: 'small', online: 'no', domain: 'yes', invoices: 'yes', ai: 'yes', chatbot: 'yes' },
    maturity: 0.7, seed: 41, fixed: { pw1: 'yes', pay1: 'yes', ai6: 'no' },
    later: ['ai6', 'em3', 'sp2', 'ac4'], since: 4, first: '2026-05-11', second: '2026-10-06',
  },
].map((c) => {
  const a1 = answers(c.profile, c.maturity, c.seed, c.fixed);
  const a2 = improve(a1, c.later);
  return {
    id: c.id, name: c.name, contact: c.contact, town: c.town, profile: c.profile, sample: true,
    checks: [{ date: c.first, answers: a1 }, { date: c.second, answers: a2 }],
    // Done: what they fixed before the latest check, plus the first few plan steps they've
    // ticked off since (in plan order), so plan progress is part-way through.
    done: c.later.map((qid) => Q.questions.find((q) => q.id === qid).recommendation)
      .concat(R.plan(R.rank(Q, RECS, c.profile, a2)).flatMap((p) => p.actions).slice(0, c.since).map((a) => a.id)),
  };
});

const out = { note: 'Fictional sample businesses for the demo. Any resemblance to real businesses is accidental.', clients };
fs.writeFileSync(path.join(__dirname, 'sample-clients.json'), JSON.stringify(out, null, 2) + '\n');
clients.forEach((c) => {
  const r1 = S.score(Q, c.profile, c.checks[0].answers), r2 = S.score(Q, c.profile, c.checks[1].answers);
  console.log(c.name.padEnd(26), r1.levelInfo.label.padEnd(16), r1.score, '->', r2.levelInfo.label.padEnd(16), r2.score, r2.capped ? '(capped)' : '');
});
