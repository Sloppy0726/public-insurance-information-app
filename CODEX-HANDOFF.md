# Codex Handoff — insurance-compare

## What this project is

A **public-facing Hong Kong insurance comparison website** for consumers. Free to use, no login required. Revenue comes from agent/broker advertising (clearly labelled, never influencing rankings).

Tagline: 「保險公司唔會話你知嘅嘢，我哋話你知。」

## What is already built

### Working pages
- `/` — Dashboard overview showing total products, category coverage, FWD batch status, and links into the demo views
- `/products` — Product library demo combining FWD PDF extracts, savings samples, and VHIS seed data with category filters/search/source trace
- `/savings` — Savings plan comparison with 3 tabs:
  - **自訂排名**: 4 weight sliders (early surrender loss / guarantee / projected return / long-term growth) → instant re-ranking of 3 plans
  - **費用X-Ray**: Surrender value line chart, early surrender loss bars (year 3 + year 5), guaranteed vs non-guaranteed stacked bars, IRR comparison
  - **逐年數據**: Year selector → card per year showing each plan's surrender value (red = loss, green = profit)

### File structure
```
app/
├── page.tsx                  ← Homepage
├── layout.tsx                ← Root layout
├── globals.css
└── savings/
    ├── page.tsx              ← Server component, loads JSON → passes to client
    └── SavingsCompare.tsx    ← Full client-side comparison UI (3 tabs)
└── products/
    ├── page.tsx              ← Loads unified product catalog
    └── ProductLibrary.tsx    ← Product database UI with filters/search

lib/
├── types.ts                  ← Plan, MedicalPlan, ProductSummary types
├── plans.ts                  ← loadPlans(category) reads savings JSON files
└── products.ts               ← loadProductCatalog() merges PDFs + seed data

data/
├── savings/
│   ├── zurich-swiss-prime.json
│   ├── fwd-max-focus-ii.json
│   └── ctf-my-wealth-beyond.json
└── medical/
    ├── aia-vhis-standard.json
    ├── boc-vhis-standard.json
    ├── bowtie-vhis-standard.json
    ├── bupa-mybasic-vhis.json
    └── hsbc-vhis-standard.json
└── products/
    └── fwd-smart-2026-05-10.json

scripts/
└── build-product-data.mjs    ← Parses FWD manifest/PDFs into data/products JSON

tests/
└── product-data.test.mjs     ← Node tests for manifest parsing/id/metric extraction
```

### Data format (all 3 plans follow this schema)
```ts
type Plan = {
  company: string               // "Zurich"
  company_zh: string            // "蘇黎世人壽保險（香港）有限公司"
  product_name: string          // "Swiss Prime Savings Plan"
  product_name_zh: string       // "瑞盈儲蓄保險計劃"
  category: string              // "savings"
  currency: string              // "USD"
  quote_profile: { age: 30, gender: "M", smoker: false }
  premium: {
    monthly: number             // 1300
    payment_term_years: number  // 5
    total_premium_paid: number  // 78000
  }
  surrender_value_table: Array<{
    year: number
    total_paid: number
    guaranteed: number
    total_surrender: number
  }>
  xray: {
    year3_surrender_loss_pct: number   // e.g. 90.3
    year3_surrender_loss_usd: number   // e.g. 42280
    year5_surrender_loss_pct: number
    year5_surrender_loss_usd: number
    guaranteed_irr_20y: string         // "負數"
    projected_irr_20y: string          // "~5.1%"
    breakeven_year_projected: string   // "~8-9年"
    total_non_guaranteed_ratio_20y: number
  }
}
```

### Current plan data (same quote profile: 30M non-smoker, USD $1,300/month, 5Y payment)

