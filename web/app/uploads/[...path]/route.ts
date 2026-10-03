import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, contentTypeFor } from "@/lib/uploads";

/** Serves images uploaded from the admin panel (stored outside public/ so they survive rebuilds). */
export async function GET(_request: Request, { params }: RouteContext<"/uploads/[...path]">) {
  const file = path.resolve(UPLOAD_DIR, ...(await params).path);
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(data, {
      headers: { "Content-Type": contentTypeFor(file), "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
