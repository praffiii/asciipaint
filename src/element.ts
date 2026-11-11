import { fontAt } from "./atlas";
import { cssToRgba } from "./color";
import { DEFAULTS, validate, type Color } from "./options";
import { asciipaint, type Paint } from "./paint";

/** `<ascii-img>`'s constructor; `undefined` on the server, where there is no `HTMLElement`. */
export let AsciiImg: typeof HTMLElement | undefined;

// One hidden painter (one WebGL context) paints every element in turn; each copies the result out.
let shared: { paint: Paint; key: string } | null = null;
let queue = Promise.resolve();
let fonts: Promise<void> | undefined;

// The atlas is drawn when the painter is made, so the first paint waits for its font.
const fontsReady = () =>
  (fonts ??= document.fonts.load(fontAt(DEFAULTS.font, 8)).then(
    () => {},
    () => {},
  ));

function painter(cell: readonly [number, number], ramp: string): Paint {
  const key = `${cell.join(" ")}|${ramp}`;
  if (shared?.key === key) return shared.paint;
  // Same canvas, so the same context: a new cell or ramp never makes a second one.
  let canvas = shared?.paint.canvas;
  shared?.paint.dispose();
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.addEventListener("webglcontextlost", () => (shared = null)); // the next paint starts afresh
  }
  shared = { key, paint: asciipaint(canvas, { cell, ramp, edgeFade: 0 }) };
  return shared.paint;
}

/** The element's parent, stepping out of a shadow root to its host. */
const up = (e: Element): Element | null =>
  e.parentElement ?? (e.parentNode instanceof ShadowRoot ? e.parentNode.host : null);

/** The first `background-color` up the tree that isn't fully transparent, else white. */
function pageBackground(el: Element): Color {
  for (let e: Element | null = el; e; e = up(e)) {
    // Chrome keeps oklch / color-mix / display-p3 as written, so read back sRGB bytes and alpha.
    const px = cssToRgba(getComputedStyle(e).backgroundColor);
    if (px?.[3]) return [px[0] / 255, px[1] / 255, px[2] / 255];
  }
  return [1, 1, 1];
}

function size(v: string): number {
  const n = parseFloat(v);
  if (!(n >= 0)) throw new RangeError("must be a number ≥ 0");
  return n;
}

function cellOf(v: string): readonly [number, number] {
  const [w, h, ...rest] = v.trim().split(/\s+/).map(Number);
  const cell = [w ?? NaN, h ?? NaN] as const;
  if (rest.length) throw new RangeError("cell: needs two sizes");
  validate({ cell });
  return cell;
}

function define(): typeof HTMLElement {
  return class AsciiImg extends HTMLElement {
    static observedAttributes = [
      "src",
      "alt",
      "width",
      "height",
      "background",
      "edge-fade",
      "cell",
      "ramp",
    ];

    #canvas = document.createElement("canvas");
    #ctx = this.#canvas.getContext("2d")!;
    #style = document.createElement("style");
    #img: HTMLImageElement | null = null; // decoded and ready to paint
    #loading: HTMLImageElement | null = null;
    #queued = false;
    #raf = 0;
    #warned = new Set<string>();
    #resize = new ResizeObserver(() => {
      this.#raf ||= requestAnimationFrame(() => {
        this.#raf = 0;
        this.#request();
      });
    });

    constructor() {
      super();
      this.#canvas.width = this.#canvas.height = 0; // no 300 × 150 default box before the first paint
      this.attachShadow({ mode: "open" }).append(this.#style, this.#canvas);
      this.#layout();
    }

    connectedCallback() {
      if (!this.hasAttribute("role")) this.setAttribute("role", "img");
      this.#resize.observe(this);
    }

    disconnectedCallback() {
      this.#resize.disconnect();
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
      if (name === "alt") {
        if (value === null) this.removeAttribute("aria-label");
        else this.setAttribute("aria-label", value);
      } else if (name === "src") {
        this.#load(value);
      } else {
        this.#layout();
        this.#request();
      }
    }

    #load(src: string | null) {
      const img = (this.#loading = new Image());
      img.crossOrigin = "anonymous"; // WebGL can't read a cross-origin image without CORS
      img.src = src ?? "";
      img.decode().then(
        () => {
          if (this.#loading !== img) return;
          this.#img = img;
          this.#layout();
          this.#request();
        },
        () => {
          if (this.#loading !== img) return;
          this.#img = null; // broken or no src: show nothing
          this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
        },
      );
    }

    /** Sizes the host like `<img>`: attributes in CSS px, else the natural size (150 × 150 if none). */
    #layout() {
      const w = this.#read("width", size);
      const h = this.#read("height", size);
      const n = this.#img && {
        width: this.#img.naturalWidth || 150,
        height: this.#img.naturalHeight || 150,
      };
      const width = w ?? (n && (h === null ? n.width : (h * n.width) / n.height));
      const height = h ?? (n && (w === null ? n.height : (w * n.height) / n.width));
      const css =
        `:host{display:inline-block;${width === null ? "" : `width:${width}px;`}` +
        `${height === null ? "" : `height:${height}px`}}` +
        `canvas{display:block;width:100%;height:100%}`;
      if (this.#style.textContent !== css) this.#style.textContent = css;
    }

    /** Queues one paint; it reads the element's state when its turn comes, so requests collapse. */
    #request() {
      if (this.#queued) return;
      this.#queued = true;
      // The flag clears first, so nothing the turn throws can leave the element stuck.
      queue = queue
        .then(async () => {
          this.#queued = false;
          await fontsReady();
          this.#paint();
        })
        .catch(reportError);
    }

    #paint() {
      const img = this.#img;
      const { clientWidth: width, clientHeight: height } = this.#canvas;
      const cell = this.#read("cell", cellOf) ?? DEFAULTS.cell;
      if (!img || !this.isConnected || width < cell[0] || height < cell[1]) return;
      const ramp = this.#read("ramp", (v) => (validate({ ramp: v }), v)) ?? DEFAULTS.ramp;
      const p = painter(cell, ramp);
      p.set({
        background:
          this.#read("background", (v) => (p.set({ background: v }), v)) ?? pageBackground(this),
        edgeFade:
          this.#read("edge-fade", (v) => {
            const edgeFade = Number(v);
            validate({ edgeFade });
            return edgeFade;
          }) ?? 0,
      });
      p.resize({ width, height });
      p.draw(img);
      // Same task as draw(): the painter's buffer isn't preserved past it.
      this.#canvas.width = p.canvas.width;
      this.#canvas.height = p.canvas.height;
      this.#ctx.drawImage(p.canvas, 0, 0);
      this.dispatchEvent(new Event("paint"));
    }

    /** An attribute through `parse`, or null if absent or invalid (warned once per bad value). */
    #read<T>(name: string, parse: (v: string) => T): T | null {
      const v = this.getAttribute(name);
      if (v === null) return null;
      try {
        return parse(v);
      } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        if (!this.#warned.has(`${name}=${v}`)) {
          this.#warned.add(`${name}=${v}`);
          console.warn(`<ascii-img ${name}="${v}">: ${e.message}; using the default.`);
        }
        return null;
      }
    }
  };
}

// Last, so the module state above exists when `define` upgrades elements already in the page.
if (typeof customElements !== "undefined") {
  AsciiImg = define();
  if (!customElements.get("ascii-img")) customElements.define("ascii-img", AsciiImg);
}
