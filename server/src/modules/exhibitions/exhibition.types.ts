export type ExhibitionStatus = "upcoming" | "live" | "past";
export interface ExhibitionFilters {
  page: number;
  limit: number;
  featured?: boolean;
  isActive?: boolean;
  status?: ExhibitionStatus;
}

export interface UploadImageOptions {
  altText?: string;
  caption?: string;
}

export interface SearchFilters {
  keyword: string;
  page: number;
  limit: number;
}