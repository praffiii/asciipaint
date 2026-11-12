export type SourceKind = "liquid" | "three" | "camera" | "file";

export interface Settings {
  cell: [number, number];
  ramp: string;
  background: string;
  sparkle: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  cell: [2.4, 3.4],
  ramp: "-=+*#%@",
  background: "#000000",
  sparkle: true,
};

export const SWATCHES = ["#000000", "#0A0D1F", "#ECE8FF", "#1A2C9A", "#7C5CF2"] as const;

/** The cell slider's range, in CSS px of cell width. */
export const CELL_RANGE = { min: 1.2, max: 12, step: 0.1 } as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A cell `width` px wide, with the default 2.4 × 3.4 aspect. */
export function cellFor(width: number): [number, number] {
  return [width, round1((width * 3.4) / 2.4)];
}

/** The library refuses a ramp of fewer than 2 glyphs (code points, not UTF-16 units). */
export const isRamp = (ramp: string): boolean => Array.from(ramp).length >= 2;
