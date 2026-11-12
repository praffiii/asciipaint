import { expect, test } from "vite-plus/test";
import { NAV } from "../../src/data/nav";
import { open } from "./harness";

const hrefs = NAV.flatMap((g) => g.items).map((i) => (i.external ? i.slug : `/docs/${i.slug}/`));

test("the sidebar lists every page in order and marks the current one", async () => {
  const site = await open("/docs/install/");
  const { page, errors } = site;
  try {
    const links = page.getByRole("navigation", { name: "Docs" }).first().locator("a");
    expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(hrefs);
    expect(hrefs).toHaveLength(12);
    const current = page.getByRole("navigation", { name: "Docs" }).first().locator('[aria-current="page"]');
    expect(await current.getAttribute("href")).toBe("/docs/install/");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("at phone width the menu is a dialog that Escape closes, handing focus back", async () => {
  const site = await open("/docs/install/", { width: 390 });
  const { page, errors } = site;
  try {
    const button = page.getByRole("button", { name: "Menu" });
    await button.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const names = await dialog.getByRole("navigation", { name: "Docs" }).locator("a").evaluateAll((as) =>
      as.map((a) => [a.getAttribute("href"), a.textContent?.trim()]),
    );
    expect(names.slice(0, 12).map(([href]) => href)).toEqual(hrefs);
    expect(names.slice(12).map(([, text]) => text)).toEqual(["GitHub ↗", "npm ↗"]);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    expect(await button.evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the rail scrolls back to the top and links to the page's source", async () => {
  const site = await open("/docs/install/");
  const { page, errors } = site;
  try {
    await page.mouse.wheel(0, 600);
    await page.waitForFunction(() => scrollY > 0);
    await page.getByRole("link", { name: "Back to top" }).click();
    await page.waitForFunction(() => scrollY === 0);
    expect(await page.getByRole("link", { name: "Edit on GitHub" }).getAttribute("href")).toBe(
      "https://github.com/praffiii/asciipaint/edit/main/site/src/content/docs/install.mdx",
    );
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the rail marks the heading being read", async () => {
  const site = await open("/docs/install/");
  const { page, errors } = site;
  try {
    const rail = page.getByRole("navigation", { name: "On this page" });
    const items = rail.locator("ol a");
    expect(await items.count()).toBeGreaterThan(1);
    expect(await items.first().getAttribute("aria-current")).toBe("location");
    const last = await page.locator("article h2[id]").last().getAttribute("id");
    await page.evaluate((id) => document.getElementById(id!)!.scrollIntoView(), last);
    await page.waitForFunction(() =>
      document.querySelector('[data-toc] ol li:last-child a')?.getAttribute("aria-current") === "location",
    );
    expect(await rail.locator('[aria-current="location"]').count()).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("under reduced motion the wave holds still", async () => {
  const site = await open("/docs/install/", { reducedMotion: true });
  const { page, errors } = site;
  try {
    const wave = page.locator("[data-toc] [data-wave]");
    await page.waitForFunction(() => document.querySelector("[data-toc] [data-wave]")?.getAttribute("d"));
    const before = await wave.getAttribute("d");
    await page.evaluate(() => new Promise((done) => setTimeout(done, 1000)));
    expect(await wave.getAttribute("d")).toBe(before);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
