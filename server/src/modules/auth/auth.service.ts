import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { ApiError } from "../../utils/ApiError.js";
import { AUTH_MESSAGES } from "./auth.constants.js";
import { OtpPurpose, User } from "@prisma/client";
import authRepository from "./auth.repository.js";
import mailService from "../mail/mail.service.js";
import { env } from "../../config/env.js";
import {
  hashPassword,
  hashValue,
  comparePassword,
} from "../../utils/password.js";
// Refresh tokens are hashed with SHA-256, NOT bcrypt. bcrypt truncates its
// input at 72 bytes, and a refresh JWT's first 72 bytes are the fixed header
// plus the opening of the userId — byte-identical for every token ever issued
// to that user. Verified against this project's own bcryptjs: hashing one
// refresh token and comparing a DIFFERENT one for the same user returns true.
// The stored hash therefore identified a user, not a session — rotation on
// /refresh evicted nothing and a stolen token stayed usable for its full seven
// days. OTPs and passwords keep bcrypt; they are short and low-entropy, which
// is what bcrypt is for. See utils/tokenHash.ts.
import { hashToken, tokenMatches } from "../../utils/tokenHash.js";
import { generateOtp, MAX_OTP_ATTEMPTS } from "../../utils/otp.js";
import { randomBytes } from "node:crypto";
import { isOtpRequired } from "./otp-policy.js";
import { logger } from "../../utils/logger.js";

/** What login returns: either "we sent a code" or a finished session. */
export type LoginResult =
  | { otpRequired: true }
  | {
      otpRequired: false;
      user: { id: string; name: string; email: string };
      accessToken: string;
      refreshToken: string;
    };

/** How long a person must wait before another reset code is sent to them. */
const RESEND_COOLDOWN_MS = 60_000;

/** How long the reset session lasts once the emailed code has been accepted. */
const RESET_SESSION_MINUTES = 10;

/** Marks the stored value as a reset session, never as an emailed code. */
const RESET_PREFIX = "reset:";

// What a failed check costs when the account does not exist, so a missing
// account takes about as long to refuse as a real one with a wrong code.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.3q6m4oS0bX1x0m3lXn3o1m7Yb1Wy";

