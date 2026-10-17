"use client";

import { useState } from "react";
import { useI18n } from "./providers/I18nProvider";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-brand";

/** No backend yet: the form opens the visitor's mail client with the message filled in. */
export default function ContactForm({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const { t } = useI18n();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = [
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Phone: ${data.get("phone")}`,
      "",
      `${data.get("message")}`,
    ].join("\n");
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(String(data.get("subject") || t.contactForm.defaultSubject))}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl bg-brand-soft p-6 sm:grid-cols-2 sm:p-8">
      <input name="name" required placeholder={t.contactForm.name} className={field} />
      <input name="email" type="email" required placeholder={t.contactForm.email} className={field} />
      <input name="phone" type="tel" placeholder={t.contactForm.phone} className={field} />
      <input name="subject" placeholder={t.contactForm.subject} className={field} />
      <textarea name="message" required rows={5} placeholder={t.contactForm.message} className={`${field} sm:col-span-2`} />
      <div className="flex items-center gap-4 sm:col-span-2">
        <button className="rounded-full bg-brand px-8 py-3 text-white transition-colors hover:bg-brand-dark">{t.contactForm.send}</button>
        {sent && <p className="text-sm text-muted">{t.contactForm.sent}</p>}
      </div>
    </form>
  );
}
