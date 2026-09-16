import {
  Prisma,
  RobotsPolicy,
  SchemaType,
  SeoEntityType,
  SitemapChangeFrequency,
} from "@prisma/client";

import { ApiError } from "../../utils/ApiError.js";
import seoRepository from "./seo.repository.js";
import seoResponseBuilder from "./builders/seoResponse.builder.js";
import { SEO_MESSAGES } from "./seo.constants.js";
import seoSettingsService from "../seo-settings/seo-settings.service.js";

class SeoService {
  async getAll() {
    const pages = await seoRepository.findAll();

    return seoResponseBuilder.buildList(pages);
  }

  async getById(id: string) {
    const page = await seoRepository.findById(id);

    if (!page) {
      throw new ApiError(404, SEO_MESSAGES.SEO_NOT_FOUND);
    }

    return seoResponseBuilder.buildDetails(page);
  }

  async update(
    id: string,
    data: Prisma.SeoPageUpdateInput,
    tags?: string | string[],
  ) {
    const existing = await seoRepository.findById(id);

    if (!existing) {
      throw new ApiError(404, SEO_MESSAGES.SEO_NOT_FOUND);
    }

    await seoRepository.updatePage(id, data);

    if (tags !== undefined) {
      await this.syncTags(id, tags);
    }

    const updated = await seoRepository.findById(id);

    if (!updated) {
      throw new ApiError(404, SEO_MESSAGES.SEO_NOT_FOUND);
    }

    return seoResponseBuilder.buildDetails(updated);
  }

  async createDefaultSeo(params: {
    displayName: string;
    slug: string;
    entityType: SeoEntityType;
    entityId: string;
  }) {
    const settings = await seoSettingsService.get();

    return seoRepository.create({
      displayName: params.displayName,

      slug: params.slug,

      entityType: params.entityType,

      entityId: params.entityId,

      metaTitle: `${params.displayName} | ${settings.siteName}`,

      metaDescription: settings.defaultMetaDescription,

      canonicalUrl: `${settings.siteUrl}/${params.slug}`,

      robots: settings.robots,

      schemaType: this.getDefaultSchema(params.entityType),

      priority: 0.5,

      changeFrequency: SitemapChangeFrequency.MONTHLY,

      includeInSitemap: true,

      isIndexed: true,

      isPublished: true,
    });
  }

  async updateByEntity(
    entityType: SeoEntityType,
    entityId: string,
    data: {
      displayName: string;
      slug: string;
    },
  ) {
    const page = await seoRepository.findByEntity(entityType, entityId);

    if (!page) {
      return;
    }

    const settings = await seoSettingsService.get();

    const updateData: Prisma.SeoPageUpdateInput = {
      displayName: data.displayName,
      slug: data.slug,
      canonicalUrl: `${settings.siteUrl}/${data.slug}`,
    };

    if (page.metaTitle === `${page.displayName} | ${settings.siteName}`) {
      updateData.metaTitle = `${data.displayName} | ${settings.siteName}`;
    }

    await seoRepository.updatePage(page.id, updateData);
  }

  async deleteByEntity(entityType: SeoEntityType, entityId: string) {
    await seoRepository.deleteByEntity(entityType, entityId);
  }

  private normalizeTags(tags: string | string[]): string[] {
    const values: string[] = Array.isArray(tags) ? tags : tags.split(",");

    const normalized = values
      .map((tag) => tag.trim())
      .filter((tag): tag is string => tag.length > 0);

    return Array.from(new Set<string>(normalized));
  }

  private async syncTags(seoPageId: string, tags: string | string[]) {
    const normalized: string[] = this.normalizeTags(tags);

    const existingTags = await seoRepository.findTagsByNames(normalized);

    const tagIds = [...existingTags.map((tag) => tag.id)];

    for (const tag of normalized) {
      const exists = existingTags.find((t) => t.name === tag);

      if (exists) continue;

      const created = await seoRepository.createTag({
        name: tag,
        slug: tag.toLowerCase().replace(/\s+/g, "-"),
      });

      tagIds.push(created.id);
    }

    await seoRepository.replaceTags(seoPageId, tagIds);
  }

  private getDefaultSchema(entity: SeoEntityType): SchemaType {
    switch (entity) {
      case SeoEntityType.BRAND:
        return SchemaType.BRAND;

      case SeoEntityType.COLLECTION:
        return SchemaType.COLLECTION;

      case SeoEntityType.EXHIBITION:
        return SchemaType.EXHIBITION;

      default:
        return SchemaType.WEBSITE;
    }
  }
}

export default new SeoService();
