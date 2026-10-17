"use client";

import { useActionState, useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { login, type LoginState } from "../actions";

const field =
  "peer w-full rounded-2xl border border-line bg-white py-3.5 ps-11 pe-4 text-sm text-ink outline-none transition placeholder:text-transparent focus:border-brand focus:ring-4 focus:ring-brand/15";

function Icon({ d }: { d: string }) {
  return (
    <svg className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted transition peer-focus:text-brand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function LoginForm() {
  const { t } = useAdminI18n();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className={`space-y-5 ${state.error ? "zds-shake" : ""}`} key={state.error ? "error" : "idle"}>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">{t.login.email}</span>
        <span className="relative block">
          <input name="email" type="email" required dir="ltr" autoComplete="username" autoFocus defaultValue={state.email} placeholder="name@example.com" className={`${field} rtl:text-right`} />
          <Icon d="M4 6h16v12H4z M4 7l8 6 8-6" />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">{t.login.password}</span>
        <span className="relative block">
          <input name="password" type={show ? "text" : "password"} required dir="ltr" autoComplete="current-password" placeholder="••••••••" className={`${field} pe-12 rtl:text-right`} />
          <Icon d="M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-brand-soft hover:text-brand-dark"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {show && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="zds-rise flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span aria-hidden="true">⚠︎</span> {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="group relative w-full overflow-hidden rounded-2xl bg-brand px-6 py-3.5 font-medium text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-xl active:translate-y-0 disabled:pointer-events-none disabled:opacity-80"
      >
        {/* shine sweep on hover */}
        <span className="absolute inset-y-0 -start-1/2 w-1/3 -skew-x-12 bg-white/25 transition-all duration-700 group-hover:start-[120%]" aria-hidden="true" />
        <span className="relative inline-flex items-center justify-center gap-2">
          {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
          {pending ? t.login.signingIn : t.login.signIn}
          {!pending && <span className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true">→</span>}
        </span>
      </button>
    </form>
  );
}
