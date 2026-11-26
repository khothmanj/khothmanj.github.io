# Signal data dictionary

Signal runs on a small SQLite database for **Ferrow**, a fictional company that sells lending APIs to lenders in Nigeria. Ferrow, its customers, staff and every number here are invented sample data for a portfolio prototype.

| | |
|---|---|
| File | `signal.sqlite.gz` (about 2.2 MB compressed, 7.9 MB unpacked) |
| History | 1 Nov 2024 to 31 Oct 2026 (24 full months) |
| As of | 31 Oct 2026, refreshed 1 Nov 2026 06:00 (stored in `meta`) |
| Currency | Nigerian naira (NGN) |
| Customers | 180 lenders, 98 with live traffic in the period, 5 cancelled |
| Daily usage rows | about 212,000 |

## How it is made

`generate.js` builds the whole database from a fixed seed (`20261101`), so every run gives a byte-identical file and every screenshot shows the same numbers. Each part of the data (customers, each customer's onboarding, each customer's usage, billing, tickets) has its own random stream, so changing one part does not reshuffle the rest.

```bash
node fintech-analytics/data/generate.js          # writes signal.sqlite.gz
node fintech-analytics/data/generate.js --keep   # also keeps signal.sqlite and signal.sql for inspection
```

It needs Node 18 or later and the `sqlite3` command line tool (built into macOS). No npm packages. `schema.sql` holds the table definitions. `stories.sql` checks every planted story (see `STORIES.md`).

The generator models a real business rather than drawing random numbers:
- **Customers** sign up at a growing rate (32 were already live before the window, 148 sign up during it). Size decides plan and volume, and bigger lenders use more endpoints.
- **Onboarding** moves each lender through the seven stages with a chance of stalling at each one. Compliance runs in rounds: each round is approved, rejected or sent back for documents, and lenders sometimes give up.
- **Usage** is driven by loan applications per day, scaled by season, day of week, Eid, payday (for collections), organic growth, ramp-up after going live and each customer's story (decline, growth, churn). Each endpoint's calls are a ratio of applications.
- **Errors** follow a base rate per endpoint, split by type, raised for new integrations, partner aggregators, the North region and the bureau outage.
- **Billing** charges successful live calls at the price in force that day, plus the plan's monthly fee. The ledger copies invoices, apart from the planted problems.

Days with no calls have no row. Sandbox traffic is recorded for BVN, credit bureau and mandate calls only, to keep the file small.

## Conventions

- Days are text `YYYY-MM-DD`, timestamps `YYYY-MM-DD HH:MM` (UTC), months `YYYY-MM`. They sort correctly and work with SQLite's `date()`, `julianday()` and `strftime()`.
- Codes are lower case with underscores (`microfinance_bank`, `partner_aggregator`). The app turns them into labels.
- "Days stuck" and similar ages are measured against `meta.as_of`, never the real clock.

## Tables

### `meta`
Facts about the dataset.

| Column | Type | Meaning |
|---|---|---|
| key | text | `as_of`, `refreshed_at`, `currency`, `seed`, `history_from`, `note` |
| value | text | The value |

### `customers`
One row per lender that ever signed up.

| Column | Type | Meaning |
|---|---|---|
| id | integer | Customer id |
| name | text | Invented compound name, for example "Saffronfield Microfinance Bank" |
| lender_type | text | `digital_lender`, `microfinance_bank`, `cooperative` or `bnpl` |
| size_band | text | `small`, `mid` or `large`, by loan volume |
| region | text | Lagos, FCT, South-South, South-West, North or South-East |
| plan | text | `starter`, `growth` or `enterprise` (see `plans`) |
| integration_pattern | text | `direct_api`, `sdk` or `partner_aggregator` (connects through a third-party platform) |
| signup_date | text | Day the account was created |
| cancelled_date | text | Day the customer cancelled, NULL if still a customer |
| account_manager | text | Named manager for Growth and Enterprise, "Self-serve" for Starter |

