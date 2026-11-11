import type { Color, Rgb } from "./options";

const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i;
const FUNC = /^rgba?\(\s*([^)]*?)\s*\)$/i;

export function parseColor(css: string): Rgb | null {
  const s = css.trim();
  const hex = HEX.exec(s)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
    const n = parseInt(full, 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const args = FUNC.exec(s)?.[1];
  if (args === undefined) return null;
  const parts = args.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const [r, g, b] = parts.slice(0, 3).map(Number);
  if (![r, g, b].every((v) => v !== undefined && v >= 0 && v <= 255)) return null;
  return [r! / 255, g! / 255, b! / 255];
}

let probe: CanvasRenderingContext2D | undefined;

/**
 * Any CSS colour as sRGB bytes and alpha, or null if the browser rejects it. One pixel is
 * painted and read back, because Chrome keeps oklch / oklab / display-p3 as written.
 * The canvas is made on first use, so importing this stays safe on the server.
 */
export function cssToRgba(css: string): [number, number, number, number] | null {
  if (!CSS.supports("color", css)) return null;
  probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext(
    "2d",
    { willReadFrequently: true },
  )!;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!, a!];
}

export function toRgb(c: Color): Rgb {
  if (typeof c === "string") {
    const fast = parseColor(c);
    if (fast) return fast;
    const px = cssToRgba(c);
    if (!px) throw new RangeError(`color: cannot parse "${c}"`);
    return [px[0] / 255, px[1] / 255, px[2] / 255];
  }
  if (c.length !== 3 || !c.every((v) => v >= 0 && v <= 1)) {
    throw new RangeError("color: tuple must be 3 numbers in [0, 1]");
  }
  return c;
}
