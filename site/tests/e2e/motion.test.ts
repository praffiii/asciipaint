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

const TITLE_CELL = "#one-tag .painted-still ascii-img";

test("the hero title is its own plain text again once it has painted in", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    await page.waitForFunction(() => performance.now() > 1200 && !document.querySelector("#hero-title [data-g]"));
    const title = page.locator("#hero-title");
    expect(await title.innerText()).toBe("Paint anything as coloured ASCII.");
    expect(await title.locator("*").count()).toBe(3); // the two lines and the <em>, no leftover glyph spans
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
