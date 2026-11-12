import { PNG } from "pngjs";
import type { Page } from "playwright";
import { expect, test } from "vite-plus/test";
import { open, preserve, type Opened } from "./harness";

const SNIPPET = "#code-your-settings-ts";

/** `/playground/` once its first source has painted a frame; `init` runs before the page's scripts. */
async function playground(init = "", width?: number): Promise<Opened> {
  const site = await open("/playground/", { init: preserve + init, width });
  try {
    await site.page.locator('[data-playground][data-painting="liquid"]').waitFor({ state: "attached" });
    return site;
  } catch (error) {
    await site.close();
    throw error;
  }
}

/** The brightest channel in the middle of the stage's painted canvas. */
const stageCentre = (page: Page) =>
  page.locator("[data-stage-flat]").evaluate((c: HTMLCanvasElement) => {
    const copy = document.createElement("canvas");
    copy.width = c.width;
    copy.height = c.height;
    const ctx = copy.getContext("2d")!;
    ctx.drawImage(c, 0, 0);
    const px = ctx.getImageData(c.width / 2 - 8, c.height / 2 - 8, 16, 16).data;
    return Math.max(...px.filter((_, i) => i % 4 !== 3));
  });

/** Drops a file made from a data URL onto the stage, decoded in the page so nothing is fetched. */
const drop = (page: Page, name: string, dataUrl: string) =>
  page.evaluate(
    ({ name, dataUrl }) => {
      const [head = "", body = ""] = dataUrl.split(",");
      const type = head.slice(5).split(";")[0] ?? "";
      const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], name, { type }));
      document
        .querySelector("[data-stage]")
        ?.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
    },
    { name, dataUrl },
  );

function pngDataUrl(): string {
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) png.data.set([x * 4, 255 - y * 4, 200, 255], (y * 64 + x) * 4);
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

const message = (page: Page) => page.locator("[data-message]").innerText();
const pressed = (page: Page, selector: string) => page.locator(selector).getAttribute("aria-pressed");

