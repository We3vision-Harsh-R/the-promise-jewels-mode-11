import { Router } from "express";
import {
  requireAnyPageView,
  requirePagePermission,
} from "./page-content.permission.js";
import { saveLayoutSchema } from "./page-layout.validation.js";

import pageContentController from "./page-content.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { updatePageContentSchema } from "./page-content.validation.js";

// Mounted at /api/v1/page-content in routes/index.ts.
//
//   GET /page-content/public/:page -> no auth, read by the public website
//   GET /page-content/pages        -> admin, the Editor's page tabs
//   GET /page-content/:page        -> admin, field declarations + current values
//   PUT /page-content/:page        -> admin, save one page
//
// The public route is registered BEFORE router.use(requireAuth), so it is the
// only one on this router that skips auth — same pattern as settings.routes.ts.
// "public" and "pages" are literal segments that would otherwise be captured
// by the :page route, so both are declared ahead of it.
const router = Router();

router.get("/public/:page", pageContentController.getPublic);

// The website reads its own arrangement. Public for the same reason the copy
// is: it is what every visitor sees.
router.get("/public/:page/layout", pageContentController.getPublicLayout);

router.use(requireAuth);

router.get("/pages", requireAnyPageView, pageContentController.listPages);

router.get("/:page/layout", requirePagePermission("view"), pageContentController.getLayout);

// Rearranging a page is editing it, so it needs the same permission as
// changing its words — chosen per page, so Header access does not grant it.
router.put(
  "/:page/layout",
  requirePagePermission("edit"),
  validate(saveLayoutSchema),
  pageContentController.saveLayout,
);

router.get("/:page", requirePagePermission("view"), pageContentController.getAdmin);

router.put(
  "/:page",
  requirePagePermission("edit"),
  validate(updatePageContentSchema),
  pageContentController.update,
);

export default router;
