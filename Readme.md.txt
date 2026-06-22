# Bands 2

Актуализировано: 21.06.2026.

MVP Telegram Web App для конкурса коллекционеров Telegram Gifts. Приложение авторизует пользователя через Telegram Mini Apps `initData`, синхронизирует его уникальные подарки через официальный Telegram Bot API `getUserGifts`, строит лидерборд, защищает рейтинг от карусели подарков и подключает TON Connect для привязки кошелька победителей.

## 1. Проверка реализуемости

Проект реализуем как MVP, но с важным уточнением: надежный антифрод возможен только для уникальных подарков Telegram (`OwnedGiftUnique`). У них есть стабильная пара `gift.gift_id` + `gift.number`. Обычные подарки (`OwnedGiftRegular`) не дают такого же устойчивого идентификатора для защиты от пересылки между аккаунтами, поэтому в MVP они не участвуют в основном NFT-рейтинге.

Актуальные опорные факты:

* Telegram Bot API содержит официальный метод `getUserGifts`.
* `getUserGifts` возвращает `OwnedGifts` с пагинацией `offset` / `next_offset`, `limit` до 100.
* `UniqueGift.gift_id` имеет тип `String`, поэтому в базе нельзя хранить его как `BIGINT`.
* `UniqueGift.number` является уникальным номером подарка среди подарков, upgraded from the same regular gift.
* TON Connect для React официально поддерживается через `@tonconnect/ui-react`.
* Для безопасной привязки кошелька нужен `ton_proof`, простой адрес с клиента не считается доказательством владения.
* Telegram Mini Apps initData должна проверяться на backend через HMAC с bot token или через проверенную библиотеку.

## 2. Архитектура MVP

* **Frontend:** React + Vite + TypeScript + TailwindCSS.
* **Telegram Mini Apps:** предпочтительно `@tma.js/sdk`; если используется `@twa-dev/sdk`, держать его за adapter-слоем.
* **Web3:** `@tonconnect/ui-react`.
* **Backend:** Node.js + Express + TypeScript.
* **Database:** PostgreSQL.
* **Cache / Rate limit:** Redis.
* **Telegram Bot:** grammY или Telegraf.

Структура репозитория:

```text
apps/
  web/      # Telegram Mini App
  api/      # Express API
  bot/      # Telegram bot entrypoint
packages/
  shared/   # общие типы и схемы
infra/
  docker-compose.yml
  migrations/
```

## 3. PostgreSQL Schema

### `users`

* `id` SERIAL PRIMARY KEY
* `tg_id` BIGINT UNIQUE NOT NULL
* `username` VARCHAR NULL
* `first_name` VARCHAR NULL
* `wallet_address` VARCHAR NULL
* `wallet_verified_at` TIMESTAMP NULL
* `is_qualified` BOOLEAN DEFAULT false
* `score` INT DEFAULT 0
* `social_likes` INT DEFAULT 0
* `created_at` TIMESTAMP DEFAULT NOW()
* `updated_at` TIMESTAMP DEFAULT NOW()

### `rounds`

* `id` SERIAL PRIMARY KEY
* `title` VARCHAR NOT NULL
* `is_active` BOOLEAN DEFAULT false
* `starts_at` TIMESTAMP NULL
* `ends_at` TIMESTAMP NULL
* `created_at` TIMESTAMP DEFAULT NOW()

### `target_gifts`

Справочник подарков, которые дают очки в текущем раунде.

* `id` SERIAL PRIMARY KEY
* `gift_id` TEXT NOT NULL
* `base_name` VARCHAR NULL
* `weight` INT NOT NULL
* `is_active` BOOLEAN DEFAULT true
* `created_at` TIMESTAMP DEFAULT NOW()
* UNIQUE (`gift_id`)

### `user_gifts`

Фиксация уникальных подарков, засчитанных пользователям.

