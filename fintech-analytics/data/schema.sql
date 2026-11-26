-- Signal: Ferrow product analytics database (SQLite).
-- Sample data for a portfolio prototype. Ferrow and every customer are fictional.
-- Dates are ISO text: days as 'YYYY-MM-DD', timestamps as 'YYYY-MM-DD HH:MM' (UTC), months as 'YYYY-MM'.
-- Money is in Nigerian naira (NGN).

PRAGMA foreign_keys = ON;
PRAGMA page_size = 4096;

-- Facts about the dataset itself, for example the "as of" date that "days stuck" is measured against.
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE plans (
  plan            TEXT PRIMARY KEY,           -- starter, growth, enterprise
  name            TEXT NOT NULL,
  monthly_fee_ngn REAL NOT NULL               -- platform fee charged every month a customer is live
);

CREATE TABLE customers (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  lender_type         TEXT NOT NULL CHECK (lender_type IN ('digital_lender','microfinance_bank','cooperative','bnpl')),
  size_band           TEXT NOT NULL CHECK (size_band IN ('small','mid','large')),
  region              TEXT NOT NULL,
  plan                TEXT NOT NULL REFERENCES plans(plan),
  integration_pattern TEXT NOT NULL CHECK (integration_pattern IN ('direct_api','sdk','partner_aggregator')),
  signup_date         TEXT NOT NULL,
  cancelled_date      TEXT,                   -- NULL while the customer is still a customer
  account_manager     TEXT NOT NULL           -- 'Self-serve' for Starter plans
);

CREATE TABLE onboarding_events (
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  stage       TEXT NOT NULL CHECK (stage IN ('signed_up','sandbox_keys_issued','first_sandbox_call','kyc_approved','production_keys_issued','first_live_call','reached_1000_live_calls')),
  stage_order INTEGER NOT NULL CHECK (stage_order BETWEEN 1 AND 7),
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (customer_id, stage)
) WITHOUT ROWID;

-- One row per compliance submission. 'info_requested' sends the lender back to resubmit.
CREATE TABLE compliance_reviews (
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  round        INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  decided_at   TEXT,                          -- NULL while the review is still pending
  outcome      TEXT NOT NULL CHECK (outcome IN ('approved','info_requested','rejected','pending')),
  reason       TEXT,                          -- why information was requested or the application rejected
  PRIMARY KEY (customer_id, round)
) WITHOUT ROWID;

CREATE TABLE endpoints (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  launched_on TEXT NOT NULL,
  billable    INTEGER NOT NULL CHECK (billable IN (0,1))
);

-- Price history. A call is charged at the price whose window contains its day.
CREATE TABLE endpoint_prices (
  endpoint_id INTEGER NOT NULL REFERENCES endpoints(id),
  price_ngn   REAL NOT NULL,
  valid_from  TEXT NOT NULL,
  valid_to    TEXT,                           -- exclusive; NULL for the current price
  PRIMARY KEY (endpoint_id, valid_from)
) WITHOUT ROWID;

-- Daily totals per customer, endpoint and environment. Days with no calls have no row.
CREATE TABLE api_usage_daily (
  day          TEXT NOT NULL,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  endpoint_id  INTEGER NOT NULL REFERENCES endpoints(id),
  env          TEXT NOT NULL CHECK (env IN ('sandbox','live')),
  calls        INTEGER NOT NULL,
  successful   INTEGER NOT NULL,              -- calls minus all errors
  err_timeout  INTEGER NOT NULL,
  err_4xx      INTEGER NOT NULL,              -- the lender's request was wrong (keys, format, missing fields)
  err_5xx      INTEGER NOT NULL,              -- Ferrow's own failures
  err_upstream INTEGER NOT NULL,              -- a provider behind Ferrow was down (bureau, bank, identity service)
  p95_ms       INTEGER NOT NULL,              -- 95th percentile response time that day
  PRIMARY KEY (customer_id, endpoint_id, env, day)   -- stored per customer and endpoint, which compresses better
) WITHOUT ROWID;

CREATE TABLE invoices (
  id             INTEGER PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id),
  month          TEXT NOT NULL,               -- the month being billed
  amount_ngn     REAL NOT NULL,
  issued_at      TEXT NOT NULL
);

-- What Finance recorded. Should match invoices one for one.
CREATE TABLE ledger (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  month       TEXT NOT NULL,
  amount_ngn  REAL NOT NULL,
  posted_at   TEXT NOT NULL,
  reference   TEXT NOT NULL                   -- the invoice number it was posted from
);

-- Workflow state for reconciliation issues someone is already handling.
CREATE TABLE recon_cases (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  month       TEXT NOT NULL,
  check_name  TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('open','investigating','resolved')),
  owner       TEXT NOT NULL,
  note        TEXT NOT NULL,
  opened_at   TEXT NOT NULL
);

