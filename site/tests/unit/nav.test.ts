import { expect, test } from "vite-plus/test";
import { NAV, neighbours } from "../../src/data/nav";

test("the last reference page has a previous page and no next, skipping the external playground", () => {
  const { prev, next } = neighbours("options");
  expect(prev).toMatchObject({ slug: "asciipaint-three" });
  expect(next).toBeUndefined();
});

test("the first page has no previous page and leads to quick start", () => {
  const { prev, next } = neighbours("install");
  expect(prev).toBeUndefined();
  expect(next).toMatchObject({ slug: "quick-start" });
});

test("every docs slug is unique", () => {
  const slugs = NAV.flatMap((g) => g.items).filter((i) => !i.external).map((i) => i.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
});
