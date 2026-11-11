export interface Loop {
  /** Schedule a frame. Under reduced motion this is the only way to get one besides resize, visibility and media-query changes. */
  requestFrame(): void;
  stop(): void;
}

const FRAME_MS = 33;

/** Calls `frame` at ~30 fps while the canvas is on screen and the tab is visible. */
export function autoRender(
  paint: { readonly canvas: HTMLCanvasElement; resize(): void },
  frame: (now: number) => void,
  options: { onContextLost?: () => void } = {},
): Loop {
  const { canvas } = paint;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let onScreen = false;
  let stopped = false;
  let scheduled = false;
  let raf = 0;
  let last = -Infinity;

  // One rAF chain, gated by elapsed time. It dies when nothing is visible or motion is reduced.
  const run = (now: number) => {
    scheduled = false;
    if (stopped || !onScreen || document.hidden) return;
    if (calm.matches || now - last >= FRAME_MS - 2) {
      last = now;
      frame(now);
    }
    if (!calm.matches) schedule();
  };
  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    raf = requestAnimationFrame(run);
  }

  const resizeObserver = new ResizeObserver(() => {
    paint.resize();
    schedule();
  });
  const intersectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) onScreen = entry.isIntersecting;
    if (onScreen) schedule();
  });
  const onVisibility = () => {
    if (!document.hidden) schedule();
  };
  const onLost = () => {
    stop();
    options.onContextLost?.();
  };

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    calm.removeEventListener("change", schedule);
    canvas.removeEventListener("webglcontextlost", onLost);
  }

  resizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);
  document.addEventListener("visibilitychange", onVisibility);
  calm.addEventListener("change", schedule);
  canvas.addEventListener("webglcontextlost", onLost);

  return { requestFrame: schedule, stop };
}
