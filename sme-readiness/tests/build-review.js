#!/usr/bin/env node
// Builds data/CONTENT-REVIEW.md, a readable view of every question, recommendation,
// message and training module, straight from the JSON, for review before the UI is built.
'use strict';
const fs = require('fs'), path = require('path');
const d = path.join(__dirname, '..', 'data');
const L = (f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
const S = L('sources.json'), Q = L('questions.json'), R = L('recommendations.json'), M = L('messages.json'), T = L('training.json'), B = L('benchmarks.json');
const src = Object.fromEntries(S.sources.map((s) => [s.id, s]));
const cite = (ids) => ids.map((id) => '[' + src[id].publisher + ': ' + src[id].title + '](' + src[id].url + ')').join('; ');
const rec = Object.fromEntries(R.recommendations.map((r) => [r.id, r]));
const out = ['# Kinhold content review', '', 'Generated from the JSON in this folder by `tests/build-review.js`. Every source was checked on ' + S.lastChecked + '. Edit the JSON, not this file.', ''];
out.push('## Start-of-check profile', '');
Q.profile.forEach((p) => out.push('- **' + p.text + '** ' + p.options.map((o) => o.label).join(' / ')));
out.push('', 'Answers: Yes (1), Partly (0.5), No (0), Not sure (0, shown gently as something to check). Critical questions: ' + Q.questions.filter((q) => q.critical).map((q) => q.id).join(', ') + '.', '');
Q.areas.forEach((a, ai) => {
  out.push('## ' + (ai + 1) + '. ' + a.title + (a.group === 'ai' ? ' (AI use)' : ''), '', '_' + a.short + '_', '');
  Q.questions.filter((q) => q.area === a.id).forEach((q) => {
    const r = rec[q.recommendation];
    const cond = [q.onlyFor ? 'Only if ' + Object.entries(q.onlyFor).map(([k, v]) => k + ' is ' + v.join(' or ')).join(', ') : '', q.notFor ? 'Not asked if ' + Object.entries(q.notFor).map(([k, v]) => k + ' is ' + v.join(' or ')).join(', ') : ''].filter(Boolean).join('. ');
    out.push('### ' + q.id + '. ' + q.text, '',
      '- **Explained:** ' + q.help, '- **Why it matters:** ' + q.why, '- **Example:** ' + q.example,
      '- **Weight:** ' + q.weight + (q.critical ? ' (critical: caps the overall level)' : '') + (cond ? '. ' + cond + '.' : ''),
      '- **Sources:** ' + cite(q.sources), '',
      '**If it\'s a gap: ' + r.title + '** (' + r.minutes + ' minutes, ' + r.cost.toLowerCase() + ', owner: ' + r.owner + (r.quickWin ? ', quick win' : '') + ')', '', r.summary, '',
      r.steps.map((s, i) => (i + 1) + '. ' + s).join('\n'), '', 'Sources: ' + cite(r.sources), '');
  });
});
out.push('## What a business like yours usually has', '', B.edition + '. ' + B.note, '');
B.context.concat(B.controls).forEach((b) => out.push('- **' + b.value + b.unit + '** ' + b.text));
out.push('', '## Message checker', '', '### Warning signs', '');
M.signals.forEach((s) => out.push('- **' + s.label + ':** ' + s.explain + ' _What to do:_ ' + s.action + ' (' + cite(s.sources) + ')'));
out.push('', 'When nothing is found: "' + M.noSignsText + '"', '', '### Example messages', '');
M.examples.forEach((e) => out.push('#### ' + e.title + ' (' + e.difficulty + ', ' + e.channel + ')', '', '**From:** ' + e.from + (e.subject ? '  \n**Subject:** ' + e.subject : ''), '', '> ' + e.body.split('\n').join('\n> '), '',
  '**Expected:** ' + (e.expected.length ? e.expected.map((x) => M.signals.find((s) => s.id === x).label).join(', ') : 'no warning signs') + '. **Level:** ' + M.levels[e.expectedLevel].label + '.', '', '_Lesson:_ ' + e.lesson, ''));
out.push('## Staff training', '');
T.modules.forEach((m) => {
  out.push('### ' + m.title + ' (' + m.minutes + ' minutes)', '', m.intro, '', '**Activity:** ' + m.activity.prompt, '');
  if (m.activity.type === 'hotspots') Object.values(m.activity.item.hotspots).forEach((h) => out.push('- ' + h));
  if (m.activity.type === 'sort') m.activity.items.forEach((it) => out.push('- ' + (it.bin === 'fine' ? 'Fine' : 'Never') + ': "' + it.text + '" ' + it.why));
  if (m.activity.type === 'scenario') m.activity.steps.forEach((st, i) => out.push((i + 1) + '. ' + st.situation + ' Best choice: ' + st.choices.find((c) => c.good).text + '.'));
  out.push('', '**Quiz**', '');
  m.quiz.forEach((q, i) => out.push((i + 1) + '. ' + q.q + ' **Answer:** ' + q.options[q.answer] + '. ' + q.explain));
  out.push('');
});
out.push('## All sources', '');
S.sources.forEach((s) => out.push('- **' + s.publisher + ': [' + s.title + '](' + s.url + ')** (checked ' + s.checked + ')' + (s.use === 'method-only' ? ', Method page only' : '') + (s.note ? '. ' + s.note : '')));
fs.writeFileSync(path.join(d, 'CONTENT-REVIEW.md'), out.join('\n') + '\n');
console.log('Wrote data/CONTENT-REVIEW.md (' + out.length + ' lines)');
