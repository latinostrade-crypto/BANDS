import crypto from "node:crypto";
import type { SyncProgress, SyncStartResponse, SyncSummary, SyncedUniqueGift } from "@bands/shared";
import type { TelegramGiftsProvider } from "../adapters/telegramGifts.js";
import { config } from "../config.js";
import { pool, withTransaction } from "../db/pool.js";
import { ensureRedis, redis } from "../db/redis.js";
import { HttpError } from "../middleware/error.js";
import { activeRoundId } from "./profile.js";
import { isReferralQualified, referralBonusPoints } from "./scoring.js";

type SyncUser = { id: number; tgId: string };

type SyncJobState = SyncProgress & {
  userId: number;
  tgId: string;
  provider: TelegramGiftsProvider;
};

const syncJobs = new Map<string, SyncJobState>();
const latestJobByUser = new Map<number, string>();
const progressTtlMs = 30 * 60 * 1000;
const pagePauseMs = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const emptyProgress = (): SyncProgress => ({
  status: "idle",
  jobId: null,
  fetched: 0,
  accepted: 0,
  rejected: 0,
  page: 0,
  error: null,
  startedAt: null,
  finishedAt: null
});

const persistJob = async (state: SyncJobState) => {
  await pool.query(
    `INSERT INTO sync_jobs (
      id, user_id, status, fetched, accepted, rejected, page, error, started_at, finished_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      status = EXCLUDED.status,
      fetched = EXCLUDED.fetched,
      accepted = EXCLUDED.accepted,
      rejected = EXCLUDED.rejected,
      page = EXCLUDED.page,
      error = EXCLUDED.error,
      finished_at = EXCLUDED.finished_at,
      updated_at = NOW()`,
    [
      state.jobId,
      state.userId,
      state.status,
      state.fetched,
      state.accepted,
      state.rejected,
      state.page,
      state.error,
      state.startedAt,
      state.finishedAt
    ]
  );
};

const loadLatestJob = async (userId: number): Promise<SyncProgress> => {
  const result = await pool.query(
    `SELECT id, status, fetched, accepted, rejected, page, error, started_at, finished_at
     FROM sync_jobs
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );
  if (!result.rowCount) return emptyProgress();
  const row = result.rows[0];
  return {
    status: row.status,
    jobId: String(row.id),
    fetched: Number(row.fetched),
    accepted: Number(row.accepted),
    rejected: Number(row.rejected),
    page: Number(row.page),
    error: row.error as string | null,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null
  };
};

const loadTargetWeights = async () => {
  const targets = await pool.query("SELECT gift_id, weight FROM target_gifts WHERE is_active = true");
  return new Map<string, number>(targets.rows.map((row) => [String(row.gift_id), Number(row.weight)]));
};

const saveGiftPage = async (
  user: SyncUser,
  roundId: number,
  targetWeights: Map<string, number>,
  gifts: SyncedUniqueGift[]
) =>
  withTransaction<Pick<SyncSummary, "accepted" | "rejected">>(async (client) => {
    let accepted = 0;
    let rejected = 0;

    for (const gift of gifts) {
      const weight = targetWeights.get(gift.giftId) ?? 0;
      if (gift.isBurned || gift.isFromBlockchain) {
        rejected += 1;
        continue;
      }

      const result = await client.query(
        `INSERT INTO user_gifts (
          user_id, round_id, gift_id, base_name, unique_name, unique_number, serial_number,
          model_name, symbol_name, backdrop_name, image_file_id, image_width, image_height,
          is_burned, is_from_blockchain, score_weight, raw_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (gift_id, unique_number, round_id)
        DO UPDATE SET
          base_name = EXCLUDED.base_name,
          unique_name = EXCLUDED.unique_name,
          model_name = EXCLUDED.model_name,
          symbol_name = EXCLUDED.symbol_name,
          backdrop_name = EXCLUDED.backdrop_name,
          image_file_id = EXCLUDED.image_file_id,
          image_width = EXCLUDED.image_width,
          image_height = EXCLUDED.image_height,
          is_burned = EXCLUDED.is_burned,
          is_from_blockchain = EXCLUDED.is_from_blockchain,
          score_weight = EXCLUDED.score_weight,
          raw_payload = EXCLUDED.raw_payload
        WHERE user_gifts.user_id = EXCLUDED.user_id
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
          gift.imageFileId ?? null,
          gift.imageWidth ?? null,
          gift.imageHeight ?? null,
          gift.isBurned,
          gift.isFromBlockchain,
          weight,
          JSON.stringify(gift.rawPayload)
        ]
      );
      if (result.rowCount) accepted += 1;
      else rejected += 1;
    }

    return { accepted, rejected };
  });

const finalizeUserScore = async (userId: number, roundId: number) => {
  const scoreResult = await pool.query(
    `SELECT
       COALESCE(SUM(score_weight), 0)::int AS score,
       COUNT(*)::int AS total_gifts
     FROM user_gifts
     WHERE user_id = $1 AND round_id = $2`,
    [userId, roundId]
  );
  const score = Number(scoreResult.rows[0].score);
  const totalGifts = Number(scoreResult.rows[0].total_gifts);
  await pool.query(
    `UPDATE users
     SET score = $1,
         is_qualified = $2,
         total_gifts_count = $3,
         first_sync_at = COALESCE(first_sync_at, NOW()),
         last_sync_at = NOW(),
         updated_at = NOW()
     WHERE id = $4`,
    [score, score > 0, totalGifts, userId]
  );
  await qualifyReferral(userId, totalGifts);
};

