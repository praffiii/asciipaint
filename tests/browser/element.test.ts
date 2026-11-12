import { afterEach, expect, it, vi } from "vite-plus/test";
import "../../src/element";

const mounted: Element[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
});

function mount(html: string): Element {
  const t = document.createElement("template");
  t.innerHTML = html;
  const el = t.content.firstElementChild!;
  document.body.append(el);
  mounted.push(el);
  return el;
}

const painted = (el: Element) =>
  new Promise<void>((r) => el.addEventListener("paint", () => r(), { once: true }));

function png(fill: string): string {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = fill;
  g.fillRect(0, 0, 64, 64);
  return c.toDataURL();
}
const whitePng = png("#fff");
const transparentPng = png("rgba(0,0,0,0)");

const canvasOf = (el: Element) => el.shadowRoot!.querySelector("canvas")!;

function pixel(el: Element, x: number, y: number): number[] {
  const d = canvasOf(el).getContext("2d")!.getImageData(x, y, 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}

/** Glyph strokes and the dark gaps between them, so not a blank or flat canvas. */
function bright(c: HTMLCanvasElement): boolean {
  if (!c.width || !c.height) return false;
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  let stroke = false;
  let gap = false;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]! > 200) stroke = true;
    else if (d[i]! < 160) gap = true;
  }
  return stroke && gap;
}

it("paints its image into its own canvas at its size", async () => {
  const el = mount(`<ascii-img src="${whitePng}" alt="logo" width="120" height="60"></ascii-img>`);
  await painted(el);
  const c = canvasOf(el);
  expect(c.getBoundingClientRect().width).toBe(120);
  expect(bright(c)).toBe(true);
});

it("takes the image's natural size without width and height", async () => {
  const el = mount(`<ascii-img src="${whitePng}"></ascii-img>`);
  expect(canvasOf(el).getBoundingClientRect().width).toBe(0); // like <img>, nothing until it loads
  await painted(el);
  const { width, height } = canvasOf(el).getBoundingClientRect();
  expect([width, height]).toEqual([64, 64]);
});

it("reads as an image to assistive tech", () => {
  const el = mount(`<ascii-img src="${whitePng}" alt="Claude logo"></ascii-img>`);
  expect([el.getAttribute("role"), el.getAttribute("aria-label")]).toEqual(["img", "Claude logo"]);
});

it("takes the page's background by default", async () => {
  const el = mount(
    `<div style="background:#123456"><ascii-img src="${transparentPng}" width="48" height="34"></ascii-img></div>`,
  ).firstElementChild!;
  await painted(el);
  expect(pixel(el, 1, 1)).toEqual([0x12, 0x34, 0x56]);
});

it("takes the page's background when told a transparent one", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const el = mount(
    `<div style="background:#123456"><ascii-img src="${transparentPng}" width="48" height="34" background="transparent"></ascii-img></div>`,
  ).firstElementChild!;
  await painted(el);
  expect(pixel(el, 1, 1)).toEqual([0x12, 0x34, 0x56]);
});

it("fires error when its image fails to load", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const el = mount(`<ascii-img src="/missing.png" width="48" height="34"></ascii-img>`);
  await new Promise((r) => el.addEventListener("error", r, { once: true }));
});

it("reads a modern CSS background and skips a transparent one", async () => {
  const el = mount(
    `<div style="background:oklch(0.3 0.1 250)"><div style="background:oklch(0.5 0.1 250 / 0)">` +
      `<ascii-img src="${transparentPng}" width="48" height="34"></ascii-img></div></div>`,
  ).querySelector("ascii-img")!;
  await painted(el);
  // oklch(0.3 0.1 250) is sRGB ≈ (0, 46, 93) via OKLab (red just out of gamut, clipped).
  const [r, g, b] = pixel(el, 1, 1);
  expect([r! <= 2, Math.abs(g! - 46) <= 2, Math.abs(b! - 93) <= 2]).toEqual([true, true, true]);
});

it("looks past a shadow root for the page background", async () => {
  const host = mount(`<div style="background:#123456"><div></div></div>`).firstElementChild!;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<ascii-img src="${transparentPng}" width="48" height="34"></ascii-img>`;
  const el = root.firstElementChild!;
  await painted(el);
  expect(pixel(el, 1, 1)).toEqual([0x12, 0x34, 0x56]);
});

it("paints 24 elements on one shared WebGL context", async () => {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  const els = Array.from({ length: 24 }, () =>
    mount(`<ascii-img src="${whitePng}" width="40" height="40"></ascii-img>`),
  );
  await Promise.all(els.map(painted));
  // 0 if an earlier test already made the shared painter.
  expect(spy.mock.calls.filter(([type]) => type === "webgl2").length).toBeLessThanOrEqual(1);
  expect(els.every((el) => bright(canvasOf(el)))).toBe(true);
});

it("repaints when an attribute changes", async () => {
  const el = mount(
    `<ascii-img src="${transparentPng}" width="48" height="34" background="#f00"></ascii-img>`,
  );
  await painted(el);
  el.setAttribute("background", "#00f");
  await painted(el);
  expect(pixel(el, 1, 1)).toEqual([0, 0, 255]); // fully transparent source: pure background
});

it("warns once about a bad attribute and paints with its default", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const el = mount(
    `<ascii-img src="${transparentPng}" width="48" height="34" background="#f00" edge-fade="2"></ascii-img>`,
  );
  await painted(el);
  el.setAttribute("background", "#0f0");
  await painted(el);
  expect(warn).toHaveBeenCalledOnce();
  expect(String(warn.mock.calls[0]![0])).toContain("edge-fade");
  expect(pixel(el, 1, 1)).toEqual([0, 255, 0]);
});
