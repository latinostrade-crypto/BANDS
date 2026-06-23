import type { MeResponse, UserGift, UserProfile } from "@bands/shared";
import { config } from "../config.js";
import type { DbClient } from "../db/pool.js";
import { pool } from "../db/pool.js";

export const activeRoundId = async (client: DbClient) => {
  const result = await client.query("SELECT id FROM rounds WHERE is_active = true ORDER BY id DESC LIMIT 1");
  if (!result.rowCount) throw new Error("No active round");
  return Number(result.rows[0].id);
};

export const mapUser = (row: Record<string, unknown>): UserProfile => ({
  id: Number(row.id),
  tgId: String(row.tg_id),
  username: row.username as string | null,
  firstName: row.first_name as string | null,
  walletAddress: row.wallet_address as string | null,
  walletVerifiedAt: row.wallet_verified_at ? new Date(row.wallet_verified_at as string).toISOString() : null,
  isQualified: Boolean(row.is_qualified),
  score: Number(row.score),
  socialLikes: Number(row.social_likes)
});

const mapGift = (row: Record<string, unknown>): UserGift => ({
  id: Number(row.id),
  giftId: String(row.gift_id),
  baseName: row.base_name as string | null,
  uniqueName: row.unique_name as string | null,
  uniqueNumber: Number(row.unique_number),
  modelName: row.model_name as string | null,
  symbolName: row.symbol_name as string | null,
  backdropName: row.backdrop_name as string | null,
  imageUrl: row.image_file_id
    ? `${config.apiPublicUrl}/assets/telegram-file?file_id=${encodeURIComponent(String(row.image_file_id))}`
    : null,
  imageWidth: row.image_width === null ? null : Number(row.image_width),
  imageHeight: row.image_height === null ? null : Number(row.image_height),
  scoreWeight: Number(row.score_weight)
});

export const getMe = async (userId: number): Promise<MeResponse> => {
  const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (!userResult.rowCount) throw new Error("User not found");
  const roundId = await activeRoundId(pool);
  const giftsResult = await pool.query(
    `SELECT id, gift_id, base_name, unique_name, unique_number, model_name, symbol_name,
       backdrop_name, image_file_id, image_width, image_height, score_weight
     FROM user_gifts
     WHERE user_id = $1 AND round_id = $2
     ORDER BY score_weight DESC, unique_number ASC`,
    [userId, roundId]
  );

  return {
    user: mapUser(userResult.rows[0]),
    gifts: giftsResult.rows.map(mapGift),
    lastSync: null
  };
};
