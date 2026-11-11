import { expect, it } from "vite-plus/test";
import { coverUv, gridFor, lodFor, sourceSize } from "../../src/grid";

it("fits whole cells and scales the fade with width", () => {
  const g = gridFor({ width: 790, height: 400 }, [2.4, 3.4], 60 / 790);
  expect([g.cols, g.rows]).toEqual([329, 117]);
  expect(g.feather).toBeCloseTo(60);
  expect(gridFor({ width: 100, height: 100 }, [2.4, 3.4], 0).feather).toBe(0);
  expect(gridFor({ width: 10, height: 10 }, [2.4, 3.4], 0.5).feather).toBe(5);
  expect(gridFor({ width: 0, height: 0 }, [2.4, 3.4], 0.1)).toEqual({
    cols: 0,
    rows: 0,
    feather: 1,
  });
});

it("reads every source's size", () => {
  expect(
    sourceSize({
      videoWidth: 640,
      videoHeight: 360,
      width: 0,
      height: 0,
    } as unknown as HTMLVideoElement),
  ).toEqual({ width: 640, height: 360 });
  expect(sourceSize({ displayWidth: 320, displayHeight: 240 } as unknown as VideoFrame)).toEqual({
    width: 320,
    height: 240,
  });
  expect(
    sourceSize({
      naturalWidth: 800,
      naturalHeight: 600,
      width: 10,
      height: 10,
    } as unknown as HTMLImageElement),
  ).toEqual({ width: 800, height: 600 });
  expect(sourceSize({ width: 50, height: 40 } as HTMLCanvasElement)).toEqual({
    width: 50,
    height: 40,
  });
});

it("covers, centred, never stretched", () => {
  expect(coverUv({ width: 4, height: 3 }, { width: 4, height: 3 }, false)).toEqual({
    scale: [1, 1],
    offset: [0, 0],
  });
  expect(coverUv({ width: 4, height: 3 }, { width: 4, height: 3 }, true)).toEqual({
    scale: [1, -1],
    offset: [0, 1],
  });
  expect(coverUv({ width: 200, height: 100 }, { width: 1, height: 1 }, false)).toEqual({
    scale: [0.5, 1],
    offset: [0.25, 0],
  });
  expect(coverUv({ width: 100, height: 200 }, { width: 1, height: 1 }, true)).toEqual({
    scale: [1, -0.5],
    offset: [0, 0.75],
  });
});

it("samples at the LOD of 2×2 per cell", () => {
  const g = { cols: 100, rows: 75, feather: 0 };
  expect(lodFor({ width: 4000, height: 3000 }, { scale: [1, 1], offset: [0, 0] }, g)).toBeCloseTo(
    Math.log2(20),
  );
  expect(lodFor({ width: 200, height: 150 }, { scale: [1, 1], offset: [0, 0] }, g)).toBe(0);
  expect(lodFor({ width: 50, height: 50 }, { scale: [1, 1], offset: [0, 0] }, g)).toBe(0);
});
