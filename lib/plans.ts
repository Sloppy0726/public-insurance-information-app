import fs from 'fs';
import path from 'path';
import type { Plan, ProductBatch, ProductSummary, ProductValuePoint } from './types';
import { comparisonBucketLabel, deriveComparisonBucket, normalizePaymentMode, paymentTermBucketFromYears } from './quote-buckets';
import { selectTopComparisonPlans } from './selection';
import { loadFwdStandardCaptureData, type CaptureRow } from './fwd-standard-capture';

export function loadPlans(category: string): Plan[] {
  const dir = path.join(process.cwd(), 'data', category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Plan);
}

const SAVINGS_PRODUCT_CATEGORIES = new Set(['savings', 'life-savings', 'annuity']);

function loadProductBatches(): ProductBatch[] {
  const dir = path.join(process.cwd(), 'data', 'products');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as ProductBatch);
}

function fmtPct(value: number) {
  return Number(value.toFixed(1));
}

function findRow(rows: ProductValuePoint[], year: number) {
  return rows.find(row => row.year === year);
}

function lossForYear(rows: ProductValuePoint[], year: number) {
  const row = findRow(rows, year);
  if (!row || row.total_paid <= 0) return { pct: 0, amount: 0 };
  const amount = Math.max(0, row.total_paid - row.total_surrender);
  return {
    pct: fmtPct((amount / row.total_paid) * 100),
    amount: Math.round(amount),
  };
}

function breakevenYear(rows: ProductValuePoint[], key: 'guaranteed' | 'total_surrender') {
  const row = rows.find(point => point.total_paid > 0 && point[key] >= point.total_paid);
  return row ? `${row.year}年` : '未回本';
}

function valueRatioLabel(row: ProductValuePoint | undefined, key: 'guaranteed' | 'total_surrender') {
  if (!row || row.total_paid <= 0) return '未計';
  return `${fmtPct((row[key] / row.total_paid) * 100)}%`;
}

function productPremium(product: ProductSummary, rows: ProductValuePoint[]) {
  const portalPremium = product.premium?.portal_premium ?? 0;
  const paymentTermYears = product.premium?.payment_term_years ?? 1;
  const maxPaid = Math.max(...rows.map(row => row.total_paid), portalPremium, 0);
  const paymentMode = product.premium?.payment_mode;
  const normalizedMode = normalizePaymentMode(paymentMode);

  return {
    payment_mode: paymentMode,
    actual_premium: portalPremium,
    monthly: normalizedMode === 'MONTHLY' ? portalPremium : 0,
    annual_equivalent: normalizedMode === 'ANNUAL' ? portalPremium : 0,
    payment_term_years: paymentTermYears || 1,
    total_premium_paid: Math.round(maxPaid),
  };
}

