/*
 * Signal kit: formatting, labels, the page section pattern (headline, chart, "so what",
 * show the SQL), segment filters and small UI pieces shared by every view.
 */
(function (root) {
  'use strict';
  const Q = root.SignalQueries;
  const DB = root.SignalDB;
  const UI = root.SignalSQLUI;
  const esc = UI.esc;

  /* ---------- labels ---------- */
  const L = {
    lender_type: { digital_lender: 'Digital lender', microfinance_bank: 'Microfinance bank', cooperative: 'Cooperative', bnpl: 'Buy now, pay later' },
    plan: { starter: 'Starter', growth: 'Growth', enterprise: 'Enterprise' },
    size_band: { small: 'Small', mid: 'Mid-size', large: 'Large' },
    region: { Lagos: 'Lagos', FCT: 'FCT', 'South-South': 'South-South', 'South-West': 'South-West', North: 'North', 'South-East': 'South-East' },
    endpoint: { bvn: 'BVN verification', nin: 'NIN verification', bureau: 'Credit bureau report', statement: 'Bank statement analysis', mandate: 'Direct debit mandate', disbursement: 'Disbursement', collection: 'Repayment collection', webhook: 'Webhook delivery' },
    pattern: { direct_api: 'Direct API', sdk: 'SDK', partner_aggregator: 'Partner aggregator' },
    stage: { signed_up: 'Signed up', sandbox_keys_issued: 'Sandbox keys issued', first_sandbox_call: 'First sandbox call', kyc_approved: 'Compliance approved', production_keys_issued: 'Live keys issued', first_live_call: 'First live call', reached_1000_live_calls: '1,000 live calls' },
    category: { integration: 'Integration', api_errors: 'API errors', billing: 'Billing', compliance: 'Compliance', account: 'Account', feature_request: 'Feature request' },
    check: { invoice_without_ledger: 'Invoice with no ledger entry', duplicate_invoice: 'Duplicate invoice', amount_mismatch: 'Amounts differ', billed_after_cancellation: 'Billed after cancelling' },
  };
  const ENDPOINT_ORDER = ['bvn', 'nin', 'bureau', 'statement', 'mandate', 'disbursement', 'collection', 'webhook'];
  const label = (kind, v) => (L[kind] && L[kind][v]) || String(v || '').replace(/_/g, ' ');
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- formatting ---------- */
  const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
  function money(n, opts = {}) {
    if (n === null || n === undefined || isNaN(n)) return 'n/a';
    const a = Math.abs(n), sign = n < 0 ? '−' : '';
    if (opts.full) return sign + '₦' + nf0.format(a);
    if (a >= 1e9) return sign + '₦' + nf1.format(a / 1e9) + 'bn';
    if (a >= 1e6) return sign + '₦' + (a >= 1e8 ? nf0.format(a / 1e6) : nf1.format(a / 1e6)) + 'm';
    if (a >= 1e3) return sign + '₦' + nf0.format(a / 1e3) + 'k';
    return sign + '₦' + nf0.format(a);
  }
  function num(n, opts = {}) {
    if (n === null || n === undefined || isNaN(n)) return 'n/a';
    const a = Math.abs(n), sign = n < 0 ? '−' : '';
    if (opts.compact && a >= 1e6) return sign + nf1.format(a / 1e6) + 'm';
    if (opts.compact && a >= 1e4) return sign + nf0.format(a / 1e3) + 'k';
    return sign + (opts.dp ? nf1.format(a) : nf0.format(a));
  }
  const pct = (n, dp = 1) => (n === null || n === undefined || isNaN(n) ? 'n/a' : (n < 0 ? '−' : '') + Math.abs(n).toFixed(dp).replace(/\.0$/, '') + '%');
  const month = (ym, long) => { const [y, m] = ym.split('-').map(Number); return (long ? LONG_MONTHS : SHORT_MONTHS)[m - 1] + ' ' + y; };
  const monthShort = (ym) => { const [y, m] = ym.split('-').map(Number); return SHORT_MONTHS[m - 1] + ' ' + String(y).slice(2); };
  const day = (d) => { const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return dd + ' ' + SHORT_MONTHS[m - 1] + ' ' + y; };
  const dayShort = (d) => { const [, m, dd] = d.slice(0, 10).split('-').map(Number); return dd + ' ' + SHORT_MONTHS[m - 1]; };
  const initials = (name) => name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
  const plural = (n, one, many) => num(n) + ' ' + (n === 1 ? one : many || one + 's');

  // Change pill. good: 'up' when rising is good, 'down' when falling is good.
  function delta(value, opts = {}) {
    if (value === null || value === undefined || isNaN(value)) return '<span class="delta flat">no change data</span>';
    const good = opts.good || 'up';
    const dir = Math.abs(value) < (opts.flat || 0.05) ? 'flat' : value > 0 ? 'up' : 'down';
    const tone = dir === 'flat' ? 'flat' : dir === good ? 'good' : 'bad';
    const arrow = dir === 'up' ? '<path d="M8 12V4M4.5 7.5L8 4l3.5 3.5"/>' : dir === 'down' ? '<path d="M8 4v8M4.5 8.5L8 12l3.5-3.5"/>' : '<path d="M3.5 8h9"/>';
    const text = opts.points ? (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(1).replace(/\.0$/, '') + (opts.unit || ' pts')
      : opts.abs ? (value > 0 ? '+' : value < 0 ? '−' : '') + num(Math.abs(value), { dp: opts.dp }) + (opts.unit || '')
      : (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(1).replace(/\.0$/, '') + '%';
    return '<span class="delta ' + tone + '"><svg viewBox="0 0 16 16" aria-hidden="true">' + arrow + '</svg>' + text + (opts.suffix ? '<span class="delta-suffix">' + opts.suffix + '</span>' : '') + '</span>';
  }

  // Status labels: coloured text with a symbol that means something (no tinted capsule, no dot).
  const GLYPH = {
    check: '<path d="M3.5 8.5l3 3 6-7"/>',
    alert: '<path d="M8 2.5l6 10.5H2z"/><path d="M8 6.5v3M8 11.3v.2"/>',
    clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>',
    down: '<path d="M4 4.5l7.5 7.5M11.5 6.5V12H6"/>',
    up: '<path d="M4 12l7.5-7.5M6 4.5h5.5V10"/>',
    dashed: '<circle cx="8" cy="8" r="5.5" stroke-dasharray="2.2 2.2"/>',
    sandbox: '<rect x="2.8" y="3.5" width="10.4" height="9" rx="1.6"/><path d="M5.2 7l1.8 1.5-1.8 1.5M8.6 10h2.2"/>',
    moon: '<path d="M12.8 10.2A5.3 5.3 0 0 1 5.8 3.2a5.3 5.3 0 1 0 7 7z"/>',
    x: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
    minus: '<path d="M4 8h8"/>',
  };
  const GLYPH_FOR = { 'usage falling': 'down', growing: 'up', 'in compliance': 'clock', pending: 'clock', investigating: 'clock', watch: 'clock',
    healthy: 'check', passed: 'check', matches: 'check', solved: 'check', resolved: 'check', 'not started': 'dashed', 'sandbox only': 'sandbox',
    dormant: 'moon', cancelled: 'x', 'no traffic': 'minus' };
  function pill(text, tone, icon) {
    tone = tone || 'neutral';
    const key = String(text).toLowerCase();
    const g = icon || GLYPH_FOR[key] || (tone === 'bad' ? 'alert' : tone === 'good' ? 'check' : tone === 'warn' ? 'clock' : 'minus');
    return '<span class="status ' + tone + '"><svg viewBox="0 0 16 16" aria-hidden="true">' + GLYPH[g] + '</svg>' + esc(text) + '</span>';
  }
  function avatar(name, id) {
    const hue = [174, 22, 210, 70, 340, 150, 35, 200][id % 8];
    return '<span class="avatar" style="--h:' + hue + '" aria-hidden="true">' + esc(initials(name)) + '</span>';
  }

  /* ---------- running queries ---------- */
  async function run(id, params) {
    const sql = Q.render(id, params);
    const res = await DB.query(sql);
    return { id, sql, res, rows: DB.toObjects(res), ms: res.ms };
  }
  const runAll = (list, params) => Promise.all(list.map((x) => (typeof x === 'string' ? run(x, params) : run(x[0], Object.assign({}, params, x[1])))));

  /* ---------- sections ---------- */
  let secSeq = 0;
  // Creates a section with a skeleton. Returns handles to fill it in once data arrives.
  function section(parent, opts = {}) {
    const id = 'sec-' + (++secSeq);
    const el = document.createElement('section');
    el.className = 'sec' + (opts.className ? ' ' + opts.className : '');
    el.setAttribute('aria-labelledby', id + '-h');
    el.innerHTML =
      (opts.kicker ? '<p class="sec-kicker">' + esc(opts.kicker) + '</p>' : '') +
      '<h2 class="sec-headline" id="' + id + '-h"><span class="skel" style="height:22px;width:70%"></span></h2>' +
      '<p class="sec-sub">' + (opts.sub ? esc(opts.sub) : '') + '</p>' +
      '<div class="sec-body">' + skeletonChart(opts.height || 220) + '</div>' +
      '<div class="sec-foot"></div>';
    parent.appendChild(el);
    const h = el.querySelector('.sec-headline'), body = el.querySelector('.sec-body'), foot = el.querySelector('.sec-foot'), sub = el.querySelector('.sec-sub');
    return {
      el, body,
      headline(text) { h.textContent = text; },
      sub(text) { sub.textContent = text; },
      sowhat(text, owner, href, linkText) {
        const p = document.createElement('p'); p.className = 'sowhat';
        p.innerHTML = '<span class="sowhat-label">So what</span><span>' + text + (owner ? ' <span class="owner">Owner: ' + esc(owner) + '</span>' : '') + (href ? ' <a href="' + esc(href) + '">' + esc(linkText || 'Open') + '</a>' : '') + '</span>';
        foot.prepend(p);
      },
      sql(items, params) { foot.appendChild(sqlPanel(items, params)); },
      error(err) { body.innerHTML = errorBox(err); h.textContent = 'This chart could not load'; },
    };
  }
  function skeletonChart(h) { return '<div class="skel-chart" style="height:' + h + 'px" aria-hidden="true"><span class="skel"></span></div>'; }
  function errorBox(err) {
    return '<div class="notice error" role="alert"><p><strong>The query behind this did not run.</strong> ' + esc(err.friendly || err.message) + '</p>' +
      (err.sqlite ? '<p class="muted" style="margin-top:6px">SQLite said: <code>' + esc(err.sqlite) + '</code></p>' : '') + '</div>';
  }

  /*
   * Show the SQL, and the data. items: run() results (or one). Each query gets its question,
   * the exact SQL, the data it returned, Copy SQL and Open in SQL workspace.
   */
  let panelSeq = 0;
  function sqlPanel(items, params) {
    items = [].concat(items);
    const pid = 'sqlp-' + (++panelSeq);
    const wrap = document.createElement('div');
    wrap.className = 'sqlpanel';
    const n = items.length;
    wrap.innerHTML =
      '<button type="button" class="sql-toggle" aria-expanded="false" aria-controls="' + pid + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"/></svg><span>Show the SQL' + (n > 1 ? ' (' + n + ' queries)' : '') + '</span></button>' +
      '<div class="sql-body" id="' + pid + '" hidden>' + items.map((it, i) => {
        const def = Q.byId(it.id);
        return '<div class="sql-item">' +
          '<div class="sql-head"><p class="sql-q"><strong>' + esc(def.title) + '.</strong> ' + esc(def.question) + '</p>' +
            '<p class="sql-meta">' + num(it.res.rows.length) + (it.res.rows.length === 1 ? ' row' : ' rows') + ' in ' + nf1.format(it.ms) + ' ms</p></div>' +
          '<pre class="code" tabindex="0" aria-label="SQL for ' + esc(def.title) + '"><code>' + UI.highlight(it.sql) + '</code></pre>' +
          '<div class="sql-actions"><button type="button" class="btn btn-quiet" data-copy="' + i + '">Copy SQL</button>' +
            '<a class="btn btn-quiet" href="' + esc(UI.workspaceHref(it.id, params)) + '">Open in SQL workspace</a>' +
            '<button type="button" class="btn btn-quiet" data-data="' + i + '" aria-expanded="false">Show the data</button></div>' +
          '<div class="sql-data" hidden></div></div>';
      }).join('') + '</div>';
    const btn = wrap.querySelector('.sql-toggle'), body = wrap.querySelector('.sql-body');
    btn.addEventListener('click', () => {
      const open = body.hidden; body.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.querySelector('span').textContent = (open ? 'Hide the SQL' : 'Show the SQL') + (n > 1 ? ' (' + n + ' queries)' : '');
    });
    wrap.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => UI.copy(items[+b.dataset.copy].sql, b)));
    wrap.querySelectorAll('[data-data]').forEach((b) => b.addEventListener('click', () => {
      const box = b.closest('.sql-item').querySelector('.sql-data');
      const open = box.hidden;
      if (open && !box.innerHTML) box.innerHTML = UI.table(items[+b.dataset.data].res, { max: 200, label: 'Data for ' + Q.byId(items[+b.dataset.data].id).title });
      box.hidden = !open; b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'Hide the data' : 'Show the data';
    }));
    return wrap;
  }

  /* ---------- view header and filters ---------- */
  function header(el, opts) {
    const head = document.createElement('header');
    head.className = 'view-head';
    head.innerHTML = (opts.back ? '<a class="back" href="' + esc(opts.back[0]) + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>' + esc(opts.back[1]) + '</a>' : '') +
      '<h1>' + esc(opts.title) + '</h1>' + (opts.lede ? '<p class="lede">' + opts.lede + '</p>' : '');
    el.appendChild(head);
    return head;
  }

  // Segment filters for a view. keys: any of lender_type, plan, size_band, region, endpoint.
  function filters(el, keys, params, note) {
    const A = root.SignalApp;
    params = params || A.params();
    const bar = document.createElement('div');
    bar.className = 'filters';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filters for this view');
    const names = { lender_type: 'Lender type', plan: 'Plan', size_band: 'Size', region: 'Region', endpoint: 'Endpoint' };
    bar.innerHTML = keys.map((k) => '<label class="filter"><span>' + names[k] + '</span><select data-key="' + k + '"><option value="">All</option>' +
      Q.ALLOWED[k].map((v) => '<option value="' + esc(v) + '"' + (params[k] === v ? ' selected' : '') + '>' + esc(label(k === 'endpoint' ? 'endpoint' : k, v)) + '</option>').join('') + '</select></label>').join('') +
      (keys.some((k) => params[k]) ? '<button type="button" class="btn btn-quiet" data-clear>Clear filters</button>' : '') +
      (note ? '<p class="filters-note">' + esc(note) + '</p>' : '');
    bar.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => A.setParams({ [s.dataset.key]: s.value })));
    const clear = bar.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', () => A.setParams(Object.fromEntries(keys.map((k) => [k, '']))));
    el.appendChild(bar);
    return bar;
  }

  /* ---------- sortable table ---------- */
  // columns: [{ key, label, num, render(row), sort(row) }]
  function sortable(container, rows, columns, opts = {}) {
    let sortKey = opts.sortKey || null, dir = opts.dir || -1;
    const draw = () => {
      const col = columns.find((c) => c.key === sortKey);
      const sorted = col ? rows.slice().sort((a, b) => {
        const va = col.sort ? col.sort(a) : a[col.key], vb = col.sort ? col.sort(b) : b[col.key];
        if (va === vb) return 0; if (va === null || va === undefined) return 1; if (vb === null || vb === undefined) return -1;
        return (va > vb ? 1 : -1) * dir;
      }) : rows;
      container.innerHTML = '<div class="table-wrap"><table class="data' + (opts.stack ? ' stack' : '') + '"><caption class="visually-hidden">' + esc(opts.caption || '') + '</caption><thead><tr>' +
        columns.map((c) => '<th scope="col"' + (c.num ? ' class="num"' : '') + (c.key === sortKey ? ' aria-sort="' + (dir > 0 ? 'ascending' : 'descending') + '"' : '') + '>' +
          (c.nosort ? esc(c.label) : '<button type="button" data-sort="' + c.key + '">' + esc(c.label) + '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="' + (c.key === sortKey ? (dir > 0 ? 'M4.5 9.5L8 6l3.5 3.5' : 'M4.5 6.5L8 10l3.5-3.5') : 'M5 6.5L8 4l3 2.5M5 9.5L8 12l3-2.5') + '"/></svg></button>') + '</th>').join('') +
        '</tr></thead><tbody>' + (sorted.length ? sorted.map((r) => '<tr>' + columns.map((c) => '<td' + (c.num ? ' class="num"' : '') + ' data-label="' + esc(c.label) + '">' + (c.render ? c.render(r) : esc(r[c.key] ?? '')) + '</td>').join('') + '</tr>').join('')
          : '<tr><td colspan="' + columns.length + '" class="empty-row">' + esc(opts.empty || 'Nothing matches these filters.') + '</td></tr>') + '</tbody></table></div>';
      container.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
        if (sortKey === b.dataset.sort) dir = -dir; else { sortKey = b.dataset.sort; dir = columns.find((c) => c.key === sortKey).num ? -1 : 1; }
        draw();
        const again = container.querySelector('[data-sort="' + sortKey + '"]'); if (again) again.focus();
      }));
    };
    draw();
    return { redraw(newRows) { rows = newRows; draw(); } };
  }

  root.SignalKit = { L, label, ENDPOINT_ORDER, money, num, pct, month, monthShort, day, dayShort, initials, plural, delta, pill, avatar, run, runAll, section, sqlPanel, header, filters, sortable, errorBox, esc, skeletonChart };
})(window);
