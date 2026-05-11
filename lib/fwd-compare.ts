import fs from 'node:fs';
import path from 'node:path';

type ProductRow = {
  product_family_id: string;
  product_name?: string;
  product_name_zh?: string;
};

type StandardComparisonRow = {
  standard_case_group?: string;
  standard_status?: string;
  can_form_standard_cohort?: boolean;
  product_name_zh?: string;
  product_name?: string;
  category?: string;
  comparison_bucket?: string;
  payment_term_years?: number;
  payment_mode?: string;
  currency?: string;
  requested_input_type?: string;
  requested_input_amount?: number;
  actual_basis_amount?: number;
  basis_delta?: number;
  premium_amount?: number;
  levy?: number;
  premium_with_levy?: number;
  annualized_premium?: number;
  total_premium_paid?: number;
  sum_insured?: number;
  death_benefit?: number;
  cash_value_available?: boolean;
  benefit_value_rows?: number;
  breakeven_year_projected?: number;
  year_10_surrender_to_paid_pct?: number;
  year_20_surrender_to_paid_pct?: number;
  year_30_surrender_to_paid_pct?: number;
  latest_policy_year?: number;
  latest_surrender_to_paid_pct?: number;
  source_quality?: string;
  source_file?: string;
  standard_note?: string;
  extraction_note?: string;
};

type BenefitValueRow = {
  product_family_id?: string;
  product_name_zh?: string;
  comparison_bucket?: string;
  payment_term_years?: number;
  payment_mode?: string;
  table_type?: string;
  scenario?: string;
  policy_year?: number;
  total_paid?: number;
  guaranteed_cash_value?: number;
  total_surrender_value?: number;
  surrender_to_paid_pct?: number;
  guaranteed_to_paid_pct?: number;
};

type FwdInventory = {
  products: ProductRow[];
  standard_comparison?: StandardComparisonRow[];
  benefit_values: BenefitValueRow[];
};

export type FwdCurvePoint = {
  year: number;
  totalPaid: number;
  guaranteedCashValue: number;
  totalSurrenderValue: number;
  surrenderToPaidPct: number;
  guaranteedToPaidPct: number;
};

export type FwdCompareRow = {
  id: string;
  productFamilyId: string;
  productName: string;
  productNameZh: string;
  category: string;
  standardCaseGroup: string | null;
  comparisonBucket: string;
  paymentTermYears: number | null;
  paymentMode: string;
  currency: string;
  premiumAmount: number | null;
  premiumWithLevy: number | null;
  annualizedPremium: number | null;
  totalPremiumPaid: number | null;
  requestedInputType: string | null;
  requestedInputAmount: number | null;
  actualBasisAmount: number | null;
  comparisonBasisType: 'CONSUMER_PREMIUM_BUDGET' | 'PROTECTION_SUM_INSURED' | 'UNCLASSIFIED';
  targetPremiumAmount: number | null;
  targetTotalPremiumPaid: number | null;
  budgetMeasureAmount: number | null;
  budgetDeltaAmount: number | null;
  budgetDeltaPct: number | null;
  budgetFit: boolean;
  comparable: boolean;
  exclusionReason: string | null;
  standardStatus: string | null;
  sourceQuality: string | null;
  sourceFile: string | null;
  standardNote: string | null;
  extractionNote: string | null;
  benefitValueRows: number;
  breakevenYearProjected: number | null;
  year10SurrenderToPaidPct: number | null;
  year20SurrenderToPaidPct: number | null;
  year30SurrenderToPaidPct: number | null;
  latestPolicyYear: number | null;
  latestSurrenderToPaidPct: number | null;
  curve: FwdCurvePoint[];
};

export type FwdCompareData = {
  rows: FwdCompareRow[];
  stats: {
    totalRows: number;
    rowsWithPremium: number;
    rowsWithCurve: number;
    rowsWith20YearReturn: number;
    comparableRows: number;
    consumerBudgetRows: number;
    budgetExcludedRows: number;
  };
};

