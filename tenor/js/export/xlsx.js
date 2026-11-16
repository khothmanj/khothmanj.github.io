/*
 * Tenor Excel model builder (ExcelJS 4.4.0).
 * Builds a working, linked financial model: every input lives on the Inputs sheet and every other number is a
 * formula that traces back to it. The engine's results are written as each formula's cached value so the file
 * shows numbers immediately, and the workbook is set to recalculate fully when opened.
 *
 * Usage: TenorXlsx.buildModel(ExcelJS, { input, model, sens, ready, caseRecord, similar }) -> ExcelJS.Workbook
 *        TenorXlsx.buildTemplate(ExcelJS, { sector, sectors }) -> ExcelJS.Workbook
 *        TenorXlsx.parseTemplate(ExcelJS, arrayBuffer) -> Promise<{ fields, capex, opex, loans }>
 */
(function (root) {
  'use strict';

  const BLUE = 'FF0B3D91', GREEN = 'FF0A6B37', BLACK = 'FF111111', MUTED = 'FF5B6475';
  const HEAD_FILL = 'FF0B1220', HEAD_TEXT = 'FFFFFFFF', SECTION_FILL = 'FFEEF1FF', INPUT_FILL = 'FFFFFBEA';
  const FMT = {
    money: '#,##0;[Red]-#,##0', money2: '#,##0.00;[Red]-#,##0.00', num: '#,##0.##', int: '#,##0', pct: '0.0"%"',
    frac: '0.0%', ratio: '0.00"x"', year: '0', flag: '0', months: '0.0',
  };

  /* ---------------------------------------------------------------- helpers */
  function colName(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  const YC = (t) => colName(3 + t); // t=0 -> C (opening), t=1 -> D
  const q = (name) => "'" + name.replace(/'/g, "''") + "'";
  const camel = (k) => {
    let n = String(k).split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
    if (/^[0-9]/.test(n) || /^[A-Za-z]{1,3}[0-9]+$/.test(n) || /^(R|C|NPV|IRR|PMT|SUM|MIN|MAX|IF|INDEX|MATCH|TRUE|FALSE)$/i.test(n)) n = 'In' + n;
    return n;
  };
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  // IRR with fallback starting guesses, so negative or very high returns still solve in every spreadsheet app
  const irrF = (rng) => 'IFERROR(IRR(' + rng + '),IFERROR(IRR(' + rng + ',-0.2),IFERROR(IRR(' + rng + ',0.5),"n/a")))';
  const val = (x) => (x && typeof x === 'object' && !Array.isArray(x) && 'value' in x ? x.value : x);

  class Book {
    constructor(ExcelJS, N, currency) {
      this.wb = new ExcelJS.Workbook();
      this.wb.creator = 'Tenor';
      this.wb.created = new Date();
      this.wb.calcProperties = { fullCalcOnLoad: true };
      this.N = N; this.currency = currency;
      this.reg = {}; // key -> { sheet, row }
      this.names = {};
      this.cached = []; // for QA: { sheet, addr, value }
    }
    sheet(name, title, subtitle, opts = {}) {
      const ws = this.wb.addWorksheet(name, { properties: { tabColor: { argb: opts.tab || 'FF3550FC' }, outlineProperties: { summaryBelow: false } } });
      ws.getColumn(1).width = opts.labelWidth || 46;
      ws.getColumn(2).width = 14;
      if (opts.years !== false) for (let t = 0; t <= this.N; t++) ws.getColumn(3 + t).width = 14;
      ws.getCell('A1').value = title; ws.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: BLACK } };
      if (subtitle) { ws.getCell('A2').value = subtitle; ws.getCell('A2').font = { name: 'Arial', size: 9, italic: true, color: { argb: MUTED } }; }
      ws.nextRow = 4;
      if (opts.years !== false) {
        this.yearHeader(ws);
        ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 5 }];
      } else ws.views = [{ state: 'frozen', ySplit: 3 }];
      return ws;
    }
    yearHeader(ws) {
      const r = ws.nextRow;
      ws.getCell('A' + r).value = 'Year';
      ws.getCell('B' + r).value = 'Unit';
      ws.getCell('C' + r).value = 'Opening';
      for (let t = 1; t <= this.N; t++) this.f(ws, YC(t) + r, 'ModelStartYear+' + YC(t) + (r + 1) + '-1', null, FMT.year, 'calc');
      const r2 = r + 1;
      ws.getCell('A' + r2).value = 'Model year';
      for (let t = 0; t <= this.N; t++) this.f(ws, YC(t) + r2, 'COLUMN()-COLUMN($C$' + r2 + ')', t, FMT.int, 'calc');
      [r, r2].forEach((rr) => {
        const row = ws.getRow(rr);
        row.eachCell({ includeEmpty: true }, (c, n) => { if (n <= 3 + this.N) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }; c.font = Object.assign({}, c.font || {}, { bold: true, color: { argb: HEAD_TEXT }, name: 'Arial', size: 9 }); } });
        for (let c = 1; c <= 3 + this.N; c++) { const cell = ws.getCell(rr, c); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }; cell.font = { bold: true, color: { argb: HEAD_TEXT }, name: 'Arial', size: 9 }; }
      });
      ws.tRow = r2; // row holding model year t
      ws.nextRow = r + 3;
    }
    /* write a formula cell; kind: 'calc' (black) or 'link' (green) */
    f(ws, addr, formula, result, fmt, kind) {
      const c = ws.getCell(addr);
      c.value = result === undefined || result === null ? { formula } : { formula, result };
      if (fmt) c.numFmt = fmt;
      c.font = { name: 'Arial', size: 10, color: { argb: kind === 'link' ? GREEN : BLACK } };
      if (result !== undefined && result !== null) this.cached.push({ sheet: ws.name, addr, value: result });
      return c;
    }
    input(ws, addr, value, fmt) {
      const c = ws.getCell(addr);
      c.value = value;
      if (fmt) c.numFmt = fmt;
      c.font = { name: 'Arial', size: 10, color: { argb: BLUE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
      return c;
    }
    section(ws, text) {
      const r = ws.nextRow++;
      const c = ws.getCell('A' + r); c.value = text; c.font = { name: 'Arial', size: 12, bold: true };
      const last = ws.name === 'Inputs' ? 8 : 3 + this.N;
      for (let i = 1; i <= last; i++) ws.getCell(r, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_FILL } };
      return r;
    }
    blank(ws, n = 1) { ws.nextRow += n; }
    /* refer to a registered row in year t (or column C when t === 'C') from sheet `from` */
    ref(key, t, from) {
      const r = this.reg[key];
      if (!r) throw new Error('Unknown row ' + key);
      const addr = (t === 'C' ? '$C$' : YC(t)) + r.row;
      return (from && from === r.sheet ? '' : q(r.sheet) + '!') + addr;
    }
    tref(ws, t) { return YC(t) + '$' + ws.tRow; }
    range(key, from, withOpening) {
      const r = this.reg[key];
      const a = (withOpening ? '$C$' : '$D$') + r.row + ':$' + YC(this.N) + '$' + r.row;
      return (from && from === r.sheet ? '' : q(r.sheet) + '!') + a;
    }
    /*
     * A row of yearly formulas. fn(t) -> formula string; vals[t] -> cached value.
     * opts: { unit, fmt, opening: { formula, value } | { input: number }, level, bold, kind }
     */
    row(ws, key, label, fn, vals, opts = {}) {
      const r = ws.nextRow++;
      if (key) this.reg[key] = { sheet: ws.name, row: r }; // registered first so a row can refer to its own previous year
      ws.getCell('A' + r).value = label;
      ws.getCell('A' + r).font = { name: 'Arial', size: 10, bold: !!opts.bold };
      if (opts.unit) { ws.getCell('B' + r).value = opts.unit; ws.getCell('B' + r).font = { name: 'Arial', size: 9, color: { argb: MUTED } }; }
      if (opts.opening) {
        if ('input' in opts.opening) this.input(ws, 'C' + r, opts.opening.input, opts.fmt || FMT.money);
        else this.f(ws, 'C' + r, opts.opening.formula, opts.opening.value, opts.fmt || FMT.money, opts.opening.kind || 'calc');
      }
      for (let t = 1; t <= this.N; t++) {
        const fm = fn(t);
        if (fm === null || fm === undefined) continue;
        const v = vals ? vals[t] : undefined;
        this.f(ws, YC(t) + r, fm, v === undefined ? null : v, opts.fmt || FMT.money, opts.kind || (/^('[^']+'!|[A-Z][A-Za-z0-9]*$)/.test(fm) && !/[-+*/(]/.test(fm.replace(/^'[^']+'!/, '')) ? 'link' : 'calc'));
      }
      if (opts.bold) for (let c = 1; c <= 3 + this.N; c++) ws.getCell(r, c).border = { top: { style: 'thin', color: { argb: 'FF9AA79F' } } };
      if (opts.level) ws.getRow(r).outlineLevel = opts.level;
      if (key) this.reg[key] = { sheet: ws.name, row: r };
      return r;
    }
    /* a single calculated value in column C (label in A) */
    scalar(ws, key, label, formula, value, fmt, opts = {}) {
      const r = ws.nextRow++;
      if (key) this.reg[key] = { sheet: ws.name, row: r };
      ws.getCell('A' + r).value = label;
      ws.getCell('A' + r).font = { name: 'Arial', size: 10, bold: !!opts.bold };
      if (opts.unit) ws.getCell('B' + r).value = opts.unit;
      this.f(ws, 'C' + r, formula, value, fmt || FMT.money, opts.kind || 'calc');
      if (opts.level) ws.getRow(r).outlineLevel = opts.level;
      if (key) this.reg[key] = { sheet: ws.name, row: r };
      return r;
    }
    name(nm, ws, addr) {
      if (this.names[nm]) throw new Error('Duplicate name ' + nm);
      this.names[nm] = q(ws.name) + '!' + addr.replace(/([A-Z]+)(\d+)/, '$$$1$$$2');
      this.wb.definedNames.add(this.names[nm], nm);
    }
  }

  /* ---------------------------------------------------------------- the model */

  function buildModel(ExcelJS, ctx) {
    const { input, model: m, sens, ready, caseRecord } = ctx;
    const N = m.N, o = m.out;
    const B = new Book(ExcelJS, N, input.currency);
    const cur = input.currency || '';
    const rv = input.revenue || {};
    const mode = rv.mode || 'formula';
    const fin = input.financing || {};
    const loans = fin.loans || [];
    const equity = fin.equity || [];
    const grants = fin.grants || [];
    const caseDrivers = (caseRecord && caseRecord.drivers) || {};
    const qualityOf = (key) => {
      const d = caseDrivers[key];
      if (d && d.quality) return d.quality + (d.note ? ': ' + d.note : '');
      return 'assumed: Tenor default or your entry';
    };
    const ys = (a) => a; // arrays already indexed by t

    /* ---------- sheet order (created now so tabs appear in the planned order) ---------- */
    const order = ['Cover', 'Summary', 'Inputs', 'Revenue', 'CAPEX', 'OPEX', 'Working capital', 'Financing', 'Loans', 'Equity', 'P&L', 'Cash flow',
      'Balance sheet', 'Quarterly', 'KPIs', 'Sensitivity', 'Checks', 'Readiness', 'Sources'];
    const subtitle = 'Amounts in ' + cur + '. Blue cells are inputs (change them on the Inputs sheet), black cells are calculations, green cells link to another sheet.';
    const WS = {};
    WS.Cover = B.sheet('Cover', 'Tenor financial model', null, { years: false, labelWidth: 30 });
    WS.Summary = B.sheet('Summary', 'Summary', subtitle, { years: false, labelWidth: 44 });
    WS.Inputs = B.sheet('Inputs', 'Inputs and assumptions', 'Every number the model uses starts here. Blue cells can be changed. Quality: sourced = from a checked public source, derived = calculated from sourced figures, assumed = an estimate.', { years: false, labelWidth: 46 });
    ['Revenue', 'CAPEX', 'OPEX', 'Working capital'].forEach((n) => { WS[n] = B.sheet(n, { Revenue: 'Revenue build', CAPEX: 'CAPEX and depreciation', OPEX: 'Operating costs (OPEX)', 'Working capital': 'Working capital' }[n], subtitle); });
    WS.Financing = B.sheet('Financing', 'Financing: sources and uses of funds', subtitle);
    WS.Loans = B.sheet('Loans', 'Loan and lease repayment schedules', subtitle + ' Detail rows are grouped: use the + buttons to expand.');
    WS.Equity = B.sheet('Equity', 'Equity and investors', subtitle);
    WS['P&L'] = B.sheet('P&L', 'Profit and loss (annual)', subtitle);
    WS['Cash flow'] = B.sheet('Cash flow', 'Cash flow (annual)', subtitle);
    WS['Balance sheet'] = B.sheet('Balance sheet', 'Balance sheet', subtitle);
    WS.Quarterly = B.sheet('Quarterly', 'Quarterly projections, first 3 years', 'Each year is split evenly into four quarters. Seasonality is not modelled.', { years: false, labelWidth: 16 });
    WS.KPIs = B.sheet('KPIs', 'KPIs and ratios', subtitle);
    WS.Sensitivity = B.sheet('Sensitivity', 'Sensitivity analysis', 'Each what-if keeps the build, capex and loans the same and changes sales or running costs. Settings are on the Inputs sheet.');
    WS.Checks = B.sheet('Checks', 'Model checks', 'Every check should show TRUE.', { years: false, labelWidth: 52 });
    WS.Readiness = B.sheet('Readiness', 'Readiness checklist and next steps', 'Tick documents as provided on the Inputs sheet.', { years: false, labelWidth: 60 });
    WS.Sources = B.sheet('Sources', 'Similar projects and sources', null, { years: false, labelWidth: 40 });

    /* ================================================================ INPUTS */
    const I = WS.Inputs;
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((c, i) => { I.getColumn(i + 1).width = [46, 12, 16, 14, 12, 12, 12, 60][i]; });
    I.nextRow = 4;
    const hdr = (cols) => { const r = I.nextRow++; cols.forEach((t, i) => { const c = I.getCell(r, i + 1); c.value = t; c.font = { name: 'Arial', size: 9, bold: true, color: { argb: MUTED } }; }); };
    const inp = (name, label, value, unit, fmt, quality) => {
      const r = I.nextRow++;
      I.getCell('A' + r).value = label; I.getCell('A' + r).font = { name: 'Arial', size: 10 };
      if (unit) { I.getCell('B' + r).value = unit; I.getCell('B' + r).font = { name: 'Arial', size: 9, color: { argb: MUTED } }; }
      B.input(I, 'C' + r, value, fmt);
      if (quality) { I.getCell('H' + r).value = quality; I.getCell('H' + r).font = { name: 'Arial', size: 9, color: { argb: MUTED } }; I.getCell('H' + r).alignment = { wrapText: false }; }
      if (name) B.name(name, I, 'C' + r);
      return r;
    };
    const calcIn = (name, label, formula, value, fmt) => {
      const r = I.nextRow++;
      I.getCell('A' + r).value = label;
      B.f(I, 'C' + r, formula, value, fmt, 'calc');
      if (name) B.name(name, I, 'C' + r);
      return r;
    };

    B.section(I, 'Project');
    const textIn = (label, text) => { const r = I.nextRow++; I.getCell('A' + r).value = label; I.getCell('C' + r).value = text; I.getCell('C' + r).font = { name: 'Arial', size: 10, color: { argb: BLUE } }; return r; };
    textIn('Project name', input.name || 'My project');
    textIn('Sector', input.sector || '');
    textIn('Country', input.country || '');
    textIn('Model currency', cur);
    const modeRow = textIn('Sales model', mode);
    B.name('RevenueMode', I, 'C' + modeRow);
    B.blank(I);

    B.section(I, 'Timing');
    inp('ModelStartYear', 'First model year', input.timeline && input.timeline.start_year || 2027, 'year', FMT.year, 'assumed');
    inp('ConstructionYears', 'Build or set-up period', input.timeline && input.timeline.construction_years || 0, 'years', FMT.int, 'assumed unless stated in the case');
    calcIn('OpsStart', 'First operating model year', 'ConstructionYears+1', m.opsStart, FMT.int);
    const nRow = I.nextRow++; I.getCell('A' + nRow).value = 'Years in this workbook'; I.getCell('C' + nRow).value = N; I.getCell('H' + nRow).value = 'Fixed when the file was made. Download again from Tenor for a longer horizon.';
    B.blank(I);

    /* ---- sales inputs ---- */
    B.section(I, 'Sales');
    const vars = rv.inputs || {};
    const formulaIds = new Set();
    const collect = (expr) => (String(expr || '').match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).forEach((id) => formulaIds.add(id));
    if (mode === 'formula') collect(rv.formula);
    (input.opex || []).forEach((c) => { if (c.formula) collect(c.formula); });
    const modeKeys = { subscription: ['starting_customers', 'new_customers_month', 'churn_pct_month', 'price_per_month', 'growth_pct_year'], fintech: ['active_customers', 'customer_growth_pct', 'volume_per_customer', 'take_rate_pct'] }[mode] || [];
    modeKeys.forEach((k) => formulaIds.add(k));
    const varName = {};
    const labelFor = (k) => {
      const tpl = (ctx.sectors && ctx.sectors.sectors || []).find((s) => s.id === input.sector);
      const fromTpl = tpl && (tpl.inputs.find((x) => x.key === k) || tpl.cost_lines.find((x) => 'cost_' + x.key === k));
      return fromTpl ? fromTpl.label : k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    };
    const unitFor = (k) => {
      const tpl = (ctx.sectors && ctx.sectors.sectors || []).find((s) => s.id === input.sector);
      const fromTpl = tpl && tpl.inputs.find((x) => x.key === k);
      return fromTpl ? fromTpl.unit : (/pct/.test(k) ? '%' : k.startsWith('cost_') ? cur : '');
    };
    Array.from(formulaIds).forEach((k) => {
      const nm = camel(k); varName[k] = nm;
      inp(nm, labelFor(k), Number(vars[k] || 0), unitFor(k), /pct/.test(k) ? '0.0' : FMT.num, qualityOf(k.replace(/^cost_/, '')));
    });
    const PRICE_KEYS = ['price_per_tonne', 'price_per_unit', 'tariff_per_kwh', 'price_per_month', 'product_price', 'rate_per_unit', 'product_value_per_bbl', 'fee_per_admission'];
    const priceKey = PRICE_KEYS.find((k) => varName[k]);
    if (priceKey) { B.names.Price = B.names[varName[priceKey]]; B.wb.definedNames.add(B.names.Price, 'Price'); }
    if (mode === 'historical') inp('BaseRevenue', 'Sales in the latest full year (incl. biological asset gains)', rv.base_revenue, cur, FMT.money, 'sourced: latest audited accounts');
    if (mode === 'fintech') inp('ExistingCustomers', 'Customers before the model starts', rv.existing_customers || 0, 'customers', FMT.int, 'derived: year 1 customers less one year of growth');
    inp('ExportPct', 'Share of sales exported', rv.export_pct || 0, '%', '0.0', 'from the case revenue split');
    inp('PriceGrowth', 'Price growth a year', rv.price_growth_pct ?? input.inflation_pct ?? 0, '%', '0.0', 'assumed equal to inflation');
    inp('VolumeGrowth', 'Volume growth a year after ramp-up', rv.volume_growth_pct || 0, '%', '0.0', 'assumed');
    const ramp = rv.ramp_up && rv.ramp_up.length ? rv.ramp_up : [1];
    const rampRow = I.nextRow++;
    I.getCell('A' + rampRow).value = 'Ramp-up: share of full sales in operating years 1, 2, 3…';
    ramp.forEach((x, i) => B.input(I, colName(3 + i) + rampRow, x, '0%'));
    B.names.RampUp = q('Inputs') + '!$C$' + rampRow + ':$' + colName(3 + ramp.length - 1) + '$' + rampRow;
    B.wb.definedNames.add(B.names.RampUp, 'RampUp');
    calcIn('RampLen', 'Ramp-up years', 'COUNT(RampUp)', ramp.length, FMT.int);
    B.blank(I);

    /* ---- costs ---- */
    B.section(I, 'Running costs');
    inp('Inflation', 'Cost inflation a year', input.inflation_pct || 0, '%', '0.0', 'assumed default unless the case gives one');
    hdr(['Cost line', 'Type', 'Amount or %', '', '', '', '', 'Basis']);
    const opexCfg = (input.opex || []).map((c, i) => {
      const nm = 'Cost' + (i + 1);
      const kindLabel = { fixed: 'fixed a year', variable: 'per unit of activity', pct_revenue: '% of sales', pct_capex: '% of capex a year', pct_volume: '% of volume', per_new_customer: 'per new customer' }[c.kind] || c.kind;
      let amt = c.kind.startsWith('pct') ? c.pct : c.amount;
      let basis = '';
      if (c.kind === 'variable') { amt = null; basis = 'Formula: ' + String(c.formula).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id) => varName[id] || id); }
      const r = I.nextRow++;
      I.getCell('A' + r).value = c.label; I.getCell('B' + r).value = kindLabel;
      if (amt !== null && amt !== undefined) { B.input(I, 'C' + r, amt, c.kind.startsWith('pct') ? '0.00' : FMT.money); B.name(nm, I, 'C' + r); }
      I.getCell('H' + r).value = basis || (c.kind.startsWith('pct') ? 'Percentage' : cur);
      return Object.assign({}, c, { nm, xlFormula: c.formula ? String(c.formula).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id) => varName[id] || id) : null });
    });
    B.blank(I);

    /* ---- capex ---- */
    B.section(I, 'Capital spending (CAPEX)');
    hdr(['Item', 'Asset type', 'Amount', 'Life (years)', 'Spend year', '', '', 'Notes']);
    const capexCfg = (input.capex || []).map((c, i) => {
      const r = I.nextRow++;
      I.getCell('A' + r).value = c.label; I.getCell('B' + r).value = c.class || '';
      B.input(I, 'C' + r, c.amount, FMT.money); B.name('Capex' + (i + 1) + 'Amount', I, 'C' + r);
      B.input(I, 'D' + r, c.life_years || 10, FMT.int); B.name('Capex' + (i + 1) + 'Life', I, 'D' + r);
      B.input(I, 'E' + r, c.year || 0, FMT.int); B.name('Capex' + (i + 1) + 'Year', I, 'E' + r);
      I.getCell('H' + r).value = 'Spend year 0 spreads the cost evenly over the build period.';
      return { i: i + 1, label: c.label };
    });
    B.blank(I);

    B.section(I, 'Working capital and tax');
    const wc = input.working_capital || {};
    inp('ReceivableDays', 'Days customers take to pay', wc.receivable_days || 0, 'days', FMT.int, 'assumed default for the sector');
    inp('InventoryDays', 'Days of stock held', wc.inventory_days || 0, 'days', FMT.int, 'assumed default for the sector');
    inp('PayableDays', 'Days you take to pay suppliers', wc.payable_days || 0, 'days', FMT.int, 'assumed default for the sector');
    inp('TaxRate', 'Corporate tax rate', input.tax && input.tax.rate_pct || 0, '%', '0.0', 'assumed headline rate: check current law');
    inp('TaxHoliday', 'Tax holiday from first operating year', input.tax && input.tax.holiday_years || 0, 'years', FMT.int, 'assumed');
    B.blank(I);

    const op = input.opening || {};
    B.section(I, 'Opening balance sheet (already-trading businesses)');
    inp('OpeningCash', 'Cash at the start', op.cash || 0, cur, FMT.money, op.cash ? 'sourced: latest accounts' : '');
    inp('OpeningFixedAssets', 'Fixed assets at the start (net)', op.fixed_assets || 0, cur, FMT.money, op.fixed_assets ? 'sourced: latest accounts' : '');
    inp('OpeningAssetLife', 'Remaining life of existing assets', op.fixed_asset_life || 20, 'years', FMT.int, 'assumed');
    inp('OpeningAR', 'Money owed by customers at the start', op.ar || 0, cur, FMT.money);
    inp('OpeningInventory', 'Stock at the start', op.inventory || 0, cur, FMT.money);
    inp('OpeningAP', 'Money owed to suppliers at the start', op.ap || 0, cur, FMT.money);
    inp('OtherNetAssets', 'Other net assets (held constant)', op.other_net_assets || 0, cur, FMT.money, op.other_net_assets ? 'derived: equity plus debt less cash and fixed assets' : '');
    B.blank(I);

    /* ---- financing ---- */
    B.section(I, 'Financing');
    inp('FXDep', 'Local currency weakening a year (base case)', input.fx_depreciation_pct || 0, '%', '0.0', 'assumed');
    hdr(['Equity investor', '', 'Amount', 'Year', 'Pre-money', '', '', 'Notes']);
    const eqRows = [];
    const eqStart = I.nextRow;
    (equity.length ? equity : [{ label: 'No equity', amount: 0, year: 1 }]).forEach((e, i) => {
      const r = I.nextRow++;
      I.getCell('A' + r).value = e.label;
      B.input(I, 'C' + r, e.amount || 0, FMT.money); B.input(I, 'D' + r, e.year || 1, FMT.int); B.input(I, 'E' + r, e.pre_money || 0, FMT.money);
      eqRows.push(r);
    });
    B.names.EquityAmounts = q('Inputs') + '!$C$' + eqStart + ':$C$' + (I.nextRow - 1); B.wb.definedNames.add(B.names.EquityAmounts, 'EquityAmounts');
    B.names.EquityYears = q('Inputs') + '!$D$' + eqStart + ':$D$' + (I.nextRow - 1); B.wb.definedNames.add(B.names.EquityYears, 'EquityYears');
    hdr(['Grant', '', 'Amount', 'Year', '', '', '', '']);
    const grStart = I.nextRow;
    (grants.length ? grants : [{ label: 'No grant', amount: 0, year: 1 }]).forEach((g) => {
      const r = I.nextRow++; I.getCell('A' + r).value = g.label;
      B.input(I, 'C' + r, g.amount || 0, FMT.money); B.input(I, 'D' + r, g.year || 1, FMT.int);
    });
    B.names.GrantAmounts = q('Inputs') + '!$C$' + grStart + ':$C$' + (I.nextRow - 1); B.wb.definedNames.add(B.names.GrantAmounts, 'GrantAmounts');
    B.names.GrantYears = q('Inputs') + '!$D$' + grStart + ':$D$' + (I.nextRow - 1); B.wb.definedNames.add(B.names.GrantYears, 'GrantYears');

    const loanCfg = loans.map((l, i) => {
      const k = 'Loan' + (i + 1);
      B.blank(I);
      const r0 = I.nextRow++;
      I.getCell('A' + r0).value = (l.label || k) + (l.currency && l.currency !== cur ? ' (' + l.currency + ')' : '');
      I.getCell('A' + r0).font = { name: 'Arial', size: 10, bold: true };
      inp(k + 'Amount', 'Amount (in loan currency)', l.amount, l.currency || cur, FMT.money, 'see case sources');
      inp(k + 'FXRate', 'Exchange rate (' + cur + ' per 1 ' + (l.currency || cur) + ')', l.fx_rate || 1, '', FMT.num, l.currency && l.currency !== cur ? 'assumed' : 'same currency');
      inp(k + 'Foreign', 'Foreign-currency loan (1 = yes)', l.currency && l.currency !== cur ? 1 : 0, '', FMT.int);
      inp(k + 'Tenor', 'Years to repay, including grace', l.tenor_years, 'years', FMT.int);
      inp(k + 'Grace', 'Grace period (no principal)', l.grace_years || 0, 'years', FMT.int);
      inp(k + 'GraceType', 'Grace interest: 0 = paid, 1 = added to loan', l.grace_type === 'capitalised' ? 1 : 0, '', FMT.int);
      inp(k + 'Rate', 'Interest rate a year', l.rate_pct || 0, '%', '0.00');
      inp(k + 'Repay', 'Repayment: 1 = annuity, 2 = equal principal, 3 = bullet', { annuity: 1, equal_principal: 2, bullet: 3 }[l.repayment] || 1, '', FMT.int);
      inp(k + 'FeePct', 'Upfront fee', l.upfront_fee_pct || 0, '%', '0.00');
      inp(k + 'BalloonPct', 'Balloon at the end', l.balloon_pct || 0, '%', '0.00');
      const dr = I.nextRow++;
      I.getCell('A' + dr).value = 'Drawdown % by model year (0 = already drawn)';
      const drawPct = new Array(N + 1).fill(0);
      (l.draws && l.draws.length ? l.draws : [{ year: 1, pct: 100 }]).forEach((d) => { drawPct[Math.max(0, Math.min(N, d.year))] += d.pct ?? 100; });
      const hr = dr; // years shown in the next row
      for (let t = 0; t <= N; t++) B.input(I, colName(3 + t) + dr, drawPct[t], '0');
      const lab = I.nextRow++;
      I.getCell('A' + lab).value = 'Model year';
      for (let t = 0; t <= N; t++) { I.getCell(colName(3 + t) + lab).value = t; I.getCell(colName(3 + t) + lab).font = { name: 'Arial', size: 8, color: { argb: MUTED } }; }
      for (let t = 0; t <= N; t++) I.getColumn(3 + t).width = Math.max(I.getColumn(3 + t).width || 10, t === 0 ? 16 : 10);
      return { k, i, row: hr, label: l.label || k, provider_type: l.provider_type };
    });
    if (loanCfg.length) {
      B.wb.definedNames.add(B.names.Loan1Rate, 'InterestRate');
      B.wb.definedNames.add(B.names.Loan1Tenor, 'Tenor');
    }
    B.blank(I);

    B.section(I, 'Valuation, targets and what-if settings');
    inp('DiscountRate', 'Discount rate for NPV', input.discount_rate_pct || 12, '%', '0.0', 'assumed unless the case gives one');
    inp('DSCRTarget', 'Lowest DSCR lenders want', input.defaults && input.defaults.dscr_target || 1.3, 'x', '0.00', 'assumed: common lender minimum');
    inp('WhatIfPriceSmall', 'What-if: price fall (small)', 10, '%', '0', 'brief');
    inp('WhatIfPriceLarge', 'What-if: price fall (large)', 20, '%', '0', 'brief');
    inp('WhatIfVolume', 'What-if: volume fall', 20, '%', '0', 'brief');
    inp('WhatIfOpex', 'What-if: running cost rise', 15, '%', '0', 'brief');
    inp('WhatIfDelay', 'What-if: delay (whole years)', 1, 'years', '0', 'brief');
    inp('WhatIfFX', 'What-if: local currency weakening a year', input.defaults && input.defaults.fx_stress_depreciation_pct_year || 10, '%', '0', 'assumed stress');
    B.blank(I);

    B.section(I, 'Documents in place (TRUE or FALSE)');
    const docs = ready ? ready.required : [];
    const docStart = I.nextRow;
    docs.forEach((d) => { const r = I.nextRow++; I.getCell('A' + r).value = d; B.input(I, 'C' + r, !!(input.documents && input.documents[d])); });
    if (docs.length) { B.names.DocFlags = q('Inputs') + '!$C$' + docStart + ':$C$' + (I.nextRow - 1); B.wb.definedNames.add(B.names.DocFlags, 'DocFlags'); }

    /* ================================================================ REVENUE */
    const R = WS.Revenue;
    const t_ = (ws, t) => B.tref(ws, t);
    const opYearVals = new Array(N + 1).fill(0).map((_, t) => t - m.opsStart + 1);
    B.row(R, 'opYear', 'Operating year', (t) => t_(R, t) + '-OpsStart+1', opYearVals, { fmt: FMT.int });
    const rampVals = opYearVals.map((k) => (k < 1 ? 0 : (k <= ramp.length ? ramp[k - 1] : ramp[ramp.length - 1])));
    B.row(R, 'ramp', 'Ramp-up factor', (t) => 'IF(' + B.ref('opYear', t, 'Revenue') + '<1,0,INDEX(RampUp,MIN(' + B.ref('opYear', t, 'Revenue') + ',RampLen)))', rampVals, { fmt: '0%' });
    const volG = (rv.volume_growth_pct || 0) / 100;
    const actVals = rampVals.map((x, t) => (opYearVals[t] < 1 ? 0 : x * Math.pow(1 + volG, opYearVals[t] - 1)));
    B.row(R, 'activity', 'Activity (share of full-capacity volume)', (t) => B.ref('ramp', t, 'Revenue') + '*(1+VolumeGrowth/100)^(MAX(' + B.ref('opYear', t, 'Revenue') + ',1)-1)', actVals, { fmt: '0.0%' });
    const pg = (rv.price_growth_pct ?? input.inflation_pct ?? 0) / 100, inf = (input.inflation_pct || 0) / 100;
    B.row(R, 'priceIdx', 'Price index', (t) => '(1+PriceGrowth/100)^(' + t_(R, t) + '-1)', opYearVals.map((_, t) => Math.pow(1 + pg, t - 1)), { fmt: '0.000' });
    B.row(R, 'costIdx', 'Cost index', (t) => '(1+Inflation/100)^(' + t_(R, t) + '-1)', opYearVals.map((_, t) => Math.pow(1 + inf, t - 1)), { fmt: '0.000' });
    B.blank(R);
    B.section(R, 'Sales');
    if (mode === 'formula' || mode === 'historical') {
      const baseF = mode === 'historical' ? 'BaseRevenue' : String(rv.formula).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id) => varName[id] || id);
      const baseV = mode === 'historical' ? rv.base_revenue : (o.revenue.find((x) => x > 0) ? null : 0);
      const engineBase = mode === 'historical' ? rv.base_revenue : ctx.engine.evaluate(rv.formula, vars);
      B.scalar(R, 'baseRev', 'Sales at full capacity in year-1 prices', baseF.replace(/\s+/g, ''), engineBase, FMT.money);
      void baseV;
      B.row(R, 'revenue', 'Total sales', (t) => B.ref('baseRev', 'C', 'Revenue') + '*' + B.ref('activity', t, 'Revenue') + '*' + B.ref('priceIdx', t, 'Revenue'), o.revenue, { bold: true });
    } else if (mode === 'subscription') {
      const S = [], E = [], nmA = [], avg = [];
      let s0 = vars.starting_customers || 0;
      for (let t = 1; t <= N; t++) {
        const k = opYearVals[t]; const churn = Math.min(0.99, (vars.churn_pct_month || 0) / 100);
        S[t] = s0;
        nmA[t] = k < 1 ? 0 : (vars.new_customers_month || 0) * Math.pow(1 + (vars.growth_pct_year || 0) / 100, k - 1);
        const r12 = Math.pow(1 - churn, 12);
        E[t] = k < 1 ? s0 : churn === 0 ? s0 + 12 * nmA[t] : s0 * r12 + nmA[t] * (1 - r12) / churn;
        avg[t] = k < 1 ? 0 : (S[t] + E[t]) / 2; s0 = E[t];
      }
      B.reg.subEnd = { sheet: 'Revenue', row: R.nextRow + 2 };
      B.row(R, 'subOpen', 'Paying customers at the start of the year', (t) => (t === 1 ? 'StartingCustomers' : B.ref('subEnd', t - 1, 'Revenue')), S, { fmt: FMT.int });
      B.row(R, 'subNew', 'New paying customers a month', (t) => 'IF(' + B.ref('opYear', t, 'Revenue') + '<1,0,NewCustomersMonth*(1+GrowthPctYear/100)^(' + B.ref('opYear', t, 'Revenue') + '-1))', nmA, { fmt: FMT.num });
      B.row(R, 'subEnd', 'Paying customers at the end of the year', (t) => {
        const S_ = B.ref('subOpen', t, 'Revenue'), n_ = B.ref('subNew', t, 'Revenue'), c = 'MIN(0.99,ChurnPctMonth/100)';
        return 'IF(' + B.ref('opYear', t, 'Revenue') + '<1,' + S_ + ',IF(' + c + '=0,' + S_ + '+12*' + n_ + ',' + S_ + '*(1-' + c + ')^12+' + n_ + '*(1-(1-' + c + ')^12)/' + c + '))';
      }, E, { fmt: FMT.int });
      B.row(R, 'subAvg', 'Average paying customers', (t) => 'IF(' + B.ref('opYear', t, 'Revenue') + '<1,0,(' + B.ref('subOpen', t, 'Revenue') + '+' + B.ref('subEnd', t, 'Revenue') + ')/2)', avg, { fmt: FMT.int });
      B.row(R, 'newCust', 'New paying customers in the year', (t) => '12*' + B.ref('subNew', t, 'Revenue'), o.newCustomers, { fmt: FMT.int });
      B.row(R, 'revenue', 'Total sales', (t) => B.ref('subAvg', t, 'Revenue') + '*PricePerMonth*12*' + B.ref('priceIdx', t, 'Revenue'), o.revenue, { bold: true });
    } else if (mode === 'fintech') {
      const Lr = []; let last = rv.existing_customers || 0;
      for (let t = 1; t <= N; t++) { if (opYearVals[t] >= 1) last = o.customers[t]; Lr[t] = last; }
      B.row(R, 'custs', 'Active customers', (t) => 'IF(' + B.ref('opYear', t, 'Revenue') + '<1,0,ActiveCustomers*(1+CustomerGrowthPct/100)^(' + B.ref('opYear', t, 'Revenue') + '-1))', o.customers, { fmt: FMT.int });
      B.row(R, 'lastCust', 'Customers carried forward', (t) => 'IF(' + B.ref('opYear', t, 'Revenue') + '<1,' + B.ref('lastCust', t - 1, 'Revenue') + ',' + B.ref('custs', t, 'Revenue') + ')', Lr, { fmt: FMT.int, opening: { formula: 'ExistingCustomers', value: rv.existing_customers || 0, kind: 'link' } });
      B.row(R, 'newCust', 'New customers in the year', (t) => 'IF(' + B.ref('opYear', t, 'Revenue') + '<1,0,MAX(0,' + B.ref('custs', t, 'Revenue') + '-' + B.ref('lastCust', t - 1, 'Revenue') + '))', o.newCustomers, { fmt: FMT.int });
      B.row(R, 'volume', 'Money moved or lent', (t) => B.ref('custs', t, 'Revenue') + '*VolumePerCustomer*' + B.ref('priceIdx', t, 'Revenue'), o.volumeMoved);
      B.row(R, 'revenue', 'Total sales', (t) => B.ref('volume', t, 'Revenue') + '*TakeRatePct/100', o.revenue, { bold: true });
    }
    B.row(R, 'exportRev', 'Of which export sales', (t) => B.ref('revenue', t, 'Revenue') + '*ExportPct/100', o.exportRev);
    B.row(R, 'domesticRev', 'Of which domestic sales', (t) => B.ref('revenue', t, 'Revenue') + '-' + B.ref('exportRev', t, 'Revenue'), o.domesticRev);

    /* ================================================================ CAPEX */
    const C = WS.CAPEX;
    const capLines = m.capexLines;
    capexCfg.forEach((c, i) => {
      const k = 'Capex' + c.i;
      B.section(C, c.label);
      const depStart = (input.capex[i].year ? Math.max(input.capex[i].year, m.opsStart) : m.opsStart);
      B.scalar(C, 'cdep' + c.i, 'Depreciation starts in model year', 'IF(' + k + 'Year>0,MAX(' + k + 'Year,OpsStart),OpsStart)', depStart, FMT.int, { level: 1 });
      B.row(C, 'cspend' + c.i, 'Spend', (t) => 'IF(' + k + 'Year>0,IF(' + t_(C, t) + '=' + k + 'Year,' + k + 'Amount,0),IF(' + t_(C, t) + '<=MAX(1,ConstructionYears),' + k + 'Amount/MAX(1,ConstructionYears),0))', capLines[i].spend, { level: 1 });
      B.row(C, 'cdepr' + c.i, 'Depreciation', (t) => 'IF(AND(' + t_(C, t) + '>=' + B.ref('cdep' + c.i, 'C', 'CAPEX') + ',' + t_(C, t) + '<' + B.ref('cdep' + c.i, 'C', 'CAPEX') + '+' + k + 'Life),' + k + 'Amount/' + k + 'Life,0)', capLines[i].dep, { level: 1 });
    });
    B.section(C, 'Existing assets');
    const opDep = new Array(N + 1).fill(0).map((_, t) => (t >= 1 && t <= (op.fixed_asset_life || 20) ? (op.fixed_assets || 0) / (op.fixed_asset_life || 20) : 0));
    B.row(C, 'odep', 'Depreciation of existing assets', (t) => 'IF(' + t_(C, t) + '<=OpeningAssetLife,OpeningFixedAssets/OpeningAssetLife,0)', opDep);
    B.blank(C);
    B.section(C, 'Totals');
    const sumRows = (prefix, t, n) => (n ? Array.from({ length: n }, (_, j) => B.ref(prefix + (j + 1), t, 'CAPEX')).join('+') : '0');
    B.row(C, 'capex', 'Total capex', (t) => sumRows('cspend', t, capexCfg.length), o.capex, { bold: true });
    B.row(C, 'dep', 'Total depreciation', (t) => sumRows('cdepr', t, capexCfg.length) + '+' + B.ref('odep', t, 'CAPEX'), o.dep, { bold: true });
    B.row(C, 'nfa', 'Fixed assets (net)', (t) => B.ref('nfa', t - 1, 'CAPEX') + '+' + B.ref('capex', t, 'CAPEX') + '-' + B.ref('dep', t, 'CAPEX'), o.nfa, { opening: { formula: 'OpeningFixedAssets', value: o.nfa[0], kind: 'link' } });
    B.scalar(C, 'totalCapex', 'Total capex, all years', 'SUM(' + B.range('capex', 'CAPEX') + ')', o.capex.slice(1).reduce((a, b) => a + b, 0), FMT.money, { bold: true });

    /* ================================================================ OPEX */
    const X = WS.OPEX;
    const groups = { A: [], B: [], Cg: [], D: [] };
    const RV = (key, t) => B.ref(key, t, 'OPEX');
    opexCfg.forEach((c, i) => {
      const key = 'opex' + (i + 1);
      const fn = (t) => {
        switch (c.kind) {
          case 'fixed': return 'IF(' + RV('opYear', t) + '>=1,' + c.nm + '*' + RV('costIdx', t) + ',0)';
          case 'variable': return '(' + c.xlFormula.replace(/\s+/g, '') + ')*' + RV('activity', t) + '*' + RV('costIdx', t);
          case 'pct_revenue': return RV('revenue', t) + '*' + c.nm + '/100';
          case 'pct_capex': return 'IF(' + RV('opYear', t) + '>=1,' + B.ref('totalCapex', 'C', 'OPEX') + '*' + c.nm + '/100*' + RV('costIdx', t) + ',0)';
          case 'pct_volume': return RV('volume', t) + '*' + c.nm + '/100';
          case 'per_new_customer': return RV('newCust', t) + '*' + c.nm + '*' + RV('costIdx', t);
          default: return '0';
        }
      };
      B.row(X, key, c.label, fn, m.costLines[i].values);
      (c.kind === 'pct_revenue' ? groups.A : c.kind === 'pct_volume' ? groups.B : c.kind === 'fixed' || c.kind === 'pct_capex' ? groups.D : groups.Cg).push(key);
    });
    B.blank(X);
    B.section(X, 'Cost groups (used by the Sensitivity sheet)');
    const grpVals = (keys) => new Array(N + 1).fill(0).map((_, t) => keys.reduce((s, k) => s + m.costLines[Number(k.slice(4)) - 1].values[t], 0));
    const grp = (key, label, keys) => B.row(X, key, label, (t) => (keys.length ? keys.map((k) => B.ref(k, t, 'OPEX')).join('+') : '0'), grpVals(keys), { level: 1 });
    grp('gA', 'Costs that are a share of sales', groups.A);
    grp('gB', 'Costs that are a share of volume moved', groups.B);
    grp('gC', 'Costs that rise with activity', groups.Cg);
    grp('gD', 'Fixed costs', groups.D);
    B.blank(X);
    B.row(X, 'varCost', 'Variable costs', (t) => B.ref('gA', t, 'OPEX') + '+' + B.ref('gB', t, 'OPEX') + '+' + B.ref('gC', t, 'OPEX'), o.varCost, { bold: true });
    B.row(X, 'fixCost', 'Fixed costs', (t) => B.ref('gD', t, 'OPEX'), o.fixCost, { bold: true });
    B.row(X, 'totalCost', 'Total running costs', (t) => B.ref('varCost', t, 'OPEX') + '+' + B.ref('fixCost', t, 'OPEX'), o.varCost.map((v, t) => v + o.fixCost[t]), { bold: true });

    /* ================================================================ WORKING CAPITAL */
    const W = WS['Working capital'];
    B.row(W, 'ar', 'Money owed by customers', (t) => B.ref('revenue', t, 'Working capital') + '*ReceivableDays/365', o.ar, { opening: { formula: 'OpeningAR', value: o.ar[0], kind: 'link' } });
    B.row(W, 'inv', 'Stock', (t) => B.ref('varCost', t, 'Working capital') + '*InventoryDays/365', o.inventory, { opening: { formula: 'OpeningInventory', value: o.inventory[0], kind: 'link' } });
    B.row(W, 'ap', 'Money owed to suppliers', (t) => B.ref('totalCost', t, 'Working capital') + '*PayableDays/365', o.ap, { opening: { formula: 'OpeningAP', value: o.ap[0], kind: 'link' } });
    const nwc = o.ar.map((a, t) => a + o.inventory[t] - o.ap[t]);
    B.row(W, 'nwc', 'Net working capital', (t) => B.ref('ar', t, 'Working capital') + '+' + B.ref('inv', t, 'Working capital') + '-' + B.ref('ap', t, 'Working capital'), nwc,
      { bold: true, opening: { formula: 'C' + B.reg.ar.row + '+C' + B.reg.inv.row + '-C' + B.reg.ap.row, value: nwc[0] } });
    B.row(W, 'dWC', 'Increase in working capital (uses cash)', (t) => B.ref('nwc', t, 'Working capital') + '-' + B.ref('nwc', t - 1, 'Working capital'), o.dWC, { bold: true });

    /* ================================================================ LOANS */
    const Ls = WS.Loans;
    const LR = (key, t) => B.ref(key, t, 'Loans');
    loanCfg.forEach((lc, li) => {
      const s = m.loans[li]; const k = lc.k;
      B.section(Ls, lc.label);
      const drawFlag = s.draw.map((d, t) => (d > 0 ? t : 999));
      const firstDraw = Math.min(...drawFlag);
      const drawRef = (t) => q('Inputs') + '!' + colName(3 + t) + lc.row;
      B.row(Ls, k + 'draw', 'Drawdown (loan currency)', (t) => k + 'Amount*' + drawRef(t) + '/100', s.draw, { level: 1, opening: { formula: k + 'Amount*' + drawRef(0) + '/100', value: s.draw[0] } });
      B.row(Ls, k + 'flag', 'Drawdown year marker', (t) => 'IF(' + LR(k + 'draw', t) + '>0,' + t_(Ls, t) + ',999)', drawFlag, { level: 1, fmt: FMT.int, opening: { formula: 'IF(C' + B.reg[k + 'draw'].row + '>0,0,999)', value: drawFlag[0] } });
      B.scalar(Ls, k + 'first', 'First drawdown year', 'MIN(' + B.range(k + 'flag', 'Loans', true) + ')', firstDraw, FMT.int, { level: 1 });
      B.scalar(Ls, k + 'start', 'Loan start year', 'MAX(1,' + LR(k + 'first', 'C') + ')', s.start, FMT.int, { level: 1 });
      const graceEff = s.firstRepay - s.start;
      B.scalar(Ls, k + 'grace', 'Grace years used', 'MAX(0,MIN(ROUND(' + k + 'Tenor,0)-1,ROUND(' + k + 'Grace,0)))', graceEff, FMT.int, { level: 1 });
      B.scalar(Ls, k + 'fr', 'First repayment year', LR(k + 'start', 'C') + '+' + LR(k + 'grace', 'C'), s.firstRepay, FMT.int, { level: 1 });
      B.scalar(Ls, k + 'last', 'Final repayment year', LR(k + 'start', 'C') + '+MAX(1,ROUND(' + k + 'Tenor,0))-1', s.last, FMT.int, { level: 1 });
      B.scalar(Ls, k + 'n', 'Number of repayments', LR(k + 'last', 'C') + '-' + LR(k + 'fr', 'C') + '+1', s.last - s.firstRepay + 1, FMT.int, { level: 1 });
      const bal = s.opening.map((x, t) => x + s.draw[t]);
      const baseBal = s.firstRepay <= N ? bal[s.firstRepay] : 0;
      // Row order from here: open, bal, int, cap, ip, prin, close, fee, base, inst. Rows used before they are written are registered now.
      const r0 = Ls.nextRow;
      B.reg[k + 'close'] = { sheet: 'Loans', row: r0 + 6 };
      B.reg[k + 'base'] = { sheet: 'Loans', row: r0 + 8 };
      B.reg[k + 'inst'] = { sheet: 'Loans', row: r0 + 9 };
      B.row(Ls, k + 'open', 'Opening balance', (t) => LR(k + 'close', t - 1), s.opening, { level: 1 });
      B.row(Ls, k + 'bal', 'Balance after drawdown', (t) => LR(k + 'open', t) + '+' + LR(k + 'draw', t), bal, { level: 1 });
      B.row(Ls, k + 'int', 'Interest for the year', (t) => LR(k + 'bal', t) + '*' + k + 'Rate/100', s.interest, { level: 1 });
      B.row(Ls, k + 'cap', 'Interest added to the loan', (t) => 'IF(AND(' + t_(Ls, t) + '<' + LR(k + 'fr', 'C') + ',' + k + 'GraceType=1),' + LR(k + 'int', t) + ',0)', s.capitalised, { level: 1 });
      B.row(Ls, k + 'ip', 'Interest paid', (t) => 'IF(' + t_(Ls, t) + '<' + LR(k + 'fr', 'C') + ',IF(' + k + 'GraceType=1,0,' + LR(k + 'int', t) + '),IF(' + t_(Ls, t) + '<=' + LR(k + 'last', 'C') + ',' + LR(k + 'int', t) + ',0))', s.interestPaid, { level: 1 });
      const prinF = (t) => 'IF(OR(' + t_(Ls, t) + '<' + LR(k + 'fr', 'C') + ',' + t_(Ls, t) + '>' + LR(k + 'last', 'C') + '),0,IF(' + t_(Ls, t) + '=' + LR(k + 'last', 'C') + ',' + LR(k + 'bal', t) +
        ',MAX(0,MIN(' + LR(k + 'bal', t) + ',IF(' + k + 'Repay=1,' + LR(k + 'inst', 'C') + '-' + LR(k + 'int', t) + ',IF(' + k + 'Repay=2,' + LR(k + 'inst', 'C') + ',0))))))';
      B.row(Ls, k + 'prin', 'Principal repaid', prinF, s.principal, { level: 1 });
      const expectClose = B.reg[k + 'close'].row;
      const closeRow = B.row(Ls, k + 'close', 'Closing balance', (t) => LR(k + 'bal', t) + '+' + LR(k + 'cap', t) + '-' + LR(k + 'prin', t), s.closing, { level: 1, bold: true, opening: { formula: 'C' + B.reg[k + 'draw'].row, value: s.closing[0] } });
      if (closeRow !== expectClose) throw new Error('Loan layout error');
      B.row(Ls, k + 'fee', 'Upfront fee', (t) => 'IF(' + t_(Ls, t) + '=MAX(1,' + LR(k + 'first', 'C') + '),' + k + 'Amount*' + k + 'FeePct/100,0)', s.fee, { level: 1 });
      if (Ls.nextRow !== r0 + 8) throw new Error('Loan layout error (base)');
      B.scalar(Ls, k + 'base', 'Balance at first repayment', 'IF(' + LR(k + 'fr', 'C') + '<=' + N + ',INDEX(' + B.range(k + 'bal', 'Loans') + ',' + LR(k + 'fr', 'C') + '),0)', baseBal, FMT.money, { level: 1 });
      const n = s.last - s.firstRepay + 1, r = s.rate, bp = (loans[li].balloon_pct || 0) / 100;
      let inst = 0;
      if (loans[li].repayment === 'annuity') inst = -ctx.engine.pmt(r, n, baseBal, -baseBal * bp);
      else if (loans[li].repayment === 'equal_principal') inst = baseBal * (1 - bp) / n;
      B.scalar(Ls, k + 'inst', 'Regular instalment (annuity payment or principal amount)', 'IF(' + k + 'Repay=1,-PMT(' + k + 'Rate/100,' + LR(k + 'n', 'C') + ',' + LR(k + 'base', 'C') + ',-' + LR(k + 'base', 'C') + '*' + k + 'BalloonPct/100),IF(' + k + 'Repay=2,' + LR(k + 'base', 'C') + '*(1-' + k + 'BalloonPct/100)/' + LR(k + 'n', 'C') + ',0))', inst, FMT.money, { level: 1 });
      // local currency
      const idxV = s.local.draw.map((_, t) => (s.foreign ? Math.pow(1 + (input.fx_depreciation_pct || 0) / 100, Math.max(0, t - 1)) : 1));
      B.row(Ls, k + 'fx', 'Exchange rate index', (t) => 'IF(' + k + 'Foreign=1,(1+FXDep/100)^(' + t_(Ls, t) + '-1),1)', idxV, { level: 1, fmt: '0.000' });
      const L = (key, label, src, vals, extra = {}) => B.row(Ls, k + key, label + ' (' + cur + ')', (t) => LR(k + src, t) + '*' + k + 'FXRate*' + LR(k + 'fx', t), vals, Object.assign({ level: 1 }, extra));
      L('Ldraw', 'Drawdown', 'draw', s.local.draw);
      L('Lip', 'Interest paid', 'ip', s.local.interestPaid);
      L('Lcap', 'Interest added to the loan', 'cap', s.local.capitalised);
      L('Lprin', 'Principal repaid', 'prin', s.local.principal);
      L('Lfee', 'Upfront fee', 'fee', s.local.fee);
      L('Lclose', 'Closing balance', 'close', s.local.closing, { opening: { formula: 'C' + B.reg[k + 'close'].row + '*' + k + 'FXRate', value: s.local.closing[0] } });
      B.row(Ls, k + 'Lfx', 'Exchange loss (' + cur + ')', (t) => LR(k + 'Lclose', t) + '-(' + LR(k + 'Lclose', t - 1) + '+' + LR(k + 'Ldraw', t) + '+' + LR(k + 'Lcap', t) + '-' + LR(k + 'Lprin', t) + ')', s.local.fxLoss, { level: 1 });
      B.blank(Ls);
    });
    B.section(Ls, 'All loans (' + cur + ')');
    const sumL = (key, t) => (loanCfg.length ? loanCfg.map((lc) => LR(lc.k + key, t)).join('+') : '0');
    B.row(Ls, 'draw', 'Drawdowns', (t) => sumL('Ldraw', t), o.draw, { bold: true });
    B.row(Ls, 'intPaid', 'Interest paid', (t) => sumL('Lip', t), o.intPaid);
    B.row(Ls, 'intCap', 'Interest added to loans', (t) => sumL('Lcap', t), o.intCap);
    B.row(Ls, 'principal', 'Principal repaid', (t) => sumL('Lprin', t), o.principal);
    B.row(Ls, 'fees', 'Upfront fees', (t) => sumL('Lfee', t), o.fees);
    B.row(Ls, 'fxLoss', 'Exchange losses', (t) => sumL('Lfx', t), o.fxLoss);
    B.row(Ls, 'debt', 'Debt outstanding', (t) => sumL('Lclose', t), o.debt, { bold: true, opening: { formula: loanCfg.length ? loanCfg.map((lc) => 'C' + B.reg[lc.k + 'Lclose'].row).join('+') : '0', value: o.debt[0] } });
    B.row(Ls, 'ds', 'Debt service (interest paid plus principal)', (t) => B.ref('intPaid', t, 'Loans') + '+' + B.ref('principal', t, 'Loans'), o.debtService, { bold: true });

    /* ================================================================ FINANCING */
    const F = WS.Financing;
    B.row(F, 'equityIn', 'Equity paid in', (t) => 'SUMIF(EquityYears,' + t_(F, t) + ',EquityAmounts)', o.equityIn);
    B.row(F, 'grantIn', 'Grants received', (t) => 'SUMIF(GrantYears,' + t_(F, t) + ',GrantAmounts)', o.grantIn);
    B.row(F, 'drawF', 'Loan drawdowns', (t) => B.ref('draw', t, 'Financing'), o.draw);
    B.blank(F);
    B.section(F, 'Sources and uses of funds (all years)');
    const sumR = (key) => 'SUM(' + B.range(key, 'Financing') + ')';
    const sumV = (a) => a.slice(1).reduce((x, y) => x + y, 0);
    B.scalar(F, 'srcEq', 'Equity', sumR('equityIn'), sumV(o.equityIn));
    B.scalar(F, 'srcGr', 'Grants', sumR('grantIn'), sumV(o.grantIn));
    B.scalar(F, 'srcDebt', 'Loans', sumR('drawF'), sumV(o.draw));
    B.scalar(F, 'sources', 'Total sources', 'C' + B.reg.srcEq.row + '+C' + B.reg.srcGr.row + '+C' + B.reg.srcDebt.row, m.funded, FMT.money, { bold: true });
    B.blank(F);
    B.scalar(F, 'useCapex', 'Capex', B.ref('totalCapex', 'C', 'Financing'), m.uses.capex);
    B.scalar(F, 'useFees', 'Loan fees', 'SUM(' + B.range('fees', 'Financing') + ')', m.uses.fees);
    B.scalar(F, 'useReserve', 'Cash reserve (negative means a funding gap)', 'C' + B.reg.sources.row + '-C' + B.reg.useCapex.row + '-C' + B.reg.useFees.row, m.uses.reserve);
    B.scalar(F, 'uses', 'Total uses', 'C' + B.reg.useCapex.row + '+C' + B.reg.useFees.row + '+C' + B.reg.useReserve.row, m.uses.capex + m.uses.fees + m.uses.reserve, FMT.money, { bold: true });
    B.scalar(F, 'gearing', 'Share funded by debt (gearing)', 'IF((' + B.ref('debt', 'C', 'Financing') + '+C' + B.reg.srcDebt.row + '+C' + B.reg.srcEq.row + '+MAX(0,' + "'Balance sheet'!$C$EQROW" + ')+C' + B.reg.srcGr.row + ')>0,(' + B.ref('debt', 'C', 'Financing') + '+C' + B.reg.srcDebt.row + ')/(' + B.ref('debt', 'C', 'Financing') + '+C' + B.reg.srcDebt.row + '+C' + B.reg.srcEq.row + '+MAX(0,' + "'Balance sheet'!$C$EQROW" + ')+C' + B.reg.srcGr.row + '),"n/a")', m.kpis.gearing, FMT.frac);

    /* ================================================================ EQUITY */
    const Eq = WS.Equity;
    B.row(Eq, 'eqCash', 'Equity paid in', (t) => B.ref('equityIn', t, 'Equity'), o.equityIn);
    B.blank(Eq);
    B.section(Eq, 'Ownership after each funding round');
    const rounds = equity.map((e, i) => Object.assign({ idx: i }, e)).filter((e) => (e.pre_money || 0) > 0).sort((a, b) => (a.year || 1) - (b.year || 1));
    let foundersRef = null;
    const fr0 = Eq.nextRow++; Eq.getCell('A' + fr0).value = 'Founders and existing owners at the start'; B.f(Eq, 'C' + fr0, '1', 1, FMT.frac);
    foundersRef = 'C' + fr0;
    const ownedRefs = [];
    rounds.forEach((e, j) => {
      const r = eqRows[e.idx];
      const base = Eq.nextRow;
      Eq.getCell('A' + base).value = e.label + ': post-money valuation'; B.f(Eq, 'C' + base, q('Inputs') + '!E' + r + '+' + q('Inputs') + '!C' + r, (e.pre_money || 0) + (e.amount || 0), FMT.money);
      Eq.getCell('A' + (base + 1)).value = e.label + ': share bought'; B.f(Eq, 'C' + (base + 1), q('Inputs') + '!C' + r + '/C' + base, m.ownership[j + 1] ? (e.amount / ((e.pre_money || 0) + e.amount)) : 0, FMT.frac);
      Eq.getCell('A' + (base + 2)).value = 'Founders after this round'; B.f(Eq, 'C' + (base + 2), foundersRef + '*(1-C' + (base + 1) + ')', null, FMT.frac);
      ownedRefs.forEach((o2) => { o2.refs.push('(1-C' + (base + 1) + ')'); });
      ownedRefs.push({ label: e.label, start: 'C' + (base + 1), refs: [] });
      foundersRef = 'C' + (base + 2);
      Eq.nextRow = base + 3;
    });
    if (rounds.length) {
      B.blank(Eq);
      B.section(Eq, 'Ownership today');
      const r1 = Eq.nextRow++; Eq.getCell('A' + r1).value = 'Founders and existing owners'; B.f(Eq, 'C' + r1, foundersRef, m.ownership[0].pct / 100, FMT.frac, 'link');
      ownedRefs.forEach((o2, j) => { const rr = Eq.nextRow++; Eq.getCell('A' + rr).value = o2.label; B.f(Eq, 'C' + rr, [o2.start].concat(o2.refs).join('*'), m.ownership[j + 1].pct / 100, FMT.frac); });
    } else { const rr = Eq.nextRow++; Eq.getCell('A' + rr).value = 'No priced equity rounds in this plan. Add a pre-money valuation on the Inputs sheet to see dilution.'; }

    /* ================================================================ P&L */
    const P = WS['P&L'];
    const PR = (key, t) => B.ref(key, t, 'P&L');
    B.row(P, 'pRev', 'Sales', (t) => B.ref('revenue', t, 'P&L'), o.revenue, { bold: true });
    B.row(P, 'pVar', 'Variable costs', (t) => B.ref('varCost', t, 'P&L'), o.varCost);
    B.row(P, 'gross', 'Gross profit', (t) => PR('pRev', t) + '-' + PR('pVar', t), o.grossProfit, { bold: true });
    B.row(P, 'pFix', 'Fixed costs', (t) => B.ref('fixCost', t, 'P&L'), o.fixCost);
    B.row(P, 'ebitda', 'EBITDA', (t) => PR('gross', t) + '-' + PR('pFix', t), o.ebitda, { bold: true });
    B.row(P, 'pDep', 'Depreciation', (t) => B.ref('dep', t, 'P&L'), o.dep);
    B.row(P, 'ebit', 'Operating profit (EBIT)', (t) => PR('ebitda', t) + '-' + PR('pDep', t), o.ebit, { bold: true });
    B.row(P, 'pInt', 'Interest', (t) => B.ref('intPaid', t, 'P&L') + '+' + B.ref('intCap', t, 'P&L'), o.interest);
    B.row(P, 'pFees', 'Loan fees', (t) => B.ref('fees', t, 'P&L'), o.fees);
    B.row(P, 'pFx', 'Exchange losses', (t) => B.ref('fxLoss', t, 'P&L'), o.fxLoss);
    B.row(P, 'pbt', 'Profit before tax', (t) => PR('ebit', t) + '-' + PR('pInt', t) + '-' + PR('pFees', t) + '-' + PR('pFx', t), o.pbt, { bold: true });
    const hol = input.tax && input.tax.holiday_years || 0;
    const holV = opYearVals.map((k) => (k >= 1 && k <= hol ? 1 : 0));
    B.row(P, 'hol', 'Tax holiday year (1 = yes)', (t) => 'IF(AND(' + B.ref('opYear', t, 'P&L') + '>=1,' + B.ref('opYear', t, 'P&L') + '<=TaxHoliday),1,0)', holV, { fmt: FMT.int, level: 1 });
    const poolO = [0], poolC = [0];
    for (let t = 1; t <= N; t++) {
      poolO[t] = poolC[t - 1];
      const pbt = o.pbt[t];
      poolC[t] = holV[t] ? poolO[t] : pbt < 0 ? poolO[t] - pbt : poolO[t] - Math.min(poolO[t], pbt);
    }
    B.reg.poolC = { sheet: 'P&L', row: P.nextRow + 2 }; // poolO, tax, poolC
    B.row(P, 'poolO', 'Tax losses brought forward', (t) => PR('poolC', t - 1), poolO, { level: 1, opening: { formula: '0', value: 0 } });
    B.row(P, 'tax', 'Tax', (t) => 'IF(' + PR('hol', t) + '=1,0,IF(' + PR('pbt', t) + '<0,0,(' + PR('pbt', t) + '-MIN(' + PR('poolO', t) + ',' + PR('pbt', t) + '))*TaxRate/100))', o.taxCharge);
    B.row(P, 'poolC', 'Tax losses carried forward', (t) => 'IF(' + PR('hol', t) + '=1,' + PR('poolO', t) + ',IF(' + PR('pbt', t) + '<0,' + PR('poolO', t) + '-' + PR('pbt', t) + ',' + PR('poolO', t) + '-MIN(' + PR('poolO', t) + ',' + PR('pbt', t) + ')))', poolC, { level: 1, opening: { formula: '0', value: 0 } });
    B.row(P, 'ni', 'Net profit', (t) => PR('pbt', t) + '-' + PR('tax', t), o.netIncome, { bold: true });

    /* ================================================================ CASH FLOW */
    const CF = WS['Cash flow'];
    const CR = (key, t) => B.ref(key, t, 'Cash flow');
    B.row(CF, 'cEbitda', 'EBITDA', (t) => B.ref('ebitda', t, 'Cash flow'), o.ebitda);
    B.row(CF, 'cTax', 'Tax paid', (t) => '-' + B.ref('tax', t, 'Cash flow'), o.taxCharge.map((x) => -x));
    B.row(CF, 'cWC', 'Working capital', (t) => '-' + B.ref('dWC', t, 'Cash flow'), o.dWC.map((x) => -x));
    B.row(CF, 'cfo', 'Cash from operations', (t) => CR('cEbitda', t) + '+' + CR('cTax', t) + '+' + CR('cWC', t), o.cfo, { bold: true });
    B.row(CF, 'cCapex', 'Capex', (t) => '-' + B.ref('capex', t, 'Cash flow'), o.capex.map((x) => -x));
    B.row(CF, 'cfi', 'Cash from investing', (t) => CR('cCapex', t), o.cfi, { bold: true });
    B.row(CF, 'cEq', 'Equity paid in', (t) => B.ref('equityIn', t, 'Cash flow'), o.equityIn);
    B.row(CF, 'cGr', 'Grants received', (t) => B.ref('grantIn', t, 'Cash flow'), o.grantIn);
    B.row(CF, 'cDraw', 'Loan drawdowns', (t) => B.ref('draw', t, 'Cash flow'), o.draw);
    B.row(CF, 'cFees', 'Loan fees', (t) => '-' + B.ref('fees', t, 'Cash flow'), o.fees.map((x) => -x));
    B.row(CF, 'cInt', 'Interest paid', (t) => '-' + B.ref('intPaid', t, 'Cash flow'), o.intPaid.map((x) => -x));
    B.row(CF, 'cPrin', 'Principal repaid', (t) => '-' + B.ref('principal', t, 'Cash flow'), o.principal.map((x) => -x));
    B.row(CF, 'cff', 'Cash from financing', (t) => ['cEq', 'cGr', 'cDraw', 'cFees', 'cInt', 'cPrin'].map((x) => CR(x, t)).join('+'), o.cff, { bold: true });
    B.row(CF, 'net', 'Net cash flow', (t) => CR('cfo', t) + '+' + CR('cfi', t) + '+' + CR('cff', t), o.netCash, { bold: true });
    B.row(CF, 'cash', 'Cash at the end of the year', (t) => CR('cash', t - 1) + '+' + CR('net', t), o.cash, { bold: true, opening: { formula: 'OpeningCash', value: o.cash[0], kind: 'link' } });

    /* ================================================================ BALANCE SHEET */
    const BS = WS['Balance sheet'];
    const BR = (key, t) => B.ref(key, t, 'Balance sheet');
    B.section(BS, 'Assets');
    B.row(BS, 'bCash', 'Cash', (t) => B.ref('cash', t, 'Balance sheet'), o.cash, { opening: { formula: B.ref('cash', 'C', 'Balance sheet'), value: o.cash[0], kind: 'link' } });
    B.row(BS, 'bAR', 'Money owed by customers', (t) => B.ref('ar', t, 'Balance sheet'), o.ar, { opening: { formula: B.ref('ar', 'C', 'Balance sheet'), value: o.ar[0], kind: 'link' } });
    B.row(BS, 'bInv', 'Stock', (t) => B.ref('inv', t, 'Balance sheet'), o.inventory, { opening: { formula: B.ref('inv', 'C', 'Balance sheet'), value: o.inventory[0], kind: 'link' } });
    B.row(BS, 'bNFA', 'Fixed assets', (t) => B.ref('nfa', t, 'Balance sheet'), o.nfa, { opening: { formula: B.ref('nfa', 'C', 'Balance sheet'), value: o.nfa[0], kind: 'link' } });
    const otherV = new Array(N + 1).fill(op.other_net_assets || 0);
    B.row(BS, 'bOther', 'Other net assets', () => 'OtherNetAssets', otherV, { opening: { formula: 'OtherNetAssets', value: otherV[0], kind: 'link' } });
    const assets0 = o.cash[0] + o.ar[0] + o.inventory[0] + o.nfa[0] + otherV[0];
    B.row(BS, 'assets', 'Total assets', (t) => ['bCash', 'bAR', 'bInv', 'bNFA', 'bOther'].map((x) => BR(x, t)).join('+'), o.assets, { bold: true, opening: { formula: ['bCash', 'bAR', 'bInv', 'bNFA', 'bOther'].map((x) => 'C' + B.reg[x].row).join('+'), value: assets0 } });
    B.section(BS, 'Liabilities');
    B.row(BS, 'bAP', 'Money owed to suppliers', (t) => B.ref('ap', t, 'Balance sheet'), o.ap, { opening: { formula: B.ref('ap', 'C', 'Balance sheet'), value: o.ap[0], kind: 'link' } });
    B.row(BS, 'bDebt', 'Loans', (t) => B.ref('debt', t, 'Balance sheet'), o.debt, { opening: { formula: B.ref('debt', 'C', 'Balance sheet'), value: o.debt[0], kind: 'link' } });
    B.row(BS, 'liab', 'Total liabilities', (t) => BR('bAP', t) + '+' + BR('bDebt', t), o.liabilities, { bold: true, opening: { formula: 'C' + B.reg.bAP.row + '+C' + B.reg.bDebt.row, value: o.ap[0] + o.debt[0] } });
    B.section(BS, 'Equity');
    const eqRow = B.scalar(BS, 'eq0', 'Opening equity (assets less liabilities at the start)', 'C' + B.reg.assets.row + '-C' + B.reg.liab.row, o.equity[0]);
    const paidCum = [0], retCum = [0];
    for (let t = 1; t <= N; t++) { paidCum[t] = paidCum[t - 1] + o.equityIn[t] + o.grantIn[t]; retCum[t] = retCum[t - 1] + o.netIncome[t]; }
    B.row(BS, 'paidIn', 'Equity and grants paid in to date', (t) => BR('paidIn', t - 1) + '+' + B.ref('equityIn', t, 'Balance sheet') + '+' + B.ref('grantIn', t, 'Balance sheet'), paidCum, { opening: { formula: '0', value: 0 } });
    B.row(BS, 'retained', 'Profits kept in the business to date', (t) => BR('retained', t - 1) + '+' + B.ref('ni', t, 'Balance sheet'), retCum, { opening: { formula: '0', value: 0 } });
    B.row(BS, 'equity', 'Total equity', (t) => '$C$' + eqRow + '+' + BR('paidIn', t) + '+' + BR('retained', t), o.equity, { bold: true });
    B.row(BS, 'bsDiff', 'Difference (should be zero)', (t) => BR('assets', t) + '-' + BR('liab', t) + '-' + BR('equity', t), o.bsDiff.map(() => 0));
    // patch gearing formula with the opening equity row
    const gCell = WS.Financing.getCell('C' + B.reg.gearing.row);
    gCell.value = { formula: gCell.value.formula.replace(/EQROW/g, String(eqRow)), result: gCell.value.result };

    /* ================================================================ KPIs */
    const K = WS.KPIs;
    const KR = (key, t) => B.ref(key, t, 'KPIs');
    B.row(K, 'cfads', 'Cash available for debt service (CFADS)', (t) => B.ref('ebitda', t, 'KPIs') + '-' + B.ref('tax', t, 'KPIs') + '-' + B.ref('dWC', t, 'KPIs'), o.cfads);
    B.row(K, 'kDS', 'Debt service', (t) => B.ref('ds', t, 'KPIs'), o.debtService);
    B.row(K, 'dscr', 'DSCR', (t) => 'IF(AND(' + B.ref('opYear', t, 'KPIs') + '>=1,' + KR('kDS', t) + '>0.000000001),' + KR('cfads', t) + '/' + KR('kDS', t) + ',"")', o.dscr.map((x) => (x === null ? '' : x)), { fmt: FMT.ratio });
    B.row(K, 'cad', 'Cash left after debt service', (t) => KR('cfads', t) + '-' + KR('kDS', t), o.cashAfterDebt, { bold: true });
    B.row(K, 'fcf', 'Project free cash flow', (t) => KR('cfads', t) + '-' + B.ref('capex', t, 'KPIs'), o.projectFCF, { bold: true });
    B.row(K, 'fcfe', 'Free cash flow to equity', (t) => KR('fcf', t) + '+' + B.ref('grantIn', t, 'KPIs') + '+' + B.ref('draw', t, 'KPIs') + '-' + B.ref('intPaid', t, 'KPIs') + '-' + B.ref('fees', t, 'KPIs') + '-' + B.ref('principal', t, 'KPIs'), o.fcfe);
    const cum = [0]; for (let t = 1; t <= N; t++) cum[t] = cum[t - 1] + o.projectFCF[t];
    B.row(K, 'cum', 'Cumulative project cash flow', (t) => KR('cum', t - 1) + '+' + KR('fcf', t), cum, { level: 1, opening: { formula: '0', value: 0 } });
    const pbV = cum.map((c, t) => (t >= 1 && cum[t - 1] < 0 && c >= 0 ? (t - 1) + (-cum[t - 1] / o.projectFCF[t]) : ''));
    B.row(K, 'pb', 'Payback marker', (t) => 'IF(AND(' + KR('cum', t - 1) + '<0,' + KR('cum', t) + '>=0),' + t_(K, t) + '-1+(-' + KR('cum', t - 1) + ')/' + KR('fcf', t) + ',"")', pbV, { level: 1, fmt: '0.00' });
    const cashRange = B.range('cash', 'KPIs');
    const rwV = [''];
    for (let t = 1; t <= N; t++) {
      const prevNeg = o.cash.slice(1, t).some((x) => x < 0);
      if (o.cash[t] < 0 && !prevNeg) { const st = o.cash[t - 1]; rwV[t] = st <= 0 ? 12 * (t - 1) : 12 * (t - 1) + 12 * st / (st - o.cash[t]); } else rwV[t] = '';
    }
    B.row(K, 'rw', 'Runway marker (months)', (t) => {
      const prev = t === 1 ? '0' : 'COUNTIF(' + q('Cash flow') + '!$D$' + B.reg.cash.row + ':' + YC(t - 1) + '$' + B.reg.cash.row + ',"<0")';
      const c = B.ref('cash', t, 'KPIs'), st = B.ref('cash', t - 1, 'KPIs');
      return 'IF(AND(' + c + '<0,' + prev + '=0),IF(' + st + '<=0,12*(' + t_(K, t) + '-1),12*(' + t_(K, t) + '-1)+12*' + st + '/(' + st + '-' + c + ')),"")';
    }, rwV, { level: 1, fmt: FMT.months });
    B.blank(K);
    B.section(K, 'Headline ratios');
    const k = m.kpis;
    const na = (x) => (x === null || x === undefined ? 'n/a' : x);
    B.scalar(K, 'steady', 'Representative year (after ramp-up)', 'MIN(' + N + ',OpsStart+MAX(RampLen-1,IF(OR(RevenueMode="subscription",RevenueMode="fintech"),4,0)))', k.steadyYear, FMT.int);
    const at = (key) => 'INDEX(' + B.range(key, 'KPIs') + ',' + KR('steady', 'C') + ')';
    B.scalar(K, 'gm', 'Gross margin', 'IF(' + at('revenue') + '>0,' + at('gross') + '/' + at('revenue') + ',"n/a")', na(k.grossMargin), FMT.frac);
    B.scalar(K, 'em', 'EBITDA margin', 'IF(' + at('revenue') + '>0,' + at('ebitda') + '/' + at('revenue') + ',"n/a")', na(k.ebitdaMargin), FMT.frac);
    B.scalar(K, 'dscrMin', 'Lowest DSCR', 'IF(COUNT(' + B.range('dscr', 'KPIs') + ')=0,"n/a",MIN(' + B.range('dscr', 'KPIs') + '))', na(k.dscrMin), FMT.ratio);
    B.scalar(K, 'dscrAvg', 'Average DSCR', 'IF(COUNT(' + B.range('dscr', 'KPIs') + ')=0,"n/a",AVERAGE(' + B.range('dscr', 'KPIs') + '))', na(k.dscrAvg), FMT.ratio);
    if (loanCfg.length) {
      const frs = loanCfg.map((lc) => B.ref(lc.k + 'fr', 'C', 'KPIs')).join(','), lasts = loanCfg.map((lc) => B.ref(lc.k + 'last', 'C', 'KPIs')).join(',');
      const Rv = Math.min(...m.loans.map((s) => s.firstRepay)), Lv = Math.max(...m.loans.map((s) => s.last));
      B.scalar(K, 'llR', 'LLCR measured from year', 'MIN(' + frs + ')', Rv, FMT.int, { level: 1 });
      B.scalar(K, 'llL', 'Final loan year', 'MAX(' + lasts + ')', Lv, FMT.int, { level: 1 });
      const owedF = loanCfg.map((lc) => '(IF(' + KR('llR', 'C') + '>1,INDEX(' + B.range(lc.k + 'Lclose', 'KPIs') + ',' + KR('llR', 'C') + '-1),' + B.ref(lc.k + 'Lclose', 'C', 'KPIs') + ')+INDEX(' + B.range(lc.k + 'Ldraw', 'KPIs') + ',' + KR('llR', 'C') + '))');
      const owedV = m.loans.reduce((s2, l) => s2 + l.local.closing[Rv - 1] + l.local.draw[Rv], 0);
      B.scalar(K, 'llOwed', 'Debt outstanding at that point', owedF.join('+'), owedV, FMT.money, { level: 1 });
      const wrF = '(' + loanCfg.map((lc, i) => lc.k + 'Rate/100*' + owedF[i]).join('+') + ')/MAX(' + KR('llOwed', 'C') + ',0.000000001)';
      const wrV = m.loans.reduce((s2, l) => s2 + l.rate * (l.local.closing[Rv - 1] + l.local.draw[Rv]), 0) / (owedV || 1);
      B.scalar(K, 'llRate', 'Average loan interest rate', wrF, wrV, FMT.frac, { level: 1 });
      const yr = q('KPIs') + '!$D$' + K.tRow + ':$' + YC(N) + '$' + K.tRow;
      B.scalar(K, 'llcr', 'LLCR', 'IF(' + KR('llOwed', 'C') + '>0.000000001,SUMPRODUCT((' + yr + '>=' + KR('llR', 'C') + ')*(' + yr + '<=' + KR('llL', 'C') + ')*' + B.range('cfads', 'KPIs') + '/(1+' + KR('llRate', 'C') + ')^(' + yr + '-' + KR('llR', 'C') + '+1))/' + KR('llOwed', 'C') + ',"n/a")', na(k.llcr), FMT.ratio);
    }
    B.scalar(K, 'pirr', 'Project IRR', irrF(B.range('fcf', 'KPIs')), na(k.projectIRR), FMT.frac);
    B.scalar(K, 'eirr', 'Equity IRR', irrF(B.range('fcfe', 'KPIs')), na(k.equityIRR), FMT.frac);
    B.scalar(K, 'npv', 'NPV at the discount rate', 'NPV(DiscountRate/100,' + B.range('fcf', 'KPIs') + ')', k.npv, FMT.money);
    B.scalar(K, 'payback', 'Payback (years)', 'IF(COUNT(' + B.range('pb', 'KPIs') + ')=0,"n/a",MIN(' + B.range('pb', 'KPIs') + '))', na(k.paybackYears), '0.0');
    B.scalar(K, 'be', 'Break-even sales (representative year)', 'IF(AND(' + at('revenue') + '>0,' + at('pVar') + '<' + at('revenue') + '),' + at('pFix') + '/(1-' + at('pVar') + '/' + at('revenue') + '),"n/a")', na(k.breakEvenRevenue), FMT.money);
    B.scalar(K, 'mos', 'Margin of safety', 'IF(ISNUMBER(' + KR('be', 'C') + '),1-' + KR('be', 'C') + '/' + at('revenue') + ',"n/a")', na(k.marginOfSafety), FMT.frac);
    B.scalar(K, 'gear', 'Gearing (debt share of funding)', B.ref('gearing', 'C', 'KPIs'), na(k.gearing), FMT.frac, { kind: 'link' });
    B.scalar(K, 'runway', 'Cash runway (months)', 'IF(COUNT(' + B.range('rw', 'KPIs') + ')=0,"Cash does not run out",MIN(' + B.range('rw', 'KPIs') + '))', k.runwayMonths === null ? 'Cash does not run out' : k.runwayMonths, FMT.months);
    B.scalar(K, 'lowCash', 'Lowest cash balance', 'MIN(' + cashRange + ')', k.lowestCash, FMT.money);
    B.scalar(K, 'totRev', 'Total sales, all years', 'SUM(' + B.range('revenue', 'KPIs') + ')', k.totalRevenue, FMT.money);
    B.scalar(K, 'totCad', 'Total cash left after debt service', 'SUM(' + B.range('cad', 'KPIs') + ')', k.totalCashAfterDebt, FMT.money);
    B.scalar(K, 'maxDS', 'Largest yearly loan payment', 'MAX(0,MAX(' + B.range('kDS', 'KPIs') + '))', k.largestDebtService, FMT.money);
    const mxv = Math.max(0, ...o.debtService.slice(1));
    B.row(K, 'dsMark', 'Largest payment marker', (t) => 'IF(AND(' + KR('maxDS', 'C') + '>0,' + KR('kDS', t) + '>=' + KR('maxDS', 'C') + '*(1-0.000000001)),' + t_(K, t) + ',"")', o.debtService.map((x, t) => (mxv > 0 && x >= mxv * (1 - 1e-9) ? t : '')), { level: 1, fmt: FMT.int });
    B.scalar(K, 'maxDSy', 'Year of largest loan payment', 'IF(' + KR('maxDS', 'C') + '>0,ModelStartYear+MIN(' + B.range('dsMark', 'KPIs') + ')-1,"n/a")', k.largestDebtService > 0 ? (input.timeline.start_year || 2027) + k.largestDebtServiceYear - 1 : 'n/a', FMT.year);
    B.scalar(K, 'paidOff', 'Loans paid off by', loanCfg.length ? 'ModelStartYear+MAX(' + loanCfg.map((lc) => B.ref(lc.k + 'last', 'C', 'KPIs')).join(',') + ')-1' : '"No loan"', loanCfg.length ? (input.timeline.start_year || 2027) + k.loanPaidOffYear - 1 : 'No loan', FMT.year);

    /* ================================================================ QUARTERLY */
    const Q = WS.Quarterly;
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((c, i) => { Q.getColumn(i + 1).width = i === 0 ? 14 : 16; });
    Q.nextRow = 4;
    const qh = Q.nextRow++;
    ['Quarter', 'Model year', 'Sales', 'Running costs', 'EBITDA', 'Debt service', 'Net cash flow', 'Closing cash'].forEach((h, i) => { const c = Q.getCell(qh, i + 1); c.value = h; c.font = { bold: true, color: { argb: HEAD_TEXT }, name: 'Arial', size: 9 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }; });
    let prevClose = null;
    m.quarterly.forEach((qq, i) => {
      const r = Q.nextRow++;
      const firstQ = qh + 1;
      B.f(Q, 'B' + r, 'INT((ROW()-' + firstQ + ')/4)+1', qq.year, FMT.int);
      B.f(Q, 'A' + r, 'ModelStartYear+B' + r + '-1&" Q"&(MOD(ROW()-' + firstQ + ',4)+1)', qq.label, null);
      const yr = 'B' + r;
      const pick = (key) => 'INDEX(' + B.range(key, 'Quarterly') + ',' + yr + ')/4';
      B.f(Q, 'C' + r, pick('revenue'), qq.revenue, FMT.money);
      B.f(Q, 'D' + r, pick('totalCost'), qq.costs, FMT.money);
      B.f(Q, 'E' + r, pick('ebitda'), qq.ebitda, FMT.money);
      B.f(Q, 'F' + r, pick('ds'), qq.debtService, FMT.money);
      B.f(Q, 'G' + r, pick('net'), qq.netCash, FMT.money);
      B.f(Q, 'H' + r, (prevClose ? prevClose : 'OpeningCash') + '+G' + r, qq.closingCash, FMT.money);
      prevClose = 'H' + r;
      void i;
    });

    /* ================================================================ SENSITIVITY */
    const SS = WS.Sensitivity;
    const scen = [{ id: 'base', label: 'Base case', P: '1', V: '1', O: '1', S: '0', D: 'FXDep', adj: {} }].concat(sens.results.map((r) => {
      const map = {
        price_10: { P: '1-WhatIfPriceSmall/100' }, price_20: { P: '1-WhatIfPriceLarge/100' }, volume_20: { V: '1-WhatIfVolume/100' },
        opex_15: { O: '1+WhatIfOpex/100' }, delay_1: { S: 'WhatIfDelay' }, fx: { D: 'WhatIfFX' },
      }[r.id] || {};
      return Object.assign({ id: r.id, label: r.label, P: '1', V: '1', O: '1', S: '0', D: 'FXDep', adj: r.adj }, map);
    }));
    const summaryRow = SS.nextRow; SS.nextRow += scen.length + 4; // table filled after blocks
    const results = {};
    scen.forEach((sc) => {
      const pre = 's_' + sc.id + '_';
      const sv = ctx.engine.scenario(input, m, sc.adj);
      B.section(SS, sc.label);
      B.scalar(SS, pre + 'P', 'Price factor', sc.P, sc.adj.price || 1, '0.00', { level: 1 });
      B.scalar(SS, pre + 'V', 'Volume factor', sc.V, sc.adj.volume || 1, '0.00', { level: 1 });
      B.scalar(SS, pre + 'O', 'Running cost factor', sc.O, sc.adj.opex || 1, '0.00', { level: 1 });
      B.scalar(SS, pre + 'S', 'Delay (years)', sc.S, sc.adj.delay_years || 0, FMT.int, { level: 1 });
      B.scalar(SS, pre + 'D', 'Local currency weakening a year (%)', sc.D, sc.adj.fx_depreciation_pct ?? (input.fx_depreciation_pct || 0), '0.0', { level: 1 });
      const S_ = (x) => B.ref(pre + x, 'C', 'Sensitivity');
      const sh = (key, t, g) => 'IF(' + t_(SS, t) + '-' + S_('S') + '>=1,INDEX(' + B.range(key, 'Sensitivity') + ',' + t_(SS, t) + '-' + S_('S') + ')*(1+' + g + '/100)^' + S_('S') + ',0)';
      const SR = (key, t) => B.ref(pre + key, t, 'Sensitivity');
      // cost rows for this scenario
      const vS = new Array(N + 1).fill(0), fS = new Array(N + 1).fill(0);
      const priceGf = 'PriceGrowth', infF = 'Inflation';
      // values: recompute groups like the engine
      const shiftV = (row, g, s) => row.map((x, t) => (t === 0 ? 0 : s ? (t - s >= 1 ? row[t - s] * Math.pow(1 + g, s) : 0) : row[t]));
      const s = sc.adj.delay_years || 0, P = sc.adj.price || 1, V = sc.adj.volume || 1, O = sc.adj.opex || 1;
      const gv = { gA: grpVals(groups.A), gB: grpVals(groups.B), gC: grpVals(groups.Cg), gD: grpVals(groups.D) };
      for (let t = 1; t <= N; t++) {
        vS[t] = (shiftV(gv.gA, pg, s)[t] * P * V + shiftV(gv.gB, pg, s)[t] * V + shiftV(gv.gC, inf, s)[t] * V) * O;
        fS[t] = shiftV(gv.gD, inf, s)[t] * O;
      }
      B.row(SS, pre + 'rev', 'Sales', (t) => sh('revenue', t, priceGf) + '*' + S_('P') + '*' + S_('V'), sv.revenue, { level: 1 });
      B.row(SS, pre + 'var', 'Variable costs', (t) => '(' + sh('gA', t, priceGf) + '*' + S_('P') + '*' + S_('V') + '+' + sh('gB', t, priceGf) + '*' + S_('V') + '+' + sh('gC', t, infF) + '*' + S_('V') + ')*' + S_('O'), vS, { level: 1 });
      B.row(SS, pre + 'fix', 'Fixed costs', (t) => sh('gD', t, infF) + '*' + S_('O'), fS, { level: 1 });
      B.row(SS, pre + 'ebitda', 'EBITDA', (t) => SR('rev', t) + '-' + SR('var', t) + '-' + SR('fix', t), sv.ebitda, { level: 1 });
      // loans under this scenario's currency path
      const idx = (lc, t) => 'IF(' + lc.k + 'Foreign=1,(1+' + S_('D') + '/100)^(' + t_(SS, t) + '-1),1)';
      const lsum = (src, t) => (loanCfg.length ? loanCfg.map((lc) => B.ref(lc.k + src, t, 'Sensitivity') + '*' + lc.k + 'FXRate*' + idx(lc, t)).join('+') : '0');
      const d = (sc.adj.fx_depreciation_pct ?? (input.fx_depreciation_pct || 0)) / 100;
      const lv = (src) => { const a = new Array(N + 1).fill(0); m.loans.forEach((l) => { for (let t = 1; t <= N; t++) a[t] += l[src][t] * l.fxRate * (l.foreign ? Math.pow(1 + d, t - 1) : 1); }); return a; };
      B.row(SS, pre + 'ip', 'Interest paid', (t) => lsum('ip', t), lv('interestPaid'), { level: 1 });
      B.row(SS, pre + 'cap', 'Interest added to loans', (t) => lsum('cap', t), lv('capitalised'), { level: 1 });
      B.row(SS, pre + 'prin', 'Principal repaid', (t) => lsum('prin', t), lv('principal'), { level: 1 });
      B.row(SS, pre + 'draw', 'Loan drawdowns', (t) => lsum('draw', t), lv('draw'), { level: 1 });
      B.row(SS, pre + 'fee', 'Loan fees', (t) => lsum('fee', t), lv('fee'), { level: 1 });
      const fxl = new Array(N + 1).fill(0);
      m.loans.forEach((l) => { for (let t = 2; t <= N; t++) if (l.foreign) fxl[t] += l.closing[t - 1] * l.fxRate * (Math.pow(1 + d, t - 1) - Math.pow(1 + d, t - 2)); });
      B.row(SS, pre + 'fx', 'Exchange losses', (t) => (t < 2 || !loanCfg.length ? '0' : loanCfg.map((lc) => B.ref(lc.k + 'close', t - 1, 'Sensitivity') + '*' + lc.k + 'FXRate*(' + idx(lc, t) + '-' + idx(lc, t - 1) + ')').join('+')), fxl, { level: 1 });
      const pbtV = new Array(N + 1).fill(0);
      for (let t = 1; t <= N; t++) pbtV[t] = sv.ebitda[t] - o.dep[t] - lv('interestPaid')[t] - lv('capitalised')[t] - lv('fee')[t] - fxl[t];
      B.row(SS, pre + 'pbt', 'Profit before tax', (t) => SR('ebitda', t) + '-' + B.ref('dep', t, 'Sensitivity') + '-' + SR('ip', t) + '-' + SR('cap', t) + '-' + SR('fee', t) + '-' + SR('fx', t), pbtV, { level: 1 });
      const po = [0], pc = [0];
      for (let t = 1; t <= N; t++) { po[t] = pc[t - 1]; pc[t] = holV[t] ? po[t] : pbtV[t] < 0 ? po[t] - pbtV[t] : po[t] - Math.min(po[t], pbtV[t]); }
      B.reg[pre + 'pc'] = { sheet: 'Sensitivity', row: SS.nextRow + 2 }; // po, tax, pc
      B.row(SS, pre + 'po', 'Tax losses brought forward', (t) => SR('pc', t - 1), po, { level: 1, opening: { formula: '0', value: 0 } });
      B.row(SS, pre + 'tax', 'Tax', (t) => 'IF(' + B.ref('hol', t, 'Sensitivity') + '=1,0,IF(' + SR('pbt', t) + '<0,0,(' + SR('pbt', t) + '-MIN(' + SR('po', t) + ',' + SR('pbt', t) + '))*TaxRate/100))', sv.tax, { level: 1 });
      B.row(SS, pre + 'pc', 'Tax losses carried forward', (t) => 'IF(' + B.ref('hol', t, 'Sensitivity') + '=1,' + SR('po', t) + ',IF(' + SR('pbt', t) + '<0,' + SR('po', t) + '-' + SR('pbt', t) + ',' + SR('po', t) + '-MIN(' + SR('po', t) + ',' + SR('pbt', t) + ')))', pc, { level: 1, opening: { formula: '0', value: 0 } });
      const nwcS = [nwc[0]]; for (let t = 1; t <= N; t++) nwcS[t] = sv.revenue[t] * (wc.receivable_days || 0) / 365 + vS[t] * (wc.inventory_days || 0) / 365 - (vS[t] + fS[t]) * (wc.payable_days || 0) / 365;
      B.row(SS, pre + 'nwc', 'Net working capital', (t) => SR('rev', t) + '*ReceivableDays/365+' + SR('var', t) + '*InventoryDays/365-(' + SR('var', t) + '+' + SR('fix', t) + ')*PayableDays/365', nwcS, { level: 1, opening: { formula: B.ref('nwc', 'C', 'Sensitivity'), value: nwc[0], kind: 'link' } });
      B.row(SS, pre + 'cfads', 'CFADS', (t) => SR('ebitda', t) + '-' + SR('tax', t) + '-(' + SR('nwc', t) + '-' + SR('nwc', t - 1) + ')', sv.cfads, { level: 1 });
      B.row(SS, pre + 'ds', 'Debt service', (t) => SR('ip', t) + '+' + SR('prin', t), sv.debtService, { level: 1 });
      B.row(SS, pre + 'dscr', 'DSCR', (t) => 'IF(AND(' + B.ref('opYear', t, 'Sensitivity') + '-' + S_('S') + '>=1,' + SR('ds', t) + '>0.000000001),' + SR('cfads', t) + '/' + SR('ds', t) + ',"")', sv.dscr.map((x) => (x === null ? '' : x)), { level: 1, fmt: FMT.ratio });
      B.row(SS, pre + 'fcf', 'Project free cash flow', (t) => SR('cfads', t) + '-' + B.ref('capex', t, 'Sensitivity'), sv.fcf, { level: 1 });
      B.row(SS, pre + 'cad', 'Cash left after debt service', (t) => SR('cfads', t) + '-' + SR('ds', t), sv.cashAfterDebt, { level: 1 });
      B.row(SS, pre + 'cash', 'Cash at the end of the year', (t) => SR('cash', t - 1) + '+' + SR('fcf', t) + '+' + B.ref('equityIn', t, 'Sensitivity') + '+' + B.ref('grantIn', t, 'Sensitivity') + '+' + SR('draw', t) + '-' + SR('ip', t) + '-' + SR('fee', t) + '-' + SR('prin', t), sv.cash, { level: 1, opening: { formula: 'OpeningCash', value: sv.cash[0], kind: 'link' } });
      results[sc.id] = { sv, pre };
      B.blank(SS);
    });
    // summary table at the top
    {
      let r = summaryRow;
      const heads = ['What-if', 'NPV', 'Change in NPV', 'Lowest DSCR', 'Lowest cash', 'Cash left after debt, all years', 'Size of change', 'Rank'];
      heads.forEach((h, i) => { const c = SS.getCell(r, i + 1); c.value = h; c.font = { bold: true, name: 'Arial', size: 9, color: { argb: HEAD_TEXT } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }; });
      r++;
      const first = r, lastR = r + scen.length - 1;
      scen.forEach((sc, i) => {
        const pre = results[sc.id].pre, kv = results[sc.id].sv.kpis;
        const rr = r + i;
        SS.getCell('A' + rr).value = sc.label;
        B.f(SS, 'B' + rr, 'NPV(DiscountRate/100,' + B.range(pre + 'fcf', 'Sensitivity') + ')', kv.npv, FMT.money);
        B.f(SS, 'C' + rr, 'B' + rr + '-$B$' + first, kv.npv - results.base.sv.kpis.npv, FMT.money);
        B.f(SS, 'D' + rr, 'IF(COUNT(' + B.range(pre + 'dscr', 'Sensitivity') + ')=0,"n/a",MIN(' + B.range(pre + 'dscr', 'Sensitivity') + '))', kv.dscrMin === null ? 'n/a' : kv.dscrMin, FMT.ratio);
        B.f(SS, 'E' + rr, 'MIN(' + B.range(pre + 'cash', 'Sensitivity') + ')', kv.lowestCash, FMT.money);
        B.f(SS, 'F' + rr, 'SUM(' + B.range(pre + 'cad', 'Sensitivity') + ')', kv.totalCashAfterDebt, FMT.money);
        if (i > 0) {
          B.f(SS, 'G' + rr, 'ROUND(ABS(C' + rr + '),2)', Math.round(Math.abs(kv.npv - results.base.sv.kpis.npv) * 100) / 100, FMT.money);
          // RANK plus a count of equal values above, so ties get distinct ranks in list order
          B.f(SS, 'H' + rr, 'RANK(G' + rr + ',$G$' + (first + 1) + ':$G$' + lastR + ')' + (i > 1 ? '+COUNTIF($G$' + (first + 1) + ':G' + (rr - 1) + ',G' + rr + ')' : ''), sens.ranked.indexOf(sc.id) + 1, FMT.int);
        }
        if (i === 0) B.reg.sensBase = { sheet: 'Sensitivity', row: rr };
      });
      B.reg.sensFirst = { sheet: 'Sensitivity', row: first + 1 }; B.reg.sensLast = { sheet: 'Sensitivity', row: lastR };
      SS.getColumn(1).width = 46;
    }

    /* ================================================================ CHECKS */
    const CH = WS.Checks;
    CH.getColumn(2).width = 12; CH.nextRow = 4;
    const chk = (label, formula, value) => { const r = CH.nextRow++; CH.getCell('A' + r).value = label; B.f(CH, 'B' + r, formula, value, null); return r; };
    const bsAll = 'AND(' + Array.from({ length: N }, (_, i) => 'ABS(' + B.ref('bsDiff', i + 1, 'Checks') + ')<=0.000001*MAX(1,ABS(' + B.ref('assets', i + 1, 'Checks') + '))').join(',') + ')';
    const c1 = chk('Balance sheet balances every year', bsAll, m.checks.balanceSheetBalances);
    const debtAll = loanCfg.length ? 'AND(' + loanCfg.map((lc) => 'ABS(' + B.ref(lc.k + 'close', N, 'Checks') + ')<=0.000001*MAX(1,' + lc.k + 'Amount)').join(',') + ')' : 'TRUE';
    const c2 = chk('Every loan is fully repaid', debtAll, m.checks.debtFullyRepaid);
    const c3 = chk('Sources of funds equal uses of funds', 'ABS(' + B.ref('sources', 'C', 'Checks') + '-' + B.ref('uses', 'C', 'Checks') + ')<0.000001*MAX(1,' + B.ref('sources', 'C', 'Checks') + ')', true);
    const c4 = chk('Funding covers the capex and fees', B.ref('useReserve', 'C', 'Checks') + '>=-0.000001', m.checks.fundingCoversCapex);
    const c5 = chk('Cash never goes below zero (information)', B.ref('lowCash', 'C', 'Checks') + '>=0', m.kpis.lowestCash >= 0);
    B.blank(CH);
    const cAll = chk('All model checks pass', 'AND(B' + c1 + ',B' + c2 + ',B' + c3 + ')', m.checks.balanceSheetBalances && m.checks.debtFullyRepaid);
    void c4; void c5;
    B.reg.allChecks = { sheet: 'Checks', row: cAll };

    /* ================================================================ READINESS */
    const RD = WS.Readiness;
    RD.getColumn(2).width = 12; RD.getColumn(3).width = 12; RD.nextRow = 4;
    const rh = RD.nextRow++;
    ['Item', 'Points', 'Out of'].forEach((h, i) => { const c = RD.getCell(rh, i + 1); c.value = h; c.font = { bold: true, name: 'Arial', size: 9 }; });
    const item = (label, formula, value, max) => { const r = RD.nextRow++; RD.getCell('A' + r).value = label; B.f(RD, 'B' + r, formula, value, FMT.int); RD.getCell('C' + r).value = max; return r; };
    const rItems = ready.items;
    const firstItem = RD.nextRow;
    item('Documents in place', docs.length ? 'ROUND(50*COUNTIF(DocFlags,TRUE)/' + docs.length + ',0)' : '50', rItems[0].points, 50);
    if (loanCfg.length) {
      item('Lowest DSCR at or above target', 'IF(ISNUMBER(' + B.ref('dscrMin', 'C', 'Readiness') + '),IF(' + B.ref('dscrMin', 'C', 'Readiness') + '>=DSCRTarget,20,IF(' + B.ref('dscrMin', 'C', 'Readiness') + '>=1,10,0)),0)', rItems[1].points, 20);
      item('LLCR at or above target', 'IF(ISNUMBER(' + B.ref('llcr', 'C', 'Readiness') + '),IF(' + B.ref('llcr', 'C', 'Readiness') + '>=DSCRTarget,5,0),0)', rItems[2].points, 5);
    } else item('Cash never runs out', 'IF(' + B.ref('lowCash', 'C', 'Readiness') + '>=0,25,0)', rItems[1].points, 25);
    const own = rItems.find((x) => x.label.startsWith('Owners'));
    item('Owners put in at least 20% of funding', 'IF(' + B.ref('srcEq', 'C', 'Readiness') + '/MAX(' + B.ref('sources', 'C', 'Readiness') + ',1)>=0.2,10,IF(' + B.ref('srcEq', 'C', 'Readiness') + '/MAX(' + B.ref('sources', 'C', 'Readiness') + ',1)>=0.1,5,0))', own.points, 10);
    item('Positive NPV', 'IF(' + B.ref('npv', 'C', 'Readiness') + '>0,10,0)', rItems.find((x) => x.label === 'Positive NPV').points, 10);
    const limitF = loanCfg.length ? 'MAX(' + loanCfg.map((lc) => B.ref(lc.k + 'last', 'C', 'Readiness')).join(',') + ')' : '10';
    item('Pays back within the loan term (or 10 years)', 'IF(ISNUMBER(' + B.ref('payback', 'C', 'Readiness') + '),IF(' + B.ref('payback', 'C', 'Readiness') + '<=' + limitF + ',5,0),0)', rItems[rItems.length - 1].points, 5);
    const lastItem = RD.nextRow - 1;
    const sr = RD.nextRow++;
    RD.getCell('A' + sr).value = 'Readiness score'; RD.getCell('A' + sr).font = { bold: true, name: 'Arial' };
    B.f(RD, 'B' + sr, 'SUM(B' + firstItem + ':B' + lastItem + ')', ready.score, FMT.int);
    RD.getCell('C' + sr).value = 100;
    B.reg.readyScore = { sheet: 'Readiness', row: sr };
    B.blank(RD);
    const nh = RD.nextRow++; RD.getCell('A' + nh).value = 'Documents usually needed for this funding mix'; RD.getCell('A' + nh).font = { bold: true, name: 'Arial', size: 12 };
    docs.forEach((d, i) => { const r = RD.nextRow++; RD.getCell('A' + r).value = d; B.f(RD, 'B' + r, 'IF(INDEX(DocFlags,' + (i + 1) + '),"In place","Still needed")', input.documents && input.documents[d] ? 'In place' : 'Still needed', null); });

    /* ================================================================ SUMMARY */
    const SM = WS.Summary;
    SM.getColumn(2).width = 20; SM.getColumn(3).width = 60; SM.nextRow = 4;
    const sline = (label, formula, value, fmt, note) => { const r = SM.nextRow++; SM.getCell('A' + r).value = label; B.f(SM, 'B' + r, formula, value, fmt, 'link'); if (note) { SM.getCell('C' + r).value = note; SM.getCell('C' + r).font = { name: 'Arial', size: 9, color: { argb: MUTED } }; } return r; };
    const disc = SM.nextRow++;
    SM.getCell('A' + disc).value = 'Illustrative model for portfolio purposes. Not financial advice.';
    SM.getCell('A' + disc).font = { bold: true, name: 'Arial', color: { argb: 'FFA2382B' } };
    B.blank(SM);
    const sh2 = SM.nextRow++; SM.getCell('A' + sh2).value = input.name || 'Project'; SM.getCell('A' + sh2).font = { name: 'Arial', size: 14, bold: true };
    B.blank(SM);
    B.section(SM, 'Headline results');
    const stY = k.steadyYear;
    sline('Yearly sales in the representative year', 'INDEX(' + B.range('revenue', 'Summary') + ',' + B.ref('steady', 'C', 'Summary') + ')', o.revenue[stY], FMT.money, 'After ramp-up');
    sline('Yearly running costs in that year', 'INDEX(' + B.range('totalCost', 'Summary') + ',' + B.ref('steady', 'C', 'Summary') + ')', o.varCost[stY] + o.fixCost[stY], FMT.money);
    sline('EBITDA margin', B.ref('em', 'C', 'Summary'), na(k.ebitdaMargin), FMT.frac);
    sline('Largest yearly loan payment', B.ref('maxDS', 'C', 'Summary'), k.largestDebtService, FMT.money, 'Including interest');
    sline('Loans paid off by', B.ref('paidOff', 'C', 'Summary'), loanCfg.length ? (input.timeline.start_year || 2027) + k.loanPaidOffYear - 1 : 'No loan', FMT.year);
    sline('Lowest DSCR', B.ref('dscrMin', 'C', 'Summary'), na(k.dscrMin), FMT.ratio, 'How many times spare cash covers loan payments. Lenders usually want at least 1.3.');
    sline('LLCR', loanCfg.length ? B.ref('llcr', 'C', 'Summary') : '"n/a"', loanCfg.length ? na(k.llcr) : 'n/a', FMT.ratio);
    sline('Project IRR', B.ref('pirr', 'C', 'Summary'), na(k.projectIRR), FMT.frac, 'Yearly return on all the money put in, before financing');
    sline('Equity IRR', B.ref('eirr', 'C', 'Summary'), na(k.equityIRR), FMT.frac);
    sline('NPV', B.ref('npv', 'C', 'Summary'), k.npv, FMT.money, 'Value today of future cash, at the discount rate on Inputs');
    sline('Payback (years)', B.ref('payback', 'C', 'Summary'), na(k.paybackYears), '0.0');
    sline('Gearing', B.ref('gear', 'C', 'Summary'), na(k.gearing), FMT.frac);
    sline('Lowest cash balance', B.ref('lowCash', 'C', 'Summary'), k.lowestCash, FMT.money, 'Negative means extra funding is needed');
    sline('Readiness score (out of 100)', q('Readiness') + '!B' + B.reg.readyScore.row, ready.score, FMT.int);
    sline('All model checks pass', q('Checks') + '!B' + B.reg.allChecks.row, m.checks.balanceSheetBalances && m.checks.debtFullyRepaid, null);
    B.blank(SM);
    B.section(SM, 'Financing');
    sline('Equity', B.ref('srcEq', 'C', 'Summary'), sumV(o.equityIn), FMT.money);
    sline('Grants', B.ref('srcGr', 'C', 'Summary'), sumV(o.grantIn), FMT.money);
    sline('Loans', B.ref('srcDebt', 'C', 'Summary'), sumV(o.draw), FMT.money);
    sline('Total capex', B.ref('totalCapex', 'C', 'Summary'), m.uses.capex, FMT.money);
    B.blank(SM);
    B.section(SM, 'Key risks: what moves the result most');
    const ranked = sens.ranked.slice(0, 3);
    ranked.forEach((id, i) => {
      const r = SM.nextRow++;
      const lab = q('Sensitivity') + '!$A$' + B.reg.sensFirst.row + ':$A$' + B.reg.sensLast.row;
      const rk = q('Sensitivity') + '!$H$' + B.reg.sensFirst.row + ':$H$' + B.reg.sensLast.row;
      const chg = q('Sensitivity') + '!$C$' + B.reg.sensFirst.row + ':$C$' + B.reg.sensLast.row;
      const res = sens.results.find((x) => x.id === id);
      B.f(SM, 'A' + r, 'INDEX(' + lab + ',MATCH(' + (i + 1) + ',' + rk + ',0))', res.label, null);
      B.f(SM, 'B' + r, 'INDEX(' + chg + ',MATCH(' + (i + 1) + ',' + rk + ',0))', res.delta.npv, FMT.money);
      SM.getCell('C' + r).value = 'Change in NPV';
    });

    /* ================================================================ COVER */
    const CV = WS.Cover;
    CV.getColumn(2).width = 90; CV.nextRow = 3;
    const cv = (a, b, bold) => { const r = CV.nextRow++; CV.getCell('A' + r).value = a; CV.getCell('B' + r).value = b; if (bold) CV.getCell('A' + r).font = { bold: true, name: 'Arial' }; CV.getCell('B' + r).alignment = { wrapText: true, vertical: 'top' }; };
    cv('Project', input.name || '', true);
    cv('Sector', input.sector || '');
    cv('Country', input.country || '');
    cv('Currency', cur);
    cv('Prepared with', 'Tenor, a portfolio prototype by Khadijat Othman. Illustrative model for portfolio purposes. Not financial advice.');
    CV.nextRow++;
    cv('How to use it', 'Change blue cells on the Inputs sheet. Every other sheet recalculates. Check the Checks sheet shows TRUE after any change.', true);
    cv('Colour key', 'Blue text: inputs. Black text: calculations. Green text: links to another sheet.');
    CV.nextRow++;
    const mh = CV.nextRow++; CV.getCell('A' + mh).value = 'Model map'; CV.getCell('A' + mh).font = { name: 'Arial', size: 13, bold: true };
    const MAP = {
      Cover: 'This page.', Summary: 'Headline results, financing, readiness and the biggest risks.', Inputs: 'Every assumption, with where it came from. The only place to type numbers.',
      Revenue: 'How sales are built up each year.', CAPEX: 'Spending on assets and how it wears out (depreciation).', OPEX: 'Running costs, line by line.',
      'Working capital': 'Cash tied up in unpaid bills and stock.', Financing: 'Where the money comes from and what it pays for.', Loans: 'Repayment schedule for each loan, in loan currency and in ' + cur + '.',
      Equity: 'Investor money and ownership after each round.', 'P&L': 'Profit and loss.', 'Cash flow': 'Cash in and out each year.', 'Balance sheet': 'What the project owns and owes.',
      Quarterly: 'First three years split into quarters.', KPIs: 'DSCR, LLCR, IRR, NPV, payback, break-even, gearing and runway.', Sensitivity: 'What happens if prices fall, volumes drop, costs rise, the start slips or the currency weakens.',
      Checks: 'TRUE or FALSE checks that the model holds together.', Readiness: 'Readiness score and the documents still needed.', Sources: 'Similar projects and the public sources behind the numbers.',
    };
    order.forEach((n) => cv(n, MAP[n]));

    /* ================================================================ SOURCES */
    const SO = WS.Sources;
    SO.getColumn(2).width = 22; SO.getColumn(3).width = 14; SO.getColumn(4).width = 60; SO.getColumn(5).width = 50; SO.nextRow = 3;
    const sec = (t) => { const r = SO.nextRow++; SO.getCell('A' + r).value = t; SO.getCell('A' + r).font = { name: 'Arial', size: 13, bold: true }; };
    if (ctx.similar && ctx.similar.length) {
      sec('Similar projects in the Tenor library');
      ctx.similar.forEach((s2) => { const r = SO.nextRow++; SO.getCell('A' + r).value = s2.name; SO.getCell('D' + r).value = s2.why || ''; });
      SO.nextRow++;
    }
    if (caseRecord && caseRecord.sources) {
      sec('Sources for ' + caseRecord.name);
      const h = SO.nextRow++; ['Title', 'Publisher', 'Date', 'Link', 'What it supports'].forEach((x, i) => { SO.getCell(h, i + 1).value = x; SO.getCell(h, i + 1).font = { bold: true, name: 'Arial', size: 9 }; });
      caseRecord.sources.forEach((s2) => {
        const r = SO.nextRow++;
        SO.getCell('A' + r).value = s2.title; SO.getCell('B' + r).value = s2.publisher; SO.getCell('C' + r).value = s2.date;
        SO.getCell('D' + r).value = { text: s2.url, hyperlink: s2.url }; SO.getCell('D' + r).font = { color: { argb: 'FF0B3D91' }, underline: true, name: 'Arial', size: 9 };
        SO.getCell('E' + r).value = s2.supports;
      });
      SO.nextRow++;
      if (caseRecord.caveats && caseRecord.caveats.length) { sec('Caveats'); caseRecord.caveats.forEach((c2) => { const r = SO.nextRow++; SO.getCell('A' + r).value = c2; }); }
    } else {
      sec('Sources');
      const r = SO.nextRow++; SO.getCell('A' + r).value = 'Your own estimates. Add the source of each number in column H of the Inputs sheet.';
    }

    return B;
  }

  /* ---------------------------------------------------------------- input template */

  function buildTemplate(ExcelJS, ctx) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tenor';
    const ws = wb.addWorksheet('Tenor inputs');
    ws.columns = [{ header: 'Section', key: 'section', width: 16 }, { header: 'Field', key: 'field', width: 46 }, { header: 'Key', key: 'key', width: 26 }, { header: 'Your value', key: 'value', width: 18 }, { header: 'Unit', key: 'unit', width: 22 }, { header: 'Help', key: 'help', width: 60 }];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const tpl = ctx.sectors.sectors.find((s) => s.id === ctx.sector) || ctx.sectors.sectors[0];
    const add = (section, field, key, unit, help, value) => {
      const r = ws.addRow({ section, field, key, value: value ?? null, unit, help });
      r.getCell('value').font = { color: { argb: BLUE } };
      r.getCell('value').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    };
    add('Project', 'Project name', 'name', '', 'What you call the project');
    add('Project', 'Sector', 'sector', '', 'Leave as it is', tpl.id);
    add('Project', 'Where is it based?', 'country', '', 'Town and country');
    add('Project', 'Currency', 'currency', '', 'Three-letter code, for example USD or NGN');
    add('Project', 'Build or set-up period', 'construction_years', 'years', 'Years before sales start. 0 if already trading.');
    tpl.inputs.forEach((i) => add('Numbers', i.simple_label + ' (' + i.label + ')', 'rev.' + i.key, i.unit || '', i.hint || ''));
    tpl.cost_lines.forEach((c) => add('Costs', c.simple_label + ' (' + c.label + ')', 'cost.' + c.key, c.type.startsWith('pct') ? '%' : 'amount', c.type.replace(/_/g, ' ')));
    for (let i = 1; i <= 5; i++) { add('CAPEX', 'Item ' + i + ' description', 'capex.' + i + '.label', '', 'For example: tractors'); add('CAPEX', 'Item ' + i + ' cost', 'capex.' + i + '.amount', 'amount', ''); }
    add('Funding', 'Your own money', 'equity.amount', 'amount', '');
    add('Funding', 'Grant', 'grant.amount', 'amount', '');
    add('Funding', 'Loan amount', 'loan.amount', 'amount', '');
    add('Funding', 'Loan interest rate', 'loan.rate_pct', '%', 'Yearly rate');
    add('Funding', 'Years to repay, including grace', 'loan.tenor_years', 'years', '');
    add('Funding', 'Grace period', 'loan.grace_years', 'years', 'Years before you start repaying the amount borrowed');
    add('Funding', 'Repayment type', 'loan.repayment', '', 'annuity, equal_principal or bullet');
    add('Tax', 'Corporate tax rate', 'tax.rate_pct', '%', '');
    return wb;
  }

  async function parseTemplate(ExcelJS, buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Tenor inputs');
    if (!ws) throw new Error('This does not look like a Tenor input template. The sheet "Tenor inputs" is missing.');
    const out = { fields: {}, rev: {}, cost: {}, capex: [], equity: null, grant: null, loan: {}, tax: {} };
    const hdr = ws.getRow(1).values.map((v) => String(v || '').toLowerCase());
    const kCol = hdr.indexOf('key'), vCol = hdr.indexOf('your value');
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const key = String(row.getCell(kCol).value || '').trim();
      let v = row.getCell(vCol).value;
      if (v && typeof v === 'object' && 'result' in v) v = v.result;
      if (key === '' || v === null || v === undefined || v === '') return;
      const parts = key.split('.');
      if (parts[0] === 'rev') out.rev[parts[1]] = v;
      else if (parts[0] === 'cost') out.cost[parts[1]] = v;
      else if (parts[0] === 'capex') { const i = Number(parts[1]) - 1; out.capex[i] = out.capex[i] || {}; out.capex[i][parts[2]] = v; }
      else if (parts[0] === 'equity') out.equity = v;
      else if (parts[0] === 'grant') out.grant = v;
      else if (parts[0] === 'loan') out.loan[parts[1]] = v;
      else if (parts[0] === 'tax') out.tax[parts[1]] = v;
      else out.fields[key] = v;
    });
    out.capex = out.capex.filter(Boolean);
    return out;
  }

  const api = { buildModel, buildTemplate, parseTemplate, colName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorXlsx = api;
})(typeof self !== 'undefined' ? self : this);