* `id` SERIAL PRIMARY KEY
* `user_id` INT REFERENCES users(id)
* `round_id` INT REFERENCES rounds(id)
* `gift_id` TEXT NOT NULL
* `base_name` VARCHAR NULL
* `unique_name` VARCHAR NULL
* `unique_number` INT NOT NULL
* `model_name` VARCHAR NULL
* `symbol_name` VARCHAR NULL
* `backdrop_name` VARCHAR NULL
* `is_burned` BOOLEAN DEFAULT false
* `is_from_blockchain` BOOLEAN DEFAULT false
* `score_weight` INT NOT NULL
* `raw_payload` JSONB NOT NULL
* `created_at` TIMESTAMP DEFAULT NOW()
* UNIQUE (`gift_id`, `unique_number`, `round_id`)

### `votes`

Premium-голосование qualified-пользователей.

* `id` SERIAL PRIMARY KEY
* `round_id` INT REFERENCES rounds(id)
* `voter_id` INT REFERENCES users(id)
* `candidate_id` INT REFERENCES users(id)
* `created_at` TIMESTAMP DEFAULT NOW()
* UNIQUE (`voter_id`, `candidate_id`, `round_id`)

### `social_likes`

Народный рейтинг без влияния на NFT-награды.

* `id` SERIAL PRIMARY KEY
* `round_id` INT REFERENCES rounds(id)
* `voter_id` INT REFERENCES users(id)
* `candidate_id` INT REFERENCES users(id)
* `created_at` TIMESTAMP DEFAULT NOW()
* UNIQUE (`voter_id`, `candidate_id`, `round_id`)

## 4. Backend API

Все `/api/*` запросы, кроме healthcheck, проходят Telegram initData middleware.

### `POST /api/auth`

* Принимает raw initData через `Authorization: tma <raw-init-data>`.
* Валидирует подпись и свежесть `auth_date`.
* Создает или обновляет пользователя.
* Возвращает текущий профиль и session/JWT.

### `GET /api/me`

Возвращает профиль, gifts summary, wallet status, cooldown синка.

### `POST /api/profile/sync`

Основной sync:

1. Проверяет Redis lock `sync_lock:<user_id>`.
2. Открывает SQL-транзакцию.
3. Блокирует пользователя через `SELECT ... FOR UPDATE`.
4. Вызывает Telegram Bot API `getUserGifts` с пагинацией.
5. Берет только `OwnedGiftUnique`.
6. Пропускает burned gifts.
7. Сопоставляет `gift.gift_id` с `target_gifts`.
8. Пишет в `user_gifts` через уникальный ключ `gift_id + unique_number + round_id`.
9. Если уникальный подарок уже закреплен за другим пользователем, не засчитывает его текущему пользователю.
10. Пересчитывает `users.score`.
11. Обновляет `users.is_qualified` по правилам раунда.
12. Возвращает summary: найдено, засчитано, отклонено, cooldown.

### `GET /api/leaderboard`

Возвращает два рейтинга:

* NFT Race: score + premium votes;
* People's Choice: social likes.

### `POST /api/vote`

Body:

```json
{
  "candidateId": 123,
  "voteType": "premium"
}
```

Правила:

* `premium` доступен только `is_qualified=true`.
* Один premium vote на пару voter/candidate/round.
* Нельзя голосовать за себя.

### `POST /api/social-like`

* Доступен авторизованным пользователям.
* Один like на пару voter/candidate/round.
* Не влияет на NFT-награды.

### `POST /api/wallet/proof-payload`

Генерирует nonce/payload для TON Connect `ton_proof`.

### `POST /api/wallet/verify`

Проверяет `ton_proof`, domain, timestamp, signature, public key и адрес. Только после успешной проверки сохраняет `users.wallet_address`.

### `POST /api/admin/target-gifts`

Admin endpoint для добавления и изменения target gifts.

Доступ только для `ADMIN_TG_IDS`.

## 5. Telegram Bot API Adapter

Создать `TelegramGiftsProvider`, чтобы бизнес-логика не зависела от конкретной библиотеки бота.

