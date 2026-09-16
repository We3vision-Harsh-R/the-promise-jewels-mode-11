import { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import * as vault from "./secure-notes.service.js";
import { NOTE_KINDS } from "./secure-notes.types.js";
import { vaultIsConfigured } from "../../utils/secureBox.js";

/**
 * The owner, taken from the session and from nowhere else.
 *
 * Every handler below reads the owner through this. There is no route
 * parameter, query string or body field anywhere in this module that names an
 * account — which is what makes "you can only ever see your own" a property of
 * the code rather than a rule someone has to remember.
 */
function ownerOf(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new ApiError(401, "Unauthorized");
  return id;
}

class SecureNotesController {
  /** What the screen needs to render its form, plus whether the vault works. */
  options = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(
      new ApiResponse(true, "Options loaded", {
        kinds: NOTE_KINDS,
        configured: vaultIsConfigured(),
      }),
    );
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const entries = await vault.listFor(ownerOf(req));
    res.status(200).json(new ApiResponse(true, "Vault loaded", entries));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const entry = await vault.createFor(ownerOf(req), req.body);
    res.status(201).json(new ApiResponse(true, "Saved", entry));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const entry = await vault.updateFor(ownerOf(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Saved", entry));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await vault.removeFor(ownerOf(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Deleted", null));
  });
}

export default new SecureNotesController();
