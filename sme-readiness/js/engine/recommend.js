/*
 * Kinhold recommendations: rank gaps into actions, pick quick wins, build the 30/60/90 day plan,
 * write plain-English summaries from templates, and pick fair comparisons from the survey.
 * Pure functions, no AI model: every rule here is shown on the Method page.
 *
 *   risk reduced = question weight x size of the gap (1 for no or not sure, 0.5 for partly),
 *                  x 1.5 for a critical question
 *   priority     = risk reduced / effort (effort 1 to 3)
 *   ties         = free first, then fewer minutes, then higher weight, then content order
 */
(function (root) {
  'use strict';
  const S = typeof module !== 'undefined' && module.exports ? require('./scoring.js') : root.KinholdScoring;

  const CRITICAL_BOOST = 1.5;
  const isFree = (r) => /^free$/i.test(r.cost);

  function rank(content, recs, profile, answers) {
    const byId = Object.fromEntries(recs.recommendations.map((r) => [r.id, r]));
    const qs = S.applicable(content.questions, profile);
    const actions = [];
    qs.forEach((q, order) => {
      const a = answers[q.id];
      if (a === undefined || a === 'yes') return;
      const rec = byId[q.recommendation];
      const gap = 1 - S.VALUES[a];
      const risk = q.weight * gap * (q.critical ? CRITICAL_BOOST : 1);
      actions.push({
        id: rec.id, question: q.id, area: q.area, answer: a, critical: !!q.critical,
        risk: Math.round(risk * 100) / 100, priority: Math.round((risk / rec.effort) * 1000) / 1000, order,
        rec,
      });
    });
    actions.sort((x, y) => y.priority - x.priority || (isFree(y.rec) - isFree(x.rec)) || x.rec.minutes - y.rec.minutes || y.risk - x.risk || x.order - y.order);
    actions.forEach((a, i) => { a.rank = i + 1; });
    return actions;
  }

  // Quick wins: free, low-effort actions you can do today that aren't already in the top five.
  function quickWins(actions, top, limit) {
    const inTop = new Set(top.map((a) => a.id));
    return actions.filter((a) => !inTop.has(a.id) && a.rec.quickWin && a.rec.effort === 1 && isFree(a.rec)).slice(0, limit || 4);
  }

  /*
   * The 30/60/90 day plan, filled in rank order with a realistic amount in each phase:
   *   first 30 days  every critical gap, plus up to 6 more quick, free actions
   *   days 31 to 60  up to 10 more actions that take a few hours at most
   *   days 61 to 90  up to 12 more, including bigger projects (effort 3)
   *   after 90 days  anything left, so no phase asks too much of a small team
   * Each action keeps its owner.
   */
  const PHASE_LIMITS = { first: 6, second: 10, third: 12 };
  function plan(actions) {
    const phases = [
      { id: 30, label: 'First 30 days', actions: [] },
      { id: 60, label: 'Days 31 to 60', actions: [] },
      { id: 90, label: 'Days 61 to 90', actions: [] },
      { id: 'later', label: 'After 90 days', actions: [] },
    ];
    let extraFirst = 0;
    actions.forEach((a) => {
      let p;
      if (a.critical) p = 0;
      else if (a.rec.effort === 1 && a.rec.quickWin && extraFirst < PHASE_LIMITS.first) { p = 0; extraFirst++; }
      else if (a.rec.effort <= 2 && phases[1].actions.length < PHASE_LIMITS.second) p = 1;
      else p = phases[2].actions.length < PHASE_LIMITS.third ? 2 : 3;
      phases[p].actions.push({ id: a.id, question: a.question, title: a.rec.title, owner: a.rec.owner, minutes: a.rec.minutes, cost: a.rec.cost, critical: a.critical });
    });
    return phases;
  }

  function progress(planPhases, done) {
    const doneSet = new Set(done || []);
    const all = planPhases.flatMap((p) => p.actions);
    const count = all.filter((a) => doneSet.has(a.id)).length;
    return {
      done: count, total: all.length, percent: all.length ? Math.round((100 * count) / all.length) : 100,
      phases: planPhases.map((p) => ({ id: p.id, done: p.actions.filter((a) => doneSet.has(a.id)).length, total: p.actions.length })),
    };
  }

  /* ---------- plain-English summaries (templates, not a model) ---------- */
  // Area names contain 'and', so use a final comma when any item does, for clarity.
  const list = (items) => items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + (items.some((i) => / and /.test(i)) ? ', and ' : ' and ') + items[items.length - 1];
  const ESSENTIAL = { pw1: '2-step verification on your business email', pay1: 'phoning to check any change of bank details' };
  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

  function summary(content, result, actions, businessName) {
    if (result.level === null) return { headline: 'Answer a few questions to see where you stand.', paragraphs: [] };
    const name = businessName || 'Your business';
    const level = result.levelInfo.label;
    const area = (id) => content.areas.find((a) => a.id === id).title;
    const strongAreas = result.areas.filter((a) => a.level !== null && a.level >= 2).map((a) => lowerFirst(area(a.id)));
    const paragraphs = [];
    const headline = name + ' is at ' + level + '. ' + result.levelInfo.blurb;
    if (strongAreas.length) paragraphs.push('Already in good shape: ' + list(strongAreas.slice(0, 4)) + '.');
    else if (result.strengths.length) paragraphs.push('You already have ' + result.strengths.length + ' of the ' + result.answered + ' things we asked about in place. That is a real start.');
    if (result.capped) {
      const missing = result.criticalGaps.map((id) => ESSENTIAL[id] || lowerFirst(content.questions.find((q) => q.id === id).text));
      paragraphs.push(missing.length === 1
        ? 'Your overall level is held at Building until one essential is in place: ' + missing[0] + '. It\'s free and takes minutes.'
        : 'Your overall level is held at Building until two essentials are in place: ' + list(missing) + '. Both are free and take minutes.');
    }
    if (actions.length) {
      const first = actions[0];
      paragraphs.push('The most useful next step: ' + lowerFirst(first.rec.title) + '. It takes about ' + first.rec.minutes + ' minutes and is ' + first.rec.cost.toLowerCase() + '.');
    } else {
      paragraphs.push('There are no gaps in what we asked. Re-run the check every six months, or sooner if something changes.');
    }
    if (result.unsure.length) paragraphs.push('You weren\'t sure about ' + result.unsure.length + (result.unsure.length === 1 ? ' question' : ' questions') + '. That\'s common, and each one has simple steps to find out.');
    return { headline, paragraphs };
  }

  // Fair comparisons from the survey, for the sizes the survey reports.
  function benchmarks(bench, profile, questionIds) {
    const sizeKey = profile && (profile.size === 'solo' || profile.size === 'micro') ? 'micro' : 'all';
    const ids = new Set(questionIds);
    const pick = bench.controls.filter((b) => (b.questions || []).some((q) => ids.has(q)));
    // Prefer the figure for this size; fall back to all businesses.
    const byQ = {};
    pick.forEach((b) => (b.questions || []).forEach((q) => {
      if (!ids.has(q)) return;
      const cur = byQ[q];
      if (!cur || (b.size === sizeKey && cur.size !== sizeKey)) byQ[q] = b;
    }));
    return [...new Set(Object.values(byQ))];
  }

  const api = { CRITICAL_BOOST, rank, quickWins, plan, progress, summary, benchmarks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KinholdRecommend = api;
})(typeof self !== 'undefined' ? self : this);
