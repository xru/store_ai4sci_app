# ai4sci.app — AI for Science App Store

A Cloudflare-first platform for discovering and accessing AI-powered science prototype applications.

## Architecture

| Layer | Tech |
|---|---|
| Frontend | Cloudflare Pages (static HTML/JS, SSR-ready) |
| API | Cloudflare Workers (`src/index.ts`) |
| Database | Cloudflare D1 (SQLite) |
| File storage | Cloudflare R2 |
| Auth | Google OAuth (Gmail) |
| Payment | Stripe |

## Tiered Access

| Tier | Who | Access |
|---|---|---|
| L0 | Guest | Browse app list + summaries |
| L1 | Gmail login | + Detailed descriptions, tech stack, demo URLs |
| L2 | Paid subscriber | + Source code, datasets, reports, deep info |

## Setup

```bash
# 1. Install deps
npm install

# 2. Create D1 database (get the ID, paste into wrangler.jsonc)
npm run db:create

# 3. Run migrations + seed
npm run db:migrate:local
npm run db:seed

# 4. Copy secrets template and fill in values
cp .dev.vars.example .dev.vars

# 5. Run locally
npm run dev
```

## Secrets needed

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Cloud Console OAuth
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe dashboard
- `SESSION_SECRET` — random string

## Deploy

```bash
npm run deploy
```

## Project docs

- PRD: `../ai4sci-app-Store/Cata_Doc/PRD.md`
- Control board: `../ai4sci-app-Store/project/project-control.md`
