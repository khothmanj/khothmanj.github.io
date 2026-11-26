/*
 * Kinhold app shell: data loading, saved progress (localStorage, always guarded), hash routing,
 * sidebar (collapsible, remembered), Back button, theme, and small shared helpers.
 */
(function (root) {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- saved progress ---------- */
  const KEY = 'kinhold.v1';
  const blank = () => ({ business: '', profile: null, answers: {}, step: 0, checks: [], done: [], certificates: [], sample: false });
  let memory = null;
  const store = {
    get() {
      if (memory) return memory;
      try { memory = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { memory = blank(); }
      return memory;
    },
    save(patch) {
      const s = Object.assign(store.get(), patch || {});
      memory = s;
      try { localStorage.setItem(KEY, JSON.stringify(s)); flashSaved(); } catch (e) { /* storage unavailable: keep working in memory */ }
      return s;
    },
    reset() { memory = blank(); try { localStorage.removeItem(KEY); } catch (e) {} },
    pref(k, v) { try { if (v === undefined) return localStorage.getItem('kinhold.' + k); localStorage.setItem('kinhold.' + k, v); } catch (e) { return null; } },
  };

  /* ---------- data ---------- */
  const data = {};
  async function load() {
    const files = ['questions', 'recommendations', 'sources', 'benchmarks', 'messages', 'training', 'sample-clients', 'templates'];
    const got = await Promise.all(files.map((f) => fetch('data/' + f + '.json').then((r) => { if (!r.ok) throw new Error(f); return r.json(); })));
    files.forEach((f, i) => { data[f.replace('-', '_')] = got[i]; });
    data.sourceById = Object.fromEntries(data.sources.sources.map((s) => [s.id, s]));
    data.recById = Object.fromEntries(data.recommendations.recommendations.map((r) => [r.id, r]));
    data.areaById = Object.fromEntries(data.questions.areas.map((a) => [a.id, a]));
  }

  /* ---------- shared helpers ---------- */
  const I = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const SYMBOL = {
    check: '<path d="M4 8.5l3 3 6-7"/>', alert: '<path d="M8 2.5l6 10.5H2z"/><path d="M8 6.5v3M8 11.3v.2"/>',
    clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>', up: '<path d="M4 12l7.5-7.5M6 4.5h5.5V10"/>',
    down: '<path d="M4 4.5l7.5 7.5M11.5 6.5V12H6"/>', dot: '<circle cx="8" cy="8" r="2.2" fill="currentColor"/>',
    question: '<circle cx="8" cy="8" r="5.5"/><path d="M6.4 6.4a1.7 1.7 0 0 1 3.2.6c0 1.2-1.6 1.4-1.6 2.4M8 11.2v.2"/>', minus: '<path d="M4 8h8"/>',
    leaf: '<path d="M3.5 12.5c0-5 3.5-8.5 9-9 0 5.5-4 9-9 9z"/><path d="M3.5 12.5L8 8"/>', star: '<path d="M8 2.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/>',
  };
  const status = (text, tone, sym) => '<span class="status ' + (tone || '') + '"><svg viewBox="0 0 16 16" aria-hidden="true">' + (SYMBOL[sym] || SYMBOL.dot) + '</svg>' + esc(text) + '</span>';
  // Level labels with their own symbol, so meaning never depends on colour alone.
  const LEVEL_STYLE = [['bad', 'leaf'], ['warn', 'up'], ['sage', 'check'], ['good', 'star']];
  const levelStatus = (idx, label) => idx === null || idx === undefined ? status('Not answered', '', 'minus') : status(label, LEVEL_STYLE[idx][0] === 'bad' ? 'clay' : LEVEL_STYLE[idx][0], LEVEL_STYLE[idx][1]);
  function sourceLinks(ids) {
    return ids.map((id) => { const s = data.sourceById[id]; return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.publisher + ': ' + s.title) + '<span class="visually-hidden"> (opens in a new tab)</span></a>'; }).join('<span aria-hidden="true"> · </span>');
  }
  const formatDate = (d) => new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // The business's current result, from saved answers (or null before the check).
  function current() {
    const s = store.get();
    if (!s.profile) return null;
    const S = root.KinholdScoring, R = root.KinholdRecommend;
    const result = S.score(data.questions, s.profile, s.answers);
    if (!result.answered) return null;
    const actions = R.rank(data.questions, data.recommendations, s.profile, s.answers);
    return { state: s, result, actions, top: actions.slice(0, 5), plan: R.plan(actions) };
  }
  // Load a sample business so recruiters can explore straight away.
  function loadSample(id) {
    const c = data.sample_clients.clients.find((x) => x.id === (id || 'brightloaf'));
    const last = c.checks[c.checks.length - 1];
    store.save({ business: c.name, profile: Object.assign({}, c.profile), answers: Object.assign({}, last.answers), checks: c.checks.map((k) => ({ date: k.date, answers: Object.assign({}, k.answers) })), done: c.done.slice(), step: 0, sample: true });
  }

  /* ---------- navigation ---------- */
  const NAV = [
    { group: 'Your business' },
    { id: 'home', label: 'Home', icon: I('<path class="a" d="M4.5 10.5L12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19z"/><path class="b" d="M4.5 10.5L12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19zM9.5 20.5v-5.5h5v5.5"/>') },
    { id: 'check', label: 'Readiness check', icon: I('<rect class="a" x="4.5" y="3.5" width="15" height="17" rx="3"/><path class="b" d="M7.5 3.5h9a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3zM8.5 9l1.5 1.5 3-3M8.5 15l1.5 1.5 3-3M15 9.5h1.5M15 15.5h1.5"/>') },
    { id: 'results', label: 'Results', icon: I('<circle class="a" cx="12" cy="12" r="8.5"/><path class="b" d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z"/><path class="b" d="M12 3.5V12h8.5A8.5 8.5 0 0 0 12 3.5z"/>') },
    { id: 'plan', label: 'Action plan', icon: I('<rect class="a" x="3.5" y="5" width="17" height="15" rx="3"/><path class="b" d="M6.5 5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM3.5 10h17M8 3v4M16 3v4M8 14l2 2 4-4"/>') },
    { group: 'Tools' },
    { id: 'checker', label: 'Message checker', icon: I('<path class="a" d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path class="b" d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM12 8v3.5M12 14v.2"/>') },
    { id: 'toolkit', label: 'Toolkit', icon: I('<path class="a" d="M6.5 3.5h7.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-14a1.5 1.5 0 0 1 1.5-1.5z"/><path class="b" d="M6.5 3.5h7.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-14a1.5 1.5 0 0 1 1.5-1.5zM14 3.5V8h4.5M9 12.5h6M9 16h4"/>') },
    { id: 'training', label: 'Staff training', icon: I('<path class="a" d="M3 9l9-4.5L21 9l-9 4.5z"/><path class="b" d="M3 9l9-4.5L21 9l-9 4.5zM6.5 11v4.5c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3V11M21 9v5"/>') },
    { group: 'For advisers' },
    { id: 'adviser', label: 'Adviser view', icon: I('<circle class="a" cx="9" cy="8.5" r="3.5"/><path class="b" d="M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 19.5c.7-3.2 3.2-5 6-5s5.3 1.8 6 5M15.5 5.2a3.3 3.3 0 0 1 0 6.3M17.5 14.7c1.8.7 3 2.4 3.5 4.8"/>') },
    { group: 'About' },
    { id: 'method', label: 'How it works', icon: I('<circle class="a" cx="12" cy="12" r="8.5"/><path class="b" d="M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.5M12 7.8v.2"/>') },
    { id: 'case-study', label: 'Case study', icon: I('<path class="a" d="M4.5 5.5c2.5-1.3 5-1.3 7.5 0v14c-2.5-1.3-5-1.3-7.5 0z"/><path class="b" d="M4.5 5.5c2.5-1.3 5-1.3 7.5 0v14c-2.5-1.3-5-1.3-7.5 0zM12 5.5c2.5-1.3 5-1.3 7.5 0v14c-2.5-1.3-5-1.3-7.5 0z"/>') },
  ];
  const LABEL = Object.assign(Object.fromEntries(NAV.filter((n) => n.id).map((n) => [n.id, n.label])), { client: 'Client', module: 'Training' });

  const views = {};
  const app = { register: (n, def) => { views[n] = def; }, data, store, esc, status, levelStatus, sourceLinks, formatDate, current, loadSample, SYMBOL, LEVEL_STYLE, go: (h) => { location.hash = h; }, ill: (n, o) => root.KinholdIll.ill(n, o) };
  let active = null;

  function parse() {
    const raw = location.hash.replace(/^#/, '') || 'home';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'home', args: parts.slice(1), query: new URLSearchParams(qs || '') };
  }

  // Back button: shows once you've moved within Kinhold.
  const trail = [];
  function trackTrail() {
    const h = location.hash || '#home';
    if (trail.length > 1 && trail[trail.length - 2] === h) trail.pop();
    else if (trail[trail.length - 1] !== h) trail.push(h);
    const prev = trail[trail.length - 2], b = $('#back-btn');
    b.hidden = !prev;
    if (prev) { const n = prev.replace(/^#/, '').split(/[?/]/)[0]; const label = 'Back' + (LABEL[n] ? ' to ' + LABEL[n] : ''); b.setAttribute('aria-label', label); b.title = label; }
  }

  async function render() {
    trackTrail();
    const route = parse();
    const def = views[route.name] || views.home;
    const el = $('#view');
    if (active && active.cleanup) { try { active.cleanup(); } catch (e) {} }
    active = def;
    $('#crumb-view').textContent = LABEL[route.name] || 'Home';
    document.title = (LABEL[route.name] && route.name !== 'home' ? LABEL[route.name] + ' · ' : '') + 'Kinhold';
    renderNav(route.name);
    closeMenu();
    const s = store.get();
    $('#crumb-business').textContent = s.business || 'Your business';
    try { await def.render(el, { route, app }); }
    catch (err) { console.error(err); el.innerHTML = '<div class="glass card"><h1>Something went wrong on this page.</h1><p class="muted">Please go back and try again.</p></div>'; }
    if (route.name !== active.__last) { el.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    active.__last = route.name;
  }

  function renderNav(current) {
    const parent = { client: 'adviser', module: 'training' }[current] || current;
    $('#nav').innerHTML = NAV.map((n) => n.group ? '<p class="nav-group">' + n.group + '</p>'
      : '<a href="#' + n.id + '" title="' + n.label + '"' + (n.id === parent ? ' aria-current="page"' : '') + '><span class="ico-duo">' + n.icon + '</span><span>' + n.label + '</span></a>').join('');
  }

  /* ---------- sidebar, theme, saved indicator ---------- */
  function setCollapsed(on, save) {
    $('.app').classList.toggle('collapsed', on);
    const b = $('#side-toggle');
    b.setAttribute('aria-expanded', String(!on));
    b.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar'); b.title = b.getAttribute('aria-label');
    if (save) store.pref('side', on ? 'collapsed' : 'open');
  }
  function openMenu() { $('#side').classList.add('open'); $('#scrim').hidden = false; $('#menu-btn').setAttribute('aria-expanded', 'true'); const f = $('#nav a'); if (f) f.focus(); }
  function closeMenu() { $('#side').classList.remove('open'); $('#scrim').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  const theme = () => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function paintTheme() {
    const dark = theme() === 'dark', b = $('#theme-btn');
    b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); b.title = b.getAttribute('aria-label');
    b.innerHTML = dark ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#16130F' : '#F7F3EE');
  }
  let savedTimer = null;
  function flashSaved() {
    const el = $('#saved'); if (!el) return;
    el.hidden = false; clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  async function start() {
    paintTheme();
    setCollapsed(document.documentElement.classList.contains('side-collapsed'), false);
    $('#side-toggle').addEventListener('click', () => setCollapsed(!$('.app').classList.contains('collapsed'), true));
    $('#back-btn').addEventListener('click', () => history.back());
    $('#theme-btn').addEventListener('click', () => { const next = theme() === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); store.pref('theme', next); paintTheme(); });
    $('#menu-btn').addEventListener('click', () => ($('#side').classList.contains('open') ? closeMenu() : openMenu()));
    $('#scrim').addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#side').classList.contains('open')) { closeMenu(); $('#menu-btn').focus(); } });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme);
    try { await load(); }
    catch (e) { $('#view').innerHTML = '<div class="glass card"><h1>Kinhold could not load its content.</h1><p class="muted">Check your connection and refresh the page.</p></div>'; console.error(e); return; }
    window.addEventListener('hashchange', render);
    render();
  }

  app.start = start;
  root.KinholdApp = app;
})(window);