function productToSavingsPlan(product: ProductSummary): Plan | null {
  const rows = (product.comparison_value_points ?? [])
    .filter(row => row.year <= 30)
    .sort((a, b) => a.year - b.year);

  if (!SAVINGS_PRODUCT_CATEGORIES.has(product.category) || rows.length < 5) return null;

  const year3Loss = lossForYear(rows, 3);
  const year5Loss = lossForYear(rows, 5);
  const row20 = findRow(rows, 20);
  const premium = productPremium(product, rows);
  const comparisonBucket = deriveComparisonBucket(premium.payment_term_years, premium.payment_mode);
  const paymentModeBucket = normalizePaymentMode(premium.payment_mode);
  const paymentTermBucket = paymentTermBucketFromYears(premium.payment_term_years);
  const nonGuaranteedRatio20 = row20 && row20.total_surrender > 0
    ? Math.max(0, fmtPct(((row20.total_surrender - row20.guaranteed) / row20.total_surrender) * 100))
    : 0;

  return {
    id: `product-${product.id}`,
    company: product.company,
    company_zh: product.company_zh,
    product_name: product.product_name,
    product_name_zh: product.product_name_zh,
    category: product.category,
    category_label: product.category_label,
    comparison_bucket: comparisonBucket,
    payment_term_bucket: paymentTermBucket,
    payment_mode_bucket: paymentModeBucket,
    currency: product.currency,
    quote_profile: product.quote_profile ?? { age: 30, gender: 'M', smoker: false },
    premium,
    policy_term: product.policy_term ?? 'As illustrated',
    surrender_value_table: rows.map(row => ({
      year: row.year,
      total_paid: row.total_paid,
      guaranteed: row.guaranteed,
      total_surrender: row.total_surrender,
    })),
    xray: {
      breakeven_year_guaranteed: breakevenYear(rows, 'guaranteed'),
      breakeven_year_projected: breakevenYear(rows, 'total_surrender'),
      year3_surrender_loss_pct: year3Loss.pct,
      year3_surrender_loss_usd: year3Loss.amount,
      year5_surrender_loss_pct: year5Loss.pct,
      year5_surrender_loss_usd: year5Loss.amount,
      guaranteed_irr_20y: valueRatioLabel(row20, 'guaranteed'),
      projected_irr_20y: valueRatioLabel(row20, 'total_surrender'),
      total_non_guaranteed_ratio_20y: nonGuaranteedRatio20,
    },
    source_pdf: product.source.filename,
    quote_date: product.source.quote_date ?? product.source.download_date,
    source_kind: 'pdf-proposal',
    comparison_basis: `${product.category_label} · ${comparisonBucketLabel(comparisonBucket)} · 實際quote保費比較`,
  };
}

type BocYearlyValue = {
  year: number;
  totalPaid: number;
  guaranteedCashValue: number;
  totalSurrenderValue: number;
};

type BocProposalExtract = {
  capturedAt: string;
  source?: {
    downloadedPdfFile?: string;
  };
  quoteProfile: {
    productCode: string;
    productNameZh: string;
    comparisonBucket?: string;
    currency: string;
    paymentMode: string;
    paymentModeLabel?: string;
    paymentTermYears?: number;
    targetPremium?: number;
    actualPremium?: number;
    sumAssured?: number | null;
  };
  milestones?: {
    policyYear10?: { paidPremium: number; cashValue: { guaranteed: number; total: number } };
    policyYear20?: { paidPremium: number; cashValue: { guaranteed: number; total: number } };
    policyYear30?: { paidPremium: number; cashValue: { guaranteed: number; total: number } };
  };
  yearlyValues?: BocYearlyValue[];
  discountInfo?: {
    discountAvailable?: boolean;
    discountCode?: string;
    discountDescription?: string;
    discountScope?: string;
    premiumBeforeDiscount?: number;
    premiumAfterDiscount?: number;
    discountAmount?: number;
    discountRatePct?: number;
    discountCurrency?: string;
  };
  discount?: {
    promotionCode?: string;
    promotionNameZh?: string;
    basePremiumTotal?: number;
    discountedPremiumTotal?: number;
    discountAmount?: number;
    discountRateApprox?: number;
  };
};

function bocProposalRows(proposal: BocProposalExtract): ProductValuePoint[] {
  const rowsFromYearly = (proposal.yearlyValues ?? [])
    .filter(row => row.year <= 30)
    .map(row => ({
      year: row.year,
      total_paid: row.totalPaid,
      guaranteed: row.guaranteedCashValue,
      total_surrender: row.totalSurrenderValue,
    }))
    .sort((a, b) => a.year - b.year);

  if (rowsFromYearly.length > 0) return rowsFromYearly;

  const rows: ProductValuePoint[] = [];
  const m10 = proposal.milestones?.policyYear10;
  const m20 = proposal.milestones?.policyYear20;
  const m30 = proposal.milestones?.policyYear30;
  if (m10) rows.push({ year: 10, total_paid: m10.paidPremium, guaranteed: m10.cashValue.guaranteed, total_surrender: m10.cashValue.total });
  if (m20) rows.push({ year: 20, total_paid: m20.paidPremium, guaranteed: m20.cashValue.guaranteed, total_surrender: m20.cashValue.total });
  if (m30) rows.push({ year: 30, total_paid: m30.paidPremium, guaranteed: m30.cashValue.guaranteed, total_surrender: m30.cashValue.total });
  return rows;
}

