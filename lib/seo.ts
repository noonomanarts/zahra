const BASE = process.env.APP_URL ?? "https://zahrasdesignstudio.com";

export const absoluteUrl = (path: string) => new URL(path, BASE).toString();

/** Text for search engines from a description stored as HTML or Markdown. */
export function plainText(content: string, limit: number) {
  const text = content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>]+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}
