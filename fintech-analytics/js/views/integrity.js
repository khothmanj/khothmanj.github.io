/*
 * Data checks (#integrity): reconcile invoices with the finance ledger and with metered usage,
 * flag mismatches with a likely cause and an owner.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, C = root.SignalCharts, A = root.SignalApp, esc = K.esc;
  const RULE_NOTES = {
    'Every invoice has a ledger entry': 'Finance should record every invoice we send. A missing entry understates revenue.',
    'One invoice per customer per month': 'Two invoices for one month usually means a billing run retried.',
    'Ledger amount equals invoice amount': 'Amounts should match to the kobo. Small gaps point to rounding in an upload.',
    'No invoices after cancellation': 'A customer who cancelled should not be billed again.',
    'Invoice equals metered usage plus fee': 'An independent check: what we invoiced should equal what the usage data says we should bill.',
  };
  const STATUS_TONE = { open: 'bad', investigating: 'warn', resolved: 'good' };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  async function render(el, ctx) {
    const p = ctx.params;
    const charts = [];
    this.cleanup = () => charts.forEach((c) => c.destroy());
    el.innerHTML = '';
    K.header(el, { title: 'Data checks', lede: 'Revenue numbers are only useful if Finance can trust them. These checks compare every invoice with the finance ledger and with metered usage, ' + K.month(p.from_month) + ' to ' + K.month(p.to_month) + '.' });

    const rules = K.section(el, { kicker: 'Checks', height: 200 });
    const issues = K.section(el, { kicker: 'Issues', height: 240 });
    const monthly = K.section(el, { kicker: 'Month by month', height: 220 });

    const [R, I, M] = await K.runAll(['integrity_rules', 'integrity_reconciliation', 'integrity_monthly'], p);

    /* ----- rules ----- */
    const failedRules = R.rows.filter((r) => r.failed > 0);
    const rows = I.rows;
    const open = rows.filter((r) => r.status !== 'resolved');
    const atStake = open.reduce((s, r) => s + Math.abs(r.invoiced_ngn - r.ledger_ngn) + (r.check_name === 'billed_after_cancellation' ? r.invoiced_ngn : 0), 0);
    rules.headline(rows.length
      ? K.plural(rows.length, 'issue') + ' across ' + K.plural(new Set(rows.map((r) => r.customer_id)).size, 'customer') + '. ' + (open.length ? open.length + ' still need fixing, worth ' + K.money(atStake) + '.' : 'All are resolved.')
      : 'Every check passed for ' + K.num(R.rows[0] ? R.rows[0].checked : 0) + ' customer-months.');
    rules.sub(K.num(R.rows[0] ? R.rows[0].checked : 0) + ' customer-months checked against five rules.');
    rules.body.innerHTML = '<ol class="rules">' + R.rows.map((r) => '<li class="' + (r.failed ? 'fail' : 'pass') + '">' +
      '<span class="rule-icon" aria-hidden="true">' + (r.failed ? '<svg viewBox="0 0 16 16"><path d="M8 4.5v4.2M8 11.3v.2"/></svg>' : '<svg viewBox="0 0 16 16"><path d="M4.5 8.3l2.3 2.3 4.7-5"/></svg>') + '</span>' +
      '<div><b>' + esc(r.rule) + '</b><p>' + esc(RULE_NOTES[r.rule] || '') + '</p></div>' +
      '<span class="rule-result">' + (r.failed ? K.pill(K.plural(r.failed, 'failure'), 'bad') : K.pill('Passed', 'good')) + '</span></li>').join('') + '</ol>';
    rules.sowhat(failedRules.length ? 'Run these checks automatically after every billing run, and block the run from closing until each failure has an owner.' : 'Keep running the checks after every billing run.', 'Finance operations');
    rules.sql(R, p);

    /* ----- issues ----- */
    const kinds = new Set(rows.map((r) => r.check_name)).size;
    const word = ['No', 'One', 'Two', 'Three', 'Four', 'Five'][kinds] || String(kinds);
    issues.headline(rows.length ? (kinds > 1 ? word + ' different causes, so ' + word.toLowerCase() + ' different fixes. ' : 'One cause to fix. ') + rows.filter((r) => r.status === 'resolved').length + ' resolved, ' + rows.filter((r) => r.status === 'investigating').length + ' being investigated, ' + rows.filter((r) => r.status === 'open').length + ' open.' : 'No mismatches in this period.');
    issues.sub('Each row is one customer and month that failed a check. Status and owner come from the reconciliation log.');
    const statuses = ['open', 'investigating', 'resolved'];
    let filter = '';
    issues.body.innerHTML = '<div class="owners" role="group" aria-label="Filter by status">' + statuses.map((s) => '<button type="button" class="owner-chip" data-s="' + s + '" aria-pressed="false">' + cap(s) + ' <b>' + rows.filter((r) => r.status === s).length + '</b></button>').join('') + '</div><div class="tbl"></div>';
    const cols = [
      { key: 'check_name', label: 'Check', render: (r) => '<b class="check-name">' + esc(K.label('check', r.check_name)) + '</b><small class="muted">' + esc(r.likely_cause) + '</small>' },
      { key: 'name', label: 'Customer', render: (r) => '<a href="' + A.hrefFor('customer/' + r.customer_id) + '">' + esc(r.name) + '</a>' },
      { key: 'month', label: 'Month', render: (r) => K.month(r.month) },
      { key: 'invoiced_ngn', label: 'Invoiced', num: true, render: (r) => K.money(r.invoiced_ngn, { full: true }) },
      { key: 'ledger_ngn', label: 'Ledger', num: true, render: (r) => K.money(r.ledger_ngn, { full: true }) },
      { key: 'difference_ngn', label: 'Difference', num: true, render: (r) => r.difference_ngn ? '<span class="neg">' + K.money(r.difference_ngn, { full: true }) + '</span>' : '<span class="muted">None</span>' },
      { key: 'status', label: 'Status', render: (r) => K.pill(cap(r.status), STATUS_TONE[r.status]) },
      { key: 'owner', label: 'Owner' },
    ];
    const box = issues.body.querySelector('.tbl');
    const table = K.sortable(box, rows, cols, { stack: true, caption: 'Reconciliation issues', empty: 'No issues with this status.' });
    const lead = () => box.querySelectorAll('tbody tr').forEach((tr) => tr.firstElementChild && tr.firstElementChild.classList.add('lead'));
    lead();
    issues.body.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
      filter = filter === b.dataset.s ? '' : b.dataset.s;
      issues.body.querySelectorAll('[data-s]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.s === filter)));
      table.redraw(rows.filter((r) => !filter || r.status === filter)); lead();
    }));
    box.addEventListener('click', (e) => { if (e.target.closest('[data-sort]')) setTimeout(lead, 0); });
    issues.sowhat('Billed after cancelling hurts trust most, so Customer Success should call that customer before Finance issues the credit note.', 'Customer Success and Finance operations');
    issues.sql(I, p);

    /* ----- monthly ----- */
    const mr = M.rows;
    const off = mr.filter((r) => Math.abs(r.difference_ngn) > 0.005);
    monthly.headline('Invoices and the ledger matched every month.');
    if (off.length) {
      const big = off.reduce((a, b) => (b.difference_ngn > a.difference_ngn ? b : a));
      monthly.headline('The ledger missed part of the invoiced total in ' + off.length + ' of ' + mr.length + ' months. The largest gap was ' + K.money(big.difference_ngn, { full: true }) + ' in ' + K.month(big.month, true) + '.');
    }
    monthly.sub('Invoiced minus recorded in the ledger, per month. Zero is good.');
    const cbox = document.createElement('div'); monthly.body.innerHTML = ''; monthly.body.appendChild(cbox);
    charts.push(C.xy(cbox, {
      x: mr.map((r) => r.month), xLabel: K.monthShort, xTip: (k) => K.month(k, true), height: 200,
      series: [{ name: 'Invoiced minus ledger', type: 'bar', color: 'var(--down)', values: mr.map((r) => Math.max(0, r.difference_ngn)) }],
      yFormat: (v) => K.money(v, { full: true }), yTick: K.money, ariaLabel: 'Monthly gap between invoices and the ledger',
    }));
    monthly.sowhat('A monthly total can hide problems that cancel out, so the customer-level checks above matter more than this chart.', 'Finance operations');
    monthly.sql(M, p);
  }

  A.register('integrity', { render });
})(window);
