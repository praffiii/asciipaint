/// <reference types="bun" />
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, deviceScaleFactor: 2 },
  { name: "390", width: 390, height: 844, deviceScaleFactor: 3 },
] as const;
const TIMES = [
  { name: "noon", at: "2026-11-11T12:00+07:00" },
  { name: "golden", at: "2026-11-11T17:15+07:00" },
  { name: "night", at: "2026-11-11T21:00+07:00" },
] as const;
const MAX_MISMATCH = 0.005;

async function capture(url: string, outDir: string): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const vp of VIEWPORTS) {
    for (const time of TIMES) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.clock.setFixedTime(time.at);
      await page.goto(url);
      await page.waitForSelector("[data-print].is-live", { timeout: 30_000 });
      await page.waitForTimeout(500);
      await page
        .locator("[data-print] canvas")
        .first()
        .screenshot({ path: join(outDir, `${vp.name}-${time.name}.png`) });
      await context.close();
    }
  }
  await browser.close();
}

function compare(a: string, b: string): boolean {
  const out = join(b, "..", "diff");
  mkdirSync(out, { recursive: true });
  let ok = true;
  for (const vp of VIEWPORTS) {
    for (const time of TIMES) {
      const file = `${vp.name}-${time.name}.png`;
      const x = PNG.sync.read(readFileSync(join(a, file)));
      const y = PNG.sync.read(readFileSync(join(b, file)));
      if (x.width !== y.width || x.height !== y.height) {
        console.log(`${file}: size differs ${x.width}x${x.height} vs ${y.width}x${y.height}`);
        ok = false;
        continue;
      }
      const diff = new PNG({ width: x.width, height: x.height });
      const n = pixelmatch(x.data, y.data, diff.data, x.width, x.height, { threshold: 0.1 });
      writeFileSync(join(out, file), PNG.sync.write(diff));
      const ratio = n / (x.width * x.height);
      const pass = ratio <= MAX_MISMATCH;
      ok &&= pass;
      console.log(`${file}: ${(ratio * 100).toFixed(3)}% ${pass ? "ok" : "FAIL"}`);
    }
  }
  return ok;
}

const [first, second, third] = process.argv.slice(2);
if (first === "--compare" && second && third) {
  process.exit(compare(second, third) ? 0 : 1);
} else if (first && second) {
  await capture(first, second);
} else {
  console.error("usage: parity.ts <url> <outDir> | parity.ts --compare <dirA> <dirB>");
  process.exit(2);
}
