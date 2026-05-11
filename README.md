# public-insurance-information-app

Hong Kong insurance product information and comparison demo built with Next.js.

## Product Description

This project is a Hong Kong insurance information platform.

The goal is to disclose and organize insurance plan information that is difficult for the public to access in one place. The platform normalizes insurance plan data, shows source transparency, compares plans by user-selected criteria, and helps consumers understand products before speaking with an agent.

The project also supports an internal comparison workflow where normalized plan data can be passed to LLMs for structured review and rating. Public-facing outputs should remain informational, explainable, and clearly separated from personal financial advice.

The platform can also become a discovery channel for insurance agents to reach potential customers, as long as sponsored visibility, ratings, and customer matching are kept separate and properly disclosed.

Tagline:

> 保險公司唔會話你知嘅嘢，我哋話你知。

## Current Stage

Current status: working internal MVP/demo.

The app already has a product library, savings comparison/X-Ray view, FWD proposal extraction output, FWD inventory QA views, and compliance disclosure pages. It is suitable for demo and internal validation, but not ready for public launch until extracted PDF tables are manually QAed and the compliance model is reviewed.

## Business Model Evaluation

### 1. Google Ads

Google Ads is the easiest monetization path and has the lowest operational complexity. It can work well on SEO-driven product pages, explainers, and comparison pages.

The downside is that ad revenue will likely be modest unless the platform reaches large traffic volume. Ads may also reduce user trust if they appear too close to sensitive financial comparison content.

Assessment: good secondary revenue stream, not the main business model.

### 2. Paid Agent Or Insurer Placement

Agents or insurers could pay for sponsored placement, meaning their plans or profiles appear more frequently or more prominently. This should not affect ratings, comparison scores, or user-controlled sorting.

This model can generate revenue earlier than transaction commissions, but it creates trust and compliance risk. Sponsored placements must be clearly labelled and visually separated from neutral comparison results.

Assessment: viable, but only with strict separation between paid visibility and rating/comparison logic.

### 3. Successful Match Commission

The platform could match consumers with licensed insurance agents and take a commission when a plan is successfully signed.

This has the strongest revenue potential, but also the highest compliance complexity. Matching users to agents, transferring user information, inducing users to buy, or participating economically in a signed policy may move the platform closer to regulated insurance intermediary activity.

Assessment: strongest commercial model, but should only be built with proper Hong Kong insurance compliance/legal review and a licensed intermediary, broker, agency, or partner structure.

## Compliance Direction

The product should stay in an information, sorting, and simulation posture unless a licensed workflow is in place.

Safe wording:

- product data
- comparison
- user-selected sorting
- scenario simulation
- data quality warning
- sponsored placement

Avoid wording such as:

- recommended for you
- best plan
- you should buy
- suitable for your needs

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
- Design the internal LLM rating workflow.
- Add reviewer approval and audit logs for LLM-generated ratings.
- Decide the commercial and compliance structure before enabling agent matching, lead transfer, or commission sharing.
- Add production deployment, monitoring, and CI.