| Plan | Company | Year 3 loss | Year 5 loss | 20Y projected | 30Y projected |
|------|---------|-------------|-------------|---------------|---------------|
| 瑞盈 Swiss Prime | Zurich | 90.3% (-$42,280) | 84.8% (-$66,178) | $210,411 | $381,988 |
| 盈聚天下II Max Focus II | FWD | 60.3% (-$28,205) | 44.9% (-$35,060) | $206,833 | $381,076 |
| 匠心飛越 My Wealth Beyond | CTF Life | 96.2% (-$45,040) | 74.2% (-$57,898) | $207,072 | $422,843 |

Key fact: **none of the 3 plans have positive guaranteed IRR at 20 years**. All projected returns depend 60-70% on non-guaranteed bonuses.

## Latest Codex continuation — 2026-05-10

Completed:
- Added `recharts` and a surrender value line chart to the X-Ray tab in `app/savings/SavingsCompare.tsx`.
- Mobile-polished `/savings`: short tab labels below 390px, ranking stat cards stack below 420px, X-Ray labels wrap instead of clipping, IRR rows use a mobile-friendly grid.
- Added `MedicalPlan` to `lib/types.ts`.
- Added five official VHIS Standard Plan seed JSON files under `data/medical/`.
- Verified `npm run build` passes.
- Verified `/savings` visually with Playwright at 375px mobile and 1280px desktop: no document-level horizontal overflow, chart visible, no browser console errors/warnings.

Verification artifacts from this run:
- Mobile X-Ray screenshot: `/tmp/insurance-savings-mobile-xray.png`
- Desktop X-Ray screenshot: `/tmp/insurance-savings-desktop-xray.png`

Known technical notes:
- The Codex in-app browser blocked local URLs in this session with `ERR_BLOCKED_BY_CLIENT`, so visual QA used local Playwright from the bundled runtime instead.
- `npm audit --audit-level=moderate` reports 2 moderate advisories via `next` → bundled `postcss`; npm's suggested fix path is a breaking/downgrade path, so do not run `npm audit fix --force` casually.
- There is an existing Next dev server lock around port 3001. Production verification used `next start -p 3015` after `npm run build`.

## Latest Codex continuation — 2026-05-11

Completed:
- Found the user's downloaded FWD SMART proposal batch here:
  `/Users/book/Documents/AI SME /FWD_SMART_Proposals_2026-05-10/`
- Parsed `data/proposals_manifest.csv` and 13 FWD proposal PDFs using local `pdftotext`/`pdfinfo`.
- Created `scripts/build-product-data.mjs` and generated:
  `data/products/fwd-smart-2026-05-10.json`
- Added a unified product catalog loader in `lib/products.ts` that merges:
  - 13 FWD PDF-extracted products
  - 3 existing savings sample products
  - 5 VHIS public medical seed products
- Added `/products` product library page with category filters, search, source file visibility, PDF/page counts, and data-quality warnings.
- Rebuilt `/` into a dashboard overview for showing the project to friends.
- Added `npm run build:data` and `npm run test` scripts.

FWD batch summary:

| Category | Count |
|---|---:|
| 儲蓄 | 4 |
| 人壽儲蓄 | 4 |
| 人壽 | 1 |
| 危疾 | 3 |
| 年金 | 1 |

FWD products currently in the generated JSON:
- 智優盛儲蓄保險計劃
- 創逸致富 (豐裕版)
- 自主保定期保障計劃
- 危疾緻尚保
- 盈‧歲悅延期年金計劃
- 家 ‧ 年華壽險計劃
- 創逸致富(豐裕版) II 保險計劃
- 創逸致富﹙豐盛版﹚
- 盈聚‧天下 II 保險計劃
- 智盈匯聚(優越版)III壽險計劃
- 智盈．超凡保險計劃
- 攻守易癌症保障計劃
- 攻守易(升級版)癌症保障計劃

Important caveat:
- FWD PDF money fields and high-level metrics are extracted and demo-ready, but yearly tables are marked as raw extraction because some proposal tables need manual QA against the source PDF before public launch.

Verification artifacts from this run:
- Desktop/mobile screenshots generated by Playwright:
  - `/tmp/insurance-desktop-home.png`
  - `/tmp/insurance-desktop-products.png`
  - `/tmp/insurance-mobile-home.png`
  - `/tmp/insurance-mobile-products.png`
