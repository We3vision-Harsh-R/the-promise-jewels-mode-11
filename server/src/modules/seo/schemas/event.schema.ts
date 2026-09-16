export interface EventSchemaInput {
  name: string;

  description: string;

  startDate: string;

  endDate: string;

  location: string;

  url: string;
}

export function buildEventSchema(data: EventSchemaInput) {
  return {
    "@context": "https://schema.org",

    "@type": "Event",

    name: data.name,

    description: data.description,

    startDate: data.startDate,

    endDate: data.endDate,

    location: {
      "@type": "Place",

      name: data.location,
    },

    url: data.url,
  };
}
