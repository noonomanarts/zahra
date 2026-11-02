import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Block, L, MenuItem, WorkshopFile, WorkshopVideo } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency";
import type { AdminRole, PermissionMap } from "@/lib/permissions";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

// ---------- catalogue ----------

export const PRODUCT_KINDS = ["product", "workshop"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull().default(""),
    sku: text("sku"),
    price: real("price").notNull().default(0),
    regularPrice: real("regular_price"), // set when the product is on sale
    currency: text("currency").notNull().default("OMR"),
    inStock: integer("in_stock", { mode: "boolean" }).notNull().default(true),
    digital: integer("digital", { mode: "boolean" }).notNull().default(false),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
    description: text("description").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    related: text("related", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** "workshop": an online workshop whose videos and files unlock in the buyer's account */
    kind: text("kind", { enum: PRODUCT_KINDS }).notNull().default("product"),
    /** what one unit costs the studio (materials, printing…), used by the finance report */
    unitCost: real("unit_cost"),
    /** pieces on hand; null means the studio doesn't count this product, only the in-stock switch applies */
    stock: integer("stock"),
    workshopVideos: text("workshop_videos", { mode: "json" }).$type<WorkshopVideo[]>().notNull().default([]),
    workshopFiles: text("workshop_files", { mode: "json" }).$type<WorkshopFile[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [index("products_published_idx").on(t.published)],
);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull().default(""),
});

export const productCategories = sqliteTable(
  "product_categories",
  {
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

export const productTags = sqliteTable(
  "product_tags",
  {
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.tagId] })],
);

// ---------- content ----------

export const pages = sqliteTable("pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(), // "home" is the front page
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull().default(""),
  description: text("description"),
  descriptionAr: text("description_ar"),
  // text fields inside blocks are bilingual ({ en, ar })
  blocks: text("blocks", { mode: "json" }).$type<Block[]>().notNull().default([]),
  ...timestamps,
});

/** Print My Design service options, edited in Admin → Settings. Fees are in OMR; null = quoted on WhatsApp. */
export type PrintServiceSettings = {
  fabrics: L[];
  hoopSizes: number[]; // inches
  asIsFee: number | null;
  editsFee: number | null;
};

export type SiteSettings = {
  name: string;
  tagline: L;
  logo: string | null;
  mainMenu: MenuItem[];
  footerMenus: { title: L; items: MenuItem[] }[];
  social: { network: string; href: string }[];
  contact: { emails: string[]; phones: string[] };
  shippingFee: number; // flat fee in store currency for orders with physical products
  currency: string;
  /** WhatsApp number with country code (digits only); falls back to the first phone */
  whatsapp?: string;
  printService?: PrintServiceSettings;
};

/** Display rates: units of each currency per 1 OMR (prices are stored and charged in OMR). */
export type CurrencySettings = {
  rates: Record<CurrencyCode, number>;
  approvedAt: string | null;
  /** last rates fetched from Bank Muscat, waiting for an admin to approve them */
  pending: {
    rates: Partial<Record<CurrencyCode, number>>;
    quotes: Partial<Record<CurrencyCode, { buy: number; sell: number }>>;
    fetchedAt: string;
  } | null;
};

/** Key/value store: "site" holds SiteSettings, "currency" holds CurrencySettings. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

// ---------- orders ----------

export const ORDER_STATUSES = ["pending", "paid", "failed", "processing", "shipped", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    country: text("country"),
    city: text("city"),
    address: text("address"),
    notes: text("notes"),
    currency: text("currency").notNull(),
    // what the customer saw while shopping (charged amounts are always in `currency`)
    displayCurrency: text("display_currency"),
    displayRate: real("display_rate"),
    locale: text("locale").notNull().default("en"),
    subtotal: real("subtotal").notNull(),
    shipping: real("shipping").notNull().default(0),
    total: real("total").notNull(),
    paymentReference: text("payment_reference"), // special_reference sent to Paymob
    paymobIntentionId: text("paymob_intention_id"),
    paymobOrderId: text("paymob_order_id"),
    paymobTransactionId: text("paymob_transaction_id"),
    /** which gateway took this order's payment; older orders are Paymob when they have a Paymob id */
    paymentGateway: text("payment_gateway"),
    gatewayTransactionId: text("gateway_transaction_id"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    /** products pay before shipping: subtotal − discount + shipping = total */
    discount: real("discount").notNull().default(0),
    couponCode: text("coupon_code"),
    /** the order currently holds its pieces of counted stock */
    stockReserved: integer("stock_reserved", { mode: "boolean" }).notNull().default(false),
    // set when the customer was signed in at checkout (required for workshops)
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_paymob_order_idx").on(t.paymobOrderId),
    index("orders_customer_idx").on(t.customerId),
  ],
);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  unitPrice: real("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  digital: integer("digital", { mode: "boolean" }).notNull().default(false),
  // the product's unit cost when the order was placed (finance report)
  unitCost: real("unit_cost"),
});

