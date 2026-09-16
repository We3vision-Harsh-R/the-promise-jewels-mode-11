import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

class BrandRepository {
  // ---- Public (website) ----

  findAllActive() {
    return prisma.brands.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        brand_images: { orderBy: { displayOrder: "asc" } },
      },
    });
  }

  findBySlugActive(slug: string) {
    return prisma.brands.findFirst({
      where: { slug, isActive: true },
      include: {
        brand_images: { orderBy: { displayOrder: "asc" } },
        collections: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          include: {
            collection_images: {
              where: { isThumbnail: true },
              take: 1,
            },
          },
        },
      },
    });
  }

  // ---- Admin ----

 findAllAdmin(params: { search?: string; isActive?: boolean; skip: number; take: number }) {
    const where: Prisma.brandsWhereInput = {
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    };
    
    return Promise.all([
      prisma.brands.findMany({
        where,
        orderBy: { displayOrder: "asc" },
        skip: params.skip,
        take: params.take,
        include: {
          brand_images: { orderBy: { displayOrder: "asc" } },
          _count: { select: { collections: true } },
        },
      }),
      prisma.brands.count({ where }),
    ]);
  }

  findById(id: string) {
    return prisma.brands.findUnique({
      where: { id },
      include: {
        brand_images: { orderBy: { displayOrder: "asc" } },
      },
    });
  }

  findBySlug(slug: string) {
    return prisma.brands.findUnique({ where: { slug } });
  }

  countCollections(brandId: string) {
    return prisma.collections.count({ where: { brandId } });
  }

  listOptions() {
    return prisma.brands.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }

  create(data: Prisma.brandsUncheckedCreateInput) {
    return prisma.brands.create({ data });
  }

  update(id: string, data: Prisma.brandsUncheckedUpdateInput) {
    return prisma.brands.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.brands.delete({ where: { id } });
  }

  addImages(images: Prisma.brand_imagesUncheckedCreateInput[]) {
    return prisma.brand_images.createMany({ data: images });
  }

  findImageById(id: string) {
    return prisma.brand_images.findUnique({ where: { id } });
  }

  deleteImage(id: string) {
    return prisma.brand_images.delete({ where: { id } });
  }

  reorder(items: { id: string; displayOrder: number }[]) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.brands.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
  }
}

export default new BrandRepository();
