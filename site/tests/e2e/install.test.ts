import { expect, test } from "vite-plus/test";
import { open } from "./harness";

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

test("the CDN card copies the exact script block", async () => {
  const site = await open("/");
  const { page } = site;
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("#install .card").getByRole("button", { name: "[ copy ]" }).click();
    await page.locator('[aria-live="polite"]').filter({ hasText: "copied" }).waitFor();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      '<script type="module">\n  import { asciipaint }\n    from "https://esm.sh/asciipaint";\n</script>',
    );
  } finally {
    await site.close();
  }
});

test("the three layers paint and the phone stack has no sideways scroll", async () => {
  const site = await open("/", { width: 390 });
  const { page, errors } = site;
  try {
    await page.locator("#stack").scrollIntoViewIfNeeded();
    await page.locator("#stack [data-painted]").first().waitFor({ timeout: 10000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});
