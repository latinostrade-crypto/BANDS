# Bands 2

MVP Telegram Mini App for a Telegram Gifts collectors contest.

## What is included

- React + Vite mobile-first Telegram Web App.
- Express + TypeScript API.
- PostgreSQL schema and migration runner.
- Redis sync cooldown.
- Telegram initData auth middleware.
- Telegram Bot API `getUserGifts` adapter.
- Unique gift sync with `(gift_id, unique_number, round_id)` anti-fraud key.
- NFT Race and People's Choice leaderboards.
- Premium votes for qualified users and social likes.
- TON Connect UI flow with backend proof payload endpoint.
- grammY bot with `/start` Web App button.

## Run locally

1. Copy `.env.example` to `.env` and set real values.
2. Start Postgres and Redis:

```bash
docker compose -f infra/docker-compose.yml up -d
```

On Windows, this repository also includes a helper that uses the default Docker Desktop path and a local Docker config:

```bash
npm run infra:up
```

3. Install dependencies:

```bash
npm install
```

4. Apply migrations:

```bash
npm run migrate -w apps/api
npm run seed -w apps/api
```

5. Start API and web app:

```bash
npm run dev:api
npm run dev:web
```

Or start API, Web and Bot together on Windows:

```bash
npm run dev:all
```

The web app runs on `http://localhost:5173`, API on `http://localhost:4000`.

## Production notes

- `WEB_APP_URL`, `API_PUBLIC_URL`, `TON_PROOF_DOMAIN`, and `TON_MANIFEST_URL` must use public HTTPS URLs for Telegram and TON Connect.
- Fill `ADMIN_TG_IDS` with comma-separated Telegram IDs.
- The TON proof verifier is isolated in `apps/api/src/adapters/tonProof.ts`; replace `BasicTonProofVerifier` with a chain-aware verifier before handling real rewards.
- Render + Supabase deployment steps are in `docs/deploy-render-supabase.md`.
