---
name: insurance-plan-extraction
description: Use when extracting Hong Kong insurance proposal PDFs, brochures, Excel files, or insurer illustrations into structured data for the insurance comparison app. Covers savings, life-savings, annuity, medical/VHIS, critical illness, and life products, with special focus on 2/5/10-year payment terms, monthly/annual/full-pay modes, payment discounts, guaranteed/non-guaranteed values, and source traceability.
---

# Insurance Plan Extraction

## Goal

Extract insurer documents into clean tabular data that the app can compare without rereading every PDF. The output should make payment structure, yearly values, and source pages explicit.

Never infer product quality or recommend a product. Extract facts only.

## Required Output Shape

Prefer Excel/CSV with these sheets. If writing JSON, keep the same structure.

1. `products`: one row per product family or named plan.
2. `premium_options`: one row per quote/SKU variant: product x payment term x payment mode.
3. `benefit_values`: one row per quote/SKU variant x policy year x scenario/table.
4. `medical_benefits`: only for VHIS/medical products.
5. `ci_life_benefits`: only for critical illness/life products.
6. `extraction_qa`: extraction warnings, missing fields, confidence, source page.

Every row must include `source_file`, `source_page`, and `raw_label` when possible.

## Core Product Fields

Extract these for every plan:

- `insurer`
- `insurer_zh`
- `product_name`
- `product_name_zh`
- `category`: `savings`, `life-savings`, `annuity`, `medical`, `critical-illness`, `life`
- `currency`
- `quote_date`
- `source_file`
- `source_page_count`
- `quote_profile_age`
- `quote_profile_gender`
- `quote_profile_smoker`
- `policy_term`
- `coverage_term`
- `sum_insured` or `nominal_amount`
- `plan_variant`: e.g. 2-pay, 5-pay, 10-pay, single premium, standard/flexi
- `product_family_id`: stable ID for the product before payment-term/mode split

Redact customer names. `VIP VIP` is acceptable as a dummy profile marker.

## Payment Fields

Payment data is mandatory. Do not compare plans without it.

Treat payment variants as separate quote/SKU variants, not as one product row. For savings, life-savings, and annuity comparison, extract these nine buckets whenever the source provides them:

| Bucket | Meaning |
| --- | --- |
| `2Y_MONTHLY` | 2-year payment term, monthly premium |
| `2Y_ANNUAL` | 2-year payment term, annual premium |
| `2Y_SINGLE` | 2-year payment term paid upfront/full-pay, if offered |
| `5Y_MONTHLY` | 5-year payment term, monthly premium |
| `5Y_ANNUAL` | 5-year payment term, annual premium |
| `5Y_SINGLE` | 5-year payment term paid upfront/full-pay, if offered |
| `10Y_MONTHLY` | 10-year payment term, monthly premium |
| `10Y_ANNUAL` | 10-year payment term, annual premium |
| `10Y_SINGLE` | 10-year payment term paid upfront/full-pay, if offered |

If the insurer provides the same product under several payment terms or payment modes, create separate `premium_options` rows and separate `benefit_values` rows for each variant. The app cannot compare correctly if 2-pay, 5-pay, 10-pay, monthly, annual, and full-pay are collapsed.

When the source is an insurer portal or quote UI, select/click each available payment-term and payment-mode combination and extract the actual quote result for that combination. Do not create `5Y_MONTHLY` from `5Y_ANNUAL`, do not divide annual premium into a monthly equivalent, and do not fill missing full-pay data from monthly/annual data.

For `*_SINGLE` buckets, keep `payment_term_years` as `2`, `5`, or `10` when the source is a 2/5/10-year payment-term variant paid upfront. Set `payment_term_years = 1` only for a true single-premium product with no 2/5/10 payment-term basis.

If the source has payment terms outside 2/5/10 years, still extract them with the exact term, but set `comparison_bucket = OUT_OF_SCOPE` unless the user adds that term to the comparison UI. Do not force a 3-year, 6-year, 8-year, 12-year, or whole-life pay plan into a 2/5/10 bucket.

In `premium_options`, extract:

