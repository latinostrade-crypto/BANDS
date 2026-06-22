# Deploy to Render + Supabase

## 1. Supabase

1. Create a Supabase project.
2. Open Project Settings -> Database -> Connection string.
3. Copy the pooled or direct PostgreSQL URI.
4. Use it as Render `DATABASE_URL`.
5. Keep `DATABASE_SSL=true`.

The API service runs migrations on start:

```bash
npm run migrate -w apps/api
```

## 2. Render Blueprint

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will read `render.yaml` and create:
   - `bands-api`
   - `bands-web`
   - `bands-bot`
   - `bands-redis`
4. Fill the secret env vars marked `sync: false`:
   - `DATABASE_URL`
   - `BOT_TOKEN`
   - `ADMIN_TG_IDS`

Default production URLs in `render.yaml` are:

```text
https://bands-api.onrender.com
https://bands-web.onrender.com
```

If Render changes the service slugs, update these env vars in Render:

```text
WEB_APP_URL
API_PUBLIC_URL
TON_PROOF_DOMAIN
TON_MANIFEST_URL
VITE_API_URL
VITE_APP_URL
VITE_TON_MANIFEST_URL
```

## 3. Telegram Bot

In BotFather:

1. Set the Web App URL to `https://bands-web.onrender.com`.
2. If the bot token was shared in chat, regenerate it before production.

## 4. Production switches

Production must use:

```text
ALLOW_DEV_AUTH=false
USE_MOCK_GIFTS=false
DATABASE_SSL=true
```

Local development can keep:

```text
ALLOW_DEV_AUTH=true
USE_MOCK_GIFTS=true
DATABASE_SSL=false
```
