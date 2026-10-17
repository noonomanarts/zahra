"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminI18n } from "@/components/admin/AdminI18n";

const ITEMS = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/orders", key: "orders" },
  { href: "/admin/products", key: "products" },
  { href: "/admin/categories", key: "categories" },
  { href: "/admin/tags", key: "tags" },
  { href: "/admin/pages", key: "pages" },
  { href: "/admin/currencies", key: "currencies" },
  { href: "/admin/settings", key: "settings" },
] as const;

export default function AdminNav() {
  const pathname = usePathname();
  const { t } = useAdminI18n();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {t.nav[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