function bocCategoryForProduct(productCode: string): 'savings' | 'life-savings' | 'annuity' | 'other' {
  if (['IBN13', 'IBN14', 'IBN15'].includes(productCode)) return 'annuity';
  if (['IBE66', 'IBN12'].includes(productCode)) return 'savings';
  if (/^IBW\d+$/i.test(productCode)) return 'life-savings';
  return 'other';
}

function loadBocSavingsPlans(): Plan[] {
  const dir = path.join(process.cwd(), 'data', 'boc');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(file => /^boc-ib[a-z0-9]+-.*-proposal-\d{4}-\d{2}-\d{2}\.json$/i.test(file))
    .sort()
    .map(file => {
      const proposal = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as BocProposalExtract;
      const category = bocCategoryForProduct(proposal.quoteProfile.productCode ?? '');
      if (category === 'other') return null;
      const rows = bocProposalRows(proposal);
      if (rows.length < 3) return null;

      const paymentMode = proposal.quoteProfile.paymentMode ?? 'ANNUAL';
      const normalizedMode = normalizePaymentMode(paymentMode);
      if (!normalizedMode) return null;

      const paymentTermYears = proposal.quoteProfile.paymentTermYears ?? 0;
      const actualPremium = proposal.quoteProfile.actualPremium ?? 0;
      const targetPremium = proposal.quoteProfile.targetPremium ?? 0;
      if (targetPremium > 0 && actualPremium > 0) {
        const deviation = Math.abs(actualPremium - targetPremium) / targetPremium;
        // Keep only rows that stay close to the declared standard premium basis.
        if (deviation > 0.05) return null;
      }
      const annualEquivalent = normalizedMode === 'ANNUAL'
        ? actualPremium
        : normalizedMode === 'MONTHLY'
          ? Number((actualPremium * 12).toFixed(2))
          : actualPremium;
      const row20 = findRow(rows, 20);
      const year3Loss = lossForYear(rows, 3);
      const year5Loss = lossForYear(rows, 5);
      const comparisonBucket = proposal.quoteProfile.comparisonBucket ?? deriveComparisonBucket(paymentTermYears, normalizedMode);
      const discount = proposal.discountInfo
        ? {
            discount_available: Boolean(proposal.discountInfo.discountAvailable),
            discount_code: proposal.discountInfo.discountCode ?? null,
            discount_description: proposal.discountInfo.discountDescription ?? null,
            discount_scope: proposal.discountInfo.discountScope ?? null,
            premium_before_discount: proposal.discountInfo.premiumBeforeDiscount ?? null,
            premium_after_discount: proposal.discountInfo.premiumAfterDiscount ?? null,
            discount_amount: proposal.discountInfo.discountAmount ?? null,
            discount_rate_pct: proposal.discountInfo.discountRatePct ?? null,
            discount_currency: proposal.discountInfo.discountCurrency ?? null,
          }
        : proposal.discount
          ? {
              discount_available: typeof proposal.discount.discountAmount === 'number' ? proposal.discount.discountAmount > 0 : false,
              discount_code: proposal.discount.promotionCode ?? null,
              discount_description: proposal.discount.promotionNameZh ?? null,
              discount_scope: 'FIRST_YEAR_PREMIUM',
              premium_before_discount: proposal.discount.basePremiumTotal ?? null,
              premium_after_discount: proposal.discount.discountedPremiumTotal ?? null,
              discount_amount: proposal.discount.discountAmount ?? null,
              discount_rate_pct: typeof proposal.discount.discountRateApprox === 'number'
                ? Number((proposal.discount.discountRateApprox * 100).toFixed(4))
                : null,
              discount_currency: proposal.quoteProfile.currency ?? null,
            }
          : undefined;

      return {
        id: `boc-${proposal.quoteProfile.productCode}-${comparisonBucket}`.toLowerCase(),
        company: 'BOC Life',
        company_zh: '中銀人壽',
        product_name: 'Global Whole Life Insurance Legacy Series',
        product_name_zh: proposal.quoteProfile.productNameZh,
        category,
        category_label: category === 'annuity' ? '年金' : (category === 'savings' ? '儲蓄' : '終身儲蓄'),
        comparison_bucket: comparisonBucket,
        payment_term_bucket: paymentTermBucketFromYears(paymentTermYears),
        payment_mode_bucket: normalizedMode,
        currency: proposal.quoteProfile.currency ?? 'USD',
        quote_profile: { age: 46, gender: 'M', smoker: false },
        premium: {
          payment_mode: normalizedMode,
          actual_premium: actualPremium,
          monthly: normalizedMode === 'MONTHLY' ? actualPremium : 0,
          annual_equivalent: annualEquivalent,
          payment_term_years: paymentTermYears,
          total_premium_paid: Math.max(...rows.map(row => row.total_paid), 0),
        },
        discount_info: discount,
        policy_term: 'Whole life',
        surrender_value_table: rows.map(row => ({
          year: row.year,
          total_paid: row.total_paid,
          guaranteed: row.guaranteed,
          total_surrender: row.total_surrender,
        })),
        xray: {
          breakeven_year_guaranteed: breakevenYear(rows, 'guaranteed'),
          breakeven_year_projected: breakevenYear(rows, 'total_surrender'),
          year3_surrender_loss_pct: year3Loss.pct,
          year3_surrender_loss_usd: year3Loss.amount,
          year5_surrender_loss_pct: year5Loss.pct,
          year5_surrender_loss_usd: year5Loss.amount,
          guaranteed_irr_20y: valueRatioLabel(row20, 'guaranteed'),
          projected_irr_20y: valueRatioLabel(row20, 'total_surrender'),
          total_non_guaranteed_ratio_20y: row20 && row20.total_surrender > 0
            ? Math.max(0, fmtPct(((row20.total_surrender - row20.guaranteed) / row20.total_surrender) * 100))
            : 0,
        },
        source_pdf: proposal.source?.downloadedPdfFile,
        quote_date: proposal.capturedAt,
        source_kind: 'pdf-proposal',
        comparison_basis: `${comparisonBucketLabel(comparisonBucket)} · BOC portal proposal`,
      } as Plan;
    })
    .filter((plan): plan is Plan => Boolean(plan));
}

