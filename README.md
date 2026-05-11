# public-insurance-information-app

Hong Kong insurance product information and comparison demo built with Next.js.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run build:data
npm run test
npm run build
```

## Current Pages

- `/` dashboard overview
- `/fwd-inventory` FWD SMART inventory coverage/QA viewer
- `/products` product database
- `/savings` savings comparison and X-Ray
- `/compliance` compliance disclosure

## Current FWD Inventory Backup

- Sanitised JSON: `data/fwd/fwd-smart-inventory-2026-05-11.json`
- Sanitised Excel: `data/fwd/fwd-smart-inventory-2026-05-11.xlsx`
- Import script: `scripts/import-fwd-inventory.py`
