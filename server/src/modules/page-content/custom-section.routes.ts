import { Router } from "express";

import customSectionController from "./custom-section.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import {
  createCustomSectionSchema,
  updateCustomSectionSchema,
} from "./custom-section.validation.js";

// Mounted at /api/v1/sections in routes/index.ts.
//
// Every route needs a "sections" permission, which only the Master role holds
// unless it is granted deliberately in Admin > System > Roles. That is the
// point of it being its own resource rather than part of "content": editing
// the words on a page and changing what the page is made of are different
// levels of trust, and a role can now be given one without the other.
//
// Nothing here is public. The website reads designed sections through
// /page-content/public/:page/layout, which sends the visible ones only.
const router = Router();

router.use(requireAuth);

router.get("/options", requirePermission("sections", "view"), customSectionController.options);

router.get("/page/:page", requirePermission("sections", "view"), customSectionController.list);

router.post(
  "/",
  requirePermission("sections", "create"),
  validate(createCustomSectionSchema),
  customSectionController.create,
);

router.get("/:id", requirePermission("sections", "view"), customSectionController.get);

router.put(
  "/:id",
  requirePermission("sections", "edit"),
  validate(updateCustomSectionSchema),
  customSectionController.update,
);

router.delete("/:id", requirePermission("sections", "delete"), customSectionController.remove);

export default router;
