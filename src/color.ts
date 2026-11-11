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

export function toRgb(c: Color, normalize: (css: string) => string): Rgb {
  if (typeof c === "string") {
    const rgb = parseColor(c) ?? parseColor(normalize(c));
    if (!rgb) throw new RangeError(`color: cannot parse "${c}"`);
    return rgb;
  }
  if (c.length !== 3 || !c.every((v) => v >= 0 && v <= 1)) {
    throw new RangeError("color: tuple must be 3 numbers in [0, 1]");
  }
  return c;
}
