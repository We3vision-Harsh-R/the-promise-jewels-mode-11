import { Request, Response } from "express";

import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createUser, deleteUser, listUsers, updateUser } from "./user.service.js";

class UserController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const users = await listUsers();
    res.status(200).json(new ApiResponse(true, "Accounts loaded", users));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const user = await createUser(req.body);
    res.status(201).json(new ApiResponse(true, "Account created", user));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ApiError(401, "Unauthorized.");

    const user = await updateUser(String(req.params.id), req.body, req.user.id);
    res.status(200).json(new ApiResponse(true, "Account updated", user));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ApiError(401, "Unauthorized.");

    await deleteUser(String(req.params.id), req.user.id);
    res.status(200).json(new ApiResponse(true, "Account deleted", null));
  });
}

export default new UserController();
