const LERP = 0.12;
const DRIFT_DEG = 2;
const DRIFT_MS = 10_000;

/**
 * Tilts `el` in 3D toward the pointer, up to `maxDeg`, easing 0.12 of the way each frame. On touch
 * screens it drifts on a slow sine instead. Nothing moves under reduced motion. Returns a disposer.
 */
export function tilt(el: HTMLElement, maxDeg = 4): () => void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const coarse = matchMedia("(pointer: coarse)").matches;
  const target = { x: 0, y: 0 };
  const now = { x: 0, y: 0 };
  let raf = 0;
  let visible = false;

  const apply = () => {
    el.style.transform = `perspective(1600px) rotateX(${now.y.toFixed(3)}deg) rotateY(${now.x.toFixed(3)}deg)`;
  };

  const step = (time: number) => {
    raf = 0;
    if (coarse) {
      const phase = (2 * Math.PI * time) / DRIFT_MS;
      now.x = DRIFT_DEG * Math.sin(phase);
      now.y = DRIFT_DEG * Math.cos(phase) * 0.5;
    } else {
      now.x += (target.x - now.x) * LERP;
      now.y += (target.y - now.y) * LERP;
    }
    apply();
    // The pointer ease stops once settled; the drift runs while the slabs are on screen.
    const settled = !coarse && Math.abs(target.x - now.x) + Math.abs(target.y - now.y) < 0.01;
    if (visible && !settled) raf = requestAnimationFrame(step);
  };
  const wake = () => {
    if (!raf && visible) raf = requestAnimationFrame(step);
  };

  const onMove = (e: PointerEvent) => {
    if (!visible) return; // off screen: no layout read on every move
    const r = el.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    target.x = inside ? clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * maxDeg : 0;
    target.y = inside ? clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * -maxDeg : 0;
    wake();
  };
  const onLeave = () => {
    target.x = target.y = 0;
    wake();
  };

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    wake();
  });
  io.observe(el);
  if (!coarse) {
    addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
  }

  return () => {
    io.disconnect();
    cancelAnimationFrame(raf);
    removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    el.style.transform = "";
  };
}
