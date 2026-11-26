#!/usr/bin/env node
/*
 * Signal sample data generator.
 *
 * Builds the Lendwell database used by Signal: 180 fictional lender customers,
 * 24 months of history (Nov 2024 to Oct 2026), daily API usage per customer
 * per endpoint, onboarding, compliance reviews, billing, ledger, support
 * tickets and product events.
 *
 * Everything comes from a seeded random generator, so every run produces the
 * same database. Each part of the data has its own random stream, so changing
 * one part does not reshuffle the others.
 *
 * Usage:  node fintech-analytics/data/generate.js
 * Needs:  Node 18+ and the sqlite3 command line tool (built into macOS).
 * Writes: signal.sqlite.gz (shipped) and, with --keep, signal.sqlite and signal.sql.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const SEED = 20261101;
const OUT_DIR = __dirname;
const KEEP = process.argv.includes('--keep');

/* ---------------- random streams ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function stream(name) {
  const r = mulberry32((SEED ^ hash(name)) >>> 0);
  const o = {
    u: r,
    between: (a, b) => a + r() * (b - a),
    int: (a, b) => a + Math.floor(r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    weighted(obj) { const keys = Object.keys(obj); const total = keys.reduce((s, k) => s + obj[k], 0); let x = r() * total; for (const k of keys) { x -= obj[k]; if (x < 0) return k; } return keys[keys.length - 1]; },
    norm() { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); },
    logn: (median, sigma) => median * Math.exp(sigma * o.norm()),
    poisson(l) {
      if (l <= 0) return 0;
      if (l > 40) return Math.max(0, Math.round(l + Math.sqrt(l) * o.norm()));
      const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1;
    },
  };
  return o;
}

/* ---------------- dates (whole days since 1970, times as fractional days) ---------------- */
const DAY_MS = 86400000;
const D = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / DAY_MS);
const F = (d) => new Date(Math.floor(d) * DAY_MS).toISOString().slice(0, 10);
const FT = (t) => new Date(Math.round(t * 1440) * 60000).toISOString().slice(0, 16).replace('T', ' ');
const YM = (d) => F(d).slice(0, 7);
const monthOf = (d) => new Date(d * DAY_MS).getUTCMonth() + 1;
const dayOfMonth = (d) => new Date(d * DAY_MS).getUTCDate();
const dow = (d) => new Date(d * DAY_MS).getUTCDay(); // 0 Sunday
const firstOfMonth = (ym) => D(ym + '-01');
const nextMonth = (ym) => { let [y, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); };

const START = D('2024-11-01');
const END = D('2026-10-31');          // last full day of data (the "as of" date)
const CUTOFF = END + 1;               // nothing can happen at or after this instant
const MONTHS = []; for (let ym = '2024-11'; ym <= '2026-10'; ym = nextMonth(ym)) MONTHS.push(ym);

/* ---------------- product events (also used as chart annotations) ---------------- */
const DOCS_DAY = D('2025-07-01');
const STATEMENT_LAUNCH = D('2025-06-02');
const PRICING_DAY = D('2025-09-01');
const OUTAGE_START = D('2026-08-10');
const BACKLOG_DAY = D('2026-08-03');
const OUTAGE_PEAK = [0.08, 0.19, 0.22, 0.17, 0.12, 0.06, 0.03]; // upstream error rate per day of the outage week
const EVENTS = [
  ['2025-07-01', 'release', 'Integration docs rewritten', 'New quickstart guide, a Postman collection and sandbox test BVNs for every endpoint.'],
  ['2025-06-02', 'release', 'Bank statement analysis launched', 'New endpoint that reads six months of bank statements and returns income, spending and risk flags.'],
  ['2025-09-01', 'pricing', 'New pricing', 'Credit bureau reports rise from NGN 350 to NGN 420. BVN checks fall from NGN 35 to NGN 30.'],
  ['2025-11-20', 'season', 'Festive lending season', 'Loan demand rises through December as households borrow for the holidays.'],
  ['2026-08-03', 'ops', 'Compliance review backlog', 'One of two compliance reviewers left. Review decisions now take about a month instead of under two weeks.'],
  ['2026-08-10', 'incident', 'Credit bureau provider outage', 'The upstream bureau was unavailable or degraded for seven days. Credit bureau errors peaked at about 1 in 5 calls.'],
  ['2026-11-20', 'season', 'Festive lending season', 'Loan demand rises through December as households borrow for the holidays.'],
].filter((e) => D(e[0]) <= END);

/* ---------------- reference tables ---------------- */
const PLANS = [
  ['starter', 'Starter', 0],
  ['growth', 'Growth', 150000],
  ['enterprise', 'Enterprise', 750000],
];
const FEE = Object.fromEntries(PLANS.map((p) => [p[0], p[2]]));

