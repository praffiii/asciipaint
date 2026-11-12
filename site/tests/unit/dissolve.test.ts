import { expect, test } from "vite-plus/test";
import { dissolveMask } from "../../src/lib/dissolve";

const cols = 600;
const rows = 47;
const mask = dissolveMask(cols, rows, 1);
const fill = (y: number) => mask.slice(y * cols, (y + 1) * cols).reduce((a, b) => a + b, 0) / cols;

test("the top row is nearly empty and the bottom row nearly full", () => {
  expect(fill(0)).toBeLessThanOrEqual(0.02);
  expect(fill(rows - 1)).toBeGreaterThanOrEqual(0.95);
});

test("fill rises across 6-row windows", () => {
  const windows: number[] = [];
  for (let y = 0; y + 6 <= rows; y += 6) {
    windows.push(Array.from({ length: 6 }, (_, i) => fill(y + i)).reduce((a, b) => a + b) / 6);
  }
  windows.slice(1).forEach((w, i) => expect(w).toBeGreaterThanOrEqual(windows[i]!));
});

test("the same seed gives the same mask", () => {
  expect(dissolveMask(cols, rows, 1)).toEqual(mask);
});
