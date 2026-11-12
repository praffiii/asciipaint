import { expect, test } from "vite-plus/test";
import { DEFAULTS } from "../../../src/options";
import { OPTIONS } from "../../src/data/options";

const row = (name: string) => OPTIONS.find((r) => r.name === name);

/** `'600 "Geist Mono", ui-monospace, …'` → `600 Geist Mono`: the weight and the first family. */
const fontLabel = (font: string) => {
  const [, weight, family] = /^(\d+)\s+"?([^",]+)"?/.exec(font) ?? [];
  return `${weight} ${family}`;
};

test("every printed default matches the library's", () => {
  expect(row("cell")?.default).toBe(`[${DEFAULTS.cell.join(", ")}]`);
  expect(row("ramp")?.default).toBe(JSON.stringify(DEFAULTS.ramp));
  expect(row("background")?.default).toBe(JSON.stringify(DEFAULTS.background));
  expect(row("edgeFade")?.default).toBe(DEFAULTS.edgeFade.toFixed(3));
  expect(row("sparkle")?.default).toBe(String(DEFAULTS.sparkle));
  expect(row("font")?.default).toBe(fontLabel(DEFAULTS.font));
  expect(row("font")?.default).toBe("600 Geist Mono");
});

test("the rows follow the frame's order and the live ones are exactly set()'s options", () => {
  expect(OPTIONS.map((r) => r.name)).toEqual(["cell", "ramp", "background", "edgeFade", "font", "sparkle", "dpr"]);
  expect(OPTIONS.filter((r) => r.live).map((r) => r.name)).toEqual(["background", "edgeFade", "sparkle"]);
});

test("the four demos are the first four rows", () => {
  expect(OPTIONS.filter((r) => r.demo).map((r) => r.name)).toEqual(["cell", "ramp", "background", "edgeFade"]);
});