// id, code, name, category, launched_on, billable
const ENDPOINTS = [
  [1, 'bvn', 'BVN verification', 'Identity', '2022-03-01', 1],
  [2, 'nin', 'NIN verification', 'Identity', '2022-03-01', 1],
  [3, 'bureau', 'Credit bureau report', 'Credit', '2022-03-01', 1],
  [4, 'statement', 'Bank statement analysis', 'Credit', '2025-06-02', 1],
  [5, 'mandate', 'Direct debit mandate', 'Payments', '2022-09-01', 1],
  [6, 'disbursement', 'Disbursement', 'Payments', '2022-09-01', 1],
  [7, 'collection', 'Repayment collection', 'Payments', '2022-09-01', 1],
  [8, 'webhook', 'Webhook delivery', 'Platform', '2022-03-01', 0],
];
const EP = Object.fromEntries(ENDPOINTS.map((e) => [e[1], e[0]]));

// endpoint_id, price_ngn, valid_from, valid_to (exclusive, null = current)
const PRICES = [
  [1, 35, '2022-03-01', '2025-09-01'], [1, 30, '2025-09-01', null],
  [2, 50, '2022-03-01', null],
  [3, 350, '2022-03-01', '2025-09-01'], [3, 420, '2025-09-01', null],
  [4, 250, '2025-06-02', null],
  [5, 100, '2022-09-01', null],
  [6, 45, '2022-09-01', null],
  [7, 40, '2022-09-01', null],
  [8, 0, '2022-03-01', null],
];
function price(ep, d) { for (const p of PRICES) if (p[0] === ep && d >= D(p[2]) && (!p[3] || d < D(p[3]))) return p[1]; return 0; }

const STAGES = ['signed_up', 'sandbox_keys_issued', 'first_sandbox_call', 'kyc_approved', 'production_keys_issued', 'first_live_call', 'reached_1000_live_calls'];
const MANAGERS = ['Adaeze Okafor', 'Tunde Balogun', 'Zainab Yusuf', 'Chidi Eze', 'Folake Adebayo'];
const INFO_REASONS = {
  'Operating licence not attached': 0.30,
  'Data protection policy missing': 0.22,
  'Directors ID documents unclear': 0.18,
  'Ownership structure not documented': 0.15,
  'Use case description incomplete': 0.15,
};

/* ---------------- customers ---------------- */
// Invented compound names, so none should match a real lender.
const NAME_A = ['Amber', 'Kestrel', 'Tamar', 'Corvel', 'Lumen', 'Sable', 'Harbour', 'Cedar', 'Ember', 'Marlow', 'Ivory', 'Juniper', 'Halcyon', 'Orchid', 'Russet', 'Saffron', 'Willow', 'Granite', 'Copper', 'Indigo', 'Linden', 'Mosaic', 'Bramble', 'Calder', 'Dunmore', 'Elmer', 'Fallow', 'Garnet', 'Heather', 'Larch', 'Mallow', 'Oriel', 'Pellow', 'Quill', 'Rowan', 'Sorrel', 'Thistle', 'Umber', 'Verity', 'Wren'];
const NAME_B = ['vale', 'field', 'stone', 'gate', 'wick', 'mere', 'crest', 'haven', 'brook', 'ridge', 'ford', 'well', 'bay', 'point', 'combe', 'hurst'];
const SUFFIX = {
  digital_lender: ['Credit', 'Capital', 'Lending', 'Finance', 'Loans'],
  microfinance_bank: ['Microfinance Bank'],
  cooperative: ['Cooperative Society', 'Thrift and Credit Cooperative', 'Multipurpose Cooperative'],
  bnpl: ['Pay', 'PayLater', 'Instalments'],
};

function buildCustomers() {
  const S = stream('customers');
  const list = [];
  // 32 customers who signed up before the window and are already live (the revenue base).
  for (let i = 0; i < 32; i++) list.push({ legacy: true, signup: S.int(D('2023-02-01'), D('2024-09-10')) });
  // 148 signups inside the window, growing month by month.
  const weights = MONTHS.map((ym, i) => (1 + i * 0.055) * ([1, 9].includes(Number(ym.slice(5))) ? 1.15 : 1));
  const total = 148, wsum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / wsum) * total);
  const counts = raw.map(Math.floor);
  let rest = total - counts.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, i]) => counts[i]++);
  MONTHS.forEach((ym, i) => {
    const a = firstOfMonth(ym), b = firstOfMonth(nextMonth(ym)) - 1;
    for (let k = 0; k < counts[i]; k++) list.push({ legacy: false, signup: S.int(a, b) });
  });
  list.sort((x, y) => x.signup - y.signup);

  const used = new Set();
  list.forEach((c, i) => {
    c.id = i + 1;
    c.lender_type = S.weighted({ digital_lender: 45, microfinance_bank: 25, cooperative: 15, bnpl: 15 });
    c.size_band = c.legacy ? S.weighted({ small: 30, mid: 42, large: 28 }) : S.weighted({ small: 56, mid: 33, large: 11 });
    if (c.lender_type === 'cooperative' && c.size_band === 'large') c.size_band = 'mid';
    c.plan = c.size_band === 'small' ? S.weighted({ starter: 76, growth: 24 })
      : c.size_band === 'mid' ? S.weighted({ starter: 28, growth: 56, enterprise: 16 })
      : S.weighted({ growth: 30, enterprise: 70 });
    c.region = S.weighted({ Lagos: 40, FCT: 15, 'South-South': 14, 'South-West': 10, North: 13, 'South-East': 8 });
    c.integration_pattern = S.weighted({ direct_api: 55, sdk: 25, partner_aggregator: 20 });
    c.account_manager = c.plan === 'starter' ? 'Self-serve' : S.pick(MANAGERS);
    let name;
    do { name = S.pick(NAME_A) + S.pick(NAME_B) + ' ' + S.pick(SUFFIX[c.lender_type]); } while (used.has(name.split(' ')[0]));
    used.add(name.split(' ')[0]);
    c.name = name;
    c.cancelled = null;
  });
  return list;
}