class AuthService {
  async login(email: string, password: string): Promise<LoginResult> {

    const user = await authRepository.findByEmail(email);
    
    if (!user) {
      
      throw new ApiError(401, AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      
      throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_DISABLED);
    }

    
    const isPasswordValid = await comparePassword(password, user.password);
    

    if (!isPasswordValid) {
      
      throw new ApiError(401, AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    
    // The password has been checked either way. What the setting decides is
    // whether a second step follows it — see otp-policy.ts for why the
    // default is off.
    if (await isOtpRequired()) {
      await this.issueOtp(user, OtpPurpose.LOGIN);
      return { otpRequired: true };
    }

    return { otpRequired: false, ...(await this.startSession(user)) };
  }

  /**
   * Issues the pair of tokens and records the sign-in.
   *
   * Shared by the two ways in — straight from login when the code is off, and
   * from verifyOtp when it is on — so a session is created identically
   * whichever route got there.
   */
  private async startSession(user: Pick<User, "id" | "name" | "email">) {
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    await authRepository.updateLoginSuccess(user.id, hashToken(refreshToken));

    return {
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Starts a password reset.
   *
   * The answer is the same whether or not the address belongs to an account —
   * a different answer would let anyone test which emails are registered — so
   * this returns nothing and the caller always sends the same message. The work
   * done for an unknown address is made to cost about the same as for a real
   * one, so the time taken does not give it away either.
   *
   * A code is not re-sent within RESEND_COOLDOWN_MS of the last one, which
   * stops a single address from being used to flood an inbox; the per-address
   * rate limit on the route stops one visitor from doing it to many.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findByEmail(email);

    if (!user || !user.isActive) {
      await hashValue(generateOtp());
      return;
    }

    if (
      user.otpPurpose === OtpPurpose.FORGOT_PASSWORD &&
      user.otpExpiresAt &&
      user.otpExpiresAt.getTime() - env.OTP_EXPIRY_MINUTES * 60_000 > Date.now() - RESEND_COOLDOWN_MS
    ) {
      return;
    }

    await this.issueOtp(user, OtpPurpose.FORGOT_PASSWORD);
  }

  private async issueOtp(
    user: Pick<User, "id" | "email">,
    purpose: OtpPurpose,
  ): Promise<void> {
    const otp = generateOtp();

    
    const hashedOtp = await hashValue(otp);
  

    const expiry = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
    
    await authRepository.updateOtp(user.id, hashedOtp, expiry, purpose);

    void mailService
      .sendOtp({
        to: user.email,
        otp,
        purpose: purpose === OtpPurpose.LOGIN ? "LOGIN" : "FORGOT_PASSWORD",
      })
      .catch((error) => {
        logger.error(
          {
            error,
            email: user.email,
            purpose,
          },
          "Failed to send OTP email",
        );
      });
  }

  /**
   * Counts a wrong guess. After MAX_OTP_ATTEMPTS the code is thrown away, so a
   * six-digit code cannot be brute-forced however many addresses the guesses
   * come from; the person asks for a new one.
   */
  private async failOtp(userId: string): Promise<never> {
    const attempts = await authRepository.incrementOtpAttempts(userId);

    if (attempts >= MAX_OTP_ATTEMPTS) {
      await authRepository.clearOtp(userId);
      throw new ApiError(429, AUTH_MESSAGES.OTP_TOO_MANY_ATTEMPTS);
    }

    throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
  }

  private async verifyUserOtp(email: string, otp: string, purpose: OtpPurpose) {
    const user = await authRepository.findByEmail(email);

    if (!user) {
      await comparePassword(otp, DUMMY_HASH);
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (
      !user.otpCode ||
      !user.otpExpiresAt ||
      !user.otpPurpose ||
      user.otpPurpose !== purpose ||
      user.otpCode.startsWith(RESET_PREFIX)
    ) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      await authRepository.clearOtp(user.id);
      throw new ApiError(401, AUTH_MESSAGES.OTP_EXPIRED);
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      await authRepository.clearOtp(user.id);
      throw new ApiError(429, AUTH_MESSAGES.OTP_TOO_MANY_ATTEMPTS);
    }

    const isOtpValid = await comparePassword(otp, user.otpCode);

    if (!isOtpValid) {
      return this.failOtp(user.id);
    }

    return user;
  }

  async verifyOtp(email: string, otp: string, purpose: OtpPurpose) {
    const user = await this.verifyUserOtp(email, otp, purpose);
    return this.startSession(user);
  }

  /**
   * Step 2 of a password reset: checks the emailed code ON THE SERVER.
   *
   * On success the code is used up in the same write that opens a reset session
   * — a random token whose hash is stored on the account, valid for
   * RESET_SESSION_MINUTES — and the token is returned. Nothing else in the
   * reset can be done without it, and the code cannot be used a second time.
   */
  async verifyResetOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const user = await this.verifyUserOtp(email, otp, OtpPurpose.FORGOT_PASSWORD);

    const resetToken = randomBytes(32).toString("base64url");

    await authRepository.startResetSession(
      user.id,
      RESET_PREFIX + hashToken(resetToken),
      new Date(Date.now() + RESET_SESSION_MINUTES * 60_000),
    );

    return { resetToken };
  }

  /**
   * Step 3: sets the new password, and only for a valid reset session.
   *
   * The token must belong to THIS account (it is looked up by the email it was
   * issued for), be unexpired and match its stored hash. A wrong token counts
   * as a failed attempt; after MAX_OTP_ATTEMPTS the session is destroyed.
   * Success writes the password, destroys the session and signs out every
   * existing session in one update.
   */
  async resetPassword(
    email: string,
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    const user = await authRepository.findByEmail(email);

    if (!user) {
      await comparePassword(newPassword, DUMMY_HASH);
      throw new ApiError(401, AUTH_MESSAGES.RESET_SESSION_INVALID);
    }

    if (
      !user.otpCode ||
      !user.otpExpiresAt ||
      user.otpPurpose !== OtpPurpose.FORGOT_PASSWORD ||
      !user.otpCode.startsWith(RESET_PREFIX)
    ) {
      throw new ApiError(401, AUTH_MESSAGES.RESET_SESSION_INVALID);
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      await authRepository.clearOtp(user.id);
      throw new ApiError(401, AUTH_MESSAGES.RESET_SESSION_INVALID);
    }

    if (!tokenMatches(resetToken, user.otpCode.slice(RESET_PREFIX.length))) {
      const attempts = await authRepository.incrementOtpAttempts(user.id);
      if (attempts >= MAX_OTP_ATTEMPTS) await authRepository.clearOtp(user.id);
      throw new ApiError(401, AUTH_MESSAGES.RESET_SESSION_INVALID);
    }

    await authRepository.finishPasswordReset(user.id, await hashPassword(newPassword));
  }

  async me(userId: string) {
    const user = await authRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, AUTH_MESSAGES.USER_NOT_FOUND);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async refresh(refreshToken: string) {
    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, AUTH_MESSAGES.UNAUTHORIZED);
    }

    const user = await authRepository.findById(payload.userId);

    if (!user || !user.isActive) {
      throw new ApiError(401, AUTH_MESSAGES.UNAUTHORIZED);
    }

    if (!user.refreshTokenHash) {
      throw new ApiError(401, AUTH_MESSAGES.UNAUTHORIZED);
    }

    const isValid = tokenMatches(refreshToken, user.refreshTokenHash);

    if (!isValid) {
      throw new ApiError(401, AUTH_MESSAGES.UNAUTHORIZED);
    }

    const newAccessToken = generateAccessToken(user.id);

    const newRefreshToken = generateRefreshToken(user.id);

    const hashedRefreshToken = hashToken(newRefreshToken);

    await authRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string): Promise<void> {
    await authRepository.clearRefreshToken(userId);
  }
}

export default new AuthService();
