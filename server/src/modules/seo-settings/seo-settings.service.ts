import { Prisma, RobotsPolicy } from "@prisma/client";
import { env } from "../../config/env.js";
import seoSettingsRepository from "./seo-settings.repository.js";
import { ApiError } from "../../utils/ApiError.js";

class SeoSettingsService {
  async get() {
    let settings = await seoSettingsRepository.get();

    if (!settings) {
      settings = await seoSettingsRepository.create({
        siteName: env.SITE_NAME,

        siteUrl: env.SITE_URL,

        defaultMetaTitle: env.SITE_NAME,

        defaultMetaDescription: `Discover jewellery collections from ${env.SITE_NAME}.`,

        robots: RobotsPolicy.INDEX_FOLLOW,
      });
    }

    return settings;
  }

  async update(data: Prisma.SeoSettingsUpdateInput) {
    const settings = await seoSettingsRepository.get();

    if (!settings) {
      throw new ApiError(404, "SEO settings not found.");
    }

    return seoSettingsRepository.update(settings.id, data);
  }
}

export default new SeoSettingsService();
