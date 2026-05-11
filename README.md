# public-insurance-information-app

Hong Kong insurance product information and comparison demo built with Next.js.

## Product Description

This project is a Hong Kong insurance information platform.

The goal is to disclose and organize insurance plan information that is difficult for the public to access in one place. The platform normalizes insurance plan data, shows source transparency, lets users select plans for side-by-side analysis, and helps consumers understand products before speaking with a licensed insurance intermediary.

The product direction is not to rank plans or recommend a "best" plan. Instead, users select a small number of plans, likely two at a time, and the platform passes those selected plans to an LLM analysis workflow. The output should explain each plan's potential strengths, weaknesses, assumptions, risks, and missing data. Public-facing outputs should remain informational, explainable, and clearly separated from personal financial advice.

The platform can also become a discovery channel for licensed insurance agents through a paid directory subscription. For each plan, the platform may show a directory of agents who indicate that they can discuss that plan. The platform does not directly match users to agents, submit applications, arrange insurance contracts, sell insurance plan placement, or receive compensation tied to policy purchase.

Tagline:

> 保險公司唔會話你知嘅嘢，我哋話你知。

## Current Stage

Current status: working internal MVP/demo.

The app already has a product library, savings comparison/X-Ray view, FWD proposal extraction output, FWD inventory QA views, and compliance disclosure pages. It is suitable for demo and internal validation, but not ready for public launch until extracted PDF tables are manually QAed and the compliance model is reviewed.

## Business Model Evaluation

### 1. Google Ads

Google Ads is the easiest monetization path and has the lowest operational complexity. It can work well on SEO-driven product pages, explainers, and comparison pages.

The downside is that ad revenue will likely be modest unless the platform reaches large traffic volume. Ads may also reduce user trust if they appear too close to sensitive financial comparison content.

Assessment: good secondary revenue stream.

### 2. Paid Licensed Agent Directory

Licensed insurance agents can pay a subscription fee to be listed in the agent directory. For each plan, the platform may show agents who indicate that they can discuss that plan. Users can press a button to view contact information or visit the agent profile.

Subscription pricing may adjust based on measured directory traffic, such as profile views, contact-button clicks, or inquiry volume. This should be framed as a directory subscription and traffic-based subscription adjustment, not as sales commission.

The platform should not charge based on whether a policy is signed, should not take a percentage of premium, should not sell insurance plan placement, and should not describe the fee as commission.

Assessment: commercially promising, but medium compliance risk. It is safer if the platform only reveals contact information or links, records traffic events, verifies agent licence information, and does not transfer user personal data unless a separate consent workflow exists.

## Agent Directory Disclosure

The agent directory should be presented as a paid licensed-agent directory, not as a recommendation engine.

Suggested section wording:

> Agents listed here are paid directory subscribers. Their inclusion does not affect plan analysis and does not mean the platform recommends them.

For each listed agent, the platform should show:

- IA licence number
- licence type
- represented insurer or agency where relevant
- contact button or profile link
- clear note that the listing is not a platform recommendation

Directory ordering should be neutral, such as alphabetical order, newest verified first, or random rotation. If the platform ever sells priority placement inside the directory, that specific slot should be separately labelled as a featured directory listing.

## Compliance Direction

The product should stay in an information, sorting, and simulation posture unless a licensed workflow is in place.

Safe wording:

- product data
- side-by-side comparison
- user-selected sorting
- scenario simulation
- strengths and weaknesses
- data quality warning
- paid licensed agent directory
- directory subscription
- traffic-based subscription adjustment

Avoid wording such as:

- recommended for you
- best plan
- you should buy
- suitable for your needs
- matched agent
- apply through this agent
- sponsored product ranking
- paid insurance plan promotion
- sales commission
- commission from successful policy signing

Hong Kong Insurance Authority references:

- Regulation of Insurance Intermediaries: https://www.ia.org.hk/en/supervision/reg_ins_intermediaries/introduction_of_insurance_intermediaries.html
- New Statutory Requirements: https://www.ia.org.hk/en/supervision/reg_ins_intermediaries/new_statutory_requirements.html
- Explanatory Notes: https://www.ia.org.hk/en/legislative_framework/explanatory_notes.html
- Register of Licensed Insurance Intermediaries: https://www.ia.org.hk/en/supervision/reg_ins_intermediaries/registers_of_insurance_intermediaries.html

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run build:data
npm run test
npm run build
```

## Current Pages

- `/` dashboard overview
- `/fwd-inventory` FWD SMART inventory coverage/QA viewer
- `/fwd-compare` FWD premium and surrender/paid comparison viewer
- `/products` product database
- `/savings` savings comparison and X-Ray
- `/compliance` compliance disclosure

## Current FWD Inventory Backup

- Sanitised JSON: `data/fwd/fwd-smart-inventory-2026-05-11.json`
- Sanitised Excel: `data/fwd/fwd-smart-inventory-2026-05-11.xlsx`
- Import script: `scripts/import-fwd-inventory.py`

## Current Data Coverage

- FWD generated proposal batch: 13 products
- FWD inventory backup: 14 products
- FWD quote matrix rows: 135
- FWD premium options: 57
- FWD benefit value rows: 1,019
- FWD standard comparison rows: 50
- FWD extraction QA rows: 27
- Savings seed samples: 3 products
- VHIS medical seed data: 5 products
- Product catalog total: 21 products

## Changelog

### 2026-05-11

- Added FWD SMART inventory backup.
- Added `/fwd-inventory` inventory coverage and QA viewer.
- Added `/fwd-compare` FWD premium and surrender/paid comparison viewer.
- Added consumer budget cohort logic for FWD comparison.
- Added tests for FWD comparison, inventory backup, quote buckets, product data, and savings selection.

### 2026-05-11 Product Library Demo

- Parsed 13 FWD proposal PDFs.
- Created `scripts/build-product-data.mjs`.
- Generated `data/products/fwd-smart-2026-05-10.json`.
- Added unified product catalog loading in `lib/products.ts`.
- Added `/products` with filters, search, source visibility, and data-quality warnings.
- Rebuilt `/` into a dashboard overview.

### 2026-05-11 Savings Curve Update

- Added cleaned FWD comparison value points.
- Updated `/savings` to include structured savings samples and usable FWD PDF savings-like plans.
- Changed comparison basis to `退保價值 / 已供保費`.
- Added 100% breakeven line.

### 2026-05-10

- Added `recharts`.
- Added surrender value line chart to `/savings`.
- Improved mobile layout.
- Added `MedicalPlan` type.
- Added five VHIS Standard Plan seed JSON files.
- Added compliance disclosure page.

## Main Remaining Work

- Manually QA extracted FWD proposal tables.
- Remove local absolute source paths before public deployment.
- Generalize the FWD import pipeline beyond hardcoded local folders.
- Add more insurers and product categories.
- Design the user-selected LLM analysis workflow for two-plan strengths and weaknesses.
- Add reviewer approval, evidence capture, and audit logs for LLM-generated analysis.
- Design the paid licensed-agent directory.
- Verify agent licence numbers, licence type, and represented insurers before publishing agent profiles.
- Decide privacy and consent handling before collecting or forwarding any user personal data.
- Add production deployment, monitoring, and CI.
