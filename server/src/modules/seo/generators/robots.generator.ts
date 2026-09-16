import { robotsTemplate } from "../templates/robots.template.js";

export function generateRobots(siteUrl: string) {
  return robotsTemplate(`${siteUrl}/sitemap.xml`);
}
