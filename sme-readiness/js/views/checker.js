/*
 * Message checker (#checker): paste an email, text or voice note transcript. Kinhold highlights
 * each warning sign inside the message, explains it on hover, tap or focus, gives a level and
 * what to do next. It never says a message is safe.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;
  const LEVEL_SYM = { none: ['', 'minus'], low: ['', 'question'], medium: ['warn', 'alert'], high: ['bad', 'alert'] };

  function render(el, ctx) {
    const { esc, data } = A;
    const M = data.messages;
    let exampleChannel = '';
    let exampleLesson = '';

    el.innerHTML =
      '<header class="page-head"><h1>Message checker</h1><p>Paste a suspicious email, text or invoice message. Kinhold looks for the warning signs scammers rely on and shows you exactly where they are. It uses simple, visible rules, so it can miss things. Always check payment requests by phone.</p></header>' +
      '<div class="checker">' +
        '<section class="glass card" aria-labelledby="in-h">' +
          '<div class="card-head"><h2 id="in-h">The message</h2><p>Include the "From:" line if you have it. Nothing you paste leaves this device.</p></div>' +
          '<label class="field">Message<textarea class="input" id="msg" rows="10" placeholder="From: Accounts &lt;accounts@supplier.co.uk&gt;&#10;Subject: Updated bank details&#10;&#10;Hi, please note our bank details have changed…"></textarea></label>' +
          '<label class="field">Who do you usually hear from? <small>Optional. Their usual email address or website, so we can spot lookalikes.</small><input class="input" id="known" placeholder="For example, harbourmillfoods.co.uk" autocomplete="off"></label>' +
          '<div class="hero-actions"><button class="btn btn-primary btn-lg" type="button" id="run">Check the message</button><button class="btn btn-quiet" type="button" id="clear">Clear</button></div>' +
          '<div class="examples"><p class="kicker">Or try an example, from obvious to subtle</p><div class="ex-list">' +
            M.examples.map((e) => '<button type="button" class="ex" data-ex="' + e.id + '"><b>' + esc(e.title) + '</b><span>' + esc(e.channel) + ' · ' + esc(e.difficulty) + '</span></button>').join('') +
          '</div></div>' +
        '</section>' +
        '<section class="result-col" aria-live="polite" id="out"><div class="glass card placeholder">' + A.ill('envelope', { cls: 'big' }) + '<p class="muted">Paste a message or pick an example, and the warning signs will appear here.</p></div></section>' +
      '</div>';

    const msg = el.querySelector('#msg'), known = el.querySelector('#known'), out = el.querySelector('#out');
    msg.addEventListener('input', () => { exampleChannel = ''; exampleLesson = ''; });
    el.querySelector('#clear').addEventListener('click', () => { msg.value = ''; known.value = ''; exampleChannel = ''; exampleLesson = ''; out.innerHTML = '<div class="glass card placeholder">' + A.ill('envelope', { cls: 'big' }) + '<p class="muted">Paste a message or pick an example, and the warning signs will appear here.</p></div>'; msg.focus(); });
    el.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => {
      const e = M.examples.find((x) => x.id === b.dataset.ex);
      msg.value = 'From: ' + e.from + (e.subject ? '\nSubject: ' + e.subject : '') + '\n\n' + e.body;
      known.value = (e.knownSenders || []).join(', ');
      exampleChannel = e.channel; exampleLesson = e.lesson;
      el.querySelectorAll('[data-ex]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      run();
    }));
    el.querySelector('#run').addEventListener('click', run);
    const pre = ctx.route.query.get('ex');
    if (pre) { const b = el.querySelector('[data-ex="' + pre + '"]'); if (b) b.click(); }

    function run() {
      const text = msg.value.trim();
      if (!text) { out.innerHTML = '<div class="glass card"><p class="form-error" role="alert">Paste a message first, or pick an example.</p></div>'; msg.focus(); return; }
      const knownSenders = known.value.split(/[\s,]+/).map((s) => s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^.*@/, '').replace(/\/.*$/, '').trim()).filter(Boolean);
      const res = root.KinholdChecker.analyse({ body: text, channel: exampleChannel, knownSenders });
      out.innerHTML = resultHtml(text, res, exampleLesson);
      wireMarks(out);
      if (matchMedia('(max-width: 980px)').matches) out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function resultHtml(text, res, lesson) {
    const { esc, data } = A, M = data.messages;
    const level = M.levels[res.level];
    const signals = res.signals.map((id) => M.signals.find((s) => s.id === id));
    const number = Object.fromEntries(res.signals.map((s, i) => [s, i + 1]));
    // Highlight in the text: matches inside the message (the From line is part of it when pasted).
    const spans = res.matches.filter((m) => m.field === 'body' && !m.overlap).sort((a, b) => a.start - b.start);
    let html = '', at = 0;
    spans.forEach((m, i) => {
      html += esc(text.slice(at, m.start));
      html += '<mark tabindex="0" class="sig" data-tip="t' + i + '" aria-describedby="t' + i + '"><sup aria-hidden="true">' + number[m.signal] + '</sup>' + esc(text.slice(m.start, m.end)) +
        '<span class="tip" role="tooltip" id="t' + i + '"><b>' + esc(M.signals.find((s) => s.id === m.signal).label) + '</b>' + esc(m.reason) + '</span></mark>';
      at = m.end;
    });
    html += esc(text.slice(at));
    // Sender-level signs (lookalike address, personal email) are flagged on the domain itself.
    res.matches.filter((m) => m.field === 'from').forEach((m) => {
      html = html.replace(esc(m.text), '<mark tabindex="0" class="sig" data-tip="tf" aria-describedby="tf"><sup aria-hidden="true">' + number[m.signal] + '</sup>' + esc(m.text) + '<span class="tip" role="tooltip" id="tf"><b>' + esc(M.signals.find((s) => s.id === m.signal).label) + '</b>' + esc(m.reason) + '</span></mark>');
    });
    const [tone, sym] = LEVEL_SYM[res.level];
    return '<div class="glass card verdict ' + res.level + '">' +
        '<p class="kicker">Result</p>' +
        '<h2 class="verdict-h">' + A.status(level.label, tone, sym).replace('class="status', 'class="status big') + '</h2>' +
        '<p>' + esc(res.level === 'none' ? M.noSignsText : level.advice) + '</p>' +
        (lesson ? '<p class="lesson"><b>What this example teaches.</b> ' + esc(lesson) + '</p>' : '') +
      '</div>' +
      '<div class="glass card"><div class="card-head"><h2>The message, with warning signs highlighted</h2><p>' + (spans.length ? 'Hover, tap or tab to each highlight to see why.' : 'Nothing was highlighted.') + '</p></div><div class="msg-view" tabindex="0" aria-label="Your message with warning signs highlighted">' + html + '</div></div>' +
      (signals.length ? '<div class="glass card"><div class="card-head"><h2>' + signals.length + ' warning ' + (signals.length === 1 ? 'sign' : 'signs') + ' found</h2></div><ol class="signs">' +
        signals.map((s) => '<li><span class="sign-n" aria-hidden="true">' + number[s.id] + '</span><div><h3>' + esc(s.label) + '</h3><p>' + esc(s.explain) + '</p><p><b>What to do:</b> ' + esc(s.action) + '</p><p class="src">Guidance: ' + A.sourceLinks(s.sources) + '</p></div></li>').join('') + '</ol></div>' : '') +
      '<div class="glass card next"><h2>If you\'re unsure</h2><ul>' +
        '<li>Contact the sender using details you already have, not the ones in the message.</li>' +
        '<li>Forward scam emails to <b>report@phishing.gov.uk</b>. Forward scam texts to <b>7726</b>.</li>' +
        '<li>If you\'ve already paid, call your bank straight away, then Report Fraud on <b>0300 123 2040</b>.</li>' +
      '</ul><p class="src">Guidance: ' + A.sourceLinks(['ncsc-report-email', 'report-fraud', 'ncsc-payfraud']) + '</p></div>';
  }

  // One shared tooltip, placed next to the highlight and kept inside the screen. Shows on hover and
  // focus, toggles on tap, closes with Escape or on scroll.
  function wireMarks(out) {
    let tip = document.getElementById('sig-tip');
    if (!tip) {
      tip = document.createElement('div'); tip.id = 'sig-tip'; tip.className = 'sig-tip'; tip.setAttribute('aria-hidden', 'true'); tip.hidden = true; document.body.appendChild(tip);
      const close = () => { tip.hidden = true; tip.pinned = null; };
      addEventListener('scroll', close, { passive: true, capture: true });
      addEventListener('hashchange', close);
    }
    const show = (m) => {
      tip.innerHTML = m.querySelector('.tip').innerHTML; tip.hidden = false;
      const r = m.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      const left = Math.max(12, Math.min(r.left, innerWidth - w - 12));
      const top = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    };
    const hide = () => { tip.hidden = true; tip.pinned = null; };
    out.querySelectorAll('mark.sig').forEach((m) => {
      m.addEventListener('mouseenter', () => show(m));
      m.addEventListener('mouseleave', () => { if (tip.pinned !== m) hide(); });
      m.addEventListener('focus', () => show(m));
      m.addEventListener('blur', () => { if (tip.pinned !== m) hide(); });
      m.addEventListener('click', () => { if (tip.pinned === m) hide(); else { tip.pinned = m; show(m); } });
      m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hide(); m.blur(); } });
    });
  }

  A.register('checker', { render });
})(window);
