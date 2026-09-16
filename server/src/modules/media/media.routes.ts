import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";

import mediaController from "./media.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";
import { uploadImage } from "../../middleware/upload.middleware.js";

// Mounted at /api/v1/media in routes/index.ts.
//
//   GET    /media/assets       -> admin, the uploaded image library
//   POST   /media/assets       -> admin, upload (multipart, field "image")
//   DELETE /media/assets/:id   -> admin, delete from library + storage
//
// The "sections and slots" routes that used to live here are gone. Hero-ring
// frames were a parallel image system with a page of its own; every image on
// the site is now an ordinary field in Admin > Editor, declared in
// page-content.constants.ts and stored as a URL in page_content. What is left
// is the plain library: upload a file, get a URL, delete it later.
const router = Router();

router.use(requireAuth);

router.get("/assets", requirePermission("media", "view"), mediaController.listAssets);

router.post("/assets", requirePermission("media", "create"), uploadImage, mediaController.upload);

// Deleting removes the row AND the object in storage, and any page_content
// field still pointing at that URL will render nothing — an administrator
// decision, not an editor one.
router.delete("/assets/:id", requirePermission("media", "delete"), requireAdmin, mediaController.deleteAsset);

export default router;
