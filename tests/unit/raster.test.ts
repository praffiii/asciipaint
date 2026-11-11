import { expect, it } from "vite-plus/test";
import { rasterSize } from "../../src/raster";

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