- Browser smoke test on `http://localhost:3015`:
  - `/` rendered homepage dashboard
  - `/products` rendered 21 cards
  - Search `危疾` returned 3 cards
  - Medical filter returned 5 cards
  - Browser console errors: 0
- Responsive Playwright check at 1280x900 and 390x844:
  - `/` no horizontal overflow
  - `/products` no horizontal overflow
  - browser/page errors: 0

## Latest Codex continuation — 2026-05-11 savings curve update

Completed:
- Added `selectComparisonValuePoints()` in `scripts/build-product-data.mjs` to clean FWD PDF value rows before plotting.
- Regenerated `data/products/fwd-smart-2026-05-10.json` with `comparison_value_points`.
- Updated `lib/plans.ts` with `loadSavingsComparisonPlans()` so `/savings` now includes:
  - 3 original structured savings sample plans
  - 8 usable FWD PDF savings-like plans from the new batch
- Updated `/savings` chart and ranking logic to compare by percentage:
  - curve = `退保價值 / 已供保費`
  - 100% dashed line = breakeven
  - cards still show actual premium start such as annual premium or single premium
- Skipped `智優盛儲蓄保險計劃` from `/savings` curve because current PDF extraction only produced 3 sparse/noisy yearly rows. It remains visible in `/products`.

Verification:
- `npm run test`: 5 pass, 0 fail.
- `npm run build`: pass.
- Playwright smoke on `/savings` at 1280x900 and 390x844:
  - ranking tab shows 11 items
  - header shows `FWD PDF 8個`
  - X-Ray tab renders chart SVGs
  - yearly table shows percentage basis copy
  - no horizontal overflow
  - browser console errors: 0

Public tunnel:
- Current TryCloudflare URL tested with HTTP 200:
  `https://bit-milwaukee-frames-snap.trycloudflare.com/savings`

## Latest Codex continuation — 2026-05-11 comparison selection + extraction skill

Completed:
- Added `lib/selection.ts` with comparison selection rules:
  - dedupe near-identical product names per insurer/category
  - score by year 20 `total_surrender / total_paid`
  - fallback to year 30, year 10, then year 5
  - keep max 3 products per `insurer + category`
- Updated `loadSavingsComparisonPlans()` to apply the max-3 selection before rendering `/savings`.
- Added tests in `tests/savings-selection.test.mjs`.
- Updated `npm run test` to run all `tests/*.test.mjs`.
- Created project-local skill:
  `skills/insurance-plan-extraction/SKILL.md`

The extraction skill tells future agents/parsers to extract:
- payment mode: monthly, annual, single
- payment variants: 2-pay, 5-pay, 10-pay, and exact payment term
- premium, levy, annualized premium, total paid
- policy term / coverage term
- yearly surrender value tables
- guaranteed cash value
- non-guaranteed bonus split
- death benefit tables kept separate from surrender value
- annuity payout fields
- VHIS/medical benefit fields
- CI/life benefit fields
- source page and QA status

Verification:
- `npm run test`: 7 pass, 0 fail.
- `npm run build`: pass.
- `/savings` Playwright smoke at 390px:
  - ranking shows 9 plans after per-company/category limit
  - header shows `FWD PDF 7個`
  - chart renders
  - no horizontal overflow
  - browser console errors: 0

## Tech stack
- Next.js 16.2.6 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS 4
- No database yet — data is static JSON files in `/data/`
- No authentication — everything is public
- External dependency added: `recharts` for the savings X-Ray line chart

## What to build next (in priority order)

### 1. Share / screenshot feature
Add a "分享" button on the X-Ray tab:
- Generates a summary card image (use `html2canvas` or a simple canvas approach)
- Shows: plan names, year 5 loss %, 20Y projected values
- Shareable to WhatsApp/IG Stories
- This drives organic growth — "保險公司唔想你見到呢張圖"