Интерфейс:

```ts
type SyncedUniqueGift = {
  giftId: string;
  baseName?: string;
  uniqueName?: string;
  uniqueNumber: number;
  modelName?: string;
  symbolName?: string;
  backdropName?: string;
  isBurned: boolean;
  isFromBlockchain: boolean;
  rawPayload: unknown;
};

interface TelegramGiftsProvider {
  getUserUniqueGifts(userId: number): Promise<SyncedUniqueGift[]>;
}
```

## 6. Frontend

Формат: мобильное TMA-приложение без лендинга.

### Вкладка 1: Профиль

* Telegram user summary.
* Score, qualification status.
* Кнопка "Синхронизировать подарки".
* Cooldown таймер при `429`.
* Список засчитанных unique gifts:
  `base_name`, `#number`, `model`, `symbol`, `backdrop`, weight.
* Summary после синка: найдено, засчитано, отклонено.

### Вкладка 2: Лидерборд

* Segmented tabs:
  * "NFT Race";
  * "People's Choice".
* Список участников: место, username, score/votes/likes.
* Действия:
  * "Vote" только для qualified;
  * "Like" для всех авторизованных.

### Вкладка 3: Кошелек

* `TonConnectButton`.
* После подключения показывать сокращенный адрес.
* Отдельный статус backend verification:
  * not connected;
  * connected, proof pending;
  * verified.
* Информационный блок: награды отправляются только на verified wallet.

## 7. TON Connect

Frontend:

* `TonConnectUIProvider` с публичным `manifestUrl`.
* `TonConnectButton`.
* `useTonAddress`, `useTonWallet`.
* `tonConnectUI.setConnectRequestParameters` для передачи `ton_proof` payload.

Manifest:

* публичный HTTPS URL;
* доступен без CORS/auth/challenge;
* icon PNG/ICO 180x180;
* содержит `url`, `name`, `iconUrl`, опционально `termsOfUseUrl`, `privacyPolicyUrl`.

Backend:

* хранит nonce/payload с коротким TTL;
* проверяет `ton_proof`;
* сохраняет адрес только после успешной проверки.

## 8. Bot

`/start`:

* коротко объясняет конкурс;
* показывает кнопку открытия Web App;
* не содержит бизнес-логики синка.

## 9. MVP Roadmap

1. Инициализировать монорепозиторий и Docker Compose.
2. Добавить PostgreSQL migrations и seed active round.
3. Реализовать Telegram initData middleware.
4. Реализовать `TelegramGiftsProvider` с `getUserGifts` и пагинацией.
5. Реализовать `/api/profile/sync` с транзакцией и антифродом.
6. Реализовать leaderboard, premium votes, social likes.
7. Собрать TMA frontend с тремя вкладками.
8. Подключить TON Connect и `ton_proof`.
9. Добавить admin endpoint для `target_gifts`.
10. Добавить bot `/start`.
11. Написать smoke/unit tests для auth, sync, votes, proof.
12. Проверить приложение в Telegram test environment и на реальном пользователе с unique gifts.

## 10. Основные риски

* Видимость gifts зависит от того, что Telegram возвращает как owned and hosted gifts.
* Без реального пользователя с unique gifts нельзя полностью проверить sync.
* Автоматический mint NFT не входит в MVP; сначала фиксируем verified wallet winners.
* Если правила конкурса захотят учитывать обычные подарки, понадобится отдельная модель доверия, потому что у regular gifts слабее антифрод-идентификация.

## 11. Проверенные источники

* Telegram Bot API: `https://core.telegram.org/bots/api`
* Telegram Bot API `getUserGifts`: `https://core.telegram.org/bots/api#getusergifts`
* Telegram Mini Apps init data: `https://docs.telegram-mini-apps.com/platform/init-data`
* TON Connect React: `https://docs.ton.org/applications/ton-connect/get-started`
* TON proof verification: `https://old-docs.ton.org/v3/guidelines/ton-connect/verifying-signed-in-users`
