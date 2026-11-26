/*
 * Action plan (#plan): every gap placed in a 30, 60 or 90 day phase with an owner, progress that
 * fills as things are done, and a record of checks over time with what improved.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;

  function render(el, ctx) {
    const { esc, data } = A;
    const cur = A.current();
    if (!cur) {
      el.innerHTML = '<section class="glass card empty-wrap"><div class="empty">' + A.ill('document', { cls: 'big' }) + '<h1>Your plan appears after the check</h1><p class="muted">Kinhold turns your answers into a 30, 60 and 90 day plan, with an owner for each step.</p><div class="actions"><a class="btn btn-primary btn-lg" href="#check/start">Start the check</a><button class="btn btn-lg" type="button" id="sample">Try a sample business</button></div></div></section>';
      el.querySelector('#sample').addEventListener('click', () => { A.loadSample('brightloaf'); A.go('#plan'); });
      return;
    }
    const { state, actions, plan } = cur;
    const R = root.KinholdRecommend;
    const owner = ctx.route.query.get('owner') || '';
    const byId = Object.fromEntries(actions.map((a) => [a.id, a]));
    const done = () => new Set(A.store.get().done || []);

    el.innerHTML =
      '<header class="plan-head glass">' +
        '<div><p class="kicker">' + esc(state.business || 'Your business') + '</p><h1>Your 90-day plan</h1><p class="muted">Every gap from your check, in a sensible order. The first 30 days hold the essentials and the quickest wins.</p></div>' +
        '<div class="plan-progress" id="overall"></div>' +
      '</header>' +
      '<div class="owner-filter" role="group" aria-label="Show steps for">' +
        ['', 'Owner', 'Office manager', 'All staff'].map((o) => '<a href="#plan' + (o ? '?owner=' + encodeURIComponent(o) : '') + '" class="chip-link"' + (o === owner ? ' aria-current="true"' : '') + '>' + (o || 'Everyone') + '</a>').join('') +
      '</div>' +
      '<section class="phases" aria-label="Plan phases">' + plan.filter((p) => p.actions.length).map((p) => {
        const items = p.actions.filter((a) => !owner || a.owner === owner);
        return '<section class="phase glass" data-phase="' + p.id + '" aria-labelledby="ph-' + p.id + '">' +
          '<div class="phase-head"><h2 id="ph-' + p.id + '">' + esc(p.label) + '</h2><span class="phase-count" data-count="' + p.id + '"></span></div>' +
          '<div class="bar" aria-hidden="true"><span data-bar="' + p.id + '"></span></div>' +
          (items.length ? '<ul class="plan-items">' + items.map((a) => item(byId[a.id], done().has(a.id))).join('') + '</ul>' : '<p class="muted small">Nothing for ' + esc(owner.toLowerCase()) + ' in this phase.</p>') +
        '</section>';
      }).join('') + '</section>' +
      history(state) +
      '<p class="note"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg>Done markers are saved on this device. Re-run the check every six months, or after a big change such as a new system or new staff, to see how far you\'ve come.</p>';

    const refresh = () => {
      const p = R.progress(plan, [...done()]);
      el.querySelector('#overall').innerHTML = ringSmall(p.percent) + '<div><b>' + p.done + ' of ' + p.total + '</b><span class="muted">steps done</span></div>';
      p.phases.forEach((ph) => {
        const c = el.querySelector('[data-count="' + ph.id + '"]'); if (!c) return;
        c.innerHTML = ph.done === ph.total && ph.total ? A.status('All done', 'good', 'check') : '<span class="muted">' + ph.done + ' of ' + ph.total + ' done</span>';
        el.querySelector('[data-bar="' + ph.id + '"]').style.width = (ph.total ? (100 * ph.done) / ph.total : 0) + '%';
      });
    };
    refresh();
    A.results.bindDone(el, refresh);
    const rerun = el.querySelector('#rerun');
    if (rerun) rerun.addEventListener('click', () => { A.store.save({ step: 0 }); A.go('#check/q/1'); });
  }

  function item(a, isDone) {
    const { esc } = A, r = a.rec;
    return '<li class="plan-item' + (isDone ? ' is-done' : '') + '">' +
      '<div class="pi-main"><details><summary><b>' + esc(r.title) + '</b>' + (a.critical ? A.status('Essential', 'clay', 'star') : '') + '</summary>' +
        '<p>' + esc(r.summary) + '</p><ol>' + r.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
        (r.toolkit ? '<p><a href="#toolkit?t=' + r.toolkit + '">Use the template in the toolkit</a></p>' : '') +
        '<p class="src">Guidance: ' + A.sourceLinks(r.sources) + '</p></details>' +
        '<span class="pi-meta">' + esc(r.owner) + ' · ' + r.minutes + ' min · ' + esc(r.cost) + '</span></div>' +
      A.results.doneToggle(r.id, isDone) +
    '</li>';
  }

  function ringSmall(pct) {
    const r = 22, c = 2 * Math.PI * r;
    return '<svg class="ring-sm" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="' + r + '" class="sr-bg"/><circle cx="27" cy="27" r="' + r + '" class="sr-fg sage" stroke-dasharray="' + (c * pct / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/><text x="27" y="31" text-anchor="middle" transform="rotate(90 27 27)">' + pct + '%</text></svg>';
  }

  function history(state) {
    const { esc, data } = A, S = root.KinholdScoring;
    const checks = state.checks || [];
    const rows = checks.map((c) => ({ date: c.date, r: S.score(data.questions, state.profile, c.answers) }));
    let compare = '';
    if (rows.length >= 2) {
      const a = rows[rows.length - 2], b = rows[rows.length - 1];
      const c = S.compare(a.r, b.r);
      const improved = c.areas.filter((x) => x.change > 0).sort((x, y) => y.change - x.change).slice(0, 5);
      compare = '<div class="compare tonal"><p><b>Since ' + A.formatDate(a.date) + '</b> ' + A.status((c.change >= 0 ? 'up ' : 'down ') + Math.abs(c.change) + ' points', c.change >= 0 ? 'good' : 'bad', c.change >= 0 ? 'up' : 'down') + '</p>' +
        (c.fixed.length ? '<p class="muted small">' + c.fixed.length + (c.fixed.length === 1 ? ' gap' : ' gaps') + ' closed.</p>' : '') +
        (improved.length ? '<ul class="improved">' + improved.map((x) => '<li><span>' + esc(x.title) + '</span><span class="muted">' + x.before + ' to ' + x.after + '</span></li>').join('') + '</ul>' : '') + '</div>';
    }
    return '<section class="glass card" aria-labelledby="hist-h"><div class="card-head"><h2 id="hist-h">Your progress over time</h2><p>Each time you finish the check, Kinhold keeps a copy so you can see what\'s improved.</p></div>' +
      '<div class="history">' +
        '<ol class="checks">' + rows.map((x) => '<li><span>' + A.formatDate(x.date) + '</span>' + A.levelStatus(x.r.level, x.r.levelInfo.label) + '<span class="muted">' + x.r.score + ' of 100</span></li>').join('') + (rows.length ? '' : '<li class="muted">No finished checks yet.</li>') + '</ol>' +
        compare +
      '</div>' +
      '<button class="btn" type="button" id="rerun"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 3v3h3"/></svg>Re-run the check</button></section>';
  }

  A.register('plan', { render });
})(window);
