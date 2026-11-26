# Kinhold content library

Kinhold helps a small UK business check how exposed it is to cyber attacks and fraud, and whether it uses AI tools safely. Every question, recommendation and warning sign in this folder links to public UK guidance. Kinhold is guidance, not certification, and never says a business is "compliant", "certified" or "safe".

To read it all in one place, open **[CONTENT-REVIEW.md](CONTENT-REVIEW.md)**, which is generated from the JSON.

## Files

| File | What it holds |
|---|---|
| `sources.json` | Every source, its URL, the date it was checked, and the specific points Kinhold relies on (`claims`). |
| `questions.json` | The answer scale, the 7 profile questions that adapt the check, 14 areas and 43 questions. Each question has a plain explanation (`help`), `why` it matters, a realistic `example`, a `weight` from 1 to 3, its `sources`, and the `recommendation` it unlocks. `onlyFor` and `notFor` hide questions that don't apply. |
| `recommendations.json` | One recommendation per question: what to do, why, minutes, cost, effort (1 to 3), owner, steps, sources, whether it's a quick win, and a toolkit template where one helps. |
| `benchmarks.json` | Figures for "what a business like yours usually has", quoted exactly from the Cyber Security Breaches Survey 2025/2026, with the question each relates to. |
| `messages.json` | The message checker's 7 warning signs, the levels, the wording when nothing is found, and 8 example messages with the signs each should trigger. |
| `training.json` | 4 staff modules of about 3 minutes, each with an activity and a 3-question quiz. |

## Rules for anyone editing

- **Sources first.** Never add a question, recommendation, statistic or quote without opening the source and adding what it says to `claims`. If a page can't be checked, leave it out.
- **Dates.** Update `checked` when you re-read a source. ICO guidance is under review after the Data (Use and Access) Act 2025, and NCSC moves pages, so recheck before each release.
- **Reporting.** Use Report Fraud (reportfraud.police.uk, 0300 123 2040), which replaced Action Fraud in December 2025.
- **Words.** UK English, plain language, no em dashes, no "compliant", "certified" or "safe". Explain every technical term in one line.
- **Examples are fictional.** Phone numbers use Ofcom's drama range (07700 900xxx). Sort codes start with 00, so they don't belong to real accounts.

## Checks

```bash
node sme-readiness/tests/validate-content.js          # structure, references, wording rules
node sme-readiness/tests/validate-content.js --links  # also opens every source link
node sme-readiness/tests/build-review.js              # rebuilds CONTENT-REVIEW.md
```
