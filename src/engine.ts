import { atlasLayout, drawAtlas, fontAt } from "./atlas";
import { toRgb } from "./color";
import { coverUv, gridFor, lodFor, type Size } from "./grid";
import { validate, type LiveOptions, type Resolved } from "./options";
import { CELL_FRAG, DRAW_FRAG, QUAD_VERT } from "./shaders";

export interface SourceTexture {
  texture: WebGLTexture;
  size: Size;
  flipY: boolean;
  /** Display sources keep their alpha (uploaded premultiplied); three.js scenes don't. */
  alpha: boolean;
}

export interface Engine {
  resize(css: Size, dpr: number): void;
  set(live: LiveOptions): void;
  run(src: SourceTexture, aces: { exposure: number } | null): void;
  compile(): Promise<void>;
  /** Settles once the font has loaded (or failed) and the atlas is redrawn for the next run(). */
  atlasReady: Promise<void>;
  dispose(): void;
}

/**
 * The two GPU passes on any WebGL2 context. Every GL state change happens inside `run()`, which
 * sets all the state it relies on, so the engine can share a context (three.js) safely.
 */
export function createEngine(gl: WebGL2RenderingContext, o: Resolved): Engine {
  let edgeFade = o.edgeFade;
  let sparkle = o.sparkle;
  let css: Size = { width: 0, height: 0 };
  let grid = gridFor(css, o.cell, edgeFade);
  let cellsDirty = true;
  let dpr = o.dpr ?? 1;
  let layout = atlasLayout(o.ramp, o.cell, dpr);
  let atlas = drawAtlas(layout, o.font, o.cell, dpr);
  let atlasDirty = true;
  const redraw = () => {
    layout = atlasLayout(o.ramp, o.cell, dpr);
    atlas = drawAtlas(layout, o.font, o.cell, dpr);
    atlasDirty = true;
  };
  let paper = toRgb(o.background);
  // CPU only: the new atlas is uploaded on the next run(), never from a callback.
  const atlasReady = document.fonts.load(fontAt(o.font, 8)).then(redraw, redraw);

  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const shader = (type: GLenum, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const vert = shader(gl.VERTEX_SHADER, QUAD_VERT);
  const cellFrag = shader(gl.FRAGMENT_SHADER, CELL_FRAG);
  const drawFrag = shader(gl.FRAGMENT_SHADER, DRAW_FRAG);
  const shaders = [vert, cellFrag, drawFrag];
  const program = (frag: WebGLShader) => {
    const p = gl.createProgram();
    gl.attachShader(p, vert);
    gl.attachShader(p, frag);
    gl.linkProgram(p);
    return p;
  };
  const cellProg = program(cellFrag);
  const drawProg = program(drawFrag);
  const vao = gl.createVertexArray();
  const cellTex = gl.createTexture();
  const atlasTex = gl.createTexture();
  const fbo = gl.createFramebuffer();

  let linked = false;
  const link = () => {
    for (const p of [cellProg, drawProg]) {
      if (gl.getProgramParameter(p, gl.LINK_STATUS) === false) {
        const logs = [gl.getProgramInfoLog(p), ...shaders.map((s) => gl.getShaderInfoLog(s))];
        throw new Error(`asciipaint: shader link failed\n${logs.filter(Boolean).join("\n")}`);
      }
    }
    linked = true;
  };
  const uniforms = (p: WebGLProgram) => {
    const cache = new Map<string, WebGLUniformLocation | null>();
    return (name: string) => {
      let l = cache.get(name);
      if (l === undefined) cache.set(name, (l = gl.getUniformLocation(p, name)));
      return l;
    };
  };
  const cu = uniforms(cellProg);
  const du = uniforms(drawProg);

  return {
    atlasReady,
    resize(next, nextDpr) {
      const g = gridFor(next, o.cell, edgeFade);
      cellsDirty ||= g.cols !== grid.cols || g.rows !== grid.rows;
      grid = g;
      css = next;
      if (nextDpr !== dpr) {
        dpr = nextDpr;
        redraw();
      }
    },

    set(live) {
      validate(live);
      paper = live.background === undefined ? paper : toRgb(live.background);
      if (live.edgeFade !== undefined) grid = gridFor(css, o.cell, (edgeFade = live.edgeFade));
      if (live.sparkle !== undefined) sparkle = live.sparkle;
    },

    run(src, aces) {
      const { cols, rows, feather } = grid;
      if (!cols || !rows) return;
      if (!linked) link();

      for (const cap of [gl.BLEND, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.SCISSOR_TEST, gl.CULL_FACE]) {
        gl.disable(cap);
      }
      gl.colorMask(true, true, true, true);
      gl.bindVertexArray(vao);
      gl.bindSampler(0, null);
      gl.bindSampler(1, null);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      if (atlasDirty) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        atlasDirty = false;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      if (cellsDirty) {
        gl.bindTexture(gl.TEXTURE_2D, cellTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA8,
          3 * cols,
          rows,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cellTex, 0);
        cellsDirty = false;
      }

      // Pass 1: each cell's average, brightest sample and coverage, read from the cover-fitted source.
      const fit = coverUv(
        src.size,
        { width: cols * o.cell[0], height: rows * o.cell[1] },
        src.flipY,
      );
      gl.viewport(0, 0, 3 * cols, rows);
      gl.useProgram(cellProg);
      gl.bindTexture(gl.TEXTURE_2D, src.texture);
      gl.uniform1i(cu("uSrc"), 0);
      gl.uniform2f(cu("uCells"), cols, rows);
      gl.uniform2f(cu("uScale"), ...fit.scale);
      gl.uniform2f(cu("uOffset"), ...fit.offset);
      gl.uniform1f(cu("uLod"), lodFor(src.size, fit, grid));
      gl.uniform1f(cu("uAces"), aces ? 1 : 0);
      gl.uniform1f(cu("uExposure"), aces?.exposure ?? 1);
      gl.uniform3f(cu("uBackground"), ...paper);
      gl.uniform1f(cu("uAlpha"), src.alpha ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 2: every device pixel draws its cell's glyph.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(drawProg);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.uniform1i(du("tCells"), 0);
      gl.uniform1i(du("tAtlas"), 1);
      gl.uniform2f(du("uCells"), cols, rows);
      gl.uniform2f(du("uSize"), css.width, css.height);
      gl.uniform1f(du("uDpr"), dpr);
      gl.uniform3f(du("uPaper"), ...paper);
      gl.uniform1f(du("uSparkle"), sparkle ? 1 : 0);
      gl.uniform1f(du("uFeather"), feather);
      gl.uniform2f(du("uCell"), ...o.cell);
      gl.uniform1f(du("uSlots"), o.ramp.length);
      gl.uniform1f(du("uGlyphW"), o.cell[0] * dpr);
      gl.uniform1f(du("uAtlasH"), layout.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    async compile() {
      const done = (p: WebGLProgram) =>
        !parallel || gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR) !== false;
      while (!done(cellProg) || !done(drawProg)) await new Promise((r) => setTimeout(r, 0));
      link();
    },

    dispose() {
      for (const p of [cellProg, drawProg]) gl.deleteProgram(p);
      for (const s of shaders) gl.deleteShader(s);
      for (const t of [cellTex, atlasTex]) gl.deleteTexture(t);
      gl.deleteFramebuffer(fbo);
      gl.deleteVertexArray(vao);
    },
  };
}
