import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

type ProductRow = {
  product_family_id: string;
  product_name?: string;
  product_name_zh?: string;
  category?: string;
  currency?: string;
  quote_date?: string;
  policy_term?: string;
  coverage_term?: string;
  source_file?: string;
  portal_pid?: string;
};

type PremiumOptionRow = {
  product_family_id?: string;
  comparison_bucket?: string;
  payment_term_bucket?: string;
  payment_mode_bucket?: string;
  payment_mode?: string;
  premium_amount?: number | null;
  premium_currency?: string;
  discount_available?: boolean | string | null;
  discount_rate?: number | null;
  discount_amount?: number | null;
  standard_status?: string;
};

type QuoteMatrixRow = {
  product_family_id?: string;
  product_name_zh?: string;
  category?: string;
  comparison_bucket?: string;
  payment_term_bucket?: string;
  payment_mode_bucket?: string;
  quote_status?: string;
  standard_status?: string;
  actual_quote_found?: boolean;
  needs_portal_quote?: boolean;
  premium_amount?: number | null;
  premium_currency?: string;
  discount_source?: string;
  source_file?: string;
  notes?: string;
};

type All40QuoteMatrixRow = {
  portal_pid?: string;
  product_name_zh?: string;
  product_kind?: string;
  comparison_bucket?: string;
  all40_status?: string;
  premium_amount?: number | null;
  premium_currency?: string;
};

type BenefitValueRow = {
  product_family_id?: string;
  variant_sku?: string;
  comparison_bucket?: string;
  policy_year?: number | null;
};

type QaRow = {
  qa_status?: string;
  issue_type?: string;
  product_family_id?: string;
  variant_sku?: string;
  message?: string;
  source_file?: string;
  source_page?: number | string;
};

type InventoryData = {
  products: ProductRow[];
  premium_options: PremiumOptionRow[];
  quote_matrix: QuoteMatrixRow[];
  all_40_product_summary?: Array<{
    portal_pid?: string;
    product_name_zh?: string;
    product_kind?: string;
    matrix_rows?: number;
    actual_quote_rows?: number;
    not_offered_or_no_premium_rows?: number;
    error_rows?: number;
  }>;
  all_40_quote_matrix?: All40QuoteMatrixRow[];
  benefit_values: BenefitValueRow[];
  extraction_qa: QaRow[];
  _metadata?: {
    source_folder?: string;
    source_json?: string;
    source_xlsx?: string;
    sanitized?: boolean;
    redaction_rule?: string;
  };
};

type ProductSummary = ProductRow & {
  premiumOptionCount: number;
  quoteCount: number;
  actualQuoteCount: number;
  benefitRowCount: number;
  qaCount: number;
  bucketCount: number;
  discountCount: number;
};

const INVENTORY_FILE = path.join(process.cwd(), 'data', 'fwd', 'fwd-smart-inventory-2026-05-11.json');
const CORE_TERMS = ['2Y', '5Y', '10Y'];
const CORE_MODES = ['MONTHLY', 'ANNUAL', 'SINGLE'];
const CATEGORY_LABELS: Record<string, string> = {
  savings: '儲蓄',
  'life-savings': '人壽儲蓄',
  life: '人壽',
  'critical-illness': '危疾',
  annuity: '年金',
};
const QUOTE_STATUS_TONE: Record<string, string> = {
  ACTUAL_PORTAL_CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ACTUAL_PDF_EXTRACTED: 'border-blue-200 bg-blue-50 text-blue-700',
  NOT_OFFERED_IN_PORTAL: 'border-slate-200 bg-slate-50 text-slate-600',
  OBSERVED_OUT_OF_SCOPE: 'border-amber-200 bg-amber-50 text-amber-700',
};

function loadInventory(): InventoryData {
  return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8')) as InventoryData;
}

function countBy<T>(rows: T[], getKey: (row: T) => string | undefined | null) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const key = getKey(row) || 'UNKNOWN';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function formatMoney(amount?: number | null, currency?: string) {
  if (amount == null || Number.isNaN(amount)) return '未有';
  const digits = Math.abs(amount) >= 1000 ? 0 : 2;
  return `${currency ? `${currency} ` : ''}${amount.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits === 2 ? 2 : 0,
  })}`;
}

