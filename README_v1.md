# Bands 2 - README v1

Дата состояния: 23 июня 2026.

## Текущий статус

Bands 2 уже собран как рабочий MVP Telegram Mini App для конкурса коллекционеров Telegram Gifts.

Проект задеплоен и работает в связке:

- Telegram Bot: `@Grab_appbot`
- Web App: https://bands-web-x5q6.onrender.com
- API: https://bands-api-7ppp.onrender.com
- Bot health service: https://bands-bot.onrender.com
- Database: Supabase Postgres
- Redis: Render Redis
- Repository: https://github.com/latinostrade-crypto/BANDS

## Render

Blueprint:

- Name: `bands-production`
- Blueprint ID: `exs-d8sfkaurnols738js3t0`

Services:

- `bands-web` - Render Static Site, deployed.
- `bands-api` - Render Web Service, deployed.
- `bands-bot` - Render Web Service, deployed.
- `bands-redis` - Render Redis/Valkey, available.

Public endpoints checked:

- `GET https://bands-api-7ppp.onrender.com/health` returns `{"ok":true}`.
- `GET https://bands-bot.onrender.com/health` returns `{"ok":true}`.
- `GET https://bands-web-x5q6.onrender.com` returns `200`.
- `GET https://bands-web-x5q6.onrender.com/tonconnect-manifest.json` returns the correct web app URL.

Current important Render URLs:

- Web: `https://bands-web-x5q6.onrender.com`
- API: `https://bands-api-7ppp.onrender.com`
- Bot health: `https://bands-bot.onrender.com`
- TON manifest: `https://bands-web-x5q6.onrender.com/tonconnect-manifest.json`

## Supabase

Supabase project:

- Project name: `bands`
- Project ref: `ianlmfxwxgwsbdcftxnq`
- Region: Central EU / Frankfurt
- Connection mode used by Render: Supabase Session Pooler

Database status:

- Initial schema migration applied.
- Gift image migration added: `002_gift_images.sql`.
- API runs migrations automatically on Render startup.
- Database stores Telegram users, rounds, target gifts, synced user gifts, votes, social likes, wallet proof payloads, and admin audit log.

Secrets are stored in Render environment variables and are not committed.

## Telegram Bot

Bot:

- Username: `@Grab_appbot`
- Bot menu button is configured as Web App.
- Menu URL uses cache busting: `https://bands-web-x5q6.onrender.com?v=auth4`.
- `/start` sends a Web App button.

Important fix already done:

- Telegram WebApp SDK is loaded in `apps/web/index.html`.
- `Telegram.WebApp.initData` is now available inside the Mini App.
- Frontend shows diagnostic text: `Telegram auth: connected - build auth4`.

## Authentication

Implemented:

- Telegram Mini App auth via `Telegram.WebApp.initData`.
- Backend validation through Telegram HMAC check.
- JWT session is issued after successful `/api/auth`.
- Frontend clears stale local sessions on `403`.
- Frontend blocks protected API calls when Telegram auth/session is missing.

Verified:

- Production API accepts valid Telegram-style signed init data.
- CORS allows the deployed web origin.

## Gifts Sync

Implemented:

- API calls Telegram Bot API `getUserGifts`.
- Sync fetches unique Telegram gifts for the logged-in Telegram user.
- Synced gifts are stored by `(gift_id, unique_number, round_id)`.
- Burned/blockchain gifts are skipped.
- Target gifts can give score.
- Non-target unique gifts are still stored and shown with `+0`.
- Sync cooldown uses Redis.

Current behavior:

- `Found` shows all unique gifts returned by Telegram.
- `Accepted` means saved/updated in DB.
- `Rejected` means skipped because burned, blockchain, duplicate conflict, or other rule.
- User gift cards now show static thumbnail images.

## Gift Images

Implemented:

- Telegram gift thumbnail source: `gift.model.sticker.thumbnail.file_id`.
- API stores:
  - `image_file_id`
  - `image_width`
  - `image_height`
- API exposes safe image proxy:
  - `GET /assets/telegram-file?file_id=...`
- Bot token is not exposed to frontend.
- Proxy sets cache headers and image content type.

Verified:

- Real Telegram thumbnail proxy returns `200`.
- Content-Type returns `image/webp`.
- `Cross-Origin-Resource-Policy` allows frontend rendering.
- Web bundle contains gift image UI.

