/*
 * Context reader: rule-based extraction from pasted text or uploaded files (PDF, Word, Excel, CSV).
 * Nothing is used until the person confirms it. No AI model, no server.
 * readFile(file) -> Promise<{ text, kind, template? }>; extract(text, sectors) -> findings[]
 */
(function (root) {
  'use strict';
  const MAMMOTH = 'https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js';
  const loadScript = (src, global) => (root[global] ? Promise.resolve(root[global]) : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => res(root[global]); s.onerror = () => rej(new Error('Could not load the Word reader. Check your connection.'));
    document.head.appendChild(s);
  }));

  async function readFile(file) {
    const name = (file.name || '').toLowerCase();
    if (file.size > 25 * 1024 * 1024) throw new Error('That file is over 25 MB. Try a smaller file or paste the key text instead.');
    if (name.endsWith('.pdf')) {
      const base = new URL('vendor/pdfjs/', document.baseURI).href;
      const pdfjs = await import(base + 'pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const parts = [];
      for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        parts.push(tc.items.map((it) => it.str).join(' '));
      }
      return { text: parts.join('\n'), kind: 'PDF', pages: doc.numPages };
    }
    if (name.endsWith('.docx')) {
      const mammoth = await loadScript(MAMMOTH, 'mammoth');
      const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return { text: r.value, kind: 'Word' };
    }
    if (name.endsWith('.xlsx')) {
      const ExcelJS = await root.TenorExport.loadScript('ExcelJS');
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      if (wb.getWorksheet('Tenor inputs')) return { text: '', kind: 'Tenor template', template: await root.TenorXlsx.parseTemplate(ExcelJS, buf) };
      const lines = [];
      wb.eachSheet((ws) => ws.eachRow((row) => {
        const cells = []; row.eachCell((c) => { let v = c.value; if (v && typeof v === 'object') v = v.result ?? v.text ?? (v.richText ? v.richText.map((r) => r.text).join('') : ''); if (v !== null && v !== undefined && v !== '') cells.push(String(v)); });
        if (cells.length) lines.push(cells.join(' '));
      }));
      return { text: lines.join('\n'), kind: 'Excel' };
    }
    if (name.endsWith('.csv') || name.endsWith('.txt')) return { text: (await file.text()).replace(/[,;\t]+/g, ' '), kind: name.endsWith('.csv') ? 'CSV' : 'Text' };
    throw new Error('Tenor can read PDF, Word (.docx), Excel (.xlsx) and CSV files.');
  }

  /* ---------------- extraction rules ---------------- */
  const CUR = [['USD', /(?:US\$|USD|\$|dollars?)/i], ['NGN', /(?:NGN|₦|naira)/i], ['GBP', /(?:GBP|£|pounds?)/i], ['EUR', /(?:EUR|€|euros?)/i], ['KES', /(?:KES|KSh|Kenyan shillings?)/i], ['GHS', /(?:GHS|GH₵|cedis?)/i], ['ZMW', /(?:ZMW|kwacha)/i], ['ZAR', /(?:ZAR|rand)/i], ['UGX', /(?:UGX|Ugandan shillings?)/i], ['TZS', /(?:TZS|Tanzanian shillings?)/i]];
  const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Zambia', 'Sierra Leone', 'Liberia', 'Senegal', 'South Africa', 'Ethiopia', 'Egypt', 'Morocco', 'Lesotho', 'Malawi', 'Mozambique', 'Cameroon', 'United Kingdom', 'India'];
  const SECTOR_WORDS = {
    irrigation: /\birrigat|\bcanal|\bdam\b|\bpump(?:s|ing)? station/i, crops: /\b(rice|maize|soy(?:a|bean)|cassava|cocoa|sorghum|wheat|crop|farm(?:ing)?|harvest|hectare)/i,
    livestock: /\b(poultry|broiler|layer|cattle|dairy|piggery|fish ?farm|livestock|herd|flock)/i, agro_processing: /\b(mills?|milling|crush(?:ing)? plant|processing plant|parboil\w*|agro-?processing)\b/i,
    energy: /\b(solar|mini-?grid|kwp|\bmw\b|megawatt|electri|captive power|off-?grid)/i, petroleum: /\b(refinery|crude|barrels? per day|bpd|lpg|gas processing|petroleum)/i,
    tech: /\b(app|platform|saas|subscription|software|users?|edtech|marketplace)/i, fintech: /\b(payments?|fintech|lending|loans? to customers|wallet|pay-?as-?you-?go|take rate)/i,
    manufacturing: /\b(factory|manufactur|plant capacity|units per (?:month|day)|asphalt|cement|packaging)/i, logistics: /\b(cold ?(?:chain|room|storage)|warehouse|truck|logistics|port|teu|fleet)/i,
    health: /\b(hospital|clinic|beds|patients?|diagnostic|pharmac)/i,
  };
  const NUM = '(\\d{1,3}(?:[,\\s]\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
  const SCALE = '\\s*(billion|bn|million|mn|m|thousand|k)?\\b';
  const toNum = (s, scale) => {
    let v = parseFloat(String(s).replace(/[,\s]/g, ''));
    const sc = (scale || '').toLowerCase();
    if (sc === 'billion' || sc === 'bn') v *= 1e9; else if (sc === 'million' || sc === 'mn' || sc === 'm') v *= 1e6; else if (sc === 'thousand' || sc === 'k') v *= 1e3;
    return v;
  };
  const sentenceAround = (text, idx, len) => {
    const start = Math.max(0, text.lastIndexOf('.', idx - 1) + 1, idx - 140);
    let end = text.indexOf('.', idx + len); if (end < 0 || end - idx > 180) end = Math.min(text.length, idx + len + 120);
    return { before: text.slice(start, idx).trimStart(), match: text.slice(idx, idx + len), after: text.slice(idx + len, end + 1).trimEnd() };
  };
  const words = { one: 1, two: 2, three: 3, four: 4, single: 1, double: 2, twice: 2, thrice: 3 };

  function extract(text) {
    const t = String(text || '').replace(/\s+/g, ' ');
    const out = [];
    const seen = new Set();
    const perKey = {};
    // at most two findings of each kind, so a long document does not bury the review in repeats
    const add = (f) => { const k = f.key + ':' + f.value; if (seen.has(k)) return; perKey[f.key] = (perKey[f.key] || 0) + 1; if (perKey[f.key] > 2) return; seen.add(k); out.push(f); };
    const money = (re, key, label, target, exclude) => {
      const r = new RegExp(re, 'gi'); let m;
      while ((m = r.exec(t))) {
        if (exclude && exclude.test(m[0].slice(0, -String(m[2] || '').length - 1))) continue;
        const sym = m[1] || m[4] || ''; const v = toNum(m[2], m[3]);
        const cur = CUR.find(([, rx]) => rx.test(sym));
        if (!isFinite(v) || v <= 0) continue;
        add({ key, label, value: v, currency: cur ? cur[0] : null, display: (cur ? cur[0] + ' ' : '') + v.toLocaleString('en-GB'), target, snippet: sentenceAround(t, m.index, m[0].length) });
      }
    };
    const AMT = '(US\\$|USD|NGN|₦|\\$|£|GBP|€|EUR|KES|KSh|GHS|ZMW|UGX|TZS)?\\s?' + NUM + SCALE + '\\s?(dollars?|naira|pounds?|euros?)?';
    money('(?:total (?:project )?cost|project cost|total investment|capex|investment)[^.\\d]{0,40}?' + AMT, 'total_cost', 'Total project cost', 'capex.total');
    money('(?:loan|facility|credit line|line of credit|debt)[^.\\d]{0,30}?(?:of|for|worth)?\\s?' + AMT, 'loan_amount', 'Loan amount', 'loan.amount', /grant|own money|equity/i);
    money('(?:own (?:money|contribution|funds)|equity contribution|our contribution|we (?:will )?(?:put|invest|contribute))[^.\\d]{0,30}?' + AMT, 'equity_amount', 'Own money or equity', 'equity.amount', /loan|grant|debt|borrow/i);
    money('(?:grant)[^.\\d]{0,30}?(?:of|for|worth)?\\s?' + AMT, 'grant_amount', 'Grant', 'grant.amount', /loan|own money|equity/i);
    money('(?:raise|raising|round of|seed round|series [a-c])[^.\\d]{0,30}?' + AMT, 'round_amount', 'Investment round', 'investors.amount');
    money(AMT.replace(/\)\?\\s\?/, ')?\\s?') + '\\s*(?:per|/|a)\\s*(?:tonne|ton|mt)\\b', 'price_per_tonne', 'Price per tonne', 'rev.price_per_tonne');

    let m;
    const re = (s) => new RegExp(s, 'gi');
    const plain = (rx, key, label, target, conv = (x) => x, unit = '') => { const r = re(rx); while ((m = r.exec(t))) { const v = conv(toNum(m[1], m[2])); if (isFinite(v) && v > 0) add({ key, label, value: v, display: v.toLocaleString('en-GB') + (unit ? ' ' + unit : ''), target, snippet: sentenceAround(t, m.index, m[0].length) }); } };
    plain(NUM + '\\s*(?:ha\\b|hectares?)', 'hectares', 'Land area', 'rev.hectares', (x) => x, 'hectares');
    plain(NUM + '\\s*(?:acres?)', 'hectares', 'Land area (converted from acres)', 'rev.hectares', (x) => Math.round(x * 0.404686 * 10) / 10, 'hectares');
    plain(NUM + '\\s*(?:t|tonnes?|tons?|mt)\\s*(?:per|/|a)\\s*(?:ha|hectare)', 'yield_per_ha', 'Yield per hectare', 'rev.yield_per_ha', (x) => x, 't/ha');
    plain(NUM + '\\s*(?:barrels? per day|bpd|b/d)', 'capacity_bpd', 'Refining capacity', 'rev.capacity_bpd', (x) => x, 'barrels a day');
    plain(NUM + SCALE + '\\s*(?:tonnes?|tons?|mt)\\s*(?:per year|a year|per annum|annually|/yr|tpy)', 'capacity_tpy', 'Processing capacity', 'rev.capacity_tpy', (x) => x, 'tonnes a year');
    plain(NUM + '\\s*(?:connections|households connected|customers connected)', 'connections', 'Connections', 'rev.connections', (x) => x, 'connections');
    plain(NUM + '\\s*(?:beds)', 'beds', 'Beds', 'rev.beds', (x) => x, 'beds');
    plain('(?:interest(?: rate)?(?: of)?|at|rate of)\\s*' + NUM + '\\s*(?:%|per ?cent)', 'interest_rate', 'Interest rate', 'loan.rate_pct', (x) => x, '% a year');
    plain(NUM + '\\s*(?:%|per ?cent)\\s*(?:interest|a year interest|p\\.?a\\.?)', 'interest_rate', 'Interest rate', 'loan.rate_pct', (x) => x, '% a year');
    plain('(?:tenor|term|repayable over|repaid over|maturity)\\s*(?:of)?\\s*' + NUM + '\\s*years?', 'tenor', 'Years to repay', 'loan.tenor_years', (x) => x, 'years');
    plain(NUM + '[- ]years?(?:[- ]tenor)? (?:loan|facility|credit)', 'tenor', 'Years to repay', 'loan.tenor_years', (x) => x, 'years');
    plain('(?:grace period|moratorium)\\s*(?:of)?\\s*' + NUM + '\\s*years?', 'grace', 'Grace period', 'loan.grace_years', (x) => x, 'years');
    plain(NUM + '[- ]years? (?:grace|moratorium)', 'grace', 'Grace period', 'loan.grace_years', (x) => x, 'years');
    { const r = /\b(one|two|three|four|\d)\s*(?:harvests?|crops?|seasons?|crop cycles?)\s*(?:a|per|each)\s*year|\b(twice|thrice)\s*a\s*year/gi; while ((m = r.exec(t))) { const w = (m[1] || m[2]).toLowerCase(); const v = words[w] || parseInt(w, 10); if (v) add({ key: 'harvests', label: 'Harvests each year', value: v, display: String(v), target: 'rev.harvests_per_year', snippet: sentenceAround(t, m.index, m[0].length) }); } }
    const lenders = [['exim', /\b(exim|export[- ]import bank|export credit|UKEF|UK Export Finance)\b/i, 'Exim or export credit agency'], ['dfi', /\b(World Bank|IFC|AfDB|African Development Bank|Afreximbank|FMO|BII|British International Investment|DEG|Proparco|AFC|Africa Finance Corporation|IsDB|development finance)\b/i, 'Development finance institution'],
      ['equipment_finance', /\b(equipment (?:lease|financ\w*)|hire purchase|asset financ\w*|leasing)\b/i, 'Equipment financing'], ['grant_funder', /\bgrants?\b/i, 'Grant'], ['angel_seed', /\b(seed round|pre-seed|angel)\b/i, 'Seed or angel investors'], ['venture', /\b(series [a-d]|venture capital|VC fund)\b/i, 'Venture capital'], ['commercial_bank', /\b(commercial bank|bank loan|overdraft)\b/i, 'Commercial bank']];
    lenders.forEach(([id, rx, label]) => { const mm = rx.exec(t); if (mm) add({ key: 'lender_' + id, label: 'Type of funder', value: id, display: label, target: 'funding.type', snippet: sentenceAround(t, mm.index, mm[0].length) }); });
    const cm = COUNTRIES.map((c) => ({ c, i: t.search(new RegExp('\\b' + c + '\\b', 'i')) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)[0];
    if (cm) add({ key: 'country', label: 'Country', value: cm.c, display: cm.c, target: 'meta.country', snippet: sentenceAround(t, cm.i, cm.c.length) });
    const counts = Object.entries(SECTOR_WORDS).map(([id, rx]) => [id, (t.match(new RegExp(rx.source, 'gi')) || []).length]).sort((a, b) => b[1] - a[1]);
    if (counts[0][1] > 0) add({ key: 'sector', label: 'Kind of project', value: counts[0][0], display: counts[0][0].replace('_', '-'), target: 'meta.sector', snippet: null });
    const curHit = CUR.map(([c, rx]) => ({ c, n: (t.match(new RegExp(rx.source, 'gi')) || []).length })).sort((a, b) => b.n - a.n)[0];
    if (curHit && curHit.n > 0) add({ key: 'currency', label: 'Currency', value: curHit.c, display: curHit.c, target: 'meta.currency', snippet: null });
    return out;
  }

  const api = { readFile, extract };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorExtract = api;
})(typeof self !== 'undefined' ? self : this);
