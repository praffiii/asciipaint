import { expect, it } from "vite-plus/test";

it("does nothing when imported on the server", async () => {
  const { AsciiImg } = await import("../../src/element");
  expect(AsciiImg).toBeUndefined();
});
