'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ProductSummary } from '@/lib/types';

type Props = {
  products: ProductSummary[];
  stats: {
    total: number;
    fwdProposalCount: number;
    savingsSeedCount: number;
    medicalSeedCount: number;
    byCategory: Record<string, number>;
  };
  latestBatchGeneratedAt?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  savings: '儲蓄',
  'life-savings': '人壽儲蓄',
  life: '人壽',
  'critical-illness': '危疾',
  annuity: '年金',
  medical: '醫療',
};

const CATEGORY_ORDER = ['savings', 'life-savings', 'life', 'critical-illness', 'annuity', 'medical'];

function categorySortIndex(category: string) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function money(amount: number | null | undefined, currency?: string) {
  if (amount == null || Number.isNaN(amount)) return '未有';
  const digits = Math.abs(amount) >= 1000 ? 0 : 2;
  return `${currency ? `${currency} ` : ''}${amount.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits === 2 ? 2 : 0,
  })}`;
}

function paymentLabel(product: ProductSummary) {
  const premium = product.premium;
  if (!premium) return '未有';

  if (premium.portal_premium != null) {
    const mode = premium.payment_mode === 'SINGLE' ? '一次性' : premium.payment_mode === 'ANNUAL' ? '每年' : premium.payment_mode;
    return `${money(premium.portal_premium, product.currency)} ${mode ?? ''}`.trim();
  }

  if (premium.monthly != null) return `${money(premium.monthly, product.currency)}/月`;
  if (premium.annual_equivalent != null) return `${money(premium.annual_equivalent, product.currency)}/年`;
  return '未有';
}

function coreAmountLabel(product: ProductSummary) {
  if (product.sum_insured != null) return money(product.sum_insured, product.currency);
  if (product.annual_limit != null) return `${money(product.annual_limit, product.currency)}/年`;
  if (product.lifetime_limit != null) return `${money(product.lifetime_limit, product.currency)} 終身`;
  return product.policy_term ?? '未有';
}

function sourceKindLabel(product: ProductSummary) {
  if (product.source.kind === 'pdf-proposal') return 'PDF抽取';
  if (product.source.kind === 'official-public-dataset') return '公開數據';
  return '樣本數據';
}

function sourceLabel(product: ProductSummary) {
  return product.source.filename ?? product.source.name ?? product.source.batch ?? '本地資料';
}

function qualityTone(product: ProductSummary) {
  if (product.data_quality.level === 'official-public-data') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (product.data_quality.level === 'sample-proposal') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function metricItems(product: ProductSummary) {
  const metrics = product.metrics ?? {};
  const items = [
    { label: '保費', value: paymentLabel(product) },
    { label: product.annual_limit != null ? '年保障限額' : '保額 / 年期', value: coreAmountLabel(product) },
  ];

  if (metrics.issue_surrender_value != null) {
    items.push({ label: '繕發日退保值', value: money(metrics.issue_surrender_value, product.currency) });
  }

  if (metrics.issue_surrender_loss_pct != null) {
    items.push({ label: '繕發日差額', value: `${metrics.issue_surrender_loss_pct}%` });
  }

  if (metrics.year5_surrender_loss_pct != null) {
    items.push({ label: '第5年退保差額', value: `${metrics.year5_surrender_loss_pct}%` });
  }

  if (metrics.annuity_monthly_total != null) {
    items.push({ label: '每月年金', value: money(metrics.annuity_monthly_total, product.currency) });
  }

  if (metrics.projected_irr) {
    items.push({ label: '演示IRR', value: metrics.projected_irr });
  }

  if (product.room_class) {
    items.push({ label: '病房級別', value: product.room_class });
  }

  return items.slice(0, 6);
}

function formatDate(date?: string) {
  if (!date) return '未有';
  return new Intl.DateTimeFormat('zh-HK', { dateStyle: 'medium' }).format(new Date(date));
}

export default function ProductLibrary({ products, stats, latestBatchGeneratedAt }: Props) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');

  const categoryOptions = useMemo(() => {
    return Object.entries(stats.byCategory)
      .sort(([a], [b]) => categorySortIndex(a) - categorySortIndex(b))
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        count,
      }));
  }, [stats.byCategory]);

  const visibleProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return products.filter(product => {
      const categoryMatch = activeCategory === 'all' || product.category === activeCategory;
      const haystack = [
        product.company,
        product.company_zh,
        product.product_name,
        product.product_name_zh,
        product.category_label,
        product.source.filename,
        product.source.name,
      ].filter(Boolean).join(' ').toLowerCase();

      return categoryMatch && (!cleanQuery || haystack.includes(cleanQuery));
    });
  }, [activeCategory, products, query]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              返回首頁
            </Link>
            <h1 className="mt-2 text-2xl font-black tracking-normal">產品資料庫</h1>
            <p className="mt-1 text-sm text-slate-500">
              {stats.total} 個產品 · FWD PDF {stats.fwdProposalCount} 份 · 更新 {formatDate(latestBatchGeneratedAt)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="font-black text-lg text-slate-900">{stats.fwdProposalCount}</p>
              <p className="text-slate-500">PDF proposals</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="font-black text-lg text-slate-900">{stats.savingsSeedCount}</p>
              <p className="text-slate-500">Saving samples</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="font-black text-lg text-slate-900">{stats.medicalSeedCount}</p>
              <p className="text-slate-500">VHIS rows</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="sticky top-0 z-10 -mx-4 border-b bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              aria-label="搜尋產品"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜尋公司 / 產品 / PDF"
              className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500 md:max-w-sm"
            />
            <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setActiveCategory('all')}
                className={`h-9 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold ${
                  activeCategory === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                全部 {stats.total}
              </button>
              {categoryOptions.map(option => (
                <button
                  key={option.category}
                  onClick={() => setActiveCategory(option.category)}
                  className={`h-9 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold ${
                    activeCategory === option.category
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {option.label} {option.count}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map(product => (
            <article key={product.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {product.category_label}
                    </span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${qualityTone(product)}`}>
                      {sourceKindLabel(product)}
                    </span>
                  </div>
                  <h2 className="text-base font-black leading-snug text-slate-950">{product.product_name_zh}</h2>
                  <p className="mt-1 text-sm text-slate-500">{product.company_zh}</p>
                </div>
                <span className="shrink-0 rounded-md border bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                  {product.currency}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {metricItems(product).map(item => (
                  <div key={`${product.id}-${item.label}`} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-black text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t pt-3 text-xs text-slate-500">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-slate-700">Source</span>
                  <span className="min-w-0 flex-1 break-all text-right leading-snug">{sourceLabel(product)}</span>
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <span className="font-semibold text-slate-700">Data</span>
                  <span className="text-right leading-snug">
                    {product.metrics?.value_point_count ?? product.value_points?.length ?? 0} rows
                    {product.source.pages ? ` · ${product.source.pages} pages` : ''}
                  </span>
                </div>
                {product.data_quality.warnings?.[0] && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 leading-relaxed text-amber-800">
                    {product.data_quality.warnings[0]}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        {visibleProducts.length === 0 && (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">
            未找到符合條件嘅產品。
          </div>
        )}

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
          以上資料只作資料整理及比較展示，不構成投保、轉保或退保建議。本平台現階段不安排任何保險合約，PDF抽取數據需再按原文件核對。
        </p>
      </main>
    </div>
  );
}
