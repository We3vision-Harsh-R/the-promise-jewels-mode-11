import { Request, Response } from "express";

import blogService from "./blog.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { BLOG_MESSAGES } from "./blog.constants.js";

class BlogController {
  // ---- Public ----

  listPublic = asyncHandler(async (_req: Request, res: Response) => {
    const posts = await blogService.listPublic();

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.FETCHED, posts));
  });

  getPublic = asyncHandler(async (req: Request, res: Response) => {
    const post = await blogService.getPublicBySlug(req.params.slug as string);

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.POST_FETCHED, post));
  });

  addComment = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.addComment(req.params.slug as string, req.body);

    res.status(201).json(new ApiResponse(true, result.message, result));
  });

  // ---- Admin: posts ----

  list = asyncHandler(async (req: Request, res: Response) => {
    const posts = await blogService.list(req.query.status as string | undefined);

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.FETCHED, posts));
  });

  getOne = asyncHandler(async (req: Request, res: Response) => {
    const post = await blogService.getById(req.params.id as string);

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.POST_FETCHED, post));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const post = await blogService.create(req.body);

    res.status(201).json(new ApiResponse(true, BLOG_MESSAGES.CREATED, post));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const post = await blogService.update(req.params.id as string, req.body);

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.UPDATED, post));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.remove(req.params.id as string);

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.DELETED, result));
  });

  // ---- Admin: comments ----

  listComments = asyncHandler(async (req: Request, res: Response) => {
    const comments = await blogService.listComments(
      req.query.status as string | undefined,
    );

    res
      .status(200)
      .json(new ApiResponse(true, BLOG_MESSAGES.COMMENTS_FETCHED, comments));
  });

  setCommentStatus = asyncHandler(async (req: Request, res: Response) => {
    const comment = await blogService.setCommentStatus(
      req.params.id as string,
      req.body.status,
    );

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.COMMENT_UPDATED, comment));
  });

  removeComment = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.removeComment(req.params.id as string);

    res.status(200).json(new ApiResponse(true, BLOG_MESSAGES.COMMENT_DELETED, result));
  });
}

export default new BlogController();
