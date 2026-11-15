import { expect, test } from "vite-plus/test";
import { open } from "./harness";

test("copy puts the code on the clipboard and announces it", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy logos.html" }).click();
    await page.locator('[aria-live="polite"]').filter({ hasText: "copied" }).waitFor();
    const expected = await page.locator("#one-tag pre").innerText();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected.replace(/\n$/, ""));
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("every keycap takes focus by keyboard and shows a focus outline", async () => {
  const site = await open("/");
  const { page } = site;
  try {
    const keycaps = page.locator('.keycap:visible:not([role="tab"])'); // the phone menu is hidden on desktop; tabs rove, so Tab skips them
    const count = await keycaps.count();
    expect(count).toBeGreaterThan(0);
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
