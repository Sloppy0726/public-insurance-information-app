import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

async function importCaptureModule() {
  const sourcePath = path.resolve('lib/fwd-standard-capture.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledPath = path.join(os.tmpdir(), `fwd-standard-capture-${Date.now()}.mjs`);
  fs.writeFileSync(compiledPath, output);
  return import(`file://${compiledPath}`);
}

test('loadFwdStandardCaptureData separates comparable standard rows from fixed-basis references', async () => {
  const { loadFwdStandardCaptureData } = await importCaptureModule();
  const data = loadFwdStandardCaptureData();

  assert.equal(data.stats.totalRows, 65);
  assert.equal(data.stats.comparableRows, 22);
  assert.equal(data.stats.fixedBasisRows, 4);
  assert.equal(data.stats.outOfScopeRows, 7);
  assert.equal(data.stats.unavailableRows, 32);

  const fortune = data.rows.find(row =>
    row.productFamilyId === 'fwd_fortune_world_ii' && row.comparisonBucket === '5Y_ANNUAL'
  );
  assert.ok(fortune);
  assert.equal(fortune.comparable, true);
  assert.equal(fortune.statusGroup, 'comparable');
  assert.equal(fortune.actualPremium, 15600);
  assert.equal(fortune.actualTotalPremium, 78000);
  assert.equal(fortune.curve.length, 108);
  assert.equal(fortune.year20SurrenderToPaidPct, 286.394872);

  const creativeAnnual = data.rows.find(row =>
    row.productFamilyId === 'fwd_creative_fortune_plus' && row.comparisonBucket === '10Y_ANNUAL'
  );
  assert.ok(creativeAnnual);
  assert.equal(creativeAnnual.comparable, true);
  assert.equal(creativeAnnual.statusGroup, 'comparable');
  assert.equal(creativeAnnual.actualPremium, 15599.99);
  assert.equal(creativeAnnual.actualTotalPremium, 155999);
  assert.equal(creativeAnnual.notionalAmount, 1157270);
  assert.equal(creativeAnnual.pdfFile, '20260511_FWD_LIFESAVING_CreativeFortunePlus_PREMIUM15600_ANNUAL_10pay.pdf');
  assert.equal(creativeAnnual.curve.length, 90);

  const plusIIMonthly = data.rows.find(row =>
    row.productFamilyId === 'fwd_creative_fortune_plus_ii' && row.comparisonBucket === '10Y_MONTHLY'
  );
  assert.ok(plusIIMonthly);
  assert.equal(plusIIMonthly.comparable, true);
  assert.equal(plusIIMonthly.statusGroup, 'comparable');
  assert.equal(plusIIMonthly.actualPremium, 1300);
  assert.equal(plusIIMonthly.actualTotalPremium, 156000);
  assert.equal(plusIIMonthly.notionalAmount, 1289683);
  assert.equal(plusIIMonthly.curve.length, 90);
  assert.equal(plusIIMonthly.year10SurrenderToPaidPct, 82.69359);

  const annuityAnnual = data.rows.find(row =>
    row.productFamilyId === 'fwd_prosperous_deferred_annuity' && row.comparisonBucket === '5Y_ANNUAL'
  );
  assert.ok(annuityAnnual);
  assert.equal(annuityAnnual.comparable, false);
  assert.equal(annuityAnnual.statusGroup, 'fixed_basis');
  assert.equal(annuityAnnual.actualPremium, 7655.47);
  assert.equal(annuityAnnual.actualTotalPremium, 38277.35);
  assert.equal(annuityAnnual.notionalAmount, 495);
  assert.equal(annuityAnnual.curve.length, 10);
  assert.equal(annuityAnnual.breakevenYear, 10);
});

test('loadFwdStandardCaptureData exposes product and bucket summaries for the page controls', async () => {
  const { loadFwdStandardCaptureData } = await importCaptureModule();
  const data = loadFwdStandardCaptureData();

  const creative = data.productSummaries.find(item => item.productFamilyId === 'fwd_creative_fortune_plus');
  assert.ok(creative);
  assert.equal(creative.productNameZh, '創逸致富 (豐裕版)');
  assert.equal(creative.totalRows, 10);
  assert.equal(creative.comparableRows, 4);
  assert.equal(creative.fixedBasisRows, 0);

  const plusII = data.productSummaries.find(item => item.productFamilyId === 'fwd_creative_fortune_plus_ii');
  assert.ok(plusII);
  assert.equal(plusII.totalRows, 10);
  assert.equal(plusII.comparableRows, 4);
  assert.equal(plusII.fixedBasisRows, 0);
  assert.equal(plusII.outOfScopeRows, 1);

  const fiveYearAnnual = data.bucketSummaries.find(item => item.comparisonBucket === '5Y_ANNUAL');
  assert.ok(fiveYearAnnual);
  assert.equal(fiveYearAnnual.comparableRows, 5);
  assert.equal(fiveYearAnnual.fixedBasisRows, 1);
  assert.equal(fiveYearAnnual.rowsWithCurve, 6);

  const annuity = data.productSummaries.find(item => item.productFamilyId === 'fwd_prosperous_deferred_annuity');
  assert.ok(annuity);
  assert.equal(annuity.totalRows, 4);
  assert.equal(annuity.fixedBasisRows, 4);
  assert.equal(annuity.rowsWithCurve, 1);
});

test('loadFwdStandardCaptureData provides category summaries to split savings and life-savings', async () => {
  const { loadFwdStandardCaptureData } = await importCaptureModule();
  const data = loadFwdStandardCaptureData();

  const savings = data.categorySummaries.find(item => item.category === 'savings');
  assert.ok(savings);
  assert.equal(savings.totalRows, 21);
  assert.equal(savings.comparableRows, 6);
  assert.equal(savings.outOfScopeRows, 3);

  const lifeSavings = data.categorySummaries.find(item => item.category === 'life-savings');
  assert.ok(lifeSavings);
  assert.equal(lifeSavings.totalRows, 40);
  assert.equal(lifeSavings.comparableRows, 16);
  assert.equal(lifeSavings.fixedBasisRows, 0);
  assert.equal(lifeSavings.outOfScopeRows, 4);

  const annuity = data.categorySummaries.find(item => item.category === 'annuity');
  assert.ok(annuity);
  assert.equal(annuity.totalRows, 4);
  assert.equal(annuity.fixedBasisRows, 4);

  const homeLegacy = data.rows.find(row =>
    row.productFamilyId === 'fwd_home_legacy' && row.comparisonBucket === 'OUT_OF_SCOPE'
  );
  assert.ok(homeLegacy);
  assert.equal(homeLegacy.statusGroup, 'out_of_scope');
  assert.equal(homeLegacy.curve.length, 10);
  assert.equal(homeLegacy.year20SurrenderToPaidPct, 180.6718);
});