const INVENTORY_FILE = path.join(process.cwd(), 'data', 'fwd', 'fwd-smart-inventory-2026-05-11.json');
const WEALTH_CATEGORIES = new Set(['savings', 'life-savings', 'annuity']);
const PROTECTION_CATEGORIES = new Set(['critical-illness', 'life']);
const TARGET_ANNUAL_PREMIUM = 15600;
const TARGET_MONTHLY_PREMIUM = 1300;
const BUDGET_TOLERANCE_PCT = 0.1;
const SINGLE_TOTAL_BUDGETS: Record<string, number> = {
  '2Y_SINGLE': TARGET_ANNUAL_PREMIUM * 2,
  '5Y_SINGLE': TARGET_ANNUAL_PREMIUM * 5,
  '10Y_SINGLE': TARGET_ANNUAL_PREMIUM * 10,
};

function readInventory(): FwdInventory {
  return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8')) as FwdInventory;
}

function normalizeName(value: string | undefined) {
  return (value ?? '').replace(/\s+/g, '').toLowerCase();
}

function asNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rowId(row: StandardComparisonRow, productFamilyId: string, index: number) {
  return [
    productFamilyId,
    row.comparison_bucket ?? 'UNKNOWN',
    row.payment_mode ?? 'UNKNOWN',
    row.payment_term_years ?? 'NA',
    index,
  ].join('__');
}

function buildProductMap(products: ProductRow[]) {
  const byName = new Map<string, ProductRow>();
  products.forEach(product => {
    byName.set(normalizeName(product.product_name_zh), product);
    byName.set(normalizeName(product.product_name), product);
  });
  return byName;
}

function curveKey(productFamilyId: string, bucket: string | undefined, paymentMode: string | undefined) {
  return `${productFamilyId}__${bucket ?? 'UNKNOWN'}__${paymentMode ?? 'UNKNOWN'}`;
}

function buildCurveMap(benefitValues: BenefitValueRow[]) {
  const groups = new Map<string, FwdCurvePoint[]>();

  benefitValues
    .filter(row => row.table_type === 'surrender_current' && row.scenario === 'current')
    .forEach(row => {
      if (!row.product_family_id || !row.policy_year) return;
      const totalPaid = asNumber(row.total_paid);
      const totalSurrender = asNumber(row.total_surrender_value);
      if (totalPaid == null || totalSurrender == null || totalPaid <= 0) return;

      const key = curveKey(row.product_family_id, row.comparison_bucket, row.payment_mode);
      const curve = groups.get(key) ?? [];
      curve.push({
        year: row.policy_year,
        totalPaid,
        guaranteedCashValue: asNumber(row.guaranteed_cash_value) ?? 0,
        totalSurrenderValue: totalSurrender,
        surrenderToPaidPct: (asNumber(row.surrender_to_paid_pct) ?? totalSurrender / totalPaid) * 100,
        guaranteedToPaidPct: (asNumber(row.guaranteed_to_paid_pct) ?? ((asNumber(row.guaranteed_cash_value) ?? 0) / totalPaid)) * 100,
      });
      groups.set(key, curve);
    });

  groups.forEach(curve => {
    curve.sort((a, b) => a.year - b.year);
  });

  return groups;
}

function targetForConsumerBudget(row: StandardComparisonRow) {
  const paymentMode = row.payment_mode;
  const bucket = row.comparison_bucket ?? '';

  if (paymentMode === 'ANNUAL') {
    return {
      targetPremiumAmount: TARGET_ANNUAL_PREMIUM,
      targetTotalPremiumPaid: null,
      budgetMeasureAmount: asNumber(row.premium_amount),
    };
  }

  if (paymentMode === 'MONTHLY') {
    return {
      targetPremiumAmount: TARGET_MONTHLY_PREMIUM,
      targetTotalPremiumPaid: null,
      budgetMeasureAmount: asNumber(row.premium_amount),
    };
  }

  if (paymentMode === 'SINGLE') {
    const targetTotalPremiumPaid = SINGLE_TOTAL_BUDGETS[bucket] ?? null;
    return {
      targetPremiumAmount: null,
      targetTotalPremiumPaid,
      budgetMeasureAmount: asNumber(row.total_premium_paid),
    };
  }

  return {
    targetPremiumAmount: null,
    targetTotalPremiumPaid: null,
    budgetMeasureAmount: null,
  };
}

