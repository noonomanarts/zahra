"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { COUPON_TYPES, type CouponType } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { normalizeCode } from "@/lib/coupon-rules";
import { getAdminT } from "@/lib/i18n/admin-server";

export type CouponState = { error?: string; ok?: string; saved?: number };

const optionalNumber = (value: FormDataEntryValue | null) => {
  const s = String(value ?? "").trim();
  return s === "" ? null : Number(s);
};
const optionalDay = (value: FormDataEntryValue | null) => {
  const s = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export async function saveCoupon(_prev: CouponState, formData: FormData): Promise<CouponState> {
  const admin = await requireAdmin("coupons.manage");
  const { t } = await getAdminT();
  const e = t.coupons.errors;
  const id = Number(formData.get("id")) || null;
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const type = String(formData.get("type")) as CouponType;
  const value = Number(formData.get("value"));
  const minSubtotal = optionalNumber(formData.get("minSubtotal"));
  const maxUses = optionalNumber(formData.get("maxUses"));
  const startsOn = optionalDay(formData.get("startsOn"));
  const endsOn = optionalDay(formData.get("endsOn"));

  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: e.code };
  if (!COUPON_TYPES.includes(type)) return { error: e.value };
  if (!(value > 0) || (type === "percent" && value > 100)) return { error: e.value };
  if (minSubtotal !== null && !(minSubtotal >= 0)) return { error: e.minSubtotal };
  if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses > 0)) return { error: e.maxUses };
  if (startsOn && endsOn && endsOn < startsOn) return { error: e.dates };
  const taken = await db.query.coupons.findFirst({ where: id ? and(eq(schema.coupons.code, code), ne(schema.coupons.id, id)) : eq(schema.coupons.code, code), columns: { id: true } });
  if (taken) return { error: e.taken };

  const values = { code, type, value, minSubtotal, maxUses, startsOn, endsOn, oncePerCustomer: formData.get("oncePerCustomer") === "on", active: formData.get("active") === "on" };
  if (id) await db.update(schema.coupons).set(values).where(eq(schema.coupons.id, id));
  else await db.insert(schema.coupons).values(values);
  await audit(admin, "coupon.saved", { type: "coupon", id: id ?? undefined, label: code });
  revalidatePath("/admin/coupons");
  return { ok: t.coupons.saved, saved: Date.now() };
}

export async function deleteCoupon(formData: FormData) {
  const admin = await requireAdmin("coupons.manage");
  const [removed] = await db.delete(schema.coupons).where(eq(schema.coupons.id, Number(formData.get("id")))).returning({ code: schema.coupons.code });
  if (removed) await audit(admin, "coupon.deleted", { type: "coupon", label: removed.code });
  revalidatePath("/admin/coupons");
}
