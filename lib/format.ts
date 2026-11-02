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

/** Can this product be bought now? The switch in the admin, and the count when pieces are counted. */
export const effectiveInStock = (p: { inStock: boolean; stock: number | null }) => p.inStock && (p.stock === null || p.stock > 0);
