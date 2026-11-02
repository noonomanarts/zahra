"use client";

/* eslint-disable @next/next/no-img-element -- admin preview */
import { useActionState, useState } from "react";
import type { PrintServiceSettings, SiteSettings } from "@/db/schema";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, Field, FormMessage, LField, btnCls, btnDangerCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { LabelInputs, MenuItems } from "./MenuEditor";
import { saveSettings, type SettingsState } from "./actions";

export function SiteSettingsForm({ site, printService }: { site: SiteSettings; printService: PrintServiceSettings }) {
  const { t } = useAdminI18n();
  const s = t.settings;
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [mainMenu, setMainMenu] = useState(site.mainMenu);
  const [footerMenus, setFooterMenus] = useState(site.footerMenus);
  const [fabrics, setFabrics] = useState(printService.fabrics);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="mainMenu" value={JSON.stringify(mainMenu)} />
      <input type="hidden" name="footerMenus" value={JSON.stringify(footerMenus)} />
      <input type="hidden" name="fabrics" value={JSON.stringify(fabrics)} />

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
            <Field label={s.whatsapp} hint={s.whatsappHint}>
              <input name="whatsapp" dir="ltr" inputMode="tel" defaultValue={site.whatsapp ?? ""} className={`${inputCls} sm:max-w-xs`} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={s.social}><textarea name="social" dir="ltr" rows={5} defaultValue={site.social.map((x) => x.href).join("\n")} className={inputCls} /></Field>
          </div>
        </div>
      </Card>

      <Card title={s.printService}>
        <p className="mb-4 text-xs text-zinc-500">{s.printServiceHint}</p>
        <span className="mb-1.5 block text-sm font-medium text-zinc-700">{s.fabrics}</span>
        <div className="space-y-2">
          {fabrics.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <LabelInputs value={f} onChange={(v) => setFabrics((list) => list.map((x, j) => (j === i ? v : x)))} />
              <button type="button" onClick={() => setFabrics((list) => list.filter((_, j) => j !== i))} className="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50" aria-label={t.common.delete}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setFabrics((list) => [...list, { en: "", ar: "" }])} className={btnSecondaryCls}>+ {s.addFabric}</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label={s.hoopSizes}><input name="hoopSizes" dir="ltr" defaultValue={printService.hoopSizes.join(", ")} className={inputCls} /></Field>
          <Field label={s.asIsFee}><input name="asIsFee" type="number" dir="ltr" step="0.001" min="0" defaultValue={printService.asIsFee ?? ""} className={inputCls} /></Field>
          <Field label={s.editsFee}><input name="editsFee" type="number" dir="ltr" step="0.001" min="0" defaultValue={printService.editsFee ?? ""} className={inputCls} /></Field>
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
