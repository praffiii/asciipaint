import { asciipaint, autoRender, type LiveOptions } from "../src/index";
import { DEFAULTS } from "../src/options";
// A named import: package.json marks only dist/element.js as side-effectful, so a bare import is dropped.
import { AsciiImg } from "../src/element";
import { LOGOS, pngUrl, svgUrl } from "./logos";
import type { Stage3d } from "./scene";
import { edgeColour, motion, sunsetImage } from "./sources";
import type { Object3D } from "three";

const PAPER = "#f4eedf";

// three.js is ~500 kB, so the 3D path loads only when a 3D source is picked.
type SceneModule = typeof import("./scene");
let sceneModule: Promise<SceneModule> | undefined;
const loadScene = () => (sceneModule ??= import("./scene"));

function el<T extends HTMLElement>(id: string, type: new () => T): T {
  const e = document.getElementById(id);
  if (!(e instanceof type)) throw new Error(`#${id} is missing`);
  return e;
}

/** An error whose message is written for the reader of the page. */
class Problem extends Error {}

// ---- Hero ------------------------------------------------------------------------------------

function hero() {
  const canvas = el("hero", HTMLCanvasElement);
  const sketch = motion(960, 540);
  try {
    const paint = asciipaint(canvas); // the default paper is the page's own colour
    // The sketch takes the hero's own size, so a tall phone hero shows the whole composition.
    const resize = () => {
      paint.resize();
      sketch.resize(canvas.clientWidth, canvas.clientHeight);
    };
    autoRender({ canvas, resize }, (now) => {
      sketch.step(now);
      paint.draw(sketch.canvas);
    });
  } catch {
    canvas.replaceWith(sketch.canvas); // no WebGL2: show the unpainted animation's first frame
    sketch.step(0);
  }
}

// ---- Install and copy buttons ----------------------------------------------------------------

function install() {
  const cmd = el("install-cmd", HTMLElement);
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".managers button")];
  for (const b of buttons) {
    b.addEventListener("click", () => {
      for (const o of buttons) o.setAttribute("aria-pressed", String(o === b));
      cmd.textContent = b.dataset.cmd ?? "";
    });
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    let reset = 0;
    b.addEventListener("click", async () => {
      const text = document.getElementById(b.dataset.copy ?? "")?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        b.textContent = "Copied";
      } catch {
        b.textContent = "Select it to copy";
      }
      clearTimeout(reset);
      reset = window.setTimeout(() => (b.textContent = "Copy"), 1600);
    });
  }
}

// ---- Logo wall ---------------------------------------------------------------------------------

async function logoWall() {
  if (!AsciiImg) return;
  el("tag-live", HTMLElement).setAttribute("src", svgUrl(LOGOS[0]!));
  const marks = await Promise.all(
    LOGOS.map(async (logo) => [
      { src: svgUrl(logo), alt: logo.name, format: "svg" },
      { src: await pngUrl(logo), alt: logo.name, format: "png" },
    ]),
  );
  el("logos", HTMLElement).replaceChildren(
    ...marks.flat().map(({ src, alt, format }) => {
      const img = document.createElement("ascii-img");
      img.setAttribute("src", src);
      img.setAttribute("alt", alt);
      img.dataset.format = format;
      return img;
    }),
  );
}

// ---- Playground --------------------------------------------------------------------------------

const BUILT_IN = ["image", "motion", "three", "webcam"] as const;
type BuiltIn = (typeof BUILT_IN)[number];
const isBuiltIn = (v: string): v is BuiltIn => BUILT_IN.some((k) => k === v);

interface FlatSource {
  kind: "image" | "motion" | "webcam" | "file";
  el: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
  /** A still is drawn only when something changed, not on every frame. */
  still: boolean;
  tick?: (now: number) => void;
  release?: () => void;
}
type Source = FlatSource | { kind: "three"; model: Object3D | null; three: SceneModule };

interface Running {
  set(live: LiveOptions): void;
  refresh(): void;
  stop(): void;
}

interface Settings {
  cell: [number, number];
  ramp: string;
  font: string;
  background: string;
  edgeFade: number;
  sparkle: boolean;
}