## Frontend

Implemented screens:

- Profile
- Leaderboard
- Wallet

Profile currently shows:

- Telegram username / first name
- Telegram ID
- Score
- Likes
- Telegram auth/build diagnostic
- Sync button
- Last sync summary
- Synced unique gifts with thumbnails

Known UI issue:

- Some Russian strings are still mojibake in source, for example `Рџ...`.
- Several labels are still mixed Russian/English.

## TON

Implemented:

- TON Connect UI exists in frontend.
- Backend has proof payload endpoint.
- TON manifest is deployed at the correct web URL.

Not production-final yet:

- TON proof verifier is still basic and should be replaced with a chain-aware verifier before real rewards.
- Reward logic is not implemented yet.

## Repository

GitHub repository:

- https://github.com/latinostrade-crypto/BANDS

Recent important commits:

- `2e8e366` - Serve Telegram thumbnails with image content type
- `8873fa9` - Show Telegram gift thumbnails
- `e217b6d` - Load Telegram WebApp SDK
- `51d353f` - Fix missing Telegram auth handling
- `3ef6850` - Fix Telegram Mini App authorization

## Local Development

Local stack:

- Node workspaces
- Vite web app
- Express API
- grammY bot
- PostgreSQL
- Redis
- Docker helper scripts

Useful commands:

```bash
npm install
npm run infra:up
npm run db:migrate
npm run dev:all
npm run build
```

Local Docker was already tested after Docker Desktop was started.

## Current Known Limitations

- Render free services can sleep and wake slowly.
- Telegram bot currently uses long polling. During rolling deploys, old/new instances can briefly conflict with `getUpdates`.
- Target gift list is still mostly placeholder/admin-managed.
- UI needs cleanup and consistent Russian text.
- Admin UX is not built yet.
- Full reward distribution is not built yet.
- Security hardening and rate limits need another pass before public launch.
- Bot token was shared during setup and should be rotated before real production traffic.

## Further Plan

### 1. Stabilize Telegram Gift Sync

- Add better sync error messages for Telegram API failures.
- Show skipped reasons: burned, blockchain, duplicate, not target.
- Add manual "refresh after sync" UX so users immediately see newly synced gifts.
- Add pagination/lazy rendering for large gift collections.
- Cache Telegram file paths to reduce repeated `getFile` calls.

### 2. Build Admin Controls

- Admin page for target gifts.
- Add/remove active target gifts.
- Set score weights.
- View audit log.
- Restrict admin routes by `ADMIN_TG_IDS`.
- Add simple admin seed/import flow for target gift IDs.

### 3. Improve UI/UX

- Fix mojibake Russian labels.
- Make all copy consistent in Russian.
- Improve gift cards: rarity, model/symbol/backdrop formatting, empty states.
- Add loading skeletons.
- Add better mobile spacing and safe-area checks.
- Add leaderboard profile preview.

### 4. Improve Scoring and Contest Rules

- Finalize target gift scoring rules.
- Decide whether non-target gifts should show in profile, leaderboard, or separate collection tab.
- Add round status and countdown.
- Add anti-abuse checks around duplicate ownership and sync timing.
- Add score history per round.

### 5. TON Wallet and Rewards

- Replace basic TON proof verifier with production-grade proof verification.
- Store wallet connection history.
- Add reward eligibility logic.
- Add reward claim status.
- Add admin reward export.

### 6. Production Hardening

- Rotate Telegram bot token.
- Review Render env vars.
- Add stricter API rate limits.
- Add structured logs.
- Add monitoring for API sync failures.
- Add database backups policy in Supabase.
- Consider webhook bot mode instead of long polling for cleaner deploys.

### 7. Testing

- Add unit tests for Telegram initData verification.
- Add integration tests for gift sync mapping.
- Add test for image proxy content-type.
- Add frontend tests for missing/connected Telegram auth state.
- Add smoke test against staging/production health endpoints.

### 8. Launch Checklist

- Rotate secrets.
- Verify BotFather Mini App settings.
- Verify menu button URL.
- Verify sync on at least 3 Telegram users.
- Verify gifts with thumbnails on iOS and Android Telegram.
- Verify leaderboard after accepted target gifts.
- Confirm Supabase migrations and backups.
- Prepare short user instructions for opening via bot menu.
