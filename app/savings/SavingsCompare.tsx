'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
import {
  comparisonBucketLabel,
  PAYMENT_MODE_BUCKETS,
  PAYMENT_TERM_BUCKETS,
  type PaymentModeBucket,
  type PaymentTermBucket,
} from '@/lib/quote-buckets';
import type { Plan } from '@/lib/types';

const COLORS = [
  '#2563eb',
  '#ea580c',
  '#059669',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#ca8a04',
  '#be185d',
  '#4f46e5',
  '#16a34a',
  '#9333ea',
  '#0f766e',
];

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

function fmtPct(n: number) {
  return Number.isFinite(n) ? `${Number(n.toFixed(1))}%` : '未計';
}

function planKey(plan: Plan) {
  return plan.id ?? `${plan.company}-${plan.product_name_zh}`;
}

function premiumLabel(plan: Plan) {
  const actualPremium = plan.premium.actual_premium
    ?? (plan.premium.payment_mode === 'MONTHLY' ? plan.premium.monthly : plan.premium.annual_equivalent);

  if (plan.premium.payment_mode === 'SINGLE') {
    return `Fullpay $${fmt(actualPremium)}`;
  }

  if (plan.premium.payment_mode === 'ANNUAL') {
    return `每年 $${fmt(actualPremium)}`;
  }

  return `每月 $${fmt(actualPremium)}`;
}

function rowRatio(row: { total_paid: number; total_surrender: number } | undefined) {
  if (!row || row.total_paid <= 0) return 0;
  return (row.total_surrender / row.total_paid) * 100;
}

type WeightKey = 'earlyLoss' | 'guarantee' | 'projectedReturn' | 'longTerm';
type Weights = Record<WeightKey, number>;

const WEIGHT_LABELS: Record<WeightKey, { zh: string; desc: string }> = {
  earlyLoss:       { zh: '低退保損失',   desc: '頭5年退保蝕得少' },
  guarantee:       { zh: '保證回報',      desc: '保證部分佔比高' },
  projectedReturn: { zh: '退保比例',      desc: '20年退保/已供高' },
  longTerm:        { zh: '長線增長',      desc: '30年後總值' },
};

function calcScore(plan: Plan, w: Weights): number {
  const earlyLoss = 100 - plan.xray.year5_surrender_loss_pct;
  const row20 = plan.surrender_value_table.find(r => r.year === 20);
  const guarantee = row20 && row20.total_paid > 0 ? (row20.guaranteed / row20.total_paid) * 100 : 0;
  const projected = rowRatio(row20);
  const row30 = plan.surrender_value_table.find(r => r.year === 30);
  const longTerm = rowRatio(row30);

  const total = w.earlyLoss + w.guarantee + w.projectedReturn + w.longTerm;
  if (total === 0) return 0;

  return (earlyLoss * w.earlyLoss + guarantee * w.guarantee + projected * w.projectedReturn + longTerm * w.longTerm) / total;
}

