'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CaptureRow,
  CaptureStatusGroup,
  FwdStandardCaptureData,
} from '@/lib/fwd-standard-capture';

type Props = FwdStandardCaptureData;
type Mode = 'comparable' | 'all_pdf';

const BUCKET_ORDER = [
  '2Y_MONTHLY',
  '2Y_ANNUAL',
  '2Y_SINGLE',
  '5Y_MONTHLY',
  '5Y_ANNUAL',
  '5Y_SINGLE',
  '10Y_MONTHLY',
  '10Y_ANNUAL',
  '10Y_SINGLE',
  'OUT_OF_SCOPE',
];
const PRODUCT_COLORS = ['#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be123c', '#0e7490', '#a16207'];
const CATEGORY_LABELS: Record<string, string> = {
  savings: 'Savings',
  'life-savings': 'Life-savings',
  annuity: 'Annuity',
};
const NORMALIZED_OUT_OF_SCOPE_SINGLE_PREMIUM = 15600;
const STATUS_LABELS: Record<CaptureStatusGroup, string> = {
  comparable: 'Comparable',
  fixed_basis: 'Fixed basis',
  out_of_scope: 'Out of scope',
  unavailable: 'Unavailable',
  other: 'Other',
};

function bucketLabel(bucket: string) {
  if (bucket === 'OUT_OF_SCOPE') return 'Out of scope';
  const [term, mode] = bucket.split('_');
  const termLabel = term?.replace('Y', '年供') ?? bucket;
  const modeLabel = mode === 'MONTHLY' ? '月供' : mode === 'ANNUAL' ? '年供' : mode === 'SINGLE' ? '一次性' : mode;
  return `${termLabel} · ${modeLabel}`;
}

function money(amount: number | null | undefined, currency = 'USD') {
  if (amount == null || Number.isNaN(amount)) return '未有';
  const digits = Math.abs(amount - Math.round(amount)) >= 0.005 ? 2 : 0;
  return `${currency} ${amount.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits === 2 ? 2 : 0,
  })}`;
}

function percent(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return '未有';
  return `${amount.toFixed(1)}%`;
}

function isNormalizedOutOfScopeRow(row: CaptureRow) {
  return row.comparisonBucket === 'OUT_OF_SCOPE' && row.paymentMode === 'SINGLE';
}

function hasStandardTarget(row: CaptureRow) {
  return row.targetPremium != null || row.targetTotalPremium != null || isNormalizedOutOfScopeRow(row);
}

function comparisonPremiumAmount(row: CaptureRow) {
  if (isNormalizedOutOfScopeRow(row)) return NORMALIZED_OUT_OF_SCOPE_SINGLE_PREMIUM;
  if (row.targetPremium != null) return row.targetPremium;
  return row.actualPremium;
}

function comparisonTotalPaidAmount(row: CaptureRow) {
  if (isNormalizedOutOfScopeRow(row)) return NORMALIZED_OUT_OF_SCOPE_SINGLE_PREMIUM;
  if (row.targetTotalPremium != null) return row.targetTotalPremium;
  return row.actualTotalPremium;
}

function normalizedValueFromPct(pctValue: number | null | undefined) {
  if (pctValue == null || Number.isNaN(pctValue)) return null;
  return NORMALIZED_OUT_OF_SCOPE_SINGLE_PREMIUM * (pctValue / 100);
}

function premiumLabel(row: CaptureRow) {
  if (row.actualPremium == null) return '未有';
  const currency = row.premiumCurrency ?? 'USD';
  if (row.paymentMode === 'MONTHLY') return `${money(row.actualPremium, currency)} / 月`;
  if (row.paymentMode === 'ANNUAL') return `${money(row.actualPremium, currency)} / 年`;
  return `${money(row.actualPremium, currency)} 一次性`;
}

function comparisonPremiumLabel(row: CaptureRow) {
  const amount = comparisonPremiumAmount(row);
  if (amount == null) return '未有';
  const currency = row.premiumCurrency ?? 'USD';
  if (row.paymentMode === 'MONTHLY') return `${money(amount, currency)} / 月`;
  if (row.paymentMode === 'ANNUAL') return `${money(amount, currency)} / 年`;
  return `${money(amount, currency)} 一次性`;
}

