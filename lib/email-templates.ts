/** Transactional email texts and layout, in the language the customer used. Everything inserted is HTML-escaped. */
export type EmailLang = "en" | "ar";
export type RenderedEmail = { subject: string; html: string; text: string };

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Layout = {
  lang: EmailLang;
  siteName: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  rows?: { label: string; value: string; strong?: boolean }[];
  button?: { label: string; url: string };
  footer?: string;
};

/** Tables and inline styles, the only layout that survives every mail client. */
export function renderEmail({ lang, siteName, subject, heading, paragraphs, rows, button, footer }: Layout): RenderedEmail {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";
  const opposite = lang === "ar" ? "left" : "right";
  const font = "font-family:Tahoma,Arial,Helvetica,sans-serif;";
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(subject)}</title></head>
<body style="margin:0;background:#f6ece9;padding:24px 12px;${font}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#a46e62;color:#ffffff;padding:20px 28px;font-size:18px;font-weight:bold;text-align:${align}">${escape(siteName)}</td></tr>
<tr><td dir="${dir}" style="padding:28px;color:#2b2523;font-size:15px;line-height:1.7;text-align:${align}">
<h1 style="margin:0 0 12px;font-size:21px;line-height:1.35;color:#2b2523">${escape(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px">${escape(p)}</p>`).join("\n")}
${rows?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eadfdb">${rows.map((r) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eadfdb;text-align:${align}${r.strong ? ";font-weight:bold" : ""}">${escape(r.label)}</td><td style="padding:8px 0;border-bottom:1px solid #eadfdb;white-space:nowrap;text-align:${opposite}${r.strong ? ";font-weight:bold" : ""}">${escape(r.value)}</td></tr>`).join("")}</table>` : ""}
${button ? `<p style="margin:20px 0 8px"><a href="${escape(button.url)}" style="display:inline-block;background:#7f5147;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:bold">${escape(button.label)}</a></p>` : ""}
${footer ? `<p style="margin:20px 0 0;font-size:13px;color:#7a6f6b">${escape(footer)}</p>` : ""}
</td></tr></table>
</td></tr></table></body></html>`;
  const text = [
    heading,
    "",
    ...paragraphs,
    ...(rows?.length ? ["", ...rows.map((r) => `${r.label}: ${r.value}`)] : []),
    ...(button ? ["", `${button.label}: ${button.url}`] : []),
    ...(footer ? ["", footer] : []),
    "",
    siteName,
  ].join("\n");
  return { subject, html, text };
}

export const ORDER_NOTICE_STATUSES = ["received", "paid", "shipped", "completed", "cancelled"] as const;
export type OrderNotice = (typeof ORDER_NOTICE_STATUSES)[number];

const T = {
  en: {
    hello: (name: string) => `Hello ${name},`,
    order: (n: string) => `Order ${n}`,
    item: "Item",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    total: "Total",
    viewAccount: "View my account",
    notices: {
      received: ["We received your order", "Thank you! We will contact you shortly to arrange payment."],
      paid: ["Your payment is confirmed", "Thank you! Your payment was successful and we are preparing your order."],
      shipped: ["Your order is on its way", "Good news: your order has been shipped."],
      completed: ["Your order is complete", "Your order is complete. Thank you for shopping with us!"],
      cancelled: ["Your order was cancelled", "Your order has been cancelled. If this is unexpected, please reply to this email."],
    } as Record<OrderNotice, [string, string]>,
    digital: "Your digital patterns will be sent to this email address.",
    workshop: "Your workshop is ready in your account.",
    request: (n: string) => `We received your request ${n}`,
    requestText: "Thank you! We will review your request and get back to you soon.",
    requestNumber: "Request number",
    resetSubject: "Choose a new password",
    resetText: "We received a request to reset the password of your account. This link works once and expires in one hour.",
    resetButton: "Choose a new password",
    resetIgnore: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
    changedSubject: "Your password was changed",
    changedText: "The password of your account was just changed. If this wasn't you, please contact us right away.",
  },
  ar: {
    hello: (name: string) => `مرحبًا ${name}،`,
    order: (n: string) => `الطلب ${n}`,
    item: "المنتج",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    shipping: "الشحن",
    total: "الإجمالي",
    viewAccount: "عرض حسابي",
    notices: {
      received: ["استلمنا طلبك", "شكرًا لك! سنتواصل معك قريبًا لترتيب عملية الدفع."],
      paid: ["تم تأكيد الدفع", "شكرًا لك! تمت عملية الدفع بنجاح ونجهّز طلبك الآن."],
      shipped: ["طلبك في الطريق", "خبر سار: تم شحن طلبك."],
      completed: ["اكتمل طلبك", "اكتمل طلبك. شكرًا لتسوقك معنا!"],
      cancelled: ["تم إلغاء طلبك", "تم إلغاء طلبك. إذا لم تكن تتوقع ذلك، يرجى الرد على هذه الرسالة."],
    } as Record<OrderNotice, [string, string]>,
    digital: "سنرسل باتروناتك الرقمية إلى هذا البريد الإلكتروني.",
    workshop: "ورشتك جاهزة في حسابك.",
    request: (n: string) => `استلمنا طلبك ${n}`,
    requestText: "شكرًا لك! سنراجع طلبك ونرد عليك قريبًا.",
    requestNumber: "رقم الطلب",
    resetSubject: "اختر كلمة مرور جديدة",
    resetText: "وصلنا طلب لإعادة تعيين كلمة مرور حسابك. يعمل هذا الرابط مرة واحدة وينتهي خلال ساعة.",
    resetButton: "اختر كلمة مرور جديدة",
    resetIgnore: "إذا لم تطلب ذلك فتجاهل هذه الرسالة، وستبقى كلمة مرورك كما هي.",
    changedSubject: "تم تغيير كلمة مرورك",
    changedText: "تم للتو تغيير كلمة مرور حسابك. إذا لم تكن أنت، فتواصل معنا فورًا.",
  },
};

const omr = (amount: number, lang: EmailLang) => (lang === "ar" ? `${amount.toFixed(3)} ر.ع.` : `OMR ${amount.toFixed(3)}`);

export type OrderForEmail = {
  number: string;
  customerName: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  items: { name: string; quantity: number; unitPrice: number; digital: boolean }[];
  hasWorkshop: boolean;
  accountUrl: string | null;
};

export function orderEmail(notice: OrderNotice, o: OrderForEmail, lang: EmailLang, siteName: string) {
  const t = T[lang];
  const [heading, text] = t.notices[notice];
  const paid = notice === "paid";
  return renderEmail({
    lang,
    siteName,
    subject: `${heading} – ${t.order(o.number)}`,
    heading,
    paragraphs: [
      t.hello(o.customerName),
      text,
      ...(paid && o.items.some((i) => i.digital) && !o.hasWorkshop ? [t.digital] : []),
      ...(paid && o.hasWorkshop ? [t.workshop] : []),
    ],
    rows: [
      ...o.items.map((i) => ({ label: i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name, value: omr(i.unitPrice * i.quantity, lang) })),
      { label: t.subtotal, value: omr(o.subtotal, lang) },
      ...(o.discount > 0 ? [{ label: t.discount, value: `−${omr(o.discount, lang)}` }] : []),
      ...(o.shipping > 0 ? [{ label: t.shipping, value: omr(o.shipping, lang) }] : []),
      { label: t.total, value: omr(o.total, lang), strong: true },
    ],
    button: o.accountUrl ? { label: t.viewAccount, url: o.accountUrl } : undefined,
    footer: t.order(o.number),
  });
}

export function requestEmail(number: string, name: string, lang: EmailLang, siteName: string) {
  const t = T[lang];
  const heading = t.request(number);
  return renderEmail({ lang, siteName, subject: heading, heading, paragraphs: [t.hello(name), t.requestText], rows: [{ label: t.requestNumber, value: number }] });
}

export function resetEmail(url: string, name: string, lang: EmailLang, siteName: string) {
  const t = T[lang];
  return renderEmail({ lang, siteName, subject: t.resetSubject, heading: t.resetSubject, paragraphs: [t.hello(name), t.resetText], button: { label: t.resetButton, url }, footer: t.resetIgnore });
}

export function passwordChangedEmail(name: string, lang: EmailLang, siteName: string) {
  const t = T[lang];
  return renderEmail({ lang, siteName, subject: t.changedSubject, heading: t.changedSubject, paragraphs: [t.hello(name), t.changedText] });
}

/** Alerts to the studio, in English: they quote what the customer typed, in whatever language that was. */
export function adminAlert(heading: string, lines: string[], url: string | null, siteName: string) {
  return renderEmail({ lang: "en", siteName, subject: heading, heading, paragraphs: lines, button: url ? { label: "Open in the admin panel", url } : undefined });
}

export function testEmail(siteName: string) {
  return renderEmail({ lang: "en", siteName, subject: `Test email from ${siteName}`, heading: "Your email settings work", paragraphs: ["This is a test sent from Admin → Email. Customers will get their order emails from this address."] });
}
