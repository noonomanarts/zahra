import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyAdmins } from "./admin-notifications";
import { getSite } from "./data";
import { downloadUrl, orderDeliverables } from "./downloads";
import { emailConfigured, inBackground, loadEmailSettings, sendEmail } from "./email";
import { adminAlert, orderEmail, passwordChangedEmail, requestEmail, resetEmail, type EmailLang, type OrderNotice } from "./email-templates";
import { absoluteUrl } from "./seo";

const langOf = (locale: string | null | undefined): EmailLang => (locale === "ar" ? "ar" : "en");
const adminList = (value: string) => value.split(",").map((s) => s.trim()).filter(Boolean);

async function alertStudio(heading: string, lines: string[], url: string | null, kind: string, replyTo?: string) {
  const s = await loadEmailSettings();
  if (!emailConfigured(s) || !s.enabled || !s.adminAlerts) return;
  const site = await getSite();
  const recipients = adminList(s.adminEmails);
  await Promise.all(recipients.map((to) => sendEmail(to, adminAlert(heading, lines, url, site.name), { kind, replyTo })));
}

/** Emails for a change an order just went through; a change with no email of its own sends nothing. */
export function notifyOrder(orderId: number, notice: OrderNotice, source: "customer" | "staff" = "customer") {
  inBackground(async () => {
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!order) return;
    // the team hears about what customers and gateways do; staff already know what they did themselves
    if (source === "customer" && (notice === "paid" || notice === "received")) {
      await notifyAdmins(notice === "paid" ? "order.paid" : "order.received", { number: order.number, name: order.customerName, total: order.total.toFixed(3) }, `/admin/orders/${order.id}`);
    }
    const deliverables = notice === "paid" ? await orderDeliverables(order.id) : { files: [], manual: [] };
    // someone has to send these by hand, or the customer waits forever
    if (deliverables.manual.length) await notifyAdmins("delivery.manual", { number: order.number, items: deliverables.manual.join(", ") }, `/admin/orders/${order.id}`);
    const s = await loadEmailSettings();
    if (!emailConfigured(s) || !s.enabled) return;
    const lang = langOf(order.locale);
    const site = await getSite();
    if (s.customerEmails) {
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
      const ids = items.flatMap((i) => (i.productId ? [i.productId] : []));
      const workshops = ids.length ? await db.select({ id: schema.products.id }).from(schema.products).where(and(inArray(schema.products.id, ids), eq(schema.products.kind, "workshop"))) : [];
      await sendEmail(order.email, orderEmail(notice, {
        number: order.number,
        customerName: order.customerName,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shipping,
        total: order.total,
        items,
        hasWorkshop: workshops.length > 0,
        downloadUrl: deliverables.files.length ? downloadUrl(order) : null,
        manualDelivery: deliverables.manual.length > 0,
        accountUrl: order.customerId ? absoluteUrl(`/${lang}/account`) : null,
      }, lang, site.name), { kind: `order.${notice}` });
    }
    if (notice === "paid" || notice === "received") {
      await alertStudio(
        `New order ${order.number}${notice === "paid" ? " (paid)" : " (awaiting payment)"}`,
        [`${order.customerName} – ${order.email} – ${order.phone}`, `Total: OMR ${order.total.toFixed(3)}`],
        absoluteUrl(`/admin/orders/${order.id}`),
        "admin.order",
      );
    }
  });
}

export function notifyServiceRequest(number: string) {
  inBackground(async () => {
    const request = await db.query.serviceRequests.findFirst({ where: eq(schema.serviceRequests.number, number) });
    if (!request) return;
    await notifyAdmins("request.new", { number, name: request.name, type: request.type }, `/admin/requests/${request.id}`);
    const s = await loadEmailSettings();
    if (!emailConfigured(s) || !s.enabled) return;
    const site = await getSite();
    if (s.customerEmails) await sendEmail(request.email, requestEmail(number, request.name, langOf(request.locale), site.name), { kind: "request.received" });
    await alertStudio(`New request ${number}`, [`${request.name} – ${request.email} – ${request.phone}`, `Type: ${request.type}`], absoluteUrl(`/admin/requests/${request.id}`), "admin.request", request.email);
  });
}

export function notifyPasswordReset(to: string, name: string, token: string, lang: EmailLang) {
  inBackground(async () => {
    const site = await getSite();
    await sendEmail(to, resetEmail(absoluteUrl(`/${lang}/reset-password?token=${token}`), name, lang, site.name), { kind: "customer.password_reset" });
  });
}

export function notifyPasswordChanged(to: string, name: string, lang: EmailLang) {
  inBackground(async () => {
    const site = await getSite();
    await sendEmail(to, passwordChangedEmail(name, lang, site.name), { kind: "customer.password_changed" });
  });
}

/** A message from the contact form: always kept in the panel, and mailed to the studio when email is set up. */
export async function sendContactMessage(m: { name: string; email: string; phone: string; subject: string; message: string }) {
  await notifyAdmins("contact.message", m, null);
  inBackground(async () => {
    const s = await loadEmailSettings();
    if (emailConfigured(s) && s.enabled && adminList(s.adminEmails).length) {
      await alertStudio(`Website message: ${m.subject}`.slice(0, 150), [`From: ${m.name} – ${m.email}${m.phone ? ` – ${m.phone}` : ""}`, m.message], null, "contact.message", m.email);
    }
  });
}

/** Payment problems the team must look at. */
export function notifyPaymentProblem(kind: "payment.failed" | "payment.mismatch", order: { id: number; number: string; customerName: string; total: number }) {
  inBackground(() => notifyAdmins(kind, { number: order.number, name: order.customerName, total: order.total.toFixed(3) }, `/admin/orders/${order.id}`));
}
