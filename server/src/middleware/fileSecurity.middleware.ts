import { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/ApiError.js";
import { isSvg, sanitizeSvg } from "../utils/sanitizeSvg.js";
import { logSecurityEvent } from "../utils/securityLog.js";

/**
 * Everything that must be true of an uploaded file, enforced in ONE place.
 *
 * multer's `fileFilter` only ever sees the Content-Type the CLIENT typed into
 * the multipart part. That is not a fact about the file, it is a claim by the
 * uploader, and it was the only check the application made.
 *
 * Worse, sanitising was being done per-module: media.service.ts scrubbed SVGs
 * on its own upload path, but brands, collections and exhibitions each call
 * storageService.uploadFile() directly and never went near it. Once SVG was
 * added to the allowed types, those three routes would store a `<script>`-
 * bearing SVG verbatim in a PUBLIC bucket, where opening its URL executes it
 * on the storage origin. A control that has to be remembered in four places
 * is a control that is missing from at least one.
 *
 * So it moves here, into middleware that every upload route already runs:
 *
 *   1. The real type is read from the file's own leading bytes.
 *   2. The claimed type must agree with the real one.
 *   3. SVGs are scrubbed, and the buffer is REPLACED with the clean version,
 *      so no downstream caller can accidentally store the original.
 */

/** Leading bytes that identify each format we accept. */
const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: "image/jpeg",
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    // "RIFF" .... "WEBP"
    mime: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
];

/**
 * SVG is XML, so it has no magic number. It is identified structurally
 * instead: within the first stretch of the file, ignoring a BOM, an XML
 * declaration, comments and a doctype, there must be an `<svg` element.
 */
function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.toString("utf8", 0, Math.min(buffer.length, 2048));

  return /<svg[\s>]/i.test(head);
}

function detectType(buffer: Buffer): string | null {
  const match = SIGNATURES.find((signature) => signature.test(buffer));

  if (match) return match.mime;

  return looksLikeSvg(buffer) ? "image/svg+xml" : null;
}

/** Every file on the request, whether multer put it on .file or .files. */
function collectFiles(req: Request): Express.Multer.File[] {
  const files: Express.Multer.File[] = [];

  if (req.file) files.push(req.file);

  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    for (const group of Object.values(req.files)) {
      if (Array.isArray(group)) files.push(...group);
    }
  }

  return files;
}

export function verifyUploads(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const files = collectFiles(req);

  if (files.length === 0) return next();

  for (const file of files) {
    if (!file.buffer || file.buffer.length === 0) {
      return next(new ApiError(400, "That file is empty."));
    }

    const actual = detectType(file.buffer);

    if (!actual) {
      logSecurityEvent("upload.rejected", {
        reason: "unrecognised content",
        claimed: file.mimetype,
        field: file.fieldname,
        ip: req.ip,
      });

      return next(
        new ApiError(400, "That file is not a JPG, PNG, WEBP or SVG image."),
      );
    }

    // The claim has to match the content. A PNG renamed and relabelled as a
    // WEBP is harmless; an SVG full of script relabelled as a PNG is not,
    // because it would skip the scrubbing below and then be served with a
    // Content-Type the browser is willing to sniff past.
    if (file.mimetype !== actual) {
      logSecurityEvent("upload.rejected", {
        reason: "declared type does not match content",
        claimed: file.mimetype,
        actual,
        field: file.fieldname,
        ip: req.ip,
      });

      return next(
        new ApiError(
          400,
          "That file's contents do not match the type it was sent as.",
        ),
      );
    }

    if (isSvg(actual)) {
      // Replaced, not merely checked. Every caller downstream — media,
      // brands, collections, exhibitions — uploads `file.buffer`, so
      // overwriting it here is what guarantees none of them can store the
      // original by forgetting to ask.
      file.buffer = sanitizeSvg(file.buffer);
      file.size = file.buffer.length;
    }
  }

  next();
}
