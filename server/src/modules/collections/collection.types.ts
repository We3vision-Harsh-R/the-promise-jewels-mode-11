export interface CreateCollectionDto {
  brandId: string;
  name: string;
  description: string;
  category?: string;
  specification?: string;
  ctaTitle?: string;
  ctaButtonText?: string;
  featured?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateCollectionDto = Partial<CreateCollectionDto>;

export interface ReorderItem {
  id: string;
  displayOrder: number;
}

export interface CollectionListQuery {
  search?: string;
  brandId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CollectionPublicQuery {
  brandId?: string;
  category?: string;
  featured?: string;
}
