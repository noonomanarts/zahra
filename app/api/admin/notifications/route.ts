import { listNotifications, unreadCount } from "@/lib/admin-notifications";
import { getAdmin } from "@/lib/auth";

/** The bell asks here every few seconds. It answers only with what this person's role may see. */
export async function GET() {
  const admin = await getAdmin();
  if (!admin || admin.mustChangePassword) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const [unread, { items }] = await Promise.all([unreadCount(admin), listNotifications(admin, { limit: 12 })]);
  return Response.json({ unread, items }, { headers: { "Cache-Control": "private, no-store" } });
}
