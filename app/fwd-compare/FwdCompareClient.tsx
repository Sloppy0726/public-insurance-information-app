'use client';

import Link from 'next/link';
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
import type { FwdCompareData, FwdCompareRow } from '@/lib/fwd-compare';

type Props = FwdCompareData;

type TermKey = '2Y' | '5Y' | '10Y' | '20Y' | '25Y' | '30Y' | 'OUT';
type ModeKey = 'MONTHLY' | 'ANNUAL' | 'SINGLE';

const COLORS = ['#2563eb', '#059669', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#be185d'];
const TERM_OPTIONS: Array<{ key: TermKey; label: string }> = [
  { key: '2Y', label: '2年供' },
  { key: '5Y', label: '5年供' },
  { key: '10Y', label: '10年供' },
  { key: '20Y', label: '20年供' },
  { key: '25Y', label: '25年供' },
  { key: '30Y', label: '30年供' },
  { key: 'OUT', label: '其他/Fullpay' },
];
const MODE_OPTIONS: Array<{ key: ModeKey; label: string }> = [
  { key: 'MONTHLY', label: '月供' },
  { key: 'ANNUAL', label: '年供' },
  { key: 'SINGLE', label: '一次性' },
];
const CATEGORY_LABELS: Record<string, string> = {
  savings: '儲蓄',
  'life-savings': '人壽儲蓄',
  life: '人壽',
  'critical-illness': '危疾',
  annuity: '年金',
};
const CATEGORY_ORDER = ['savings', 'life-savings', 'annuity', 'critical-illness', 'life'];

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

function bucketFor(term: TermKey, mode: ModeKey) {
  if (term === 'OUT') return 'OUT_OF_SCOPE';
  return `${term}_${mode}`;
}

function bucketLabel(bucket: string) {
  if (bucket === 'OUT_OF_SCOPE') return '其他 / 原始 proposal 條件';
  const [term, mode] = bucket.split('_');
  const termLabel = TERM_OPTIONS.find(item => item.key === term)?.label ?? term;
  const modeLabel = MODE_OPTIONS.find(item => item.key === mode)?.label ?? mode;
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

function ratioLabel(ratio: number | null | undefined) {
  if (ratio == null || Number.isNaN(ratio)) return '未有';
  return `${(ratio * 100).toFixed(1)}%`;
}

function percentLabel(percent: number | null | undefined) {
  if (percent == null || Number.isNaN(percent)) return '未有';
  return `${percent.toFixed(1)}%`;
}

function premiumLabel(row: FwdCompareRow) {
  if (row.premiumAmount == null) return '未有';
  if (row.paymentMode === 'MONTHLY') return `${money(row.premiumAmount, row.currency)} / 月`;
  if (row.paymentMode === 'ANNUAL') return `${money(row.premiumAmount, row.currency)} / 年`;
  if (row.paymentMode === 'SINGLE') return `${money(row.premiumAmount, row.currency)} 一次性`;
  return money(row.premiumAmount, row.currency);
}

function targetLabel(row: FwdCompareRow) {
  if (row.comparisonBasisType === 'PROTECTION_SUM_INSURED') {
    return row.actualBasisAmount ? `保額 ${money(row.actualBasisAmount, row.currency)}` : '固定保額';
  }

  if (row.targetPremiumAmount != null) {
    if (row.paymentMode === 'MONTHLY') return `目標 ${money(row.targetPremiumAmount, row.currency)} / 月`;
    if (row.paymentMode === 'ANNUAL') return `目標 ${money(row.targetPremiumAmount, row.currency)} / 年`;
    return `目標保費 ${money(row.targetPremiumAmount, row.currency)}`;
  }

  if (row.targetTotalPremiumPaid != null) {
    return `目標總供款 ${money(row.targetTotalPremiumPaid, row.currency)}`;
  }

  return '未定 budget';
}

function quoteBasisLabel(row: FwdCompareRow) {
  if (row.requestedInputType === 'premium') return '保費輸入 quote';
  if (row.requestedInputType === 'sum_insured') {
    return row.actualBasisAmount ? `固定保額 ${money(row.actualBasisAmount, row.currency)}` : '固定保額 quote';
  }
  if (row.requestedInputType === 'notional_amount') {
    return row.actualBasisAmount ? `固定名義金額 ${money(row.actualBasisAmount, row.currency)}` : '固定名義金額 quote';
  }
  return row.requestedInputType ? `${row.requestedInputType.replaceAll('_', ' ')} quote` : 'quote basis 未知';
}

function isFixedAmountBudgetCheck(row: FwdCompareRow) {
  return row.comparisonBasisType === 'CONSUMER_PREMIUM_BUDGET'
    && (row.requestedInputType === 'sum_insured' || row.requestedInputType === 'notional_amount');
}

function budgetDeltaLabel(row: FwdCompareRow) {
  if (row.budgetDeltaPct == null) return row.comparable ? '同一 basis' : '不可比較';
  const sign = row.budgetDeltaPct > 0 ? '+' : '';
  const delta = `${sign}${(row.budgetDeltaPct * 100).toFixed(1)}% vs target`;
  if (isFixedAmountBudgetCheck(row)) {
    return row.comparable ? `固定保額，保費接近 budget (${delta})` : `固定保額，未按 budget 反推 (${delta})`;
  }
  return delta;
}

function exclusionLabel(row: FwdCompareRow) {
  if (isFixedAmountBudgetCheck(row)) {
    return '呢條係固定保額/名義金額 quote，不是用同一保費重新 quote；要先用目標保費反推保障額，先可以當成同一 budget 比較。';
  }
  return row.exclusionReason ?? budgetDeltaLabel(row);
}

function sourceTone(row: FwdCompareRow) {
  if (!row.comparable) return 'border-slate-200 bg-slate-50 text-slate-500';
  if (row.curve.length > 0) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (row.sourceQuality === 'Portal confirmed') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function compareRows(a: FwdCompareRow, b: FwdCompareRow) {
  const comparableDiff = Number(b.comparable) - Number(a.comparable);
  if (comparableDiff !== 0) return comparableDiff;
  const curveDiff = Number(b.curve.length > 0) - Number(a.curve.length > 0);
  if (curveDiff !== 0) return curveDiff;
  const returnDiff = (b.year20SurrenderToPaidPct ?? -1) - (a.year20SurrenderToPaidPct ?? -1);
  if (returnDiff !== 0) return returnDiff;
  return a.productNameZh.localeCompare(b.productNameZh, 'zh-Hant');
}

function countRows(rows: FwdCompareRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.comparisonBucket] = (counts[row.comparisonBucket] ?? 0) + 1;
    return counts;
  }, {});
}

