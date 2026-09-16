import { Request, Response } from "express";

import dashboardService from "./dashboard.service.js";

import {
  DASHBOARD_MESSAGES,
} from "./dashboard.constants.js";

import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

class DashboardController {
  /**
   * ============================
   * Admin Dashboard
   * ============================
   *
   * GET /api/v1/dashboard
   * GET /api/v1/dashboard?period=week
   * GET /api/v1/dashboard?period=month
   * GET /api/v1/dashboard?period=year
   */

  getDashboard = asyncHandler(
    async (req: Request, res: Response) => {
      const period = req.query.period as
        | "week"
        | "month"
        | "year"
        | undefined;

      const dashboard =
        await dashboardService.getDashboard(
          period,
        );

      return res.status(200).json(
        new ApiResponse(
          true,
          DASHBOARD_MESSAGES.FETCHED,
          dashboard,
        ),
      );
    },
  );
}

export default new DashboardController();