"use client";

import { useState } from "react";
import type { ServiceRequestState } from "@/app/[lang]/service-actions";
import { useI18n } from "@/components/providers/I18nProvider";
import type { Errors } from "./FormKit";

/**
 * Turns each new server answer into either the success state (request number) or an error shown
 * next to the field it belongs to. Returns [request number, setter] for the success panel.
 */
export function useServerErrors(state: ServiceRequestState, setErrors: (errors: Errors) => void) {
  const { t } = useI18n();
  const [seen, setSeen] = useState(state);
  const [done, setDone] = useState<string | null>(null);
  if (state !== seen) {
    setSeen(state);
    if (state.number) setDone(state.number);
    else if (state.error) {
      const message = t.services.errors[state.error];
      setErrors(state.field ? { [state.field]: message } : { _form: message });
      if (state.field) {
        const field = state.field;
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(`form [name="${CSS.escape(field)}"]`);
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
          el?.focus({ preventScroll: true });
        });
      }
    }
  }
  return [done, setDone] as const;
}