function comparisonTotalPaidLabel(row: CaptureRow) {
  const amount = comparisonTotalPaidAmount(row);
  if (amount == null) return '未有';
  return money(amount, row.premiumCurrency ?? 'USD');
}

function discountSummary(row: CaptureRow) {
  if (row.discountAvailable && (row.discountAmount != null || row.discountRate != null)) {
    const parts = [];
    if (row.discountAmount != null) parts.push(`discount ${money(row.discountAmount, row.discountCurrency ?? row.premiumCurrency ?? 'USD')}`);
    if (row.discountRate != null) parts.push(`${row.discountRate}%`);
    return parts.join(' · ');
  }
  if (row.discountSource === 'INFERRED_QA_ONLY' && row.discountInferredNote) {
    return row.discountInferredNote;
  }
  return null;
}

function targetLabel(row: CaptureRow) {
  const currency = row.premiumCurrency ?? 'USD';
  if (isNormalizedOutOfScopeRow(row)) return `統一基準 ${money(NORMALIZED_OUT_OF_SCOPE_SINGLE_PREMIUM, currency)} 一次性`;
  if (row.paymentMode === 'MONTHLY') return row.targetPremium ? `${money(row.targetPremium, currency)} / 月` : '未有 monthly target';
  if (row.paymentMode === 'ANNUAL') return row.targetPremium ? `${money(row.targetPremium, currency)} / 年` : '未有 annual target';
  return row.targetTotalPremium ? `總供款 ${money(row.targetTotalPremium, currency)}` : '非標準 bucket';
}

function statusClasses(group: CaptureStatusGroup) {
  if (group === 'comparable') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (group === 'fixed_basis') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (group === 'out_of_scope') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (group === 'unavailable') return 'border-slate-200 bg-slate-50 text-slate-500';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}

function compareRows(a: CaptureRow, b: CaptureRow) {
  const groupRank: Record<CaptureStatusGroup, number> = {
    comparable: 0,
    fixed_basis: 1,
    out_of_scope: 2,
    other: 3,
    unavailable: 4,
  };
  const statusDiff = groupRank[a.statusGroup] - groupRank[b.statusGroup];
  if (statusDiff !== 0) return statusDiff;
  const curveDiff = Number(b.curve.length > 0) - Number(a.curve.length > 0);
  if (curveDiff !== 0) return curveDiff;
  return a.productNameZh.localeCompare(b.productNameZh, 'zh-Hant');
}

function buildChartData(rows: CaptureRow[]) {
  const years = [...new Set(rows.flatMap(row => row.curve.map(point => point.year)))]
    .filter(year => year <= 30)
    .sort((a, b) => a - b);
  return years.map(year => {
    const point: Record<string, number | null> & { year: number } = { year };
    rows.forEach(row => {
      point[row.id] = row.curve.find(item => item.year === year)?.surrenderToPaidPct ?? null;
    });
    return point;
  });
}

function productOptionLabel(productNameZh: string, rows: CaptureRow[]) {
  const comparable = rows.filter(row => row.statusGroup === 'comparable').length;
  const fixed = rows.filter(row => row.statusGroup === 'fixed_basis').length;
  return `${productNameZh} ${comparable}/${rows.length}${fixed ? ` +${fixed} fixed` : ''}`;
}

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

