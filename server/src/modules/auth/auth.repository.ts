import { prisma } from "../../database/prisma.js";
import { OtpPurpose } from "@prisma/client";
class AuthRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        password: true,
        refreshTokenHash: true,
        lastLoginAt: true,
      },
    });
  }

  async updateRefreshToken(id: string, refreshTokenHash: string | null) {
    return prisma.user.update({
      where: {
        id,
      },
      data: {
        refreshTokenHash,
      },
    });
  }

  async updateLastLogin(id: string) {
    return prisma.user.update({
      where: {
        id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async updateOtp(
    userId: string,
    otpCode: string,
    otpExpiresAt: Date,
    otpPurpose: OtpPurpose,
  ) {
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        otpCode,
        otpExpiresAt,
        otpPurpose,
        // A fresh code starts with a fresh allowance of guesses.
        otpAttempts: 0,
      },
    });
  }

  /** One more wrong guess. Returns the new count. */
  async incrementOtpAttempts(userId: string): Promise<number> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { otpAttempts: { increment: 1 } },
      select: { otpAttempts: true },
    });
    return user.otpAttempts;
  }

  /**
   * Swaps the emailed code for the reset session in ONE write: the code stops
   * existing the instant it is accepted, so it cannot be used twice.
   */
  async startResetSession(userId: string, tokenRecord: string, expiresAt: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: tokenRecord,
        otpExpiresAt: expiresAt,
        otpPurpose: OtpPurpose.FORGOT_PASSWORD,
        otpAttempts: 0,
      },
    });
  }

  /** New password, and every trace of the reset and of old sessions, in one write. */
  async finishPasswordReset(userId: string, password: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        password,
        otpCode: null,
        otpExpiresAt: null,
        otpPurpose: null,
        otpAttempts: 0,
        refreshTokenHash: null,
      },
    });
  }

  async clearOtp(userId: string) {
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        otpPurpose: null,
        otpAttempts: 0,
      },
    });
  }

  async updatePassword(userId: string, password: string) {
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password,
      },
    });
  }

  async updateLoginSuccess(userId: string, refreshTokenHash: string) {
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash,
        lastLoginAt: new Date(),

        otpCode: null,
        otpExpiresAt: null,
        otpPurpose: null,
        otpAttempts: 0,
      },
    });
  }

  async clearRefreshToken(userId: string) {
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash: null,
      },
    });
  }
}

export default new AuthRepository();
