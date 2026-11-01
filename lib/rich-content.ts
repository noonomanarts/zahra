import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { localizeHref, type Locale } from "./i18n/config";

// An explicit format marker keeps old HTML unchanged in storage until the owner edits it.
export const MARKDOWN_PREFIX = "<!-- zahra:markdown -->\n";
export const isMarkdown = (source: string) => source.startsWith(MARKDOWN_PREFIX);
export const markdownSource = (source: string) => isMarkdown(source) ? source.slice(MARKDOWN_PREFIX.length) : source;
export const storeMarkdown = (source: string) => source ? MARKDOWN_PREFIX + source : "";
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const parser = new Marked({ gfm: true, breaks: false, renderer: { html: ({ text }) => escape(text) } });

/** Shared by public rendering and admin preview. No scripts, raw Markdown HTML, unsafe URLs or embeds. */
export function renderRichContent(source: string, lang: Locale = "en", preview = false) {
  const html = isMarkdown(source) ? parser.parse(markdownSource(source), { async: false }) : source;
  return sanitizeHtml(html, {
    allowedTags: ["p","br","hr","h1","h2","h3","h4","h5","h6","strong","b","em","i","s","del","blockquote","ul","ol","li","pre","code","a","img","table","thead","tbody","tr","th","td","input","span","div","sup","sub"],
    allowedAttributes: { a: ["href","title","rel", ...(preview ? ["target"] : [])], img: ["src","alt","title","loading"], ol: ["start"], th: ["align"], td: ["align"], code: ["class"], input: ["type","checked","disabled"], '*': ["dir"] },
    allowedClasses: { code: [/^language-[\w-]+$/] },
    allowedSchemes: ["https","http","mailto","tel"],
    allowedSchemesByTag: { img: ["https","http"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => ({ tagName: "a", attribs: { ...attrs, href: localizeHref(lang, attrs.href ?? ""), rel: "noopener noreferrer", ...(preview ? { target: "_blank" } : {}) } }),
      img: (_tag, attrs) => ({ tagName: "img", attribs: { ...attrs, loading: "lazy" } }),
      input: (_tag, attrs) => ({ tagName: "input", attribs: { type: "checkbox", disabled: "", ...(Object.hasOwn(attrs, "checked") ? { checked: "" } : {}) } }),
    },
  });
}
