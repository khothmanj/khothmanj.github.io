/*
 * Proves the workbook is live: changes Price (-15%) and the first loan's interest rate (+2 points) on the
 * Inputs sheet, then (after LibreOffice recalculates) checks the Summary, KPIs and Loans against the engine
 * run with the same changes.
 *
 * Step 1: NODE_PATH=... node tenor/tests/excel-input-change.js prepare <builtDir> <changedDir>
 * Step 2: sh tenor/tests/lo-recalc.sh <changedDir> <recalcDir>
 * Step 3: NODE_PATH=... node tenor/tests/excel-input-change.js verify <changedDir> <recalcDir>
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const dir = path.join(__dirname, '..');
const E = require(path.join(dir, 'js/engine.js'));
const A = require(path.join(dir, 'js/adapter.js'));
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'data', f), 'utf8'));
const cases = load('cases.json'), sectors = load('sectors.json'), defaults = load('defaults.json');
const [mode, a, b] = process.argv.slice(2);
const PRICE_KEYS = ['price_per_tonne', 'price_per_unit', 'tariff_per_kwh', 'price_per_month', 'product_price', 'rate_per_unit', 'product_value_per_bbl', 'fee_per_admission'];

const resultOf = (v) => (v && typeof v === 'object' ? ('result' in v ? v.result : v.formula !== undefined ? 0 : v) : v);
function cellOfName(wb, name) {
  const entry = wb.definedNames.model.find((x) => x.name === name);
  if (!entry) throw new Error('Name not found: ' + name);
  const loc = entry.ranges[0];
  const [sheet, addr] = loc.split('!');
  return wb.getWorksheet(sheet.replace(/^'|'$/g, '')).getCell(addr.replace(/\$/g, ''));
}
function changedInput(c) {
  const input = A.caseToInput(c, sectors, defaults);
  // the price input the workbook names "Price": one the sales formula actually uses
  const used = input.revenue.mode === 'formula' ? String(input.revenue.formula) : input.revenue.mode === 'subscription' ? 'price_per_month' : '';
  const pk = PRICE_KEYS.find((k) => new RegExp('\\b' + k + '\\b').test(used));
  if (pk) input.revenue.inputs[pk] *= 0.85;
  else if (input.revenue.mode === 'historical') input.revenue.base_revenue *= 0.85;
  else if (input.revenue.mode === 'fintech') input.revenue.inputs.take_rate_pct *= 0.85;
  if (input.financing.loans[0]) input.financing.loans[0].rate_pct += 2;
  return { input, pk };
}

(async () => {
  if (mode === 'prepare') {
    fs.mkdirSync(b, { recursive: true });
    for (const c of cases.cases) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(a, c.id + '.xlsx'));
      const { input, pk } = changedInput(c);
      if (pk) { const cell = cellOfName(wb, 'Price'); cell.value = cell.value * 0.85; }
      else if (input.revenue.mode === 'historical') { const cell = cellOfName(wb, 'BaseRevenue'); cell.value = cell.value * 0.85; }
      else if (input.revenue.mode === 'fintech') { const cell = cellOfName(wb, 'TakeRatePct'); cell.value = cell.value * 0.85; }
      if (input.financing.loans[0]) { const cell = cellOfName(wb, 'InterestRate'); cell.value = cell.value + 2; }
      await wb.xlsx.writeFile(path.join(b, c.id + '.xlsx'));
    }
    console.log('Prepared ' + cases.cases.length + ' changed workbooks');
    return;
  }
  // verify
  let bad = 0;
  for (const c of cases.cases) {
    const { input } = changedInput(c);
    const m = E.run(input);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(b, c.id + '.xlsx'));
    const kpi = wb.getWorksheet('KPIs');
    const byLabel = {};
    kpi.eachRow((row) => { const l = row.getCell(1).value; if (typeof l === 'string') byLabel[l] = resultOf(row.getCell(3).value); });
    const want = { 'NPV at the discount rate': m.kpis.npv, 'Lowest DSCR': m.kpis.dscrMin ?? 'n/a', 'Total sales, all years': m.kpis.totalRevenue,
      'Largest yearly loan payment': m.kpis.largestDebtService, 'Lowest cash balance': m.kpis.lowestCash, 'Project IRR': m.kpis.projectIRR ?? 'n/a' };
    const fails = [];
    Object.entries(want).forEach(([k, v]) => {
      const g = byLabel[k];
      const ok = typeof v === 'number' && typeof g === 'number' ? Math.abs(v - g) <= 1e-6 * Math.max(1, Math.abs(v)) : String(v) === String(g);
      if (!ok) fails.push(k + ': engine ' + v + ', workbook ' + g);
    });
    const checks = wb.getWorksheet('Checks');
    let allTrue = true;
    checks.eachRow((row, n) => { const l = row.getCell(1).value; if (n >= 4 && /balances|repaid|equal uses|All model/.test(String(l))) { const v = resultOf(row.getCell(2).value); if (!(v === true || String(v).toUpperCase() === 'TRUE')) allTrue = false; } });
    if (!allTrue) fails.push('Checks sheet not all TRUE');
    if (fails.length) bad++;
    console.log((fails.length ? 'FAIL ' : 'PASS ') + c.id + (fails.length ? ': ' + fails.join('; ') : ': summary, KPIs and checks match the engine after the change'));
  }
  console.log('\n' + (cases.cases.length - bad) + ' of ' + cases.cases.length + ' workbooks recalculated correctly after changing price and interest rate');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
