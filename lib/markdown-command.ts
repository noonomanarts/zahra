export type MarkdownCommand = "heading" | "bold" | "italic" | "quote" | "bullet" | "numbered" | "task" | "link" | "image" | "code" | "table";
export function markdownCommand(doc: string, from: number, to: number, command: MarkdownCommand) {
  const selected = doc.slice(from, to);
  let insert = "", anchor = from, head = to;
  const wrap = (left: string, right: string, placeholder: string) => {
    const content = selected || placeholder;
    insert = left + content + right; anchor = from + left.length; head = anchor + content.length;
  };
  switch (command) {
    case "bold": wrap("**", "**", "bold text"); break;
    case "italic": wrap("_", "_", "italic text"); break;
    case "link": wrap("[", "](https://example.com)", "link text"); break;
    case "image": wrap("![", "](/images/example.png)", "image description"); break;
    case "code": wrap("\n```\n", "\n```\n", "code"); break;
    case "table": insert = "\n| Column | Column |\n| --- | --- |\n| Text | Text |\n"; anchor = head = from + insert.length; break;
    default: {
      from = from === 0 ? 0 : doc.lastIndexOf("\n", from - 1) + 1;
      const lineEnd = doc.indexOf("\n", to);
      to = lineEnd < 0 ? doc.length : lineEnd;
      const prefix = { heading: "## ", quote: "> ", bullet: "- ", numbered: "1. ", task: "- [ ] " }[command];
      const lines = doc.slice(from, to).split("\n");
      const remove = lines.every(line => line.startsWith(prefix));
      insert = lines.map(line => remove ? line.slice(prefix.length) : prefix + line).join("\n");
      anchor = from; head = from + insert.length;
    }
  }
  return { from, to, insert, anchor, head };
}
