import { expect, test } from "vite-plus/test";
import { PALETTES, paletteGlsl } from "../../src/lib/liquid";

test("paletteGlsl writes each stop as a vec3 with 3-decimal channels", () => {
  expect(paletteGlsl(["#000000", "#FFFFFF"])).toBe("vec3(0.000,0.000,0.000), vec3(1.000,1.000,1.000)");
});

test("every palette has six uppercase hex stops", () => {
  for (const stops of Object.values(PALETTES)) {
    expect(stops).toHaveLength(6);
    for (const hex of stops) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  }
});
