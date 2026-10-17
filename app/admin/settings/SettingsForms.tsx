"use client";

/* eslint-disable @next/next/no-img-element -- admin preview */
import { useActionState, useState } from "react";
import type { SiteSettings } from "@/db/schema";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, Field, FormMessage, LField, btnCls, btnDangerCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { LabelInputs, MenuItems } from "./MenuEditor";
import { changePassword, saveSettings, type SettingsState } from "./actions";

export function SiteSettingsForm({ site }: { site: SiteSettings }) {
  const { t } = useAdminI18n();
  const s = t.settings;
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [mainMenu, setMainMenu] = useState(site.mainMenu);
  const [footerMenus, setFooterMenus] = useState(site.footerMenus);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="mainMenu" value={JSON.stringify(mainMenu)} />
      <input type="hidden" name="footerMenus" value={JSON.stringify(footerMenus)} />

      <Card title={s.store}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={s.storeName}><input name="name" defaultValue={site.name} className={inputCls} /></Field>
            <Field label={s.shippingFee} hint={s.shippingHint}>
              <input name="shippingFee" type="number" dir="ltr" step="0.001" min="0" defaultValue={site.shippingFee} className={inputCls} />
            </Field>
          </div>
          <LField label={s.tagline} name="tagline" value={site.tagline} />
          <Field label={s.logo}>
            <div className="flex items-center gap-3">
              {site.logo && <img src={site.logo} alt="" className="h-10 w-auto rounded bg-header p-1" />}
              <input name="logo" type="file" accept="image/*" className="text-sm" />
            </div>
          </Field>
        </div>
      </Card>

      <Card title={s.contact}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.emails}><textarea name="emails" dir="ltr" rows={2} defaultValue={site.contact.emails.join("\n")} className={inputCls} /></Field>
          <Field label={s.phones}><textarea name="phones" dir="ltr" rows={2} defaultValue={site.contact.phones.join("\n")} className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <Field label={s.social}><textarea name="social" dir="ltr" rows={5} defaultValue={site.social.map((x) => x.href).join("\n")} className={inputCls} /></Field>
          </div>
        </div>
      </Card>

      <Card title={s.mainMenu}>
        <MenuItems items={mainMenu} onChange={setMainMenu} />
      </Card>

      <Card title={s.footerMenus}>
        <div className="space-y-6">
          {footerMenus.map((menu, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-700">{s.menuTitle}</span>
                <LabelInputs value={menu.title} onChange={(title) => setFooterMenus((list) => list.map((m, j) => (j === i ? { ...m, title } : m)))} />
                <button type="button" onClick={() => setFooterMenus((list) => list.filter((_, j) => j !== i))} className={btnDangerCls}>
                  {s.removeMenu}
                </button>
              </div>
              <MenuItems items={menu.items} onChange={(items) => setFooterMenus((list) => list.map((m, j) => (j === i ? { ...m, items } : m)))} />
            </div>
          ))}
          <button type="button" onClick={() => setFooterMenus((list) => [...list, { title: { en: "", ar: "" }, items: [] }])} className={btnSecondaryCls}>
            {s.addMenu}
          </button>
        </div>
      </Card>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/95 py-4 backdrop-blur">
        <button disabled={pending} className={btnCls}>{pending ? t.common.saving : s.save}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { t } = useAdminI18n();
  const s = t.settings;
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePassword, {});
  return (
    <Card title={s.password}>
      <form action={action} className="grid max-w-md gap-4">
        <Field label={s.current}><input name="current" type="password" dir="ltr" required autoComplete="current-password" className={inputCls} /></Field>
        <Field label={s.next} hint={s.nextHint}><input name="next" type="password" dir="ltr" required minLength={10} autoComplete="new-password" className={inputCls} /></Field>
        <Field label={s.repeat}><input name="confirm" type="password" dir="ltr" required autoComplete="new-password" className={inputCls} /></Field>
        <FormMessage state={state} />
        <button disabled={pending} className={`${btnCls} w-fit`}>{pending ? t.common.saving : s.change}</button>
      </form>
    </Card>
  );
}
