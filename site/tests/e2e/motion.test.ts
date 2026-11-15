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

const TITLE_CELL = "#one-tag .painted-still ascii-img";

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

test("a painted title resolves from big cells down to its real ones", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    await page.locator("#one-tag").scrollIntoViewIfNeeded();
    await page.locator(`${TITLE_CELL}[cell="2.4 3.4"]`).waitFor({ state: "attached" });
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("under reduced motion a painted title is painted once, at its real cells", async () => {
  const site = await open("/", { reducedMotion: true });
  const { page } = site;
  try {
    await page.locator("#one-tag").scrollIntoViewIfNeeded();
    await page.locator("#one-tag .painted-title[data-still-painted]").waitFor({ state: "attached" });
    expect(await page.locator(TITLE_CELL).getAttribute("cell")).toBe("2.4 3.4");
  } finally {
    await site.close();
  }
});