const qualifyReferral = async (userId: number, totalGifts: number) => {
  await withTransaction(async (client) => {
    const user = await client.query(
      `SELECT id, referrer_id, referral_rewarded_at, is_premium
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );
    if (!user.rowCount) return;

    const row = user.rows[0];
    const referrerId = row.referrer_id === null ? null : Number(row.referrer_id);
    if (!referrerId || row.referral_rewarded_at) return;

    if (!isReferralQualified(totalGifts)) {
      await client.query(
        `INSERT INTO referral_events (referrer_id, referred_id, status, reason)
         VALUES ($1, $2, 'rejected', 'gift_count_below_threshold')
         ON CONFLICT (referred_id)
         DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason`,
        [referrerId, userId]
      );
      return;
    }

    const points = referralBonusPoints(Boolean(row.is_premium));
    const ledger = await client.query(
      `INSERT INTO score_ledger (user_id, source, source_id, points, metadata)
       VALUES ($1, 'referral_bonus', $2, $3, $4)
       ON CONFLICT (source, source_id, user_id) DO NOTHING
       RETURNING id`,
      [referrerId, String(userId), points, JSON.stringify({ referredUserId: userId, totalGifts })]
    );
    if (!ledger.rowCount) return;

    await client.query(
      "UPDATE users SET score = score + $1, updated_at = NOW() WHERE id = $2",
      [points, referrerId]
    );
    await client.query(
      "UPDATE users SET referral_rewarded_at = NOW(), updated_at = NOW() WHERE id = $1",
      [userId]
    );
    await client.query(
      `INSERT INTO referral_events (referrer_id, referred_id, status, reason, points_awarded)
       VALUES ($1, $2, 'accepted', NULL, $3)
       ON CONFLICT (referred_id)
       DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, points_awarded = EXCLUDED.points_awarded`,
      [referrerId, userId, points]
    );
  });
};

const runSyncJob = async (jobId: string) => {
  const state = syncJobs.get(jobId);
  if (!state) return;

  try {
    const roundId = await activeRoundId(pool);
    const targetWeights = await loadTargetWeights();
    let offset: string | undefined;

    do {
      const page = await state.provider.getUserUniqueGiftsPage(Number(state.tgId), offset);
      state.page += 1;
      state.fetched += page.gifts.length;

      const saved = await saveGiftPage(
        { id: state.userId, tgId: state.tgId },
        roundId,
        targetWeights,
        page.gifts
      );
      state.accepted += saved.accepted;
      state.rejected += saved.rejected;
      state.status = "running";
      await persistJob(state);

      offset = page.nextOffset;
      if (offset) await sleep(pagePauseMs);
    } while (offset);

    await finalizeUserScore(state.userId, roundId);
    state.status = "done";
    state.finishedAt = new Date().toISOString();

    const summary: SyncSummary = {
      found: state.fetched,
      accepted: state.accepted,
      rejected: state.rejected,
      cooldownUntil: new Date(Date.now() + config.syncCooldownSeconds * 1000).toISOString()
    };
    await redis.set(`last_sync:${state.userId}`, JSON.stringify(summary), "EX", config.syncCooldownSeconds);
    await persistJob(state);
  } catch (error) {
    state.status = "failed";
    state.error = error instanceof Error ? error.message : "Sync failed";
    state.finishedAt = new Date().toISOString();
    await persistJob(state).catch(() => undefined);
  } finally {
    setTimeout(() => {
      if (syncJobs.get(jobId)?.finishedAt) syncJobs.delete(jobId);
    }, progressTtlMs).unref();
  }
};

export const startUserGiftsSync = async (
  user: SyncUser,
  provider: TelegramGiftsProvider
): Promise<SyncStartResponse> => {
  await ensureRedis();
  const lockKey = `sync_lock:${user.id}`;
  const lock = await redis.set(lockKey, "1", "EX", config.syncCooldownSeconds, "NX");
  if (!lock) {
    const ttl = await redis.ttl(lockKey);
    const cooldownUntil = new Date(Date.now() + Math.max(ttl, 1) * 1000).toISOString();
    throw new HttpError(429, `Sync cooldown is active until ${cooldownUntil}`, "sync_cooldown");
  }

  const jobId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const state: SyncJobState = {
    ...emptyProgress(),
    status: "running",
    jobId,
    userId: user.id,
    tgId: user.tgId,
    provider,
    startedAt
  };
  syncJobs.set(jobId, state);
  latestJobByUser.set(user.id, jobId);
  await persistJob(state);

  void runSyncJob(jobId);
  return { status: "started", jobId, cooldownUntil: new Date(Date.now() + config.syncCooldownSeconds * 1000).toISOString() };
};

export const getUserSyncProgress = async (userId: number): Promise<SyncProgress> => {
  const jobId = latestJobByUser.get(userId);
  if (jobId) {
    const state = syncJobs.get(jobId);
    if (state) {
      const { provider: _provider, userId: _userId, tgId: _tgId, ...progress } = state;
      return progress;
    }
  }
  return loadLatestJob(userId);
};

export const syncUserGifts = async (user: SyncUser, provider: TelegramGiftsProvider) => {
  const started = await startUserGiftsSync(user, provider);
  return {
    found: 0,
    accepted: 0,
    rejected: 0,
    cooldownUntil: started.cooldownUntil
  };
};
