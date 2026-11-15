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

test("every keycap has a hard edge (or, pressed, has moved onto it) and a visible focus outline", async () => {
  const site = await open("/");
  const { page } = site;
  try {
    const keycaps = page.locator('.keycap:visible:not([role="tab"])'); // the phone menu is hidden on desktop; tabs rove, so Tab skips them
    const count = await keycaps.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const { pressed, shadow, transform } = await keycaps.nth(i).evaluate((el) => ({
        pressed: el.getAttribute("aria-pressed") === "true",
        shadow: getComputedStyle(el).boxShadow,
        transform: getComputedStyle(el).transform,
      }));
      if (pressed) {
        // pressed: moved by the offset onto where its edge was, so no edge is left
        expect(shadow).toBe("none");
        expect(transform).not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
      } else {
        // computed form: "rgb(r, g, b) 4px 4px 0px 0px" — offsets, then blur
        expect(shadow).toMatch(/[1-9]\d*px [1-9]\d*px 0px/);
      }
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
