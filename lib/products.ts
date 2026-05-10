import fs from 'node:fs';
import path from 'node:path';
import type {
  MedicalPlan,
  Plan,
  ProductBatch,
  ProductCatalog,
  ProductSource,
  ProductSummary,
} from './types';

type RawGeneratedProduct = Omit<ProductSummary, 'source' | 'data_quality'> & {
  source: Omit<ProductSource, 'kind'>;
};

type RawProductBatch = Omit<ProductBatch, 'products'> & {
  products: RawGeneratedProduct[];
};

const CATEGORY_LABELS: Record<string, string> = {
  savings: '儲蓄',
  'life-savings': '人壽儲蓄',
  life: '人壽',
  'critical-illness': '危疾',
  annuity: '年金',
  medical: '醫療',
};

const CATEGORY_ORDER = [
  'savings',
  'life-savings',
  'life',
  'critical-illness',
  'annuity',
  'medical',
];

function readJsonFiles<T>(folder: string): T[] {
  const dir = path.join(process.cwd(), 'data', folder);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as T);
}

function slugify(...parts: Array<string | undefined>) {
  const slug = parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || parts.filter(Boolean).join('-').replace(/\s+/g, '-');
}

function toGeneratedProduct(product: RawGeneratedProduct): ProductSummary {
  const warnings = [
    product.source.notes,
    product.source.text_extractable === false ? 'PDF text extraction returned no readable text.' : undefined,
    (product.metrics?.value_point_count ?? product.value_points?.length ?? 0) < 5
      ? 'Extracted value table is sparse and should be manually checked against the PDF.'
      : undefined,
  ].filter(Boolean) as string[];

  return {
    ...product,
    category_label: product.category_label ?? CATEGORY_LABELS[product.category] ?? product.category,
    source: {
      ...product.source,
      kind: 'pdf-proposal',
    },
    data_quality: {
      level: 'raw-pdf-extract',
      summary: 'FWD proposal PDF parsed locally from the downloaded batch. Money fields are ready for demo view, but tables still need human QA.',
      warnings: warnings.length ? warnings : undefined,
    },
  };
}

function loadGeneratedBatches(): ProductBatch[] {
  return readJsonFiles<RawProductBatch>('products').map(batch => ({
    ...batch,
    products: batch.products.map(toGeneratedProduct),
  }));
}

function savingsToProduct(plan: Plan): ProductSummary {
  const nominalAmount = (plan as Plan & { nominal_amount?: number }).nominal_amount ?? null;

  return {
    id: `seed-savings-${slugify(plan.company, plan.product_name)}`,
    company: plan.company,
    company_zh: plan.company_zh,
    product_name: plan.product_name,
    product_name_zh: plan.product_name_zh,
    category: 'savings',
    category_label: CATEGORY_LABELS.savings,
    currency: plan.currency,
    quote_profile: plan.quote_profile,
    premium: {
      payment_mode: 'MONTHLY',
      monthly: plan.premium.monthly,
      monthly_with_levy: plan.premium.monthly_with_levy,
      annual_equivalent: plan.premium.annual_equivalent,
      total_premium_paid: plan.premium.total_premium_paid,
      payment_term_years: plan.premium.payment_term_years,
    },
    sum_insured: nominalAmount,
    policy_term: plan.policy_term,
    metrics: {
      year3_surrender_loss_pct: plan.xray.year3_surrender_loss_pct,
      year3_surrender_loss_usd: plan.xray.year3_surrender_loss_usd,
      year5_surrender_loss_pct: plan.xray.year5_surrender_loss_pct,
      year5_surrender_loss_usd: plan.xray.year5_surrender_loss_usd,
      guaranteed_irr: plan.xray.guaranteed_irr_20y,
      projected_irr: plan.xray.projected_irr_20y,
      value_point_count: plan.surrender_value_table.length,
    },
    value_points: plan.surrender_value_table.map(row => ({
      year: row.year,
      total_paid: row.total_paid,
      guaranteed: row.guaranteed,
      total_surrender: row.total_surrender,
    })),
    source: {
      kind: 'sample-json',
      filename: plan.source_pdf,
      quote_date: plan.quote_date,
      notes: 'Existing app sample plan used for the first savings comparison view.',
    },
    data_quality: {
      level: 'sample-proposal',
      summary: 'Structured sample already used by the savings comparison page.',
    },
  };
}

function medicalToProduct(plan: MedicalPlan): ProductSummary {
  return {
    id: `seed-medical-${slugify(plan.company, plan.product_name)}`,
    company: plan.company,
    company_zh: plan.company_zh,
    product_name: plan.product_name,
    product_name_zh: plan.product_name_zh,
    category: 'medical',
    category_label: CATEGORY_LABELS.medical,
    currency: plan.currency,
    quote_profile: plan.quote_profile,
    premium: {
      payment_mode: 'ANNUAL',
      annual_equivalent: plan.annual_premium_by_age[String(plan.quote_profile.age)],
    },
    annual_limit: plan.annual_limit,
    lifetime_limit: plan.lifetime_limit,
    deductible: plan.deductible,
    room_class: plan.room_class,
    plan_type: plan.plan_type,
    policy_term: `Guaranteed renewal to age ${plan.guaranteed_renewal_age}`,
    metrics: {
      value_point_count: Object.keys(plan.annual_premium_by_age).length,
    },
    source: {
      kind: 'official-public-dataset',
      name: plan.source_dataset.name,
      url: plan.source_dataset.url,
      last_updated: plan.source_dataset.last_updated,
      quote_date: plan.source_dataset.premium_effective_date,
      notes: plan.notes?.join(' '),
    },
    data_quality: {
      level: 'official-public-data',
      summary: 'Public VHIS premium seed data; benefit limits still need deeper modelling before a medical comparison launch.',
    },
  };
}

function countByCategory(products: ProductSummary[]) {
  return products.reduce<Record<string, number>>((counts, product) => {
    counts[product.category] = (counts[product.category] ?? 0) + 1;
    return counts;
  }, {});
}

export function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export function getCategorySortIndex(category: string) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function loadProductCatalog(): ProductCatalog {
  const batches = loadGeneratedBatches();
  const generatedProducts = batches.flatMap(batch => batch.products);
  const savingsProducts = readJsonFiles<Plan>('savings').map(savingsToProduct);
  const medicalProducts = readJsonFiles<MedicalPlan>('medical').map(medicalToProduct);
  const products = [...generatedProducts, ...savingsProducts, ...medicalProducts].sort((a, b) => {
    const categoryDiff = getCategorySortIndex(a.category) - getCategorySortIndex(b.category);
    if (categoryDiff !== 0) return categoryDiff;
    return `${a.company_zh}${a.product_name_zh}`.localeCompare(`${b.company_zh}${b.product_name_zh}`, 'zh-Hant');
  });

  return {
    products,
    batches,
    stats: {
      total: products.length,
      fwdProposalCount: generatedProducts.length,
      savingsSeedCount: savingsProducts.length,
      medicalSeedCount: medicalProducts.length,
      byCategory: countByCategory(products),
    },
  };
}
