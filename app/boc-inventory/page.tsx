import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

type BocProductsData = {
  extractedAt?: string;
  productCount: number;
  source?: string;
  applicantScenario?: {
    insuredAge?: number;
    gender?: string;
    smoking?: string;
    staff?: string;
  };
  categories: Array<{
    riskTypeName: string;
    riskTypeCode: string;
    count: number;
    products: Array<{
      name: string;
      code: string;
    }>;
  }>;
  _metadata?: {
    sanitized?: boolean;
    source_json?: string;
    source_xlsx?: string;
  };
};

type BocWidgetProduct = {
  category: string;
  categoryCode: string;
  productName: string;
  productCode: string;
  success?: boolean;
  widgetCount?: number;
  reverseCal?: {
    value?: boolean;
  };
  specialProductPage?: string;
  widgets?: Array<{
    field?: string;
    label?: string;
    type?: string;
    options?: unknown[];
  }>;
};

type BocWidgetsData = {
  productCount: number;
  products: BocWidgetProduct[];
};

type BocSummaryRow = {
  code: string;
  name: string;
  success: boolean;
  widgetCount: number;
  reverseCal?: boolean;
  fields?: string[];
};

const PRODUCTS_FILE = path.join(process.cwd(), 'data', 'boc', 'boc-life-portal-products-2026-05-11.json');
const WIDGETS_FILE = path.join(process.cwd(), 'data', 'boc', 'boc-life-portal-ui-widgets-2026-05-11.json');
const SUMMARY_FILE = path.join(process.cwd(), 'data', 'boc', 'boc-life-portal-ui-summary-2026-05-11.json');

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function countBy<T>(rows: T[], getKey: (row: T) => string | undefined | null) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const key = getKey(row) || 'UNKNOWN';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function formatDate(date?: string) {
  if (!date) return '未有';
  return new Intl.DateTimeFormat('zh-HK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

function fieldTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    '00': '輸入',
    '01': '下拉',
    '03': '功能',
  };
  return type ? labels[type] ?? type : 'UNKNOWN';
}

export default function BocInventoryPage() {
  const products = readJson<BocProductsData>(PRODUCTS_FILE);
  const widgets = readJson<BocWidgetsData>(WIDGETS_FILE);
  const summary = readJson<BocSummaryRow[]>(SUMMARY_FILE);
  const allWidgets = widgets.products.flatMap(product => product.widgets ?? []);
  const optionCount = allWidgets.reduce((count, widget) => count + (widget.options?.length ?? 0), 0);
  const successfulProducts = summary.filter(product => product.success);
  const reverseCalProducts = summary.filter(product => product.reverseCal);
  const fieldTypes = countBy(allWidgets, widget => widget.type);
  const widgetsByCode = new Map(widgets.products.map(product => [product.productCode, product]));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                返回首頁
              </Link>
              <h1 className="mt-2 text-2xl font-black tracking-normal">BOC Life Portal Inventory</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                呢頁讀取 repo 入面 sanitised BOC Life portal JSON/Excel，檢查產品分類、proposal UI 欄位、dropdown options 同 extraction 狀態。
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
                href="/fwd-inventory"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                FWD Inventory
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
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Products', value: products.productCount },
            { label: 'Categories', value: products.categories.length },
            { label: 'UI fields', value: allWidgets.length },
            { label: 'Options', value: optionCount },
            { label: 'Reverse calc', value: reverseCalProducts.length },
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
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${products._metadata?.sanitized ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {products._metadata?.sanitized ? 'sanitised' : 'needs check'}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Extracted</dt>
                <dd className="mt-1 font-semibold text-slate-800">{formatDate(products.extractedAt)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Scenario</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  Age {products.applicantScenario?.insuredAge ?? '-'} · {products.applicantScenario?.gender ?? '-'} · {products.applicantScenario?.smoking ?? '-'}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Repo JSON</dt>
                <dd className="mt-1 break-all font-semibold text-slate-800">data/boc/boc-life-portal-products-2026-05-11.json</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs font-semibold text-slate-500">Repo Excel</dt>
                <dd className="mt-1 break-all font-semibold text-slate-800">data/boc/BOC-Life-Proposal-Portal-Inventory-2026-05-11.xlsx</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-800">
              呢批資料只係 portal product/UI metadata，未等同完整 quote comparison。公開 repo 只保存 JSON/XLSX backup，唔保存 Safari cookies、proposal pin、spac 或 browser session 資料。
            </p>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">分類同欄位摘要</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {products.categories.map(category => (
                <span key={category.riskTypeCode} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {category.riskTypeName} {category.count}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {Object.entries(fieldTypes).map(([type, count]) => (
                <div key={type} className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="text-xl font-black text-slate-900">{count}</p>
                  <p className="mt-1 text-slate-500">{fieldTypeLabel(type)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-lg font-black">Product UI status</h2>
            <p className="text-sm text-slate-500">{successfulProducts.length}/{summary.length} products extracted successfully.</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                  <th className="border-b px-3 py-2">Product</th>
                  <th className="border-b px-3 py-2">Category</th>
                  <th className="border-b px-3 py-2 text-right">Fields</th>
                  <th className="border-b px-3 py-2 text-right">Options</th>
                  <th className="border-b px-3 py-2">Reverse calc</th>
                  <th className="border-b px-3 py-2">Field names</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(product => {
                  const widgetProduct = widgetsByCode.get(product.code);
                  const productOptionCount = (widgetProduct?.widgets ?? []).reduce((count, widget) => count + (widget.options?.length ?? 0), 0);

                  return (
                    <tr key={product.code} className="align-top">
                      <td className="border-b px-3 py-3">
                        <p className="font-black text-slate-900">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{product.code}</p>
                      </td>
                      <td className="border-b px-3 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {widgetProduct?.category ?? 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="border-b px-3 py-3 text-right font-semibold">{product.widgetCount}</td>
                      <td className="border-b px-3 py-3 text-right font-semibold">{productOptionCount}</td>
                      <td className="border-b px-3 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${product.reverseCal ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {product.reverseCal ? 'yes' : 'no'}
                        </span>
                      </td>
                      <td className="max-w-[24rem] border-b px-3 py-3 text-xs leading-relaxed text-slate-500">
                        {(product.fields ?? []).join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
