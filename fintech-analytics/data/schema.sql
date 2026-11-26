-- Signal: Lendwell product analytics database (SQLite).
-- Sample data for a portfolio prototype. Lendwell and every customer are fictional.
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
  err_5xx      INTEGER NOT NULL,              -- Lendwell's own failures
  err_upstream INTEGER NOT NULL,              -- a provider behind Lendwell was down (bureau, bank, identity service)
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