function statusLabel(status?: string) {
  if (!status) return 'UNKNOWN';
  return status.replaceAll('_', ' ');
}

function categoryLabel(category?: string) {
  if (!category) return '未分類';
  return CATEGORY_LABELS[category] ?? category;
}

function bucketLabel(bucket: string) {
  const [term, mode] = bucket.split('_');
  const modeLabel = mode === 'MONTHLY' ? '月供' : mode === 'ANNUAL' ? '年供' : mode === 'SINGLE' ? '一次性' : mode;
  return `${term} ${modeLabel}`;
}

function productSummaries(data: InventoryData): ProductSummary[] {
  const premiumByProduct = countBy(data.premium_options, row => row.product_family_id);
  const quoteByProduct = countBy(data.quote_matrix, row => row.product_family_id);
  const actualByProduct = countBy(
    data.quote_matrix.filter(row => row.actual_quote_found),
    row => row.product_family_id
  );
  const benefitByProduct = countBy(data.benefit_values, row => row.product_family_id);
  const qaByProduct = countBy(data.extraction_qa, row => row.product_family_id);
  const bucketsByProduct = data.quote_matrix.reduce<Record<string, Set<string>>>((groups, row) => {
    const productId = row.product_family_id || 'UNKNOWN';
    groups[productId] = groups[productId] ?? new Set<string>();
    if (row.comparison_bucket) groups[productId].add(row.comparison_bucket);
    return groups;
  }, {});
  const discountByProduct = countBy(
    data.premium_options.filter(row => Boolean(row.discount_available || row.discount_rate || row.discount_amount)),
    row => row.product_family_id
  );

  return data.products
    .map(product => ({
      ...product,
      premiumOptionCount: premiumByProduct[product.product_family_id] ?? 0,
      quoteCount: quoteByProduct[product.product_family_id] ?? 0,
      actualQuoteCount: actualByProduct[product.product_family_id] ?? 0,
      benefitRowCount: benefitByProduct[product.product_family_id] ?? 0,
      qaCount: qaByProduct[product.product_family_id] ?? 0,
      bucketCount: bucketsByProduct[product.product_family_id]?.size ?? 0,
      discountCount: discountByProduct[product.product_family_id] ?? 0,
    }))
    .sort((a, b) => {
      const categoryDiff = categoryLabel(a.category).localeCompare(categoryLabel(b.category), 'zh-Hant');
      if (categoryDiff !== 0) return categoryDiff;
      return (a.product_name_zh ?? a.product_name ?? '').localeCompare(b.product_name_zh ?? b.product_name ?? '', 'zh-Hant');
    });
}

