import { SeoPage, SeoTag } from "@prisma/client";

import { calculateSeoScore } from "../utils/seoScore.js";

type SeoPageWithTags = SeoPage & {
  tags: {
    seoTag: SeoTag;
  }[];
};

class SeoResponseBuilder {
  buildList(pages: SeoPageWithTags[]) {
    return pages.map((page) => {
      const seo = calculateSeoScore(page);

      return {
        id: page.id,

        displayName: page.displayName,

        slug: page.slug,

        entityType: page.entityType,

        seoScore: seo.score,

        updatedAt: page.updatedAt,
      };
    });
  }

  buildDetails(page: SeoPageWithTags) {
    const seo = calculateSeoScore(page);

    return {
      id: page.id,

      displayName: page.displayName,

      slug: page.slug,

      entityType: page.entityType,

      entityId: page.entityId,

      metaTitle: page.metaTitle,

      metaDescription: page.metaDescription,

      keywords: page.tags.map((tag) => tag.seoTag.name).join(", "),

      canonicalUrl: page.canonicalUrl,

      robots: page.robots,

      ogTitle: page.ogTitle,

      ogDescription: page.ogDescription,

      ogImage: page.ogImage,

      twitterTitle: page.twitterTitle,

      twitterDescription: page.twitterDescription,

      twitterImage: page.twitterImage,

      schemaType: page.schemaType,

      priority: page.priority,

      changeFrequency: page.changeFrequency,

      includeInSitemap: page.includeInSitemap,

      isIndexed: page.isIndexed,

      isPublished: page.isPublished,

      seoScore: seo.score,

      completedChecks: seo.completed,

      missingChecks: seo.missing,

      createdAt: page.createdAt,

      updatedAt: page.updatedAt,
    };
  }
}

export default new SeoResponseBuilder();
