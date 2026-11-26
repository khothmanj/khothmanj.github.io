/*
 * Integration health (#health): error rates and latency by endpoint, error types, patterns and regions,
 * and the customers hit hardest.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, C = root.SignalCharts, A = root.SignalApp, esc = K.esc;
  const ERROR_TARGET = 3; // % of calls
  const LATENCY_TARGET = { bvn: 1000, nin: 1500, bureau: 3000, statement: 6000, mandate: 2000, disbursement: 3000, collection: 2500, webhook: 800 };
  const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

  async function render(el, ctx) {
    const p = ctx.params;
    const charts = [];
    this.cleanup = () => charts.forEach((c) => c.destroy());
    el.innerHTML = '';
    K.header(el, { title: 'Integration health', lede: 'Failed calls and response times for every endpoint, ' + K.month(p.from_month) + ' to ' + K.month(p.to_month) + '. The target is under ' + ERROR_TARGET + '% failed calls a day.' });
    K.filters(el, ['lender_type', 'plan', 'size_band', 'region', 'endpoint']);

    const grid = K.section(el, { kicker: 'By endpoint, day by day', height: 360 });
    const types = K.section(el, { kicker: 'Who is at fault', height: 260 });
    const row = document.createElement('div'); row.className = 'sec-row'; el.appendChild(row);
    const pat = K.section(row, { kicker: 'Integration pattern and region', height: 240 });
    const worst = K.section(row, { kicker: 'Worst affected customers', height: 240 });

    const [D, T, P, W, Ev] = await K.runAll(['health_daily', 'health_error_types', 'health_by_pattern', 'health_worst_customers', 'events_in_range'], p);

    /* ----- small multiples ----- */
    const days = [...new Set(D.rows.map((r) => r.day))].sort();
    const eps = K.ENDPOINT_ORDER.filter((e) => D.rows.some((r) => r.endpoint === e));
    const byKey = new Map(D.rows.map((r) => [r.day + '|' + r.endpoint, r]));
    const incidents = Ev.rows.filter((e) => e.kind === 'incident');
    let measure = 'error_rate_pct';
    const peak = D.rows.reduce((a, b) => (b.error_rate_pct > (a ? a.error_rate_pct : -1) ? b : a), null);
    const draw = () => {
      const err = measure === 'error_rate_pct';
      const over = eps.map((e) => [e, days.filter((d) => { const r = byKey.get(d + '|' + e); return r && (err ? r.error_rate_pct >= ERROR_TARGET : r.p95_ms > LATENCY_TARGET[e]); }).length]);
      if (!days.length) { grid.headline('No calls for these filters.'); return; }
      if (err) {
        const inc = incidents.find((i) => peak.day >= i.day && peak.day <= addDays(i.day, 6));
        grid.headline(peak.error_rate_pct >= 8
          ? K.label('endpoint', peak.endpoint) + ' errors hit ' + K.pct(peak.error_rate_pct, 0) + ' on ' + K.day(peak.day) + (inc ? ', during the ' + inc.title.toLowerCase() + '.' : '.')
          : 'Every endpoint stayed close to the target. The worst day was ' + K.pct(peak.error_rate_pct) + ' on ' + K.label('endpoint', peak.endpoint) + '.');
        grid.sub('Share of calls that failed each day. The shaded band is above the ' + ERROR_TARGET + '% target; the amber block is a provider outage. Days over target are counted under each name.');
      } else {
        const worstLat = over.slice().sort((a, b) => b[1] - a[1])[0];
        grid.headline(worstLat[1] ? K.label('endpoint', worstLat[0]) + ' was slower than its target on ' + K.plural(worstLat[1], 'day') + '.' : 'Every endpoint stayed within its response-time target.');
        grid.sub('Daily p95 response time (95% of calls were faster than this), weighted by calls. Each endpoint has its own target.');
      }
      charts.splice(0).forEach((c) => c.destroy());
      const wrap = grid.body.querySelector('.multiples');
      wrap.innerHTML = eps.map((e, i) => '<figure class="mult"><figcaption><b>' + esc(K.label('endpoint', e)) + '</b><span>' + (over[i][1] ? K.plural(over[i][1], 'day') + ' over' : 'On target') + '</span></figcaption><div class="mult-chart"></div></figure>').join('');
      wrap.querySelectorAll('.mult-chart').forEach((box, i) => {
        const e = eps[i];
        const inc = e === 'bureau' ? incidents.find((x) => days.includes(x.day)) : null;
        charts.push(C.xy(box, {
          x: days, xLabel: K.dayShort, xTip: K.day, compact: true, height: 130,
          series: [{ name: err ? 'Failed calls' : 'p95', values: days.map((d) => { const r = byKey.get(d + '|' + e); return r ? r[measure] : null; }), color: 'var(--accent)', width: 1.4 }],
          yFormat: err ? (v) => K.pct(v, 1) : (v) => K.num(v) + ' ms', yTick: err ? (v) => K.pct(v, 0) : (v) => (v >= 1000 ? (v / 1000) + 's' : v + 'ms'),
          threshold: { y: err ? ERROR_TARGET : LATENCY_TARGET[e], label: '' },
          period: inc ? { from: inc.day, to: addDays(inc.day, 6), label: inc.title } : null,
          ariaLabel: K.label('endpoint', e) + (err ? ' daily failed call rate' : ' daily p95 response time'),
        }));
      });
    };
    grid.body.innerHTML = '<div class="seg" role="group" aria-label="Measure"><button type="button" aria-pressed="true" data-m="error_rate_pct">Failed calls</button><button type="button" aria-pressed="false" data-m="p95_ms">Response time</button></div><div class="multiples"></div>';
    grid.body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { measure = b.dataset.m; grid.body.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
    draw();
    grid.sowhat('Most days are fine. The outage needed a status page notice and a fallback bureau, not a code fix. Webhook failures sit near the target because lender servers time out, so give lenders retry settings.', 'Engineering');
    grid.sql([D, Ev], p);

    /* ----- error types ----- */
    const tr = T.rows;
    const tot = tr.reduce((a, r) => ({ up: a.up + r.provider_errors, to: a.to + r.timeouts, c4: a.c4 + r.request_errors_4xx, c5: a.c5 + r.our_errors_5xx }), { up: 0, to: 0, c4: 0, c5: 0 });
    const all = tot.up + tot.to + tot.c4 + tot.c5;
    const parts = [['up', 'Provider down', 'var(--c3)'], ['to', 'Timeouts', 'var(--c2)'], ['c4', 'Bad requests (4xx)', 'var(--c7)'], ['c5', 'Our errors (5xx)', 'var(--down)']];
    const lead = parts.slice().sort((a, b) => tot[b[0]] - tot[a[0]])[0];
    types.headline(all ? K.pct(100 * tot[lead[0]] / all, 0) + ' of failed calls were ' + lead[1].toLowerCase().replace(' (4xx)', '').replace(' (5xx)', '') + '. Our own errors were ' + K.pct(100 * tot.c5 / all, 0) + '.' : 'No failed calls for these filters.');
    types.sub('Failed calls by type for each endpoint, as a share of all its calls. Provider down means a bank, bureau or identity service behind us failed.');
    types.body.innerHTML = '<ul class="legend">' + parts.map((x) => '<li><span class="sw" style="background:' + x[2] + '"></span>' + x[1] + '</li>').join('') + '</ul>' +
      '<ul class="stackbars">' + tr.map((r) => {
        const segs = [['up', r.provider_errors], ['to', r.timeouts], ['c4', r.request_errors_4xx], ['c5', r.our_errors_5xx]];
        const scale = 100 / Math.max(...tr.map((x) => x.error_rate_pct), 1);
        return '<li><span class="sb-label">' + esc(r.endpoint) + '</span><span class="sb-track" title="' + esc(r.endpoint + ': ' + r.error_rate_pct + '% failed') + '">' + segs.map(([k, v]) => '<span style="width:' + ((100 * v / r.calls) * scale).toFixed(2) + '%;background:' + parts.find((x) => x[0] === k)[2] + '"></span>').join('') + '</span><span class="sb-value">' + K.pct(r.error_rate_pct, 2) + '</span></li>';
      }).join('') + '</ul>';
    const topTimeouts = tr.slice().sort((x, y) => y.timeouts - x.timeouts).slice(0, 2).map((r) => r.endpoint.toLowerCase());
    types.sowhat(all ? (lead[0] === 'to'
      ? 'Timeouts are the biggest cause, led by ' + topTimeouts.join(' and ') + '. Start there with retries and clearer timeout guidance. Track our own 5xx errors (' + K.pct(100 * tot.c5 / all, 0) + ' of failures) against an error budget.'
      : 'Fix the biggest cause first, and track our own 5xx errors (' + K.pct(100 * tot.c5 / all, 0) + ' of failures) against an error budget. Show provider outages on a status page so lenders know it is not them.') : 'Nothing to fix for these filters.', 'Engineering');
    types.sql(T, p);

    /* ----- pattern and region ----- */
    const pp = P.rows.filter((r) => r.dimension === 'Integration pattern'), rg = P.rows.filter((r) => r.dimension === 'Region');
    const agg = pp.find((r) => r.segment === 'partner_aggregator'), dir = pp.find((r) => r.segment === 'direct_api');
    pat.headline(agg && dir && dir.timeout_pct ? 'Partner aggregator integrations time out ' + (agg.timeout_pct / dir.timeout_pct).toFixed(1) + ' times as often as direct ones.' : 'Timeouts by integration pattern and region.');
    pat.sub('Share of calls that timed out. Response time is the call-weighted p95.');
    pat.body.innerHTML = '<h3 class="mini-h">By integration pattern</h3><div class="b1"></div><h3 class="mini-h">By region</h3><div class="b2"></div>';
    C.hbars(pat.body.querySelector('.b1'), pp.map((r, i) => ({ label: K.label('pattern', r.segment), sub: K.plural(r.customers, 'customer') + ', p95 ' + K.num(r.p95_ms) + ' ms', value: r.timeout_pct, display: K.pct(r.timeout_pct, 2), highlight: i === 0 })));
    C.hbars(pat.body.querySelector('.b2'), rg.map((r, i) => ({ label: r.segment, sub: K.plural(r.customers, 'customer') + ', p95 ' + K.num(r.p95_ms) + ' ms', value: r.timeout_pct, display: K.pct(r.timeout_pct, 2), highlight: i === 0 })));
    pat.sowhat('Agree timeout settings with the aggregator partner, and test a regional endpoint for lenders in the North.', 'Engineering');
    pat.sql(P, p);

    /* ----- worst customers ----- */
    const wr = W.rows;
    worst.headline(wr.length ? wr[0].name + ' had the most failed calls: ' + K.num(wr[0].errors) + ', mostly ' + wr[0].main_failure.toLowerCase() + '.' : 'No customers with enough calls to rank.');
    worst.sub('Customers with at least 1,000 calls, ranked by failed calls.');
    const tb = document.createElement('div'); worst.body.innerHTML = ''; worst.body.appendChild(tb);
    K.sortable(tb, wr, [
      { key: 'name', label: 'Customer', render: (r) => '<a href="' + A.hrefFor('customer/' + r.id) + '">' + esc(r.name) + '</a><small class="muted"> ' + esc(K.label('pattern', r.integration_pattern)) + '</small>' },
      { key: 'errors', label: 'Failed', num: true, render: (r) => K.num(r.errors) },
      { key: 'error_rate_pct', label: 'Rate', num: true, render: (r) => '<span class="' + (r.error_rate_pct >= ERROR_TARGET ? 'neg' : '') + '">' + K.pct(r.error_rate_pct, 2) + '</span>' },
      { key: 'main_failure', label: 'Main cause' },
      { key: 'error_tickets', label: 'Tickets', num: true },
    ], { sortKey: 'errors', dir: -1, caption: 'Worst affected customers' });
    worst.sowhat('Engineering reviews the top five with Customer Success, so each customer hears the cause from us before they raise a ticket.', 'Engineering');
    worst.sql(W, p);
  }

  A.register('health', { render });
})(window);
