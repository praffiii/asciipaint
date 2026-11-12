import type { Options } from "asciipaint";
import type { StillAttrs } from "../lib/still";

export interface OptionRow {
  name: keyof Options;
  type: string;
  default: string;
  /** Changes through `set()` without a rebuild: exactly the `LiveOptions` keys. */
  live: boolean;
  text: string;
  /** The `<ascii-img>` attributes that show the option on a liquid frame, and the caption on it. */
  demo?: { attrs: StillAttrs; caption: string };
}

/** The options reference, in frame 44:33's order and words. */
export const OPTIONS: readonly OptionRow[] = [
  {
    name: "cell",
    type: "[number, number]",
    default: "[2.4, 3.4]",
    live: false,
    text: "CSS px per glyph cell, width then height. Bigger cells read as coarser type and cost less.",
    demo: { attrs: { cell: "7 10", background: "#000000" }, caption: "cell: [7, 10]" },
  },
  {
    name: "ramp",
    type: "string",
    default: '"-=+*#%@"',
    live: false,
    text: "Glyphs from dark to bright, two or more. Each cell picks one by brightness.",
    demo: { attrs: { cell: "7 10", ramp: " .:oO@" }, caption: 'ramp: " .:oO@"' },
  },
  {
    name: "background",
    type: "string | [r, g, b]",
    default: '"#F4EEDF"',
    live: true,
    text: "The paper behind the art. It is always opaque: a fully transparent colour throws a RangeError. Match it to your page and the edges disappear.",
    demo: { attrs: { background: "#1A2C9A" }, caption: 'background: "#1A2C9A"' },
  },
  {
    name: "edgeFade",
    type: "number, 0–0.5",
    default: "0.076",
    live: true,
    text: "How deep the dithered dissolve reaches into the picture, as a share of its width. 0 gives a hard edge.",
    demo: { attrs: { "edge-fade": "0.2" }, caption: "edgeFade: 0.2" },
  },
  {
    name: "font",
    type: "string",
    default: "600 Geist Mono",
    live: false,
    text: "Weight and family of a loaded monospace font. Any size is ignored.",
  },
  {
    name: "sparkle",
    type: "boolean",
    default: "false",
    live: true,
    text: "Bright isolated points become * or + in their own colour, with a glow.",
  },
  {
    name: "dpr",
    type: "number",
    default: "devicePixelRatio",
    live: false,
    text: "Device pixel ratio. The default is capped at 3 and read again on every resize().",
  },
];
