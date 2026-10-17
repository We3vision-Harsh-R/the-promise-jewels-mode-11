import { Request, Response, Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { uploadTeamPhoto } from "../../middleware/upload.middleware.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

import teamService from "./team.service.js";
import { TEAM_MESSAGES } from "./team.constants.js";
import { createTeamSchema, reorderTeamSchema, updateTeamSchema } from "./team.validation.js";

// ---------------------------------------------------------------------------
// Public -> mounted at /api/v1/team
// What the website's Our Team page reads: the people marked as shown.
// ---------------------------------------------------------------------------
const publicRouter = Router();

publicRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, TEAM_MESSAGES.FETCHED, await teamService.listPublic()));
  }),
);

// ---------------------------------------------------------------------------
// Admin -> mounted at /api/v1/admin/team
// ---------------------------------------------------------------------------
const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get(
  "/",
  requirePermission("team", "view"),
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, TEAM_MESSAGES.FETCHED, await teamService.listAdmin()));
  }),
);

adminRouter.post(
  "/",
  requirePermission("team", "create"),
  uploadTeamPhoto,
  validate(createTeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const member = await teamService.create(req.body, req.file);
    res.status(201).json(new ApiResponse(true, TEAM_MESSAGES.CREATED, member));
  }),
);

// "reorder" is a literal path, so it is declared before the :id routes.
adminRouter.patch(
  "/reorder",
  requirePermission("team", "edit"),
  validate(reorderTeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, TEAM_MESSAGES.REORDERED, await teamService.reorder(req.body.ids)));
  }),
);

adminRouter.put(
  "/:id",
  requirePermission("team", "edit"),
  uploadTeamPhoto,
  validate(updateTeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const member = await teamService.update(req.params.id as string, req.body, req.file);
    res.status(200).json(new ApiResponse(true, TEAM_MESSAGES.UPDATED, member));
  }),
);

adminRouter.patch(
  "/:id/status",
  requirePermission("team", "edit"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, TEAM_MESSAGES.STATUS_UPDATED, await teamService.toggleStatus(req.params.id as string)));
  }),
);

// Administrator-only, like every other delete here: being signed in is not the
// same as being allowed to remove someone from the website.
adminRouter.delete(
  "/:id",
  requirePermission("team", "delete"),
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, TEAM_MESSAGES.DELETED, await teamService.remove(req.params.id as string)));
  }),
);

export { adminRouter as teamAdminRoutes };
export default publicRouter;