function captureRowToPlan(row: CaptureRow): Plan | null {
  if (!['savings', 'life-savings', 'annuity'].includes(row.category)) return null;
  if (!row.curve || row.curve.length < 5) return null;

  const normalizedMode = normalizePaymentMode(row.paymentMode);
  if (!normalizedMode) return null;

  const paymentTermYears = row.paymentTermYears ?? 0;
  const comparisonBucket = row.comparisonBucket || deriveComparisonBucket(paymentTermYears, normalizedMode);
  const actualPremium = row.actualPremium ?? 0;
  const annualEquivalent = normalizedMode === 'MONTHLY' ? Number((actualPremium * 12).toFixed(2)) : actualPremium;
  const curveRows = row.curve
    .filter(point => point.year <= 30)
    .map(point => ({
      year: point.year,
      total_paid: point.totalPaid,
      guaranteed: point.guaranteedCashValue,
      total_surrender: point.totalSurrenderValue,
    }));
  const row20 = findRow(curveRows, 20);
  const year3Loss = lossForYear(curveRows, 3);
  const year5Loss = lossForYear(curveRows, 5);

  const comparisonBasis = row.statusGroup === 'comparable'
    ? `${comparisonBucketLabel(comparisonBucket)} · 標準保費`
    : `${comparisonBucketLabel(comparisonBucket)} · ${row.statusGroup}`;

  return {
    id: `fwd-capture-${row.id}`,
    company: row.insurer,
    company_zh: row.insurer === 'FWD' ? '富衛' : row.insurer,
    product_name: row.productFamilyId,
    product_name_zh: row.productNameZh,
    category: row.category,
    category_label: row.category === 'annuity' ? '年金' : '儲蓄',
    comparison_bucket: comparisonBucket,
    payment_term_bucket: paymentTermBucketFromYears(paymentTermYears),
    payment_mode_bucket: normalizedMode,
    currency: row.premiumCurrency ?? 'USD',
    quote_profile: { age: 30, gender: 'M', smoker: false },
    premium: {
      payment_mode: normalizedMode,
      actual_premium: row.actualPremium ?? undefined,
      monthly: normalizedMode === 'MONTHLY' ? actualPremium : 0,
      annual_equivalent: annualEquivalent,
      payment_term_years: paymentTermYears,
      total_premium_paid: Math.max(...row.curve.map(point => point.totalPaid), 0),
    },
    discount_info: {
      discount_available: Boolean(row.discountAvailable),
      discount_code: row.discountBasis ?? null,
      discount_description: row.discountInferredNote ?? null,
      discount_scope: row.discountSource ?? null,
      premium_before_discount: row.premiumBeforeDiscount,
      premium_after_discount: row.premiumAfterDiscount,
      discount_amount: row.discountAmount,
      discount_rate_pct: row.discountRate,
      discount_currency: row.discountCurrency,
    },
    policy_term: 'As illustrated',
        surrender_value_table: row.curve
          .filter(point => point.year <= 30)
          .map(point => ({
            year: point.year,
            total_paid: point.totalPaid,
            guaranteed: point.guaranteedCashValue,
            total_surrender: point.totalSurrenderValue,
          })),
        xray: {
          breakeven_year_guaranteed: breakevenYear(curveRows, 'guaranteed'),
          breakeven_year_projected: breakevenYear(curveRows, 'total_surrender'),
          year3_surrender_loss_pct: year3Loss.pct,
          year3_surrender_loss_usd: year3Loss.amount,
          year5_surrender_loss_pct: year5Loss.pct,
          year5_surrender_loss_usd: year5Loss.amount,
      guaranteed_irr_20y: row20 && row20.total_paid > 0 ? `${fmtPct((row20.guaranteed / row20.total_paid) * 100)}%` : '未計',
      projected_irr_20y: row20 && row20.total_paid > 0 ? `${fmtPct((row20.total_surrender / row20.total_paid) * 100)}%` : '未計',
      total_non_guaranteed_ratio_20y: row20 && row20.total_surrender > 0
        ? Math.max(0, fmtPct(((row20.total_surrender - row20.guaranteed) / row20.total_surrender) * 100))
        : 0,
    },
    source_pdf: row.pdfFile ?? undefined,
    quote_date: row.captureDate,
    source_kind: 'pdf-proposal',
    comparison_basis: comparisonBasis,
  };
}

