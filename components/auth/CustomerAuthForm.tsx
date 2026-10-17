"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AuthState } from "@/app/[lang]/auth-actions";
import { useI18n } from "@/components/providers/I18nProvider";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

export default function CustomerAuthForm({ mode, submitAction }: {
  mode: "login" | "register";
  submitAction: (previous: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const { t, href } = useI18n();
  const registering = mode === "register";
  const [formState, action, pending] = useActionState<AuthState, FormData>(submitAction, {});
  const state = formState ?? {};
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const a = t.auth;

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      {registering && (
        <div>
          <label htmlFor="customer-name" className="mb-2 block text-sm font-medium">{a.name}</label>
          <input id="customer-name" name="name" required minLength={2} maxLength={100} autoComplete="name" defaultValue={state.name} className={field} aria-invalid={state.error === "invalidName"} />
        </div>
      )}
      <div>
        <label htmlFor="customer-email" className="mb-2 block text-sm font-medium">{a.email}</label>
        <input id="customer-email" name="email" type="email" required maxLength={254} dir="ltr" autoComplete="username" defaultValue={state.email} className={`${field} rtl:text-right`} aria-invalid={state.error === "invalidEmail"} />
      </div>
      <div>
        <label htmlFor="customer-password" className="mb-2 block text-sm font-medium">{a.password}</label>
        <div className="relative">
          <input
            id="customer-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={registering ? 8 : undefined}
            maxLength={128}
            dir="ltr"
            autoComplete={registering ? "new-password" : "current-password"}
            className={`${field} pe-12 rtl:text-right`}
            aria-describedby={registering ? "customer-password-hint" : undefined}
            aria-invalid={state.error === "invalidPassword" || state.error === "invalidCredentials"}
          />
          <button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? a.hidePassword : a.showPassword} aria-pressed={showPassword} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-dark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </div>
        {registering && <p id="customer-password-hint" className="mt-2 text-xs text-muted">{a.passwordHint}</p>}
      </div>
      {registering && (
        <div>
          <label htmlFor="customer-confirm-password" className="mb-2 block text-sm font-medium">{a.confirmPassword}</label>
          <input id="customer-confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} dir="ltr" autoComplete="new-password" className={`${field} rtl:text-right`} aria-invalid={state.error === "passwordMismatch"} />
        </div>
      )}
      {state.error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 outline-none">{a.errors[state.error]}</p>}
      <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-dark px-6 py-3 font-medium text-white transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark disabled:cursor-wait disabled:opacity-60">
        {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {pending ? registering ? a.creatingAccount : a.signingIn : registering ? a.register : a.login}
      </button>
      <p className="pt-1 text-center text-sm text-muted">
        {registering ? a.haveAccount : a.noAccount}{" "}
        <Link href={href(registering ? "/login" : "/register")} className="font-medium text-brand-dark underline underline-offset-4">{registering ? a.login : a.register}</Link>
      </p>
    </form>
  );
}