test("the stage paints the liquid on load", async () => {
  const site = await playground();
  try {
    expect(await stageCentre(site.page)).toBeGreaterThan(0);
    expect(site.errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("the cell slider rebuilds the paint with fewer cells and updates the snippet", async () => {
  const site = await playground();
  const { page, errors } = site;
  try {
    const cells = page.locator("[data-cells]");
    const count = async () => (await cells.innerText()).match(/^(\d+) × (\d+) CELLS$/)?.slice(1).map(Number);
    const old = await cells.innerText();
    const before = await count();
    expect(before).toHaveLength(2);
    await page.locator("[data-cell]").evaluate((input: HTMLInputElement) => {
      input.value = "7";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction((old) => document.querySelector("[data-cells]")?.textContent !== old, old);
    const after = await count();
    expect(after?.[0]).toBeLessThan(before?.[0] ?? 0);
    expect(after?.[1]).toBeLessThan(before?.[1] ?? 0);
    expect(await page.locator(SNIPPET).innerText()).toContain("cell: [7, 9.9]");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("EDIT turns the ramp into a text field that refuses a single glyph", async () => {
  const site = await playground();
  const { page, errors } = site;
  try {
    await page.getByRole("button", { name: "EDIT" }).click();
    const field = page.getByRole("textbox", { name: "Ramp, dark to bright" });
    expect(await field.isVisible()).toBe(true);
    expect(await page.locator("[data-glyph]").first().isVisible()).toBe(false);
    await field.fill("a");
    expect(await field.getAttribute("aria-invalid")).toBe("true");
    expect(await message(page)).toBe("The ramp needs at least 2 glyphs, dark to bright.");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("a long ramp wraps its keys at phone width instead of scrolling the page sideways", async () => {
  const site = await playground("", 390);
  const { page, errors } = site;
  try {
    const bourke = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'";
    expect(Array.from(bourke)).toHaveLength(68);
    await page.getByRole("button", { name: "EDIT" }).click();
    await page.getByRole("textbox", { name: "Ramp, dark to bright" }).fill(bourke);
    await page.keyboard.press("Enter");
    expect(await page.locator("[data-glyph]").count()).toBe(68);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("a background swatch is pressed and lands in the snippet", async () => {
  const site = await playground();
  const { page, errors } = site;
  try {
    await page.locator('[data-swatch="#ECE8FF"]').click();
    expect(await pressed(page, '[data-swatch="#ECE8FF"]')).toBe("true");
    expect(await pressed(page, '[data-swatch="#000000"]')).toBe("false");
    expect(await page.locator(SNIPPET).innerText()).toContain('background: "#ECE8FF"');
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("a dropped picture is painted without a single network request", async () => {
  const site = await playground();
  const { page, errors } = site;
  try {
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await drop(page, "dot.png", pngDataUrl());
    await page.locator('[data-playground][data-painting="file"]').waitFor({ state: "attached" });
    expect(requests).toEqual([]);
    expect(await stageCentre(page)).toBeGreaterThan(0);
    expect(await pressed(page, '[data-source="file"]')).toBe("true");
    expect(await page.locator(SNIPPET).innerText()).toContain("paint.draw(image);");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("a wrong or broken file is refused and the liquid keeps painting", async () => {
  const site = await playground();
  const { page, errors } = site;
  try {
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await drop(page, "notes.txt", `data:text/plain;base64,${btoa("hello")}`);
    await page.locator("[data-message]").filter({ hasText: "Drop an image, a .glb or a .gltf." }).waitFor();
    await drop(page, "broken.png", `data:image/png;base64,${btoa("not a png")}`);
    await page
      .locator("[data-message]")
      .filter({ hasText: "broken.png couldn't be decoded. Try a PNG, JPEG, WebP, GIF or SVG." })
      .waitFor();
    expect(requests).toEqual([]);
    expect(await pressed(page, '[data-source="liquid"]')).toBe("true");
    expect(await page.locator("[data-playground]").getAttribute("data-painting")).toBe("liquid");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

// Headless Chromium has no camera stack (getUserMedia says NotSupportedError), so the denial a
// browser gives when permission is refused is made at the API itself.
const denyCamera = `navigator.mediaDevices.getUserMedia = () =>
  Promise.reject(new DOMException("Permission denied", "NotAllowedError"));`;

test("a blocked camera says how to allow it and the liquid keeps painting", async () => {
  const site = await playground(denyCamera);
  const { page, errors } = site;
  try {
    await page.locator('[data-source="camera"]').click();
    await page
      .locator("[data-message]")
      .filter({
        hasText:
          "Camera access is blocked. Allow the camera for this page in your browser's site settings, then pick Camera again.",
      })
      .waitFor();
    expect(await pressed(page, '[data-source="liquid"]')).toBe("true");
    expect(await pressed(page, '[data-source="camera"]')).toBe("false");
    expect(errors).toEqual([]);
  } finally {
    await site.close();
  }
});

test("Tab runs sources, slider, ramp keys, EDIT, swatches, sparkle, then copy", async () => {
  const site = await playground();
  const { page } = site;
  try {
    await page.locator('[data-source="liquid"]').focus();
    const order: string[] = [];
    for (let i = 0; i < 21; i++) {
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!(el instanceof HTMLElement)) return "";
          const d = el.dataset;
          return d.source ?? d.swatch ?? d.sparkle ?? (el instanceof HTMLInputElement ? el.type : (el.textContent ?? "").trim());
        }),
      );
      await page.keyboard.press("Tab");
    }
    expect(order).toEqual([
      "liquid", "three", "camera", "file",
      "range",
      "-", "=", "+", "*", "#", "%", "@",
      "EDIT",
      "#000000", "#0A0D1F", "#ECE8FF", "#1A2C9A", "#7C5CF2",
      "on", "off",
      "[ copy ]",
    ]);
  } finally {
    await site.close();
  }
});

test("when the playground's code can't load, its message line says so and nothing throws", async () => {
  const site = await open("/");
  const { page, errors } = site;
  try {
    await page.route("**/playground.*.js", (route) => route.abort());
    await page.locator("#playground").scrollIntoViewIfNeeded();
    await page
      .locator("[data-message]")
      .filter({ hasText: "The playground couldn't load. Check your connection, then reload." })
      .waitFor();
    // The browser's own log of the aborted request is expected; nothing else may be.
    expect(errors.filter((e) => e !== "Failed to load resource: net::ERR_FAILED")).toEqual([]);
  } finally {
    await site.close();
  }
});
