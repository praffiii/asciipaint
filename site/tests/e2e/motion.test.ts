import { expect, test } from "vite-plus/test";
import { open } from "./harness";

test("under reduced motion the hero holds one frame and doesn't claim to be live", async () => {
  const site = await open("/", { reducedMotion: true });
  const { page, errors } = site;
  try {
    await page.locator(".hero[data-live]").waitFor({ state: "attached" });
    await page.evaluate(() => new Promise((done) => setTimeout(done, 1000)));
    const read = () => page.locator("[data-hero-painted]").evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const first = await read();
    const box = await page.locator("[data-field]").boundingBox();
    if (!box) throw new Error("no hero field");
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    expect(await read()).toBe(first);
    expect(await page.locator(".hero .live").isVisible()).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the hero title is its own plain text again once it has painted in", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    await page.waitForFunction(() => performance.now() > 1200 && !document.querySelector("#hero-title [data-g]"));
    const title = page.locator("#hero-title");
    expect(await title.innerText()).toBe("Paint anything as coloured ASCII.");
    expect(await title.locator("*").count()).toBe(0); // no leftover glyph spans
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
