import type { Page } from "playwright";
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

/** The contexts still alive: a released or dropped one no longer counts against the budget (Ruling R10). */
const live = (page: Page) => page.evaluate(() => [...window.__contexts].filter((ctx) => !ctx.isContextLost()).length);

/** Scrolls `/` from the hero to the footer, then waits until every live part has painted. */
async function scrollLanding(page: Page) {
  for (const band of [".hero", ".ticker", "#install", "#playground", "#one-tag", "#three", "footer"]) {
    await page.locator(band).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }
  await page.locator("[data-playground][data-painting]").waitFor({ state: "attached" });
  await page.locator("[data-three-stage][data-painting]").waitFor({ state: "attached" });
}

test("scrolling the whole landing page leaves at most 6 WebGL2 contexts live", async () => {
  const site = await open("/", { init: countContexts });
  const { page, errors } = site;
  try {
    await scrollLanding(page);
    const count = await live(page);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(6);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("with the playground's 3D scene picked, the landing still has at most 6 WebGL2 contexts live", async () => {
  const site = await open("/", { init: countContexts });
  const { page, errors } = site;
  try {
    await scrollLanding(page);
    await page.locator('#playground [data-source="three"]').click();
    await page.locator('[data-playground][data-painting="three"]').waitFor({ state: "attached", timeout: 20000 });
    await page.waitForTimeout(500);
    const count = await live(page);
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

test("scrolling the whole options page, every demo painted, leaves at most 3 WebGL2 contexts live", async () => {
  const site = await open("/docs/options/", { init: countContexts + countDemos });
  const { page, errors } = site;
  try {
    const demos = page.locator("[data-demo]");
    expect(await demos.count()).toBe(4);
    for (let i = 0; i < 4; i++) await demos.nth(i).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__demos.size === 4, null, { timeout: 15000 });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1000);
    const count = await live(page);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
