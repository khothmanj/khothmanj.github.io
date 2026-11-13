/*
 * Tenor Word report (docx 9.15.0). A business-plan style report that adapts to the project and audience.
 * buildReport(docx, ctx) -> docx.Document. ctx: { input, model, sens, ready, caseRecord, sectors, narrative, audience, charts }
 * charts (optional): { cash: Uint8Array PNG, sales: Uint8Array PNG, dscr: Uint8Array PNG }
 */
(function (root) {
  'use strict';

  const GREEN = '1E6B47', INK = '13261C', MUTED = '56685D', LINE = 'D7DDD8', HEAD = '19201D';

  function buildReport(D, ctx) {
    const { input, model: m, sens, ready, caseRecord, sectors } = ctx;
    const N = ctx.narrative;
    const cur = input.currency || '';
    const k = m.kpis;
    const inv = ctx.audience === 'investor';
    const money = (x, o) => N.money(x, cur, o);
    const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType,
      TableOfContents, Footer, Header, PageNumber, ImageRun, ExternalHyperlink, PageBreak } = D;

    const P = (text, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts, children: [].concat(text).map((t) => (typeof t === 'string' ? new TextRun(t) : t)) });
    const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] });
    const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
    const bullet = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(t)] });
    const note = (t) => new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: t, italics: true, color: MUTED, size: 18 })] });
    const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
    const borders = { top: border, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };
    const cell = (text, o = {}) => new TableCell({
      borders, shading: o.head ? { type: ShadingType.CLEAR, color: 'auto', fill: HEAD } : o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ alignment: o.num ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(text), bold: !!(o.head || o.bold), color: o.head ? 'FFFFFF' : INK, size: 18 })] })],
    });
    const table = (heads, rows, o = {}) => new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ tableHeader: true, children: heads.map((h, i) => cell(h, { head: true, num: i > 0 && o.numeric !== false })) })]
        .concat(rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, { num: i > 0 && o.numeric !== false, bold: o.boldRows && o.boldRows.includes(r[0]) })) }))),
    });
    const image = (bytes, w = 600, h = 260) => new Paragraph({ spacing: { after: 160 }, children: [new ImageRun({ type: 'png', data: bytes, transformation: { width: w, height: h } })] });
    const yrs = m.years;
    const showYears = Array.from({ length: Math.min(m.N, 6) }, (_, i) => i + 1);
    const sector = sectors && sectors.sectors.find((s) => s.id === input.sector);
    const sum = N.summary(ctx, inv ? 'investor' : 'simple');
    const name = input.name || (caseRecord && caseRecord.name) || 'Project';

    /* ---------- cover ---------- */
    const cover = [
      new Paragraph({ spacing: { before: 2400, after: 240 }, children: [new TextRun({ text: name, font: 'Georgia', size: 56, bold: true, color: INK })] }),
      P([new TextRun({ text: [sector ? sector.label : input.sector, input.country].filter(Boolean).join(' · '), size: 28, color: MUTED })]),
      P([new TextRun({ text: inv ? 'Financial plan and credit summary' : 'Financial plan', size: 28, color: GREEN })]),
      P([new TextRun({ text: 'Prepared with Tenor on ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), size: 20, color: MUTED })]),
      new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: 'Illustrative model for portfolio purposes. Not financial advice.', bold: true, color: 'A2382B', size: 20 })] }),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Contents')] }),
      new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
      note('If the contents list is empty, right-click it and choose Update field.'),
    ];

    /* ---------- 2 executive summary ---------- */
    const exec = [H1('Executive summary'), P([new TextRun({ text: sum.headline, bold: true, size: 26, color: GREEN })])].concat(sum.paragraphs.map((t) => P(t)));
    exec.push(table(['Headline figure', 'Value'], [
      ['Yearly sales after ramp-up (' + yrs[k.steadyYear - 1] + ')', money(m.out.revenue[k.steadyYear])],
      ['Yearly running costs in that year', money(m.out.varCost[k.steadyYear] + m.out.fixCost[k.steadyYear])],
      [inv ? 'EBITDA margin' : 'Share of sales left after running costs', N.pct(k.ebitdaMargin)],
      ['Total capex', money(m.uses.capex)],
      ['Largest yearly loan payment', m.loans.length ? money(k.largestDebtService) + ' (' + yrs[k.largestDebtServiceYear - 1] + ')' : 'No loan'],
      [inv ? 'Minimum DSCR' : 'Lowest loan cover (DSCR)', N.ratio(k.dscrMin)],
      ['Project IRR', N.pct(k.projectIRR)],
      ['NPV at ' + N.pct(k.discountRate, 0), money(k.npv)],
      ['Payback', N.years(k.paybackYears)],
      ['Readiness score', ready.score + ' out of 100'],
    ]));

    /* ---------- 3 the project ---------- */
    const proj = [H1('The project')];
    proj.push(H2('What it does'));
    proj.push(P((caseRecord && caseRecord.concept) || input.description || 'A ' + (sector ? sector.label.toLowerCase() : 'new') + ' project.'));
    proj.push(H2('Where the money comes from'));
    proj.push(P((caseRecord && caseRecord.revenue_model) || (sector && sector.revenue_explained) || ''));
    if (sector) proj.push(note('How sales are calculated: ' + sector.revenue_explained));
    const exp = input.revenue && input.revenue.export_pct || 0;
    proj.push(P('Sales split: ' + (100 - exp).toFixed(0) + '% domestic, ' + exp.toFixed(0) + '% export.'));
    if (caseRecord && caseRecord.sub_sector) { proj.push(H2('The market')); proj.push(P(caseRecord.sub_sector + ' in ' + caseRecord.country + '. ' + (caseRecord.stage === 'trading' ? 'The business is already trading.' : 'This is a new project.'))); }

    /* ---------- 4 how the numbers were built ---------- */
    const built = [H1('How the numbers were built'), P('Every figure in this report comes from the assumptions below. Each one is marked as sourced (from a checked public source), derived (calculated from sourced figures) or assumed (an estimate to replace with your own data).')];
    const rows = [];
    const drivers = (caseRecord && caseRecord.drivers) || {};
    const label = (key) => { const i = sector && sector.inputs.find((x) => x.key === key); return i ? (inv ? i.label : i.simple_label) : key.replace(/_/g, ' '); };
    Object.entries(input.revenue && input.revenue.inputs || {}).forEach(([key, v]) => {
      if (key.startsWith('cost_') || typeof v !== 'number') return;
      const d = drivers[key];
      rows.push([label(key), v.toLocaleString('en-GB', { maximumFractionDigits: 2 }), d ? d.quality : 'assumed', d && d.note ? d.note : 'Tenor default or your entry']);
    });
    built.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ tableHeader: true, children: ['Assumption', 'Value', 'Quality', 'Why'].map((h) => cell(h, { head: true })) })].concat(rows.slice(0, 40).map((r) => new TableRow({ children: r.map((v, i) => cell(v, { num: i === 1, fill: i === 2 ? (v === 'sourced' ? 'E3F1E8' : v === 'derived' ? 'EEF2E6' : 'FBF1E3') : undefined })) }))),
    }));
    built.push(note('Other assumptions: inflation ' + (input.inflation_pct || 0) + '% a year, tax ' + (input.tax && input.tax.rate_pct || 0) + '%, discount rate ' + (input.discount_rate_pct || 0) + '%, customers pay in ' + (input.working_capital && input.working_capital.receivable_days || 0) + ' days.'));

    /* ---------- 5 funding plan ---------- */
    const fund = [H1('Funding plan'), H2('Sources and uses of funds')];
    const s = (a) => a.slice(1).reduce((x, y) => x + y, 0);
    fund.push(table(['Sources', 'Amount'], [['Equity', money(s(m.out.equityIn))], ['Grants', money(s(m.out.grantIn))], ['Loans', money(s(m.out.draw))], ['Total', money(m.funded)]], { boldRows: ['Total'] }));
    fund.push(P(''));
    fund.push(table(['Uses', 'Amount'], [['Capex', money(m.uses.capex)], ['Loan fees', money(m.uses.fees)], ['Cash reserve (negative is a gap)', money(m.uses.reserve)], ['Total', money(m.uses.capex + m.uses.fees + m.uses.reserve)]], { boldRows: ['Total'] }));
    if (m.loans.length) {
      fund.push(H2('Loan terms'));
      fund.push(table(['Loan', 'Amount', 'Rate', 'Years to repay', 'Grace', 'Repayment'], (input.financing.loans || []).map((l) => [l.label, N.money(l.amount, l.currency || cur), (l.rate_pct || 0).toFixed(2) + '%', String(l.tenor_years), String(l.grace_years || 0), { annuity: 'Equal payments', equal_principal: 'Equal principal', bullet: 'All at the end' }[l.repayment] || l.repayment])));
    }
    if (m.ownership.length > 1) {
      fund.push(H2('Ownership after funding'));
      fund.push(table(['Holder', 'Share'], m.ownership.map((o2) => [o2.holder, o2.pct.toFixed(1) + '%'])));
    }

    /* ---------- 6 projected results ---------- */
    const res = [H1('Projected results'), P('The first ' + showYears.length + ' years. The Excel model has every year and every line.')];
    const line = (lab, arr) => [lab].concat(showYears.map((t) => money(arr[t])));
    res.push(table(['', ...showYears.map((t) => String(yrs[t - 1]))], [
      line('Sales', m.out.revenue), line('Running costs', m.out.varCost.map((v, t) => v + m.out.fixCost[t])), line('EBITDA', m.out.ebitda),
      line('Loan payments', m.out.debtService), line('Cash left after loan payments', m.out.cashAfterDebt), line('Net profit', m.out.netIncome), line('Cash at year end', m.out.cash),
    ], { boldRows: ['EBITDA', 'Cash left after loan payments'] }));
    if (ctx.charts && ctx.charts.sales) { res.push(P('')); res.push(image(ctx.charts.sales)); res.push(note('Sales and running costs by year.')); }
    if (ctx.charts && ctx.charts.cash) { res.push(image(ctx.charts.cash)); res.push(note('Cash left each year after running costs, tax and loan payments.')); }

    /* ---------- 7 can the project repay? ---------- */
    const repay = [H1('Can the project repay?')];
    if (m.loans.length) {
      repay.push(P(inv ? 'Minimum DSCR ' + N.ratio(k.dscrMin) + ', average ' + N.ratio(k.dscrAvg) + ', LLCR ' + N.ratio(k.llcr) + '.' : 'DSCR shows how many times the cash the project makes covers its loan payment. Lenders usually want at least 1.3. The lowest is ' + N.ratio(k.dscrMin) + '.'));
      if (ctx.charts && ctx.charts.dscr) { repay.push(image(ctx.charts.dscr)); repay.push(note('DSCR by year, with the lender minimum.')); }
      m.loans.forEach((l) => {
        repay.push(H2('Repayment schedule: ' + l.label));
        const r2 = [];
        for (let t = 1; t <= Math.min(m.N, l.last); t++) r2.push([String(yrs[t - 1]), money(l.local.closing[t - 1] + l.local.draw[t]), money(l.local.interestPaid[t]), money(l.local.principal[t]), money(l.local.closing[t])]);
        repay.push(table(['Year', 'Owed at start', 'Interest paid', 'Repaid', 'Owed at end'], r2));
      });
    } else {
      repay.push(P('There is no loan in this plan. ' + (k.lowestCash >= 0 ? 'Cash stays positive in every year.' : 'Cash falls to ' + money(k.lowestCash) + ', so extra funding is needed.')));
    }

    /* ---------- 8 returns ---------- */
    const ret = [H1('Returns')];
    ret.push(table(['Measure', 'Value', 'What it means'], [
      ['Project IRR', N.pct(k.projectIRR), 'The yearly return on all the money put in, before borrowing.'],
      ['Equity IRR', N.pct(k.equityIRR), 'The yearly return on the owners\' money after loan payments.'],
      ['NPV at ' + N.pct(k.discountRate, 0), money(k.npv), 'What all future cash is worth today. Positive means the project earns more than the discount rate.'],
      ['Payback', N.years(k.paybackYears), 'How long until the cash coming in covers the money put in.'],
      ['Break-even sales', money(k.breakEvenRevenue), 'The sales level where income just covers running costs.'],
    ], { numeric: false }));
    ret.push(note('IRR and NPV use cash flows over the ' + m.N + ' modelled years, with no value assumed after that.'));

    /* ---------- 9 risks ---------- */
    const risks = [H1('Risks and what-ifs'), P('Each what-if keeps the build and the loans the same and changes sales or running costs. Ranked by how much each one moves the value of the project.')];
    risks.push(table(['What-if', 'NPV', 'Change', 'Lowest DSCR', 'Lowest cash'], sens.ranked.map((id) => { const r = sens.results.find((x) => x.id === id); return [inv ? r.label : r.simple, money(r.result.npv), money(r.delta.npv), N.ratio(r.result.dscrMin), money(r.result.lowestCash)]; })));
    risks.push(H2('How to reduce each risk'));
    sens.ranked.forEach((id) => { const r = sens.results.find((x) => x.id === id); risks.push(bullet((inv ? r.label : r.simple) + ': ' + N.mitigation(id))); });
    if (caseRecord && caseRecord.caveats) { risks.push(H2('Caveats on the data')); caseRecord.caveats.forEach((c) => risks.push(bullet(c))); }

    /* ---------- 10 readiness ---------- */
    const rd = [H1('Readiness'), P('Readiness score: ' + ready.score + ' out of 100.')];
    rd.push(table(['Check', 'Points'], ready.items.map((i) => [i.label, i.points + ' of ' + i.max])));
    rd.push(H2('What is still needed'));
    (ready.missing.length ? ready.missing : ['Nothing on the standard checklist is missing.']).forEach((d) => rd.push(bullet(d)));

    /* ---------- 11 similar projects and sources ---------- */
    const src = [H1('Similar projects and sources')];
    if (ctx.similar && ctx.similar.length) { src.push(H2('Similar projects')); ctx.similar.forEach((s2) => src.push(bullet(s2.name + (s2.why ? ': ' + s2.why : '')))); }
    if (caseRecord && caseRecord.sources) {
      src.push(H2('Sources'));
      caseRecord.sources.forEach((s2) => src.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(s2.title + ', ' + s2.publisher + ', ' + s2.date + '. '), new ExternalHyperlink({ link: s2.url, children: [new TextRun({ text: s2.url, style: 'Hyperlink' })] }), new TextRun(' Supports: ' + s2.supports + '.')] })));
    } else src.push(P('Figures are the project owner\'s own estimates.'));

    /* ---------- 12 glossary, 13 disclaimer ---------- */
    const gl = [H1('Glossary')];
    Object.entries((sectors && sectors.glossary) || {}).forEach(([t, d]) => gl.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t + ': ', bold: true }), new TextRun(d)] })));
    const disc = [H1('Disclaimer'), P('This report was produced with Tenor, a portfolio prototype. It is an illustrative model for portfolio purposes and is not financial, investment, tax or legal advice. Figures marked as assumed are estimates. Check every number with qualified advisers before relying on it.')];

    return new D.Document({
      creator: 'Tenor', title: name + ' financial plan', description: 'Prepared with Tenor',
      features: { updateFields: true },
      styles: {
        default: { document: { run: { font: 'Arial', size: 21, color: INK }, paragraph: { spacing: { line: 300 } } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Georgia', size: 40, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 200 } } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Georgia', size: 28, bold: true, color: GREEN }, paragraph: { spacing: { before: 240, after: 120 } } },
        ],
      },
      sections: [{
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: name + ' · Tenor', color: MUTED, size: 16 })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], color: MUTED, size: 16 })] })] }) },
        children: [].concat(cover, exec, proj, built, fund, res, repay, ret, risks, rd, src, gl, disc),
      }],
    });
  }

  const api = { buildReport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorDocx = api;
})(typeof self !== 'undefined' ? self : this);