function outOfScopeStory(row: CaptureRow) {
  const generic = '呢個回本年期係按退保價值去計，不是按身故權益去計。買呢類單的人，通常睇終身保障、資產傳承，同埋長線持有，而唔係預計頭幾年退保。';

  if (row.productFamilyId === 'fwd_creative_fortune_plus') {
    return `${generic} 呢隻又有最低保額門檻，所以實際入場保費被迫放大；早期退保自然唔著數，但傳承槓桿仍然係賣點。`;
  }
  if (row.productFamilyId === 'fwd_creative_fortune_plus_ii') {
    return `${generic} Plus II 同樣受最低保額限制，單筆金額愈大，早段現金回收就愈慢；產品設計本身係偏長線持有。`;
  }
  if (row.productFamilyId === 'fwd_creative_fortune_premier') {
    return `${generic} Premier 係更明顯嘅高資產傳承定位，客戶通常重視後段紅利同身故賠償，而唔係用短期退保去評價。`;
  }
  if (row.productFamilyId === 'fwd_home_legacy') {
    return `${generic} Home Legacy 本身就偏向留畀屋企人，前段回本慢反映咗早期成本同長線紅利釋放較後。`;
  }
  if (row.productFamilyId === 'fwd_smart_saver') {
    return `${generic} 智優盛本身係短年期 single-pay 儲蓄，門檻高過我哋 standard bucket，所以一定要用 out-of-scope 去睇，唔適合同 regular-pay 單直接當同一種現金流比較。`;
  }
  if (row.productFamilyId === 'fwd_wealth_harvest_premier_iii') {
    return `${generic} 智盈匯聚 III 用一次過投入去換後段較高增值，賣點係長線資產配置同後段紅利，唔係短期退保。`;
  }
  if (row.productFamilyId === 'fwd_apex_wealth') {
    return `${generic} 智盈．超凡有較高單筆入場門檻，設計重點係後段非保證值放大，所以愈早退保，體感就愈差。`;
  }
  return generic;
}

