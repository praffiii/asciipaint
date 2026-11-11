import { expect, it } from "vite-plus/test";

it("imports on the server without touching the DOM", async () => {
  await expect(import("../../src/index")).resolves.toHaveProperty("asciipaint");
  await expect(import("../../src/three")).resolves.toHaveProperty("asciipaintThree");
  await expect(import("../../src/element")).resolves.toBeDefined(); // no customElements on the server: a no-op
});
