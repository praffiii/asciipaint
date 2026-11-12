import { expect, test } from "vite-plus/test";
import { NAV } from "../../src/data/nav";
import { open } from "./harness";

declare global {
  interface Window {
    __demos: Set<Element>;
  }
}

const pages = NAV.flatMap((g) => g.items)
  .filter((i) => !i.external)
  .map((i) => `/docs/${i.slug}/`);

test("every docs page is built, reads as one h1 and its sections, and links only to built pages", async () => {
  expect(pages).toHaveLength(11);
  const site = await open(pages[0]!);
  const { page, errors } = site;
  try {
    const base = new URL(page.url()).origin;
    const links = new Set<string>();
    for (const path of pages) {
      const response = await page.goto(base + path, { waitUntil: "load" });
      expect(response?.status(), path).toBe(200);
      const shape = await page.evaluate(() => {
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        return {
          h1: document.querySelectorAll("h1").length,
          h2: document.querySelectorAll("article h2[id]").length,
          duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
          links: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map((a) => a.getAttribute("href")!),
          missingAnchors: [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
            .map((a) => a.getAttribute("href")!.slice(1))
            .filter((id) => id !== "top" && !document.getElementById(id)),
        };
      });
      expect(shape.h1, path).toBe(1);
      expect(shape.h2, path).toBeGreaterThanOrEqual(2);
      expect(shape.duplicateIds, path).toEqual([]);
      expect(shape.missingAnchors, path).toEqual([]);
      for (const href of shape.links) if (href.startsWith("/")) links.add(href.split("#")[0]!);
    }
    for (const path of links) {
      const response = await page.request.get(base + path);
      expect(response.status(), path).toBe(200);
    }
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("every code block on every docs page sits in a card with a copy button for exactly its code", async () => {
  const site = await open(pages[0]!);
  const { page, errors } = site;
  try {
    const base = new URL(page.url()).origin;
    let blocks = 0;
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: "load" });
      const cards = await page.locator("article pre").evaluateAll((pres) =>
        pres.map((pre) => {
          const button = pre.closest("figure")?.querySelector<HTMLElement>("[data-copy]");
          const target = button && document.getElementById(button.dataset.copy ?? "");
          return {
            label: button?.textContent?.trim(),
            copiesThisBlock: !!target && (target === pre || target.contains(pre) || pre.contains(target)),
            sameText: target?.textContent?.trim() === pre.textContent?.trim(),
          };
        }),
      );
      expect(cards.length, path).toBeGreaterThan(0);
      for (const card of cards) expect(card, path).toEqual({ label: "[ copy ]", copiesThisBlock: true, sameText: true });
      blocks += cards.length;
    }
    expect(blocks).toBeGreaterThan(pages.length);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

/** Collects every `<ascii-img>` inside an option demo that fires `paint`; the event doesn't bubble, so it's caught going down. */
const countDemos = `{
  window.__demos = new Set();
  document.addEventListener("paint", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-demo]")) window.__demos.add(e.target);
  }, { capture: true });
}`;

test("the four option demos paint once scrolled into view", async () => {
  const site = await open("/docs/options/", { init: countDemos });
  const { page, errors } = site;
  try {
    const demos = page.locator("[data-demo]");
    expect(await demos.count()).toBe(4);
    for (let i = 0; i < 4; i++) {
      await demos.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    }
    await page.waitForFunction(() => window.__demos.size === 4, null, { timeout: 15000 });
    expect(await page.locator("[data-demo]").evaluateAll((els) => els.map((el) => el.querySelectorAll("ascii-img").length))).toEqual([
      1, 1, 1, 1,
    ]);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the painted option demos are hidden from assistive tech, so no image is left without a name", async () => {
  const site = await open("/docs/options/", { init: countDemos });
  const { page, errors } = site;
  try {
    const demos = page.locator("[data-demo]");
    for (let i = 0; i < 4; i++) await demos.nth(i).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__demos.size === 4, null, { timeout: 15000 });
    expect(await page.locator("[data-demo] ascii-img:not([aria-hidden=true])").count()).toBe(0);
    // An image the accessibility tree exposes always has a name; the painted titles read as their text.
    expect(await page.locator("body").ariaSnapshot()).not.toMatch(/- img\s*$/m);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