function LossBar({ pct, usd }: { pct: number; usd: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">蝕咗</span>
        <span className="font-bold text-red-600">-${fmt(usd)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
        <div className="h-full bg-red-500 rounded-full flex items-center justify-end pr-2 transition-all duration-700"
          style={{ width: `${pct}%`, minWidth: pct > 0 ? '2rem' : 0 }}>
          <span className="text-white text-xs font-bold">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

const KEY_YEARS = [1, 2, 3, 5, 10, 15, 20, 25, 30];

type ChartPoint = {
  year: number;
  premiumLine: number;
} & Record<string, number | null>;

function SurrenderValueChart({
  plans,
  title = '退保價值走勢',
  subtitle = '虛線 = 回本線 100%；所有計劃以已供保費比例比較',
  badge = '1-30年',
}: {
  plans: Plan[];
  title?: string;
  subtitle?: string;
  badge?: string;
}) {
  const chartFrameRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 300 });
  const chartData: ChartPoint[] = KEY_YEARS.map(year => {
    const point: ChartPoint = { year, premiumLine: 100 };

    plans.forEach(plan => {
      const row = plan.surrender_value_table.find(item => item.year === year);
      point[planKey(plan)] = row && row.total_paid > 0
        ? Number(((row.total_surrender / row.total_paid) * 100).toFixed(1))
        : null;
    });

    return point;
  });

  useEffect(() => {
    const frame = chartFrameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const rect = frame.getBoundingClientRect();
      setChartSize({
        width: Math.max(280, Math.floor(rect.width)),
        height: Math.max(280, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 whitespace-nowrap">
          {badge}
        </span>
      </div>

      <div ref={chartFrameRef} className="h-[300px] w-full min-[640px]:h-[340px]">
        {chartSize.width > 0 && chartSize.height > 0 && (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={chartData}
            margin={{ top: 12, right: 12, left: -8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={value => `${value}年`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={value => `${Math.round(Number(value))}%`}
              width={48}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'premiumLine') return [`${fmt(Number(value))}%`, '回本線'];
                const plan = plans.find(p => planKey(p) === name);
                return [`${fmtPct(Number(value))}`, plan ? `${plan.company_zh} · ${plan.product_name_zh}` : name];
              }}
              labelFormatter={label => `第 ${label} 年`}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                boxShadow: '0 8px 30px rgb(15 23 42 / 0.12)',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={44}
              formatter={value => {
                const plan = plans.find(p => planKey(p) === value);
                return plan ? `${plan.company_zh} · ${plan.product_name_zh}` : (value === 'premiumLine' ? '回本線' : value);
              }}
            />
            <ReferenceLine
              y={100}
              stroke="#64748b"
              strokeDasharray="6 6"
              label={{ value: '100%', fill: '#64748b', fontSize: 12, position: 'insideTopRight' }}
            />
            {plans.map((plan, i) => (
              <Line
                key={planKey(plan)}
                type="monotone"
                dataKey={planKey(plan)}
                name={planKey(plan)}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 2 }}
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

function bucketId(term: PaymentTermBucket, mode: PaymentModeBucket) {
  return `${term}_${mode}`;
}

function countByBucket(plans: Plan[]) {
  return plans.reduce<Record<string, number>>((counts, plan) => {
    const bucket = plan.comparison_bucket ?? 'OUT_OF_SCOPE';
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    return counts;
  }, {});
}

function QuoteBucketPicker({
  selectedTerm,
  selectedMode,
  counts,
  onTermChange,
  onModeChange,
}: {
  selectedTerm: PaymentTermBucket;
  selectedMode: PaymentModeBucket;
  counts: Record<string, number>;
  onTermChange: (term: PaymentTermBucket) => void;
  onModeChange: (mode: PaymentModeBucket) => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">比較條件</p>
          <p className="mt-0.5 text-xs text-gray-400">{comparisonBucketLabel(bucketId(selectedTerm, selectedMode))}</p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {counts[bucketId(selectedTerm, selectedMode)] ?? 0} 份
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">供款年期</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_TERM_BUCKETS.map(term => (
              <button
                key={term.key}
                type="button"
                onClick={() => onTermChange(term.key)}
                className={`rounded-md border px-2 py-2 text-sm font-semibold transition ${
                  selectedTerm === term.key
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {term.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">付款方式</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_MODE_BUCKETS.map(mode => {
              const nextBucket = bucketId(selectedTerm, mode.key);
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => onModeChange(mode.key)}
                  className={`rounded-md border px-2 py-2 text-sm font-semibold transition ${
                    selectedMode === mode.key
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{mode.label}</span>
                  <span className={`ml-1 text-xs ${selectedMode === mode.key ? 'text-blue-100' : 'text-gray-400'}`}>
                    {counts[nextBucket] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BucketAvailability({
  counts,
  selectedBucket,
  onPick,
}: {
  counts: Record<string, number>;
  selectedBucket: string;
  onPick: (term: PaymentTermBucket, mode: PaymentModeBucket) => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">九格資料狀態</h2>
        <span className="text-xs text-gray-400">只顯示實際抽到嘅 quote</span>
      </div>
      <div className="grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] gap-1.5 text-center text-xs">
        <div />
        {PAYMENT_MODE_BUCKETS.map(mode => (
          <div key={mode.key} className="font-semibold text-gray-500">{mode.label}</div>
        ))}
        {PAYMENT_TERM_BUCKETS.map(term => (
          <div key={term.key} className="contents">
            <div className="flex items-center justify-center rounded bg-gray-50 px-1 font-semibold text-gray-600">
              {term.label}
            </div>
            {PAYMENT_MODE_BUCKETS.map(mode => {
              const key = bucketId(term.key, mode.key);
              const count = counts[key] ?? 0;
              const active = key === selectedBucket;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPick(term.key, mode.key)}
                  className={`rounded-md border px-1.5 py-2 font-semibold transition ${
                    active
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : count > 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-50 text-gray-400'
                  }`}
                >
                  {count > 0 ? `${count}份` : '未有'}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SavingsCompare({ plans }: { plans: Plan[] }) {
  const [selectedTerm, setSelectedTerm] = useState<PaymentTermBucket>('5Y');
  const [selectedMode, setSelectedMode] = useState<PaymentModeBucket>('ANNUAL');
  const [selectedGroup, setSelectedGroup] = useState<'savings' | 'annuity'>('savings');
  const [weights, setWeights] = useState<Weights>({ earlyLoss: 25, guarantee: 25, projectedReturn: 25, longTerm: 25 });
  const [selectedYears, setSelectedYears] = useState<number[]>([3, 5, 10, 20, 30]);
  const [activeTab, setActiveTab] = useState<'rank' | 'xray' | 'table'>('xray');
  const groupPlans = plans.filter(plan => selectedGroup === 'annuity' ? plan.category === 'annuity' : plan.category !== 'annuity');
  const bucketCounts = countByBucket(groupPlans);
  const selectedBucket = bucketId(selectedTerm, selectedMode);
  const visiblePlans = groupPlans.filter(plan => plan.comparison_bucket === selectedBucket);
  const oneYearPlans = groupPlans
    .filter(plan => plan.premium.payment_term_years === 1 && plan.surrender_value_table.length > 0)
    .slice(0, 8);

  const scored = [...visiblePlans]
    .map((p, i) => ({ plan: p, score: calcScore(p, weights), color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.score - a.score);
  const pdfPlanCount = visiblePlans.filter(plan => plan.source_kind === 'pdf-proposal').length;
  const bocPlanCount = visiblePlans.filter(plan => plan.company === 'BOC Life').length;
  const totalPdfPlanCount = groupPlans.filter(plan => plan.source_kind === 'pdf-proposal').length;

  const toggleYear = (y: number) =>
    setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y].sort((a, b) => a - b));

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">儲蓄保 X-Ray</h1>
          <p className="text-xs text-gray-400">數據話事 · 只做排序同模擬</p>
        </div>
        {/* Quote profile badge */}
        <div className="max-w-3xl mx-auto px-4 pb-2">
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
            {selectedGroup === 'annuity' ? '年金組' : '儲蓄組'} · {comparisonBucketLabel(selectedBucket)} · {visiblePlans.length}個計劃 · PDF {pdfPlanCount}/{totalPdfPlanCount}個 · BOC {bocPlanCount}個
          </span>
        </div>
      </header>

      {/* Tab nav */}
      <div className="bg-white border-b sticky top-[72px] z-10">
        <div className="max-w-3xl mx-auto px-2 min-[390px]:px-4 flex gap-0">
          {[
            { key: 'rank', label: '自訂排序', short: '排序' },
            { key: 'xray', label: '費用X-Ray', short: 'X-Ray' },
            { key: 'table', label: '逐年數據', short: '年份' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 py-3 text-xs min-[390px]:text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="hidden min-[390px]:inline">{tab.label}</span>
              <span className="min-[390px]:hidden">{tab.short}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="rounded-lg border bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedGroup('savings')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                selectedGroup === 'savings'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              儲蓄 / 終身儲蓄
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup('annuity')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                selectedGroup === 'annuity'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              年金
            </button>
          </div>
        </div>

        <QuoteBucketPicker
          selectedTerm={selectedTerm}
          selectedMode={selectedMode}
          counts={bucketCounts}
          onTermChange={setSelectedTerm}
          onModeChange={setSelectedMode}
        />

        <BucketAvailability
          counts={bucketCounts}
          selectedBucket={selectedBucket}
          onPick={(term, mode) => {
            setSelectedTerm(term);
            setSelectedMode(mode);
          }}
        />

        {visiblePlans.length === 0 && (
          <div className="rounded-lg border border-dashed bg-white p-5 text-center shadow-sm">
            <h2 className="text-base font-bold text-gray-900">{comparisonBucketLabel(selectedBucket)} 未有實際 quote</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              呢格會等下一批 PDF/portal data 抽到之後先出 curve。暫時唔用其他付款方式推算。
            </p>
          </div>
        )}

        {/* ─── TAB 1: SORTING ─── */}
        {visiblePlans.length > 0 && activeTab === 'rank' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">揀排序用嘅資料指標</p>
              <div className="space-y-3">
                {(Object.keys(weights) as WeightKey[]).map(key => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{WEIGHT_LABELS[key].zh}</span>
                      <span className="text-gray-400 text-xs">{WEIGHT_LABELS[key].desc}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0} max={100} value={weights[key]}
                        onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        className="flex-1 accent-blue-600 h-2"
                      />
                      <span className="text-xs text-blue-600 font-mono w-8 text-right">{weights[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {scored.map(({ plan, score, color }, i) => {
                const row20 = plan.surrender_value_table.find(r => r.year === 20);
                return (
                  <div key={planKey(plan)} className="bg-white rounded-2xl shadow-sm border p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
                        排序 {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{plan.company_zh}</span>
                          {plan.source_kind === 'pdf-proposal' && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">PDF</span>
                          )}
                          <span className="text-sm text-gray-500 truncate">{plan.product_name_zh}</span>
                        </div>
                        <div className="mt-2 w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }} />
                        </div>
                        <div className="mt-2 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-gray-50 rounded-lg px-2 py-2">
                            <p className="text-gray-400">5年退保蝕</p>
                            <p className="font-bold text-red-600">{plan.xray.year5_surrender_loss_pct}%</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg px-2 py-2">
                            <p className="text-gray-400">20年退保/已供</p>
                            <p className="font-bold text-green-600">{fmtPct(rowRatio(row20))}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg px-2 py-2">
                            <p className="text-gray-400">保費起點</p>
                            <p className="font-bold text-blue-600">{premiumLabel(plan)}</p>
                          </div>
                        </div>
                        {plan.discount_info?.discount_available && (
                          <p className="mt-2 text-xs text-emerald-700">
                            折扣 {plan.discount_info.discount_code ?? ''} ·
                            折後 ${fmt(plan.discount_info.premium_after_discount ?? 0)} ·
                            減 ${fmt(plan.discount_info.discount_amount ?? 0)}
                          </p>
                        )}
                        <p className="mt-2 text-xs leading-relaxed text-gray-400">{plan.comparison_basis}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-gray-400 text-center px-2">
              排序由用戶自選指標計算，只作資料展示，不構成任何投保、轉保或退保建議。本平台不安排任何保險合約。
            </p>
          </div>
        )}

        {/* ─── TAB 2: X-RAY ─── */}
        {visiblePlans.length > 0 && activeTab === 'xray' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-900">注意：FWD PDF 已接入，但數字仍需逐份對原文</p>
              <p className="text-xs text-amber-700 mt-1">
                呢格有 {visiblePlans.length} 個 savings-like 計劃，當中 {pdfPlanCount} 個來自 FWD proposal PDF。所有 curve 只喺同一付款條件內比較。
              </p>
            </div>

            <SurrenderValueChart
              plans={visiblePlans}
              title={selectedGroup === 'annuity' ? '年金回本走勢' : '儲蓄保回本走勢'}
            />

            {oneYearPlans.length > 0 && (
              <SurrenderValueChart
                plans={oneYearPlans}
                title="1年供獨立走勢"
                subtitle="一年供款計劃獨立比較（不與2/5/10年供混合）"
                badge="1年供"
              />
            )}

            {/* Early loss */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-5">
              <h2 className="font-semibold text-gray-900">提早退保損失</h2>
              {scored.map(({ plan, color }) => (
                <div key={planKey(plan)}>
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-medium text-sm whitespace-nowrap">{plan.company_zh}</span>
                    <span className="text-xs text-gray-400 truncate">{plan.product_name_zh}</span>
                  </div>
                  <div className="space-y-2 min-[420px]:ml-5">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">第3年退保</p>
                      <LossBar pct={plan.xray.year3_surrender_loss_pct} usd={plan.xray.year3_surrender_loss_usd} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">第5年退保（供款完成後）</p>
                      <LossBar pct={plan.xray.year5_surrender_loss_pct} usd={plan.xray.year5_surrender_loss_usd} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Guaranteed vs non-guaranteed */}
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <h2 className="font-semibold text-gray-900 mb-1">第20年退保價值組成</h2>
              <p className="text-xs text-gray-400 mb-4">綠色 = 保證 · 黃色 = 非保證（唔係一定有）</p>
              <div className="space-y-4">
                {scored.map(({ plan, color }) => {
                  const row20 = plan.surrender_value_table.find(r => r.year === 20);
                  const gPct = row20 && row20.total_surrender > 0
                    ? Math.min(100, Math.max(0, Math.round((row20.guaranteed / row20.total_surrender) * 100)))
                    : 0;
                  const ngPct = Math.max(0, 100 - gPct);
                  return (
                    <div key={planKey(plan)}>
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-medium truncate">{plan.company_zh}</span>
                        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{fmtPct(rowRatio(row20))}</span>
                      </div>
                      <div className="w-full">
                        <div className="w-full h-6 rounded-full overflow-hidden flex">
                          <div className="h-full bg-green-500 flex items-center justify-center"
                            style={{ width: `${gPct}%` }}>
                            {gPct > 10 && <span className="text-white text-xs font-bold">{gPct}%</span>}
                          </div>
                          <div className="h-full bg-yellow-400 flex items-center justify-center"
                            style={{ width: `${ngPct}%` }}>
                            {ngPct > 10 && <span className="text-white text-xs font-bold">{ngPct}%</span>}
                          </div>
                        </div>
                        <div className="mt-1 grid grid-cols-1 gap-0.5 text-xs text-gray-500 min-[420px]:grid-cols-2">
                          <span>保證 ${fmt(row20?.guaranteed ?? 0)}</span>
                          <span className="min-[420px]:text-right">非保證 ${fmt((row20?.total_surrender ?? 0) - (row20?.guaranteed ?? 0))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ratio table */}
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <h2 className="font-semibold text-gray-900 mb-3">第20年保證 vs 退保比例</h2>
              <div className="space-y-2">
                {scored.map(({ plan, color }) => (
                  <div key={planKey(plan)} className="grid grid-cols-[0.75rem_1fr] gap-x-3 gap-y-2 py-2 border-b last:border-0">
                    <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium leading-snug">{plan.company_zh} · {plan.product_name_zh}</span>
                    <div className="col-start-2 flex flex-wrap gap-2 min-[420px]:gap-3 text-xs">
                      <span className="bg-red-50 text-red-700 px-2 py-1 rounded">20年保證/已供: {plan.xray.guaranteed_irr_20y}</span>
                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded">20年退保/已供: {plan.xray.projected_irr_20y}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">以上比例 = 第20年金額 / 該年度已供保費總額。</p>
            </div>
          </div>
        )}

        {/* ─── TAB 3: TABLE ─── */}
        {visiblePlans.length > 0 && activeTab === 'table' && (
          <div className="space-y-4">
            {/* Year selector */}
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">揀年份睇</p>
              <div className="flex flex-wrap gap-2">
                {KEY_YEARS.map(y => (
                  <button key={y} onClick={() => toggleYear(y)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      selectedYears.includes(y)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                    第{y}年
                  </button>
                ))}
              </div>
            </div>

            {/* Cards per year */}
            {selectedYears.map(year => {
              const rows = visiblePlans.map(p => ({
                plan: p,
                row: p.surrender_value_table.find(r => r.year === year),
              }));
              const highestRatio = Math.max(...rows.map(({ row }) => rowRatio(row)));
              const highestGuaranteed = rows.reduce<{ label: string; ratio: number; guaranteed: number }>(
                (currentBest, { plan, row }) => {
                  const ratio = row && row.total_paid > 0 ? (row.guaranteed / row.total_paid) * 100 : 0;
                  return ratio > currentBest.ratio
                    ? { label: `${plan.company_zh} · ${plan.product_name_zh}`, ratio, guaranteed: row?.guaranteed ?? 0 }
                    : currentBest;
                },
                { label: '', ratio: 0, guaranteed: 0 }
              );

              return (
                <div key={year} className="bg-white rounded-2xl shadow-sm border p-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-bold text-gray-900">第 {year} 年</h3>
                    <span className="text-xs text-gray-400">按各自已供保費比較</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map(({ plan, row }, i) => {
                      const val = row?.total_surrender ?? 0;
                      const paid = row?.total_paid ?? 0;
                      const ratio = rowRatio(row);
                      const loss = val < paid;
                      const isHighest = ratio === highestRatio && highestRatio > 0;
                      return (
                        <div key={planKey(plan)} className={`flex items-center gap-3 p-2 rounded-xl ${isHighest ? 'bg-green-50' : 'bg-gray-50'}`}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{plan.company_zh}</span>
                            <span className="block truncate text-xs text-gray-400">{plan.product_name_zh}</span>
                            {isHighest && <span className="text-xs text-green-600">本年比例較高</span>}
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${loss ? 'text-red-600' : 'text-green-600'}`}>
                              {fmtPct(ratio)}
                            </p>
                            <p className="text-xs text-gray-400">${fmt(val)} / 已供 ${fmt(paid)}</p>
                            {loss && (
                              <p className="text-xs text-red-400">蝕 ${fmt(paid - val)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">保證比例較高</span>
                      <span className="font-medium text-green-700">
                        {highestGuaranteed.label} {fmtPct(highestGuaranteed.ratio)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-center text-xs text-gray-400 space-y-1 pt-2">
          <p>以上資料僅供參考，不構成任何投保建議。本平台不安排任何保險合約。</p>
          <p>數據來源：各保險公司建議書（2026年5月）。非保證部分可能與實際有重大差異。</p>
          <p>
            <Link href="/compliance" className="font-semibold text-blue-600 hover:text-blue-700">
              查看資料排序及模擬限制
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
