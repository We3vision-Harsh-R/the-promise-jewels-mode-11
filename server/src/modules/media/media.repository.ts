import { prisma } from "../../database/prisma.js";

class MediaRepository {
  listAssets() {
    return prisma.media_assets.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  findAssetById(id: string) {
    return prisma.media_assets.findUnique({ where: { id } });
  }

  createAsset(data: {
    url: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }) {
    return prisma.media_assets.create({ data });
  }

  deleteAsset(id: string) {
    return prisma.media_assets.delete({ where: { id } });
  }
}

export default new MediaRepository();
