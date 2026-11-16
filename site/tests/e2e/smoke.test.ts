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

test("the tab icons load", async () => {
  const site = await open("/");
  try {
    const hrefs = await site.page
      .locator('link[rel="icon"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
    expect(hrefs.map((href) => new URL(href).pathname)).toEqual(["/favicon.ico", "/favicon.svg"]);
    for (const href of hrefs) expect((await site.page.request.get(href)).status()).toBe(200);
  } finally {
    await site.close();
  }
});
