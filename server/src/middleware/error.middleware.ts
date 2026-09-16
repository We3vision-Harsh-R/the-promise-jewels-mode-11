import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const isProduction = env.NODE_ENV === "production";

/**
 * The single place an error becomes a response.
 *
 * The rule: the CLIENT gets a sentence it can act on, the SERVER LOG gets
 * everything. An error object carries a stack trace, file paths, SQL, table
 * and column names and sometimes the values that were being written — all of
 * which is a map of the system for anyone probing it, and none of which helps
 * the person who just filled in a form.
 *
 * Errors this application raised itself (ApiError) are safe to show, because
 * every one of those messages was written to be read. Everything else — a
 * Prisma failure, a TypeError, a thrown string from a library — is reported
 * as a generic 500 with a reference the log can be searched by.
 */
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Zod: the field names and the reason are the point of the message, and
  // they are all authored by our own schemas.
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: err.flatten(),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // A payload over the body-parser limit arrives as a plain Error with this
  // type. Left unhandled it becomes an unexplained 500.
  if ((err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({
      success: false,
      message: "That request is too large.",
      errors: null,
    });
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      success: false,
      message: "That request body is not valid JSON.",
      errors: null,
    });
    return;
  }

  // The database is unreachable, or refused the connection.
  //
  // This is NOT a KnownRequestError, so before this branch existed it fell
  // through to the catch-all below — which in development echoes the raw
  // message. Prisma writes that message for a terminal: it carries the
  // absolute path of the file that made the query, the surrounding source
  // lines, and the database hostname. All of that was being rendered on the
  // sign-in page, to anyone who could reach it.
  //
  // 503, not 500: nothing is wrong with the request, the database is simply
  // not answering, and a caller that retries later is doing the right thing.
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error("[DB] unreachable", err.errorCode ?? "", err.message);

    res.status(503).json({
      success: false,
      message:
        "Cannot reach the database right now. Try again in a moment — if it " +
        "keeps happening, the database may be paused or unreachable.",
      errors: null,
    });
    return;
  }

  // Prisma's messages quote the failing query, the model and often the value
  // that collided, so the CODE is translated and the message is dropped.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const known: Record<string, { status: number; message: string }> = {
      P2002: { status: 409, message: "That already exists." },
      P2025: { status: 404, message: "That record does not exist." },
      P2003: { status: 409, message: "Something else still refers to that." },
      P2000: { status: 400, message: "One of those values is too long." },
      // Every connection in the pool is busy. Same answer as unreachable
      // from the caller's side: nothing is wrong with what they asked for.
      P2024: {
        status: 503,
        message: "The database is busy. Try again in a moment.",
      },
    };

    const mapped = known[err.code];

    logger.error("[DB]", err.code, err.message);

    res.status(mapped?.status ?? 500).json({
      success: false,
      message: mapped?.message ?? "Something went wrong.",
      errors: null,
    });
    return;
  }

  // Anything unrecognised. A short reference goes to both sides so a report
  // of "I saw an error" can be tied to a specific log line without the user
  // ever being shown the detail.
  const reference = Math.random().toString(36).slice(2, 10);

  logger.error(
    "[UNHANDLED]",
    JSON.stringify({
      reference,
      method: req.method,
      path: req.path,
      message: err?.message,
    }),
    err?.stack,
  );

  res.status(500).json({
    success: false,
    message: isProduction
      ? `Something went wrong. Reference ${reference}.`
      : `${redact(err?.message) ?? "Unknown error"} (reference ${reference})`,
    errors: null,
  });
};

/**
 * Strips absolute paths out of a message before it can leave the server.
 *
 * Only the development branch above sends an internal message at all, and
 * that is worth keeping — it is what makes a local 500 diagnosable without
 * switching to the terminal. But "development" includes a laptop with the
 * panel open on a shared screen, and a message naming
 * `D:\Harsh\The-Promise-Jewels mode 10\server\src\...` tells a reader the
 * project layout, the machine's directory structure and the developer's name.
 * The sentence is still useful without any of that.
 */
/** Exported for error.middleware.selftest.ts only. Nothing else should call it. */
export const redactForTest = (message?: string) => redact(message);

function redact(message?: string): string | undefined {
  if (!message) return message;

  return message
    // Windows: C:\foo\bar\baz.ts -> baz.ts
    //
    // The class stops at a newline or a quote, NOT at whitespace: this very
    // project lives in "…\The-Promise-Jewels mode 10\…", and a pattern that
    // gave up at the first space left the whole path in place — which is
    // exactly the string that reached the sign-in page.
    .replace(/[A-Za-z]:[\\/][^\n"'`]*[\\/]([\w.-]+)/g, "$1")
    // POSIX: /foo/bar/baz.ts -> baz.ts
    .replace(/(?:\/[\w.-]+)+\/([\w.-]+)/g, "$1")
    .trim();
}
