/*
 * Case study (#case-study), always the last tab. The demo runs the real message checker on one
 * example and reveals each warning sign in turn: the page's one animation, shown complete when
 * reduced motion is on. Results use CV facts only.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;
  const EXAMPLE = 'm2';

  function render(el) {
    const { esc, data } = A;
    const ctx = Object.fromEntries(data.benchmarks.context.map((c) => [c.id, c]));
    const MODULES = [
      ['check/start', 'padlock', 'The readiness check', 'Up to 43 plain questions across 14 areas, cyber, fraud and AI, in about 15 minutes. One question at a time on a phone.'],
      ['results', 'shield', 'Results', 'A level instead of a scary score, what you already do well, and the five actions worth the most.'],
      ['plan', 'document', 'Action plan', 'Every gap in a 30, 60 or 90 day phase with an owner, progress that fills in, and a re-check that shows what improved.'],
      ['checker', 'speech-check', 'Message checker', 'Paste a suspicious email and see each warning sign highlighted inside it, with what to do next.'],
      ['toolkit', 'invoice', 'Toolkit', 'An AI use policy, payment procedure, incident one-pager and staff checklist, filled in as you type and downloaded as Word.'],
      ['training', 'badge', 'Staff training', 'Four three-minute, hands-on modules that end in a named certificate.'],
      ['adviser', 'storefront', 'Adviser view', 'Client list, side-by-side checks and a Word report for advisers supporting several businesses.'],
      ['method', 'sparkle', 'How it works', 'Every rule, weight and source in the open, with the date each source was checked.'],
    ];
    const DECISIONS = [
      ['Guidance first, every claim sourced', 'Every question, recommendation and warning sign links to the NCSC, the ICO, Stop! Think Fraud or the Payment Systems Regulator. I opened each source and checked it says what Kinhold uses it for.', 'Content took longer than the code, and some well-known sources were dropped because I couldn\'t open them to check.'],
      ['Levels, not a scary score', 'Owners see "Getting started", "Building", "Solid" or "Strong", with what they already do well shown first. A score out of 100 is still there for advisers.', 'Levels hide small improvements, so the plan and re-check show the point change as well.'],
      ['Two essentials hold the level', 'Without 2-step verification on email and a call-back rule for bank detail changes, the level can\'t go above Building. These two stop the most common ways small businesses lose money.', 'A business that is strong everywhere else can feel judged harshly. The results say exactly which essential is missing and that it\'s free and takes minutes.'],
      ['Ranked by risk removed for the effort', 'Priority is risk divided by effort, with time and cost shown on every action, so a 10-minute free fix beats a weekend project.', 'Simple and explainable rather than clever. Two actions with the same score fall back to cost and time, which an expert might order differently.'],
      ['AI is part of security, not a separate topic', 'Five of the 14 areas are about AI: which tools are used, what goes into them, who checks the output, the rules, and AI-powered scams.', 'A longer check. Questions that don\'t apply, like the chatbot ones, are skipped.'],
      ['"Not sure" is a gap, said gently', 'If you can\'t confirm something is in place you can\'t rely on it, so it counts as a gap. The results say this is common and give steps to find out.', 'Scores can look lower than people expect, which is why the language around them is kind.'],
      ['The checker never says "safe"', 'With no signs found it says "No common warning signs found, but always verify payment requests by phone." Visible rules can miss a well-made scam, and the call back is the real protection.', 'Less reassuring than a green tick. That is deliberate.'],
      ['No AI model, no data leaves the device', 'Scoring, ranking, summaries and the checker are transparent rules, all shown on the method page. Answers stay in the browser.', 'It can\'t read intent the way a language model might. In exchange it is free, consistent, and safe to use with real business details.'],
    ];

    el.innerHTML =
      '<article class="cs">' +
      '<header class="cs-hero glass"><div class="cs-hero-text">' +
        '<p class="kicker">Case study · Kinhold</p>' +
        '<h1 class="cs-title">A 15-minute check that turns UK guidance into a plan a small business will actually follow.</h1>' +
        '<p class="cs-lede">Small businesses are targeted by invoice fraud and phishing but rarely have anyone looking after security, and staff are now using AI tools with no rules. Kinhold checks where a business stands on cyber, fraud and AI, then gives a short, ranked plan, ready-made templates, staff training and a message checker.</p>' +
        '<div class="hero-actions"><a class="btn btn-primary btn-lg" href="#check/start">Take the check</a><a class="btn btn-lg" href="#checker?ex=' + EXAMPLE + '">Test a suspicious message</a><a class="btn btn-quiet" href="#adviser">See an adviser\'s client view</a></div>' +
      '</div><div class="cs-hero-art" aria-hidden="true">' + A.ill('shield', { cls: 'a1' }) + A.ill('invoice', { cls: 'a2' }) + A.ill('speech-check', { cls: 'a3' }) + A.ill('key', { cls: 'a4' }) + '</div></header>' +

      '<section class="cs-sec" aria-labelledby="cs-demo-h"><h2 class="cs-h" id="cs-demo-h">The moment it earns trust: showing exactly why a message is a scam.</h2>' +
        '<p class="cs-p">This is the real message checker running on one of Kinhold\'s examples. It doesn\'t just give a verdict, it shows each warning sign in the message itself, so staff learn what to look for next time.</p>' +
        '<div class="cs-demo glass" id="demo"></div>' +
      '</section>' +

      '<section class="cs-sec cs-role" aria-labelledby="cs-role-h"><h2 class="cs-h" id="cs-role-h">Based on a fraud review I carried out for a UK retailer.</h2>' +
        '<dl class="cs-facts">' +
          '<div><dt>My role</dt><dd>Product, research, content and build. I wrote the questions, recommendations and rules from UK guidance, designed the flows and built the prototype.</dd></div>' +
          '<div><dt>Where it comes from</dt><dd>During an internship at a UK retailer in autumn 2026, I reviewed payment and access controls after a fraud incident. My MSc dissertation at the University of Salford is on cybersecurity, payment fraud and AI-enabled controls in UK SMEs.</dd></div>' +
          '<div><dt>This prototype</dt><dd>Prototype with a fictional brand and sample data. The sample businesses and messages are invented. No details from the real incident are used.</dd></div>' +
        '</dl></section>' +

      '<section class="cs-sec" aria-labelledby="cs-prob-h"><h2 class="cs-h" id="cs-prob-h">The guidance exists. Small businesses just don\'t get to it.</h2>' +
        '<ol class="cs-problems">' +
          '<li><b>Targeted, but on their own.</b> ' + esc(ctx['breach-micro'].value + ctx['breach-micro'].unit + ' ' + ctx['breach-micro'].text) + ' Only ' + esc(ctx['it-role-micro'].value + ctx['it-role-micro'].unit + ' ' + ctx['it-role-micro'].text.replace(/\.$/, '')) + '.</li>' +
          '<li><b>AI arrived without rules.</b> Staff paste customer emails and documents into free AI tools to save time, with no guidance on what\'s safe. And AI makes scam emails and voices more convincing.</li>' +
          '<li><b>A few simple controls would have stopped it.</b> In the incident I reviewed, the fix wasn\'t expensive software. It was 2-step verification, the right access for each person, and a habit of checking payment changes by phone.</li>' +
        '</ol><p class="src">Survey figures: ' + A.sourceLinks(['dsit-csbs']) + '</p></section>' +

      '<section class="cs-sec" aria-labelledby="cs-who-h"><h2 class="cs-h" id="cs-who-h">Three people use it, so it\'s designed three ways.</h2>' +
        '<div class="cs-who">' +
          '<div class="glass"><h3>The owner</h3><p>Anxious, short on time, often on a phone. One question per screen, "Not sure" always allowed, a level instead of a score, what\'s already good shown first, and a plan in plain English.</p></div>' +
          '<div class="glass"><h3>Staff</h3><p>Need habits, not policies. Three-minute hands-on training, a message checker that teaches as it flags, and a one-page checklist for joining and leaving.</p></div>' +
          '<div class="glass"><h3>The adviser</h3><p>Supports several businesses. A client list, side-by-side checks to show progress, and a Word report they can hand over.</p></div>' +
        '</div></section>' +

      '<section class="cs-sec" aria-labelledby="cs-built-h"><h2 class="cs-h" id="cs-built-h">What I built.</h2>' +
        '<div class="cs-modules">' + MODULES.map(([href, ill, t, d]) => '<a class="cs-mod glass" href="#' + href + '">' + A.ill(ill) + '<span><b>' + esc(t) + '</b><span>' + esc(d) + '</span></span></a>').join('') + '</div></section>' +

      '<section class="cs-sec" aria-labelledby="cs-dec-h"><h2 class="cs-h" id="cs-dec-h">The decisions that matter, and what they cost.</h2>' +
        '<div class="cs-decisions">' + DECISIONS.map(([t, why, cost], i) => '<details class="cs-dec glass"' + (i < 2 ? ' open' : '') + '><summary><span class="cs-n" aria-hidden="true">' + (i + 1) + '</span>' + esc(t) + '</summary><p>' + esc(why) + '</p><p class="cs-cost"><b>Trade-off.</b> ' + esc(cost) + '</p></details>').join('') + '</div></section>' +

      '<section class="cs-sec" aria-labelledby="cs-res-h"><h2 class="cs-h" id="cs-res-h">What the original work achieved.</h2>' +
        '<ul class="cs-results">' +
          '<li>Reviewed payment and access controls after a fraud incident at a UK retailer.</li>' +
          '<li>Recommended tiered access, 2-step verification and GDPR-aligned data handling.</li>' +
          '<li>Developed a fraud detection and awareness framework that other UK SMEs can reuse. Kinhold turns that framework into a product.</li>' +
        '</ul>' +
        '<p class="cs-p muted">Kinhold itself hasn\'t been piloted yet, so there are no usage numbers. The next step is to get some.</p></section>' +

      '<section class="cs-sec" aria-labelledby="cs-next-h"><h2 class="cs-h" id="cs-next-h">What I\'d do next.</h2>' +
        '<ul class="cs-next">' +
          '<li><b>Pilot with a small group of businesses</b> and measure the one number that matters: how many plan actions get done in 90 days.</li>' +
          '<li><b>Add reminders</b> for re-checks every six months and for steps left in the current phase.</li>' +
          '<li><b>Let a business share its check with an adviser</b>, so the adviser view uses real answers instead of samples.</li>' +
          '<li><b>Test with owners who aren\'t confident with technology</b>, on their own phones, and simplify any question they stumble on.</li>' +
        '</ul></section>' +

      '<footer class="cs-foot"><a class="btn" href="../"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>Back to the portfolio</a><span class="muted small">Prototype with a fictional brand and sample data.</span></footer>' +
      '</article>';

    demo(el.querySelector('#demo'));
  }

  /* ---------- the demo: reveal each warning sign in turn ---------- */
  function demo(box) {
    const { esc, data } = A, M = data.messages;
    const e = M.examples.find((x) => x.id === EXAMPLE);
    const text = 'From: ' + e.from + '\nSubject: ' + e.subject + '\n\n' + e.body;
    const res = root.KinholdChecker.analyse({ body: text, knownSenders: e.knownSenders || [] });
    const number = Object.fromEntries(res.signals.map((s, i) => [s, i + 1]));
    const label = (id) => M.signals.find((s) => s.id === id).label;
    // One list of highlights in reading order, sender address included.
    const marks = res.matches.filter((m) => m.field === 'body' && !m.overlap).map((m) => ({ start: m.start, end: m.end, signal: m.signal }));
    res.matches.filter((m) => m.field === 'from').forEach((m) => { const at = text.indexOf(m.text); if (at >= 0) marks.push({ start: at, end: at + m.text.length, signal: m.signal }); });
    marks.sort((a, b) => a.start - b.start);
    let html = '', at = 0;
    marks.forEach((m, i) => { html += esc(text.slice(at, m.start)) + '<mark class="sig cs-mark" data-i="' + i + '" data-sig="' + m.signal + '"><sup aria-hidden="true">' + number[m.signal] + '</sup>' + esc(text.slice(m.start, m.end)) + '</mark>'; at = m.end; });
    html += esc(text.slice(at));
    const level = M.levels[res.level];

    box.innerHTML =
      '<div class="cs-demo-msg"><p class="kicker">' + esc(e.channel) + ' · sample message</p><div class="msg-view">' + html + '</div></div>' +
      '<div class="cs-demo-side"><ol class="cs-signs">' + res.signals.map((s) => '<li data-sig="' + s + '"><span class="sign-n" aria-hidden="true">' + number[s] + '</span>' + esc(label(s)) + '</li>').join('') + '</ol>' +
        '<p class="cs-verdict">' + A.status(level.label, 'bad', 'alert').replace('class="status', 'class="status big') + '</p>' +
        '<div class="cs-demo-actions"><button class="btn" type="button" id="replay"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 3v3h3"/></svg>Play again</button><a href="#checker?ex=' + EXAMPLE + '">Open it in the checker</a></div></div>';

    const ms = [...box.querySelectorAll('.cs-mark')], items = [...box.querySelectorAll('.cs-signs li')], verdict = box.querySelector('.cs-verdict');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timers = [];
    const showAll = () => { ms.forEach((m) => m.classList.add('on')); items.forEach((li) => li.classList.add('on')); verdict.classList.add('on'); };
    const play = () => {
      timers.forEach(clearTimeout); timers = [];
      ms.forEach((m) => m.classList.remove('on')); items.forEach((li) => li.classList.remove('on')); verdict.classList.remove('on');
      if (reduced) return showAll();
      ms.forEach((m, i) => timers.push(setTimeout(() => {
        m.classList.add('on');
        const li = box.querySelector('.cs-signs li[data-sig="' + m.dataset.sig + '"]'); if (li) li.classList.add('on');
      }, 600 + i * 750)));
      timers.push(setTimeout(() => verdict.classList.add('on'), 600 + ms.length * 750 + 200));
    };
    box.querySelector('#replay').addEventListener('click', play);
    // Start when the demo scrolls into view, once.
    if ('IntersectionObserver' in root && !reduced) {
      const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { io.disconnect(); play(); } }, { threshold: 0.4 });
      io.observe(box);
    } else showAll();
    addEventListener('hashchange', () => timers.forEach(clearTimeout), { once: true });
  }

  A.register('case-study', { render });
})(window);
