export interface Size {
  width: number;
  height: number;
}

export interface Grid {
  cols: number;
  rows: number;
  feather: number; // CSS px, 0 = hard edge
}

export interface UvFit {
  scale: [number, number];
  offset: [number, number]; // srcUv = offset + gridUv * scale; gridUv v=0 at bottom
}

interface SizedSource {
  videoWidth?: number;
  videoHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  width: number;
  height: number;
}

export function gridFor(css: Size, cell: readonly [number, number], edgeFade: number): Grid {
  return {
    cols: Math.floor(css.width / cell[0]),
    rows: Math.floor(css.height / cell[1]),
    feather: edgeFade > 0 ? Math.max(1, css.width * edgeFade) : 0,
  };
}

export function sourceSize(s: TexImageSource): Size {
  const d = s as SizedSource;
  return {
    width: d.videoWidth || d.displayWidth || d.naturalWidth || d.width,
    height: d.videoHeight || d.displayHeight || d.naturalHeight || d.height,
  };
}

export function coverUv(src: Size, area: Size, flipY: boolean): UvFit {
  const srcAspect = src.width / src.height;
  const areaAspect = area.width / area.height;
  const sx = srcAspect > areaAspect ? areaAspect / srcAspect : 1;
  const sy = srcAspect > areaAspect ? 1 : srcAspect / areaAspect;
  const ox = (1 - sx) / 2;
  const oy = (1 - sy) / 2;
  return flipY
    ? { scale: [sx, -sy], offset: [ox, oy + sy] }
    : { scale: [sx, sy], offset: [ox, oy] };
}

export function lodFor(src: Size, fit: UvFit, grid: Grid): number {
  if (grid.cols === 0 || grid.rows === 0) return 0;
  const perCellX = (src.width * Math.abs(fit.scale[0])) / (2 * grid.cols);
  const perCellY = (src.height * Math.abs(fit.scale[1])) / (2 * grid.rows);
  return Math.max(0, Math.log2(Math.max(perCellX, perCellY)));
}
