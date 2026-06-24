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

const challengeSchema = z.object({
  id: z.number().int().positive().optional(),
  mode: z.enum(["tournament", "influencer", "santa", "tasks"]),
  creatorType: z.string().min(1).default("system"),
  title: z.string().min(3).max(140),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "scheduled", "active", "finished"]).default("draft"),
  rewardPoints: z.number().int().min(0).default(0),
  rules: z.record(z.unknown()).default({}),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional()
});

const cpaTaskSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(3).max(140),
  description: z.string().nullable().optional(),
  rewardPoints: z.number().int().min(0).default(0),
  status: z.enum(["active", "paused", "archived"]).default("active"),
  verificationType: z.enum(["manual", "instant"]).default("manual"),
  metadata: z.record(z.unknown()).default({})
});

const proposalStatusSchema = z.object({
  status: z.enum(["open", "selected", "rejected", "archived"])
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

adminRouter.get("/admin/status", requireAdmin, async (req, res) => {
  res.json({ isAdmin: true, userId: req.user!.id });
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

adminRouter.post("/admin/challenges", requireAdmin, async (req, res, next) => {
  try {
    const body = challengeSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const upserted = body.id
        ? await client.query(
            `UPDATE challenges
             SET mode = $2,
                 creator_type = $3,
                 title = $4,
                 description = $5,
                 status = $6,
                 reward_points = $7,
                 rules = $8,
                 starts_at = $9,
                 ends_at = $10,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
              body.id,
              body.mode,
              body.creatorType,
              body.title,
              body.description ?? null,
              body.status,
              body.rewardPoints,
              JSON.stringify(body.rules),
              body.startsAt ?? null,
              body.endsAt ?? null
            ]
          )
        : await client.query(
            `INSERT INTO challenges (
              mode, creator_type, title, description, status, reward_points, rules, starts_at, ends_at
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [
              body.mode,
              body.creatorType,
              body.title,
              body.description ?? null,
              body.status,
              body.rewardPoints,
              JSON.stringify(body.rules),
              body.startsAt ?? null,
              body.endsAt ?? null
            ]
          );
      await client.query("INSERT INTO admin_audit_log (actor_user_id, action, payload) VALUES ($1, $2, $3)", [
        req.user!.id,
        "upsert_challenge",
        JSON.stringify(body)
      ]);
      return upserted.rows[0];
    });
    res.json({ challenge: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/challenges", requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM challenges ORDER BY created_at DESC LIMIT 200");
    res.json({ challenges: result.rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/cpa-tasks", requireAdmin, async (req, res, next) => {
  try {
    const body = cpaTaskSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const upserted = body.id
        ? await client.query(
            `UPDATE cpa_tasks
             SET title = $2,
                 description = $3,
                 reward_points = $4,
                 status = $5,
                 verification_type = $6,
                 metadata = $7,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
              body.id,
              body.title,
              body.description ?? null,
              body.rewardPoints,
              body.status,
              body.verificationType,
              JSON.stringify(body.metadata)
            ]
          )
        : await client.query(
            `INSERT INTO cpa_tasks (title, description, reward_points, status, verification_type, metadata)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING *`,
            [
              body.title,
              body.description ?? null,
              body.rewardPoints,
              body.status,
              body.verificationType,
              JSON.stringify(body.metadata)
            ]
          );
      await client.query("INSERT INTO admin_audit_log (actor_user_id, action, payload) VALUES ($1, $2, $3)", [
        req.user!.id,
        "upsert_cpa_task",
        JSON.stringify(body)
      ]);
      return upserted.rows[0];
    });
    res.json({ task: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/cpa-tasks", requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM cpa_tasks ORDER BY created_at DESC LIMIT 200");
    res.json({ tasks: result.rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/proposals", requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM challenge_proposals ORDER BY created_at DESC LIMIT 200");
    res.json({ proposals: result.rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/proposals/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const params = idParamSchema.parse(req.params);
    const body = proposalStatusSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const updated = await client.query(
        "UPDATE challenge_proposals SET status = $1 WHERE id = $2 RETURNING *",
        [body.status, params.id]
      );
      await client.query("INSERT INTO admin_audit_log (actor_user_id, action, payload) VALUES ($1, $2, $3)", [
        req.user!.id,
        "update_proposal_status",
        JSON.stringify({ id: params.id, status: body.status })
      ]);
      return updated.rows[0] ?? null;
    });
    if (!result) return res.status(404).json({ error: { code: "proposal_not_found", message: "Proposal not found" } });
    res.json({ proposal: result });
  } catch (error) {
    next(error);
  }
});
