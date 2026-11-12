/**
 * Every pixel of each `cell[0] × cell[1]` cell takes the cell's mean RGBA, rounded.
 * Cells at the right and bottom edges average only the pixels they have.
 */
export function cellAverage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cell: readonly [number, number],
): Uint8ClampedArray<ArrayBuffer> {
  const [cw, ch] = cell;
  const cols = Math.ceil(width / cw);
  const rows = Math.ceil(height / ch);
  const sums = new Float64Array(cols * rows * 4);
  const counts = new Uint32Array(cols * rows);
  const index = (x: number, y: number) => Math.floor(y / ch) * cols + Math.floor(x / cw);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = index(x, y);
      counts[c]!++;
      for (let k = 0; k < 4; k++) sums[c * 4 + k]! += data[(y * width + x) * 4 + k]!;
    }
  }
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = index(x, y);
      for (let k = 0; k < 4; k++) out[(y * width + x) * 4 + k] = Math.round(sums[c * 4 + k]! / counts[c]!);
    }
  }
  return out;
}

/** `src` with every cell flattened to its average colour, as a new canvas of the same size. */
export function cellCanvas(src: HTMLCanvasElement, cell: readonly [number, number]): HTMLCanvasElement {
  const { width, height } = src;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const read = src.getContext("2d");
  const write = out.getContext("2d");
  if (!read || !write || !width || !height) return out;
  const { data } = read.getImageData(0, 0, width, height);
  write.putImageData(new ImageData(cellAverage(data, width, height, cell), width, height), 0, 0);
  return out;
}
