/*
 * Toolkit (#toolkit, #toolkit?t=id): four ready-to-use documents, filled in with the business's
 * details as you type, shown as a page preview and downloadable as Word or printable.
 * The Word file is built in the browser with docx 9.15.0, loaded only when someone downloads.
 */
(function (root) {
  'use strict';
  const A = root.KinholdApp;
  const DOCX_URL = 'https://cdn.jsdelivr.net/npm/docx@9.15.0/dist/index.iife.js';

  function values(T) {
    const s = A.store.get();
    const saved = s.toolkit || {};
    const v = {};
    T.fields.forEach((f) => { v[f.id] = saved[f.id] !== undefined && saved[f.id] !== '' ? saved[f.id] : f.default; });
    if (!saved.business && s.business) v.business = s.business;
    v.date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return v;
  }
  // Fill {tokens}. A value starts with a capital only at the start of a sentence, so "the owner"
  // reads "Ask the owner" mid-sentence and "The owner will never…" at the start.
  const fill = (str, v) => String(str).replace(/\{(\w+)\}/g, (m, k, at, all) => {
    if (v[k] === undefined) return m;
    const val = String(v[k]);
    return /(^|[.:!?]\s+|^")$/.test(all.slice(Math.max(0, at - 3), at)) || at === 0 ? val.charAt(0).toUpperCase() + val.slice(1) : val;
  });
  const shown = (b, profile) => !b.if || (profile || {})[b.if] === 'yes';

  function render(el, ctx) {
    const { esc, data } = A;
    const T = data.templates;
    const id = ctx.route.query.get('t') || T.templates[0].id;
    const tpl = T.templates.find((t) => t.id === id) || T.templates[0];
    const state = A.store.get();
    const fields = T.fields.filter((f) => !f.templates || f.templates.includes(tpl.id));
    const v = values(T);

    el.innerHTML =
      '<header class="page-head"><h1>Toolkit</h1><p>Four documents most small businesses need, written in plain English from UK guidance. Add your details and they\'re filled in as you type. Download as Word to edit further, or print.</p></header>' +
      '<nav class="tpl-tabs" aria-label="Templates">' + T.templates.map((t) =>
        '<a class="tpl-tab glass" href="#toolkit?t=' + t.id + '"' + (t.id === tpl.id ? ' aria-current="page"' : '') + '>' + A.ill(t.illustration) + '<span><b>' + esc(t.title) + '</b><small>' + esc(t.pages) + '</small></span></a>').join('') +
      '</nav>' +
      '<div class="toolkit">' +
        '<section class="glass card tk-form" aria-labelledby="tk-h">' +
          '<div class="card-head"><h2 id="tk-h">' + esc(tpl.title) + '</h2><p>' + esc(tpl.summary) + '</p></div>' +
          '<form id="tk-fields" autocomplete="off">' + fields.map((f) =>
            '<label class="field">' + esc(f.label) + (f.hint ? '<small>' + esc(f.hint) + '</small>' : '') +
            '<input class="input" name="' + f.id + '" value="' + esc(v[f.id] && v[f.id] === f.default && /^\[/.test(f.default) ? '' : v[f.id]) + '" placeholder="' + esc(f.default) + '"' + (f.id === 'threshold' || f.id === 'delay' ? ' inputmode="numeric"' : '') + '></label>').join('') +
          '</form>' +
          '<div class="hero-actions"><button class="btn btn-primary btn-lg" type="button" id="dl"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10"/></svg>Download Word file</button><button class="btn btn-lg" type="button" id="print"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z"/></svg>Print</button></div>' +
          '<p class="dl-status muted small" id="dl-status" role="status"></p>' +
          (tpl.blocks.some((b) => b.if) ? '<p class="muted small">' + (state.profile ? 'Sections are included or left out based on your check answers.' : 'Some sections only appear once you\'ve done the check, for example the chatbot section.') + '</p>' : '') +
          '<p class="src">Written from: ' + A.sourceLinks(tpl.sources) + '</p>' +
          '<p class="note small"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.5M8 5.3v.2"/></svg>A starting point, not legal advice. Read it through and change anything that doesn\'t match how your business works.</p>' +
        '</section>' +
        '<section class="paper-wrap" aria-label="Document preview"><article class="paper" id="paper"></article></section>' +
      '</div>';

    const paper = el.querySelector('#paper');
    const form = el.querySelector('#tk-fields');
    const current = () => {
      const s = A.store.get(), out = values(T);
      fields.forEach((f) => { const val = form.elements[f.id].value.trim(); out[f.id] = val || f.default; });
      return { v: out, profile: s.profile };
    };
    const draw = () => { const c = current(); paper.innerHTML = html(tpl, c.v, c.profile); };
    draw();
    let t;
    form.addEventListener('input', () => {
      draw();
      clearTimeout(t);
      t = setTimeout(() => {
        const saved = Object.assign({}, A.store.get().toolkit || {});
        fields.forEach((f) => { saved[f.id] = form.elements[f.id].value.trim(); });
        A.store.save({ toolkit: saved });
      }, 400);
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    el.querySelector('#print').addEventListener('click', () => root.print());
    el.querySelector('#dl').addEventListener('click', async (e) => {
      const btn = e.currentTarget, st = el.querySelector('#dl-status');
      btn.disabled = true; st.textContent = 'Preparing your Word file…';
      try {
        await loadDocx();
        const c = current();
        const blob = await root.docx.Packer.toBlob(wordDoc(tpl, c.v, c.profile));
        const name = (c.v.business + ' ' + tpl.title).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.docx';
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        st.textContent = 'Downloaded ' + name + '.';
      } catch (err) {
        st.textContent = 'The Word file couldn\'t be made. Check your connection and try again, or use Print instead.';
      } finally { btn.disabled = false; }
    });
  }

  function html(tpl, v, profile) {
    const { esc } = A;
    const f = (s) => esc(fill(s, v));
    return tpl.blocks.filter((b) => shown(b, profile)).map((b) => {
      switch (b.t) {
        case 'h': return '<h2 class="doc-title">' + f(b.x) + '</h2>';
        case 'meta': return '<p class="meta">' + f(b.x) + '</p>';
        case 'h2': return '<h3>' + f(b.x) + '</h3>';
        case 'p': return '<p>' + f(b.x) + '</p>';
        case 'ul': return '<ul>' + b.items.map((i) => '<li>' + f(i) + '</li>').join('') + '</ul>';
        case 'ol': return '<ol>' + b.items.map((i) => '<li>' + f(i) + '</li>').join('') + '</ol>';
        case 'check': return '<ul class="checks-list">' + b.items.map((i) => '<li><span class="box" aria-hidden="true"></span>' + f(i) + '</li>').join('') + '</ul>';
        case 'table': return '<table><tbody>' + b.rows.map((r) => '<tr><th scope="row">' + f(r[0]) + '</th><td>' + f(r[1]) + '</td></tr>').join('') + '</tbody></table>';
        case 'field': return '<p class="fill"><span>' + f(b.x) + '</span><span class="line" aria-hidden="true"></span></p>';
        case 'sign': return '<div class="sign"><p>' + f(b.x) + '</p><p class="fill"><span>Name</span><span class="line" aria-hidden="true"></span></p><p class="fill"><span>Signed</span><span class="line" aria-hidden="true"></span><span>Date</span><span class="line short" aria-hidden="true"></span></p></div>';
        default: return '';
      }
    }).join('') + '<p class="foot">Made with Kinhold. Based on UK guidance from the NCSC, the ICO and Stop! Think Fraud. Not legal advice.</p>';
  }

  function loadDocx() {
    if (root.docx) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = DOCX_URL; s.onload = () => (root.docx ? res() : rej(new Error('docx'))); s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function wordDoc(tpl, v, profile) {
    const D = root.docx;
    const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = D;
    const t = (s) => fill(s, v);
    const font = 'Calibri';
    const kids = [];
    const line = '____________________________';
    tpl.blocks.filter((b) => shown(b, profile)).forEach((b) => {
      switch (b.t) {
        case 'h': kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [new TextRun({ text: t(b.x) })] })); break;
        case 'meta': kids.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: t(b.x), color: '6A5F57', size: 20 })] })); break;
        case 'h2': kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [new TextRun({ text: t(b.x) })] })); break;
        case 'p': kids.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun(t(b.x))] })); break;
        case 'ul': b.items.forEach((i) => kids.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(t(i))] }))); break;
        case 'ol': b.items.forEach((i, n) => kids.push(new Paragraph({ indent: { left: 360, hanging: 360 }, spacing: { after: 60 }, children: [new TextRun({ text: (n + 1) + '.\t', bold: true }), new TextRun(t(i))] }))); break;
        case 'check': b.items.forEach((i) => kids.push(new Paragraph({ indent: { left: 360, hanging: 360 }, spacing: { after: 60 }, children: [new TextRun({ text: '☐\t', size: 24 }), new TextRun(t(i))] }))); break;
        case 'table':
          kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: b.rows.map((r) => new TableRow({ children: [
            new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t(r[0]), bold: true })] })] }),
            new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new Paragraph(t(r[1]))] }),
          ] })) }));
          break;
        case 'field': kids.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: t(b.x) + ': ', bold: true }), new TextRun(line)] })); break;
        case 'sign':
          kids.push(new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: t(b.x), italics: true })] }));
          kids.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Name: ', bold: true }), new TextRun(line)] }));
          kids.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Signed: ', bold: true }), new TextRun(line), new TextRun({ text: '   Date: ', bold: true }), new TextRun('____________')] }));
          break;
      }
    });
    kids.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 360 }, children: [new TextRun({ text: 'Made with Kinhold. Based on UK guidance from the NCSC, the ICO and Stop! Think Fraud. Not legal advice.', color: '6A5F57', size: 16 })] }));
    return new D.Document({
      creator: 'Kinhold', title: t(tpl.title),
      styles: {
        default: { document: { run: { font, size: 22, color: '1F1A17' } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font, size: 34, bold: true, color: '1F1A17' } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font, size: 25, bold: true, color: 'A6492A' } },
        ],
      },
      sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids }],
    });
  }

  A.register('toolkit', { render });
  A.toolkit = { html, fill, loadDocx };
})(window);
