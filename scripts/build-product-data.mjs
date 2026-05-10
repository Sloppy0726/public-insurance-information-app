#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BATCH_ROOT = '/Users/book/Documents/AI SME /FWD_SMART_Proposals_2026-05-10';
const DEFAULT_OUTPUT = path.resolve('data/products/fwd-smart-2026-05-10.json');

const CATEGORY_LABELS = {
  SAVING: '儲蓄',
  LIFESAVING: '人壽儲蓄',
  LIFE: '人壽',
  CI: '危疾',
  ANNUITY: '年金',
};

const CATEGORY_SLUGS = {
  SAVING: 'savings',
  LIFESAVING: 'life-savings',
  LIFE: 'life',
  CI: 'critical-illness',
  ANNUITY: 'annuity',
};

const ROMANIZATION = new Map([
  ['盈', 'ying'], ['聚', 'ju'], ['天', 'tian'], ['下', 'xia'], ['保', 'bao'], ['險', 'xian'], ['計', 'ji'], ['劃', 'hua'],
  ['智', 'zhi'], ['優', 'you'], ['盛', 'sheng'], ['儲', 'chu'], ['蓄', 'xu'], ['匯', 'hui'], ['越', 'yue'], ['版', 'ban'],
  ['創', 'chuang'], ['逸', 'yi'], ['致', 'zhi'], ['富', 'fu'], ['豐', 'feng'], ['裕', 'yu'], ['盛', 'sheng'],
  ['家', 'jia'], ['年', 'nian'], ['華', 'hua'], ['壽', 'shou'], ['自', 'zi'], ['主', 'zhu'], ['定', 'ding'], ['期', 'qi'],
  ['危', 'wei'], ['疾', 'ji'], ['緻', 'zhi'], ['尚', 'shang'], ['攻', 'gong'], ['守', 'shou'], ['易', 'yi'], ['癌', 'ai'], ['症', 'zheng'],
  ['升', 'sheng'], ['級', 'ji'], ['歲', 'sui'], ['悅', 'yue'], ['延', 'yan'], ['金', 'jin'], ['超', 'chao'], ['凡', 'fan'],
]);