// ---------- email ----------

/** What was sent, to whom and whether it worked. Never the body, which can hold a password link. */
export const emailLog = sqliteTable(
  "email_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    kind: text("kind").notNull(),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("email_log_created_idx").on(t.createdAt)],
);

// ---------- coupons ----------

export const COUPON_TYPES = ["percent", "fixed"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // upper case
  type: text("type", { enum: COUPON_TYPES }).notNull(),
  value: real("value").notNull(), // percent, or OMR
  minSubtotal: real("min_subtotal"),
  maxUses: integer("max_uses"),
  oncePerCustomer: integer("once_per_customer", { mode: "boolean" }).notNull().default(false),
  startsOn: text("starts_on"), // YYYY-MM-DD (Muscat)
  endsOn: text("ends_on"), // last valid day
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

// ---------- product reviews ----------

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const productReviews = sqliteTable(
  "product_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: REVIEW_STATUSES }).notNull().default("pending"),
    ...timestamps,
  },
  (t) => [uniqueIndex("product_reviews_once_idx").on(t.productId, t.customerId), index("product_reviews_status_idx").on(t.status)],
);

// ---------- admin auth ----------

export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** access level, see lib/permissions.ts; the lowest role is the default so a missing value never grants more */
  role: text("role").$type<AdminRole>().notNull().default("viewer"),
  /** section levels of the "custom" role, ignored by the built-in roles */
  permissions: text("permissions", { mode: "json" }).$type<PermissionMap>(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** set on temporary passwords: nothing else opens until the user chooses their own */
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  passwordChangedAt: integer("password_changed_at", { mode: "timestamp" }),
  /** "mark all as read": everything up to this notification; single reads are in admin_notification_reads */
  lastReadNotificationId: integer("last_read_notification_id").notNull().default(0),
  ...timestamps,
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

/** News for the team inside the panel. The words are chosen when shown, in each person's panel language. */
export const adminNotifications = sqliteTable(
  "admin_notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(),
    params: text("params", { mode: "json" }).$type<Record<string, string>>().notNull(),
    href: text("href"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("admin_notifications_kind_idx").on(t.kind)],
);

export const adminNotificationReads = sqliteTable(
  "admin_notification_reads",
  {
    notificationId: integer("notification_id").notNull().references(() => adminNotifications.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })],
);

/** Sign-ins and changes to people and access. The actor's email is copied so entries outlive deleted users. */
export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => adminUsers.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: integer("target_id"),
    targetLabel: text("target_label"),
    details: text("details", { mode: "json" }).$type<Record<string, string>>(),
    ip: text("ip"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt), index("admin_audit_log_actor_idx").on(t.actorId)],
);

// ---------- customer auth (separate from administrator access) ----------

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** set while the studio has suspended the account: sign-in is refused */
  disabledAt: integer("disabled_at", { mode: "timestamp" }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  ...timestamps,
});

export const customerSessions = sqliteTable(
  "customer_sessions",
  {
    id: text("id").primaryKey(), // sha256 of a random cookie token
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("customer_sessions_expiry_idx").on(t.expiresAt)],
);

/** One-time password links an administrator hands to a customer; only the sha256 of the token is stored. */
export const customerPasswordResets = sqliteTable(
  "customer_password_resets",
  {
    id: text("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("customer_password_resets_customer_idx").on(t.customerId)],
);

/** Workshop access given by the studio without an online order (e.g. paid in person). */
export const workshopGrants = sqliteTable(
  "workshop_grants",
  {
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.productId] })],
);

// ---------- service requests (Customized Pattern, Print My Design) ----------

export const REQUEST_TYPES = ["custom-pattern", "print-design"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export const REQUEST_STATUSES = ["new", "quoted", "accepted", "in-progress", "completed", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestFile = { name: string; file: string; size: number; type: string };

export const serviceRequests = sqliteTable(
  "service_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    type: text("type", { enum: REQUEST_TYPES }).notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("new"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    locale: text("locale").notNull().default("en"),
    /** the answers of the form, by field name */
    details: text("details", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
    files: text("files", { mode: "json" }).$type<RequestFile[]>().notNull().default([]),
    /** fee estimate shown to the customer (OMR), when the service has fixed fees */
    estimate: real("estimate"),
    adminNotes: text("admin_notes").notNull().default(""),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("service_requests_status_idx").on(t.status)],
);

// ---------- finance ----------

/** "cost": cost of goods (materials, supplies, printing); "expense": running costs (shipping, ads, fees…). */
export const ENTRY_KINDS = ["cost", "expense"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const financeEntries = sqliteTable(
  "finance_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(), // YYYY-MM-DD (Muscat)
    kind: text("kind", { enum: ENTRY_KINDS }).notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    amount: real("amount").notNull(), // OMR
    ...timestamps,
  },
  (t) => [index("finance_entries_date_idx").on(t.date)],
);
