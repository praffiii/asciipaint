import { asciipaint, autoRender, type Paint } from "asciipaint";
import { wireCopy } from "./copy";
import { glyphFont } from "./glyph-font";
import { liquid } from "./liquid";
import { tilt } from "./tilt";

const CELL = [2.4, 3.4] as const;
/** The lens radius on the 760 px desktop slab; it scales with the slab. */
const LENS = 130 / 760;
const DRIFT_MS = 12_000;

/** Wires the hero: the live liquid source, its painting, the lens to the original, the readout and the fallbacks. */
export function hero(root: HTMLElement): void {
  wireCopy(root);
  const source = root.querySelector<HTMLCanvasElement>("[data-source]");
  const painted = root.querySelector<HTMLCanvasElement>("[data-hero-painted]");
  const lens = root.querySelector<HTMLCanvasElement>("[data-lens]");
  const slab = root.querySelector<HTMLElement>("[data-lens-slab]");
  const cells = root.querySelector<HTMLElement>("[data-cells]");
  const slabs = root.querySelector<HTMLElement>("[data-tilt]");
  const sctx = source?.getContext("2d");
  const lctx = lens?.getContext("2d");
  if (!source || !painted || !lens || !slab || !cells || !slabs || !sctx || !lctx) return;

  // No WebGL2 at all: both slabs show a still gradient in place of the liquid.
  if (!liquid()) {
    root.dataset.fallback = "gradient";
    return;
  }
  let paint: Paint | null = null;
  try {
    paint = asciipaint(painted, { font: glyphFont(), background: "#000000", edgeFade: 0 });
  } catch (error) {
    // Kept visible in the console: a bad option or font fails here just like a missing context does.
    console.warn("asciipaint couldn't start the hero painting; showing the source instead.", error);
    root.dataset.fallback = "source"; // the painted slab shows the unpainted source
  }

  const phone = matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const dpr = phone ? Math.min(devicePixelRatio, 1) : devicePixelRatio;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  let held = false;
  const place = (x: number, y: number) => {
    lens.style.clipPath = `circle(${(LENS * slab.clientWidth).toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
  };
  // Idle, the lens wanders a slow 1:2 Lissajous around the centre; under reduced motion it rests there.
  const drift = (now: number) => {
    const a = (2 * Math.PI * now) / DRIFT_MS;
    const { clientWidth: w, clientHeight: h } = slab;
    place(w * (0.5 + 0.3 * Math.sin(a)), h * (0.5 + 0.28 * Math.sin(2 * a)));
  };
  // offsetX/Y are in the slab's own (untransformed) space; its children take no pointer events.
  const follow = (e: PointerEvent) => {
    held = true;
    place(e.offsetX, e.offsetY);
  };
  const release = () => {
    held = false;
    if (calm.matches) place(slab.clientWidth / 2, slab.clientHeight / 2);
  };
  slab.addEventListener("pointerdown", follow);
  slab.addEventListener("pointermove", follow);
  slab.addEventListener("pointerleave", release);
  slab.addEventListener("pointercancel", release);
  release();

  let readout = "";
  const tick = (now: number) => {
    const w = Math.round(source.clientWidth * dpr);
    const h = Math.round(source.clientHeight * dpr);
    const frame = w && h ? liquid()?.frame(now / 1000, w, h, "night") : undefined;
    if (!frame) return;
    if (source.width !== w || source.height !== h) {
      source.width = lens.width = w;
      source.height = lens.height = h;
    }
    sctx.drawImage(frame, 0, 0);
    lctx.drawImage(frame, 0, 0);
    if (paint) {
      paint.draw(source);
      root.dataset.live = "";
    }
    const text = `${Math.floor(slab.clientWidth / CELL[0])} × ${Math.floor(slab.clientHeight / CELL[1])}`;
    if (text !== readout) cells.textContent = readout = text;
    if (!held && !calm.matches) drift(now);
  };

  // The source keeps running on its own canvas if the painting's context is lost.
  const sourceOnly = { canvas: source, resize: () => {} };
  autoRender(paint ?? sourceOnly, tick, {
    onContextLost: () => {
      paint = null;
      root.dataset.fallback = "source";
      autoRender(sourceOnly, tick);
    },
  });
  tilt(slabs);
}
