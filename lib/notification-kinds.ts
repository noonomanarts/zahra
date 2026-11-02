import type { Permission } from "./permissions";

/** Who sees what: each kind of notification follows the section it belongs to. */
export const NOTIFICATION_KINDS = {
  "order.paid": "orders.view",
  "order.received": "orders.view",
  "payment.failed": "orders.view",
  "payment.mismatch": "orders.view",
  "request.new": "requests.view",
  "review.new": "reviews.view",
  "customer.new": "customers.view",
  "contact.message": "requests.view",
  "stock.low": "products.view",
  "stock.out": "products.view",
  "email.failed": "email.view",
} as const satisfies Record<string, Permission>;

export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

export const NOTIFICATION_GROUPS = {
  orders: ["order.paid", "order.received", "payment.failed", "payment.mismatch"],
  requests: ["request.new", "contact.message"],
  catalogue: ["review.new", "stock.low", "stock.out"],
  people: ["customer.new"],
  system: ["email.failed"],
} as const satisfies Record<string, readonly NotificationKind[]>;

export function kindsFor(permissions: readonly string[]) {
  return (Object.keys(NOTIFICATION_KINDS) as NotificationKind[]).filter((k) => permissions.includes(NOTIFICATION_KINDS[k]));
}

/** Pieces left at or below this count as running low. */
export const LOW_STOCK_LEVEL = 3;

/** Only the moment stock crosses a line deserves a notification, not every later sale. */
export function stockNotice(before: number, after: number): "stock.low" | "stock.out" | null {
  if (after <= 0 && before > 0) return "stock.out";
  if (after <= LOW_STOCK_LEVEL && before > LOW_STOCK_LEVEL) return "stock.low";
  return null;
}
