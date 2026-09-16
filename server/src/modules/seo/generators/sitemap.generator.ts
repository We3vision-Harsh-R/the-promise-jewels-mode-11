import { SitemapChangeFrequency } from "@prisma/client";

interface SitemapPage {
  slug: string;

  updatedAt: Date;

  priority: number | null;

  changeFrequency: SitemapChangeFrequency | null;
}

export function generateSitemap(siteUrl: string, pages: SitemapPage[]) {
  const urls = pages
    .map(
      (page) => `
<url>
  <loc>${siteUrl}/${page.slug}</loc>
  <lastmod>${page.updatedAt.toISOString()}</lastmod>
  <changefreq>${(page.changeFrequency ?? "monthly").toLowerCase()}</changefreq>
  <priority>${page.priority ?? 0.5}</priority>
</url>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls}

</urlset>`;
}
