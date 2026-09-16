import { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/ApiError.js";
import { logSecurityEvent } from "../utils/securityLog.js";
import { permissionsFor } from "../modules/rbac/rbac.service.js";
import {
  type Action,
  findResource,
  permissionKey,
} from "../modules/rbac/permissions.catalog.js";

/** A guard that carries the permissions it enforces, so coverage is checkable. */
export type PermissionGuard = ((
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>) & { __permission: string[] };

/**
 * The server-side half of RBAC. Sits behind requireAuth.
 *
 * The browser hides what a role cannot use, but hiding a button is a courtesy,
 * not a control — the request it would have sent can still be made by hand.
 * This is where access is actually decided, and the two halves read the same
 * catalogue so they cannot disagree about what a permission is called.
 *
 * Deny by default, in every direction: no session, no role, no matching grant,
 * or a resource that is not in the catalogue at all, are all a 403.
 */
export function requirePermission(resource: string, action: Action) {
  // A typo in a route's permission name would otherwise fail open-ish — the
  // grant could never be held, so the route would 403 for everyone including
  // the master role, which reads as a bug in RBAC rather than in the route.
  // Fail at boot instead, when the module is loaded.
  const definition = findResource(resource);

  if (!definition) {
    throw new Error(
      `requirePermission: "${resource}" is not in the permission catalogue.`,
    );
  }

  if (!definition.actions.includes(action)) {
    throw new Error(
      `requirePermission: "${resource}" has no "${action}" action. It allows: ${definition.actions.join(", ")}.`,
    );
  }

  const required = permissionKey(resource, action);

  const guard = async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const user = req.user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized."));
    }

    try {
      const { permissions, roleName } = await permissionsFor(user.id);

      if (permissions.has(required)) return next();

      logSecurityEvent("authz.denied", {
        userId: user.id,
        role: roleName ?? "none",
        required,
        method: req.method,
        path: req.path,
      });

      // Deliberately vague: naming the permission tells an attacker the shape
      // of the model. The admin who hits this legitimately is told which
      // screen, which is enough to ask for access.
      return next(
        new ApiError(
          403,
          `Your role does not have access to ${definition.label}.`,
        ),
      );
    } catch (error) {
      return next(error);
    }
  };

  // Tagged so coverage can be checked rather than assumed. rbac.coverage.ts
  // walks the mounted router and reports any admin route with no tag on it —
  // which is what "did we remember to guard this one" looks like as a test
  // instead of as a hope.
  (guard as PermissionGuard).__permission = [required];

  return guard as PermissionGuard;
}

/**
 * Passes when the caller holds ANY of the listed permissions.
 *
 * For endpoints that serve more than one screen — the roles list is needed
 * both by the roles page and by the user form's role picker, and someone who
 * may create a user should not need permission to edit roles to see their
 * names.
 */
export function requireAnyPermission(
  ...pairs: Array<[resource: string, action: Action]>
) {
  const required = pairs.map(([resource, action]) => {
    const definition = findResource(resource);

    if (!definition || !definition.actions.includes(action)) {
      throw new Error(
        `requireAnyPermission: "${resource}:${action}" is not in the permission catalogue.`,
      );
    }

    return { key: permissionKey(resource, action), label: definition.label };
  });

  const guard = async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const user = req.user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized."));
    }

    try {
      const { permissions, roleName } = await permissionsFor(user.id);

      if (required.some((r) => permissions.has(r.key))) return next();

      logSecurityEvent("authz.denied", {
        userId: user.id,
        role: roleName ?? "none",
        required: required.map((r) => r.key).join("|"),
        method: req.method,
        path: req.path,
      });

      return next(
        new ApiError(403, "Your role does not have access to that."),
      );
    } catch (error) {
      return next(error);
    }
  };

  (guard as PermissionGuard).__permission = required.map((r) => r.key);

  return guard as PermissionGuard;
}
