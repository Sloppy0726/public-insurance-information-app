import Link from 'next/link';
import { getCategoryLabel, getCategorySortIndex, loadProductCatalog } from '@/lib/products';

function formatDate(date?: string) {
  if (!date) return '未有';
  return new Intl.DateTimeFormat('zh-HK', { dateStyle: 'medium' }).format(new Date(date));
}

export default function Home() {
  const catalog = loadProductCatalog();
  const latestBatch = catalog.batches
    .slice()
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0];
  const categoryRows = Object.entries(catalog.stats.byCategory)
    .sort(([a], [b]) => getCategorySortIndex(a) - getCategorySortIndex(b));
  const maxCategoryCount = Math.max(...categoryRows.map(([, count]) => count), 1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Hong Kong product data</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal">香港保險產品資料庫</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                整合 FWD proposal PDFs、BOC Life portal inventory、現有儲蓄保樣本、VHIS公開醫療數據，先做一個可查、可篩、可追 source 嘅 demo。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/products"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                打開產品資料庫
              </Link>
              <Link
                href="/boc-inventory"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                BOC Inventory
              </Link>
              <Link
                href="/fwd-standard-capture"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:border-emerald-500"
              >
                Standard Capture
              </Link>
              <Link
                href="/savings"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                儲蓄保 X-Ray
              </Link>
              <Link
                href="/compliance"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                合規說明
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: '全部產品', value: catalog.stats.total },
            { label: 'FWD PDF', value: catalog.stats.fwdProposalCount },
            { label: 'BOC portal', value: catalog.stats.bocPortalCount },
            { label: '儲蓄保樣本', value: catalog.stats.savingsSeedCount },
            { label: 'VHIS公開數據', value: catalog.stats.medicalSeedCount },
          ].map(item => (
            <div key={item.label} className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-black">分類覆蓋</h2>
              <span className="text-xs font-semibold text-slate-500">{categoryRows.length} 類</span>
            </div>
            <div className="mt-4 space-y-3">
              {categoryRows.map(([category, count]) => (
                <div key={category}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-700">{getCategoryLabel(category)}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${Math.max(8, (count / maxCategoryCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-black">FWD batch</h2>
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">raw extract</span>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Batch</dt>
                <dd className="text-right font-semibold text-slate-800">{latestBatch?.batch_id ?? '未有'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Products</dt>
                <dd className="font-semibold text-slate-800">{latestBatch?.product_count ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Generated</dt>
                <dd className="text-right font-semibold text-slate-800">{formatDate(latestBatch?.generated_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Source folder</dt>
                <dd className="max-w-[15rem] truncate text-right font-semibold text-slate-800">
                  {latestBatch?.source_root ?? '未有'}
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              PDF抽取版會保留 source、頁數、notes；表格數字上線前要逐份 proposal 對返原文。
            </p>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-black">BOC Life portal</h2>
              <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">metadata</span>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Products</dt>
                <dd className="font-semibold text-slate-800">{catalog.stats.bocPortalCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Categories</dt>
                <dd className="font-semibold text-slate-800">
                  {categoryRows.filter(([category]) => catalog.products.some(product => product.company === 'BOC Life' && product.category === category)).length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Repo JSON</dt>
                <dd className="max-w-[16rem] truncate text-right font-semibold text-slate-800">
                  data/boc/boc-life-portal-products-2026-05-11.json
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-800">
              BOC 目前係產品、分類、UI欄位同下拉選項 metadata；未有 premium / surrender matrix 前，只放入產品資料庫同 inventory viewer。
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            {
              title: '現在有',
              body: '產品清單、FWD SMART inventory、BOC Life portal inventory、FWD保費/回報比較、分類篩選、source trace、儲蓄保 X-Ray。',
            },
            {
              title: '下一步',
              body: '批量匯入更多 insurance papers，建立人工QA欄位，再做資金情境模擬同資料排序 assistant。',
            },
            {
              title: '合規方向',
              body: '全程用「資料排序」同「情境模擬」語氣，避免投保建議、產品推薦、代理排序，廣告位同結果分開標示。',
            },
          ].map(item => (
            <div key={item.title} className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="font-black text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.body}</p>
            </div>
          ))}
        </section>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
          以上資料只作資料整理及比較展示，不構成任何投保、轉保或退保建議。本平台現階段不安排任何保險合約。
        </p>
      </main>
    </div>
  );
}
