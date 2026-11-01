import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "storage/uploads");

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

// ---------- private files (request attachments, workshop downloads) ----------

/** Outside UPLOAD_DIR: never served directly, only through routes that check who is asking. */
export const PRIVATE_DIR = path.resolve(/* turbopackIgnore: true */ process.env.PRIVATE_DIR ?? path.join(UPLOAD_DIR, "..", "private"));

const PRIVATE_TYPES: Record<string, string> = {
  ...TYPES,
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
};
const PRIVATE_CONTENT_TYPES = Object.fromEntries(Object.entries(PRIVATE_TYPES).map(([type, ext]) => [ext, type]));

export class UploadError extends Error {
  constructor(public code: "type" | "size", public fileName: string) {
    super(`${fileName}: ${code}`);
  }
}

/**
 * Stores a private file under PRIVATE_DIR/<folder> and returns its path relative to PRIVATE_DIR.
 * The extension comes from the checked MIME type, never from the uploaded name.
 */
export async function savePrivateFile(file: File, folder: string, { maxBytes, types }: { maxBytes: number; types?: string[] }) {
  const ext = PRIVATE_TYPES[file.type] ?? (file.type === "" && /\.(heic|heif)$/i.test(file.name) ? ".heic" : undefined);
  if (!ext || (types && !types.includes(ext))) throw new UploadError("type", file.name);
  if (file.size > maxBytes) throw new UploadError("size", file.name);
  const base = path.parse(file.name).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "file";
  const relative = path.join(folder, `${base}-${randomBytes(6).toString("hex")}${ext}`);
  await fs.mkdir(path.join(PRIVATE_DIR, folder), { recursive: true });
  await fs.writeFile(path.join(PRIVATE_DIR, relative), Buffer.from(await file.arrayBuffer()));
  return relative;
}

/** Reads a private file; null when the path escapes PRIVATE_DIR or the file is missing. */
export async function readPrivateFile(relative: string) {
  const file = path.resolve(PRIVATE_DIR, relative);
  if (!file.startsWith(PRIVATE_DIR + path.sep)) return null;
  try {
    const data = await fs.readFile(file);
    return { data, contentType: PRIVATE_CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deletePrivateFile(relative: string) {
  const file = path.resolve(PRIVATE_DIR, relative);
  if (file.startsWith(PRIVATE_DIR + path.sep)) await fs.rm(file, { force: true });
}

/** Content-Disposition with a safe ASCII fallback and the original (UTF-8) name. */
export function attachment(name: string, inline = false) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
