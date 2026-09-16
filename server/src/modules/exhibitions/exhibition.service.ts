import exhibitionRepository from "./exhibition.repository.js";
import { STORAGE_BUCKETS } from "../../config/storage.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { slugify,withUniqueSuffix,} from "../../utils/slugify.js";
import { CreateExhibitionInput, UpdateExhibitionInput,} from "./exhibition.validation.js";
import { storageService } from "../../config/storage.service.js";
import { SeoEntityType } from "@prisma/client";
import seoService from "../seo/seo.service.js";
import type { ExhibitionStatus } from "./exhibition.types.js";

function getExhibitionStatus(startDate: Date, endDate: Date): ExhibitionStatus {
  const now = new Date();

  if (now < startDate) return "upcoming";
  if (now > endDate) return "past";
  return "live";
}

function withStatus<T extends { startDate: Date; endDate: Date }>(exhibition: T) {
  return {
    ...exhibition,
    status: getExhibitionStatus(exhibition.startDate, exhibition.endDate),
  };
}
class ExhibitionService {
  async create(
    input: CreateExhibitionInput,
    userId: string,
  ) {
    let slug = slugify(input.title);

    const existingSlug =
      await exhibitionRepository.findBySlug(slug);

    if (existingSlug) {
      slug = withUniqueSuffix(slug);
    }

    // customSections are rows in their own tables now, not a column on this
    // one — pulled out here so Prisma is not handed a field the model no
    // longer writes.
    const { customSections, ...columns } = input;

    const exhibition = await exhibitionRepository.create({
      ...columns,
      slug,
      createdBy: userId,
      updatedAt: new Date(),
    });

    if (customSections?.length) {
      await exhibitionRepository.replaceSections(exhibition.id, customSections);
    }

    await seoService.createDefaultSeo({
      displayName: exhibition.title,
      slug: exhibition.slug,
      entityType: SeoEntityType.EXHIBITION,
      entityId: exhibition.id,
    });

    // Re-read so the response carries the sections that were just written —
    // the create above cannot include a relation it did not create.
    return withStatus(
      (await exhibitionRepository.findById(exhibition.id)) ?? exhibition,
    );
  }

  async findAll(params: {
    page: number;
    limit: number;
    featured?: boolean;
    isActive?: boolean;
    status?: ExhibitionStatus;
  }) {
    const {
      page,
      limit,
      featured,
      isActive,
      status,
    } = params;

    const skip = (page - 1) * limit;

    const items =
      await exhibitionRepository.findAll(
        skip,
        limit,
        featured,
        isActive,
        status,
      );

    const total =
      await exhibitionRepository.count(
        featured,
        isActive,
        status,
      );

    return {
      items: items.map(withStatus),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(slug: string) {
    const exhibition =
      await exhibitionRepository.findBySlug(slug);

    if (!exhibition) {
      throw new ApiError(
        404,
        "Exhibition not found",
      );
    }

   return withStatus(exhibition);
  }

  async update(
    id: string,
    input: UpdateExhibitionInput,
  ) {
    const exhibition =
      await exhibitionRepository.findById(id);

    if (!exhibition) {
      throw new ApiError(
        404,
        "Exhibition not found",
      );
    }

    // Same split as create(): sections are their own tables.
    const { customSections, ...columns } = input;

    const data: Record<string, unknown> = {
      ...columns,
    };

  if (input.title) {
  const baseSlug = slugify(input.title);
  const existing = await exhibitionRepository.findBySlug(baseSlug);

  data.slug =
    existing && existing.id !== id
      ? withUniqueSuffix(baseSlug)
      : baseSlug;
}
    const updatedExhibition = await exhibitionRepository.update(id, data);

    // Only when the key was actually sent. A PATCH that does not mention
    // customSections must leave them alone — passing [] would wipe them.
    if (customSections !== undefined) {
      await exhibitionRepository.replaceSections(id, customSections);
    }

    await seoService.updateByEntity(
      SeoEntityType.EXHIBITION,
      updatedExhibition.id,
      {
        displayName: updatedExhibition.title,
        slug: updatedExhibition.slug,
      },
    );

  // Re-read for the same reason as create(): the update() call above does
  // not include the sections relation.
  return withStatus(
    (await exhibitionRepository.findById(id)) ?? updatedExhibition,
  );
  }

  async remove(id: string) {
    const exhibition =
      await exhibitionRepository.findById(id);

    if (!exhibition) {
      throw new ApiError(
        404,
        "Exhibition not found",
      );
    }

    await exhibitionRepository.delete(id);

    await seoService.deleteByEntity(SeoEntityType.EXHIBITION, id);

    return {
      message:
        "Exhibition deleted successfully",
    };
  }

  async search(
    keyword: string,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;

    const items =
      await exhibitionRepository.search(
        keyword,
        skip,
        limit,
      );

    return {
      items,
      page,
      limit,
    };
  }

  async getGallery(exhibitionId: string) {
    const exhibition =
      await exhibitionRepository.findById(
        exhibitionId,
      );

    if (!exhibition) {
      throw new ApiError(
        404,
        "Exhibition not found",
      );
    }

    return exhibitionRepository.getGallery(
      exhibitionId,
    );
  }

  async deleteImage(imageId: string) {
    await exhibitionRepository.deleteGalleryImage(
      imageId,
    );

    return {
      message:
        "Image deleted successfully",
    };
  }
  async uploadImage(
    exhibitionId:string,
    file:Express.Multer.File,
    data:{
        altText?:string;
        caption?:string;
    }
){

    const exhibition =
        await exhibitionRepository.findById(
            exhibitionId,
        );


    if(!exhibition){

        throw new ApiError(
            404,
            "Exhibition not found",
        );

    }



    const path =
    `exhibitions/gallery/${exhibitionId}/${Date.now()}-${file.originalname}`;



    const imageUrl =
        await storageService.uploadFile(
            STORAGE_BUCKETS.EXHIBITIONS,
            path,
            file.buffer,
            file.mimetype
        );



    const image =
        await exhibitionRepository.createGalleryImage({

            exhibitionId,

            imageUrl,

            altText:
            data.altText ?? exhibition.title,

            caption:
            data.caption,

        });



    return image;

}
async uploadThumbnail(
    exhibitionId:string,
    file:Express.Multer.File,
){

const exhibition =
await exhibitionRepository.findById(
    exhibitionId,
);

if(!exhibition){

throw new ApiError(
404,
"Exhibition not found"
);

}

const path =
`exhibitions/thumbnails/${exhibitionId}/${Date.now()}-${file.originalname}`;

const imageUrl =
await storageService.uploadFile(
    STORAGE_BUCKETS.EXHIBITIONS,
    path,
    file.buffer,
    file.mimetype
);

await exhibitionRepository.updateThumbnail(
exhibitionId,
imageUrl,
);

return {
thumbnailUrl:imageUrl,
};

}
}

export default new ExhibitionService();