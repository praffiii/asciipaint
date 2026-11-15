import { expect, test } from "vite-plus/test";
import { open } from "./harness";

test("the hero paints the liquid live, and the pointer resolves it into fine cells", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    await page.locator(".hero[data-live]").waitFor({ state: "attached" });
    const box = await page.locator("[data-field]").boundingBox();
    if (!box) throw new Error("no hero field");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Warm under a resting pointer, the centre splits all the way down to the finest cells.
    await page.waitForFunction(() => parseInt(document.querySelector("[data-resolved]")?.textContent ?? "0") > 0);
    expect(await page.locator("[data-readout]").innerText()).toMatch(
      /^CELLS 24 × 36 → 3 × 4\.5 · \d+% RESOLVED · LIVE$/,
    );

    // The centre holds painted glyphs, not the black paper.
    const centre = await page.locator("[data-hero-painted]").evaluate((c: HTMLCanvasElement) => {
      const px = c.getContext("2d")!.getImageData(c.width / 2 - 30, c.height / 2 - 30, 60, 60).data;
      return Math.max(...px.filter((_, i) => i % 4 !== 3));
    });
    expect(centre).toBeGreaterThan(0);

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
