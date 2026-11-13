/*
 * Results: headline figures, what this means, what-ifs, tabs, Simple and Investor views, downloads.
 */
(function (root) {
  'use strict';
  const A = root.TenorApp, P = root.TenorProject, E = root.TenorEngine, M = root.TenorMatch, N = root.TenorNarrative, C = root.TenorCharts;
  const { $, $$, esc, term } = A;
  const TABS = [['overview', 'Overview'], ['sales', 'Sales and costs'], ['loans', 'Loan repayments'], ['model', 'Full model'], ['risks', 'Risks and what-ifs'], ['readiness', 'Readiness'], ['sources', 'Sources']];

  function view(el, id, tabArg) {
    const D = A.data;
    const p = P.get(id);
    if (!p) { el.innerHTML = '<div class="page"><p>That plan was not found in this browser. <a href="#projects">Back to your projects</a></p></div>'; return; }
    const input = P.engineInput(p, D.defaults);
    const m = E.run(input);
    const sens = E.sensitivities(input, m);
    let ready = E.readiness(input, m, D.sectors);
    const caseRecord = p.meta.sourceCase ? A.allCases().find((c) => c.id === p.meta.sourceCase) : null;
    const sim = M.similar(Object.assign({}, input, { id: p.id, sourceCase: p.meta.sourceCase }), A.allCases(), D.defaults);
    const tpl = A.sectorOf(input.sector);
    const cur = input.currency;
    const k = m.kpis;
    const prefs = P.prefs();
    let mode = prefs.view === 'investor' ? 'investor' : 'simple';
    const tab = TABS.some(([t]) => t === tabArg) ? tabArg : 'overview';
    const hasLoan = m.loans.length > 0;
    const rounds = (input.financing.equity || []).filter((e) => e.pre_money > 0);
    const loanTabLabel = hasLoan && rounds.length ? 'Loans and investors' : hasLoan ? 'Loan repayments' : rounds.length ? 'Investors' : 'Funding';
    const charts = [];
    const money = (x, o) => N.money(x, cur, o);
    const full = (x) => N.money(x, cur, { compact: false });
    const plain = (x) => N.money(x, '', { compact: false }); // tables state the currency once, in the header
    const Y = (t) => m.years[t - 1];
    document.title = (input.name || 'Plan') + ' · Tenor';
    A.cleanup = () => charts.forEach((c) => c.destroy());
    window.addEventListener('tenor:theme', () => A.render(), { once: true });

    /* ---------- headline ---------- */
    const st = k.steadyYear;
    function headline(rows) {
      const R = rows || { revenue: m.out.revenue, cost: m.out.varCost.map((v, t) => v + m.out.fixCost[t]), ds: m.out.debtService };
      const simple = mode === 'simple';
      const items = [];
      items.push({ key: 'sales', k: simple ? 'Expected yearly sales' : 'Revenue (' + Y(st) + ')', v: R.revenue[st], fmt: money, s: simple ? 'Once you reach full output, in ' + Y(st) : 'Representative year, after ramp-up' });
      items.push({ key: 'costs', k: simple ? 'Yearly running costs' : 'Operating costs', v: R.cost[st], fmt: money, s: simple ? 'Costs that rise with sales, plus fixed costs' : 'EBITDA margin ' + N.pct(k.ebitdaMargin) });
      if (hasLoan) {
        const mx = Math.max(0, ...R.ds.slice(1)); const yi = R.ds.findIndex((x, t) => t > 0 && x >= mx * (1 - 1e-9));
        items.push(simple ? { key: 'debt', k: 'Largest yearly loan payment', v: mx, fmt: money, s: 'In ' + Y(yi) + ', including interest' } : { key: 'dscr', k: 'Minimum DSCR', v: rows && rows.kpis ? rows.kpis.dscrMin : k.dscrMin, fmt: N.ratio, s: 'Lenders usually want 1.30x' });
        items.push(simple ? { key: 'payoff', k: 'Loan paid off by', v: Y(k.loanPaidOffYear), fmt: (x) => String(x), s: 'With the current repayment plan', text: true } : { key: 'irr', k: 'Project IRR', v: k.projectIRR, fmt: N.pct, s: 'NPV ' + money(rows && rows.kpis ? rows.kpis.npv : k.npv) + ' at ' + N.pct(k.discountRate, 0) });
      } else {
        items.push(simple ? { key: 'payback', k: 'Money back in', v: k.paybackYears, fmt: (x) => (x === null ? 'Not yet' : x.toFixed(1) + ' years'), s: 'Until cash in covers money put in' } : { key: 'irr', k: 'Project IRR', v: k.projectIRR, fmt: N.pct, s: 'NPV ' + money(rows && rows.kpis ? rows.kpis.npv : k.npv) });
        items.push(simple ? { key: 'npv', k: 'Lowest cash balance', v: rows && rows.kpis ? rows.kpis.lowestCash : k.lowestCash, fmt: money, s: (rows && rows.kpis ? rows.kpis.lowestCash : k.lowestCash) >= 0 ? 'Cash never runs out' : 'You need more money to cover this' } : { key: 'npv', k: rounds.length ? 'Cash runway' : 'NPV', v: rounds.length ? k.runwayMonths : k.npv, fmt: rounds.length ? (x) => (x === null ? 'Does not run out' : x.toFixed(0) + ' months') : money, s: rounds.length ? 'Months until cash runs out' : 'At ' + N.pct(k.discountRate, 0) });
      }
      return items;
    }
    const headHTML = (items) => '<div class="headline" id="headline">' + items.map((it, i) => '<div><div class="k">' + esc(it.k) + '</div><div class="v" data-i="' + i + '">' + esc(it.fmt(it.v)) + '</div><div class="s">' + esc(it.s) + '</div><div class="explain"><button type="button" class="link-btn small" data-explain="' + it.key + '" aria-expanded="false">Explain this number</button><div class="explain-box" id="ex-' + it.key + '" hidden></div></div></div>').join('') + '</div>';

    /* ---------- tab bodies ---------- */
    const yearsTable = (rows, cols) => '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">' + esc(cur) + '</th>' + cols.map((t) => '<th scope="col">' + Y(t) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(([label, arr, cls, fmt]) => '<tr class="' + (cls || '') + '"><td>' + label + '</td>' + cols.map((t) => { const v = arr[t]; return '<td class="' + (typeof v === 'number' && v < -0.5 ? 'neg' : '') + '">' + esc(fmt ? fmt(v) : plain(v)) + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>';
    const opsCols = (n) => Array.from({ length: n }, (_, i) => m.opsStart + i).filter((t) => t <= m.N);
    const allCols = Array.from({ length: m.N }, (_, i) => i + 1);

    function overview() {
      const simple = mode === 'simple';
      const sum = N.summary({ input, model: m, sens }, simple ? 'simple' : 'investor');
      const scen = sens.results.filter((r) => ['volume_20', 'price_10', 'opex_15', 'delay_1', 'fx'].includes(r.id));
      const loanStart = hasLoan ? Y(Math.min(...m.loans.map((l) => l.firstRepay))) : null;
      const three = opsCols(3);
      return headHTML(headline()) +
        '<div class="overview-mid"><div class="chart-block"><h2>' + (simple ? 'What could be left each year' : 'Cash flow after debt service') + '</h2><p class="sub">' + (simple ? 'Sales less running costs, tax and loan payments' : 'CFADS less debt service, by year') + '</p>' +
        '<div class="chart-wrap"><canvas id="ch-cash" role="img" aria-label="Chart of cash left each year after running costs, tax and loan payments"></canvas></div><p class="chart-note">' + (loanStart ? 'Repaying the loan principal starts in ' + loanStart + '. The shaded area marks the repayment years.' : 'No loan in this plan.') + '</p></div>' +
        '<aside class="meaning ' + sum.tone + '" id="meaning"><div class="label">What this means</div><h3>' + esc(sum.headline) + '</h3>' + sum.paragraphs.map((x) => '<p>' + esc(x) + '</p>').join('') + '<hr><h3 style="font-size:1.3rem">Try a different outcome</h3>' +
        '<div class="scenario-btns">' + scen.map((r) => '<button type="button" class="btn" data-scen="' + r.id + '" aria-pressed="false">' + esc(simple ? r.simple : r.label) + '</button>').join('') + '</div><p class="scenario-state" id="scen-state" role="status"></p>' +
        '<p style="margin-top:12px"><a href="#method">See how we calculated this</a></p></aside></div>' +
        '<section class="three-year"><header><h2>A closer look at the first three years</h2><a href="#results/' + p.id + '/model">Open the full model</a></header>' +
        yearsTable([[simple ? 'Sales' : 'Revenue', m.out.revenue], [simple ? 'Running costs' : 'Operating costs', m.out.varCost.map((v, t) => v + m.out.fixCost[t])], ['Tax', m.out.taxCharge], [simple ? 'Loan payments' : 'Debt service', m.out.debtService], [simple ? 'Cash left after loan payments' : 'Cash after debt service', m.out.cashAfterDebt, 'total']], three) +
        '<p class="chart-note">Each year in ' + esc(cur) + '. Running costs include inflation. The Excel model has every year and every line.</p></section>';
    }
    function sales() {
      const simple = mode === 'simple';
      const lines = m.costLines.map((l) => [esc(l.label), l.values, 'sub']);
      return '<div class="panel-grid"><div class="chart-block"><h2>' + (simple ? 'Where each year\'s money goes' : 'From revenue to cash after debt service') + '</h2><p class="sub">' + Y(st) + ', once running at full size</p><div class="chart-wrap"><canvas id="ch-wf" role="img" aria-label="Waterfall from sales to cash left"></canvas></div></div>' +
        '<div class="chart-block"><h2>Sales and running costs</h2><p class="sub">Every year of the plan</p><div class="chart-wrap"><canvas id="ch-sc" role="img" aria-label="Sales and running costs by year"></canvas></div></div></div>' +
        '<h2 class="section-title" style="margin-top:32px">Line by line</h2>' + yearsTable([[simple ? 'Sales' : 'Revenue', m.out.revenue, 'total']].concat(lines).concat([[simple ? 'Left after running costs' : 'EBITDA', m.out.ebitda, 'total']]), allCols) +
        '<p class="chart-note">How sales are worked out: ' + esc(tpl.revenue_explained) + ' Break-even sales: ' + esc(full(k.breakEvenRevenue)) + ' a year.</p>';
    }
    function loans() {
      const simple = mode === 'simple';
      let h = '';
      if (hasLoan) {
        h += '<div class="panel-grid"><div class="chart-block"><h2>' + (simple ? 'Can the project repay?' : 'Debt service cover') + '</h2><p class="sub">' + (simple ? 'How many times the cash the project makes covers each year\'s loan payment. ' : '') + term('DSCR') + ' by year</p><div class="chart-wrap"><canvas id="ch-dscr" role="img" aria-label="DSCR by year against the lender minimum"></canvas></div></div>' +
          '<div><h2 class="section-title">' + (simple ? 'The short version' : 'Credit metrics') + '</h2><dl class="facts"><div><dt class="k">Lowest ' + term('DSCR') + '</dt><dd class="v">' + esc(N.ratio(k.dscrMin)) + '</dd></div><div><dt class="k">Average DSCR</dt><dd class="v">' + esc(N.ratio(k.dscrAvg)) + '</dd></div>' +
          '<div><dt class="k">' + term('LLCR') + '</dt><dd class="v">' + esc(N.ratio(k.llcr)) + '</dd></div><div><dt class="k">' + term('Gearing') + '</dt><dd class="v">' + esc(N.pct(k.gearing, 0)) + '</dd></div><div><dt class="k">Largest payment</dt><dd class="v">' + esc(money(k.largestDebtService)) + '</dd></div><div><dt class="k">Paid off by</dt><dd class="v">' + esc(Y(k.loanPaidOffYear)) + '</dd></div></dl></div></div>';
        m.loans.forEach((l, i) => {
          const L = input.financing.loans[i];
          const rows = []; for (let t = 1; t <= Math.min(m.N, l.last); t++) rows.push('<tr><td>' + Y(t) + (t < l.firstRepay ? ' <span class="pill">Grace</span>' : '') + '</td><td>' + esc(plain(l.local.closing[t - 1] + l.local.draw[t])) + '</td><td>' + esc(plain(l.local.interestPaid[t])) + '</td><td>' + esc(plain(l.local.capitalised[t])) + '</td><td>' + esc(plain(l.local.principal[t])) + '</td><td>' + esc(plain(l.local.closing[t])) + '</td></tr>');
          h += '<h2 class="section-title" style="margin-top:32px">' + esc(l.label) + '</h2><p class="muted">' + esc(N.money(L.amount, L.currency || cur, { compact: false })) + ' at ' + esc(L.rate_pct) + '% a year, ' + esc(L.tenor_years) + ' years including ' + esc(L.grace_years || 0) + ' years of grace, ' + esc({ annuity: 'equal payments', equal_principal: 'equal principal repayments', bullet: 'repaid at the end' }[L.repayment] || L.repayment) + (L.currency && L.currency !== cur ? '. Shown in ' + esc(cur) + ' at ' + esc(L.fx_rate) + ' per ' + esc(L.currency) : '') + '.</p>' +
            '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">Year (' + esc(cur) + ')</th><th scope="col">Owed at the start</th><th scope="col">Interest paid</th><th scope="col">Interest added</th><th scope="col">Repaid</th><th scope="col">Owed at the end</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
        });
      }
      if (rounds.length || !hasLoan) {
        h += '<h2 class="section-title"' + (hasLoan ? ' style="margin-top:32px"' : '') + '>' + (rounds.length ? 'Investors and ownership' : 'No loan in this plan') + '</h2>';
        if (rounds.length) h += '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">Holder</th><th scope="col">Share after funding</th></tr></thead><tbody>' + m.ownership.map((o) => '<tr><td>' + esc(o.holder) + '</td><td>' + o.pct.toFixed(1) + '%</td></tr>').join('') + '</tbody></table></div>';
        h += '<dl class="facts"><div><dt class="k">' + term('Runway', 'Cash runway') + '</dt><dd class="v">' + esc(k.runwayMonths === null ? 'Does not run out' : k.runwayMonths.toFixed(0) + ' months') + '</dd></div><div><dt class="k">Equity ' + term('IRR') + '</dt><dd class="v">' + esc(N.pct(k.equityIRR)) + '</dd></div><div><dt class="k">Lowest cash</dt><dd class="v">' + esc(money(k.lowestCash)) + '</dd></div><div><dt class="k">' + term('Payback') + '</dt><dd class="v">' + esc(N.years(k.paybackYears)) + '</dd></div></dl>';
      }
      return h;
    }
    function model() {
      const simple = mode === 'simple'; const o = m.out;
      const L = (s, i) => (simple ? s : i);
      const sets = {
        pl: [[L('Sales', 'Revenue'), o.revenue, 'total'], [L('Costs that rise with sales', 'Variable costs'), o.varCost, 'sub'], [L('Left after those costs', 'Gross profit'), o.grossProfit], [L('Fixed running costs', 'Fixed costs'), o.fixCost, 'sub'], [L('Left after running costs', 'EBITDA'), o.ebitda, 'total'], [L('Wear and tear on equipment', 'Depreciation'), o.dep, 'sub'], [L('Interest', 'Interest expense'), o.interest, 'sub'], ['Loan fees', o.fees, 'sub'], [L('Currency losses', 'FX losses'), o.fxLoss, 'sub'], [L('Profit before tax', 'Profit before tax'), o.pbt], ['Tax', o.taxCharge, 'sub'], [L('Profit', 'Net income'), o.netIncome, 'total']],
        cf: [[L('Left after running costs', 'EBITDA'), o.ebitda], ['Tax paid', o.taxCharge.map((x) => -x), 'sub'], [L('Cash tied up in stock and bills', 'Change in working capital'), o.dWC.map((x) => -x), 'sub'], [L('Cash from running the business', 'Cash from operations'), o.cfo, 'total'], [L('Buying and building', 'Capex'), o.capex.map((x) => -x), 'sub'], [L('Owners\' and investors\' money', 'Equity'), o.equityIn, 'sub'], ['Grants', o.grantIn, 'sub'], [L('Loans received', 'Debt drawdowns'), o.draw, 'sub'], [L('Interest paid', 'Interest paid'), o.intPaid.map((x) => -x), 'sub'], [L('Loan repaid', 'Principal repaid'), o.principal.map((x) => -x), 'sub'], [L('Cash at the end of the year', 'Closing cash'), o.cash, 'total']],
        bs: [['Cash', o.cash], [L('Money owed by customers', 'Receivables'), o.ar, 'sub'], [L('Stock', 'Inventory'), o.inventory, 'sub'], [L('Equipment and buildings', 'Fixed assets (net)'), o.nfa, 'sub'], [L('Everything the project owns', 'Total assets'), o.assets, 'total'], [L('Money owed to suppliers', 'Payables'), o.ap, 'sub'], ['Loans', o.debt, 'sub'], [L('Owners\' stake', 'Equity'), o.equity, 'total'], [L('Check (should be zero)', 'Balance check'), o.bsDiff.map((x) => Math.round(x)), 'sub']],
      };
      const which = A.modelSet || 'pl';
      const q = m.quarterly;
      const qt = '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">Quarter (' + esc(cur) + ')</th><th scope="col">Sales</th><th scope="col">Running costs</th><th scope="col">Loan payments</th><th scope="col">Net cash</th><th scope="col">Cash at the end</th></tr></thead><tbody>' + q.map((r) => '<tr><td>' + esc(r.label) + '</td><td>' + esc(plain(r.revenue)) + '</td><td>' + esc(plain(r.costs)) + '</td><td>' + esc(plain(r.debtService)) + '</td><td>' + esc(plain(r.netCash)) + '</td><td>' + esc(plain(r.closingCash)) + '</td></tr>').join('') + '</tbody></table></div><p class="chart-note">Each year split evenly into quarters. Seasonality is not modelled.</p>';
      return '<div class="subtle-tabs" role="group" aria-label="Statement">' + [['pl', L('Profit and loss', 'P&L')], ['cf', 'Cash flow'], ['bs', 'Balance sheet'], ['q', 'Quarterly']].map(([v, l]) => '<button type="button" data-set="' + v + '" aria-pressed="' + (which === v) + '">' + esc(l) + '</button>').join('') + '</div>' +
        (which === 'q' ? qt : yearsTable(sets[which], allCols)) + '<p class="chart-note">All amounts in ' + esc(cur) + '. ' + (m.checks.balanceSheetBalances && m.checks.debtFullyRepaid ? 'Model checks pass: the balance sheet balances every year and every loan is repaid.' : 'A model check failed. Review your inputs.') + '</p>';
    }
    function risks() {
      const simple = mode === 'simple';
      return '<div class="panel-grid"><div class="chart-block"><h2>What moves the result most</h2><p class="sub">Change in the value of the project (' + term('NPV') + ') for each what-if</p><div class="chart-wrap" style="height:' + (60 + sens.results.length * 48) + 'px"><canvas id="ch-tor" role="img" aria-label="Change in project value for each what-if"></canvas></div></div>' +
        '<div><h2 class="section-title">How to reduce each risk</h2><ul class="sources-list">' + sens.ranked.map((rid) => { const r = sens.results.find((x) => x.id === rid); return '<li><strong>' + esc(simple ? r.simple : r.label) + '</strong><span class="what">' + esc(N.mitigation(rid)) + '</span></li>'; }).join('') + '</ul></div></div>' +
        '<h2 class="section-title" style="margin-top:32px">Every what-if</h2><div class="table-wrap"><table class="data"><thead><tr><th scope="col">What-if</th><th scope="col">Value (NPV)</th><th scope="col">Change</th><th scope="col">Lowest DSCR</th><th scope="col">Lowest cash</th><th scope="col">Cash left after loans, all years</th></tr></thead><tbody>' +
        '<tr class="total"><td>Your plan</td><td>' + esc(money(sens.base.npv)) + '</td><td></td><td>' + esc(N.ratio(sens.base.dscrMin)) + '</td><td>' + esc(money(sens.base.lowestCash)) + '</td><td>' + esc(money(sens.base.totalCashAfterDebt)) + '</td></tr>' +
        sens.ranked.map((rid) => { const r = sens.results.find((x) => x.id === rid); return '<tr><td>' + esc(simple ? r.simple : r.label) + (r.breachesDscr ? ' <span class="pill bad">Below lender minimum</span>' : '') + '</td><td>' + esc(money(r.result.npv)) + '</td><td class="' + (r.delta.npv < 0 ? 'neg' : '') + '">' + esc(money(r.delta.npv)) + '</td><td>' + esc(N.ratio(r.result.dscrMin)) + '</td><td class="' + (r.result.lowestCash < 0 ? 'neg' : '') + '">' + esc(money(r.result.lowestCash)) + '</td><td>' + esc(money(r.result.totalCashAfterDebt)) + '</td></tr>'; }).join('') +
        '</tbody></table></div><p class="chart-note">Each what-if keeps the build and the loans the same and changes sales or running costs. The Excel model recalculates the same what-ifs on its Sensitivity sheet.</p>' +
        (caseRecord && caseRecord.caveats ? '<div class="caveats"><strong>Caveats on this case\'s data</strong><ul>' + caseRecord.caveats.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>' : '');
    }
    function readinessTab() {
      const r = ready; const pct = r.score / 100; const R = 52, Cc = 2 * Math.PI * R;
      return '<div class="panel-grid"><div><div class="ring"><svg viewBox="0 0 120 120" role="img" aria-label="Readiness score ' + r.score + ' out of 100"><circle cx="60" cy="60" r="' + R + '" stroke="var(--line)" stroke-width="8" fill="none"/><circle cx="60" cy="60" r="' + R + '" stroke="var(--mint)" stroke-width="8" fill="none" stroke-dasharray="' + (Cc * pct).toFixed(1) + ' ' + Cc.toFixed(1) + '" transform="rotate(-90 60 60)" stroke-linecap="round"/><text x="60" y="68" text-anchor="middle" font-family="Newsreader, Georgia" font-size="30" fill="var(--ink)">' + r.score + '</text></svg>' +
        '<div><h2>Readiness score</h2><p class="muted">Out of 100. Half comes from the documents lenders and investors usually ask for, half from the numbers.</p></div></div>' +
        '<h2 class="section-title" style="margin-top:28px">How the score is made</h2><ul class="checklist">' + r.items.map((it) => '<li><span aria-hidden="true">' + (it.ok ? A.ICON.check : '') + '</span><span>' + esc(it.label) + '</span><span class="pill ' + (it.ok ? 'ok' : it.points > 0 ? 'warn' : 'bad') + '">' + it.points + ' of ' + it.max + '</span></li>').join('') + '</ul></div>' +
        '<div><h2 class="section-title">Documents for this funding mix</h2><p class="muted small">Tick what you already have. Your score updates straight away.</p><ul class="checklist">' + r.required.map((d, i) => '<li><input type="checkbox" id="rd' + i + '" data-doc="' + esc(d) + '"' + (input.documents[d] ? ' checked' : '') + '><label for="rd' + i + '">' + esc(d) + '</label><span class="pill ' + (input.documents[d] ? 'ok' : '') + '">' + (input.documents[d] ? 'In place' : 'Still needed') + '</span></li>').join('') + '</ul>' +
        '<h2 class="section-title" style="margin-top:28px">Next steps</h2><ul class="sources-list">' + (r.missing.slice(0, 4).map((d) => '<li>Prepare: ' + esc(d) + '</li>').join('') || '<li>All the standard documents are in place.</li>') +
        (hasLoan && k.dscrMin !== null && k.dscrMin < 1.3 ? '<li>Improve loan cover: ask for a longer repayment period or more grace, or put in more of your own money.</li>' : '') + (k.npv < 0 ? '<li>Check your sales and cost estimates: at these numbers the project is worth less than it costs.</li>' : '') + '</ul></div></div>';
    }
    function sources() {
      const drivers = (caseRecord && caseRecord.drivers) || {};
      const rows = tpl.inputs.filter((i) => typeof input.revenue.inputs[i.key] === 'number').map((i) => {
        const d = drivers[i.key]; const est = p.meta.estimates && p.meta.estimates[i.key];
        const q = d ? d.quality : est ? 'assumed' : 'assumed';
        const why = d ? d.note || '' : est === 'benchmark' ? 'Middle of similar projects in the library, marked as an estimate.' : est ? 'Tenor\'s starting estimate.' : 'Your own estimate.';
        return '<tr><td>' + esc(mode === 'simple' ? i.simple_label : i.label) + '<div class="small muted">' + esc(why) + '</div></td><td>' + esc(Number(input.revenue.inputs[i.key]).toLocaleString('en-GB', { maximumFractionDigits: 3 })) + ' ' + esc(i.unit || '') + '</td><td><span class="q q-' + q + '">' + q + '</span></td></tr>';
      }).join('');
      const other = [['Inflation', input.inflation_pct + '% a year'], ['Tax rate', input.tax.rate_pct + '%' + (input.tax.holiday_years ? ', ' + input.tax.holiday_years + '-year holiday' : '')], ['Discount rate for NPV', input.discount_rate_pct + '%'], ['Customers pay in', input.working_capital.receivable_days + ' days'], ['You pay suppliers in', input.working_capital.payable_days + ' days']];
      return '<div class="panel-grid"><div><h2 class="section-title">Where every assumption came from</h2><div class="table-wrap"><table class="data"><thead><tr><th scope="col">Assumption</th><th scope="col">Value</th><th scope="col">Quality</th></tr></thead><tbody>' + rows +
        other.map(([a, b]) => '<tr><td>' + esc(a) + '<div class="small muted">Tenor default. Change it in the Excel model.</div></td><td>' + esc(b) + '</td><td><span class="q q-assumed">assumed</span></td></tr>').join('') + '</tbody></table></div></div>' +
        '<div><h2 class="section-title">Similar projects</h2><ul class="sources-list">' + sim.map((s) => '<li><a href="#library/' + esc(s.id) + '">' + esc(s.name) + '</a><span class="what">' + esc(s.why) + '</span></li>').join('') + '</ul>' +
        (caseRecord && caseRecord.sources && caseRecord.sources.length ? '<h2 class="section-title" style="margin-top:28px">Sources for this case</h2><ul class="sources-list">' + caseRecord.sources.map((s) => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '</a><span class="what">' + esc(s.publisher) + ', ' + esc(s.date) + '. Supports: ' + esc(s.supports) + '.</span></li>').join('') + '</ul>' : '') + '</div></div>';
    }
    const BODY = { overview, sales, loans, model, risks, readiness: readinessTab, sources };

    const downloads = '<section class="downloads" id="downloads" aria-labelledby="dl-h"><h2 id="dl-h">Download your plan</h2><p class="muted">Built in your browser. Nothing is sent to a server.</p><div class="dl-grid">' +
      [['excel', 'Excel model', 'For analysts and lenders who want to test the numbers.'], ['word', 'Word report', 'For sharing and funding applications.'], ['deck', 'Presentation', 'For meetings with investors or clients.'], ['csv', 'CSV data', 'For importing into other tools. Values only.']]
        .map(([kind, t, d]) => '<div><h3>' + t + '</h3><p>' + d + '</p><button type="button" class="btn" data-dl="' + kind + '">' + A.ICON.download + 'Download ' + (kind === 'csv' ? 'data as CSV' : t.toLowerCase()) + '</button><span class="dl-status" id="dls-' + kind + '" role="status"></span></div>').join('') +
      '</div><div class="actions" style="margin-top:16px"><button type="button" class="btn btn-quiet" id="save-case">Save this plan as a case in my library</button></div></section>';

    el.innerHTML = '<div class="page"><p class="crumbs"><a href="#projects">Your projects</a> / ' + esc(input.name || 'Untitled plan') + '</p>' +
      '<div class="results-head"><div><h1>Your plan, brought into focus.</h1><p class="meta">' + esc([input.name, p.meta.crop && ['crops', 'irrigation'].includes(input.sector) ? p.meta.crop : tpl.label, input.country].filter(Boolean).join(' · ')) + '</p></div>' +
      '<div class="tools"><div class="toggle" role="group" aria-label="View"><button type="button" data-mode="simple" aria-pressed="' + (mode === 'simple') + '">Simple view</button><button type="button" data-mode="investor" aria-pressed="' + (mode === 'investor') + '">Investor view</button></div>' +
      '<a class="btn" href="#edit/' + p.id + '/2">Adjust assumptions</a><a class="btn btn-primary" href="#downloads" id="to-dl">' + A.ICON.download + 'Download your plan</a></div></div>' +
      (p.meta.example ? '<p class="note-line">This is an example from the case library. Change anything you like: it is saved as your own copy.</p>' : '') +
      '<div class="tabs" role="tablist" aria-label="Results">' + TABS.map(([t, l]) => '<button type="button" role="tab" id="tab-' + t + '" aria-controls="panel" aria-selected="' + (t === tab) + '" tabindex="' + (t === tab ? 0 : -1) + '" data-tab="' + t + '">' + esc(t === 'loans' ? loanTabLabel : l) + '</button>').join('') + '</div>' +
      '<div class="tabpanel" id="panel" role="tabpanel" aria-labelledby="tab-' + tab + '" tabindex="0">' + BODY[tab]() + '</div>' + downloads + '</div>';

    /* ---------- charts ---------- */
    const draw = () => {
      charts.forEach((c) => c.destroy()); charts.length = 0;
      if (typeof Chart === 'undefined') { $$('canvas', el).forEach((c) => c.insertAdjacentHTML('afterend', '<p class="muted small">Charts need an internet connection to load.</p>')); return; }
      const g = (id) => $('#' + id, el);
      if (g('ch-cash')) charts.push(C.cashArea(g('ch-cash'), m, cur));
      if (g('ch-wf')) charts.push(C.waterfall(g('ch-wf'), m, cur, st, mode === 'simple'));
      if (g('ch-sc')) charts.push(C.salesCosts(g('ch-sc'), m, cur));
      if (g('ch-dscr')) charts.push(C.dscrLine(g('ch-dscr'), m, (D.defaults.dscr_target || 1.3)));
      if (g('ch-tor')) charts.push(C.tornado(g('ch-tor'), sens, cur, mode === 'simple'));
    };
    draw();

    /* ---------- events ---------- */
    let activeScen = null;
    function setScenario(id) {
      const btns = $$('[data-scen]', el);
      const cashCanvas = $('#ch-cash', el);
      const prevItems = headline(activeScen ? scenRows(activeScen) : null);
      activeScen = activeScen === id ? null : id;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scen === activeScen)));
      const rows = activeScen ? scenRows(activeScen) : null;
      const items = headline(rows);
      $$('#headline .v', el).forEach((v, i) => { const it = items[i]; const prev = prevItems[i]; if (it.text || typeof it.v !== 'number' || typeof prev.v !== 'number') v.textContent = it.fmt(it.v); else A.tween(v, prev.v, it.v, it.fmt); });
      const state = $('#scen-state', el);
      if (activeScen) {
        const r = sens.results.find((x) => x.id === activeScen);
        state.innerHTML = esc((mode === 'simple' ? r.simple : r.label) + ': value changes by ' + money(r.delta.npv) + (r.result.dscrMin !== null ? ', lowest loan cover ' + N.ratio(r.result.dscrMin) : '') + '. ') + '<button type="button" class="link-btn" data-scen-reset="1">Back to your plan</button>';
      } else state.textContent = '';
      if (cashCanvas) { const i = charts.findIndex((c) => c.canvas === cashCanvas); if (i >= 0) { charts[i].destroy(); charts[i] = C.cashArea(cashCanvas, m, cur, rows ? rows.cashAfterDebt : null); } }
    }
    function scenRows(id) {
      const r = sens.results.find((x) => x.id === id);
      return { revenue: r.rows.revenue, cost: r.rows.revenue.map((v, t) => v - r.rows.ebitda[t]), ds: r.rows.debtService, cashAfterDebt: r.rows.cashAfterDebt, kpis: r.result };
    }
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button, a'); if (!b) return;
      if (b.dataset.tab) { location.hash = '#results/' + p.id + '/' + b.dataset.tab; return; }
      if (b.dataset.mode) { P.setPref('view', b.dataset.mode); A.render(); return; }
      if (b.dataset.scen) { setScenario(b.dataset.scen); return; }
      if (b.dataset.scenReset) { setScenario(activeScen); return; }
      if (b.dataset.set) { A.modelSet = b.dataset.set; A.render(); return; }
      if (b.dataset.explain) {
        const box = $('#ex-' + b.dataset.explain, el); const open = box.hidden;
        const x = N.explain(b.dataset.explain, { input, model: m, sector: tpl });
        if (x) box.innerHTML = '<strong>' + esc(x.title) + '.</strong> ' + esc(x.formula) + ' <span style="display:block;margin-top:4px">' + esc(x.value) + '</span>';
        box.hidden = !open; b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'Hide explanation' : 'Explain this number'; return;
      }
      if (b.id === 'to-dl') { e.preventDefault(); $('#downloads', el).scrollIntoView({ behavior: A.reduced() ? 'auto' : 'smooth' }); $('#downloads [data-dl]', el).focus({ preventScroll: true }); return; }
      if (b.dataset.dl) {
        const kind = b.dataset.dl; const s = $('#dls-' + kind, el);
        b.disabled = true; s.textContent = 'Preparing your file…';
        try {
          const ctx = { input, model: m, sens, ready, caseRecord, sectors: D.sectors, engine: E, audience: mode, similar: sim };
          if (kind === 'word' && typeof Chart !== 'undefined') ctx.charts = await root.TenorChartImages.renderReportCharts(Chart, m);
          const f = await root.TenorExport.download(kind, ctx);
          s.textContent = 'Downloaded ' + f.name;
        } catch (err) { s.textContent = 'Could not build the file: ' + err.message; }
        b.disabled = false; return;
      }
      if (b.id === 'save-case') {
        const uc = P.toUserCase(p, m); const all = P.userCases().filter((c) => c.id !== uc.id); all.push(uc); P.saveUserCases(all);
        A.toast('Saved to your library. It will now appear in similar projects.'); return;
      }
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.doc) { p.input.documents[t.dataset.doc] = t.checked; P.save(p); A.render(); setTimeout(() => { const again = $('[data-doc="' + CSS.escape(t.dataset.doc) + '"]', el); if (again) again.focus(); }, 0); }
    });
    const tablist = $('[role="tablist"]', el);
    tablist.addEventListener('keydown', (e) => {
      const tabs = $$('[role="tab"]', tablist); const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); tabs[n].focus(); }
    });
    if (tabArg && tabArg !== 'overview') { const t = $('#tab-' + tab, el); if (t) t.focus({ preventScroll: true }); }
    void ready;
  }

  A.views.results = view;
})(typeof self !== 'undefined' ? self : this);
