import { Prisma, SeoEntityType } from "@prisma/client";

import { prisma } from "../../database/prisma.js";

class SeoRepository {
  private readonly seoInclude = Prisma.validator<Prisma.SeoPageInclude>()({
    tags: {
      include: {
        seoTag: true,
      },
    },
  });

  async findAll() {
    return prisma.seoPage.findMany({
      include: this.seoInclude,

      orderBy: {
        displayName: "asc",
      },
    });
  }

  async findById(id: string) {
    return prisma.seoPage.findUnique({
      where: {
        id,
      },

      include: this.seoInclude,
    });
  }

  async findBySlug(slug: string) {
    return prisma.seoPage.findUnique({
      where: {
        slug,
      },

      include: this.seoInclude,
    });
  }

  async create(data: Prisma.SeoPageCreateInput) {
    return prisma.seoPage.create({
      data,

      include: this.seoInclude,
    });
  }

  async updatePage(id: string, data: Prisma.SeoPageUpdateInput) {
    return prisma.seoPage.update({
      where: {
        id,
      },

      data,

      include: this.seoInclude,
    });
  }

  async delete(id: string) {
    return prisma.seoPage.delete({
      where: {
        id,
      },
    });
  }

  async deleteByEntity(entityType: SeoEntityType, entityId: string) {
    return prisma.seoPage.deleteMany({
      where: {
        entityType,
        entityId,
      },
    });
  }

  async findTagsByNames(names: string[]) {
    return prisma.seoTag.findMany({
      where: {
        name: {
          in: names,
        },
      },
    });
  }

  async findPublishedPages() {
    return prisma.seoPage.findMany({
      where: {
        isPublished: true,
        includeInSitemap: true,
        isIndexed: true,
      },

      orderBy: {
        updatedAt: "desc",
      },

      select: {
        slug: true,
        updatedAt: true,
        priority: true,
        changeFrequency: true,
      },
    });
  }

  async findByEntity(entityType: SeoEntityType, entityId: string) {
    return prisma.seoPage.findFirst({
      where: {
        entityType,
        entityId,
      },

      include: this.seoInclude,
    });
  }

  async createTag(data: Prisma.SeoTagCreateInput) {
    return prisma.seoTag.create({
      data,
    });
  }

  async replaceTags(seoPageId: string, tagIds: string[]) {
    await prisma.$transaction(async (tx) => {
      await tx.seoPageTag.deleteMany({
        where: {
          seoPageId,
        },
      });

      if (!tagIds.length) {
        return;
      }

      await tx.seoPageTag.createMany({
        data: tagIds.map((seoTagId) => ({
          seoPageId,
          seoTagId,
        })),
      });
    });
  }

}

export default new SeoRepository();
