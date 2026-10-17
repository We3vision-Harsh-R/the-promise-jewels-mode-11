import { Request, Response, Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

import { addRule, getOverview, removeRule, saveSettings } from "./admin-network.service.js";

// Mounted at /api/v1/admin/network. Every route is private, and the guard in
// middleware/adminNetwork.middleware.ts already hides /api/v1/admin/* from
// anyone whose address is not on the list.
const router = Router();

router.use(requireAuth);

const ruleSchema = z.object({
  address: z.string().trim().min(3).max(60),
  label: z.string().trim().min(2, "Give it a name so people know whose it is").max(80),
});

const settingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(["report", "enforce"]).optional(),
  })
  .refine((value) => value.enabled !== undefined || value.mode !== undefined, "Nothing to change");

router.get(
  "/",
  requirePermission("adminNetwork", "view"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, "Admin access fetched.", await getOverview(req.ip)));
  }),
);

router.post(
  "/rules",
  requirePermission("adminNetwork", "create"),
  validate(ruleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(new ApiResponse(true, "Address added.", await addRule(req.body, req.user!.id)));
  }),
);

router.delete(
  "/rules/:id",
  requirePermission("adminNetwork", "delete"),
  asyncHandler(async (req: Request, res: Response) => {
    res
      .status(200)
      .json(new ApiResponse(true, "Address removed.", await removeRule(req.params.id as string, req.user!.id, req.ip)));
  }),
);

router.put(
  "/settings",
  requirePermission("adminNetwork", "edit"),
  validate(settingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res
      .status(200)
      .json(new ApiResponse(true, "Admin access updated.", await saveSettings(req.body, req.user!.id, req.ip)));
  }),
);

export default router;
