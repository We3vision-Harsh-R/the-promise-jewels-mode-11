import fs from "node:fs";
import { prisma } from "../../database/prisma.js";
import { SETTINGS_ID } from "../settings/settings.constants.js";
import { clearOtpPolicyCache, isOtpRequired } from "./otp-policy.js";

/**
 * Proves the Settings toggle actually changes what signing in requires.
 *
 * Hits the real /auth/login over HTTP, because the thing being tested is the
 * whole path: setting -> policy -> service -> controller -> cookies. Needs the
 * dev server running. Restores the setting to OFF when it finishes, whatever
 * happens.
 */

const BASE = `http://localhost:${process.env.PORT ?? 2000}/api/v1`;
const CACHE_TTL_MS = 10_000;

const seed = fs.readFileSync("server/prisma/seed.ts", "utf8");
const password = seed.match(/bcrypt\.hash\(\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "";
const email = seed.match(/email:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "";

let failures = 0;
const check = (label: string, pass: boolean, detail = "") => {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const cookies = res.headers.getSetCookie?.() ?? [];
  return {
    status: res.status,
    otpRequired: body?.data?.otpRequired,
    gotUser: Boolean(body?.data?.user),
    cookies: cookies.filter((c) => /accessToken|refreshToken/.test(c)).length,
  };
}

// The policy is cached inside the SERVER process; clearing it here clears only
// this script's copy, so each switch waits the cache out.
const settle = () => new Promise((r) => setTimeout(r, CACHE_TTL_MS + 700));

const set = async (value: boolean) => {
  await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data: { otpRequired: value },
  });
  clearOtpPolicyCache();
  await settle();
};

const health = await fetch(`http://localhost:${process.env.PORT ?? 2000}/api/health`).catch(() => null);
if (!health?.ok) {
  console.log("Dev server is not answering — start it and re-run.");
  process.exit(2);
}

const before = await prisma.settings.findUnique({
  where: { id: SETTINGS_ID },
  select: { otpRequired: true },
});

try {
  console.log("\nWith the code OFF — the password is the whole check");
  await set(false);
  let out = await login();
  check("login returns 200", out.status === 200);
  check("reported as not required", out.otpRequired === false);
  check("a user came back", out.gotUser === true);
  check("both session cookies set", out.cookies === 2, `(${out.cookies})`);

  console.log("\nWith the code ON — a second step is required");
  await set(true);
  out = await login();
  check("login returns 200", out.status === 200);
  check("reported as required", out.otpRequired === true);
  check("no user yet", out.gotUser === false);
  check("no session cookies yet", out.cookies === 0, `(${out.cookies})`);
} finally {
  await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data: { otpRequired: before?.otpRequired ?? false },
  });
  clearOtpPolicyCache();
  console.log(`\nRestored to: otpRequired = ${await isOtpRequired()}`);
}

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
