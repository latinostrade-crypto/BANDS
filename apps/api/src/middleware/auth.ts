import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { parse, validate } from "@tma.js/init-data-node";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { HttpError } from "./error.js";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
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

export const signSession = (userId: number) =>
  jwt.sign({ userId }, config.jwtSecret, { expiresIn: "7d" });

export const readRawInitData = (req: Request) => {
  const header = req.header("authorization") ?? "";
  if (!header.toLowerCase().startsWith("tma ")) return null;
  return header.slice(4);
};

export const upsertTelegramUser = async (rawInitData: string) => {
  validate(rawInitData, config.botToken, { expiresIn: config.authMaxAgeSeconds });
  const initData = parse(rawInitData);
  const tgUser = initData.user as TelegramUser | undefined;
  if (!tgUser?.id) throw new HttpError(403, "Telegram user is missing", "invalid_init_data");

  const result = await pool.query(
    `INSERT INTO users (tg_id, username, first_name, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tg_id)
     DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, updated_at = NOW()
     RETURNING id, tg_id, username, first_name, is_qualified`,
    [String(tgUser.id), tgUser.username ?? null, tgUser.first_name ?? null]
  );
  return mapAuthUser(result.rows[0]);
};

export const mapAuthUser = (row: Record<string, unknown>) => ({
  id: Number(row.id),
  tgId: String(row.tg_id),
  username: row.username as string | null,
  firstName: row.first_name as string | null,
  isQualified: Boolean(row.is_qualified)
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
      "SELECT id, tg_id, username, first_name, is_qualified FROM users WHERE id = $1",
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
