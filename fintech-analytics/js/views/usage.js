/*
 * Usage and spend (#usage): calls and revenue by endpoint, concentration, movers and value by segment.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, C = root.SignalCharts, A = root.SignalApp, esc = K.esc;
  const EP_COLOR = { bvn: 'var(--c1)', nin: 'var(--c2)', bureau: 'var(--c3)', statement: 'var(--c4)', mandate: 'var(--c5)', disbursement: 'var(--c6)', collection: 'var(--c7)', webhook: 'var(--c8)' };

  async function render(el, ctx) {
    const p = ctx.params;
    const charts = [];
    this.cleanup = () => charts.forEach((c) => c.destroy());
    el.innerHTML = '';
    K.header(el, { title: 'Usage and spend', lede: 'How lenders use the APIs and what they spend, ' + K.month(p.from_month) + ' to ' + K.month(p.to_month) + '. Revenue is platform fees plus successful live calls at the price on the day.' });
    K.filters(el, ['lender_type', 'plan', 'size_band', 'region', 'endpoint'], p, p.endpoint ? 'With an endpoint selected, platform fees are left out because they are not tied to one endpoint.' : null);

    const main = K.section(el, { kicker: 'Calls and revenue by endpoint', height: 320 });
    const conc = K.section(el, { kicker: 'Concentration', height: 260 });
    const row = document.createElement('div'); row.className = 'sec-row'; el.appendChild(row);
    const movers = K.section(row, { kicker: 'Movers', height: 220 });
    const seg = K.section(row, { kicker: 'Value by segment', height: 220 });

    const [U, Fe, Ev, Co, Mo, Ar] = await K.runAll(['usage_by_endpoint', 'usage_fees', 'events_in_range', 'usage_concentration', 'usage_movers', 'usage_arpc'], p);

    /* ----- calls and revenue by endpoint ----- */
    const months = [...new Set(U.rows.map((r) => r.month))].sort();
    const eps = K.ENDPOINT_ORDER.filter((e) => U.rows.some((r) => r.endpoint === e));
    const val = (m, e, k) => { const r = U.rows.find((x) => x.month === m && x.endpoint === e); return r ? r[k] : 0; };
    const fees = Object.fromEntries(Fe.rows.map((r) => [r.month, r.platform_fees_ngn]));
    const ann = Ev.rows.filter((e) => e.kind !== 'season').map((e) => ({ x: e.day.slice(0, 7), label: e.title }));
    let measure = 'revenue_ngn';
    const box = document.createElement('div');
    main.body.innerHTML = '<div class="seg" role="group" aria-label="Measure"><button type="button" aria-pressed="true" data-m="revenue_ngn">Revenue</button><button type="button" aria-pressed="false" data-m="live_calls">Live calls</button></div>';
    main.body.appendChild(box);
    let chart = null;
    const draw = () => {
      const rev = measure === 'revenue_ngn';
      const series = eps.map((e) => ({ name: K.label('endpoint', e), type: 'bar', color: EP_COLOR[e], values: months.map((m) => val(m, e, measure)) }));
      if (rev && !p.endpoint) series.push({ name: 'Platform fees', type: 'bar', color: 'var(--c-muted)', values: months.map((m) => fees[m] || 0) });
      const totals = months.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
      const first = totals[0], last = totals[totals.length - 1];
      const byEp = eps.map((e) => [e, months.reduce((s, m) => s + val(m, e, measure), 0)]).sort((a, b) => b[1] - a[1]);
      const all = totals.reduce((a, b) => a + b, 0);
      if (!months.length) { main.headline('No usage for these filters.'); box.innerHTML = ''; return; }
      main.headline((rev ? 'Revenue' : 'Live calls') + (last >= first ? ' grew ' : ' fell ') + K.pct(Math.abs(100 * (last - first) / first), 0) + ' from ' + K.month(months[0]) + ' to ' + K.month(months[months.length - 1]) + '. ' +
        (eps.length > 1 ? K.label('endpoint', byEp[0][0]) + (rev ? ' brings in ' : ' makes up ') + K.pct(100 * byEp[0][1] / all, 0) + ' of ' + (rev ? 'the total.' : 'calls.') : ''));
      main.sub((rev ? 'Revenue' : 'Successful live calls') + ' per month by endpoint' + (rev && !p.endpoint ? ', with platform fees on top' : '') + '. Dashed lines mark product events.');
      if (chart) chart.destroy();
      chart = C.xy(box, { x: months, xLabel: K.monthShort, xTip: (k) => K.month(k, true), series, stacked: true, legend: true, height: 300, yFormat: rev ? K.money : (v) => K.num(v, { compact: true }), annotations: ann, ariaLabel: (rev ? 'Revenue' : 'Live calls') + ' per month by endpoint' });
    };
    main.body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { measure = b.dataset.m; main.body.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
    draw();
    charts.push({ destroy: () => chart && chart.destroy() });
    main.sowhat('Credit checks carry the business. The bureau price rise in September 2025 lifted revenue more than it cut volume, so pricing has room, but watch Starter plans, which cut their bureau calls.', 'Product and Commercial');
    main.sql([U, Fe, Ev], p);

    /* ----- concentration ----- */
    const cr = Co.rows;
    if (!cr.length) { conc.headline('No paying customers for these filters.'); conc.body.innerHTML = ''; }
    else {
      const top10 = cr.filter((r) => r.rank <= 10).reduce((s, r) => s + r.pct_of_revenue, 0);
      const to80 = (cr.find((r) => r.cumulative_pct >= 80) || cr[cr.length - 1]).rank;
      conc.headline('The top 10 of ' + cr.length + ' paying customers bring in ' + K.pct(top10, 0) + ' of revenue. Just ' + to80 + ' make up 80%.');
      conc.sub('Left: share of revenue as you add customers from biggest to smallest. Right: the ten biggest.');
      conc.body.innerHTML = '<div class="conc"><div class="conc-chart"></div><div class="conc-list"></div></div>';
      charts.push(C.xy(conc.body.querySelector('.conc-chart'), {
        x: cr.map((r) => r.rank), xLabel: (r) => '#' + r, xTip: (r) => { const x = cr[r - 1]; return '#' + r + ' ' + x.name; },
        series: [{ name: 'Cumulative share of revenue', values: cr.map((r) => r.cumulative_pct), color: 'var(--accent)', area: true }],
        yFormat: (v) => K.pct(v, 0), yMax: 100, height: 240, annotations: [{ x: 10, label: 'Top 10' }, { x: to80, label: '80%' }].filter((a, i, arr) => arr.findIndex((b) => b.x === a.x) === i),
        ariaLabel: 'Cumulative share of revenue by customer rank',
      }));
      C.hbars(conc.body.querySelector('.conc-list'), cr.slice(0, 10).map((r) => ({ label: r.name, sub: K.label('lender_type', r.lender_type), value: r.revenue_ngn, display: K.money(r.revenue_ngn) + ' · ' + K.pct(r.pct_of_revenue, 0), highlight: true })), { numbered: true });
    }
    if (cr.length) {
      const biggest = cr[0];
      conc.sowhat('Losing ' + biggest.name + ' alone would cost ' + K.pct(biggest.pct_of_revenue, 0) + ' of revenue. Every top-10 customer should have a named account manager and an alert when usage falls.', 'Account management');
    }
    conc.sql(Co, p);

    /* ----- movers ----- */
    const grow = Mo.rows.filter((r) => r.direction === 'Growing'), fall = Mo.rows.filter((r) => r.direction === 'Declining').reverse();
    movers.headline(grow.length && fall.length ? grow[0].name + ' grew fastest, up ' + K.pct(grow[0].change_pct, 0) + '. ' + fall[0].name + ' fell furthest, down ' + K.pct(-fall[0].change_pct, 0) + '.' : 'Not enough history to compare.');
    movers.sub('Revenue in the last three months against the three before, for customers paying at least ₦300k in the earlier period.');
    const item = (r) => '<li><a href="' + A.hrefFor('customer/' + r.id) + '">' + esc(r.name) + '</a><span class="' + (r.change_pct >= 0 ? 'pos' : 'neg') + '">' + (r.change_pct >= 0 ? '+' : '') + K.pct(r.change_pct, 0) + '</span><small>' + K.money(r.previous_3_months_ngn) + ' to ' + K.money(r.last_3_months_ngn) + '</small></li>';
    movers.body.innerHTML = '<div class="movers"><div><h3>Growing</h3><ol>' + grow.map(item).join('') + '</ol></div><div><h3>Declining</h3><ol>' + fall.map(item).join('') + '</ol></div></div>';
    movers.sowhat('Ask the fastest growers what changed, and use it in sales. Send the decliners to Accounts to act on.', 'Customer Success', A.hrefFor('accounts', { tab: 'declining' }), 'Open the list');
    movers.sql(Mo, p);

    /* ----- value by segment ----- */
    const lt = Ar.rows.filter((r) => r.dimension === 'Lender type'), pl = Ar.rows.filter((r) => r.dimension === 'Plan');
    seg.headline(lt.length ? K.label('lender_type', lt[0].segment) + ' customers are worth the most, at ' + K.money(lt[0].avg_monthly_revenue_ngn) + ' a month each on average.' : 'No paying customers for these filters.');
    seg.sub('Average monthly revenue per paying customer.');
    seg.body.innerHTML = '<h3 class="mini-h">By lender type</h3><div class="b1"></div><h3 class="mini-h">By plan</h3><div class="b2"></div>';
    C.hbars(seg.body.querySelector('.b1'), lt.map((r, i) => ({ label: K.label('lender_type', r.segment), sub: K.plural(r.customers, 'customer'), value: r.avg_monthly_revenue_ngn, display: K.money(r.avg_monthly_revenue_ngn), highlight: i === 0 })));
    C.hbars(seg.body.querySelector('.b2'), pl.map((r, i) => ({ label: K.label('plan', r.segment), sub: K.plural(r.customers, 'customer'), value: r.avg_monthly_revenue_ngn, display: K.money(r.avg_monthly_revenue_ngn), highlight: i === 0 })));
    seg.sowhat('Target the segments that are worth most per customer, but check activation for them first.', 'Marketing');
    seg.sql(Ar, p);
  }

  A.register('usage', { render });
})(window);
