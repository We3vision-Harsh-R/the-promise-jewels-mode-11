export interface OpenGraphInput {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  siteName: string;
}

export function buildOpenGraph(data: OpenGraphInput) {
  return {
    title: data.title,
    description: data.description,
    url: data.url,
    siteName: data.siteName,
    type: "website",

    images: data.image
      ? [
          {
            url: data.image,
          },
        ]
      : [],
  };
}
