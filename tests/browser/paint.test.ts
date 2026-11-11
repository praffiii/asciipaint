import { afterEach, expect, it, vi } from "vite-plus/test";
import { asciipaint, type Options, type Paint } from "../../src/index";
import { gridFor } from "../../src/grid";
import { DEFAULTS } from "../../src/options";

type Px = [number, number, number];
interface CellPx {
  col: number;
  row: number;
  c: Px;
}

const paints: Paint[] = [];
const dprOwn = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");

afterEach(() => {
  vi.restoreAllMocks();
  for (const p of paints.splice(0)) {
    p.dispose();
    p.canvas.remove();
  }
  if (dprOwn) Object.defineProperty(window, "devicePixelRatio", dprOwn);
  else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
});

function make(w: number, h: number, opts: Options): Paint {
  const c = document.createElement("canvas");
  c.style.cssText = `display:block;width:${w}px;height:${h}px`;
  document.body.append(c);
  const p = asciipaint(c, opts);
  paints.push(p);
  return p;
}

const gl = (p: Paint) => p.canvas.getContext("webgl2")!;

function px(p: Paint, x: number, y: number): Px {
  const g = gl(p);
  const out = new Uint8Array(4);
  g.readPixels(x, g.drawingBufferHeight - 1 - y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, out);
  return [out[0]!, out[1]!, out[2]!];
}

/** Every device pixel inside the grid, with its cell (origin top-left). */
function cells(p: Paint): CellPx[] {
  const g = gl(p);
  const w = g.drawingBufferWidth;
  const h = g.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, buf);
  const css = { width: p.canvas.clientWidth, height: p.canvas.clientHeight };
  const dpr = w / css.width;
  const [cw, ch] = DEFAULTS.cell;
  const { cols, rows } = gridFor(css, DEFAULTS.cell, 0);
  const out: CellPx[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = Math.floor((x + 0.5) / dpr / cw);
      const row = Math.floor((y + 0.5) / dpr / ch);
      if (col >= cols || row >= rows) continue;
      const i = ((h - 1 - y) * w + x) * 4;
      out.push({ col, row, c: [buf[i]!, buf[i + 1]!, buf[i + 2]!] });
    }
  }
  return out;
}

const readAll = (p: Paint): Px[] => cells(p).map((e) => e.c);

function canvas2d(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!);
  return c;
}

const solid = (colour: string, w: number, h: number) =>
  canvas2d(w, h, (g) => {
    g.fillStyle = colour;
    g.fillRect(0, 0, w, h);
  });

/** Left `dark` fraction black, the rest white. */
const stripe = (w: number, h: number, dark: number) =>
  canvas2d(w, h, (g) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w * dark, h);
  });

it("paints a white source as bright glyph strokes on dark gaps, never the paper", () => {
  // dpr 2: at dpr 1 a 4.4 px glyph has no fully covered pixel (atlas alpha peaks near 0.8).
  const p = make(48, 34, { edgeFade: 0, dpr: 2 });
  p.draw(solid("#fff", 64, 64));
  const all = readAll(p);
  expect(all.some((c) => c[0] === 255)).toBe(true); // stroke = min(1.15, 1)
  expect(Math.min(...all.map((c) => c[0]))).toBeGreaterThanOrEqual(139); // gap = 0.55
});

it("dissolves the edge into a live background", () => {
  // 201 × 101 → 83 × 29 cells (199.2 × 98.6 px), so (200, 100) is off the grid.
  const p = make(201, 101, { dpr: 1, background: [1, 0, 0] });
  p.draw(solid("#888", 64, 64));
  expect(px(p, 200, 100)).toEqual([255, 0, 0]);

  const { cols, rows } = gridFor({ width: 201, height: 101 }, DEFAULTS.cell, 0);
  const all = cells(p);
  const isPaper = (e: CellPx) => e.c.join() === "255,0,0";
  const ring = all.filter(
    (e) => e.col === 0 || e.row === 0 || e.col === cols - 1 || e.row === rows - 1,
  );
  const centre = all.filter((e) => e.col === cols >> 1 && e.row === rows >> 1);
  // Analytically ≈ 0.81 (mean of 1 − fade over the ring); the GPU's float32 hash lands near 0.77.
  expect(ring.filter(isPaper).length / ring.length).toBeGreaterThanOrEqual(0.7);
  expect(centre.length).toBeGreaterThan(0);
  expect(centre.filter(isPaper)).toEqual([]);

  p.set({ background: "#00ff00" });
  p.draw(solid("#888", 64, 64));
  expect(px(p, 200, 100)).toEqual([0, 255, 0]);
});

