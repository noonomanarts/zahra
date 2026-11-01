import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PrintServiceSettings, RequestFile, RequestType } from "@/db/schema";
import { DEFAULT_PRINT_SERVICE } from "./catalog";
import { getSite } from "./data";
import type { Locale } from "./i18n/config";
import { UploadError, deletePrivateFile, savePrivateFile } from "./uploads";

export async function getPrintService(): Promise<PrintServiceSettings> {
  const site = await getSite();
  return { ...DEFAULT_PRINT_SERVICE, ...site.printService };
}

export const REQUEST_PREFIX: Record<RequestType, string> = { "custom-pattern": "CP", "print-design": "PD" };
export const UPLOAD_LIMITS = { files: 5, fileBytes: 10 * 1024 * 1024, totalBytes: 25 * 1024 * 1024 };
const FILE_TYPES = [".jpg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif", ".pdf", ".svg"];

export type RequestErrorCode = "required" | "email" | "terms" | "fileType" | "fileSize" | "tooMany" | "rateLimited" | "failed";
export class RequestError extends Error {
  constructor(public code: RequestErrorCode, public field?: string) {
    super(code);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (formData: FormData, key: string, max = 300) => String(formData.get(key) ?? "").trim().slice(0, max);

// ---------- abuse protection: a few requests per visitor every 15 minutes ----------

const WINDOW = 15 * 60_000;
const store = globalThis as unknown as { serviceRequestHits?: Map<string, { n: number; until: number }> };
const hits = (store.serviceRequestHits ??= new Map());

async function allowRequest() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 100);
  const key = createHash("sha256").update(ip).digest("hex");
  const now = Date.now();
  for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
  const entry = hits.get(key) ?? { n: 0, until: now + WINDOW };
  if (entry.n >= 6) return false;
  entry.n += 1;
  hits.set(key, entry);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return true;
}

// ---------- submission ----------

type Answers = { details: Record<string, string>; estimate: number | null };

function parseCustomPattern(formData: FormData): Answers {
  const kit = text(formData, "fullKit", 3);
  const details: Record<string, string> = {
    aidaCount: text(formData, "aidaCount", 20),
    dimensions: text(formData, "dimensions", 100),
    colours: text(formData, "colours", 300),
    description: text(formData, "description", 2000),
    fullKit: kit === "yes" || kit === "no" ? kit : "",
  };
  for (const key of ["aidaCount", "dimensions", "colours", "description", "fullKit"]) {
    if (!details[key]) throw new RequestError("required", key);
  }
  if (details.fullKit === "yes") {
    details.country = text(formData, "country", 100);
    details.city = text(formData, "city", 100);
    details.address = text(formData, "address", 500);
    for (const key of ["country", "city", "address"]) if (!details[key]) throw new RequestError("required", key);
  }
  return { details, estimate: null };
}

async function parsePrintDesign(formData: FormData): Promise<Answers> {
  const settings = await getPrintService();
  const fabric = settings.fabrics[Number(text(formData, "fabric", 3) || NaN)];
  const hoop = Number(text(formData, "hoop", 3));
  const service = text(formData, "service", 10);
  const pieces = Math.floor(Number(text(formData, "pieces", 4)));
  if (!fabric) throw new RequestError("required", "fabric");
  if (!settings.hoopSizes.includes(hoop)) throw new RequestError("required", "hoop");
  if (service !== "as-is" && service !== "edits") throw new RequestError("required", "service");
  if (!(pieces >= 1 && pieces <= 50)) throw new RequestError("required", "pieces");
  const details: Record<string, string> = {
    fabric: fabric.en,
    hoop: `${hoop}"`,
    service,
    pieces: String(pieces),
    notes: text(formData, "notes", 1000),
  };
  if (service === "edits") {
    details.changes = text(formData, "changes", 1500);
    if (!details.changes) throw new RequestError("required", "changes");
  }
  const fee = service === "edits" ? settings.editsFee : settings.asIsFee;
  return { details, estimate: fee === null ? null : Math.round(fee * pieces * 1000) / 1000 };
}

/** Validates and stores a request with its attachments; returns the request number (CP-1001, PD-1001…). */
export async function submitServiceRequest(type: RequestType, formData: FormData, lang: Locale, customerId: number | null) {
  if (text(formData, "website")) throw new RequestError("failed"); // honeypot, filled in by bots only
  const name = text(formData, "name", 100);
  const email = text(formData, "email", 254).toLowerCase();
  const phone = text(formData, "phone", 30);
  if (!name) throw new RequestError("required", "name");
  if (!EMAIL.test(email)) throw new RequestError("email", "email");
  if (phone.replace(/\D/g, "").length < 7) throw new RequestError("required", "phone");

  const answers = type === "custom-pattern" ? parseCustomPattern(formData) : await parsePrintDesign(formData);

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (type === "print-design" && !files.length) throw new RequestError("required", "files");
  if (files.length > UPLOAD_LIMITS.files) throw new RequestError("tooMany", "files");
  if (files.reduce((n, f) => n + f.size, 0) > UPLOAD_LIMITS.totalBytes) throw new RequestError("fileSize", "files");
  if (formData.get("terms") !== "on") throw new RequestError("terms", "terms");
  if (!(await allowRequest())) throw new RequestError("rateLimited");

  const saved: RequestFile[] = [];
  try {
    const folder = `requests/${new Date().toISOString().slice(0, 7)}`;
    for (const file of files) {
      const stored = await savePrivateFile(file, folder, { maxBytes: UPLOAD_LIMITS.fileBytes, types: FILE_TYPES });
      saved.push({ name: file.name.slice(0, 120), file: stored, size: file.size, type: file.type });
    }
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.serviceRequests)
        .values({
          number: `tmp-${crypto.randomUUID()}`,
          type,
          name,
          email,
          phone,
          locale: lang,
          details: answers.details,
          estimate: answers.estimate,
          files: saved,
          customerId,
        })
        .returning({ id: schema.serviceRequests.id });
      const number = `${REQUEST_PREFIX[type]}-${1000 + row.id}`;
      await tx.update(schema.serviceRequests).set({ number }).where(eq(schema.serviceRequests.id, row.id));
      return { number, estimate: answers.estimate };
    });
  } catch (e) {
    await Promise.all(saved.map((f) => deletePrivateFile(f.file)));
    if (e instanceof UploadError) throw new RequestError(e.code === "type" ? "fileType" : "fileSize", "files");
    throw e;
  }
}
