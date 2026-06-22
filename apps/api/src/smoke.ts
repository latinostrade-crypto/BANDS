import jwt from "jsonwebtoken";
import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { redis } from "./db/redis.js";

const json = async (base: string, path: string, options: RequestInit = {}) => {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  console.log(`${path} ${response.status}`);
  if (!response.ok) throw new Error(text);
  return JSON.parse(text) as Record<string, unknown>;
};

const userResult = await pool.query(
  "SELECT id FROM users WHERE tg_id = $1",
  ["10001"]
);
if (!userResult.rowCount) {
  throw new Error("Run npm run db:seed before smoke");
}

await redis.del(`sync_lock:${userResult.rows[0].id}`);
const token = jwt.sign({ userId: userResult.rows[0].id }, config.jwtSecret, { expiresIn: "1h" });

const server = app.listen(0, async () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not bind");
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };

  try {
    await json(base, "/health");
    await json(base, "/api/me", { headers });
    await json(base, "/api/profile/sync", { method: "POST", headers });
    const leaderboard = await json(base, "/api/leaderboard", { headers });
    const entries = leaderboard.nftRace as Array<{ userId: number }>;
    const target = entries.find((entry) => entry.userId !== Number(userResult.rows[0].id));
    if (target) {
      await json(base, "/api/social-like", {
        method: "POST",
        headers,
        body: JSON.stringify({ candidateId: target.userId })
      });
      await json(base, "/api/vote", {
        method: "POST",
        headers,
        body: JSON.stringify({ candidateId: target.userId, voteType: "premium" })
      });
    }
    await json(base, "/api/wallet/proof-payload", { method: "POST", headers });
    console.log("Smoke complete");
  } finally {
    server.close();
    await pool.end();
    redis.disconnect();
  }
});
