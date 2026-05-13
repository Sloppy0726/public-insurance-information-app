import fs from 'node:fs';
import path from 'node:path';

export type CaptureStatusGroup = 'comparable' | 'fixed_basis' | 'out_of_scope' | 'unavailable' | 'other';

export type CaptureCurvePoint = {
  year: number;
  age: number;
  totalPaid: number;
  guaranteedCashValue: number;
  reversionaryBonusCashValue: number;
  terminalBonusCashValue: number;
  totalSurrenderValue: number;
  surrenderToPaidPct: number;
  guaranteedToPaidPct: number;
};

export type CaptureRow = {
  id: string;
  captureDate: string;
  insurer: string;
  productFamilyId: string;
  productNameZh: string;
  category: string;
  comparisonBucket: string;
  paymentMode: string;
  paymentTermYears: number | null;
  targetPremium: number | null;
  targetTotalPremium: number | null;
  actualPremium: number | null;
  actualTotalPremium: number | null;
  notionalAmount: number | null;
  levyPerPayment: number | null;
  premiumCurrency: string | null;
  discountAvailable: boolean | null;
  discountRate: number | null;
  discountAmount: number | null;
  discountCurrency: string | null;
  premiumBeforeDiscount: number | null;
  premiumAfterDiscount: number | null;
  totalPremiumBeforeDiscount: number | null;
  totalDiscountOverPaymentTerm: number | null;
  discountSource: string | null;
  discountBasis: string | null;
  discountInferredNote: string | null;
  status: string;
  statusGroup: CaptureStatusGroup;
  comparable: boolean;
  pdfFile: string | null;
  notes: string;
  curve: CaptureCurvePoint[];
  year10SurrenderToPaidPct: number | null;
  year20SurrenderToPaidPct: number | null;
  year30SurrenderToPaidPct: number | null;
  breakevenYear: number | null;
};

export type CaptureSummary = {
  key: string;
  productFamilyId?: string;
  productNameZh?: string;
  category?: string;
  comparisonBucket?: string;
  totalRows: number;
  comparableRows: number;
  fixedBasisRows: number;
  outOfScopeRows: number;
  unavailableRows: number;
  rowsWithCurve: number;
};

export type FwdStandardCaptureData = {
  rows: CaptureRow[];
  productSummaries: CaptureSummary[];
  categorySummaries: CaptureSummary[];
  bucketSummaries: CaptureSummary[];
  stats: {
    totalRows: number;
    comparableRows: number;
    fixedBasisRows: number;
    outOfScopeRows: number;
    unavailableRows: number;
    rowsWithCurve: number;
  };
};

type RawRow = Record<string, string>;

const MANIFEST_FILE = path.join(process.cwd(), 'data', 'fwd-standard-capture', 'manifest.csv');
const FORTUNE_WORLD_BENEFITS_FILE = path.join(
  process.cwd(),
  'data',
  'fwd-standard-capture',
  'benefit-values-fortune-world-ii.csv',
);
const CREATIVE_FORTUNE_BENEFITS_FILE = path.join(
  process.cwd(),
  'data',
  'fwd-standard-capture',
  'benefit-values-creative-fortune-plus.csv',
);
const CREATIVE_FORTUNE_PLUS_II_BENEFITS_FILE = path.join(
  process.cwd(),
  'data',
  'fwd-standard-capture',
  'benefit-values-creative-fortune-plus-ii.csv',
);
const LIFE_SAVINGS_EXAMPLES_BENEFITS_FILE = path.join(
  process.cwd(),
  'data',
  'fwd-standard-capture',
  'benefit-values-life-savings-examples.csv',
);
const INVENTORY_FILE = path.join(process.cwd(), 'data', 'fwd', 'fwd-smart-inventory-2026-05-11.json');
const BENEFIT_FILES = [
  FORTUNE_WORLD_BENEFITS_FILE,
  CREATIVE_FORTUNE_BENEFITS_FILE,
  CREATIVE_FORTUNE_PLUS_II_BENEFITS_FILE,
  LIFE_SAVINGS_EXAMPLES_BENEFITS_FILE,
];

const COMPARABLE_STATUSES = new Set(['STANDARD_MATCH', 'STANDARD_ROUNDED']);

