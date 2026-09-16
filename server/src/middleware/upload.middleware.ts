import { NextFunction, Request, RequestHandler, Response } from "express";
import { uploadLimiter } from "../config/rateLimit.js";
import multer from "multer";

import { ApiError } from "../utils/ApiError.js";
import { verifyUploads } from "./fileSecurity.middleware.js";

// Files are held in memory and streamed straight to Supabase Storage, so
// nothing is ever written to the server's filesystem — which is what makes
// path traversal through a filename structurally impossible here rather than
// merely guarded against.
const storage = multer.memoryStorage();

/**
 * The declared type, checked early so an obviously wrong file is rejected
 * before it is read into memory.
 *
 * This is NOT the real check. The Content-Type in a multipart part is written
 * by whoever is uploading, so a hostile client simply lies. The authoritative
 * check reads the file's own bytes and lives in fileSecurity.middleware.ts,
 * which runs immediately after multer on every route below. This filter's
 * only job is to fail the cheap cases early.
 *
 * SVG is accepted because the footer's ticker icon has to be a vector for its
 * colour to be settable from the admin panel. Every SVG is scrubbed by that
 * same middleware before any module can store it.
 */
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return callback(
      new ApiError(400, "Only JPG, PNG, WEBP and SVG images are allowed"),
    );
  }

  callback(null, true);
};

const LIMITS = {
  fileSize: 5 * 1024 * 1024,
  // A ceiling on the WHOLE request, not just one part. Without it, "10 files
  // at 5MB" is a 50MB allocation in process memory from a single request.
  files: 12,
  // Non-file fields are small by nature; a multipart body claiming thousands
  // of them is not a form submission.
  fields: 40,
  parts: 60,
};

const upload = multer({ storage, fileFilter, limits: LIMITS });

/**
 * Turns multer's own errors into the shapes the API uses.
 *
 * Left alone, a file over the size limit becomes a MulterError that the
 * global handler does not recognise, so the client saw a bare 500 and the log
 * filled with a stack trace for what is really a 413.
 */
function handleUploadErrors(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        const messages: Record<string, { status: number; message: string }> = {
          LIMIT_FILE_SIZE: { status: 413, message: "That image is over 5 MB." },
          LIMIT_FILE_COUNT: { status: 413, message: "Too many files at once." },
          LIMIT_PART_COUNT: { status: 413, message: "That request is too large." },
          LIMIT_FIELD_COUNT: { status: 413, message: "That request is too large." },
          LIMIT_UNEXPECTED_FILE: {
            status: 400,
            message: `Unexpected file field "${error.field ?? ""}".`,
          },
        };

        const mapped = messages[error.code] ?? {
          status: 400,
          message: "That upload could not be read.",
        };

        return next(new ApiError(mapped.status, mapped.message));
      }

      next(error);
    });
  };
}

/**
 * Each export is the rate limit, THEN multer, THEN the content check, as one
 * array.
 *
 * Composing them here rather than asking every route to remember all three is
 * the point: the throttle, the byte-level validation and the SVG scrubbing
 * cannot be omitted by a route that forgets, because there is no way to reach
 * multer without them.
 *
 * The limiter goes FIRST deliberately. Behind multer it would only start
 * counting after a 5 MB body had already been read into memory and scanned,
 * which is the expensive part — the cost it exists to cap.
 */
export const uploadImage: RequestHandler[] = [
  uploadLimiter,
  handleUploadErrors(upload.single("image")),
  verifyUploads,
];

// Brand: logo (1), banner (1), gallery (up to 10)
export const uploadBrandImages: RequestHandler[] = [
  uploadLimiter,
  handleUploadErrors(
    upload.fields([
      { name: "logo", maxCount: 1 },
      { name: "banner", maxCount: 1 },
      { name: "images", maxCount: 10 },
    ]),
  ),
  verifyUploads,
];

// Collection: banner (1), gallery (up to 10)
export const uploadCollectionImages: RequestHandler[] = [
  uploadLimiter,
  handleUploadErrors(
    upload.fields([
      { name: "banner", maxCount: 1 },
      { name: "images", maxCount: 10 },
    ]),
  ),
  verifyUploads,
];
