const CELL = [2.4, 3.4] as const;

/** A small seeded generator, so a mask is the same on every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 1 where a cell takes the lower colour: sparse at the top row, solid at the bottom, ragged between. */
export function dissolveMask(cols: number, rows: number, seed: number): Uint8Array {
  const next = rng(seed);
  const mask = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = y / rows + Math.sin(x * 0.012 * 2.4) * 0.12 + Math.sin(x * 0.041 * 2.4 + 1) * 0.05;
      const p = clamp((t - 0.15) / 0.75, 0, 1) ** 1.6;
      mask[y * cols + x] = next() < p ? 1 : 0;
    }
  }
  return mask;
}

/** The mask drawn as `lower`-coloured cells on a transparent canvas, for the library to paint. */
export function dissolveCanvas(width: number, height: number, lower: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d")!;
  const [cw, ch] = CELL;
  const cols = Math.ceil(canvas.width / cw);
  const rows = Math.ceil(canvas.height / ch);
  const mask = dissolveMask(cols, rows, 1);
  ctx.fillStyle = lower;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (mask[y * cols + x]) ctx.fillRect(x * cw, y * ch, Math.ceil(cw), Math.ceil(ch));
    }
  }
  return canvas;
}
