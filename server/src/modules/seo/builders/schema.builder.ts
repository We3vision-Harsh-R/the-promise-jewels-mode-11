import { SchemaType } from "@prisma/client";

import { buildWebsiteSchema } from "../schemas/website.schema.js";
import { buildOrganizationSchema } from "../schemas/organization.schema.js";

import { buildCollectionSchema } from "../schemas/collection.schema.js";
import { buildEventSchema } from "../schemas/event.schema.js";

interface SchemaBuilderInput {
  schemaType: SchemaType;

  siteName: string;

  siteUrl: string;

  canonicalUrl?: string;

  logo?: string;

  title: string;

  description: string;

  startDate?: string;

  endDate?: string;

  location?: string;
}

export function buildSchema(data: SchemaBuilderInput) {
  switch (data.schemaType) {
    case SchemaType.WEBSITE:
      return buildWebsiteSchema({
        name: data.siteName,
        url: data.canonicalUrl ?? data.siteUrl,
      });

    case SchemaType.ORGANIZATION:
      return buildOrganizationSchema({
        name: data.siteName,
        url: data.canonicalUrl ?? data.siteUrl,
        logo: data.logo,
      });

    case SchemaType.COLLECTION:
      return buildCollectionSchema({
        name: data.title,
        description: data.description,
        url: data.canonicalUrl ?? data.siteUrl,
      });

    case SchemaType.BRAND:
      return buildOrganizationSchema({
        name: data.title,
        url: data.canonicalUrl ?? data.siteUrl,
        logo: data.logo,
      });

    case SchemaType.EXHIBITION:
    case SchemaType.EVENT:
      return buildEventSchema({
        name: data.title,
        description: data.description,
        startDate: data.startDate ?? "",
        endDate: data.endDate ?? "",
        location: data.location ?? "",
        url: data.canonicalUrl ?? data.siteUrl,
      });

    default:
      return buildWebsiteSchema({
        name: data.siteName,
        url: data.canonicalUrl ?? data.siteUrl,
      });
  }
}