/* ---------------- onboarding and compliance ---------------- */
function onboard(c, events, reviews) {
  const O = stream('onboarding-' + c.id);
  const post = c.signup >= DOCS_DAY;
  let t = c.signup + O.between(7, 20) / 24;
  const push = (stage, at) => { if (at >= CUTOFF) return false; events.push([c.id, stage, STAGES.indexOf(stage) + 1, FT(at)]); c.stage = stage; c.stageAt = at; return true; };
  c.stuck = null;
  push('signed_up', t);
  if (!c.legacy && !O.chance(0.965)) { c.stuck = 'no_keys'; return; }
  t += O.logn(0.15, 0.8); if (!push('sandbox_keys_issued', t)) return;
  if (!c.legacy && !O.chance(post ? 0.92 : 0.74)) { c.stuck = 'no_sandbox_call'; return; }
  t += O.logn(post ? 2 : 5, 0.8); if (!push('first_sandbox_call', t)) return;
  c.sandboxStart = t;

  // Compliance (KYC and licence review). Info requests send the lender back to resubmit.
  if (!c.legacy && !O.chance(post ? 0.86 : 0.80)) { c.stuck = 'sandbox_only'; return; }
  let sub = t + O.logn(6, 0.6);
  if (sub >= CUTOFF) { c.stuck = 'sandbox_only'; return; }
  for (let round = 1; round <= 4; round++) {
    // From August 2026 the review queue backs up and decisions take about a month.
    const decided = sub + (sub >= BACKLOG_DAY ? O.logn(36, 0.3) : O.logn(11, 0.45));
    if (decided >= CUTOFF) { reviews.push([c.id, round, FT(sub), null, 'pending', null]); c.stuck = 'compliance_pending'; c.complianceSince = sub; return; }
    const pApprove = c.legacy ? 0.7 : round === 1 ? 0.42 : 0.66;
    const x = O.u();
    if (x < pApprove || (c.legacy && round === 3)) {
      reviews.push([c.id, round, FT(sub), FT(decided), 'approved', null]);
      t = decided; push('kyc_approved', t); break;
    }
    if (!c.legacy && x < pApprove + 0.05) { reviews.push([c.id, round, FT(sub), FT(decided), 'rejected', 'Lending licence could not be verified']); c.stuck = 'compliance_rejected'; return; }
    reviews.push([c.id, round, FT(sub), FT(decided), 'info_requested', O.weighted(INFO_REASONS)]);
    if (!c.legacy && (O.chance(0.17) || round === 4)) { c.stuck = 'compliance_abandoned'; c.complianceSince = decided; return; }
    sub = decided + O.logn(7, 0.6);
    if (sub >= CUTOFF) { c.stuck = 'compliance_awaiting_customer'; c.complianceSince = decided; return; }
  }
  if (c.stage !== 'kyc_approved') return;
  t += O.logn(1.5, 0.5); if (!push('production_keys_issued', t)) return;
  c.prodKeys = t;
  if (!c.legacy && !O.chance(post ? 0.93 : 0.72)) { c.stuck = 'integration_errors'; return; }
  t += O.logn(post ? 4 : 12, 0.7); if (!push('first_live_call', t)) return;
  c.live = t;
}

