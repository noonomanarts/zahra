// Applies pending migrations from db/migrations to the SQLite database.
import fs from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/db";

fs.mkdirSync("storage/uploads", { recursive: true });
await migrate(db, { migrationsFolder: "db/migrations" });
console.log("database is up to date");
