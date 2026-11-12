import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/** Serves `site/dist` on a free port; a directory URL such as `/docs/options/` resolves to its `index.html`. */
export async function serve(): Promise<{ url: string; close(): Promise<void> }> {
  if (!existsSync(dist)) throw new Error("site/dist is missing — run bun run site:build first");
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]!));
    let file = join(dist, path);
    if (!file.startsWith(dist)) return void res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return void res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server has no port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((done) => server.close(() => done())),
  };
}

const gpuArgs =
  process.platform === "darwin"
    ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

export interface Opened {
  page: Page;
  /** `pageerror` and console `error` messages. */
  errors: string[];
  close(): Promise<void>;
}

/** Opens `path` of the built site in headless Chromium; `init` is a script run before the page's own. */
export async function open(
  path: string,
  opts: { width?: number; reducedMotion?: boolean; init?: string } = {},
): Promise<Opened> {
  const site = await serve();
  const browser = await chromium
    .launch({ headless: true, args: gpuArgs })
    .catch(async (error: unknown) => {
      await site.close();
      throw error;
    });
  const close = async () => {
    await browser.close();
    await site.close();
  };
  try {
    const context = await browser.newContext({
      viewport: { width: opts.width ?? 1440, height: 900 },
      reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    if (opts.init) await page.addInitScript(opts.init);
    await page.goto(site.url + path, { waitUntil: "load" });
    return { page, errors, close };
  } catch (error) {
    await close();
    throw error;
  }
}
