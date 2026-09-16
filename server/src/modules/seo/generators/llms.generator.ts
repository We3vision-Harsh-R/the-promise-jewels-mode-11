import { llmsTemplate } from "../templates/llms.template.js";

export function generateLlms(siteName: string, siteUrl: string) {
  return llmsTemplate({
    siteName,
    siteUrl,
  });
}
