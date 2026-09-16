import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";

import dashboardController from "./dashboard.controller.js";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";

import {
  dashboardQuerySchema,
} from "./dashboard.validation.js";

const router = Router();

/**
 * =====================================
 * Admin Dashboard
 * =====================================
 *
 * GET /api/v1/dashboard
 * GET /api/v1/dashboard?period=week
 * GET /api/v1/dashboard?period=month
 * GET /api/v1/dashboard?period=year
 *
 * Authentication required.
 */

router.get(
  "/",
  requireAuth,
  requirePermission("dashboard", "view"),
  validate(dashboardQuerySchema, "query"),
  dashboardController.getDashboard,
);

export default router;