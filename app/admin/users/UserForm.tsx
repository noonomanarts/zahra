"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { Card, Field, FormMessage, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { resolvePermissions, type AdminRole, type PermissionMap } from "@/lib/permissions";
import AccessEditor from "./AccessEditor";
import Credentials from "./Credentials";
import { saveUser, type UserFormState } from "./actions";

export default function UserForm({
  user,
  actor,
  locked,
}: {
  user?: { id: number; name: string; email: string; role: AdminRole; permissions: PermissionMap };
  actor: { role: string; permissions: PermissionMap };
  locked?: boolean;
}) {
  const { t } = useAdminI18n();
  const p = t.people;
  const [state, action, pending] = useActionState<UserFormState, FormData>(saveUser, {});

  if (state.credentials) {
    return (
      <Credentials email={state.credentials.email} password={state.credentials.password}>
        <Link href={`/admin/users/${state.credentials.id}`} className={btnSecondaryCls}>{p.openProfile}</Link>
        <button type="button" onClick={() => window.location.reload()} className={btnSecondaryCls}><Icon name="userPlus" size={16} /> {p.addAnother}</button>
      </Credentials>
    );
  }

  return (
    <form action={action}>
      <fieldset disabled={locked} className="m-0 min-w-0 space-y-6 border-0 p-0">
        {user && <input type="hidden" name="id" value={user.id} />}
        <Card title={p.profile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={p.name}><input name="name" required minLength={2} maxLength={100} defaultValue={user?.name} autoComplete="off" className={inputCls} /></Field>
            <Field label={p.email} hint={p.emailHint}><input name="email" type="email" required dir="ltr" maxLength={254} defaultValue={user?.email} autoComplete="off" className={inputCls} /></Field>
          </div>
        </Card>
        <Card title={p.access} description={p.accessHint}>
          <AccessEditor
            key={user ? `${user.role}-${JSON.stringify(user.permissions)}` : "new"}
            role={user?.role ?? "sales"}
            permissions={user?.permissions ?? resolvePermissions("custom")}
            actor={actor}
          />
        </Card>
        {!locked && (
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={pending} className={btnCls}>
              {pending ? (user ? t.common.saving : p.creating) : user ? t.common.save : p.create}
            </button>
            <FormMessage state={state} />
          </div>
        )}
      </fieldset>
    </form>
  );
}
