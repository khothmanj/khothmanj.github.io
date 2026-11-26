-- Checks for every planted story in the Signal sample data.
-- Run:  gunzip -k signal.sqlite.gz && sqlite3 -header -column signal.sqlite < stories.sql
-- (or `node generate.js --keep`, which also leaves signal.sqlite next to this file)

.print '1. Compliance is the biggest drop-off (signups Nov 2024 to Jul 2026, so every one had 90 days)'
WITH cohort AS (
  SELECT id FROM customers WHERE signup_date BETWEEN '2024-11-01' AND '2026-07-31'
), reached AS (
  SELECT e.stage_order, e.stage, COUNT(*) AS customers
  FROM onboarding_events e JOIN cohort c ON c.id = e.customer_id
  GROUP BY e.stage_order, e.stage
)
SELECT stage, customers,
       ROUND(100.0 * customers / LAG(customers) OVER (ORDER BY stage_order), 1) AS pct_from_previous
FROM reached ORDER BY stage_order;

.print '1b. Compliance is also the slowest step (median days from the previous stage)'
WITH gaps AS (
  SELECT e.stage, e.stage_order,
         julianday(e.occurred_at) - julianday(LAG(e.occurred_at) OVER (PARTITION BY e.customer_id ORDER BY e.stage_order)) AS days
  FROM onboarding_events e JOIN customers c ON c.id = e.customer_id
  WHERE c.signup_date >= '2024-11-01'
), ranked AS (
  SELECT stage, stage_order, days,
         ROW_NUMBER() OVER (PARTITION BY stage ORDER BY days) AS rn,
         COUNT(*) OVER (PARTITION BY stage) AS n
  FROM gaps WHERE days IS NOT NULL
)
SELECT stage, ROUND(AVG(days), 1) AS median_days
FROM ranked WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY stage, stage_order ORDER BY stage_order;

.print '1c. Why compliance sends lenders back'
SELECT reason, COUNT(*) AS requests, ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM compliance_reviews WHERE outcome = 'info_requested'
GROUP BY reason ORDER BY requests DESC;

.print '2. Cohorts after the docs rewrite (1 Jul 2025) activate better: live within 90 days of signup'
SELECT CASE WHEN c.signup_date < '2025-07-01' THEN 'Before docs rewrite' ELSE 'After docs rewrite' END AS cohort,
       COUNT(*) AS signups,
       ROUND(100.0 * SUM(EXISTS (
         SELECT 1 FROM onboarding_events e
         WHERE e.customer_id = c.id AND e.stage = 'first_live_call'
           AND julianday(e.occurred_at) - julianday(c.signup_date) <= 90)) / COUNT(*), 1) AS pct_live_within_90d
FROM customers c
WHERE c.signup_date BETWEEN '2024-11-01' AND '2026-07-31'
GROUP BY 1 ORDER BY 1 DESC;

.print '3. Signed up at least 14 days ago and never went live, by inferred reason'
WITH asof AS (SELECT value AS d FROM meta WHERE key = 'as_of'),
furthest AS (SELECT customer_id, MAX(stage_order) AS stage_order FROM onboarding_events GROUP BY customer_id),
latest_review AS (
  SELECT customer_id, outcome FROM compliance_reviews r
  WHERE round = (SELECT MAX(round) FROM compliance_reviews x WHERE x.customer_id = r.customer_id)
)
SELECT CASE
         WHEN f.stage_order <= 2 THEN 'No sandbox calls'
         WHEN f.stage_order = 3 AND lr.outcome IS NULL THEN 'Sandbox only, never applied for compliance'
         WHEN f.stage_order = 3 AND lr.outcome = 'pending' THEN 'Waiting on Lendwell compliance review'
         WHEN f.stage_order = 3 AND lr.outcome = 'info_requested' THEN 'Compliance asked for documents'
         WHEN f.stage_order = 3 AND lr.outcome = 'rejected' THEN 'Compliance rejected'
         WHEN f.stage_order = 5 THEN 'Production keys, live calls failing'
       END AS reason,
       COUNT(*) AS customers
FROM customers c
JOIN furthest f ON f.customer_id = c.id
LEFT JOIN latest_review lr ON lr.customer_id = c.id, asof
WHERE f.stage_order < 6 AND julianday(asof.d) - julianday(c.signup_date) >= 14
GROUP BY 1 ORDER BY customers DESC;

.print '4. Live customers whose usage fell over 3 months (Oct 2026 vs Jul 2026)'
WITH m AS (
  SELECT customer_id,
         SUM(CASE WHEN day BETWEEN '2026-07-01' AND '2026-07-31' THEN successful END) AS jul,
         SUM(CASE WHEN day BETWEEN '2026-10-01' AND '2026-10-31' THEN successful END) AS oct
  FROM api_usage_daily WHERE env = 'live' GROUP BY customer_id
)
SELECT c.id, c.name, m.jul, m.oct, ROUND(100.0 * (m.oct - m.jul) / m.jul, 1) AS pct_change
FROM m JOIN customers c ON c.id = m.customer_id
WHERE m.jul > 0 AND c.cancelled_date IS NULL
ORDER BY pct_change LIMIT 14;

.print '5. Credit bureau provider outage, 10 to 16 Aug 2026'
SELECT day, SUM(calls) AS calls,
       ROUND(100.0 * SUM(calls - successful) / SUM(calls), 1) AS error_pct,
       ROUND(100.0 * SUM(err_upstream) / SUM(calls), 1) AS upstream_pct,
       MAX(p95_ms) AS worst_p95_ms
