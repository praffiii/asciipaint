import { expect, test } from "vite-plus/test";
import { full, index, plain } from "../../src/lib/llms";

const SITE = "https://example.test";

test("plain drops MDX imports and components but keeps imports inside code", () => {
  const body = 'import Demo from "../Demo.astro";\n\n<Demo />\n\nSee [options](/docs/options/).\n\n```ts\nimport { asciipaint } from "asciipaint";\n```';
  expect(plain(body, SITE)).toBe('See [options](https://example.test/docs/options/).\n\n```ts\nimport { asciipaint } from "asciipaint";\n```');
});

test("pages come out in sidebar order, whatever order they arrive in", () => {
  const page = (id: string) => ({ id, title: id, description: `about ${id}`, body: `body of ${id}` });
  const pages = [page("options"), page("quick-start"), page("install")];
  expect(full(pages, SITE).match(/body of [\w-]+/g)).toEqual(["body of install", "body of quick-start", "body of options"]);
  expect(index(pages, SITE)).toContain("- [install](https://example.test/docs/install/): about install");
});
