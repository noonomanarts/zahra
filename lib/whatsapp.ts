import type { SiteSettings } from "@/db/schema";

/**
 * WhatsApp "message" short links (wa.me/message/…, api.whatsapp.com/message/…) stop working as soon as
 * the QR code is reset in WhatsApp Business, which broke every WhatsApp link of the old site.
 * Links are therefore always built from the phone number: https://wa.me/<digits>?text=…
 */
const SHORT_LINK = /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/message\/[A-Za-z0-9]+[^"'\s<]*/g;

export const whatsappDigits = (site: Pick<SiteSettings, "whatsapp" | "contact">) =>
  (site.whatsapp || site.contact.phones[0] || "").replace(/\D/g, "");

export function whatsappUrl(digits: string, text?: string) {
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** A customer's number as wa.me needs it; numbers typed without a country code are taken to be Omani. */
export function customerWhatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return digits.length === 8 ? `968${digits}` : digits;
}

/** Replaces broken WhatsApp short links in a URL or an HTML string with a link to the number. */
export function fixWhatsappLinks(html: string, digits: string) {
  return digits ? html.replace(SHORT_LINK, `https://wa.me/${digits}`) : html;
}
