import type { Size } from "./grid";

const MAX_RASTER = 4096; // px a side, within every browser's canvas and texture limits

/** `natural` scaled up or down to just cover `sample`, keeping its aspect, at most 4096 px a side. */
export function coverSize(natural: Size, sample: Size): Size {
  const k = Math.min(
    Math.max(sample.width / natural.width, sample.height / natural.height),
    MAX_RASTER / Math.max(natural.width, natural.height),
  );
  return { width: Math.round(natural.width * k), height: Math.round(natural.height * k) };
}

/**
 * The size to rasterise an image at so it covers the grid's `sample` size, or null when its natural
 * pixels already do (or there is no grid). No natural size (an SVG with only a viewBox) → `sample`.
 */
export function rasterSize(natural: Size, sample: Size): Size | null {
  if (!sample.width || !sample.height) return null;
  if (!natural.width || !natural.height) return coverSize(sample, sample); // no aspect to keep
  const size = coverSize(natural, sample);
  return size.width * size.height > natural.width * natural.height ? size : null;
}

/** Whether `url` visibly points at an SVG: a `data:image/svg+xml` URL, or a path ending in `.svg`. */
export function isSvgUrl(url: string, base = document.baseURI): boolean {
  if (url.startsWith("data:image/svg+xml")) return true;
  try {
    return new URL(url, base).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
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
