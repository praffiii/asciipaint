import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  fmt: { ignorePatterns: ["docs/**"] },
  lint: { options: { typeAware: true, typeCheck: true } },
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
