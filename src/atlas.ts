export interface AtlasLayout {
  glyphs: readonly string[];
  width: number; // device px
  height: number; // device px
}

const LEADING_TOKENS = /^((?:(?:normal|italic|oblique|bold|bolder|lighter|small-caps|\d{3})\s+)*)/;

export function atlasLayout(
  ramp: readonly string[],
  cell: readonly [number, number],
  dpr: number,
): AtlasLayout {
  const glyphs = [...ramp, "+", "*"];
  return {
    glyphs,
    width: Math.ceil(glyphs.length * cell[0] * dpr),
    height: Math.ceil(cell[1] * dpr),
  };
}

export function fontAt(font: string, px: number): string {
  const lead = LEADING_TOKENS.exec(font)?.[1] ?? "";
  return `${lead}${px}px ${font.slice(lead.length)}`;
}

/** The glyphs side by side, white on clear, one cell each at device resolution. */
export function drawAtlas(
  layout: AtlasLayout,
  font: string,
  cell: readonly [number, number],
  dpr: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = layout.width;
  c.height = layout.height;
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  g.font = fontAt(font, cell[1] + 1);
  g.textBaseline = "top";
  g.fillStyle = "#fff";
  layout.glyphs.forEach((ch, i) => g.fillText(ch, i * cell[0], -1));
  return c;
}
