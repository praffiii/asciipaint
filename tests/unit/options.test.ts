import { expect, it } from "vite-plus/test";
import { resolveOptions, type Options } from "../../src/options";

it("defaults reproduce the hero", () => {
  expect(resolveOptions()).toEqual({
    cell: [2.4, 3.4],
    ramp: ["-", "=", "+", "*", "#", "%", "@"],
    font: '600 "Geist Mono", ui-monospace, Menlo, monospace',
    background: "#F4EEDF",
    edgeFade: 60 / 790,
    sparkle: false,
    dpr: undefined,
  });
});

it.each([
  [{ ramp: "@" }, /ramp/],
  [{ cell: [0, 3] }, /cell/],
  [{ cell: [2, Number.NaN] }, /cell/],
  [{ edgeFade: -0.1 }, /edgeFade/],
  [{ edgeFade: 0.6 }, /edgeFade/],
  [{ dpr: 0 }, /dpr/],
])("rejects %o", (o, msg) => expect(() => resolveOptions(o as Options)).toThrow(msg));

it("splits the ramp by code point", () =>
  expect(resolveOptions({ ramp: "░▒▓█" }).ramp).toEqual(["░", "▒", "▓", "█"]));