/* ---------------- usage ---------------- */
const RATIO = { bvn: 1.0, nin: 0.45, bureau: 0.62, statement: 0.30, mandate: 0.24, disbursement: 0.22 };
const ERR = { // total error rate and split [timeout, 4xx, 5xx, upstream]
  bvn: [0.009, [0.25, 0.25, 0.15, 0.35]], nin: [0.014, [0.2, 0.2, 0.15, 0.45]], bureau: [0.012, [0.3, 0.2, 0.2, 0.3]],
  statement: [0.02, [0.45, 0.3, 0.25, 0]], mandate: [0.015, [0.15, 0.55, 0.15, 0.15]], disbursement: [0.008, [0.25, 0.3, 0.2, 0.25]],
  collection: [0.011, [0.2, 0.4, 0.15, 0.25]], webhook: [0.025, [0.6, 0.1, 0.3, 0]],
};
const P95 = { bvn: 620, nin: 880, bureau: 1750, statement: 4300, mandate: 1150, disbursement: 2100, collection: 1400, webhook: 380 };
const REGION_LATENCY = { North: 1.35, 'South-East': 1.1 };
const EID = ['2025-03-30', '2025-06-06', '2026-03-20', '2026-05-27'].map(D);
const SEASON = [0, 0.88, 0.93, 1.0, 1.0, 0.98, 1.0, 0.97, 0.96, 1.08, 1.02, 1.10, 1.24];
const DOW = [0.55, 1.05, 1.0, 1.0, 1.0, 1.08, 0.75];
function season(d) { let s = SEASON[monthOf(d)] * DOW[dow(d)]; if (EID.some((e) => d >= e - 14 && d < e)) s *= 1.10; return s; }

function usageFor(c, rows, revenue) {
  const U = stream('usage-' + c.id);
  const sizeBase = { small: [60, 0.5], mid: [420, 0.45], large: [1500, 0.35] }[c.size_band];
  let apps0 = U.logn(sizeBase[0], sizeBase[1]) * (c.lender_type === 'cooperative' ? 0.6 : 1);
  const g = U.logn(1, 0.6) * 0.018; // monthly organic growth
  // Bigger lenders use more of the platform; small lenders mostly verify identity and pull bureau reports.
  const k = { small: 0.55, mid: 0.85, large: 1 }[c.size_band];
  const uses = { bvn: true, nin: U.chance(0.55 * k), bureau: U.chance(c.lender_type === 'cooperative' ? 0.6 : 0.9), mandate: U.chance(0.6 * k), disbursement: U.chance((c.lender_type === 'bnpl' ? 0.5 : 0.72) * k), collection: U.chance(0.66 * k) };
  uses.statement = uses.bureau && U.chance(0.55 * k);
  uses.webhook = uses.mandate || uses.disbursement || uses.collection;
  const statementFrom = STATEMENT_LAUNCH + Math.round(U.logn(55, 0.7));
  const north = c.region === 'North';
  const agg = c.integration_pattern === 'partner_aggregator';
  const add = (d, ep, env, calls, errs, p95) => {
    const failed = errs[0] + errs[1] + errs[2] + errs[3];
    rows.push([F(d), c.id, EP[ep], env, calls, calls - failed, errs[0], errs[1], errs[2], errs[3], p95]);
  };
  const errors = (ep, calls, d, extra4xx, outage) => {
    const [rate, split] = ERR[ep];
    const m = [split[0] * (agg ? 3.2 : 1) * (north ? 1.4 : 1), split[1] * extra4xx, split[2], split[3]];
    const out = m.map((s) => U.poisson(calls * rate * s * U.logn(1, 0.3)));
    if (outage) out[3] += U.poisson(calls * outage);
    const total = out.reduce((a, b) => a + b, 0);
    if (total > calls) { const k = calls / total; for (let i = 0; i < 4; i++) out[i] = Math.floor(out[i] * k); }
    return out;
  };
  const latency = (ep, outage) => Math.round(P95[ep] * (REGION_LATENCY[c.region] || 1) * (agg ? 1.2 : 1) * U.logn(1, 0.08) * (outage ? 1 + 2 * outage / 0.22 : 1));

  // Sandbox traffic: bursts of testing while integrating, fading over time.
  if (c.sandboxStart && !c.legacy) {
    const from = Math.max(START, Math.ceil(c.sandboxStart));
    const until = c.live ? Math.floor(c.live) : c.stuck === 'compliance_abandoned' ? Math.min(END, Math.floor(c.complianceSince) + 30) : END;
    for (let d = from; d <= until; d++) {
      const age = d - c.sandboxStart;
      if (!U.chance(0.55 * Math.exp(-age / 45) + 0.06) || dow(d) === 0) continue;
      for (const ep of ['bvn', 'bureau', 'mandate']) {
        if (ep === 'mandate' && !uses.mandate) continue;
        const calls = Math.max(1, Math.round(U.logn(ep === 'bvn' ? 24 : 12, 0.7)));
        const e4 = U.poisson(calls * 0.12), e5 = U.poisson(calls * 0.01);
        add(d, ep, 'sandbox', calls, [0, Math.min(calls, e4), Math.min(calls - Math.min(calls, e4), e5), 0], latency(ep, 0));
      }
    }
  }
  // Production keys but never a successful live call: failing attempts only.
  if (c.stuck === 'integration_errors' && c.prodKeys) {
    for (let d = Math.max(START, Math.ceil(c.prodKeys)); d <= END; d++) {
      if (!U.chance(Math.max(0.08, 0.5 * Math.exp(-(d - c.prodKeys) / 40)))) continue;
      const calls = U.int(2, 24);
      const e5 = U.chance(0.2) ? U.int(0, Math.floor(calls / 4)) : 0;
      add(d, 'bvn', 'live', calls, [0, calls - e5, e5, 0], latency('bvn', 0));
    }
  }
  if (!c.live) return;

  const liveDay = Math.floor(c.live);
  const stop = c.cancelled ? c.cancelled - 1 : END;
  let cumulative = 0;
  for (let d = Math.max(START, liveDay); d <= stop; d++) {
    const tenure = d - c.live;
    const ramp = c.legacy ? 1 : Math.min(1, 0.12 + (1 - Math.exp(-Math.max(0, tenure) / 28)));
    let mult = ramp * Math.pow(1 + g, (d - Math.max(START, liveDay)) / 30.4) * season(d) * U.logn(1, 0.12);
    if (c.decline) mult *= 1 - (1 - c.decline.floor) * Math.min(1, Math.max(0, d - c.decline.from) / 65);
    if (c.grow && d > c.grow.from) mult *= Math.pow(1.09, (d - c.grow.from) / 30.4);
    if (c.cancelled) mult *= Math.min(1, Math.max(0.15, (c.cancelled - d) / 35));
    const apps = apps0 * mult;
    const newInt = tenure < 30 ? 1 + 3 * (1 - tenure / 30) : 1;
    const outageDay = d - OUTAGE_START;
    const sums = { mandate: 0, disbursement: 0, collection: 0 };
    for (const ep of ['bvn', 'nin', 'bureau', 'statement', 'mandate', 'disbursement', 'collection', 'webhook']) {
      if (!uses[ep]) continue;
      if (ep === 'statement' && d < Math.max(statementFrom, liveDay)) continue;
      let expected;
      if (ep === 'collection') {
        expected = apps * (0.15 + 0.45 * Math.min(1, (c.legacy ? 365 : tenure) / 180));
        const dom = dayOfMonth(d); if (dom >= 25 && dom <= 28) expected *= 1.6; else if (dom <= 3) expected *= 1.3;
      } else if (ep === 'webhook') {
        expected = 1.1 * (sums.mandate + sums.disbursement + sums.collection);
      } else {
        expected = apps * RATIO[ep];
        if (ep === 'bureau' && d >= PRICING_DAY && c.plan === 'starter') expected *= 0.85;
      }
      const calls = U.poisson(expected);
      if (ep in sums) sums[ep] = calls;
      if (calls === 0) continue;
      const outage = ep === 'bureau' && outageDay >= 0 && outageDay < 7 ? OUTAGE_PEAK[outageDay] : 0;
      const errs = errors(ep, calls, d, newInt, outage);
      add(d, ep, 'live', calls, errs, latency(ep, outage));
      const ok = calls - errs.reduce((a, b) => a + b, 0);
      cumulative += ok;
      if (!c.reached && cumulative >= 1000 && d >= liveDay) c.reached = d + U.between(9, 18) / 24;
      const key = c.id + '|' + YM(d);
      revenue.set(key, (revenue.get(key) || 0) + ok * price(EP[ep], d));
    }
  }
}

