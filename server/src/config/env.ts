import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  PORT: Number(process.env.PORT ?? 5000),

  DATABASE_URL: required("DATABASE_URL"),

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),

  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),

  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",

  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",

  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",

  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),

  SMTP_HOST: process.env.SMTP_HOST,

  SMTP_PORT: Number(process.env.SMTP_PORT ?? 465),

  SMTP_USER: process.env.SMTP_USER,

  SMTP_PASS: process.env.SMTP_PASS,

  MAIL_FROM:
    process.env.MAIL_FROM ?? "Promise Jewels <thepromisejewels@gmail.com>",

  OTP_EXPIRY_MINUTES: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),

  // Supabase is used for file storage only — Postgres is reached through
  // Prisma on DATABASE_URL, and the browser never talks to Supabase directly
  // (every read and write goes through this API), so there is no publishable
  // key here and no client-side Supabase client anywhere in src/.
  SUPABASE_URL: required("SUPABASE_URL"),

  // Server-side only: it bypasses row-level security, so it must never reach
  // the browser bundle. Anything prefixed VITE_ does reach it — keep it out.
  //
  // This is the `sb_secret_...` key from Supabase > API Keys. It replaced the
  // legacy `service_role` JWT, which Supabase is phasing out.
  SUPABASE_SECRET_KEY: required("SUPABASE_SECRET_KEY"),

  SITE_NAME: required("SITE_NAME"),

  SITE_URL: required("SITE_URL"),

  //seo

  DEFAULT_OG_IMAGE: process.env.DEFAULT_OG_IMAGE ?? "/images/default-og.png",
};

/**
 * Boot-time configuration checks.
 *
 * `required()` above only proves a variable is non-empty. These prove the
 * values are usable. They run at import time — before app.ts assembles the
 * middleware chain and before the port is bound — so a misconfigured server
 * never reaches the point of accepting a request.
 *
 * A server that starts with a guessable secret is worse than one that refuses
 * to start, because nobody finds out until afterwards.
 *
 * Production only. Local development runs on short throwaway secrets on
 * purpose, and failing the boot there would only teach people to weaken the
 * check until it stopped meaning anything.
 */
function assertProductionConfig(): void {
  if (env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  // 32 characters is the floor for an HS256 secret: the HMAC key should carry
  // at least as much entropy as the 256-bit digest it produces.
  if (env.JWT_ACCESS_SECRET.length < 32) {
    problems.push("JWT_ACCESS_SECRET is under 32 characters");
  }

  if (env.JWT_REFRESH_SECRET.length < 32) {
    problems.push("JWT_REFRESH_SECRET is under 32 characters");
  }

  // With one key for both, an access token and a refresh token are separated
  // only by their `aud` claim. That claim IS checked (utils/jwt.ts), so this
  // is defence in depth rather than a live hole — but two secrets exist
  // precisely so that leaking one does not surrender the other.
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical");
  }

  // Below 10 rounds bcrypt stops being meaningfully slower than a plain hash,
  // and that slowness is the only thing protecting a stolen password column.
  if (!Number.isFinite(env.BCRYPT_SALT_ROUNDS) || env.BCRYPT_SALT_ROUNDS < 10) {
    problems.push("BCRYPT_SALT_ROUNDS is below 10");
  }

  // The two encryption keys.
  //
  // Checked at BOOT in production, not lazily at first use, because the
  // failure mode of a missing key is silent until somebody opens the vault or
  // submits an enquiry — and by then the deploy looks successful. A 32-byte
  // key is what AES-256 takes; anything else is a typo or a truncated paste.
  //
  // They must also differ. One protects the owner's own passwords and the
  // other customers' contact details; reusing one key for both means a single
  // leak is both, and nothing in the code would ever object.
  const keys: Array<[string, string | undefined]> = [
    ["NOTES_ENCRYPTION_KEY", process.env.NOTES_ENCRYPTION_KEY],
    ["DATA_ENCRYPTION_KEY", process.env.DATA_ENCRYPTION_KEY],
  ];

  for (const [name, value] of keys) {
    if (!value) {
      problems.push(`${name} is not set`);
    } else if (Buffer.from(value, "base64").length !== 32) {
      problems.push(`${name} is not 32 bytes of base64`);
    }
  }

  if (
    process.env.NOTES_ENCRYPTION_KEY &&
    process.env.NOTES_ENCRYPTION_KEY === process.env.DATA_ENCRYPTION_KEY
  ) {
    problems.push("NOTES_ENCRYPTION_KEY and DATA_ENCRYPTION_KEY are identical");
  }

  if (problems.length > 0) {
    // Names only, never values — this message reaches the logs.
    throw new Error(
      "Refusing to start in production with an unsafe configuration:\n" +
        problems.map((problem) => `  - ${problem}`).join("\n"),
    );
  }
}

assertProductionConfig();
