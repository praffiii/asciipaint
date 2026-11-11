import { expect, it } from "vite-plus/test";
import { parseColor, toRgb } from "../../src/color";

it("parses hex and rgb", () => {
  expect(parseColor("#F4EEDF")).toEqual([244 / 255, 238 / 255, 223 / 255]);
  expect(parseColor("#fff")).toEqual([1, 1, 1]);
  expect(parseColor("rgba(255, 0, 0, 0.5)")).toEqual([1, 0, 0]);
  expect(parseColor("rgb(0 255 0)")).toEqual([0, 1, 0]);
  expect(parseColor("banana")).toBeNull();
});

it("normalizes names, rejects junk and out-of-range tuples", () => {
  expect(toRgb("white", () => "#ffffff")).toEqual([1, 1, 1]);
  expect(() => toRgb("banana", (s) => s)).toThrow(RangeError);
  expect(() => toRgb([2, 0, 0], (s) => s)).toThrow(RangeError);
});
