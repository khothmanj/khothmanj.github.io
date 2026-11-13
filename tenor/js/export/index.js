/*
 * Tenor downloads: one entry point for all four outputs and the input template.
 * In the browser the libraries are loaded on demand from jsDelivr (pinned versions) the first time a download
 * is requested. In Node, pass the libraries in.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports && typeof window === 'undefined';
  const req = (p) => (isNode ? require(p) : null);
  const X = isNode ? req('./xlsx.js') : root.TenorXlsx;
  const W = isNode ? req('./docx.js') : root.TenorDocx;
  const Pp = isNode ? req('./pptx.js') : root.TenorPptx;
  const Cs = isNode ? req('./csv.js') : root.TenorCsv;
  const Nv = isNode ? req('../narrative.js') : root.TenorNarrative;

  /* Pinned CDN builds (versions at least two weeks old when chosen, see Phase 0). */
  const CDN = {
    ExcelJS: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
    docx: 'https://cdn.jsdelivr.net/npm/docx@9.15.0/dist/index.iife.js',
    PptxGenJS: 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js',
    JSZip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js',
  };
  const loading = {};
  function loadScript(globalName) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    if (!loading[globalName]) loading[globalName] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CDN[globalName]; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (root[globalName] ? resolve(root[globalName]) : reject(new Error(globalName + ' did not load')));
      s.onerror = () => { delete loading[globalName]; reject(new Error('Could not download ' + globalName + '. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
    return loading[globalName];
  }

  const slug = (s) => String(s || 'tenor-plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tenor-plan';
  const MIME = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
  };
  const ctxWith = (ctx) => Object.assign({ narrative: Nv, audience: 'simple' }, ctx);

  async function excel(libs, ctx) {
    const B = X.buildModel(libs.ExcelJS, ctxWith(ctx));
    const data = await B.wb.xlsx.writeBuffer();
    return { name: slug(ctx.input.name) + '-financial-model.xlsx', data: isNode ? Buffer.from(data) : new Blob([data], { type: MIME.xlsx }), mime: MIME.xlsx };
  }
  async function word(libs, ctx) {
    const doc = W.buildReport(libs.docx, ctxWith(ctx));
    const data = isNode ? await libs.docx.Packer.toBuffer(doc) : await libs.docx.Packer.toBlob(doc);
    return { name: slug(ctx.input.name) + '-report.docx', data, mime: MIME.docx };
  }
  async function deck(libs, ctx) {
    const p = Pp.buildDeck(libs.PptxGenJS, ctxWith(ctx));
    const data = await p.write({ outputType: isNode ? 'nodebuffer' : 'blob' });
    return { name: slug(ctx.input.name) + '-presentation.pptx', data, mime: MIME.pptx };
  }
  async function csvZip(libs, ctx) {
    const z = Cs.buildCsvZip(libs.JSZip, ctxWith(ctx));
    const data = await z.generateAsync({ type: isNode ? 'nodebuffer' : 'blob', compression: 'DEFLATE' });
    return { name: slug(ctx.input.name) + '-data-csv.zip', data, mime: MIME.zip };
  }
  async function template(libs, ctx) {
    const wb = X.buildTemplate(libs.ExcelJS, ctx);
    const data = await wb.xlsx.writeBuffer();
    return { name: 'tenor-input-template-' + (ctx.sector || 'project') + '.xlsx', data: isNode ? Buffer.from(data) : new Blob([data], { type: MIME.xlsx }), mime: MIME.xlsx };
  }
  async function buildAll(libs, ctx) {
    return [await excel(libs, ctx), await word(libs, ctx), await deck(libs, ctx), await csvZip(libs, ctx)];
  }

  /* Browser helpers: load what a download needs, build it, and save it. */
  const NEEDS = { excel: ['ExcelJS'], word: ['docx'], deck: ['PptxGenJS'], csv: ['JSZip'], template: ['ExcelJS'] };
  const BUILDERS = { excel, word, deck, csv: csvZip, template };
  async function download(kind, ctx) {
    const libs = {};
    for (const g of NEEDS[kind]) libs[g] = await loadScript(g);
    const file = await BUILDERS[kind](libs, ctx);
    const url = URL.createObjectURL(file.data);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return file;
  }
  async function readTemplate(file) {
    const ExcelJS = await loadScript('ExcelJS');
    return X.parseTemplate(ExcelJS, await file.arrayBuffer());
  }

  const api = { excel, word, deck, csvZip, template, buildAll, download, readTemplate, loadScript, CDN };
  if (isNode) module.exports = api;
  else root.TenorExport = api;
})(typeof self !== 'undefined' ? self : this);
