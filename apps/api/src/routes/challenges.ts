import { Router } from "express";
import { z } from "zod";
import type {
  Challenge,
  ChallengeClaimResponse,
  ChallengeProposalResponse,
  ChallengeProposal,
  ChallengeProgressResponse,
  ChallengeProposalsResponse,
  ChallengeVoteResponse,
  CpaCompletionResponse,
  CpaTasksResponse,
  ChallengesResponse
} from "@bands/shared";
import { pool, withTransaction } from "../db/pool.js";
import { HttpError } from "../middleware/error.js";
import { activeRoundId } from "../services/profile.js";
import { calculateVoteWeight } from "../services/scoring.js";

export const challengesRouter = Router();

const modeSchema = z.enum(["tournament", "influencer", "santa", "tasks"]).optional();

const proposalSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(1000).nullable().optional()
});

const voteSchema = z.object({
  proposalId: z.number().int().positive(),
  paymentId: z.number().int().positive()
});

const paramsIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

const mapChallenge = (row: Record<string, unknown>): Challenge => ({
  id: Number(row.id),
  mode: row.mode as Challenge["mode"],
  creatorType: String(row.creator_type),
  creatorId: row.creator_id === null ? null : Number(row.creator_id),
  title: String(row.title),
  description: row.description as string | null,
  status: String(row.status),
  rewardPoints: Number(row.reward_points),
  rules: row.rules,
  startsAt: row.starts_at ? new Date(row.starts_at as string).toISOString() : null,
  endsAt: row.ends_at ? new Date(row.ends_at as string).toISOString() : null
});

const mapProposal = (row: Record<string, unknown>): ChallengeProposal => ({
  id: Number(row.id),
  title: String(row.title),
  description: row.description as string | null,
  creatorId: row.creator_id === null ? null : Number(row.creator_id),
  status: String(row.status),
  votesCount: Number(row.votes_count),
  startsAt: row.starts_at ? new Date(row.starts_at as string).toISOString() : null,
  endsAt: row.ends_at ? new Date(row.ends_at as string).toISOString() : null,
  createdAt: new Date(row.created_at as string).toISOString()
});

const mapTask = (row: Record<string, unknown>) => ({
  id: Number(row.id),
  title: String(row.title),
  description: row.description as string | null,
  rewardPoints: Number(row.reward_points),
  status: String(row.status),
  verificationType: String(row.verification_type)
});

