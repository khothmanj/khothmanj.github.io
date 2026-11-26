/*
 * Kinhold engine tests, shared by the browser page (scoring.test.html) and Node (run-node.js).
 * defineTests(test, ctx): ctx = { S: scoring, R: recommend, C: checker, data: { questions, recommendations, sources, messages, benchmarks } }
 */
(function (root) {
  'use strict';

  function defineTests(test, ctx) {
    const { S, R, C, data } = ctx;
    const Q = data.questions, REC = data.recommendations;
    const fullProfile = { sector: 'office', size: 'small', online: 'yes', domain: 'yes', invoices: 'yes', ai: 'yes', chatbot: 'yes' };
    const answerAll = (profile, value) => Object.fromEntries(S.applicable(Q.questions, profile).map((q) => [q.id, value]));
    const BANNED = [/—/, /\bcompliant\b/i, /\bcertified\b/i, /\b(is|are|looks|it's) safe\b/i, /\bguarantee/i];

    /* ---------- levels ---------- */
    test('All "yes" answers give the highest level', () => {
      const r = S.score(Q, fullProfile, answerAll(fullProfile, 'yes'));
      return [r.level === 3 && r.score === 100 && r.levelInfo.label === 'Strong', 'level ' + (r.levelInfo && r.levelInfo.label) + ', score ' + r.score];
    });
    test('All "no" answers give the lowest level', () => {
      const r = S.score(Q, fullProfile, answerAll(fullProfile, 'no'));
      return [r.level === 0 && r.score === 0, 'level ' + r.levelInfo.label + ', score ' + r.score];
    });
    test('All "not sure" answers give the lowest level, and are listed as things to check', () => {
      const r = S.score(Q, fullProfile, answerAll(fullProfile, 'unsure'));
      return [r.level === 0 && r.unsure.length === r.answered, r.unsure.length + ' questions marked to check'];
    });
    test('"Partly" scores half', () => {
      const r = S.score(Q, fullProfile, answerAll(fullProfile, 'partly'));
      return [r.score === 50 && r.levelInfo.label === 'Building', 'score ' + r.score];
    });
    test('Every area reaches Strong with all "yes" and Getting started with all "no"', () => {
      const yes = S.score(Q, fullProfile, answerAll(fullProfile, 'yes')), no = S.score(Q, fullProfile, answerAll(fullProfile, 'no'));
      return [yes.areas.every((a) => a.level === 3) && no.areas.every((a) => a.level === 0), yes.areas.length + ' areas'];
    });
    test('Level bands: 39 Getting started, 40 Building, 65 Solid, 85 Strong', () => {
      const got = [39, 40, 64, 65, 84, 85].map(S.levelFor);
      return [got.join() === '0,1,1,2,2,3', got.join(', ')];
    });

    /* ---------- critical controls ---------- */
    Q.questions.filter((q) => q.critical).forEach((q) => {
      test('Missing critical control ' + q.id + ' caps the overall level at Building', () => {
        const a = answerAll(fullProfile, 'yes'); a[q.id] = 'no';
        const r = S.score(Q, fullProfile, a);
        return [r.level === 1 && r.capped && r.score >= 85, 'score ' + r.score + ' would be ' + S.LEVELS[S.levelFor(r.score)].label + ', shown as ' + r.levelInfo.label];
      });
    });

    /* ---------- profile adaptation ---------- */
    test('A sole trader is not asked about leavers, shared logins or second approvers', () => {
      const ids = S.applicable(Q.questions, Object.assign({}, fullProfile, { size: 'solo' })).map((q) => q.id);
      const hidden = ['ac1', 'ac2', 'ac3', 'pay2', 'pay4', 'ir3'].filter((id) => !ids.includes(id));
      return [hidden.length === 6, hidden.length + ' of 6 hidden, ' + ids.length + ' questions asked'];
    });
    test('A business that uses no AI still gets the essential AI questions', () => {
      const ids = S.applicable(Q.questions, Object.assign({}, fullProfile, { ai: 'no', chatbot: 'no' })).map((q) => q.id);
      const kept = ['ai1', 'ai3', 'ai9', 'ai10'].every((id) => ids.includes(id));
      const dropped = ['ai2', 'ai4', 'ai5', 'ai6', 'ai7', 'ai8'].every((id) => !ids.includes(id));
      return [kept && dropped, ids.filter((id) => id.startsWith('ai')).join(', ')];
    });
    test('A full check asks between 35 and 45 questions', () => {
      const n = S.applicable(Q.questions, fullProfile).length;
      return [n >= 35 && n <= 45, n + ' questions'];
    });

    /* ---------- recommendations ---------- */
    S.applicable(Q.questions, fullProfile).forEach((q) => {
      test('A gap on ' + q.id + ' produces its recommendation first', () => {
        const a = answerAll(fullProfile, 'yes'); a[q.id] = 'no';
        const actions = R.rank(Q, REC, fullProfile, a);
        return [actions.length === 1 && actions[0].id === q.recommendation && actions[0].question === q.id, actions.map((x) => x.id).join(', ')];
      });
    });
    test('Every recommendation has at least one source with a working https link', () => {
      const ids = new Set(data.sources.sources.filter((s) => /^https:\/\//.test(s.url)).map((s) => s.id));
      const bad = REC.recommendations.filter((r) => !r.sources.length || r.sources.some((s) => !ids.has(s))).map((r) => r.id);
      return [bad.length === 0, bad.length ? 'missing: ' + bad.join(', ') : REC.recommendations.length + ' recommendations'];
    });
    test('Ranking puts critical gaps first when effort is equal', () => {
      const a = answerAll(fullProfile, 'no');
      const actions = R.rank(Q, REC, fullProfile, a);
      const top2 = actions.slice(0, 2).map((x) => x.question).sort().join();
      return [top2 === 'pay1,pw1', 'top: ' + actions.slice(0, 5).map((x) => x.question).join(', ')];
    });
    test('Ranking is risk reduced divided by effort, so a quick fix beats a big project of equal risk', () => {
      const a = answerAll(fullProfile, 'yes'); a.dv1 = 'no'; a.dv2 = 'no'; // weight 3 effort 1, weight 2 effort 3
      const actions = R.rank(Q, REC, fullProfile, a);
      return [actions[0].question === 'dv1', actions.map((x) => x.question + ' ' + x.priority).join(', ')];
    });
    test('"Partly" counts as half a gap in the ranking', () => {
      const a = answerAll(fullProfile, 'yes'); a.bk1 = 'partly'; a.bk3 = 'no';
      const actions = R.rank(Q, REC, fullProfile, a);
      const bk1 = actions.find((x) => x.question === 'bk1');
      return [bk1 && bk1.risk === 1.5, 'bk1 risk ' + (bk1 && bk1.risk)];
    });
    test('Ranking is the same every time', () => {
      const a = answerAll(fullProfile, 'no');
      const one = R.rank(Q, REC, fullProfile, a).map((x) => x.id).join(), two = R.rank(Q, REC, fullProfile, a).map((x) => x.id).join();
      return [one === two, 'stable'];
    });
    test('Quick wins are free, under an hour and not repeated from the top five', () => {
      const actions = R.rank(Q, REC, fullProfile, answerAll(fullProfile, 'no'));
      const wins = R.quickWins(actions, actions.slice(0, 5), 4);
      const ok = wins.length > 0 && wins.every((w) => /^free$/i.test(w.rec.cost) && w.rec.effort === 1 && !actions.slice(0, 5).includes(w));
      return [ok, wins.map((w) => w.question).join(', ')];
    });

    /* ---------- plan ---------- */
    test('The 30/60/90 day plan contains every gap exactly once, with an owner', () => {
      const actions = R.rank(Q, REC, fullProfile, answerAll(fullProfile, 'no'));
      const phases = R.plan(actions);
      const ids = phases.flatMap((p) => p.actions.map((a) => a.id));
      return [ids.length === actions.length && new Set(ids).size === ids.length && phases.flatMap((p) => p.actions).every((a) => a.owner), phases.map((p) => p.label + ': ' + p.actions.length).join(', ')];
    });
    test('No phase is overloaded: at most 8, 10 and 12 actions in the 30, 60 and 90 day phases', () => {
      const phases = R.plan(R.rank(Q, REC, fullProfile, answerAll(fullProfile, 'no')));
      return [phases[0].actions.length <= 8 && phases[1].actions.length <= 10 && phases[2].actions.length <= 12, phases.map((p) => p.label + ' ' + p.actions.length).join(', ')];
    });
    test('Bigger projects (effort 3) are never planned for the first 30 days unless critical', () => {
      const actions = R.rank(Q, REC, fullProfile, answerAll(fullProfile, 'no'));
      const phases = R.plan(actions);
      const bad = phases[0].actions.filter((a) => !a.critical && actions.find((x) => x.id === a.id).rec.effort === 3);
      return [bad.length === 0, bad.map((a) => a.id).join(', ') || 'none'];
    });
    test('Critical gaps are always in the first 30 days', () => {
      const phases = R.plan(R.rank(Q, REC, fullProfile, answerAll(fullProfile, 'no')));
      const crit = phases.flatMap((p) => p.actions.filter((a) => a.critical).map((a) => p.id));
      return [crit.length === 2 && crit.every((d) => d === 30), crit.join(', ')];
    });
    test('Progress counts actions marked as done', () => {
      const phases = R.plan(R.rank(Q, REC, fullProfile, answerAll(fullProfile, 'no')));
      const first = phases[0].actions.slice(0, 3).map((a) => a.id);
      const p = R.progress(phases, first);
      return [p.done === 3 && p.phases[0].done === 3 && p.percent === Math.round((300) / p.total), p.done + ' of ' + p.total + ' (' + p.percent + '%)'];
    });
    test('Re-running the check shows what improved', () => {
      const before = S.score(Q, fullProfile, answerAll(fullProfile, 'no'));
      const a = answerAll(fullProfile, 'no'); a.pw1 = 'yes'; a.pw2 = 'yes'; a.pay1 = 'yes';
      const after = S.score(Q, fullProfile, a);
      const c = S.compare(before, after);
      return [c.change > 0 && c.fixed.sort().join() === 'pay1,pw1,pw2' && c.improved.includes('passwords') && c.improved.includes('payments'), 'up ' + c.change + ' points, fixed ' + c.fixed.join(', ')];
    });

    /* ---------- summaries and wording ---------- */
    test('Summaries show what is already good before what is missing', () => {
      const a = answerAll(fullProfile, 'yes'); ['pay1', 'pay2', 'pay3', 'ai3'].forEach((id) => { a[id] = 'no'; });
      const r = S.score(Q, fullProfile, a);
      const s = R.summary(Q, r, R.rank(Q, REC, fullProfile, a), 'Brightloaf Bakery');
      return [/^Already in good shape/.test(s.paragraphs[0]) && /Brightloaf Bakery is at/.test(s.headline), s.headline + ' ' + s.paragraphs.join(' ')];
    });
    test('A capped result explains why, in plain words', () => {
      const a = answerAll(fullProfile, 'yes'); a.pw1 = 'no';
      const r = S.score(Q, fullProfile, a);
      const s = R.summary(Q, r, R.rank(Q, REC, fullProfile, a));
      return [s.paragraphs.some((p) => /held at Building until one essential is in place: 2-step verification on your business email/.test(p)), s.paragraphs.join(' ')];
    });
    test('Summaries keep acronyms such as AI in capitals', () => {
      const a = answerAll(fullProfile, 'no'); ['ai7', 'ai8', 'ai1', 'ai2'].forEach((id) => { a[id] = 'yes'; });
      const r = S.score(Q, fullProfile, a);
      const t = R.summary(Q, r, R.rank(Q, REC, fullProfile, a)).paragraphs.join(' ');
      return [!/\baI\b/.test(t) && /AI rules/.test(t), t];
    });
    test('Summaries never claim compliance, certification or safety', () => {
      const texts = ['yes', 'no', 'partly', 'unsure'].map((v) => { const a = answerAll(fullProfile, v); const r = S.score(Q, fullProfile, a); const s = R.summary(Q, r, R.rank(Q, REC, fullProfile, a)); return s.headline + ' ' + s.paragraphs.join(' '); });
      const bad = texts.filter((t) => BANNED.some((re) => re.test(t)));
      return [bad.length === 0, bad.length ? bad[0] : 'checked 4 summaries'];
    });
    test('Comparisons use the micro business figure for small teams, and the overall figure otherwise', () => {
      const micro = R.benchmarks(data.benchmarks, { size: 'micro' }, ['pw1']).map((b) => b.id).join();
      const small = R.benchmarks(data.benchmarks, { size: 'small' }, ['pw1']).map((b) => b.id).join();
      return [micro === 'twofa-micro' && small === 'twofa-all', 'micro: ' + micro + ', small: ' + small];
    });

    /* ---------- message checker ---------- */
    data.messages.examples.forEach((e) => {
      test('Example "' + e.title + '" triggers exactly its expected warning signs', () => {
        const r = C.analyse(e);
        const exp = new Set(e.expected), got = new Set(r.signals);
        const ok = [...exp].every((x) => got.has(x)) && [...got].every((x) => exp.has(x)) && r.level === e.expectedLevel;
        return [ok, 'got ' + (r.signals.join(', ') || 'none') + ' (' + r.level + '), expected ' + (e.expected.join(', ') || 'none') + ' (' + e.expectedLevel + ')'];
      });
    });
    test('Every warning sign found is pointed at in the message, so it can be highlighted', () => {
      const missing = [];
      data.messages.examples.forEach((e) => {
        const r = C.analyse(e);
        r.signals.forEach((sig) => { if (!r.matches.some((m) => m.signal === sig && (m.field === 'from' || m.field === 'channel' || (m.start !== undefined && m.end > m.start)))) missing.push(e.id + ':' + sig); });
        r.matches.filter((m) => m.start !== undefined).forEach((m) => { const src = m.field === 'subject' ? e.subject : e.body; if (src.slice(m.start, m.end) !== m.text) missing.push(e.id + ':offset'); });
      });
      return [missing.length === 0, missing.length ? missing.join(', ') : 'all signs located'];
    });
    test('Ordinary messages raise no warning signs', () => {
      const benign = [
        'Thanks for your order. We will deliver on Tuesday morning.',
        'Here is the agenda for Monday\'s team meeting. See you there.',
        'Your new account manager is Sam, who will be in touch next week.',
        'Please find attached our price list for 2027. Any questions, just call.',
      ];
      const flagged = benign.map((b) => [b, C.analyse({ body: b })]).filter(([, r]) => r.signals.length);
      return [flagged.length === 0, flagged.length ? flagged.map(([b, r]) => '"' + b + '": ' + r.signals.join(', ')).join('; ') : benign.length + ' messages clear'];
    });
    test('A pasted email with a "From:" line is checked against a known sender', () => {
      const r = C.analyse({ body: 'From: Accounts <billing@kestrelprint-co.uk>\nPlease pay the invoice as usual.', knownSenders: ['kestrelprint.co.uk'] });
      return [r.signals.includes('lookalike_domain'), r.signals.join(', ')];
    });
    test('The checker never returns a verdict of "safe"', () => {
      const levels = new Set(data.messages.examples.map((e) => C.analyse(e).level));
      const labels = Object.values(data.messages.levels).map((l) => l.label).join(' ') + ' ' + data.messages.noSignsText;
      return [!levels.has('safe') && !/\bsafe\b/i.test(labels), [...levels].join(', ')];
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = defineTests;
  else root.KinholdTests = defineTests;
})(typeof self !== 'undefined' ? self : this);