function BucketCard({ bucket, rows }: { bucket: string; rows: QuoteMatrixRow[] }) {
  const actualRows = rows.filter(row => row.actual_quote_found);
  const needsPortal = rows.filter(row => row.needs_portal_quote).length;
  const notOffered = rows.filter(row => row.quote_status === 'NOT_OFFERED_IN_PORTAL').length;
  const statuses = countBy(rows, row => row.quote_status);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-950">{bucketLabel(bucket)}</h3>
          <p className="mt-1 text-xs text-slate-500">{rows.length} rows · {actualRows.length} actual quote</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
          actualRows.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {actualRows.length}/{rows.length}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md bg-slate-50 px-2 py-2">
          <p className="font-black text-slate-900">{needsPortal}</p>
          <p className="mt-0.5 text-slate-500">待報價</p>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-2">
          <p className="font-black text-slate-900">{notOffered}</p>
          <p className="mt-0.5 text-slate-500">未提供</p>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-2">
          <p className="font-black text-slate-900">{Object.keys(statuses).length}</p>
          <p className="mt-0.5 text-slate-500">狀態</p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, count }: { status: string; count: number }) {
  return (
    <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${QUOTE_STATUS_TONE[status] ?? 'border-slate-200 bg-white text-slate-600'}`}>
      {statusLabel(status)} {count}
    </span>
  );
}

export default function FwdInventoryPage() {
  const data = loadInventory();
  const summaries = productSummaries(data);
  const categoryCounts = countBy(data.products, row => row.category);
  const quoteStatuses = countBy(data.quote_matrix, row => row.quote_status);
  const standardStatuses = countBy(data.quote_matrix, row => row.standard_status);
  const quoteBuckets = countBy(data.quote_matrix, row => row.comparison_bucket);
  const all40Rows = data.all_40_quote_matrix ?? [];
  const all40Summary = data.all_40_product_summary ?? [];
  const all40Statuses = countBy(all40Rows, row => row.all40_status);
  const actualQuoteRows = data.quote_matrix.filter(row => row.actual_quote_found);
  const all40ActualRows = all40Rows.filter(row => row.all40_status === 'actual_quote');
  const discountRows = data.premium_options.filter(row => Boolean(row.discount_available || row.discount_rate || row.discount_amount));
  const benefitVariants = new Set(data.benefit_values.map(row => row.variant_sku).filter(Boolean)).size;
  const coreBuckets = CORE_TERMS.flatMap(term => CORE_MODES.map(mode => `${term}_${mode}`));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                返回首頁
              </Link>
              <h1 className="mt-2 text-2xl font-black tracking-normal">FWD SMART Inventory</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                呢頁讀取 repo 入面 sanitised FWD Excel/JSON，檢查產品、九格供款條件、quote matrix、benefit rows 同 QA 狀態。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/products"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                產品資料庫
              </Link>
              <Link
                href="/fwd-compare"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                FWD Compare
              </Link>
              <Link
                href="/boc-inventory"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                BOC Inventory
              </Link>
              <Link
                href="/savings"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                儲蓄保 X-Ray
              </Link>
              <Link
                href="/compliance"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                合規說明
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            { label: 'Products', value: data.products.length },
            { label: 'Premium options', value: data.premium_options.length },
            { label: 'Quote matrix', value: data.quote_matrix.length },
            { label: 'All-40 matrix', value: all40Rows.length },
            { label: 'Benefit rows', value: data.benefit_values.length },
            { label: 'QA flags', value: data.extraction_qa.length },
          ].map(item => (
            <div key={item.label} className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{item.value.toLocaleString('en-US')}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-black">資料備份狀態</h2>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${data._metadata?.sanitized ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {data._metadata?.sanitized ? 'sanitised' : 'needs check'}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Repo JSON</dt>
                <dd className="mt-1 break-all font-semibold text-slate-800">data/fwd/fwd-smart-inventory-2026-05-11.json</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Repo Excel</dt>
                <dd className="mt-1 break-all font-semibold text-slate-800">data/fwd/fwd-smart-inventory-2026-05-11.xlsx</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Source JSON</dt>
                <dd className="mt-1 font-semibold text-slate-800">{data._metadata?.source_json ?? '未有'}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Source Excel</dt>
                <dd className="mt-1 font-semibold text-slate-800">{data._metadata?.source_xlsx ?? '未有'}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              呢個 viewer 只係資料整理檢查，不構成產品推薦。公開前仍要逐份 proposal 做人工 QA，尤其係 discount、付款模式同非保證回報。
            </p>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">覆蓋摘要</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">產品分類</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(categoryCounts).map(([category, count]) => (
                    <span key={category} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {categoryLabel(category)} {count}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Quote status</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(quoteStatuses).map(([status, count]) => (
                    <StatusPill key={status} status={status} count={count} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xl font-black text-slate-900">{actualQuoteRows.length}</p>
                <p className="mt-1 text-slate-500">actual quotes</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xl font-black text-slate-900">{discountRows.length}</p>
                <p className="mt-1 text-slate-500">discount rows</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xl font-black text-slate-900">{benefitVariants}</p>
                <p className="mt-1 text-slate-500">benefit variants</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xl font-black text-slate-900">{all40Summary.length}</p>
                <p className="mt-1 text-slate-500">all-40 products</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">All-40 portal matrix</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xl font-black text-slate-900">{all40Rows.length}</p>
                <p className="mt-1 text-slate-500">rows</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-3">
                <p className="text-xl font-black text-emerald-800">{all40ActualRows.length}</p>
                <p className="mt-1 text-emerald-700">actual quote</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xl font-black text-slate-900">{all40Summary.length}</p>
                <p className="mt-1 text-slate-500">products</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(all40Statuses).map(([status, count]) => (
                <span key={status} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {statusLabel(status)} {count}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">All-40 actual quote samples</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {all40ActualRows.slice(0, 8).map((row, index) => (
                <div key={`${row.portal_pid}-${row.comparison_bucket}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{row.product_name_zh}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{row.portal_pid} · {bucketLabel(row.comparison_bucket ?? 'UNKNOWN')}</p>
                    </div>
                    <p className="shrink-0 font-black text-slate-900">{formatMoney(row.premium_amount, row.premium_currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">核心九格供款條件</h2>
              <p className="mt-1 text-sm text-slate-500">2/5/10 年供款期，各自分月供、年供、一次性付款；每格獨立比較，不做 equivalent premium 轉換。</p>
            </div>
            <span className="hidden rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:inline">
              {coreBuckets.reduce((sum, bucket) => sum + (quoteBuckets[bucket] ?? 0), 0)} core rows
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {coreBuckets.map(bucket => (
              <BucketCard
                key={bucket}
                bucket={bucket}
                rows={data.quote_matrix.filter(row => row.comparison_bucket === bucket)}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">其他 bucket</h2>
            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(quoteBuckets)
                .filter(([bucket]) => !coreBuckets.includes(bucket))
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([bucket, count]) => (
                  <div key={bucket} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-700">{bucket}</span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-800">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">Standard status</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(standardStatuses)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-700">{statusLabel(status)}</span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-800">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-lg font-black">Product family status</h2>
            <p className="text-sm text-slate-500">每個 family 會顯示 premium options、actual quotes、benefit rows 同 QA flags。</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                  <th className="border-b px-3 py-2">Product</th>
                  <th className="border-b px-3 py-2">Category</th>
                  <th className="border-b px-3 py-2 text-right">Premium</th>
                  <th className="border-b px-3 py-2 text-right">Actual quote</th>
                  <th className="border-b px-3 py-2 text-right">Benefit rows</th>
                  <th className="border-b px-3 py-2 text-right">Buckets</th>
                  <th className="border-b px-3 py-2 text-right">Discount</th>
                  <th className="border-b px-3 py-2 text-right">QA</th>
                  <th className="border-b px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(product => (
                  <tr key={product.product_family_id} className="align-top">
                    <td className="border-b px-3 py-3">
                      <p className="font-black text-slate-900">{product.product_name_zh ?? product.product_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.product_family_id} · {product.currency}</p>
                    </td>
                    <td className="border-b px-3 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {categoryLabel(product.category)}
                      </span>
                    </td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{product.premiumOptionCount}</td>
                    <td className="border-b px-3 py-3 text-right font-semibold">
                      {product.actualQuoteCount}/{product.quoteCount}
                    </td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{product.benefitRowCount}</td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{product.bucketCount}</td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{product.discountCount}</td>
                    <td className={`border-b px-3 py-3 text-right font-semibold ${product.qaCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                      {product.qaCount}
                    </td>
                    <td className="max-w-[18rem] border-b px-3 py-3 text-xs text-slate-500">
                      <span className="line-clamp-2">{product.source_file ?? '未有'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">Actual quote samples</h2>
            <div className="mt-3 space-y-2">
              {actualQuoteRows.slice(0, 8).map((row, index) => (
                <div key={`${row.product_family_id}-${row.comparison_bucket}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{row.product_name_zh}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{bucketLabel(row.comparison_bucket ?? 'UNKNOWN')} · {statusLabel(row.quote_status)}</p>
                    </div>
                    <p className="shrink-0 font-black text-slate-900">{formatMoney(row.premium_amount, row.premium_currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">QA issues</h2>
            <div className="mt-3 space-y-2">
              {data.extraction_qa.slice(0, 8).map((row, index) => (
                <div key={`${row.variant_sku}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black text-amber-900">{row.issue_type ?? 'needs_review'}</p>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-amber-700">{row.qa_status ?? 'QA'}</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-amber-800">{row.message ?? '未有 message'}</p>
                  <p className="mt-1 break-all text-xs text-amber-700">{row.product_family_id} · p.{row.source_page ?? '-'}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
