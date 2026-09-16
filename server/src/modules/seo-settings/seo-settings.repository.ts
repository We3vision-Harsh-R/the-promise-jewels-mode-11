import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";

class SeoSettingsRepository {
  async get() {
    return prisma.seoSettings.findFirst({
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async create(data: Prisma.SeoSettingsCreateInput) {
    return prisma.seoSettings.create({
      data,
    });
  }

  async update(id: string, data: Prisma.SeoSettingsUpdateInput) {
    return prisma.seoSettings.update({
      where: {
        id,
      },
      data,
    });
  }
}

export default new SeoSettingsRepository();
