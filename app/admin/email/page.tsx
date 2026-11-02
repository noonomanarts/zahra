import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { emailConfigured, loadEmailSettings } from "@/lib/email";
import { getAdminT } from "@/lib/i18n/admin-server";
import { can } from "@/lib/permissions";
import { decryptSecret } from "@/lib/secrets";
import { Badge, Card, Notice, PageTitle, ReadOnly } from "@/components/admin/ui";
import { EmailSettingsForm, TestEmailForm, type EmailView } from "./EmailForms";

export const metadata: Metadata = { title: "Email" };

export default async function EmailPage() {
  const admin = await requireAdmin("email.view");
  const editable = can(admin.permissions, "email.manage");
  const { lang, t } = await getAdminT();
  const e = t.email;
  const [s, log] = await Promise.all([loadEmailSettings(), db.select().from(schema.emailLog).orderBy(desc(schema.emailLog.createdAt), desc(schema.emailLog.id)).limit(30)]);
  // the password itself never leaves the server
  const view: EmailView = {
    enabled: s?.enabled ?? false,
    host: s?.host ?? "",
    port: s?.port ?? 587,
    security: s?.security ?? "starttls",
    username: s?.username ?? "",
    hasPassword: Boolean(s?.password),
    fromName: s?.fromName ?? "",
    fromEmail: s?.fromEmail ?? "",
    replyTo: s?.replyTo ?? "",
    adminEmails: s?.adminEmails ?? "",
    customerEmails: s?.customerEmails ?? true,
    adminAlerts: s?.adminAlerts ?? true,
  };
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });
  const off = !emailConfigured(s) || !s.enabled;
  return (
    <>
      <PageTitle title={e.title} description={e.subtitle} />
      <div className="mb-6 space-y-3 empty:hidden">
        {off && <Notice>{e.offNotice}</Notice>}
        {s?.password && !decryptSecret(s.password) && <Notice>{e.unreadable}</Notice>}
        {s?.security === "none" && s.enabled && <Notice>{e.plainWarning}</Notice>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ReadOnly when={!editable} label={t.common.readOnly}><EmailSettingsForm view={view} /></ReadOnly>
        <div className="space-y-6">
          {editable && <TestEmailForm to={admin.email} />}
          <Card title={e.logTitle} description={e.logHint} flush>
            {log.length ? (
              <ul className="divide-y divide-zinc-100">
                {log.map((row) => (
                  <li key={row.id} className="px-5 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900" dir="auto">{row.subject}</span>
                        <span className="block truncate text-xs text-zinc-500" dir="ltr">{row.recipient}</span>
                      </span>
                      <Badge status={row.error ? "failed" : "paid"} label={row.error ? e.failed : e.sent} />
                    </div>
                    {row.error && <p className="mt-1 text-xs break-words text-red-700" dir="ltr">{row.error}</p>}
                    <p className="mt-1 text-xs text-zinc-400">{dateFmt.format(row.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-8 text-center text-sm text-zinc-500">{e.logEmpty}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
