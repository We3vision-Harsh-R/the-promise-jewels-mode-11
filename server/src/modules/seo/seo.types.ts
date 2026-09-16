import {
  RobotsPolicy,
  SchemaType,
  SitemapChangeFrequency,
  SeoEntityType,
} from "@prisma/client";

export interface UpdateSeoDto {
  metaTitle: string;

  metaDescription: string;

  canonicalUrl?: string;

  robots?: RobotsPolicy;

  ogTitle?: string;

  ogDescription?: string;

  ogImage?: string;

  twitterTitle?: string;

  twitterDescription?: string;

  twitterImage?: string;

  schemaType?: SchemaType;

  priority?: number;

  changeFrequency?: SitemapChangeFrequency;

  includeInSitemap?: boolean;

  isIndexed?: boolean;

  isPublished?: boolean;
}

export interface SeoListItem {
  displayName: string;

  label: string;

  metaTitle: string;

  metaDescription: string;
}

export interface SeoPageResponse {
  id: string;

  pageKey: string;

  entityType: SeoEntityType;

  entityId: string | null;

  metaTitle: string;

  metaDescription: string;

  keywords: string;

  canonicalUrl: string | null;

  robots: RobotsPolicy;

  ogTitle: string | null;

  ogDescription: string | null;

  ogImage: string | null;

  twitterTitle: string | null;

  twitterDescription: string | null;

  twitterImage: string | null;

  schemaType: SchemaType | null;

  priority: number | null;

  changeFrequency: SitemapChangeFrequency | null;

  includeInSitemap: boolean;

  isIndexed: boolean;

  isPublished: boolean;
}
