import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";
import rateLimit from "express-rate-limit";

import blogController from "./blog.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  createCommentSchema,
  createPostSchema,
  updateCommentSchema,
  updatePostSchema,
} from "./blog.validation.js";

// Mounted at /api/v1/blog in routes/index.ts.
//
//   GET  /blog/public                  -> no auth, the published posts
//   GET  /blog/public/:slug            -> no auth, one post + approved comments
//   POST /blog/public/:slug/comments   -> no auth, leave a comment (throttled)
//
//   GET    /blog                       -> admin, every post including drafts
//   POST   /blog                       -> admin, create
//   GET    /blog/comments              -> admin, moderation queue
//   PUT    /blog/comments/:id          -> admin, approve / reject
//   DELETE /blog/comments/:id          -> admin, delete
//   GET    /blog/:id                   -> admin, one post for editing
//   PUT    /blog/:id                   -> admin, save
//   DELETE /blog/:id                   -> admin, delete
//
// The public routes are registered BEFORE router.use(requireAuth) — the same
// pattern settings and page-content use. "comments" is a literal segment that
// the :id route would otherwise swallow, so it is declared ahead of it.

/**
 * Posting a comment is the only write on the whole API that an anonymous
 * visitor can make, which makes it the one worth throttling on its own. The
 * general /api limiter is far too loose to stop someone filling the
 * moderation queue.
 */
const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(
      new ApiError(
        429,
        "You have left several comments already. Please wait a few minutes.",
      ),
    ),
});

const router = Router();

router.get("/public", blogController.listPublic);
router.get("/public/:slug", blogController.getPublic);
router.post(
  "/public/:slug/comments",
  commentLimiter,
  validate(createCommentSchema),
  blogController.addComment,
);

router.use(requireAuth);

router.get("/comments", requirePermission("blog", "view"), blogController.listComments);
router.put(
  "/comments/:id",
  requirePermission("blog", "edit"),
  validate(updateCommentSchema),
  blogController.setCommentStatus,
);
router.delete("/comments/:id", requirePermission("blog", "delete"), requireAdmin, blogController.removeComment);

router.get("/", requirePermission("blog", "view"), blogController.list);
router.post("/", requirePermission("blog", "create"), validate(createPostSchema), blogController.create);

router.get("/:id", requirePermission("blog", "view"), blogController.getOne);
router.put("/:id", requirePermission("blog", "edit"), validate(updatePostSchema), blogController.update);
router.delete("/:id", requirePermission("blog", "delete"), requireAdmin, blogController.remove);

export default router;
