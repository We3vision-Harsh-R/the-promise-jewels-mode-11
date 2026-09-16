import { Router } from "express";

import rbacController from "./rbac.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  requireAnyPermission,
  requirePermission,
} from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { createRoleSchema, updateRoleSchema } from "./rbac.validation.js";

/**
 * Mounted at /api/v1/rbac.
 *
 * Every route needs a session. What each one needs beyond that is stated on
 * the route itself rather than in a comment, so a reader can see the access
 * rule and the handler in the same line.
 */
const router = Router();

router.use(requireAuth);

/**
 * The caller's own permissions. Deliberately NOT behind a permission check:
 * "what may I do" has to be answerable by an account that may do nothing, or
 * the panel cannot render the empty state it should show them.
 */
router.get("/me", rbacController.me);

/**
 * Listing roles serves two screens — the roles page, and the role picker on
 * the user form — so holding either permission is enough. Someone who may
 * create an account should not need permission to rewrite roles just to read
 * their names.
 */
router.get(
  "/roles",
  requireAnyPermission(["roles", "view"], ["users", "view"]),
  rbacController.list,
);

router.post(
  "/roles",
  requirePermission("roles", "create"),
  validate(createRoleSchema),
  rbacController.create,
);

router.put(
  "/roles/:id",
  requirePermission("roles", "edit"),
  validate(updateRoleSchema),
  rbacController.update,
);

router.delete(
  "/roles/:id",
  requirePermission("roles", "delete"),
  rbacController.remove,
);

export default router;
