/*
 * Insights and PRD (#insights): a short product doc built from the queries. One document model
 * renders to the page, to Markdown and to Word, so all three always say the same thing.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, A = root.SignalApp, UI = root.SignalSQLUI, esc = K.esc;
  const DOCX_URL = 'https://cdn.jsdelivr.net/npm/docx@9.15.0/dist/index.iife.js';
  const Z_ALPHA = 1.96, Z_POWER = 0.8416; // 5% two-sided significance, 80% power
  const UPLIFTS = [5, 10, 15, 20];

  function shiftMonth(ym, n) { let [y, m] = ym.split('-').map(Number); m += n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); }

  async function render(el, ctx) {
    const p = ctx.params;
    const uplift = p.uplift;
    el.innerHTML = '';
    const head = K.header(el, { title: 'From data to decision', lede: 'A short product doc for the biggest activation problem, written from the queries in Signal. Every number has its SQL at the end of its section. Sample data, so the numbers are illustrative.' });
    const tools = document.createElement('div');
    tools.className = 'doc-tools';
    tools.innerHTML = '<button type="button" class="btn" data-word><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10"/></svg>Download Word</button>' +
      '<button type="button" class="btn" data-md><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10"/></svg>Download Markdown</button><span class="doc-status" role="status"></span>';
    head.appendChild(tools);
    const docEl = document.createElement('article');
    docEl.className = 'doc';
    docEl.innerHTML = '<div style="display:grid;gap:10px">' + [80, 95, 70, 88, 60].map((w) => '<span class="skel" style="height:14px;width:' + w + '%"></span>').join('') + '</div>';
    el.appendChild(docEl);

    // The problem is measured on lenders who have had at least three months to get through.
    const problemTo = shiftMonth(p.to_month, -3);
    const runs = await K.runAll([
      ['insights_problem', { from_month: '2024-11', to_month: problemTo }],
      ['insights_opportunity', { uplift }],
      'insights_experiment_baseline', 'insights_baselines', 'overview_activation', ['activation_compliance_reasons', { from_month: '2024-11' }],
    ], p);
    const [Pr, Op, Ex, Ba, Ac, Re] = runs;
    const pr = Pr.rows[0], op = Op.rows[0], ex = Ex.rows[0], ba = Ba.rows[0], act = Ac.rows[Ac.rows.length - 1];
    const reasons = Re.rows;

    // Sample size for a two-arm test on the 45-day approval rate.
    const p1 = ex.approved_within_45_days_pct / 100, p2 = Math.min(0.99, p1 + uplift / 100);
    const nArm = Math.ceil(Math.pow(Z_ALPHA + Z_POWER, 2) * (p1 * (1 - p1) + p2 * (1 - p2)) / Math.pow(p2 - p1, 2));
    const months = (2 * nArm) / ex.new_sandbox_lenders_per_month;

    /* ---------- the document model ---------- */
    const money = (v) => K.money(v);
    const doc = [
      { h: 'Compliance self-serve: product requirements', level: 1 },
      { meta: [['Author', 'Product, Ferrow'], ['Status', 'Draft for review'], ['Data', 'Signal sample data, as of ' + K.month(p.to_month, true)], ['Owner of the decision', 'Head of Product, with Compliance']] },

      { h: '1. The problem', level: 2, sql: [Pr, Re] },
      { p: 'Lenders sign up and test happily in the sandbox, then stall at compliance. Of ' + pr.signups + ' lenders who signed up between ' + K.month('2024-11') + ' and ' + K.month(problemTo) + ', ' + pr.made_sandbox_call + ' made a sandbox call but only ' + pr.compliance_approved + ' were approved by compliance (' + K.pct(pr.sandbox_to_approved_pct, 0) + '). That is the biggest drop in the funnel.' },
      { stats: [[K.pct(pr.sandbox_to_approved_pct, 0), 'of sandbox lenders get approved'], [Math.round(pr.median_days_to_approval) + ' days', 'median from first sandbox call to approval'], [K.pct(pr.missing_document_pct, 0), 'of requests for more information are for a missing document'], [String(pr.stuck_in_compliance_now), 'lenders stuck in compliance today']] },
      { p: 'Compliance is also the slowest step. Every other step before the first live call takes a few days at most. When compliance sends a lender back, it is usually for paperwork a checklist could catch:' },
      { ul: reasons.map((r) => r.reason + ': ' + r.requests + ' requests (' + K.pct(r.pct_of_requests, 0) + ')') },
      { p: 'Since August 2026 a reviewer has left and decisions take about a month. The problem is getting worse, not better.' },

      { h: '2. Opportunity sizing', level: 2, sql: [Op], uplift: true },
      { p: 'If compliance approval rose by ' + uplift + ' percentage points, from ' + K.pct(op.compliance_rate_pct, 0) + ' to ' + K.pct(op.compliance_rate_with_uplift_pct, 0) + ', about ' + Math.round(op.extra_live_lenders_per_year) + ' more lenders a year would go live. At today\'s first-year revenue per new lender, that is worth about ' + money(op.extra_revenue_first_year_ngn) + ' in their first year.' },
      { table: [['Input', 'Value', 'Source'],
        ['Lenders reaching the sandbox in a year', String(op.reached_sandbox), 'Signups in the last 12 months'],
        ['Compliance approval rate today', K.pct(op.compliance_rate_pct, 1), 'Signups with at least three months to finish'],
        ['Uplift assumed', '+' + uplift + ' points', 'Choose 5 to 20 above'],
        ['Approved lenders who go live', K.pct(op.approved_to_live_pct, 1), 'Today\'s rate'],
        ['First-year revenue per new lender', money(op.first_year_revenue_per_lender_ngn), 'Average for lenders who went live in the data'],
        ['Extra lenders live per year', K.num(op.extra_live_lenders_per_year, { dp: true }), 'Sandbox lenders × uplift × go-live rate'],
        ['Extra first-year revenue', money(op.extra_revenue_first_year_ngn), 'Extra lenders × first-year revenue']] },
      { p: 'This is a floor. It ignores lenders who would go live sooner, the compliance team\'s time saved on resubmissions, and the support tickets that disappear.' },

      { h: '3. Proposed solution', level: 2 },
      { p: 'A self-serve compliance checklist with status tracking, plus nudges during the sandbox stage.' },
      { ul: [
        'Checklist before submission. The lender sees every document compliance needs, uploads each one against its line, and the form checks the basics (file type, expiry date, names matching the directors list) before it can be submitted.',
        'Status tracker. One page shows where the review is, who has it and the expected decision date, so lenders stop raising "when will we hear back?" tickets.',
        'Specific requests. When compliance needs more, it ticks the exact document and reason, and the lender gets a link straight to that line.',
        'Sandbox nudges. On day 3 and day 7 of sandbox testing, lenders who have not started the checklist get a short email with their remaining items.',
        'Queue view for compliance. Reviews sorted by days waiting, with an alert at 10 working days.',
      ] },
      { p: 'Out of scope for the first release: automated identity checks on directors, and changes to the compliance policy itself.' },

      { h: '4. Experiment design', level: 2, sql: [Ex] },
      { kv: [['Hypothesis', 'If lenders see every required document before they submit, more will be approved first time, so more will be approved within 45 days of their first sandbox call.'],
        ['Primary metric', 'Share of lenders approved within 45 days of their first sandbox call. Baseline ' + K.pct(ex.approved_within_45_days_pct, 1) + '.'],
        ['Guardrails', 'Rejection rate (baseline ' + K.pct(ba.rejected_pct, 1) + '), compliance tickets per lender (baseline ' + ba.compliance_tickets_per_lender + '), and reviewer hours per application.'],
        ['Target segment', 'Every new lender who makes a first sandbox call.'],
        ['Unit', 'Lender, assigned when they make their first sandbox call.']] },
      { p: 'Sample size for a two-arm test, with 5% significance and 80% power:' },
      { formula: 'n per arm = (z_α/2 + z_β)² × [p₁(1 − p₁) + p₂(1 − p₂)] ÷ (p₂ − p₁)²' },
      { p: 'With p₁ = ' + p1.toFixed(3) + ' and p₂ = ' + p2.toFixed(3) + ' (a ' + uplift + '-point lift), n = (1.96 + 0.84)² × [' + (p1 * (1 - p1)).toFixed(3) + ' + ' + (p2 * (1 - p2)).toFixed(3) + '] ÷ ' + Math.pow(p2 - p1, 2).toFixed(4) + ' = ' + K.num(nArm) + ' lenders per arm, ' + K.num(2 * nArm) + ' in total.' },
      { callout: 'Only about ' + Math.round(ex.new_sandbox_lenders_per_month) + ' lenders reach the sandbox each month, so the test would take about ' + (months >= 24 ? K.num(months / 12, { dp: true }) + ' years' : Math.ceil(months) + ' months') + '. A classic A/B test is not realistic here.' },
      { p: 'So the plan is to ship to everyone and measure honestly:' },
      { ul: [
        'Compare cohorts before and after launch on the cohort heatmap in Activation, with the launch date marked, the same way the docs rewrite is marked today.',
        'Set a decision rule in advance: if the 45-day approval rate for the first 20 lenders after launch is below ' + K.pct(ex.approved_within_45_days_pct, 0) + ', pause and review.',
        'Watch a leading indicator that moves within days: the share of submissions approved first time (baseline ' + K.pct(ba.approved_first_time_pct, 0) + ').',
        'Interview every lender who is sent back after launch, to find what the checklist misses.',
      ] },

      { h: '5. Success metrics', level: 2, sql: [Ba, Ac] },
      { table: [['Metric', 'Baseline', 'Target in 6 months', 'Where Signal tracks it'],
        ['Approved within 45 days of first sandbox call', K.pct(ex.approved_within_45_days_pct, 0), K.pct(Math.min(95, ex.approved_within_45_days_pct + uplift), 0), 'Insights, experiment baseline'],
        ['Approved first time', K.pct(ba.approved_first_time_pct, 0), '65%', 'Insights, success metric baselines'],
        ['Median days to compliance approval', Math.round(pr.median_days_to_approval) + ' days', '14 days', 'Activation funnel'],
        ['Activation rate (live within 90 days)', K.pct(act.activation_rate_pct, 0), K.pct(act.activation_rate_pct + 10, 0), 'Overview'],
        ['Rejection rate (guardrail)', K.pct(ba.rejected_pct, 1), 'No higher', 'Insights, success metric baselines'],
        ['Compliance tickets per lender (guardrail)', String(ba.compliance_tickets_per_lender), 'Lower', 'Insights, success metric baselines']] },

      { h: '6. Risks and open questions', level: 2 },
      { ul: [
        'Compliance capacity, not paperwork, may be the real limit while the team is one reviewer short. The checklist cuts rework but does not add a reviewer.',
        'A stricter form could put off small lenders. Watch Starter signups in the first month.',
        'Which documents can be checked automatically, and which need a person? Compliance to confirm.',
        'Does the regulator expect any step we would remove? Legal to confirm before build.',
        'The sample is small. Expect the numbers to swing, and judge on cohorts and interviews, not one month.',
      ] },

      { h: '7. Roadmap', level: 2 },
      { roadmap: [
        ['Now', ['Document checklist with upload checks', 'Status tracker with expected decision date', 'Hire or second a second reviewer']],
        ['Next', ['Specific requests that link to the missing document', 'Sandbox nudges on day 3 and day 7', 'Queue view and 10-day alert for compliance']],
        ['Later', ['Automatic checks on licence numbers and director IDs', 'Alert Customer Success when an account stalls at any stage', 'Connect Signal to the live data warehouse']],
      ] },
    ];

    /* ---------- render to the page ---------- */
    const out = [];
    let sectionSql = null;
    const flush = () => { if (sectionSql) { out.push({ sqlSlot: sectionSql }); sectionSql = null; } };
    doc.forEach((b) => { if (b.h && b.level === 2) { flush(); sectionSql = b.sql || null; } out.push(b); });
    flush();
    docEl.innerHTML = out.map((b, i) => {
      if (b.h) return b.level === 1 ? '<h2 class="doc-title">' + esc(b.h) + '</h2>' : '<h2 class="doc-h">' + esc(b.h) + '</h2>' + (b.uplift ? upliftControl(uplift) : '');
      if (b.meta) return '<dl class="doc-meta">' + b.meta.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>';
      if (b.p) return '<p>' + esc(b.p) + '</p>';
      if (b.ul) return '<ul>' + b.ul.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
      if (b.stats) return '<div class="doc-stats">' + b.stats.map(([v, l]) => '<div><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>').join('') + '</div>';
      if (b.table) return '<div class="table-wrap"><table class="data doc-table"><thead><tr>' + b.table[0].map((h) => '<th scope="col"><span>' + esc(h) + '</span></th>').join('') + '</tr></thead><tbody>' + b.table.slice(1).map((r) => '<tr>' + r.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      if (b.kv) return '<dl class="doc-kv">' + b.kv.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>';
      if (b.formula) return '<p class="formula">' + esc(b.formula) + '</p>';
      if (b.callout) return '<p class="callout">' + esc(b.callout) + '</p>';
      if (b.roadmap) return '<div class="roadmap">' + b.roadmap.map(([t, items]) => '<div><h3>' + esc(t) + '</h3><ul>' + items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>').join('') + '</div>';
      if (b.sqlSlot) return '<div class="doc-sql" data-slot="' + i + '"></div>';
      return '';
    }).join('');
    out.forEach((b, i) => { if (b.sqlSlot) docEl.querySelector('[data-slot="' + i + '"]').appendChild(K.sqlPanel(b.sqlSlot, p)); });
    docEl.querySelectorAll('[data-uplift]').forEach((b) => b.addEventListener('click', () => A.setParams({ uplift: +b.dataset.uplift })));

    /* ---------- downloads ---------- */
    const status = tools.querySelector('.doc-status');
    tools.querySelector('[data-md]').addEventListener('click', () => {
      UI.download('ferrow-compliance-prd.md', toMarkdown(doc), 'text/markdown;charset=utf-8');
      status.textContent = 'Markdown downloaded.';
    });
    tools.querySelector('[data-word]').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true; status.textContent = 'Building the Word file…';
      try {
        const lib = await loadDocx();
        const blob = await lib.Packer.toBlob(toDocx(doc, lib));
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ferrow-compliance-prd.docx';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        status.textContent = 'Word file downloaded.';
      } catch (err) {
        console.error(err); status.textContent = 'The Word file could not be built. Check your connection and try again.';
      } finally { b.disabled = false; }
    });
  }

  function upliftControl(current) {
    return '<div class="seg doc-uplift" role="group" aria-label="Assumed uplift at compliance"><span class="seg-label">Uplift</span>' +
      UPLIFTS.map((u) => '<button type="button" data-uplift="' + u + '" aria-pressed="' + (u === current) + '">+' + u + ' pts</button>').join('') + '</div>';
  }

  /* ---------- Markdown ---------- */
  function toMarkdown(doc) {
    const lines = [];
    doc.forEach((b) => {
      if (b.h) lines.push((b.level === 1 ? '# ' : '## ') + b.h, '');
      else if (b.meta) { b.meta.forEach(([k, v]) => lines.push('**' + k + ':** ' + v + '  ')); lines.push(''); }
      else if (b.p) lines.push(b.p, '');
      else if (b.ul) { b.ul.forEach((x) => lines.push('- ' + x)); lines.push(''); }
      else if (b.stats) { b.stats.forEach(([v, l]) => lines.push('- **' + v + '** ' + l)); lines.push(''); }
      else if (b.table) { lines.push('| ' + b.table[0].join(' | ') + ' |', '|' + b.table[0].map(() => ' --- ').join('|') + '|'); b.table.slice(1).forEach((r) => lines.push('| ' + r.join(' | ') + ' |')); lines.push(''); }
      else if (b.kv) { b.kv.forEach(([k, v]) => lines.push('- **' + k + ':** ' + v)); lines.push(''); }
      else if (b.formula) lines.push('`' + b.formula + '`', '');
      else if (b.callout) lines.push('> ' + b.callout, '');
      else if (b.roadmap) { b.roadmap.forEach(([t, items]) => { lines.push('**' + t + '**', ''); items.forEach((x) => lines.push('- ' + x)); lines.push(''); }); }
    });
    lines.push('---', '', 'Prototype with a fictional brand and sample data. Built in Signal, a portfolio project by Khadijat Othman.');
    return lines.join('\n');
  }

  /* ---------- Word ---------- */
  function loadDocx() {
    if (root.docx) return Promise.resolve(root.docx);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = DOCX_URL; s.onload = () => (root.docx ? resolve(root.docx) : reject(new Error('docx did not load')));
      s.onerror = () => reject(new Error('docx did not load'));
      document.head.appendChild(s);
    });
  }
  function toDocx(doc, D) {
    const font = 'Arial';
    const run = (text, o = {}) => new D.TextRun(Object.assign({ text, font, size: 21 }, o));
    const para = (text, o = {}) => new D.Paragraph(Object.assign({ children: [run(text, o.run || {})], spacing: { after: 120 } }, o.para || {}));
    const cell = (text, head) => new D.TableCell({ children: [new D.Paragraph({ children: [run(text, { bold: !!head, size: 18 })] })], shading: head ? { fill: 'EFEEE8' } : undefined, margins: { top: 60, bottom: 60, left: 80, right: 80 } });
    const children = [];
    doc.forEach((b) => {
      if (b.h) children.push(new D.Paragraph({ children: [run(b.h, { bold: true, size: b.level === 1 ? 34 : 26, color: b.level === 1 ? '14181B' : '0D5C63' })], spacing: { before: b.level === 1 ? 0 : 280, after: 120 } }));
      else if (b.meta) b.meta.forEach(([k, v]) => children.push(new D.Paragraph({ children: [run(k + ': ', { bold: true }), run(v)], spacing: { after: 40 } })));
      else if (b.p) children.push(para(b.p));
      else if (b.ul) b.ul.forEach((x) => children.push(new D.Paragraph({ children: [run(x)], bullet: { level: 0 }, spacing: { after: 60 } })));
      else if (b.stats) b.stats.forEach(([v, l]) => children.push(new D.Paragraph({ children: [run(v + ' ', { bold: true }), run(l)], bullet: { level: 0 }, spacing: { after: 60 } })));
      else if (b.kv) b.kv.forEach(([k, v]) => children.push(new D.Paragraph({ children: [run(k + ': ', { bold: true }), run(v)], spacing: { after: 80 } })));
      else if (b.formula) children.push(para(b.formula, { run: { font: 'Consolas', size: 20 } }));
      else if (b.callout) children.push(para(b.callout, { run: { bold: true, color: '0D5C63' } }));
      else if (b.table) children.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: b.table.map((r, i) => new D.TableRow({ children: r.map((c) => cell(c, i === 0)) })) }), para(''));
      else if (b.roadmap) b.roadmap.forEach(([t, items]) => { children.push(para(t, { run: { bold: true } })); items.forEach((x) => children.push(new D.Paragraph({ children: [run(x)], bullet: { level: 0 }, spacing: { after: 40 } }))); });
    });
    children.push(para('Prototype with a fictional brand and sample data. Built in Signal, a portfolio project by Khadijat Othman.', { run: { italics: true, size: 18, color: '5E666D' }, para: { spacing: { before: 240 } } }));
    return new D.Document({ creator: 'Signal', title: 'Compliance self-serve: product requirements', sections: [{ properties: {}, children }] });
  }

  A.register('insights', { render });
})(window);
