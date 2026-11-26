/*
 * SQL workspace (#sql): write and run SQL against the real database, browse the schema,
 * and open any saved query from the library with the current filters written in.
 */
(function (root) {
  'use strict';
  const Q = root.SignalQueries;
  const DB = root.SignalDB;
  const UI = root.SignalSQLUI;
  const A = root.SignalApp;
  const esc = UI.esc;

  const TABLE_NOTES = {
    customers: 'One row per lender that signed up',
    onboarding_events: 'When each lender reached each onboarding stage',
    compliance_reviews: 'Every compliance submission and decision',
    endpoints: 'The eight APIs Ferrow sells',
    endpoint_prices: 'Price per call over time',
    api_usage_daily: 'Calls, errors and latency per customer, endpoint and day',
    invoices: 'What we billed each month',
    ledger: 'What Finance recorded',
    recon_cases: 'Owners and status for billing issues',
    support_tickets: 'Support requests from lenders',
    events: 'Launches, pricing, incidents (chart annotations)',
    plans: 'Plans and monthly fees',
    meta: 'Facts about the dataset, such as the as-of date',
    months: 'Every month in the data',
    usage_priced: 'Live usage with revenue at the price on the day',
    customer_months: 'Revenue and activity per customer per month',
    customer_stages: 'One row per lender with each stage time',
  };
  const STORE_KEY = 'signal.sql.draft';

  let schemaCache = null;

  function render(el, ctx) {
    const qid = ctx.route.query.get('q');
    const saved = qid ? Q.byId(qid) : null;
    const p = ctx.params;
    let draft = null;
    try { draft = sessionStorage.getItem(STORE_KEY); } catch (e) {}
    const start = saved ? Q.render(saved.id, p) : (draft || Q.render('activation_funnel', p));
    const startDef = saved || (draft ? null : Q.byId('activation_funnel'));

    el.innerHTML =
      '<header class="view-head"><h1>SQL workspace</h1>' +
        '<p class="lede">A real SQLite database of Ferrow\'s sample data runs in your browser. Every chart in Signal is one of the saved queries listed here. Open one, change it and run it.</p></header>' +
      '<div class="ws">' +
        '<aside class="ws-aside" aria-label="Saved queries and schema">' +
          '<div class="ws-tabs" role="tablist">' +
            '<button type="button" role="tab" id="tab-saved" aria-controls="panel-saved" aria-selected="true">Saved queries</button>' +
            '<button type="button" role="tab" id="tab-schema" aria-controls="panel-schema" aria-selected="false" tabindex="-1">Schema</button>' +
          '</div>' +
          '<div class="ws-panel" id="panel-saved" role="tabpanel" aria-labelledby="tab-saved">' + savedList(startDef, p) + '</div>' +
          '<div class="ws-panel" id="panel-schema" role="tabpanel" aria-labelledby="tab-schema" hidden><div style="padding:14px"><span class="skel" style="height:14px;width:70%"></span></div></div>' +
        '</aside>' +
        '<section class="ws-main" aria-label="Query editor and results">' +
          '<div class="ws-query-head" id="ws-qhead">' + queryHead(startDef, p) + '</div>' +
          '<div class="editor"><pre aria-hidden="true"><code id="ws-hl"></code></pre>' +
            '<label for="ws-sql" class="visually-hidden">SQL query</label>' +
            '<textarea id="ws-sql" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea></div>' +
          '<div class="ws-toolbar">' +
            '<button type="button" class="btn btn-primary" id="ws-run"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5l7 4.5-7 4.5z"/></svg>Run query</button>' +
            '<button type="button" class="btn" id="ws-copy">Copy SQL</button>' +
            '<button type="button" class="btn" id="ws-reset" title="Undo any changes you made to the data">Reset database</button>' +
            '<span class="hint"><kbd>Ctrl</kbd> or <kbd>⌘</kbd> + <kbd>Enter</kbd> runs the query</span>' +
          '</div>' +
          '<div id="ws-out" aria-live="polite"></div>' +
        '</section>' +
      '</div>';

    const ta = el.querySelector('#ws-sql');
    const hl = el.querySelector('#ws-hl');
    const pre = hl.parentElement;
    const sync = () => { hl.innerHTML = UI.highlight(ta.value) + '\n'; pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; };
    ta.value = start;
    sync();
    ta.addEventListener('input', () => {
      sync();
      try { sessionStorage.setItem(STORE_KEY, ta.value); } catch (e) {}
      const head = el.querySelector('#ws-qhead');
      if (head.dataset.saved) { head.dataset.saved = ''; head.innerHTML = queryHead(null, p, true); }
    });
    ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } });
    if (startDef) el.querySelector('#ws-qhead').dataset.saved = '1';

    el.querySelector('#ws-run').addEventListener('click', run);
    el.querySelector('#ws-copy').addEventListener('click', (e) => UI.copy(ta.value, e.currentTarget));
    el.querySelector('#ws-reset').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { await DB.reset(); out.innerHTML = '<p class="notice">The database is back to its original sample data.</p>'; } finally { b.disabled = false; }
    });

    // Tabs, with arrow-key support.
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    const show = (t) => {
      tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; el.querySelector('#' + x.getAttribute('aria-controls')).hidden = !on; });
      if (t.id === 'tab-schema') loadSchema(el, ta);
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; show(n); n.focus(); } });
    });

    const out = el.querySelector('#ws-out');
    let running = false;
    async function run() {
      if (running) return;
      const sql = ta.value.trim();
      if (!sql) { out.innerHTML = '<p class="notice">Write a query first, or pick one from the saved queries.</p>'; return; }
      running = true;
      const btn = el.querySelector('#ws-run'); btn.disabled = true;
      out.innerHTML = skeleton();
      try {
        const res = await DB.query(sql, { fresh: true });
        if (!res.columns.length) {
          out.innerHTML = '<p class="notice">' + (res.changed ? 'The statement changed ' + UI.nf.format(res.changed) + ' rows. Use Reset database to undo it.' : 'The statement ran and returned no rows.') + '</p>';
        } else {
          out.innerHTML =
            '<div class="ws-result-head"><span class="count">' + UI.nf.format(res.rows.length) + (res.rows.length === 1 ? ' row' : ' rows') + '</span>' +
              '<span class="time">' + UI.nf.format(res.ms) + ' ms in SQLite</span>' +
              '<button type="button" class="btn btn-quiet" id="ws-csv">Export CSV</button></div>' +
            (res.rows.length ? UI.table(res, { label: 'Query results' }) : '<div class="empty"><h2>No rows</h2><p class="muted">The query ran, but nothing matched. Try widening the date range or removing a filter.</p></div>');
          const csv = out.querySelector('#ws-csv');
          if (csv) csv.addEventListener('click', () => UI.download((startDef ? startDef.id : 'signal-query') + '.csv', UI.toCSV(res)));
        }
      } catch (err) {
        out.innerHTML = '<div class="notice error" role="alert"><p><strong>That query did not run.</strong> ' + esc(err.friendly || err.message) + '</p>' +
          (err.sqlite ? '<p class="muted" style="margin-top:6px">SQLite said: <code>' + esc(err.sqlite) + '</code></p>' : '') + '</div>';
      } finally {
        running = false; btn.disabled = false;
      }
    }

    // Saved query links re-render through the hash, so the URL is shareable.
    el.querySelectorAll('.saved-item').forEach((b) => b.addEventListener('click', () => {
      try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
      location.hash = UI.workspaceHref(b.dataset.id, p);
    }));

    out.innerHTML = '<p class="muted">Loading the database…</p>';
    DB.ready().then(() => run()).catch((err) => {
      out.innerHTML = '<div class="notice error" role="alert"><p><strong>The database did not load.</strong> ' + esc(err.friendly || err.message) + '</p></div>';
    });
  }

  function queryHead(def, p, edited) {
    if (!def) return '<h2>' + 'Your query' + '</h2><p class="muted">Edited by you. Pick a saved query from the list to start again.</p>';
    const usesDates = /\{\{(from|to|from_month|to_month)\}\}/.test(def.sql);
    const usesSeg = /\{\{(seg|where-seg) /.test(def.sql);
    const filters = [];
    if (usesDates) filters.push(A.rangeLabel(p));
    if (usesSeg) { const s = ['lender_type', 'plan', 'size_band', 'region'].filter((k) => p[k]).map((k) => p[k].replace(/_/g, ' ')); filters.push(s.length ? s.join(', ') : 'all customers'); }
    if (/\{\{ep /.test(def.sql) && p.endpoint) filters.push(Q.ENDPOINT_IDS[p.endpoint][1]);
    if (/\{\{customer\}\}/.test(def.sql)) filters.push('customer ' + p.customer);
    return '<h2>' + esc(def.title) + '</h2><p>' + esc(def.question) + '</p>' +
      '<p class="ws-params">Used in ' + esc(Q.VIEW_LABELS[def.view]) + (filters.length ? '. Filters written into the query: ' + esc(filters.join(', ')) + '.' : '.') + '</p>' +
      '<div class="chips">' + def.skills.map((s) => '<span class="chip">' + esc(s) + '</span>').join('') + '</div>';
  }

  function savedList(active, p) {
    const groups = {};
    Q.list.forEach((q) => { (groups[q.view] = groups[q.view] || []).push(q); });
    return Object.keys(Q.VIEW_LABELS).filter((v) => groups[v]).map((v) =>
      '<p class="saved-group">' + esc(Q.VIEW_LABELS[v]) + '</p>' +
      groups[v].map((q) => '<button type="button" class="saved-item" data-id="' + q.id + '"' + (active && active.id === q.id ? ' aria-current="true"' : '') + '><b>' + esc(q.title) + '</b><span>' + esc(q.question) + '</span></button>').join('')
    ).join('');
  }

  async function loadSchema(el, ta) {
    const panel = el.querySelector('#panel-schema');
    if (panel.dataset.loaded) return;
    try {
      if (!schemaCache) {
        const cols = DB.toObjects(await DB.query(
          "SELECT m.type, m.name AS tbl, p.name AS col, p.type AS col_type FROM sqlite_master m JOIN pragma_table_info(m.name) p " +
          "WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite_%' ORDER BY m.type, m.name, p.cid"));
        const tables = [...new Set(cols.filter((c) => c.type === 'table').map((c) => c.tbl))];
        const counts = DB.toObjects(await DB.query(tables.map((t) => "SELECT '" + t + "' AS tbl, COUNT(*) AS n FROM " + t).join(' UNION ALL ')));
        schemaCache = { cols, counts: Object.fromEntries(counts.map((c) => [c.tbl, c.n])) };
      }
      const byTable = {};
      schemaCache.cols.forEach((c) => { (byTable[c.tbl] = byTable[c.tbl] || { type: c.type, cols: [] }).cols.push(c); });
      const block = (name) => {
        const t = byTable[name];
        return '<details class="schema-table"><summary>' + esc(name) + '<span class="schema-kind">' + (t.type === 'view' ? 'view' : UI.nf.format(schemaCache.counts[name] || 0) + ' rows') + '</span></summary>' +
          (TABLE_NOTES[name] ? '<p class="schema-note" style="padding:0 14px 6px 28px">' + esc(TABLE_NOTES[name]) + '</p>' : '') +
          '<ul class="schema-cols">' + t.cols.map((c) => '<li><button type="button" data-insert="' + esc(c.col) + '" aria-label="Insert ' + esc(c.col) + ' into the query">' + esc(c.col) + '</button><span>' + esc((c.col_type || '').toLowerCase()) + '</span></li>').join('') + '</ul></details>';
      };
      const names = Object.keys(byTable);
      panel.innerHTML =
        '<p class="saved-group">Tables</p>' + names.filter((n) => byTable[n].type === 'table').map(block).join('') +
        '<p class="saved-group">Shared definitions (views)</p><p class="schema-note">Metrics are defined once here and reused by every chart.</p>' + names.filter((n) => byTable[n].type === 'view').map(block).join('');
      panel.dataset.loaded = '1';
      panel.querySelectorAll('[data-insert]').forEach((b) => b.addEventListener('click', () => {
        const s = ta.selectionStart, e = ta.selectionEnd, v = b.dataset.insert;
        ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
        ta.focus(); ta.selectionStart = ta.selectionEnd = s + v.length;
        ta.dispatchEvent(new Event('input'));
      }));
    } catch (err) {
      panel.innerHTML = '<p class="notice error" style="margin:12px">The schema could not load. ' + esc(err.friendly || err.message) + '</p>';
    }
  }

  function skeleton() {
    return '<div class="ws-result-head"><span class="skel" style="width:120px;height:14px"></span></div>' +
      '<div style="display:grid;gap:8px;margin-top:10px">' + [92, 86, 90, 70, 84].map((w) => '<span class="skel" style="height:14px;width:' + w + '%"></span>').join('') + '</div>';
  }

  A.register('sql', { render });
})(window);
