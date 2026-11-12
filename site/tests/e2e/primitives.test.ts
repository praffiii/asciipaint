import { expect, test } from "vite-plus/test";
import { open } from "./harness";

test("copy puts the card's code on the clipboard and announces it", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "[ copy ]" }).first().click();
    await page.locator('[aria-live="polite"]').filter({ hasText: "copied" }).waitFor();
    const expected = await page.locator("pre").first().innerText();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected.replace(/\n$/, ""));
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("every keycap has a hard edge and a visible focus outline", async () => {
  const site = await open("/");
  const { page } = site;
  try {
    const keycaps = page.locator(".keycap");
    const count = await keycaps.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const shadow = await keycaps.nth(i).evaluate((el) => getComputedStyle(el).boxShadow);
      // computed form: "rgb(r, g, b) 4px 4px 0px 0px" — offsets, then blur
      expect(shadow).toMatch(/\d+px \d+px 0px/);
    }
    for (let i = 0; i < count; i++) {
      await keycaps.nth(i).focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      expect(await keycaps.nth(i).evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await keycaps.nth(i).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    }
  } finally {
    await site.close();
  }
});
