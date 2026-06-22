import { Redis } from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2
});

export const ensureRedis = async () => {
  if (redis.status === "wait") await redis.connect();
};
