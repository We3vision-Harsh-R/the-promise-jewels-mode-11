import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";

import { ApiError } from "../utils/ApiError.js";
import { logSecurityEvent } from "../utils/securityLog.js";

/**
 * Role checks, to sit behind requireAuth.
 *
 * Until now `requireAuth` WAS the entire authorisation system: there was no
 * role column, so every account that could sign in could do everything —
 * delete every brand, rewrite every page, export every enquiry, change the
 * site's contact details. That is the correct behaviour for the one admin
 * this site has today, and completely wrong the moment a second person is
 * given an account so they can write blog posts.
 *
 * Existing accounts default to ADMIN (see schema.prisma), so nothing changes
 * for anyone signing in today. What changes is that the capability now
 * exists, and destructive endpoints can name the role they require instead of
 * accepting anyone with a session.
 *
 * Deny by default: an unknown or missing role fails.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized."));
    }

    const role = (user as { role?: UserRole }).role;

    if (!role || !roles.includes(role)) {
      logSecurityEvent("authz.denied", {
        userId: user.id,
        role: role ?? "none",
        required: roles.join("|"),
        method: req.method,
        path: req.path,
      });

      return next(
        new ApiError(403, "Your account does not have access to that."),
      );
    }

    next();
  };
}

/** The full-access role. */
export const requireAdmin = requireRole(UserRole.ADMIN);
