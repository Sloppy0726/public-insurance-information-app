import fs from 'fs';
import path from 'path';
import type { Plan, ProductBatch, ProductSummary, ProductValuePoint } from './types';
import { selectTopComparisonPlans } from './selection';

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
  const isAnnual = product.premium?.payment_mode === 'ANNUAL';
  const annualEquivalent = isAnnual ? portalPremium : portalPremium;

  return {
    payment_mode: product.premium?.payment_mode,
    monthly: annualEquivalent / 12,
    annual_equivalent: annualEquivalent,
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
    currency: product.currency,
    quote_profile: product.quote_profile ?? { age: 30, gender: 'M', smoker: false },
    premium: productPremium(product, rows),
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
    quote_date: product.source.download_date,
    source_kind: 'pdf-proposal',
    comparison_basis: `${product.category_label} · ${product.premium?.payment_mode === 'SINGLE' ? '一次性保費' : '年繳保費'} · 退保價值以已供保費百分比比較`,
  };
}

export function loadSavingsComparisonPlans(): Plan[] {
  const samplePlans = loadPlans('savings').map(plan => ({
    ...plan,
    id: `sample-${plan.company}-${plan.product_name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category_label: '儲蓄',
    source_kind: 'sample-json' as const,
    comparison_basis: '月供 USD 1,300 左右 · 5年供 · 退保價值以已供保費百分比比較',
  }));
  const productPlans = loadProductBatches()
    .flatMap(batch => batch.products)
    .map(productToSavingsPlan)
    .filter((plan): plan is Plan => Boolean(plan));

  return selectTopComparisonPlans([...samplePlans, ...productPlans]);
}
