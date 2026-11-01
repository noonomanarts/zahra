import type { PrintServiceSettings } from "@/db/schema";
import type { L } from "./types";

/**
 * The shop's departments (main menu) and their sections. A section either lists the products of a
 * category (assigned in Admin → Products), points to a content page, or is a service with its own form.
 */
export type Section = {
  slug: string;
  label: L;
  intro: L;
} & ({ category: string } | { href: string } | { service: "custom-pattern" | "print-design" });

export type Department = { slug: string; label: L; intro: L; sections: Section[] };

export const DEPARTMENTS: Department[] = [
  {
    slug: "cross-stitch",
    label: { en: "Cross Stitch", ar: "الكروس ستيتش" },
    intro: {
      en: "Modern patterns rooted in heritage – from printable charts to complete kits with everything you need.",
      ar: "تصاميم عصرية مستوحاة من التراث – من النماذج القابلة للطباعة إلى الأطقم الكاملة بكل ما تحتاجه.",
    },
    sections: [
      {
        slug: "digital-patterns",
        category: "cross-stitch-digital-patterns",
        label: { en: "Digital Patterns", ar: "نماذج رقمية" },
        intro: {
          en: "Easy-to-follow PDF charts with clear colour keys – download and start stitching today.",
          ar: "نماذج PDF سهلة المتابعة مع دليل ألوان واضح – حمّلها وابدأ التطريز اليوم.",
        },
      },
      {
        slug: "classic-kits",
        category: "cross-stitch-classic-kits",
        label: { en: "Classic Kits", ar: "الأطقم الكلاسيكية" },
        intro: {
          en: "Everything in one box: fabric, threads, needle, hoop and a step-by-step guide – perfect for beginners.",
          ar: "كل شيء في علبة واحدة: القماش والخيوط والإبرة والطارة ودليل خطوة بخطوة – مثالية للمبتدئين.",
        },
      },
      {
        slug: "finished-item-kits",
        category: "cross-stitch-finished-item-kits",
        label: { en: "Finished Item Kits", ar: "أطقم القطع الجاهزة" },
        intro: {
          en: "Kits that become something you use every day – pillow covers, shawls and more.",
          ar: "أطقم تتحول إلى قطع تستخدمها كل يوم – أغطية وسائد وشالات والمزيد.",
        },
      },
      {
        slug: "stitchable-items",
        category: "cross-stitch-stitchable-items",
        label: { en: "Stitchable Items", ar: "قطع قابلة للتطريز" },
        intro: {
          en: "Ready-made pieces with a stitchable panel – add your own design to bibs, wallets and more.",
          ar: "قطع جاهزة بمساحة قابلة للتطريز – أضف تصميمك الخاص إلى المرايل والمحافظ والمزيد.",
        },
      },
      {
        slug: "free-patterns",
        href: "/free-patterns",
        label: { en: "Free Cross Stitch Pattern", ar: "نماذج كروس ستيتش مجانية" },
        intro: { en: "Free charts to download and enjoy.", ar: "نماذج مجانية للتحميل والاستمتاع." },
      },
      {
        slug: "customized-pattern",
        service: "custom-pattern",
        label: { en: "Customized Pattern", ar: "نموذج حسب الطلب" },
        intro: {
          en: "Tell us your idea – a name, a verse, a photo – and we will design a cross stitch pattern just for you.",
          ar: "أخبرنا بفكرتك – اسم أو آية أو صورة – وسنصمم لك نموذج كروس ستيتش خاصًا بك.",
        },
      },
    ],
  },
  {
    slug: "hand-embroidery",
    label: { en: "Hand Embroidery", ar: "التطريز اليدوي" },
    intro: {
      en: "Free-style embroidery patterns and kits, plus a print service that puts your own design on fabric.",
      ar: "نماذج وأطقم للتطريز الحر، وخدمة طباعة تنقل تصميمك الخاص إلى القماش.",
    },
    sections: [
      {
        slug: "digital-patterns",
        category: "embroidery-digital-patterns",
        label: { en: "Digital Patterns", ar: "نماذج رقمية" },
        intro: {
          en: "Printable hand embroidery designs with stitch guides – transfer and stitch.",
          ar: "تصاميم تطريز يدوي قابلة للطباعة مع دليل الغرز – انقل التصميم وابدأ التطريز.",
        },
      },
      {
        slug: "embroidery-kits",
        category: "embroidery-kits",
        label: { en: "Embroidery Kits", ar: "أطقم التطريز" },
        intro: {
          en: "Pre-printed fabric, threads and a guide – everything to finish a beautiful hoop.",
          ar: "قماش مطبوع مسبقًا وخيوط ودليل – كل ما تحتاجه لإنهاء طارة جميلة.",
        },
      },
      {
        slug: "print-my-design",
        service: "print-design",
        label: { en: "Print My Design", ar: "اطبع تصميمي" },
        intro: {
          en: "We print your hand embroidery design onto the fabric of your choice, ready to stitch.",
          ar: "نطبع تصميم التطريز الخاص بك على القماش الذي تختاره، جاهزًا للتطريز.",
        },
      },
    ],
  },
  {
    slug: "crochet",
    label: { en: "Crochet", ar: "الكروشيه" },
    intro: {
      en: "Crochet patterns and kits designed in our Muscat studio.",
      ar: "نماذج وأطقم كروشيه مصممة في مرسمنا في مسقط.",
    },
    sections: [
      {
        slug: "digital-patterns",
        category: "crochet-digital-patterns",
        label: { en: "Digital Patterns", ar: "نماذج رقمية" },
        intro: {
          en: "Written and charted crochet patterns as PDF downloads.",
          ar: "نماذج كروشيه مكتوبة ومرسومة بصيغة PDF.",
        },
      },
      {
        slug: "crochet-kits",
        category: "crochet-kits",
        label: { en: "Crochet Kits", ar: "أطقم الكروشيه" },
        intro: {
          en: "Yarn, hook and pattern together – start your next project in minutes.",
          ar: "الخيوط والإبرة والنموذج معًا – ابدأ مشروعك القادم خلال دقائق.",
        },
      },
    ],
  },
];

