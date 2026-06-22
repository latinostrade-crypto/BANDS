import type { SyncSummary } from "@bands/shared";
import type { TelegramGiftsProvider } from "../adapters/telegramGifts.js";
import { config } from "../config.js";
import { withTransaction } from "../db/pool.js";
import { ensureRedis, redis } from "../db/redis.js";
import { HttpError } from "../middleware/error.js";
import { activeRoundId } from "./profile.js";

export const syncUserGifts = async (user: { id: number; tgId: string }, provider: TelegramGiftsProvider) => {
  await ensureRedis();
  const lockKey = `sync_lock:${user.id}`;
  const lock = await redis.set(lockKey, "1", "EX", config.syncCooldownSeconds, "NX");
  if (!lock) {
    const ttl = await redis.ttl(lockKey);
    const cooldownUntil = new Date(Date.now() + Math.max(ttl, 1) * 1000).toISOString();
    throw new HttpError(429, "Sync cooldown is active", "sync_cooldown");
  }

  const allGifts = await provider.getUserUniqueGifts(Number(user.tgId));
  const summary = await withTransaction<SyncSummary>(async (client) => {
    const roundId = await activeRoundId(client);
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
    const targets = await client.query(
      "SELECT gift_id, weight FROM target_gifts WHERE is_active = true"
    );
    const targetWeights = new Map<string, number>(
      targets.rows.map((row) => [String(row.gift_id), Number(row.weight)])
    );

    let accepted = 0;
    let rejected = 0;
    for (const gift of allGifts) {
      const weight = targetWeights.get(gift.giftId);
      if (!weight || gift.isBurned || gift.isFromBlockchain) {
        rejected += 1;
        continue;
      }

      const result = await client.query(
        `INSERT INTO user_gifts (
          user_id, round_id, gift_id, base_name, unique_name, unique_number,
          model_name, symbol_name, backdrop_name, is_burned, is_from_blockchain, score_weight, raw_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (gift_id, unique_number, round_id) DO NOTHING
        RETURNING id`,
        [
          user.id,
          roundId,
          gift.giftId,
          gift.baseName ?? null,
          gift.uniqueName ?? null,
          gift.uniqueNumber,
          gift.modelName ?? null,
          gift.symbolName ?? null,
          gift.backdropName ?? null,
          gift.isBurned,
          gift.isFromBlockchain,
          weight,
          JSON.stringify(gift.rawPayload)
        ]
      );
      if (result.rowCount) accepted += 1;
      else rejected += 1;
    }

    const scoreResult = await client.query(
      "SELECT COALESCE(SUM(score_weight), 0)::int AS score FROM user_gifts WHERE user_id = $1 AND round_id = $2",
      [user.id, roundId]
    );
    const score = Number(scoreResult.rows[0].score);
    await client.query(
      "UPDATE users SET score = $1, is_qualified = $2, updated_at = NOW() WHERE id = $3",
      [score, score > 0, user.id]
    );

    return {
      found: allGifts.length,
      accepted,
      rejected,
      cooldownUntil: new Date(Date.now() + config.syncCooldownSeconds * 1000).toISOString()
    };
  });

  await redis.set(`last_sync:${user.id}`, JSON.stringify(summary), "EX", config.syncCooldownSeconds);
  return summary;
};
