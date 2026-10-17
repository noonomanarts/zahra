// Extracts site content from the static mirror in theme/ into data/*.json
// and copies the images/fonts that are actually used into public/.
// Run with: npm run extract
import * as cheerio from "cheerio";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const THEME = path.resolve(import.meta.dirname, "../theme");
const DATA = path.resolve(import.meta.dirname, "../data");
const PUBLIC = path.resolve(import.meta.dirname, "../public");

const read = (rel) => cheerio.load(fs.readFileSync(path.join(THEME, rel), "utf8"));
const clean = (s = "") => s.replace(/\s+/g, " ").trim();
const slugOf = (href = "") => path.basename(href.split(/[?#]/)[0], ".html");
const STATIC_PAGES = new Set(
  fs.readdirSync(THEME).filter((f) => f.endsWith(".html") && f !== "index.html").map((f) => f.slice(0, -5)),
);

// ---------- assets ----------
const usedImages = new Set();
const IMAGES = path.join(THEME, "assets/images");
const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
const stem = (name) => kebab(path.parse(name).name).replace(/-\d+x\d+$/, "");
// downloaded variants of each image, largest first (files were renamed to kebab-case in theme/)
const variants = new Map();
for (const f of fs.readdirSync(IMAGES).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))) {
  const size = (f.match(/-(\d+)x(\d+)\.\w+$/) || [0, 1e5, 1e5]).slice(1).reduce((a, b) => a * b, 1);
  variants.set(stem(f), [...(variants.get(stem(f)) || []), { f, size }].sort((a, b) => b.size - a.size));
}

/** Resolve an image reference from a page to a /images/... public URL (null if not downloaded). */
const SITE = "https://zahrasdesignstudio.com";
const CACHE = path.resolve(import.meta.dirname, "../.cache/images"); // downloaded originals, reused between runs
/** public path → { url, fallback } for images that were not mirrored and get downloaded from the original site */
const downloads = new Map();

/**
 * Resolve an image reference from a page to a /images/... public URL.
 * Mirrored files are used as they are; anything else from wp-content/uploads is downloaded in full size
 * (so the site never loads images from elsewhere), with the largest mirrored size as fallback.
 */
function image(fromFile, ref) {
  if (!ref || ref.startsWith("data:")) return null;
  let uploadPath = null;
  let rel;
  if (/^https?:/.test(ref)) {
    const m = ref.match(/^https?:\/\/(?:www\.)?zahrasdesignstudio\.com(\/wp-content\/uploads\/[^?#]+)/);
    if (!m) return null;
    uploadPath = decodeURIComponent(m[1]);
  } else {
    const abs = path.resolve(path.dirname(path.join(THEME, fromFile)), decodeURIComponent(ref.split(/[?#]/)[0]));
    if (abs.startsWith(IMAGES) && fs.existsSync(abs)) rel = path.relative(IMAGES, abs);
    else if (abs.includes(`${path.sep}wp-content${path.sep}uploads${path.sep}`)) uploadPath = "/" + abs.slice(abs.indexOf("wp-content")).split(path.sep).join("/");
  }
  if (rel) {
    usedImages.add(rel);
    return "/images/" + rel.split(path.sep).join("/");
  }
  if (!uploadPath || !/\.(jpe?g|png|webp|gif)$/i.test(uploadPath)) return null;
  const name = kebab(path.basename(uploadPath));
  const publicPath = `/images/uploads/${name}`;
  if (!downloads.has(publicPath)) {
    const fallback = variants.get(stem(name))?.[0]?.f;
    downloads.set(publicPath, { url: SITE + encodeURI(uploadPath), fallback: fallback ? `/images/${fallback}` : null, fallbackRel: fallback });
  }
  return publicPath;
}

/** Best available image of an <img>: largest srcset candidate that exists, else src. */
function bestImage(fromFile, $, el) {
  const $el = $(el);
  const candidates = ($el.attr("srcset") || "")
    .split(",")
    .map((c) => c.trim().split(/\s+/))
    .filter((c) => c[0])
    .sort((a, b) => parseInt(b[1] || "0") - parseInt(a[1] || "0"))
    .map((c) => c[0]);
  for (const ref of [...candidates, $el.attr("data-large_image"), $el.attr("src")]) {
    const img = image(fromFile, ref);
    if (img) return img;
  }
  return null;
}

/** Map a link in the mirror to a route of the Next app. */
function route(fromFile, href) {
  if (!href || href.startsWith("#")) return href || "#";
  if (/^(https?:|mailto:|tel:)/.test(href)) {
    const m = href.match(/^https?:\/\/(?:www\.)?zahrasdesignstudio\.com\/?(.*)$/);
    if (!m) return href;
    const p = m[1].replace(/\/$/, "");
    if (!p) return "/";
    if (p.startsWith("product/")) return "/products/" + p.split("/")[1];
    if (p.startsWith("product-category/")) return "/categories/" + p.split("/")[1];
    return "/" + p.split("/")[0];
  }
  const abs = path.relative(THEME, path.resolve(path.dirname(path.join(THEME, fromFile)), href.split(/[?#]/)[0]));
  const [dir, file] = abs.includes(path.sep) ? abs.split(path.sep) : ["", abs];
  const slug = file.replace(/\.html$/, "").replace(/-page-\d+$/, "");
  if (abs === "index.html") return "/";
  if (dir === "products") return `/products/${slug}`;
  if (dir === "categories") return `/categories/${slug}`;
  if (dir === "tags") return `/tags/${slug}`;
  return `/${slug}`;
}

/** Keep only simple, safe markup from a rich-text block. */
function richText(fromFile, $, el) {
  const $c = $(el).clone();
  $c.find("script, style, form, noscript, svg").remove();
  $c.find("*").each((_, node) => {
    const $n = $(node);
    const keep = {};
    if (node.tagName === "a") keep.href = route(fromFile, $n.attr("href"));
    if (node.tagName === "img") {
      const src = bestImage(fromFile, $, node);
      if (!src) return void $n.remove();
      keep.src = src;
      keep.alt = $n.attr("alt") || "";
    }
    for (const attr of Object.keys(node.attribs || {})) $n.removeAttr(attr);
    for (const [k, v] of Object.entries(keep)) $n.attr(k, v);
    if (["div", "span", "section", "font"].includes(node.tagName)) $n.replaceWith($n.contents());
  });
  return clean($c.html() || "").replace(/<p>\s*<\/p>/g, "");
}

function parsePrice($, el) {
  const $p = $(el);
  const amount = (x) => parseFloat(clean($(x).text()).replace(/[^\d.]/g, "")) || null;
  if ($p.find("del").length) return { price: amount($p.find("ins").first()), regularPrice: amount($p.find("del").first()) };
  return { price: amount($p.find(".amount").first()), regularPrice: null };
}

// ---------- products ----------
const products = [];
for (const file of fs.readdirSync(path.join(THEME, "products")).sort()) {
  const rel = `products/${file}`;
  const $ = read(rel);
  const ld = $('script[type="application/ld+json"]')
    .map((_, s) => {
      const d = JSON.parse($(s).text());
      return (d["@graph"] || [d]).find((x) => x["@type"] === "Product");
    })
    .get()[0] || {};
  const summary = $(".summary").first();
  const images = [
    ...new Set(
      $(".woocommerce-product-gallery__image")
        .map((_, g) => image(rel, $(g).find("a").attr("href")) || bestImage(rel, $, $(g).find("img")[0]))
        .get()
        .filter(Boolean),
    ),
  ];
  const cls = $("[class*='post-'].product").first().attr("class") || "";
  products.push({
    slug: file.replace(/\.html$/, ""),
    name: clean($(".product_title").first().text()) || ld.name,
    sku: clean($(".sku").first().text()) || ld.sku || null,
    url: ld.url || null,
    currency: ld.offers?.[0]?.priceCurrency || "OMR",
    ...parsePrice($, summary.find(".price").first()),
    inStock: !/outofstock/.test(cls),
    digital: /downloadable|virtual/.test(cls),
    // images that were not downloaded fall back to the live site's URL from the product's JSON-LD
    images: images.length ? images : [ld.image].flat().filter(Boolean).map((i) => image(rel, typeof i === "string" ? i : i.url)).filter(Boolean),
    description: richText(rel, $, $("#tab-description").first()).replace(/^<h2>Description<\/h2>/, ""),
    categories: $(".posted_in a").map((_, a) => slugOf($(a).attr("href"))).get(),
    tags: $(".tagged_as a").map((_, a) => slugOf($(a).attr("href"))).get(),
    related: $(".related-products .wd-product, .related .wd-product")
      .map((_, c) => slugOf($(c).find(".wd-entities-title a").attr("href")))
      .get(),
  });
}
const productSlugs = new Set(products.map((p) => p.slug));

// ---------- categories & tags ----------
function taxonomy(dir, key) {
  return fs
    .readdirSync(path.join(THEME, dir))
    .filter((f) => !/-page-\d+\.html$/.test(f))
    .sort()
    .map((file) => {
      const slug = file.replace(/\.html$/, "");
      const $ = read(`${dir}/${file}`);
      const name = clean($("h1").first().text()) || clean($("title").text().split("–")[0]);
      return { slug, name, count: products.filter((p) => p[key].includes(slug)).length };
    })
    .filter((t) => t.count > 0);
}
const categories = taxonomy("categories", "categories");
const tags = taxonomy("tags", "tags");

// ---------- generic Elementor widget walker ----------
function blocks(rel, $, root) {
  const out = [];
  $(root)
    .find("[data-widget_type]")
    .each((_, w) => {
      const $w = $(w);
      const type = $w.attr("data-widget_type").split(".")[0];
      if ($w.parents("[data-widget_type]").length) return; // nested widget, handled by its parent
      switch (type) {
        case "heading": {
          const h = $w.find("h1,h2,h3,h4,h5,h6,p,span").first();
          const text = clean(h.text());
          if (text) out.push({ type: "heading", level: /^h\d$/.test(h[0]?.tagName) ? +h[0].tagName[1] : 2, text });
          break;
        }
        case "wd_text_block":
        case "text-editor": {
          const html = richText(rel, $, $w.find(".wd-text-block, .elementor-widget-container").first());
          if (clean(cheerio.load(html).text())) out.push({ type: "text", html });
          break;
        }
        case "image": {
          const src = bestImage(rel, $, $w.find("img")[0]);
          if (src) out.push({ type: "image", src, alt: $w.find("img").attr("alt") || "" });
          break;
        }
        case "wd_images_gallery": {
          const imgs = $w.find("img").map((_, i) => bestImage(rel, $, i)).get().filter(Boolean);
          if (imgs.length) out.push({ type: "gallery", images: imgs });
          break;
        }
        case "accordion":
        case "toggle":
        case "wd_accordion": {
          const items = $w
            .find(".elementor-accordion-item, .elementor-toggle-item, .wd-accordion-item, details")
            .map((_, it) => ({
              question: clean($(it).find(".elementor-tab-title, .wd-accordion-title, summary").first().text()),
              answer: richText(rel, $, $(it).find(".elementor-tab-content, .wd-accordion-content").first()),
            }))
            .get()
            .filter((i) => i.question);
          if (items.length) out.push({ type: "accordion", items });
          break;
        }
        case "counter": {
          out.push({
            type: "counter",
            value: clean($w.find(".elementor-counter-number").attr("data-to-value") || $w.find(".elementor-counter-number").text()),
            suffix: clean($w.find(".elementor-counter-number-suffix").text()),
            label: clean($w.find(".elementor-counter-title").text()),
          });
          break;
        }
        case "video": {
          const settings = JSON.parse($w.attr("data-settings") || "{}");
          const url = settings.youtube_url || settings.vimeo_url || settings.hosted_url?.url;
          if (url) out.push({ type: "video", url });
          break;
        }
        case "icon-box":
        case "wd_infobox": {
          const title = clean($w.find(".elementor-icon-box-title, .info-box-title").first().text());
          const html = richText(rel, $, $w.find(".elementor-icon-box-description, .info-box-inner").first());
          if (title || html) out.push({ type: "infobox", title, html });
          break;
        }
        case "button": {
          const a = $w.find("a").first();
          if (clean(a.text())) out.push({ type: "button", text: clean(a.text()), href: route(rel, a.attr("href")) });
          break;
        }
        case "wd_products": {
          const items = $w.find(".wd-product").map((_, c) => slugOf($(c).find(".wd-entities-title a").attr("href"))).get();
          out.push({ type: "products", products: [...new Set(items)].filter((s) => productSlugs.has(s)) });
          break;
        }
        case "wd_testimonials": {
          const items = $w
            .find(".testimonial, .wd-testimon")
            .map((_, t) => ({
              text: clean($(t).find(".testimonial-content > p, .wd-testimon-text, .testimonial-content").first().text()),
              name: clean($(t).find(".testimonial-author .author-name, .wd-testimon-name, .author-name").first().text()),
              image: bestImage(rel, $, $(t).find("img")[0]),
            }))
            .get()
            .filter((t) => t.text);
          if (items.length) out.push({ type: "testimonials", items });
          break;
        }
        case "wd_contact_form_7":
          out.push({ type: "contact-form" });
          break;
      }
    });
  // the products grid on WooCommerce archive-like pages
  if (!out.some((b) => b.type === "products")) {
    const items = $(root).find(".wd-product").map((_, c) => slugOf($(c).find(".wd-entities-title a").attr("href"))).get();
    if (items.length) out.push({ type: "products", products: [...new Set(items)].filter((s) => productSlugs.has(s)) });
  }
  return out;
}

// ---------- pages ----------
const pages = [...STATIC_PAGES].sort().map((slug) => {
  const rel = `${slug}.html`;
  const $ = read(rel);
  return {
    slug,
    title: clean($("title").text().split(/–|&#8211;/)[0]),
    description: $('meta[name="description"]').attr("content") || null,
    blocks: blocks(rel, $, $("main").first()),
  };
});

// ---------- home ----------
const $home = read("index.html");
const home = { title: clean($home("title").text()), blocks: blocks("index.html", $home, $home("main").first()) };

/** Background image of an Elementor element, read from the page's generated CSS. */
function elementBackground(cssFile, id) {
  const css = fs.readFileSync(path.join(THEME, cssFile), "utf8");
  const m = css.match(new RegExp(`elementor-element-${id}[^{]*\\{[^}]*background-image:url\\("?([^")]+)"?\\)`));
  return m ? image(cssFile, m[1]) : null;
}

// The first section (heading, subtitle, text, button, collage) becomes one "hero" block.
{
  const end = home.blocks.findIndex((b) => b.type === "image");
  const intro = home.blocks.slice(0, end + 1);
  const [heading, subtitle, ...texts] = intro.filter((b) => b.type === "heading" || b.type === "text");
  const button = intro.find((b) => b.type === "button");
  const firstSection = $home("main [data-element_type='container'], main .elementor-top-section").first().attr("data-id");
  home.blocks.splice(0, end + 1, {
    type: "hero",
    title: heading?.text ?? "",
    subtitle: subtitle?.type === "text" ? clean(cheerio.load(subtitle.html).text()) : "",
    html: texts.map((t) => t.html).join(""),
    button: button ? { text: button.text, href: button.href } : null,
    image: intro.find((b) => b.type === "image")?.src ?? null,
    background: firstSection ? elementBackground("assets/css/elementor-page-16.css", firstSection) : null,
  });
}

// ---------- site chrome (menus, footer) ----------
const menu = (sel) =>
  $home(sel)
    .first()
    .children("li")
    .map((_, li) => {
      const a = $home(li).children("a").first();
      const label = clean(a.text());
      const children = $home(li)
        .find(".sub-menu > li > a, .wd-sub-menu > li > a")
        .map((_, c) => ({ label: clean($home(c).text()), href: route("index.html", $home(c).attr("href")) }))
        .get();
      return label ? { label, href: route("index.html", a.attr("href")), ...(children.length && { children }) } : null;
    })
    .get();

const footer = $home("footer").first();
const site = {
  name: "Zahras Design Studio",
  tagline: clean($home("title").text().split(/–/)[1] || ""),
  logo: bestImage("index.html", $home, $home(".wd-logo img, .site-logo img, header img").first()[0]),
  mainMenu: menu("#menu-main-menu").filter((m) => m.href !== "/my-account"),
  footerMenus: [
    ["footer-menu", "Information"],
    ["shop", "Shop"],
    ["legal", "Legal"],
  ].map(([id, title]) => ({ title, items: menu(`#menu-${id}`).filter((m) => m.href !== "/my-account") })),
  footerBlocks: blocks("index.html", $home, footer),
  social: [
    ...new Map(
      $home("footer a[href], .wd-social-icons a[href], .elementor-social-icon[href]")
        .map((_, a) => $home(a).attr("href"))
        .get()
        .filter((h) => !/sharer|share\?|pin\/create/.test(h))
        .filter((h) => /instagram|facebook|tiktok|youtube|pinterest|wa\.me|whatsapp|twitter|x\.com|etsy/.test(h))
        .map((h) => [h.replace(/\/$/, ""), { network: (h.match(/instagram|facebook|tiktok|youtube|pinterest|wa\.me|whatsapp|twitter|x\.com|etsy/) || [])[0].replace("wa.me", "whatsapp").replace("x.com", "twitter"), href: h }]),
    ).values(),
  ],
  contact: {
    emails: [...new Set($home("a[href^='mailto:']").map((_, a) => $home(a).attr("href").slice(7)).get())],
    phones: [...new Set($home("a[href^='tel:']").map((_, a) => $home(a).attr("href").slice(4)).get())],
  },
};

// ---------- download images that were not mirrored ----------
fs.mkdirSync(CACHE, { recursive: true });
const failed = new Map(); // public path → fallback (or null)
{
  const queue = [...downloads.entries()];
  let done = 0;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [publicPath, { url, fallback, fallbackRel }] = item;
      const cached = path.join(CACHE, path.basename(publicPath));
      try {
        if (!fs.existsSync(cached)) {
          const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
          const type = res.headers.get("content-type") ?? "";
          if (!res.ok || !type.startsWith("image/")) throw new Error(`${res.status} ${type}`);
          fs.writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
        }
      } catch (e) {
        console.warn(`  ! ${url}: ${e.message}${fallback ? " (using a smaller mirrored size)" : ""}`);
        failed.set(publicPath, fallback);
        if (fallbackRel) usedImages.add(fallbackRel);
      }
      if (++done % 25 === 0) console.log(`  downloaded ${done}/${downloads.size}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}
/** Replace failed downloads by their fallback everywhere (and drop images with none). */
const fixImages = (value) =>
  JSON.parse(
    JSON.stringify(value, (_k, v) =>
      Array.isArray(v) ? v.filter((x) => !(typeof x === "string" && failed.has(x) && !failed.get(x))) : typeof v === "string" && failed.has(v) ? failed.get(v) ?? "" : v,
    ),
  );

// ---------- write ----------
fs.mkdirSync(DATA, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(DATA, name), JSON.stringify(data, null, 2) + "\n");
write("products.json", fixImages(products));
write("categories.json", categories);
write("tags.json", tags);
write("pages.json", fixImages(pages));
write("home.json", fixImages(home));
write("site.json", fixImages(site));

fs.rmSync(path.join(PUBLIC, "images"), { recursive: true, force: true });
fs.mkdirSync(path.join(PUBLIC, "images/uploads"), { recursive: true });
// originals stay in the cache; public gets a web-sized copy (max 2000px, recompressed, same file name)
const MAX_SIDE = 2000;
let before = 0;
let after = 0;
await Promise.all(
  [...downloads.keys()]
    .filter((p) => !failed.has(p))
    .map(async (publicPath) => {
      const src = path.join(CACHE, path.basename(publicPath));
      const dest = path.join(PUBLIC, publicPath);
      let img = sharp(src).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
      img = /\.png$/i.test(dest) ? img.png({ compressionLevel: 9, effort: 8 }) : /\.webp$/i.test(dest) ? img.webp({ quality: 82 }) : img.jpeg({ quality: 82, mozjpeg: true });
      await img.toFile(dest);
      before += fs.statSync(src).size;
      after += fs.statSync(dest).size;
    }),
);
console.log(`  optimized downloads: ${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(0)} MB`);
// mirrored images: copy as they are, but give heavy photos the same web-sized treatment
await Promise.all(
  [...usedImages].map(async (rel) => {
    const src = path.join(THEME, "assets/images", rel);
    const dest = path.join(PUBLIC, "images", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!/\.(jpe?g|png|webp)$/i.test(rel) || fs.statSync(src).size < 300_000) return fs.copyFileSync(src, dest);
    let img = sharp(src).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
    img = /\.png$/i.test(rel) ? img.png({ compressionLevel: 9, effort: 8 }) : /\.webp$/i.test(rel) ? img.webp({ quality: 82 }) : img.jpeg({ quality: 82, mozjpeg: true });
    await img.toFile(dest);
    if (fs.statSync(dest).size > fs.statSync(src).size) fs.copyFileSync(src, dest); // never make a file bigger
  }),
);
fs.mkdirSync(path.join(PUBLIC, "fonts"), { recursive: true });
for (const f of ["myriadpro-regular.woff", "vip-hakm-light.woff", "vip-hakm-light-bold.woff", "autography.woff"]) {
  fs.copyFileSync(path.join(THEME, "assets/fonts", f), path.join(PUBLIC, "fonts", f));
}

console.log(
  `products ${products.length}, categories ${categories.length}, tags ${tags.length}, pages ${pages.length}, ` +
    `images ${usedImages.size} mirrored + ${downloads.size - failed.size} downloaded (${failed.size} failed)`,
);
