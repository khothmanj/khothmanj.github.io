/*
 * Case study (last tab, #case-study). Tenor's colours, no violet or gold.
 * The one animation on the page is the live demo: the same plan in Simple and Investor language, with a what-if.
 */
(function (root) {
  'use strict';
  const A = root.TenorApp, E = root.TenorEngine, N = root.TenorNarrative, C = root.TenorCharts;
  const { $, $$, esc } = A;
  const DEMOS = [
    ['rw-exim-india-irrigation', 'Exim-financed irrigation'],
    ['ng-ulesson-seed', 'Seed-funded edtech'],
    ['ng-electrification-minigrids', 'DFI-backed solar mini-grids'],
  ];

  function view(el) {
    document.title = 'Case study · Tenor';
    const D = A.data;
    const state = { id: DEMOS[0][0], mode: 'simple', scen: false };
    let chart = null;
    A.cleanup = () => { if (chart) chart.destroy(); };

    el.innerHTML = '<article class="page cs">' +
      '<header class="cs-hero"><p class="cs-kicker">Case study · Tenor</p><h1>A financial model a lender can test and a founder can read.</h1>' +
      '<p class="lede">Tenor turns a project\'s story and a few numbers into a linked Excel model, a report and a deck. It is a portfolio version of the AI-assisted modelling tool I built at Cape Mano Group, rebuilt with public case data.</p></header>' +

      '<section class="cs-demo" aria-labelledby="demo-h"><div class="cs-demo-head"><h2 id="demo-h">One plan, two languages</h2>' +
      '<div class="cs-demo-controls"><label class="visually-hidden" for="demo-case">Example</label><div class="input-wrap"><select id="demo-case">' + DEMOS.map(([id, l]) => '<option value="' + id + '">' + esc(l) + '</option>').join('') + '</select></div>' +
      '<div class="toggle" role="group" aria-label="View"><button type="button" data-dmode="simple" aria-pressed="true">Simple view</button><button type="button" data-dmode="investor" aria-pressed="false">Investor view</button></div>' +
      '<button type="button" class="btn" id="demo-scen" aria-pressed="false">Selling 20% less</button></div></div>' +
      '<div class="cs-demo-body"><dl class="cs-figs" id="demo-figs"></dl><div class="cs-chart"><div class="chart-wrap" style="height:240px"><canvas id="demo-chart" role="img" aria-label="Cash left each year for the selected example"></canvas></div><p class="chart-note" id="demo-note"></p></div></div>' +
      '<p class="small muted">Live: the same engine as the app, running on a real case from the library. <a href="#projects">Open the full app</a></p></section>' +

      '<dl class="cs-meta"><div><dt>My role</dt><dd>I designed and built the original in-house tool at Cape Mano Group and defined what a "ready" model needs.</dd></div>' +
      '<div><dt>Context</dt><dd>Investment proposals for agriculture, energy, petroleum and technology projects, prepared for banks, DFIs and investors.</dd></div>' +
      '<div><dt>This version</dt><dd>Prototype with a fictional brand. 17 real cases from public sources; anything Tenor had to estimate is labelled.</dd></div></dl>' +

      '<section class="cs-sec"><h2>The problem</h2><ol class="cs-problem">' +
      '<li><strong>Days per project.</strong> Building an investor-ready model for each new project took days of manual work.</li>' +
      '<li><strong>Different numbers from different people.</strong> Assumptions varied between analysts, so two models of similar projects could disagree for no good reason.</li>' +
      '<li><strong>Models nobody could read.</strong> Many entrepreneurs could not read the models they were given, so they could not defend them in front of a lender.</li></ol></section>' +

      '<section class="cs-sec"><h2>Who it is for</h2><div class="cs-who">' +
      '<div><h3>The entrepreneur</h3><p>Plain language, small steps and reassurance that estimates are fine to start with. Every finance term is explained in one line the first time it appears. "What this means" answers the real question: can I repay this loan?</p><a href="#projects">Start a plan</a></div>' +
      '<div><h3>The lender or investor</h3><p>The Investor view shows DSCR, LLCR, IRR, NPV, payback and gearing up front. Every assumption says whether it is sourced, derived or assumed. What-ifs show what breaks first.</p><a href="#library">See the case library</a></div>' +
      '<div><h3>The analyst</h3><p>A real Excel model with live formulas linked across 19 sheets, named inputs and TRUE or FALSE checks. Starting from a similar past project saves the first day of work.</p><a href="#method">How it works</a></div></div></section>' +

      '<section class="cs-sec"><h2>What I built</h2><ul class="cs-built">' +
      '<li><a href="#new">Sector-adaptive intake</a><span>Four steps. The questions, units and sales formula change with the sector, with a live estimate as you type.</span></li>' +
      '<li><a href="#new">Context reader</a><span>Paste text or upload a PDF, Word, Excel or CSV file. Rule-based extraction shows each fact next to the sentence it came from, and nothing is used until confirmed.</span></li>' +
      '<li><a href="#library">Case library and matching</a><span>17 real projects. Similar projects are scored in the open, and typical ranges use only sourced or derived figures.</span></li>' +
      '<li><a href="#projects" data-demo-open="1">Results and what-ifs</a><span>Headline figures with "Explain this number", Simple and Investor views, and what-ifs that keep the loans fixed so Excel can reproduce them.</span></li>' +
      '<li><a href="#projects" data-demo-open="1">Excel, Word, deck and CSV</a><span>All built in the browser. Every Excel cell traces back to the Inputs sheet and is checked against the engine.</span></li></ul></section>' +

      '<section class="cs-sec cs-decisions"><h2>Key decisions and trade-offs</h2>' +
      dec('Learn from past projects instead of starting from a blank sheet', 'A blank model is where most of the time went. Starting from the closest real project, with its structure and cost lines, removes the first day of work and makes the assumptions comparable.', 'Matching is transparent scoring, not machine learning. It explains itself, but it only knows 17 projects, so ranges are thin in some sectors and Tenor says so.') +
      dec('Every assumption shows whether it is sourced, derived or assumed', 'A lender\'s first question is "where did this number come from?" Labelling every figure answers it before it is asked and stops estimates passing as facts.', 'It exposes how much is estimated. Some real cases are under 20% sourced. I chose to show that rather than fill gaps quietly.') +
      dec('The user confirms every extracted fact', 'Reading a term sheet wrongly is worse than not reading it. Each finding sits next to the sentence it came from, and nothing enters the model until it is ticked.', 'One extra step for the user, in exchange for no silent errors.') +
      dec('Simple and Investor views of the same numbers', 'The entrepreneur and the lender need the same model but different words. One toggle changes the language and depth, never the numbers, so both are looking at the same thing.', 'Two sets of labels and summaries to maintain for every figure.') +
      dec('The Excel output keeps live formulas linked across sheets', 'Analysts do not trust numbers they cannot change. Every cell traces to the Inputs sheet, uses standard functions only, and was recalculated in LibreOffice and matched to the engine, 59,319 cells with no differences.', 'No circular references, so no interest on cash and no loans sized to a target ratio. What-ifs keep the build and the loans fixed so they stay live in Excel.') +
      dec('Outputs match how each audience works', 'Analysts get the model, funders get a report they can circulate, meetings get a deck with editable charts and speaker notes, and other tools get CSV.', 'Four builders to keep in step with one engine. They all read the same results, so a change in the engine flows to every file.') +
      '</section>' +

      '<section class="cs-sec"><h2>Results from the original tool</h2><div class="cs-results"><div><span class="cs-big">~70%</span><span>less time spent preparing models by hand</span></div><div><span class="cs-big">$70M+</span><span>of investment-ready proposals it supported, across 6 projects and 4 sectors</span></div></div>' +
      '<p class="small muted">From the in-house tool at Cape Mano Group, not this prototype. No client data is used here.</p></section>' +

      '<section class="cs-sec"><h2>What I would do next</h2><ul class="cs-next"><li><strong>Live FX and commodity prices</strong>, so price and currency what-ifs start from today\'s market rather than a fixed assumption.</li><li><strong>Side-by-side scenario comparison</strong>, so a founder can compare a bank loan with an Exim facility on one screen.</li><li><strong>Team-shared case libraries</strong>, so an advisory team builds its own benchmarks from the projects it has closed.</li></ul></section>' +

      '<footer class="cs-foot"><a class="btn" href="../">Back to the portfolio</a><a class="btn btn-primary" href="#projects">Open the app</a></footer></article>';

    function dec(title, why, trade) {
      return '<div class="cs-dec"><h3>' + esc(title) + '</h3><p>' + esc(why) + '</p><p class="cs-trade"><span>Trade-off</span> ' + esc(trade) + '</p></div>';
    }

    /* ---------- live demo ---------- */
    function demo(animate) {
      const c = D.cases.find((x) => x.id === state.id);
      const input = root.TenorAdapter.caseToInput(c, D.sectors, D.defaults);
      const m = E.run(input);
      const sens = E.sensitivities(input, m);
      const sc = sens.results.find((r) => r.id === 'volume_20');
      const k = m.kpis, cur = input.currency, st = k.steadyYear;
      const rows = state.scen ? sc.rows : null;
      const sales = rows ? rows.revenue[st] : m.out.revenue[st];
      const simple = state.mode === 'simple';
      const hasLoan = m.loans.length > 0;
      const figs = simple
        ? [['Expected yearly sales', N.money(sales, cur)], hasLoan ? ['Loan cover in the tightest year', N.ratio(rows ? sc.result.dscrMin : k.dscrMin)] : ['Lowest cash balance', N.money(rows ? sc.result.lowestCash : k.lowestCash, cur)], ['Value today of future cash', N.money(rows ? sc.result.npv : k.npv, cur)]]
        : [['Revenue (' + m.years[st - 1] + ')', N.money(sales, cur)], hasLoan ? ['Minimum DSCR', N.ratio(rows ? sc.result.dscrMin : k.dscrMin)] : ['Lowest cash', N.money(rows ? sc.result.lowestCash : k.lowestCash, cur)], ['NPV at ' + N.pct(k.discountRate, 0), N.money(rows ? sc.result.npv : k.npv, cur)]];
      $('#demo-figs', el).innerHTML = figs.map(([a, b]) => '<div><dt>' + esc(a) + '</dt><dd>' + esc(b) + '</dd></div>').join('');
      const sum = N.summary({ input, model: m, sens }, simple ? 'simple' : 'investor');
      $('#demo-note', el).textContent = state.scen ? (simple ? 'Selling 20% less' : 'Volume 20% lower') + ': value changes by ' + N.money(sc.delta.npv, cur) + '.' : sum.headline;
      if (chart) chart.destroy();
      if (typeof Chart !== 'undefined') {
        chart = C.cashArea($('#demo-chart', el), m, cur, rows ? rows.cashAfterDebt : null);
        if (!animate) chart.options.animation = false;
      }
    }
    demo(false);
    $('#demo-case', el).addEventListener('change', (e) => { state.id = e.target.value; state.scen = false; $('#demo-scen', el).setAttribute('aria-pressed', 'false'); demo(true); });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button, a'); if (!b) return;
      if (b.dataset.dmode) { state.mode = b.dataset.dmode; $$('[data-dmode]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); demo(false); }
      else if (b.id === 'demo-scen') { state.scen = !state.scen; b.setAttribute('aria-pressed', String(state.scen)); demo(true); }
      else if (b.dataset.demoOpen) { e.preventDefault(); A.openExample(state.id); }
    });
    window.addEventListener('tenor:theme', () => { if (location.hash === '#case-study') demo(false); }, { once: true });
  }

  A.views.caseStudy = view;
})(typeof self !== 'undefined' ? self : this);
