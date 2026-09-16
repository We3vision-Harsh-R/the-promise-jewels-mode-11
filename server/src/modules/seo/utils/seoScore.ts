import { SeoPage } from "@prisma/client";

export interface SeoScoreResult {
  score: number;
  completed: string[];
  missing: string[];
}

const SCORE_RULES = [
  {
    label: "Meta Title",
    score: 20,
    valid: (page: SeoPage) => page.metaTitle.trim().length > 0,
  },
  {
    label: "Meta Description",
    score: 20,
    valid: (page: SeoPage) => page.metaDescription.trim().length > 0,
  },
  {
    label: "Canonical URL",
    score: 15,
    valid: (page: SeoPage) => !!page.canonicalUrl,
  },
  {
    label: "Robots Policy",
    score: 10,
    valid: (page: SeoPage) => !!page.robots,
  },
  {
    label: "Open Graph Image",
    score: 10,
    valid: (page: SeoPage) => !!page.ogImage,
  },
  {
    label: "Twitter Image",
    score: 10,
    valid: (page: SeoPage) => !!page.twitterImage,
  },
  {
    label: "Schema Type",
    score: 10,
    valid: (page: SeoPage) => !!page.schemaType,
  },
  {
    label: "Included In Sitemap",
    score: 5,
    valid: (page: SeoPage) => page.includeInSitemap,
  },
];

export function calculateSeoScore(page: SeoPage): SeoScoreResult {
  let score = 0;

  const completed: string[] = [];

  const missing: string[] = [];

  for (const rule of SCORE_RULES) {
    if (rule.valid(page)) {
      score += rule.score;
      completed.push(rule.label);
    } else {
      missing.push(rule.label);
    }
  }

  return {
    score,
    completed,
    missing,
  };
}
