# Product Library Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first demo web view that shows the newly found FWD proposal batch alongside the existing savings and VHIS data.

**Architecture:** Generate a static JSON product batch from the FWD manifest/PDF text, load that JSON with existing `/data` files on the server, and render a mobile-first product library dashboard. The first pass focuses on metadata, key money fields, and source transparency.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Node.js built-in test runner, `pdftotext`/`pdfinfo` for local extraction.

---

### Task 1: Product Data Generator

**Files:**
- Create: `tests/product-data.test.mjs`
- Create: `scripts/build-product-data.mjs`
- Create generated output: `data/products/fwd-smart-2026-05-10.json`

- [x] Write a failing Node test for manifest parsing and key metric extraction.
- [x] Implement CSV parsing, product id normalization, PDF text extraction, and metric extraction.
- [x] Generate the FWD product batch JSON from `/Users/book/Documents/AI SME /FWD_SMART_Proposals_2026-05-10`.
- [x] Run `node --test tests/product-data.test.mjs`.

### Task 2: Product Catalog Loader

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/products.ts`

- [x] Add `ProductSummary` types.
- [x] Load generated FWD products.
- [x] Convert existing savings and medical JSON into the same display shape.
- [x] Keep source paths and extraction notes visible but avoid exposing personal proposal names beyond `VIP VIP` source PDFs.

### Task 3: Demo Web UI

**Files:**
- Modify: `app/page.tsx`
- Create: `app/products/page.tsx`
- Create: `app/products/ProductLibrary.tsx`

- [x] Replace the narrow homepage with a dashboard overview.
- [x] Add a product library page with category filters, source cards, and key money fields.
- [x] Keep IA-safe wording: no best/recommend/should-buy language.

### Task 4: Verification

**Files:**
- Existing app and generated data.

- [x] Run JSON parse check.
- [x] Run `node --test tests/product-data.test.mjs`.
- [x] Run `npm run build`.
- [x] Run a local production server and Playwright-smoke `/` and `/products`.
