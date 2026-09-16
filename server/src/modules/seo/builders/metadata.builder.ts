import { buildCanonical } from "./canonical.builder.js";
import { buildOpenGraph } from "./openGraph.builder.js";
import { buildTwitterCard } from "./twitter.builder.js";
import { buildRobots } from "./robots.builder.js";

interface MetadataInput {
  siteUrl: string;
  siteName: string;

  slug: string;

  title: string;

  description: string;

  canonicalUrl?: string | null;

  robots: any;

  ogImage?: string | null;

  twitterImage?: string | null;
}

export function buildMetadata(data: MetadataInput) {
  const canonical = buildCanonical(data.siteUrl, data.canonicalUrl, data.slug);

  return {
    title: data.title,

    description: data.description,

    alternates: {
      canonical,
    },

    robots: buildRobots(data.robots),

    openGraph: buildOpenGraph({
      title: data.title,
      description: data.description,
      url: canonical,
      image: data.ogImage,
      siteName: data.siteName,
    }),

    twitter: buildTwitterCard({
      title: data.title,
      description: data.description,
      image: data.twitterImage,
    }),
  };
}
