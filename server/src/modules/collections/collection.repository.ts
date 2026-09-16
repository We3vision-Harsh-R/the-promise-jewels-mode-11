import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

class CollectionRepository {
  // ---- Public (website) ----

  findAllActive(filters: { brandId?: string; category?: string; featured?: boolean }) {
    const where: Prisma.collectionsWhereInput = {
      isActive: true,
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.featured !== undefined ? { featured: filters.featured } : {}),
    };

    return prisma.collections.findMany({
      where,
      orderBy: { displayOrder: "asc" },
      include: {
        collection_images: { orderBy: { displayOrder: "asc" } },
        brands: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  findBySlugActive(slug: string) {
    return prisma.collections.findFirst({
      where: { slug, isActive: true },
      include: {
        collection_images: { orderBy: { displayOrder: "asc" } },
        brands: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
    });
  }

  // ---- Admin ----

findAllAdmin(params: {
    search?: string;
    brandId?: string;
    isActive?: boolean;
    skip: number;
    take: number;
  }) {
    const where: Prisma.collectionsWhereInput = {
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      ...(params.brandId ? { brandId: params.brandId } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    };
    
    return Promise.all([
      prisma.collections.findMany({
        where,
        orderBy: { displayOrder: "asc" },
        skip: params.skip,
        take: params.take,
        include: {
          collection_images: { orderBy: { displayOrder: "asc" } },
          brands: { select: { id: true, name: true } },
        },
      }),
      prisma.collections.count({ where }),
    ]);
  }

  findById(id: string) {
    return prisma.collections.findUnique({
      where: { id },
      include: {
        collection_images: { orderBy: { displayOrder: "asc" } },
        brands: { select: { id: true, name: true } },
      },
    });
  }

  findBySlug(slug: string) {
    return prisma.collections.findUnique({ where: { slug } });
  }

  create(data: Prisma.collectionsUncheckedCreateInput) {
    return prisma.collections.create({ data });
  }

  update(id: string, data: Prisma.collectionsUncheckedUpdateInput) {
    return prisma.collections.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.collections.delete({ where: { id } });
  }

  addImages(images: Prisma.collection_imagesUncheckedCreateInput[]) {
    return prisma.collection_images.createMany({ data: images });
  }

  findImageById(id: string) {
    return prisma.collection_images.findUnique({ where: { id } });
  }

  deleteImage(id: string) {
    return prisma.collection_images.delete({ where: { id } });
  }

  setThumbnail(collectionId: string, imageId: string) {
    return prisma.$transaction([
      prisma.collection_images.updateMany({
        where: { collectionId },
        data: { isThumbnail: false },
      }),
      prisma.collection_images.update({
        where: { id: imageId },
        data: { isThumbnail: true },
      }),
    ]);
  }

  reorder(items: { id: string; displayOrder: number }[]) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.collections.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
  }
}

export default new CollectionRepository();
