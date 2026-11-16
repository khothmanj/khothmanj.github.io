/*
 * Tenor presentation (PptxGenJS 4.0.1). A 12-slide deck with native, editable charts and speaker notes.
 * buildDeck(PptxGenJS, ctx) -> pptx instance. ctx: { input, model, sens, ready, caseRecord, sectors, narrative, audience }
 */
(function (root) {
  'use strict';

  const C = { dark: '0B1220', panel: '1A2233', paper: 'FFFFFF', ink: '0B1220', muted: '5B6475', mint: '8EA2FF', green: '3550FC', line: 'E3E6EC', sage: 'A1A9B8', slate: 'CBD2DE', red: 'C2352B', amber: '9A5B00' }; // green = brand blue, kept for compatibility
  const SERIF = 'Arial', SANS = 'Arial';
  // right-align a column only when its body cells are numbers, money, ratios or percentages
  const NUMERIC = /^(n\/a|[A-Z]{3} [\u2212-]?[\d.,]+(m|bn)?|[\u2212-]?[\d.,]+(x|%| years| months)?)$/;
  const looksNumeric = (v, rows, j) => rows.slice(1).every((r) => NUMERIC.test(String(r[j]).trim()));

  function buildDeck(PptxGenJS, ctx) {
    const { input, model: m, sens, ready, caseRecord, sectors } = ctx;
    const N = ctx.narrative, cur = input.currency || '', k = m.kpis;
    const inv = ctx.audience === 'investor';
    const money = (x, o) => N.money(x, cur, o);
    const sector = sectors && sectors.sectors.find((s) => s.id === input.sector);
    const name = input.name || (caseRecord && caseRecord.name) || 'Project';
    const hasLoan = m.loans.length > 0;
    const isInvestorFunded = (input.financing.equity || []).some((e) => e.pre_money > 0 || e.provider_type === 'venture' || e.provider_type === 'angel_seed');

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
    pptx.author = 'Tenor'; pptx.title = name;
    pptx.defineSlideMaster({
      title: 'TENOR', background: { color: C.paper },
      objects: [
        { line: { x: 0.6, y: 6.95, w: 12.13, h: 0, line: { color: C.line, width: 0.75 } } },
        { text: { text: name + ' · Prepared with Tenor · Illustrative, not financial advice', options: { x: 0.6, y: 7.0, w: 10, h: 0.3, fontFace: SANS, fontSize: 9, color: C.muted } } },
      ],
      slideNumber: { x: 12.3, y: 7.0, w: 0.5, h: 0.3, fontFace: SANS, fontSize: 9, color: C.muted },
    });
    const title = (s, t, sub) => {
      s.addText(t, { x: 0.6, y: 0.45, w: 12.1, h: 0.9, fontFace: SERIF, fontSize: 32, bold: true, color: C.ink });
      if (sub) s.addText(sub, { x: 0.6, y: 1.3, w: 12.1, h: 0.5, fontFace: SANS, fontSize: 15, color: C.muted });
    };
    const bullets = (s, items, o = {}) => s.addText(items.map((t) => ({ text: t, options: { bullet: { indent: 18 }, paraSpaceAfter: 10 } })), Object.assign({ x: 0.6, y: 2.0, w: 6.2, h: 4.6, fontFace: SANS, fontSize: 16, color: C.ink, valign: 'top' }, o));
    const bigNumber = (s, x, y, label, value, sub) => {
      s.addText(label, { x, y, w: 3.8, h: 0.35, fontFace: SANS, fontSize: 12, color: C.muted });
      s.addText(value, { x, y: y + 0.32, w: 3.8, h: 0.75, fontFace: SERIF, fontSize: 30, bold: true, color: C.ink });
      if (sub) s.addText(sub, { x, y: y + 1.05, w: 3.8, h: 0.35, fontFace: SANS, fontSize: 11, color: C.muted });
    };
    const tbl = (s, rows, o = {}) => s.addTable(rows.map((r, i) => r.map((v, j) => ({ text: String(v), options: { bold: i === 0, color: i === 0 ? 'FFFFFF' : C.ink, fill: { color: i === 0 ? C.panel : 'FFFFFF' }, align: j > 0 && looksNumeric(r[j], rows, j) ? 'right' : 'left' } }))),
      Object.assign({ x: 0.6, y: 2.0, w: 12.1, fontFace: SANS, fontSize: 12, border: { type: 'solid', color: C.line, pt: 0.5 }, rowH: 0.36 }, o));
    const yrs = m.years;
    const showN = Math.min(m.N, 5);
    const ops = Math.min(m.N, m.opsStart);
    const cols = Array.from({ length: showN }, (_, i) => ops + i).filter((t) => t <= m.N);
    const sum = N.summary(ctx, inv ? 'investor' : 'simple');

    /* 1 Title */
    let s = pptx.addSlide();
    s.background = { color: C.dark };
    s.addText(name, { x: 0.8, y: 2.2, w: 11.5, h: 1.4, fontFace: SERIF, fontSize: 48, bold: true, color: 'EEF0EA' });
    s.addText([sector ? sector.label : input.sector, input.country].filter(Boolean).join(' · '), { x: 0.8, y: 3.6, w: 11.5, h: 0.5, fontFace: SANS, fontSize: 20, color: C.mint });
    s.addText(inv ? 'Investment and credit overview' : 'Financial plan', { x: 0.8, y: 4.2, w: 11.5, h: 0.5, fontFace: SANS, fontSize: 18, color: C.sage });
    s.addText('Illustrative model for portfolio purposes. Not financial advice.', { x: 0.8, y: 6.6, w: 11.5, h: 0.4, fontFace: SANS, fontSize: 11, color: C.sage });
    s.addNotes('Introduce the project in one sentence: what it does, where, and what you are asking for. Every number in this deck comes from the Tenor model and its Excel file.');

    /* 2 The opportunity */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'The opportunity', caseRecord ? caseRecord.sub_sector : (sector && sector.label));
    bullets(s, [(caseRecord && caseRecord.concept) || input.description || 'Describe the gap this project fills.', 'Sales of about ' + money(m.out.revenue[k.steadyYear]) + ' a year once running at full size.', 'Value today of the project\'s future cash: ' + money(k.npv) + '.'], { w: 7.4 });
    bigNumber(s, 8.6, 2.1, 'Yearly sales after ramp-up', money(m.out.revenue[k.steadyYear]), String(yrs[k.steadyYear - 1]));
    bigNumber(s, 8.6, 3.8, inv ? 'EBITDA margin' : 'Left after running costs', N.pct(k.ebitdaMargin), 'Of every unit of sales');
    s.addNotes('Explain the problem the project solves and who buys from it. Sales figure is the representative year after ramp-up.');

    /* 3 What we'll do */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'What we will do', m.constructionYears ? m.constructionYears + ' year' + (m.constructionYears > 1 ? 's' : '') + ' to build, then ' + (input.revenue.ramp_up || [1]).length + ' years to reach full output' : 'Already operating, growing from here');
    tbl(s, [['What we will build or buy', 'Cost']].concat(m.capexLines.map((l) => [l.label, money(l.spend.reduce((a, b) => a + b, 0))])).concat([['Total', money(m.uses.capex)]]), { w: 8.5 });
    s.addNotes('Walk through the main things the money pays for, and when.');

    /* 4 How it makes money */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'How it makes money', sector ? sector.revenue_explained : '');
    const inputsTbl = [['Key estimate', 'Value', 'Quality']];
    Object.entries(input.revenue.inputs || {}).filter(([kk, v]) => typeof v === 'number' && !kk.startsWith('cost_')).slice(0, 8).forEach(([kk, v]) => {
      const i = sector && sector.inputs.find((x) => x.key === kk);
      const d = caseRecord && caseRecord.drivers && caseRecord.drivers[kk];
      inputsTbl.push([i ? (inv ? i.label : i.simple_label) : kk.replace(/_/g, ' '), v.toLocaleString('en-GB', { maximumFractionDigits: 2 }) + (i && i.unit ? ' ' + i.unit : ''), d ? d.quality : 'assumed']);
    });
    tbl(s, inputsTbl, { w: 9.5 });
    s.addNotes('These are the estimates that drive sales. Sourced means from a checked public source; assumed means an estimate to confirm.');

    /* 5 What it costs */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'What it costs', 'Running costs in ' + yrs[k.steadyYear - 1]);
    tbl(s, [['Running cost', 'Amount']].concat(m.costLines.map((l) => [l.label, money(l.values[k.steadyYear])])).concat([['Total running costs', money(m.out.varCost[k.steadyYear] + m.out.fixCost[k.steadyYear])]]), { w: 8.5 });
    bigNumber(s, 9.4, 2.1, 'Break-even sales', money(k.breakEvenRevenue), 'Sales needed to cover running costs');
    s.addNotes('Variable costs rise with sales; fixed costs are paid anyway. Break-even is the sales level where income just covers running costs.');

    /* 6 Funding */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'The funding we need', 'Total ' + money(m.funded) + (hasLoan ? ', ' + N.pct(k.gearing, 0) + ' from loans' : ''));
    const sumA = (a) => a.slice(1).reduce((x, y) => x + y, 0);
    tbl(s, [['Source', 'Amount'], ['Own money and investors', money(sumA(m.out.equityIn))], ['Grants', money(sumA(m.out.grantIn))], ['Loans', money(sumA(m.out.draw))]], { w: 5.6 });
    if (hasLoan) tbl(s, [['Loan', 'Rate', 'Years', 'Grace']].concat((input.financing.loans || []).map((l) => [l.label.length > 28 ? l.label.slice(0, 27) + '…' : l.label, (l.rate_pct || 0).toFixed(1) + '%', String(l.tenor_years), String(l.grace_years || 0)])), { x: 6.6, w: 6.1 });
    s.addNotes('Explain why this mix of funding fits the project, and what each funder gets.');

    /* 7 Five-year outlook (native chart) */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'Five-year outlook', 'From the first operating year');
    const labels = cols.map((t) => String(yrs[t - 1]));
    s.addChart(pptx.ChartType.bar, [
      { name: 'Sales', labels, values: cols.map((t) => Math.round(m.out.revenue[t])) },
      { name: 'Running costs', labels, values: cols.map((t) => Math.round(m.out.varCost[t] + m.out.fixCost[t])) },
      { name: 'Cash left after loan payments', labels, values: cols.map((t) => Math.round(m.out.cashAfterDebt[t])) },
    ], { x: 0.6, y: 1.9, w: 12.1, h: 4.8, barDir: 'col', barGrouping: 'clustered', chartColors: [C.green, C.slate, C.mint], showLegend: true, legendPos: 'b', legendFontFace: SANS, legendFontSize: 11,
      valAxisLabelFormatCode: '#,##0', valAxisLabelFontSize: 10, catAxisLabelFontSize: 11, valGridLine: { color: 'E4E7E3', size: 0.5 }, catGridLine: { style: 'none' } });
    s.addNotes('Sales, running costs and the cash left after loan payments for the first five operating years. The chart is editable in PowerPoint.');

    /* 8 Can it repay / returns */
    s = pptx.addSlide({ masterName: 'TENOR' });
    if (hasLoan && !isInvestorFunded) {
      title(s, 'Can it repay?', sum.headline);
      const dy = []; for (let t = 1; t <= m.N; t++) if (m.out.dscr[t] !== null) dy.push(t);
      const target = (input.defaults && input.defaults.dscr_target) || 1.3;
      s.addChart(pptx.ChartType.line, [
        { name: 'DSCR', labels: dy.map((t) => String(yrs[t - 1])), values: dy.map((t) => Math.round(m.out.dscr[t] * 100) / 100) },
        { name: 'Lender minimum', labels: dy.map((t) => String(yrs[t - 1])), values: dy.map(() => target) },
      ], { x: 0.6, y: 1.9, w: 8.2, h: 4.8, chartColors: [C.green, C.red], lineSize: 2, lineDataSymbol: 'none', showLegend: true, legendPos: 'b', valAxisLabelFormatCode: '0.0"x"', valGridLine: { color: 'E4E7E3', size: 0.5 } });
      bigNumber(s, 9.2, 2.1, 'Lowest DSCR', N.ratio(k.dscrMin), 'Lenders usually want 1.3x');
      bigNumber(s, 9.2, 3.8, 'Largest yearly payment', money(k.largestDebtService), k.largestDebtServiceYear ? String(yrs[k.largestDebtServiceYear - 1]) : '');
      s.addNotes('DSCR is how many times the cash the project makes covers the loan payment. ' + sum.paragraphs[0]);
    } else {
      title(s, isInvestorFunded ? 'Returns and runway' : 'Returns', sum.headline);
      bigNumber(s, 0.6, 2.1, 'Project IRR', N.pct(k.projectIRR), 'Yearly return before financing');
      bigNumber(s, 4.6, 2.1, 'Equity IRR', N.pct(k.equityIRR), 'Yearly return to owners');
      bigNumber(s, 8.6, 2.1, 'Payback', N.years(k.paybackYears));
      bigNumber(s, 0.6, 4.2, 'NPV', money(k.npv), 'At ' + N.pct(k.discountRate, 0));
      bigNumber(s, 4.6, 4.2, 'Cash runway', k.runwayMonths === null ? 'Does not run out' : k.runwayMonths.toFixed(0) + ' months');
      if (m.ownership.length > 1) bigNumber(s, 8.6, 4.2, 'Founders after funding', m.ownership[0].pct.toFixed(1) + '%');
      s.addNotes(sum.paragraphs.join(' '));
    }

    /* 9 What could go wrong */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'What could go wrong, and how we have planned for it', 'Ranked by how much each one moves the value of the project');
    const top3 = sens.ranked.slice(0, 3).map((id) => sens.results.find((r) => r.id === id));
    tbl(s, [['What-if', 'Change in value', inv ? 'Lowest DSCR' : 'Lowest loan cover', 'How we reduce it']].concat(top3.map((r) => [inv ? r.label : r.simple, money(r.delta.npv), N.ratio(r.result.dscrMin), N.mitigation(r.id)])), { colW: [2.6, 2.0, 1.8, 5.7], fontSize: 12 });
    s.addNotes('Each what-if keeps the build and the loans the same and changes sales or running costs. Full results are on the Sensitivity sheet of the Excel model.');

    /* 10 Why now, why us */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'Why now and why us');
    const strengths = ready.items.filter((i) => i.ok).map((i) => i.label);
    bullets(s, [(caseRecord && caseRecord.concept) || 'The need this project meets.'].concat(strengths.length ? strengths.map((x) => 'In place: ' + x.toLowerCase()) : ['Readiness score ' + ready.score + ' out of 100.']), { w: 12.1, h: 3.8 });
    s.addText('Add your team\'s experience and any recent market change before sharing.', { x: 0.6, y: 6.1, w: 12.1, h: 0.4, fontFace: SANS, fontSize: 12, italic: true, color: C.muted });
    s.addNotes('Tenor cannot know your team or timing. Add the people and the market moment that make this the right time.');

    /* 11 Next steps */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'Next steps and what we need', 'Readiness score ' + ready.score + ' out of 100');
    bullets(s, (ready.missing.length ? ready.missing.slice(0, 7).map((d) => 'Prepare: ' + d) : ['All standard documents are in place.']).concat(['Funding ask: ' + money(m.funded)]), { w: 12.1 });
    s.addNotes('These are the documents lenders and investors usually ask for with this kind of funding.');

    /* 12 Appendix */
    s = pptx.addSlide({ masterName: 'TENOR' });
    title(s, 'Appendix: key assumptions and sources');
    const ap = [['Assumption', 'Value', 'Quality']];
    Object.entries(input.revenue.inputs || {}).filter(([kk, v]) => typeof v === 'number' && !kk.startsWith('cost_')).slice(0, 7).forEach(([kk, v]) => { const d = caseRecord && caseRecord.drivers && caseRecord.drivers[kk]; ap.push([kk.replace(/_/g, ' '), v.toLocaleString('en-GB', { maximumFractionDigits: 2 }), d ? d.quality : 'assumed']); });
    tbl(s, ap, { w: 6.2, fontSize: 11 });
    const srcs = caseRecord && caseRecord.sources ? caseRecord.sources.map((x) => x.publisher + ': ' + x.title) : ['Owner\'s own estimates'];
    s.addText(srcs.slice(0, 5).map((t) => ({ text: t, options: { bullet: true, paraSpaceAfter: 6 } })), { x: 7.0, y: 2.0, w: 5.7, h: 4.6, fontFace: SANS, fontSize: 11, color: C.ink, valign: 'top' });
    s.addNotes('Full sources with links are in the Word report and on the Sources sheet of the Excel model.');

    return pptx;
  }

  const api = { buildDeck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorPptx = api;
})(typeof self !== 'undefined' ? self : this);
