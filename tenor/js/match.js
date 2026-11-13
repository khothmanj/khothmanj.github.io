/*
 * Similar projects and benchmarks from the case library. Transparent scoring, no machine learning.
 * Works in the browser (window.TenorMatch) and in Node (module.exports).
 */
(function (root) {
  'use strict';
  const val = (x) => (x && typeof x === 'object' && !Array.isArray(x) && 'value' in x ? x.value : x);
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const GROUPS = { crops: 'agri', irrigation: 'agri', livestock: 'agri', agro_processing: 'agri', tech: 'digital', fintech: 'digital', energy: 'energy', petroleum: 'energy', manufacturing: 'industry', logistics: 'industry', health: 'social' };
  const AFRICA = ['Nigeria', 'Ghana', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Zambia', 'Sierra Leone', 'Lesotho', 'South Africa', 'Ethiopia', 'Egypt', 'Senegal', 'Cote d\'Ivoire', 'Côte d\'Ivoire', 'Morocco', 'Malawi', 'Mozambique', 'Liberia', 'Cameroon'];
  const MONEY_KEYS = /price|cost|fee|tariff|rate_per_unit|value_per|cac|volume_per_customer|amount/;
  const PROVIDER_WORDS = { own: 'own money', commercial_bank: 'a bank loan', dfi: 'development finance', exim: 'an Exim or export credit loan', equipment_finance: 'equipment finance', angel_seed: 'seed investors', venture: 'venture capital', grant_funder: 'grants', impact_debt: 'impact debt', sovereign: 'government money' };

  // the first known country named anywhere in the text ("Kaduna, Nigeria" -> Nigeria), else the first part
  const firstCountry = (c) => { const str = String(c || ''); const hit = AFRICA.concat(['United States', 'United Kingdom', 'India']).map((a) => ({ a, i: str.indexOf(a) })).filter((x) => x.i >= 0).sort((x, y) => x.i - y.i)[0]; return hit ? hit.a : str.split(/,| and /)[0].trim(); };
  function usdRate(cur, defaults) { const r = defaults && defaults.usd_rates_indicative && defaults.usd_rates_indicative[cur]; return isNum(r) ? r : null; }

  function caseSizeUSD(c, defaults) {
    const rate = c.currency === 'USD' ? 1 : (c.fx && isNum(val(c.fx.usd_rate)) ? val(c.fx.usd_rate) : usdRate(c.currency, defaults));
    let total = 0;
    (c.capex || []).forEach((l) => { const a = val(l.amount); if (isNum(a)) total += l.currency === 'USD' ? a : a / (rate || 1); });
    if (!total) (c.financing && c.financing.instruments || []).forEach((i) => { const a = val(i.amount); if (isNum(a)) total += i.currency === 'USD' ? a : a / (rate || 1); });
    return total;
  }
  function inputSizeUSD(input, defaults) {
    const rate = usdRate(input.currency, defaults) || 1;
    const capex = (input.capex || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const fin = (input.financing.loans || []).reduce((s, l) => s + (Number(l.amount) || 0) * (l.fx_rate || 1), 0) + (input.financing.equity || []).reduce((s, e) => s + (Number(e.amount) || 0), 0) + (input.financing.grants || []).reduce((s, g) => s + (Number(g.amount) || 0), 0);
    return Math.max(capex, fin) / rate;
  }
  function caseProviders(c) {
    const s = new Set();
    (c.financing && c.financing.instruments || []).forEach((i) => { if (isNum(val(i.amount)) && val(i.amount) > 0) s.add(i.type === 'grant' && i.provider_type === 'dfi' ? 'grant_funder' : i.provider_type === 'mixed' ? 'commercial_bank' : i.provider_type); });
    return s;
  }
  function inputProviders(input) {
    const s = new Set();
    (input.financing.loans || []).forEach((l) => s.add(l.provider_type || (l.kind === 'equipment' ? 'equipment_finance' : 'commercial_bank')));
    (input.financing.equity || []).forEach((e) => { if (Number(e.amount) > 0) s.add(e.provider_type || (e.pre_money > 0 ? 'angel_seed' : 'own')); });
    (input.financing.grants || []).forEach((g) => { if (Number(g.amount) > 0) s.add('grant_funder'); });
    return s;
  }
  const fmtUSD = (x) => (x >= 1e9 ? 'US$' + (x / 1e9).toFixed(1) + 'bn' : x >= 1e6 ? 'US$' + (x / 1e6).toFixed(1) + 'm' : 'US$' + Math.round(x / 1e3) + 'k');

  function similar(input, cases, defaults, n = 3) {
    const pSize = inputSizeUSD(input, defaults);
    const pProv = inputProviders(input);
    const pCountry = firstCountry(input.country);
    const pMode = input.revenue && input.revenue.mode;
    const scored = cases.filter((c) => c.id !== input.id && c.id !== input.sourceCase).map((c) => {
      let score = 0; const why = [];
      if (c.sector === input.sector) { score += 40; why.push('same sector'); }
      else if (GROUPS[c.sector] === GROUPS[input.sector]) { score += 15; why.push('a related sector (' + c.sector.replace('_', '-') + ')'); }
      const cProv = caseProviders(c);
      const inter = [...pProv].filter((x) => cProv.has(x));
      const union = new Set([...pProv, ...cProv]);
      if (union.size) score += 25 * inter.length / union.size;
      if (inter.length) why.push('also funded with ' + inter.map((x) => PROVIDER_WORDS[x] || x).join(' and '));
      const cSize = caseSizeUSD(c, defaults);
      if (pSize > 0 && cSize > 0) {
        const d = Math.abs(Math.log10(pSize / cSize));
        score += 15 * Math.max(0, 1 - d / 2);
        if (d < 0.5) why.push('a similar size (' + fmtUSD(cSize) + ')');
        else if (d < 1.2) why.push('within the same order of size (' + fmtUSD(cSize) + ')');
      }
      const cCountry = firstCountry(c.country);
      if (pCountry && cCountry && cCountry.toLowerCase() === pCountry.toLowerCase()) { score += 10; why.push('also in ' + cCountry); }
      else if (AFRICA.some((a) => String(input.country || '').includes(a)) && AFRICA.includes(cCountry)) { score += 5; why.push('also in Africa'); }
      const cMode = c.historicals ? 'historical' : c.sector === 'tech' ? 'subscription' : c.sector === 'fintech' ? 'fintech' : 'formula';
      if (cMode === pMode) score += 5;
      if (c.stage === input.stage) score += 5;
      const why2 = why.length ? why[0][0].toUpperCase() + why.join(', ').slice(1) + '.' : 'Closest overall match.';
      return { id: c.id, name: c.name, case: c, score: Math.round(score), why: why2, sizeUSD: cSize };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, n);
  }

  /*
   * Benchmarks for one input from library cases in the same sector group, using only sourced or derived values.
   * Money values are converted to the project currency with each case's own rate and indicative rates.
   */
  function benchmark(key, input, cases, defaults) {
    const group = GROUPS[input.sector];
    const money = MONEY_KEYS.test(key);
    const toRate = usdRate(input.currency, defaults);
    const pts = [];
    cases.forEach((c) => {
      if (!(c.sector === input.sector || (GROUPS[c.sector] === group && ['yield_per_ha', 'harvests_per_year', 'losses_pct', 'price_per_tonne'].includes(key)))) return;
      const d = c.drivers && c.drivers[key];
      if (!d || !['sourced', 'derived'].includes(d.quality) || !isNum(d.value)) return;
      let v = d.value;
      if (money) {
        if (c.currency === input.currency) v = d.value;
        else {
          const from = c.currency === 'USD' ? 1 : (c.fx && isNum(val(c.fx.usd_rate)) ? val(c.fx.usd_rate) : usdRate(c.currency, defaults));
          if (!from || !toRate) return;
          v = d.value / from * toRate;
        }
      }
      pts.push({ value: v, name: c.name, quality: d.quality });
    });
    if (!pts.length) return null;
    const vs = pts.map((p) => p.value).sort((a, b) => a - b);
    const mid = vs.length % 2 ? vs[(vs.length - 1) / 2] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2;
    return { n: pts.length, min: vs[0], max: vs[vs.length - 1], median: mid, points: pts, converted: money };
  }
  function warning(value, b) {
    if (!b || !isNum(value) || value === 0) return null;
    if (b.n >= 2 && (value < b.min * 0.98 || value > b.max * 1.02)) return value > b.max ? 'above' : 'below';
    if (b.n === 1 && (value > b.median * 1.5 || value < b.median / 1.5)) return value > b.median ? 'above' : 'below';
    return null;
  }

  const api = { similar, benchmark, warning, caseSizeUSD, inputSizeUSD, GROUPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TenorMatch = api;
})(typeof self !== 'undefined' ? self : this);
