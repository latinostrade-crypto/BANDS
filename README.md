# Telegram Gift Challenge Platform

Web3-платформа внутри Telegram Mini App, которая превращает коллекционирование Telegram Gifts в игровую механику: челленджи, DAO-голосования, рефералы, TON/Stars-монетизацию и анти-абуз защиту.

Текущий репозиторий уже содержит рабочий MVP `Bands 2`: React/Vite Mini App, Express/TypeScript API, PostgreSQL/Supabase-совместимые миграции, Redis cooldown, Telegram `initData` auth, адаптер `getUserGifts`, TON Connect proof flow, Telegram bot и базовые лидерборды. Этот README фиксирует целевую архитектуру и план перехода от MVP к Gift Challenge Platform.

## Целевая архитектура

```text
                  +------------------------------+
                  |      Telegram Bot API        |
                  +--------------+---------------+
                                 | getUserGifts pages, limit=100
                                 v
   +-----------------------------------------------------------+
   |                  Backend: Node.js on Render               |
   |                                                           |
   | Auth: Telegram initData validation, HMAC-SHA256           |
   | Sync: background stream pagination, RAM cleanup           |
   | Anti-abuse: gift uniqueness, Telegram ID, Premium checks  |
   | Runtime state: throttling, sync progress, idempotency     |
   +-----------------------------+-----------------------------+
                                 |
                   +-------------+-------------+
                   v                           v
+-------------------------------------+ +-------------------------------------+
|        Database: Supabase/Postgres  | |        Frontend: React Mini App     |
|                                     | |                                     |
| users: score, refs, premium, wallet | | Profile: gift image grid/list       |
| user_gifts: unique serial per round | | Challenges: 4 sub-modes             |
| challenges, proposals, votes        | | Sync progress polling every 2 sec   |
| payments, referrals, santa pool     | | Lazy static img rendering only      |
+-------------------------------------+ +-------------------------------------+
```

## Ключевые механики

### Hold-to-Vote

Голосование защищается экономикой и весом реальной коллекции. Пользователь платит микросбор, например `15 Stars` или `0.05 TON`, и голосует за предложение следующего челленджа. Backend сначала валидирует платеж, затем считает коллекцию пользователя в активном раунде:

```ts
const giftCount = await countUserGifts(userId, roundId);
const voteWeight = 1 + Math.floor(giftCount / 10);
```

Обычный пользователь получает вес `1`. Пользователь с `3000` подарков получает вес `301`. Вес прибавляется к `challenge_proposals.votes_count` атомарно и только после подтвержденного платежа.

### Двухэтапные рефералы

Реферальная ссылка вида `t.me/bot?startapp=ref_<partnerId>` только связывает аккаунты. Реферер получает бонус не за клик, а после первой валидной синхронизации реферала.

Правила начисления:

- при первом входе сохраняется `users.referrer_id`, но очки не начисляются;
- при первом sync backend проверяет минимум `3` уникальных подарка и Telegram `is_premium`;
- за обычного валидного реферала начисляется `+50` очков, за Premium-юзера `+150`;
- если у реферала `0` подарков или он не проходит анти-абуз проверку, бонус не начисляется;
- при последующих платных действиях реферала реферер получает `10%` от заработанных очков как cashback ledger event.

### Challenges

Вкладка `Challenges` должна иметь четыре горизонтальных sub-tabs:

- `Турниры`: системные глобальные квесты от админа с прогрессом пользователя, например `3/5`.
- `Инфлюенсеры`: челленджи из `challenges`, где `creator_type = 'influencer'`.
- `Тайный Санта`: подарочный пул `100 в 50`; пользователь отправляет подарок на бот-хранилище, backend учитывает floor price и распределяет пул между победителями с весом стоимости вклада.
- `Задания`: CPA/Earn задачи: подписки, инвайты и простые действия за быстрые очки.

## Технические правила

Эти ограничения обязательны для защиты бесплатных Render/Supabase ресурсов и мобильной производительности:

- На фронтенде не использовать Canvas, Lottie, WebM-стикеры и тяжелые анимации для подарков.
- Подарки рендерить как статичные изображения: `<img src={gift.thumbnailUrl} loading="lazy" />`.
- Цвет карточки брать из базы: `style={{ backgroundColor: gift.backdropColor }}`.
- `/api/profile/sync` не должен блокировать фронтенд: он возвращает `200 {"status":"started"}` и запускает фоновой sync.
- Прогресс sync отдавать отдельным endpoint, фронтенд опрашивает его раз в `2` секунды.
- Telegram Gifts запрашивать пачками по `100` с паузой `100ms` между запросами.
- Не держать коллекции китов целиком в памяти; обрабатывать и писать в БД постранично.
- Уникальность подарка защищать в БД ключом `(gift_id, unique_number, round_id)` или после миграции `(tg_gift_id, serial_number, round_id)`.
- Все платные операции должны быть идемпотентными через `payment_id`/`external_tx_id`.

