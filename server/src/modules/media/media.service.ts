import { randomUUID } from "node:crypto";

import mediaRepository from "./media.repository.js";
import { storageService } from "../../config/storage.service.js";
import { STORAGE_BUCKETS } from "../../config/storage.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { MEDIA_MESSAGES } from "./media.constants.js";

const BUCKET = STORAGE_BUCKETS.CMS;

/** Keeps object keys predictable and safe for a URL path. */
function buildStoragePath(originalName: string) {
  const safeName = originalName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-60);

  return `sections/${randomUUID()}-${safeName || "image"}`;
}

/**
 * The image library behind the Editor.
 *
 * Images used to be published from a page of their own, by pointing numbered
 * frames at library entries. Every picture on the site is an ordinary Editor
 * field now and page_content holds its URL, so this service stores the file
 * and returns where it landed — the Editor does the rest.
 */
class MediaService {
  listAssets() {
    return mediaRepository.listAssets();
  }

  async uploadAsset(file?: Express.Multer.File) {
    if (!file) {
      throw new ApiError(400, MEDIA_MESSAGES.NO_FILE);
    }

    const storagePath = buildStoragePath(file.originalname);

    const url = await storageService.uploadFile(
      BUCKET,
      storagePath,
      file.buffer,
      file.mimetype,
    );

    return mediaRepository.createAsset({
      url,
      storagePath,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    });
  }

  async deleteAsset(id: string) {
    const asset = await mediaRepository.findAssetById(id);

    if (!asset) {
      throw new ApiError(404, MEDIA_MESSAGES.NOT_FOUND);
    }

    // Storage cleanup is best-effort: a leftover object is harmless. Note
    // that a page still pointing at this image keeps its URL in
    // page_content — clear that field in the Editor to put the site's
    // original photograph back.
    await mediaRepository.deleteAsset(id);
    await storageService.deleteFileSafe(BUCKET, asset.storagePath);

    return { id };
  }
}

export default new MediaService();
