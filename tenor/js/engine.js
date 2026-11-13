/*
 * Tenor modelling engine.
 * Plain JavaScript, no DOM. Works in the browser (window.TenorEngine) and in Node (module.exports).
 *
 * Conventions
 * - Annual model, years 1..N. Cash flows happen during the year; loans are drawn at the start of a year.
 * - Amounts are in the model currency. Foreign-currency loans carry an fx_rate (model currency per unit of
 *   loan currency) and are revalued each year by an FX index, with the difference booked as an FX loss.
 * - No circular references: no interest on cash balances, no debt sculpting. This keeps the Excel export
 *   free of circular formulas.
 * - Every calculation here is mirrored by a formula in the Excel export, so keep it expressible with
 *   SUM, IF, INDEX, MATCH, PMT, IPMT, PPMT, NPV, IRR, MIN and MAX.
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ helpers */

  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const zeros = (n) => new Array(n + 1).fill(0); // index 0 = opening / before year 1
  const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
  const num = (x, fallback = 0) => (typeof x === 'number' && isFinite(x) ? x : fallback);

  /* Safe arithmetic expression evaluator: numbers, identifiers, + - * / and brackets. No eval. */
  function compile(expr) {
    const tokens = [];
    const re = /\s*(\d+\.?\d*(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/()])/gy;
    let m;
    re.lastIndex = 0;
    while (re.lastIndex < expr.length && (m = re.exec(expr))) tokens.push(m[1]);
    if (tokens.join('') !== expr.replace(/\s+/g, '')) throw new Error('Formula has characters Tenor cannot read: ' + expr);
    let i = 0;
    const peek = () => tokens[i];
    const next = () => tokens[i++];
    function primary() {
      const t = next();
      if (t === '(') { const v = additive(); if (next() !== ')') throw new Error('Missing ) in ' + expr); return v; }
      if (t === '-') { const v = primary(); return (vars) => -v(vars); }
      if (/^\d/.test(t)) { const n = parseFloat(t); return () => n; }
      if (/^[A-Za-z_]/.test(t)) return (vars) => {
        if (!(t in vars)) throw new Error('Formula needs a value for "' + t + '"');
        return num(Number(vars[t]));
      };
      throw new Error('Unexpected "' + t + '" in ' + expr);
    }
    function multiplicative() {
      let l = primary();
      while (peek() === '*' || peek() === '/') {
        const op = next(); const r = primary(); const a = l;
        l = op === '*' ? (v) => a(v) * r(v) : (v) => { const d = r(v); return d === 0 ? 0 : a(v) / d; };
      }
      return l;
    }
    function additive() {
      let l = multiplicative();
      while (peek() === '+' || peek() === '-') {
        const op = next(); const r = multiplicative(); const a = l;
        l = op === '+' ? (v) => a(v) + r(v) : (v) => a(v) - r(v);
      }
      return l;
    }
    const fn = additive();
    if (i !== tokens.length) throw new Error('Could not read the end of formula: ' + expr);
    return fn;
  }
  function evaluate(expr, vars) { return compile(expr)(vars); }

  /* Excel-compatible financial functions */
  function pmt(rate, nper, pv, fv = 0) {
    if (nper <= 0) return 0;
    if (rate === 0) return -(pv + fv) / nper;
    const f = Math.pow(1 + rate, nper);
    return -(rate * (pv * f + fv)) / (f - 1);
  }
  /* NPV with Excel semantics: first value discounted by one period. */
  function npv(rate, flows) { return flows.reduce((s, cf, i) => s + cf / Math.pow(1 + rate, i + 1), 0); }
  /* IRR: returns null when flows never change sign. Newton first, bisection as a fallback. */
  function irr(flows, guess = 0.1) {
    const hasNeg = flows.some((x) => x < 0), hasPos = flows.some((x) => x > 0);
    if (!hasNeg || !hasPos) return null;
    const f = (r) => flows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
    const df = (r) => flows.reduce((s, cf, i) => s - (i * cf) / Math.pow(1 + r, i + 1), 0);
    let r = guess;
    for (let k = 0; k < 100; k++) {
      const v = f(r), d = df(r);
      if (!isFinite(v) || !isFinite(d) || d === 0) break;
      const nr = r - v / d;
      if (Math.abs(nr - r) < 1e-10) { if (nr > -0.9999) return nr; break; }
      r = nr;
      if (r <= -0.9999) break;
    }
    let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
    if (flo * fhi > 0) return null;
    for (let k = 0; k < 300; k++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (Math.abs(fm) < 1e-9) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  /* ------------------------------------------------------------------ loans */

  /*
   * loan: { label, amount (loan currency), currency, fx_rate, draws:[{year, pct}], tenor_years (incl. grace),
   *         grace_years, grace_type: 'interest_only'|'capitalised', rate_pct, repayment: 'annuity'|'equal_principal'|'bullet',
   *         upfront_fee_pct, balloon_pct, kind: 'loan'|'equipment'|'lease' }
   * A draw in year 0 means the loan already exists at the start of the model (a trading business).
   */
  function loanSchedule(loan, N, fxIndex) {
    const r = num(loan.rate_pct) / 100;
    const draws = (loan.draws && loan.draws.length ? loan.draws : [{ year: 1, pct: 100 }]);
    const drawFc = zeros(N);
    draws.forEach((d) => { const y = Math.max(0, Math.min(N, Math.round(d.year))); drawFc[y] += num(loan.amount) * num(d.pct, 100) / 100; });
    const firstDraw = draws.reduce((m, d) => Math.min(m, Math.round(d.year)), Infinity);
    const start = Math.max(1, firstDraw);
    const tenor = Math.max(1, Math.round(num(loan.tenor_years, 1)));
    const grace = Math.max(0, Math.min(tenor - 1, Math.round(num(loan.grace_years))));
    const firstRepay = start + grace;
    const last = start + tenor - 1;
    const n = last - firstRepay + 1;
    const capitalise = loan.grace_type === 'capitalised';
    const balloonPct = num(loan.balloon_pct) / 100;

    const s = {
      label: loan.label, start, firstRepay, last, rate: r,
      opening: zeros(N), draw: drawFc, interest: zeros(N), interestPaid: zeros(N), capitalised: zeros(N),
      principal: zeros(N), fee: zeros(N), closing: zeros(N),
    };
    s.closing[0] = drawFc[0];
    let instalment = null, base = 0;
    for (let t = 1; t <= N; t++) {
      s.opening[t] = s.closing[t - 1];
      const bal = s.opening[t] + drawFc[t];
      const interest = bal * r;
      s.interest[t] = interest;
      if (t < firstRepay) {
        if (capitalise) s.capitalised[t] = interest; else s.interestPaid[t] = interest;
      } else if (t <= last) {
        s.interestPaid[t] = interest;
        if (t === firstRepay) {
          base = bal;
          if (loan.repayment === 'annuity') instalment = -pmt(r, n, base, -base * balloonPct);
          else if (loan.repayment === 'equal_principal') instalment = (base * (1 - balloonPct)) / n;
        }
        let p = 0;
        if (t === last) p = bal; // clears balloon, bullet and any rounding
        else if (loan.repayment === 'annuity') p = instalment - interest;
        else if (loan.repayment === 'equal_principal') p = instalment;
        else p = 0; // bullet
        s.principal[t] = Math.max(0, Math.min(bal, p));
      }
      s.closing[t] = bal + s.capitalised[t] - s.principal[t];
    }
    const feeYear = Math.max(1, firstDraw);
    if (feeYear <= N) s.fee[feeYear] = num(loan.amount) * num(loan.upfront_fee_pct) / 100;

    // Convert to model currency with the FX index (1 in year 1 unless stressed).
    const fx = num(loan.fx_rate, 1);
    const conv = (arr) => arr.map((v, t) => v * fx * fxIndex[Math.max(1, t)]);
    s.local = {
      draw: conv(drawFc), interestPaid: conv(s.interestPaid), capitalised: conv(s.capitalised),
      interest: conv(s.interest), principal: conv(s.principal), fee: conv(s.fee), closing: conv(s.closing),
    };
    s.local.closing[0] = s.closing[0] * fx * fxIndex[1];
    s.local.fxLoss = zeros(N);
    for (let t = 1; t <= N; t++) {
      const expected = s.local.closing[t - 1] + s.local.draw[t] + s.local.capitalised[t] - s.local.principal[t];
      s.local.fxLoss[t] = s.local.closing[t] - expected;
    }
    return s;
  }

  /* ------------------------------------------------------------------ main model */

  function modelYears(input) {
    const d = input.defaults || {};
    let N = num(input.timeline && input.timeline.model_years, 0);
    const minY = num(d.min_model_years, 10), maxY = num(d.max_model_years, 30);
    (input.financing && input.financing.loans || []).forEach((l) => {
      const draws = l.draws && l.draws.length ? l.draws : [{ year: 1 }];
      const start = Math.max(1, Math.min(...draws.map((x) => x.year)));
      N = Math.max(N, start + Math.round(num(l.tenor_years, 1)) - 1);
    });
    const C = num(input.timeline && input.timeline.construction_years);
    N = Math.max(N, minY, C + 5);
    return Math.min(N, maxY);
  }

  function run(input, adj = {}) {
    const N = modelYears(input);
    const tl = input.timeline || {};
    const Cbase = Math.max(0, Math.round(num(tl.construction_years)));
    const C = Cbase + Math.max(0, Math.round(num(adj.delay_years)));
    const opsStart = C + 1;
    const startYear = num(tl.start_year, 2027);
    const infl = num(input.inflation_pct) / 100;
    const priceG = num(input.revenue && input.revenue.price_growth_pct, num(input.inflation_pct)) / 100;
    const volG = num(input.revenue && input.revenue.volume_growth_pct) / 100;
    const ramp = (input.revenue && input.revenue.ramp_up) || [1];
    const priceAdj = num(adj.price, 1), volAdj = num(adj.volume, 1), opexAdj = num(adj.opex, 1);
    const fxDep = num(adj.fx_depreciation_pct, num(input.fx_depreciation_pct)) / 100;

    const years = []; for (let t = 1; t <= N; t++) years.push(startYear + t - 1);
    const fxIndex = zeros(N).map((_, t) => Math.pow(1 + fxDep, Math.max(0, t - 1)));
    const costIdx = (t) => Math.pow(1 + infl, t - 1);
    const priceIdx = (t) => Math.pow(1 + priceG, t - 1);
    const opYear = (t) => t - opsStart + 1; // 1 in first operating year
    const activity = (t) => {
      const k = opYear(t);
      if (k < 1) return 0;
      const rf = k <= ramp.length ? num(ramp[k - 1], 1) : num(ramp[ramp.length - 1], 1);
      return rf * Math.pow(1 + volG, k - 1) * volAdj;
    };

    /* ---- revenue and activity-driven costs ---- */
    const rv = input.revenue || {};
    const vars = Object.assign({}, rv.inputs || {});
    const revenue = zeros(N), exportRev = zeros(N), volumeMoved = zeros(N), newCustomers = zeros(N), customers = zeros(N);
    if (rv.mode === 'subscription') {
      let S = num(vars.starting_customers);
      for (let t = 1; t <= N; t++) {
        const k = opYear(t);
        if (k < 1) continue;
        const churn = Math.min(0.99, num(vars.churn_pct_month) / 100);
        const r = 1 - churn;
        const nm = num(vars.new_customers_month) * Math.pow(1 + num(vars.growth_pct_year) / 100, k - 1) * volAdj;
        const r12 = Math.pow(r, 12);
        const E = churn === 0 ? S + 12 * nm : S * r12 + nm * (1 - r12) / (1 - r);
        customers[t] = (S + E) / 2;
        newCustomers[t] = 12 * nm;
        revenue[t] = customers[t] * num(vars.price_per_month) * 12 * priceIdx(t) * priceAdj;
        S = E;
      }
    } else if (rv.mode === 'fintech') {
      let prev = num(rv.existing_customers);
      for (let t = 1; t <= N; t++) {
        const k = opYear(t);
        if (k < 1) continue;
        const c = num(vars.active_customers) * Math.pow(1 + num(vars.customer_growth_pct) / 100, k - 1) * volAdj;
        customers[t] = c;
        newCustomers[t] = Math.max(0, c - prev);
        prev = c;
        volumeMoved[t] = c * num(vars.volume_per_customer) * priceIdx(t);
        revenue[t] = volumeMoved[t] * num(vars.take_rate_pct) / 100 * priceAdj;
      }
    } else {
      const base = rv.mode === 'historical' ? num(rv.base_revenue) : (rv.formula ? evaluate(rv.formula, vars) : 0);
      for (let t = 1; t <= N; t++) revenue[t] = base * activity(t) * priceIdx(t) * priceAdj;
    }
    const exportPct = num(rv.export_pct) / 100;
    for (let t = 1; t <= N; t++) exportRev[t] = revenue[t] * exportPct;

    /* ---- capex and depreciation ---- */
    const capexLines = (input.capex || []).map((c) => {
      const spend = zeros(N);
      const amt = num(c.amount);
      if (c.year) spend[Math.min(N, Math.max(1, c.year))] += amt;
      else { const span = Math.max(1, Cbase); for (let y = 1; y <= span; y++) spend[y] += amt / span; }
      return { label: c.label, class: c.class, life: Math.max(1, num(c.life_years, 10)), spend };
    });
    const capex = zeros(N), dep = zeros(N);
    capexLines.forEach((l) => {
      l.dep = zeros(N);
      for (let y = 1; y <= N; y++) {
        if (!l.spend[y]) continue;
        const from = Math.max(y, opsStart);
        for (let t = from; t < from + l.life && t <= N; t++) l.dep[t] += l.spend[y] / l.life;
      }
      for (let t = 1; t <= N; t++) { capex[t] += l.spend[t]; dep[t] += l.dep[t]; }
    });
    const op = input.opening || {};
    const openingFA = num(op.fixed_assets);
    const openingLife = Math.max(1, num(op.fixed_asset_life, 20));
    for (let t = 1; t <= Math.min(N, openingLife); t++) dep[t] += openingFA / openingLife;
    const totalCapex = sum(capex);

    /* ---- operating costs ---- */
    const varCost = zeros(N), fixCost = zeros(N), cacCost = zeros(N), lossCost = zeros(N);
    const costLines = (input.opex || []).map((c) => {
      const line = { label: c.label, kind: c.kind, values: zeros(N) };
      for (let t = 1; t <= N; t++) {
        if (opYear(t) < 1) continue;
        let v = 0;
        switch (c.kind) {
          case 'fixed': v = num(c.amount) * costIdx(t); break;
          case 'variable': v = (c.formula ? evaluate(c.formula, vars) : num(c.amount)) * activity(t) * costIdx(t); break;
          case 'pct_revenue': v = revenue[t] * num(c.pct) / 100; break;
          case 'pct_capex': v = totalCapex * num(c.pct) / 100 * costIdx(t); break;
          case 'pct_volume': v = volumeMoved[t] * num(c.pct) / 100; break;
          case 'per_new_customer': v = newCustomers[t] * num(c.amount) * costIdx(t); break;
          default: v = 0;
        }
        line.values[t] = v * opexAdj;
      }
      return line;
    });
    costLines.forEach((l) => {
      for (let t = 1; t <= N; t++) {
        if (l.kind === 'fixed' || l.kind === 'pct_capex') fixCost[t] += l.values[t];
        else varCost[t] += l.values[t];
        if (l.kind === 'per_new_customer') cacCost[t] += l.values[t];
        if (l.kind === 'pct_volume') lossCost[t] += l.values[t];
      }
    });

    /* ---- financing ---- */
    const fin = input.financing || {};
    const loans = (fin.loans || []).map((l) => {
      const ln = Object.assign({}, l);
      if (adj.rate_add_pct) ln.rate_pct = num(ln.rate_pct) + adj.rate_add_pct;
      const isForeign = ln.currency && input.currency && ln.currency !== input.currency;
      const sch = loanSchedule(ln, N, isForeign ? fxIndex : zeros(N).map(() => 1));
      sch.foreign = !!isForeign; sch.fxRate = num(ln.fx_rate, 1);
      return sch;
    });
    const equityIn = zeros(N), grantIn = zeros(N);
    (fin.equity || []).forEach((e) => { equityIn[Math.min(N, Math.max(1, num(e.year, 1)))] += num(e.amount); });
    (fin.grants || []).forEach((g) => { grantIn[Math.min(N, Math.max(1, num(g.year, 1)))] += num(g.amount); });
    const L = (key) => { const a = zeros(N); loans.forEach((s) => s.local[key].forEach((v, t) => { a[t] += v; })); return a; };
    const draw = L('draw'), intPaid = L('interestPaid'), intCap = L('capitalised'), principal = L('principal'), fees = L('fee'), debt = L('closing'), fxLoss = L('fxLoss');

    /* ---- P&L, tax, working capital, cash flow, balance sheet ---- */
    const wc = input.working_capital || {};
    const tax = input.tax || {};
    const taxRate = num(tax.rate_pct) / 100;
    const holiday = Math.max(0, Math.round(num(tax.holiday_years)));
    const out = {
      revenue, exportRev, domesticRev: revenue.map((v, t) => v - exportRev[t]), varCost, grossProfit: zeros(N), fixCost, ebitda: zeros(N),
      dep, ebit: zeros(N), interest: zeros(N), fees, fxLoss, pbt: zeros(N), taxCharge: zeros(N), netIncome: zeros(N),
      ar: zeros(N), inventory: zeros(N), ap: zeros(N), dWC: zeros(N),
      cfo: zeros(N), capex, cfi: zeros(N), equityIn, grantIn, draw, intPaid, intCap, principal, cff: zeros(N), netCash: zeros(N), cash: zeros(N),
      nfa: zeros(N), debt, equity: zeros(N), assets: zeros(N), liabilities: zeros(N), bsDiff: zeros(N),
      cfads: zeros(N), debtService: zeros(N), dscr: zeros(N).map(() => null), projectFCF: zeros(N), fcfe: zeros(N), cashAfterDebt: zeros(N),
      customers, newCustomers, cacCost, lossCost, volumeMoved,
    };
    out.ar[0] = num(op.ar); out.inventory[0] = num(op.inventory); out.ap[0] = num(op.ap);
    out.cash[0] = num(op.cash); out.nfa[0] = openingFA;
    const otherNet = num(op.other_net_assets);
    const openingEquity = out.cash[0] + out.ar[0] + out.inventory[0] + openingFA + otherNet - out.ap[0] - debt[0];
    out.equity[0] = openingEquity;
    let lossPool = 0, retained = 0, paidIn = 0;
    for (let t = 1; t <= N; t++) {
      out.grossProfit[t] = revenue[t] - varCost[t];
      out.ebitda[t] = out.grossProfit[t] - fixCost[t];
      out.ebit[t] = out.ebitda[t] - dep[t];
      out.interest[t] = intPaid[t] + intCap[t];
      out.pbt[t] = out.ebit[t] - out.interest[t] - fees[t] - fxLoss[t];
      const k = opYear(t);
      const onHoliday = k >= 1 && k <= holiday;
      if (onHoliday) out.taxCharge[t] = 0;
      else if (out.pbt[t] < 0) { lossPool += -out.pbt[t]; out.taxCharge[t] = 0; }
      else { const used = Math.min(lossPool, out.pbt[t]); lossPool -= used; out.taxCharge[t] = (out.pbt[t] - used) * taxRate; }
      out.netIncome[t] = out.pbt[t] - out.taxCharge[t];

      const cashCosts = varCost[t] + fixCost[t];
      out.ar[t] = revenue[t] * num(wc.receivable_days) / 365;
      out.inventory[t] = varCost[t] * num(wc.inventory_days) / 365;
      out.ap[t] = cashCosts * num(wc.payable_days) / 365;
      out.dWC[t] = (out.ar[t] + out.inventory[t] - out.ap[t]) - (out.ar[t - 1] + out.inventory[t - 1] - out.ap[t - 1]);

      out.cfo[t] = out.ebitda[t] - out.taxCharge[t] - out.dWC[t];
      out.cfi[t] = -capex[t];
      out.cff[t] = equityIn[t] + grantIn[t] + draw[t] - fees[t] - intPaid[t] - principal[t];
      out.netCash[t] = out.cfo[t] + out.cfi[t] + out.cff[t];
      out.cash[t] = out.cash[t - 1] + out.netCash[t];

      out.nfa[t] = out.nfa[t - 1] + capex[t] - dep[t];
      retained += out.netIncome[t];
      paidIn += equityIn[t] + grantIn[t];
      out.equity[t] = openingEquity + paidIn + retained;
      out.assets[t] = out.cash[t] + out.ar[t] + out.inventory[t] + out.nfa[t] + otherNet;
      out.liabilities[t] = out.ap[t] + debt[t];
      out.bsDiff[t] = out.assets[t] - out.liabilities[t] - out.equity[t];

      // CFADS: cash from operations available for debt service. Capex in the plan is treated as funded by
      // the financing plan, so it is not deducted here (it is deducted in project free cash flow).
      out.cfads[t] = out.ebitda[t] - out.taxCharge[t] - out.dWC[t];
      out.debtService[t] = intPaid[t] + principal[t];
      // DSCR is only measured once operations start: lenders size grace periods to cover construction.
      out.dscr[t] = k >= 1 && out.debtService[t] > 1e-9 ? out.cfads[t] / out.debtService[t] : null;
      out.cashAfterDebt[t] = out.cfads[t] - out.debtService[t];
      out.projectFCF[t] = out.ebitda[t] - out.taxCharge[t] - out.dWC[t] - capex[t];
      out.fcfe[t] = out.projectFCF[t] + grantIn[t] + draw[t] - intPaid[t] - fees[t] - principal[t];
    }

    /* ---- KPIs ---- */
    const dr = num(input.discount_rate_pct, 12) / 100;
    const yrs = (a) => a.slice(1);
    // Margins are read in a representative year: after ramp-up, or year 5 of trading for growth businesses.
    const growthMode = rv.mode === 'subscription' || rv.mode === 'fintech';
    const steady = Math.min(N, opsStart + Math.max(ramp.length - 1, growthMode ? 4 : 0));
    const dscrs = yrs(out.dscr).filter((x) => x !== null);
    const debtDrawnLocal = sum(yrs(draw)) + debt[0];
    const totalEquity = sum(yrs(equityIn)) + Math.max(0, openingEquity);
    const totalGrants = sum(yrs(grantIn));
    let llcr = null;
    if (loans.length) {
      const R = Math.min(...loans.map((s) => s.firstRepay));
      const Lend = Math.max(...loans.map((s) => s.last));
      const owed = loans.reduce((s, l) => s + l.local.closing[R - 1] + l.local.draw[R], 0);
      const wr = loans.reduce((s, l) => s + l.rate * (num(l.local.closing[R - 1]) + num(l.local.draw[R])), 0) / (owed || 1);
      let pv = 0;
      for (let t = R; t <= Math.min(N, Lend); t++) pv += out.cfads[t] / Math.pow(1 + wr, t - R + 1);
      llcr = owed > 1e-9 ? pv / owed : null;
    }
    let cum = 0, payback = null, wasNeg = false;
    for (let t = 1; t <= N; t++) {
      const prev = cum; cum += out.projectFCF[t];
      if (prev < 0 || cum < 0) wasNeg = true;
      if (wasNeg && prev < 0 && cum >= 0 && payback === null) payback = (t - 1) + (-prev / out.projectFCF[t]);
    }
    let runwayMonths = null;
    for (let t = 1; t <= N; t++) {
      if (out.cash[t] < 0) { const st = out.cash[t - 1]; runwayMonths = st <= 0 ? 12 * (t - 1) : 12 * (t - 1) + 12 * st / (st - out.cash[t]); break; }
    }
    const varRatio = revenue[steady] > 0 ? varCost[steady] / revenue[steady] : null;
    const breakEven = varRatio !== null && varRatio < 1 ? fixCost[steady] / (1 - varRatio) : null;
    const funded = sum(yrs(equityIn)) + totalGrants + sum(yrs(draw));
    const uses = { capex: totalCapex, fees: sum(yrs(fees)) };
    uses.reserve = funded - uses.capex - uses.fees;

    const kpis = {
      steadyYear: steady,
      grossMargin: revenue[steady] > 0 ? out.grossProfit[steady] / revenue[steady] : null,
      ebitdaMargin: revenue[steady] > 0 ? out.ebitda[steady] / revenue[steady] : null,
      dscrMin: dscrs.length ? Math.min(...dscrs) : null,
      dscrAvg: dscrs.length ? sum(dscrs) / dscrs.length : null,
      llcr,
      projectIRR: irr(yrs(out.projectFCF)),
      equityIRR: irr(yrs(out.fcfe)),
      npv: npv(dr, yrs(out.projectFCF)),
      discountRate: dr,
      paybackYears: payback,
      breakEvenRevenue: breakEven,
      marginOfSafety: breakEven !== null && revenue[steady] > 0 ? 1 - breakEven / revenue[steady] : null,
      gearing: (debtDrawnLocal + totalEquity + totalGrants) > 0 ? debtDrawnLocal / (debtDrawnLocal + totalEquity + totalGrants) : null,
      runwayMonths,
      lowestCash: Math.min(...yrs(out.cash)),
      peakFunding: Math.max(0, -Math.min(0, ...yrs(out.cash))),
      totalRevenue: sum(yrs(revenue)),
      totalCashAfterDebt: sum(yrs(out.cashAfterDebt)),
      largestDebtService: Math.max(0, ...yrs(out.debtService)),
      // first year whose payment is within a hair of the largest (annuity payments are equal, so ties are common)
      largestDebtServiceYear: (() => { const mx = Math.max(0, ...yrs(out.debtService)); if (mx <= 0) return null; for (let t = 1; t <= N; t++) if (out.debtService[t] >= mx * (1 - 1e-9)) return t; return null; })(),
      loanPaidOffYear: loans.length ? Math.max(...loans.map((s) => s.last)) : null,
    };

    const checks = {
      balanceSheetBalances: yrs(out.bsDiff).every((d, i) => Math.abs(d) <= 1e-6 * Math.max(1, Math.abs(out.assets[i + 1]))),
      debtFullyRepaid: loans.every((s) => Math.abs(s.closing[N]) <= 1e-6 * Math.max(1, num(s.draw.reduce((a, b) => a + b, 0)))),
      sourcesEqualUses: Math.abs(funded - (uses.capex + uses.fees + uses.reserve)) < 1e-6,
      fundingCoversCapex: uses.reserve >= -1e-6,
      allFinite: Object.values(out).every((arr) => !Array.isArray(arr) || arr.every((v) => v === null || isFinite(v))),
    };

    /* ---- equity rounds and dilution ---- */
    const ownership = [{ holder: 'Founders and existing owners', pct: 100 }];
    (fin.equity || []).filter((e) => num(e.pre_money) > 0).sort((a, b) => num(a.year, 1) - num(b.year, 1)).forEach((e) => {
      const post = num(e.pre_money) + num(e.amount);
      const newPct = (num(e.amount) / post) * 100;
      ownership.forEach((o) => { o.pct *= (1 - newPct / 100); });
      ownership.push({ holder: e.label || 'New investors', pct: newPct, round: e.round || null, post_money: post });
    });

    /* ---- quarterly view, first 3 years (annual flows split evenly) ---- */
    const quarterly = [];
    let qcash = out.cash[0];
    for (let t = 1; t <= Math.min(3, N); t++) {
      for (let q = 1; q <= 4; q++) {
        const net = out.netCash[t] / 4;
        qcash += net;
        quarterly.push({ year: t, quarter: q, label: years[t - 1] + ' Q' + q,
          revenue: revenue[t] / 4, costs: (varCost[t] + fixCost[t]) / 4, ebitda: out.ebitda[t] / 4,
          debtService: out.debtService[t] / 4, netCash: net, closingCash: qcash });
      }
    }

    return { N, years, constructionYears: C, opsStart, currency: input.currency, out, loans, capexLines, costLines, kpis, checks, ownership, quarterly, uses, funded };
  }

  /* ------------------------------------------------------------------ what-ifs */

  /*
   * A what-if keeps the base build, capex, depreciation and financing, and changes operations:
   *   price: sales x factor (and costs that are a share of sales)
   *   volume: sales and volume-linked costs x factor
   *   opex: every running cost x factor
   *   delay_years (0 or 1): sales and running costs start a year later, indexed for one more year of inflation
   *   fx_depreciation_pct: foreign-currency loans cost more each year in model currency
   * Tax, working capital, debt cover and cash are then recalculated. The Excel Sensitivity sheet uses the same steps.
   */
  function scenario(input, m, adj = {}) {
    const N = m.N, o = m.out;
    const p = num(adj.price, 1), v = num(adj.volume, 1), ox = num(adj.opex, 1), s = Math.round(num(adj.delay_years));
    const d = num(adj.fx_depreciation_pct, num(input.fx_depreciation_pct)) / 100;
    const priceG = num(input.revenue && input.revenue.price_growth_pct, num(input.inflation_pct)) / 100;
    const infl = num(input.inflation_pct) / 100;
    const shift = (row, g) => row.map((x, t) => (t === 0 ? 0 : s ? (t - s >= 1 ? row[t - s] * Math.pow(1 + g, s) : 0) : row[t]));
    const rev = shift(o.revenue, priceG).map((x) => x * p * v);
    const varC = zeros(N), fixC = zeros(N);
    m.costLines.forEach((l) => {
      const g = l.kind === 'pct_revenue' || l.kind === 'pct_volume' ? priceG : infl;
      const f = (l.kind === 'pct_revenue' ? p * v : l.kind === 'fixed' || l.kind === 'pct_capex' ? 1 : v) * ox;
      const row = shift(l.values, g);
      for (let t = 1; t <= N; t++) {
        if (l.kind === 'fixed' || l.kind === 'pct_capex') fixC[t] += row[t] * f; else varC[t] += row[t] * f;
      }
    });
    const wc = input.working_capital || {};
    const idx = (l, t) => (l.foreign ? Math.pow(1 + d, Math.max(0, t - 1)) : 1);
    const L = { intPaid: zeros(N), cap: zeros(N), prin: zeros(N), draw: zeros(N), fee: zeros(N), fxLoss: zeros(N) };
    m.loans.forEach((l) => {
      for (let t = 1; t <= N; t++) {
        const k = l.fxRate * idx(l, t);
        L.intPaid[t] += l.interestPaid[t] * k; L.cap[t] += l.capitalised[t] * k; L.prin[t] += l.principal[t] * k;
        L.draw[t] += l.draw[t] * k; L.fee[t] += l.fee[t] * k;
        if (t >= 2) L.fxLoss[t] += l.closing[t - 1] * l.fxRate * (idx(l, t) - idx(l, t - 1));
      }
    });
    const taxRate = num(input.tax && input.tax.rate_pct) / 100, holiday = Math.max(0, Math.round(num(input.tax && input.tax.holiday_years)));
    const r = { revenue: rev, ebitda: zeros(N), tax: zeros(N), dWC: zeros(N), cfads: zeros(N), debtService: zeros(N), dscr: zeros(N).map(() => null),
      fcf: zeros(N), cashAfterDebt: zeros(N), cash: zeros(N) };
    r.cash[0] = o.cash[0];
    let pool = 0, prevWC = o.ar[0] + o.inventory[0] - o.ap[0];
    for (let t = 1; t <= N; t++) {
      r.ebitda[t] = rev[t] - varC[t] - fixC[t];
      const pbt = r.ebitda[t] - o.dep[t] - L.intPaid[t] - L.cap[t] - L.fee[t] - L.fxLoss[t];
      const k = t - m.opsStart + 1;
      if (k >= 1 && k <= holiday) r.tax[t] = 0;
      else if (pbt < 0) { pool += -pbt; r.tax[t] = 0; }
      else { const u = Math.min(pool, pbt); pool -= u; r.tax[t] = (pbt - u) * taxRate; }
      const wcT = rev[t] * num(wc.receivable_days) / 365 + varC[t] * num(wc.inventory_days) / 365 - (varC[t] + fixC[t]) * num(wc.payable_days) / 365;
      r.dWC[t] = wcT - prevWC; prevWC = wcT;
      r.cfads[t] = r.ebitda[t] - r.tax[t] - r.dWC[t];
      r.debtService[t] = L.intPaid[t] + L.prin[t];
      r.dscr[t] = k - s >= 1 && r.debtService[t] > 1e-9 ? r.cfads[t] / r.debtService[t] : null;
      r.fcf[t] = r.cfads[t] - o.capex[t];
      r.cashAfterDebt[t] = r.cfads[t] - r.debtService[t];
      r.cash[t] = r.cash[t - 1] + r.fcf[t] + o.equityIn[t] + o.grantIn[t] + L.draw[t] - L.intPaid[t] - L.fee[t] - L.prin[t];
    }
    const ys = (a) => a.slice(1);
    const ds = ys(r.dscr).filter((x) => x !== null);
    r.kpis = {
      npv: npv(num(input.discount_rate_pct, 12) / 100, ys(r.fcf)), projectIRR: irr(ys(r.fcf)),
      dscrMin: ds.length ? Math.min(...ds) : null, lowestCash: Math.min(...ys(r.cash)), totalCashAfterDebt: sum(ys(r.cashAfterDebt)),
    };
    return r;
  }

  const WHAT_IFS = [
    { id: 'price_10', label: 'Price 10% lower', simple: 'Prices 10% lower', adj: { price: 0.9 } },
    { id: 'price_20', label: 'Price 20% lower', simple: 'Prices 20% lower', adj: { price: 0.8 } },
    { id: 'volume_20', label: 'Volume 20% lower', simple: 'Selling 20% less', adj: { volume: 0.8 } },
    { id: 'opex_15', label: 'Operating costs 15% higher', simple: 'Running costs 15% higher', adj: { opex: 1.15 } },
    { id: 'delay_1', label: 'One-year delay', simple: 'Starting a year late', adj: { delay_years: 1 } },
  ];

  function sensitivities(input, baseModel) {
    const m = baseModel || run(input);
    const hasForeign = m.loans.some((l) => l.foreign);
    const fxStress = num(input.defaults && input.defaults.fx_stress_depreciation_pct_year, 10);
    const list = WHAT_IFS.slice();
    if (hasForeign) list.push({ id: 'fx', label: 'Local currency weakens ' + fxStress + '% a year', simple: 'Local currency loses ' + fxStress + '% a year against the loan currency', adj: { fx_depreciation_pct: fxStress } });
    const b = scenario(input, m, {}).kpis;
    const target = num(input.defaults && input.defaults.dscr_target, 1.3);
    const results = list.map((c) => {
      const sc = scenario(input, m, c.adj);
      const k = sc.kpis;
      return { id: c.id, label: c.label, simple: c.simple, adj: c.adj, result: k, rows: sc,
        delta: { npv: k.npv - b.npv, dscrMin: k.dscrMin !== null && b.dscrMin !== null ? k.dscrMin - b.dscrMin : null, totalCashAfterDebt: k.totalCashAfterDebt - b.totalCashAfterDebt },
        breachesDscr: k.dscrMin !== null && k.dscrMin < target };
    });
    // Rank by the size of the NPV change, rounded to 2 decimals; ties keep the listed order (matches RANK + COUNTIF in Excel).
    const size = (r) => Math.round(Math.abs(r.delta.npv) * 100) / 100;
    const ranked = results.map((r, i) => ({ r, i })).sort((a, b) => (size(b.r) - size(a.r)) || (a.i - b.i)).map((x) => x.r.id);
    return { base: b, results, ranked };
  }

  /* ------------------------------------------------------------------ readiness */

  function readiness(input, model, sectorsJson) {
    const docsCfg = (sectorsJson && sectorsJson.readiness_documents) || {};
    const types = new Set(['all']);
    (input.financing && input.financing.loans || []).forEach((l) => types.add(l.provider_type || 'commercial_bank'));
    (input.financing && input.financing.equity || []).forEach((e) => { if (e.provider_type) types.add(e.provider_type); });
    (input.financing && input.financing.grants || []).forEach((g) => types.add(g.provider_type || 'grant_funder'));
    const required = [];
    types.forEach((t) => (docsCfg[t] || []).forEach((d) => { if (!required.includes(d)) required.push(d); }));
    const provided = input.documents || {};
    const have = required.filter((d) => provided[d]);
    const items = [];
    const add = (label, points, max, ok) => items.push({ label, points, max, ok });
    add('Documents in place (' + have.length + ' of ' + required.length + ')', required.length ? Math.round(50 * have.length / required.length) : 50, 50, have.length === required.length);
    const k = model.kpis;
    const target = num(input.defaults && input.defaults.dscr_target, 1.3);
    if (model.loans.length) {
      add('Lowest DSCR at or above ' + target, k.dscrMin !== null && k.dscrMin >= target ? 20 : k.dscrMin !== null && k.dscrMin >= 1 ? 10 : 0, 20, k.dscrMin !== null && k.dscrMin >= target);
      add('LLCR at or above ' + target, k.llcr !== null && k.llcr >= target ? 5 : 0, 5, k.llcr !== null && k.llcr >= target);
    } else {
      add('Cash never runs out', k.lowestCash >= 0 ? 25 : 0, 25, k.lowestCash >= 0);
    }
    const fundingTotal = model.funded || 1;
    const ownShare = sum(model.out.equityIn.slice(1)) / fundingTotal;
    add('Owners put in at least 20% of funding', ownShare >= 0.2 ? 10 : ownShare >= 0.1 ? 5 : 0, 10, ownShare >= 0.2);
    add('Positive NPV', k.npv > 0 ? 10 : 0, 10, k.npv > 0);
    const limit = model.loans.length ? Math.max(...model.loans.map((s) => s.last)) : 10;
    add('Pays back within ' + limit + ' years', k.paybackYears !== null && k.paybackYears <= limit ? 5 : 0, 5, k.paybackYears !== null && k.paybackYears <= limit);
    const score = sum(items.map((i) => i.points));
    return { score, items, required, missing: required.filter((d) => !provided[d]) };
  }

  const api = { compile, evaluate, pmt, npv, irr, loanSchedule, run, scenario, sensitivities, readiness, round, WHAT_IFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorEngine = api;
})(typeof self !== 'undefined' ? self : this);
