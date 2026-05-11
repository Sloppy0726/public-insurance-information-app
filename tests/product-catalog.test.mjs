import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

async function importProductsModule() {
  const sourcePath = path.resolve('lib/products.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledPath = path.join(os.tmpdir(), `products-${Date.now()}.mjs`);
  fs.writeFileSync(compiledPath, output);
  return import(`file://${compiledPath}`);
}

test('loadProductCatalog includes BOC Life portal inventory products', async () => {
  const { loadProductCatalog } = await importProductsModule();
  const catalog = loadProductCatalog();
  const bocProducts = catalog.products.filter(product => product.company === 'BOC Life');

  assert.equal(catalog.stats.bocPortalCount, 34);
  assert.equal(bocProducts.length, 34);
  assert.equal(catalog.stats.total, 55);
  assert.ok(bocProducts.some(product => product.product_name_zh === '綻放人生收益壽險計劃(簡易版)'));
  assert.ok(bocProducts.every(product => product.source.kind === 'authenticated-portal-inventory'));
  assert.ok(bocProducts.every(product => product.data_quality.level === 'portal-metadata-extract'));
});