challengesRouter.get("/challenges", async (req, res, next) => {
  try {
    const mode = modeSchema.parse(req.query.mode);
    const result = mode
      ? await pool.query(
          `SELECT *
           FROM challenges
           WHERE mode = $1 AND status IN ('active', 'scheduled')
           ORDER BY starts_at NULLS LAST, id DESC
           LIMIT 100`,
          [mode]
        )
      : await pool.query(
          `SELECT *
           FROM challenges
           WHERE status IN ('active', 'scheduled')
           ORDER BY starts_at NULLS LAST, id DESC
           LIMIT 100`
        );

    const response: ChallengesResponse = { challenges: result.rows.map(mapChallenge) };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

challengesRouter.get("/challenges/proposals", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM challenge_proposals
       WHERE status = 'open'
       ORDER BY votes_count DESC, created_at DESC
       LIMIT 100`
    );
    const response: ChallengeProposalsResponse = { proposals: result.rows.map(mapProposal) };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

challengesRouter.post("/challenges/proposals", async (req, res, next) => {
  try {
    const body = proposalSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO challenge_proposals (title, description, creator_id, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING *`,
      [body.title, body.description ?? null, req.user!.id]
    );
    const response: ChallengeProposalResponse = { proposal: mapProposal(result.rows[0]) };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

challengesRouter.post("/challenges/vote", async (req, res, next) => {
  try {
    const body = voteSchema.parse(req.body);
    const response = await withTransaction<ChallengeVoteResponse>(async (client) => {
      const proposal = await client.query(
        "SELECT id, votes_count FROM challenge_proposals WHERE id = $1 AND status = 'open' FOR UPDATE",
        [body.proposalId]
      );
      if (!proposal.rowCount) throw new HttpError(404, "Challenge proposal not found", "proposal_not_found");

      const existingVote = await client.query(
        "SELECT id FROM challenge_votes WHERE proposal_id = $1 AND user_id = $2",
        [body.proposalId, req.user!.id]
      );
      if (existingVote.rowCount) throw new HttpError(409, "User already voted for this proposal", "vote_exists");

      const payment = await client.query(
        `SELECT id
         FROM payments
         WHERE id = $1
           AND user_id = $2
           AND purpose = 'challenge_vote'
           AND status = 'confirmed'
         FOR UPDATE`,
        [body.paymentId, req.user!.id]
      );
      if (!payment.rowCount) throw new HttpError(402, "Confirmed challenge vote payment is required", "payment_required");

      const roundId = await activeRoundId(client);
      const gifts = await client.query(
        "SELECT COUNT(*)::int AS gift_count FROM user_gifts WHERE user_id = $1 AND round_id = $2",
        [req.user!.id, roundId]
      );
      const giftCount = Number(gifts.rows[0].gift_count);
      const voteWeight = calculateVoteWeight(giftCount);

      await client.query(
        `INSERT INTO challenge_votes (proposal_id, user_id, payment_id, vote_weight, gift_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [body.proposalId, req.user!.id, body.paymentId, voteWeight, giftCount]
      );

      const updatedProposal = await client.query(
        `UPDATE challenge_proposals
         SET votes_count = votes_count + $1
         WHERE id = $2
         RETURNING votes_count`,
        [voteWeight, body.proposalId]
      );

      return {
        ok: true,
        voteWeight,
        giftCount,
        votesCount: Number(updatedProposal.rows[0].votes_count)
      };
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

challengesRouter.get("/challenges/:id/progress", async (req, res, next) => {
  try {
    const params = paramsIdSchema.parse(req.params);
    const challenge = await pool.query("SELECT id, rules FROM challenges WHERE id = $1", [params.id]);
    if (!challenge.rowCount) throw new HttpError(404, "Challenge not found", "challenge_not_found");

    const target = Number((challenge.rows[0].rules as { target?: unknown } | null)?.target ?? 0);
    const result = await pool.query(
      `INSERT INTO challenge_progress (challenge_id, user_id, target)
       VALUES ($1, $2, $3)
       ON CONFLICT (challenge_id, user_id) DO UPDATE SET target = EXCLUDED.target
       RETURNING challenge_id, user_id, progress, target, status, claimed_at`,
      [params.id, req.user!.id, target]
    );
    const row = result.rows[0];
    const response: ChallengeProgressResponse = {
      progress: {
        challengeId: Number(row.challenge_id),
        userId: Number(row.user_id),
        progress: Number(row.progress),
        target: Number(row.target),
        status: String(row.status),
        claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null
      }
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

challengesRouter.post("/challenges/:id/claim", async (req, res, next) => {
  try {
    const params = paramsIdSchema.parse(req.params);
    const response = await withTransaction<ChallengeClaimResponse>(async (client) => {
      const challenge = await client.query(
        "SELECT id, reward_points FROM challenges WHERE id = $1 AND status = 'active'",
        [params.id]
      );
      if (!challenge.rowCount) throw new HttpError(404, "Active challenge not found", "challenge_not_found");

      const progress = await client.query(
        `SELECT progress, target, claimed_at
         FROM challenge_progress
         WHERE challenge_id = $1 AND user_id = $2
         FOR UPDATE`,
        [params.id, req.user!.id]
      );
      if (!progress.rowCount) throw new HttpError(403, "Challenge progress is missing", "progress_missing");
      if (progress.rows[0].claimed_at) throw new HttpError(409, "Challenge already claimed", "challenge_claimed");
      if (Number(progress.rows[0].target) > 0 && Number(progress.rows[0].progress) < Number(progress.rows[0].target)) {
        throw new HttpError(403, "Challenge is not complete", "challenge_incomplete");
      }

      const points = Number(challenge.rows[0].reward_points);
      const sourceId = `${params.id}:${req.user!.id}`;
      const ledger = await client.query(
        `INSERT INTO score_ledger (user_id, source, source_id, points, metadata)
         VALUES ($1, 'challenge_reward', $2, $3, $4)
         ON CONFLICT (source, source_id, user_id) DO NOTHING
         RETURNING id`,
        [req.user!.id, sourceId, points, JSON.stringify({ challengeId: params.id })]
      );
      if (!ledger.rowCount) throw new HttpError(409, "Challenge reward already recorded", "reward_exists");

      await client.query("UPDATE users SET score = score + $1, updated_at = NOW() WHERE id = $2", [points, req.user!.id]);
      await client.query(
        `UPDATE challenge_progress
         SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
         WHERE challenge_id = $1 AND user_id = $2`,
        [params.id, req.user!.id]
      );

      return { ok: true, points, status: "claimed" };
    });
    res.json(response);
  } catch (error) {
    next(error);
  }
});

challengesRouter.get("/tasks", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description, reward_points, status, verification_type FROM cpa_tasks WHERE status = 'active' ORDER BY id DESC LIMIT 100"
    );
    const response: CpaTasksResponse = { tasks: result.rows.map(mapTask) };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

challengesRouter.post("/tasks/:id/complete", async (req, res, next) => {
  try {
    const params = paramsIdSchema.parse(req.params);
    const response = await withTransaction<CpaCompletionResponse>(async (client) => {
      const task = await client.query(
        "SELECT id, reward_points, verification_type FROM cpa_tasks WHERE id = $1 AND status = 'active'",
        [params.id]
      );
      if (!task.rowCount) throw new HttpError(404, "Task not found", "task_not_found");

      const instant = task.rows[0].verification_type === "instant";
      const completion = await client.query(
        `INSERT INTO cpa_completions (task_id, user_id, status, verified_at)
         VALUES ($1, $2, $3, CASE WHEN $3 = 'verified' THEN NOW() ELSE NULL END)
         ON CONFLICT (task_id, user_id) DO UPDATE SET status = cpa_completions.status
         RETURNING task_id, user_id, status, verified_at`,
        [params.id, req.user!.id, instant ? "verified" : "pending"]
      );

      if (instant && completion.rows[0].status === "verified") {
        const sourceId = `${params.id}:${req.user!.id}`;
        const ledger = await client.query(
          `INSERT INTO score_ledger (user_id, source, source_id, points, metadata)
           VALUES ($1, 'cpa_task', $2, $3, $4)
           ON CONFLICT (source, source_id, user_id) DO NOTHING
           RETURNING id`,
          [req.user!.id, sourceId, Number(task.rows[0].reward_points), JSON.stringify({ taskId: params.id })]
        );
        if (ledger.rowCount) {
          await client.query("UPDATE users SET score = score + $1, updated_at = NOW() WHERE id = $2", [
            Number(task.rows[0].reward_points),
            req.user!.id
          ]);
        }
      }

      const row = completion.rows[0];
      return {
        completion: {
          taskId: Number(row.task_id),
          userId: Number(row.user_id),
          status: String(row.status),
          verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null
        }
      };
    });
    res.json(response);
  } catch (error) {
    next(error);
  }
});
