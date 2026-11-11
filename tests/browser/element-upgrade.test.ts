import { expect, it } from "vite-plus/test";

// Its own file: the element must not be registered before this test inserts its markup.
it("paints elements already in the page when the module loads", async () => {
  const src = document.createElement("canvas"); // blank, so fully transparent
  const el = document.createElement("ascii-img");
  for (const [k, v] of [
    ["src", src.toDataURL()],
    ["width", "48"],
    ["height", "34"],
    ["background", "#f00"],
  ] as const) {
    el.setAttribute(k, v);
  }
  document.body.append(el);
  const painted = new Promise((r) => el.addEventListener("paint", r, { once: true }));
  await import("../../src/element");
  await painted;
  const d = el.shadowRoot!.querySelector("canvas")!.getContext("2d")!.getImageData(1, 1, 1, 1).data;
  expect([d[0], d[1], d[2]]).toEqual([255, 0, 0]);
  el.remove();
});
