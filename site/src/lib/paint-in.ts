const RAMP = ".:-=+*#%@";
/** When the last letter starts climbing, and how long each climb takes. */
const SWEEP_MS = 420;
const CLIMB_MS = 240;
/** Past this the reader already has the heading, so it is left alone. */
const LATE_MS = 1500;

/**
 * Paints a heading in: left to right, each letter climbs the ramp from dark to bright, then lands
 * on itself. The real letters stay in place throughout (hidden under their ramp glyph), so nothing
 * moves and the text reads the same to everyone. Does nothing under reduced motion.
 */
export function paintIn(el: HTMLElement): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || performance.now() > LATE_MS) return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  const glyphs: HTMLElement[] = [];
  for (const text of texts) {
    text.replaceWith(
      ...Array.from(text.data, (char) => {
        if (!char.trim()) return char;
        const glyph = document.createElement("span");
        glyph.textContent = char;
        glyph.dataset.g = "";
        glyphs.push(glyph);
        return glyph;
      }),
    );
  }

  const start = performance.now();
  const frame = (now: number) => {
    let landed = 0;
    glyphs.forEach((glyph, i) => {
      const climb = (now - start - (i / glyphs.length) * SWEEP_MS) / CLIMB_MS;
      if (climb >= 1) {
        landed++;
        delete glyph.dataset.g;
        return;
      }
      const g = climb < 0 ? "" : (RAMP[Math.floor(climb * RAMP.length)] ?? "");
      if (glyph.dataset.g !== g) glyph.dataset.g = g;
    });
    if (landed < glyphs.length) return requestAnimationFrame(frame);
    // Back to plain text, so the letters kern as they did.
    for (const glyph of glyphs) glyph.replaceWith(glyph.textContent ?? "");
    el.normalize();
  };
  requestAnimationFrame(frame);
}
