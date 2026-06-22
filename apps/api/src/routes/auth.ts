import { Router } from "express";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { readRawInitData, signSession, upsertTelegramUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const authRouter = Router();

authRouter.post("/auth", async (req, res, next) => {
  try {
    const rawInitData = readRawInitData(req);
    if (!rawInitData) {
      if (!config.allowDevAuth) {
        throw new HttpError(403, "Missing Telegram init data", "missing_init_data");
      }
      const result = await pool.query(
        `INSERT INTO users (tg_id, username, first_name, is_qualified, score, updated_at)
         VALUES ($1, $2, $3, true, 0, NOW())
         ON CONFLICT (tg_id)
         DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, updated_at = NOW()
         RETURNING id, tg_id, username, first_name, is_qualified`,
        ["10001", "dev_user", "Dev"]
      );
      const user = {
        id: Number(result.rows[0].id),
        tgId: String(result.rows[0].tg_id),
        username: result.rows[0].username as string | null,
        firstName: result.rows[0].first_name as string | null,
        isQualified: Boolean(result.rows[0].is_qualified)
      };
      return res.json({ user, token: signSession(user.id), mode: "development" });
    }
    const user = await upsertTelegramUser(rawInitData);
    res.json({ user, token: signSession(user.id) });
  } catch (error) {
    next(error);
  }
});