it("crops a wide photo instead of stretching it", () => {
  const src = stripe(400, 100, 0.25); // 4:1, left 25 % black, the rest white
  const p = make(100, 100, { edgeFade: 0, dpr: 1 });
  p.draw(src);
  expect(px(p, 2, 50)[0]).toBeGreaterThan(130); // cover shows u 0.375–0.625: all white; a stretch would show black here
});

it("skips sources that are not ready and keeps the last frame", () => {
  const p = make(48, 34, { edgeFade: 0, dpr: 1 });
  p.draw(solid("#fff", 8, 8));
  const before = readAll(p);
  p.draw(document.createElement("video")); // readyState 0
  p.draw(new Image()); // naturalWidth 0
  expect(gl(p).getError()).toBe(gl(p).NO_ERROR);
  expect(readAll(p)).toEqual(before);
});

it("survives a zero-size or sub-cell canvas", () => {
  for (const [w, h] of [
    [0, 0],
    [2, 2],
  ] as const) {
    const p = make(w, h, {});
    expect(() => {
      p.resize();
      p.draw(solid("#fff", 8, 8));
    }).not.toThrow();
    expect(gl(p).getError()).toBe(gl(p).NO_ERROR);
  }
});

it("rebuilds the atlas when devicePixelRatio changes", () => {
  const p = make(48, 34, { edgeFade: 0 });
  Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  p.resize();
  expect(p.canvas.width).toBe(48);
  Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
  p.resize();
  expect(p.canvas.width).toBe(96);
  p.draw(solid("#fff", 8, 8));
  expect(readAll(p).some((c) => c[0] === 255)).toBe(true);
});

it("rejects bad live options without changing state", () => {
  const p = make(48, 34, {});
  expect(() => p.set({ edgeFade: 2 })).toThrow(RangeError);
  expect(() => p.set({ background: "banana" })).toThrow(RangeError);
});

it("paints the same canvas again after dispose", () => {
  const first = make(48, 34, { edgeFade: 0, dpr: 2 });
  first.dispose();
  const p = asciipaint(first.canvas, { edgeFade: 0, dpr: 2 });
  paints.push(p);
  p.draw(solid("#fff", 8, 8));
  expect(gl(p).getError()).toBe(gl(p).NO_ERROR);
  expect(readAll(p).some((c) => c[0] === 255)).toBe(true);
});

it("repaints a still once the font loads", async () => {
  let loaded = () => {};
  vi.spyOn(document.fonts, "load").mockReturnValue(
    new Promise<FontFace[]>((r) => (loaded = () => r([]))),
  );
  const p = make(48, 34, { edgeFade: 0, dpr: 1 });
  const passes = vi.spyOn(gl(p), "drawArrays");
  p.draw(solid("#fff", 8, 8));
  expect(passes).toHaveBeenCalledTimes(2);
  loaded();
  await new Promise((r) => setTimeout(r, 0));
  expect(passes).toHaveBeenCalledTimes(4);
});

it("skips an image that has a layout size but no pixels yet", () => {
  const p = make(48, 34, { edgeFade: 0, dpr: 1 });
  p.draw(solid("#fff", 50, 50));
  const before = readAll(p);
  p.draw(new Image(50, 50)); // no src: width 50, naturalWidth 0
  expect(gl(p).getError()).toBe(gl(p).NO_ERROR);
  expect(readAll(p)).toEqual(before);
});

it("keeps the source upright", () => {
  const p = make(48, 34, { edgeFade: 0, dpr: 1 });
  p.draw(
    canvas2d(64, 64, (g) => {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#000";
      g.fillRect(0, 0, 64, 32); // black on top, white below
    }),
  );
  const { rows } = gridFor({ width: 48, height: 34 }, DEFAULTS.cell, 0);
  const all = cells(p);
  const top = all.filter((e) => e.row === 0).map((e) => e.c[0]);
  const bottom = all.filter((e) => e.row === rows - 1).map((e) => e.c[0]);
  expect(Math.max(...top)).toBeLessThan(10);
  expect(Math.min(...bottom)).toBeGreaterThan(130);
});

it("names a lost context instead of failing deep inside", () => {
  const c = document.createElement("canvas");
  c.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
  expect(() => asciipaint(c)).toThrow("asciipaint: the WebGL2 context is lost");
});
