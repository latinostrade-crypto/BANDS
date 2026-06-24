import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import type { DevPaymentResponse } from "@bands/shared";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { HttpError } from "../middleware/error.js";

export const paymentsRouter = Router();

const devPaymentSchema = z.object({
  purpose: z.enum(["challenge_vote", "paid_sync", "santa_entry", "boost"]),
  amount: z.number().positive().default(0.05),
  currency: z.enum(["TON", "STARS"]).default("TON"),
  metadata: z.record(z.unknown()).optional()
});

paymentsRouter.post("/payments/dev-confirmed", async (req, res, next) => {
  try {
    if (!config.allowDevAuth) {
      throw new HttpError(403, "Dev payments are disabled", "dev_payments_disabled");
    }

    const body = devPaymentSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO payments (
        user_id, provider, purpose, amount, currency, status, external_tx_id,
        idempotency_key, metadata, confirmed_at
      )
      VALUES ($1, 'dev', $2, $3, $4, 'confirmed', $5, $6, $7, NOW())
      RETURNING id, provider, purpose, amount, currency, status`,
      [
        req.user!.id,
        body.purpose,
        body.amount,
        body.currency,
        `dev-${crypto.randomUUID()}`,
        `dev-${req.user!.id}-${crypto.randomUUID()}`,
        JSON.stringify(body.metadata ?? {})
      ]
    );

    const row = result.rows[0];
    const response: DevPaymentResponse = {
      payment: {
        id: Number(row.id),
        provider: String(row.provider),
        purpose: String(row.purpose),
        amount: String(row.amount),
        currency: String(row.currency),
        status: String(row.status)
      }
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});
