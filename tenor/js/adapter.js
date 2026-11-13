/*
 * Turns a case-library record (tenor/data/cases.json) into an engine input.
 * Works in the browser (window.TenorAdapter) and in Node (module.exports).
 * Every value it fills in without a case value is recorded in input.assumptions_used,
 * so the interface can show what came from the case and what came from a default.
 */
(function (root) {
  'use strict';

  const val = (x) => (x && typeof x === 'object' && !Array.isArray(x) && 'value' in x ? x.value : x);
  const isNum = (x) => typeof x === 'number' && isFinite(x);

  const VARIABLE_BASIS = {
    variable_per_ha_cycle: 'hectares * harvests_per_year',
    variable_per_animal_cycle: 'herd_size * cycles_per_year',
    variable_per_input_tonne: 'capacity_tpy * utilisation_pct / 100',
    variable_per_kwh: 'connections * kwh_per_connection_month * 12',
    variable_per_barrel: 'capacity_bpd * utilisation_pct / 100 * operating_days',
    variable_per_unit: 'units_per_month * 12 * utilisation_pct / 100',
  };

  function firstCountry(country) {
    return String(country || '').split(/,| and /)[0].trim();
  }

  function caseToInput(c, sectorsJson, defaults) {
    const tpl = sectorsJson.sectors.find((s) => s.id === c.sector);
    if (!tpl) throw new Error('No sector template for ' + c.sector);
    const used = [];
    const note = (field, value, why) => used.push({ field, value, why });

    /* ---- driver values ---- */
    const vars = {};
    Object.entries(c.drivers || {}).forEach(([k, v]) => { const x = val(v); if (isNum(x)) vars[k] = x; });
    tpl.inputs.forEach((inp) => {
      if (inp.type === 'select' || inp.type === 'text') return;
      if (!(inp.key in vars) && isNum(inp.default)) { vars[inp.key] = inp.default; note(inp.key, inp.default, 'Template default'); }
    });

    const currency = c.currency;
    const hard = (defaults.hard_currencies || []).includes(currency);
    const usdRate = c.fx && isNum(val(c.fx.usd_rate)) ? val(c.fx.usd_rate) : null;
    const toModel = (amount, cur) => {
      if (!cur || cur === currency) return amount;
      if (cur === 'USD' && usdRate) return amount * usdRate;
      throw new Error('Cannot convert ' + cur + ' to ' + currency + ' for ' + c.id);
    };
    const fxRateFor = (cur) => (!cur || cur === currency ? 1 : cur === 'USD' && usdRate ? usdRate : 1);

    const trading = c.stage === 'trading';
    const inflation = isNum(vars.inflation_pct) ? vars.inflation_pct : (hard ? defaults.inflation_pct.hard_currency : defaults.inflation_pct.local_currency);
    if (!isNum(vars.inflation_pct)) note('inflation_pct', inflation, hard ? 'Default for hard currencies' : 'Default for local currencies');

    /* ---- revenue ---- */
    const domestic = val(c.revenue_split && c.revenue_split.domestic_pct);
    const revenue = {
      inputs: vars,
      export_pct: isNum(domestic) ? 100 - domestic : 0,
      ramp_up: trading ? [1] : (val(c.ramp_up) || tpl.ramp_up_default || [1]),
      price_growth_pct: inflation,
      volume_growth_pct: 0,
    };
    let opening = null;
    const opex = [];
    let wcDays = (defaults.working_capital_days[c.sector] || defaults.working_capital_days.default);

    if (c.historicals) {
      const h = c.historicals.FY2024 || Object.values(c.historicals).find((x) => x && x.revenue);
      const k = /thousands/i.test(c.historicals.units || '') ? 1000 : 1;
      const sales = (h.revenue + (h.fair_value_biological_assets || 0)) * k;
      revenue.mode = 'historical';
      revenue.base_revenue = sales;
      revenue.volume_growth_pct = 5; note('volume_growth_pct', 5, 'Assumed volume growth for an already-trading business');
      const life = defaults.opening_asset_life_years || 20;
      const depEst = (h.property_plant_equipment * k) / life;
      opex.push({ label: 'Cost of sales (share of sales, from latest accounts)', kind: 'pct_revenue', pct: (-h.cost_of_sales * k) / sales * 100 });
      opex.push({ label: 'Administration and distribution, less estimated depreciation (from latest accounts)', kind: 'fixed',
        amount: (-(h.administrative_expenses || 0) - (h.distribution_expenses || 0)) * k - depEst });
      note('opening depreciation', depEst, 'Existing assets assumed to wear out over ' + life + ' years');
      const debtTotal = ((h.long_term_debt || 0) + (h.short_term_debt || 0)) * k;
      opening = {
        cash: h.cash * k, fixed_assets: h.property_plant_equipment * k, fixed_asset_life: life,
        ar: 0, inventory: 0, ap: 0,
        other_net_assets: (h.equity * k + debtTotal) - h.cash * k - h.property_plant_equipment * k,
      };
      wcDays = { receivable: 0, inventory: 0, payable: 0 };
      note('working capital', 0, 'Existing working capital held flat inside other net assets');
    } else if (c.sector === 'tech') {
      revenue.mode = 'subscription';
      revenue.ramp_up = [1];
    } else if (c.sector === 'fintech') {
      revenue.mode = 'fintech';
      revenue.ramp_up = [1];
      if (trading) revenue.existing_customers = vars.active_customers / (1 + (vars.customer_growth_pct || 0) / 100);
    } else {
      revenue.mode = 'formula';
      revenue.formula = tpl.revenue_formula;
    }

    /* ---- capex ---- */
    const classes = sectorsJson.asset_classes || {};
    const capex = (c.capex || []).map((l) => {
      const amt = val(l.amount);
      if (!isNum(amt)) return null;
      return { label: l.label, class: l.class, amount: toModel(amt, l.currency), life_years: (classes[l.class] || {}).life_years || 10 };
    }).filter(Boolean);
    const totalCapex = capex.reduce((s, x) => s + x.amount, 0);

    /* ---- operating costs from the case ---- */
    const parsePct = (s) => { const m = /([\d.]+)%\s*of capex/i.exec(String(s)); return m ? parseFloat(m[1]) : null; };
    let casePctCapex = false;
    const caseVariable = [];
    if (!c.historicals && c.opex) {
      (c.opex.fixed || []).forEach((f) => {
        const v = val(f.amount);
        if (isNum(v)) opex.push({ label: f.label, kind: 'fixed', amount: v });
        else if (parsePct(v) !== null) { opex.push({ label: f.label, kind: 'pct_capex', pct: parsePct(v) }); casePctCapex = true; }
      });
      (c.opex.variable || []).forEach((f) => { const v = val(f.amount); if (isNum(v)) caseVariable.push({ label: f.label, amount: v }); });
    }

    /* ---- template cost lines ---- */
    if (!c.historicals) {
      tpl.cost_lines.forEach((cl) => {
        const hasDriver = cl.key in (c.drivers || {}) && isNum(val(c.drivers[cl.key]));
        const amount = hasDriver ? val(c.drivers[cl.key]) : cl.default;
        if (cl.type === 'pct_of_revenue') { opex.push({ label: cl.label, kind: 'pct_revenue', pct: amount }); if (!hasDriver) note(cl.key, amount, 'Template default (% of sales)'); }
        else if (cl.type === 'pct_of_volume') { opex.push({ label: cl.label, kind: 'pct_volume', pct: amount }); if (!hasDriver) note(cl.key, amount, 'Template default (% of volume)'); }
        else if (cl.type === 'pct_of_capex') { if (!casePctCapex) { opex.push({ label: cl.label, kind: 'pct_capex', pct: amount }); if (!hasDriver) note(cl.key, amount, 'Template default (% of capex)'); } }
        else if (cl.type === 'per_new_customer') { opex.push({ label: cl.label, kind: 'per_new_customer', amount }); if (!hasDriver) note(cl.key, amount, 'Template default'); }
        else if (VARIABLE_BASIS[cl.type]) {
          let amt = hasDriver ? amount : null;
          if (amt === null && caseVariable.length) { const cv = caseVariable.shift(); amt = cv.amount; }
          if (amt !== null) { vars['cost_' + cl.key] = amt; opex.push({ label: cl.label, kind: 'variable', formula: VARIABLE_BASIS[cl.type] + ' * cost_' + cl.key }); }
        }
        // absolute fixed defaults are not used for library cases: their scale would not fit the project
      });
      if (caseVariable.length) note('unused variable costs', caseVariable.map((x) => x.label).join(', '), 'No matching variable cost basis in the sector template');
    }

    /* ---- financing ---- */
    const fin = { loans: [], equity: [], grants: [] };
    const instruments = (c.financing && c.financing.instruments) || [];
    instruments.forEach((ins) => {
      const amt = val(ins.amount);
      if (!isNum(amt) || amt <= 0) return;
      const t = ins.type;
      const loanLike = (share) => ({
        label: ins.provider, provider_type: ins.provider_type === 'mixed' ? 'commercial_bank' : ins.provider_type,
        amount: amt * share, currency: ins.currency, fx_rate: fxRateFor(ins.currency),
        draws: [{ year: c.historicals ? 0 : 1, pct: 100 }],
        tenor_years: val(ins.tenor_years) || 5, grace_years: val(ins.grace_years) || 0,
        grace_type: 'interest_only', rate_pct: val(ins.interest_rate_pct) || 0,
        repayment: val(ins.repayment_type) || 'annuity', upfront_fee_pct: 0,
        kind: t === 'equipment_loan' ? 'equipment' : 'loan',
      });
      if (t === 'loan' || t === 'equipment_loan' || t === 'subordinated_loan') fin.loans.push(loanLike(1));
      else if (t === 'mixed') {
        fin.loans.push(loanLike(0.6));
        fin.equity.push({ label: ins.provider + ' (equity share)', amount: toModel(amt * 0.4, ins.currency), year: 1, provider_type: 'own' });
        note('mixed funding split', '60% debt, 40% equity', 'Assumed split of private capital');
      } else if (t === 'grant') fin.grants.push({ label: ins.provider, amount: toModel(amt, ins.currency), year: 1, provider_type: ins.provider_type === 'dfi' ? 'grant_funder' : ins.provider_type });
      else if (t === 'equity') fin.equity.push({ label: ins.provider, amount: toModel(amt, ins.currency), year: 1, provider_type: ins.provider_type, pre_money: val(ins.pre_money_valuation) ? toModel(val(ins.pre_money_valuation), ins.currency) : undefined });
    });
    if (trading) fin.equity.forEach((e) => { e.year = 1; });

    /* ---- timeline, tax, rates ---- */
    const cy = c.timeline && val(c.timeline.construction_years);
    const construction = isNum(cy) ? cy : (c.stage === 'new' && totalCapex > 0 && !['tech', 'fintech'].includes(c.sector) ? 1 : 0);
    if (!isNum(cy)) note('construction_years', construction, 'Default: 1 year for new physical projects, 0 otherwise');
    const publicProject = (defaults.public_project_sectors || []).includes(c.sector);
    const country = firstCountry(c.country);
    const taxRate = publicProject ? 0 : (defaults.tax_rate_pct_by_country[country] ?? defaults.tax_rate_pct_by_country.default);
    note('tax rate', taxRate, publicProject ? 'Public project, no corporate tax' : 'Headline rate for ' + country);
    const dSourced = c.outcomes && val(c.outcomes.discount_rate_pct);
    const discount = isNum(dSourced) ? dSourced : (hard ? defaults.discount_rate_pct.hard_currency : defaults.discount_rate_pct.local_currency);
    if (!isNum(dSourced)) note('discount rate', discount, 'Default');

    return {
      id: c.id, name: c.name, sector: c.sector, currency, country: c.country, stage: c.stage,
      timeline: { construction_years: construction, start_year: 2027 },
      revenue, capex, opex, opening,
      working_capital: { receivable_days: wcDays.receivable, inventory_days: wcDays.inventory, payable_days: wcDays.payable },
      tax: { rate_pct: taxRate, holiday_years: 0 },
      inflation_pct: inflation,
      discount_rate_pct: discount,
      financing: fin,
      documents: {},
      defaults,
      assumptions_used: used,
    };
  }

  const api = { caseToInput, val };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorAdapter = api;
})(typeof self !== 'undefined' ? self : this);
