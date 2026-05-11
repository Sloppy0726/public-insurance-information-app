export const PAYMENT_TERM_BUCKETS = [
  { key: '2Y', years: 2, label: '2年供' },
  { key: '5Y', years: 5, label: '5年供' },
  { key: '10Y', years: 10, label: '10年供' },
] as const;

export const PAYMENT_MODE_BUCKETS = [
  { key: 'MONTHLY', label: '月供' },
  { key: 'ANNUAL', label: '年供' },
  { key: 'SINGLE', label: 'Fullpay' },
] as const;

export type PaymentTermBucket = typeof PAYMENT_TERM_BUCKETS[number]['key'];
export type PaymentModeBucket = typeof PAYMENT_MODE_BUCKETS[number]['key'];
export type ComparisonBucket = `${PaymentTermBucket}_${PaymentModeBucket}` | 'OUT_OF_SCOPE';

export function normalizePaymentMode(mode: string | null | undefined): PaymentModeBucket | null {
  const normalized = mode?.toUpperCase();
  if (normalized === 'MONTHLY') return 'MONTHLY';
  if (normalized === 'ANNUAL') return 'ANNUAL';
  if (normalized === 'SINGLE' || normalized === 'FULLPAY' || normalized === 'FULL_PAY') return 'SINGLE';
  return null;
}

export function paymentTermBucketFromYears(years: number | null | undefined): PaymentTermBucket | null {
  if (years === 2) return '2Y';
  if (years === 5) return '5Y';
  if (years === 10) return '10Y';
  return null;
}

export function deriveComparisonBucket(
  paymentTermYears: number | null | undefined,
  paymentMode: string | null | undefined
): ComparisonBucket {
  const termBucket = paymentTermBucketFromYears(paymentTermYears);
  const modeBucket = normalizePaymentMode(paymentMode);

  if (!termBucket || !modeBucket) return 'OUT_OF_SCOPE';
  return `${termBucket}_${modeBucket}` as ComparisonBucket;
}

export function comparisonBucketLabel(bucket: string | null | undefined) {
  if (!bucket || bucket === 'OUT_OF_SCOPE') return '未納入九格比較';
  const [term, mode] = bucket.split('_');
  const termLabel = PAYMENT_TERM_BUCKETS.find(item => item.key === term)?.label ?? term;
  const modeLabel = PAYMENT_MODE_BUCKETS.find(item => item.key === mode)?.label ?? mode;
  return `${termLabel} · ${modeLabel}`;
}
