import type { Page } from "playwright";
import { expect, test } from "vite-plus/test";
import { open, preserve } from "./harness";

declare global {
  interface Window {
    __stickers: Set<Element>;
  }
}

const FILES = [
  "orbit.svg",
  "chevrons.png",
  "petals.svg",
  "hex.png",
  "tide.svg",
  "moon.png",
  "diamonds.svg",
  "dawn.png",
  "leaf.svg",
  "steps.png",
  "cross.svg",
  "nest.png",
];

/** Collects every `<ascii-img>` in the logo wall that fires `paint`; the event doesn't bubble, so it's caught going down. */
const countStickers = `{
  window.__stickers = new Set();
  document.addEventListener("paint", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-sticker]")) window.__stickers.add(e.target);
  }, { capture: true });
}`;

/** Scrolls the whole page down in viewport steps, so every lazy section loads. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 600) {
    await page.evaluate((top) => scrollTo(0, top), y);
    await page.waitForTimeout(100);
  }
}

test("the One tag wall paints 12 stickers, alternating SVG and PNG in the frame's order", async () => {
  const site = await open("/", { init: countStickers });
  const { page, errors } = site;
  try {
    await page.locator("#one-tag .wall").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__stickers.size === 12, null, { timeout: 15000 });
    const stickers = await page.locator("[data-sticker]").evaluateAll((els) =>
      els.map((el) => ({
        file: el.querySelector("[data-file]")?.textContent,
        src: el.querySelector("ascii-img")?.getAttribute("src") ?? "",
        background: el.querySelector("ascii-img")?.getAttribute("background"),
      })),
    );
    expect(stickers.map((s) => s.file)).toEqual(FILES);
    stickers.forEach((s, i) => {
      expect(s.src.startsWith(i % 2 ? "blob:" : "data:image/svg+xml")).toBe(true);
      expect(s.background).toBe("#000000");
    });
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the three.js scene paints once scrolled near", async () => {
  const site = await open("/", { init: preserve });
  const { page, errors } = site;
  try {
    await page.locator("#three").scrollIntoViewIfNeeded();
    const canvas = page.locator("[data-three-stage] canvas");
    await page.locator("[data-three-stage][data-painting]").waitFor({ state: "attached", timeout: 20000 });
    // The scene's lit shapes are far brighter than its navy paper (blue channel 31).
    const brightest = await canvas.evaluate((c: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = c.width;
      copy.height = c.height;
      const ctx = copy.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      let max = 0;
      for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i]!, px[i + 1]!, px[i + 2]!);
      return max;
    });
    expect(brightest).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the footer links GitHub, npm and the licence", async () => {
  const site = await open("/");
  const { page } = site;
  try {
    const hrefs = await page.locator("footer a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "https://github.com/praffiii/asciipaint",
        "https://www.npmjs.com/package/asciipaint",
        "https://github.com/praffiii/asciipaint/blob/main/LICENSE",
      ]),
    );
  } finally {
    await site.close();
  }
});

test("at 390 px the whole landing has no sideways scroll", async () => {
  const site = await open("/", { width: 390 });
  const { page, errors } = site;
  try {
    await scrollThrough(page);
    await page.locator("footer").waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
