import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "storage/uploads");

const TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};
const MAX_BYTES = 8 * 1024 * 1024;

/** Stores an uploaded image and returns its public URL (/uploads/…). */
export async function saveImage(file: File) {
  const ext = TYPES[file.type];
  if (!ext) throw new Error(`${file.name}: only JPG, PNG, WebP, GIF or AVIF images are allowed`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: images must be smaller than 8 MB`);
  const base = path.parse(file.name).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";
  const name = `${base}-${randomBytes(4).toString("hex")}${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

export function contentTypeFor(file: string) {
  const ext = path.extname(file).toLowerCase();
  return Object.entries(TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}