function classifyComparisonBasis(row: StandardComparisonRow) {
  const category = row.category ?? 'unknown';
  const premiumAmount = asNumber(row.premium_amount);

  if (WEALTH_CATEGORIES.has(category)) {
    const target = targetForConsumerBudget(row);
    const targetAmount = target.targetPremiumAmount ?? target.targetTotalPremiumPaid;

    if (targetAmount == null) {
      return {
        comparisonBasisType: 'CONSUMER_PREMIUM_BUDGET' as const,
        targetPremiumAmount: target.targetPremiumAmount,
        targetTotalPremiumPaid: target.targetTotalPremiumPaid,
        budgetMeasureAmount: target.budgetMeasureAmount,
        budgetDeltaAmount: null,
        budgetDeltaPct: null,
        budgetFit: false,
        comparable: false,
        exclusionReason: 'No consumer budget target is defined for this payment bucket.',
      };
    }

    if (target.budgetMeasureAmount == null) {
      return {
        comparisonBasisType: 'CONSUMER_PREMIUM_BUDGET' as const,
        targetPremiumAmount: target.targetPremiumAmount,
        targetTotalPremiumPaid: target.targetTotalPremiumPaid,
        budgetMeasureAmount: null,
        budgetDeltaAmount: null,
        budgetDeltaPct: null,
        budgetFit: false,
        comparable: false,
        exclusionReason: 'No premium was extracted for the consumer budget target.',
      };
    }

    const budgetDeltaAmount = target.budgetMeasureAmount - targetAmount;
    const budgetDeltaPct = budgetDeltaAmount / targetAmount;
    const budgetFit = Math.abs(budgetDeltaPct) <= BUDGET_TOLERANCE_PCT;

    return {
      comparisonBasisType: 'CONSUMER_PREMIUM_BUDGET' as const,
      targetPremiumAmount: target.targetPremiumAmount,
      targetTotalPremiumPaid: target.targetTotalPremiumPaid,
      budgetMeasureAmount: target.budgetMeasureAmount,
      budgetDeltaAmount,
      budgetDeltaPct,
      budgetFit,
      comparable: budgetFit,
      exclusionReason: budgetFit
        ? null
        : `Premium is ${(budgetDeltaPct * 100).toFixed(1)}% away from the consumer budget target.`,
    };
  }

  if (PROTECTION_CATEGORIES.has(category)) {
    return {
      comparisonBasisType: 'PROTECTION_SUM_INSURED' as const,
      targetPremiumAmount: null,
      targetTotalPremiumPaid: null,
      budgetMeasureAmount: premiumAmount,
      budgetDeltaAmount: null,
      budgetDeltaPct: null,
      budgetFit: true,
      comparable: row.requested_input_type === 'sum_insured' && asNumber(row.actual_basis_amount) != null,
      exclusionReason: row.requested_input_type === 'sum_insured' ? null : 'Protection products require a fixed coverage amount basis.',
    };
  }

  return {
    comparisonBasisType: 'UNCLASSIFIED' as const,
    targetPremiumAmount: null,
    targetTotalPremiumPaid: null,
    budgetMeasureAmount: premiumAmount,
    budgetDeltaAmount: null,
    budgetDeltaPct: null,
    budgetFit: false,
    comparable: false,
    exclusionReason: 'Product category is not mapped to a comparison standard.',
  };
}