## План внедрения

### 0. Зафиксировать контракты MVP

- Описать текущие API-контракты `auth`, `me`, `profile/sync`, `leaderboard`, `vote`, `wallet`.
- Добавить feature flags для новых механик: `CHALLENGES_ENABLED`, `REFERRALS_ENABLED`, `SANTA_ENABLED`, `STARS_PAYMENTS_ENABLED`, `TON_PAYMENTS_ENABLED`.
- Сохранить существующие leaderboard/vote endpoints до миграции UI, чтобы не ломать рабочий MVP.

### 1. Расширить схему данных

Добавить миграции без разрушения текущих таблиц:

- `users`: `referrer_id`, `referral_rewarded_at`, `is_premium`, `first_sync_at`, `last_sync_at`, `total_gifts_count`.
- `user_gifts`: `thumbnail_url`, `backdrop_color`, `serial_number`, normalized trait columns, индексы по `user_id`, `round_id`, `gift_id`.
- `challenges`: тип, статус, creator metadata, условия, награда, старт/финиш.
- `challenge_progress`: прогресс пользователя по каждому челленджу.
- `challenge_proposals`: предложения DAO-голосования и `votes_count`.
- `challenge_votes`: user/proposal/payment/vote_weight audit trail.
- `payments`: Stars/TON payment intents, confirmations, idempotency keys.
- `score_ledger`: все начисления очков, включая referral bonus, cashback, challenge reward.
- `referral_events`: анти-сибил статусы и причины отказа.
- `santa_pool_entries` и `santa_pool_draws`: вклады, floor price, custody status, результаты розыгрыша.
- `cpa_tasks` и `cpa_completions`: задания и подтверждения.

### 2. Переписать sync под фоновые задачи

- Изменить `POST /api/profile/sync`: ставит lock, создает job, возвращает `{"status":"started","jobId":...}`.
- Добавить `GET /api/profile/sync/progress`: `idle | running | done | failed`, счетчики `fetched`, `accepted`, `rejected`, `page`, `error`.
- Вынести sync worker в сервис, который читает Telegram `getUserGifts` постранично, `limit=100`.
- Между страницами делать `await sleep(100)`.
- Писать подарки batch insert/upsert по странице, а не одной большой транзакцией на 30000+ подарков.
- Очищать progress map после TTL. Для одного Render API достаточно in-memory map; если появится несколько API-инстансов, перенести progress в Redis.
- На первом успешном sync вызывать referral qualification service.

### 3. Реализовать анти-абуз профиль

- Читать `is_premium` из подписанного Telegram `initData` и обновлять `users.is_premium`.
- Запретить саморефералы и циклические рефералы.
- Проверять `COUNT(user_gifts) >= 3` перед referral reward.
- Фиксировать все начисления через `score_ledger`, а не прямые `users.score += ...` без истории.
- Добавить rate limits на auth, sync, vote и payment endpoints.

### 4. Добавить Challenges API

Новые endpoints:

- `GET /api/challenges?mode=tournament|influencer|santa|tasks`
- `GET /api/challenges/:id/progress`
- `POST /api/challenges/:id/claim`
- `GET /api/challenges/proposals`
- `POST /api/challenges/proposals`
- `POST /api/challenges/vote`
- `POST /api/tasks/:id/complete`

Backend должен считать прогресс по условиям челленджа сервер-side. Фронтенд может показывать прогресс, но не должен быть источником правды.

### 5. Внедрить платежи Stars/TON

- Создать payment intent перед vote, paid sync, Secret Santa entry или boost.
- Для Stars использовать Telegram payment/pre-checkout flow.
- Для TON использовать подтверждение транзакции с idempotency key и серверной проверкой.
- После подтверждения платежа выполнять доменную операцию: голос, entry в пул, paid refresh.
- Повторная доставка webhook/transaction check не должна повторно начислять очки или голоса.

### 6. Реализовать Hold-to-Vote

