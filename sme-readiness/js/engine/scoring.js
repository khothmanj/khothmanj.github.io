/*
 * Kinhold scoring. Pure functions, no DOM, no storage: the same code runs in the browser
 * and in the Node tests.
 *
 * Answers are 'yes' (1), 'partly' (0.5), 'no' (0) or 'unsure' (0, shown gently as something to check).
 * An area's score is the weighted average of its answered questions. The overall score is the
 * weighted average of every answered question. Levels are bands of the score, and two critical
 * questions cap the overall level: you can't be Solid or Strong without them.
 */
(function (root) {
  'use strict';

  const LEVELS = [
    { id: 'getting-started', label: 'Getting started', min: 0, blurb: 'Most small businesses start here. A few free changes make a big difference.' },
    { id: 'building', label: 'Building', min: 40, blurb: 'You have some good habits in place. The next steps close the gaps criminals use most.' },
    { id: 'solid', label: 'Solid', min: 65, blurb: 'You have the essentials covered. Keep them up and tidy the remaining gaps.' },
    { id: 'strong', label: 'Strong', min: 85, blurb: 'Well protected for a business your size. Keep checking as things change.' },
  ];
  const CRITICAL_CAP = 1; // index of 'building': the highest level allowed while a critical question isn't a full yes

  const VALUES = { yes: 1, partly: 0.5, no: 0, unsure: 0 };

  function levelFor(score) {
    let idx = 0;
    LEVELS.forEach((l, i) => { if (score >= l.min) idx = i; });
    return idx;
  }

  // Which questions apply to this business, from the profile answers.
  function applies(q, profile) {
    profile = profile || {};
    for (const [k, vals] of Object.entries(q.onlyFor || {})) if (!vals.includes(profile[k])) return false;
    for (const [k, vals] of Object.entries(q.notFor || {})) if (vals.includes(profile[k])) return false;
    return true;
  }
  const applicable = (questions, profile) => questions.filter((q) => applies(q, profile));

  /*
   * score(content, profile, answers) -> result
   * content: questions.json; answers: { questionId: 'yes' | 'partly' | 'no' | 'unsure' }
   */
  function score(content, profile, answers) {
    answers = answers || {};
    const qs = applicable(content.questions, profile);
    const answered = qs.filter((q) => VALUES[answers[q.id]] !== undefined);
    const weighted = (list) => {
      const w = list.reduce((s, q) => s + q.weight, 0);
      return w ? Math.round((100 * list.reduce((s, q) => s + q.weight * VALUES[answers[q.id]], 0)) / w) : null;
    };

    const areas = content.areas.map((a) => {
      const inArea = qs.filter((q) => q.area === a.id);
      const done = inArea.filter((q) => VALUES[answers[q.id]] !== undefined);
      const s = weighted(done);
      return {
        id: a.id, title: a.title, group: a.group, illustration: a.illustration,
        questions: inArea.length, answered: done.length,
        score: s, level: s === null ? null : levelFor(s),
        strengths: done.filter((q) => answers[q.id] === 'yes').map((q) => q.id),
        gaps: done.filter((q) => answers[q.id] !== 'yes').map((q) => q.id),
        unsure: done.filter((q) => answers[q.id] === 'unsure').map((q) => q.id),
      };
    }).filter((a) => a.questions > 0);

    const overall = weighted(answered);
    let level = overall === null ? null : levelFor(overall);
    const criticalGaps = qs.filter((q) => q.critical && answers[q.id] !== 'yes').map((q) => q.id);
    const capped = level !== null && criticalGaps.length > 0 && level > CRITICAL_CAP;
    if (capped) level = CRITICAL_CAP;

    const group = (g) => weighted(answered.filter((q) => content.areas.find((a) => a.id === q.area).group === g));

    return {
      score: overall,
      level,
      levelInfo: level === null ? null : LEVELS[level],
      capped, criticalGaps,
      groups: { cyber: group('cyber'), ai: group('ai') },
      areas,
      total: qs.length,
      answered: answered.length,
      complete: answered.length === qs.length,
      strengths: answered.filter((q) => answers[q.id] === 'yes').map((q) => q.id),
      gaps: answered.filter((q) => answers[q.id] !== 'yes').map((q) => q.id),
      unsure: answered.filter((q) => answers[q.id] === 'unsure').map((q) => q.id),
      minutesLeft: Math.ceil((qs.length - answered.length) * 0.35), // about 20 seconds a question
    };
  }

  // Compare two results for the same business: overall and area changes.
  function compare(before, after) {
    const areas = after.areas.map((a) => {
      const b = before.areas.find((x) => x.id === a.id);
      return { id: a.id, title: a.title, before: b ? b.score : null, after: a.score, change: b && a.score !== null && b.score !== null ? a.score - b.score : null, levelBefore: b ? b.level : null, levelAfter: a.level };
    });
    return {
      before: before.score, after: after.score,
      change: before.score !== null && after.score !== null ? after.score - before.score : null,
      levelBefore: before.level, levelAfter: after.level,
      improved: areas.filter((a) => a.change > 0).map((a) => a.id),
      worse: areas.filter((a) => a.change < 0).map((a) => a.id),
      fixed: before.gaps.filter((id) => after.strengths.includes(id)),
      areas,
    };
  }

  const api = { LEVELS, VALUES, CRITICAL_CAP, levelFor, applies, applicable, score, compare };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KinholdScoring = api;
})(typeof self !== 'undefined' ? self : this);
