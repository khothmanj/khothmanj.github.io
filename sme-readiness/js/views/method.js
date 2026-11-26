/*
 * How it works (#method): the scoring, the essentials cap, how actions are ranked and planned, the
 * message checker rules, the survey comparison, a framework mapping and every source with the date
 * it was last checked. All numbers here are read from the engines and content, not typed in.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;

  // Kinhold's own mapping of its areas to NIST CSF 2.0 functions (cyber) and AI RMF functions (AI).
  const MAP = {
    passwords: 'Protect', access: 'Protect', devices: 'Protect', backups: 'Protect, Recover', email: 'Protect, Detect',
    payments: 'Protect, Detect', data: 'Govern, Identify', suppliers: 'Govern (supply chain)', incident: 'Respond, Recover',
    'ai-tools': 'Map', 'ai-data': 'Manage', 'ai-review': 'Measure, Manage', 'ai-policy': 'Govern', 'ai-scams': 'Detect (CSF)',
  };

  function render(el) {
    const { esc, data } = A;
    const S = root.KinholdScoring, R = root.KinholdRecommend, C = root.KinholdChecker;
    const Q = data.questions, M = data.messages;
    const weights = [1, 2, 3].map((w) => Q.questions.filter((q) => q.weight === w).length);
    const critical = Q.questions.filter((q) => q.critical);
    const boost = 1.5;

    // Worked example from the first sample business, computed live.
    const c = data.sample_clients.clients[0];
    const last = c.checks[c.checks.length - 1].answers;
    const ranked = R.rank(Q, data.recommendations, c.profile, last);
    const ex = ranked.slice(0, 3);
    const qText = (id) => Q.questions.find((q) => q.id === id);
    const ans = { yes: 'Yes', partly: 'Partly', no: 'No', unsure: 'Not sure' };

    const signalRules = (id) => [...new Set(C.RULES.filter((r) => r.signal === id).map((r) => r.reason))];
    const sources = data.sources.sources.slice().sort((a, b) => a.publisher.localeCompare(b.publisher) || a.title.localeCompare(b.title));

    el.innerHTML =
      '<header class="page-head"><h1>How Kinhold works</h1><p>There\'s no AI model behind Kinhold and nothing you enter leaves your device. Every score, ranking and warning comes from simple rules written from UK guidance, and they\'re all on this page so you can check them.</p></header>' +
      '<nav class="method-toc glass" aria-label="On this page"><a href="#method" data-to="m-score">Scoring</a><a href="#method" data-to="m-rank">Ranking</a><a href="#method" data-to="m-plan">The plan</a><a href="#method" data-to="m-check">Message checker</a><a href="#method" data-to="m-bench">Comparisons</a><a href="#method" data-to="m-map">Frameworks</a><a href="#method" data-to="m-src">Sources</a><a href="#method" data-to="m-limits">Limits</a></nav>' +

      sec('m-score', 'How the score works',
        '<p>The check asks up to ' + Q.questions.length + ' questions across ' + Q.areas.length + ' areas, nine on cyber and fraud and five on AI. Some only appear when they apply, for example the chatbot questions only show if you have one.</p>' +
        '<div class="m-grid">' +
          '<div><h3>Each answer counts for</h3><table class="m-table"><tbody>' + Object.entries(S.VALUES).map(([k, v]) => '<tr><th scope="row">' + ans[k] + '</th><td>' + v + '</td></tr>').join('') + '</tbody></table>' +
            '<p class="muted small">"Not sure" counts as a gap, because you can\'t rely on something you can\'t confirm. The results explain this kindly and give steps to find out.</p></div>' +
          '<div><h3>Each question has a weight</h3><table class="m-table"><tbody><tr><th scope="row">3, high impact</th><td>' + weights[2] + ' questions</td></tr><tr><th scope="row">2, medium</th><td>' + weights[1] + ' questions</td></tr><tr><th scope="row">1, good practice</th><td>' + weights[0] + ' questions</td></tr></tbody></table>' +
            '<p class="muted small">Weights are Kinhold\'s judgement of impact, guided by what the sources say leads to real losses, such as email takeover and payment fraud.</p></div>' +
        '</div>' +
        '<p>An area\'s score is the weighted average of its answers, out of 100. The overall score is the weighted average of every answer.</p>' +
        '<h3>Levels, not a pass mark</h3><ol class="m-levels">' + S.LEVELS.map((l, i) => '<li>' + A.levelStatus(i, l.label) + '<span class="muted">' + (i < S.LEVELS.length - 1 ? l.min + ' to ' + (S.LEVELS[i + 1].min - 1) : l.min + ' and above') + '</span><span>' + esc(l.blurb) + '</span></li>').join('') + '</ol>' +
        '<h3>Two essentials hold the level</h3><p>If either of these isn\'t fully in place, the overall level can\'t go above <b>' + S.LEVELS[S.CRITICAL_CAP].label + '</b>, however good the rest is. Both are free and take minutes, and both stop the most common ways small businesses lose money.</p>' +
        '<ul class="m-list">' + critical.map((q) => '<li>' + esc(q.text) + ' <span class="src">' + A.sourceLinks(q.sources) + '</span></li>').join('') + '</ul>') +

      sec('m-rank', 'How actions are ranked',
        '<p>Every answer that isn\'t "Yes" becomes an action. Actions are ranked by how much risk they remove for the effort they take.</p>' +
        '<div class="m-formula"><p><b>Risk</b> = weight × gap' + ' × ' + boost + ' if it\'s an essential</p><p><b>Priority</b> = risk ÷ effort</p></div>' +
        '<p class="muted small">Gap is 1 for "No" or "Not sure" and 0.5 for "Partly". Effort is 1 (minutes), 2 (an hour or two) or 3 (a project). Ties go to free actions, then the quickest.</p>' +
        '<h3>Worked example: ' + esc(c.name) + ', a sample business</h3>' +
        '<div class="table-wrap"><table class="m-table wide rank"><thead><tr><th scope="col">Rank</th><th scope="col">Action</th><th scope="col">Answer</th><th scope="col">Weight</th><th scope="col">Risk</th><th scope="col">Effort</th><th scope="col">Priority</th></tr></thead><tbody>' +
        ex.map((a) => '<tr><td>' + a.rank + '</td><th scope="row">' + esc(a.rec.title) + '</th><td>' + ans[a.answer] + '</td><td>' + qText(a.question).weight + '</td><td>' + a.risk + '</td><td>' + a.rec.effort + '</td><td><b>' + a.priority + '</b></td></tr>').join('') +
        '</tbody></table></div>') +

      sec('m-plan', 'How the 90-day plan is built',
        '<p>Actions go into phases in rank order, so no phase asks too much of a small team:</p>' +
        '<ul class="m-list"><li><b>First 30 days:</b> every missing essential, plus up to 6 quick, free actions.</li><li><b>Days 31 to 60:</b> up to 10 more that take a few hours at most.</li><li><b>Days 61 to 90:</b> up to 12 more, including bigger projects.</li><li><b>After 90 days:</b> anything left.</li></ul>' +
        '<p>Each step keeps an owner (the owner, an office manager, or all staff), the time it takes and what it costs. Re-running the check compares the new answers with the last ones and shows what improved.</p>') +

      sec('m-check', 'How the message checker works',
        '<p>The checker reads the message for ' + M.signals.length + ' kinds of warning sign using plain word and pattern rules. Each match is highlighted in the message with the reason it was flagged.</p>' +
        '<div class="m-signals">' + M.signals.map((s) => '<div><h3>' + esc(s.label) + '</h3><ul>' + (signalRules(s.id).length ? signalRules(s.id) : s.id === 'lookalike_domain' ? ['A sender address one or two characters away from one you normally use, or with letters swapped for numbers (1 for l, 0 for o, rn for m).'] : ['A personal email address used by someone claiming to be a supplier or colleague.']).map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul></div>').join('') + '</div>' +
        '<h3>Levels</h3><ul class="m-list">' +
          '<li>' + A.status('High concern', 'bad', 'alert') + ' asks for codes or passwords, a voice note posing as someone, or a lookalike sender; or a bank change or unusual payment with any other sign; or three or more signs.</li>' +
          '<li>' + A.status('Medium concern', 'warn', 'alert') + ' a bank change, unusual payment or impersonation on its own, or any two signs.</li>' +
          '<li>' + A.status('Low concern', '', 'question') + ' pressure or urgency on its own.</li>' +
        '</ul>' +
        '<p>It never says a message is safe. If nothing is found it says: "' + esc(M.noSignsText) + '"</p>') +

      sec('m-bench', 'Where the comparisons come from',
        '<p>"What a business like yours usually has" uses the UK Government\'s Cyber Security Breaches Survey 2025/2026, published 30 April 2026. Micro businesses are compared with micro-business figures where the survey reports them, otherwise with all businesses. Where no figure exists, Kinhold doesn\'t make one up.</p>' +
        '<p class="src">Source: ' + A.sourceLinks(['dsit-csbs']) + '</p>') +

      sec('m-map', 'How it lines up with recognised frameworks',
        '<p>Kinhold is written for small businesses in plain English, but its areas cover the same ground as two widely used frameworks. This is Kinhold\'s own mapping, as background. Using Kinhold doesn\'t mean you meet either framework.</p>' +
        '<div class="table-wrap"><table class="m-table wide"><thead><tr><th scope="col">Kinhold area</th><th scope="col">Framework function</th></tr></thead><tbody>' +
        Q.areas.map((a) => '<tr><th scope="row">' + esc(a.title) + '</th><td>' + (a.group === 'ai' && a.id !== 'ai-scams' ? 'AI RMF: ' : 'CSF 2.0: ') + esc(MAP[a.id] || '') + '</td></tr>').join('') +
        '</tbody></table></div><p class="src">Frameworks: ' + A.sourceLinks(['nist-csf', 'nist-ai-rmf']) + '</p>') +

      sec('m-src', 'Every source',
        '<p>Each source was opened and checked to make sure it says what Kinhold uses it for. The date shows when.</p>' +
        '<div class="table-wrap"><table class="m-table wide src-table"><thead><tr><th scope="col">Source</th><th scope="col">Used for</th><th scope="col">Checked</th></tr></thead><tbody>' +
        sources.map((s) => '<tr><th scope="row"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a><span class="muted">' + esc(s.publisher) + '</span></th><td>' + esc(s.claims[0]) + (s.claims.length > 1 ? ' <span class="muted">and ' + (s.claims.length - 1) + ' more</span>' : '') + '</td><td>' + A.formatDate(s.checked) + '</td></tr>').join('') +
        '</tbody></table></div>') +

      sec('m-limits', 'What Kinhold isn\'t',
        '<ul class="m-list"><li>It isn\'t an audit or a certification. It can\'t tell you that you\'re compliant with UK GDPR or that you\'d pass Cyber Essentials, though it points you to both.</li>' +
        '<li>Answers are self-reported. The results are only as accurate as the answers.</li>' +
        '<li>The message checker uses visible rules, so a well-made scam can get past it. The phone call back is the real protection.</li>' +
        '<li>Guidance changes. Sources were last checked on the dates shown above.</li></ul>');

    el.querySelectorAll('[data-to]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = el.querySelector('#' + a.dataset.to);
      t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      t.focus({ preventScroll: true });
    }));
  }

  const sec = (id, title, body) => '<section class="glass card m-sec" id="' + id + '" tabindex="-1" aria-labelledby="' + id + '-h"><h2 id="' + id + '-h">' + title + '</h2>' + body + '</section>';

  A.register('method', { render });
})(window);
