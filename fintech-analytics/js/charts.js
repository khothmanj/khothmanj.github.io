/*
 * Signal charts: hand-built SVG so every chart shares one look, takes its colours from
 * CSS variables (dark mode switches instantly) and can carry exact annotations.
 *
 *   SignalCharts.xy(el, cfg)       line or bar chart, stacked or not, with annotations,
 *                                  a threshold band, a shaded period and a keyboard tooltip
 *   SignalCharts.spark(values)     sparkline SVG string for table rows
 *   SignalCharts.hbars(el, rows)   horizontal bars in HTML for ranked lists
 */
(function (root) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NS = 'http://www.w3.org/2000/svg';
  let chartSeq = 0;

  /* ---------- tooltip ---------- */
  let tip = null;
  function showTip(html, x, y) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); }
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 10;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 16;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  /* ---------- scales ---------- */
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function ticks(max, count) {
    if (!(max > 0)) return [0, 1];
    const step = niceStep(max / count);
    const out = [];
    for (let v = 0; v <= max + step * 0.001; v += step) out.push(+v.toFixed(10));
    if (out[out.length - 1] < max) out.push(+(out[out.length - 1] + step).toFixed(10));
    return out;
  }

  /*
   * cfg: {
   *   x: [keys], xLabel(key), xTip(key), series: [{ name, values, color, type: 'line'|'bar', dash, width }],
   *   stacked, yFormat(v), yTick(v), height, ticks, annotations: [{ x, label }],
   *   threshold: { y, label }, period: { from, to, label }, ariaLabel, legend, compact, onPick(index)
   * }
   */
  function xy(el, cfg) {
    const id = 'ch' + (++chartSeq);
    el.classList.add('chart');
    let focusIndex = null;
    const draw = () => {
      const W = Math.max(260, Math.floor(el.clientWidth || 600));
      const H = cfg.height || 260;
      const compact = cfg.compact;
      const yFmt = cfg.yTick || cfg.yFormat || String;
      const n = cfg.x.length;
      const bars = cfg.series.filter((s) => (s.type || 'line') === 'bar');
      const lines = cfg.series.filter((s) => (s.type || 'line') === 'line');
      // y range
      let max = 0;
      if (bars.length && cfg.stacked) for (let i = 0; i < n; i++) max = Math.max(max, bars.reduce((a, s) => a + (s.values[i] || 0), 0));
      else bars.forEach((s) => s.values.forEach((v) => { if (v > max) max = v; }));
      lines.forEach((s) => s.values.forEach((v) => { if (v > max) max = v; }));
      if (cfg.threshold) max = Math.max(max, cfg.threshold.y * 1.35);
      if (cfg.yMax) max = Math.max(max, cfg.yMax);
      const yt = ticks(max, cfg.ticks || (compact ? 2 : 4));
      const yMax = yt[yt.length - 1];
      // margins: measure the widest tick label roughly
      const labelW = Math.max(...yt.map((t) => String(yFmt(t)).length)) * (compact ? 6 : 6.8) + 10;
      const m = { l: Math.max(compact ? 30 : 40, labelW), r: compact ? 6 : 12, t: 10, b: compact ? 20 : 26 };
      const pw = W - m.l - m.r;
      const bw = pw / n;
      const cx = (i) => m.l + bw * (i + 0.5);
      const idx = (key) => cfg.x.indexOf(key);
      // Lay out annotation labels in rows so they never overlap.
      const placed = [];
      if (cfg.annotations && cfg.annotations.length) {
        const ends = [];
        cfg.annotations.map((a) => ({ a, i: idx(a.x) })).filter((o) => o.i >= 0).sort((p, q) => p.i - q.i).forEach(({ a, i }) => {
          const x = cx(i);
          const w = compact ? 0 : a.label.length * 6.2 + 6;
          const anchor = x + w / 2 > W - 4 ? 'end' : x - w / 2 < m.l - 30 ? 'start' : 'middle';
          const x0 = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2;
          let row = ends.findIndex((end) => x0 > end + 8);
          if (row < 0) { row = ends.length; ends.push(0); }
          ends[row] = x0 + w;
          placed.push({ a, i, x, anchor, row });
        });
        m.t = compact ? 8 : 12 + ends.length * 13;
      }
      const ph = H - m.t - m.b;
      const cy = (v) => m.t + ph - (v / yMax) * ph;

      let s = '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(cfg.ariaLabel || '') + '" tabindex="0" focusable="true">';
      // threshold band (area above the target)
      if (cfg.threshold && cfg.threshold.y < yMax) {
        const ty = cy(cfg.threshold.y);
        s += '<rect class="c-band" x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + (ty - m.t) + '"/>';
        s += '<line class="c-threshold" x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + ty + '" y2="' + ty + '"/>';
        if (!compact && cfg.threshold.label) s += '<text class="c-threshold-label" x="' + (m.l + pw - 4) + '" y="' + (ty - 5) + '" text-anchor="end">' + esc(cfg.threshold.label) + '</text>';
      }
      // shaded period
      if (cfg.period) {
        const a = idx(cfg.period.from), b = idx(cfg.period.to);
        if (a >= 0 && b >= 0) s += '<rect class="c-period" x="' + (m.l + bw * a) + '" y="' + m.t + '" width="' + (bw * (b - a + 1)) + '" height="' + ph + '"/>';
      }
      // grid and y labels
      yt.forEach((t) => {
        const y = cy(t);
        s += '<line class="c-grid' + (t === 0 ? ' c-base' : '') + '" x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + y + '" y2="' + y + '"/>';
        s += '<text class="c-ytick" x="' + (m.l - 6) + '" y="' + (y + 3.5) + '" text-anchor="end">' + esc(yFmt(t)) + '</text>';
      });
      // x labels: pick evenly spaced
      const xl = cfg.xLabel || String;
      const maxLabels = Math.max(2, Math.floor(pw / (compact ? 70 : 64)));
      const every = Math.max(1, Math.ceil(n / maxLabels));
      for (let i = 0; i < n; i += every) s += '<text class="c-xtick" x="' + cx(i) + '" y="' + (H - (compact ? 5 : 7)) + '" text-anchor="middle">' + esc(xl(cfg.x[i])) + '</text>';
      // bars
      if (bars.length) {
        const gap = Math.min(6, bw * 0.25);
        const width = cfg.stacked ? bw - gap : (bw - gap) / bars.length;
        for (let i = 0; i < n; i++) {
          let base = 0;
          bars.forEach((ser, k) => {
            const v = ser.values[i] || 0;
            if (!v) return;
            const x = cfg.stacked ? m.l + bw * i + gap / 2 : m.l + bw * i + gap / 2 + width * k;
            const y0 = cy(base + (cfg.stacked ? v : v)), y1 = cy(cfg.stacked ? base : 0);
            s += '<rect class="c-bar" style="fill:' + ser.color + '" x="' + x.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + Math.max(1, width).toFixed(1) + '" height="' + Math.max(0, y1 - y0).toFixed(1) + '" rx="' + (cfg.stacked ? 0 : 2) + '"/>';
            if (cfg.stacked) base += v;
          });
        }
      }
      // lines
      lines.forEach((ser) => {
        let d = '', pen = false;
        ser.values.forEach((v, i) => {
          if (v === null || v === undefined || isNaN(v)) { pen = false; return; }
          d += (pen ? 'L' : 'M') + cx(i).toFixed(1) + ' ' + cy(v).toFixed(1); pen = true;
        });
        if (ser.area) s += '<path class="c-area" style="fill:' + ser.color + '" d="' + d + 'L' + cx(n - 1).toFixed(1) + ' ' + cy(0) + 'L' + cx(0).toFixed(1) + ' ' + cy(0) + 'Z"/>';
        s += '<path class="c-line" style="stroke:' + ser.color + ';stroke-width:' + (ser.width || 2) + (ser.dash ? ';stroke-dasharray:' + ser.dash : '') + '" d="' + d + '"/>';
        if (ser.dots) ser.values.forEach((v, i) => { if (v !== null && v !== undefined) s += '<circle class="c-dot" style="fill:' + ser.color + '" cx="' + cx(i) + '" cy="' + cy(v) + '" r="2.6"/>'; });
      });
      // annotations
      placed.forEach(({ a, x, anchor, row }) => {
        const ly = 10 + row * 13;
        s += '<line class="c-annot" x1="' + x + '" x2="' + x + '" y1="' + (compact ? m.t - 2 : ly + 3) + '" y2="' + (m.t + ph) + '"/>';
        if (!compact) s += '<text class="c-annot-label" x="' + (x + (anchor === 'end' ? -3 : anchor === 'start' ? 3 : 0)) + '" y="' + ly + '" text-anchor="' + anchor + '">' + esc(a.label) + '</text>';
      });
      s += '<line class="c-guide" id="' + id + '-g" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ph) + '" visibility="hidden"/>';
      s += '<rect class="c-hit" x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '"/>';
      s += '</svg>';
      el.innerHTML = (cfg.legend ? legend(cfg.series) : '') + s;
      const svg = el.querySelector('svg');
      const guide = svg.getElementById ? svg.getElementById(id + '-g') : svg.querySelector('#' + id + '-g');
      const tipFor = (i) => {
        const title = (cfg.xTip || cfg.xLabel || String)(cfg.x[i]);
        const ann = (cfg.annotations || []).filter((a) => a.x === cfg.x[i]).map((a) => '<p class="tip-note">' + esc(a.label) + '</p>').join('');
        const rows = cfg.series.filter((ser) => ser.values[i] !== null && ser.values[i] !== undefined).map((ser) => '<li><span class="sw" style="background:' + ser.color + '"></span>' + esc(ser.name) + '<b>' + esc((cfg.yFormat || String)(ser.values[i])) + '</b></li>');
        const total = cfg.stacked && bars.length > 1 ? '<li class="tip-total">Total<b>' + esc((cfg.yFormat || String)(bars.reduce((a, ser) => a + (ser.values[i] || 0), 0))) + '</b></li>' : '';
        return '<p class="tip-title">' + esc(title) + '</p>' + ann + '<ul>' + rows.reverse().join('') + total + '</ul>';
      };
      const point = (i, clientX, clientY) => {
        focusIndex = i;
        guide.setAttribute('x1', cx(i)); guide.setAttribute('x2', cx(i)); guide.setAttribute('visibility', 'visible');
        showTip(tipFor(i), clientX, clientY);
      };
      const off = () => { guide.setAttribute('visibility', 'hidden'); hideTip(); };
      svg.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        const x = (e.clientX - r.left) * (W / r.width);
        const i = Math.max(0, Math.min(n - 1, Math.floor((x - m.l) / bw)));
        point(i, e.clientX, e.clientY);
      });
      svg.addEventListener('pointerleave', off);
      svg.addEventListener('blur', off);
      svg.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape', 'Enter'].includes(e.key)) return;
        e.preventDefault();
        if (e.key === 'Escape') return off();
        if (e.key === 'Enter' && cfg.onPick && focusIndex !== null) return cfg.onPick(focusIndex);
        let i = focusIndex === null ? n - 1 : focusIndex;
        i = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        const r = svg.getBoundingClientRect();
        point(i, r.left + (cx(i) / W) * r.width, r.top + 30);
      });
      if (cfg.onPick) svg.addEventListener('click', () => { if (focusIndex !== null) cfg.onPick(focusIndex); });
    };
    draw();
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - lastW) > 4) { lastW = el.clientWidth; draw(); } });
    ro.observe(el);
    return { redraw: draw, destroy: () => ro.disconnect() };
  }

  function legend(series) {
    return '<ul class="legend">' + series.map((s) => '<li><span class="sw' + (s.type === 'line' || !s.type ? ' sw-line' : '') + '" style="background:' + s.color + '"></span>' + esc(s.name) + '</li>').join('') + '</ul>';
  }

  /* ---------- sparkline ---------- */
  function spark(values, opts = {}) {
    const w = opts.w || 92, h = opts.h || 26, p = 2.5;
    const vals = values.map(Number).filter((v) => !isNaN(v));
    if (vals.length < 2) return '';
    const max = Math.max(...vals), min = opts.zero ? 0 : Math.min(...vals);
    const span = max - min || 1;
    const pts = vals.map((v, i) => [p + (i / (vals.length - 1)) * (w - 2 * p), h - p - ((v - min) / span) * (h - 2 * p)]);
    const last = pts[pts.length - 1];
    return '<svg class="spark' + (opts.tone ? ' ' + opts.tone : '') + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><polyline points="' + pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') + '"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.4"/></svg>';
  }

  /* ---------- horizontal bars ---------- */
  // rows: [{ label, value, display, sub, highlight, href }]
  function hbars(el, rows, opts = {}) {
    const max = opts.max || Math.max(...rows.map((r) => r.value), 1);
    el.innerHTML = '<ol class="hbars' + (opts.numbered ? ' numbered' : '') + '">' + rows.map((r) => '<li' + (r.highlight ? ' class="hl"' : '') + '>' +
      '<span class="hb-label">' + (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.label) + '</a>' : esc(r.label)) + (r.sub ? '<span class="hb-sub">' + esc(r.sub) + '</span>' : '') + '</span>' +
      '<span class="hb-track"><span class="hb-fill" style="width:' + Math.max(0.5, (r.value / max) * 100).toFixed(2) + '%"></span></span>' +
      '<span class="hb-value">' + esc(r.display) + '</span></li>').join('') + '</ol>';
  }

  root.SignalCharts = { xy, spark, hbars, showTip, hideTip, ticks };
})(window);