function CaptureChart({ rows }: { rows: CaptureRow[] }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 380 });
  const chartRows = rows.filter(row => row.curve.length > 0).slice(0, 7);
  const chartData = buildChartData(chartRows);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const rect = frame.getBoundingClientRect();
      setChartSize({
        width: Math.max(300, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  if (chartRows.length === 0) {
    return (
      <section className="rounded-lg border border-dashed bg-white p-6 text-center shadow-sm">
        <h2 className="font-black text-slate-900">未有可畫曲線</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
          呢個篩選暫時只有 availability 或保費狀態，未有對應 proposal benefit table。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">退保價值 / 已供保費</h2>
          <p className="text-sm text-slate-500">First 30 policy years; 100% = projected surrender value equal total paid.</p>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {chartRows.length} curves
        </span>
      </div>

      <div ref={frameRef} className="h-[380px] w-full">
        {chartSize.width > 0 && (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={chartData}
            margin={{ top: 10, right: 20, left: 2, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={value => `${value}年`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={value => `${Math.round(Number(value))}%`}
            />
            <Tooltip
              formatter={(value, name) => {
                const row = chartRows.find(item => item.id === name);
                return [percent(Number(value)), row ? `${row.productNameZh} · ${bucketLabel(row.comparisonBucket)}` : String(name)];
              }}
              labelFormatter={label => `第 ${label} 年`}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend
              verticalAlign="bottom"
              height={54}
              formatter={value => {
                const row = chartRows.find(item => item.id === value);
                return row ? `${row.productNameZh} · ${bucketLabel(row.comparisonBucket)}` : value;
              }}
            />
            <ReferenceLine y={100} stroke="#64748b" strokeDasharray="6 6" />
            {chartRows.map((row, index) => (
              <Line
                key={row.id}
                type="monotone"
                dataKey={row.id}
                name={row.id}
                stroke={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
                strokeWidth={3}
                dot={{ r: 2.5 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </div>
    </section>
  );
}

function CaptureTable({ rows }: { rows: CaptureRow[] }) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">Rows</h2>
        <p className="text-sm text-slate-500">{rows.length} rows in current view</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              <th className="border-b px-3 py-2">Product</th>
              <th className="border-b px-3 py-2">Bucket</th>
              <th className="border-b px-3 py-2">Status</th>
              <th className="border-b px-3 py-2 text-right">Target</th>
              <th className="border-b px-3 py-2 text-right">Compare premium</th>
              <th className="border-b px-3 py-2 text-right">Compare total paid</th>
              <th className="border-b px-3 py-2 text-right">Basis</th>
              <th className="border-b px-3 py-2 text-right">10Y</th>
              <th className="border-b px-3 py-2 text-right">20Y</th>
              <th className="border-b px-3 py-2 text-right">30Y</th>
              <th className="border-b px-3 py-2 text-right">Breakeven</th>
              <th className="border-b px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="align-top">
                <td className="border-b px-3 py-3">
                  <p className="font-black text-slate-900">{row.productNameZh}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.productFamilyId}</p>
                </td>
                <td className="border-b px-3 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {bucketLabel(row.comparisonBucket)}
                  </span>
                </td>
                <td className="border-b px-3 py-3">
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClasses(row.statusGroup)}`}>
                    {STATUS_LABELS[row.statusGroup]}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">{row.status.replaceAll('_', ' ')}</p>
                </td>
                <td className="border-b px-3 py-3 text-right font-semibold">{targetLabel(row)}</td>
                <td className="border-b px-3 py-3 text-right">
                  <p className="font-semibold">{comparisonPremiumLabel(row)}</p>
                  {hasStandardTarget(row) && row.actualPremium != null && comparisonPremiumAmount(row) !== row.actualPremium && (
                    <p className="mt-1 text-xs text-slate-500">raw {premiumLabel(row)}</p>
                  )}
                  {discountSummary(row) && (
                    <p className="mt-1 text-xs text-indigo-700">{discountSummary(row)}</p>
                  )}
                </td>
                <td className="border-b px-3 py-3 text-right">
                  <p className="font-semibold">{comparisonTotalPaidLabel(row)}</p>
                  {hasStandardTarget(row) && row.actualTotalPremium != null && comparisonTotalPaidAmount(row) !== row.actualTotalPremium && (
                    <p className="mt-1 text-xs text-slate-500">raw {money(row.actualTotalPremium)}</p>
                  )}
                  {row.totalPremiumBeforeDiscount != null && row.totalDiscountOverPaymentTerm != null && row.totalDiscountOverPaymentTerm > 0 && (
                    <p className="mt-1 text-xs text-indigo-700">
                      discount total {money(row.totalDiscountOverPaymentTerm, row.discountCurrency ?? row.premiumCurrency ?? 'USD')}
                    </p>
                  )}
                </td>
                <td className="border-b px-3 py-3 text-right font-semibold">{money(row.notionalAmount)}</td>
                <td className="border-b px-3 py-3 text-right font-semibold">{percent(row.year10SurrenderToPaidPct)}</td>
                <td className="border-b px-3 py-3 text-right text-base font-black text-slate-900">{percent(row.year20SurrenderToPaidPct)}</td>
                <td className="border-b px-3 py-3 text-right font-semibold">{percent(row.year30SurrenderToPaidPct)}</td>
                <td className="border-b px-3 py-3 text-right font-semibold">{row.breakevenYear ? `${row.breakevenYear}年` : '未有'}</td>
                <td className="max-w-[18rem] border-b px-3 py-3 text-xs text-slate-500">
                  <span className="line-clamp-2">{row.pdfFile ?? '未有 PDF'}</span>
                  {row.notes && <p className="mt-1 line-clamp-2 text-amber-700">{row.notes}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OutOfScopeNotes({ rows }: { rows: CaptureRow[] }) {
  const noteRows = rows
    .filter(row => row.comparisonBucket === 'OUT_OF_SCOPE' && row.statusGroup === 'out_of_scope')
    .slice()
    .sort(compareRows);

  if (noteRows.length === 0) return null;

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Out-of-Scope Notes</h2>
          <p className="text-sm text-slate-500">
            呢幾份 proposal 係真實可以做，但因為最低保費或最低保額門檻，唔屬於同一 standard cohort。
            為咗方便 comparison，下面統一用 {money(NORMALIZED_OUT_OF_SCOPE_SINGLE_PREMIUM)} 一次性做比較基準。
          </p>
        </div>
        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          統一比較基準
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {noteRows.map(row => (
          <article key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900">{row.productNameZh}</h3>
                <p className="mt-1 text-xs text-slate-500">{row.pdfFile ?? '未有 PDF 名稱'}</p>
              </div>
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                {bucketLabel(row.comparisonBucket)}
              </span>
            </div>

            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500">比較基準</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{money(NORMALIZED_OUT_OF_SCOPE_SINGLE_PREMIUM)} 一次性</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">實際門檻</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{premiumLabel(row)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">回本年期</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{row.breakevenYear ? `${row.breakevenYear} 年` : '未有'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">20年相當退保值</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {money(normalizedValueFromPct(row.year20SurrenderToPaidPct))}
                </dd>
              </div>
            </dl>

            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
              {outOfScopeStory(row)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusMatrix({ rows }: { rows: CaptureRow[] }) {
  const products = [...new Set(rows.map(row => row.productFamilyId))];
  const buckets = BUCKET_ORDER.filter(bucket => rows.some(row => row.comparisonBucket === bucket));

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">Capture status</h2>
        <p className="text-sm text-slate-500">Green = standard comparable; amber = PDF exists but basis differs.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="border-b px-2 py-2">Product</th>
              {buckets.map(bucket => (
                <th key={bucket} className="border-b px-2 py-2 text-center">{bucketLabel(bucket)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(productFamilyId => {
              const productRows = rows.filter(row => row.productFamilyId === productFamilyId);
              return (
                <tr key={productFamilyId}>
                  <td className="border-b px-2 py-2">
                    <p className="font-black text-slate-900">{productRows[0]?.productNameZh}</p>
                    <p className="mt-1 text-slate-500">{productFamilyId}</p>
                  </td>
                  {buckets.map(bucket => {
                    const row = productRows.find(item => item.comparisonBucket === bucket);
                    return (
                      <td key={bucket} className="border-b px-2 py-2 text-center">
                        {row ? (
                          <span className={`inline-flex min-w-[6.6rem] justify-center rounded-md border px-2 py-1 font-semibold ${statusClasses(row.statusGroup)}`}>
                            {STATUS_LABELS[row.statusGroup]}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function StandardCaptureClient({ rows, productSummaries, categorySummaries, bucketSummaries, stats }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('life-savings');
  const [selectedBucket, setSelectedBucket] = useState('5Y_ANNUAL');
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [mode, setMode] = useState<Mode>('all_pdf');

  const categoryRows = useMemo(() => {
    return rows.filter(row => row.category === selectedCategory);
  }, [rows, selectedCategory]);

  const categoryOptions = useMemo(() => {
    return categorySummaries
      .slice()
      .sort((a, b) => (a.key === 'savings' ? -1 : b.key === 'savings' ? 1 : a.key.localeCompare(b.key)))
      .map(summary => ({
        category: summary.key,
        label: categoryLabel(summary.key),
        totalRows: summary.totalRows,
        comparableRows: summary.comparableRows,
        fixedBasisRows: summary.fixedBasisRows,
        outOfScopeRows: summary.outOfScopeRows,
      }));
  }, [categorySummaries]);

  const productOptions = useMemo(() => {
    const groups = new Map<string, CaptureRow[]>();
    categoryRows.forEach(row => {
      groups.set(row.productFamilyId, [...(groups.get(row.productFamilyId) ?? []), row]);
    });
    return [...groups.entries()]
      .map(([productFamilyId, productRows]) => ({
        productFamilyId,
        label: productOptionLabel(productRows[0]?.productNameZh ?? productFamilyId, productRows),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));
  }, [categoryRows]);

  const bucketOptions = useMemo(() => {
    return BUCKET_ORDER
      .filter(bucket => categoryRows.some(row => row.comparisonBucket === bucket))
      .map(bucket => {
        const bucketRows = categoryRows.filter(row => row.comparisonBucket === bucket);
        return {
          bucket,
          totalRows: bucketRows.length,
          comparableRows: bucketRows.filter(row => row.statusGroup === 'comparable').length,
          fixedBasisRows: bucketRows.filter(row => row.statusGroup === 'fixed_basis').length,
          rowsWithCurve: bucketRows.filter(row => row.curve.length > 0).length,
        };
      });
  }, [categoryRows]);

  const filteredRows = useMemo(() => {
    return categoryRows
      .filter(row => row.comparisonBucket === selectedBucket)
      .filter(row => selectedProduct === 'ALL' || row.productFamilyId === selectedProduct)
      .filter(row => mode === 'all_pdf' ? row.statusGroup !== 'unavailable' : row.comparable)
      .slice()
      .sort(compareRows);
  }, [categoryRows, mode, selectedBucket, selectedProduct]);

  const activeProducts = productSummaries.filter(summary =>
    summary.totalRows > 0 && categoryRows.some(row => row.productFamilyId === summary.productFamilyId)
  ).length;
  const referenceRows = categoryRows.filter(row => row.statusGroup === 'fixed_basis' || row.statusGroup === 'out_of_scope').length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <section className="grid gap-3 md:grid-cols-5">
          {[
            { label: 'Manifest rows', value: stats.totalRows },
            { label: 'Comparable', value: stats.comparableRows },
            { label: 'With curves', value: stats.rowsWithCurve },
          { label: 'Fixed-basis PDFs', value: stats.fixedBasisRows },
          { label: 'Products', value: activeProducts },
        ].map(item => (
          <div key={item.label} className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-black text-slate-900">Category split</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {categoryOptions.map(option => (
              <button
                key={option.category}
                type="button"
                onClick={() => {
                  setSelectedCategory(option.category);
                  setSelectedProduct('ALL');
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                  selectedCategory === option.category
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                <span className="block">{option.label}</span>
                <span className="mt-1 block text-xs opacity-75">
                  {option.comparableRows}/{option.totalRows} comparable · {option.fixedBasisRows} fixed · {option.outOfScopeRows} out-of-scope
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
          <div>
            <p className="text-sm font-black text-slate-900">Bucket</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {bucketOptions.map(option => (
                <button
                  key={option.bucket}
                  type="button"
                  onClick={() => setSelectedBucket(option.bucket)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                    selectedBucket === option.bucket
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : option.comparableRows > 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : option.fixedBasisRows > 0
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="block">{bucketLabel(option.bucket)}</span>
                  <span className="mt-1 block opacity-75">
                    {option.comparableRows}/{option.totalRows} comparable · {option.rowsWithCurve} curves
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-slate-900">Product</p>
            <div className="mt-2 grid gap-2">
              <button
                type="button"
                onClick={() => setSelectedProduct('ALL')}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                  selectedProduct === 'ALL'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                All products
              </button>
              {productOptions.map(option => (
                <button
                  key={option.productFamilyId}
                  type="button"
                  onClick={() => setSelectedProduct(option.productFamilyId)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                    selectedProduct === option.productFamilyId
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-slate-900">View</p>
            <div className="mt-2 grid gap-2">
              <button
                type="button"
                onClick={() => setMode('comparable')}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                  mode === 'comparable'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                Comparable only
              </button>
              <button
                type="button"
                onClick={() => setMode('all_pdf')}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                  mode === 'all_pdf'
                    ? 'border-amber-700 bg-amber-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                Include references
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              {referenceRows} rows in this category are useful as references but not same-budget comparisons.
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Current view</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{filteredRows.length}</p>
          <p className="mt-1 text-xs text-slate-500">{categoryLabel(selectedCategory)} · {bucketLabel(selectedBucket)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Highest 20Y</p>
          <p className="mt-2 text-xl font-black text-slate-950">
            {percent(
              filteredRows
                .filter(row => row.year20SurrenderToPaidPct != null)
                .sort((a, b) => (b.year20SurrenderToPaidPct ?? 0) - (a.year20SurrenderToPaidPct ?? 0))[0]?.year20SurrenderToPaidPct
            )}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {
              filteredRows
                .filter(row => row.year20SurrenderToPaidPct != null)
                .sort((a, b) => (b.year20SurrenderToPaidPct ?? 0) - (a.year20SurrenderToPaidPct ?? 0))[0]?.productNameZh ?? '未有'
            }
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Archived reference rows</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{referenceRows}</p>
          <p className="mt-1 text-xs text-slate-500">Fixed basis + out of scope</p>
        </div>
      </section>

      <div className="mt-4 space-y-4">
        <CaptureChart rows={filteredRows} />
        <CaptureTable rows={filteredRows} />
        <OutOfScopeNotes rows={categoryRows} />
        <StatusMatrix rows={categoryRows} />
      </div>

      <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
        以上只作資料整理、排序及情境模擬，不構成投保、轉保或退保建議。本平台現階段不安排任何保險合約。
      </p>
    </main>
  );
}
