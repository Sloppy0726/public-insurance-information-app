import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

async function importSelectionModule() {
  const sourcePath = path.resolve('lib/selection.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledPath = path.join(os.tmpdir(), `selection-${Date.now()}.mjs`);
  fs.writeFileSync(compiledPath, output);
  return import(`file://${compiledPath}`);
}

function plan({ company = 'FWD', category = 'savings', name, row20, row30 = row20, source = 'pdf-proposal' }) {
  return {
    company,
    category,
    product_name_zh: name,
    source_kind: source,
    surrender_value_table: [
      { year: 20, total_paid: 100, guaranteed: 80, total_surrender: row20 },
      { year: 30, total_paid: 100, guaranteed: 90, total_surrender: row30 },
    ],
  };
}

test('selectTopComparisonPlans keeps at most three plans per company and category by surrender ratio', async () => {
  const { selectTopComparisonPlans } = await importSelectionModule();

  const selected = selectTopComparisonPlans([
    plan({ name: 'A', row20: 101 }),
    plan({ name: 'B', row20: 180 }),
    plan({ name: 'C', row20: 130 }),
    plan({ name: 'D', row20: 220 }),
    plan({ name: 'E', row20: 90 }),
    plan({ category: 'annuity', name: 'Annuity A', row20: 100 }),
    plan({ category: 'annuity', name: 'Annuity B', row20: 200 }),
    plan({ category: 'annuity', name: 'Annuity C', row20: 300 }),
    plan({ category: 'annuity', name: 'Annuity D', row20: 400 }),
    plan({ company: 'Zurich', name: 'Z', row20: 10 }),
  ], { limitPerGroup: 3 });

  assert.deepEqual(
    selected.filter(item => item.company === 'FWD' && item.category === 'savings').map(item => item.product_name_zh),
    ['D', 'B', 'C']
  );
  assert.deepEqual(
    selected.filter(item => item.company === 'FWD' && item.category === 'annuity').map(item => item.product_name_zh),
    ['Annuity D', 'Annuity C', 'Annuity B']
  );
  assert.equal(selected.filter(item => item.company === 'Zurich' && item.category === 'savings').length, 1);
});

test('selectTopComparisonPlans deduplicates near-identical product names before applying the limit', async () => {
  const { selectTopComparisonPlans } = await importSelectionModule();

  const selected = selectTopComparisonPlans([
    plan({ name: '盈聚·天下 II 保險計劃', row20: 120, source: 'sample-json' }),
    plan({ name: '盈聚‧天下 II 保險計劃', row20: 200, source: 'pdf-proposal' }),
    plan({ name: '智盈．超凡保險計劃', row20: 180 }),
    plan({ name: '智盈匯聚(優越版)III壽險計劃', row20: 160 }),
    plan({ name: '另一份計劃', row20: 140 }),
  ], { limitPerGroup: 3 });

  assert.deepEqual(selected.map(item => item.product_name_zh), [
    '盈聚‧天下 II 保險計劃',
    '智盈．超凡保險計劃',
    '智盈匯聚(優越版)III壽險計劃',
  ]);
});
