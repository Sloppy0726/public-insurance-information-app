import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

async function importFwdCompareModule() {
  const sourcePath = path.resolve('lib/fwd-compare.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledPath = path.join(os.tmpdir(), `fwd-compare-${Date.now()}.mjs`);
  fs.writeFileSync(compiledPath, output);
  return import(`file://${compiledPath}`);
}

test('loadFwdCompareData exposes premium and long-term return rows', async () => {
  const { loadFwdCompareData } = await importFwdCompareModule();
  const data = loadFwdCompareData();
  const row = data.rows.find(item =>
    item.productNameZh === '盈聚‧天下 II 保險計劃' && item.comparisonBucket === '5Y_ANNUAL'
  );

  assert.equal(data.stats.totalRows, 50);
  assert.equal(data.stats.rowsWithPremium, 50);
  assert.ok(data.stats.rowsWithCurve > 0);
  assert.equal(data.stats.consumerBudgetRows, 8);
  assert.equal(data.stats.budgetExcludedRows, 20);
  assert.ok(row);
  assert.equal(row.comparisonBasisType, 'CONSUMER_PREMIUM_BUDGET');
  assert.equal(row.comparable, true);
  assert.equal(row.targetPremiumAmount, 15600);
  assert.equal(row.budgetFit, true);
  assert.equal(row.premiumAmount, 15600);
  assert.equal(row.totalPremiumPaid, 78000);
  assert.equal(row.year20SurrenderToPaidPct, 2.863949);
  assert.equal(row.year30SurrenderToPaidPct, 5.854641);
  assert.ok(row.curve.length >= 10);
  assert.equal(row.curve.some(point => point.year === 20 && point.surrenderToPaidPct > 280), true);
});

test('loadFwdCompareData excludes wealth rows that do not match the consumer budget', async () => {
  const { loadFwdCompareData } = await importFwdCompareModule();
  const data = loadFwdCompareData();
  const row = data.rows.find(item =>
    item.productNameZh === '創逸致富(豐裕版) II 保險計劃' && item.comparisonBucket === '5Y_ANNUAL'
  );

  assert.ok(row);
  assert.equal(row.comparisonBasisType, 'CONSUMER_PREMIUM_BUDGET');
  assert.equal(row.targetPremiumAmount, 15600);
  assert.equal(row.premiumAmount, 9805);
  assert.equal(row.budgetFit, false);
  assert.equal(row.comparable, false);
  assert.match(row.exclusionReason, /away from the consumer budget target/);
});
