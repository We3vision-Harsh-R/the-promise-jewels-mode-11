import collectionRepository from "./collection.repository.js";
import brandRepository from "../brands/brand.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateId } from "../../utils/helpers.js";
import { slugify } from "../../utils/slugify.js";
import { storageService } from "../../config/storage.service.js";
import { STORAGE_BUCKETS } from "../../config/storage.config.js";
import { COLLECTION_MESSAGES } from "./collection.constants.js";
import {
  CollectionListQuery,
  CollectionPublicQuery,
  CreateCollectionDto,
  ReorderItem,
  UpdateCollectionDto,
} from "./collection.types.js";
import seoService from "../seo/seo.service.js";
import { SeoEntityType } from "@prisma/client";

type MulterFiles = { [fieldname: string]: Express.Multer.File[] } | undefined;

class CollectionService {
  // ---- Public ----

  listPublic(filters: CollectionPublicQuery) {
    return collectionRepository.findAllActive({
      brandId: filters.brandId,
      category: filters.category,
      featured: filters.featured !== undefined ? filters.featured === "true" : undefined,
    });
  }

  async getPublicBySlug(slug: string) {
    const collection = await collectionRepository.findBySlugActive(slug);

    if (!collection) {
      throw new ApiError(404, COLLECTION_MESSAGES.NOT_FOUND);
    }

    return collection;
  }

