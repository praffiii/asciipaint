export interface Item {
  title: string;
  /** A docs page's slug, or the full path of an external page. */
  slug: string;
  external?: true;
}

export const NAV: readonly { group: string; items: readonly Item[] }[] = [
  {
    group: "Getting started",
    items: [
      { title: "Install", slug: "install" },
      { title: "Quick start", slug: "quick-start" },
    ],
  },
  {
    group: "Guides",
    items: [
      { title: "<ascii-img>", slug: "ascii-img" },
      { title: "Images & video", slug: "images-video" },
      { title: "three.js", slug: "three" },
      { title: "Transparency & SVG", slug: "transparency-svg" },
      { title: "Performance & autoRender", slug: "performance" },
    ],
  },
  {
    group: "API reference",
    items: [
      { title: "asciipaint()", slug: "asciipaint" },
      { title: "autoRender()", slug: "auto-render" },
      { title: "asciipaintThree()", slug: "asciipaint-three" },
      { title: "Options", slug: "options" },
    ],
  },
  { group: "", items: [{ title: "Playground", slug: "/playground/", external: true }] },
];

const pages = NAV.flatMap((g) => g.items).filter((i) => !i.external);

/** The docs pages before and after `slug`, in sidebar order; external links are skipped. */
export function neighbours(slug: string): { prev?: Item; next?: Item } {
  const i = pages.findIndex((p) => p.slug === slug);
  if (i < 0) return {};
  return { prev: pages[i - 1], next: pages[i + 1] };
}

export const href = (item: Item) => (item.external ? item.slug : `/docs/${item.slug}/`);
