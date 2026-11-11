import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { asciipaint, autoRender, type Loop } from "../../src/index";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const paintOn = (canvas: HTMLCanvasElement) => ({ canvas, resize() {} });
const mql = (matches: boolean) =>
  ({ matches, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

let canvas: HTMLCanvasElement;
const loops: Loop[] = [];
const start = (...args: Parameters<typeof autoRender>) => {
  const loop = autoRender(...args);
  loops.push(loop);
  return loop;
};

beforeEach(() => {
  canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100px;height:100px";
  document.body.append(canvas);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const l of loops.splice(0)) l.stop();
  canvas.remove();
});

it("runs at ~30 fps while visible and stops on stop()", async () => {
  let n = 0;
  const loop = start(paintOn(canvas), () => n++);
  await wait(500);
  expect(n).toBeGreaterThanOrEqual(10);
  expect(n).toBeLessThanOrEqual(20);
  loop.stop();
  const at = n;
  await wait(200);
  expect(n).toBe(at);
});

it("pauses off screen", async () => {
  canvas.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px";
  let n = 0;
  start(paintOn(canvas), () => n++);
  await wait(300);
  expect(n).toBe(0);
});

it("under reduced motion, renders once and then only on requestFrame()", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue(mql(true));
  let n = 0;
  const loop = start(paintOn(canvas), () => n++);
  await wait(300);
  expect(n).toBe(1);
  loop.requestFrame();
  await wait(100);
  expect(n).toBe(2);
});

it("stops and calls onContextLost when the context is lost", async () => {
  const lost = vi.fn();
  const p = asciipaint(canvas);
  let n = 0;
  start(p, () => n++, { onContextLost: lost });
  canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
  await wait(100);
  expect(lost).toHaveBeenCalledOnce();
  const at = n;
  await wait(200);
  expect(n).toBe(at);
  p.dispose();
});
