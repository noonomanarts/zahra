"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SiteSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { normalizeMenu, toL } from "@/lib/blocks";
import { getSite } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { revalidateSite } from "@/lib/revalidate";
import { saveImage } from "@/lib/uploads";
import { readL } from "@/components/admin/ui";

export type SettingsState = { error?: string; ok?: string };

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const { t } = await getAdminT();
  const current = await getSite();

  const shippingFee = Number(formData.get("shippingFee"));
  if (Number.isNaN(shippingFee) || shippingFee < 0) return { error: t.settings.invalidFee };

  let mainMenu: SiteSettings["mainMenu"];
  let footerMenus: SiteSettings["footerMenus"];
  try {
    mainMenu = normalizeMenu(JSON.parse(String(formData.get("mainMenu"))));
    footerMenus = (JSON.parse(String(formData.get("footerMenus"))) as SiteSettings["footerMenus"]).map((m) => ({
      title: toL(m.title),
      items: normalizeMenu(m.items),
    }));
  } catch {
    return { error: "Invalid menu data." };
  }

  let logo = current.logo;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      logo = await saveImage(logoFile);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Logo upload failed." };
    }
  }

  const social = lines(formData.get("social")).map((href) => ({
    href,
    network:
      href.match(/instagram|facebook|tiktok|youtube|pinterest|whatsapp|wa\.me|twitter|x\.com|etsy/)?.[0].replace("wa.me", "whatsapp").replace("x.com", "twitter") ??
      "link",
  }));

  const site: SiteSettings = {
    ...current,
    name: String(formData.get("name") ?? "").trim() || current.name,
    tagline: readL(formData, "tagline"),
    logo,
    contact: { emails: lines(formData.get("emails")), phones: lines(formData.get("phones")) },
    social,
    shippingFee,
    mainMenu,
    footerMenus,
  };
  await db.insert(schema.settings).values({ key: "site", value: site }).onConflictDoUpdate({ target: schema.settings.key, set: { value: site } });
  revalidateSite();
  return { ok: t.settings.saved };
}

export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const { t } = await getAdminT();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 10) return { error: t.settings.tooShort };
  if (next !== String(formData.get("confirm") ?? "")) return { error: t.settings.mismatch };

  const user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, admin.id) });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: t.settings.wrong };
  await db.update(schema.adminUsers).set({ passwordHash: await hashPassword(next) }).where(eq(schema.adminUsers.id, admin.id));
  return { ok: t.settings.changed };
}
