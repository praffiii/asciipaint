/**
 * The mean colour of a source's outermost pixels, as `#rrggbb`, weighted by alpha; null when the edge
 * is (nearly) transparent. Used as the paint's default `background`, so the edge fade blends.
 */
export function edgeColour(source: CanvasImageSource): string | null {
  const n = 32;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d")!;
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
