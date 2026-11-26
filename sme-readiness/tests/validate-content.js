#!/usr/bin/env node
/*
 * Checks the Kinhold content library before any UI uses it.
 * Usage: node sme-readiness/tests/validate-content.js [--links]
 *   --links  also opens every source URL and reports its HTTP status
 */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const errors = [], notes = [];
const fail = (m) => errors.push(m);

const S = load('sources.json'), Q = load('questions.json'), R = load('recommendations.json');
const M = load('messages.json'), T = load('training.json'), B = load('benchmarks.json');
const sourceIds = new Set(S.sources.map((s) => s.id));
const methodOnly = new Set(S.sources.filter((s) => s.use === 'method-only').map((s) => s.id));
const checkSources = (where, list) => {
  if (!list || !list.length) return fail(where + ': no sources');
  list.forEach((id) => { if (!sourceIds.has(id)) fail(where + ': unknown source ' + id); if (methodOnly.has(id)) fail(where + ': uses method-only source ' + id); });
};

/* sources */
S.sources.forEach((s) => {
  if (!/^https:\/\//.test(s.url)) fail('source ' + s.id + ': url must be https');
  if (!s.checked) fail('source ' + s.id + ': no checked date');
  if (!s.claims || !s.claims.length) fail('source ' + s.id + ': no claims');
});

/* questions */
const areaIds = new Set(Q.areas.map((a) => a.id));
const profile = Object.fromEntries(Q.profile.map((p) => [p.id, new Set(p.options.map((o) => o.value))]));
const recIds = new Set(R.recommendations.map((r) => r.id));
const qIds = new Set();
Q.questions.forEach((q) => {
  if (qIds.has(q.id)) fail('duplicate question ' + q.id);
  qIds.add(q.id);
  if (!areaIds.has(q.area)) fail(q.id + ': unknown area ' + q.area);
  ['text', 'help', 'why', 'example'].forEach((k) => { if (!q[k]) fail(q.id + ': missing ' + k); });
  if (![1, 2, 3].includes(q.weight)) fail(q.id + ': weight must be 1 to 3');
  if (!recIds.has(q.recommendation)) fail(q.id + ': unknown recommendation ' + q.recommendation);
  checkSources('question ' + q.id, q.sources);
  ['onlyFor', 'notFor'].forEach((k) => Object.entries(q[k] || {}).forEach(([pid, vals]) => {
    if (!profile[pid]) fail(q.id + ': ' + k + ' uses unknown profile question ' + pid);
    else vals.forEach((v) => { if (!profile[pid].has(v)) fail(q.id + ': ' + k + ' ' + pid + ' has unknown value ' + v); });
  }));
});
Q.areas.forEach((a) => { const n = Q.questions.filter((q) => q.area === a.id).length; if (n < 2) fail('area ' + a.id + ' has only ' + n + ' question(s)'); });
const critical = Q.questions.filter((q) => q.critical).map((q) => q.id);
if (critical.length < 1) fail('no critical questions');

/* recommendations */
R.recommendations.forEach((r) => {
  if (!qIds.has(r.question)) fail(r.id + ': unknown question ' + r.question);
  ['title', 'summary', 'cost', 'owner'].forEach((k) => { if (!r[k]) fail(r.id + ': missing ' + k); });
  if (!R.owners.includes(r.owner)) fail(r.id + ': owner must be one of ' + R.owners.join(', '));
  if (!(r.minutes > 0)) fail(r.id + ': minutes');
  if (![1, 2, 3].includes(r.effort)) fail(r.id + ': effort');
  if (!r.steps || r.steps.length < 2) fail(r.id + ': needs at least 2 steps');
  checkSources('recommendation ' + r.id, r.sources);
  const sentences = r.summary.split(/(?<=\.)\s+/).length;
  if (sentences < 2 || sentences > 3) notes.push(r.id + ': summary has ' + sentences + ' sentences (aim for 2 or 3)');
});
Q.questions.forEach((q) => { const r = R.recommendations.find((x) => x.id === q.recommendation); if (r && r.question !== q.id) fail(q.id + ' and ' + r.id + ' point at each other inconsistently'); });

/* messages */
const signalIds = new Set(M.signals.map((s) => s.id));
M.signals.forEach((s) => checkSources('signal ' + s.id, s.sources));
M.examples.forEach((e) => {
  e.expected.forEach((sig) => { if (!signalIds.has(sig)) fail('message ' + e.id + ': unknown signal ' + sig); });
  if (!M.levels[e.expectedLevel]) fail('message ' + e.id + ': unknown level ' + e.expectedLevel);
  if (e.expectedLevel === 'none' && e.expected.length) fail('message ' + e.id + ': level none but has signals');
});
if (M.examples.length < 6 || M.examples.length > 8) fail('need 6 to 8 example messages, found ' + M.examples.length);
const covered = new Set(M.examples.flatMap((e) => e.expected));
signalIds.forEach((s) => { if (!covered.has(s)) fail('signal ' + s + ' is not triggered by any example'); });

/* training */
T.modules.forEach((m) => {
  if (!m.quiz || m.quiz.length < 3) fail('module ' + m.id + ': needs 3 quiz questions');
  m.quiz.forEach((q, i) => {
    if (!(q.answer >= 0 && q.answer < q.options.length)) fail('module ' + m.id + ' quiz ' + (i + 1) + ': answer out of range');
    checkSources('module ' + m.id + ' quiz ' + (i + 1), q.sources);
  });
  const a = m.activity;
  if (a.type === 'hotspots') a.item.lines.filter((l) => l.hotspot).forEach((l) => { if (!a.item.hotspots[l.hotspot]) fail(m.id + ': hotspot ' + l.hotspot + ' has no explanation'); });
  if (a.type === 'sort') a.items.forEach((it) => { if (!a.bins.some((b) => b.id === it.bin)) fail(m.id + ': unknown bin ' + it.bin); });
  if (a.type === 'scenario') a.steps.forEach((st, i) => { if (st.choices.filter((c) => c.good).length !== 1) fail(m.id + ' step ' + (i + 1) + ': needs exactly one good choice'); });
});

/* benchmarks */
B.controls.forEach((b) => (b.questions || []).forEach((q) => { if (!qIds.has(q)) fail('benchmark ' + b.id + ': unknown question ' + q); }));

/* wording rules across all user-facing text */
const text = [];
const walk = (v, where) => {
  if (typeof v === 'string') text.push([where, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']'));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (!['url', 'evidence', 'id'].includes(k)) walk(x, where + '.' + k); });
};
[['questions', Q], ['recommendations', R], ['messages', M], ['training', T]].forEach(([n, d]) => walk(d, n));
const banned = [
  [/—/, 'em dash'],
  [/\bcompliant\b/i, '"compliant"'],
  [/\bcertified\b/i, '"certified"'],
  [/\b(is|are|looks|it's) safe\b/i, 'calls something safe'],
  [/\bguarantee/i, '"guarantee"'],
  [/\bAction Fraud\b/, 'Action Fraud (now Report Fraud)'],
  [/\b(color|organization|behavior|center)\b/i, 'US spelling'],
];
// Allowed on purpose: explaining that Report Fraud replaced Action Fraud, and saying the checker never says 'safe'.
const allowed = (s, label) => (label.startsWith('Action Fraud') && /replaced Action Fraud/.test(s)) || (label === 'calls something safe' && /never says/i.test(s));
text.forEach(([where, s]) => banned.forEach(([re, label]) => { if (re.test(s) && !allowed(s, label)) fail(where + ': ' + label + ' in "' + s.slice(0, 80) + '"'); }));

/* summary */
const counts = { sources: S.sources.length, areas: Q.areas.length, questions: Q.questions.length, critical: critical.join(', '), recommendations: R.recommendations.length,
  quickWins: R.recommendations.filter((r) => r.quickWin).length, signals: M.signals.length, examples: M.examples.length, modules: T.modules.length, benchmarks: B.controls.length + B.context.length };
console.log(Object.entries(counts).map(([k, v]) => k + ': ' + v).join(' | '));
notes.forEach((n) => console.log('note  ' + n));
errors.forEach((e) => console.log('FAIL  ' + e));

async function links() {
  for (const s of S.sources) {
    for (const u of [s.url, s.evidence].filter(Boolean)) {
      let status;
      try { const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; content check)' } }); status = r.status; }
      catch (e) { status = 'error ' + e.message; }
      const blocked = status === 403;
      console.log((status === 200 ? 'ok   ' : blocked ? 'block' : 'FAIL ') + ' ' + status + '  ' + s.id + '  ' + u);
      if (status !== 200 && !blocked) errors.push('link ' + u + ' returned ' + status);
    }
  }
}
(process.argv.includes('--links') ? links() : Promise.resolve()).then(() => {
  console.log(errors.length ? errors.length + ' problem(s)' : 'Content is valid.');
  process.exit(errors.length ? 1 : 0);
});
