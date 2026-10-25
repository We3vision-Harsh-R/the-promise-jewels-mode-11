import { Router } from "express";

import authController from "./auth.controller.js";
import { validate } from "../../middleware/validation.middleware.js";
import { forgotPasswordSchema, loginSchema, verifyOtpSchema, verifyResetOtpSchema, resetPasswordSchema } from "./auth.validation.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authLimiter, otpRequestLimiter } from "../../config/rateLimit.js";
const router = Router();

router.post("/login", authLimiter, validate(loginSchema), authController.login);

router.post(
  "/forgot-password",
  otpRequestLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), authController.verifyOtp);

// Checks the emailed code on the server and hands back the reset token. The
// New Password step cannot be reached without it.
router.post(
  "/verify-reset-otp",
  authLimiter,
  validate(verifyResetOtpSchema),
  authController.verifyResetOtp,
);

router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

router.get("/me", authenticate, authController.me);

// Who is signed in AND what they may do, in one request. The panel used to ask
// /auth/me and /rbac/me separately, each paying for its own sign-in check and
// its own trips to a database that is a network hop away.
router.get("/session", authenticate, authController.session);

router.post("/refresh", authController.refresh);

router.post("/logout", authenticate, authController.logout);

export default router;
