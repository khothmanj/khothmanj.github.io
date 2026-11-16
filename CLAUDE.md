# CLAUDE.md: Khadijat Othman, Product Manager Portfolio

This file gives you the context for every task in this repository. Read it fully before making changes. If a request conflicts with this file, ask before proceeding.

---

## 1. Who this is for

**Owner:** Khadijat Othman, Product Manager based in the UK.
**Experience:** 5+ years in product management across B2B SaaS, fintech, digital platforms, public-sector technology and AI-enabled products.
**Education:** MSc Innovation and Information Technology, University of Salford (graduating January 2027).

**Goal of this repo:** a public portfolio website that helps Khadijat get interviews for Product Manager roles with AI experience at UK mid-size tech companies.

**Audience:** recruiters and hiring managers. Assume they spend 1 to 3 minutes per project. They want to see:
1. Product thinking: the problem, users, decisions, trade-offs and metrics.
2. Proof she can work with technical teams: data, APIs, AI behaviour, guardrails.
3. Working, polished, clickable products, not static screenshots.

**Key facts to keep consistent everywhere:**
- MSc title: "MSc Innovation and Information Technology", University of Salford, expected January 2027.
- Cape Mano AI financial modelling tool: cut manual modelling time by ~70%.
- Onita (Grant Thornton): a white-label project management platform customised for each client company's workflows and branding, used by 25 users.

**Full CV:** see `private/cv.md` (not committed, see section 9). Use it as the source of truth for experience, roles, dates and numbers.

---

## 2. Repository structure

```
/
├── index.html              # Portfolio home page
├── assets/
│   ├── css/base.css        # Shared design tokens and components
│   ├── js/                 # Shared helpers (theme, routing, utilities)
│   └── img/                # Optimised images and favicons
├── support-studio/         # Project 1
│   └── index.html
├── fintech-analytics/      # Project 2
├── velbourne/              # Project 3
├── fraud-toolkit/          # Project 4
├── food-security/          # Project 5
├── tenor/                  # Project 6: Tenor, project finance modeller (own colour scheme)
├── private/                # Git-ignored. CV and personal notes. Never publish.
├── CLAUDE.md
└── README.md
```

Each project lives in its own folder with its own `index.html` so it has a clean URL, for example `/support-studio/`.

---

## 3. Technical rules

- **Static site only.** HTML, CSS and vanilla JavaScript. No backend, no database, no build step, no framework unless Khadijat asks for one. It must deploy to GitHub Pages as-is.
- **No API keys, no live AI calls.** All AI behaviour is simulated in the browser with realistic sample data and deterministic logic (keyword or scoring-based retrieval, scripted responses, pre-generated outputs). Make it feel real and behave consistently.
- **Sample data only.** Store it in clear JS objects or small JSON files inside each project folder.
- **External resources:** Google Fonts and pinned CDN libraries (for example Chart.js) are fine. Pin exact versions.
- **Hash routing** (`#overview`, `#chat`) for views inside a project, so links to a specific screen can be shared.
- **Quality floor for every page:**
  - Responsive from 360px mobile to wide desktop. No sideways page scrolling.
  - Light and dark mode via CSS variables and `prefers-color-scheme`.
  - Keyboard accessible with visible focus states. Semantic HTML. Alt text and aria labels where needed.
  - Respect `prefers-reduced-motion`.
  - WCAG AA colour contrast.
  - No console errors.
  - Fast: no heavy images, lazy-load anything large.
- **Test before finishing.** Open each changed page, click through every interactive element, check mobile width and dark mode.

---

## 4. Design system

The portfolio and all projects should feel like one brand, while each project keeps its own fictional product identity inside its app view.

**Portfolio brand tokens** (established in Support Studio, reuse them):

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | #F4F4F6 | #121016 | Page background |
| panel | #FFFFFF | #1B1821 | Cards |
| ink | #17151C | #EEEBF3 | Main text |
| muted | #6A6775 | #A6A1B2 | Secondary text |
| line | #E4E2EA | #2E2937 | Borders |
| plum | #241B35 | #17121F | Sidebars, primary dark surfaces |
| violet | #5B45D6 | #A698FF | Primary actions, highlights |
| gold | #F5B544 | #F5B544 | Accent, attention, progress |
| red / green | #C2392C / #1E7A4F | #F08A7E / #6FD3A0 | Status only |

