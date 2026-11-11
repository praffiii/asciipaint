export type Rgb = readonly [r: number, g: number, b: number]; // sRGB, 0–1
export type Color = string | Rgb;

export interface Options {
  cell?: readonly [number, number];
  ramp?: string;
  font?: string;
  background?: Color;
  edgeFade?: number;
  sparkle?: boolean;
  dpr?: number;
}

export type LiveOptions = Pick<Options, "background" | "edgeFade" | "sparkle">;

export interface Resolved {
  cell: readonly [number, number];
  ramp: readonly string[];
  font: string;
  background: Color;
  edgeFade: number;
  sparkle: boolean;
  dpr: number | undefined;
}

export const DEFAULTS: Required<Omit<Options, "dpr">> = {
  cell: [2.4, 3.4],
  ramp: "-=+*#%@",
  font: '600 "Geist Mono", ui-monospace, Menlo, monospace',
  background: "#F4EEDF",
  edgeFade: 60 / 790,
  sparkle: false,
};

const positive = (n: number) => Number.isFinite(n) && n > 0;

export function validate(o: Options): void {
  if (o.cell && !(positive(o.cell[0]) && positive(o.cell[1]))) {
    throw new RangeError("cell: both sizes must be finite and > 0");
  }
  if (o.ramp !== undefined && Array.from(o.ramp).length < 2) {
    throw new RangeError("ramp: needs at least 2 glyphs");
  }
  if (o.edgeFade !== undefined && !(o.edgeFade >= 0 && o.edgeFade <= 0.5)) {
    throw new RangeError("edgeFade: must be within [0, 0.5]");
  }
  if (o.dpr !== undefined && !positive(o.dpr)) {
    throw new RangeError("dpr: must be finite and > 0");
  }
}

export function resolveOptions(o: Options = {}): Resolved {
  validate(o);
  const d = DEFAULTS;
  return {
    cell: o.cell ?? d.cell,
    ramp: Array.from(o.ramp ?? d.ramp),
    font: o.font ?? d.font,
    background: o.background ?? d.background,
    edgeFade: o.edgeFade ?? d.edgeFade,
    sparkle: o.sparkle ?? d.sparkle,
    dpr: o.dpr,
  };
}
