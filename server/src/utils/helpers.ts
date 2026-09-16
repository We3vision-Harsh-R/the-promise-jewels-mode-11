import crypto from "crypto";
import fs from "fs";

export function generateId(): string {
  return crypto.randomUUID();
}

export function buildUniqueSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function removeUploadedFile(filePath?: string) {
  if (!filePath) return;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}


export function getParam(value: string | string[] | undefined): string {
  if (!value) {
    throw new Error("Missing route parameter.");
  }

  return Array.isArray(value) ? value[0] : value;
}
