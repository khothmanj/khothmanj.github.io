/*
 * Staff training (#training, #training/<module>): four three-minute modules. Each has a short intro,
 * one hands-on activity (spot the warning signs, sort prompts, or a call scenario) and a 3-question
 * quiz. Two or more right earns a certificate with the person's name, saved as a PNG or printed.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;
  const PASS = 2;
  const ILL = { 'fake-invoice': 'invoice', 'phishing-email': 'envelope', 'ai-prompts': 'sparkle', 'urgent-call': 'speech' };
  const certs = () => { const c = A.store.get().certificates; return Array.isArray(c) ? c : []; };
  const latest = (id) => certs().filter((c) => c.module === id).slice(-1)[0];

  function render(el, ctx) {
    const id = ctx.route.args[0];
    const mod = id && A.data.training.modules.find((m) => m.id === id);
    if (mod) return module(el, mod, ctx.route.query);
    list(el);
  }

  /* ---------- module list ---------- */
  function list(el) {
    const { esc, data } = A;
    const mods = data.training.modules;
    const passed = mods.filter((m) => latest(m.id)).length;
    const all = certs();
    el.innerHTML =
      '<header class="page-head"><h1>Staff training</h1><p>Four short, hands-on modules on the scams that hit small businesses most. Each takes about three minutes and ends with a certificate. Good for new starters and a yearly refresher.</p></header>' +
      '<p class="train-progress">' + (passed === mods.length ? A.status('All four modules passed', 'good', 'check') : '<span class="muted">' + passed + ' of ' + mods.length + ' passed on this device</span>') + '</p>' +
      '<section class="train-grid" aria-label="Modules">' + mods.map((m, i) => {
        const c = latest(m.id);
        return '<a class="train-card glass" href="#training/' + m.id + '">' + A.ill(ILL[m.id] || 'shield', { cls: 'train-ill' }) +
          '<div><p class="kicker">Module ' + (i + 1) + ' · ' + m.minutes + ' min · ' + activityName(m.activity.type) + '</p><h2>' + esc(m.title) + '</h2><p class="muted">' + esc(firstSentence(m.intro)) + '</p></div>' +
          '<span class="train-state">' + (c ? A.status('Passed by ' + c.name, 'good', 'check') : '<span class="btn">Start</span>') + '</span></a>';
      }).join('') + '</section>' +
      (all.length ? '<section class="glass card" aria-labelledby="cert-h"><div class="card-head"><h2 id="cert-h">Certificates earned</h2><p>Kept on this device. Open one to save it again or print it.</p></div><ul class="cert-list">' +
        all.slice().reverse().map((c) => { const m = mods.find((x) => x.id === c.module); return '<li><span><b>' + esc(c.name) + '</b><span class="muted">' + esc(m ? m.title : c.module) + '</span></span><span class="muted">' + A.formatDate(c.date) + ' · ' + c.score + ' of 3</span><a href="#training/' + c.module + '?cert=1">View</a></li>'; }).join('') + '</ul></section>' : '') +
      '<p class="note"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg>All examples are invented. Certificates show someone completed Kinhold\'s awareness training. They aren\'t a formal qualification.</p>';
  }
  const activityName = (t) => ({ hotspots: 'Spot the signs', sort: 'Sort', scenario: 'Scenario' }[t] || 'Activity');
  const firstSentence = (s) => (s.match(/^.*?[.!?](\s|$)/) || [s])[0].trim();

  /* ---------- one module ---------- */
  function module(el, m, query) {
    const { esc } = A;
    const STEPS = ['Intro', 'Activity', 'Quiz', 'Certificate'];
    let step = query.get('cert') && latest(m.id) ? 3 : 0;
    let score = latest(m.id) ? latest(m.id).score : 0;

    el.innerHTML =
      '<header class="mod-head"><a class="back-link" href="#training"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>All modules</a>' +
        '<h1>' + esc(m.title) + '</h1>' +
        '<ol class="mod-steps" aria-label="Progress">' + STEPS.map((s, i) => '<li data-s="' + i + '">' + s + '</li>').join('') + '</ol></header>' +
      '<section class="glass card mod-body" id="mod" tabindex="-1"></section>';
    const body = el.querySelector('#mod');

    const go = (n) => {
      step = n;
      el.querySelectorAll('.mod-steps li').forEach((li) => {
        const i = +li.dataset.s;
        li.className = i < step ? 'done' : i === step ? 'now' : '';
        if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      [intro, activity, quiz, certificate][step]();
      if (n) { body.focus({ preventScroll: true }); body.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
    };

    function intro() {
      body.innerHTML = '<div class="mod-intro">' + A.ill(ILL[m.id] || 'shield', { cls: 'big' }) + '<div><h2>What this is about</h2><p class="lead">' + esc(m.intro) + '</p><p class="muted small">About ' + m.minutes + ' minutes. One activity, then three questions.</p>' +
        '<button class="btn btn-primary btn-lg" type="button" id="next">Start the activity</button></div></div>';
      body.querySelector('#next').addEventListener('click', () => go(1));
    }

    function activity() {
      const a = m.activity;
      body.innerHTML = '<h2>' + esc(a.prompt) + '</h2><div id="act"></div><div class="mod-foot"><p class="muted small" id="act-status" role="status"></p><button class="btn btn-primary" type="button" id="next" disabled>Go to the quiz</button></div>';
      const next = body.querySelector('#next'), st = body.querySelector('#act-status');
      next.addEventListener('click', () => go(2));
      const done = (msg) => { next.disabled = false; st.innerHTML = msg; };
      ({ hotspots, sort, scenario })[a.type](body.querySelector('#act'), a, st, done);
    }

    function quiz() {
      body.innerHTML = '<h2>Three quick questions</h2><p class="muted small">Get ' + PASS + ' or more right to earn the certificate.</p><form id="quiz" class="quiz">' +
        m.quiz.map((q, i) => '<fieldset class="q" data-q="' + i + '"><legend>' + (i + 1) + '. ' + esc(q.q) + '</legend>' +
          q.options.map((o, j) => '<label class="opt"><input type="radio" name="q' + i + '" value="' + j + '"><span>' + esc(o) + '</span></label>').join('') +
          '<div class="q-explain" hidden></div></fieldset>').join('') +
        '<p class="form-error" id="q-err" role="alert" hidden></p><div class="mod-foot"><span></span><button class="btn btn-primary" type="submit" id="check">Check my answers</button></div></form>';
      const form = body.querySelector('#quiz');
      let marked = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (marked) { go(3); return; }
        const picks = m.quiz.map((q, i) => form.elements['q' + i].value);
        const err = body.querySelector('#q-err');
        if (picks.some((p) => p === '')) { err.hidden = false; err.textContent = 'Please answer all three questions.'; return; }
        err.hidden = true;
        score = 0;
        m.quiz.forEach((q, i) => {
          const right = +picks[i] === q.answer; if (right) score++;
          const fs = form.querySelector('[data-q="' + i + '"]');
          fs.querySelectorAll('input').forEach((inp) => { inp.disabled = true; const lab = inp.closest('.opt'); if (+inp.value === q.answer) lab.classList.add('is-right'); else if (inp.checked) lab.classList.add('is-wrong'); });
          const ex = fs.querySelector('.q-explain'); ex.hidden = false;
          ex.innerHTML = (right ? A.status('Correct', 'good', 'check') : A.status('Not quite', 'bad', 'alert')) + '<p>' + esc(q.explain) + '</p>' + (q.sources && q.sources.length ? '<p class="src">Guidance: ' + A.sourceLinks(q.sources) + '</p>' : '');
        });
        marked = true;
        const btn = body.querySelector('#check');
        const foot = form.querySelector('.mod-foot span');
        if (score >= PASS) { btn.textContent = 'Get my certificate'; foot.innerHTML = A.status(score + ' of 3 right. You passed.', 'good', 'check'); }
        else {
          foot.innerHTML = A.status(score + ' of 3 right. You need ' + PASS + ' to pass.', 'warn', 'alert');
          btn.textContent = 'Try the quiz again'; btn.type = 'button';
          btn.addEventListener('click', () => go(2), { once: true });
        }
      });
    }

    function certificate() {
      const prev = latest(m.id);
      const saved = A.store.get().staffName || '';
      body.innerHTML = '<div class="cert-step"><div><h2>' + (prev && score === prev.score && query.get('cert') ? 'Your certificate' : 'Well done. Add your name for the certificate.') + '</h2>' +
        '<label class="field">Your name<input class="input" id="cname" maxlength="60" autocomplete="name" value="' + esc(prev ? prev.name : saved) + '" placeholder="For example, Jo Adeyemi"></label>' +
        '<p class="form-error" id="c-err" role="alert" hidden></p>' +
        '<div class="hero-actions"><button class="btn btn-primary" type="button" id="save-png"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10"/></svg>Save as image</button><button class="btn" type="button" id="print">Print</button></div>' +
        '<p class="muted small" id="c-status" role="status"></p>' +
        '<p><a href="#training">Back to all modules</a></p></div>' +
        '<div class="cert-preview"><canvas id="cert" width="1600" height="1130" role="img" aria-label="Certificate"></canvas></div></div>';
      const input = body.querySelector('#cname'), canvas = body.querySelector('#cert');
      const date = prev && query.get('cert') ? prev.date : new Date().toISOString().slice(0, 10);
      const draw = () => { drawCert(canvas, input.value.trim() || 'Your name', m.title, date, score); canvas.setAttribute('aria-label', 'Certificate: ' + (input.value.trim() || 'your name') + ' completed ' + m.title + ' on ' + A.formatDate(date)); };
      const record = () => {
        const name = input.value.trim();
        const err = body.querySelector('#c-err');
        if (!name) { err.hidden = false; err.textContent = 'Add your name first.'; input.focus(); return false; }
        err.hidden = true;
        const list = certs().filter((c) => !(c.module === m.id && c.name === name));
        list.push({ module: m.id, name, date, score });
        A.store.save({ certificates: list, staffName: name });
        return true;
      };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(draw);
      input.addEventListener('input', draw);
      body.querySelector('#save-png').addEventListener('click', () => {
        if (!record()) return;
        canvas.toBlob((blob) => {
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = ('kinhold-certificate-' + m.id + '-' + input.value.trim()).toLowerCase().replace(/[^\w-]+/g, '-') + '.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          body.querySelector('#c-status').textContent = 'Saved. Your certificate is also kept in Staff training on this device.';
        }, 'image/png');
      });
      body.querySelector('#print').addEventListener('click', () => { if (record()) root.print(); });
      if (!prev || !query.get('cert')) setTimeout(() => input.focus(), 50);
    }

    go(step);
  }

  /* ---------- activities ---------- */
  function hotspots(box, a, st, done) {
    const { esc } = A, it = a.item;
    const total = Object.keys(it.hotspots).length;
    const found = new Set();
    let misses = 0;
    box.innerHTML = '<div class="hs-mail" role="group" aria-label="The example message. Select each part you think is a warning sign.">' +
      '<div class="hs-head">' + [/^from:/i.test(it.lines[0].text) ? '' : '<span class="muted small">From</span> ' + esc(it.from), it.subject ? '<span class="muted small">Subject</span> ' + esc(it.subject) : ''].filter(Boolean).join('<br>') + '</div>' +
      it.lines.map((l, i) => '<button type="button" class="hs-line" data-i="' + i + '" aria-pressed="false">' + esc(l.text) + '</button><p class="hs-why" id="why' + i + '" hidden></p>').join('') + '</div>' +
      '<div class="hs-tools"><span class="hs-count" id="hs-count"></span><button class="btn btn-quiet" type="button" id="reveal">Show me the rest</button></div>' +
      (it.knownSender ? '<p class="muted small">You usually get emails from ' + esc(it.knownSender) + '.</p>' : '');
    const count = () => { box.querySelector('#hs-count').innerHTML = A.status(found.size + ' of ' + total + ' found', found.size === total ? 'good' : '', found.size === total ? 'check' : 'dot'); };
    const reveal = (i, auto) => {
      const l = it.lines[i], b = box.querySelector('[data-i="' + i + '"]'), why = box.querySelector('#why' + i);
      b.classList.add(auto ? 'is-shown' : 'is-found'); b.setAttribute('aria-pressed', 'true'); b.disabled = true;
      why.hidden = false; why.innerHTML = A.status(auto ? 'Missed' : 'Found', auto ? 'warn' : 'good', auto ? 'alert' : 'check') + ' ' + esc(it.hotspots[l.hotspot]);
      found.add(l.hotspot);
    };
    const finish = (all) => { count(); box.querySelector('#reveal').hidden = true; done(all ? 'You found all ' + total + '. Nice work.' : 'Those are the ' + total + ' signs. Look out for them in real messages.'); };
    box.querySelectorAll('.hs-line').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i, l = it.lines[i];
      if (l.hotspot) { reveal(i, false); count(); if (found.size === total) finish(true); }
      else {
        misses++;
        const why = box.querySelector('#why' + i); why.hidden = false; why.innerHTML = A.status('Looks normal', '', 'minus') + ' This part is ordinary on its own.';
        b.classList.add('is-miss'); b.disabled = true;
        st.textContent = misses >= 3 && found.size < total ? 'Stuck? Use "Show me the rest".' : '';
      }
    }));
    box.querySelector('#reveal').addEventListener('click', () => { it.lines.forEach((l, i) => { if (l.hotspot && !found.has(l.hotspot)) reveal(i, true); }); finish(false); });
    count();
  }

  function sort(box, a, st, done) {
    const { esc } = A;
    let answered = 0, right = 0;
    box.innerHTML = '<ol class="sort-list">' + a.items.map((it, i) => '<li data-i="' + i + '"><p>' + esc(it.text) + '</p><div class="sort-btns" role="group" aria-label="Where does this go?">' +
      a.bins.map((b) => '<button type="button" class="btn" data-bin="' + b.id + '">' + esc(b.label) + '</button>').join('') + '</div><p class="sort-why" hidden></p></li>').join('') + '</ol>';
    box.querySelectorAll('.sort-list li').forEach((li) => li.querySelectorAll('[data-bin]').forEach((btn) => btn.addEventListener('click', () => {
      const it = a.items[+li.dataset.i], ok = btn.dataset.bin === it.bin;
      li.querySelectorAll('[data-bin]').forEach((x) => { x.disabled = true; if (x.dataset.bin === it.bin) x.classList.add('is-right'); });
      if (!ok) btn.classList.add('is-wrong');
      const why = li.querySelector('.sort-why'); why.hidden = false;
      why.innerHTML = (ok ? A.status('Right', 'good', 'check') : A.status('Not quite', 'bad', 'alert')) + ' ' + esc(it.why);
      answered++; if (ok) right++;
      st.textContent = answered + ' of ' + a.items.length + ' sorted';
      if (answered === a.items.length) done(right + ' of ' + a.items.length + ' right. The rule: describe the situation, not the person.');
    })));
    st.textContent = '0 of ' + a.items.length + ' sorted';
  }

  function scenario(box, a, st, done) {
    const { esc } = A;
    let n = 0, good = 0;
    const show = () => {
      const s = a.steps[n];
      const el = document.createElement('div'); el.className = 'scn-step';
      el.innerHTML = '<p class="kicker">Step ' + (n + 1) + ' of ' + a.steps.length + '</p><p class="scn-sit">' + esc(s.situation) + '</p><div class="scn-choices">' +
        s.choices.map((c, j) => '<button type="button" class="scn-choice" data-j="' + j + '">' + esc(c.text) + '</button>').join('') + '</div><p class="scn-fb" hidden></p>';
      box.appendChild(el);
      el.querySelectorAll('.scn-choice').forEach((b) => b.addEventListener('click', () => {
        const c = s.choices[+b.dataset.j];
        el.querySelectorAll('.scn-choice').forEach((x) => { x.disabled = true; if (s.choices[+x.dataset.j].good) x.classList.add('is-right'); });
        if (!c.good) b.classList.add('is-wrong'); else good++;
        const fb = el.querySelector('.scn-fb'); fb.hidden = false;
        fb.innerHTML = (c.good ? A.status('Good call', 'good', 'check') : A.status('Risky', 'bad', 'alert')) + ' ' + esc(c.feedback) +
          (!c.good ? ' <span class="muted">The safer choice is highlighted.</span>' : '');
        n++;
        if (n < a.steps.length) { const nx = document.createElement('button'); nx.type = 'button'; nx.className = 'btn'; nx.textContent = 'Next step'; fb.after(nx); nx.addEventListener('click', () => { nx.remove(); show(); el.nextElementSibling.querySelector('.scn-choice').focus(); }); }
        else done(good + ' of ' + a.steps.length + ' safe choices. Hang up, call back on a number you already have, and let a genuine payment wait.');
      }));
    };
    show();
  }

  /* ---------- certificate image ---------- */
  function drawCert(cv, name, title, date, score) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    const sans = 'Inter, system-ui, sans-serif', serif = '"Source Serif 4", Georgia, serif';
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#FBF8F4'; c.fillRect(0, 0, W, H);
    // soft inset panel
    round(c, 50, 50, W - 100, H - 100, 36); c.fillStyle = '#FFFFFF'; c.fill();
    // soft duotone shield, bottom right
    c.save(); c.translate(W - 330, H - 400); c.scale(9, 9);
    c.fillStyle = '#F3D9C8'; c.beginPath(); c.moveTo(16, 6.5); c.lineTo(24, 9.5); c.lineTo(24, 15.5); c.bezierCurveTo(24, 20.8, 20.6, 24.9, 16, 26.4); c.bezierCurveTo(11.4, 24.9, 8, 20.8, 8, 15.5); c.lineTo(8, 9.5); c.closePath(); c.fill();
    c.fillStyle = '#E7A27F'; c.beginPath(); c.moveTo(16, 9.2); c.lineTo(21.4, 11.2); c.lineTo(21.4, 15.5); c.bezierCurveTo(21.4, 19.3, 19.1, 22.2, 16, 23.4); c.closePath(); c.fill();
    c.restore();
    // brand
    round(c, 130, 130, 64, 64, 18); c.fillStyle = '#A6492A'; c.fill();
    c.fillStyle = '#F7E3D6'; c.beginPath(); c.moveTo(162, 143); c.lineTo(178, 149); c.lineTo(178, 161); c.bezierCurveTo(178, 171.6, 171.2, 179.8, 162, 182.8); c.bezierCurveTo(152.8, 179.8, 146, 171.6, 146, 161); c.lineTo(146, 149); c.closePath(); c.fill();
    c.fillStyle = '#1F1A17'; c.font = '600 34px ' + sans; c.textBaseline = 'middle'; c.fillText('Kinhold', 214, 162);
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#6A5F57'; c.font = '500 30px ' + sans; c.fillText('Certificate of completion', 130, 330);
    c.fillStyle = '#1F1A17'; c.font = '600 92px ' + serif; fitText(c, name, 130, 450, W - 260, 92, serif);
    c.fillStyle = '#3A322C'; c.font = '400 36px ' + sans; c.fillText('has completed the Kinhold staff training module', 130, 540);
    c.fillStyle = '#A6492A'; c.font = '600 52px ' + sans; fitText(c, title, 130, 620, W - 520, 52, sans, '600');
    c.fillStyle = '#3A322C'; c.font = '400 32px ' + sans;
    c.fillText('Quiz score ' + score + ' of 3', 130, 720);
    c.fillText('Completed ' + new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 130, 770);
    c.fillStyle = '#6A5F57'; c.font = '400 24px ' + sans;
    c.fillText('Awareness training, not a formal qualification. Kinhold is a portfolio prototype with a fictional brand.', 130, H - 130);
  }
  function round(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fitText(c, text, x, y, max, size, family, weight) {
    let s = size; c.font = (weight || '600') + ' ' + s + 'px ' + family;
    while (c.measureText(text).width > max && s > 28) { s -= 2; c.font = (weight || '600') + ' ' + s + 'px ' + family; }
    c.fillText(text, x, y);
  }

  A.register('training', { render });
})(window);
