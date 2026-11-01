import { WhatsAppIcon } from "./shop/Collections";

/** Floating "chat on WhatsApp" button, bottom corner of every storefront page. */
export default function WhatsAppFloat({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="group fixed end-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid h-14 w-14 place-items-center rounded-full bg-whatsapp text-white shadow-lg shadow-ink/20 transition hover:scale-105 hover:bg-whatsapp-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-whatsapp motion-reduce:transform-none sm:end-6 sm:bottom-6 print:hidden"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
}
