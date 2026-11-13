/*
 * Projects: creating, editing and saving them in this browser.
 * A project is { id, meta, input } where input is exactly what the engine runs.
 * Works in the browser (window.TenorProject).
 */
(function (root) {
  'use strict';
  const KEY = 'tenor.projects.v1', CASES_KEY = 'tenor.usercases.v1', PREFS_KEY = 'tenor.prefs.v1';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- storage (always guarded: private windows can block it) ---------- */
  function readJSON(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const list = () => Object.values(readJSON(KEY, {})).sort((a, b) => (b.meta.updated || 0) - (a.meta.updated || 0));
  const get = (id) => readJSON(KEY, {})[id] || null;
  function save(p) { const all = readJSON(KEY, {}); p.meta.updated = Date.now(); all[p.id] = p; return writeJSON(KEY, all); }
  function remove(id) { const all = readJSON(KEY, {}); delete all[id]; writeJSON(KEY, all); }
  const prefs = () => readJSON(PREFS_KEY, {});
  const setPref = (k, v) => { const p = prefs(); p[k] = v; writeJSON(PREFS_KEY, p); };
  const userCases = () => readJSON(CASES_KEY, []);
  const saveUserCases = (arr) => writeJSON(CASES_KEY, arr);

  /* ---------- building inputs ---------- */
  const COST_KIND = {
    fixed: 'fixed', pct_of_revenue: 'pct_revenue', pct_of_capex: 'pct_capex', pct_of_volume: 'pct_volume', per_new_customer: 'per_new_customer',
  };
  const VARIABLE_BASIS = {
    variable_per_ha_cycle: 'hectares * harvests_per_year', variable_per_animal_cycle: 'herd_size * cycles_per_year', variable_per_input_tonne: 'capacity_tpy * utilisation_pct / 100',
    variable_per_kwh: 'connections * kwh_per_connection_month * 12', variable_per_barrel: 'capacity_bpd * utilisation_pct / 100 * operating_days', variable_per_unit: 'units_per_month * 12 * utilisation_pct / 100',
  };
  function revenueFor(tpl, vars) {
    const mode = tpl.id === 'tech' ? 'subscription' : tpl.id === 'fintech' ? 'fintech' : 'formula';
    return { mode, formula: mode === 'formula' ? tpl.revenue_formula : undefined, inputs: vars, export_pct: 0, ramp_up: tpl.ramp_up_default || [1], price_growth_pct: undefined, volume_growth_pct: 0 };
  }
  function opexFor(tpl, vars) {
    return tpl.cost_lines.map((cl) => {
      if (VARIABLE_BASIS[cl.type]) { vars['cost_' + cl.key] = cl.default; return { label: cl.label, simple: cl.simple_label, kind: 'variable', formula: VARIABLE_BASIS[cl.type] + ' * cost_' + cl.key, key: cl.key }; }
      const kind = COST_KIND[cl.type];
      if (kind === 'fixed' || kind === 'per_new_customer') return { label: cl.label, simple: cl.simple_label, kind, amount: cl.default, key: cl.key };
      return { label: cl.label, simple: cl.simple_label, kind, pct: cl.default, key: cl.key };
    });
  }
  function newProject(sectorId, sectors, defaults) {
    const tpl = sectors.sectors.find((s) => s.id === sectorId) || sectors.sectors[0];
    const vars = {};
    tpl.inputs.forEach((i) => { if (typeof i.default === 'number') vars[i.key] = i.default; });
    if (tpl.id === 'tech') { vars.starting_customers = vars.starting_customers ?? 0; }
    const p = {
      id: uid(),
      meta: { description: '', stage: 'new', fundingType: 'own_plus_loan', estimates: {}, sourceCase: null, created: Date.now(), updated: Date.now(), crop: tpl.examples[0] },
      input: {
        name: '', sector: tpl.id, currency: 'USD', country: '', stage: 'new',
        timeline: { construction_years: ['tech', 'fintech'].includes(tpl.id) ? 0 : 1, start_year: new Date().getFullYear() + 1 },
        revenue: revenueFor(tpl, vars),
        capex: tpl.capex_lines.map((c) => ({ label: c.label, class: c.class, amount: 0, life_years: (sectors.asset_classes[c.class] || {}).life_years || 10 })),
        opex: opexFor(tpl, vars),
        financing: { equity: [{ label: 'Your own money', amount: 0, year: 1, provider_type: 'own' }], grants: [], loans: [] },
        documents: {},
      },
    };
    return p;
  }
  function changeSector(p, sectorId, sectors) {
    const tpl = sectors.sectors.find((s) => s.id === sectorId);
    if (!tpl || p.input.sector === sectorId) return p;
    const vars = {};
    tpl.inputs.forEach((i) => { if (typeof i.default === 'number') vars[i.key] = i.default; });
    p.input.sector = sectorId;
    p.input.revenue = revenueFor(tpl, vars);
    p.input.opex = opexFor(tpl, vars);
    if (!p.input.capex.some((c) => Number(c.amount) > 0)) p.input.capex = tpl.capex_lines.map((c) => ({ label: c.label, class: c.class, amount: 0, life_years: (sectors.asset_classes[c.class] || {}).life_years || 10 }));
    p.input.timeline.construction_years = ['tech', 'fintech'].includes(sectorId) ? 0 : Math.max(1, p.input.timeline.construction_years || 1);
    p.meta.estimates = {};
    p.meta.crop = tpl.examples[0];
    return p;
  }
  function fromCase(c, sectors, defaults) {
    const input = root.TenorAdapter.caseToInput(c, sectors, defaults);
    const tpl = sectors.sectors.find((s) => s.id === c.sector);
    input.opex.forEach((o) => { const cl = tpl && tpl.cost_lines.find((x) => x.label === o.label); if (cl) o.simple = cl.simple_label; });
    input.name = c.name;
    input.documents = {};
    input.sourceCase = c.id;
    input.timeline.start_year = input.timeline.start_year || 2027;
    const p = { id: uid(), meta: { description: c.concept, stage: c.stage, fundingType: fundingTypeOf(input), estimates: {}, sourceCase: c.id, created: Date.now(), updated: Date.now() }, input };
    return p;
  }
  function fundingTypeOf(input) {
    const f = input.financing; const L = f.loans || []; const eq = (f.equity || []).filter((e) => Number(e.amount) > 0); const gr = (f.grants || []).filter((g) => Number(g.amount) > 0);
    const kinds = [L.length ? 1 : 0, gr.length ? 1 : 0, eq.some((e) => e.pre_money > 0 || ['venture', 'angel_seed'].includes(e.provider_type)) ? 1 : 0].reduce((a, b) => a + b, 0);
    if (L.length > 1 || kinds > 1) return 'mix';
    if (L.length) return L[0].kind === 'equipment' ? 'equipment' : 'own_plus_loan';
    if (gr.length) return 'grant';
    if (eq.some((e) => e.pre_money > 0 || ['venture', 'angel_seed'].includes(e.provider_type))) return 'investors';
    return 'own';
  }

  /* Fill in tax, inflation, discount rate and working capital defaults so the engine always has them. */
  function engineInput(p, defaults) {
    const i = clone(p.input);
    const hard = (defaults.hard_currencies || []).includes(i.currency);
    const country = String(i.country || '').split(',').pop().trim();
    const public_ = (defaults.public_project_sectors || []).includes(i.sector);
    if (i.inflation_pct === undefined || i.inflation_pct === null) i.inflation_pct = hard ? defaults.inflation_pct.hard_currency : defaults.inflation_pct.local_currency;
    if (i.revenue.price_growth_pct === undefined || i.revenue.price_growth_pct === null) i.revenue.price_growth_pct = i.inflation_pct;
    if (!i.tax) i.tax = { rate_pct: public_ ? 0 : (defaults.tax_rate_pct_by_country[country] ?? defaults.tax_rate_pct_by_country.default), holiday_years: 0 };
    if (i.discount_rate_pct === undefined) i.discount_rate_pct = hard ? defaults.discount_rate_pct.hard_currency : defaults.discount_rate_pct.local_currency;
    if (!i.working_capital) { const w = defaults.working_capital_days[i.sector] || defaults.working_capital_days.default; i.working_capital = { receivable_days: w.receivable, inventory_days: w.inventory, payable_days: w.payable }; }
    i.defaults = defaults;
    i.stage = p.meta.stage || i.stage;
    (i.financing.loans || []).forEach((l) => { l.fx_rate = l.currency && l.currency !== i.currency ? (l.fx_rate || 1) : 1; if (!l.draws) l.draws = [{ year: 1, pct: 100 }]; });
    i.capex = (i.capex || []).filter((c) => Number(c.amount) > 0);
    return i;
  }

  /* Save a finished project as a case in this browser's library */
  function toUserCase(p, model) {
    const i = p.input;
    const v = (x, note) => ({ value: x, quality: 'assumed', note: note || 'Entered by the user' });
    const drivers = {}; Object.entries(i.revenue.inputs || {}).forEach(([k, x]) => { if (typeof x === 'number') drivers[k] = v(x); });
    return {
      id: 'user-' + p.id, name: i.name || 'My project', sponsor: 'My project', country: i.country || '', sector: i.sector, sub_sector: p.meta.crop || '', stage: p.meta.stage, concept: p.meta.description || '',
      revenue_model: '', currency: i.currency, fx: null, revenue_split: { domestic_pct: v(100 - (i.revenue.export_pct || 0)) }, drivers,
      capex: i.capex.map((c) => ({ label: c.label, class: c.class, amount: v(c.amount) })), opex: { fixed: [], variable: [] }, historicals: null,
      financing: { structure: fundingTypeOf(i), instruments: [].concat((i.financing.loans || []).map((l) => ({ type: 'loan', provider: l.label, provider_type: l.provider_type || 'commercial_bank', amount: v(l.amount), currency: l.currency || i.currency, tenor_years: v(l.tenor_years), grace_years: v(l.grace_years), interest_rate_pct: v(l.rate_pct), repayment_type: v(l.repayment) })),
        (i.financing.equity || []).map((e) => ({ type: 'equity', provider: e.label, provider_type: e.provider_type || 'own', amount: v(e.amount), currency: i.currency })), (i.financing.grants || []).map((g) => ({ type: 'grant', provider: g.label, provider_type: 'grant_funder', amount: v(g.amount), currency: i.currency }))) },
      timeline: {}, outcomes: { npv: model ? v(Math.round(model.kpis.npv), 'Calculated by Tenor') : undefined }, sources: [], caveats: ['Saved from your own project in this browser. All figures are your estimates.'], user: true,
    };
  }

  root.TenorProject = { list, get, save, remove, prefs, setPref, userCases, saveUserCases, newProject, changeSector, fromCase, fundingTypeOf, engineInput, toUserCase, clone, uid, VARIABLE_BASIS };
})(typeof self !== 'undefined' ? self : this);
