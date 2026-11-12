import { expect, test } from "vite-plus/test";
import { cellAverage } from "../../src/lib/layers";

test("cellAverage keeps a split frame split when cells follow the split", () => {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) data.set(x < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * 4 + x) * 4);
  const out = cellAverage(data, 4, 4, [2, 4]);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++)
      expect(Array.from(out.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4))).toEqual(
        x < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255],
      );
});

test("cellAverage gives every pixel of a cell its rounded mean", () => {
  const out = cellAverage(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1, [2, 1]);
  expect([...out]).toEqual([128, 128, 128, 255, 128, 128, 128, 255]);
});
