import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

async function importQuoteBucketModule() {
  const sourcePath = path.resolve('lib/quote-buckets.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledPath = path.join(os.tmpdir(), `quote-buckets-${Date.now()}.mjs`);
  fs.writeFileSync(compiledPath, output);
  return import(`file://${compiledPath}`);
}

test('deriveComparisonBucket maps the nine supported term and mode combinations', async () => {
  const { deriveComparisonBucket } = await importQuoteBucketModule();

  assert.equal(deriveComparisonBucket(2, 'MONTHLY'), '2Y_MONTHLY');
  assert.equal(deriveComparisonBucket(2, 'ANNUAL'), '2Y_ANNUAL');
  assert.equal(deriveComparisonBucket(2, 'SINGLE'), '2Y_SINGLE');
  assert.equal(deriveComparisonBucket(5, 'MONTHLY'), '5Y_MONTHLY');
  assert.equal(deriveComparisonBucket(5, 'ANNUAL'), '5Y_ANNUAL');
  assert.equal(deriveComparisonBucket(5, 'SINGLE'), '5Y_SINGLE');
  assert.equal(deriveComparisonBucket(10, 'MONTHLY'), '10Y_MONTHLY');
  assert.equal(deriveComparisonBucket(10, 'ANNUAL'), '10Y_ANNUAL');
  assert.equal(deriveComparisonBucket(10, 'SINGLE'), '10Y_SINGLE');
});

test('deriveComparisonBucket rejects converted or unsupported quote variants', async () => {
  const { deriveComparisonBucket } = await importQuoteBucketModule();

  assert.equal(deriveComparisonBucket(1, 'SINGLE'), 'OUT_OF_SCOPE');
  assert.equal(deriveComparisonBucket(3, 'ANNUAL'), 'OUT_OF_SCOPE');
  assert.equal(deriveComparisonBucket(5, 'QUARTERLY'), 'OUT_OF_SCOPE');
  assert.equal(deriveComparisonBucket(null, 'ANNUAL'), 'OUT_OF_SCOPE');
});
