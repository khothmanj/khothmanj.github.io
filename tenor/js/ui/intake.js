/*
 * Four-step, sector-adaptive intake: the project, the numbers, the funding, review.
 * Every change is saved in this browser as you go.
 */
(function (root) {
  'use strict';
  const A = root.TenorApp, P = root.TenorProject, E = root.TenorEngine, M = root.TenorMatch, N = root.TenorNarrative;
  const { $, $$, esc, term } = A;
  const STEPS = ['The project', 'The numbers', 'The funding', 'Review'];
  const RAMPS = [['Straight away', [1]], ['Over 2 years', [0.6, 1]], ['Over 3 years', [0.5, 0.8, 1]], ['Over 4 years', [0.4, 0.6, 0.85, 1]]];
  const CLASS_LABELS = () => Object.entries(A.data ? {} : {});
  const LENDERS = [['commercial_bank', 'Commercial bank'], ['dfi', 'Development finance institution (DFI)'], ['exim', 'Exim bank or export credit agency'], ['equipment_finance', 'Equipment financier'], ['impact_debt', 'Impact or subordinated debt fund'], ['sovereign', 'Government lender']];
  const FUND_OPTS = [['own', 'My own money'], ['own_plus_loan', 'Own money plus a loan'], ['investors', 'Bring in investors'], ['equipment', 'Equipment financing'], ['grant', 'Grant'], ['mix', 'A mix'], ['none', 'Not decided yet']];
  void CLASS_LABELS;

  /* ---------- helpers ---------- */
  function getPath(o, path) { return path.split('.').reduce((a, k) => (a === undefined || a === null ? undefined : a[k]), o); }
  function setPath(o, path, v) {
    const ks = path.split('.'); let a = o;
    for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] === undefined) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; }
    a[ks[ks.length - 1]] = v;
  }
  const parseNum = (s) => { const v = parseFloat(String(s).replace(/[,\s]/g, '')); return isFinite(v) ? v : 0; };
  const fmtNum = (v) => (v === '' || v === null || v === undefined || !isFinite(v) ? '' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: 4 }));
  const totalCapex = (p) => (p.input.capex || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const money = (x, p) => N.money(x, p.input.currency, { compact: false });

  function numField(o) {
    // o: { id, label, bind, value, unit, hint, extra, est }
    return '<div class="field"><label for="' + o.id + '">' + o.label + (o.est ? ' <span class="estimate-badge">Estimate</span>' : '') + '</label>' +
      '<div class="input-wrap"><input id="' + o.id + '" type="text" inputmode="decimal" autocomplete="off" data-bind="' + o.bind + '" data-num="1" value="' + esc(fmtNum(o.value)) + '"' + (o.describe ? ' aria-describedby="' + o.describe + '"' : '') + '>' + (o.unit ? '<span class="unit">' + esc(o.unit) + '</span>' : '') + '</div>' +
      (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + (o.extra || '') + '</div>';
  }
  function selectField(o) {
    return '<div class="field"><label for="' + o.id + '">' + o.label + '</label><div class="input-wrap"><select id="' + o.id + '" data-bind="' + (o.bind || '') + '"' + (o.action ? ' data-action="' + o.action + '"' : '') + (o.num ? ' data-num="1"' : '') + '>' +
      o.options.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === String(o.value) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div>' + (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '</div>';
  }
  function textField(o) {
    return '<div class="field"><label for="' + o.id + '">' + o.label + '</label><div class="input-wrap"><input id="' + o.id + '" type="text" data-bind="' + o.bind + '" value="' + esc(o.value || '') + '" autocomplete="off"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '></div>' + (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '</div>';
  }

  /* ---------- funding structure ---------- */
  function newLoan(p, over = {}) {
    return Object.assign({ label: 'Loan', amount: 0, currency: p.input.currency, fx_rate: 1, draws: [{ year: 1, pct: 100 }], tenor_years: 10, grace_years: 2, grace_type: 'interest_only', rate_pct: 8, repayment: 'equal_principal', upfront_fee_pct: 0, balloon_pct: 0, kind: 'loan', provider_type: 'commercial_bank' }, over);
  }
  function applyFundingType(p, type) {
    const f = p.input.financing; const cost = totalCapex(p);
    const own = (f.equity || []).find((e) => !e.pre_money && e.provider_type === 'own') || { label: 'Your own money', amount: 0, year: 1, provider_type: 'own' };
    p.meta.fundingType = type;
    if (type === 'own' || type === 'none') { f.loans = []; f.grants = []; f.equity = [Object.assign(own, { label: type === 'none' ? 'Funding still to find' : 'Your own money', amount: own.amount || cost })]; }
    else if (type === 'own_plus_loan') { f.grants = []; f.equity = [own]; if (!f.loans.length) f.loans = [newLoan(p, { amount: Math.max(0, cost - (own.amount || 0)) })]; f.loans = f.loans.filter((l) => l.kind !== 'equipment'); if (!f.loans.length) f.loans = [newLoan(p)]; }
    else if (type === 'investors') { f.loans = []; f.grants = []; const round = (f.equity || []).find((e) => e.pre_money > 0) || { label: 'Seed round', amount: Math.round(cost * 0.8), year: 1, pre_money: Math.round(cost * 3), provider_type: 'angel_seed', round: 'Seed' }; f.equity = [own, round]; }
    else if (type === 'equipment') { f.grants = []; const eq = cost || 0; f.loans = [newLoan(p, { label: 'Equipment finance', amount: Math.round(eq * 0.85), tenor_years: 5, grace_years: 0, rate_pct: 10, repayment: 'annuity', kind: 'equipment', provider_type: 'equipment_finance', balloon_pct: 0 })]; f.equity = [Object.assign(own, { label: 'Deposit from your own money', amount: Math.round(eq * 0.15) })]; p.meta.equipDeposit = 15; }
    else if (type === 'grant') { f.loans = []; f.equity = [own]; if (!f.grants.length) f.grants = [{ label: 'Grant', amount: Math.max(0, cost - (own.amount || 0)), year: 1, provider_type: 'grant_funder' }]; }
    else if (type === 'mix') { if (!f.equity.length) f.equity = [own]; }
  }

  /* ---------- extraction review ---------- */
  function applyFindings(p, items, sectors) {
    const order = (f) => (f.target.startsWith('meta.') ? 0 : 1);
    items.sort((a, b) => order(a) - order(b)).forEach((f) => {
      const t = f.target;
      if (t === 'meta.sector') P.changeSector(p, f.value, sectors);
      else if (t === 'meta.country') p.input.country = f.value;
      else if (t === 'meta.currency') p.input.currency = f.value;
      else if (t === 'meta.name') p.input.name = f.value;
      else if (t === 'meta.construction_years') p.input.timeline.construction_years = Number(f.value) || 0;
      else if (t.startsWith('rev.')) { const k = t.slice(4); p.input.revenue.inputs[k] = Number(f.value); delete p.meta.estimates[k]; }
      else if (t.startsWith('cost.')) { const k = t.slice(5); const line = p.input.opex.find((o) => o.key === k); if (line) { if (line.kind === 'variable') p.input.revenue.inputs['cost_' + k] = Number(f.value); else if (line.kind.startsWith('pct')) line.pct = Number(f.value); else line.amount = Number(f.value); } }
      else if (t === 'capex.total') { if (!totalCapex(p)) { p.input.capex = [{ label: 'Total project cost (from your document)', class: 'plant', amount: Number(f.value), life_years: 15 }]; } }
      else if (t === 'capex.item') { p.input.capex = p.input.capex.filter((c) => Number(c.amount) > 0); p.input.capex.push({ label: f.labelText || 'Item', class: 'equipment', amount: Number(f.value), life_years: 7 }); }
      else if (t.startsWith('loan.')) {
        const k = t.slice(5); const f2 = p.input.financing;
        if (!f2.loans.length) { f2.loans.push(newLoan(p)); if (p.meta.fundingType === 'own' || p.meta.fundingType === 'none') p.meta.fundingType = 'own_plus_loan'; }
        const v = k === 'repayment' ? f.value : Number(f.value);
        f2.loans[0][k] = k === 'grace_years' ? v : v;
      }
      else if (t === 'equity.amount') { const e = p.input.financing.equity; if (!e.length) e.push({ label: 'Your own money', amount: 0, year: 1, provider_type: 'own' }); e[0].amount = Number(f.value); }
      else if (t === 'grant.amount') { p.input.financing.grants = [{ label: 'Grant', amount: Number(f.value), year: 1, provider_type: 'grant_funder' }]; if (p.meta.fundingType === 'own') p.meta.fundingType = 'grant'; }
      else if (t === 'investors.amount') { applyFundingType(p, 'investors'); const r = p.input.financing.equity.find((e) => e.pre_money > 0); if (r) r.amount = Number(f.value); }
      else if (t === 'funding.type') {
        const v = f.value;
        if (['exim', 'dfi', 'commercial_bank', 'equipment_finance'].includes(v)) { const f2 = p.input.financing; if (!f2.loans.length) { f2.loans.push(newLoan(p)); p.meta.fundingType = 'own_plus_loan'; } f2.loans[0].provider_type = v; if (v === 'equipment_finance') f2.loans[0].kind = 'equipment'; }
        else if (v === 'angel_seed' || v === 'venture') applyFundingType(p, 'investors');
        else if (v === 'grant_funder' && !p.input.financing.grants.length) applyFundingType(p, 'grant');
      }
      else if (t === 'tax.rate_pct') p.input.tax = { rate_pct: Number(f.value), holiday_years: 0 };
    });
    if (p.input.financing.loans.length > 1 || (p.input.financing.loans.length && p.input.financing.grants.length)) p.meta.fundingType = 'mix';
  }
  function templateToFindings(t) {
    const out = []; const add = (key, label, value, target, display) => out.push({ key, label, value, target, display: display || String(value), snippet: null });
    const f = t.fields || {};
    if (f.name) add('name', 'Project name', f.name, 'meta.name');
    if (f.sector) add('sector', 'Kind of project', f.sector, 'meta.sector');
    if (f.country) add('country', 'Where it is based', f.country, 'meta.country');
    if (f.currency) add('currency', 'Currency', String(f.currency).toUpperCase(), 'meta.currency');
    if (f.construction_years !== undefined) add('construction_years', 'Build or set-up period', f.construction_years, 'meta.construction_years', f.construction_years + ' years');
    Object.entries(t.rev || {}).forEach(([k, v]) => add(k, k.replace(/_/g, ' '), v, 'rev.' + k));
    Object.entries(t.cost || {}).forEach(([k, v]) => add('cost_' + k, k.replace(/_/g, ' '), v, 'cost.' + k));
    (t.capex || []).forEach((c) => { if (c.amount) out.push({ key: 'capex', label: 'Item to buy or build: ' + (c.label || 'item'), value: c.amount, labelText: c.label, target: 'capex.item', display: fmtNum(c.amount), snippet: null }); });
    if (t.equity) add('equity', 'Your own money', t.equity, 'equity.amount', fmtNum(t.equity));
    if (t.grant) add('grant', 'Grant', t.grant, 'grant.amount', fmtNum(t.grant));
    Object.entries(t.loan || {}).forEach(([k, v]) => add('loan_' + k, 'Loan: ' + k.replace(/_/g, ' '), v, 'loan.' + k));
    Object.entries(t.tax || {}).forEach(([k, v]) => add('tax_' + k, 'Tax rate', v, 'tax.' + k, v + '%'));
    return out;
  }

  /* ---------- main view ---------- */
  function view(el, id, step) {
    const D = A.data;
    if (!id) {
      const p = P.newProject('crops', D.sectors, D.defaults);
      p.meta.draft = true; P.save(p);
      location.replace('#edit/' + p.id + '/1');
      return;
    }
    const p = P.get(id);
    if (!p) { el.innerHTML = '<div class="page"><p>That plan was not found in this browser. <a href="#projects">Back to your projects</a></p></div>'; return; }
    step = Math.min(4, Math.max(1, step || 1));
    const tpl = A.sectorOf(p.input.sector);
    let saveTimer = null;
    let findings = null;

    const save = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { P.save(p); const s = $('#saved-state', el); if (s) s.textContent = 'Saved as you go'; }, 250);
      const s = $('#saved-state', el); if (s) s.textContent = 'Saving…';
    };
    A.cleanup = () => { clearTimeout(saveTimer); P.save(p); };

    const summaryHTML = () => '<div class="summary"><div class="k">Your project</div><div class="v">' + esc(p.input.name || 'Untitled plan') + '</div><div class="muted">' + esc([p.meta.crop && ['crops', 'irrigation'].includes(p.input.sector) ? p.meta.crop : tpl.label, p.input.country].filter(Boolean).join(' · ')) + '</div>' +
      (step >= 3 ? '<div class="k" style="margin-top:12px">Estimated yearly sales</div><div class="v" id="rail-sales">' + esc(N.money(estimate().value, p.input.currency)) + '</div>' : '') + '</div>';
    const rails = {
      1: ['Step 1 of 4: Your project', 'Every great plan starts somewhere.', 'Tell us what you have in mind. We\'ll help you turn it into a clear financial plan.', 'Private by design. Your documents stay in this browser.'],
      2: ['Step 2 of 4: The numbers', 'Let\'s put your plans into numbers.', 'A few estimates are enough to begin. You can change any number as your plans take shape.', 'Not sure yet? Start with your best estimate.'],
      3: ['Step 3 of 4: The funding', 'Choose how your plan gets funded.', 'Use your own money, bring in investors or add a loan. We\'ll show how each choice affects your project.', 'You can compare other funding options later.'],
      4: ['Step 4 of 4: Review your plan', 'A moment to check the details.', 'Here\'s the plan you\'ve put together. Check your estimates before we build your financial model.', 'You can revise your plan at any time.'],
    };
    const r = rails[step];
    const stepper = '<nav class="stepper" aria-label="Progress"><ol>' + STEPS.map((s, i) => {
      const n = i + 1; const done = n < step; const cur = n === step;
      return '<li class="' + (done ? 'done' : '') + '"' + (cur ? ' aria-current="step"' : '') + '>' + (i ? '<span class="bar" aria-hidden="true"></span>' : '') +
        '<button type="button" data-go="' + n + '"' + (n > step && !p.meta.reachedReview ? ' disabled' : '') + '>' + esc(s) + (done ? A.ICON.check : '') + '<span class="visually-hidden">' + (done ? ' (done)' : cur ? ' (current step)' : '') + '</span></button></li>';
    }).join('') + '</ol></nav>';

    function estimate() {
      try {
        const inp = P.engineInput(p, D.defaults);
        if (inp.revenue.mode === 'formula') return { value: E.evaluate(inp.revenue.formula, inp.revenue.inputs), why: 'At full output, in today\'s prices.' };
        const m = E.run(inp); const y = Math.min(m.N, m.opsStart + 2);
        return { value: m.out.revenue[y], why: 'In year 3 of trading, from your growth estimates.' };
      } catch (e) { return { value: 0, why: 'Fill in the numbers above to see an estimate.' }; }
    }
    const benchLine = (key) => {
      const b = M.benchmark(key, Object.assign({}, p.input, { id: p.id }), A.allCases().filter((c) => c.id !== p.meta.sourceCase), D.defaults);
      if (!b) return '';
      const v = p.input.revenue.inputs[key];
      const w = M.warning(v, b);
      const range = b.n > 1 ? fmtNum(+b.min.toPrecision(3)) + ' to ' + fmtNum(+b.max.toPrecision(3)) : fmtNum(+b.median.toPrecision(3));
      const txt = w ? 'Your figure is ' + w + ' the ' + range + ' seen in ' + b.n + ' similar project' + (b.n > 1 ? 's' : '') + '. Check your source.' : 'Similar projects: ' + range + ' (' + b.n + ' in the library' + (b.converted ? ', converted to ' + p.input.currency : '') + ').';
      return '<span class="bench' + (w ? ' warn' : '') + '" id="b-' + key + '">' + esc(txt) + '</span>';
    };

    /* ---------- step bodies ---------- */
    function step1() {
      const sectors = D.sectors.sectors;
      return '<form class="form" novalidate onsubmit="return false"><h2>What are you building?</h2><p class="sub">Start with a few details. You can refine them later.</p>' +
        '<div style="display:grid;gap:18px">' + textField({ id: 'f-name', label: 'Project name', bind: 'input.name', value: p.input.name, placeholder: 'For example, Greenfield Farms' }) +
        '<div class="field"><label for="f-desc">Describe your idea</label><textarea id="f-desc" data-bind="meta.description" rows="3" placeholder="We\'re expanding our farm with irrigation so we can grow rice all year.">' + esc(p.meta.description || '') + '</textarea></div>' +
        '<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:8px;font-weight:500">What kind of project is it?</legend><div class="sector-grid">' +
        sectors.map((s) => '<label><input type="radio" name="sector" value="' + s.id + '"' + (p.input.sector === s.id ? ' checked' : '') + ' data-action="sector">' + root.TenorArt.icon(s.id) + '<span>' + esc(s.simple_label) + '</span><span class="small muted">' + esc(s.examples.slice(0, 2).join(', ')) + '</span></label>').join('') + '</div></fieldset>' +
        '<div class="grid-2">' + textField({ id: 'f-where', label: 'Where is it based?', bind: 'input.country', value: p.input.country, placeholder: 'Town, country' }) +
        selectField({ id: 'f-cur', label: 'Project currency', bind: 'input.currency', value: p.input.currency, options: D.defaults.currencies.map(([c, n]) => [c, n + ' · ' + c]) }) +
        selectField({ id: 'f-stage', label: 'Is it already running?', bind: 'meta.stage', value: p.meta.stage || 'new', options: [['new', 'No, it\'s a new project'], ['trading', 'Yes, it\'s already trading'], ['pre-revenue', 'Not yet, it launches soon']] }) + '</div></div>' +
        '<section><h2>Have documents already?</h2><p class="sub">Add notes, figures or an existing model. Tenor reads them in your browser and shows what it found. Nothing is used until you confirm it.</p>' +
        '<label class="drop" id="drop" for="f-file">' + A.ICON.upload + '<span>Add your notes, figures or an existing model</span><span class="small muted">PDF, Word, Excel or CSV. Tenor input templates work too.</span></label><input id="f-file" class="visually-hidden" type="file" accept=".pdf,.docx,.xlsx,.csv,.txt">' +
        '<div class="field" style="margin-top:14px"><label for="f-paste">Or paste some text</label><textarea id="f-paste" rows="3" placeholder="Paste an email, a concept note or a term sheet"></textarea></div>' +
        '<div class="actions" style="margin-top:10px"><button class="btn" type="button" id="read-text">Read this text</button><button class="btn btn-quiet" type="button" id="get-template">Download an input template</button></div>' +
        '<div id="found" aria-live="polite"></div></section>' +
        '<div class="form-foot"><a class="btn btn-quiet" href="#projects">Save and finish later</a><div class="right"><button class="btn btn-primary" type="button" data-go="2">Continue to the numbers</button></div></div></form>';
    }
    function step2() {
      const inputs = tpl.inputs.map((i) => {
        if (i.type === 'select') return selectField({ id: 'f-' + i.key, label: esc(i.simple_label), bind: 'meta.crop', value: p.meta.crop, options: tpl.examples.map((x) => [x, x]) });
        if (i.type === 'text') return textField({ id: 'f-' + i.key, label: esc(i.simple_label), bind: 'meta.crop', value: p.meta.crop });
        const est = !!p.meta.estimates[i.key];
        const extra = (i.benchmark ? benchLine(i.key) : '') + '<span><button type="button" class="notsure" data-notsure="' + i.key + '">I\'m not sure</button></span>';
        return numField({ id: 'f-' + i.key, label: esc(i.simple_label) + ' <span class="visually-hidden">(' + esc(i.label) + ')</span>', bind: 'input.revenue.inputs.' + i.key, value: p.input.revenue.inputs[i.key], unit: i.unit, hint: i.hint, extra, est });
      }).join('');
      const est = estimate();
      const growth = ['tech', 'fintech'].includes(tpl.id) || p.input.revenue.mode === 'historical';
      const rampIdx = RAMPS.findIndex(([, a]) => JSON.stringify(a) === JSON.stringify(p.input.revenue.ramp_up));
      const costRows = p.input.opex.map((o, i) => {
        if (o.extra) return '';
        if (o.kind === 'variable') { const m = /cost_([a-z_]+)$/.exec(o.formula || ''); if (!m) return ''; const cl = tpl.cost_lines.find((c) => c.key === m[1]); const basis = cl ? cl.type.replace('variable_per_', 'per ').replace('_cycle', ' per cycle').replace('ha', 'hectare').replace(/_/g, ' ') : 'per unit'; return numField({ id: 'c-' + i, label: esc(o.simple || o.label), bind: 'input.revenue.inputs.cost_' + m[1], value: p.input.revenue.inputs['cost_' + m[1]], unit: p.input.currency + ' ' + basis }); }
        if (o.kind === 'fixed') return numField({ id: 'c-' + i, label: esc(o.simple || o.label), bind: 'input.opex.' + i + '.amount', value: o.amount, unit: p.input.currency + ' a year' });
        if (o.kind === 'per_new_customer') return numField({ id: 'c-' + i, label: esc(o.simple || o.label), bind: 'input.opex.' + i + '.amount', value: o.amount, unit: p.input.currency + ' each' });
        return numField({ id: 'c-' + i, label: esc(o.simple || o.label), bind: 'input.opex.' + i + '.pct', value: o.pct, unit: { pct_revenue: '% of sales', pct_capex: '% of build cost a year', pct_volume: '% of money moved' }[o.kind] || '%' });
      }).join('');
      const extras = p.input.opex.map((o, i) => (!o.extra ? '' : '<div class="repeat-row">' + textField({ id: 'x-l' + i, label: 'Cost', bind: 'input.opex.' + i + '.label', value: o.label }) +
        selectField({ id: 'x-k' + i, label: 'Type', bind: 'input.opex.' + i + '.kind', value: o.kind, options: [['fixed', 'Fixed a year'], ['pct_revenue', '% of sales']] }) +
        numField({ id: 'x-a' + i, label: o.kind === 'fixed' ? 'Amount a year' : 'Percent', bind: 'input.opex.' + i + (o.kind === 'fixed' ? '.amount' : '.pct'), value: o.kind === 'fixed' ? o.amount : o.pct, unit: o.kind === 'fixed' ? p.input.currency : '%' }) +
        '<button type="button" class="icon-btn" data-remove-cost="' + i + '" aria-label="Remove ' + esc(o.label || 'cost') + '">' + A.ICON.close + '</button></div>')).join('');
      const classes = Object.entries(D.sectors.asset_classes).map(([k, v]) => [k, v.label]);
      const capexRows = p.input.capex.map((c, i) => '<div class="repeat-row">' + textField({ id: 'k-l' + i, label: 'What you\'ll buy or build', bind: 'input.capex.' + i + '.label', value: c.label }) +
        selectField({ id: 'k-c' + i, label: 'Type', bind: 'input.capex.' + i + '.class', value: c.class, action: 'capex-class', options: classes }) +
        numField({ id: 'k-a' + i, label: 'Cost', bind: 'input.capex.' + i + '.amount', value: c.amount, unit: p.input.currency }) +
        '<button type="button" class="icon-btn" data-remove-capex="' + i + '" aria-label="Remove ' + esc(c.label || 'item') + '">' + A.ICON.close + '</button></div>').join('');
      return '<form class="form" novalidate onsubmit="return false"><h2>' + esc(tpl.step2_title) + '</h2><p class="sub">We\'ll use these details to estimate your sales.</p>' +
        (p.input.revenue.mode === 'historical' ? '<div class="grid-2">' + numField({ id: 'f-base', label: 'Sales in your latest full year', bind: 'input.revenue.base_revenue', value: p.input.revenue.base_revenue, unit: p.input.currency }) + numField({ id: 'f-vg', label: 'Growth in what you sell each year', bind: 'input.revenue.volume_growth_pct', value: p.input.revenue.volume_growth_pct, unit: '%' }) + '</div>' : '<div class="grid-2">' + inputs + '</div>') +
        '<div class="estimate-bar" role="status" aria-live="polite"><span>Your estimated yearly sales</span><span class="sep" aria-hidden="true"></span><span class="v" id="est">' + esc(N.money(est.value, p.input.currency, { compact: false })) + '</span><span class="why" id="est-why" style="grid-column:1/-1">' + esc(est.why) + '</span></div>' +
        '<section><h2>When will sales start?</h2><div class="grid-2" style="margin-top:14px">' + selectField({ id: 'f-build', label: 'Build or set-up period', bind: 'input.timeline.construction_years', num: true, value: p.input.timeline.construction_years, options: [0, 1, 2, 3, 4, 5].map((n) => [n, n === 0 ? 'None, sales start in year 1' : n + ' year' + (n > 1 ? 's' : '')]) }) +
        (growth ? '' : selectField({ id: 'f-ramp', label: 'How quickly will you reach full output?', action: 'ramp', value: rampIdx < 0 ? 'custom' : rampIdx, options: RAMPS.map(([l], i) => [i, l]).concat(rampIdx < 0 ? [['custom', 'As in the example (' + p.input.revenue.ramp_up.map((x) => Math.round(x * 100) + '%').join(', ') + ')']] : []) })) + '</div></section>' +
        '<section><h2>What will it cost to run?</h2><p class="sub">Running costs each year, in today\'s prices. Tenor adds inflation.</p><div class="grid-2">' + costRows + '</div>' +
        '<details class="more" style="margin-top:18px"' + (p.input.opex.some((o) => o.extra) ? ' open' : '') + '><summary>Add a detailed cost breakdown</summary><div class="repeat">' + extras + '</div><button type="button" class="btn" data-add-cost="1" style="margin-top:10px">Add a cost line</button></details></section>' +
        '<section><h2>What do you need to buy or build?</h2><p class="sub">Equipment, buildings and set-up costs. ' + term('CAPEX', 'This is called CAPEX') + '.</p><div class="repeat">' + capexRows + '</div>' +
        '<div class="actions" style="margin-top:12px;align-items:center"><button type="button" class="btn" data-add-capex="1">Add an item</button><span class="muted">Total: <strong id="capex-total">' + esc(money(totalCapex(p), p)) + '</strong></span></div></section>' +
        '<div class="form-foot"><button class="btn btn-quiet" type="button" data-go="1">Back</button><div class="right"><span class="muted small" id="saved-state">Saved as you go</span><button class="btn btn-primary" type="button" data-go="3">Continue to funding</button></div></div></form>';
    }
    function loanCard(l, i, multi) {
      const b = 'input.financing.loans.' + i + '.';
      const curOpts = A.data.defaults.currencies.map(([c]) => [c, c]);
      return '<div class="loan-card">' + (multi ? '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' + textField({ id: 'l-n' + i, label: 'Loan name', bind: b + 'label', value: l.label }) + '<button type="button" class="icon-btn" data-remove-loan="' + i + '" aria-label="Remove ' + esc(l.label) + '">' + A.ICON.close + '</button></div>' : '') +
        '<div class="grid-2">' + numField({ id: 'l-a' + i, label: 'Loan amount', bind: b + 'amount', value: l.amount, unit: l.currency || p.input.currency }) +
        selectField({ id: 'l-p' + i, label: 'Who is lending?', bind: b + 'provider_type', value: l.provider_type, options: LENDERS }) +
        numField({ id: 'l-r' + i, label: 'Interest rate each year', bind: b + 'rate_pct', value: l.rate_pct, unit: '%' }) +
        numField({ id: 'l-t' + i, label: 'Time to repay', bind: b + 'tenor_years', value: l.tenor_years, unit: 'years', hint: 'Including any grace period' }) +
        selectField({ id: 'l-g' + i, label: 'First repayment of the amount borrowed', bind: b + 'grace_years', num: true, value: l.grace_years, options: Array.from({ length: Math.max(2, Math.min(10, (l.tenor_years || 10))) }, (_, k) => [k, 'End of year ' + (k + 1) + (k ? ' (' + k + '-year ' + 'grace)' : '')]) }) + '</div>' +
        '<p class="note-line">' + esc(l.grace_type === 'capitalised' ? 'Interest during the grace period is added to the loan.' : 'Interest is paid from year 1.') + ' The loan is fully repaid by the end of year ' + ((l.draws && l.draws[0] ? Math.max(1, l.draws[0].year) : 1) + (Number(l.tenor_years) || 1) - 1) + '.</p>' +
        '<details class="more"><summary>More loan details</summary><div class="grid-2">' +
        selectField({ id: 'l-rt' + i, label: 'How it is repaid', bind: b + 'repayment', value: l.repayment, options: [['annuity', 'Equal payments each year (annuity)'], ['equal_principal', 'Equal part of the loan each year'], ['bullet', 'All at the end (bullet)']] }) +
        selectField({ id: 'l-gt' + i, label: 'Interest during the grace period', bind: b + 'grace_type', value: l.grace_type, options: [['interest_only', 'Paid each year'], ['capitalised', 'Added to the loan']] }) +
        numField({ id: 'l-f' + i, label: 'Upfront fee', bind: b + 'upfront_fee_pct', value: l.upfront_fee_pct, unit: '% of the loan' }) +
        numField({ id: 'l-bl' + i, label: 'Final balloon payment', bind: b + 'balloon_pct', value: l.balloon_pct, unit: '% of the loan' }) +
        selectField({ id: 'l-c' + i, label: 'Loan currency', bind: b + 'currency', value: l.currency || p.input.currency, options: curOpts }) +
        (l.currency && l.currency !== p.input.currency ? numField({ id: 'l-x' + i, label: 'Exchange rate', bind: b + 'fx_rate', value: l.fx_rate, unit: p.input.currency + ' per ' + l.currency }) : '') +
        numField({ id: 'l-d1' + i, label: 'Share drawn in year 1', bind: b + 'draws.0.pct', value: l.draws && l.draws[0] ? l.draws[0].pct : 100, unit: '%', hint: 'Draw the rest in year 2 if the build takes longer' }) + '</div></details></div>';
    }
    function step3() {
      const f = p.input.financing; const type = p.meta.fundingType || P.fundingTypeOf(p.input);
      const cost = totalCapex(p);
      const own = f.equity.find((e) => !e.pre_money) || null;
      const ownIdx = f.equity.indexOf(own);
      const round = f.equity.find((e) => e.pre_money > 0); const roundIdx = f.equity.indexOf(round);
      let body = '';
      const ownField = (label) => (ownIdx >= 0 ? numField({ id: 'e-own', label, bind: 'input.financing.equity.' + ownIdx + '.amount', value: own.amount, unit: p.input.currency }) : '');
      if (type === 'own' || type === 'none') body = '<div class="grid-2">' + ownField(type === 'none' ? 'Funding still to find' : 'Your contribution') + '</div>' + (type === 'none' ? '<p class="note-line">Tenor shows how much you need to find and what your sales could look like. You can choose a funding route later.</p>' : '');
      if (type === 'own_plus_loan' || type === 'mix') body += '<div class="grid-2">' + ownField('Your contribution') + '</div>';
      if (type === 'investors' || (type === 'mix' && round)) {
        body += '<div class="grid-2" style="margin-top:14px">' + (type === 'investors' ? ownField('Your own money') : '') +
          (round ? textField({ id: 'r-n', label: 'Round name', bind: 'input.financing.equity.' + roundIdx + '.round', value: round.round || 'Seed' }) + numField({ id: 'r-a', label: 'Amount to raise', bind: 'input.financing.equity.' + roundIdx + '.amount', value: round.amount, unit: p.input.currency }) +
            numField({ id: 'r-p', label: 'Value before the investment', bind: 'input.financing.equity.' + roundIdx + '.pre_money', value: round.pre_money, unit: p.input.currency, hint: 'The pre-money valuation' }) +
            selectField({ id: 'r-t', label: 'Type of investor', bind: 'input.financing.equity.' + roundIdx + '.provider_type', value: round.provider_type, options: [['angel_seed', 'Angel or seed investors'], ['venture', 'Venture capital']] }) : '') + '</div>';
        if (round) { const pct = round.amount / ((round.pre_money || 0) + (round.amount || 0)) * 100; body += '<p class="note-line">Investors would own about ' + (isFinite(pct) ? pct.toFixed(1) : '0') + '% after this round.</p>'; }
      }
      if (type === 'equipment') {
        const l = f.loans[0];
        body += '<div class="grid-2">' + ownField('Deposit from your own money') + numField({ id: 'q-a', label: 'Amount financed', bind: 'input.financing.loans.0.amount', value: l.amount, unit: p.input.currency, hint: 'Equipment cost less your deposit' }) +
          numField({ id: 'q-r', label: 'Interest rate each year', bind: 'input.financing.loans.0.rate_pct', value: l.rate_pct, unit: '%' }) + numField({ id: 'q-t', label: 'Time to repay', bind: 'input.financing.loans.0.tenor_years', value: l.tenor_years, unit: 'years' }) +
          numField({ id: 'q-b', label: 'Final balloon payment', bind: 'input.financing.loans.0.balloon_pct', value: l.balloon_pct, unit: '% of the amount financed' }) + '</div>';
      }
      if (type === 'grant' || type === 'mix') {
        body += (type === 'grant' ? '<div class="grid-2">' + ownField('Your contribution') + '</div>' : '') + f.grants.map((g, i) => '<div class="grid-2" style="margin-top:14px">' + textField({ id: 'g-n' + i, label: 'Grant funder', bind: 'input.financing.grants.' + i + '.label', value: g.label }) + numField({ id: 'g-a' + i, label: 'Grant amount', bind: 'input.financing.grants.' + i + '.amount', value: g.amount, unit: p.input.currency }) + '</div>').join('') +
          (type === 'mix' ? '<button type="button" class="btn" data-add-grant="1" style="margin-top:12px">Add a grant</button>' : '');
      }
      let loans = '';
      if (type === 'own_plus_loan' || type === 'mix') {
        loans = '<section><h2>Tell us about the loan' + (f.loans.length > 1 ? 's' : '') + '</h2><p class="sub">These are your proposed terms. Use your lender\'s terms when available.</p>' + f.loans.map((l, i) => loanCard(l, i, f.loans.length > 1 || type === 'mix')).join('') +
          '<button type="button" class="btn" data-add-loan="1" style="margin-top:12px">Add another loan or tranche</button>' + (type === 'mix' && !round ? ' <button type="button" class="btn" data-add-round="1" style="margin-top:12px">Add an investor round</button>' : '') + '</section>';
      }
      return '<form class="form" novalidate onsubmit="return false"><h2>How will you fund the project?</h2><div class="chips" role="radiogroup" aria-label="Funding" style="margin-top:14px">' +
        FUND_OPTS.map(([v, l]) => '<label><input type="radio" name="ftype" value="' + v + '"' + (type === v ? ' checked' : '') + ' data-action="ftype">' + esc(l) + A.ICON.check + '</label>').join('') + '</div>' +
        '<section><h2>What do you need to get started?</h2><div class="field" style="margin-top:14px"><span class="label">Total project cost</span><div class="input-wrap" aria-readonly="true"><input type="text" readonly value="' + esc(fmtNum(cost)) + '" aria-label="Total project cost"><span class="unit">' + esc(p.input.currency) + '</span></div><span class="hint">Equipment, buildings and set-up costs from step 2. <button type="button" class="link-btn" data-go="2">Change them</button></span></div>' +
        '<div style="margin-top:18px">' + body + '</div><p class="note-line" id="cover-line" aria-live="polite"></p></section>' + loans +
        '<div class="form-foot"><button class="btn btn-quiet" type="button" data-go="2">Back</button><div class="right"><span class="muted small" id="saved-state">Saved as you go</span><button class="btn btn-primary" type="button" data-go="4">Review my plan</button></div></div></form>';
    }
    function coverLine() {
      const f = p.input.financing; const cost = totalCapex(p);
      const loansLocal = f.loans.reduce((s, l) => s + (Number(l.amount) || 0) * (l.currency && l.currency !== p.input.currency ? (Number(l.fx_rate) || 1) : 1), 0);
      const total = f.equity.reduce((s, e) => s + (Number(e.amount) || 0), 0) + f.grants.reduce((s, g) => s + (Number(g.amount) || 0), 0) + loansLocal;
      const gap = total - cost;
      if (!cost) return ['Add what you need to buy or build in step 2 to check your funding covers it.', ''];
      if (Math.abs(gap) < cost * 0.001) return ['Your funding covers the project cost.', 'ok'];
      if (gap < 0) return ['Your funding is ' + N.money(-gap, p.input.currency, { compact: false }) + ' short of the project cost.', 'warn'];
      return ['Your funding is ' + N.money(gap, p.input.currency, { compact: false }) + ' more than the project cost. The extra is kept as a cash reserve.', 'ok'];
    }
    function step4() {
      const tplInputs = tpl.inputs.filter((i) => typeof p.input.revenue.inputs[i.key] === 'number');
      const est = estimate();
      const f = p.input.financing;
      const inp = P.engineInput(p, D.defaults);
      const sim = M.similar(Object.assign({}, inp, { id: p.id, sourceCase: p.meta.sourceCase }), A.allCases(), D.defaults);
      let ready = { required: [] };
      try { ready = E.readiness(inp, E.run(inp), D.sectors); } catch (e) { /* show none */ }
      const loanRows = f.loans.map((l) => '<dt>' + esc(l.label) + '</dt><dd>' + esc(N.money(l.amount, l.currency || p.input.currency, { compact: false })) + ' at ' + esc(l.rate_pct) + '% over ' + esc(l.tenor_years) + ' years, repayments of the amount borrowed from the end of year ' + (Number(l.grace_years) + 1) + '</dd>').join('');
      return '<div class="form"><h2>Ready for a closer look.</h2>' +
        '<div class="review-sec" style="margin-top:16px"><header><h3>Your project</h3><button type="button" class="link-btn" data-go="1">Edit</button></header><dl><dt>Location</dt><dd>' + esc(p.input.country || 'Not set') + '</dd><dt>Currency</dt><dd>' + esc(p.input.currency) + '</dd><dt>Activity</dt><dd>' + esc(tpl.label + (p.meta.crop && ['crops', 'irrigation'].includes(tpl.id) ? ': ' + p.meta.crop : '')) + '</dd><dt>Stage</dt><dd>' + esc({ new: 'New project', trading: 'Already trading', 'pre-revenue': 'Launching soon' }[p.meta.stage] || 'New project') + '</dd></dl></div>' +
        '<div class="review-sec"><header><h3>Your estimates</h3><button type="button" class="link-btn" data-go="2">Edit</button></header><dl>' + tplInputs.map((i) => '<dt>' + esc(i.simple_label) + '</dt><dd>' + esc(fmtNum(p.input.revenue.inputs[i.key])) + ' ' + esc(i.unit || '') + (p.meta.estimates[i.key] ? ' <span class="estimate-badge">Estimate</span>' : '') + '</dd>').join('') +
        '<dt>Build cost</dt><dd>' + esc(money(totalCapex(p), p)) + '</dd></dl><div class="review-total"><span>Estimated yearly sales<br><span class="small">' + esc(est.why) + '</span></span><strong>' + esc(N.money(est.value, p.input.currency, { compact: false })) + '</strong></div></div>' +
        '<div class="review-sec"><header><h3>Your funding</h3><button type="button" class="link-btn" data-go="3">Edit</button></header><dl><dt>Total project cost</dt><dd>' + esc(money(totalCapex(p), p)) + '</dd>' +
        f.equity.filter((e) => Number(e.amount) > 0).map((e) => '<dt>' + esc(e.label) + '</dt><dd>' + esc(money(e.amount, p)) + (e.pre_money ? ' at a ' + esc(money(e.pre_money, p)) + ' pre-money valuation' : '') + '</dd>').join('') +
        f.grants.filter((g) => Number(g.amount) > 0).map((g) => '<dt>' + esc(g.label) + '</dt><dd>' + esc(money(g.amount, p)) + '</dd>').join('') + loanRows + '</dl><p class="note-line ' + coverLine()[1] + '">' + esc(coverLine()[0]) + '</p></div>' +
        '<div class="similar"><h3>Similar projects</h3><p class="small muted">From the case library, scored on sector, funding, size, place and how they earn money. <a href="#method">How matching works</a></p><ol>' +
        sim.map((s) => '<li><a href="#library/' + esc(s.id) + '">' + esc(s.name) + '</a><div class="why">' + esc(s.why) + '</div></li>').join('') + '</ol></div>' +
        (ready.required.length ? '<div class="similar"><h3>Documents lenders and investors usually ask for</h3><p class="small muted">Tick what you already have. It counts towards your readiness score.</p><ul class="checklist">' +
          ready.required.map((d, i) => '<li><input type="checkbox" id="doc' + i + '" data-doc="' + esc(d) + '"' + (p.input.documents[d] ? ' checked' : '') + '><label for="doc' + i + '">' + esc(d) + '</label><span></span></li>').join('') + '</ul></div>' : '') +
        '<div class="form-foot"><button class="btn btn-quiet" type="button" data-go="3">Back</button><div class="right"><span class="muted small">Uses your estimates. You can explore different outcomes next.</span><button class="btn btn-primary" type="button" id="build">Build my financial model</button></div></div></div>';
    }

    /* ---------- render ---------- */
    const body = [null, step1, step2, step3, step4][step]();
    el.innerHTML = '<div class="page">' + A.backLink('#projects', 'Back to your projects') + '<div class="intake' + (step > 1 ? ' slim' : '') + '"><aside class="rail" aria-label="About this step"><p class="eyebrow">' + esc(r[0]) + '</p><h1>' + esc(r[1]) + '</h1><p class="intro">' + esc(r[2]) + '</p>' +
      (step > 1 ? summaryHTML() : '') + (step === 1 ? '<figure class="rail-img"><img src="img/hero-768.webp" width="768" height="512" alt="" loading="lazy"></figure>' : '') + '<p class="foot">' + esc(r[3]) + '</p></aside><div>' + stepper + body + '</div></div></div>';
    if (step === 3) { const [t, c] = coverLine(); const cl = $('#cover-line', el); cl.textContent = t; cl.className = 'note-line ' + c; }
    if (step === 4) p.meta.reachedReview = true;

    /* ---------- events ---------- */
    const refreshLive = (changed) => {
      const est = estimate();
      const ev = $('#est', el); if (ev) ev.textContent = N.money(est.value, p.input.currency, { compact: false });
      const ew = $('#est-why', el); if (ew) ew.textContent = est.why;
      const ct = $('#capex-total', el); if (ct) ct.textContent = money(totalCapex(p), p);
      const cl = $('#cover-line', el); if (cl) { const [t, c] = coverLine(); cl.textContent = t; cl.className = 'note-line ' + c; }
      if (changed && changed.startsWith('input.revenue.inputs.')) {
        const key = changed.split('.').pop(); const bEl = $('#b-' + key, el);
        if (bEl) { const tmp = document.createElement('div'); tmp.innerHTML = benchLine(key); bEl.replaceWith(tmp.firstChild || document.createTextNode('')); }
      }
    };
    el.addEventListener('input', (e) => {
      const t = e.target; const path = t.dataset && t.dataset.bind;
      if (!path) return;
      const v = t.dataset.num ? parseNum(t.value) : t.value;
      setPath(p, path, v);
      if (path.startsWith('input.revenue.inputs.')) { const k = path.split('.').pop(); if (p.meta.estimates[k]) { delete p.meta.estimates[k]; const badge = t.closest('.field').querySelector('.estimate-badge'); if (badge) badge.remove(); } }
      if (path === 'input.name' || path === 'input.country') { /* summary shown from step 2 */ }
      save(); refreshLive(path);
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.action === 'sector') { P.changeSector(p, t.value, D.sectors); save(); return; }
      if (t.dataset.action === 'ftype') { applyFundingType(p, t.value); save(); A.render(); return; }
      if (t.dataset.action === 'ramp') { const i = Number(t.value); if (RAMPS[i]) { p.input.revenue.ramp_up = RAMPS[i][1]; save(); } return; }
      if (t.dataset.action === 'capex-class') { const i = Number(t.id.replace('k-c', '')); p.input.capex[i].class = t.value; p.input.capex[i].life_years = (D.sectors.asset_classes[t.value] || {}).life_years || 10; save(); return; }
      if (t.dataset.doc) { p.input.documents[t.dataset.doc] = t.checked; save(); return; }
      if (t.tagName === 'SELECT' && t.dataset.bind) {
        setPath(p, t.dataset.bind, t.dataset.num ? parseNum(t.value) : t.value);
        save();
        if (/\.(currency|kind|repayment|grace_type|grace_years)$/.test(t.dataset.bind) || t.dataset.bind === 'input.currency') A.render();
      }
      if (t.id === 'f-file') handleFile(t.files[0]);
    });
    el.addEventListener('focusout', (e) => { const t = e.target; if (t.dataset && t.dataset.num && t.tagName === 'INPUT' && !t.readOnly) t.value = fmtNum(parseNum(t.value)); });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.go) { P.save(p); location.hash = '#edit/' + p.id + '/' + b.dataset.go; return; }
      if (b.dataset.notsure) {
        const k = b.dataset.notsure;
        const bench = M.benchmark(k, Object.assign({}, p.input, { id: p.id }), A.allCases().filter((c) => c.id !== p.meta.sourceCase), D.defaults);
        const i = tpl.inputs.find((x) => x.key === k);
        const v = bench ? +bench.median.toPrecision(3) : i.default;
        p.input.revenue.inputs[k] = v; p.meta.estimates[k] = bench ? 'benchmark' : 'default';
        const inpEl = $('#f-' + k, el); inpEl.value = fmtNum(v);
        const lab = inpEl.closest('.field').querySelector('label');
        if (!lab.querySelector('.estimate-badge')) lab.insertAdjacentHTML('beforeend', ' <span class="estimate-badge">Estimate</span>');
        A.toast(bench ? 'Filled in the middle of ' + bench.n + ' similar project' + (bench.n > 1 ? 's' : '') + ', marked as an estimate' : 'Filled in Tenor\'s starting estimate, marked as an estimate');
        save(); refreshLive('input.revenue.inputs.' + k); return;
      }
      if (b.dataset.addCapex) { p.input.capex.push({ label: '', class: 'equipment', amount: 0, life_years: 7 }); save(); A.render(); return; }
      if (b.dataset.removeCapex !== undefined) { p.input.capex.splice(Number(b.dataset.removeCapex), 1); save(); A.render(); return; }
      if (b.dataset.addCost) { p.input.opex.push({ label: 'Other cost', kind: 'fixed', amount: 0, extra: true }); save(); A.render(); return; }
      if (b.dataset.removeCost !== undefined) { p.input.opex.splice(Number(b.dataset.removeCost), 1); save(); A.render(); return; }
      if (b.dataset.addLoan) { p.input.financing.loans.push(newLoan(p, { label: 'Loan ' + (p.input.financing.loans.length + 1) })); if (p.input.financing.loans.length > 1) p.meta.fundingType = 'mix'; save(); A.render(); return; }
      if (b.dataset.removeLoan !== undefined) { p.input.financing.loans.splice(Number(b.dataset.removeLoan), 1); save(); A.render(); return; }
      if (b.dataset.addGrant) { p.input.financing.grants.push({ label: 'Grant', amount: 0, year: 1, provider_type: 'grant_funder' }); save(); A.render(); return; }
      if (b.dataset.addRound) { p.input.financing.equity.push({ label: 'Seed round', round: 'Seed', amount: 0, pre_money: 0, year: 1, provider_type: 'angel_seed' }); save(); A.render(); return; }
      if (b.id === 'read-text') { const txt = $('#f-paste', el).value; if (!txt.trim()) { A.toast('Paste some text first'); return; } showFindings(root.TenorExtract.extract(txt), 'your text'); return; }
      if (b.id === 'get-template') { root.TenorExport.download('template', { sector: p.input.sector, sectors: D.sectors }).catch((err) => A.toast(err.message)); return; }
      if (b.id === 'use-found') {
        const picked = $$('input[data-found]', el).filter((c) => c.checked).map((c) => findings[Number(c.dataset.found)]);
        applyFindings(p, picked, D.sectors); P.save(p); A.toast('Used ' + picked.length + ' item' + (picked.length === 1 ? '' : 's') + '. You can change any of them.'); A.render(); return;
      }
      if (b.id === 'discard-found') { findings = null; $('#found', el).innerHTML = ''; return; }
      if (b.id === 'build') { p.meta.draft = false; P.save(p); location.hash = '#results/' + p.id; }
    });
    const drop = $('#drop', el);
    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#f-file', el).click(); } });
      drop.tabIndex = 0; drop.setAttribute('role', 'button');
    }
    async function handleFile(file) {
      if (!file) return;
      const box = $('#found', el); box.innerHTML = '<p class="muted" style="margin-top:12px">Reading ' + esc(file.name) + '…</p>';
      try {
        const r = await root.TenorExtract.readFile(file);
        if (r.template) showFindings(templateToFindings(r.template), file.name + ' (Tenor template)');
        else showFindings(root.TenorExtract.extract(r.text), file.name);
      } catch (err) { box.innerHTML = '<p class="note-line warn">' + esc(err.message) + '</p>'; }
    }
    function showFindings(list, from) {
      findings = list;
      const box = $('#found', el);
      if (!list.length) { box.innerHTML = '<p class="note-line warn">Tenor did not find any amounts, rates or areas in ' + esc(from) + '. You can type your numbers in the next step.</p>'; return; }
      box.innerHTML = '<div class="found"><header><strong>We found ' + list.length + ' thing' + (list.length > 1 ? 's' : '') + ' in ' + esc(from) + '.</strong><span class="small muted">Tick what\'s right. Nothing is used until you confirm.</span></header><ul>' +
        list.map((f, i) => '<li><input type="checkbox" id="fd' + i + '" data-found="' + i + '" checked><label for="fd' + i + '"><strong>' + esc(f.label) + ':</strong> ' + esc(f.display) +
          (f.snippet ? '<span class="small muted" style="display:block">“' + esc(f.snippet.before) + '<mark>' + esc(f.snippet.match) + '</mark>' + esc(f.snippet.after) + '”</span>' : '') + '</label></li>').join('') +
        '</ul><footer><button type="button" class="btn btn-primary" id="use-found">Use the ticked items</button><button type="button" class="btn btn-quiet" id="discard-found">Discard</button></footer></div>';
    }
  }

  A.views.intake = view;
})(typeof self !== 'undefined' ? self : this);
