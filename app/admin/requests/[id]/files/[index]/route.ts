import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { adminCan } from "@/lib/auth";
import { attachment, readPrivateFile } from "@/lib/uploads";

/** Files attached to a Customized Pattern / Print My Design request – admin only. */
export async function GET(request: Request, { params }: RouteContext<"/admin/requests/[id]/files/[index]">) {
  if (!(await adminCan("requests.view"))) return new Response("Forbidden", { status: 403 });
  const { id, index } = await params;
  const row = await db.query.serviceRequests.findFirst({ where: eq(schema.serviceRequests.id, Number(id)) });
  const entry = row?.files[Number(index)];
  const file = entry && (await readPrivateFile(entry.file));
  if (!entry || !file) return new Response("Not found", { status: 404 });
  // images open in the browser for a quick look; everything else (and ?download) is downloaded
  const preview = !new URL(request.url).searchParams.has("download") && /^image\/(jpeg|png|webp|gif|avif)$/.test(file.contentType);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": attachment(entry.name, preview),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // uploaded SVG/PDF must never run scripts in the admin's session
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