/* ---------------- billing, ledger and reconciliation ---------------- */
function billing(customers, revenue) {
  const B = stream('billing');
  const invoices = [], ledger = [], cases = [];
  let seq = 0;
  const invNo = (ym) => 'INV-' + ym.replace('-', '') + '-' + String(++seq).padStart(5, '0');
  const plan = {};
  for (const c of customers) {
    if (!c.live) continue;
    for (const ym of MONTHS) {
      const mStart = firstOfMonth(ym), mEnd = firstOfMonth(nextMonth(ym)) - 1;
      if (c.live > mEnd + 1) continue;
      if (c.cancelled && c.cancelled <= mStart && !c.billedAfterCancel) continue;
      if (c.cancelled && c.cancelled <= mStart && c.billedAfterCancel && !c.billedAfterCancel.includes(ym)) continue;
      const usage = revenue.get(c.id + '|' + ym) || 0;
      const fee = FEE[c.plan];
      const amount = Math.round((fee + usage) * 100) / 100;
      if (amount <= 0) continue;
      const issued = mEnd + 1 + B.between(0.5, 1.5) / 24;
      const inv = { id: invoices.length + 1, number: invNo(ym), customer_id: c.id, month: ym, amount, issued };
      invoices.push(inv);
      plan[c.id + '|' + ym] = inv;
    }
  }
  const post = (inv, amount) => ledger.push([ledger.length + 1, inv.customer_id, inv.month, amount, FT(inv.issued + B.between(1, 4.5) / 24), inv.number]);
  const planted = {};
  // 1. Missing ledger entry.
  planted.missing = pickInvoice(customers, plan, (c) => c.plan === 'enterprise' && !c.cancelled, '2026-07');
  // 2. Duplicated invoice.
  planted.duplicate = pickInvoice(customers, plan, (c) => c.plan === 'growth' && !c.cancelled, '2026-03');
  // 3. Rounding: a bulk ledger upload truncated three months to whole thousands of naira.
  const roundCust = customers.find((c) => c.plan === 'enterprise' && c.live && c.live < D('2025-06-01') && !c.cancelled && c.id !== planted.missing.customer_id);
  const roundMonths = ['2025-12', '2026-01', '2026-02'];
  for (const inv of invoices) {
    if (inv === planted.missing) continue;
    if (inv.customer_id === roundCust.id && roundMonths.includes(inv.month)) post(inv, Math.floor(inv.amount / 1000) * 1000);
    else post(inv, inv.amount);
  }
  const dup = planted.duplicate;
  invoices.push({ id: invoices.length + 1, number: invNo(dup.month), customer_id: dup.customer_id, month: dup.month, amount: dup.amount, issued: dup.issued + 2 / 24 });

  const cancelCust = customers.find((c) => c.billedAfterCancel);
  const caseRow = (cid, ym, check, status, owner, note, opened) => cases.push([cases.length + 1, cid, ym, check, status, owner, note, FT(opened)]);
  caseRow(planted.missing.customer_id, '2026-07', 'invoice_without_ledger', 'open', 'Finance operations', 'Invoice issued but no ledger entry. Posting job failed on 1 Aug and was not retried.', D('2026-08-04') + 0.4);
  caseRow(dup.customer_id, '2026-03', 'duplicate_invoice', 'resolved', 'Billing engineering', 'Invoice run retried after a timeout and issued a second invoice. Duplicate voided and credit note sent.', D('2026-04-03') + 0.45);
  roundMonths.forEach((ym, i) => caseRow(roundCust.id, ym, 'amount_mismatch', 'investigating', 'Finance operations', 'Ledger amount is lower than the invoice by less than NGN 1,000. Bulk upload rounded amounts down to whole thousands.', D('2026-03-09') + 0.4 + i * 0.01));
  cancelCust.billedAfterCancel.forEach((ym) => caseRow(cancelCust.id, ym, 'billed_after_cancellation', 'open', 'Customer Success', 'Platform fee invoiced after the customer cancelled on ' + F(cancelCust.cancelled) + '. Subscription was not closed in billing.', D('2026-09-02') + 0.4));
  return { invoices, ledger, cases, planted: { missing: planted.missing.customer_id, duplicate: dup.customer_id, rounding: roundCust.id, afterCancel: cancelCust.id } };
}
function pickInvoice(customers, plan, filter, ym) {
  for (const c of customers) { if (filter(c) && plan[c.id + '|' + ym]) return plan[c.id + '|' + ym]; }
  throw new Error('No invoice to plant for ' + ym);
}

