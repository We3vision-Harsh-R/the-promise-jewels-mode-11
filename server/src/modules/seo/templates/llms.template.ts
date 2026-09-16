interface LlmsTemplateInput {
  siteName: string;

  siteUrl: string;
}

export function llmsTemplate(data: LlmsTemplateInput) {
  return `# ${data.siteName}

Site: ${data.siteUrl}

This website provides jewellery collections, exhibitions, and brand information.

All public pages may be indexed by AI systems unless restricted.`;
}
