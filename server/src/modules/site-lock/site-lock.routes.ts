import { NextFunction, Request, Response, Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import siteLock from "./site-lock.service.js";

/**
 * While the Editor is locked nothing it controls can be changed.
 *
 * Mounted ahead of the page-content, sections and settings routes. Reads pass;
 * a write is refused with 423 (Locked) until the Editor is unlocked. Only the
 * site settings save is blocked — changing your own password is not an edit of
 * the website.
 */
export function blockWhenLocked(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (!siteLock.isLocked()) return next();

  // /settings: only the site-wide save (PUT /settings) is content.
  if (req.baseUrl.endsWith("/settings") && !(req.method === "PUT" && req.path === "/")) return next();

  next(new ApiError(423, "The editor is locked. Unlock it to make changes."));
}

/** Admin: status, lock, unlock. Mounted at /api/v1/admin/site-lock. */
const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission("content", "view"),
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, "Lock status loaded", await siteLock.status()));
  }),
);

router.post(
  "/lock",
  requirePermission("content", "edit"),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await siteLock.lock(req.user?.name || req.user?.email || "Admin");
    res.status(200).json(new ApiResponse(true, "Editor locked.", status));
  }),
);

router.post(
  "/unlock",
  requirePermission("content", "edit"),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await siteLock.unlock();
    res.status(200).json(new ApiResponse(true, "Editor unlocked.", status));
  }),
);

export default router;

/**
 * Public: the frozen content, or `{ locked: false }`. Mounted at
 * /api/v1/site-snapshot.
 *
 * The publish version is the ETag. The browser asks on every page load and every
 * reload (Cache-Control: no-cache means "keep it, but ask first"); while the
 * version is unchanged the answer is an empty 304, and after a new publish the
 * browser receives the new snapshot. An unlocked answer is never kept.
 */
export const snapshotHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await siteLock.publicSnapshot();

  if (data.locked) {
    res.set("Cache-Control", "no-cache");
    res.set("ETag", `"${data.version}"`);
    res.set("X-Content-Version", data.version);
  } else {
    res.set("Cache-Control", "no-store");
  }

  res.status(200).json(new ApiResponse(true, "Snapshot loaded", data));
});