/* ---------------- support tickets ---------------- */
const SUBJECTS = {
  integration: ['Sandbox returns 401 with new keys', 'How do we test mandate creation in sandbox?', 'Webhook signature does not verify', 'Need sample payloads for disbursement', 'Which BVN numbers work in sandbox?', 'SDK version mismatch on Android'],
  api_errors: ['Timeouts on BVN verification', 'Intermittent 502 on disbursement', 'Bureau report returns empty sections', 'Statement analysis takes over 10 seconds', 'Duplicate webhook deliveries', 'Collections failing for some banks'],
  billing: ['Question about this month\'s invoice', 'Need invoice addressed to new entity', 'Request for usage breakdown by endpoint', 'Plan upgrade pricing'],
  compliance: ['Which licence documents do you need?', 'When will our compliance review finish?', 'Uploaded the data protection policy again', 'Directors ID resubmitted'],
  account: ['Add a new team member', 'Reset two-factor authentication', 'Rotate production API keys'],
  feature_request: ['Bulk BVN verification', 'Export usage to CSV', 'Support for NUBAN name enquiry', 'Webhook retry settings'],
};
function tickets(customers, endpointsUsedBy, planted) {
  const T = stream('tickets');
  const out = [];
  const add = (cid, at, cat, subject) => {
    if (at >= CUTOFF || at < START) return;
    const age = END + 1 - at;
    const status = age < 4 ? T.weighted({ open: 60, pending: 40 }) : age < 12 ? T.weighted({ open: 15, pending: 25, solved: 60 }) : T.chance(0.03) ? 'open' : 'solved';
    const resolved = status === 'solved' ? Math.min(END + 0.99, at + T.logn(1.8, 0.9)) : null;
    out.push([cid, FT(at), cat, subject || T.pick(SUBJECTS[cat]), status, resolved ? FT(resolved) : null]);
  };
  for (const c of customers) {
    if (c.sandboxStart && !c.legacy && T.chance(0.45)) add(c.id, c.sandboxStart + T.between(1, 20), 'integration');
    if (c.stuck === 'compliance_pending' && END - c.complianceSince > 18) add(c.id, c.complianceSince + T.between(14, 20), 'compliance', 'When will our compliance review finish?');
    if (c.stuck === 'integration_errors' && c.prodKeys) add(c.id, c.prodKeys + T.between(3, 12), 'integration', 'Live calls rejected with 401 after switching keys');
    if (!c.live) continue;
    const rate = { small: 0.3, mid: 0.55, large: 0.9 }[c.size_band] * (c.integration_pattern === 'partner_aggregator' ? 1.5 : 1);
    const from = Math.max(START, Math.floor(c.live)), to = c.cancelled ? c.cancelled - 1 : END;
    for (let m = from; m <= to; m += 30) {
      const n = T.poisson(rate);
      for (let k = 0; k < n; k++) add(c.id, m + T.between(0, 29.9), T.weighted({ integration: 22, api_errors: c.integration_pattern === 'partner_aggregator' ? 40 : 22, billing: 16, feature_request: 16, account: 12, compliance: 4 }));
    }
    if (endpointsUsedBy(c.id).has(EP.bureau) && c.live < OUTAGE_START && !c.cancelled && T.chance(c.size_band === 'large' ? 0.75 : 0.35)) add(c.id, OUTAGE_START + T.between(0.3, 3.5), 'api_errors', T.pick(['Credit bureau reports failing', 'Bureau endpoint returning provider unavailable', 'Loan decisions blocked, bureau errors']));
    if (c.decline) { const [cat, subject] = T.pick([['billing', 'Bureau pricing is now higher than alternatives'], ['api_errors', 'Timeouts are slowing our loan approvals'], ['billing', 'Can we get volume discounts?']]); add(c.id, c.decline.from - T.between(5, 20), cat, subject); }
  }
  add(planted.duplicate, D('2026-04-02') + 0.42, 'billing', 'We were invoiced twice for March');
  add(planted.afterCancel, D('2026-07-03') + 0.5, 'billing', 'Invoice received after cancellation');
  add(planted.afterCancel, D('2026-08-04') + 0.5, 'billing', 'Second invoice after we cancelled');
  out.sort((a, b) => (a[1] < b[1] ? -1 : 1));
  return out.map((r, i) => [i + 1].concat(r));
}

