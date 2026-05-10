---
name: insurance-plan-extraction
description: Use when extracting Hong Kong insurance proposal PDFs, brochures, Excel files, or insurer illustrations into structured data for the insurance comparison app. Covers savings, life-savings, annuity, medical/VHIS, critical illness, and life products, with special focus on payment mode, payment term, guaranteed/non-guaranteed values, and source traceability.
---

# Insurance Plan Extraction

## Goal

Extract insurer documents into clean tabular data that the app can compare without rereading every PDF. The output should make payment structure, yearly values, and source pages explicit.

Never infer product quality or recommend a product. Extract facts only.

## Required Output Shape

Prefer Excel/CSV with these sheets. If writing JSON, keep the same structure.

1. `products`: one row per product variant/quote.
2. `premium_options`: one row per payment option for that product.
3. `benefit_values`: one row per policy year per scenario/table.
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

Redact customer names. `VIP VIP` is acceptable as a dummy profile marker.

## Payment Fields

Payment data is mandatory. Do not compare plans without it.

Treat these payment variants as separate quote variants, not as one product row:

- Monthly pay, e.g. `MONTHLY` with 12 payments per year.
- Annual pay, e.g. `ANNUAL` with 1 payment per year.
- 2-year pay, usually annual premium for 2 policy years.
- 5-year pay, usually annual premium for 5 policy years.
- 10-year pay, usually annual premium for 10 policy years.
- Single premium, `SINGLE`, payment term = 1.

If the insurer provides the same product under several payment terms, create separate `premium_options` rows and separate comparison variants. The app cannot compare correctly if 2-pay, 5-pay, and 10-pay are collapsed.

In `premium_options`, extract:

- `payment_mode`: `MONTHLY`, `ANNUAL`, `SINGLE`, `QUARTERLY`, `SEMI_ANNUAL`
- `premium_amount`: actual premium for that mode
- `premium_currency`
- `levy`
- `premium_with_levy`
- `payment_term_years`: `1`, `2`, `5`, `10`, `15`, `20`, `25`, `30`, `whole-life`, or exact value from PDF
- `payment_frequency_per_year`: monthly = 12, annual = 1, single = 1
- `annualized_premium`: monthly premium x 12, annual premium as-is, single premium as-is
- `total_premium_paid`: cumulative paid by end of payment term
- `minimum_premium_adjusted`: true if the portal forced a higher premium than requested
- `input_amount_type`: `premium`, `sum_insured`, `annuity_income`, etc.
- `input_amount`

The comparison app needs both the actual payment mode and a normalized annual/monthly equivalent. Do not throw away the original mode.

## Savings And Life-Savings

For savings/life-savings, the key comparison table is the yearly surrender value table.

In `benefit_values`, extract one row per policy year:

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

- Limit to max 3 products per `insurer + category`.
- Rank candidate products by `year20 total_surrender_value / total_paid`; fallback to year30, year10, then year5.
- Deduplicate near-identical product names before applying the limit.
- Keep product library pages broader; only comparison views should be limited.
- Label the basis clearly: payment mode, payment term, quote profile, and whether values are raw PDF extract or manually QA'd.

## Recommended Workflow

1. Extract PDF text with layout preserved.
2. Identify product category and payment mode first.
3. Fill `products` and `premium_options`.
4. Extract detailed yearly tables into `benefit_values`.
5. Extract category-specific benefit sheets.
6. Compute derived percentages.
7. Add QA rows for ambiguity.
8. Only then import into the app/database.

Do not collapse monthly, annual, and single premium into one field. Keep originals and normalized values.
