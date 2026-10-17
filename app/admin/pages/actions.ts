"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeBlock } from "@/lib/blocks";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";
import { saveImage } from "@/lib/uploads";
import type { Block } from "@/lib/types";
import { readL } from "@/components/admin/ui";

export type PageFormState = { error?: string; ok?: string; blocks?: Block[] };

export async function savePage(_prev: PageFormState, formData: FormData): Promise<PageFormState> {
  await requireAdmin();
  const { t } = await getAdminT();
  const slug = String(formData.get("slug"));
  const title = readL(formData, "title");
  const description = readL(formData, "description");
  if (!title.en) return { error: t.pages.titleRequired };

  let blocks: Block[];
  try {
    blocks = (JSON.parse(String(formData.get("blocks") ?? "[]")) as Block[]).map(normalizeBlock);
    // image and hero blocks may come with new files in "upload-<index>" / "upload-bg-<index>"
    for (const [i, block] of blocks.entries()) {
      const file = formData.get(`upload-${i}`);
      const upload = file instanceof File && file.size > 0 ? file : null;
      if (block.type === "image" && upload) block.src = await saveImage(upload);
      if (block.type === "hero") {
        if (upload) block.image = await saveImage(upload);
        const bg = formData.get(`upload-bg-${i}`);
        if (bg instanceof File && bg.size > 0) block.background = await saveImage(bg);
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the page blocks." };
  }

  await db
    .update(schema.pages)
    .set({ title: title.en, titleAr: title.ar, description: description.en || null, descriptionAr: description.ar || null, blocks })
    .where(eq(schema.pages.slug, slug));
  revalidateSite();
  return { ok: t.pages.saved, blocks };
}
