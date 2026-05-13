import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const inventoryPath = path.resolve('data/fwd/fwd-smart-inventory-2026-05-11.json');
const workbookPath = path.resolve('data/fwd/fwd-smart-inventory-2026-05-11.xlsx');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

const sensitiveKeyRe = /(^|_)(dob|date_of_birth|birth_date|hkid|id_no|identity|phone|mobile|email|address)(_|$)/i;
const unredactedDobTextRe = /\bDOB\s*\d{4}-\d{2}-\d{2}\b/i;

function walk(value, visitor, pathParts = []) {
  visitor(value, pathParts);

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...pathParts, String(index)]));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => walk(item, visitor, [...pathParts, key]));
  }
}

test('FWD SMART inventory backup keeps the expected source counts', () => {
  assert.equal(inventory._metadata?.sanitized, true);
  assert.equal(inventory.products.length, 14);
  assert.equal(inventory.premium_options.length, 57);
  assert.equal(inventory.quote_matrix.length, 135);
  assert.equal(inventory.benefit_values.length, 1235);
  assert.equal(inventory.extraction_qa.length, 28);
  assert.equal(inventory.standard_comparison.length, 50);
  assert.equal(inventory.all_40_product_summary.length, 40);
  assert.equal(inventory.all_40_quote_matrix.length, 360);
});

test('FWD SMART inventory covers the core nine comparison buckets separately', () => {
  const expectedBuckets = [
    '2Y_MONTHLY',
    '2Y_ANNUAL',
    '2Y_SINGLE',
    '5Y_MONTHLY',
    '5Y_ANNUAL',
    '5Y_SINGLE',
    '10Y_MONTHLY',
    '10Y_ANNUAL',
    '10Y_SINGLE',
  ];
  const buckets = new Set(inventory.quote_matrix.map(row => row.comparison_bucket));

  expectedBuckets.forEach(bucket => assert.equal(buckets.has(bucket), true, `${bucket} missing`));
});

test('FWD SMART inventory has no unredacted DOB/contact-style values', () => {
  const failures = [];

  walk(inventory, (value, pathParts) => {
    const key = pathParts.at(-1) ?? '';

    if (typeof value === 'string' && unredactedDobTextRe.test(value)) {
      failures.push(`${pathParts.join('.')}: ${value}`);
    }

    if (sensitiveKeyRe.test(key) && value !== null && value !== '' && value !== 'REDACTED') {
      failures.push(`${pathParts.join('.')}: sensitive value is not redacted`);
    }
  });

  assert.deepEqual(failures, []);
});

test('FWD SMART sanitised workbook is present for GitHub backup', () => {
  const stats = fs.statSync(workbookPath);
  assert.ok(stats.size > 100_000, `workbook is unexpectedly small: ${stats.size}`);
});

test('FWD SMART comparison rows include premium and long-term return fields', () => {
  const fwdFortuneWorld = inventory.standard_comparison.find(row =>
    row.product_name_zh === '盈聚‧天下 II 保險計劃' && row.comparison_bucket === '5Y_ANNUAL'
  );

  assert.equal(fwdFortuneWorld.premium_amount, 15600);
  assert.equal(fwdFortuneWorld.total_premium_paid, 78000);
  assert.equal(fwdFortuneWorld.year_20_surrender_to_paid_pct, 2.863949);
  assert.equal(fwdFortuneWorld.year_30_surrender_to_paid_pct, 5.854641);
  assert.equal(fwdFortuneWorld.benefit_value_rows, 10);
});

test('FWD SMART all-40 portal matrix keeps status coverage counts', () => {
  const statusCounts = inventory.all_40_quote_matrix.reduce((counts, row) => {
    counts[row.all40_status] = (counts[row.all40_status] ?? 0) + 1;
    return counts;
  }, {});

  assert.equal(statusCounts.actual_quote, 195);
  assert.equal(statusCounts.not_offered_or_no_premium, 153);
  assert.equal(statusCounts.calc_error, 12);
  assert.equal(inventory.extraction_qa.some(row => row.issue_type === 'all_40_quote_matrix'), true);
});
