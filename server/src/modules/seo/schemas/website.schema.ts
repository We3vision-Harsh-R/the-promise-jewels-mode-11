export interface WebsiteSchemaInput {
  name: string;
  url: string;
}

export function buildWebsiteSchema(data: WebsiteSchemaInput) {
  return {
    "@context": "https://schema.org",

    "@type": "WebSite",

    name: data.name,

    url: data.url,
  };
}
