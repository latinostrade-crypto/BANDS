import "./env.js";

const required = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const isProduction = process.env.NODE_ENV === "production";

const requiredSecret = (name: string, fallback?: string) => {
  const value = required(name, isProduction ? undefined : fallback);
  if (isProduction && value.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production`);
  }
  return value;
};

const productionSafeBoolean = (name: string, fallback: string) => {
  const enabled = (process.env[name] ?? fallback) === "true";
  if (isProduction && enabled) throw new Error(`${name} must be false in production`);
  return enabled;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgres://bands:bands@localhost:5432/bands"),
  databaseSsl: (process.env.DATABASE_SSL ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  databaseSslRejectUnauthorized: (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? "true") === "true",
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  botToken: required("BOT_TOKEN"),
  jwtSecret: requiredSecret("JWT_SECRET", "dev-secret-change-me"),
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
  allowDevAuth: productionSafeBoolean("ALLOW_DEV_AUTH", isProduction ? "false" : "true"),
  useMockGifts: productionSafeBoolean("USE_MOCK_GIFTS", "false")
};
