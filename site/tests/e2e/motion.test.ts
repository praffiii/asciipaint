import { expect, test } from "vite-plus/test";
import { open, preserve } from "./harness";

test("under reduced motion the hero holds one frame, the slabs stay put and the lens follows the pointer", async () => {
  const site = await open("/", { reducedMotion: true, init: preserve });
  const { page, errors } = site;
  try {
    await page.locator(".hero[data-live]").waitFor({ state: "attached" });
    await page.evaluate(() => new Promise((done) => setTimeout(done, 1000)));
    const read = () => page.locator("[data-hero-painted]").evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const first = await read();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    expect(await read()).toBe(first);

    const box = await page.locator("[data-lens-slab]").boundingBox();
    if (!box) throw new Error("no painted slab");
    const clip = () => page.locator("[data-lens]").evaluate((el) => getComputedStyle(el).clipPath);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    const a = await clip();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55);
    const b = await clip();
    expect(a).toContain("circle(");
    expect(b).toContain("circle(");
    expect(b).not.toBe(a);

    expect(await page.locator("[data-tilt]").evaluate((el) => getComputedStyle(el).transform)).toBe("none");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
