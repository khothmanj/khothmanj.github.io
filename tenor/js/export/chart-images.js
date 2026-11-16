/*
 * Renders the report charts off-screen with Chart.js and returns PNG bytes for the Word report.
 * renderReportCharts(Chart, model, currency) -> Promise<{ sales, cash, dscr }>
 */
(function (root) {
  'use strict';
  const INK = '#0B1220', MUTED = '#5B6475', GRID = '#E3E6EC', GREEN = '#3550FC', SAGE = '#CBD2DE', MINT = '#8EA2FF', RED = '#C2352B'; // GREEN is the brand blue
  const W = 1200, H = 520;

  function toBytes(canvas) {
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    const bin = atob(b64); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function draw(Chart, config) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const chart = new Chart(canvas.getContext('2d'), Object.assign({}, config, {
      options: Object.assign({ responsive: false, animation: false, devicePixelRatio: 1,
        plugins: { legend: { position: 'bottom', labels: { color: INK, font: { family: 'Arial', size: 18 } } } },
        scales: { x: { ticks: { color: MUTED, font: { family: 'Arial', size: 16 } }, grid: { display: false } },
          y: { ticks: { color: MUTED, font: { family: 'Arial', size: 16 } }, grid: { color: GRID } } } }, config.options || {}),
      plugins: [{ id: 'bg', beforeDraw: (c) => { const x = c.ctx; x.save(); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height); x.restore(); } }],
    }));
    const bytes = toBytes(canvas);
    chart.destroy();
    return bytes;
  }
  async function renderReportCharts(Chart, m) {
    const labels = m.years.map(String);
    const yr = (a) => a.slice(1);
    const sales = draw(Chart, { type: 'bar', data: { labels, datasets: [
      { label: 'Sales', data: yr(m.out.revenue), backgroundColor: GREEN },
      { label: 'Running costs', data: yr(m.out.varCost).map((v, i) => v + m.out.fixCost[i + 1]), backgroundColor: SAGE },
    ] } });
    const cash = draw(Chart, { type: 'line', data: { labels, datasets: [{ label: 'Cash left after loan payments', data: yr(m.out.cashAfterDebt), borderColor: GREEN, backgroundColor: 'rgba(53,80,252,0.12)', fill: 'origin', pointRadius: 3, tension: 0 }] } });
    let dscr = null;
    if (m.loans.length) {
      const t = []; for (let i = 1; i <= m.N; i++) if (m.out.dscr[i] !== null) t.push(i);
      dscr = draw(Chart, { type: 'line', data: { labels: t.map((i) => String(m.years[i - 1])), datasets: [
        { label: 'DSCR', data: t.map((i) => m.out.dscr[i]), borderColor: GREEN, pointRadius: 3, tension: 0 },
        { label: 'Lender minimum', data: t.map(() => 1.3), borderColor: RED, borderDash: [8, 6], pointRadius: 0 },
      ] } });
    }
    void MINT;
    return { sales, cash, dscr };
  }
  root.TenorChartImages = { renderReportCharts };
})(typeof self !== 'undefined' ? self : this);
