import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { HttpError } from "./error.js";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  is_premium?: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        tgId: string;
        username: string | null;
        firstName: string | null;
        isQualified: boolean;
        isPremium: boolean;
      };
    }
  }
}

const bearerSession = (header: string) => {
  if (!header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice("Bearer ".length), config.jwtSecret) as { userId: number };
  } catch {
    return null;
  }
};

const parseAndValidateInitData = (rawInitData: string) => {
  const params = new URLSearchParams(rawInitData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new HttpError(403, "Invalid Telegram init data", "invalid_init_data");

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const expectedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(receivedHash, "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new HttpError(403, "Invalid Telegram init data", "invalid_init_data");
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > config.authMaxAgeSeconds) {
    throw new HttpError(403, "Telegram init data expired", "init_data_expired");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new HttpError(403, "Telegram user is missing", "invalid_init_data");
  try {
    return {
      user: JSON.parse(rawUser) as TelegramUser,
      startParam: params.get("start_param")
    };
  } catch {
    throw new HttpError(403, "Telegram user is missing", "invalid_init_data");
  }
};

export const signSession = (userId: number) =>
  jwt.sign({ userId }, config.jwtSecret, { expiresIn: "1h" });

export const readRawInitData = (req: Request) => {
  const header = req.header("authorization") ?? "";
  if (!header.toLowerCase().startsWith("tma ")) return null;
  return header.slice(4);
};

export const upsertTelegramUser = async (rawInitData: string) => {
  const initData = parseAndValidateInitData(rawInitData);
  const tgUser = initData.user as TelegramUser | undefined;
  if (!tgUser?.id) throw new HttpError(403, "Telegram user is missing", "invalid_init_data");

  const result = await pool.query(
    `INSERT INTO users (tg_id, username, first_name, is_premium, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tg_id)
     DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       is_premium = EXCLUDED.is_premium,
       updated_at = NOW()
     RETURNING id, tg_id, username, first_name, is_qualified, is_premium`,
    [String(tgUser.id), tgUser.username ?? null, tgUser.first_name ?? null, Boolean(tgUser.is_premium)]
  );
  const user = mapAuthUser(result.rows[0]);

  const referrerToken = initData.startParam?.match(/^ref_(\d+)$/)?.[1];
  if (referrerToken) {
    const referrer = await pool.query(
      "SELECT id FROM users WHERE (id = $1 OR tg_id = $2) AND id <> $3 LIMIT 1",
      [Number(referrerToken), referrerToken, user.id]
    );
    if (referrer.rowCount) {
      await pool.query(
        `UPDATE users
         SET referrer_id = COALESCE(referrer_id, $1), updated_at = NOW()
         WHERE id = $2 AND referrer_id IS NULL`,
        [Number(referrer.rows[0].id), user.id]
      );
    }
  }
  return user;
};

export const mapAuthUser = (row: Record<string, unknown>) => ({
  id: Number(row.id),
  tgId: String(row.tg_id),
  username: row.username as string | null,
  firstName: row.first_name as string | null,
  isQualified: Boolean(row.is_qualified),
  isPremium: Boolean(row.is_premium)
});

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = req.header("authorization") ?? "";
    const rawInitData = readRawInitData(req);
    if (rawInitData) {
      req.user = await upsertTelegramUser(rawInitData);
      return next();
    }

    const session = bearerSession(auth);
    if (!session) throw new HttpError(403, "Invalid authorization", "forbidden");
    const result = await pool.query(
      "SELECT id, tg_id, username, first_name, is_qualified, is_premium FROM users WHERE id = $1",
      [session.userId]
    );
    if (!result.rowCount) throw new HttpError(403, "Session user not found", "forbidden");
    req.user = mapAuthUser(result.rows[0]);
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(403, "Invalid Telegram init data", "invalid_init_data"));
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !config.adminTgIds.has(req.user.tgId)) {
    return next(new HttpError(403, "Admin access required", "admin_required"));
  }
  next();
};
