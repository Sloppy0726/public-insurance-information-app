import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractMoneyMetrics,
  normalizeProductId,
  parseManifestCsv,
  selectComparisonValuePoints,
} from '../scripts/build-product-data.mjs';

test('parseManifestCsv reads FWD proposal rows with adjusted premium notes', () => {
  const rows = parseManifestCsv(`status,category,product,variant,payment_mode,currency,input_amount_type,input_amount,portal_premium,portal_sum_insured,levy,filename,notes
downloaded,SAVING,智優盛儲蓄保險計劃,min_adjusted,SINGLE,USD,premium,15600,24999.83,34214,12.87,smart.pdf,Portal required higher premium than requested
`);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, 'SAVING');
  assert.equal(rows[0].product, '智優盛儲蓄保險計劃');
  assert.equal(rows[0].portal_premium, '24999.83');
  assert.equal(rows[0].notes, 'Portal required higher premium than requested');
});

test('normalizeProductId creates stable ASCII ids', () => {
  assert.equal(
    normalizeProductId('FWD', 'SAVING', '盈聚‧天下 II 保險計劃', 'base_5pay'),
    'fwd-saving-ying-ju-tian-xia-ii-bao-xian-ji-hua-base-5pay'
  );
});

test('extractMoneyMetrics finds surrender value and annuity IRR fields', () => {
  const text = `
投保時每年總保費 (1)：          7,655.47
保費徵費 (2)：            7.66
保單繕發日之退保價值︰22,503
每月保證年金金額 (A)                      :    495
每月非保證年金金額 (B)#                    :    205
每月年金金額 (A) + (B)#                 :    700
於年金期內每月提取所有每月年金金額                       1.85%                     3.34%
`;

  const metrics = extractMoneyMetrics(text);

  assert.equal(metrics.issue_surrender_value, 22503);
  assert.equal(metrics.annuity_monthly_guaranteed, 495);
  assert.equal(metrics.annuity_monthly_non_guaranteed, 205);
  assert.equal(metrics.annuity_monthly_total, 700);
  assert.equal(metrics.guaranteed_irr, '1.85%');
  assert.equal(metrics.projected_irr, '3.34%');
});

test('selectComparisonValuePoints keeps the policy value curve and drops death-benefit/noise rows', () => {
  const points = [
    { year: 1, age: null, total_paid: 8, guaranteed: 2026, total_surrender: 10 },
    { year: 1, age: 31, total_paid: 15600, guaranteed: 0, total_surrender: 0 },
    { year: 1, age: 31, total_paid: 15600, guaranteed: 15600, total_surrender: 15600 },
    { year: 2, age: 32, total_paid: 31200, guaranteed: 0, total_surrender: 374 },
    { year: 2, age: 32, total_paid: 31200, guaranteed: 31200, total_surrender: 31200 },
    { year: 3, age: 33, total_paid: 46800, guaranteed: 4168, total_surrender: 20083 },
    { year: 5, age: 35, total_paid: 78000, guaranteed: 22125, total_surrender: 46375 },
    { year: 10, age: 40, total_paid: 78000, guaranteed: 49220, total_surrender: 103070 },
  ];

  const selected = selectComparisonValuePoints(points);

  assert.deepEqual(selected.map(point => [point.year, point.total_paid, point.total_surrender]), [
    [1, 15600, 0],
    [2, 31200, 374],
    [3, 46800, 20083],
    [5, 78000, 46375],
    [10, 78000, 103070],
  ]);
});

test('selectComparisonValuePoints returns no curve when the PDF extraction is too sparse', () => {
  const selected = selectComparisonValuePoints([
    { year: 1, age: null, total_paid: 3, guaranteed: 2026, total_surrender: 10 },
    { year: 2, age: null, total_paid: 3, guaranteed: 2026, total_surrender: 10 },
    { year: 3, age: null, total_paid: 3, guaranteed: 2026, total_surrender: 10 },
  ]);

  assert.deepEqual(selected, []);
});
