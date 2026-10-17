export function formatPrice(amount: number | null | undefined, currency = "OMR") {
  if (amount === null || amount === undefined) return "";
  return `${currency} ${amount.toFixed(3)}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
