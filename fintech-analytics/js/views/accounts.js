/*
 * Accounts to act on (#accounts): lenders who never went live and live customers whose
 * usage is falling, each with a reason, a next action and an owner.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, C = root.SignalCharts, A = root.SignalApp, UI = root.SignalSQLUI, esc = K.esc;
  const STATUS_TONE = { 'Not started': 'neutral', 'Sandbox only': 'info', 'In compliance': 'warn', 'Live keys, failing': 'bad', Dormant: 'neutral' };

  async function render(el, ctx) {
    const p = ctx.params;
    const tab = ctx.route.query.get('tab') === 'declining' ? 'declining' : 'not_live';
    el.innerHTML = '';
    K.header(el, { title: 'Accounts to act on', lede: 'Lenders who signed up but never went live, and live customers who are using us much less. Each one has a reason from their data, a next step and an owner. Figures are as of ' + K.month(p.to_month, true) + '.' });
    K.filters(el, ['lender_type', 'plan', 'size_band', 'region']);

    const [N, D] = await K.runAll(['accounts_not_live', 'accounts_declining'], p);
    const tabs = document.createElement('nav');
    tabs.className = 'tabs'; tabs.setAttribute('aria-label', 'Account lists');
    tabs.innerHTML =
      '<a href="' + A.hrefFor('accounts') + '"' + (tab === 'not_live' ? ' aria-current="page"' : '') + '>Never went live <span class="count">' + N.rows.length + '</span></a>' +
      '<a href="' + A.hrefFor('accounts', { tab: 'declining' }) + '"' + (tab === 'declining' ? ' aria-current="page"' : '') + '>Usage falling <span class="count">' + D.rows.length + '</span></a>';
    el.appendChild(tabs);

    const sec = K.section(el, { kicker: tab === 'declining' ? 'Live customers with falling usage' : 'Signed up, never live', height: 300 });
    const q = tab === 'declining' ? D : N;
    const rows = q.rows;

    if (tab === 'not_live') {
      const inComp = rows.filter((r) => r.status === 'In compliance');
      const onUs = inComp.filter((r) => /Waiting on our/.test(r.reason));
      const dormant = rows.filter((r) => r.status === 'Dormant').length;
      sec.headline(rows.length ? K.plural(rows.length - dormant, 'lender') + ' signed up recently enough to win back. ' + inComp.length + ' are stuck in compliance, and ' + onUs.length + ' of those are waiting on our own review.' : 'Every lender in this segment has gone live.');
      sec.sub('Signed up at least 14 days ago, no successful live call, not cancelled. Sorted by priority: lenders waiting on us first. ' + K.plural(dormant, 'account') + ' idle for over 180 days ' + (dormant === 1 ? 'is' : 'are') + ' marked Dormant and listed last.');
    } else {
      const atStake = rows.reduce((s, r) => s + r.revenue_latest_month, 0);
      sec.headline(rows.length ? K.plural(rows.length, 'live customer') + ' made at least 30% fewer calls in ' + K.month(p.to_month) + ' than three months before. They still bring in ' + K.money(atStake) + ' a month.' : 'No live customer in this segment dropped by 30% or more.');
      sec.sub('Successful live calls in ' + K.month(p.to_month) + ' against three months earlier. The last ticket is often the clue.');
    }

    // Local filters: owner, status, search.
    const owners = [...new Set(rows.map((r) => r.owner))].sort();
    const statuses = tab === 'not_live' ? [...new Set(rows.map((r) => r.status))] : [];
    const state = { owner: '', status: '', search: '' };
    sec.body.innerHTML =
      '<div class="owners" role="group" aria-label="Filter by owner">' + owners.map((o) => '<button type="button" class="owner-chip" data-owner="' + esc(o) + '" aria-pressed="false">' + esc(o) + ' <b>' + rows.filter((r) => r.owner === o).length + '</b></button>').join('') + '</div>' +
      '<div class="list-tools">' +
        (statuses.length ? '<label class="filter"><span>Status</span><select data-status><option value="">All statuses</option>' + statuses.map((s) => '<option>' + esc(s) + '</option>').join('') + '</select></label>' : '') +
        '<label class="filter grow"><span>Search</span><input type="search" data-search placeholder="Lender name" autocomplete="off"></label>' +
        '<button type="button" class="btn" data-export><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10"/></svg>Export CSV</button>' +
      '</div><p class="list-count" role="status"></p><div class="list"></div>';
    const listEl = sec.body.querySelector('.list');
    const countEl = sec.body.querySelector('.list-count');

    const lender = (r) => '<div class="who">' + K.avatar(r.name, r.id) + '<div><a href="' + A.hrefFor('customer/' + r.id) + '">' + esc(r.name) + '</a><small>' + esc(K.label('plan', r.plan) + (r.lender_type ? ', ' + K.label('lender_type', r.lender_type).toLowerCase() : ', ' + K.label('size_band', r.size_band).toLowerCase())) + '</small></div></div>';
    const cols = tab === 'not_live' ? [
      { key: 'name', label: 'Lender', render: lender, cls: 'lead' },
      { key: 'status', label: 'Status', render: (r) => K.pill(r.status, STATUS_TONE[r.status]), sort: (r) => r.priority * 100000 - r.days_in_stage },
      { key: 'reason', label: 'Why', render: (r) => '<span class="reason">' + esc(r.reason) + '</span>', nosort: true },
      { key: 'days_in_stage', label: 'Days', num: true, render: (r) => K.num(r.days_in_stage) },
      { key: 'owner', label: 'Owner' },
      { key: 'next_action', label: 'Next action', render: (r) => '<span class="action">' + esc(r.next_action) + '</span>', nosort: true },
    ] : [
      { key: 'name', label: 'Lender', render: lender },
      { key: 'last_12_months', label: 'Last 12 months', render: (r) => C.spark(String(r.last_12_months).split(','), { tone: 'down', zero: true }), nosort: true },
      { key: 'change_pct', label: 'Change', num: true, render: (r) => '<span class="neg">' + K.pct(r.change_pct, 0) + '</span>' },
      { key: 'revenue_latest_month', label: 'Revenue now', num: true, render: (r) => K.money(r.revenue_latest_month) },
      { key: 'last_ticket', label: 'Last ticket', render: (r) => r.last_ticket ? '<span class="reason">' + esc(r.last_ticket) + '</span><small class="muted"> ' + esc(K.label('category', r.last_ticket_category)) + '</small>' : '<span class="muted">None</span>', nosort: true },
      { key: 'owner', label: 'Owner' },
      { key: 'next_action', label: 'Next action', render: (r) => '<span class="action">' + esc(r.next_action) + '</span>', nosort: true },
    ];
    const filtered = () => rows.filter((r) => (!state.owner || r.owner === state.owner) && (!state.status || r.status === state.status) && (!state.search || r.name.toLowerCase().includes(state.search)));
    const table = K.sortable(listEl, filtered(), cols, { stack: true, caption: tab === 'not_live' ? 'Lenders who never went live' : 'Live customers with falling usage', sortKey: tab === 'not_live' ? 'status' : 'change_pct', dir: 1, empty: 'No accounts match. Clear the owner, status or search.' });
    // Mark the lender cell for the stacked mobile layout.
    const markLead = () => listEl.querySelectorAll('tbody tr').forEach((tr) => { if (tr.firstElementChild) tr.firstElementChild.classList.add('lead'); });
    const update = () => { const f = filtered(); table.redraw(f); markLead(); countEl.textContent = 'Showing ' + f.length + ' of ' + rows.length + '.'; };
    markLead(); countEl.textContent = 'Showing ' + rows.length + ' of ' + rows.length + '.';
    listEl.addEventListener('click', (e) => { if (e.target.closest('[data-sort]')) setTimeout(markLead, 0); });
    sec.body.querySelectorAll('.owner-chip').forEach((b) => b.addEventListener('click', () => {
      state.owner = state.owner === b.dataset.owner ? '' : b.dataset.owner;
      sec.body.querySelectorAll('.owner-chip').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.owner === state.owner)));
      update();
    }));
    const st = sec.body.querySelector('[data-status]');
    if (st) st.addEventListener('change', () => { state.status = st.value; update(); });
    sec.body.querySelector('[data-search]').addEventListener('input', (e) => { state.search = e.target.value.trim().toLowerCase(); update(); });
    sec.body.querySelector('[data-export]').addEventListener('click', () => {
      const f = filtered();
      const keys = tab === 'not_live' ? ['id', 'name', 'lender_type', 'plan', 'account_manager', 'signup_date', 'status', 'reason', 'days_in_stage', 'errors_last_7_days', 'owner', 'next_action']
        : ['id', 'name', 'plan', 'size_band', 'account_manager', 'calls_3_months_before', 'calls_latest_month', 'change_pct', 'revenue_latest_month', 'last_ticket', 'owner', 'next_action'];
      UI.download('ferrow-' + (tab === 'not_live' ? 'never-live' : 'usage-falling') + '-' + p.to_month + '.csv', UI.toCSV({ columns: keys, rows: f.map((r) => keys.map((k) => r[k])) }));
    });

    if (tab === 'not_live') sec.sowhat('Customer Success works the sandbox and document cases; Compliance clears its own queue first, because those lenders are waiting on us.', null);
    else sec.sowhat('Call the largest accounts first. A pricing ticket before the drop usually means a competitor quote; a timeout ticket means Engineering should join the call.', null);
    sec.sql(q, p);
  }

  A.register('accounts', { render });
})(window);
