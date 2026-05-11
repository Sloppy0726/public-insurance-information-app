import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const productsPath = path.resolve('data/boc/boc-life-portal-products-2026-05-11.json');
const widgetsPath = path.resolve('data/boc/boc-life-portal-ui-widgets-2026-05-11.json');
const summaryPath = path.resolve('data/boc/boc-life-portal-ui-summary-2026-05-11.json');
const workbookPath = path.resolve('data/boc/BOC-Life-Proposal-Portal-Inventory-2026-05-11.xlsx');

const sensitiveKeyRe = /(^|_)(cookie|session|token|pin|spac|contno|contract|password|secret)(_|$)/i;
const sensitiveTextRe = /\b(pin|spac|cookie|session[_ -]?id|token|password|secret)\s*[:=]/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

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

test('BOC Life portal inventory keeps expected product and UI metadata counts', () => {
  const products = readJson(productsPath);
  const widgets = readJson(widgetsPath);
  const summary = readJson(summaryPath);

  assert.equal(products._metadata?.sanitized, true);
  assert.equal(products.productCount, 34);
  assert.equal(products.categories.length, 10);
  assert.equal(products.categories.flatMap(category => category.products).length, 34);
  assert.equal(widgets.productCount, 34);
  assert.equal(widgets.products.length, 34);
  assert.equal(summary.length, 34);
  assert.equal(summary.every(product => product.success === true), true);
});

test('BOC Life portal inventory has no captured session identifiers', () => {
  const failures = [];

  [readJson(productsPath), readJson(widgetsPath), readJson(summaryPath)].forEach(data => {
    walk(data, (value, pathParts) => {
      const key = pathParts.at(-1) ?? '';
      if (sensitiveKeyRe.test(key)) {
        failures.push(`${pathParts.join('.')}: sensitive key is present`);
      }
      if (typeof value === 'string' && sensitiveTextRe.test(value)) {
        failures.push(`${pathParts.join('.')}: sensitive text is present`);
      }
    });
  });

  assert.deepEqual(failures, []);
});

test('BOC Life sanitised workbook is present for GitHub backup', () => {
  const stats = fs.statSync(workbookPath);
  assert.ok(stats.size > 50_000, `workbook is unexpectedly small: ${stats.size}`);
});
