import { Router } from "express";

import userController from "./user.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { createUserSchema, updateUserSchema } from "./user.validation.js";

/**
 * Mounted at /api/v1/users.
 *
 * Every route needs a session AND a users:* permission. There is no public
 * route on this router — an account list is not something an anonymous caller
 * should be able to enumerate.
 */
const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("users", "view"), userController.list);

router.post(
  "/",
  requirePermission("users", "create"),
  validate(createUserSchema),
  userController.create,
);

router.put(
  "/:id",
  requirePermission("users", "edit"),
  validate(updateUserSchema),
  userController.update,
);

router.delete("/:id", requirePermission("users", "delete"), userController.remove);

export default router;
