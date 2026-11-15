import { asciipaint, autoRender, type Paint } from "asciipaint";
import { wireCopy } from "./copy";
import { glyphFont } from "./glyph-font";
import { liquid } from "./liquid";

/** Cell sizes from coarse to fine. Each halves the one before, so four cells fill one of the level above. */
const LEVELS = [
  [24, 36],
  [12, 18],
  [6, 9],
  [3, 4.5],
] as const;
/** How warm a block must be to split into the next level's cells; the coarsest level is always drawn. */
const SPLIT = [0, 0.12, 0.38, 0.68] as const;
/** Each block's threshold is off by up to half of this, so the edge between two levels is ragged. */
const JITTER = 0.16;
/** The warmth grid: one value per cell of the second-finest level, the smallest block that splits. */
const [GX, GY] = LEVELS[2];
/** How far the pointer's warmth reaches at most (px, one standard deviation), and how long it takes to cool to 1/e. */
const REACH = 190;
const COOL_MS = 700;
const DRIFT_MS = 16_000;

const hash = (x: number, y: number, k: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Hands a level's WebGL2 context back, so an off-screen hero holds none. */
function release(paint: Paint) {
  paint.dispose();
  paint.canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
}

/**
 * Wires the hero: the live liquid painted at four cell sizes at once. The pointer warms the picture
 * and warm blocks split into finer cells; they merge back as they cool. Idle, a warm spot drifts.
 */
export function hero(root: HTMLElement): void {
  wireCopy(root);
  const field = root.querySelector<HTMLElement>("[data-field]");
  const view = root.querySelector<HTMLCanvasElement>("[data-hero-painted]");
  const resolved = root.querySelector<HTMLElement>("[data-resolved]");
  const ctx = view?.getContext("2d");
  if (!field || !view || !resolved || !ctx) return;

  // No WebGL2 at all: the field shows a still gradient in place of the liquid.
  if (!liquid()) {
    root.dataset.fallback = "gradient";
    return;
  }
  const phone = matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const dpr = phone ? 1 : Math.min(devicePixelRatio, 2);
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  let W = 0;
  let H = 0;
  let gw = 0;
  let gh = 0;
  let heat = new Float32Array(0);
  let levels: Paint[] | null = null;

  // Painting failed or its context went: the field shows the live unpainted liquid from then on.
  const fail = () => {
    levels = null;
    root.dataset.fallback = "source";
  };
  const make = () => {
    const made: Paint[] = [];
    try {
      for (const cell of LEVELS) {
        const canvas = document.createElement("canvas");
        canvas.dataset.heroLevel = "";
        // A context this code released also fires this, but by then the level is no longer current.
        canvas.addEventListener("webglcontextlost", () => levels?.some((p) => p.canvas === canvas) && fail());
        const paint = asciipaint(canvas, { cell, font: glyphFont(), background: "#000000", edgeFade: 0, dpr });
        paint.resize({ width: W, height: H });
        made.push(paint);
      }
      levels = made;
    } catch (error) {
      // Kept visible in the console: a bad option or font fails here just like a missing context does.
      console.warn("asciipaint couldn't start the hero painting; showing the source instead.", error);
      made.forEach(release);
      fail();
    }
  };

  const size = () => {
    W = field.clientWidth;
    H = field.clientHeight;
    view.width = Math.round(W * dpr);
    view.height = Math.round(H * dpr);
    gw = Math.ceil(W / GX);
    gh = Math.ceil(H / GY);
    heat = new Float32Array(gw * gh);
    for (const paint of levels ?? []) paint.resize({ width: W, height: H });
  };

  /** Warms the grid around (x, y) px up to `amp`; a block only ever gets warmer here. */
  const warm = (x: number, y: number, amp = 1) => {
    const reach = Math.min(REACH, W * 0.2); // a narrow screen keeps its coarse edges
    const r = Math.ceil((reach * 2.6) / GX);
    const cx = Math.floor(x / GX);
    const cy = Math.floor(y / GY);
    for (let j = Math.max(0, cy - r); j < Math.min(gh, cy + r); j++) {
      for (let i = Math.max(0, cx - r); i < Math.min(gw, cx + r); i++) {
        const dx = (i + 0.5) * GX - x;
        const dy = (j + 0.5) * GY - y;
        const v = amp * Math.exp(-(dx * dx + dy * dy) / (2 * reach * reach));
        if (v > (heat[j * gw + i] ?? 0)) heat[j * gw + i] = v;
      }
    }
  };

  let pointer: { x: number; y: number } | null = null;
  field.addEventListener("pointermove", (e) => {
    const box = field.getBoundingClientRect();
    pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
  });
  const leave = () => (pointer = null);
  field.addEventListener("pointerleave", leave);
  field.addEventListener("pointercancel", leave);

  let last = 0;
  let readout = "";
  const tick = (now: number) => {
    if (W !== field.clientWidth || H !== field.clientHeight) size();
    const frame = W && H ? liquid()?.frame(now / 1000, Math.round(W * dpr), Math.round(H * dpr), "night") : undefined;
    if (!frame) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!levels) return void ctx.drawImage(frame, 0, 0, W, H);

    if (calm.matches) {
      // One held frame: a fixed composition, resolved on the right and coarse at the edges.
      heat.fill(0);
      warm(W * 0.66, H * 0.45);
      warm(W * 0.38, H * 0.6, 0.7);
    } else {
      const cool = Math.exp(-Math.min(now - last, 100) / COOL_MS);
      for (let i = 0; i < heat.length; i++) heat[i] = (heat[i] ?? 0) * cool;
      const a = (2 * Math.PI * now) / DRIFT_MS;
      // Idle, the warm spot wanders a slow 1:2 Lissajous around the centre.
      warm(pointer?.x ?? W * (0.5 + 0.34 * Math.sin(a)), pointer?.y ?? H * (0.5 + 0.3 * Math.sin(2 * a)));
    }
    last = now;

    let fine = 0;
    levels.forEach((paint, k) => {
      const [bw, bh] = LEVELS[k - 1] ?? [0, 0];
      if (k) {
        // A level covers every block of the level above that is warm enough to split.
        ctx.save();
        ctx.beginPath();
        let any = false;
        for (let by = 0; by * bh < H; by++) {
          for (let bx = 0; bx * bw < W; bx++) {
            const i = Math.min(gw - 1, Math.floor(((bx + 0.5) * bw) / GX));
            const j = Math.min(gh - 1, Math.floor(((by + 0.5) * bh) / GY));
            if ((heat[j * gw + i] ?? 0) + (hash(bx, by, k) - 0.5) * JITTER <= (SPLIT[k] ?? 1)) continue;
            ctx.rect(bx * bw, by * bh, bw, bh);
            any = true;
            if (k === LEVELS.length - 1) fine++;
          }
        }
        if (!any) return void ctx.restore();
        ctx.clip();
      }
      paint.draw(frame);
      ctx.drawImage(paint.canvas, 0, 0, W, H);
      if (k) ctx.restore();
    });
    root.dataset.live = "";
    const text = `${Math.min(100, Math.round((fine * GX * GY * 100) / (W * H)))}%`;
    if (text !== readout) resolved.textContent = readout = text;
  };

  // The levels are made as the hero comes on screen and released as it leaves.
  new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      if (!levels && !("fallback" in root.dataset)) make();
    } else if (levels) {
      levels.forEach(release);
      levels = null;
    }
  }).observe(root);
  autoRender({ canvas: view, resize: () => {} }, tick);
}
