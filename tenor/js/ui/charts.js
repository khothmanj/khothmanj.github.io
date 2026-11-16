/*
 * Tenor charts (Chart.js 4.6.1). Colours come from the CSS custom properties so charts follow the theme.
 */
(function (root) {
  'use strict';
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const theme = () => ({ ink: css('--ink'), muted: css('--muted'), line: css('--line'), accent: css('--accent'), accentSoft: css('--accent-soft'), slate: css('--chart-slate'), bad: css('--bad'), warn: css('--warn'), surface: css('--surface'), sage: css('--muted') });
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = (cur) => (v) => root.TenorNarrative.money(v, cur);
  const short = (v) => { const a = Math.abs(v); const s = a >= 1e9 ? (a / 1e9).toFixed(1) + 'bn' : a >= 1e6 ? (a / 1e6).toFixed(1) + 'm' : a >= 1e3 ? (a / 1e3).toFixed(0) + 'k' : Math.round(a); return (v < 0 ? '−' : '') + s; };
  function base(t, extra = {}) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: reduced() ? false : { duration: 520, easing: 'easeOutCubic' },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false, labels: { color: t.ink, font: { family: 'Geist' }, boxWidth: 12 } }, tooltip: { backgroundColor: t.surface, titleColor: t.ink, bodyColor: t.ink, borderColor: t.line, borderWidth: 1, padding: 12, cornerRadius: 12, boxPadding: 4, usePointStyle: true } },
      scales: {
        x: { grid: { display: false }, border: { color: t.line }, ticks: { color: t.muted, font: { family: 'Geist' }, maxRotation: 0, autoSkipPadding: 12 } },
        y: { grid: { color: t.line }, border: { display: false }, ticks: { color: t.muted, font: { family: 'Geist' }, callback: short } },
      },
    }, extra);
  }
  /* shaded band behind the loan repayment years */
  const bandPlugin = (from, to, label) => ({
    id: 'band', beforeDatasetsDraw(c) {
      if (from === null || to === null) return;
      const x = c.scales.x, a = c.chartArea, t = theme();
      const step = (x.getPixelForValue(1) - x.getPixelForValue(0)) || 0;
      const x0 = x.getPixelForValue(from) - step / 2, x1 = x.getPixelForValue(to) + step / 2;
      const ctx = c.ctx; ctx.save(); ctx.fillStyle = t.accentSoft; ctx.fillRect(Math.max(a.left, x0), a.top, Math.min(a.right, x1) - Math.max(a.left, x0), a.bottom - a.top);
      ctx.fillStyle = t.muted; ctx.font = '12px Geist, sans-serif'; ctx.fillText(label, Math.max(a.left, x0) + 6, a.top + 14); ctx.restore();
    },
  });

  /* Cash left each year, as an area. rows: { base, scenario } arrays indexed by year (1..N) */
  function cashArea(canvas, m, cur, scenarioRow) {
    const t = theme();
    const labels = m.years.map(String);
    const baseRow = m.out.cashAfterDebt.slice(1);
    const loan = m.loans.length ? { from: Math.min(...m.loans.map((l) => l.firstRepay)) - 1, to: Math.max(...m.loans.map((l) => l.last)) - 1 } : { from: null, to: null };
    const ds = [{ label: scenarioRow ? 'Your plan' : 'Cash left', data: baseRow, borderColor: t.accent, backgroundColor: scenarioRow ? 'transparent' : (ctx) => { const a = ctx.chart.chartArea; if (!a) return t.accentSoft; const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, t.accentSoft); g.addColorStop(1, 'rgba(53,80,252,0)'); return g; }, fill: scenarioRow ? false : 'origin', pointRadius: 3, pointBackgroundColor: t.accent, borderWidth: 2, tension: 0, borderDash: scenarioRow ? [6, 5] : [] }];
    if (scenarioRow) ds.push({ label: 'This outcome', data: scenarioRow.slice(1), borderColor: t.warn, backgroundColor: 'rgba(231,192,122,0.14)', fill: 'origin', pointRadius: 3, pointBackgroundColor: t.warn, borderWidth: 2, tension: 0 });
    const opts = base(t);
    opts.plugins.legend.display = !!scenarioRow; opts.plugins.legend.position = 'bottom';
    opts.plugins.tooltip.callbacks = { label: (c) => c.dataset.label + ': ' + compact(cur)(c.parsed.y) };
    return new Chart(canvas, { type: 'line', data: { labels, datasets: ds }, options: opts, plugins: [bandPlugin(loan.from, loan.to, 'Loan repayments')] });
  }
  function salesCosts(canvas, m, cur) {
    const t = theme();
    const labels = m.years.map(String);
    const opts = base(t); opts.plugins.legend.display = true; opts.plugins.legend.position = 'bottom';
    opts.plugins.tooltip.callbacks = { label: (c) => c.dataset.label + ': ' + compact(cur)(c.parsed.y) };
    return new Chart(canvas, { type: 'bar', data: { labels, datasets: [
      { label: 'Sales', data: m.out.revenue.slice(1), backgroundColor: t.accent, borderRadius: 6 },
      { label: 'Running costs', data: m.out.varCost.slice(1).map((v, i) => v + m.out.fixCost[i + 1]), backgroundColor: t.slate, borderRadius: 6 },
    ] }, options: opts });
  }
  /* Waterfall from sales to cash left in one year */
  function waterfall(canvas, m, cur, year, simple) {
    const t = theme(); const o = m.out;
    const steps = [
      [simple ? 'Sales' : 'Revenue', o.revenue[year], 'total'], [simple ? 'Costs that rise with sales' : 'Variable costs', -o.varCost[year]], [simple ? 'Fixed running costs' : 'Fixed costs', -o.fixCost[year]],
      ['Tax', -o.taxCharge[year]], [simple ? 'Extra cash tied up' : 'Working capital', -o.dWC[year]], [simple ? 'Loan payments' : 'Debt service', -o.debtService[year]],
    ];
    let run = 0; const bars = [], colors = [];
    steps.forEach(([, v, kind]) => { if (kind === 'total') { bars.push([0, v]); run = v; colors.push(t.accent); } else { bars.push([run, run + v]); run += v; colors.push(v < 0 ? t.bad : t.accent); } });
    bars.push([0, run]); colors.push(run >= 0 ? t.accent : t.bad);
    // wrap long labels onto two lines so they never overlap
    const wrap = (l) => { const w = l.split(' '); if (w.length < 3) return l; const h = Math.ceil(w.length / 2); return [w.slice(0, h).join(' '), w.slice(h).join(' ')]; };
    const labels = steps.map((s) => wrap(s[0])).concat([wrap(simple ? 'Cash left' : 'Cash after debt service')]);
    const opts = base(t);
    opts.plugins.tooltip.callbacks = { label: (c) => { const [a, b] = c.raw; return compact(cur)(b - a); } };
    opts.scales.x.ticks.autoSkip = false;
    return new Chart(canvas, { type: 'bar', data: { labels, datasets: [{ data: bars, backgroundColor: colors, borderRadius: 6, barPercentage: 0.7 }] }, options: opts });
  }
  function dscrLine(canvas, m, target) {
    const t = theme(); const ys = [];
    for (let i = 1; i <= m.N; i++) if (m.out.dscr[i] !== null) ys.push(i);
    const opts = base(t); opts.plugins.legend.display = true; opts.plugins.legend.position = 'bottom';
    opts.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + 'x'; opts.scales.y.beginAtZero = true;
    opts.plugins.tooltip.callbacks = { label: (c) => c.dataset.label + ': ' + Number(c.parsed.y).toFixed(2) + 'x' };
    return new Chart(canvas, { type: 'line', data: { labels: ys.map((i) => String(m.years[i - 1])), datasets: [
      { label: 'DSCR', data: ys.map((i) => m.out.dscr[i]), borderColor: t.accent, pointRadius: 3, pointBackgroundColor: t.accent, borderWidth: 2, tension: 0 },
      { label: 'Lender minimum (' + target.toFixed(1) + 'x)', data: ys.map(() => target), borderColor: t.bad, borderDash: [6, 5], pointRadius: 0, borderWidth: 1.5 },
    ] }, options: opts });
  }
  /* What moves the result most: change in NPV for each what-if */
  function tornado(canvas, sens, cur, simple) {
    const t = theme();
    const rows = sens.ranked.map((id) => sens.results.find((r) => r.id === id));
    const opts = base(t, { indexAxis: 'y' });
    opts.scales.x.ticks.callback = short; opts.scales.x.grid = { color: t.line };
    opts.scales.y.grid = { display: false }; opts.scales.y.ticks.callback = function (v) { return this.getLabelForValue(v); };
    opts.plugins.tooltip.callbacks = { label: (c) => 'Change in value: ' + compact(cur)(c.parsed.x) };
    return new Chart(canvas, { type: 'bar', data: { labels: rows.map((r) => (simple ? r.simple : r.label)), datasets: [{ data: rows.map((r) => r.delta.npv), backgroundColor: rows.map((r) => (r.delta.npv < 0 ? t.bad : t.accent)), borderRadius: 6, barPercentage: 0.6 }] }, options: opts });
  }
  root.TenorCharts = { cashArea, salesCosts, waterfall, dscrLine, tornado };
})(typeof self !== 'undefined' ? self : this);
