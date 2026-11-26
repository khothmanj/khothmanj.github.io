/*
 * Shared SQL interface pieces: syntax highlighting, the "Show the SQL" panel that sits
 * under every chart, and the results table used by the SQL workspace.
 */
(function (root) {
  'use strict';
  const Q = root.SignalQueries;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- highlighting ---------- */
  const KEYWORDS = new Set(('select from where and or not in is null as on join left right inner outer full cross using group by order having limit offset ' +
    'with recursive union all distinct case when then else end asc desc between like glob exists over partition rows range unbounded preceding following current row ' +
    'window insert into values update set delete create table view index drop alter add primary key references default if temp temporary materialized ' +
    'begin commit rollback pragma explain query plan filter nulls first last collate escape cast integer text real').split(' '));
  const TOKEN = /(--[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_'"-]+|-)/g;
  function highlight(sql) {
    let out = '';
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(sql))) {
      const [t, lineC, blockC, str, quoted, num, fn, word] = m;
      if (lineC || blockC) out += '<span class="t-com">' + esc(t) + '</span>';
      else if (str) out += '<span class="t-str">' + esc(t) + '</span>';
      else if (quoted) out += '<span class="t-id">' + esc(t) + '</span>';
      else if (num) out += '<span class="t-num">' + esc(t) + '</span>';
      else if (fn) out += KEYWORDS.has(fn.toLowerCase()) ? '<span class="t-kw">' + esc(t) + '</span>' : '<span class="t-fn">' + esc(t) + '</span>';
      else if (word) out += KEYWORDS.has(word.toLowerCase()) ? '<span class="t-kw">' + esc(t) + '</span>' : esc(t);
      else out += esc(t);
    }
    return out;
  }

  /* ---------- formatting ---------- */
  const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  function cell(v) {
    if (v === null || v === undefined) return '<span class="null">null</span>';
    if (typeof v === 'number') return nf.format(v);
    if (v instanceof Uint8Array) return '<span class="null">blob</span>';
    return esc(v);
  }

  function table(res, opts = {}) {
    const max = opts.max || 500;
    const numeric = res.columns.map((_, i) => res.rows.slice(0, 50).some((r) => typeof r[i] === 'number') && res.rows.slice(0, 50).every((r) => r[i] === null || typeof r[i] === 'number'));
    const head = res.columns.map((c, i) => '<th scope="col"' + (numeric[i] ? ' class="num"' : '') + '>' + esc(c) + '</th>').join('');
    const body = res.rows.slice(0, max).map((r) => '<tr>' + r.map((v, i) => '<td' + (numeric[i] ? ' class="num"' : '') + '>' + cell(v) + '</td>').join('') + '</tr>').join('');
    return '<div class="result-scroll" tabindex="0" role="region" aria-label="' + esc(opts.label || 'Query results') + '"><table class="result"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      (res.rows.length > max ? '<p class="result-more">Showing the first ' + nf.format(max) + ' of ' + nf.format(res.rows.length) + ' rows. Export CSV to get them all.</p>' : '');
  }

  function toCSV(res) {
    const q = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [res.columns.map(q).join(',')].concat(res.rows.map((r) => r.map(q).join(','))).join('\n');
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); }
    if (btn) { const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = old; }, 1400); }
  }

  /* ---------- workspace links ---------- */
  function workspaceHref(id, params) {
    const p = Q.clean(params);
    const qs = new URLSearchParams({ q: id });
    if (p.from_month !== Q.DEFAULTS.from_month || p.to_month !== Q.DEFAULTS.to_month) { qs.set('from', p.from_month); qs.set('to', p.to_month); }
    for (const k of ['lender_type', 'plan', 'size_band', 'region', 'endpoint']) if (p[k]) qs.set(k, p[k]);
    const def = Q.byId(id);
    if (def && /\{\{customer\}\}/.test(def.sql)) qs.set('customer', p.customer);
    if (def && /\{\{uplift\}\}/.test(def.sql)) qs.set('uplift', p.uplift);
    return '#sql?' + qs.toString();
  }

  /*
   * "Show the SQL" panel for a chart or table. Returns an element.
   * meta: optional { rows, ms } from the run, shown next to the query.
   */
  let panelSeq = 0;
  function sqlPanel(id, params, meta) {
    const sql = Q.render(id, params);
    const def = Q.byId(id);
    const pid = 'sqlp-' + (++panelSeq);
    const wrap = document.createElement('div');
    wrap.className = 'sqlpanel';
    wrap.innerHTML =
      '<button type="button" class="sql-toggle" aria-expanded="false" aria-controls="' + pid + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"/></svg><span>Show the SQL</span></button>' +
      '<div class="sql-body" id="' + pid + '" hidden>' +
        '<div class="sql-head"><p class="sql-q">' + esc(def.question) + '</p>' +
          (meta ? '<p class="sql-meta">' + nf.format(meta.rows) + ' rows in ' + nf.format(meta.ms) + ' ms</p>' : '') + '</div>' +
        '<pre class="code" tabindex="0" aria-label="SQL query"><code>' + highlight(sql) + '</code></pre>' +
        '<div class="sql-actions"><button type="button" class="btn btn-quiet" data-copy>Copy SQL</button>' +
        '<a class="btn btn-quiet" href="' + esc(workspaceHref(id, params)) + '">Open in SQL workspace</a></div>' +
      '</div>';
    const btn = wrap.querySelector('.sql-toggle');
    const body = wrap.querySelector('.sql-body');
    btn.addEventListener('click', () => {
      const open = body.hidden;
      body.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.querySelector('span').textContent = open ? 'Hide the SQL' : 'Show the SQL';
    });
    wrap.querySelector('[data-copy]').addEventListener('click', (e) => copy(sql, e.currentTarget));
    return wrap;
  }

  root.SignalSQLUI = { highlight, table, toCSV, download, copy, sqlPanel, workspaceHref, esc, cell, nf };
})(window);
