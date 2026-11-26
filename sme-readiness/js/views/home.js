/* Home (#home): a plain explanation, a way in, a sample to explore, and where to go next. */
(function (root) {
  'use strict';
  const A = root.KinholdApp;

  function render(el) {
    const { esc, data, store } = A;
    const s = store.get();
    const S = root.KinholdScoring;
    const total = s.profile ? S.applicable(data.questions.questions, s.profile).length : 0;
    const answered = s.profile ? Object.keys(s.answers).filter((id) => S.applicable(data.questions.questions, s.profile).some((q) => q.id === id)).length : 0;
    const inProgress = s.profile && answered > 0 && answered < total;
    const finished = s.profile && answered === total && total > 0;
    const stat = data.benchmarks.context.find((b) => b.id === 'breach-all');
    const src = data.sourceById[data.benchmarks.source];

    el.innerHTML =
      '<section class="hero glass" aria-labelledby="home-h">' +
        '<div class="hero-text">' +
          '<p class="kicker">For small UK businesses, 2 to 50 people</p>' +
          '<h1 id="home-h" class="serif">See how well protected your business is, in about 15 minutes.</h1>' +
          '<p class="lede">Kinhold checks how exposed you are to scams, hacking and fraud, and whether your team uses AI tools safely. Then it gives you a short, plain-English plan, with free steps you can take today.</p>' +
          '<div class="hero-actions">' +
            (finished ? '<a class="btn btn-primary btn-lg" href="#results">See your results</a><a class="btn btn-lg" href="#check/start">Start a new check</a>'
              : inProgress ? '<a class="btn btn-primary btn-lg" href="#check">Continue your check</a><span class="muted progress-note">' + answered + ' of ' + total + ' answered</span>'
              : '<a class="btn btn-primary btn-lg" href="#check/start">Start the 15-minute check</a><button type="button" class="btn btn-lg" id="sample">Try a sample business</button>') +
          '</div>' +
          '<p class="note"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>Free, no sign-up. Your answers stay on this device.</p>' +
        '</div>' +
        '<div class="hero-art" aria-hidden="true">' + A.ill('shield', { cls: 'big' }) + A.ill('key', { cls: 'float f1' }) + A.ill('envelope', { cls: 'float f2' }) + A.ill('speech-lock', { cls: 'float f3' }) + '</div>' +
      '</section>' +
      '<nav class="try glass" aria-label="Try these"><p>Try these</p>' +
        '<a href="#check/start">Take the 15-minute check</a><a href="#checker">Test a suspicious message</a><a href="#adviser">See an adviser\'s client view</a></nav>' +
      '<section class="bento" aria-label="What Kinhold does">' +
        '<a class="tile glass t-wide" href="#check/start">' + A.ill('badge') + '<div><h2>A guided check</h2><p>About 40 plain questions across 14 areas, from passwords and backups to invoice fraud and AI tools. "Not sure" is always fine.</p></div></a>' +
        '<div class="tile glass t-stat"><p class="stat"><b>' + stat.value + stat.unit + '</b> ' + esc(stat.text) + '</p><p class="muted small">Source: <a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.title) + '</a></p></div>' +
        '<a class="tile glass" href="#results">' + A.ill('sparkle') + '<div><h2>A level, not a scary score</h2><p>See what you already do well, then your five most useful next steps.</p></div></a>' +
        '<a class="tile glass" href="#toolkit">' + A.ill('document') + '<div><h2>Ready-made templates</h2><p>An AI use policy, a payment check procedure and more, with your business name in.</p></div></a>' +
        '<a class="tile glass" href="#training">' + A.ill('speech-check') + '<div><h2>3-minute staff training</h2><p>Spot the fake invoice, the phishing email and the fake call from the boss.</p></div></a>' +
      '</section>' +
      '<p class="note"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg>Kinhold gives guidance based on NCSC, ICO and UK government advice. It is not legal advice or a certification, and it never says a business is "compliant" or "certified".</p>';

    const sample = el.querySelector('#sample');
    if (sample) sample.addEventListener('click', () => { A.loadSample('brightloaf'); A.go('#results'); });
  }

  A.register('home', { render });
})(window);
