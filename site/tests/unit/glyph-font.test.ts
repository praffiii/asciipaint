import { afterEach, expect, test, vi } from "vitest";
import { glyphFont } from "../../src/lib/glyph-font";

const stub = (value: string) => {
  vi.stubGlobal("document", { documentElement: {} });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => value }));
};
afterEach(() => vi.unstubAllGlobals());

test("uses the family the Fonts API generated", () => {
  stub(" Geist Mono-a1b2c3, ui-monospace ");
  expect(glyphFont()).toBe("600 Geist Mono-a1b2c3, ui-monospace");
});

test("falls back to Geist Mono when the variable is empty", () => {
  stub("");
  expect(glyphFont()).toBe('600 "Geist Mono", ui-monospace, monospace');
});
