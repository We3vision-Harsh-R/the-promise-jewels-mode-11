import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";

import { getLive, getSummary, recordPing } from "./visitor.service.js";

// Mounted at /api/v1/visitors in routes/index.ts.
//
//   POST /visitors/ping      -> no auth, sent by the public website
//   GET  /visitors/live      -> admin, who is on the site right now
//   GET  /visitors/summary   -> admin, countries, pages and days
const router = Router();

/**
 * One visitor sends a ping on arrival, on each page change and every thirty
 * seconds while the tab is open — about two a minute. Forty leaves room for a
 * busy browsing session and for several people behind one office address,
 * while still stopping a script from filling the table.
 */
const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    // Tracking is never worth an error page; say nothing and move on.
    res.status(204).end();
  },
});

const pingSchema = z.object({
  sid: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  path: z.string().min(1).max(200).startsWith("/"),
  referrer: z.string().max(300).optional(),
});

router.post(
  "/ping",
  pingLimiter,
  validate(pingSchema),
  (req, res) => {
    const { sid, path, referrer } = req.body as z.infer<typeof pingSchema>;

    // The admin panel and the API are not "pages visitors view".
    if (!path.startsWith("/admin") && !path.startsWith("/api")) {
      recordPing({
        sid,
        path: path.split("?")[0].split("#")[0],
        referrer,
        userAgent: req.get("user-agent") ?? "",
        ip: req.ip ?? "",
      });
    }

    // Answered before anything is written: the visitor must never wait on this.
    res.status(204).end();
  },
);

router.use(requireAuth);

router.get(
  "/live",
  requirePermission("visitors", "view"),
  (_req, res) => {
    res.status(200).json(new ApiResponse(true, "Live visitors fetched.", getLive()));
  },
);

const summaryQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

router.get(
  "/summary",
  requirePermission("visitors", "view"),
  validate(summaryQuery, "query"),
  asyncHandler(async (req, res) => {
    const { days } = summaryQuery.parse(req.query);
    res.status(200).json(new ApiResponse(true, "Visitor summary fetched.", await getSummary(days)));
  }),
);

// Kept so an unexpected shape is a readable error, not a silent no-op.
router.use((_req, _res, next) => next(new ApiError(404, "Not found.")));

export default router;
