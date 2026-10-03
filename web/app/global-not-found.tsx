import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "404 – Page not found | الصفحة غير موجودة" };

/** Shown for URLs that match no route at all (the site has separate root layouts for the store and the admin). */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-brand-soft px-4 text-center">
        <main>
          <p className="font-script text-7xl text-brand">404</p>
          <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
          <p className="mt-2 text-2xl" lang="ar" dir="rtl">الصفحة غير موجودة</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/en" className="rounded-full bg-brand px-7 py-3 text-white hover:bg-brand-dark">Home</Link>
            <Link href="/ar" lang="ar" className="rounded-full bg-brand px-7 py-3 text-white hover:bg-brand-dark">الرئيسية</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
