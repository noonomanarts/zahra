import assert from "node:assert/strict";
import test from "node:test";
import { editableMarkdown } from "../lib/markdown-editing";
import { renderRichContent, storeMarkdown } from "../lib/rich-content";
import { markdownCommand } from "../lib/markdown-command";

test("GFM headings, tables, tasks, code and Arabic use the shared safe renderer", () => {
  const html = renderRichContent(storeMarkdown("## مرحبًا\n\n**Bold** and ~~old~~\n\n- [x] Done\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst x = 1;\n```\n\n[Shop](/shop)"), "ar");
  for (const expected of ['<h2>مرحبًا</h2>', '<strong>Bold</strong>', '<del>old</del>', '<table>', 'type="checkbox"', 'disabled', 'language-js', 'href="/ar/shop"']) assert(html.includes(expected), expected);
});
test("Markdown raw HTML cannot become executable markup and unsafe URLs are removed", () => {
  const html = renderRichContent(storeMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[x](javascript:alert)\n\n![x](data:image/svg+xml;base64,PHN2Zz4=)\n\n[x](//evil.test)'));
  assert(!/<script|<img[^>]*onerror|href="(?:javascript|data|\/\/)|src="data:/i.test(html));
  assert(html.includes('&lt;script&gt;'));
});
test("legacy HTML keeps visible content while stripping events, embeds and encoded dangerous links", () => {
  const legacy='<p>Hello <strong>world</strong> <a href="/shop">shop</a></p><img src="/images/test.png" onerror="alert(1)"><iframe src="https://bad.test"></iframe><a href="&#106;avascript:alert(1)">bad</a><svg onload="alert(1)"></svg>';
  const html=renderRichContent(legacy,"ar");
  assert(html.includes('<strong>world</strong>'));
  assert(html.includes('href="/ar/shop"'));
  assert(html.includes('src="/images/test.png"'));
  assert(!/onerror|iframe|javascript:|<svg|onload/.test(html));
  const converted=editableMarkdown(legacy);
  assert(converted.includes('**world**'));
  assert.equal(legacy.includes('<strong>world</strong>'),true);
});
test("Markdown formatting respects selected text and multiline lists", () => {
  const bold=markdownCommand('hello world',6,11,'bold');
  assert.equal(bold.insert,'**world**');
  assert.deepEqual([bold.anchor,bold.head],[8,13]);
  const list=markdownCommand('one\ntwo',0,7,'task');
  assert.equal(list.insert,'- [ ] one\n- [ ] two');
  assert.equal(markdownCommand(list.insert,0,list.insert.length,'task').insert,'one\ntwo');
  assert.equal(editableMarkdown(storeMarkdown('**نص**')),'**نص**');
});
