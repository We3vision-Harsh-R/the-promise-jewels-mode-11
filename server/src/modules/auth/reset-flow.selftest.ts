import "dotenv/config";
import { randomBytes } from "node:crypto";

import { prisma } from "../../database/prisma.js";
import authService from "./auth.service.js";
import mailService from "../mail/mail.service.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { forgotPasswordSchema, resetPasswordSchema, verifyResetOtpSchema } from "./auth.validation.js";

/**
 * Runs the whole forgot-password flow against the real service and database,
 * with a throwaway account and the mail sender replaced by a recorder (nothing
 * is emailed). Run with `npm run auth:reset:check`; exits non-zero on any
 * failure, and removes its account either way.
 */

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   ${detail}` : ""}`);
  if (!ok) failed += 1;
};

async function status(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
    return 200;
  } catch (error) {
    return (error as { statusCode?: number; status?: number }).statusCode ?? (error as { status?: number }).status ?? 500;
  }
}

const sent: Array<{ to: string; otp: string }> = [];
(mailService as unknown as { sendOtp: (args: { to: string; otp: string }) => Promise<void> }).sendOtp = async (args) => {
  sent.push({ to: args.to, otp: args.otp });
};

const email = `reset-check-${randomBytes(4).toString("hex")}@example.test`;
const OLD = "OldPassw0rd!";
const NEW = "NewPassw0rd!";

async function userRow() {
  return prisma.user.findUnique({ where: { email } });
}

async function newCode(): Promise<string> {
  const before = sent.length;
  // The resend cooldown would (rightly) swallow a second request.
  await prisma.user.update({ where: { email }, data: { otpExpiresAt: null, otpPurpose: null, otpCode: null } });
  await authService.forgotPassword(email);
  await new Promise((resolve) => setTimeout(resolve, 50));
  return sent.length > before ? sent[sent.length - 1].otp : "";
}

async function main() {
  console.log("\nPassword reset flow\n");

  await prisma.user.create({
    data: { name: "Reset check", email, password: await hashPassword(OLD), isActive: true },
  });

  try {
    console.log("Request");
    const ghost = `nobody-${randomBytes(4).toString("hex")}@example.test`;
    const t0 = Date.now();
    check("an unregistered address gets the same quiet success", (await status(() => authService.forgotPassword(ghost))) === 200);
    const ghostMs = Date.now() - t0;
    check("…and no code is sent to it", !sent.some((m) => m.to === ghost));
    check("a malformed address is refused by validation", !forgotPasswordSchema.safeParse({ email: "not-an-email" }).success);

    const t1 = Date.now();
    await authService.forgotPassword(email);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const realMs = Date.now() - t1;
    check("a registered address is sent a code", sent.filter((m) => m.to === email).length === 1);
    check("the answer takes about as long for an unknown address", Math.abs(realMs - ghostMs) < 1500, `${ghostMs}ms vs ${realMs}ms`);

    await authService.forgotPassword(email);
    await new Promise((resolve) => setTimeout(resolve, 50));
    check("a second request inside the cooldown sends nothing more", sent.filter((m) => m.to === email).length === 1);

    console.log("\nVerify the code");
    let code = sent.filter((m) => m.to === email)[0].otp;
    const wrong = code === "123456" ? "654321" : "123456";

    check("a code of the wrong length never reaches the server", !verifyResetOtpSchema.safeParse({ email, otp: "123" }).success);
    check("a non-numeric code is refused by validation", !verifyResetOtpSchema.safeParse({ email, otp: "12ab56" }).success);
    check("a wrong six-digit code is rejected", (await status(() => authService.verifyResetOtp(email, wrong))) === 401);
    check("an unknown account is rejected the same way", (await status(() => authService.verifyResetOtp(ghost, wrong))) === 401);
    check("the failed guess was counted", (await userRow())?.otpAttempts === 1);

    check(
      "the New Password step refuses the emailed code as a token",
      (await status(() => authService.resetPassword(email, code, NEW))) === 401,
    );
    check("…and refuses an invented token", (await status(() => authService.resetPassword(email, randomBytes(32).toString("base64url"), NEW))) === 401);
    check("…and the password is untouched", await comparePassword(OLD, (await userRow())!.password));

    const { resetToken } = await authService.verifyResetOtp(email, code);
    check("the correct code is accepted and returns a reset token", /^[A-Za-z0-9_-]{43}$/.test(resetToken));
    check("the code is used up (not reusable)", (await status(() => authService.verifyResetOtp(email, code))) === 401);

    console.log("\nSet the password");
    check("a weak password is refused by validation", !resetPasswordSchema.safeParse({ email, resetToken, newPassword: "12345678" }).success);
    check("a short password is refused by validation", !resetPasswordSchema.safeParse({ email, resetToken, newPassword: "ab1" }).success);
    check("a malformed token is refused by validation", !resetPasswordSchema.safeParse({ email, resetToken: "short", newPassword: NEW }).success);
    check("another account's address cannot use this token", (await status(() => authService.resetPassword(ghost, resetToken, NEW))) === 401);
    check("a wrong token is rejected", (await status(() => authService.resetPassword(email, randomBytes(32).toString("base64url"), NEW))) === 401);

    await prisma.user.update({ where: { email }, data: { refreshTokenHash: "some-existing-session" } });
    check("the right token sets the new password", (await status(() => authService.resetPassword(email, resetToken, NEW))) === 200);

    const after = (await userRow())!;
    check("the new password is stored hashed and works", after.password !== NEW && (await comparePassword(NEW, after.password)));
    check("the old password no longer works", !(await comparePassword(OLD, after.password)));
    check("the code and reset session are gone", !after.otpCode && !after.otpExpiresAt && !after.otpPurpose && after.otpAttempts === 0);
    check("every existing session was signed out", after.refreshTokenHash === null);
    check("the token cannot be used a second time", (await status(() => authService.resetPassword(email, resetToken, "Another1Pass"))) === 401);

    console.log("\nExpiry and attempts");
    code = await newCode();
    await prisma.user.update({ where: { email }, data: { otpExpiresAt: new Date(Date.now() - 1000) } });
    check("an expired code is rejected", (await status(() => authService.verifyResetOtp(email, code))) === 401);

    code = await newCode();
    const bad = code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 4; i += 1) await status(() => authService.verifyResetOtp(email, bad));
    check("the fifth wrong guess locks the code (429)", (await status(() => authService.verifyResetOtp(email, bad))) === 429);
    check("…and then even the correct code no longer works", (await status(() => authService.verifyResetOtp(email, code))) === 401);

    code = await newCode();
    const session = await authService.verifyResetOtp(email, code);
    await prisma.user.update({ where: { email }, data: { otpExpiresAt: new Date(Date.now() - 1000) } });
    check("an expired reset session is rejected", (await status(() => authService.resetPassword(email, session.resetToken, NEW))) === 401);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }

  console.log(failed === 0 ? "\nALL PASSED\n" : `\n${failed} FAILED\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  process.exit(1);
});
