import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { isMarkdown, markdownSource, renderRichContent } from "./rich-content";

/** Conversion is only an editing view; opening/saving an untouched field keeps the original bytes. */
export function editableMarkdown(source: string) {
  if (isMarkdown(source)) return markdownSource(source);
  if (!/<\/?[a-z][^>]*>/i.test(source)) return source;
  const converter = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  converter.use(gfm);
  return converter.turndown(renderRichContent(source));
}
