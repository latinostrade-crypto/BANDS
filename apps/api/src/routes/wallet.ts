import { Router } from "express";
import { z } from "zod";
import { BasicTonProofVerifier, makeProofPayload } from "../adapters/tonProof.js";
import { config } from "../config.js";
import { pool, withTransaction } from "../db/pool.js";
import { HttpError } from "../middleware/error.js";

export const walletRouter = Router();
const verifier = new BasicTonProofVerifier();

walletRouter.post("/wallet/proof-payload", async (req, res, next) => {
  try {
    const payload = makeProofPayload();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      "INSERT INTO wallet_proofs (user_id, payload, expires_at) VALUES ($1, $2, $3)",
      [req.user!.id, payload, expiresAt]
    );
    res.json({ payload, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    next(error);
  }
});

const verifySchema = z.object({
  address: z.string().min(8),
  network: z.string().min(1),
  publicKey: z.string().min(32),
  proof: z.object({
    timestamp: z.number(),
    domain: z.object({ value: z.string(), lengthBytes: z.number().optional() }),
    signature: z.string().min(16),
    payload: z.string().min(16)
  })
});

walletRouter.post("/wallet/verify", async (req, res, next) => {
  try {
    const body = verifySchema.parse(req.body);
    const ok = await verifier.verify({ ...body, expectedDomain: config.tonProofDomain });
    if (!ok) throw new HttpError(403, "Invalid TON proof", "invalid_ton_proof");

    await withTransaction(async (client) => {
      const proof = await client.query(
        `SELECT id FROM wallet_proofs
         WHERE user_id = $1 AND payload = $2 AND expires_at > NOW() AND used_at IS NULL
         FOR UPDATE`,
        [req.user!.id, body.proof.payload]
      );
      if (!proof.rowCount) throw new HttpError(403, "Proof payload expired", "proof_expired");
      await client.query("UPDATE wallet_proofs SET used_at = NOW() WHERE id = $1", [proof.rows[0].id]);
      await client.query(
        "UPDATE users SET wallet_address = $1, wallet_verified_at = NOW(), updated_at = NOW() WHERE id = $2",
        [body.address, req.user!.id]
      );
    });

    res.json({ ok: true, walletAddress: body.address });
  } catch (error) {
    next(error);
  }
});
