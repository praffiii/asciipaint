import { HalfFloatType, NearestFilter, Vector2, WebGLRenderTarget } from "three";
import type { Camera, Object3D, WebGLRenderer } from "three";
import { createEngine } from "./engine";
import { gridFor } from "./grid";
import { resolveOptions, type LiveOptions, type Options } from "./options";

export interface ThreePaint {
  readonly canvas: HTMLCanvasElement;
  /** Renders `scene` into a half-float target, then paints it as glyphs on the renderer's canvas. */
  render(scene: Object3D, camera: Camera): void;
  set(o: LiveOptions): void;
  /** Sizes the renderer to its canvas's CSS size. */
  resize(): void;
  compile(): Promise<void>;
  /** Frees the target and the engine; the renderer stays the caller's. */
  dispose(): void;
}

/** three.js internal: the WebGL texture behind a three texture. */
interface TextureProperties {
  __webglTexture: WebGLTexture;
}

/** Paints a three.js scene as glyphs, on the renderer's own WebGL2 context. */
export function asciipaintThree(
  renderer: WebGLRenderer,
  options: Omit<Options, "dpr"> = {},
): ThreePaint {
  const o = resolveOptions({ ...options, dpr: renderer.getPixelRatio() });
  const engine = createEngine(renderer.getContext() as WebGL2RenderingContext, o);
  // Linear HDR, one texel per sub-sample, as the hero's pass renders it.
  const target = new WebGLRenderTarget(2, 2, {
    type: HalfFloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  });
  const size = new Vector2();
  let css = { width: 0, height: 0 };
  let dpr = 0;
  let grid = gridFor(css, o.cell, 0);

  return {
    canvas: renderer.domElement,
    render(scene, camera) {
      renderer.getSize(size);
      const pr = renderer.getPixelRatio();
      if (size.x !== css.width || size.y !== css.height || pr !== dpr) {
        css = { width: size.x, height: size.y };
        dpr = pr;
        grid = gridFor(css, o.cell, 0);
        engine.resize(css, dpr);
        target.setSize(2 * grid.cols, 2 * grid.rows);
      }
      if (!grid.cols || !grid.rows) return;

      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      const { __webglTexture: texture } = renderer.properties.get(
        target.texture,
      ) as TextureProperties;
      // The size carries the grid's aspect, not the target's, so the whole view maps 1:1 onto the
      // cells (no cover crop), exactly as the hero samples it.
      const area = { width: grid.cols * o.cell[0], height: grid.rows * o.cell[1] };
      engine.run(
        { texture, size: area, flipY: false, alpha: false },
        { exposure: renderer.toneMappingExposure },
      );
      renderer.resetState();
    },
    set: (live) => engine.set(live),
    resize() {
      const c = renderer.domElement;
      renderer.setSize(c.clientWidth, c.clientHeight, false);
    },
    compile: () => engine.compile(),
    dispose() {
      target.dispose();
      engine.dispose();
    },
  };
}
