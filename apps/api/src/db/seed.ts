import "./../env.js";
import { pool } from "./pool.js";
import { activeRoundId } from "../services/profile.js";

const roundId = await activeRoundId(pool);

await pool.query(
  `INSERT INTO target_gifts (gift_id, base_name, weight, is_active)
   VALUES
    ('mock-star', 'Star Crown', 80, true),
    ('mock-band', 'Neon Band', 45, true)
   ON CONFLICT (gift_id)
   DO UPDATE SET base_name = EXCLUDED.base_name, weight = EXCLUDED.weight, is_active = EXCLUDED.is_active`
);

const users = [
  { tgId: "10001", username: "dev_user", firstName: "Dev", score: 0, qualified: true },
  { tgId: "10002", username: "gift_hunter", firstName: "Alex", score: 210, qualified: true },
  { tgId: "10003", username: "ton_collector", firstName: "Mira", score: 165, qualified: true },
  { tgId: "10004", username: "social_pick", firstName: "Nika", score: 40, qualified: false }
];

const ids: number[] = [];
for (const user of users) {
  const result = await pool.query(
    `INSERT INTO users (tg_id, username, first_name, score, is_qualified, social_likes, updated_at)
     VALUES ($1, $2, $3, $4, $5, 0, NOW())
     ON CONFLICT (tg_id)
     DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name,
       score = GREATEST(users.score, EXCLUDED.score), is_qualified = users.is_qualified OR EXCLUDED.is_qualified,
       updated_at = NOW()
     RETURNING id`,
    [user.tgId, user.username, user.firstName, user.score, user.qualified]
  );
  ids.push(Number(result.rows[0].id));
}

await pool.query(
  `INSERT INTO social_likes (round_id, voter_id, candidate_id)
   VALUES
    ($1, $2, $3),
    ($1, $3, $4),
    ($1, $4, $3)
   ON CONFLICT DO NOTHING`,
  [roundId, ids[0], ids[1], ids[2]]
);

await pool.query(
  `UPDATE users u
   SET social_likes = counts.count
   FROM (
     SELECT candidate_id, COUNT(*)::int AS count
     FROM social_likes
     WHERE round_id = $1
     GROUP BY candidate_id
   ) counts
   WHERE u.id = counts.candidate_id`,
  [roundId]
);

console.log("Seed complete");
await pool.end();
