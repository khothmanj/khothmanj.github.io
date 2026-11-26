/*
 * Readiness check (#check): profile first, then questions. One question per screen on phones,
 * one area per screen on larger screens. Every answer saves as you go.
 *   #check          resume where you left off
 *   #check/start    about your business
 *   #check/q/3      step 3
 *   #check/done     finished
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;
  const OPTION_SYMBOL = {
    yes: '<path d="M4 8.5l3 3 6-7"/>',
    partly: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/>',
    no: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
    unsure: '<circle cx="8" cy="8" r="5.5"/><path d="M6.4 6.4a1.7 1.7 0 0 1 3.2.6c0 1.2-1.6 1.4-1.6 2.4M8 11.2v.2"/>',
  };
  const small = () => matchMedia('(max-width: 720px)').matches;
  const today = () => new Date().toISOString().slice(0, 10);

  function steps() {
    const { data, store } = A;
    const qs = root.KinholdScoring.applicable(data.questions.questions, store.get().profile);
    if (small()) return qs.map((q) => ({ area: q.area, questions: [q] }));
    return data.questions.areas.map((a) => ({ area: a.id, questions: qs.filter((q) => q.area === a.id) })).filter((s) => s.questions.length);
  }

  function render(el, ctx) {
    const s = A.store.get();
    const [mode, n] = ctx.route.args;
    if (mode === 'start' || !s.profile) return profileView(el);
    if (mode === 'done') return doneView(el);
    const list = steps();
    let i = mode === 'q' ? Math.max(0, Math.min(list.length - 1, (parseInt(n, 10) || 1) - 1)) : Math.min(s.step || 0, list.length - 1);
    if (mode !== 'q') { history.replaceState(null, '', '#check/q/' + (i + 1)); }
    A.store.save({ step: i });
    stepView(el, list, i);
    // If the screen size changes enough to switch layouts, keep the place by question.
    const mq = matchMedia('(max-width: 720px)');
    const onChange = () => { const first = list[i].questions[0].id; const next = steps(); const j = next.findIndex((st) => st.questions.some((q) => q.id === first)); location.hash = '#check/q/' + (j + 1); };
    mq.addEventListener('change', onChange);
    this.cleanup = () => mq.removeEventListener('change', onChange);
  }

  /* ---------- about your business ---------- */
  function profileView(el) {
    const { data, store, esc } = A;
    const s = store.get();
    const p = s.profile || {};
    el.innerHTML =
      '<header class="page-head"><p class="kicker">Step 1 of 2</p><h1>About your business</h1><p>A few quick choices so we only ask what applies to you. This takes about a minute.</p></header>' +
      '<form class="glass card profile" id="profile" novalidate>' +
        '<label class="field">Business name <small>Used on your results and templates. Optional.</small><input class="input" id="bname" name="business" autocomplete="organization" placeholder="For example, Brightloaf Bakery" value="' + esc(s.sample ? '' : s.business) + '"></label>' +
        data.questions.profile.map((q) =>
          '<fieldset class="choice-group"><legend>' + esc(q.text) + '</legend><div class="chips">' +
          q.options.map((o) => '<label class="chip"><input type="radio" name="' + q.id + '" value="' + esc(o.value) + '"' + (p[q.id] === o.value ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>').join('') +
          '</div></fieldset>').join('') +
        '<div class="form-actions"><p class="form-error" id="perr" role="alert" hidden></p><button class="btn btn-primary btn-lg" type="submit">Start the questions</button>' +
        (s.sample ? '<p class="muted small">This replaces the sample business with your own check.</p>' : '') + '</div>' +
      '</form>';
    el.querySelector('#profile').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget, profile = {};
      const missing = data.questions.profile.filter((q) => { const v = form.querySelector('input[name="' + q.id + '"]:checked'); if (v) profile[q.id] = v.value; return !v; });
      form.querySelectorAll('.field-error').forEach((x) => x.remove());
      if (missing.length) {
        const err = form.querySelector('#perr');
        err.textContent = missing.length === 1 ? 'Please answer the question marked below.' : 'Please answer the ' + missing.length + ' questions marked below.';
        err.hidden = false;
        missing.forEach((q) => {
          const fs = form.querySelector('input[name="' + q.id + '"]').closest('fieldset');
          fs.insertAdjacentHTML('beforeend', '<p class="field-error" id="err-' + q.id + '">Please choose one.</p>');
          fs.setAttribute('aria-describedby', 'err-' + q.id);
        });
        form.querySelector('input[name="' + missing[0].id + '"]').focus();
        return;
      }
      const fresh = s.sample || !s.profile;
      store.save({ business: form.querySelector('#bname').value.trim(), profile, step: 0, sample: false, answers: fresh ? {} : s.answers, checks: fresh ? [] : s.checks, done: fresh ? [] : s.done });
      A.go('#check/q/1');
    });
  }

  /* ---------- questions ---------- */
  function stepView(el, list, i) {
    const { data, store, esc } = A;
    const st = list[i];
    const area = data.areaById[st.area];
    const all = list.flatMap((x) => x.questions);
    const answers = () => store.get().answers;
    const answeredCount = () => all.filter((q) => answers()[q.id] !== undefined).length;
    const areaNo = data.questions.areas.findIndex((a) => a.id === st.area) + 1;
    const isLast = i === list.length - 1;

    el.innerHTML =
      '<div class="check">' +
        '<aside class="rail glass" aria-label="Areas">' + railHtml(list, i) + '</aside>' +
        '<section class="check-main" aria-labelledby="step-h">' +
          '<div class="progress glass">' +
            '<div class="progress-top"><span id="prog-text"></span><span class="muted" id="prog-time"></span></div>' +
            '<div class="bar" role="progressbar" aria-label="Questions answered" aria-valuemin="0" aria-valuemax="' + all.length + '"><span id="prog-fill"></span></div>' +
          '</div>' +
          '<div class="area-head">' + A.ill(area.illustration) + '<div><p class="kicker">' + (area.group === 'ai' ? 'AI use · ' : '') + 'Area ' + areaNo + ' of ' + data.questions.areas.length + '</p><h1 id="step-h">' + esc(area.title) + '</h1><p class="muted">' + esc(area.short) + '</p></div></div>' +
          st.questions.map((q) => questionHtml(q, answers()[q.id])).join('') +
          '<nav class="step-nav" aria-label="Question navigation">' +
            '<a class="btn" href="' + (i === 0 ? '#check/start' : '#check/q/' + i) + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>' + (i === 0 ? 'About your business' : 'Previous') + '</a>' +
            '<a class="btn-quiet btn" href="#home">Save and finish later</a>' +
            '<a class="btn btn-primary" href="' + (isLast ? '#check/done' : '#check/q/' + (i + 2)) + '">' + (isLast ? 'See your results' : 'Next') + '</a>' +
          '</nav>' +
        '</section>' +
      '</div>';

    const updateProgress = () => {
      const done = answeredCount();
      const left = all.length - done;
      el.querySelector('#prog-text').textContent = done + ' of ' + all.length + ' answered';
      el.querySelector('#prog-time').textContent = left ? 'About ' + Math.max(1, Math.ceil(left * 20 / 60)) + ' min left' : 'All answered';
      el.querySelector('#prog-fill').style.width = (100 * done / all.length) + '%';
      el.querySelector('.bar').setAttribute('aria-valuenow', done);
      el.querySelector('.rail').innerHTML = railHtml(list, i);
    };
    updateProgress();

    el.querySelectorAll('.answer input').forEach((input) => input.addEventListener('change', () => {
      const qid = input.name;
      store.save({ answers: Object.assign({}, answers(), { [qid]: input.value }) });
      const card = el.querySelector('[data-q="' + qid + '"]');
      card.classList.add('answered');
      card.querySelector('.unsure-note').hidden = input.value !== 'unsure';
      updateProgress();
    }));
  }

  function questionHtml(q, value) {
    const { data, esc } = A;
    const opts = Object.entries(data.questions.answers);
    return '<fieldset class="q glass' + (value ? ' answered' : '') + '" data-q="' + q.id + '">' +
      '<legend class="q-text">' + esc(q.text) + '</legend>' +
      '<p class="q-help"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg>' + esc(q.help) + '</p>' +
      '<div class="answers">' + opts.map(([key, o]) =>
        '<label class="answer"><input type="radio" name="' + q.id + '" value="' + key + '"' + (value === key ? ' checked' : '') + '>' +
        '<span class="answer-box"><svg viewBox="0 0 16 16" aria-hidden="true">' + OPTION_SYMBOL[key] + '</svg>' + esc(o.label) + '</span></label>').join('') + '</div>' +
      '<p class="unsure-note"' + (value === 'unsure' ? '' : ' hidden') + '>' + esc(data.questions.answers.unsure.note) + '</p>' +
      '<div class="why"><p><b>Why this matters.</b> ' + esc(q.why) + '</p>' +
        '<details><summary>See an example</summary><p>' + esc(q.example) + '</p></details>' +
        '<p class="src">Source: ' + A.sourceLinks(q.sources) + '</p></div>' +
    '</fieldset>';
  }

  function railHtml(list, current) {
    const { data, store, esc } = A;
    const ans = store.get().answers;
    const byArea = {};
    list.forEach((st, idx) => st.questions.forEach((q) => { (byArea[st.area] = byArea[st.area] || { first: idx, total: 0, done: 0 }); byArea[st.area].total++; if (ans[q.id] !== undefined) byArea[st.area].done++; }));
    const currentArea = list[current].area;
    let lastGroup = null;
    return '<ol class="rail-list">' + data.questions.areas.filter((a) => byArea[a.id]).map((a) => {
      const b = byArea[a.id], pct = b.done / b.total;
      const head = a.group !== lastGroup ? '<li class="rail-group">' + (a.group === 'ai' ? 'AI use' : 'Cyber and fraud') + '</li>' : '';
      lastGroup = a.group;
      const r = 7, c = 2 * Math.PI * r;
      return head + '<li><a href="#check/q/' + (b.first + 1) + '"' + (a.id === currentArea ? ' aria-current="step"' : '') + '>' +
        '<svg class="ring" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="' + r + '" class="ring-bg"/><circle cx="9" cy="9" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * pct).toFixed(2) + ' ' + c.toFixed(2) + '"/>' + (pct === 1 ? '<path d="M6 9.2l2 2 4-4.2" class="ring-tick"/>' : '') + '</svg>' +
        '<span>' + esc(a.title) + '</span><span class="visually-hidden">, ' + b.done + ' of ' + b.total + ' answered</span></a></li>';
    }).join('') + '</ol>';
  }

  /* ---------- finished ---------- */
  function doneView(el) {
    const { data, store, esc } = A;
    const s = store.get();
    const r = root.KinholdScoring.score(data.questions, s.profile, s.answers);
    if (r.answered) {
      const checks = (s.checks || []).filter((c) => c.date !== today());
      checks.push({ date: today(), answers: Object.assign({}, s.answers) });
      store.save({ checks });
    }
    const skipped = r.total - r.answered;
    el.innerHTML =
      '<section class="glass card done" aria-labelledby="done-h">' + A.ill('shield', { cls: 'big' }) +
        '<h1 id="done-h" class="serif">' + (r.answered ? 'That\'s everything. Well done.' : 'You haven\'t answered any questions yet.') + '</h1>' +
        '<p class="muted">' + (r.answered ? 'You answered ' + r.answered + ' of ' + r.total + ' questions' + (skipped ? '. You can go back to the other ' + skipped + ' at any time' : '') + '. ' + (r.unsure.length ? 'You weren\'t sure about ' + r.unsure.length + ', which is completely normal. Your results show how to find out.' : '') : 'Answer a few to see your results.') + '</p>' +
        '<div class="hero-actions">' + (r.answered ? '<a class="btn btn-primary btn-lg" href="#results">See your results</a><a class="btn btn-lg" href="#check/q/1">Review my answers</a>' : '<a class="btn btn-primary btn-lg" href="#check/q/1">Start the questions</a>') + '</div>' +
      '</section>';
  }

  A.register('check', { render });
})(window);
