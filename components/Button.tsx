import Link from "next/link";

export default function Button({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const external = /^https?:/.test(href);
  const cls = `inline-block rounded-full bg-brand px-7 py-3 text-white transition-colors hover:bg-brand-dark ${className}`;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  );
}
