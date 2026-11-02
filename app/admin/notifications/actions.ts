"use server";

import { revalidatePath } from "next/cache";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/admin-notifications";
import { requireAdmin } from "@/lib/auth";

export async function markRead(id: number) {
  const admin = await requireAdmin();
  if (Number.isInteger(id)) await markNotificationRead(admin.id, id);
  revalidatePath("/admin/notifications");
}

export async function markAllRead() {
  const admin = await requireAdmin();
  await markAllNotificationsRead(admin.id);
  revalidatePath("/admin/notifications");
}
