"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { CURRENCIES } from "@/lib/currency";
import { fetchBankMuscatRates, getCurrencySettings, saveCurrencySettings } from "@/lib/currency-server";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";

export type CurrencyState = { error?: string; ok?: string };

/** Fetches Bank Muscat's rates and keeps them as "pending" until an admin approves them. */
export async function fetchRates(): Promise<CurrencyState> {
  await requireAdmin();
  const { t } = await getAdminT();
  try {
    const pending = await fetchBankMuscatRates();
    await saveCurrencySettings({ ...(await getCurrencySettings()), pending });
    revalidatePath("/admin", "layout");
    return { ok: t.currencies.fetched(Object.keys(pending.rates).length) };
  } catch (e) {
    return { error: t.currencies.fetchError(e instanceof Error ? e.message : String(e)) };
  }
}

/** Makes the fetched Bank Muscat rates live (currencies the bank doesn't publish keep their rate). */
export async function approveRates(): Promise<CurrencyState> {
  await requireAdmin();
  const { t } = await getAdminT();
  const current = await getCurrencySettings();
  if (!current.pending) return { error: t.currencies.nothingPending };
  await saveCurrencySettings({
    rates: { ...current.rates, ...current.pending.rates, OMR: 1 },
    approvedAt: new Date().toISOString(),
    pending: null,
  });
  revalidateSite();
  revalidatePath("/admin", "layout");
  return { ok: t.currencies.approved };
}

/** Saves manually edited rates (e.g. IQD, which Bank Muscat doesn't publish). */
export async function saveRates(_prev: CurrencyState, formData: FormData): Promise<CurrencyState> {
  await requireAdmin();
  const { t } = await getAdminT();
  const current = await getCurrencySettings();
  const rates = { ...current.rates };
  for (const code of CURRENCIES) {
    if (code === "OMR") continue;
    const value = Number(formData.get(`rate_${code}`));
    if (!(value > 0)) return { error: t.currencies.invalid(code) };
    rates[code] = value;
  }
  await saveCurrencySettings({ ...current, rates, approvedAt: new Date().toISOString() });
  revalidateSite();
  revalidatePath("/admin", "layout");
  return { ok: t.currencies.saved };
}