CREATE TABLE support_tickets (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  opened_at   TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('integration','api_errors','billing','compliance','account','feature_request')),
  subject     TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('open','pending','solved')),
  resolved_at TEXT
);

-- Product events shown as annotations on time-series charts.
CREATE TABLE events (
  day    TEXT NOT NULL,
  kind   TEXT NOT NULL CHECK (kind IN ('release','pricing','incident','ops','season')),
  title  TEXT NOT NULL,
  detail TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Shared definitions. Every chart in Signal builds on these views, so a metric
-- such as "revenue" or "active customer" means the same thing everywhere.
-- ---------------------------------------------------------------------------

-- Every month in the dataset, with its first and last day.
CREATE VIEW months AS
WITH RECURSIVE m(month) AS (
  SELECT substr((SELECT value FROM meta WHERE key = 'history_from'), 1, 7)
  UNION ALL
  SELECT strftime('%Y-%m', month || '-01', '+1 month') FROM m
  WHERE month < substr((SELECT value FROM meta WHERE key = 'as_of'), 1, 7)
)
SELECT month,
       month || '-01' AS first_day,
       date(month || '-01', '+1 month', '-1 day') AS last_day
FROM m;

-- Live usage, with each successful call charged at the price in force that day.
CREATE VIEW usage_priced AS
SELECT u.day,
       substr(u.day, 1, 7) AS month,
       u.customer_id,
       u.endpoint_id,
       u.calls,
       u.successful,
       u.calls - u.successful AS errors,
       u.err_timeout, u.err_4xx, u.err_5xx, u.err_upstream,
       u.p95_ms,
       u.successful * p.price_ngn AS revenue_ngn
FROM api_usage_daily u
JOIN endpoint_prices p
  ON p.endpoint_id = u.endpoint_id
 AND u.day >= p.valid_from
 AND (p.valid_to IS NULL OR u.day < p.valid_to)
WHERE u.env = 'live';

-- One row per customer per month from their first live call until they cancel.
-- Revenue = platform fee + metered usage. Active = at least 100 successful live calls.
CREATE VIEW customer_months AS
WITH first_live AS (
  SELECT customer_id, date(occurred_at) AS live_day
  FROM onboarding_events WHERE stage = 'first_live_call'
), monthly_usage AS (
  SELECT customer_id, month,
         SUM(successful) AS live_calls,
         SUM(errors) AS errors,
         SUM(revenue_ngn) AS usage_revenue_ngn
  FROM usage_priced
  GROUP BY customer_id, month
)
SELECT c.id AS customer_id,
       m.month,
       COALESCE(u.live_calls, 0) AS live_calls,
       COALESCE(u.errors, 0) AS errors,
       COALESCE(u.usage_revenue_ngn, 0) AS usage_revenue_ngn,
       p.monthly_fee_ngn AS platform_fee_ngn,
       COALESCE(u.usage_revenue_ngn, 0) + p.monthly_fee_ngn AS revenue_ngn,
       CASE WHEN COALESCE(u.live_calls, 0) >= 100 THEN 1 ELSE 0 END AS is_active
FROM customers c
JOIN first_live f ON f.customer_id = c.id
JOIN months m ON f.live_day <= m.last_day
             AND (c.cancelled_date IS NULL OR c.cancelled_date > m.first_day)
JOIN plans p ON p.plan = c.plan
LEFT JOIN monthly_usage u ON u.customer_id = c.id AND u.month = m.month;

-- One row per customer with the time each onboarding stage was reached (NULL if not yet).
CREATE VIEW customer_stages AS
SELECT c.id AS customer_id,
       c.signup_date,
       MAX(CASE WHEN e.stage = 'signed_up' THEN e.occurred_at END) AS signed_up_at,
       MAX(CASE WHEN e.stage = 'sandbox_keys_issued' THEN e.occurred_at END) AS sandbox_keys_at,
       MAX(CASE WHEN e.stage = 'first_sandbox_call' THEN e.occurred_at END) AS first_sandbox_call_at,
       MAX(CASE WHEN e.stage = 'kyc_approved' THEN e.occurred_at END) AS kyc_approved_at,
       MAX(CASE WHEN e.stage = 'production_keys_issued' THEN e.occurred_at END) AS production_keys_at,
       MAX(CASE WHEN e.stage = 'first_live_call' THEN e.occurred_at END) AS first_live_call_at,
       MAX(CASE WHEN e.stage = 'reached_1000_live_calls' THEN e.occurred_at END) AS reached_1000_at,
       MAX(e.stage_order) AS furthest_stage
FROM customers c
LEFT JOIN onboarding_events e ON e.customer_id = c.id
GROUP BY c.id, c.signup_date;