- `POST /api/challenges/vote` принимает `proposalId` и `paymentId`.
- Backend проверяет payment status `confirmed`.
- Backend считает `giftCount` по активному round.
- Backend вычисляет `voteWeight = 1 + Math.floor(giftCount / 10)`.
- В одной транзакции пишет `challenge_votes` и увеличивает `challenge_proposals.votes_count`.
- Добавить защиту от повторного использования платежа и audit trail для админки.

### 7. Обновить фронтенд

- Заменить текущую навигацию `Profile / Leaderboard / Wallet` на целевую структуру с вкладкой `Challenges`; legacy leaderboard можно оставить как режим турниров или отдельный admin/debug экран.
- В `Profile` добавить виртуализированный/постраничный список подарков и фоновый progress bar sync.
- В `Challenges` сделать sub-tabs: `Турниры`, `Инфлюенсеры`, `Тайный Санта`, `Задания`.
- Все списки подарков рендерить через lazy `<img>`, без тяжелых анимаций.
- Исправить mojibake в русских строках и привести copy к одному языку.

### 8. Secret Santa

- Вынести Fragment/floor-price логику в отдельный adapter с cache TTL.
- Не блокировать entry на медленном price lookup: использовать статус `price_pending`, затем `eligible | rejected`.
- Бот-хранилище должен иметь понятный custody flow и audit log.
- Розыгрыш делать воспроизводимым: seed, snapshot pool, weighted selection, immutable draw result.
- До публичного запуска проверить юридические и платформенные ограничения, потому что механика похожа на gambling.

### 9. Админка и операции

- Admin UI для target gifts, challenges, proposals, CPA tasks, Santa pool и reward ledger.
- Structured logs для sync jobs, Telegram API ошибок, payment callbacks.
- Supabase indexes и explain-анализ для запросов по большим коллекциям.
- Backups, secret rotation, monitoring health endpoints.
- Перейти на webhook bot mode перед нагрузочным запуском, если long polling начнет конфликтовать при deploy.

### 10. Тестирование перед релизом

- Unit tests: Telegram initData HMAC, vote weight, referral eligibility, payment idempotency.
- Integration tests: sync pagination, duplicate gift conflict, first-sync referral reward.
- API tests: challenges list/progress/claim/vote.
- Frontend tests: sync started/progress/done, empty states, large gift list.
- Smoke: `GET /health`, auth through Telegram, sync on реальных аккаунтах с разным размером коллекции.

## Текущий статус репозитория

Уже реализовано:

- React + Vite Telegram Mini App.
- Express + TypeScript API.
- PostgreSQL migrations и локальный Docker stack.
- Redis sync cooldown.
- Telegram `initData` auth middleware с HMAC-SHA256.
- Telegram Bot API `getUserGifts` adapter.
- Уникальность подарка через `(gift_id, unique_number, round_id)`.
- Telegram thumbnail proxy без раскрытия bot token.
- Profile, Leaderboard, Wallet экраны.
- TON Connect proof payload/verify skeleton.
- grammY bot со `/start` Web App button.

Еще не реализовано и должно идти по roadmap выше:

- фоновый sync с progress polling;
- таблицы и API челленджей;
- Hold-to-Vote с paid vote weight;
- двухэтапные рефералы;
- Secret Santa pool;
- CPA tasks;
- полноценная платежная идемпотентность и ledger accounting;
- production-grade TON proof/payment verification.

## Локальный запуск

1. Скопировать `.env.example` в `.env` и заполнить реальные значения.
2. Запустить Postgres и Redis:

```bash
docker compose -f infra/docker-compose.yml up -d
```

На Windows можно использовать helper:

```bash
npm run infra:up
```

3. Установить зависимости:

```bash
npm install
```

4. Применить миграции и seed:

```bash
npm run db:migrate
npm run db:seed
```

5. Запустить API, Web и Bot:

```bash
npm run dev:all
```

Или отдельно:

```bash
npm run dev:api
npm run dev:web
npm run dev:bot
```

Локально web app работает на `http://localhost:5173`, API на `http://localhost:4000`.

## Проверки

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

## Production notes

- `WEB_APP_URL`, `API_PUBLIC_URL`, `TON_PROOF_DOMAIN`, `TON_MANIFEST_URL` должны быть публичными HTTPS URL.
- `ADMIN_TG_IDS` заполняется Telegram ID админов через запятую.
- Для production должны быть выключены `ALLOW_DEV_AUTH=false` и `USE_MOCK_GIFTS=false`.
- Перед реальным трафиком нужно ротировать Telegram bot token, если он когда-либо передавался в чатах.
- Render + Supabase deployment notes лежат в `docs/deploy-render-supabase.md`.
