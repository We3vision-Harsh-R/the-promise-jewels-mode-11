export const SEO_MESSAGES = {
  SEO_LIST_FETCHED: "SEO pages fetched successfully.",
  SEO_PAGE_FETCHED: "SEO page fetched successfully.",
  SEO_PAGE_UPDATED: "SEO page updated successfully.",
  SEO_NOT_FOUND: "SEO page not found.",

  INVALID_PAGE: "Invalid page key.",

  DUPLICATE_SLUG: "Slug already exists.",
} as const;

export const SEO_PAGE_KEYS = [
  "home",
  "about",
  "brands",
  "collections",
  "exhibitions",
  "team",
  "contact",
  "privacy-policy",
] as const;

export type SeoPageKey = (typeof SEO_PAGE_KEYS)[number];