**Type:**
- Instrument Serif for large editorial headlines on case study pages.
- Geist for all UI and body text, with tabular numbers for data.

**Avoid these, because they make work look generic:**
- ALL CAPS labels or tracked-out eyebrow text above headings.
- Gradient blobs and decorative gradients.
- Identical rounded cards with the same soft shadow everywhere.
- Emoji as icons. Use simple inline SVG icons.
- Arrows appended to button text.
- Generic stock copy ("Unlock the power of...", "Seamless", "Revolutionary").
- Every section fading and sliding in. Use one meaningful animation per page at most.

**Do:**
- Make each product view look like a real SaaS tool: sidebar, top bar, realistic data, statuses, empty states, edit and approve actions.
- Spend boldness in one place per page and keep the rest disciplined.

---

## 5. Writing rules (all visible text)

- **Never use em dashes.** Use commas, full stops, or "and"/"so".
- UK English spelling.
- Plain, humanised English. Short sentences. Sentence case for headings and buttons.
- Buttons say exactly what they do ("Approve and send", not "Submit").
- No invented achievements, employers, clients or numbers. Results must come from the CV. If a number isn't in the CV, don't use it, or label it clearly as sample data.
- Every project shows a small note: "Prototype with a fictional brand and sample data."

---

## 6. Confidentiality

- Never use real client data, real employer systems, internal documents or real people's names from past jobs.
- Use fictional brands for products based on employer work (for example, Fernhill Hat Co. in Support Studio).
- Case studies may say "based on work for a UK headwear retailer" or similar, without naming confidential details.
- Velbourne is Khadijat's own product, so its real name can be used.

---

## 7. Page structure for every project

Each project folder has two parts. The product opens first. The case study is always the **last tab** in the app's navigation (`#case-study`), never the landing page.

**A. Interactive product (default view, hash routes):** a realistic app with sidebar navigation, sample data, and working interactions. Its first screen must make sense to a recruiter in seconds, for example by offering a ready-made example to load.

**B. Case study (last tab, `#case-study`):**
1. Headline that states the product idea in one line, plus a short lede.
2. A visual of the product's most characteristic moment (a live mini demo or animated walkthrough, not a stock hero).
3. Role, context, "prototype with sample data" note.
4. The problem (2 to 3 short points).
5. What I built (modules, each linking into the live app view).
6. Key decisions and trade-offs (the most important section: show judgement).
7. Results from the original work, using CV figures only.
8. What I'd do next.
9. Link back to the portfolio home.

---

## 8. Projects

### 8.0 Portfolio home (`/index.html`)
- Intro: name, "Product Manager, AI-enabled products, B2B SaaS, fintech", 2 to 3 sentence positioning.
- Project cards (title, one-line problem, tags, link). The cards are the main content.
- Short experience timeline from the CV.
- Skills summary, education, certifications.
- Contact: email, LinkedIn, GitHub, downloadable CV (PDF in `assets/`, only when Khadijat provides one for publishing).

### 8.1 Support Studio (`/support-studio/`): built, refine only
AI customer support desk for a fictional retailer. Live chat with retrieval trace and confidence threshold, email drafts with human approval and fraud flagging, knowledge base with gap detection, quality test runner, competitor research agent.
**Based on:** Masumi Headwear internship (AI chatbot, email drafting, Claude research agents, fraud review).

### 8.2 Fintech product analytics (`/fintech-analytics/`)
A lending-API product analytics dashboard for a fictional B2B lending platform.
- Activation funnel: signed up, integrated, first API call, active.
- Inactive customers list (signed up but never active) with filters and suggested next action.
- API usage and spend trends per customer, integration health (error rates by endpoint, for example identity check and credit score).
- A "SQL behind this" toggle that shows the query for each chart.
- A data consistency checker that flags mismatches between front-end records and the underlying ledger (inspired by 4Core ERP work).
- A short PRD panel for a re-engagement feature, built from the data.
**Based on:** LendsQR (NIBSS and credit-scoring APIs, SQL analysis), 4Core (data integrity).

