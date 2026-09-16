import { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  accessProfileFor,
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from "./rbac.service.js";

class RbacController {
  /**
   * What the signed-in admin may do, plus the catalogue it is expressed in.
   *
   * The panel calls this once after sign-in and draws its navigation, its
   * routes and its buttons from the answer. It deliberately returns the
   * catalogue too, so the browser never keeps its own copy of what
   * permissions exist — see permissions.catalog.ts.
   */
  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ApiError(401, "Unauthorized.");

    const profile = await accessProfileFor(req.user.id);

    res
      .status(200)
      .json(new ApiResponse(true, "Access profile loaded", profile));
  });

  list = asyncHandler(async (_req: Request, res: Response) => {
    const roles = await listRoles();
    res.status(200).json(new ApiResponse(true, "Roles loaded", roles));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const role = await createRole(req.body);
    res.status(201).json(new ApiResponse(true, "Role created", role));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const role = await updateRole(String(req.params.id), req.body);
    res.status(200).json(new ApiResponse(true, "Role updated", role));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await deleteRole(String(req.params.id));
    res.status(200).json(new ApiResponse(true, "Role deleted", null));
  });
}

export default new RbacController();
