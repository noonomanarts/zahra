import assert from "node:assert/strict";
import test from "node:test";
import { DEPARTMENTS, SECTION_CATEGORIES, defaultMainMenu, sectionHref } from "../lib/catalog";
import { fixWhatsappLinks, whatsappDigits, whatsappUrl } from "../lib/whatsapp";

test("broken WhatsApp short links are rewritten to the number", () => {
  const html = '<a href="https://wa.me/message/AXQCQFPDQFM7L1">+968</a> <a href="https://api.whatsapp.com/message/H3U7JS3CUT3HI1?autoload=1&amp;app_absent=0">x</a>';
  assert.equal(fixWhatsappLinks(html, "96876874070"), '<a href="https://wa.me/96876874070">+968</a> <a href="https://wa.me/96876874070">x</a>');
  assert.equal(fixWhatsappLinks("https://wa.me/96812345678", "96876874070"), "https://wa.me/96812345678");
  assert.equal(fixWhatsappLinks(html, ""), html);
});

test("WhatsApp links use the configured number, then the first phone", () => {
  assert.equal(whatsappDigits({ whatsapp: "+968 7687 4070", contact: { emails: [], phones: ["111"] } }), "96876874070");
  assert.equal(whatsappDigits({ contact: { emails: [], phones: ["+968 9999 0000"] } }), "96899990000");
  assert.equal(whatsappUrl("968", "Hi & welcome"), "https://wa.me/968?text=Hi%20%26%20welcome");
  assert.equal(whatsappUrl(""), null);
});

test("shop structure: unique slugs, bilingual labels, menu matches the brief", () => {
  const slugs = DEPARTMENTS.map((d) => d.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const d of DEPARTMENTS) {
    assert.ok(d.label.en && d.label.ar, d.slug);
    const sections = d.sections.map((s) => s.slug);
    assert.equal(new Set(sections).size, sections.length, d.slug);
    for (const s of d.sections) assert.ok(s.label.en && s.label.ar && sectionHref(d, s).startsWith("/"), s.slug);
  }
  assert.equal(new Set(SECTION_CATEGORIES.map((c) => c.slug)).size, SECTION_CATEGORIES.length);
  assert.deepEqual(
    defaultMainMenu().map((m) => m.label.en),
    ["About Us", "Cross Stitch", "Hand Embroidery", "Crochet", "Online Workshops", "Contact Us"],
  );
  assert.deepEqual(DEPARTMENTS[0].sections.map((s) => s.label.en), [
    "Digital Patterns", "Classic Kits", "Finished Item Kits", "Stitchable Items", "Free Cross Stitch Pattern", "Customized Pattern",
  ]);
});
