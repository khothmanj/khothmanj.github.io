/*
 * Signal query library.
 *
 * Every chart and table in Signal is produced by one of these queries. Each one is a
 * SQL template plus the business question it answers. Filters are written into the SQL
 * as plain values before it runs, so the query you see under "Show the SQL" is exactly
 * the query that produced the chart, and it runs as-is in the SQL workspace.
 *
 * Template tokens:
 *   {{from}} {{to}}               first and last day of the selected date range
 *   {{from_month}} {{to_month}}   the same range as YYYY-MM
 *   {{seg c}}                     "AND c.plan = 'growth'" lines for the active segment filters (alias c)
 *   {{where-seg c}}               the same, as a WHERE clause (or nothing)
 *   {{ep u}}                      "AND u.endpoint_id = 3" when an endpoint filter is set (alias u)
 *   {{customer}}                  a customer id
 *   {{uplift}}                    percentage points for opportunity sizing
 *   {{stage}}                     an onboarding stage number (2 to 7)
 *
 * Works in the browser (window.SignalQueries) and in Node (module.exports) for tests.
 */
(function (root) {
  'use strict';

  const ALLOWED = {
    lender_type: ['digital_lender', 'microfinance_bank', 'cooperative', 'bnpl'],
    plan: ['starter', 'growth', 'enterprise'],
    size_band: ['small', 'mid', 'large'],
    region: ['Lagos', 'FCT', 'South-South', 'South-West', 'North', 'South-East'],
    endpoint: ['bvn', 'nin', 'bureau', 'statement', 'mandate', 'disbursement', 'collection', 'webhook'],
  };
  const ENDPOINT_IDS = { bvn: [1, 'BVN verification'], nin: [2, 'NIN verification'], bureau: [3, 'Credit bureau report'], statement: [4, 'Bank statement analysis'], mandate: [5, 'Direct debit mandate'], disbursement: [6, 'Disbursement'], collection: [7, 'Repayment collection'], webhook: [8, 'Webhook delivery'] };
  const DATA_FIRST_MONTH = '2024-11';
  const DATA_LAST_MONTH = '2026-10';
  const DEFAULTS = { from_month: '2025-11', to_month: '2026-10', lender_type: '', plan: '', size_band: '', region: '', endpoint: '', customer: 48, uplift: 10, stage: 4 };
  const SEGMENT_KEYS = ['lender_type', 'plan', 'size_band', 'region'];

  /* ---------- the library ---------- */
  // skills: what the query shows off, for the workspace list. view: where it is used.
  const Q = [];
  const add = (q) => Q.push(q);

  /* ===== Overview ===== */
  add({
    id: 'overview_monthly', view: 'overview', title: 'Headline metrics by month',
    question: 'How many customers are active, how many live calls did they make and how much revenue did that bring in, compared with the month before?',
    skills: ['window functions', 'LAG', 'month-on-month change'],
    sql: `-- Active customer: at least 100 successful live calls in the month.
-- Revenue: platform fee plus metered usage (see the customer_months view).
WITH monthly AS (
  SELECT cm.month,
         SUM(cm.is_active) AS active_customers,
         SUM(cm.live_calls) AS live_calls,
         SUM(cm.revenue_ngn) AS revenue_ngn
  FROM customer_months cm
  JOIN customers c ON c.id = cm.customer_id
  {{where-seg c}}
  GROUP BY cm.month
), compared AS (
  SELECT month, active_customers, live_calls, revenue_ngn,
         LAG(active_customers) OVER w AS prev_active_customers,
         LAG(live_calls) OVER w AS prev_live_calls,
         LAG(revenue_ngn) OVER w AS prev_revenue_ngn
  FROM monthly
  WINDOW w AS (ORDER BY month)
)
SELECT month,
       active_customers,
       active_customers - prev_active_customers AS active_change,
       live_calls,
       ROUND(100.0 * (live_calls - prev_live_calls) / prev_live_calls, 1) AS live_calls_change_pct,
       ROUND(revenue_ngn) AS revenue_ngn,
       ROUND(100.0 * (revenue_ngn - prev_revenue_ngn) / prev_revenue_ngn, 1) AS revenue_change_pct
FROM compared
WHERE month > strftime('%Y-%m', '{{to_month}}-01', '-12 months')
  AND month <= '{{to_month}}'
ORDER BY month;`,
  });

  add({
    id: 'overview_nrr', view: 'overview', title: 'Net revenue retention',
    question: 'Of the customers who were paying a year ago, how does their revenue now compare with then, including those who left?',
    skills: ['self join', 'date arithmetic', 'cohort comparison'],
    sql: `-- Net revenue retention (NRR): revenue this month from customers who paid 12 months ago,
-- divided by what those same customers paid 12 months ago. Churned customers count as zero.
WITH revenue AS (
  SELECT cm.customer_id, cm.month, cm.revenue_ngn
  FROM customer_months cm
  JOIN customers c ON c.id = cm.customer_id
  {{where-seg c}}
)
SELECT m.month,
       COUNT(base.customer_id) AS customers_a_year_ago,
       ROUND(SUM(base.revenue_ngn)) AS revenue_a_year_ago,
       ROUND(SUM(COALESCE(now.revenue_ngn, 0))) AS their_revenue_now,
       ROUND(100.0 * SUM(COALESCE(now.revenue_ngn, 0)) / SUM(base.revenue_ngn), 1) AS nrr_pct
FROM months m
JOIN revenue base
  ON base.month = strftime('%Y-%m', m.first_day, '-12 months')
 AND base.revenue_ngn > 0
LEFT JOIN revenue now
  ON now.customer_id = base.customer_id
 AND now.month = m.month
WHERE m.month > strftime('%Y-%m', '{{to_month}}-01', '-12 months')
  AND m.month <= '{{to_month}}'
GROUP BY m.month
ORDER BY m.month;`,
  });

  add({
    id: 'overview_activation', view: 'overview', title: 'Activation rate by month',
    question: 'What share of new lenders go live within 90 days of signing up, and is it improving?',
    skills: ['date windows', 'conditional aggregation'],
    sql: `-- Activation rate: share of signups that make a successful live call within 90 days.
-- Each month looks at lenders who signed up three to five months earlier,
-- so every one of them has had the full 90 days.
SELECT m.month,
       COUNT(*) AS signups_in_window,
       SUM(s.first_live_call_at IS NOT NULL
           AND julianday(s.first_live_call_at) - julianday(s.signup_date) <= 90) AS live_within_90_days,
       ROUND(100.0 * SUM(s.first_live_call_at IS NOT NULL
           AND julianday(s.first_live_call_at) - julianday(s.signup_date) <= 90) / COUNT(*), 1) AS activation_rate_pct
FROM months m
JOIN customer_stages s
  ON s.signup_date BETWEEN date(m.first_day, '-5 months') AND date(m.first_day, '-2 months', '-1 day')
JOIN customers c ON c.id = s.customer_id
WHERE m.month > strftime('%Y-%m', '{{to_month}}-01', '-12 months')
  AND m.month <= '{{to_month}}'{{seg c}}
GROUP BY m.month
ORDER BY m.month;`,
  });

  add({
    id: 'overview_time_to_live', view: 'overview', title: 'Median days to first live call',
    question: 'How long does it take a new lender to go from signup to their first successful live call?',
    skills: ['median with ROW_NUMBER', 'rolling window'],
    sql: `-- Time to first live call: days from signup to the first successful live call.
-- Each month covers lenders whose first live call was in that month or the two before it.
WITH firsts AS (
  SELECT m.month,
         julianday(s.first_live_call_at) - julianday(s.signup_date) AS days
  FROM months m
  JOIN customer_stages s
    ON date(s.first_live_call_at) BETWEEN date(m.first_day, '-2 months') AND m.last_day
  JOIN customers c ON c.id = s.customer_id
  WHERE s.signup_date >= (SELECT value FROM meta WHERE key = 'history_from')
    AND m.month > strftime('%Y-%m', '{{to_month}}-01', '-12 months')
    AND m.month <= '{{to_month}}'{{seg c}}
), ranked AS (
  SELECT month, days,
         ROW_NUMBER() OVER (PARTITION BY month ORDER BY days) AS rn,
         COUNT(*) OVER (PARTITION BY month) AS n
  FROM firsts
)
SELECT month,
       MAX(n) AS lenders,
       ROUND(AVG(days), 1) AS median_days
FROM ranked
WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY month
ORDER BY month;`,
  });


  add({
    id: 'overview_trend', view: 'overview', title: 'Live calls and revenue over time',
    question: 'How have live API calls and revenue grown since the start of the data?',
    skills: ['GROUP BY month', 'joins'],
    sql: `SELECT cm.month,
       SUM(cm.live_calls) AS live_calls,
       ROUND(SUM(cm.revenue_ngn)) AS revenue_ngn
FROM customer_months cm
JOIN customers c ON c.id = cm.customer_id
WHERE cm.month <= '{{to_month}}'{{seg c}}
GROUP BY cm.month
ORDER BY cm.month;`,
  });

  add({
    id: 'overview_endpoints', view: 'overview', title: 'Endpoint status this month',
    question: 'Which endpoints are healthy this month, and how do errors and revenue compare with last month?',
    skills: ['self join on months', 'CASE thresholds'],
    sql: `-- Status: Healthy under 3% failed calls, Watch from 3%, Failing from 8%.
WITH monthly AS (
  SELECT u.endpoint_id, u.month,
         SUM(u.calls) AS calls, SUM(u.errors) AS errors, SUM(u.revenue_ngn) AS revenue_ngn
  FROM usage_priced u
  JOIN customers c ON c.id = u.customer_id
  WHERE u.month IN ('{{to_month}}', strftime('%Y-%m', '{{to_month}}-01', '-1 month')){{seg c}}
  GROUP BY u.endpoint_id, u.month
)
SELECT e.code AS endpoint,
       e.name,
       cur.calls,
       ROUND(100.0 * cur.errors / cur.calls, 2) AS error_rate_pct,
       ROUND(100.0 * prev.errors / prev.calls, 2) AS prev_error_rate_pct,
       ROUND(cur.revenue_ngn) AS revenue_ngn,
       ROUND(prev.revenue_ngn) AS prev_revenue_ngn,
       CASE
         WHEN cur.calls IS NULL THEN 'No traffic'
         WHEN 100.0 * cur.errors / cur.calls >= 8 THEN 'Failing'
         WHEN 100.0 * cur.errors / cur.calls >= 3 THEN 'Watch'
         ELSE 'Healthy'
       END AS status
FROM endpoints e
LEFT JOIN monthly cur ON cur.endpoint_id = e.id AND cur.month = '{{to_month}}'
LEFT JOIN monthly prev ON prev.endpoint_id = e.id AND prev.month = strftime('%Y-%m', '{{to_month}}-01', '-1 month')
ORDER BY e.id;`,
  });

  add({
    id: 'overview_compliance', view: 'overview', title: 'Compliance review speed',
    question: 'Are compliance decisions getting slower, and how many lenders are waiting right now?',
    skills: ['period comparison', 'scalar subquery'],
    sql: `WITH reviews AS (
  SELECT julianday(r.decided_at) - julianday(r.submitted_at) AS days,
         CASE WHEN r.decided_at > date('{{to}}', '-3 months') THEN 'Last 3 months' ELSE 'The 3 months before' END AS period
  FROM compliance_reviews r
  JOIN customers c ON c.id = r.customer_id
  WHERE r.decided_at IS NOT NULL
    AND r.decided_at > date('{{to}}', '-6 months')
    AND r.decided_at <= '{{to}} 23:59'{{seg c}}
)
SELECT period,
       COUNT(*) AS decisions,
       ROUND(AVG(days), 1) AS avg_days_to_decision,
       (SELECT COUNT(*) FROM compliance_reviews p
         WHERE p.submitted_at <= '{{to}} 23:59'
           AND (p.decided_at IS NULL OR p.decided_at > '{{to}} 23:59')) AS waiting_at_month_end
FROM reviews
GROUP BY period
ORDER BY period = 'Last 3 months' DESC;`,
  });

  /* ===== Activation ===== */
  add({
    id: 'activation_funnel', view: 'activation', title: 'Onboarding funnel',
    question: 'Where do lenders drop off between signing up and making 1,000 live calls, and how long does each step take?',
    skills: ['CTEs', 'LAG', 'FIRST_VALUE', 'median', 'funnel conversion'],
    sql: `WITH cohort AS (
  SELECT c.id
  FROM customers c
  WHERE c.signup_date BETWEEN '{{from}}' AND '{{to}}'{{seg c}}
), steps AS (
  SELECT e.stage_order, e.stage,
         julianday(e.occurred_at) - julianday(LAG(e.occurred_at) OVER (
           PARTITION BY e.customer_id ORDER BY e.stage_order)) AS days_from_previous
  FROM onboarding_events e
  JOIN cohort ON cohort.id = e.customer_id
), ranked AS (
  SELECT stage_order, stage, days_from_previous,
         ROW_NUMBER() OVER (PARTITION BY stage_order ORDER BY days_from_previous) AS rn,
         COUNT(days_from_previous) OVER (PARTITION BY stage_order) AS timed
  FROM steps
), per_stage AS (
  SELECT stage_order, stage,
         COUNT(*) AS lenders,
         AVG(CASE WHEN rn IN ((timed + 1) / 2, (timed + 2) / 2) THEN days_from_previous END) AS median_days
  FROM ranked
  GROUP BY stage_order, stage
)
SELECT stage_order,
       stage,
       lenders,
       ROUND(100.0 * lenders / FIRST_VALUE(lenders) OVER (ORDER BY stage_order), 1) AS pct_of_signups,
       ROUND(100.0 * lenders / LAG(lenders) OVER (ORDER BY stage_order), 1) AS pct_from_previous,
       lenders - LAG(lenders) OVER (ORDER BY stage_order) AS change_from_previous,
       ROUND(median_days, 1) AS median_days_from_previous
FROM per_stage
ORDER BY stage_order;`,
  });

  add({
    id: 'activation_cohorts', view: 'activation', title: 'Activation by signup cohort',
    question: 'For lenders who signed up in each month, what share were live after one, two, three or more months?',
    skills: ['cohort analysis', 'recursive CTE', 'CROSS JOIN'],
    sql: `-- Each cell: share of a signup month's lenders who had made a successful live call
-- by the end of the Nth month after signing up. Months that have not happened yet are left out.
WITH RECURSIVE offsets(n) AS (
  SELECT 0
  UNION ALL
  SELECT n + 1 FROM offsets WHERE n < 12
), cohort AS (
  SELECT substr(s.signup_date, 1, 7) AS cohort_month, s.first_live_call_at
  FROM customer_stages s
  JOIN customers c ON c.id = s.customer_id
  WHERE s.signup_date BETWEEN '{{from}}' AND '{{to}}'{{seg c}}
)
SELECT cohort_month,
       o.n AS months_since_signup,
       COUNT(*) AS signups,
       SUM(first_live_call_at < date(cohort_month || '-01', '+' || (o.n + 1) || ' months')) AS live,
       ROUND(100.0 * SUM(first_live_call_at < date(cohort_month || '-01', '+' || (o.n + 1) || ' months')) / COUNT(*), 1) AS pct_live
FROM cohort
CROSS JOIN offsets o
WHERE date(cohort_month || '-01', '+' || o.n || ' months') <= (SELECT value FROM meta WHERE key = 'as_of')
GROUP BY cohort_month, o.n
ORDER BY cohort_month, o.n;`,
  });

  add({
    id: 'activation_time_to_live', view: 'activation', title: 'Time to first live call',
    question: 'How many days do lenders take to go live, and do bigger plans go live faster?',
    skills: ['bucketing', 'conditional aggregation'],
    sql: `-- Days from signup to first successful live call, in 15-day buckets (the last bucket is 120 days or more).
WITH live AS (
  SELECT c.plan,
         julianday(s.first_live_call_at) - julianday(s.signup_date) AS days
  FROM customer_stages s
  JOIN customers c ON c.id = s.customer_id
  WHERE s.first_live_call_at IS NOT NULL
    AND s.signup_date BETWEEN '{{from}}' AND '{{to}}'{{seg c}}
)
SELECT MIN(CAST(days / 15 AS INTEGER), 8) * 15 AS from_day,
       COUNT(*) AS lenders,
       SUM(plan = 'starter') AS starter,
       SUM(plan = 'growth') AS growth,
       SUM(plan = 'enterprise') AS enterprise
FROM live
GROUP BY 1
ORDER BY 1;`,
  });

  add({
    id: 'activation_compliance_reasons', view: 'activation', title: 'Why compliance sends lenders back',
    question: 'When compliance asks a lender for more information, what is usually missing?',
    skills: ['GROUP BY', 'share of total with a window'],
    sql: `SELECT r.reason,
       COUNT(*) AS requests,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_requests,
       CASE WHEN r.reason IN ('Operating licence not attached', 'Data protection policy missing', 'Directors ID documents unclear')
            THEN 'Missing document' ELSE 'Needs explanation' END AS kind
FROM compliance_reviews r
JOIN customers c ON c.id = r.customer_id
WHERE r.outcome = 'info_requested'
  AND c.signup_date BETWEEN '{{from}}' AND '{{to}}'{{seg c}}
GROUP BY r.reason
ORDER BY requests DESC;`,
  });


  add({
    id: 'activation_stage_lenders', view: 'activation', title: 'Lenders stuck before a stage',
    question: 'Which lenders reached the step before this stage but not this one, and for how long?',
    skills: ['CASE inside a function', 'filtering on a view'],
    sql: `-- Lenders in the signup range whose furthest stage is the one before stage {{stage}}.
SELECT c.id, c.name, c.plan, c.lender_type, s.signup_date,
       CAST(julianday((SELECT value FROM meta WHERE key = 'as_of')) - julianday(CASE s.furthest_stage
         WHEN 1 THEN s.signed_up_at WHEN 2 THEN s.sandbox_keys_at WHEN 3 THEN s.first_sandbox_call_at
         WHEN 4 THEN s.kyc_approved_at WHEN 5 THEN s.production_keys_at ELSE s.first_live_call_at END) AS INTEGER) AS days_waiting
FROM customer_stages s
JOIN customers c ON c.id = s.customer_id
WHERE s.signup_date BETWEEN '{{from}}' AND '{{to}}'
  AND s.furthest_stage = {{stage}} - 1
  AND c.cancelled_date IS NULL{{seg c}}
ORDER BY days_waiting DESC;`,
  });

  /* ===== Accounts to act on ===== */
  add({
    id: 'accounts_not_live', view: 'accounts', title: 'Signed up but never went live',
    question: 'Which lenders signed up but have not gone live, why are they stuck and who should act?',
    skills: ['correlated subquery', 'CASE', 'LEFT JOIN', 'string building'],
    sql: `-- Lenders who signed up at least 14 days ago, have no successful live call and have not cancelled.
-- The reason and next action are inferred from how far they got and what they did last.
-- Anyone idle for over 180 days is Dormant: a re-engagement email, not a call.
WITH as_of AS (
  SELECT value AS day FROM meta WHERE key = 'as_of'
), latest_review AS (
  SELECT r.customer_id, r.outcome, r.reason, r.submitted_at, r.decided_at
  FROM compliance_reviews r
  WHERE r.round = (SELECT MAX(x.round) FROM compliance_reviews x WHERE x.customer_id = r.customer_id)
), last_week AS (
  SELECT u.customer_id, SUM(u.calls - u.successful) AS errors_7d, SUM(u.calls) AS calls_7d
  FROM api_usage_daily u, as_of
  WHERE u.day > date(as_of.day, '-7 days')
  GROUP BY u.customer_id
), stuck AS (
  SELECT c.id, c.name, c.lender_type, c.plan, c.account_manager, c.signup_date,
         s.furthest_stage,
         lr.outcome AS review_outcome, lr.reason AS review_reason,
         COALESCE(w.errors_7d, 0) AS errors_last_7_days,
         CAST(julianday(a.day) - julianday(CASE
           WHEN s.furthest_stage = 5 THEN s.production_keys_at
           WHEN lr.outcome = 'pending' THEN lr.submitted_at
           WHEN lr.outcome IN ('info_requested', 'rejected') THEN lr.decided_at
           WHEN s.furthest_stage = 3 THEN s.first_sandbox_call_at
           ELSE s.signed_up_at END) AS INTEGER) AS days_in_stage
  FROM customers c
  JOIN customer_stages s ON s.customer_id = c.id
  LEFT JOIN latest_review lr ON lr.customer_id = c.id
  LEFT JOIN last_week w ON w.customer_id = c.id
  CROSS JOIN as_of a
  WHERE s.first_live_call_at IS NULL
    AND c.cancelled_date IS NULL
    AND julianday(a.day) - julianday(c.signup_date) >= 14{{seg c}}
)
SELECT id, name, lender_type, plan, account_manager, signup_date, days_in_stage, errors_last_7_days,
       CASE
         WHEN days_in_stage > 180 AND COALESCE(review_outcome, '') <> 'pending' THEN 'Dormant'
         WHEN furthest_stage <= 2 THEN 'Not started'
         WHEN furthest_stage = 3 AND review_outcome IS NULL THEN 'Sandbox only'
         WHEN furthest_stage = 3 THEN 'In compliance'
         ELSE 'Live keys, failing'
       END AS status,
       CASE
         WHEN furthest_stage <= 2 THEN 'No API calls in ' || days_in_stage || ' days since signup'
         WHEN furthest_stage = 3 AND review_outcome IS NULL THEN 'Sandbox calls only, no compliance application'
              || CASE WHEN errors_last_7_days > 0 THEN ', ' || errors_last_7_days || ' sandbox errors last week' ELSE '' END
         WHEN review_outcome = 'pending' THEN 'Waiting on our compliance review for ' || days_in_stage || ' days'
         WHEN review_outcome = 'info_requested' THEN 'Asked for documents ' || days_in_stage || ' days ago: ' || lower(review_reason)
         WHEN review_outcome = 'rejected' THEN 'Compliance rejected: ' || lower(review_reason)
         ELSE 'Live keys for ' || days_in_stage || ' days, no successful live call, ' || errors_last_7_days || ' errors last week'
       END AS reason,
       CASE
         WHEN days_in_stage > 180 AND COALESCE(review_outcome, '') <> 'pending' THEN 'Add to the quarterly re-engagement email'
         WHEN furthest_stage <= 2 THEN 'Send the sandbox quickstart and offer a setup call'
         WHEN furthest_stage = 3 AND review_outcome IS NULL THEN 'Book an integration call and share the compliance checklist'
         WHEN review_outcome = 'pending' THEN 'Move the review up the compliance queue'
         WHEN review_outcome = 'info_requested' THEN 'Chase the missing document with the lender'
         WHEN review_outcome = 'rejected' THEN 'Confirm licence status, then close or reapply'
         ELSE 'Review their request logs with the lender'
       END AS next_action,
       CASE
         WHEN days_in_stage > 180 AND COALESCE(review_outcome, '') <> 'pending' THEN 'Marketing'
         WHEN review_outcome IN ('pending', 'rejected') THEN 'Compliance'
         WHEN furthest_stage = 5 THEN 'Solutions engineering'
         ELSE 'Customer Success'
       END AS owner,
       -- Priority: lenders waiting on us first, dormant accounts last.
       CASE
         WHEN review_outcome = 'pending' THEN 1
         WHEN days_in_stage > 180 THEN 6
         WHEN furthest_stage = 5 THEN 2
         WHEN review_outcome = 'info_requested' THEN 3
         WHEN furthest_stage = 3 THEN 4
         ELSE 5
       END AS priority
FROM stuck
ORDER BY priority, days_in_stage DESC;`,
  });

  add({
    id: 'accounts_declining', view: 'accounts', title: 'Live customers with falling usage',
    question: 'Which live customers are using us less than three months ago, and is there a clue why?',
    skills: ['LAG with an offset', 'GROUP_CONCAT', 'correlated subquery'],
    sql: `-- Successful live calls in the latest month against three months earlier.
-- Flags live customers down 30% or more, with their latest pricing or error ticket as a clue.
WITH monthly AS (
  SELECT cm.customer_id, cm.month, cm.live_calls, cm.revenue_ngn,
         LAG(cm.live_calls, 3) OVER (PARTITION BY cm.customer_id ORDER BY cm.month) AS calls_3_months_before
  FROM customer_months cm
  WHERE cm.month <= '{{to_month}}'
), latest AS (
  SELECT * FROM monthly WHERE month = '{{to_month}}'
), trend AS (
  SELECT customer_id, GROUP_CONCAT(live_calls, ',') AS last_12_months
  FROM (SELECT customer_id, month, live_calls FROM monthly
        WHERE month > strftime('%Y-%m', '{{to_month}}-01', '-12 months') ORDER BY customer_id, month)
  GROUP BY customer_id
)
SELECT c.id, c.name, c.plan, c.size_band, c.account_manager,
       l.calls_3_months_before, l.live_calls AS calls_latest_month,
       ROUND(100.0 * (l.live_calls - l.calls_3_months_before) / l.calls_3_months_before, 1) AS change_pct,
       ROUND(l.revenue_ngn) AS revenue_latest_month,
       t.last_12_months,
       clue.category AS last_ticket_category,
       clue.subject AS last_ticket,
       'Usage down ' || CAST(ROUND(100.0 * (l.calls_3_months_before - l.live_calls) / l.calls_3_months_before) AS INTEGER) || '% over 3 months' AS reason,
       CASE clue.category
         WHEN 'billing' THEN 'Review pricing and offer a volume tier'
         WHEN 'api_errors' THEN 'Go through their error logs with Engineering'
         ELSE 'Check in on their lending plans'
       END AS next_action,
       CASE WHEN c.account_manager = 'Self-serve' THEN 'Customer Success' ELSE c.account_manager END AS owner
FROM latest l
JOIN customers c ON c.id = l.customer_id
JOIN trend t ON t.customer_id = c.id
-- The clue: their latest pricing or error ticket in the last six months.
LEFT JOIN support_tickets clue ON clue.id = (
  SELECT st.id FROM support_tickets st
  WHERE st.customer_id = c.id AND st.category IN ('billing', 'api_errors')
    AND st.opened_at > date('{{to}}', '-6 months') AND st.opened_at <= '{{to}} 23:59'
  ORDER BY st.opened_at DESC LIMIT 1)
WHERE l.calls_3_months_before > 0
  AND l.live_calls <= 0.7 * l.calls_3_months_before{{seg c}}
ORDER BY change_pct;`,
  });

  /* ===== Customer 360 ===== */
  add({
    id: 'customer_profile', view: 'customer', title: 'Customer profile',
    question: 'Who is this lender, where are they in onboarding and what are they worth?',
    skills: ['scalar subqueries', 'joins'],
    sql: `SELECT c.*,
       s.furthest_stage,
       s.first_live_call_at,
       (SELECT ROUND(SUM(revenue_ngn)) FROM customer_months cm
         WHERE cm.customer_id = c.id AND cm.month > strftime('%Y-%m', '{{to_month}}-01', '-12 months') AND cm.month <= '{{to_month}}') AS revenue_last_12_months,
       (SELECT SUM(is_active) FROM customer_months cm
         WHERE cm.customer_id = c.id AND cm.month > strftime('%Y-%m', '{{to_month}}-01', '-12 months') AND cm.month <= '{{to_month}}') AS active_months_last_12,
       (SELECT COUNT(*) FROM support_tickets t WHERE t.customer_id = c.id AND t.status <> 'solved') AS open_tickets,
       (SELECT COUNT(*) FROM support_tickets t WHERE t.customer_id = c.id AND t.opened_at >= date('{{to}}', '-90 days')) AS tickets_last_90_days
FROM customers c
JOIN customer_stages s ON s.customer_id = c.id
WHERE c.id = {{customer}};`,
  });

  add({
    id: 'customer_timeline', view: 'customer', title: 'Customer timeline',
    question: 'What has happened with this lender, in order: onboarding, compliance and support?',
    skills: ['UNION ALL', 'ordering mixed events'],
    sql: `SELECT occurred_at AS at, 'Onboarding' AS kind, replace(stage, '_', ' ') AS detail
FROM onboarding_events WHERE customer_id = {{customer}}
UNION ALL
SELECT submitted_at, 'Compliance', 'Round ' || round || ' submitted' FROM compliance_reviews WHERE customer_id = {{customer}}
UNION ALL
SELECT decided_at, 'Compliance', 'Round ' || round || ': ' || replace(outcome, '_', ' ') || COALESCE(' (' || reason || ')', '')
FROM compliance_reviews WHERE customer_id = {{customer}} AND decided_at IS NOT NULL
UNION ALL
SELECT opened_at, 'Support', subject || ' (' || status || ')' FROM support_tickets WHERE customer_id = {{customer}}
UNION ALL
SELECT cancelled_date, 'Account', 'Cancelled' FROM customers WHERE id = {{customer}} AND cancelled_date IS NOT NULL
ORDER BY at;`,
  });

  add({
    id: 'customer_usage', view: 'customer', title: 'Usage and spend by endpoint',
    question: 'Which endpoints does this lender use each month, and what do they spend?',
    skills: ['GROUP BY two dimensions', 'joins'],
    sql: `SELECT u.month,
       e.name AS endpoint,
       SUM(u.successful) AS live_calls,
       ROUND(SUM(u.revenue_ngn)) AS revenue_ngn
FROM usage_priced u
JOIN endpoints e ON e.id = u.endpoint_id
WHERE u.customer_id = {{customer}}
  AND u.month BETWEEN '{{from_month}}' AND '{{to_month}}'
GROUP BY u.month, e.id
ORDER BY u.month, e.id;`,
  });

  add({
    id: 'customer_errors', view: 'customer', title: 'Weekly error rate',
    question: 'Is this lender seeing more failed calls than usual, and what kind?',
    skills: ['week bucketing with strftime'],
    sql: `SELECT date(u.day, 'weekday 1', '-7 days') AS week_starting,
       SUM(u.calls) AS calls,
       ROUND(100.0 * SUM(u.errors) / SUM(u.calls), 2) AS error_rate_pct,
       SUM(u.err_timeout) AS timeouts,
       SUM(u.err_4xx) AS request_errors_4xx,
       SUM(u.err_5xx) AS our_errors_5xx,
       SUM(u.err_upstream) AS provider_errors
FROM usage_priced u
WHERE u.customer_id = {{customer}}
  AND u.day BETWEEN '{{from}}' AND '{{to}}'
GROUP BY week_starting
ORDER BY week_starting;`,
  });

  add({
    id: 'customer_invoices', view: 'customer', title: 'Invoices and ledger',
    question: 'What did we bill this lender, and does Finance have the same amounts?',
    skills: ['LEFT JOIN', 'reconciliation'],
    sql: `SELECT i.month,
       i.invoice_number,
       i.amount_ngn AS invoiced_ngn,
       l.amount_ngn AS ledger_ngn,
       CASE
         WHEN l.id IS NULL THEN 'No ledger entry'
         WHEN ABS(i.amount_ngn - l.amount_ngn) > 0.005 THEN 'Amounts differ'
         ELSE 'Matches'
       END AS check_result
FROM invoices i
LEFT JOIN ledger l ON l.reference = i.invoice_number
WHERE i.customer_id = {{customer}}
ORDER BY i.month DESC, i.invoice_number;`,
  });

  add({
    id: 'customer_tickets', view: 'customer', title: 'Support tickets',
    question: 'What has this lender asked us for help with?',
    skills: ['date difference'],
    sql: `SELECT opened_at, category, subject, status,
       ROUND((julianday(resolved_at) - julianday(opened_at)) * 24, 1) AS hours_to_solve
FROM support_tickets
WHERE customer_id = {{customer}}
ORDER BY opened_at DESC;`,
  });


  add({
    id: 'customer_list', view: 'customer', title: 'Customer list',
    question: 'Which lenders can I open a Customer 360 for?',
    skills: ['simple SELECT'],
    sql: `SELECT id, name, lender_type, plan FROM customers ORDER BY name;`,
  });

  /* ===== Usage and spend ===== */
  add({
    id: 'usage_by_endpoint', view: 'usage', title: 'Calls and revenue by endpoint',
    question: 'How are calls and revenue moving for each endpoint, month by month?',
    skills: ['GROUP BY', 'joins'],
    sql: `SELECT u.month,
       e.code AS endpoint,
       SUM(u.successful) AS live_calls,
       ROUND(SUM(u.revenue_ngn)) AS revenue_ngn
FROM usage_priced u
JOIN endpoints e ON e.id = u.endpoint_id
JOIN customers c ON c.id = u.customer_id
WHERE u.month BETWEEN '{{from_month}}' AND '{{to_month}}'{{seg c}}{{ep u}}
GROUP BY u.month, e.id
ORDER BY u.month, e.id;`,
  });

  add({
    id: 'usage_fees', view: 'usage', title: 'Platform fees by month',
    question: 'How much revenue comes from monthly platform fees rather than calls?',
    skills: ['GROUP BY', 'shared definitions'],
    sql: `-- Fees are not tied to an endpoint, so they are a separate layer in the usage chart.
SELECT cm.month,
       ROUND(SUM(cm.platform_fee_ngn)) AS platform_fees_ngn
FROM customer_months cm
JOIN customers c ON c.id = cm.customer_id
WHERE cm.month BETWEEN '{{from_month}}' AND '{{to_month}}'{{seg c}}
GROUP BY cm.month
ORDER BY cm.month;`,
  });

  add({
    id: 'usage_concentration', view: 'usage', title: 'Revenue concentration',
    question: 'How much of our revenue depends on our biggest customers?',
    skills: ['RANK', 'running total', 'share of total'],
    sql: `WITH revenue AS (
  SELECT cm.customer_id, SUM(cm.revenue_ngn) AS revenue_ngn
  FROM customer_months cm
  JOIN customers c ON c.id = cm.customer_id
  WHERE cm.month BETWEEN '{{from_month}}' AND '{{to_month}}'{{seg c}}
  GROUP BY cm.customer_id
  HAVING SUM(cm.revenue_ngn) > 0
)
SELECT RANK() OVER (ORDER BY r.revenue_ngn DESC) AS rank,
       c.name,
       c.lender_type,
       ROUND(r.revenue_ngn) AS revenue_ngn,
       ROUND(100.0 * r.revenue_ngn / SUM(r.revenue_ngn) OVER (), 1) AS pct_of_revenue,
       ROUND(100.0 * SUM(r.revenue_ngn) OVER (ORDER BY r.revenue_ngn DESC ROWS UNBOUNDED PRECEDING)
             / SUM(r.revenue_ngn) OVER (), 1) AS cumulative_pct
FROM revenue r
JOIN customers c ON c.id = r.customer_id
ORDER BY rank;`,
  });

  add({
    id: 'usage_movers', view: 'usage', title: 'Fastest growing and declining customers',
    question: 'Which customers grew or shrank most in the last three months compared with the three before?',
    skills: ['conditional aggregation', 'ranking both ends'],
    sql: `WITH periods AS (
  SELECT cm.customer_id,
         -- A customer who cancelled has no recent months, so count those as zero.
         COALESCE(SUM(CASE WHEN cm.month > strftime('%Y-%m', '{{to_month}}-01', '-3 months') THEN cm.revenue_ngn END), 0) AS last_3_months,
         COALESCE(SUM(CASE WHEN cm.month <= strftime('%Y-%m', '{{to_month}}-01', '-3 months') THEN cm.revenue_ngn END), 0) AS previous_3_months
  FROM customer_months cm
  WHERE cm.month > strftime('%Y-%m', '{{to_month}}-01', '-6 months')
    AND cm.month <= '{{to_month}}'
  GROUP BY cm.customer_id
), changes AS (
  SELECT p.*, 100.0 * (last_3_months - previous_3_months) / previous_3_months AS change_pct
  FROM periods p
  WHERE previous_3_months >= 300000
)
SELECT CASE WHEN ch.change_pct >= 0 THEN 'Growing' ELSE 'Declining' END AS direction,
       c.id, c.name, c.plan,
       ROUND(ch.previous_3_months) AS previous_3_months_ngn,
       ROUND(ch.last_3_months) AS last_3_months_ngn,
       ROUND(ch.change_pct, 1) AS change_pct
FROM changes ch
JOIN customers c ON c.id = ch.customer_id
WHERE (ch.customer_id IN (SELECT customer_id FROM changes ORDER BY change_pct DESC LIMIT 5)
       OR ch.customer_id IN (SELECT customer_id FROM changes ORDER BY change_pct ASC LIMIT 5)){{seg c}}
ORDER BY ch.change_pct DESC;`,
  });

  add({
    id: 'usage_arpc', view: 'usage', title: 'Average revenue per customer by segment',
    question: 'Which kinds of lender are worth most to us each month?',
    skills: ['UNION ALL', 'averages per segment'],
    sql: `-- Average monthly revenue per paying customer, by lender type and by plan.
WITH paying AS (
  SELECT c.lender_type, c.plan, cm.customer_id, cm.month, cm.revenue_ngn
  FROM customer_months cm
  JOIN customers c ON c.id = cm.customer_id
  WHERE cm.month BETWEEN '{{from_month}}' AND '{{to_month}}'
    AND cm.revenue_ngn > 0{{seg c}}
)
SELECT 'Lender type' AS dimension, lender_type AS segment,
       COUNT(DISTINCT customer_id) AS customers,
       ROUND(SUM(revenue_ngn) / COUNT(*)) AS avg_monthly_revenue_ngn
FROM paying GROUP BY lender_type
UNION ALL
SELECT 'Plan', plan,
       COUNT(DISTINCT customer_id),
       ROUND(SUM(revenue_ngn) / COUNT(*))
FROM paying GROUP BY plan
ORDER BY dimension, avg_monthly_revenue_ngn DESC;`,
  });

  add({
    id: 'events_in_range', view: 'usage', title: 'Product events',
    question: 'What happened that might explain a change in the charts?',
    skills: ['filtering by date'],
    sql: `SELECT day, kind, title, detail
FROM events
WHERE day BETWEEN '{{from}}' AND '{{to}}'
ORDER BY day;`,
  });

  /* ===== Integration health ===== */
  add({
    id: 'health_daily', view: 'health', title: 'Daily error rate and latency by endpoint',
    question: 'Which endpoints are failing or slow, and when did it start?',
    skills: ['weighted average', 'daily time series'],
    sql: `-- p95 is stored per customer per day, so the daily figure is a call-weighted average of p95s.
SELECT u.day,
       e.code AS endpoint,
       SUM(u.calls) AS calls,
       ROUND(100.0 * SUM(u.errors) / SUM(u.calls), 2) AS error_rate_pct,
       ROUND(100.0 * SUM(u.err_upstream) / SUM(u.calls), 2) AS provider_error_pct,
       CAST(SUM(u.p95_ms * u.calls) / SUM(u.calls) AS INTEGER) AS p95_ms
FROM usage_priced u
JOIN endpoints e ON e.id = u.endpoint_id
JOIN customers c ON c.id = u.customer_id
WHERE u.day BETWEEN '{{from}}' AND '{{to}}'{{seg c}}{{ep u}}
GROUP BY u.day, e.id
ORDER BY u.day, e.id;`,
  });

  add({
    id: 'health_error_types', view: 'health', title: 'Errors by type and endpoint',
    question: 'Are failures our fault, the lender\'s, or a provider behind us?',
    skills: ['pivoting with SUM', 'percentages'],
    sql: `SELECT e.name AS endpoint,
       SUM(u.calls) AS calls,
       ROUND(100.0 * SUM(u.errors) / SUM(u.calls), 2) AS error_rate_pct,
       SUM(u.err_timeout) AS timeouts,
       SUM(u.err_4xx) AS request_errors_4xx,
       SUM(u.err_5xx) AS our_errors_5xx,
       SUM(u.err_upstream) AS provider_errors
FROM usage_priced u
JOIN endpoints e ON e.id = u.endpoint_id
JOIN customers c ON c.id = u.customer_id
WHERE u.day BETWEEN '{{from}}' AND '{{to}}'{{seg c}}{{ep u}}
GROUP BY e.id
ORDER BY error_rate_pct DESC;`,
  });

  add({
    id: 'health_worst_customers', view: 'health', title: 'Worst affected customers',
    question: 'Which customers had the most failed calls, and what kind of failure was it?',
    skills: ['ranking', 'CASE on the largest value'],
    sql: `WITH per_customer AS (
  SELECT u.customer_id,
         SUM(u.calls) AS calls,
         SUM(u.errors) AS errors,
         SUM(u.err_timeout) AS timeouts,
         SUM(u.err_4xx) AS err_4xx,
         SUM(u.err_5xx) AS err_5xx,
         SUM(u.err_upstream) AS upstream
  FROM usage_priced u
  JOIN customers c ON c.id = u.customer_id
  WHERE u.day BETWEEN '{{from}}' AND '{{to}}'{{seg c}}{{ep u}}
  GROUP BY u.customer_id
)
SELECT c.id, c.name, c.integration_pattern, c.region,
       p.calls, p.errors,
       ROUND(100.0 * p.errors / p.calls, 2) AS error_rate_pct,
       CASE MAX(p.timeouts, p.err_4xx, p.err_5xx, p.upstream)
         WHEN p.upstream THEN 'Provider down'
         WHEN p.timeouts THEN 'Timeouts'
         WHEN p.err_4xx THEN 'Bad requests (4xx)'
         ELSE 'Our errors (5xx)'
       END AS main_failure,
       (SELECT COUNT(*) FROM support_tickets t
         WHERE t.customer_id = c.id AND t.category = 'api_errors'
           AND t.opened_at BETWEEN '{{from}}' AND '{{to}} 23:59') AS error_tickets
FROM per_customer p
JOIN customers c ON c.id = p.customer_id
WHERE p.calls >= 1000
ORDER BY p.errors DESC
LIMIT 15;`,
  });

  add({
    id: 'health_by_pattern', view: 'health', title: 'Reliability by integration pattern and region',
    question: 'Do some ways of integrating, or some regions, fail more often?',
    skills: ['UNION ALL', 'grouping on two dimensions'],
    sql: `SELECT 'Integration pattern' AS dimension, c.integration_pattern AS segment,
       COUNT(DISTINCT u.customer_id) AS customers,
       ROUND(100.0 * SUM(u.err_timeout) / SUM(u.calls), 2) AS timeout_pct,
       ROUND(100.0 * SUM(u.errors) / SUM(u.calls), 2) AS error_rate_pct,
       CAST(SUM(u.p95_ms * u.calls) / SUM(u.calls) AS INTEGER) AS p95_ms
FROM usage_priced u
JOIN customers c ON c.id = u.customer_id
WHERE u.day BETWEEN '{{from}}' AND '{{to}}'{{seg c}}{{ep u}}
GROUP BY c.integration_pattern
UNION ALL
SELECT 'Region', c.region,
       COUNT(DISTINCT u.customer_id),
       ROUND(100.0 * SUM(u.err_timeout) / SUM(u.calls), 2),
       ROUND(100.0 * SUM(u.errors) / SUM(u.calls), 2),
       CAST(SUM(u.p95_ms * u.calls) / SUM(u.calls) AS INTEGER)
FROM usage_priced u
JOIN customers c ON c.id = u.customer_id
WHERE u.day BETWEEN '{{from}}' AND '{{to}}'{{seg c}}{{ep u}}
GROUP BY c.region
ORDER BY dimension, timeout_pct DESC;`,
  });

  /* ===== Data checks ===== */
  add({
    id: 'integrity_reconciliation', view: 'integrity', title: 'Invoice and ledger reconciliation',
    question: 'Where do our invoices, the finance ledger and metered usage disagree, and why?',
    skills: ['UNION ALL of rules', 'FULL comparison', 'CASE for likely cause'],
    sql: `-- Each rule finds one kind of problem. Statuses come from recon_cases, where someone owns the issue.
WITH invoiced AS (
  SELECT customer_id, month, SUM(amount_ngn) AS invoiced_ngn, COUNT(*) AS invoice_count
  FROM invoices GROUP BY customer_id, month
), recorded AS (
  SELECT customer_id, month, SUM(amount_ngn) AS ledger_ngn
  FROM ledger GROUP BY customer_id, month
), compared AS (
  SELECT i.customer_id, i.month, i.invoiced_ngn, i.invoice_count,
         COALESCE(r.ledger_ngn, 0) AS ledger_ngn,
         COALESCE(cm.revenue_ngn, 0) AS metered_ngn
  FROM invoiced i
  LEFT JOIN recorded r ON r.customer_id = i.customer_id AND r.month = i.month
  LEFT JOIN customer_months cm ON cm.customer_id = i.customer_id AND cm.month = i.month
), flagged AS (
  SELECT customer_id, month, 'invoice_without_ledger' AS check_name, invoiced_ngn, ledger_ngn, metered_ngn
  FROM compared WHERE ledger_ngn = 0
  UNION ALL
  SELECT customer_id, month, 'duplicate_invoice', invoiced_ngn, ledger_ngn, metered_ngn
  FROM compared WHERE invoice_count > 1
  UNION ALL
  SELECT customer_id, month, 'amount_mismatch', invoiced_ngn, ledger_ngn, metered_ngn
  FROM compared WHERE ledger_ngn > 0 AND invoice_count = 1 AND ABS(invoiced_ngn - ledger_ngn) > 0.005
  UNION ALL
  SELECT co.customer_id, co.month, 'billed_after_cancellation', co.invoiced_ngn, co.ledger_ngn, co.metered_ngn
  FROM compared co JOIN customers c ON c.id = co.customer_id
  WHERE c.cancelled_date IS NOT NULL AND co.month > substr(c.cancelled_date, 1, 7)
)
SELECT f.check_name, c.id AS customer_id, c.name, f.month,
       ROUND(f.invoiced_ngn, 2) AS invoiced_ngn,
       ROUND(f.ledger_ngn, 2) AS ledger_ngn,
       ROUND(f.metered_ngn, 2) AS metered_ngn,
       ROUND(f.invoiced_ngn - f.ledger_ngn, 2) AS difference_ngn,
       CASE f.check_name
         WHEN 'invoice_without_ledger' THEN 'Ledger posting failed or was skipped'
         WHEN 'duplicate_invoice' THEN 'Invoice run issued twice'
         WHEN 'amount_mismatch' THEN CASE WHEN ABS(f.invoiced_ngn - f.ledger_ngn) < 1000
                                          THEN 'Rounding in the ledger upload' ELSE 'Amount changed after invoicing' END
         ELSE 'Subscription not closed in billing'
       END AS likely_cause,
       COALESCE(rc.status, 'open') AS status,
       COALESCE(rc.owner, 'Finance operations') AS owner
FROM flagged f
JOIN customers c ON c.id = f.customer_id
LEFT JOIN recon_cases rc ON rc.customer_id = f.customer_id AND rc.month = f.month AND rc.check_name = f.check_name
WHERE f.month BETWEEN '{{from_month}}' AND '{{to_month}}'
ORDER BY f.month DESC, f.check_name;`,
  });

  add({
    id: 'integrity_rules', view: 'integrity', title: 'Data check summary',
    question: 'How many customer-months did each check look at, and how many failed?',
    skills: ['aggregating checks', 'scalar subqueries'],
    sql: `WITH months_checked AS (
  SELECT COUNT(*) AS n FROM (SELECT DISTINCT customer_id, month FROM invoices
                             WHERE month BETWEEN '{{from_month}}' AND '{{to_month}}')
), inv AS (
  SELECT customer_id, month, SUM(amount_ngn) AS amount, COUNT(*) AS n FROM invoices
  WHERE month BETWEEN '{{from_month}}' AND '{{to_month}}' GROUP BY 1, 2
), led AS (
  SELECT customer_id, month, SUM(amount_ngn) AS amount FROM ledger GROUP BY 1, 2
)
SELECT 'Every invoice has a ledger entry' AS rule,
       (SELECT n FROM months_checked) AS checked,
       (SELECT COUNT(*) FROM inv LEFT JOIN led USING (customer_id, month) WHERE led.amount IS NULL) AS failed
UNION ALL
SELECT 'One invoice per customer per month',
       (SELECT n FROM months_checked),
       (SELECT COUNT(*) FROM inv WHERE n > 1)
UNION ALL
SELECT 'Ledger amount equals invoice amount',
       (SELECT n FROM months_checked),
       (SELECT COUNT(*) FROM inv JOIN led USING (customer_id, month) WHERE inv.n = 1 AND ABS(inv.amount - led.amount) > 0.005)
UNION ALL
SELECT 'No invoices after cancellation',
       (SELECT n FROM months_checked),
       (SELECT COUNT(*) FROM inv JOIN customers c ON c.id = inv.customer_id
         WHERE c.cancelled_date IS NOT NULL AND inv.month > substr(c.cancelled_date, 1, 7))
UNION ALL
SELECT 'Invoice equals metered usage plus fee',
       (SELECT n FROM months_checked),
       (SELECT COUNT(*) FROM inv LEFT JOIN customer_months cm USING (customer_id, month)
         WHERE ABS(inv.amount - COALESCE(cm.revenue_ngn, 0)) > 0.005);`,
  });


  add({
    id: 'integrity_monthly', view: 'integrity', title: 'Monthly reconciliation',
    question: 'Each month, does the total we invoiced match the total Finance recorded?',
    skills: ['USING join', 'monthly totals'],
    sql: `WITH invoiced AS (
  SELECT month, COUNT(DISTINCT customer_id) AS customers, COUNT(*) AS invoices, SUM(amount_ngn) AS invoiced_ngn
  FROM invoices GROUP BY month
), recorded AS (
  SELECT month, SUM(amount_ngn) AS ledger_ngn FROM ledger GROUP BY month
)
SELECT i.month, i.customers, i.invoices,
       ROUND(i.invoiced_ngn, 2) AS invoiced_ngn,
       ROUND(COALESCE(r.ledger_ngn, 0), 2) AS ledger_ngn,
       ROUND(i.invoiced_ngn - COALESCE(r.ledger_ngn, 0), 2) AS difference_ngn
FROM invoiced i
LEFT JOIN recorded r USING (month)
WHERE i.month BETWEEN '{{from_month}}' AND '{{to_month}}'
ORDER BY i.month;`,
  });

  /* ===== Insights ===== */
  add({
    id: 'insights_problem', view: 'insights', title: 'The compliance problem in numbers',
    question: 'How big is the compliance drop-off, how slow is it and how much is missing paperwork?',
    skills: ['scalar subqueries', 'one-row summary'],
    sql: `WITH cohort AS (
  SELECT s.* FROM customer_stages s JOIN customers c ON c.id = s.customer_id
  WHERE s.signup_date BETWEEN '{{from}}' AND '{{to}}'{{seg c}}
), waits AS (
  SELECT julianday(kyc_approved_at) - julianday(first_sandbox_call_at) AS days
  FROM cohort WHERE kyc_approved_at IS NOT NULL
), ranked AS (
  SELECT days, ROW_NUMBER() OVER (ORDER BY days) AS rn, COUNT(*) OVER () AS n FROM waits
)
SELECT (SELECT COUNT(*) FROM cohort) AS signups,
       (SELECT COUNT(*) FROM cohort WHERE first_sandbox_call_at IS NOT NULL) AS made_sandbox_call,
       (SELECT COUNT(*) FROM cohort WHERE kyc_approved_at IS NOT NULL) AS compliance_approved,
       ROUND(100.0 * (SELECT COUNT(*) FROM cohort WHERE kyc_approved_at IS NOT NULL)
             / (SELECT COUNT(*) FROM cohort WHERE first_sandbox_call_at IS NOT NULL), 1) AS sandbox_to_approved_pct,
       (SELECT ROUND(AVG(days), 1) FROM ranked WHERE rn IN ((n + 1) / 2, (n + 2) / 2)) AS median_days_to_approval,
       (SELECT ROUND(100.0 * SUM(reason IN ('Operating licence not attached', 'Data protection policy missing', 'Directors ID documents unclear')) / COUNT(*), 1)
          FROM compliance_reviews r JOIN cohort ON cohort.customer_id = r.customer_id
         WHERE r.outcome = 'info_requested') AS missing_document_pct,
       (SELECT COUNT(*) FROM compliance_reviews r
         WHERE r.outcome IN ('pending', 'info_requested')
           AND r.round = (SELECT MAX(round) FROM compliance_reviews x WHERE x.customer_id = r.customer_id)
           AND NOT EXISTS (SELECT 1 FROM onboarding_events e WHERE e.customer_id = r.customer_id AND e.stage = 'kyc_approved')) AS stuck_in_compliance_now;`,
  });

  add({
    id: 'insights_opportunity', view: 'insights', title: 'Opportunity sizing',
    question: 'If more lenders got through compliance, how many more would go live, and what would that be worth in a year?',
    skills: ['chained CTEs', 'scenario maths in SQL'],
    sql: `-- Assumptions: the next 12 months see as many signups as the last 12; lenders approved by
-- compliance go live at today's rate; a new live lender earns the average first-year revenue of
-- lenders who went live in the last two years. Uplift: +{{uplift}} percentage points at compliance.
WITH last_year AS (
  SELECT COUNT(*) AS signups,
         SUM(first_sandbox_call_at IS NOT NULL) AS sandbox,
         SUM(kyc_approved_at IS NOT NULL) AS approved,
         SUM(first_live_call_at IS NOT NULL) AS live
  FROM customer_stages
  WHERE signup_date > date((SELECT value FROM meta WHERE key = 'as_of'), '-12 months')
), all_time AS (
  SELECT 1.0 * SUM(kyc_approved_at IS NOT NULL) / SUM(first_sandbox_call_at IS NOT NULL) AS compliance_rate,
         1.0 * SUM(first_live_call_at IS NOT NULL) / SUM(kyc_approved_at IS NOT NULL) AS approved_to_live_rate
  FROM customer_stages
  WHERE signup_date BETWEEN (SELECT value FROM meta WHERE key = 'history_from')
                        AND date((SELECT value FROM meta WHERE key = 'as_of'), '-90 days')
), first_year AS (
  -- Average revenue in a new lender's first 12 live months, scaled up for lenders with fewer months so far.
  SELECT AVG(revenue_12m) AS revenue_per_new_lender
  FROM (
    SELECT cm.customer_id, 12.0 * AVG(cm.revenue_ngn) AS revenue_12m
    FROM customer_months cm
    JOIN customer_stages s ON s.customer_id = cm.customer_id
    WHERE s.signup_date >= (SELECT value FROM meta WHERE key = 'history_from')
      AND cm.month <= strftime('%Y-%m', s.first_live_call_at, '+11 months')
    GROUP BY cm.customer_id
    HAVING COUNT(*) >= 3
  )
)
SELECT ly.signups AS signups_last_12_months,
       ly.sandbox AS reached_sandbox,
       ROUND(100 * a.compliance_rate, 1) AS compliance_rate_pct,
       ROUND(100 * a.compliance_rate + {{uplift}}, 1) AS compliance_rate_with_uplift_pct,
       ROUND(100 * a.approved_to_live_rate, 1) AS approved_to_live_pct,
       ROUND(ly.sandbox * ({{uplift}} / 100.0) * a.approved_to_live_rate, 1) AS extra_live_lenders_per_year,
       ROUND(f.revenue_per_new_lender) AS first_year_revenue_per_lender_ngn,
       ROUND(ly.sandbox * ({{uplift}} / 100.0) * a.approved_to_live_rate * f.revenue_per_new_lender) AS extra_revenue_first_year_ngn
FROM last_year ly, all_time a, first_year f;`,
  });

  add({
    id: 'insights_experiment_baseline', view: 'insights', title: 'Experiment baseline',
    question: 'What is the current compliance approval rate, and how many lenders a month could take part in a test?',
    skills: ['rates over time', 'baseline for sample size'],
    sql: `-- Baseline for the experiment: share of lenders approved by compliance within 45 days
-- of their first sandbox call, and how many lenders reach the sandbox each month.
WITH eligible AS (
  SELECT s.*
  FROM customer_stages s
  WHERE s.first_sandbox_call_at IS NOT NULL
    AND date(s.first_sandbox_call_at) <= date((SELECT value FROM meta WHERE key = 'as_of'), '-45 days')
    AND s.signup_date >= (SELECT value FROM meta WHERE key = 'history_from')
)
SELECT COUNT(*) AS lenders_observed,
       ROUND(100.0 * SUM(kyc_approved_at IS NOT NULL
                         AND julianday(kyc_approved_at) - julianday(first_sandbox_call_at) <= 45) / COUNT(*), 1) AS approved_within_45_days_pct,
       (SELECT ROUND(COUNT(*) / 6.0, 1) FROM customer_stages
         WHERE first_sandbox_call_at > date((SELECT value FROM meta WHERE key = 'as_of'), '-6 months')) AS new_sandbox_lenders_per_month
FROM eligible;`,
  });

  /* ===== Extra examples for the SQL workspace ===== */
  add({
    id: 'example_running_revenue', view: 'examples', title: 'Running total of revenue',
    question: 'How much revenue have we earned so far this period, month by month?',
    skills: ['SUM OVER', 'running total'],
    sql: `SELECT month,
       ROUND(SUM(revenue_ngn)) AS revenue_ngn,
       ROUND(SUM(SUM(revenue_ngn)) OVER (ORDER BY month)) AS running_total_ngn
FROM customer_months
WHERE month BETWEEN '{{from_month}}' AND '{{to_month}}'
GROUP BY month
ORDER BY month;`,
  });

  add({
    id: 'example_endpoint_mom', view: 'examples', title: 'Month-on-month change per endpoint',
    question: 'Which endpoints grew or shrank compared with the month before?',
    skills: ['LAG with PARTITION BY'],
    sql: `WITH monthly AS (
  SELECT e.name AS endpoint, u.month, SUM(u.successful) AS live_calls
  FROM usage_priced u JOIN endpoints e ON e.id = u.endpoint_id
  GROUP BY e.id, u.month
)
SELECT endpoint, month, live_calls,
       LAG(live_calls) OVER (PARTITION BY endpoint ORDER BY month) AS previous_month,
       ROUND(100.0 * (live_calls - LAG(live_calls) OVER (PARTITION BY endpoint ORDER BY month))
             / LAG(live_calls) OVER (PARTITION BY endpoint ORDER BY month), 1) AS change_pct
FROM monthly
WHERE month = '{{to_month}}'
ORDER BY change_pct DESC;`,
  });

  add({
    id: 'example_top_per_region', view: 'examples', title: 'Biggest customer in each region',
    question: 'Who is our largest customer in each region?',
    skills: ['ROW_NUMBER with PARTITION BY', 'top N per group'],
    sql: `WITH ranked AS (
  SELECT c.region, c.name, ROUND(SUM(cm.revenue_ngn)) AS revenue_ngn,
         ROW_NUMBER() OVER (PARTITION BY c.region ORDER BY SUM(cm.revenue_ngn) DESC) AS rn
  FROM customer_months cm JOIN customers c ON c.id = cm.customer_id
  WHERE cm.month BETWEEN '{{from_month}}' AND '{{to_month}}'
  GROUP BY c.region, c.id
)
SELECT region, name, revenue_ngn FROM ranked WHERE rn = 1 ORDER BY revenue_ngn DESC;`,
  });

  add({
    id: 'example_ticket_speed', view: 'examples', title: 'How fast we solve tickets',
    question: 'How long does it take to solve each kind of support ticket?',
    skills: ['median per group', 'date difference'],
    sql: `WITH solved AS (
  SELECT category, (julianday(resolved_at) - julianday(opened_at)) * 24 AS hours,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY (julianday(resolved_at) - julianday(opened_at))) AS rn,
         COUNT(*) OVER (PARTITION BY category) AS n
  FROM support_tickets WHERE status = 'solved'
)
SELECT category, MAX(n) AS tickets, ROUND(AVG(hours), 1) AS median_hours_to_solve
FROM solved WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY category ORDER BY median_hours_to_solve DESC;`,
  });

  /* ---------- rendering ---------- */
  const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m, 0)); return d.toISOString().slice(0, 10); };
  const validMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '') && s >= DATA_FIRST_MONTH && s <= DATA_LAST_MONTH;
  const sqlString = (s) => "'" + String(s).replace(/'/g, "''") + "'";

  // Keep only values we know, so nothing from a URL can change the shape of a query.
  function clean(params) {
    const p = Object.assign({}, DEFAULTS, params || {});
    const out = { from_month: validMonth(p.from_month) ? p.from_month : DEFAULTS.from_month, to_month: validMonth(p.to_month) ? p.to_month : DEFAULTS.to_month };
    if (out.from_month > out.to_month) [out.from_month, out.to_month] = [out.to_month, out.from_month];
    for (const k of Object.keys(ALLOWED)) out[k] = ALLOWED[k].includes(p[k]) ? p[k] : '';
    const id = parseInt(p.customer, 10); out.customer = id >= 1 && id <= 9999 ? id : DEFAULTS.customer;
    const up = Number(p.uplift); out.uplift = up >= 1 && up <= 50 ? Math.round(up) : DEFAULTS.uplift;
    const st = parseInt(p.stage, 10); out.stage = st >= 2 && st <= 7 ? st : DEFAULTS.stage;
    return out;
  }

  function segLines(alias, p) {
    return SEGMENT_KEYS.filter((k) => p[k]).map((k) => alias + '.' + k + ' = ' + sqlString(p[k]));
  }

  function render(idOrQuery, params) {
    const q = typeof idOrQuery === 'string' ? byId(idOrQuery) : idOrQuery;
    if (!q) throw new Error('Unknown query: ' + idOrQuery);
    const p = clean(params);
    const lines = q.sql.split('\n').map((line) => {
      const indent = (line.match(/^\s*/) || [''])[0];
      return line
        .replace(/\{\{where-seg (\w+)\}\}/g, (_, a) => { const s = segLines(a, p); return s.length ? 'WHERE ' + s.join('\n' + indent + '  AND ') : ''; })
        .replace(/\{\{seg (\w+)\}\}/g, (_, a) => segLines(a, p).map((s) => '\n' + indent + '  AND ' + s).join(''))
        .replace(/\{\{ep (\w+)\}\}/g, (_, a) => p.endpoint ? '\n' + indent + '  AND ' + a + '.endpoint_id = ' + ENDPOINT_IDS[p.endpoint][0] + '  -- ' + ENDPOINT_IDS[p.endpoint][1] : '');
    });
    return lines.filter((l) => l.trim() !== '').join('\n')
      .replace(/\{\{from\}\}/g, p.from_month + '-01')
      .replace(/\{\{to\}\}/g, lastDay(p.to_month))
      .replace(/\{\{from_month\}\}/g, p.from_month)
      .replace(/\{\{to_month\}\}/g, p.to_month)
      .replace(/\{\{customer\}\}/g, String(p.customer))
      .replace(/\{\{uplift\}\}/g, String(p.uplift))
      .replace(/\{\{stage\}\}/g, String(p.stage));
  }

  function byId(id) { return Q.find((q) => q.id === id); }

  const VIEW_LABELS = { overview: 'Overview', activation: 'Activation', accounts: 'Accounts to act on', customer: 'Customer 360', usage: 'Usage and spend', health: 'Integration health', integrity: 'Data checks', insights: 'Insights', examples: 'More examples' };

  const api = { list: Q, byId, render, clean, DEFAULTS, ALLOWED, VIEW_LABELS, ENDPOINT_IDS, DATA_FIRST_MONTH, DATA_LAST_MONTH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SignalQueries = api;
})(typeof self !== 'undefined' ? self : this);
