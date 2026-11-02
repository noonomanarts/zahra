"use server";

import { db, schema } from "@/db";
import type { SiteSettings } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { normalizeMenu, toL } from "@/lib/blocks";
import { getSite } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";
import { saveImage } from "@/lib/uploads";
import { readL } from "@/components/admin/ui";
import type { L } from "@/lib/types";

export type SettingsState = { error?: string; ok?: string };

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin("settings.manage");
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

  // Print My Design options
  const fee = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v === "" ? null : Number(v);
  };
  const hoopSizes = String(formData.get("hoopSizes") ?? "").split(/[,\s]+/).filter(Boolean).map(Number);
  let fabrics: L[];
  try {
    fabrics = (JSON.parse(String(formData.get("fabrics") ?? "[]")) as unknown[]).map(toL).filter((f) => f.en || f.ar);
  } catch {
    return { error: t.settings.invalidPrint };
  }
  const printService = { fabrics, hoopSizes, asIsFee: fee("asIsFee"), editsFee: fee("editsFee") };
  if (
    !hoopSizes.length ||
    hoopSizes.some((n) => !(n > 0 && n < 100)) ||
    [printService.asIsFee, printService.editsFee].some((f) => f !== null && (!Number.isFinite(f) || f < 0))
  ) {
    return { error: t.settings.invalidPrint };
  }
  const whatsapp = String(formData.get("whatsapp") ?? "").replace(/\D/g, "");

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
    whatsapp,
    printService,
  };
  await db.insert(schema.settings).values({ key: "site", value: site }).onConflictDoUpdate({ target: schema.settings.key, set: { value: site } });
  await audit(admin, "settings.saved");
  revalidateSite();
  return { ok: t.settings.saved };
}