function parseCsv(text: string): RawRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    if (row.some(value => value !== '')) rows.push(row);
  }

  const [headers, ...records] = rows;
  if (!headers) return [];

  return records.map(record => {
    const parsed: RawRow = {};
    headers.forEach((header, index) => {
      parsed[header] = record[index] ?? '';
    });
    return parsed;
  });
}

function readCsv(filePath: string) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function asNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusGroup(status: string): CaptureStatusGroup {
  if (COMPARABLE_STATUSES.has(status)) return 'comparable';
  if (status.includes('FIXED_SUM_INSURED') || status.includes('FIXED_BASIS') || status.includes('BASIS_MATCH')) {
    return 'fixed_basis';
  }
  if (status.includes('OUT_OF_SCOPE')) return 'out_of_scope';
  if (status.startsWith('NOT_')) return 'unavailable';
  return 'other';
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

type InventoryBenefitRow = {
  product_family_id?: string;
  product_name_zh?: string;
  category?: string;
  comparison_bucket?: string;
  payment_term_years?: number;
  payment_mode?: string;
  table_type?: string;
  scenario?: string;
  policy_year?: number;
  age?: number | null;
  total_paid?: number;
  guaranteed_cash_value?: number;
  non_guaranteed_reversionary_bonus_cash?: number | null;
  non_guaranteed_special_bonus_cash?: number | null;
  total_surrender_value?: number;
  premium_basis_total_paid?: number;
};

type InventoryBasisRow = {
  product_family_id?: string;
  product_name_zh?: string;
  category?: string;
  comparison_bucket?: string;
  payment_term_years?: number;
  payment_mode?: string;
  basis_amount?: number;
  premium_amount?: number;
  levy?: number | null;
  total_premium_paid?: number;
  sum_assured?: number | null;
  notional_amount?: number | null;
  basis_note?: string;
};

type InventoryAll40Row = {
  workbook_product_family_id?: string;
  product_name_zh?: string;
  category?: string;
  comparison_bucket?: string;
  requested_payment_term_years?: number;
  requested_payment_mode?: string;
  premium_amount?: number;
  total_premium_paid_for_requested_term?: number;
  levy?: number | null;
  input_basis_amount?: number | null;
  input_basis_type?: string;
  all40_status?: string;
  premium_currency?: string;
  return_data_status?: string;
};

type InventoryStandardComparisonRow = {
  product_name_zh?: string;
  product_name?: string;
  category?: string;
  comparison_bucket?: string;
  payment_term_years?: number;
  payment_mode?: string;
  currency?: string;
  premium_amount?: number;
  total_premium_paid?: number;
  levy?: number | null;
  sum_insured?: number | null;
  source_file?: string;
  source_quality?: string;
  standard_note?: string;
  extraction_note?: string;
};

type InventoryData = {
  benefit_values?: InventoryBenefitRow[];
  basis_checked_quotes?: InventoryBasisRow[];
  all_40_quote_matrix?: InventoryAll40Row[];
  standard_comparison?: InventoryStandardComparisonRow[];
  premium_options?: Array<{
    product_family_id?: string;
    comparison_bucket?: string;
    payment_mode?: string;
    premium_currency?: string;
    discount_available?: boolean | null;
    discount_rate?: number | null;
    discount_amount?: number | null;
    discount_currency?: string;
    premium_before_discount?: number | null;
    premium_after_discount?: number | null;
    total_premium_paid_before_discount?: number | null;
    total_discount_over_payment_term?: number | null;
    discount_source?: string;
    discount_basis?: string;
    discount_inferred_note?: string;
  }>;
};

function benefitKey(pdfFile: string | null) {
  return pdfFile ?? '';
}

function readBenefitCurves() {
  const groups = new Map<string, CaptureCurvePoint[]>();

  BENEFIT_FILES.forEach(filePath => {
    readCsv(filePath).forEach(row => {
      const pdfFile = row.pdf_file;
      if (!pdfFile) return;

      const year = asNumber(row.policy_year);
      const age = asNumber(row.age);
      const totalPaid = asNumber(row.total_paid);
      const guaranteedCashValue = asNumber(row.guaranteed_cash_value);
      const reversionaryBonusCashValue = asNumber(row.reversionary_bonus_cash_value);
      const terminalBonusCashValue = asNumber(row.terminal_bonus_cash_value);
      const totalSurrenderValue = asNumber(row.total_surrender_value);
      const surrenderToPaidPct = asNumber(row.surrender_to_paid_pct);
      const guaranteedToPaidPct = asNumber(row.guaranteed_to_paid_pct);

      if (
        year == null
        || age == null
        || totalPaid == null
        || guaranteedCashValue == null
        || reversionaryBonusCashValue == null
        || terminalBonusCashValue == null
        || totalSurrenderValue == null
        || surrenderToPaidPct == null
        || guaranteedToPaidPct == null
      ) {
        return;
      }

      const curve = groups.get(pdfFile) ?? [];
      curve.push({
        year,
        age,
        totalPaid,
        guaranteedCashValue,
        reversionaryBonusCashValue,
        terminalBonusCashValue,
        totalSurrenderValue,
        surrenderToPaidPct,
        guaranteedToPaidPct,
      });
      groups.set(pdfFile, curve);
    });
  });

  groups.forEach(curve => {
    curve.sort((a, b) => a.year - b.year);
  });

  return groups;
}

function inventoryCurvePoints(rows: InventoryBenefitRow[]) {
  return rows
    .filter(row => row.table_type === 'surrender_current' && row.scenario === 'current')
    .map((row): CaptureCurvePoint | null => {
      if (
        row.policy_year == null
        || row.total_paid == null
        || row.guaranteed_cash_value == null
        || row.total_surrender_value == null
        || row.premium_basis_total_paid == null
      ) {
        return null;
      }

      const reversionaryBonusCashValue = row.non_guaranteed_reversionary_bonus_cash ?? 0;
      const terminalBonusCashValue = row.non_guaranteed_special_bonus_cash ?? 0;
      const surrenderToPaidPct = row.premium_basis_total_paid === 0
        ? null
        : row.total_surrender_value / row.premium_basis_total_paid;
      const guaranteedToPaidPct = row.premium_basis_total_paid === 0
        ? null
        : row.guaranteed_cash_value / row.premium_basis_total_paid;

      if (surrenderToPaidPct == null || guaranteedToPaidPct == null) return null;

      return {
        year: row.policy_year,
        age: row.age ?? 0,
        totalPaid: row.total_paid,
        guaranteedCashValue: row.guaranteed_cash_value,
        reversionaryBonusCashValue,
        terminalBonusCashValue,
        totalSurrenderValue: row.total_surrender_value,
        surrenderToPaidPct,
        guaranteedToPaidPct,
      };
    })
    .filter((row): row is CaptureCurvePoint => row != null)
    .sort((a, b) => a.year - b.year);
}

function inventoryFamilyId(row: { product_family_id?: string; workbook_product_family_id?: string; product_name_zh?: string }) {
  return row.product_family_id || row.workbook_product_family_id || `inventory_${slugify(row.product_name_zh ?? 'unknown')}`;
}

function supplementalCaptureRows(): CaptureRow[] {
  const inventory = readJson<InventoryData>(INVENTORY_FILE);
  const benefits = inventory.benefit_values ?? [];
  const basisRows = inventory.basis_checked_quotes ?? [];
  const all40Rows = inventory.all_40_quote_matrix ?? [];
  const standardRows = inventory.standard_comparison ?? [];
  const premiumOptions = inventory.premium_options ?? [];
  const rows: CaptureRow[] = [];

  const premiumOptionByKey = new Map(
    premiumOptions.map(option => [
      [option.product_family_id, option.comparison_bucket, option.payment_mode].join('__'),
      option,
    ]),
  );

  const premiumOptionFor = (productFamilyId: string, comparisonBucket: string, paymentMode: string) =>
    premiumOptionByKey.get([productFamilyId, comparisonBucket, paymentMode].join('__'));

  const benefitCurveFor = (productFamilyId: string, comparisonBucket: string, paymentMode: string, paymentTermYears: number) =>
    inventoryCurvePoints(
      benefits.filter(row =>
        row.product_family_id === productFamilyId
        && row.comparison_bucket === comparisonBucket
        && row.payment_mode === paymentMode
        && row.payment_term_years === paymentTermYears,
      ),
    );

  const pushRow = (row: Omit<CaptureRow, 'year10SurrenderToPaidPct' | 'year20SurrenderToPaidPct' | 'year30SurrenderToPaidPct' | 'breakevenYear' | 'comparable' | 'statusGroup'> & { curve?: CaptureCurvePoint[] }) => {
    const curve = row.curve ?? [];
    const group = statusGroup(row.status);
    rows.push({
      ...row,
      curve,
      statusGroup: group,
      comparable: group === 'comparable',
      year10SurrenderToPaidPct: pointPct(curve, 10),
      year20SurrenderToPaidPct: pointPct(curve, 20),
      year30SurrenderToPaidPct: pointPct(curve, 30),
      breakevenYear: breakevenYear(curve),
    });
  };

  const singlePayTargets = [
    '智優盛儲蓄保險計劃',
    '智盈．超凡保險計劃',
  ];
  basisRows
    .filter(row => singlePayTargets.includes(row.product_name_zh ?? ''))
    .forEach((row, index) => {
      const productFamilyId = inventoryFamilyId(row);
      const curve = benefitCurveFor(productFamilyId, 'OUT_OF_SCOPE', 'SINGLE', 1);
      pushRow({
        id: `${productFamilyId}__OUT_OF_SCOPE__SINGLE__1__inventory_basis_${index}`,
        captureDate: '2026-05-11',
        insurer: 'FWD',
        productFamilyId,
        productNameZh: row.product_name_zh ?? productFamilyId,
        category: row.category ?? 'savings',
        comparisonBucket: 'OUT_OF_SCOPE',
        paymentMode: 'SINGLE',
        paymentTermYears: 1,
        targetPremium: null,
        targetTotalPremium: null,
      actualPremium: row.premium_amount ?? null,
      actualTotalPremium: row.total_premium_paid ?? null,
      notionalAmount: row.sum_assured ?? row.notional_amount ?? null,
      levyPerPayment: row.levy ?? null,
      premiumCurrency: 'USD',
      discountAvailable: false,
      discountRate: null,
      discountAmount: null,
      discountCurrency: null,
      premiumBeforeDiscount: null,
      premiumAfterDiscount: row.premium_amount ?? null,
      totalPremiumBeforeDiscount: row.total_premium_paid ?? null,
      totalDiscountOverPaymentTerm: null,
      discountSource: 'NOT_FOUND',
      discountBasis: null,
      discountInferredNote: null,
      status: 'PDF_EXTRACTED_FROM_INVENTORY_OUT_OF_SCOPE',
      pdfFile: curve[0] ? null : null,
      notes: row.basis_note ?? 'Inventory PDF-backed out-of-scope single-premium row.',
        curve,
      });
    });

  standardRows
    .filter(row => row.product_name_zh === '智盈匯聚(優越版)III壽險計劃' && row.comparison_bucket === 'OUT_OF_SCOPE')
    .forEach((row, index) => {
      const productFamilyId = 'fwd_wealth_harvest_premier_iii';
      const curve = benefitCurveFor(productFamilyId, 'OUT_OF_SCOPE', 'SINGLE', 1);
      pushRow({
        id: `${productFamilyId}__OUT_OF_SCOPE__SINGLE__1__inventory_standard_${index}`,
        captureDate: '2026-05-11',
        insurer: 'FWD',
        productFamilyId,
        productNameZh: row.product_name_zh ?? '智盈匯聚(優越版)III壽險計劃',
        category: row.category ?? 'savings',
        comparisonBucket: 'OUT_OF_SCOPE',
        paymentMode: 'SINGLE',
        paymentTermYears: 1,
        targetPremium: null,
        targetTotalPremium: null,
      actualPremium: row.premium_amount ?? null,
      actualTotalPremium: row.total_premium_paid ?? null,
      notionalAmount: row.sum_insured ?? null,
      levyPerPayment: row.levy ?? null,
      premiumCurrency: row.currency ?? 'USD',
      discountAvailable: false,
      discountRate: null,
      discountAmount: null,
      discountCurrency: null,
      premiumBeforeDiscount: null,
      premiumAfterDiscount: row.premium_amount ?? null,
      totalPremiumBeforeDiscount: row.total_premium_paid ?? null,
      totalDiscountOverPaymentTerm: null,
      discountSource: 'NOT_FOUND',
      discountBasis: null,
      discountInferredNote: null,
      status: 'PDF_EXTRACTED_FROM_INVENTORY_OUT_OF_SCOPE',
      pdfFile: row.source_file ?? null,
      notes: [row.standard_note, row.extraction_note].filter(Boolean).join(' '),
        curve,
      });
    });

  all40Rows
    .filter(row =>
      row.product_name_zh === '盈‧歲悅延期年金計劃'
      && row.all40_status === 'actual_quote'
      && (row.requested_payment_mode === 'ANNUAL' || row.requested_payment_mode === 'MONTHLY'),
    )
    .forEach((row, index) => {
      const productFamilyId = inventoryFamilyId(row);
      const paymentMode = row.requested_payment_mode ?? 'ANNUAL';
      const paymentTermYears = row.requested_payment_term_years ?? 0;
      const comparisonBucket = row.comparison_bucket ?? `${paymentTermYears}Y_${paymentMode}`;
      const curve = benefitCurveFor(productFamilyId, comparisonBucket, paymentMode, paymentTermYears);
      const premiumOption = premiumOptionFor(productFamilyId, comparisonBucket, paymentMode);
      pushRow({
        id: `${productFamilyId}__${comparisonBucket}__${paymentMode}__${paymentTermYears}__inventory_all40_${index}`,
        captureDate: '2026-05-11',
        insurer: 'FWD',
        productFamilyId,
        productNameZh: row.product_name_zh ?? productFamilyId,
        category: 'annuity',
        comparisonBucket,
        paymentMode,
        paymentTermYears,
        targetPremium: null,
        targetTotalPremium: null,
        actualPremium: row.premium_amount ?? null,
        actualTotalPremium: row.total_premium_paid_for_requested_term ?? null,
        notionalAmount: row.input_basis_amount ?? null,
        levyPerPayment: row.levy ?? null,
        premiumCurrency: row.premium_currency ?? 'USD',
        discountAvailable: premiumOption?.discount_available ?? false,
        discountRate: premiumOption?.discount_rate ?? null,
        discountAmount: premiumOption?.discount_amount ?? null,
        discountCurrency: premiumOption?.discount_currency || row.premium_currency || null,
        premiumBeforeDiscount: premiumOption?.premium_before_discount ?? null,
        premiumAfterDiscount: premiumOption?.premium_after_discount ?? row.premium_amount ?? null,
        totalPremiumBeforeDiscount: premiumOption?.total_premium_paid_before_discount ?? null,
        totalDiscountOverPaymentTerm: premiumOption?.total_discount_over_payment_term ?? null,
        discountSource: premiumOption?.discount_source ?? null,
        discountBasis: premiumOption?.discount_basis ?? null,
        discountInferredNote: premiumOption?.discount_inferred_note ?? null,
        status: curve.length > 0 ? 'PDF_JOINED_FIXED_BASIS' : 'PORTAL_UI_FIXED_BASIS',
        pdfFile: null,
        notes: row.return_data_status ?? 'Portal UI confirmed for monthly guaranteed annuity basis.',
        curve,
      });
    });

  return rows;
}

function pointPct(curve: CaptureCurvePoint[], year: number) {
  return curve.find(point => point.year === year)?.surrenderToPaidPct ?? null;
}

function breakevenYear(curve: CaptureCurvePoint[]) {
  return curve.find(point => point.totalSurrenderValue >= point.totalPaid)?.year ?? null;
}

function summarize(rows: CaptureRow[], keyFor: (row: CaptureRow) => string): CaptureSummary[] {
  const groups = new Map<string, CaptureRow[]>();
  rows.forEach(row => {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return [...groups.entries()]
    .map(([key, groupedRows]) => {
      const first = groupedRows[0];
      return {
        key,
        productFamilyId: first?.productFamilyId,
        productNameZh: first?.productNameZh,
        category: first?.category,
        comparisonBucket: first?.comparisonBucket,
        totalRows: groupedRows.length,
        comparableRows: groupedRows.filter(row => row.statusGroup === 'comparable').length,
        fixedBasisRows: groupedRows.filter(row => row.statusGroup === 'fixed_basis').length,
        outOfScopeRows: groupedRows.filter(row => row.statusGroup === 'out_of_scope').length,
        unavailableRows: groupedRows.filter(row => row.statusGroup === 'unavailable').length,
        rowsWithCurve: groupedRows.filter(row => row.curve.length > 0).length,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function loadFwdStandardCaptureData(): FwdStandardCaptureData {
  const benefitCurves = readBenefitCurves();
  const inventory = readJson<InventoryData>(INVENTORY_FILE);
  const premiumOptionByKey = new Map(
    (inventory.premium_options ?? []).map(option => [
      [option.product_family_id, option.comparison_bucket, option.payment_mode].join('__'),
      option,
    ]),
  );
  const manifestRows = readCsv(MANIFEST_FILE).map((row, index): CaptureRow => {
    const pdfFile = row.pdf_file || null;
    const curve = benefitCurves.get(benefitKey(pdfFile)) ?? [];
    const group = statusGroup(row.status);
    const premiumOption = premiumOptionByKey.get([row.product_family_id, row.comparison_bucket, row.payment_mode].join('__'));

    return {
      id: [
        row.product_family_id,
        row.comparison_bucket,
        row.payment_mode,
        row.payment_term_years || 'NA',
        index,
      ].join('__'),
      captureDate: row.capture_date,
      insurer: row.insurer,
      productFamilyId: row.product_family_id,
      productNameZh: row.product_name_zh,
      category: row.category,
      comparisonBucket: row.comparison_bucket,
      paymentMode: row.payment_mode,
      paymentTermYears: asNumber(row.payment_term_years),
      targetPremium: asNumber(row.target_premium),
      targetTotalPremium: asNumber(row.target_total_premium),
      actualPremium: asNumber(row.actual_premium),
      actualTotalPremium: asNumber(row.actual_total_premium_pdf),
      notionalAmount: asNumber(row.notional_amount),
      levyPerPayment: asNumber(row.levy_per_payment),
      premiumCurrency: premiumOption?.premium_currency ?? 'USD',
      discountAvailable: premiumOption?.discount_available ?? false,
      discountRate: asNumber(premiumOption?.discount_rate ?? null),
      discountAmount: asNumber(premiumOption?.discount_amount ?? null),
      discountCurrency: premiumOption?.discount_currency || null,
      premiumBeforeDiscount: asNumber(premiumOption?.premium_before_discount ?? null),
      premiumAfterDiscount: asNumber(premiumOption?.premium_after_discount ?? row.actual_premium),
      totalPremiumBeforeDiscount: asNumber(premiumOption?.total_premium_paid_before_discount ?? null),
      totalDiscountOverPaymentTerm: asNumber(premiumOption?.total_discount_over_payment_term ?? null),
      discountSource: premiumOption?.discount_source ?? null,
      discountBasis: premiumOption?.discount_basis ?? null,
      discountInferredNote: premiumOption?.discount_inferred_note ?? null,
      status: row.status,
      statusGroup: group,
      comparable: group === 'comparable',
      pdfFile,
      notes: row.notes,
      curve,
      year10SurrenderToPaidPct: pointPct(curve, 10),
      year20SurrenderToPaidPct: pointPct(curve, 20),
      year30SurrenderToPaidPct: pointPct(curve, 30),
      breakevenYear: breakevenYear(curve),
    };
  });
  const rows = [...manifestRows, ...supplementalCaptureRows()];

  const stats = {
    totalRows: rows.length,
    comparableRows: rows.filter(row => row.statusGroup === 'comparable').length,
    fixedBasisRows: rows.filter(row => row.statusGroup === 'fixed_basis').length,
    outOfScopeRows: rows.filter(row => row.statusGroup === 'out_of_scope').length,
    unavailableRows: rows.filter(row => row.statusGroup === 'unavailable').length,
    rowsWithCurve: rows.filter(row => row.curve.length > 0).length,
  };

  return {
    rows,
    productSummaries: summarize(rows, row => row.productFamilyId),
    categorySummaries: summarize(rows, row => row.category),
    bucketSummaries: summarize(rows, row => row.comparisonBucket),
    stats,
  };
}
