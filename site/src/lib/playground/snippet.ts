import type { Settings, SourceKind } from "./settings";

/** The code that reproduces the playground: the source's own imports and draw call, with every option. */
export function snippet(s: Settings, kind: SourceKind, wrap: boolean): string {
  const options = [
    `cell: [${s.cell[0]}, ${s.cell[1]}]`,
    `ramp: ${JSON.stringify(s.ramp)}`,
    `background: ${JSON.stringify(s.background)}`,
    `sparkle: ${s.sparkle}`,
  ];
  const object = wrap ? `{\n${options.map((o) => `  ${o},`).join("\n")}\n}` : `{ ${options.join(", ")} }`;
  if (kind === "three") {
    return [
      'import { autoRender } from "asciipaint";',
      'import { asciipaintThree } from "asciipaint/three";',
      "",
      `const paint = asciipaintThree(renderer, ${object});`,
      "autoRender(paint, () => paint.render(scene, camera));",
    ].join("\n");
  }
  const head = `const paint = asciipaint(canvas, ${object});`;
  if (kind === "file") return ['import { asciipaint } from "asciipaint";', "", head, "paint.draw(image);"].join("\n");
  return [
    'import { asciipaint, autoRender } from "asciipaint";',
    "",
    head,
    `autoRender(paint, () => paint.draw(${kind === "camera" ? "video" : "sketch"}));`,
  ].join("\n");
}

export type TokenKind = "keyword" | "literal" | "punctuation" | "plain";

const TOKEN = /("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|\b(import|from|const|true|false)\b|([{}()[\];,.:=])/g;

/** Splits a snippet for colouring: keywords, literals (strings and numbers), punctuation and the rest. */
export function tokens(code: string): { text: string; kind: TokenKind }[] {
  const out: { text: string; kind: TokenKind }[] = [];
  let at = 0;
  for (const m of code.matchAll(TOKEN)) {
    if (m.index > at) out.push({ text: code.slice(at, m.index), kind: "plain" });
    const kind: TokenKind = m[1] || m[2] ? "literal" : m[3] ? "keyword" : "punctuation";
    out.push({ text: m[0], kind });
    at = m.index + m[0].length;
  }
  if (at < code.length) out.push({ text: code.slice(at), kind: "plain" });
  return out;
}
