import { NAV } from "../data/nav";

export interface Page {
  id: string;
  title: string;
  description: string;
  body: string;
}

const SUMMARY = "asciipaint paints any image, video, canvas or three.js scene as fine, coloured ASCII glyphs on WebGL2.";

/** A docs page's MDX as plain Markdown: no component imports or tags, and links that work off the site. */
export function plain(body: string, site: string): string {
  let fenced = false;
  return body
    .split("\n")
    .filter((line) => {
      if (line.startsWith("```")) fenced = !fenced;
      return fenced || !/^(import .* from |<[A-Z])/.test(line);
    })
    .join("\n")
    .replaceAll("](/", `](${site}/`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The docs pages in sidebar order. */
const ordered = (pages: readonly Page[]) =>
  NAV.flatMap((group) => group.items).flatMap((item) => pages.find((page) => page.id === item.slug) ?? []);

/** /llms.txt: what the library is and where each page lives. */
export function index(pages: readonly Page[], site: string): string {
  const links = ordered(pages).map((page) => `- [${page.title}](${site}/docs/${page.id}/): ${page.description}`);
  return `# asciipaint\n\n> ${SUMMARY}\n\nThe whole documentation as one file: ${site}/llms-full.txt\n\n## Docs\n\n${links.join("\n")}\n`;
}

/** /llms-full.txt: every docs page, one after another. */
export function full(pages: readonly Page[], site: string): string {
  const parts = ordered(pages).map((page) => `# ${page.title}\n\n${page.description}\n\n${plain(page.body, site)}`);
  return `# asciipaint\n\n> ${SUMMARY}\n\n${parts.join("\n\n---\n\n")}\n`;
}
