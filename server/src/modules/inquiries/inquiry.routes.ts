import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";
import { contactLimiter } from "../../config/rateLimit.js";

import inquiryController from "./inquiry.controller.js";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";

import {
  createInquirySchema,
  inquiryIdSchema,
  inquiryQuerySchema,
  updateInquirySchema,
} from "./inquiry.validation.js";

const router = Router();

/**
 * =====================================
 * Public Routes
 * =====================================
 */

// POST /api/v1/inquiries/contact
router.post(
  "/contact",
  contactLimiter,
  validate(createInquirySchema),
  inquiryController.createInquiry,
);

/**
 * =====================================
 * Admin Routes
 * =====================================
 */

router.use(requireAuth);

// GET /api/v1/inquiries
router.get(
  "/",
  requirePermission("inquiries", "view"),
  validate(inquiryQuerySchema, "query"),
  inquiryController.listInquiries,
);

// GET /api/v1/inquiries/export
router.get(
  "/export",
  requirePermission("inquiries", "view"),
  validate(inquiryQuerySchema, "query"),
  inquiryController.exportInquiries,
);

// GET /api/v1/inquiries/:id
router.get(
  "/:id",
  requirePermission("inquiries", "view"),
  validate(inquiryIdSchema, "params"),
  inquiryController.getInquiryById,
);

// PATCH /api/v1/inquiries/:id/status
router.patch(
  "/:id/status",
  requirePermission("inquiries", "edit"),
  validate(inquiryIdSchema, "params"),
  validate(updateInquirySchema),
  inquiryController.updateInquiryStatus,
);

// DELETE /api/v1/inquiries/:id
router.delete(
  "/:id",
  requirePermission("inquiries", "delete"), requireAdmin,
  validate(inquiryIdSchema, "params"),
  inquiryController.deleteInquiry,
);

export default router;