import { expect, test } from "vite-plus/test";
import { open } from "./harness";

const noWebGL2 = `{
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return type === "webgl2" ? null : get.call(this, type, ...rest);
  };
}`;

test("without WebGL2 the page still reads and nothing throws", async () => {
  const site = await open("/", { init: noWebGL2 });
  const { page, errors } = site;
  try {
    await page.evaluate(() => new Promise((done) => setTimeout(done, 500)));
    expect(errors).toEqual([]);
    expect(await page.locator("h1").isVisible()).toBe(true);

    const titles = page.locator(".painted-title .painted-text");
    for (let i = 0; i < (await titles.count()); i++) {
      expect(await titles.nth(i).evaluate((el) => getComputedStyle(el).color)).not.toBe("rgba(0, 0, 0, 0)");
    }

    // The painted slab shows the unpainted source in full.
    const lens = page.locator("[data-lens]");
    expect(await lens.isVisible()).toBe(true);
    expect(await lens.evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
    expect(await page.locator("[data-painted]").isVisible()).toBe(false);
  } finally {
    await site.close();
  }
});