  // ---- Admin ----

async listAdmin(query: CollectionListQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 1000;

    const [collections, total] = await collectionRepository.findAllAdmin({
      search: query.search,
      brandId: query.brandId,
      isActive: query.isActive,
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return {
      collections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getById(id: string) {
    const collection = await collectionRepository.findById(id);

    if (!collection) {
      throw new ApiError(404, COLLECTION_MESSAGES.NOT_FOUND);
    }

    return collection;
  }

  private async ensureBrandExists(brandId: string) {
    const brand = await brandRepository.findById(brandId);

    if (!brand) {
      throw new ApiError(400, COLLECTION_MESSAGES.BRAND_NOT_FOUND);
    }

    return brand;
  }

  // ---- Internal helpers ----

  private async buildUniqueSlug(name: string, ignoreSlug?: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let attempt = 1;

    while (true) {
      if (candidate === ignoreSlug) {
        return candidate;
      }

      const found = await collectionRepository.findBySlug(candidate);

      if (!found) {
        return candidate;
      }

      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
  }

  private async uploadCollectionFile(
    file: Express.Multer.File,
    folder: "banners" | "gallery",
    collectionId?: string,
  ) {
    const path = collectionId
      ? `${folder}/${collectionId}/${Date.now()}-${file.originalname}`
      : `${folder}/${Date.now()}-${file.originalname}`;

    return storageService.uploadFile(
      STORAGE_BUCKETS.COLLECTIONS,
      path,
      file.buffer,
      file.mimetype,
    );
  }

  /**
   * The brand's logo and picture are uploaded from the collection form, but they
   * belong to the brand: they are stored in the brands bucket and written to the
   * brand's own row, so the Home and Our Brand pages pick them up unchanged.
   */
  private async saveBrandImages(brandId: string, files: MulterFiles) {
    const logo = files?.brandLogo?.[0];
    const image = files?.brandImage?.[0];

    if (!logo && !image) return;

    const brand = await brandRepository.findById(brandId);
    const data: Record<string, unknown> = { updatedAt: new Date() };
    const stale: Array<string | null | undefined> = [];

    const put = (file: Express.Multer.File, folder: "logos" | "banners") =>
      storageService.uploadFile(
        STORAGE_BUCKETS.BRANDS,
        `${folder}/${brandId}/${Date.now()}-${file.originalname}`,
        file.buffer,
        file.mimetype,
      );

    if (logo) {
      data.logoUrl = await put(logo, "logos");
      stale.push(brand?.logoUrl);
    }

    if (image) {
      data.bannerUrl = await put(image, "banners");
      stale.push(brand?.bannerUrl);
    }

    await brandRepository.update(brandId, data);

    for (const url of stale) {
      if (!url) continue;
      const path = storageService.extractPathFromUrl(url, STORAGE_BUCKETS.BRANDS);
      if (path) await storageService.deleteFileSafe(STORAGE_BUCKETS.BRANDS, path);
    }
  }

  private async deleteCollectionFile(url?: string | null) {
    if (!url) return;

    const path = storageService.extractPathFromUrl(url, STORAGE_BUCKETS.COLLECTIONS);

    if (!path) return;

    await storageService.deleteFileSafe(STORAGE_BUCKETS.COLLECTIONS, path);
  }

  async create(input: CreateCollectionDto, files: MulterFiles, userId: string) {
    await this.ensureBrandExists(input.brandId);

    const slug = await this.buildUniqueSlug(input.name);

    const banner = files?.banner?.[0];
    const gallery = files?.images ?? [];

    const uploadedBannerUrl = banner ? await this.uploadCollectionFile(banner, "banners") : null;

    let createdId: string | undefined;

    try {
      const collection = await collectionRepository.create({
        id: generateId(),
        brandId: input.brandId,
        name: input.name,
        slug,
        description: input.description,
        category: input.category ?? null,
        specification: input.specification ?? null,
        ctaTitle: input.ctaTitle ?? null,
        ctaButtonText: input.ctaButtonText ?? null,
        bannerUrl: uploadedBannerUrl,
        featured: input.featured ?? false,
        displayOrder: input.displayOrder ?? 0,
        isActive: input.isActive ?? true,
        createdBy: userId,
        updatedAt: new Date(),
      });

      createdId = collection.id;

      if (gallery.length) {
        const galleryData = await Promise.all(
          gallery.map(async (file, index) => ({
            id: generateId(),
            collectionId: collection.id,
            imageUrl: await this.uploadCollectionFile(file, "gallery", collection.id),
            displayOrder: index,
            isThumbnail: index === 0,
          })),
        );

        await collectionRepository.addImages(galleryData);
      }

      await this.saveBrandImages(input.brandId, files);

      await seoService.createDefaultSeo({
        displayName: collection.name,
        slug: collection.slug,
        entityType: SeoEntityType.COLLECTION,
        entityId: collection.id,
      });

      return collectionRepository.findById(collection.id);
    } catch (error) {
      // Nothing is left half-made: a failed upload must not leave a collection
      // row (or its banner) behind that the admin never saw succeed.
      await this.deleteCollectionFile(uploadedBannerUrl);
      if (createdId) await collectionRepository.delete(createdId).catch(() => undefined);
      throw error;
    }
  }

  async update(id: string, input: UpdateCollectionDto, files: MulterFiles) {
    const existing = await collectionRepository.findById(id);

    if (!existing) {
      throw new ApiError(404, COLLECTION_MESSAGES.NOT_FOUND);
    }

    if (input.brandId) {
      await this.ensureBrandExists(input.brandId);
    }

    let slug = existing.slug;

    if (input.name && input.name !== existing.name) {
      slug = await this.buildUniqueSlug(input.name, existing.slug);
    }

    const banner = files?.banner?.[0];
    const gallery = files?.images ?? [];

    const data: Record<string, unknown> = {
      ...input,
      slug,
      updatedAt: new Date(),
    };

    if (banner) {
      const newBannerUrl = await this.uploadCollectionFile(banner, "banners", id);
      data.bannerUrl = newBannerUrl;
      await this.deleteCollectionFile(existing.bannerUrl);
    }

    const updatedCollection = await collectionRepository.update(id, data);

    if (gallery.length) {
      const startOrder = existing.collection_images.length;

      const galleryData = await Promise.all(
        gallery.map(async (file, index) => ({
          id: generateId(),
          collectionId: id,
          imageUrl: await this.uploadCollectionFile(file, "gallery", id),
          displayOrder: startOrder + index,
          isThumbnail: startOrder === 0 && index === 0,
        })),
      );

      await collectionRepository.addImages(galleryData);
    }

    await this.saveBrandImages(updatedCollection.brandId, files);

    await seoService.updateByEntity(
      SeoEntityType.COLLECTION,
      updatedCollection.id,
      {
        displayName: updatedCollection.name,
        slug: updatedCollection.slug,
      },
    );

    return collectionRepository.findById(id);
  }

  async remove(id: string) {
    const collection = await collectionRepository.findById(id);

    if (!collection) {
      throw new ApiError(404, COLLECTION_MESSAGES.NOT_FOUND);
    }

    await collectionRepository.delete(id);
    
    await seoService.deleteByEntity(SeoEntityType.COLLECTION, id);

    await Promise.all([
      this.deleteCollectionFile(collection.bannerUrl),
      ...collection.collection_images.map((image: { imageUrl: string }) =>
        this.deleteCollectionFile(image.imageUrl),
      ),
    ]);

    return { id };
  }

  async toggleStatus(id: string) {
    const collection = await collectionRepository.findById(id);

    if (!collection) {
      throw new ApiError(404, COLLECTION_MESSAGES.NOT_FOUND);
    }

    return collectionRepository.update(id, {
      isActive: !collection.isActive,
      updatedAt: new Date(),
    });
  }

  async toggleFeatured(id: string) {
    const collection = await collectionRepository.findById(id);

    if (!collection) {
      throw new ApiError(404, COLLECTION_MESSAGES.NOT_FOUND);
    }

    return collectionRepository.update(id, {
      featured: !collection.featured,
      updatedAt: new Date(),
    });
  }

  async reorder(items: ReorderItem[]) {
    await collectionRepository.reorder(items);
    return { updated: items.length };
  }

  async deleteImage(collectionId: string, imageId: string) {
    const image = await collectionRepository.findImageById(imageId);

    if (!image || image.collectionId !== collectionId) {
      throw new ApiError(404, COLLECTION_MESSAGES.IMAGE_NOT_FOUND);
    }

    await collectionRepository.deleteImage(imageId);
    await this.deleteCollectionFile(image.imageUrl);

    return { id: imageId };
  }

  async setThumbnail(collectionId: string, imageId: string) {
    const image = await collectionRepository.findImageById(imageId);

    if (!image || image.collectionId !== collectionId) {
      throw new ApiError(404, COLLECTION_MESSAGES.IMAGE_NOT_FOUND);
    }

    await collectionRepository.setThumbnail(collectionId, imageId);

    return { id: imageId };
  }
}

export default new CollectionService();