### 2. VHIS Medical comparison page (`/medical`)
New category. Schema is different from savings — no surrender values, focus on:
```ts
type MedicalPlan = {
  company: string
  company_zh: string
  product_name_zh: string
  annual_premium_by_age: Record<number, number>  // { 30: 8800, 35: 11200, ... }
  lifetime_limit: number | null      // null = unlimited
  annual_limit: number | null
  deductible: number                 // 墊底費
  room_class: string                 // "私家房" | "半私家房" | "普通房"
  outpatient: boolean
  guaranteed_renewal_age: number     // e.g. 100
  overseas_coverage: boolean
  vhis_certified: boolean            // 自願醫保認可計劃
  tax_deductible: boolean            // max HKD $8,000/yr
}
```
Add a VHIS tax deduction calculator widget: user inputs their annual income → shows actual HK$ saved.

### 3. "點解保證回報係負數？" explainer modal
When user taps the amber warning banner in X-Ray tab, show a bottom sheet with plain Cantonese explanation:
- Why all savings plans have negative guaranteed IRR
- What reversionary bonus and terminal dividend actually mean
- Why non-guaranteed doesn't mean zero, but also doesn't mean guaranteed
- Keep it conversational, no jargon. 300 words max.

### 4. Add more savings plans
When the owner provides more PDF illustrations, extract data and add JSON files to `data/savings/`. The UI automatically picks them up via `loadPlans('savings')`. Each new file just needs to follow the existing JSON schema.

---

## HK competitor research — 2026-05-10

Main competitors and reference points:

