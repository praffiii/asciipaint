import { expect, test } from "vite-plus/test";
import { open } from "./harness";

test.each([1440, 390])("the landing page renders cleanly at %i px", async (width) => {
  const site = await open("/", { width });
  const { page, errors } = site;
  try {
    expect(await page.locator("h1").innerText()).toBe("Paint anything as coloured ASCII.");
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  } finally {
    await site.close();
  }
});
