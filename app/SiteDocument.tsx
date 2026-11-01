import type { ComponentProps } from "react";
import type { Locale } from "@/lib/i18n/config";

const SITE_DOMAIN = "zahrasdesignstudio.com";

type SiteDocumentProps = ComponentProps<"html"> & { siteName?: string; showCredit?: boolean };

/** Shared App Router document for the storefront, admin and standalone 404. */
export default function SiteDocument({ children, siteName = "Zahras Design Studio", showCredit = true, ...props }: SiteDocumentProps) {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: `https://${SITE_DOMAIN}`,
    creator: { "@type": "Organization", name: "SBC", url: "https://sbc.om" },
  };

  return (
    <html {...props} data-sbc-site={showCredit ? "zahras-design-studio" : undefined}>
      <head>
        {showCredit && <meta name="generator" content="SBC — sbc.om" />}
        {showCredit && <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, "\\u003c") }}
        />}
      </head>
      {children}
    </html>
  );
}

export function SbcCredit({ lang, className = "", inverted = false }: { lang: Locale; className?: string; inverted?: boolean }) {
  return (
    <p className={`text-xs ${inverted ? "text-footer-text" : "text-muted"} ${className}`}>
      {lang === "ar" ? "تصميم وتطوير " : "Designed & built by "}
      <a
        href={`https://sbc.om/?utm_source=${SITE_DOMAIN}&utm_medium=referral&utm_campaign=footer-credit`}
        target="_blank"
        rel="noopener"
        className={`transition-colors ${inverted ? "hover:text-white" : "hover:text-brand-dark"}`}
      >
        SBC
      </a>
    </p>
  );
}
