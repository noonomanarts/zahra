"use server";

import { consumeCustomerAuthAttempt } from "@/lib/customer-auth";
import { sendContactMessage } from "@/lib/notifications";

export type ContactResult = "sent" | "invalid" | "rateLimited";

const clean = (value: FormDataEntryValue | null, max: number) => String(value ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function sendContact(formData: FormData): Promise<ContactResult> {
  // a field people never see: only robots fill it in, and they are told it worked
  if (formData.get("website")) return "sent";
  const m = {
    name: clean(formData.get("name"), 100),
    email: clean(formData.get("email"), 254).replace(/\s/g, ""),
    phone: clean(formData.get("phone"), 40),
    subject: clean(formData.get("subject"), 120) || "Website enquiry",
    message: clean(formData.get("message"), 4000),
  };
  if (!m.name || !m.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return "invalid";
  if (!(await consumeCustomerAuthAttempt("", "contact"))) return "rateLimited";
  await sendContactMessage(m);
  return "sent";
}