function loadFwdCapturePlans(): Plan[] {
  const captureData = loadFwdStandardCaptureData();
  return captureData.rows
    .map(captureRowToPlan)
    .filter((plan): plan is Plan => Boolean(plan));
}

export function loadSavingsComparisonPlans(): Plan[] {
  const samplePlans = loadPlans('savings').map(plan => {
    const paymentMode = plan.premium.payment_mode ?? 'MONTHLY';
    const comparisonBucket = deriveComparisonBucket(plan.premium.payment_term_years, paymentMode);
    return {
      ...plan,
      id: `sample-${plan.company}-${plan.product_name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category_label: '儲蓄',
      comparison_bucket: comparisonBucket,
      payment_term_bucket: paymentTermBucketFromYears(plan.premium.payment_term_years),
      payment_mode_bucket: normalizePaymentMode(paymentMode),
      premium: {
        ...plan.premium,
        payment_mode: paymentMode,
        actual_premium: paymentMode === 'MONTHLY' ? plan.premium.monthly : plan.premium.annual_equivalent,
      },
      source_kind: 'sample-json' as const,
      comparison_basis: `${comparisonBucketLabel(comparisonBucket)} · 樣本PDF實際quote保費比較`,
    };
  });
  const productPlans = loadProductBatches()
    .flatMap(batch => batch.products)
    .map(productToSavingsPlan)
    .filter((plan): plan is Plan => Boolean(plan));
  const bocPlans = loadBocSavingsPlans();
  const fwdCapturePlans = loadFwdCapturePlans();

  return selectTopComparisonPlans([...samplePlans, ...productPlans, ...bocPlans, ...fwdCapturePlans], {
    limitPerGroup: 6,
  });
}
