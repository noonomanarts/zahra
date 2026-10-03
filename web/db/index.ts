import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:storage/zahra.db";
// SQLite can't create missing folders for a local database file
if (url.startsWith("file:")) fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });

// reuse one client across hot reloads in development
const globalForDb = globalThis as unknown as { libsql?: ReturnType<typeof createClient> };
const client = globalForDb.libsql ?? createClient({ url });
if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export { schema };
