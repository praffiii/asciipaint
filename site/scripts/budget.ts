// The landing's JS budget: what loads before anything lazy, gzipped. A chunk reached only through a
// dynamic import() (the playground, three.js) isn't counted.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const LIMIT = 61440;
const dist = fileURLToPath(new URL("../dist", import.meta.url));
const html = readFileSync(join(dist, "index.html"), "utf8");

const eager = new Set<string>();
const gz = (code: string | Buffer) => gzipSync(code).length;
/** Adds every module `code` imports statically: `import{a}from"./x.js"`, `import"./x.js"`, `export{a}from"./x.js"`. */
function walk(code: string, base: string) {
  for (const m of code.matchAll(/\b(?:import|export)\s*(?:[\w*{][^"'`;()]*?from\s*)?["']([^"']+\.js)["']/g)) {
    add(new URL(m[1]!, `http://x${base}`).pathname);
  }
}
/** `src` is a root-relative URL such as `/_astro/x.js`. */
function add(src: string) {
  if (eager.has(src)) return;
  eager.add(src);
  walk(readFileSync(join(dist, src), "utf8"), src);
}
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)) add(m[1]!);
for (const m of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+\.js)"/g)) add(m[1]!);
// An inline script counts too, with what it imports; data blocks (JSON and the like) don't.
const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attrs = ""]) => !/\bsrc=/.test(attrs) && !/\btype="(?!module")/.test(attrs))
  .map(([, , code = ""]) => code)
  .filter((code) => code.trim());
for (const code of inline) walk(code, "/");

const total =
  [...eager].reduce((sum, src) => sum + gz(readFileSync(join(dist, src))), 0) +
  inline.reduce((sum, code) => sum + gz(code), 0);
console.log(`landing JS: ${total} B gzip (limit ${LIMIT})`);
if (total > LIMIT) process.exit(1);
