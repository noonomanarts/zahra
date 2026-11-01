"use server";

import { revalidatePath } from "next/cache";
import type { RequestType } from "@/db/schema";
import { getCustomer } from "@/lib/customer-auth";
import { isLocale } from "@/lib/i18n/config";
import { RequestError, submitServiceRequest, type RequestErrorCode } from "@/lib/requests";

export type ServiceRequestState = {
  error?: RequestErrorCode;
  field?: string;
  number?: string;
  estimate?: number | null;
};

export async function sendServiceRequest(type: RequestType, langValue: string, _prev: ServiceRequestState, formData: FormData): Promise<ServiceRequestState> {
  const lang = isLocale(langValue) ? langValue : "en";
  try {
    const customer = await getCustomer();
    const { number, estimate } = await submitServiceRequest(type, formData, lang, customer?.id ?? null);
    revalidatePath("/admin", "layout");
    return { number, estimate };
  } catch (e) {
    if (e instanceof RequestError) return { error: e.code, field: e.field };
    console.error("service request failed", e);
    return { error: "failed" };
  }
}
