import { Router } from "express";

import secureNotesController from "./secure-notes.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { saveNoteSchema } from "./secure-notes.types.js";

// Mounted at /api/v1/vault in routes/index.ts.
//
// The `notes` permission decides whether an account HAS a vault. It never
// decides whose vault it sees — that is fixed to the signed-in account in the
// controller, for every route, with no way to name another one. Granting
// somebody notes:view gives them their own empty vault, not a look at anyone
// else's, and the same is true of the Master role.
const router = Router();

router.use(requireAuth);

router.get("/options", requirePermission("notes", "view"), secureNotesController.options);
router.get("/", requirePermission("notes", "view"), secureNotesController.list);

router.post(
  "/",
  requirePermission("notes", "create"),
  validate(saveNoteSchema),
  secureNotesController.create,
);

router.put(
  "/:id",
  requirePermission("notes", "edit"),
  validate(saveNoteSchema),
  secureNotesController.update,
);

router.delete("/:id", requirePermission("notes", "delete"), secureNotesController.remove);

export default router;
