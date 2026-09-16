import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";

import settingsController from "./settings.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { changePasswordSchema, updateSettingsSchema } from "./settings.validation.js";

// This whole module is mounted once at /api/v1/settings in routes/index.ts.
//
// - GET /api/v1/settings/public   -> no auth, used by the public website
//                                     (Footer.jsx). Returns raw DB field
//                                     names (siteName, phone, email, ...).
// - GET  /api/v1/settings         -> admin only, matches settings.service.js
// - PUT  /api/v1/settings         -> admin only, matches settings.service.js
// - PUT  /api/v1/settings/password-> admin only, matches settings.service.js
//
// IMPORTANT: the /public route is registered BEFORE router.use(requireAuth)
// below, so it is the only route on this router that skips auth. Every
// route added after that line requires a valid session.
const router = Router();

router.get("/public", settingsController.getPublic);

router.use(requireAuth);

router.get("/", requirePermission("settings", "view"), settingsController.getAdmin);

// Site-wide settings — the logo, the contact details, the social links every
// page renders. One editor changing them changes the whole site, so writing
// them is an administrator action. (Changing your OWN password below is not:
// that is scoped to the caller.)
router.put(
  "/",
  requirePermission("settings", "edit"),
  requireAdmin,
  validate(updateSettingsSchema),
  settingsController.updateAdmin,
);

router.put(
  "/password",
  validate(changePasswordSchema),
  settingsController.changePassword,
);

export default router;