export function loadFwdCompareData(): FwdCompareData {
  const inventory = readInventory();
  const productMap = buildProductMap(inventory.products);
  const curveMap = buildCurveMap(inventory.benefit_values);
  const rows = (inventory.standard_comparison ?? [])
    .map((row, index): FwdCompareRow | null => {
      const product = productMap.get(normalizeName(row.product_name_zh)) ?? productMap.get(normalizeName(row.product_name));
      const productFamilyId = product?.product_family_id;
      if (!productFamilyId || !row.product_name_zh) return null;

      const bucket = row.comparison_bucket ?? 'UNKNOWN';
      const paymentMode = row.payment_mode ?? 'UNKNOWN';
      const curve = curveMap.get(curveKey(productFamilyId, bucket, paymentMode)) ?? [];
      const basis = classifyComparisonBasis(row);

      return {
        id: rowId(row, productFamilyId, index),
        productFamilyId,
        productName: row.product_name ?? product.product_name ?? row.product_name_zh,
        productNameZh: row.product_name_zh,
        category: row.category ?? 'unknown',
        standardCaseGroup: row.standard_case_group ?? null,
        comparisonBucket: bucket,
        paymentTermYears: asNumber(row.payment_term_years),
        paymentMode,
        currency: row.currency ?? 'USD',
        premiumAmount: asNumber(row.premium_amount),
        premiumWithLevy: asNumber(row.premium_with_levy),
        annualizedPremium: asNumber(row.annualized_premium),
        totalPremiumPaid: asNumber(row.total_premium_paid),
        requestedInputType: row.requested_input_type ?? null,
        requestedInputAmount: asNumber(row.requested_input_amount),
        actualBasisAmount: asNumber(row.actual_basis_amount),
        ...basis,
        standardStatus: row.standard_status ?? null,
        sourceQuality: row.source_quality ?? null,
        sourceFile: row.source_file ?? null,
        standardNote: row.standard_note ?? null,
        extractionNote: row.extraction_note ?? null,
        benefitValueRows: asNumber(row.benefit_value_rows) ?? 0,
        breakevenYearProjected: asNumber(row.breakeven_year_projected),
        year10SurrenderToPaidPct: asNumber(row.year_10_surrender_to_paid_pct),
        year20SurrenderToPaidPct: asNumber(row.year_20_surrender_to_paid_pct),
        year30SurrenderToPaidPct: asNumber(row.year_30_surrender_to_paid_pct),
        latestPolicyYear: asNumber(row.latest_policy_year),
        latestSurrenderToPaidPct: asNumber(row.latest_surrender_to_paid_pct),
        curve,
      };
    })
    .filter((row): row is FwdCompareRow => row !== null)
    .sort((a, b) => {
      const curveDiff = Number(b.curve.length > 0) - Number(a.curve.length > 0);
      if (curveDiff !== 0) return curveDiff;
      const returnDiff = (b.year20SurrenderToPaidPct ?? -1) - (a.year20SurrenderToPaidPct ?? -1);
      if (returnDiff !== 0) return returnDiff;
      return a.productNameZh.localeCompare(b.productNameZh, 'zh-Hant');
    });

  return {
    rows,
    stats: {
      totalRows: rows.length,
      rowsWithPremium: rows.filter(row => row.premiumAmount != null).length,
      rowsWithCurve: rows.filter(row => row.curve.length > 0).length,
      rowsWith20YearReturn: rows.filter(row => row.year20SurrenderToPaidPct != null).length,
      comparableRows: rows.filter(row => row.comparable).length,
      consumerBudgetRows: rows.filter(row => row.comparisonBasisType === 'CONSUMER_PREMIUM_BUDGET' && row.budgetFit).length,
      budgetExcludedRows: rows.filter(row => row.comparisonBasisType === 'CONSUMER_PREMIUM_BUDGET' && !row.budgetFit).length,
    },
  };
}
