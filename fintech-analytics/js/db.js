/*
 * Signal's database client. Talks to the sql.js worker and adds:
 *   - one shared "ready" promise while the database downloads and opens
 *   - a time limit, after which the worker is restarted so the page never hangs
 *   - a small cache, so views that share a query only run it once
 *   - friendly error messages that keep SQLite's own wording
 */
(function (root) {
  'use strict';
  const TIME_LIMIT_MS = 15000;
  const DB_URL = new URL('data/signal.sqlite.gz', document.baseURI).href;
  const WORKER_URL = new URL('js/sql-worker.js', document.baseURI).href;

  let worker = null;
  let seq = 0;
  const pending = new Map();
  const cache = new Map();
  let readyPromise = null;
  let info = null;
  const listeners = new Set();

  function start() {
    worker = new Worker(WORKER_URL);
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      clearTimeout(p.timer);
      if (e.data.ok) p.resolve(e.data); else p.reject(friendly(e.data.error));
    };
    worker.onerror = (e) => { for (const [, p] of pending) { clearTimeout(p.timer); p.reject(friendly(e.message || 'The database worker stopped.')); } pending.clear(); };
  }

  function send(msg, limit) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = limit ? setTimeout(() => {
        pending.delete(id);
        restart();
        const err = new Error('The query was stopped after ' + Math.round(limit / 1000) + ' seconds. It may loop forever or return far too many rows. Try adding a LIMIT or a tighter WHERE clause.');
        err.friendly = err.message; err.sqlite = 'Stopped: time limit';
        reject(err);
      }, limit) : null;
      pending.set(id, { resolve, reject, timer });
      worker.postMessage(Object.assign({ id }, msg));
    });
  }

  function restart() {
    if (worker) worker.terminate();
    worker = null;
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(friendly('The database was restarted.')); }
    pending.clear();
    cache.clear();
    readyPromise = null;
    ready();
  }

  function ready() {
    if (!readyPromise) {
      if (!worker) start();
      const t0 = performance.now();
      readyPromise = send({ type: 'open', url: DB_URL }).then((r) => {
        info = Object.assign({ totalMs: Math.round(performance.now() - t0) }, r);
        listeners.forEach((fn) => fn(info));
        return info;
      });
      readyPromise.catch(() => { readyPromise = null; });
    }
    return readyPromise;
  }

  // Run SQL. Returns { columns, rows, ms }. Rows are arrays; use toObjects() for objects.
  async function query(sql, opts = {}) {
    await ready();
    if (!opts.fresh && cache.has(sql)) return cache.get(sql);
    const res = await send({ type: 'exec', sql }, TIME_LIMIT_MS);
    const out = { columns: res.columns, rows: res.rows, ms: res.ms, changed: res.changed, statements: res.statements };
    if (!opts.fresh) { cache.set(sql, out); if (cache.size > 80) cache.delete(cache.keys().next().value); }
    return out;
  }

  async function reset() { await ready(); cache.clear(); await send({ type: 'reset' }); }

  const toObjects = (res) => res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]])));

  /* ---------- friendly errors ---------- */
  const HINTS = [
    [/no such table: (\S+)/i, (m) => 'There is no table or view called "' + m[1] + '". Check the schema list for the exact name.'],
    [/no such column: (\S+)/i, (m) => 'There is no column called "' + m[1] + '" here. Check the spelling, or which table it belongs to.'],
    [/ambiguous column name: (\S+)/i, (m) => 'More than one table has a column called "' + m[1] + '". Put the table alias in front, for example c.' + m[1].split('.').pop() + '.'],
    [/near "([^"]*)": syntax error/i, (m) => 'SQLite could not read the query near "' + m[1] + '". Look for a missing comma, bracket or keyword just before it.'],
    [/incomplete input/i, () => 'The query ends too early. Is a bracket or quote left open?'],
    [/misuse of aggregate/i, () => 'An aggregate such as SUM or COUNT is used where it is not allowed. Aggregates belong in SELECT or HAVING, not WHERE.'],
    [/misuse of window function/i, () => 'A window function is used where it is not allowed. Wrap the query in a CTE and filter on the result.'],
    [/no such function: (\S+)/i, (m) => 'SQLite has no function called ' + m[1] + '. Signal uses SQLite, so some functions from other databases are named differently.'],
    [/readonly|attempt to write/i, () => 'This copy of the database cannot be changed here.'],
  ];
  function friendly(raw) {
    const msg = String(raw || 'Something went wrong.');
    let hint = null;
    for (const [re, fn] of HINTS) { const m = msg.match(re); if (m) { hint = fn(m); break; } }
    const err = new Error(hint || 'SQLite could not run this query.');
    err.friendly = hint || 'SQLite could not run this query.';
    err.sqlite = msg;
    return err;
  }

  root.SignalDB = { ready, query, reset, toObjects, restart, info: () => info, onReady: (fn) => { listeners.add(fn); if (info) fn(info); } };
})(window);
