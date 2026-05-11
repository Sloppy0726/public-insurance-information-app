import fs from 'node:fs';
import path from 'node:path';

const SOURCE_DIR = '/Users/book/Documents/AI SME /outputs/boc_life_inventory_2026-05-11';
const OUTPUT_DIR = path.resolve('data', 'boc');

const SOURCE_PRODUCTS = path.join(SOURCE_DIR, 'boc_products_2026-05-11.json');
const SOURCE_WIDGETS = path.join(SOURCE_DIR, 'boc_product_ui_widgets_2026-05-11.json');
const SOURCE_SUMMARY = path.join(SOURCE_DIR, 'boc_product_ui_summary_2026-05-11.json');
const SOURCE_WORKBOOK = path.join(SOURCE_DIR, 'BOC_Life_Proposal_Portal_Inventory_2026-05-11.xlsx');

const OUTPUT_PRODUCTS = path.join(OUTPUT_DIR, 'boc-life-portal-products-2026-05-11.json');
const OUTPUT_WIDGETS = path.join(OUTPUT_DIR, 'boc-life-portal-ui-widgets-2026-05-11.json');
const OUTPUT_SUMMARY = path.join(OUTPUT_DIR, 'boc-life-portal-ui-summary-2026-05-11.json');
const OUTPUT_WORKBOOK = path.join(OUTPUT_DIR, 'BOC-Life-Proposal-Portal-Inventory-2026-05-11.xlsx');

const SENSITIVE_KEY_RE = /(^|_)(cookie|session|token|pin|spac|contno|contract|password|secret)(_|$)/i;
const SENSITIVE_TEXT_RE = /\b(pin|spac|cookie|session[_ -]?id|token|password|secret)\s*[:=]\s*\S+/gi;

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY_RE.test(key))
        .map(([key, item]) => [key, sanitize(item)])
    );
  }
  if (typeof value === 'string') return value.replace(SENSITIVE_TEXT_RE, '$1=REDACTED');
  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function withMetadata(value, sourceFile) {
  return {
    ...value,
    _metadata: {
      source_folder: SOURCE_DIR,
      source_json: sourceFile,
      source_xlsx: path.basename(SOURCE_WORKBOOK),
      sanitized: true,
      redaction_rule: 'Session identifiers, cookies, credentials, proposal numbers, and browser-only secrets are omitted before public GitHub commit.',
    },
  };
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const products = sanitize(withMetadata(readJson(SOURCE_PRODUCTS), path.basename(SOURCE_PRODUCTS)));
const widgets = sanitize(withMetadata(readJson(SOURCE_WIDGETS), path.basename(SOURCE_WIDGETS)));
const summary = sanitize(readJson(SOURCE_SUMMARY));

writeJson(OUTPUT_PRODUCTS, products);
writeJson(OUTPUT_WIDGETS, widgets);
writeJson(OUTPUT_SUMMARY, summary);
fs.copyFileSync(SOURCE_WORKBOOK, OUTPUT_WORKBOOK);

console.log(`Wrote ${OUTPUT_PRODUCTS}`);
console.log(`Wrote ${OUTPUT_WIDGETS}`);
console.log(`Wrote ${OUTPUT_SUMMARY}`);
console.log(`Wrote ${OUTPUT_WORKBOOK}`);
