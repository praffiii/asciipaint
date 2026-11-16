import { expect, test } from "vite-plus/test";
import { open, preserve } from "./harness";

test("pnpm then ArrowRight selects yarn and the command follows", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    const tabs = page.getByRole("tablist", { name: "Package manager" });
    await tabs.getByRole("tab", { name: "pnpm" }).click();
    expect(await page.locator("#install-command").textContent()).toBe("$ pnpm add asciipaint");
    await page.keyboard.press("ArrowRight");
    const yarn = tabs.getByRole("tab", { name: "yarn" });
    expect(await yarn.getAttribute("aria-selected")).toBe("true");
    expect(await yarn.evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await page.locator("#install-command").textContent()).toBe("$ yarn add asciipaint");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the three lines copy clean, without their line numbers", async () => {
  const site = await open("/");
  const { page } = site;
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy the three lines" }).click();
    await page.locator('[aria-live="polite"]').filter({ hasText: "copied" }).waitFor();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'import { asciipaint } from "asciipaint";\nconst paint = asciipaint(canvas);\npaint.draw(picture);',
    );
  } finally {
    await site.close();
  }
});

test("the three lines paint for real and the phone layout has no sideways scroll", async () => {
  const site = await open("/", { width: 390, init: preserve });
  const { page, errors } = site;
  try {
    const demo = page.locator("[data-install-demo]");
    await demo.scrollIntoViewIfNeeded();
    // The default paper is cream, so a painted canvas is bright where an unpainted one is clear.
    await page.waitForFunction(() => {
      const c = document.querySelector<HTMLCanvasElement>("[data-install-demo]");
      if (!c?.width) return false;
      const copy = document.createElement("canvas");
      copy.width = c.width;
      copy.height = c.height;
      const ctx = copy.getContext("2d");
      ctx?.drawImage(c, 0, 0);
      return (ctx?.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 !== 3 && v > 0)) ?? false;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the agent prompt copies whole from the landing page and from the docs sidebar", async () => {
  for (const [path, scope] of [
    ["/", "#install"],
    ["/docs/options/", "[data-side]"],
  ] as const) {
    const site = await open(path);
    const { page } = site;
    try {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.locator(scope).getByRole("button", { name: "Copy a prompt for your AI agent" }).click();
      await page.locator('[aria-live="polite"]').filter({ hasText: "copied" }).waitFor();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toMatch(/^Add asciipaint to this project/);
      expect(copied).toContain('use <ascii-img src alt width height> in place of <img>');
      expect(copied).toContain("/llms-full.txt for the exact API");
      expect(copied).toMatch(/see it painted\.$/);
    } finally {
      await site.close();
    }
  }
});