/* ---------------- main ---------------- */
function main() {
  const customers = buildCustomers();
  const events = [], reviews = [];
  for (const c of customers) onboard(c, events, reviews);

  // Churn, decline and growth stories (chosen after onboarding, so we know who is live).
  const S = stream('stories');
  const established = customers.filter((c) => c.live && c.live < D('2025-05-01'));
  const churned = [];
  const pool = established.slice();
  const take = (filter) => { const ok = pool.filter(filter); if (!ok.length) throw new Error('No customer for story'); const c = ok[Math.floor(S.u() * ok.length)]; pool.splice(pool.indexOf(c), 1); return c; };
  // A churned customer who keeps being billed after cancelling.
  const afterCancel = take((c) => c.plan === 'growth' && c.size_band !== 'large');
  afterCancel.cancelled = D('2026-05-20'); afterCancel.billedAfterCancel = ['2026-06', '2026-07']; churned.push(afterCancel);
  for (const cancel of ['2025-05-14', '2025-10-03', '2026-01-22', '2026-09-08']) { const c = take((x) => x.size_band !== 'large'); c.cancelled = D(cancel); churned.push(c); }
  // Twelve live customers whose usage falls 45 to 70% over the last three months.
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(S.u() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const mid = customers.filter((c) => c.live && c.live < D('2026-02-01') && !c.cancelled);
  const decliners = [];
  for (const c of shuffled.concat(mid)) {
    if (decliners.length >= 12) break;
    if (c.cancelled || decliners.includes(c) || (c.size_band === 'large' && decliners.filter((x) => x.size_band === 'large').length >= 2)) continue;
    c.decline = { from: S.int(D('2026-07-01'), D('2026-07-28')), floor: S.between(0.26, 0.48) };
    decliners.push(c);
  }
  const growers = [];
  for (const c of mid.slice().reverse()) { if (growers.length >= 6) break; if (!c.decline && c.size_band !== 'small') { c.grow = { from: D('2026-05-01') }; growers.push(c); } }

  // Usage.
  const usage = [], revenue = new Map();
  for (const c of customers) usageFor(c, usage, revenue);
  const usedBy = new Map();
  for (const r of usage) { if (r[3] !== 'live') continue; if (!usedBy.has(r[1])) usedBy.set(r[1], new Set()); usedBy.get(r[1]).add(r[2]); }
  const endpointsUsedBy = (id) => usedBy.get(id) || new Set();
  for (const c of customers) if (c.reached) events.push([c.id, 'reached_1000_live_calls', 7, FT(c.reached)]);
  // Legacy customers reached 1,000 calls before the window.
  for (const c of customers) if (c.legacy && !c.reached && c.live) events.push([c.id, 'reached_1000_live_calls', 7, FT(c.live + 6 + stream('r' + c.id).between(0, 10))]);

  const bill = billing(customers, revenue);
  const tix = tickets(customers, endpointsUsedBy, bill.planted);

  /* ---------- SQL ---------- */
  const q = (v) => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
  const out = [];
  const insert = (table, cols, rows, chunk = 400) => {
    for (let i = 0; i < rows.length; i += chunk) out.push('INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES\n' + rows.slice(i, i + chunk).map((r) => '(' + r.map(q).join(',') + ')').join(',\n') + ';');
  };
  out.push(fs.readFileSync(path.join(OUT_DIR, 'schema.sql'), 'utf8'));
  out.push('BEGIN;');
  insert('meta', ['key', 'value'], [
    ['as_of', F(END)], ['refreshed_at', '2026-11-01 06:00'], ['currency', 'NGN'], ['seed', String(SEED)],
    ['history_from', F(START)], ['note', 'Sample data for a portfolio prototype. Lendwell and all customers are fictional.'],
  ]);
  insert('plans', ['plan', 'name', 'monthly_fee_ngn'], PLANS);
  insert('endpoints', ['id', 'code', 'name', 'category', 'launched_on', 'billable'], ENDPOINTS);
  insert('endpoint_prices', ['endpoint_id', 'price_ngn', 'valid_from', 'valid_to'], PRICES);
  insert('customers', ['id', 'name', 'lender_type', 'size_band', 'region', 'plan', 'integration_pattern', 'signup_date', 'cancelled_date', 'account_manager'],
    customers.map((c) => [c.id, c.name, c.lender_type, c.size_band, c.region, c.plan, c.integration_pattern, F(c.signup), c.cancelled ? F(c.cancelled) : null, c.account_manager]));
  events.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  insert('onboarding_events', ['customer_id', 'stage', 'stage_order', 'occurred_at'], events);
  insert('compliance_reviews', ['customer_id', 'round', 'submitted_at', 'decided_at', 'outcome', 'reason'], reviews);
  usage.sort((a, b) => a[1] - b[1] || a[2] - b[2] || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  insert('api_usage_daily', ['day', 'customer_id', 'endpoint_id', 'env', 'calls', 'successful', 'err_timeout', 'err_4xx', 'err_5xx', 'err_upstream', 'p95_ms'], usage, 800);
  insert('invoices', ['id', 'invoice_number', 'customer_id', 'month', 'amount_ngn', 'issued_at'], bill.invoices.map((i) => [i.id, i.number, i.customer_id, i.month, i.amount, FT(i.issued)]));
  insert('ledger', ['id', 'customer_id', 'month', 'amount_ngn', 'posted_at', 'reference'], bill.ledger);
  insert('recon_cases', ['id', 'customer_id', 'month', 'check_name', 'status', 'owner', 'note', 'opened_at'], bill.cases);
  insert('support_tickets', ['id', 'customer_id', 'opened_at', 'category', 'subject', 'status', 'resolved_at'], tix);
  insert('events', ['day', 'kind', 'title', 'detail'], EVENTS);
  out.push('COMMIT;');
  out.push('ANALYZE;');
  out.push('VACUUM;');
  const sql = out.join('\n\n');

  const dbPath = path.join(OUT_DIR, 'signal.sqlite');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const res = spawnSync('sqlite3', ['-bail', dbPath], { input: sql, maxBuffer: 1 << 30 });
  if (res.status !== 0) { console.error(String(res.stderr)); process.exit(1); }
  const db = fs.readFileSync(dbPath);
  const gz = zlib.gzipSync(db, { level: 9 });
  fs.writeFileSync(path.join(OUT_DIR, 'signal.sqlite.gz'), gz);
  if (KEEP) fs.writeFileSync(path.join(OUT_DIR, 'signal.sql'), sql); else fs.unlinkSync(dbPath);

  const live = customers.filter((c) => c.live).length;
  console.log('customers', customers.length, '| live', live, '| usage rows', usage.length, '| onboarding events', events.length, '| reviews', reviews.length);
  console.log('invoices', bill.invoices.length, '| ledger', bill.ledger.length, '| tickets', tix.length, '| recon cases', bill.cases.length);
  console.log('decliners', decliners.map((c) => c.id).join(','), '| growers', growers.map((c) => c.id).join(','), '| churned', churned.map((c) => c.id).join(','));
  console.log('planted billing', JSON.stringify(bill.planted));
  console.log('sqlite', (db.length / 1048576).toFixed(2), 'MB | gzip', (gz.length / 1048576).toFixed(2), 'MB');
}
main();
