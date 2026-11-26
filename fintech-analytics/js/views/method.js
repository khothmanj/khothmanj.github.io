/*
 * How it was built (#method): what is real and simulated, the metric glossary, the schema,
 * how the sample data was generated and the stories planted in it.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, A = root.SignalApp, UI = root.SignalSQLUI, DB = root.SignalDB, esc = K.esc;
  const REPO = 'https://github.com/khothmanj/khothmanj.github.io/tree/main/fintech-analytics';

  // One place for every metric. "view" names a shared SQL view in the database; "query" a saved query.
  const METRICS = [
    { name: 'Revenue', def: 'Platform fee plus successful live calls charged at the price in force that day, for each month a customer is live.', view: 'customer_months', where: 'Overview, Usage and spend, Customer 360' },
    { name: 'Active customer', def: 'A live customer with at least 100 successful live calls in the month.', view: 'customer_months', where: 'Overview' },
    { name: 'Live call', def: 'A successful call in production. Sandbox calls and failed calls do not count.', view: 'usage_priced', where: 'every view' },
    { name: 'Activation rate', def: 'Share of signups who make a successful live call within 90 days. Each month looks at lenders who signed up three to five months earlier, so all of them have had the full 90 days.', query: 'overview_activation', where: 'Overview' },
    { name: 'Time to first live call', def: 'Days from signup to the first successful live call. Shown as a median, because a few very slow lenders would pull an average up.', query: 'overview_time_to_live', where: 'Overview, Activation' },
    { name: 'Net revenue retention', def: 'Revenue this month from customers who paid 12 months ago, divided by what those same customers paid then. Customers who left count as zero.', query: 'overview_nrr', where: 'Overview' },
    { name: 'Funnel conversion', def: 'Share of lenders who reached a stage out of those who reached the stage before it. Median days is the time between the two.', query: 'activation_funnel', where: 'Activation' },
    { name: 'Compliance approval rate', def: 'Share of lenders who made a sandbox call and were then approved by compliance.', query: 'insights_problem', where: 'Activation, Insights' },
    { name: 'Failed call rate', def: 'Failed calls (timeouts, 4xx, 5xx and provider errors) as a share of all calls. The target is under 3% a day.', view: 'usage_priced', where: 'Overview, Integration health, Customer 360' },
    { name: 'p95 response time', def: '95% of calls were faster than this. Stored per customer, endpoint and day, so wider figures are call-weighted averages of those daily values, an approximation.', query: 'health_daily', where: 'Integration health' },
    { name: 'Falling usage', def: 'A live customer whose successful live calls in the latest month are at least 30% below three months earlier.', query: 'accounts_declining', where: 'Accounts to act on, Overview' },
    { name: 'Dormant account', def: 'A lender who never went live and has done nothing for over 180 days. Re-engage by email rather than a call.', query: 'accounts_not_live', where: 'Accounts to act on' },
  ];
  const STORIES = [
    ['Compliance is the biggest drop-off and the slowest step', 'activation'],
    ['Most compliance rework is a missing document', 'activation'],
    ['Cohorts after the docs rewrite on 1 July 2025 go live faster', 'activation'],
    ['A group signed up and never went live, each for a reason', 'accounts'],
    ['Twelve live customers are using us much less than in July', 'accounts?tab=declining'],
    ['A week-long credit bureau provider outage in August 2026', 'health'],
    ['Partner aggregator integrations time out about three times as often, and the North is slower', 'health'],
    ['Invoices and the ledger disagree in four different ways', 'integrity'],
    ['Lending demand rises in December, September and before each Eid', 'usage'],
    ['The top 10 customers bring in about 60% of revenue', 'usage'],
    ['Bank statement analysis launched and bureau prices rose', 'usage'],
    ['A compliance review backlog from August 2026', 'overview'],
    ['Too few signups for a quick A/B test', 'insights'],
  ];
  const GROUPS = [
    ['Customers and onboarding', ['customers', 'onboarding_events', 'compliance_reviews', 'plans']],
    ['Usage and pricing', ['api_usage_daily', 'endpoints', 'endpoint_prices']],
    ['Billing', ['invoices', 'ledger', 'recon_cases']],
    ['Support and events', ['support_tickets', 'events', 'meta']],
    ['Shared definitions (views)', ['months', 'usage_priced', 'customer_months', 'customer_stages']],
  ];

  async function render(el) {
    el.innerHTML = '';
    K.header(el, { title: 'How it was built', lede: 'What is real, what is simulated, how every metric is defined, and the stories planted in the sample data so you can check Signal finds them.' });
    el.insertAdjacentHTML('beforeend', '<nav class="toc" aria-label="On this page"><a href="#m-real">Real and simulated</a><a href="#m-glossary">Metric glossary</a><a href="#m-schema">Schema</a><a href="#m-data">Sample data</a><a href="#m-stories">Planted stories</a><a href="#m-tests">Tests</a></nav>');

    const [views, counts] = await Promise.all([
      DB.query("SELECT name, sql FROM sqlite_master WHERE type = 'view'").then(DB.toObjects),
      DB.query("SELECT 'customers' AS t, COUNT(*) AS n FROM customers UNION ALL SELECT 'onboarding_events', COUNT(*) FROM onboarding_events UNION ALL SELECT 'compliance_reviews', COUNT(*) FROM compliance_reviews UNION ALL SELECT 'plans', COUNT(*) FROM plans UNION ALL SELECT 'api_usage_daily', COUNT(*) FROM api_usage_daily UNION ALL SELECT 'endpoints', COUNT(*) FROM endpoints UNION ALL SELECT 'endpoint_prices', COUNT(*) FROM endpoint_prices UNION ALL SELECT 'invoices', COUNT(*) FROM invoices UNION ALL SELECT 'ledger', COUNT(*) FROM ledger UNION ALL SELECT 'recon_cases', COUNT(*) FROM recon_cases UNION ALL SELECT 'support_tickets', COUNT(*) FROM support_tickets UNION ALL SELECT 'events', COUNT(*) FROM events UNION ALL SELECT 'meta', COUNT(*) FROM meta").then(DB.toObjects),
    ]);
    const viewSql = Object.fromEntries(views.map((v) => [v.name, v.sql]));
    const n = Object.fromEntries(counts.map((c) => [c.t, c.n]));
    const info = DB.info();

    el.insertAdjacentHTML('beforeend',
      '<section class="sec" id="m-real" aria-labelledby="m-real-h"><h2 class="sec-headline" id="m-real-h">The SQL is real. The company and its data are not.</h2>' +
        '<div class="two-col"><div><h3 class="mini-h">Real</h3><ul class="plain-list">' +
          '<li>A SQLite database (' + esc(info ? 'SQLite ' + info.sqliteVersion : 'SQLite') + ', via sql.js) runs in your browser, in a background worker.</li>' +
          '<li>Every chart and table is produced by a query you can read, copy and run in the <a href="' + A.hrefFor('sql') + '">SQL workspace</a>.</li>' +
          '<li>Metrics are defined once, as SQL views, and reused everywhere.</li>' +
          '<li>Insight headlines and the PRD numbers are written from query results, not typed in.</li></ul></div>' +
        '<div><h3 class="mini-h">Simulated</h3><ul class="plain-list">' +
          '<li>Ferrow, its 180 customers, staff names and every figure are fictional sample data.</li>' +
          '<li>The data covers November 2024 to October 2026 and never changes. "Refreshed" is part of the sample.</li>' +
          '<li>There is no server and nothing you type leaves your browser.</li>' +
          '<li>Signal is based on my work as a Product Manager at a lending API company. No real customer, system or data from that work is used.</li></ul></div></div></section>');

    el.insertAdjacentHTML('beforeend',
      '<section class="sec" id="m-glossary" aria-labelledby="m-g-h"><h2 class="sec-headline" id="m-g-h">Metric glossary</h2><p class="sec-sub">One definition per metric, used on every screen. The SQL shown is read live from the database, so it is the definition the charts use.</p>' +
      '<dl class="glossary">' + METRICS.map((m, i) => '<div><dt>' + esc(m.name) + '</dt><dd><p>' + esc(m.def) + '</p><p class="muted">Used in ' + esc(m.where) + '.</p>' +
        (m.view ? '<details><summary>Defined in the <code>' + m.view + '</code> view</summary><pre class="code" tabindex="0"><code>' + UI.highlight(viewSql[m.view] || '') + '</code></pre></details>'
          : '<p><a href="' + UI.workspaceHref(m.query, A.params()) + '">Open the query in the SQL workspace</a></p>') + '</dd></div>').join('') + '</dl></section>');

    el.insertAdjacentHTML('beforeend',
      '<section class="sec" id="m-schema" aria-labelledby="m-s-h"><h2 class="sec-headline" id="m-s-h">Thirteen tables and four shared views</h2><p class="sec-sub">Everything links back to <code>customers.id</code>. The full data dictionary is in the <a href="' + REPO + '/data/README.md" rel="noopener">repository</a>.</p>' +
      '<div class="schema-groups">' + GROUPS.map(([g, tables]) => '<div><h3 class="mini-h">' + esc(g) + '</h3><ul>' + tables.map((t) => '<li><code>' + t + '</code><span>' + (n[t] !== undefined ? K.num(n[t]) + ' rows' : 'view') + '</span></li>').join('') + '</ul></div>').join('') + '</div></section>');

    el.insertAdjacentHTML('beforeend',
      '<section class="sec" id="m-data" aria-labelledby="m-d-h"><h2 class="sec-headline" id="m-d-h">The sample data comes from a seeded generator, so it is the same on every load.</h2>' +
      '<div class="prose"><p>A Node script (<a href="' + REPO + '/data/generate.js" rel="noopener">generate.js</a>) builds the database from seed 20261101. Each part of the data has its own random stream, so changing one part does not reshuffle the rest. It models a real business rather than drawing random numbers:</p><ul>' +
        '<li><b>Customers</b> sign up at a growing rate. Size decides plan and volume, and bigger lenders use more endpoints.</li>' +
        '<li><b>Onboarding</b> moves each lender through seven stages with a chance of stalling at each. Compliance runs in rounds: approved, sent back for documents, or rejected.</li>' +
        '<li><b>Usage</b> is driven by loan applications a day, scaled by season, weekday, Eid, payday, growth and each customer\'s story.</li>' +
        '<li><b>Errors</b> follow a rate per endpoint, raised for new integrations, partner aggregators, the North and the bureau outage.</li>' +
        '<li><b>Billing</b> charges successful live calls at the price on the day plus the plan fee. The ledger copies invoices, apart from the planted problems.</li></ul>' +
        '<p>It writes about 212,000 daily usage rows. The database is ' + (info ? (info.compressedBytes / 1048576).toFixed(1) + ' MB compressed and ' + (info.bytes / 1048576).toFixed(1) + ' MB unpacked' : 'about 2 MB compressed') + ', and opens in your browser in well under a second once downloaded.</p></div></section>');

    el.insertAdjacentHTML('beforeend',
      '<section class="sec" id="m-stories" aria-labelledby="m-p-h"><h2 class="sec-headline" id="m-p-h">Thirteen stories were planted on purpose. Each one should be findable.</h2>' +
      '<ol class="stories">' + STORIES.map(([s, v]) => '<li><span>' + esc(s) + '</span><a href="#' + v + '">See it</a></li>').join('') + '</ol>' +
      '<p class="sec-sub">Real data is messier. Small cohorts swing from month to month, which is why counts sit next to rates throughout.</p></section>');

    el.insertAdjacentHTML('beforeend',
      '<section class="sec" id="m-tests" aria-labelledby="m-t-h"><h2 class="sec-headline" id="m-t-h">Tests check that the numbers agree with each other.</h2>' +
      '<div class="prose"><p>The <a href="tests/queries.test.html">query test page</a> runs every saved query through sql.js with four filter combinations, checks that Overview revenue equals Usage revenue, that invoices match the revenue definition apart from the planted errors, and that each planted story shows up.</p></div></section>');

    el.querySelectorAll('.toc a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const t = document.getElementById(a.getAttribute('href').slice(1)); t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); t.querySelector('h2').setAttribute('tabindex', '-1'); t.querySelector('h2').focus({ preventScroll: true }); }));
  }

  A.register('method', { render });
})(window);
