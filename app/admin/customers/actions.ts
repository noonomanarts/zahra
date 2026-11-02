"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createPasswordReset } from "@/lib/customer-auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { customerWhatsapp, whatsappUrl } from "@/lib/whatsapp";
import { cleanName, validEmail, validName } from "@/components/admin/people";

export type CustomerState = { error?: string; ok?: string; resetLink?: string; whatsapp?: string | null };

const refresh = (id: number) => {
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
};

export async function saveCustomer(_prev: CustomerState, formData: FormData): Promise<CustomerState> {
  const admin = await requireAdmin("customers.manage");
  const { t } = await getAdminT();
  const e = t.customers.errors;
  const id = Number(formData.get("id"));
  const name = cleanName(formData.get("name"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!validName(name)) return { error: e.name };
  if (!validEmail(email)) return { error: e.email };
  const clash = await db.query.customers.findFirst({ where: and(eq(schema.customers.email, email), ne(schema.customers.id, id)), columns: { id: true } });
  if (clash) return { error: e.emailTaken };
  const [saved] = await db.update(schema.customers).set({ name, email }).where(eq(schema.customers.id, id)).returning({ id: schema.customers.id });
  if (!saved) return { error: e.missing };
  await audit(admin, "customer.updated", { type: "customer", id, label: email });
  refresh(id);
  return { ok: t.customers.saved };
}

/** The account actions: suspend, reactivate, sign out everywhere, delete. */
export async function manageCustomer(_prev: CustomerState, formData: FormData): Promise<CustomerState> {
  const admin = await requireAdmin("customers.manage");
  const { t } = await getAdminT();
  const c = t.customers;
  const id = Number(formData.get("id"));
  const customer = Number.isInteger(id) ? await db.query.customers.findFirst({ where: eq(schema.customers.id, id) }) : undefined;
  if (!customer) return { error: c.errors.missing };
  const about = { type: "customer" as const, id, label: customer.email };
  const endSessions = () => db.delete(schema.customerSessions).where(eq(schema.customerSessions.customerId, id));

  switch (formData.get("op")) {
    case "suspend":
      await db.update(schema.customers).set({ disabledAt: new Date() }).where(eq(schema.customers.id, id));
      await endSessions();
      await audit(admin, "customer.disabled", about);
      refresh(id);
      return { ok: c.suspendedOk };
    case "reactivate":
      await db.update(schema.customers).set({ disabledAt: null }).where(eq(schema.customers.id, id));
      await audit(admin, "customer.enabled", about);
      refresh(id);
      return { ok: c.reactivated };
    case "revoke":
      await endSessions();
      await audit(admin, "customer.sessions_revoked", about);
      refresh(id);
      return { ok: c.revoked };
    case "resetLink": {
      if (customer.disabledAt) return { error: c.errors.suspendedReset };
      // the link opens in the language and is sent to the number of the customer's latest order
      const [last] = await db.select({ phone: schema.orders.phone, locale: schema.orders.locale }).from(schema.orders).where(eq(schema.orders.customerId, id)).orderBy(desc(schema.orders.createdAt)).limit(1);
      const lang = last?.locale === "ar" ? "ar" : "en";
      const h = await headers();
      const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
      const resetLink = `${origin}/${lang}/reset-password?token=${await createPasswordReset(id)}`;
      await audit(admin, "customer.reset_link", about);
      return { resetLink, whatsapp: last ? whatsappUrl(customerWhatsapp(last.phone), `${c.resetMessage[lang]}\n${resetLink}`) : null };
    }
    case "delete":
      await db.delete(schema.customers).where(eq(schema.customers.id, id));
      await audit(admin, "customer.deleted", about);
      revalidatePath("/admin/customers");
      redirect("/admin/customers");
  }
  return {};
}
