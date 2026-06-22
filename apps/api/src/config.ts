import "./env.js";

const required = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgres://bands:bands@localhost:5432/bands"),
  databaseSsl: (process.env.DATABASE_SSL ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  botToken: required("BOT_TOKEN"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  adminTgIds: new Set(
    (process.env.ADMIN_TG_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  ),
  webAppUrl: required("WEB_APP_URL", "http://localhost:5173"),
  apiPublicUrl: required("API_PUBLIC_URL", "http://localhost:4000"),
  tonProofDomain: required("TON_PROOF_DOMAIN", "localhost"),
  tonManifestUrl: required("TON_MANIFEST_URL", "http://localhost:5173/tonconnect-manifest.json"),
  authMaxAgeSeconds: Number(process.env.AUTH_MAX_AGE_SECONDS ?? 86400),
  syncCooldownSeconds: Number(process.env.SYNC_COOLDOWN_SECONDS ?? 300),
  allowDevAuth: (process.env.ALLOW_DEV_AUTH ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true",
  useMockGifts: (process.env.USE_MOCK_GIFTS ?? "false") === "true"
};
