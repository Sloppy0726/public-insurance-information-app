# Insurance Portal Workflow

This repo uses a portal-first extraction workflow for standardized insurance comparison runs.

## Standard Premium Basis

Use the same premium basis inside one comparison group.

- Savings / life-savings single-pay standard: `USD 15,600`
- Savings / life-savings annual standard: `USD 15,600`
- Savings / life-savings monthly standard: `USD 1,300`
- Use user overrides if a run explicitly changes the basis.
- Keep `target_*` standard-basis fields separate from `actual_*` quoted fields when the portal forces a different amount or fixed basis.

Do not backfill annual from monthly or monthly from annual.

## Comparison Buckets

Use these 9 variables for savings / life-savings standard capture:

- `2Y_MONTHLY`
- `2Y_ANNUAL`
- `2Y_SINGLE`
- `5Y_MONTHLY`
- `5Y_ANNUAL`
- `5Y_SINGLE`
- `10Y_MONTHLY`
- `10Y_ANNUAL`
- `10Y_SINGLE`

Standard basis for this workspace:

- `MONTHLY`: `USD 1,300`
- `ANNUAL`: `USD 15,600`
- `SINGLE`: `USD 15,600`

Single-bucket rule for current BOC run:

- Do **not** treat `躉繳` as `一次性供款`.
- Only classify a row into `*_SINGLE` when the proposal explicitly shows `一次性供款` or `一次性繳付` wording with amount.
- If only `躉繳` wording appears, mark the bucket as `NOT_EXPLICIT_SINGLE` and keep it out of standardized single-bucket comparison.
- If the user explicitly asks to complete the 9-grid with single buckets anyway, allow `躉繳` rows to be mapped into `*_SINGLE`, but add a QA note that wording is `躉繳` and term is mapping-based.

## Capture Order

1. FWD first.
2. BOC second.
3. Portal UI first.
4. PDF download only when the portal UI does not expose the required values clearly enough.

## FWD SOP

1. Reuse the live session if it is still valid.
2. Open proposal generation for the requested product.
3. Prefer premium-input mode over sum-assured mode.
4. Capture each available payment mode and payment term directly.
5. Record discount text separately from the standardized comparison premium.
6. Extract yearly values, break-even year, guaranteed values, non-guaranteed values, and year 10 / 20 / 30 milestones.
7. If the product forces a minimum sum assured or minimum premium, mark the row as forced-minimum or out-of-scope instead of pretending it matches the standard basis.

## BOC SOP

1. Reuse the live portal session if available.
2. `新增建議書` -> confirm applicant -> select insured.
3. Step 2 `設計險種`:
   - choose category
   - choose product
   - open `險種信息`
   - set currency
   - set payment mode
   - set payment-term unit
   - set payment term
   - set coverage-term unit
   - set coverage term
   - input standard premium
4. Confirm the total premium updates before trying to advance.
5. Extract values from the portal results screen first. Use PDF only if the results screen is incomplete.
6. On output settings / discount selector, run both:
   - normal proposal output
   - preferred-customer discount output (優選客戶)
7. Keep standard premium target unchanged for comparison, and store discount as separate fields.

### BOC Preferred-Customer Discount Rule

For products where output options include first-year premium discount codes (for example:
`3GAL2512` normal campaign and `3GPC2512` preferred-customer campaign), always capture both versions.

Required discount capture fields:

- `discount_available`
- `discount_code`
- `discount_description`
- `discount_scope` (for this campaign: `FIRST_YEAR_PREMIUM`)
- `premium_before_discount`
- `premium_after_discount`
- `discount_amount`
- `discount_rate`
- `discount_currency`

Comparison rule:

- `targetPremium` stays on the standardized basis (`USD 1,300` / `USD 15,600` / standard single rule).
- Do not replace standardized premium with discounted premium.
- Show discounted payable amount as a separate column/note.

### Confirmed BOC modal state from 2026-05-12

For `精選目標五年保險計劃` in the captured session:

- category: `儲蓄壽險`
- product code: `IBE65`
- currency: `人民幣`
- payment mode: `年繳`
- payment term: `2`
- coverage term: `5`
- standard comparison target: `USD 15,600`
- premium input used in the live BOC session: `15600`
- displayed total premium: `人民幣 15600`

### Current BOC blocker

As of `2026-05-12`, portal session can expire mid-run with `請使用正常的方式登錄系統`.
When this appears, capture can continue only after login restoration.

### VHIS Standardization (Current Run)

- Target fixed amount (if portal supports amount input): `127,400`
- Apply to VHIS comparisons as `target_sum_assured`.
- If a VHIS plan does not support editable sum assured (common for indemnity medical plans), keep a normalized premium basis and mark `sum_assured_not_settable`.

## Medical / CI Rule

Do not assume medical or critical illness products have no savings component. Check for:

- cash value
- surrender value
- maturity value
- refund of premium
- policy value table

If any of those exist, populate the relevant structured value tables instead of classifying the plan as pure protection.

## Session And Login Handling

- Prefer continuing an authenticated session instead of re-logging.
- If the session expires, resume from the insurer landing flow and note the interruption in QA.
- If OTP, ADFS, password reset, or other human-only login steps appear, stop and record a blocker rather than guessing.
- If browser-control tooling drops mid-run, resume from the last confirmed bucket state and continue in this order: interrupted bucket first, then remaining buckets in sequence.
- For BOC specifically, if login page requires captcha or manual credentials, mark `blocked_waiting_login_restore` and preserve the exact next bucket queue so the run can continue immediately after login recovery.

## Required Outputs Per Quote

- exact payment mode and payment term
- standard target premium
- actual quoted premium
- preferred-customer discount fields when available
- break-even year/date if shown or derivable from the yearly value table
- guaranteed values
- non-guaranteed values
- year 10 / 20 / 30 milestones where available
- discount info kept separately from the standard premium basis
- QA note when the portal forced a fixed basis or minimum

## Comparison Hygiene

- Do not mix inferred values with actual quoted values in the same comparison table.
- Remove or de-emphasize older inventory-only views once standard-capture rows exist.
- Rank or compare only after the row has real quote data or an explicit QA label.