- `variant_sku`: stable unique ID, e.g. `fwd_wealth_archive_5y_annual_hkd_age35_m`
- `product_family_id`
- `comparison_bucket`: one of the nine bucket IDs above, or `OUT_OF_SCOPE`
- `payment_term_bucket`: `2Y`, `5Y`, `10Y`, or exact other term
- `payment_mode_bucket`: `MONTHLY`, `ANNUAL`, `SINGLE`
- `payment_mode`: `MONTHLY`, `ANNUAL`, `SINGLE`, `QUARTERLY`, `SEMI_ANNUAL`
- `premium_amount`: actual premium for that mode
- `premium_currency`
- `levy`
- `premium_with_levy`
- `payment_term_years`: `1`, `2`, `5`, `10`, `15`, `20`, `25`, `30`, `whole-life`, or exact value from PDF
- `payment_frequency_per_year`: monthly = 12, annual = 1, single = 1
- `annualized_premium`: optional cash-flow check only; monthly premium x 12, annual premium as-is, null for full-pay/single unless the source gives an annualized figure
- `total_premium_paid_before_discount`: cumulative gross premium by end of payment term, before discount/rebate
- `total_premium_paid`: cumulative paid by end of payment term after known discount/rebate
- `minimum_premium_adjusted`: true if the portal forced a higher premium than requested
- `input_amount_type`: `premium`, `sum_insured`, `annuity_income`, etc.
- `input_amount`

The comparison app needs the actual premium from the exact payment mode and payment term. Do not throw away the original mode, and do not use converted monthly/annual equivalents as substitute quote data.

## Discount Fields

Discount extraction is mandatory for annual pay and full-pay/single-pay variants. If the PDF, portal output, brochure, or illustration mentions any discount, rebate, modal factor, prepayment discount, promotion, loyalty discount, or full-pay concession, capture it in `premium_options`.

Extract:

- `discount_available`: true/false
- `discount_type`: `ANNUAL_PAY`, `FULL_PAY`, `SINGLE_PREMIUM`, `PREPAYMENT`, `MODAL_FACTOR`, `PROMOTION`, `LOYALTY`, `OTHER`
- `discount_rate`: percentage if shown
- `discount_amount`: amount if shown
- `discount_currency`
- `discount_applies_to`: premium, levy, first year, all years, payment term, single upfront amount, etc.
- `premium_before_discount`
- `premium_after_discount`
- `total_discount_over_payment_term`
- `discount_basis`: short explanation of the source wording or formula
- `discount_source`: `EXPLICIT`, `NOT_FOUND`, or `INFERRED_QA_ONLY`
- `discount_source_page`
- `discount_raw_label`
- `discount_inferred_note`: optional QA note when extracted raw monthly/annual/full-pay quotes imply a difference, but the source does not explicitly call it a discount

Do not invent a discount. If no discount is shown, set `discount_available = false`, `discount_source = NOT_FOUND`, and keep discount amount/rate fields null. If separately extracted raw quotes show annual/full-pay is cheaper than monthly, record that only in `discount_inferred_note` with `discount_source = INFERRED_QA_ONLY`; do not populate official discount rate/amount unless the source explicitly states it.

## Savings And Life-Savings

For savings/life-savings, the key comparison table is the yearly surrender value table.

In `benefit_values`, extract one row per policy year:

- `variant_sku`
- `product_family_id`
- `comparison_bucket`
- `payment_term_years`
- `payment_mode`
- `table_type`: `surrender_current`, `surrender_pessimistic`, `surrender_optimistic`, `death_current`, `death_pessimistic`, `death_optimistic`
- `scenario`: `current`, `guaranteed_only`, `pessimistic`, `optimistic`
- `policy_year`
- `age`
- `total_paid`
- `guaranteed_cash_value`
- `non_guaranteed_reversionary_bonus_cash`
- `non_guaranteed_annual_bonus_cash`
- `non_guaranteed_special_bonus_cash`
- `non_guaranteed_terminal_bonus_cash`
- `total_non_guaranteed_cash`
- `total_surrender_value`
- `guaranteed_death_benefit`
- `non_guaranteed_death_benefit`
- `total_death_benefit`
- `premium_basis_total_paid`: must match the same `variant_sku`, after known discount/rebate

Important extraction rules:

- Use the detailed yearly table headed like `於各保單年度終結時之保單價值` when available.
- Keep surrender value and death benefit tables separate. Do not mix death benefit totals into surrender value.
- Keep current/base scenario separate from pessimistic/optimistic scenarios.
- If a table has both cash value and face value, cash value is used for surrender comparison.
- Preserve all years available, not only year 1/5/10/20/30.
- Mark rows as `qa_warning` if table parsing is sparse, duplicated, or has impossible values.

Derived fields useful for comparison:

- `surrender_to_paid_pct = total_surrender_value / total_paid`
- `guaranteed_to_paid_pct = guaranteed_cash_value / total_paid`
- `non_guaranteed_ratio = total_non_guaranteed_cash / total_surrender_value`
- `breakeven_year_projected`: first year total surrender >= total paid
- `breakeven_year_guaranteed`: first year guaranteed cash value >= total paid

