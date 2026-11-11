/// <reference types="bun" />
const LIMIT = 6144;

const build = await Bun.build({ entrypoints: ["src/index.ts"], minify: true, format: "esm" });
if (!build.success) {
  console.error(build.logs.map((l) => l.message).join("\n"));
  process.exit(1);
}
const code = new Uint8Array(await build.outputs[0]!.arrayBuffer());
const size = Bun.gzipSync(code).length;
console.log(`core: ${size} B min+gzip (limit ${LIMIT} B)`);
if (size > LIMIT) process.exit(1);

export {};