export function parseManifestCsv(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map(line => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function splitCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}

export function normalizeProductId(company, category, productName, variant) {
  const source = `${company} ${category} ${productName} ${variant}`;
  const pieces = [];

  for (const char of source) {
    if (/[a-z0-9]/i.test(char)) {
      pieces.push(char.toLowerCase());
    } else if (ROMANIZATION.has(char)) {
      pieces.push(`-${ROMANIZATION.get(char)}-`);
    } else {
      pieces.push('-');
    }
  }

  return pieces.join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function extractMoneyMetrics(text) {
  const issueSurrender = firstNumber(text.match(/保單繕發日之退保價值[︰:\s$＄]*([0-9,]+)/)?.[1]);
  const monthlyGuaranteed = firstNumber(text.match(/每月保證年金金額\s*\(A\)[^0-9]*([0-9,]+)/)?.[1]);
  const monthlyNonGuaranteed = firstNumber(text.match(/每月非保證年金金額\s*\(B\)#?[^0-9]*([0-9,]+)/)?.[1]);
  const monthlyTotal = firstNumber(text.match(/每月年金金額\s*\(A\)\s*\+\s*\(B\)#?[^0-9]*([0-9,]+)/)?.[1]);
  const irrMatch = text.match(/於年金期內每月提取所有每月年金金額\s+([0-9.]+%)\s+([0-9.]+%)/);

  return {
    issue_surrender_value: issueSurrender,
    annuity_monthly_guaranteed: monthlyGuaranteed,
    annuity_monthly_non_guaranteed: monthlyNonGuaranteed,
    annuity_monthly_total: monthlyTotal,
    guaranteed_irr: irrMatch?.[1] ?? null,
    projected_irr: irrMatch?.[2] ?? null,
  };
}

function firstNumber(value) {
  if (!value) return null;
  return Number(value.replace(/,/g, ''));
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPageCount(pdfPath) {
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const match = info.match(/^Pages:\s+(\d+)/m);
  return match ? Number(match[1]) : null;
}

function extractPdfText(pdfPath) {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function extractPaymentTerm(row, text) {
  const filenameMatch = row.filename.match(/_(\d+)pay\b/i);
  if (filenameMatch) return Number(filenameMatch[1]);
  if (row.payment_mode === 'SINGLE') return 1;

  const termMatch = text.match(/保費供款年期\s+保障年期[\s\S]{0,220}?([0-9]+)\s*年/);
  return termMatch ? Number(termMatch[1]) : null;
}

function extractPolicyTerm(row, text) {
  if (row.filename.includes('TermLife')) return 'To age 100 assumed renewal';
  const productLine = text.split('\n').find(line => line.includes(row.product) && /終身|[0-9]+\s*年/.test(line));
  if (!productLine) return null;
  if (productLine.includes('終身')) return 'Whole life';
  const matches = [...productLine.matchAll(/([0-9]+)\s*年/g)].map(match => Number(match[1]));
  return matches.length ? `${matches.at(-1)} years` : null;
}

function extractValuePoints(text, category) {
  const points = [];
  const seen = new Set();

  for (const rawLine of text.split('\n')) {
    const tokens = rawLine.match(/[0-9][0-9,]*(?:\.[0-9]+)?/g);
    if (!tokens || tokens.length < 5) continue;

    const nums = tokens.map(token => Number(token.replace(/,/g, '')));
    const year = nums[0];
    if (!Number.isInteger(year) || year < 1 || year > 120) continue;

    let age = null;
    let totalPaid;
    let guaranteed;
    let totalSurrender;
    let deathBenefit = null;

    if (nums[1] >= 30 && nums[1] <= 150 && nums.length >= 6) {
      age = nums[1];
      totalPaid = nums[2];
      guaranteed = nums[3];
      totalSurrender = nums.at(-1);
    } else if (category === 'CI' && nums.length >= 7) {
      totalPaid = nums[1];
      guaranteed = nums[2];
      totalSurrender = nums.at(-2);
      deathBenefit = nums.at(-1);
    } else if (category === 'ANNUITY' && nums.length >= 6) {
      totalPaid = nums[1];
      guaranteed = nums.at(-3);
      totalSurrender = nums.at(-1);
    } else {
      totalPaid = nums[1];
      guaranteed = nums[2];
      totalSurrender = nums.at(-1);
    }

    if (totalPaid == null || guaranteed == null || totalSurrender == null) continue;
    const key = `${year}-${totalPaid}-${guaranteed}-${totalSurrender}`;
    if (seen.has(key)) continue;
    seen.add(key);

    points.push({
      year,
      age,
      total_paid: totalPaid,
      guaranteed,
      total_surrender: totalSurrender,
      death_benefit: deathBenefit,
    });
  }

  return points.slice(0, 120);
}

export function selectComparisonValuePoints(valuePoints, { minimumPaid = 1000 } = {}) {
  const byYear = new Map();

  for (const point of valuePoints ?? []) {
    if (!Number.isFinite(point.year) || point.year < 1 || point.year > 120) continue;
    if (!Number.isFinite(point.total_paid) || point.total_paid < minimumPaid) continue;
    if (!Number.isFinite(point.guaranteed) || point.guaranteed < 0) continue;
    if (!Number.isFinite(point.total_surrender) || point.total_surrender < 0) continue;

    const existing = byYear.get(point.year) ?? [];
    existing.push(point);
    byYear.set(point.year, existing);
  }

  const selected = [...byYear.entries()]
    .sort(([yearA], [yearB]) => yearA - yearB)
    .map(([, candidates]) => {
      const withAge = candidates.filter(point => Number.isFinite(point.age));
      const pool = withAge.length ? withAge : candidates;

      return pool.slice().sort((a, b) => {
        const surrenderDiff = a.total_surrender - b.total_surrender;
        if (surrenderDiff !== 0) return surrenderDiff;
        return b.guaranteed - a.guaranteed;
      })[0];
    });

  return selected.length >= 5 ? selected : [];
}

function buildProduct(row, batchRoot) {
  const pdfPath = path.join(batchRoot, 'pdfs', row.filename);
  const text = extractPdfText(pdfPath);
  const metrics = extractMoneyMetrics(text);
  const valuePoints = extractValuePoints(text, row.category);
  const comparisonValuePoints = selectComparisonValuePoints(valuePoints);
  const premium = toNumber(row.portal_premium);
  const sumInsured = toNumber(row.portal_sum_insured);
  const levy = toNumber(row.levy);
  const issueLoss = premium && metrics.issue_surrender_value != null
    ? Math.max(0, premium - metrics.issue_surrender_value)
    : null;

  return {
    id: normalizeProductId('FWD', row.category, row.product, row.variant),
    company: 'FWD',
    company_zh: '富衛人壽保險（百慕達）有限公司',
    product_name: row.product,
    product_name_zh: row.product,
    category: CATEGORY_SLUGS[row.category] ?? row.category.toLowerCase(),
    category_label: CATEGORY_LABELS[row.category] ?? row.category,
    source_category: row.category,
    currency: row.currency,
    quote_profile: { age: 30, gender: 'M', smoker: false },
    premium: {
      payment_mode: row.payment_mode,
      portal_premium: premium,
      input_amount_type: row.input_amount_type,
      input_amount: toNumber(row.input_amount),
      payment_term_years: extractPaymentTerm(row, text),
      levy,
    },
    sum_insured: sumInsured,
    policy_term: extractPolicyTerm(row, text),
    metrics: {
      ...metrics,
      issue_surrender_loss: issueLoss,
      issue_surrender_loss_pct: premium && issueLoss != null ? Number(((issueLoss / premium) * 100).toFixed(1)) : null,
      value_point_count: valuePoints.length,
      comparison_value_point_count: comparisonValuePoints.length,
    },
    value_points: valuePoints,
    comparison_value_points: comparisonValuePoints,
    source: {
      batch: 'FWD_SMART_Proposals_2026-05-10',
      filename: row.filename,
      absolute_path: pdfPath,
      pages: extractPageCount(pdfPath),
      notes: row.notes,
      download_date: '2026-05-10',
      text_extractable: text.trim().length > 0,
    },
  };
}

export function buildBatch({ batchRoot = DEFAULT_BATCH_ROOT } = {}) {
  const manifestPath = path.join(batchRoot, 'data', 'proposals_manifest.csv');
  const rows = parseManifestCsv(fs.readFileSync(manifestPath, 'utf8'));
  const products = rows.filter(row => row.status === 'downloaded').map(row => buildProduct(row, batchRoot));

  return {
    batch_id: 'fwd-smart-2026-05-10',
    generated_at: new Date().toISOString(),
    source_root: batchRoot,
    product_count: products.length,
    products,
  };
}

function main() {
  const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT;
  const batch = buildBatch();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(batch, null, 2)}\n`);
  console.log(`Wrote ${batch.product_count} products to ${outputPath}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
