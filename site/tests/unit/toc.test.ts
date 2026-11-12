import { expect, test } from "vite-plus/test";
import { wavePath } from "../../src/lib/toc";

const d = wavePath(7, 36, 15, 7, 0, 0, 252);
/** Every [x, y] point in the path, end points and handles alike. */
const points = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

test("the wave starts at the left of its swing, at the top", () => {
  expect(d.startsWith("M 8.00 0")).toBe(true);
});

test("the wave stays within its swing", () => {
  for (const [x] of points) {
    expect(x).toBeGreaterThanOrEqual(8);
    expect(x).toBeLessThanOrEqual(22);
  }
});

test("the wave crosses the node column at the middle of every row", () => {
  for (let k = 0; k < 7; k++) {
    expect(points).toContainEqual([15, 18 + 36 * k]);
  }
});
