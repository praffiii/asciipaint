import { createEngine } from "./engine";
import { sourceSize, type Size } from "./grid";
import { resolveOptions, type LiveOptions, type Options } from "./options";

export interface Paint {
  readonly canvas: HTMLCanvasElement;
  draw(source: TexImageSource): void;
  set(o: LiveOptions): void;
  resize(): void;
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
  const engine = createEngine(gl, o);
  const texture = gl.createTexture();
  let uploaded: Size = { width: 0, height: 0 };

  const resize = () => {
    const dpr = o.dpr ?? Math.min(devicePixelRatio, 3);
    const css = { width: canvas.clientWidth, height: canvas.clientHeight };
    canvas.width = Math.floor(css.width * dpr);
    canvas.height = Math.floor(css.height * dpr);
    engine.resize(css, dpr);
  };
  resize();

  return {
    canvas,
    draw(source) {
      if (source instanceof HTMLVideoElement && source.readyState < 2) return;
      const size = sourceSize(source);
      if (!size.width || !size.height) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Orientation is handled in the shader's uv (flipY), since browsers ignore FLIP_Y for ImageBitmap.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
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
      gl.generateMipmap(gl.TEXTURE_2D);
      engine.run({ texture, size, flipY: true }, null);
    },
    set: (live) => engine.set(live),
    resize,
    dispose() {
      engine.dispose();
      gl.deleteTexture(texture);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
