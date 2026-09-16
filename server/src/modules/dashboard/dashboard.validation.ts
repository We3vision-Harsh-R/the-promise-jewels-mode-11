import { z } from "zod";

import { DASHBOARD_PERIODS } from "./dashboard.constants.js";

/**
 * ============================
 * Dashboard Query
 * ============================
 *
 * Example:
 * GET /api/v1/dashboard?period=week
 *
 * Supported:
 * - week
 * - month
 * - year
 */

export const dashboardQuerySchema = z.object({
  period: z
    .enum(DASHBOARD_PERIODS)
    .default("week"),
});

export type DashboardQueryInput = z.infer<
  typeof dashboardQuerySchema
>;