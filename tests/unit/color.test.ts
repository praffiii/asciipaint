import { expect, it } from "vite-plus/test";
import { parseColor, toRgb } from "../../src/color";

it("parses hex and rgb", () => {
  expect(parseColor("#F4EEDF")).toEqual([244 / 255, 238 / 255, 223 / 255]);
  expect(parseColor("#fff")).toEqual([1, 1, 1]);
  expect(parseColor("rgba(255, 0, 0, 0.5)")).toEqual([1, 0, 0]);
  expect(parseColor("rgb(0 255 0)")).toEqual([0, 1, 0]);
  expect(parseColor("banana")).toBeNull();
});

it("passes tuples through and rejects out-of-range ones", () => {
  expect(toRgb([0.5, 0, 1])).toEqual([0.5, 0, 1]);
  expect(() => toRgb([2, 0, 0])).toThrow(RangeError);
  expect(() => toRgb([0, 0] as unknown as [number, number, number])).toThrow(RangeError);
});
