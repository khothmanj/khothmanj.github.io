/*
 * Tenor engine tests. Shared by tests/engine.test.html (browser) and tests/run-node.js (Node).
 * runTenorTests(Engine, Adapter, data) returns [{ name, pass, detail }].
 */
(function (root) {
  'use strict';

  function runTenorTests(E, A, data) {
    const results = [];
    const t = (name, fn) => {
      try { const detail = fn(); results.push({ name, pass: true, detail: detail || '' }); }
      catch (e) { results.push({ name, pass: false, detail: e.message }); }
    };
    const near = (a, b, tol, msg) => { if (!(Math.abs(a - b) <= tol)) throw new Error((msg || 'Expected') + ' ' + b + ' but got ' + a); };
    const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
    const S = (arr) => arr.slice(1).reduce((s, x) => s + x, 0);
    const ones = (n) => new Array(n + 1).fill(1);

    /* A synthetic project that exercises most features at once. */
    const synthetic = (over = {}) => Object.assign({
      name: 'Test farm', sector: 'crops', currency: 'NGN',
      timeline: { construction_years: 1, start_year: 2027 },
      revenue: { mode: 'formula', formula: 'hectares * harvests_per_year * yield_per_ha * (1 - losses_pct / 100) * price_per_tonne',
        inputs: { hectares: 1000, harvests_per_year: 2, yield_per_ha: 4, losses_pct: 10, price_per_tonne: 300 }, ramp_up: [0.6, 0.85, 1], export_pct: 20, price_growth_pct: 5 },
      capex: [{ label: 'Irrigation', amount: 1800000, life_years: 20, class: 'irrigation' }, { label: 'Tractors', amount: 600000, life_years: 7, class: 'equipment', year: 1 }],
      opex: [{ label: 'Inputs', kind: 'variable', formula: 'hectares * harvests_per_year * 450' }, { label: 'Overheads', kind: 'fixed', amount: 180000 },
        { label: 'Maintenance', kind: 'pct_capex', pct: 2 }, { label: 'Marketing', kind: 'pct_revenue', pct: 3 }],
      working_capital: { receivable_days: 45, inventory_days: 30, payable_days: 30 },
      tax: { rate_pct: 30, holiday_years: 2 }, inflation_pct: 8, discount_rate_pct: 12,
      financing: {
        equity: [{ label: 'Owner', amount: 800000, year: 1 }],
        grants: [{ label: 'Grant', amount: 100000, year: 1 }],
        loans: [
          { label: 'Bank A', amount: 1000000, currency: 'NGN', draws: [{ year: 1, pct: 60 }, { year: 2, pct: 40 }], tenor_years: 8, grace_years: 2, rate_pct: 12, repayment: 'annuity', upfront_fee_pct: 1 },
          { label: 'Exim B (USD)', amount: 1000, currency: 'USD', fx_rate: 600, tenor_years: 10, grace_years: 3, grace_type: 'capitalised', rate_pct: 5, repayment: 'equal_principal' },
        ],
      },
      defaults: { dscr_target: 1.3, fx_stress_depreciation_pct_year: 10 },
    }, over);

    /* ---------------- formula reader ---------------- */
    t('Formula reader calculates the rice example correctly', () => {
      const v = E.evaluate('hectares * harvests_per_year * yield_per_ha * (1 - losses_pct / 100) * price_per_tonne', { hectares: 1000, harvests_per_year: 2, yield_per_ha: 4, losses_pct: 10, price_per_tonne: 300 });
      near(v, 2160000, 1e-6, 'Expected sales of');
      return 'Mockup figure $2,160,000 reproduced';
    });
    t('Formula reader refuses anything that is not arithmetic', () => {
      let threw = false; try { E.evaluate('alert(1)', {}); } catch (e) { threw = true; }
      ok(threw, 'Formula with a function call should be rejected');
      threw = false; try { E.evaluate('a; b', { a: 1, b: 2 }); } catch (e) { threw = true; }
      ok(threw, 'Formula with a semicolon should be rejected');
    });

    /* ---------------- financial functions ---------------- */
    t('IRR of a known cash flow matches the expected value', () => {
      near(E.irr([-100, 110]), 0.10, 1e-9, 'IRR');
      near(E.irr([-1000, 500, 500, 500]), 0.2337519285, 1e-8, 'IRR');
      near(E.irr([-100, 30, 35, 40, 45]), 0.1709368634, 1e-8, 'IRR');
      ok(E.irr([100, 200]) === null, 'IRR with no outflow should be empty');
      return '10.00%, 23.38% and 17.09% as expected';
    });
    t('PMT and NPV follow Excel conventions', () => {
      near(-E.pmt(0.08, 8, 1600000), 278423.6169469, 1e-4, 'PMT');
      near(E.npv(0.1, [110]), 100, 1e-9, 'NPV');
    });

    /* ---------------- loans ---------------- */
    const loanCases = [
      { repayment: 'annuity', grace_years: 2 }, { repayment: 'equal_principal', grace_years: 2 }, { repayment: 'bullet', grace_years: 0 },
      { repayment: 'annuity', grace_years: 3, grace_type: 'capitalised' }, { repayment: 'annuity', grace_years: 0, balloon_pct: 20 },
      { repayment: 'equal_principal', grace_years: 1, draws: [{ year: 1, pct: 50 }, { year: 2, pct: 30 }, { year: 3, pct: 20 }] },
    ];
    t('Loan principal repaid equals the amount borrowed', () => {
      loanCases.forEach((lc) => {
        const s = E.loanSchedule(Object.assign({ amount: 1600000, tenor_years: 10, rate_pct: 8 }, lc), 12, ones(12));
        const due = 1600000 + S(s.capitalised);
        near(S(s.principal), due, 1e-6, lc.repayment + ' (grace ' + lc.grace_years + (lc.grace_type ? ', ' + lc.grace_type : '') + '): principal repaid');
        near(s.closing[12], 0, 1e-6, lc.repayment + ': closing balance');
      });
      return loanCases.length + ' loan structures checked';
    });
    t('Annuity payments are equal after the grace period', () => {
      const s = E.loanSchedule({ amount: 1600000, tenor_years: 10, grace_years: 2, rate_pct: 8, repayment: 'annuity' }, 12, ones(12));
      const pays = []; for (let y = s.firstRepay; y <= s.last; y++) pays.push(s.interestPaid[y] + s.principal[y]);
      pays.forEach((p) => near(p, pays[0], 1e-6, 'Annuity payment'));
      near(pays[0], 278423.6169469, 1e-4, 'Annuity payment matches PMT(8%, 8, 1,600,000)');
      for (let y = 1; y < s.firstRepay; y++) { near(s.principal[y], 0, 1e-9, 'No principal during grace'); near(s.interestPaid[y], 128000, 1e-6, 'Interest-only payment'); }
      return 'Payment ' + Math.round(pays[0]).toLocaleString('en-GB') + ' a year for ' + pays.length + ' years';
    });
    t('Equal principal repays the same amount each year', () => {
      const s = E.loanSchedule({ amount: 1600000, tenor_years: 10, grace_years: 2, rate_pct: 8, repayment: 'equal_principal' }, 12, ones(12));
      for (let y = s.firstRepay; y <= s.last; y++) near(s.principal[y], 200000, 1e-6, 'Principal');
      return 'Matches the mockup: 200,000 a year in years 3 to 10';
    });
    t('Capitalised grace interest is added to the loan, not paid', () => {
      const s = E.loanSchedule({ amount: 1000, tenor_years: 6, grace_years: 2, grace_type: 'capitalised', rate_pct: 10, repayment: 'equal_principal' }, 8, ones(8));
      near(s.interestPaid[1] + s.interestPaid[2], 0, 1e-9, 'Interest paid during grace');
      near(s.closing[2], 1210, 1e-9, 'Balance after two capitalised years');
    });

    /* ---------------- whole model ---------------- */
    t('The balance sheet balances every year (synthetic project with tranches, FX loan, grant, tax holiday)', () => {
      const m = E.run(synthetic());
      m.out.bsDiff.slice(1).forEach((d, i) => near(d, 0, 1e-4, 'Balance sheet difference in year ' + (i + 1)));
      ok(m.checks.balanceSheetBalances && m.checks.debtFullyRepaid && m.checks.sourcesEqualUses, 'Checks should all be true');
      return m.N + ' years balanced';
    });
    t('The balance sheet still balances under every what-if', () => {
      const inp = synthetic();
      [{ price: 0.8 }, { volume: 0.8 }, { opex: 1.15 }, { delay_years: 1 }, { fx_depreciation_pct: 10 }].forEach((adj) => {
        const m = E.run(inp, adj);
        ok(m.checks.balanceSheetBalances, 'Unbalanced under ' + JSON.stringify(adj));
        ok(m.checks.debtFullyRepaid, 'Debt not repaid under ' + JSON.stringify(adj));
      });
    });
    t('A neutral what-if reproduces the base model exactly', () => {
      const inp = synthetic(); const m = E.run(inp); const sc = E.scenario(inp, m, {});
      for (let y = 1; y <= m.N; y++) {
        near(sc.ebitda[y], m.out.ebitda[y], 1e-6, 'EBITDA year ' + y); near(sc.tax[y], m.out.taxCharge[y], 1e-6, 'Tax year ' + y);
        near(sc.cfads[y], m.out.cfads[y], 1e-6, 'CFADS year ' + y); near(sc.cash[y], m.out.cash[y], 1e-6, 'Cash year ' + y);
      }
      near(sc.kpis.npv, m.kpis.npv, 1e-6, 'NPV');
    });
    t('What-ifs move results in the expected direction', () => {
      const inp = synthetic(); const sn = E.sensitivities(inp);
      const by = (id) => sn.results.find((r) => r.id === id);
      ok(by('price_20').result.npv < by('price_10').result.npv && by('price_10').result.npv < sn.base.npv, 'Lower prices should lower NPV');
      ok(by('opex_15').result.npv < sn.base.npv, 'Higher costs should lower NPV');
      ok(by('fx') && by('fx').result.lowestCash <= sn.base.lowestCash, 'A weaker currency should not raise cash');
      ok(sn.ranked.length === sn.results.length, 'Ranking covers every what-if');
    });
    t('Zero financing produces zero interest', () => {
      const m = E.run(synthetic({ financing: { equity: [{ label: 'Owner', amount: 3000000, year: 1 }] } }));
      near(S(m.out.interest), 0, 1e-12, 'Interest'); near(S(m.out.debtService), 0, 1e-12, 'Debt service');
      ok(m.kpis.dscrMin === null, 'DSCR should be empty with no loan');
      ok(m.checks.balanceSheetBalances, 'Balance sheet');
    });
    t('Ramp-up and a construction year delay sales', () => {
      const m = E.run(synthetic());
      near(m.out.revenue[1], 0, 1e-9, 'No sales during construction');
      near(m.out.revenue[2], 2160000 * 0.6 * Math.pow(1.05, 1), 1e-6, 'Year 2 sales at 60% ramp-up');
    });
    t('Depreciation never exceeds what was spent', () => {
      const m = E.run(synthetic());
      ok(S(m.out.dep) <= S(m.out.capex) + 1e-6, 'Depreciation exceeds capex');
      ok(m.out.nfa.slice(1).every((v) => v >= -1e-6), 'Fixed assets went negative');
    });
    t('Tax holiday and losses carried forward reduce tax', () => {
      const a = E.run(synthetic()), b = E.run(synthetic({ tax: { rate_pct: 30, holiday_years: 0 } }));
      ok(S(a.out.taxCharge) <= S(b.out.taxCharge) + 1e-6, 'Holiday should not increase tax');
      ok(a.out.taxCharge.slice(1).every((x) => x >= 0), 'Tax should never be negative');
    });
    t('A weaker local currency raises the cost of a foreign loan', () => {
      const inp = synthetic();
      const base = E.run(inp), fx = E.run(inp, { fx_depreciation_pct: 10 });
      ok(S(fx.out.debtService) > S(base.out.debtService), 'Debt service should rise');
      ok(S(fx.out.fxLoss) > 0, 'An FX loss should be booked');
    });
    t('Equity rounds dilute existing owners correctly', () => {
      const m = E.run(synthetic({ sector: 'tech', financing: { equity: [{ label: 'Seed', amount: 1000000, pre_money: 4000000, year: 1 }, { label: 'Series A', amount: 5000000, pre_money: 20000000, year: 2 }] } }));
      near(m.ownership[0].pct, 100 * 0.8 * 0.8, 1e-9, 'Founders');
      near(m.ownership[1].pct, 20 * 0.8, 1e-9, 'Seed investors'); near(m.ownership[2].pct, 20, 1e-9, 'Series A');
    });
    t('Subscription and fintech revenue models produce growing, finite results', () => {
      const sub = E.run(synthetic({ timeline: { construction_years: 0 }, revenue: { mode: 'subscription', inputs: { starting_customers: 100, new_customers_month: 50, churn_pct_month: 3, price_per_month: 10, growth_pct_year: 20 }, ramp_up: [1] }, opex: [{ label: 'CAC', kind: 'per_new_customer', amount: 30 }] }));
      ok(sub.out.revenue[3] > sub.out.revenue[1], 'Subscription revenue should grow'); ok(sub.checks.allFinite, 'Finite');
      const ft = E.run(synthetic({ timeline: { construction_years: 0 }, revenue: { mode: 'fintech', inputs: { active_customers: 1000, customer_growth_pct: 30, volume_per_customer: 500, take_rate_pct: 2 }, ramp_up: [1] }, opex: [{ label: 'Losses', kind: 'pct_volume', pct: 1 }] }));
      near(ft.out.revenue[1], 1000 * 500 * 0.02, 1e-6, 'Fintech year 1 revenue');
      near(ft.out.lossCost[1], 1000 * 500 * 0.01, 1e-6, 'Fintech year 1 losses');
    });
    t('Quarterly view adds back up to the annual figures', () => {
      const m = E.run(synthetic());
      [1, 2, 3].forEach((y) => near(m.quarterly.filter((q) => q.year === y).reduce((s, q) => s + q.revenue, 0), m.out.revenue[y], 1e-6, 'Year ' + y + ' revenue'));
      near(m.quarterly[11].closingCash, m.out.cash[3], 1e-6, 'Closing cash at the end of year 3');
    });

    /* ---------------- case library ---------------- */
    if (data && data.cases && A) {
      const caseResults = [];
      t('Every case in the library produces a valid model', () => {
        const bad = [];
        data.cases.cases.forEach((c) => {
          try {
            const inp = A.caseToInput(c, data.sectors, data.defaults);
            const m = E.run(inp);
            const sens = E.sensitivities(inp);
            const rd = E.readiness(inp, m, data.sectors);
            const problems = [];
            if (!m.checks.allFinite) problems.push('non-finite values');
            if (!m.checks.balanceSheetBalances) problems.push('balance sheet does not balance');
            if (!m.checks.debtFullyRepaid) problems.push('debt not fully repaid');
            if (!(m.kpis.totalRevenue > 0)) problems.push('no revenue');
            if (!sens.results.every((r) => isFinite(r.result.npv))) problems.push('a what-if failed');
            if (!(rd.score >= 0 && rd.score <= 100)) problems.push('readiness out of range');
            caseResults.push({ id: c.id, name: c.name, model: m, readiness: rd, sens, ok: !problems.length, problems });
            if (problems.length) bad.push(c.id + ': ' + problems.join(', '));
          } catch (e) { bad.push(c.id + ': ' + e.message); caseResults.push({ id: c.id, name: c.name, ok: false, problems: [e.message] }); }
        });
        if (bad.length) throw new Error(bad.join(' | '));
        return data.cases.cases.length + ' cases modelled, balanced and repaid';
      });
      results.caseResults = caseResults;
    }
    return results;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { runTenorTests };
  else root.runTenorTests = runTenorTests;
})(typeof self !== 'undefined' ? self : this);