function buildChartData(rows: FwdCompareRow[]) {
  const years = [...new Set(rows.flatMap(row => row.curve.map(point => point.year)))].sort((a, b) => a - b);
  return years.map(year => {
    const point: Record<string, number | null> & { year: number; breakeven: number } = { year, breakeven: 100 };
    rows.forEach(row => {
      const value = row.curve.find(item => item.year === year);
      point[row.id] = value?.surrenderToPaidPct ?? null;
    });
    return point;
  });
}

function CompareChart({ rows }: { rows: FwdCompareRow[] }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 360 });
  const chartRows = rows.filter(row => row.curve.length > 0).slice(0, 8);
  const chartData = buildChartData(chartRows);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const rect = frame.getBoundingClientRect();
      setChartSize({
        width: Math.max(280, Math.floor(rect.width)),
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
      <div className="rounded-lg border border-dashed bg-white p-6 text-center shadow-sm">
        <h2 className="font-black text-slate-900">呢格暫時只有保費，未有回報曲線</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
          Portal quote 可以確認月供/年供保費，但 10/20/30 年退保價值要靠同一供款方式嘅 proposal illustration。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">退保價值 / 已供保費走勢</h2>
          <p className="text-sm text-slate-500">100% = 回本線；只畫有完整 illustration curve 嘅 rows。</p>
        </div>
        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {chartRows.length} 條 curve
        </span>
      </div>

      <div ref={frameRef} className="h-[360px] w-full">
        {chartSize.width > 0 && (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={chartData}
            margin={{ top: 12, right: 20, left: 0, bottom: 8 }}
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
              width={58}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={value => `${Math.round(Number(value))}%`}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'breakeven') return ['100%', '回本線'];
                const row = chartRows.find(item => item.id === name);
                return [percentLabel(Number(value)), row?.productNameZh ?? String(name)];
              }}
              labelFormatter={label => `第 ${label} 年`}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend
              verticalAlign="bottom"
              height={48}
              formatter={value => {
                if (value === 'breakeven') return '回本線';
                const row = chartRows.find(item => item.id === value);
                return row ? row.productNameZh : value;
              }}
            />
            <ReferenceLine y={100} stroke="#64748b" strokeDasharray="6 6" />
            {chartRows.map((row, index) => (
              <Line
                key={row.id}
                type="monotone"
                dataKey={row.id}
                name={row.id}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </div>
    </div>
  );
}

function SummaryCards({ rows }: { rows: FwdCompareRow[] }) {
  const rowsWithCurve = rows.filter(row => row.curve.length > 0);
  const best20 = rowsWithCurve
    .filter(row => row.year20SurrenderToPaidPct != null)
    .slice()
    .sort((a, b) => (b.year20SurrenderToPaidPct ?? 0) - (a.year20SurrenderToPaidPct ?? 0))[0];
  const cheapest = rows
    .filter(row => row.premiumAmount != null)
    .slice()
    .sort((a, b) => (a.premiumAmount ?? Infinity) - (b.premiumAmount ?? Infinity))[0];

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500">可比較 rows</p>
        <p className="mt-2 text-3xl font-black text-slate-950">{rows.length}</p>
      </div>
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500">有 curve</p>
        <p className="mt-2 text-3xl font-black text-slate-950">{rowsWithCurve.length}</p>
      </div>
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500">20年退保/已供較高</p>
        <p className="mt-2 text-xl font-black text-slate-950">{best20 ? ratioLabel(best20.year20SurrenderToPaidPct) : '未有'}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{best20?.productNameZh ?? '呢格未有回報資料'}</p>
      </div>
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500">實際保費較低</p>
        <p className="mt-2 text-xl font-black text-slate-950">{cheapest ? premiumLabel(cheapest) : '未有'}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{cheapest?.productNameZh ?? '未有保費資料'}</p>
      </div>
    </section>
  );
}

function CompareTable({ rows }: { rows: FwdCompareRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-white p-6 text-center shadow-sm">
        <h2 className="font-black text-slate-900">呢格未有同一 consumer budget 嘅可比較 rows</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
          做唔到 USD 15,600/年或 USD 1,300/月 target 嘅 plan 會排除，避免用唔同保費 basis 扮比較。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">保費同回報比較</h2>
        <p className="text-sm text-slate-500">只顯示同一 consumer budget 或同一保障保額 basis 嘅 rows。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1220px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              <th className="border-b px-3 py-2">Product</th>
              <th className="border-b px-3 py-2">條件</th>
              <th className="border-b px-3 py-2">Budget basis</th>
              <th className="border-b px-3 py-2">Quote basis</th>
              <th className="border-b px-3 py-2 text-right">保費</th>
              <th className="border-b px-3 py-2 text-right">總供款</th>
              <th className="border-b px-3 py-2 text-right">10Y</th>
              <th className="border-b px-3 py-2 text-right">20Y</th>
              <th className="border-b px-3 py-2 text-right">30Y</th>
              <th className="border-b px-3 py-2 text-right">回本</th>
              <th className="border-b px-3 py-2">Data</th>
              <th className="border-b px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="align-top">
                <td className="border-b px-3 py-3">
                  <p className="font-black text-slate-900">{row.productNameZh}</p>
                  <p className="mt-1 text-xs text-slate-500">{categoryLabel(row.category)} · {row.productFamilyId}</p>
                </td>
                <td className="border-b px-3 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {bucketLabel(row.comparisonBucket)}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">{row.standardStatus?.replaceAll('_', ' ') ?? 'status unknown'}</p>
                </td>
                <td className="border-b px-3 py-3">
                  <p className="font-semibold text-slate-800">{targetLabel(row)}</p>
                  <p className={`mt-1 text-xs font-semibold ${row.budgetFit ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {budgetDeltaLabel(row)}
                  </p>
                </td>
                <td className="border-b px-3 py-3">
                  <p className="font-semibold text-slate-800">{quoteBasisLabel(row)}</p>
                  {isFixedAmountBudgetCheck(row) && (
                    <p className="mt-1 text-xs leading-relaxed text-amber-700">
                      保費只係對照 budget；呢行唔代表已用目標保費反推。
                    </p>
                  )}
                </td>
                <td className="border-b px-3 py-3 text-right font-semibold">{premiumLabel(row)}</td>
                <td className="border-b px-3 py-3 text-right font-semibold">{money(row.totalPremiumPaid, row.currency)}</td>
                <td className="border-b px-3 py-3 text-right font-semibold">{ratioLabel(row.year10SurrenderToPaidPct)}</td>
                <td className="border-b px-3 py-3 text-right text-base font-black text-slate-900">{ratioLabel(row.year20SurrenderToPaidPct)}</td>
                <td className="border-b px-3 py-3 text-right font-semibold">{ratioLabel(row.year30SurrenderToPaidPct)}</td>
                <td className="border-b px-3 py-3 text-right font-semibold">{row.breakevenYearProjected ? `${row.breakevenYearProjected}年` : '未有'}</td>
                <td className="border-b px-3 py-3">
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${sourceTone(row)}`}>
                    {row.curve.length > 0 ? `${row.curve.length}年 curve` : '只有保費'}
                  </span>
                </td>
                <td className="max-w-[18rem] border-b px-3 py-3 text-xs text-slate-500">
                  <span className="line-clamp-2">{row.sourceFile ?? row.sourceQuality ?? '未有 source'}</span>
                  {row.extractionNote && <p className="mt-1 line-clamp-2 text-amber-700">{row.extractionNote}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExcludedRows({ rows }: { rows: FwdCompareRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">需要重 quote / 不可直接比較</h2>
        <p className="text-sm text-slate-500">以下 rows 係真 quote，但未係同一保費 basis，所以唔放入比較表。</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map(row => (
          <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-900">{row.productNameZh}</p>
                <p className="mt-1 text-xs text-slate-500">{bucketLabel(row.comparisonBucket)} · {targetLabel(row)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{quoteBasisLabel(row)}</p>
              </div>
              <p className="shrink-0 text-right font-semibold text-slate-800">{premiumLabel(row)}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-amber-700">
              {exclusionLabel(row)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FwdCompareClient({ rows, stats }: Props) {
  const [category, setCategory] = useState('savings');
  const [term, setTerm] = useState<TermKey>('5Y');
  const [mode, setMode] = useState<ModeKey>('ANNUAL');

  const categoryOptions = useMemo(() => {
    const counts = rows.reduce<Record<string, { total: number; usable: number }>>((acc, row) => {
      acc[row.category] = acc[row.category] ?? { total: 0, usable: 0 };
      acc[row.category].total += 1;
      if (row.comparable) acc[row.category].usable += 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort(([a], [b]) => {
        const indexA = CATEGORY_ORDER.indexOf(a);
        const indexB = CATEGORY_ORDER.indexOf(b);
        return (indexA === -1 ? CATEGORY_ORDER.length : indexA) - (indexB === -1 ? CATEGORY_ORDER.length : indexB);
      })
      .map(([key, count]) => ({ key, ...count, label: categoryLabel(key) }));
  }, [rows]);

  const selectedBucket = bucketFor(term, mode);
  const comparableRows = useMemo(() => rows.filter(row => row.comparable), [rows]);
  const bucketCounts = useMemo(() => countRows(comparableRows.filter(row => row.category === category)), [category, comparableRows]);
  const visibleRows = useMemo(() => rows
    .filter(row => row.comparable && row.category === category && row.comparisonBucket === selectedBucket)
    .slice()
    .sort(compareRows), [category, rows, selectedBucket]);

  const excludedRows = useMemo(() => rows
    .filter(row => !row.comparable && row.category === category && row.comparisonBucket === selectedBucket)
    .slice()
    .sort(compareRows), [category, rows, selectedBucket]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                返回首頁
              </Link>
              <h1 className="mt-2 text-2xl font-black tracking-normal">FWD 消費者預算比較</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                Wealth 類產品用消費者供款做 standard：年供 USD 15,600、月供 USD 1,300。有啲 row 係固定保額 quote，只係用實際保費對照 budget；唔代表產品一定做唔到同一保費。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/fwd-inventory"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                Inventory Audit
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
        <section className="grid gap-3 md:grid-cols-4">
          {[
            { label: 'All source rows', value: stats.totalRows },
            { label: 'Comparable rows', value: stats.comparableRows },
            { label: 'Budget rows', value: stats.consumerBudgetRows },
            { label: 'Budget excluded', value: stats.budgetExcludedRows },
          ].map(item => (
            <div key={item.label} className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-black text-slate-900">產品類型</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoryOptions.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setCategory(option.key)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      category === option.key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {option.label} {option.usable}/{option.total}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_0.8fr]">
              <div>
                <p className="text-sm font-black text-slate-900">供款年期</p>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {TERM_OPTIONS.map(option => {
                    const previewBucket = bucketFor(option.key, mode);
                    const count = bucketCounts[previewBucket] ?? 0;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setTerm(option.key)}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                          term === option.key
                            ? 'border-blue-700 bg-blue-700 text-white'
                            : count > 0
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      >
                        {option.label}
                        <span className="ml-1 opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-black text-slate-900">付款方式</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {MODE_OPTIONS.map(option => {
                    const previewBucket = bucketFor(term, option.key);
                    const count = bucketCounts[previewBucket] ?? 0;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setMode(option.key)}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                          mode === option.key
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : count > 0
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      >
                        {option.label}
                        <span className="ml-1 opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            重要：年供 target = USD 15,600；月供 target = USD 1,300。保費輸入 quote 可以直接比較；固定保額 / 名義金額 quote 要先重 quote 到同一保費，否則只可以當參考。
          </div>
        </section>

        <div className="mt-4">
          <SummaryCards rows={visibleRows} />
        </div>

        <section className="mt-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2 className="text-lg font-black">{categoryLabel(category)} · {bucketLabel(selectedBucket)}</h2>
              <p className="text-sm text-slate-500">
                {visibleRows.length > 0 ? `${visibleRows.length} rows meet the consumer budget standard` : '呢個 exact bucket 暫時未有符合 consumer budget 嘅 rows。'}
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {visibleRows.filter(row => row.curve.length > 0).length} curve rows
            </span>
          </div>

          <div className="space-y-4">
            <CompareChart rows={visibleRows} />
            <CompareTable rows={visibleRows} />
            <ExcludedRows rows={excludedRows} />
          </div>
        </section>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
          以上只作資料整理、排序及情境模擬，不構成投保、轉保或退保建議。本平台現階段不安排任何保險合約。
        </p>
      </main>
    </div>
  );
}
