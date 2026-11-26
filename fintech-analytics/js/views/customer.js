/*
 * Customer 360 (#customer/:id): one lender's onboarding, usage, spend, errors, billing and support,
 * with a plain-English summary of the account's health.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, C = root.SignalCharts, A = root.SignalApp, esc = K.esc;
  const STAGES = [['signed_up_at', 'Signed up'], ['sandbox_keys_at', 'Sandbox keys'], ['first_sandbox_call_at', 'First sandbox call'], ['kyc_approved_at', 'Compliance approved'], ['production_keys_at', 'Live keys'], ['first_live_call_at', 'First live call'], ['reached_1000_at', '1,000 live calls']];
  const EP_COLOR = { 'BVN verification': 'var(--c1)', 'NIN verification': 'var(--c2)', 'Credit bureau report': 'var(--c3)', 'Bank statement analysis': 'var(--c4)', 'Direct debit mandate': 'var(--c5)', Disbursement: 'var(--c6)', 'Repayment collection': 'var(--c7)', 'Webhook delivery': 'var(--c8)' };

  async function render(el, ctx) {
    const id = parseInt(ctx.route.args[0], 10) || 48;
    const p = Object.assign({}, ctx.params, { customer: id });
    const charts = [];
    this.cleanup = () => charts.forEach((c) => c.destroy());
    el.innerHTML = '<a class="back" href="' + A.hrefFor('accounts') + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>Back to accounts to act on</a><div class="c360-head"><span class="skel" style="height:40px;width:50%"></span></div>';

    const [prof, timeline, usage, errors, invoices, tickets, list, notLive, declining] = await K.runAll([
      'customer_profile', 'customer_timeline', ['customer_usage', { from_month: '2024-11' }], 'customer_errors', 'customer_invoices', 'customer_tickets', 'customer_list', 'accounts_not_live', 'accounts_declining'], p);
    const c = prof.rows[0];
    if (!c) { el.innerHTML += '<div class="empty"><h1 class="headline">No customer with id ' + id + '</h1><p class="muted">Pick one from <a href="' + A.hrefFor('accounts') + '">accounts to act on</a>.</p></div>'; el.querySelector('.c360-head').remove(); return; }
    document.title = c.name + ' · Signal';

    /* ----- status and summary ----- */
    const months = {};
    usage.rows.forEach((r) => { months[r.month] = months[r.month] || { calls: 0, revenue: 0 }; months[r.month].calls += r.live_calls; months[r.month].revenue += r.revenue_ngn; });
    const mKeys = Object.keys(months).filter((m) => m <= p.to_month).sort();
    const latest = mKeys[mKeys.length - 1];
    const threeBack = mKeys[mKeys.length - 4];
    const change = latest && threeBack && months[threeBack].calls ? 100 * (months[latest].calls - months[threeBack].calls) / months[threeBack].calls : null;
    const nl = notLive.rows.find((r) => r.id === id);
    const dec = declining.rows.find((r) => r.id === id);
    const openTickets = tickets.rows.filter((t) => t.status !== 'solved');
    const billingIssues = invoices.rows.filter((i) => i.check_result !== 'Matches');
    const recentErr = errors.rows.slice(-4);
    const errRate = recentErr.length ? 100 * recentErr.reduce((s, r) => s + r.calls * r.error_rate_pct / 100, 0) / recentErr.reduce((s, r) => s + r.calls, 0) : null;

    let status, tone, headline;
    if (c.cancelled_date) { status = 'Cancelled'; tone = 'neutral'; headline = 'Cancelled on ' + K.day(c.cancelled_date) + '.'; }
    else if (!c.first_live_call_at) { status = nl ? nl.status : 'Not live'; tone = 'warn'; headline = nl ? nl.reason + '.' : 'Signed up on ' + K.day(c.signup_date) + ' and not live yet.'; }
    else if (dec) { status = 'Usage falling'; tone = 'bad'; headline = 'Live, but usage is down ' + K.pct(-dec.change_pct, 0) + ' in three months.'; }
    else if (change !== null && change > 15) { status = 'Growing'; tone = 'good'; headline = 'Healthy and growing: live calls up ' + K.pct(change, 0) + ' in three months.'; }
    else { status = 'Healthy'; tone = 'good'; headline = 'Healthy: steady usage and no open problems.'; }

    const facts = [];
    if (c.first_live_call_at) facts.push('Live since ' + K.day(c.first_live_call_at) + '. ' + K.money(c.revenue_last_12_months) + ' in revenue over the last 12 months, active in ' + c.active_months_last_12 + ' of them.');
    else facts.push('Signed up on ' + K.day(c.signup_date) + '. Furthest stage: ' + STAGES[c.furthest_stage - 1][1].toLowerCase() + '.');
    if (latest && !c.cancelled_date && c.first_live_call_at) facts.push(K.num(months[latest].calls) + ' successful live calls in ' + K.month(latest) + (change !== null ? ', ' + (change >= 0 ? 'up ' : 'down ') + K.pct(Math.abs(change), 0) + ' on three months before.' : '.'));
    if (errRate !== null) facts.push(K.pct(errRate, 1) + ' of calls failed over the last four weeks' + (errRate >= 3 ? ', above the 3% target.' : ', under the 3% target.'));
    facts.push(openTickets.length ? K.plural(openTickets.length, 'open ticket') + ', latest: "' + openTickets[0].subject + '".' : 'No open support tickets.');
    if (billingIssues.length) facts.push(K.plural(billingIssues.length, 'invoice') + ' ' + (billingIssues.length === 1 ? 'does' : 'do') + ' not match the ledger. See Data checks.');
    const action = nl ? [nl.next_action, nl.owner] : dec ? [dec.next_action, dec.owner] : c.cancelled_date ? ['Close the account in billing and record the reason for leaving', 'Customer Success'] : ['No action needed. Review again next month', c.account_manager === 'Self-serve' ? 'Customer Success' : c.account_manager];

    const head = el.querySelector('.c360-head');
    head.innerHTML =
      '<div class="c360-id">' + K.avatar(c.name, c.id).replace('class="avatar"', 'class="avatar avatar-lg"') +
        '<div><h1>' + esc(c.name) + '</h1><p class="c360-meta">' + [K.label('lender_type', c.lender_type), K.label('plan', c.plan) + ' plan', K.label('size_band', c.size_band), c.region, K.label('pattern', c.integration_pattern), c.account_manager === 'Self-serve' ? 'Self-serve' : 'Account manager: ' + c.account_manager].map(esc).join('<span aria-hidden="true"> · </span>') + '</p></div>' +
        K.pill(status, tone) + '</div>' +
      '<label class="filter c360-pick"><span>Switch customer</span><select>' + list.rows.map((r) => '<option value="' + r.id + '"' + (r.id === id ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select></label>';
    head.querySelector('select').addEventListener('change', (e) => { location.hash = A.hrefFor('customer/' + e.target.value); });

    const summary = K.section(el, { kicker: 'Account health', height: 80 });
    summary.headline(headline);
    summary.body.innerHTML = '<ul class="facts">' + facts.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>';
    summary.sowhat(esc(action[0]) + '.', action[1]);
    summary.sql([prof, notLive, declining], p);

    /* ----- onboarding stepper ----- */
    const ob = K.section(el, { kicker: 'Onboarding', height: 90 });
    ob.headline(c.first_live_call_at ? 'Went live ' + Math.round((Date.parse(c.first_live_call_at.replace(' ', 'T')) - Date.parse(c.signup_date)) / 864e5) + ' days after signing up.' : 'Reached ' + STAGES[c.furthest_stage - 1][1].toLowerCase() + ', and no further yet.');
    const stageTimes = timeline.rows.filter((r) => r.kind === 'Onboarding');
    const at = (label) => { const map = { 'Signed up': 'signed up', 'Sandbox keys': 'sandbox keys issued', 'First sandbox call': 'first sandbox call', 'Compliance approved': 'kyc approved', 'Live keys': 'production keys issued', 'First live call': 'first live call', '1,000 live calls': 'reached 1000 live calls' }; const r = stageTimes.find((x) => x.detail === map[label]); return r ? r.at : null; };
    let prevT = null;
    ob.body.innerHTML = '<ol class="stepper">' + STAGES.map(([, label], i) => {
      const t = at(label);
      const gap = t && prevT ? Math.round((Date.parse(t.replace(' ', 'T')) - Date.parse(prevT.replace(' ', 'T'))) / 864e5) : null;
      if (t) prevT = t;
      const state = t ? 'done' : i === c.furthest_stage ? 'current' : 'todo';
      return '<li class="' + state + '"><span class="dot" aria-hidden="true"></span><b>' + esc(label) + '</b><span>' + (t ? K.day(t) : state === 'current' ? 'Next step' : 'Not yet') + '</span>' + (gap !== null && i > 0 ? '<small>' + (gap < 1 ? 'same day' : K.plural(gap, 'day') + ' later') + '</small>' : '') + '</li>';
    }).join('') + '</ol>';
    ob.sql(timeline, p);

    /* ----- usage and spend ----- */
    const us = K.section(el, { kicker: 'Usage and spend', height: 260 });
    if (!usage.rows.length) { us.headline('No live usage yet.'); us.body.innerHTML = '<div class="empty"><p class="muted">Live calls will show here once this lender goes live.</p></div>'; }
    else {
      const allMonths = [...new Set(usage.rows.map((r) => r.month))].sort();
      const eps = [...new Set(usage.rows.map((r) => r.endpoint))];
      const top = eps.map((e) => [e, usage.rows.filter((r) => r.endpoint === e).reduce((s, r) => s + r.revenue_ngn, 0)]).sort((a, b) => b[1] - a[1]);
      const totalRev = top.reduce((s, x) => s + x[1], 0);
      us.headline(top[0][0] + ' brings in ' + K.pct(100 * top[0][1] / totalRev, 0) + ' of this lender\'s spend.');
      us.sub('Revenue per month by endpoint, all 24 months. Hover or use the arrow keys for the numbers.');
      const box = document.createElement('div'); us.body.innerHTML = ''; us.body.appendChild(box);
      charts.push(C.xy(box, {
        x: allMonths, xLabel: K.monthShort, xTip: (k) => K.month(k, true), stacked: true, legend: true, height: 250,
        series: eps.map((e) => ({ name: e, type: 'bar', color: EP_COLOR[e] || 'var(--c8)', values: allMonths.map((m) => { const r = usage.rows.find((x) => x.month === m && x.endpoint === e); return r ? r.revenue_ngn : 0; }) })),
        yFormat: K.money, ariaLabel: 'Revenue per month by endpoint for ' + c.name,
      }));
    }
    us.sql(usage, Object.assign({}, p, { from_month: '2024-11' }));

    /* ----- errors ----- */
    const er = K.section(el, { kicker: 'Errors', height: 220 });
    if (!errors.rows.length) { er.headline('No calls in this date range.'); er.body.innerHTML = ''; }
    else {
      const worst = errors.rows.reduce((a, b) => (b.error_rate_pct > a.error_rate_pct ? b : a));
      er.headline(worst.error_rate_pct >= 3 ? 'Failed calls peaked at ' + K.pct(worst.error_rate_pct) + ' in the week of ' + K.day(worst.week_starting) + '.' : 'Failed calls stayed under the 3% target every week.');
      er.sub('Share of calls that failed each week, ' + K.month(p.from_month) + ' to ' + K.month(p.to_month) + '. The shaded area is above the 3% target.');
      const box = document.createElement('div'); er.body.innerHTML = ''; er.body.appendChild(box);
      charts.push(C.xy(box, {
        x: errors.rows.map((r) => r.week_starting), xLabel: K.dayShort, xTip: (d) => 'Week of ' + K.day(d), height: 210,
        series: [{ name: 'Failed calls', values: errors.rows.map((r) => r.error_rate_pct), color: 'var(--accent)', area: true }],
        yFormat: (v) => K.pct(v, 1), threshold: { y: 3, label: 'Target: under 3%' }, ariaLabel: 'Weekly error rate for ' + c.name,
      }));
    }
    er.sql(errors, p);

    /* ----- invoices and tickets ----- */
    const row = document.createElement('div'); row.className = 'sec-row'; el.appendChild(row);
    const inv = K.section(row, { kicker: 'Billing', height: 160 });
    inv.headline(!invoices.rows.length ? 'No invoices yet.' : billingIssues.length ? K.plural(billingIssues.length, 'invoice') + ' ' + (billingIssues.length === 1 ? 'does' : 'do') + ' not match the ledger.' : 'Every invoice matches the ledger.');
    const invBox = document.createElement('div'); inv.body.innerHTML = ''; inv.body.appendChild(invBox);
    K.sortable(invBox, invoices.rows.slice(0, 24), [
      { key: 'month', label: 'Month', render: (r) => K.month(r.month) },
      { key: 'invoiced_ngn', label: 'Invoiced', num: true, render: (r) => K.money(r.invoiced_ngn, { full: true }) },
      { key: 'check_result', label: 'Ledger', render: (r) => K.pill(r.check_result, r.check_result === 'Matches' ? 'good' : 'bad') },
    ], { caption: 'Invoices', empty: 'No invoices.' });
    inv.sql(invoices, p);
    const tk = K.section(row, { kicker: 'Support', height: 160 });
    tk.headline(tickets.rows.length ? K.plural(tickets.rows.length, 'ticket') + ', ' + openTickets.length + ' still open.' : 'No support tickets.');
    const tkBox = document.createElement('div'); tk.body.innerHTML = ''; tk.body.appendChild(tkBox);
    K.sortable(tkBox, tickets.rows.slice(0, 20), [
      { key: 'opened_at', label: 'Opened', render: (r) => K.day(r.opened_at) },
      { key: 'subject', label: 'Subject', render: (r) => esc(r.subject) + '<small class="muted"> ' + esc(K.label('category', r.category)) + '</small>' },
      { key: 'status', label: 'Status', render: (r) => K.pill(r.status === 'solved' ? 'Solved' : r.status === 'open' ? 'Open' : 'Pending', r.status === 'solved' ? 'neutral' : 'warn') },
    ], { caption: 'Support tickets', empty: 'No tickets.' });
    tk.sql(tickets, p);

    /* ----- activity ----- */
    const act = K.section(el, { kicker: 'Activity', height: 120 });
    act.headline('Everything that happened with this lender, oldest first.');
    act.body.innerHTML = '<ol class="activity">' + timeline.rows.map((r) => '<li><time>' + K.day(r.at) + '</time><span class="pill plain neutral">' + esc(r.kind) + '</span><span>' + esc(r.detail.charAt(0).toUpperCase() + r.detail.slice(1)) + '</span></li>').join('') + '</ol>';
    act.sql(timeline, p);
  }

  A.register('customer', { render });
})(window);
