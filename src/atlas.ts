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