### `plans`

| Column | Type | Meaning |
|---|---|---|
| plan | text | `starter`, `growth`, `enterprise` |
| name | text | Display name |
| monthly_fee_ngn | real | Platform fee for each month the customer is live: 0, 150,000 or 750,000 |

### `onboarding_events`
One row per customer per stage reached. A missing stage means the customer has not reached it (yet).

| Column | Type | Meaning |
|---|---|---|
| customer_id | integer | Customer |
| stage | text | See the stages below |
| stage_order | integer | 1 to 7 |
| occurred_at | text | When the stage was reached |

| Order | Stage | Reached when |
|---|---|---|
| 1 | `signed_up` | Account created |
| 2 | `sandbox_keys_issued` | Test keys issued (usually within hours) |
| 3 | `first_sandbox_call` | First test API call |
| 4 | `kyc_approved` | Compliance approved the lender's licence and KYC documents |
| 5 | `production_keys_issued` | Live keys issued |
| 6 | `first_live_call` | First *successful* live call |
| 7 | `reached_1000_live_calls` | 1,000 successful live calls in total |

### `compliance_reviews`
One row per compliance submission.

| Column | Type | Meaning |
|---|---|---|
| customer_id | integer | Customer |
| round | integer | 1 for the first submission, 2 for the first resubmission, and so on |
| submitted_at | text | When the lender submitted |
| decided_at | text | When compliance decided, NULL while pending |
| outcome | text | `approved`, `info_requested` (sent back), `rejected` or `pending` |
| reason | text | Why documents were requested or the application rejected |

A lender whose latest round is `info_requested` and who has no later round is waiting to resubmit, or has given up.

### `endpoints`

| id | code | name | category | billable |
|---|---|---|---|---|
| 1 | bvn | BVN verification | Identity | yes |
| 2 | nin | NIN verification | Identity | yes |
| 3 | bureau | Credit bureau report | Credit | yes |
| 4 | statement | Bank statement analysis (launched 2 Jun 2025) | Credit | yes |
| 5 | mandate | Direct debit mandate | Payments | yes |
| 6 | disbursement | Disbursement | Payments | yes |
| 7 | collection | Repayment collection | Payments | yes |
| 8 | webhook | Webhook delivery (Ferrow calling the lender) | Platform | no |

`launched_on` holds each launch date.

### `endpoint_prices`
Price history. A call is charged at the price whose window contains its day.

| Column | Type | Meaning |
|---|---|---|
| endpoint_id | integer | Endpoint |
| price_ngn | real | Price per successful live call |
| valid_from | text | First day of this price |
| valid_to | text | First day it no longer applies, NULL for the current price |

Prices: BVN 35 then 30, NIN 50, credit bureau 350 then 420 (both changes on 1 Sep 2025), bank statement 250, mandate 100, disbursement 45, collection 40, webhook 0.

```sql
-- Revenue from usage, priced on the day of each call
SELECT SUM(u.successful * p.price_ngn)
FROM api_usage_daily u
JOIN endpoint_prices p
  ON p.endpoint_id = u.endpoint_id
 AND u.day >= p.valid_from AND (p.valid_to IS NULL OR u.day < p.valid_to)
WHERE u.env = 'live';
```

### `api_usage_daily`
Daily totals per customer, endpoint and environment. This holds most of the data.

| Column | Type | Meaning |
|---|---|---|
| day | text | Day |
| customer_id | integer | Customer |
| endpoint_id | integer | Endpoint |
| env | text | `sandbox` (testing) or `live` (production) |
| calls | integer | All requests |
| successful | integer | Requests that succeeded: calls minus all four error columns |
| err_timeout | integer | Timed out |
| err_4xx | integer | Rejected because the lender's request was wrong (keys, format, missing fields) |
| err_5xx | integer | Ferrow's own failures |
| err_upstream | integer | A provider behind Ferrow (bureau, bank, identity service) failed |
| p95_ms | integer | 95th percentile response time that day, in milliseconds |

