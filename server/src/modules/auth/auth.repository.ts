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
