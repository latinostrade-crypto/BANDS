import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { challengesRouter } from "./routes/challenges.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { meRouter } from "./routes/me.js";
import { paymentsRouter } from "./routes/payments.js";
import { santaRouter } from "./routes/santa.js";
import { syncRouter } from "./routes/sync.js";
import { telegramFilesRouter } from "./routes/telegramFiles.js";
import { votesRouter } from "./routes/votes.js";
import { walletRouter } from "./routes/wallet.js";

export const app = express();

app.use(helmet());
const allowedOrigins = config.webAppUrl
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/assets", telegramFilesRouter);

app.use("/api", authRouter);
app.use("/api", requireAuth, meRouter);
app.use("/api", requireAuth, syncRouter);
app.use("/api", requireAuth, leaderboardRouter);
app.use("/api", requireAuth, votesRouter);
app.use("/api", requireAuth, challengesRouter);
app.use("/api", requireAuth, paymentsRouter);
app.use("/api", requireAuth, santaRouter);
app.use("/api", requireAuth, walletRouter);
app.use("/api", requireAuth, adminRouter);

app.use(errorHandler);