The primary key is `(customer_id, endpoint_id, env, day)`, because storing each customer's history together compresses better.

### `invoices`

| Column | Type | Meaning |
|---|---|---|
| id | integer | Invoice id |
| invoice_number | text | For example `INV-202603-00412` |
| customer_id | integer | Customer |
| month | text | Month billed |
| amount_ngn | real | Platform fee plus metered usage |
| issued_at | text | Issued shortly after midnight on the 1st of the next month |

### `ledger`
What Finance recorded. Each row should match one invoice exactly.

| Column | Type | Meaning |
|---|---|---|
| id | integer | Entry id |
| customer_id | integer | Customer |
| month | text | Month the revenue belongs to |
| amount_ngn | real | Amount recorded |
| posted_at | text | When it was posted |
| reference | text | The invoice number it was posted from |

### `recon_cases`
Workflow state for reconciliation problems someone is already handling. The mismatches themselves are found by SQL. This table only adds who owns each one and where it stands.

| Column | Type | Meaning |
|---|---|---|
| id | integer | Case id |
| customer_id | integer | Customer |
| month | text | Month affected |
| check_name | text | `invoice_without_ledger`, `duplicate_invoice`, `amount_mismatch` or `billed_after_cancellation` |
| status | text | `open`, `investigating` or `resolved` |
| owner | text | Team responsible |
| note | text | What happened |
| opened_at | text | When the case was opened |

### `support_tickets`

| Column | Type | Meaning |
|---|---|---|
| id | integer | Ticket id |
| customer_id | integer | Customer |
| opened_at | text | When it was opened |
| category | text | `integration`, `api_errors`, `billing`, `compliance`, `account` or `feature_request` |
| subject | text | Short subject line |
| status | text | `open`, `pending` or `solved` |
| resolved_at | text | When it was solved, NULL otherwise |

### `events`
Product and market events, used as annotations on time-series charts.

| Column | Type | Meaning |
|---|---|---|
| day | text | Day |
| kind | text | `release`, `pricing`, `incident`, `ops` or `season` |
| title | text | Short label for the chart |
| detail | text | One-sentence explanation |

| Day | Kind | Title |
|---|---|---|
| 2025-06-02 | release | Bank statement analysis launched |
| 2025-07-01 | release | Integration docs rewritten |
| 2025-09-01 | pricing | New pricing |
| 2025-11-20 | season | Festive lending season |
| 2026-08-03 | ops | Compliance review backlog |
| 2026-08-10 | incident | Credit bureau provider outage |

## Shared definitions (views)

Metrics are defined once, as SQL views in `schema.sql`, and every chart in Signal builds on them. That is how "revenue" or "active customer" means the same thing on every screen.

| View | What it gives you |
|---|---|
| `months` | Every month in the data, with its first and last day (built with a recursive CTE) |
| `usage_priced` | Live usage only, with `errors` and `revenue_ngn` (successful calls at the price in force that day) |
| `customer_months` | One row per customer per month from their first live call until they cancel: `live_calls`, `errors`, `usage_revenue_ngn`, `platform_fee_ngn`, `revenue_ngn` and `is_active` (100 or more successful live calls) |
| `customer_stages` | One row per customer with the time each onboarding stage was reached, and `furthest_stage` |

`customer_months.revenue_ngn` matches the `invoices` table for every customer and month, except the planted billing errors, and the tests check this.

## Limits

- 180 customers and about 8 signups a month is a small base, so monthly percentages swing. Signal shows counts next to rates.
- The data is daily totals, not individual API calls, so p95 latency is a daily figure per customer and endpoint. Averaging p95 values is an approximation, and Signal labels it that way.
- Customer names are invented compounds ("Saffronfield", "Kestrelbrook") chosen so they should not match real lenders. Any resemblance is accidental.
