import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Block, L, MenuItem } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

// ---------- catalogue ----------

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
    paidAt: integer("paid_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [index("orders_status_idx").on(t.status), index("orders_paymob_order_idx").on(t.paymobOrderId)],
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
});

// ---------- admin auth ----------

export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

// ---------- customer auth (separate from administrator access) ----------

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
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
