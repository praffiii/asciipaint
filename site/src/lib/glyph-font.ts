/** The library `font` option for the self-hosted Geist Mono; the Fonts API may rename the family, so it reads the variable. */
export function glyphFont(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim();
  return `600 ${family || '"Geist Mono", ui-monospace, monospace'}`;
}
