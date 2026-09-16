export interface OrganizationSchemaInput {
  name: string;
  url: string;
  logo?: string | null;
}

export function buildOrganizationSchema(data: OrganizationSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",

    name: data.name,

    url: data.url,

    logo: data.logo,
  };
}
