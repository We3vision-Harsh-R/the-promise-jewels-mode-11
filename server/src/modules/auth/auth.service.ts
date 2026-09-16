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
import { generateOtp } from "../../utils/otp.js";
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

  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findByEmail(email);

    /**
     * Security:
     * Same response denge chahe email exist kare ya nahi.
     * Email enumeration avoid hota hai.
     */
    if (!user) {
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

  private async verifyUserOtp(email: string, otp: string, purpose: OtpPurpose) {
    const user = await authRepository.findByEmail(email);

    if (!user) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (!user.otpCode || !user.otpExpiresAt || !user.otpPurpose) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (user.otpPurpose !== purpose) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new ApiError(401, AUTH_MESSAGES.OTP_EXPIRED);
    }

    const isOtpValid = await comparePassword(otp, user.otpCode);

    if (!isOtpValid) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    return user;
  }

  async verifyOtp(email: string, otp: string, purpose: OtpPurpose) {
    const user = await this.verifyUserOtp(email, otp, purpose);
    return this.startSession(user);
  }

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const user = await authRepository.findByEmail(email);

    if (!user) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (!user.otpCode || !user.otpExpiresAt || !user.otpPurpose) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (user.otpPurpose !== OtpPurpose.FORGOT_PASSWORD) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new ApiError(401, AUTH_MESSAGES.OTP_EXPIRED);
    }

    const isOtpValid = await comparePassword(otp, user.otpCode);

    if (!isOtpValid) {
      throw new ApiError(401, AUTH_MESSAGES.INVALID_OTP);
    }

    const hashedPassword = await hashPassword(newPassword);

    await authRepository.updatePassword(user.id, hashedPassword);

    await authRepository.clearOtp(user.id);

    await authRepository.clearRefreshToken(user.id);
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
