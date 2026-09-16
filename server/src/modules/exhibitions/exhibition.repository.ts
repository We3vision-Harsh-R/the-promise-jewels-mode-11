import { prisma } from "../../database/prisma.js";
import type { ExhibitionStatus } from "./exhibition.types.js";
class ExhibitionRepository {


  async create(data: any) {

    return prisma.exhibitions.create({
      data,
    });

  }

  async findById(id: string) {

    return prisma.exhibitions.findUnique({

      where:{
        id,
      },

      include:{

        exhibition_images:{
          orderBy:{
            displayOrder:"asc",
          },
        },


        exhibition_sections:{
          orderBy:{
            displayOrder:"asc",
          },
          include:{
            fields:{
              orderBy:{
                displayOrder:"asc",
              },
            },
          },
        },


        users:{
          select:{
            id:true,
            name:true,
            email:true,
          },
        },

      },

    });

  }


  async findBySlug(slug:string){

    return prisma.exhibitions.findUnique({

      where:{
        slug,
      },


      include:{

        exhibition_images:{
          orderBy:{
            displayOrder:"asc",
          },
        },


        exhibition_sections:{
          orderBy:{
            displayOrder:"asc",
          },
          include:{
            fields:{
              orderBy:{
                displayOrder:"asc",
              },
            },
          },
        },


        users:{
          select:{
            id:true,
            name:true,
            email:true,
          },
        },

      },

    });

  }

 async findAll(
  skip: number,
  take: number,
  featured?: boolean,
  isActive?: boolean,
  status?: ExhibitionStatus,
) {
  const now = new Date();

  return prisma.exhibitions.findMany({
    where: {
      ...(featured !== undefined && { featured }),
      ...(isActive !== undefined && { isActive }),

      ...(status === "upcoming" && {
        startDate: { gt: now },
      }),

      ...(status === "live" && {
        startDate: { lte: now },
        endDate: { gte: now },
      }),

      ...(status === "past" && {
        endDate: { lt: now },
      }),
    },

    include: {
      exhibition_images: true,
      exhibition_sections: {
        orderBy: { displayOrder: "asc" },
        include: { fields: { orderBy: { displayOrder: "asc" } } },
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    skip,
    take,
  });
}

async count(
  featured?: boolean,
  isActive?: boolean,
  status?: ExhibitionStatus,
) {
  const now = new Date();

  return prisma.exhibitions.count({
    where: {
      ...(featured !== undefined && { featured }),
      ...(isActive !== undefined && { isActive }),

      ...(status === "upcoming" && {
        startDate: { gt: now },
      }),

      ...(status === "live" && {
        startDate: { lte: now },
        endDate: { gte: now },
      }),

      ...(status === "past" && {
        endDate: { lt: now },
      }),
    },
  });
}

  async update(
    id:string,
    data:any,
  ){


    return prisma.exhibitions.update({

      where:{
        id,
      },


      data,

    });


  }


  /**
   * Replaces a show's custom sections wholesale.
   *
   * The admin panel edits the whole set in one frame and posts the result, so
   * a diff would be more machinery for no gain — and it is what makes
   * "remove a field, save" actually remove it. Deleting the sections cascades
   * to their fields (onDelete: Cascade), and the whole thing runs in one
   * transaction so a show is never left with its old sections gone and the new
   * ones not yet written.
   *
   * displayOrder is the array index, so the order typed in the admin is the
   * order rendered on the site.
   */
  async replaceSections(
    exhibitionId: string,
    sections: { title: string; fields: { label: string; value: string }[] }[],
  ) {
    return prisma.$transaction([
      prisma.exhibition_sections.deleteMany({
        where: { exhibitionId },
      }),

      ...sections.map((section, sectionIndex) =>
        prisma.exhibition_sections.create({
          data: {
            exhibitionId,
            title: section.title,
            displayOrder: sectionIndex,
            fields: {
              create: section.fields.map((field, fieldIndex) => ({
                label: field.label,
                value: field.value ?? "",
                displayOrder: fieldIndex,
              })),
            },
          },
        }),
      ),
    ]);
  }

  async delete(id:string){

    return prisma.exhibitions.delete({

      where:{
        id,
      },

    });

  }

  async search(
    keyword:string,
    skip:number,
    take:number,
  ){


    return prisma.exhibitions.findMany({

      where:{

        OR:[

          {
            title:{
              contains:keyword,
              mode:"insensitive",
            },
          },


          {
            venue:{
              contains:keyword,
              mode:"insensitive",
            },
          },


          {
            city:{
              contains:keyword,
              mode:"insensitive",
            },
          },

        ],

      },


      include:{

        exhibition_images:true,

        exhibition_sections:{
          orderBy:{ displayOrder:"asc" },
          include:{ fields:{ orderBy:{ displayOrder:"asc" } } },
        },

      },


      orderBy:{
        createdAt:"desc",
      },


      skip,

      take,

    });


  }

  async createGalleryImage(data:any){

    return prisma.exhibition_images.create({

      data,

    });

  }
  async getGallery(exhibitionId:string){


    return prisma.exhibition_images.findMany({

      where:{
        exhibitionId,
      },


      orderBy:{
        displayOrder:"asc",
      },

    });


  }

  async findGalleryImageById(id:string){

    return prisma.exhibition_images.findUnique({

      where:{
        id,
      },

    });

  }
  async deleteGalleryImage(id:string){


    return prisma.exhibition_images.delete({

      where:{
        id,
      },

    });


  }

  async updateThumbnail(
    id:string,
    thumbnailUrl:string,
  ){

    return prisma.exhibitions.update({

      where:{
        id,
      },


      data:{
        thumbnailUrl,
      },

    });
  }
}

export default new ExhibitionRepository();