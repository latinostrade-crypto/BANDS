import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./error.js";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const cleanupEveryMs = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, cleanupEveryMs).unref();

export const rateLimit = (options: { windowMs: number; max: number; keyPrefix: string }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = req.user?.tgId ?? req.ip ?? "unknown";
    const key = `${options.keyPrefix}:${identity}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(new HttpError(429, "Too many requests", "rate_limited"));
    }

    next();
  };
};
