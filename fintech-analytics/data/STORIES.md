# Planted stories

These are the patterns built into the sample data on purpose, so Signal has real findings to surface. The figures below come from running `stories.sql` against the generated database. They are sample data, not results from any real company.

To check them yourself:

```bash
node fintech-analytics/data/generate.js --keep
sqlite3 -header -column fintech-analytics/data/signal.sqlite < fintech-analytics/data/stories.sql
```

| # | Story | What the data shows | Where Signal shows it |
|---|---|---|---|
| 1 | Most lenders get stuck at compliance, not at signup | Of 123 signups (Nov 2024 to Jul 2026), 102 make a sandbox call but only 69 get compliance approval: **67.6%**, the lowest conversion in the funnel. Every other step converts at 85% or more. | Activation funnel, Insights |
| 1b | Compliance is also the slowest step | Median **32 days** from first sandbox call to approval. Every other step up to the first live call takes 5 days or less. | Activation funnel (median time per stage) |
| 1c | Most compliance rework is missing paperwork | Of 87 requests for more information, **78%** were for documents a checklist could catch: operating licence (33%), data protection policy (23%), directors' ID (22%). | Insights (problem and opportunity sizing) |
| 2 | The docs rewrite on 1 Jul 2025 lifted activation | Lenders live within 90 days of signup: **38.9%** before (36 signups) and **51.7%** after (87 signups). | Cohort heatmap with an annotation, Activation |
| 3 | A group signed up and never went live, each for a reason | 77 accounts at least 14 days old with no live call: no sandbox calls (22), compliance asked for documents (16), sandbox only (14), waiting on our compliance review (11), live keys but failing calls (10), rejected (4). | Accounts to act on |
| 4 | Twelve live customers are fading | 12 accounts are down **44% to 67%** from July to October 2026. The next-worst live account is *up* 2%. Several raised pricing or timeout tickets before the drop. | Accounts to act on, Customer 360 |
| 5 | Credit bureau provider outage | 10 to 16 Aug 2026. Credit bureau errors go from about 1.3% to **23.4%** at the peak (12 Aug), almost all upstream, and p95 latency triples. Support tickets about bureau failures follow. | Integration health (annotated), Overview insight |
| 6 | Partner aggregator integrations are less reliable | Timeouts at **1.82%** against 0.58% for direct API and 0.65% for SDK (last 90 days). | Integration health |
| 6b | The North is slower | Average p95 for BVN checks is **901 ms** in the North against 630 to 684 ms elsewhere. | Integration health |
| 7 | Invoices and the ledger disagree in four ways | Missing ledger entry (customer 3, Jul 2026, NGN 3.65m, open). Duplicated invoice (customer 1, Mar 2026, resolved). Rounding drift under NGN 1,000 (customer 10, Dec 2025 to Feb 2026, investigating). Billed after cancelling on 20 May 2026 (customer 31, Jun and Jul 2026, open). No other mismatches. | Data checks |
| 8 | Demand is seasonal | Live calls jump about 26% in December, then drop about 25% in January. September (school fees) and the two weeks before each Eid also rise. Weekends are quiet. Collections spike on the 25th to 28th (payday). | Usage and spend |
| 9 | A few customers drive most revenue | The top 10 of 104 paying customers make up **59.9%** of usage revenue in the last 12 months. | Usage and spend (concentration) |
| 10 | Two product events change the curves | Bank statement analysis launches 2 Jun 2025 and grows to about 74,000 calls a month by October. On 1 Sep 2025, bureau revenue steps up about 36% in a month as the price rises from NGN 350 to NGN 420. Starter plans pull fewer bureau reports per BVN check after the change (0.41 down to 0.35). | Usage and spend (annotated) |
| 11 | Too few signups for a quick A/B test | About **8 signups a month**. The Insights page uses this to show an honest sample size and duration, and proposes a staged rollout with a holdout group instead. | Insights (experiment design) |
| 12 | A compliance backlog from August 2026 | One reviewer left on 3 Aug 2026. Decisions now take about a month, and **14** lenders are waiting, the longest for 28 days. | Accounts to act on, Overview insight, Insights |

## Supporting patterns

These are not headline stories, but they make the data feel real:
- New integrations make more 4xx errors in their first 30 days live.
- Usage ramps up over the first weeks after going live.
- Five customers cancel during the period, with usage tapering in the month before.
- Six mid and large customers grow about 9% a month from May 2026 (the fastest-growing list).
- Large customers and aggregator customers raise more support tickets.
- Recent cohorts have not had time to finish onboarding, so their figures are incomplete. Signal marks these cohorts as still maturing rather than as failures.
