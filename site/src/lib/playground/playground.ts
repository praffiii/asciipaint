import { asciipaint, autoRender, type LiveOptions } from "asciipaint";
import { glyphFont } from "../glyph-font";
import { liquid } from "../liquid";
import type { Stage3d } from "../scene";
import { paintStill } from "../still";
import { cellFor, DEFAULT_SETTINGS, isRamp, type Settings } from "./settings";
import { snippet, tokens } from "./snippet";
import {
  camera,
  dropped,
  liquidSource,
  Problem,
  threeSource,
  type FlatSource,
  type SceneModule,
  type Source,
} from "./sources";

interface Running {
  set(live: LiveOptions): void;
  stop(): void;
}

const BUILT_IN = ["liquid", "three", "camera"] as const;
type BuiltIn = (typeof BUILT_IN)[number];
const isBuiltIn = (v: string | undefined): v is BuiltIn => BUILT_IN.some((k) => k === v);

/**
 * Wires one playground: the stage and its sources, the console, and the live snippet. The same
 * markup serves the landing's band and the full-screen page; `data-playground="full"` makes the
 * whole page the drop target.
 */
export function playground(root: HTMLElement): void {
  const q = <T extends Element>(selector: string, type: new () => T): T => {
    const e = root.querySelector(selector);
    if (!(e instanceof type)) throw new Error(`${selector} is missing`);
    return e;
  };
  const stage = q("[data-stage]", HTMLElement);
  const flat = q("[data-stage-flat]", HTMLCanvasElement);
  const solid = q("[data-stage-solid]", HTMLCanvasElement);
  const cells = q("[data-cells]", HTMLElement);
  const message = q("[data-message]", HTMLElement);
  const fileInput = q("[data-file]", HTMLInputElement);
  const slider = q("[data-cell]", HTMLInputElement);
  const cellOut = q("[data-cell-out]", HTMLElement);
  const keys = q("[data-ramp-keys]", HTMLElement);
  const rampInput = q("[data-ramp-input]", HTMLInputElement);
  const edit = q("[data-edit]", HTMLButtonElement);
  const code = q("#code-your-settings-ts", HTMLElement);
  const note = root.querySelector(".card-note");
  const tiles = [...root.querySelectorAll<HTMLButtonElement>("[data-source]")];
  const swatches = [...root.querySelectorAll<HTMLButtonElement>("[data-swatch]")];
  const sparkles = [...root.querySelectorAll<HTMLButtonElement>("[data-sparkle]")];
  const phone = matchMedia("(max-width: 640px)");

  const settings: Settings = { ...DEFAULT_SETTINGS, cell: [...DEFAULT_SETTINGS.cell] };
  const font = glyphFont();
  let scene: Stage3d | undefined;
  let source: Source | null = null;
  let running: Running | null = null;
  let picking = 0;

  const say = (text: string) => (message.textContent = text);
  const onContextLost = () => {
    say("The graphics context was lost. Reload the page to paint again.");
    root.dataset.fallback = "";
  };

  let readout = "";
  const count = (canvas: HTMLCanvasElement) => {
    const text = `${Math.floor(canvas.clientWidth / settings.cell[0])} × ${Math.floor(canvas.clientHeight / settings.cell[1])} CELLS`;
    if (text !== readout) cells.textContent = readout = text;
  };

  // -- Painting

  function startFlat(src: FlatSource): Running {
    const paint = asciipaint(flat, { ...settings, font });
    let dirty = true;
    const resize = () => {
      paint.resize();
      dirty = true;
    };
    const loop = autoRender(
      { canvas: flat, resize },
      (now) => {
        count(flat);
        if (src.still && !dirty) return;
        dirty = false;
        paint.draw(src.frame(now, flat.clientWidth, flat.clientHeight));
        root.dataset.painting = src.kind;
      },
      { onContextLost },
    );
    return {
      set(live) {
        paint.set(live);
        dirty = true;
        loop.requestFrame();
      },
      stop() {
        loop.stop();
        paint.dispose();
      },
    };
  }

  /** The 3D stage, made once. Its first raw frame becomes the 3D tile's thumbnail. */
  function stageFor(three: SceneModule): Stage3d {
    if (scene) return scene;
    try {
      scene = three.stage3d(solid);
    } catch (e) {
      throw new Problem("asciipaint needs WebGL2", { cause: e });
    }
    const thumb = root.querySelector<HTMLCanvasElement>("[data-thumb-three]");
    const ctx = thumb?.getContext("2d");
    if (thumb && ctx) {
      scene.edge(); // one raw render, readable in this task
      const raw = scene.renderer.domElement;
      thumb.width = 320;
      thumb.height = Math.round((320 * raw.height) / Math.max(raw.width, 1));
      ctx.drawImage(raw, 0, 0, thumb.width, thumb.height);
      thumb.closest("[data-source]")?.classList.add("has-thumb");
    }
    return scene;
  }

  function startThree(three: SceneModule): Running {
    const s = stageFor(three);
    const paint = three.asciipaintThree(s.renderer, { ...settings, font });
    const loop = autoRender(
      paint,
      (now) => {
        count(solid);
        s.frame(now, paint);
        root.dataset.painting = "three";
      },
      { onContextLost },
    );
    return {
      set(live) {
        paint.set(live);
        loop.requestFrame();
      },
      stop() {
        loop.stop();
        paint.dispose();
      },
    };
  }

  /** (Re)creates the paint for the current source and settings: cell and ramp need this. */
  function start() {
    running?.stop();
    running = null;
    if (!source) return;
    try {
      running = source.kind === "three" ? startThree(source.three) : startFlat(source);
      delete root.dataset.fallback;
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
      root.dataset.fallback = "";
    }
  }

  let queued = false;
  const rebuild = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      start();
    });
  };

  const live = (o: LiveOptions) => {
    running?.set(o);
    renderSnippet();
  };

  function setBackground(hex: string) {
    settings.background = hex;
    for (const s of swatches) s.setAttribute("aria-pressed", String(s.dataset.swatch === hex));
  }

  // -- Sources

  function syncTiles() {
    for (const t of tiles) t.setAttribute("aria-pressed", String(t.dataset.source === source?.kind));
  }

  async function pick(next: () => Source | Promise<Source>) {
    const id = ++picking;
    say("");
    let picked: Source;
    try {
      picked = await next();
    } catch (e) {
      if (id !== picking) return;
      say(e instanceof Problem ? e.message : "That source couldn't be loaded. Pick another one.");
      if (!source) root.dataset.fallback = "";
      syncTiles(); // the previous source keeps painting
      return;
    }
    if (id !== picking) {
      if (picked.kind !== "three") picked.release?.();
      return;
    }
    if (source && source !== picked && source.kind !== "three") source.release?.();
    source = picked;
    syncTiles();

    const three = picked.kind === "three";
    flat.hidden = three;
    solid.hidden = !three;
    let edge: string | null = null;
    if (picked.kind === "three") {
      try {
        const s = stageFor(picked.three);
        s.show(picked.model);
        edge = s.edge()?.toUpperCase() ?? null;
      } catch {
        // start() below meets the same failure and says why
      }
    } else {
      edge = picked.edge;
    }
    setBackground(edge ?? DEFAULT_SETTINGS.background);
    start();
    renderSnippet();
  }

  for (const tile of tiles) {
    tile.addEventListener("click", () => {
      const kind = tile.dataset.source;
      if (!isBuiltIn(kind)) return fileInput.click();
      if (source?.kind === kind) return;
      void pick(kind === "liquid" ? liquidSource : kind === "three" ? threeSource : camera);
    });
  }
  q("[data-browse]", HTMLButtonElement).addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = ""; // the same file can be picked again
    if (file) void pick(() => dropped(file));
  });

  // The band (inline) or the whole page (full) takes a dropped file; dragged text is left alone.
  const zone = root.dataset.playground === "full" ? document.documentElement : (root.closest<HTMLElement>(".band") ?? root);
  const carriesFile = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
  let depth = 0;
  zone.addEventListener("dragenter", (e) => {
    if (!carriesFile(e)) return;
    depth++;
    stage.classList.add("is-dragging");
  });
  zone.addEventListener("dragleave", (e) => {
    if (carriesFile(e) && --depth <= 0) stage.classList.remove("is-dragging");
  });
  zone.addEventListener("dragover", (e) => {
    if (carriesFile(e)) e.preventDefault();
  });
  zone.addEventListener("drop", (e) => {
    if (!carriesFile(e)) return;
    e.preventDefault();
    depth = 0;
    stage.classList.remove("is-dragging");
    const file = e.dataTransfer?.files[0];
    if (file) void pick(() => dropped(file));
  });

  // -- Console

  slider.addEventListener("input", () => {
    settings.cell = cellFor(Number(slider.value));
    const text = `${settings.cell[0]} × ${settings.cell[1]} px`;
    cellOut.textContent = text.toUpperCase();
    slider.setAttribute("aria-valuetext", text);
    slider.style.setProperty("--fill", `${(100 * (Number(slider.value) - Number(slider.min))) / (Number(slider.max) - Number(slider.min))}%`);
    count(source?.kind === "three" ? solid : flat);
    renderSnippet();
    rebuild();
  });

  function renderKeys() {
    keys.replaceChildren(
      ...Array.from(settings.ramp, (glyph, i) => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "keycap keycap-dark keycap-sm glyph";
        key.dataset.glyph = String(i);
        key.textContent = glyph;
        return key;
      }),
    );
  }
  function openEditor(at: number | undefined) {
    keys.hidden = true;
    rampInput.hidden = false;
    rampInput.value = settings.ramp;
    edit.textContent = "DONE";
    rampInput.focus();
    if (at !== undefined) {
      const start = Array.from(settings.ramp).slice(0, at).join("").length;
      rampInput.setSelectionRange(start, start + (Array.from(settings.ramp)[at]?.length ?? 0));
    }
  }
  function closeEditor() {
    if (rampInput.getAttribute("aria-invalid") === "true") {
      rampInput.setAttribute("aria-invalid", "false");
      say("");
    }
    renderKeys();
    rampInput.hidden = true;
    keys.hidden = false;
    edit.textContent = "EDIT";
  }
  keys.addEventListener("click", (e) => {
    const key = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-glyph]") : null;
    if (key) openEditor(Number(key.dataset.glyph));
  });
  edit.addEventListener("click", () => (rampInput.hidden ? openEditor(undefined) : closeEditor()));
  rampInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== "Escape") return;
    e.preventDefault();
    closeEditor();
    edit.focus();
  });
  rampInput.addEventListener("input", () => {
    const ok = isRamp(rampInput.value);
    rampInput.setAttribute("aria-invalid", String(!ok));
    say(ok ? "" : "The ramp needs at least 2 glyphs, dark to bright.");
    if (!ok) return;
    settings.ramp = rampInput.value;
    renderSnippet();
    rebuild();
  });

  for (const swatch of swatches) {
    swatch.addEventListener("click", () => {
      const hex = swatch.dataset.swatch;
      if (!hex) return;
      setBackground(hex);
      live({ background: hex });
    });
  }
  for (const toggle of sparkles) {
    toggle.addEventListener("click", () => {
      settings.sparkle = toggle.dataset.sparkle === "on";
      for (const t of sparkles) t.setAttribute("aria-pressed", String(t === toggle));
      live({ sparkle: settings.sparkle });
    });
  }

  // -- Snippet: coloured with spans and text nodes, since the ramp is user input

  function renderSnippet() {
    const text = snippet(settings, source?.kind ?? "liquid", phone.matches);
    code.replaceChildren(
      ...tokens(text).map(({ text, kind }) => {
        if (kind === "plain") return document.createTextNode(text);
        const span = document.createElement("span");
        span.className = `tok-${kind}`;
        span.textContent = text;
        return span;
      }),
    );
    if (note) note.textContent = phone.matches ? "live" : "updates as you drag";
  }
  phone.addEventListener("change", renderSnippet);
  renderSnippet();

  // -- The liquid tile's still; the 3D tile waits for three.js to load for its own reasons.

  const liquidThumb = root.querySelector<HTMLElement>("[data-thumb-liquid]");
  if (liquidThumb) {
    paintStill(
      liquidThumb,
      (w, h) => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const frame = liquid()?.frame(11, canvas.width, canvas.height, "stage");
        if (frame) canvas.getContext("2d")?.drawImage(frame, 0, 0);
        return canvas;
      },
      { background: "#000000" },
    );
  }

  void pick(liquidSource);
}
