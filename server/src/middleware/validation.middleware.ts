import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

type ValidationTarget = "body" | "query" | "params";

/**
 * Where a validated value is stored afterwards.
 *
 * In Express 5 `req.query` is a lazily-computed GETTER with no setter, so the
 * old `Object.assign(req.query, result.data)` wrote into a throwaway object
 * and every coercion, default and trim the schema performed was discarded —
 * the handler still read the raw strings. The parsed result is kept on the
 * request under its own key instead, and `validatedQuery` reads it back.
 */
const VALIDATED = Symbol.for("pj.validated");

type WithValidated = Request & {
  [VALIDATED]?: Partial<Record<ValidationTarget, unknown>>;
};

export const validate =
  <T>(schema: ZodType<T>, target: ValidationTarget = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      next(result.error);
      return;
    }

    const request = req as WithValidated;

    request[VALIDATED] = { ...request[VALIDATED], [target]: result.data };

    // The body is a plain writable property, so the parsed value replaces it
    // outright. This is what strips undeclared keys before they can reach a
    // Prisma create or update — the defence against mass assignment.
    if (target === "body") {
      req.body = result.data;
    } else if (target === "params") {
      Object.assign(req.params, result.data);
    }

    next();
  };

/**
 * The parsed query for a route that ran `validate(schema, "query")`.
 *
 * Falls back to the raw query so a handler that reaches for this on a route
 * without validation still works rather than reading undefined.
 */
export function validatedQuery<T>(req: Request): T {
  const stored = (req as WithValidated)[VALIDATED]?.query;

  return (stored ?? req.query) as T;
}

/**
 * Collapses duplicated query parameters.
 *
 * `?status=a&status=b` makes Express hand the handler an ARRAY where every
 * caller expects a string, and those values flow into Prisma `where` clauses.
 * Prisma rejects an array where it wants a string and the request became an
 * unauthenticated 500 with a stack trace in the log — a free way to fill the
 * logs, and a probe for what the query layer is. Taking the last value is
 * what a single-valued parameter is normally understood to mean.
 *
 * Mounted before the routes, so no handler has to think about it.
 */
export function normaliseQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const query = req.query as Record<string, unknown>;
  let changed = false;
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      flattened[key] = value[value.length - 1];
      changed = true;
    } else {
      flattened[key] = value;
    }
  }

  if (changed) {
    // req.query is getter-only in Express 5, so it is redefined rather than
    // assigned to.
    Object.defineProperty(req, "query", {
      value: flattened,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }

  next();
}