export const WORKSHOPS_PATH = "/workshops";
export const WORKSHOPS_LABEL: L = { en: "Online Workshops", ar: "الورش الإلكترونية" };

export const getDepartment = (slug: string) => DEPARTMENTS.find((d) => d.slug === slug);
export const getSection = (department: string, section: string) =>
  getDepartment(department)?.sections.find((s) => s.slug === section);

/** Link of a section: its own page, or the content page it points to. */
export const sectionHref = (department: Department, section: Section) =>
  "href" in section ? section.href : `/${department.slug}/${section.slug}`;

/** Every category used by a section, with its bilingual name (created by the content upgrade). */
export const SECTION_CATEGORIES = DEPARTMENTS.flatMap((d) =>
  d.sections.flatMap((s) =>
    "category" in s
      ? [{ slug: s.category, name: { en: `${d.label.en} – ${s.label.en}`, ar: `${d.label.ar} – ${s.label.ar}` } }]
      : [],
  ),
);

export const SERVICE_PATHS = {
  "custom-pattern": "/cross-stitch/customized-pattern",
  "print-design": "/hand-embroidery/print-my-design",
} as const;

/** Pages edited in Admin → Pages that only feed another page (not shown on their own). */
export const EMBEDDED_PAGES: Record<string, string> = { "customized-pattern": SERVICE_PATHS["custom-pattern"] };

/** Until Zahra sets her own (Admin → Settings): fees are null = price confirmed on WhatsApp. */
export const DEFAULT_PRINT_SERVICE: PrintServiceSettings = {
  fabrics: [
    { en: "Cotton", ar: "قطن" },
    { en: "Linen", ar: "كتان" },
    { en: "Cotton–linen blend", ar: "مزيج القطن والكتان" },
  ],
  hoopSizes: [4, 6, 8],
  asIsFee: null,
  editsFee: null,
};

/** The main menu: About, the departments with their sections, workshops, contact. */
export function defaultMainMenu() {
  return [
    { label: { en: "About Us", ar: "من نحن" }, href: "/about-us" },
    ...DEPARTMENTS.map((d) => ({
      label: d.label,
      href: `/${d.slug}`,
      children: d.sections.map((s) => ({ label: s.label, href: sectionHref(d, s) })),
    })),
    { label: WORKSHOPS_LABEL, href: WORKSHOPS_PATH },
    { label: { en: "Contact Us", ar: "تواصل معنا" }, href: "/contact-us" },
  ];
}