| Competitor | What they do | Practical implication |
|---|---|---|
| [10Life](https://www.10life.com/en) | Insurance ratings/comparison platform. Publicly claims 1,500+ plans, 50+ insurers, 2.3M+ annual active users, advisor service, VHIS calculator, AI assistant beta. | Strongest direct competitor. They win breadth and trust. This project needs a sharper wedge: transparent savings-plan X-Ray, plain Cantonese, source-backed surrender math, and shareable visuals. |
| [MoneyHero](https://www.moneyhero.com.hk/en/insurance) | Finance comparison marketplace with insurance quote/apply flows. Their own site says they are a licensed insurance broker regulated by the IA, license FB1740. | They can transact and monetize leads directly. This platform should stay clearly informational unless/until a broker licence or compliant partner model exists. |
| [MoneySmart HK](https://www.moneysmart.hk/en) | Broad personal finance comparison site with rewards and insurance categories. | Competes on SEO, incentives, and broad finance audience, not deep insurance education. |
| [Kwiksure](https://kwiksure.com/) | HK insurance broker/comparison brand, strongest around motor insurance; says it compares motor quotes from 60+ insurers. | Shows category specialization can work. A narrow savings/VHIS wedge can be more credible than trying to cover every product immediately. |
| [Bowtie](https://www.bowtie.com.hk/) | Direct insurer, not a comparison site, but a strong D2C insurance/content competitor for VHIS and protection products. | Competes for the same search intent and trust. Use neutral comparison and explainers, not product sales copy. |

How to succeed in HK:
- Own the Cantonese "show me the numbers" position: early surrender loss, guaranteed vs non-guaranteed, breakeven year, and source documents should be visible before any marketing.
- Stay narrower than 10Life at first: savings insurance transparency and VHIS tax/premium comparison are enough to build a memorable product.
- Build trust with receipts: every plan card should link to a source PDF, quote date, profile, and extraction notes.
- Keep IA compliance in the product language: no "best", no "recommended", no purchase-inducing ranking copy. Rankings are user-weighted sorting only.
- Make the X-Ray shareable: WhatsApp/IG image cards are likely a stronger growth loop than a generic comparison table.
- Local SEO topics to target: `儲蓄保退保`, `保證回報負數`, `非保證紅利`, `VHIS 扣稅`, `自願醫保保費`, `危疾保等候期`.
- Monetize separately from rankings: clearly labelled sponsored agent/broker slots, source sponsorship, or directory listing. If the business wants leads/applications/advice, get licensed or partner with a licensed broker and update compliance wording.

## Public insurance data found

Good public sources:
- Official VHIS certified plan data: [DATA.GOV.HK certified plans dataset](https://data.gov.hk/en-data/dataset/hk-hhb-hhbvhis-vhis-certified-plan)
- Official VHIS standard premium zip: [plan-premium.zip](https://www.vhis.gov.hk/public/data/plan-premium.zip)
- Official VHIS plan pages: [Standard Plan list](https://www.vhis.gov.hk/en/consumer_corner/standard-plan.html), [Flexi Plan list](https://www.vhis.gov.hk/en/consumer_corner/flexi-plan.html)
- VHIS benefit facts can be cross-checked from insurer pages such as [AIA VHIS Standard](https://www.aia.com.hk/en/products/health/vhis-standard) and [HSBC VHIS Standard](https://www.hsbc.com.hk/insurance/products/medical-and-critical-illness/vhis/standard/): annual benefit limit HK$420,000, no lifetime benefit limit, guaranteed renewal up to age 100, tax-deductible eligibility.

Seed data added to `data/medical/` from the official VHIS premium dataset:

| File | Plan | Certification no. | Age 30 male non-smoker annual premium |
|---|---|---:|---:|
| `bowtie-vhis-standard.json` | Bowtie VHIS Standard | S00023-01-000-03 | HK$1,656 |
| `bupa-mybasic-vhis.json` | Bupa MyBasic VHIS Plan | S00020-01-000-02 | HK$2,737 |
| `aia-vhis-standard.json` | AIA Voluntary Health Insurance Standard Scheme | S00013-01-000-02 | HK$2,235.20 |
| `boc-vhis-standard.json` | BOC Standard VHIS Plan | S00035-01-000-02 | HK$2,323 |
| `hsbc-vhis-standard.json` | HSBC Voluntary Health Insurance Standard Plan | S00042-01-000-02 | HK$2,096 |

Important data caveats:
- Savings plan public data is weaker than VHIS. Real surrender values usually come from personalised insurer proposal PDFs, not public brochures. Keep using actual proposal PDFs for savings products.
- VHIS Standard Plan premiums are public and good enough for the first medical comparison page. Benefit details are standardised, but Flexi plans need plan-level benefit parsing before comparison.
- `data/medical/*.json` is not used by the UI yet. Build `/medical` next and decide whether `loadPlans()` should become generic or category-specific.

---

## IA regulatory rules — NEVER violate these

Hong Kong Insurance Authority rules apply. This platform is NOT a licensed broker.

**Never use these words/phrases:**
- 推薦, 最佳, 應該買, best buy, recommend, suggest (in the context of buying a product)
- Any language that could be seen as "inviting or inducing" someone to purchase

**Always include on every page:**
> 以上資料僅供參考，不構成任何投保建議。本平台不安排任何保險合約。

**Advertising slots** (when added later) must be:
- Visually separate from comparison tables/rankings
- Labelled clearly as "推廣 · Sponsored"
- Never inside ranking tables or influencing scores

**AI chat** (when added later):
- Must never say "you should buy X"
- Every response must end with the disclaimer above
- All responses must be logged

---

## Design rules

- **Mobile-first always** — design for 375px, scale up. HK is 85%+ mobile traffic.
- **Colour system**: red = loss/danger, green = gain/safe, yellow/amber = non-guaranteed/caution, blue = neutral info
- **Tone**: casual Cantonese (廣東話), like a smart friend, not a financial advisor
- **No dark mode needed** — keep it simple for now
- **Rounded corners**: use `rounded-2xl` for cards, `rounded-full` for buttons/pills
- **Show numbers, not opinions** — every claim must have a number behind it

---

## Where all datasets live

### This project's data (active, used by UI)
```
/Users/book/Documents/insurance-compare/data/
├── savings/
│   ├── zurich-swiss-prime.json       ← 蘇黎世 瑞盈儲蓄保險計劃
│   ├── fwd-max-focus-ii.json         ← 富衛 盈聚·天下 II
│   └── ctf-my-wealth-beyond.json     ← 周大福 匠心·飛越
└── medical/
    ├── aia-vhis-standard.json        ← AIA VHIS Standard
    ├── boc-vhis-standard.json        ← BOC Standard VHIS
    ├── bowtie-vhis-standard.json     ← Bowtie VHIS Standard
    ├── bupa-mybasic-vhis.json        ← Bupa MyBasic VHIS
    └── hsbc-vhis-standard.json       ← HSBC VHIS Standard
└── products/
    └── fwd-smart-2026-05-10.json     ← 13 FWD proposal PDF extracts
```
The savings JSON files are live in `/savings` via `loadPlans('savings')`. The unified `/products` page renders data from `data/products/`, `data/savings/`, and `data/medical/` via `loadProductCatalog()`.

### New FWD PDF batch found on this Mac
```
/Users/book/Documents/AI SME /FWD_SMART_Proposals_2026-05-10/
├── data/proposals_manifest.csv
└── pdfs/
    ├── 20260510_FWD_SAVING_SmartSaver_USD24999.83_SINGLE_minAdjusted.pdf
    ├── 20260510_FWD_LIFESAVING_FortuneSaver_Wealthy_USD56355_SINGLE.pdf
    ├── 20260510_FWD_LIFE_TermLife_HKD101.92_ANNUAL.pdf
    ├── 20260510_FWD_CI_CrisisOne_HKD4789.81_ANNUAL.pdf
    ├── 20260510_FWD_ANNUITY_DeferredAnnuity_USD7655.47_ANNUAL.pdf
    └── ...8 more PDFs listed in the manifest
```
Use `npm run build:data` to regenerate `data/products/fwd-smart-2026-05-10.json` from this folder.

### Raw source PDFs (original insurer illustrations)
```
/Users/book/Documents/insurance-agent-web/knowledge-base/raw-pdfs/
├── Zurich Swiss Prime Monthly 1300USD.pdf
├── FWD Max Focus II Monthly 1300USD Sample.pdf
└── CTF My Wealth Beyond Monthly 1300 USD.pdf
```
These are the original insurer-generated proposal documents the JSON data was extracted from. Quote profile for all 3: 30-year-old male, non-smoker, USD $1,300/month, 5-year payment term.

### Backup JSON copies (same data, second location)
```
/Users/book/Documents/insurance-agent-web/knowledge-base/plans/savings/
├── zurich-swiss-prime.json
├── fwd-max-focus-ii.json
└── ctf-my-wealth-beyond.json
```
Identical to the files in this project's `/data/savings/`. Kept here as backup alongside the raw PDFs.

### Folder structure for future categories (empty, ready to fill)
```
/Users/book/Documents/insurance-agent-web/knowledge-base/plans/
├── savings/          ← 3 files done
├── medical/          ← empty, next priority (VHIS plans)
├── critical-illness/ ← empty
├── life/             ← empty
└── annuity/          ← empty
```

### How to add a new plan
1. Get the insurer's proposal PDF (建議書) — same quote profile: 30M non-smoker, USD $1,300/month, 5Y payment
2. Extract data using `pdftotext` (poppler): `pdftotext "plan.pdf" - | less`
3. Create a JSON file following the schema in `lib/types.ts`
4. Drop it into `data/savings/` (or relevant category folder)
5. UI picks it up automatically — no code changes needed

---

## How to run locally

```bash
cd /Users/book/Documents/insurance-compare
npm run dev
# Opens on http://localhost:3000
```

If port 3000 is busy, Next will choose another port. For production-style visual checks after `npm run build`, use:

```bash
npm run start -- -p 3015
```

Useful commands:

```bash
npm run build:data   # regenerate FWD product JSON from local PDFs
npm run test         # run product data extraction tests
npm run build        # compile and prerender Next.js app
```
