import { Router } from "express";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { HttpError } from "../middleware/error.js";

export const telegramFilesRouter = Router();

const maxAssetBytes = 5 * 1024 * 1024;
const fileIdPattern = /^[A-Za-z0-9_-]{8,256}$/;
const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 60;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

telegramFilesRouter.use((req, _res, next) => {
  const forwardedFor = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const key = req.ip ?? forwardedFor ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const current = requestCounts.get(key);
  if (!current || current.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return next();
  }
  current.count += 1;
  if (current.count > maxRequestsPerWindow) {
    return next(new HttpError(429, "Too many asset requests", "rate_limited"));
  }
  next();
});

const contentTypeForPath = (filePath: string) => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
};

telegramFilesRouter.get("/telegram-file", async (req, res, next) => {
  try {
    const fileId = String(req.query.file_id ?? "");
    if (!fileId) throw new HttpError(400, "Missing file_id", "missing_file_id");
    if (!fileIdPattern.test(fileId)) throw new HttpError(400, "Invalid file_id", "invalid_file_id");

    const knownFile = await pool.query("SELECT 1 FROM user_gifts WHERE image_file_id = $1 LIMIT 1", [fileId]);
    if (!knownFile.rowCount) throw new HttpError(404, "Telegram file not found", "telegram_file_not_found");

    const fileResponse = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    const filePayload = (await fileResponse.json()) as {
      ok: boolean;
      description?: string;
      result?: { file_path?: string };
    };
    const filePath = filePayload.result?.file_path;
    if (!filePayload.ok || !filePath) {
      throw new HttpError(404, filePayload.description ?? "Telegram file not found", "telegram_file_not_found");
    }

    const assetResponse = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${filePath}`, {
      signal: AbortSignal.timeout(10_000)
    });
    if (!assetResponse.ok || !assetResponse.body) {
      throw new HttpError(502, "Telegram file download failed", "telegram_file_download_failed");
    }
    const contentLength = Number(assetResponse.headers.get("content-length") ?? 0);
    if (contentLength > maxAssetBytes) {
      throw new HttpError(502, "Telegram file is too large", "telegram_file_too_large");
    }

    res.setHeader("cache-control", "public, max-age=86400, immutable");
    res.setHeader("content-type", contentTypeForPath(filePath));
    res.setHeader("cross-origin-resource-policy", "cross-origin");
    const buffer = Buffer.from(await assetResponse.arrayBuffer());
    if (buffer.length > maxAssetBytes) {
      throw new HttpError(502, "Telegram file is too large", "telegram_file_too_large");
    }
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});
