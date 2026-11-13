/*
 * Tenor CSV export (JSZip 3.10.2): one CSV per main table, values only, in a .zip.
 * buildCsvZip(JSZip, ctx) -> JSZip instance.
 */
(function (root) {
  'use strict';

  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = (rows) => '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
  const r2 = (x) => (typeof x === 'number' && isFinite(x) ? Math.round(x * 100) / 100 : x);

  function buildCsvZip(JSZip, ctx) {
    const { input, model: m } = ctx;
    const cur = input.currency || '';
    const o = m.out, N = m.N, Y = m.years;
    const zip = new JSZip();
    const yearly = (rows) => [['Line', 'Unit'].concat(Y.map(String))].concat(rows.map(([label, arr, unit]) => [label, unit || cur].concat(Array.from({ length: N }, (_, i) => r2(arr[i + 1])))));
    const drivers = (ctx.caseRecord && ctx.caseRecord.drivers) || {};

    const inputs = [['Key', 'Value', 'Quality', 'Note']];
    Object.entries(input.revenue.inputs || {}).forEach(([k, v]) => { const d = drivers[k]; inputs.push([k, v, d ? d.quality : 'assumed', d && d.note ? d.note : '']); });
    [['currency', cur], ['construction_years', input.timeline.construction_years], ['inflation_pct', input.inflation_pct], ['tax_rate_pct', input.tax.rate_pct], ['discount_rate_pct', input.discount_rate_pct],
      ['receivable_days', input.working_capital.receivable_days], ['inventory_days', input.working_capital.inventory_days], ['payable_days', input.working_capital.payable_days]].forEach(([k, v]) => inputs.push([k, v, 'assumed', '']));
    zip.file('inputs.csv', csv(inputs));
    zip.file('revenue.csv', csv(yearly([['Total sales', o.revenue], ['Export sales', o.exportRev], ['Domestic sales', o.domesticRev]])));
    zip.file('opex.csv', csv(yearly(m.costLines.map((l) => [l.label, l.values])).concat([['Variable costs', cur].concat(o.varCost.slice(1).map(r2)), ['Fixed costs', cur].concat(o.fixCost.slice(1).map(r2))])));
    const capexRows = [];
    m.capexLines.forEach((l) => { capexRows.push([l.label + ': spend', l.spend]); capexRows.push([l.label + ': depreciation', l.dep]); });
    capexRows.push(['Total capex', o.capex], ['Total depreciation', o.dep], ['Fixed assets (net)', o.nfa]);
    zip.file('capex.csv', csv(yearly(capexRows)));
    const loan = [['Loan', 'Year', 'Currency', 'Opening balance', 'Drawdown', 'Interest', 'Interest added to loan', 'Interest paid', 'Principal repaid', 'Closing balance', 'Fee', 'Closing balance (' + cur + ')']];
    m.loans.forEach((l) => { for (let t = 1; t <= N; t++) loan.push([l.label, Y[t - 1], (input.financing.loans.find((x) => x.label === l.label) || {}).currency || cur, r2(l.opening[t]), r2(l.draw[t]), r2(l.interest[t]), r2(l.capitalised[t]), r2(l.interestPaid[t]), r2(l.principal[t]), r2(l.closing[t]), r2(l.fee[t]), r2(l.local.closing[t])]); });
    zip.file('loan_schedule.csv', csv(loan));
    zip.file('pnl.csv', csv(yearly([['Sales', o.revenue], ['Variable costs', o.varCost], ['Gross profit', o.grossProfit], ['Fixed costs', o.fixCost], ['EBITDA', o.ebitda], ['Depreciation', o.dep], ['Operating profit', o.ebit],
      ['Interest', o.interest], ['Loan fees', o.fees], ['Exchange losses', o.fxLoss], ['Profit before tax', o.pbt], ['Tax', o.taxCharge], ['Net profit', o.netIncome]])));
    zip.file('cash_flow.csv', csv(yearly([['EBITDA', o.ebitda], ['Tax paid', o.taxCharge.map((x) => -x)], ['Working capital', o.dWC.map((x) => -x)], ['Cash from operations', o.cfo], ['Capex', o.capex.map((x) => -x)],
      ['Equity paid in', o.equityIn], ['Grants', o.grantIn], ['Loan drawdowns', o.draw], ['Loan fees', o.fees.map((x) => -x)], ['Interest paid', o.intPaid.map((x) => -x)], ['Principal repaid', o.principal.map((x) => -x)],
      ['Net cash flow', o.netCash], ['Cash at year end', o.cash]])));
    zip.file('balance_sheet.csv', csv(yearly([['Cash', o.cash], ['Money owed by customers', o.ar], ['Stock', o.inventory], ['Fixed assets', o.nfa], ['Total assets', o.assets], ['Money owed to suppliers', o.ap], ['Loans', o.debt], ['Total liabilities', o.liabilities], ['Equity', o.equity]])));
    zip.file('quarterly.csv', csv([['Quarter', 'Sales (' + cur + ')', 'Running costs (' + cur + ')', 'EBITDA (' + cur + ')', 'Debt service (' + cur + ')', 'Net cash flow (' + cur + ')', 'Closing cash (' + cur + ')']].concat(m.quarterly.map((q) => [q.label, r2(q.revenue), r2(q.costs), r2(q.ebitda), r2(q.debtService), r2(q.netCash), r2(q.closingCash)]))));
    const k = m.kpis;
    zip.file('kpis.csv', csv([['KPI', 'Value', 'Unit'], ['Gross margin', r2(k.grossMargin * 100), '%'], ['EBITDA margin', r2(k.ebitdaMargin * 100), '%'], ['Minimum DSCR', r2(k.dscrMin), 'x'], ['Average DSCR', r2(k.dscrAvg), 'x'], ['LLCR', r2(k.llcr), 'x'],
      ['Project IRR', k.projectIRR === null ? 'n/a' : r2(k.projectIRR * 100), '%'], ['Equity IRR', k.equityIRR === null ? 'n/a' : r2(k.equityIRR * 100), '%'], ['NPV', r2(k.npv), cur], ['Discount rate', r2(k.discountRate * 100), '%'],
      ['Payback', k.paybackYears === null ? 'n/a' : r2(k.paybackYears), 'years'], ['Break-even sales', r2(k.breakEvenRevenue), cur], ['Gearing', k.gearing === null ? 'n/a' : r2(k.gearing * 100), '%'],
      ['Cash runway', k.runwayMonths === null ? 'Does not run out' : r2(k.runwayMonths), 'months'], ['Lowest cash balance', r2(k.lowestCash), cur]].map((r) => r.map((v) => (v === null || (typeof v === 'number' && !isFinite(v)) ? 'n/a' : v)))));
    zip.file('README.txt', 'Tenor data export: values only.\r\n\r\nThese CSV files hold the numbers from the model, one file per table. They contain no formulas. For the live model where every number recalculates from the Inputs sheet, download the Excel model instead.\r\n\r\nIllustrative model for portfolio purposes. Not financial advice.\r\n');
    return zip;
  }

  const api = { buildCsvZip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorCsv = api;
})(typeof self !== 'undefined' ? self : this);
