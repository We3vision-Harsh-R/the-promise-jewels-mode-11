export function buildCanonical(
  siteUrl: string,
  canonicalUrl?: string | null,
  slug?: string | null,
) {
  if (canonicalUrl?.trim()) {
    return canonicalUrl;
  }

  if (!slug) {
    return siteUrl;
  }

  return `${siteUrl.replace(/\/$/, "")}/${slug.replace(/^\//, "")}`;
}
