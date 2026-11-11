import { expect, it } from "vite-plus/test";
import { isSvgUrl, rasterSize } from "../../src/raster";

// sample = the grid's sample size, { 2·cols, 2·rows } device px
it("rasterises images with no intrinsic size at the sample size", () =>
  expect(rasterSize({ width: 0, height: 0 }, { width: 100, height: 60 })).toEqual({
    width: 100,
    height: 60,
  }));

it("upscales small images keeping their aspect, to cover the sample", () =>
  expect(rasterSize({ width: 24, height: 12 }, { width: 100, height: 100 })).toEqual({
    width: 200,
    height: 100,
  }));

it("leaves images that already cover the sample alone", () =>
  expect(rasterSize({ width: 800, height: 600 }, { width: 100, height: 75 })).toBeNull());

it("caps rasters at 4096 px a side, keeping the aspect", () => {
  const s = rasterSize({ width: 1, height: 1000 }, { width: 100, height: 100 })!;
  expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(4096);
  expect(Math.abs(s.width - s.height / 1000)).toBeLessThanOrEqual(1);
});

it("spots SVG urls by data type or .svg path, ignoring case, query and hash", () => {
  expect(isSvgUrl("data:image/svg+xml,%3Csvg/%3E", "https://x.test/")).toBe(true);
  expect(isSvgUrl("data:image/svg+xml;base64,PHN2Zy8+", "https://x.test/")).toBe(true);
  expect(isSvgUrl("https://x.test/logo.svg?v=2#a", "https://x.test/")).toBe(true);
  expect(isSvgUrl("https://x.test/img/LOGO.SVG", "https://x.test/")).toBe(true);
  expect(isSvgUrl("https://x.test/logo.png?f=a.svg", "https://x.test/")).toBe(false);
  expect(isSvgUrl("data:image/png;base64,AAAA", "https://x.test/")).toBe(false);
  expect(isSvgUrl("blob:https://x.test/1234", "https://x.test/")).toBe(false);
});
