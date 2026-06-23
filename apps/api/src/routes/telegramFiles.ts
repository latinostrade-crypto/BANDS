import { Router } from "express";
import { config } from "../config.js";
import { HttpError } from "../middleware/error.js";

export const telegramFilesRouter = Router();

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

    const fileResponse = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
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

    const assetResponse = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${filePath}`);
    if (!assetResponse.ok || !assetResponse.body) {
      throw new HttpError(502, "Telegram file download failed", "telegram_file_download_failed");
    }

    res.setHeader("cache-control", "public, max-age=86400, immutable");
    res.setHeader("content-type", contentTypeForPath(filePath));
    res.setHeader("cross-origin-resource-policy", "cross-origin");
    const buffer = Buffer.from(await assetResponse.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});
