import { afterEach, expect, it } from "vite-plus/test";
import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { asciipaintThree, type ThreePaint } from "../../src/three";
import { gridFor } from "../../src/grid";
import { DEFAULTS } from "../../src/options";

type Px = [number, number, number];

const made: { r: WebGLRenderer; p?: ThreePaint }[] = [];
afterEach(() => {
  for (const { r, p } of made.splice(0)) {
    p?.dispose();
    r.dispose();
    r.domElement.remove();
  }
});

function renderer(w: number, h: number): WebGLRenderer {
  const r = new WebGLRenderer({ antialias: false });
  r.domElement.style.cssText = `display:block;width:${w}px;height:${h}px`;
  document.body.append(r.domElement);
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  made.push({ r });
  return r;
}

function paint(r: WebGLRenderer, o?: Parameters<typeof asciipaintThree>[1]): ThreePaint {
  const p = asciipaintThree(r, o);
  made.find((m) => m.r === r)!.p = p;
  return p;
}

// Looks down -z at the plane z = 0; NDC x/y map 1:1 to world x/y.
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

/** A white quad from x0 to x1 (NDC), full height. */
function strip(x0: number, x1: number, color: number): Scene {
  const m = new Mesh(new PlaneGeometry(x1 - x0, 2), new MeshBasicMaterial({ color }));
  m.position.x = (x0 + x1) / 2;
  return new Scene().add(m);
}
const whitePlaneScene = () => strip(-1, 1, 0xffffff);
const redFullscreenScene = () => strip(-1, 1, 0xff0000);

const gl = (r: WebGLRenderer) => r.getContext();

function px(r: WebGLRenderer, x: number, y: number): Px {
  const g = gl(r);
  const out = new Uint8Array(4);
  g.readPixels(x, g.drawingBufferHeight - 1 - y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, out);
  return [out[0]!, out[1]!, out[2]!];
}

/** Every device pixel inside the glyph grid, with its column. */
function cells(r: WebGLRenderer): { col: number; c: Px }[] {
  const g = gl(r);
  const w = g.drawingBufferWidth;
  const h = g.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, buf);
  const size = r.getSize(new Vector2());
  const dpr = r.getPixelRatio();
  const [cw, ch] = DEFAULTS.cell;
  const { cols, rows } = gridFor(size, DEFAULTS.cell, 0);
  const out: { col: number; c: Px }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = Math.floor((x + 0.5) / dpr / cw);
      const row = Math.floor((y + 0.5) / dpr / ch);
      if (col >= cols || row >= rows) continue;
      const i = ((h - 1 - y) * w + x) * 4;
      out.push({ col, c: [buf[i]!, buf[i + 1]!, buf[i + 2]!] });
    }
  }
  return out;
}
const readAll = (r: WebGLRenderer): Px[] => cells(r).map((e) => e.c);
const avg = (all: Px[]) => all.reduce((s, c) => s + (c[0] + c[1] + c[2]) / 3, 0) / all.length;

it("paints a lit scene as glyphs on three's own canvas", () => {
  const r = renderer(200, 100);
  const p = paint(r, { edgeFade: 0 });
  p.render(whitePlaneScene(), camera);
  const all = readAll(r);
  expect(all.some((c) => c[0] > 200)).toBe(true);
  expect(all.every((c) => c[0] > 100)).toBe(true); // ACES(1/0.6) ≈ bright, never paper/black
});

it("leaves three's state intact for the next render", () => {
  const r = renderer(64, 64);
  const p = paint(r);
  p.render(whitePlaneScene(), camera);
  r.render(redFullscreenScene(), camera); // plain three render to screen afterwards
  expect(px(r, 32, 32)).toEqual([255, 0, 0]);
  p.render(whitePlaneScene(), camera); // and the paint still works on the next frame
  expect(gl(r).getError()).toBe(gl(r).NO_ERROR);
});

it("follows renderer.setSize without a resize call", () => {
  const r = renderer(64, 64);
  const p = paint(r, { edgeFade: 0 });
  p.render(whitePlaneScene(), camera);
  r.setSize(128, 64, false);
  p.render(whitePlaneScene(), camera);
  expect(px(r, 120, 32)[0]).toBeGreaterThan(100); // painted, not stale or empty
});

it("uses toneMappingExposure", () => {
  const r = renderer(64, 64);
  const p = paint(r, { edgeFade: 0 });
  r.toneMappingExposure = 0.05;
  p.render(whitePlaneScene(), camera);
  const dim = avg(readAll(r));
  r.toneMappingExposure = 1;
  p.render(whitePlaneScene(), camera);
  expect(avg(readAll(r))).toBeGreaterThan(dim * 2);
});

it("paints the camera's whole view, uncropped, like the hero", () => {
  // Cells aren't square, so a cover fit of the 2·cols × 2·rows target would crop ~15% off each side.
  const r = renderer(200, 100);
  const p = paint(r, { edgeFade: 0 });
  p.render(strip(-1, -0.8, 0xffffff), camera); // only the left 10% of the view is lit
  const first = cells(r).filter((e) => e.col === 0);
  expect(Math.max(...first.map((e) => e.c[0]))).toBeGreaterThan(100);
});
