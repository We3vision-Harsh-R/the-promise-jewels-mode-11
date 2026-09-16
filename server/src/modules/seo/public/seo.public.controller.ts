import { Request, Response } from "express";

import { asyncHandler } from "../../../utils/asyncHandler.js";
import seoPublicService from "./seo.public.service.js";

class SeoPublicController {
  sitemap = asyncHandler(async (_req: Request, res: Response) => {
    const sitemap = await seoPublicService.generateSitemap();

    res.header("Content-Type", "application/xml");

    res.status(200).send(sitemap);
  });

  robots = asyncHandler(async (_req: Request, res: Response) => {
    const robots = await seoPublicService.generateRobots();

    res.header("Content-Type", "text/plain");

    res.status(200).send(robots);
  });

  llms = asyncHandler(async (_req: Request, res: Response) => {
    const llms = await seoPublicService.generateLlms();

    res.header("Content-Type", "text/plain");

    res.status(200).send(llms);
  });

  metadata = asyncHandler(async (req: Request, res: Response) => {
    const metadata = await seoPublicService.getMetadata(
      String(req.params.slug),
    );

    res.status(200).json(metadata);
  });
}

export default new SeoPublicController();
