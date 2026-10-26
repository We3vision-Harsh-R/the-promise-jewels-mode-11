import { Request, Response, Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { clearPublicCache, getContentVersion } from "../../middleware/publicCache.middleware.js";
import { clearDashboardCache } from "../dashboard/dashboard.service.js";
import { clearOtpPolicyCache } from "../auth/otp-policy.js";
import { clearPermissionCache } from "../rbac/rbac.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Admin > Settings > "Clear website cache".
 *
 * Saving in the panel already empties the website's cache on its own; this is
 * the button for when something looks stale anyway. It empties every cache the
 * server keeps (the public pages, the dashboard numbers, the sign-in policy and
 * the permission lookups) and bumps the content version, which every open page
 * of the website notices within seconds and reloads its data without a refresh.
 */
const router = Router();

router.use(requireAuth);

router.post(
  "/clear",
  requirePermission("settings", "edit"),
  asyncHandler(async (_req: Request, res: Response) => {
    clearPublicCache();
    clearDashboardCache();
    clearOtpPolicyCache();
    clearPermissionCache();

    res
      .status(200)
      .json(new ApiResponse(true, "Website cache cleared.", { version: getContentVersion() }));
  }),
);

export default router;
