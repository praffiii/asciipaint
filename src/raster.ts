import type { Size } from "./grid";

/**
 * The size to rasterise an image at so it covers the grid's `sample` size, keeping its aspect, or
 * null when its natural pixels already do. No natural size (an SVG with only a viewBox) → `sample`.
 */
export function rasterSize(natural: Size, sample: Size): Size | null {
  if (!natural.width || !natural.height) return sample;
  const k = Math.max(sample.width / natural.width, sample.height / natural.height);
  if (k <= 1) return null;
  return { width: Math.round(natural.width * k), height: Math.round(natural.height * k) };
}

/** Draws `img` into `scratch` at `size`; null when the image is broken. */
export function rasterize(
  img: HTMLImageElement,
  size: Size,
  scratch: HTMLCanvasElement,
): HTMLCanvasElement | null {
  scratch.width = size.width; // also clears it
  scratch.height = size.height;
  try {
    scratch.getContext("2d")!.drawImage(img, 0, 0, size.width, size.height);
  } catch {
    return null;
  }
  return scratch;
}
