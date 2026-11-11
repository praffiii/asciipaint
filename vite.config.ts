import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  fmt: { ignorePatterns: ["docs/**"] },
  pack: {
    entry: { index: "src/index.ts", three: "src/three.ts", element: "src/element.ts" },
    format: ["esm"],
    dts: true,
    platform: "browser",
    exports: true,
    publint: true,
    attw: { profile: "esm-only" },
  },
  lint: { ignorePatterns: ["fixtures/**"], options: { typeAware: true, typeCheck: true } },
  test: {
    projects: [
      {
        test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.ts"],
          passWithNoTests: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
