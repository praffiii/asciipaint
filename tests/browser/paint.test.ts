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

async function svg(markup: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = "data:image/svg+xml," + encodeURIComponent(markup);
  await img.decode();
  return img;
}

it("lets the background show through transparent pixels", () => {
  const p = make(48, 34, { edgeFade: 0, dpr: 1, background: [1, 0, 0] });
  p.draw(solid("rgba(0,0,0,0)", 8, 8));
  expect(readAll(p).every((c) => c[0] === 255 && c[1] === 0)).toBe(true);
});

it("dissolves half-transparent cells about half the time", () => {
  const p = make(240, 170, { edgeFade: 0, dpr: 1, background: [1, 0, 0] });
  p.draw(solid("rgba(255,255,255,0.5)", 8, 8));
  const all = readAll(p);
  const paper = all.filter((c) => c[0] === 255 && c[1] === 0).length / all.length;
  expect(paper).toBeGreaterThan(0.3);
  expect(paper).toBeLessThan(0.7);
  // Surviving glyphs are white composited over red, so pink, not the grey of the bare samples.
  expect(all.filter((c) => !(c[0] === 255 && c[1] === 0)).every((c) => c[0] > c[1])).toBe(true);
});

it("paints an SVG with only a viewBox", async () => {
  const img = await svg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/></svg>',
  );
  const p = make(48, 34, { edgeFade: 0, dpr: 2, background: [1, 0, 0] });
  p.draw(img);
  expect(readAll(p).some((c) => c[0] === 255 && c[1] === 255)).toBe(true); // white strokes, not skipped
});

it("keeps the aspect of a viewBox-only SVG that WebGL refuses", async () => {
  // Chrome reports this at 150 × 150 and refuses to upload it; the fallback raster must stay square.
  const img = await svg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="3" y="3" width="4" height="4" fill="#fff"/></svg>',
  );
  const p = make(160, 80, { edgeFade: 0, dpr: 2, background: [0, 0, 0] });
  p.draw(img);
  const { cols } = gridFor({ width: 160, height: 80 }, DEFAULTS.cell, 0);
  const lit = cells(p).filter((e) => e.c[0] > 40);
  const litCols = [...new Set(lit.map((e) => e.col))];
  const litRows = new Set(lit.map((e) => e.row));
  const [cw, ch] = DEFAULTS.cell;
  const mid = litCols.reduce((a, b) => a + b, 0) / litCols.length;
  expect(Math.abs(mid - (cols - 1) / 2)).toBeLessThan(2); // centred
  const ratio = (litCols.length * cw) / (litRows.size * ch); // the lit square's width / height in CSS px
  expect(ratio).toBeGreaterThan(0.8);
  expect(ratio).toBeLessThan(1.25);
});

it("keeps a 24 px SVG crisp at 120 px", async () => {
  // 50 × 35 cells sample 100 × 70, so the icon is rasterised at 100 × 100 and its 1-unit stripe
  // spans 50/24 ≈ 2.1 cells (2 lit columns). Uploaded as is, linear magnification smears it wider.
  const img = await svg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24"/><rect x="12" width="1" height="24" fill="#fff"/></svg>',
  );
  const p = make(120, 120, { edgeFade: 0, dpr: 2 });
  p.draw(img);
  const lit = new Set(
    cells(p)
      .filter((e) => e.c[0] > 40)
      .map((e) => e.col),
  );
  expect(lit.size).toBeGreaterThan(0);
  expect(lit.size).toBeLessThanOrEqual(2);
});

it("sizes an off-DOM canvas from an explicit size", () => {
  const p = asciipaint(document.createElement("canvas"), { dpr: 2 });
  paints.push(p);
  p.resize({ width: 60, height: 30 });
  expect([p.canvas.width, p.canvas.height]).toEqual([120, 60]);
});

it("skips a broken image and keeps the last frame", async () => {
  const p = make(48, 34, { edgeFade: 0, dpr: 1 });
  p.draw(solid("#fff", 8, 8));
  const before = readAll(p);
  const broken = new Image();
  broken.src = "data:image/png;base64,AAAA";
  await broken.decode().catch(() => {});
  p.draw(broken);
  expect(gl(p).getError()).toBe(gl(p).NO_ERROR);
  expect(readAll(p)).toEqual(before);
});

/** What a 1×1 canvas reads back for a CSS colour. */
function readback(css: string): Px {
  const g = canvas2d(1, 1, (c) => {
    c.fillStyle = css;
    c.fillRect(0, 0, 1, 1);
  }).getContext("2d")!;
  const [r, g2, b] = g.getImageData(0, 0, 1, 1).data;
  return [r!, g2!, b!];
}

it("paints an oklch background as the sRGB colour the browser resolves it to", () => {
  const css = "oklch(0.3 0.1 250)";
  const p = make(48, 34, { background: css, edgeFade: 0, dpr: 1 });
  p.draw(solid("rgba(0, 0, 0, 0)", 8, 8)); // fully transparent: nothing but paper
  const want = readback(css);
  for (const c of readAll(p)) {
    c.forEach((v, i) => expect(Math.abs(v - want[i]!)).toBeLessThanOrEqual(2));
  }
});

it("accepts display-p3 and still rejects junk backgrounds", () => {
  const p = make(48, 34, { edgeFade: 0, dpr: 1 });
  expect(() => p.set({ background: "color(display-p3 1 0 0)" })).not.toThrow();
  expect(() => p.set({ background: "banana" })).toThrow(RangeError);
});
