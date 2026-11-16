/*
 * Landing page (#home): a short, plain explanation of Tenor with a clear way in.
 */
(function (root) {
  'use strict';
  const A = root.TenorApp;

  const I = (body) => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  const ICON = {
    browser: I('<rect class="duo" x="3.5" y="5" width="17" height="14" rx="3"/><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 9h17M7 7h.01M9.5 7h.01"/>'),
    cases: I('<path class="duo" d="M5 4.5h4v15H5zM10 4.5h4v15h-4z"/><path d="M5 4.5h4v15H5zM10 4.5h4v15h-4zM15.2 5.6l3.8-1 3.4 14.2-3.8 1z"/>'),
    lock: I('<rect class="duo" x="5" y="10.5" width="14" height="9.5" rx="2.5"/><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    doc: I('<path class="duo" d="M6.5 3.5h7.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-14a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M6.5 3.5h7.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-14a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h4.5"/>'),
    sliders: I('<circle class="duo" cx="9" cy="8" r="2.5"/><circle class="duo" cx="15" cy="16" r="2.5"/><path d="M4 8h2.5M11.5 8H20M4 16h8.5M17.5 16H20"/><circle cx="9" cy="8" r="2.5"/><circle cx="15" cy="16" r="2.5"/>'),
    chart: I('<path class="duo" d="M4 19.5h16V6.5z"/><path d="M4 19.5h16M6 16l4-4.5 3 2.5 5.5-7"/><circle cx="18.5" cy="7" r="1.3"/>'),
    person: I('<circle class="duo" cx="12" cy="8" r="3.5"/><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>'),
    bank: I('<path class="duo" d="M4 9.5L12 5l8 4.5z"/><path d="M4 9.5L12 5l8 4.5zM5.5 10v7M9.5 10v7M14.5 10v7M18.5 10v7M4 19.5h16"/>'),
    grid: I('<rect class="duo" x="4" y="4" width="16" height="16" rx="3"/><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9.5h16M4 14.5h16M9.5 4v16"/>'),
  };

  /* Small product previews built in HTML, so they stay sharp and follow the theme. */
  const MOCK = {
    excel: '<div class="mock mock-sheet" aria-hidden="true">' + Array.from({ length: 24 }, (_, i) => '<span class="' + (i < 4 ? 'h' : i % 4 === 0 ? 'l' : [5, 10, 15, 22].includes(i) ? 'b' : '') + '"></span>').join('') + '</div>',
    word: '<div class="mock mock-doc" aria-hidden="true"><div class="page back"></div><div class="page"><i class="t"></i><i></i><i class="s"></i><div class="bars"><b style="height:40%"></b><b style="height:62%"></b><b style="height:55%"></b><b style="height:80%"></b></div><i></i><i class="s"></i></div></div>',
    deck: '<div class="mock mock-slide" aria-hidden="true"><i class="t"></i><div class="bars"><b style="height:30%"></b><b style="height:45%"></b><b style="height:42%"></b><b style="height:64%"></b><b style="height:78%"></b><b style="height:96%"></b></div></div>',
    csv: '<div class="mock mock-csv" aria-hidden="true"><code>year,sales,costs</code><code>2028,18.1m,8.3m</code><code>2029,29.6m,12.1m</code><code>2030,37.9m,15.0m</code></div>',
  };

  function view(el) {
    document.title = 'Tenor · Project finance modeller';
    el.innerHTML = '<div class="page home">' +
      '<section class="home-hero glass" aria-labelledby="home-h">' +
        '<div class="home-hero-text">' +
          '<span class="tag">' + ICON.chart + 'Project finance, made readable</span>' +
          '<h1 id="home-h">Turn a project idea into a financial plan a lender can test.</h1>' +
          '<p class="lede">Describe your project and add a few numbers. Tenor builds the model for you: a linked Excel file, a report, a deck, and the ratios funders ask for.</p>' +
          '<div class="actions"><a class="btn btn-primary btn-lg" href="#new">Start a new plan</a><button type="button" class="btn btn-lg" id="home-example">Try a real example</button></div>' +
          '<ul class="trust"><li>' + ICON.lock + 'No sign-up. Your data stays in this browser.</li><li>' + ICON.cases + 'Learns from 17 real, sourced projects</li></ul>' +
        '</div>' +
        '<figure class="home-hero-art"><img src="img/hero.webp" srcset="img/hero-768.webp 768w, img/hero.webp 1536w" sizes="(max-width: 920px) 92vw, 46vw" width="1536" height="1024" alt="Documents in PDF, Excel, Word and text formats flowing through Tenor into a financial model with charts on a laptop" fetchpriority="high"></figure>' +
      '</section>' +

      '<section class="home-sec" aria-labelledby="how-h"><div class="home-sec-head"><h2 id="how-h">How it works</h2><p class="muted">Three steps, about ten minutes. You can change any number later.</p></div>' +
        '<ol class="steps3">' +
          '<li class="glass"><span class="step-n">1</span><span class="step-ico">' + ICON.doc + '</span><h3>Tell us about the project</h3><p>Write a few lines, or upload a PDF, Word, Excel or CSV file. Tenor picks out the amounts, rates and dates, and you confirm each one.</p></li>' +
          '<li class="glass"><span class="step-n">2</span><span class="step-ico">' + ICON.sliders + '</span><h3>Add your numbers</h3><p>The questions change with your sector. Ranges from similar real projects show where your estimates sit.</p></li>' +
          '<li class="glass"><span class="step-n">3</span><span class="step-ico">' + ICON.chart + '</span><h3>Get your plan</h3><p>See the cash left each year, whether the loan can be repaid and what moves the result most. Then download it.</p></li>' +
        '</ol></section>' +

      '<section class="home-sec" aria-labelledby="get-h"><div class="home-sec-head"><h2 id="get-h">What you get</h2><p class="muted">Four files, built in your browser, each made for the person who will read it.</p></div>' +
        '<div class="outputs">' +
          '<article class="output glass">' + MOCK.excel + '<h3>Excel model</h3><p>19 linked sheets. Change an input and every sheet updates, with checks that show TRUE.</p></article>' +
          '<article class="output glass">' + MOCK.word + '<h3>Word report</h3><p>A business-plan style report with charts, ready for a funding application.</p></article>' +
          '<article class="output glass">' + MOCK.deck + '<h3>Presentation</h3><p>12 slides with editable charts and speaker notes for investor meetings.</p></article>' +
          '<article class="output glass">' + MOCK.csv + '<h3>CSV data</h3><p>Every table as plain values, ready to load into other tools.</p></article>' +
        '</div></section>' +

      '<section class="home-sec" aria-labelledby="who-h"><div class="home-sec-head"><h2 id="who-h">Made for three readers</h2><p class="muted">One set of numbers, explained the way each person needs.</p></div>' +
        '<div class="who3">' +
          '<div class="glass"><span class="step-ico">' + ICON.person + '</span><h3>Founders and farm owners</h3><p>Plain language, small steps and a one-line explanation of every finance term.</p></div>' +
          '<div class="glass"><span class="step-ico">' + ICON.bank + '</span><h3>Lenders and investors</h3><p>DSCR, IRR, NPV and payback up front, with where every assumption came from.</p></div>' +
          '<div class="glass"><span class="step-ico">' + ICON.grid + '</span><h3>Analysts and advisers</h3><p>A real, editable Excel model and a fast start from a similar past project.</p></div>' +
        '</div></section>' +

      '<section class="proof glass" aria-label="Tenor in numbers">' +
        '<div><strong>17</strong><span>real projects from public sources, every figure labelled sourced, derived or assumed</span></div>' +
        '<div><strong>59,319</strong><span>Excel cells checked against the engine, with no differences</span></div>' +
        '<div><strong>11</strong><span>sectors, from rice farms and refineries to fintech and hospitals</span></div>' +
        '<div><strong>0</strong><span>files sent to a server. Everything runs in your browser.</span></div>' +
      '</section>' +

      '<section class="home-cta glass"><div><h2>Ready to see your numbers?</h2><p class="muted">Start from a blank plan, or open a real project and change it.</p></div>' +
        '<div class="actions"><a class="btn btn-primary btn-lg" href="#new">Start a new plan</a><a class="btn btn-lg" href="#library">Browse the case library</a></div></section>' +
      '</div>';
    el.querySelector('#home-example').addEventListener('click', () => A.openExample('ng-olam-rukubi-rice'));
  }

  A.views.home = view;
})(typeof self !== 'undefined' ? self : this);
