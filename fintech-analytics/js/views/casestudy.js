/*
 * Case study (#case-study): the last tab. The product idea, a live demo of its most
 * characteristic moment (a chart and the SQL behind it, re-run as you change a filter),
 * my role, the problem, what I built, the decisions, results from my CV and what next.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, A = root.SignalApp, Q = root.SignalQueries, DB = root.SignalDB, UI = root.SignalSQLUI, esc = K.esc;
  const PLANS = [['', 'All lenders'], ['starter', 'Starter'], ['growth', 'Growth'], ['enterprise', 'Enterprise']];

  const MODULES = [
    ['overview', 'Overview', 'Six headline metrics, three written insights for the month, and where to look next.'],
    ['activation', 'Activation', 'The onboarding funnel, cohorts and why compliance sends lenders back.'],
    ['accounts', 'Accounts to act on', 'Who to call this week, why they are stuck, and who owns the next step.'],
    ['customer/48', 'Customer 360', 'One lender\'s onboarding, usage, errors, billing and tickets, summed up in plain English.'],
    ['usage', 'Usage and spend', 'Revenue by endpoint with product events, concentration and movers.'],
    ['health', 'Integration health', 'Daily error rates against a target, the provider outage and who it hit.'],
    ['integrity', 'Data checks', 'Invoices reconciled with the ledger and with metered usage, each issue owned.'],
    ['insights', 'Insights and PRD', 'A product doc built from the queries, with sizing, an experiment and a roadmap.'],
    ['sql', 'SQL workspace', 'Run any of the ' + root.SignalQueries.list.length + ' saved queries, or write your own, against the real database.'],
  ];

  async function render(el) {
    el.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'cs';
    el.appendChild(page);

    /* 1. Headline */
    page.insertAdjacentHTML('beforeend',
      '<header class="cs-hero sec"><p class="sec-kicker">Case study</p>' +
        '<h1 class="cs-title">Product analytics where every chart is backed by SQL you can run.</h1>' +
        '<p class="cs-lede">Signal is an analytics workspace for Ferrow, a fictional company that sells lending APIs. It shows where lenders get stuck, who to call this week, which integrations are failing and whether billing can be trusted. Then it turns that into a product decision.</p>' +
        '<p class="cs-note">Prototype with a fictional brand and sample data.</p>' +
        '<div class="cs-actions"><a class="btn btn-primary" href="' + A.hrefFor('overview') + '">Open the product</a></div>' +
        '<div class="try cs-try"><p>Try these</p><a href="' + A.hrefFor('activation') + '">See where lenders drop off</a><a href="' + A.hrefFor('sql', { q: 'activation_funnel' }) + '">Open the SQL behind a chart</a><a href="' + A.hrefFor('insights') + '">Read the PRD</a></div>' +
      '</header>');

    /* 2. The characteristic moment: a chart and its SQL, live */
    const demo = document.createElement('section');
    demo.className = 'sec cs-demo';
    demo.setAttribute('aria-labelledby', 'cs-demo-h');
    demo.innerHTML = '<p class="sec-kicker">Try it here</p><h2 class="sec-headline" id="cs-demo-h">Change the filter and watch the SQL change and run again in your browser.</h2>' +
      '<p class="sec-sub">This is the onboarding funnel from the Activation view, for lenders who signed up from November 2024 to July 2026. The query on the right is exactly what produced the bars.</p>' +
      '<div class="seg" role="group" aria-label="Plan">' + PLANS.map(([v, l]) => '<button type="button" data-plan="' + v + '" aria-pressed="' + (v === '') + '">' + l + '</button>').join('') + '</div>' +
      '<div class="cs-demo-grid"><div class="cs-funnel" aria-live="polite"></div><div class="cs-sql"><div class="cs-sql-head"><span class="cs-run" role="status"></span><a class="btn btn-quiet" data-open href="#">Open in SQL workspace</a></div><pre class="code" tabindex="0" aria-label="SQL behind the funnel"><code></code></pre></div></div>';
    page.appendChild(demo);
    const fBox = demo.querySelector('.cs-funnel'), code = demo.querySelector('code'), runEl = demo.querySelector('.cs-run'), open = demo.querySelector('[data-open]');
    const runDemo = async (plan) => {
      const params = { from_month: '2024-11', to_month: '2026-07', plan };
      const sql = Q.render('activation_funnel', params);
      code.innerHTML = UI.highlight(sql);
      open.href = UI.workspaceHref('activation_funnel', params);
      runEl.textContent = 'Running…';
      try {
        const res = await DB.query(sql, { fresh: true });
        const rows = DB.toObjects(res);
        const max = rows[0] ? rows[0].lenders : 1;
        const steps = rows.filter((r) => r.pct_from_previous !== null);
        const worst = steps.slice().sort((a, b) => a.pct_from_previous - b.pct_from_previous)[0];
        fBox.innerHTML = '<ol class="mini-funnel">' + rows.map((r) => '<li class="' + (r === worst ? 'worst' : '') + '"><span>' + esc(K.label('stage', r.stage)) + '</span><span class="mf-bar"><span style="width:' + (100 * r.lenders / max).toFixed(1) + '%"></span></span><b>' + r.lenders + '</b></li>').join('') + '</ol>' +
          (worst ? '<p class="mf-note">Biggest drop: <b>' + esc(K.label('stage', worst.stage)) + '</b>, ' + K.pct(worst.pct_from_previous, 0) + ' continue.</p>' : '');
        runEl.textContent = K.plural(res.rows.length, 'row') + ' in ' + K.num(res.ms, { dp: true }) + ' ms, in your browser';
      } catch (err) {
        fBox.innerHTML = K.errorBox(err); runEl.textContent = '';
      }
    };
    demo.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
      demo.querySelectorAll('[data-plan]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      runDemo(b.dataset.plan);
    }));
    runDemo('');

    /* 3. Role and context */
    page.insertAdjacentHTML('beforeend',
      '<section class="sec" aria-labelledby="cs-role-h"><p class="sec-kicker">Role and context</p><h2 class="sec-headline" id="cs-role-h">Based on my work as a Product Manager at a lending API company.</h2>' +
      '<dl class="cs-facts">' +
        '<div><dt>My role</dt><dd>Product Manager. I scoped, designed and built this portfolio project end to end.</dd></div>' +
        '<div><dt>Based on</dt><dd>Managing NIBSS and credit-scoring API integrations and analysing customer usage with SQL, plus earlier work fixing data inconsistencies in an ERP system.</dd></div>' +
        '<div><dt>Built with</dt><dd>SQLite running in the browser (sql.js), plain JavaScript and hand-built SVG charts. No server, no framework.</dd></div>' +
        '<div><dt>Data</dt><dd>A fictional company with 180 sample lenders over 24 months, from a seeded generator. No real customer, system or data is used.</dd></div>' +
      '</dl></section>');

    /* 4. The problem */
    page.insertAdjacentHTML('beforeend',
      '<section class="sec" aria-labelledby="cs-prob-h"><p class="sec-kicker">The problem</p><h2 class="sec-headline" id="cs-prob-h">Lenders signed up but never went live, and nobody could see why.</h2>' +
      '<ol class="cs-points">' +
        '<li><b>Where do they get stuck?</b> The team could count signups and live customers, but not the steps in between or how long each one took.</li>' +
        '<li><b>Who needs a call?</b> Customers at risk of leaving, and lenders stuck before going live, only showed up when someone happened to look.</li>' +
        '<li><b>Which numbers can we trust?</b> Failing integrations and billing that did not match the ledger were found late, by customers or by Finance.</li>' +
      '</ol></section>');

    /* 5. What I built */
    page.insertAdjacentHTML('beforeend',
      '<section class="sec" aria-labelledby="cs-built-h"><p class="sec-kicker">What I built</p><h2 class="sec-headline" id="cs-built-h">A working analytics workspace that ends in a decision, not a dashboard.</h2>' +
      '<p class="sec-sub">Real SQL runs in your browser for activation, churn risk, usage, integration health and data integrity, and finishes in a PRD and an experiment plan.</p>' +
      '<div class="cs-modules">' + MODULES.map(([href, title, text]) => '<a href="' + A.hrefFor(href) + '"><b>' + esc(title) + '</b><span>' + esc(text) + '</span></a>').join('') + '</div></section>');

    /* 6. Decisions and trade-offs (with live numbers where they matter) */
    let exp = null;
    try {
      const r = await K.run('insights_experiment_baseline', {});
      const e = r.rows[0], p1 = e.approved_within_45_days_pct / 100, p2 = p1 + 0.1;
      const n = Math.ceil(Math.pow(1.96 + 0.8416, 2) * (p1 * (1 - p1) + p2 * (1 - p2)) / Math.pow(p2 - p1, 2));
      exp = { years: (2 * n / e.new_sandbox_lenders_per_month) / 12, perMonth: Math.round(e.new_sandbox_lenders_per_month) };
    } catch (e) { exp = null; }
    const DECISIONS = [
      ['Every chart is backed by visible, runnable SQL.', 'It means shipping a 2.2 MB database and a 0.7 MB SQL engine, so the first visit is slower than a static dashboard. I accepted that because trust in the numbers is the product. Anyone can open the query, change it and check the answer.'],
      ['One set of metric definitions, used everywhere.', 'Revenue, active customer and live call are SQL views in the database, not formulas copied into each chart. Queries get a little longer, but Overview and Usage revenue agree to the naira, and a test checks it.'],
      ['Insight headlines before charts.', 'Each chart opens with a sentence written from its own query. With small samples that can mislead, so a headline refuses to compare groups when there are too few lenders, and counts sit next to rates.'],
      ['Every view ends in an action and an owner.', 'Reasons and next steps come from simple rules, not a model, so a Customer Success lead can see why. Accounts idle for over six months are marked Dormant for an email, so the call list starts with lenders who are waiting on us.'],
      ['Data integrity is a product feature.', 'Billing is checked against the finance ledger and against metered usage, and every mismatch has a likely cause, a status and an owner. It adds checks to each billing run, which is cheaper than a customer finding a duplicate invoice.'],
      ['An honest experiment, not a theatrical one.', exp ? 'Only about ' + exp.perMonth + ' lenders a month reach the sandbox, so an A/B test to detect a 10-point lift would take about ' + K.num(exp.years, { dp: true }) + ' years. The PRD says so, and proposes a rollout with a decision rule and a leading indicator instead.' : 'With so few lenders a month, an A/B test would take years. The PRD says so, and proposes a rollout with a decision rule instead.'],
      ['Hand-built charts over a chart library.', 'More code to write, but one consistent look, colours that follow light and dark mode instantly, exact annotations for product events, and keyboard access to every data point.'],
    ];
    page.insertAdjacentHTML('beforeend',
      '<section class="sec" aria-labelledby="cs-dec-h"><p class="sec-kicker">Key decisions and trade-offs</p><h2 class="sec-headline" id="cs-dec-h">The choices that make the numbers trustworthy, and what they cost.</h2>' +
      '<ol class="cs-decisions">' + DECISIONS.map(([d, t]) => '<li><h3>' + esc(d) + '</h3><p>' + esc(t) + '</p></li>').join('') + '</ol></section>');

    /* 7. Results from the original work (CV only) */
    page.insertAdjacentHTML('beforeend',
      '<section class="sec" aria-labelledby="cs-res-h"><p class="sec-kicker">Results from the original work</p><h2 class="sec-headline" id="cs-res-h">What the real work achieved.</h2>' +
      '<ul class="cs-results">' +
        '<li>Used SQL to find signed-up but inactive customers and to analyse API usage and spend trends per customer. That analysis informed targeted activation and engagement with each account.</li>' +
        '<li>Managed product requirements for NIBSS and credit-scoring API integrations, and worked with engineering on the integration backlog and acceptance criteria to protect data accuracy and security in credit and identity checks.</li>' +
        '<li>Earlier, investigated data inconsistencies with a data analyst, resolving discrepancies between front-end updates and underlying records that affected payments for 30,000+ beneficiaries.</li>' +
      '</ul><p class="sec-sub">Signal\'s own numbers are sample data, so they are not results.</p></section>');

    /* 8. What next */
    page.insertAdjacentHTML('beforeend',
      '<section class="sec" aria-labelledby="cs-next-h"><p class="sec-kicker">What I\'d do next</p><h2 class="sec-headline" id="cs-next-h">Make it live, make it proactive, and test the fix.</h2>' +
      '<ol class="cs-next">' +
        '<li><b>Connect to a real warehouse.</b> Keep the same SQL and views, pointed at production data with a freshness check on every chart.</li>' +
        '<li><b>Alert Customer Success when an account stalls.</b> Send the Accounts to act on rules to Slack or the CRM, so nobody has to open Signal to know who to call.</li>' +
        '<li><b>Run the onboarding experiment.</b> Ship the compliance checklist, track it with the decision rule in the PRD, and mark the launch on the cohort heatmap.</li>' +
      '</ol></section>');

    /* 9. Back to the portfolio */
    page.insertAdjacentHTML('beforeend',
      '<nav class="cs-end" aria-label="Next steps"><a class="btn btn-primary" href="' + A.hrefFor('overview') + '">Open the product</a><a class="btn" href="../">Back to the portfolio</a></nav>');
  }

  A.register('case-study', { render });
})(window);
