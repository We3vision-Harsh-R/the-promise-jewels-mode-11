export interface CollectionSchemaInput {
  name: string;

  description: string;

  url: string;
}

export function buildCollectionSchema(data: CollectionSchemaInput) {
  return {
    "@context": "https://schema.org",

    "@type": "CollectionPage",

    name: data.name,

    description: data.description,

    url: data.url,
  };
}
