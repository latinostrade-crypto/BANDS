import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../db/pool.js";
import { requireAdmin } from "../middleware/auth.js";

export const adminRouter = Router();

const targetGiftSchema = z.object({
  giftId: z.string().min(1),
  baseName: z.string().nullable().optional(),
  weight: z.number().int().positive(),
  isActive: z.boolean().default(true)
});

adminRouter.post("/admin/target-gifts", requireAdmin, async (req, res, next) => {
  try {
    const body = targetGiftSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const upserted = await client.query(
        `INSERT INTO target_gifts (gift_id, base_name, weight, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (gift_id)
         DO UPDATE SET base_name = EXCLUDED.base_name, weight = EXCLUDED.weight, is_active = EXCLUDED.is_active
         RETURNING *`,
        [body.giftId, body.baseName ?? null, body.weight, body.isActive]
      );
      await client.query(
        "INSERT INTO admin_audit_log (actor_user_id, action, payload) VALUES ($1, $2, $3)",
        [req.user!.id, "upsert_target_gift", JSON.stringify(body)]
      );
      return upserted.rows[0];
    });
    res.json({ targetGift: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/target-gifts", requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM target_gifts ORDER BY created_at DESC");
    res.json({ targetGifts: result.rows });
  } catch (error) {
    next(error);
  }
});
