import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import exhibitionRoutes from "../modules/exhibitions/exhibition.routes.js";
import seoRoutes from "../modules/seo/seo.routes.js";
import seoPublicRoutes from "../modules/seo/public/seo.public.routes.js";
import seoSettingsRoutes from "../modules/seo-settings/seo-settings.routes.js";
import brandRoutes, {brandAdminRoutes} from "../modules/brands/brand.routes.js";
import collectionRoutes, {collectionAdminRoutes} from "../modules/collections/collection.routes.js";
import { authenticate } from "../middleware/auth.middleware.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import inquiryRoutes from "../modules/inquiries/inquiry.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";
import mediaRoutes from "../modules/media/media.routes.js";
import pageContentRoutes from "../modules/page-content/page-content.routes.js";
import customSectionRoutes from "../modules/page-content/custom-section.routes.js";
import secureNotesRoutes from "../modules/secure-notes/secure-notes.routes.js";
import exhibitionOpsRoutes from "../modules/exhibition-ops/exhibition-ops.routes.js";
import blogRoutes from "../modules/blog/blog.routes.js";
import rbacRoutes from "../modules/rbac/rbac.routes.js";
import userRoutes from "../modules/users/user.routes.js";

const router = Router();
//public routes
router.use("/", seoPublicRoutes);
router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Promise Jewels API",
  });
});
//protected routes
router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/exhibitions", exhibitionRoutes);
router.use("/seo", seoRoutes);
router.use("/brands", brandRoutes);
router.use("/admin/brands", brandAdminRoutes);
router.use("/collections", collectionRoutes);
router.use("/admin/collections", collectionAdminRoutes);
router.use("/seo-settings",authenticate ,seoSettingsRoutes);
router.use("/inquiries", inquiryRoutes);
router.use("/settings", settingsRoutes);
router.use("/media", mediaRoutes);
router.use("/page-content", pageContentRoutes);
// Designing sections, not writing their words — see custom-section.routes.ts.
router.use("/sections", customSectionRoutes);
// The owner's vault. Scoped to the signed-in account by construction —
// see secure-notes.service.ts.
router.use("/vault", secureNotesRoutes);
// Running a show, as opposed to advertising one. Its own resource —
// see exhibition-ops.routes.ts for why it is not part of "exhibitions".
router.use("/exhibition-ops", exhibitionOpsRoutes);
router.use("/blog", blogRoutes);
// Roles, and the caller's own permission profile.
router.use("/rbac", rbacRoutes);
// Admin accounts.
router.use("/users", userRoutes);
export default router;