## Annuity

For annuity products, extract both accumulation and payout information.

Product/premium fields:

- `deferment_period_years`
- `annuity_period_years`
- `annuity_start_age`
- `annuity_payment_mode`: monthly/annual
- `premium_payment_term_years`

Annuity income fields:

- `monthly_guaranteed_annuity`
- `monthly_non_guaranteed_annuity`
- `monthly_total_annuity`
- `annual_guaranteed_annuity`
- `annual_non_guaranteed_annuity`
- `withdrawal_assumption`: e.g. withdraw all monthly annuity, accumulate dividends, leave in policy
- `guaranteed_irr`
- `projected_irr`

Yearly `benefit_values` still need:

- yearly total paid
- guaranteed cash/surrender value
- non-guaranteed cash/surrender value
- total surrender value
- death benefit if shown

## Medical / VHIS

For medical/VHIS, extract a benefit matrix instead of surrender values.

In `medical_benefits`, extract:

- `plan_type`: VHIS Standard, VHIS Flexi, ward, semi-private, private
- `certification_no`
- `annual_premium_by_age`
- `premium_gender`
- `premium_smoker_status`
- `deductible`
- `annual_limit`
- `lifetime_limit`
- `room_class`
- `guaranteed_renewal_age`
- `tax_deductible`
- `outpatient_cover`
- `pre_post_confinement_cover`
- `day_case_cover`
- `cancer_treatment_limit`
- `psychiatric_limit`
- `geographic_coverage`
- `network_restriction`

If using public VHIS data, keep dataset name, URL, effective date, and last updated date.

## Critical Illness And Life

In `ci_life_benefits`, extract:

- `sum_insured`
- `premium_payment_term_years`
- `coverage_term`
- `covered_condition_count`
- `early_stage_payout_pct`
- `major_stage_payout_pct`
- `multiple_claim_allowed`
- `claim_reset_period`
- `cancer_recurrence_cover`
- `death_benefit`
- `maturity_benefit`
- `cash_value_available`
- `surrender_value_table_available`
- `waiver_of_premium`
- `juvenile_cover`
- `waiting_period`

If the CI/life product has surrender values, also populate `benefit_values`.

## QA Rules

Add a row to `extraction_qa` when:

- Any required payment field is missing.
- Any required bucket field is missing for savings/life-savings/annuity.
- Annual-pay or full-pay discount text exists but discount fields are empty.
- `benefit_values.variant_sku` does not match a row in `premium_options`.
- The table has fewer than 5 usable yearly rows.
- `total_surrender_value` is lower than every listed component or higher than an obvious death benefit table.
- Yearly rows are duplicated from multiple scenarios and cannot be separated.
- The PDF text extraction has broken columns.
- Premium in manifest differs from PDF premium.
- A portal minimum premium adjustment happened.

Use `qa_status`: `ok`, `needs_review`, or `blocked`.

The app should only rank rows with `qa_status = ok` or carefully labelled `needs_review`. Never rank `blocked`.

## Comparison Selection Rules

For comparison pages:

- Compare only within the same `category + comparison_bucket + quote profile + currency`. Do not compare `2Y_MONTHLY` against `5Y_ANNUAL` or `10Y_SINGLE`.
- Limit to max 2 products per `insurer + category + comparison_bucket`.
- Rank candidate products by `year20 total_surrender_value / total_paid`; fallback to year30, year10, then year5.
- Deduplicate near-identical product names before applying the limit.
- Keep product library pages broader; only comparison views should be limited.
- Label the basis clearly: payment mode, payment term, quote profile, and whether values are raw PDF extract or manually QA'd.

## Recommended Workflow

1. Extract PDF text with layout preserved.
2. Identify product category, product family, quote profile, payment terms, and payment modes first.
3. For portal/interactive sources, click or select every available 2/5/10-year x monthly/annual/full-pay combination and capture the actual quote result.
4. Create one `premium_options` row per quote/SKU variant and assign `variant_sku`.
5. Assign one of the nine comparison buckets, or `OUT_OF_SCOPE`.
6. Extract annual-pay/full-pay discounts before calculating total paid.
7. Extract detailed yearly tables into `benefit_values`, keyed by the same `variant_sku`.
8. Extract category-specific benefit sheets.
9. Compute derived percentages using the matching variant's after-discount `total_premium_paid`.
10. Add QA rows for ambiguity.
11. Only then import into the app/database.

Do not collapse monthly, annual, full-pay/single premium, 2-year pay, 5-year pay, and 10-year pay into one field. Keep original quote values, bucket IDs, and discount evidence.
