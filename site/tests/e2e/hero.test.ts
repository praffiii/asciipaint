import { expect, test } from "vite-plus/test";
import { open, preserve } from "./harness";

test("the hero paints the liquid live, counts its cells, and lenses to the original", async () => {
  const site = await open("/", { init: preserve });
  const { page, errors } = site;
  try {
    await page.locator(".hero[data-live]").waitFor({ state: "attached" });

    // The centre of the painted slab is painted, not the black paper.
    const centre = await page.locator("[data-hero-painted]").evaluate((c: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = c.width;
      copy.height = c.height;
      const ctx = copy.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      const px = ctx.getImageData(c.width / 2 - 6, c.height / 2 - 6, 12, 12).data;
      return Math.max(...px.filter((_, i) => i % 4 !== 3));
    });
    expect(centre).toBeGreaterThan(0);

    const size = await page
      .locator("[data-hero-painted]")
      .evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight }));
    const readout = await page.locator("[data-readout]").innerText();
    const match = readout.match(/^02 PAINTED · (\d+) × (\d+) CELLS · LIVE$/);
    expect(match, readout).not.toBeNull();
    expect(Number(match?.[1])).toBe(Math.floor(size.w / 2.4));
    expect(Number(match?.[2])).toBe(Math.floor(size.h / 3.4));

    const box = await page.locator("[data-lens-slab]").boundingBox();
    if (!box) throw new Error("no painted slab");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const clip = await page.locator("[data-lens]").evaluate((el) => getComputedStyle(el).clipPath);
    expect(clip).toContain("circle(");
    const [x = NaN, y = NaN] = (clip.match(/at ([\d.]+)px ([\d.]+)px/) ?? []).slice(1).map(Number);
    expect(Math.abs(x - size.w / 2)).toBeLessThan(12);
    expect(Math.abs(y - size.h / 2)).toBeLessThan(12);

    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("$ npm i asciipaint copies the install command", async () => {
  const site = await open("/");
  const { page } = site;
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator('.hero [data-copy]').click();
    await page.locator('[aria-live="polite"]').filter({ hasText: "copied" }).waitFor();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("npm i asciipaint");
  } finally {
    await site.close();
  }
});
