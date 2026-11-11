import { createEngine, type SourceTexture } from "./engine";
import { gridFor, sourceSize, type Size } from "./grid";
import { rasterize, rasterSize } from "./raster";
import { resolveOptions, type LiveOptions, type Options } from "./options";

export interface Paint {
  readonly canvas: HTMLCanvasElement;
  draw(source: TexImageSource): void;
  set(o: LiveOptions): void;
  /** Measures the canvas, or with `css` sizes it (CSS px), e.g. an off-DOM canvas. */
  resize(css?: Size): void;
  dispose(): void;
}

/** Paints any image, video or canvas onto `canvas` as coloured glyphs. */
export function asciipaint(canvas: HTMLCanvasElement, options: Options = {}): Paint {
  const o = resolveOptions(options);
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!gl) throw new Error("asciipaint needs WebGL2");
  if (gl.isContextLost()) throw new Error("asciipaint: the WebGL2 context is lost");
  const engine = createEngine(gl, o);
  const texture = gl.createTexture();
  let uploaded: Size = { width: 0, height: 0 };
  let last: SourceTexture | null = null;
  let sample: Size = { width: 0, height: 0 };
  const scratch = document.createElement("canvas");
  // A still drawn before the web font loaded repaints once in the real font.
  void engine.atlasReady.then(() => {
    if (last) engine.run(last, null);
  });

  const resize = (size?: Size) => {
    const dpr = o.dpr ?? Math.min(devicePixelRatio, 3);
    const css = size ?? { width: canvas.clientWidth, height: canvas.clientHeight };
    canvas.width = Math.floor(css.width * dpr);
    canvas.height = Math.floor(css.height * dpr);
    const { cols, rows } = gridFor(css, o.cell, 0);
    sample = { width: 2 * cols, height: 2 * rows };
    engine.resize(css, dpr);
  };
  resize();

  const upload = (source: TexImageSource, size: Size) => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Orientation is handled in the shader's uv (flipY), since browsers ignore FLIP_Y for ImageBitmap.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); // so mipmaps average alpha correctly
    if (size.width === uploaded.width && size.height === uploaded.height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      uploaded = size;
    }
  };

  return {
    canvas,
    draw(input) {
      let source: TexImageSource = input;
      if (source instanceof HTMLVideoElement && source.readyState < 2) return;
      if (source instanceof HTMLImageElement) {
        if (!source.complete || !source.currentSrc) return; // still loading, or no source at all
        // Small or size-less (viewBox-only SVG) images are redrawn at the sample size, so they stay crisp.
        const r = rasterSize({ width: source.naturalWidth, height: source.naturalHeight }, sample);
        if (r) {
          const raster = rasterize(source, r, scratch);
          if (!raster) return; // broken
          source = raster;
        }
      }
      let size = sourceSize(source);
      if (!size.width || !size.height) return;
      upload(source, size);
      if (source instanceof HTMLImageElement && gl.getError() === gl.INVALID_VALUE) {
        // Chrome gives a viewBox-only SVG a default natural size, then WebGL refuses it: rasterise it.
        uploaded = { width: 0, height: 0 };
        const raster = sample.width && sample.height ? rasterize(source, sample, scratch) : null;
        if (!raster) return;
        upload(raster, (size = sample));
      }
      gl.generateMipmap(gl.TEXTURE_2D);
      last = { texture, size, flipY: true, alpha: true };
      engine.run(last, null);
    },
    set: (live) => engine.set(live),
    resize,
    dispose() {
      last = null;
      engine.dispose();
      gl.deleteTexture(texture);
    },
  };
}