function playground() {
  const stage = el("stage", HTMLDivElement);
  const raw = el("raw", HTMLDivElement);
  const flat = el("flat", HTMLCanvasElement);
  const solid = el("solid", HTMLCanvasElement);
  const message = el("message", HTMLParagraphElement);
  const beforeButton = el("before", HTMLButtonElement);
  const fileInput = el("file", HTMLInputElement);
  const code = el("snippet", HTMLElement);
  const inputs = {
    cellW: el("cell-w", HTMLInputElement),
    cellH: el("cell-h", HTMLInputElement),
    edgeFade: el("edge-fade", HTMLInputElement),
    ramp: el("ramp", HTMLInputElement),
    font: el("font", HTMLSelectElement),
    background: el("background", HTMLInputElement),
    sparkle: el("sparkle", HTMLInputElement),
  };
  const out = (id: string, v: string) => (el(`${id}-out`, HTMLOutputElement).value = v);

  const settings: Settings = {
    cell: [DEFAULTS.cell[0], DEFAULTS.cell[1]],
    ramp: DEFAULTS.ramp,
    font: DEFAULTS.font,
    background: PAPER,
    edgeFade: DEFAULTS.edgeFade,
    sparkle: DEFAULTS.sparkle,
  };
  const sketch = motion(960, 720);
  let sunset: HTMLImageElement | undefined;
  let scene: Stage3d | undefined;
  let source: Source | null = null;
  let running: Running | null = null;
  let before = false;
  let picking = 0;

  const say = (text: string) => (message.textContent = text);
  const onContextLost = () => say("The graphics context was lost. Reload the page to paint again.");

  // -- Painting

  function startFlat(src: FlatSource): Running {
    const paint = asciipaint(flat, settings);
    let dirty = true;
    const loop = autoRender(
      {
        canvas: flat,
        resize() {
          paint.resize();
          dirty = true;
        },
      },
      (now) => {
        src.tick?.(now);
        if (src.still && !dirty) return;
        dirty = false;
        paint.draw(src.el);
      },
      { onContextLost },
    );
    return {
      set(live) {
        paint.set(live);
        dirty = true;
        loop.requestFrame();
      },
      refresh: () => loop.requestFrame(),
      stop() {
        loop.stop();
        paint.dispose();
      },
    };
  }

  function startThree(three: SceneModule): Running {
    const s = (scene ??= three.stage3d(solid));
    const paint = three.asciipaintThree(s.renderer, settings);
    const loop = autoRender(paint, (now) => s.frame(now, before ? null : paint), {
      onContextLost,
    });
    return {
      set(live) {
        paint.set(live);
        loop.requestFrame();
      },
      refresh: () => loop.requestFrame(),
      stop() {
        loop.stop();
        paint.dispose();
      },
    };
  }

  /** (Re)creates the paint for the current source and settings: cell, ramp and font need this. */
  function start() {
    running?.stop();
    running = null;
    if (!source) return;
    try {
      running = source.kind === "three" ? startThree(source.three) : startFlat(source);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    snippet();
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
    snippet();
  };

  function setBackground(hex: string) {
    settings.background = hex;
    inputs.background.value = hex;
    out("background", hex);
  }

  // -- Sources

  async function webcam(): Promise<Source> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Problem("This page can't reach a camera here: it needs HTTPS or localhost.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new Problem(
          "Camera access is blocked. Allow the camera for this page in your browser's site settings, then pick Webcam again.",
        );
      }
      if (name === "NotSupportedError") {
        throw new Problem("This browser can't share a camera with the page. Pick another source.");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new Problem("No camera was found. Connect one, or pick another source.");
      }
      throw new Problem(
        "The camera didn't start. Close other apps using it, or pick another source.",
      );
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    const release = () => stream.getTracks().forEach((t) => t.stop());
    try {
      await video.play();
    } catch {
      release();
      throw new Problem("The camera didn't start. Pick Webcam again.");
    }
    return { kind: "webcam", el: video, still: false, release };
  }

  async function dropped(file: File): Promise<Source> {
    if (/\.(glb|gltf)$/i.test(file.name)) {
      try {
        const three = await loadScene();
        return { kind: "three", model: await three.parseGltf(await file.arrayBuffer()), three };
      } catch {
        throw new Problem(
          `${file.name} couldn't be read. Drop a .glb, or a .gltf with its buffers and textures embedded.`,
        );
      }
    }
    if (!file.type.startsWith("image/")) throw new Problem("Drop an image, a .glb or a .gltf.");
    const img = new Image();
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    const release = () => URL.revokeObjectURL(img.src);
    try {
      await img.decode();
    } catch {
      release();
      throw new Problem(`${file.name} couldn't be decoded. Try a PNG, JPEG, WebP, GIF or SVG.`);
    }
    return { kind: "file", el: img, still: true, release };
  }

  async function load(kind: BuiltIn): Promise<Source> {
    if (kind === "image") return { kind, el: (sunset ??= await sunsetImage()), still: true };
    if (kind === "motion")
      return { kind, el: sketch.canvas, still: false, tick: (now) => sketch.step(now) };
    if (kind === "three") return { kind, model: null, three: await loadScene() };
    return webcam();
  }

  /** Checks the radio for the current source; none for a dropped file. */
  function syncRadios() {
    for (const r of document.querySelectorAll<HTMLInputElement>('input[name="source"]')) {
      r.checked = r.value === source?.kind;
    }
  }

  async function pick(next: Promise<Source>) {
    const id = ++picking;
    say("");
    let picked: Source;
    try {
      picked = await next;
    } catch (e) {
      if (id !== picking) return;
      say(e instanceof Problem ? e.message : "That source couldn't be loaded. Pick another one.");
      syncRadios(); // the previous source keeps painting
      return;
    }
    if (id !== picking) {
      if (picked.kind !== "three") picked.release?.();
      return;
    }
    if (source && source !== picked && source.kind !== "three") source.release?.();
    source = picked;
    syncRadios();

    const three = picked.kind === "three";
    flat.hidden = three;
    solid.hidden = !three;
    stage.classList.toggle("is-before", before && !three);
    let edge: string | null;
    if (picked.kind === "three") {
      scene ??= picked.three.stage3d(solid);
      scene.show(picked.model);
      edge = scene.edge();
      raw.replaceChildren();
    } else {
      picked.tick?.(performance.now());
      edge = edgeColour(picked.el);
      raw.replaceChildren(picked.el);
    }
    setBackground(edge ?? PAPER);
    start();
  }

  // -- Wiring

  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="source"]')) {
    r.addEventListener("change", () => {
      if (r.checked && isBuiltIn(r.value)) void pick(load(r.value));
    });
  }
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = ""; // the same file can be picked again
    if (file) void pick(dropped(file));
  });
  stage.addEventListener("dragover", (e) => {
    e.preventDefault();
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("dragleave", () => stage.classList.remove("is-dragging"));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    stage.classList.remove("is-dragging");
    const file = e.dataTransfer?.files[0];
    if (file) void pick(dropped(file));
  });

  beforeButton.addEventListener("click", () => {
    before = !before;
    beforeButton.setAttribute("aria-pressed", String(before));
    stage.classList.toggle("is-before", before && source?.kind !== "three");
    running?.refresh();
  });

  const cell = () => {
    settings.cell = [Number(inputs.cellW.value), Number(inputs.cellH.value)];
    out("cell-w", inputs.cellW.value);
    out("cell-h", inputs.cellH.value);
    rebuild();
  };
  inputs.cellW.addEventListener("input", cell);
  inputs.cellH.addEventListener("input", cell);
  inputs.ramp.addEventListener("input", () => {
    const ok = Array.from(inputs.ramp.value).length >= 2;
    inputs.ramp.setAttribute("aria-invalid", String(!ok));
    say(ok ? "" : "The ramp needs at least 2 glyphs, dark to bright.");
    if (!ok) return;
    settings.ramp = inputs.ramp.value;
    rebuild();
  });
  inputs.font.addEventListener("change", () => {
    settings.font = inputs.font.value;
    rebuild();
  });
  inputs.edgeFade.addEventListener("input", () => {
    settings.edgeFade = Number(inputs.edgeFade.value);
    out("edge-fade", settings.edgeFade.toFixed(3));
    live({ edgeFade: settings.edgeFade });
  });
  inputs.background.addEventListener("input", () => {
    setBackground(inputs.background.value);
    live({ background: settings.background });
  });
  inputs.sparkle.addEventListener("change", () => {
    settings.sparkle = inputs.sparkle.checked;
    live({ sparkle: settings.sparkle });
  });

  // -- Snippet

  const quote = (s: string) => (s.includes('"') && !s.includes("'") ? `'${s}'` : JSON.stringify(s));

  function snippet() {
    const s = settings;
    const d = DEFAULTS;
    const lines: string[] = [];
    if (s.cell[0] !== d.cell[0] || s.cell[1] !== d.cell[1])
      lines.push(`cell: [${s.cell.join(", ")}]`);
    if (s.ramp !== d.ramp) lines.push(`ramp: ${quote(s.ramp)}`);
    if (s.font !== d.font) lines.push(`font: ${quote(s.font)}`);
    if (s.background !== PAPER) lines.push(`background: "${s.background}"`);
    if (Math.abs(s.edgeFade - d.edgeFade) > 1e-9) lines.push(`edgeFade: ${s.edgeFade}`);
    if (s.sparkle) lines.push("sparkle: true");
    const options = lines.length ? `, {\n${lines.map((l) => `  ${l},`).join("\n")}\n}` : "";

    if (source?.kind === "three") {
      code.textContent = [
        'import { autoRender } from "asciipaint";',
        'import { asciipaintThree } from "asciipaint/three";',
        "",
        `const paint = asciipaintThree(renderer${options});`,
        "autoRender(paint, () => paint.render(scene, camera));",
      ].join("\n");
      return;
    }
    const [name, note] =
      source?.kind === "motion"
        ? ["sketch", "a <canvas> you draw on every frame"]
        : source?.kind === "webcam"
          ? ["video", "a playing <video>, here from getUserMedia"]
          : ["img", "a decoded <img>"];
    code.textContent = [
      'import { asciipaint, autoRender } from "asciipaint";',
      "",
      `// ${name}: ${note}`,
      `const paint = asciipaint(canvas${options});`,
      `autoRender(paint, () => paint.draw(${name}));`,
    ].join("\n");
  }

  void pick(load("image"));
}

hero();
install();
playground();
void logoWall();
