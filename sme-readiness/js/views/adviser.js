/*
 * Adviser view (#adviser, #adviser/<client>): for someone supporting several small businesses.
 * A client list with level, last check and plan progress; a client page comparing two checks side
 * by side; and a full client report exported as Word. The four clients are fictional samples.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;
  const S = () => root.KinholdScoring, R = () => root.KinholdRecommend;
  const SECTOR = { shop: 'Shop', salon: 'Salon', office: 'Office', clinic: 'Clinic', trades: 'Trades', ecommerce: 'Online shop', other: 'Other' };
  const SIZE = { solo: 'Just me', micro: '2 to 9 staff', small: '10 to 49 staff', medium: '50 to 249 staff' };

  // Everything the adviser screens need about one client, worked out from its saved checks.
  function analyse(c, iBefore, iAfter) {
    const { data } = A;
    const checks = c.checks.map((k) => ({ date: k.date, answers: k.answers, r: S().score(data.questions, c.profile, k.answers) }));
    const after = checks[iAfter === undefined ? checks.length - 1 : iAfter];
    const before = checks.length > 1 ? checks[iBefore === undefined ? checks.length - 2 : iBefore] : null;
    const actions = R().rank(data.questions, data.recommendations, c.profile, after.answers);
    const plan = R().plan(actions);
    const prog = R().progress(plan, c.done);
    return { c, checks, before, after, actions, plan, prog, cmp: before ? S().compare(before.r, after.r) : null };
  }

  function render(el, ctx) {
    const id = ctx.route.args[0];
    const client = id && A.data.sample_clients.clients.find((x) => x.id === id);
    if (client) return detail(el, client, ctx.route.query);
    list(el);
  }

  /* ---------- client list ---------- */
  function list(el) {
    const { esc, data } = A;
    const rows = data.sample_clients.clients.map((c) => analyse(c));
    const openEssentials = rows.reduce((n, x) => n + x.after.r.criticalGaps.length, 0);
    const avgChange = Math.round(rows.reduce((n, x) => n + (x.cmp ? x.cmp.change : 0), 0) / rows.length);
    el.innerHTML =
      '<header class="page-head"><h1>Your clients</h1><p>For advisers and IT partners supporting several small businesses. See where each client stands, what changed since their last check, and export a report to share with them.</p></header>' +
      '<p class="sample-flag">' + A.status('Sample clients', 'clay', 'star') + '<span class="muted">Four fictional businesses, so you can explore straight away.</span></p>' +
      '<section class="adv-stats" aria-label="Across all clients">' +
        stat(rows.length, 'clients') +
        stat((avgChange >= 0 ? '+' : '') + avgChange, 'points on average since their last check') +
        stat(openEssentials, openEssentials === 1 ? 'essential still missing' : 'essentials still missing', openEssentials ? 'clay' : '') +
        stat(rows.reduce((n, x) => n + x.prog.done, 0) + ' of ' + rows.reduce((n, x) => n + x.prog.total, 0), 'plan steps done') +
      '</section>' +
      '<section class="glass card adv-list" aria-labelledby="cl-h"><div class="card-head"><h2 id="cl-h">Clients</h2></div>' +
        '<div class="table-wrap"><table class="clients"><thead><tr><th scope="col">Client</th><th scope="col">Level</th><th scope="col">Since last check</th><th scope="col">Last check</th><th scope="col">Plan progress</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead><tbody>' +
        rows.map((x) => {
          const r = x.after.r;
          return '<tr data-href="#adviser/' + x.c.id + '">' +
            '<th scope="row"><a href="#adviser/' + x.c.id + '">' + esc(x.c.name) + '</a><span class="muted">' + esc(SECTOR[x.c.profile.sector] || '') + ' · ' + esc(x.c.town) + '</span></th>' +
            '<td>' + A.levelStatus(r.level, r.levelInfo.label) + (r.capped ? '<span class="muted small">Held by a missing essential</span>' : '') + '</td>' +
            '<td>' + (x.cmp ? A.status((x.cmp.change >= 0 ? 'Up ' : 'Down ') + Math.abs(x.cmp.change) + ' points', x.cmp.change > 0 ? 'good' : x.cmp.change < 0 ? 'bad' : '', x.cmp.change > 0 ? 'up' : x.cmp.change < 0 ? 'down' : 'minus') + '<span class="muted small">' + x.cmp.before + ' to ' + x.cmp.after + '</span>' : '<span class="muted">First check</span>') + '</td>' +
            '<td><span class="m-lbl">Last check </span>' + A.formatDate(x.after.date) + '</td>' +
            '<td><div class="mini-bar" aria-hidden="true"><span style="width:' + x.prog.percent + '%"></span></div><span class="muted small">' + x.prog.done + ' of ' + x.prog.total + ' steps</span></td>' +
            '<td class="go" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg></td></tr>';
        }).join('') + '</tbody></table></div></section>' +
      '<p class="note"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg>In a real product, each client would complete the check on their own device and share it with you. Here the clients and their answers are sample data.</p>';
    el.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) A.go(tr.dataset.href); }));
  }
  const stat = (n, label, tone) => '<div class="adv-stat glass"><b class="' + (tone || '') + '">' + n + '</b><span>' + label + '</span></div>';

  /* ---------- one client ---------- */
  function detail(el, c, query) {
    const { esc } = A;
    const n = c.checks.length;
    const ib = Math.min(Math.max(+(query.get('a') || n - 2), 0), n - 1);
    const ia = Math.min(Math.max(+(query.get('b') || n - 1), 0), n - 1);
    const x = analyse(c, ib, ia);
    const r = x.after.r;
    const sum = R().summary(A.data.questions, r, x.actions, c.name);
    const opt = (sel) => x.checks.map((k, i) => '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + A.formatDate(k.date) + ' · ' + k.r.score + '</option>').join('');

    el.innerHTML =
      '<a class="back-link" href="#adviser"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>All clients</a>' +
      '<header class="client-head glass">' +
        '<div><p class="kicker">' + esc(c.contact) + ' · ' + esc(SECTOR[c.profile.sector] || '') + ' · ' + esc(SIZE[c.profile.size] || '') + ' · ' + esc(c.town) + '</p><h1>' + esc(c.name) + '</h1>' +
          '<p>' + A.levelStatus(r.level, r.levelInfo.label) + ' <span class="muted">' + r.score + ' of 100 on ' + A.formatDate(x.after.date) + '</span></p></div>' +
        '<div class="hero-actions"><button class="btn btn-primary" type="button" id="export"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10"/></svg>Export report (Word)</button><button class="btn" type="button" id="open-as">Open as this business</button></div>' +
        '<p class="dl-status muted small" id="ex-status" role="status"></p>' +
      '</header>' +
      '<section class="glass card"><div class="card-head"><h2>Summary</h2></div><p class="lead-sm">' + esc(sum.headline) + '</p>' + sum.paragraphs.map((p) => '<p class="muted">' + esc(p) + '</p>').join('') + '</section>' +
      (n > 1 ? '<section class="glass card" aria-labelledby="cmp-h"><div class="card-head cmp-head"><div><h2 id="cmp-h">Compare two checks</h2><p>Area by area, side by side.</p></div>' +
        '<div class="cmp-pick"><label>From<select class="input" id="pa">' + opt(ib) + '</select></label><label>To<select class="input" id="pb">' + opt(ia) + '</select></label></div></div>' +
        compareHtml(x) + '</section>' : '') +
      '<div class="adv-two">' +
        '<section class="glass card"><div class="card-head"><h2>Top actions now</h2><p>Ranked by risk reduced for the effort.</p></div><ol class="adv-actions">' +
          x.actions.slice(0, 5).map((a) => '<li><b>' + esc(a.rec.title) + '</b>' + (a.critical ? A.status('Essential', 'clay', 'star') : '') + '<span class="muted small">' + esc(a.rec.owner) + ' · ' + a.rec.minutes + ' min · ' + esc(a.rec.cost) + '</span></li>').join('') + '</ol></section>' +
        '<section class="glass card"><div class="card-head"><h2>Plan progress</h2><p>' + x.prog.done + ' of ' + x.prog.total + ' steps done.</p></div><ul class="adv-phases">' +
          x.prog.phases.filter((p) => p.total).map((p) => '<li><span>' + esc(x.plan.find((q) => q.id === p.id).label) + '</span><div class="mini-bar" aria-hidden="true"><span style="width:' + (100 * p.done / p.total) + '%"></span></div><span class="muted small">' + p.done + ' of ' + p.total + '</span></li>').join('') + '</ul></section>' +
      '</div>';

    const pick = () => A.go('#adviser/' + c.id + '?a=' + el.querySelector('#pa').value + '&b=' + el.querySelector('#pb').value);
    if (n > 1) { el.querySelector('#pa').addEventListener('change', pick); el.querySelector('#pb').addEventListener('change', pick); }
    el.querySelector('#open-as').addEventListener('click', () => { A.loadSample(c.id); A.go('#results'); });
    el.querySelector('#export').addEventListener('click', async (e) => {
      const btn = e.currentTarget, st = el.querySelector('#ex-status');
      btn.disabled = true; st.textContent = 'Preparing the report…';
      try {
        await A.toolkit.loadDocx();
        const blob = await root.docx.Packer.toBlob(report(x, sum));
        const name = c.name.toLowerCase().replace(/[^\w]+/g, '-') + '-kinhold-report-' + x.after.date + '.docx';
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        st.textContent = 'Downloaded ' + name + '.';
      } catch (err) { console.warn(err); st.textContent = 'The report couldn\'t be made. Check your connection and try again.'; }
      finally { btn.disabled = false; }
    });
  }

  function compareHtml(x) {
    const { esc } = A;
    if (!x.cmp) return '';
    const cmp = x.cmp;
    const cell = (v, lvl) => v === null ? '<span class="muted">Not asked</span>' : '<span class="cmp-score">' + v + '</span><span class="lvl">' + A.levelStatus(lvl, S().LEVELS[lvl].label) + '</span>';
    return '<div class="cmp-totals"><div><span class="muted small">' + A.formatDate(x.before.date) + '</span><b>' + cmp.before + '</b>' + A.levelStatus(cmp.levelBefore, S().LEVELS[cmp.levelBefore].label) + '</div>' +
        '<div class="cmp-arrow">' + A.status((cmp.change >= 0 ? 'Up ' : 'Down ') + Math.abs(cmp.change), cmp.change > 0 ? 'good' : cmp.change < 0 ? 'bad' : '', cmp.change > 0 ? 'up' : cmp.change < 0 ? 'down' : 'minus') + '<span class="muted small">' + cmp.fixed.length + (cmp.fixed.length === 1 ? ' gap' : ' gaps') + ' closed</span></div>' +
        '<div><span class="muted small">' + A.formatDate(x.after.date) + '</span><b>' + cmp.after + '</b>' + A.levelStatus(cmp.levelAfter, S().LEVELS[cmp.levelAfter].label) + '</div></div>' +
      '<div class="table-wrap"><table class="cmp-table"><thead><tr><th scope="col">Area</th><th scope="col">' + A.formatDate(x.before.date) + '</th><th scope="col">' + A.formatDate(x.after.date) + '</th><th scope="col">Change</th></tr></thead><tbody>' +
      cmp.areas.filter((a) => a.after !== null || a.before !== null).map((a) => '<tr><th scope="row">' + esc(a.title) + '</th><td>' + cell(a.before, a.levelBefore) + '</td><td>' + cell(a.after, a.levelAfter) + '</td><td>' +
        (a.change === null ? '' : a.change === 0 ? '<span class="muted">No change</span>' : A.status((a.change > 0 ? '+' : '') + a.change, a.change > 0 ? 'good' : 'bad', a.change > 0 ? 'up' : 'down')) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }

  /* ---------- Word report ---------- */
  function report(x, sum) {
    const D = root.docx, { data } = A;
    const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType } = D;
    const font = 'Calibri', c = x.c, r = x.after.r;
    const P = (text, o) => new Paragraph(Object.assign({ spacing: { after: 120 }, children: [new TextRun(Object.assign({ text }, (o && o.run) || {}))] }, o && o.para));
    const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 80 }, children: [new TextRun(t)] });
    const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 }, children: [new TextRun(t)] });
    const cell = (t, o) => new TableCell({ width: o && o.w ? { size: o.w, type: WidthType.PERCENTAGE } : undefined, shading: o && o.head ? { type: ShadingType.CLEAR, fill: 'F1EBE3', color: 'auto' } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: String(t), bold: !!(o && o.head) })] })] });
    const table = (head, rows, widths) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, { head: true, w: widths[i] })) })].concat(rows.map((row) => new TableRow({ children: row.map((v, i) => cell(v, { w: widths[i] })) }))) });
    const lvl = (i) => (i === null || i === undefined ? 'Not asked' : S().LEVELS[i].label);
    const kids = [];

    kids.push(H1(c.name + ': cyber, fraud and AI readiness'));
    kids.push(P('Report from Kinhold · check completed ' + A.formatDate(x.after.date) + ' · ' + (SECTOR[c.profile.sector] || '') + ', ' + (SIZE[c.profile.size] || '').toLowerCase() + ', ' + c.town, { run: { color: '6A5F57', size: 20 } }));
    kids.push(H2('Summary'));
    kids.push(P('Readiness level: ' + r.levelInfo.label + ' (' + r.score + ' of 100)', { run: { bold: true } }));
    kids.push(P(sum.headline));
    sum.paragraphs.forEach((p) => kids.push(P(p)));
    if (x.cmp) kids.push(P('Since the check on ' + A.formatDate(x.before.date) + ': ' + (x.cmp.change >= 0 ? 'up ' : 'down ') + Math.abs(x.cmp.change) + ' points, with ' + x.cmp.fixed.length + (x.cmp.fixed.length === 1 ? ' gap' : ' gaps') + ' closed.'));

    kids.push(H2('Results by area'));
    const areaRows = r.areas.filter((a) => a.score !== null).map((a) => {
      const b = x.cmp && x.cmp.areas.find((q) => q.id === a.id);
      return [a.title, a.score + ' (' + lvl(a.level) + ')', b && b.before !== null ? String(b.before) : '', b && b.change !== null ? (b.change > 0 ? '+' : '') + b.change : ''];
    });
    kids.push(table(['Area', 'Now', 'Before', 'Change'], areaRows, [46, 26, 14, 14]));

    kids.push(H2('Top actions'));
    x.actions.slice(0, 5).forEach((a, i) => {
      kids.push(new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: (i + 1) + '. ' + a.rec.title, bold: true }), new TextRun({ text: a.critical ? '  (essential)' : '', color: 'A6492A' })] }));
      kids.push(P(a.rec.summary));
      kids.push(P('Owner: ' + a.rec.owner + ' · about ' + a.rec.minutes + ' minutes · ' + a.rec.cost, { run: { color: '6A5F57', size: 20 } }));
      a.rec.steps.forEach((s) => kids.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun(s)] })));
    });

    kids.push(H2('Action plan progress'));
    kids.push(P(x.prog.done + ' of ' + x.prog.total + ' steps done (' + x.prog.percent + '%).'));
    kids.push(table(['Phase', 'Done', 'Steps still to do'], x.plan.filter((p) => p.actions.length).map((p) => {
      const done = new Set(c.done);
      const left = p.actions.filter((a) => !done.has(a.id));
      return [p.label, (p.actions.length - left.length) + ' of ' + p.actions.length, left.map((a) => (A.data.recById[a.id] || {}).title || a.id).join('; ') || 'All done'];
    }), [22, 14, 64]));

    kids.push(H2('Sources'));
    const used = [...new Set(x.actions.slice(0, 5).flatMap((a) => a.rec.sources))].map((id) => data.sourceById[id]).filter(Boolean);
    used.forEach((s) => kids.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: s.publisher + ': ' + s.title + '. ' }), new TextRun({ text: s.url, color: '6A5F57' })] })));

    kids.push(P('This report gives guidance based on UK government and regulator advice. It is not an audit and does not mean the business is certified or meets any legal standard. Kinhold is a portfolio prototype and this client is fictional sample data.', { para: { spacing: { before: 360 } }, run: { color: '6A5F57', size: 18 } }));

    return new D.Document({
      creator: 'Kinhold', title: c.name + ' readiness report',
      styles: {
        default: { document: { run: { font, size: 22, color: '1F1A17' } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font, size: 36, bold: true, color: '1F1A17' } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font, size: 26, bold: true, color: 'A6492A' } },
        ],
      },
      sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids }],
    });
  }

  A.register('adviser', { render });
})(window);
