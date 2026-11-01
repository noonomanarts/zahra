import Link from "next/link";

export default function Button({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const external = /^https?:/.test(href);
  const cls = `inline-block rounded-full bg-brand px-7 py-3 text-white transition-colors hover:bg-brand-dark ${className}`;
  // files (free PDF patterns): a plain download link, no client-side navigation or prefetch
  if (/\.pdf$/i.test(href)) {
    return (
      <a href={href} download className={`${cls} inline-flex items-center gap-2`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />
        </svg>
        {children}
        <span className="text-xs opacity-80">(PDF)</span>
      </a>
    );
  }
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  );
}
