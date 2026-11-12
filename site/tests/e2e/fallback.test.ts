import { expect, test } from "vite-plus/test";
import { open, type Opened } from "./harness";

/** An init script that makes `getContext("webgl2")` return null wherever `when` holds for the canvas. */
const denyWebGL2 = (when: string) => `{
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return type === "webgl2" && (${when}) ? null : get.call(this, type, ...rest);
  };
}`;

/** The painted slab shows the lens unclipped, and nothing claims to be live. */
async function expectFallback({ page }: Opened, mode: "gradient" | "source") {
  await page.locator(`.hero[data-fallback="${mode}"]`).waitFor({ state: "attached" });
  expect(await page.locator("[data-hero-painted]").isVisible()).toBe(false);
  const lens = page.locator("[data-lens]");
  expect(await lens.isVisible()).toBe(true);
  expect(await lens.evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
  expect(await page.locator("[data-readout]").innerText()).toMatch(/^02 PAINTED · \d+ × \d+ CELLS$/);
  expect(await page.locator(".hud").isVisible()).toBe(false);
}

test("without WebGL2 the page still reads, the hero shows a still gradient and nothing throws", async () => {
  const site = await open("/", { init: denyWebGL2("true") });
  const { page, errors } = site;
  try {
    await expectFallback(site, "gradient");
    expect(await page.locator("[data-lens]").evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
      "linear-gradient",
    );
    expect(await page.locator("h1").isVisible()).toBe(true);
    const titles = page.locator(".painted-title .painted-text");
    for (let i = 0; i < (await titles.count()); i++) {
      expect(await titles.nth(i).evaluate((el) => getComputedStyle(el).color)).not.toBe("rgba(0, 0, 0, 0)");
    }
    await page.evaluate(() => new Promise((done) => setTimeout(done, 500)));
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("when only the hero's painting fails, its slab shows the live unpainted source", async () => {
  const site = await open("/", { init: denyWebGL2('this.hasAttribute("data-hero-painted")') });
  const { page, errors } = site;
  try {
    await expectFallback(site, "source");
    // The lens copies the liquid source, so it holds real pixels rather than a CSS backdrop.
    await page.waitForFunction(() => {
      const lens = document.querySelector<HTMLCanvasElement>("[data-lens]");
      const ctx = lens?.getContext("2d");
      if (!lens?.width || !ctx) return false;
      const px = ctx.getImageData(lens.width / 2, lens.height / 2, 1, 1).data;
      return (px[0] ?? 0) + (px[1] ?? 0) + (px[2] ?? 0) > 0;
    });
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
