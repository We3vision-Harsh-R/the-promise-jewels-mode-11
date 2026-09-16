import brandRepository from "./brand.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateId } from "../../utils/helpers.js";
import { slugify } from "../../utils/slugify.js";
import { storageService } from "../../config/storage.service.js";
import { STORAGE_BUCKETS } from "../../config/storage.config.js";
import { BRAND_MESSAGES } from "./brand.constants.js";
import {
  BrandListQuery,
  CreateBrandDto,
  ReorderItem,
  UpdateBrandDto,
} from "./brand.types.js";
import seoService from "../seo/seo.service.js";
import { SeoEntityType } from "@prisma/client";

type MulterFiles = { [fieldname: string]: Express.Multer.File[] } | undefined;

class BrandService {
  // ---- Public ----

  listPublic() {
    return brandRepository.findAllActive();
  }

  async getPublicBySlug(slug: string) {
    const brand = await brandRepository.findBySlugActive(slug);

    if (!brand) {
      throw new ApiError(404, BRAND_MESSAGES.NOT_FOUND);
    }

    return brand;
  }

  // ---- Admin ----

async listAdmin(query: BrandListQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 1000;

    const [brands, total] = await brandRepository.findAllAdmin({
      search: query.search,
      isActive: query.isActive,
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return {
      brands,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  listOptions() {
    return brandRepository.listOptions();
  }

  async getById(id: string) {
    const brand = await brandRepository.findById(id);

    if (!brand) {
      throw new ApiError(404, BRAND_MESSAGES.NOT_FOUND);
    }

    return brand;
  }

  // ---- Internal helpers ----

  /**
   * Builds a slug that is guaranteed unique in the brands table.
   * `ignoreSlug` lets update() skip clashing against the brand's own current slug.
   */
  private async buildUniqueSlug(
    name: string,
    ignoreSlug?: string,
  ): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let attempt = 1;

    while (true) {
      if (candidate === ignoreSlug) {
        return candidate;
      }

      const found = await brandRepository.findBySlug(candidate);

      if (!found) {
        return candidate;
      }

      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
  }

  private async uploadBrandFile(
    file: Express.Multer.File,
    folder: "logos" | "banners" | "gallery",
    brandId?: string,
  ) {
    const path = brandId
      ? `${folder}/${brandId}/${Date.now()}-${file.originalname}`
      : `${folder}/${Date.now()}-${file.originalname}`;

    return storageService.uploadFile(
      STORAGE_BUCKETS.BRANDS,
      path,
      file.buffer,
      file.mimetype,
    );
  }

  private async deleteBrandFile(url?: string | null) {
    if (!url) return;

    const path = storageService.extractPathFromUrl(url, STORAGE_BUCKETS.BRANDS);

    if (!path) return;

    await storageService.deleteFileSafe(STORAGE_BUCKETS.BRANDS, path);
  }

  async create(input: CreateBrandDto, files: MulterFiles, userId: string) {
    const slug = await this.buildUniqueSlug(input.name);

    const logo = files?.logo?.[0];
    const banner = files?.banner?.[0];
    const gallery = files?.images ?? [];

    const uploadedLogoUrl = logo
      ? await this.uploadBrandFile(logo, "logos")
      : null;
    const uploadedBannerUrl = banner
      ? await this.uploadBrandFile(banner, "banners")
      : null;

    try {
      const brand = await brandRepository.create({
        id: generateId(),
        name: input.name,
        slug,
        description: input.description,
        overview: input.overview ?? null,
        logoUrl: uploadedLogoUrl,
        bannerUrl: uploadedBannerUrl,
        ctaTitle: input.ctaTitle ?? null,
        ctaButtonText: input.ctaButtonText ?? null,
        displayOrder: input.displayOrder ?? 0,
        isActive: input.isActive ?? true,
        createdBy: userId,
        updatedAt: new Date(),
      });

      if (gallery.length) {
        const galleryData = await Promise.all(
          gallery.map(async (file, index) => ({
            id: generateId(),
            brandId: brand.id,
            imageUrl: await this.uploadBrandFile(file, "gallery", brand.id),
            displayOrder: index,
          })),
        );

        await brandRepository.addImages(galleryData);
      }

      await seoService.createDefaultSeo({
        displayName: brand.name,
        slug: brand.slug,
        entityType: SeoEntityType.BRAND,
        entityId: brand.id,
      });

      return brandRepository.findById(brand.id);
    } catch (error) {
      // Roll back any files already uploaded to Supabase if the DB write failed
      await Promise.all([
        this.deleteBrandFile(uploadedLogoUrl),
        this.deleteBrandFile(uploadedBannerUrl),
      ]);
      throw error;
    }
  }

  async update(id: string, input: UpdateBrandDto, files: MulterFiles) {
    const existing = await brandRepository.findById(id);

    if (!existing) {
      throw new ApiError(404, BRAND_MESSAGES.NOT_FOUND);
    }

    let slug = existing.slug;

    if (input.name && input.name !== existing.name) {
      slug = await this.buildUniqueSlug(input.name, existing.slug);
    }

    const logo = files?.logo?.[0];
    const banner = files?.banner?.[0];
    const gallery = files?.images ?? [];

    const data: Record<string, unknown> = {
      ...input,
      slug,
      updatedAt: new Date(),
    };

    if (logo) {
      const newLogoUrl = await this.uploadBrandFile(logo, "logos", id);
      data.logoUrl = newLogoUrl;
      await this.deleteBrandFile(existing.logoUrl);
    }

    if (banner) {
      const newBannerUrl = await this.uploadBrandFile(banner, "banners", id);
      data.bannerUrl = newBannerUrl;
      await this.deleteBrandFile(existing.bannerUrl);
    }

    const updatedBrand = await brandRepository.update(id, data);

    if (gallery.length) {
      const startOrder = existing.brand_images.length;

      const galleryData = await Promise.all(
        gallery.map(async (file, index) => ({
          id: generateId(),
          brandId: id,
          imageUrl: await this.uploadBrandFile(file, "gallery", id),
          displayOrder: startOrder + index,
        })),
      );

      await brandRepository.addImages(galleryData);
    }
    await seoService.updateByEntity(SeoEntityType.BRAND, updatedBrand.id, {
      displayName: updatedBrand.name,
      slug: updatedBrand.slug,
    });
    return brandRepository.findById(id);
  }

  async remove(id: string) {
    const brand = await brandRepository.findById(id);

    if (!brand) {
      throw new ApiError(404, BRAND_MESSAGES.NOT_FOUND);
    }

    const linkedCollections = await brandRepository.countCollections(id);

    if (linkedCollections > 0) {
      throw new ApiError(409, BRAND_MESSAGES.HAS_COLLECTIONS);
    }

    await brandRepository.delete(id);

    await seoService.deleteByEntity(SeoEntityType.BRAND, id);

    await Promise.all([
      this.deleteBrandFile(brand.logoUrl),
      this.deleteBrandFile(brand.bannerUrl),
      ...brand.brand_images.map((image: { imageUrl: string }) =>
        this.deleteBrandFile(image.imageUrl),
      ),
    ]);

    return { id };
  }

  async toggleStatus(id: string) {
    const brand = await brandRepository.findById(id);

    if (!brand) {
      throw new ApiError(404, BRAND_MESSAGES.NOT_FOUND);
    }

    return brandRepository.update(id, {
      isActive: !brand.isActive,
      updatedAt: new Date(),
    });
  }

  async reorder(items: ReorderItem[]) {
    await brandRepository.reorder(items);
    return { updated: items.length };
  }

  async deleteImage(brandId: string, imageId: string) {
    const image = await brandRepository.findImageById(imageId);

    if (!image || image.brandId !== brandId) {
      throw new ApiError(404, BRAND_MESSAGES.IMAGE_NOT_FOUND);
    }

    await brandRepository.deleteImage(imageId);
    await this.deleteBrandFile(image.imageUrl);

    return { id: imageId };
  }
}

export default new BrandService();
