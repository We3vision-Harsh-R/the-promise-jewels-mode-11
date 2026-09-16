import { Request, Response } from "express";

import exhibitionService from "./exhibition.service.js";

import { ApiResponse } from "../../utils/ApiResponse.js";

import type {
  CreateExhibitionInput,
  UpdateExhibitionInput,
} from "./exhibition.validation.js";


export const exhibitionController = {

  async create(req: Request, res: Response) {
  const userId = req.user!.id;
  const body = req.body as CreateExhibitionInput;

  const exhibition = await exhibitionService.create(body, userId);

  if (req.file) {
    const result = await exhibitionService.uploadThumbnail(exhibition.id, req.file);
    exhibition.thumbnailUrl = result.thumbnailUrl;
  }

  return res.status(201).json(
    new ApiResponse(true, "Exhibition created successfully.", exhibition),
  );
},


  async findAll(
    req: Request,
    res: Response,
  ) {


    const {
      page = 1,
      limit = 20,
      featured,
      isActive,
      status,
    } = req.query;


    const result =
      await exhibitionService.findAll({
        page: Number(page),
        limit: Number(limit),
        featured:
          featured !== undefined
            ? featured === "true"
            : undefined,

        isActive:
          isActive !== undefined
            ? isActive === "true"
            : undefined,
        
            status:
            status === "upcoming" || status === "live" || status === "past"
            ? status
            : undefined,
            });


    return res.json(
      new ApiResponse(
        true,
        "Exhibitions fetched successfully.",
        result,
      ),
    );
  },


  async findOne(
    req: Request,
    res: Response,
  ) {


    const slug = String(req.params.slug);


    const exhibition =
      await exhibitionService.findOne(
        slug,
      );


    return res.json(
      new ApiResponse(
        true,
        "Exhibition fetched successfully.",
        exhibition,
      ),
    );
  },



  async update(req: Request, res: Response) {
  const id = String(req.params.id);
  const body = req.body as UpdateExhibitionInput;

  const exhibition = await exhibitionService.update(id, body);

  if (req.file) {
    const result = await exhibitionService.uploadThumbnail(exhibition.id, req.file);
    exhibition.thumbnailUrl = result.thumbnailUrl;
  }

  return res.json(
    new ApiResponse(true, "Exhibition updated successfully.", exhibition),
  );
},

  async remove(
    req: Request,
    res: Response,
  ) {


    const id = String(req.params.id);


    const result =
      await exhibitionService.remove(
        id,
      );


    return res.json(
      new ApiResponse(
        true,
        result.message,
      ),
    );
  },



  async search(
    req: Request,
    res: Response,
  ) {


    const {
      keyword,
      page = 1,
      limit = 20,
    } = req.query;


    const result =
      await exhibitionService.search(
        String(keyword),
        Number(page),
        Number(limit),
      );


    return res.json(
      new ApiResponse(
        true,
        "Search completed.",
        result,
      ),
    );
  },
async uploadGalleryImage(
 req:Request,
 res:Response
){

 const id = String(req.params.id);

 const file=req.file!;


 const image =
 await exhibitionService.uploadImage(
    id,
    file,
    req.body,
 );


 return res.status(201).json(
    new ApiResponse(
      true,
      "Gallery image uploaded successfully",
      image,
    )
 );

},



async uploadThumbnail(
 req:Request,
 res:Response
){

 const id = String(req.params.id);

 const image =
 await exhibitionService.uploadThumbnail(
    id,
    req.file!,
 );


 return res.json(
    new ApiResponse(
      true,
      "Thumbnail uploaded successfully",
      image,
    )
 );

},



async getGallery(
 req:Request,
 res:Response
){

 const id = String(req.params.id);


 const images =
 await exhibitionService.getGallery(id);


 return res.json(
   new ApiResponse(
    true,
    "Gallery fetched successfully",
    images,
   )
 );

},



async deleteGalleryImage(
 req:Request,
 res:Response
){

 const imageId = String(req.params.imageId);


 const result =
 await exhibitionService.deleteImage(
    imageId
 );


 return res.json(
    new ApiResponse(
      true,
      result.message
    )
 );

}

};