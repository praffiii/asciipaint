// Every built-in source is drawn here, in code: no photos, no video files.

const PAPER = "#F4EEDF";

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return [c, c.getContext("2d")!];
}

/** A tiny seeded PRNG, so the still is the same on every load. */
function random(seed: number): () => number {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/** A sunset over a lake, drawn once and handed over as an `<img>` so the image path is exercised. */
export async function sunsetImage(): Promise<HTMLImageElement> {
  const [c, g] = canvas2d(1200, 800);
  const { width: w, height: h } = c;
  const rand = random(7);
  const horizon = h * 0.7;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#1C2556");
  sky.addColorStop(0.38, "#5E4A97");
  sky.addColorStop(0.72, "#EE7A4B");
  sky.addColorStop(1, "#FFD47E");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, horizon);

  const sun = { x: w * 0.63, y: horizon - 70, r: 74 };
  const glow = g.createRadialGradient(sun.x, sun.y, sun.r * 0.6, sun.x, sun.y, sun.r * 4);
  glow.addColorStop(0, "rgba(255, 226, 150, 0.85)");
  glow.addColorStop(1, "rgba(255, 180, 110, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, w, horizon);
  g.fillStyle = "#FFF1C4";
  g.beginPath();
  g.arc(sun.x, sun.y, sun.r, 0, Math.PI * 2);
  g.fill();

  // Ridges, far to near: lower, darker and rougher.
  const ridges = [
    { base: horizon - 120, amp: 70, fill: "#8C5E8E", step: 60 },
    { base: horizon - 50, amp: 60, fill: "#55406F", step: 44 },
    { base: horizon + 6, amp: 40, fill: "#2B2448", step: 30 },
  ];
  for (const r of ridges) {
    g.fillStyle = r.fill;
    g.beginPath();
    g.moveTo(0, horizon + 10);
    for (let x = 0; x <= w + r.step; x += r.step) {
      g.lineTo(x, r.base - rand() * r.amp - Math.sin(x / 260) * r.amp * 0.5);
    }
    g.lineTo(w, horizon + 10);
    g.closePath();
    g.fill();
  }

  const lake = g.createLinearGradient(0, horizon, 0, h);
  lake.addColorStop(0, "#F3A56A");
  lake.addColorStop(0.35, "#6A4C86");
  lake.addColorStop(1, "#191A36");
  g.fillStyle = lake;
  g.fillRect(0, horizon, w, h - horizon);

  // The sun's reflection, as broken horizontal streaks.
  g.fillStyle = "rgba(255, 228, 170, 0.85)";
  for (let y = horizon + 8; y < h - 40; y += 11) {
    const k = 1 - (y - horizon) / (h - horizon);
    const half = sun.r * (0.4 + k) * (0.6 + rand() * 0.6);
    g.fillRect(sun.x - half + (rand() - 0.5) * 20, y, half * 2, 4 + k * 3);
  }

  // A pine shore on the left.
  g.fillStyle = "#121229";
  g.fillRect(0, horizon + 14, w * 0.36, 26);
  for (let x = 8; x < w * 0.36; x += 22 + rand() * 18) {
    const t = 70 + rand() * 120;
    g.beginPath();
    g.moveTo(x, horizon + 20 - t);
    g.lineTo(x + t * 0.2, horizon + 22);
    g.lineTo(x - t * 0.2, horizon + 22);
    g.closePath();
    g.fill();
  }

  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, "image/png"));
  if (!blob) throw new Error("could not encode the still");
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.alt = "A sunset over a lake, drawn in code";
  await img.decode();
  return img;
}

export interface Motion {
  readonly canvas: HTMLCanvasElement;
  /** Paints the frame for time `now` (ms). */
  step(now: number): void;
  /** Resizes the sketch (px); the composition is relative, so any aspect shows all of it. */
  resize(width: number, height: number): void;
}

const INKS = ["#3A4BA8", "#E0482F", "#E8A93A", "#1F8A85", "#8A3B78", "#6FA8DC", "#6C9A3B"];
const RIBBONS = ["#3A2E5A", "#8A3B78", "#2F4858"];

/** Watercolour drops drifting on paper with ink ribbons: a generative canvas, repainted every frame. */
export function motion(width = 960, height = 540): Motion {
  const [c, g] = canvas2d(width, height);
  const rand = random(3);
  const drops = INKS.map((fill, i) => ({
    fill,
    x: 0.15 + rand() * 0.7,
    y: 0.2 + rand() * 0.6,
    r: 0.22 + rand() * 0.18,
    fx: 0.00007 + rand() * 0.0001,
    fy: 0.00005 + rand() * 0.0001,
    phase: i * 1.7,
  }));

  return {
    canvas: c,
    resize(w, h) {
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
    },
    step(now) {
      const { width: w, height: h } = c;
      const s = Math.min(w, h);
      g.globalCompositeOperation = "source-over";
      g.fillStyle = PAPER;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "multiply";
      for (const d of drops) {
        const x = (d.x + Math.sin(now * d.fx + d.phase) * 0.18) * w;
        const y = (d.y + Math.cos(now * d.fy + d.phase) * 0.2) * h;
        const r = d.r * Math.sqrt(w * h) * 0.75 * (1 + Math.sin(now * 0.0003 + d.phase) * 0.12);
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `${d.fill}D8`);
        grad.addColorStop(0.55, `${d.fill}80`);
        grad.addColorStop(1, `${d.fill}00`);
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = "source-over";
      g.lineCap = "round";
      g.globalAlpha = 0.6;
      RIBBONS.forEach((stroke, k) => {
        g.strokeStyle = stroke;
        g.lineWidth = s * (0.012 + k * 0.005);
        g.beginPath();
        for (let x = -20; x <= w + 20; x += 12) {
          const y =
            h * (0.3 + k * 0.2) +
            Math.sin(x / (w * 0.15 + k * 40) + now * 0.0004 * (k + 1)) * h * 0.08 +
            Math.sin(x / (w * 0.065) - now * 0.0007) * h * 0.015;
          if (x < 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      });
      g.globalAlpha = 1;
    },
  };
}

/**
 * The mean colour of a source's outermost pixels, as `#rrggbb`, weighted by alpha; null when the edge
 * is (nearly) transparent. Used as the paint's default `background`, so the edge fade blends.
 */
export function edgeColour(source: CanvasImageSource): string | null {
  const n = 32;
  const [, g] = canvas2d(n, n);
  try {
    g.drawImage(source, 0, 0, n, n);
  } catch {
    return null; // not decodable yet
  }
  const px = g.getImageData(0, 0, n, n).data;
  let r = 0;
  let gr = 0;
  let b = 0;
  let a = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (x && y && x < n - 1 && y < n - 1) continue;
      const i = (y * n + x) * 4;
      const alpha = px[i + 3]! / 255;
      r += px[i]! * alpha;
      gr += px[i + 1]! * alpha;
      b += px[i + 2]! * alpha;
      a += alpha;
    }
  }
  if (a < (4 * n - 4) * 0.05) return null;
  const hex = (v: number) =>
    Math.round(v / a)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(gr)}${hex(b)}`;
}
