import { Router } from "express";
import type { LeaderboardEntry, LeaderboardResponse } from "@bands/shared";
import { pool } from "../db/pool.js";
import { activeRoundId } from "../services/profile.js";

export const leaderboardRouter = Router();

const mapEntry = (row: Record<string, unknown>): LeaderboardEntry => ({
  userId: Number(row.user_id),
  username: row.username as string | null,
  firstName: row.first_name as string | null,
  score: Number(row.score),
  premiumVotes: Number(row.premium_votes),
  socialLikes: Number(row.social_likes),
  isQualified: Boolean(row.is_qualified)
});

leaderboardRouter.get("/leaderboard", async (_req, res, next) => {
  try {
    const roundId = await activeRoundId(pool);
    const nftRace = await pool.query(
      `SELECT u.id AS user_id, u.username, u.first_name, u.score, u.social_likes, u.is_qualified,
        COUNT(v.id)::int AS premium_votes
       FROM users u
       LEFT JOIN votes v ON v.candidate_id = u.id AND v.round_id = $1
       GROUP BY u.id, u.username, u.first_name, u.score, u.social_likes, u.is_qualified
       ORDER BY (u.score + COUNT(v.id)) DESC, u.id ASC
       LIMIT 100`,
      [roundId]
    );
    const peoplesChoice = await pool.query(
      `SELECT u.id AS user_id, u.username, u.first_name, u.score, u.social_likes, u.is_qualified,
        COUNT(v.id)::int AS premium_votes
       FROM users u
       LEFT JOIN votes v ON v.candidate_id = u.id AND v.round_id = $1
       GROUP BY u.id, u.username, u.first_name, u.score, u.social_likes, u.is_qualified
       ORDER BY u.social_likes DESC, u.id ASC
       LIMIT 100`,
      [roundId]
    );
    const response: LeaderboardResponse = {
      nftRace: nftRace.rows.map(mapEntry),
      peoplesChoice: peoplesChoice.rows.map(mapEntry)
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});
