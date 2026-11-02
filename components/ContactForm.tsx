"use client";

import { useState, useTransition } from "react";
import { sendContact } from "@/app/[lang]/contact-actions";
import { useI18n } from "./providers/I18nProvider";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-brand";

/** The message goes to the admin panel, and to the studio's inbox when email is set up. */
export default function ContactForm() {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { t } = useI18n();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    start(async () => {
      const result = await sendContact(data);
      if (result === "sent") {
        setNotice(t.contactForm.delivered);
        form.reset();
      } else if (result === "rateLimited") setNotice(t.contactForm.rateLimited);
      else setNotice(t.contactForm.invalid);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl bg-brand-soft p-6 sm:grid-cols-2 sm:p-8">
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -start-[9999px] size-px opacity-0" />
      <input name="name" required placeholder={t.contactForm.name} className={field} />
      <input name="email" type="email" required placeholder={t.contactForm.email} className={field} />
      <input name="phone" type="tel" placeholder={t.contactForm.phone} className={field} />
      <input name="subject" placeholder={t.contactForm.subject} className={field} />
      <textarea name="message" required rows={5} placeholder={t.contactForm.message} className={`${field} sm:col-span-2`} />
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={pending} className="rounded-full bg-brand px-8 py-3 text-white transition-colors hover:bg-brand-dark disabled:opacity-60">{t.contactForm.send}</button>
        {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
      </div>
    </form>
  );
}
