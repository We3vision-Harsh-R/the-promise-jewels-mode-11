import { Request, Response } from "express";
import authService from "./auth.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { AUTH_MESSAGES } from "./auth.constants.js";
import { OtpPurpose } from "@prisma/client";
import {
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
} from "../../config/cookies.js";
import { ApiError } from "../../utils/ApiError.js";
class AuthController {
  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    // Two shapes, because there are two ways in. With the emailed code
    // switched on this is only step one and there is no session yet; with it
    // off the password WAS the whole check and the cookies are set here.
    // The otpRequired flag tells the browser which of the two just happened,
    // so it never has to guess from the presence of a user object.
    if (result.otpRequired) {
      res.status(200).json(
        new ApiResponse(true, AUTH_MESSAGES.OTP_SENT, { otpRequired: true }),
      );
      return;
    }

    res
      .cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS)
      .cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS)
      .status(200)
      .json(
        new ApiResponse(true, AUTH_MESSAGES.LOGIN_SUCCESS, {
          otpRequired: false,
          user: result.user,
        }),
      );
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    await authService.forgotPassword(email);

    res.status(200).json(new ApiResponse(true, AUTH_MESSAGES.OTP_SENT, null));
  });

  verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;

    const result = await authService.verifyOtp(email, otp, OtpPurpose.LOGIN);
    res
      .cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS)

      .cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS)
      .status(200)
      .json(
        new ApiResponse(true, AUTH_MESSAGES.LOGIN_SUCCESS, {
          user: result.user,
        }),
      );
  });

  resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;

    await authService.resetPassword(email, otp, newPassword);

    res
      .status(200)
      .json(new ApiResponse(true, AUTH_MESSAGES.PASSWORD_RESET_SUCCESS, null));
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.id);

    res
      .status(200)
      .json(new ApiResponse(true, "Current user fetched successfully.", user));
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new ApiError(401, AUTH_MESSAGES.UNAUTHORIZED);
    }

    const tokens = await authService.refresh(refreshToken);

    res
      .cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS)
      .cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS)
      .status(200)
      .json(new ApiResponse(true, AUTH_MESSAGES.TOKEN_REFRESHED, null));
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.user!.id);

    res
      .clearCookie("accessToken", CLEAR_COOKIE_OPTIONS)
      .clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS)
      .status(200)
      .json(new ApiResponse(true, AUTH_MESSAGES.LOGOUT_SUCCESS, null));
  });
}

export default new AuthController();
