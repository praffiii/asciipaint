import { expect, it } from "vite-plus/test";
import { atlasLayout, fontAt } from "../../src/atlas";

it("lays the ramp then + and *", () => {
  expect(atlasLayout(["-", "=", "+", "*", "#", "%", "@"], [2.4, 3.4], 2)).toEqual({
    glyphs: ["-", "=", "+", "*", "#", "%", "@", "+", "*"],
    width: 44,
    height: 7,
  });
});

it("puts the size after style/weight tokens", () => {
  expect(fontAt('600 "Geist Mono", monospace', 4.4)).toBe('600 4.4px "Geist Mono", monospace');
  expect(fontAt("italic bold Inter", 10)).toBe("italic bold 10px Inter");
  expect(fontAt("monospace", 10)).toBe("10px monospace");
});