FROM api_usage_daily
WHERE endpoint_id = (SELECT id FROM endpoints WHERE code = 'bureau') AND env = 'live'
  AND day BETWEEN '2026-08-06' AND '2026-08-20'
GROUP BY day ORDER BY day;

.print '6. Partner aggregator integrations time out about 3 times as often (last 90 days)'
SELECT c.integration_pattern,
       ROUND(100.0 * SUM(u.err_timeout) / SUM(u.calls), 2) AS timeout_pct,
       ROUND(100.0 * SUM(u.calls - u.successful) / SUM(u.calls), 2) AS error_pct
FROM api_usage_daily u JOIN customers c ON c.id = u.customer_id
WHERE u.env = 'live' AND u.day >= '2026-08-02'
GROUP BY c.integration_pattern ORDER BY timeout_pct DESC;

.print '6b. The North is the slowest region (average daily p95 for BVN verification)'
SELECT c.region, CAST(AVG(u.p95_ms) AS INTEGER) AS avg_p95_ms
FROM api_usage_daily u JOIN customers c ON c.id = u.customer_id
WHERE u.env = 'live' AND u.endpoint_id = (SELECT id FROM endpoints WHERE code = 'bvn')
GROUP BY c.region ORDER BY avg_p95_ms DESC;

.print '7. Invoices that do not match the ledger, plus invoices after cancellation'
WITH inv AS (SELECT customer_id, month, SUM(amount_ngn) AS invoiced, COUNT(*) AS invoices FROM invoices GROUP BY 1, 2),
led AS (SELECT customer_id, month, SUM(amount_ngn) AS recorded FROM ledger GROUP BY 1, 2)
SELECT i.customer_id, i.month, i.invoices, i.invoiced, COALESCE(l.recorded, 0) AS ledger,
       ROUND(i.invoiced - COALESCE(l.recorded, 0), 2) AS difference, c.cancelled_date
FROM inv i
LEFT JOIN led l USING (customer_id, month)
JOIN customers c ON c.id = i.customer_id
WHERE ABS(i.invoiced - COALESCE(l.recorded, 0)) > 0.005
   OR i.invoices > 1
   OR (c.cancelled_date IS NOT NULL AND i.month > substr(c.cancelled_date, 1, 7))
ORDER BY i.month;

.print '8. Seasonality and growth: monthly successful live calls and metered revenue'
SELECT substr(u.day, 1, 7) AS month, SUM(u.successful) AS live_calls,
       ROUND(SUM(u.successful * p.price_ngn) / 1e6, 1) AS usage_revenue_ngn_m
FROM api_usage_daily u
JOIN endpoint_prices p ON p.endpoint_id = u.endpoint_id AND u.day >= p.valid_from AND (p.valid_to IS NULL OR u.day < p.valid_to)
WHERE u.env = 'live'
GROUP BY 1 ORDER BY 1;

.print '9. Spend concentration: top 10 customers share of usage revenue, Nov 2025 to Oct 2026'
WITH rev AS (
  SELECT u.customer_id, SUM(u.successful * p.price_ngn) AS revenue
  FROM api_usage_daily u
  JOIN endpoint_prices p ON p.endpoint_id = u.endpoint_id AND u.day >= p.valid_from AND (p.valid_to IS NULL OR u.day < p.valid_to)
  WHERE u.env = 'live' AND u.day >= '2025-11-01'
  GROUP BY u.customer_id
), ranked AS (SELECT revenue, RANK() OVER (ORDER BY revenue DESC) AS rk FROM rev)
SELECT COUNT(*) AS paying_customers, ROUND(100.0 * SUM(CASE WHEN rk <= 10 THEN revenue END) / SUM(revenue), 1) AS top10_pct
FROM ranked;

.print '10. New endpoint (2 Jun 2025) and pricing change (1 Sep 2025)'
SELECT substr(u.day, 1, 7) AS month,
       SUM(CASE WHEN e.code = 'statement' THEN u.successful END) AS statement_calls,
       ROUND(SUM(CASE WHEN e.code = 'bureau' THEN u.successful * p.price_ngn END) / 1e6, 1) AS bureau_revenue_ngn_m
FROM api_usage_daily u
JOIN endpoints e ON e.id = u.endpoint_id
JOIN endpoint_prices p ON p.endpoint_id = u.endpoint_id AND u.day >= p.valid_from AND (p.valid_to IS NULL OR u.day < p.valid_to)
WHERE u.env = 'live' AND u.day BETWEEN '2025-05-01' AND '2025-10-31'
GROUP BY 1 ORDER BY 1;

.print '11. Signups per month (too few for a fast A/B test)'
SELECT ROUND(AVG(n), 1) AS avg_signups_per_month_last_6
FROM (SELECT substr(signup_date, 1, 7) AS m, COUNT(*) AS n FROM customers WHERE signup_date >= '2026-05-01' GROUP BY 1);

.print '12. Lenders waiting on the compliance backlog (from 3 Aug 2026)'
SELECT COUNT(*) AS waiting,
       MAX(ROUND(julianday((SELECT value FROM meta WHERE key = 'as_of') || ' 23:59') - julianday(submitted_at))) AS longest_wait_days
FROM compliance_reviews WHERE outcome = 'pending';
