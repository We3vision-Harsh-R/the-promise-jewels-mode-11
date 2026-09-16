export interface TwitterInput {
  title: string;
  description: string;
  image?: string | null;
}

export function buildTwitterCard(data: TwitterInput) {
  return {
    card: "summary_large_image",

    title: data.title,

    description: data.description,

    images: data.image ? [data.image] : [],
  };
}
