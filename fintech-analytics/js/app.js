/*
 * Signal app shell: navigation, hash routing with shareable filters, the date range
 * picker, theme and the database status in the top bar.
 *
 * URLs look like  #activation?from=2025-11&to=2026-10&plan=growth
 * Views register themselves with SignalApp.register(name, { title, render(el, ctx) }).
 */
(function (root) {
  'use strict';
  const Q = root.SignalQueries;
  const DB = root.SignalDB;
  const UI = root.SignalSQLUI;
  const $ = (s, el = document) => el.querySelector(s);

  const I = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const NAV = [
    { group: 'Monitor' },
    { id: 'overview', label: 'Overview', icon: I('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>') },
    { id: 'activation', label: 'Activation', icon: I('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>') },
    { id: 'accounts', label: 'Accounts to act on', icon: I('<circle cx="9" cy="8" r="3.5"/><path d="M3 19.5c.7-3.2 3.2-5 6-5s5.3 1.8 6 5M15.5 11.5l2 2 3.5-4"/>') },
    { id: 'usage', label: 'Usage and spend', icon: I('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>') },
    { id: 'health', label: 'Integration health', icon: I('<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>') },
    { id: 'integrity', label: 'Data checks', icon: I('<path d="M12 3.5l7.5 3v5.5c0 4.2-3.1 7.6-7.5 8.5-4.4-.9-7.5-4.3-7.5-8.5V6.5z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>') },
    { group: 'Decide' },
    { id: 'insights', label: 'Insights and PRD', icon: I('<path d="M7 3.5h7.5L19 8v12.5H7z"/><path d="M14.5 3.5V8H19M10 12.5h6M10 16h4"/>') },
    { group: 'Build' },
    { id: 'sql', label: 'SQL workspace', icon: I('<ellipse cx="12" cy="6" rx="7.5" ry="2.5"/><path d="M4.5 6v12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>') },
    { id: 'method', label: 'How it was built', icon: I('<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>') },
    { group: 'About' },
    { id: 'case-study', label: 'Case study', icon: I('<path d="M4.5 5.5c2.5-1.3 5-1.3 7.5 0v14c-2.5-1.3-5-1.3-7.5 0zM12 5.5c2.5-1.3 5-1.3 7.5 0v14c-2.5-1.3-5-1.3-7.5 0z"/>') },
  ];
  const FILTER_KEYS = ['from', 'to', 'lender_type', 'plan', 'size_band', 'region', 'endpoint'];
  const views = {};
  const app = { register, params, setParams, navigate, render, hrefFor, views, monthLabel, rangeLabel };
  let current = null;

  /* ---------- routing ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || 'overview';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'overview', args: parts.slice(1), query: new URLSearchParams(qs || '') };
  }

  // Filters shared by every view, cleaned against the allowed values.
  function params() {
    const { query } = parseHash();
    const p = Q.clean({
      from_month: query.get('from'), to_month: query.get('to'),
      lender_type: query.get('lender_type'), plan: query.get('plan'), size_band: query.get('size_band'),
      region: query.get('region'), endpoint: query.get('endpoint'),
      customer: query.get('customer'), uplift: query.get('uplift'),
    });
    return p;
  }

  function filterQuery(p, extra) {
    const qs = new URLSearchParams();
    if (p.from_month !== Q.DEFAULTS.from_month || p.to_month !== Q.DEFAULTS.to_month) { qs.set('from', p.from_month); qs.set('to', p.to_month); }
    for (const k of ['lender_type', 'plan', 'size_band', 'region', 'endpoint']) if (p[k]) qs.set(k, p[k]);
    if (extra) for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    const s = qs.toString();
    return s ? '?' + s : '';
  }
  function hrefFor(name, extra) { return '#' + name + filterQuery(params(), extra); }

  function setParams(patch, opts = {}) {
    const { name, args, query } = parseHash();
    const p = Object.assign(params(), patch);
    const keep = {};
    for (const [k, v] of query.entries()) if (!FILTER_KEYS.includes(k)) keep[k] = v;
    // Values that are not shared filters (uplift, stage, tab) travel as extras.
    for (const [k, v] of Object.entries(patch)) if (!FILTER_KEYS.includes(k) && !['from_month', 'to_month'].includes(k)) keep[k] = v;
    const hash = '#' + [name].concat(args).join('/') + filterQuery(Q.clean(p), opts.keepExtra === false ? null : keep);
    if (opts.replace) history.replaceState(null, '', hash); else location.hash = hash;
    if (opts.replace) render();
  }
  function navigate(hash) { location.hash = hash; }

  function register(name, def) { views[name] = def; }

  /* ---------- back button: shows once you have moved within Signal ---------- */
  const trail = [];
  function trackTrail() {
    const h = location.hash || '#overview';
    if (trail.length > 1 && trail[trail.length - 2] === h) trail.pop();
    else if (trail[trail.length - 1] !== h) trail.push(h);
    const b = $('#back-btn');
    const prev = trail[trail.length - 2];
    b.hidden = !prev;
    if (prev) {
      const name = prev.replace(/^#/, '').split(/[?/]/)[0];
      const item = NAV.find((n) => n.id === name) || ({ customer: { label: 'Customer 360' } })[name];
      b.setAttribute('aria-label', 'Back' + (item ? ' to ' + item.label : ''));
      b.title = b.getAttribute('aria-label');
    }
  }

  /* ---------- collapsible sidebar ---------- */
  function setCollapsed(on, save) {
    $('.app').classList.toggle('collapsed', on);
    const b = $('#side-toggle');
    b.setAttribute('aria-expanded', String(!on));
    b.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar');
    b.title = b.getAttribute('aria-label');
    if (save) { try { localStorage.setItem('signal.side', on ? 'collapsed' : 'open'); } catch (e) {} }
  }

  async function render() {
    trackTrail();
    const route = parseHash();
    const def = views[route.name] || views.__soon;
    const el = $('#view');
    if (current && current.cleanup) { try { current.cleanup(); } catch (e) {} }
    current = def;
    const navItem = NAV.find((n) => n.id === route.name) || ({ customer: { label: 'Customer 360' } })[route.name];
    $('#ws-view').textContent = navItem ? navItem.label : 'Product analytics';
    document.title = (navItem ? navItem.label + ' · ' : '') + 'Signal';
    renderNav(route.name);
    renderRange();
    closeMenu();
    const ctx = { route, params: params(), app };
    try { await def.render(el, ctx); }
    catch (err) { console.error(err); el.innerHTML = '<div class="notice error"><strong>This view could not load.</strong> ' + UI.esc(err.friendly || err.message) + '</div>'; }
  }

  /* ---------- navigation ---------- */
  function renderNav(active) {
    const p = params();
    $('#nav').innerHTML = NAV.map((n) => n.group
      ? '<p class="nav-group">' + n.group + '</p>'
      : '<a href="#' + n.id + filterQuery(p) + '" title="' + n.label + '"' + (n.id === active || (active === 'customer' && n.id === 'accounts') ? ' aria-current="page"' : '') + '>' + n.icon + '<span>' + n.label + '</span>' + (views[n.id] ? '' : '<span class="soon" title="Built in Phase 3"></span>') + '</a>').join('');
  }

  function openMenu() { $('#side').classList.add('open'); $('#scrim').hidden = false; $('#menu-btn').setAttribute('aria-expanded', 'true'); const first = $('#nav a'); if (first) first.focus(); }
  function closeMenu() { $('#side').classList.remove('open'); $('#scrim').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }

  /* ---------- date range ---------- */
  const MONTHS = (() => { const out = []; let [y, m] = Q.DATA_FIRST_MONTH.split('-').map(Number); for (;;) { const s = y + '-' + String(m).padStart(2, '0'); out.push(s); if (s === Q.DATA_LAST_MONTH) break; m++; if (m > 12) { m = 1; y++; } } return out; })();
  const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthLabel(ym) { const [y, m] = ym.split('-').map(Number); return SHORT[m - 1] + ' ' + y; }
  function rangeLabel(p) { return monthLabel(p.from_month) + ' to ' + monthLabel(p.to_month); }
  const PRESETS = [[3, 'Last 3 months'], [6, 'Last 6 months'], [12, 'Last 12 months'], [24, 'All 24 months']];

  function renderRange() {
    const p = params();
    const span = MONTHS.indexOf(p.to_month) - MONTHS.indexOf(p.from_month) + 1;
    const wrap = $('#range');
    const open = wrap.dataset.open === '1';
    wrap.innerHTML =
      '<button type="button" class="btn" id="range-btn" aria-haspopup="dialog" aria-expanded="' + open + '" aria-controls="range-pop">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.8v2.6M10.5 1.8v2.6"/></svg>' +
        '<span class="range-label">' + rangeLabel(p) + '</span></button>' +
      '<div class="range-pop" id="range-pop" role="dialog" aria-label="Choose a date range"' + (open ? '' : ' hidden') + '>' +
        '<div class="range-presets">' + PRESETS.map(([n, label]) => '<button type="button" data-months="' + n + '" aria-pressed="' + (span === n && p.to_month === Q.DATA_LAST_MONTH) + '">' + label + '</button>').join('') + '</div>' +
        '<div class="range-custom">' +
          '<label class="field">From<select id="range-from">' + MONTHS.map((m) => '<option value="' + m + '"' + (m === p.from_month ? ' selected' : '') + '>' + monthLabel(m) + '</option>').join('') + '</select></label>' +
          '<label class="field">To<select id="range-to">' + MONTHS.map((m) => '<option value="' + m + '"' + (m === p.to_month ? ' selected' : '') + '>' + monthLabel(m) + '</option>').join('') + '</select></label>' +
        '</div>' +
        '<p class="muted" style="font-size:.8rem">Data runs from ' + monthLabel(Q.DATA_FIRST_MONTH) + ' to ' + monthLabel(Q.DATA_LAST_MONTH) + '.</p>' +
      '</div>';
    const btn = $('#range-btn'), pop = $('#range-pop');
    const toggle = (show) => { wrap.dataset.open = show ? '1' : ''; pop.hidden = !show; btn.setAttribute('aria-expanded', String(show)); };
    btn.addEventListener('click', () => toggle(pop.hidden));
    pop.querySelectorAll('[data-months]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.months);
      toggle(false);
      setParams({ to_month: Q.DATA_LAST_MONTH, from_month: MONTHS[MONTHS.length - n] });
    }));
    $('#range-from').addEventListener('change', (e) => { toggle(false); setParams({ from_month: e.target.value }); });
    $('#range-to').addEventListener('change', (e) => { toggle(false); setParams({ to_month: e.target.value }); });
  }

  /* ---------- theme ---------- */
  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paintThemeButton() {
    const dark = currentTheme() === 'dark';
    const b = $('#theme-btn');
    b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    b.title = b.getAttribute('aria-label');
    b.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0D1117' : '#F6F7F9');
  }
  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('signal.theme', next); } catch (e) {}
    paintThemeButton();
    window.dispatchEvent(new Event('signal:theme'));
  }

  /* ---------- database status ---------- */
  function watchDatabase() {
    const box = $('#refreshed');
    DB.ready().then(async () => {
      const res = await DB.query("SELECT value FROM meta WHERE key = 'refreshed_at'");
      const [d, t] = String(res.rows[0][0]).split(' ');
      const [y, m, day] = d.split('-').map(Number);
      box.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="label">Refreshed ' + day + ' ' + SHORT[m - 1] + ' ' + y + ', ' + t + '</span>';
      box.title = 'Sample data, last refreshed ' + day + ' ' + SHORT[m - 1] + ' ' + y + ' at ' + t;
    }).catch((err) => {
      box.innerHTML = '<span class="dot" style="background:var(--down)" aria-hidden="true"></span><span class="label">Database did not load</span>';
      console.error(err);
    });
  }

  /* ---------- placeholder for views still to build ---------- */
  register('__soon', {
    render(el, ctx) {
      el.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></svg>' +
        '<h1 class="headline">This view comes next</h1><p class="muted">It is built in Phase 3. The SQL behind it already runs in the <a href="' + hrefFor('sql') + '">SQL workspace</a>.</p></div>';
    },
  });

  function start() {
    paintThemeButton();
    setCollapsed(document.documentElement.classList.contains('side-collapsed'), false);
    $('#side-toggle').addEventListener('click', () => setCollapsed(!$('.app').classList.contains('collapsed'), true));
    $('#back-btn').addEventListener('click', () => history.back());
    $('#theme-btn').addEventListener('click', toggleTheme);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { paintThemeButton(); window.dispatchEvent(new Event('signal:theme')); });
    $('#menu-btn').addEventListener('click', () => ($('#side').classList.contains('open') ? closeMenu() : openMenu()));
    $('#scrim').addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('#side').classList.contains('open')) { closeMenu(); $('#menu-btn').focus(); }
      const pop = $('#range-pop');
      if (pop && !pop.hidden) { $('#range').dataset.open = ''; pop.hidden = true; $('#range-btn').setAttribute('aria-expanded', 'false'); $('#range-btn').focus(); }
    });
    document.addEventListener('click', (e) => {
      const wrap = $('#range'); const pop = $('#range-pop');
      if (pop && !pop.hidden && !wrap.contains(e.target)) { wrap.dataset.open = ''; pop.hidden = true; $('#range-btn').setAttribute('aria-expanded', 'false'); }
    });
    window.addEventListener('hashchange', render);
    watchDatabase();
    render();
  }

  app.start = start;
  root.SignalApp = app;
})(window);
