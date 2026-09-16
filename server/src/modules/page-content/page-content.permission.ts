import { NextFunction, Request, Response } from "express";

import { requirePermission } from "../../middleware/permission.middleware.js";
import type { Action } from "../rbac/permissions.catalog.js";

/**
 * The right permission for whichever page is being edited.
 *
 * Content, Header and Footer are three separate screens in the panel and three
 * separate resources in the catalogue, but they are one endpoint: they all
 * write to `page_content` through `/page-content/:page`. A single
 * `content:edit` on that route would mean granting someone the Header screen
 * silently granted them every other page too — the opposite of per-screen
 * access.
 *
 * So the resource is chosen from the page being addressed. `header` and
 * `footer` are their own; everything else is `content`.
 *
 * The guards are built once, at module load, so a bad resource name still
 * fails at boot rather than at request time — the same guarantee
 * requirePermission gives everywhere else.
 */
const GUARDS: Record<string, Record<string, ReturnType<typeof requirePermission>>> = {
  header: {
    view: requirePermission("header", "view"),
    edit: requirePermission("header", "edit"),
  },
  footer: {
    view: requirePermission("footer", "view"),
    edit: requirePermission("footer", "edit"),
  },
  content: {
    view: requirePermission("content", "view"),
    edit: requirePermission("content", "edit"),
  },
};

function resourceFor(page: unknown): "header" | "footer" | "content" {
  if (page === "header") return "header";
  if (page === "footer") return "footer";
  return "content";
}

export function requirePagePermission(action: Extract<Action, "view" | "edit">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resource = resourceFor(req.params.page);
    // The guard is async; errors reach the error middleware through next(),
    // so there is nothing here to await or return.
    void GUARDS[resource][action](req, res, next);
  };
}

/**
 * The page LIST is not one page's data — it is the set of pages that exist, and
 * every Editor screen needs it to render its tab bar. Holding any one of the
 * three is enough to be told what the three are.
 */
export const requireAnyPageView = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const guards = [GUARDS.content.view, GUARDS.header.view, GUARDS.footer.view];

  let index = 0;

  const tryNext = (error?: unknown): void => {
    // A 403 from one guard is not the answer — it only means that page was not
    // the one they hold. The last failure is what stands.
    if (error && index >= guards.length) return next(error);
    if (!error && index > 0) return next();
    if (index >= guards.length) return next(error);

    const guard = guards[index];
    index += 1;
    guard(req, res, tryNext);
  };

  tryNext();
};
