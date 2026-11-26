/*
 * Activation (#activation): the onboarding funnel, cohorts, time to go live and why compliance sends lenders back.
 */
(function (root) {
  'use strict';
  const K = root.SignalKit, C = root.SignalCharts, A = root.SignalApp, esc = K.esc;
  const STAGE_KEYS = ['signed_up', 'sandbox_keys_issued', 'first_sandbox_call', 'kyc_approved', 'production_keys_issued', 'first_live_call', 'reached_1000_live_calls'];

  async function render(el, ctx) {
    const p = ctx.params;
    const charts = [];
    this.cleanup = () => charts.forEach((c) => c.destroy());
    el.innerHTML = '';
    K.header(el, { title: 'Activation', lede: 'How lenders who signed up between ' + K.month(p.from_month) + ' and ' + K.month(p.to_month) + ' moved from signup to live. Recent signups may still be on their way, so the later steps look lower for them.' });
    K.filters(el, ['lender_type', 'plan', 'size_band', 'region']);

    const funnel = K.section(el, { kicker: 'Onboarding funnel', height: 330 });
    const cohorts = K.section(el, { kicker: 'Cohorts', height: 300 });
    const row = document.createElement('div'); row.className = 'sec-row'; el.appendChild(row);
    const ttl = K.section(row, { kicker: 'Time to go live', height: 240 });
    const reasons = K.section(row, { kicker: 'Compliance', height: 200 });

    const [F, Co, T, Re] = await K.runAll(['activation_funnel', ['activation_cohorts', { from_month: '2024-11' }], 'activation_time_to_live', 'activation_compliance_reasons'], p);

    /* ----- funnel ----- */
    const rows = F.rows;
    const steps = rows.filter((r) => r.pct_from_previous !== null);
    if (!rows.length || rows[0].lenders === 0 || !steps.length) {
      funnel.headline(rows.length && rows[0].lenders ? 'Only ' + K.plural(rows[0].lenders, 'lender') + ' signed up in this segment, and none got further. Too few for a funnel.' : 'No lenders signed up in this range with these filters.');
      funnel.body.innerHTML = '<div class="empty"><p class="muted">Widen the date range or clear a filter to see the funnel.</p></div>';
    } else {
      const worst = steps.slice().sort((a, b) => a.pct_from_previous - b.pct_from_previous)[0];
      const slowest = steps.slice().sort((a, b) => b.median_days_from_previous - a.median_days_from_previous)[0];
      const prevStage = rows.find((r) => r.stage_order === worst.stage_order - 1);
      funnel.headline(worst.stage === 'kyc_approved'
        ? 'Most lenders get stuck at compliance, not at signup. Only ' + K.pct(worst.pct_from_previous, 0) + ' of lenders who test in the sandbox get approved' + (slowest.stage === 'kyc_approved' ? ', after a median of ' + Math.round(worst.median_days_from_previous) + ' days.' : '.')
        : 'The biggest drop is at "' + K.label('stage', worst.stage) + '": only ' + K.pct(worst.pct_from_previous, 0) + ' of lenders get past "' + K.label('stage', prevStage.stage) + '".');
      funnel.sub('Lenders reaching each stage, with the share who continue and the median days each step takes. Select a stage to see who is stuck before it.');
      const max = rows[0].lenders;
      funnel.body.innerHTML = '<div class="funnel-wrap"><ol class="funnel">' + rows.map((r, i) => {
        const isWorst = r === worst;
        const drop = i === 0 ? '' : '<div class="f-drop' + (isWorst ? ' worst' : '') + '"><span>' + K.pct(r.pct_from_previous, 0) + ' continue</span><span>' + (r.change_from_previous < 0 ? K.plural(-r.change_from_previous, 'lender') + ' stop' : 'no drop') + '</span><span>median ' + (r.median_days_from_previous < 1 ? 'under a day' : K.num(r.median_days_from_previous, { dp: true }) + ' days') + '</span></div>';
        return '<li>' + drop + '<button type="button" class="f-row' + (isWorst ? ' worst' : '') + '" data-stage="' + r.stage_order + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="' + esc(K.label('stage', r.stage) + ': ' + r.lenders + ' lenders, ' + r.pct_of_signups + '% of signups' + (i ? '. Show who is stuck before this stage' : '')) + '">' +
          '<span class="f-label">' + esc(K.label('stage', r.stage)) + '</span>' +
          '<span class="f-bar"><span style="width:' + (100 * r.lenders / max).toFixed(1) + '%"></span></span>' +
          '<span class="f-count">' + K.num(r.lenders) + '</span><span class="f-pct">' + K.pct(r.pct_of_signups, 0) + '</span></button></li>';
      }).join('') + '</ol><aside class="f-detail" aria-live="polite"></aside></div>';
      const detail = funnel.body.querySelector('.f-detail');
      const pick = async (stage) => {
        funnel.body.querySelectorAll('.f-row').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.stage === stage)));
        const r = rows.find((x) => x.stage_order === stage);
        const before = rows.find((x) => x.stage_order === stage - 1);
        detail.innerHTML = '<p class="muted">Loading…</p>';
        const q = await K.run('activation_stage_lenders', Object.assign({}, p, { stage }));
        const list = q.rows;
        detail.innerHTML = '<h3>Stuck before "' + esc(K.label('stage', r.stage)) + '"</h3>' +
          '<p class="muted">' + K.plural(list.length, 'lender') + ' reached "' + esc(K.label('stage', before.stage)) + '" and went no further' + (list.length ? '. Longest waits first.' : '.') + '</p>' +
          (list.length ? '<ul class="f-list">' + list.slice(0, 8).map((x) => '<li>' + K.avatar(x.name, x.id) + '<a href="' + A.hrefFor('customer/' + x.id) + '">' + esc(x.name) + '</a><span>' + K.plural(x.days_waiting, 'day') + '</span></li>').join('') + '</ul>' +
            (list.length > 8 ? '<a href="' + A.hrefFor('accounts') + '">See all ' + list.length + ' in accounts to act on</a>' : '') : '') +
          '<div class="f-sql"></div>';
        detail.querySelector('.f-sql').appendChild(K.sqlPanel(q, Object.assign({}, p, { stage })));
      };
      funnel.body.querySelectorAll('.f-row:not([disabled])').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.stage)));
      pick(worst.stage_order);
      funnel.sowhat('The fix is in compliance, not marketing. Cutting resubmissions and review time is worth more than more signups.', 'Product and Compliance', A.hrefFor('insights'), 'Read the PRD');
    }
    funnel.sql(F, p);

    /* ----- cohorts ----- */
    const byCohort = {};
    Co.rows.forEach((r) => { (byCohort[r.cohort_month] = byCohort[r.cohort_month] || { signups: r.signups, cells: [] }).cells[r.months_since_signup] = r; });
    const cohortMonths = Object.keys(byCohort).sort();
    const at3 = (list) => { const c = list.map((m) => byCohort[m].cells[2]).filter(Boolean); const s = c.reduce((a, x) => a + x.signups, 0); return s ? 100 * c.reduce((a, x) => a + x.live, 0) / s : null; };
    const before = cohortMonths.filter((m) => m < '2025-07'), after = cohortMonths.filter((m) => m >= '2025-07');
    const b3 = at3(before), a3 = at3(after);
    const size = (list) => list.reduce((n, m) => n + (byCohort[m].cells[2] ? byCohort[m].signups : 0), 0);
    const enough = size(before) >= 15 && size(after) >= 15;
    cohorts.headline(!enough && cohortMonths.length ? 'Too few lenders in this segment to compare cohorts before and after the docs rewrite fairly.' : b3 !== null && a3 !== null
      ? (a3 > b3 ? 'Lenders who signed up after the docs rewrite went live faster: ' + K.pct(a3, 0) + ' were live within three months, against ' + K.pct(b3, 0) + ' before.' : 'Cohorts after the docs rewrite have not gone live faster: ' + K.pct(a3, 0) + ' within three months, against ' + K.pct(b3, 0) + ' before.')
      : 'Share of each signup month live after each month.');
    cohorts.sub('Share of each signup month\'s lenders who had made a live call by the end of each month after signing up. All 24 months are shown so you can compare before and after the docs rewrite on 1 July 2025. Small cohorts swing a lot, so counts are in the tooltip.');
    const cols = 13;
    cohorts.body.innerHTML = '<div class="heat-wrap" tabindex="0" role="region" aria-label="Cohort table"><table class="heat"><caption class="visually-hidden">Share of lenders live by months since signup, by signup month</caption><thead><tr><th scope="col">Signed up</th><th scope="col" class="num">Lenders</th>' +
      Array.from({ length: cols }, (_, i) => '<th scope="col">' + (i === 0 ? 'Same month' : 'M' + i) + '</th>').join('') + '</tr></thead><tbody>' +
      cohortMonths.map((m) => {
        const c = byCohort[m];
        return (m === '2025-07' ? '<tr class="heat-mark"><td colspan="' + (cols + 2) + '"><span>Integration docs rewritten, 1 July 2025</span></td></tr>' : '') +
          '<tr><th scope="row">' + K.month(m) + '</th><td class="num">' + c.signups + '</td>' + Array.from({ length: cols }, (_, i) => {
            const cell = c.cells[i];
            if (!cell) return '<td class="heat-na"></td>';
            const v = cell.pct_live;
            return '<td style="--v:' + (v / 100).toFixed(3) + '" class="' + (v >= 55 ? 'dark' : '') + '" title="' + esc(K.month(m) + ' signups, end of month ' + i + ': ' + cell.live + ' of ' + cell.signups + ' live') + '">' + Math.round(v) + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    cohorts.sowhat('Better docs helped the sandbox steps, but compliance still holds lenders back. The next gain has to come from there.', 'Product');
    cohorts.sql(Co, Object.assign({}, p, { from_month: '2024-11' }));

    /* ----- time to first live call ----- */
    const tr = T.rows;
    if (!tr.length) { ttl.headline('No lenders in this range have gone live yet.'); ttl.body.innerHTML = ''; }
    else {
      const total = tr.reduce((s, r) => s + r.lenders, 0);
      let cum = 0, halfBy = null;
      tr.forEach((r) => { cum += r.lenders; if (halfBy === null && cum >= total / 2) halfBy = r.from_day + 15; });
      const avg = (plan) => { const n = tr.reduce((s, r) => s + r[plan], 0); return n ? tr.reduce((s, r) => s + r[plan] * (r.from_day + 7.5), 0) / n : null; };
      ttl.headline('Half the lenders who went live did so within ' + (halfBy >= 120 ? '120 days or more' : halfBy + ' days') + ' of signing up.');
      const sa = avg('starter'), ea = avg('enterprise');
      ttl.sub('Lenders by days from signup to first live call, in 15-day buckets, split by plan.' + (sa && ea ? ' Enterprise lenders take about ' + Math.round(ea) + ' days on average, Starter about ' + Math.round(sa) + '.' : ''));
      const box = document.createElement('div'); ttl.body.innerHTML = ''; ttl.body.appendChild(box);
      charts.push(C.xy(box, {
        x: tr.map((r) => r.from_day), xLabel: (d) => (d >= 120 ? '120+' : d + '–' + (d + 14)).replace('–', ' to '), xTip: (d) => (d >= 120 ? '120 days or more' : d + ' to ' + (d + 14) + ' days'),
        series: [{ name: 'Starter', values: tr.map((r) => r.starter), color: 'var(--c-muted)', type: 'bar' }, { name: 'Growth', values: tr.map((r) => r.growth), color: 'var(--c3)', type: 'bar' }, { name: 'Enterprise', values: tr.map((r) => r.enterprise), color: 'var(--accent)', type: 'bar' }],
        stacked: true, legend: true, yFormat: (v) => K.num(v), height: 230, ariaLabel: 'Lenders by days to first live call',
      }));
      ttl.sowhat('A slow tail of lenders takes over three months. Those are the ones a status tracker would help most.', 'Customer Success');
    }
    ttl.sql(T, p);

    /* ----- compliance reasons ----- */
    const rr = Re.rows;
    const total = rr.reduce((s, r) => s + r.requests, 0);
    const missing = rr.filter((r) => r.kind === 'Missing document').reduce((s, r) => s + r.requests, 0);
    reasons.headline(total ? K.pct(100 * missing / total, 0) + ' of compliance rework is a missing document that a checklist could catch.' : 'No compliance requests in this range.');
    reasons.sub('Why compliance asked lenders for more information, for lenders in this signup range. Missing documents are highlighted.');
    const hb = document.createElement('div'); reasons.body.innerHTML = ''; reasons.body.appendChild(hb);
    C.hbars(hb, rr.map((r) => ({ label: r.reason, sub: r.kind, value: r.requests, display: K.num(r.requests) + ' (' + K.pct(r.pct_of_requests, 0) + ')', highlight: r.kind === 'Missing document' })));
    reasons.sowhat('A self-serve checklist that checks documents before submission would remove most resubmissions.', 'Product', A.hrefFor('insights'), 'See the proposal');
    reasons.sql(Re, p);
  }

  A.register('activation', { render });
})(window);
