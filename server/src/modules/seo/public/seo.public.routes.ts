import { Router } from "express";

import seoPublicController from "./seo.public.controller.js";

const router = Router();

router.get("/sitemap.xml", seoPublicController.sitemap);

router.get("/robots.txt", seoPublicController.robots);

router.get("/llms.txt", seoPublicController.llms);

router.get("/metadata/:slug", seoPublicController.metadata);

export default router;
