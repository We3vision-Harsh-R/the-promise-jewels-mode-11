import { NextFunction, Request, Response } from "express";
import sharp from "sharp";

import { logger } from "../utils/logger.js";

/**
 * Shrinks every uploaded photograph before it is stored.
 *
 * Cameras and phones hand over 2000-4000 pixel originals of several megabytes.
 * Nobody on the website sees more than about 1600 pixels of one, so storing the
 * original only makes every page that shows it slower to load. Each JPG, PNG
 * or WEBP is turned (once, here) into a WEBP no larger than MAX_SIDE pixels on
 * its longest side, with its phone-rotation applied and its metadata (GPS
 * position, camera, owner) removed.
 *
 * Runs AFTER verifyUploads, so it only ever sees files whose bytes have been
 * confirmed as the image type they claim. SVG is left alone — it is a vector,
 * and it has already been scrubbed there. If a file cannot be processed the
 * original is stored as it was: a picture slightly larger than ideal is better
 * than an upload that fails for no reason the person can act on.
 */

const MAX_SIDE = 2000;
const QUALITY = 82;
const CONVERTIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

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

async function optimise(file: Express.Multer.File): Promise<void> {
  if (!CONVERTIBLE.has(file.mimetype)) return;

  try {
    const output = await sharp(file.buffer, { failOn: "error" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();

    // Keep the original when it was already the smaller of the two.
    if (output.length >= file.buffer.length && file.mimetype === "image/webp") return;

    file.buffer = output;
    file.size = output.length;
    file.mimetype = "image/webp";
    file.originalname = file.originalname.replace(/\.[A-Za-z0-9]+$/, "") + ".webp";
  } catch (error) {
    logger.warn(`Image could not be optimised, stored as uploaded: ${(error as Error).message}`);
  }
}

export async function optimiseUploads(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await Promise.all(collectFiles(req).map(optimise));
    next();
  } catch (error) {
    next(error);
  }
}
