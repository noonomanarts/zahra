// Disposable local browser fixture only. Never run against production storage.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { hashPassword } from "../lib/password";
if (process.env.DATABASE_URL !== "file:/app/storage/editor-fixture.db") throw new Error("Fixture path required");
const client=createClient({url:process.env.DATABASE_URL});
await migrate(drizzle(client),{migrationsFolder:"db/migrations"});
await client.execute({sql:"INSERT INTO admin_users (email,name,role,password_hash) VALUES (?,?,'owner',?)",args:["editor@example.test","Editor fixture",await hashPassword("Editor-Test-2026!")]});
await client.execute({sql:"INSERT INTO pages (slug,title,title_ar,blocks) VALUES ('contact-us','Contact fixture','اختبار المحتوى',?)",args:[JSON.stringify([{type:"text",html:{en:"<p>Legacy <strong>content</strong> and a <a href='/shop'>shop link</a>.</p>",ar:"<p>محتوى <strong>عربي</strong> محفوظ.</p>"}}])]});
client.close();
console.log("Disposable editor fixture ready.");
