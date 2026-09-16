export interface CreateBrandDto {
  name: string;
  description: string;
  overview?: string;
  ctaTitle?: string;
  ctaButtonText?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateBrandDto = Partial<CreateBrandDto>;

export interface ReorderItem {
  id: string;
  displayOrder: number;
}

export interface BrandListQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
