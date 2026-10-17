import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

function preferredLocale(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accept = request.headers.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("ar") ? "ar" : DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // admin: optimistic check only (cookie present); every admin page and action still verifies the session
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname !== "/admin/login" && !request.cookies.has("zds_admin")) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // storefront: every page lives under /en or /ar
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // skip API routes, uploads, Next internals and files with an extension (images, fonts, sitemap.xml, …)
  matcher: ["/((?!api|uploads|_next|.*\\..*).*)"],
};
