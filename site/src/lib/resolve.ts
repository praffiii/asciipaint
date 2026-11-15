/** Cell-size multipliers after the coarse first paint, down to the real cell; one every STEP_MS. */
const STEPS = [3, 1.6, 1] as const;
const STEP_MS = 100;

// Each step rebuilds the paint (a new cell size means new shaders), about 50 ms of main thread on a
// fast laptop. Phones would stutter through it, so they paint at the real size from the start.
const calm = () => matchMedia("(prefers-reduced-motion: reduce), (max-width: 640px), (pointer: coarse)").matches;

/** The multiplier a resolving painting starts at: big cells, or the real ones where it doesn't resolve. */
export const coarse = (): number => (calm() ? 1 : 6);

/** `cell` scaled by `scale`, to the hundredth of a px. */
export const cellAt = (cell: readonly [number, number], scale: number): [number, number] => [
  Math.round(cell[0] * scale * 100) / 100,
  Math.round(cell[1] * scale * 100) / 100,
];

/**
 * Steps a painting that started at `coarse()` down to its real cell size. Call the returned `shown`
 * each time the painting has drawn: the next multiplier goes to `apply` STEP_MS later, so no step is
 * replaced before it was seen, however slow the device. Does nothing where it started at the real size.
 */
export function resolve(apply: (scale: number) => void): () => void {
  let next = 0;
  let waiting = false;
  return () => {
    if (waiting || next >= STEPS.length || calm()) return;
    waiting = true;
    setTimeout(() => {
      waiting = false;
      const scale = STEPS[next++];
      if (scale) apply(scale);
    }, STEP_MS);
  };
}
