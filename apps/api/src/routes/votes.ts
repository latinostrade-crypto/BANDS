import { Router } from "express";
import { z } from "zod";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../middleware/error.js";
import { activeRoundId } from "../services/profile.js";

export const votesRouter = Router();

const voteSchema = z.object({
  candidateId: z.number().int().positive(),
  voteType: z.literal("premium")
});

const likeSchema = z.object({
  candidateId: z.number().int().positive()
});

votesRouter.post("/vote", async (req, res, next) => {
  try {
    const body = voteSchema.parse(req.body);
    if (body.candidateId === req.user!.id) throw new HttpError(400, "Cannot vote for yourself", "self_vote");

    await withTransaction(async (client) => {
      const roundId = await activeRoundId(client);
      const voter = await client.query("SELECT is_qualified FROM users WHERE id = $1 FOR UPDATE", [req.user!.id]);
      if (!voter.rowCount || !voter.rows[0].is_qualified) {
        throw new HttpError(403, "Premium vote requires qualified profile", "not_qualified");
      }
      const candidate = await client.query("SELECT id FROM users WHERE id = $1", [body.candidateId]);
      if (!candidate.rowCount) throw new HttpError(404, "Candidate not found", "candidate_not_found");
      await client.query(
        `INSERT INTO votes (round_id, voter_id, candidate_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (voter_id, candidate_id, round_id) DO NOTHING`,
        [roundId, req.user!.id, body.candidateId]
      );
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

votesRouter.post("/social-like", async (req, res, next) => {
  try {
    const body = likeSchema.parse(req.body);
    if (body.candidateId === req.user!.id) throw new HttpError(400, "Cannot like yourself", "self_like");

    await withTransaction(async (client) => {
      const roundId = await activeRoundId(client);
      const candidate = await client.query("SELECT id FROM users WHERE id = $1", [body.candidateId]);
      if (!candidate.rowCount) throw new HttpError(404, "Candidate not found", "candidate_not_found");
      const inserted = await client.query(
        `INSERT INTO social_likes (round_id, voter_id, candidate_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (voter_id, candidate_id, round_id) DO NOTHING
         RETURNING id`,
        [roundId, req.user!.id, body.candidateId]
      );
      if (inserted.rowCount) {
        await client.query(
          `UPDATE users
           SET social_likes = (
             SELECT COUNT(*)::int FROM social_likes WHERE candidate_id = $1 AND round_id = $2
           )
           WHERE id = $1`,
          [body.candidateId, roundId]
        );
      }
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
