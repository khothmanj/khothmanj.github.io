/*
 * Results (#results): the level first, what's already good, the area breakdown, the top five
 * actions with "Mark as done", quick wins, and a fair comparison with similar businesses.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;

  // Shared action card, also used by the plan.
  function actionCard(a, done, opts = {}) {
    const { esc } = A, r = a.rec;
    const why = a.answer === 'unsure' ? 'You weren\'t sure' : a.answer === 'partly' ? 'Partly in place' : 'Not in place yet';
    return '<article class="action glass' + (done ? ' is-done' : '') + '" data-rec="' + r.id + '">' +
      '<div class="action-top">' + (opts.rank ? '<span class="rank" aria-hidden="true">' + opts.rank + '</span>' : '') +
        '<div class="action-title"><h3>' + esc(r.title) + '</h3>' +
        '<p class="meta"><span>' + clockSvg() + r.minutes + ' min</span><span>' + esc(r.cost) + '</span><span>Owner: ' + esc(r.owner) + '</span>' +
          (a.critical ? A.status('Essential', 'clay', 'star') : '') + '<span class="muted">' + why + '</span></p></div>' +
        doneToggle(r.id, done) + '</div>' +
      '<p class="action-summary">' + esc(r.summary) + '</p>' +
      '<details class="steps"><summary>How to do it</summary><ol>' + r.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
        (r.toolkit ? '<p><a href="#toolkit?t=' + r.toolkit + '">Use the template in the toolkit</a></p>' : '') + '</details>' +
      '<p class="src">Guidance: ' + A.sourceLinks(r.sources) + '</p>' +
    '</article>';
  }
  const clockSvg = () => '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/></svg>';
  function doneToggle(id, done) {
    return '<label class="done-toggle"><input type="checkbox" data-done="' + id + '"' + (done ? ' checked' : '') + '>' +
      '<span class="done-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" class="done-ring"/><path d="M7.5 12.4l3 3 6-6.4" class="done-tick"/></svg><span class="done-label">' + (done ? 'Done' : 'Mark as done') + '</span></span></label>';
  }
  // Wire up every "Mark as done" checkbox inside el. onChange(id, checked) is optional.
  function bindDone(el, onChange) {
    el.querySelectorAll('[data-done]').forEach((cb) => cb.addEventListener('change', () => {
      const s = A.store.get();
      const done = new Set(s.done || []);
      cb.checked ? done.add(cb.dataset.done) : done.delete(cb.dataset.done);
      A.store.save({ done: [...done] });
      el.querySelectorAll('[data-done="' + cb.dataset.done + '"]').forEach((x) => {
        x.checked = cb.checked;
        const card = x.closest('.action, .win'); if (card) card.classList.toggle('is-done', cb.checked);
        x.parentElement.querySelector('.done-label').textContent = cb.checked ? 'Done' : 'Mark as done';
      });
      if (cb.checked) cheer(cb);
      if (onChange) onChange(cb.dataset.done, cb.checked);
    }));
  }
  const CHEERS = ['Nice. That\'s one less way in.', 'Done. Good work.', 'Another one sorted.', 'That makes a real difference.'];
  let cheerN = 0;
  function cheer(cb) {
    const t = document.createElement('div');
    t.className = 'toast glass'; t.setAttribute('role', 'status');
    t.textContent = CHEERS[cheerN++ % CHEERS.length];
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2200);
  }

  function render(el) {
    const { esc, data } = A;
    const cur = A.current();
    if (!cur) {
      el.innerHTML = '<section class="glass card empty-wrap"><div class="empty">' + A.ill('sparkle', { cls: 'big' }) +
        '<h1>No results yet</h1><p class="muted">Take the 15-minute check to see your level, what you already do well and your five most useful next steps. Or look at a sample business first.</p>' +
        '<div class="actions"><a class="btn btn-primary btn-lg" href="#check/start">Start the check</a><button class="btn btn-lg" type="button" id="sample">Try a sample business</button></div></div></section>';
      el.querySelector('#sample').addEventListener('click', () => { A.loadSample('brightloaf'); A.go('#results'); });
      return;
    }
    const { state, result: r, actions } = cur;
    const R = root.KinholdRecommend;
    const done = new Set(state.done || []);
    const top = actions.slice(0, 5);
    const wins = R.quickWins(actions, top, 4);
    const sum = R.summary(data.questions, r, actions, state.business || 'Your business');
    const last = (state.checks || []).slice(-1)[0];
    const prev = (state.checks || []).slice(-2, -1)[0];
    const change = prev ? root.KinholdScoring.compare(root.KinholdScoring.score(data.questions, state.profile, prev.answers), r) : null;

    // Strengths by area: celebrate what's in place first.
    const strongAreas = r.areas.filter((a) => a.answered && a.gaps.length === 0);
    const partAreas = r.areas.filter((a) => a.strengths.length && a.gaps.length);

    el.innerHTML =
      (state.sample ? '<p class="sample-note glass"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg><span>You\'re looking at <b>' + esc(state.business) + '</b>, a fictional sample business. <a href="#check/start">Start your own check</a> when you\'re ready.</span></p>' : '') +
      '<section class="level-hero glass" aria-labelledby="lvl-h">' +
        '<div class="level-text">' +
          '<p class="kicker">' + esc(state.business || 'Your business') + (last ? ' · checked ' + A.formatDate(last.date) : '') + '</p>' +
          '<h1 id="lvl-h" class="serif">' + esc(r.levelInfo.label) + '</h1>' +
          '<p class="level-blurb">' + esc(r.levelInfo.blurb) + '</p>' +
          '<ol class="path" aria-label="Readiness levels">' + root.KinholdScoring.LEVELS.map((l, i) => '<li class="' + (i < r.level ? 'past' : i === r.level ? 'here' : '') + '"' + (i === r.level ? ' aria-current="step"' : '') + '><span class="node" aria-hidden="true"></span><span class="lbl">' + esc(l.label) + '</span>' + (i === r.level ? '<span class="you">You are here</span>' : '') + '</li>').join('') + '</ol>' +
          '<div class="summary">' + sum.paragraphs.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>' +
        '</div>' +
        '<aside class="score-side tonal" aria-label="Score details">' +
          ring(r.score) +
          '<p class="score-cap">Readiness score</p>' +
          (change && change.change !== null ? '<p class="score-change">' + A.status((change.change >= 0 ? 'Up ' : 'Down ') + Math.abs(change.change) + ' since ' + A.formatDate(prev.date), change.change >= 0 ? 'good' : 'bad', change.change >= 0 ? 'up' : 'down') + '</p>' : '') +
          '<dl class="mini"><div><dt>Cyber and fraud</dt><dd>' + (r.groups.cyber ?? 'n/a') + '</dd></div><div><dt>AI use</dt><dd>' + (r.groups.ai ?? 'n/a') + '</dd></div><div><dt>Answered</dt><dd>' + r.answered + ' of ' + r.total + '</dd></div></dl>' +
        '</aside>' +
      '</section>' +

      '<section class="glass card" aria-labelledby="good-h"><div class="card-head"><h2 id="good-h">What you already do well</h2><p>' + (r.strengths.length ? 'You have ' + r.strengths.length + ' of the ' + r.answered + ' things we asked about in place.' : 'Nothing fully in place yet, and that\'s where most businesses start. The steps below are free and quick.') + '</p></div>' +
        (strongAreas.length || partAreas.length ? '<ul class="good-list">' +
          strongAreas.map((a) => '<li>' + A.ill(a.illustration) + '<div><b>' + esc(a.title) + '</b>' + A.status('All in place', 'good', 'check') + '</div></li>').join('') +
          partAreas.map((a) => '<li>' + A.ill(a.illustration) + '<div><b>' + esc(a.title) + '</b>' + A.status(a.strengths.length + ' of ' + a.answered + ' in place', 'sage', 'leaf') + '</div></li>').join('') + '</ul>' : '') +
      '</section>' +

      '<section aria-labelledby="top-h" class="stack"><div class="section-head"><h2 id="top-h">Your five most useful next steps</h2><p class="muted">Ranked by how much risk each removes for the effort it takes. Tick them off as you go.</p></div>' +
        (top.length ? top.map((a, i) => actionCard(a, done.has(a.id), { rank: i + 1 })).join('') : '<div class="glass card"><p>No gaps in what we asked. Re-run the check every six months, or sooner if something changes.</p></div>') +
        (actions.length > 5 ? '<a class="btn" href="#plan">See all ' + actions.length + ' steps in your action plan</a>' : '') +
      '</section>' +

      (wins.length ? '<section class="glass card" aria-labelledby="win-h"><div class="card-head"><h2 id="win-h">Quick wins for today</h2><p>Free, and each takes less than an hour.</p></div><ul class="wins">' +
        wins.map((a) => '<li class="win' + (done.has(a.id) ? ' is-done' : '') + '"><div><b>' + esc(a.rec.title) + '</b><span class="muted">' + a.rec.minutes + ' min · ' + esc(a.rec.cost) + ' · ' + esc(a.rec.owner) + '</span></div>' + doneToggle(a.id, done.has(a.id)) + '</li>').join('') + '</ul></section>' : '') +

      '<div class="two">' +
        '<section class="glass card" aria-labelledby="area-h"><div class="card-head"><h2 id="area-h">By area</h2><p>Each area has its own level. Tap one to review your answers.</p></div><ul class="areas">' +
          r.areas.map((a, idx) => '<li><a href="#check/q/' + firstStep(a.id) + '">' + A.ill(a.illustration) + '<span class="a-title">' + esc(a.title) + (a.unsure.length ? '<small>' + a.unsure.length + ' to check</small>' : '') + '</span>' +
            '<span class="a-bar" aria-hidden="true"><span style="width:' + (a.score ?? 0) + '%"></span></span>' + A.levelStatus(a.level, a.level === null ? '' : root.KinholdScoring.LEVELS[a.level].label) + '</a></li>' + (r.areas[idx + 1] && r.areas[idx + 1].group !== a.group ? '<li class="area-divider" aria-hidden="true"></li>' : '')).join('') + '</ul></section>' +
        '<section class="glass card" aria-labelledby="like-h"><div class="card-head"><h2 id="like-h">What a business like yours usually has</h2><p>From the government\'s Cyber Security Breaches Survey 2025/2026. Figures for ' + (['solo', 'micro'].includes(state.profile.size) ? 'micro businesses (1 to 9 staff) where the survey gives them, otherwise all businesses' : 'all UK businesses') + '.</p></div>' +
          benchmarkList(state, r) + '</section>' +
      '</div>' +

      '<p class="note"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg>This is guidance based on NCSC, ICO and UK government advice, not a certification. A good result means you are on track with the basics, not that nothing can go wrong. If you\'d like to go further, Cyber Essentials is the government-backed scheme.</p>';
    bindDone(el);
  }

  function firstStep(areaId) {
    // Area-level steps on larger screens; question steps on phones. Find the first step in this area.
    const { data, store } = A;
    const qs = root.KinholdScoring.applicable(data.questions.questions, store.get().profile);
    if (matchMedia('(max-width: 720px)').matches) return qs.findIndex((q) => q.area === areaId) + 1;
    const areas = data.questions.areas.filter((a) => qs.some((q) => q.area === a.id));
    return areas.findIndex((a) => a.id === areaId) + 1;
  }

  function ring(score) {
    const r = 44, c = 2 * Math.PI * r, v = score || 0;
    return '<div class="score-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="' + r + '" class="sr-bg"/><circle cx="50" cy="50" r="' + r + '" class="sr-fg" stroke-dasharray="' + (c * v / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><span><b>' + v + '</b><small>of 100</small></span></div>';
  }

  function benchmarkList(state, r) {
    const { data, esc } = A;
    const R = root.KinholdRecommend;
    const qids = r.strengths.concat(r.gaps);
    const items = R.benchmarks(data.benchmarks, state.profile, qids);
    if (!items.length) return '<p class="muted">No survey figures match your answers yet.</p>';
    return '<ul class="bench">' + items.map((b) => {
      const qid = b.questions.find((q) => qids.includes(q));
      const yes = state.answers[qid] === 'yes';
      return '<li><span class="b-val">' + b.value + b.unit + '</span><span class="b-text">' + esc(b.text) + '</span>' + (yes ? A.status('You have this', 'good', 'check') : A.status('Not yet for you', 'warn', 'clock')) + '</li>';
    }).join('') + '</ul><p class="src">Source: ' + A.sourceLinks([data.benchmarks.source]) + '</p>';
  }

  A.results = { actionCard, bindDone, doneToggle };
  A.register('results', { render });
})(window);
