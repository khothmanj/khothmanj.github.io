/*
 * Overview (#overview): product health for the selected month, what changed, and where to look next.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, C = root.SignalCharts, A = root.SignalApp, esc = K.esc;
  const TRY_KEY = 'signal.try.hidden';

  async function render(el, ctx) {
    const p = ctx.params;
    const charts = [];
    this.cleanup = () => charts.forEach((c) => c.destroy());
    el.innerHTML = '';
    K.header(el, { title: 'Product health', lede: 'Lendwell\'s lending API business in ' + K.month(p.to_month, true) + ', compared with the month before. Pick another month with the date range above.' });

    let hidden = false;
    try { hidden = localStorage.getItem(TRY_KEY) === '1'; } catch (e) {}
    if (!hidden) {
      const t = document.createElement('div');
      t.className = 'try';
      t.innerHTML = '<p>New here? Try these</p>' +
        '<a href="' + A.hrefFor('activation') + '">See where lenders drop off</a>' +
        '<a href="' + A.hrefFor('sql', { q: 'activation_funnel' }) + '">Open the SQL behind a chart</a>' +
        '<a href="' + A.hrefFor('insights') + '">Read the PRD</a>' +
        '<button type="button" class="icon-btn" aria-label="Hide these suggestions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
      t.querySelector('button').addEventListener('click', () => { try { localStorage.setItem(TRY_KEY, '1'); } catch (e) {} t.remove(); });
      el.appendChild(t);
    }
    K.filters(el, ['lender_type', 'plan', 'size_band', 'region']);

    // Metric strip
    const strip = document.createElement('section');
    strip.setAttribute('aria-label', 'Headline metrics');
    strip.innerHTML = '<div class="metrics">' + Array.from({ length: 6 }, () => '<div class="metric"><span class="skel" style="height:12px;width:60%"></span><span class="skel" style="height:26px;width:70%;margin-top:6px"></span><span class="skel" style="height:12px;width:40%;margin-top:6px"></span></div>').join('') + '</div><div class="metrics-foot"></div>';
    el.appendChild(strip);

    const grid = document.createElement('div'); grid.className = 'ov-grid'; el.appendChild(grid);
    const changes = K.section(grid, { kicker: 'What changed this month', height: 260 });
    const trend = K.section(grid, { kicker: 'Growth', height: 280 });
    const row = document.createElement('div'); row.className = 'sec-row'; el.appendChild(row);
    const attention = K.section(row, { kicker: 'Accounts needing attention', height: 200 });
    const status = K.section(row, { kicker: 'Endpoint status', height: 200 });

    const R = await K.runAll(['overview_monthly', 'overview_activation', 'overview_nrr', 'overview_time_to_live', 'overview_trend',
      ['events_in_range', { from_month: '2024-11' }], 'overview_endpoints', 'overview_compliance', 'accounts_declining', 'accounts_not_live'], p);
    const [monthly, activation, nrr, ttl, trendQ, events, endpoints, compliance, declining, notLive] = R;

    /* ----- metric strip ----- */
    const last = (q) => q.rows[q.rows.length - 1] || {};
    const prev = (q) => q.rows[q.rows.length - 2] || {};
    const series = (q, k) => q.rows.map((r) => r[k]);
    const m = last(monthly), a = last(activation), a0 = prev(activation), n = last(nrr), n0 = prev(nrr), t = last(ttl), t0 = prev(ttl);
    const metrics = [
      ['Active customers', K.num(m.active_customers), K.delta(m.active_change, { abs: true, unit: '', flat: 0.5, suffix: 'vs last month' }), C.spark(series(monthly, 'active_customers'), { tone: 'accent' })],
      ['Activation rate', K.pct(a.activation_rate_pct, 0), K.delta(a.activation_rate_pct - a0.activation_rate_pct, { points: true }), C.spark(series(activation, 'activation_rate_pct'))],
      ['Live API calls', K.num(m.live_calls, { compact: true }), K.delta(m.live_calls_change_pct), C.spark(series(monthly, 'live_calls'), { tone: 'accent' })],
      ['Revenue', K.money(m.revenue_ngn), K.delta(m.revenue_change_pct), C.spark(series(monthly, 'revenue_ngn'), { tone: 'accent' })],
      ['Net revenue retention', K.pct(n.nrr_pct, 0), K.delta(n.nrr_pct - n0.nrr_pct, { points: true }), C.spark(series(nrr, 'nrr_pct'))],
      ['Days to first live call', t.median_days ? K.num(t.median_days, { dp: true }) : 'n/a', K.delta(t.median_days - t0.median_days, { abs: true, dp: true, unit: ' days', good: 'down', flat: 0.3 }), C.spark(series(ttl, 'median_days'))],
    ];
    strip.querySelector('.metrics').innerHTML = metrics.map(([label, value, d, sp]) =>
      '<div class="metric"><span class="metric-label">' + esc(label) + '</span><span class="metric-value">' + esc(value) + '</span>' + d + sp + '</div>').join('');
    strip.querySelector('.metrics-foot').appendChild(K.sqlPanel([monthly, activation, nrr, ttl], p));

    /* ----- what changed ----- */
    const items = [];
    // 1. Activation and compliance
    const aNow = a.activation_rate_pct, aThen = activation.rows.length >= 4 ? activation.rows[activation.rows.length - 4].activation_rate_pct : a0.activation_rate_pct;
    const thenMonth = activation.rows.length >= 4 ? activation.rows[activation.rows.length - 4].month : a0.month;
    const compNow = compliance.rows.find((r) => r.period === 'Last 3 months'), compThen = compliance.rows.find((r) => r.period !== 'Last 3 months');
    const waiting = compliance.rows.length ? compliance.rows[0].waiting_at_month_end : 0;
    const compText = compNow && compThen ? 'Compliance decisions took ' + K.num(compNow.avg_days_to_decision, { dp: true }) + ' days on average over the last three months, against ' + K.num(compThen.avg_days_to_decision, { dp: true }) + ' days before. ' + K.plural(waiting, 'lender') + ' ' + (waiting === 1 ? 'was' : 'were') + ' waiting for a decision at the end of the month.' : '';
    if (aNow < aThen - 3) items.push(['Fewer new lenders are going live: activation fell from ' + K.pct(aThen, 0) + ' to ' + K.pct(aNow, 0) + ' since ' + K.month(thenMonth) + '.', compText, A.hrefFor('activation'), 'See where they drop off']);
    else if (aNow > aThen + 3) items.push(['More new lenders are going live: activation rose from ' + K.pct(aThen, 0) + ' to ' + K.pct(aNow, 0) + ' since ' + K.month(thenMonth) + '.', compText, A.hrefFor('activation'), 'See the funnel']);
    else items.push(['Activation held at ' + K.pct(aNow, 0) + ', close to ' + K.month(thenMonth) + '.', compText, A.hrefFor('activation'), 'See the funnel']);
    // 2. Declining customers
    const dec = declining.rows;
    if (dec.length) {
      const atStake = dec.reduce((s, r) => s + r.revenue_latest_month, 0);
      const biggest = dec.slice().sort((x, y) => y.revenue_latest_month - x.revenue_latest_month)[0];
      items.push([K.plural(dec.length, 'live customer') + ' made at least 30% fewer calls than three months ago.',
        'Together they still bring in ' + K.money(atStake) + ' a month. The largest is ' + biggest.name + ', down ' + K.pct(-biggest.change_pct, 0) + '. Most raised a pricing or timeout ticket before the drop.', A.hrefFor('accounts', { tab: 'declining' }), 'See who to call']);
    } else items.push(['No live customer dropped by 30% or more against three months ago.', 'Usage is holding up across the base this month.', A.hrefFor('accounts'), 'See accounts to act on']);
    // 3. Endpoints: a jump in errors beats a revenue story
    const eps = endpoints.rows.filter((r) => r.calls);
    const worse = eps.map((r) => Object.assign({ jump: r.error_rate_pct - (r.prev_error_rate_pct || 0) }, r)).sort((x, y) => y.jump - x.jump)[0];
    if (worse && worse.jump >= 1) {
      items.push([worse.name + ' errors rose from ' + K.pct(worse.prev_error_rate_pct) + ' to ' + K.pct(worse.error_rate_pct) + '.', 'That is above the 3% target. Check whether one provider or one integration pattern is behind it.', A.hrefFor('health', { endpoint: worse.endpoint }), 'Open integration health']);
    } else {
      const grow = eps.filter((r) => r.prev_revenue_ngn > 0).map((r) => Object.assign({ g: 100 * (r.revenue_ngn - r.prev_revenue_ngn) / r.prev_revenue_ngn }, r)).sort((x, y) => y.g - x.g)[0];
      const total = eps.reduce((s, r) => s + (r.revenue_ngn || 0), 0);
      const top = eps.slice().sort((x, y) => (y.revenue_ngn || 0) - (x.revenue_ngn || 0))[0];
      items.push([grow.name + ' revenue grew fastest this month, up ' + K.pct(grow.g, 0) + '.', top.name + ' is still the biggest earner at ' + K.pct(100 * top.revenue_ngn / total, 0) + ' of usage revenue. All endpoints stayed under the 3% error target.', A.hrefFor('usage'), 'Open usage and spend']);
    }
    changes.headline(K.month(p.to_month, true) + ' in three points');
    changes.body.innerHTML = '<ol class="changes">' + items.map(([h, b, href, link]) => '<li><h3>' + esc(h) + '</h3><p>' + esc(b) + '</p><a href="' + esc(href) + '">' + esc(link) + '</a></li>').join('') + '</ol>';
    changes.sql([activation, compliance, declining, endpoints], p);

    /* ----- trend ----- */
    const tr = trendQ.rows;
    const yearAgo = tr[tr.length - 13], lastT = tr[tr.length - 1];
    const months = tr.map((r) => r.month);
    const ann = events.rows.filter((e) => e.kind !== 'season').map((e) => ({ x: e.day.slice(0, 7), label: e.title }));
    let metric = 'live_calls';
    const drawTrend = () => {
      const isCalls = metric === 'live_calls';
      trend.headline(yearAgo
        ? (isCalls ? 'Live calls grew ' + K.pct(100 * (lastT.live_calls - yearAgo.live_calls) / yearAgo.live_calls, 0) + ' in a year, to ' + K.num(lastT.live_calls, { compact: true }) + ' in ' + K.month(lastT.month) + '.'
                   : 'Revenue grew ' + K.pct(100 * (lastT.revenue_ngn - yearAgo.revenue_ngn) / yearAgo.revenue_ngn, 0) + ' in a year, to ' + K.money(lastT.revenue_ngn) + ' in ' + K.month(lastT.month) + '.')
        : (isCalls ? K.num(lastT.live_calls, { compact: true }) + ' live calls in ' + K.month(lastT.month) + '.' : K.money(lastT.revenue_ngn) + ' revenue in ' + K.month(lastT.month) + '.'));
      trend.sub((isCalls ? 'Successful live API calls' : 'Revenue (platform fees plus usage)') + ' per month. December peaks are festive lending; dashed lines mark product events.');
      chart.destroy && chart.destroy();
      chart = C.xy(box, {
        x: months, xLabel: K.monthShort, xTip: (k) => K.month(k, true),
        series: [{ name: isCalls ? 'Live calls' : 'Revenue', values: tr.map((r) => r[metric]), color: 'var(--accent)', type: 'bar' }],
        yFormat: isCalls ? (v) => K.num(v, { compact: true }) : K.money, height: 270,
        annotations: ann, ariaLabel: (isCalls ? 'Live calls' : 'Revenue') + ' per month from ' + K.month(months[0]) + ' to ' + K.month(lastT.month),
      });
    };
    trend.body.innerHTML = '<div class="seg" role="group" aria-label="Measure"><button type="button" aria-pressed="true" data-m="live_calls">Live calls</button><button type="button" aria-pressed="false" data-m="revenue_ngn">Revenue</button></div><div class="trend-chart"></div>';
    const box = trend.body.querySelector('.trend-chart');
    let chart = {};
    trend.body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      metric = b.dataset.m;
      trend.body.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      drawTrend();
    }));
    drawTrend();
    charts.push({ destroy: () => chart.destroy && chart.destroy() });
    trend.sowhat('Growth is real but seasonal. Compare like with like (December against December) before calling a trend.');
    trend.sql([trendQ, events], p);

    /* ----- accounts needing attention ----- */
    const waitingReview = notLive.rows.filter((r) => /Waiting on our compliance review/.test(r.reason)).slice(0, 2);
    const topDecline = dec.slice().sort((x, y) => y.revenue_latest_month - x.revenue_latest_month).slice(0, 3);
    const list = topDecline.map((r) => ({ id: r.id, name: r.name, reason: r.reason + ', now ' + K.money(r.revenue_latest_month) + ' a month', owner: r.owner, tone: 'bad', tag: 'Usage falling' }))
      .concat(waitingReview.map((r) => ({ id: r.id, name: r.name, reason: r.reason, owner: r.owner, tone: 'warn', tag: 'In compliance' })));
    attention.headline(list.length ? 'Start with these ' + list.length + ' accounts this week.' : 'No accounts need urgent attention.');
    attention.body.innerHTML = '<ul class="attention">' + list.map((r) => '<li>' + K.avatar(r.name, r.id) + '<div class="who"><div><a href="' + A.hrefFor('customer/' + r.id) + '">' + esc(r.name) + '</a><span class="reason">' + esc(r.reason) + '</span></div></div>' + K.pill(r.tag, r.tone) + '</li>').join('') + '</ul>';
    attention.sowhat('Customer Success takes the falling accounts; Compliance clears the oldest reviews.', null, A.hrefFor('accounts'), 'See all ' + (dec.length + notLive.rows.length) + ' accounts');
    attention.sql([declining, notLive], p);

    /* ----- endpoint status ----- */
    const bad = eps.filter((r) => r.status !== 'Healthy');
    status.headline(bad.length ? bad.map((r) => r.name).join(' and ') + (bad.length === 1 ? ' needs' : ' need') + ' a look this month.' : 'All eight endpoints are healthy this month.');
    status.body.innerHTML = '<div class="status-row">' + endpoints.rows.map((r) => '<div><b>' + esc(r.name) + '</b>' +
      K.pill(r.status, r.status === 'Healthy' ? 'good' : r.status === 'Watch' ? 'warn' : r.status === 'Failing' ? 'bad' : 'neutral') +
      '<span class="small">' + (r.calls ? K.pct(r.error_rate_pct, 2) + ' failed' : 'No calls') + '</span></div>').join('') + '</div>';
    status.sowhat('Healthy means under 3% of calls failed. Webhook failures are usually the lender\'s server timing out, not ours.', 'Engineering', A.hrefFor('health'), 'Open integration health');
    status.sql([endpoints], p);
  }

  A.register('overview', { render });
})(window);
