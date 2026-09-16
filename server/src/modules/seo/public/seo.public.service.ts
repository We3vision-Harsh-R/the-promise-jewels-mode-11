import seoRepository from "../seo.repository.js";
import { generateRobots } from "../generators/robots.generator.js";
import { generateSitemap } from "../generators/sitemap.generator.js";
import { generateLlms } from "../generators/llms.generator.js";
import seoSettingsService from "../../seo-settings/seo-settings.service.js";
import { buildMetadata } from "../builders/metadata.builder.js";
import { buildSchema } from "../builders/schema.builder.js";
import { ApiError } from "../../../utils/ApiError.js";
import { SEO_MESSAGES } from "../seo.constants.js";
import { env } from "../../../config/env.js";

class SeoPublicService {
  async generateRobots() {
    const settings = await seoSettingsService.get();

    return generateRobots(settings.siteUrl);
  }

  async generateSitemap() {
    const settings = await seoSettingsService.get();

    const pages = await seoRepository.findPublishedPages();

    return generateSitemap(settings.siteUrl, pages);
  }

  async generateLlms() {
    const settings = await seoSettingsService.get();

    return generateLlms(settings.siteName, settings.siteUrl);
  }

  async getMetadata(slug: string) {
    const page = await seoRepository.findBySlug(slug);

    if (!page) {
      throw new ApiError(404, SEO_MESSAGES.SEO_NOT_FOUND);
    }

    const settings = await seoSettingsService.get();
    
    const fallbackImage =
      settings.defaultOgImage ?? `${settings.siteUrl}${env.DEFAULT_OG_IMAGE}`;

    const ogImage = page.ogImage ?? fallbackImage;

    const twitterImage = page.twitterImage ?? ogImage;
    
    const metadata = buildMetadata({
      siteUrl: settings.siteUrl,
      siteName: settings.siteName,

      slug: page.slug,

      title: page.metaTitle,
      description: page.metaDescription,

      canonicalUrl: page.canonicalUrl,

      robots: page.robots,

      ogImage,
      twitterImage,
    });

    const schema = page.schemaType
      ? buildSchema({
          schemaType: page.schemaType,

          siteName: settings.siteName,

          siteUrl: settings.siteUrl,

          canonicalUrl: page.canonicalUrl ?? undefined,

          logo: fallbackImage,

          title: page.metaTitle,

          description: page.metaDescription,
        })
      : null;

    return {
      ...metadata,

      schema,
    };
  }
}

export default new SeoPublicService();
