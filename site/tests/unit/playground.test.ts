import { expect, test } from "vite-plus/test";
import { cellFor, DEFAULT_SETTINGS as defaults } from "../../src/lib/playground/settings";
import { snippet, tokens } from "../../src/lib/playground/snippet";

test("cellFor keeps the 2.4 × 3.4 aspect, to one decimal", () => {
  expect(cellFor(2.4)).toEqual([2.4, 3.4]);
  expect(cellFor(7)).toEqual([7, 9.9]);
});

test("the file snippet is exact on one line", () => {
  expect(snippet(defaults, "file", false)).toBe(
    'import { asciipaint } from "asciipaint";\n\nconst paint = asciipaint(canvas, { cell: [2.4, 3.4], ramp: "-=+*#%@", background: "#000000", sparkle: true });\npaint.draw(image);',
  );
});

test("the ramp is escaped as a JS string", () => {
  expect(snippet({ ...defaults, ramp: 'a"b' }, "file", false)).toContain('ramp: "a\\"b"');
});

test("the wrapped three.js snippet puts one option per line", () => {
  expect(snippet(defaults, "three", true)).toContain("asciipaintThree(renderer, {\n  cell: [2.4, 3.4],");
});

test("a quoted ramp stays one string token", () => {
  const strings = tokens('ramp: "a\\"b",').filter((t) => t.kind === "literal");
  expect(strings.map((t) => t.text)).toEqual(['"a\\"b"']);
});
