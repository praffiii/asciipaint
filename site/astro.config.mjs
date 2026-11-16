import mdx from "@astrojs/mdx";
import { defineConfig, fontProviders } from "astro/config";
import { fileURLToPath } from "node:url";
import shikiNight from "./shiki-night.json" with { type: "json" };

const src = (file) => fileURLToPath(new URL(`../src/${file}`, import.meta.url));
const google = fontProviders.google();

/** A fenced block's `file="name"` meta becomes the code card's file label. */
const fileLabel = {
  name: "file-label",
  pre(node) {
    const file = /file="([^"]+)"/.exec(this.options.meta?.__raw ?? "")?.[1];
    if (file) node.properties.dataFile = file;
  },
};

export default defineConfig({
  output: "static",
  site: "https://asciipaint.prafficoding.workers.dev",
  integrations: [mdx()],
  markdown: { shikiConfig: { theme: shikiNight, transformers: [fileLabel] } },
  vite: {
    resolve: {
      alias: [
        { find: /^asciipaint\/three$/, replacement: src("three.ts") },
        { find: /^asciipaint\/element$/, replacement: src("element.ts") },
        { find: /^asciipaint$/, replacement: src("index.ts") },
      ],
    },
  },
  fonts: [
    {
      name: "Fraunces",
      cssVariable: "--font-display",
      provider: google,
      weights: [900],
      styles: ["normal", "italic"],
      fallbacks: ["serif"],
    },
    {
      name: "Hanken Grotesk",
      cssVariable: "--font-body",
      provider: google,
      weights: [400, 700],
      styles: ["normal"],
      fallbacks: ["sans-serif"],
    },
    {
      name: "IBM Plex Mono",
      cssVariable: "--font-mono",
      provider: google,
      weights: [400, 500, 600],
      styles: ["normal"],
      fallbacks: ["ui-monospace"],
    },
    {
      name: "Geist Mono",
      cssVariable: "--font-geist-mono",
      provider: google,
      weights: [600],
      styles: ["normal"],
      fallbacks: ["ui-monospace"],
    },
  ],
});
