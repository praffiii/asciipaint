const SIZE = 600;
const CELL = [5, 7] as const;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

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

/**
 * A 600 × 600 PNG data URL: `bg` with sparse 5 × 7 px cells mixed toward `tint`.
 * `p` of the cells mix by `amp`, a further `pb` mix by a third of it. Seeded, so it is stable.
 */
export function grainTile(
  bg: string,
  tint: string,
  { amp = 0.25, p = 0.006, pb = 0.035 }: { amp?: number; p?: number; pb?: number } = {},
): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const from = rgb(bg);
  const to = rgb(tint);
  const next = rng(7);
  const [cw, ch] = CELL;
  for (let y = 0; y < SIZE; y += ch) {
    for (let x = 0; x < SIZE; x += cw) {
      const r = next();
      const mix = r < p ? amp : r < p + pb ? amp / 3 : 0;
      if (!mix) continue;
      const [cr, cg, cb] = from.map((v, i) => Math.round(v + (to[i]! - v) * mix));
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(x, y, cw, ch);
    }
  }
  return canvas.toDataURL("image/png");
}
