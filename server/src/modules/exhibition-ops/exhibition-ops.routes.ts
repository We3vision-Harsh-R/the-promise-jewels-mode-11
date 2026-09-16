import { Router } from "express";

import controller from "./exhibition-ops.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import {
  appointmentSchema,
  costSchema,
  crewSchema,
  documentSchema,
  inventorySchema,
  leadSchema,
  logSchema,
  opsFieldSchema,
  opsHeaderSchema,
  shiftSchema,
  taskSchema,
} from "./exhibition-ops.types.js";

// Mounted at /api/v1/exhibition-ops in routes/index.ts.
//
// Its own resource, `exhibitionOps`, NOT the `exhibitions` one.
//
// `exhibitions` is the marketing record — the words and pictures the website
// prints. This is stall cost, budget, what the gold weighed and which buyers
// were met. Somebody trusted to write a show's description on the website is
// not automatically somebody who should see the margin on it, and the two jobs
// are often different people. Keeping them apart is the whole reason RBAC here
// is resource-shaped rather than one "admin" flag.
//
// Nothing here is public. The website reads shows through /exhibitions, which
// cannot reach any of these tables.
//
// EVERY GUARD IS WRITTEN OUT IN FULL, on purpose.
//
// These were four local consts — `const view = requirePermission(...)` — and
// `npm run rbac:coverage` reported all 31 routes as UNCOVERED. It reads the
// route declarations as text and looks for the call, which is precisely what
// makes it worth having: it cannot be satisfied by a variable that merely
// looks like a guard. Following the alias would have weakened the check to
// keep this file short. Repetition is the cheaper price.
const router = Router();

router.use(requireAuth);

router.get("/options", requirePermission("exhibitionOps", "view"), controller.options);

router.get("/:exhibitionId", requirePermission("exhibitionOps", "view"), controller.get);

router.put(
  "/:exhibitionId",
  requirePermission("exhibitionOps", "edit"),
  validate(opsHeaderSchema),
  controller.saveHeader,
);

// ---- Leads ----
router.post(
  "/:exhibitionId/leads",
  requirePermission("exhibitionOps", "create"),
  validate(leadSchema),
  controller.createLead,
);
router.put(
  "/:exhibitionId/leads/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(leadSchema),
  controller.updateLead,
);
router.delete(
  "/:exhibitionId/leads/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteLead,
);

// ---- Costs ----
router.post(
  "/:exhibitionId/costs",
  requirePermission("exhibitionOps", "create"),
  validate(costSchema),
  controller.createCost,
);
router.put(
  "/:exhibitionId/costs/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(costSchema),
  controller.updateCost,
);
router.delete(
  "/:exhibitionId/costs/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteCost,
);

// ---- Crew and shifts ----
router.post(
  "/:exhibitionId/crew",
  requirePermission("exhibitionOps", "create"),
  validate(crewSchema),
  controller.createCrew,
);
router.put(
  "/:exhibitionId/crew/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(crewSchema),
  controller.updateCrew,
);
router.delete(
  "/:exhibitionId/crew/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteCrew,
);

router.post(
  "/:exhibitionId/crew/:crewId/shifts",
  requirePermission("exhibitionOps", "create"),
  validate(shiftSchema),
  controller.createShift,
);
router.delete(
  "/:exhibitionId/shifts/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteShift,
);

// ---- Tasks ----
router.post(
  "/:exhibitionId/tasks",
  requirePermission("exhibitionOps", "create"),
  validate(taskSchema),
  controller.createTask,
);
router.put(
  "/:exhibitionId/tasks/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(taskSchema),
  controller.updateTask,
);
router.delete(
  "/:exhibitionId/tasks/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteTask,
);

// ---- Documents ----
router.post(
  "/:exhibitionId/documents",
  requirePermission("exhibitionOps", "create"),
  validate(documentSchema),
  controller.createDocument,
);
router.delete(
  "/:exhibitionId/documents/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteDocument,
);

// ---- Daily log ----
router.post(
  "/:exhibitionId/logs",
  requirePermission("exhibitionOps", "create"),
  validate(logSchema),
  controller.createLog,
);
router.put(
  "/:exhibitionId/logs/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(logSchema),
  controller.updateLog,
);
router.delete(
  "/:exhibitionId/logs/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteLog,
);

// ---- Inventory ----
router.post(
  "/:exhibitionId/inventory",
  requirePermission("exhibitionOps", "create"),
  validate(inventorySchema),
  controller.createInventory,
);
router.put(
  "/:exhibitionId/inventory/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(inventorySchema),
  controller.updateInventory,
);
router.delete(
  "/:exhibitionId/inventory/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteInventory,
);

// ---- Appointments ----
router.post(
  "/:exhibitionId/appointments",
  requirePermission("exhibitionOps", "create"),
  validate(appointmentSchema),
  controller.createAppointment,
);
router.put(
  "/:exhibitionId/appointments/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(appointmentSchema),
  controller.updateAppointment,
);
router.delete(
  "/:exhibitionId/appointments/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteAppointment,
);

// ---- Custom fields ----
router.post(
  "/:exhibitionId/fields",
  requirePermission("exhibitionOps", "create"),
  validate(opsFieldSchema),
  controller.createField,
);
router.put(
  "/:exhibitionId/fields/:id",
  requirePermission("exhibitionOps", "edit"),
  validate(opsFieldSchema),
  controller.updateField,
);
router.delete(
  "/:exhibitionId/fields/:id",
  requirePermission("exhibitionOps", "delete"),
  controller.deleteField,
);

export default router;
