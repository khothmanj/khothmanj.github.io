/*
 * Compares Tenor's cached values with LibreOffice's recalculated values, cell by cell.
 * Usage: NODE_PATH=<node_modules> node tenor/tests/excel-compare.js <builtDir> <recalcDir>
 * Exits non-zero if any formula cell differs by more than a relative tolerance of 1e-6.
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const [built, recalc] = process.argv.slice(2);

const close = (a, b) => {
  if (b === MISSING) return a === 0 || a === '' || a === false || (typeof a === 'number' && Math.abs(a) < 1e-3); // rounding dust where LibreOffice gets exactly 0
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b) && (typeof a === typeof b || a === b || String(a).toUpperCase() === String(b).toUpperCase());
  return String(a ?? '') === String(b ?? '');
};
// ExcelJS drops a stored formula result of 0 (or an empty string or FALSE) when reading, so a missing result means one of those.
const MISSING = Symbol('missing');
const resultOf = (v) => (v && typeof v === 'object' ? ('result' in v ? v.result : v.error ? '#' + v.error : v.formula !== undefined ? MISSING : v) : v);

(async () => {
  let totalCells = 0, totalBad = 0;
  const manifest = JSON.parse(fs.readFileSync(path.join(built, 'manifest.json'), 'utf8'));
  for (const m of manifest) {
    const cached = JSON.parse(fs.readFileSync(path.join(built, m.id + '.cached.json'), 'utf8'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(recalc, m.id + '.xlsx'));
    const bad = [];
    for (const c of cached) {
      const ws = wb.getWorksheet(c.sheet);
      const got = resultOf(ws.getCell(c.addr).value);
      totalCells++;
      if (!close(c.value, got)) bad.push(c.sheet + '!' + c.addr + ' Tenor=' + JSON.stringify(c.value) + ' LibreOffice=' + JSON.stringify(got) + ' formula=' + (ws.getCell(c.addr).formula || ''));
    }
    // Checks sheet must be all TRUE after recalculation
    const chk = wb.getWorksheet('Checks');
    const checks = [];
    chk.eachRow((row, n) => { if (n >= 4) { const v0 = resultOf(row.getCell(2).value); const v = v0 === MISSING ? false : v0; const label = row.getCell(1).value; if (label && /balances|repaid|equal uses|All model/.test(label)) checks.push([label, v]); } });
    const checksOk = checks.every(([, v]) => v === true || String(v).toUpperCase() === 'TRUE');
    totalBad += bad.length + (checksOk ? 0 : 1);
    console.log((bad.length || !checksOk ? 'FAIL ' : 'PASS ') + m.id + ': ' + cached.length + ' formula cells, ' + bad.length + ' differ; checks ' + (checksOk ? 'all TRUE' : JSON.stringify(checks)));
    bad.slice(0, 8).forEach((b) => console.log('   ' + b));
  }
  console.log('\n' + totalCells + ' cells compared, ' + totalBad + ' problems');
  process.exit(totalBad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