### 8.3 Velbourne (`/velbourne/`)
Khadijat's own AI-enabled event planning platform, pre-launch.
- Paste a messy event brief, see it turned into structured requirements, a checklist and a vendor shortlist (simulated), with a planner review step before anything reaches the client.
- Organiser workspace: events, vendor management, client status.
- Discovery section: insights from 37 organiser and vendor sessions, personas, MVP scope and roadmap, early-access waitlist (~30 sign-ups).

### 8.4 SME fraud detection and awareness toolkit (`/fraud-toolkit/`)
- Self-assessment for small businesses (access controls, 2FA, payment approval steps, staff training) producing a risk score and prioritised fixes.
- Suspicious payment request checker: paste an email, see it flagged against fraud patterns (bank detail changes, urgency, lookalike domains), with a human decision step.
- Awareness guide for staff.
**Based on:** Masumi fraud review and MSc dissertation (cybersecurity, payment fraud and AI-enabled controls in UK SMEs). Reference GDPR and data governance where relevant.

### 8.5 Food security dashboard (`/food-security/`): optional
State-level agricultural and food indicators for Nigeria using public or clearly sample data, with filters, drill-downs, reporting completeness and a plain-English summary per state.
Label it "inspired by" her public-sector work. Never imply it's the real government dashboard.
**Based on:** Office of the Vice President, Nigeria (100+ users, 22 states, 7+ institutions).

### 8.6 Tenor (`/tenor/`): built, refine only
AI-assisted project finance modeller. Replaces the earlier "investment readiness model generator" idea. Turns a project's story and numbers into a linked Excel model, a Word report, a PowerPoint deck and CSV data, for any sector and funding route. Full brief: `private/briefs/tenor.md` (not committed).
- **Own look:** Tenor uses its own brand, not the portfolio's violet and gold, including on its case study tab. Light by default on pure white (#FFFFFF) with a dark option, frosted glass panels, soft corners, a left sidebar with duotone icons, and Geist throughout (Outfit only for the wordmark). Colour follows the Tenor logo (`tenor/img/tenor-mark.svg`): neutral navy text (#0B1220) with the logo blue (#3550FC) used sparingly for primary actions, the active item, focus and key chart lines. A faint blue wash behind the page is deliberate: it is what the frosted glass blurs, and it is the one exception to the no-gradients rule.
- **Structure:** opens on a landing page (`#home`) that explains the tool, with the hero image `tenor/img/hero.webp`. Inner pages (results, intake, library cases) have a back link at the top. The sidebar has Home, Your projects, Case library, How it works and Case study (last).
- **Data:** `tenor/data/cases.json` holds 17 real projects from public sources. Every value is labelled sourced, derived or assumed. Never add a figure without opening its source.
- **Tests:** `tenor/tests/run-node.js` (engine), `tenor/tests/engine.test.html` (browser), and `tenor/tests/lo-recalc.sh` with `excel-compare.js` and `excel-input-change.js` to check every Excel cell against the engine in LibreOffice.
- **Results from the original tool (CV):** manual modelling time cut by ~70%; investment-ready proposals across 6 projects and 4 sectors, valued at over $70M.
**Based on:** Cape Mano Group AI-assisted financial modelling tool. No Cape Mano client data is used.

---

## 9. Git and privacy

- `.gitignore` must include `private/`, `.DS_Store` and editor folders.
- Never commit the CV source, personal notes, phone number or home address.
- Commit messages: short, present tense, specific ("Add inactive customer filters to fintech dashboard").
- Commit after each working milestone so changes can be rolled back.

## 10. Deployment

- GitHub Pages from the `main` branch, root folder.
- The repo is named `<github-username>.github.io` so the site lives at `https://<github-username>.github.io/`.
- After deploying, check every project link works with a trailing slash.

## 11. How to work with Khadijat

- Ask one clarifying question if a request is genuinely ambiguous, otherwise make a sensible choice and state it.
- Before building a new project, share a short plan (screens, sample data, key interactions, the one memorable element) and wait for approval.
- After building, give a short summary of what changed and anything she should check, for example numbers that need confirming.
- Be honest about weaknesses in the work. She prefers direct feedback to flattery.
