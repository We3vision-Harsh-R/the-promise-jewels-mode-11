import { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prisma } from "../../database/prisma.js";
import * as ops from "./exhibition-ops.service.js";
import { OPTIONS } from "./exhibition-ops.types.js";

/** The show being operated on, from the URL. */
const showId = (req: Request) => req.params.exhibitionId as string;

/** The signed-in account, for the "who captured this" stamps. */
function actor(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new ApiError(401, "Unauthorized");
  return id;
}

class ExhibitionOpsController {
  /**
   * The lists the forms need: the enum choices, the accounts a lead or task
   * can be assigned to, and the collections a stock line can point at.
   *
   * Sent from the server so the panel cannot offer a value the API refuses.
   */
  options = asyncHandler(async (_req: Request, res: Response) => {
    const [users, collections] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.collections.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    res.status(200).json(new ApiResponse(true, "Options loaded", { ...OPTIONS, users, collections }));
  });

  /** Everything about one show's operations, plus the computed report. */
  get = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(true, "Loaded", await ops.getFull(showId(req))));
  });

  saveHeader = asyncHandler(async (req: Request, res: Response) => {
    res
      .status(200)
      .json(new ApiResponse(true, "Saved", await ops.saveHeader(showId(req), req.body)));
  });

  // ---- Leads ----
  createLead = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.createLead(showId(req), req.body, actor(req));
    res.status(201).json(new ApiResponse(true, "Lead added", row));
  });

  updateLead = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateLead(showId(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Lead saved", row));
  });

  deleteLead = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteLead(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Lead removed", null));
  });

  // ---- Costs ----
  createCost = asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(new ApiResponse(true, "Cost added", await ops.createCost(showId(req), req.body)));
  });

  updateCost = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateCost(showId(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Cost saved", row));
  });

  deleteCost = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteCost(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Cost removed", null));
  });

  // ---- Crew and shifts ----
  createCrew = asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(new ApiResponse(true, "Added", await ops.createCrew(showId(req), req.body)));
  });

  updateCrew = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateCrew(showId(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Saved", row));
  });

  deleteCrew = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteCrew(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Removed", null));
  });

  createShift = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.createShift(showId(req), req.params.crewId as string, req.body);
    res.status(201).json(new ApiResponse(true, "Shift added", row));
  });

  deleteShift = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteShift(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Shift removed", null));
  });

  // ---- Tasks ----
  createTask = asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(new ApiResponse(true, "Task added", await ops.createTask(showId(req), req.body)));
  });

  updateTask = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateTask(showId(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Task saved", row));
  });

  deleteTask = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteTask(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Task removed", null));
  });

  // ---- Documents ----
  createDocument = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.createDocument(showId(req), req.body, actor(req));
    res.status(201).json(new ApiResponse(true, "File added", row));
  });

  deleteDocument = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteDocument(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "File removed", null));
  });

  // ---- Daily log ----
  createLog = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.createLog(showId(req), req.body, actor(req));
    res.status(201).json(new ApiResponse(true, "Note added", row));
  });

  updateLog = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateLog(showId(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Note saved", row));
  });

  deleteLog = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteLog(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Note removed", null));
  });

  // ---- Inventory ----
  createInventory = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.createInventory(showId(req), req.body, actor(req));
    res.status(201).json(new ApiResponse(true, "Stock line added", row));
  });

  updateInventory = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateInventory(showId(req), req.params.id as string, req.body, actor(req));
    res.status(200).json(new ApiResponse(true, "Stock line saved", row));
  });

  deleteInventory = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteInventory(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Stock line removed", null));
  });

  // ---- Appointments ----
  createAppointment = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.createAppointment(showId(req), req.body);
    res.status(201).json(new ApiResponse(true, "Meeting added", row));
  });

  updateAppointment = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateAppointment(showId(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Meeting saved", row));
  });

  deleteAppointment = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteAppointment(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Meeting removed", null));
  });

  // ---- Custom fields ----
  createField = asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(new ApiResponse(true, "Field added", await ops.createField(showId(req), req.body)));
  });

  updateField = asyncHandler(async (req: Request, res: Response) => {
    const row = await ops.updateField(showId(req), req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Field saved", row));
  });

  deleteField = asyncHandler(async (req: Request, res: Response) => {
    await ops.deleteField(showId(req), req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Field removed", null));
  });
}

export default new ExhibitionOpsController();
