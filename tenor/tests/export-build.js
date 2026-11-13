/*
 * Builds the Excel model (and other downloads) for every library case in Node, for QA.
 * Usage: NODE_PATH=<folder with exceljs, docx, pptxgenjs, jszip> node tenor/tests/export-build.js <outDir> [--no-cache] [--all-formats]
 */
const path = require('path');
const fs = require('fs');
const dir = path.join(__dirname, '..');
const E = require(path.join(dir, 'js/engine.js'));
const A = require(path.join(dir, 'js/adapter.js'));
const X = require(path.join(dir, 'js/export/xlsx.js'));
const ExcelJS = require('exceljs');
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'data', f), 'utf8'));
const cases = load('cases.json'), sectors = load('sectors.json'), defaults = load('defaults.json');
const out = process.argv[2];
const noCache = process.argv.includes('--no-cache');
const allFormats = process.argv.includes('--all-formats');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const manifest = [];
  for (const c of cases.cases) {
    const input = A.caseToInput(c, sectors, defaults);
    const model = E.run(input);
    const sens = E.sensitivities(input, model);
    const ready = E.readiness(input, model, sectors);
    const B = X.buildModel(ExcelJS, { input, model, sens, ready, caseRecord: c, sectors, engine: E, similar: [] });
    if (noCache) B.wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((cell) => { if (cell.value && cell.value.formula) cell.value = { formula: cell.value.formula }; })));
    const file = path.join(out, c.id + '.xlsx');
    await B.wb.xlsx.writeFile(file);
    fs.writeFileSync(path.join(out, c.id + '.cached.json'), JSON.stringify(B.cached));
    manifest.push({ id: c.id, file, cells: B.cached.length });
    if (allFormats) {
      const exp = require(path.join(dir, 'js/export/index.js'));
      const files = await exp.buildAll({ ExcelJS, docx: require('docx'), PptxGenJS: require('pptxgenjs'), JSZip: require('jszip') }, { input, model, sens, ready, caseRecord: c, sectors, engine: E, charts: null, node: true });
      for (const f of files) fs.writeFileSync(path.join(out, f.name), f.data);
    }
    process.stdout.write('.');
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nBuilt ' + manifest.length + ' workbooks in ' + out);
})().catch((e) => { console.error(e); process.exit(1); });
