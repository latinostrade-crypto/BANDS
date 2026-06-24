import { Router } from "express";
import { BotApiTelegramGiftsProvider, MockTelegramGiftsProvider } from "../adapters/telegramGifts.js";
import { config } from "../config.js";
import { getUserSyncProgress, startUserGiftsSync } from "../services/sync.js";

export const syncRouter = Router();
const giftsProvider = config.useMockGifts ? new MockTelegramGiftsProvider() : new BotApiTelegramGiftsProvider();

syncRouter.post("/profile/sync", async (req, res, next) => {
  try {
    res.json(await startUserGiftsSync(req.user!, giftsProvider));
  } catch (error) {
    next(error);
  }
});

syncRouter.get("/profile/sync/progress", async (req, res, next) => {
  try {
    res.json(await getUserSyncProgress(req.user!.id));
  } catch (error) {
    next(error);
  }
});
