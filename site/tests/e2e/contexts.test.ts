import { expect, test } from "vite-plus/test";
import { open } from "./harness";

declare global {
  interface Window {
    __contexts: Set<WebGL2RenderingContext>;
    __demos: Set<Element>;
  }
}

/** Records every WebGL2 context the page is handed; asking a canvas twice returns the same one, counted once. */
const countContexts = `{
  window.__contexts = new Set();
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = get.call(this, type, ...rest);
    if (type === "webgl2" && ctx) window.__contexts.add(ctx);
    return ctx;
  };
}`;

test("scrolling the whole landing page makes at most 6 WebGL2 contexts", async () => {
  const site = await open("/", { init: countContexts });
  const { page, errors } = site;
  try {
    for (const band of [".hero", ".ticker", "#install", "#playground", "#one-tag", "#three", "footer"]) {
      await page.locator(band).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }
    // Every live part has started, so the count is the page's whole cost.
    await page.locator("[data-playground][data-painting]").waitFor({ state: "attached" });
    await page.locator("[data-three-stage][data-painting]").waitFor({ state: "attached" });
    const count = await page.evaluate(() => window.__contexts.size);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(6);
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

test("scrolling the whole options page, every demo painted, makes at most 3 WebGL2 contexts", async () => {
  const site = await open("/docs/options/", { init: countContexts + countDemos });
  const { page, errors } = site;
  try {
    const demos = page.locator("[data-demo]");
    expect(await demos.count()).toBe(4);
    for (let i = 0; i < 4; i++) await demos.nth(i).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__demos.size === 4, null, { timeout: 15000 });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1000);
    const count = await page.evaluate(() => window.__contexts.size);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
