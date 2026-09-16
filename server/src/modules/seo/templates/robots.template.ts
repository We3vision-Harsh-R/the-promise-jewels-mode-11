export function robotsTemplate(sitemapUrl: string) {
  return `User-agent: *

Allow: /

Sitemap: ${sitemapUrl}
`;
}
