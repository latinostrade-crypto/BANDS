import { Router } from "express";
import { z } from "zod";
import type { SantaEntryResponse, SantaPoolResponse } from "@bands/shared";
import { pool, withTransaction } from "../db/pool.js";
import { HttpError } from "../middleware/error.js";
import { activeRoundId } from "../services/profile.js";

export const santaRouter = Router();

const entrySchema = z.object({
  userGiftId: z.number().int().positive(),
  paymentId: z.number().int().positive()
});

santaRouter.get("/santa/pool", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS entries_count,
         COUNT(*) FILTER (WHERE status = 'eligible')::int AS eligible_count,
         COUNT(*) FILTER (WHERE status IN ('pending', 'price_pending'))::int AS pending_count
       FROM santa_pool_entries`
    );
    const row = result.rows[0];
    const response: SantaPoolResponse = {
      entriesCount: Number(row.entries_count),
      eligibleCount: Number(row.eligible_count),
      pendingCount: Number(row.pending_count)
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

santaRouter.post("/santa/entries", async (req, res, next) => {
  try {
    const body = entrySchema.parse(req.body);
    const response = await withTransaction<SantaEntryResponse>(async (client) => {
      const roundId = await activeRoundId(client);
      const gift = await client.query(
        "SELECT id FROM user_gifts WHERE id = $1 AND user_id = $2 AND round_id = $3 FOR UPDATE",
        [body.userGiftId, req.user!.id, roundId]
      );
      if (!gift.rowCount) throw new HttpError(404, "Gift not found for active round", "gift_not_found");

      const payment = await client.query(
        `SELECT id
         FROM payments
         WHERE id = $1
           AND user_id = $2
           AND purpose = 'santa_entry'
           AND status = 'confirmed'
         FOR UPDATE`,
        [body.paymentId, req.user!.id]
      );
      if (!payment.rowCount) throw new HttpError(402, "Confirmed Santa entry payment is required", "payment_required");

      const existing = await client.query(
        "SELECT id FROM santa_pool_entries WHERE user_gift_id = $1 OR payment_id = $2 LIMIT 1",
        [body.userGiftId, body.paymentId]
      );
      if (existing.rowCount) throw new HttpError(409, "Santa entry already exists", "santa_entry_exists");

      const entry = await client.query(
        `INSERT INTO santa_pool_entries (user_id, user_gift_id, payment_id, status)
         VALUES ($1, $2, $3, 'price_pending')
         RETURNING id, user_gift_id, status, floor_price`,
        [req.user!.id, body.userGiftId, body.paymentId]
      );
      const row = entry.rows[0];
      return {
        entry: {
          id: Number(row.id),
          userGiftId: Number(row.user_gift_id),
          status: String(row.status),
          floorPrice: row.floor_price === null ? null : String(row.floor_price)
        }
      };
    });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});
