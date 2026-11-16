/*
 * Tenor app shell: data loading, routing, shared helpers, and the Projects, Library and Method views.
 * Intake (#new, #edit) lives in intake.js; results (#results) in results.js.
 */
(function (root) {
  'use strict';
  const P = root.TenorProject, N = root.TenorNarrative;
  const app = { data: null, views: {} };
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON = {
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/></svg>',
  };

  /* Back link shown at the top of inner pages. The chevron is an icon, not part of the text. */
  const backLink = (href, label) => '<a class="back-link" href="' + href + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>' + esc(label) + '</a>';

  /* Finance term with a one-line explanation (keyboard and hover). */
  let termN = 0;
  function term(word, label) {
    const g = app.data && app.data.sectors.glossary;
    const def = g && g[word];
    if (!def) return esc(label || word);
    const id = 'tip' + (++termN);
    return '<span class="term"><button type="button" aria-describedby="' + id + '">' + esc(label || word) + '</button><span class="tip" role="tooltip" id="' + id + '">' + esc(def) + '</span></span>';
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  const money = (x, cur, o) => N.money(x, cur, o);
  function tween(el, from, to, fmt, ms = 520) {
    if (reduced() || !isFinite(from) || !isFinite(to) || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- theme ---------- */
  function applyThemeButton() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const b = $('#theme-btn');
    b.innerHTML = (dark ? ICON.sun : ICON.moon) + '<span>' + (dark ? 'Light mode' : 'Dark mode') + '</span>';
    b.setAttribute('aria-pressed', String(dark));
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', dark ? '#0A0C12' : '#FFFFFF');
  }

  /* ---------- mobile menu ---------- */
  function setMenu(open) {
    const sb = $('#sidebar'), btn = $('#menu-btn'), scrim = $('#scrim');
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    scrim.hidden = !open;
    if (open) { const first = sb.querySelector('a'); if (first) first.focus(); }
  }

  /* ---------- "This plan" group in the sidebar ---------- */
  const PLAN_LINKS = [
    ['results', '', 'Results', '<path class="duo" d="M4 19.5h16V6.5z"/><path d="M4 19.5h16M6 16l4-4.5 3 2.5 5.5-7"/><circle cx="18.5" cy="7" r="1.3"/>'],
    ['edit', '/2', 'Edit assumptions', '<path class="duo" d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3"/>'],
    ['results', '/readiness', 'Readiness', '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.8-5.2"/>'],
  ];
  function planNav(name, id) {
    const box = $('#plan-nav');
    const p = (name === 'results' || name === 'edit') && id ? P.get(id) : null;
    if (!p) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    const here = location.hash;
    box.innerHTML = '<p class="nav-label">This plan</p><p class="plan-name" title="' + esc(p.input.name || 'Untitled plan') + '">' + esc(p.input.name || 'Untitled plan') + '</p>' +
      PLAN_LINKS.map(([r, suffix, label, ico]) => {
        const href = '#' + r + '/' + p.id + suffix;
        const cur = r === 'edit' ? name === 'edit' : (suffix ? here === href : name === 'results' && !here.endsWith('/readiness'));
        return '<a href="' + href + '"' + (cur ? ' aria-current="page"' : '') + '><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + ico + '</svg><span>' + label + '</span></a>';
      }).join('');
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    P.setPref('theme', next);
    applyThemeButton();
    window.dispatchEvent(new Event('tenor:theme'));
  }

  /* ---------- data ---------- */
  async function load() {
    const get = (f) => fetch('data/' + f).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
    const [cases, sectors, defaults] = await Promise.all([get('cases.json'), get('sectors.json'), get('defaults.json')]);
    app.data = { cases: cases.cases, sectors, defaults };
  }
  const allCases = () => app.data.cases.concat(P.userCases());
  const sectorOf = (id) => app.data.sectors.sectors.find((s) => s.id === id);

  /* ---------- examples ---------- */
  const EXAMPLES = [
    { id: 'ng-olam-rukubi-rice', title: 'Try a real example', blurb: 'A self-funded irrigated rice farm and mill in Nigeria, with most figures from the company factsheet.' },
    { id: 'rw-exim-india-irrigation', title: 'Exim-financed irrigation', blurb: 'Rwanda, US$100m Exim Bank of India line of credit, 25 years with a 5-year grace period.' },
    { id: 'ng-ulesson-seed', title: 'Seed-funded edtech', blurb: 'Nigeria, US$3.1m seed round for a subscription learning app.' },
    { id: 'ng-electrification-minigrids', title: 'DFI-backed solar mini-grids', blurb: 'Nigeria, IDA-funded grants blended with private developer capital.' },
  ];
  function openExample(caseId) {
    const existing = P.list().find((p) => p.meta.example && p.meta.sourceCase === caseId);
    if (existing) { location.hash = '#results/' + existing.id; return; }
    const c = allCases().find((x) => x.id === caseId);
    const p = P.fromCase(c, app.data.sectors, app.data.defaults);
    p.meta.example = true;
    P.save(p);
    location.hash = '#results/' + p.id;
  }
  function useCase(caseId) {
    const c = allCases().find((x) => x.id === caseId);
    const p = P.fromCase(c, app.data.sectors, app.data.defaults);
    p.input.name = c.name + ' (my version)';
    P.save(p);
    toast('Started from ' + c.name + '. Change anything you like.');
    location.hash = '#edit/' + p.id + '/2';
  }

  /* ---------- Projects view ---------- */
  function viewProjects(el) {
    const projects = P.list();
    const exRows = EXAMPLES.slice(1).map((e) => {
      const c = app.data.cases.find((x) => x.id === e.id);
      return '<div class="example-row"><span class="mini">' + root.TenorArt.icon(c.sector) + '</span><div><strong>' + esc(e.title) + '</strong><span class="muted small">' + esc(e.blurb) + '</span></div><button class="btn" type="button" data-example="' + e.id + '">Open this example</button></div>';
    }).join('');
    let body;
    if (!projects.length) {
      body = '<div class="projects-head"><div><h1>Your projects</h1><p class="lede">Plans you start are saved in this browser. Nothing is sent to a server.</p></div><div class="actions"><a class="btn btn-primary" href="#new">Start a new plan</a><button class="btn" type="button" data-example="' + EXAMPLES[0].id + '">Try a real example</button></div></div>' +
        '<div class="empty-state glass"><span class="empty-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path class="duo" d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/></svg></span><div><h2>No plans yet</h2><p class="muted">Start a new plan, or open one of the real examples below and change it to fit your project.</p></div></div>';
    } else {
      const rows = projects.map((p) => {
        let k = null;
        try { k = root.TenorEngine.run(P.engineInput(p, app.data.defaults)).kpis; } catch (e) { k = null; }
        const s = sectorOf(p.input.sector);
        return '<div class="project-row"><div><a class="name" href="#results/' + p.id + '">' + esc(p.input.name || 'Untitled plan') + '</a> ' + (p.meta.example ? '<span class="pill">Example</span>' : '') +
          '<span class="k">' + esc([s ? s.label : '', p.input.country].filter(Boolean).join(' · ')) + '</span></div>' +
          '<div><span class="k">Funding</span>' + esc(fundingLabel(p.meta.fundingType)) + '</div>' +
          '<div><span class="k">Yearly sales after ramp-up</span>' + (k ? esc(money(root.TenorEngine.run(P.engineInput(p, app.data.defaults)).out.revenue[k.steadyYear], p.input.currency)) : 'Not built yet') + '</div>' +
          '<div><span class="k">Last edited</span>' + esc(new Date(p.meta.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</div>' +
          '<div style="display:flex;gap:6px;justify-content:flex-end"><a class="btn" href="#edit/' + p.id + '/1">Edit</a><button class="icon-btn" type="button" data-delete="' + p.id + '" aria-label="Delete ' + esc(p.input.name || 'this plan') + '">' + ICON.close + '</button></div></div>';
      }).join('');
      body = '<div class="projects-head"><div><h1>Your projects</h1><p class="lede">Saved in this browser only. Nothing is sent to a server.</p></div><div class="actions" style="margin:0"><a class="btn btn-primary" href="#new">Start a new plan</a></div></div><div class="project-list">' + rows + '</div>';
    }
    el.innerHTML = '<div class="page">' + body + '<section class="examples" aria-labelledby="ex-h"><h2 id="ex-h" class="examples-h">Quick examples from the case library</h2><p class="muted small">Real projects with public sources. Figures Tenor had to estimate are labelled.</p>' + exRows + '</section></div>';
    $$('[data-example]', el).forEach((b) => b.addEventListener('click', () => openExample(b.dataset.example)));
    $$('[data-delete]', el).forEach((b) => b.addEventListener('click', () => {
      const p = P.get(b.dataset.delete);
      if (p && window.confirm('Delete "' + (p.input.name || 'this plan') + '"? This cannot be undone.')) { P.remove(p.id); render(); toast('Plan deleted'); }
    }));
  }
  const FUNDING_LABELS = { own: 'Own money', own_plus_loan: 'Own money plus a loan', investors: 'Investors', equipment: 'Equipment financing', grant: 'Grant', mix: 'A mix' };
  const fundingLabel = (t) => FUNDING_LABELS[t] || 'Not set';

  /* ---------- Library ---------- */
  const PROVIDER = { own: 'Own money', commercial_bank: 'Bank loan', dfi: 'DFI', exim: 'Exim or export credit', equipment_finance: 'Equipment finance', angel_seed: 'Seed', venture: 'Venture', grant_funder: 'Grant', impact_debt: 'Impact debt', sovereign: 'Government', mixed: 'Mixed' };
  function caseFunding(c) { return Array.from(new Set((c.financing.instruments || []).filter((i) => (root.TenorAdapter.val(i.amount) || 0) > 0).map((i) => PROVIDER[i.type === 'grant' ? 'grant_funder' : i.provider_type] || i.provider_type))).join(', '); }
  function qBar(c) {
    const q = c.data_quality_summary || { pct_sourced: 0, derived: 0, fields: 1 };
    const d = Math.round(100 * (q.derived || 0) / (q.fields || 1));
    return '<div class="qbar" role="img" aria-label="' + q.pct_sourced + '% sourced, ' + d + '% derived"><span style="width:' + q.pct_sourced + '%;background:var(--q-sourced)"></span><span style="width:' + d + '%;background:var(--q-derived)"></span><span style="flex:1;background:var(--line)"></span></div><span class="small muted">' + q.pct_sourced + '% sourced</span>';
  }
  function viewLibrary(el, caseId) {
    if (caseId) return viewCase(el, caseId);
    const cases = allCases();
    const sectors = Array.from(new Set(cases.map((c) => c.sector)));
    const f = app.libFilter || { sector: '', funding: '', q: '' };
    const fundingTypes = Array.from(new Set(cases.flatMap((c) => caseFunding(c).split(', ').filter(Boolean)))).sort();
    el.innerHTML = '<div class="page"><h1>Case library</h1><p class="lede">' + app.data.cases.length + ' real projects from public sources, used to suggest similar projects, typical ranges and starting points. Every figure is marked sourced, derived or assumed.</p>' +
      '<div class="filters"><div class="field"><label for="lf-s">Sector</label><div class="input-wrap"><select id="lf-s"><option value="">All sectors</option>' + sectors.map((s) => '<option value="' + s + '"' + (f.sector === s ? ' selected' : '') + '>' + esc(sectorOf(s).label) + '</option>').join('') + '</select></div></div>' +
      '<div class="field"><label for="lf-f">Funding</label><div class="input-wrap"><select id="lf-f"><option value="">All funding types</option>' + fundingTypes.map((t) => '<option' + (f.funding === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></div></div>' +
      '<div class="field" style="flex:1"><label for="lf-q">Search</label><div class="input-wrap"><input id="lf-q" type="search" value="' + esc(f.q) + '" placeholder="Name, country or crop"></div></div></div>' +
      '<p class="small muted" id="lib-count" role="status"></p><div class="case-list" id="case-list"></div>' +
      '<section style="margin-top:36px"><h2>Your saved cases</h2><p class="muted">Save a finished project as a case from its results page, then export or import cases as a JSON file to share them.</p><div class="actions"><button class="btn" type="button" id="exp-cases">Export my cases</button><label class="btn" for="imp-cases">Import cases</label><input type="file" id="imp-cases" accept=".json,application/json" class="visually-hidden"></div></section></div>';
    const draw = () => {
      const q = f.q.toLowerCase();
      const rows = cases.filter((c) => (!f.sector || c.sector === f.sector) && (!f.funding || caseFunding(c).includes(f.funding)) && (!q || (c.name + ' ' + c.country + ' ' + c.sub_sector).toLowerCase().includes(q)));
      $('#lib-count', el).textContent = rows.length + ' of ' + cases.length + ' cases';
      $('#case-list', el).innerHTML = rows.map((c) => '<div class="case-row"><div><a href="#library/' + esc(c.id) + '">' + esc(c.name) + '</a>' + (c.user ? ' <span class="pill">Yours</span>' : '') + '<span class="k">' + esc(c.sub_sector) + '</span></div>' +
        '<div><span class="k">Where</span>' + esc(c.country) + '</div><div><span class="k">Sector</span>' + esc(sectorOf(c.sector).label) + '</div><div><span class="k">Funding</span>' + esc(caseFunding(c)) + '</div><div>' + qBar(c) + '</div></div>').join('') || '<p class="muted" style="padding:20px 0">No cases match. Clear a filter to see more.</p>';
    };
    $('#lf-s', el).addEventListener('change', (e) => { f.sector = e.target.value; app.libFilter = f; draw(); });
    $('#lf-f', el).addEventListener('change', (e) => { f.funding = e.target.value; app.libFilter = f; draw(); });
    $('#lf-q', el).addEventListener('input', (e) => { f.q = e.target.value; app.libFilter = f; draw(); });
    $('#exp-cases', el).addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ tenor_cases: P.userCases() }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tenor-my-cases.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    });
    $('#imp-cases', el).addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const j = JSON.parse(await file.text()); const arr = Array.isArray(j) ? j : j.tenor_cases;
        if (!Array.isArray(arr) || !arr.every((c) => c && c.id && c.sector && c.drivers && c.financing)) throw new Error('not a Tenor case file');
        const mine = P.userCases(); arr.forEach((c) => { c.user = true; if (!String(c.id).startsWith('user-')) c.id = 'user-' + c.id; if (!mine.some((m) => m.id === c.id)) mine.push(c); });
        P.saveUserCases(mine); toast('Imported ' + arr.length + ' cases'); render();
      } catch (err) { toast('Could not import: ' + err.message); }
    });
    draw();
  }
  function viewCase(el, id) {
    const c = allCases().find((x) => x.id === id);
    if (!c) { el.innerHTML = '<div class="page"><p>That case is not in the library. <a href="#library">Back to the library</a></p></div>'; return; }
    const s = sectorOf(c.sector);
    const v = (x) => root.TenorAdapter.val(x);
    const fmtVal = (x) => (typeof v(x) === 'number' ? v(x).toLocaleString('en-GB', { maximumFractionDigits: 2 }) : Array.isArray(v(x)) ? v(x).join(', ') : typeof v(x) === 'object' && v(x) !== null ? Object.entries(v(x)).map(([a, b]) => a + ' ' + b).join(', ') : String(v(x)));
    const drivers = Object.entries(c.drivers || {}).map(([k, d]) => '<tr><td>' + esc(k.replace(/_/g, ' ')) + '<div class="small muted">' + esc(d.note || '') + '</div></td><td>' + esc(fmtVal(d)) + '</td><td><span class="q q-' + esc(d.quality) + '">' + esc(d.quality) + '</span></td></tr>').join('');
    const fin = (c.financing.instruments || []).map((i) => '<tr><td>' + esc(i.provider) + '<div class="small muted">' + esc(i.type.replace(/_/g, ' ')) + '</div></td><td>' + esc(i.currency || c.currency) + ' ' + esc(fmtVal(i.amount)) + '</td><td><span class="q q-' + esc((i.amount || {}).quality) + '">' + esc((i.amount || {}).quality || '') + '</span></td></tr>').join('');
    const q = c.data_quality_summary || {};
    el.innerHTML = '<div class="page case-detail">' + backLink('#library', 'Back to the case library') + '<h1>' + esc(c.name) + '</h1><p class="lede">' + esc(c.concept) + '</p>' +
      '<div class="actions"><button class="btn btn-primary" type="button" id="use-case">Use as a starting point</button><button class="btn" type="button" id="see-case">See the results</button></div>' +
      '<div class="grid"><div><div class="facts"><div><div class="k">Sector</div><div class="v">' + esc(s.label) + '</div></div><div><div class="k">Where</div><div class="v">' + esc(c.country) + '</div></div>' +
      '<div><div class="k">Funding</div><div class="v">' + esc(caseFunding(c)) + '</div></div><div><div class="k">Stage</div><div class="v">' + esc(c.stage === 'trading' ? 'Already trading' : c.stage === 'pre-revenue' ? 'Before launch' : 'New project') + '</div></div></div>' +
      '<p><strong>Where the money comes from.</strong> ' + esc(c.revenue_model) + '</p>' +
      '<h2 class="section-title">Key figures and where they came from</h2><div class="table-wrap"><table class="data"><thead><tr><th scope="col">Figure</th><th scope="col">Value</th><th scope="col">Quality</th></tr></thead><tbody>' + drivers + '</tbody></table></div>' +
      '<h2 class="section-title">Financing</h2><div class="table-wrap"><table class="data"><thead><tr><th scope="col">Funder</th><th scope="col">Amount</th><th scope="col">Quality</th></tr></thead><tbody>' + fin + '</tbody></table></div></div>' +
      '<div><h2 class="section-title">Data quality</h2>' + qBar(c) + '<p class="small muted" style="margin-top:8px">' + (q.sourced || 0) + ' sourced, ' + (q.derived || 0) + ' derived and ' + (q.assumed || 0) + ' assumed figures.</p>' +
      '<h2 class="section-title">Sources</h2><ul class="sources-list">' + ((c.sources || []).map((x) => '<li><a href="' + esc(x.url) + '" rel="noopener noreferrer" target="_blank">' + esc(x.title) + '</a><span class="what">' + esc(x.publisher) + ', ' + esc(x.date) + '. Supports: ' + esc(x.supports) + '.</span></li>').join('') || '<li class="muted">Your own estimates.</li>') + '</ul>' +
      (c.caveats && c.caveats.length ? '<div class="caveats"><strong>Caveats</strong><ul>' + c.caveats.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') + '</div></div></div>';
    $('#use-case', el).addEventListener('click', () => useCase(c.id));
    $('#see-case', el).addEventListener('click', () => openExample(c.id));
  }

  /* ---------- Method ---------- */
  function viewMethod(el) {
    el.innerHTML = '<div class="page prose"><h1>How Tenor works</h1><p class="lede">Plain rules you can check, not a black box. There are no AI model calls, no API keys and no server. Everything runs in your browser.</p>' +
      '<h2>Reading your documents</h2><p>When you paste text or upload a PDF, Word, Excel or CSV file, Tenor looks for patterns such as amounts with currencies, hectares, interest rates, years to repay, grace periods and types of funder (for example "Exim", "World Bank" or "equipment lease"). It shows each thing it found next to the sentence it came from. Nothing is used until you tick it and confirm.</p>' +
      '<h2>Finding similar projects</h2><p>Tenor scores every case in its library against your project out of 100:</p><ul><li>same sector (40 points), or a related one (15)</li><li>the same kinds of funder (up to 25)</li><li>a similar size in US dollars (up to 15)</li><li>the same country (10), or the same region (5)</li><li>the same way of earning money and the same stage (5 each)</li></ul><p>It shows the top three and says in words why each one matches.</p>' +
      '<h2>Typical ranges and warnings</h2><p>Under key inputs, Tenor shows the range seen in similar library cases. It only uses figures marked sourced or derived, never another case\'s assumptions. If your number is outside that range, it says so and asks you to check your source. "I\'m not sure" fills in the middle of that range, or Tenor\'s starting estimate, and marks it as an estimate.</p>' +
      '<h2>The calculations</h2><ul><li>Sales follow your sector\'s formula, with a build period, a ramp-up and price growth.</li><li>Running costs are fixed or rise with activity, with inflation.</li><li>Equipment and buildings wear out in straight lines over their working life (' + term('Depreciation', 'depreciation') + ').</li><li>Tax uses a simple rate with losses carried forward and an optional tax holiday.</li><li>Cash tied up in unpaid bills and stock is ' + term('Working capital', 'working capital') + '.</li><li>Loans can repay in equal payments (' + term('Annuity', 'annuity') + '), equal principal or all at the end (' + term('Bullet', 'bullet') + '), with grace periods, fees, staged drawdowns and several tranches. Foreign-currency loans are converted each year.</li><li>Ratios include ' + term('DSCR') + ', ' + term('LLCR') + ', ' + term('IRR') + ', ' + term('NPV') + ', payback, break-even, gearing and runway.</li></ul>' +
      '<h2>What-ifs</h2><p>Each what-if keeps the build and the loans the same and changes sales or running costs: prices 10% and 20% lower, 20% less sold, costs 15% higher, a one-year delay, and for foreign-currency loans, a weaker local currency. The Excel file recalculates the same what-ifs with live formulas.</p>' +
      '<h2>What Tenor does not do</h2><ul><li>It is not a trained machine learning model and does not learn from your data.</li><li>It does not fetch live exchange rates or commodity prices.</li><li>It does not model interest on cash balances or size loans to a target ratio, so the Excel file has no circular formulas.</li><li>Quarterly figures split each year evenly. Seasonality is not modelled.</li><li>It is not financial advice. Check every number with qualified advisers.</li></ul></div>';
  }

  /* ---------- router ---------- */
  function setNav(name) { $$('.nav a').forEach((a) => (a.dataset.nav === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'))); }
  let lastRoute = '';
  function render() {
    const h = (location.hash || '#home').slice(1);
    const [name, a, b] = h.split('/');
    const el = $('#app');
    if (app.cleanup) { try { app.cleanup(); } catch (e) { /* ignore */ } app.cleanup = null; }
    const routeChanged = name + '/' + a !== lastRoute;
    lastRoute = name + '/' + a;
    try {
      if (name === 'library') { setNav('library'); viewLibrary(el, a); document.title = 'Library · Tenor'; }
      else if (name === 'method') { setNav('method'); viewMethod(el); document.title = 'Method · Tenor'; }
      else if (name === 'case-study') { setNav('case-study'); app.views.caseStudy(el); }
      else if (name === 'new') { setNav(''); app.views.intake(el, null, 1); document.title = 'New plan · Tenor'; }
      else if (name === 'edit') { setNav(''); app.views.intake(el, a, Number(b) || 1); document.title = 'Edit plan · Tenor'; }
      else if (name === 'results') { setNav(''); app.views.results(el, a, b); }
      else if (name === 'projects') { setNav('projects'); viewProjects(el); document.title = 'Your projects · Tenor'; }
      else { setNav('home'); app.views.home(el); }
      planNav(name, a);
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="page"><h1>Something went wrong.</h1><p class="lede">' + esc(e.message) + '</p><a class="btn" href="#projects">Back to your projects</a></div>';
    }
    if (routeChanged) { window.scrollTo(0, 0); el.focus({ preventScroll: true }); }
  }

  async function start() {
    applyThemeButton();
    $('#theme-btn').addEventListener('click', toggleTheme);
    $('#menu-btn').addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
    $('#scrim').addEventListener('click', () => setMenu(false));
    $('#sidebar').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); $('#menu-btn').focus(); } });
    try { await load(); } catch (e) { $('#app').innerHTML = '<div class="page"><h1>Tenor could not load its data.</h1><p class="lede">Open it through a web server rather than as a file, then reload.</p></div>'; return; }
    window.addEventListener('hashchange', render);
    render();
  }

  Object.assign(app, { backLink, start, render, $, $$, esc, term, toast, money, tween, ICON, allCases, sectorOf, fundingLabel, FUNDING_LABELS, openExample, reduced });
  root.TenorApp = app;
})(typeof self !== 'undefined' ? self : this);
